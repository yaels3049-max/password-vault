/**
 * D-121-71 — the exact managed-target-eligibility.js (center + ≥3 points) and
 * visual-target-pick.js (single input under the click point) edits, as [new, old] pairs on
 * LF-normalized text. Reverting them must reproduce the pre-slice bytes.
 */
export const D12171_ELIGIBILITY_EDITS = [
  [
    `      // D-121-71: the center must be in view and hit the target, and at least 3 in-view
      // points must hit it (an overlay over an edge of the field does not block it).
      var center = points[0];
      if (!pointInViewport(center.x, center.y)) {
        return { ok: false, reason: 'not_interactable' };
      }
      var centerHit = doc.elementFromPoint(center.x, center.y);
      if (!hitRelationshipOk(centerHit, element)) {
        return {
          ok: false,
          reason: centerHit == null ? 'not_interactable' : 'occluded',
        };
      }

      var passed = 0;
      var missed = false;
      var missHit = null;
      for (var j = 0; j < inView.length; j += 1) {
        var hit = doc.elementFromPoint(inView[j].x, inView[j].y);
        if (hitRelationshipOk(hit, element)) {
          passed += 1;
        } else if (!missed) {
          missed = true;
          missHit = hit;
        }
      }
      if (passed >= 3) {
        return { ok: true };
      }
      return {
        ok: false,
        reason: missHit == null ? 'not_interactable' : 'occluded',
      };
    }
`,
    `      // Early fail if center is in-viewport and already fails.
      var center = points[0];
      if (pointInViewport(center.x, center.y)) {
        var centerHit = doc.elementFromPoint(center.x, center.y);
        if (!hitRelationshipOk(centerHit, element)) {
          return {
            ok: false,
            reason: centerHit == null ? 'not_interactable' : 'occluded',
          };
        }
      }

      for (var j = 0; j < inView.length; j += 1) {
        var hit = doc.elementFromPoint(inView[j].x, inView[j].y);
        if (!hitRelationshipOk(hit, element)) {
          return {
            ok: false,
            reason: hit == null ? 'not_interactable' : 'occluded',
          };
        }
      }
      return { ok: true };
    }
`,
  ],
];

export const D12171_VISUAL_PICK_EDITS = [
  [
    `  /**
   * D-121-71 — the single identifiable fillable INPUT under the click point, same document
   * (an element over part of a field takes the click). None or more than one → null.
   */
  function pointFillableControl(doc, event) {
    if (!doc || typeof doc.elementsFromPoint !== 'function' || !event) return null;
    if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return null;
    var stack = doc.elementsFromPoint(event.clientX, event.clientY) || [];
    var found = null;
    for (var i = 0; i < stack.length; i += 1) {
      var el = stack[i];
      if (!el || el === found || el.tagName !== 'INPUT' || !isIdentifiableControl(el)) continue;
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      if (FILLABLE_INPUT_TYPES.indexOf(type) < 0) continue;
      if (found) return null;
      found = el;
    }
    return found;
  }

  function managedEligibleFor(el) {
`,
    `  function managedEligibleFor(el) {
`,
  ],
  [
    `          el = labelFillableControl(el) || el;
        }
        if (!isIdentifiableControl(el)) {
          el = pointFillableControl(doc, event) || el;
        }
`,
    `          el = labelFillableControl(el) || el;
        }
`,
  ],
  [
    `    labelFillableControl: labelFillableControl,
    pointFillableControl: pointFillableControl,
`,
    `    labelFillableControl: labelFillableControl,
`,
  ],
];

function revertEdits(src, edits, label) {
  let out = src.replace(/\r\n/g, '\n');
  for (const [next, prev] of edits) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-71 ${label} edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}

/** Revert the D-121-71 eligibility edit (input LF-normalized); throws unless present exactly once. */
export function revertD12171EligibilityEdits(src) {
  return revertEdits(src, D12171_ELIGIBILITY_EDITS, 'eligibility');
}

/** Revert the D-121-71 visual-pick edits (input LF-normalized); throws unless each is present exactly once. */
export function revertD12171VisualPickEdits(src) {
  return revertEdits(src, D12171_VISUAL_PICK_EDITS, 'visual-pick');
}

/** Revert D-121-71 for a repo-relative path; other files pass through LF-normalized. */
export function revertD12171Edits(rel, src) {
  const p = rel.replace(/\\/g, '/');
  if (p.endsWith('managed-target-eligibility.js')) return revertD12171EligibilityEdits(src);
  if (p.endsWith('visual-target-pick.js')) return revertD12171VisualPickEdits(src);
  return src.replace(/\r\n/g, '\n');
}
