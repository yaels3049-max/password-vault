/**
 * Phase 121.1-IF — generic iframe credential surface for SPECIAL authoring.
 * Evidence: AC-121.1-IF-1 … 18 (§IF-8.1) + Architect amendments A1 / A2.
 * Usage: node scripts/verifyPhase121IframeSurface.mjs
 *
 * D-121-29 (§4.10.1): frame correlation = postMessage nonce handshake. The harness
 * runs the real frame-correlation.js inside simulated per-frame windows (real
 * listener, real nonces, postMessage with event.source semantics). It never
 * mocks chrome.runtime.getFrameId and fails if the correlation path references it.
 *
 * Page-side DOM behavior that needs a real multi-frame browser (handshake across
 * real processes, open-shadow composedPath) is printed as LIVE_ONLY — never PASS.
 */
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { revertD12149EligibilityEdits } from './lib/phase121D49EligibilityEdits.mjs';
import { revertD12171EligibilityEdits } from './lib/phase121D71Edits.mjs';
import { withTempDir } from './lib/tempDir.mjs';
import { revertPhase126PartAManifest } from './lib/phase126PartA.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const assertIncludes = (hay, needle, message) => assert(hay.includes(needle), message);
const assertNotIncludes = (hay, needle, message) => assert(!hay.includes(needle), message);
const liveOnly = [];
function LIVE_ONLY(id, what) {
  liveOnly.push(`${id}: ${what}`);
  console.log(`  ○ LIVE_ONLY ${id} — ${what}`);
}

// Inside the repo so externals (Hub modules import npm packages) resolve from node_modules.
const loadModule = (entry, name) => withTempDir(`pv-121if-${name}-`, (outdir) => loadModuleIn(outdir, entry, name));

