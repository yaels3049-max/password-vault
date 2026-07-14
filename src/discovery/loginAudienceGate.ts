import {
  AUTH_SUBDOMAIN_PREFIXES,
  FEDERATED_IDP_HOST_PREFIXES,
} from './discoveryKeywords';

/**
 * Subdomain labels that typically indicate a non-consumer portal audience
 * (business / admin / merchant / vendor / partner / employee).
 * Generic — not tied to any service brand.
 */
export const ALTERNATE_AUDIENCE_SUBDOMAIN_PREFIXES = [
  'sa',
  'seller',
  'sellers',
  'merchant',
  'merchants',
  'vendor',
  'vendors',
  'partner',
  'partners',
  'business',
  'admin',
  'admins',
  'b2b',
  'corporate',
  'reseller',
  'wholesale',
  'affiliate',
  'dealer',
  'supplier',
  'suppliers',
  'employee',
  'employees',
  'staff',
  'intranet',
  'portal-b2b',
  'biz',
  'manage',
  'management',
  'sellersarea',
  'sellerarea',
] as const;

/** Path markers that indicate an alternate (non-consumer) portal audience. */
export const ALTERNATE_AUDIENCE_PATH_MARKERS = [
  '/seller',
  '/merchant',
  '/vendor',
  '/partner',
  '/business',
  '/admin',
  '/b2b',
  '/corporate',
  '/reseller',
  '/wholesale',
  '/affiliate',
  '/employee',
  '/staff',
  '/intranet',
  '/manage',
  '/management',
  '/clients',
  '/client/',
  'clientslogin',
  'clients_login',
  'client-login',
  'sellerlogin',
  'merchantlogin',
  'partnerlogin',
  'businesslogin',
  'vendorlogin',
] as const;

/**
 * Compound path patterns: "clientsLogin", "seller_login", etc. — contain "login"
 * but address a non-consumer audience (same host is not enough to accept).
 */
const ALTERNATE_AUDIENCE_LOGIN_PATH_RE =
  /(clients?|sellers?|merchants?|vendors?|partners?|business|b2b|affiliate|wholesale|corporate)[_-]?(area|portal|zone)?[_-]?login|login[_-]?(clients?|sellers?|merchants?|vendors?|partners?|business)/i;

/** Query keys that typically select audience / entry type (not consumer home login). */
const ALTERNATE_AUDIENCE_QUERY_KEYS = [
  'typeentry',
  'entrytype',
  'usertype',
  'user_type',
  'portaltype',
  'portal_type',
  'accounttype',
  'account_type',
  'role',
  'audience',
] as const;

/**
 * Wording in URL path, query, link label, title, or headings that signals
 * a non-consumer audience. Hebrew + English; brand-agnostic.
 *
 * D-108-22: bare retail `כניסת לקוחות` is NOT a reject token (too common for
 * consumer banking/retail). Keep strong business markers only.
 *
 * D-108-23: do not add bare `portal` / `portals` / `ng-portals` — SPA shells
 * (Bank Hapoalim-class) use those path segments for consumer auth.
 */
export const ALTERNATE_AUDIENCE_WORDING = [
  'business',
  'merchant',
  'seller',
  'vendor',
  'partner',
  'affiliate',
  'wholesale',
  'reseller',
  'corporate',
  'employee',
  'staff',
  'admin',
  'b2b',
  'dealer',
  'supplier',
  'intranet',
  'management',
  'service provider',
  'business interface',
  'business portal',
  'seller area',
  'clientslogin',
  'clients login',
  'typeentry',
  'entrytype',
  'עסקי',
  'עסקית',
  'העסק',
  'לעסקים',
  'ממשק העסק',
  'כניסה לממשק העסק',
  'לממשק',
  'לקוחות עסקיים',
  'כניסת לקוחות עסקיים',
  'סוחר',
  'סוחרים',
  'ספק',
  'ספקים',
  'שותף',
  'שותפים',
  'עובד',
  'עובדים',
  'מנהל מערכת',
  'ממשק ניהול',
  'ניהול חנות',
  'אזור עסקי',
] as const;

/**
 * Exact Phase 108 reason when consumer login is modal and a portal candidate was rejected.
 */
export const MODAL_WITH_ALTERNATE_AUDIENCE_REASON =
  'Consumer login is modal-based; alternate portal candidate rejected.';

export const CONSUMER_LOGIN_MODAL_REASON =
  'Consumer login appears modal-based on the primary site; no dedicated consumer login URL was validated.';

