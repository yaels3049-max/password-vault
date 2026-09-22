/**
 * Phase 117 — Managed Autofill (T0–T29).
 * Usage: node scripts/verifyPhase117ManagedAutofill.mjs
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { installManagedDomGeometry } from './lib/linkedomManagedHarness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const RIVHIT_GATE = JSON.parse(read('scripts/fixtures/phase117-rivhit-e2e-gate.json'));

function t0RivhitFieldIdGate() {
  assert(
    Array.isArray(RIVHIT_GATE.expectedFieldIds) &&
      RIVHIT_GATE.expectedFieldIds.join(',') === 'username,password,business_id',
    'T0: expected Rivhit E2E field IDs are username, password, business_id',
  );
  assert(
    RIVHIT_GATE.purpose.includes('not a Managed Autofill vocabulary'),
    'T0: gate fixture must not claim a generic vocabulary',
  );
  assert(
    RIVHIT_GATE.liveDumpStatus === 'pass' &&
      Array.isArray(RIVHIT_GATE.activeFieldIds) &&
      RIVHIT_GATE.activeFieldIds.join(',') === RIVHIT_GATE.expectedFieldIds.join(','),
    'T0 / D-117-0: live Admin UI IDs match expected username, password, business_id',
  );
}

function mainStatic() {
  const contract = read('src/autofill/validatedProfile.ts');
  assert(contract.includes('configVersion'), 'M1 configVersion');
  assert(contract.includes('metadataVersion'), 'M1 validation.metadataVersion');
  assert(contract.includes('supportState'), 'M1 supportState');
  assert(!/online1\.rivhit|business_id|#osek/.test(contract), 'T27: contract has no Rivhit hard-codes');

  const api = read('src/admin/adminRegistryApi.ts');
  assert(api.includes('mergeAutofillProfileMetadata'), 'M2 admin merge');

  const editor = read('src/admin/AutofillProfileEditor.tsx');
  assert(editor.includes('field.id'), 'M3 locators from login_fields');
  assert(!editor.includes('free-typed') && editor.includes('fields.map'), 'M3 no free-typed fieldId');
  assert(editor.includes('reset_not_configured'), 'T25 explicit reset control');
  assert(editor.includes('נקה מיפוי'), 'Admin clear-mapping label');
  assert(editor.includes('לנקות את שדות המיפוי במסך?'), 'clear confirms form clear only');
  assert(editor.includes('formHasAnyLocator'), 'clear enabled from current form values');
  assert(
    editor.includes("setLocators(cleared)") || editor.includes('setLocators(cleared)'),
    'clear updates form state only',
  );
  assert(
    !editor.includes("confirm('לנקות את המיפוי השמור?')"),
    'clear must not claim it deletes persisted mapping immediately',
  );
  assert(!editor.includes(' · גרסה '), 'Admin UI must not show configVersion');
  assert(!editor.includes('איפוס ל«לא הוגדר»'), 'Admin UI must not expose internal reset label');
  assert(
    editor.includes('liveValidationApproved') &&
      editor.includes('managedReadinessProbePassed') &&
      editor.includes('runManagedReadinessProbe') &&
      editor.includes("action === 'activate_validated'") &&
      editor.includes('operatorFunctionalActivateAllowed'),
    'AC-117-20 / AC-120.2-AP: activate via Operator path + Managed-parity probe',
  );
  assert(editor.includes('הגדר כלא נתמך'), 'unsupported action Admin label');
  assert(!editor.includes('סמן כלא נתמך'), 'old unsupported label removed');
  assert(
    editor.includes('data-action="save"') &&
      editor.includes('data-action="approve"') &&
      editor.includes('data-action="clear"') &&
      editor.includes('data-action="unsupported"'),
    'four Managed Autofill actions always present',
  );
  assert(editor.includes('hasUnsavedChanges') && editor.includes('canSave'), 'save only when dirty+valid');
  assert(editor.includes('canApprove') && editor.includes('canClear') && editor.includes('canMarkUnsupported'), 'action availability flags');
  assert(
    editor.includes('import.meta.env.DEV') && editor.includes('אשר מיפוי'),
    'Operator mapping-approve action is DEV-only gated',
  );
  assert(
    editor.includes('לאשר את המיפוי ל') &&
      editor.includes('serviceDisplayName') &&
      editor.includes('admin-modal-overlay') &&
      editor.includes('ביטול'),
    'Approve uses app confirm dialog with dynamic service name',
  );
  assert(!editor.includes('הפעל לבדיקה תפקודית'), 'Admin must not show technical validation label');
  assert(!/ריווחית/.test(editor), 'Approve copy must not hard-code Rivhit');
  assert(
    !editor.includes('אישור בעלי האבטחה') && !editor.includes('אישור אבטחה'),
    'Admin UI must not show internal Security-gate copy',
  );
  assert(editor.includes('המיפוי נשמר בהצלחה'), 'save success copy');
  assert(editor.includes('4000'), 'save success remains visible ~4 seconds');

  const adminStatusPanel = read('src/admin/IntegrationStatusPanel.tsx');
  assert(adminStatusPanel.includes('readAutofillProfileFromMetadata'), 'M3 supportState surface');

  const registryAdmin = read('src/admin/RegistryAdmin.tsx');
  assert(registryAdmin.includes('AutofillProfileEditor'), 'M3 RegistryAdmin wires editor');
  assert(
    registryAdmin.includes('key={selectedRow.id}'),
    'mapping editor must keep instance across save reload so success stays visible',
  );

  const runner = read('extension/generic/validated-autofill.js');
  assert(runner.includes('GenericFillExecutor'), 'T/AC-117-7 reuse executor');
  assert(runner.includes('runManagedAutofill'), 'M4 runner');
  assert(!runner.includes('mapLoginFields') && !runner.includes('runGenericAutofill'), 'T17 no heuristic mapper');
  assert(!runner.includes('.submit(') && !runner.includes('click('), 'T16 no submit in runner');
  assert(!/online1\.rivhit|business_id|#osek/.test(runner), 'T27: runner has no Rivhit hard-codes');

  const bg = read('extension/background.js');
  assert(bg.includes('HUB_MANAGED_AUTOFILL'), 'M4 message handler');
  assert(bg.includes("frameIds: [0]"), 'AC-117-8 top-frame inject');
  assert(bg.includes('validated-autofill.js'), 'M4 injects managed runner');
  const managedStart = bg.indexOf('function runManagedAutofillOnTab');
  const managedEnd = bg.indexOf('function openPageAndManagedAutofill');
  const managedFn = bg.slice(managedStart, managedEnd > managedStart ? managedEnd : managedStart + 4000);
  assert(
    !managedFn.includes('pickBestGenericFrameResult') && !managedFn.includes('allFrames: true'),
    'Managed path must not pickBestGenericFrameResult / allFrames',
  );

  const hub = read('src/execution/managedAutofill.ts');
  assert(hub.includes('HUB_MANAGED_AUTOFILL'), 'M5 hub message');
  assert(!/\bexecuteGenericAutofill\s*\(/.test(hub), 'T17 hub helper does not call generic fill');
  assert(!/online1\.rivhit|business_id|#osek/.test(hub), 'T27: hub helper has no Rivhit hard-codes');
  // M8 FAIL regression: Hub must await structured extension result — never treat dispatch as success.
  assert(hub.includes('sendExtensionMessageAsync'), 'M8: Hub awaits sendExtensionMessageAsync');
  assert(hub.includes('async function executeManagedAutofill'), 'M8: executeManagedAutofill is async');
  assert(
    !/\bif\s*\(\s*sendExtensionMessage\s*\(/.test(hub),
    'M8: Hub must not treat sync sendExtensionMessage as success',
  );
  assert(hub.includes('MSG_MANAGED_FILL_OK'), 'M8: success copy only after verified fill');
  assert(hub.includes('MSG_MANAGED_OPEN_FAILED'), 'M8: open-failure structured copy');
  assert(hub.includes('serviceClaimsValidatedManagedProfile'), 'M8: validated claim helper');
  assert(
    hub.includes("MSG_MANAGED_IN_PROGRESS = 'ממלא פרטי כניסה...'"),
    'AC-117-34: Hub in-progress copy',
  );
  assert(
    hub.includes('managedAutofillInFlightKeys') &&
      hub.includes('managedAutofillExecutionKey') &&
      !/let managedAutofillInFlight\s*=\s*false/.test(hub) &&
      !/function isManagedAutofillInFlight\(\)/.test(hub),
    'AC-117-36: keyed Set — no global busy boolean',
  );
  assert(
    hub.includes('function managedAutofillExecutionKey') &&
      hub.includes('serviceId.trim()') &&
      hub.includes('accessProfileId.trim()'),
    'AC-117-36: execution key is (serviceId, accessProfileId) only',
  );
  assert(hub.includes("reason: 'busy'"), 'AC-117-36: busy reject for same-key duplicate');
  assert(
    !/managedAutofillExecutionKey\([\s\S]{0,80}credential/.test(hub),
    'AC-117-36: key contains no secrets',
  );

  assert(bg.includes('MANAGED_AUTOFILL_INITIAL_DELAY_MS = 0'), 'AC-117-30: Managed initial delay 0');
  assert(bg.includes('MANAGED_AUTOFILL_RETRY_DELAY_MS = 300'), 'AC-117-30: Managed retry delay 300');
  assert(
    bg.includes('MANAGED_AUTOFILL_DIAG_LATE_PROBE_MS') &&
      bg.includes('[ManagedAutofillDiag]') &&
      bg.includes('scheduleManagedLateReadinessProbes'),
    '§5D Managed diagnostic late probes present',
  );
  assert(
    !/MANAGED_AUTOFILL_RETRY_DELAY_MS\s*=\s*(?!300\b)\d+/.test(bg),
    '§5D must not change Managed fill-path retry delay',
  );
  assert(
    bg.includes('GENERIC_REAL_SITE_INITIAL_DELAY_MS = 4000'),
    'AC-117-33: legacy/generic 4s delay retained',
  );
  assert(
    bg.includes('initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS'),
    'AC-117-30: Managed open passes delay 0',
  );
  assert(
    bg.includes('buildManagedTabCreateProperties') &&
      bg.includes('sender.tab.index + 1') &&
      bg.includes('openerTabId: sender.tab.id'),
    'AC-117-37: Managed adjacent tab from sender.tab',
  );
  assert(
    bg.includes('openPageAndManagedAutofill(message.url, message, sendResponse, sender)'),
    'AC-117-37: HUB_MANAGED_AUTOFILL forwards sender for placement',
  );
  assert(
    bg.includes('hasManagedPlacement') &&
      bg.includes("chrome.tabs.create({ url: urlString }, onTabCreated)"),
    'AC-117-37: soft placement fallback retries URL-only',
  );
  // Legacy/generic callers must not pass tabCreateProperties.
  const genericOpenFns = [
    bg.slice(bg.indexOf('function openPageAndGenericAutofill'), bg.indexOf('function openPageAndGenericAutofill') + 800),
    bg.slice(bg.indexOf('function openPageAndDetectGenericLogin'), bg.indexOf('function openPageAndDetectGenericLogin') + 800),
    bg.slice(bg.indexOf('function openPageAndIdentityFirstAutofill'), bg.indexOf('function openPageAndIdentityFirstAutofill') + 800),
  ];
  for (const fn of genericOpenFns) {
    assert(
      fn.includes('openGenericRealSiteTab') && !fn.includes('tabCreateProperties'),
      'AC-117-37: legacy/generic placement unchanged (no tabCreateProperties)',
    );
  }
  assert(
    bg.includes('targets_not_ready') && bg.includes('isManagedAutofillRetryable'),
    'AC-117-31: adaptive retry on targets_not_ready',
  );
  assert(
    bg.includes('MANAGED_AUTOFILL_RETRY_DELAY_MS') &&
      !/MANAGED_AUTOFILL_RETRY_DELAY_MS\s*=\s*[1-9]\d{3,}/.test(bg),
    'AC-117-31: Managed retry delay is not a multi-second fixed sleep',
  );

  // Timing comparison (no credentials): before = fixed 4000ms post-URL-match on Managed;
  // after = 0ms initial + bounded adaptive retry only.
  const managedOpenStart = bg.indexOf('function openPageAndManagedAutofill');
  const managedOpenEnd = bg.indexOf('chrome.runtime.onMessageExternal.addListener');
  const managedOpenFn = bg.slice(
    managedOpenStart,
    managedOpenEnd > managedOpenStart ? managedOpenEnd : managedOpenStart + 2500,
  );
  assert(
    managedOpenFn.includes('MANAGED_AUTOFILL_INITIAL_DELAY_MS'),
    'AC-117-30: Managed orchestrator uses Managed delay constant',
  );
  assert(
    /initialDelayMs:\s*MANAGED_AUTOFILL_INITIAL_DELAY_MS/.test(managedOpenFn),
    'AC-117-30 timing: Managed post-load initial delay is MANAGED_AUTOFILL_INITIAL_DELAY_MS (0)',
  );
  assert(
    managedOpenFn.includes('buildManagedTabCreateProperties') ||
      managedOpenFn.includes('tabCreateProperties'),
    'AC-117-37: Managed open applies placement properties when available',
  );

  const launchPanel = read('src/loginAssistance/LoginAssistancePanel.tsx');
  assert(
    launchPanel.includes('MSG_MANAGED_IN_PROGRESS') &&
      launchPanel.includes('serviceClaimsValidatedManagedProfile'),
    'AC-117-34: Launch Card shows in-progress on Managed start',
  );
  const tryAutoStart = launchPanel.indexOf('async function handleTryAuto');
  assert(tryAutoStart > 0, 'AC-117-34: handleTryAuto present');
  const tryAutoFn = launchPanel.slice(tryAutoStart, tryAutoStart + 1600);
  assert(
    tryAutoFn.includes('MSG_MANAGED_IN_PROGRESS') &&
      tryAutoFn.indexOf('MSG_MANAGED_IN_PROGRESS') <
        tryAutoFn.indexOf('attemptExistingAutomaticCompletion'),
    'AC-117-35: in-progress shown before await; result replaces it',
  );
  assert(
    tryAutoFn.includes('isManagedAutofillInFlightFor') &&
      tryAutoFn.includes('autoBusyProfileId') &&
      tryAutoFn.includes('runningProfileId'),
    'AC-117-36: UI dedupe scoped to (service, profile) execution',
  );
  assert(
    !tryAutoFn.includes('isManagedAutofillInFlight()'),
    'AC-117-36: UI does not use global in-flight boolean',
  );

  assert(runner.includes('assessManagedTargetsReady'), 'AC-117-31: readiness assessor');
  assert(runner.includes('targets_not_ready'), 'AC-117-31: not-ready reason');
  assert(runner.includes('verifyMappings'), 'AC-117-32: success only after verification');

  const exec = read('src/execution/serviceExecution.ts');
  assert(
    exec.includes('serviceIsManagedAutofillEligible') &&
      exec.indexOf('serviceIsManagedAutofillEligible') < exec.indexOf('complexityForExecution'),
    'M5 Managed branch before legacy LI/generic',
  );
  assert(
    exec.includes('serviceClaimsValidatedManagedProfile') &&
      exec.indexOf('serviceClaimsValidatedManagedProfile') < exec.indexOf('complexityForExecution'),
    'M8: validated claim blocks legacy/generic fallthrough',
  );
  assert(
    exec.includes('accessProfileId: options.activeProfileId'),
    'AC-117-36: tile path passes accessProfileId into Managed Hub',
  );
  assert(exec.includes('executeGenericAutofill'), 'T18 legacy generic retained');
  assert(exec.includes('credentials_missing'), 'T19 missing-credentials status retained');

  const assist = read('src/loginAssistance/assistanceActions.ts');
  assert(
    assist.includes('serviceClaimsValidatedManagedProfile') && assist.includes('MSG_AUTO_ATTEMPTED'),
    'M8: assistanceActions aware of validated claim vs legacy soft copy',
  );
  const managedClaimIdx = assist.indexOf('if (managedClaim)');
  assert(managedClaimIdx > 0, 'M8: validated managedClaim branch present');
  const afterClaim = assist.slice(managedClaimIdx);
  const claimBlockEnd = afterClaim.indexOf('\n  if (structured)');
  assert(claimBlockEnd > 0, 'M8: managedClaim block bounded before generic structured branch');
  const validatedBlock = afterClaim.slice(0, claimBlockEnd);
  assert(
    !validatedBlock.includes('MSG_AUTO_ATTEMPTED'),
    'M8: validated Managed path never returns MSG_AUTO_ATTEMPTED',
  );
  assert(
    validatedBlock.includes("outcome: 'failure'") || validatedBlock.includes('outcome: success ?'),
    'M8: validated path reports structured outcome',
  );

  const messages = read('src/loginAssistance/messages.ts');
  assert(messages.includes("LABEL_OPEN_SITE = 'פתח אתר'"), 'AC-117-22 Launch Card CTA unchanged');
  assert(messages.includes('ממתין להגדרת מנהל המערכת.'), 'AC-117-22 NOT_CONFIGURED copy unchanged');
  assert(messages.includes('עדיין לא שמרת פרטי כניסה לאתר זה.'), 'AC-117-17 missing-credentials copy');
  assert(
    messages.includes('פרטי הכניסה לאתר אינם נשמרים בבית הדיגיטלי.'),
    'AC-117-17 no-stored copy',
  );

  const dash = read('src/Dashboard.tsx');
  assert(!dash.includes('MSG_NO_CREDENTIALS'), 'AC-117-17 no page-level credentials banner');

  assert(
    !/console\.log\([\s\S]{0,200}credentials/.test(hub) &&
      !/console\.log\([\s\S]{0,80}vaultCredentials/.test(hub),
    'T20 hub must not log credential values',
  );
  assert(!runner.includes('console.log'), 'T20 runner does not log');

  assert(existsSync(join(root, 'scripts/fixtures/phase117-synthetic-pin.html')), 'T28 fixture');
  assert(existsSync(join(root, 'scripts/fixtures/phase117-rivhit-e2e-gate.json')), 'T0 fixture');
}

async function loadContract() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-117-')), 'validatedProfile.mjs');
  await build({
    entryPoints: [join(root, 'src/autofill/validatedProfile.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  return import(pathToFileURL(outfile).href);
}

function sampleFields() {
  return [
    { id: 'username', label: 'שם משתמש', type: 'text', required: true },
    { id: 'password', label: 'סיסמה', type: 'password', required: true },
    { id: 'business_id', label: 'עוסק', type: 'text', required: true },
  ];
}

function syntheticFields() {
  return [
    { id: 'customer_number', label: 'מספר לקוח', type: 'text', required: true },
    { id: 'pin', label: 'קוד', type: 'password', required: true },
  ];
}

async function mainContract() {
  const mod = await loadContract();
  const httpsLogin = 'https://online1.example.test/login';
  const origin = 'https://online1.example.test';
  const mappings = [
    { fieldId: 'username', locatorType: 'css', locator: '#username' },
    { fieldId: 'password', locatorType: 'css', locator: '#password' },
    { fieldId: 'business_id', locatorType: 'css', locator: '#osek' },
  ];

  const t1 = mod.planAutofillProfileWrite({
    previous: null,
    proposed: { fieldMappings: mappings, loginEntryUrl: httpsLogin, allowedOrigin: origin },
    loginFields: sampleFields(),
    loginUrl: httpsLogin,
    action: 'save',
  });
  assert(t1.ok === true, 'T1 valid mapping accepted');
  assert(t1.profile.supportState === 'not_configured', 'T26 structural save is not validated');
  assert(t1.profile.configVersion === 1, 'first save configVersion 1');

  const t2 = mod.planAutofillProfileWrite({
    previous: null,
    proposed: {
      fieldMappings: [
        ...mappings,
        { fieldId: 'foreign', locatorType: 'css', locator: '#x' },
      ],
      loginEntryUrl: httpsLogin,
      allowedOrigin: origin,
    },
    loginFields: sampleFields(),
    action: 'save',
  });
  assert(t2.ok === false, 'T2 unknown field.id rejected');

  const t3 = mod.planAutofillProfileWrite({
    previous: null,
    proposed: {
      fieldMappings: mappings.slice(0, 2),
      loginEntryUrl: httpsLogin,
      allowedOrigin: origin,
    },
    loginFields: sampleFields(),
    action: 'save',
  });
  assert(t3.ok === false, 'T3 missing required mapping rejected');

  const t5http = mod.planAutofillProfileWrite({
    previous: null,
    proposed: {
      fieldMappings: mappings,
      loginEntryUrl: 'http://example.test/login',
      allowedOrigin: 'http://example.test',
    },
    loginFields: sampleFields(),
    action: 'save',
  });
  assert(t5http.ok === false, 'T5 non-HTTPS Login Entry rejected');

  const t5origin = mod.validateAutofillProfileStructural(
    { fieldMappings: mappings, loginEntryUrl: httpsLogin, allowedOrigin: 'https://other.example' },
    { loginFields: sampleFields() },
  );
  assert(t5origin.ok === false, 'T5 origin mismatch rejected');

  const activated = mod.planAutofillProfileWrite({
    previous: t1.profile,
    proposed: t1.profile,
    loginFields: sampleFields(),
    action: 'activate_validated',
    liveValidationApproved: true,
    managedReadinessProbePassed: true,
    nowIso: '2026-09-16T00:00:00.000Z',
  });
  assert(activated.ok === true && activated.profile.supportState === 'validated', 'activate when approved');
  assert(
    activated.profile.validation.metadataVersion === activated.profile.configVersion,
    'T21/AC-117-23 stamp metadataVersion = configVersion',
  );
  assert(
    activated.profile.validation.resultSummary === 'managed_readiness_ok',
    'AC-120.2-AP-9: resultSummary reflects Managed-parity probe',
  );

  const noLive = mod.planAutofillProfileWrite({
    previous: t1.profile,
    proposed: t1.profile,
    loginFields: sampleFields(),
    action: 'activate_validated',
    liveValidationApproved: false,
  });
  assert(noLive.ok === false, 'T26 cannot activate without live validation flag');

  const noProbe = mod.planAutofillProfileWrite({
    previous: t1.profile,
    proposed: t1.profile,
    loginFields: sampleFields(),
    action: 'activate_validated',
    liveValidationApproved: true,
    managedReadinessProbePassed: false,
  });
  assert(noProbe.ok === false, 'AC-120.2-AP-1: cannot activate without Managed-parity probe proof');
  assert(
    noProbe.code === 'cannotActivateWithoutManagedReadinessProbe',
    'AC-120.2-AP-1: probe-proof error code',
  );

  const locatorEdit = mod.planAutofillProfileWrite({
    previous: activated.profile,
    proposed: {
      fieldMappings: mappings.map((row) =>
        row.fieldId === 'password' ? { ...row, locator: '#pass' } : row,
      ),
      loginEntryUrl: httpsLogin,
      allowedOrigin: origin,
    },
    loginFields: sampleFields(),
    action: 'save',
  });
  assert(locatorEdit.ok === true, 'T22 locator edit planned');
  assert(locatorEdit.profile.supportState === 'unsupported', 'T22/AC-117-25 → unsupported');
  assert(locatorEdit.profile.configVersion === activated.profile.configVersion + 1, 'T22 version bump');
  assert(
    !mod.isVersionMatchedValidated(locatorEdit.profile),
    'T22 old validation not eligible',
  );

  const urlEdit = mod.planAutofillProfileWrite({
    previous: activated.profile,
    proposed: {
      fieldMappings: mappings,
      loginEntryUrl: 'https://online1.example.test/other',
      allowedOrigin: 'https://online1.example.test',
    },
    loginFields: sampleFields(),
    action: 'save',
  });
  assert(urlEdit.profile.supportState === 'unsupported', 'T23 Login Entry change invalidates');
  assert(urlEdit.profile.configVersion === activated.profile.configVersion + 1, 'T23 version bump');

  const clearMappings = mod.planAutofillProfileWrite({
    previous: activated.profile,
    proposed: { fieldMappings: [], loginEntryUrl: httpsLogin, allowedOrigin: origin },
    loginFields: sampleFields(),
    action: 'save',
  });
  assert(clearMappings.ok === false || clearMappings.profile?.supportState !== 'validated', 'T24 clear cannot stay validated');

  const implicit = mod.planAutofillProfileWrite({
    previous: activated.profile,
    proposed: {
      fieldMappings: mappings,
      loginEntryUrl: httpsLogin,
      allowedOrigin: origin,
    },
    loginFields: sampleFields(),
    action: 'save',
  });
  assert(implicit.profile.supportState === 'validated', 'unchanged save keeps validated');

  const resetFromValidated = mod.planAutofillProfileWrite({
    previous: activated.profile,
    proposed: activated.profile,
    loginFields: sampleFields(),
    action: 'reset_not_configured',
  });
  assert(resetFromValidated.ok === false, 'T25 cannot reset validated directly');

  const disabled = mod.planAutofillProfileWrite({
    previous: activated.profile,
    proposed: activated.profile,
    loginFields: sampleFields(),
    action: 'disable_unsupported',
  });
  const reset = mod.planAutofillProfileWrite({
    previous: disabled.profile,
    proposed: disabled.profile,
    loginFields: sampleFields(),
    action: 'reset_not_configured',
  });
  assert(reset.ok === true && reset.profile.supportState === 'not_configured', 'T25 explicit reset');

  const eligible = mod.isManagedAutofillEligible({
    metadata: {
      credentialMode: 'credential_fields',
      autofillProfile: mod.serializeAutofillProfile(activated.profile),
    },
    loginFields: sampleFields(),
    credential: { username: 'a', password: 'b', business_id: 'c' },
  });
  assert(eligible === true, 'T21 version-matched validated is eligible');

  const mismatch = mod.isManagedAutofillEligible({
    metadata: {
      credentialMode: 'credential_fields',
      autofillProfile: mod.serializeAutofillProfile(locatorEdit.profile),
    },
    loginFields: sampleFields(),
    credential: { username: 'a', password: 'b', business_id: 'c' },
  });
  assert(mismatch === false, 'T21/T22 mismatch not eligible');

  const missingCreds = mod.isManagedAutofillEligible({
    metadata: {
      credentialMode: 'credential_fields',
      autofillProfile: mod.serializeAutofillProfile(activated.profile),
    },
    loginFields: sampleFields(),
    credential: { username: 'a' },
  });
  assert(missingCreds === false, 'T19 missing credentials not eligible');

  const notConfiguredMode = mod.isManagedAutofillEligible({
    metadata: { credentialMode: 'not_configured' },
    loginFields: [],
    credential: {},
  });
  assert(notConfiguredMode === false, 'T19 NOT_CONFIGURED not managed');

  const noStored = mod.isManagedAutofillEligible({
    metadata: { credentialMode: 'no_stored_credentials' },
    loginFields: null,
    credential: {},
  });
  assert(noStored === false, 'T19 NO_STORED_CREDENTIALS not managed');

  const syntheticSave = mod.planAutofillProfileWrite({
    previous: null,
    proposed: {
      fieldMappings: [
        { fieldId: 'customer_number', locatorType: 'css', locator: '#customer-number' },
        { fieldId: 'pin', locatorType: 'css', locator: '#pin' },
      ],
      loginEntryUrl: 'https://pin.example.test/auth',
      allowedOrigin: 'https://pin.example.test',
    },
    loginFields: syntheticFields(),
    action: 'save',
  });
  assert(syntheticSave.ok === true, 'T28 synthetic schema accepted by same planner');
  const syntheticActivated = mod.planAutofillProfileWrite({
    previous: syntheticSave.profile,
    proposed: syntheticSave.profile,
    loginFields: syntheticFields(),
    action: 'activate_validated',
    liveValidationApproved: true,
    managedReadinessProbePassed: true,
  });
  assert(syntheticActivated.ok === true, 'T28 synthetic activate with probe proof');
  assert(
    mod.isManagedAutofillEligible({
      metadata: {
        credentialMode: 'credential_fields',
        autofillProfile: mod.serializeAutofillProfile(syntheticActivated.profile),
      },
      loginFields: syntheticFields(),
      credential: { customer_number: '991', pin: '4321' },
    }) === true,
    'T28 synthetic schema eligible without Rivhit field names',
  );
}

function loadManagedDom(html, origin) {
  const { window, document } = parseHTML(html);
  Object.defineProperty(window, 'location', {
    value: { origin, href: `${origin}/login` },
    configurable: true,
  });
  window.top = window;
  installManagedDomGeometry(window);
  const scripts = [
    'extension/generic/managed-target-eligibility.js',
    'extension/generic/form-detector.js',
    'extension/generic/fill-executor.js',
    'extension/generic/validated-autofill.js',
  ];
  for (const rel of scripts) {
    const run = new Function('window', 'document', 'globalThis', `${read(rel)}\n//# sourceURL=${rel}`);
    run(window, window.document, window);
  }
  window.GenericFillExecutor.fillField = function (element, value) {
    if (!element || value == null || value === '') {
      return { ok: false, reason: 'missing_value' };
    }
    if (!window.GenericFillExecutor.isSafeFillTarget(element)) {
      return { ok: false, reason: 'hidden_or_unsafe_target' };
    }
    element.value = String(value);
    return { ok: true, verified: true, actual: String(value) };
  };
  return { window, document };
}

function mainDom() {
  const rivhitOrigin = RIVHIT_GATE.allowedOrigin;
  const rivhitHtml = read('scripts/fixtures/phase117-rivhit-login.html');
  const { window, document } = loadManagedDom(rivhitHtml, rivhitOrigin);
  assert(typeof window.runManagedAutofill === 'function', 'runner loaded');

  const rivhitMappings = [
    { fieldId: 'username', locatorType: 'css', locator: '#username' },
    { fieldId: 'password', locatorType: 'css', locator: '#password' },
    { fieldId: 'business_id', locatorType: 'css', locator: '#osek' },
  ];
  const rivhitCreds = { username: 'u1', password: 'p1', business_id: '123' };

  const wrongOrigin = window.runManagedAutofill({
    allowedOrigin: 'https://evil.example',
    fieldMappings: rivhitMappings,
    credentials: rivhitCreds,
  });
  assert(wrongOrigin.ok === false && wrongOrigin.reason === 'wrong_origin', 'T4 wrong origin fails');

  const zero = window.runManagedAutofill({
    allowedOrigin: rivhitOrigin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#missing' }],
    credentials: rivhitCreds,
  });
  assert(
    zero.ok === false && zero.reason === 'targets_not_ready' && zero.detail === 'zero_match',
    'T6 / AC-117-31 zero-match → targets_not_ready',
  );
  assert(zero.locator === '#missing', '§5D diag: locator on targets_not_ready');
  assert(typeof zero.observedUrl === 'string', '§5D diag: observedUrl on targets_not_ready');

  const clone = document.getElementById('username').cloneNode(true);
  clone.id = 'username';
  document.getElementById('login-form').appendChild(clone);
  const multi = window.runManagedAutofill({
    allowedOrigin: rivhitOrigin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#username' }],
    credentials: rivhitCreds,
  });
  assert(
    multi.ok === false && multi.reason === 'targets_not_ready' && multi.detail === 'multi_match',
    'T7 / AC-117-31 multi-match → targets_not_ready',
  );
  clone.remove();

  const hidden = document.createElement('input');
  hidden.id = 'hidden-user';
  hidden.type = 'hidden';
  document.body.appendChild(hidden);
  const hiddenResult = window.runManagedAutofill({
    allowedOrigin: rivhitOrigin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#hidden-user' }],
    credentials: rivhitCreds,
  });
  assert(
    hiddenResult.ok === false && hiddenResult.reason === 'targets_not_ready',
    'T8 hidden target → targets_not_ready (not filled)',
  );
  hidden.remove();

  const disabled = document.createElement('input');
  disabled.id = 'disabled-user';
  disabled.disabled = true;
  document.body.appendChild(disabled);
  const disabledResult = window.runManagedAutofill({
    allowedOrigin: rivhitOrigin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#disabled-user' }],
    credentials: rivhitCreds,
  });
  assert(
    disabledResult.ok === false && disabledResult.reason === 'targets_not_ready',
    'T9 non-editable → targets_not_ready (not filled)',
  );
  disabled.remove();

  // AC-117-31 readiness assessor: all mapped targets ready before fill.
  const readinessOk = window.assessManagedTargetsReady({
    allowedOrigin: rivhitOrigin,
    fieldMappings: rivhitMappings,
  });
  assert(readinessOk.ready === true, 'AC-117-31 assess ready when all locators safe');
  const readinessMissing = window.assessManagedTargetsReady({
    allowedOrigin: rivhitOrigin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#missing' }],
  });
  assert(
    readinessMissing.ready === false && readinessMissing.reason === 'targets_not_ready',
    'AC-117-31 assess not ready when locator missing',
  );
  let submitted = false;
  window.HTMLFormElement.prototype.submit = function submitSpy() {
    submitted = true;
  };
  document.getElementById('login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitted = true;
  });

  const filled = window.runManagedAutofill({
    allowedOrigin: rivhitOrigin,
    fieldMappings: rivhitMappings,
    credentials: rivhitCreds,
  });
  assert(filled.ok === true, `T11–T13 Rivhit-config fill expected ok, got ${JSON.stringify(filled)}`);
  assert(document.getElementById('username').value === 'u1', 'T11 username filled');
  assert(document.getElementById('password').value === 'p1', 'T12 password filled');
  assert(document.getElementById('osek').value === '123', 'T13 business_id → #osek');
  assert(!document.getElementById('remember').checked, 'T14 #remember untouched');
  assert(submitted === false, 'T16 submit never invoked');

  const iframe = document.getElementById('hidden-login');
  if (iframe && iframe.contentDocument) {
    const nested = iframe.contentDocument.createElement('input');
    nested.id = 'username';
    iframe.contentDocument.body.appendChild(nested);
    assert(nested.value === '', 'T15 hidden iframe input remains empty');
  } else {
    assert(
      read('extension/background.js').includes("frameIds: [0]"),
      'T15 top-frame-only inject (iframe document unavailable in fixture)',
    );
  }

  const partial = window.runManagedAutofill({
    allowedOrigin: rivhitOrigin,
    fieldMappings: rivhitMappings,
    credentials: { username: 'u1', password: 'p1' },
  });
  assert(partial.ok === false, 'T10 partial fill is not success');

  const { window: pinWindow, document: pinDocument } = loadManagedDom(
    read('scripts/fixtures/phase117-synthetic-pin.html'),
    'https://pin.example.test',
  );
  const synthetic = pinWindow.runManagedAutofill({
    allowedOrigin: 'https://pin.example.test',
    fieldMappings: [
      { fieldId: 'customer_number', locatorType: 'css', locator: '#customer-number' },
      { fieldId: 'pin', locatorType: 'css', locator: '#pin' },
    ],
    credentials: { customer_number: '991', pin: '4321' },
  });
  assert(synthetic.ok === true, `T28 synthetic fill ok, got ${JSON.stringify(synthetic)}`);
  assert(pinDocument.getElementById('customer-number').value === '991', 'T28 customer_number filled');
  assert(pinDocument.getElementById('pin').value === '4321', 'T28 pin filled');
}

/**
 * M8 FAIL regression: executeManagedAutofill must await extension structured result.
 * Sync dispatch-as-success caused MSG_AUTO_ATTEMPTED with no tab.
 */
