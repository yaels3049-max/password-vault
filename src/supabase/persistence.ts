import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile/accessProfileModel';
import { ACCESS_PROFILE_SCHEMA_VERSION } from '../profile/accessProfileModel';
import { normalizeExactlyOneDefaultPerService } from '../profile/profileValidation';
import { isDevBuild } from '../dev/devMode';
import {
  decryptCredentialSetWithKeys,
  encryptCredentialSet,
  type KdfParams,
} from '../vault/crypto';
import type { VaultState } from '../vault/vault';
import { tryGetAuthenticatedUserId } from '../auth';
import { getSupabaseClient } from './client';
import {
  registryRowToServiceDefinition,
  type ServiceRegistryRow,
} from '../registry/registryMapper';
import { CLOUD_REMOVE_UNAVAILABLE_MESSAGE } from '../serviceManagement/serviceSelection';
import {
  credentialChangedSinceBaseline,
  forgetProfile,
  hasSessionSyncScope,
  markProfileSynced,
  pendingProfileIds,
  profileHasPendingWrite,
  profileSnapshot,
  rebaseSessionSyncScope,
  type CloudSyncBaseline,
} from './sessionSyncScope';
import { outboxOf, type ConfirmedInserts } from '../vault/syncOutbox';
import { applyOutboxAfterHydrate } from '../digitalHome/cloudReconcile';
import { isApprovedForUsers } from '../digitalHome/ownSiteDefinition';
import {
  dropServicesMissingFromRegistry,
  fetchRegistryPresence,
  registryPresenceCandidates,
  upsertableSelectedIds,
} from './registryPresence';

export interface CloudSyncOptions {
  /** Test hook: simulate Supabase write failure without disabling local persist. */
  forceFail?: boolean;
  /** AD-123-18: write every row, not only pending ones. Rows outside the outbox stay update-only. */
  writeAll?: boolean;
  /**
   * Vault namespace that started this dual-write (D-109-26).
   * Abort if Auth session has switched to another user mid-flight.
   */
  expectedUserId?: string;
  /**
   * Dual-write generation (D-113-29). Stale in-flight syncs abort so they cannot
   * re-upsert a service after «הסר אתר».
   */
  generation?: number;
}

/** Bumped on every vault persist/cloud write start — invalidates older dual-writes. */
let dualWriteGeneration = 0;

export function bumpDualWriteGeneration(): number {
  dualWriteGeneration += 1;
  return dualWriteGeneration;
}

export function getDualWriteGeneration(): number {
  return dualWriteGeneration;
}

/**
 * AD-123-18 — rows an update-only write found missing in the cloud (deleted elsewhere), and
 * outbox rows the cloud now has (amendment A: inserted or already present → leave the outbox).
 */
export interface CloudSyncResult {
  goneProfileIds: string[];
  goneServiceIds: string[];
  confirmed: ConfirmedInserts;
}

type CloudGoneListener = (gone: CloudSyncResult) => void;
let cloudGoneListener: CloudGoneListener | null = null;

/** Background dual-writes (via `persistVault`) report deleted-elsewhere rows here. */
export function setCloudGoneListener(listener: CloudGoneListener | null): void {
  cloudGoneListener = listener;
}

type CloudConfirmedListener = (confirmed: ConfirmedInserts) => void;
let cloudConfirmedListener: CloudConfirmedListener | null = null;

/** Background dual-writes report confirmed outbox inserts here (the caller persists the clear). */
export function setCloudConfirmedListener(listener: CloudConfirmedListener | null): void {
  cloudConfirmedListener = listener;
}

function emptySyncResult(): CloudSyncResult {
  return { goneProfileIds: [], goneServiceIds: [], confirmed: { serviceIds: [], profileIds: [] } };
}

export function hasGoneRows(result: CloudSyncResult): boolean {
  return result.goneProfileIds.length > 0 || result.goneServiceIds.length > 0;
}

const nowIso = (): string => new Date().toISOString();

const OWNED_CUSTOM_SELECT =
  'id, display_name, primary_url, login_url, login_url_status, category_id, icon, adapter_id, login_fields, source_type, service_status, metadata, owner_user_id';

