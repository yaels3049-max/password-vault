/**
 * Phase 120.7 — Clear Managed Mapping Persistence (C1–C9).
 * Usage: node scripts/verifyPhase120ClearManagedMappings.mjs
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

async function loadContract() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-1207-')), 'validatedProfile.mjs');
  await build({
    entryPoints: [join(root, 'src/autofill/validatedProfile.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
  });
  return import(pathToFileURL(outfile).href);
}

console.log('Phase 120.7 — Clear Managed Mapping Persistence verification\n');

const profileSrc = read('src/autofill/validatedProfile.ts');
const editorSrc = read('src/admin/AutofillProfileEditor.tsx');

assertIncludes(profileSrc, "'clear_managed_mappings'", 'action clear_managed_mappings');
assertIncludes(editorSrc, "persist('clear_managed_mappings')", 'editor Save-on-empty → clear');
assertIncludes(editorSrc, 'fieldMappings: []', 'clear payload forces empty mappings');
assertIncludes(
  editorSrc,
  'מיפויי המילוי האוטומטי הוסרו מהגדרת השירות',
  'honest persist-success copy',
);
assertIncludes(editorSrc, 'יש ללחוץ «שמור מיפוי»', 'Clear confirms Save required (P1)');
assertIncludes(editorSrc, 'מילוי מנוהל בבית הדיגיטלי יופסק', 'validated stronger confirm');
assertNotIncludes(editorSrc, 'לא ניתן לשמור מיפוי ריק במצב מאומת', 'validated empty no longer blocked');
assert(!/\bshufersal\b|\b#UserName\b|\bserviceId\s*===/i.test(profileSrc), 'C5 no site branches in plan');
assert(!/\bshufersal\b|\bserviceId\s*===/i.test(editorSrc), 'C5 no site branches in editor');
const persistFn = editorSrc.slice(
  editorSrc.indexOf('async function persist('),
  editorSrc.indexOf('return (', editorSrc.indexOf('async function persist(')),
);
assertNotIncludes(persistFn, 'vault', 'C3 no vault in persist');
assertNotIncludes(persistFn, 'login_fields', 'C7 schema not mutated in persist payload');

const mod = await loadContract();
const httpsLogin = 'https://fixture.example.test/login';
const origin = 'https://fixture.example.test';
const fields = [
  { id: 'username', label: 'User', type: 'text', required: true },
  { id: 'password', label: 'Pass', type: 'password', required: true },
];
const mappings = [
  { fieldId: 'username', locatorType: 'css', locator: '#user' },
  { fieldId: 'password', locatorType: 'css', locator: '#pass' },
];

const candidatePrev = {
  supportState: 'not_configured',
  configVersion: 3,
  loginEntryUrl: httpsLogin,
  allowedOrigin: origin,
  fieldMappings: mappings,
};

// --- C1: clear → fieldMappings [] ---
const clearCandidate = mod.planAutofillProfileWrite({
  previous: candidatePrev,
  proposed: { fieldMappings: [], loginEntryUrl: httpsLogin, allowedOrigin: origin },
  loginFields: fields,
  action: 'clear_managed_mappings',
});
assert(clearCandidate.ok === true, 'C1 clear plan ok');
assert(Array.isArray(clearCandidate.profile.fieldMappings), 'C1 fieldMappings array');
assert(clearCandidate.profile.fieldMappings.length === 0, 'C1 fieldMappings empty');
assert(clearCandidate.profile.supportState === 'not_configured', 'C1/C9 supportState not_configured');
assert(clearCandidate.profile.validation === undefined, 'C1 validation deleted');
assert(clearCandidate.profile.configVersion === 4, 'C1 configVersion bumped');
assert(clearCandidate.profile.loginEntryUrl === httpsLogin, 'C1 retain loginEntryUrl');
assert(clearCandidate.profile.allowedOrigin === origin, 'C1 retain allowedOrigin');
console.log('  ✓ C1 / C9 candidate clear → fieldMappings [] + not_configured');

// --- Structural empty still blocks normal save ---
const emptySave = mod.planAutofillProfileWrite({
  previous: candidatePrev,
  proposed: {
    fieldMappings: [
      { fieldId: 'username', locatorType: 'css', locator: '' },
      { fieldId: 'password', locatorType: 'css', locator: '' },
    ],
    loginEntryUrl: httpsLogin,
    allowedOrigin: origin,
  },
  loginFields: fields,
  action: 'save',
});
assert(emptySave.ok === false, 'normal save still rejects empty locators');
console.log('  ✓ AC-120.7-DD-4: save structural empty still rejected; clear bypasses');

// --- C2: validated clear ---
const validatedPrev = {
  supportState: 'validated',
  configVersion: 7,
  loginEntryUrl: httpsLogin,
  allowedOrigin: origin,
  fieldMappings: mappings,
  validation: {
    metadataVersion: 7,
    validatedAt: '2026-01-01T00:00:00.000Z',
    validatedBy: 'admin',
    resultSummary: 'managed_readiness_ok',
  },
};
const clearValidated = mod.planAutofillProfileWrite({
  previous: validatedPrev,
  proposed: { fieldMappings: [], loginEntryUrl: httpsLogin, allowedOrigin: origin },
  loginFields: fields,
  action: 'clear_managed_mappings',
});
assert(clearValidated.ok === true, 'C2 clear validated ok');
assert(clearValidated.profile.fieldMappings.length === 0, 'C2 mappings empty');
assert(clearValidated.profile.supportState === 'not_configured', 'C2 not validated');
assert(clearValidated.profile.validation === undefined, 'C2 validation wiped');
assert(clearValidated.profile.configVersion === 8, 'C2 configVersion bump');

const eligibleAfter = mod.isManagedAutofillEligible({
  metadata: {
    credentialMode: 'credential_fields',
    autofillProfile: mod.serializeAutofillProfile(clearValidated.profile),
  },
  loginFields: fields,
  credential: { username: 'a', password: 'b' },
});
assert(eligibleAfter === false, 'C2 Digital Home Managed not eligible after clear');
console.log('  ✓ C2 validated clear → not_configured + eligibility false');

// reset_not_configured still cannot wipe validated (legacy path)
const resetValidated = mod.planAutofillProfileWrite({
  previous: validatedPrev,
  proposed: validatedPrev,
  loginFields: fields,
  action: 'reset_not_configured',
});
assert(resetValidated.ok === false, 'legacy reset still blocked on validated');

// --- unsupported clear → not_configured + [] ---
const unsupportedPrev = {
  ...candidatePrev,
  supportState: 'unsupported',
  configVersion: 2,
};
const clearUnsupported = mod.planAutofillProfileWrite({
  previous: unsupportedPrev,
  proposed: { fieldMappings: [] },
  loginFields: fields,
  action: 'clear_managed_mappings',
});
assert(
  clearUnsupported.ok &&
    clearUnsupported.profile.supportState === 'not_configured' &&
    clearUnsupported.profile.fieldMappings.length === 0,
  'unsupported clear → not_configured + []',
);

// --- no previous → fail ---
const noPrev = mod.planAutofillProfileWrite({
  previous: null,
  proposed: { fieldMappings: [] },
  loginFields: fields,
  action: 'clear_managed_mappings',
});
assert(noPrev.ok === false, 'C4 clear without profile fails');

// --- merge path ---
const merged = mod.mergeAutofillProfileMetadata({
  existingMetadata: {
    credentialMode: 'credential_fields',
    autofillProfile: mod.serializeAutofillProfile(candidatePrev),
  },
  patchMetadata: {
    autofillProfile: { fieldMappings: [], loginEntryUrl: httpsLogin, allowedOrigin: origin },
    autofillProfileAction: 'clear_managed_mappings',
  },
  loginFields: fields,
  loginUrl: httpsLogin,
});
assert(merged.ok === true, 'merge clear ok');
assert(merged.profile.fieldMappings.length === 0, 'merge C1 empty mappings');
assert(merged.profile.supportState === 'not_configured', 'merge supportState');
assert(merged.metadata.credentialMode === 'credential_fields', 'C3/C7 credentialMode retained');
console.log('  ✓ C3/C7 schema/credentialMode untouched; merge persists []');

// --- C8: savedProfileReady gate in editor ---
assertIncludes(editorSrc, 'savedProfileReady', 'C8 Admin Test gate');
assertIncludes(editorSrc, 'existing!.fieldMappings.some', 'C8 requires non-empty saved mappings');

// --- C4 honesty: success toast only after await update ---
assertIncludes(persistFn, 'await updateGlobalRegistryRow', 'C4 calls registry update');
assertIncludes(
  persistFn,
  'מיפויי המילוי האוטומטי הוסרו מהגדרת השירות',
  'C4 clear success copy only in persist success branch',
);
const updateIdx = persistFn.indexOf('await updateGlobalRegistryRow');
const clearSuccessIdx = persistFn.indexOf('מיפויי המילוי האוטומטי הוסרו מהגדרת השירות');
assert(updateIdx >= 0 && clearSuccessIdx > updateIdx, 'C4 success copy after persist await');
assertIncludes(persistFn, 'setError', 'C4 error on failure');

console.log('  ✓ C4 / C5 / C8 static honesty + genericity');
console.log('\nPASS — Phase 120.7 Clear Managed Mapping Persistence');
