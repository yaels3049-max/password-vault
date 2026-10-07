/**
 * Phase 123.5 — Owner run fixes O-123-1…12 + O-2 (Architect rulings 2026-10-06).
 *
 * Three layers, each run on the real sources (mutations are applied in memory):
 *  - SQL (unit layer, PGlite): the real registry migrations + the O-123-9 owner-select policy;
 *  - static: catalog card markup / CSS, hint removed, O-2 comment placement, failure-line CSS,
 *    no app outcome routed to the Digital Home banner, and the N-checks against BASE `e91b5b12`
 *    (auth diff = register.ts + the O-123-24 copy.ts title, frozen trees unchanged, no browser dialogs, no id / host literals);
 *  - unit: the REAL src/auth/register.ts (+ real session.ts / copy.ts) bundled with a stubbed
 *    Supabase client — orphan recovery vs a profile row that already existed (O-123-2);
 *  - browser (Edge via Playwright): the REAL App.tsx with the real Dashboard, catalog, floating
 *    window, profile modal and remove dialog. Stubbed seams only (cloud, vault storage without
 *    crypto, auth, catalog loaders, assistance results). Synthetic fixtures only; no credential
 *    value is logged.
 *
 * Usage: node scripts/verifyPhase123OwnerFixes.mjs [--no-mutations | --mutations=M1,M2] [--report-groups]
 *        No mutation switch = full sweep (test policy T-1). --report-groups runs every group and
 *        prints each result (used for the Stage A "before" state); it exits 1 when any group fails.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { makeTempDir, removeTempDir } from './lib/tempDir.mjs';
import { revertPhase126PartAManifest, withoutPhase126PartA } from './lib/phase126PartA.mjs';
import { formatElapsed, mutationId, parseMutationArgs, selectMutations } from './lib/mutationArgs.mjs';
import { assertSecureContext, registerHarnessDir, routeHarness } from './lib/routeHarness.mjs';
import { checkTimeoutMessage, closeServer, failRun, isTimeout, mutationTimeoutMessage, withTimeout } from './lib/withTimeout.mjs';

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
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\r\n/g, '\n');
/** The 123.5 baseline (WIP commit of the approved 123.4 tree). */
const BASE = 'e91b5b12';
const baseFile = (rel) => git('show', `${BASE}:${rel}`);
const MUTATION_ARGS = parseMutationArgs();
const REPORT_GROUPS = process.argv.includes('--report-groups');
const STARTED = Date.now();
const source = (overrides, rel) => overrides[rel] ?? read(rel);

const APP = 'src/App.tsx';
const DASH = 'src/Dashboard.tsx';
const PANEL = 'src/loginAssistance/LoginAssistancePanel.tsx';
const CARD = 'src/components/ServiceCard.tsx';
const CSS = 'src/App.css';
const DIALOG = 'src/digitalHome/RemoveAppConfirmDialog.tsx';
const MODAL = 'src/ServiceProfileManagementModal.tsx';
const HOST = 'src/loginAssistance/DigitalHomeCredentialModal.tsx';
const REGISTER = 'src/auth/register.ts';
const LA_MESSAGES = 'src/loginAssistance/messages.ts';
const ADD_SITE = 'src/AddSiteModal.tsx';
const CATALOG = 'src/digitalHome/AppCatalog.tsx';
const CMODAL = 'src/digitalHome/AppCatalogModal.tsx';
const CMSG = 'src/digitalHome/catalogMessages.ts';
const RECONCILE = 'src/digitalHome/cloudReconcile.ts';
/** O-123-16 (narrow N-2 copy exception): the one cloudReconcile.ts line allowed to differ — [now, BASE]. */
const O16_LINE = [
  "export const MSG_REMOVED_ELSEWHERE = 'האתר או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.';",
  "export const MSG_REMOVED_ELSEWHERE = 'האפליקציה או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.';",
];
const OWNER_SELECT_MIGRATION = 'supabase/migrations/20261006120000_phase123_registry_owner_select.sql';

const HE = {
  addApp: '+ הוספת אפליקציה',
  // O-123-35 (G-3): the in-home catalog label was «✓ כבר בבית הדיגיטלי».
  added: '✓ כבר נוסף',
  hint: 'אפשר לשמור פרופיל גם בלי פרטי כניסה ולהוסיף אותם אחר כך.',
  // O-123-21 (G-3): the O-123-4 ≥ 1-profile paragraph was «…של האפליקציה…».
  confirmBody: 'כל הפרופילים ופרטי ההתחברות של האתר יימחקו מכל המכשירים שלך.',
  removeSite: 'הסרת אתר',
  first: 'ראשי',
  nameRequired: 'יש להזין שם פרופיל',
  nameTaken: 'כבר קיים פרופיל בשם הזה. בחרו שם אחר.',
  rename: 'שינוי שם פרופיל',
  addAnother: '+ הוספת פרופיל נוסף',
  saveProfile: 'שמירת פרופיל',
  saveName: 'שמור שם',
  deleteProfile: 'מחיקת פרופיל',
  // A failed catalog resolves no apps, so the Digital Home shows its 0-apps catalog notice.
  catalogDown: 'קטלוג האפליקציות אינו זמין כרגע.',
  openFailed: 'לא ניתן לפתוח את האתר כרגע (בדיקה).',
  autoFailed: 'המילוי האוטומטי נכשל (בדיקה).',
  opened: 'האתר נפתח בכרטיסייה חדשה (בדיקה).',
};

// ─── Fixtures (synthetic) ─────────────────────────────────────────────────────
const T0 = '2026-10-01T00:00:00.000Z';
const FIELDS = [
  { id: 'username', label: 'שם משתמש', type: 'text' },
  { id: 'password', label: 'סיסמה', type: 'password' },
];
const approvedMapping = (host) => ({
  supportState: 'validated',
  configVersion: 1,
  loginEntryUrl: `https://${host}/login`,
  allowedOrigin: `https://${host}`,
  fieldMappings: FIELDS.map((f) => ({ fieldId: f.id, locatorType: 'css', locator: `#${f.id}` })),
  validation: { metadataVersion: 1, validatedBy: 'admin' },
});
const def = (id, displayName, category, host) => ({
  schemaVersion: 1,
  id,
  displayName,
  url: `https://${host}/`,
  category,
  icon: '🔗',
  source: 'built-in-catalog',
  loginFields: FIELDS,
  metadata: { credentialMode: 'credential_fields', autofillProfile: approvedMapping(host) },
});
// The window offers «מילוי אוטומטי» only for an autofill-capable support level.
const withAutofill = (d) => ({ ...d, metadata: { ...d.metadata, loginAssistanceLevel: 'best_effort' } });
const prof = (id, serviceId, displayName, isDefault = false) => ({ schemaVersion: 1, id, serviceId, displayName, createdAt: T0, updatedAt: T0, ...(isDefault ? { isDefault: true } : {}) });
const LONG_NAME = 'שם ארוך מאוד של אפליקציה לבדיקה שחייב להיחתך אחרי שתי שורות בכרטיס הקטלוג ולא לשנות את גודל הכרטיס';
const APPS_VAULT = {
  selectedIds: ['svc-cred', 'svc-zero', 'svc-one', 'svc-two'],
  customServices: [],
  accessProfiles: [
    prof('p-cred', 'svc-cred', HE.first, true),
    prof('p-one', 'svc-one', 'אישי', true),
    prof('p-two-a', 'svc-two', 'אלף', true),
    prof('p-two-b', 'svc-two', 'בית'),
  ],
  credentials: { 'p-cred': { username: 'fixture-user', password: 'fixture-pass' } },
  syncOutbox: { serviceIds: [], profileIds: [] },
};
const EMPTY_VAULT = { selectedIds: [], customServices: [], accessProfiles: [], credentials: {}, syncOutbox: { serviceIds: [], profileIds: [] } };
const FIXTURE = {
  profile: { id: 'user-1235-test', email: 'fixture@example.test', firstName: 'בדיקה', lastName: '' },
  categories: [
    { id: 'banking', display_name: 'בנקים', sort_order: 10 },
    { id: 'shopping', display_name: 'קניות', sort_order: 30 },
  ],
  catalog: [
    withAutofill(def('svc-cred', 'בנק עם פרטים', 'banking', 'cred-bank.example.test')),
    def('svc-zero', 'אפס פרופילים', 'shopping', 'zero.example.test'),
    def('svc-one', 'פרופיל יחיד', 'shopping', 'one.example.test'),
    def('svc-two', 'שני פרופילים', 'shopping', 'two.example.test'),
    def('svc-long', LONG_NAME, 'shopping', 'long.example.test'),
    def('svc-avail', 'חנות זמינה', 'shopping', 'avail.example.test'),
    def('svc-a3', 'חנות ג', 'shopping', 'a3.example.test'),
    def('svc-a4', 'חנות ד', 'shopping', 'a4.example.test'),
    def('svc-a5', 'חנות ה', 'shopping', 'a5.example.test'),
    def('svc-a6', 'חנות ו', 'shopping', 'a6.example.test'),
  ],
  vault: APPS_VAULT,
};

// ─── Layer 1: static ──────────────────────────────────────────────────────────
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
function cssRule(css, selector) {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return null;
  return css.slice(at, css.indexOf('}', at) + 1);
}
function userSrcFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (rel === 'src/admin') continue;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx|css|json|md)$/.test(name)) out.push(rel);
    }
  };
  walk('src');
  return out;
}

function checkCatalogCardStatic(overrides) {
  // O-123-35 (G-3): the O-123-1 rules apply to the picker card (was the compact ServiceCard with a
  // per-card action at its bottom — that action no longer exists).
  const catalogSrc = source(overrides, CATALOG);
  assert(catalogSrc.includes('<span className="sm-pick-name" title={service.name}>'), 'O-123-1: catalog card name carries the full name in `title`');
  const css = source(overrides, CSS);
  assert(/grid-auto-rows:\s*1fr;/.test(cssRule(css, '.sm-pick-grid') ?? ''), 'O-123-1: catalog grid rows share one height (grid-auto-rows: 1fr)');
  const name = cssRule(css, '.sm-pick-name') ?? '';
  assert(/-webkit-line-clamp:\s*2;/.test(name) && /overflow:\s*hidden;/.test(name) && /line-height:\s*[\d.]+;/.test(name), 'O-123-1: catalog name clamps to 2 lines (explicit line height)');
  return 'static O-123-1 (on the O-123-35 card): name `title`; equal rows, 2-line clamp';
}

function checkHintRemoved(overrides) {
  for (const rel of userSrcFiles()) {
    assert(!source(overrides, rel).includes(HE.hint), `O-123-7: hint «${HE.hint}» still in user ${rel}`);
  }
  assert(!/MSG_ADD_OPTIONAL/.test(source(overrides, MODAL)), 'O-123-7: MSG_ADD_OPTIONAL removed');
  return 'static O-123-7: the optional-credentials hint is absent from user src/';
}

function checkMessagesComments(overrides) {
  const msgs = source(overrides, LA_MESSAGES);
  // O-123-11 removed MSG_REMOVED_ELSEWHERE_PLAIN together with its doc comment (the other O-2 half).
  assert(!/MSG_REMOVED_ELSEWHERE_PLAIN|Removed-elsewhere notice/.test(msgs), 'O-123-11: the plain removed-elsewhere constant and its comment are gone');
  assert(/\/\*\*\n \* AD-123-1: replaces the execution-layer credentials_missing copy[^]*?\*\/\nexport const MSG_AUTOFILL_CREDENTIALS_MISSING =/.test(msgs), 'O-2: the AD-123-1 doc comment sits directly above MSG_AUTOFILL_CREDENTIALS_MISSING');
  const values = (src) => [...src.matchAll(/^export const (\w+) =\s*'([^']*)'/gm)].map((m) => `${m[1]}=${m[2]}`).filter((v) => !v.startsWith('MSG_REMOVED_ELSEWHERE_PLAIN=')).join('\n');
  // O-123-15 / O-123-20 / O-123-26 (G-3): only these values may differ from BASE, and only to the Owner's copy.
  const base = values(baseFile(LA_MESSAGES))
    .replace('LABEL_TRY_AUTO=נסה מילוי אוטומטי', 'LABEL_TRY_AUTO=מילוי פרטים אוטומטי')
    .replace('LABEL_REMOVE_APP=הסרת אפליקציה', 'LABEL_REMOVE_APP=הסרת אתר')
    .replace('LABEL_EDIT_PROFILE=עריכת פרופיל', `LABEL_EDIT_PROFILE=עריכת פרופיל\nLABEL_COMPLETE_CREDENTIALS=${O26_COMPLETE}`)
    .replace('MSG_AUTOFILL_CREDENTIALS_MISSING=פרטי הכניסה בפרופיל הזה חסרים. לחצו «עריכת פרופיל» בחלון האפליקציה והשלימו אותם.', `MSG_AUTOFILL_CREDENTIALS_MISSING=${O26_MESSAGE}`);
  assert(values(msgs) === base, 'O-2: placement only — every other message constant and copy unchanged vs BASE');
  return 'static O-2 / O-123-11: AD-123-1 comment directly above its constant; plain removed-elsewhere constant gone; other copy unchanged';
}

function checkFailureCss(overrides) {
  const css = source(overrides, CSS);
  const flash = cssRule(css, '.la-panel-failure-flash') ?? '';
  // O-123-42 (G-3): was a 2 s ease-out fade from the first moment, hidden under reduced motion.
  assert(/animation:\s*la-panel-failure-fade 5s;/.test(flash) && /pointer-events:\s*none;/.test(flash), 'O-123-42: failure flash = one 5 s animation, not clickable');
  assert(/@keyframes la-panel-failure-fade \{\s*0%,\s*60% \{\s*opacity: 1;\s*animation-timing-function: ease-out;\s*\}\s*100% \{\s*opacity: 0;\s*\}\s*\}/.test(css), 'O-123-42: full opacity 0–60 % (3 s), then the ease-out fade 60–100 % (2 s)');
  assert(/@keyframes la-panel-failure-hold \{\s*from,\s*to \{\s*opacity: 1;\s*\}\s*\}/.test(css), 'O-123-42: reduced-motion hold keyframes = static full opacity');
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\.la-panel-failure-flash \{([^}]*)\}/);
  assert(reduced && /animation:\s*la-panel-failure-hold 3s;/.test(reduced[1]) && !/display:\s*none/.test(reduced[1]) && !/forwards|both/.test(reduced[1]), 'O-123-42: prefers-reduced-motion → static for 3 s, then removed (no fill, not hidden)');
  assert(/color:\s*#991b1b;/.test(cssRule(css, '.la-panel-status--error') ?? ''), 'O-123-8: the failure line is red');
  return 'static O-123-8 / O-123-42: red failure line; wash full opacity 3 s then 2 s ease-out fade (5 s); reduced motion static 3 s then removed';
}

