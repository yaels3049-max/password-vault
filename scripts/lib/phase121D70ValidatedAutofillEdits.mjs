/**
 * D-121-70 — the exact validated-autofill.js edit (skipPostRuntimeObserve skips A2.4), as
 * [new, old] pairs on LF-normalized text. Reverting them must reproduce the pre-slice bytes.
 */
export const D12170_VALIDATED_AUTOFILL_EDITS = [
  [
    `    // A2.4 (admin_test / digital_home diagnostic paths only) chains after A2.3.
    // D-121-70: skipped for a SPECIAL step with an exit — its transition waits for this result.
    var skipA24 = Boolean(options && options.skipPostRuntimeObserve === true);
    return observePostVerifyAsync(bag, filledTrail, outcome).then(function () {
      var runA24 = (bag.path === 'admin_test' || bag.path === 'digital_home') && !skipA24;
`,
    `    // A2.4 (admin_test / digital_home diagnostic paths only) chains after A2.3.
    return observePostVerifyAsync(bag, filledTrail, outcome).then(function () {
      var runA24 = bag.path === 'admin_test' || bag.path === 'digital_home';
`,
  ],
];

/** Revert the D-121-70 edit (input LF-normalized); throws unless it is present exactly once. */
export function revertD12170ValidatedAutofillEdits(src) {
  let out = src.replace(/\r\n/g, '\n');
  for (const [next, prev] of D12170_VALIDATED_AUTOFILL_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-70 validated-autofill edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
