const DEV_DISCOVERY_PROXY_PATH = '/dev-discovery-proxy';

export type FetchPageHtmlResult =
  | { ok: true; html: string; finalUrl: string; status: number }
  | { ok: false; reason: string; status?: number };

/**
 * Load page HTML for login entry discovery.
 * Uses the Vite dev proxy when available; otherwise attempts a direct fetch (may fail CORS).
 */
export async function fetchPageHtmlForDiscovery(
  primaryUrl: string,
): Promise<FetchPageHtmlResult> {
  if (import.meta.env.DEV) {
    return fetchViaDevProxy(primaryUrl);
  }

  return fetchDirect(primaryUrl);
}

async function fetchViaDevProxy(primaryUrl: string): Promise<FetchPageHtmlResult> {
  const proxyUrl = `${DEV_DISCOVERY_PROXY_PATH}?url=${encodeURIComponent(primaryUrl)}`;

  try {
    const response = await fetch(proxyUrl);
    const body = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        reason: body || `fetch_failed_${response.status}`,
        status: response.status,
      };
    }

    return {
      ok: true,
      html: body,
      finalUrl: response.headers.get('X-Final-Url') ?? primaryUrl,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'proxy_fetch_failed',
    };
  }
}

async function fetchDirect(primaryUrl: string): Promise<FetchPageHtmlResult> {
  try {
    const response = await fetch(primaryUrl, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const body = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        reason: `fetch_failed_${response.status}`,
        status: response.status,
      };
    }

    return {
      ok: true,
      html: body,
      finalUrl: response.url || primaryUrl,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'fetch_failed',
    };
  }
}
