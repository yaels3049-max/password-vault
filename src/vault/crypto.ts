import { argon2id } from 'hash-wasm';
import type { Credential } from '../credentials';
import type { AccessProfile } from '../profile/accessProfileModel';
import type { ServiceDefinition } from '../service/serviceModel';
import { normalizeStoredCustomServices } from '../catalog/customServiceStorage';

export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong password');
    this.name = 'WrongPasswordError';
  }
}

export interface VaultPayload {
  credentials: Record<string, Credential>;
  accessProfiles: AccessProfile[];
  selectedIds: string[];
  customServices: ServiceDefinition[];
}

export interface KdfParams {
  algorithm: 'argon2id';
  salt: string;
  iterations: number;
  memorySize: number;
  parallelism: number;
}

export const DEFAULT_KDF: Omit<KdfParams, 'salt'> = {
  algorithm: 'argon2id',
  iterations: 3,
  memorySize: 32768,
  parallelism: 1,
};

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveRawKey(
  password: string,
  salt: Uint8Array,
  kdf: Omit<KdfParams, 'salt' | 'algorithm'>,
): Promise<Uint8Array> {
  const hash = await argon2id({
    password,
    salt,
    parallelism: kdf.parallelism,
    iterations: kdf.iterations,
    memorySize: kdf.memorySize,
    hashLength: 32,
    outputType: 'binary',
  });
  return new Uint8Array(hash);
}

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey.buffer.slice(
      rawKey.byteOffset,
      rawKey.byteOffset + rawKey.byteLength,
    ) as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createCryptoKey(
  password: string,
  salt: Uint8Array,
  kdf: Omit<KdfParams, 'salt' | 'algorithm'>,
): Promise<CryptoKey> {
  const rawKey = await deriveRawKey(password, salt, kdf);
  return importAesKey(rawKey);
}

export async function encryptPayload(
  cryptoKey: CryptoKey,
  payload: VaultPayload,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded,
  );

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
}

export async function decryptPayload(
  cryptoKey: CryptoKey,
  ciphertext: string,
  iv: string,
): Promise<VaultPayload> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      cryptoKey,
      fromBase64(ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as VaultPayload;
  } catch {
    throw new WrongPasswordError();
  }
}

export function createEmptyPayload(): VaultPayload {
  return { credentials: {}, accessProfiles: [], selectedIds: [], customServices: [] };
}

function normalizeAccessProfiles(raw: unknown): AccessProfile[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(
    (entry): entry is AccessProfile =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as AccessProfile).id === 'string' &&
      typeof (entry as AccessProfile).serviceId === 'string',
  );
}

export function normalizePayload(
  raw: Partial<VaultPayload> & { customServices?: unknown[]; accessProfiles?: unknown },
): VaultPayload {
  const rawCustomServices = Array.isArray(raw.customServices) ? raw.customServices : [];

  return {
    credentials: raw.credentials ?? {},
    accessProfiles: normalizeAccessProfiles(raw.accessProfiles),
    selectedIds: raw.selectedIds ?? [],
    customServices: normalizeStoredCustomServices(rawCustomServices),
  };
}

export function saltToBase64(salt: Uint8Array): string {
  return toBase64(salt);
}

export function saltFromBase64(salt: string): Uint8Array {
  return fromBase64(salt);
}

/**
 * Deterministic AES key for cloud `encrypted_credentials` (D-109-24).
 * Same password + userId ⇒ same key on every browser. Salt is derived from userId
 * (not secret). Local IndexedDB vault blobs keep their own random salt.
 */
export async function deriveCloudCredentialKey(
  password: string,
  userId: string,
): Promise<CryptoKey> {
  const trimmed = userId.trim();
  if (!trimmed) {
    throw new Error('userId is required for cloud credential key');
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`digital-home-cloud-cred-v1:${trimmed}`),
  );
  const salt = new Uint8Array(digest).slice(0, 16);
  return createCryptoKey(password, salt, DEFAULT_KDF);
}

/** Encrypt a single profile credential object for Supabase dual-write (AES-256-GCM). */
export async function encryptCredentialSet(
  cryptoKey: CryptoKey,
  credential: Credential,
): Promise<{ ciphertext: string; iv: string; fieldIdsPresent: string[] }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(credential));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded,
  );

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
    fieldIdsPresent: Object.keys(credential),
  };
}

/** Decrypt a single profile credential blob from Supabase (client-side only — ZK). */
export async function decryptCredentialSet(
  cryptoKey: CryptoKey,
  ciphertext: string,
  iv: string,
): Promise<Credential> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) },
      cryptoKey,
      fromBase64(ciphertext),
    );
    const parsed: unknown = JSON.parse(new TextDecoder().decode(decrypted));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid credential payload');
    }
    return parsed as Credential;
  } catch {
    throw new Error('Credential decrypt failed');
  }
}

/** Try each key until one decrypts (cloud-cred key first, then legacy vault key). */
export async function decryptCredentialSetWithKeys(
  cryptoKeys: CryptoKey[],
  ciphertext: string,
  iv: string,
): Promise<Credential | null> {
  for (const key of cryptoKeys) {
    try {
      return await decryptCredentialSet(key, ciphertext, iv);
    } catch {
      // try next key
    }
  }
  return null;
}
