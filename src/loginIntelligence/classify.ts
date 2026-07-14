import {
  LOGIN_DETECTION_ENGINE_VERSION,
  type FederatedProviderHint,
  type IntegrationHealth,
  type LoginComplexity,
  type LoginDetectionConfidence,
  type LoginDetectionStatus,
  type LoginFlowType,
  type LoginIntelligence,
  type LoginPageSignals,
} from './types';

export interface ClassificationResult {
  intelligence: Omit<
    LoginIntelligence,
    'loginDetectionLastCheckedAt' | 'lastValidatedBy' | 'loginIntelligenceAdminOverride'
  >;
  reasons: string[];
}

function uniqueProviders(list: FederatedProviderHint[] | undefined): FederatedProviderHint[] {
  if (!list?.length) return [];
  return [...new Set(list)];
}

/**
 * Classify login complexity + flow from page signals + Phase 108 deferral hints.
 * Never uses credentials. AC-112-1, 4–7, 20.
 */
export function classifyLoginIntelligence(signals: LoginPageSignals): ClassificationResult {
  const reasons: string[] = [];
  const federated = uniqueProviders(signals.federatedProviders);
  const hasFederated = Boolean(signals.hasFederatedButtons || federated.length > 0);

  let loginFlowType: LoginFlowType = 'unknown';
  let loginComplexity: LoginComplexity = 'unknown';
  let confidence: LoginDetectionConfidence = 'medium';
  let status: LoginDetectionStatus = 'ok';
  let health: IntegrationHealth = 'needs_review';
  let adapterRecommended = false;
  let adapterReason: string | null = null;
  let supportedCredentialFields: string[] = [];
  let requiresOtp = Boolean(signals.hasOtpHint);
  let requiresCaptcha = Boolean(signals.hasCaptcha);
  let usesIframe = Boolean(signals.usesIframe);
  let usesModal = Boolean(signals.usesModal);
  let isMultiStep = Boolean(signals.isMultiStepHint);

  const hint = signals.loginIntelligenceHint?.trim() || null;
  const deferred = Boolean(signals.phase112Deferred);

  // Auth-method chooser first (AC-112-5) — federated buttons are detect-only (AC-112-6).
  if (signals.hasAuthMethodSelection) {
    loginFlowType = 'auth_method_selection';
    loginComplexity = 'medium';
    confidence = 'high';
    health = 'degraded';
    isMultiStep = true;
    supportedCredentialFields = ['username', 'password'];
    reasons.push('auth_method_selection');
    if (hasFederated) {
      reasons.push('federated_available_not_auto');
    }
  } else if (
    signals.federatedOnly ||
    (hasFederated &&
      !signals.hasVisiblePassword &&
      !signals.hasVisibleEmail &&
      !signals.hasVisibleUsername &&
      !signals.hasVisibleId)
  ) {
    loginFlowType = signals.federatedOnly ? 'federated_only' : 'federated_login_available';
    loginComplexity = 'complex';
    confidence = 'high';
    health = 'adapter_required';
    adapterRecommended = true;
    adapterReason = 'federated_or_idp_dominated';
    reasons.push('federated_surface');
  } else if (requiresCaptcha && !signals.hasVisiblePassword) {
    loginFlowType = 'captcha_required';
    loginComplexity = 'complex';
    confidence = 'high';
    health = 'adapter_required';
    adapterRecommended = true;
    adapterReason = 'captcha_dominated';
    reasons.push('captcha');
  } else if (requiresOtp && !signals.hasVisiblePassword) {
    loginFlowType = 'otp_required';
    loginComplexity = 'complex';
    confidence = 'high';
    health = 'adapter_required';
    adapterRecommended = true;
    adapterReason = 'otp_heavy';
    reasons.push('otp');
  } else if (usesIframe) {
    loginFlowType = 'iframe_login';
    loginComplexity = 'complex';
    confidence = 'high';
    health = 'unsupported';
    adapterRecommended = true;
    adapterReason = 'iframe_login';
    reasons.push('iframe');
  } else if (signals.usesPopup) {
    loginFlowType = 'popup_login';
    loginComplexity = 'complex';
    confidence = 'medium';
    health = 'adapter_required';
    adapterRecommended = true;
    adapterReason = 'popup_login';
    reasons.push('popup');
  } else if (signals.hasVisibleEmail && !signals.hasVisiblePassword) {
    loginFlowType = 'email_first';
    loginComplexity = 'medium';
    confidence = 'high';
    health = 'degraded';
    isMultiStep = true;
    supportedCredentialFields = ['username', 'password'];
    reasons.push('email_first');
  } else if (signals.hasVisibleId && !signals.hasVisiblePassword) {
    loginFlowType = 'id_first';
    loginComplexity = 'medium';
    confidence = 'high';
    health = 'degraded';
    isMultiStep = true;
    supportedCredentialFields = ['username', 'password'];
    reasons.push('id_first');
  } else if (signals.hasVisibleUsername && !signals.hasVisiblePassword) {
    loginFlowType = 'username_first';
    loginComplexity = 'medium';
    confidence = 'high';
    health = 'degraded';
    isMultiStep = true;
    supportedCredentialFields = ['username', 'password'];
    reasons.push('username_first');
  } else if (
    (signals.hasVisibleUsername || signals.hasVisibleEmail || signals.hasVisibleId) &&
    signals.hasVisiblePassword
  ) {
    loginFlowType = 'standard_single_page';
    loginComplexity = 'basic';
    confidence = 'high';
    health = 'healthy';
    supportedCredentialFields = ['username', 'password'];
    if (hasFederated) {
      reasons.push('federated_available_not_auto');
    }
    reasons.push('standard_single_page');
  } else if (usesModal || signals.loginEntryType === 'modal') {
    loginFlowType = 'modal_login';
    loginComplexity = 'medium';
    confidence = 'medium';
    health = 'degraded';
    isMultiStep = true;
    reasons.push('modal_login');
  }

  // Phase 108 deferral hints refine classification (D-112-5) — do not invent loginUrl.
  if (deferred && hint) {
    reasons.push(`hint:${hint}`);
    if (hint === 'modal_on_primary' && loginComplexity === 'unknown') {
      loginFlowType = 'modal_login';
      loginComplexity = 'medium';
      confidence = 'medium';
      health = 'needs_review';
      usesModal = true;
    } else if (hint === 'complex_login_surface') {
      if (loginComplexity === 'basic') {
        loginComplexity = 'medium';
        isMultiStep = true;
        health = 'degraded';
      } else if (loginComplexity === 'unknown') {
        loginComplexity = 'complex';
        loginFlowType = 'adapter_required';
        health = 'adapter_required';
        adapterRecommended = true;
        adapterReason = 'complex_login_surface';
        confidence = 'medium';
      }
    } else if (hint === 'alternate_audience_portal') {
      // Classification only — no second discovery pipeline
      if (loginComplexity === 'unknown') {
        loginComplexity = 'unknown';
        loginFlowType = 'unknown';
        health = 'needs_review';
        confidence = 'low';
        status = 'partial';
      }
    } else if (hint === 'needs_review' && loginComplexity === 'unknown') {
      health = 'needs_review';
      confidence = 'low';
      status = 'partial';
    }
  }

  if (loginComplexity === 'unknown' && !reasons.length) {
    status = 'pending';
    health = 'needs_review';
    confidence = 'low';
    loginFlowType = 'unknown';
    reasons.push('insufficient_signals');
  }

  if (hasFederated && loginFlowType === 'standard_single_page') {
    // Keep basic; flag options
  } else if (hasFederated && loginFlowType === 'unknown') {
    loginFlowType = 'federated_login_available';
  }

  if (adapterRecommended && !adapterReason) {
    adapterReason = 'generic_insufficient';
  }

  const intelligence: ClassificationResult['intelligence'] = {
    loginComplexity,
    loginFlowType,
    loginDetectionStatus: status,
    loginDetectionConfidence: confidence,
    loginDetectionError: null,
    loginDetectionEngineVersion: LOGIN_DETECTION_ENGINE_VERSION,
    adapterRecommended,
    adapterReason,
    adapterLifecycle: adapterRecommended ? 'recommended' : null,
    integrationHealth: health,
    supportedCredentialFields,
    federatedLoginOptions: federated,
    requiresOtp,
    requiresCaptcha,
    usesIframe,
    usesModal,
    isMultiStep,
  };

  return { intelligence, reasons };
}
