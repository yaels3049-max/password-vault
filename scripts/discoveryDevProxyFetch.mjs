import http from 'node:http';
import https from 'node:https';

const MAX_REDIRECTS = 10;
const FETCH_TIMEOUT_MS = 30_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
};

/**
 * Fetch HTML using Node http/https (reliable in dev proxy; avoids hung global fetch).
 * @param {URL} targetUrl
 * @param {number} [redirectCount]
 * @returns {Promise<{ status: number; body: string; finalUrl: string }>}
 */
export function fetchHtmlWithNodeHttp(targetUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const lib = targetUrl.protocol === 'https:' ? https : http;

    const request = lib.request(
      targetUrl,
      {
        method: 'GET',
        headers: REQUEST_HEADERS,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;

        if (
          status >= 300 &&
          status < 400 &&
          location &&
          redirectCount < MAX_REDIRECTS
        ) {
          response.resume();
          try {
            const nextUrl = new URL(location, targetUrl);
            resolve(fetchHtmlWithNodeHttp(nextUrl, redirectCount + 1));
          } catch (error) {
            reject(error);
          }
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            status,
            body: Buffer.concat(chunks).toString('utf8'),
            finalUrl: targetUrl.href,
          });
        });
      },
    );

    request.setTimeout(FETCH_TIMEOUT_MS, () => {
      request.destroy(new Error('request_timeout'));
    });
    request.on('error', reject);
    request.end();
  });
}

/**
 * @param {string} targetHref
 * @returns {Promise<{ status: number; body: string; finalUrl: string }>}
 */
export async function fetchRemoteHtml(targetHref) {
  const targetUrl = new URL(targetHref);

  try {
    const nodeResult = await fetchHtmlWithNodeHttp(targetUrl);
    if (nodeResult.body.length > 0) {
      return nodeResult;
    }
  } catch {
    // Fall through to global fetch.
  }

  const response = await fetch(targetUrl.href, {
    headers: REQUEST_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  return {
    status: response.status,
    body: await response.text(),
    finalUrl: response.url,
  };
}