function isKdfParams(value: unknown): value is KdfParams {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    row.algorithm === 'argon2id' &&
    typeof row.salt === 'string' &&
    row.salt.length > 0 &&
    typeof row.iterations === 'number' &&
    typeof row.memorySize === 'number' &&
    typeof row.parallelism === 'number'
  );
}

export async function ensureUserRow(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const timestamp = nowIso();
  const { error } = await supabase.from('users').upsert(
    { id: userId, updated_at: timestamp },
    { onConflict: 'id' },
  );

  if (error) {
    throw error;
  }
}

/**
 * Fetch cloud vault KDF params for cross-browser key parity (D-109-24).
 * Salt is not secret; never stores password or AES key.
 */
export async function fetchVaultKdf(userId: string): Promise<KdfParams | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('vault_kdf')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return isKdfParams(data.vault_kdf) ? data.vault_kdf : null;
}

/**
 * Seed vault_kdf once (first writer wins). Never overwrite an existing cloud salt —
 * that would orphan ciphertext encrypted under the prior key.
 */
export async function ensureVaultKdfSeeded(
  userId: string,
  kdf: KdfParams,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const existing = await fetchVaultKdf(userId);
  if (existing) {
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ vault_kdf: kdf, updated_at: nowIso() })
    .eq('id', userId)
    .is('vault_kdf', null);

  if (error && isDevBuild()) {
    console.warn('[vault] Failed to seed vault_kdf:', error);
  }
}

async function upsertUserService(
  userId: string,
  serviceId: string,
  sortOrder: number | null,
): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabase
    .from('user_services')
    .upsert(
      {
        user_id: userId,
        service_id: serviceId,
        sort_order: sortOrder,
      },
      { onConflict: 'user_id,service_id' },
    )
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

async function upsertAccessProfile(
  userId: string,
  userServiceId: string,
  profile: AccessProfile,
): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabase
    .from('access_profiles')
    .upsert(
      {
        user_id: userId,
        user_service_id: userServiceId,
        local_profile_id: profile.id,
        display_name: profile.displayName,
        is_default: profile.isDefault === true,
        schema_version: profile.schemaVersion,
        updated_at: nowIso(),
      },
      { onConflict: 'user_id,local_profile_id' },
    )
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

