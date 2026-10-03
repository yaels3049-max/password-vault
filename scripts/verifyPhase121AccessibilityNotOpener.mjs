/**
 * Phase 121 D-121-57 — accessibility controls are never proposed first (SPECIAL Analyze).
 * Real extension collector (`page-structure-inspect.js` + shared helpers, linkedom) feeds the
 * real Hub ranking (`proposeSpecialActionCandidates`). Synthetic site-shaped fixtures:
 * HTZone (accessibility toggle with popup semantics + login control with / without a login word),
 * El Al (visible «התחברות» + plugin aria-label with «לנגיש»), Super-Pharm (#loginAnchor),
 * PAGI (skip link + popup opener), Mizrahi (#logInBtn). Mutations must be caught.
 * Usage: node scripts/verifyPhase121AccessibilityNotOpener.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { withTempDir } from './lib/tempDir.mjs';

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
function loadModule(entry, name, overrides) {
  return withTempDir(`pv-12157-${name}-`, (outdir) => loadModuleIn(outdir, entry, name, overrides));
}
async function loadModuleIn(outdir, entry, name, overrides) {
  const outfile = join(outdir, `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    packages: 'external',
    define: { 'import.meta.env': '{"DEV":false}' },
    logLevel: 'silent',
    plugins: [
      {
        name: 'overrides',
        setup(b) {
          b.onLoad({ filter: /\.ts$/ }, (args) => {
            const rel = relative(root, args.path).replace(/\\/g, '/');
            return overrides[rel] === undefined ? undefined : { contents: overrides[rel], loader: 'ts' };
          });
        },
      },
    ],
  });
  return import(pathToFileURL(outfile).href);
}

const PAGE_FILES = [
  'extension/generic/managed-target-eligibility.js',
  'extension/generic/locator-determinism.js',
  'extension/generic/page-structure-inspect.js',
  'extension/generic/visual-target-pick.js',
];

function loadDom(sources, html) {
  const origin = 'https://fixture.example.test';
  const { window } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  Object.defineProperty(window, 'location', { value: { href: `${origin}/`, origin, protocol: 'https:' }, configurable: true });
  window.top = window;
  window.innerWidth = 1024;
  window.innerHeight = 768;
  const hidden = (el) => /display:\s*none|visibility:\s*hidden/i.test(el?.getAttribute?.('style') || '');
  window.getComputedStyle = (el) => {
    const style = el?.getAttribute?.('style') || '';
    return {
      display: /display:\s*none/i.test(style) ? 'none' : 'block',
      visibility: /visibility:\s*hidden/i.test(style) ? 'hidden' : 'visible',
      opacity: '1',
      pointerEvents: 'auto',
    };
  };
  const Proto = window.HTMLElement.prototype;
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    for (let n = this; n && n.nodeType === 1; n = n.parentElement) {
      if (hidden(n)) return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 };
    }
    return { width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100 };
  };
  Proto.getClientRects = function getClientRects() {
    const r = this.getBoundingClientRect();
    return r.width > 0 ? [r] : [];
  };
  globalThis.CSS = { escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  for (const rel of PAGE_FILES) {
    new Function('window', 'document', 'globalThis', 'CSS', `${sources[rel]}\n//# sourceURL=${rel}`)(window, window.document, window, globalThis.CSS);
  }
  return window;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ACC_TOGGLES = `
  <button id="acc-toggle" aria-haspopup="dialog" aria-expanded="false" aria-label="נגיש בקליק"><span class="icon"></span></button>
  <button id="acc-menu" data-toggle="modal" data-target="#accPanel">תפריט נגישות</button>
  <a id="acc-en" href="/a11y" aria-controls="a11yPanel" title="Accessibility options"><span></span></a>
  <div id="accPanel" style="display:none"></div>`;

const FIXTURES = [
  {
    name: 'HTZone (plain login control, no login word)',
    html: `${ACC_TOGGLES}<a id="user-icon" href="/account"><span class="icon-user"></span></a><button id="deals">מבצעים</button>`,
    first: 'user-icon',
  },
  {
    name: 'HTZone (login control with login word)',
    html: `${ACC_TOGGLES}<button id="login-btn">התחברות</button><button id="deals">מבצעים</button>`,
    first: 'login-btn',
  },
  {
    name: 'El Al (visible «התחברות» + plugin aria-label «…לנגיש…»)',
    html: `${ACC_TOGGLES}<button id="elal-login" aria-label="על מנת להפוך את האתר לנגיש לקורא מסך לחץ alt + 1. התחברות לאזור האישי">התחברות</button><button id="flights">טיסות</button>`,
    first: 'elal-login',
  },
  {
    name: 'Super-Pharm (#loginAnchor)',
    html: `${ACC_TOGGLES}<button id="deals">מבצעים</button><a id="loginAnchor" href="#" data-toggle="modal" data-target="#loginModal" aria-label="התחברות">התחברות</a><div id="loginModal" style="display:none"></div>`,
    first: 'loginAnchor',
  },
  {
    name: 'PAGI (skip link + popup opener)',
    html: `<a href="#main" aria-label="דלג לכניסה לתוכן">דלג</a>${ACC_TOGGLES}<button id="open-login" data-toggle="modal" data-target="#lm">כניסה</button><main id="main">תוכן</main><div id="lm" style="display:none"></div>`,
    first: 'open-login',
    noSkipLink: true,
  },
  {
    name: 'Mizrahi (#logInBtn)',
    html: `${ACC_TOGGLES}<button id="st-search">חיפוש</button><button id="logInBtn" class="btn">כניסה</button>`,
    first: 'logInBtn',
  },
];

// ─── Checks ───────────────────────────────────────────────────────────────────
function checkVocabulary(c) {
  const { intent } = c;
  const I = (t) => intent.actionIntent([t]);
  for (const t of ['נגישות', 'תפריט נגישות', 'נגיש בקליק', 'לנגישות', 'Accessibility', 'accessible menu']) {
    assert(I(t).negative, `V1 accessibility word is negative: ${t}`);
  }
  assert(!I('Inaccessible').negative && !I('נגישה').negative, 'V1 whole words only');
  const elAl = I('על מנת להפוך את האתר לנגיש לקורא מסך לחץ alt + 1.');
  assert(elAl.negative && !elAl.login, 'fixture: El Al aria-label alone is negative (no login word)');
  assert(intent.actionIntent(['התחברות', 'על מנת להפוך את האתר לנגיש לקורא מסך לחץ alt + 1.']).login, 'V1 El Al texts keep login intent');
}

function checkParity(c) {
  const w = loadDom(c.pageSources, '<div></div>');
  const ext = w.__pageStructureInspectHelpers;
  assert(JSON.stringify(ext.ACTION_INTENT_VOCABULARY) === JSON.stringify(c.intent.ACTION_INTENT_VOCABULARY), 'V2 vocabulary parity: extension copy === Hub vocabulary');
  for (const word of ['נגישות', 'נגיש', 'accessibility', 'accessible']) {
    assert(ext.ACTION_INTENT_VOCABULARY.negative.includes(word) && c.intent.ACTION_INTENT_VOCABULARY.negative.includes(word), `V2 «${word}» on both sides`);
  }
  for (const s of ['נגיש בקליק', 'Accessibility', 'התחברות נגישות']) {
    const hub = c.intent.actionIntent([s]);
    const expected = hub.login ? 1 : hub.negative ? 4 : 3;
    assert(ext.actionRankTier([s], false) === expected, `V2 tier parity: ${s}`);
  }
  assert(ext.actionRankTier(['נגיש בקליק'], true) === 4, 'V2 extension: accessibility toggle with popup semantics → negative tier');
  assert(ext.actionRankTier(['התחברות', 'לנגיש'], true) === 0, 'V2 extension: login word never demoted (R-a)');
}

function checkFixtures(c) {
  for (const fx of FIXTURES) {
    const w = loadDom(c.pageSources, fx.html);
    const out = w.collectSpecialAuthoringActionCandidates();
    assert(out.length > 0, `fixture: ${fx.name} collects candidates`);
    assert(out[0].locator.includes(fx.first), `${fx.name}: collector ranks #${fx.first} first (got ${out.map((a) => a.locator).join(', ')})`);
    const acc = out.filter((a) => /acc-/.test(a.locator));
    assert(acc.length === 3, `fixture: ${fx.name} collects the 3 accessibility toggles`);
    const lastPlain = out.findIndex((a) => /acc-/.test(a.locator));
    assert(out.slice(lastPlain).every((a) => /acc-|search/.test(a.locator)), `${fx.name}: accessibility toggles ranked with the negatives, after every other control`);
    if (fx.noSkipLink) assert(!out.some((a) => /#main/.test(a.locator) || a.visibleText === 'דלג'), `${fx.name}: skip link excluded`);
    const proposals = c.routing.proposeSpecialActionCandidates({ pattern: 'FLOATING_SCREEN', actionCandidates: out, maxProposals: 40 });
    assert(proposals[0].actionCandidateId === out[0].actionCandidateId, `${fx.name}: Analyze proposes #${fx.first} first (got ${proposals[0]?.action.locator})`);
    for (const p of proposals.filter((x) => /acc-/.test(x.action.locator))) {
      assert(p.confidence === 'low' && p.evidenceNote === 'special_routing_negative_intent', `${fx.name}: accessibility proposal demoted (low / negative) — ${p.action.locator}`);
    }
  }
}

function checkHubOnly(c) {
  const obs = (id, fields) => ({ actionCandidateId: id, tagName: 'button', locator: `#${id}`, locatorType: 'css', matchCount: 1, label: fields.visibleText || fields.ariaLabel || `#${id}`, ...fields });
  const f = c.routing.proposeSpecialActionCandidates({
    pattern: 'FLOATING_SCREEN',
    actionCandidates: [
      obs('acc', { ariaLabel: 'נגיש בקליק', popupSemantics: true }),
      obs('plain', { visibleText: '' , ariaLabel: '' }),
      obs('elal', { visibleText: 'התחברות', ariaLabel: 'על מנת להפוך את האתר לנגיש לקורא מסך לחץ alt + 1.' }),
    ],
  });
  const ids = f.map((p) => p.actionCandidateId);
  assert(ids[0] === 'elal' && f[0].confidence === 'high', `H1 Hub: login word + «לנגיש» stays first, high (R-a) — ${ids}`);
  assert(ids.indexOf('plain') < ids.indexOf('acc'), `H1 Hub: plain control above the accessibility popup toggle — ${ids}`);
}

function checkScope() {
  const intentSrc = read('src/assistedMapping/specialActionIntent.ts');
  assert(!/hostname|serviceId|htzone|elal|nagish/i.test(intentSrc.replace(/'נגיש(ות)?'/g, '')), 'S1 no site / host / serviceId branches');
  const editor = read('src/admin/SpecialLoginDraftEditor.tsx');
  const visual = editor.slice(editor.indexOf('async function visualPickAction'), editor.indexOf('async function visualPickField'));
  assert(!visual.includes('actionIntent') && !visual.includes('proposeSpecialActionCandidates'), 'S2 manual pick unrestricted (no intent scoring)');
  for (const rel of ['src/loginContract/specialDraftAuthoring.ts', 'src/loginContract/planActivate.ts', 'src/loginContract/resolve.ts', 'src/execution/specialLoginFlow.ts']) {
    assert(!read(rel).includes('actionIntent'), `S3 ${rel}: saved / ACTIVE plans never re-scored`);
  }
}

async function load(overrides = {}) {
  return {
    routing: await loadModule('src/assistedMapping/specialAnalyzeRouting.ts', 'routing', overrides.hub ?? {}),
    intent: await loadModule('src/assistedMapping/specialActionIntent.ts', 'intent', overrides.hub ?? {}),
    pageSources: { ...Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(rel)])), ...(overrides.page ?? {}) },
  };
}
function runAll(c) {
  checkVocabulary(c);
  checkParity(c);
  checkFixtures(c);
  checkHubOnly(c);
  checkScope();
}

console.log('Phase 121 D-121-57 — accessibility controls are never proposed first\n');
runAll(await load());
console.log('  ✓ V1 — «נגישות» / «נגיש» / accessibility / accessible are negative (whole word, Hebrew prefix); El Al texts keep login intent');
console.log('  ✓ V2 — extension ↔ Hub vocabulary + tier parity; popup accessibility toggle → negative tier; login word never demoted');
for (const fx of FIXTURES) console.log(`  ✓ F — ${fx.name}: #${fx.first} proposed first; accessibility toggles demoted`);
console.log('  ✓ H1 — Hub alone: El Al login first (high), plain above the accessibility popup');
console.log('  ✓ S1–S3 — no site branches; manual pick unrestricted; saved / ACTIVE never re-scored');

console.log('\nMutations');
const HUB = 'src/assistedMapping/specialActionIntent.ts';
const ROUTING = 'src/assistedMapping/specialAnalyzeRouting.ts';
const PSI = 'extension/generic/page-structure-inspect.js';
const hubNeg = "    'register',\n    'נגישות',\n    'נגיש',\n    'accessibility',\n    'accessible',\n";
const psiNeg = "      'register',\n      'נגישות',\n      'נגיש',\n      'accessibility',\n      'accessible',\n";
const MUT = [
  ['M1 «נגיש» missing in the extension copy (parity)', { page: { [PSI]: replaceOnce(read(PSI), "      'נגיש',\n", '', 'M1') } }],
  ['M2 «accessibility» missing in the Hub (parity)', { hub: { [HUB]: replaceOnce(read(HUB), "    'accessibility',\n", '', 'M2') } }],
  ['M3 Hub: login demoted by the new words', { hub: { [ROUTING]: replaceOnce(read(ROUTING), '  if (intent.login) {\n    return popup', '  if (intent.login && !intent.negative) {\n    return popup', 'M3') } }],
  ['M4 extension: negative checked before login', { page: { [PSI]: replaceOnce(read(PSI), '    if (intentAny(texts, ACTION_INTENT_VOCABULARY.login)) return popupSemantics ? 0 : 1;\n    if (intentAny(texts, ACTION_INTENT_VOCABULARY.negative)) return 4;', '    if (intentAny(texts, ACTION_INTENT_VOCABULARY.negative)) return 4;\n    if (intentAny(texts, ACTION_INTENT_VOCABULARY.login)) return popupSemantics ? 0 : 1;', 'M4') } }],
  ['M5 accessibility toggle not demoted (words removed on both sides)', {
    hub: { [HUB]: replaceOnce(read(HUB), hubNeg, "    'register',\n", 'M5 hub') },
    page: { [PSI]: replaceOnce(read(PSI), psiNeg, "      'register',\n", 'M5 psi') },
  }],
];
for (const [label, overrides] of MUT) {
  let caught = null;
  try {
    runAll(await load(overrides));
  } catch (e) {
    caught = e instanceof Error ? e.message : String(e);
  }
  assert(caught, `mutation NOT caught: ${label}`);
  assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  console.log(`  ✓ mutation caught: ${label} — ${caught}`);
}
console.log(`\nPASS — D-121-57 verify: 2 vocabulary + ${FIXTURES.length} fixtures + Hub + 3 scope checks, ${MUT.length} mutations caught`);
process.exit(0);
