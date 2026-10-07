/**
 * H-2 (arch-phase123 Review Notes): on the Owner machine loopback connections to the harness server
 * are randomly refused (Edge: `net::ERR_NETWORK_ACCESS_DENIED`; Node: `connect EACCES`). Requests to
 * the harness origin are fulfilled from the served directory through Playwright routing, so no
 * loopback socket is opened. The server still listens and the page URL / origin is unchanged;
 * `assertSecureContext` keeps WebCrypto, IndexedDB and storage on the same footing as before.
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const dirsByOrigin = new Map();

/** Called by `serve(dir)` once the server listens. */
export function registerHarnessDir(url, dir) {
  dirsByOrigin.set(new URL(url).origin, dir);
}

export async function routeHarness(context, url) {
  const origin = new URL(url).origin;
  await context.route((u) => u.origin === origin, async (route) => {
    const dir = dirsByOrigin.get(origin);
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '') || 'index.html';
    const file = dir ? join(dir, rel) : null;
    if (!file || relative(dir, file).startsWith('..') || !existsSync(file)) {
      await route.fulfill({ status: 404, body: '' });
      return;
    }
    await route.fulfill({ status: 200, contentType: MIME[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) });
  });
}

export async function assertSecureContext(page) {
  if ((await page.evaluate(() => window.isSecureContext)) !== true) {
    throw new Error('H-2: the harness page is not a secure context');
  }
}