function checkPostAddStatic(overrides) {
  const catalogSrc = stripComments(source(overrides, CATALOG));
  // O-123-39: the custom add hands over to the store add's post-add path; the O-123-28 parts are gone.
  assert(catalogSrc.includes('if (onAddSequenceDone) onAddSequenceDone([definition.id]);'), 'O-123-39: the custom add uses the shared post-add path (onAddSequenceDone)');
  for (const gone of ['האתר נוסף לבית הדיגיטלי', 'data-catalog-notice', 'app-catalog-just-added-chip', 'data-just-added', 'scrollIntoView', 'ADD_FORM_FADE_MS']) {
    assert(!catalogSrc.includes(gone), `O-123-39: the O-123-28 in-catalog part «${gone}» is removed`);
  }
  // O-123-41: one shared highlight duration for every add.
  const durations = userSrcFiles().flatMap((rel) => [...stripComments(source(overrides, rel)).matchAll(/\b(\w*JUST_ADDED\w*_MS)\s*=\s*([\d_]+)/g)].map((m) => `${rel}:${m[1]}=${m[2]}`));
  assert(durations.length === 1 && durations[0] === `${DASH}:HOME_JUST_ADDED_MS=5000`, `O-123-41: exactly one 5 s highlight constant (got ${durations.join(', ') || 'none'})`);
  const css = source(overrides, CSS);
  assert(!css.includes('.app-catalog-item--just-added') && !css.includes('.app-catalog-status'), 'O-123-39: the catalog card highlight / status-line styles are removed');
  // O-123-40: the dimming stays off the «✓ כבר נוסף» label.
  const card = cssRule(css, '.sm-pick--in-home') ?? '';
  const label = cssRule(css, '.sm-pick-in-home') ?? '';
  assert(card && !/opacity/.test(card), 'O-123-40: no opacity on the whole in-home card');
  assert(/font-weight:\s*(600|700);/.test(label) && !/opacity/.test(label), 'O-123-40: «✓ כבר נוסף» bold 600–700, no opacity');
  // O-123-43: the frame breathes (100 % ↔ 40 %, ~1.6 s cycle, ease-in-out), then fades out in the last ~1 s; 5 s total.
  const frame = cssRule(css, '.app-icon-wrap--just-added') ?? '';
  const frameAnim = /animation:\s*dh-home-just-added (\d+(?:\.\d+)?)s ease-in-out forwards;/.exec(frame);
  assert(frameAnim && Number(frameAnim[1]) * 1000 === 5000, `O-123-43: the frame runs dh-home-just-added for HOME_JUST_ADDED_MS (5 s) ease-in-out, holding the last frame (got ${/animation:[^;]*/.exec(frame)?.[0] ?? 'none'})`);
  const kf = /@keyframes dh-home-just-added \{\n([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const stops = [...kf.matchAll(/^\s*(\d+)% \{ box-shadow: ([^}]*); \}$/gm)].map((m) => ({
    at: Number(m[1]) / 100,
    colours: [...m[2].matchAll(/rgba?\(([^)]*)\)|#[0-9a-f]{3,8}\b/gi)].map((c) => c[0]),
    ring: Number(/rgba\(34, 197, 94, ([\d.]+)\)/.exec(m[2])?.[1] ?? NaN),
  }));
  assert(stops.length >= 5 && stops[0].at === 0 && stops[stops.length - 1].at === 1, `O-123-43: dh-home-just-added keyframes 0 %…100 %, one box-shadow per stop (got ${stops.length})`);
  assert(stops.every((st) => st.colours.length > 0 && st.colours.every((c) => /^rgba\(34, 197, 94, [\d.]+\)$/.test(c))), 'O-123-43: one green (34, 197, 94) at every stop, intensity by alpha only (no colour jumps)');
  const body = stops.slice(0, -1);
  const dims = body.filter((st) => st.ring >= 0.3 && st.ring <= 0.5);
  assert(body.every((st) => st.ring >= 0.95 || (st.ring >= 0.3 && st.ring <= 0.5)) && body.every((st, i) => i === 0 || (st.ring < 0.95) !== (body[i - 1].ring < 0.95)), 'O-123-43: the stops alternate between ~100 % and ~40 % (soft breathing)');
  const cycles = dims.slice(1).map((st, i) => (st.at - dims[i].at) * 5);
  assert(dims.length >= 2 && cycles.every((c) => c >= 1.4 && c <= 1.8), `O-123-43: two to three ~1.6 s breathing cycles (got ${cycles.map((c) => c.toFixed(2)).join(', ') || 'none'} s), far below 3 flashes / s`);
  const fadeS = (1 - body[body.length - 1].at) * 5;
  assert(stops[stops.length - 1].ring === 0 && fadeS >= 0.75 && fadeS <= 1.25, `O-123-43: the last ~1 s fades the frame and glow to nothing (got ${fadeS.toFixed(2)} s to alpha ${stops[stops.length - 1].ring})`);
  const reducedBlock = /@media \(prefers-reduced-motion: reduce\) \{\n {2}\.sm-pick,\n([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  assert(reducedBlock.includes('.app-icon-wrap--just-added') && /animation:\s*none;/.test(reducedBlock), 'O-123-43: prefers-reduced-motion → no breathing / fade, static frame for the 5 s');
  // O-123-44: one shared 500 ms exit for the catalog and the add form inside it; reduced motion closes at once.
  const fades = userSrcFiles().flatMap((rel) => [...stripComments(source(overrides, rel)).matchAll(/\b(\w*FADE_MS)\s*=\s*([\d_]+)/g)].map((m) => `${rel}:${m[1]}=${m[2]}`));
  assert(fades.length === 1 && fades[0] === `${CMODAL}:CATALOG_FADE_MS=500`, `O-123-44: exactly one 500 ms catalog fade constant (got ${fades.join(', ') || 'none'})`);
  const exitRule = cssRule(css, ".dh-catalog-overlay[data-closing='true']") ?? '';
  assert(/animation:\s*dh-catalog-exit 500ms ease-out forwards;/.test(exitRule), `O-123-44: the closing catalog runs dh-catalog-exit 500 ms ease-out (= CATALOG_FADE_MS) (got ${/animation:[^;]*/.exec(exitRule)?.[0] ?? 'none'})`);
  const exitKf = /@keyframes dh-catalog-exit \{\n([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const exitTo = /to \{ opacity: 0; transform: scale\((0\.\d+)\); \}/.exec(exitKf);
  assert(exitTo && Number(exitTo[1]) >= 0.97 && Number(exitTo[1]) <= 0.99, 'O-123-44: dh-catalog-exit ends at opacity 0 with a slight scale (~0.98)');
  assert(reducedBlock.includes(".dh-catalog-overlay[data-closing='true']"), 'O-123-35 / O-123-44: the catalog fade is off under prefers-reduced-motion');
  const modalSrc = stripComments(source(overrides, CMODAL));
  const finish = modalSrc.slice(modalSrc.indexOf('function finishAdd('), modalSrc.indexOf('return (', modalSrc.indexOf('function finishAdd(')));
  const reducedAt = finish.indexOf("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
  assert(reducedAt >= 0 && reducedAt < finish.indexOf('setClosing(true)') && /\{\s*done\(\);\s*return;\s*\}/.test(finish.slice(reducedAt)), 'O-123-44: prefers-reduced-motion → finishAdd hands over at once, before any fade state');
  assert(/inert=\{closing\}/.test(modalSrc), 'O-123-44: interaction is blocked during the fade (inert)');
  return 'static O-123-39 / 40 / 41 / 43 / 44: custom add → shared onAddSequenceDone, O-123-28 in-catalog parts removed; one HOME_JUST_ADDED_MS = 5000; in-home dimming off the bold label; frame breathes 100 ↔ 40 % (~1.6 s, green only) then fades in the last ~1 s, static under reduced motion; one CATALOG_FADE_MS = 500 = dh-catalog-exit (opacity 0, scale 0.98, ease-out), inert, reduced motion closes at once';
}

function block(src, startMarker, endMarker, label) {
  const at = src.indexOf(startMarker);
  const end = at < 0 ? -1 : src.indexOf(endMarker, at);
  assert(at >= 0 && end > at, `fixture: BASE block "${label}" not found`);
  return src.slice(at, end + endMarker.length);
}
function checkBannerRouting(overrides) {
  const dash = source(overrides, DASH);
  const panelSrc = source(overrides, PANEL);
  assert(!/onStatus/.test(stripComments(dash)) && !/onStatus/.test(stripComments(panelSrc)), 'O-123-8: no app outcome route from the window to the Digital Home banner (onStatus)');
  assert(!/la-home-notice/.test(dash), 'O-123-8: the Digital Home has no app outcome banner');
  const baseDash = baseFile(DASH);
  const reconcile = block(baseDash, '      {reconcileNotice && (', '      )}\n', 'reconcile notice');
  assert(dash.includes(reconcile), 'O-123-8: the "removed elsewhere" notice is unchanged');
  const catalogBanner = block(baseDash, '      {catalogError && (', '      )}\n', 'catalog banner');
  assert(dash.includes(catalogBanner), 'O-123-8: the catalog-unavailable banner is unchanged');
  const baseApp = baseFile(APP);
  const homeError = block(baseApp, '      {homeError && (', '      )}\n', 'remove / selection error banner');
  assert(source(overrides, APP).includes(homeError) && source(overrides, APP).includes('const homeError = removeError ?? (catalogOpen ? null : selectionError);'), 'O-123-8: the remove-failure / selection-error banner is unchanged');
  return 'static O-123-8: no onStatus route; catalog-unavailable, remove / selection error and removed-elsewhere banners unchanged vs BASE';
}

const PERSIST = 'src/supabase/persistence.ts';
/** [current text, BASE text] — the only O-123-17 changes allowed in persistence.ts. */
const O17_PERSIST_HUNKS = [
  [
    "/** O-123-17: `code` of the error thrown when the cloud delete removed no row. */\nexport const PROFILE_DELETE_UNCONFIRMED = 'profile_delete_unconfirmed';\n\n/**\n * Explicit user delete-profile only",
    '/**\n * Explicit user delete-profile only',
  ],
  [
    "  const { data, error } = await supabase\n    .from('access_profiles')\n    .delete()\n    .eq('user_id', userId)\n    .eq('local_profile_id', trimmed)\n    .select('id');\n\n  if (error) {\n    throw error;\n  }\n  // O-123-17: a delete that matched no row proves nothing — a surviving row would come back.\n  if (!data || data.length === 0) {\n    throw Object.assign(new Error('Cloud profile delete removed no row'), {\n      code: PROFILE_DELETE_UNCONFIRMED,\n    });\n  }\n  forgetProfile(userId, trimmed);",
    "  const { error } = await supabase\n    .from('access_profiles')\n    .delete()\n    .eq('user_id', userId)\n    .eq('local_profile_id', trimmed);\n\n  if (error) {\n    throw error;\n  }\n  forgetProfile(userId, trimmed);",
  ],
];

const O17_HOST_HUNKS = [
  [
    "  deleteCloudEncryptedCredentialByLocalProfileId,\n  PROFILE_DELETE_UNCONFIRMED,\n} from '../supabase/persistence';\nimport { outboxOf } from '../vault/syncOutbox';\n",
    "  deleteCloudEncryptedCredentialByLocalProfileId,\n} from '../supabase/persistence';\n",
  ],
  [
    "        // O-123-17: only a profile still waiting for its first cloud insert may have no row to remove.\n        const neverInCloud = outboxOf(vaultState).profileIds.includes(profileId);\n        try {",
    '        try {',
  ],
  [
    "        } catch (error) {\n          const noRow = (error as { code?: unknown } | null)?.code === PROFILE_DELETE_UNCONFIRMED;\n          if (!(noRow && neverInCloud)) {\n            if (import.meta.env.DEV) {\n              console.warn('[vault] cloud delete-profile failed:', error);\n            }\n            setProfileError(PROFILE_DELETE_CLOUD_FAILED_MESSAGE);\n            throw new Error(PROFILE_DELETE_CLOUD_FAILED_MESSAGE);\n          }\n        }",
    "        } catch (error) {\n          if (import.meta.env.DEV) {\n            console.warn('[vault] cloud delete-profile failed:', error);\n          }\n          setProfileError(PROFILE_DELETE_CLOUD_FAILED_MESSAGE);\n          throw new Error(PROFILE_DELETE_CLOUD_FAILED_MESSAGE);\n        }",
  ],
];

const AUTH_COPY_FILE = 'src/auth/copy.ts';
/** [current line, BASE line] — the only O-123-24 change allowed in src/auth/copy.ts. */
const O24_TITLE_LINE = ["  productTitle: 'הבית הדיגיטלי',", "  productTitle: 'כספת דיגיטלית',"];
/** [current lines, BASE line] — the O-123-33 change in src/auth/copy.ts. */
const O33_COPY_LINES = [
  "  registerDuplicate: 'כבר קיים חשבון עם כתובת אימייל זו. נסו להתחבר במסך התחברות.',\n  /** O-123-33: the single button of the duplicate-e-mail dialog. */\n  registerDuplicateClose: 'סגור',",
  "  registerDuplicate: 'כבר קיים חשבון עם כתובת אימייל זו. נסו להתחבר במסך «התחברות».',",
];
const ADMIN_GATE = 'src/admin/AdminGate.tsx';
const ADMIN_CSS = 'src/admin/admin.css';
const O23_HEADING = 'הבית הדיגיטלי - ניהול';
const O23_OLD_SUBTITLE = '          subtitle="התחבר כדי לנהל את שירותי המערכת, המשתמשים, ההרשאות ותצורת הכספת."\n';
const O23_OLD_LINK = '        <p className="admin-gate-home-link">\n          <a className="admin-link" href="#/">\n            חזרה לבית הדיגיטלי\n          </a>\n        </p>\n';
/** [current text, BASE text] — the only O-123-23 changes allowed under src/admin (need_login branch + its unused CSS). */
const O23_GATE_HUNKS = [
  [
    `          heading="${O23_HEADING}"\n          onAuthenticated={handleAdminAuthenticated}\n        />\n      </div>`,
    `          heading="מרכז הבקרה"\n${O23_OLD_SUBTITLE}          onAuthenticated={handleAdminAuthenticated}\n        />\n${O23_OLD_LINK}      </div>`,
  ],
];
const O23_CSS_HUNKS = [
  ['.admin-gate--login .unlock {\n  width: 100%;', '.admin-gate--login .unlock,\n.admin-gate--login .admin-gate-home-link {\n  width: 100%;'],
  ['  border-radius: 10px;\n}\n\n@media (max-width: 640px) {', '  border-radius: 10px;\n}\n\n.admin-gate--login .admin-gate-home-link {\n  margin-top: 0.35rem;\n  font-size: 0.95rem;\n}\n\n@media (max-width: 640px) {'],
  ['  }\n}\n\n.admin-gate--denied h1 {', '  }\n}\n\n.admin-gate-home-link {\n  margin: 0;\n}\n\n.admin-gate--denied h1 {'],
];
/** O-123-29 / O-123-30: admin.css without the appended Phase 123.5 block (its content is pinned in Edge). */
const O29_CSS_MARK = '\n/* Phase 123.5 O-123-29';
function withoutO29Block(text) {
  const css = text.replace(/\r\n/g, '\n');
  const at = css.indexOf(O29_CSS_MARK);
  return at === -1 ? css : css.slice(0, at);
}
function revertHunks(text, hunks, tag) {
  let out = text.replace(/\r\n/g, '\n');
  for (const [now, before] of hunks) {
    assert(out.split(now).length === 2, `${tag}: carries each allowed hunk exactly once`);
    out = out.replace(now, () => before);
  }
  return out;
}

function checkNChecks(overrides) {
  const auth = git('diff', '--name-only', BASE, '--', 'src/auth').split('\n').filter(Boolean);
  const authNew = git('ls-files', '--others', '--exclude-standard', '--', 'src/auth').split('\n').filter(Boolean);
  // O-123-24 (G-3): copy.ts may differ by the productTitle line only (checked in checkUserLoginTitle).
  // O-123-33 (G-3): plus the duplicate copy, and AuthEntryScreen.tsx (screen layer; checkRegisterDuplicateDialog).
  assert(authNew.length === 0 && auth.every((rel) => rel === REGISTER || rel === AUTH_COPY_FILE || rel === 'src/auth/AuthEntryScreen.tsx'), `N-2 / O-123-2 / O-123-24 / O-123-33: src/auth diff limited to register.ts, the copy.ts lines and AuthEntryScreen.tsx (got ${[...auth, ...authNew].join(', ')})`);
  const frozen = ['src/admin', 'src/vault', 'src/supabase', 'src/execution', 'src/digitalHome/cloudReconcile.ts', 'src/profile', 'extension'];
  // O-123-17 (G-3): persistence.ts may differ from BASE by the delete-proof hunks only (checked below).
  // O-123-16 (G-3): cloudReconcile.ts may differ by the MSG_REMOVED_ELSEWHERE line only (checked below).
  // O-123-23 (G-3): AdminGate.tsx / admin.css may differ by the O23 hunks only (checked in checkAdminLoginScreen).
  // O-123-29…32 (G-3): Owner exception for the admin shell, RegistryAdmin and the fill-test grid (pinned by their unit groups).
  // Phase 126 Part A (G-3, KI-126-1 ruling): exactly the three Part A extension paths are excluded; the manifest
  // is pinned to BASE apart from the Part A lines (checked below).
  const changed = withoutPhase126PartA(git('diff', '--name-only', BASE, '--', ...frozen).split('\n')).filter((rel) => ![PERSIST, RECONCILE, ADMIN_GATE, ADMIN_CSS, ...O29_32_ADMIN].includes(rel));
  const untracked = withoutPhase126PartA(git('ls-files', '--others', '--exclude-standard', '--', ...frozen).split('\n'));
  assert(changed.length === 0 && untracked.length === 0, `N-1 / N-2: frozen paths unchanged vs ${BASE} (got ${[...changed, ...untracked].join(', ')})`);
  assert(revertPhase126PartAManifest(source(overrides, 'extension/manifest.json')) === baseFile('extension/manifest.json'), `Phase 126 Part A (G-3): extension/manifest.json identical to ${BASE} apart from the Part A lines (key, default_locale, __MSG_ name / description)`);
  let reverted = source(overrides, PERSIST).replace(/\r\n/g, '\n');
  for (const [now, before] of O17_PERSIST_HUNKS) {
    assert(reverted.split(now).length === 2, 'O-123-17: persistence.ts carries each delete-proof hunk exactly once');
    reverted = reverted.replace(now, () => before);
  }
  assert(reverted === baseFile(PERSIST), `O-123-17: persistence.ts identical to ${BASE} apart from the delete-proof hunks in deleteAccessProfileFromCloud`);
  const reconcile = source(overrides, RECONCILE).replace(/\r\n/g, '\n');
  assert(reconcile.split(O16_LINE[0]).length === 2, 'O-123-16: cloudReconcile.ts carries «האתר או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.» exactly once');
  assert(reconcile.replace(O16_LINE[0], () => O16_LINE[1]) === baseFile(RECONCILE), `O-123-16: cloudReconcile.ts identical to ${BASE} apart from the MSG_REMOVED_ELSEWHERE line`);
  const supaChanged = git('diff', '--name-only', BASE, '--', 'supabase').split('\n').filter(Boolean);
  const supaNew = git('ls-files', '--others', '--exclude-standard', '--', 'supabase').split('\n').filter(Boolean);
  assert(supaChanged.length === 0 && supaNew.every((rel) => rel === OWNER_SELECT_MIGRATION), `O-123-9: supabase/ = the one new owner-select migration (got ${[...supaChanged, ...supaNew].join(', ')})`);
  const product = [...new Set([
    ...git('diff', '--name-only', BASE, '--', 'src').split('\n').filter(Boolean),
    ...git('ls-files', '--others', '--exclude-standard', '--', 'src').split('\n').filter(Boolean),
    ...Object.keys(overrides).filter((rel) => rel.startsWith('src/')),
  ])].filter((rel) => /\.(ts|tsx)$/.test(rel) && existsSync(join(root, rel)));
  for (const rel of product) {
    assert(!/(^|[^\w.$'"-])(window\.)?(confirm|alert|prompt)\s*\(/m.test(stripComments(source(overrides, rel))), `N-4: browser dialog call in ${rel}`);
  }
  const ids = [...read('src/catalog/builtinCatalog.ts').matchAll(/\bid: '([^']+)'/g)].map((m) => m[1]);
  // -w: lines only re-indented (O-123-10 wraps the existing URL input) are not added content.
  const added = git('diff', '-U0', '-w', BASE, '--', 'src').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  for (const line of added) {
    assert(!/https?:\/\/|\.(co\.il|com|org|net)\b|['"`]svc-/.test(line), `N-5: host / service id literal added: ${line.slice(0, 120)}`);
    for (const id of ids) assert(!line.includes(`'${id}'`) && !line.includes(`"${id}"`), `N-5: catalog id literal added: ${id}`);
  }
  return `static N-checks: src/auth diff ⊆ register.ts + the copy.ts title; ${frozen.length} frozen paths unchanged vs ${BASE}; supabase/ = the O-123-9 migration only; no confirm / alert / prompt in ${product.length} changed product files; no id / host literal in ${added.length} added lines`;
}

function checkProfileWritesStatic(overrides) {
  const modal = source(overrides, MODAL);
  assert(/const FIRST_PROFILE_NAME = 'ראשי';/.test(modal), 'O-123-6: the first profile is stored as «ראשי» (existing displayName field)');
  assert((modal.match(/onCreateProfile\(/g) ?? []).length === 1 && modal.includes('await onCreateProfile(name, credential);'), 'O-123-6: one create path through the existing host callback');
  // O-123-17 (G-3): the host may differ from BASE by the delete-proof hunks only.
  let host = source(overrides, HOST).replace(/\r\n/g, '\n');
  for (const [now, before] of O17_HOST_HUNKS) {
    assert(host.split(now).length === 2, 'O-123-17: the profile host carries each delete-proof hunk exactly once');
    host = host.replace(now, () => before);
  }
  assert(host === baseFile(HOST), 'O-123-6: the profile host (existing reducers + persist) is unchanged apart from the O-123-17 delete proof');
  return 'static O-123-6: «ראשי» via the existing create callback; host / reducers unchanged (apart from the O-123-17 delete proof)';
}

const STATIC_GROUPS = [checkCatalogCardStatic, checkHintRemoved, checkMessagesComments, checkFailureCss, checkPostAddStatic, checkBannerRouting, checkNChecks, checkProfileWritesStatic];

// ─── Layer 2: unit — register.ts with a stubbed Supabase client (O-123-2) ─────
const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
const loaderOf = (key) => (key.endsWith('.css') ? 'css' : key.endsWith('.tsx') ? 'tsx' : 'ts');
const ENV_DEFINE = {
  'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production' }),
  'process.env.NODE_ENV': '"production"',
};

const REGISTER_STUBS = {
  'src/supabase/client.ts': () => 'export function getSupabaseClient() { return globalThis.__pvSb ?? null; }\nexport function resetSupabaseClient() {}\nexport function resetSupabaseClientForTests() {}',
  'src/supabase/env.ts': () => 'export function isSupabaseConfigured() { return true; }\nexport function getSupabaseConfig() { return null; }\nexport function getSupabaseRemoteUrl() { return null; }\nexport function toBrowserAccessibleStorageUrl(u) { return u; }',
  'src/dev/devMode.ts': () => 'export function isDevBuild() { return false; }',
};

let unitBuild = 0;
async function loadRegister(overrides) {
  const dir = makeTempDir('pv-1235-reg-');
  const stubs = new Map(Object.entries(REGISTER_STUBS).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).filter(([rel]) => rel.startsWith('src/')).map(([rel, src]) => [abs(rel), src]));
  try {
    const out = join(dir, `register-${(unitBuild += 1)}.mjs`);
    await build({
      bundle: true,
      write: true,
      logLevel: 'silent',
      format: 'esm',
      platform: 'node',
      define: ENV_DEFINE,
      stdin: { contents: "export { registerAccount } from './src/auth/register';\nexport { AUTH_COPY } from './src/auth/copy';", resolveDir: root, loader: 'ts', sourcefile: 'register-entry.ts' },
      outfile: out,
      plugins: [{
        name: 'phase1235-register-seams',
        setup(b) {
          b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
            const key = args.path.replace(/\\/g, '/').toLowerCase();
            if (stubs.has(key)) return { contents: stubs.get(key)(), loader: loaderOf(key), resolveDir: dirname(args.path) };
            if (overridden.has(key)) return { contents: overridden.get(key), loader: loaderOf(key), resolveDir: dirname(args.path) };
            return undefined;
          });
        },
      }],
    });
    return await import(`${pathToFileURL(out).href}?v=${unitBuild}`);
  } finally {
    removeTempDir(dir);
  }
}

const profileRow = (id) => ({ id, user_number: 100, first_name: 'בדיקה', last_name: 'משתמש', email: 'fixture@example.test', email_normalized: 'fixture@example.test', phone_normalized: '0500000000', role: 'user', status: 'active', is_admin: false });
/** Stub client: one auth account (`userId` / `password`), `rows` = public.users rows by id. */
function stubClient({ signUp, userId, password, rows = [] }) {
  const log = { signOut: 0, signIn: 0, rpc: [] };
  const table = new Map(rows.map((id) => [id, profileRow(id)]));
  let session = null;
  const client = {
    auth: {
      async signUp() {
        const r = signUp();
        if (r.session) session = r.session;
        return { data: { user: r.user ?? null, session: r.session ?? null }, error: r.error ?? null };
      },
      async signInWithPassword(creds) {
        log.signIn += 1;
        if (creds.password !== password) return { data: { session: null }, error: { message: 'Invalid login credentials', status: 400 } };
        session = { user: { id: userId, email: 'fixture@example.test' }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
        return { data: { session }, error: null };
      },
      async getUser() {
        return session ? { data: { user: session.user }, error: null } : { data: { user: null }, error: { message: 'no session' } };
      },
      async getSession() {
        return { data: { session } };
      },
      async refreshSession() {
        return { data: { session }, error: null };
      },
      async signOut() {
        log.signOut += 1;
        session = null;
        return { error: null };
      },
    },
    async rpc(name) {
      log.rpc.push(name);
      if (!session) return { error: { message: 'not authenticated' } };
      if (name === 'ensure_app_user_profile' && !table.has(session.user.id)) table.set(session.user.id, profileRow(session.user.id));
      return { error: null };
    },
    from(name) {
      let id = null;
      const q = {
        select: () => q,
        eq: (_col, value) => {
          id = value;
          return q;
        },
        maybeSingle: async () => ({ data: name === 'users' ? table.get(id) ?? null : null, error: null }),
      };
      return q;
    },
  };
  return { client, log, session: () => session, table };
}

const INPUT = { firstName: 'בדיקה', lastName: 'משתמש', email: 'Fixture@Example.test', phone: '050-0000000', password: 'Fixture-pass-1', passwordConfirm: 'Fixture-pass-1' };
const TAKEN_ERROR = () => ({ error: { message: 'User already registered', status: 422 } });
const TAKEN_IDENTITIES = () => ({ user: { id: 'u-obfuscated', identities: [] } });

async function runRegister(mod, stub, input = INPUT) {
  globalThis.__pvSb = stub.client;
  try {
    return { profile: await mod.registerAccount(input), error: null };
  } catch (e) {
    return { profile: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    globalThis.__pvSb = undefined;
  }
}

async function checkRegisterExistingAccount(overrides) {
  const mod = await loadRegister(overrides);
  const dup = mod.AUTH_COPY.registerDuplicate;
  for (const [entry, signUp] of [['"already registered" error', TAKEN_ERROR], ['identities = 0', TAKEN_IDENTITIES]]) {
    // Orphan path + a row that existed before this registration → sign out, duplicate copy, no RPC.
    const existing = stubClient({ signUp, userId: 'u-existing', password: INPUT.password, rows: ['u-existing'] });
    const r1 = await runRegister(mod, existing);
    assert(r1.error === dup, `O-123-2 (${entry}): existing account with its correct password → «${dup}» (got ${r1.error ?? 'success'})`);
    assert(existing.log.signOut >= 1 && existing.session() === null, `O-123-2 (${entry}): signed out immediately, no session left`);
    assert(existing.log.rpc.length === 0, `O-123-2 (${entry}): no ensure_app_user_profile call for an existing row`);
    // Orphan path without a row → recovery kept (profile created through the RPC).
    const orphan = stubClient({ signUp, userId: 'u-orphan', password: INPUT.password, rows: [] });
    const r2 = await runRegister(mod, orphan);
    assert(r2.profile?.id === 'u-orphan' && !r2.error, `O-123-2 (${entry}): auth user without a row → recovered (got ${r2.error ?? r2.profile?.id})`);
    assert(JSON.stringify(orphan.log.rpc) === '["ensure_app_user_profile"]' && orphan.log.signOut === 0 && orphan.session() !== null, `O-123-2 (${entry}): recovery creates the row once and keeps the session`);
    // Wrong password → duplicate copy as today, nothing opened.
    const wrong = stubClient({ signUp, userId: 'u-existing', password: 'Another-pass-2', rows: ['u-existing'] });
    const r3 = await runRegister(mod, wrong);
    assert(r3.error === dup && wrong.session() === null && wrong.log.rpc.length === 0, `O-123-2 (${entry}): wrong password → «${dup}», no session`);
  }
  // Fresh sign-up whose row was created by the auth.users trigger → success unchanged.
  const withSession = stubClient({
    signUp: () => ({ user: { id: 'u-new', identities: [{ id: 'i-1' }] }, session: { user: { id: 'u-new', email: 'fixture@example.test' }, expires_at: Math.floor(Date.now() / 1000) + 3600 } }),
    userId: 'u-new', password: INPUT.password, rows: ['u-new'],
  });
  const r4 = await runRegister(mod, withSession);
  assert(r4.profile?.id === 'u-new' && withSession.log.signOut === 0 && withSession.log.rpc.length === 0, `O-123-2: fresh sign-up (session) with a trigger row → success (got ${r4.error ?? r4.profile?.id})`);
  const noSession = stubClient({ signUp: () => ({ user: { id: 'u-new', identities: [{ id: 'i-1' }] } }), userId: 'u-new', password: INPUT.password, rows: ['u-new'] });
  const r5 = await runRegister(mod, noSession);
  assert(r5.profile?.id === 'u-new' && noSession.log.signOut === 0 && noSession.session() !== null, `O-123-2: fresh sign-up (sign-in after sign-up) with a trigger row → success (got ${r5.error ?? r5.profile?.id})`);
  return 'unit O-123-2 (real register.ts, stubbed client): existing row on both orphan entries → sign-out + «כבר קיים חשבון…», no RPC, no session; orphan without row → recovered; fresh sign-up with trigger row → success; wrong password → duplicate copy';
}

// ─── Layer 2b: SQL (PGlite) — registry owner-select policy (O-123-9) ─────────
const SQL_ADMIN = '00000000-0000-4000-8000-0000000000aa';
const SQL_U1 = '00000000-0000-4000-8000-0000000000a1';
const SQL_U2 = '00000000-0000-4000-8000-0000000000a2';
const REGISTRY_MIGRATIONS = [
  'supabase/migrations/20260702121500_phase101_schema.sql',
  'supabase/migrations/20260702121600_phase101_rls.sql',
  'supabase/migrations/20260703120000_phase102_schema_delta.sql',
  'supabase/migrations/20260703120200_phase102_rls_delta.sql',
  'supabase/migrations/20260709120000_phase107_admin_auth_rls.sql',
];
const OWNER_SELECT_SQL = [
  'drop policy if exists "service_registry_select_own_user_rows" on public.service_registry;',
  `create policy "service_registry_select_own_user_rows" on public.service_registry for select to authenticated using (owner_user_id = auth.uid() and source_type = 'user');`,
];
/** The custom-site write of upsertCustomServiceRegistryRow: INSERT … ON CONFLICT (id) DO UPDATE, status pending_review. */
const upsertOwnRow = (id, owner, name) => `insert into public.service_registry (id, display_name, primary_url, source_type, service_status, owner_user_id)
  values ('${id}', '${name}', 'https://${id}.example.test/', 'user', 'pending_review', '${owner}')
  on conflict (id) do update set display_name = excluded.display_name, primary_url = excluded.primary_url,
    source_type = excluded.source_type, service_status = excluded.service_status, owner_user_id = excluded.owner_user_id`;
async function sqlAs(db, who, sql) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${who === 'anon' ? '' : who}', false)`);
  await db.exec(who === 'anon' ? 'set role anon' : 'set role authenticated');
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}
const registryPolicies = async (db) => (await db.query(`select policyname, cmd, roles::text r, qual, with_check from pg_policies
  where schemaname = 'public' and tablename = 'service_registry' order by policyname`)).rows;

async function checkRegistryOwnerSelectSql(overrides) {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      alter default privileges in schema public grant all on tables to anon, authenticated;
      alter default privileges in schema public grant all on functions to anon, authenticated;
    `);
    for (const rel of REGISTRY_MIGRATIONS) await db.exec(read(rel));
    await db.exec(`
      insert into auth.users (id) values ('${SQL_ADMIN}'), ('${SQL_U1}'), ('${SQL_U2}');
      insert into public.users (id, is_admin) values ('${SQL_ADMIN}', true), ('${SQL_U1}', false), ('${SQL_U2}', false);
      ${upsertOwnRow('custom-other', SQL_U2, 'אתר של משתמש אחר')};
    `);
    // The live failure before the policy (P-1 / AD-123-16): a non-admin's own pending upsert is refused.
    let refused = null;
    try {
      await sqlAs(db, SQL_U1, upsertOwnRow('custom-own', SQL_U1, 'אתר שלי'));
    } catch (e) {
      refused = String(e.message);
    }
    assert(refused && /row-level security/.test(refused), `fixture: without the O-123-9 policy the own pending upsert must be refused (got ${refused ?? 'success'})`);
    const adminBefore = (await registryPolicies(db)).filter((p) => p.policyname.startsWith('service_registry_admin_'));

    await db.exec(source(overrides, OWNER_SELECT_MIGRATION));

    await sqlAs(db, SQL_U1, upsertOwnRow('custom-own', SQL_U1, 'אתר שלי'));
    await sqlAs(db, SQL_U1, upsertOwnRow('custom-own', SQL_U1, 'אתר שלי (עריכה)'));
    const own = await sqlAs(db, SQL_U1, `select id, display_name, service_status from public.service_registry where id = 'custom-own'`);
    assert(own.rows.length === 1 && own.rows[0].service_status === 'pending_review' && own.rows[0].display_name === 'אתר שלי (עריכה)', `O-123-9: a non-admin upserts (insert + conflict update) and reads their own pending row (got ${JSON.stringify(own.rows)})`);
    const other = await sqlAs(db, SQL_U1, `select id from public.service_registry where id = 'custom-other'`);
    assert(other.rows.length === 0, `O-123-9: a non-admin cannot read another user's pending row (got ${other.rows.length} row(s))`);
    const pendingVisible = await sqlAs(db, SQL_U1, `select id from public.service_registry where service_status = 'pending_review' order by id`);
    assert(JSON.stringify(pendingVisible.rows.map((r) => r.id)) === '["custom-own"]', `O-123-9: a non-admin sees only their own pending rows (got ${JSON.stringify(pendingVisible.rows)})`);
    let anonRows = 0;
    try {
      anonRows = (await sqlAs(db, 'anon', `select id from public.service_registry where service_status = 'pending_review'`)).rows.length;
    } catch (e) {
      assert(/permission denied/.test(String(e.message)), `O-123-9: anon read: unexpected error "${e.message}"`);
    }
    assert(anonRows === 0, `O-123-9: anon cannot read pending rows (got ${anonRows})`);
    const adminRows = await sqlAs(db, SQL_ADMIN, `select id from public.service_registry where service_status = 'pending_review' order by id`);
    assert(JSON.stringify(adminRows.rows.map((r) => r.id)) === '["custom-other","custom-own"]', `O-123-9: the admin still reads every pending row (got ${JSON.stringify(adminRows.rows)})`);
    assert(JSON.stringify((await registryPolicies(db)).filter((p) => p.policyname.startsWith('service_registry_admin_'))) === JSON.stringify(adminBefore), 'O-123-9: admin policies unchanged');
    const names = (await registryPolicies(db)).map((p) => p.policyname).sort();
    assert(JSON.stringify(names) === JSON.stringify([...adminBefore.map((p) => p.policyname), 'service_registry_delete_own', 'service_registry_insert_own', 'service_registry_select_own_user_rows', 'service_registry_select_visible', 'service_registry_update_own'].sort()), `O-123-9: exactly one policy added (got ${names.join(', ')})`);

    const delOther = await sqlAs(db, SQL_U1, `delete from public.service_registry where id = 'custom-other' and owner_user_id = '${SQL_U2}' and source_type = 'user'`);
    assert(delOther.affectedRows === 0, `O-123-9: a non-admin cannot delete another user's row (got ${delOther.affectedRows})`);
    const del = await sqlAs(db, SQL_U1, `delete from public.service_registry where id = 'custom-own' and owner_user_id = '${SQL_U1}' and source_type = 'user'`);
    assert(del.affectedRows === 1, `O-123-9: deleting the own pending row removes exactly 1 row (got ${del.affectedRows})`);
    const left = await db.query(`select id from public.service_registry where source_type = 'user' order by id`);
    assert(JSON.stringify(left.rows.map((r) => r.id)) === '["custom-other"]', `O-123-9: only the own row was removed (left ${JSON.stringify(left.rows)})`);
  } finally {
    await db.close();
  }
  const migration = source(overrides, OWNER_SELECT_MIGRATION);
  const statements = migration.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--'));
  assert(JSON.stringify(statements) === JSON.stringify(OWNER_SELECT_SQL), 'O-123-9: the migration is byte-equivalent to the ruling (drop + create policy only)');
  return 'SQL O-123-9 (PGlite, real Phase 101/102/107 registry migrations + the new file): own pending upsert refused before / allowed after (insert + conflict update); own pending row readable; another user\'s row not readable or deletable; anon reads none; admin still reads all, admin policies unchanged, one policy added; own delete removes exactly 1 row; file = the ruling\'s two statements';
}

const unconfirmedCode = () => (read(PERSIST).match(/export const PROFILE_DELETE_UNCONFIRMED = '([^']+)';/) ?? [])[1] ?? 'missing';
const PERSIST_UNIT_STUBS = {
  'src/supabase/client.ts': () => 'export function getSupabaseClient() { return globalThis.__pvSb ?? null; }\nexport function resetSupabaseClient() {}',
  'src/auth/index.ts': () => 'export async function tryGetAuthenticatedUserId() { return globalThis.__pvUid ?? null; }',
  'src/vault/crypto.ts': () => 'export async function encryptCredentialSet() { throw new Error("not used"); }\nexport async function decryptCredentialSetWithKeys() { return null; }',
  'src/dev/devMode.ts': () => 'export const isDevBuild = () => false;',
  'src/registry/registryMapper.ts': () => 'export function registryRowToServiceDefinition() { throw new Error("not used"); }',
  'src/serviceManagement/serviceSelection.ts': () => 'export const CLOUD_REMOVE_UNAVAILABLE_MESSAGE = "cloud remove unavailable";',
};
async function loadPersistence(overrides) {
  const dir = makeTempDir('pv-1235-persist-');
  const stubs = new Map(Object.entries(PERSIST_UNIT_STUBS).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).filter(([rel]) => rel.startsWith('src/')).map(([rel, src]) => [abs(rel), src]));
  try {
    const out = join(dir, `persistence-${(unitBuild += 1)}.mjs`);
    await build({
      bundle: true,
      write: true,
      logLevel: 'silent',
      format: 'esm',
      platform: 'node',
      define: ENV_DEFINE,
      stdin: { contents: "export { deleteAccessProfileFromCloud, PROFILE_DELETE_UNCONFIRMED } from './src/supabase/persistence';", resolveDir: root, loader: 'ts', sourcefile: 'persistence-entry.ts' },
      outfile: out,
      plugins: [{
        name: 'phase1235-persistence-seams',
        setup(b) {
          b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
            const key = args.path.replace(/\\/g, '/').toLowerCase();
            if (stubs.has(key)) return { contents: stubs.get(key)(), loader: loaderOf(key), resolveDir: dirname(args.path) };
            if (overridden.has(key)) return { contents: overridden.get(key), loader: loaderOf(key), resolveDir: dirname(args.path) };
            return undefined;
          });
        },
      }],
    });
    return await import(`${pathToFileURL(out).href}?v=${unitBuild}`);
  } finally {
    removeTempDir(dir);
  }
}
/** Cloud `access_profiles` with PostgREST semantics: delete returns rows only when `.select()` asks for them. */
function profileRowsClient(rows, { failWith = null } = {}) {
  const calls = [];
  const client = {
    from(table) {
      const filters = [];
      let op = null;
      let returning = false;
      const q = {
        delete() { op = 'delete'; return q; },
        eq(col, value) { filters.push((r) => r[col] === value); return q; },
        select() { returning = true; return q; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            calls.push({ table, op, returning });
            if (failWith) return { data: null, error: { message: failWith } };
            const hit = rows.filter((r) => filters.every((f) => f(r)));
            for (const r of hit) rows.splice(rows.indexOf(r), 1);
            return { data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
          }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  return { client, calls, rows };
}
async function runCloudDelete(mod, cloud, localId) {
  globalThis.__pvSb = cloud.client;
  globalThis.__pvUid = 'u-1235-a';
  try {
    await mod.deleteAccessProfileFromCloud(localId);
    return null;
  } catch (e) {
    return e;
  } finally {
    globalThis.__pvSb = undefined;
    globalThis.__pvUid = undefined;
  }
}
async function checkProfileDeleteProof(overrides) {
  const mod = await loadPersistence(overrides);
  const row = (id, user, local) => ({ id, user_id: user, local_profile_id: local });
  const ok = profileRowsClient([row('c-1', 'u-1235-a', 'p-match')]);
  const e1 = await runCloudDelete(mod, ok, 'p-match');
  assert(e1 === null && ok.rows.length === 0, `O-123-17: a matching cloud row is removed and the delete succeeds (got ${e1?.message ?? 'ok'}, ${ok.rows.length} row(s) left)`);
  assert(ok.calls.length === 1 && ok.calls[0].op === 'delete' && ok.calls[0].returning, 'O-123-17: the delete asks for the removed rows back (proof)');
  // Owner case: the cloud row carries an older local id than the vault profile → 0 rows matched.
  const legacy = profileRowsClient([row('c-2', 'u-1235-a', 'p-cloud-older')]);
  const e2 = await runCloudDelete(mod, legacy, 'p-vault-newer');
  assert(e2 && e2.code === mod.PROFILE_DELETE_UNCONFIRMED, `O-123-17: 0-row cloud delete treated as success (got ${e2 ? e2.code ?? e2.message : 'success'})`);
  assert(legacy.rows.length === 1, 'O-123-17: the unmatched row is left in place (nothing else deleted)');
  const otherUser = profileRowsClient([row('c-3', 'u-1235-b', 'p-shared')]);
  const e3 = await runCloudDelete(mod, otherUser, 'p-shared');
  assert(e3?.code === mod.PROFILE_DELETE_UNCONFIRMED && otherUser.rows.length === 1, 'O-123-17: a row filtered out by the owner (user / RLS mismatch) is not a success either');
  const failing = profileRowsClient([row('c-4', 'u-1235-a', 'p-net')], { failWith: 'fixture network failure' });
  const e4 = await runCloudDelete(mod, failing, 'p-net');
  assert(e4 && e4.message === 'fixture network failure' && e4.code !== mod.PROFILE_DELETE_UNCONFIRMED, 'O-123-17: a server error is rethrown unchanged');
  return 'unit O-123-17 (real persistence.ts, stub client with PostgREST delete semantics): matching row → removed, success, rows asked back; vault / cloud local-id mismatch (the Owner case) and owner mismatch → 0 rows → PROFILE_DELETE_UNCONFIRMED, row kept; server error rethrown';
}

const CUSTOM_ADD_FAILURE = 'src/catalog/customAddFailure.ts';
async function loadCustomAddFailure(overrides) {
  const dir = makeTempDir('pv-1235-caf-');
  const overridden = new Map(Object.entries(overrides).filter(([rel]) => rel.startsWith('src/')).map(([rel, src]) => [abs(rel), src]));
  try {
    const out = join(dir, `custom-add-failure-${(unitBuild += 1)}.mjs`);
    await build({
      bundle: true,
      write: true,
      logLevel: 'silent',
      format: 'esm',
      platform: 'node',
      stdin: { contents: "export * from './src/catalog/customAddFailure';", resolveDir: root, loader: 'ts', sourcefile: 'custom-add-failure-entry.ts' },
      outfile: out,
      plugins: [{
        name: 'phase1235-custom-add-failure',
        setup(b) {
          b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
            const key = args.path.replace(/\\/g, '/').toLowerCase();
            if (overridden.has(key)) return { contents: overridden.get(key), loader: loaderOf(key), resolveDir: dirname(args.path) };
            return undefined;
          });
        },
      }],
    });
    return await import(`${pathToFileURL(out).href}?v=${unitBuild}`);
  } finally {
    removeTempDir(dir);
  }
}
async function checkCustomAddAuthRequired(overrides) {
  const session = source(overrides, 'src/auth/session.ts');
  assert(/export class AuthRequiredError extends Error \{[\s\S]*?this\.name = 'AuthRequiredError';/.test(session), "fixture: src/auth/session.ts AuthRequiredError sets name 'AuthRequiredError'");
  const mod = await loadCustomAddFailure(overrides);
  // Same shape as src/auth/session.ts: Hebrew message, no English keyword.
  class AuthRequiredError extends Error {
    constructor(message = 'נדרשת התחברות מחדש.') {
      super(message);
      this.name = 'AuthRequiredError';
    }
  }
  const lost = mod.classifyCustomAddFailure(new AuthRequiredError());
  assert(lost.failureClass === 'auth_policy' && lost.userMessage === mod.CUSTOM_ADD_FAIL_AUTH_POLICY_HE,
    `O-123-22: AuthRequiredError (session lost) → auth copy (got ${lost.failureClass}: «${lost.userMessage}»)`);
  assert(mod.userMessageForCustomAddFailure(new AuthRequiredError()) === mod.CUSTOM_ADD_FAIL_AUTH_POLICY_HE, 'O-123-22: userMessageForCustomAddFailure (add and edit) returns the auth copy');
  const plain = mod.classifyCustomAddFailure(new Error('שגיאה כללית'));
  assert(plain.failureClass === 'persistence_validation' && plain.userMessage === mod.CUSTOM_ADD_FAIL_PERSISTENCE_HE, 'O-123-22: other errors without a keyword keep the persistence copy');
  const dup = mod.classifyCustomAddFailure({ code: '23505', message: 'x' });
  assert(dup.failureClass === 'duplicate_reuse', 'O-123-22: the other classes are unchanged (duplicate)');
  return 'unit O-123-22 (real customAddFailure.ts): AuthRequiredError (Hebrew message, no keyword) → auth_policy with CUSTOM_ADD_FAIL_AUTH_POLICY_HE for add and edit; other unkeyed errors → persistence copy; duplicate unchanged';
}

const ADMIN_UNIT_STUBS = {
  'src/admin/adminAuth.ts': () => 'export async function resolveAdminAccess() { return globalThis.__pvAdminAccess ?? { status: "unauthenticated" }; }',
  'src/auth/index.ts': () => [
    "export { AUTH_COPY } from './copy';",
    'export async function loginWithPassword() { throw new Error("not used"); }',
    'export function mapAuthErrorToFriendly() { return ""; }',
    'export async function registerAccount() { throw new Error("not used"); }',
    'export async function signOutAccount() {}',
  ].join('\n'),
  'src/dev/devMode.ts': () => 'export const isDevBuild = () => false;',
};
const ADMIN_ENTRY = "import { createRoot } from 'react-dom/client';\nimport AdminGate from './src/admin/AdminGate';\ncreateRoot(document.getElementById('root')).render(<AdminGate><div data-pv-admin-allowed>allowed</div></AdminGate>);\n";
const USER_LOGIN_ENTRY = "import { createRoot } from 'react-dom/client';\nimport AuthEntryScreen from './src/auth/AuthEntryScreen';\ncreateRoot(document.getElementById('root')).render(<div data-pv-user-login><AuthEntryScreen onAuthenticated={async () => {}} /></div>);\n";
async function bundleAdminGate(overrides, entry = ADMIN_ENTRY, stubSet = ADMIN_UNIT_STUBS) {
  const dir = makeTempDir('pv-1235-admin-');
  const stubs = new Map(Object.entries(stubSet).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).filter(([rel]) => rel.startsWith('src/')).map(([rel, src]) => [abs(rel), src]));
  try {
    const out = join(dir, 'admin-gate.js');
    await build({
      bundle: true,
      write: true,
      logLevel: 'silent',
      jsx: 'automatic',
      nodePaths: [join(root, 'node_modules')],
      define: ENV_DEFINE,
      stdin: { contents: entry, resolveDir: root, loader: 'tsx', sourcefile: 'admin-entry.tsx' },
      outfile: out,
      format: 'iife',
      platform: 'browser',
      loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
      plugins: [{
        name: 'phase1235-admin-seams',
        setup(b) {
          b.onLoad({ filter: /\.(ts|tsx|css)$/ }, (args) => {
            const key = args.path.replace(/\\/g, '/').toLowerCase();
            if (stubs.has(key)) return { contents: stubs.get(key)(), loader: loaderOf(key), resolveDir: dirname(args.path) };
            if (overridden.has(key)) return { contents: overridden.get(key), loader: loaderOf(key), resolveDir: dirname(args.path) };
            return undefined;
          });
        },
      }],
    });
    return readFileSync(out, 'utf8');
  } finally {
    removeTempDir(dir);
  }
}
async function renderAdminGate(js, access) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
    await page.evaluate((a) => { globalThis.__pvAdminAccess = a; }, access);
    await page.addScriptTag({ content: js });
    await page.locator('[data-testid="admin-gate-login"], [data-testid="admin-gate-denied"]').first().waitFor({ timeout: 8000 });
    const m = await page.evaluate(() => {
      const login = document.querySelector('[data-testid="admin-gate-login"]');
      const denied = document.querySelector('[data-testid="admin-gate-denied"]');
      return {
        login: login ? {
          h1: login.querySelector('.unlock-header h1')?.textContent ?? null,
          headerParagraphs: login.querySelectorAll('.unlock-header p').length,
          homeLinks: login.querySelectorAll('a[href="#/"]').length,
          text: login.textContent ?? '',
          banner: login.querySelector('.admin-gate-login-banner')?.textContent ?? null,
          email: login.querySelectorAll('input[type="email"], input[autocomplete="email"], input[autocomplete="username"]').length,
        } : null,
        denied: denied ? { homeLinkText: denied.querySelector('a[href="#/"]')?.textContent?.trim() ?? null } : null,
      };
    });
    assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
    return m;
  } finally {
    await context.close();
  }
}
async function checkAdminLoginScreen(overrides) {
  const js = await bundleAdminGate(overrides);
  const plain = await renderAdminGate(js, { status: 'unauthenticated' });
  assert(plain.login, 'O-123-23: unauthenticated → the admin login screen (data-testid="admin-gate-login")');
  assert(plain.login.h1 === O23_HEADING, `O-123-23: heading «${O23_HEADING}» (got «${plain.login.h1}»)`);
  assert(plain.login.headerParagraphs === 0 && !plain.login.text.includes('התחבר כדי לנהל'), `O-123-23: no subtitle line under the heading (got ${plain.login.headerParagraphs} paragraph(s))`);
  assert(plain.login.homeLinks === 0 && !plain.login.text.includes('חזרה לבית הדיגיטלי'), 'O-123-23: no «חזרה לבית הדיגיטלי» link on the admin login screen');
  assert(plain.login.email >= 1 && plain.login.banner === null, 'O-123-23: the login form is still shown; no banner without a reason');
  const notAdmin = await renderAdminGate(js, { status: 'not_admin' });
  assert(notAdmin.login && notAdmin.login.banner?.includes('אינו מנהל') && notAdmin.login.h1 === O23_HEADING, 'O-123-23: the not-admin login banner is unchanged and shown above the new heading');
  const denied = await renderAdminGate(js, { status: 'error', error: 'fixture error' });
  assert(denied.denied && denied.denied.homeLinkText === 'חזרה לבית הדיגיטלי', 'O-123-23: the denied screen keeps its «חזרה לבית הדיגיטלי» link');
  // Exactness: denied branch, banner, step-up logic and data-testid are BASE byte for byte.
  assert(revertHunks(source(overrides, ADMIN_GATE), O23_GATE_HUNKS, 'O-123-23 AdminGate.tsx') === baseFile(ADMIN_GATE), `O-123-23: AdminGate.tsx identical to ${BASE} apart from the need_login heading / subtitle / link`);
  // O-123-29 / O-123-30 (G-3): the appended Phase 123.5 block is left out here — pinned by checkAdminTabBar / checkAdminNewSiteFont.
  assert(revertHunks(withoutO29Block(source(overrides, ADMIN_CSS)), O23_CSS_HUNKS, 'O-123-23 admin.css') === baseFile(ADMIN_CSS), `O-123-23: admin.css identical to ${BASE} apart from the three admin-gate-home-link rules (and the O-123-29 / 30 block)`);
  // O-123-29…32 (G-3): the Owner-excepted admin files are pinned by their own groups.
  const others = git('diff', '--name-only', BASE, '--', 'src/admin').split('\n').filter((rel) => rel && rel !== ADMIN_GATE && rel !== ADMIN_CSS && !O29_32_ADMIN.includes(rel));
  assert(others.length === 0, `O-123-23 / O-123-29…32: no other src/admin file changed (got ${others.join(', ')})`);
  return `unit O-123-23 (real AdminGate + AuthEntryScreen in Edge, stubbed access): admin login heading «${O23_HEADING}», no subtitle line, no home link; not-admin banner unchanged; denied screen keeps its home link; AdminGate.tsx / admin.css = BASE apart from the allowed hunks`;
}

async function checkUserLoginTitle(overrides) {
  const js = await bundleAdminGate(overrides, USER_LOGIN_ENTRY);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' });
  let m;
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({ content: js });
    await page.locator('[data-pv-user-login] .unlock-header h1').waitFor({ timeout: 8000 });
    m = await page.evaluate(() => {
      const root = document.querySelector('[data-pv-user-login]');
      return { h1: root.querySelector('.unlock-header h1')?.textContent ?? null, text: root.textContent ?? '' };
    });
    assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  } finally {
    await context.close();
  }
  assert(m.h1 === 'הבית הדיגיטלי', `O-123-24: the user login heading (AuthEntryScreen default) is «הבית הדיגיטלי» (got «${m.h1}»)`);
  assert(!m.text.includes('כספת דיגיטלית'), 'O-123-24: the old title «כספת דיגיטלית» is gone from the user login screen');
  const copy = source(overrides, AUTH_COPY_FILE).replace(/\r\n/g, '\n');
  assert(copy.split(O24_TITLE_LINE[0]).length === 2, 'O-123-24: copy.ts carries the new productTitle line exactly once');
  // O-123-33 (G-3): the duplicate line (no «») and the «סגור» label are the other allowed copy.ts change.
  assert(copy.split(O33_COPY_LINES[0]).length === 2, 'O-123-33: copy.ts carries the new duplicate lines exactly once');
  assert(copy.replace(O24_TITLE_LINE[0], () => O24_TITLE_LINE[1]).replace(O33_COPY_LINES[0], () => O33_COPY_LINES[1]) === baseFile(AUTH_COPY_FILE), `O-123-24 / O-123-33: copy.ts identical to ${BASE} apart from the productTitle line and the duplicate copy (no other AUTH_COPY string changed)`);
  return 'unit O-123-24 (real AuthEntryScreen + AUTH_COPY in Edge): user login heading «הבית הדיגיטלי», old title gone; copy.ts = BASE apart from productTitle (admin heading unaffected: checkAdminLoginScreen)';
}

const O33_TEXT = 'כבר קיים חשבון עם כתובת אימייל זו. נסו להתחבר במסך התחברות.';
const O33_OLD_TEXT = 'כבר קיים חשבון עם כתובת אימייל זו. נסו להתחבר במסך «התחברות».';
const AUTH_ENTRY = 'src/auth/AuthEntryScreen.tsx';
/** Real AuthEntryScreen + real copy.ts / mapAuthErrorToFriendly; register / login throw what the check scripts. */
const O33_STUBS = {
  'src/auth/index.ts': () => [
    "export { AUTH_COPY, mapAuthErrorToFriendly } from './copy';",
    'export async function loginWithPassword() { throw new Error(globalThis.__pvAuthError); }',
    'export async function registerAccount() { throw new Error(globalThis.__pvAuthError); }',
  ].join('\n'),
  'src/dev/devMode.ts': () => 'export const isDevBuild = () => true;',
};
async function checkRegisterDuplicateDialog(overrides) {
  const js = await bundleAdminGate(overrides, USER_LOGIN_ENTRY, O33_STUBS);
  const css = source(overrides, CSS);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' });
  try {
    const page = await context.newPage();
    const errors = [];
    const warnings = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.setContent('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    const root = page.locator('[data-pv-user-login]');
    const card = root.locator('.auth-entry-card');
    const dialog = page.locator('[role="alertdialog"]');
    const fill = async () => {
      const inputs = card.locator('form input');
      const n = await inputs.count();
      for (let i = 0; i < n; i += 1) await inputs.nth(i).fill(i === 3 ? 'fixture@example.test' : `fixture-${i}`);
      return n;
    };
    await page.locator('[data-testid="auth-tab-register"]').click();
    const fieldCount = await fill();
    assert(fieldCount === 6, `fixture: the register form has 6 fields (got ${fieldCount})`);

    // Duplicate e-mail, with the DEV hint register.ts appends.
    await page.evaluate((m) => { globalThis.__pvAuthError = m; }, `${O33_TEXT}\n(פרטי פיתוח: fixture-code | 400 | User already registered)`);
    await page.locator('[data-testid="auth-submit"]').click();
    await dialog.waitFor({ timeout: 5000 }).catch(() => {});
    assert((await dialog.count()) === 1, 'O-123-33: a duplicate e-mail opens the alertdialog (not an inline error)');
    const d = await page.evaluate(() => {
      const el = document.querySelector('[role="alertdialog"]');
      const cardEl = document.querySelector('.auth-entry-card');
      const style = getComputedStyle(cardEl);
      return {
        text: el.querySelector('#auth-duplicate-text')?.textContent ?? null,
        described: el.getAttribute('aria-describedby'),
        modal: el.getAttribute('aria-modal'),
        buttons: [...el.querySelectorAll('button')].map((b) => b.textContent.trim()),
        focused: document.activeElement?.textContent?.trim() ?? null,
        inert: cardEl.inert,
        opacity: Number(style.opacity),
        filter: style.filter,
        values: [...cardEl.querySelectorAll('form input')].map((i) => i.value),
        body: document.body.innerText,
        inlineErrors: cardEl.querySelectorAll('.unlock-error').length,
      };
    });
    assert(d.text === O33_TEXT && d.described === 'auth-duplicate-text' && d.modal === 'true', `O-123-33: role="alertdialog" with «${O33_TEXT}» (got «${d.text}»)`);
    assert(!d.text.includes('«') && !d.text.includes('»'), 'O-123-33: no «» marks in the duplicate copy');
    assert(JSON.stringify(d.buttons) === JSON.stringify(['סגור']) && d.focused === 'סגור', `O-123-33: exactly one button «סגור», focused (got ${JSON.stringify(d.buttons)}, focus ${d.focused})`);
    assert(d.inert, 'O-123-33: the register form behind the dialog is inert');
    assert(d.opacity === 1 && d.filter.includes('brightness('), `O-123-33: the form behind is opaque and darker (opacity ${d.opacity}, filter ${d.filter})`);
    assert(d.values.length === 6 && d.values.every((v) => v === ''), `O-123-33: all register fields are cleared when the dialog opens (got ${JSON.stringify(d.values.map((v) => v.length))})`);
    assert(!d.body.includes('פרטי פיתוח') && !d.body.includes('fixture-code') && d.inlineErrors === 0, 'O-123-33: no developer detail and no inline duplicate error in the visible text');
    assert(warnings.some((w) => w.includes('fixture-code')), 'O-123-33: the developer detail goes to the DEV console');
    await dialog.locator('button', { hasText: 'סגור' }).click();
    await dialog.waitFor({ state: 'detached', timeout: 5000 });
    const after = await page.evaluate(() => {
      const cardEl = document.querySelector('.auth-entry-card');
      const first = cardEl.querySelector('form input');
      return { focusedFirst: document.activeElement === first, inert: cardEl.inert, values: [...cardEl.querySelectorAll('form input')].map((i) => i.value), registerTab: document.querySelector('[data-testid="auth-tab-register"]').getAttribute('aria-selected') };
    });
    assert(after.focusedFirst && !after.inert && after.registerTab === 'true' && after.values.every((v) => v === ''), 'O-123-33: «סגור» returns to the empty register form with focus on the first field');

    // Escape closes the dialog the same way.
    await fill();
    await page.evaluate((m) => { globalThis.__pvAuthError = m; }, O33_TEXT);
    await page.locator('[data-testid="auth-submit"]').click();
    await dialog.waitFor({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached', timeout: 5000 });

    // Other register errors stay inline with the fields kept.
    await fill();
    for (const other of ['הסיסמאות אינן תואמות.', 'לא ניתן ליצור את החשבון כרגע. נסו שוב מאוחר יותר.\n(פרטי פיתוח: fixture-other)']) {
      await page.evaluate((m) => { globalThis.__pvAuthError = m; }, other);
      await page.locator('[data-testid="auth-submit"]').click();
      await card.locator('.unlock-error[role="alert"]').waitFor({ timeout: 5000 });
      const inline = await page.evaluate(() => ({
        text: document.querySelector('.auth-entry-card .unlock-error')?.textContent ?? null,
        values: [...document.querySelectorAll('.auth-entry-card form input')].map((i) => i.value),
        dialogs: document.querySelectorAll('[role="alertdialog"]').length,
      }));
      assert(inline.text === other && inline.dialogs === 0 && inline.values.every((v) => v !== ''), `O-123-33: another register error stays inline with the fields kept (unchanged): «${other.split('\n')[0]}»`);
    }
    // Login errors are unchanged.
    await page.locator('[data-testid="auth-tab-login"]').click();
    await card.locator('input[type="email"]').fill('fixture@example.test');
    await card.locator('input[type="password"]').fill('fixture-pass');
    await page.evaluate(() => { globalThis.__pvAuthError = 'Invalid login credentials'; });
    await page.locator('[data-testid="auth-submit"]').click();
    await card.locator('.unlock-error[role="alert"]').waitFor({ timeout: 5000 });
    assert((await card.locator('.unlock-error').textContent()) === 'ההתחברות נכשלה. בדקו אימייל וסיסמה ונסו שוב.' && (await dialog.count()) === 0, 'O-123-33: login errors unchanged (inline)');
    assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  } finally {
    await context.close();
  }
  const copy = source(overrides, AUTH_COPY_FILE);
  assert(copy.includes(`registerDuplicate: '${O33_TEXT}',`) && !copy.includes(O33_OLD_TEXT), 'O-123-33: copy.ts duplicate text without «»');
  return 'unit O-123-33 (real AuthEntryScreen + copy.ts + App.css in Edge): duplicate e-mail → role="alertdialog" «כבר קיים חשבון … במסך התחברות.» (no «»), one focused «סגור»; form behind inert, opaque, brightness(); all 6 register fields cleared; DEV hint only in the console; «סגור» / Escape → empty register form, focus on the first field; other register / login errors inline as before';
}

// ─── O-123-29…32: the real AdminApp in Edge (stubs as in verifyPhase122AdminWorkspace) ─────
const ADMIN_APP = 'src/admin/AdminApp.tsx';
const REGISTRY_ADMIN = 'src/admin/RegistryAdmin.tsx';
const FILL_TEST_GRID = 'src/admin/AdminFillTestGrid.tsx';
/** Owner exception (Phase 123.5): the admin files O-123-29…32 may change (admin.css hunks pinned below). */
const O29_32_ADMIN = [ADMIN_APP, REGISTRY_ADMIN, FILL_TEST_GRID];
const USER_APPROVAL_LABELS = {
  approved: 'מאושר למשתמשים',
  not_approved: 'טרם אושר למשתמשים',
  blocked: 'חסום למשתמשים',
  no_mapping: 'אין מיפוי',
};
function adminApiStub() {
  const names = new Set();
  for (const m of read('src/admin/adminRegistryApi.ts').matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  const impl = {
    fetchAllRegistryRowsForAdmin: 'async () => clone(db().rows)',
    fetchAdminCategories: 'async () => clone(db().categories)',
    fetchRegistryRowForAdmin: 'async (id) => clone(db().rows.find((r) => r.id === id) ?? null)',
    updateGlobalRegistryRow: 'async (id, patch) => { applyPatch(id, patch); }',
    fetchPendingSubmissions: 'async () => []',
    fetchSubmitterProfiles: 'async () => []',
    ADMIN_NOTE_MAX_LENGTH: '20000',
    fetchAdminServiceNote: 'async () => null',
    fetchAdminNoteServiceIds: 'async () => []',
  };
  const lines = [
    'const db = () => globalThis.__pvdb;',
    'const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));',
    'let rev = 0;',
    'function applyPatch(id, patch) { const r = db().rows.find((x) => x.id === id); if (r) { Object.assign(r, clone(patch)); r.updated_at = "rev-" + (++rev); } }',
  ];
  for (const n of names) lines.push(`export const ${n} = ${impl[n] ?? (n.startsWith('fetch') ? 'async () => []' : 'async () => null')};`);
  return lines.join('\n');
}
const ADMIN_APP_STUBS = {
  'src/admin/adminRegistryApi.ts': adminApiStub,
  'src/admin/AdminGate.tsx': () => 'export default function AdminGate({ children }) { return children; }',
  'src/admin/adminAuth.ts': () =>
    'export async function readSignedInAdmin() { return { firstName: "דנה", lastName: "כהן", email: "admin@example.test" }; }\nexport async function resolveAdminAccess() { return { status: "allowed", userId: "u1", isAdmin: true, error: null }; }',
  'src/useServiceLogos.ts': () => 'export function useServiceLogos() { return {}; }',
  // The real module; only the Admin managed test answers from `globalThis.__pvFill` (no extension).
  'src/execution/managedAutofill.ts': () => {
    const real = read('src/execution/managedAutofill.ts');
    const head = 'export async function executeAdminManagedAutofillTest(';
    assert(real.includes(head), 'fixture: executeAdminManagedAutofillTest found');
    return `${real.replace(head, 'async function realExecuteAdminManagedAutofillTest(')}
export async function executeAdminManagedAutofillTest(input: Parameters<typeof realExecuteAdminManagedAutofillTest>[0]) {
  const hook = (globalThis as { __pvFill?: (i: unknown) => unknown }).__pvFill;
  return hook ? (hook(input) as ReturnType<typeof realExecuteAdminManagedAutofillTest>) : realExecuteAdminManagedAutofillTest(input);
}
`;
  },
};
const ADMIN_APP_ENTRY = `
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './src/admin/AdminApp.tsx';
const FIELDS = [
  { id: 'username', label: 'אימייל', type: 'text', required: true },
  { id: 'password', label: 'סיסמה', type: 'password', required: true },
];
const map = (fieldId, locator) => ({ fieldId, locatorType: 'css', locator });
const plain = { loginEntryType: 'direct_url', credentialMode: 'credential_fields' };
const profile = (id, extra = {}) => ({
  ...plain,
  autofillProfile: {
    configVersion: 1,
    supportState: 'not_configured',
    loginEntryUrl: 'https://' + id + '.example.test/login',
    allowedOrigin: 'https://' + id + '.example.test',
    fieldMappings: [map('username', '#u'), map('password', '#p')],
    ...extra,
  },
});
const approved = { supportState: 'validated', validation: { metadataVersion: 1 } };
const base = (id, name, category, metadata, extra = {}) => ({
  id, display_name: name, primary_url: 'https://' + id + '.example.test/', login_url: 'https://' + id + '.example.test/login',
  login_url_status: 'valid', category_id: category, icon: '🔗', adapter_id: null, source_type: 'admin', service_status: 'active',
  owner_user_id: null, login_fields: FIELDS, metadata, metadata_version: 1, created_at: '2026-09-01T10:00:00.000Z', updated_at: 't1', ...extra,
});
const rows = [
  base('adm-std', 'אתר רגיל', 'cat-a', profile('adm-std')),
  base('adm-ok', 'אתר מאושר', 'cat-a', profile('adm-ok', approved)),
  base('adm-ok-b', 'אתר מאושר בריאות', 'cat-b', profile('adm-ok-b', approved), { service_status: 'disabled' }),
  base('adm-blocked', 'אתר חסום', 'cat-b', profile('adm-blocked', { supportState: 'validated', configVersion: 2, validation: { metadataVersion: 1 } })),
  base('adm-none', 'אתר בלי מיפוי', 'cat-a', plain, { service_status: 'disabled' }),
  base('adm-none-b', 'אתר בלי מיפוי בריאות', 'cat-b', plain),
];
const categories = [{ id: 'cat-a', display_name: 'כללי', sort_order: 1 }, { id: 'cat-b', display_name: 'בריאות', sort_order: 2 }];
globalThis.__pvdb = { rows, categories };
createRoot(document.getElementById('root')).render(createElement(AdminApp));
`;
const adminAppBundles = new WeakMap();
async function openAdminApp(overrides, { reducedMotion = 'no-preference' } = {}) {
  if (!adminAppBundles.has(overrides)) adminAppBundles.set(overrides, await bundleAdminGate(overrides, ADMIN_APP_ENTRY, ADMIN_APP_STUBS));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL', reducedMotion });
  const page = await context.newPage();
  const s = { page, context, errors: [], native: [], console: [] };
  page.on('pageerror', (e) => s.errors.push(String(e)));
  page.on('console', (m) => s.console.push(m.text()));
  page.on('dialog', async (d) => {
    s.native.push(d.type());
    await d.dismiss();
  });
  await page.clock.install();
  await page.setContent('<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
  // As on the real /admin route: main.tsx loads index.css and App.css (static App import) before the admin chunk.
  for (const rel of ['src/index.css', CSS, ADMIN_CSS]) await page.addStyleTag({ content: source(overrides, rel) });
  await page.addScriptTag({ content: adminAppBundles.get(overrides) });
  await page.locator('.admin-site-card').first().waitFor({ timeout: 8000 });
  return s;
}
async function closeAdminApp(s) {
  try {
    assert(s.errors.length === 0, `page errors: ${s.errors.join(' | ')}`);
    assert(s.native.length === 0, `N-4: native browser dialog shown: ${s.native.join(', ')}`);
  } finally {
    await s.context.close();
  }
}
async function adminWait(page, fn, arg, message) {
  try {
    await page.waitForFunction(fn, arg, { timeout: 5000 });
  } catch {
    throw new Error(message);
  }
}
async function openAdminSite(page, name) {
  await page.locator('.admin-site-card', { has: page.locator(`.admin-site-card-name[title="${name}"]`) }).click();
  await adminWait(page, (n) => document.querySelector('[data-part="site-name"]')?.textContent === n, name, `fixture: workspace opened for «${name}»`);
}
async function adminTab(page, id) {
  await page.click(`[data-tab="${id}"]`);
  await adminWait(page, (t) => document.querySelector(`[data-tab-panel="${t}"]`)?.hidden === false, id, `fixture: workspace tab ${id} shown`);
}
const fontPx = (page, sel) => page.$eval(sel, (el) => parseFloat(getComputedStyle(el).fontSize));

/** O-123-30 (Architect ruling) — «+ אתר חדש» text 16px / 600 with the «+» scaled; button box and other buttons unchanged. */
async function checkAdminNewSiteFont(overrides) {
  const s = await openAdminApp(overrides);
  const { page } = s;
  const BTN = '[data-action="new-site"]';
  const geom = () => page.$eval(BTN, (el) => {
    const r = el.getBoundingClientRect();
    const icon = el.querySelector('svg.admin-icon')?.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: Math.round(r.width), h: Math.round(r.height), px: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), icon: icon ? Math.round(icon.width) : 0 };
  });
  const btn = await geom();
  const newSite = btn.px;
  assert(newSite === 16 && btn.weight === 600, `O-123-30: «+ אתר חדש» text 16px / weight 600 (got ${btn.px}px / ${btn.weight})`);
  assert(btn.icon >= 18 && btn.icon <= 20, `O-123-30: the «+» is scaled with the 16px text (18–20px; got ${btn.icon}px)`);
  const baseline = await page.addStyleTag({ content: `.admin-catalog-bar .admin-toolbar ${BTN}{font-size:14px!important}.admin-catalog-bar .admin-toolbar ${BTN} .admin-icon{width:16px!important;height:16px!important}` });
  const before = await geom();
  await baseline.evaluate((el) => el.remove());
  assert(before.px === 14 && before.icon === 16, `fixture: 14px / 16px «+» baseline applied (${before.px}px / ${before.icon}px)`);
  assert(btn.w === before.w && btn.h === before.h, `O-123-30: the button box is unchanged (${btn.w}×${btn.h} vs ${before.w}×${before.h} at 14px)`);
  const primaries = async () => page.$$eval('.admin-btn-primary:not([data-action="new-site"])', (els) =>
    els.filter((el) => el.getClientRects().length > 0).map((el) => ({ text: el.textContent.trim(), px: parseFloat(getComputedStyle(el).fontSize) })));
  await openAdminSite(page, 'אתר רגיל');
  const others = await primaries();
  await page.click('[data-action="back-to-catalog"]');
  await page.click('[data-nav="categories"]');
  await page.waitForTimeout(150);
  others.push(...(await primaries()));
  assert(others.length >= 2, `fixture: other primary admin buttons measured (${others.map((o) => o.text).join(' / ')})`);
  const sizes = [...new Set(others.map((o) => o.px))];
  assert(sizes.length === 1 && sizes[0] === 14, `O-123-30: the other primary admin buttons unchanged at 14px (${others.map((o) => `${o.text} ${o.px}px`).join(', ')})`);
  assert(newSite >= Math.max(...sizes), `O-123-30: «+ אתר חדש» ${newSite}px ≥ the other primary admin buttons ${sizes[0]}px`);
  await page.click('[data-nav="registry"]');
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.locator(BTN).waitFor();
  const narrow = await fontPx(page, BTN);
  assert(narrow === 16, `O-123-30: «+ אתר חדש» ${narrow}px at ≤ 1024px (full-width layout) = 16px`);
  await closeAdminApp(s);
  return `unit O-123-30 (real AdminApp + admin.css in Edge): «+ אתר חדש» 16px / 600, «+» ${btn.icon}px; box ${btn.w}×${btn.h} = the 14px box; ${others.length} other primary buttons stay 14px (${others.map((o) => o.text).join(' / ')})`;
}

/** O-123-31 — «בדיקה והפעלה»: no heading / description; Hebrew result only; result kept until the tab is left or the test runs again. */
async function checkAdminFillTestResult(overrides) {
  const s = await openAdminApp(overrides);
  const { page } = s;
  const head = () => page.evaluate(() => {
    const h = document.querySelector('.admin-workspace-head');
    return { h3: h?.querySelector('h3')?.textContent ?? null, desc: h?.querySelector('.admin-section-desc')?.textContent ?? null, text: document.querySelector('[data-part="workspace"]')?.textContent ?? '' };
  });
  const result = () => page.evaluate(() => {
    const r = document.querySelector('[data-tab-panel="test"] [data-part="fill-test-result"]');
    return {
      success: r?.querySelector('.admin-success span')?.textContent ?? null,
      error: r?.querySelector('.admin-error[role="alert"]')?.textContent ?? null,
      empty: Boolean(r?.querySelector('[data-empty="fill-test-result"]')),
    };
  });
  const fill = async () => {
    const inputs = page.locator('[data-tab-panel="test"] [data-temp-test-field]');
    const n = await inputs.count();
    for (let i = 0; i < n; i += 1) await inputs.nth(i).fill(`v${i}`);
    return n;
  };
  const run = '[data-tab-panel="test"] [data-action="managed-test"]';
  const diagnostics = { steps: [{ fieldId: 'username', found: true }] };
  const OK_MSG = 'המילוי הושלם בהצלחה.';
  const FAIL_MSG = 'שדה לא נמצא בדף.';
  try {
    await openAdminSite(page, 'אתר רגיל');
    const details = await head();
    assert(details.h3 === 'עריכת אתר', `O-123-31: the other tabs keep their heading (details: «${details.h3}»)`);
    await adminTab(page, 'test');
    const test = await head();
    assert(test.h3 === null && test.desc === null && !test.text.includes('עריכת אתר') && !test.text.includes('הרצת בדיקת מילוי מול המיפוי השמור, ומצב המיפוי.'),
      `O-123-31: «בדיקה והפעלה» shows no «עריכת אתר» heading and no description line (h3 «${test.h3}», line «${test.desc}»)`);

    const enabled = (label) => adminWait(page, (sel) => document.querySelector(sel)?.getAttribute('data-enabled') === 'true', run, `fixture: «כניסה לאתר ומילוי שדות» enabled (${label})`);
    const later = async () => {
      await page.clock.fastForward(30_000);
      await page.waitForTimeout(50);
    };

    // Failure: Hebrew summary only (diagnostics in the console), kept with no timer, cleared by leaving the tab.
    await page.evaluate(([msg, diag]) => {
      globalThis.__pvFill = async () => ({ ok: false, reason: 'field_not_found', userMessage: msg, fieldId: 'username', fillDiagnostics: diag });
    }, [FAIL_MSG, diagnostics]);
    assert((await fill()) === 2, 'fixture: two temp test fields');
    await enabled('first run');
    await page.click(run);
    await adminWait(page, () => Boolean(document.querySelector('[data-tab-panel="test"] .admin-error[role="alert"]')), null, 'O-123-31: the failure message is shown');
    const failed = await result();
    assert(failed.error !== null && failed.error.startsWith(FAIL_MSG) && !/A2|diagnostics|console/.test(failed.error), `O-123-31: the failure message has no «[A2 diagnostics …]» suffix (got «${failed.error}»)`);
    // O-123-31 (b) — visible text is the Hebrew sentence only; the technical tokens sit in a closed «פרטים טכניים».
    const tech = await page.evaluate(() => {
      const panel = document.querySelector('[data-tab-panel="test"]');
      const d = panel?.querySelector('details[data-section="managed-test-technical"]');
      const visible = [...(panel?.querySelectorAll('[data-part="fill-test-result"] p, [data-part="fill-test-result"] span') ?? [])]
        .filter((el) => !el.closest('details') && el.getClientRects().length > 0).map((el) => el.textContent).join(' | ');
      return { exists: Boolean(d), open: d?.open ?? null, summary: d?.querySelector('summary')?.textContent ?? null, text: d?.textContent ?? '', structureInside: Boolean(d?.querySelector('[data-testid="managed-test-structure"]')), structureCount: panel?.querySelectorAll('[data-testid="managed-test-structure"]').length ?? 0, visible };
    });
    assert(failed.error === FAIL_MSG, `O-123-31 (b): the visible failure line is the Hebrew sentence only (got «${failed.error}»)`);
    assert(!/field_not_found|שדה username/.test(tech.visible), `O-123-31 (b): no technical token visible outside «פרטים טכניים» (visible «${tech.visible}»)`);
    assert(tech.exists && tech.summary === 'פרטים טכניים', `O-123-31 (b): a «פרטים טכניים» section under the sentence (summary «${tech.summary}»)`);
    assert(tech.open === false, 'O-123-31 (b): «פרטים טכניים» is closed by default');
    assert(tech.text.includes('field_not_found') && tech.text.includes('שדה username'), `O-123-31 (b): reason code and «שדה username» inside «פרטים טכניים» (got «${tech.text}»)`);
    assert(tech.structureInside && tech.structureCount === 1, 'O-123-31 (b): the structure line sits only inside «פרטים טכניים»');
    assert(s.console.some((line) => line.startsWith('[A2 ManagedFillDiagnostics]')), 'O-123-31: the A2 diagnostics stay in the browser console');
    await later();
    assert((await result()).error === failed.error, 'O-123-31: the failure message stays (no timer; 30 s later)');
    await adminTab(page, 'login');
    await adminTab(page, 'test');
    const left = await result();
    assert(left.error === null && left.success === null && left.empty, 'O-123-31: leaving the tab clears the failure message');

    // The next run clears the previous message; success is Hebrew only and kept with no timer.
    await page.click(run);
    await adminWait(page, () => Boolean(document.querySelector('[data-tab-panel="test"] .admin-error[role="alert"]')), null, 'fixture: the failure is shown again');
    await page.evaluate(() => {
      globalThis.__pvFill = () => new Promise((resolve) => { globalThis.__pvFillDone = resolve; });
    });
    await enabled('rerun');
    await page.click(run);
    await adminWait(page, (sel) => document.querySelector(sel)?.textContent === 'ממלא…', run, 'fixture: the next run is running');
    const rerun = await result();
    assert(rerun.error === null && rerun.success === null, 'O-123-31: clicking «כניסה לאתר ומילוי שדות» again clears the previous message');
    await page.evaluate(([msg, diag]) => globalThis.__pvFillDone({ ok: true, userMessage: msg, fillDiagnostics: diag }), [OK_MSG, diagnostics]);
    await adminWait(page, () => Boolean(document.querySelector('[data-tab-panel="test"] .admin-success span')), null, 'O-123-31: the success message is shown');
    const ok = await result();
    assert(ok.success === OK_MSG, `O-123-31: the success message is the Hebrew text only, no «[A2 diagnostics …]» (got «${ok.success}»)`);
    await later();
    assert((await result()).success === OK_MSG, 'O-123-31: the success message stays (no timer; 30 s later)');
    await adminTab(page, 'login');
    await adminTab(page, 'test');
    const leftOk = await result();
    assert(leftOk.success === null && leftOk.error === null && leftOk.empty, 'O-123-31: leaving the tab clears the success message');
  } finally {
    await closeAdminApp(s);
  }
  const grid = source(overrides, FILL_TEST_GRID);
  assert(!/A2 diagnostics/.test(grid) && !/setTimeout/.test(grid), 'O-123-31: no A2 suffix text and no timer in AdminFillTestGrid.tsx');
  return 'unit O-123-31 (real AdminApp in Edge, stubbed managed test): «בדיקה והפעלה» without «עריכת אתר» / description (other tabs keep it); success and failure messages Hebrew only (A2 diagnostics in the console only); failure tokens + structure line inside a closed «פרטים טכניים»; kept 30 s with no timer; cleared by leaving the tab and by the next run';
}

/** O-123-32 — fourth filter «כל מצבי האישור» by the card badge state, AND-combined with the others. */
async function checkAdminApprovalFilter(overrides) {
  const s = await openAdminApp(overrides);
  const { page } = s;
  const cards = () => page.$$eval('.admin-card-grid .admin-site-card', (els) => els.map((el) => ({
    name: el.querySelector('.admin-site-card-name')?.getAttribute('title') ?? '',
    state: el.querySelector('[data-approval]')?.getAttribute('data-approval') ?? null,
    label: el.querySelector('[data-approval]')?.textContent ?? null,
  })));
  const names = async () => (await cards()).map((c) => c.name).sort().join(' | ');
  const selects = page.locator('.admin-filters select');
  const expected = {
    approved: ['אתר מאושר', 'אתר מאושר בריאות'],
    not_approved: ['אתר רגיל'],
    blocked: ['אתר חסום'],
    no_mapping: ['אתר בלי מיפוי', 'אתר בלי מיפוי בריאות'],
  };
  try {
    const all = await cards();
    assert(all.length === 6, `fixture: six catalog cards (${all.length})`);
    for (const [state, list] of Object.entries(expected)) {
      for (const n of list) assert(all.find((c) => c.name === n)?.state === state, `fixture: «${n}» badge is ${state}`);
    }
    assert((await selects.count()) === 4, `O-123-32: a fourth filter next to category / source / status (${await selects.count()} selects)`);
    const approval = selects.nth(3);
    const options = await approval.evaluate((el) => [...el.options].map((o) => [o.value, o.textContent]));
    const wantOptions = [['all', 'כל מצבי האישור'], ...Object.entries(USER_APPROVAL_LABELS)];
    assert(JSON.stringify(options) === JSON.stringify(wantOptions), `O-123-32: options «כל מצבי האישור» + one per approval state with the badge labels (got ${options.map((o) => o[1]).join(' / ')})`);
    assert(await approval.getAttribute('aria-label'), 'O-123-32: the filter has an accessible name');
    for (const [state, list] of Object.entries(expected)) {
      await approval.selectOption(state);
      const shown = await cards();
      assert(shown.map((c) => c.name).sort().join(' | ') === [...list].sort().join(' | '), `O-123-32: «${USER_APPROVAL_LABELS[state]}» shows exactly ${list.join(', ')} (got ${shown.map((c) => c.name).join(', ')})`);
      assert(shown.every((c) => c.state === state && c.label === USER_APPROVAL_LABELS[state]), `O-123-32: every shown card carries the «${USER_APPROVAL_LABELS[state]}» badge`);
    }
    await approval.selectOption('approved');
    await selects.nth(0).selectOption('cat-b');
    assert((await names()) === 'אתר מאושר בריאות', `O-123-32: AND with the category filter (got ${await names()})`);
    await selects.nth(0).selectOption('');
    await approval.selectOption('no_mapping');
    await selects.nth(2).selectOption('active');
    assert((await names()) === 'אתר בלי מיפוי בריאות', `O-123-32: AND with the status filter (got ${await names()})`);
    await selects.nth(2).selectOption('all');
    await approval.selectOption('approved');
    await page.fill('.admin-filters input[type="search"]', 'חסום');
    assert((await cards()).length === 0, `O-123-32: AND with the search (approved + «חסום» → none; got ${await names()})`);
    await page.fill('.admin-filters input[type="search"]', '');
    await approval.selectOption('all');
    assert((await cards()).length === 6, 'O-123-32: «כל מצבי האישור» shows every card again');
  } finally {
    await closeAdminApp(s);
  }
  return 'unit O-123-32 (real AdminApp in Edge): fourth filter «כל מצבי האישור» + מאושר / טרם אושר / חסום / אין מיפוי (badge labels, userApprovalState); each state shows exactly its badge cards; AND with category, status and search';
}

/** O-123-29 — the admin top options are a full-width bar of three equal tabs. */
async function checkAdminTabBar(overrides) {
  const s = await openAdminApp(overrides);
  const { page } = s;
  const measure = () => page.evaluate(() => {
    const bar = document.querySelector('.admin-app-header [role="tablist"]');
    const header = document.querySelector('.admin-app-header');
    const tabs = [...(bar?.querySelectorAll('[role="tab"]') ?? [])];
    const hs = header ? getComputedStyle(header) : null;
    return {
      bar: Boolean(bar),
      barWidth: bar?.getBoundingClientRect().width ?? 0,
      headerContent: header ? header.clientWidth - parseFloat(hs.paddingLeft) - parseFloat(hs.paddingRight) : 0,
      tabs: tabs.map((t) => {
        const cs = getComputedStyle(t);
        const r = t.getBoundingClientRect();
        return { nav: t.getAttribute('data-nav'), text: t.textContent, selected: t.getAttribute('aria-selected'), width: r.width, top: r.top, px: parseFloat(cs.fontSize), bg: cs.backgroundColor, color: cs.color, weight: Number(cs.fontWeight), transition: cs.transitionDuration };
      }),
    };
  });
  // F-2 ruling: poll (≤ 1.5 s) until the active tab's computed fill is non-transparent and the same on two
  // consecutive reads, so a read during the tab transition does not count; a transparent fill afterwards still fails.
  const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;
  const settled = async (active) => {
    const key = (x) => x.tabs.map((t) => `${t.bg}|${t.color}|${t.weight}`).join(';');
    let prev = await measure();
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      await page.waitForTimeout(50);
      const next = await measure();
      const on = next.tabs.find((t) => t.nav === active);
      if (on && !TRANSPARENT.test(on.bg) && key(next) === key(prev)) return next;
      prev = next;
    }
    return prev;
  };
  try {
    let m = await settled('registry');
    assert(m.bar, 'O-123-29: the top options are a role="tablist"');
    assert(m.tabs.length === 3 && m.tabs.map((t) => t.text).join(' / ') === 'קטגוריות / הגדרת אתרים / אתרים בהוספה ע"י משתמשים', `O-123-29: three role="tab" items, same labels and order (got ${m.tabs.map((t) => t.text).join(' / ')})`);
    assert(Math.abs(m.barWidth - m.headerContent) <= 1, `O-123-29: the tab bar spans the full header width (${Math.round(m.barWidth)} of ${Math.round(m.headerContent)}px)`);
    const widths = m.tabs.map((t) => t.width);
    assert(Math.max(...widths) - Math.min(...widths) <= 1 && new Set(m.tabs.map((t) => Math.round(t.top))).size === 1, `O-123-29: three equal tabs in one row (${widths.map((w) => Math.round(w)).join(' / ')}px)`);
    assert(m.tabs.every((t) => t.px >= 18 && t.px <= 20), `O-123-29: large tab text 1.125–1.25rem (${m.tabs.map((t) => t.px).join(' / ')}px)`);
    const check = (active) => {
      const on = m.tabs.find((t) => t.nav === active);
      const off = m.tabs.filter((t) => t.nav !== active);
      assert(m.tabs.filter((t) => t.selected === 'true').length === 1 && on.selected === 'true' && off.every((t) => t.selected === 'false'), `O-123-29: aria-selected="true" on «${on.text}» only`);
      assert(!TRANSPARENT.test(on.bg) && off.every((t) => t.bg !== on.bg && t.color !== on.color) && on.weight >= 700 && off.every((t) => t.weight < on.weight), `O-123-29: the active tab «${on.text}» is clearly dominant (fill ${on.bg}, weight ${on.weight} vs ${off.map((t) => `${t.bg} ${t.weight}`).join(', ')})`);
    };
    check('registry');
    assert(await page.locator('section.admin-section--registry').count() === 1, 'O-123-29: «הגדרת אתרים» content unchanged');

    // O-123-29 (b)(c) — WAI-ARIA tabs keyboard pattern (RTL) + tabpanel.
    const kb = () => page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.admin-app-header [role="tab"]')];
      const panels = document.querySelectorAll('[role="tabpanel"]');
      const panel = document.querySelector('main[role="tabpanel"]');
      const active = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
      return {
        order: tabs.map((t) => t.getAttribute('data-nav')).join(','),
        tabIndex: tabs.map((t) => t.tabIndex).join(','),
        controlsPanel: Boolean(panel) && tabs.every((t) => t.getAttribute('aria-controls') === panel.id),
        uniqueIds: new Set(tabs.map((t) => t.id).filter(Boolean)).size === tabs.length,
        labelledByActive: Boolean(panel && active && active.id && panel.getAttribute('aria-labelledby') === active.id),
        panelCount: panels.length,
        focused: document.activeElement?.getAttribute('data-nav') ?? null,
        selected: active?.getAttribute('data-nav') ?? null,
      };
    });
    let k = await kb();
    assert(k.order === 'categories,registry,approvals', `fixture: tab DOM order (${k.order})`);
    assert(k.tabIndex === '-1,0,-1', `O-123-29 (b): tabIndex 0 on the active tab only, -1 on the others (got ${k.tabIndex})`);
    assert(k.panelCount >= 1 && k.uniqueIds && k.controlsPanel && k.labelledByActive, `O-123-29 (c): aria-controls → <main role="tabpanel"> labelled by the active tab (panel ${k.panelCount}, ids ${k.uniqueIds}, controls ${k.controlsPanel}, labelledby ${k.labelledByActive})`);
    await page.focus('[role="tab"][data-nav="registry"]');
    const keyTo = async (key, want, label) => {
      await page.keyboard.press(key);
      k = await kb();
      assert(k.focused === want, `O-123-29 (b): ${label} — focus on «${want}» (got «${k.focused}»)`);
    };
    await keyTo('ArrowLeft', 'approvals', 'RTL ArrowLeft = next tab');
    await keyTo('ArrowLeft', 'categories', 'ArrowLeft wraps from the last tab to the first');
    await keyTo('ArrowRight', 'approvals', 'RTL ArrowRight = previous tab (wraps)');
    await keyTo('ArrowRight', 'registry', 'ArrowRight = previous tab');
    await keyTo('Home', 'categories', 'Home = first tab');
    await keyTo('End', 'approvals', 'End = last tab');
    assert(k.selected === 'registry' && await page.locator('section.admin-section--registry').count() === 1, `O-123-29 (b): arrows move focus only — routing unchanged until activation (selected «${k.selected}»)`);
    await page.keyboard.press('Enter');
    await adminWait(page, () => document.querySelector('[role="tab"][data-nav="approvals"]')?.getAttribute('aria-selected') === 'true', null, 'O-123-29 (b): Enter activates the focused tab');
    k = await kb();
    assert(k.tabIndex === '-1,-1,0' && k.labelledByActive, `O-123-29 (b)(c): after activation the roving tabIndex and aria-labelledby follow the active tab (${k.tabIndex}, labelledby ${k.labelledByActive})`);

    await page.click('[role="tab"][data-nav="categories"]');
    m = await settled('categories');
    check('categories');
    assert(await page.locator('section.admin-section--registry').count() === 0, 'O-123-29: switching tabs still routes to the selected screen');
    assert(m.tabs.every((t) => t.transition !== '0s'), `fixture: tab transitions present without reduced motion (${m.tabs.map((t) => t.transition).join(' / ')})`);
    await page.click('[role="tab"][data-nav="registry"]');
    await page.setViewportSize({ width: 360, height: 800 });
    await page.locator('.admin-catalog').waitFor();
    await page.waitForTimeout(150);
    const list = await page.$eval('.admin-catalog', (el) => el.getBoundingClientRect().height);
    assert(list >= 120, `O-123-29 / O-123-32: at 360 × 800 the tab bar and the four filters leave the site list usable (${Math.round(list)}px ≥ 120px)`);
  } finally {
    await closeAdminApp(s);
  }
  const reduced = await openAdminApp(overrides, { reducedMotion: 'reduce' });
  try {
    const r = await reduced.page.$$eval('.admin-app-header [role="tab"]', (els) => els.map((t) => getComputedStyle(t).transitionDuration));
    assert(r.length === 3 && r.every((d) => d.split(',').every((x) => parseFloat(x) === 0)), `O-123-29: prefers-reduced-motion → no tab animation (${r.join(' / ')})`);
  } finally {
    await closeAdminApp(reduced);
  }
  return 'unit O-123-29 (real AdminApp + admin.css in Edge): full-width role="tablist" with three equal role="tab" items (same labels / routing), 18–20px text, aria-selected on the active tab only, active tab filled + bold; roving tabIndex, RTL ArrowLeft = next / ArrowRight = previous (wrap), Home / End, Enter activates; aria-controls → <main role="tabpanel"> labelled by the active tab; reduced motion → no transition';
}

const RESOLVE_LOGO = 'src/resolveServiceLogo.ts';
async function loadResolveServiceLogo(overrides) {
  const dir = makeTempDir('pv-1235-logo-');
  const overridden = new Map(Object.entries(overrides).filter(([rel]) => rel.startsWith('src/')).map(([rel, src]) => [abs(rel), src]));
  try {
    const out = join(dir, `resolve-logo-${(unitBuild += 1)}.mjs`);
    await build({
      bundle: true,
      write: true,
      logLevel: 'silent',
      format: 'esm',
      platform: 'node',
      stdin: { contents: "export * from './src/resolveServiceLogo';", resolveDir: root, loader: 'ts', sourcefile: 'resolve-logo-entry.ts' },
      outfile: out,
      plugins: [{
        name: 'phase1235-resolve-logo',
        setup(b) {
          b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
            const key = args.path.replace(/\\/g, '/').toLowerCase();
            if (overridden.has(key)) return { contents: overridden.get(key), loader: loaderOf(key), resolveDir: dirname(args.path) };
            return undefined;
          });
        },
      }],
    });
    return await import(`${pathToFileURL(out).href}?v=${unitBuild}`);
  } finally {
    removeTempDir(dir);
  }
}

/** O-123-36 — 32 px fallback after the strict ≥ 36 px cascade; no third-party HTML proxy. */
async function checkServiceLogoFallback(overrides) {
  const mod = await loadResolveServiceLogo(overrides);
  const SITE = 'https://icon-site.example.test';
  const saved = { Image: globalThis.Image, fetch: globalThis.fetch, window: globalThis.window };
  const run = async (sizes, html = null) => {
    const fetched = [];
    const loaded = [];
    globalThis.window = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (t) => clearTimeout(t) };
    globalThis.fetch = async (url) => {
      fetched.push(String(url));
      if (html === null) throw new TypeError('fixture: CORS blocked');
      return { ok: true, text: async () => html };
    };
    globalThis.Image = class {
      set src(url) {
        loaded.push(url);
        queueMicrotask(() => {
          const size = sizes[url.slice(SITE.length)];
          if (size === undefined) this.onerror?.();
          else {
            this.naturalWidth = size;
            this.naturalHeight = size;
            this.onload?.();
          }
        });
      }
    };
    const result = await mod.resolveServiceLogo({ url: SITE });
    return { result, fetched, loaded };
  };
  try {
    assert(mod.APP_ICON_SIZE_PX === 44, 'fixture: APP_ICON_SIZE_PX 44 (strict tier ≥ 36 px)');
    const a = await run({ '/favicon.ico': 32 });
    assert(a.result === `${SITE}/favicon.ico`, `O-123-36 (a): only a 32 px favicon → its URL (got ${a.result})`);
    const b1 = await run({ '/favicon.ico': 32, '/favicon-96x96.png': 96 });
    assert(b1.result === `${SITE}/favicon-96x96.png`, `O-123-36 (b): 32 px + 96 px → the ≥ 36 px icon (got ${b1.result})`);
    const b2 = await run({ '/favicon.ico': 32, '/apple-touch-icon.png': 180 });
    assert(b2.result === `${SITE}/apple-touch-icon.png`, `O-123-36 (b): 32 px + apple 180 px → the apple icon (got ${b2.result})`);
    const b3 = await run({ '/favicon.ico': 32, '/favicon.png': 35 });
    assert(b3.result === `${SITE}/favicon.png`, `O-123-36: two sub-36 candidates → the largest (35 px) (got ${b3.result})`);
    const b4 = await run({ '/i32.png': 32, '/favicon-96x96.png': 96 }, '<link rel="icon" sizes="32x32" href="/i32.png">');
    assert(b4.result === `${SITE}/favicon-96x96.png`, `O-123-36 (b): a 32 px page icon does not stop the cascade before a later ≥ 36 px favicon (got ${b4.result})`);
    const c = await run({ '/favicon.ico': 16, '/apple-touch-icon.png': 31 });
    assert(c.result === null, `O-123-36 (c): only < 32 px icons → null (letter fallback) (got ${c.result})`);
    const tierCount = (r) => r.loaded.length;
    assert(tierCount(c) === tierCount(await run({})), 'O-123-36: no new image requests or tiers (same candidates as with no icon at all)');
    for (const r of [a, b1, b3, c]) {
      assert(r.fetched.length === 1 && r.fetched.every((u) => new URL(u).origin === SITE) && !r.fetched.some((u) => /allorigins/i.test(u)),
        `O-123-36 (d): HTML fetched directly from the site only, no third-party proxy (got ${r.fetched.join(', ')})`);
    }
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  }
  const src = source(overrides, RESOLVE_LOGO);
  assert(!/allorigins/i.test(src), 'O-123-36 (d): no allorigins in resolveServiceLogo.ts');
  return 'unit O-123-36 (real resolveServiceLogo.ts, stubbed Image / fetch): 32 px only → URL; 32 + ≥ 36 px (favicon, apple, after a 32 px page icon) → the ≥ 36 px icon; largest sub-36 wins; < 32 px → null; same candidate count; HTML fetched directly only (CORS failure → no proxy request)';
}

const UNIT_GROUPS = [checkRegisterExistingAccount, checkRegistryOwnerSelectSql, checkProfileDeleteProof, checkCustomAddAuthRequired, checkAdminLoginScreen, checkUserLoginTitle, checkRegisterDuplicateDialog, checkAdminNewSiteFont, checkAdminFillTestResult, checkAdminApprovalFilter, checkAdminTabBar, checkServiceLogoFallback];

// ─── Layer 3: browser (real App) ──────────────────────────────────────────────
const exportNames = (rel) => new Set([...read(rel).matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)].map((m) => m[1]));
const LOG = 'function log(kind, fn, args) { (globalThis.__pvSeq ??= []).push({ kind, fn, args }); }';

function persistenceStub() {
  const impl = {
    bumpDualWriteGeneration: '() => ++gen',
    getDualWriteGeneration: '() => gen',
    removeUserServiceFromCloud: 'async (id) => { log("cloud", "removeUserServiceFromCloud", [id]); }',
    hydrateWorkspaceFromCloud: 'async (_u, _k, local) => local',
    fetchCloudSyncBaseline: 'async () => null',
    refreshWorkspaceFromCloud: 'async () => null',
    syncVaultStateToSupabase: 'async () => ({ goneServiceIds: [], goneProfileIds: [], confirmed: { serviceIds: [], profileIds: [] } })',
    syncVaultStateToSupabaseSafe: 'async () => ({ ok: true })',
    setCloudGoneListener: '(fn) => { globalThis.__pvGone = fn; }',
    PROFILE_DELETE_UNCONFIRMED: JSON.stringify(unconfirmedCode()),
    deleteAccessProfileFromCloud: `async (id) => { log("cloud", "deleteAccessProfileFromCloud", [id]); if (globalThis.__pvCtl.profileDeleteNoRow) throw Object.assign(new Error("no row (fixture)"), { code: ${JSON.stringify(unconfirmedCode())} }); }`,
    setCloudConfirmedListener: '() => {}',
    fetchVaultKdf: 'async () => null',
    ensureVaultKdfSeeded: 'async () => {}',
  };
  const lines = ['let gen = 0;', LOG];
  for (const n of exportNames('src/supabase/persistence.ts')) lines.push(`export const ${n} = ${impl[n] ?? `async (...args) => { log("cloud", ${JSON.stringify(n)}, args); }`};`);
  return lines.join('\n');
}

/** Vault storage without crypto: every write is recorded (ids / names only, never credential values). */
const VAULT_STUB = () => `
const KEY = 'pv-fake-vault';
let unlocked = null;
export class WrongPasswordError extends Error {}
export function vaultStorageIdForUser(u) { return 'user:' + u; }
export function emptyVaultState() { return { credentials: {}, accessProfiles: [], selectedIds: [], customServices: [] }; }
export function isVaultUnlocked() { return unlocked !== null; }
export function getActiveVaultUserId() { return unlocked; }
export function getActiveVaultCryptoKey() { return unlocked ? { fake: 'vault-key' } : null; }
export function getCloudCredentialCryptoKey() { return unlocked ? { fake: 'cloud-key' } : null; }
export function lockVault() { unlocked = null; }
export async function unlockVault(_password, userId) {
  unlocked = userId;
  const raw = localStorage.getItem(KEY);
  return JSON.parse(raw ?? JSON.stringify(globalThis.__pvFix.vault));
}
export async function persistVault(state) {
  globalThis.__pvSeq.push({ kind: 'persist', selectedIds: [...state.selectedIds] });
  await Promise.resolve();
  if (globalThis.__pvCtl.persistFail) throw new Error('persist down (fixture)');
  localStorage.setItem(KEY, JSON.stringify(state));
}
export async function vaultExists() { return true; }
`;

const STUBS = {
  'src/supabase/persistence.ts': persistenceStub,
  'src/vault/vault.ts': VAULT_STUB,
  'src/supabase/client.ts': () => 'export function getSupabaseClient() { return null; }\nexport function resetSupabaseClient() {}\nexport function resetSupabaseClientForTests() {}',
  'src/catalog/catalogLoader.ts': () => 'export async function loadBuiltinCatalogDefinitions() { if (globalThis.__pvCtl.catalogFail) throw new Error("catalog down (fixture)"); return JSON.parse(JSON.stringify(globalThis.__pvFix.catalog)); }\nexport function getBuiltinCatalogDefinitions() { throw new Error("not used"); }',
  'src/auth/AuthEntryScreen.tsx': () => 'export default function AuthEntryScreen({ onAuthenticated }) { return <button type="button" data-pv-login="true" onClick={() => void onAuthenticated(globalThis.__pvFix.profile, "fixture-master")}>login</button>; }',
  'src/useServiceLogos.ts': () => 'export function useServiceLogos() { return {}; }\nexport default useServiceLogos;',
  'src/logoCache.ts': () => 'export async function getCachedServiceLogo() { return null; }\nexport function preloadServiceLogos() {}\nexport function peekCachedLogo() { return undefined; }\nexport function invalidateServiceLogoCache() {}',
};

const PARTIAL = {
  'src/auth/index.ts': () => `
export async function restoreAccountSession() { return null; }
export async function signOutAccount() {}
export async function requireAuthenticatedUserId() { return globalThis.__pvFix.profile.id; }
export async function tryGetAuthenticatedUserId() { return globalThis.__pvFix.profile.id; }`,
  'src/registry/categoryCatalog.ts': () => 'export async function loadRegistryCategories() { return JSON.parse(JSON.stringify(globalThis.__pvFix.categories)); }',
  'src/supabase/registryPersistence.ts': () => `
export async function deleteCustomServiceRegistryRow() {}
export async function upsertCustomServiceRegistryRow() {}
export async function ensureKnownBuiltinRegistryRow() {}`,
  // Assistance results are set per check (the real execution path is not under test here).
  'src/loginAssistance/assistanceActions.ts': () => `
import { MSG_AUTOFILL_CREDENTIALS_MISSING as __pvCredentialsMissing } from './messages';
export function openAssistanceUrl() {
  return globalThis.__pvCtl.open ?? { status: 'opened', url: 'about:blank', source: 'loginUrl', message: ${JSON.stringify(HE.opened)} };
}
export async function attemptExistingAutomaticCompletion() {
  if (globalThis.__pvCtl.auto === 'credentials_missing') return { attempted: true, message: __pvCredentialsMissing, outcome: 'failure' };
  return globalThis.__pvCtl.auto ?? { attempted: true, message: ${JSON.stringify(HE.opened)}, outcome: 'opened' };
}`,
};

function seamsPlugin(overrides, used) {
  const stubs = new Map(Object.entries(STUBS).map(([rel, fn]) => [abs(rel), fn]));
  const partial = new Map(Object.entries(PARTIAL).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).filter(([rel]) => rel.startsWith('src/')).map(([rel, src]) => [abs(rel), src]));
  return {
    name: 'phase1235-seams',
    setup(b) {
      b.onResolve({ filter: /^pv-real:/ }, (args) => ({ path: args.path.slice('pv-real:'.length), namespace: 'pv-real' }));
      b.onLoad({ filter: /.*/, namespace: 'pv-real' }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        if (overridden.has(key)) used.add(key);
        return {
          contents: overridden.get(key) ?? readFileSync(args.path, 'utf8'),
          loader: loaderOf(key),
          resolveDir: dirname(args.path),
        };
      });
      b.onLoad({ filter: /\.(ts|tsx|css)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        const loader = loaderOf(key);
        if (stubs.has(key)) return { contents: stubs.get(key)(), loader, resolveDir: dirname(args.path) };
        if (partial.has(key)) {
          return { contents: `export * from ${JSON.stringify(`pv-real:${args.path}`)};\n${partial.get(key)()}`, loader, resolveDir: dirname(args.path) };
        }
        if (overridden.has(key)) {
          used.add(key);
          return { contents: overridden.get(key), loader, resolveDir: dirname(args.path) };
        }
        return undefined;
      });
    },
  };
}

const HARNESS_ENTRY = `
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/index.css';

globalThis.__pvFix = ${JSON.stringify(FIXTURE)};
globalThis.__pvSeq = [];
globalThis.__pvCtl = { catalogFail: false, open: null, auto: null };
try {
  createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
  window.__pvReady = true;
} catch (e) {
  window.__pvBootError = String((e && e.stack) || e);
}
`;
const INDEX_HTML = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="harness.css"></head><body><div id="root"></div><script src="harness.js"></script></body></html>';

async function bundleHarness(dir, overrides) {
  const used = new Set();
  const srcOverrides = Object.keys(overrides).filter((rel) => rel.startsWith('src/') && rel !== REGISTER);
  await build({
    bundle: true,
    write: true,
    logLevel: 'silent',
    jsx: 'automatic',
    nodePaths: [join(root, 'node_modules')],
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
    define: ENV_DEFINE,
    stdin: { contents: HARNESS_ENTRY, resolveDir: root, loader: 'tsx', sourcefile: 'harness.tsx' },
    outfile: join(dir, 'harness.js'),
    format: 'iife',
    platform: 'browser',
    plugins: [seamsPlugin(overrides, used)],
  });
  assert(used.size === srcOverrides.length, `fixture: every override loaded (${used.size}/${srcOverrides.length})`);
  if (!existsSync(join(dir, 'harness.css'))) writeFileSync(join(dir, 'harness.css'), '');
  writeFileSync(join(dir, 'index.html'), INDEX_HTML);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = join(dir, rel);
      if (relative(dir, file).startsWith('..') || !existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/`;
      registerHarnessDir(url, dir);
      resolve({ url, close: () => closeServer(server) });
    });
  });
}

// H-1: every browser group / mutation run is bounded; contexts are closed in the group finally.
const GROUP_TIMEOUT_MS = 90_000;
const MUTATION_TIMEOUT_MS = 300_000;
const openContexts = new Set();
let reclaimedContexts = 0;
async function closeOpenContexts() {
  const contexts = [...openContexts];
  openContexts.clear();
  reclaimedContexts += contexts.length;
  await Promise.allSettled(contexts.map((c) => withTimeout(() => c.close(), 10_000, checkTimeoutMessage('browser context close'))));
}

let browser = null;
async function openPage(url, { vault = null, catalogFail = false, catalogExtra = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' });
  openContexts.add(context);
  context.setDefaultTimeout(8000);
  await routeHarness(context, url);
  const page = await context.newPage();
  const s = { page, context, errors: [], native: [] };
  page.on('pageerror', (e) => s.errors.push(String(e)));
  page.on('dialog', async (d) => {
    s.native.push(d.type());
    await d.dismiss();
  });
  await page.clock.install();
  await page.goto(url);
  await assertSecureContext(page);
  await page.waitForFunction(() => window.__pvReady || window.__pvBootError, null, { timeout: 30000, polling: 100 });
  const bootError = await page.evaluate(() => window.__pvBootError ?? null);
  assert(!bootError, `fixture: harness boot failed: ${bootError}`);
  await page.locator('[data-pv-login]').waitFor({ timeout: 15000 });
  await page.evaluate(({ v, fail, extra }) => {
    if (v) globalThis.__pvFix.vault = v;
    globalThis.__pvCtl.catalogFail = fail;
    globalThis.__pvFix.catalog.push(...extra);
  }, { v: vault, fail: catalogFail, extra: catalogExtra });
  await page.locator('[data-pv-login]').click();
  await page.locator('.dashboard').waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  return s;
}
async function closePage(s) {
  try {
    assert(s.errors.length === 0, `page errors: ${s.errors.join(' | ')}`);
    assert(s.native.length === 0, `N-4: native browser dialog shown: ${s.native.join(', ')}`);
  } finally {
    openContexts.delete(s.context);
    await withTimeout(() => s.context.close(), 10_000, checkTimeoutMessage('browser context close'));
  }
}
const panel = (s) => s.page.locator('section[data-login-assistance]');
const catalog = (s) => s.page.locator('[data-catalog-modal]');
const modal = (s) => s.page.locator('.cd-dialog');
const menu = (s) => panel(s).locator('[role="menu"]');
const menuButton = (s) => panel(s).locator('[data-app-menu] button[aria-haspopup="menu"]');
const confirmDialog = (s) => s.page.locator('[role="alertdialog"][aria-labelledby="dh-remove-app-title"]');
const stored = (s) => s.page.evaluate(() => JSON.parse(localStorage.getItem('pv-fake-vault') ?? 'null'));
const persists = (s) => s.page.evaluate(() => window.__pvSeq.filter((e) => e.kind === 'persist').length);
const profilesOf = async (s, id) => ((await stored(s))?.accessProfiles ?? []).filter((p) => p.serviceId === id);
async function waitFor(s, fn, arg, message, timeout = 5000) {
  try {
    await s.page.waitForFunction(fn, arg, { timeout });
  } catch {
    throw new Error(message);
  }
}
async function openTile(s, id) {
  // O-123-18 (G-3): the window of an app may already be open again after its modal closed; a tile
  // click would toggle it shut.
  // A window reopened for another app may cover this tile, so it is closed first (after the reopen settled).
  await s.page.waitForTimeout(150);
  if ((await s.page.locator(`[data-service-id="${id}"] button.app-icon[aria-expanded="true"]`).count()) === 1 && (await panel(s).count()) === 1) return;
  if ((await panel(s).count()) === 1) {
    await panel(s).locator('.la-close-btn').click();
    await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  }
  await s.page.click(`[data-service-id="${id}"] button.app-icon`);
  await panel(s).waitFor({ state: 'visible', timeout: 5000 });
}
async function openMenu(s) {
  await menuButton(s).click();
  await menu(s).waitFor({ state: 'visible', timeout: 5000 });
}
/** Texts of Digital Home banners / live regions outside the floating window. */
const bannerTexts = (s) => s.page.evaluate(() => [...document.querySelectorAll('.dashboard-banner, [role="status"], [role="alert"]')]
  .filter((el) => !el.closest('[data-login-assistance]'))
  .map((el) => el.textContent ?? ''));

async function checkCatalogCards(url) {
  const s = await openPage(url);
  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).locator('[data-catalog-item="svc-long"]').waitFor({ timeout: 5000 });
  // O-123-35 (G-3): the card is the `[data-catalog-item]` button itself; no per-card action.
  const m = await catalog(s).evaluate((root) => {
    const items = [...root.querySelectorAll('[data-catalog-item]')];
    return items.map((item) => {
      const card = item.getBoundingClientRect();
      const nameEl = item.querySelector('.sm-pick-name');
      const cs = getComputedStyle(nameEl);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
      return {
        id: item.getAttribute('data-catalog-item'),
        state: item.getAttribute('data-catalog-state'),
        w: card.width, h: card.height, top: card.top,
        nameH: nameEl.getBoundingClientRect().height, lh,
        clipped: nameEl.scrollHeight > nameEl.clientHeight + 1,
        clamp: cs.webkitLineClamp,
        title: nameEl.getAttribute('title'),
        text: nameEl.textContent,
        full: item.textContent ?? '',
      };
    });
  });
  assert(m.length >= 9 && new Set(m.map((c) => Math.round(c.top))).size >= 2, `fixture: catalog spans ≥ 2 rows (${m.length} cards)`);
  const hs = m.map((c) => c.h);
  const ws = m.map((c) => c.w);
  assert(Math.max(...hs) - Math.min(...hs) <= 1, `O-123-1: every catalog card has the same height (got ${Math.min(...hs).toFixed(1)}–${Math.max(...hs).toFixed(1)})`);
  assert(Math.max(...ws) - Math.min(...ws) <= 1, `O-123-1: every catalog card has the same width (got ${Math.min(...ws).toFixed(1)}–${Math.max(...ws).toFixed(1)})`);
  const long = m.find((c) => c.id === 'svc-long');
  assert(long.clamp === '2' && long.clipped && long.nameH <= 2 * long.lh + 2, `O-123-1: long name clamped to 2 lines with an ellipsis (lines ≈ ${(long.nameH / long.lh).toFixed(2)}, clamp ${long.clamp})`);
  assert(long.title === LONG_NAME && long.text === LONG_NAME, 'O-123-1: the full name stays in `title` (and the DOM text)');
  assert(m.every((c) => c.title === c.text), 'O-123-1: every card name carries its full name in `title`');
  assert(m.some((c) => c.state === 'added'), 'fixture: an in-home card is measured');
  await closePage(s);
  return `browser O-123-1 (on the O-123-35 card): ${m.length} catalog cards over ≥ 2 rows share one size (also «${HE.added}»); the long name clamps to 2 lines with its full name in \`title\``;
}

async function checkHeaderAddButton(url) {
  const s = await openPage(url, { vault: EMPTY_VAULT });
  assert((await s.page.locator('[data-home-empty]').count()) === 1, 'fixture: empty home');
  assert((await s.page.locator('[data-action="open-catalog"]').count()) === 0, 'O-123-3: no header «+ הוספת אפליקציה» while there are 0 apps');
  const cta = s.page.locator('[data-action="open-catalog-empty"]');
  assert((await cta.count()) === 1 && (await cta.textContent()) === HE.addApp, 'O-123-3: the empty state keeps its central «+ הוספת אפליקציה»');
  await cta.click();
  // O-123-35 (G-3): select + CTA (was the per-card «הוספה»); the catalog closes itself after the add.
  await catalog(s).locator('[data-catalog-item="svc-avail"]').click();
  await catalog(s).locator('[data-action="catalog-add-selected"]').click();
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  await s.page.locator('[data-service-id="svc-avail"]').waitFor({ timeout: 5000 });
  const header = s.page.locator('[data-action="open-catalog"]');
  assert((await header.count()) === 1 && (await header.textContent()) === HE.addApp, 'O-123-3: the header button returns from the first app on');
  await closePage(s);
  return 'browser O-123-3: 0 apps → central button only; after the first add the header «+ הוספת אפליקציה» returns';
}

async function requestRemove(s, id) {
  await openTile(s, id);
  await openMenu(s);
  const item = panel(s).locator('[data-action="remove-app"]');
  const label = await item.textContent();
  assert(label === HE.removeSite, `O-123-20: the window menu item reads «${HE.removeSite}» (got «${label}»)`);
  await item.click();
  await confirmDialog(s).waitFor({ state: 'visible', timeout: 5000 });
}
async function checkRemoveDialog(url) {
  const s = await openPage(url);
  await requestRemove(s, 'svc-zero');
  const d = confirmDialog(s);
  assert((await d.locator('#dh-remove-app-title').textContent()) === 'להסיר את אפס פרופילים?', 'O-123-4: 0 profiles → title «להסיר את <name>?»');
  assert((await d.locator('p').count()) === 0 && !(await d.textContent()).includes(HE.confirmBody), 'O-123-4: 0 profiles → no paragraph');
  assert((await d.getAttribute('aria-describedby')) === null, 'O-123-4: no aria-describedby pointing to a missing paragraph');
  assert((await d.locator('[data-action="confirm-remove-app"]').count()) === 1 && (await d.locator('[data-action="cancel-remove-app"]').count()) === 1, 'O-123-4: the two buttons stay');
  await d.locator('[data-action="cancel-remove-app"]').click();
  await d.waitFor({ state: 'detached', timeout: 5000 });
  await requestRemove(s, 'svc-cred');
  const body = await s.page.locator(`#${await d.getAttribute('aria-describedby')}`).textContent();
  // O-123-21 (G-3): the paragraph now reads «…של האתר…» (was: unchanged vs 123.4).
  assert(body === HE.confirmBody, `O-123-21: ≥ 1 profile → the paragraph reads «${HE.confirmBody}» (got «${body}»)`);
  await d.locator('[data-action="cancel-remove-app"]').click();
  await d.waitFor({ state: 'detached', timeout: 5000 });
  // Same order / Undo / commit path for a 0-profile app (AD-123-11).
  await requestRemove(s, 'svc-zero');
  await d.locator('[data-action="confirm-remove-app"]').click();
  await s.page.locator('[data-undo-toast]').waitFor({ state: 'visible', timeout: 5000 });
  assert((await s.page.locator('[data-service-id="svc-zero"]').count()) === 0, 'O-123-4: the tile is hidden during the Undo window');
  await s.page.clock.fastForward(6000);
  await waitFor(s, () => window.__pvSeq.some((e) => e.kind === 'cloud' && e.fn === 'removeUserServiceFromCloud' && e.args[0] === 'svc-zero'), null, 'O-123-4: the removal commits through the same cloud path');
  await waitFor(s, () => !JSON.parse(localStorage.getItem('pv-fake-vault') ?? '{"selectedIds":["svc-zero"]}').selectedIds.includes('svc-zero'), null, 'O-123-4: the removal is persisted');
  await closePage(s);
  return 'browser O-123-4 / O-123-20 / O-123-21: menu «הסרת אתר»; 0 profiles → title + buttons only; ≥ 1 → «…של האתר…» paragraph; 0-profile removal → Undo window → same commit';
}

async function checkMenuCloses(url) {
  const s = await openPage(url);
  await openTile(s, 'svc-cred');
  await openMenu(s);
  await panel(s).locator('.la-field-row button[aria-pressed]').first().click();
  assert((await menu(s).count()) === 0 && (await panel(s).count()) === 1, 'O-123-5: another action in the window closes the menu');
  await openMenu(s);
  await panel(s).locator('.la-panel-title-text').click();
  assert((await menu(s).count()) === 0 && (await panel(s).count()) === 1, 'O-123-5: a click elsewhere in the window closes the menu');
  await openMenu(s);
  await s.page.keyboard.press('Escape');
  await s.page.waitForTimeout(150);
  assert((await menu(s).count()) === 0, 'O-123-5: Escape closes the menu');
  if ((await panel(s).count()) === 0) await openTile(s, 'svc-cred');
  await openMenu(s);
  const h1 = s.page.locator('.dashboard-header h1');
  const box = await h1.boundingBox();
  const inPanel = await s.page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[data-login-assistance]')), { x: box.x + 10, y: box.y + box.height / 2 });
  assert(!inPanel, 'fixture: the outside click target is outside the window');
  await s.page.mouse.click(box.x + 10, box.y + box.height / 2);
  await s.page.waitForTimeout(150);
  assert((await menu(s).count()) === 0, 'O-123-5: an outside click closes the menu');
  if ((await panel(s).count()) === 0) await openTile(s, 'svc-cred');
  await openMenu(s);
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await menu(s).count()) === 0, 'O-123-5: window close closes the menu');
  await openTile(s, 'svc-cred');
  assert((await menu(s).count()) === 0 && (await menuButton(s).getAttribute('aria-expanded')) === 'false', 'O-123-5: a reopened window starts with the menu closed');
  await closePage(s);
  return 'browser O-123-5: the ⋮ menu closes on another window action, a click elsewhere in the window, Escape, an outside click and window close';
}

