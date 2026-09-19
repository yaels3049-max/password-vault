/**
 * Phase 119.2 — Visual Mapping MVP verification (AC-119.2-*).
 * Usage: node scripts/verifyPhase119VisualMapping.mjs
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertNoServiceBranch(src, label) {
  assert(
    !/\bhapoalim\b|\bclalit\b|\bbankhapoalim\b/i.test(src),
    `${label}: no service-specific ids`,
  );
  assert(
    !/if\s*\([^)]*serviceId|switch\s*\([^)]*serviceId|serviceId\s*===|serviceId\s*!==/i.test(
      src,
    ),
    `${label}: no serviceId branching`,
  );
}

async function main() {
  const pickSrc = read('extension/generic/visual-target-pick.js');
  const bgSrc = read('extension/background.js');
  const hubSrc = read('src/assistedMapping/visualMapping.ts');
  const editorSrc = read('src/admin/AutofillProfileEditor.tsx');
  const typesSrc = read('src/assistedMapping/types.ts');
  const fixtureSrc = read('scripts/fixtures/phase119-visual-pick-login.html');

  // AC-119.2-1 wiring
  assert(
    bgSrc.includes("message.type === 'ADMIN_VISUAL_MAPPING_START'"),
    'AC-119.2-1 background registers ADMIN_VISUAL_MAPPING_START',
  );
  assert(
    bgSrc.includes('openPageAndVisualMapping'),
    'AC-119.2-1 openPageAndVisualMapping exists',
  );
  assert(
    typesSrc.includes('ADMIN_VISUAL_MAPPING_START'),
    'AC-119.2-1 Hub message constant',
  );
  assert(
    hubSrc.includes('startVisualMappingForField'),
    'AC-119.2-1 Hub startVisualMappingForField',
  );
  assert(
    editorSrc.includes('startVisualMappingForField') &&
      editorSrc.includes('data-action="visual-mapping"'),
    'AC-119.2-1 editor per-field Visual Mapping action',
  );

  // AC-119.2-2 no Login Entry embed in Admin
  assert(
    !/<iframe[\s\S]*login|embed.*loginEntry|src=\{loginEntryUrl\}/i.test(editorSrc),
    'AC-119.2-2 no Login Entry iframe/embed in editor',
  );

  // AC-119.2-3 / AC-119.2-9 synthetic pick → derived #id locator
  assert(fixtureSrc.includes('id="visual-user"'), 'AC-119.2-9 fixture has visual-user');
  const { window, document } = parseHTML(fixtureSrc);
  window.getComputedStyle = () => ({
    display: 'block',
    visibility: 'visible',
    opacity: '1',
  });
  const proto = window.Element.prototype;
  proto.getBoundingClientRect = function () {
    return { width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100 };
  };
  // linkedom may expose disabled as empty-string-ish; normalize for eligibility tests
  const userEl = document.getElementById('visual-user');
  if (userEl) {
    userEl.disabled = false;
    userEl.readOnly = false;
  }
  globalThis.CSS = {
    escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1'),
  };
  // Evaluate pick IIFE against linkedom window
  // eslint-disable-next-line no-new-func
  const runPick = new Function('window', 'globalThis', 'CSS', `${pickSrc}; return window;`);
  const g = runPick(window, globalThis, globalThis.CSS);
  assert(typeof g.armVisualTargetPick === 'function', 'armVisualTargetPick exported');
  assert(g.__visualTargetPickHelpers, 'helpers exported for verify');

  const user = document.getElementById('visual-user');
  assert(user, 'fixture user input');
  const helpers = g.__visualTargetPickHelpers;
  assert(helpers.isEligibleControl(user), 'AC-119.2-9 user input eligible');
  const candidates = helpers.buildCandidates(user);
  assert(
    candidates.some((c) => c.locator === '#visual-user'),
    'AC-119.2-3/#9 candidates include #visual-user',
  );
  const chosen = helpers.preferExactOneLocator(candidates, document);
  assert(chosen && chosen.locator === '#visual-user', 'AC-119.2-9 exact-one → #visual-user');

  const submit = document.getElementById('visual-submit');
  assert(
    submit && !helpers.isEligibleControl(submit),
    'AC-119.2-6 submit button not eligible (no auto-submit target)',
  );

  // AC-119.2-4 never read values
  assert(
    !/\.value\b|document\.cookie|localStorage|sessionStorage/i.test(pickSrc),
    'AC-119.2-4 pick script does not read values/cookies/storage',
  );
  assert(
    !/credentials|password\s*:/i.test(hubSrc),
    'AC-119.2-4 Hub visual mapping does not send credentials',
  );

  // AC-119.2-5 config only until save — Hub does not persist
  assert(
    !/updateGlobalRegistryRow|persist\(|supportState/i.test(hubSrc),
    'AC-119.2-5 Hub visual mapping does not persist',
  );
  assert(
    editorSrc.includes("persist('save')") || editorSrc.includes('requestSaveMapping'),
    'AC-119.2-5 editor still uses explicit Save',
  );

  // AC-119.2-6 no form submit in pick
  assert(
    pickSrc.includes('preventDefault'),
    'AC-119.2-6 click capture preventDefault',
  );
  assert(
    !/\.submit\(|requestSubmit/i.test(pickSrc),
    'AC-119.2-6 no form submit API',
  );

  // AC-119.2-7 origin bind
  assert(
    pickSrc.includes('origin_mismatch') && bgSrc.includes('origin_mismatch'),
    'AC-119.2-7 origin mismatch abort',
  );
  assert(
    bgSrc.includes('frameIds: [0]'),
    'AC-119.2-7 top document only (frameIds [0])',
  );

  // AC-119.2-8 Admin-only surface (editor under AdminGate path)
  assert(
    editorSrc.includes('VISUAL_MAPPING_LABEL_HE'),
    'AC-119.2-8 Visual Mapping only on AutofillProfileEditor',
  );

  // No LLM on visual path (implementation calls, not doc comments)
  assert(
    !/\bproposeFieldMappings\s*\(|new\s+RemoteOpenAi|getMappingLlmProvider\s*\(/i.test(
      hubSrc,
    ),
    'Visual Mapping does not call LLM provider',
  );

  // Genericity
  assertNoServiceBranch(pickSrc, 'pick');
  assertNoServiceBranch(hubSrc, 'hub visualMapping');
  assert(
    !/\bhapoalim\b|\bclalit\b/i.test(editorSrc),
    'editor: no service-specific Visual Mapping',
  );

  // Capability catalog still lists visual_target_selection; LLM support remains single_page_top
  const capsSrc = read('src/assistedMapping/capabilities.ts');
  assert(
    capsSrc.includes('visual_target_selection'),
    'catalog includes visual_target_selection',
  );
  assert(
    capsSrc.includes('SUPPORTED_INSPECTION_CAPABILITIES') &&
      /SUPPORTED_INSPECTION_CAPABILITIES\s*=\s*\[[^\]]*INSPECTION_CAPABILITY_SINGLE_PAGE_TOP/.test(
        capsSrc.replace(/\s+/g, ' '),
      ),
    'LLM inspect support remains single_page_top only',
  );

  // Bundle Hub module (with browser mocks) for type-level smoke
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-119-2b-')), 'vm.mjs');
  await build({
    entryPoints: [join(root, 'src/assistedMapping/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);
  assert(
    typeof mod.startVisualMappingForField === 'function',
    'export startVisualMappingForField',
  );
  assert(
    mod.ADMIN_VISUAL_MAPPING_START_MESSAGE === 'ADMIN_VISUAL_MAPPING_START',
    'export message constant',
  );

  // Missing login entry fails closed without extension
  const closed = await mod.startVisualMappingForField({
    fieldId: 'username',
    loginEntryUrl: 'not-https',
  });
  assert(closed.ok === false, 'invalid login entry fails closed');

  console.log('verifyPhase119VisualMapping: PASS');
}

main().catch((err) => {
  console.error('verifyPhase119VisualMapping: FAIL');
  console.error(err);
  process.exit(1);
});
