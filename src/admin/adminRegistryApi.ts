import {
  planCredentialConfigurationWrite,
  readStoredCredentialMode,
  type CredentialMode,
} from '../service/credentialSchema';
import { type LoginField } from '../service/serviceModel';
import { discoverLoginForRegistryService } from '../catalog/customServiceDiscovery';
import {
  stampExplicitLoginMetadata,
  type ExplicitLoginEntryType,
} from '../catalog/explicitLoginEntry';
import {
  bulkRefreshLoginUrls,
  BULK_REFRESH_CONCURRENCY,
  BULK_REFRESH_INTER_BATCH_DELAY_MS,
  type BulkLoginUrlRefreshReport,
} from '../registry/bulkLoginUrlRefresh';
import { clearRegistryCatalogCache } from '../registry/registryLoader';
import {
  allocateUniqueRegistryServiceId,
} from '../registry/serviceIdFromUrl';
import { registryRowToServiceDefinition } from '../registry/registryMapper';
import type { LoginUrlStatus, ServiceRegistryRow } from '../registry/registryMapper';
import { requireAuthenticatedUserId } from '../auth';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/env';
import { formatUnknownError } from '../formatErrorChain';
import { mergeAutofillProfileMetadata, stripAutofillControlKeys } from '../autofill/validatedProfile';
import {
  LOGIN_CONTRACT_ACTIVATE_INTENT_KEY,
  LOGIN_CONTRACT_ACTIVATION_META_KEY,
  LOGIN_FLOW_PLAN_META_KEY,
  mergeLoginContractMetadata,
  resolveActiveLoginContract,
  stripLoginContractControlKeys,
} from '../loginContract';
import { withoutLoginContractKeys } from './contractSafeMetadata';

export interface AdminCategory {
  id: string;
  display_name: string;
  sort_order: number;
}

export interface AdminRegistryRow extends ServiceRegistryRow {
  created_at?: string;
  updated_at?: string;
  metadata_version?: number;
}

export interface GlobalRegistryInput {
  id?: string;
  display_name: string;
  primary_url: string;
  login_url?: string | null;
  category_id?: string | null;
  icon?: string | null;
  adapter_id?: string | null;
  login_fields?: LoginField[] | null;
  credential_mode?: CredentialMode;
  source_type: 'built_in' | 'admin' | 'approved_global';
  service_status: 'active' | 'deprecated' | 'disabled';
  metadata?: Record<string, unknown>;
  login_url_status?: LoginUrlStatus;
}

const REGISTRY_ADMIN_SELECT =
  'id, display_name, primary_url, login_url, login_url_status, category_id, icon, adapter_id, login_fields, source_type, service_status, metadata, metadata_version, owner_user_id, created_at, updated_at';

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase לא מוגדר');
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('חיבור Supabase לא זמין');
  }

  return supabase;
}

async function ensureSession() {
  await requireAuthenticatedUserId();
}

function invalidateCatalogCache() {
  clearRegistryCatalogCache();
}

function loginFieldsForWrite(loginFields?: LoginField[] | null): LoginField[] | null {
  if (!loginFields || loginFields.length === 0) {
    return null;
  }
  return loginFields;
}

function mapRegistryError(error: unknown, fallback: string): Error {
  const message = formatUnknownError(error);
  if (/duplicate key|unique constraint|23505/i.test(message)) {
    return new Error('מזהה כבר קיים במערכת.');
  }

  if (/foreign key|category_id|23503/i.test(message)) {
    return new Error('קטגוריה לא קיימת. בחרו קטגוריה תקינה.');
  }

  if (/violates check constraint|23514/i.test(message)) {
    return new Error('ערך לא חוקי לשדה במערכת.');
  }

  if (/row-level security|42501|permission denied|JWT/i.test(message)) {
    return new Error(
      'אין הרשאה לשמור (RLS). ודאו שהמשתמש מסומן כמנהל ורעננו את הדף.',
    );
  }

  if (message && message !== 'unknown error') {
    return new Error(`${fallback} (${message})`);
  }

  return new Error(fallback);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function fetchAdminCategories(): Promise<AdminCategory[]> {
  await ensureSession();
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('categories')
    .select('id, display_name, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לטעון קטגוריות.');
  }

  return (data ?? []) as AdminCategory[];
}

/** AC-107-14 / AC-107-19 — admin UI collects name only; optional sort_order appends transparently. */
export async function createAdminCategory(input: {
  id: string;
  display_name: string;
  /** When omitted, DB default (0) applies. Prefer next after existing for create-at-end. */
  sort_order?: number;
}): Promise<void> {
  await ensureSession();
  const supabase = requireSupabase();

  const row: { id: string; display_name: string; sort_order?: number } = {
    id: input.id.trim(),
    display_name: input.display_name.trim(),
  };
  if (typeof input.sort_order === 'number' && Number.isFinite(input.sort_order)) {
    row.sort_order = Math.trunc(input.sort_order);
  }

  const { error } = await supabase.from('categories').insert(row);

  if (error) {
    throw mapRegistryError(error, 'לא ניתן ליצור קטגוריה.');
  }

  invalidateCatalogCache();
}

