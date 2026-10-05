/**
 * Phase 123.2b — catalog visibility gate (AD-123-19).
 *
 * Two layers, both on the real sources (mutations are applied in memory):
 *  - pure (Node bundle): registry rows → the real registryMapper / definitionToLegacyService →
 *    the real catalog gate, the real custom-add classifier, the shared userApprovalState and its
 *    admin re-export. One fixture row per approval / credential state, a promotion exactly as the
 *    Phase 107 promote function writes it (owner null, built_in, approvalStatus 'approved', no
 *    mapping), and the user's own unmapped site;
 *  - static: shared logic byte-identical to the HEAD admin helper; admin change = the re-export
 *    only; AppCatalog filters the listing before search / category; App / Dashboard / ManageServices
 *    home lists, the registry loader and execution are not gated; the dev summary is dev-only.
 * The browser listing / kept home tile is checked by verifyPhase123Catalog (checkCatalogGateListing).
 *
 * Usage: node scripts/verifyPhase123CatalogGate.mjs [--no-mutations | --mutations=M1,M2]
 *        No mutation switch = full sweep (END OF ROUND only, test policy T-1).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { makeTempDir, removeTempDir } from './lib/tempDir.mjs';
import { formatElapsed, mutationId, parseMutationArgs, selectMutations } from './lib/mutationArgs.mjs';
import { checkTimeoutMessage, failRun, isTimeout, mutationTimeoutMessage, withTimeout } from './lib/withTimeout.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}
const MUTATION_ARGS = parseMutationArgs();
const STARTED = Date.now();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
// Pre-Phase-123 tree (Phase 122 commit). HEAD can no longer be the baseline: the WIP commit
// af881f6b on wip/phase123-recovered already contains the Phase 123 changes.
const BASE = '909cc8bcceedd3b74d2e6fdbcc1ecac291a7b570';
const headSource = (rel) => {
  try {
    return git('show', `${BASE}:${rel}`).replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
};
const source = (overrides, rel) => overrides[rel] ?? read(rel);

// ─── Fixtures (synthetic registry rows) ───────────────────────────────────────
const USER = 'user-gate-1';
const FIELDS = [
  { id: 'username', label: 'שם משתמש', type: 'text' },
  { id: 'password', label: 'סיסמה', type: 'password' },
];
const autofill = (supportState, validationVersion) => ({
  supportState,
  configVersion: 1,
  loginEntryUrl: 'https://login.example.test/',
  allowedOrigin: 'https://login.example.test',
  fieldMappings: [
    { fieldId: 'username', locatorType: 'css', locator: '#user' },
    { fieldId: 'password', locatorType: 'css', locator: '#pass' },
  ],
  ...(validationVersion ? { validation: { metadataVersion: validationVersion, validatedBy: 'admin' } } : {}),
});
const row = (id, name, extra) => ({
  id,
  display_name: name,
  primary_url: `https://${id}.example.test`,
  login_url: null,
  login_url_status: 'unknown',
  category_id: 'shopping',
  icon: '🔗',
  adapter_id: null,
  login_fields: FIELDS,
  source_type: 'built_in',
  service_status: 'active',
  metadata: {},
  owner_user_id: null,
  ...extra,
});
const PROVENANCE = { promotedFromUserId: 'user-other', promotedFromServiceId: 'custom-x', promotedAt: '2026-10-01T00:00:00Z', promotedBy: 'admin-1' };
/** [row, expected gate state, listed] */
const CASES = [
  [row('approved', 'מאושר', { metadata: { credentialMode: 'credential_fields', autofillProfile: autofill('validated', 1) } }), 'approved', true],
  [row('notapproved', 'טרם אושר', { metadata: { credentialMode: 'credential_fields', autofillProfile: autofill('not_configured') } }), 'not_approved', false],
  [row('blocked', 'חסום', { metadata: { credentialMode: 'credential_fields', autofillProfile: autofill('validated', 2) } }), 'blocked', false],
  [row('nomapping', 'אין מיפוי', { metadata: { faviconSiteUrl: 'https://nomapping.example.test' } }), 'no_mapping', false],
  [row('notconf', 'לא מוגדר', { login_fields: null, metadata: { credentialMode: 'not_configured' } }), 'no_mapping', false],
  [row('nostored', 'ללא שמירה', { login_fields: null, metadata: { credentialMode: 'no_stored_credentials' } }), 'no_stored_credentials', true],
  [row('nostoredbad', 'ללא שמירה פגום', { login_fields: 'corrupt', metadata: { credentialMode: 'no_stored_credentials' } }), 'no_mapping', false],
  [row('adminglobal', 'גלובלי מנהל', { source_type: 'admin', metadata: { credentialMode: 'credential_fields', autofillProfile: autofill('validated', 1) } }), 'approved', true],
  [
    row('promoted', 'הוגש וקודם', {
      login_fields: null,
      metadata: { loginUrlSource: 'user', loginEntryType: 'primary_page', provenance: PROVENANCE, approvalStatus: 'approved', approvedBy: 'admin-1' },
    }),
    'no_mapping',
    false,
  ],
  [
    row('promotedmapped', 'הוגש, קודם ומופה', {
      metadata: { loginUrlSource: 'user', provenance: PROVENANCE, approvalStatus: 'approved', credentialMode: 'credential_fields', autofillProfile: autofill('validated', 1) },
    }),
    'approved',
    true,
  ],
  [row('own', 'האתר שלי', { source_type: 'user', owner_user_id: USER, login_fields: null, metadata: { loginUrlSource: 'user' } }), 'own_site', true],
];

