import { getSupabaseClient } from '../supabase/client';
import { getSupabaseRemoteUrl } from '../supabase/env';
import { formatIconUploadError } from './formatUploadError';
import { SERVICE_ASSETS_BUCKET } from './types';

/**
 * Canonical public URL for paint (always remote project host — never localhost proxy).
 * DEV paint rewrites via `toBrowserAccessibleStorageUrl` at read time.
 */
export function getServiceAssetPublicUrl(storagePath: string): string {
  const remote = getSupabaseRemoteUrl();
  if (!remote) {
    throw new Error('חיבור Supabase לא זמין');
  }
  const path = storagePath.replace(/^\/+/, '');
  return `${remote}/storage/v1/object/public/${SERVICE_ASSETS_BUCKET}/${path}`;
}

/**
 * Upload bytes to the service-assets bucket.
 * Uses Uint8Array (raw body) — not Blob/FormData — so network filters that rewrite
 * multipart POSTs to HTML interstitial pages do not break Admin icon upload.
 */
export async function uploadServiceAssetObject(
  storagePath: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('חיבור Supabase לא זמין');
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { error } = await supabase.storage.from(SERVICE_ASSETS_BUCKET).upload(storagePath, bytes, {
    upsert: true,
    contentType,
    cacheControl: '31536000',
  });

  if (error) {
    throw new Error(formatIconUploadError(error));
  }

  return getServiceAssetPublicUrl(storagePath);
}
