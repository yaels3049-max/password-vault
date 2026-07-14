import type { Credential } from '../credentials';
import type { LoginField } from '../mockServices';
import {
  getExtensionId,
  isExtensionAvailable,
  openUrlInNewTab,
  sendExtensionMessageAsync,
} from '../execution/extensionBridge';
import { mapMediumOutcomeToUserStatus, type MediumFailureClass } from './mediumStatus';
import {
  isPhase112MediumFeatureEnabled,
  matchSupportedMediumSite,
} from './supportedMediumSites';

export interface MediumAssistResult {
  extensionUsed: boolean;
  autofillAttempted: boolean;
  userMessage: string;
  mode: 'identity_first';
  success: boolean;
  failureClass: MediumFailureClass | null;
  /** Diagnostic only — never shown as raw stack to users */
  diagnosticReason?: string | null;
  /** BD-112-4 — which profile drove the attempt */
  activeProfileId?: string | null;
  /** BD-112-5 — whether a supported / matched site was selected */
  supportedSiteId?: string | null;
  filled?: number;
}

function hasIdentityCredential(
  credential: Credential | undefined,
  loginFields: LoginField[],
): boolean {
  if (!credential) return false;
  for (const field of loginFields) {
    if (field.type === 'password') continue;
    const value = credential[field.id];
    if (typeof value === 'string' && value.trim()) {
      return true;
    }
  }
  return false;
}

function logMediumDiagnostic(event: string, detail: Record<string, unknown>): void {
  // Never log credential values (D-112-24 / no leakage).
  const safe = { ...detail };
  delete safe.credentials;
  delete safe.password;
  delete safe.username;
  delete safe.email;
  if (import.meta.env.DEV) {
    console.log(`[Phase112 Medium] ${event}`, safe);
  } else {
    console.info(`[Phase112 Medium] ${event}`, safe);
  }
}

/**
 * Phase 112 M9+M10 — medium step-1 identity fill with explicit AC-112-26 status.
 * Awaits extension result — never silent open-only.
 */
