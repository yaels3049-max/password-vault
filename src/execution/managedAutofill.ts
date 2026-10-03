/**
 * Phase 117 — Hub Managed Autofill helper.
 * Schema-dynamic: sends field.id → value plus explicit CSS mappings.
 * Never calls the legacy generic fill helper (no silent fallback).
 * Awaits extension structured result — never reports success on click alone.
 */

import type { Credential } from '../credentials';
import type { LoginField, Service } from '../mockServices';
import { getServiceOpenUrl } from '../mockServices';
import {
  isManagedAutofillEligible,
  isVersionMatchedValidated,
  readAutofillProfileFromMetadata,
  type AutofillProfile,
} from '../autofill/validatedProfile';
import {
  isExtensionAvailable,
  openUrlInNewTab,
  sendExtensionMessageAsync,
} from './extensionBridge';
import {
  acquireFillRun,
  fillRunCount,
  fillRunEndMessage,
  FILL_RUN_TIMEOUT_REASON,
  isFillRunActive,
  stopFillRun,
} from './fillRunControl';

export const HUB_MANAGED_AUTOFILL_MESSAGE = 'HUB_MANAGED_AUTOFILL';

export const MSG_MANAGED_FILL_OK =
  'המילוי האוטומטי הושלם. בדקו את השדות ולחצו על התחברות באתר.';

/** D-117-18 / AC-117-34 — non-success working state while awaiting extension result. */
export const MSG_MANAGED_IN_PROGRESS = 'ממלא פרטי כניסה...';

export const MSG_MANAGED_EXTENSION_UNAVAILABLE =
  'האתר נפתח. מילוי אוטומטי לא זמין כרגע — ניתן למלא את השדות ידנית.';

export const MSG_MANAGED_OPEN_FAILED =
  'לא ניתן לפתוח את דף הכניסה למילוי האוטומטי. נסו «פתח אתר» או בדקו שהתוסף פעיל.';

export const MSG_MANAGED_FILL_FAILED =
  'דף הכניסה נפתח, אך המילוי האוטומטי נכשל. מלאו את השדות ידנית.';

export const MSG_MANAGED_NOT_READY =
  'המילוי האוטומטי המנוהל אינו מוכן כרגע לאתר זה. נסו «פתח אתר» ומלאו ידנית.';

export const MSG_MANAGED_BUSY =
  'מילוי אוטומטי כבר בתהליך לפרופיל זה. המתינו לסיום הניסיון הנוכחי.';

export type ManagedAutofillResult =
  | { ok: true; extensionUsed: true; userMessage: string; tabOpened: true }
  | {
      ok: false;
      reason:
        | 'not_eligible'
        | 'extension_unavailable'
        | 'open_failed'
        | 'fill_failed'
        | 'managed_failed'
        | 'busy';
      userMessage: string;
      tabOpened: boolean;
      extensionUsed: boolean;
    };

/** Extension/Hub structured Managed outcome — no credential values. */
export interface ManagedAutofillStructuredOutcome {
  ok: boolean;
  reason?: string;
  fieldId?: string;
  locator?: string;
  detail?: string;
  filled?: number;
  tabOpened: boolean;
  extensionUsed: boolean;
  userMessage: string;
  /** A2 — structural fill stamps only; never secrets. */
  fillDiagnostics?: ManagedFillDiagnostics;
}

/** Post-120 Corrective A / A2 — safe structural stamps (no values). */
export interface ManagedFillDiagStamp {
  runId?: string;
  path?: string;
  fieldId?: string;
  locator?: string;
  stage?: string;
  stageOrderIndex?: number;
  exactOne?: string | null;
  matchCount?: number | null;
  managedEligible?: boolean;
  heldConnected?: boolean | null;
  heldEqualsCurrent?: boolean | null;
  targetReplaced?: boolean | null;
  expectedValueMatchHeld?: boolean | null;
  expectedValueMatchCurrent?: boolean | null;
}

export interface ManagedFillDiagnostics {
  runId: string;
  path: string;
  stamps: ManagedFillDiagStamp[];
}

export interface ManagedAutofillOptions {
  /** Digital Home access profile id — part of D-117-20 execution key (no secrets). */
  accessProfileId?: string | null;
}