export async function updateAdminCategory(
  id: string,
  patch: { display_name: string },
): Promise<void> {
  await ensureSession();
  const supabase = requireSupabase();

  const { error } = await supabase
    .from('categories')
    .update({
      display_name: patch.display_name.trim(),
    })
    .eq('id', id);

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לעדכן קטגוריה.');
  }

  invalidateCatalogCache();
}

/**
 * AC-107-20 — persist display order via sort_order without exposing numbers in the UI.
 * `orderedIds` is categories from first (top) to last (bottom).
 */
export async function reorderAdminCategories(orderedIds: string[]): Promise<void> {
  await ensureSession();
  const supabase = requireSupabase();
  const ids = orderedIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return;

  const updates = ids.map((id, index) =>
    supabase
      .from('categories')
      .update({ sort_order: (index + 1) * 10 })
      .eq('id', id),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    throw mapRegistryError(failed.error, 'לא ניתן לעדכן סדר קטגוריות.');
  }

  invalidateCatalogCache();
}

export async function deleteAdminCategory(id: string): Promise<void> {
  await ensureSession();
  const supabase = requireSupabase();

  const { count, error: countError } = await supabase
    .from('service_registry')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);

  if (countError) {
    throw mapRegistryError(countError, 'לא ניתן לבדוק שימוש בקטגוריה.');
  }

  if ((count ?? 0) > 0) {
    throw new Error('לא ניתן למחוק קטגוריה שמשויכים אליה אתרים.');
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    throw mapRegistryError(error, 'לא ניתן למחוק קטגוריה.');
  }

  invalidateCatalogCache();
}

/** Global catalog only (owner_user_id IS NULL) — used by bulk rediscovery / admin global writes. */
export async function fetchGlobalRegistryRows(): Promise<AdminRegistryRow[]> {
  await ensureSession();
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('service_registry')
    .select(REGISTRY_ADMIN_SELECT)
    .is('owner_user_id', null)
    .order('display_name', { ascending: true });

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לטעון אתרים גלובליים.');
  }

  return (data ?? []) as AdminRegistryRow[];
}

/** All registry rows visible to admin (global + user-owned) for the «כל האתרים» catalog. */
export async function fetchAllRegistryRowsForAdmin(): Promise<AdminRegistryRow[]> {
  await ensureSession();
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('service_registry')
    .select(REGISTRY_ADMIN_SELECT)
    .order('display_name', { ascending: true });

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לטעון את רשימת האתרים.');
  }

  return (data ?? []) as AdminRegistryRow[];
}

export async function fetchPendingSubmissions(): Promise<AdminRegistryRow[]> {
  await ensureSession();
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('service_registry')
    .select(REGISTRY_ADMIN_SELECT)
    .not('owner_user_id', 'is', null)
    .eq('source_type', 'user')
    .in('service_status', ['pending_review', 'active'])
    .order('updated_at', { ascending: false });

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לטעון תור אישורים.');
  }

  return (data ?? []) as AdminRegistryRow[];
}

export interface SubmitterProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

/** Phase 122.7 — names / emails of submitters (admin-only RPC; users who own a user-submitted row). */
export async function fetchSubmitterProfiles(userIds: readonly string[]): Promise<SubmitterProfile[]> {
  if (userIds.length === 0) return [];
  await ensureSession();
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('admin_submitter_profiles', {
    p_user_ids: [...userIds],
  });

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לטעון את פרטי המגישים.');
  }

  return (data ?? []) as SubmitterProfile[];
}

/** Phase 122.8 R4 — admin-only internal note of one service (`public.admin_service_notes`). */
export interface AdminServiceNote {
  service_id: string;
  body: string;
  updated_at: string;
}

export const ADMIN_NOTE_MAX_LENGTH = 20000;

export async function fetchAdminServiceNote(serviceId: string): Promise<AdminServiceNote | null> {
  await ensureSession();
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('admin_service_notes')
    .select('service_id, body, updated_at')
    .eq('service_id', serviceId)
    .maybeSingle();
  if (error) {
    throw mapRegistryError(error, 'לא ניתן לטעון את ההערה.');
  }
  return (data as AdminServiceNote | null) ?? null;
}

/** Ids of the services that have a note (one ids-only query per catalog load). */
export async function fetchAdminNoteServiceIds(): Promise<string[]> {
  await ensureSession();
  const supabase = requireSupabase();
  const { data, error } = await supabase.from('admin_service_notes').select('service_id');
  if (error) {
    throw mapRegistryError(error, 'לא ניתן לטעון את סימוני ההערות.');
  }
  return ((data ?? []) as Array<{ service_id: string }>).map((row) => row.service_id);
}

/** Saves the note; an empty (whitespace-only) body removes it. Returns the saved note or null. */
export async function saveAdminServiceNote(serviceId: string, body: string): Promise<AdminServiceNote | null> {
  if (body.length > ADMIN_NOTE_MAX_LENGTH) {
    throw new Error(`ההערה ארוכה מדי (עד ${ADMIN_NOTE_MAX_LENGTH} תווים).`);
  }
  const writerUserId = await requireAuthenticatedUserId();
  const supabase = requireSupabase();
  if (!body.trim()) {
    const { error } = await supabase.from('admin_service_notes').delete().eq('service_id', serviceId);
    if (error) {
      throw mapRegistryError(error, 'לא ניתן לשמור את ההערה.');
    }
    return null;
  }
  const { data, error } = await supabase
    .from('admin_service_notes')
    .upsert(
      { service_id: serviceId, body, updated_at: new Date().toISOString(), updated_by: writerUserId },
      { onConflict: 'service_id' },
    )
    .select('service_id, body, updated_at')
    .single();
  if (error || !data) {
    throw mapRegistryError(error, 'לא ניתן לשמור את ההערה.');
  }
  return data as AdminServiceNote;
}

