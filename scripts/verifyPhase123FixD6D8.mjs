/**
 * Phase 123 — fix round D-123-6…8.
 *
 *   D-123-6  admin approve success copy names the site, never its internal id
 *   D-123-7  validateCustomPrimaryUrl completes the scheme only (no `www.`, host / path / query kept),
 *            on create and on edit; www ⇄ non-www identity still converges
 *
 * Usage: node scripts/verifyPhase123FixD6D8.mjs [--no-mutations | --mutations=M1,M2]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
const BASE = 'af881f6b6d891894f4109aea3bf3f27bdd670b19';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const source = (overrides, rel) => overrides[rel] ?? read(rel);

const APPROVAL_QUEUE = 'src/admin/ApprovalQueue.tsx';
const CUSTOM_SERVICE = 'src/catalog/customService.ts';
const IDENTITY = 'src/supabase/registryPersistence.ts';
const PURE_FILES = [CUSTOM_SERVICE, IDENTITY, 'src/digitalHome/customSiteForm.ts', 'src/catalog/addCustomServiceOutcome.ts'];

const PURE_ENTRY = `
export { validateCustomPrimaryUrl, createCustomServiceDefinition } from './src/catalog/customService.ts';
export { buildCustomSiteDefinition } from './src/digitalHome/customSiteForm.ts';
export { classifyAddCustomService } from './src/catalog/addCustomServiceOutcome.ts';
`;
const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();

async function loadPure(overrides) {
  const dir = makeTempDir('pv-123fix-pure-');
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
          name: 'pv-123fix-overrides',
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

// ─── D-123-6 ──────────────────────────────────────────────────────────────────
const D6_LINE = '      setSuccess(`"${selected.display_name}" אושר כאתר גלובלי.`);';

function checkD6Copy(overrides) {
  const src = source(overrides, APPROVAL_QUEUE);
  const lines = src.split('\n').filter((l) => l.includes('אושר כאתר גלובלי'));
  assert(lines.length === 1, `D-123-6: one approve success line (found ${lines.length})`);
  assert(lines[0] === D6_LINE, `D-123-6: success copy is «"<display name>" אושר כאתר גלובלי.» (got ${lines[0].trim()})`);
  assert(!/globalId|\.id\b|owner_user_id/.test(lines[0]), 'D-123-6: success copy has no internal id');
  return 'D-123-6: approve success copy names the site (display_name) and prints no id';
}

function checkD6DiffScope() {
  // O-123-23 (KI-123.5-5, G-3): AdminGate.tsx / admin.css are left out here — content pinned by verifyPhase123OwnerFixes checkAdminLoginScreen.
  // O-123-29…32 (G-3): Owner-excepted admin shell / RegistryAdmin / fill-test grid — pinned by verifyPhase123OwnerFixes.
  const scope = ['src/admin', ':(exclude)src/admin/AdminGate.tsx', ':(exclude)src/admin/admin.css', ':(exclude)src/admin/AdminApp.tsx', ':(exclude)src/admin/RegistryAdmin.tsx', ':(exclude)src/admin/AdminFillTestGrid.tsx'];
  const diff = git('diff', '-U0', BASE, '--', ...scope).replace(/\r\n/g, '\n');
  const changed = diff.split('\n').filter((l) => /^[+-](?![+-]{2} )/.test(l));
  const files = git('diff', '--name-only', BASE, '--', ...scope).trim().split('\n').filter(Boolean);
  assert(files.length === 1 && files[0] === APPROVAL_QUEUE, `D-123-6: only ${APPROVAL_QUEUE} changed under src/admin (got ${files.join(', ') || 'none'})`);
  assert(changed.length === 2, `D-123-6: admin diff is one line replaced (got ${changed.length} changed lines)`);
  assert(changed[0].startsWith('-') && changed[0].includes('setSuccess(') && changed[1] === `+${D6_LINE}`, 'D-123-6: the replaced line is the success copy');
  return `D-123-6: src/admin diff vs ${BASE.slice(0, 8)} = ApprovalQueue success line only (1−/1+)`;
}

// ─── D-123-7 ──────────────────────────────────────────────────────────────────
/** [typed, expected normalizedUrl] */
const URL_CASES = [
  ['wolt.com/he/discovery', 'https://wolt.com/he/discovery'],
  ['example.co.il', 'https://example.co.il/'],
  ['example.com', 'https://example.com/'],
  ['www.example.co.il', 'https://www.example.co.il/'],
  ['https://www.example.com/a', 'https://www.example.com/a'],
  ['shop.example/a/b?x=1&y=2', 'https://shop.example/a/b?x=1&y=2'],
  ['https://shop.example/p?q=%D7%90#top', 'https://shop.example/p?q=%D7%90#top'],
  ['http://example.com/path?q=1', 'https://example.com/path?q=1'],
  ['http://www.example.com/', 'https://www.example.com/'],
  ['  sub.example.org/x  ', 'https://sub.example.org/x'],
];
const INVALID_CASES = ['', '   ', 'localhost', 'https://nodot'];

