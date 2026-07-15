import {
  discoveryFailure,
  discoverySuccess,
  type DiscoveryCandidate,
  type DiscoveryConfidence,
  type DiscoveryMethod,
  type DiscoveryResult,
  type ModalLoginTrigger,
} from './discoveryResult';
import { COMMON_LOGIN_PATH_FALLBACKS } from './discoveryKeywords';
import {
  documentFromHtml,
  normalizePrimaryUrl,
  urlLooksLikeLoginDestination,
} from './discoveryUtils';
import {
  ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
  CONSUMER_LOGIN_MODAL_REASON,
  CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
  MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
  canonicalizeFederatedIdPLoginUrl,
  evaluateLoginAudience,
  extractPageAudienceContextText,
  isAlternateAudiencePortalUrl,
  isFederatedIdPWithBrandReturn,
  isSameBrandHost,
  isSiblingTldSameBrand,
  isTrustedAuthSubdomain,
  pathLooksLikeConsumerSignIn,
} from './loginAudienceGate';
import {
  buildCommonPathCandidateEntries,
  inspectDedicatedLoginPage,
  inspectPageForLoginEntry,
} from './pageInspector';
import { followHttpRedirects, redirectResultLooksLikeLogin } from './redirectFollower';
import { buildTrustedAuthHostProbeUrls } from './trustedAuthProbe';
import { htmlHasConsumerIdentityField, htmlLooksLikeLoginSpaShell } from './liveCandidateValidation';

export interface DiscoverLoginEntryOptions {
  document?: Document;
  html?: string;
  pageUrl?: string;
  followRedirects?: boolean;
  tryCommonPaths?: boolean;
  /** Probe same-brand AUTH_SUBDOMAIN_PREFIXES when DOM yields no high-confidence URL (D-108-24). */
  probeAuthHosts?: boolean;
  /**
   * Fixture / test map of probe URL → HTML (exact or origin+pathname key).
   * Takes precedence over fetchProbeHtml / network fetch.
   */
  probeHtmlByUrl?: Record<string, string>;
  /**
   * Optional probe fetcher (extension background).
   * `reached: false` = DNS/network miss (do not invent).
   * `reached: true` + non-OK status = host answered (e.g. 404) — still do not invent login.
   */
  fetchProbeHtml?: (url: string) => Promise<{
    ok: boolean;
    reached?: boolean;
    status?: number;
    html?: string;
    finalUrl?: string;
    reason?: string;
    dnsExists?: boolean;
  }>;
  /**
   * @deprecated Removed — unverified auth-host invent caused retail false positives.
   * Reachability must come from SW HTML / DNS / in-page no-cors (dnsExists).
   */
  allowUnverifiedAuthLoginInvent?: boolean;
  /** Treat elements as visible without layout geometry (tests / HTML snapshots). */
  assumeVisible?: boolean;
  /**
   * Primary page already has an alternate-audience portal candidate (sa.*, …).
   * Suppresses soft-ACCEPT of bare same-host `/login` without identity fields
   * (retail portal dual-gate / D-108-30).
   */
  pageHasAlternatePortalCandidate?: boolean;
  /**
   * Homepage has a modal/dialog login trigger. Same-host bare `/login` without
   * identity fields must not soft-ACCEPT (modal is the consumer path on retail).
   */
  primaryHasModalLoginTrigger?: boolean;
}

type ProbeLoadResult =
  | {
      reached: true;
      ok: true;
      status: number;
      html: string;
      finalUrl: string;
    }
  | {
      reached: true;
      ok: false;
      status: number;
      html?: string;
      finalUrl?: string;
      dnsExists?: boolean;
    }
  | { reached: false };

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

function probeHtmlLookupKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '') || '/'}`;
  } catch {
    return url;
  }
}

async function loadProbeResult(
  url: string,
  options: DiscoverLoginEntryOptions,
): Promise<ProbeLoadResult> {
  const key = probeHtmlLookupKey(url);
  if (options.probeHtmlByUrl) {
    for (const [mapKey, html] of Object.entries(options.probeHtmlByUrl)) {
      if (probeHtmlLookupKey(mapKey) === key || mapKey === url) {
        return {
          reached: true,
          ok: true,
          status: 200,
          html,
          finalUrl: url,
        };
      }
    }
    // Explicit fixture map present but URL unmapped → treat as unreachable invent.
    if (!options.fetchProbeHtml) {
      return { reached: false };
    }
  }

  const fetcher = options.fetchProbeHtml;
  if (!fetcher) {
    return { reached: false };
  }

  const result = await fetcher(url);
  const reached =
    typeof result.reached === 'boolean'
      ? result.reached
      : Boolean(result.ok) || typeof result.status === 'number';
  if (!reached) {
    return { reached: false };
  }

  const status = typeof result.status === 'number' ? result.status : result.ok ? 200 : 0;
  if (result.ok && typeof result.html === 'string') {
    return {
      reached: true,
      ok: true,
      status: status || 200,
      html: result.html,
      finalUrl: result.finalUrl ?? url,
    };
  }

  return {
    reached: true,
    ok: false,
    status: status || 0,
    html: typeof result.html === 'string' ? result.html : undefined,
    finalUrl: result.finalUrl,
    dnsExists: result.dnsExists === true,
  };
}

/**
 * Validate a candidate URL as a consumer login page (D-108-24…26).
 * Prefer password-form evidence + audience accept.
 *
 * Trusted-auth probes (U24):
 * - Host unreachable (`reached: false`) → never invent (keeps retail FALSE_POSITIVE NULL).
 * - HTTP 4xx/5xx → never invent.
 * - HTTP 2xx/3xx on same-brand trusted-auth login path with non-error HTML
 *   (including SPA shells without a static password field) → ACCEPT.
 */
async function validateConsumerLoginPageUrl(
  primaryUrl: string,
  candidateUrl: string,
  options: DiscoverLoginEntryOptions,
): Promise<{
  url: string;
  method: DiscoveryMethod;
  confidence: DiscoveryConfidence;
} | null> {
  if (isAlternateAudiencePortalUrl(candidateUrl)) {
    return null;
  }

  const gate = evaluateLoginAudience(primaryUrl, candidateUrl, {
    primaryHasModalLoginTrigger: false,
  });
  if (!gate.accept) {
    return null;
  }

  // Dual-gate (D-108-30): homepage modal and/or portal sibling means consumer
  // entry is not a bare same-host `/login` invent — even if that path is reachable
  // or has form fields (retail comparison sites).
  // Exception: when the tab under inspection *is* that `/login` page (dedicated form).
  const inspectingThisLoginPage = (() => {
    if (!options.pageUrl) {
      return false;
    }
    try {
      return probeHtmlLookupKey(options.pageUrl) === probeHtmlLookupKey(candidateUrl);
    } catch {
      return false;
    }
  })();

  if (
    !inspectingThisLoginPage &&
    (options.pageHasAlternatePortalCandidate ||
      options.primaryHasModalLoginTrigger) &&
    isSameHostBareCommonLoginPath(primaryUrl, candidateUrl)
  ) {
    return null;
  }

  const isSameBrandTrustedAuthLoginPath = (url: string): boolean => {
    try {
      const host = new URL(url).hostname;
      return (
        isSameBrandHost(primaryUrl, url) &&
        isTrustedAuthSubdomain(host) &&
        (isGenericLoginPathUrl(url) || urlLooksLikeLoginDestination(url))
      );
    } catch {
      return false;
    }
  };

  /**
   * Same-host or sibling-TLD (or trusted-auth) consumer sign-in path soft-ACCEPT
   * for SPA / bot-gated pages without static identity fields (D-108-28 / D-108-29).
   * Bare `/login` without fields is suppressed when primary has a portal sibling (D-108-30).
   */
  const isConsumerSignInSoftPath = (url: string): boolean => {
    try {
      const primaryHost = new URL(primaryUrl).hostname;
      const candidateHost = new URL(url).hostname;
      const sameHost =
        primaryHost.replace(/^www\./i, '').toLowerCase() ===
        candidateHost.replace(/^www\./i, '').toLowerCase();
      const sibling = isSiblingTldSameBrand(primaryUrl, url);
      const trusted = isTrustedAuthSubdomain(candidateHost);
      if (!isSameBrandHost(primaryUrl, url)) {
        return false;
      }
      if (!(sameHost || sibling || trusted)) {
        return false;
      }
      const pathOk =
        isGenericLoginPathUrl(url) ||
        pathLooksLikeConsumerSignIn(url) ||
        urlLooksLikeLoginDestination(url);
      if (!pathOk) {
        return false;
      }
      // Dual-gate: portal on homepage + bare /login invent must not soft-ACCEPT.
      if (
        options.pageHasAlternatePortalCandidate &&
        isGenericLoginPathUrl(url) &&
        sameHost &&
        !sibling &&
        !trusted
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  /** Same-host bare `/login` next to a homepage modal → modal is the consumer surface. */
  const blockBareLoginSoftAcceptBesideModal = (url: string): boolean =>
    Boolean(options.primaryHasModalLoginTrigger) &&
    isSameHostBareCommonLoginPath(primaryUrl, url);

  const softAcceptCandidate = (): {
    url: string;
    method: DiscoveryMethod;
    confidence: DiscoveryConfidence;
  } => ({
    // Prefer scored candidate URL (PayPal /login over bot redirect /signin).
    url: candidateUrl,
    method: 'dedicated-login-page',
    confidence: 'medium',
  });

  const acceptFromDocument = (
    documentRoot: Document,
    page: string,
  ): {
    url: string;
    method: DiscoveryMethod;
    confidence: DiscoveryConfidence;
  } | null => {
    if (isAlternateAudiencePortalUrl(page)) {
      return null;
    }
    const pageAudience = evaluateLoginAudience(primaryUrl, page, {
      pageTitle: documentRoot.title?.trim() || undefined,
      pageContextText: extractPageAudienceContextText(documentRoot),
      primaryHasModalLoginTrigger: false,
    });
    if (!pageAudience.accept) {
      return null;
    }
    if (isDeadOrErrorLoginPage(documentRoot)) {
      return null;
    }

    const dedicated = inspectDedicatedLoginPage(documentRoot, page, {
      htmlSnapshot: true,
    });
    if (dedicated) {
      return {
        url: page,
        method: 'dedicated-login-page',
        confidence:
          dedicated.confidence === 'low' ? 'medium' : dedicated.confidence,
      };
    }

    const hasIdentity = htmlHasConsumerIdentityField(documentRoot, {
      htmlSnapshot: true,
    });
    const sameBrandConsumerSignIn =
      isSameBrandHost(primaryUrl, page) &&
      (isGenericLoginPathUrl(page) ||
        pathLooksLikeConsumerSignIn(page) ||
        urlLooksLikeLoginDestination(page));

    if (hasIdentity && sameBrandConsumerSignIn) {
      return {
        url: page,
        method: 'dedicated-login-page',
        confidence: 'medium',
      };
    }

    if (isSameBrandTrustedAuthLoginPath(candidateUrl)) {
      return softAcceptCandidate();
    }

    // M14 federated IdP + brand-return (Trello) — SPA may lack static fields.
    if (isFederatedIdPWithBrandReturn(primaryUrl, page)) {
      return {
        url: page,
        method: 'dedicated-login-page',
        confidence: 'medium',
      };
    }

    // PayPal/Zoom-class: login SPA title without static identity inputs.
    // Not when homepage modal owns consumer entry beside bare /login (retail).
    if (
      isConsumerSignInSoftPath(page) &&
      !blockBareLoginSoftAcceptBesideModal(page) &&
      (hasIdentity || htmlLooksLikeLoginSpaShell(documentRoot))
    ) {
      return softAcceptCandidate();
    }

    return null;
  };

  // Candidate is the page already under inspection — use live DOM (D-108-28).
  if (options.document && options.pageUrl) {
    try {
      const pageParsed = new URL(options.pageUrl);
      const candParsed = new URL(candidateUrl);
      const pageKey = `${pageParsed.origin}${pageParsed.pathname.replace(/\/$/, '') || '/'}`;
      const candKey = `${candParsed.origin}${candParsed.pathname.replace(/\/$/, '') || '/'}`;
      if (pageKey === candKey) {
        const fromDoc = acceptFromDocument(options.document, options.pageUrl);
        if (fromDoc) {
          return fromDoc;
        }
      }
    } catch {
      // fall through to probe
    }
  }

  const probe = await loadProbeResult(candidateUrl, options);
  // Unreachable path: try same-host origin. NXDOMAIN stays unreached (no invent).
  // A live auth host whose /login is blocked/empty can still prove reachability.
  let effective = probe;
  if (!probe.reached && isSameBrandTrustedAuthLoginPath(candidateUrl)) {
    try {
      const originUrl = new URL(candidateUrl).origin + '/';
      const originProbe = await loadProbeResult(originUrl, options);
      if (originProbe.reached && originProbe.ok && originProbe.status < 400) {
        effective = {
          reached: true,
          ok: true,
          status: originProbe.status,
          html: originProbe.html ?? '',
          finalUrl: candidateUrl,
        };
      }
    } catch {
      // keep unreachable
    }
  }

  if (!effective.reached) {
    return null;
  }

  // Host answered with error: soft-ACCEPT gated auth / consumer sign-in hosts
  // (401/403/429) or DNS-proven hosts whose HTML fetch failed (status 0).
  // Reject clear 404. PayPal /login is often DataDome 403 (D-108-28 live).
  if (!effective.ok || effective.status >= 400) {
    if (
      isSameBrandTrustedAuthLoginPath(candidateUrl) &&
      trustedAuthProbeMaySoftAccept(effective)
    ) {
      return softAcceptCandidate();
    }
    if (
      isConsumerSignInSoftPath(candidateUrl) &&
      trustedAuthProbeMaySoftAccept(effective) &&
      !blockBareLoginSoftAcceptBesideModal(candidateUrl)
    ) {
      const html =
        'html' in effective && typeof effective.html === 'string'
          ? effective.html
          : undefined;
      // Same-host bare /login: only PayPal-class bot/WAF gates — not invent 403 stubs.
      if (isSameHostBareCommonLoginPath(primaryUrl, candidateUrl)) {
        if (looksLikeBotGateHtml(html)) {
          return softAcceptCandidate();
        }
        return null;
      }
      return softAcceptCandidate();
    }
    return null;
  }

  const pageUrl =
    (effective.ok && effective.finalUrl) || candidateUrl;
  if (isAlternateAudiencePortalUrl(pageUrl)) {
    return null;
  }

  const finalGate = evaluateLoginAudience(primaryUrl, pageUrl, {
    primaryHasModalLoginTrigger: false,
  });
  if (!finalGate.accept) {
    return null;
  }

  const html = 'html' in effective && effective.ok ? effective.html ?? '' : '';
  if (html) {
    const documentRoot = documentFromHtml(html);
    // Only treat as dead when inspecting the candidate login URL itself,
    // not when we borrowed origin HTML solely for reachability.
    if (probe.reached && isDeadOrErrorLoginPage(documentRoot)) {
      return null;
    }

    // D-108-30: re-check alternate-audience on loaded document URL BEFORE fields.
    if (isAlternateAudiencePortalUrl(pageUrl)) {
      return null;
    }
    const pageAudience = evaluateLoginAudience(primaryUrl, pageUrl, {
      pageTitle: documentRoot.title?.trim() || undefined,
      pageContextText: extractPageAudienceContextText(documentRoot),
      primaryHasModalLoginTrigger: false,
    });
    if (!pageAudience.accept) {
      return null;
    }

    if (probe.reached) {
      const dedicated = inspectDedicatedLoginPage(documentRoot, pageUrl, {
        htmlSnapshot: true,
      });
      if (dedicated) {
        return softAcceptCandidate();
      }
    }

    // D-108-28: reachable login surface + ≥1 identity field (email/user/phone/password).
    // Fields never override portal reject (already applied above).
    const hasIdentity = htmlHasConsumerIdentityField(documentRoot, {
      htmlSnapshot: true,
    });
    const sameBrandConsumerSignIn =
      isSameBrandHost(primaryUrl, pageUrl) &&
      (isGenericLoginPathUrl(pageUrl) ||
        pathLooksLikeConsumerSignIn(pageUrl) ||
        urlLooksLikeLoginDestination(pageUrl));

    if (hasIdentity && sameBrandConsumerSignIn) {
      return softAcceptCandidate();
    }

    // M13 trusted-auth SPA / soft shell without static fields (do not regress KSP).
    if (isSameBrandTrustedAuthLoginPath(candidateUrl)) {
      return softAcceptCandidate();
    }

    // M14 federated IdP + brand-return (Trello) — reachable SPA may lack static fields.
    if (isFederatedIdPWithBrandReturn(primaryUrl, pageUrl)) {
      return {
        url: pageUrl,
        method: 'dedicated-login-page',
        confidence: 'medium',
      };
    }

    // Zoom sibling-TLD / PayPal same-host SPA shell: title "Sign In" without inputs.
    if (
      isConsumerSignInSoftPath(candidateUrl) &&
      !blockBareLoginSoftAcceptBesideModal(candidateUrl) &&
      (hasIdentity || htmlLooksLikeLoginSpaShell(documentRoot))
    ) {
      return softAcceptCandidate();
    }

    return null;
  }

  // 2xx with empty body on trusted-auth / federated — host answered.
  // Do NOT soft-ACCEPT empty same-host bare /login invents (retail FP).
  if (isSameBrandTrustedAuthLoginPath(candidateUrl)) {
    return softAcceptCandidate();
  }
  if (isFederatedIdPWithBrandReturn(primaryUrl, candidateUrl)) {
    return softAcceptCandidate();
  }
  if (
    isConsumerSignInSoftPath(candidateUrl) &&
    !isSameHostBareCommonLoginPath(primaryUrl, candidateUrl) &&
    !blockBareLoginSoftAcceptBesideModal(candidateUrl)
  ) {
    return softAcceptCandidate();
  }

  return null;
}

/**
 * Soft-ACCEPT when the auth host is proven to exist even without a clean 2xx HTML body:
 * - DNS resolves but HTML fetch failed (status 0 / dnsExists)
 * - Bot/gateway gates: 401 / 403 / 429
 * Never soft-ACCEPT HTTP 404 (dead invent path).
 */
function trustedAuthProbeMaySoftAccept(probe: {
  status: number;
  dnsExists?: boolean;
}): boolean {
  if (probe.status === 404) {
    return false;
  }
  if (probe.dnsExists === true || probe.status === 0) {
    return true;
  }
  return probe.status === 401 || probe.status === 403 || probe.status === 429;
}

/** PayPal-class bot / WAF challenge HTML (not a real consumer login form). */
function looksLikeBotGateHtml(html: string | undefined): boolean {
  if (!html) {
    return false;
  }
  return /datadome|captcha|cf-challenge|attention required|access denied|cloudflare|bot[\s_-]?detect|perimeterx|akamai/i.test(
    html,
  );
}

function isSameHostBareCommonLoginPath(primaryUrl: string, candidateUrl: string): boolean {
  try {
    const primaryHost = new URL(primaryUrl).hostname.replace(/^www\./i, '').toLowerCase();
    const candidateHost = new URL(candidateUrl).hostname.replace(/^www\./i, '').toLowerCase();
    return primaryHost === candidateHost && isGenericLoginPathUrl(candidateUrl);
  } catch {
    return false;
  }
}

/** Dead / error pages must not soft-accept as consumer login (false invent). */
function isDeadOrErrorLoginPage(documentRoot: Document): boolean {
  const title = (documentRoot.title ?? '').trim();
  const body = (documentRoot.body?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const blob = `${title}\n${body}`;
  return /(?:^|\b)404\b|not found|page not found|cannot be found|doesn't exist|דף לא נמצא|העמוד לא נמצא|לא קיים/i.test(
    blob,
  );
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
      const canonicalUrl = canonicalizeFederatedIdPLoginUrl(primaryUrl, candidate.url);
      if (canonicalUrl !== candidate.url) {
        return {
          accepted: { ...candidate, url: canonicalUrl },
          rejected: firstRejected,
        };
      }
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
 * D-108-28: before no_login_page_found / modal-only, live-validate ranked candidates.
 * Audience REJECT runs first inside validateConsumerLoginPageUrl (fields never accept portals).
 */
async function liveValidateTopCandidates(
  primaryUrl: string,
  allCandidates: DiscoveryCandidate[],
  options: DiscoverLoginEntryOptions,
  extra?: {
    usesModal?: boolean;
    modalTrigger?: ModalLoginTrigger;
    rejectedLoginUrl?: string;
    redirectChain?: string[];
    finalUrlAfterRedirects?: string;
  },
): Promise<DiscoveryResult | null> {
  const ranked = [...allCandidates]
    .filter((c) => Boolean(c.url) && !isAlternateAudiencePortalUrl(c.url))
    .filter((c) => {
      // Dual-gate: never promote bare same-host /login invent beside portal or homepage modal.
      // Keep candidate when the current document is already that login page.
      const inspectingThis =
        options.pageUrl &&
        (() => {
          try {
            return probeHtmlLookupKey(options.pageUrl!) === probeHtmlLookupKey(c.url);
          } catch {
            return false;
          }
        })();
      if (
        !inspectingThis &&
        (options.pageHasAlternatePortalCandidate ||
          options.primaryHasModalLoginTrigger) &&
        isSameHostBareCommonLoginPath(primaryUrl, c.url)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const seen = new Set<string>();
  for (const candidate of ranked) {
    const key = candidate.url;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const validated = await validateConsumerLoginPageUrl(
      primaryUrl,
      candidate.url,
      options,
    );
    if (validated) {
      return discoverySuccess(
        primaryUrl,
        validated.url,
        validated.method,
        validated.confidence,
        {
          redirectChain: extra?.redirectChain,
          finalUrlAfterRedirects: extra?.finalUrlAfterRedirects,
          candidates: allCandidates,
          loginEntryType: 'navigable',
          usesModal: Boolean(extra?.usesModal),
          modalTrigger: extra?.modalTrigger,
          rejectedLoginUrl: extra?.rejectedLoginUrl,
        },
      );
    }
  }
  return null;
}

/**
 * Probe same-brand trusted-auth hosts (D-108-24 / U24).
 * Mutates `allCandidates` with probe diagnostics. Returns success result or null.
 */
async function tryProbeTrustedAuthHosts(
  primaryUrl: string,
  options: DiscoverLoginEntryOptions,
  allCandidates: DiscoveryCandidate[],
  extra?: {
    redirectChain?: string[];
    finalUrlAfterRedirects?: string;
    usesModal?: boolean;
    modalTrigger?: ModalLoginTrigger;
  },
): Promise<DiscoveryResult | null> {
  const probeUrls = buildTrustedAuthHostProbeUrls(primaryUrl);
  for (const probeUrl of probeUrls) {
    const probeCandidate: DiscoveryCandidate = {
      url: probeUrl,
      method: 'common-path',
      confidence: 'low',
      label: probeUrl,
      score: 8,
    };
    allCandidates.push(probeCandidate);

    const validated = await validateConsumerLoginPageUrl(primaryUrl, probeUrl, options);
    if (validated) {
      return discoverySuccess(
        primaryUrl,
        validated.url,
        validated.method,
        validated.confidence,
        {
          redirectChain: extra?.redirectChain,
          finalUrlAfterRedirects: extra?.finalUrlAfterRedirects,
          candidates: allCandidates,
          loginEntryType: 'navigable',
          usesModal: Boolean(extra?.usesModal),
          modalTrigger: extra?.modalTrigger,
        },
      );
    }
  }

  return null;
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
  const probeAuthHosts = options.probeAuthHosts ?? true;

  const allCandidates: DiscoveryCandidate[] = [];
  let modalTriggers: ModalLoginTrigger[] = [];
  let redirectChain: string[] | undefined;
  let finalUrlAfterRedirects: string | undefined;
  let pageTitle: string | undefined;
  let pageContextText: string | undefined;
  let authHostsProbed = false;

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

    const validateOptions: DiscoverLoginEntryOptions = {
      ...options,
      pageHasAlternatePortalCandidate: Boolean(portalOnPage),
      primaryHasModalLoginTrigger: modalTriggers.length > 0,
    };

    const { accepted, rejected } = pickAudienceSafeCandidate(
      normalizedPrimary,
      inspection.candidates,
      audienceContext,
    );

    // Navigable consumer wins even when homepage also has a modal trigger (D-108-16).
    // D-108-28: path/link score alone is insufficient — live-validate before persist.
    if (accepted) {
      const live = await validateConsumerLoginPageUrl(
        normalizedPrimary,
        accepted.url,
        validateOptions,
      );
      if (live) {
      return discoverySuccess(
          normalizedPrimary,
          live.url,
          live.method,
          live.confidence,
          {
            candidates: allCandidates,
            modalTrigger: modalTriggers[0],
            loginEntryType: 'navigable',
            usesModal: modalTriggers.length > 0,
            rejectedLoginUrl: (portalOnPage ?? rejected)?.url,
          },
        );
      }
    }

    // D-108-28: open/inspect top scored candidates before modal/not-found exit.
    {
      const liveFromTop = await liveValidateTopCandidates(
        normalizedPrimary,
        allCandidates,
        validateOptions,
        {
          usesModal: modalTriggers.length > 0,
          modalTrigger: modalTriggers[0],
          rejectedLoginUrl: (portalOnPage ?? rejected)?.url,
        },
      );
      if (liveFromTop) {
        return liveFromTop;
      }
    }

    // D-108-24 / U24: probe trusted-auth hosts before modal-only failure.
    // Skip when an alternate-audience portal is on the page (retail sa.*).
    // Skip invent when homepage modal + bare same-host /login candidates exist
    // without a trusted-auth DOM link (retail FP). Keep KSP-class invent when
    // modal alone (no /login link) — T41h / U24.
    if (probeAuthHosts && tryCommonPaths && !portalOnPage) {
      const hasTrustedAuthDomCandidate = allCandidates.some((c) => {
        try {
          return isTrustedAuthSubdomain(new URL(c.url).hostname);
        } catch {
          return false;
        }
      });
      const hasBareSameHostLoginCandidate = allCandidates.some((c) =>
        isSameHostBareCommonLoginPath(normalizedPrimary, c.url),
      );
      const skipAuthInventBesideModalLogin =
        modalTriggers.length > 0 &&
        !hasTrustedAuthDomCandidate &&
        hasBareSameHostLoginCandidate;
      if (!skipAuthInventBesideModalLogin) {
        authHostsProbed = true;
        const probed = await tryProbeTrustedAuthHosts(
          normalizedPrimary,
          validateOptions,
          allCandidates,
          {
            usesModal: modalTriggers.length > 0,
            modalTrigger: modalTriggers[0],
          },
        );
        if (probed) {
          return probed;
        }
      }
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

    // D-108-24: probe when not already attempted earlier (no-document path).
    if (probeAuthHosts && !authHostsProbed) {
      authHostsProbed = true;
      const probed = await tryProbeTrustedAuthHosts(
        normalizedPrimary,
        options,
        allCandidates,
        {
          redirectChain,
          finalUrlAfterRedirects,
          usesModal: false,
        },
      );
      if (probed) {
        return probed;
      }
    }

    // Modal-only on primary with no trusted-auth probe hit — do not invent apex /login.
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

    // D-108-25/26: same-origin common-path only after login-page validation.
    // Unvalidated dead invents (KSP ksp.co.il/login) must not win.
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
      const validated = await validateConsumerLoginPageUrl(
        normalizedPrimary,
        accepted.url,
        options,
      );
      if (validated) {
        return discoverySuccess(
          normalizedPrimary,
          validated.url,
          validated.method,
          validated.confidence,
        {
          redirectChain,
          finalUrlAfterRedirects,
          candidates: allCandidates,
            loginEntryType: 'navigable',
            usesModal: false,
          },
        );
      }
      // Keep weak invent in candidates for diagnostics; do not persist (D-108-25).
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

  // D-108-28: last chance — live-validate remaining scored candidates.
  if (allCandidates.length > 0) {
    const late = await liveValidateTopCandidates(
      normalizedPrimary,
      allCandidates,
      options,
      { redirectChain, finalUrlAfterRedirects },
    );
    if (late) {
      return late;
    }
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
