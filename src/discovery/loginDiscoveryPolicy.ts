import type { DiscoveryResult } from './discoveryResult';
import {
  ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
  CONSUMER_LOGIN_MODAL_REASON,
  CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
  MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
  PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON,
  evaluateLoginAudience,
  isAlternateAudiencePortalUrl,
  isTrustedAuthSubdomain,
} from './loginAudienceGate';

/** Phase 112 deferral hint values (M9 / D-108-14…17). */
export type LoginIntelligenceHint =
  | 'alternate_audience_portal'
  | 'modal_on_primary'
  | 'complex_login_surface'
  | 'needs_review';

export interface Phase112DeferralFields {
  phase112Deferred: boolean;
  loginIntelligenceHint: LoginIntelligenceHint | null;
}

/**
 * Bare common-path login URLs (exact path only).
 * Do NOT use endsWith('/login') — that blanks true positives like /online/he/login (D-108-18).
 */
function isGenericLoginPathOnly(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/$/, '').toLowerCase() || '/';
    return ['/login', '/signin', '/sign-in', '/account/login', '/user/login', '/auth/login'].some(
      (fallback) => path === fallback.replace(/\/$/, '').toLowerCase(),
    );
  } catch {
    return false;
  }
}

function hasStrongConsumerNavigableEvidence(result: DiscoveryResult): boolean {
  if (!result.loginUrl || !result.success) {
    return false;
  }
  if (isAlternateAudiencePortalUrl(result.loginUrl)) {
    return false;
  }

  // Never persist the primary/homepage URL itself as login_url.
  try {
    const login = new URL(result.loginUrl);
    const primary = new URL(result.primaryUrl);
    const sameHost =
      login.hostname.replace(/^www\./i, '').toLowerCase() ===
      primary.hostname.replace(/^www\./i, '').toLowerCase();
    const loginPath = login.pathname.replace(/\/$/, '') || '/';
    const primaryPath = primary.pathname.replace(/\/$/, '') || '/';
    if (sameHost && loginPath === primaryPath) {
      return false;
    }
  } catch {
    return false;
  }

  if (result.method === 'dedicated-login-page') {
    return true;
  }

  try {
    if (isTrustedAuthSubdomain(new URL(result.loginUrl).hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  const portalSibling = result.candidates?.some((c) => isAlternateAudiencePortalUrl(c.url));
  if (portalSibling && isGenericLoginPathOnly(result.loginUrl)) {
    return false;
  }

  // D-108-26: validated common-path (engine upgrades most to dedicated-login-page;
  // if method remains common-path with medium/high + navigable, allow persist).
  if (result.method === 'common-path') {
    return (
      result.loginEntryType === 'navigable' &&
      (result.confidence === 'high' || result.confidence === 'medium')
    );
  }

  if (result.confidence === 'low') {
    return false;
  }

  // Non-bare paths (e.g. /online/he/login) with medium/high confidence are consumer-strong.
  if (!isGenericLoginPathOnly(result.loginUrl)) {
    return true;
  }

  return (
    result.method === 'visible-link' ||
    result.method === 'visible-button' ||
    result.method === 'redirect'
  );
}

/**
 * Map discovery outcome → Phase 112 deferral metadata (AC-108-18…20).
 */
export function resolvePhase112Deferral(result: DiscoveryResult | null): Phase112DeferralFields {
  if (!result) {
    return { phase112Deferred: false, loginIntelligenceHint: null };
  }

  const reason = result.reason ?? '';
  const portalRejected =
    Boolean(result.rejectedLoginUrl && isAlternateAudiencePortalUrl(result.rejectedLoginUrl)) ||
    reason === MODAL_WITH_ALTERNATE_AUDIENCE_REASON ||
    reason === ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON ||
    reason === PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON ||
    reason === 'alternate_audience_portal' ||
    reason === 'modal_with_alternate_audience';

  if (portalRejected) {
    return {
      phase112Deferred: true,
      loginIntelligenceHint: 'alternate_audience_portal',
    };
  }

  // Navigable consumer URL with an extra modal step → keep URL + complex hint (D-108-17).
  if (result.success && result.loginUrl && (result.usesModal || result.modalTrigger)) {
    return {
      phase112Deferred: true,
      loginIntelligenceHint: 'complex_login_surface',
    };
  }

  if (
    result.loginEntryType === 'modal' ||
    result.usesModal ||
    reason === CONSUMER_LOGIN_MODAL_REASON ||
    reason === 'consumer_login_is_modal' ||
    reason === 'modal_trigger_without_navigable_url'
  ) {
    return {
      phase112Deferred: true,
      loginIntelligenceHint: 'modal_on_primary',
    };
  }

  if (
    !result.success &&
    (reason === CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON ||
      reason === 'cross_subdomain_untrusted' ||
      result.confidence === 'low' ||
      result.method === 'common-path')
  ) {
    return {
      phase112Deferred: true,
      loginIntelligenceHint: 'needs_review',
    };
  }

  if (!result.success) {
    return {
      phase112Deferred: true,
      loginIntelligenceHint: 'needs_review',
    };
  }

  return { phase112Deferred: false, loginIntelligenceHint: null };
}

/**
 * Whether a discovered login URL is stable enough to persist (D-108-14 revised / D-108-18 / D-108-26).
 * Reject only with positive bad evidence; homepage modal / portal siblings must not
 * blank-veto a stronger same-origin consumer candidate.
 *
 * D-108-26: do NOT blank-reject solely because method=common-path or confidence=low.
 */
export function shouldPersistDiscoveredLoginUrl(result: DiscoveryResult): boolean {
  if (!result.success || !result.loginUrl) {
    return false;
  }

  if (isAlternateAudiencePortalUrl(result.loginUrl)) {
    return false;
  }

  // Modal-only (no strong navigable evidence) must not persist.
  if (result.loginEntryType === 'modal' && !hasStrongConsumerNavigableEvidence(result)) {
    return false;
  }

  if (!hasStrongConsumerNavigableEvidence(result)) {
    return false;
  }

  const audience = evaluateLoginAudience(result.primaryUrl, result.loginUrl, {
    // Homepage modal trigger must not flip audience reject for same-origin consumer URLs.
    primaryHasModalLoginTrigger: false,
  });
  return audience.accept;
}

/**
 * Hub-side defense: re-apply audience + surface rules before persist (M10 dual gate).
 * Homepage modal triggers must not clear a separate validated consumer navigable URL.
 * Portal siblings must not veto a stronger same-origin consumer candidate.
 */
export function sanitizeDiscoveryResult(result: DiscoveryResult): DiscoveryResult {
  const hasModalSignal =
    Boolean(result.modalTrigger) ||
    result.usesModal === true ||
    result.loginEntryType === 'modal';

  const portalSibling = result.candidates?.find((c) => isPortalUrl(c.url));

  // Candidate itself is a portal — never persist.
  if (result.loginUrl && isPortalUrl(result.loginUrl)) {
    return {
      ...result,
      success: false,
      loginUrl: undefined,
      reason: hasModalSignal
        ? MODAL_WITH_ALTERNATE_AUDIENCE_REASON
        : ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
      loginEntryType: hasModalSignal ? 'modal' : 'unknown',
      usesModal: hasModalSignal,
      rejectedLoginUrl: result.loginUrl,
    };
  }

  // Weak bare /login + portal sibling on page → reject THIS weak candidate only.
  if (
    result.loginUrl &&
    portalSibling &&
    isGenericLoginPathOnly(result.loginUrl) &&
    result.method !== 'dedicated-login-page'
  ) {
    return {
      ...result,
      success: false,
      loginUrl: undefined,
      reason: hasModalSignal
        ? MODAL_WITH_ALTERNATE_AUDIENCE_REASON
        : ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
      loginEntryType: hasModalSignal ? 'modal' : 'unknown',
      usesModal: hasModalSignal,
      rejectedLoginUrl: portalSibling.url,
    };
  }

  if (!result.success || !result.loginUrl) {
    if (hasModalSignal) {
      return {
        ...result,
        success: false,
        loginUrl: undefined,
        reason: result.rejectedLoginUrl
          ? MODAL_WITH_ALTERNATE_AUDIENCE_REASON
          : result.reason ?? CONSUMER_LOGIN_MODAL_REASON,
        loginEntryType: 'modal',
        usesModal: true,
      };
    }
    return result;
  }

  const gate = evaluateLoginAudience(result.primaryUrl, result.loginUrl, {
    primaryHasModalLoginTrigger: false,
  });

  if (gate.accept && !isPortalUrl(result.loginUrl)) {
    // Keep navigable URL; modal on primary is an extra-step hint only (D-108-16/17).
    return {
      ...result,
      success: true,
      loginEntryType: 'navigable',
      usesModal: hasModalSignal,
    };
  }

  const preferModal =
    hasModalSignal ||
    (!gate.accept && gate.preferModalClassification) ||
    (!gate.accept && gate.code === 'alternate_audience_portal');

  return {
    ...result,
    success: false,
    loginUrl: undefined,
    method: result.method,
    confidence: result.confidence,
    reason: preferModal
      ? MODAL_WITH_ALTERNATE_AUDIENCE_REASON
      : !gate.accept
        ? gate.reason
        : ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
    loginEntryType: preferModal ? 'modal' : 'unknown',
    usesModal: preferModal,
    rejectedLoginUrl: result.loginUrl,
  };
}

function isPortalUrl(url: string): boolean {
  return isAlternateAudiencePortalUrl(url);
}

/** Classify non-persistable discovery for registry status (Phase 108). */
export function classifyDiscoveryReviewStatus(result: DiscoveryResult): {
  loginUrlStatus: 'needs_review' | 'missing';
  errorCode: string;
} {
  const reason = result.reason ?? '';

  if (
    reason === MODAL_WITH_ALTERNATE_AUDIENCE_REASON ||
    reason === 'modal_with_alternate_audience' ||
    (result.usesModal && result.rejectedLoginUrl)
  ) {
    return {
      loginUrlStatus: 'needs_review',
      errorCode: MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
    };
  }

  if (
    result.loginEntryType === 'modal' ||
    result.usesModal ||
    reason === CONSUMER_LOGIN_MODAL_REASON ||
    reason === 'modal_trigger_without_navigable_url' ||
    reason === 'consumer_login_is_modal'
  ) {
    return {
      loginUrlStatus: 'needs_review',
      errorCode: CONSUMER_LOGIN_MODAL_REASON,
    };
  }

  if (
    reason === ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON ||
    reason === PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON ||
    reason === 'alternate_audience_portal' ||
    reason === 'page_context_alternate_audience' ||
    reason.includes('another audience') ||
    reason.includes('alternate portal')
  ) {
    return {
      loginUrlStatus: 'needs_review',
      errorCode: ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
    };
  }

  if (
    !result.success &&
    (reason === CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON ||
      reason === 'cross_subdomain_untrusted' ||
      result.confidence === 'low' ||
      result.method === 'common-path')
  ) {
    return {
      loginUrlStatus: 'needs_review',
      errorCode:
        reason === CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON || reason === 'cross_subdomain_untrusted'
          ? CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON
          : 'low_confidence_candidate',
    };
  }

  return {
    loginUrlStatus: 'missing',
    errorCode: reason || 'no_login_page_found',
  };
}
