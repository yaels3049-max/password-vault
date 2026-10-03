/**
 * D-121-60 — the exact background.js edits (bounded authoring-click discovery + service-worker
 * trace), as [new, old] pairs. Reverting them must reproduce the pre-slice bytes, which proves
 * nothing else in background.js changed. Revert these before D-121-48 / D-121-47 (the pollReveal
 * filter edit sits inside D-121-47 "new" text). Shared by the Phase 121 verifies.
 */
export const D12160_BACKGROUND_EDITS = [
  [
    `var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;
/**
 * D-121-60 — bound for one executeScript callback in the authoring click's discovery
 * (frame probe, handshake steps, per-frame inspect, gesture watch). A frame that never
 * answers must not keep the approved click from running.
 */
var SPECIAL_AUTHORING_CALL_TIMEOUT_MS = 2500;

/**
 * executeScript → cb(results, errorMessage | null, timedOut). bounded: a callback that does
 * not arrive within SPECIAL_AUTHORING_CALL_TIMEOUT_MS yields ('authoring_call_timeout',
 * timedOut = true); a late callback is ignored. Unbounded: plain executeScript.
 */
function specialAuthoringExec(bounded, details, cb) {
  var done = false;
  var timer = bounded
    ? setTimeout(function () {
        if (done) return;
        done = true;
        cb(undefined, 'authoring_call_timeout', true);
      }, SPECIAL_AUTHORING_CALL_TIMEOUT_MS)
    : null;
  chrome.scripting.executeScript(details, function (results) {
    var err = chrome.runtime.lastError ? chrome.runtime.lastError.message || 'execute_failed' : null;
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    cb(results, err, false);
  });
}

/**
 * D-121-60 — authoring click trace in the service-worker console: stage, elapsed ms and
 * counts / reasons only (never locators, origins or values).
 */
function specialAuthoringTraceStart() {
  var t0 = Date.now();
  var id = specialGestureToken().slice(0, 6);
  return function (stage, detail) {
    try {
      console.info(
        '[D-121-60 authoring-click]',
        Object.assign({ id: id, t: Date.now() - t0, stage: stage }, detail || {}),
      );
    } catch (_e) {
      /* diagnostics only */
    }
  };
}
`,
    `var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;
`,
  ],
  [
    `function specialFrameNonceHandshake(tabId, send, cb) {
  var unavailable = { ok: false, reason: 'frame_correlation_unavailable' };
  // D-121-60: send.bounded → each step bounded; a timeout is a handshake failure (fail-closed).
  var bounded = send.bounded === true;
  var trace = typeof send.trace === 'function' ? send.trace : null;
  specialAuthoringExec(
    bounded,
    { target: { tabId: tabId, allFrames: true }, world: 'ISOLATED', files: SPECIAL_CORRELATION_FILES },
    function (_r, err, timedOut) {
      if (trace) trace('handshake_listeners', { ok: !err, timedOut: timedOut });
      if (err) {
        cb(unavailable);
        return;
      }
      specialAuthoringExec(
        bounded,
        {
          target: { tabId: tabId, frameIds: [0] },
          world: 'ISOLATED',
          func: send.func,
          args: send.args || [],
        },
        function (res, sendErr, sendTimedOut) {
          if (trace) trace('handshake_send', { ok: !sendErr, timedOut: sendTimedOut });
          if (sendErr) {
            cb(unavailable);
            return;
          }
          var sent = res && res[0] && res[0].result;
          if (!sent || sent.ok !== true) {
            cb(sent && sent.reason ? sent : unavailable);
            return;
          }
          var nonces = Array.isArray(sent.frames)
            ? sent.frames.map(function (f) {
                return f && f.nonce;
              })
            : [sent.nonce];
          setTimeout(function () {
            specialAuthoringExec(
              bounded,
              {
                target: { tabId: tabId, allFrames: true },
                world: 'ISOLATED',
                func: function (expected) {
                  return typeof __readFrameCorrelationNonces === 'function'
                    ? __readFrameCorrelationNonces(expected)
                    : [];
                },
                args: [nonces.filter(Boolean)],
              },
              function (receipts, readErr, readTimedOut) {
                if (trace) trace('handshake_read', { ok: !readErr, timedOut: readTimedOut, iframes: nonces.length });
                if (readErr) {
                  cb(unavailable);
                  return;
                }
                cb({ ok: true, sent: sent, matches: specialMatchFrameNonces(nonces, receipts) });
              },
            );
          }, SPECIAL_FRAME_HANDSHAKE_WAIT_MS);
        },
      );
    },
  );
}
`,
    `function specialFrameNonceHandshake(tabId, send, cb) {
  var unavailable = { ok: false, reason: 'frame_correlation_unavailable' };
  chrome.scripting.executeScript(
    { target: { tabId: tabId, allFrames: true }, world: 'ISOLATED', files: SPECIAL_CORRELATION_FILES },
    function () {
      if (chrome.runtime.lastError) {
        cb(unavailable);
        return;
      }
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId, frameIds: [0] },
          world: 'ISOLATED',
          func: send.func,
          args: send.args || [],
        },
        function (res) {
          if (chrome.runtime.lastError) {
            cb(unavailable);
            return;
          }
          var sent = res && res[0] && res[0].result;
          if (!sent || sent.ok !== true) {
            cb(sent && sent.reason ? sent : unavailable);
            return;
          }
          var nonces = Array.isArray(sent.frames)
            ? sent.frames.map(function (f) {
                return f && f.nonce;
              })
            : [sent.nonce];
          setTimeout(function () {
            chrome.scripting.executeScript(
              {
                target: { tabId: tabId, allFrames: true },
                world: 'ISOLATED',
                func: function (expected) {
                  return typeof __readFrameCorrelationNonces === 'function'
                    ? __readFrameCorrelationNonces(expected)
                    : [];
                },
                args: [nonces.filter(Boolean)],
              },
              function (receipts) {
                if (chrome.runtime.lastError) {
                  cb(unavailable);
                  return;
                }
                cb({ ok: true, sent: sent, matches: specialMatchFrameNonces(nonces, receipts) });
              },
            );
          }, SPECIAL_FRAME_HANDSHAKE_WAIT_MS);
        },
      );
    },
  );
}
`,
  ],
  [
    `function enumerateSpecialAuthoringFrames(tabId, allowedOrigin, cb, opts) {
  // D-121-60 (authoring click only): opts.bounded — an all-frames probe that does not answer
  // in time falls back to the top document; depth-1 frames are then skipped for discovery
  // (reported as correlation unavailable, never silent).
  var bounded = Boolean(opts && opts.bounded === true);
  var trace = opts && typeof opts.trace === 'function' ? opts.trace : null;
  var probeTimedOut = false;
  specialAuthoringExec(
    bounded,
    { target: { tabId: tabId, allFrames: true }, func: specialFrameProbe },
    function (allResults, allErr, allTimedOut) {
      if (trace) trace('frame_probe', { ok: !allErr, timedOut: allTimedOut, frames: (allResults || []).length });
      if (!allTimedOut) {
        onProbes(allResults, allErr);
        return;
      }
      probeTimedOut = true;
      specialAuthoringExec(
        bounded,
        { target: { tabId: tabId, frameIds: [0] }, func: specialFrameProbe },
        function (topResults, topErr, topTimedOut) {
          if (trace) trace('frame_probe_top_only', { ok: !topErr, timedOut: topTimedOut });
          onProbes(topResults, topErr);
        },
      );
    },
  );

  function onProbes(probeResults, probeErr) {
      if (probeErr) {
        cb({ ok: false, reason: probeErr || 'frame_probe_failed' });
        return;
      }
`,
    `function enumerateSpecialAuthoringFrames(tabId, allowedOrigin, cb) {
  chrome.scripting.executeScript(
    { target: { tabId: tabId, allFrames: true }, func: specialFrameProbe },
    function (probeResults) {
      if (chrome.runtime.lastError) {
        cb({ ok: false, reason: chrome.runtime.lastError.message || 'frame_probe_failed' });
        return;
      }
`,
  ],
  [
    `      if (probeTimedOut) {
        finish(null, 'frame_probe_timeout');
        return;
      }
`,
    ``,
  ],
  [
    `          bounded: bounded,
          trace: trace,
        },
        function (hs) {
`,
    `        },
        function (hs) {
`,
  ],
  [
    `        var unsupported = specialEmptyUnsupported();
        if (probeTimedOut) unsupported.correlationUnavailable += 1;
`,
    `        var unsupported = specialEmptyUnsupported();
`,
  ],
  [
    `          correlationError: correlationError || null,
        });
      }
  }
}
`,
    `          correlationError: correlationError || null,
        });
      }
    },
  );
}
`,
  ],
  [
    `  var loadingIsPending = Boolean(opts && opts.loadingIsPending === true);
  // D-121-60: opts.bounded (authoring click target) — a timeout fails closed, never skipped.
  var bounded = Boolean(opts && opts.bounded === true);
`,
    `  var loadingIsPending = Boolean(opts && opts.loadingIsPending === true);
`,
  ],
  [
    `      args: [descriptor.frameLocator, allowedOrigin],
      bounded: bounded,
`,
    `      args: [descriptor.frameLocator, allowedOrigin],
`,
  ],
  [
    `      specialAuthoringExec(
        bounded,
        { target: { tabId: tabId, frameIds: [frameId] }, func: specialFrameProbe },
        function (probe, probeErr) {
          if (probeErr) {
`,
    `      chrome.scripting.executeScript(
        { target: { tabId: tabId, frameIds: [frameId] }, func: specialFrameProbe },
        function (probe) {
          if (chrome.runtime.lastError) {
`,
  ],
  [
    `function specialInjectThenRun(tabId, frameId, files, run, cb, bounded) {
  // D-121-60: bounded (reveal discovery only) — a frame that does not answer → { timedOut: true }.
  specialAuthoringExec(
    bounded === true,
    { target: { tabId: tabId, frameIds: [frameId] }, world: 'MAIN', files: files },
    function (_r, injectErr, injectTimedOut) {
      if (injectErr) {
        cb({ ok: false, reason: injectErr || 'inject_failed', injectFailed: true, timedOut: injectTimedOut });
        return;
      }
      specialAuthoringExec(
        bounded === true,
        {
          target: { tabId: tabId, frameIds: [frameId] },
          world: 'MAIN',
          func: run.func,
          args: run.args || [],
        },
        function (results, runErr, runTimedOut) {
          if (runErr) {
            cb({ ok: false, reason: runErr || 'run_failed', timedOut: runTimedOut });
            return;
          }
          cb(
            results && results[0] && results[0].result !== undefined
              ? results[0].result
              : { ok: false, reason: 'no_result' },
          );
        },
      );
    },
  );
}
`,
    `function specialInjectThenRun(tabId, frameId, files, run, cb) {
  chrome.scripting.executeScript(
    { target: { tabId: tabId, frameIds: [frameId] }, world: 'MAIN', files: files },
    function () {
      if (chrome.runtime.lastError) {
        cb({ ok: false, reason: chrome.runtime.lastError.message || 'inject_failed', injectFailed: true });
        return;
      }
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId, frameIds: [frameId] },
          world: 'MAIN',
          func: run.func,
          args: run.args || [],
        },
        function (results) {
          if (chrome.runtime.lastError) {
            cb({ ok: false, reason: chrome.runtime.lastError.message || 'run_failed' });
            return;
          }
          cb(
            results && results[0] && results[0].result !== undefined
              ? results[0].result
              : { ok: false, reason: 'no_result' },
          );
        },
      );
    },
  );
}
`,
  ],
  [
    `/**
 * Eligible credential inputs across top + visible depth-1 HTTPS frames: Set of "frameKey::locator".
 * D-121-60 (authoring click): every frame call is bounded; a frame that does not answer in time is
 * listed in \`skipped\` (frameKey → true) and contributes no entries (discovery only).
 */
function collectSpecialRevealSnapshot(tabId, allowedOrigin, cb, trace) {
  var started = Date.now();
  enumerateSpecialAuthoringFrames(tabId, allowedOrigin, function (en) {
    if (!en.ok) {
      if (trace) trace('snapshot_frames_failed', { reason: en.reason });
      cb({ ok: false, reason: en.reason });
      return;
    }
    var targets = en.records.filter(function (r) {
      return r.status === 'top' || (r.status === 'depth1_https' && r.visible);
    });
    if (trace) trace('snapshot_frames', { targets: targets.length, records: en.records.length, correlation: en.correlationError ? 'unavailable' : 'ok' });
    var entries = [];
    var skipped = {};
    var pending = targets.length;
    targets.forEach(function (record, index) {
      var frameStarted = Date.now();
      specialInjectThenRun(
        tabId,
        record.frameId,
        SPECIAL_INSPECT_FILES,
        {
          func: function (expectedOrigin) {
            if (String(location.origin || '') !== expectedOrigin) return [];
            if (typeof collectSpecialEligibleCredentialInputs === 'function') {
              return collectSpecialEligibleCredentialInputs();
            }
            return typeof collectSpecialEligibleCredentialLocators === 'function'
              ? collectSpecialEligibleCredentialLocators()
              : [];
          },
          args: [record.frameId === 0 ? allowedOrigin : record.origin],
        },
        function (inputs) {
          var descriptor = specialFrameDescriptorOf(record);
          var timedOut = Boolean(inputs && inputs.timedOut === true);
          if (timedOut) skipped[specialFrameKeyOf(descriptor)] = true;
          if (trace) {
            trace('snapshot_frame', {
              index: index,
              kind: record.frameId === 0 ? 'top' : 'depth1',
              ms: Date.now() - frameStarted,
              inputs: Array.isArray(inputs) ? inputs.length : null,
              timedOut: timedOut,
            });
          }
          if (Array.isArray(inputs)) {
            inputs.forEach(function (item) {
              var loc = typeof item === 'string' ? item : item && item.locator;
              if (typeof loc === 'string' && loc) {
                entries.push({
                  key: specialFrameKeyOf(descriptor) + '::' + loc,
                  frame: descriptor,
                  locator: loc,
                  password: Boolean(item && item.password === true),
                });
              }
            });
          }
          pending -= 1;
          if (pending === 0) {
            if (trace) trace('snapshot_done', { ms: Date.now() - started, entries: entries.length, skipped: Object.keys(skipped).length });
            cb({ ok: true, entries: entries, skipped: skipped });
          }
        },
        true,
      );
    });
  }, { bounded: true, trace: trace });
}
`,
    `/** Eligible credential inputs across top + visible depth-1 HTTPS frames: Set of "frameKey::locator". */
function collectSpecialRevealSnapshot(tabId, allowedOrigin, cb) {
  enumerateSpecialAuthoringFrames(tabId, allowedOrigin, function (en) {
    if (!en.ok) {
      cb({ ok: false, reason: en.reason });
      return;
    }
    var targets = en.records.filter(function (r) {
      return r.status === 'top' || (r.status === 'depth1_https' && r.visible);
    });
    var entries = [];
    var pending = targets.length;
    targets.forEach(function (record) {
      specialInjectThenRun(
        tabId,
        record.frameId,
        SPECIAL_INSPECT_FILES,
        {
          func: function (expectedOrigin) {
            if (String(location.origin || '') !== expectedOrigin) return [];
            if (typeof collectSpecialEligibleCredentialInputs === 'function') {
              return collectSpecialEligibleCredentialInputs();
            }
            return typeof collectSpecialEligibleCredentialLocators === 'function'
              ? collectSpecialEligibleCredentialLocators()
              : [];
          },
          args: [record.frameId === 0 ? allowedOrigin : record.origin],
        },
        function (inputs) {
          var descriptor = specialFrameDescriptorOf(record);
          if (Array.isArray(inputs)) {
            inputs.forEach(function (item) {
              var loc = typeof item === 'string' ? item : item && item.locator;
              if (typeof loc === 'string' && loc) {
                entries.push({
                  key: specialFrameKeyOf(descriptor) + '::' + loc,
                  frame: descriptor,
                  locator: loc,
                  password: Boolean(item && item.password === true),
                });
              }
            });
          }
          pending -= 1;
          if (pending === 0) cb({ ok: true, entries: entries });
        },
      );
    });
  });
}
`,
  ],
  [
    `function specialGestureWatchRun(tabId, func, token, cb, bounded) {
  // D-121-60: bounded (authoring click) — no answer in time → { ok: false } (fail-closed).
  specialAuthoringExec(
    bounded === true,
    { target: { tabId: tabId, allFrames: true }, world: 'ISOLATED', func: func, args: [token] },
    function (results, err, timedOut) {
      if (err) {
        cb({ ok: false, seen: false, timedOut: timedOut });
        return;
      }
      var seen = (results || []).some(function (r) {
        return r && r.result && r.result.seen === true;
      });
      cb({ ok: true, seen: seen });
    },
  );
}
`,
    `function specialGestureWatchRun(tabId, func, token, cb) {
  chrome.scripting.executeScript(
    { target: { tabId: tabId, allFrames: true }, world: 'ISOLATED', func: func, args: [token] },
    function (results) {
      if (chrome.runtime.lastError) {
        cb({ ok: false, seen: false });
        return;
      }
      var seen = (results || []).some(function (r) {
        return r && r.result && r.result.seen === true;
      });
      cb({ ok: true, seen: seen });
    },
  );
}
`,
  ],
  [
    `  var trace = specialAuthoringTraceStart();
  trace('received', { mode: readinessMode, framed: Boolean(clickFrame), requirePassword: requirePasswordSurface });
  specialAuthoringTabGate(message, sendResponse, {}, function (tabId, ensured) {
    trace('tab_ready', { reused: Boolean(ensured && ensured.reused) });
`,
    `  specialAuthoringTabGate(message, sendResponse, {}, function (tabId, ensured) {
`,
  ],
  [
    `      var gestureToken = null;
      // D-121-60: frames skipped (no answer in time) in the pre-click snapshot are never compared.
      var skippedBefore = {};
      var pollTicks = 0;
`,
    `      var gestureToken = null;
`,
  ],
  [
    `        var result = Object.assign({ readinessMode: readinessMode }, outcome);
        trace('reply', { ok: result.ok === true, reason: result.ok === true ? null : result.reason || null });
`,
    `        var result = Object.assign({ readinessMode: readinessMode }, outcome);
`,
  ],
  [
    `        specialGestureWatchRun(tabId, specialGestureWatchCollect, token, function (watch) {
          trace('gesture_collect', { ok: watch.ok === true, timedOut: watch.timedOut === true });
          send(specialGestureVerdict(outcome, watch));
        }, true);
`,
    `        specialGestureWatchRun(tabId, specialGestureWatchCollect, token, function (watch) {
          send(specialGestureVerdict(outcome, watch));
        });
`,
  ],
  [
    `        specialGestureWatchRun(tabId, specialGestureWatchInstall, gestureToken, function () {
          next();
        }, true);
`,
    `        specialGestureWatchRun(tabId, specialGestureWatchInstall, gestureToken, function () {
          next();
        });
`,
  ],
  [
    `        resolveDeclaredFrame(tabId, allowedOrigin, clickFrame, function (resolved) {
          trace('click_frame', { ok: resolved.ok === true, reason: resolved.ok ? null : resolved.reason });
          if (!resolved.ok) {
            reply({ ok: false, reason: resolved.reason, liveOrigin: resolved.liveOrigin });
            return;
          }
          next(resolved.frameId);
        }, { bounded: true });
`,
    `        resolveDeclaredFrame(tabId, allowedOrigin, clickFrame, function (resolved) {
          if (!resolved.ok) {
            reply({ ok: false, reason: resolved.reason, liveOrigin: resolved.liveOrigin });
            return;
          }
          next(resolved.frameId);
        });
`,
  ],
  [
    `        specialGestureWatchRun(tabId, specialGestureWatchInstall, token, function (installed) {
          trace('gesture_install', { ok: installed.ok === true, timedOut: installed.timedOut === true });
          if (!installed.ok) {
            reply({ ok: false, reason: 'gesture_watch_unavailable' });
            return;
          }
          gestureToken = token;
          clickInFrame(frameId, function () {
            trace('click_done', { ok: true });
            next();
          });
        }, true);
`,
    `        specialGestureWatchRun(tabId, specialGestureWatchInstall, token, function (installed) {
          if (!installed.ok) {
            reply({ ok: false, reason: 'gesture_watch_unavailable' });
            return;
          }
          gestureToken = token;
          clickInFrame(frameId, next);
        });
`,
  ],
  [
    `            return !before[e.key] && !skippedBefore[specialFrameKeyOf(e.frame)];
          });
          pollTicks += 1;
          if (pollTicks === 1 || pollTicks % 5 === 0) {
            trace('poll', { tick: pollTicks, fresh: freshAll.length, skipped: Object.keys(snap.skipped || {}).length });
          }
`,
    `            return !before[e.key];
          });
`,
  ],
  [
    `          skippedBefore = pre.skipped || {};
          clickIn(frameId, function () {
            pollReveal(before, Date.now() + readinessTimeoutMs);
          });
        }, trace);
`,
    `          clickIn(frameId, function () {
            pollReveal(before, Date.now() + readinessTimeoutMs);
          });
        });
`,
  ],
];

/** Revert the D-121-60 edits; throws unless each edit is present exactly once. */
export function revertD12160BackgroundEdits(src) {
  let out = src;
  for (const [next, prev] of D12160_BACKGROUND_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-60 background edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
