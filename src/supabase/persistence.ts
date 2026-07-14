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

export interface CloudSyncOptions {
  /** Test hook: simulate Supabase write failure without disabling local persist. */
  forceFail?: boolean;
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

function collectServiceIds(state: VaultState): string[] {
  const ids = new Set<string>(state.selectedIds);
  for (const profile of state.accessProfiles) {
    ids.add(profile.serviceId.trim());
  }
  return [...ids];
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
 * Explicit user remove-service only (D-109-25). Cascades profiles + ciphertext via FK.
 * Dual-write must NOT delete user_services absent from a partial local snapshot.
 */
export async function removeUserServiceFromCloud(serviceId: string): Promise<void> {
  const trimmed = serviceId.trim();
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

  const { error } = await supabase
    .from('user_services')
    .delete()
    .eq('user_id', userId)
    .eq('service_id', trimmed);

  if (error) {
    throw error;
  }
}

/**
 * Dual-write vault state to Supabase — **upsert only** (D-109-25 / AC-109-39).
 * Never deletes cloud `encrypted_credentials` or `user_services` because they are
 * missing from this payload. Explicit removes use dedicated APIs.
 *
 * ID mapping: vault `profile-*` ids → `access_profiles.local_profile_id`.
 */
export async function syncVaultStateToSupabase(
  cryptoKey: CryptoKey,
  state: VaultState,
  options?: CloudSyncOptions,
): Promise<void> {
  if (options?.forceFail || import.meta.env.VITE_PHASE101_FORCE_CLOUD_FAIL === 'true') {
    throw new Error('Phase 101 forced cloud write failure (test hook)');
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  // Phase 109: never create anonymous users for dual-write.
  const userId = await tryGetAuthenticatedUserId();
  if (!userId) {
    return;
  }

  await ensureUserRow(userId);

  const serviceIds = collectServiceIds(state);
  const userServiceIdByServiceId = new Map<string, string>();

  for (let index = 0; index < serviceIds.length; index += 1) {
    const serviceId = serviceIds[index];
    if (!serviceId) {
      continue;
    }
    const sortOrder = state.selectedIds.indexOf(serviceId);
    const userServiceId = await upsertUserService(
      userId,
      serviceId,
      sortOrder >= 0 ? sortOrder : null,
    );
    userServiceIdByServiceId.set(serviceId, userServiceId);
  }

  for (const profile of state.accessProfiles) {
    const serviceId = profile.serviceId.trim();
    let userServiceId = userServiceIdByServiceId.get(serviceId);
    if (!userServiceId) {
      userServiceId = await upsertUserService(userId, serviceId, null);
      userServiceIdByServiceId.set(serviceId, userServiceId);
    }

    const cloudProfileId = await upsertAccessProfile(userId, userServiceId, profile);
    const credential = state.credentials[profile.id];

    // Anti-wipe: upsert only when values present — never delete on omission.
    if (credential && Object.keys(credential).length > 0) {
      await upsertEncryptedCredential(cloudProfileId, cryptoKey, credential);
    }
  }
}

/** Best-effort cloud sync; logs in dev only — never throws to caller. */
export async function syncVaultStateToSupabaseSafe(
  cryptoKey: CryptoKey,
  state: VaultState,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await syncVaultStateToSupabase(cryptoKey, state);
    return { ok: true };
  } catch (error) {
    if (isDevBuild()) {
      console.warn('[vault] Supabase dual-write failed (local vault saved):', error);
    }
    return { ok: false, error };
  }
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
        customById.set(definition.id, definition);
      } catch {
        if (isDevBuild()) {
          console.warn('[vault] hydrate: skip invalid custom registry row', row.id);
        }
      }
    }

    if (keepLocalMembership) {
      return {
        selectedIds: [...local.selectedIds],
        accessProfiles: normalizeExactlyOneDefaultPerService(local.accessProfiles),
        credentials,
        customServices: [...customById.values()],
      };
    }

    // Cloud membership non-empty → authoritative for tiles (AC-109-38).
    const selectedIds =
      selectedFromCloud.length > 0 ? selectedFromCloud : [...local.selectedIds];

    // Union profiles by id; cloud metadata wins on conflict.
    const profileById = new Map(
      local.accessProfiles.map((profile) => [profile.id, profile] as const),
    );
    for (const profile of cloudAccessProfiles) {
      profileById.set(profile.id, profile);
    }
    const mergedProfiles = [...profileById.values()].filter((profile) =>
      selectedIds.includes(profile.serviceId),
    );

    const healedProfiles = normalizeExactlyOneDefaultPerService(
      mergedProfiles.length > 0 ? mergedProfiles : local.accessProfiles,
    );

    return {
      selectedIds,
      accessProfiles: healedProfiles,
      credentials,
      customServices: [...customById.values()],
    };
  } catch (error) {
    if (isDevBuild()) {
      console.warn('[vault] hydrateWorkspaceFromCloud failed (using local):', error);
    }
    return local;
  }
}