// ─── Pure layer ───────────────────────────────────────────────────────────────
const PURE_ENTRY = `
export { catalogGateState, isListedInUserCatalog, isShownInUserCatalog } from './src/catalog/catalogVisibility.ts';
export { classifyAddCustomService } from './src/catalog/addCustomServiceOutcome.ts';
export { userApprovalState as sharedUserApprovalState } from './src/service/userApproval.ts';
export { userApprovalState as adminUserApprovalState, USER_APPROVAL_HE } from './src/admin/userApproval.ts';
export { registryRowToServiceDefinition } from './src/registry/registryMapper.ts';
export { definitionToLegacyService } from './src/catalog/definitionToLegacyService.ts';
`;
const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();

async function loadPure(overrides) {
  const dir = makeTempDir('pv-1232b-pure-');
  try {
    const map = new Map(Object.entries(overrides).filter(([rel]) => /\.tsx?$/.test(rel)).map(([rel, src]) => [abs(rel), src]));
    const used = new Set();
    await build({
      stdin: { contents: PURE_ENTRY, resolveDir: root, loader: 'ts', sourcefile: 'pure.ts' },
      bundle: true,
      write: true,
      logLevel: 'silent',
      format: 'esm',
      platform: 'node',
      outfile: join(dir, 'pure.mjs'),
      nodePaths: [join(root, 'node_modules')],
      define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production' }) },
      plugins: [
        {
          name: 'pv-1232b-overrides',
          setup(b) {
            b.onLoad({ filter: /\.tsx?$/ }, (args) => {
              const key = args.path.replace(/\\/g, '/').toLowerCase();
              if (!map.has(key)) return undefined;
              used.add(key);
              return { contents: map.get(key), loader: key.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: dirname(args.path) };
            });
          },
        },
      ],
    });
    return { mod: await import(pathToFileURL(join(dir, 'pure.mjs')).href), used };
  } finally {
    removeTempDir(dir);
  }
}

function definitions(mod) {
  return CASES.map(([r]) => mod.registryRowToServiceDefinition(r));
}

function checkGateStates(mod) {
  const defs = definitions(mod);
  CASES.forEach(([r, state, listed], i) => {
    const definition = defs[i];
    const legacy = mod.definitionToLegacyService(definition);
    assert(mod.catalogGateState(definition) === state, `AD-123-19: ${r.id} gate state = ${mod.catalogGateState(definition)} (want ${state})`);
    assert(mod.isListedInUserCatalog(definition) === listed, `AD-123-19: ${r.id} ${listed ? 'listed' : 'hidden'} (definition)`);
    assert(mod.isListedInUserCatalog(legacy) === listed, `AD-123-19: ${r.id} ${listed ? 'listed' : 'hidden'} (runtime Service)`);
  });
  return 'pure: approved (admin / built-in / promoted+mapped) and no_stored_credentials listed; not_approved / blocked / no_mapping / not_configured / corrupt no_stored / promoted-but-unmapped hidden; own site not gated — same on definitions and runtime Services';
}