/** AD-123-18 update-only: returns the cloud id, or `null` when the row no longer exists. */
async function updateAccessProfileIfExists(
  userId: string,
  userServiceId: string,
  profile: AccessProfile,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabase
    .from('access_profiles')
    .update({
      user_service_id: userServiceId,
      display_name: profile.displayName,
      is_default: profile.isDefault === true,
      schema_version: profile.schemaVersion,
      updated_at: nowIso(),
    })
    .eq('user_id', userId)
    .eq('local_profile_id', profile.id)
    .select('id');

  if (error) {
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : null;
  return row?.id ? String(row.id) : null;
}

async function upsertEncryptedCredential(
  cloudProfileId: string,
  cryptoKey: CryptoKey,
  credential: Credential,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const encrypted = await encryptCredentialSet(cryptoKey, credential);
  const { error } = await supabase.from('encrypted_credentials').upsert(
    {
      access_profile_id: cloudProfileId,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      algorithm: 'aes-256-gcm',
      field_ids_present: encrypted.fieldIdsPresent,
      updated_at: nowIso(),
    },
    { onConflict: 'access_profile_id' },
  );

  if (error) {
    throw error;
  }
}

/**
 * Explicit user remove-credential only (D-109-25 / AC-109-39).
 * Dual-write must NOT call this when a sync payload merely omits values.
 */
export async function deleteCloudEncryptedCredentialByLocalProfileId(
  localProfileId: string,
): Promise<void> {
  const trimmed = localProfileId.trim();
  if (!trimmed) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const userId = await tryGetAuthenticatedUserId();
  if (!userId) {
    return;
  }

  const { data: profile, error: lookupError } = await supabase
    .from('access_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('local_profile_id', trimmed)
    .maybeSingle();

  if (lookupError || !profile?.id) {
    return;
  }

  const { error } = await supabase
    .from('encrypted_credentials')
    .delete()
    .eq('access_profile_id', profile.id);

  if (error) {
    throw error;
  }
}

/**
 * Explicit user delete-profile only (D-109-26 / AC-109-41).
 * Cascades encrypted_credentials via FK. Dual-write must NOT delete profiles by omission.
 * Silent no-op without client/session is forbidden — UI must not claim success.
 */
export async function deleteAccessProfileFromCloud(
  localProfileId: string,
): Promise<void> {
  const trimmed = localProfileId.trim();
  if (!trimmed) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(CLOUD_REMOVE_UNAVAILABLE_MESSAGE);
  }

  const userId = await tryGetAuthenticatedUserId();
  if (!userId) {
    throw new Error(CLOUD_REMOVE_UNAVAILABLE_MESSAGE);
  }

  const { error } = await supabase
    .from('access_profiles')
    .delete()
    .eq('user_id', userId)
    .eq('local_profile_id', trimmed);

  if (error) {
    throw error;
  }
  forgetProfile(userId, trimmed);
}

/**
 * Explicit user remove-service only (D-109-25 / D-113-29). Cascades profiles + ciphertext via FK.
 * Dual-write must NOT delete user_services absent from a partial local snapshot.
 *
 * When the Hub is cloud-capable, silent no-op is forbidden (AC-113-51): missing client or
 * session must throw so the UI rolls back and does not claim a durable remove.
 */
export async function removeUserServiceFromCloud(serviceId: string): Promise<void> {
  const trimmed = serviceId.trim();
  if (!trimmed) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(CLOUD_REMOVE_UNAVAILABLE_MESSAGE);
  }

  const userId = await tryGetAuthenticatedUserId();
  if (!userId) {
    throw new Error(CLOUD_REMOVE_UNAVAILABLE_MESSAGE);
  }

  // Invalidate in-flight dual-writes that might re-upsert this membership.
  bumpDualWriteGeneration();

  const { error } = await supabase
    .from('user_services')
    .delete()
    .eq('user_id', userId)
    .eq('service_id', trimmed);

  if (error) {
    throw error;
  }

  // Supabase can "succeed" with 0 rows deleted — verify membership is gone (AC-113-51).
  const { data: remaining, error: verifyError } = await supabase
    .from('user_services')
    .select('id')
    .eq('user_id', userId)
    .eq('service_id', trimmed)
    .maybeSingle();

  if (verifyError) {
    throw verifyError;
  }
  if (remaining?.id) {
    throw new Error(CLOUD_REMOVE_UNAVAILABLE_MESSAGE);
  }
}

/**
 * Dual-write vault state to Supabase — **upsert only** (D-109-25 / AC-109-39).
 * Never deletes cloud `encrypted_credentials` or `user_services` because they are
 * missing from this payload. Explicit removes use dedicated APIs.
 *
 * Membership (`user_services`) follows `selectedIds` only. Local profiles/credentials
 * for deselected sites stay in IndexedDB (AC-104-16) but must NOT re-upsert cloud
 * membership — that resurrected tiles after «הסר אתר» (D-113-29 / AC-113-51).
 *
 * ID mapping: vault `profile-*` ids → `access_profiles.local_profile_id`.
 */
