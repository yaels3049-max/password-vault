import {
  discoveryFailure,
  discoverySuccess,
  type DiscoveryCandidate,
  type DiscoveryResult,
  type ModalLoginTrigger,
} from './discoveryResult';
import { COMMON_LOGIN_PATH_FALLBACKS } from './discoveryKeywords';
import { documentFromHtml, normalizePrimaryUrl } from './discoveryUtils';
import {
  ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
  CONSUMER_LOGIN_MODAL_REASON,
  CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
  MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
  evaluateLoginAudience,
  extractPageAudienceContextText,
  isAlternateAudiencePortalUrl,
} from './loginAudienceGate';
import {
  buildCommonPathCandidateEntries,
  inspectPageForLoginEntry,
} from './pageInspector';
import { followHttpRedirects, redirectResultLooksLikeLogin } from './redirectFollower';

export interface DiscoverLoginEntryOptions {
  document?: Document;
  html?: string;
  pageUrl?: string;
  followRedirects?: boolean;
  tryCommonPaths?: boolean;
  /** Treat elements as visible without layout geometry (tests / HTML snapshots). */
  assumeVisible?: boolean;
}

function isGenericLoginPathUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/$/, '').toLowerCase() || '/';
    // Exact common-path only — do not endsWith('/login') (over-rejects /online/he/login).
    return COMMON_LOGIN_PATH_FALLBACKS.some((fallback) => {
      const normalized = fallback.replace(/\/$/, '').toLowerCase();
      return path === normalized;
    });
  } catch {
    return false;
  }
}

function isEmbeddedHomepageLoginForm(
  primaryUrl: string,
  candidate: DiscoveryCandidate,
): boolean {
  if (candidate.method !== 'dedicated-login-page') {
    return false;
  }

  try {
    const primary = new URL(primaryUrl);
    const candidateUrl = new URL(candidate.url);
    if (
      primary.hostname.replace(/^www\./i, '').toLowerCase() !==
      candidateUrl.hostname.replace(/^www\./i, '').toLowerCase()
    ) {
      return false;
    }

    const primaryPath = primary.pathname.replace(/\/$/, '') || '/';
    const candidatePath = candidateUrl.pathname.replace(/\/$/, '') || '/';
    return primaryPath === candidatePath;
  } catch {
    return false;
  }
}

