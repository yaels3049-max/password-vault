import type { Credential } from '../credentials';
import { hasCompleteCredentials } from '../credentials';
import {
  getLoginFields,
  getServiceOpenUrl,
  hasConfiguredLoginFields,
  type LoginField,
  type Service,
} from '../mockServices';
import { getServiceAdapter, isSiteSpecificAdapter } from './adapters/registry';
import {
  shouldAttemptGenericAutofill,
  type AutofillHealthCode,
} from './autofillEligibility';
import { executeGenericAutofill } from './genericAutofill';
import {
  executeManagedAutofill,
  MSG_MANAGED_NOT_READY,
  readManagedLoginEntryUrl,
  serviceClaimsValidatedManagedProfile,
  serviceHasValidatedManagedProfile,
  serviceIsManagedAutofillEligible,
} from './managedAutofill';
import { openUrlInNewTab } from './extensionBridge';
import {
  complexityForExecution,
  executeMediumAssist,
  hebrewMessageForComplexity,
  resolveLoginIntelligenceForExecution,
} from '../loginIntelligence';
import { AC112_26_HEBREW } from '../loginIntelligence/mediumStatus';
import {
  resolveActiveLoginContract,
  resolveSpecialAuthoringEntry,
  type ResolvedActiveLoginContract,
} from '../loginContract';
import { buildSpecialCredentialSubset, executeDigitalHomeSpecialLoginFlow } from './specialLoginFlow';
import { specialEndUserMessage } from './specialLoginFlowMessages';

const MISSING_CREDENTIALS_MESSAGE =
  'הגדירו פרטי כניסה במסך «ניהול האתרים» — לחצו «הוסף אתרים נוספים».';

const FILL_UNAVAILABLE_MESSAGE =
  'האתר נפתח. מילוי אוטומטי לא זמין כרגע — ניתן למלא את השדות ידנית.';

export type ServiceExecutionStatus =
  | 'ok'
  | 'credentials_missing'
  | 'open_only';

export interface ServiceExecutionOptions {
  /** BD-112-4 — active Digital Home profile id for medium attempts */
  activeProfileId?: string | null;
}

export interface ServiceExecutionResult {
  status: ServiceExecutionStatus;
  extensionUsed: boolean;
  autofillAttempted: boolean;
  userMessage?: string;
  /** Non-sensitive signal for UX / Phase 112 (D-110-10). Never blocks open. */
  metadataHealth?: AutofillHealthCode;
  /** Medium attempt outcome — success shows BD-112-3 activity */
  mediumSuccess?: boolean;
}

/** Phase 121.2 RT-3.3 — §4.7 entry for SPECIAL services (fallback: the tile open URL). */
function specialEntryOpenUrl(service: Service): string {
  const entry = resolveSpecialAuthoringEntry({
    primaryUrl: service.url,
    loginUrl: service.loginUrl,
    metadata: service.metadata ?? null,
  });
  return entry.ok ? entry.authoringUrl : getServiceOpenUrl(service);
}

/** SPECIAL_INVALID — open the entry only; no fill of any kind, no STANDARD fallback. */
function failClosedSpecialInvalid(service: Service): ServiceExecutionResult {
  openUrlInNewTab(specialEntryOpenUrl(service));
  return {
    status: 'open_only',
    extensionUsed: false,
    autofillAttempted: false,
    userMessage: specialEndUserMessage({ ok: false, reason: 'special_contract_invalid' }),
    metadataHealth: 'fill_failed',
  };
}

async function runSpecialFromTile(
  service: Service,
  credential: Credential | undefined,
  options: ServiceExecutionOptions,
  contract: Extract<ResolvedActiveLoginContract, { mode: 'SPECIAL' }>,
): Promise<ServiceExecutionResult> {
  if (!credential || !buildSpecialCredentialSubset(contract.plan, credential).ok) {
    openUrlInNewTab(specialEntryOpenUrl(service));
    return {
      status: 'credentials_missing',
      extensionUsed: false,
      autofillAttempted: false,
      userMessage: MISSING_CREDENTIALS_MESSAGE,
    };
  }
  const outcome = await executeDigitalHomeSpecialLoginFlow(
    service,
    credential,
    options.activeProfileId ?? '',
  );
  if (outcome.ok) {
    return {
      status: 'ok',
      extensionUsed: true,
      autofillAttempted: true,
      userMessage: specialEndUserMessage(outcome),
    };
  }
  if (!outcome.tabOpened) {
    openUrlInNewTab(specialEntryOpenUrl(service));
  }
  return {
    status: 'open_only',
    extensionUsed: outcome.extensionUsed,
    autofillAttempted: true,
    userMessage: specialEndUserMessage(outcome),
    metadataHealth: 'fill_failed',
  };
}

/**
 * Phase 103 unified tile execution (async) — orchestration shell unchanged:
 * 1. openUrl = loginUrl ?? primaryUrl
 * 2. Site-specific adapters (practice) only
 * 3. Soft-read Login Intelligence (Phase 112): basic→110, medium→112 async identity-first,
 *    complex→open(+guidance). Medium never silent (AC-112-26).
 * 4. Failure never blocks navigation; no auto-submit
 */
