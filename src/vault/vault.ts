import type { Credential } from '../credentials';
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
import { getVault, putVault, VAULT_ID, type VaultRecord } from './db';

let vaultKey: CryptoKey | null = null;

export { WrongPasswordError };

export interface VaultState {
  credentials: Record<string, Credential>;
  selectedIds: string[];
  customServices: ServiceDefinition[];
}

export function isVaultUnlocked(): boolean {
  return vaultKey !== null;
}

export function lockVault(): void {
  vaultKey = null;
}

async function saveEncrypted(
  cryptoKey: CryptoKey,
  kdf: VaultRecord['kdf'],
  payload: VaultPayload,
): Promise<void> {
  const { ciphertext, iv } = await encryptPayload(cryptoKey, payload);
  await putVault({
    id: VAULT_ID,
    kdf,
    ciphertext,
    iv,
  });
}

export async function unlockVault(masterPassword: string): Promise<VaultState> {
  const existing = await getVault();

  if (!existing) {
    const salt = generateSalt();
    const kdf: VaultRecord['kdf'] = {
      salt: saltToBase64(salt),
      ...DEFAULT_KDF,
    };
    const key = await createCryptoKey(masterPassword, salt, DEFAULT_KDF);
    const payload = createEmptyPayload();
    await saveEncrypted(key, kdf, payload);
    vaultKey = key;
    return payload;
  }

  const salt = saltFromBase64(existing.kdf.salt);
  const key = await createCryptoKey(masterPassword, salt, existing.kdf);
  const raw = await decryptPayload(key, existing.ciphertext, existing.iv);
  const payload = normalizePayload(raw);
  vaultKey = key;
  return payload;
}

export async function persistVault(state: VaultState): Promise<void> {
  if (!vaultKey) {
    throw new Error('Vault is locked');
  }

  const existing = await getVault();
  if (!existing) {
    throw new Error('Vault record missing');
  }

  await saveEncrypted(vaultKey, existing.kdf, state);
}

export async function vaultExists(): Promise<boolean> {
  const record = await getVault();
  return record !== null;
}
