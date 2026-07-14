/** Phase 111 — managed service visual assets (icons). */

export type ServiceAssetType = 'favicon' | 'apple_touch_icon' | 'app_icon';

export type ServiceAssetStatus =
  | 'discovering'
  | 'discovered'
  | 'approved'
  | 'active'
  | 'stale'
  | 'failed'
  | 'archived';

export type ServiceAssetSource = 'admin' | 'auto' | 'discovered' | 'user';

export const SERVICE_ASSETS_BUCKET = 'service-assets';

/** Allowed upload / store MIME types (D-111-4). SVG deferred. */
export const ALLOWED_ICON_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
] as const;

export type AllowedIconMimeType = (typeof ALLOWED_ICON_MIME_TYPES)[number];

export const MAX_ICON_UPLOAD_BYTES = 2 * 1024 * 1024;
export const ICON_NORMALIZE_SIZES = [32, 64, 128] as const;
export type IconNormalizeSize = (typeof ICON_NORMALIZE_SIZES)[number];

/** Paint-time pointer stored in service_registry.metadata (reference only — not the binary). */
export interface ActiveIconPointer {
  assetId: string;
  assetSource: ServiceAssetSource;
  version: number;
  checksum: string;
  /** Preferred display URL (typically 128px). */
  publicUrl: string;
  sizes?: Partial<Record<`${IconNormalizeSize}`, string>>;
  status: 'active';
  contentType?: string;
  updatedAt: string;
}

export interface ServiceAssetRow {
  id: string;
  service_id: string;
  asset_type: ServiceAssetType;
  version: number;
  status: ServiceAssetStatus;
  asset_source: ServiceAssetSource;
  storage_path: string;
  public_url: string | null;
  content_type: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  checksum: string;
  owner_user_id: string | null;
  is_global: boolean;
  created_at?: string;
  updated_at?: string;
}

export function isAllowedIconMimeType(value: string): value is AllowedIconMimeType {
  return (ALLOWED_ICON_MIME_TYPES as readonly string[]).includes(value.toLowerCase());
}

export function readActiveIconPointer(
  metadata: Record<string, unknown> | null | undefined,
): ActiveIconPointer | null {
  const raw = metadata?.activeIcon;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const pointer = raw as Partial<ActiveIconPointer>;
  if (
    typeof pointer.publicUrl !== 'string' ||
    !pointer.publicUrl.trim() ||
    pointer.status !== 'active'
  ) {
    return null;
  }
  return {
    assetId: String(pointer.assetId ?? ''),
    assetSource: (pointer.assetSource as ServiceAssetSource) || 'auto',
    version: typeof pointer.version === 'number' ? pointer.version : 1,
    checksum: String(pointer.checksum ?? ''),
    publicUrl: pointer.publicUrl.trim(),
    sizes: pointer.sizes,
    status: 'active',
    contentType: pointer.contentType,
    updatedAt: String(pointer.updatedAt ?? ''),
  };
}

export function isAdminProtectedAsset(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const pointer = readActiveIconPointer(metadata);
  return pointer?.assetSource === 'admin';
}