export async function fetchRegistryRowForAdmin(serviceId: string): Promise<AdminRegistryRow | null> {
  await ensureSession();
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('service_registry')
    .select(REGISTRY_ADMIN_SELECT)
    .eq('id', serviceId)
    .maybeSingle();

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לטעון אתר.');
  }

  return (data as AdminRegistryRow | null) ?? null;
}

export async function createGlobalRegistryRow(input: GlobalRegistryInput): Promise<string> {
  await ensureSession();
  const supabase = requireSupabase();

  const primaryUrl = input.primary_url.trim();
  if (!primaryUrl) {
    throw new Error('כתובת ראשית היא שדה חובה.');
  }

  const existingRows = await fetchGlobalRegistryRows();
  const serviceId =
    input.id?.trim() ||
    (await allocateUniqueRegistryServiceId(
      primaryUrl,
      existingRows.map((row) => row.id),
    ));

  const loginUrl = input.login_url?.trim() || primaryUrl;
  const entryType: ExplicitLoginEntryType =
    input.metadata?.loginEntryType === 'direct_url' ? 'direct_url' : 'primary_page';
  const published = input.credential_mode
    ? planCredentialConfigurationWrite({
        mode: input.credential_mode,
        fields: input.login_fields,
      })
    : null;
  if (published && !published.ok) {
    throw new Error(published.message);
  }
  const loginFields = published && published.ok
    ? published.loginFields
    : loginFieldsForWrite(input.login_fields);
  const metadata = stampExplicitLoginMetadata(
    {
      ...(input.metadata ?? {}),
      faviconSiteUrl: primaryUrl,
    },
    'admin',
    entryType,
  );
  if (published && published.ok) {
    metadata.credentialMode = published.credentialMode;
  }

  const { error } = await supabase.from('service_registry').insert({
    id: serviceId,
    display_name: input.display_name.trim(),
    primary_url: primaryUrl,
    login_url: loginUrl,
    category_id: normalizeOptionalText(input.category_id),
    icon: normalizeOptionalText(input.icon) ?? '🔗',
    adapter_id: normalizeOptionalText(input.adapter_id),
    login_fields: loginFields,
    source_type: input.source_type,
    service_status: input.service_status,
    metadata,
    metadata_version: 1,
    login_url_status: 'valid',
    owner_user_id: null,
  });

  if (error) {
    throw mapRegistryError(error, 'לא ניתן ליצור אתר גלובלי.');
  }

  invalidateCatalogCache();
  return serviceId;
}

export interface RegistryLoginDiscoveryOutcome {
  discoveryMessage: string;
  loginUrl: string | null;
  discoverySucceeded: boolean;
}

async function runGlobalRegistryLoginDiscovery(
  serviceId: string,
  primaryUrl: string,
  source: 'auto' | 'admin',
  fallbackMessage: string,
): Promise<RegistryLoginDiscoveryOutcome> {
  const row = await fetchRegistryRowForAdmin(serviceId);
  if (!row) {
    return {
      discoveryMessage: `${fallbackMessage} גילוי כניסה לא הורץ — לא נמצאה שורה בקטלוג.`,
      loginUrl: null,
      discoverySucceeded: false,
    };
  }

  try {
    const definition = registryRowToServiceDefinition(row);
    const discovery = await discoverLoginForRegistryService(definition, {
      primaryUrl,
      force: true,
      source,
    });

    const refreshed = await fetchRegistryRowForAdmin(serviceId);
    const loginUrl = refreshed?.login_url ?? discovery.definition.loginUrl ?? null;

    return {
      discoveryMessage: discovery.outcome.message,
      loginUrl,
      discoverySucceeded: Boolean(loginUrl),
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[admin] Login discovery failed gracefully:', error);
    }

    return {
      discoveryMessage:
        `${fallbackMessage} גילוי כניסה לא הצליח — ניתן לערוך ידנית או לנסות גילוי מחדש.`,
      loginUrl: row.login_url,
      discoverySucceeded: Boolean(row.login_url),
    };
  }
}

export interface CreateGlobalRegistryResult {
  serviceId: string;
  discoveryMessage: string;
  loginUrl: string | null;
  discoverySucceeded: boolean;
}

/**
 * Create a global registry row then run the shared Login Discovery pipeline (Phase 108).
 * Discovery failure never rolls back service creation.
 */
export async function createGlobalRegistryRowWithDiscovery(
  input: GlobalRegistryInput,
): Promise<CreateGlobalRegistryResult> {
  const serviceId = await createGlobalRegistryRow(input);

  const discovery = await runGlobalRegistryLoginDiscovery(
    serviceId,
    input.primary_url,
    'auto',
    'האתר נוצר.',
  );

  return { serviceId, ...discovery };
}

/**
 * D-121-55 — what the database reported for a global-row update. An update that RLS
 * filters to zero rows returns no error, so callers that must prove a write read these.
 */
