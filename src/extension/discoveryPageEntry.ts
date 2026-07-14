import { discoverLoginEntry } from '../discovery/discoverLoginEntry';
import type { DiscoveryResult } from '../discovery/discoveryResult';

type ProbeFetchResult =
  | {
      ok: true;
      reached: true;
      status: number;
      html: string;
      finalUrl?: string;
    }
  | {
      ok: false;
      reached: boolean;
      status?: number;
      html?: string;
      finalUrl?: string;
      reason?: string;
      dnsExists?: boolean;
    };

const NO_CORS_PROBE_TIMEOUT_MS = 6_000;
const SW_PROBE_TIMEOUT_MS = 10_000;

/**
 * In-page no-cors probe: opaque success ⇒ host answered; throw ⇒ NXDOMAIN / blocked.
 * Distinguishes live auth hosts (KSP) from non-existent invent hosts without SW/DoH.
 */
function probeHostReachableNoCors(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      resolve(false);
    }, NO_CORS_PROBE_TIMEOUT_MS);

    fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal,
    })
      .then(() => {
        clearTimeout(timer);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

function fetchProbeHtmlFromServiceWorker(url: string): Promise<ProbeFetchResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ProbeFetchResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, reached: false, reason: 'sw_timeout' });
    }, SW_PROBE_TIMEOUT_MS);

    try {
      const chromeApi = (
        globalThis as unknown as {
          chrome?: {
            runtime?: {
              sendMessage: (
                message: unknown,
                callback: (response: unknown) => void,
              ) => void;
              lastError?: { message?: string };
            };
          };
        }
      ).chrome;

      if (!chromeApi?.runtime?.sendMessage) {
        clearTimeout(timer);
        finish({ ok: false, reached: false, reason: 'no_runtime' });
        return;
      }

      chromeApi.runtime.sendMessage(
        { type: 'HUB_DISCOVERY_FETCH_HTML', url },
        (response: unknown) => {
          clearTimeout(timer);
          if (chromeApi.runtime?.lastError) {
            finish({
              ok: false,
              reached: false,
              reason: chromeApi.runtime.lastError.message,
            });
            return;
          }
          const payload = response as {
            ok?: boolean;
            reached?: boolean;
            status?: number;
            html?: string;
            finalUrl?: string;
            reason?: string;
            dnsExists?: boolean;
          } | null;
          if (!payload) {
            finish({ ok: false, reached: false, reason: 'empty_response' });
            return;
          }
          if (payload.reached === false) {
            finish({
              ok: false,
              reached: false,
              reason: payload.reason,
            });
            return;
          }
          if (payload.ok && typeof payload.html === 'string') {
            finish({
              ok: true,
              reached: true,
              status: typeof payload.status === 'number' ? payload.status : 200,
              html: payload.html,
              finalUrl: payload.finalUrl ?? url,
            });
            return;
          }
          finish({
            ok: false,
            reached: true,
            status: typeof payload.status === 'number' ? payload.status : 0,
            html: typeof payload.html === 'string' ? payload.html : undefined,
            finalUrl: payload.finalUrl,
            reason: payload.reason,
            dnsExists: payload.dnsExists === true,
          });
        },
      );
    } catch {
      clearTimeout(timer);
      finish({ ok: false, reached: false, reason: 'exception' });
    }
  });
}

/**
 * Prefer SW HTML fetch; if host looks unreachable or returned 404, confirm with in-page no-cors.
 */
async function fetchProbeHtmlViaBackground(url: string): Promise<ProbeFetchResult> {
  const fromSw = await fetchProbeHtmlFromServiceWorker(url);
  if (fromSw.ok) {
    return fromSw;
  }

  // Host answered with a soft-acceptible gate / DNS proof — keep SW result.
  if (
    fromSw.reached &&
    typeof fromSw.status === 'number' &&
    fromSw.status !== 404 &&
    (fromSw.dnsExists === true ||
      fromSw.status === 0 ||
      fromSw.status === 401 ||
      fromSw.status === 403 ||
      fromSw.status === 429)
  ) {
    return fromSw;
  }

  // SW miss, timeout, NXDOMAIN claim, or HTTP 404 — confirm host existence in-page.
  const reachable = await probeHostReachableNoCors(url);
  if (reachable) {
    return {
      ok: false,
      reached: true,
      status: 0,
      dnsExists: true,
      finalUrl: url,
      reason: 'no_cors_reachable',
    };
  }

  return fromSw;
}

/**
 * Run login entry discovery against the live page DOM (extension content context).
 * Bundled into extension/discovery/login-entry-discovery.js for scripting injection.
 */
export async function runLoginEntryDiscoveryInPage(
  primaryUrl: string,
): Promise<DiscoveryResult> {
  return discoverLoginEntry(primaryUrl, {
    document: window.document,
    pageUrl: window.location.href,
    followRedirects: false,
    tryCommonPaths: true,
    probeAuthHosts: true,
    // Never invent auth-host /login without reachability (retail FP).
    // Accept only when SW HTML / DNS / in-page no-cors proves the host exists.
    fetchProbeHtml: fetchProbeHtmlViaBackground,
  });
}

declare global {
  interface Window {
    runLoginEntryDiscoveryInPage: typeof runLoginEntryDiscoveryInPage;
  }
}

window.runLoginEntryDiscoveryInPage = runLoginEntryDiscoveryInPage;
