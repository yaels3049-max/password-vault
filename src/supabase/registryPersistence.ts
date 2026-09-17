import { requireAuthenticatedUserId, tryGetAuthenticatedUserId } from '../auth';
import { isSupabaseConfigured } from '../supabase/env';
import { getSupabaseClient } from '../supabase/client';
import { ensureUserRow } from '../supabase/persistence';
import type { ServiceDefinition } from '../service/serviceModel';
import { serviceDefinitionToRegistryInsert } from '../registry/registryMapper';
import { clearRegistryCatalogCache } from '../registry/registryLoader';
import {
  isKnownBuiltinServiceId,
} from '../catalog/knownServiceBootstrap';

/** Raised when a user already owns a custom service with the same normalized primary URL. */
export class DuplicateCustomServiceError extends Error {
  readonly existingServiceId: string;
  readonly existingDisplayName: string | null;

  constructor(existingServiceId: string, existingDisplayName?: string | null) {
    super('Custom service already exists for this user + primary URL');
    this.name = 'DuplicateCustomServiceError';
    this.existingServiceId = existingServiceId;
    this.existingDisplayName = existingDisplayName?.trim() || null;
  }
}

/** User-facing copy for custom *edit* URL conflict only — not Custom Add outcomes. */
export const CUSTOM_SERVICE_ALREADY_EXISTS_MESSAGE =
  'האתר כבר קיים ברשימת האתרים שלך.';

/** Catalog display name only — never the user-entered custom form name. */
export function catalogServiceAlreadyInHomeMessage(serviceName: string): string {
  return `${serviceName} כבר נמצא בבית הדיגיטלי שלך.`;
}

export function catalogServiceAvailableTitle(serviceName: string): string {
  return `${serviceName} כבר זמין להוספה`;
}

export const CATALOG_SERVICE_AVAILABLE_PROMPT =
  'רוצה להוסיף אותו לבית הדיגיטלי שלך?';
export const CATALOG_SERVICE_ADD_HOME_LABEL = 'הוסף לבית הדיגיטלי';
export const CATALOG_SERVICE_NOT_NOW_LABEL = 'לא עכשיו';
export const CATALOG_SERVICE_ALREADY_IN_HOME_DISMISS_LABEL = 'סגור';

/** Same product copy as already-in-home — do not mention «מותאם אישית». */
export function sameUserCustomDuplicateMessage(serviceName: string): string {
  return catalogServiceAlreadyInHomeMessage(serviceName);
}

export type AddCustomServiceResult =
  | { status: 'created' }
  | {
      status: 'catalog_service_available';
      existingServiceId: string;
      /** Authoritative catalog ServiceDefinition.displayName. */
      displayName: string;
    }
  | {
      status: 'already_in_user_home';
      existingServiceId: string;
      /** Authoritative catalog ServiceDefinition.displayName. */
      displayName: string;
    }
  | {
      status: 'same_user_custom_duplicate';
      existingServiceId: string;
      /** Authoritative existing custom ServiceDefinition.displayName. */
      displayName: string;
    };

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
 * Phase 116 AC-116-3 — Custom Add identity against the registered URL set:
 * primary_url (`url`) + login_url when present. Uses existing identity keys only
 * (no host-only / path-stripping / discovery heuristics).
 */
export function serviceMatchesRegisteredUrl(
  definition: { url: string; loginUrl?: string | null },
  enteredUrl: string,
): boolean {
  if (urlsReferToSameService(definition.url, enteredUrl)) {
    return true;
  }
  const loginUrl =
    typeof definition.loginUrl === 'string' ? definition.loginUrl.trim() : '';
  if (loginUrl && urlsReferToSameService(loginUrl, enteredUrl)) {
    return true;
  }
  return false;
}

/**
 * Same rule with explicit registered URLs (call-site convenience).
 */
export function urlsMatchRegisteredIdentitySet(
  primaryUrl: string,
  loginUrl: string | null | undefined,
  enteredUrl: string,
): boolean {
  return serviceMatchesRegisteredUrl(
    { url: primaryUrl, loginUrl: loginUrl ?? undefined },
    enteredUrl,
  );
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

  await requireAuthenticatedUserId();

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

  // Never coerce user custom-add into a global built_in row (D-107-6 / AC-107-3).
  // Known-builtin seed restore belongs on Discover «הוספה» / ensureKnownBuiltinRegistryRow.
  if (isKnownBuiltinServiceId(definition.id)) {
    return ensureKnownBuiltinRegistryRow(definition);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return definition;
  }

  const userId = await requireAuthenticatedUserId();

  await ensureUserRow(userId);

  const normalizedUrl = normalizeCustomServiceUrl(definition.url);
  const { data: existingRows, error: lookupError } = await supabase
    .from('service_registry')
    .select('id, primary_url, login_url, display_name')
    .eq('owner_user_id', userId)
    .eq('source_type', 'user');

  if (lookupError) {
    throw lookupError;
  }

  const duplicate = (existingRows ?? []).find(
    (existing) =>
      existing.id !== definition.id &&
      serviceMatchesRegisteredUrl(
        {
          url: String(existing.primary_url),
          loginUrl:
            typeof existing.login_url === 'string' && existing.login_url.trim()
              ? existing.login_url
              : undefined,
        },
        normalizedUrl,
      ),
  );

  if (duplicate) {
    throw new DuplicateCustomServiceError(
      String(duplicate.id),
      typeof duplicate.display_name === 'string' ? duplicate.display_name : null,
    );
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

  const userId = await tryGetAuthenticatedUserId();
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