async function checkProfileNames(url) {
  const s = await openPage(url);
  // 0 profiles: no name field, saved without credentials (O-123-7), stored as «ראשי».
  await openTile(s, 'svc-zero');
  await panel(s).locator('[data-action="add-first-profile"]').click();
  const form = modal(s).locator('[data-mode="add-profile"]');
  await form.waitFor({ state: 'visible', timeout: 5000 });
  assert((await form.locator('input[aria-label="שם פרופיל חדש"]').count()) === 0 && !(await form.textContent()).includes('שם פרופיל'), 'O-123-6: 0 profiles → the add form has no name field');
  assert(!(await modal(s).textContent()).includes(HE.hint), 'O-123-7: no optional-credentials hint in the add form');
  let writes = await persists(s);
  await modal(s).locator('button', { hasText: HE.saveProfile }).click();
  await waitFor(s, () => JSON.parse(localStorage.getItem('pv-fake-vault') ?? '{"accessProfiles":[]}').accessProfiles.some((p) => p.serviceId === 'svc-zero'), null, 'O-123-7: save without credentials still creates the profile');
  let mine = await profilesOf(s, 'svc-zero');
  assert(mine.length === 1 && mine[0].displayName === HE.first && mine[0].isDefault === true, `O-123-6: the first profile is stored as «${HE.first}» and is the default (got ${mine.map((p) => p.displayName).join(', ')})`);
  assert(!((await stored(s)).credentials ?? {})[mine[0].id], 'O-123-7: profile without credentials is valid');
  assert((await persists(s)) === writes + 1, 'O-123-6: one save → one persist (existing reducers + persistVault)');
  await modal(s).locator('button', { hasText: HE.addAnother }).waitFor({ timeout: 5000 });
  assert((await modal(s).locator('.cd-chip').count()) === 0 && !(await modal(s).textContent()).includes(HE.first), 'O-123-6: 1 profile → no chip / name in the modal');
  assert((await modal(s).locator('button', { hasText: HE.rename }).count()) === 0, 'O-123-6: 1 profile → no rename (name hidden)');
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });

  // A lone legacy named profile keeps its name, hidden; the second add requires a distinct name.
  await openTile(s, 'svc-one');
  assert((await panel(s).locator('.la-profile-chip').count()) === 0 && !(await panel(s).textContent()).includes('אישי'), 'O-123-6: 1 profile → no chips / name in the window');
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  assert((await modal(s).locator('.cd-chip').count()) === 0 && !(await modal(s).textContent()).includes('אישי'), 'O-123-6: a lone named profile is hidden in the modal');
  await modal(s).locator('button', { hasText: HE.addAnother }).click();
  const nameInput = modal(s).locator('[data-mode="add-profile"] input[aria-label="שם פרופיל חדש"]');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  writes = await persists(s);
  await modal(s).locator('button', { hasText: HE.saveProfile }).click();
  await modal(s).locator('[role="alert"]', { hasText: HE.nameRequired }).waitFor({ timeout: 5000 });
  assert((await persists(s)) === writes && (await profilesOf(s, 'svc-one')).length === 1, 'O-123-6: second profile without a name → Hebrew inline error, nothing saved');
  await nameInput.fill(' אישי ');
  await modal(s).locator('button', { hasText: HE.saveProfile }).click();
  await modal(s).locator('[role="alert"]', { hasText: HE.nameTaken }).waitFor({ timeout: 5000 });
  assert((await persists(s)) === writes && (await profilesOf(s, 'svc-one')).length === 1, 'O-123-6: a name equal to an existing one → Hebrew inline error, nothing saved');
  await nameInput.fill('עבודה');
  await modal(s).locator('button', { hasText: HE.saveProfile }).click();
  await waitFor(s, () => JSON.parse(localStorage.getItem('pv-fake-vault')).accessProfiles.filter((p) => p.serviceId === 'svc-one').length === 2, null, 'O-123-6: a distinct name is saved');
  assert((await profilesOf(s, 'svc-one')).find((p) => p.id === 'p-one').displayName === 'אישי', 'O-123-6: the existing name is kept (no migration)');
  const chips = (await modal(s).locator('.cd-chip').allTextContents()).join('|');
  assert(chips.includes('אישי') && chips.includes('עבודה'), `O-123-6: 2 profiles → both names shown (got ${chips})`);
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });

  // Second profile on the «ראשי» app → chips «ראשי» + new name; the first can be renamed.
  await openTile(s, 'svc-zero');
  await panel(s).locator('[data-action="add-profile"]').click();
  await modal(s).locator('[data-mode="add-profile"] input[aria-label="שם פרופיל חדש"]').fill('משפחה');
  await modal(s).locator('button', { hasText: HE.saveProfile }).click();
  await waitFor(s, () => JSON.parse(localStorage.getItem('pv-fake-vault')).accessProfiles.filter((p) => p.serviceId === 'svc-zero').length === 2, null, 'second profile saved');
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await openTile(s, 'svc-zero');
  const winChips = await panel(s).locator('.la-profile-chip').allTextContents();
  assert(winChips.length === 2 && winChips.includes(HE.first) && winChips.includes('משפחה'), `O-123-6: chips «${HE.first}» + the new name (got ${winChips.join('|')})`);
  await panel(s).locator('.la-profile-chip', { hasText: HE.first }).click();
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  await modal(s).locator('button', { hasText: HE.rename }).click();
  await modal(s).locator('.cd-rename input').fill('פרטי');
  await modal(s).locator('button', { hasText: HE.saveName }).click();
  await waitFor(s, () => JSON.parse(localStorage.getItem('pv-fake-vault')).accessProfiles.some((p) => p.serviceId === 'svc-zero' && p.displayName === 'פרטי'), null, 'O-123-6: the first profile can be renamed via «עריכת פרופיל»');
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });

  // Deleting down to one profile keeps the remaining name (hidden).
  await openTile(s, 'svc-two');
  await panel(s).locator('.la-profile-chip', { hasText: 'בית' }).click();
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  await modal(s).locator('button', { hasText: HE.deleteProfile }).click();
  await modal(s).locator('.cd-delete-confirm').click();
  await waitFor(s, () => JSON.parse(localStorage.getItem('pv-fake-vault')).accessProfiles.filter((p) => p.serviceId === 'svc-two').length === 1, null, 'delete saved');
  mine = await profilesOf(s, 'svc-two');
  assert(mine[0].displayName === 'אלף', `O-123-6: the profile left alone keeps its name (got ${mine[0].displayName})`);
  await modal(s).locator('button', { hasText: HE.addAnother }).waitFor({ timeout: 5000 });
  assert((await modal(s).locator('.cd-chip').count()) === 0 && !(await modal(s).textContent()).includes('אלף'), 'O-123-6: …and its name is hidden while it is the only one');
  await closePage(s);
  return 'browser O-123-6 / O-123-7: 0 → no name field, saved without credentials as «ראשי» (1 persist); 1 → no chips / name; 2nd add: empty / duplicate → Hebrew inline error, 0 writes; chips «ראשי» + new name; first renamed; lone profile keeps its name, hidden';
}

