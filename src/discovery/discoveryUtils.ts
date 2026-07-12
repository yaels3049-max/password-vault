import {
  AUTH_SUBDOMAIN_PREFIXES,
  COMMON_LOGIN_PATH_FALLBACKS,
  LOGIN_PATH_SEGMENTS,
  LOGIN_TEXT_KEYWORDS,
} from './discoveryKeywords';
import { isAlternateAudiencePortalUrl, isTrustedAuthSubdomain } from './loginAudienceGate';

export function normalizePrimaryUrl(primaryUrl: string): string | null {
  const trimmed = primaryUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).href;
  } catch {
    return null;
  }
}

export function resolveHref(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('javascript:') || trimmed.startsWith('#')) {
    return null;
  }

  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

export function textMatchesLoginKeyword(text: string): boolean {
  const normalized = text.toLowerCase();
  return LOGIN_TEXT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function urlLooksLikeLoginDestination(url: string): boolean {
  try {
    // Business/clients portals often contain "login" in the path — not consumer entry.
    if (isAlternateAudiencePortalUrl(url)) {
      return false;
    }

    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const host = parsed.hostname.toLowerCase();

    if (LOGIN_PATH_SEGMENTS.some((segment) => path.includes(segment))) {
      return true;
    }

    const labels = host.split('.');
    if (labels.length >= 2) {
      const subdomain = labels[0];
      if (
        AUTH_SUBDOMAIN_PREFIXES.includes(
          subdomain as (typeof AUTH_SUBDOMAIN_PREFIXES)[number],
        )
      ) {
        return true;
      }
    }

    // Require login as a path segment, not a substring of "clientslogin".
    return /(?:^|\/)(?:login|signin|sign-in|auth)(?:\/|$|\.)/i.test(path);
  } catch {
    return false;
  }
}

export function buildCommonPathCandidates(primaryUrl: string): string[] {
  const normalized = normalizePrimaryUrl(primaryUrl);
  if (!normalized || normalized.startsWith('/')) {
    return [];
  }

  let origin: string;
  try {
    origin = new URL(normalized).origin;
  } catch {
    return [];
  }

  return COMMON_LOGIN_PATH_FALLBACKS.map((path) => `${origin}${path}`);
}

export function scoreLoginCandidate(options: {
  url: string;
  label: string;
  baseOrigin: string;
  methodWeight: number;
}): number {
  const { url, label, baseOrigin, methodWeight } = options;
  let score = methodWeight;

  if (textMatchesLoginKeyword(label)) {
    score += 8;
  }

  if (urlLooksLikeLoginDestination(url)) {
    score += 10;
  }

  try {
    const parsed = new URL(url);
    const candidateOrigin = parsed.origin;
    if (candidateOrigin === baseOrigin) {
      score += 3;
    } else if (isTrustedAuthSubdomain(parsed.hostname)) {
      // Consumer auth hosts (login.*, e-services.*, …) beat same-page chrome buttons.
      score += 12;
    } else {
      // Cross-origin/subdomain must not gain score merely for looking like login.
      score -= 2;
    }
  } catch {
    score -= 5;
  }

  return score;
}

export function confidenceFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 18) {
    return 'high';
  }
  if (score >= 12) {
    return 'medium';
  }
  return 'low';
}

export function documentFromHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}