export async function executeServiceFromTile(
  service: Service,
  credential: Credential | undefined,
  loginFields: LoginField[] = getLoginFields(service),
  options: ServiceExecutionOptions = {},
): Promise<ServiceExecutionResult> {
  const contract = resolveActiveLoginContract(service.metadata ?? {});
  if (contract.mode === 'SPECIAL') return runSpecialFromTile(service, credential, options, contract);
  if (contract.mode === 'SPECIAL_INVALID') return failClosedSpecialInvalid(service);

  const openUrl = getServiceOpenUrl(service);
  const adapterId = service.adapterId?.trim();

  if (adapterId && isSiteSpecificAdapter(adapterId)) {
    const adapter = getServiceAdapter(adapterId);
    if (!adapter) {
      openUrlInNewTab(openUrl);
      return {
        status: 'open_only',
        extensionUsed: false,
        autofillAttempted: false,
      };
    }

    const adapterResult = adapter.execute({
      service,
      openUrl,
      credential,
      loginFields,
    });

    if (!adapterResult.ok) {
      openUrlInNewTab(openUrl);
      return {
        status: 'credentials_missing',
        extensionUsed: false,
        autofillAttempted: false,
        userMessage: MISSING_CREDENTIALS_MESSAGE,
      };
    }

    return {
      status: 'ok',
      extensionUsed: adapterResult.extensionUsed,
      autofillAttempted: adapterResult.autofillAttempted,
    };
  }

  // Validated Managed claim OR ready eligibility — never fall through to legacy/generic.
  if (
    serviceClaimsValidatedManagedProfile(service) ||
    serviceHasValidatedManagedProfile(service) ||
    serviceIsManagedAutofillEligible(service, credential, loginFields)
  ) {
    if (!credential) {
      const managedUrl = readManagedLoginEntryUrl(service) ?? openUrl;
      openUrlInNewTab(managedUrl);
      return {
        status: 'credentials_missing',
        extensionUsed: false,
        autofillAttempted: false,
        userMessage: MISSING_CREDENTIALS_MESSAGE,
      };
    }

    // Version mismatch / incomplete mapping / incomplete credentials: fail closed.
    if (!serviceIsManagedAutofillEligible(service, credential, loginFields)) {
      const managedUrl = readManagedLoginEntryUrl(service) ?? openUrl;
      openUrlInNewTab(managedUrl);
      return {
        status: 'open_only',
        extensionUsed: false,
        autofillAttempted: true,
        userMessage: MSG_MANAGED_NOT_READY,
        metadataHealth: 'fill_failed',
      };
    }

    const managed = await executeManagedAutofill(service, credential, loginFields, {
      accessProfileId: options.activeProfileId,
    });
    if (managed.ok) {
      return {
        status: 'ok',
        extensionUsed: managed.extensionUsed,
        autofillAttempted: true,
        userMessage: managed.userMessage,
      };
    }
    return {
      status: 'open_only',
      extensionUsed: managed.extensionUsed,
      autofillAttempted: true,
      userMessage: managed.userMessage,
      metadataHealth: 'fill_failed',
    };
  }

  const li =
    service.loginIntelligence ??
    resolveLoginIntelligenceForExecution(service.metadata);
  const complexity = complexityForExecution(li);

  if (complexity === 'complex') {
    openUrlInNewTab(openUrl);
    return {
      status: 'open_only',
      extensionUsed: false,
      autofillAttempted: false,
      // Distinguish complex/unsupported from generic open (AC-112-26 category 4 spirit)
      userMessage: AC112_26_HEBREW.website_not_supported,
      metadataHealth: 'not_standard_login',
    };
  }

  if (complexity === 'medium') {
    const medium = await executeMediumAssist(openUrl, credential, loginFields, {
      activeProfileId: options.activeProfileId,
      serviceId: service.id,
    });
    return {
      status: medium.success ? 'ok' : 'open_only',
      extensionUsed: medium.extensionUsed,
      autofillAttempted: medium.autofillAttempted,
      userMessage: medium.userMessage,
      metadataHealth: medium.success ? undefined : 'fill_failed',
      mediumSuccess: medium.success,
    };
  }

  if (shouldAttemptGenericAutofill(service, credential, loginFields)) {
    if (complexity === 'unknown' || complexity === 'basic') {
      const fillResult = executeGenericAutofill(openUrl, credential, loginFields);
      if (fillResult.ok && !fillResult.extensionUsed) {
        return {
          status: 'ok',
          extensionUsed: false,
          autofillAttempted: true,
          metadataHealth: 'fill_failed',
          userMessage: FILL_UNAVAILABLE_MESSAGE,
        };
      }
      return {
        status: 'ok',
        extensionUsed: fillResult.ok && fillResult.extensionUsed,
        autofillAttempted: true,
      };
    }
  }

  openUrlInNewTab(openUrl);

  if (
    hasConfiguredLoginFields(service) &&
    !hasCompleteCredentials(credential, loginFields)
  ) {
    return {
      status: 'credentials_missing',
      extensionUsed: false,
      autofillAttempted: false,
      userMessage: MISSING_CREDENTIALS_MESSAGE,
    };
  }

  return {
    status: 'open_only',
    extensionUsed: false,
    autofillAttempted: false,
    userMessage:
      complexity === 'unknown' ? hebrewMessageForComplexity('unknown') : undefined,
  };
}