const MSG_NO_PROFILES = 'עדיין אין פרופיל לאתר זה.';
const dot = (s, id) => s.page.locator(`[data-service-id="${id}"] .app-icon-badge`);
/** The expected O-123-17 end state for `id`: no dot; window = «עדיין אין פרופיל…» + «הוסף פרופיל» + «פתח אתר» only. */
async function assertNoProfileState(s, id, how) {
  assert((await profilesOf(s, id)).length === 0, `O-123-17 (${how}): no profile of the app left in the vault`);
  assert((await dot(s, id).count()) === 0, `O-123-17 (${how}): dot / edit buttons remain after the last profile is deleted — the green dot is still shown`);
  if ((await panel(s).count()) === 0) await openTile(s, id);
  const empty = panel(s).locator('[data-app-context="empty-state"]');
  assert((await empty.count()) === 1 && (await empty.textContent()).includes(MSG_NO_PROFILES), `O-123-17 (${how}): the window shows «${MSG_NO_PROFILES}»`);
  const buttons = await panel(s).locator('.la-empty-state button, .la-actions button').evaluateAll((els) => els.map((el) => el.getAttribute('data-action') ?? el.className));
  assert(JSON.stringify(buttons) === JSON.stringify(['add-first-profile', 'la-primary-btn']), `O-123-17 (${how}): dot / edit buttons remain after the last profile is deleted — window buttons ${buttons.join(', ')}`);
  assert((await panel(s).locator('.la-profile-chip, [data-action="edit-profile"], [data-action="add-profile"]').count()) === 0, `O-123-17 (${how}): no chips / «עריכת פרופיל» / second «הוספת פרופיל»`);
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
}
async function deleteLoneProfileInModal(s, id) {
  await modal(s).locator('button', { hasText: HE.deleteProfile }).click();
  await modal(s).locator('.cd-delete-confirm').click();
  await waitFor(s, (sid) => !JSON.parse(localStorage.getItem('pv-fake-vault')).accessProfiles.some((p) => p.serviceId === sid), id, `O-123-17: the last profile of ${id} is deleted`);
  await modal(s).locator('[data-mode="add-profile"]').waitFor({ state: 'visible', timeout: 5000 });
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
}
async function checkLastProfileDeleted(url) {
  const s = await openPage(url);
  // One tab, real modal path: a lone legacy profile; a lone «ראשי» with stored credentials.
  // O-123-25 (G-3): the dot needs complete credentials — svc-one (profile, no credentials) starts without it (was: both start with a dot).
  for (const [id, startDot] of [['svc-one', 0], ['svc-cred', 1]]) {
    assert((await dot(s, id).count()) === startDot, `O-123-25: ${id} starts ${startDot ? 'with' : 'without'} its dot (dot only when ready to use)`);
    await openTile(s, id);
    await panel(s).locator('[data-action="edit-profile"]').click();
    await modal(s).waitFor({ state: 'visible', timeout: 5000 });
    await deleteLoneProfileInModal(s, id);
    await assertNoProfileState(s, id, `one tab, ${id}`);
  }
  // One tab: the first profile created and deleted in the same modal (O-123-6 add path).
  await openTile(s, 'svc-zero');
  await panel(s).locator('[data-action="add-first-profile"]').click();
  await modal(s).locator('[data-mode="add-profile"]').waitFor({ state: 'visible', timeout: 5000 });
  await modal(s).locator('button', { hasText: HE.saveProfile }).click();
  await modal(s).locator('button', { hasText: HE.addAnother }).waitFor({ timeout: 5000 });
  // O-123-25 (G-3): a first profile saved without credentials gives no dot (was: the dot appears after the first profile).
  assert((await profilesOf(s, 'svc-zero')).length === 1 && (await dot(s, 'svc-zero').count()) === 0, 'O-123-25: the first profile exists, without credentials → no dot');
  await deleteLoneProfileInModal(s, 'svc-zero');
  await assertNoProfileState(s, 'svc-zero', 'one tab, created and deleted in the same modal');
  await closePage(s);

  // Two tabs: the other tab deleted the last profile; this tab learns it from the cloud (AD-123-18 (2)).
  const t = await openPage(url);
  await t.page.evaluate(() => window.__pvGone({ goneServiceIds: [], goneProfileIds: ['p-one'] }));
  await waitFor(t, () => !JSON.parse(localStorage.getItem('pv-fake-vault') ?? '{"accessProfiles":[]}').accessProfiles.some((p) => p.id === 'p-one'), null, 'O-123-17: the profile deleted in the other tab leaves this tab');
  await assertNoProfileState(t, 'svc-one', 'two tabs, window closed');
  await openTile(t, 'svc-cred');
  await t.page.evaluate(() => window.__pvGone({ goneServiceIds: [], goneProfileIds: ['p-cred'] }));
  await waitFor(t, () => !JSON.parse(localStorage.getItem('pv-fake-vault')).accessProfiles.some((p) => p.id === 'p-cred'), null, 'O-123-17: the profile deleted in the other tab leaves this tab (window open)');
  await assertNoProfileState(t, 'svc-cred', 'two tabs, window open');
  await closePage(t);
  return 'browser O-123-17: last profile deleted (one tab: lone legacy, lone with credentials, created + deleted in one modal; two tabs: window closed / open) → no dot; window «עדיין אין פרופיל לאתר זה.» with «הוסף פרופיל» + «פתח אתר» only';
}

