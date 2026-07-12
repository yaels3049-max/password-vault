import { AUTH_SUBDOMAIN_PREFIXES } from './discoveryKeywords';

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
  'לממשק',
  'לקוחות עסקיים',
  'כניסת לקוחות',
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

export function textHasAlternateAudienceWording(text: string): boolean {
  const normalized = text.toLowerCase();
  return ALTERNATE_AUDIENCE_WORDING.some((token) => normalized.includes(token.toLowerCase()));
}

/** True when URL hostname/path/query strongly indicates a non-consumer portal. */
export function isAlternateAudiencePortalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    const haystack = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
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

    if (ALTERNATE_AUDIENCE_LOGIN_PATH_RE.test(path)) {
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

  const contextBlob = [options?.label, options?.pageTitle, options?.pageContextText]
    .filter(Boolean)
    .join(' | ');

  if (
    isAlternateAudiencePortalUrl(candidateUrl) ||
    candidateLabelSuggestsAlternateAudience(options?.label) ||
    (contextBlob && textHasAlternateAudienceWording(contextBlob) && isCrossSubdomainCandidate(primaryUrl, candidateUrl))
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
    isCrossSubdomainCandidate(primaryUrl, candidateUrl)
  ) {
    return {
      accept: false,
      code: 'page_context_alternate_audience',
      reason: PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON,
      preferModalClassification: Boolean(options.primaryHasModalLoginTrigger),
    };
  }

  if (isCrossSubdomainCandidate(primaryUrl, candidateUrl)) {
    // Modal consumer login on primary: never auto-accept a different host.
    if (options?.primaryHasModalLoginTrigger) {
      return {
        accept: false,
        code: 'cross_subdomain_untrusted',
        reason: CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
        preferModalClassification: true,
      };
    }

    // Trusted auth hosts OR dedicated login path on same brand (Bank Jerusalem-class
    // services.*.…/Pages/Login.aspx) — accept when no alternate-audience evidence above.
    if (
      isTrustedAuthSubdomain(candidateHost) ||
      pathLooksLikeDedicatedConsumerLogin(candidateUrl)
    ) {
      return { accept: true };
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