/**
 * D-117-20 / AC-117-36 — in-flight keys are `(serviceId, accessProfileId)` only.
 * Admin Test uses a distinct key prefix (D-120-12 / §15.8) — no secrets.
 * D-121-72: the lock is a run token (`fillRunControl`, lane `managed`) — bounded, stoppable.
 */

/** Stable execution key — serviceId + accessProfileId only (no secrets). */
export function managedAutofillExecutionKey(
  serviceId: string,
  accessProfileId: string,
): string {
  return `${serviceId.trim()}::${accessProfileId.trim()}`;
}

/** Admin Test harness execution key — distinct from Digital Home vault path. */
export function adminManagedTestExecutionKey(serviceId: string): string {
  return managedAutofillExecutionKey(serviceId, 'admin_test');
}

export function isManagedAutofillInFlightFor(
  serviceId: string,
  accessProfileId: string,
): boolean {
  if (!serviceId.trim() || !accessProfileId.trim()) {
    return false;
  }
  return isFillRunActive('managed', managedAutofillExecutionKey(serviceId, accessProfileId));
}

/** Test/diagnostics: how many Managed executions are currently in flight. */
export function managedAutofillInFlightCount(): number {
  return fillRunCount('managed');
}

/**
 * D-121-72 «עצור» (Admin «בדיקת מילוי» only) — stops the Admin Test run of this service
 * in either lane (STANDARD Managed / SPECIAL). True when a run was stopped.
 */
export function stopAdminFillTest(serviceId: string): boolean {
  const key = adminManagedTestExecutionKey(serviceId);
  const managed = stopFillRun('managed', key);
  const special = stopFillRun('special', key);
  return managed || special;
}

/** Reasons that mean the extension never created / loaded the Login Entry tab. */
const TAB_NOT_OPENED_REASONS = new Set([
  'url_not_allowed',
  'missing_managed_payload',
  'no_tab',
  'tab_load_error',
  'tab_load_timeout',
  'unknown_message',
  'no_message',
]);

function logManagedDev(message: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) {
    return;
  }
  if (detail) {
    console.log(message, detail);
    return;
  }
  console.log(message);
}

function userMessageForManagedFailure(
  reason: string,
  path: 'admin_test' | 'digital_home',
): string {
  const ended = fillRunEndMessage(reason, path);
  if (ended) {
    return ended;
  }
  if (TAB_NOT_OPENED_REASONS.has(reason)) {
    return MSG_MANAGED_OPEN_FAILED;
  }
  if (reason === 'busy') {
    return MSG_MANAGED_BUSY;
  }
  if (reason === 'extension_unavailable') {
    return MSG_MANAGED_EXTENSION_UNAVAILABLE;
  }
  return MSG_MANAGED_FILL_FAILED;
}

/**
 * Shared Managed payload shape (D-120-12). Value source is caller-supplied credentials.
 * Never includes vault vs temp distinction in the Ext message.
 */
export function buildManagedAutofillPayload(input: {
  url: string;
  allowedOrigin: string;
  fieldMappings: AutofillProfile['fieldMappings'];
  credentials: Credential;
  /** A2 — path label only; does not alter fill. */
  diagnosticPath?: 'admin_test' | 'digital_home';
}): Record<string, unknown> {
  const credentials: Credential = {};
  for (const mapping of input.fieldMappings) {
    const value = input.credentials[mapping.fieldId];
    if (typeof value === 'string' && value.trim()) {
      credentials[mapping.fieldId] = value.trim();
    }
  }

  const payload: Record<string, unknown> = {
    type: HUB_MANAGED_AUTOFILL_MESSAGE,
    url: input.url,
    allowedOrigin: input.allowedOrigin,
    fieldMappings: input.fieldMappings.map((mapping) => ({
      fieldId: mapping.fieldId,
      locatorType: mapping.locatorType,
      locator: mapping.locator,
    })),
    credentials,
  };
  if (input.diagnosticPath === 'admin_test' || input.diagnosticPath === 'digital_home') {
    payload.diagnosticPath = input.diagnosticPath;
  }
  return payload;
}

function diagnosticPathFromExecutionKey(
  executionKey: string,
): 'admin_test' | 'digital_home' {
  return /::admin_test$/.test(executionKey.trim()) ? 'admin_test' : 'digital_home';
}