export const ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON =
  'Discovered login candidate belongs to another audience (business/admin/merchant/vendor/partner), not the consumer service.';

export const CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON =
  'Cross-subdomain login candidate needs review; same brand alone is not sufficient confidence.';

export const PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON =
  'Candidate page title/navigation indicates a non-consumer portal audience.';

export type LoginAudienceDecision =
  | { accept: true }
  | {
      accept: false;
      code:
        | 'alternate_audience_portal'
        | 'cross_subdomain_untrusted'
        | 'page_context_alternate_audience'
        | 'invalid_candidate_url';
      reason: string;
      preferModalClassification: boolean;
    };

export interface CandidateAudienceContext {
  label?: string;
  /** Document title of the candidate or current page. */
  pageTitle?: string;
  /** Visible heading / nav snippets near the candidate. */
  pageContextText?: string;
  /** True when the primary site exposes a modal / non-navigable login trigger. */
  primaryHasModalLoginTrigger?: boolean;
}

function registrableDomainKey(hostname: string): string {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  const israeliPublicSuffix = /\.(co|org|ac|gov|muni)\.il$/i;
  if (israeliPublicSuffix.test(host)) {
    const withoutSuffix = host.replace(israeliPublicSuffix, '');
    const labels = withoutSuffix.split('.').filter(Boolean);
    return labels[labels.length - 1] ?? host;
  }

  const labels = host.split('.').filter(Boolean);
  if (labels.length >= 2) {
    return labels.slice(-2).join('.');
  }
  return host;
}

function subdomainLabels(hostname: string): string[] {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  const israeliPublicSuffix = /\.(co|org|ac|gov|muni)\.il$/i;
  let remainder = host;
  if (israeliPublicSuffix.test(host)) {
    remainder = host.replace(israeliPublicSuffix, '');
  } else {
    const labels = host.split('.').filter(Boolean);
    if (labels.length >= 2) {
      remainder = labels.slice(0, -2).join('.');
    } else {
      remainder = '';
    }
  }
  return remainder.split('.').filter(Boolean);
}

function sameHostname(a: string, b: string): boolean {
  return a.replace(/^www\./i, '').toLowerCase() === b.replace(/^www\./i, '').toLowerCase();
}

/**
 * Brand second-level label (D-108-29), e.g. zoom.com / zoom.us → "zoom",
 * auth.ksp.co.il → "ksp".
 */
export function brandSecondLevelLabel(hostname: string): string {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  const israeliPublicSuffix = /\.(co|org|ac|gov|muni)\.il$/i;
  if (israeliPublicSuffix.test(host)) {
    const withoutSuffix = host.replace(israeliPublicSuffix, '');
    const labels = withoutSuffix.split('.').filter(Boolean);
    return (labels[labels.length - 1] ?? withoutSuffix).toLowerCase();
  }
  const labels = host.split('.').filter(Boolean);
  if (labels.length >= 2) {
    return (labels[labels.length - 2] ?? labels[0]!).toLowerCase();
  }
  return host;
}

/**
 * Same second-level label across different public suffixes (zoom.com ↔ zoom.us).
 */
export function isSiblingTldSameBrand(primaryUrl: string, candidateUrl: string): boolean {
  try {
    const primary = new URL(primaryUrl);
    const candidate = new URL(candidateUrl);
    if (
      registrableDomainKey(primary.hostname) ===
      registrableDomainKey(candidate.hostname)
    ) {
      return false;
    }
    const a = brandSecondLevelLabel(primary.hostname);
    const b = brandSecondLevelLabel(candidate.hostname);
    return a.length >= 3 && a === b;
  } catch {
    return false;
  }
}

export function isSameBrandHost(primaryUrl: string, candidateUrl: string): boolean {
  try {
    const primary = new URL(primaryUrl);
    const candidate = new URL(candidateUrl);
    if (
      registrableDomainKey(primary.hostname) ===
      registrableDomainKey(candidate.hostname)
    ) {
      return true;
    }
    // D-108-29: sibling-TLD same SLD (zoom.com ↔ zoom.us).
    return isSiblingTldSameBrand(primaryUrl, candidateUrl);
  } catch {
    return false;
  }
}

export function textHasAlternateAudienceWording(text: string): boolean {
  const normalized = text.toLowerCase();
  return ALTERNATE_AUDIENCE_WORDING.some((token) => normalized.includes(token.toLowerCase()));
}

