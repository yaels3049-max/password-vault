/**
 * D-121-52 — the exact page-structure-inspect.js edits (inspect readiness waits for
 * eligible inputs), as [new, old] pairs on LF-normalized text. Reverting them must
 * reproduce the pre-slice bytes, which proves nothing else in the inspect script changed.
 */
export const D12152_READINESS_EDITS = [
  [
    `  /**
   * D-121-52: counts only (no values). The page is settled for inspect when at least one
   * input is Managed-eligible and no observed-visible input is still Managed-ineligible
   * (e.g. inputs rendered under a boot overlay / transition on SPA login pages).
   */
  function inspectReadinessCounts(inputs) {
    var eligible = 0;
    var visibleIneligible = 0;
    var list = Array.isArray(inputs) ? inputs : [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].managedEligible === true) eligible += 1;
      else if (list[i].visible === true) visibleIneligible += 1;
    }
    return { eligibleInputs: eligible, visibleIneligibleInputs: visibleIneligible };
  }

  /**
   * Bounded poll/observe until eligible top-doc inputs appear or timeout.
   * Early-exits on the first poll where inspectReadinessCounts reports ≥1 eligible input
   * and 0 visible-ineligible inputs; on timeout returns the last snapshot.
`,
    `  /**
   * Bounded poll/observe until eligible top-doc inputs appear or timeout.
   * Early-exits on first non-empty collectSafePageStructure().inputs.
`,
  ],
  [
    `      var counts = inspectReadinessCounts(page.inputs);

      if (counts.eligibleInputs > 0 && counts.visibleIneligibleInputs === 0) {
`,
    `      var eligibleCount = Array.isArray(page.inputs) ? page.inputs.length : 0;

      if (eligibleCount > 0) {
`,
  ],
  [
    `            earlyExit: true,
            timedOut: false,
            eligibleInputs: counts.eligibleInputs,
            visibleIneligibleInputs: counts.visibleIneligibleInputs,
`,
    `            earlyExit: true,
            timedOut: false,
`,
  ],
  [
    `            earlyExit: false,
            timedOut: true,
            eligibleInputs: counts.eligibleInputs,
            visibleIneligibleInputs: counts.visibleIneligibleInputs,
`,
    `            earlyExit: false,
            timedOut: true,
`,
  ],
];

/** Revert the D-121-52 edits (input LF-normalized); throws unless each edit is present exactly once. */
export function revertD12152ReadinessEdits(src) {
  let out = src.replace(/\r\n/g, '\n');
  for (const [next, prev] of D12152_READINESS_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-52 readiness edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
