/**
 * Quick repro: simple consumer login discovery (GitHub / Hapoalim shaped).
 * Usage: node scripts/reproSimpleLoginDiscovery.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function bundle(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'repro-login-'));
  const outfile = join(dir, 'bundle.mjs');
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    logLevel: 'silent',
  });
  return {
    mod: await import(pathToFileURL(outfile).href),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function install(html, url) {
  const dom = new JSDOM(html, { url, contentType: 'text/html' });
  const g = globalThis;
  const keys = [
    'window',
    'document',
    'HTMLElement',
    'HTMLAnchorElement',
    'HTMLButtonElement',
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLOptionElement',
    'Node',
    'DOMParser',
  ];
  const prev = Object.fromEntries(keys.map((k) => [k, g[k]]));
  Object.assign(g, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLAnchorElement: dom.window.HTMLAnchorElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    HTMLOptionElement: dom.window.HTMLOptionElement,
    Node: dom.window.Node,
    DOMParser: dom.window.DOMParser,
  });
  return {
    restore() {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete g[k];
        else g[k] = v;
      }
      dom.window.close();
    },
  };
}

const cases = [
  {
    name: 'github-home',
    primary: 'https://github.com/',
    page: 'https://github.com/',
    html: `<html><body>
      <a href="/login">Sign in</a>
      <a href="https://github.com/login">Sign in</a>
    </body></html>`,
  },
  {
    name: 'github-login-page',
    primary: 'https://github.com/',
    page: 'https://github.com/login',
    html: `<html><body>
      <form action="/session">
        <input name="login" />
        <input type="password" name="password" />
        <button type="submit">Sign in</button>
      </form>
    </body></html>`,
  },
  {
    name: 'hapoalim-home',
    primary: 'https://www.bankhapoalim.co.il/',
    page: 'https://www.bankhapoalim.co.il/',
    html: `<html lang="he"><body>
      <a href="https://login.bankhapoalim.co.il/">כניסה</a>
      <a href="/login">כניסה לחשבון</a>
    </body></html>`,
  },
  {
    name: 'simple-bare-login-link',
    primary: 'https://www.example.co.il/',
    page: 'https://www.example.co.il/',
    html: `<html><body><a href="/login">כניסה</a></body></html>`,
  },
];

const discoverBundle = await bundle('src/discovery/discoverLoginEntry.ts');
const policyBundle = await bundle('src/discovery/loginDiscoveryPolicy.ts');

try {
  const { discoverLoginEntry } = discoverBundle.mod;
  const { sanitizeDiscoveryResult, shouldPersistDiscoveredLoginUrl } = policyBundle.mod;

  for (const c of cases) {
    const dom = install(c.html, c.page);
    try {
      const raw = await discoverLoginEntry(c.primary, {
        document: globalThis.document,
        pageUrl: c.page,
        followRedirects: false,
        tryCommonPaths: true,
        assumeVisible: true,
      });
      const s = sanitizeDiscoveryResult(raw);
      console.log(
        JSON.stringify(
          {
            name: c.name,
            success: s.success,
            loginUrl: s.loginUrl ?? null,
            method: s.method ?? null,
            confidence: s.confidence ?? null,
            reason: s.reason ?? null,
            persist: shouldPersistDiscoveredLoginUrl(s),
            candidates: (s.candidates ?? []).map((x) => ({
              url: x.url,
              method: x.method,
              score: x.score,
            })),
          },
          null,
          2,
        ),
      );
    } finally {
      dom.restore();
    }
  }
} finally {
  discoverBundle.cleanup();
  policyBundle.cleanup();
}