export interface GlobalRegistryWriteResult {
  /** Rows the update matched (null when the response carried no rows array). */
  updatedRows: number | null;
  /** Session user the write ran as. */
  writerUserId: string;
  /** SPECIAL version the sent metadata activates (null when it does not resolve to SPECIAL). */
  writtenSpecialVersion: number | null;
}

function contractModeLabel(metadata: unknown): string {
  const resolved = resolveActiveLoginContract(metadata ?? {});
  return resolved.mode === 'SPECIAL' ? `SPECIAL v${resolved.activePlanVersion}` : resolved.mode;
}

export async function updateGlobalRegistryRow(
  serviceId: string,
  patch: Partial<GlobalRegistryInput>,
): Promise<GlobalRegistryWriteResult> {
  const writerUserId = await requireAuthenticatedUserId();
  const supabase = requireSupabase();
  let contractBefore: Record<string, unknown> | null = null;

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.display_name !== undefined) payload.display_name = patch.display_name.trim();
  if (patch.primary_url !== undefined) payload.primary_url = patch.primary_url.trim();
  if (patch.login_url !== undefined) {
    const trimmedLoginUrl = patch.login_url?.trim() ?? '';
    if (!trimmedLoginUrl) {
      throw new Error('יש להזין כתובת כניסה');
    }
    payload.login_url = trimmedLoginUrl;
    payload.login_url_status = 'valid';
  }
  if (patch.category_id !== undefined) payload.category_id = patch.category_id;
  if (patch.icon !== undefined) payload.icon = patch.icon;
  if (patch.adapter_id !== undefined) payload.adapter_id = patch.adapter_id;
  let publishedCredentialMode: CredentialMode | undefined;
  if (patch.credential_mode !== undefined || patch.login_fields !== undefined) {
    const existing = await fetchRegistryRowForAdmin(serviceId);
    const existingMode = readStoredCredentialMode(existing?.metadata);
    const mode =
      patch.credential_mode ??
      (existingMode === 'absent' || existingMode === 'unrecognized' ? undefined : existingMode);
    if (mode) {
      const planned = planCredentialConfigurationWrite({
        mode,
        fields: patch.credential_mode !== undefined ? patch.login_fields : patch.login_fields,
      });
      if (!planned.ok) {
        throw new Error(planned.message);
      }
      payload.login_fields = planned.loginFields;
      if (patch.credential_mode !== undefined) {
        publishedCredentialMode = planned.credentialMode;
      }
    } else if (patch.login_fields !== undefined) {
      payload.login_fields = loginFieldsForWrite(patch.login_fields);
    }
    const previousFields = JSON.stringify(existing?.login_fields ?? null);
    const nextFields = JSON.stringify(payload.login_fields ?? null);
    const modeChanged =
      publishedCredentialMode !== undefined && publishedCredentialMode !== existingMode;
    if (previousFields !== nextFields || modeChanged) {
      payload.metadata_version = (existing?.metadata_version ?? 1) + 1;
    }
  }
  if (patch.source_type !== undefined) payload.source_type = patch.source_type;
  if (patch.service_status !== undefined) payload.service_status = patch.service_status;
  if (patch.login_url === undefined && patch.login_url_status !== undefined) {
    payload.login_url_status = patch.login_url_status;
  }
  if (patch.login_url !== undefined || patch.metadata !== undefined) {
    const existing = await fetchRegistryRowForAdmin(serviceId);
    contractBefore = existing?.metadata ?? null;
    const entryType: ExplicitLoginEntryType =
      patch.metadata?.loginEntryType === 'direct_url' ||
      patch.metadata?.loginEntryType === 'primary_page'
        ? patch.metadata.loginEntryType
        : existing?.metadata?.loginEntryType === 'direct_url'
          ? 'direct_url'
          : 'primary_page';
    const merged = {
      ...(existing?.metadata ?? {}),
      ...(patch.metadata ?? {}),
    };
    if (publishedCredentialMode) {
      merged.credentialMode = publishedCredentialMode;
    }
    payload.metadata =
      patch.login_url !== undefined
        ? stampExplicitLoginMetadata(merged, 'admin', entryType)
        : merged;
  } else if (publishedCredentialMode) {
    const existing = await fetchRegistryRowForAdmin(serviceId);
    contractBefore = existing?.metadata ?? null;
    payload.metadata = {
      ...(existing?.metadata ?? {}),
      credentialMode: publishedCredentialMode,
    };
  }

  if (
    patch.metadata !== undefined &&
    Object.prototype.hasOwnProperty.call(patch.metadata, 'autofillProfile')
  ) {
    const existingForAutofill = await fetchRegistryRowForAdmin(serviceId);
    const currentMetadata = (payload.metadata as Record<string, unknown> | undefined) ?? {
      ...(existingForAutofill?.metadata ?? {}),
      ...(patch.metadata ?? {}),
    };
    const loginFieldsForAutofill =
      payload.login_fields ?? existingForAutofill?.login_fields ?? null;
    const loginUrlForAutofill =
      typeof payload.login_url === 'string'
        ? payload.login_url
        : existingForAutofill?.login_url ?? null;
    const mergedAutofill = mergeAutofillProfileMetadata({
      existingMetadata: existingForAutofill?.metadata ?? {},
      patchMetadata: patch.metadata,
      loginFields: loginFieldsForAutofill,
      loginUrl: loginUrlForAutofill,
    });
    if (!mergedAutofill.ok) {
      throw new Error(mergedAutofill.message);
    }
    payload.metadata = stripAutofillControlKeys({
      ...currentMetadata,
      ...mergedAutofill.metadata,
    });
  }

  // Phase 121.0 — atomic loginContractActivation / loginFlowPlan (siblings of autofillProfile).
  if (
    patch.metadata !== undefined &&
    (Object.prototype.hasOwnProperty.call(patch.metadata, LOGIN_CONTRACT_ACTIVATE_INTENT_KEY) ||
      Object.prototype.hasOwnProperty.call(patch.metadata, LOGIN_CONTRACT_ACTIVATION_META_KEY) ||
      Object.prototype.hasOwnProperty.call(patch.metadata, LOGIN_FLOW_PLAN_META_KEY))
  ) {
    const existingForContract = await fetchRegistryRowForAdmin(serviceId);
    const dbMeta = { ...(existingForContract?.metadata ?? {}) };
    const afterAutofill = {
      ...dbMeta,
      ...((payload.metadata as Record<string, unknown> | undefined) ?? {}),
    };
    // Planner must see previous ACTIVE — strip this-request contract keys from "existing".
    delete afterAutofill[LOGIN_CONTRACT_ACTIVATE_INTENT_KEY];
    if (Object.prototype.hasOwnProperty.call(patch.metadata, LOGIN_CONTRACT_ACTIVATION_META_KEY)) {
      if (Object.prototype.hasOwnProperty.call(dbMeta, LOGIN_CONTRACT_ACTIVATION_META_KEY)) {
        afterAutofill[LOGIN_CONTRACT_ACTIVATION_META_KEY] =
          dbMeta[LOGIN_CONTRACT_ACTIVATION_META_KEY];
      } else {
        delete afterAutofill[LOGIN_CONTRACT_ACTIVATION_META_KEY];
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch.metadata, LOGIN_FLOW_PLAN_META_KEY)) {
      if (Object.prototype.hasOwnProperty.call(dbMeta, LOGIN_FLOW_PLAN_META_KEY)) {
        afterAutofill[LOGIN_FLOW_PLAN_META_KEY] = dbMeta[LOGIN_FLOW_PLAN_META_KEY];
      } else {
        delete afterAutofill[LOGIN_FLOW_PLAN_META_KEY];
      }
    }
    const mergedContract = mergeLoginContractMetadata({
      existingMetadata: afterAutofill,
      patchMetadata: patch.metadata,
    });
    if (!mergedContract.ok) {
      throw new Error(mergedContract.message);
    }
    payload.metadata = stripLoginContractControlKeys(
      stripAutofillControlKeys({
        ...afterAutofill,
        ...mergedContract.metadata,
      }),
    );
  }

  const { data, error } = await supabase
    .from('service_registry')
    .update(payload)
    .eq('id', serviceId)
    .is('owner_user_id', null)
    .select('id');

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לעדכן אתר גלובלי.');
  }
  const updatedRows = Array.isArray(data) ? data.length : null;
  let writtenSpecialVersion: number | null = null;

  if (payload.metadata !== undefined) {
    const written = resolveActiveLoginContract(payload.metadata);
    if (written.mode === 'SPECIAL') writtenSpecialVersion = written.activePlanVersion;
    const before = contractModeLabel(contractBefore);
    const after = contractModeLabel(payload.metadata);
    if (before !== 'STANDARD' || after !== 'STANDARD') {
      // D-121-55 evidence: every write that carries or changes the login contract (no values).
      console.info('[D-121-55 registry contract write]', {
        serviceId,
        before,
        after,
        updatedRows,
        writer: writerUserId.slice(0, 8),
      });
    }
  }

  invalidateCatalogCache();
  return { updatedRows, writerUserId, writtenSpecialVersion };
}