export async function syncVaultStateToSupabase(
  cryptoKey: CryptoKey,
  state: VaultState,
  options?: CloudSyncOptions,
): Promise<CloudSyncResult> {
  const result = emptySyncResult();
  if (options?.forceFail || import.meta.env.VITE_PHASE101_FORCE_CLOUD_FAIL === 'true') {
    throw new Error('Phase 101 forced cloud write failure (test hook)');
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return result;
  }

  // Phase 109: never create anonymous users for dual-write.
  const userId = await tryGetAuthenticatedUserId();
  if (!userId) {
    return result;
  }

  // D-109-26 / AC-109-40: never dual-write another user's vault into the active Auth session.
  if (options?.expectedUserId && options.expectedUserId.trim() !== userId) {
    if (isDevBuild()) {
      console.warn(
        '[vault] dual-write aborted — Auth user changed since vault persist started',
        { expected: options.expectedUserId, auth: userId },
      );
    }
    return result;
  }

  const generation = options?.generation ?? dualWriteGeneration;
  if (generation !== dualWriteGeneration) {
    if (isDevBuild()) {
      console.warn('[vault] dual-write aborted — superseded by newer persist/remove');
    }
    return result;
  }

  // AD-123-18 amendment A: INSERT only rows in the persisted outbox; every other row is
  // update-only. Without a session baseline every row counts as changed (writeAll).
  const scoped = hasSessionSyncScope(userId);
  const writeAll = options?.writeAll === true || !scoped;
  const outbox = outboxOf(state);
  const outboxServices = new Set(outbox.serviceIds.map((id) => id.trim()));
  const outboxProfiles = new Set(outbox.profileIds);
  const isOwnService = (serviceId: string) => outboxServices.has(serviceId.trim());
  const isOwnProfile = (profileId: string) => outboxProfiles.has(profileId);

  // Cloud membership = Digital Home selection only (not orphaned local profiles).
  const localSelectedIds = [...new Set(state.selectedIds.map((id) => id.trim()).filter(Boolean))];
  const localSelected = new Set(localSelectedIds);
  const profilesToWrite = state.accessProfiles.filter((profile) => {
    const serviceId = profile.serviceId.trim();
    if (!serviceId || !localSelected.has(serviceId)) {
      // Deselected local profile — keep IndexedDB; do not recreate user_services.
      return false;
    }
    return (
      writeAll ||
      isOwnProfile(profile.id) ||
      profileHasPendingWrite(userId, profile, state.credentials[profile.id])
    );
  });
  const createdServiceIds = localSelectedIds.filter(isOwnService);
  if (!writeAll && createdServiceIds.length === 0 && profilesToWrite.length === 0) {
    return result;
  }

  await ensureUserRow(userId);

  // D-121-51: never re-upsert a service deleted from the registry (unknown presence → unchanged).
  const presence = await fetchRegistryPresence(supabase, registryPresenceCandidates(state));
  const selectedIds = upsertableSelectedIds(localSelectedIds, state, presence);
  const needed = new Set<string>(
    writeAll
      ? selectedIds
      : [...createdServiceIds, ...profilesToWrite.map((profile) => profile.serviceId.trim())],
  );

  // One read = existence check for every membership this write depends on. A failed read
  // throws: nothing inserted, nothing reported gone (fail-closed).
  const { data: membershipRows, error: membershipError } = await supabase
    .from('user_services')
    .select('id, service_id')
    .eq('user_id', userId);
  if (membershipError) {
    throw membershipError;
  }
  const existingMembership = new Map<string, string>();
  for (const row of membershipRows ?? []) {
    const serviceId = String(row.service_id ?? '').trim();
    const usId = String(row.id ?? '').trim();
    if (serviceId && usId) existingMembership.set(serviceId, usId);
  }
  // D-109-25 spirit: an empty cloud cannot prove that local apps were deleted elsewhere.
  const canReportGone = existingMembership.size > 0;

  const userServiceIdByServiceId = new Map<string, string>();
  for (let index = 0; index < selectedIds.length; index += 1) {
    const serviceId = selectedIds[index];
    if (!serviceId || !needed.has(serviceId)) {
      continue;
    }
    if (generation !== dualWriteGeneration) {
      return result;
    }
    // Re-check Auth binding before each write (logout mid-sync).
    const stillUser = await tryGetAuthenticatedUserId();
    if (!stillUser || stillUser !== userId) {
      return result;
    }
    const existingId = existingMembership.get(serviceId);
    if (existingId) {
      if (writeAll) {
        const { error } = await supabase
          .from('user_services')
          .update({ sort_order: index })
          .eq('id', existingId);
        if (error) throw error;
      }
      if (isOwnService(serviceId)) result.confirmed.serviceIds.push(serviceId);
      userServiceIdByServiceId.set(serviceId, existingId);
    } else if (isOwnService(serviceId)) {
      const userServiceId = await upsertUserService(userId, serviceId, index);
      result.confirmed.serviceIds.push(serviceId);
      userServiceIdByServiceId.set(serviceId, userServiceId);
    } else if (canReportGone) {
      result.goneServiceIds.push(serviceId);
    }
  }

  for (const profile of profilesToWrite) {
    const serviceId = profile.serviceId.trim();
    const userServiceId = userServiceIdByServiceId.get(serviceId);
    if (!userServiceId) {
      continue;
    }
    if (generation !== dualWriteGeneration) {
      return result;
    }
    const stillUser = await tryGetAuthenticatedUserId();
    if (!stillUser || stillUser !== userId) {
      return result;
    }

    const created = isOwnProfile(profile.id);
    const credential = state.credentials[profile.id];
    let cloudProfileId: string | null;
    if (created) {
      cloudProfileId = await upsertAccessProfile(userId, userServiceId, profile);
    } else {
      cloudProfileId = await updateAccessProfileIfExists(userId, userServiceId, profile);
      if (!cloudProfileId) {
        // Deleted elsewhere — never recreate it (D-123-1).
        result.goneProfileIds.push(profile.id);
        forgetProfile(userId, profile.id);
        continue;
      }
    }

    // Anti-wipe: upsert only when values present — never delete on omission.
    if (
      credential &&
      Object.keys(credential).length > 0 &&
      (writeAll || created || credentialChangedSinceBaseline(userId, profile.id, credential))
    ) {
      await upsertEncryptedCredential(cloudProfileId, cryptoKey, credential);
    }
    markProfileSynced(userId, profile, credential);
    if (created) result.confirmed.profileIds.push(profile.id);
  }

  return result;
}