function checkShownInCatalog(mod) {
  const defs = definitions(mod);
  CASES.forEach(([r, state, listed], i) => {
    for (const entry of [defs[i], mod.definitionToLegacyService(defs[i])]) {
      assert(mod.isShownInUserCatalog(entry, true) === true, `AD-123-19 (a): ${r.id} (${state}) already in the home is shown (marked already added)`);
      assert(mod.isShownInUserCatalog(entry, false) === listed, `AD-123-19 (a): ${r.id} (${state}) not in the home is ${listed ? 'shown' : 'hidden'} — the gate alone decides`);
    }
  });
  const own = defs[CASES.findIndex(([, state]) => state === 'own_site')];
  assert(mod.isShownInUserCatalog(own, false) && mod.isShownInUserCatalog({ ...own, metadata: {}, loginFields: undefined }, false), 'AD-123-19 (b): the owner\'s own not-promoted custom site is always listed (no mapping needed)');
  return 'pure: AD-123-19 (a) a site in the home is shown whatever its gate state; outside the home only listed sites are shown; (b) own custom sites are always listed';
}

function checkSharedHelper(mod) {
  assert(mod.adminUserApprovalState === mod.sharedUserApprovalState, 'AD-123-19: admin userApprovalState is the shared function (re-export)');
  assert(
    JSON.stringify(mod.USER_APPROVAL_HE) === JSON.stringify({ approved: 'מאושר למשתמשים', not_approved: 'טרם אושר למשתמשים', blocked: 'חסום למשתמשים', no_mapping: 'אין מיפוי' }),
    'admin badge labels unchanged',
  );
  const defs = definitions(mod);
  CASES.forEach(([r, state], i) => {
    if (state === 'own_site' || state === 'no_stored_credentials') return;
    const badge = mod.adminUserApprovalState(r);
    assert(badge === state, `AD-123-19: catalog state of ${r.id} = the admin badge on the saved row (${badge} vs ${state})`);
    assert(mod.sharedUserApprovalState({ metadata: defs[i].metadata, login_fields: defs[i].loginFields }) === badge, `${r.id}: mapped definition derives the same approval as the raw row`);
  });
  return 'pure: admin re-exports the shared userApprovalState (same function, labels unchanged); the catalog derives the same state as the admin badge on the saved row';
}

function checkClassifier(mod) {
  const defs = definitions(mod);
  const byId = Object.fromEntries(defs.map((d) => [d.id, d]));
  const classify = (id, selected = [], local = []) =>
    mod.classifyAddCustomService({ normalizedUrl: `${byId[id].url}/`, definitions: defs, selectedIds: new Set(selected), localCustomServices: local });
  for (const [r, , listed] of CASES) {
    if (r.source_type === 'user') continue;
    const out = classify(r.id);
    if (listed) {
      assert(out?.status === 'catalog_service_available' && out.existingServiceId === r.id, `AD-123-19: ${r.id} is offered (${out?.status})`);
    } else {
      assert(out === null, `AD-123-19: hidden ${r.id} is never offered — create proceeds (${out?.status})`);
    }
    const inHome = classify(r.id, [r.id]);
    assert(inHome?.status === 'already_in_user_home' && inHome.existingServiceId === r.id, `AD-123-19: ${r.id} already in the home → already_in_user_home (${inHome?.status})`);
  }
  const ownCopy = { ...byId.own, id: 'own-copy-of-promoted', url: byId.promoted.url, source: 'user-created' };
  const dup = classify('promoted', [], [ownCopy]);
  assert(dup?.status === 'same_user_custom_duplicate' && dup.existingServiceId === 'own-copy-of-promoted', `AD-123-19: hidden global + own site on the same URL → the user's own site (${dup?.status})`);
  const own = classify('own');
  assert(own?.status === 'same_user_custom_duplicate', `own registry site keeps its outcome (${own?.status})`);
  return 'pure: classifier offers only listed global sites; hidden ones → null (create) unless already in the home (already_in_user_home); own sites keep their outcome';
}