export async function executeMediumAssist(
  openUrl: string,
  credential: Credential | undefined,
  loginFields: LoginField[],
  options?: { activeProfileId?: string | null; serviceId?: string },
): Promise<MediumAssistResult> {
  const activeProfileId = options?.activeProfileId ?? null;
  const serviceId = options?.serviceId;

  const baseMeta = {
    activeProfileId,
    serviceId: serviceId ?? null,
    openHost: (() => {
      try {
        return new URL(openUrl).hostname;
      } catch {
        return null;
      }
    })(),
  };

  if (!isPhase112MediumFeatureEnabled()) {
    openUrlInNewTab(openUrl);
    const mapped = mapMediumOutcomeToUserStatus({ unsupportedSite: true });
    logMediumDiagnostic('feature_off', { ...baseMeta, failureClass: mapped.failureClass });
    return {
      extensionUsed: false,
      autofillAttempted: false,
      userMessage: mapped.userMessage,
      mode: 'identity_first',
      success: false,
      failureClass: mapped.failureClass,
      diagnosticReason: 'feature_off',
      activeProfileId,
    };
  }

  if (!activeProfileId) {
    openUrlInNewTab(openUrl);
    const mapped = mapMediumOutcomeToUserStatus({ profileMissing: true });
    logMediumDiagnostic('profile_missing', { ...baseMeta, failureClass: mapped.failureClass });
    return {
      extensionUsed: false,
      autofillAttempted: false,
      userMessage: mapped.userMessage,
      mode: 'identity_first',
      success: false,
      failureClass: mapped.failureClass,
      diagnosticReason: 'profile_missing',
      activeProfileId,
    };
  }

  if (!hasIdentityCredential(credential, loginFields)) {
    openUrlInNewTab(openUrl);
    const mapped = mapMediumOutcomeToUserStatus({ noIdentityCredential: true });
    logMediumDiagnostic('no_identity_credential', {
      ...baseMeta,
      failureClass: mapped.failureClass,
      identityFieldIds: loginFields.filter((f) => f.type !== 'password').map((f) => f.id),
    });
    return {
      extensionUsed: false,
      autofillAttempted: false,
      userMessage: mapped.userMessage,
      mode: 'identity_first',
      success: false,
      failureClass: mapped.failureClass,
      diagnosticReason: 'no_identity_credential',
      activeProfileId,
    };
  }

  const supported = matchSupportedMediumSite(openUrl, serviceId);
  if (!supported) {
    openUrlInNewTab(openUrl);
    const mapped = mapMediumOutcomeToUserStatus({ unsupportedSite: true });
    logMediumDiagnostic('unsupported_site', { ...baseMeta, failureClass: mapped.failureClass });
    return {
      extensionUsed: false,
      autofillAttempted: false,
      userMessage: mapped.userMessage,
      mode: 'identity_first',
      success: false,
      failureClass: mapped.failureClass,
      diagnosticReason: 'unsupported_site',
      activeProfileId,
      supportedSiteId: null,
    };
  }

  if (!isExtensionAvailable() || !getExtensionId()) {
    openUrlInNewTab(openUrl);
    const mapped = mapMediumOutcomeToUserStatus({ extensionMissing: true });
    logMediumDiagnostic('extension_missing', { ...baseMeta, failureClass: mapped.failureClass });
    return {
      extensionUsed: false,
      autofillAttempted: true,
      userMessage: mapped.userMessage,
      mode: 'identity_first',
      success: false,
      failureClass: mapped.failureClass,
      diagnosticReason: 'extension_missing',
      activeProfileId,
      supportedSiteId: supported.id,
    };
  }

  const vaultCredentials: Credential = {};
  for (const field of loginFields) {
    const raw = credential![field.id];
    if (typeof raw === 'string' && raw.trim()) {
      vaultCredentials[field.id] = raw.trim();
    }
  }

  const payload = {
    type: 'POC_IDENTITY_FIRST_FILL',
    url: openUrl,
    loginFields,
    credentials: vaultCredentials,
  };

  logMediumDiagnostic('attempt_start', {
    ...baseMeta,
    supportedSiteId: supported.id,
    fieldIds: loginFields.map((f) => f.id),
  });

  const response = await sendExtensionMessageAsync<{
    ok?: boolean;
    reason?: string;
    filled?: number;
    passwordAbsent?: boolean;
    via?: string;
  }>(payload);

  if (response === null) {
    // Message send failed or chrome lastError — may still have opened via other paths
    openUrlInNewTab(openUrl);
    const mapped = mapMediumOutcomeToUserStatus({
      extensionMissing: false,
      reason: 'script_injection_failed',
    });
    logMediumDiagnostic('null_extension_response', {
      ...baseMeta,
      supportedSiteId: supported.id,
      failureClass: mapped.failureClass,
    });
    return {
      extensionUsed: false,
      autofillAttempted: true,
      userMessage: mapped.userMessage,
      mode: 'identity_first',
      success: false,
      failureClass: mapped.failureClass,
      diagnosticReason: 'null_extension_response',
      activeProfileId,
      supportedSiteId: supported.id,
    };
  }

  const mapped = mapMediumOutcomeToUserStatus({
    ok: response.ok === true,
    reason: response.reason ?? null,
    filled: typeof response.filled === 'number' ? response.filled : 0,
  });

  logMediumDiagnostic(mapped.success ? 'step1_filled' : 'step1_failed', {
    ...baseMeta,
    supportedSiteId: supported.id,
    ok: response.ok,
    reason: response.reason ?? null,
    filled: response.filled ?? 0,
    passwordAbsent: response.passwordAbsent ?? null,
    failureClass: mapped.failureClass,
    pageDetected: response.reason !== 'identity_step_not_found' && response.reason !== 'form_not_found',
  });

  return {
    extensionUsed: true,
    autofillAttempted: true,
    userMessage: mapped.userMessage,
    mode: 'identity_first',
    success: mapped.success,
    failureClass: mapped.failureClass,
    diagnosticReason: response.reason ?? null,
    activeProfileId,
    supportedSiteId: supported.id,
    filled: typeof response.filled === 'number' ? response.filled : 0,
  };
}