/** Best-effort cloud sync; logs in dev only — never throws to caller. */
export async function syncVaultStateToSupabaseSafe(
  cryptoKey: CryptoKey,
  state: VaultState,
  options?: CloudSyncOptions,
): Promise<{ ok: true; result: CloudSyncResult } | { ok: false; error: unknown }> {
  try {
    const result = await syncVaultStateToSupabase(cryptoKey, state, options);
    if (hasGoneRows(result)) {
      cloudGoneListener?.(result);
    }
    if (result.confirmed.serviceIds.length > 0 || result.confirmed.profileIds.length > 0) {
      cloudConfirmedListener?.(result.confirmed);
    }
    return { ok: true, result };
  } catch (error) {
    if (isDevBuild()) {
      console.warn('[vault] Supabase dual-write failed (local vault saved):', error);
    }
    return { ok: false, error };
  }
}

/**
 * AD-123-18 existence read for the focus re-hydrate: the user's cloud membership and profile
 * ids. `null` = cannot verify (no client / error) → callers change nothing.
 */
export async function fetchCloudWorkspaceIds(
  userId: string,
): Promise<{ serviceIds: Set<string>; profileIds: Set<string> } | null> {
  const supabase = getSupabaseClient();
  const trimmed = userId.trim();
  if (!supabase || !trimmed) {
    return null;
  }
  try {
    const [services, profiles] = await Promise.all([
      supabase.from('user_services').select('service_id').eq('user_id', trimmed),
      supabase.from('access_profiles').select('local_profile_id').eq('user_id', trimmed),
    ]);
    if (services.error || profiles.error) {
      return null;
    }
    return {
      serviceIds: new Set(
        (services.data ?? []).map((row) => String(row.service_id ?? '').trim()).filter(Boolean),
      ),
      profileIds: new Set(
        (profiles.data ?? [])
          .map((row) => String(row.local_profile_id ?? '').trim())
          .filter(Boolean),
      ),
    };
  } catch {
    return null;
  }
}

/**
 * AD-123-18 login (Architect early read, Known Issue 5): the cloud rows as read, so the login
 * repair writes only rows whose local value differs. A credential counts as in the cloud only
 * when its ciphertext decrypts with the cloud key to the same values; anything else (missing,
 * legacy vault-key ciphertext) stays pending and is re-uploaded under the cloud key. Decrypted
 * values are returned in memory only, for that comparison. `null` = cannot verify.
 */
