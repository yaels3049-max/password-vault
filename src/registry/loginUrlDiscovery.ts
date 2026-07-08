import {
  DEFAULT_LOGIN_FIELDS,
  type LoginField,
  type ServiceDefinition,
} from '../service/serviceModel';
import type { DiscoveryResult } from '../discovery';
import { shouldPersistDiscoveredLoginUrl } from '../catalog/customServiceDiscovery';
import { discoverLogin } from '../discovery/execution/discoverLogin';
import { isSupabaseConfigured } from '../supabase/env';
import { getSupabaseClient } from '../supabase/client';
import { ensureAnonymousUserId } from '../supabase/auth';
import {
  fetchRegistryRowById,
  loadRegistryCatalog,
  clearRegistryCatalogCache,
} from './registryLoader';
import {
  shouldRunLoginUrlDiscovery,
  type ServiceRegistryRow,
} from './registryMapper';

export interface DiscoveryPersistResult {
  definition: ServiceDefinition;
  discovery: DiscoveryResult | null;
  persisted: boolean;
  skipped: boolean;
}

function loginFieldsToJson(loginFields?: LoginField[]): LoginField[] {
  return loginFields ?? DEFAULT_LOGIN_FIELDS;
}

/** Registry reads are best-effort — local vault add must not block on auth/proxy failures. */
async function fetchRegistryRowByIdSafe(
  serviceId: string,
): Promise<ServiceRegistryRow | null> {
  try {
    return await fetchRegistryRowById(serviceId);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[registry] Registry lookup skipped — Supabase unavailable:', error);
    }
    return null;
  }
}

async function persistUserOwnedLoginUrl(
  serviceId: string,
  loginUrl: string,
  loginFields: LoginField[] | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await supabase
    .from('service_registry')
    .update({
      login_url: loginUrl,
      login_fields: loginFields,
      login_url_status: 'valid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceId);

  if (error) {
    throw error;
  }
}

async function persistGlobalBuiltInLoginUrl(
  serviceId: string,
  loginUrl: string,
  loginFields: LoginField[] | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await supabase.rpc('persist_discovered_login_url', {
    p_service_id: serviceId,
    p_login_url: loginUrl,
    p_login_fields: loginFields,
  });

  if (error) {
    throw error;
  }
}

export async function markLoginUrlInvalid(serviceId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  await ensureAnonymousUserId();

  const row = await fetchRegistryRowById(serviceId);
  if (!row || row.owner_user_id === null) {
    return;
  }

  await supabase
    .from('service_registry')
    .update({ login_url_status: 'invalid', updated_at: new Date().toISOString() })
    .eq('id', serviceId);
}

/**
 * Gate + persist discovered login URL to registry (AC-102-4, AC-102-5, AC-102-6).
 * Global built-in rows use RPC; user-owned rows use direct UPDATE under RLS.
 */
export async function discoverAndPersistLoginUrl(
  definition: ServiceDefinition,
  options?: { primaryUrl?: string; force?: boolean },
): Promise<DiscoveryPersistResult> {
  const primaryUrl = (options?.primaryUrl ?? definition.url).trim();

  if (!options?.force && isSupabaseConfigured()) {
    const row = await fetchRegistryRowByIdSafe(definition.id);
    if (row && !shouldRunLoginUrlDiscovery(row)) {
      return {
        definition: row.login_url
          ? { ...definition, loginUrl: row.login_url, loginFields: definition.loginFields }
          : definition,
        discovery: null,
        persisted: false,
        skipped: true,
      };
    }
  } else if (!options?.force && definition.loginUrl) {
    return {
      definition,
      discovery: null,
      persisted: false,
      skipped: true,
    };
  }

  const execution = await discoverLogin(primaryUrl);
  if (execution.status === 'unavailable' || execution.status === 'error') {
    return {
      definition,
      discovery: null,
      persisted: false,
      skipped: false,
    };
  }

  const discovery = execution.result;
  if (!shouldPersistDiscoveredLoginUrl(discovery) || !discovery.loginUrl) {
    return {
      definition,
      discovery,
      persisted: false,
      skipped: false,
    };
  }

  const enriched: ServiceDefinition = {
    ...definition,
    loginUrl: discovery.loginUrl,
    loginFields: definition.loginFields ?? DEFAULT_LOGIN_FIELDS,
  };

  if (!isSupabaseConfigured()) {
    return {
      definition: enriched,
      discovery,
      persisted: false,
      skipped: false,
    };
  }

  try {
    await ensureAnonymousUserId();
    const row = await fetchRegistryRowById(definition.id);
    const loginFieldsJson = loginFieldsToJson(enriched.loginFields);

    if (row?.owner_user_id) {
      await persistUserOwnedLoginUrl(definition.id, discovery.loginUrl, loginFieldsJson);
    } else if (row && row.owner_user_id === null && row.source_type === 'built_in') {
      await persistGlobalBuiltInLoginUrl(definition.id, discovery.loginUrl, loginFieldsJson);
    }

    if (row) {
      clearRegistryCatalogCache();
      await loadRegistryCatalog();
    }

    return {
      definition: enriched,
      discovery,
      persisted: Boolean(row),
      skipped: false,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[registry] Discovery persist skipped — Supabase unavailable:', error);
    }

    return {
      definition: enriched,
      discovery,
      persisted: false,
      skipped: false,
    };
  }
}

export function registryRowNeedsDiscovery(row: ServiceRegistryRow): boolean {
  return shouldRunLoginUrlDiscovery(row);
}
