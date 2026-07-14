import {
  ALLOWED_ICON_MIME_TYPES,
  MAX_ICON_UPLOAD_BYTES,
  isAllowedIconMimeType,
  type AllowedIconMimeType,
} from './types';

export interface ValidatedIconBytes {
  bytes: Uint8Array;
  mimeType: AllowedIconMimeType;
  byteSize: number;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];
const ICO_MAGIC = [0x00, 0x00, 0x01, 0x00];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) {
    return false;
  }
  return magic.every((b, i) => bytes[i] === b);
}

export function detectIconMimeFromMagic(bytes: Uint8Array): AllowedIconMimeType | null {
  if (startsWith(bytes, PNG_MAGIC)) return 'image/png';
  if (startsWith(bytes, JPEG_MAGIC)) return 'image/jpeg';
  if (
    startsWith(bytes, WEBP_RIFF) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (startsWith(bytes, ICO_MAGIC)) return 'image/x-icon';
  return null;
}

export function validateIconFile(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'לא נבחר קובץ תמונה.';
  }
  if (file.size > MAX_ICON_UPLOAD_BYTES) {
    return 'הקובץ גדול מדי (מקסימום 2MB).';
  }
  const declared = (file.type || '').toLowerCase();
  if (declared && !isAllowedIconMimeType(declared) && declared !== 'image/ico') {
    return 'סוג קובץ לא נתמך. השתמשו ב-PNG, JPEG, WebP או ICO.';
  }
  return null;
}

export async function validateIconBytes(
  bytes: Uint8Array,
  declaredMime?: string,
): Promise<ValidatedIconBytes> {
  if (bytes.byteLength <= 0) {
    throw new Error('קובץ ריק.');
  }
  if (bytes.byteLength > MAX_ICON_UPLOAD_BYTES) {
    throw new Error('הקובץ גדול מדי (מקסימום 2MB).');
  }

  const magicMime = detectIconMimeFromMagic(bytes);
  const normalizedDeclared = (declaredMime || '').toLowerCase();
  let mimeType: AllowedIconMimeType | null = magicMime;

  if (!mimeType && normalizedDeclared) {
    if (normalizedDeclared === 'image/ico') {
      mimeType = 'image/x-icon';
    } else if (isAllowedIconMimeType(normalizedDeclared)) {
      mimeType = normalizedDeclared;
    }
  }

  if (!mimeType) {
    throw new Error('לא ניתן לזהות תמונה תקינה (PNG/JPEG/WebP/ICO).');
  }

  if (
    magicMime &&
    normalizedDeclared &&
    isAllowedIconMimeType(normalizedDeclared) &&
    magicMime !== normalizedDeclared &&
    !(magicMime === 'image/x-icon' && normalizedDeclared.includes('icon'))
  ) {
    // Prefer magic; declared mismatch is OK if magic is allowed.
  }

  return {
    bytes,
    mimeType,
    byteSize: bytes.byteLength,
  };
}

export function fileAcceptAttribute(): string {
  return ALLOWED_ICON_MIME_TYPES.join(',');
}
