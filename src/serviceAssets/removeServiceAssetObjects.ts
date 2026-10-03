import { SERVICE_ASSETS_BUCKET } from './types';

interface StorageListEntry {
  name: string;
  id: string | null;
}

interface StorageBucketApi {
  list: (
    path: string,
    options?: { limit?: number },
  ) => PromiseLike<{ data: StorageListEntry[] | null; error: unknown }>;
  remove: (paths: string[]) => PromiseLike<{ data: unknown; error: unknown }>;
}

export interface StorageCapableClient {
  storage: { from: (bucket: string) => StorageBucketApi };
}

export interface ServiceAssetObjectsRemoval {
  removed: number;
  /** Null when every object was removed; otherwise a technical reason (the DB delete stands). */
  failure: string | null;
}

const LIST_LIMIT = 1000;

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * D-121-51 — best-effort removal of a deleted site's Storage objects: everything under
 * `global/<serviceId>/` (every checksum folder and size) plus the paths the DB rows pointed to.
 * Never throws; failures are reported.
 */
export async function removeServiceAssetObjects(
  client: StorageCapableClient | null,
  serviceId: string,
  knownPaths: string[],
): Promise<ServiceAssetObjectsRemoval> {
  const id = serviceId.trim();
  if (!id || id.includes('/') || id.includes('..')) {
    return { removed: 0, failure: 'מזהה אתר לא תקין לניקוי אחסון.' };
  }
  if (!client) {
    return { removed: 0, failure: 'חיבור Supabase לא זמין' };
  }

  try {
    const bucket = client.storage.from(SERVICE_ASSETS_BUCKET);
    const paths = new Set(
      knownPaths
        .map((path) => path.trim().replace(/^\/+/, ''))
        .filter((path) => path && !/^https?:/i.test(path) && !path.includes('..')),
    );

    const prefix = `global/${id}`;
    const { data: top, error: topError } = await bucket.list(prefix, { limit: LIST_LIMIT });
    if (topError) {
      return { removed: 0, failure: errorText(topError) };
    }
    for (const entry of top ?? []) {
      if (entry.id !== null) {
        paths.add(`${prefix}/${entry.name}`);
        continue;
      }
      const folder = `${prefix}/${entry.name}`;
      const { data: files, error: filesError } = await bucket.list(folder, { limit: LIST_LIMIT });
      if (filesError) {
        return { removed: 0, failure: errorText(filesError) };
      }
      for (const file of files ?? []) {
        if (file.id !== null) paths.add(`${folder}/${file.name}`);
      }
    }

    if (paths.size === 0) {
      return { removed: 0, failure: null };
    }
    const { error: removeError } = await bucket.remove([...paths]);
    if (removeError) {
      return { removed: 0, failure: errorText(removeError) };
    }
    return { removed: paths.size, failure: null };
  } catch (error) {
    return { removed: 0, failure: errorText(error) };
  }
}
