import { classifyLoginIntelligence } from './classify';
import {
  canAutoApplyClassification,
  loginIntelligenceToMetadataPatch,
  readLoginIntelligence,
  signalsFromDiscoveryMetadata,
} from './readWrite';
import type { LoginIntelligence, LoginPageSignals, LastValidatedBy } from './types';
import { LOGIN_DETECTION_ENGINE_VERSION } from './types';
import { recommendAdapter } from './adapterRecommendation';
import { mapOutcomeToIntegrationHealth } from './health';

export interface ApplyClassificationOptions {
  /** Force replace even when admin override is set (explicit admin approve). */
  forceReplaceAdmin?: boolean;
  lastValidatedBy?: LastValidatedBy;
  markAdminOverride?: boolean;
  now?: string;
}

export interface ApplyClassificationResult {
  applied: boolean;
  reason: string;
  intelligence: LoginIntelligence | null;
  metadataPatch: Record<string, unknown>;
}

/**
 * Classify from signals (+ optional 108 metadata seed) and build a metadata patch.
 * Respects admin override + confidence gates (AC-112-19, 20).
 */
export function applyLoginIntelligenceClassification(
  existingMetadata: Record<string, unknown> | null | undefined,
  pageSignals: LoginPageSignals = {},
  options: ApplyClassificationOptions = {},
): ApplyClassificationResult {
  const existing = readLoginIntelligence(existingMetadata);
  const seeded: LoginPageSignals = {
    ...signalsFromDiscoveryMetadata(existingMetadata),
    ...pageSignals,
  };

  const { intelligence: classified } = classifyLoginIntelligence(seeded);
  const now = options.now ?? new Date().toISOString();
  const lastValidatedBy = options.lastValidatedBy ?? 'auto';

  let next: LoginIntelligence = {
    ...classified,
    loginDetectionLastCheckedAt: now,
    lastValidatedBy,
    loginIntelligenceAdminOverride: Boolean(
      options.markAdminOverride || existing?.loginIntelligenceAdminOverride,
    ),
  };

  if (next.adapterRecommended) {
    next = recommendAdapter(next, next.adapterReason || 'policy');
  }

  next = {
    ...next,
    integrationHealth: mapOutcomeToIntegrationHealth({
      complexity: next.loginComplexity,
      adapterRecommended: next.adapterRecommended,
    }),
    loginDetectionEngineVersion: LOGIN_DETECTION_ENGINE_VERSION,
  };

  if (options.forceReplaceAdmin || options.markAdminOverride) {
    next = {
      ...next,
      lastValidatedBy: 'admin',
      loginIntelligenceAdminOverride: true,
      loginDetectionConfidence: 'high',
    };
    return {
      applied: true,
      reason: 'admin_override',
      intelligence: next,
      metadataPatch: loginIntelligenceToMetadataPatch(next),
    };
  }

  const gate = canAutoApplyClassification(existing, next.loginDetectionConfidence);
  if (!gate.apply) {
    // Still stamp last-checked attempt into a non-authoritative review hint
    const reviewPatch: Record<string, unknown> = {
      loginIntelligencePendingReview: loginIntelligenceToMetadataPatch(next),
      loginDetectionLastAttemptAt: now,
      loginDetectionLastAttemptReason: gate.reason,
    };
    return {
      applied: false,
      reason: gate.reason,
      intelligence: existing,
      metadataPatch: reviewPatch,
    };
  }

  return {
    applied: true,
    reason: gate.reason,
    intelligence: next,
    metadataPatch: loginIntelligenceToMetadataPatch(next),
  };
}

export function buildManualLoginIntelligenceOverride(
  existingMetadata: Record<string, unknown> | null | undefined,
  patch: Partial<LoginIntelligence>,
): Record<string, unknown> {
  const existing = readLoginIntelligence(existingMetadata);
  const base: LoginIntelligence = existing ?? {
    loginComplexity: 'unknown',
    loginFlowType: 'unknown',
    loginDetectionStatus: 'ok',
    loginDetectionConfidence: 'high',
    loginDetectionLastCheckedAt: new Date().toISOString(),
    loginDetectionError: null,
    loginDetectionEngineVersion: LOGIN_DETECTION_ENGINE_VERSION,
    lastValidatedBy: 'admin',
    adapterRecommended: false,
    adapterReason: null,
    adapterLifecycle: null,
    integrationHealth: 'needs_review',
    supportedCredentialFields: [],
    federatedLoginOptions: [],
    requiresOtp: false,
    requiresCaptcha: false,
    usesIframe: false,
    usesModal: false,
    isMultiStep: false,
    loginIntelligenceAdminOverride: true,
  };

  const merged: LoginIntelligence = {
    ...base,
    ...patch,
    lastValidatedBy: 'admin',
    loginIntelligenceAdminOverride: true,
    loginDetectionLastCheckedAt: new Date().toISOString(),
    loginDetectionEngineVersion: LOGIN_DETECTION_ENGINE_VERSION,
  };

  return loginIntelligenceToMetadataPatch(merged);
}