/**
 * Admin edit of a user-owned submission (owner_user_id stays set).
 * Approval/promotion remains a separate flow; this only updates reviewable fields.
 */
export async function updateUserOwnedRegistryRow(
  serviceId: string,
  patch: Pick<
    GlobalRegistryInput,
    'display_name' | 'primary_url' | 'login_url' | 'category_id' | 'service_status' | 'metadata'
  >,
): Promise<void> {
  await ensureSession();
  const supabase = requireSupabase();

  const existing = await fetchRegistryRowForAdmin(serviceId);
  if (!existing || existing.owner_user_id === null) {
    throw new Error('הגשת משתמש לא נמצאה.');
  }

  const loginUrl = patch.login_url?.trim() ?? '';
  if (!loginUrl) {
    throw new Error('יש להזין כתובת כניסה');
  }

  const entryType: ExplicitLoginEntryType =
    patch.metadata?.loginEntryType === 'direct_url' ? 'direct_url' : 'primary_page';

  const { error } = await supabase
    .from('service_registry')
    .update({
      display_name: patch.display_name.trim(),
      primary_url: patch.primary_url.trim(),
      login_url: loginUrl,
      login_url_status: 'valid',
      category_id: patch.category_id,
      service_status: patch.service_status,
      // User-owned rows have no contract merge: stored contract keys stay as stored.
      metadata: stampExplicitLoginMetadata(
        {
          ...(existing.metadata ?? {}),
          ...withoutLoginContractKeys(patch.metadata),
        },
        'user',
        entryType,
      ),
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceId)
    .eq('owner_user_id', existing.owner_user_id)
    .eq('source_type', 'user');

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לעדכן הגשת משתמש.');
  }

  invalidateCatalogCache();
}

