import { sha256 } from 'hash-wasm';

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}