/**
 * D-108-23: bare application-shell path segments are not portal evidence.
 * Strip them before wording checks on URL haystacks so `ng-portals` cannot
 * be mistaken for business "portal" wording if tokens are ever expanded.
 */
function stripApplicationShellPathTokens(path: string): string {
  return path
    .toLowerCase()
    .replace(/\/ng-portals(?=\/|$)/g, '')
    .replace(/\/portals(?=\/|$)/g, '')
    .replace(/\/portal(?=\/|$)/g, '');
}

/** True when URL hostname/path/query strongly indicates a non-consumer portal. */
export function isAlternateAudiencePortalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    const pathForWording = stripApplicationShellPathTokens(path);
    const haystack = `${parsed.hostname}${pathForWording}${parsed.search}`.toLowerCase();
    const subs = subdomainLabels(parsed.hostname);

    if (
      subs.some((label) =>
        ALTERNATE_AUDIENCE_SUBDOMAIN_PREFIXES.includes(
          label as (typeof ALTERNATE_AUDIENCE_SUBDOMAIN_PREFIXES)[number],
        ),
      )
    ) {
      return true;
    }

    if (ALTERNATE_AUDIENCE_PATH_MARKERS.some((marker) => path.includes(marker))) {
      return true;
    }

    if (ALTERNATE_AUDIENCE_LOGIN_PATH_RE.test(pathForWording)) {
      return true;
    }

    for (const key of ALTERNATE_AUDIENCE_QUERY_KEYS) {
      if (search.includes(`${key}=`)) {
        return true;
      }
    }

    return textHasAlternateAudienceWording(haystack);
  } catch {
    return false;
  }
}

export function candidateLabelSuggestsAlternateAudience(label: string | undefined): boolean {
  if (!label) {
    return false;
  }
  return textHasAlternateAudienceWording(label);
}

export function isCrossSubdomainCandidate(primaryUrl: string, candidateUrl: string): boolean {
  try {
    const primary = new URL(primaryUrl);
    const candidate = new URL(candidateUrl);
    if (registrableDomainKey(primary.hostname) !== registrableDomainKey(candidate.hostname)) {
      return true;
    }
    return !sameHostname(primary.hostname, candidate.hostname);
  } catch {
    return true;
  }
}

export function isTrustedAuthSubdomain(hostname: string): boolean {
  const subs = subdomainLabels(hostname);
  return subs.some((label) =>
    AUTH_SUBDOMAIN_PREFIXES.includes(label as (typeof AUTH_SUBDOMAIN_PREFIXES)[number]),
  );
}

/** Trusted federated / parent IdP host (cross-registrable), D-108-27. */
export function isTrustedFederatedIdPHost(hostname: string): boolean {
  const subs = subdomainLabels(hostname);
  return subs.some((label) =>
    FEDERATED_IDP_HOST_PREFIXES.includes(
      label as (typeof FEDERATED_IDP_HOST_PREFIXES)[number],
    ),
  );
}

/** Query keys that bind an IdP login back to the primary product brand. */
const BRAND_RETURN_QUERY_KEYS = [
  'continue',
  'callback',
  'return',
  'return_url',
  'returnurl',
  'redirect_uri',
  'redirect_url',
  'redirect',
  'next',
  'relaystate',
  'application',
  'dest',
  'destination',
  'goto',
] as const;

function primaryBrandTokens(hostname: string): string[] {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  const tokens = new Set<string>([host]);
  const key = registrableDomainKey(hostname).toLowerCase();
  tokens.add(key);
  if (key.includes('.')) {
    tokens.add(key.split('.')[0] ?? key);
  }
  // Israeli-style brand key is already a bare label (e.g. brand).
  return [...tokens].filter((t) => t.length >= 3);
}

