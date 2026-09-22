/**
 * Phase 120.8 — Identity decoupling + Section 20 MEDIUM prefill + fieldAuthoring.
 * Evidence matrix A–K.
 * Usage: node scripts/verifyPhase120IdentityAuthoring.mjs
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
  const outfile = join(mkdtempSync(join(tmpdir(), `pv-1208-${name}-`)), `${name}.mjs`);
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

console.log('Phase 120.8 — Identity / MEDIUM / fieldAuthoring verification\n');

const mockSrc = read('src/assistedMapping/mockProvider.ts');
const promptSrc = read('supabase/functions/propose-field-mappings/index.ts');
const safetySrc = read('src/assistedMapping/safetyValidation.ts');
const editorSrc = read('src/admin/AutofillProfileEditor.tsx');
const profileSrc = read('src/autofill/validatedProfile.ts');
const typesSrc = read('src/assistedMapping/types.ts');
const modelSrc = read('src/service/serviceModel.ts');
const authoringSrc = read('src/assistedMapping/fieldAuthoring.ts');

// Identity decoupling static
assertIncludes(typesSrc, 'description?: string', 'CredentialSchemaField description');
assertIncludes(modelSrc, 'description?: string', 'LoginField description');
assertIncludes(promptSrc, 'opaque persistence key', 'prompt opaque fieldId');
assertIncludes(promptSrc, 'NEVER infer meaning from fieldId', 'prompt no fieldId meaning');
assertNotIncludes(mockSrc, '/password|secret|pin|סיסמ/i.test(field.fieldId)', 'mock no fieldId password regex');
assertIncludes(mockSrc, "field.type === 'password'", 'mock password from type');
assertIncludes(mockSrc, 'label_affinity', 'mock label affinity');
assertIncludes(safetySrc, "row.confidence !== 'high' && row.confidence !== 'medium'", 'Section 20 prefill');
assertIncludes(editorSrc, 'ביטחון בינוני', 'MEDIUM Hebrew UI');
assertIncludes(editorSrc, 'admin-autofill-chip-medium', 'MEDIUM color class');
assertIncludes(editorSrc, 'fieldAuthoring', 'editor fieldAuthoring');
assertIncludes(profileSrc, 'fieldAuthoring', 'profile fieldAuthoring');
assertIncludes(profileSrc, 'fieldAuthoring intentionally omitted', 'clear clears authoring');
assertIncludes(authoringSrc, 'visualTargetsEquivalent', 'E1/E3 SAME-target helper');
assertIncludes(authoringSrc, 'E2 (current ∈ visualLocatorCandidates) removed', '120.9 E2 removed');
assert(!/\bshufersal\b|\bserviceId\s*===|\bhostname\s*===/i.test(mockSrc + safetySrc + authoringSrc), 'no site branches');

const assisted = await loadModule('src/assistedMapping/safetyValidation.ts', 'safety');
const authoring = await loadModule('src/assistedMapping/fieldAuthoring.ts', 'authoring');
const profile = await loadModule('src/autofill/validatedProfile.ts', 'profile');
const mock = await loadModule('src/assistedMapping/mockProvider.ts', 'mock');

const origin = 'https://blind.example.test';
const pagePos = {
  schemaVersion: 1,
  capturedAt: '2026-01-01T00:00:00.000Z',
  finalUrl: `${origin}/login`,
  origin,
  inputs: [
    {
      inputId: 'obs-user',
      tagName: 'input',
      type: 'text',
      idAttr: 'commercial-login',
      visible: true,
      managedEligible: true,
      editable: true,
      disabled: false,
      readOnly: false,
      associatedLabelText: 'שם משתמש',
      locatorCandidates: [{ strategy: 'css', locator: '#commercial-login', stabilityHint: 'id', matchCount: 1 }],
    },
    {
      inputId: 'obs-pass',
      tagName: 'input',
      type: 'password',
      idAttr: 'secret-box',
      visible: true,
      managedEligible: true,
      editable: true,
      disabled: false,
      readOnly: false,
      associatedLabelText: 'סיסמה',
      locatorCandidates: [{ strategy: 'css', locator: '#secret-box', stabilityHint: 'id', matchCount: 1 }],
    },
    {
      inputId: 'obs-biz',
      tagName: 'input',
      type: 'text',
      idAttr: 'acct-ref',
      visible: true,
      managedEligible: true,
      editable: true,
      disabled: false,
      readOnly: false,
      associatedLabelText: 'מספר עוסק',
      nearbySafeText: 'business account',
      locatorCandidates: [{ strategy: 'css', locator: '#acct-ref', stabilityHint: 'id', matchCount: 1 }],
    },
  ],
  limits: { truncated: false, maxInputsApplied: 40 },
};

const schemaPos = [
  { fieldId: 'credential_a', label: 'שם משתמש', type: 'text' },
  { fieldId: 'credential_b', label: 'סיסמה', type: 'password' },
  {
    fieldId: 'credential_c',
    label: 'מזהה עסקי',
    type: 'text',
    description: 'מספר עוסק / business account',
  },
];

// A/B — applySafety with scripted HIGH + MEDIUM (opaque IDs, no fieldId lexical)
const proposalPos = assisted.applySafetyAndConfidence({
  requestId: 'r-pos',
  serviceId: 'svc-blind',
  schema: schemaPos,
  page: pagePos,
  rawProposals: [
    {
      fieldId: 'credential_a',
      observedInputId: 'obs-user',
      locator: '#commercial-login',
      modelConfidence: 'high',
      evidence: [{ category: 'label_affinity' }],
    },
    {
      fieldId: 'credential_b',
      observedInputId: 'obs-pass',
      locator: '#secret-box',
      modelConfidence: 'high',
      evidence: [{ category: 'type_affinity' }],
    },
    {
      fieldId: 'credential_c',
      observedInputId: 'obs-biz',
      locator: '#acct-ref',
      modelConfidence: 'medium',
      evidence: [{ category: 'label_affinity' }],
    },
  ],
});
assert(
  proposalPos.proposals.find((p) => p.fieldId === 'credential_a')?.confidence === 'high',
  'A HIGH preserved',
);
assert(
  proposalPos.proposals.find((p) => p.fieldId === 'credential_c')?.confidence === 'medium',
  'B MEDIUM preserved',
);
const prefill = assisted.applyConfidentPrefill({}, proposalPos);
assert(prefill.next.credential_a === '#commercial-login', 'A HIGH prefill');
assert(prefill.next.credential_c === '#acct-ref', 'B MEDIUM prefill');
assert(prefill.appliedFieldIds.includes('credential_c'), 'B MEDIUM applied');

// Persist authoring + refresh reconstruct
const saved = profile.planAutofillProfileWrite({
  previous: null,
  proposed: {
    fieldMappings: [
      { fieldId: 'credential_a', locatorType: 'css', locator: '#commercial-login' },
      { fieldId: 'credential_b', locatorType: 'css', locator: '#secret-box' },
      { fieldId: 'credential_c', locatorType: 'css', locator: '#acct-ref' },
    ],
    loginEntryUrl: `${origin}/login`,
    allowedOrigin: origin,
    fieldAuthoring: [
      {
        fieldId: 'credential_a',
        source: 'analyze',
        confidence: 'high',
        observedInputId: 'obs-user',
        visualMappingVerified: false,
      },
      {
        fieldId: 'credential_c',
        source: 'analyze',
        confidence: 'medium',
        observedInputId: 'obs-biz',
        visualMappingVerified: false,
      },
    ],
  },
  loginFields: schemaPos.map((f) => ({
    id: f.fieldId,
    label: f.label,
    type: f.type,
    description: f.description,
  })),
  action: 'save',
});
assert(saved.ok === true, 'save with fieldAuthoring ok');
assert(
  saved.profile.fieldAuthoring?.find((r) => r.fieldId === 'credential_a')?.confidence === 'high',
  'A persisted HIGH fact',
);
assert(
  saved.profile.fieldAuthoring?.find((r) => r.fieldId === 'credential_c')?.confidence === 'medium',
  'B persisted MEDIUM fact',
);
const reloaded = profile.parseAutofillProfile(profile.serializeAutofillProfile(saved.profile));
assert(
  reloaded.fieldAuthoring?.find((r) => r.fieldId === 'credential_c')?.confidence === 'medium',
  'A/B refresh reconstructs MEDIUM',
);
console.log('  ✓ A / B Blind-ID HIGH+MEDIUM prefill + persist/refresh');

// C LOW — no prefill
const lowOnly = assisted.applyConfidentPrefill(
  {},
  assisted.applySafetyAndConfidence({
    requestId: 'r-low',
    serviceId: 'svc',
    schema: schemaPos,
    page: pagePos,
    rawProposals: [
      {
        fieldId: 'credential_a',
        observedInputId: 'obs-user',
        locator: '#commercial-login',
        modelConfidence: 'low',
        evidence: [{ category: 'other_structured' }],
      },
    ],
  }),
);
assert(Object.keys(lowOnly.next).length === 0, 'C LOW no prefill');
assert(lowOnly.appliedFieldIds.length === 0, 'C LOW not applied');
console.log('  ✓ C LOW/rejected no prefill');

// D SAME visual
const same = authoring.visualTargetsEquivalent({
  currentLocator: '#acct-ref',
  currentObservedInputId: 'obs-biz',
  visualLocator: '#acct-ref-alt',
  visualObservedInputId: 'obs-biz',
  visualLocatorCandidates: ['#acct-ref', '#acct-ref-alt'],
});
assert(same === true, 'D E1 SAME');
const e2alone = authoring.visualTargetsEquivalent({
  currentLocator: '#acct-ref',
  currentObservedInputId: 'obs-other',
  visualLocator: '#acct-ref-alt',
  visualObservedInputId: 'obs-biz',
  visualLocatorCandidates: ['#acct-ref', '#acct-ref-alt'],
});
assert(e2alone === false, 'D E2 alone is NOT SAME (120.9)');
const afterSame = authoring.applyVisualMappingAuthoring({
  current: [
    {
      fieldId: 'credential_c',
      source: 'analyze',
      confidence: 'medium',
      observedInputId: 'obs-biz',
      visualMappingVerified: false,
    },
  ],
  fieldId: 'credential_c',
  sameTarget: true,
  previous: {
    fieldId: 'credential_c',
    source: 'analyze',
    confidence: 'medium',
    observedInputId: 'obs-biz',
    visualMappingVerified: false,
  },
  visualObservedInputId: 'obs-biz',
});
assert(afterSame[0].visualMappingVerified === true, 'D visualMappingVerified');
assert(afterSame[0].confidence === 'medium', 'D MEDIUM retained on SAME');
console.log('  ✓ D Visual SAME keeps MEDIUM + verified');

// E DIFFERENT
const afterDiff = authoring.applyVisualMappingAuthoring({
  current: afterSame,
  fieldId: 'credential_c',
  sameTarget: false,
  previous: afterSame[0],
  visualObservedInputId: 'obs-other',
});
assert(afterDiff[0].source === 'visual_mapping', 'E source visual');
assert(afterDiff[0].confidence === null, 'E stale MEDIUM cleared');
console.log('  ✓ E Visual DIFFERENT clears AI confidence');

// F manual
const afterManual = authoring.markManualEdit(afterSame, 'credential_c');
assert(afterManual[0].source === 'manual', 'F manual source');
assert(afterManual[0].confidence === null, 'F AI cleared');
console.log('  ✓ F manual edit clears AI attribution');

// G Admin Test success — no MEDIUM→HIGH; configVersion bind
const stamped = authoring.stampAdminTestPassed(
  [
    {
      fieldId: 'credential_c',
      source: 'analyze',
      confidence: 'medium',
      visualMappingVerified: false,
    },
  ],
  ['credential_c'],
  5,
);
assert(stamped[0].confidence === 'medium', 'G no MEDIUM→HIGH');
assert(stamped[0].adminTestPassedAtConfigVersion === 5, 'G stamp configVersion');
assert(authoring.adminTestSuccessVisible(stamped[0], 5) === true, 'G visible at match');
assert(authoring.adminTestSuccessVisible(stamped[0], 6) === false, 'G stale after bump');
console.log('  ✓ G Admin Test fact independent; stale on configVersion');

// H Clear Mapping removes authoring
const cleared = profile.planAutofillProfileWrite({
  previous: saved.profile,
  proposed: { fieldMappings: [] },
  loginFields: schemaPos.map((f) => ({ id: f.fieldId, label: f.label, type: f.type })),
  action: 'clear_managed_mappings',
});
assert(cleared.ok === true, 'H clear ok');
assert(cleared.profile.fieldMappings.length === 0, 'H mappings empty');
assert(cleared.profile.fieldAuthoring === undefined, 'H authoring omitted');
console.log('  ✓ H Clear Mapping clears fieldAuthoring');

// I Authority — no auto validate in authoring helpers / editor clear path
assertNotIncludes(editorSrc, "supportState: 'validated'", 'I editor no silent validated');
assertIncludes(editorSrc, 'activate_validated', 'I activate remains explicit');

// J NEG Blind-ID — ambiguous identical labels → mock default should not invent via fieldId
const pageNeg = {
  ...pagePos,
  inputs: [
    {
      inputId: 'i1',
      tagName: 'input',
      type: 'text',
      idAttr: 'x1',
      visible: true,
      managedEligible: true,
      editable: true,
      disabled: false,
      readOnly: false,
      associatedLabelText: 'שדה',
      locatorCandidates: [{ strategy: 'css', locator: '#x1', stabilityHint: 'id', matchCount: 1 }],
    },
    {
      inputId: 'i2',
      tagName: 'input',
      type: 'text',
      idAttr: 'x2',
      visible: true,
      managedEligible: true,
      editable: true,
      disabled: false,
      readOnly: false,
      associatedLabelText: 'שדה',
      locatorCandidates: [{ strategy: 'css', locator: '#x2', stabilityHint: 'id', matchCount: 1 }],
    },
  ],
};
const schemaNeg = [
  { fieldId: 'opaque_1', label: 'שדה', type: 'text' },
  { fieldId: 'opaque_2', label: 'שדה', type: 'text' },
];
const negProvider = new mock.MockMappingLlmProvider('default');
const negRaw = await negProvider.proposeMappings({
  systemContractVersion: 'phase118-v1',
  inspectionCapability: 'single_page_top',
  agentTask: 'propose_field_mappings',
  schema: schemaNeg,
  page: pageNeg,
  constraints: { locatorType: 'css', requireExactOneCandidatePreference: true },
});
const negSafe = assisted.applySafetyAndConfidence({
  requestId: 'r-neg',
  serviceId: 'svc-neg',
  schema: schemaNeg,
  page: pageNeg,
  rawProposals: negRaw.proposals,
});
const negPrefill = assisted.applyConfidentPrefill({}, negSafe);
// Ambiguous identical labels: uniqueness path should not invent HIGH for both;
// default mock only fills when remainingFields.length===1.
assert(negPrefill.appliedFieldIds.length === 0, 'J no prefill on ambiguous identical labels');
assert(
  !negRaw.proposals.some(
    (p) =>
      p.evidence?.some((e) => e.category === 'id_name_affinity') &&
      pageNeg.inputs.some((i) => i.idAttr === p.fieldId),
  ),
  'J no fieldId===DOM id affinity',
);
console.log('  ✓ J NEG Blind-ID no fieldId lexical invention');

// K regression notes — clear/120.7 still present; runtime ignores authoring
assertIncludes(profileSrc, 'clear_managed_mappings', 'K 120.7 clear retained');
assertIncludes(read('src/execution/managedAutofill.ts'), 'fieldMappings', 'K runtime uses mappings');
assertNotIncludes(read('src/execution/managedAutofill.ts'), 'fieldAuthoring', 'K runtime ignores authoring');

console.log('  ✓ I / K authority + regressions');
console.log('\nPASS — Phase 120.8 Identity / MEDIUM / fieldAuthoring (A–K)');
