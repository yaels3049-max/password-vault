/**
 * Phase 108 — Generic modal-login + alternate-audience discovery gate (blocking defect).
 *
 * Proves brand-agnostic rules (no service-id / brand branching in source):
 *   - alternate-audience portals (sa/merchant/admin/…) are rejected
 *   - hub sanitizeDiscoveryResult strips portal loginUrl even if engine returned success
 *   - untrusted cross-subdomain candidates need review
 *   - trusted auth subdomains remain acceptable without modal on primary
 *   - modal + rejected portal → needs_review, usesModal, loginUrl cleared
 *   - auto valid false-positives are clearable (admin override preserved)
 *   - source tree has no ZAP / Mizrahi / brand-specific discovery branches
 *
 * Fixture URLs are pattern examples only — not special-cased in production code.
 *
 * Usage: node scripts/verifyPhase108ModalAudience.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

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

function walkTsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walkTsFiles(full, acc);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

async function bundleEsm(entryRelative) {
  const dir = mkdtempSync(join(tmpdir(), 'phase108-modal-'));
  const outfile = join(dir, 'bundle.mjs');
  try {
    await build({
      entryPoints: [join(root, entryRelative)],
      outfile,
      bundle: true,
      format: 'esm',
      platform: 'node',
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

function assertNoServiceSpecificBranching() {
  const discoveryDirs = [
    join(root, 'src/discovery'),
    join(root, 'src/registry/loginUrlDiscovery.ts'),
    join(root, 'src/registry/loginDiscoveryMetadata.ts'),
    join(root, 'src/catalog/customServiceDiscovery.ts'),
  ];

  const files = [];
  for (const path of discoveryDirs) {
    const st = statSync(path);
    if (st.isDirectory()) {
      walkTsFiles(path, files);
    } else {
      files.push(path);
    }
  }

  const banned = [/\bzap\b/i, /mizrahi/i, /tefahot/i];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of banned) {
      assert(
        !pattern.test(text),
        `Service-specific discovery branching forbidden in ${file} (matched ${pattern})`,
      );
    }
  }
}

function assertSourceContracts() {
  const gate = read('src/discovery/loginAudienceGate.ts');
  const discover = read('src/discovery/discoverLoginEntry.ts');
  const policy = read('src/discovery/loginDiscoveryPolicy.ts');
  const persist = read('src/registry/loginUrlDiscovery.ts');
  const override = read('src/registry/loginUrlOverride.ts');

  assert(
    gate.includes('Consumer login is modal-based; alternate portal candidate rejected.'),
    'Exact Phase 108 modal+portal reason required',
  );
  assert(gate.includes('extractPageAudienceContextText'), 'Page title/heading/nav context required');
  assert(discover.includes('isEmbeddedHomepageLoginForm'), 'Homepage password form must not become loginUrl');
  assert(discover.includes('primaryHasModalLoginTrigger'), 'Modal-first rule required');
  assert(
    discover.includes('pageHasAlternatePortalCandidate') ||
      discover.includes('isGenericLoginPathUrl'),
    'Portal-shadowed generic /login must be rejected',
  );
  assert(policy.includes('sanitizeDiscoveryResult'), 'Hub-side sanitize required');
  assert(persist.includes('sanitizeDiscoveryResult'), 'Persist path must sanitize extension results');
  assert(
    persist.includes('persist_login_discovery_review'),
    'Global review outcomes must persist via RPC (RLS bypass)',
  );
  assert(
    persist.includes('isAdminProtectedLoginUrl'),
    'Only admin-protected URLs may be kept on rediscovery rejection',
  );

  assertNoServiceSpecificBranching();

  const autofill = read('src/execution/genericAutofill.ts');
  assert(
    !autofill.includes('usesModal') && !autofill.toLowerCase().includes('openmodal'),
    'Phase 108 must not add modal autofill',
  );
}

async function main() {
  assertSourceContracts();

  const gateBundle = await bundleEsm('src/discovery/loginAudienceGate.ts');
  const policyBundle = await bundleEsm('src/discovery/loginDiscoveryPolicy.ts');
  try {
    const {
      evaluateLoginAudience,
      isAlternateAudiencePortalUrl,
      MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
      CONSUMER_LOGIN_MODAL_REASON,
    } = gateBundle.mod;
    const {
      shouldPersistDiscoveredLoginUrl,
      classifyDiscoveryReviewStatus,
      sanitizeDiscoveryResult,
    } = policyBundle.mod;

    // Case A — retail primary + sa.* business portal (ZAP-shaped)
    const retailPrimary = 'https://www.example-retail.co.il/';
    const businessPortal = 'https://sa.example-retail.co.il/login/index?ReturnUrl=%2f';
    assert(isAlternateAudiencePortalUrl(businessPortal), 'sa.* subdomain is alternate audience');
    const a = evaluateLoginAudience(retailPrimary, businessPortal, {
      primaryHasModalLoginTrigger: true,
    });
    assert(a.accept === false && a.code === 'alternate_audience_portal', 'Business portal rejected');

    // Case B — bank primary modal-only (Mizrahi-shaped)
    const bankPrimary = 'https://www.example-bank.co.il/';
    const bankModal = {
      success: false,
      primaryUrl: bankPrimary,
      reason: CONSUMER_LOGIN_MODAL_REASON,
      loginEntryType: 'modal',
      usesModal: true,
    };
    assert(classifyDiscoveryReviewStatus(bankModal).loginUrlStatus === 'needs_review');
    assert(shouldPersistDiscoveredLoginUrl(bankModal) === false);

    // Case C — stale engine returned success with portal URL → hub sanitize clears it
    const staleSuccess = {
      success: true,
      primaryUrl: retailPrimary,
      loginUrl: businessPortal,
      method: 'visible-link',
      confidence: 'high',
      modalTrigger: { label: 'התחברות', tagName: 'button' },
    };
    const sanitized = sanitizeDiscoveryResult(staleSuccess);
    assert(sanitized.success === false, 'Sanitize must reject portal success');
    assert(!sanitized.loginUrl, 'Sanitize must clear loginUrl');
    assert(sanitized.usesModal === true && sanitized.loginEntryType === 'modal');
    assert(sanitized.reason === MODAL_WITH_ALTERNATE_AUDIENCE_REASON);
    assert(sanitized.rejectedLoginUrl === businessPortal);
    assert(shouldPersistDiscoveredLoginUrl(sanitized) === false);
    assert(classifyDiscoveryReviewStatus(sanitized).loginUrlStatus === 'needs_review');

    // Case D — portal prefixes
    for (const url of [
      'https://merchant.shop.example/login',
      'https://vendor.brand.example/signin',
      'https://partner.brand.example/login',
      'https://admin.brand.example/login',
      'https://employee.brand.example/login',
      'https://www.brand.example/b2b/login',
    ]) {
      assert(isAlternateAudiencePortalUrl(url), `Must flag portal: ${url}`);
      assert(evaluateLoginAudience('https://www.brand.example/', url).accept === false);
    }

    // Case E — trusted auth still ok without modal
    assert(
      evaluateLoginAudience(
        'https://www.brand.example.co.il/',
        'https://login.brand.example.co.il/signin',
      ).accept === true,
    );

    // Case F — M12 / D-108-21: homepage modal must NOT preempt same-brand trusted auth
    assert(
      evaluateLoginAudience(
        'https://www.brand.example.co.il/',
        'https://login.brand.example.co.il/signin',
        { primaryHasModalLoginTrigger: true },
      ).accept === true,
      'Trusted auth must ACCEPT even when primaryHasModalLoginTrigger',
    );

    // Case F2 — Bank Hapoalim-class ng-portals + retail כניסת לקוחות wording must ACCEPT
    {
      const hapoalimLogin =
        'https://login.bankhapoalim.co.il/ng-portals/auth/he/login';
      assert(
        isAlternateAudiencePortalUrl(hapoalimLogin) === false,
        'ng-portals alone must not be alternate-audience evidence',
      );
      assert(
        evaluateLoginAudience('https://www.bankhapoalim.co.il/', hapoalimLogin, {
          primaryHasModalLoginTrigger: true,
          pageTitle: 'כניסת לקוחות',
          pageContextText: 'כניסת לקוחות | בנק הפועלים',
          label: 'כניסה לחשבון',
        }).accept === true,
        'Hapoalim-class trusted auth must ACCEPT despite modal + retail wording',
      );
    }

    // Case G — untrusted cross-subdomain (bare /login must NOT escape via dedicated-path helper)
    const cross = evaluateLoginAudience(
      'https://www.brand.example.co.il/',
      'https://payments.brand.example.co.il/login',
    );
    assert(cross.accept === false && cross.code === 'cross_subdomain_untrusted');

    // Case H — Bank Jerusalem-class: services.* + Login.aspx is trusted consumer auth
    assert(
      evaluateLoginAudience(
        'https://www.bankjerusalem.co.il/',
        'https://services.bankjerusalem.co.il/Pages/Login.aspx',
        { primaryHasModalLoginTrigger: true },
      ).accept === true,
      'services.*/Pages/Login.aspx must be accepted (modal does not preempt)',
    );

    console.log('verifyPhase108ModalAudience: PASS');
    console.log(
      'Cases: A retail+sa, B bank modal, C hub sanitize, D portals, E trusted auth, F modal+trusted ACCEPT (M12), G untrusted, H services Login.aspx',
    );
  } finally {
    gateBundle.cleanup();
    policyBundle.cleanup();
  }
}

main().catch((error) => {
  console.error('verifyPhase108ModalAudience: FAIL');
  console.error(error);
  process.exit(1);
});
