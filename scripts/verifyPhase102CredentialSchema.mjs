/**
 * Phase 102 M1–M3 credential schema (static + persist helper).
 * Does not claim MVP release. Security-owner review is still required.
 *
 * Usage: node scripts/verifyPhase102CredentialSchema.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function mainStatic() {
  const model = read('src/service/serviceModel.ts');
  assert(
    !model.includes('At least one password-type field is required'),
    'valid schema must not require a password-role field',
  );

  const mapper = read('src/registry/registryMapper.ts');
  assert(!mapper.includes('sanitizeLoginFields'), 'mapper must not drop a no-password schema');
  assert(mapper.includes('classifyStoredLoginFields'), 'mapper must classify stored schemas');

  const admin = read('src/admin/adminRegistryApi.ts');
  assert(!admin.includes('DEFAULT_LOGIN_FIELDS'), 'admin save must not invent Username + Password');
  assert(admin.includes('p_login_fields: null'), 'login URL edit must not write login_fields');
  assert(admin.includes('metadata_version'), 'schema publish must be able to increment metadata_version');

  const editor = read('src/admin/CredentialFieldsEditor.tsx');
  assert(editor.includes('ID_CHANGE_WARNING'), 'id change must warn');
  assert(editor.includes('inputType'), 'editor must set inputType');
  assert(editor.includes('value="number"'), 'editor must offer NUMBER');
  assert(!editor.includes('encrypted_credentials'), 'editor must not read credentials');

  const adminUi = read('src/admin/RegistryAdmin.tsx');
  assert(adminUi.includes('credential_mode'), 'admin save must publish credential mode');
  assert(adminUi.includes('MODE_CLEAR_WARNING'), 'clearing fields on mode change must warn');
  assert(adminUi.includes('no_stored_credentials'), 'admin must offer no-stored-credentials');
  assert(adminUi.includes('not_configured'), 'admin must offer not-configured');

  const entry = read('src/ServiceProfileManagementModal.tsx');
  assert(entry.includes('resolveCredentialEntry'), 'credential entry must resolve schema');
  assert(entry.includes('INCOMPLETE_SCHEMA_MESSAGE'), 'incomplete global schema must show defined copy');
  assert(entry.includes('NO_STORED_CREDENTIALS_MESSAGE'), 'no-stored mode must be distinct from incomplete');
  assert(entry.includes('digitString'), 'number fields must use digit-string input');
  assert(entry.includes('allowsCredentialProfileManagement'), 'profiles only when a credential form exists');
  assert(!entry.includes('getLoginFields'), 'credential entry must not use the autofill default helper');

  const manage = read('src/ManageServices.tsx');
  assert(manage.includes('offersCredentialManagementPanel'), 'manage action must gate on credential mode');
  assert(manage.includes('isNoStoredCredentialsMode'), 'no-stored list label must use resolved mode');
  assert(manage.includes('NO_STORED_CREDENTIALS_LIST_LABEL'), 'no-stored list label must be the defined copy');
  assert(manage.includes('ללא פרטי כניסה') || read('src/service/credentialSchema.ts').includes("ללא פרטי כניסה"), 'user list shows ללא פרטי כניסה');
  assert(manage.includes('sm-manage-status'), 'no-stored label is non-interactive status text');

  const launchGate = read('src/loginAssistance/credentialsGate.ts');
  assert(launchGate.includes('shouldOpenLoginAssistancePanel'), 'Digital Home launch gate helper');
  assert(launchGate.includes('resolveCredentialEntry'), 'launch gate uses resolved credentialMode');
  assert(
    !launchGate.includes('getLoginFields'),
    'launch gate must not infer mode from getLoginFields',
  );

  const dash = read('src/Dashboard.tsx');
  assert(dash.includes('shouldOpenLoginAssistancePanel'), 'Home opens Launch Card via mode-aware gate');
  assert(!dash.includes('serviceHasUsableCredentials'), 'Home must not gate solely on stored usable credentials');

  const panel = read('src/loginAssistance/LoginAssistancePanel.tsx');
  assert(panel.includes('MSG_NO_STORED_CREDENTIALS_LAUNCH'), 'Launch Card no-stored message');
  assert(panel.includes('MSG_NOT_CONFIGURED_LAUNCH'), 'Launch Card not-configured message');
  assert(panel.includes('MSG_MISSING_USER_CREDENTIALS_LAUNCH'), 'Launch Card missing-user-credentials message');
  assert(panel.includes('LABEL_ADD_CREDENTIALS'), 'missing-user-credentials add CTA');
  assert(
    read('src/loginAssistance/messages.ts').includes(
      'פרטי הכניסה לאתר אינם נשמרים בבית הדיגיטלי.',
    ),
    'exact no-stored launch copy',
  );
  assert(
    read('src/loginAssistance/messages.ts').includes(
      'ממתין להגדרת מנהל המערכת.',
    ),
    'exact not-configured launch copy',
  );
  assert(
    !read('src/loginAssistance/messages.ts').includes(
      'פרטי הכניסה לאתר עדיין לא הוגדרו במערכת.',
    ),
    'retired not-configured launch copy gone',
  );
  assert(panel.includes('{LABEL_OPEN_SITE}'), 'unified service-open CTA on Launch Card');
  assert(
    !panel.includes('labelOpenSiteNamed') &&
      !panel.includes('פתח אתר להתחברות') &&
      !/labelOpenSiteNamed\(service\.name\)/.test(panel),
    'Launch Card must not use named or login-worded open CTAs',
  );
  assert(
    read('src/loginAssistance/messages.ts').includes("LABEL_OPEN_SITE = 'פתח אתר'"),
    'service-open CTA copy is פתח אתר',
  );
  assert(!panel.includes('LABEL_OPEN_SITE_PLAIN'), 'plain open-site label retired');
  assert(panel.includes("launchKind === 'not-configured'"), 'panel branches on launch kind');
  assert(panel.includes("launchKind === 'no-stored-credentials'"), 'panel keeps no-stored branch');
  assert(panel.includes("launchKind === 'missing-user-credentials'"), 'panel keeps missing-user-credentials branch');
  assert(panel.includes('showCredentialUi'), 'credential UI only for form mode');
  assert(!panel.includes('INCOMPLETE_SCHEMA_MESSAGE'), 'Launch Card must not use management incomplete copy');

  const overlay = read('src/catalog/builtinCatalogOverlay.ts');
  assert(
    !overlay.includes('builtin.loginFields'),
    'overlay must not invent loginFields from the Hub seed',
  );

  const messages = read('src/loginAssistance/messages.ts');
  assert(messages.includes("LABEL_OPEN_SITE = 'פתח אתר'"), 'unified open CTA is פתח אתר');
  assert(!messages.includes('פתח אתר להתחברות'), 'retired login-open CTA copy gone');
  assert(!/פתח את \$\{serviceName\}/.test(messages), 'named service-open CTA retired');
  assert(!messages.includes('export function labelOpenSiteNamed'), 'named CTA helper retired');
  assert(!messages.includes('האתר אינו דורש התחברות'), 'must not claim site needs no auth');
  assert(!messages.includes('אין לאתר פרטי כניסה'), 'must not claim site has no credentials');
  assert(!messages.includes('אין צורך בפרטי כניסה'), 'must not claim credentials are unnecessary');
  assert(!messages.includes('לא נשמרים פרטי כניסה לאתר זה'), 'retired no-stored launch wording');

  const badge = read('src/serviceManagement/serviceManagementState.ts');
  assert(badge.includes('resolveCredentialEntry'), 'badge must not invent Username + Password for mode resolution');
  assert(!badge.includes('getLoginFields'), 'management badge must not use autofill default helper');
  assert(!read('src/trust/HubCredentialInput.tsx').includes("type=\"number\""), 'HTML number input must not drop leading zeros');
  assert(!read('src/service/credentialSchema.ts').includes('Number('), 'digit strings must not be coerced with Number');
  assert(!read('src/service/credentialSchema.ts').includes('parseInt'), 'digit strings must not be coerced with parseInt');

  const autofill = read('src/execution/autofillEligibility.ts');
  assert(existsSync(join(root, 'src/execution/autofillEligibility.ts')), 'autofill file remains');
  assert(!read('src/service/legacyService.ts').includes('resolveCredentialEntry'), 'do not move credential rules into autofill helper');

  assert(existsSync(join(root, 'src/discovery/discoverLoginEntry.ts')), 'do not delete the discovery engine');
  assert(
    !existsSync(join(root, 'supabase/migrations/20260914153000_phase102_relax_password_schema.sql')),
    'do not ship a migration that relaxes the discovery RPC check',
  );
  assert(existsSync(join(root, 'docs/evidence/phase102-credential-schema-fixtures.html')));
  void autofill;
}

async function mainHelper() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-102-')), 'schema.mjs');
  await build({
    entryPoints: [join(root, 'src/service/credentialSchema.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);

  const two = mod.classifyStoredLoginFields([
    { id: 'idNumber', label: 'ID Number', type: 'text', required: true, masked: false, inputType: 'number' },
    { id: 'last4', label: 'Last 4 digits of card', type: 'text', required: true, masked: true, inputType: 'number' },
  ]);
  assert(two.status === 'valid' && two.fields.length === 2, 'two-field schema is valid');
  assert(two.fields[1].type === 'text' && two.fields[1].masked === true, 'masked last-4 is not password role');
  assert(two.fields[1].inputType === 'number', 'NUMBER inputType is preserved');

  const three = mod.classifyStoredLoginFields([
    { id: 'customerNumber', label: 'Customer Number', type: 'text' },
    { id: 'idNumber', label: 'ID Number', type: 'text' },
    { id: 'password', label: 'Password', type: 'password' },
  ]);
  assert(three.status === 'valid' && three.fields.length === 3, 'three-field schema is valid');

  assert(mod.classifyStoredLoginFields(null).status === 'missing', 'null is missing');
  assert(mod.classifyStoredLoginFields([]).status === 'empty', 'empty array stays empty');
  assert(
    mod.classifyStoredLoginFields([{ id: 'a', label: 'A', type: 'text' }, { id: 'a', label: 'B', type: 'text' }]).status === 'invalid',
    'duplicate id is invalid',
  );

  const globalMissing = mod.resolveCredentialEntry({ source: 'built-in-catalog', loginFields: undefined });
  assert(globalMissing.kind === 'incomplete', 'global missing schema is incomplete');
  const custom = mod.resolveCredentialEntry({ source: 'user-created' });
  assert(
    custom.kind === 'form' && custom.origin === 'custom-default' && custom.fields[0].id === 'username',
    'custom missing schema uses render-time default',
  );
  const explicit = mod.resolveCredentialEntry({
    source: 'built-in-catalog',
    loginFields: two.fields,
  });
  assert(explicit.kind === 'form' && explicit.fields.length === 2, 'explicit global schema is rendered exactly');

  const saved = mod.serializeCredentialValues(
    [
      { id: 'idNumber', label: 'ID Number', type: 'text', required: true, inputType: 'number' },
      { id: 'last4', label: 'Last 4 digits of card', type: 'text', required: true, masked: true, inputType: 'number' },
      { id: 'note', label: 'Note', type: 'text', required: false, inputType: 'text' },
    ],
    { idNumber: '123', last4: '0017', note: '   ', oldId: 'secret' },
  );
  assert(
    saved.ok && saved.credential.last4 === '0017' && saved.credential.idNumber === '123' && !('note' in saved.credential) && !('oldId' in saved.credential),
    '0017 stays 0017 and save writes current required ids only',
  );
  assert(typeof saved.credential.last4 === 'string', 'NUMBER value stays a string');

  const rejectedDigits = mod.serializeCredentialValues(
    [{ id: 'last4', label: 'Last 4', type: 'text', inputType: 'number', required: true }],
    { last4: '17a' },
  );
  assert(!rejectedDigits.ok, 'non-digit NUMBER entry is rejected');

  const emptyMode = mod.resolveGlobalCredentialConfiguration({ loginFields: [] });
  assert(emptyMode.status === 'not_configured', 'empty field list is not no_stored_credentials');
  const missingMode = mod.resolveGlobalCredentialConfiguration({ loginFields: null });
  assert(missingMode.status === 'not_configured', 'missing fields without mode are not configured');
  const explicitNone = mod.resolveGlobalCredentialConfiguration({
    metadata: { credentialMode: 'no_stored_credentials' },
    loginFields: null,
  });
  assert(explicitNone.status === 'no_stored_credentials', 'explicit no-stored mode is complete');
  const legacyFields = mod.resolveGlobalCredentialConfiguration({ loginFields: two.fields });
  assert(legacyFields.status === 'credential_fields', 'valid fields without a mode stay credential fields');

  const rejectEmptyFields = mod.planCredentialConfigurationWrite({ mode: 'credential_fields', fields: [] });
  assert(!rejectEmptyFields.ok, 'credential_fields without fields is rejected');
  const rejectActive = mod.planCredentialConfigurationWrite({
    mode: 'no_stored_credentials',
    fields: two.fields,
  });
  assert(!rejectActive.ok, 'no_stored_credentials with active fields is rejected');
  const rejectNotConfigured = mod.planCredentialConfigurationWrite({
    mode: 'not_configured',
    fields: two.fields,
  });
  assert(!rejectNotConfigured.ok, 'not_configured with active fields is rejected');
  const cleared = mod.planCredentialConfigurationWrite({ mode: 'no_stored_credentials', fields: null });
  assert(cleared.ok && cleared.loginFields === null && cleared.credentialMode === 'no_stored_credentials', 'confirmed clear writes null fields');
  const contradictory = mod.resolveCredentialEntry({
    source: 'built-in-catalog',
    metadata: { credentialMode: 'credential_fields' },
    loginFields: [],
  });
  assert(contradictory.kind === 'incomplete', 'stored contradiction is incomplete, not another mode');
  const noStoredEntry = mod.resolveCredentialEntry({
    source: 'built-in-catalog',
    metadata: { credentialMode: 'no_stored_credentials' },
    loginFields: null,
  });
  assert(noStoredEntry.kind === 'no-stored-credentials', 'user entry distinguishes no-stored from incomplete');
  assert(!mod.offersCredentialManagementPanel({
    source: 'built-in-catalog',
    metadata: { credentialMode: 'no_stored_credentials' },
    loginFields: null,
  }), 'no-stored does not offer credential management');
  assert(mod.isNoStoredCredentialsMode({
    source: 'built-in-catalog',
    metadata: { credentialMode: 'no_stored_credentials' },
    loginFields: null,
  }), 'explicit no-stored is detected by resolved mode');
  assert(!mod.isNoStoredCredentialsMode({
    source: 'built-in-catalog',
    loginFields: [],
  }), 'empty fields alone are not no-stored');
  assert(!mod.isNoStoredCredentialsMode({
    source: 'built-in-catalog',
    loginFields: null,
  }), 'missing fields alone are not no-stored');
  assert(mod.offersCredentialManagementPanel({
    source: 'built-in-catalog',
    loginFields: null,
  }), 'not-configured still offers the incomplete management panel');
  assert(mod.allowsCredentialProfileManagement(noStoredEntry) === false, 'no-stored has no profile management');
  assert(mod.allowsCredentialProfileManagement(contradictory) === false, 'incomplete has no profile management');
  assert(mod.allowsCredentialProfileManagement(explicit) === true, 'configured schema keeps profile management');
}

async function mainLaunchGate() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-102-gate-')), 'gate.mjs');
  await build({
    entryPoints: [join(root, 'src/loginAssistance/credentialsGate.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  const mod = await import(pathToFileURL(outfile).href);

  const noStoredService = {
    id: 'yad2',
    name: 'יד2',
    source: 'built-in-catalog',
    loginFields: null,
    metadata: { credentialMode: 'no_stored_credentials' },
  };
  assert(
    mod.shouldOpenLoginAssistancePanel(noStoredService, [], {}) === true,
    'NO_STORED_CREDENTIALS opens Launch Card without profiles/credentials',
  );
  assert(
    mod.serviceHasUsableCredentials(noStoredService, [], {}) === false,
    'NO_STORED_CREDENTIALS has no usable stored credentials',
  );

  const notConfigured = {
    id: 'incomplete-svc',
    name: 'Incomplete',
    source: 'built-in-catalog',
    loginFields: null,
  };
  assert(
    mod.shouldOpenLoginAssistancePanel(notConfigured, [], {}) === true,
    'NOT_CONFIGURED still opens Launch Card (incomplete treatment)',
  );
  assert(
    mod.resolveDigitalHomeLaunchKind(notConfigured, [], {}) === 'not-configured',
    'absent mode without fields is not-configured launch',
  );

  const notConfiguredExplicit = {
    id: 'admin-not-configured',
    name: 'בדיקה',
    source: 'built-in-catalog',
    loginFields: [
      { id: 'username', label: 'Username', type: 'text', required: true },
      { id: 'password', label: 'Password', type: 'password', required: true },
    ],
    metadata: { credentialMode: 'not_configured' },
  };
  assert(
    mod.shouldOpenLoginAssistancePanel(notConfiguredExplicit, [], {}) === true,
    'explicit NOT_CONFIGURED opens Launch Card even if leftover fields are present',
  );
  assert(
    mod.resolveDigitalHomeLaunchKind(notConfiguredExplicit, [], {}) === 'not-configured',
    'explicit NOT_CONFIGURED is not treated as missing user credentials',
  );

  const fieldsService = {
    id: 'amex',
    name: 'American Express',
    source: 'built-in-catalog',
    loginFields: [
      { id: 'username', label: 'Username', type: 'text', required: true },
      { id: 'password', label: 'Password', type: 'password', required: true },
    ],
    metadata: { credentialMode: 'credential_fields' },
  };
  assert(
    mod.shouldOpenLoginAssistancePanel(fieldsService, [], {}) === true,
    'CREDENTIAL_FIELDS without saved profile still opens Launch Card',
  );
  assert(
    mod.resolveDigitalHomeLaunchKind(fieldsService, [], {}) === 'missing-user-credentials',
    'CREDENTIAL_FIELDS without saved profile is missing-user-credentials',
  );
  assert(
    mod.shouldOpenLoginAssistancePanel(
      fieldsService,
      [{ id: 'p1', displayName: 'Me', serviceId: 'amex', schemaVersion: 1, createdAt: '', updatedAt: '' }],
      { p1: { username: 'u', password: 'x' } },
    ) === true,
    'CREDENTIAL_FIELDS with saved profile opens Launch Card',
  );

  const emptyFieldsNotNoStored = {
    id: 'empty-fields',
    name: 'Empty Fields',
    source: 'built-in-catalog',
    loginFields: [],
  };
  assert(
    mod.shouldOpenLoginAssistancePanel(emptyFieldsNotNoStored, [], {}) === true,
    'empty loginFields alone is incomplete open, not blocked as missing credentials',
  );
  assert(
    mod.serviceHasUsableCredentials(emptyFieldsNotNoStored, [], {}) === false,
    'empty loginFields alone is not treated as usable credentials',
  );

  const custom = {
    id: 'custom-1',
    name: 'My Site',
    source: 'user-created',
    loginFields: null,
  };
  assert(
    mod.shouldOpenLoginAssistancePanel(custom, [], {}) === true,
    'custom service without stored credentials still opens Launch Card',
  );
  assert(
    mod.resolveDigitalHomeLaunchKind(custom, [], {}) === 'missing-user-credentials',
    'custom without stored credentials is missing-user-credentials',
  );
}

await mainStatic();
await mainHelper();
await mainLaunchGate();
console.log('PASS: Phase 102 credential schema helper (MVP release still blocked on security review)');