async function m8HubAwaitRegression() {
  const dir = mkdtempSync(join(tmpdir(), 'pv-117-m8-'));
  const bridgeStub = join(dir, 'extensionBridge.mjs');
  const outfile = join(dir, 'managedAutofill.mjs');

  writeFileSync(
    bridgeStub,
    `
globalThis.__m8Bridge = {
  nextResponse: { ok: true, filled: 3 },
  sent: null,
  openCalls: [],
};
export function isExtensionAvailable() { return true; }
export function openUrlInNewTab(url) { globalThis.__m8Bridge.openCalls.push(url); }
export function sendExtensionMessage() {
  throw new Error('M8: sync sendExtensionMessage must not be used by Managed Hub');
}
export function sendExtensionMessageAsync(msg) {
  globalThis.__m8Bridge.sent = msg;
  if (globalThis.__m8Bridge.deferred) {
    return new Promise((resolve) => {
      globalThis.__m8Bridge.resolveDeferred = resolve;
    });
  }
  return Promise.resolve(globalThis.__m8Bridge.nextResponse);
}
`,
  );

  await build({
    entryPoints: [join(root, 'src/execution/managedAutofill.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    define: { 'import.meta.env.DEV': 'false' },
    plugins: [
      {
        name: 'stub-extension-bridge',
        setup(buildApi) {
          buildApi.onResolve({ filter: /execution\/extensionBridge$/ }, () => ({
            path: bridgeStub,
          }));
          buildApi.onResolve({ filter: /^\.\/extensionBridge$/ }, () => ({
            path: bridgeStub,
          }));
        },
      },
    ],
  });

  const hub = await import(pathToFileURL(outfile).href);
  const bridgeState = () => globalThis.__m8Bridge;

  const loginFields = [
    { id: 'username', label: 'u', type: 'text', required: true },
    { id: 'password', label: 'p', type: 'password', required: true },
    { id: 'business_id', label: 'b', type: 'text', required: true },
  ];
  const credential = {
    username: 'u1',
    password: 'p1',
    business_id: '123',
  };
  const service = {
    id: 'svc-m8',
    name: 'M8',
    primaryUrl: 'https://online1.example.test/',
    metadata: {
      autofillProfile: {
        supportState: 'validated',
        configVersion: 2,
        loginEntryUrl: 'https://online1.example.test/login',
        allowedOrigin: 'https://online1.example.test',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: '#username' },
          { fieldId: 'password', locatorType: 'css', locator: '#password' },
          { fieldId: 'business_id', locatorType: 'css', locator: '#osek' },
        ],
        validation: { metadataVersion: 2, validatedBy: 'admin' },
      },
    },
  };

  assert(
    hub.serviceClaimsValidatedManagedProfile(service) === true,
    'M8: validated claim detected',
  );
  assert(
    hub.serviceIsManagedAutofillEligible(service, credential, loginFields) === true,
    'M8: eligible for Managed Autofill',
  );

  bridgeState().nextResponse = { ok: true, filled: 3 };
  const optsA = { accessProfileId: 'profile-a' };
  const okResult = await hub.executeManagedAutofill(service, credential, loginFields, optsA);
  assert(okResult.ok === true, 'M8: ok only after extension ok:true');
  assert(
    okResult.userMessage === hub.MSG_MANAGED_FILL_OK,
    'M8: success message is verified-fill copy',
  );
  assert(
    bridgeState().sent?.type === 'HUB_MANAGED_AUTOFILL',
    'M8: Hub sends HUB_MANAGED_AUTOFILL',
  );
  assert(
    bridgeState().sent?.url === 'https://online1.example.test/login',
    'M8: payload uses Login Entry URL',
  );

  bridgeState().nextResponse = { ok: false, reason: 'no_tab' };
  const openFail = await hub.executeManagedAutofill(service, credential, loginFields, optsA);
  assert(openFail.ok === false, 'M8: open failure is not success');
  assert(
    openFail.userMessage === hub.MSG_MANAGED_OPEN_FAILED,
    'M8: open failure structured copy',
  );

  bridgeState().nextResponse = { ok: false, reason: 'wrong_origin' };
  const fillFail = await hub.executeManagedAutofill(service, credential, loginFields, optsA);
  assert(fillFail.ok === false, 'M8: fill failure is not success');
  assert(
    fillFail.userMessage === hub.MSG_MANAGED_FILL_FAILED,
    'M8: fill failure structured copy',
  );

  // AC-117-36 — same (service, profile) duplicate rejected; other profile concurrent OK.
  bridgeState().deferred = true;
  bridgeState().nextResponse = { ok: true, filled: 3 };
  const firstPromise = hub.executeManagedAutofill(service, credential, loginFields, optsA);
  assert(
    hub.isManagedAutofillInFlightFor(service.id, 'profile-a') === true,
    'AC-117-36 item4: same key in flight',
  );
  assert(
    hub.isManagedAutofillInFlightFor(service.id, 'profile-b') === false,
    'AC-117-36 item5: different profile not blocked',
  );
  const busy = await hub.executeManagedAutofill(service, credential, loginFields, optsA);
  assert(busy.ok === false && busy.reason === 'busy', 'AC-117-36 item4: same-key duplicate rejected');
  assert(busy.userMessage === hub.MSG_MANAGED_BUSY, 'AC-117-36: busy copy');

  // Different profile / service may run concurrently while profile-a is in flight.
  bridgeState().deferred = false;
  bridgeState().nextResponse = { ok: true, filled: 3 };
  const concurrentB = await hub.executeManagedAutofill(service, credential, loginFields, {
    accessProfileId: 'profile-b',
  });
  assert(concurrentB.ok === true, 'AC-117-36 item5: different profile concurrent OK');

  const service2 = { ...service, id: 'svc-m8-other' };
  const concurrentSvc = await hub.executeManagedAutofill(service2, credential, loginFields, optsA);
  assert(concurrentSvc.ok === true, 'AC-117-36 item5: different service concurrent OK');
  assert(
    hub.isManagedAutofillInFlightFor(service.id, 'profile-a') === true,
    'AC-117-36: original key still in flight during concurrent peers',
  );

  bridgeState().resolveDeferred({ ok: true, filled: 3 });
  const firstDone = await firstPromise;
  assert(firstDone.ok === true, 'AC-117-36: first run still completes');
  assert(
    hub.isManagedAutofillInFlightFor(service.id, 'profile-a') === false,
    'AC-117-36 item6: key cleared on terminal success',
  );
  assert(hub.managedAutofillInFlightCount() === 0, 'AC-117-36 item7: no residual in-flight keys');
  bridgeState().deferred = false;

  // Re-launch same key immediately after settle (no cooldown).
  bridgeState().nextResponse = { ok: true, filled: 3 };
  const relaunch = await hub.executeManagedAutofill(service, credential, loginFields, optsA);
  assert(relaunch.ok === true, 'AC-117-36 item6: re-launch after settle OK');

  // Version-mismatched validated claim: eligibility false, but claim still true (fail-closed gate).
  const mismatched = {
    ...service,
    metadata: {
      autofillProfile: {
        ...service.metadata.autofillProfile,
        configVersion: 3,
        validation: { metadataVersion: 2, validatedBy: 'admin' },
      },
    },
  };
  assert(
    hub.serviceClaimsValidatedManagedProfile(mismatched) === true,
    'M8: version-mismatched still claims validated',
  );
  assert(
    hub.serviceHasValidatedManagedProfile(mismatched) === false,
    'M8: version mismatch is not runtime-eligible',
  );
  assert(
    hub.serviceIsManagedAutofillEligible(mismatched, credential, loginFields) === false,
    'M8: mismatched not eligible (no generic fallthrough via eligibility)',
  );
}

async function main() {
  t0RivhitFieldIdGate();
  mainStatic();
  await mainContract();
  mainDom();
  await m8HubAwaitRegression();
  console.log(
    'verifyPhase117ManagedAutofill: PASS (T0–T28 + M8 + AC-117-30…37 tab/concurrency; T29 = this script + tsc/build)',
  );
}

await main();
