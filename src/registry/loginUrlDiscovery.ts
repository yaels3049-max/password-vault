import {
  type ServiceDefinition,
} from '../service/serviceModel';
import type { DiscoveryResult } from '../discovery';
import type { DiscoveryExecutionOutcome } from '../discovery/execution/discoveryExecution';
import {
  classifyDiscoveryReviewStatus,
  sanitizeDiscoveryResult,
  shouldPersistDiscoveredLoginUrl,
} from '../discovery/loginDiscoveryPolicy';
import { isAdminProtectedLoginUrl } from './loginUrlOverride';
import { shouldClearAutoLoginUrlOnDiscoveryReject } from './loginUrlClearPolicy';
import { discoverLogin } from '../discovery/execution/discoverLogin';
import { requireAuthenticatedUserId } from '../auth';
import { isSupabaseConfigured } from '../supabase/env';
import { getSupabaseClient } from '../supabase/client';
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
import { shouldSkipAutomatedLoginDiscovery } from './loginUrlOverride';

export interface DiscoveryPersistResult {
  definition: ServiceDefinition;
  discovery: DiscoveryResult | null;
  persisted: boolean;
  skipped: boolean;
  skipReason?: 'admin_override' | 'valid_cached' | 'definition_cached';
}

export interface DiscoverAndPersistOptions {
  primaryUrl?: string;
  force?: boolean;
  forceAdminOverwrite?: boolean;
  source?: LoginUrlDiscoverySource;
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
  metadata: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // Phase 108: discovery updates login URL + metadata only — never credential schema.
  const { error } = await supabase
    .from('service_registry')
    .update({
      login_url: loginUrl,
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
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await supabase.rpc('persist_discovered_login_url', {
    p_service_id: serviceId,
    p_login_url: loginUrl,
    p_login_fields: null,
  });

  if (error) {
    throw error;
  }
}

async function persistGlobalCuratedLoginUrl(
  serviceId: string,
  loginUrl: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await supabase.rpc('admin_update_login_url', {
    p_service_id: serviceId,
    p_login_url: loginUrl,
    p_login_fields: null,
    p_login_url_status: 'valid',
  });

  if (error) {
    throw error;
  }
}

function summarizeDiscoveryPayload(discovery: DiscoveryResult | null | undefined): Record<string, unknown> | null {
  if (!discovery) {
    return null;
  }

  return {
    success: discovery.success,
    loginUrl: discovery.loginUrl ?? null,
    method: discovery.method ?? null,
    confidence: discovery.confidence ?? null,
    reason: discovery.reason ?? null,
    loginEntryType: discovery.loginEntryType ?? null,
    usesModal: discovery.usesModal ?? null,
    rejectedLoginUrl: discovery.rejectedLoginUrl ?? null,
    candidateCount: discovery.candidates?.length ?? 0,
    topCandidates: (discovery.candidates ?? []).slice(0, 5).map((c) => ({
      url: c.url,
      method: c.method,
      score: c.score,
      confidence: c.confidence,
    })),
  };
}

async function persistLoginDiscoveryOutcome(
  row: ServiceRegistryRow,
  input: {
    discovery: DiscoveryResult | null;
    source: LoginUrlDiscoverySource;
    success: boolean;
    errorCode?: string;
    loginUrlStatus: LoginUrlStatus;
    clearLoginUrl?: boolean;
    rawExtensionDiscovery?: DiscoveryResult | null;
  },
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  await requireAuthenticatedUserId();

  const metadata = buildDiscoveryMetadataPatch(row.metadata, {
    discovery: input.discovery,
    source: input.source,
    success: input.success,
    errorCode: input.errorCode,
    loginUrlStatus: input.loginUrlStatus,
    rawExtensionDiscovery: input.rawExtensionDiscovery ?? input.discovery,
  });

  const clearLoginUrl =
    Boolean(input.clearLoginUrl) && !isAdminProtectedLoginUrl(row);

  // Global catalog rows cannot be updated via direct table UPDATE (RLS).
  // Use security-definer RPC so false-positive login_url values are actually cleared.
  if (row.owner_user_id === null) {
    const { error } = await supabase.rpc('persist_login_discovery_review', {
      p_service_id: row.id,
      p_login_url_status: input.loginUrlStatus,
      p_metadata: metadata,
      p_clear_login_url: clearLoginUrl,
    });
    if (error) {
      throw error;
    }
    return;
  }

  const payload: Record<string, unknown> = {
    metadata,
    login_url_status: input.loginUrlStatus,
    updated_at: new Date().toISOString(),
  };

  if (clearLoginUrl) {
    payload.login_url = null;
  } else if (input.clearLoginUrl && isAdminProtectedLoginUrl(row)) {
    payload.login_url_status = row.login_url_status;
  }

  const { error } = await supabase.from('service_registry').update(payload).eq('id', row.id);

  if (error) {
    throw error;
  }
}

async function resolveRegistryRowForDiscovery(
  serviceId: string,
  fallback?: ServiceRegistryRow | null,
): Promise<ServiceRegistryRow | null> {
  await requireAuthenticatedUserId();
  return (await fetchRegistryRowByIdSafe(serviceId)) ?? fallback ?? null;
}

/**
 * Record a pipeline-level discovery failure after service creation (non-blocking).
 */
export async function recordLoginDiscoveryPipelineFailure(
  serviceId: string,
  source: LoginUrlDiscoverySource = 'user',
): Promise<void> {
  const row = await resolveRegistryRowForDiscovery(serviceId);
  if (!row) {
    return;
  }

  try {
    await persistLoginDiscoveryOutcome(row, {
      discovery: null,
      source,
      success: false,
      errorCode: 'discovery_pipeline_error',
      loginUrlStatus: 'failed',
      clearLoginUrl: false,
    });
    clearRegistryCatalogCache();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[registry] Discovery pipeline failure metadata update skipped:', error);
    }
  }
}

async function persistGlobalLoginDiscovery(
  row: ServiceRegistryRow,
  loginUrl: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (row.source_type === 'built_in') {
    try {
      await persistGlobalBuiltInLoginUrl(row.id, loginUrl);
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

  await persistGlobalCuratedLoginUrl(row.id, loginUrl);

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

  await requireAuthenticatedUserId();

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

  const existingRow = await fetchRegistryRowByIdSafe(definition.id);

  const adminSkip = existingRow
    ? shouldSkipAutomatedLoginDiscovery(existingRow, {
        force: options?.force,
        forceAdminOverwrite: options?.forceAdminOverwrite,
      })
    : { skip: false };

  if (adminSkip.skip) {
    return {
      definition: existingRow?.login_url
        ? { ...definition, loginUrl: existingRow.login_url, loginFields: definition.loginFields }
        : definition,
      discovery: null,
      persisted: false,
      skipped: true,
      skipReason: 'admin_override',
    };
  }

  if (!options?.force && isSupabaseConfigured()) {
    const row = existingRow;
    if (row && !shouldRunLoginUrlDiscovery(row)) {
      return {
        definition: row.login_url
          ? { ...definition, loginUrl: row.login_url, loginFields: definition.loginFields }
          : definition,
        discovery: null,
        persisted: false,
        skipped: true,
        skipReason: 'valid_cached',
      };
    }
  } else if (!options?.force && definition.loginUrl) {
    return {
      definition,
      discovery: null,
      persisted: false,
      skipped: true,
      skipReason: 'definition_cached',
    };
  }

  const execution = await discoverLogin(primaryUrl);
  const row = await resolveRegistryRowForDiscovery(definition.id, existingRow);

  if (execution.status === 'unavailable' || execution.status === 'error') {
    if (row) {
      try {
        await persistLoginDiscoveryOutcome(row, {
          discovery: null,
          source,
          success: false,
          errorCode: executionErrorCode(execution),
          loginUrlStatus: execution.status === 'unavailable' ? 'missing' : 'failed',
          // Infra failure must never wipe a previously good consumer login_url (M11).
          clearLoginUrl: false,
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

  const rawExtensionDiscovery = execution.result;
  const discovery = sanitizeDiscoveryResult(rawExtensionDiscovery);

  if (import.meta.env.DEV) {
    console.info('[registry] HUB_LOGIN_ENTRY_DISCOVERY raw payload', {
      serviceId: definition.id,
      primaryUrl,
      raw: summarizeDiscoveryPayload(rawExtensionDiscovery),
      sanitized: summarizeDiscoveryPayload(discovery),
      persist: shouldPersistDiscoveredLoginUrl(discovery),
    });
  }

  if (!shouldPersistDiscoveredLoginUrl(discovery) || !discovery.loginUrl) {
    if (row) {
      try {
        const review = classifyDiscoveryReviewStatus(discovery);
        const clearLoginUrl = shouldClearAutoLoginUrlOnDiscoveryReject(row, discovery);
        await persistLoginDiscoveryOutcome(row, {
          discovery,
          source,
          success: false,
          errorCode: discovery.reason ?? review.errorCode,
          loginUrlStatus: review.loginUrlStatus,
          clearLoginUrl,
          rawExtensionDiscovery,
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
    // Keep approved credential schema; never invent DEFAULT_LOGIN_FIELDS on discovery.
    loginFields: definition.loginFields,
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
    await requireAuthenticatedUserId();
    const metadata = buildDiscoveryMetadataPatch(row.metadata, {
      discovery,
      source,
      success: true,
      rawExtensionDiscovery,
    });

    if (row.owner_user_id) {
      await persistUserOwnedLoginUrl(definition.id, discovery.loginUrl, metadata);
    } else if (row.owner_user_id === null) {
      await persistGlobalLoginDiscovery(row, discovery.loginUrl, metadata);
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

    // Still return enriched definition so the vault tile keeps loginUrl even if
    // the registry write failed (merge must not drop it either).
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
