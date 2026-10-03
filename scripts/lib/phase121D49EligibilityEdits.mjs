/**
 * D-121-49 — the exact managed-target-eligibility.js edits (own-label hit rule), as
 * [new, old] pairs on LF-normalized text. Reverting them must reproduce the pre-slice
 * bytes, which proves nothing else in the shared eligibility contract changed.
 */
export const D12149_ELIGIBILITY_EDITS = [
  [
    `  var LABELABLE_SELECTOR = 'button, input:not([type="hidden"]), meter, output, progress, select, textarea';

  /**
   * D-121-49 — the label's labeled control: native HTMLLabelElement.control; DOMs
   * without it resolve per the HTML rule (for= id, else first labelable descendant).
   */
  function labelControlOf(label) {
    if (!label || String(label.tagName || '').toUpperCase() !== 'LABEL') {
      return null;
    }
    if (typeof label.control !== 'undefined') {
      return label.control || null;
    }
    var forId = typeof label.getAttribute === 'function' ? label.getAttribute('for') : null;
    if (forId !== null) {
      var doc = label.ownerDocument;
      var byId = doc && typeof doc.getElementById === 'function' ? doc.getElementById(forId) : null;
      return byId && typeof byId.matches === 'function' && byId.matches(LABELABLE_SELECTOR) ? byId : null;
    }
    return typeof label.querySelector === 'function' ? label.querySelector(LABELABLE_SELECTOR) : null;
  }

  /** D-121-49 — hit inside the target's own associated label (for= or nested). */
  function isInsideOwnLabel(hit, target) {
    if (!hit || typeof hit.closest !== 'function') {
      return false;
    }
    var label = hit.closest('label');
    return Boolean(label) && labelControlOf(label) === target;
  }

  /** Normative PASS: target | descendant of target | associated label | inside the target's own label. */
`,
    `  /** Normative PASS triad: target | descendant of target | associated label. */
`,
  ],
  [
    `    if (isAssociatedLabel(hit, target)) {
      return true;
    }
    if (isInsideOwnLabel(hit, target)) {
      return true;
    }
`,
    `    if (isAssociatedLabel(hit, target)) {
      return true;
    }
`,
  ],
  [
    `    classifyHitTest: classifyHitTest,
    labelControlOf: labelControlOf,
`,
    `    classifyHitTest: classifyHitTest,
`,
  ],
];

/** Revert the D-121-49 edits (input LF-normalized); throws unless each edit is present exactly once. */
export function revertD12149EligibilityEdits(src) {
  let out = src.replace(/\r\n/g, '\n');
  for (const [next, prev] of D12149_ELIGIBILITY_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-49 eligibility edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
