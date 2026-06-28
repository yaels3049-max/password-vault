import {
  DISCOVERY_FETCH_TIMEOUT_MS,
  MAX_REDIRECT_HOPS,
} from './discoveryKeywords';
import { normalizePrimaryUrl, urlLooksLikeLoginDestination } from './discoveryUtils';

export interface RedirectFollowResult {
  ok: boolean;
  primaryUrl: string;
  finalUrl?: string;
  redirectChain: string[];
  reason?: string;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), DISCOVERY_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Follow HTTP redirects manually. Read-only GET — no form submission.
 * May fail cross-origin due to browser CORS policy; callers treat failure as non-fatal.
 */
export async function followHttpRedirects(primaryUrl: string): Promise<RedirectFollowResult> {
  const normalized = normalizePrimaryUrl(primaryUrl);
  if (!normalized || normalized.startsWith('/')) {
    return {
      ok: false,
      primaryUrl,
      redirectChain: [],
      reason: 'invalid_primary_url',
    };
  }

  const redirectChain: string[] = [];
  let currentUrl = normalized;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
    let response: Response;
    try {
      response = await fetchWithTimeout(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch {
      return {
        ok: false,
        primaryUrl: normalized,
        finalUrl: currentUrl,
        redirectChain,
        reason: 'redirect_fetch_failed',
      };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (!location) {
        return {
          ok: false,
          primaryUrl: normalized,
          finalUrl: currentUrl,
          redirectChain,
          reason: 'redirect_missing_location',
        };
      }

      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).href;
      } catch {
        return {
          ok: false,
          primaryUrl: normalized,
          finalUrl: currentUrl,
          redirectChain,
          reason: 'redirect_invalid_location',
        };
      }

      redirectChain.push(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    return {
      ok: true,
      primaryUrl: normalized,
      finalUrl: currentUrl,
      redirectChain,
    };
  }

  return {
    ok: false,
    primaryUrl: normalized,
    finalUrl: currentUrl,
    redirectChain,
    reason: 'redirect_limit_exceeded',
  };
}

export function redirectResultLooksLikeLogin(result: RedirectFollowResult): boolean {
  if (!result.finalUrl) {
    return false;
  }

  return urlLooksLikeLoginDestination(result.finalUrl);
}
