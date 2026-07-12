import { isSupabaseConfigured } from '../supabase/env';
import { ensureAnonymousUserId } from '../supabase/auth';
import { getSupabaseClient } from '../supabase/client';
import { ensureUserRow } from '../supabase/persistence';
import type { ServiceDefinition } from '../service/serviceModel';
import { serviceDefinitionToRegistryInsert } from '../registry/registryMapper';
import { clearRegistryCatalogCache } from '../registry/registryLoader';
import {
  isKnownBuiltinServiceId,
  resolveKnownBuiltinByUrl,
} from '../catalog/knownServiceBootstrap';

/** Raised when a user already owns a custom service with the same normalized primary URL. */
export class DuplicateCustomServiceError extends Error {
  readonly existingServiceId: string;

  constructor(existingServiceId: string) {
    super('Custom service already exists for this user + primary URL');
    this.name = 'DuplicateCustomServiceError';
    this.existingServiceId = existingServiceId;
  }
}

export function normalizeCustomServiceUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl.trim()).href;
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Stable identity for detecting the same site across built-in vs custom entries
 * (www / trailing slash differences ignored).
 */
export function serviceUrlIdentityKey(rawUrl: string): string {
  try {
    const trimmed = rawUrl.trim();
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${host}${path}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function urlsReferToSameService(a: string, b: string): boolean {
  return serviceUrlIdentityKey(a) === serviceUrlIdentityKey(b);
}

/**
 * Upsert a canonical built_in registry row from the Hub seed (empty-DB bootstrap).
 * Does not create a user/custom row for known services.
 */
export async function ensureKnownBuiltinRegistryRow(
  definition: ServiceDefinition,
): Promise<ServiceDefinition> {
  if (!isKnownBuiltinServiceId(definition.id)) {
    throw new Error(`Not a known built-in service: ${definition.id}`);
  }

  if (!isSupabaseConfigured()) {
    return definition;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return definition;
  }

  await ensureAnonymousUserId();

  const loginUrl = definition.loginUrl?.trim() || null;
  const { error } = await supabase.rpc('ensure_known_builtin_registry_row', {
    p_id: definition.id,
    p_display_name: definition.displayName,
    p_primary_url: definition.url,
    p_login_url: loginUrl,
    p_category_id: definition.category ?? null,
    p_icon: definition.icon ?? null,
    p_adapter_id: definition.adapterId ?? null,
    p_login_fields: definition.loginFields ?? null,
    p_metadata: {
      ...(definition.metadata ?? {}),
      loginUrlDiscoveryOutcome: loginUrl ? 'succeeded' : 'never_run',
      loginUrlDiscoveryAttempted: false,
      seededFrom: 'builtinCatalog',
    },
    p_login_url_status: loginUrl ? 'valid' : 'unknown',
  });

  if (error) {
    throw error;
  }

  clearRegistryCatalogCache();
  return definition;
}

export async function upsertCustomServiceRegistryRow(
  definition: ServiceDefinition,
): Promise<ServiceDefinition> {
  if (!isSupabaseConfigured()) {
    return definition;
  }

  const known =
    (isKnownBuiltinServiceId(definition.id)
      ? definition
      : resolveKnownBuiltinByUrl(definition.url)) ?? null;

  if (known) {
    return ensureKnownBuiltinRegistryRow(known);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return definition;
  }

  const userId = await ensureAnonymousUserId();
  if (!userId) {
    throw new Error('Anonymous auth did not return a user id');
  }

  await ensureUserRow(userId);

  const normalizedUrl = normalizeCustomServiceUrl(definition.url);
  const { data: existingRows, error: lookupError } = await supabase
    .from('service_registry')
    .select('id, primary_url')
    .eq('owner_user_id', userId)
    .eq('source_type', 'user');

  if (lookupError) {
    throw lookupError;
  }

  const duplicate = (existingRows ?? []).find(
    (existing) =>
      existing.id !== definition.id &&
      urlsReferToSameService(String(existing.primary_url), normalizedUrl),
  );

  if (duplicate) {
    throw new DuplicateCustomServiceError(String(duplicate.id));
  }

  const row = serviceDefinitionToRegistryInsert(definition, userId);
  const { error } = await supabase.from('service_registry').upsert(row, { onConflict: 'id' });

  if (error) {
    throw error;
  }

  clearRegistryCatalogCache();
  return definition;
}

export async function deleteCustomServiceRegistryRow(serviceId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const userId = await ensureAnonymousUserId();
  if (!userId) {
    return;
  }

  const { error } = await supabase
    .from('service_registry')
    .delete()
    .eq('id', serviceId)
    .eq('owner_user_id', userId)
    .eq('source_type', 'user');

  if (error) {
    throw error;
  }
}
