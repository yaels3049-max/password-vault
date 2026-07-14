import { CatalogLoadError, loadRegistryCatalog } from '../registry/registryLoader';
import { isSupabaseConfigured } from '../supabase/env';
import type { ServiceDefinition } from '../service/serviceModel';

/**
 * Load runtime built-in catalog from Supabase service_registry (AC-102-2).
 * Practice login is excluded from the user-facing catalog (AC-113-30).
 */
export async function loadBuiltinCatalogDefinitions(): Promise<ServiceDefinition[]> {
  if (!isSupabaseConfigured()) {
    throw new CatalogLoadError('Supabase is not configured — cannot load registry catalog');
  }

  return loadRegistryCatalog();
}

/**
 * @deprecated Runtime catalog must load from Supabase. Use loadBuiltinCatalogDefinitions().
 */
export function getBuiltinCatalogDefinitions(): never {
  throw new Error(
    'getBuiltinCatalogDefinitions() is removed in Phase 102. Use loadBuiltinCatalogDefinitions() instead.',
  );
}
