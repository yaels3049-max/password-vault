/**
 * M15 live-path diagnostic: fetch PayPal/Zoom HTML (or simulate SW status)
 * and run discoverLoginEntry as the extension would (probe via fetcher).
 * Not a substitute for extension UAT — proves soft-ACCEPT against live surfaces.
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function bundle(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'phase108-m15-'));
  const outfile = join(dir, 'bundle.mjs');
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
  });
  return { dir, mod: await import(pathToFileURL(outfile).href) };
}

function installDom(html, pageUrl) {
  const dom = new JSDOM(html, { url: pageUrl, contentType: 'text/html' });
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
    document: dom.window.document,
    restore() {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete g[k];
        else g[k] = v;
      }
      dom.window.close();
    },
  };
}

async function fetchProbe(url) {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      cache: 'no-store',
    });
    const html = await response.text();
    return {
      ok: response.ok,
      reached: true,
      status: response.status,
      html,
      finalUrl: response.url || url,
      reason: response.ok ? undefined : `http_${response.status}`,
    };
  } catch (error) {
    return { ok: false, reached: false, reason: String(error?.message || error) };
  }
}

async function runSite(discoverLoginEntry, sanitize, shouldPersist, site) {
  const homeProbe = await fetchProbe(site.primaryUrl);
  const homeHtml =
    homeProbe.ok && homeProbe.html
      ? homeProbe.html
      : readFileSync(join(root, site.fixtureHome), 'utf8');
  const pageUrl = homeProbe.finalUrl || site.primaryUrl;
  const dom = installDom(homeHtml, pageUrl);
  try {
    const raw = await discoverLoginEntry(site.primaryUrl, {
      document: dom.document,
      pageUrl,
      followRedirects: false,
      tryCommonPaths: true,
      probeAuthHosts: true,
      assumeVisible: true,
      fetchProbeHtml: fetchProbe,
    });
    const result = sanitize(raw);
    return {
      id: site.id,
      primaryUrl: site.primaryUrl,
      homeStatus: homeProbe.status ?? null,
      success: result.success,
      loginUrl: result.loginUrl ?? null,
      reason: result.reason ?? null,
      method: result.method ?? null,
      persist: shouldPersist(result),
      topCandidates: (result.candidates || []).slice(0, 5).map((c) => ({
        url: c.url,
        score: c.score,
        method: c.method,
      })),
    };
  } finally {
    dom.restore();
  }
}

async function main() {
  const discoverBundle = await bundle('src/discovery/discoverLoginEntry.ts');
  const policyBundle = await bundle('src/discovery/loginDiscoveryPolicy.ts');
  try {
    const { discoverLoginEntry } = discoverBundle.mod;
    const { sanitizeDiscoveryResult, shouldPersistDiscoveredLoginUrl } =
      policyBundle.mod;

    const sites = [
      {
        id: 'paypal',
        primaryUrl: 'https://www.paypal.com/',
        fixtureHome: 'scripts/fixtures/phase108-accept-paypal-home.html',
        expect: /paypal\.com\/login/i,
      },
      {
        id: 'zoom',
        primaryUrl: 'https://www.zoom.com/',
        fixtureHome: 'scripts/fixtures/phase108-accept-zoom-home.html',
        expect: /zoom\.us\/signin/i,
      },
    ];

    const rows = [];
    for (const site of sites) {
      const row = await runSite(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        shouldPersistDiscoveredLoginUrl,
        site,
      );
      row.expectOk = site.expect.test(String(row.loginUrl || '')) && row.persist;
      rows.push(row);
      console.log(JSON.stringify(row, null, 2));
    }

    writeFileSync(
      join(root, 'scripts/fixtures/phase108-m15-live-path-report.json'),
      JSON.stringify({ at: new Date().toISOString(), rows }, null, 2),
    );

    const failed = rows.filter((r) => !r.expectOk);
    if (failed.length) {
      console.error('M15 live-path diagnostic FAIL', failed.map((f) => f.id));
      process.exitCode = 1;
    } else {
      console.log('M15 live-path diagnostic PASS (fetch+engine; not extension UAT)');
    }
  } finally {
    rmSync(discoverBundle.dir, { recursive: true, force: true });
    rmSync(policyBundle.dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
