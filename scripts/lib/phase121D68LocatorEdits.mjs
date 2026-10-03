/**
 * D-121-68 — the exact locator edits (digit-run id / name rule; the volatile filter and
 * the anchored fallback in every pattern), as [new, old] pairs on LF-normalized text.
 * Reverting them must reproduce the pre-slice bytes, which proves nothing else changed.
 */
const LD = 'extension/generic/locator-determinism.js';
const PSI = 'extension/generic/page-structure-inspect.js';
const VTP = 'extension/generic/visual-target-pick.js';

const BUILDER_TAIL = [
  `    if (volatileFilter && !volatileFilter.chooseDeterministicLocator(out, el, doc)) {
      volatileFilter.anchoredStructuralCandidates(el, doc).forEach(function (c) {
        push(c.locator, c.hint, true);
      });
    }
`,
  `    if (stable && !stable.chooseDeterministicLocator(out, el, doc)) {
      stable.anchoredStructuralCandidates(el, doc).forEach(function (c) {
        push(c.locator, c.hint);
      });
    }
`,
];

export const D12168_LOCATOR_EDITS = {
  [LD]: [
    [
      `  // ─── Phase 121 D-121-48 / D-121-68 — never anchor on generated ids / names ──
  // The volatile-token filter and the anchored fallback apply in every authoring
  // candidate builder (all patterns). The other helpers here (shared aria-label,
  // form / test attrs, placeholder) are used only with { stableLocators: true }.
`,
      `  // ─── Phase 121 D-121-48 — SPECIAL authoring: never anchor on generated ids ──
  // Used only when a SPECIAL authoring path passes { stableLocators: true } to a
  // candidate builder. Without that option every builder keeps its legacy output.
`,
    ],
    [
      `  /** Per-load numbers (timestamps, random suffixes); ≤ 7 digits stays stable (step2, field_2024). */
  var VOLATILE_DIGIT_RUN = 8;

  function hasLongDigitRun(value) {
    var runs = String(value).match(/\\d+/g);
    if (!runs) return false;
    for (var i = 0; i < runs.length; i += 1) {
      if (runs[i].length >= VOLATILE_DIGIT_RUN) return true;
    }
    return false;
  }

  /** D-121-68: a name attribute carrying a per-load number is never a locator. */
  function isUnstableName(name) {
    return typeof name === 'string' && hasLongDigitRun(name);
  }
`,
      '',
    ],
    [
      `   * ember N, ext-gen N, UUID / long hex, a run of ≥ 8 digits, or a trailing
   * counter shared with same-shape ids in the document). Never a locator; still
   * identity evidence.
`,
      `   * ember N, ext-gen N, UUID / long hex, or a trailing counter shared with
   * same-shape ids in the document). Never a locator; still identity evidence.
`,
    ],
    [
      '    return hasLongHexRun(id) || hasLongDigitRun(id) || hasCounterSiblings(id, doc);\n',
      '    return hasLongHexRun(id) || hasCounterSiblings(id, doc);\n',
    ],
    [
      `  /**
   * True when the locator names an unstable id (#id, [for=…], [aria-controls=…], …)
   * or an unstable name ([name=…] with a per-load number).
   */
`,
      '  /** True when the locator names an unstable id (#id, [for=…], [aria-controls=…], …). */\n',
    ],
    [
      "      if (/^name$/i.test(m[1]) && isUnstableName(unescapeCss(m[2]))) return true;\n",
      '',
    ],
    [
      '   * Anchored structural locator (last fallback, all patterns): nearest stable ancestor\n',
      '   * Anchored structural locator (last SPECIAL fallback): nearest stable ancestor\n',
    ],
    ['    isUnstableName: isUnstableName,\n', ''],
  ],
  [PSI]: [
    [
      `    // D-121-68: volatile-token filter + anchored fallback in every pattern.
    var volatileFilter = global.LocatorDeterminism || null;
    // D-121-48: the other stable extras stay SPECIAL authoring only.
    var stable = opts && opts.stableLocators === true ? volatileFilter : null;
    if (stable) cap += STABLE_EXTRA_CANDIDATES;
    function push(locator, hint, uncapped) {
      if (!locator || (out.length >= cap && !uncapped)) return;
      if (out.some(function (c) { return c.locator === locator; })) return;
      if (volatileFilter && volatileFilter.locatorReferencesUnstableId(locator, doc)) return;
`,
      `    // D-121-48: SPECIAL authoring only; absent → legacy candidates, byte-for-byte.
    var stable = opts && opts.stableLocators === true ? global.LocatorDeterminism || null : null;
    if (stable) cap += STABLE_EXTRA_CANDIDATES;
    function push(locator, hint) {
      if (!locator || out.length >= cap) return;
      if (out.some(function (c) { return c.locator === locator; })) return;
      if (stable && stable.locatorReferencesUnstableId(locator, doc)) return;
`,
    ],
    BUILDER_TAIL,
  ],
  [VTP]: [
    [
      `    // D-121-68: volatile-token filter + anchored fallback in every pattern.
    var volatileFilter = global.LocatorDeterminism || null;
    // D-121-48: the other stable extras stay SPECIAL authoring only.
    var stable = opts && opts.stableLocators === true ? volatileFilter : null;
    var doc = el && el.ownerDocument ? el.ownerDocument : global.document;
    if (stable) cap += STABLE_EXTRA_CANDIDATES;
    function push(locator, hint, uncapped) {
      if (!locator || (out.length >= cap && !uncapped)) return;
`,
      `    // D-121-48: SPECIAL authoring only; absent → legacy candidates, byte-for-byte.
    var stable = opts && opts.stableLocators === true ? global.LocatorDeterminism || null : null;
    var doc = el && el.ownerDocument ? el.ownerDocument : global.document;
    if (stable) cap += STABLE_EXTRA_CANDIDATES;
    function push(locator, hint) {
      if (!locator || out.length >= cap) return;
`,
    ],
    [
      '      if (volatileFilter && volatileFilter.locatorReferencesUnstableId(locator, doc)) return;\n',
      '      if (stable && stable.locatorReferencesUnstableId(locator, doc)) return;\n',
    ],
    BUILDER_TAIL,
    [
      `    // D-121-48 (SPECIAL only): the stable extras. STANDARD passes no mode. The volatile
    // filter + anchored fallback (D-121-68) apply without it.
`,
      '    // D-121-48 (SPECIAL only): never anchor locators on generated ids. STANDARD passes no mode.\n',
    ],
  ],
};

/** Revert the D-121-68 edits of one file (input LF-normalized); throws unless each edit is present exactly once. */
export function revertD12168LocatorEdits(rel, src) {
  const edits = D12168_LOCATOR_EDITS[rel];
  if (!edits) throw new Error(`D-121-68: no edits recorded for ${rel}`);
  let out = src.replace(/\r\n/g, '\n');
  for (const [next, prev] of edits) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-68 locator edit present ${n}× in ${rel} (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