export async function disableGlobalRegistryRow(serviceId: string): Promise<void> {
  await updateGlobalRegistryRow(serviceId, { service_status: 'disabled' });
}

export interface ServiceDeleteImpact {
  usersCount: number;
  profilesCount: number;
  isBuiltin: boolean;
}

export interface ServiceDeleteResult extends ServiceDeleteImpact {
  credentialsCount: number;
  assetsCount: number;
  storageRemoved: number;
  /** Storage cleanup failure (best-effort); the DB delete is not undone. */
  storageFailure: string | null;
}

/**
 * D-121-51 C1: the delete RPCs keep the raw PostgREST text (code included, e.g. PGRST202);
 * DeleteServiceDialog maps it to plain Hebrew and shows the raw text only under «פרטים טכניים».
 */
function serviceDeleteRpcError(error: unknown): Error {
  const raw = error ? formatUnknownError(error) : 'unexpected empty RPC response';
  return new Error(raw === 'unknown error' ? 'unexpected RPC error' : raw);
}

function countField(data: Record<string, unknown>, key: string): number {
  const value = Number(data[key]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** D-121-51 preflight: users / profiles that the delete would remove, and the built-in flag. */
export async function fetchServiceDeleteImpact(serviceId: string): Promise<ServiceDeleteImpact> {
  await ensureSession();
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('admin_service_delete_impact', {
    p_service_id: serviceId,
  });
  if (error || !data || typeof data !== 'object') {
    throw serviceDeleteRpcError(error);
  }
  const row = data as Record<string, unknown>;
  return {
    usersCount: countField(row, 'users_count'),
    profilesCount: countField(row, 'profiles_count'),
    isBuiltin: row.is_builtin === true,
  };
}

/**
 * D-121-51 «מחיקת אתר»: one server transaction removes the site for all users, then the site's
 * Storage objects are removed best-effort (a Storage failure is reported, never rolled back).
 */
export async function adminDeleteService(
  serviceId: string,
  confirmDisplayName: string,
): Promise<ServiceDeleteResult> {
  await ensureSession();
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('admin_delete_service', {
    p_service_id: serviceId,
    p_confirm_display_name: confirmDisplayName,
  });
  if (error || !data || typeof data !== 'object') {
    throw serviceDeleteRpcError(error);
  }
  invalidateCatalogCache();
  const row = data as Record<string, unknown>;
  const assetPaths = Array.isArray(row.asset_paths)
    ? row.asset_paths.filter((path): path is string => typeof path === 'string')
    : [];
  const { removeServiceAssetObjects } = await import('../serviceAssets/removeServiceAssetObjects');
  const storage = await removeServiceAssetObjects(supabase, serviceId, assetPaths);
  const { invalidateServiceLogoCache } = await import('../logoCache');
  invalidateServiceLogoCache(serviceId);
  return {
    usersCount: countField(row, 'users_count'),
    profilesCount: countField(row, 'profiles_count'),
    isBuiltin: row.is_builtin === true,
    credentialsCount: countField(row, 'credentials_count'),
    assetsCount: countField(row, 'assets_count'),
    storageRemoved: storage.removed,
    storageFailure: storage.failure,
  };
}

export async function promoteUserSubmission(
  userServiceId: string,
  globalServiceId?: string,
): Promise<string> {
  await ensureSession();
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('promote_user_submission', {
    p_user_service_id: userServiceId,
    p_global_service_id: globalServiceId ?? null,
  });

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לאשר את ההגשה.');
  }

  invalidateCatalogCache();
  return String(data);
}

export interface PromoteSubmissionResult {
  globalId: string;
  discoveryMessage: string;
  loginUrl: string | null;
  discoverySucceeded: boolean;
}

/**
 * Promote user submission to built_in global catalog, then run Login Discovery (Phase 108).
 * Uses force=true to discover or re-verify login URL on approval.
 */
export async function promoteUserSubmissionWithDiscovery(
  userServiceId: string,
  globalServiceId?: string,
): Promise<PromoteSubmissionResult> {
  const globalId = await promoteUserSubmission(userServiceId, globalServiceId);
  const row = await fetchRegistryRowForAdmin(globalId);

  const discovery = await runGlobalRegistryLoginDiscovery(
    globalId,
    row?.primary_url ?? '',
    'admin',
    'האתר אושר כמובנה.',
  );

  return { globalId, ...discovery };
}

export async function rejectUserSubmission(
  userServiceId: string,
  reason?: string,
): Promise<void> {
  await ensureSession();
  const supabase = requireSupabase();

  const existing = await fetchRegistryRowForAdmin(userServiceId);
  if (!existing || existing.owner_user_id === null) {
    throw new Error('הגשת משתמש לא נמצאה.');
  }

  const metadata = {
    ...(existing.metadata ?? {}),
    rejectionReason: reason?.trim() || 'נדחה על ידי מנהל',
    rejectedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('service_registry')
    .update({
      service_status: 'disabled',
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userServiceId)
    .not('owner_user_id', 'is', null);

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לדחות את ההגשה.');
  }

  invalidateCatalogCache();
}

export async function adminUpdateLoginUrl(
  serviceId: string,
  loginUrl: string,
  _loginFields?: LoginField[] | null,
  loginUrlStatus: LoginUrlStatus = 'valid',
): Promise<void> {
  await ensureSession();
  const supabase = requireSupabase();

  // Login URL edit must not create or modify login_fields (AC-107-25).
  const { error } = await supabase.rpc('admin_update_login_url', {
    p_service_id: serviceId,
    p_login_url: loginUrl.trim(),
    p_login_fields: null,
    p_login_url_status: loginUrlStatus,
  });

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לעדכן כתובת כניסה.');
  }

  // Client follow-up records ownership only. Do not add discovery outcome fields.
  // Residual: RPC admin_update_login_url may still stamp discovery-shaped keys
  // (loginUrlDiscoveryOutcome, lastDiscoveryOutcome, discoveryMethod). M1 does not migrate that.
  if (loginUrlStatus === 'valid') {
    const row = await fetchRegistryRowForAdmin(serviceId);
    if (row && row.owner_user_id === null) {
      const metadata = stampExplicitLoginMetadata(
        row.metadata ?? {},
        'admin',
        row.metadata?.loginEntryType === 'direct_url' ? 'direct_url' : 'primary_page',
      );

      const { error: metaError } = await supabase
        .from('service_registry')
        .update({
          metadata,
          login_url_status: 'valid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', serviceId)
        .is('owner_user_id', null);

      if (metaError && import.meta.env.DEV) {
        console.warn('[admin] Post-edit login entry metadata skipped:', metaError);
      }
    }
  }

  invalidateCatalogCache();
}

export async function markGlobalLoginUrlInvalid(serviceId: string): Promise<void> {
  await ensureSession();
  const supabase = requireSupabase();

  const row = await fetchRegistryRowForAdmin(serviceId);
  if (!row || row.owner_user_id !== null) {
    throw new Error('ניתן לסמן כלא תקין רק אתר גלובלי.');
  }

  const { error } = await supabase
    .from('service_registry')
    .update({
      login_url_status: 'stale',
      metadata: {
        ...(row.metadata ?? {}),
        lastAdminEdit: new Date().toISOString(),
        loginUrlSource: 'admin',
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceId)
    .is('owner_user_id', null);

  if (error) {
    throw mapRegistryError(error, 'לא ניתן לסמן כתובת כניסה כלא תקינה.');
  }

  invalidateCatalogCache();
}

export async function updateIconMetadata(
  serviceId: string,
  patch: {
    icon?: string | null;
    faviconSiteUrl?: string;
    iconSource?: string;
  },
): Promise<void> {
  const row = await fetchRegistryRowForAdmin(serviceId);
  if (!row || row.owner_user_id !== null) {
    throw new Error('ניתן לערוך אייקון רק לאתר גלובלי.');
  }

  const metadata = {
    ...withoutLoginContractKeys(row.metadata),
  };

  if (patch.faviconSiteUrl !== undefined) {
    metadata.faviconSiteUrl = patch.faviconSiteUrl.trim();
  }

  if (patch.iconSource !== undefined) {
    metadata.iconSource = patch.iconSource.trim();
  }

  await updateGlobalRegistryRow(serviceId, {
    icon: patch.icon ?? row.icon,
    metadata,
  });
}

/**
 * Phase 111 — Admin uploads an image file as the active managed icon (AC-111-16).
 */
export async function uploadAdminIconFile(serviceId: string, file: File): Promise<void> {
  await ensureSession();
  const row = await fetchRegistryRowForAdmin(serviceId);
  if (!row || row.owner_user_id !== null) {
    throw new Error('ניתן להעלות אייקון רק לאתר גלובלי.');
  }

  const { uploadAdminServiceIcon } = await import('../serviceAssets/adminUpload');
  await uploadAdminServiceIcon(serviceId, file);
  invalidateCatalogCache();
  const { invalidateServiceLogoCache } = await import('../logoCache');
  invalidateServiceLogoCache(serviceId);
}

/**
 * Phase 111 — refresh icon asset. Never overwrites admin without force.
 */
export async function adminRefreshServiceIcon(
  serviceId: string,
  options?: { force?: boolean },
): Promise<{ message: string }> {
  await ensureSession();
  const row = await fetchRegistryRowForAdmin(serviceId);
  if (!row || row.owner_user_id !== null) {
    throw new Error('ניתן לרענון אייקון רק לאתר גלובלי.');
  }

  const { refreshServiceAssets } = await import('../serviceAssets/refresh');
  const report = await refreshServiceAssets(
    [{ id: row.id, primaryUrl: row.primary_url, metadata: row.metadata }],
    { force: options?.force === true },
  );
  const item = report.items[0];
  return { message: item?.message || 'רענון הסתיים.' };
}

export interface AdminRediscoveryResult {
  persisted: boolean;
  loginUrl: string | null;
  message: string;
}

export async function adminTriggerLoginRediscovery(
  serviceId: string,
  options?: { forceAdminOverwrite?: boolean },
): Promise<AdminRediscoveryResult> {
  const row = await fetchRegistryRowForAdmin(serviceId);
  if (!row || row.owner_user_id !== null) {
    throw new Error('ניתן לגילוי מחדש רק אתר גלובלי.');
  }

  try {
    const definition = registryRowToServiceDefinition(row);
    const discovery = await discoverLoginForRegistryService(definition, {
      primaryUrl: row.primary_url,
      force: true,
      forceAdminOverwrite: options?.forceAdminOverwrite ?? true,
      source: 'admin',
    });

    if (discovery.outcome.status === 'failure' && discovery.discovery === null) {
      const refreshed = await fetchRegistryRowForAdmin(serviceId);
      if (refreshed && refreshed.metadata?.loginUrlSource === 'admin') {
        return {
          persisted: Boolean(refreshed.login_url),
          loginUrl: refreshed.login_url,
          message: 'דילוג — כתובת כניסה מוגנת על ידי עריכת מנהל.',
        };
      }
    }

    const refreshed = await fetchRegistryRowForAdmin(serviceId);
    const discoveryResult = discovery.discovery;
    const modalOrReview =
      discoveryResult?.usesModal ||
      discoveryResult?.loginEntryType === 'modal' ||
      refreshed?.login_url_status === 'needs_review';

    return {
      persisted: Boolean(refreshed?.login_url) && refreshed?.login_url_status === 'valid',
      loginUrl:
        refreshed?.login_url_status === 'valid' ? refreshed.login_url : null,
      message: modalOrReview
        ? 'גילוי: כניסה במודל / דורש בדיקה — לא נשמרה כתובת פורטל.'
        : discovery.outcome.message,
    };
  } catch {
    return {
      persisted: false,
      loginUrl: null,
      message: 'גילוי כניסה נכשל. נסו שוב או ערכו ידנית.',
    };
  }
}

export {
  BULK_REFRESH_CONCURRENCY,
  BULK_REFRESH_INTER_BATCH_DELAY_MS,
  type BulkLoginUrlRefreshReport,
};

export async function adminBulkRefreshLoginUrls(
  forceAdminOverwrite = false,
): Promise<BulkLoginUrlRefreshReport> {
  await ensureSession();
  const rows = await fetchGlobalRegistryRows();
  const activeRows = rows.filter((row) => row.service_status === 'active');

  return bulkRefreshLoginUrls({
    rows: activeRows,
    forceAdminOverwrite,
    source: 'auto',
  });
}

export function parseLoginFieldsJson(raw: string): LoginField[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('מבנה שדות כניסה חייב להיות מערך JSON.');
  }

  return parsed.map((entry, index) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as LoginField).id !== 'string' ||
      typeof (entry as LoginField).label !== 'string' ||
      ((entry as LoginField).type !== 'text' && (entry as LoginField).type !== 'password')
    ) {
      throw new Error(`שדה כניסה ${index + 1} אינו תקין.`);
    }

    return entry as LoginField;
  });
}