function readFillDiagnostics(
  response: { fillDiagnostics?: unknown } | null | undefined,
): ManagedFillDiagnostics | undefined {
  const raw = response?.fillDiagnostics;
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.runId !== 'string' || typeof obj.path !== 'string') {
    return undefined;
  }
  if (!Array.isArray(obj.stamps)) {
    return undefined;
  }
  return {
    runId: obj.runId,
    path: obj.path,
    stamps: obj.stamps as ManagedFillDiagStamp[],
  };
}

/**
 * ★ CONVERGENCE ★ — send Managed payload and await structured Ext result.
 * Digital Home and Admin Test both call this after building credentials.
 * executionKey must be unique per concurrent lane (no secrets in key).
 */
export async function sendManagedAutofillPayloadAndAwait(input: {
  url: string;
  allowedOrigin: string;
  fieldMappings: AutofillProfile['fieldMappings'];
  credentials: Credential;
  executionKey: string;
}): Promise<ManagedAutofillStructuredOutcome> {
  const executionKey = input.executionKey.trim();
  if (!executionKey) {
    return {
      ok: false,
      reason: 'not_eligible',
      tabOpened: false,
      extensionUsed: false,
      userMessage: MSG_MANAGED_NOT_READY,
    };
  }

  const fillRun = acquireFillRun('managed', executionKey);
  if (!fillRun) {
    return {
      ok: false,
      reason: 'busy',
      tabOpened: false,
      extensionUsed: false,
      userMessage: MSG_MANAGED_BUSY,
    };
  }

  try {
    const diagnosticPath = diagnosticPathFromExecutionKey(executionKey);
    const payload = buildManagedAutofillPayload({
      url: input.url,
      allowedOrigin: input.allowedOrigin,
      fieldMappings: input.fieldMappings,
      credentials: input.credentials,
      diagnosticPath,
    });
    payload.runId = fillRun.token;

    logManagedDev('[Managed Autofill] Hub: sending explicit mappings', {
      type: HUB_MANAGED_AUTOFILL_MESSAGE,
      url: input.url,
      allowedOrigin: input.allowedOrigin,
      fieldIds: input.fieldMappings.map((mapping) => mapping.fieldId),
      extensionAvailable: isExtensionAvailable(),
      executionKeyPresent: true,
      diagnosticPath,
    });

    if (!isExtensionAvailable()) {
      openUrlInNewTab(input.url);
      return {
        ok: false,
        reason: 'extension_unavailable',
        tabOpened: true,
        extensionUsed: false,
        userMessage: MSG_MANAGED_EXTENSION_UNAVAILABLE,
      };
    }

    const raced = await fillRun.race(
      sendExtensionMessageAsync<{
        ok?: boolean;
        reason?: string;
        filled?: number;
        fieldId?: string;
        locator?: string;
        detail?: string;
        fillDiagnostics?: ManagedFillDiagnostics;
      }>(payload),
    );

    if (raced.kind !== 'answer') {
      const reason = raced.kind === 'cancelled' ? 'cancelled' : FILL_RUN_TIMEOUT_REASON;
      logManagedDev('[Managed Autofill] Hub: run ended without an answer', { reason });
      return {
        ok: false,
        reason,
        tabOpened: true,
        extensionUsed: true,
        userMessage: userMessageForManagedFailure(reason, diagnosticPath),
      };
    }
    const response = raced.value;

    if (!response) {
      logManagedDev('[Managed Autofill] Hub: no extension response — opening Login Entry');
      openUrlInNewTab(input.url);
      return {
        ok: false,
        reason: 'extension_unavailable',
        tabOpened: true,
        extensionUsed: false,
        userMessage: MSG_MANAGED_EXTENSION_UNAVAILABLE,
      };
    }

    const fillDiagnostics = readFillDiagnostics(response);
    if (fillDiagnostics) {
      logManagedDev('[Managed Autofill] Hub: A2 fillDiagnostics', {
        runId: fillDiagnostics.runId,
        path: fillDiagnostics.path,
        stampCount: fillDiagnostics.stamps.length,
      });
    }

    if (response.ok === true) {
      return {
        ok: true,
        filled: typeof response.filled === 'number' ? response.filled : undefined,
        tabOpened: true,
        extensionUsed: true,
        userMessage: MSG_MANAGED_FILL_OK,
        fillDiagnostics,
      };
    }

    const reason = typeof response.reason === 'string' ? response.reason : 'managed_failed';
    const tabOpened = !TAB_NOT_OPENED_REASONS.has(reason);
    if (!tabOpened) {
      openUrlInNewTab(input.url);
      logManagedDev('[Managed Autofill] Hub: open/fill failed before tab', { reason });
      return {
        ok: false,
        reason: 'open_failed',
        fieldId: typeof response.fieldId === 'string' ? response.fieldId : undefined,
        locator: typeof response.locator === 'string' ? response.locator : undefined,
        detail: typeof response.detail === 'string' ? response.detail : undefined,
        tabOpened: true,
        extensionUsed: true,
        userMessage: MSG_MANAGED_OPEN_FAILED,
        fillDiagnostics,
      };
    }

    logManagedDev('[Managed Autofill] Hub: fill failed after tab open', {
      reason,
      fieldId: typeof response.fieldId === 'string' ? response.fieldId : undefined,
      detail: typeof response.detail === 'string' ? response.detail : undefined,
    });
    return {
      ok: false,
      reason,
      fieldId: typeof response.fieldId === 'string' ? response.fieldId : undefined,
      locator: typeof response.locator === 'string' ? response.locator : undefined,
      detail: typeof response.detail === 'string' ? response.detail : undefined,
      tabOpened: true,
      extensionUsed: true,
      userMessage: userMessageForManagedFailure(reason, diagnosticPath),
      fillDiagnostics,
    };
  } finally {
    fillRun.release();
  }
}