/** Reject buttons/links that resolve to the page already being inspected (homepage chrome). */
function isSelfPageCandidate(
  primaryUrl: string,
  pageUrl: string | undefined,
  candidateUrl: string,
): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const candPath = candidate.pathname.replace(/\/$/, '') || '/';
    const candHost = candidate.hostname.replace(/^www\./i, '').toLowerCase();

    for (const base of [primaryUrl, pageUrl].filter(Boolean) as string[]) {
      const page = new URL(base);
      const pageHost = page.hostname.replace(/^www\./i, '').toLowerCase();
      if (pageHost !== candHost) {
        continue;
      }
      const pagePath = page.pathname.replace(/\/$/, '') || '/';
      if (pagePath === candPath) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function findAlternatePortalCandidate(
  primaryUrl: string,
  candidates: DiscoveryCandidate[],
  context: {
    pageTitle?: string;
    pageContextText?: string;
    primaryHasModalLoginTrigger: boolean;
  },
): DiscoveryCandidate | null {
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  for (const candidate of ranked) {
    if (isAlternateAudiencePortalUrl(candidate.url)) {
      return candidate;
    }
    const gate = evaluateLoginAudience(primaryUrl, candidate.url, {
      label: candidate.label,
      pageTitle: context.pageTitle,
      pageContextText: context.pageContextText,
      primaryHasModalLoginTrigger: context.primaryHasModalLoginTrigger,
    });
    if (
      !gate.accept &&
      (gate.code === 'alternate_audience_portal' ||
        gate.code === 'page_context_alternate_audience')
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * Pick a consumer-safe navigable login URL (M10 dual gate).
 * Homepage modal triggers do not veto navigable consumer candidates.
 * Portal siblings do not veto stronger same-origin consumer candidates.
 * Weak bare /login links may be skipped when a portal is also visible (positive evidence).
 */
function pickAudienceSafeCandidate(
  primaryUrl: string,
  candidates: DiscoveryCandidate[],
  context: {
    pageUrl?: string;
    pageTitle?: string;
    pageContextText?: string;
    primaryHasModalLoginTrigger: boolean;
    pageHasAlternatePortalCandidate: boolean;
  },
): { accepted: DiscoveryCandidate | null; rejected: DiscoveryCandidate | null } {
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  let firstRejected: DiscoveryCandidate | null = null;

  for (const candidate of ranked) {
    if (isAlternateAudiencePortalUrl(candidate.url)) {
      if (!firstRejected) firstRejected = candidate;
      continue;
    }

    if (isEmbeddedHomepageLoginForm(primaryUrl, candidate)) {
      if (!firstRejected) firstRejected = candidate;
      continue;
    }

    // Homepage chrome buttons/links that resolve to the current marketing page.
    // Do not apply to dedicated-login-page (the page under inspection IS the login form).
    if (
      candidate.method !== 'dedicated-login-page' &&
      isSelfPageCandidate(primaryUrl, context.pageUrl, candidate.url)
    ) {
      if (!firstRejected) firstRejected = candidate;
      continue;
    }

    // Weak bare /login (not a dedicated form page) shadowed by a portal sibling —
    // reject this candidate only; keep evaluating stronger consumer URLs.
    if (
      context.pageHasAlternatePortalCandidate &&
      isGenericLoginPathUrl(candidate.url) &&
      candidate.method !== 'dedicated-login-page'
    ) {
      if (!firstRejected) firstRejected = candidate;
      continue;
    }

    const gate = evaluateLoginAudience(primaryUrl, candidate.url, {
      label: candidate.label,
      pageTitle: context.pageTitle,
      pageContextText: context.pageContextText,
      // Modal on primary must not veto same-origin consumer audience accept.
      primaryHasModalLoginTrigger: false,
    });
    if (gate.accept) {
      return { accepted: candidate, rejected: firstRejected };
    }
    if (!firstRejected) {
      firstRejected = candidate;
    }
  }

  return { accepted: null, rejected: firstRejected };
}

function modalAudienceRejection(
  primaryUrl: string,
  rejected: DiscoveryCandidate | null,
  modalTriggers: ModalLoginTrigger[],
  partial: {
    redirectChain?: string[];
    finalUrlAfterRedirects?: string;
    candidates?: DiscoveryCandidate[];
  },
  context?: { pageTitle?: string; pageContextText?: string },
): DiscoveryResult {
  const hasModal = modalTriggers.length > 0;
  const rejectedUrl = rejected?.url;

  let portalRejected = false;
  if (rejectedUrl) {
    const gate = evaluateLoginAudience(primaryUrl, rejectedUrl, {
      label: rejected?.label,
      pageTitle: context?.pageTitle,
      pageContextText: context?.pageContextText,
      primaryHasModalLoginTrigger: hasModal,
    });
    portalRejected =
      !gate.accept &&
      (gate.code === 'alternate_audience_portal' ||
        gate.code === 'page_context_alternate_audience' ||
        isAlternateAudiencePortalUrl(rejectedUrl));
  }

  if (hasModal && portalRejected) {
    return {
      ...discoveryFailure(primaryUrl, 'modal_with_alternate_audience', {
        ...partial,
        modalTrigger: modalTriggers[0],
        candidates: partial.candidates,
      }),
      reason: MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
      loginEntryType: 'modal',
      usesModal: true,
      rejectedLoginUrl: rejectedUrl,
    };
  }

  if (hasModal) {
    return {
      ...discoveryFailure(primaryUrl, 'consumer_login_is_modal', {
        ...partial,
        modalTrigger: modalTriggers[0],
        candidates: partial.candidates,
      }),
      reason: CONSUMER_LOGIN_MODAL_REASON,
      loginEntryType: 'modal',
      usesModal: true,
      rejectedLoginUrl: portalRejected ? rejectedUrl : undefined,
    };
  }

  // Consumer primary that surfaces a business/admin portal login candidate:
  // treat as modal-style / needs_review — never store the portal (or a generic
  // /login path that commonly redirects into that portal).
  if (portalRejected && rejectedUrl) {
    return {
      ...discoveryFailure(primaryUrl, 'modal_with_alternate_audience', {
        ...partial,
        candidates: partial.candidates,
      }),
      reason: MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
      loginEntryType: 'modal',
      usesModal: true,
      rejectedLoginUrl: rejectedUrl,
    };
  }

  return {
    ...discoveryFailure(primaryUrl, 'cross_subdomain_untrusted', {
      ...partial,
      candidates: partial.candidates,
    }),
    reason: rejectedUrl
      ? CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON
      : CONSUMER_LOGIN_MODAL_REASON,
    loginEntryType: 'unknown',
    usesModal: false,
    rejectedLoginUrl: rejectedUrl,
  };
}

/**
 * Phase 108 discovery with audience + modal gates.
 * Modal-login services never receive an auto-valid navigable loginUrl.
 */
export async function discoverLoginEntry(
  primaryUrl: string,
  options: DiscoverLoginEntryOptions = {},
): Promise<DiscoveryResult> {
  const normalizedPrimary = normalizePrimaryUrl(primaryUrl);
  if (!normalizedPrimary) {
    return discoveryFailure(primaryUrl, 'invalid_primary_url');
  }

  const followRedirects = options.followRedirects ?? true;
  const tryCommonPaths = options.tryCommonPaths ?? true;

  const allCandidates: DiscoveryCandidate[] = [];
  let modalTriggers: ModalLoginTrigger[] = [];
  let redirectChain: string[] | undefined;
  let finalUrlAfterRedirects: string | undefined;
  let pageTitle: string | undefined;
  let pageContextText: string | undefined;

  const pageUrl = options.pageUrl ?? normalizedPrimary;
  const htmlSnapshot =
    Boolean(options.assumeVisible) || Boolean(options.html && !options.document);
  const documentRoot =
    options.document ??
    (options.html ? documentFromHtml(options.html) : undefined);

  const partialBase = () => ({
    redirectChain,
    finalUrlAfterRedirects,
    candidates: allCandidates,
  });

  if (documentRoot) {
    pageTitle = documentRoot.title?.trim() || undefined;
    pageContextText = extractPageAudienceContextText(documentRoot);

    const inspection = inspectPageForLoginEntry(documentRoot, pageUrl, {
      htmlSnapshot,
    });
    allCandidates.push(...inspection.candidates);
    modalTriggers = inspection.modalTriggers;

    const portalOnPage = findAlternatePortalCandidate(
      normalizedPrimary,
      inspection.candidates,
      {
        pageTitle,
        pageContextText,
        primaryHasModalLoginTrigger: modalTriggers.length > 0,
      },
    );

    const audienceContext = {
      pageUrl,
      pageTitle,
      pageContextText,
      primaryHasModalLoginTrigger: modalTriggers.length > 0,
      pageHasAlternatePortalCandidate: Boolean(portalOnPage),
    };

    const { accepted, rejected } = pickAudienceSafeCandidate(
      normalizedPrimary,
      inspection.candidates,
      audienceContext,
    );

    // Navigable consumer wins even when homepage also has a modal trigger (D-108-16).
    if (accepted) {
      return discoverySuccess(
        normalizedPrimary,
        accepted.url,
        accepted.method,
        accepted.confidence,
        {
          candidates: allCandidates,
          modalTrigger: modalTriggers[0],
          loginEntryType: 'navigable',
          usesModal: modalTriggers.length > 0,
          rejectedLoginUrl: (portalOnPage ?? rejected)?.url,
        },
      );
    }

    // Modal-only when no remaining consumer navigable candidate.
    if (modalTriggers.length > 0) {
      return modalAudienceRejection(
        normalizedPrimary,
        portalOnPage ?? rejected,
        modalTriggers,
        partialBase(),
        { pageTitle, pageContextText },
      );
    }

    // Portal rejected with no consumer candidate — do not invent a navigable URL.
    if (portalOnPage || rejected) {
      return modalAudienceRejection(
        normalizedPrimary,
        portalOnPage ?? rejected,
        modalTriggers,
        partialBase(),
        { pageTitle, pageContextText },
      );
    }
  }

  if (followRedirects && !normalizedPrimary.startsWith('/')) {
    const redirectResult = await followHttpRedirects(normalizedPrimary);
    redirectChain = redirectResult.redirectChain;
    finalUrlAfterRedirects = redirectResult.finalUrl;

    if (
      redirectResult.ok &&
      redirectResult.finalUrl &&
      redirectResult.finalUrl !== normalizedPrimary &&
      redirectResultLooksLikeLogin(redirectResult)
    ) {
      const gate = evaluateLoginAudience(normalizedPrimary, redirectResult.finalUrl, {
        primaryHasModalLoginTrigger: false,
      });
      if (!gate.accept || isAlternateAudiencePortalUrl(redirectResult.finalUrl)) {
        const rejected: DiscoveryCandidate = {
          url: redirectResult.finalUrl,
          method: 'redirect',
          confidence: 'medium',
          score: 14,
        };
        return modalAudienceRejection(
          normalizedPrimary,
          rejected,
          modalTriggers,
          partialBase(),
          { pageTitle, pageContextText },
        );
      }

      return discoverySuccess(
        normalizedPrimary,
        redirectResult.finalUrl,
        'redirect',
        'medium',
        {
          redirectChain,
          finalUrlAfterRedirects,
          candidates: allCandidates,
          modalTrigger: modalTriggers[0],
          loginEntryType: 'navigable',
          usesModal: modalTriggers.length > 0,
        },
      );
    }
  }

  if (tryCommonPaths) {
    if (modalTriggers.length > 0) {
      return {
        ...discoveryFailure(normalizedPrimary, 'consumer_login_is_modal', {
          ...partialBase(),
          modalTrigger: modalTriggers[0],
        }),
        reason: CONSUMER_LOGIN_MODAL_REASON,
        loginEntryType: 'modal',
        usesModal: true,
      };
    }

    // Never invent /login fallbacks when a portal candidate was already seen.
    const portalSeen = allCandidates.some((c) => isAlternateAudiencePortalUrl(c.url));
    if (portalSeen) {
      const portal = allCandidates.find((c) => isAlternateAudiencePortalUrl(c.url)) ?? null;
      return modalAudienceRejection(
        normalizedPrimary,
        portal,
        modalTriggers,
        partialBase(),
        { pageTitle, pageContextText },
      );
    }

    const pathCandidates = buildCommonPathCandidateEntries(normalizedPrimary);
    allCandidates.push(...pathCandidates);

    const { accepted, rejected } = pickAudienceSafeCandidate(
      normalizedPrimary,
      pathCandidates,
      {
        pageTitle,
        pageContextText,
        primaryHasModalLoginTrigger: false,
        pageHasAlternatePortalCandidate: false,
      },
    );

    if (accepted) {
      return discoverySuccess(
        normalizedPrimary,
        accepted.url,
        'common-path',
        'low',
        {
          redirectChain,
          finalUrlAfterRedirects,
          candidates: allCandidates,
          loginEntryType: 'navigable',
          usesModal: false,
        },
      );
    }

    if (rejected) {
      return modalAudienceRejection(
        normalizedPrimary,
        rejected,
        modalTriggers,
        partialBase(),
        { pageTitle, pageContextText },
      );
    }
  }

  if (modalTriggers.length > 0) {
    return {
      ...discoveryFailure(normalizedPrimary, 'consumer_login_is_modal', {
        redirectChain,
        finalUrlAfterRedirects,
        modalTrigger: modalTriggers[0],
        candidates: allCandidates,
      }),
      reason: CONSUMER_LOGIN_MODAL_REASON,
      loginEntryType: 'modal',
      usesModal: true,
    };
  }

  return discoveryFailure(normalizedPrimary, 'login_entry_not_found', {
    redirectChain,
    finalUrlAfterRedirects,
    candidates: allCandidates,
  });
}

export {
  ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
  CONSUMER_LOGIN_MODAL_REASON,
  CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
  MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
};