async function loadModuleIn(outdir, entry, name) {
  const outfile = join(outdir, `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
    packages: 'external',
    define: { 'import.meta.env': '{"DEV":false}' },
    logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}

console.log('Phase 121.1-IF — iframe credential surface verification\n');

const C = await loadModule('src/loginContract/index.ts', 'contract');
const hub = await loadModule('src/assistedMapping/currentTabAuthoring.ts', 'hub');
const routing = await loadModule('src/assistedMapping/specialAnalyzeRouting.ts', 'routing');
const hubTypesSrc = read('src/assistedMapping/types.ts');
const hubSrc = read('src/assistedMapping/currentTabAuthoring.ts');
const uiSrc = read('src/admin/SpecialLoginDraftEditor.tsx');
const bgSrc = read('extension/background.js');
const corrSrc = read('extension/generic/frame-correlation.js');
const inspectSrc = read('extension/generic/page-structure-inspect.js');
const pickSrc = read('extension/generic/visual-target-pick.js');

const ORIGIN = 'https://fixture.example';
const FRAME_ORIGIN = 'https://auth.fixture-idp.example';
const FRAME = { frameLocator: 'iframe#login-frame', frameOrigin: FRAME_ORIGIN };

function opener(overrides = {}) {
  return {
    actionId: 'opener-1',
    kind: 'floating_opener',
    label: 'Open login',
    locatorType: 'css',
    locator: '#open-login',
    approvedForAuthoringContinuation: true,
    approvedForRuntime: true,
    readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#user', timeoutMs: 5000 },
    ...overrides,
  };
}
function draftWith({ action = opener(), mappings } = {}) {
  return {
    planVersion: 1,
    pattern: 'FLOATING_SCREEN',
    preambleActions: [action],
    steps: [
      {
        stepId: 'step-1',
        fieldMappings: mappings ?? [
          { fieldId: 'username', locatorType: 'css', locator: '#user' },
          { fieldId: 'password', locatorType: 'css', locator: '#pass' },
        ],
      },
    ],
  };
}
function framedDraft() {
  return draftWith({
    action: opener({
      readiness: {
        kind: 'exact_one_eligible_css',
        locatorType: 'css',
        locator: '#user',
        timeoutMs: 5000,
        frame: { ...FRAME },
      },
    }),
    mappings: [
      { fieldId: 'username', locatorType: 'css', locator: '#user', frame: { ...FRAME } },
      { fieldId: 'password', locatorType: 'css', locator: '#pass', frame: { ...FRAME } },
    ],
  });
}
const roundTrip = (d) => C.parseLoginFlowPlanDocument(C.serializeLoginFlowPlanDocument(d));

// ─── 1. Types / parse (AC-IF-1, AC-IF-2, AC-IF-3) ───────────────────────────
{
  const d = framedDraft();
  d.preambleActions[0].frame = { frameLocator: 'iframe[name="shell"]', frameOrigin: FRAME_ORIGIN };
  d.preambleActions[0].readiness.frame = { ...FRAME };
  const rt = roundTrip(d);
  assert(rt, 'framed draft parses');
  assert(JSON.stringify(rt.preambleActions[0].frame) === JSON.stringify(d.preambleActions[0].frame), 'action frame round-trips');
  assert(JSON.stringify(rt.preambleActions[0].readiness.frame) === JSON.stringify(FRAME), 'readiness frame round-trips');
  assert(JSON.stringify(rt.steps[0].fieldMappings[0].frame) === JSON.stringify(FRAME), 'field mapping frame round-trips');
  for (const [bad, why] of [
    [{ frameLocator: 'iframe#x', frameOrigin: 'http://auth.fixture-idp.example' }, 'non-HTTPS'],
    [{ frameLocator: 'iframe#x', frameOrigin: 'https://auth.fixture-idp.example/login' }, 'origin with path'],
    [{ frameLocator: '', frameOrigin: FRAME_ORIGIN }, 'empty locator'],
    [{ frameLocator: 'iframe#x' }, 'missing origin'],
    ['iframe#x', 'not an object'],
  ]) {
    const x = framedDraft();
    x.steps[0].fieldMappings[0].frame = bad;
    assert(roundTrip(x) === null, `invalid descriptor (${why}) → corrupt (null), never dropped`);
    const y = draftWith();
    y.preambleActions[0].frame = bad;
    assert(roundTrip(y) === null, `invalid action frame (${why}) → corrupt`);
  }
  const legacy = roundTrip(draftWith());
  assert(legacy && !('frame' in legacy.steps[0].fieldMappings[0]) && !('frame' in legacy.preambleActions[0]), 'pre-slice draft parses as top (no frame)');
  // Snapshot deep-freezes descriptors; ACTIVATE carries them draft→active via 121.0 planner.
  const snap = C.createImmutableDraftSnapshot(framedDraft(), { snapshotId: 's1' });
  assert(snap.ok && snap.snapshot.isComplete, 'framed complete draft snapshots');
  const snapFrame = snap.snapshot.plan.steps[0].fieldMappings[0].frame;
  assert(Object.isFrozen(snapFrame), 'snapshot freezes frame descriptor');
  const plan = C.planLoginContractActivate({
    currentMetadata: { [C.LOGIN_FLOW_PLAN_META_KEY]: C.serializeLoginFlowPlanBag({ draft: framedDraft(), active: null }) },
    intent: { transition: 'STANDARD_TO_SPECIAL' },
  });
  assert(plan.ok, 'ACTIVATE with framed draft ok');
  assert(JSON.stringify(plan.nextPlanBag.active.steps[0].fieldMappings[0].frame) === JSON.stringify(FRAME), 'ACTIVATE carries frame draft→active');
  assert(!Object.prototype.hasOwnProperty.call(plan.metadataPatch, 'autofillProfile'), 'no autofillProfile dual-write');
  // AutofillFieldMapping (STANDARD) unchanged; dual-write guard rejects frame on autofill rows.
  const avp = read('src/autofill/validatedProfile.ts');
  assert(/export interface AutofillFieldMapping \{\s*fieldId: string;\s*locatorType: 'css';\s*locator: string;\s*\}/.test(avp), 'AutofillFieldMapping shape unchanged');
  const dual = C.assertNoFrameInAutofillMappings([{ fieldId: 'username', locatorType: 'css', locator: '#u', frame: { ...FRAME } }]);
  assert(dual.ok === false, 'frame on autofillProfile mapping rejected');
  assertIncludes(read('src/loginContract/types.ts'), 'SpecialFieldMapping extends AutofillFieldMapping', 'frame only on SPECIAL mapping type');
}
console.log('  ✓ 1. types / parse round-trip, invalid → corrupt, legacy = top, snapshot freeze, ACTIVATE carry (AC-IF-1/2/3)');

// ─── 2. Validator matrix (AC-IF-4) ──────────────────────────────────────────
{
  const v = (d) => C.validateSpecialPlanComplete(d);
  assert(v(draftWith()).ok, 'top complete draft valid');
  assert(v(framedDraft()).ok, 'framed complete draft valid');
  const mixed = framedDraft();
  delete mixed.steps[0].fieldMappings[1].frame;
  assert(v(mixed).code === 'mixedFrameInStep', 'mixedFrameInStep');
  const badFrame = framedDraft();
  badFrame.steps[0].fieldMappings[0].frame = { frameLocator: 'iframe#x', frameOrigin: 'http://x.example' };
  badFrame.steps[0].fieldMappings[1].frame = { frameLocator: 'iframe#x', frameOrigin: 'http://x.example' };
  assert(v(badFrame).code === 'invalidFrame', 'invalidFrame');
  const self = draftWith({ action: opener({ readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#open-login', timeoutMs: 5000 } }) });
  assert(v(self).code === 'readinessIsSelf', 'readinessIsSelf');
  const notDeclared = draftWith({ action: opener({ readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#somewhere', timeoutMs: 5000 } }) });
  assert(v(notDeclared).code === 'readinessNotDeclaredField', 'readinessNotDeclaredField');
  const pending = draftWith({ action: opener({ readiness: C.createPendingRevealReadiness() }) });
  assert(v(pending).code === 'readinessNotDeclaredField', 'pending reveal marker is never valid persisted');
  const wrongFrameReadiness = framedDraft();
  delete wrongFrameReadiness.preambleActions[0].readiness.frame;
  assert(v(wrongFrameReadiness).code === 'readinessNotDeclaredField', 'readiness frame must match declared field frame');
  const reserved = draftWith({ action: opener({ kind: 'final_submit' }) });
  assert(v(reserved).code === 'reservedActionKind', 'reservedActionKind');
  // Existing codes unchanged
  assert(v({ ...draftWith(), steps: [] }).code === 'emptySteps', 'emptySteps unchanged');
  assert(v({ ...draftWith(), preambleActions: [] }).code === 'floatingNeedsOpener', 'floatingNeedsOpener unchanged');
  assert(v(draftWith({ action: opener({ approvedForRuntime: false }) })).code === 'actionNotApprovedForRuntime', 'actionNotApprovedForRuntime unchanged');
  // Exit transition validates against the NEXT step
  const ms = {
    planVersion: 1,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: [
      {
        stepId: 's1',
        fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }],
        exitTransition: opener({ actionId: 't1', kind: 'intermediate_transition', locator: '#next', readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#pass', timeoutMs: 5000 } }),
      },
      { stepId: 's2', fieldMappings: [{ fieldId: 'password', locatorType: 'css', locator: '#pass' }] },
    ],
  };
  assert(v(ms).ok, 'exit transition readiness = next step field');
  ms.steps[0].exitTransition.readiness.locator = '#user';
  assert(v(ms).code === 'readinessNotDeclaredField', 'exit transition readiness on current step rejected');
}
console.log('  ✓ 2. validator matrix: invalidFrame / mixedFrameInStep / readinessIsSelf / readinessNotDeclaredField / reservedActionKind + existing codes (AC-IF-4)');

// ─── 3. final_submit reserved everywhere (AC-IF-5) ──────────────────────────
{
  assert(roundTrip(draftWith({ action: opener({ kind: 'final_submit' }) })) === null, 'parse rejects final_submit');
  assert(C.RESERVED_FLOW_ACTION_KINDS.includes('final_submit') && C.isReservedActionKind('final_submit'), 'reserved list');
  const proposals = routing.proposeSpecialActionCandidates({
    pattern: 'MULTI_STEP',
    actionCandidates: [
      { actionCandidateId: 'a', tagName: 'button', label: 'Submit', locator: '#submit', locatorType: 'css', matchCount: 1 },
      { actionCandidateId: 'b', tagName: 'button', label: 'Log in', locator: '#login', locatorType: 'css', matchCount: 1 },
    ],
  });
  assert(proposals.length === 2 && proposals.every((p) => p.action.kind !== 'final_submit'), 'proposer never produces final_submit');
  assert(!C.canPerformAuthoringClick(opener({ kind: 'final_submit' })), 'Hub click gate rejects final_submit');
  const clickFn = bgSrc.slice(bgSrc.indexOf('function authoringClickApprovedAction'), bgSrc.indexOf('function openPageAndManagedAutofill'));
  assertIncludes(bgSrc, "var SPECIAL_RESERVED_ACTION_KINDS = ['final_submit'];", 'Ext reserved list');
  assertIncludes(clickFn, "reason: 'reserved_action_kind'", 'Ext click rejects reserved kind');
}
console.log('  ✓ 3. final_submit rejected by parse / validator / proposer / Hub gate / Ext click (AC-IF-5)');

// ─── 4. Click gate + A2 (AC-IF-8, AC-IF-10) ─────────────────────────────────
{
  const framed = opener({ frame: { ...FRAME } });
  assert(C.canPerformAuthoringClick(opener()), 'top approved action clickable');
  assert(!C.canPerformAuthoringClick(framed), 'framed action needs approved origin');
  assert(!C.canPerformAuthoringClick(framed, new Set(), ORIGIN), 'different origin is not auto-approved (A2)');
  assert(C.canPerformAuthoringClick(framed, new Set([FRAME_ORIGIN]), ORIGIN), 'approved origin → clickable');
  assert(!C.canPerformAuthoringClick({ ...framed, approvedForAuthoringContinuation: false }, new Set([FRAME_ORIGIN])), 'still needs continuation approval');
  // A2: identical origin counts as approved; similarity is NOT approval.
  const same = opener({ frame: { frameLocator: 'iframe#same', frameOrigin: ORIGIN } });
  assert(C.canPerformAuthoringClick(same, new Set(), ORIGIN), 'A2 identical origin → no prompt needed');
  assert(C.isFrameOriginApproved(ORIGIN, new Set(), ORIGIN), 'A2 identical origin approved');
  assert(!C.isFrameOriginApproved('https://login.fixture.example', new Set(), ORIGIN), 'A2 subdomain is not approval');
  assert(!C.isFrameOriginApproved('https://fixture.example:8443', new Set(), ORIGIN), 'A2 port differs → not approval');
  assert(!C.isFrameOriginApproved('http://fixture.example', new Set(), ORIGIN), 'A2 non-HTTPS never approved');
  assert([...C.listApprovedFrameOrigins(framedDraft())].join() === FRAME_ORIGIN, 'draft descriptors = approval record');
  assert(C.listApprovedFrameOrigins(draftWith()).size === 0, 'top draft has no frame origins');
}
console.log('  ✓ 4. canPerformAuthoringClick requires approved frame origin; A2 identical-origin auto-approval, no similarity trust (AC-IF-8/10, A2)');

// ─── 5. R3 derive / self / A1 (AC-IF-11) ────────────────────────────────────
{
  const cand = C.createActionCandidate({ actionId: 'x', kind: 'floating_opener', label: 'L', locator: '#open' });
  assert(!C.isSelfReadiness(cand), 'new candidate readiness is not opener-self');
  assert(C.isPendingRevealReadiness(cand.readiness) && C.readinessModeFor(cand) === 'reveal', 'new candidate → reveal mode');
  const d0 = draftWith({ action: { ...cand, approvedForRuntime: true }, mappings: [] });
  assert(C.deriveRevealReadiness(d0, d0.preambleActions[0]) === d0.preambleActions[0], 'no mapping yet → unchanged');
  const d1 = framedDraft();
  d1.preambleActions[0] = { ...cand, approvedForRuntime: true };
  const derived = C.deriveRevealReadiness(d1, d1.preambleActions[0]);
  assert(derived.readiness.locator === '#user' && JSON.stringify(derived.readiness.frame) === JSON.stringify(FRAME), 'derive = first mapped field (locator + frame)');
  assert(C.readinessModeFor(derived) === 'declared', 'derived → declared mode');
  const re = C.rederiveRevealReadiness(d1);
  assert(C.validateSpecialPlanComplete(re).ok, 'rederived draft ACTIVATE-valid');
  // A1 legacy normalization — self / pending + mapped step → derived; otherwise unchanged.
  const legacySelf = draftWith({ action: opener({ readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#open-login', timeoutMs: 4000 } }) });
  const n1 = C.normalizeLegacyDraftReadiness(legacySelf);
  assert(n1.preambleActions[0].readiness.locator === '#user' && n1.preambleActions[0].readiness.timeoutMs === 4000, 'A1 self readiness → first mapped field (timeout kept)');
  assert(C.validateSpecialPlanComplete(n1).ok, 'A1 normalized draft valid');
  const legacyPending = draftWith({ action: opener({ readiness: C.createPendingRevealReadiness() }) });
  assert(C.normalizeLegacyDraftReadiness(legacyPending).preambleActions[0].readiness.locator === '#user', 'A1 pending marker → derived');
  const selfNoMap = draftWith({ action: opener({ readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#open-login', timeoutMs: 4000 } }), mappings: [] });
  const n3 = C.normalizeLegacyDraftReadiness(selfNoMap);
  assert(n3.preambleActions[0].readiness.locator === '#open-login', 'A1 no mapping → left as-is');
  assert(C.validateSpecialPlanComplete({ ...n3, steps: [{ stepId: 's', fieldMappings: [{ fieldId: 'u', locatorType: 'css', locator: '#u' }] }] }).ok === false, 'A1 leftover self still reported by validator');
  const other = draftWith({ action: opener({ readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#other', timeoutMs: 4000 } }) });
  const n4 = C.normalizeLegacyDraftReadiness(other);
  assert(n4.preambleActions[0].readiness.locator === '#other', 'A1 non-self/non-pending readiness untouched');
  assert(C.validateSpecialPlanComplete(n4).code === 'readinessNotDeclaredField', 'A1 leaves readinessNotDeclaredField to validator');
  assert(C.normalizeLegacyDraftReadiness(legacySelf) !== legacySelf && legacySelf.preambleActions[0].readiness.locator === '#open-login', 'A1 is pure (input unchanged)');
  // A1 is authoring-side only: validator / resolve / planActivate never normalize.
  for (const f of ['validateSpecialPlan.ts', 'resolve.ts', 'planActivate.ts', 'merge.ts']) {
    assertNotIncludes(read(`src/loginContract/${f}`), 'normalizeLegacyDraftReadiness', `A1 not applied in ${f} (never ACTIVE)`);
  }
  // Editor applies A1 on load and before snapshot / ACTIVATE.
  assertIncludes(uiSrc, 'return normalizeLegacyDraftReadiness(ensureSpecialDraft(initial', 'A1 on editor load');
  // D-121-30 / D-121-43: the automatic completeness line runs through checkSpecialDraft (src/admin/specialActionBar.ts).
  assertIncludes(uiSrc, 'const draftCheck = useMemo(() => checkSpecialDraft(draft), [draft]);', 'completeness preview uses checkSpecialDraft');
  const barSrc = read('src/admin/specialActionBar.ts');
  const checkFn = barSrc.slice(barSrc.indexOf('export function checkSpecialDraft'));
  assert(checkFn.indexOf('normalizeLegacyDraftReadiness(draft)') >= 0 && checkFn.indexOf('normalizeLegacyDraftReadiness(draft)') < checkFn.indexOf('createImmutableDraftSnapshot('), 'A1 before snapshot validation');
  const actFn = uiSrc.slice(uiSrc.indexOf('async function activateSpecial'), uiSrc.indexOf('async function runSpecialAnalyze'));
  assert(actFn.indexOf('normalizeLegacyDraftReadiness(saved)') >= 0 && actFn.indexOf('normalizeLegacyDraftReadiness(saved)') < actFn.indexOf('updateGlobalRegistryRow('), 'A1 before ACTIVATE (on the saved draft, D-121-43 C1)');
  assertIncludes(actFn, 'draft: normalized', 'ACTIVATE sends normalized draft');
}
console.log('  ✓ 5. R3 derive / self / reveal vs declared; A1 legacy normalization (draft-only, on load + before snapshot/ACTIVATE) (AC-IF-11, A1)');

// ─── 6. Cross-frame merge + A2 (AC-IF-7, AC-IF-8, AC-IF-14) ─────────────────
{
  const page = { schemaVersion: 1, capturedAt: '', finalUrl: '', origin: ORIGIN, inputs: [], limits: { truncated: false, maxInputsApplied: 40 } };
  const top = { frameKey: 'top', frame: null, status: 'top', page, actionCandidates: [] };
  const fr = { frameKey: C.frameKey(FRAME), frame: { ...FRAME }, status: 'depth1_https', page, actionCandidates: [] };
  const sameOrigin = { frameKey: 'iframe#same|' + ORIGIN, frame: { frameLocator: 'iframe#same', frameOrigin: ORIGIN }, status: 'depth1_https', page, actionCandidates: [] };
  const noaddr = { frameKey: 'unaddressable|' + FRAME_ORIGIN, frame: null, status: 'not_addressable', page, actionCandidates: [], unaddressableOrigin: FRAME_ORIGIN };
  const row = (fieldId, locator, confidence = 'high') => ({ fieldId, locatorType: 'css', locator, observedInputId: locator, confidence, evidence: [], locatorDeterministic: true });
  const prop = (rows) => ({ schemaVersion: 1, requestId: 'r', serviceId: 's', status: rows.length ? 'ok' : 'no_confident_mapping', proposals: rows, unmappedFieldIds: [] });
  const merge = (surfaces, proposals, approved = new Set(), current = {}) =>
    hub.mergeSurfaceFieldProposals({ surfaces, proposals, currentLocators: current, approvedFrameOrigins: approved, entryAllowedOrigin: ORIGIN });

  let m = merge([top, fr], [prop([row('username', '#u')]), prop([row('username', '#u2')])]);
  assert(m.framed.length === 0 && !m.prefill.next.username, 'same field confident in two surfaces → not confidently mapped');
  assert(m.merged.unmappedFieldIds.includes('username'), 'ambiguous field reported unmapped');

  m = merge([top, fr], [prop([]), prop([row('username', '#u'), row('password', '#p')])]);
  assert(m.framed.every((f) => f.state === 'needs_frame_approval' && f.frame.frameOrigin === FRAME_ORIGIN), 'unapproved origin → needs_frame_approval (frame carried)');
  assert(m.prefill.appliedFieldIds.length === 0 && !m.prefill.next.username, 'no prefill before approval');

  m = merge([top, fr], [prop([]), prop([row('username', '#u')])], new Set([FRAME_ORIGIN]));
  assert(m.framed[0].state === 'ready' && m.prefill.next.username === '#u', 'approved origin → ready + prefill');

  m = merge([top, sameOrigin], [prop([]), prop([row('username', '#u')])]);
  assert(m.framed[0].state === 'ready', 'A2 identical-origin frame → ready without prompt (descriptor still carried)');
  assert(m.framed[0].frame && m.framed[0].frame.frameLocator === 'iframe#same', 'A2 descriptor still written');

  m = merge([top, noaddr], [prop([]), prop([row('username', '#u')])]);
  assert(m.framed[0].state === 'frame_not_addressable' && !m.prefill.next.username, 'unaddressable frame → frame_not_addressable, no prefill');

  m = merge([top], [prop([row('username', '#u'), row('password', '#p', 'medium')])]);
  assert(m.framed.every((f) => f.state === 'ready' && f.frame === null), 'F-IF-TOP: top proposals carry no frame (no location assumption)');

  m = merge([top, fr], [prop([row('username', '#u')]), prop([])], new Set(), { username: '#kept' });
  assert(m.framed.length === 0 && m.prefill.next.username === '#kept', 'already-mapped field not re-proposed');

  // Action candidates: union of surfaces, identity = locator + frameKey, unaddressable flagged.
  const acts = routing.proposeSpecialActionCandidates({
    pattern: 'FLOATING_SCREEN',
    actionCandidates: [
      { actionCandidateId: 'a', tagName: 'button', label: 'Login', locator: '#go', locatorType: 'css', matchCount: 1, frame: null },
      { actionCandidateId: 'f1-a', tagName: 'button', label: 'Login', locator: '#go', locatorType: 'css', matchCount: 1, frame: { ...FRAME } },
      { actionCandidateId: 'f2-a', tagName: 'button', label: 'Login', locator: '#go', locatorType: 'css', matchCount: 1, frame: null, frameNotAddressable: true },
    ],
  });
  assert(acts.length === 3, 'same locator in different frames = distinct candidates');
  assert(acts.filter((a) => a.action.frame).length === 1, 'framed candidate carries descriptor');
  assert(acts.filter((a) => a.frameNotAddressable).length === 1, 'unaddressable candidate flagged');
  assert(C.actionIdentity(acts[0].action) !== C.actionIdentity(acts[1].action) || acts[0].action.frame !== acts[1].action.frame, 'identity includes frameKey');
}
console.log('  ✓ 6. per-surface merge: cross-frame ambiguity, needs_frame_approval (no prefill), A2 same-origin ready, not_addressable (AC-IF-7/8/14)');

// ─── 6b. Hub messages (AC-IF-11, AC-IF-12) ──────────────────────────────────
{
  const exact = {
    FRAME_APPROVE_LABEL_HE: 'אשר מסגרת',
    FRAME_REJECT_LABEL_HE: 'דחה',
    SURFACE_NOT_OPENED_HE: 'המסך לא נפתח',
    UNSUPPORTED_NESTED_FRAME_HE: 'השדה נמצא במסגרת בתוך מסגרת. מצב זה אינו נתמך כרגע.',
    UNSUPPORTED_SHADOW_DOM_HE: 'השדה נמצא ברכיב מוסתר מסוג Shadow DOM. מצב זה אינו נתמך כרגע.',
    UNSUPPORTED_NON_HTTPS_FRAME_HE: 'חלק מהדף נמצא במסגרת שאינה מאובטחת (HTTPS) ולא ניתן לבדוק אותה. מצב זה אינו נתמך.',
    FRAME_NOT_ADDRESSABLE_HE: 'לא ניתן לזהות את המסגרת באופן חד-משמעי. מצב זה אינו נתמך כרגע.',
    FRAME_CORRELATION_UNAVAILABLE_HE: 'לא ניתן לזהות את המסגרת בדף. נסו לרענן את הדף ולנתח שוב.',
    VISUAL_TIMEOUT_MAYBE_UNSUPPORTED_FRAME_HE: 'ייתכן שהשדה נמצא במסגרת שאינה נתמכת.',
  };
  for (const [k, text] of Object.entries(exact)) {
    assertIncludes(hubTypesSrc, `export const ${k} =`, `${k} defined`);
    assert(hubTypesSrc.includes(`'${text}'`), `${k} exact DD text`);
  }
  assertIncludes(hubTypesSrc, 'שדות הכניסה או הכפתור נמצאים בתוך מסגרת של האתר ${LTR_MARK}${origin}${LTR_MARK}. לאשר שימוש במסגרת זו בתהליך הכניסה?', 'FRAME_APPROVAL_PROMPT_HE exact DD text');
  assertIncludes(hubTypesSrc, 'המסגרת שייכת כעת לאתר אחר (${LTR_MARK}${origin}${LTR_MARK}) — הפעולה נחסמה.', 'FRAME_ORIGIN_CHANGED_HE exact DD text');
  // D-121-59 A1: readiness_timeout / surface_not_login have their own copy (verifyPhase121PasswordlessSurface).
  assert(hub.authoringClickFailureMessageHe('readiness_timeout') !== exact.SURFACE_NOT_OPENED_HE, 'readiness_timeout has its own message (D-121-59 A1)');
  assert(hub.authoringClickFailureMessageHe('surface_not_revealed') === exact.SURFACE_NOT_OPENED_HE, 'surface_not_revealed → «המסך לא נפתח»');
  assertIncludes(hub.authoringClickFailureMessageHe('frame_origin_mismatch', 'https://evil.example'), 'https://evil.example', 'frame_origin_mismatch → FRAME_ORIGIN_CHANGED_HE(origin)');
  assert(hub.authoringClickFailureMessageHe('frame_correlation_unavailable') === exact.FRAME_CORRELATION_UNAVAILABLE_HE, 'correlation unavailable message');
  assertNotIncludes(hubTypesSrc, 'הדפדפן אינו תומך', 'D-121-29: correlation copy no longer blames the browser');
  const u = (o) => hub.unsupportedMessagesHe({ nested: 0, nonHttps: 0, notInjectable: 0, shadowCredential: 0, notAddressable: 0, correlationUnavailable: 0, ...o });
  assert(u({ nested: 1 }).includes(exact.UNSUPPORTED_NESTED_FRAME_HE), 'nested → message');
  assert(u({ shadowCredential: 2 }).includes(exact.UNSUPPORTED_SHADOW_DOM_HE), 'shadow → message');
  assert(u({ nonHttps: 1 }).includes(exact.UNSUPPORTED_NON_HTTPS_FRAME_HE), 'non-HTTPS → message');
  assert(u({ notInjectable: 1 }).includes(exact.UNSUPPORTED_NON_HTTPS_FRAME_HE), 'non-injectable → message');
  assert(u({ notAddressable: 1 }).includes(exact.FRAME_NOT_ADDRESSABLE_HE), 'not addressable → message');
  assert(u({ correlationUnavailable: 1 }).includes(exact.FRAME_CORRELATION_UNAVAILABLE_HE), 'correlation → message');
  assert(u({}).length === 0, 'no counts → no message');
  const vis = (r) => hub.interpretCurrentTabVisualResponse(r, 'username');
  assert(vis({ ok: false, reason: 'nested_frame_unsupported' }).message === exact.UNSUPPORTED_NESTED_FRAME_HE, 'Visual nested → message');
  assert(vis({ ok: false, reason: 'shadow_dom_unsupported' }).message === exact.UNSUPPORTED_SHADOW_DOM_HE, 'Visual shadow → message');
  assert(vis({ ok: false, reason: 'frame_not_addressable' }).message === exact.FRAME_NOT_ADDRESSABLE_HE, 'Visual not addressable → message');
  assert(vis({ ok: false, reason: 'visual_pick_timeout', unsupported: { notInjectable: 1 } }).maybeUnsupportedFrame === true, 'timeout hint flag when notInjectable > 0');
  assert(vis({ ok: false, reason: 'visual_pick_timeout', unsupported: { notInjectable: 0 } }).maybeUnsupportedFrame === false, 'no hint otherwise');
  const okFramed = vis({ ok: true, locator: '#u', frame: { ...FRAME } });
  assert(okFramed.ok && JSON.stringify(okFramed.frame) === JSON.stringify(FRAME), 'Visual result carries frame');
  assert(vis({ ok: true, locator: '#u' }).frame === null, 'Visual top result frame null');
  assert(vis({ ok: true, locator: '#u', frame: { frameLocator: null, frameOrigin: FRAME_ORIGIN } }).reason === 'frame_not_addressable', 'Visual frame without locator → not addressable');
  // Click payload
  const clickHub = hubSrc.slice(hubSrc.indexOf('export async function performApprovedAuthoringClick'));
  for (const k of ['kind: input.action.kind', "frame: input.action.frame", 'readinessMode,', 'readiness: input.action.readiness']) {
    assertIncludes(clickHub, k, `click payload has ${k}`);
  }
  assertIncludes(clickHub, 'canPerformAuthoringClick(input.action, input.approvedFrameOrigins ?? new Set(), allowedOrigin)', 'Hub click gate passes approved origins + entry origin (A2)');
}
console.log('  ✓ 6b. exact DD Hebrew texts; click / Visual / UNSUPPORTED message mapping; click payload (AC-IF-11/12)');

// ─── 6c. Editor wiring (AC-IF-8, AC-IF-11, AC-IF-12, D-121-23) ──────────────
{
  assertIncludes(uiSrc, 'data-panel="frame-approval"', 'frame-approval prompt rendered');
  assertIncludes(uiSrc, '{FRAME_APPROVAL_PROMPT_HE(origin)}', 'prompt shows the origin');
  assertIncludes(uiSrc, '{FRAME_APPROVE_LABEL_HE}', '«אשר מסגרת» button');
  assertIncludes(uiSrc, '{FRAME_REJECT_LABEL_HE}', '«דחה» button on prompt');
  const approveFrameFn = uiSrc.slice(uiSrc.indexOf('function approveFrameOrigin'), uiSrc.indexOf('function rejectFrameOrigin'));
  assertIncludes(approveFrameFn, 'setSessionFrameOrigins', '«אשר מסגרת» adds origin to session only');
  for (const w of ['setDraft', 'commitDraft', 'upsert', 'updateGlobalRegistryRow']) {
    assertNotIncludes(approveFrameFn, w, `«אשר מסגרת» writes nothing to draft (${w})`);
  }
  const rejectFrameFn = uiSrc.slice(uiSrc.indexOf('function rejectFrameOrigin'), uiSrc.indexOf('function acceptHeldField'));
  assertIncludes(rejectFrameFn, 'setHeldFields((prev) => prev.filter((h) => h.frame.frameOrigin !== origin))', '«דחה» discards proposals with that origin');
  assertNotIncludes(rejectFrameFn, 'setDraft', '«דחה» on prompt writes nothing');
  // D-121-34: no approve button; the test press is the consent and still needs the frame origin (R2).
  assertIncludes(uiSrc, '!canPerformAuthoringClick(actionForTestPress(action), approvedFrameOrigins, allowedOrigin)', '«בדוק את הכפתור וזהה את השדות» disabled while origin unapproved');
  assertIncludes(uiSrc, 'disabled={busy || !frameApproved(held.frame)}', 'field accept disabled while origin unapproved');
  assertIncludes(uiSrc, 'frameLocationLabelHe(action.frame)', 'action location label');
  assertIncludes(uiSrc, 'frameLocationLabelHe(mapping.frame)', 'field location label');
  assert(C.frameLocationLabelHe(null) === 'בדף הראשי', 'label «בדף הראשי»');
  assert(C.frameLocationLabelHe(FRAME).startsWith('בתוך מסגרת: ') && C.frameLocationLabelHe(FRAME).includes(FRAME_ORIGIN), 'label «בתוך מסגרת: <origin>»');
  const analyzeFn = uiSrc.slice(uiSrc.indexOf('async function runSpecialAnalyze'), uiSrc.indexOf('async function analyzeCurrentSurface'));
  assertIncludes(analyzeFn, "p.state === 'ready'", 'only ready proposals written');
  assertIncludes(analyzeFn, "p.state === 'needs_frame_approval'", 'unapproved proposals held, not written');
  assertIncludes(analyzeFn, 'rederiveRevealReadiness(', 'R3 readiness re-derived after mapping write');
  assertIncludes(analyzeFn, 'unsupportedMessage', 'UNSUPPORTED shown in status line');
  assertIncludes(analyzeFn, '!p.frameNotAddressable', 'unaddressable action never selectable');
  const continueFn = uiSrc.slice(uiSrc.indexOf('async function testAndChooseAction'), uiSrc.indexOf('function renderActionPanel'));
  const failAt = continueFn.indexOf('if (!result.ok)');
  assert(failAt > 0 && continueFn.indexOf("runSpecialAnalyze('after_continue'") > continueFn.indexOf('return;', failAt), 'auto-Analyze only after R3 success');
  const visualFieldFn = uiSrc.slice(uiSrc.indexOf('async function visualPickField'), uiSrc.indexOf('function panelAction'));
  assert(visualFieldFn.indexOf('!frameApproved(frame)') < visualFieldFn.indexOf('setDraft('), 'Visual framed field held until origin approved');
  assertIncludes(uiSrc, 'VISUAL_TIMEOUT_MAYBE_UNSUPPORTED_FRAME_HE', 'timeout hint wired');
  // D-121-23 exact-label rule for new copy
  const copy = uiSrc.slice(uiSrc.indexOf('export const SPECIAL_EDITOR_COPY_HE'), uiSrc.indexOf('export const SPECIAL_VISUAL_BUTTON_HE'));
  for (const q of ['«אשר מסגרת»', '«קבל מיפוי»']) assertIncludes(copy.slice(copy.indexOf('frameFieldsHeld')), q, `copy quotes ${q}`);
  assertIncludes(uiSrc, "acceptField: 'קבל מיפוי'", '«קבל מיפוי» button label literal');
}
console.log('  ✓ 6c. editor: approval prompt (session-only), «דחה» discards, gating, location labels, R3 flow, UNSUPPORTED status (AC-IF-8/11/12)');

// ─── 7. Ext static (AC-IF-6, AC-IF-9, AC-IF-10, AC-IF-13) ───────────────────
const fnSlice = (start, end) => bgSrc.slice(bgSrc.indexOf(start), bgSrc.indexOf(end));
const gateFn = fnSlice('function specialAuthoringTabGate', 'function collectSpecialRevealSnapshot');
const inspectFn = fnSlice('function inspectCurrentAuthoringTab', 'function visualMappingCurrentAuthoringTab');
const visualFn = fnSlice('function visualMappingCurrentAuthoringTab', 'function cancelVisualMappingCurrentAuthoringTab');
const cancelFn = fnSlice('function cancelVisualMappingCurrentAuthoringTab', 'function authoringClickApprovedAction');
const clickFn = fnSlice('function authoringClickApprovedAction', 'function openPageAndManagedAutofill');
const enumFn = fnSlice('function enumerateSpecialAuthoringFrames', 'function resolveDeclaredFrame');
const resolveFn = fnSlice('function resolveDeclaredFrame', 'function specialInjectThenRun');
const matchFn = fnSlice('function specialMatchFrameNonces', 'function specialFrameNonceHandshake');
const handshakeFn = fnSlice('function specialFrameNonceHandshake', 'function enumerateSpecialAuthoringFrames');
{
  // D-121-29: getFrameId is not implemented in Chrome — forbidden anywhere in the correlation path
  // (comments included, so a stale reference cannot hide).
  const specialBlock = bgSrc.slice(bgSrc.indexOf('/**\n * 121.1-IF — SPECIAL authoring frame surface'), bgSrc.indexOf('function openPageAndManagedAutofill'));
  for (const [src, name] of [[corrSrc, 'frame-correlation.js'], [specialBlock, 'background.js SPECIAL block'], [bgSrc, 'background.js']]) {
    assertNotIncludes(src, 'getFrameId', `D-121-29: no getFrameId in ${name}`);
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assertNotIncludes(code, 'webNavigation', `D-121-29: no webNavigation in ${name}`);
    assertNotIncludes(code, 'chrome.debugger', `D-121-29: no debugger in ${name}`);
  }
  assertIncludes(corrSrc, "reason: 'frame_correlation_unavailable'", 'correlation unavailable → fail-closed reason');
  // Handshake — listener (depth-1, source === parent), fresh 128-bit nonce, postMessage '*'.
  assertIncludes(corrSrc, 'event.source !== global.parent || !isDepth1Window()', 'listener accepts only source === window.parent at depth 1');
  assertIncludes(corrSrc, 'global !== global.top && global.parent === global.top', 'depth-1 = parent is top');
  assertIncludes(corrSrc, 'if (!global.__pvFrameCorrelationListener', 'listener install idempotent');
  assertIncludes(corrSrc, 'new Uint8Array(16)', 'nonce ≥ 128 bit');
  assertIncludes(corrSrc, 'c.getRandomValues(bytes)', 'nonce via crypto.getRandomValues');
  assertIncludes(corrSrc, "win.postMessage({ type: NONCE_MESSAGE_TYPE, nonce: nonce }, '*')", 'nonce posted into iframe.contentWindow');
  assertNotIncludes(corrSrc.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), 'Math.random', 'no weak randomness');
  // Handshake orchestration: listener all frames → send in frame 0 → bounded wait → read back all frames.
  const iInstall = handshakeFn.indexOf("target: { tabId: tabId, allFrames: true }, world: 'ISOLATED', files: SPECIAL_CORRELATION_FILES");
  const iSend = handshakeFn.indexOf('target: { tabId: tabId, frameIds: [0] }');
  const iWait = handshakeFn.indexOf('SPECIAL_FRAME_HANDSHAKE_WAIT_MS');
  const iRead = handshakeFn.indexOf('__readFrameCorrelationNonces(expected)');
  assert(iInstall > 0 && iSend > iInstall && iWait > iSend && iRead > iSend, 'handshake order: install (allFrames) → send (frame 0) → wait → read back (allFrames)');
  assert((handshakeFn.match(/allFrames: true/g) || []).length === 2, 'install + read back use allFrames');
  assertIncludes(handshakeFn, "world: 'ISOLATED'", 'handshake runs ISOLATED');
  assertIncludes(enumFn, 'specialFrameNonceHandshake(', 'enumerate correlates via handshake');
  assertIncludes(resolveFn, 'specialFrameNonceHandshake(', 'resolve correlates via handshake');
  // Exact-one rule; no URL / size / order matching in the matcher.
  assertIncludes(matchFn, 'receivers.length !== 1 || countByFrame[receivers[0]] !== 1', 'exact-one: one receiver AND receiver got one nonce');
  assertIncludes(matchFn, 'sent.indexOf(n) < 0', 'nonces of other attempts ignored');
  for (const bad of ['rectArea', 'visible', 'width', 'height', '.src', 'url', 'origin', 'frameLocator']) {
    assertNotIncludes(matchFn.replace(/\/\*[\s\S]*?\*\//g, ''), bad, `matcher never uses ${bad}`);
  }
  assertNotIncludes(corrSrc.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), 'nth-', 'no positional frame locator');
  for (const [src, name] of [[bgSrc, 'background.js'], [corrSrc, 'frame-correlation.js'], [read('extension/manifest.json'), 'manifest.json']]) {
    assertNotIncludes(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), 'webNavigation', `no webNavigation in ${name}`);
  }
  assertIncludes(enumFn, 'allFrames: true', 'probe covers all frames');
  // R1: gate (open/reuse + live top-origin check) precedes every frame operation.
  assertIncludes(gateFn, 'ensureSpecialAuthoringTab(message', 'gate opens/reuses authoring tab');
  assertIncludes(gateFn, "new URL(tab.url).origin !== allowedOrigin", 'gate checks live top origin (R1)');
  assert(gateFn.indexOf('onReady(') > gateFn.indexOf("reason: 'origin_mismatch'"), 'frame logic only after R1 passes');
  for (const [fn, name] of [[inspectFn, 'inspect'], [visualFn, 'visual'], [clickFn, 'click']]) {
    assertIncludes(fn, 'specialAuthoringTabGate(message, sendResponse', `${name} runs R1 gate`);
    const g = fn.indexOf('specialAuthoringTabGate(');
    for (const op of ['enumerateSpecialAuthoringFrames(', 'resolveDeclaredFrame(', 'collectSpecialRevealSnapshot(', 'executeScript(']) {
      const at = fn.indexOf(op);
      assert(at < 0 || at > g, `${name}: ${op} after R1`);
    }
  }
  assert(cancelFn.indexOf("reason: 'origin_mismatch'") < cancelFn.indexOf('executeScript('), 'cancel: R1 before disarm');
  assertIncludes(enumFn, "cb({ ok: false, reason: 'origin_mismatch' })", 'enumerate re-checks probed top origin');
  // Visual: per-frame executeScript, first click wins, disarm others, nested report_only.
  assertNotIncludes(visualFn, 'allFrames', 'Visual arms per frameId (not allFrames)');
  assertIncludes(visualFn, "__disarmVisualTargetPick('visual_pick_superseded_other_frame')", 'disarm other frames');
  assertIncludes(visualFn, "record.status === 'nested' ? 'report_only' : 'pick'", 'nested frames report_only');
  assertIncludes(visualFn, 'specialVisualPickArmed = { tabId: tabId, frameIds: armedFrameIds }', 'armed set tracked');
  assertIncludes(visualFn, "reason: result && result.ok === true ? 'frame_not_addressable'", 'unaddressable winner → frame_not_addressable');
  assertNotIncludes(bgSrc, 'specialVisualPickTabId', 'single armed tab id replaced');
  assertIncludes(cancelFn, 'allFrames: true', 'cancel disarms all frames');
  // Click: resolve declared frame BEFORE click; reserved kind; readiness modes.
  const resolveAt = clickFn.indexOf('resolveDeclaredFrame(tabId, allowedOrigin, clickFrame');
  const clickAt = clickFn.indexOf('targets[0].click()');
  assert(resolveAt > 0 && clickAt > 0, 'click resolves declared frame + clicks');
  assert(clickFn.indexOf('resolveClickFrame(function (frameId)') > clickAt, 'click execution chained after frame resolution');
  assertIncludes(clickFn, "reason: 'readiness_is_self'", 'readiness_is_self');
  assertIncludes(clickFn, "reason: 'readiness_timeout'", 'declared timeout');
  assertIncludes(clickFn, "reason: 'surface_not_revealed'", 'reveal failure');
  for (const r of ['frame_missing', 'frame_ambiguous', 'frame_origin_mismatch', 'frame_not_depth1']) {
    assertIncludes(resolveFn + corrSrc, r, `resolveDeclaredFrame reason ${r}`);
  }
  assertIncludes(resolveFn, 'if (!p.isDepth1)', 'resolve checks depth 1');
  assertIncludes(resolveFn, 'p.origin !== descriptor.frameOrigin', 'resolve checks live frame origin (R2)');
  // Page scripts: shadow + nested + frame context (additive; STANDARD path unchanged).
  assertIncludes(inspectSrc, 'shadowCredentialCandidates', 'inspect counts open-shadow credential inputs');
  assertIncludes(inspectSrc, 'frameContext', 'inspect reports frame context');
  assertIncludes(pickSrc, "reason: 'shadow_dom_unsupported'", 'pick reports shadow click');
  assertIncludes(pickSrc, "reason: 'nested_frame_unsupported'", 'pick report_only mode');
  assertIncludes(pickSrc, "options.mode === 'pick' || options.mode === 'report_only'", 'pick mode opt-in only (STANDARD passes none)');
}
console.log('  ✓ 7. Ext static: nonce handshake (no getFrameId / webNavigation / debugger), exact-one matcher, R1 gate before frame logic, per-frame arm + disarm-others, cancel allFrames, click resolves frame first (AC-IF-6/9/10/13)');

// ─── 8. Ext behavioral harness on synthetic generic fixtures ────────────────
function loadExt(chrome) {
  const start = bgSrc.indexOf('/**\n * 121.1-IF — SPECIAL authoring frame surface');
  const end = bgSrc.indexOf('function openPageAndManagedAutofill');
  assert(start > 0 && end > start, 'Ext SPECIAL block located');
  const src = bgSrc
    .slice(start, end)
    .replace('var SPECIAL_READINESS_POLL_MS = 400;', 'var SPECIAL_READINESS_POLL_MS = 5;')
    .replace('var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;', 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 5;');
  const prelude = `
    var ADMIN_INSPECT_READINESS_MAX_WAIT_MS = 10, ADMIN_INSPECT_READINESS_POLL_MS = 1;
    var SPECIAL_VISUAL_PICK_DEFAULT_TIMEOUT_MS = 1000, SPECIAL_VISUAL_PICK_MAX_TIMEOUT_MS = 2000;
    var specialVisualPickArmed = null;
    function ensureSpecialAuthoringTab(m, cb) { cb({ ok: true, tabId: 7, reused: true }); }
    function activateSpecialAuthoringTab(t, cb) { chrome.__activated = (chrome.__activated || 0) + 1; cb(true); }
    function withAuthoringTab(r, t) { return Object.assign({}, r, { authoringTabId: t }); }
    function rejectIfReopenLoginEntryRequested() { return false; }
  `;
  // eslint-disable-next-line no-new-func
  return new Function('chrome', `${prelude}\n${src}\nreturn {
    inspect: inspectCurrentAuthoringTab,
    visual: visualMappingCurrentAuthoringTab,
    cancel: cancelVisualMappingCurrentAuthoringTab,
    click: authoringClickApprovedAction,
    armed: function () { return specialVisualPickArmed; },
    matchNonces: specialMatchFrameNonces,
  };`)(chrome);
}

/**
 * Simulated browsing context per mock frame: real frame-correlation.js evaluated
 * in a fake window; iframe elements in the top document whose contentWindow.postMessage
 * dispatches asynchronously with event.source = the posting window. No chrome API
 * exists inside page windows; chrome.runtime has no getFrameId.
 */
const NONCE_TYPE = 'pv-frame-correlation-nonce';
function frameWindow(f, ctx) {
  if (f.__win) return f.__win;
  const listeners = [];
  const win = {
    location: { origin: f.origin },
    crypto: webcrypto,
    addEventListener(type, fn) {
      if (type === 'message') listeners.push(fn);
    },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    __listenerCount: () => listeners.length,
    __dispatch(data, source) {
      for (const fn of listeners.slice()) fn({ data: structuredClone(data), source });
      if (typeof f.pageScript === 'function') f.pageScript(data, ctx);
    },
  };
  f.__win = win;
  if (f.depth === 0) {
    win.top = win;
    win.parent = win;
    win.document = {
      querySelectorAll(sel) {
        const els = ctx.frames().filter((x) => x.depth === 1 && !x.noElement).map((x) => frameElement(x, ctx));
        if (sel === 'iframe') return els;
        const m = /^iframe#(.+)$/.exec(sel);
        return m ? els.filter((el) => el.id === m[1]) : [];
      },
    };
  } else {
    const top = frameWindow(ctx.frames().find((x) => x.depth === 0), ctx);
    const parentFrame = f.depth === 1 ? null : ctx.frames().find((x) => x.frameId === (f.parentId ?? ctx.frames().find((y) => y.depth === 1).frameId));
    win.top = top;
    win.parent = parentFrame ? frameWindow(parentFrame, ctx) : top;
  }
  return win;
}
function frameElement(f, ctx) {
  if (f.__el) return f.__el;
  const id = f.locator ? /^iframe#(.+)$/.exec(f.locator)[1] : '';
  f.__el = {
    tagName: 'IFRAME',
    id,
    getAttribute: () => null,
    getBoundingClientRect: () => (f.visible === false ? { width: 0, height: 0 } : { width: 352, height: 364 }),
    get contentWindow() {
      if (f.noContentWindow) return null;
      const topWin = frameWindow(ctx.frames().find((x) => x.depth === 0), ctx);
      return {
        postMessage(msg) {
          const targets = (f.deliverTo || [f.frameId]).map((fid) => ctx.frames().find((x) => x.frameId === fid)).filter(Boolean);
          setTimeout(() => targets.forEach((t) => frameWindow(t, ctx).__dispatch(msg, topWin)), 0);
        },
      };
    },
  };
  return f.__el;
}
function runInWindow(win, func, args) {
  // eslint-disable-next-line no-new-func
  return new Function('__w', '__f', '__a', 'with (__w) { return eval("(" + __f + ")").apply(null, __a); }')(win, String(func), args || []);
}

/**
 * Mock tab: frames = [{ frameId, origin, protocol?, depth: 0|1|2, locator?, visible?,
 * injectable?, page?, creds?: string[], clickables?: {locator: fn}, pick?: result|'pending' }].
 */
function mockChrome({ topUrl = `${ORIGIN}/`, frames, correlation = 'ok' }) {
  const calls = [];
  const pending = new Map();
  const sentNonces = [];
  const ctx = { frames: () => frames };
  const chrome = {
    runtime: { lastError: null },
    tabs: { get: (id, cb) => setTimeout(() => cb({ id, url: topUrl }), 0) },
    scripting: {
      executeScript(details, cb) {
        calls.push(details);
        const done = (value, err) =>
          setTimeout(() => {
            chrome.runtime.lastError = err ? { message: err } : null;
            cb(value);
            chrome.runtime.lastError = null;
          }, 0);
        const t = details.target;
        const live = frames.filter((f) => f.injectable !== false);
        const byId = (id) => live.find((f) => f.frameId === id);
        const fsrc = details.func ? String(details.func) : '';
        const probe = (f) => ({ origin: f.origin, protocol: f.protocol || new URL(f.origin).protocol, isTop: f.depth === 0, isDepth1: f.depth === 1 });
        if (t.allFrames && details.files) {
          // Handshake step 1: listener injected into every injectable frame (real file).
          if (correlation !== 'ok') return done(undefined, 'Cannot access contents of the page');
          if (details.world !== 'ISOLATED') return done(undefined, 'correlation must be ISOLATED');
          for (const f of live) {
            // eslint-disable-next-line no-new-func
            if (details.files.includes('generic/frame-correlation.js')) new Function('window', corrSrc)(frameWindow(f, ctx));
          }
          return done(live.map((f) => ({ frameId: f.frameId, result: undefined })));
        }
        if (t.allFrames && fsrc.includes('__readFrameCorrelationNonces')) {
          // Handshake step 3: read back per frameId (real read-back function in each window).
          return done(live.map((f) => ({ frameId: f.frameId, result: runInWindow(frameWindow(f, ctx), details.func, details.args) })));
        }
        if (t.allFrames) {
          if (details.func && details.func.name === 'specialFrameProbe') {
            return done(live.map((f) => ({ frameId: f.frameId, result: probe(f) })));
          }
          const reason = (fsrc.match(/__disarmVisualTargetPick\('([^']+)'\)/) || [])[1];
          const out = live.map((f) => {
            const p = pending.get(f.frameId);
            if (p) {
              pending.delete(f.frameId);
              p({ ok: false, reason });
            }
            return { frameId: f.frameId, result: Boolean(p) };
          });
          return done(out);
        }
        const fid = t.frameIds[0];
        const f = byId(fid);
        if (details.files) return f ? done(undefined) : done(undefined, 'Cannot access frame');
        if (!f) return done(undefined, 'No frame with id ' + fid);
        const args = details.args || [];
        if (details.func && details.func.name === 'specialFrameProbe') return done([{ frameId: fid, result: probe(f) }]);
        if (fsrc.includes('__collectFrameCorrelation') || fsrc.includes('__resolveFrameByLocator')) {
          // Handshake step 2: real sender in the top window (ISOLATED, frame 0 only).
          if (fid !== 0 || details.world !== 'ISOLATED') return done(undefined, 'sender must run ISOLATED in frame 0');
          const r = runInWindow(frameWindow(f, ctx), details.func, args);
          if (r && r.ok) sentNonces.push(...(r.frames ? r.frames.map((x) => x.nonce) : [r.nonce]));
          return done([{ frameId: 0, result: r }]);
        }
        if (fsrc.includes('collectSafePageStructureWithReadiness')) {
          return done([{ frameId: fid, result: { ok: true, page: f.page || { inputs: [], origin: f.origin }, actionCandidates: f.actions || [] } }]);
        }
        if (fsrc.includes('armVisualTargetPick') && !fsrc.includes('__disarmVisualTargetPick')) {
          f.armMode = args[3];
          if (f.pick && f.pick !== 'pending') {
            return setTimeout(() => done([{ frameId: fid, result: f.pick }]), f.pickDelay || 5);
          }
          pending.set(fid, (r) => done([{ frameId: fid, result: r }]));
          return undefined;
        }
        if (fsrc.includes('__disarmVisualTargetPick')) {
          const reason = (fsrc.match(/__disarmVisualTargetPick\('([^']+)'\)/) || [])[1];
          f.disarmedWith = reason;
          const p = pending.get(fid);
          if (p) {
            pending.delete(fid);
            p({ ok: false, reason });
          }
          return done([{ frameId: fid, result: Boolean(p) }]);
        }
        if (fsrc.includes('collectSpecialEligibleCredentialLocators')) {
          return done([{ frameId: fid, result: f.origin === args[0] ? [...(f.creds || [])] : [] }]);
        }
        if (fsrc.includes('isSpecialDeclaredReadinessMet')) {
          if (f.origin !== args[0]) return done([{ frameId: fid, result: { met: false, originMismatch: true } }]);
          return done([{ frameId: fid, result: { met: (f.creds || []).includes(args[1]) } }]);
        }
        if (fsrc.includes('.click()')) {
          if (f.origin !== args[1]) return done([{ frameId: fid, result: { ok: false, reason: 'frame_origin_mismatch' } }]);
          const handler = f.clickables && f.clickables[args[0]];
          if (!handler) return done([{ frameId: fid, result: { ok: false, reason: 'click_target_missing' } }]);
          f.clicked = (f.clicked || 0) + 1;
          handler();
          return done([{ frameId: fid, result: { ok: true } }]);
        }
        return done(undefined, 'unexpected script');
      },
    },
  };
  return { chrome, calls, pending, sentNonces, ctx };
}
const call = (ext, name, msg) => new Promise((resolve) => ext[name](msg, resolve));
const topFrame = (extra = {}) => ({ frameId: 0, origin: ORIGIN, depth: 0, ...extra });
{
  // R1 first: top origin mismatch → no frame work at all.
  {
    const m = mockChrome({ topUrl: 'https://other.example/', frames: [topFrame()] });
    const ext = loadExt(m.chrome);
    for (const [name, msg] of [
      ['inspect', { allowedOrigin: ORIGIN }],
      ['visual', { allowedOrigin: ORIGIN, fieldId: 'username' }],
      ['click', { allowedOrigin: ORIGIN, locator: '#go', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'floating_opener' }],
    ]) {
      const r = await call(ext, name, msg);
      assert(r.ok === false && r.reason === 'origin_mismatch', `R1 ${name} → origin_mismatch`);
    }
    assert(m.calls.length === 0, 'R1 failure → zero executeScript (no enumerate / inject / arm / click)');
  }
  // final_submit → rejected before any tab work.
  {
    const m = mockChrome({ frames: [topFrame()] });
    const r = await call(loadExt(m.chrome), 'click', { allowedOrigin: ORIGIN, locator: '#go', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'final_submit' });
    assert(r.reason === 'reserved_action_kind' && m.calls.length === 0, 'Ext click: final_submit → reserved_action_kind, never clicked');
  }
  // F-IF-TOP: top-document modal revealed by opener → no frame, reveal passes.
  {
    const top = topFrame({ creds: [] });
    top.clickables = { '#logInBtn': () => setTimeout(() => top.creds.push('#user'), 10) };
    const m = mockChrome({ frames: [top] });
    const ext = loadExt(m.chrome);
    const ins = await call(ext, 'inspect', { allowedOrigin: ORIGIN });
    assert(ins.ok && ins.surfaces.length === 1 && ins.surfaces[0].frame === null && ins.surfaces[0].frameKey === 'top', 'F-IF-TOP inspect: single top surface, no descriptor');
    assert(Object.values(ins.unsupported).every((n) => n === 0), 'F-IF-TOP: no UNSUPPORTED counts');
    const r = await call(ext, 'click', { allowedOrigin: ORIGIN, locator: '#logInBtn', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'floating_opener', readinessMode: 'reveal', readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 300 } });
    assert(r.ok === true && r.readinessMode === 'reveal' && r.revealed.frame === null, 'F-IF-TOP reveal readiness passes in top document');
    assert(m.chrome.__activated === 1, 'D-121-27 activation before click retained');
  }
  // F-IF-FRAME: depth-1 cross-origin iframe inserted after opener click.
  {
    const top = topFrame({ creds: [] });
    const frames = [top];
    const frame = { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator, creds: ['#user', '#pass'], page: { inputs: [{ inputId: 'u' }], origin: FRAME_ORIGIN } };
    top.clickables = {
      '#logInBtn': () => setTimeout(() => (frames.includes(frame) ? null : frames.push(frame)), 10),
    };
    const m = mockChrome({ frames });
    const ext = loadExt(m.chrome);
    const r = await call(ext, 'click', { allowedOrigin: ORIGIN, locator: '#logInBtn', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'floating_opener', readinessMode: 'reveal', readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 400 } });
    assert(r.ok === true && JSON.stringify(r.revealed.frame) === JSON.stringify(FRAME), 'F-IF-FRAME reveal passes via the new frame (frame reported for approval prompt)');
    assert(!JSON.stringify(r).includes('"frameId"'), 'frameIds never returned to Hub');
    const ins = await call(ext, 'inspect', { allowedOrigin: ORIGIN });
    const fs = ins.surfaces.find((s) => s.status === 'depth1_https');
    assert(fs && JSON.stringify(fs.frame) === JSON.stringify(FRAME) && fs.frameKey === `${FRAME.frameLocator}|${FRAME_ORIGIN}`, 'F-IF-FRAME surface tagged with descriptor');
    assert(ins.page && Array.isArray(ins.actionCandidates), 'legacy page / actionCandidates = top surface');
    const inspectCall = m.calls.find((c) => c.func && String(c.func).includes('collectSafePageStructureWithReadiness') && c.target.frameIds[0] === 5);
    assert(inspectCall && inspectCall.args[0] === FRAME_ORIGIN, 'depth-1 inspect expectedOrigin = frame origin');
    // Declared mode in the frame (after fields mapped): frame resolved, field polled.
    const d = await call(ext, 'click', { allowedOrigin: ORIGIN, locator: '#logInBtn', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'floating_opener', readinessMode: 'declared', readiness: { locator: '#user', timeoutMs: 300, frame: { ...FRAME } } });
    assert(d.ok === true && d.readinessMode === 'declared', 'declared readiness in frame passes');
    const miss = await call(ext, 'click', { allowedOrigin: ORIGIN, locator: '#logInBtn', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'floating_opener', readinessMode: 'declared', readiness: { locator: '#nope', timeoutMs: 40, frame: { ...FRAME } } });
    assert(miss.ok === false && miss.reason === 'readiness_timeout', 'declared field never appears → readiness_timeout');
    // Click inside approved frame (live exact-one + origin + depth-1).
    frame.clickables = { '#continue': () => {} };
    const fc = await call(ext, 'click', { allowedOrigin: ORIGIN, locator: '#continue', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'intermediate_transition', frame: { ...FRAME }, readinessMode: 'declared', readiness: { locator: '#pass', timeoutMs: 200, frame: { ...FRAME } } });
    assert(fc.ok === true && frame.clicked === 1, 'framed continuation click executes inside resolved frame');
  }
  // Reveal: nothing new appears → surface_not_revealed.
  {
    const top = topFrame({ creds: ['#already'] });
    top.clickables = { '#logInBtn': () => {} };
    const r = await call(loadExt(mockChrome({ frames: [top] }).chrome), 'click', { allowedOrigin: ORIGIN, locator: '#logInBtn', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'floating_opener', readinessMode: 'reveal', readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 40 } });
    assert(r.ok === false && r.reason === 'surface_not_revealed', 'pre-existing inputs do not count; none new → surface_not_revealed');
  }
  // F-IF-SELF: declared readiness = the clicked element itself → rejected, no click.
  {
    const top = topFrame({ creds: [] });
    top.clickables = { '#logInBtn': () => {} };
    const m = mockChrome({ frames: [top] });
    const r = await call(loadExt(m.chrome), 'click', { allowedOrigin: ORIGIN, locator: '#logInBtn', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'floating_opener', readinessMode: 'declared', readiness: { locator: '#logInBtn', timeoutMs: 100 } });
    assert(r.reason === 'readiness_is_self' && !top.clicked && m.calls.length === 0, 'F-IF-SELF opener-self readiness rejected before click');
  }
  // F-IF-SWAP: approved frame navigated to another origin → frame_origin_mismatch, no click.
  {
    const frame = { frameId: 5, origin: 'https://evil.example', depth: 1, locator: FRAME.frameLocator, clickables: { '#continue': () => {} } };
    const m = mockChrome({ frames: [topFrame(), frame] });
    const r = await call(loadExt(m.chrome), 'click', { allowedOrigin: ORIGIN, locator: '#continue', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'intermediate_transition', frame: { ...FRAME }, readinessMode: 'reveal', readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 50 } });
    assert(r.ok === false && r.reason === 'frame_origin_mismatch' && r.liveOrigin === 'https://evil.example', 'F-IF-SWAP → frame_origin_mismatch (live origin reported)');
    assert(!frame.clicked, 'F-IF-SWAP: no click');
  }
  // Frame missing / ambiguous at click → fail-closed.
  {
    const r1 = await call(loadExt(mockChrome({ frames: [topFrame()] }).chrome), 'click', { allowedOrigin: ORIGIN, locator: '#c', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'intermediate_transition', frame: { ...FRAME }, readinessMode: 'reveal', readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 50 } });
    assert(r1.reason === 'frame_missing', 'declared frame missing → frame_missing, no click');
    const twins = [topFrame(), { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator }, { frameId: 6, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator }];
    const r2 = await call(loadExt(mockChrome({ frames: twins }).chrome), 'click', { allowedOrigin: ORIGIN, locator: '#c', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'intermediate_transition', frame: { ...FRAME }, readinessMode: 'reveal', readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 50 } });
    assert(r2.reason === 'frame_ambiguous', 'non-exact-one iframe → frame_ambiguous, no click');
  }
  // F-IF-NESTED: frame-in-frame → counted, armed report_only, click → nested_frame_unsupported.
  {
    const nested = { frameId: 9, origin: FRAME_ORIGIN, depth: 2, pick: { ok: false, reason: 'nested_frame_unsupported' } };
    const top = topFrame({ pick: 'pending' });
    const m = mockChrome({ frames: [top, { frameId: 5, origin: 'https://wrap.example', depth: 1, locator: 'iframe#wrap', pick: 'pending' }, nested] });
    const ext = loadExt(m.chrome);
    const ins = await call(ext, 'inspect', { allowedOrigin: ORIGIN });
    assert(ins.unsupported.nested === 1, 'F-IF-NESTED counted');
    assert(!ins.surfaces.some((s) => s.status === 'nested'), 'nested frame never a surface');
    const v = await call(ext, 'visual', { allowedOrigin: ORIGIN, fieldId: 'username' });
    assert(nested.armMode === 'report_only' && top.armMode === 'pick', 'nested armed report_only; top/depth-1 armed pick');
    assert(v.ok === false && v.reason === 'nested_frame_unsupported', 'F-IF-NESTED click → nested_frame_unsupported (never silent)');
    assert(top.disarmedWith === 'visual_pick_superseded_other_frame', 'other frames disarmed after first click');
    assert(ext.armed() === null, 'armed set cleared');
  }
  // Visual first-click-wins in a depth-1 frame; tagged with descriptor.
  {
    const top = topFrame({ pick: 'pending' });
    const frame = { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator, pick: { ok: true, locator: '#user', fieldId: 'username', frameOrigin: FRAME_ORIGIN, isTop: false } };
    const m = mockChrome({ frames: [top, frame] });
    const ext = loadExt(m.chrome);
    const v = await call(ext, 'visual', { allowedOrigin: ORIGIN, fieldId: 'username' });
    assert(v.ok && JSON.stringify(v.frame) === JSON.stringify(FRAME) && v.frameKey === `${FRAME.frameLocator}|${FRAME_ORIGIN}`, 'Visual winner tagged { frameKey, frame }');
    assert(top.disarmedWith === 'visual_pick_superseded_other_frame', 'Visual: top disarmed after frame click');
    assert(m.calls.filter((c) => c.func && String(c.func).includes('armVisualTargetPick')).every((c) => c.target.frameIds && c.target.frameIds.length === 1), 'one executeScript per frameId');
    assert(m.chrome.__activated === 1, 'D-121-27 activation before arm retained');
  }
  // Visual: all frames time out → timeout (+ unsupported counts for the hint); cancel disarms all.
  {
    const m = mockChrome({ frames: [topFrame({ pick: { ok: false, reason: 'visual_pick_timeout' } }), { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator, pick: { ok: false, reason: 'visual_pick_timeout' } }, { frameId: 8, origin: 'http://ads.example', depth: 1, locator: 'iframe#ad', injectable: false }] });
    const v = await call(loadExt(m.chrome), 'visual', { allowedOrigin: ORIGIN, fieldId: 'username' });
    assert(v.ok === false && v.reason === 'visual_pick_timeout' && v.unsupported.notInjectable === 1, 'timeout reply carries notInjectable for hint');
    const top = topFrame({ pick: 'pending' });
    const fr = { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator, pick: 'pending' };
    const m2 = mockChrome({ frames: [top, fr] });
    const ext2 = loadExt(m2.chrome);
    const started = call(ext2, 'visual', { allowedOrigin: ORIGIN, fieldId: 'username' });
    for (let i = 0; i < 100 && m2.pending.size < 2; i += 1) await new Promise((r) => setTimeout(r, 10));
    assert(ext2.armed() && ext2.armed().frameIds.length === 2, 'armed set = { tabId, frameIds[] }');
    const c = await call(ext2, 'cancel', { allowedOrigin: ORIGIN, tabId: 7 });
    assert(c.ok && c.disarmed === true, 'cancel disarms (any frame true)');
    const vr = await started;
    assert(vr.reason === 'visual_pick_cancelled' && m2.pending.size === 0, '«ביטול» disarms every frame; START resolves cancelled (editor released)');
  }
  // F-IF-NOADDR: two identical iframes without deterministic locator.
  {
    const a = { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: null, pick: { ok: true, locator: '#user', frameOrigin: FRAME_ORIGIN } };
    const b = { frameId: 6, origin: FRAME_ORIGIN, depth: 1, locator: null, pick: 'pending' };
    const m = mockChrome({ frames: [topFrame({ pick: 'pending' }), a, b] });
    const ext = loadExt(m.chrome);
    const ins = await call(ext, 'inspect', { allowedOrigin: ORIGIN });
    assert(ins.unsupported.notAddressable === 2, 'F-IF-NOADDR counted');
    assert(ins.surfaces.filter((s) => s.status === 'not_addressable').every((s) => s.frame.frameLocator === null), 'unaddressable surfaces flagged (display only)');
    const v = await call(ext, 'visual', { allowedOrigin: ORIGIN, fieldId: 'username' });
    assert(v.ok === false && v.reason === 'frame_not_addressable', 'F-IF-NOADDR Visual → frame_not_addressable');
  }
  // Non-HTTPS / non-injectable frames counted; correlation unavailable reported (top-only, no guess).
  {
    const m = mockChrome({ frames: [topFrame(), { frameId: 5, origin: 'http://legacy.example', protocol: 'http:', depth: 1, locator: 'iframe#legacy' }, { frameId: 6, origin: 'null', protocol: 'about:', depth: 1, locator: 'iframe#blank', injectable: false }] });
    const ins = await call(loadExt(m.chrome), 'inspect', { allowedOrigin: ORIGIN });
    assert(ins.unsupported.nonHttps === 1 && ins.unsupported.notInjectable === 1, 'non-HTTPS + non-injectable counted');
    assert(ins.surfaces.length === 1, 'only top surface usable');
    const m2 = mockChrome({ frames: [topFrame(), { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator }], correlation: 'unavailable' });
    const ins2 = await call(loadExt(m2.chrome), 'inspect', { allowedOrigin: ORIGIN });
    assert(ins2.ok && ins2.surfaces.length === 1 && ins2.unsupported.correlationUnavailable === 1 && ins2.frameCorrelation === 'unavailable', 'correlation unavailable → top only + reported (never guessed)');
  }
  // F-IF-SHADOW: count propagated from the page collector.
  {
    const m = mockChrome({ frames: [topFrame({ page: { inputs: [], origin: ORIGIN, shadowCredentialCandidates: 1 } })] });
    const ins = await call(loadExt(m.chrome), 'inspect', { allowedOrigin: ORIGIN });
    assert(ins.unsupported.shadowCredential === 1, 'F-IF-SHADOW count reaches Hub');
  }
}
console.log('  ✓ 8. Ext harness: R1-first, F-IF-TOP / FRAME / NESTED / NOADDR / SWAP / SELF, declared + reveal R3, first-click-wins, cancel all frames');

// ─── 8b. D-121-29 postMessage nonce handshake ───────────────────────────────
{
  const hex = (c) => c.repeat(32);
  // Pure exact-one matcher.
  {
    const match = loadExt(mockChrome({ frames: [topFrame()] }).chrome).matchNonces;
    const [A, B, C2, S] = [hex('a'), hex('b'), hex('c'), hex('d')];
    const ok = match([A, B], [{ frameId: 0, result: [A] }, { frameId: 5, result: [A] }, { frameId: 6, result: [B, S] }]);
    assert(ok[0].state === 'ok' && ok[0].frameId === 5 && ok[1].state === 'ok' && ok[1].frameId === 6, 'matcher: one receiver each; frame 0 and stale nonces ignored');
    const dup = match([A, B], [{ frameId: 5, result: [A] }, { frameId: 6, result: [A, B] }]);
    assert(dup[0].state === 'ambiguous' && dup[1].state === 'ambiguous', 'matcher: nonce at two frames / frame with two nonces → ambiguous');
    const miss = match([A, C2], [{ frameId: 5, result: [A] }, { frameId: 6, result: [] }]);
    assert(miss[0].state === 'ok' && miss[1].state === 'none' && miss[1].frameId === null, 'matcher: unreceived nonce → none');
    assert(match([null], [{ frameId: 5, result: [A] }])[0].state === 'none', 'matcher: missing nonce never matches');
  }
  // No getFrameId anywhere in the simulated environment.
  {
    const m = mockChrome({ frames: [topFrame(), { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator }] });
    await call(loadExt(m.chrome), 'inspect', { allowedOrigin: ORIGIN });
    assert(!('getFrameId' in m.chrome.runtime), 'harness chrome.runtime has no getFrameId');
    assert(m.ctx.frames().every((f) => !f.__win || !('chrome' in f.__win)), 'page windows have no chrome API');
    assert(m.sentNonces.length === 1 && /^[0-9a-f]{32}$/.test(m.sentNonces[0]), 'fresh 128-bit hex nonce per iframe');
  }
  // L-1 shape (generic): same-origin login frame preloaded 0×0 (inputs already present) + a visible
  // cross-origin media frame. Opener reveals the login frame → reveal readiness succeeds via the frame.
  {
    const top = topFrame({ creds: [] });
    const login = { frameId: 5, origin: ORIGIN, depth: 1, locator: 'iframe#login-same', visible: false, creds: ['#user', '#pass'] };
    const media = { frameId: 6, origin: 'https://media.example', depth: 1, locator: 'iframe#media', creds: [] };
    top.clickables = { '#logInBtn': () => setTimeout(() => (login.visible = true), 10) };
    const m = mockChrome({ frames: [top, login, media] });
    const ext = loadExt(m.chrome);
    const r = await call(ext, 'click', { allowedOrigin: ORIGIN, locator: '#logInBtn', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'floating_opener', readinessMode: 'reveal', readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 600 } });
    assert(r.ok === true && JSON.stringify(r.revealed.frame) === JSON.stringify({ frameLocator: 'iframe#login-same', frameOrigin: ORIGIN }), 'preloaded 0×0 frame that becomes visible → reveal readiness succeeds via that frame');
    const ins = await call(ext, 'inspect', { allowedOrigin: ORIGIN });
    const ls = ins.surfaces.find((s) => s.frame && s.frame.frameLocator === 'iframe#login-same');
    const ms = ins.surfaces.find((s) => s.frame && s.frame.frameLocator === 'iframe#media');
    assert(ls && ls.frame.frameOrigin === ORIGIN && ms && ms.frame.frameOrigin === 'https://media.example', 'each element mapped to its own frame (same-origin login + media)');
    assert(ins.frameCorrelation === 'ok' && ins.unsupported.correlationUnavailable === 0, 'handshake OK → no correlation-unavailable message');
    const d = await call(ext, 'click', { allowedOrigin: ORIGIN, locator: '#logInBtn', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'floating_opener', readinessMode: 'declared', readiness: { locator: '#user', timeoutMs: 300, frame: { frameLocator: 'iframe#login-same', frameOrigin: ORIGIN } } });
    assert(d.ok === true, 'declared readiness resolves the same-origin frame by locator + nonce');
    assert(m.ctx.frames().filter((f) => f.depth === 1).every((f) => f.__win.__listenerCount() === 1), 'listener installed once per frame across attempts (idempotent)');
  }
  // Duplicate: one element's nonce reaches two frames → neither mapped; resolve → frame_ambiguous.
  {
    const a = { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator, deliverTo: [5, 6], clickables: { '#c': () => {} } };
    const b = { frameId: 6, origin: FRAME_ORIGIN, depth: 1, locator: 'iframe#other' };
    const m = mockChrome({ frames: [topFrame(), a, b] });
    const ext = loadExt(m.chrome);
    const ins = await call(ext, 'inspect', { allowedOrigin: ORIGIN });
    assert(!ins.surfaces.some((s) => s.status === 'depth1_https') && ins.unsupported.notAddressable === 2, 'duplicate nonce → both elements not_addressable (never guessed)');
    const r = await call(ext, 'click', { allowedOrigin: ORIGIN, locator: '#c', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'intermediate_transition', frame: { ...FRAME }, readinessMode: 'reveal', readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 50 } });
    assert(r.ok === false && r.reason === 'frame_ambiguous' && !a.clicked, 'duplicate at resolve → frame_ambiguous, no click');
  }
  // Missing: element whose frame never receives (no contentWindow) → not mapped; resolve → frame_missing.
  {
    const a = { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator, noContentWindow: true, clickables: { '#c': () => {} } };
    const m = mockChrome({ frames: [topFrame(), a] });
    const ext = loadExt(m.chrome);
    const ins = await call(ext, 'inspect', { allowedOrigin: ORIGIN });
    assert(ins.surfaces.length === 1 && ins.unsupported.notInjectable === 1, 'missing nonce → element unmapped + reported');
    const r = await call(ext, 'click', { allowedOrigin: ORIGIN, locator: '#c', locatorType: 'css', approvedForAuthoringContinuation: true, kind: 'intermediate_transition', frame: { ...FRAME }, readinessMode: 'reveal', readiness: { locator: '[data-pv-pending-reveal]', timeoutMs: 50 } });
    assert(r.ok === false && r.reason === 'frame_missing' && !a.clicked, 'missing at resolve → frame_missing, no click');
  }
  // Sibling-forged: a sibling frame's page script forwards its nonce to another frame
  // (event.source = sibling) → rejected; both frames still map exactly one-to-one.
  {
    const a = { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator };
    const b = { frameId: 6, origin: 'https://sibling.example', depth: 1, locator: 'iframe#sib' };
    b.pageScript = (data, ctx) => {
      if (data && data.type === NONCE_TYPE) setTimeout(() => frameWindow(a, ctx).__dispatch(data, frameWindow(b, ctx)), 0);
    };
    const m = mockChrome({ frames: [topFrame(), a, b] });
    const ins = await call(loadExt(m.chrome), 'inspect', { allowedOrigin: ORIGIN });
    const sa = ins.surfaces.find((s) => s.frame && s.frame.frameLocator === FRAME.frameLocator);
    const sb = ins.surfaces.find((s) => s.frame && s.frame.frameLocator === 'iframe#sib');
    assert(sa && sa.frame.frameOrigin === FRAME_ORIGIN && sb && sb.frame.frameOrigin === 'https://sibling.example', 'sibling-forged nonce rejected (event.source ≠ parent); mapping stays exact-one');
    assert(ins.unsupported.notAddressable === 0, 'forgery attempt does not break correlation');
    // Direct: forged from sibling / from top into a nested frame → never held.
    const aw = frameWindow(a, m.ctx);
    aw.__dispatch({ type: NONCE_TYPE, nonce: hex('e') }, frameWindow(b, m.ctx));
    assert(!(aw.__pvFrameCorrelationHeld || []).some((h) => h.nonce === hex('e')), 'listener drops message whose source is a sibling');
    const topW = frameWindow(m.ctx.frames()[0], m.ctx);
    topW.__dispatch({ type: NONCE_TYPE, nonce: hex('e') }, topW);
    assert(!(topW.__pvFrameCorrelationHeld || []).length, 'top frame never holds nonces');
  }
  {
    const wrap = { frameId: 5, origin: 'https://wrap.example', depth: 1, locator: 'iframe#wrap' };
    const nested = { frameId: 9, origin: FRAME_ORIGIN, depth: 2, parentId: 5 };
    const m = mockChrome({ frames: [topFrame(), wrap, nested] });
    await call(loadExt(m.chrome), 'inspect', { allowedOrigin: ORIGIN });
    const nw = frameWindow(nested, m.ctx);
    nw.__dispatch({ type: NONCE_TYPE, nonce: hex('f') }, nw.parent);
    assert(!(nw.__pvFrameCorrelationHeld || []).length, 'depth-2 frame drops nonce even from its parent (parent ≠ top)');
  }
  // Stale: a nonce from a previous attempt replayed into another frame never counts.
  {
    const a = { frameId: 5, origin: FRAME_ORIGIN, depth: 1, locator: FRAME.frameLocator };
    const b = { frameId: 6, origin: 'https://media.example', depth: 1, locator: 'iframe#media' };
    const m = mockChrome({ frames: [topFrame(), a, b] });
    const ext = loadExt(m.chrome);
    await call(ext, 'inspect', { allowedOrigin: ORIGIN });
    const old = m.sentNonces.slice();
    const topW = frameWindow(m.ctx.frames()[0], m.ctx);
    for (const n of old) frameWindow(b, m.ctx).__dispatch({ type: NONCE_TYPE, nonce: n }, topW);
    const ins = await call(ext, 'inspect', { allowedOrigin: ORIGIN });
    assert(ins.surfaces.filter((s) => s.status === 'depth1_https').length === 2 && ins.unsupported.notAddressable === 0, 'stale nonces of a previous attempt ignored; fresh nonces map exact-one');
    assert(m.sentNonces.slice(old.length).every((n) => !old.includes(n)), 'nonces are fresh per attempt');
  }
}
console.log('  ✓ 8b. D-121-29 handshake: real listener/sender, exact-one matcher, preloaded 0×0 frame → reveal OK, duplicate / missing / sibling-forged / nested / stale nonces fail-closed, no getFrameId');
LIVE_ONLY('F-IF-FRAME/page', 'postMessage nonce handshake across real frame processes + exact-one iframe locator (L-1 Mizrahi-Tefahot #iframeLogIn, same origin → A2)');
LIVE_ONLY('F-IF-SHADOW/page', 'open-shadow credential count + composedPath() shadow click → shadow_dom_unsupported in a live page');
LIVE_ONLY('F-IF-NESTED/page', 'report_only listener inside a real frame-in-frame');
LIVE_ONLY('F-IF-TOP/live', 'top-document floating screen fixture (L-2 Bank PAGI or CAL): no frame prompt, no frame keys');

// ─── 9. Genericity grep gate (AC-IF-15) ─────────────────────────────────────
{
  const changed = [
    'extension/background.js',
    'extension/generic/frame-correlation.js',
    'extension/generic/page-structure-inspect.js',
    'extension/generic/visual-target-pick.js',
    'src/assistedMapping/currentTabAuthoring.ts',
    'src/assistedMapping/specialAnalyzeRouting.ts',
    'src/assistedMapping/types.ts',
    'src/admin/SpecialLoginDraftEditor.tsx',
    'src/loginContract/frameDescriptor.ts',
    'src/loginContract/specialDraftAuthoring.ts',
    'src/loginContract/validateSpecialPlan.ts',
    'src/loginContract/parse.ts',
    'src/loginContract/types.ts',
  ];
  for (const rel of changed) {
    const src = read(rel);
    const lower = src.toLowerCase();
    for (const needle of ['mizrahi', 'tefahot', 'pagi', 'cal-online', 'icount', 'bankhapoalim', 'leumi']) {
      assertNotIncludes(lower, needle, `${rel}: no fixture name "${needle}"`);
    }
    // background.js has pre-existing localhost dev guards; branch checks cover the SPECIAL block.
    const scoped =
      rel === 'extension/background.js'
        ? src.slice(src.indexOf('function ensureSpecialAuthoringTab'), src.indexOf('function openPageAndManagedAutofill'))
        : src;
    assertNotIncludes(scoped, 'serviceId ===', `${rel}: no serviceId branch`);
    assertNotIncludes(scoped, rel === 'extension/background.js' ? 'hostname' : 'hostname ===', `${rel}: no hostname branch`);
    assert(!/\.co\.il|\.bank\b/i.test(src), `${rel}: no fixture hostnames`);
  }
}
console.log('  ✓ 9. genericity grep gate: no fixture names / hostnames / serviceId branches (AC-IF-15 code half)');

// ─── 10. STANDARD freeze (AC-IF-16, AC-IF-18) ───────────────────────────────
{
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: 'utf8' });
  // Phase 126 Part A (G-3): the manifest may differ only by the Part A lines.
  assert(git('show HEAD:extension/manifest.json').replace(/\r\n/g, '\n') === revertPhase126PartAManifest(read('extension/manifest.json')), 'manifest.json unchanged (permissions, minimum_chrome_version)');
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert(JSON.stringify(manifest.permissions) === JSON.stringify(['tabs', 'scripting']), 'permissions = tabs, scripting');
  assert(git('diff --name-only HEAD -- src/autofill/validatedProfile.ts').trim() === '', 'src/autofill/validatedProfile.ts untouched');
  // D-121-49 / D-121-71 (authorized) edit the eligibility hit rule; reverting exactly those edits must give the
  // pre-slice bytes. R-123-1: frozen at 909cc8b~1 (= 909cc8b^; `^` is an escape char in cmd.exe; HEAD now
  // contains the Phase 121 edits).
  assert(
    revertD12149EligibilityEdits(revertD12171EligibilityEdits(read('extension/generic/managed-target-eligibility.js'))) ===
      git('show 909cc8b~1:extension/generic/managed-target-eligibility.js').replace(/\r\n/g, '\n'),
    'extension/generic/managed-target-eligibility.js untouched outside the D-121-49 edits',
  );
  // D-121-35 adds the action-only locator vocabulary to locator-determinism.js; it stays frame-free
  // and the shared determinism primitives are unchanged.
  {
    const det = read('extension/generic/locator-determinism.js');
    const headDet = git('show HEAD:extension/generic/locator-determinism.js').replace(/\r\n/g, '\n');
    const primitives = headDet.slice(headDet.indexOf('  function assertLocatorDeterministic'), headDet.indexOf('  global.LocatorDeterminism'));
    assert(primitives.length > 0 && det.replace(/\r\n/g, '\n').includes(primitives), 'locator-determinism.js: determinism primitives unchanged');
    for (const token of ['frameKey', 'FrameDescriptor', 'getFrameId', 'readinessMode', 'report_only', 'frame_not_addressable']) {
      assertNotIncludes(det, token, `locator-determinism.js: no 121.1-IF token ${token}`);
    }
  }
  // fill-executor.js / validated-autofill.js carry pre-slice (Phase 120) working-tree edits;
  // assert this slice added nothing to them.
  for (const rel of ['extension/generic/fill-executor.js', 'extension/generic/validated-autofill.js', 'extension/generic/managed-target-eligibility.js']) {
    const src = read(rel);
    for (const token of ['frameKey', 'FrameDescriptor', 'getFrameId', 'readinessMode', 'surface_not_revealed', 'report_only', 'frame_not_addressable']) {
      assertNotIncludes(src, token, `${rel}: no 121.1-IF token ${token}`);
    }
  }
  for (const name of ['function openPageAndVisualMapping', 'function openPageAndInspectLoginStructure']) {
    const at = bgSrc.indexOf(name);
    const fn = bgSrc.slice(at, bgSrc.indexOf('\nfunction ', at + 10));
    assert(at > 0 && fn.includes('frameIds: [0]') && !fn.includes('allFrames'), `${name} still frame 0 only`);
    assertNotIncludes(fn, 'mode:', `${name} arms pick without SPECIAL mode`);
    assertNotIncludes(fn, 'enumerateSpecialAuthoringFrames', `${name} has no frame enumeration`);
  }
  const managedFn = bgSrc.slice(bgSrc.indexOf('function openPageAndManagedAutofill'), bgSrc.indexOf('\nfunction ', bgSrc.indexOf('function openPageAndManagedAutofill') + 10));
  assertNotIncludes(managedFn, 'allFrames', 'Managed Autofill runtime still frame 0');
  // No SPECIAL runtime / frame-targeted fill.
  for (const rel of ['src/execution/managedAutofill.ts', 'extension/generic/fill-executor.js']) {
    assertNotIncludes(read(rel), 'loginFlowPlan', `${rel}: no SPECIAL runtime`);
  }
  assertNotIncludes(clickFn, 'fillField', 'authoring click never fills');
  assertIncludes(clickFn, "reason: 'fill_or_submit_forbidden'", 'fill/submit rejection unchanged');
  for (const rel of ['src/admin/RegistryAdmin.tsx', 'src/admin/AutofillProfileEditor.tsx', 'src/admin/adminRegistryApi.ts']) {
    const src = read(rel);
    for (const token of ['FrameDescriptor', 'frameLocator', 'approvedFrameOrigins']) {
      assertNotIncludes(src, token, `${rel}: no frame support (STANDARD grid untouched)`);
    }
  }
}
console.log('  ✓ 10. STANDARD freeze: manifest identical, STANDARD handlers frame 0, Phase 120 fill/eligibility untouched, no SPECIAL runtime (AC-IF-16/18)');

console.log(`\nLIVE_ONLY (${liveOnly.length}) — covered by Owner live L-1 / L-2 / L-3, not reported as PASS:`);
for (const l of liveOnly) console.log(`  - ${l}`);
console.log('\nPASS — Phase 121.1-IF iframe credential surface (AC-121.1-IF-1…18 static/unit; live items listed above)');