/**
 * Phase 112 — reclassify Login Intelligence from discovery metadata (+ optional page signals).
 * Admin override is never silently replaced (AC-112-19/20).
 */
export async function adminRefreshLoginIntelligence(
  serviceId: string,
  options?: { forceReplaceAdmin?: boolean; pageSignals?: import('../loginIntelligence').LoginPageSignals },
): Promise<{ applied: boolean; message: string }> {
  await ensureSession();
  const row = await fetchRegistryRowForAdmin(serviceId);
  if (!row || row.owner_user_id !== null) {
    throw new Error('ניתן לרענון Login Intelligence רק לאתר גלובלי.');
  }

  const { applyLoginIntelligenceClassification } = await import('../loginIntelligence');
  const result = applyLoginIntelligenceClassification(row.metadata, options?.pageSignals ?? {}, {
    forceReplaceAdmin: options?.forceReplaceAdmin === true,
    lastValidatedBy: options?.forceReplaceAdmin ? 'admin' : 'auto',
    markAdminOverride: options?.forceReplaceAdmin === true,
  });

  const metadata = {
    ...withoutLoginContractKeys(row.metadata),
    ...result.metadataPatch,
  };

  await updateGlobalRegistryRow(serviceId, { metadata });

  if (!result.applied) {
    return {
      applied: false,
      message:
        result.reason === 'admin_override_protected'
          ? 'דילוג — Login Intelligence מוגן ע״י עריכת מנהל. השתמשו ב«דריסה» לאישור החלפה.'
          : 'סיווג נשמר לבדיקה ולא דרס מטא-דאטה מאומתת.',
    };
  }

  return {
    applied: true,
    message: `Login Intelligence עודכן (${result.intelligence?.loginComplexity ?? 'unknown'}).`,
  };
}

/** Phase 112 — manual LI override (always lastValidatedBy=admin). */
export async function adminOverrideLoginIntelligence(
  serviceId: string,
  patch: Partial<import('../loginIntelligence').LoginIntelligence>,
): Promise<void> {
  await ensureSession();
  const row = await fetchRegistryRowForAdmin(serviceId);
  if (!row || row.owner_user_id !== null) {
    throw new Error('ניתן לדריסת Login Intelligence רק לאתר גלובלי.');
  }

  const { buildManualLoginIntelligenceOverride } = await import('../loginIntelligence');
  const liPatch = buildManualLoginIntelligenceOverride(row.metadata, patch);
  await updateGlobalRegistryRow(serviceId, {
    metadata: {
      ...withoutLoginContractKeys(row.metadata),
      ...liPatch,
    },
  });
}

