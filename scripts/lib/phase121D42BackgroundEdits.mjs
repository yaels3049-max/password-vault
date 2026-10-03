/**
 * D-121-42 — the exact background.js edits (STANDARD Visual pick lifecycle), as
 * [new, old] pairs. Reverting them must reproduce the pre-slice bytes, which proves
 * nothing else in background.js changed. Shared by the Phase 121 verifies.
 */
export const D12142_BACKGROUND_EDITS = [
  [
    `/**
 * D-121-42 — the one pending STANDARD Admin Visual pick (fresh Login Entry tab).
 * { allowedOrigin, tabId, armed, cancelled }; cleared when the session answers.
 */
var standardVisualPickSession = null;

/** D-121-42 — remove the armed STANDARD pick listener (frame 0; no-op if none). */
function disarmStandardVisualPick(tabId, reason, callback) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId, frameIds: [0] },
      world: 'MAIN',
      func: function (disarmReason) {
        if (typeof __disarmVisualTargetPick === 'function') {
          return __disarmVisualTargetPick(disarmReason) === true;
        }
        return false;
      },
      args: [reason],
    },
    function (results) {
      var failed = Boolean(chrome.runtime.lastError);
      var disarmed =
        !failed &&
        (results || []).some(function (r) {
          return r && r.result === true;
        });
      if (typeof callback === 'function') callback(disarmed, failed);
    },
  );
}

/**
 * Phase 119.2 Admin Visual Mapping — open Login Entry, arm top-doc click pick.
 * No credentials, no fill, no submit, no LLM. frameIds: [0] only.
 * D-121-42: bounded like SPECIAL (pickTimeoutMs, counted from this request);
 * cancellable (ADMIN_VISUAL_MAPPING_CANCEL); page listener disarmed on every exit.
 */
function openPageAndVisualMapping(message, sendResponse, sender) {
  var requestedAt = Date.now();
  var loginEntryUrl =`,
    `/**
 * Phase 119.2 Admin Visual Mapping — open Login Entry, arm top-doc click pick.
 * No credentials, no fill, no submit, no LLM. frameIds: [0] only.
 */
function openPageAndVisualMapping(message, sendResponse, sender) {
  var loginEntryUrl =`,
  ],
  [
    `    sendResponse({ ok: false, reason: 'missing_visual_mapping_payload' });
    return false;
  }
  var pickTimeoutMs =
    typeof message.pickTimeoutMs === 'number' && message.pickTimeoutMs > 0
      ? Math.min(message.pickTimeoutMs, SPECIAL_VISUAL_PICK_MAX_TIMEOUT_MS)
      : 0;

  var previous = standardVisualPickSession;
  if (previous) {
    previous.cancelled = true;
    if (previous.armed && typeof previous.tabId === 'number') {
      disarmStandardVisualPick(previous.tabId, 'visual_pick_superseded');
    }
  }
  var session = { allowedOrigin: allowedOrigin, tabId: null, armed: false, cancelled: false };
  standardVisualPickSession = session;

  function respondAndDisarm(result) {
    if (standardVisualPickSession === session) {
      standardVisualPickSession = null;
    }
    // Operation timeout / navigation abort / any early answer: never leave a listener armed.
    if (session.armed && typeof session.tabId === 'number') {
      disarmStandardVisualPick(session.tabId, 'visual_pick_cancelled');
    }
    sendResponse(result);
  }

  var visualOptions = {`,
    `    sendResponse({ ok: false, reason: 'missing_visual_mapping_payload' });
    return false;
  }

  var visualOptions = {`,
  ],
  [
    `    respondAndDisarm,
    'admin-visual-mapping',
    function (tabId, finishSession) {
      session.tabId = tabId;
`,
    `    sendResponse,
    'admin-visual-mapping',
    function (tabId, finishSession) {
`,
  ],
  [
    `          if (session.cancelled) {
            // Hub cancelled / gave up before the pick was armed: never arm.
            finishSession({ ok: false, reason: 'visual_pick_cancelled', fieldId: fieldId });
            return;
          }
          if (!navAbortArmed) {
            navAbortArmed = true;
            chrome.tabs.onUpdated.addListener(onNavAbort);
          }
          var boundMs = pickTimeoutMs
            ? Math.max(1000, pickTimeoutMs - (Date.now() - requestedAt))
            : 0;
          session.armed = true;
          chrome.scripting.executeScript(
            {
              target: { tabId: tabId, frameIds: [0] },
              world: 'MAIN',
              func: function (expectedOrigin, mappedFieldId, pickBoundMs) {
                if (typeof armVisualTargetPick !== 'function') {
                  return Promise.resolve({
                    ok: false,
                    reason: 'visual_pick_fn_missing',
                    fieldId: mappedFieldId,
                  });
                }
                var pickOptions = {
                  expectedOrigin: expectedOrigin,
                  fieldId: mappedFieldId,
                };
                if (pickBoundMs > 0) pickOptions.timeoutMs = pickBoundMs;
                return armVisualTargetPick(pickOptions);
              },
              args: [allowedOrigin, fieldId, boundMs],
            },
            function (results) {
              // The page pick settled (click / timeout / disarm): its listener is already removed.
              session.armed = false;
              chrome.tabs.onUpdated.removeListener(onNavAbort);`,
    `          if (!navAbortArmed) {
            navAbortArmed = true;
            chrome.tabs.onUpdated.addListener(onNavAbort);
          }
          chrome.scripting.executeScript(
            {
              target: { tabId: tabId, frameIds: [0] },
              world: 'MAIN',
              func: function (expectedOrigin, mappedFieldId) {
                if (typeof armVisualTargetPick !== 'function') {
                  return Promise.resolve({
                    ok: false,
                    reason: 'visual_pick_fn_missing',
                    fieldId: mappedFieldId,
                  });
                }
                return armVisualTargetPick({
                  expectedOrigin: expectedOrigin,
                  fieldId: mappedFieldId,
                });
              },
              args: [allowedOrigin, fieldId],
            },
            function (results) {
              chrome.tabs.onUpdated.removeListener(onNavAbort);`,
  ],
  [
    `/**
 * D-121-42 — cancel the pending STANDARD Visual pick (origin fail-closed).
 * Not yet armed → arming is skipped; armed → page listener disarmed (frame 0).
 * The pending START answers visual_pick_cancelled; no mapping is produced.
 */
function cancelStandardVisualMapping(message, sendResponse) {
  var allowedOrigin =
    message && typeof message.allowedOrigin === 'string'
      ? message.allowedOrigin.trim()
      : '';
  if (!allowedOrigin) {
    sendResponse({ ok: false, disarmed: false, reason: 'missing_cancel_payload' });
    return false;
  }
  var session = standardVisualPickSession;
  if (!session || session.allowedOrigin !== allowedOrigin) {
    sendResponse({ ok: true, disarmed: false, reason: 'no_armed_pick' });
    return false;
  }
  session.cancelled = true;
  if (!session.armed || typeof session.tabId !== 'number') {
    sendResponse({ ok: true, disarmed: false, reason: 'cancelled_before_arm' });
    return false;
  }
  var tabId = session.tabId;
  chrome.tabs.get(tabId, function (tab) {
    if (chrome.runtime.lastError || !tab || typeof tab.url !== 'string') {
      sendResponse({ ok: true, disarmed: false, reason: 'tab_unavailable' });
      return;
    }
    try {
      if (new URL(tab.url).origin !== allowedOrigin) {
        sendResponse({ ok: false, disarmed: false, reason: 'origin_mismatch' });
        return;
      }
    } catch (_err) {
      sendResponse({ ok: false, disarmed: false, reason: 'origin_mismatch' });
      return;
    }
    disarmStandardVisualPick(tabId, 'visual_pick_cancelled', function (disarmed, failed) {
      sendResponse(
        failed
          ? { ok: false, disarmed: false, reason: 'visual_pick_cancel_failed' }
          : { ok: true, disarmed: disarmed },
      );
    });
  });
  return true;
}

/**
 * Phase 118 Admin inspect`,
    `/**
 * Phase 118 Admin inspect`,
  ],
  [
    `    openPageAndVisualMapping(message, sendResponse, sender);
    return true;
  }

  /**
   * D-121-42 — cancel the pending STANDARD Visual pick (no mapping written).
   */
  if (message.type === 'ADMIN_VISUAL_MAPPING_CANCEL') {
    return cancelStandardVisualMapping(message, sendResponse);
  }
`,
    `    openPageAndVisualMapping(message, sendResponse, sender);
    return true;
  }
`,
  ],
];

/** Revert the D-121-42 edits; throws unless each edit is present exactly once. */
export function revertD12142BackgroundEdits(src) {
  let out = src;
  for (const [next, prev] of D12142_BACKGROUND_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-42 background edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
