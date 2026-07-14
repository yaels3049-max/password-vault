/**
 * Phase 110 — Standard login autofill coverage (static verify).
 *
 * Proves hard gates:
 *   H1 no auto-submit in fill executor
 *   H2 visible-only / no hidden fill helpers
 *   H3 open-first / executeServiceFromTile preserved
 *   H4 no AI / probabilistic APIs in generic path
 *   H5 no Shufersal/Clalit/service-id branching in generic engine
 *   Origin-independent eligibility (catalog/custom/admin share gate)
 *
 * Usage: node scripts/verifyPhase110StandardAutofill.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function listFiles(dir, pred, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      listFiles(full, pred, acc);
    } else if (pred(entry, full)) {
      acc.push(full);
    }
  }
  return acc;
}

function main() {
  const eligibility = read('src/execution/autofillEligibility.ts');
  assert(
    eligibility.includes('shouldAttemptGenericAutofill') &&
      eligibility.includes('hasConfiguredLoginFields') &&
      eligibility.includes('loginUrl'),
    'Eligibility must remain metadata-driven (loginFields / loginUrl + credentials)',
  );
  assert(
    /origin-independent|Independent of service id|source_type/i.test(eligibility),
    'Eligibility must document origin-independent catalog/custom/admin coverage',
  );
  assert(
    !/shufersal|clalit|leumi|hapoalim/i.test(eligibility),
    'autofillEligibility must not reference service-id allowlists',
  );

  const execution = read('src/execution/serviceExecution.ts');
  assert(
    execution.includes('executeServiceFromTile') &&
      execution.includes('shouldAttemptGenericAutofill') &&
      execution.includes('executeGenericAutofill'),
    'Phase 103 executeServiceFromTile orchestration must be preserved',
  );
  assert(
    execution.includes('openUrlInNewTab') || execution.includes('getServiceOpenUrl'),
    'Open-first path must remain (openUrl = loginUrl ?? primaryUrl)',
  );
  assert(
    !/shufersal|clalit|leumi|hapoalim/i.test(execution),
    'serviceExecution must not branch on service ids (AC-110-11)',
  );
  assert(
    execution.includes('fill_failed') || execution.includes('FILL_UNAVAILABLE'),
    'Friendly fill_failed / extension-unavailable health signal required (AC-110-9)',
  );
  assert(
    execution.includes('isSiteSpecificAdapter'),
    'Site-specific adapters remain the only non-generic branch',
  );

  const genericHub = read('src/execution/genericAutofill.ts');
  assert(
    genericHub.includes('POC_GENERIC_FILL'),
    'Hub must continue POC_GENERIC_FILL envelope (no second protocol)',
  );
  assert(
    !/shufersal|clalit/i.test(genericHub),
    'genericAutofill Hub helper must not special-case anchors',
  );

  const formDetector = read('extension/generic/form-detector.js');
  assert(
    formDetector.includes('assessStandardLogin'),
    'form-detector must expose standard-login gate',
  );
  assert(
    formDetector.includes('looksLikeBotInterstitial'),
    'form-detector must wait out bot interstitials (Radware/Cloudflare-class)',
  );
  assert(
    formDetector.includes('getVisibleInputs(scope)'),
    'OTP/non-standard gate must inspect visible inputs only (inactive tabs)',
  );
  assert(
    formDetector.includes('scopeAroundPasswordInput'),
    'Detector must scope around password when pages mix search/newsletter/SMS',
  );
  assert(
    !/captcha.*return true|return true.*captcha/i.test(
      formDetector.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
    ) || formDetector.includes('CAPTCHA widgets do NOT veto'),
    'reCAPTCHA alone must not veto Phase 110 fill',
  );
  assert(
    formDetector.includes('document.body') ||
      formDetector.includes('Document-scoped') ||
      formDetector.includes('formless'),
    'form-detector must support formless SPA standard logins',
  );
  assert(
    formDetector.includes('not_standard_login') ||
      formDetector.includes("'not_standard_login'"),
    'Standard gate must emit not_standard_login reason',
  );
  assert(
    formDetector.includes('aria-hidden') && formDetector.includes('isVisible'),
    'Detector must reject hidden / aria-hidden inputs',
  );

  const fieldMapper = read('extension/generic/field-mapper.js');
  assert(
    fieldMapper.includes('low_confidence') || fieldMapper.includes('MIN_IDENTITY_SCORE'),
    'field-mapper must enforce deterministic confidence floor',
  );
  assert(
    fieldMapper.includes('ambiguous_mapping') || fieldMapper.includes('AMBIGUITY_MARGIN'),
    'field-mapper must reject ambiguous mappings (no probabilistic guess)',
  );
  assert(
    !/shufersal|clalit|htzone|serviceId|service_id/i.test(fieldMapper),
    'field-mapper must have no service-specific branching',
  );

  const fillExecutor = read('extension/generic/fill-executor.js');
  const fillExecutorCode = fillExecutor
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert(
    !fillExecutorCode.includes('form.submit') &&
      !fillExecutorCode.includes('.submit(') &&
      !fillExecutorCode.includes('requestSubmit') &&
      !/click\(\).*submit|submit.*\.click\(/i.test(fillExecutorCode),
    'fill-executor must never auto-submit (AC-110-6 / H1)',
  );
  assert(
    fillExecutor.includes('isSafeFillTarget') || fillExecutor.includes('hidden_or_unsafe'),
    'fill-executor must refuse hidden/unsafe targets (AC-110-7 / H2)',
  );
  assert(
    fillExecutor.includes('NEVER') || fillExecutor.includes('never'),
    'fill-executor must document never-submit contract',
  );

  const genericAutofill = read('extension/generic/generic-autofill.js');
  assert(
    genericAutofill.includes('assessStandardLogin'),
    'generic-autofill must enforce standard-login gate before fill',
  );
  assert(
    !genericAutofill.includes('form.submit') &&
      !genericAutofill.includes('requestSubmit'),
    'generic-autofill must not submit',
  );
  assert(
    !/shufersal|clalit/i.test(genericAutofill),
    'generic-autofill must not special-case Shufersal/Clalit',
  );

  const genericFiles = listFiles(join(root, 'extension/generic'), (name) =>
    name.endsWith('.js'),
  );
  for (const file of genericFiles) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(root, file).replace(/\\/g, '/');
    assert(
      !/\b(openai|tensorflow|brain\.js|ml5|probability|bayes|neural)\b/i.test(text),
      `${rel}: AI / probabilistic APIs forbidden (AC-110-14 / H4)`,
    );
    assert(
      !/shufersal|clalit\.co|leumi|hapoalim/i.test(text),
      `${rel}: no service-host special cases in generic engine (H5)`,
    );
  }

  const overlay = read('src/catalog/builtinCatalogOverlay.ts');
  assert(
    overlay.includes('loginUrl') && overlay.includes('loginFields'),
    'builtinCatalogOverlay must backfill missing loginUrl/loginFields from seed',
  );

  const background = read('extension/background.js');
  assert(
    background.includes('POC_GENERIC_FILL') &&
      background.includes('isAllowedGenericAutofillUrl'),
    'background must keep POC_GENERIC_FILL + URL safety policy',
  );
  assert(
    background.includes("world: 'MAIN'") &&
      background.includes('GENERIC_REAL_SITE_SCRIPT_FILES.fill'),
    'Generic autofill inject must use MAIN world for SPA frameworks',
  );
  assert(
    !background.includes('GENERIC_REAL_SITE_ALLOWED_HOSTS') &&
      !background.includes('isAllowedGenericRealSiteUrl'),
    'background must not restore host allowlist gating for generic fill',
  );
  assert(
    /protocol === ['"]https:['"]/.test(background) ||
      background.includes("url.protocol === 'https:'"),
    'Generic URL policy must allow arbitrary https origins (origin-independent)',
  );
  assert(
    /allFrames:\s*true/.test(background) &&
      /pickBestGenericFrameResult/.test(background),
    'Generic real-site inject must scan all frames and pick best result',
  );

  const migration = read('docs/MIGRATION_PHASE_110.md');
  assert(
    /coverage matrix|Coverage matrix/i.test(migration),
    'MIGRATION_PHASE_110.md must include coverage matrix',
  );
  assert(
    /host permission|host_permissions|extension permission/i.test(migration),
    'MIGRATION_PHASE_110.md must include extension permission notes',
  );
  assert(
    /Shufersal/i.test(migration) && /Clalit/i.test(migration),
    'Migration doc must mention Shufersal + Clalit regression anchors',
  );
  assert(
    /catalog|custom|admin/i.test(migration),
    'Coverage matrix must address catalog / custom / admin origins',
  );
  assert(
    /Phase 108|Phase 109|loginUrl/i.test(migration),
    'Doc must note parallel 108/109 consume-only boundary',
  );
  assert(
    /defer|proposal|D-110-11|metadata proposal/i.test(migration),
    'Doc must state M6 metadata proposal or explicit deferral',
  );

  const catalog = read('src/catalog/builtinCatalog.ts');
  assert(
    /id:\s*'hapoalim'[\s\S]*?loginUrl:\s*'https:\/\/login\.bankhapoalim\.co\.il\/ng-portals\/auth\/he\/'/.test(
      catalog,
    ),
    'hapoalim catalog seed must use /ng-portals/auth/he/ loginUrl',
  );
  assert(
    existsSync(
      join(root, 'supabase/migrations/20260713200000_phase110_hapoalim_login_url.sql'),
    ),
    'Phase 110 hapoalim login_url migration must exist',
  );

  assert(
    existsSync(join(root, 'team-Yuri/dev-phase110.md')) ||
      existsSync(join(root, 'team-Yuri/dev-phase110.MD')),
    'Developer evidence team-Yuri/dev-phase110.md required',
  );

  // Phase 113 / identity must not be touched by Phase 110 generic path
  assert(
    !execution.includes('canonical') && !eligibility.includes('canonical'),
    'Phase 110 must not introduce URL canonicalization (AC-110-12)',
  );

  console.log('verifyPhase110StandardAutofill: PASS');
  console.log(
    'No allowlist; no auto-submit; visible-only; standard gate; no AI; Phase 103 entry preserved',
  );
}

main();