const MSG_PROFILE_DELETE_CLOUD_FAILED = 'לא הצלחנו למחוק את הפרופיל מהחשבון. בדקו חיבור לרשת ונסו שוב.';
async function checkDeleteUnconfirmed(url) {
  // p-cred is still waiting for its first cloud insert (outbox); p-one is not.
  const vault = { ...APPS_VAULT, syncOutbox: { serviceIds: [], profileIds: ['p-cred'] } };
  const s = await openPage(url, { vault });
  await s.page.evaluate(() => { globalThis.__pvCtl.profileDeleteNoRow = true; });
  const cloudDeletes = () => s.page.evaluate(() => window.__pvSeq.filter((e) => e.fn === 'deleteAccessProfileFromCloud').map((e) => e.args[0]));

  const dotBefore = await dot(s, 'svc-one').count();
  await openTile(s, 'svc-one');
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  const writes = await persists(s);
  await modal(s).locator('button', { hasText: HE.deleteProfile }).click();
  await modal(s).locator('.cd-delete-confirm').click();
  await modal(s).getByText(MSG_PROFILE_DELETE_CLOUD_FAILED).first().waitFor({ timeout: 5000 }).catch(() => {});
  assert(JSON.stringify(await cloudDeletes()) === '["p-one"]', 'fixture: the cloud delete was attempted once');
  assert((await profilesOf(s, 'svc-one')).length === 1 && (await persists(s)) === writes, 'O-123-17: 0-row cloud delete treated as success — the profile was deleted locally');
  assert((await modal(s).textContent()).includes(MSG_PROFILE_DELETE_CLOUD_FAILED), `O-123-17: the existing Hebrew error «${MSG_PROFILE_DELETE_CLOUD_FAILED}» is shown`);
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  // O-123-25 (G-3): svc-one has no credentials, so it has no dot; fail-closed = the dot state is unchanged (was: its dot stays).
  assert((await profilesOf(s, 'svc-one')).length === 1 && (await dot(s, 'svc-one').count()) === dotBefore, 'O-123-17: fail-closed — the profile and its dot state stay');

  // A profile that never reached the cloud has no row to remove: the delete still goes through.
  await openTile(s, 'svc-cred');
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  await deleteLoneProfileInModal(s, 'svc-cred');
  assert(!(await stored(s)).syncOutbox?.profileIds?.includes('p-cred'), 'O-123-17: the deleted outbox profile leaves the outbox');
  await assertNoProfileState(s, 'svc-cred', 'outbox profile, no cloud row');
  await closePage(s);
  return 'browser O-123-17: cloud delete removed no row → existing Hebrew error, profile / dot kept, 0 writes; a profile still in the outbox (never inserted) deletes normally';
}

const flashStyle = (s) => panel(s).locator('.la-panel-failure-flash').evaluate((el) => {
  const cs = getComputedStyle(el);
  return { name: cs.animationName, duration: cs.animationDuration, display: cs.display };
});
/** O-123-42: the wash's opacity at the given animation times (ms); the animation is paused for sampling. */
const flashOpacityAt = (s, times) => panel(s).locator('.la-panel-failure-flash').evaluate((el, ts) => {
  const anim = el.getAnimations()[0];
  if (!anim) return null;
  anim.pause();
  return ts.map((t) => {
    anim.currentTime = t;
    return Number(getComputedStyle(el).opacity);
  });
}, times);
/** O-123-42: mark the current wash, park it mid-fade, and report whether a later wash is a new, restarted one. */
const markFlash = (s) => panel(s).locator('.la-panel-failure-flash').evaluate((el) => {
  el.dataset.o42 = 'old';
  const anim = el.getAnimations()[0];
  anim.pause();
  anim.currentTime = 4000;
});
const flashRestart = (s) => panel(s).locator('.la-panel-failure-flash').evaluate((el) => {
  const anim = el.getAnimations()[0];
  return { old: el.dataset.o42 === 'old', time: anim ? Number(anim.currentTime) : null, opacity: Number(getComputedStyle(el).opacity) };
});
async function checkOutcomeMessages(url) {
  const s = await openPage(url);
  await openTile(s, 'svc-cred');
  await s.page.evaluate((m) => { globalThis.__pvCtl.open = { status: 'unavailable', message: m }; }, HE.openFailed);
  await panel(s).locator('.la-primary-btn').click();
  const alert = panel(s).locator('.la-panel-status[role="alert"]');
  await alert.waitFor({ timeout: 5000 }).catch(() => {});
  assert((await alert.count()) === 1, 'O-123-8: an open failure shows a `role="alert"` line in the window');
  assert((await alert.textContent()) === HE.openFailed && /la-panel-status--error/.test(await alert.getAttribute('class')), 'O-123-8: failure → red `role="alert"` line in the window');
  assert(!(await bannerTexts(s)).some((t) => t.includes(HE.openFailed)), 'O-123-8: the failure is not in the Digital Home banner');
  const fx = await flashStyle(s);
  // O-123-42 (G-3): was a 2 s fade from the first moment.
  assert(fx.name === 'la-panel-failure-fade' && fx.duration === '5s', `O-123-42: the soft red wash runs one 5 s animation (got ${fx.name} ${fx.duration})`);
  await markFlash(s);
  await panel(s).locator('.la-field-row button[aria-pressed]').first().click();
  await panel(s).locator('.la-primary-btn').click();
  await alert.waitFor({ timeout: 5000 });
  const restart = await flashRestart(s);
  assert(!restart.old && restart.time !== null && restart.time < 1500 && restart.opacity === 1, `O-123-42: a new failure restarts the wash (new element ${!restart.old}, at ${Math.round(restart.time ?? -1)} ms, opacity ${restart.opacity})`);
  const [h0, h1, h29, f35, f45, gone] = await flashOpacityAt(s, [0, 1000, 2900, 3500, 4500, 5100]) ?? [];
  assert(h0 === 1 && h1 === 1 && h29 === 1, `O-123-42: full opacity for the first 3 s (0 / 1 / 2.9 s: ${h0} / ${h1} / ${h29})`);
  assert(f35 > f45 && f35 < 1 && f45 > 0, `O-123-42: then the fade over the next 2 s (3.5 / 4.5 s: ${f35} / ${f45})`);
  assert(gone === 0, `O-123-42: after 5 s the wash is gone (got ${gone})`);
  await s.page.clock.fastForward(10_000);
  assert((await alert.count()) === 1, 'O-123-8: the failure line stays (no timer)');
  await panel(s).locator('.la-field-row button[aria-pressed]').first().click();
  assert((await alert.count()) === 0, 'O-123-8: the next action in the window clears the failure line');
  await panel(s).locator('.la-primary-btn').click();
  await alert.waitFor({ timeout: 5000 });
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  await openTile(s, 'svc-cred');
  assert((await alert.count()) === 0 && (await panel(s).locator('.la-panel-failure-flash').count()) === 0, 'O-123-8: window close clears the failure');
  // Neutral / success keeps the neutral style.
  await s.page.evaluate(() => { globalThis.__pvCtl.open = null; });
  await panel(s).locator('.la-primary-btn').click();
  const neutral = panel(s).locator('.la-panel-status[role="status"]');
  await neutral.waitFor({ timeout: 5000 });
  assert((await neutral.textContent()) === HE.opened && !/--error/.test(await neutral.getAttribute('class')) && (await alert.count()) === 0, 'O-123-8: success stays a neutral `role="status"` line');
  assert((await panel(s).locator('.la-panel-failure-flash').count()) === 0, 'O-123-8: no red flash for a neutral message');
  assert(!(await bannerTexts(s)).some((t) => t.includes(HE.opened)), 'O-123-8: success not in the Digital Home banner');
  // Autofill failure → the same red line, in the window only.
  await s.page.evaluate((m) => { globalThis.__pvCtl.auto = { attempted: true, message: m, outcome: 'failure' }; }, HE.autoFailed);
  await panel(s).locator('.la-secondary-btn--auto').click();
  await panel(s).locator('.la-panel-status[role="alert"]', { hasText: HE.autoFailed }).waitFor({ timeout: 5000 });
  assert(!(await bannerTexts(s)).some((t) => t.includes(HE.autoFailed)), 'O-123-8: autofill failure not in the Digital Home banner');
  // prefers-reduced-motion → the red line only.
  await s.page.emulateMedia({ reducedMotion: 'reduce' });
  await s.page.evaluate((m) => { globalThis.__pvCtl.open = { status: 'unavailable', message: m }; }, HE.openFailed);
  await panel(s).locator('.la-primary-btn').click();
  await panel(s).locator('.la-panel-status[role="alert"]', { hasText: HE.openFailed }).waitFor({ timeout: 5000 });
  const reduced = await flashStyle(s);
  // O-123-42 (G-3): was hidden entirely under reduced motion.
  assert(reduced.name === 'la-panel-failure-hold' && reduced.duration === '3s' && reduced.display !== 'none', `O-123-42: reduced motion → a static 3 s hold (got ${reduced.name} ${reduced.duration} / ${reduced.display})`);
  const [r0, r15, r29, rGone] = await flashOpacityAt(s, [0, 1500, 2900, 3100]) ?? [];
  assert(r0 === 1 && r15 === 1 && r29 === 1 && rGone === 0, `O-123-42: reduced motion → full opacity for 3 s, then removed with no fade (0 / 1.5 / 2.9 / 3.1 s: ${r0} / ${r15} / ${r29} / ${rGone})`);
  await closePage(s);
  // The top banner keeps messages not tied to one app (catalog unavailable).
  const c = await openPage(url, { catalogFail: true });
  const catalogBanners = await bannerTexts(c);
  assert(catalogBanners.some((t) => t.includes(HE.catalogDown)), `O-123-8: the catalog-unavailable banner stays on the Digital Home (got ${JSON.stringify(catalogBanners)})`);
  await closePage(c);
  return 'browser O-123-8: open / autofill failure → red role="alert" line in the window only, kept until the next action / close; O-123-42 red wash full opacity 3 s then 2 s fade, restarted by a new failure, reduced motion static 3 s then removed; success neutral; catalog banner stays';
}

const OWN_SITE = {
  schemaVersion: 1,
  id: 'custom-own-1235',
  displayName: 'אתר שלי',
  url: 'https://own.example.test/',
  loginUrl: 'https://own.example.test/',
  icon: '🔗',
  category: 'shopping',
  source: 'user-created',
  metadata: { faviconSiteUrl: 'https://own.example.test/', loginUrlSource: 'user', loginEntryType: 'primary_page' },
};
const siteForm = (s) => s.page.locator('.modal-dialog form');
const urlInput = (s) => siteForm(s).locator('.modal-url-row input');
const testButton = (s) => siteForm(s).locator('[data-action="test-open-url"]');
/** window.open is recorded and never navigates (no tab, no network). */
async function spyWindowOpen(s) {
  await s.page.evaluate(() => {
    window.__pvOpened = [];
    window.open = (...args) => {
      window.__pvOpened.push(args);
      return null;
    };
  });
}
const lastOpened = (s) => s.page.evaluate(() => window.__pvOpened.at(-1) ?? null);
async function typeUrl(s, value) {
  await urlInput(s).fill(value);
}
async function expectOpens(s, typed, expected, form) {
  await typeUrl(s, typed);
  assert(await testButton(s).isEnabled(), `O-123-10 (${form}): «↗ פתח» enabled for the valid address ${typed}`);
  await testButton(s).click();
  const opened = await lastOpened(s);
  assert(JSON.stringify(opened) === JSON.stringify([expected, '_blank', 'noopener,noreferrer']), `O-123-10 (${form}): ${typed} opens ${expected} in a new tab with noopener,noreferrer (got ${JSON.stringify(opened)})`);
}
const TEST_OPEN_NAME = 'פתח את הכתובת לבדיקה בכרטיסייה חדשה';
/** O-123-19: «↗ פתח» below the full-width URL field, ↗ to the right of «פתח», descriptive accessible name. */
async function assertOpenButtonLayout(s, form) {
  const m = await siteForm(s).evaluate((el) => {
    const row = el.querySelector('.modal-url-row');
    const input = row.querySelector('input');
    const btn = row.querySelector('[data-action="test-open-url"]');
    const icon = btn.querySelector('[aria-hidden="true"]');
    const text = [...btn.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    const range = document.createRange();
    if (text) range.selectNodeContents(text);
    const r = (node) => node.getBoundingClientRect();
    return {
      label: btn.textContent.replace(/\s+/g, ' ').trim(),
      below: r(btn).top >= r(input).bottom - 1,
      fullWidth: Math.abs(r(input).width - r(row).width) <= 1,
      iconRight: Boolean(icon && text) && r(icon).left >= range.getBoundingClientRect().right - 1,
    };
  });
  assert(m.label === '↗פתח' || m.label === '↗ פתח', `O-123-19 (${form}): label «↗ פתח» (got «${m.label}»)`);
  assert(m.below && m.fullWidth, `O-123-19 (${form}): the button sits below the URL field, which keeps the full width (below ${m.below}, full width ${m.fullWidth})`);
  assert(m.iconRight, `O-123-19 (${form}): ↗ is to the right of «פתח» (RTL)`);
  assert((await siteForm(s).getByRole('button', { name: TEST_OPEN_NAME, exact: true }).count()) === 1, `O-123-19 (${form}): descriptive accessible name «${TEST_OPEN_NAME}»`);
}
async function expectDisabled(s, typed, form) {
  await typeUrl(s, typed);
  assert(await testButton(s).isDisabled(), `O-123-10 (${form}): «↗ פתח» disabled for the invalid address "${typed}"`);
}
async function checkTestOpenButton(url) {
  const s = await openPage(url, { vault: { ...APPS_VAULT, selectedIds: [...APPS_VAULT.selectedIds, OWN_SITE.id], customServices: [OWN_SITE] } });
  const probes = [];
  s.page.on('request', (r) => {
    if (/example\.test/.test(r.url())) probes.push(r.url());
  });
  await spyWindowOpen(s);

  // Custom-site add form (catalog).
  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).locator('[data-action="add-custom-site"]').click();
  await siteForm(s).waitFor({ timeout: 5000 });
  // O-123-19 (G-3): was «פתיחה לבדיקה» next to the URL field.
  assert((await testButton(s).count()) === 1, 'O-123-10 (add): the test-open button is in the URL field block');
  await assertOpenButtonLayout(s, 'add');
  assert((await testButton(s).getAttribute('type')) === 'button', 'O-123-10 (add): the button never submits the form');
  assert(await s.page.locator('.modal-dialog').evaluate((el) => getComputedStyle(el).direction === 'rtl'), 'N-6: the form is RTL');
  assert(await testButton(s).isDisabled(), 'O-123-10 (add): disabled while the address is empty');
  for (const bad of ['localhost', 'ftp://files.example.test/', 'https://', 'אתר']) await expectDisabled(s, bad, 'add');
  await expectOpens(s, 'site.example.test', 'https://site.example.test/', 'add');
  await expectOpens(s, 'http://www.site.example.test', 'https://www.site.example.test/', 'add');
  await expectOpens(s, 'site.example.test/path?q=1', 'https://site.example.test/path?q=1', 'add');
  await siteForm(s).locator('input[type="text"]').first().fill('אתר לבדיקה');
  await siteForm(s).locator('select[data-field="category"]').selectOption({ index: 1 });
  const typed = await lastOpened(s);
  await siteForm(s).locator('button[type="submit"]').click();
  await siteForm(s).waitFor({ state: 'detached', timeout: 5000 });
  await waitFor(s, () => (JSON.parse(localStorage.getItem('pv-fake-vault') ?? 'null')?.customServices ?? []).some((d) => d.displayName === 'אתר לבדיקה'), null, 'O-123-10 (add): the custom site is saved');
  const added = ((await stored(s)).customServices ?? []).find((d) => d.displayName === 'אתר לבדיקה');
  assert(added.url === typed[0], `O-123-10 (add): the stored address equals the opened one (stored ${added.url}, opened ${typed[0]})`);
  await s.page.keyboard.press('Escape');
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });

  // «עריכת פרטי האתר».
  await openTile(s, OWN_SITE.id);
  await openMenu(s);
  await menu(s).locator('[data-action="edit-site-details"]').click();
  await siteForm(s).waitFor({ timeout: 5000 });
  // O-123-19 (G-3): was «פתיחה לבדיקה» next to the URL field.
  assert((await testButton(s).count()) === 1, 'O-123-10 (edit): the test-open button is in the URL field block');
  await assertOpenButtonLayout(s, 'edit');
  assert(await testButton(s).isEnabled(), 'O-123-10 (edit): enabled for the stored address');
  await testButton(s).click();
  assert(JSON.stringify(await lastOpened(s)) === JSON.stringify([OWN_SITE.url, '_blank', 'noopener,noreferrer']), 'O-123-10 (edit): opens the stored address unchanged');
  for (const bad of ['', 'localhost', 'http://']) await expectDisabled(s, bad, 'edit');
  await expectOpens(s, 'www.own.example.test/start', 'https://www.own.example.test/start', 'edit');
  await siteForm(s).locator('button[type="submit"]').click();
  await siteForm(s).waitFor({ state: 'detached', timeout: 5000 });
  await waitFor(s, (u) => (JSON.parse(localStorage.getItem('pv-fake-vault') ?? 'null')?.customServices ?? []).some((d) => d.url === u), 'https://www.own.example.test/start', 'O-123-10 (edit): the edited address is saved');
  const edited = ((await stored(s)).customServices ?? []).find((d) => d.id === OWN_SITE.id);
  assert(edited.url === 'https://www.own.example.test/start', `O-123-10 (edit): the stored address equals the opened one (got ${edited.url})`);
  assert(probes.length === 0, `O-123-10: no network probe of the typed address (got ${probes.join(', ')})`);
  await closePage(s);
  return 'browser O-123-10 / O-123-19: «↗ פתח» (descriptive accessible name) below the full-width URL field in the add form and in «עריכת פרטי האתר»; disabled for empty / invalid; opens exactly the stored address (scheme completed, www kept as typed) in a new tab with noopener,noreferrer; stored = opened; no network probe; RTL';
}

const MSG_FIELDS_UPDATED = 'שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.';
const MSG_NOT_SAVED_YET = 'עדיין לא שמרת פרטי כניסה לאתר זה.';
const ownCopy = (id, name, host) => ({ ...OWN_SITE, id, displayName: name, url: `https://${host}/`, loginUrl: `https://${host}/`, metadata: { ...OWN_SITE.metadata, faviconSiteUrl: `https://${host}/` } });
/** Owner step 10: the approved registry entry maps ONE different field (email) than the stored values. */
const APPROVED_OTHER_FIELD = {
  ...ownCopy('custom-upd-1235', 'אתר שאושר', 'upd.example.test'),
  loginFields: [{ id: 'email', label: 'אימייל', type: 'text' }],
  metadata: {
    faviconSiteUrl: 'https://upd.example.test/',
    credentialMode: 'credential_fields',
    autofillProfile: { ...approvedMapping('upd.example.test'), fieldMappings: [{ fieldId: 'email', locatorType: 'css', locator: '#email' }] },
  },
};
async function checkFieldsUpdatedOnly(url) {
  const upd = ownCopy('custom-upd-1235', 'אתר שאושר', 'upd.example.test');
  const fresh = ownCopy('custom-new-1235', 'אתר חדש', 'new.example.test');
  const storedUpd = { username: 'fixture-upd-user', password: 'fixture-upd-pass' };
  const vault = {
    ...APPS_VAULT,
    selectedIds: [...APPS_VAULT.selectedIds, upd.id, fresh.id],
    customServices: [upd, fresh],
    accessProfiles: [...APPS_VAULT.accessProfiles, prof('p-upd', upd.id, HE.first, true), prof('p-new', fresh.id, HE.first, true)],
    credentials: { ...APPS_VAULT.credentials, 'p-upd': storedUpd },
  };
  const s = await openPage(url, { vault, catalogExtra: [APPROVED_OTHER_FIELD] });
  const notice = panel(s).locator('[data-notice="login-fields-updated"]');

  await openTile(s, upd.id);
  assert((await notice.count()) === 1 && (await notice.textContent()).includes(MSG_FIELDS_UPDATED), 'fixture: approved own site with other stored field ids shows the D-123-8 notice');
  assert(!(await panel(s).textContent()).includes(MSG_NOT_SAVED_YET), `O-123-12: no «${MSG_NOT_SAVED_YET}» together with the fields-updated notice`);
  assert((await panel(s).locator('[data-action="edit-profile"]').count()) === 1 && (await notice.locator('[data-action="edit-profile"]').count()) === 1, 'O-123-12: the notice keeps its single «עריכת פרופיל»');
  assert((await panel(s).locator('.la-primary-btn').count()) === 1, 'O-123-12: the normal window actions stay');
  const kept = ((await stored(s)) ?? vault).credentials?.['p-upd'] ?? {};
  assert(JSON.stringify(Object.keys(kept).sort()) === '["password","username"]' && kept.username === storedUpd.username && kept.password === storedUpd.password, 'O-123-12: the stored values stay under the old field ids');
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });

  // Without the notice the "not saved yet" line is unchanged.
  await openTile(s, fresh.id);
  assert((await notice.count()) === 0 && (await panel(s).textContent()).includes(MSG_NOT_SAVED_YET), `O-123-12: without the notice «${MSG_NOT_SAVED_YET}» is shown as before`);
  await closePage(s);
  return 'browser O-123-12: approved own site whose stored values sit under other field ids → fields-updated notice + «עריכת פרופיל» + normal actions, no «עדיין לא שמרת…»; stored values kept; without the notice the line is unchanged';
}

const O25_DOT = "hasCredentials={\n          appHasProfile({ accessProfiles }, service.id) &&\n          deriveServiceManagementState(service, { selectedIds: homeIds, accessProfiles, credentials: credentialsByProfileId }) === 'added'\n        }";
const noStored = (id, name, host) => {
  const { loginFields: _fields, ...rest } = def(id, name, 'shopping', host);
  return { ...rest, metadata: { credentialMode: 'no_stored_credentials' } };
};
async function checkTileReadyDot(url) {
  const upd = ownCopy('custom-upd-1235', 'אתר שאושר', 'upd.example.test');
  const nsZero = noStored('svc-ns-zero', 'ללא פרטים בלי פרופיל', 'ns-zero.example.test');
  const nsOne = noStored('svc-ns-one', 'ללא פרטים עם פרופיל', 'ns-one.example.test');
  const storedUpd = { username: 'fixture-upd-user', password: 'fixture-upd-pass' };
  const vault = {
    ...APPS_VAULT,
    selectedIds: [...APPS_VAULT.selectedIds, upd.id, nsZero.id, nsOne.id],
    customServices: [upd],
    accessProfiles: [...APPS_VAULT.accessProfiles, prof('p-upd', upd.id, HE.first, true), prof('p-ns', nsOne.id, HE.first, true)],
    credentials: { ...APPS_VAULT.credentials, 'p-upd': storedUpd },
  };
  const s = await openPage(url, { vault, catalogExtra: [APPROVED_OTHER_FIELD, nsZero, nsOne] });
  for (const id of ['svc-cred', 'svc-zero', 'svc-one', upd.id, nsZero.id, nsOne.id]) {
    assert((await s.page.locator(`[data-service-tile][data-service-id="${id}"]`).count()) === 1, `fixture: tile ${id} in the home`);
  }
  assert((await dot(s, 'svc-cred').count()) === 1, 'O-123-25 (a): profile with complete credentials → dot');
  assert((await dot(s, upd.id).count()) === 0, 'O-123-25 (b): approved own site whose login fields changed (values under the old field ids) → no dot');
  assert((await dot(s, 'svc-zero').count()) === 0, 'O-123-25 (c): no profile → no dot');
  assert((await dot(s, 'svc-one').count()) === 0, 'O-123-25: profile without credentials → no dot (not orange)');
  assert((await dot(s, nsOne.id).count()) === 1, 'O-123-25: no-stored-credentials app with a profile → dot (counts as complete)');
  assert((await dot(s, nsZero.id).count()) === 0, 'O-123-25: no-stored-credentials app without a profile → no dot (the profile term stays)');
  // The D-123-8 notice and the stored values are unchanged.
  await openTile(s, upd.id);
  assert((await panel(s).locator('[data-notice="login-fields-updated"]').count()) === 1, 'O-123-25: the fields-updated notice is unchanged');
  const kept = ((await stored(s)) ?? vault).credentials?.['p-upd'] ?? {};
  assert(kept.username === storedUpd.username && kept.password === storedUpd.password, 'O-123-25: stored values untouched (D-123-8 ruling 2)');
  await closePage(s);
  return 'browser O-123-25: dot only when ready — complete credentials → dot; approved own site with changed fields (old ids stored) → none; no profile → none; profile without credentials → none; no-stored with profile → dot, without → none; notice / stored values unchanged';
}

