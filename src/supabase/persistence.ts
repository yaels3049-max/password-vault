import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile/accessProfileModel';
import { isDevBuild } from '../dev/devMode';
import { encryptCredentialSet } from '../vault/crypto';
import type { VaultState } from '../vault/vault';
import { tryGetAuthenticatedUserId } from '../auth';
import { getSupabaseClient } from './client';

export interface CloudSyncOptions {
  /** Test hook: simulate Supabase write failure without disabling local persist. */
  forceFail?: boolean;
}

const nowIso = (): string => new Date().toISOString();

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

async function deleteEncryptedCredential(cloudProfileId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from('encrypted_credentials')
    .delete()
    .eq('access_profile_id', cloudProfileId);

  if (error) {
    throw error;
  }
}

/**
 * Dual-write vault state to Supabase (ciphertext + relational metadata only).
 * IndexedDB remains authoritative for reads in Phase 101.
 *
 * ID mapping: vault `profile-*` ids are stored in `access_profiles.local_profile_id`;
 * cloud UUIDs are stable across syncs via upsert on (user_id, local_profile_id).
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
  // Skip cloud sync when there is no email-authenticated session.
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

    if (credential && Object.keys(credential).length > 0) {
      await upsertEncryptedCredential(cloudProfileId, cryptoKey, credential);
    } else {
      await deleteEncryptedCredential(cloudProfileId);
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
