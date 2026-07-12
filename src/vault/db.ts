import type { KdfParams } from './crypto';

export interface VaultRecord {
  id: 'main';
  kdf: KdfParams;
  ciphertext: string;
  iv: string;
}

const DB_NAME = 'israeli-vault';
const DB_VERSION = 1;
const STORE_NAME = 'vault';
export const VAULT_ID = 'main';

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

export async function getVault(): Promise<VaultRecord | null> {
  const db = await openDb();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(VAULT_ID);

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

export async function hasVault(): Promise<boolean> {
  const record = await getVault();
  return record !== null;
}
