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

export interface ManagedAutofillOptions {
  /** Digital Home access profile id — part of D-117-20 execution key (no secrets). */
  accessProfileId?: string | null;
}

/**
 * D-117-20 / AC-117-36 — in-flight keys are `(serviceId, accessProfileId)` only.
 * No credential/field/selector secrets. No global Managed busy boolean.
 */
const managedAutofillInFlightKeys = new Set<string>();

/** Stable execution key — serviceId + accessProfileId only (no secrets). */
export function managedAutofillExecutionKey(
  serviceId: string,
  accessProfileId: string,
): string {
  return `${serviceId.trim()}::${accessProfileId.trim()}`;
}

export function isManagedAutofillInFlightFor(
  serviceId: string,
  accessProfileId: string,
): boolean {
  if (!serviceId.trim() || !accessProfileId.trim()) {
    return false;
  }
  return managedAutofillInFlightKeys.has(
    managedAutofillExecutionKey(serviceId, accessProfileId),
  );
}

/** Test/diagnostics: how many Managed executions are currently in flight. */
export function managedAutofillInFlightCount(): number {
  return managedAutofillInFlightKeys.size;
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

function buildManagedPayload(
  profile: AutofillProfile,
  credential: Credential,
  url: string,
): Record<string, unknown> {
  const vaultCredentials: Credential = {};
  for (const mapping of profile.fieldMappings) {
    const value = credential[mapping.fieldId];
    if (typeof value === 'string' && value.trim()) {
      vaultCredentials[mapping.fieldId] = value.trim();
    }
  }

  return {
    type: HUB_MANAGED_AUTOFILL_MESSAGE,
    url,
    allowedOrigin: profile.allowedOrigin,
    fieldMappings: profile.fieldMappings.map((mapping) => ({
      fieldId: mapping.fieldId,
      locatorType: mapping.locatorType,
      locator: mapping.locator,
    })),
    credentials: vaultCredentials,
  };
}

/**
 * Deterministic Managed Autofill. Waits for extension structured result.
 * Does not invoke heuristic generic fill.
 * AC-117-36: dedupe by (serviceId, accessProfileId) only — no global busy lock.
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

  const executionKey = managedAutofillExecutionKey(serviceId, accessProfileId);
  if (managedAutofillInFlightKeys.has(executionKey)) {
    return {
      ok: false,
      reason: 'busy',
      userMessage: MSG_MANAGED_BUSY,
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

  managedAutofillInFlightKeys.add(executionKey);
  try {
    const url = profile.loginEntryUrl.trim() || getServiceOpenUrl(service);
    const payload = buildManagedPayload(profile, credential, url);

    logManagedDev('[Managed Autofill] Hub: sending explicit mappings', {
      type: HUB_MANAGED_AUTOFILL_MESSAGE,
      url,
      allowedOrigin: profile.allowedOrigin,
      fieldIds: profile.fieldMappings.map((mapping) => mapping.fieldId),
      extensionAvailable: isExtensionAvailable(),
      executionKeyPresent: true,
    });

    if (!isExtensionAvailable()) {
      openUrlInNewTab(url);
      return {
        ok: false,
        reason: 'extension_unavailable',
        userMessage: MSG_MANAGED_EXTENSION_UNAVAILABLE,
        tabOpened: true,
        extensionUsed: false,
      };
    }

    const response = await sendExtensionMessageAsync<{
      ok?: boolean;
      reason?: string;
      filled?: number;
    }>(payload);

    if (!response) {
      logManagedDev('[Managed Autofill] Hub: no extension response — opening Login Entry');
      openUrlInNewTab(url);
      return {
        ok: false,
        reason: 'extension_unavailable',
        userMessage: MSG_MANAGED_EXTENSION_UNAVAILABLE,
        tabOpened: true,
        extensionUsed: false,
      };
    }

    if (response.ok === true) {
      return {
        ok: true,
        extensionUsed: true,
        userMessage: MSG_MANAGED_FILL_OK,
        tabOpened: true,
      };
    }

    const reason = typeof response.reason === 'string' ? response.reason : 'managed_failed';
    const tabOpened = !TAB_NOT_OPENED_REASONS.has(reason);
    if (!tabOpened) {
      openUrlInNewTab(url);
      logManagedDev('[Managed Autofill] Hub: open/fill failed before tab', { reason });
      return {
        ok: false,
        reason: 'open_failed',
        userMessage: MSG_MANAGED_OPEN_FAILED,
        tabOpened: true,
        extensionUsed: true,
      };
    }

    logManagedDev('[Managed Autofill] Hub: fill failed after tab open', { reason });
    return {
      ok: false,
      reason: 'fill_failed',
      userMessage: MSG_MANAGED_FILL_FAILED,
      tabOpened: true,
      extensionUsed: true,
    };
  } finally {
    // Clear on EVERY terminal outcome (success, failure, unavailable, unexpected).
    managedAutofillInFlightKeys.delete(executionKey);
  }
}
