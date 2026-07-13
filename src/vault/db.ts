import type { KdfParams } from './crypto';

/**
 * Phase 109 D-109-23: vault rows are namespaced by authenticated userId.
 * Legacy device-global id `main` is no longer read/written by Hub unlock paths.
 */
export type VaultRecordId = string;

export interface VaultRecord {
  id: VaultRecordId;
  kdf: KdfParams;
  ciphertext: string;
  iv: string;
}

const DB_NAME = 'israeli-vault';
const DB_VERSION = 1;
const STORE_NAME = 'vault';

/** @deprecated Phase 109 — device-global blob; do not use for new unlocks. */
export const VAULT_ID = 'main';

/** IndexedDB key for a user's local vault ciphertext (AC-109-36). */
export function vaultStorageIdForUser(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) {
    throw new Error('userId is required for vault namespace');
  }
  return `user:${trimmed}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getVault(userId: string): Promise<VaultRecord | null> {
  const id = vaultStorageIdForUser(userId);
  const db = await openDb();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve((request.result as VaultRecord | undefined) ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function putVault(record: VaultRecord): Promise<void> {
  if (!record.id || record.id === VAULT_ID) {
    throw new Error('putVault requires a user-namespaced vault id (user:<uuid>)');
  }

  const db = await openDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function hasVault(userId: string): Promise<boolean> {
  const record = await getVault(userId);
  return record !== null;
}
