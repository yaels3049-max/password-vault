/**
 * Reproduce modal + alternate-portal discovery (ZAP-shaped fixtures).
 * Usage: node scripts/reproModalPortalDiscovery.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function loadDiscover() {
  const dir = mkdtempSync(join(tmpdir(), 'repro-modal-'));
  const outfile = join(dir, 'discover.mjs');
  const policyOut = join(dir, 'policy.mjs');
  try {
    await build({
      entryPoints: [join(root, 'src/discovery/discoverLoginEntry.ts')],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      logLevel: 'silent',
    });
    await build({
      entryPoints: [join(root, 'src/discovery/loginDiscoveryPolicy.ts')],
      outfile: policyOut,
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      logLevel: 'silent',
    });
    return {
      discover: await import(pathToFileURL(outfile).href),
      policy: await import(pathToFileURL(policyOut).href),
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

function installDom(html, pageUrl) {
  const dom = new JSDOM(html, { url: pageUrl, contentType: 'text/html' });
  const g = globalThis;
  const prev = {
    window: g.window,
    document: g.document,
    HTMLElement: g.HTMLElement,
    HTMLAnchorElement: g.HTMLAnchorElement,
    HTMLButtonElement: g.HTMLButtonElement,
    HTMLInputElement: g.HTMLInputElement,
    HTMLSelectElement: g.HTMLSelectElement,
    HTMLOptionElement: g.HTMLOptionElement,
    DOMParser: g.DOMParser,
    Node: g.Node,
  };
  g.window = dom.window;
  g.document = dom.window.document;
  g.HTMLElement = dom.window.HTMLElement;
  g.HTMLAnchorElement = dom.window.HTMLAnchorElement;
  g.HTMLButtonElement = dom.window.HTMLButtonElement;
  g.HTMLInputElement = dom.window.HTMLInputElement;
  g.HTMLSelectElement = dom.window.HTMLSelectElement;
  g.HTMLOptionElement = dom.window.HTMLOptionElement;
  g.DOMParser = dom.window.DOMParser;
  g.Node = dom.window.Node;
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

const ZAP_HOME = `<!doctype html><html><head><title>זאפ השוואת מחירים</title></head><body>
<header><nav>
  <a href="https://sa.zap.co.il/login/index?ReturnUrl=%2f">כניסה</a>
  <button type="button" aria-haspopup="dialog">התחברות</button>
</nav></header>
<a href="/login">LOGIN</a>
</body></html>`;

const ZAP_PORTAL = `<!doctype html><html><head><title>כניסה לממשק העסק</title></head><body>
<h1>כניסה לממשק העסק</h1>
<input type="password" />
<input type="tel" placeholder="מספר טלפון נייד" />
<button>שליחה</button>
</body></html>`;

const BANK_HOME = `<!doctype html><html><head><title>בנק לדוגמה</title></head><body>
<button type="button" aria-haspopup="dialog">כניסה לחשבון</button>
<a href="https://login.example-bank.co.il/online">כניסה מאובטחת</a>
</body></html>`;

async function main() {
  const loaded = await loadDiscover();
  const { discoverLoginEntry } = loaded.discover;
  const { sanitizeDiscoveryResult, shouldPersistDiscoveredLoginUrl } = loaded.policy;

  try {
    const cases = [
      {
        name: 'ZAP homepage with portal link + modal',
        primary: 'https://www.zap.co.il/',
        pageUrl: 'https://www.zap.co.il/',
        html: ZAP_HOME,
        expectModal: true,
        expectRejectedPortal: true,
      },
      {
        name: 'ZAP business portal page itself',
        primary: 'https://www.zap.co.il/',
        pageUrl: 'https://sa.zap.co.il/login/index?ReturnUrl=%2f',
        html: ZAP_PORTAL,
        expectModal: true,
        expectRejectedPortal: true,
      },
      {
        name: 'Bank modal + auth subdomain link',
        primary: 'https://www.example-bank.co.il/',
        pageUrl: 'https://www.example-bank.co.il/',
        html: BANK_HOME,
        expectModal: true,
        expectRejectedPortal: false,
      },
    ];

    for (const c of cases) {
      const dom = installDom(c.html, c.pageUrl);
      try {
        const result = await discoverLoginEntry(c.primary, {
          document: dom.document,
          pageUrl: c.pageUrl,
          followRedirects: false,
          tryCommonPaths: true,
          assumeVisible: true,
        });
        const sanitized = sanitizeDiscoveryResult(result);
        console.log('\n===', c.name, '===');
        console.log({
          success: sanitized.success,
          loginUrl: sanitized.loginUrl ?? null,
          reason: sanitized.reason,
          loginEntryType: sanitized.loginEntryType,
          usesModal: sanitized.usesModal,
          rejectedLoginUrl: sanitized.rejectedLoginUrl,
          persist: shouldPersistDiscoveredLoginUrl(sanitized),
        });
        if (sanitized.success || sanitized.loginUrl) {
          throw new Error(`${c.name}: must not succeed with a loginUrl`);
        }
        if (shouldPersistDiscoveredLoginUrl(sanitized)) {
          throw new Error(`${c.name}: must not persist as valid`);
        }
        if (c.expectModal && !sanitized.usesModal) {
          throw new Error(`${c.name}: expected usesModal`);
        }
        if (c.expectRejectedPortal && !/sa\.zap/.test(String(sanitized.rejectedLoginUrl ?? ''))) {
          throw new Error(`${c.name}: expected rejected sa.zap portal URL`);
        }
        if (c.name.startsWith('Bank') && sanitized.reason !== 'Consumer login appears modal-based on the primary site; no dedicated consumer login URL was validated.') {
          // bank should be modal-only reason, not portal reason
          if (!String(sanitized.reason).includes('modal-based')) {
            throw new Error(`${c.name}: expected modal reason, got ${sanitized.reason}`);
          }
        }
      } finally {
        dom.restore();
      }
    }
    console.log('\nreproModalPortalDiscovery: PASS');
  } finally {
    loaded.cleanup();
  }
}

main().catch((error) => {
  console.error('reproModalPortalDiscovery: FAIL', error);
  process.exit(1);
});