export async function fetchCloudSyncBaseline(
  userId: string,
  cloudKey: CryptoKey,
): Promise<CloudSyncBaseline | null> {
  const supabase = getSupabaseClient();
  const trimmed = userId.trim();
  if (!supabase || !trimmed) {
    return null;
  }
  try {
    const [services, profiles] = await Promise.all([
      supabase.from('user_services').select('id, service_id').eq('user_id', trimmed),
      supabase
        .from('access_profiles')
        .select('id, local_profile_id, display_name, is_default, user_service_id')
        .eq('user_id', trimmed),
    ]);
    if (services.error || profiles.error) {
      return null;
    }
    const serviceIdByUserServiceId = new Map<string, string>();
    const serviceIds = new Set<string>();
    for (const row of services.data ?? []) {
      const serviceId = String(row.service_id ?? '').trim();
      const usId = String(row.id ?? '').trim();
      if (!serviceId) continue;
      serviceIds.add(serviceId);
      if (usId) serviceIdByUserServiceId.set(usId, serviceId);
    }

    const profileIds = new Set<string>();
    const profileSnapshots = new Map<string, string>();
    const localIdByCloudId = new Map<string, string>();
    for (const row of profiles.data ?? []) {
      const localId = String(row.local_profile_id ?? '').trim();
      if (!localId) continue;
      profileIds.add(localId);
      const serviceId = serviceIdByUserServiceId.get(String(row.user_service_id ?? '').trim());
      if (!serviceId) continue;
      const profile: AccessProfile = {
        schemaVersion: ACCESS_PROFILE_SCHEMA_VERSION,
        id: localId,
        serviceId,
        displayName: String(row.display_name ?? 'פרופיל'),
        createdAt: '',
        updatedAt: '',
      };
      if (row.is_default === true) profile.isDefault = true;
      profileSnapshots.set(localId, profileSnapshot(profile));
      const cloudId = String(row.id ?? '').trim();
      if (cloudId) localIdByCloudId.set(cloudId, localId);
    }

    const credentials = new Map<string, Credential>();
    if (localIdByCloudId.size > 0) {
      const { data: credRows, error: credError } = await supabase
        .from('encrypted_credentials')
        .select('access_profile_id, ciphertext, iv')
        .in('access_profile_id', [...localIdByCloudId.keys()]);
      if (credError) {
        return null;
      }
      for (const row of credRows ?? []) {
        const localId = localIdByCloudId.get(String(row.access_profile_id ?? '').trim());
        if (!localId || typeof row.ciphertext !== 'string' || typeof row.iv !== 'string') continue;
        const decrypted = await decryptCredentialSetWithKeys([cloudKey], row.ciphertext, row.iv);
        if (decrypted) credentials.set(localId, decrypted);
      }
    }
    return { serviceIds, profileIds, profileSnapshots, credentials };
  } catch {
    return null;
  }
}

/**
 * AD-123-18 (3) + amendment A — refresh on return: re-hydrate through `hydrateWorkspaceFromCloud`,
 * then keep-or-drop by the outbox (`applyOutboxAfterHydrate`). A row with an unsynced local edit
 * keeps the edit while its cloud row exists; gone from the cloud and not in the outbox → dropped.
 * Returns `null` when nothing can be verified (fail-closed: local stays unchanged).
 */
export async function refreshWorkspaceFromCloud(
  userId: string,
  cryptoKeys: CryptoKey | CryptoKey[],
  current: VaultState,
): Promise<VaultState | null> {
  if (!hasSessionSyncScope(userId)) {
    return null;
  }
  const cloud = await fetchCloudWorkspaceIds(userId);
  if (!cloud) {
    return null;
  }
  const outboxServices = new Set(outboxOf(current).serviceIds);
  const knownServices = current.selectedIds.filter((id) => !outboxServices.has(id.trim()));
  if (cloud.serviceIds.size === 0 && knownServices.length > 0) {
    // D-109-25: an empty cloud does not empty-win over a populated local Home.
    return null;
  }
  const hydrated = await hydrateWorkspaceFromCloud(userId, cryptoKeys, current);
  if (hydrated === current) {
    return null;
  }

  const kept = applyOutboxAfterHydrate(current, hydrated, cloud);
  const pending = pendingProfileIds(userId, current);
  const localById = new Map(current.accessProfiles.map((p) => [p.id, p] as const));
  const credentials: Record<string, Credential> = { ...kept.credentials };
  const profiles: AccessProfile[] = kept.accessProfiles.map((profile) => {
    const local = localById.get(profile.id);
    if (!local || !pending.has(profile.id)) return profile;
    const credential = current.credentials[profile.id];
    if (credential) credentials[profile.id] = credential;
    return local;
  });

  const refreshed: VaultState = {
    ...kept,
    accessProfiles: normalizeExactlyOneDefaultPerService(profiles),
    credentials,
  };
  rebaseSessionSyncScope(userId, refreshed, cloud.profileIds, pending);
  return refreshed;
}

