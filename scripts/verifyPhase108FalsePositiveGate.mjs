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

  const audience = read('src/discovery/loginAudienceGate.ts');
  assert(
    audience.includes('D-108-21') && audience.includes('trustedOrDedicated'),
    'M12 evaluateLoginAudience must document D-108-21 trusted-auth priority',
  );
  assert(
    !audience.includes("'כניסת לקוחות'") && !audience.includes('"כניסת לקוחות"'),
    'D-108-22: bare כניסת לקוחות must not be a standalone reject token',
  );
  assert(
    audience.includes('stripApplicationShellPathTokens') ||
      audience.includes('ng-portals'),
    'D-108-23: ng-portals / portal shell tokens must not be portal evidence alone',
  );

  assert(
    discover.includes('buildTrustedAuthHostProbeUrls') &&
      discover.includes('validateConsumerLoginPageUrl') &&
      discover.includes('probeAuthHosts'),
    'M13 D-108-24 trusted-auth host probe required in discoverLoginEntry',
  );
  assert(
    !/if\s*\(\s*result\.method\s*===\s*'common-path'\s*\|\|\s*result\.confidence\s*===\s*'low'\s*\)\s*\{\s*return false/.test(
      policy,
    ),
    'D-108-26: must not blank-reject solely for common-path / low in shouldPersistDiscoveredLoginUrl',
  );
  assertNoServiceBranching();
}

