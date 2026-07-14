import { sha256Hex } from './checksum';
import { formatIconUploadError } from './formatUploadError';
import { normalizeIconToSizes } from './normalize';
import { uploadServiceAssetObject } from './storage';
import {
  type ActiveIconPointer,
  type ServiceAssetRow,
  type ServiceAssetSource,
} from './types';
import { validateIconBytes, validateIconFile } from './validate';
import { getSupabaseClient } from '../supabase/client';
import { requireAuthenticatedUserId } from '../auth';

export interface AdminIconUploadResult {
  pointer: ActiveIconPointer;
  asset: ServiceAssetRow;
  message: string;
  /** Object URL of normalized 128px icon for immediate UI preview. */
  previewObjectUrl?: string;
}

async function archiveActiveAssets(serviceId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase
    .from('service_assets')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('service_id', serviceId)
    .eq('asset_type', 'app_icon')
    .eq('status', 'active');
}

/**
 * Admin file upload → validate → normalize (contain) → Storage → active assetSource=admin.
 */
export async function uploadAdminServiceIcon(
  serviceId: string,
  file: File,
): Promise<AdminIconUploadResult> {
  try {
    await requireAuthenticatedUserId();
    const validateMsg = validateIconFile(file);
    if (validateMsg) {
      throw new Error(validateMsg);
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const validated = await validateIconBytes(buffer, file.type);
    const checksum = await sha256Hex(validated.bytes);
    const blob = new Blob([validated.bytes as BlobPart], { type: validated.mimeType });
    const variants = await normalizeIconToSizes(blob);
    const preview128 = variants.find((v) => v.size === 128) ?? variants[variants.length - 1];
    const previewObjectUrl = preview128
      ? URL.createObjectURL(preview128.blob)
      : undefined;

    const sizeUrls: ActiveIconPointer['sizes'] = {};
    let preferredUrl = '';
    for (const variant of variants) {
      const path = `global/${serviceId}/${checksum}/${variant.size}.png`;
      const url = await uploadServiceAssetObject(path, variant.blob, 'image/png');
      sizeUrls[`${variant.size}`] = url;
      if (variant.size === 128) {
        preferredUrl = url;
      }
    }
    if (!preferredUrl) {
      preferredUrl = sizeUrls['64'] || sizeUrls['32'] || '';
    }
    if (!preferredUrl) {
      throw new Error('העלאה הצליחה אך לא התקבל URL ציבורי.');
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('חיבור Supabase לא זמין');
    }

    const { data: latest } = await supabase
      .from('service_assets')
      .select('version')
      .eq('service_id', serviceId)
      .eq('asset_type', 'app_icon')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version ?? 0) + 1;

    const { data: existingSame } = await supabase
      .from('service_assets')
      .select('*')
      .eq('service_id', serviceId)
      .eq('checksum', checksum)
      .eq('asset_type', 'app_icon')
      .maybeSingle();

    await archiveActiveAssets(serviceId);

    let assetRow: ServiceAssetRow;
    if (existingSame) {
      const { data, error } = await supabase
        .from('service_assets')
        .update({
          status: 'active',
          asset_source: 'admin' satisfies ServiceAssetSource,
          public_url: preferredUrl,
          storage_path: `global/${serviceId}/${checksum}/128.png`,
          content_type: 'image/png',
          byte_size: variants.find((v) => v.size === 128)?.blob.size ?? validated.byteSize,
          width: 128,
          height: 128,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSame.id)
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message || 'עדכון נכס קיים נכשל.');
      }
      assetRow = data as ServiceAssetRow;
    } else {
      const { data, error } = await supabase
        .from('service_assets')
        .insert({
          service_id: serviceId,
          asset_type: 'app_icon',
          version: nextVersion,
          status: 'active',
          asset_source: 'admin',
          storage_path: `global/${serviceId}/${checksum}/128.png`,
          public_url: preferredUrl,
          content_type: 'image/png',
          byte_size: variants.find((v) => v.size === 128)?.blob.size ?? validated.byteSize,
          width: 128,
          height: 128,
          checksum,
          owner_user_id: null,
          is_global: true,
        })
        .select('*')
        .single();
      if (error || !data) {
        throw new Error(error?.message || 'שמירת מטא-דאטת אייקון נכשלה.');
      }
      assetRow = data as ServiceAssetRow;
    }

    const pointer: ActiveIconPointer = {
      assetId: assetRow.id,
      assetSource: 'admin',
      version: assetRow.version,
      checksum,
      publicUrl: preferredUrl,
      sizes: sizeUrls,
      status: 'active',
      contentType: 'image/png',
      updatedAt: new Date().toISOString(),
    };

    const { data: row, error: rowError } = await supabase
      .from('service_registry')
      .select('metadata, icon')
      .eq('id', serviceId)
      .is('owner_user_id', null)
      .maybeSingle();

    if (rowError) {
      throw new Error(rowError.message || 'טעינת אתר נכשלה.');
    }

    const metadata = {
      ...((row?.metadata as Record<string, unknown>) ?? {}),
      activeIcon: pointer,
      iconSource: 'admin',
    };

    const { error: updateError } = await supabase
      .from('service_registry')
      .update({
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceId)
      .is('owner_user_id', null);

    if (updateError) {
      throw new Error(updateError.message || 'עדכון מצביע אייקון באתר נכשל.');
    }

    return {
      pointer,
      asset: assetRow,
      message: 'האייקון הועלה ונשמר כנכס מנוהל פעיל.',
      previewObjectUrl,
    };
  } catch (error) {
    throw new Error(formatIconUploadError(error));
  }
}
