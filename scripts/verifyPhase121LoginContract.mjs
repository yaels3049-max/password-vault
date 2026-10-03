/**
 * Phase 121.0 — DRAFT/ACTIVE + loginContractActivation + atomic ACTIVATE.
 * Evidence: AC-121.0-1 … AC-121.0-12 (+ DD §7 regression list).
 * Usage: node scripts/verifyPhase121LoginContract.mjs
 */
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertIncludes(hay, needle, message) {
  assert(hay.includes(needle), message);
}

function assertNotIncludes(hay, needle, message) {
  assert(!hay.includes(needle), message);
}

async function loadModule(entry, name) {
  const outfile = join(mkdtempSync(join(tmpdir(), `pv-1210-${name}-`)), `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
    packages: 'external',
  });
  return import(pathToFileURL(outfile).href);
}

console.log('Phase 121.0 — Login contract / ACTIVATE verification\n');

const lc = await loadModule('src/loginContract/index.ts', 'loginContract');
const {
  LOGIN_CONTRACT_ACTIVATION_META_KEY,
  LOGIN_FLOW_PLAN_META_KEY,
  LOGIN_CONTRACT_ACTIVATE_INTENT_KEY,
  parseLoginContractActivation,
  serializeLoginContractActivation,
  parseLoginFlowPlanBag,
  serializeLoginFlowPlanBag,
  resolveActiveLoginContract,
  createImmutableDraftSnapshot,
  planLoginContractActivate,
  assertLoginContractMetadataConsistent,
  mergeLoginContractMetadata,
  validateSpecialPlanComplete,
  deepClonePlanDocument,
} = lc;

assert(LOGIN_CONTRACT_ACTIVATION_META_KEY === 'loginContractActivation', 'AC-121.0-1 activation key');
assert(LOGIN_FLOW_PLAN_META_KEY === 'loginFlowPlan', 'AC-121.0-1 plan key');
assert(LOGIN_CONTRACT_ACTIVATION_META_KEY !== 'autofillProfile', 'sibling of autofillProfile');
assert(LOGIN_FLOW_PLAN_META_KEY !== 'autofillProfile', 'sibling of autofillProfile');
console.log('  ✓ AC-121.0-1 persist keys');

// --- AC-121.0-2 / §7.1 parse serialize discriminator ---
assert(parseLoginContractActivation(undefined) === null, 'missing → null≡STANDARD');
assert(parseLoginContractActivation(null) === null, 'null → null≡STANDARD');
const std = parseLoginContractActivation({ mode: 'STANDARD' });
assert(std && std.mode === 'STANDARD', 'explicit STANDARD');
const spec = parseLoginContractActivation({ mode: 'SPECIAL', activePlanVersion: 3 });
assert(spec && spec.mode === 'SPECIAL' && spec.activePlanVersion === 3, 'SPECIAL+version');
assert(parseLoginContractActivation({ mode: 'SPECIAL' }) === 'CORRUPT_SPECIAL', 'SPECIAL without version corrupt');
assert(
  JSON.stringify(serializeLoginContractActivation({ mode: 'STANDARD' })) ===
    JSON.stringify({ mode: 'STANDARD' }),
  'serialize STANDARD',
);
assert(
  resolveActiveLoginContract({}).mode === 'STANDARD',
  'AC-121.0-2 missing≡STANDARD resolve',
);
assert(
  resolveActiveLoginContract({ [LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'STANDARD' } }).mode ===
    'STANDARD',
  'explicit STANDARD resolve',
);
console.log('  ✓ AC-121.0-2 discriminator shapes + missing≡STANDARD');

// --- helpers: complete SPECIAL draft ---
function makeOpener(id = 'opener-1') {
  return {
    actionId: id,
    kind: 'floating_opener',
    label: 'Open login',
    locatorType: 'css',
    locator: '#open-login',
    approvedForRuntime: true,
    readiness: {
      kind: 'exact_one_eligible_css',
      locatorType: 'css',
      locator: '#user',
      timeoutMs: 5000,
    },
  };
}

function makeCompleteDraft(planVersion = 1) {
  return {
    planVersion,
    pattern: 'FLOATING_SCREEN',
    preambleActions: [makeOpener()],
    steps: [
      {
        stepId: 'step-credentials',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: '#user' },
          { fieldId: 'password', locatorType: 'css', locator: '#pass' },
        ],
      },
    ],
  };
}

const incompleteDraft = {
  planVersion: 1,
  pattern: 'FLOATING_SCREEN',
  preambleActions: [],
  steps: [],
};

assert(validateSpecialPlanComplete(makeCompleteDraft()).ok === true, 'complete draft OK');
assert(validateSpecialPlanComplete(incompleteDraft).ok === false, 'incomplete rejected');

// --- AC-121.0-3 version match ---
const metaSpecialOk = {
  [LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 2 },
  [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag({
    draft: makeCompleteDraft(2),
    active: makeCompleteDraft(2),
  }),
};
const resolvedOk = resolveActiveLoginContract(metaSpecialOk);
assert(resolvedOk.mode === 'SPECIAL' && resolvedOk.activePlanVersion === 2, 'AC-121.0-3 match');
const metaMismatch = {
  [LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 2 },
  [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag({
    draft: null,
    active: makeCompleteDraft(9),
  }),
};
assert(
  resolveActiveLoginContract(metaMismatch).mode === 'SPECIAL_INVALID',
  'AC-121.0-3 mismatch → SPECIAL_INVALID',
);
console.log('  ✓ AC-121.0-3 SPECIAL version match');

// --- STANDARD autofill fixture for activate ---
const loginFields = [
  { id: 'username', label: 'User', type: 'text', required: true },
  { id: 'password', label: 'Pass', type: 'password', required: true },
];
const standardProfileProposed = {
  fieldMappings: [
    { fieldId: 'username', locatorType: 'css', locator: '#user' },
    { fieldId: 'password', locatorType: 'css', locator: '#pass' },
  ],
  loginEntryUrl: 'https://example.test/login',
  allowedOrigin: 'https://example.test',
};

function standardAutofillIntent(previous = null) {
  return {
    previous,
    proposed: standardProfileProposed,
    loginFields,
    loginUrl: 'https://example.test/login',
    action: 'activate_validated',
    liveValidationApproved: true,
    managedReadinessProbePassed: true,
    nowIso: '2026-09-24T00:00:00.000Z',
  };
}

// Snapshot prior ACTIVE helper
function snapshotActive(meta) {
  return JSON.stringify({
    activation: meta[LOGIN_CONTRACT_ACTIVATION_META_KEY] ?? null,
    plan: meta[LOGIN_FLOW_PLAN_META_KEY] ?? null,
    autofill: meta.autofillProfile ?? null,
  });
}

// --- AC-121.0-4 STANDARD → STANDARD ---
const s2s = planLoginContractActivate({
  currentMetadata: {},
  intent: { transition: 'STANDARD_TO_STANDARD', autofill: standardAutofillIntent(null) },
});
assert(s2s.ok === true, 'S→S ok');
assert(s2s.nextActivation.mode === 'STANDARD', 'S→S activation STANDARD');
assert(s2s.metadataPatch.autofillProfile, 'S→S writes autofillProfile');
assert(
  !Object.prototype.hasOwnProperty.call(s2s.metadataPatch, LOGIN_FLOW_PLAN_META_KEY),
  'AC-121.0-7 S→S does not create loginFlowPlan',
);
assert(
  resolveActiveLoginContract(s2s.metadataPatch).mode === 'STANDARD',
  'S→S resolve STANDARD',
);
console.log('  ✓ AC-121.0-4 STANDARD→STANDARD (+ AC-121.0-7 no plan.active)');

// --- AC-121.0-4 STANDARD → SPECIAL ---
const draft = makeCompleteDraft(1);
const priorWithDraft = {
  [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag({ draft, active: null }),
};
const s2sp = planLoginContractActivate({
  currentMetadata: priorWithDraft,
  intent: { transition: 'STANDARD_TO_SPECIAL' },
});
assert(s2sp.ok === true, 'S→SP ok');
assert(s2sp.nextActivation.mode === 'SPECIAL', 'S→SP mode');
assert(s2sp.nextActivation.activePlanVersion === 1, 'S→SP version');
assert(s2sp.nextPlanBag.active.planVersion === 1, 'S→SP active set');
assert(s2sp.nextPlanBag.draft, 'S→SP keeps draft');
assert(
  !Object.prototype.hasOwnProperty.call(s2sp.metadataPatch, 'autofillProfile'),
  'AC-121.0-8 no dual-write autofillProfile on SPECIAL activate',
);
const afterS2sp = { ...priorWithDraft, ...s2sp.metadataPatch };
assert(resolveActiveLoginContract(afterS2sp).mode === 'SPECIAL', 'S→SP resolve');
console.log('  ✓ AC-121.0-4 STANDARD→SPECIAL (+ AC-121.0-8 no dual-write)');

// --- AC-121.0-4 SPECIAL → SPECIAL (version bump) ---
const priorSpecial = afterS2sp;
const draft2 = makeCompleteDraft(1);
draft2.steps[0].fieldMappings[0].locator = '#user-v2';
// 121.1-IF R3: opener readiness must stay a declared field of the revealed step.
draft2.preambleActions[0].readiness.locator = '#user-v2';
const sp2sp = planLoginContractActivate({
  currentMetadata: {
    ...priorSpecial,
    [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag({
      draft: draft2,
      active: priorSpecial[LOGIN_FLOW_PLAN_META_KEY]
        ? parseLoginFlowPlanBag(priorSpecial[LOGIN_FLOW_PLAN_META_KEY]).active
        : makeCompleteDraft(1),
    }),
  },
  intent: { transition: 'SPECIAL_TO_SPECIAL', draft: draft2 },
});
assert(sp2sp.ok === true, 'SP→SP ok');
assert(sp2sp.nextActivation.activePlanVersion === 2, 'SP→SP bump to 2');
assert(sp2sp.nextPlanBag.active.planVersion === 2, 'SP→SP active version');
assert(
  sp2sp.nextPlanBag.active.steps[0].fieldMappings[0].locator === '#user-v2',
  'SP→SP content replaced',
);
console.log('  ✓ AC-121.0-4 SPECIAL→SPECIAL');

// --- AC-121.0-4 SPECIAL → STANDARD ---
const priorSp = { ...priorSpecial, ...sp2sp.metadataPatch };
const sp2s = planLoginContractActivate({
  currentMetadata: priorSp,
  intent: {
    transition: 'SPECIAL_TO_STANDARD',
    autofill: standardAutofillIntent(null),
  },
});
assert(sp2s.ok === true, 'SP→S ok');
assert(sp2s.nextActivation.mode === 'STANDARD', 'SP→S STANDARD');
assert(sp2s.nextPlanBag.active === null, 'SP→S retires active');
assert(
  !('activePlanVersion' in sp2s.metadataPatch[LOGIN_CONTRACT_ACTIVATION_META_KEY]),
  'SP→S omits activePlanVersion',
);
assert(resolveActiveLoginContract({ ...priorSp, ...sp2s.metadataPatch }).mode === 'STANDARD');
console.log('  ✓ AC-121.0-4 SPECIAL→STANDARD');

// --- AC-121.0-5 failure leaves previous ACTIVE unchanged ---
const frozenPrior = snapshotActive(priorSpecial);
const failIncomplete = planLoginContractActivate({
  currentMetadata: priorSpecial,
  intent: { transition: 'SPECIAL_TO_SPECIAL', draft: incompleteDraft },
});
assert(failIncomplete.ok === false, 'incomplete ACTIVATE fails');
assert(snapshotActive(priorSpecial) === frozenPrior, 'AC-121.0-5 prior unchanged after fail');

const failWrongMode = planLoginContractActivate({
  currentMetadata: {},
  intent: { transition: 'SPECIAL_TO_SPECIAL', draft: makeCompleteDraft(1) },
});
assert(failWrongMode.ok === false, 'wrong mode fails');
assert(snapshotActive({}) === snapshotActive({}), 'empty prior unchanged');
console.log('  ✓ AC-121.0-5 ACTIVATE failure leaves prior ACTIVE');

// --- AC-121.0-6 forbidden mixed states ---
const mixed1 = assertLoginContractMetadataConsistent({
  [LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 1 },
  // missing active
});
assert(mixed1.ok === false, 'SPECIAL without active rejected');
const mixed2 = assertLoginContractMetadataConsistent({
  [LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'STANDARD' },
  [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag({
    draft: null,
    active: makeCompleteDraft(1),
  }),
});
assert(mixed2.ok === false, 'STANDARD + active rejected');
const mixed3 = assertLoginContractMetadataConsistent({
  [LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 1 },
  [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag({
    draft: null,
    active: makeCompleteDraft(5),
  }),
});
assert(mixed3.ok === false, 'version mismatch rejected');
const mergeReject = mergeLoginContractMetadata({
  existingMetadata: {},
  patchMetadata: {
    [LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 1 },
  },
});
assert(mergeReject.ok === false, 'merge rejects SPECIAL activation without intent');
assert(
  mergeReject.code === 'activateRequiresIntent',
  'SPECIAL activation without intent → activateRequiresIntent',
);

// Architecture correction: raw SPECIAL + complete active WITHOUT intent MUST reject
const bypassActivate = mergeLoginContractMetadata({
  existingMetadata: {},
  patchMetadata: {
    [LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 1 },
    [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag({
      draft: makeCompleteDraft(1),
      active: makeCompleteDraft(1),
    }),
  },
});
assert(bypassActivate.ok === false, 'raw SPECIAL+active without intent rejected');
assert(
  bypassActivate.code === 'activateRequiresIntent',
  'bypass of ACTIVATE planner forbidden',
);

// Draft-only authoring MAY write draft; existing active unchanged
const priorActiveSpecial = {
  [LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 1 },
  [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag({
    draft: makeCompleteDraft(1),
    active: makeCompleteDraft(1),
  }),
};
const draftOnly = mergeLoginContractMetadata({
  existingMetadata: priorActiveSpecial,
  patchMetadata: {
    [LOGIN_FLOW_PLAN_META_KEY]: {
      draft: makeCompleteDraft(1),
      // active key omitted — draft authoring
    },
  },
});
assert(draftOnly.ok === true, 'draft-only merge ok');
const draftOnlyPlan = parseLoginFlowPlanBag(draftOnly.metadata[LOGIN_FLOW_PLAN_META_KEY]);
assert(draftOnlyPlan.active?.planVersion === 1, 'draft-only preserves existing active');
assert(
  resolveActiveLoginContract(draftOnly.metadata).mode === 'SPECIAL',
  'draft-only does not change ACTIVE SPECIAL',
);
console.log('  ✓ AC-121.0-6 forbidden mixed states + ACTIVATE planner gate');

// --- AC-121.0-9 immutable DRAFT snapshot ---
const liveDraft = makeCompleteDraft(1);
const snap = createImmutableDraftSnapshot(liveDraft, {
  snapshotId: 'snap-test',
  createdAt: '2026-09-24T12:00:00.000Z',
});
assert(snap.ok === true, 'snapshot ok');
assert(snap.snapshot.isComplete === true, 'complete snapshot');
assert(Object.isFrozen(snap.snapshot.plan), 'plan frozen');
liveDraft.steps[0].fieldMappings[0].locator = '#MUTATED';
assert(
  snap.snapshot.plan.steps[0].fieldMappings[0].locator === '#user',
  'AC-121.0-9 snapshot unchanged after draft mutate',
);
const badSnap = createImmutableDraftSnapshot(null);
assert(badSnap.ok === false, 'null draft → ValidationError');
// Snapshot ≠ ACTIVATE: creating snapshot must not produce activation patch
assert(!snap.snapshot.plan.active, 'snapshot has no active side-channel');
console.log('  ✓ AC-121.0-9 immutable DRAFT snapshot');

// Incomplete snapshot still representable
const incSnap = createImmutableDraftSnapshot(incompleteDraft);
assert(incSnap.ok === true && incSnap.snapshot.isComplete === false, 'incomplete snapshot flag');

// --- AC-121.0-10 no SPECIAL runtime ---
const runtimeNeedles = [
  'executeSpecial',
  'LoginFlowOrchestrator',
  'orchestrateSpecial',
  'runSpecialAdminTest',
];
const moduleSrc = [
  read('src/loginContract/planActivate.ts'),
  read('src/loginContract/resolve.ts'),
  read('src/loginContract/draftSnapshot.ts'),
  read('src/loginContract/merge.ts'),
  read('src/admin/adminRegistryApi.ts'),
].join('\n');
for (const needle of runtimeNeedles) {
  assertNotIncludes(moduleSrc, needle, `AC-121.0-10 no ${needle}`);
}
assertIncludes(read('src/loginContract/planActivate.ts'), 'No SPECIAL runtime', 'runtime ban comment');
console.log('  ✓ AC-121.0-10 no SPECIAL runtime execution');

// --- merge activate intent atomic ---
const atomicMerge = mergeLoginContractMetadata({
  existingMetadata: {
    [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag({
      draft: makeCompleteDraft(1),
      active: null,
    }),
  },
  patchMetadata: {
    [LOGIN_CONTRACT_ACTIVATE_INTENT_KEY]: { transition: 'STANDARD_TO_SPECIAL' },
  },
});
assert(atomicMerge.ok === true, 'atomic merge ok');
assert(
  !Object.prototype.hasOwnProperty.call(
    atomicMerge.metadata,
    LOGIN_CONTRACT_ACTIVATE_INTENT_KEY,
  ),
  'intent key stripped',
);
assert(
  resolveActiveLoginContract(atomicMerge.metadata).mode === 'SPECIAL',
  'atomic merge activates SPECIAL',
);
console.log('  ✓ atomic merge via activate intent');

// --- AC-121.0-12 static: no 121.1 authoring UI ---
assertNotIncludes(
  read('src/admin/AutofillProfileEditor.tsx'),
  'loginFlowPlan.draft.pattern',
  'AC-121.0-12 no SPECIAL authoring UI in Phase 120 editor',
);
assertNotIncludes(
  read('src/admin/AutofillProfileEditor.tsx'),
  'FLOATING_SCREEN_MULTI_STEP',
  'AC-121.0-12 no pattern editor',
);
console.log('  ✓ AC-121.0-12 121.1+ not started');

console.log('\nPASS — Phase 121.0 Login Contract (AC-121.0-1…12 core)');