const O26_COMPLETE = 'השלמת פרטי כניסה';
const O26_EDIT = 'עריכת פרופיל';
const O26_MESSAGE = 'פרטי הכניסה בפרופיל הזה חסרים. לחצו «השלמת פרטי כניסה» בחלון האתר והשלימו אותם.';
async function checkCompleteCredentialsLabel(url) {
  const nsOne = noStored('svc-ns-one', 'ללא פרטים עם פרופיל', 'ns-one.example.test');
  const vault = {
    ...APPS_VAULT,
    selectedIds: [...APPS_VAULT.selectedIds, nsOne.id],
    accessProfiles: [...APPS_VAULT.accessProfiles, prof('p-ns', nsOne.id, HE.first, true)],
    credentials: {
      'p-cred': { username: 'fixture-user', password: '' },
      'p-two-b': { username: 'fixture-two-user', password: 'fixture-two-pass' },
    },
  };
  const s = await openPage(url, { vault, catalogExtra: [nsOne] });
  const editBtn = () => panel(s).locator('[data-action="edit-profile"]');
  const label = async (tag) => {
    assert((await editBtn().count()) === 1, `O-123-26 (${tag}): exactly one edit button in the window bar`);
    const text = (await editBtn().textContent()).trim();
    const named = await panel(s).getByRole('button', { name: text, exact: true }).count();
    assert(named >= 1 && (await editBtn().getAttribute('aria-label')) === null, `O-123-26 (${tag}): the accessible name is the visible text`);
    return text;
  };
  const selectedInModal = async () => {
    await modal(s).waitFor({ state: 'visible', timeout: 5000 });
    return modal(s).locator('.cd-chip[aria-selected="true"]').allTextContents();
  };

  // (a) shown profile incomplete → «השלמת פרטי כניסה», same action / same profile / same focus return.
  await openTile(s, 'svc-two');
  assert((await label('a, default without credentials')) === O26_COMPLETE, `O-123-26 (a): incomplete shown profile → «${O26_COMPLETE}»`);
  await editBtn().click();
  const selA = await selectedInModal();
  assert(selA.length === 1 && selA[0].startsWith('אלף'), `O-123-26 (a): «${O26_COMPLETE}» opens the modal on the shown profile (got ${selA.join('|')})`);
  await s.page.keyboard.press('Escape');
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await expectWindowBack(s, 'svc-two', 'edit-profile', 'O-123-26 complete credentials, cancel');
  // (b) switching to the complete profile → «עריכת פרופיל», opening that profile.
  await panel(s).locator('.la-profile-chip', { hasText: 'בית' }).click();
  assert((await label('b, switched to the complete profile')) === O26_EDIT, `O-123-26 (b): complete shown profile → «${O26_EDIT}»`);
  await editBtn().click();
  const selB = await selectedInModal();
  assert(selB.length === 1 && selB[0].startsWith('בית'), `O-123-26 (b): «${O26_EDIT}» opens the modal on the shown profile (got ${selB.join('|')})`);
  await s.page.keyboard.press('Escape');
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await expectWindowBack(s, 'svc-two', 'edit-profile', 'O-123-26 edit profile, cancel');
  await panel(s).locator('.la-profile-chip', { hasText: 'אלף' }).click();
  assert((await label('a, switched back')) === O26_COMPLETE, 'O-123-26 (a): switching back to the incomplete profile restores the label');
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });

  await openTile(s, 'svc-one');
  assert((await label('a, single profile without credentials')) === O26_COMPLETE, `O-123-26 (a): single profile without credentials → «${O26_COMPLETE}»`);
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  await openTile(s, nsOne.id);
  assert((await editBtn().count()) === 0 && !(await panel(s).textContent()).includes(O26_COMPLETE), 'O-123-26: a no-stored-credentials site has no profile bar (unchanged) and never shows «השלמת פרטי כניסה»');
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });

  // (c) partially filled profile → «השלמת פרטי כניסה»; the credentials_missing copy names that button.
  await openTile(s, 'svc-cred');
  assert((await label('a, password missing')) === O26_COMPLETE, `O-123-26 (a): a missing required field → «${O26_COMPLETE}»`);
  await s.page.evaluate(() => { globalThis.__pvCtl.auto = 'credentials_missing'; });
  await panel(s).locator('.la-secondary-btn--auto').click();
  const alert = panel(s).locator('.la-panel-status[role="alert"]');
  await alert.waitFor({ timeout: 5000 });
  assert((await alert.textContent()) === O26_MESSAGE, `O-123-26 (c): credentials_missing copy is «${O26_MESSAGE}» (got «${await alert.textContent()}»)`);
  assert((await alert.textContent()).includes(`«${await label('c, beside the message')}»`), 'O-123-26 (c): the message names the button the window shows');
  await s.page.evaluate(() => { globalThis.__pvCtl.auto = null; });
  await closePage(s);
  return 'browser O-123-26: shown profile incomplete (default without credentials, single profile without credentials, a missing required field) → «השלמת פרטי כניסה»; complete (switched profile) → «עריכת פרופיל»; no-stored-credentials site never shows «השלמת פרטי כניסה»; accessible name = visible text; same modal on the shown profile; focus back on the button; credentials_missing copy names «השלמת פרטי כניסה» «בחלון האתר»';
}

const addForm = (s) => catalog(s).locator('.modal-dialog', { hasText: 'הוספת אתר חדש' });
const offerOf = (s) => catalog(s).locator('.sm-catalog-offer');
const formInputs = (s) => addForm(s).locator('input[type="text"]');
async function submitCustomSite(s, name, host, { open = true } = {}) {
  if (open) {
    await catalog(s).locator('[data-action="add-custom-site"]').click();
    await addForm(s).waitFor({ state: 'visible', timeout: 5000 });
    await formInputs(s).nth(0).fill(name);
    await formInputs(s).nth(1).fill(`https://${host}/`);
    await addForm(s).locator('select[data-field="category"]').selectOption({ index: 1 });
  }
  await addForm(s).locator('button[type="submit"]').click();
  await offerOf(s).waitFor({ state: 'visible', timeout: 5000 });
}
async function assertFormBehind(s, name, host, tag) {
  assert(await addForm(s).isVisible(), `${tag}: the custom-site form is not closed when the offer appears`);
  assert((await formInputs(s).nth(0).inputValue()) === name && (await formInputs(s).nth(1).inputValue()) === `https://${host}/`, `${tag}: the form keeps the typed values behind the offer`);
  const layer = await addForm(s).evaluate((dialog) => {
    const overlay = dialog.closest('.modal-overlay');
    const input = dialog.querySelector('input[type="text"]');
    input.focus();
    const style = getComputedStyle(dialog);
    const alpha = (color) => { const m = color.match(/rgba?\(([^)]+)\)/); const parts = m ? m[1].split(/[\s,/]+/).filter(Boolean) : []; return parts.length === 4 ? Number(parts[3]) : 1; };
    return { inert: overlay.inert, focused: document.activeElement === input, opacity: Number(style.opacity), filter: style.filter, overlayBg: getComputedStyle(overlay).backgroundColor, overlayAlpha: alpha(getComputedStyle(overlay).backgroundColor) };
  });
  assert(layer.inert && !layer.focused, `${tag}: the form is inert (not focusable) while the offer is open`);
  // O-123-27 (G-3, supersedes the O-123-13 "opacity < 1" dimming): darker, fully opaque.
  assert(layer.opacity === 1, `O-123-27 (${tag}): the covered form is fully opaque (opacity ${layer.opacity}); nothing behind it shows through`);
  assert(layer.filter.includes('brightness('), `O-123-27 (${tag}): the covered form is darkened with brightness() (filter ${layer.filter})`);
  assert(layer.overlayAlpha === 0, `O-123-27 (${tag}): the covered overlay keeps a transparent background, no doubled scrim (${layer.overlayBg})`);
  await s.page.keyboard.press('Tab');
  assert(await offerOf(s).evaluate((el) => el.contains(document.activeElement)), `${tag}: Tab stays inside the offer`);
}
async function assertOfferClosedFormKept(s, name, host, tag) {
  await waitFor(s, () => !document.querySelector('.sm-catalog-offer') || !document.querySelector('[data-catalog-modal] .modal-dialog form'), null, `${tag}: nothing closed`);
  assert((await addForm(s).count()) === 1, `${tag}: only the offer closes — the form stays`);
  await offerOf(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await formInputs(s).nth(0).inputValue()) === name && (await formInputs(s).nth(1).inputValue()) === `https://${host}/`, `${tag}: the typed values are kept`);
  await waitFor(s, () => document.activeElement === document.querySelector('[data-catalog-modal] .modal-overlay input[type="text"]'), null, `${tag}: focus returns to the filled form`);
}
async function cancelAddForm(s) {
  await addForm(s).locator('button', { hasText: 'ביטול' }).click();
  await addForm(s).waitFor({ state: 'detached', timeout: 5000 });
}
async function checkCatalogOfferLayered(url) {
  const s = await openPage(url, { vault: { ...APPS_VAULT, selectedIds: [...APPS_VAULT.selectedIds, OWN_SITE.id], customServices: [OWN_SITE] } });
  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
  const typedName = 'החנות שלי';
  const host = 'avail.example.test';

  // O-123-13: catalog_service_available.
  await submitCustomSite(s, typedName, host);
  const offerText = await offerOf(s).textContent();
  assert((await offerOf(s).locator('h2').textContent()) === 'מצאנו את חנות זמינה בחנות האתרים', 'O-123-13: title «מצאנו את <catalog name> בחנות האתרים»');
  assert(offerText.includes('חנות זמינה כבר נתמך, ולכן אין צורך להוסיף אותו כאתר מותאם אישית.'), 'O-123-13: the «כבר נתמך» text with the catalog name');
  assert(!offerText.includes(typedName), 'O-123-13: the offer never shows the typed name');
  const labels = await offerOf(s).locator('.modal-actions button').allTextContents();
  assert(JSON.stringify(labels) === JSON.stringify(['הוספה לבית הדיגיטלי', 'חזרה לחנות האתרים']), `O-123-13: the two offer buttons (got ${JSON.stringify(labels)})`);
  await assertFormBehind(s, typedName, host, 'O-123-13');
  // O-123-34 (G-3): the × is gone and Escape is «חזרה לחנות האתרים» here — checked in checkCatalogOfferNoClose.
  await offerOf(s).locator('button', { hasText: 'חזרה לחנות האתרים' }).click();
  await offerOf(s).waitFor({ state: 'detached', timeout: 5000 });
  await addForm(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await catalog(s).count()) === 1 && (await catalog(s).locator('[data-catalog-item="svc-avail"]').getAttribute('data-catalog-state')) !== 'added', 'O-123-13: «חזרה לחנות האתרים» closes both and adds nothing');
  await submitCustomSite(s, typedName, host);
  await offerOf(s).locator('button', { hasText: 'הוספה לבית הדיגיטלי' }).click();
  await waitFor(s, () => document.querySelector('[data-catalog-item="svc-avail"]')?.getAttribute('data-catalog-state') === 'added', null, 'O-123-13: «הוספה לבית הדיגיטלי» adds the catalog site');
  // O-123-35 (G-3): the offer add runs the post-add sequence — offer, form and catalog close
  // (was: the catalog stays); the sequence itself is checked in checkCatalogPickerSequence.
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  assert(!((await stored(s)).customServices ?? []).some((d) => d.displayName === typedName), 'O-123-13: no custom site was created');
  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });

  // O-123-14: already_in_user_home and same_user_custom_duplicate.
  for (const [name, h, title] of [
    ['הפרופיל שלי', 'one.example.test', 'פרופיל יחיד כבר נמצא בבית הדיגיטלי שלך.'],
    ['שוב האתר שלי', 'own.example.test', 'אתר שלי כבר נמצא בבית הדיגיטלי שלך.'],
  ]) {
    await submitCustomSite(s, name, h);
    assert((await offerOf(s).locator('h2').textContent()) === title, `O-123-14 (${h}): the existing copy is kept`);
    await assertFormBehind(s, name, h, `O-123-14 (${h})`);
    await offerOf(s).locator('button', { hasText: 'סגור' }).click();
    await assertOfferClosedFormKept(s, name, h, `O-123-14 (${h}) «סגור»`);
    await submitCustomSite(s, name, h, { open: false });
    await s.page.keyboard.press('Escape');
    await assertOfferClosedFormKept(s, name, h, `O-123-14 (${h}) Escape`);
    await cancelAddForm(s);
  }
  await closePage(s);
  return 'browser O-123-13/14: the custom-site form stays open (typed values, darkened, inert, Tab stays in the offer) under every catalog offer; catalog-available copy uses the catalog name with «הוספה לבית הדיגיטלי» (adds, closes both) / «חזרה לחנות האתרים» (closes both); already-in-home: «סגור» / Escape close only the offer and return focus to the filled form';
}

/** O-123-39: fill and submit the custom-site form from a freshly opened catalog. */
async function submitNewCustomSite(s, name, host) {
  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
  await catalog(s).locator('[data-action="add-custom-site"]').click();
  await addForm(s).waitFor({ state: 'visible', timeout: 5000 });
  await formInputs(s).nth(0).fill(name);
  await formInputs(s).nth(1).fill(`https://${host}/`);
  await addForm(s).locator('select[data-field="category"]').selectOption({ index: 1 });
  await watchPickerAdd(s);
  await s.page.evaluate(() => {
    const seen = (globalThis.__o39 = { inCatalog: false });
    new MutationObserver(() => {
      const modal = document.querySelector('[data-catalog-modal]');
      if (modal && (modal.querySelector('[data-catalog-notice], [data-just-added], .app-catalog-just-added-chip') || modal.textContent.includes('האתר נוסף לבית הדיגיטלי'))) seen.inCatalog = true;
    }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  await addForm(s).locator('button[type="submit"]').click();
}
async function landCustomSite(s, name, host, tag, reduced) {
  await submitNewCustomSite(s, name, host);
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  assert((await catalog(s).count()) === 0 && (await addForm(s).count()) === 0, `${tag}: the add form and the catalog both close after the add`);
  const custom = (await stored(s)).customServices.find((d) => d.displayName === name);
  assert(custom, 'fixture: the custom site was created');
  const t = await pickerTimeline(s, [custom.id], null, tag);
  assertLanding(t, { tag, reduced, first: custom.id });
  if (!reduced) assert(t.closing?.form && t.closing.mid?.form, `${tag}: O-123-44 the add form fades out together with the catalog (still inside it half-way through)`);
  assert(!(await s.page.evaluate(() => globalThis.__o39.inCatalog)), `${tag}: no in-catalog status line / card highlight / «נוסף עכשיו» chip (O-123-28 parts removed)`);
  const tile = s.page.locator(`[data-service-tile][data-service-id="${custom.id}"]`);
  assert((await tile.count()) === 1, `${tag}: exactly one home tile for the new site`);
  const inView = await tile.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
  assert(inView, `${tag}: the new tile is scrolled into view`);
  assert((await focusedTile(s)) === custom.id, `${tag}: focus stays on the new tile (got ${await focusedTile(s)})`);
}
async function checkCustomAddSequence(url) {
  const s = await openPage(url);
  // O-123-39 (G-3): supersedes the O-123-28 in-catalog sequence (form fade, catalog stays, filters
  // reset, card highlight + «נוסף עכשיו», «✓ האתר נוסף לבית הדיגיטלי» status line).
  await landCustomSite(s, 'אתר חדש לגמרי', 'brand-new.example.test', 'O-123-39', false);

  // A failure keeps the form open with its error, inside the open catalog.
  await s.page.evaluate(() => { globalThis.__pvCtl.persistFail = true; });
  const before = (await stored(s)).selectedIds;
  await submitNewCustomSite(s, 'אתר שנכשל', 'fails.example.test');
  const error = addForm(s).locator('.modal-field-error[role="alert"]');
  await error.waitFor({ timeout: 5000 }).catch(() => {});
  assert((await error.count()) === 1 && /[\u0590-\u05FF]/.test(await error.textContent()), 'O-123-39: a failed add keeps the form open with its Hebrew error');
  await s.page.waitForTimeout(600);
  assert((await catalog(s).count()) === 1 && (await addForm(s).isVisible()), 'O-123-39: the form and the catalog stay open after a failure');
  assert((await formInputs(s).nth(0).inputValue()) === 'אתר שנכשל', 'O-123-39: the typed values stay after a failure');
  assert(JSON.stringify((await stored(s)).selectedIds) === JSON.stringify(before) && (await s.page.locator('[data-service-tile][data-just-added="true"]').count()) === 0, 'O-123-39: nothing added, no home highlight after a failure');
  await s.page.evaluate(() => { globalThis.__pvCtl.persistFail = false; });
  await addForm(s).locator('button', { hasText: 'ביטול' }).click();
  await addForm(s).waitFor({ state: 'detached', timeout: 5000 });
  await s.page.keyboard.press('Escape');
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });

  // prefers-reduced-motion: the same landing, static.
  await s.page.emulateMedia({ reducedMotion: 'reduce' });
  await landCustomSite(s, 'אתר שקט', 'quiet.example.test', 'O-123-39 (reduced motion)', true);
  await closePage(s);
  return 'browser O-123-39 / 43 / 44: custom add → the form and the catalog fade out together (500 ms, opacity + scale 0.98, inert) and the home shows the new tile through the O-123-35 landing (green frame breathing then fading, 5 s O-123-41, scrolled into view, focused); no in-catalog status line / card highlight / chip; failure → form stays open with its Hebrew error and typed values, nothing added; reduced motion: immediate close, static frame for 5 s';
}

async function checkCatalogOfferNoClose(url) {
  const s = await openPage(url);
  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
  const typedName = 'החנות שלי';
  const host = 'avail.example.test';
  await submitCustomSite(s, typedName, host);
  const buttons = await offerOf(s).locator('button').evaluateAll((els) => els.map((b) => ({ text: b.textContent.trim(), label: b.getAttribute('aria-label') })));
  assert(!buttons.some((b) => b.text === '×' || b.label === 'סגירה'), `O-123-34: the catalog offer has no × button (got ${JSON.stringify(buttons)})`);
  assert(JSON.stringify(buttons.map((b) => b.text)) === JSON.stringify(['הוספה לבית הדיגיטלי', 'חזרה לחנות האתרים']), `O-123-34: only the two action buttons remain (got ${JSON.stringify(buttons.map((b) => b.text))})`);
  await s.page.keyboard.press('Escape');
  await offerOf(s).waitFor({ state: 'detached', timeout: 5000 });
  await addForm(s).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  assert((await addForm(s).count()) === 0, 'O-123-34: Escape = «חזרה לחנות האתרים» — the form closes with the offer');
  assert((await catalog(s).count()) === 1, 'O-123-34: Escape keeps the catalog open');
  assert((await catalog(s).locator('[data-catalog-item="svc-avail"]').getAttribute('data-catalog-state')) !== 'added', 'O-123-34: Escape adds nothing');
  assert(!((await stored(s)) ?? { customServices: [] }).customServices?.some((d) => d.displayName === typedName), 'O-123-34: Escape creates no custom site');
  await closePage(s);
  return 'browser O-123-34: catalog-available offer without ×; only «הוספה לבית הדיגיטלי» / «חזרה לחנות האתרים»; Escape closes offer and form like «חזרה לחנות האתרים», adds nothing, catalog stays';
}

// ─── O-123-35: catalog picker ─────────────────────────────────────────────────
const O35 = {
  title: 'הוספת אתר לבית הדיגיטלי',
  all: 'הכול',
  inHome: '✓ כבר נוסף',
  addOne: 'הוספת האתר',
  addN: (n) => `הוספת ${n} אתרים`,
  addedOne: '✓ נוסף לבית',
  addedN: (n) => `✓ נוספו ${n} אתרים`,
  persistFailed: 'לא ניתן לשמור את השינוי כרגע. בדקו חיבור לרשת ונסו שוב.',
};
const pickCard = (s, id) => catalog(s).locator(`[data-catalog-item="${id}"]`);
const pickCta = (s) => catalog(s).locator('[data-action="catalog-add-selected"]');
async function openCatalogFromHeader(s) {
  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
}
/** Cards in the first grid row of the catalog. */
const firstRowCount = (s) => catalog(s).evaluate((root) => {
  const tops = [...root.querySelectorAll('[data-catalog-item]')].map((el) => Math.round(el.getBoundingClientRect().top));
  return tops.filter((t) => t === Math.min(...tops)).length;
});

async function checkCatalogPicker(url) {
  const s = await openPage(url);
  await openCatalogFromHeader(s);
  assert((await catalog(s).locator('#dh-catalog-title').textContent()) === O35.title, 'O-123-35: catalog title «הוספת אתר לבית הדיגיטלי»');
  const search = await catalog(s).locator('input[type="search"]').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, dw: el.closest('[data-catalog-modal]').getBoundingClientRect().width };
  });
  assert(search.w <= search.dw * 0.5 && search.h <= 44, `O-123-35: compact search field (${Math.round(search.w)}×${Math.round(search.h)} px in a ${Math.round(search.dw)} px catalog)`);
  const chips = await catalog(s).locator('.sm-chip').evaluateAll((els) => els.map((e) => ({ text: e.textContent, pressed: e.getAttribute('aria-pressed') })));
  assert(chips[0]?.text === O35.all && chips[0].pressed === 'true', `O-123-35: first chip «הכול», pressed (got ${JSON.stringify(chips[0])})`);
  assert(chips.some((c) => c.text === 'בנקים') && chips.some((c) => c.text === 'קניות'), 'O-123-35: one chip per user-facing category');
  assert((await catalog(s).locator('.sm-chips-label').count()) === 0 && (await catalog(s).locator('select').count()) === 0, 'O-123-35: the chip row is the only category control');
  const custom = catalog(s).locator('[data-action="add-custom-site"]');
  assert((await custom.textContent()) === '+ הוספת אתר מותאם אישית' && !/sm-action--primary/.test((await custom.getAttribute('class')) ?? ''), 'O-123-35: «+ הוספת אתר מותאם אישית» stays, as a secondary action');

  const perRow = await firstRowCount(s);
  assert(perRow >= 5 && perRow <= 7, `O-123-35: dense grid — 5–7 cards per row on desktop (got ${perRow})`);
  await s.page.setViewportSize({ width: 600, height: 900 });
  const narrow = await firstRowCount(s);
  assert(narrow >= 2 && narrow < perRow, `O-123-35: the grid is responsive (600 px: ${narrow} per row)`);
  await s.page.setViewportSize({ width: 1280, height: 900 });

  const cards = await catalog(s).locator('[data-catalog-item]').evaluateAll((els) => els.map((el) => {
    const icon = el.querySelector('.sm-pick-icon')?.getBoundingClientRect();
    return {
      id: el.getAttribute('data-catalog-item'),
      state: el.getAttribute('data-catalog-state'),
      tag: el.tagName,
      pressed: el.getAttribute('aria-pressed'),
      disabled: el.getAttribute('aria-disabled'),
      iconW: icon?.width ?? 0,
      iconH: icon?.height ?? 0,
      inner: el.querySelectorAll('button, input').length,
      name: el.querySelector('.sm-pick-name')?.textContent ?? '',
      // The icon (logo or letter fallback) is aria-hidden; the card text is everything else.
      text: [...el.childNodes].filter((n) => !(n instanceof Element && n.classList.contains('sm-pick-icon'))).map((n) => n.textContent).join(''),
      iconHidden: el.querySelector('.sm-pick-icon')?.getAttribute('aria-hidden') === 'true',
      opacity: Number(getComputedStyle(el).opacity),
    };
  }));
  assert(cards.length >= 9, `fixture: catalog cards (${cards.length})`);
  for (const c of cards) {
    assert(c.tag === 'BUTTON' && c.pressed !== null && c.inner === 0, `O-123-35: ${c.id} is one <button aria-pressed> with nothing inside to click`);
    assert(c.iconW >= 36 && c.iconW <= 44 && c.iconH >= 36 && c.iconH <= 44 && c.iconHidden, `O-123-35: ${c.id} decorative icon 36–44 px (got ${c.iconW}×${c.iconH})`);
    const expected = c.state === 'added' ? `${c.name}${O35.inHome}` : c.name;
    assert(c.text === expected, `O-123-35: ${c.id} shows only icon + name${c.state === 'added' ? ' + «✓ כבר נוסף»' : ''} (got «${c.text}»)`);
  }
  assert((await catalog(s).locator('input[type="checkbox"]').count()) === 0, 'O-123-35: no permanent checkboxes');
  const home = cards.find((c) => c.id === 'svc-cred');
  assert(home.state === 'added' && home.disabled === 'true' && home.pressed === 'false', 'O-123-35: an in-home site is aria-disabled');
  // O-123-40 (G-3): was a whole-card opacity < 1, label included.
  const look = await pickCard(s, 'svc-cred').evaluate((card) => {
    const label = card.querySelector('.sm-pick-in-home');
    const rgb = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]) => {
      const ch = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const opacities = [];
    for (let el = label; el; el = el.parentElement) {
      opacities.push(Number(getComputedStyle(el).opacity));
      if (el === card) break;
    }
    const fg = rgb(getComputedStyle(label).color);
    const bgRaw = rgb(getComputedStyle(card).backgroundColor);
    const bg = bgRaw.length === 4 && bgRaw[3] === 0 ? [255, 255, 255] : bgRaw.slice(0, 3);
    const [hi, lo] = [lum(fg.slice(0, 3)), lum(bg)].sort((a, b) => b - a);
    const plain = card.parentElement.querySelector('[data-catalog-state="available"]');
    return {
      weight: Number(getComputedStyle(label).fontWeight),
      fg,
      minOpacity: Math.min(...opacities),
      contrast: (hi + 0.05) / (lo + 0.05),
      iconOpacity: Number(getComputedStyle(card.querySelector('.sm-pick-icon')).opacity),
      nameOpacity: Number(getComputedStyle(card.querySelector('.sm-pick-name')).opacity),
      bg: getComputedStyle(card).backgroundColor,
      plainBg: plain ? getComputedStyle(plain).backgroundColor : null,
    };
  });
  assert(look.weight >= 600 && look.weight <= 700, `O-123-40: «✓ כבר נוסף» is bold 600–700 (got ${look.weight})`);
  assert(look.fg[1] > look.fg[0] && look.fg[1] > look.fg[2] && look.fg[1] < 140, `O-123-40: «✓ כבר נוסף» is a dark success (green) colour (rgb ${look.fg.join(',')})`);
  assert(look.minOpacity === 1, `O-123-40: no opacity on the label or any wrapper up to the card (min ${look.minOpacity})`);
  assert(look.contrast >= 4.5, `O-123-40: label contrast ≥ 4.5:1 on the card background (got ${look.contrast.toFixed(2)}:1)`);
  assert(look.iconOpacity < 1 && look.nameOpacity < 1, `O-123-40: the icon and name are dimmed (icon ${look.iconOpacity}, name ${look.nameOpacity})`);
  assert(look.plainBg && look.bg !== look.plainBg, `O-123-40: the in-home card background is dimmed (${look.bg} vs ${look.plainBg})`);
  assert(!(await catalog(s).textContent()).includes('כבר בבית הדיגיטלי'), 'O-123-35: the green «כבר בבית הדיגיטלי» block is gone');
  await pickCard(s, 'svc-cred').click({ force: true });
  assert((await pickCard(s, 'svc-cred').getAttribute('aria-pressed')) === 'false' && (await pickCta(s).count()) === 0, 'O-123-35: an in-home site cannot be selected');
  assert((await pickCta(s).count()) === 0, 'O-123-35: no CTA while nothing is selected');

  const border = (id) => pickCard(s, id).evaluate((el) => getComputedStyle(el).borderTopColor);
  const plain = await border('svc-a3');
  await pickCard(s, 'svc-avail').click();
  assert((await pickCard(s, 'svc-avail').getAttribute('aria-pressed')) === 'true', 'O-123-35: a click selects the card (aria-pressed)');
  // The border colour transitions (120 ms), so it is polled rather than read once.
  await waitFor(s, (from) => getComputedStyle(document.querySelector('[data-catalog-item="svc-avail"]')).borderTopColor !== from, plain, `O-123-35: selected card has a selection border (stays ${plain})`);
  assert((await pickCard(s, 'svc-avail').locator('.sm-pick-check').textContent()) === '✓', 'O-123-35: selected card has a small ✓');
  assert((await pickCta(s).textContent()) === O35.addOne, `O-123-35: CTA «הוספת האתר» with one selected (got «${await pickCta(s).textContent()}»)`);
  const bar = await pickCta(s).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const d = el.closest('[data-catalog-modal]').getBoundingClientRect();
    return { inside: r.bottom <= d.bottom + 1 && r.top >= d.top, sticky: getComputedStyle(el.closest('.sm-pick-cta-bar')).position };
  });
  assert(bar.inside && bar.sticky === 'sticky', `O-123-35: the CTA stays visible at the catalog bottom (${JSON.stringify(bar)})`);
  await pickCard(s, 'svc-a3').click();
  assert((await pickCta(s).textContent()) === O35.addN(2), 'O-123-35: multi-select → «הוספת 2 אתרים»');
  await pickCard(s, 'svc-a3').click();
  assert((await pickCard(s, 'svc-a3').getAttribute('aria-pressed')) === 'false' && (await pickCta(s).textContent()) === O35.addOne, 'O-123-35: a second click deselects');
  await pickCard(s, 'svc-a4').focus();
  await s.page.keyboard.press('Space');
  assert((await pickCard(s, 'svc-a4').getAttribute('aria-pressed')) === 'true', 'O-123-35: Space toggles a focused card');
  await s.page.keyboard.press('Space');
  await pickCard(s, 'svc-avail').click();
  assert((await pickCta(s).count()) === 0, 'O-123-35: the CTA disappears when the selection is empty');

  // Failure: nothing added, selection kept, red role="alert" with the existing copy.
  await pickCard(s, 'svc-avail').click();
  await pickCard(s, 'svc-a3').click();
  const before = (await stored(s))?.selectedIds ?? APPS_VAULT.selectedIds;
  await s.page.evaluate(() => { globalThis.__pvCtl.persistFail = true; });
  await pickCta(s).click();
  const alert = catalog(s).locator('[role="alert"]');
  await waitFor(s, () => Boolean(document.querySelector('[data-catalog-modal] [role="alert"]')), null, 'O-123-35: a failed add shows a role="alert" line');
  assert((await alert.textContent()) === O35.persistFailed, `O-123-35: failure → the existing copy (got «${await alert.textContent()}»)`);
  const red = await alert.evaluate((el) => getComputedStyle(el).color.match(/\d+/g).map(Number));
  assert(red[0] > 150 && red[1] < 80 && red[2] < 80, `O-123-35: the failure line is red (rgb ${red.join(',')})`);
  assert(JSON.stringify((await stored(s))?.selectedIds ?? APPS_VAULT.selectedIds) === JSON.stringify(before), 'O-123-35: all-or-nothing — nothing was added');
  assert((await pickCard(s, 'svc-avail').getAttribute('aria-pressed')) === 'true' && (await pickCard(s, 'svc-a3').getAttribute('aria-pressed')) === 'true' && (await pickCta(s).textContent()) === O35.addN(2), 'O-123-35: the selection is kept after a failure');
  assert((await catalog(s).count()) === 1 && (await s.page.locator('[data-service-id="svc-avail"]').count()) === 0, 'O-123-35: the catalog stays and no tile appears');

  // Retry: one vault update + one persistVault for both sites.
  await s.page.evaluate(() => { globalThis.__pvCtl.persistFail = false; });
  const persistsBefore = await persists(s);
  await pickCta(s).click();
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  const writes = await s.page.evaluate(() => window.__pvSeq.filter((e) => e.kind === 'persist'));
  assert(writes.length - persistsBefore === 1, `O-123-35: two sites → exactly one persistVault (got ${writes.length - persistsBefore})`);
  const last = writes.at(-1).selectedIds;
  assert(last.includes('svc-avail') && last.includes('svc-a3') && JSON.stringify((await stored(s)).selectedIds) === JSON.stringify(last), 'O-123-35: both sites in the one vault update');
  for (const id of ['svc-avail', 'svc-a3']) assert((await s.page.locator(`[data-service-id="${id}"]`).count()) === 1, `O-123-35: ${id} tile in the home`);
  await closePage(s);
  return 'browser O-123-35: title «הוספת אתר לבית הדיגיטלי»; compact search; chips «הכול» + categories (only control); custom-site action secondary; 5–7 cards per row, responsive; card = <button aria-pressed> with 36–44 px icon + name only; click / Space toggles, border + ✓, no checkboxes; in-home aria-disabled, icon / name / background dimmed, O-123-40 «✓ כבר נוסף» bold dark green ≥ 4.5:1 with no opacity on it or a wrapper, not selectable, old block gone; CTA only with ≥ 1 («הוספת האתר» / «הוספת 2 אתרים»), sticky; failure → nothing added, selection kept, red role="alert" existing copy; retry → one persistVault for both';
}

