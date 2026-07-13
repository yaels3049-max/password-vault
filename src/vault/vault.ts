import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile/accessProfileModel';
import type { ServiceDefinition } from '../service/serviceModel';
import {
  createCryptoKey,
  createEmptyPayload,
  decryptPayload,
  DEFAULT_KDF,
  encryptPayload,
  generateSalt,
  normalizePayload,
  saltFromBase64,
  saltToBase64,
  WrongPasswordError,
  type VaultPayload,
} from './crypto';
import { getVault, putVault, vaultStorageIdForUser, type VaultRecord } from './db';
import { migrateVaultPayload } from './vaultMigration';
import { syncVaultStateToSupabaseSafe } from '../supabase/persistence';

let vaultKey: CryptoKey | null = null;
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

/** Clear in-memory vault key/session (does not delete IndexedDB ciphertext). */
export function lockVault(): void {
  vaultKey = null;
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

/**
 * Unlock or create the local vault blob for THIS userId only (AC-109-36).
 * Same password string on two accounts opens different namespaces.
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

  if (!existing) {
    const salt = generateSalt();
    const kdf: VaultRecord['kdf'] = {
      salt: saltToBase64(salt),
      ...DEFAULT_KDF,
    };
    const key = await createCryptoKey(masterPassword, salt, DEFAULT_KDF);
    const payload = createEmptyPayload();
    await saveEncrypted(trimmedUserId, key, kdf, payload);
    vaultKey = key;
    vaultKdf = kdf;
    activeVaultUserId = trimmedUserId;
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
  vaultKdf = existing.kdf;
  activeVaultUserId = trimmedUserId;
  return payload;
}

export async function persistVault(state: VaultState): Promise<void> {
  if (!vaultKey || !vaultKdf || !activeVaultUserId) {
    throw new Error('Vault is locked');
  }

  const userId = activeVaultUserId;
  const existing = await getVault(userId);
  const kdf = existing?.kdf ?? vaultKdf;
  vaultKdf = kdf;

  await saveEncrypted(userId, vaultKey, kdf, payloadFromVaultState(state));

  void syncVaultStateToSupabaseSafe(vaultKey, state);
}

export async function vaultExists(userId: string): Promise<boolean> {
  const record = await getVault(userId);
  return record !== null;
}
