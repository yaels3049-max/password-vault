/**
 * Phase 108 M11 — live HTML capture (diagnostic).
 * Fetches live primary pages and runs Hub discoverLoginEntry + persist gates.
 * This is NOT a substitute for extension HUB_LOGIN_ENTRY_DISCOVERY UAT (D-108-19),
 * but proves engine behavior against live HTML vs fixtures.
 *
 * Usage: node scripts/capturePhase108LiveDiscovery.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SITES = [
  {
    id: 'shufersal',
    primaryUrl: 'https://www.shufersal.co.il/',
    expectPersist: true,
  },
  {
    id: 'clalit',
    primaryUrl: 'https://www.clalit.co.il/',
    expectPersist: true,
  },
  {
    id: 'htzone',
    primaryUrl: 'https://www.htzone.co.il/',
    expectPersist: true,
  },
  {
    id: 'zap',
    primaryUrl: 'https://www.zap.co.il/',
    expectPersist: false,
    forbidHost: /sa\.zap\.co\.il/i,
  },
];

async function bundle(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'phase108-live-'));
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

function installDom(html, pageUrl) {
  const dom = new JSDOM(html, { url: pageUrl, contentType: 'text/html', pretendToBeVisual: true });
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
    'DOMParser',
    'Node',
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
    DOMParser: dom.window.DOMParser,
    Node: dom.window.Node,
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

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    const html = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url, html };
  } finally {
    clearTimeout(timer);
  }
}

const discoverBundle = await bundle('src/discovery/discoverLoginEntry.ts');
const policyBundle = await bundle('src/discovery/loginDiscoveryPolicy.ts');
const clearBundle = await bundle('src/registry/loginUrlClearPolicy.ts');

const report = [];

try {
  const { discoverLoginEntry } = discoverBundle.mod;
  const { sanitizeDiscoveryResult, shouldPersistDiscoveredLoginUrl } = policyBundle.mod;
  const { shouldClearAutoLoginUrlOnDiscoveryReject } = clearBundle.mod;

  for (const site of SITES) {
    let fetched;
    try {
      fetched = await fetchHtml(site.primaryUrl);
    } catch (error) {
      const entry = {
        id: site.id,
        primaryUrl: site.primaryUrl,
        fetchOk: false,
        fetchError: error instanceof Error ? error.message : String(error),
        note: 'Live fetch failed from this environment — extension UAT still required (D-108-19)',
      };
      report.push(entry);
      console.log(JSON.stringify(entry, null, 2));
      continue;
    }
    const pageUrl = fetched.finalUrl || site.primaryUrl;
    const dom = installDom(fetched.html || '<html><body></body></html>', pageUrl);
    try {
      const raw = await discoverLoginEntry(site.primaryUrl, {
        document: globalThis.document,
        pageUrl,
        followRedirects: false,
        tryCommonPaths: true,
        assumeVisible: true,
      });
      const sanitized = sanitizeDiscoveryResult(raw);
      const persist = shouldPersistDiscoveredLoginUrl(sanitized);
      const seededLogin =
        site.id === 'shufersal'
          ? 'https://www.shufersal.co.il/online/he/login'
          : site.id === 'clalit'
            ? 'https://e-services.clalit.co.il/onlineweb/general/login.aspx'
            : site.id === 'htzone'
              ? 'https://www.htzone.co.il/login'
              : site.id === 'zap'
                ? 'https://sa.zap.co.il/login/index'
                : null;

      const clearSeeded = shouldClearAutoLoginUrlOnDiscoveryReject(
        {
          login_url: seededLogin,
          primary_url: site.primaryUrl,
          metadata: { loginUrlSource: 'auto' },
        },
        sanitized,
      );

      const entry = {
        id: site.id,
        primaryUrl: site.primaryUrl,
        fetchOk: fetched.ok,
        fetchStatus: fetched.status,
        pageUrl,
        raw: {
          success: raw.success,
          loginUrl: raw.loginUrl ?? null,
          method: raw.method ?? null,
          confidence: raw.confidence ?? null,
          reason: raw.reason ?? null,
          rejectedLoginUrl: raw.rejectedLoginUrl ?? null,
          usesModal: raw.usesModal ?? null,
          loginEntryType: raw.loginEntryType ?? null,
          candidates: (raw.candidates ?? []).slice(0, 8).map((c) => ({
            url: c.url,
            method: c.method,
            score: c.score,
          })),
        },
        sanitized: {
          success: sanitized.success,
          loginUrl: sanitized.loginUrl ?? null,
          method: sanitized.method ?? null,
          confidence: sanitized.confidence ?? null,
          reason: sanitized.reason ?? null,
          rejectedLoginUrl: sanitized.rejectedLoginUrl ?? null,
        },
        shouldPersist: persist,
        wouldClearSeededAutoUrl: clearSeeded,
        forbidHostHit: site.forbidHost
          ? site.forbidHost.test(String(sanitized.loginUrl ?? ''))
          : false,
        note: 'Live HTML snapshot via fetch+JSDOM — not extension tab path',
      };
      report.push(entry);
      console.log(JSON.stringify(entry, null, 2));
    } finally {
      dom.restore();
    }
  }
} finally {
  discoverBundle.cleanup();
  policyBundle.cleanup();
  clearBundle.cleanup();
}

const outPath = join(root, 'scripts/fixtures/phase108-live-capture-report.json');
writeFileSync(outPath, JSON.stringify({ capturedAt: new Date().toISOString(), report }, null, 2));
console.log(`Wrote ${outPath}`);