/** O-123-35: timestamps of the post-add states (CTA label, catalog fade / gone, tile highlight, focus). */
async function watchPickerAdd(s) {
  await s.page.evaluate(() => {
    globalThis.__o35 = globalThis.__o35 ?? [];
    globalThis.__o35.length = 0;
    if (globalThis.__o35Installed) return;
    globalThis.__o35Installed = true;
    const snap = () => {
      const overlay = document.querySelector('.dh-catalog-overlay');
      const cta = document.querySelector('[data-action="catalog-add-selected"]');
      const offerAdd = document.querySelector('[data-action="catalog-offer-add"]');
      const tiles = [...document.querySelectorAll('[data-service-tile][data-just-added="true"]')];
      const active = document.activeElement;
      return {
        catalog: Boolean(overlay),
        closing: overlay?.getAttribute('data-closing') === 'true',
        anim: overlay ? getComputedStyle(overlay).animationName : null,
        dur: overlay ? getComputedStyle(overlay).animationDuration : null,
        timing: overlay ? getComputedStyle(overlay).animationTimingFunction : null,
        inert: overlay ? overlay.inert : null,
        form: Boolean(overlay?.querySelector('.modal-overlay .modal-dialog')),
        label: offerAdd?.textContent ?? cta?.textContent ?? null,
        tiles: tiles.map((t) => t.getAttribute('data-service-id')).sort().join(','),
        tileAnim: tiles[0] ? getComputedStyle(tiles[0]).animationName : null,
        tileDur: tiles[0] ? getComputedStyle(tiles[0]).animationDuration : null,
        tileTiming: tiles[0] ? getComputedStyle(tiles[0]).animationTimingFunction : null,
        tileShadow: tiles[0] ? getComputedStyle(tiles[0]).boxShadow : null,
        focus: active?.matches('button.app-icon') ? active.closest('[data-service-tile]')?.getAttribute('data-service-id') ?? null : null,
      };
    };
    const push = () => {
      const log = globalThis.__o35;
      const s = snap();
      const last = log[log.length - 1];
      if (last && ['catalog', 'closing', 'label', 'tiles', 'focus'].every((k) => last[k] === s[k])) return;
      const entry = { ...s, t: performance.now() };
      log.push(entry);
      // O-123-44: the overlay (and the form inside it) half-way through the 500 ms exit.
      if (s.closing && !last?.closing) {
        setTimeout(() => {
          const overlay = document.querySelector('.dh-catalog-overlay');
          const style = overlay ? getComputedStyle(overlay) : null;
          const m = style ? /^matrix\(([-\d.e]+),/.exec(style.transform) : null;
          entry.mid = overlay ? { opacity: Number(style.opacity), scale: m ? Number(m[1]) : 1, form: Boolean(overlay.querySelector('.modal-overlay .modal-dialog')) } : null;
        }, 250);
      }
      if (s.tiles && (!last || last.tiles !== s.tiles)) {
        setTimeout(() => {
          const tile = document.querySelector('[data-service-tile][data-just-added="true"]');
          entry.midShadow = tile ? getComputedStyle(tile).boxShadow : null;
        }, 500);
        // O-123-43: the frame's ring alpha (and colours) every ~100 ms until the highlight ends.
        entry.samples = [];
        const start = performance.now();
        const timer = setInterval(() => {
          const tile = document.querySelector('[data-service-tile][data-just-added="true"]');
          if (!tile) { clearInterval(timer); return; }
          const shadow = getComputedStyle(tile).boxShadow;
          const colours = [...shadow.matchAll(/rgba?\(([^)]*)\)/g)].map((c) => c[1].split(',').map((x) => Number(x.trim())));
          entry.samples.push({
            dt: performance.now() - start,
            alpha: colours[0] ? (colours[0][3] ?? 1) : 0,
            colours: colours.map(([r, g, b, a]) => [r, g, b, a ?? 1]),
            shadow,
          });
        }, 100);
      }
    };
    document.addEventListener('focusin', push);
    new MutationObserver(push).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}
async function pickerTimeline(s, ids, doneLabel, tag) {
  const want = [...ids].sort().join(',');
  try {
    await waitFor(s, (w) => {
      const log = globalThis.__o35 ?? [];
      const on = log.findIndex((e) => e.tiles === w);
      return on >= 0 && log.slice(on + 1).some((e) => e.tiles === '');
    }, want, 'timeout', 12_000);
  } catch {
    const trace = await s.page.evaluate(() => (globalThis.__o35 ?? []).map((e) => `${e.catalog ? 'K' : '-'}${e.closing ? 'C' : '-'}[${e.label ?? ''}]{${e.tiles}}${e.focus ?? ''}`).join(' '));
    throw new Error(`${tag}: the new tiles are highlighted and the highlight ends (timeline: ${trace})`);
  }
  const log = await s.page.evaluate(() => globalThis.__o35);
  const doneAt = log.findIndex((e) => e.label === doneLabel);
  const closingAt = log.findIndex((e) => e.closing);
  const goneAt = log.findIndex((e, i) => i > closingAt && !e.catalog);
  const onAt = log.findIndex((e) => e.tiles === want);
  const offAt = log.findIndex((e, i) => i > onAt && e.tiles === '');
  const at = (i) => (i >= 0 ? log[i] : null);
  // O-123-44: under reduced motion there is no closing state; the catalog leaves at once.
  const exitAt = closingAt >= 0 ? closingAt : goneAt;
  return {
    done: at(doneAt),
    doneToClosing: doneAt >= 0 && exitAt >= 0 ? log[exitAt].t - log[doneAt].t : null,
    closing: at(closingAt),
    fadeMs: closingAt >= 0 && goneAt >= 0 ? log[goneAt].t - log[closingAt].t : null,
    on: at(onAt),
    onAfterGone: onAt >= 0 && goneAt >= 0 && onAt >= goneAt - 1,
    focus: log.filter((e, i) => i >= onAt && onAt >= 0).map((e) => e.focus).find(Boolean) ?? null,
    highlightMs: onAt >= 0 && offAt >= 0 ? log[offAt].t - log[onAt].t : null,
  };
}
/** The first of `ids` in home order — focus goes there. */
const firstTileOf = (s, ids) => s.page.evaluate((list) => [...document.querySelectorAll('[data-service-tile]')]
  .map((t) => t.getAttribute('data-service-id')).find((id) => list.includes(id)) ?? null, ids);
const focusedTile = (s) => s.page.evaluate(() => (document.activeElement?.matches('button.app-icon') ? document.activeElement.closest('[data-service-tile]')?.getAttribute('data-service-id') : null) ?? null);

function assertSequence(t, { tag, doneLabel, reduced, first }) {
  assert(t.done && t.done.catalog && !t.done.closing, `${tag}: the CTA shows «${doneLabel}» while the catalog is still open`);
  assert(t.doneToClosing !== null && t.doneToClosing >= 400 && t.doneToClosing <= 750, `${tag}: «${doneLabel}» for ~500 ms before the catalog fades (got ${Math.round(t.doneToClosing ?? -1)} ms)`);
  assertLanding(t, { tag, reduced, first });
}

/** Green hue family: hue 90–160° with visible saturation (#22c55e is ~142°). */
function isGreenHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0 || (max - min) / max < 0.3) return false;
  const d = max - min;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h >= 90 && h <= 160;
}

/** O-123-35 / O-123-39 / O-123-41 — the shared home landing after a store or custom add. */
function assertLanding(t, { tag, reduced, first }) {
  // O-123-44 (G-3): was dh-fade-out 0.25 s (200–400 ms), with the same delay and no animation under reduced motion.
  if (reduced) {
    assert(!t.closing && t.fadeMs === null, `${tag}: O-123-44 reduced motion → no fade state, the catalog closes at once (got ${t.closing ? `${t.closing.anim} ${Math.round(t.fadeMs ?? -1)} ms` : 'fade'})`);
  } else {
    assert(t.closing?.anim === 'dh-catalog-exit' && t.closing.dur === '0.5s' && t.closing.timing === 'ease-out', `${tag}: O-123-44 the catalog fades out over 500 ms ease-out (got ${t.closing?.anim} ${t.closing?.dur} ${t.closing?.timing})`);
    assert(t.closing.inert === true, `${tag}: O-123-44 interaction is blocked during the fade (inert)`);
    assert(t.fadeMs !== null && t.fadeMs >= 450 && t.fadeMs <= 750, `${tag}: O-123-44 the catalog is gone after the 500 ms fade (got ${Math.round(t.fadeMs ?? -1)} ms)`);
    const mid = t.closing.mid;
    assert(mid && mid.opacity > 0 && mid.opacity < 0.9 && mid.scale < 1 && mid.scale >= 0.975, `${tag}: O-123-44 half-way: partly transparent and slightly scaled down (got ${JSON.stringify(mid)})`);
  }
  assert(t.on && t.onAfterGone, `${tag}: the home appears with the new tiles highlighted`);
  const samples = t.on.samples ?? [];
  // F-1 ruling: every colour with alpha > 0.05 must be in the green hue family; alpha ≤ 0.05 / transparent
  // (the end of the fade) is valid. Other hues are not accepted.
  const offHue = samples.filter((x) => x.colours.some(([r, g, b, a]) => a > 0.05 && !isGreenHue(r, g, b)));
  assert(samples.length >= 20 && offHue.length === 0, `${tag}: O-123-43 the frame stays one green throughout (${samples.length} samples; failing: ${offHue.slice(0, 5).map((x) => `${Math.round(x.dt)} ms box-shadow «${x.shadow}»`).join(' | ') || 'none'})`);
  if (reduced) {
    assert(t.on.tileAnim === 'none' && t.on.tileShadow?.includes('34, 197, 94'), `${tag}: static highlight, no animation (got ${t.on.tileAnim} / ${t.on.tileShadow})`);
    assert(samples.every((x) => x.alpha >= 0.95), `${tag}: O-123-43 reduced motion → no breathing / fade, static frame (min alpha ${Math.min(...samples.map((x) => x.alpha))})`);
  } else {
    assert(t.on.tileAnim === 'dh-home-just-added' && t.on.tileDur === '5s' && t.on.tileTiming === 'ease-in-out' && t.on.midShadow?.includes('34, 197, 94'), `${tag}: O-123-43 the new tiles breathe for 5 s ease-in-out (got ${t.on.tileAnim} ${t.on.tileDur} ${t.on.tileTiming} / ${t.on.midShadow})`);
    const jumps = samples.slice(1).filter((x, i) => x.dt - samples[i].dt <= 250 && Math.abs(x.alpha - samples[i].alpha) > 0.3);
    assert(jumps.length === 0, `${tag}: O-123-43 no hard on / off (alpha jumps ${jumps.map((x) => Math.round(x.dt)).join(', ')} ms)`);
    let dips = 0;
    let high = true;
    for (const x of samples.filter((x) => x.dt <= 3900)) {
      if (high && x.alpha <= 0.55) { dips += 1; high = false; } else if (!high && x.alpha >= 0.9) high = true;
    }
    const floor = Math.min(...samples.filter((x) => x.dt <= 3700).map((x) => x.alpha));
    assert(dips >= 2 && floor >= 0.3, `${tag}: O-123-43 soft breathing, ≥ 2 cycles between ~100 % and ~40 % (got ${dips} dips, floor ${floor.toFixed(2)})`);
    const tail = samples.filter((x) => x.dt >= 4000);
    const late = samples.filter((x) => x.dt >= 4750);
    assert(samples.some((x) => x.dt >= 3900 && x.dt <= 4400 && x.alpha >= 0.15) && tail.every((x, i) => i === 0 || x.alpha <= tail[i - 1].alpha + 0.03) && late.length > 0 && late.every((x) => x.alpha <= 0.15), `${tag}: O-123-43 the last ~1 s fades the frame out gradually (tail ${tail.map((x) => x.alpha.toFixed(2)).join(' ')})`);
  }
  // O-123-41 (G-3): was 1–1.5 s; one shared 5 s duration for the store and the custom add.
  assert(t.highlightMs !== null && t.highlightMs >= 4700 && t.highlightMs <= 5600, `${tag}: highlight for 5 s (got ${Math.round(t.highlightMs ?? -1)} ms)`);
  assert(t.focus === first, `${tag}: focus moves to the first new tile (${first}, got ${t.focus})`);
}

async function checkCatalogPickerSequence(url) {
  const s = await openPage(url);
  // Multi-add from the picker.
  await openCatalogFromHeader(s);
  await pickCard(s, 'svc-a3').click();
  await pickCard(s, 'svc-avail').click();
  await watchPickerAdd(s);
  await pickCta(s).click();
  const multi = await pickerTimeline(s, ['svc-avail', 'svc-a3'], O35.addedN(2), 'O-123-35 (2 sites)');
  const firstMulti = await firstTileOf(s, ['svc-avail', 'svc-a3']);
  assertSequence(multi, { tag: 'O-123-35 (2 sites)', doneLabel: O35.addedN(2), reduced: false, first: firstMulti });
  assert((await focusedTile(s)) === firstMulti, `O-123-35: focus stays on the first new tile (got ${await focusedTile(s)})`);

  // The O-123-13 offer «הוספה לבית הדיגיטלי» runs the same sequence.
  await openCatalogFromHeader(s);
  await submitCustomSite(s, 'החנות ד שלי', 'a4.example.test');
  await watchPickerAdd(s);
  await offerOf(s).locator('[data-action="catalog-offer-add"]').click();
  const offer = await pickerTimeline(s, ['svc-a4'], O35.addedOne, 'O-123-35 (offer)');
  assertSequence(offer, { tag: 'O-123-35 (offer)', doneLabel: O35.addedOne, reduced: false, first: 'svc-a4' });
  assert((await focusedTile(s)) === 'svc-a4', 'O-123-35 (offer): focus stays on the new tile');

  // prefers-reduced-motion: no animation, same states and timings.
  await s.page.emulateMedia({ reducedMotion: 'reduce' });
  await openCatalogFromHeader(s);
  await pickCard(s, 'svc-a5').click();
  await watchPickerAdd(s);
  await pickCta(s).click();
  const quiet = await pickerTimeline(s, ['svc-a5'], O35.addedOne, 'O-123-35 (reduced motion)');
  assertSequence(quiet, { tag: 'O-123-35 (reduced motion)', doneLabel: O35.addedOne, reduced: true, first: 'svc-a5' });
  await closePage(s);
  return 'browser O-123-35: after «הוספת N אתרים» / the offer «הוספה לבית הדיגיטלי»: «✓ נוספו 2 אתרים» / «✓ נוסף לבית» for ~500 ms, catalog fades 500 ms with a slight scale (O-123-44), home shows the new tiles with the breathing-then-fading frame for 5 s (O-123-41 / 43), focus on the first new tile (and stays); reduced motion: immediate close, static frame, same 5 s';
}

const focusedInWindow = (s) => s.page.evaluate(() => {
  const el = document.activeElement;
  const section = el?.closest('section[data-login-assistance]');
  if (!section) return null;
  return el === section ? 'window' : el.getAttribute('data-action') ?? el.className;
});
async function expectWindowBack(s, id, focus, tag) {
  await panel(s).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  assert((await panel(s).count()) === 1, `O-123-18 (${tag}): window not reopened after the modal closed`);
  assert((await s.page.locator(`[data-service-id="${id}"] button.app-icon[aria-expanded="true"]`).count()) === 1, `O-123-18 (${tag}): the reopened window belongs to ${id} (anchored to its tile)`);
  await waitFor(s, (want) => {
    const el = document.activeElement;
    const section = el?.closest('section[data-login-assistance]');
    return Boolean(section) && (want === 'window' ? el === section : el.getAttribute('data-action') === want);
  }, focus, `O-123-18 (${tag}): focus inside the window on ${focus} (got ${await focusedInWindow(s)})`);
}
async function checkReturnToWindow(url) {
  const s = await openPage(url, { vault: { ...APPS_VAULT, selectedIds: [...APPS_VAULT.selectedIds, OWN_SITE.id], customServices: [OWN_SITE] } });

  // «עריכת פרופיל» → cancel (Escape) → window back, focus on «עריכת פרופיל».
  await openTile(s, 'svc-cred');
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  assert((await panel(s).count()) === 0, 'fixture: the window closes while the profile modal is open');
  await s.page.keyboard.press('Escape');
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await expectWindowBack(s, 'svc-cred', 'edit-profile', 'edit profile, cancel');
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });

  // «עריכת פרופיל» → save (rename) → × → window back with the new name, focus on «עריכת פרופיל».
  await openTile(s, 'svc-two');
  await panel(s).locator('.la-profile-chip', { hasText: 'אלף' }).click();
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  await modal(s).locator('button', { hasText: HE.rename }).click();
  await modal(s).locator('.cd-rename input').fill('אלף חדש');
  await modal(s).locator('button', { hasText: HE.saveName }).click();
  await waitFor(s, () => JSON.parse(localStorage.getItem('pv-fake-vault')).accessProfiles.some((p) => p.displayName === 'אלף חדש'), null, 'fixture: rename saved');
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await expectWindowBack(s, 'svc-two', 'edit-profile', 'edit profile, save');
  assert((await panel(s).locator('.la-profile-chip').allTextContents()).includes('אלף חדש'), 'O-123-18 (edit profile, save): the window is refreshed (new profile name)');

  // «הוספת פרופיל» → «ביטול» → window back, focus on «הוספת פרופיל».
  await panel(s).locator('[data-action="add-profile"]').click();
  await modal(s).locator('[data-mode="add-profile"]').waitFor({ state: 'visible', timeout: 5000 });
  await modal(s).locator('[data-mode="add-profile"] button', { hasText: 'ביטול' }).click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await expectWindowBack(s, 'svc-two', 'add-profile', 'add profile, cancel');
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });

  // «הוסף פרופיל» (empty state) → cancel → back on «הוסף פרופיל»; → save → × → the opener is gone, focus on the window.
  await openTile(s, 'svc-zero');
  await panel(s).locator('[data-action="add-first-profile"]').click();
  await modal(s).locator('[data-mode="add-profile"]').waitFor({ state: 'visible', timeout: 5000 });
  await s.page.keyboard.press('Escape');
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await expectWindowBack(s, 'svc-zero', 'add-first-profile', 'add first profile, cancel');
  await panel(s).locator('[data-action="add-first-profile"]').click();
  await modal(s).locator('[data-mode="add-profile"]').waitFor({ state: 'visible', timeout: 5000 });
  await modal(s).locator('button', { hasText: HE.saveProfile }).click();
  await modal(s).locator('button', { hasText: HE.addAnother }).waitFor({ timeout: 5000 });
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await expectWindowBack(s, 'svc-zero', 'window', 'add first profile, save');
  assert((await panel(s).locator('[data-app-context="empty-state"]').count()) === 0 && (await panel(s).locator('[data-action="edit-profile"]').count()) === 1, 'O-123-18 (add first profile, save): the window is refreshed (profile actions, no empty state)');
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });

  // «עריכת פרטי האתר» → save → window back with the new name, focus on the window (the menu item is closed).
  await openTile(s, OWN_SITE.id);
  await openMenu(s);
  await menu(s).locator('[data-action="edit-site-details"]').click();
  await siteForm(s).waitFor({ timeout: 5000 });
  await siteForm(s).locator('input[type="text"]').first().fill('אתר שלי חדש');
  await siteForm(s).locator('button[type="submit"]').click();
  await siteForm(s).waitFor({ state: 'detached', timeout: 5000 });
  await expectWindowBack(s, OWN_SITE.id, 'window', 'edit site details, save');
  assert((await panel(s).locator('.la-panel-title-text').textContent()) === 'אתר שלי חדש', 'O-123-18 (edit site details, save): the window shows the new name');
  // … → cancel (Escape) → window back.
  await openMenu(s);
  await menu(s).locator('[data-action="edit-site-details"]').click();
  await siteForm(s).waitFor({ timeout: 5000 });
  await s.page.keyboard.press('Escape');
  await siteForm(s).waitFor({ state: 'detached', timeout: 5000 });
  await expectWindowBack(s, OWN_SITE.id, 'window', 'edit site details, cancel');
  await panel(s).locator('.la-close-btn').click();
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });

  // Exception: not opened from the window — another surface closing reopens nothing.
  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
  await s.page.keyboard.press('Escape');
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  await s.page.waitForTimeout(200);
  assert((await panel(s).count()) === 0, 'O-123-18: a window is reopened only for a modal opened from it');

  // Exception: the app is removed elsewhere while its modal is open → no window, the O-123-11 notice.
  await openTile(s, 'svc-one');
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  await s.page.evaluate(() => window.__pvGone({ goneServiceIds: ['svc-one'], goneProfileIds: [] }));
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await s.page.locator('[data-service-id="svc-one"]').waitFor({ state: 'detached', timeout: 5000 });
  await s.page.waitForTimeout(200);
  assert((await panel(s).count()) === 0, 'O-123-18: window reopened although the app was removed');
  assert((await s.page.locator('[data-reconcile-notice]').textContent()).includes('האתר או הפרופיל נמחקו בחלון אחר'), 'O-123-18 / O-123-11: the closed-window notice is shown');

  // Exception: the vault is locked from inside the modal → no window after the next login.
  await openTile(s, 'svc-cred');
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  await modal(s).locator('.vault-state-badge-lock').click();
  await s.page.locator('[data-pv-login]').waitFor({ timeout: 5000 });
  assert((await panel(s).count()) === 0, 'O-123-18: no window after the vault is locked');
  await s.page.locator('[data-pv-login]').click();
  await s.page.locator('.dashboard').waitFor({ timeout: 15000 });
  await s.page.waitForTimeout(300);
  assert((await panel(s).count()) === 0, 'O-123-18: no window reopens after the next login');
  await closePage(s);
  return 'browser O-123-18: «עריכת פרופיל» (cancel / save), «הוספת פרופיל» (cancel), «הוסף פרופיל» (cancel / save) and «עריכת פרטי האתר» (save / cancel) → the same app\'s window reopens, refreshed, anchored to its tile, focus on the opener (or the window when it is gone); no window when the modal was not opened from it, the app was removed elsewhere (notice) or the vault was locked';
}

async function checkAutofillLabel(url) {
  const s = await openPage(url);
  await openTile(s, 'svc-cred');
  const auto = panel(s).locator('.la-secondary-btn--auto');
  assert((await auto.count()) === 1 && (await auto.textContent()).trim() === 'מילוי פרטים אוטומטי', `O-123-15: the autofill action reads «מילוי פרטים אוטומטי» (got ${JSON.stringify(await auto.textContent())})`);
  assert(!(await s.page.locator('body').textContent()).includes('נסה מילוי אוטומטי'), 'O-123-15: «נסה מילוי אוטומטי» is gone');
  await auto.click();
  await panel(s).locator('.la-panel-status', { hasText: HE.opened }).waitFor({ timeout: 5000 });
  await closePage(s);
  return 'browser O-123-15: the window autofill action reads «מילוי פרטים אוטומטי» (old label gone) and still runs the autofill attempt';
}

const BROWSER_GROUPS = [checkCatalogCards, checkHeaderAddButton, checkRemoveDialog, checkMenuCloses, checkProfileNames, checkOutcomeMessages, checkTestOpenButton, checkFieldsUpdatedOnly, checkLastProfileDeleted, checkDeleteUnconfirmed, checkCatalogOfferLayered, checkAutofillLabel, checkReturnToWindow, checkTileReadyDot, checkCompleteCredentialsLabel, checkCatalogOfferNoClose, checkCustomAddSequence, checkCatalogPicker, checkCatalogPickerSequence];

