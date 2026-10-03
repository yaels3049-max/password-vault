/**
 * D-121-61 — the exact background.js edits (reveal reports a newly visible frame with no
 * exact-one locator: surface_frame_not_addressable), as [new, old] pairs. Revert these first
 * (before D-121-60 / D-121-48 / D-121-47: they sit inside those slices' new text).
 */
export const D12161_BACKGROUND_EDITS = [
  [
    `    var skipped = {};
    // D-121-61: visible depth-1 frames with no exact-one locator (frameIds never leave the extension).
    var unaddressable = {};
    en.records.forEach(function (r) {
      if (r.status === 'not_addressable' && r.visible && typeof r.frameId === 'number') unaddressable[r.frameId] = true;
    });
    var pending = targets.length;
`,
    `    var skipped = {};
    var pending = targets.length;
`,
  ],
  [
    `, skipped: Object.keys(skipped).length, unaddressable: Object.keys(unaddressable).length });
`,
    `, skipped: Object.keys(skipped).length });
`,
  ],
  [
    `            cb({ ok: true, entries: entries, skipped: skipped, unaddressable: unaddressable });
`,
    `            cb({ ok: true, entries: entries, skipped: skipped });
`,
  ],
  [
    `      var sawFreshNonPassword = false;
      // D-121-61: a visible depth-1 frame with no exact-one locator appeared after the click.
      var sawNewUnaddressable = false;
      var unaddressableBefore = {};
      function pollReveal(before, deadline) {
`,
    `      var sawFreshNonPassword = false;
      function pollReveal(before, deadline) {
`,
  ],
  [
    `          if (freshAll.some(function (e) { return e.password !== true; })) sawFreshNonPassword = true;
          if (Object.keys(snap.unaddressable || {}).some(function (id) { return !unaddressableBefore[id]; })) {
            sawNewUnaddressable = true;
          }
`,
    `          if (freshAll.some(function (e) { return e.password !== true; })) sawFreshNonPassword = true;
`,
  ],
  [
    `            if (sawNewUnaddressable) {
              reply({ ok: false, reason: 'surface_frame_not_addressable' });
              return;
            }
`,
    ``,
  ],
  [
    `          skippedBefore = pre.skipped || {};
          unaddressableBefore = pre.unaddressable || {};
`,
    `          skippedBefore = pre.skipped || {};
`,
  ],
];

/** Revert the D-121-61 background edits; throws unless each edit is present exactly once. */
export function revertD12161BackgroundEdits(src) {
  let out = src;
  for (const [next, prev] of D12161_BACKGROUND_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-61 background edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
