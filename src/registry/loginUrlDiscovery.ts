import {
  DEFAULT_LOGIN_FIELDS,
  type LoginField,
  type ServiceDefinition,
} from '../service/serviceModel';
import type { DiscoveryResult } from '../discovery';
import type { DiscoveryExecutionOutcome } from '../discovery/execution/discoveryExecution';
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
  type LoginUrlStatus,
  type ServiceRegistryRow,
} from './registryMapper';
import {
  buildDiscoveryMetadataPatch,
  type LoginUrlDiscoverySource,
} from './loginDiscoveryMetadata';

export interface DiscoveryPersistResult {
  definition: ServiceDefinition;
  discovery: DiscoveryResult | null;
  persisted: boolean;
  skipped: boolean;
}

export interface DiscoverAndPersistOptions {
  primaryUrl?: string;
  force?: boolean;
  source?: LoginUrlDiscoverySource;
}

function loginFieldsToJson(loginFields?: LoginField[]): LoginField[] {
  return loginFields ?? DEFAULT_LOGIN_FIELDS;
}

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
  metadata: Record<string, unknown>,
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
      metadata,
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

async function persistGlobalCuratedLoginUrl(
  serviceId: string,
  loginUrl: string,
  loginFields: LoginField[] | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await supabase.rpc('admin_update_login_url', {
    p_service_id: serviceId,
    p_login_url: loginUrl,
    p_login_fields: loginFields,
    p_login_url_status: 'valid',
  });

  if (error) {
    throw error;
  }
}

async function updateRegistryDiscoveryState(
  row: ServiceRegistryRow,
  input: {
    discovery: DiscoveryResult | null;
    source: LoginUrlDiscoverySource;
    success: boolean;
    errorCode?: string;
    loginUrlStatus?: LoginUrlStatus;
  },
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const metadata = buildDiscoveryMetadataPatch(row.metadata, input);

  const { error } = await supabase
    .from('service_registry')
    .update({
      metadata,
      login_url_status: input.loginUrlStatus ?? row.login_url_status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  if (error) {
    throw error;
  }
}

async function persistGlobalLoginDiscovery(
  row: ServiceRegistryRow,
  loginUrl: string,
  loginFields: LoginField[] | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (row.source_type === 'built_in') {
    try {
      await persistGlobalBuiltInLoginUrl(row.id, loginUrl, loginFields);
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase
          .from('service_registry')
          .update({ metadata, updated_at: new Date().toISOString() })
          .eq('id', row.id)
          .is('owner_user_id', null);
      }
      return;
    } catch {
      // Admin-maintained built_in rows may require elevated RPC.
    }
  }

  await persistGlobalCuratedLoginUrl(row.id, loginUrl, loginFields);

  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase
      .from('service_registry')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('owner_user_id', null);
  }
}

function executionErrorCode(outcome: DiscoveryExecutionOutcome): string {
  return outcome.status === 'unavailable' ? 'extension_unavailable' : 'execution_error';
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
 * Gate + persist discovered login URL to registry (AC-102-4, Phase 108 unified pipeline).
 * User-owned rows use direct UPDATE; global rows use built_in RPC or admin_update_login_url.
 */
export async function discoverAndPersistLoginUrl(
  definition: ServiceDefinition,
  options?: DiscoverAndPersistOptions,
): Promise<DiscoveryPersistResult> {
  const primaryUrl = (options?.primaryUrl ?? definition.url).trim();
  const source = options?.source ?? 'auto';

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
  const row = await fetchRegistryRowByIdSafe(definition.id);

  if (execution.status === 'unavailable' || execution.status === 'error') {
    if (row) {
      try {
        await ensureAnonymousUserId();
        await updateRegistryDiscoveryState(row, {
          discovery: null,
          source,
          success: false,
          errorCode: executionErrorCode(execution),
          loginUrlStatus: 'unknown',
        });
        clearRegistryCatalogCache();
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[registry] Discovery failure metadata update skipped:', error);
        }
      }
    }

    return {
      definition,
      discovery: null,
      persisted: false,
      skipped: false,
    };
  }

  const discovery = execution.result;
  if (!shouldPersistDiscoveredLoginUrl(discovery) || !discovery.loginUrl) {
    if (row) {
      try {
        await ensureAnonymousUserId();
        await updateRegistryDiscoveryState(row, {
          discovery,
          source,
          success: false,
          errorCode: discovery.reason ?? 'low_confidence',
          loginUrlStatus: 'unknown',
        });
        clearRegistryCatalogCache();
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[registry] Discovery failure metadata update skipped:', error);
        }
      }
    }

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

  if (!isSupabaseConfigured() || !row) {
    return {
      definition: enriched,
      discovery,
      persisted: false,
      skipped: false,
    };
  }

  try {
    await ensureAnonymousUserId();
    const loginFieldsJson = loginFieldsToJson(enriched.loginFields);
    const metadata = buildDiscoveryMetadataPatch(row.metadata, {
      discovery,
      source,
      success: true,
    });

    if (row.owner_user_id) {
      await persistUserOwnedLoginUrl(definition.id, discovery.loginUrl, loginFieldsJson, metadata);
    } else if (row.owner_user_id === null) {
      await persistGlobalLoginDiscovery(row, discovery.loginUrl, loginFieldsJson, metadata);
    }

    clearRegistryCatalogCache();
    await loadRegistryCatalog();

    return {
      definition: enriched,
      discovery,
      persisted: true,
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
