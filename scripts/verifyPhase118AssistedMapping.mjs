/**
 * Phase 118 — Assisted Mapping Agent verification (AC-118-1…26).
 * Usage: node scripts/verifyPhase118AssistedMapping.mjs
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

function fixturePage(overrides = {}) {
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    finalUrl: 'https://example.test/login',
    origin: 'https://example.test',
    inputs: [
      {
        inputId: 'in-1',
        tagName: 'input',
        type: 'text',
        idAttr: 'commercial',
        visible: true,
        editable: true,
        disabled: false,
        readOnly: false,
        locatorCandidates: [
          { strategy: 'css', locator: '#commercial', stabilityHint: 'id' },
        ],
      },
      {
        inputId: 'in-2',
        tagName: 'input',
        type: 'password',
        idAttr: 'password',
        visible: true,
        editable: true,
        disabled: false,
        readOnly: false,
        locatorCandidates: [
          { strategy: 'css', locator: '#password', stabilityHint: 'id' },
        ],
      },
    ],
    limits: { truncated: false, maxInputsApplied: 40 },
    ...overrides,
  };
}

async function loadModule() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-118-')), 'assisted.mjs');
  await build({
    entryPoints: [join(root, 'src/assistedMapping/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  return import(pathToFileURL(outfile).href);
}

async function main() {
  const bg = read('extension/background.js');
  const inspect = read('extension/generic/page-structure-inspect.js');
  const editor = read('src/admin/AutofillProfileEditor.tsx');
  const managed = read('src/execution/managedAutofill.ts');
  const pkgTypes = read('src/assistedMapping/types.ts');

  assert(bg.includes('ADMIN_LOGIN_PAGE_INSPECT'), 'AC-118 extension message registered');
  assert(bg.includes('openPageAndInspectLoginStructure'), 'AC-118 inspect orchestrator');
  assert(bg.includes("files: ['generic/page-structure-inspect.js']"), 'inspect script inject');
  assert(bg.includes('frameIds: [0]'), 'AC-118-3 top-document inspect');
  assert(!/credentials/.test(bg.slice(bg.indexOf('openPageAndInspectLoginStructure'), bg.indexOf('function openPageAndManagedAutofill'))), 'inspect path must not mention credentials payload');

  assert(inspect.includes('collectSafePageStructure'), 'inspect export');
  assert(!/\.value\b/.test(inspect), 'AC-118-2 never reads input values');
  assert(!/\bcookie\b/i.test(inspect), 'AC-118-2 no cookies');
  assert(!/document\.cookie/i.test(inspect), 'AC-118-2 no document.cookie');
  assert(inspect.includes('MAX_INPUTS'), 'hard cap inputs');

  assert(editor.includes('נתח דף כניסה') || editor.includes('ANALYZE_LOGIN_PAGE_LABEL_HE'), 'AC-118 Analyze CTA');
  assert(editor.includes('analyzeLoginPageForMapping'), 'Analyze wired');
  assert(editor.includes('NOT_CONFIDENTLY_MAPPED_LABEL_HE') || editor.includes('לא מופה בביטחון'), 'AC-118-8 badge');
  assert(editor.includes("data-action=\"analyze\""), 'analyze action');
  assert(!editor.includes('updateGlobalRegistryRow') || editor.includes('persist('), 'Save still via persist');
  // Analyze must not call updateGlobalRegistryRow directly
  const analyzeFn = editor.slice(
    editor.indexOf('requestAnalyzeLoginPage'),
    editor.indexOf('function requestClearMapping'),
  );
  assert(!analyzeFn.includes('updateGlobalRegistryRow'), 'AC-118-9 Analyze does not persist');
  assert(!analyzeFn.includes('activate_validated'), 'AC-118-16 Analyze does not validate');
  assert(!analyzeFn.includes('supportState'), 'AC-118-9 Analyze does not set supportState');

  assert(!managed.includes('assistedMapping'), 'AC-118-14 Managed runtime has no agent');
  assert(
    !managed.includes('MappingLlm') &&
      !managed.includes('openai') &&
      !managed.includes('anthropic') &&
      !managed.includes('propose-field-mappings'),
    'AC-118-14 no LLM/OpenAI in Managed',
  );

  assert(pkgTypes.includes("single_page_top"), 'capability enum');
  assert(pkgTypes.includes('propose_field_mappings'), 'task enum');
  assert(!/from ['"]openai|@anthropic|azure/i.test(read('src/assistedMapping/agentService.ts')), 'AC-118-5 no vendor in agentService');
  assert(!/from ['"]openai|@anthropic|azure/i.test(read('src/assistedMapping/mockProvider.ts')), 'AC-118-5 mock has no vendor');
  assert(
    !/api\.openai\.com|OPENAI_API_KEY|sk-/.test(read('src/assistedMapping/openaiRemoteProvider.ts')),
    'Hub remote provider must not embed OpenAI URL key or sk- secrets',
  );
  assert(
    read('src/assistedMapping/openaiRemoteProvider.ts').includes('functions.invoke'),
    'OpenAI path must go through Edge Function invoke',
  );
  assert(
    read('supabase/functions/propose-field-mappings/index.ts').includes('OPENAI_API_KEY'),
    'Edge Function reads OPENAI_API_KEY from server env',
  );
  assert(
    !read('supabase/functions/propose-field-mappings/index.ts').includes('VITE_'),
    'Edge Function must not use VITE_ secrets',
  );
  assert(
    read('src/assistedMapping/agentService.ts').includes('no_observed_inputs'),
    'AC-118-26 Hub short-circuit present',
  );
  assert(
    read('supabase/functions/propose-field-mappings/index.ts').includes('no_observed_inputs'),
    'AC-118-26 Edge zero-input guard present',
  );

  // No Rivhit hard-codes in assisted mapping product modules
  for (const rel of [
    'src/assistedMapping/types.ts',
    'src/assistedMapping/safetyValidation.ts',
    'src/assistedMapping/agentService.ts',
    'src/assistedMapping/analyzeLoginPage.ts',
  ]) {
    const src = read(rel);
    assert(!/online1\.rivhit|#osek\b/i.test(src), `AC-118-24 no Rivhit vocabulary in ${rel}`);
  }

  const mod = await loadModule();
  const {
    applySafetyAndConfidence,
    applyHighConfidencePrefill,
    MockMappingLlmProvider,
    proposeFieldMappings,
    INSPECTION_CAPABILITY_SINGLE_PAGE_TOP,
    AGENT_TASK_PROPOSE_FIELD_MAPPINGS,
  } = mod;

  assert(INSPECTION_CAPABILITY_SINGLE_PAGE_TOP === 'single_page_top', 'capability');
  assert(AGENT_TASK_PROPOSE_FIELD_MAPPINGS === 'propose_field_mappings', 'task');

  const schemaTax = [
    { fieldId: 'tax_id', label: 'Tax ID' },
    { fieldId: 'password', label: 'Password', type: 'password' },
  ];
  const schemaCustomer = [
    { fieldId: 'customer_number', label: 'Customer' },
    { fieldId: 'pin', label: 'PIN', type: 'password' },
  ];

  // AC-118-18 / AC-118-25 semantic non-lexical HIGH
  const semanticProvider = new MockMappingLlmProvider('semantic_non_lexical');
  const semanticRaw = await semanticProvider.proposeMappings({
    systemContractVersion: 't',
    inspectionCapability: 'single_page_top',
    agentTask: 'propose_field_mappings',
    schema: schemaTax,
    page: fixturePage(),
    constraints: { locatorType: 'css', requireExactOneCandidatePreference: true },
  });
  const semantic = applySafetyAndConfidence({
    requestId: 'r1',
    serviceId: 'svc-a',
    schema: schemaTax,
    page: fixturePage(),
    rawProposals: semanticRaw.proposals,
  });
  const taxHigh = semantic.proposals.find((p) => p.fieldId === 'tax_id');
  assert(taxHigh && taxHigh.confidence === 'high' && taxHigh.locator === '#commercial', 'AC-118-18 semantic HIGH');
  assert(taxHigh.evidence.some((e) => e.category === 'semantic_role_match'), 'semantic evidence');

  // AC-118-23 lexical
  const lexicalProvider = new MockMappingLlmProvider('lexical_exact');
  const lexicalRaw = await lexicalProvider.proposeMappings({
    systemContractVersion: 't',
    inspectionCapability: 'single_page_top',
    agentTask: 'propose_field_mappings',
    schema: [{ fieldId: 'password', label: 'Password' }],
    page: fixturePage(),
    constraints: { locatorType: 'css', requireExactOneCandidatePreference: true },
  });
  const lexical = applySafetyAndConfidence({
    requestId: 'r2',
    serviceId: 'svc-b',
    schema: [{ fieldId: 'password', label: 'Password' }],
    page: fixturePage(),
    rawProposals: lexicalRaw.proposals,
  });
  assert(
    lexical.proposals.some((p) => p.fieldId === 'password' && p.confidence === 'high'),
    'AC-118-23 lexical HIGH',
  );

  // AC-118-19 invented inputId
  const invIn = applySafetyAndConfidence({
    requestId: 'r3',
    serviceId: 'svc',
    schema: schemaTax,
    page: fixturePage(),
    rawProposals: [
      {
        fieldId: 'tax_id',
        observedInputId: 'invented-input-id',
        locator: '#commercial',
        modelConfidence: 'high',
        evidence: [{ category: 'semantic_role_match' }],
      },
    ],
  });
  assert(invIn.proposals.length === 0, 'AC-118-19 invented inputId rejected');
  assert(invIn.warnings?.includes('rejected_invented_inputId'), 'invented input warning');

  // AC-118-20 invented locator
  const invLoc = applySafetyAndConfidence({
    requestId: 'r4',
    serviceId: 'svc',
    schema: schemaTax,
    page: fixturePage(),
    rawProposals: [
      {
        fieldId: 'tax_id',
        observedInputId: 'in-1',
        locator: '#totally-invented',
        modelConfidence: 'high',
        evidence: [{ category: 'semantic_role_match' }],
      },
    ],
  });
  assert(invLoc.proposals.length === 0, 'AC-118-20 invented locator rejected');

  // AC-118-21 conflict
  const conflictProvider = new MockMappingLlmProvider('conflict');
  const conflictRaw = await conflictProvider.proposeMappings({
    systemContractVersion: 't',
    inspectionCapability: 'single_page_top',
    agentTask: 'propose_field_mappings',
    schema: schemaTax,
    page: fixturePage(),
    constraints: { locatorType: 'css', requireExactOneCandidatePreference: true },
  });
  const conflict = applySafetyAndConfidence({
    requestId: 'r5',
    serviceId: 'svc',
    schema: schemaTax,
    page: fixturePage(),
    rawProposals: conflictRaw.proposals,
  });
  assert(
    !conflict.proposals.some((p) => p.confidence === 'high'),
    'AC-118-21 conflict not silent HIGH',
  );

  // AC-118-22 ambiguous
  const ambProvider = new MockMappingLlmProvider('ambiguous');
  const ambPage = fixturePage({
    inputs: [
      {
        inputId: 'in-a',
        tagName: 'input',
        type: 'text',
        idAttr: 'a',
        visible: true,
        editable: true,
        disabled: false,
        readOnly: false,
        locatorCandidates: [{ strategy: 'css', locator: '#a', stabilityHint: 'id' }],
      },
      {
        inputId: 'in-b',
        tagName: 'input',
        type: 'text',
        idAttr: 'b',
        visible: true,
        editable: true,
        disabled: false,
        readOnly: false,
        locatorCandidates: [{ strategy: 'css', locator: '#b', stabilityHint: 'id' }],
      },
    ],
  });
  const ambRaw = await ambProvider.proposeMappings({
    systemContractVersion: 't',
    inspectionCapability: 'single_page_top',
    agentTask: 'propose_field_mappings',
    schema: [{ fieldId: 'customer_number', label: 'Customer' }],
    page: ambPage,
    constraints: { locatorType: 'css', requireExactOneCandidatePreference: true },
  });
  const amb = applySafetyAndConfidence({
    requestId: 'r6',
    serviceId: 'svc-c',
    schema: [{ fieldId: 'customer_number', label: 'Customer' }],
    page: ambPage,
    rawProposals: ambRaw.proposals,
  });
  assert(
    !amb.proposals.some((p) => p.confidence === 'high'),
    'AC-118-22 ambiguous remains non-HIGH',
  );

  // Prefill only HIGH / empty uncertain
  const prefill = applyHighConfidencePrefill(
    { tax_id: '', password: '' },
    semantic,
  );
  assert(prefill.next.tax_id === '#commercial', 'AC-118-7 HIGH prefill');
  const mediumOnly = applyHighConfidencePrefill(
    { tax_id: '' },
    {
      ...semantic,
      proposals: [{ ...taxHigh, confidence: 'medium' }],
    },
  );
  assert(mediumOnly.next.tax_id === '', 'AC-118-8 medium not prefilled');

  // AC-118-15 genericity second schema
  const gen = await proposeFieldMappings({
    requestId: 'r7',
    serviceId: 'svc-gen',
    schema: schemaCustomer,
    page: fixturePage({
      inputs: [
        {
          inputId: 'in-1',
          tagName: 'input',
          type: 'text',
          idAttr: 'customer_number',
          visible: true,
          editable: true,
          disabled: false,
          readOnly: false,
          locatorCandidates: [
            { strategy: 'css', locator: '#customer_number', stabilityHint: 'id' },
          ],
        },
        {
          inputId: 'in-2',
          tagName: 'input',
          type: 'password',
          idAttr: 'pin',
          visible: true,
          editable: true,
          disabled: false,
          readOnly: false,
          locatorCandidates: [{ strategy: 'css', locator: '#pin', stabilityHint: 'id' }],
        },
      ],
    }),
    provider: new MockMappingLlmProvider('lexical_exact'),
  });
  assert(
    gen.proposals.filter((p) => p.confidence === 'high').length >= 1,
    'AC-118-15 second schema works',
  );

  // AC-118-11 empty / no confident
  const empty = applySafetyAndConfidence({
    requestId: 'r8',
    serviceId: 'svc',
    schema: schemaTax,
    page: fixturePage(),
    rawProposals: [],
  });
  assert(empty.status === 'no_confident_mapping', 'AC-118-11 no_confident_mapping');

  // AC-118-6 unknown field dropped
  const badField = applySafetyAndConfidence({
    requestId: 'r9',
    serviceId: 'svc',
    schema: schemaTax,
    page: fixturePage(),
    rawProposals: [
      {
        fieldId: 'not_in_schema',
        observedInputId: 'in-1',
        locator: '#commercial',
        modelConfidence: 'high',
        evidence: [{ category: 'semantic_role_match' }],
      },
    ],
  });
  assert(badField.proposals.length === 0, 'AC-118-6 unknown fieldId dropped');

  // modelConfidence high alone still needs safety — already covered by invented cases
  // AC-118-12 error leaves empty proposals
  const timed = applySafetyAndConfidence({
    requestId: 'r10',
    serviceId: 'svc',
    schema: schemaTax,
    page: fixturePage(),
    rawProposals: [],
    errorCode: 'timeout',
  });
  assert(timed.status === 'error' && timed.proposals.length === 0, 'AC-118-12 timeout error');

  // AC-118-26 / D-118-14 — empty inputs: zero provider invocations
  let providerCalls = 0;
  const countingProvider = {
    async proposeMappings() {
      providerCalls += 1;
      return {
        proposals: [
          {
            fieldId: 'tax_id',
            observedInputId: 'invented',
            locator: '#x',
            modelConfidence: 'high',
            evidence: [{ category: 'semantic_role_match' }],
          },
        ],
      };
    },
  };
  const emptyPage = fixturePage({ inputs: [] });
  const zeroInput = await proposeFieldMappings({
    requestId: 'r-empty',
    serviceId: 'svc-empty',
    schema: schemaTax,
    page: emptyPage,
    provider: countingProvider,
  });
  assert(providerCalls === 0, 'AC-118-26 provider invocation count must be 0');
  assert(zeroInput.status === 'no_confident_mapping', 'AC-118-26 closed status');
  assert(zeroInput.proposals.length === 0, 'AC-118-26 zero proposals');
  assert(zeroInput.unmappedFieldIds.length === 2, 'AC-118-26 all fields unmapped');
  assert(
    Array.isArray(zeroInput.warnings) && zeroInput.warnings.includes('no_observed_inputs'),
    'AC-118-26 warning no_observed_inputs',
  );

  // Non-empty path still invokes provider (regression)
  providerCalls = 0;
  const nonEmpty = await proposeFieldMappings({
    requestId: 'r-nonempty',
    serviceId: 'svc-nonempty',
    schema: schemaTax,
    page: fixturePage(),
    provider: countingProvider,
  });
  assert(providerCalls === 1, 'non-empty path still calls provider once');
  assert(
    nonEmpty.status === 'no_confident_mapping' && nonEmpty.proposals.length === 0,
    'non-empty invented proposals still rejected by unchanged safety',
  );

  console.log('verifyPhase118AssistedMapping: PASS');
}

main().catch((err) => {
  console.error('verifyPhase118AssistedMapping: FAIL');
  console.error(err);
  process.exit(1);
});
