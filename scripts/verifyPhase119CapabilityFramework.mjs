/**
 * Phase 119.1 — Login Experience capability framework verification.
 * Usage: node scripts/verifyPhase119CapabilityFramework.mjs
 */
import { mkdtempSync, readFileSync } from 'node:fs';
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
        managedEligible: true,
        editable: true,
        disabled: false,
        readOnly: false,
        locatorCandidates: [
          { strategy: 'css', locator: '#commercial', stabilityHint: 'id', matchCount: 1 },
        ],
      },
    ],
    limits: { truncated: false, maxInputsApplied: 40 },
    ...overrides,
  };
}

async function loadModule() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-119-')), 'assisted.mjs');
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
  const capsSrc = read('src/assistedMapping/capabilities.ts');
  assert(
    capsSrc.includes('LOGIN_EXPERIENCE_CAPABILITY_CATALOG'),
    'AC-119.1-1 catalog constant',
  );
  assert(
    capsSrc.includes('SUPPORTED_INSPECTION_CAPABILITIES'),
    'AC-119.1-1 supported set',
  );
  // AC-119.1-5 — no host/service branching. Field name `serviceId` on proposal
  // pass-through is allowed; reject hostname checks and service-specific ids.
  assert(
    !/\bhostname\b|\bhapoalim\b|\bclalit\b|\bbankhapoalim\b/i.test(capsSrc),
    'AC-119.1-5 no host/service-specific ids in capabilities',
  );
  assert(
    !/if\s*\([^)]*serviceId|switch\s*\([^)]*serviceId|serviceId\s*===|serviceId\s*!==/i.test(
      capsSrc,
    ),
    'AC-119.1-5 no serviceId branching in capabilities',
  );

  const edge = read('supabase/functions/propose-field-mappings/index.ts');
  assert(
    edge.includes("reason: 'unsupported_capability'"),
    'AC-119.1-2 Edge unsupported_capability',
  );

  const mod = await loadModule();
  const {
    LOGIN_EXPERIENCE_CAPABILITY_CATALOG,
    SUPPORTED_INSPECTION_CAPABILITIES,
    isSupportedInspectionCapability,
    resolveInspectionCapability,
    proposeFieldMappings,
    INSPECTION_CAPABILITY_SINGLE_PAGE_TOP,
  } = mod;

  assert(
    Array.isArray(LOGIN_EXPERIENCE_CAPABILITY_CATALOG) &&
      LOGIN_EXPERIENCE_CAPABILITY_CATALOG.includes('single_page_top') &&
      LOGIN_EXPERIENCE_CAPABILITY_CATALOG.includes('visual_target_selection'),
    'AC-119.1-1 catalog lists shipped + reserved',
  );
  assert(
    SUPPORTED_INSPECTION_CAPABILITIES.length === 1 &&
      SUPPORTED_INSPECTION_CAPABILITIES[0] === 'single_page_top',
    'AC-119.1-1 only single_page_top supported in 119.1',
  );
  assert(
    isSupportedInspectionCapability(INSPECTION_CAPABILITY_SINGLE_PAGE_TOP),
    'AC-119.1-3 single_page_top supported',
  );
  assert(
    !isSupportedInspectionCapability('same_origin_frame_inspect'),
    'AC-119.1-2 reserved capability not supported yet',
  );
  assert(
    resolveInspectionCapability('visual_target_selection').ok === false,
    'AC-119.1-2 resolve fails closed for reserved',
  );

  const schema = [
    { fieldId: 'tax_id', label: 'Tax ID' },
    { fieldId: 'password', label: 'Password', type: 'password' },
  ];

  let providerCalls = 0;
  const countingProvider = {
    async proposeMappings() {
      providerCalls += 1;
      return { proposals: [] };
    },
  };

  // AC-119.1-2 unsupported → zero provider calls
  providerCalls = 0;
  const unsupported = await proposeFieldMappings({
    requestId: 'r-unsup',
    serviceId: 'svc',
    schema,
    page: fixturePage(),
    provider: countingProvider,
    inspectionCapability: 'same_origin_frame_inspect',
  });
  assert(providerCalls === 0, 'AC-119.1-2 providerCalls === 0 for unsupported');
  assert(unsupported.status === 'error', 'AC-119.1-2 status error');
  assert(
    unsupported.errorCode === 'unsupported_capability',
    'AC-119.1-2 errorCode unsupported_capability',
  );

  // AC-119.1-3 supported path still invokes provider
  providerCalls = 0;
  await proposeFieldMappings({
    requestId: 'r-ok',
    serviceId: 'svc',
    schema,
    page: fixturePage(),
    provider: countingProvider,
    inspectionCapability: 'single_page_top',
  });
  assert(providerCalls === 1, 'AC-119.1-3 single_page_top still calls provider');

  // AC-119.1-4 D-118-14 preserved with default capability
  providerCalls = 0;
  const empty = await proposeFieldMappings({
    requestId: 'r-empty',
    serviceId: 'svc',
    schema,
    page: fixturePage({ inputs: [] }),
    provider: countingProvider,
  });
  assert(providerCalls === 0, 'AC-119.1-4 empty inputs still no provider');
  assert(
    empty.status === 'no_confident_mapping',
    'AC-119.1-4 empty closed status',
  );

  console.log('verifyPhase119CapabilityFramework: PASS');
}

main().catch((err) => {
  console.error('verifyPhase119CapabilityFramework: FAIL');
  console.error(err);
  process.exit(1);
});