function checkD7Validator(mod) {
  for (const [typed, expected] of URL_CASES) {
    const result = mod.validateCustomPrimaryUrl(typed);
    assert(result.valid && result.normalizedUrl === expected, `D-123-7: ${JSON.stringify(typed)} → ${expected} (got ${result.valid ? result.normalizedUrl : result.message})`);
    const again = mod.validateCustomPrimaryUrl(result.normalizedUrl);
    assert(again.valid && again.normalizedUrl === expected, `D-123-7: ${expected} is stable on re-validation (blur then submit)`);
  }
  for (const typed of INVALID_CASES) {
    assert(!mod.validateCustomPrimaryUrl(typed).valid, `D-123-7: ${JSON.stringify(typed)} stays invalid`);
  }
  return `D-123-7: validator completes the scheme only — ${URL_CASES.length} cases (no www added, existing www kept, path / query kept, http → https), ${INVALID_CASES.length} invalid`;
}

const VALUES = (primaryUrl, extra = {}) => ({ displayName: 'אתר שלי', primaryUrl, category: 'shopping', sameAsWebsite: true, dedicatedLoginUrl: '', ...extra });

function checkD7CreateEdit(mod) {
  const created = mod.buildCustomSiteDefinition(VALUES(mod.validateCustomPrimaryUrl('wolt.com/he/discovery').normalizedUrl));
  assert(created.url === 'https://wolt.com/he/discovery', `D-123-7 create: url kept as typed (got ${created.url})`);
  assert(created.metadata?.faviconSiteUrl === created.url, 'D-123-7 create: faviconSiteUrl = typed url');
  assert(created.loginUrl === created.url, 'D-123-7 create: same-as-website login url = typed url');

  const stored = { id: 'custom-edit-1', metadata: { faviconSiteUrl: 'https://www.old.example/', loginUrlSource: 'user', loginEntryType: 'primary_page' } };
  const typedEdit = mod.validateCustomPrimaryUrl('old.example/new/path?tab=2').normalizedUrl;
  const edited = mod.buildCustomSiteDefinition(VALUES(typedEdit), stored);
  assert(edited.id === stored.id, 'D-123-7 edit: id kept');
  assert(edited.url === 'https://old.example/new/path?tab=2', `D-123-7 edit: stores the typed url (got ${edited.url})`);
  assert(edited.metadata?.faviconSiteUrl === edited.url, 'D-123-7 edit: faviconSiteUrl follows the typed url');

  // Edit opened on an already-stored URL (initialPrimaryUrl = service.url) saves it unchanged — no migration.
  for (const kept of ['https://www.kept.example/', 'https://kept.example/deep?x=1']) {
    const roundTrip = mod.buildCustomSiteDefinition(VALUES(mod.validateCustomPrimaryUrl(kept).normalizedUrl), { id: 'custom-edit-2', metadata: { faviconSiteUrl: kept } });
    assert(roundTrip.url === kept, `D-123-7 edit round-trip: ${kept} unchanged (got ${roundTrip.url})`);
  }
  return 'D-123-7: create + edit store the typed url (url / faviconSiteUrl / same-as-website loginUrl); edit round-trip of stored www / path urls unchanged';
}

const def = (partial) => ({ schemaVersion: 1, icon: '✦', source: 'built-in-catalog', metadata: { credentialMode: 'no_stored_credentials' }, ...partial });

function checkD7Identity(mod) {
  const catalogWww = def({ id: 'cat-www', displayName: 'W', url: 'https://www.shop.example/' });
  const catalogApex = def({ id: 'cat-apex', displayName: 'A', url: 'https://shop2.example/' });
  const own = def({ id: 'custom-own', displayName: 'U', url: 'https://www.mine.example/', source: 'user-created' });
  const cases = [
    ['shop.example', catalogWww, false, 'catalog_service_available'],
    ['shop.example', catalogWww, true, 'already_in_user_home'],
    ['www.shop2.example', catalogApex, false, 'catalog_service_available'],
    ['www.shop2.example', catalogApex, true, 'already_in_user_home'],
  ];
  for (const [typed, entry, inHome, expected] of cases) {
    const normalizedUrl = mod.validateCustomPrimaryUrl(typed).normalizedUrl;
    const outcome = mod.classifyAddCustomService({ normalizedUrl, definitions: [entry], selectedIds: new Set(inHome ? [entry.id] : []), localCustomServices: [] });
    assert(outcome?.status === expected && outcome.existingServiceId === entry.id, `D-123-7 identity: ${typed} vs ${entry.url} → ${expected} (got ${outcome?.status ?? 'null'})`);
  }
  const dup = mod.classifyAddCustomService({ normalizedUrl: mod.validateCustomPrimaryUrl('mine.example').normalizedUrl, definitions: [], selectedIds: new Set(), localCustomServices: [own] });
  assert(dup?.status === 'same_user_custom_duplicate', 'D-123-7 identity: non-www vs own www custom → same-user duplicate');
  return 'D-123-7: www ⇄ non-www identity converges (catalog offer, «already in home», same-user duplicate)';
}

