import { sendExtensionMessageAsync, probeExtensionAvailable } from '../browserIntegration';
import { originFromHttpsLoginEntry, type AutofillFieldMapping } from './validatedProfile';

/** Admin assess-only probe — distinct from HUB_MANAGED_AUTOFILL (no credentials / no fill). */
export const ADMIN_MANAGED_READINESS_PROBE_MESSAGE = 'ADMIN_MANAGED_READINESS_PROBE';

export const MANAGED_READINESS_PROBE_NEED_LOGIN_ENTRY_HE =
  'יש להגדיר כתובת כניסה HTTPS תקינה לפני בדיקת מוכנות.';
export const MANAGED_READINESS_PROBE_NEED_MAPPINGS_HE =
  'יש לשמור מיפוי מבני מלא לפני בדיקת מוכנות.';
export const MANAGED_READINESS_PROBE_EXTENSION_UNAVAILABLE_HE =
  'התוסף אינו זמין. לא ניתן לבדוק מוכנות מנוהלת.';
export const MANAGED_READINESS_PROBE_FAILED_HE = 'בדיקת מוכנות מנוהלת נכשלה.';

export type ManagedReadinessProbeResult =
  | {
      ok: true;
      mappingCount: number;
      resultSummary: 'managed_readiness_ok';
    }
  | {
      ok: false;
      message: string;
      reason?: string;
      fieldId?: string;
      locator?: string;
      detail?: string;
    };

interface ExtensionProbeResponse {
  ok?: boolean;
  ready?: boolean;
  reason?: string;
  fieldId?: string;
  locator?: string;
  detail?: string;
  mappingCount?: number;
}

const FAIL_CLOSED_DETAILS = new Set([
  'zero_match',
  'multi_match',
  'hidden_target',
  'non_editable',
  'unsafe_target',
]);

/**
 * Format Admin-visible Hebrew error. Surfaces fieldId / detail / locator — never secrets.
 */
export function formatManagedReadinessFailureHe(input: {
  reason?: string;
  fieldId?: string;
  locator?: string;
  detail?: string;
}): string {
  const parts: string[] = [];
  if (input.fieldId) {
    parts.push(`שדה ${input.fieldId}`);
  }
  if (input.detail && FAIL_CLOSED_DETAILS.has(input.detail)) {
    parts.push(input.detail);
  } else if (input.detail) {
    parts.push(input.detail);
  } else if (input.reason) {
    parts.push(input.reason);
  }
  if (input.locator) {
    parts.push(input.locator);
  }
  if (parts.length === 0) {
    return MANAGED_READINESS_PROBE_FAILED_HE;
  }
  return `${MANAGED_READINESS_PROBE_FAILED_HE} ${parts.join(' · ')}`;
}

/**
 * Phase 120.2-AP — Managed-parity activate gate probe.
 * Opens Login Entry (top document), runs assessManagedTargetsReady only.
 * Never sends vault credentials. Never fills. Never submits.
 */
export async function runManagedReadinessProbe(input: {
  loginEntryUrl: string;
  fieldMappings: AutofillFieldMapping[];
}): Promise<ManagedReadinessProbeResult> {
  const loginEntryUrl = input.loginEntryUrl.trim();
  const allowedOrigin = originFromHttpsLoginEntry(loginEntryUrl);
  if (!allowedOrigin) {
    return { ok: false, message: MANAGED_READINESS_PROBE_NEED_LOGIN_ENTRY_HE, reason: 'missing_login_entry' };
  }

  const fieldMappings = input.fieldMappings.filter(
    (mapping) => mapping.fieldId.trim() && mapping.locator.trim(),
  );
  if (fieldMappings.length === 0) {
    return { ok: false, message: MANAGED_READINESS_PROBE_NEED_MAPPINGS_HE, reason: 'no_mappings' };
  }

  if (!probeExtensionAvailable()) {
    return {
      ok: false,
      message: MANAGED_READINESS_PROBE_EXTENSION_UNAVAILABLE_HE,
      reason: 'extension_unavailable',
    };
  }

  const requestId = crypto.randomUUID();
  const response = await sendExtensionMessageAsync<ExtensionProbeResponse>({
    type: ADMIN_MANAGED_READINESS_PROBE_MESSAGE,
    requestId,
    loginEntryUrl,
    allowedOrigin,
    fieldMappings: fieldMappings.map((mapping) => ({
      fieldId: mapping.fieldId,
      locatorType: 'css' as const,
      locator: mapping.locator,
    })),
  });

  if (response?.ok === true && response.ready === true) {
    const mappingCount =
      typeof response.mappingCount === 'number' && response.mappingCount > 0
        ? response.mappingCount
        : fieldMappings.length;
    return { ok: true, mappingCount, resultSummary: 'managed_readiness_ok' };
  }

  const reason = response?.reason;
  const fieldId = typeof response?.fieldId === 'string' ? response.fieldId : undefined;
  const locator = typeof response?.locator === 'string' ? response.locator : undefined;
  const detail = typeof response?.detail === 'string' ? response.detail : undefined;

  return {
    ok: false,
    message: formatManagedReadinessFailureHe({ reason, fieldId, locator, detail }),
    reason,
    fieldId,
    locator,
    detail,
  };
}
