/**
 * D-121-72 — the exact edits (stop a fill run; a closed tab ends the run) as [new, old]
 * pairs on LF-normalized text. Reverting them must reproduce the pre-slice bytes, which proves
 * nothing else changed. background.js: edits outside the SPECIAL runtime block (incl. the
 * cancel router entry) and inside it, kept apart for the block-excluding pin.
 */
export const D12172_BACKGROUND_OUTSIDE_EDITS = [
  [
    "\n/**\n * D-121-72 — Hub fill runs in flight (STANDARD Managed + SPECIAL), by the Hub's run id.\n * Values hold only `cancel()`; no credentials.\n */\nvar hubFillRuns = {};\n\nfunction hubFillRunId(value) {\n  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 64) : '';\n}\n\n/** HUB_MANAGED_AUTOFILL_CANCEL — unknown or finished run → no-op. Never closes the tab. */\nfunction cancelHubFillRun(message, sendResponse) {\n  var runId = hubFillRunId(message.runId);\n  var hubRun = runId ? hubFillRuns[runId] : null;\n  if (!hubRun) {\n    sendResponse({ ok: true, cancelled: false });\n    return false;\n  }\n  hubRun.cancel();\n  sendResponse({ ok: true, cancelled: true });\n  return false;\n}\n\n/**\n * @param {object} [options]\n * @param {number} [options.initialDelayMs] — post-URL-match delay before onTabReady.\n",
    "\n/**\n * @param {object} [options]\n * @param {number} [options.initialDelayMs] — post-URL-match delay before onTabReady.\n",
  ],
  [
    " *   (e.g. index, openerTabId). Legacy/generic must omit this.\n * @param {function(number): void} [options.onTabCreatedDiag] — Managed §5D only.\n * @param {string} [options.hubRunId] — D-121-72 Hub fill run (Managed / SPECIAL): a closed\n *   tab ends it (`tab_closed`), HUB_MANAGED_AUTOFILL_CANCEL ends it (`cancelled`).\n */\nfunction openGenericRealSiteTab(urlString, sendResponse, sessionLabel, onTabReady, options) {\n",
    " *   (e.g. index, openerTabId). Legacy/generic must omit this.\n * @param {function(number): void} [options.onTabCreatedDiag] — Managed §5D only.\n */\nfunction openGenericRealSiteTab(urlString, sendResponse, sessionLabel, onTabReady, options) {\n",
  ],
  [
    "  }\n\n  var hubRunId = options ? hubFillRunId(options.hubRunId) : '';\n  if (hubRunId && hubFillRuns[hubRunId]) {\n    sendResponse({ ok: false, reason: 'busy' });\n    return false;\n  }\n\n  var initialDelayMs =\n    options && typeof options.initialDelayMs === 'number'\n",
    "  }\n\n  var initialDelayMs =\n    options && typeof options.initialDelayMs === 'number'\n",
  ],
  [
    "  var readyWorkStarted = false;\n  var operationTimeout = null;\n  var runTimers = [];\n  var runDetachers = [];\n\n  function clearOperationTimeout() {\n",
    "  var readyWorkStarted = false;\n  var operationTimeout = null;\n\n  function clearOperationTimeout() {\n",
  ],
  [
    "    clearTimeout(tabLoadTimeout);\n    clearOperationTimeout();\n    // D-121-72: every timer / listener of the run goes with it — nothing runs after the answer.\n    runTimers.splice(0).forEach(function (timer) {\n      clearTimeout(timer);\n    });\n    runDetachers.splice(0).forEach(function (detach) {\n      detach();\n    });\n    if (hubRunId && hubFillRuns[hubRunId] === hubRun) {\n      delete hubFillRuns[hubRunId];\n    }\n    respond(result);\n  }\n\n  /** D-121-72 — run handle: `active()` is the checkpoint before every click / fill; `later` timers die with the run. */\n  var run = {\n    active: function () {\n      return !settled;\n    },\n    later: function (fn, ms) {\n      var timer = setTimeout(function () {\n        var at = runTimers.indexOf(timer);\n        if (at >= 0) runTimers.splice(at, 1);\n        if (!settled) fn();\n      }, ms);\n      runTimers.push(timer);\n    },\n  };\n  var hubRun = null;\n  if (hubRunId) {\n    hubRun = {\n      cancel: function () {\n        finishSession({ ok: false, reason: 'cancelled' });\n      },\n    };\n    hubFillRuns[hubRunId] = hubRun;\n  }\n\n  function armOperationTimeout() {\n    clearOperationTimeout();\n    operationTimeout = setTimeout(function () {\n      finishSession({ ok: false, reason: 'operation_timeout' });\n    }, GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS);\n  }\n",
    "    clearTimeout(tabLoadTimeout);\n    clearOperationTimeout();\n    respond(result);\n  }\n\n  function armOperationTimeout() {\n    clearOperationTimeout();\n    operationTimeout = setTimeout(function () {\n      if (settled) {\n        return;\n      }\n      settled = true;\n      respond({ ok: false, reason: 'operation_timeout' });\n    }, GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS);\n  }\n",
  ],
  [
    "\n    var tabId = tab.id;\n    if (settled) {\n      return;\n    }\n\n    if (options && typeof options.onTabCreatedDiag === 'function') {\n      try {\n        var detachDiag = options.onTabCreatedDiag(tabId);\n        if (typeof detachDiag === 'function') runDetachers.push(detachDiag);\n      } catch (_diagErr) {\n        // Diagnostic must never block Managed/generic sessions.\n",
    "\n    var tabId = tab.id;\n\n    if (options && typeof options.onTabCreatedDiag === 'function') {\n      try {\n        options.onTabCreatedDiag(tabId);\n      } catch (_diagErr) {\n        // Diagnostic must never block Managed/generic sessions.\n",
  ],
  [
    "    }\n\n    // D-121-72: the run's tab closed → the run ends now (STANDARD Managed and SPECIAL alike).\n    if (hubRunId) {\n      var onRunTabRemoved = function (removedTabId) {\n        if (removedTabId === tabId) {\n          finishSession({ ok: false, reason: 'tab_closed' });\n        }\n      };\n      chrome.tabs.onRemoved.addListener(onRunTabRemoved);\n      runDetachers.push(function () {\n        chrome.tabs.onRemoved.removeListener(onRunTabRemoved);\n      });\n    }\n\n    function startReadyWork() {\n      if (readyWorkStarted || settled) {\n",
    "    }\n\n    function startReadyWork() {\n      if (readyWorkStarted || settled) {\n",
  ],
  [
    "      armOperationTimeout();\n\n      run.later(function () {\n        onTabReady(tabId, finishSession, run);\n      }, initialDelayMs);\n    }\n",
    "      armOperationTimeout();\n\n      setTimeout(function () {\n        if (settled) {\n          return;\n        }\n        onTabReady(tabId, finishSession);\n      }, initialDelayMs);\n    }\n",
  ],
  [
    "\n    chrome.tabs.onUpdated.addListener(onTabUpdated);\n    runDetachers.push(function () {\n      chrome.tabs.onUpdated.removeListener(onTabUpdated);\n    });\n\n    chrome.tabs.get(tabId, function (currentTab) {\n",
    "\n    chrome.tabs.onUpdated.addListener(onTabUpdated);\n\n    chrome.tabs.get(tabId, function (currentTab) {\n",
  ],
  [
    "}\n\n/** D-121-72 — `run` (Hub fill run): no step after the run ended; retries die with it. */\nfunction runManagedAutofillOnTab(tabId, payload, attempt, onDone, run) {\n  if (run && !run.active()) {\n    return;\n  }\n  var retryLater = run ? run.later : setTimeout;\n  chrome.scripting.executeScript(\n    {\n",
    "}\n\nfunction runManagedAutofillOnTab(tabId, payload, attempt, onDone) {\n  chrome.scripting.executeScript(\n    {\n",
  ],
  [
    "    },\n    function () {\n      if (run && !run.active()) {\n        return;\n      }\n      if (chrome.runtime.lastError) {\n        if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {\n          retryLater(function () {\n            runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone, run);\n          }, MANAGED_AUTOFILL_RETRY_DELAY_MS);\n          return;\n",
    "    },\n    function () {\n      if (chrome.runtime.lastError) {\n        if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {\n          setTimeout(function () {\n            runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone);\n          }, MANAGED_AUTOFILL_RETRY_DELAY_MS);\n          return;\n",
  ],
  [
    "        },\n        function (results) {\n          if (run && !run.active()) {\n            return;\n          }\n          if (chrome.runtime.lastError) {\n            if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {\n              retryLater(function () {\n                runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone, run);\n              }, MANAGED_AUTOFILL_RETRY_DELAY_MS);\n              return;\n",
    "        },\n        function (results) {\n          if (chrome.runtime.lastError) {\n            if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {\n              setTimeout(function () {\n                runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone);\n              }, MANAGED_AUTOFILL_RETRY_DELAY_MS);\n              return;\n",
  ],
  [
    "            isManagedAutofillRetryable(result)\n          ) {\n            retryLater(function () {\n              runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone, run);\n            }, MANAGED_AUTOFILL_RETRY_DELAY_MS);\n            return;\n",
    "            isManagedAutofillRetryable(result)\n          ) {\n            setTimeout(function () {\n              runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone);\n            }, MANAGED_AUTOFILL_RETRY_DELAY_MS);\n            return;\n",
  ],
  [
    "    logManagedAutofillDiag('createdTabId', { tabId: createdTabId });\n    detachDiag = attachManagedAutofillDiagLifecycle(createdTabId);\n    return detachDiag;\n  };\n  managedOptions.hubRunId = payload.runId;\n\n  return openGenericRealSiteTab(\n",
    "    logManagedAutofillDiag('createdTabId', { tabId: createdTabId });\n    detachDiag = attachManagedAutofillDiagLifecycle(createdTabId);\n  };\n\n  return openGenericRealSiteTab(\n",
  ],
  [
    "    sendResponse,\n    'managed-autofill',\n    function (tabId, finishSession, run) {\n      runManagedAutofillOnTab(tabId, payload, 0, function (result) {\n        function afterFinish(finalResult) {\n",
    "    sendResponse,\n    'managed-autofill',\n    function (tabId, finishSession) {\n      runManagedAutofillOnTab(tabId, payload, 0, function (result) {\n        function afterFinish(finalResult) {\n",
  ],
  [
    "        }\n        afterFinish(result || { ok: false, reason: 'no_result' });\n      }, run);\n    },\n    managedOptions,\n",
    "        }\n        afterFinish(result || { ok: false, reason: 'no_result' });\n      });\n    },\n    managedOptions,\n",
  ],
  [
    "\n  /**\n   * D-121-72 — stop a Hub fill run (Managed or SPECIAL) by its run id.\n   */\n  if (message.type === 'HUB_MANAGED_AUTOFILL_CANCEL') {\n    return cancelHubFillRun(message, sendResponse);\n  }\n\n  /**\n   * Phase 121.2 — SPECIAL login flow runtime (Digital Home + Admin Test, one engine).\n   */\n",
    "\n  /**\n   * Phase 121.2 — SPECIAL login flow runtime (Digital Home + Admin Test, one engine).\n   */\n",
  ],
];

