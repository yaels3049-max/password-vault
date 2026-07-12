import {
  ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
  CONSUMER_LOGIN_MODAL_REASON,
  CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
  MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
  PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON,
} from '../discovery/loginAudienceGate';
import {
  resolvePhase112Deferral,
  type LoginIntelligenceHint,
} from '../discovery/loginDiscoveryPolicy';
import type { DiscoveryResult } from '../discovery';
import type { LoginUrlStatus } from './registryMapper';

export type { LoginIntelligenceHint };
export type LoginUrlDiscoverySource = 'auto' | 'admin' | 'user' | 'unknown';

/** Explicit outcome for distinguishing discovery lifecycle (Phase 108 follow-up). */
export type LoginDiscoveryOutcomeState =
  | 'never_run'
  | 'succeeded'
  | 'failed'
  | 'needs_review'
  | 'missing';

export interface DiscoveryMetadataInput {
  discovery: DiscoveryResult | null;
  source: LoginUrlDiscoverySource;
  success: boolean;
  errorCode?: string;
  loginUrlStatus?: LoginUrlStatus;
  /** Raw extension payload before Hub sanitize (D-108-20). */
  rawExtensionDiscovery?: DiscoveryResult | null;
}

const STORAGE_ERROR_CODES = new Set([
  'extension_unavailable',
  'discovery_timeout',
  'low_confidence_candidate',
  'no_login_page_found',
  'discovery_pipeline_error',
  'invalid_discovery_response',
  'never_run',
  'consumer_login_is_modal',
  'modal_with_alternate_audience',
  'alternate_audience_portal',
  'cross_subdomain_untrusted',
  'page_context_alternate_audience',
  'modal_on_primary',
]);

const PRESERVED_HUMAN_REASONS = new Set([
  CONSUMER_LOGIN_MODAL_REASON,
  MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
  ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
  CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
  PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON,
]);

/** Map raw/technical discovery signals to concise non-sensitive storage codes. */
export function normalizeDiscoveryErrorCode(
  raw: string | undefined,
  loginUrlStatus?: LoginUrlStatus,
): string {
  const trimmed = (raw ?? '').trim();
  if (PRESERVED_HUMAN_REASONS.has(trimmed)) {
    return trimmed;
  }

  const key = trimmed.toLowerCase();
  if (!key) {
    if (loginUrlStatus === 'needs_review') {
      return 'low_confidence_candidate';
    }
    return loginUrlStatus === 'failed' ? 'discovery_failed' : 'no_login_page_found';
  }

  if (STORAGE_ERROR_CODES.has(key)) {
    return key;
  }

  if (key.includes('extension_unavailable') || key.includes('extension_not')) {
    return 'extension_unavailable';
  }
  if (key.includes('timeout') || key === 'discovery_hub_timeout' || key === 'operation_timeout') {
    return 'discovery_timeout';
  }
  if (key.includes('low_confidence') || key === 'common-path') {
    return 'low_confidence_candidate';
  }
  if (key.includes('alternate portal') || (key.includes('modal') && key.includes('alternate'))) {
    return MODAL_WITH_ALTERNATE_AUDIENCE_REASON;
  }
  if (key.includes('alternate') || key.includes('another audience') || key.includes('page_context')) {
    return ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON;
  }
  if (key.includes('cross_subdomain')) {
    return CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON;
  }
  if (key.includes('modal')) {
    return CONSUMER_LOGIN_MODAL_REASON;
  }
  if (
    key.includes('no_login') ||
    key.includes('not_found') ||
    key.includes('no_candidate') ||
    key === 'missing'
  ) {
    return 'no_login_page_found';
  }

  if (loginUrlStatus === 'needs_review') {
    return 'low_confidence_candidate';
  }

  return loginUrlStatus === 'failed' ? 'discovery_failed' : 'no_login_page_found';
}

export function resolveLoginDiscoveryOutcomeState(input: {
  login_url: string | null;
  login_url_status: LoginUrlStatus;
  metadata: Record<string, unknown> | null | undefined;
}): LoginDiscoveryOutcomeState {
  const metadata = input.metadata ?? {};
  const checkedAt = metadata.loginUrlLastCheckedAt;

  if (input.login_url && input.login_url_status === 'valid') {
    return 'succeeded';
  }

  if (!checkedAt) {
    return 'never_run';
  }

  if (input.login_url_status === 'needs_review') {
    return 'needs_review';
  }
  if (input.login_url_status === 'failed') {
    return 'failed';
  }

  const explicit = metadata.loginUrlDiscoveryOutcome;
  if (explicit === 'needs_review' || explicit === 'failed' || explicit === 'missing') {
    return explicit;
  }

  return 'missing';
}

function resolveOutcomeState(input: DiscoveryMetadataInput): LoginDiscoveryOutcomeState {
  if (input.success && input.discovery?.loginUrl) {
    return 'succeeded';
  }
  if (input.loginUrlStatus === 'needs_review') {
    return 'needs_review';
  }
  if (input.loginUrlStatus === 'failed') {
    return 'failed';
  }
  return 'missing';
}