// ─── Runner ───────────────────────────────────────────────────────────────────
const failures = [];
/** --mutation-report: a mutation runs every group and lists each one that caught it. */
const MUTATION_REPORT = process.argv.includes('--mutation-report');
let mutationCatches = null;
async function runGroup(name, fn, log) {
  try {
    const what = await fn();
    if (log) console.log(`  ✓ ${what}`);
  } catch (e) {
    if (mutationCatches && !isTimeout(e)) {
      mutationCatches.push(`${name}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
      return;
    }
    if (!REPORT_GROUPS || isTimeout(e)) throw e;
    const message = e instanceof Error ? e.message.split('\n').filter((line) => /\S/.test(line)).slice(0, 3).join(' | ') : String(e);
    failures.push(`${name}: ${message}`);
    console.log(`  ✗ ${name} — ${message}`);
  }
}

async function runAll(overrides, log, layers = ['static', 'unit', 'browser']) {
  for (const g of STATIC_GROUPS) await runGroup(g.name, () => g(overrides), log);
  if (layers.includes('unit')) {
    for (const g of UNIT_GROUPS) await runGroup(g.name, () => withTimeout(() => g(overrides), GROUP_TIMEOUT_MS, checkTimeoutMessage(g.name)), log);
  }
  if (!layers.includes('browser')) return;
  const dir = makeTempDir('pv-1235-web-');
  let server = null;
  try {
    await bundleHarness(dir, overrides);
    server = await serve(dir);
    for (const g of BROWSER_GROUPS) {
      try {
        await runGroup(g.name, () => withTimeout(() => g(server.url), GROUP_TIMEOUT_MS, checkTimeoutMessage(g.name)), log);
      } finally {
        await closeOpenContexts();
      }
    }
  } finally {
    if (server) await server.close();
    removeTempDir(dir);
  }
}

const edit = (rel, from, to) => (o) => ({ [rel]: replaceOnce(read(rel), from, to, o) });
const edits = (rel, pairs) => (o) => {
  let src = read(rel);
  for (const [from, to] of pairs) src = replaceOnce(src, from, to, o);
  return { [rel]: src };
};
const both = (...fns) => (o) => Object.assign({}, ...fns.map((fn) => fn(o)));
/** M46 / M47: the window state a modal saw at open — it changes on save and stays on cancel. */
const O18_SNAP = 'JSON.stringify([accessProfiles, credentialsByProfileId, services.map((item) => item.name)])';
const AD_COMMENT = '/**\n * AD-123-1: replaces the execution-layer credentials_missing copy, which still names the removed\n * manage screen (src/execution is frozen, N-2).\n */\n';
const MUTATIONS = [
  // O-123-1
  // O-123-35 (G-3): M1–M4 target the picker card; M3 was «action not at the card bottom» (no
  // per-card action any more) and now breaks the equal card width instead.
  ['M1 catalog name clamp removed', edit(CSS, '.sm-pick-name {\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n', '.sm-pick-name {\n  display: block;\n'), ['browser']],
  ['M2 catalog card sizes differ (equal rows removed)', edit(CSS, '  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));\n  grid-auto-rows: 1fr;\n', '  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));\n  grid-auto-rows: auto;\n  align-items: start;\n'), ['browser']],
  ['M3 catalog card widths differ', edit(CSS, '  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));\n', '  grid-template-columns: repeat(auto-fill, minmax(132px, max-content));\n'), ['browser']],
  ['M4 full name `title` removed', edit(CATALOG, '<span className="sm-pick-name" title={service.name}>', '<span className="sm-pick-name">'), ['browser']],
  // O-123-2
  ['M5 existing account: sign-out removed', edit(REGISTER, "    logRegisterFailure('orphan recover', 'profile row already exists');\n    await signOutAccount();\n", "    logRegisterFailure('orphan recover', 'profile row already exists');\n"), ['unit']],
  ['M6 existing account: row returned as success', edit(REGISTER, '  if (await loadProfileOrNull()) {\n', '  if (false && (await loadProfileOrNull())) {\n'), ['unit']],
  ['M7 orphan recovery removed', edit(REGISTER,
    '  return ensureProfileForSession({\n    firstName,\n    lastName,\n    email,\n    phoneNormalized,\n  });\n}\n\nasync function establishSessionAfterSignUp(',
    '  await signOutAccount();\n  throw new Error(AUTH_COPY.registerDuplicate);\n}\n\nasync function establishSessionAfterSignUp('), ['unit']],
  // O-123-3
  ['M8 header add button shown at 0 apps', edit(DASH, '          {onOpenCatalog && services.length > 0 && (\n', '          {onOpenCatalog && (\n'), ['browser']],
  // O-123-4
  ['M9 remove paragraph shown at 0 profiles', edit(DIALOG, '        {hasProfiles && (\n', '        {(hasProfiles || true) && (\n'), ['browser']],
  ['M10 remove paragraph missing at ≥ 1 profile', edit(DIALOG, '        {hasProfiles && (\n', '        {(hasProfiles && false) && (\n'), ['browser']],
  // O-123-5
  ['M11 another window action keeps the menu open', edit(PANEL, '    if (appMenuOpen && !appMenuRef.current?.contains(target)) {\n      setAppMenuOpen(false);\n    }\n', ''), ['browser']],
  ['M12 Escape path ignored', edit(PANEL, "      if (event.key === 'Escape') {\n        onClose();\n      }", "      if (event.key === 'Escape' && false) {\n        onClose();\n      }"), ['browser']],
  ['M13 outside-click path ignored', edit(PANEL, "      if (wrap?.getAttribute('data-service-id') === service.id) return;\n      onClose();\n", "      if (wrap?.getAttribute('data-service-id') === service.id) return;\n"), ['browser']],
  ['M14 window-close path ignored', edit(PANEL, '          onClick={onClose}\n          aria-label={LABEL_CLOSE}', '          onClick={() => undefined}\n          aria-label={LABEL_CLOSE}'), ['browser']],
  // O-123-6
  ['M15 name field shown at 0 profiles', edit(MODAL, '              {!isFirstProfile && (\n', '              {true && (\n'), ['browser']],
  ['M16 chips shown at 1 profile', edit(MODAL, '{showProfileManagement && selectedProfile && !adding && isMultiProfile && (\n            <div className="cd-profiles"', '{showProfileManagement && selectedProfile && !adding && (\n            <div className="cd-profiles"'), ['browser']],
  ['M17 duplicate profile name accepted', edit(MODAL, '    if (sortedProfiles.some((profile) => profile.displayName.trim() === name)) {\n', '    if (false) {\n'), ['browser']],
  ['M18 empty name accepted on the second add', edit(MODAL,
    '    const name = isFirstProfile ? FIRST_PROFILE_NAME : newProfileName.trim();\n',
    '    const name = (isFirstProfile ? FIRST_PROFILE_NAME : newProfileName.trim()) || FIRST_PROFILE_NAME;\n'), ['browser']],
  ['M19 remaining name rewritten on delete', edit(HOST,
    '        await applyVaultUpdate((state) =>\n          deleteAccessProfile(state, profileId, replacementDefaultId),\n        );',
    "        await applyVaultUpdate((state) => {\n          const next = deleteAccessProfile(state, profileId, replacementDefaultId);\n          const left = getProfilesForService(next, service.id);\n          return left.length === 1 ? renameAccessProfile(next, left[0].id, 'ראשי') : next;\n        });"), ['browser']],
  // O-123-7
  ['M20 optional-credentials hint restored', edit(MODAL, '              <button type="submit" className="cd-save" disabled={saving}>\n',
    `              <p className="cd-empty">{${JSON.stringify(HE.hint)}}</p>\n              <button type="submit" className="cd-save" disabled={saving}>\n`), ['browser']],
  ['M21 save blocked without credentials', edit(MODAL, '    let credential: Credential | null = null;\n    if (addHasValues) {\n',
    "    if (!addHasValues) {\n      setStatusTone('err');\n      setStatusMessage(MSG_ADD_FIELDS_INCOMPLETE);\n      return;\n    }\n    let credential: Credential | null = null;\n    if (addHasValues) {\n"), ['browser']],
  // O-123-8
  ['M22 app outcome routed to the Digital Home banner', both(
    edits(PANEL, [
      ['  onRemoveApp?: (service: Service) => void;\n}', '  onRemoveApp?: (service: Service) => void;\n  onBanner?: (message: string) => void;\n}'],
      ['  onRemoveApp,\n}: LoginAssistancePanelProps) {', '  onRemoveApp,\n  onBanner,\n}: LoginAssistancePanelProps) {'],
      ['    setPanelStatus({ message, failure: true });\n', '    setPanelStatus({ message, failure: true });\n    onBanner?.(message);\n'],
    ]),
    edits(DASH, [
      ['  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);\n', '  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);\n  const [bannerMessage, setBannerMessage] = useState<string | null>(null);\n'],
      ['      <div className="dashboard-launcher">\n', '      {bannerMessage && (\n        <div className="dashboard-banner dashboard-banner--warn" role="status">\n          <p>{bannerMessage}</p>\n        </div>\n      )}\n\n      <div className="dashboard-launcher">\n'],
      ['          onClose={() => setAssistance(null)}\n', '          onClose={() => setAssistance(null)}\n          onBanner={setBannerMessage}\n'],
    ])), ['browser']],
  ['M23 failure line without role="alert"', edit(PANEL, 'className="la-panel-status la-panel-status--error" role="alert"', 'className="la-panel-status la-panel-status--error" role="status"'), ['browser']],
  // O-123-42 (G-3): M24 removes the new reduced-motion hold rule (was `animation: none; display: none`).
  ['M24 reduced-motion rule removed', edit(CSS, '@media (prefers-reduced-motion: reduce) {\n  .la-panel-failure-flash {\n    animation: la-panel-failure-hold 3s;\n  }\n}\n', ''), ['browser']],
  ['M25 failure line not cleared on the next action', edit(PANEL, "    if (panelStatus?.failure && target.closest('button')) {\n      setPanelStatus(null);\n    }\n", ''), ['browser']],
  // O-2
  ['M26 AD-123-1 comment misplaced again', (o) => {
    let src = replaceOnce(read(LA_MESSAGES), AD_COMMENT + 'export const MSG_AUTOFILL_CREDENTIALS_MISSING', 'export const MSG_AUTOFILL_CREDENTIALS_MISSING', o);
    src = replaceOnce(src, 'export const MSG_SELECT_PROFILE', AD_COMMENT + 'export const MSG_SELECT_PROFILE', o);
    return { [LA_MESSAGES]: src };
  }, []],
  // O-123-12
  ['M32 both messages shown together', edit(PANEL, '        !showFieldsUpdated && (\n', '        (\n'), ['browser']],
  // O-123-17
  ['M33 0-row cloud delete treated as success', edit(PERSIST, '  if (!data || data.length === 0) {\n', '  if (data && data.length < 0) {\n'), ['unit']],
  ['M34 0-row cloud delete treated as success by the window (outbox ignored)', edit(HOST, '          if (!(noRow && neverInCloud)) {\n', '          if (!noRow) {\n'), ['browser']],
  ['M35 a profile that never reached the cloud cannot be deleted', edit(HOST, '          if (!(noRow && neverInCloud)) {\n', '          if (!(noRow && neverInCloud) || noRow) {\n'), ['browser']],
  ['M36 dot / edit buttons remain after the last profile is deleted', edit(HOST, '        await applyVaultUpdate((state) =>\n          deleteAccessProfile(state, profileId, replacementDefaultId),\n        );\n', '        void replacementDefaultId;\n'), ['browser']],
  // O-123-13
  ['M37 form closed when the catalog offer appears', edit(CATALOG,
    "        setIsSavingCustom(false);\n        setCatalogOffer({\n          kind: 'catalog_service_available',",
    "        dismissAddModal();\n        setCatalogOffer({\n          kind: 'catalog_service_available',"), ['browser']],
  ['M38 typed name used instead of the catalog name', edit(CATALOG,
    "          kind: 'catalog_service_available',\n          serviceId: result.existingServiceId,\n          displayName: result.displayName,",
    "          kind: 'catalog_service_available',\n          serviceId: result.existingServiceId,\n          displayName: definition.displayName,"), ['browser']],
  ['M39 Escape closes the form too', edit(ADD_SITE, 'useEscapeToClose(cancelIfIdle, !covered);', 'useEscapeToClose(cancelIfIdle);'), ['browser']],
  ['M40 form focusable while the offer is open', edit(ADD_SITE, '      inert={covered}\n', ''), ['browser']],
  // O-123-14
  ['M41 «סגור» closes the form too', edit(CATALOG, '                    autoFocus\n                    onClick={dismissCatalogOffer}', '                    autoFocus\n                    onClick={closeOfferAndForm}'), ['browser']],
  ['M42 the typed values are lost behind the offer', edit(CATALOG, '          covered={catalogOffer !== null}\n', "          key={catalogOffer ? 'covered' : 'open'}\n          covered={catalogOffer !== null}\n"), ['browser']],
  // O-123-15
  ['M43 old autofill label restored', edit(LA_MESSAGES, "LABEL_TRY_AUTO = 'מילוי פרטים אוטומטי'", "LABEL_TRY_AUTO = 'נסה מילוי אוטומטי'"), ['browser']],
  // O-123-18
  ['M46 window not reopened after save', edits(DASH, [
    ['    windowReturn.current = { serviceId: service.id, opener, opened: false };', `    windowReturn.current = { serviceId: service.id, opener, opened: false, snap: ${O18_SNAP} } as WindowReturn;`],
    ['    if (!pending.opened || !vaultUnlocked) return;', `    if (!pending.opened || !vaultUnlocked || (pending as WindowReturn & { snap: string }).snap !== ${O18_SNAP}) return;`],
  ]), ['browser']],
  ['M47 window not reopened after cancel', edits(DASH, [
    ['    windowReturn.current = { serviceId: service.id, opener, opened: false };', `    windowReturn.current = { serviceId: service.id, opener, opened: false, snap: ${O18_SNAP} } as WindowReturn;`],
    ['    if (!pending.opened || !vaultUnlocked) return;', `    if (!pending.opened || !vaultUnlocked || (pending as WindowReturn & { snap: string }).snap === ${O18_SNAP}) return;`],
  ]), ['browser']],
  ['M48 window reopened although the app was removed', edits(DASH, [
    ['    windowReturn.current = { serviceId: service.id, opener, opened: false };', '    windowReturn.current = { serviceId: service.id, opener, opened: false, service } as WindowReturn;'],
    ['    const service = services.find((item) => item.id === pending.serviceId);', '    const service = services.find((item) => item.id === pending.serviceId) ?? (pending as WindowReturn & { service: Service }).service;'],
    ['    if (!service || !(tile instanceof HTMLElement)) return;', '    if (!service) return;'],
    ['anchorRect: tile.getBoundingClientRect() });', 'anchorRect: tile instanceof HTMLElement ? tile.getBoundingClientRect() : new DOMRect() });'],
  ]), ['browser']],
  // O-123-19
  ['M49 «↗ פתח» beside the URL field again', edit(CSS, '  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n', '  display: flex;\n  align-items: center;\n'), ['browser']],
  ['M50 old «פתיחה לבדיקה» label', edit(ADD_SITE, "export const TEST_OPEN_URL_LABEL = 'פתח';", "export const TEST_OPEN_URL_LABEL = 'פתיחה לבדיקה';"), ['browser']],
  ['M51 no descriptive accessible name', edit(ADD_SITE, '                aria-label={TEST_OPEN_URL_ACCESSIBLE_NAME}\n', ''), ['browser']],
  // O-123-20 / O-123-21
  ['M52 old «הסרת אפליקציה» menu label', edit(LA_MESSAGES, "LABEL_REMOVE_APP = 'הסרת אתר'", "LABEL_REMOVE_APP = 'הסרת אפליקציה'"), ['browser']],
  ['M53 old «…של האפליקציה…» confirm paragraph', edit(DIALOG, 'ופרטי ההתחברות של האתר יימחקו', 'ופרטי ההתחברות של האפליקציה יימחקו'), ['browser']],
  // O-123-22
  ['M54 AuthRequiredError mapping removed (persistence copy)', edit(CUSTOM_ADD_FAILURE, "  if (error instanceof Error && error.name === 'AuthRequiredError') {", '  if (false) {'), ['unit']],
  // O-123-23
  ['M55 «חזרה לבית הדיגיטלי» link back on the admin login', edit(ADMIN_GATE, '          onAuthenticated={handleAdminAuthenticated}\n        />\n', `          onAuthenticated={handleAdminAuthenticated}\n        />\n${O23_OLD_LINK}`), ['unit']],
  ['M56 old admin login heading «מרכז הבקרה»', edit(ADMIN_GATE, `heading="${O23_HEADING}"`, 'heading="מרכז הבקרה"'), ['unit']],
  ['M57 admin login subtitle back', edit(ADMIN_GATE, `          heading="${O23_HEADING}"\n`, `          heading="${O23_HEADING}"\n${O23_OLD_SUBTITLE}`), ['unit']],
  // O-123-25
  ['M59 dot back to "profile exists" only', edit(DASH, O25_DOT, 'hasCredentials={appHasProfile({ accessProfiles }, service.id)}'), ['browser']],
  ['M60 dot without the profile term', edit(DASH, '          appHasProfile({ accessProfiles }, service.id) &&\n          deriveServiceManagementState(', '          deriveServiceManagementState('), ['browser']],
  // O-123-28: M74–M81 retired — O-123-39 removed the in-catalog sequence they mutated.
  // O-123-35
  ['M82 old catalog title «הוספת אפליקציה»', edit(CMODAL, "export const CATALOG_MODAL_TITLE = 'הוספת אתר לבית הדיגיטלי';", "export const CATALOG_MODAL_TITLE = 'הוספת אפליקציה';"), ['browser']],
  ['M83 chip «הכל» (not «הכול»)', edit(CMSG, "export const LABEL_ALL_CATEGORIES = 'הכול';", "export const LABEL_ALL_CATEGORIES = 'הכל';"), ['browser']],
  ['M84 search field full width', edit(CSS, '  grid-template-columns: minmax(0, 22rem) auto;\n', '  grid-template-columns: 1fr auto;\n'), ['browser']],
  ['M85 sparse grid (4 per row)', edit(CSS, '  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));\n', '  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));\n'), ['browser']],
  ['M86 card shows its category', edit(CATALOG, '                        {service.name}\n                      </span>\n', '                        {service.name}\n                      </span>\n                      <span className="sm-pick-category">{runtimeCategoryLabels[service.category] ?? service.category}</span>\n'), ['browser']],
  ['M87 card without aria-pressed', edit(CATALOG, '                      aria-pressed={picked}\n', ''), ['browser']],
  ['M88 in-home card not aria-disabled', edit(CATALOG, "aria-disabled={itemState !== 'available' ? true : undefined}", "aria-disabled={itemState === 'pending' ? true : undefined}"), ['browser']],
  ['M89 green «כבר בבית הדיגיטלי» label back', edit(CMSG, "export const LABEL_ALREADY_IN_HOME = '✓ כבר נוסף';", "export const LABEL_ALREADY_IN_HOME = '✓ כבר בבית הדיגיטלי';"), ['browser']],
  ['M90 CTA shown with nothing selected', edit(CATALOG, '          {(picks.size > 0 || pickedCount > 0) && (\n', '          {(true) && (\n'), ['browser']],
  ['M91 CTA without the count', edit(CMSG, "  return count === 1 ? 'הוספת האתר' : `הוספת ${count} אתרים`;", "  return count === 1 ? 'הוספת האתר' : 'הוספת אתרים';"), ['browser']],
  ['M92 one persistVault per site', edit(APP,
    '      const next = recordLocalCreations(\n        vaultState,\n        toAdd.reduce((state, id) => addToSelection(state, id), vaultState),\n      );\n      await persistSelectionState(next);\n',
    '      let next = vaultState;\n      for (const id of toAdd) {\n        next = recordLocalCreations(next, addToSelection(next, id));\n        await persistSelectionState(next);\n      }\n'), ['browser']],
  ['M93 failure clears the selection', edit(CATALOG, '    if (outcome.status === \'failed\') {\n      setAddFailure(outcome.message);\n      return;\n    }\n    setPickedCount(ids.length);', '    if (outcome.status === \'failed\') {\n      setAddFailure(outcome.message);\n      setPicks(new Set());\n      return;\n    }\n    setPickedCount(ids.length);'), ['browser']],
  ['M94 failure line without role="alert"', edit(CATALOG, '<p className="sm-pick-error" role="alert">', '<p className="sm-pick-error">'), ['browser']],
  ['M95 no «✓ נוסף…» CTA label', edit(CATALOG, '{pickedCount > 0 ? pickAddedLabel(pickedCount) : pickAddLabel(picks.size)}', '{pickAddLabel(picks.size)}'), ['browser']],
  ['M96 catalog closes at once after the add', edit(CATALOG, 'export const PICK_ADDED_MS = 500;', 'export const PICK_ADDED_MS = 0;'), ['browser']],
  // O-123-44 (G-3): re-anchored on the 500 ms dh-catalog-exit rule (was dh-fade-out 250 ms).
  ['M97 catalog not faded', edit(CSS, ".dh-catalog-overlay[data-closing='true'] {\n  animation: dh-catalog-exit 500ms ease-out forwards;", ".dh-catalog-overlay[data-closing='true'] {\n  animation: none;"), ['browser']],
  ['M98 catalog stays open after the add', edit(CMODAL, '        onAdded(ids);\n', '        void ids;\n'), ['browser']],
  ['M99 new tiles not highlighted', edit(DASH, '        justAdded={justAddedIds?.includes(service.id) ?? false}\n', '        justAdded={false}\n'), ['browser']],
  // O-123-41 (G-3): anchored on the 5 s constant (was 1200).
  ['M100 tile highlight 3 s', edit(DASH, 'export const HOME_JUST_ADDED_MS = 5000;', 'export const HOME_JUST_ADDED_MS = 3000;'), ['browser']],
  ['M101 focus not moved to the new tile', edit(DASH, "    first?.querySelector<HTMLElement>('button.app-icon')?.focus({ preventScroll: true });\n", ''), ['browser']],
  ['M102 focus on the last new tile', edit(DASH, "    const first = [...document.querySelectorAll<HTMLElement>('[data-service-tile][data-service-id]')]\n", "    const first = [...document.querySelectorAll<HTMLElement>('[data-service-tile][data-service-id]')].reverse()\n"), ['browser']],
  ['M103 catalog fade still animated under reduced motion', edit(CSS, "  .sm-pick,\n  .dh-catalog-overlay[data-closing='true'],\n", '  .sm-pick,\n'), ['browser']],
  ['M104 offer add without the post-add sequence', edit(CATALOG, '      if (onAddSequenceDone) onAddSequenceDone([serviceId]);\n      else closeOfferAndForm();', '      closeOfferAndForm();'), ['browser']],
  ['M105 in-home card selectable', edit(CATALOG, "    if (catalogItemState(serviceId, selectedIds, pendingIds) !== 'available') return;", "    if (catalogItemState(serviceId, selectedIds, pendingIds) === 'pending') return;"), ['browser']],
  // O-123-30
  // O-123-31
  ['M107 «עריכת אתר» heading + description back on «בדיקה והפעלה»', edits(REGISTRY_ADMIN, [["{workspaceTab !== 'test' || detailsUnsavedElsewhere ? (", '{true ? ('], ["                {workspaceTab !== 'test' ? (\n                  <>", '                {true ? (\n                  <>']]), ['unit']],
  ['M108 A2 suffix back on the success message', edit(FILL_TEST_GRID, '        setSuccess(outcome.userMessage);', '        setSuccess(diagText ? `${outcome.userMessage}\\n\\n[A2 diagnostics — copy from browser console: A2 ManagedFillDiagnostics]` : outcome.userMessage);'), ['unit']],
  ['M109 A2 suffix back on the failure message', edit(FILL_TEST_GRID, '        setError(outcome.userMessage);', '        setError(diagText ? `${outcome.userMessage}\\n\\n[A2 diagnostics — see browser console: A2 ManagedFillDiagnostics]` : outcome.userMessage);'), ['unit']],
  ['M110 success message cleared by a 4 s timer', edit(FILL_TEST_GRID, '  // O-123-31 — the result stays', '  useEffect(() => {\n    if (!success) return;\n    const timer = window.setTimeout(() => setSuccess(null), 4000);\n    return () => window.clearTimeout(timer);\n  }, [success]);\n\n  // O-123-31 — the result stays'), ['unit']],
  ['M111 failure message cleared by a timer', edit(FILL_TEST_GRID, '  // O-123-31 — the result stays', '  useEffect(() => {\n    if (!error) return;\n    const timer = window.setTimeout(() => setError(null), 8000);\n    return () => window.clearTimeout(timer);\n  }, [error]);\n\n  // O-123-31 — the result stays'), ['unit']],
  ['M112 leaving the tab keeps the result', edit(FILL_TEST_GRID, '    if (active) {\n      return;\n    }', '    if (active || !active) {\n      return;\n    }'), ['unit']],
  ['M113 the next run keeps the previous failure', edit(FILL_TEST_GRID, '    setError(null);\n    setSuccess(null);\n    setTestOutcome(null);\n    setStopped(false);\n    setTesting(true);\n    try {\n      const outcome = await executeAdminManagedAutofillTest(', '    setSuccess(null);\n    setTestOutcome(null);\n    setStopped(false);\n    setTesting(true);\n    try {\n      const outcome = await executeAdminManagedAutofillTest('), ['unit']],
  ['M114 A2 diagnostics no longer in the console', edit(FILL_TEST_GRID, "      if (diagText) {\n        // A2 — Operator capture (browser console). Never includes credential values.\n        console.info('[A2 ManagedFillDiagnostics]', outcome.fillDiagnostics);\n      }\n", ''), ['unit']],
  ['M115 the test tab is never told it was left', edit(REGISTRY_ADMIN, "                      active={workspaceTab === 'test'}\n", ''), ['unit']],
  // O-123-32
  ['M116 «חסום למשתמשים» missing from the approval filter', edit(REGISTRY_ADMIN, "const APPROVAL_FILTER_STATES: UserApprovalState[] = ['approved', 'not_approved', 'blocked', 'no_mapping'];", "const APPROVAL_FILTER_STATES: UserApprovalState[] = ['approved', 'not_approved', 'no_mapping'];"), ['unit']],
  ['M117 approval options not the badge labels', edit(REGISTRY_ADMIN, '              {USER_APPROVAL_HE[state]}\n            </option>', '              {state}\n            </option>'), ['unit']],
  ['M118 approval filter not AND-combined with the search', edit(REGISTRY_ADMIN, "      if (filterApproval !== 'all' && userApprovalState(row) !== filterApproval) return false;", "      if (filterApproval !== 'all') return userApprovalState(row) === filterApproval;"), ['unit']],
  ['M119 «כל מצבי האישור» worded differently', edit(REGISTRY_ADMIN, '<option value="all">כל מצבי האישור</option>', '<option value="all">כל המצבים</option>'), ['unit']],
  ['M120 approval filter ignored', edit(REGISTRY_ADMIN, "      if (filterApproval !== 'all' && userApprovalState(row) !== filterApproval) return false;", ''), ['unit']],
  // O-123-29
  ['M121 admin tabs not equal', edit(ADMIN_CSS, '  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 4px;', '  grid-template-columns: repeat(3, auto);\n  justify-content: start;\n  gap: 4px;'), ['unit']],
  ['M122 admin tab text small', edit(ADMIN_CSS, '  font-size: 1.1875rem;\n  font-weight: 600;\n  line-height: 1.3;', '  font-size: 0.875rem;\n  font-weight: 600;\n  line-height: 1.3;'), ['unit']],
  ['M123 active admin tab not dominant', edit(ADMIN_CSS, '.admin-tabbar .admin-nav-btn.is-active {\n  border-color: var(--admin-primary);\n  background: var(--admin-primary);\n  color: #fff;\n  font-weight: 700;', '.admin-tabbar .admin-nav-btn.is-active {\n  border-color: var(--admin-primary);'), ['unit']],
  ['M124 admin tabs without role="tablist"', edit(ADMIN_APP, ' role="tablist"', ''), ['unit']],
  ['M125 aria-selected stuck on «הגדרת אתרים»', edit(ADMIN_APP, 'aria-selected={tab === item.id}', "aria-selected={item.id === 'registry'}"), ['unit']],
  ['M126 admin tab bar not full width', edit(ADMIN_CSS, '  width: 100%;\n  margin: 0.65rem 0 0;', '  width: 60%;\n  margin: 0.65rem 0 0;'), ['unit']],
  ['M127 admin tab animation under reduced motion', edit(ADMIN_CSS, '  .admin-app *,\n  .admin-app *::before,\n  .admin-app *::after {\n    transition-duration: 0s !important;\n', '  .admin-app *,\n  .admin-app *::before,\n  .admin-app *::after {\n'), ['unit']],
  ['M128 admin tabs no longer route', edit(ADMIN_APP, 'onClick={() => void selectTab(item.id)}', 'onClick={() => undefined}'), ['unit']],
  ['M129 narrow screens: tab bar and filters squeeze the site list', edit(ADMIN_CSS, '/* O-123-29 / O-123-32 on narrow screens: the viewport-locked shell must leave room for the site list. */\n@media (max-width: 700px) {', '@media (max-width: 1px) {'), ['unit']],
  // Architect rulings round (O-123-30 / 31 b / 29 b c / 36).
  ['M130 «+ אתר חדש» back to 14px', edit(ADMIN_CSS, '.admin-catalog-bar .admin-toolbar .admin-new-site-btn {\n  font-size: 16px;', '.admin-catalog-bar .admin-toolbar .admin-new-site-btn {\n  font-size: 14px;'), ['unit']],
  ['M131 «+» not scaled with the 16px text', edit(ADMIN_CSS, '.admin-catalog-bar .admin-toolbar .admin-new-site-btn .admin-icon {\n  width: 18px;\n  height: 18px;\n}', '.admin-catalog-bar .admin-toolbar .admin-new-site-btn .admin-icon {\n}'), ['unit']],
  ['M132 technical tokens back in the visible failure line', edit(FILL_TEST_GRID, '        setError(outcome.userMessage);', '        setError(formatAdminManagedTestResultSummary(outcome));'), ['unit']],
  ['M133 «פרטים טכניים» open by default', edit(FILL_TEST_GRID, '<details className="admin-special-test-details" data-section="managed-test-technical">', '<details open className="admin-special-test-details" data-section="managed-test-technical">'), ['unit']],
  ['M134 arrow keys do not move between admin tabs', edit(ADMIN_APP, ' onKeyDown={onTabListKeyDown}', ''), ['unit']],
  ['M135 every admin tab tabIndex 0', edit(ADMIN_APP, 'tabIndex={tab === item.id ? 0 : -1}', 'tabIndex={0}'), ['unit']],
  ['M136 admin content without role="tabpanel"', edit(ADMIN_APP, ' role="tabpanel"', ''), ['unit']],
  ['M137 admin tab arrows in LTR direction', edits(ADMIN_APP, [["if (event.key === 'ArrowLeft') target", "if (event.key === 'ArrowRight') target"], ["else if (event.key === 'ArrowRight') target", "else if (event.key === 'ArrowLeft') target"]]), ['unit']],
  ['M138 logo fallback threshold 36 px only', edit(RESOLVE_LOGO, 'const MIN_FALLBACK_LOGO_SIZE = 32;', 'const MIN_FALLBACK_LOGO_SIZE = 36;'), ['unit']],
  ['M139 logo fallback keeps the smaller sub-36 candidate', edit(RESOLVE_LOGO, '(!fallback.best || size > fallback.best.size)', '(!fallback.best || size < fallback.best.size)'), ['unit']],
  ['M140 32 px accepted in the strict tier (wins over a later larger icon)', edit(RESOLVE_LOGO, '      if (size >= MIN_LOGO_SIZE) {', '      if (size >= MIN_FALLBACK_LOGO_SIZE) {'), ['unit']],
  ['M141 logo fallback accepts < 32 px', edit(RESOLVE_LOGO, 'const MIN_FALLBACK_LOGO_SIZE = 32;', 'const MIN_FALLBACK_LOGO_SIZE = 16;'), ['unit']],
  ['M142 allorigins HTML proxy restored', edit(RESOLVE_LOGO, '  } catch {\n    return null;\n  } finally {\n    window.clearTimeout(timer);\n  }\n\n  return null;\n}', '  } catch {\n    // fall through to the proxy\n  } finally {\n    window.clearTimeout(timer);\n  }\n\n  try {\n    const proxied = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(site.href)}`);\n    if (proxied.ok) return await proxied.text();\n  } catch {\n    return null;\n  }\n  return null;\n}'), ['unit']],
  // O-123-39
  ['M143 custom add keeps the catalog open (O-123-28 path)', edit(CATALOG, '      if (onAddSequenceDone) onAddSequenceDone([definition.id]);\n      else dismissAddModal();', '      dismissAddModal();'), ['browser']],
  ['M144 custom add lands with no tile highlighted', edit(CATALOG, 'onAddSequenceDone([definition.id])', 'onAddSequenceDone([])'), ['browser']],
  ['M145 a failed custom add closes the form', edit(CATALOG, '      setIsSavingCustom(false);\n      setAddError(toFriendlySecurityError(error));', '      dismissAddModal();'), ['browser']],
  ['M146 in-catalog status line back', edit(CATALOG, '        <>\n          <div className="sm-add-toolbar">', '        <>\n          {isSavingCustom && <p className="app-catalog-status" role="status" data-catalog-notice="custom-added">{\'✓ האתר נוסף לבית הדיגיטלי\'}</p>}\n          <div className="sm-add-toolbar">'), ['browser']],
  // O-123-41
  ['M147 tile highlight back to 1.2 s', edit(DASH, 'export const HOME_JUST_ADDED_MS = 5000;', 'export const HOME_JUST_ADDED_MS = 1200;'), ['browser']],
  ['M148 shorter highlight under reduced motion', edit(DASH, '    const timer = window.setTimeout(() => onJustAddedShownRef.current?.(), HOME_JUST_ADDED_MS);', "    const timer = window.setTimeout(() => onJustAddedShownRef.current?.(), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1200 : HOME_JUST_ADDED_MS);"), ['browser']],
  ['M149 a second highlight constant in the catalog', edit(CATALOG, 'export const PICK_ADDED_MS = 500;\n', 'export const PICK_ADDED_MS = 500;\nexport const JUST_ADDED_HIGHLIGHT_MS = 5000;\n'), []],
  // O-123-40
  ['M150 whole in-home card dimmed again', edit(CSS, '.sm-pick--in-home {\n  background: #f1f5f9;\n  cursor: default;\n}', '.sm-pick--in-home {\n  background: #f1f5f9;\n  opacity: 0.55;\n  cursor: default;\n}'), ['browser']],
  ['M151 «✓ כבר נוסף» not bold', edit(CSS, '  font-size: 0.75rem;\n  font-weight: 700;\n  color: #166534;', '  font-size: 0.75rem;\n  color: #166534;'), ['browser']],
  ['M152 «✓ כבר נוסף» light grey (low contrast)', edit(CSS, '  font-weight: 700;\n  color: #166534;', '  font-weight: 700;\n  color: #94a3b8;'), ['browser']],
  ['M153 icon and name not dimmed', edit(CSS, '.sm-pick--in-home .sm-pick-icon,\n.sm-pick--in-home .sm-pick-name {\n  opacity: 0.55;\n}\n\n', ''), ['browser']],
  ['M154 label inside a dimmed wrapper', edit(CATALOG, '{inHome && <span className="sm-pick-in-home">{LABEL_ALREADY_IN_HOME}</span>}', '{inHome && <span className="sm-pick-name"><span className="sm-pick-in-home">{LABEL_ALREADY_IN_HOME}</span></span>}'), ['browser']],
  // O-123-42
  ['M155 wash fades from the first moment (2 s)', edit(CSS, '  animation: la-panel-failure-fade 5s;', '  animation: la-panel-failure-fade 2s ease-out;'), ['browser']],
  ['M156 no 3 s hold', edit(CSS, '  0%,\n  60% {\n    opacity: 1;', '  0% {\n    opacity: 1;'), ['browser']],
  ['M157 wash hidden under reduced motion again', edit(CSS, '    animation: la-panel-failure-hold 3s;\n', '    animation: none;\n    display: none;\n'), ['browser']],
  ['M158 reduced-motion wash never removed', edit(CSS, 'animation: la-panel-failure-hold 3s;', 'animation: la-panel-failure-hold 3s forwards;'), ['browser']],
  ['M159 a new failure does not restart the wash', edit(PANEL, 'key={failureFlash}', 'key="flash"'), ['browser']],
  ['M160 hold 4 s', edit(CSS, '  0%,\n  60% {', '  0%,\n  80% {'), ['browser']],
  // O-123-43
  ['M161 no breathing (old 1.2 s glow)', edit(CSS, 'animation: dh-home-just-added 5s ease-in-out forwards;', 'animation: dh-home-just-added 1.2s ease-in-out;'), ['browser']],
  ['M162 hard on / off steps', edit(CSS, 'animation: dh-home-just-added 5s ease-in-out forwards;', 'animation: dh-home-just-added 5s steps(1, end) forwards;'), ['browser']],
  ['M163 frame removed abruptly (no end fade)', edit(CSS, '  100% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0), 0 0 18px rgba(34, 197, 94, 0); }', '  100% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 1), 0 0 18px rgba(34, 197, 94, 0.45); }'), ['browser']],
  ['M164 breathing under reduced motion', edit(CSS, "  .dh-catalog-overlay[data-closing='true'],\n  .app-icon-wrap--just-added {", "  .dh-catalog-overlay[data-closing='true'] {"), ['browser']],
  ['M165 fast flashing (0.5 s cycles, 4 runs)', edit(CSS, 'animation: dh-home-just-added 5s ease-in-out forwards;', 'animation: dh-home-just-added 1.25s ease-in-out 4;'), ['browser']],
  ['M166 colour jump at the first dim', edit(CSS, '  16% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.4), 0 0 18px rgba(34, 197, 94, 0.18); }', '  16% { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.4), 0 0 18px rgba(239, 68, 68, 0.18); }'), ['browser']],
  // O-123-44
  ['M167 catalog fade back to 250 ms', edit(CMODAL, 'export const CATALOG_FADE_MS = 500;', 'export const CATALOG_FADE_MS = 250;'), ['browser']],
  ['M168 opacity only, no scale', edit(CSS, '  to { opacity: 0; transform: scale(0.98); }', '  to { opacity: 0; }'), ['browser']],
  ['M169 add form removed before the fade', edit(CATALOG, '      if (onAddSequenceDone) onAddSequenceDone([definition.id]);\n      else dismissAddModal();', '      dismissAddModal();\n      if (onAddSequenceDone) onAddSequenceDone([definition.id]);'), ['browser']],
  ['M170 reduced motion still waits for the fade', edit(CMODAL, "    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {\n      done();\n      return;\n    }\n", ''), ['browser']],
  ['M171 interaction not blocked during the fade', edit(CMODAL, '      inert={closing}\n', ''), ['browser']],
  // O-123-33
  ['M67 duplicate e-mail shown inline again', edit(AUTH_ENTRY, "      if (mode === 'register' && isRegisterDuplicate(message)) {", '      if (false) {'), ['unit']],
  ['M68 register fields kept when the dialog opens', edit(AUTH_ENTRY, '        clearRegisterFields();\n        setDuplicateNotice(', '        setDuplicateNotice('), ['unit']],
  ['M69 register form not inert behind the dialog', edit(AUTH_ENTRY, '        inert={duplicateNotice !== null}\n', ''), ['unit']],
  ['M70 old duplicate copy with «»', edit(AUTH_COPY_FILE, `registerDuplicate: '${O33_TEXT}',`, `registerDuplicate: '${O33_OLD_TEXT}',`), ['unit']],
  ['M71 developer detail visible in the dialog', edit(AUTH_ENTRY, '        setDuplicateNotice(AUTH_COPY.registerDuplicate);', '        setDuplicateNotice(message);'), ['unit']],
  ['M72 focus not moved to the first field after «סגור»', edit(AUTH_ENTRY, '    firstRegisterFieldRef.current?.focus();\n', ''), ['unit']],
  ['M73 register form translucent behind the dialog', edit(CSS, '.auth-entry-card--covered {\n  filter:', '.auth-entry-card--covered {\n  opacity: 0.55;\n  filter:'), ['unit']],
  // O-123-34
  ['M65 × back on the catalog offer', edit(CATALOG, '                  {catalogOfferFoundTitle(catalogOffer.displayName)}\n                </h2>\n',
    '                  {catalogOfferFoundTitle(catalogOffer.displayName)}\n                </h2>\n                <button type="button" className="la-icon-btn" aria-label="סגירה" onClick={dismissCatalogOffer}>×</button>\n'), ['browser']],
  ['M66 Escape closes only the offer again', edit(CATALOG, "    if (catalogOffer?.kind === 'catalog_service_available') closeOfferAndForm();\n    else dismissCatalogOffer();", '    dismissCatalogOffer();'), ['browser']],
  // O-123-27
  ['M64 covered form translucent again (opacity: 0.55)', edit(CSS, "  filter: brightness(0.7) saturate(0.6);\n", '  opacity: 0.55;\n  filter: brightness(0.7) saturate(0.6);\n'), ['browser']],
  // O-123-26
  ['M61 window edit button always «עריכת פרופיל»', edit(PANEL, '{activeProfileComplete ? LABEL_EDIT_PROFILE : LABEL_COMPLETE_CREDENTIALS}', '{LABEL_EDIT_PROFILE}'), ['browser']],
  ['M62 completeness condition inverted', edit(PANEL, '{activeProfileComplete ? LABEL_EDIT_PROFILE : LABEL_COMPLETE_CREDENTIALS}', '{!activeProfileComplete ? LABEL_EDIT_PROFILE : LABEL_COMPLETE_CREDENTIALS}'), ['browser']],
  ['M63 old credentials_missing copy', edit(LA_MESSAGES, `'${O26_MESSAGE}'`, "'פרטי הכניסה בפרופיל הזה חסרים. לחצו «עריכת פרופיל» בחלון האפליקציה והשלימו אותם.'"), ['browser']],
  // O-123-24
  ['M58 old user login title «כספת דיגיטלית»', edit(AUTH_COPY_FILE, O24_TITLE_LINE[0], O24_TITLE_LINE[1]), ['unit']],
  // O-123-16 (the closed-window behaviour is checked in verifyPhase123Navigation)
  ['M44 old removed-elsewhere wording', edit(RECONCILE, O16_LINE[0], O16_LINE[1]), []],
  ['M45 another cloudReconcile.ts line changed', edit(RECONCILE, 'export const CLOUD_REFRESH_MIN_INTERVAL_MS = 10_000;', 'export const CLOUD_REFRESH_MIN_INTERVAL_MS = 5_000;'), []],
  // O-123-11 (the behaviour is checked in verifyPhase123Navigation)
  ['M31 plain removed-elsewhere constant kept', edit(LA_MESSAGES, AD_COMMENT,
    `/** Removed-elsewhere notice when no open window closed (e.g. a tile left the home). */\nexport const MSG_REMOVED_ELSEWHERE_PLAIN = 'האפליקציה או הפרופיל נמחקו בחלון אחר.';\n\n${AD_COMMENT}`), []],
  // O-123-9
  ['M27 owner-select policy without the owner condition', edit(OWNER_SELECT_MIGRATION, "using (owner_user_id = auth.uid() and source_type = 'user');", "using (source_type = 'user');"), ['unit']],
  // O-123-10
  // O-123-19 (G-3): same mutation on the relabelled button markup.
  ['M28 «פתיחה לבדיקה» button absent', edit(ADD_SITE,
    '              <button\n                type="button"\n                className="modal-btn modal-btn-secondary modal-url-test"\n                data-action="test-open-url"\n                aria-label={TEST_OPEN_URL_ACCESSIBLE_NAME}\n                disabled={isSaving || !testUrl.valid}\n                onClick={() => {\n                  if (testUrl.valid) openUrlInNewTab(testUrl.normalizedUrl);\n                }}\n              >\n                <span className="modal-url-test-icon" aria-hidden="true">{TEST_OPEN_URL_ICON}</span>\n                {TEST_OPEN_URL_LABEL}\n              </button>\n',
    ''), ['browser']],
  // The raw field text is not a distinct URL here: the click blurs the field and the existing blur
  // handler completes the scheme first. A `www.` added on open is the different-URL case.
  ['M29 test button opens a URL different from the stored one', edit(ADD_SITE, 'if (testUrl.valid) openUrlInNewTab(testUrl.normalizedUrl);', "if (testUrl.valid) openUrlInNewTab(testUrl.normalizedUrl.replace('https://www.', 'https://').replace('https://', 'https://www.'));"), ['browser']],
  ['M30 test button enabled for an invalid address', edit(ADD_SITE, 'disabled={isSaving || !testUrl.valid}', 'disabled={isSaving}'), ['browser']],
];

const selectedMutations = selectMutations(MUTATIONS, MUTATION_ARGS, (m) => m[0]);

console.log('Phase 123.5 — Owner run fixes O-123-1…25 + O-2\n');
browser = await chromium.launch({ channel: 'msedge' });
const closeBrowser = () => browser.close();
try {
  await runAll({}, true);
  const groupCount = STATIC_GROUPS.length + UNIT_GROUPS.length + BROWSER_GROUPS.length;
  if (REPORT_GROUPS) {
    console.log(failures.length
      ? `\nGROUP REPORT — ${failures.length} of ${groupCount} check groups failing — ${formatElapsed(Date.now() - STARTED)}`
      : `\nGROUP REPORT — all ${groupCount} check groups pass — ${formatElapsed(Date.now() - STARTED)}`);
    await withTimeout(closeBrowser, 10_000, 'browser close timed out').catch(() => undefined);
    process.exit(failures.length ? 1 : 0);
  }
  if (MUTATION_ARGS.mode === 'none') {
    console.log(`\nPASS — Phase 123.5 Owner fixes: ${groupCount} check groups, mutation sweep skipped (--no-mutations) — ${formatElapsed(Date.now() - STARTED)}`);
  } else {
    console.log(MUTATION_ARGS.mode === 'all' ? '\nMutations (full sweep)' : `\nMutations (selected: ${[...MUTATION_ARGS.ids].join(', ')})`);
    let caughtCount = 0;
    for (const [label, makeOverrides, layers] of selectedMutations) {
      const id = mutationId(label);
      const overrides = makeOverrides(label);
      let caught = null;
      if (MUTATION_REPORT) mutationCatches = [];
      try {
        await withTimeout(() => runAll(overrides, false, layers), MUTATION_TIMEOUT_MS, mutationTimeoutMessage(id, MUTATION_TIMEOUT_MS));
      } catch (e) {
        if (isTimeout(e)) await failRun(`${e.message} (${label})`, closeBrowser);
        caught = e instanceof Error ? e.message.split('\n')[0] : String(e);
      } finally {
        await closeOpenContexts();
      }
      if (mutationCatches) {
        for (const line of mutationCatches) console.log(`      caught by ${line.slice(0, 200)}`);
        caught ??= mutationCatches[0]?.replace(/^\w+: /, '') ?? null;
        mutationCatches = null;
      }
      assert(caught, `mutation NOT caught: ${label}`);
      assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
      caughtCount += 1;
      console.log(`  ✓ mutation caught: ${id} ${label.slice(id.length + 1)} — ${caught.slice(0, 160)}`);
    }
    console.log(`  H-1: ${reclaimedContexts} browser context(s) left open by a failing check were closed by the group finally`);
    const scope = MUTATION_ARGS.mode === 'all' ? 'mutations caught' : 'selected mutations caught';
    console.log(`\nPASS — Phase 123.5 Owner fixes: ${groupCount} check groups, ${caughtCount} ${scope} — ${formatElapsed(Date.now() - STARTED)}`);
  }
} catch (e) {
  await failRun(e instanceof Error ? e.message : String(e), closeBrowser);
}
await withTimeout(closeBrowser, 10_000, 'browser close timed out').catch(() => undefined);
process.exit(0);