export const D12172_SPECIAL_BLOCK_EDITS = [
  [
    "  }\n\n  var openOptions = { initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS, hubRunId: runId };\n  var placement = buildManagedTabCreateProperties(sender);\n  if (placement) {\n",
    "  }\n\n  var openOptions = { initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS };\n  var placement = buildManagedTabCreateProperties(sender);\n  if (placement) {\n",
  ],
  [
    "    sendResponse,\n    'special-login-flow',\n    function (tabId, finishSession, run) {\n      var runDeadline = Date.now() + GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS - 1000;\n      var gestureToken = null;\n",
    "    sendResponse,\n    'special-login-flow',\n    function (tabId, finishSession) {\n      var runDeadline = Date.now() + GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS - 1000;\n      var gestureToken = null;\n",
  ],
  [
    "      var at = { stepId: plan.steps[0].stepId, actionId: plan.opener ? plan.opener.actionId : '' };\n\n      // D-121-72: checkpoint before every wait, click and fill — a closed tab / Hub cancel\n      // already answered the run; nothing more happens in the tab.\n      function live() {\n        return !done && run.active();\n      }\n\n      function until(ms) {\n        return Math.min(Date.now() + ms, runDeadline);\n",
    "      var at = { stepId: plan.steps[0].stepId, actionId: plan.opener ? plan.opener.actionId : '' };\n\n      function until(ms) {\n        return Math.min(Date.now() + ms, runDeadline);\n",
  ],
  [
    "\n      function finish(outcome) {\n        if (!live()) return;\n        done = true;\n        collectGesture(function () {\n",
    "\n      function finish(outcome) {\n        if (done) return;\n        done = true;\n        collectGesture(function () {\n",
  ],
  [
    "      // R1 / R-3 — tab URL origin and the live top document origin, before every click and fill.\n      function checkR1(next) {\n        if (!live()) return;\n        chrome.tabs.get(tabId, function (tab) {\n          if (!live()) return;\n          if (chrome.runtime.lastError || !tab) {\n            finish({ ok: false, stage: 'r1', reason: 'no_tab' });\n",
    "      // R1 / R-3 — tab URL origin and the live top document origin, before every click and fill.\n      function checkR1(next) {\n        chrome.tabs.get(tabId, function (tab) {\n          if (chrome.runtime.lastError || !tab) {\n            finish({ ok: false, stage: 'r1', reason: 'no_tab' });\n",
  ],
  [
    "            { target: { tabId: tabId, frameIds: [0] }, func: specialFrameProbe },\n            function (probe) {\n              if (!live()) return;\n              var p = !chrome.runtime.lastError && probe && probe[0] && probe[0].result;\n              if (!p || p.origin !== allowedOrigin) {\n",
    "            { target: { tabId: tabId, frameIds: [0] }, func: specialFrameProbe },\n            function (probe) {\n              var p = !chrome.runtime.lastError && probe && probe[0] && probe[0].result;\n              if (!p || p.origin !== allowedOrigin) {\n",
  ],
  [
    "      // Opener or transition: exact-one .click() in the MAIN world; retried until the deadline.\n      function clickAction(action, stage, frameId, expectedOrigin, deadline, onClicked) {\n        if (!live()) return;\n        chrome.scripting.executeScript(\n          {\n",
    "      // Opener or transition: exact-one .click() in the MAIN world; retried until the deadline.\n      function clickAction(action, stage, frameId, expectedOrigin, deadline, onClicked) {\n        chrome.scripting.executeScript(\n          {\n",
  ],
  [
    "          },\n          function (results) {\n            if (!live()) return;\n            var r = !chrome.runtime.lastError && results && results[0] && results[0].result;\n            var failBase = {\n",
    "          },\n          function (results) {\n            if (done) return;\n            var r = !chrome.runtime.lastError && results && results[0] && results[0].result;\n            var failBase = {\n",
  ],
  [
    "              return;\n            }\n            run.later(function () {\n              refreshGestureWatch(function () {\n                clickAction(action, stage, frameId, expectedOrigin, deadline, onClicked);\n",
    "              return;\n            }\n            setTimeout(function () {\n              refreshGestureWatch(function () {\n                clickAction(action, stage, frameId, expectedOrigin, deadline, onClicked);\n",
  ],
  [
    "       */\n      function pollReadiness(readiness, afterTransition, deadline, onMet) {\n        if (!live()) return;\n        specialDeclaredReadinessMet(\n          tabId,\n",
    "       */\n      function pollReadiness(readiness, afterTransition, deadline, onMet) {\n        specialDeclaredReadinessMet(\n          tabId,\n",
  ],
  [
    "          { locator: readiness.locator, frame: readiness.frame, target: readiness.target },\n          function (r) {\n            if (!live()) return;\n            var frameKey = specialFrameKeyOf(readiness.frame);\n            var navigating = afterTransition && !r.ok && r.reason === 'frame_correlation_unavailable';\n",
    "          { locator: readiness.locator, frame: readiness.frame, target: readiness.target },\n          function (r) {\n            if (done) return;\n            var frameKey = specialFrameKeyOf(readiness.frame);\n            var navigating = afterTransition && !r.ok && r.reason === 'frame_correlation_unavailable';\n",
  ],
  [
    "              return;\n            }\n            run.later(function () {\n              refreshGestureWatch(function () {\n                pollReadiness(readiness, afterTransition, deadline, onMet);\n",
    "              return;\n            }\n            setTimeout(function () {\n              refreshGestureWatch(function () {\n                pollReadiness(readiness, afterTransition, deadline, onMet);\n",
  ],
  [
    "\n      function retryFill(index, attempt) {\n        run.later(function () {\n          fillAttempt(index, attempt + 1);\n        }, MANAGED_AUTOFILL_RETRY_DELAY_MS);\n",
    "\n      function retryFill(index, attempt) {\n        setTimeout(function () {\n          fillAttempt(index, attempt + 1);\n        }, MANAGED_AUTOFILL_RETRY_DELAY_MS);\n",
  ],
  [
    "\n      function fillAttempt(index, attempt) {\n        if (!live()) return;\n        if (Date.now() >= runDeadline) {\n          finish({ ok: false, stage: 'fill', reason: 'operation_timeout', frameKey: specialFrameKeyOf(plan.steps[index].frame) });\n",
    "\n      function fillAttempt(index, attempt) {\n        if (Date.now() >= runDeadline) {\n          finish({ ok: false, stage: 'fill', reason: 'operation_timeout', frameKey: specialFrameKeyOf(plan.steps[index].frame) });\n",
  ],
  [
    "        var frameKey = specialFrameKeyOf(step.frame);\n        resolveFillDocument(step.frame, function (doc) {\n          if (!live()) return;\n          if (!doc.ok) {\n            var pending = doc.reason === 'frame_missing' || doc.reason === 'frame_loading';\n",
    "        var frameKey = specialFrameKeyOf(step.frame);\n        resolveFillDocument(step.frame, function (doc) {\n          if (!doc.ok) {\n            var pending = doc.reason === 'frame_missing' || doc.reason === 'frame_loading';\n",
  ],
  [
    "            },\n            function () {\n              if (!live()) return;\n              if (chrome.runtime.lastError) {\n                if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {\n",
    "            },\n            function () {\n              if (chrome.runtime.lastError) {\n                if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {\n",
  ],
  [
    "                },\n                function (results) {\n                  if (!live()) return;\n                  if (chrome.runtime.lastError) {\n                    if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {\n",
    "                },\n                function (results) {\n                  if (chrome.runtime.lastError) {\n                    if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {\n",
  ],
];

