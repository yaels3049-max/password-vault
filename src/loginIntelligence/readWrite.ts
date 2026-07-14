import type { LoginDetectionConfidence, LoginIntelligence, LastValidatedBy } from './types';
import { isLoginComplexity, isIntegrationHealth, isAdapterLifecycle } from './types';
import { LOGIN_DETECTION_ENGINE_VERSION } from './types';

/** Whether automatic classification may replace an existing LI snapshot. */
export function canAutoApplyClassification(
  existing: LoginIntelligence | null,
  confidence: LoginDetectionConfidence,
): { apply: boolean; reason: string } {
  if (existing?.loginIntelligenceAdminOverride || existing?.lastValidatedBy === 'admin') {
    return { apply: false, reason: 'admin_override_protected' };
  }

  if (confidence === 'low') {
    if (existing && existing.lastValidatedBy !== 'auto') {
      return { apply: false, reason: 'low_confidence_preserves_verified' };
    }
    // Low may still seed empty / unknown rows
    if (existing && existing.loginComplexity !== 'unknown') {
      return { apply: false, reason: 'low_confidence_no_replace' };
    }
  }

  if (confidence === 'medium' && existing?.lastValidatedBy === 'adapter') {
    return { apply: false, reason: 'medium_confidence_preserves_adapter' };
  }

  return { apply: true, reason: 'ok' };
}

export function readLoginIntelligence(
  metadata: Record<string, unknown> | null | undefined,
): LoginIntelligence | null {
  if (!metadata) return null;
  const complexity = metadata.loginComplexity;
  if (!isLoginComplexity(complexity)) {
    return null;
  }

  const lastValidatedBy = metadata.lastValidatedBy;
  const validated: LastValidatedBy =
    lastValidatedBy === 'admin' || lastValidatedBy === 'adapter' || lastValidatedBy === 'auto'
      ? lastValidatedBy
      : 'auto';

  return {
    loginComplexity: complexity,
    loginFlowType:
      typeof metadata.loginFlowType === 'string'
        ? (metadata.loginFlowType as LoginIntelligence['loginFlowType'])
        : 'unknown',
    loginDetectionStatus:
      typeof metadata.loginDetectionStatus === 'string'
        ? (metadata.loginDetectionStatus as LoginIntelligence['loginDetectionStatus'])
        : 'pending',
    loginDetectionConfidence:
      metadata.loginDetectionConfidence === 'high' ||
      metadata.loginDetectionConfidence === 'medium' ||
      metadata.loginDetectionConfidence === 'low'
        ? metadata.loginDetectionConfidence
        : 'low',
    loginDetectionLastCheckedAt:
      typeof metadata.loginDetectionLastCheckedAt === 'string'
        ? metadata.loginDetectionLastCheckedAt
        : null,
    loginDetectionError:
      typeof metadata.loginDetectionError === 'string' ? metadata.loginDetectionError : null,
    loginDetectionEngineVersion:
      typeof metadata.loginDetectionEngineVersion === 'string'
        ? metadata.loginDetectionEngineVersion
        : LOGIN_DETECTION_ENGINE_VERSION,
    lastValidatedBy: validated,
    adapterRecommended: Boolean(metadata.adapterRecommended),
    adapterReason: typeof metadata.adapterReason === 'string' ? metadata.adapterReason : null,
    adapterLifecycle: isAdapterLifecycle(metadata.adapterLifecycle)
      ? metadata.adapterLifecycle
      : null,
    integrationHealth: isIntegrationHealth(metadata.integrationHealth)
      ? metadata.integrationHealth
      : 'needs_review',
    supportedCredentialFields: Array.isArray(metadata.supportedCredentialFields)
      ? metadata.supportedCredentialFields.filter((x): x is string => typeof x === 'string')
      : [],
    federatedLoginOptions: Array.isArray(metadata.federatedLoginOptions)
      ? (metadata.federatedLoginOptions.filter((x) => typeof x === 'string') as LoginIntelligence['federatedLoginOptions'])
      : [],
    requiresOtp: Boolean(metadata.requiresOtp),
    requiresCaptcha: Boolean(metadata.requiresCaptcha),
    usesIframe: Boolean(metadata.usesIframe),
    usesModal: Boolean(metadata.usesModal),
    isMultiStep: Boolean(metadata.isMultiStep),
    loginIntelligenceAdminOverride: Boolean(metadata.loginIntelligenceAdminOverride),
  };
}

/** Merge LI into metadata without wiping Phase 108 / 111 keys. */
export function loginIntelligenceToMetadataPatch(
  li: LoginIntelligence,
): Record<string, unknown> {
  return {
    loginComplexity: li.loginComplexity,
    loginFlowType: li.loginFlowType,
    loginDetectionStatus: li.loginDetectionStatus,
    loginDetectionConfidence: li.loginDetectionConfidence,
    loginDetectionLastCheckedAt: li.loginDetectionLastCheckedAt,
    loginDetectionError: li.loginDetectionError,
    loginDetectionEngineVersion: li.loginDetectionEngineVersion,
    lastValidatedBy: li.lastValidatedBy,
    adapterRecommended: li.adapterRecommended,
    adapterReason: li.adapterReason,
    adapterLifecycle: li.adapterLifecycle,
    integrationHealth: li.integrationHealth,
    supportedCredentialFields: li.supportedCredentialFields,
    federatedLoginOptions: li.federatedLoginOptions,
    requiresOtp: li.requiresOtp,
    requiresCaptcha: li.requiresCaptcha,
    usesIframe: li.usesIframe,
    usesModal: li.usesModal,
    isMultiStep: li.isMultiStep,
    loginIntelligenceAdminOverride: Boolean(li.loginIntelligenceAdminOverride),
  };
}

/**
 * Build PageSignals seed from Phase 108 metadata alone (no live DOM).
 * Used for admin refresh when extension detect is unavailable.
 */
export function signalsFromDiscoveryMetadata(
  metadata: Record<string, unknown> | null | undefined,
): import('./types').LoginPageSignals {
  const meta = metadata ?? {};
  return {
    phase112Deferred: meta.phase112Deferred === true,
    loginIntelligenceHint:
      typeof meta.loginIntelligenceHint === 'string' ? meta.loginIntelligenceHint : null,
    loginEntryType: typeof meta.loginEntryType === 'string' ? meta.loginEntryType : null,
    usesModal: meta.usesModal === true || meta.loginEntryType === 'modal',
  };
}