function checkD7Static(overrides) {
  const svc = source(overrides, CUSTOM_SERVICE);
  const fn = svc.slice(svc.indexOf('export function validateCustomPrimaryUrl'), svc.indexOf('export interface CreateCustomServiceInput'));
  assert(fn.length > 0, 'fixture: validator source located');
  assert(!/www/i.test(fn.replace(/^\s*(\/\/|\*).*$/gm, '')), 'D-123-7: validator code never mentions www');
  assert(!/isLikelyApexHostname/.test(svc), 'D-123-7: apex-host www helper removed');
  const modal = source(overrides, 'src/AddSiteModal.tsx');
  assert(/const result = validateCustomPrimaryUrl\(url\);/.test(modal) && /primaryUrl: normalized,/.test(modal), 'D-123-7: AddSiteModal (create + edit) submits the validator output');
  const edit = source(overrides, 'src/digitalHome/EditSiteDetailsModal.tsx');
  assert(/initialPrimaryUrl=\{service\.url\}/.test(edit) && /buildCustomSiteDefinition\(values, \{/.test(edit), 'D-123-7: edit opens on the stored url and saves the form values');
  const form = source(overrides, 'src/digitalHome/customSiteForm.ts');
  assert(/primaryUrl: values\.primaryUrl,/.test(form), 'D-123-7: buildCustomSiteDefinition passes the typed url');
  for (const rel of [CUSTOM_SERVICE, 'src/digitalHome/customSiteForm.ts']) {
    const code = source(overrides, rel).replace(/typeof [\w.]+ === '\w+'/g, '');
    assert(!/hostname\s*===\s*['"]|serviceId\s*===\s*['"]|\.id\s*===\s*['"]/.test(code), `product: no site / hostname / id branch in ${rel}`);
  }
  return 'D-123-7 static: no www in the validator, create / edit wired through it, no site branches';
}

// ─── Mutations ────────────────────────────────────────────────────────────────
const RETURN_OK = '    return { valid: true, normalizedUrl: parsed.href };';
const MUTATIONS = [
  ['M1 www re-added to bare hosts', CUSTOM_SERVICE, RETURN_OK, "    if (!parsed.hostname.startsWith('www.')) parsed.hostname = `www.${parsed.hostname}`;\n" + RETURN_OK],
  ['M2 path / query dropped', CUSTOM_SERVICE, RETURN_OK, '    return { valid: true, normalizedUrl: `${parsed.origin}/` };'],
  ['M3 query dropped', CUSTOM_SERVICE, RETURN_OK, '    return { valid: true, normalizedUrl: `${parsed.origin}${parsed.pathname}` };'],
  ['M4 www stripped', CUSTOM_SERVICE, RETURN_OK, "    parsed.hostname = parsed.hostname.replace(/^www\\./, '');\n" + RETURN_OK],
  ['M5 http kept as http', CUSTOM_SERVICE, "      candidate = `https://${candidate.slice('http://'.length)}`;", '      candidate = candidate;'],
  [
    'M6 edit overwrites the typed url with the stored one',
    CUSTOM_SERVICE,
    '    url: urlValidation.normalizedUrl,\n',
    "    url: input.id && typeof input.metadata?.faviconSiteUrl === 'string' ? input.metadata.faviconSiteUrl : urlValidation.normalizedUrl,\n",
  ],
  ['M7 www / non-www identity broken', IDENTITY, "    const host = parsed.hostname.replace(/^www\\./i, '').toLowerCase();", '    const host = parsed.hostname.toLowerCase();'],
  ['M8 D-123-6 id back in the success copy', APPROVAL_QUEUE, D6_LINE, '      setSuccess(`אושר כאתר גלובלי (${globalId}).`);'],
  ['M9 D-123-6 id appended to the name', APPROVAL_QUEUE, D6_LINE, '      setSuccess(`"${selected.display_name}" אושר כאתר גלובלי (${globalId}).`);'],
];

const PURE_CHECKS = [checkD7Validator, checkD7CreateEdit, checkD7Identity];
const STATIC_CHECKS = [checkD6Copy, checkD7Static];

// H-1: the bundle step and every mutation run are bounded; a timeout fails the run.
const LOAD_TIMEOUT_MS = 60_000;
const MUTATION_TIMEOUT_MS = 90_000;

async function runAll(overrides) {
  const results = [];
  const { mod, used } = await withTimeout(() => loadPure(overrides), LOAD_TIMEOUT_MS, checkTimeoutMessage('loadPure'));
  const pureOverrides = Object.keys(overrides).filter((rel) => PURE_FILES.includes(rel));
  assert(used.size >= pureOverrides.length, `fixture: pure overrides loaded (${used.size}/${pureOverrides.length})`);
  for (const check of PURE_CHECKS) results.push(check(mod));
  for (const check of STATIC_CHECKS) results.push(check(overrides));
  return results;
}

async function main() {
  console.log('Phase 123 — fix round D-123-6…8\n');
  const results = [...(await runAll({})), checkD6DiffScope()];
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
  console.log(`\nPASS — Phase 123 fix round D-123-6…8: ${results.length} check groups, ${suffix} — ${formatElapsed(Date.now() - STARTED)}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => failRun(e.message));