export const D12172_MANAGED_AUTOFILL_EDITS = [
  [
    "  sendExtensionMessageAsync,\n} from './extensionBridge';\nimport {\n  acquireFillRun,\n  fillRunCount,\n  fillRunEndMessage,\n  FILL_RUN_TIMEOUT_REASON,\n  isFillRunActive,\n  stopFillRun,\n} from './fillRunControl';\n\nexport const HUB_MANAGED_AUTOFILL_MESSAGE = 'HUB_MANAGED_AUTOFILL';\n",
    "  sendExtensionMessageAsync,\n} from './extensionBridge';\n\nexport const HUB_MANAGED_AUTOFILL_MESSAGE = 'HUB_MANAGED_AUTOFILL';\n",
  ],
  [
    " * D-117-20 / AC-117-36 — in-flight keys are `(serviceId, accessProfileId)` only.\n * Admin Test uses a distinct key prefix (D-120-12 / §15.8) — no secrets.\n * D-121-72: the lock is a run token (`fillRunControl`, lane `managed`) — bounded, stoppable.\n */\n\n/** Stable execution key — serviceId + accessProfileId only (no secrets). */\n",
    " * D-117-20 / AC-117-36 — in-flight keys are `(serviceId, accessProfileId)` only.\n * Admin Test uses a distinct key prefix (D-120-12 / §15.8) — no secrets.\n */\nconst managedAutofillInFlightKeys = new Set<string>();\n\n/** Stable execution key — serviceId + accessProfileId only (no secrets). */\n",
  ],
  [
    "    return false;\n  }\n  return isFillRunActive('managed', managedAutofillExecutionKey(serviceId, accessProfileId));\n}\n\n/** Test/diagnostics: how many Managed executions are currently in flight. */\nexport function managedAutofillInFlightCount(): number {\n  return fillRunCount('managed');\n}\n\n/**\n * D-121-72 «עצור» (Admin «בדיקת מילוי» only) — stops the Admin Test run of this service\n * in either lane (STANDARD Managed / SPECIAL). True when a run was stopped.\n */\nexport function stopAdminFillTest(serviceId: string): boolean {\n  const key = adminManagedTestExecutionKey(serviceId);\n  const managed = stopFillRun('managed', key);\n  const special = stopFillRun('special', key);\n  return managed || special;\n}\n\n/** Reasons that mean the extension never created / loaded the Login Entry tab. */\nconst TAB_NOT_OPENED_REASONS = new Set([\n",
    "    return false;\n  }\n  return managedAutofillInFlightKeys.has(\n    managedAutofillExecutionKey(serviceId, accessProfileId),\n  );\n}\n\n/** Test/diagnostics: how many Managed executions are currently in flight. */\nexport function managedAutofillInFlightCount(): number {\n  return managedAutofillInFlightKeys.size;\n}\n\n/** Reasons that mean the extension never created / loaded the Login Entry tab. */\nconst TAB_NOT_OPENED_REASONS = new Set([\n",
  ],
  [
    "}\n\nfunction userMessageForManagedFailure(\n  reason: string,\n  path: 'admin_test' | 'digital_home',\n): string {\n  const ended = fillRunEndMessage(reason, path);\n  if (ended) {\n    return ended;\n  }\n  if (TAB_NOT_OPENED_REASONS.has(reason)) {\n    return MSG_MANAGED_OPEN_FAILED;\n",
    "}\n\nfunction userMessageForManagedFailure(reason: string): string {\n  if (TAB_NOT_OPENED_REASONS.has(reason)) {\n    return MSG_MANAGED_OPEN_FAILED;\n",
  ],
  [
    "  }\n\n  const fillRun = acquireFillRun('managed', executionKey);\n  if (!fillRun) {\n    return {\n      ok: false,\n",
    "  }\n\n  if (managedAutofillInFlightKeys.has(executionKey)) {\n    return {\n      ok: false,\n",
  ],
  [
    "  }\n\n  try {\n    const diagnosticPath = diagnosticPathFromExecutionKey(executionKey);\n",
    "  }\n\n  managedAutofillInFlightKeys.add(executionKey);\n  try {\n    const diagnosticPath = diagnosticPathFromExecutionKey(executionKey);\n",
  ],
  [
    "      diagnosticPath,\n    });\n    payload.runId = fillRun.token;\n\n    logManagedDev('[Managed Autofill] Hub: sending explicit mappings', {\n",
    "      diagnosticPath,\n    });\n\n    logManagedDev('[Managed Autofill] Hub: sending explicit mappings', {\n",
  ],
  [
    "    }\n\n    const raced = await fillRun.race(\n      sendExtensionMessageAsync<{\n        ok?: boolean;\n        reason?: string;\n        filled?: number;\n        fieldId?: string;\n        locator?: string;\n        detail?: string;\n        fillDiagnostics?: ManagedFillDiagnostics;\n      }>(payload),\n    );\n\n    if (raced.kind !== 'answer') {\n      const reason = raced.kind === 'cancelled' ? 'cancelled' : FILL_RUN_TIMEOUT_REASON;\n      logManagedDev('[Managed Autofill] Hub: run ended without an answer', { reason });\n      return {\n        ok: false,\n        reason,\n        tabOpened: true,\n        extensionUsed: true,\n        userMessage: userMessageForManagedFailure(reason, diagnosticPath),\n      };\n    }\n    const response = raced.value;\n\n    if (!response) {\n      logManagedDev('[Managed Autofill] Hub: no extension response — opening Login Entry');\n",
    "    }\n\n    const response = await sendExtensionMessageAsync<{\n      ok?: boolean;\n      reason?: string;\n      filled?: number;\n      fieldId?: string;\n      locator?: string;\n      detail?: string;\n      fillDiagnostics?: ManagedFillDiagnostics;\n    }>(payload);\n\n    if (!response) {\n      logManagedDev('[Managed Autofill] Hub: no extension response — opening Login Entry');\n",
  ],
  [
    "      tabOpened: true,\n      extensionUsed: true,\n      userMessage: userMessageForManagedFailure(reason, diagnosticPath),\n      fillDiagnostics,\n    };\n  } finally {\n    fillRun.release();\n  }\n}\n",
    "      tabOpened: true,\n      extensionUsed: true,\n      userMessage: userMessageForManagedFailure(reason),\n      fillDiagnostics,\n    };\n  } finally {\n    managedAutofillInFlightKeys.delete(executionKey);\n  }\n}\n",
  ],
  [
    "  outcome: ManagedAutofillStructuredOutcome,\n): string {\n  if (outcome.ok || fillRunEndMessage(outcome.reason, 'admin_test')) {\n    return outcome.userMessage;\n  }\n",
    "  outcome: ManagedAutofillStructuredOutcome,\n): string {\n  if (outcome.ok) {\n    return outcome.userMessage;\n  }\n",
  ],
];

function revertEdits(src, edits, label) {
  let out = src.replace(/\r\n/g, '\n');
  for (const [next, prev] of edits) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-72 ${label} edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}

/** background.js outside the SPECIAL block (input LF-normalized); throws unless each edit is present once. */
export function revertD12172BackgroundOutsideEdits(src) {
  return revertEdits(src, D12172_BACKGROUND_OUTSIDE_EDITS, 'background');
}

/** Whole background.js: outside + SPECIAL-block edits. */
export function revertD12172BackgroundEdits(src) {
  return revertEdits(revertD12172BackgroundOutsideEdits(src), D12172_SPECIAL_BLOCK_EDITS, 'special-block');
}

export function revertD12172ManagedAutofillEdits(src) {
  return revertEdits(src, D12172_MANAGED_AUTOFILL_EDITS, 'managedAutofill');
}
