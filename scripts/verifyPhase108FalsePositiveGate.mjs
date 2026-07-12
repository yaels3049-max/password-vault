/**
 * Phase 108 M9 + M10 — Dual false-positive / true-positive gate
 * (D-108-14…18 / AC-108-18…21).
 *
 * REJECT (M9 must stay green):
 *   - Zap-class portal HTML/URL → loginUrl NOT persisted
 *   - Modal-only on primary → NULL + modal deferral
 *   - Bare "/login" visible-link alone does NOT persist
 *
 * ACCEPT (M10 dual gate):
 *   - Ordinary dedicated consumer login form page
 *   - Homepage modal trigger + separate navigable consumer URL
 *   - Portal sibling + stronger same-origin consumer candidate
 *   - Same-origin dedicated /login form page
 *   - Trusted auth subdomain (Clalit-class)
 *   - Catalog-equivalent paths (Shufersal / Clalit / HTZone shapes)
 *
 * Usage: node scripts/verifyPhase108FalsePositiveGate.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function walkTs(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walkTs(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

async function bundle(entryRelative) {
  const dir = mkdtempSync(join(tmpdir(), 'phase108-m10-'));
  const outfile = join(dir, 'bundle.mjs');
  try {
    await build({
      entryPoints: [join(root, entryRelative)],
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
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
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

function assertNoServiceBranching() {
  const files = [
    ...walkTs(join(root, 'src/discovery')),
    join(root, 'src/registry/loginUrlDiscovery.ts'),
    join(root, 'src/registry/loginDiscoveryMetadata.ts'),
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert(!/\bzap\b/i.test(text), `No Zap branching in ${file}`);
    assert(!/mizrahi/i.test(text), `No Mizrahi branching in ${file}`);
    assert(!/tefahot/i.test(text), `No Tefahot branching in ${file}`);
  }
}

function assertSourceContracts() {
  const meta = read('src/registry/loginDiscoveryMetadata.ts');
  const policy = read('src/discovery/loginDiscoveryPolicy.ts');
  const discover = read('src/discovery/discoverLoginEntry.ts');
  const persist = read('src/registry/loginUrlDiscovery.ts');
  const autofill = read('src/execution/genericAutofill.ts');

  assert(policy.includes('resolvePhase112Deferral'), 'M9 deferral resolver required');
  assert(policy.includes('hasStrongConsumerNavigableEvidence'), 'M10 strong-evidence helper required');
  assert(
    discover.includes('Navigable consumer wins') ||
      discover.includes('modalTriggers.length > 0'),
    'M10 selective modal (navigable first) required',
  );
  assert(meta.includes('phase112Deferred'), 'Metadata must write phase112Deferred');
  assert(meta.includes('loginIntelligenceHint'), 'Metadata must write loginIntelligenceHint');
  assert(persist.includes('persist_login_discovery_review'), 'Clear auto login_url via review RPC');
  assert(persist.includes('isAdminProtectedLoginUrl'), 'Never clear admin override');
  assert(
    !autofill.includes('phase112Deferred') && !autofill.toLowerCase().includes('openmodal'),
    'Phase 108 must not implement Phase 112 modal open/fill',
  );
  assertNoServiceBranching();
}

async function runDiscovery(discoverLoginEntry, sanitizeDiscoveryResult, html, pageUrl, primary) {
  const dom = installDom(html, pageUrl);
  try {
    const raw = await discoverLoginEntry(primary, {
      document: dom.document,
      pageUrl,
      followRedirects: false,
      tryCommonPaths: false,
      assumeVisible: true,
    });
    return sanitizeDiscoveryResult(raw);
  } finally {
    dom.restore();
  }
}

async function main() {
  assertSourceContracts();

  const discoverBundle = await bundle('src/discovery/discoverLoginEntry.ts');
  const policyBundle = await bundle('src/discovery/loginDiscoveryPolicy.ts');
  const metaBundle = await bundle('src/registry/loginDiscoveryMetadata.ts');

  try {
    const { discoverLoginEntry } = discoverBundle.mod;
    const {
      shouldPersistDiscoveredLoginUrl,
      sanitizeDiscoveryResult,
      resolvePhase112Deferral,
    } = policyBundle.mod;
    const { buildDiscoveryMetadataPatch } = metaBundle.mod;

    const zapHomeHtml = read('scripts/fixtures/phase108-zap-class-home.html');
    const zapPortalHtml = read('scripts/fixtures/phase108-zap-class-portal.html');
    const modalHtml = read('scripts/fixtures/phase108-modal-on-primary.html');
    const acceptLoginHtml = read('scripts/fixtures/phase108-accept-consumer-login.html');
    const acceptModalNavHtml = read('scripts/fixtures/phase108-accept-modal-plus-navigable.html');
    const acceptPortalSiblingHtml = read(
      'scripts/fixtures/phase108-accept-portal-sibling-consumer.html',
    );
    const acceptBareLoginHtml = read('scripts/fixtures/phase108-accept-bare-login-form.html');
    const acceptAuthSubHtml = read('scripts/fixtures/phase108-accept-trusted-auth-subdomain.html');
    const acceptGithubHtml = read('scripts/fixtures/phase108-accept-github-login-link.html');
    const acceptBankAuthHtml = read('scripts/fixtures/phase108-accept-auth-subdomain-login.html');
    const acceptClalitHomeHtml = read('scripts/fixtures/phase108-accept-clalit-home-chrome.html');
    const acceptServicesLoginHtml = read(
      'scripts/fixtures/phase108-accept-services-login-aspx.html',
    );

    // --- T24 Zap-class home (REJECT) ---
    {
      const primary = 'https://www.example-retail.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        zapHomeHtml,
        primary,
        primary,
      );
      assert(!result.success && !result.loginUrl, 'T24: loginUrl must be null');
      assert(
        /sa\.example-retail\.co\.il|clientslogin/i.test(String(result.rejectedLoginUrl ?? '')),
        'T24: rejectedLoginUrl must record portal candidate (sa.* or clientslogin)',
      );
      assert(result.usesModal === true && result.loginEntryType === 'modal', 'T24: modal deferral');
      assert(shouldPersistDiscoveredLoginUrl(result) === false, 'T24: must not persist');

      const deferral = resolvePhase112Deferral(result);
      assert(deferral.phase112Deferred === true, 'T24: phase112Deferred');
      assert(
        deferral.loginIntelligenceHint === 'alternate_audience_portal' ||
          deferral.loginIntelligenceHint === 'modal_on_primary',
        'T24: intelligence hint',
      );

      const patch = buildDiscoveryMetadataPatch(
        {},
        {
          discovery: result,
          source: 'auto',
          success: false,
          loginUrlStatus: 'needs_review',
          errorCode: result.reason,
        },
      );
      assert(patch.phase112Deferred === true, 'T24 metadata phase112Deferred');
      assert(patch.rejectedLoginUrl, 'T24 metadata rejectedLoginUrl');
      assert(patch.loginIntelligenceHint, 'T24 metadata loginIntelligenceHint');
      assert(patch.usesModal === true, 'T24 metadata usesModal');
    }

    // --- T24b Zap-class portal page (REJECT) ---
    {
      const primary = 'https://www.example-retail.co.il/';
      const portal = 'https://sa.example-retail.co.il/login/index?ReturnUrl=%2f';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        zapPortalHtml,
        portal,
        primary,
      );
      assert(!result.loginUrl, 'T24b: must not persist portal page as loginUrl');
      assert(shouldPersistDiscoveredLoginUrl(result) === false, 'T24b: persist gate');
      assert(
        !result.success || !/sa\.example-retail/.test(String(result.loginUrl ?? '')),
        'T24b: never sa.* login',
      );
    }

    // --- T25 Modal-only on primary (REJECT) ---
    {
      const primary = 'https://www.example-bank.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        modalHtml,
        primary,
        primary,
      );
      assert(!result.success && !result.loginUrl, 'T25: loginUrl NULL');
      assert(result.loginEntryType === 'modal' && result.usesModal === true, 'T25: modal fields');
      const deferral = resolvePhase112Deferral(result);
      assert(deferral.phase112Deferred === true, 'T25: phase112Deferred');
      assert(deferral.loginIntelligenceHint === 'modal_on_primary', 'T25: modal_on_primary hint');
    }

    // --- T26 Persist gate ---
    {
      // Invented common-path /login alone is never enough
      const commonPathOnly = {
        success: true,
        primaryUrl: 'https://www.example.co.il/',
        loginUrl: 'https://www.example.co.il/login',
        method: 'common-path',
        confidence: 'low',
      };
      assert(
        shouldPersistDiscoveredLoginUrl(commonPathOnly) === false,
        'T26: common-path /login must not persist',
      );

      // GitHub-class: same-origin bare /login via strong visible link MUST persist (M10)
      const githubShape = {
        success: true,
        primaryUrl: 'https://github.com/',
        loginUrl: 'https://github.com/login',
        method: 'visible-link',
        confidence: 'high',
        loginEntryType: 'navigable',
      };
      assert(
        shouldPersistDiscoveredLoginUrl(githubShape) === true,
        'T26: GitHub-class /login visible-link must persist',
      );

      const portalSuccess = {
        success: true,
        primaryUrl: 'https://www.example-retail.co.il/',
        loginUrl: 'https://sa.example-retail.co.il/login/index',
        method: 'visible-link',
        confidence: 'high',
      };
      assert(
        shouldPersistDiscoveredLoginUrl(portalSuccess) === false,
        'T26: portal URL must not persist',
      );

      const clientsLogin = {
        success: true,
        primaryUrl: 'https://www.example-retail.co.il/',
        loginUrl: 'https://www.example-retail.co.il/clientslogin.aspx?typeentry=3',
        method: 'visible-link',
        confidence: 'high',
      };
      assert(
        shouldPersistDiscoveredLoginUrl(clientsLogin) === false,
        'T26: same-host clientslogin.aspx must not persist',
      );

      // Bare /login + portal sibling → still reject (Zap shadow)
      const shadowedBareLogin = {
        success: true,
        primaryUrl: 'https://www.example-retail.co.il/',
        loginUrl: 'https://www.example-retail.co.il/login',
        method: 'visible-link',
        confidence: 'high',
        candidates: [
          {
            url: 'https://sa.example-retail.co.il/login/index',
            method: 'visible-link',
            confidence: 'high',
            score: 20,
          },
        ],
      };
      assert(
        shouldPersistDiscoveredLoginUrl(shadowedBareLogin) === false,
        'T26: bare /login shadowed by portal sibling must not persist',
      );

      // Shufersal-shaped path must NOT be blank-rejected as "generic /login"
      const shufersalShape = {
        success: true,
        primaryUrl: 'https://www.example-shop.co.il/',
        loginUrl: 'https://www.example-shop.co.il/online/he/login',
        method: 'visible-link',
        confidence: 'high',
        loginEntryType: 'navigable',
      };
      assert(
        shouldPersistDiscoveredLoginUrl(shufersalShape) === true,
        'T26b/M10: /online/he/login must persist (not endsWith /login blank-reject)',
      );

      // Hapoalim-class trusted auth subdomain
      const hapoalimShape = {
        success: true,
        primaryUrl: 'https://www.bankhapoalim.co.il/',
        loginUrl: 'https://login.bankhapoalim.co.il/',
        method: 'visible-link',
        confidence: 'high',
        loginEntryType: 'navigable',
      };
      assert(
        shouldPersistDiscoveredLoginUrl(hapoalimShape) === true,
        'T26c: login.* auth subdomain must persist',
      );
    }

    // Direct gate: clientslogin + typeentry
    {
      const gateBundle = await bundle('src/discovery/loginAudienceGate.ts');
      try {
        const { isAlternateAudiencePortalUrl, evaluateLoginAudience } = gateBundle.mod;
        const clients =
          'https://www.example-retail.co.il/clientslogin.aspx?typeentry=3';
        assert(
          isAlternateAudiencePortalUrl(clients) === true,
          'clientslogin.aspx?typeentry= must be alternate-audience',
        );
        assert(
          evaluateLoginAudience('https://www.example-retail.co.il/', clients).accept === false,
          'clientslogin must be rejected by audience gate',
        );
      } finally {
        gateBundle.cleanup();
      }
    }

    // --- T27 ACCEPT: ordinary dedicated consumer login form (Shufersal-class) ---
    {
      const primary = 'https://www.example-shop.co.il/';
      const pageUrl = 'https://www.example-shop.co.il/online/he/login';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptLoginHtml,
        pageUrl,
        primary,
      );
      assert(result.success && result.loginUrl, 'T27: must persist consumer loginUrl');
      assert(
        /\/online\/he\/login/i.test(result.loginUrl),
        'T27: loginUrl is dedicated consumer path',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T27: persist gate ACCEPT');
      assert(!/sa\./i.test(result.loginUrl), 'T27: never portal');
    }

    // --- T28 ACCEPT: homepage modal trigger + separate navigable consumer ---
    {
      const primary = 'https://www.example-shop.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptModalNavHtml,
        primary,
        primary,
      );
      assert(result.success && result.loginUrl, 'T28: modal must not veto navigable');
      assert(
        /\/online\/he\/login/i.test(result.loginUrl),
        'T28: persist navigable consumer URL',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T28: persist ACCEPT');
      const deferral = resolvePhase112Deferral(result);
      assert(
        deferral.loginIntelligenceHint === 'complex_login_surface' ||
          deferral.phase112Deferred === false ||
          deferral.loginIntelligenceHint === null,
        'T28: not modal_on_primary blank reject',
      );
    }

    // --- T29 ACCEPT: portal sibling + stronger same-origin consumer ---
    {
      const primary = 'https://www.example-retail.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptPortalSiblingHtml,
        primary,
        primary,
      );
      assert(result.success && result.loginUrl, 'T29: consumer must win over portal sibling');
      assert(
        /\/online\/he\/login/i.test(result.loginUrl),
        'T29: persist consumer, not portal',
      );
      assert(!/sa\.example-retail/i.test(result.loginUrl), 'T29: never sa.*');
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T29: persist ACCEPT');
      if (result.rejectedLoginUrl) {
        assert(
          /sa\.example-retail/i.test(result.rejectedLoginUrl),
          'T29: portal recorded as rejected sibling only',
        );
      }
    }

    // --- T30 ACCEPT: same-origin dedicated /login form (HTZone-class) ---
    {
      const primary = 'https://www.example-ht.co.il/';
      const pageUrl = 'https://www.example-ht.co.il/login';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptBareLoginHtml,
        pageUrl,
        primary,
      );
      assert(result.success && result.loginUrl, 'T30: dedicated /login form may persist');
      assert(/\/login$/i.test(new URL(result.loginUrl).pathname.replace(/\/$/, '') + '') ||
        result.loginUrl.includes('/login'), 'T30: login path');
      assert(result.method === 'dedicated-login-page', 'T30: dedicated-login-page method');
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T30: persist ACCEPT');
    }

    // --- T31 ACCEPT: trusted auth subdomain (Clalit-class) ---
    {
      const primary = 'https://www.example-health.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptAuthSubHtml,
        primary,
        primary,
      );
      assert(result.success && result.loginUrl, 'T31: trusted auth subdomain ACCEPT');
      assert(
        /e-services\.example-health/i.test(result.loginUrl),
        'T31: e-services login URL',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T31: persist ACCEPT');
    }

    // --- T32 ACCEPT: GitHub-class same-origin /login visible link ---
    {
      const primary = 'https://github.com/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptGithubHtml,
        primary,
        primary,
      );
      assert(result.success && result.loginUrl, 'T32: GitHub-class /login must be found');
      assert(
        /github\.com\/login/i.test(result.loginUrl),
        'T32: persist https://github.com/login',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T32: persist ACCEPT');
    }

    // --- T33 ACCEPT: Hapoalim-class login.* auth subdomain ---
    {
      const primary = 'https://www.example-bank.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptBankAuthHtml,
        primary,
        primary,
      );
      assert(result.success && result.loginUrl, 'T33: auth subdomain login must be found');
      assert(
        /login\.example-bank\.co\.il/i.test(result.loginUrl),
        'T33: persist login.* subdomain',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T33: persist ACCEPT');
    }

    // --- T33b ACCEPT: Clalit-class home — e-services beats homepage chrome button ---
    {
      const primary = 'https://www.example-health.co.il/';
      const pageUrl = 'https://www.example-health.co.il/he/Pages/default.aspx';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptClalitHomeHtml,
        pageUrl,
        primary,
      );
      assert(result.success && result.loginUrl, 'T33b: must find consumer login');
      assert(
        /e-services\.example-health/i.test(result.loginUrl),
        'T33b: must prefer e-services over homepage self-page button',
      );
      assert(
        !/Pages\/default\.aspx/i.test(result.loginUrl),
        'T33b: must not persist homepage URL as login_url',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T33b: persist ACCEPT');
    }

    // --- T33c ACCEPT: Bank Jerusalem-class services.*/Pages/Login.aspx ---
    {
      const primary = 'https://www.example-bank.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptServicesLoginHtml,
        primary,
        primary,
      );
      assert(result.success && result.loginUrl, 'T33c: services.* Login.aspx must be found');
      assert(
        /services\.example-bank\.co\.il\/Pages\/Login\.aspx/i.test(result.loginUrl),
        'T33c: persist services.*/Pages/Login.aspx',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T33c: persist ACCEPT');
      assert(
        !/sa\./i.test(result.loginUrl),
        'T33c: must not be portal subdomain',
      );
    }

    // Direct gate: Bank Jerusalem-shaped URL must be accepted
    {
      const gateBundle = await bundle('src/discovery/loginAudienceGate.ts');
      try {
        const { evaluateLoginAudience, isAlternateAudiencePortalUrl, isTrustedAuthSubdomain } =
          gateBundle.mod;
        const jerusalemLogin =
          'https://services.bankjerusalem.co.il/Pages/Login.aspx';
        assert(
          isAlternateAudiencePortalUrl(jerusalemLogin) === false,
          'Bank Jerusalem Login.aspx must not be alternate-audience portal',
        );
        assert(
          isTrustedAuthSubdomain('services.bankjerusalem.co.il') === true,
          'services.* must be trusted auth subdomain',
        );
        assert(
          evaluateLoginAudience('https://www.bankjerusalem.co.il/', jerusalemLogin).accept ===
            true,
          'Bank Jerusalem services login must be accepted by audience gate',
        );
      } finally {
        gateBundle.cleanup();
      }
    }

    // --- U22 catalog-equivalent persist shapes (static proxy for rediscovery) ---
    {
      const catalogShapes = [
        {
          name: 'Shufersal',
          primaryUrl: 'https://www.shufersal.co.il/',
          loginUrl: 'https://www.shufersal.co.il/online/he/login',
          method: 'visible-link',
        },
        {
          name: 'Clalit',
          primaryUrl: 'https://www.clalit.co.il/',
          loginUrl: 'https://e-services.clalit.co.il/onlineweb/general/login.aspx',
          method: 'visible-link',
        },
        {
          name: 'HTZone',
          primaryUrl: 'https://www.htzone.co.il/',
          loginUrl: 'https://www.htzone.co.il/login',
          method: 'dedicated-login-page',
        },
      ];
      for (const shape of catalogShapes) {
        const result = {
          success: true,
          primaryUrl: shape.primaryUrl,
          loginUrl: shape.loginUrl,
          method: shape.method,
          confidence: 'high',
          loginEntryType: 'navigable',
          usesModal: false,
        };
        assert(
          shouldPersistDiscoveredLoginUrl(result) === true,
          `U22/${shape.name}: catalog login_url shape must remain persistable`,
        );
      }
    }

    assert(
      !read('src/execution/genericAutofill.ts').includes('usesModal'),
      'Scope: no modal autofill wiring',
    );

    console.log('verifyPhase108FalsePositiveGate: PASS');
    console.log(
      'REJECT: Zap-class home/portal, modal-only, common-path /login, portal-shadowed bare /login, clientslogin',
    );
    console.log(
      'ACCEPT: dedicated form, modal+navigable, portal-sibling+consumer, /login form, e-services, GitHub /login, login.* bank, services Login.aspx; U22 shapes',
    );
  } finally {
    discoverBundle.cleanup();
    policyBundle.cleanup();
    metaBundle.cleanup();
  }
}

main().catch((error) => {
  console.error('verifyPhase108FalsePositiveGate: FAIL');
  console.error(error);
  process.exit(1);
});
