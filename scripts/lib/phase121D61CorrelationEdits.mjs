/**
 * D-121-61 — the exact frame-correlation.js edits (src-prefix + anchored structural frame
 * locator candidates after id / name / title / aria-label), as [new, old] pairs. Reverting them
 * must reproduce the pinned pre-slice bytes. Shared by the Phase 121 verifies.
 */
export const D12161_CORRELATION_EDITS = [
  [
    `  /**
   * D-121-61 — \`iframe[src^="<origin><path>"]\` (query / hash dropped) for an HTTPS src
   * attribute written as an absolute URL; null otherwise. Kept only if exact-one (caller).
   */
  function srcPrefixLocator(el) {
    var raw = el.getAttribute('src');
    if (typeof raw !== 'string' || !/^https:\\/\\//i.test(raw.trim())) return null;
    var url;
    try {
      url = new URL(raw.trim());
    } catch (_err) {
      return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    var prefix = url.origin + url.pathname;
    if (raw.trim().indexOf(prefix) !== 0 || prefix.length > 300 || /[\\u0000-\\u001f|]/.test(prefix)) return null;
    return 'iframe[src^="' + quoteAttr(prefix) + '"]';
  }

  /**
   * Stable-attribute candidates (same spirit as field locators; never nth-child).
   * D-121-61: then the src prefix, then the D-121-48 anchored structural locator
   * (nearest stable ancestor + iframe; :nth-of-type only inside that ancestor).
   */
  function frameLocatorCandidates(el, doc) {
`,
    `  /** Stable-attribute candidates only (same spirit as field locators; never nth-child). */
  function frameLocatorCandidates(el) {
`,
  ],
  [
    `    push(srcPrefixLocator(el), 'src');
    var shared = global.LocatorDeterminism;
    if (doc && shared && typeof shared.anchoredStructuralCandidates === 'function') {
      var anchored = shared.anchoredStructuralCandidates(el, doc);
      if (anchored.length && anchored[0].locator.indexOf('|') < 0) push(anchored[0].locator, 'anchored');
    }
`,
    ``,
  ],
  [
    `    var candidates = frameLocatorCandidates(el, doc);
`,
    `    var candidates = frameLocatorCandidates(el);
`,
  ],
];

/** Revert the D-121-61 frame-correlation edits; throws unless each edit is present exactly once. */
export function revertD12161CorrelationEdits(src) {
  let out = src;
  for (const [next, prev] of D12161_CORRELATION_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-61 frame-correlation edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