async function runDiscovery(
  discoverLoginEntry,
  sanitizeDiscoveryResult,
  html,
  pageUrl,
  primary,
  extraOptions = {},
) {
  const dom = installDom(html, pageUrl);
  try {
    const raw = await discoverLoginEntry(primary, {
      document: dom.document,
      pageUrl,
      followRedirects: false,
      tryCommonPaths: true,
      assumeVisible: true,
      probeAuthHosts: true,
      ...extraOptions,
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
    const acceptHapoalimNgPortalsHtml = read(
      'scripts/fixtures/phase108-accept-hapoalim-ng-portals.html',
    );
    const acceptKspHomeHtml = read('scripts/fixtures/phase108-accept-ksp-home-no-link.html');
    const acceptKspAuthLoginHtml = read('scripts/fixtures/phase108-accept-ksp-auth-login.html');
    const acceptGithubNoLinkHtml = read(
      'scripts/fixtures/phase108-accept-github-home-no-link.html',
    );
    const acceptGithubLoginPageHtml = read(
      'scripts/fixtures/phase108-accept-github-login-page.html',
    );
    const acceptServicesLoginHtml = read(
      'scripts/fixtures/phase108-accept-services-login-aspx.html',
    );
    const acceptTrelloIdpHtml = read('scripts/fixtures/phase108-accept-trello-home-idp.html');
    const acceptPaypalHomeHtml = read('scripts/fixtures/phase108-accept-paypal-home.html');
    const acceptPaypalLoginHtml = read('scripts/fixtures/phase108-accept-paypal-login.html');
    const acceptZoomHomeHtml = read('scripts/fixtures/phase108-accept-zoom-home.html');
    const acceptZoomSigninHtml = read('scripts/fixtures/phase108-accept-zoom-signin.html');
    const zapPortalWithFieldsHtml = read(
      'scripts/fixtures/phase108-zap-class-portal-with-fields.html',
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
        {
          probeHtmlByUrl: {
            'https://www.example-shop.co.il/online/he/login': acceptLoginHtml,
          },
        },
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
        {
          probeHtmlByUrl: {
            'https://www.example-retail.co.il/online/he/login': acceptLoginHtml,
          },
        },
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
        {
          probeHtmlByUrl: {
            'https://e-services.example-health.co.il/onlineweb/general/login.aspx':
              acceptLoginHtml,
          },
        },
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
        {
          probeHtmlByUrl: {
            'https://github.com/login': acceptGithubLoginPageHtml,
          },
        },
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
        {
          probeHtmlByUrl: {
            'https://login.example-bank.co.il/':
              '<!doctype html><html><head><title>Sign in</title></head><body><div id="root"></div></body></html>',
          },
        },
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
        {
          probeHtmlByUrl: {
            'https://e-services.example-health.co.il/onlineweb/general/login.aspx':
              acceptLoginHtml,
          },
        },
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
        {
          probeHtmlByUrl: {
            'https://services.example-bank.co.il/Pages/Login.aspx': acceptLoginHtml,
          },
        },
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

    // --- T37 ACCEPT: Bank Hapoalim-class login.* / ng-portals + homepage modal (AC-108-22) ---
    {
      const primary = 'https://www.example-bank.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptHapoalimNgPortalsHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://login.example-bank.co.il/ng-portals/auth/he/login':
              '<!doctype html><html><head><title>כניסה</title></head><body><div id="root"></div></body></html>',
          },
        },
      );
      assert(result.success && result.loginUrl, 'T37: Hapoalim-class auth URL must be found');
      assert(
        /login\.example-bank\.co\.il\/ng-portals\/auth\/he\/login/i.test(result.loginUrl),
        'T37: persist login.*/ng-portals/auth/he/login',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T37: persist ACCEPT');
      assert(
        result.success === true && Boolean(result.loginUrl),
        'T37: must not blank trusted-auth as needs_review / portal deferral',
      );
    }

    // Direct gate: Hapoalim-class URL + modal + retail wording must ACCEPT (D-108-21…23)
    {
      const gateBundle = await bundle('src/discovery/loginAudienceGate.ts');
      try {
        const {
          evaluateLoginAudience,
          isAlternateAudiencePortalUrl,
          textHasAlternateAudienceWording,
          ALTERNATE_AUDIENCE_WORDING,
        } = gateBundle.mod;
        const hapoalimLogin =
          'https://login.bankhapoalim.co.il/ng-portals/auth/he/login';
        assert(
          isAlternateAudiencePortalUrl(hapoalimLogin) === false,
          'T37b: ng-portals alone must not mark portal',
        );
        assert(
          !ALTERNATE_AUDIENCE_WORDING.includes('כניסת לקוחות'),
          'T37b: bare כניסת לקוחות removed from wording list',
        );
        assert(
          textHasAlternateAudienceWording('כניסת לקוחות') === false,
          'T37b: bare כניסת לקוחות must not match wording',
        );
        assert(
          evaluateLoginAudience('https://www.bankhapoalim.co.il/', hapoalimLogin, {
            primaryHasModalLoginTrigger: true,
            pageTitle: 'כניסת לקוחות',
            pageContextText: 'כניסת לקוחות',
          }).accept === true,
          'T37b: trusted auth ACCEPT despite modal + retail wording',
        );
        // Zap still REJECT
        assert(
          evaluateLoginAudience(
            'https://www.zap.co.il/',
            'https://sa.zap.co.il/login/index',
            { primaryHasModalLoginTrigger: true },
          ).accept === false,
          'T37b: Zap-class sa.* still REJECT',
        );
      } finally {
        gateBundle.cleanup();
      }
    }

    // --- T41 ACCEPT: KSP-class auth host probe (AC-108-23 / D-108-24…25) ---
    {
      const primary = 'https://www.ksp.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://auth.ksp.co.il/login': acceptKspAuthLoginHtml,
            // Dead invent — empty non-login page must NOT win over auth probe.
            'https://www.ksp.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
            'https://ksp.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
          },
        },
      );
      assert(result.success && result.loginUrl, 'T41: KSP auth probe must find loginUrl');
      assert(
        /auth\.ksp\.co\.il\/login/i.test(result.loginUrl),
        'T41: persist auth.ksp.co.il/login (not dead ksp.co.il/login)',
      );
      assert(
        !/^https:\/\/(www\.)?ksp\.co\.il\/login/i.test(result.loginUrl),
        'T41: must not prefer dead same-origin invent',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T41: persist ACCEPT');
    }

    // --- T42 ACCEPT: GitHub-class validated common-path (AC-108-23 / D-108-26) ---
    {
      const primary = 'https://github.com/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptGithubNoLinkHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://github.com/login': acceptGithubLoginPageHtml,
          },
        },
      );
      assert(result.success && result.loginUrl, 'T42: GitHub /login must be found after validation');
      assert(
        /github\.com\/login/i.test(result.loginUrl),
        'T42: persist https://github.com/login',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T42: persist ACCEPT');
      assert(
        result.method === 'dedicated-login-page' || result.confidence !== 'low',
        'T42: validated common-path should upgrade method/confidence',
      );
    }

    // D-108-26 direct persist: common-path + medium must not blank-reject
    {
      const githubCommonPath = {
        success: true,
        primaryUrl: 'https://github.com/',
        loginUrl: 'https://github.com/login',
        method: 'common-path',
        confidence: 'medium',
        loginEntryType: 'navigable',
      };
      assert(
        shouldPersistDiscoveredLoginUrl(githubCommonPath) === true,
        'T42b: validated common-path/medium must persist (D-108-26)',
      );
    }

    // --- T41c: SPA auth shell (fetched, no password) still persists (U24) ---
    {
      const acceptKspSpaShellHtml = read(
        'scripts/fixtures/phase108-accept-ksp-auth-spa-shell.html',
      );
      const primary = 'https://www.ksp.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://auth.ksp.co.il/login': acceptKspSpaShellHtml,
            'https://www.ksp.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
            'https://ksp.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
          },
        },
      );
      assert(result.success && result.loginUrl, 'T41c: SPA shell must set loginUrl');
      assert(
        /auth\.ksp\.co\.il\/login/i.test(result.loginUrl),
        'T41c: persist auth.ksp SPA shell with login title',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T41c: persist ACCEPT');
    }

    // --- T41e: minimal #root SPA without login wording still ACCEPT when host 2xx ---
    {
      const primary = 'https://www.ksp.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://auth.ksp.co.il/login':
              '<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>',
            'https://www.ksp.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
          },
        },
      );
      assert(result.success && result.loginUrl, 'T41e: minimal SPA shell must ACCEPT');
      assert(/auth\.ksp\.co\.il\/login/i.test(result.loginUrl), 'T41e: auth.ksp URL');
    }

    // --- T41d: missing probe HTML must NOT invent auth.*/login (Zap-class FP) ---
    {
      const primary = 'https://www.ksp.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://www.ksp.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
            'https://ksp.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
          },
        },
      );
      assert(!result.loginUrl, 'T41d: unreachable auth host → must not invent loginUrl');
      assert(shouldPersistDiscoveredLoginUrl(result) === false, 'T41d: must not persist');
    }

    // --- T41f: fetchProbeHtml reached:false must not invent; reached+2xx SPA must ---
    {
      const primary = 'https://www.ksp.co.il/';
      const miss = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {},
          fetchProbeHtml: async () => ({ ok: false, reached: false, reason: 'network_error' }),
        },
      );
      assert(!miss.loginUrl, 'T41f-miss: reached false → NULL');

      const hit = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {},
          fetchProbeHtml: async (url) => {
            if (/auth\.ksp\.co\.il\/login/i.test(url)) {
              return {
                ok: true,
                reached: true,
                status: 200,
                html: '<!doctype html><html><body><div id="root"></div><script src="/x.js"></script></body></html>',
                finalUrl: url,
              };
            }
            return { ok: false, reached: false, reason: 'skip' };
          },
        },
      );
      assert(hit.success && /auth\.ksp\.co\.il\/login/i.test(hit.loginUrl || ''), 'T41f-hit: 2xx SPA ACCEPT');
    }

    // --- T41g: DNS exists + fetch failed → ACCEPT; NXDOMAIN → NULL ---
    {
      const primary = 'https://www.ksp.co.il/';
      const dnsHit = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {},
          fetchProbeHtml: async (url) => {
            if (/auth\.ksp\.co\.il\/login/i.test(url)) {
              return {
                ok: false,
                reached: true,
                status: 0,
                dnsExists: true,
                finalUrl: url,
                reason: 'dns_exists_fetch_failed',
              };
            }
            return { ok: false, reached: false, reason: 'skip' };
          },
        },
      );
      assert(
        dnsHit.success && /auth\.ksp\.co\.il\/login/i.test(dnsHit.loginUrl || ''),
        'T41g: DNS-proven auth host must ACCEPT',
      );

      const nx = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {},
          fetchProbeHtml: async () => ({ ok: false, reached: false, reason: 'nxdomain' }),
        },
      );
      assert(!nx.loginUrl, 'T41g: NXDOMAIN must stay NULL');
    }

    // --- T41i: unverified invent removed; no-cors/DNS proof required ---
    {
      const primary = 'https://www.ksp.co.il/';
      const without = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {},
          fetchProbeHtml: async () => ({ ok: false, reached: false }),
        },
      );
      assert(!without.loginUrl, 'T41i: unreachable must NOT invent loginUrl');

      const withReach = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptKspHomeHtml,
        primary,
        primary,
        {
          allowUnverifiedAuthLoginInvent: true,
          probeHtmlByUrl: {},
          fetchProbeHtml: async (url) => {
            if (/auth\.ksp\.co\.il\/login/i.test(url)) {
              return {
                ok: false,
                reached: true,
                status: 0,
                dnsExists: true,
                finalUrl: url,
                reason: 'no_cors_reachable',
              };
            }
            return { ok: false, reached: false };
          },
        },
      );
      assert(
        withReach.success && /auth\.ksp\.co\.il\/login/i.test(withReach.loginUrl || ''),
        'T41i: no-cors/DNS reachability must ACCEPT auth-host /login',
      );
      assert(shouldPersistDiscoveredLoginUrl(withReach) === true, 'T41i: persist ACCEPT');
    }

    // --- T50c: retail auth invent without reachability must stay NULL ---
    {
      const retailNoLoginHtml = read(
        'scripts/fixtures/phase108-reject-retail-no-login-invent.html',
      );
      const primary = 'https://www.example-retail.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        retailNoLoginHtml,
        primary,
        primary,
        {
          allowUnverifiedAuthLoginInvent: true,
          probeHtmlByUrl: {},
          fetchProbeHtml: async () => ({ ok: false, reached: false }),
        },
      );
      assert(!result.loginUrl, 'T50c: unverified flag must not invent auth.*/login');
      assert(
        !/auth\.example-retail\.co\.il/i.test(String(result.loginUrl ?? '')),
        'T50c: never invent dead auth host',
      );
    }

    // --- T41h: homepage modal must not block trusted-auth probe (U24) ---
    {
      const kspModalHtml = `<!doctype html><html lang="he"><head><title>KSP</title></head>
        <body><button type="button" aria-haspopup="dialog">התחברות</button>
        <main><h1>חנות</h1></main></body></html>`;
      const primary = 'https://www.ksp.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        kspModalHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {},
          fetchProbeHtml: async (url) => {
            if (/auth\.ksp\.co\.il\/login/i.test(url)) {
              return {
                ok: false,
                reached: true,
                status: 0,
                dnsExists: true,
                finalUrl: url,
              };
            }
            return { ok: false, reached: false };
          },
        },
      );
      assert(result.success && result.loginUrl, 'T41h: probe before modal must set loginUrl');
      assert(/auth\.ksp\.co\.il\/login/i.test(result.loginUrl), 'T41h: auth.ksp URL');
    }

    // --- T50: retail home + invented auth.*/login without evidence → NULL (Zap FP) ---
    {
      const retailNoLoginHtml = read(
        'scripts/fixtures/phase108-reject-retail-no-login-invent.html',
      );
      const primary = 'https://www.example-retail.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        retailNoLoginHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            // Dead invented hosts — must not soft-accept.
            'https://auth.example-retail.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
            'https://login.example-retail.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
            'https://www.example-retail.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
          },
        },
      );
      assert(!result.loginUrl, 'T50: must not persist invented auth.*/login');
      assert(
        !/auth\.example-retail\.co\.il/i.test(String(result.loginUrl ?? '')),
        'T50: never auth.example-retail',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === false, 'T50: persist REJECT');
    }

    // --- T50b: missing probe HTML also must not invent (fetch-miss FP) ---
    {
      const retailNoLoginHtml = read(
        'scripts/fixtures/phase108-reject-retail-no-login-invent.html',
      );
      const primary = 'https://www.example-retail.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        retailNoLoginHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://www.example-retail.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
          },
        },
      );
      assert(!result.loginUrl, 'T50b: missing auth HTML → NULL');
      assert(shouldPersistDiscoveredLoginUrl(result) === false, 'T50b: persist REJECT');
    }

    // --- T46 ACCEPT: Trello-class federated IdP (AC-108-24 / D-108-27) ---
    {
      const primary = 'https://trello.com/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptTrelloIdpHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://id.atlassian.com/login':
              '<!doctype html><html><head><title>Log in to continue - Log in with Atlassian account</title></head><body><div id="root"></div></body></html>',
            'https://id.atlassian.com/signup':
              '<!doctype html><html><head><title>Sign up</title></head><body><div id="root"></div></body></html>',
          },
        },
      );
      assert(result.success && result.loginUrl, 'T46: Trello IdP must find loginUrl');
      assert(
        /id\.atlassian\.com\/login/i.test(result.loginUrl),
        'T46: persist canonical id.atlassian.com/login (not /signup shell)',
      );
      assert(
        !/\/signup/i.test(result.loginUrl),
        'T46: must canonicalize signup → login',
      );
      assert(
        /continue=.*trello\.com|application=trello/i.test(result.loginUrl),
        'T46: brand-return evidence present',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T46: persist ACCEPT');
      assert(
        result.loginEntryType === 'navigable',
        'T46: navigable IdP wins over homepage Log in modal',
      );
    }

    // --- T48: signup in path/application= must not sole-reject when IdP + brand-return ---
    {
      const gateBundle = await bundle('src/discovery/loginAudienceGate.ts');
      try {
        const {
          evaluateLoginAudience,
          hasPrimaryBrandReturnEvidence,
          canonicalizeFederatedIdPLoginUrl,
        } = gateBundle.mod;
        const trelloSignup =
          'https://id.atlassian.com/signup?application=trello--direct-signup&continue=https://trello.com/auth/atlassian/callback?createMember=true';
        assert(
          hasPrimaryBrandReturnEvidence('https://trello.com/', trelloSignup) === true,
          'T48: brand-return from application=trello + continue',
        );
        assert(
          evaluateLoginAudience('https://trello.com/', trelloSignup, {
            primaryHasModalLoginTrigger: true,
            pageContextText: 'Trello for Business teams',
            pageTitle: 'Trello',
          }).accept === true,
          'T48: ACCEPT signup shell despite Business page context + modal',
        );
        const canonical = canonicalizeFederatedIdPLoginUrl('https://trello.com/', trelloSignup);
        assert(
          /id\.atlassian\.com\/login/i.test(canonical) && !/\/signup/i.test(canonical),
          'T48: canonicalize signup → login',
        );
      } finally {
        gateBundle.cleanup();
      }
    }

    // --- T49: cross-domain IdP-shaped host without brand-return → REJECT ---
    {
      const gateBundle = await bundle('src/discovery/loginAudienceGate.ts');
      try {
        const { evaluateLoginAudience } = gateBundle.mod;
        assert(
          evaluateLoginAudience(
            'https://trello.com/',
            'https://id.evil-example.com/login',
          ).accept === false,
          'T49: no brand-return → REJECT',
        );
        assert(
          evaluateLoginAudience(
            'https://www.zap.co.il/',
            'https://sa.zap.co.il/login/index',
          ).accept === false,
          'T49b: Zap REJECT unchanged',
        );
      } finally {
        gateBundle.cleanup();
      }
    }

    // --- T50 ACCEPT: PayPal-class live-validated same-origin /login (AC-108-25 / D-108-28) ---
    {
      const primary = 'https://www.paypal.com/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptPaypalHomeHtml,
        primary,
        primary,
        {
          // Live PayPal often returns DataDome 403 on /login with no identity fields.
          probeHtmlByUrl: {},
          fetchProbeHtml: async (url) => {
            if (/paypal\.com\/login/i.test(url)) {
              return {
                ok: false,
                reached: true,
                status: 403,
                html: '<!doctype html><title>paypal.com</title><body>datadome</body>',
                finalUrl: 'https://www.paypal.com/signin',
                reason: 'http_403',
              };
            }
            return { ok: false, reached: false, reason: 'skip' };
          },
        },
      );
      assert(result.success && result.loginUrl, 'T50: PayPal login must be found');
      assert(
        /paypal\.com\/login/i.test(result.loginUrl),
        'T50: persist https://www.paypal.com/login',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T50: persist ACCEPT');
    }

    // --- T50d ACCEPT: PayPal SPA shell 2xx without identity fields ---
    {
      const primary = 'https://www.paypal.com/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptPaypalHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://www.paypal.com/login': acceptPaypalLoginHtml,
          },
        },
      );
      assert(result.success && result.loginUrl, 'T50d: PayPal SPA shell must ACCEPT');
      assert(/paypal\.com\/login/i.test(result.loginUrl), 'T50d: persist /login');
    }

    // --- T51 ACCEPT: Zoom sibling-TLD signin (AC-108-25 / D-108-29) ---
    {
      const primary = 'https://www.zoom.com/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        acceptZoomHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://zoom.us/signin': acceptZoomSigninHtml,
          },
        },
      );
      assert(result.success && result.loginUrl, 'T51: Zoom signin must be found');
      assert(/zoom\.us\/signin/i.test(result.loginUrl), 'T51: persist https://zoom.us/signin');
      assert(shouldPersistDiscoveredLoginUrl(result) === true, 'T51: persist ACCEPT');
      assert(
        result.loginEntryType === 'navigable',
        'T51: sibling-TLD navigable must win over homepage modal',
      );
    }

    // --- T52 REJECT: Zap-class portal WITH identity fields (D-108-30) ---
    {
      const primary = 'https://www.example-retail.co.il/';
      const portalUrl = 'https://sa.example-retail.co.il/login/index';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        zapHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            // Portal page HAS identity fields — must still REJECT (D-108-30).
            [portalUrl]: zapPortalWithFieldsHtml,
            // Dead invents must not become ACCEPTs via portal HTML reuse.
            'https://www.example-retail.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
            'https://auth.example-retail.co.il/login':
              '<!doctype html><title>404</title><body><p>Not found</p></body>',
          },
        },
      );
      assert(!result.loginUrl, 'T52: loginUrl must stay null despite form fields');
      assert(
        !/sa\.example-retail\.co\.il/i.test(String(result.loginUrl ?? '')),
        'T52: never persist sa.* even with identity fields',
      );
      assert(shouldPersistDiscoveredLoginUrl(result) === false, 'T52: persist REJECT');

      const gateBundle = await bundle('src/discovery/loginAudienceGate.ts');
      try {
        const { evaluateLoginAudience, isAlternateAudiencePortalUrl } = gateBundle.mod;
        assert(
          isAlternateAudiencePortalUrl(portalUrl) === true,
          'T56: portal URL is alternate-audience',
        );
        assert(
          evaluateLoginAudience(primary, portalUrl, {
            pageTitle: 'כניסה לממשק העסק',
            pageContextText: 'ממשק העסק',
          }).accept === false,
          'T56: audience REJECT wins over field presence',
        );
      } finally {
        gateBundle.cleanup();
      }
    }

    // --- T52b REJECT: modal + portal + reachable bare /login SPA (live retail FP) ---
    {
      const primary = 'https://www.example-retail.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        zapHomeHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {
            'https://sa.example-retail.co.il/login/index': zapPortalWithFieldsHtml,
            'https://www.example-retail.co.il/login':
              '<!doctype html><html><head><title>כניסה לחשבון</title></head><body><div id="root"></div><h1>כניסה</h1></body></html>',
          },
          fetchProbeHtml: async (url) => {
            if (/\/login$/i.test(url) && !/sa\./i.test(url)) {
              return {
                ok: true,
                reached: true,
                status: 200,
                html: '<!doctype html><title>כניסה</title><body><div id="app"></div></body>',
                finalUrl: url,
              };
            }
            return { ok: false, reached: false, reason: 'skip' };
          },
        },
      );
      assert(!result.loginUrl, 'T52b: bare /login must stay NULL beside modal+portal');
      assert(shouldPersistDiscoveredLoginUrl(result) === false, 'T52b: persist REJECT');
    }

    // --- T52c REJECT: modal + bare /login bot-403 without portal link (still NULL) ---
    {
      const modalBareLoginHtml = `<!doctype html><html lang="he"><head><title>השוואת מחירים</title></head>
<body><button type="button" aria-haspopup="dialog">התחברות</button>
<a href="/login">כניסה לחשבון</a></body></html>`;
      const primary = 'https://www.example-retail.co.il/';
      const result = await runDiscovery(
        discoverLoginEntry,
        sanitizeDiscoveryResult,
        modalBareLoginHtml,
        primary,
        primary,
        {
          probeHtmlByUrl: {},
          fetchProbeHtml: async (url) => {
            if (/example-retail\.co\.il\/login/i.test(url)) {
              return {
                ok: false,
                reached: true,
                status: 403,
                html: '<!doctype html><title>blocked</title><body>forbidden</body>',
                finalUrl: url,
                reason: 'http_403',
              };
            }
            return { ok: false, reached: false, reason: 'skip' };
          },
        },
      );
      assert(!result.loginUrl, 'T52c: modal + bare /login 403 must not soft-ACCEPT');
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
      'ACCEPT: dedicated form, modal+navigable, portal-sibling+consumer, /login form, e-services, GitHub /login, login.* bank, services Login.aspx, Hapoalim ng-portals (T37), KSP auth probe (T41/T41c), GitHub validated common-path (T42), Trello IdP (T46), PayPal live-validate (T50), Zoom sibling-TLD (T51); U22 shapes',
    );
    console.log('REJECT also: Zap portal with identity fields (T52) — fields never override audience');
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