/**
 * Cloud → local workspace hydrate (D-109-24 / AC-109-38 + D-109-25 / AC-109-39).
 * Loads user_services, access profiles, encrypted_credentials (client decrypt),
 * and owned private customs; merges into VaultState. Never sends plaintext to server.
 *
 * Durability:
 * - Failed / incomplete cloud read → keep local unchanged
 * - Empty cloud must not empty-win over non-empty local membership
 * - Never drop a local credential because cloud decrypt failed
 */
export async function hydrateWorkspaceFromCloud(
  userId: string,
  cryptoKeys: CryptoKey | CryptoKey[],
  local: VaultState,
): Promise<VaultState> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) {
    return local;
  }

  const keys = (Array.isArray(cryptoKeys) ? cryptoKeys : [cryptoKeys]).filter(Boolean);
  if (keys.length === 0) {
    return local;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return local;
  }

  try {
    const { data: serviceRows, error: servicesError } = await supabase
      .from('user_services')
      .select('id, service_id, sort_order')
      .eq('user_id', trimmedUserId)
      .order('sort_order', { ascending: true, nullsFirst: false });

    if (servicesError) {
      throw servicesError;
    }

    const cloudServices = serviceRows ?? [];
    const serviceIdByUserServiceId = new Map<string, string>();
    const selectedFromCloud: string[] = [];

    for (const row of cloudServices) {
      const serviceId = String(row.service_id ?? '').trim();
      const usId = String(row.id ?? '').trim();
      if (!serviceId || !usId) {
        continue;
      }
      serviceIdByUserServiceId.set(usId, serviceId);
      if (!selectedFromCloud.includes(serviceId)) {
        selectedFromCloud.push(serviceId);
      }
    }

    // D-109-25: empty cloud must not wipe a populated local Home.
    const keepLocalMembership =
      selectedFromCloud.length === 0 && local.selectedIds.length > 0;

    const { data: profileRows, error: profilesError } = await supabase
      .from('access_profiles')
      .select(
        'id, local_profile_id, display_name, is_default, schema_version, created_at, updated_at, user_service_id',
      )
      .eq('user_id', trimmedUserId);

    if (profilesError) {
      throw profilesError;
    }

    const profiles = profileRows ?? [];
    const cloudProfileIds = profiles
      .map((row) => String(row.id ?? '').trim())
      .filter(Boolean);

    const ciphertextByCloudProfileId = new Map<
      string,
      { ciphertext: string; iv: string }
    >();
    if (cloudProfileIds.length > 0) {
      const { data: credRows, error: credError } = await supabase
        .from('encrypted_credentials')
        .select('access_profile_id, ciphertext, iv')
        .in('access_profile_id', cloudProfileIds);

      if (credError) {
        throw credError;
      }

      for (const row of credRows ?? []) {
        const profileId = String(row.access_profile_id ?? '').trim();
        const ciphertext = row.ciphertext;
        const iv = row.iv;
        if (
          profileId &&
          typeof ciphertext === 'string' &&
          ciphertext.length > 0 &&
          typeof iv === 'string' &&
          iv.length > 0
        ) {
          ciphertextByCloudProfileId.set(profileId, { ciphertext, iv });
        }
      }
    }

    // Start from local credentials — never drop on decrypt failure (D-109-25).
    const credentials: Record<string, Credential> = { ...local.credentials };
    const cloudAccessProfiles: AccessProfile[] = [];

    for (const row of profiles) {
      const localProfileId = String(row.local_profile_id ?? '').trim();
      const userServiceId = String(row.user_service_id ?? '').trim();
      const cloudProfileId = String(row.id ?? '').trim();
      const serviceId = serviceIdByUserServiceId.get(userServiceId);
      if (!localProfileId || !serviceId) {
        continue;
      }

      const profile: AccessProfile = {
        schemaVersion: ACCESS_PROFILE_SCHEMA_VERSION,
        id: localProfileId,
        serviceId,
        displayName: String(row.display_name ?? 'פרופיל'),
        createdAt: String(row.created_at ?? nowIso()),
        updatedAt: String(row.updated_at ?? nowIso()),
      };
      if (row.is_default === true) {
        profile.isDefault = true;
      }
      cloudAccessProfiles.push(profile);

      const enc = ciphertextByCloudProfileId.get(cloudProfileId);
      if (enc) {
        const decrypted = await decryptCredentialSetWithKeys(
          keys,
          enc.ciphertext,
          enc.iv,
        );
        if (decrypted) {
          credentials[localProfileId] = decrypted;
        } else if (isDevBuild()) {
          console.warn(
            '[vault] hydrate: credential decrypt failed — keeping local if any',
            localProfileId,
          );
        }
      }
    }

    const { data: customRows, error: customsError } = await supabase
      .from('service_registry')
      .select(OWNED_CUSTOM_SELECT)
      .eq('owner_user_id', trimmedUserId)
      .eq('source_type', 'user');

    if (customsError) {
      throw customsError;
    }

    const customById = new Map(
      local.customServices.map((service) => [service.id, service] as const),
    );
    for (const row of (customRows ?? []) as ServiceRegistryRow[]) {
      try {
        const definition = registryRowToServiceDefinition(row);
        // D-123-8: the vault copy is the last version the owner may see — replaced only by an
        // approved row; a row with no local copy is still added.
        if (customById.has(definition.id) && !isApprovedForUsers(definition)) {
          continue;
        }
        customById.set(definition.id, definition);
      } catch {
        if (isDevBuild()) {
          console.warn('[vault] hydrate: skip invalid custom registry row', row.id);
        }
      }
    }

    // D-121-51: a service deleted from the registry is dropped locally (selection, profiles,
    // credentials) so neither this branch nor the next dual-write can resurrect it.
    const reconcileWithRegistry = async (merged: VaultState): Promise<VaultState> => {
      const presence = await fetchRegistryPresence(supabase, registryPresenceCandidates(merged));
      return presence ? dropServicesMissingFromRegistry(merged, presence).state : merged;
    };

    if (keepLocalMembership) {
      return await reconcileWithRegistry({
        selectedIds: [...local.selectedIds],
        accessProfiles: normalizeExactlyOneDefaultPerService(local.accessProfiles),
        credentials,
        customServices: [...customById.values()],
      });
    }

    // Cloud membership non-empty → authoritative for tiles (AC-109-38).
    const selectedIds =
      selectedFromCloud.length > 0 ? selectedFromCloud : [...local.selectedIds];

    // D-109-26 / AC-109-41: when cloud returned ≥1 profile for a service, cloud is the
    // authority for that service's profile set — do not resurrect local-only deleted ghosts.
    const cloudLocalProfileIds = new Set(cloudAccessProfiles.map((profile) => profile.id));
    const servicesWithCloudProfiles = new Set(
      cloudAccessProfiles.map((profile) => profile.serviceId.trim()).filter(Boolean),
    );

    const profileById = new Map<string, AccessProfile>();
    for (const profile of cloudAccessProfiles) {
      if (selectedIds.includes(profile.serviceId)) {
        profileById.set(profile.id, profile);
      }
    }
    for (const profile of local.accessProfiles) {
      const serviceId = profile.serviceId.trim();
      if (!selectedIds.includes(serviceId)) {
        continue;
      }
      if (
        servicesWithCloudProfiles.has(serviceId) &&
        !cloudLocalProfileIds.has(profile.id)
      ) {
        continue;
      }
      if (!profileById.has(profile.id)) {
        profileById.set(profile.id, profile);
      }
    }

    const mergedProfiles = [...profileById.values()];

    const healedProfiles = normalizeExactlyOneDefaultPerService(
      mergedProfiles.length > 0 ? mergedProfiles : local.accessProfiles,
    );

    const allowedProfileIds = new Set(healedProfiles.map((profile) => profile.id));
    const scopedCredentials: Record<string, Credential> = {};
    for (const [profileId, credential] of Object.entries(credentials)) {
      if (allowedProfileIds.has(profileId)) {
        scopedCredentials[profileId] = credential;
      }
    }

    return await reconcileWithRegistry({
      selectedIds,
      accessProfiles: healedProfiles,
      credentials: scopedCredentials,
      customServices: [...customById.values()],
    });
  } catch (error) {
    if (isDevBuild()) {
      console.warn('[vault] hydrateWorkspaceFromCloud failed (using local):', error);
    }
    return local;
  }
}