// ─── Static layer ─────────────────────────────────────────────────────────────
/** `export function name(` … first top-level `\n}\n`. */
function topLevelFunction(src, name) {
  const at = src.indexOf(`export function ${name}(`);
  if (at < 0) return null;
  const end = src.indexOf('\n}\n', at);
  return end < 0 ? null : src.slice(at, end + 3);
}
function block(src, start) {
  const at = src.indexOf(start);
  if (at < 0) return null;
  return src.slice(at, src.indexOf(';\n', at) + 2);
}

function checkSharedLogicUnchanged(overrides) {
  const head = headSource('src/admin/userApproval.ts');
  const shared = source(overrides, 'src/service/userApproval.ts');
  assert(head.includes('export function userApprovalState('), 'fixture: HEAD admin helper found');
  assert(topLevelFunction(shared, 'userApprovalState') === topLevelFunction(head, 'userApprovalState'), 'AD-123-19: shared userApprovalState is byte-identical to the HEAD admin helper (logic unchanged)');
  for (const start of ["export type UserApprovalState = ", 'export interface UserApprovalRow {']) {
    const end = start.endsWith('{') ? '\n}\n' : ';\n';
    const cut = (src) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)) + end.length);
    assert(cut(shared) === cut(head), `AD-123-19: ${start.trim()} unchanged`);
  }
  const importsOf = (src) => [...src.matchAll(/import\s+[\s\S]*?\s+from\s+'([^']+)';/g)].map((m) => m[1].replace(/^\.\.\/service\//, './'));
  assert(JSON.stringify(importsOf(shared)) === JSON.stringify(importsOf(head)), `AD-123-19: shared helper imports the same modules as HEAD (${importsOf(shared).join(', ')})`);
  assert(!/admin/.test(importsOf(shared).join(' ')) && !/from '\.\.\/admin/.test(source(overrides, 'src/catalog/catalogVisibility.ts')), 'N-8: shared helper / gate import nothing from src/admin');
  return 'static: src/service/userApproval.ts = the HEAD admin helper (function, types and imports identical); no admin import on the user side';
}

function checkAdminReexportOnly(overrides) {
  // D-123-6 (N-1 copy exception): ApprovalQueue.tsx success line — content checked by verifyPhase123FixD6D8.
  const changed = git('diff', '--name-only', BASE, '--', 'src/admin').split('\n').filter(Boolean);
  assert(changed.length <= 2 && changed.every((p) => p === 'src/admin/userApproval.ts' || p === 'src/admin/ApprovalQueue.tsx'), `N-1 / AD-123-19: only src/admin/userApproval.ts (+ D-123-6 ApprovalQueue.tsx) changes under src/admin (${changed.join(', ')})`);
  assert(git('ls-files', '--others', '--exclude-standard', '--', 'src/admin').trim() === '', 'N-1: no new files under src/admin');
  const admin = source(overrides, 'src/admin/userApproval.ts');
  const head = headSource('src/admin/userApproval.ts');
  assert(/^export \{ userApprovalState, type UserApprovalRow, type UserApprovalState \} from '\.\.\/service\/userApproval';$/m.test(admin), 'AD-123-19: admin re-exports userApprovalState and its types from the shared module');
  assert(!/function userApprovalState|resolveActiveLoginContract|readAutofillProfileFromMetadata/.test(admin), 'AD-123-19: admin keeps no copy of the logic');
  assert(block(admin, 'export const USER_APPROVAL_HE') === block(head, 'export const USER_APPROVAL_HE'), 'admin badge labels byte-identical to HEAD');
  const code = admin.replace(/^import type .*$/m, '').replace(/^export \{[^}]*\} from '[^']+';$/m, '').replace(block(admin, 'export const USER_APPROVAL_HE') ?? '', '');
  assert(code.trim() === '', `AD-123-19: admin file = re-export + unchanged labels only (extra: ${code.trim().slice(0, 80)})`);
  return 'static: under src/admin only userApproval.ts changed — the re-export plus the unchanged labels';
}

