/**
 * D-121-63 — the exact background.js edits outside the SPECIAL runtime block (button readiness
 * into an action-only step; authoring reveal "actions_only"), as [new, old] pairs.
 * Revert these first (innermost): they sit next to D-121-47 / D-121-60 / D-121-61 text.
 */
export const D12163_BACKGROUND_EDITS = [
  [
    `/**
 * D-121-63 D — eligible action candidates from the Analyze vocabulary (login / popup tiers;
 * plain and negative excluded) across top + visible depth-1 HTTPS frames. Locators only.
 * Discovery calls are bounded like the reveal snapshot; a frame that does not answer is skipped.
 */
function collectSpecialRevealActions(tabId, allowedOrigin, cb) {
  enumerateSpecialAuthoringFrames(tabId, allowedOrigin, function (en) {
    if (!en.ok) {
      cb({ ok: false, reason: en.reason });
      return;
    }
    var targets = en.records.filter(function (r) {
      return r.status === 'top' || (r.visible && r.status === 'depth1_https');
    });
    var entries = [];
    var skipped = {};
    var pending = targets.length;
    if (pending === 0) {
      cb({ ok: true, entries: entries, skipped: skipped });
      return;
    }
    targets.forEach(function (record) {
      specialInjectThenRun(
        tabId,
        record.frameId,
        SPECIAL_INSPECT_FILES,
        {
          func: function (expectedOrigin) {
            if (String(location.origin || '') !== expectedOrigin) return [];
            var helpers = window.__pageStructureInspectHelpers;
            if (
              typeof collectSpecialAuthoringActionCandidates !== 'function' ||
              !helpers ||
              typeof helpers.actionRankTier !== 'function'
            ) {
              return [];
            }
            return collectSpecialAuthoringActionCandidates({ stableLocators: true })
              .filter(function (c) {
                return (
                  c.matchCount === 1 &&
                  helpers.actionRankTier([c.visibleText, c.ariaLabel, c.title], c.popupSemantics === true) <= 2
                );
              })
              .map(function (c) {
                return c.locator;
              });
          },
          args: [record.frameId === 0 ? allowedOrigin : record.origin],
        },
        function (locators) {
          var descriptor = specialFrameDescriptorOf(record);
          if (locators && locators.timedOut === true) skipped[specialFrameKeyOf(descriptor)] = true;
          if (Array.isArray(locators)) {
            locators.forEach(function (loc) {
              if (typeof loc === 'string' && loc) {
                entries.push({ key: specialFrameKeyOf(descriptor) + '::' + loc, frame: descriptor, locator: loc });
              }
            });
          }
          pending -= 1;
          if (pending === 0) cb({ ok: true, entries: entries, skipped: skipped });
        },
        true,
      );
    });
  }, { bounded: true });
}

/**
 * D-121-63 D — the tested button is no longer exact-one eligible in its document (missing,
 * duplicated, or not visible / interactable). Anything unknown → not gone (fail closed).
 */
function specialAuthoringActionGone(tabId, allowedOrigin, locator, frame, cb) {
  function checkIn(frameId, expectedOrigin) {
    specialInjectThenRun(
      tabId,
      frameId,
      SPECIAL_INSPECT_FILES,
      {
        func: function (actionLocator, origin) {
          if (String(location.origin || '') !== origin) return { gone: false };
          var matches;
          try {
            matches = document.querySelectorAll(actionLocator);
          } catch (_err) {
            return { gone: false };
          }
          if (matches.length !== 1) return { gone: true };
          var eligibility = window.ManagedTargetEligibility;
          if (!eligibility || typeof eligibility.isVisible !== 'function') return { gone: false };
          return { gone: eligibility.isVisible(matches[0]) !== true };
        },
        args: [locator, expectedOrigin],
      },
      function (r) {
        cb(Boolean(r && r.gone === true));
      },
      true,
    );
  }
  if (!frame) {
    checkIn(0, allowedOrigin);
    return;
  }
  resolveDeclaredFrame(tabId, allowedOrigin, frame, function (resolved) {
    if (!resolved.ok) {
      cb(resolved.reason === 'frame_missing');
      return;
    }
    checkIn(resolved.frameId, frame.frameOrigin);
  }, { bounded: true });
}

function specialDeclaredReadinessMet(tabId, allowedOrigin, readiness, cb) {
  function checkIn(frameId, expectedOrigin) {
    specialInjectThenRun(
      tabId,
      frameId,
      SPECIAL_INSPECT_FILES,
      {
        func: function (origin, locator, target) {`,
    `function specialDeclaredReadinessMet(tabId, allowedOrigin, readiness, cb) {
  function checkIn(frameId, expectedOrigin) {
    specialInjectThenRun(
      tabId,
      frameId,
      SPECIAL_INSPECT_FILES,
      {
        func: function (origin, locator) {`,
  ],
  [
    `          // D-121-63 B: readiness into an action-only step = its exit: exact-one + visible / interactable.
          if (target === 'action') {
            var matches;
            try {
              matches = document.querySelectorAll(locator);
            } catch (_err) {
              return { met: false };
            }
            var eligibility = window.ManagedTargetEligibility;
            return {
              met:
                matches.length === 1 &&
                Boolean(eligibility) &&
                typeof eligibility.isVisible === 'function' &&
                eligibility.isVisible(matches[0]) === true,
            };
          }
          return {
            met:
              typeof isSpecialDeclaredReadinessMet === 'function'
                ? isSpecialDeclaredReadinessMet(locator) === true
                : false,
          };
        },
        args: [expectedOrigin, readiness.locator, readiness.target === 'action' ? 'action' : 'field'],
      },`,
    `          return {
            met:
              typeof isSpecialDeclaredReadinessMet === 'function'
                ? isSpecialDeclaredReadinessMet(locator) === true
                : false,
          };
        },
        args: [expectedOrigin, readiness.locator],
      },`,
  ],
  [
    `  // D-121-63 D: a multi-step transition test (reveal mode) may end on a screen with actions only.
  var allowActionsOnly =
    readinessMode === 'reveal' && !requirePasswordSurface && message.allowActionsOnly === true;
  // D-121-63 B: declared readiness into an action-only step names a button, not a field.
  var readinessTarget = message.readinessTarget === 'action' ? 'action' : 'field';
  var readiness =
    message.readiness && typeof message.readiness === 'object' ? message.readiness : null;`,
    `  var readiness =
    message.readiness && typeof message.readiness === 'object' ? message.readiness : null;`,
  ],
  [
    `          { locator: readinessLocator, frame: readinessFrame, target: readinessTarget },`,
    `          { locator: readinessLocator, frame: readinessFrame },`,
  ],
  [
    `      // D-121-63 D: eligible vocabulary actions before the click (null = not collected → never actions_only).
      var actionsBefore = null;
      var actionsOnlyTried = false;

      function collectRevealBefore(next, traceFn) {
        collectSpecialRevealSnapshot(tabId, allowedOrigin, function (pre) {
          if (!allowActionsOnly || !pre.ok) {
            next(pre);
            return;
          }
          collectSpecialRevealActions(tabId, allowedOrigin, function (acts) {
            if (acts.ok) {
              actionsBefore = { keys: {}, skipped: acts.skipped || {} };
              acts.entries.forEach(function (e) {
                actionsBefore.keys[e.key] = true;
              });
            }
            next(pre);
          });
        }, traceFn);
      }

      /**
       * No fresh credential input by the deadline: success as actions_only only when the tested
       * button is gone AND a vocabulary action that was not eligible before the click appeared.
       */
      function revealActionsOnly(onFail) {
        if (!actionsBefore) {
          onFail();
          return;
        }
        collectSpecialRevealActions(tabId, allowedOrigin, function (after) {
          var fresh = after.ok
            ? after.entries.filter(function (e) {
                return !actionsBefore.keys[e.key] && !actionsBefore.skipped[specialFrameKeyOf(e.frame)];
              })
            : [];
          trace('actions_only', { ok: after.ok === true, fresh: fresh.length });
          if (fresh.length === 0) {
            onFail();
            return;
          }
          specialAuthoringActionGone(tabId, allowedOrigin, locator, clickFrame, function (gone) {
            trace('tested_gone', { gone: gone });
            if (!gone) {
              onFail();
              return;
            }
            reply({
              ok: true,
              actionsOnly: true,
              revealed: { frameKey: specialFrameKeyOf(fresh[0].frame), frame: fresh[0].frame },
            });
          });
        });
      }

      var sawFreshNonPassword = false;
      // D-121-61:`,
    `      var sawFreshNonPassword = false;
      // D-121-61:`,
  ],
  [
    `          if (Date.now() >= deadline) {
            if (allowActionsOnly && !actionsOnlyTried) {
              actionsOnlyTried = true;
              revealActionsOnly(function () {
                pollReveal(before, deadline);
              });
              return;
            }
            if (sawFreshNonPassword) {`,
    `          if (Date.now() >= deadline) {
            if (sawFreshNonPassword) {`,
  ],
  [
    `        collectRevealBefore(function (pre) {
          if (!pre.ok) {`,
    `        collectSpecialRevealSnapshot(tabId, allowedOrigin, function (pre) {
          if (!pre.ok) {`,
  ],
];

/** Revert the D-121-63 background edits; throws unless each edit is present exactly once. */
export function revertD12163BackgroundEdits(src) {
  let out = src;
  for (const [next, prev] of D12163_BACKGROUND_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-63 background edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
