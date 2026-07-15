import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile/accessProfileModel';
import type { ServiceDefinition } from '../service/serviceModel';
import {
  createCryptoKey,
  createEmptyPayload,
  decryptPayload,
  DEFAULT_KDF,
  deriveCloudCredentialKey,
  encryptPayload,
  generateSalt,
  normalizePayload,
  saltFromBase64,
  saltToBase64,
  WrongPasswordError,
  type KdfParams,
  type VaultPayload,
} from './crypto';
import { getVault, putVault, vaultStorageIdForUser, type VaultRecord } from './db';
import { migrateVaultPayload } from './vaultMigration';
import {
  ensureVaultKdfSeeded,
  fetchVaultKdf,
  syncVaultStateToSupabaseSafe,
  bumpDualWriteGeneration,
} from '../supabase/persistence';

let vaultKey: CryptoKey | null = null;
/** Deterministic cloud dual-write / hydrate key (password + userId). */
let cloudCredentialKey: CryptoKey | null = null;
/** Kept with vaultKey so persist can recreate an IndexedDB row if storage was evicted. */
let vaultKdf: VaultRecord['kdf'] | null = null;
/** Active vault namespace — must match authenticated userId (D-109-23). */
let activeVaultUserId: string | null = null;

export { WrongPasswordError, vaultStorageIdForUser };

export interface VaultState {
  credentials: Record<string, Credential>;
  accessProfiles: AccessProfile[];
  selectedIds: string[];
  customServices: ServiceDefinition[];
}

export function emptyVaultState(): VaultState {
  return {
    credentials: {},
    accessProfiles: [],
    selectedIds: [],
    customServices: [],
  };
}

export function isVaultUnlocked(): boolean {
  return vaultKey !== null && vaultKdf !== null && activeVaultUserId !== null;
}

export function getActiveVaultUserId(): string | null {
  return activeVaultUserId;
}

/** Session vault AES key for local IndexedDB blob (null when locked). */
export function getActiveVaultCryptoKey(): CryptoKey | null {
  return vaultKey;
}

/** Cross-browser cloud credential key (null when locked). */
export function getCloudCredentialCryptoKey(): CryptoKey | null {
  return cloudCredentialKey;
}

/** Clear in-memory vault key/session (does not delete IndexedDB ciphertext). */
export function lockVault(): void {
  vaultKey = null;
  cloudCredentialKey = null;
  vaultKdf = null;
  activeVaultUserId = null;
}

async function saveEncrypted(
  userId: string,
  cryptoKey: CryptoKey,
  kdf: VaultRecord['kdf'],
  payload: VaultPayload,
): Promise<void> {
  const { ciphertext, iv } = await encryptPayload(cryptoKey, payload);
  await putVault({
    id: vaultStorageIdForUser(userId),
    kdf,
    ciphertext,
    iv,
  });
}

function payloadFromVaultState(state: VaultState): VaultPayload {
  return {
    credentials: state.credentials,
    accessProfiles: state.accessProfiles,
    selectedIds: state.selectedIds,
    customServices: state.customServices,
  };
}

async function resolveKdfForNewVault(userId: string): Promise<KdfParams> {
  const cloudKdf = await fetchVaultKdf(userId);
  if (cloudKdf) {
    return cloudKdf;
  }
  const salt = generateSalt();
  return {
    salt: saltToBase64(salt),
    ...DEFAULT_KDF,
  };
}

/**
 * Unlock or create the local vault blob for THIS userId only (AC-109-36).
 * Also derives the deterministic cloud credential key for hydrate / dual-write.
 */
export async function unlockVault(
  masterPassword: string,
  userId: string,
): Promise<VaultState> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) {
    throw new Error('userId is required to unlock vault');
  }

  // Never keep another user's key in memory across switches.
  lockVault();

  const existing = await getVault(trimmedUserId);
  const cloudKey = await deriveCloudCredentialKey(masterPassword, trimmedUserId);

  if (!existing) {
    const kdf = await resolveKdfForNewVault(trimmedUserId);
    const salt = saltFromBase64(kdf.salt);
    const key = await createCryptoKey(masterPassword, salt, kdf);
    const payload = createEmptyPayload();
    await saveEncrypted(trimmedUserId, key, kdf, payload);
    vaultKey = key;
    cloudCredentialKey = cloudKey;
    vaultKdf = kdf;
    activeVaultUserId = trimmedUserId;
    void ensureVaultKdfSeeded(trimmedUserId, kdf);
    return payload;
  }

  const salt = saltFromBase64(existing.kdf.salt);
  const key = await createCryptoKey(masterPassword, salt, existing.kdf);
  const raw = await decryptPayload(key, existing.ciphertext, existing.iv);
  const normalized = normalizePayload(raw);
  const { payload, migrated } = migrateVaultPayload(normalized);

  if (migrated) {
    await saveEncrypted(trimmedUserId, key, existing.kdf, payload);
  }

  vaultKey = key;
  cloudCredentialKey = cloudKey;
  vaultKdf = existing.kdf;
  activeVaultUserId = trimmedUserId;
  void ensureVaultKdfSeeded(trimmedUserId, existing.kdf);
  return payload;
}

export async function persistVault(
  state: VaultState,
  options?: { skipCloudSync?: boolean; awaitCloudSync?: boolean },
): Promise<void> {
  if (!vaultKey || !vaultKdf || !activeVaultUserId) {
    throw new Error('Vault is locked');
  }

  const userId = activeVaultUserId;
  const existing = await getVault(userId);
  const kdf = existing?.kdf ?? vaultKdf;
  vaultKdf = kdf;

  await saveEncrypted(userId, vaultKey, kdf, payloadFromVaultState(state));
  void ensureVaultKdfSeeded(userId, kdf);
  if (!options?.skipCloudSync) {
    // Dual-write credentials with cross-browser cloud key when available.
    // Bind expectedUserId + generation so logout / newer remove aborts this write.
    const syncKey = cloudCredentialKey ?? vaultKey;
    const generation = bumpDualWriteGeneration();
    const syncPromise = syncVaultStateToSupabaseSafe(syncKey, state, {
      expectedUserId: userId,
      generation,
    });
    if (options?.awaitCloudSync) {
      await syncPromise;
    } else {
      void syncPromise;
    }
  }
}

export async function vaultExists(userId: string): Promise<boolean> {
  const record = await getVault(userId);
  return record !== null;
}