function valueContainsPrimaryBrand(value: string, tokens: string[], primaryHost: string): boolean {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // keep raw
  }
  const hay = decoded.toLowerCase();
  const host = primaryHost.replace(/^www\./i, '').toLowerCase();
  if (hay.includes(host)) {
    return true;
  }
  for (const token of tokens) {
    const t = token.toLowerCase();
    if (t.length >= 4 && hay.includes(t)) {
      return true;
    }
    // Short brand labels (len 3): require non-alnum boundaries.
    if (t.length === 3) {
      const re = new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`, 'i');
      if (re.test(hay)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Positive return-to-primary evidence on a candidate IdP URL (D-108-27).
 * `application=<brand>--direct-signup` counts (signup alone must not reject).
 */
export function hasPrimaryBrandReturnEvidence(
  primaryUrl: string,
  candidateUrl: string,
): boolean {
  try {
    const primary = new URL(primaryUrl);
    const candidate = new URL(candidateUrl);
    const tokens = primaryBrandTokens(primary.hostname);
    for (const [rawKey, value] of candidate.searchParams.entries()) {
      const key = rawKey.toLowerCase();
      const isReturnKey =
        BRAND_RETURN_QUERY_KEYS.includes(key as (typeof BRAND_RETURN_QUERY_KEYS)[number]) ||
        key.startsWith('redirect_');
      if (!isReturnKey) {
        continue;
      }
      if (valueContainsPrimaryBrand(value, tokens, primary.hostname)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** Federated IdP auth entry paths: login and signup shells that host the same IdP. */
export function pathLooksLikeFederatedIdPLogin(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /(?:^|\/)(?:login|signin|sign-in|logon|sso|auth|signup|sign-up|register)(?:\/|$|\.)/i.test(
      path,
    );
  } catch {
    return false;
  }
}

/**
 * Canonicalize federated IdP signup/register shells to `/login` (D-108-27).
 * Live product homes often link IdP host `/signup?...&continue=primary` while the
 * consumer login entry is the same host `/login` with brand-return query.
 * Returns the input unchanged when not a brand-return federated IdP URL.
 */
export function canonicalizeFederatedIdPLoginUrl(
  primaryUrl: string,
  candidateUrl: string,
): string {
  try {
    const parsed = new URL(candidateUrl);
    if (!isTrustedFederatedIdPHost(parsed.hostname)) {
      return candidateUrl;
    }
    if (!hasPrimaryBrandReturnEvidence(primaryUrl, candidateUrl)) {
      return candidateUrl;
    }
    if (!pathLooksLikeFederatedIdPLogin(candidateUrl)) {
      return candidateUrl;
    }
    const path = parsed.pathname.toLowerCase().replace(/\/$/, '') || '/';
    if (path === '/signup' || path === '/sign-up' || path === '/register') {
      parsed.pathname = '/login';
      return parsed.toString();
    }
    return candidateUrl;
  } catch {
    return candidateUrl;
  }
}

/**
 * True when candidate is (or canonicalizes to) a federated IdP login with
 * brand-return evidence — ACCEPT even if primary page context has portal-like wording.
 */
export function isFederatedIdPWithBrandReturn(
  primaryUrl: string,
  candidateUrl: string,
): boolean {
  try {
    const host = new URL(candidateUrl).hostname;
    return (
      isTrustedFederatedIdPHost(host) &&
      pathLooksLikeFederatedIdPLogin(candidateUrl) &&
      hasPrimaryBrandReturnEvidence(primaryUrl, candidateUrl)
    );
  } catch {
    return false;
  }
}

/**
 * Path strongly indicates a dedicated login *file* destination (e.g. Login.aspx).
 * Used as a narrow escape hatch for same-brand cross-subdomain consumer logins
 * when the host is not in AUTH_SUBDOMAIN_PREFIXES.
 * Intentionally does NOT match bare /login — that path is too common on portals.
 */
export function pathLooksLikeDedicatedConsumerLogin(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return (
      /(?:^|\/)pages\/login\.aspx$/i.test(path) ||
      /(?:^|\/)(?:login|signin|sign-in|logon)\.aspx$/i.test(path)
    );
  } catch {
    return false;
  }
}

/** Consumer sign-in path for sibling-TLD / same-brand navigable entries (D-108-29). */
export function pathLooksLikeConsumerSignIn(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase().replace(/\/$/, '') || '/';
    return /(?:^|\/)(?:login|signin|sign-in|logon|auth)(?:\/|$|\.)/i.test(path);
  } catch {
    return false;
  }
}

/**
 * Collect title + heading + nav text for audience context checks (brand-agnostic).
 */
export function extractPageAudienceContextText(documentRoot: Document): string {
  const parts: string[] = [];
  const title = documentRoot.title?.trim();
  if (title) {
    parts.push(title);
  }

  for (const el of documentRoot.querySelectorAll('h1, h2, h3, [role="heading"], nav, header')) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) {
      parts.push(text.slice(0, 240));
    }
  }

  return parts.join(' | ').slice(0, 4000);
}

/**
 * Gate whether a discovered login URL is acceptable as the consumer login entry
 * for the given primary site. Brand-agnostic audience + hostname + page context.
 *
 * Evaluation order (D-108-21 / AC-108-22):
 * 1. Strong positive alternate-audience on THIS candidate (URL / label) → reject
 * 2. Else same-brand trusted auth / dedicated consumer login path → ACCEPT
 *    even when `primaryHasModalLoginTrigger` is set
 * 3. Else modal / cross-subdomain / primary-page context rules
 *
 * Insufficient alone (never auto-validates):
 * - URL contains login/signin/account
 * - page contains username/password fields
 * - same brand / same root domain
 */
export function evaluateLoginAudience(
  primaryUrl: string,
  candidateUrl: string,
  options?: CandidateAudienceContext,
): LoginAudienceDecision {
  let candidateHost: string;
  try {
    candidateHost = new URL(candidateUrl).hostname;
  } catch {
    return {
      accept: false,
      code: 'invalid_candidate_url',
      reason: 'invalid_candidate_url',
      preferModalClassification: false,
    };
  }

  // (1) Strong positive alternate-audience on THIS candidate only.
  // Primary homepage wording/context must not veto here (D-108-21 / D-108-22).
  // Federated IdP + brand-return is never alternate-audience portal (D-108-27).
  if (
    !isFederatedIdPWithBrandReturn(primaryUrl, candidateUrl) &&
    (isAlternateAudiencePortalUrl(candidateUrl) ||
      candidateLabelSuggestsAlternateAudience(options?.label))
  ) {
    return {
      accept: false,
      code: 'alternate_audience_portal',
      reason: ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
      preferModalClassification: true,
    };
  }

  // (1b) Federated / parent IdP on a different registrable domain with brand-return
  // evidence (D-108-27 / AC-108-24). Includes /signup shells (canonicalize to /login).
  // Do not reject solely for "signup" in path or application=; primary-page context
  // (e.g. "Business") must not veto here.
  if (isFederatedIdPWithBrandReturn(primaryUrl, candidateUrl)) {
    return { accept: true };
  }

  const sameBrand = isSameBrandHost(primaryUrl, candidateUrl);
  let primaryHostForCompare = '';
  try {
    primaryHostForCompare = new URL(primaryUrl).hostname;
  } catch {
    primaryHostForCompare = '';
  }
  const sameHost =
    primaryHostForCompare !== '' && sameHostname(primaryHostForCompare, candidateHost);
  const siblingTld = isSiblingTldSameBrand(primaryUrl, candidateUrl);

  const trustedOrDedicated =
    sameBrand &&
    (isTrustedAuthSubdomain(candidateHost) ||
      pathLooksLikeDedicatedConsumerLogin(candidateUrl) ||
      // D-108-29: consumer sign-in on same host OR sibling-TLD only —
      // not arbitrary same-brand subdomains (payments.*/login stays rejected).
      (pathLooksLikeConsumerSignIn(candidateUrl) && (sameHost || siblingTld)));

  // (2) Same-brand trusted auth / dedicated / same-host or sibling sign-in → ACCEPT.
  // Homepage modal must not preempt this step (D-108-21 / D-108-29).
  if (trustedOrDedicated) {
    return { accept: true };
  }

  // (3) Modal / cross-subdomain / primary-page context rules.
  const contextBlob = [options?.label, options?.pageTitle, options?.pageContextText]
    .filter(Boolean)
    .join(' | ');
  const crossSub = isCrossSubdomainCandidate(primaryUrl, candidateUrl);

  if (
    contextBlob &&
    textHasAlternateAudienceWording(contextBlob) &&
    crossSub
  ) {
    return {
      accept: false,
      code: 'alternate_audience_portal',
      reason: ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
      preferModalClassification: true,
    };
  }

  if (
    options?.pageTitle &&
    textHasAlternateAudienceWording(options.pageTitle) &&
    crossSub
  ) {
    return {
      accept: false,
      code: 'page_context_alternate_audience',
      reason: PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON,
      preferModalClassification: Boolean(options.primaryHasModalLoginTrigger),
    };
  }

  if (crossSub) {
    if (options?.primaryHasModalLoginTrigger) {
      return {
        accept: false,
        code: 'cross_subdomain_untrusted',
        reason: CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
        preferModalClassification: true,
      };
    }

    return {
      accept: false,
      code: 'cross_subdomain_untrusted',
      reason: CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
      preferModalClassification: false,
    };
  }

  return { accept: true };
}