export function serviceIsManagedAutofillEligible(
  service: Service,
  credential: Credential | undefined,
  loginFields: LoginField[],
): boolean {
  return isManagedAutofillEligible({
    metadata: service.metadata,
    loginFields,
    credential,
  });
}

/** True when Admin marked Managed Autofill validated (version-matched). */
export function serviceHasValidatedManagedProfile(service: Service): boolean {
  return isVersionMatchedValidated(readAutofillProfileFromMetadata(service.metadata));
}

/**
 * True when metadata claims supportState=validated (even if version-mismatched).
 * Used to fail closed — never fall through to legacy/generic for these services.
 */
export function serviceClaimsValidatedManagedProfile(service: Service): boolean {
  const profile = readAutofillProfileFromMetadata(service.metadata);
  return profile?.supportState === 'validated';
}

export function readManagedLoginEntryUrl(service: Service): string | null {
  const profile = readAutofillProfileFromMetadata(service.metadata);
  if (!profile) {
    return null;
  }
  const url = profile.loginEntryUrl.trim();
  return url || null;
}

/**
 * Digital Home Managed Autofill — production eligibility gate unchanged (D-120-13).
 * After eligibility, converges on sendManagedAutofillPayloadAndAwait (D-120-12).
 */
export async function executeManagedAutofill(
  service: Service,
  credential: Credential,
  loginFields: LoginField[],
  options: ManagedAutofillOptions = {},
): Promise<ManagedAutofillResult> {
  const serviceId = typeof service.id === 'string' ? service.id.trim() : '';
  const accessProfileId =
    typeof options.accessProfileId === 'string' ? options.accessProfileId.trim() : '';

  if (!serviceId || !accessProfileId) {
    return {
      ok: false,
      reason: 'not_eligible',
      userMessage: MSG_MANAGED_NOT_READY,
      tabOpened: false,
      extensionUsed: false,
    };
  }

  if (!serviceIsManagedAutofillEligible(service, credential, loginFields)) {
    return {
      ok: false,
      reason: 'not_eligible',
      userMessage: MSG_MANAGED_NOT_READY,
      tabOpened: false,
      extensionUsed: false,
    };
  }

  const profile = readAutofillProfileFromMetadata(service.metadata);
  if (!profile) {
    return {
      ok: false,
      reason: 'not_eligible',
      userMessage: MSG_MANAGED_NOT_READY,
      tabOpened: false,
      extensionUsed: false,
    };
  }

  const url = profile.loginEntryUrl.trim() || getServiceOpenUrl(service);
  const outcome = await sendManagedAutofillPayloadAndAwait({
    url,
    allowedOrigin: profile.allowedOrigin,
    fieldMappings: profile.fieldMappings,
    credentials: credential,
    executionKey: managedAutofillExecutionKey(serviceId, accessProfileId),
  });

  if (outcome.ok) {
    return {
      ok: true,
      extensionUsed: true,
      userMessage: outcome.userMessage,
      tabOpened: true,
    };
  }

  let mappedReason:
    | 'not_eligible'
    | 'extension_unavailable'
    | 'open_failed'
    | 'fill_failed'
    | 'managed_failed'
    | 'busy' = 'fill_failed';
  if (outcome.reason === 'busy') mappedReason = 'busy';
  else if (outcome.reason === 'extension_unavailable') mappedReason = 'extension_unavailable';
  else if (outcome.reason === 'open_failed') mappedReason = 'open_failed';
  else if (outcome.reason === 'not_eligible') mappedReason = 'not_eligible';

  return {
    ok: false,
    reason: mappedReason,
    userMessage: outcome.userMessage,
    tabOpened: outcome.tabOpened,
    extensionUsed: outcome.extensionUsed,
  };
}

