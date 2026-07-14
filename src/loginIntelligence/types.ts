/**
 * Phase 112 — Login Intelligence types (authoritative writer: this module).
 * Exact DB placement: service_registry.metadata (JSONB); snake_case aliases OK.
 */

export const LOGIN_DETECTION_ENGINE_VERSION = '112.2.0';

export type LoginComplexity = 'basic' | 'medium' | 'complex' | 'unknown';

export type LoginFlowType =
  | 'standard_single_page'
  | 'email_first'
  | 'username_first'
  | 'id_first'
  | 'password_second_step'
  | 'auth_method_selection'
  | 'modal_login'
  | 'popup_login'
  | 'iframe_login'
  | 'federated_login_available'
  | 'federated_only'
  | 'otp_required'
  | 'captcha_required'
  | 'adapter_required'
  | 'unknown';

export type LoginDetectionStatus =
  | 'ok'
  | 'partial'
  | 'failed'
  | 'pending'
  | 'skipped';

export type LoginDetectionConfidence = 'high' | 'medium' | 'low';

export type LastValidatedBy = 'auto' | 'admin' | 'adapter';

export type AdapterLifecycle =
  | 'recommended'
  | 'approved'
  | 'implemented'
  | 'validated'
  | 'deprecated';

export type IntegrationHealth =
  | 'healthy'
  | 'degraded'
  | 'needs_review'
  | 'adapter_required'
  | 'unsupported';

export type FederatedProviderHint =
  | 'google'
  | 'apple'
  | 'microsoft'
  | 'facebook'
  | 'other';

/** Page / discovery signals consumed by the classifier (no credentials). */
export interface LoginPageSignals {
  hasVisibleUsername?: boolean;
  hasVisibleEmail?: boolean;
  hasVisibleId?: boolean;
  hasVisiblePassword?: boolean;
  hasContinueOrNext?: boolean;
  hasAuthMethodSelection?: boolean;
  hasFederatedButtons?: boolean;
  federatedProviders?: FederatedProviderHint[];
  federatedOnly?: boolean;
  hasOtpHint?: boolean;
  hasCaptcha?: boolean;
  usesIframe?: boolean;
  usesModal?: boolean;
  usesPopup?: boolean;
  isMultiStepHint?: boolean;
  /** Phase 108 deferral inputs */
  phase112Deferred?: boolean;
  loginIntelligenceHint?: string | null;
  loginEntryType?: string | null;
}

/** Authoritative Login Intelligence snapshot (persisted under metadata). */
export interface LoginIntelligence {
  loginComplexity: LoginComplexity;
  loginFlowType: LoginFlowType;
  loginDetectionStatus: LoginDetectionStatus;
  loginDetectionConfidence: LoginDetectionConfidence;
  loginDetectionLastCheckedAt: string | null;
  loginDetectionError: string | null;
  loginDetectionEngineVersion: string;
  lastValidatedBy: LastValidatedBy;
  adapterRecommended: boolean;
  adapterReason: string | null;
  adapterLifecycle: AdapterLifecycle | null;
  integrationHealth: IntegrationHealth;
  supportedCredentialFields: string[];
  federatedLoginOptions: FederatedProviderHint[];
  requiresOtp: boolean;
  requiresCaptcha: boolean;
  usesIframe: boolean;
  usesModal: boolean;
  isMultiStep: boolean;
  /** When true, auto reclassify must not overwrite (AC-112-19). */
  loginIntelligenceAdminOverride?: boolean;
}

export const LOGIN_COMPLEXITIES: readonly LoginComplexity[] = [
  'basic',
  'medium',
  'complex',
  'unknown',
] as const;

export const LOGIN_FLOW_TYPES: readonly LoginFlowType[] = [
  'standard_single_page',
  'email_first',
  'username_first',
  'id_first',
  'password_second_step',
  'auth_method_selection',
  'modal_login',
  'popup_login',
  'iframe_login',
  'federated_login_available',
  'federated_only',
  'otp_required',
  'captcha_required',
  'adapter_required',
  'unknown',
] as const;

export const INTEGRATION_HEALTH_STATES: readonly IntegrationHealth[] = [
  'healthy',
  'degraded',
  'needs_review',
  'adapter_required',
  'unsupported',
] as const;

export const ADAPTER_LIFECYCLES: readonly AdapterLifecycle[] = [
  'recommended',
  'approved',
  'implemented',
  'validated',
  'deprecated',
] as const;

export function isLoginComplexity(value: unknown): value is LoginComplexity {
  return typeof value === 'string' && (LOGIN_COMPLEXITIES as readonly string[]).includes(value);
}

export function isIntegrationHealth(value: unknown): value is IntegrationHealth {
  return (
    typeof value === 'string' && (INTEGRATION_HEALTH_STATES as readonly string[]).includes(value)
  );
}

export function isAdapterLifecycle(value: unknown): value is AdapterLifecycle {
  return typeof value === 'string' && (ADAPTER_LIFECYCLES as readonly string[]).includes(value);
}
