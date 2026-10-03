/**
 * D-121-48 — the exact background.js edits (SPECIAL authoring passes stableLocators),
 * as [new, old] pairs. Reverting them must reproduce the pre-slice bytes, which proves
 * nothing else in background.js changed. Shared by the Phase 121 verifies.
 */
export const D12148_BACKGROUND_EDITS = [
  [
    `                pollIntervalMs: pollIntervalMs,
                stableLocators: true,
              }).then(function (result) {
                var actions =
                  typeof collectSpecialAuthoringActionCandidates === 'function'
                    ? collectSpecialAuthoringActionCandidates({ stableLocators: true })
                    : [];
`,
    `                pollIntervalMs: pollIntervalMs,
              }).then(function (result) {
                var actions =
                  typeof collectSpecialAuthoringActionCandidates === 'function'
                    ? collectSpecialAuthoringActionCandidates()
                    : [];
`,
  ],
  [
    `                  mode: pickMode,
                  pickTarget: targetKind,
                  stableLocators: true,
                });
`,
    `                  mode: pickMode,
                  pickTarget: targetKind,
                });
`,
  ],
];

/** Revert the D-121-48 edits; throws unless each edit is present exactly once. */
export function revertD12148BackgroundEdits(src) {
  let out = src;
  for (const [next, prev] of D12148_BACKGROUND_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-48 background edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