/** Admin-facing concise Hebrew labels (not shown to end users by default). */
export const ADMIN_DISCOVERY_ERROR_LABELS: Record<string, string> = {
  extension_unavailable: 'הרחבת דפדפן לא זמינה',
  discovery_timeout: 'זמן הגילוי נגמר',
  low_confidence_candidate: 'מועמד חלש — נדרשת בדיקת מנהל',
  no_login_page_found: 'לא נמצא דף כניסה',
  discovery_failed: 'שגיאת גילוי',
  discovery_pipeline_error: 'שגיאה בתהליך הגילוי',
  invalid_discovery_response: 'תגובת גילוי לא תקינה',
  never_run: 'גילוי לא הורץ',
  consumer_login_is_modal: 'כניסת צרכן במודל בדף הבית',
  modal_with_alternate_audience: 'כניסה במודל; מועמד פורטל אחר נדחה',
  alternate_audience_portal: 'מועמד פורטל לקהל אחר — נדחה',
  cross_subdomain_untrusted: 'מועמד תת-דומיין — נדרשת בדיקה',
  page_context_alternate_audience: 'הקשר הדף מצביע על פורטל לקהל אחר',
  modal_on_primary: 'כניסה במודל בדף הבית — נדחה לפאזה 112',
  [CONSUMER_LOGIN_MODAL_REASON]: 'כניסת צרכן במודל בדף הבית',
  [MODAL_WITH_ALTERNATE_AUDIENCE_REASON]: 'כניסה במודל; מועמד פורטל אחר נדחה',
  [ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON]: 'מועמד פורטל לקהל אחר — נדחה',
  [CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON]: 'מועמד תת-דומיין — נדרשת בדיקה',
  [PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON]: 'הקשר הדף מצביע על פורטל לקהל אחר',
};

export function adminDiscoveryErrorLabel(code: string | null | undefined): string {
  if (!code) {
    return '—';
  }
  return ADMIN_DISCOVERY_ERROR_LABELS[code] ?? 'לא נמצא דף כניסה';
}

/** Merge login discovery fields into service_registry.metadata (Phase 108 / M9). */
export function buildDiscoveryMetadataPatch(
  existing: Record<string, unknown> | null,
  input: DiscoveryMetadataInput,
): Record<string, unknown> {
  const now = new Date().toISOString();
  const metadata: Record<string, unknown> = { ...(existing ?? {}) };
  const outcomeState = resolveOutcomeState(input);
  const storageError = input.success
    ? null
    : normalizeDiscoveryErrorCode(
        input.errorCode ?? input.discovery?.reason,
        input.loginUrlStatus,
      );
  const deferral = resolvePhase112Deferral(input.discovery);

  metadata.loginUrlLastCheckedAt = now;
  metadata.loginUrlSource = input.source;
  metadata.loginUrlDiscoveryOutcome = outcomeState;
  metadata.loginUrlDiscoveryAttempted = true;

  if (input.discovery?.loginEntryType) {
    metadata.loginEntryType = input.discovery.loginEntryType;
  }
  if (typeof input.discovery?.usesModal === 'boolean') {
    metadata.usesModal = input.discovery.usesModal;
  }
  if (input.discovery?.rejectedLoginUrl) {
    metadata.rejectedLoginUrl = input.discovery.rejectedLoginUrl;
  }

  if (deferral.phase112Deferred) {
    metadata.phase112Deferred = true;
    metadata.loginIntelligenceHint = deferral.loginIntelligenceHint;
  } else if (input.success) {
    metadata.phase112Deferred = false;
    delete metadata.loginIntelligenceHint;
  }

  if (input.success && input.discovery?.loginUrl) {
    metadata.loginUrlLastDiscoveredAt = now;
    metadata.loginUrlConfidence = input.discovery.confidence ?? null;
    metadata.discoveryMethod = input.discovery.method ?? null;
    metadata.loginUrlDiscoveryError = null;
    metadata.loginEntryType = input.discovery.loginEntryType ?? 'navigable';
    metadata.usesModal = Boolean(input.discovery.usesModal);
    delete metadata.rejectedLoginUrl;
    if (input.discovery.usesModal) {
      metadata.phase112Deferred = true;
      metadata.loginIntelligenceHint = 'complex_login_surface';
    }
  } else {
    metadata.loginUrlDiscoveryError = storageError;
    if (input.discovery?.confidence) {
      metadata.loginUrlConfidence = input.discovery.confidence;
    }
    if (input.discovery?.method) {
      metadata.discoveryMethod = input.discovery.method;
    }
  }

  metadata.lastDiscoveryOutcome = {
    at: now,
    success: input.success,
    outcome: outcomeState,
    method: input.discovery?.method ?? null,
    confidence: input.discovery?.confidence ?? null,
    loginUrl: input.discovery?.loginUrl ?? null,
    reason: storageError,
    source: input.source,
    loginEntryType: input.discovery?.loginEntryType ?? null,
    usesModal: input.discovery?.usesModal ?? null,
    rejectedLoginUrl: input.discovery?.rejectedLoginUrl ?? null,
    phase112Deferred: metadata.phase112Deferred ?? false,
    loginIntelligenceHint: metadata.loginIntelligenceHint ?? null,
  };

  const raw = input.rawExtensionDiscovery ?? input.discovery;
  if (raw) {
    metadata.rawExtensionDiscovery = {
      at: now,
      success: raw.success,
      loginUrl: raw.loginUrl ?? null,
      method: raw.method ?? null,
      confidence: raw.confidence ?? null,
      reason: raw.reason ?? null,
      loginEntryType: raw.loginEntryType ?? null,
      usesModal: raw.usesModal ?? null,
      rejectedLoginUrl: raw.rejectedLoginUrl ?? null,
      candidateCount: raw.candidates?.length ?? 0,
      topCandidates: (raw.candidates ?? []).slice(0, 5).map((c) => ({
        url: c.url,
        method: c.method,
        score: c.score,
        confidence: c.confidence,
      })),
    };
  }

  return metadata;
}

/** Initial metadata for a registry row before any discovery attempt. */
export function buildInitialDiscoveryMetadata(): Record<string, unknown> {
  return {
    loginUrlDiscoveryOutcome: 'never_run',
    loginUrlDiscoveryAttempted: false,
  };
}