function checkListingWiring(overrides) {
  const catalog = source(overrides, 'src/digitalHome/AppCatalog.tsx');
  assert(/import \{ isShownInUserCatalog \} from '\.\.\/catalog\/catalogVisibility';/.test(catalog), 'AppCatalog imports the gate');
  assert(/const listed = useMemo\(\s*\(\) => services\.filter\(\(service\) => isShownInUserCatalog\(service, selectedIds\.has\(service\.id\)\)\),\s*\[services, selectedIds\],\s*\);/.test(catalog), 'AD-123-19 (a): AppCatalog filters the listing with the gate + the current home');
  assert(/filterCatalog\(listed, \{ query: searchQuery, category: categoryFilter \}\)/.test(catalog), 'AD-123-19: search / category run on the gated list');
  assert(!/filterCatalog\(services|services\.map\(|useServiceLogos\(services\)/.test(catalog), 'AD-123-19: nothing in the catalog renders the ungated list');
  const classifier = source(overrides, 'src/catalog/addCustomServiceOutcome.ts');
  const global = classifier.slice(classifier.indexOf('if (globalMatch) {'), classifier.indexOf('const localMatch'));
  assert(global.indexOf('input.selectedIds.has(globalMatch.id)') >= 0 && global.indexOf('input.selectedIds.has(globalMatch.id)') < global.indexOf('isListedInUserCatalog(globalMatch)'), 'AD-123-19: classifier checks «already in home» before the gate');
  assert(/if \(isListedInUserCatalog\(globalMatch\)\) \{\s*return \{\s*status: 'catalog_service_available'/.test(global), 'AD-123-19: catalog_service_available only behind the gate');
  return 'static: AppCatalog lists services.filter(isShownInUserCatalog(service, in current home)) and searches / filters that list only; classifier offers catalog_service_available only behind the gate, after the «already in home» check';
}

function checkHomeNotGated(overrides) {
  const app = source(overrides, 'src/App.tsx');
  const head = headSource('src/App.tsx');
  assert(!/isListedInUserCatalog|catalogGateState|catalogVisibility/.test(app), 'AD-123-19: App does not gate its lists (home tiles / prune / execution)');
  const memo = (src) => src.slice(src.indexOf('const allServices = useMemo('), src.indexOf('const selectedServices', src.indexOf('const allServices = useMemo(')));
  assert(memo(app) === memo(head), 'AD-123-19: allServices unchanged vs HEAD');
  assert(app.includes('const selectedServices = allServices.filter((s) => selectedIds.has(s.id));'), 'AD-123-19: home tiles = every selected app');
  const prune = (src) => src.slice(src.indexOf('const pruneInactiveRef = useRef(false);'), src.indexOf('}, [', src.indexOf('const pruneInactiveRef = useRef(false);')));
  // AD-123-18 amendment A: the prune's local save also updates the outbox (one line); the rest
  // must equal HEAD.
  const outboxLine = '        const next = recordLocalCreations(current, { ...current, selectedIds: nextSelected });';
  const headLine = '        const next: VaultState = { ...current, selectedIds: nextSelected };';
  assert(prune(app).split(outboxLine).length - 1 <= 1, 'fixture: amendment A prune line found at most once');
  assert(prune(app).replace(outboxLine, headLine) === prune(head), 'AD-123-19: prune of inactive selections unchanged (runs on the ungated catalog)');
  // src/ManageServices.tsx left the list: deleted by AD-123-1 (Phase 123.4).
  for (const rel of ['src/Dashboard.tsx', 'src/loginAssistance/LoginAssistancePanel.tsx', 'src/registry/registryLoader.ts', 'src/catalog/catalogLoader.ts']) {
    assert(!/isListedInUserCatalog|catalogGateState|catalogVisibility/.test(source(overrides, rel)), `AD-123-19: ${rel} is not gated`);
  }
  for (const rel of ['src/registry/registryLoader.ts', 'src/catalog/catalogLoader.ts', 'src/registry/registryMapper.ts', 'src/execution']) {
    assert(git('diff', '--name-only', BASE, '--', rel).trim() === '', `AD-123-19: ${rel} unchanged vs HEAD (runtime loading of existing tiles)`);
  }
  // Superseded by AD-123-1 / AD-123-9 (Phase 123.4): the catalog modal is the only AppCatalog host.
  assert(!existsSync(join(root, 'src/ManageServices.tsx')), 'AD-123-1: ManageServices deleted; the catalog modal is the only AppCatalog host');
  assert(/<AppCatalogModal[\s\S]*services=\{allServices\}/.test(source(overrides, 'src/App.tsx')), 'the catalog modal renders the gated AppCatalog with allServices');
  const summary = source(overrides, 'src/dev/catalogGateSummary.ts');
  assert(/if \(!isDevBuild\(\) \|\| definitions\.length === 0\) return;/.test(summary), 'dev summary runs in dev builds only');
  assert(!/loginFields|metadata\b(?!\s*:)|credential(?!s?\))/.test(summary.replace(/^ \*.*$/gm, '').replace(/catalogGateState\(definition\)/g, '')), 'dev summary logs names / states only');
  assert(/useEffect\(\(\) => \{\n {4}logCatalogGateSummary\(catalogDefinitions\);\n {2}\}, \[catalogDefinitions\]\);/.test(app), 'App logs the dev summary from the loaded catalog');
  return 'static: App home tiles / allServices / prune unchanged vs HEAD; Dashboard home / panel / loader / mapper / execution not gated; dev summary dev-only (names + states)';
}

// ─── Mutations ────────────────────────────────────────────────────────────────
const GATE = 'src/catalog/catalogVisibility.ts';
const CLASSIFIER = 'src/catalog/addCustomServiceOutcome.ts';
const LISTED_RULE = "  return state === 'own_site' || state === 'no_stored_credentials' || state === 'approved';";
const MUTATIONS = [
  ['M1 gate lists every site', GATE, LISTED_RULE, '  return state !== null;'],
  ['M2 not_approved listed', GATE, LISTED_RULE, LISTED_RULE.replace(";", " || state === 'not_approved';")],
  ['M3 blocked listed', GATE, LISTED_RULE, LISTED_RULE.replace(";", " || state === 'blocked';")],
  ['M4 no_mapping listed', GATE, LISTED_RULE, LISTED_RULE.replace(";", " || state === 'no_mapping';")],
  ['M5 no_stored_credentials hidden', GATE, "  if (credential.status === 'no_stored_credentials') return 'no_stored_credentials';\n", ''],
  ['M6 approved hidden', GATE, LISTED_RULE, "  return state === 'own_site' || state === 'no_stored_credentials';"],
  ['M7 own site gated', GATE, "  if (entry.source === 'user-created') return 'own_site';\n", ''],
  [
    'M8 promotion alone publishes (approvalStatus)',
    GATE,
    "  if (credential.status === 'no_stored_credentials') return 'no_stored_credentials';\n",
    "  if (credential.status === 'no_stored_credentials') return 'no_stored_credentials';\n  if ((entry.metadata as Record<string, unknown> | undefined)?.approvalStatus === 'approved') return 'approved';\n",
  ],
  ['M9 no_stored inferred without the stored-schema status', GATE, '    storedLoginFieldsStatus: entry.storedLoginFieldsStatus,\n', ''],
  [
    'M10 not_configured listed',
    GATE,
    "  if (credential.status === 'no_stored_credentials') return 'no_stored_credentials';\n",
    "  if (credential.status === 'no_stored_credentials' || credential.status === 'not_configured') return 'no_stored_credentials';\n",
  ],
  ['M11 catalog lists the ungated services', 'src/digitalHome/AppCatalog.tsx', 'filterCatalog(listed, { query: searchQuery, category: categoryFilter })', 'filterCatalog(services, { query: searchQuery, category: categoryFilter })'],
  [
    'M12 classifier offers hidden sites',
    CLASSIFIER,
    "    if (isListedInUserCatalog(globalMatch)) {\n      return {\n        status: 'catalog_service_available',\n        existingServiceId: globalMatch.id,\n        displayName: globalMatch.displayName,\n      };\n    }\n",
    "    return {\n      status: 'catalog_service_available',\n      existingServiceId: globalMatch.id,\n      displayName: globalMatch.displayName,\n    };\n",
  ],
  ['M13 classifier gates before «already in home»', CLASSIFIER, '    .filter(isGlobalCatalogDefinition)\n', '    .filter(isGlobalCatalogDefinition)\n    .filter(isListedInUserCatalog)\n'],
  [
    'M14 admin keeps its own copy of the logic',
    'src/admin/userApproval.ts',
    "export { userApprovalState, type UserApprovalRow, type UserApprovalState } from '../service/userApproval';\n",
    "export type { UserApprovalRow, UserApprovalState } from '../service/userApproval';\nimport { userApprovalState as shared, type UserApprovalRow } from '../service/userApproval';\nexport function userApprovalState(row: UserApprovalRow): UserApprovalState {\n  return shared(row) === 'blocked' ? 'not_approved' : shared(row);\n}\n",
  ],
  ['M15 shared logic changed (validated without coverage)', 'src/service/userApproval.ts', '      mappingsCoverRequiredSchema(profile, resolved.fields);\n', '      true;\n'],
  ['M16 home tiles gated', 'src/App.tsx', 'const selectedServices = allServices.filter((s) => selectedIds.has(s.id));', "const selectedServices = allServices.filter((s) => selectedIds.has(s.id) && s.source !== 'built-in-catalog');"],
  ['M17 dev summary in production builds', 'src/dev/catalogGateSummary.ts', '  if (!isDevBuild() || definitions.length === 0) return;\n', '  if (definitions.length === 0) return;\n'],
  ['M18 a non-approved site in the home is not shown (AD-123-19 (a))', GATE, '  return inHome || isListedInUserCatalog(entry);', '  return isListedInUserCatalog(entry);'],
  ['M19 home membership shows every site (AD-123-19 (a))', GATE, '  return inHome || isListedInUserCatalog(entry);', '  return inHome || isListedInUserCatalog(entry) || !inHome;'],
  ['M20 catalog listing ignores the home (AD-123-19 (a))', 'src/digitalHome/AppCatalog.tsx', 'isShownInUserCatalog(service, selectedIds.has(service.id))', 'isShownInUserCatalog(service, false)'],
];

const PURE_CHECKS = [checkGateStates, checkShownInCatalog, checkSharedHelper, checkClassifier];
const STATIC_CHECKS = [checkSharedLogicUnchanged, checkAdminReexportOnly, checkListingWiring, checkHomeNotGated];

// H-1: the bundle step and every mutation run are bounded; a timeout fails the run.
const LOAD_TIMEOUT_MS = 60_000;
const MUTATION_TIMEOUT_MS = 90_000;

async function runAll(overrides) {
  const results = [];
  const { mod, used } = await withTimeout(() => loadPure(overrides), LOAD_TIMEOUT_MS, checkTimeoutMessage('loadPure'));
  const pureOverrides = Object.keys(overrides).filter((rel) => [GATE, CLASSIFIER, 'src/admin/userApproval.ts', 'src/service/userApproval.ts'].includes(rel));
  assert(used.size >= pureOverrides.length, `fixture: pure overrides loaded (${used.size}/${pureOverrides.length})`);
  for (const check of PURE_CHECKS) results.push(check(mod));
  for (const check of STATIC_CHECKS) results.push(check(overrides));
  return results;
}

async function main() {
  console.log('Phase 123.2b — Catalog visibility gate (AD-123-19)\n');
  const results = await runAll({});
  for (const line of results) console.log(`  ✓ ${line}`);
  const selected = selectMutations(MUTATIONS, MUTATION_ARGS, (m) => m[0]);
  if (selected.length) console.log(`\nMutations${MUTATION_ARGS.mode === 'ids' ? ` (selected: ${[...MUTATION_ARGS.ids].join(', ')})` : ''}`);
  let caught = 0;
  for (const [label, rel, from, to] of selected) {
    const overrides = { [rel]: replaceOnce(read(rel), from, to, label) };
    let error = null;
    try {
      const id = mutationId(label);
      await withTimeout(() => runAll(overrides), MUTATION_TIMEOUT_MS, mutationTimeoutMessage(id, MUTATION_TIMEOUT_MS));
    } catch (e) {
      if (isTimeout(e)) await failRun(`${e.message} (${label})`);
      error = e;
    }
    if (!error) throw new Error(`mutation NOT caught: ${label}`);
    if (/^fixture:/.test(error.message)) throw new Error(`mutation ${label} hit a fixture error: ${error.message}`);
    caught += 1;
    console.log(`  ✓ mutation caught: ${label} — ${error.message.split('\n')[0].slice(0, 160)}`);
  }
  const suffix = MUTATION_ARGS.mode === 'none' ? 'mutations skipped (--no-mutations)' : `${caught} ${MUTATION_ARGS.mode === 'ids' ? 'selected ' : ''}mutations caught`;
  console.log(`\nPASS — Phase 123.2b catalog gate: ${results.length} check groups, ${suffix} — ${formatElapsed(Date.now() - STARTED)}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => failRun(e.message));