export const MSG_ADMIN_MANAGED_TEST_INCOMPLETE =
  'יש למלא ערך זמני לכל שדה כניסה לפני הבדיקה.';

export const MSG_ADMIN_MANAGED_TEST_NO_SAVED =
  'יש לשמור מיפוי מנוהל לפני בדיקה.';

/**
 * Phase 120.5 — Admin-only Managed Autofill Test Harness (D-120-13).
 * Uses SAVED mappings + temporary Admin credentials. Does NOT require validated.
 * Does NOT stamp supportState / validation / vault. Converges on same Ext path (D-120-12).
 */
export async function executeAdminManagedAutofillTest(input: {
  serviceId: string;
  savedProfile: AutofillProfile;
  loginFields: LoginField[];
  tempCredentials: Credential;
}): Promise<ManagedAutofillStructuredOutcome> {
  const serviceId = input.serviceId.trim();
  const profile = input.savedProfile;
  const mappings = profile.fieldMappings.filter((m) => m.fieldId.trim() && m.locator.trim());
  const loginEntryUrl = profile.loginEntryUrl.trim();
  const allowedOrigin = profile.allowedOrigin.trim();

  if (!serviceId || mappings.length === 0 || !loginEntryUrl || !allowedOrigin) {
    return {
      ok: false,
      reason: 'not_eligible',
      tabOpened: false,
      extensionUsed: false,
      userMessage: MSG_ADMIN_MANAGED_TEST_NO_SAVED,
    };
  }

  for (const field of input.loginFields) {
    const value = input.tempCredentials[field.id];
    if (typeof value !== 'string' || !value.trim()) {
      return {
        ok: false,
        reason: 'not_eligible',
        tabOpened: false,
        extensionUsed: false,
        userMessage: MSG_ADMIN_MANAGED_TEST_INCOMPLETE,
      };
    }
  }

  // Convergence: same payload shape + same Ext Managed orchestrator as Digital Home.
  return sendManagedAutofillPayloadAndAwait({
    url: loginEntryUrl,
    allowedOrigin,
    fieldMappings: mappings,
    credentials: input.tempCredentials,
    executionKey: adminManagedTestExecutionKey(serviceId),
  });
}

/** Format Admin-visible structured result — fieldId / detail / locator / reason only. */
export function formatAdminManagedTestResultSummary(
  outcome: ManagedAutofillStructuredOutcome,
): string {
  if (outcome.ok || fillRunEndMessage(outcome.reason, 'admin_test')) {
    return outcome.userMessage;
  }
  const parts: string[] = [outcome.userMessage];
  if (outcome.reason) {
    parts.push(outcome.reason);
  }
  if (outcome.fieldId) {
    parts.push(`שדה ${outcome.fieldId}`);
  }
  if (outcome.detail) {
    parts.push(outcome.detail);
  }
  if (outcome.locator) {
    parts.push(outcome.locator);
  }
  return parts.join(' · ');
}

/**
 * A2 — format structural fillDiagnostics for Operator copy (no credential values).
 * Returns empty string when absent.
 */
export function formatManagedFillDiagnosticsForOperator(
  outcome: ManagedAutofillStructuredOutcome,
): string {
  if (!outcome.fillDiagnostics) {
    return '';
  }
  try {
    return JSON.stringify(outcome.fillDiagnostics, null, 2);
  } catch {
    return '';
  }
}
