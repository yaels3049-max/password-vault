import { requireAuthenticatedUserId, tryGetAuthenticatedUserId } from '../auth';
import { isDevBuild } from '../dev/devMode';
import { BUILTIN_CATALOG_DEFINITIONS, HUB_PRACTICE_LOGIN_ID } from '../catalog/builtinCatalog';
import { applyBuiltinCatalogOverlayAll } from '../catalog/builtinCatalogOverlay';
import { isSupabaseConfigured } from '../supabase/env';
import { getSupabaseClient } from '../supabase/client';
import {
  registryRowToServiceDefinition,
  type ServiceRegistryRow,
} from './registryMapper';
import type { ServiceDefinition } from '../service/serviceModel';
import { formatUnknownError } from '../formatErrorChain';
import { clearRegistryCategoryCache } from './categoryCatalog';

export class CatalogLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'CatalogLoadError';
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

let sessionCache: ServiceDefinition[] | null = null;

const REGISTRY_SELECT =
  'id, display_name, primary_url, login_url, login_url_status, category_id, icon, adapter_id, login_fields, source_type, service_status, metadata, owner_user_id';

/** Global rows eligible for end-user catalog discovery (Hub). */
const GLOBAL_CATALOG_SOURCE_TYPES = new Set(['built_in', 'approved_global', 'admin']);

/**
 * End-user catalog visibility (AC-109-37 / D-109-23):
 * - Global rows (owner null): built_in | admin | approved_global
 * - Private customs: owner_user_id = current user AND source_type = user only
 * Never list another user's private services.
 */
export function isCatalogVisibleRegistryRow(
  row: ServiceRegistryRow,
  currentUserId: string | null,
): boolean {
  if (row.service_status !== 'active') {
    return false;
  }

  if (row.owner_user_id === null) {
    return GLOBAL_CATALOG_SOURCE_TYPES.has(row.source_type);
  }

  return (
    currentUserId !== null &&
    row.owner_user_id === currentUserId &&
    row.source_type === 'user'
  );
}

/** Exported for verify / docs — global Discover source types. */
export const DISCOVER_GLOBAL_SOURCE_TYPES = GLOBAL_CATALOG_SOURCE_TYPES;

function getDevPracticeDefinition(): ServiceDefinition {
  const practice = BUILTIN_CATALOG_DEFINITIONS.find(
    (definition) => definition.id === HUB_PRACTICE_LOGIN_ID,
  );

  if (!practice) {
    throw new CatalogLoadError('Dev practice service definition is missing');
  }

  return practice;
}

function injectDevPractice(definitions: ServiceDefinition[]): ServiceDefinition[] {
  if (!isDevBuild()) {
    return definitions;
  }

  if (definitions.some((definition) => definition.id === HUB_PRACTICE_LOGIN_ID)) {
    return definitions;
  }

  return [getDevPracticeDefinition(), ...definitions];
}

async function ensureRegistryAuth(): Promise<string> {
  try {
    return await requireAuthenticatedUserId();
  } catch (error) {
    const detail = formatUnknownError(error);
    throw new CatalogLoadError(`נדרשת התחברות לחשבון: ${detail}`, { cause: error });
  }
}

async function fetchRegistryRows(): Promise<ServiceRegistryRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new CatalogLoadError('Supabase is not configured');
  }

  await ensureRegistryAuth();

  const { data, error } = await supabase
    .from('service_registry')
    .select(REGISTRY_SELECT)
    .eq('service_status', 'active');

  if (error) {
    throw new CatalogLoadError(`Registry fetch failed: ${error.message}`, { cause: error });
  }

  return (data ?? []) as ServiceRegistryRow[];
}

export function getCachedRegistryCatalog(): ServiceDefinition[] | null {
  return sessionCache;
}

export function clearRegistryCatalogCache(): void {
  sessionCache = null;
  clearRegistryCategoryCache();
}

/**
 * Load built-in + user registry catalog from Supabase (AC-102-2).
 * Production never reads BUILTIN_CATALOG_DEFINITIONS for runtime catalog.
 */
export async function loadRegistryCatalog(): Promise<ServiceDefinition[]> {
  if (!isSupabaseConfigured()) {
    throw new CatalogLoadError('Supabase is not configured');
  }

  if (sessionCache) {
    return sessionCache;
  }

  try {
    const rows = await fetchRegistryRows();
    const currentUserId = await tryGetAuthenticatedUserId();
    const catalogRows = rows.filter((row) =>
      isCatalogVisibleRegistryRow(row, currentUserId),
    );
    const globalBuiltIns = catalogRows.filter(
      (row) => row.owner_user_id === null && row.source_type === 'built_in',
    );

    const definitions = applyBuiltinCatalogOverlayAll(
      catalogRows.map(registryRowToServiceDefinition),
    );

    // Catalog UI shows only what is in service_registry (+ dev practice inject).
    // Known-service seed restore happens on add/select via ensureKnownBuiltinRegistryRow
    // — do not inject missing builtins here (avoids ghost tiles after DB wipe).
    if (globalBuiltIns.length === 0 && !isDevBuild() && definitions.length === 0) {
      throw new CatalogLoadError(
        'Registry has no built-in services. Apply Phase 102 seed migration (20260703120100_phase102_seed_builtin.sql).',
      );
    }

    sessionCache = injectDevPractice(definitions);
    return sessionCache;
  } catch (error) {
    if (sessionCache) {
      return sessionCache;
    }

    if (error instanceof CatalogLoadError) {
      throw error;
    }

    const detail = error instanceof Error ? error.message : String(error);
    throw new CatalogLoadError(`Failed to load service registry: ${detail}`, { cause: error });
  }
}

export async function fetchRegistryRowById(serviceId: string): Promise<ServiceRegistryRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  await ensureRegistryAuth();

  const { data, error } = await supabase
    .from('service_registry')
    .select(REGISTRY_SELECT)
    .eq('id', serviceId)
    .maybeSingle();

  if (error) {
    throw new CatalogLoadError(`Registry row fetch failed: ${error.message}`, { cause: error });
  }

  return (data as ServiceRegistryRow | null) ?? null;
}
