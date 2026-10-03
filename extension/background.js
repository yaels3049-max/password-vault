'use strict';

console.log('[Practice] Background service worker started');

const MOCK_2_FIELD_CREDENTIALS = {
  username: 'demo-user',
  password: 'demo-pass',
};

const MOCK_3_FIELD_CREDENTIALS = {
  idNumber: '123456789',
  userCode: 'demo-code',
  password: 'demo-pass',
};

const PAGE_CONFIGS = [
  {
    id: 'demo-login-3-fields.html',
    mapping: [
      { credentialId: 'idNumber', selector: '#idNumber' },
      { credentialId: 'userCode', selector: '#userCode' },
      { credentialId: 'password', selector: '#password' },
    ],
    match: function (url) {
      const isLocal =
        url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      return isLocal && url.pathname.endsWith('/demo-login-3-fields.html');
    },
    credentials: MOCK_3_FIELD_CREDENTIALS,
  },
  {
    id: 'demo-login.html',
    mapping: [
      { credentialId: 'username', selector: '#username' },
      { credentialId: 'password', selector: '#password' },
    ],
    match: function (url) {
      const isLocal =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]';
      return isLocal && url.pathname.indexOf('demo-login.html') !== -1;
    },
    credentials: MOCK_2_FIELD_CREDENTIALS,
  },
];

function getPageConfig(urlString) {
  try {
    const url = new URL(urlString);
    for (let i = 0; i < PAGE_CONFIGS.length; i += 1) {
      if (PAGE_CONFIGS[i].match(url)) {
        return PAGE_CONFIGS[i];
      }
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function withAutofillParam(urlString) {
  const url = new URL(urlString);
  url.searchParams.set('pocAutofill', '1');
  return url.href;
}

function withoutAutofillParam(urlString) {
  const url = new URL(urlString);
  url.searchParams.delete('pocAutofill');
  return url.href;
}

function buildFillMessage(pageConfig, overrides) {
  const fillMessage = {
    type: 'FILL',
    demoPage: pageConfig.id,
    credentials: pageConfig.credentials,
    mapping: pageConfig.mapping,
  };

  if (overrides && overrides.credentials) {
    fillMessage.credentials = overrides.credentials;
  }

  if (overrides && overrides.loginFields) {
    fillMessage.loginFields = overrides.loginFields;
  }

  return fillMessage;
}

function runScriptingFillFallback(tabId, fillMessage, onDone) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
      func: function (mapping, credentials) {
        function setNativeInputValue(element, value) {
          const prototype = window.HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
          if (descriptor && descriptor.set) {
            descriptor.set.call(element, value);
          } else {
            element.value = value;
          }
        }

        var filled = 0;
        for (var i = 0; i < mapping.length; i += 1) {
          var field = mapping[i];
          var element = document.querySelector(field.selector);
          var value = credentials[field.credentialId];
          if (!element || value == null) {
            continue;
          }
          element.focus();
          setNativeInputValue(element, value);
          element.dispatchEvent(
            new InputEvent('input', { bubbles: true, cancelable: true }),
          );
          element.dispatchEvent(new Event('change', { bubbles: true }));
          filled += 1;
        }

        if (filled === mapping.length) {
          var el = document.getElementById('poc-fill-success');
          if (!el) {
            el = document.createElement('p');
            el.id = 'poc-fill-success';
            el.setAttribute('role', 'status');
            el.style.marginTop = '1rem';
            el.style.padding = '0.75rem';
            el.style.background = '#d4edda';
            el.style.color = '#155724';
            el.style.borderRadius = '4px';
            el.style.fontWeight = '600';
            var form = document.querySelector('form');
            if (form) {
              form.insertAdjacentElement('afterend', el);
            } else {
              document.body.appendChild(el);
            }
          }
          el.textContent = 'המילוי בוצע בהצלחה';
          el.hidden = false;
        }

        return { ok: filled === mapping.length, filled: filled };
      },
      args: [fillMessage.mapping, fillMessage.credentials],
    },
    function (results) {
      const result =
        results && results[0] ? results[0].result : { ok: !chrome.runtime.lastError };
      onDone(Object.assign({ via: 'scripting' }, result));
    },
  );
}

function sendFillWithRetry(tabId, fillMessage, attempt, onDone) {
  chrome.tabs.sendMessage(tabId, fillMessage, function (response) {
    const lastError = chrome.runtime.lastError;

    if (lastError && attempt < 15) {
      setTimeout(function () {
        sendFillWithRetry(tabId, fillMessage, attempt + 1, onDone);
      }, 250);
      return;
    }

    if (response && response.ok) {
      onDone(response);
      return;
    }

    if (fillMessage.mapping && fillMessage.credentials) {
      runScriptingFillFallback(tabId, fillMessage, onDone);
      return;
    }

    onDone(response || { ok: !lastError });
  });
}

const PRACTICE_FILL_RETRY_DELAY_MS = 300;
const PRACTICE_FILL_MAX_ATTEMPTS = 20;
const PRACTICE_CONTENT_READY_MAX_ATTEMPTS = 30;
const PRACTICE_CONTENT_READY_DELAY_MS = 200;

function isPracticeDemoTabUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return false;
  }
  return urlString.indexOf('demo-login.html') !== -1;
}

function onceExternalSendResponse(sendResponse, label) {
  let called = false;
  return function (payload) {
    if (called) {
      console.log('[External] sendResponse skipped (already called):', label);
      return;
    }
    called = true;
    console.log('[External] sendResponse:', label, payload);
    sendResponse(payload);
  };
}

function waitForPracticeContentScript(tabId, attempt, onReady) {
  chrome.tabs.sendMessage(tabId, { type: 'PRACTICE_PING' }, function (response) {
    const lastError = chrome.runtime.lastError;

    if (!lastError && response && response.ready) {
      console.log('[Practice] Content script ready on tab', tabId);
      onReady();
      return;
    }

    if (attempt < PRACTICE_CONTENT_READY_MAX_ATTEMPTS) {
      if (lastError && attempt === 0) {
        console.log('[Practice] Content script not ready yet:', lastError.message);
      }
      setTimeout(function () {
        waitForPracticeContentScript(tabId, attempt + 1, onReady);
      }, PRACTICE_CONTENT_READY_DELAY_MS);
      return;
    }

    if (lastError) {
      console.log('[Practice] Content script wait lastError:', lastError.message);
    }
    onReady();
  });
}

function sendPracticeVaultFillWithRetry(tabId, fillMessage, attempt, onDone) {
  if (attempt === 0) {
    console.log('[Practice] Sending fill message to tab', tabId);
  }

  chrome.tabs.sendMessage(tabId, fillMessage, function (response) {
    const lastError = chrome.runtime.lastError;

    if (lastError) {
      console.log('[Practice] Fill message lastError:', lastError.message);
    }

    const fillFailed = lastError || !response || !response.ok;

    if (fillFailed && attempt < PRACTICE_FILL_MAX_ATTEMPTS) {
      setTimeout(function () {
        sendPracticeVaultFillWithRetry(tabId, fillMessage, attempt + 1, onDone);
      }, PRACTICE_FILL_RETRY_DELAY_MS);
      return;
    }

    if (response && response.ok) {
      console.log('[Practice] Fill message sent successfully');
      onDone(response);
      return;
    }

    if (fillMessage.mapping && fillMessage.credentials) {
      console.log('[Practice] Using scripting fill fallback for practice tab', tabId);
      runScriptingFillFallback(tabId, fillMessage, function (scriptResult) {
        if (scriptResult && scriptResult.ok) {
          console.log('[Practice] Fill message sent successfully');
        } else if (chrome.runtime.lastError) {
          console.log(
            '[Practice] Scripting fallback lastError:',
            chrome.runtime.lastError.message,
          );
        }
        onDone(scriptResult);
      });
      return;
    }

    onDone(
      response || {
        ok: !lastError,
        reason: lastError ? lastError.message : 'practice_fill_failed',
      },
    );
  });
}

function startPracticeVaultFill(tabId, fillMessage, sendResponse) {
  waitForPracticeContentScript(tabId, 0, function () {
    setTimeout(function () {
      sendPracticeVaultFillWithRetry(tabId, fillMessage, 0, sendResponse);
    }, 100);
  });
}

function waitForPracticeDemoTabReady(tabId, sendResponse, onReady) {
  function onTabUpdated(updatedTabId, changeInfo) {
    if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
      return;
    }

    chrome.tabs.get(tabId, function (tab) {
      if (chrome.runtime.lastError) {
        console.log(
          '[Practice] tabs.get lastError:',
          chrome.runtime.lastError.message,
        );
        return;
      }

      if (!tab || !isPracticeDemoTabUrl(tab.url)) {
        return;
      }

      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      onReady();
    });
  }

  chrome.tabs.onUpdated.addListener(onTabUpdated);

  chrome.tabs.get(tabId, function (tab) {
    if (!chrome.runtime.lastError && tab && isPracticeDemoTabUrl(tab.url)) {
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      onReady();
    }
  });
}

function openLocalPageAndFill(urlString, sendResponse, externalMessage) {
  const hasVaultCredentials =
    externalMessage &&
    externalMessage.credentials &&
    typeof externalMessage.credentials === 'object';
  const respond = hasVaultCredentials
    ? onceExternalSendResponse(sendResponse, 'openLocalPageAndFill')
    : sendResponse;

  if (hasVaultCredentials) {
    console.log('[Practice] Extension received practice fill request');
  }

  const pageConfig = getPageConfig(urlString);
  if (!pageConfig) {
    if (hasVaultCredentials) {
      console.log('[Practice] Page config rejected for URL:', urlString);
    }
    respond({ ok: false, reason: 'not_allowed_page' });
    return false;
  }

  const targetUrl = hasVaultCredentials
    ? withoutAutofillParam(urlString)
    : withAutofillParam(urlString);
  const fillOverrides = hasVaultCredentials
    ? {
        credentials: externalMessage.credentials,
        loginFields: externalMessage.loginFields,
      }
    : externalMessage && externalMessage.loginFields
      ? { loginFields: externalMessage.loginFields }
      : null;
  const fillMessage = buildFillMessage(pageConfig, fillOverrides);
  if (hasVaultCredentials) {
    fillMessage.vaultFill = true;
  }

  if (hasVaultCredentials) {
    console.log('[Practice] Opening demo tab', targetUrl);
  }

  chrome.tabs.create({ url: targetUrl }, function (tab) {
    if (chrome.runtime.lastError || !tab || !tab.id) {
      if (hasVaultCredentials && chrome.runtime.lastError) {
        console.log(
          '[Practice] tabs.create lastError:',
          chrome.runtime.lastError.message,
        );
      }
      respond({
        ok: false,
        reason: chrome.runtime.lastError
          ? chrome.runtime.lastError.message
          : 'no_tab',
      });
      return;
    }

    const tabId = tab.id;

    if (hasVaultCredentials) {
      console.log('[Practice] Demo tab created with id', tabId);
      waitForPracticeDemoTabReady(tabId, respond, function () {
        console.log('[Practice] Demo tab ready for fill, tab id', tabId);
        startPracticeVaultFill(tabId, fillMessage, respond);
      });
      return;
    }

    function onTabUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        sendFillWithRetry(tabId, fillMessage, 0, respond);
        return;
      }

      if (
        changeInfo.status === 'loading' &&
        changeInfo.url === 'chrome-error://chromewebdata/'
      ) {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        respond({ ok: false, reason: 'tab_load_error' });
      }
    }

    chrome.tabs.onUpdated.addListener(onTabUpdated);
  });

  return true;
}

const GENERIC_REAL_SITE_SCRIPT_FILES = {
  detect: [
    'generic/managed-target-eligibility.js',
    'generic/form-detector.js',
    'generic/field-mapper.js',
    'generic/login-form-detect.js',
  ],
  fill: [
    'generic/managed-target-eligibility.js',
    'generic/form-detector.js',
    'generic/field-mapper.js',
    'generic/fill-executor.js',
    'generic/generic-autofill.js',
    'generic/identity-first-autofill.js',
  ],
  identityFirst: [
    'generic/managed-target-eligibility.js',
    'generic/form-detector.js',
    'generic/field-mapper.js',
    'generic/fill-executor.js',
    'generic/identity-first-autofill.js',
  ],
  managed: [
    'generic/managed-target-eligibility.js',
    'generic/form-detector.js',
    'generic/fill-executor.js',
    'generic/validated-autofill.js',
  ],
};

const GENERIC_REAL_SITE_RETRY_DELAY_MS = 300;
const GENERIC_REAL_SITE_BOT_RETRY_DELAY_MS = 1000;
const GENERIC_REAL_SITE_MAX_ATTEMPTS = 60;
/** SPA banking portals often paint login inputs after first paint. Legacy/generic only. */
const GENERIC_REAL_SITE_INITIAL_DELAY_MS = 4000;
/**
 * Phase 117 D-117-17 — Managed Autofill must NOT inherit the legacy 4s post-load delay.
 * After URL match + top-frame inject path, attempt mappings immediately (readiness + adaptive retry).
 */
const MANAGED_AUTOFILL_INITIAL_DELAY_MS = 0;
/**
 * Phase 119 readiness_wait_inputs — Admin Login Page inspect only.
 * Generic product defaults for Assisted Mapping authoring (not hostname/service-tuned).
 * Normative readiness is poll/early-exit in page-structure-inspect; residual
 * post-load initialDelayMs on Admin inspect remains 0 and is subordinate.
 */
const ADMIN_INSPECT_READINESS_MAX_WAIT_MS = 10000;
const ADMIN_INSPECT_READINESS_POLL_MS = 250;
/** Bounded adaptive retry spacing for Managed mapped-target readiness (not a multi-second sleep). */
const MANAGED_AUTOFILL_RETRY_DELAY_MS = 300;
/**
 * Phase 120 §5D — post-failure assess-only probe offsets (diagnostic only).
 * Does NOT change fill-path retry timing (MANAGED_AUTOFILL_RETRY_DELAY_MS unchanged).
 */
const MANAGED_AUTOFILL_DIAG_LATE_PROBE_MS = [2000, 5000, 10000];
/** Time allowed for a heavy real-site login page to reach the target URL. */
const GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS = 120000;
/** Time allowed for detect/fill once the login page is ready (retries included). */
const GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS = 120000;

function genericRetryDelayMs(result) {
  if (result && result.reason === 'bot_interstitial') {
    return GENERIC_REAL_SITE_BOT_RETRY_DELAY_MS;
  }
  return GENERIC_REAL_SITE_RETRY_DELAY_MS;
}

/**
 * Prefer a successful frame result when scripts run with allFrames:true
 * (bank logins often live in an iframe, not the top document).
 */
function pickBestGenericFrameResult(results, fallbackReason) {
  if (!results || !results.length) {
    return { ok: false, reason: fallbackReason || 'no_result' };
  }

  var bestFail = null;
  for (var i = 0; i < results.length; i += 1) {
    var entry = results[i];
    var result = entry && entry.result;
    if (!result) {
      continue;
    }
    if (result.ok) {
      return result;
    }
    if (!bestFail) {
      bestFail = result;
      continue;
    }
    var filled = typeof result.filled === 'number' ? result.filled : 0;
    var bestFilled = typeof bestFail.filled === 'number' ? bestFail.filled : 0;
    if (filled > bestFilled) {
      bestFail = result;
    } else if (
      bestFail.reason === 'form_not_found' &&
      result.reason &&
      result.reason !== 'form_not_found'
    ) {
      bestFail = result;
    }
  }

  return bestFail || { ok: false, reason: fallbackReason || 'no_result' };
}

/** Phase 103 URL safety policy — user-initiated tile click is the trust boundary. */
function isAllowedGenericAutofillUrl(urlString) {
  try {
    var url = new URL(urlString);
    if (url.protocol === 'https:') {
      return true;
    }
    if (url.protocol === 'http:') {
      return (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]'
      );
    }
    return false;
  } catch (_error) {
    return false;
  }
}

function tabUrlMatchesGenericTarget(tabUrl, urlString) {
  if (!tabUrl) {
    return false;
  }

  var expectedPath = '';
  try {
    expectedPath = new URL(urlString).pathname.replace(/\/$/, '');
  } catch (_error) {
    expectedPath = '';
  }

  try {
    var expected = new URL(urlString);
    var parsed = new URL(tabUrl);
    if (parsed.origin !== expected.origin) {
      return false;
    }
    if (!expectedPath) {
      return parsed.hostname === expected.hostname;
    }
    var actualPath = parsed.pathname.replace(/\/$/, '');
    if (actualPath === expectedPath) {
      // Query params (e.g. users.php?act=login) are ignored after origin+path match.
      return true;
    }
    // SPA login portals may land on a child path under the requested login entry.
    return (
      actualPath.indexOf(expectedPath + '/') === 0 ||
      expectedPath.indexOf(actualPath + '/') === 0
    );
  } catch (_error) {
    return false;
  }
}

/**
 * D-121-72 — Hub fill runs in flight (STANDARD Managed + SPECIAL), by the Hub's run id.
 * Values hold only `cancel()`; no credentials.
 */
var hubFillRuns = {};

function hubFillRunId(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 64) : '';
}

/** HUB_MANAGED_AUTOFILL_CANCEL — unknown or finished run → no-op. Never closes the tab. */
function cancelHubFillRun(message, sendResponse) {
  var runId = hubFillRunId(message.runId);
  var hubRun = runId ? hubFillRuns[runId] : null;
  if (!hubRun) {
    sendResponse({ ok: true, cancelled: false });
    return false;
  }
  hubRun.cancel();
  sendResponse({ ok: true, cancelled: true });
  return false;
}

/**
 * @param {object} [options]
 * @param {number} [options.initialDelayMs] — post-URL-match delay before onTabReady.
 *   Defaults to GENERIC_REAL_SITE_INITIAL_DELAY_MS (legacy/generic 4s).
 *   Managed Autofill must pass MANAGED_AUTOFILL_INITIAL_DELAY_MS (0).
 * @param {object} [options.tabCreateProperties] — Managed-only placement hints
 *   (e.g. index, openerTabId). Legacy/generic must omit this.
 * @param {function(number): void} [options.onTabCreatedDiag] — Managed §5D only.
 * @param {string} [options.hubRunId] — D-121-72 Hub fill run (Managed / SPECIAL): a closed
 *   tab ends it (`tab_closed`), HUB_MANAGED_AUTOFILL_CANCEL ends it (`cancelled`).
 */
function openGenericRealSiteTab(urlString, sendResponse, sessionLabel, onTabReady, options) {
  if (!isAllowedGenericAutofillUrl(urlString)) {
    sendResponse({ ok: false, reason: 'url_not_allowed' });
    return false;
  }

  var hubRunId = options ? hubFillRunId(options.hubRunId) : '';
  if (hubRunId && hubFillRuns[hubRunId]) {
    sendResponse({ ok: false, reason: 'busy' });
    return false;
  }

  var initialDelayMs =
    options && typeof options.initialDelayMs === 'number'
      ? options.initialDelayMs
      : GENERIC_REAL_SITE_INITIAL_DELAY_MS;

  var placementHints =
    options && options.tabCreateProperties && typeof options.tabCreateProperties === 'object'
      ? options.tabCreateProperties
      : null;
  var hasManagedPlacement =
    placementHints &&
    (typeof placementHints.index === 'number' ||
      typeof placementHints.openerTabId === 'number');

  var respond = onceExternalSendResponse(sendResponse, sessionLabel);
  var settled = false;
  var readyWorkStarted = false;
  var operationTimeout = null;
  var runTimers = [];
  var runDetachers = [];

  function clearOperationTimeout() {
    if (operationTimeout) {
      clearTimeout(operationTimeout);
      operationTimeout = null;
    }
  }

  function finishSession(result) {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(tabLoadTimeout);
    clearOperationTimeout();
    // D-121-72: every timer / listener of the run goes with it — nothing runs after the answer.
    runTimers.splice(0).forEach(function (timer) {
      clearTimeout(timer);
    });
    runDetachers.splice(0).forEach(function (detach) {
      detach();
    });
    if (hubRunId && hubFillRuns[hubRunId] === hubRun) {
      delete hubFillRuns[hubRunId];
    }
    respond(result);
  }

  /** D-121-72 — run handle: `active()` is the checkpoint before every click / fill; `later` timers die with the run. */
  var run = {
    active: function () {
      return !settled;
    },
    later: function (fn, ms) {
      var timer = setTimeout(function () {
        var at = runTimers.indexOf(timer);
        if (at >= 0) runTimers.splice(at, 1);
        if (!settled) fn();
      }, ms);
      runTimers.push(timer);
    },
  };
  var hubRun = null;
  if (hubRunId) {
    hubRun = {
      cancel: function () {
        finishSession({ ok: false, reason: 'cancelled' });
      },
    };
    hubFillRuns[hubRunId] = hubRun;
  }

  function armOperationTimeout() {
    clearOperationTimeout();
    operationTimeout = setTimeout(function () {
      finishSession({ ok: false, reason: 'operation_timeout' });
    }, GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS);
  }

  var tabLoadTimeout = setTimeout(function () {
    if (settled || readyWorkStarted) {
      return;
    }
    finishSession({ ok: false, reason: 'tab_load_timeout' });
  }, GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS);

  function onTabCreated(tab) {
    if (chrome.runtime.lastError || !tab || !tab.id) {
      clearTimeout(tabLoadTimeout);
      finishSession({
        ok: false,
        reason: chrome.runtime.lastError
          ? chrome.runtime.lastError.message
          : 'no_tab',
      });
      return;
    }

    var tabId = tab.id;
    if (settled) {
      return;
    }

    if (options && typeof options.onTabCreatedDiag === 'function') {
      try {
        var detachDiag = options.onTabCreatedDiag(tabId);
        if (typeof detachDiag === 'function') runDetachers.push(detachDiag);
      } catch (_diagErr) {
        // Diagnostic must never block Managed/generic sessions.
      }
    }

    // D-121-72: the run's tab closed → the run ends now (STANDARD Managed and SPECIAL alike).
    if (hubRunId) {
      var onRunTabRemoved = function (removedTabId) {
        if (removedTabId === tabId) {
          finishSession({ ok: false, reason: 'tab_closed' });
        }
      };
      chrome.tabs.onRemoved.addListener(onRunTabRemoved);
      runDetachers.push(function () {
        chrome.tabs.onRemoved.removeListener(onRunTabRemoved);
      });
    }

    function startReadyWork() {
      if (readyWorkStarted || settled) {
        return;
      }
      readyWorkStarted = true;
      clearTimeout(tabLoadTimeout);
      armOperationTimeout();

      run.later(function () {
        onTabReady(tabId, finishSession, run);
      }, initialDelayMs);
    }

    function onTabUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) {
        return;
      }

      if (
        changeInfo.status === 'loading' &&
        changeInfo.url === 'chrome-error://chromewebdata/'
      ) {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        finishSession({ ok: false, reason: 'tab_load_error' });
        return;
      }

      if (changeInfo.status !== 'complete') {
        return;
      }

      chrome.tabs.get(updatedTabId, function (loadedTab) {
        if (chrome.runtime.lastError || !loadedTab) {
          return;
        }

        if (!tabUrlMatchesGenericTarget(loadedTab.url, urlString)) {
          return;
        }

        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        startReadyWork();
      });
    }

    chrome.tabs.onUpdated.addListener(onTabUpdated);
    runDetachers.push(function () {
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    });

    chrome.tabs.get(tabId, function (currentTab) {
      if (chrome.runtime.lastError || !currentTab) {
        return;
      }

      if (
        currentTab.status === 'complete' &&
        tabUrlMatchesGenericTarget(currentTab.url, urlString)
      ) {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        startReadyWork();
      }
    });
  }

  var createProps = { url: urlString };
  if (hasManagedPlacement) {
    if (typeof placementHints.index === 'number') {
      createProps.index = placementHints.index;
    }
    if (typeof placementHints.openerTabId === 'number') {
      createProps.openerTabId = placementHints.openerTabId;
    }
  }

  chrome.tabs.create(createProps, function (tab) {
    // D-117-19: Managed placement soft-fallback — retry URL-only if adjacent create fails.
    if (
      hasManagedPlacement &&
      (chrome.runtime.lastError || !tab || !tab.id)
    ) {
      chrome.tabs.create({ url: urlString }, onTabCreated);
      return;
    }
    onTabCreated(tab);
  });

  return true;
}

function runGenericDetectOnTab(tabId, loginFields, attempt, onDone) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId, allFrames: true },
      world: 'MAIN',
      files: GENERIC_REAL_SITE_SCRIPT_FILES.detect,
    },
    function () {
      if (chrome.runtime.lastError) {
        if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
          setTimeout(function () {
            runGenericDetectOnTab(tabId, loginFields, attempt + 1, onDone);
          }, GENERIC_REAL_SITE_RETRY_DELAY_MS);
          return;
        }
        onDone({
          ok: false,
          reason: chrome.runtime.lastError.message || 'script_injection_failed',
        });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId, allFrames: true },
          world: 'MAIN',
          func: function (fields) {
            if (typeof runGenericLoginFormDetection !== 'function') {
              return { ok: false, reason: 'detect_function_missing' };
            }
            return runGenericLoginFormDetection({
              loginFields: fields || undefined,
            });
          },
          args: [loginFields || null],
        },
        function (results) {
          if (chrome.runtime.lastError) {
            if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
              setTimeout(function () {
                runGenericDetectOnTab(tabId, loginFields, attempt + 1, onDone);
              }, GENERIC_REAL_SITE_RETRY_DELAY_MS);
              return;
            }
            onDone({
              ok: false,
              reason: chrome.runtime.lastError.message || 'detect_run_failed',
            });
            return;
          }

          var result = pickBestGenericFrameResult(results, 'no_result');

          if ((!result || !result.ok) && attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
            setTimeout(function () {
              runGenericDetectOnTab(tabId, loginFields, attempt + 1, onDone);
            }, genericRetryDelayMs(result));
            return;
          }

          onDone(Object.assign({ via: 'generic-detect' }, result || { ok: false }));
        },
      );
    },
  );
}

function runGenericAutofillOnTab(tabId, loginFields, credentials, attempt, onDone) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId, allFrames: true },
      world: 'MAIN',
      files: GENERIC_REAL_SITE_SCRIPT_FILES.fill,
    },
    function () {
      if (chrome.runtime.lastError) {
        if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
          setTimeout(function () {
            runGenericAutofillOnTab(
              tabId,
              loginFields,
              credentials,
              attempt + 1,
              onDone,
            );
          }, GENERIC_REAL_SITE_RETRY_DELAY_MS);
          return;
        }
        onDone({
          ok: false,
          reason: chrome.runtime.lastError.message || 'script_injection_failed',
        });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId, allFrames: true },
          world: 'MAIN',
          func: function (fields, creds) {
            if (typeof runGenericAutofill !== 'function') {
              return { ok: false, reason: 'autofill_function_missing' };
            }
            return runGenericAutofill({
              loginFields: fields,
              credentials: creds,
            });
          },
          args: [loginFields, credentials],
        },
        function (results) {
          if (chrome.runtime.lastError) {
            if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
              setTimeout(function () {
                runGenericAutofillOnTab(
                  tabId,
                  loginFields,
                  credentials,
                  attempt + 1,
                  onDone,
                );
              }, GENERIC_REAL_SITE_RETRY_DELAY_MS);
              return;
            }
            onDone({
              ok: false,
              reason: chrome.runtime.lastError.message || 'autofill_run_failed',
            });
            return;
          }

          var result = pickBestGenericFrameResult(results, 'no_result');

          if ((!result || !result.ok) && attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
            setTimeout(function () {
              runGenericAutofillOnTab(
                tabId,
                loginFields,
                credentials,
                attempt + 1,
                onDone,
              );
            }, genericRetryDelayMs(result));
            return;
          }

          onDone(Object.assign({ via: 'generic-autofill' }, result || { ok: false }));
        },
      );
    },
  );
}

function openPageAndDetectGenericLogin(urlString, loginFields, sendResponse) {
  return openGenericRealSiteTab(
    urlString,
    sendResponse,
    'generic-detect',
    function (tabId, finishSession) {
      runGenericDetectOnTab(tabId, loginFields, 0, finishSession);
    },
  );
}

const LOGIN_ENTRY_DISCOVERY_SCRIPT = 'discovery/login-entry-discovery.js';
const LOGIN_ENTRY_DISCOVERY_INITIAL_DELAY_MS = 1500;
const LOGIN_ENTRY_DISCOVERY_TAB_LOAD_TIMEOUT_MS = 120000;
const LOGIN_ENTRY_DISCOVERY_OPERATION_TIMEOUT_MS = 30000;
const LOGIN_ENTRY_DISCOVERY_RETRY_DELAY_MS = 300;
const LOGIN_ENTRY_DISCOVERY_MAX_ATTEMPTS = 25;

function isAllowedLoginEntryDiscoveryUrl(urlString) {
  try {
    var url = new URL(urlString);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch (_error) {
    return false;
  }
}

function normalizeDiscoveryHostname(hostname) {
  return String(hostname || '')
    .replace(/^www\./i, '')
    .toLowerCase();
}

/** Same consumer brand host (www / apex / login.* subdomains). */
function discoveryHostsCompatible(hostA, hostB) {
  var a = normalizeDiscoveryHostname(hostA);
  var b = normalizeDiscoveryHostname(hostB);
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  if (a.endsWith('.' + b) || b.endsWith('.' + a)) {
    return true;
  }

  function brandKey(host) {
    if (/\.(co|org|ac|gov|muni)\.il$/i.test(host)) {
      var withoutSuffix = host.replace(/\.(co|org|ac|gov|muni)\.il$/i, '');
      var labels = withoutSuffix.split('.').filter(Boolean);
      var brand = labels[labels.length - 1] || host;
      var suffix = host.match(/\.(co|org|ac|gov|muni)\.il$/i);
      return brand + (suffix ? suffix[0].toLowerCase() : '');
    }
    var parts = host.split('.').filter(Boolean);
    return parts.length >= 2 ? parts.slice(-2).join('.') : host;
  }

  return brandKey(a) === brandKey(b);
}

function tabUrlMatchesDiscoveryPrimary(tabUrl, primaryUrl) {
  if (!tabUrl) {
    return false;
  }

  // Ignore browser-internal pages while the target navigates.
  if (
    /^chrome:|^chrome-extension:|^about:|^edge:|^devtools:/i.test(tabUrl)
  ) {
    return false;
  }

  try {
    var expected = new URL(primaryUrl);
    var parsed = new URL(tabUrl);
    // Accept www↔apex and same-brand auth subdomains after redirects.
    // Exact origin matching caused live discovery to time out on most sites.
    return discoveryHostsCompatible(parsed.hostname, expected.hostname);
  } catch (_error) {
    return false;
  }
}

function refocusReturnTab(tabId) {
  if (!tabId) {
    return;
  }

  chrome.tabs.update(tabId, { active: true }, function () {
    if (chrome.runtime.lastError) {
      console.log('[LoginEntryDiscovery] refocus skipped:', chrome.runtime.lastError.message);
    }
  });
}

function closeDiscoveryTabSafely(tabId, onClosed) {
  if (!tabId) {
    if (onClosed) {
      onClosed();
    }
    return;
  }

  chrome.tabs.get(tabId, function (tab) {
    if (chrome.runtime.lastError || !tab) {
      if (onClosed) {
        onClosed();
      }
      return;
    }

    chrome.tabs.remove(tabId, function () {
      if (chrome.runtime.lastError) {
        console.log(
          '[LoginEntryDiscovery] tab close skipped:',
          chrome.runtime.lastError.message,
        );
      }
      if (onClosed) {
        onClosed();
      }
    });
  });
}

/**
 * Discovery session for HUB_LOGIN_ENTRY_DISCOVERY (AC-108-16).
 *
 * Operator 2026-07-14: a dedicated minimized/unfocused popup window stole OS focus
 * (Hub went behind other apps). Prefer the prior approach: inactive tab in the
 * **same** Hub window (`active: false`), then refocus the Hub tab on finish.
 * Brief tab-strip flash is acceptable; losing the browser window is not.
 */
function openLoginEntryDiscoveryTab(primaryUrl, sendResponse, onTabReady) {
  if (!isAllowedLoginEntryDiscoveryUrl(primaryUrl)) {
    sendResponse({ ok: false, reason: 'url_not_allowed' });
    return false;
  }

  var respond = onceExternalSendResponse(sendResponse, 'login-entry-discovery');
  var settled = false;
  var readyWorkStarted = false;
  var operationTimeout = null;
  var discoveryTabId = null;
  var returnTabId = null;

  function clearOperationTimeout() {
    if (operationTimeout) {
      clearTimeout(operationTimeout);
      operationTimeout = null;
    }
  }

  function finishSession(result) {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(tabLoadTimeout);
    clearOperationTimeout();

    var tabToClose = discoveryTabId;
    discoveryTabId = null;

    closeDiscoveryTabSafely(tabToClose, function () {
      refocusReturnTab(returnTabId);
      respond(result);
    });
  }

  function armOperationTimeout() {
    clearOperationTimeout();
    operationTimeout = setTimeout(function () {
      if (settled) {
        return;
      }
      finishSession({ ok: false, reason: 'operation_timeout' });
    }, LOGIN_ENTRY_DISCOVERY_OPERATION_TIMEOUT_MS);
  }

  var tabLoadTimeout = setTimeout(function () {
    if (settled || readyWorkStarted) {
      return;
    }
    finishSession({ ok: false, reason: 'tab_load_timeout' });
  }, LOGIN_ENTRY_DISCOVERY_TAB_LOAD_TIMEOUT_MS);

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (activeTabs) {
    returnTabId = activeTabs && activeTabs[0] ? activeTabs[0].id : null;

    chrome.tabs.create({ url: primaryUrl, active: false }, function (tab) {
      if (chrome.runtime.lastError || !tab || !tab.id) {
        clearTimeout(tabLoadTimeout);
        finishSession({
          ok: false,
          reason: chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : 'no_tab',
        });
        return;
      }

      var tabId = tab.id;
      discoveryTabId = tabId;

      function startReadyWork() {
        if (readyWorkStarted || settled) {
          return;
        }
        readyWorkStarted = true;
        clearTimeout(tabLoadTimeout);
        armOperationTimeout();

        setTimeout(function () {
          if (settled) {
            return;
          }
          onTabReady(tabId, finishSession);
        }, LOGIN_ENTRY_DISCOVERY_INITIAL_DELAY_MS);
      }

      function onTabUpdated(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) {
          return;
        }

        if (
          changeInfo.status === 'loading' &&
          changeInfo.url === 'chrome-error://chromewebdata/'
        ) {
          chrome.tabs.onUpdated.removeListener(onTabUpdated);
          finishSession({ ok: false, reason: 'tab_load_error' });
          return;
        }

        if (changeInfo.status !== 'complete') {
          return;
        }

        chrome.tabs.get(updatedTabId, function (loadedTab) {
          if (chrome.runtime.lastError || !loadedTab) {
            return;
          }

          if (!tabUrlMatchesDiscoveryPrimary(loadedTab.url, primaryUrl)) {
            return;
          }

          chrome.tabs.onUpdated.removeListener(onTabUpdated);
          startReadyWork();
        });
      }

      chrome.tabs.onUpdated.addListener(onTabUpdated);

      chrome.tabs.get(tabId, function (currentTab) {
        if (chrome.runtime.lastError || !currentTab) {
          return;
        }

        if (
          currentTab.status === 'complete' &&
          tabUrlMatchesDiscoveryPrimary(currentTab.url, primaryUrl)
        ) {
          chrome.tabs.onUpdated.removeListener(onTabUpdated);
          startReadyWork();
        }
      });
    });
  });

  return true;
}

function runLoginEntryDiscoveryOnTab(tabId, primaryUrl, attempt, onDone) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
      files: [LOGIN_ENTRY_DISCOVERY_SCRIPT],
    },
    function () {
      if (chrome.runtime.lastError) {
        if (attempt < LOGIN_ENTRY_DISCOVERY_MAX_ATTEMPTS) {
          setTimeout(function () {
            runLoginEntryDiscoveryOnTab(tabId, primaryUrl, attempt + 1, onDone);
          }, LOGIN_ENTRY_DISCOVERY_RETRY_DELAY_MS);
          return;
        }
        onDone({
          __transportError: true,
          reason: chrome.runtime.lastError.message || 'script_injection_failed',
        });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          func: async function (primary) {
            if (typeof runLoginEntryDiscoveryInPage !== 'function') {
              return {
                success: false,
                primaryUrl: primary,
                reason: 'discovery_function_missing',
              };
            }

            return await runLoginEntryDiscoveryInPage(primary);
          },
          args: [primaryUrl],
        },
        function (results) {
          if (chrome.runtime.lastError) {
            if (attempt < LOGIN_ENTRY_DISCOVERY_MAX_ATTEMPTS) {
              setTimeout(function () {
                runLoginEntryDiscoveryOnTab(tabId, primaryUrl, attempt + 1, onDone);
              }, LOGIN_ENTRY_DISCOVERY_RETRY_DELAY_MS);
              return;
            }
            onDone({
              __transportError: true,
              reason: chrome.runtime.lastError.message || 'discovery_run_failed',
            });
            return;
          }

          var discovery =
            results && results[0] ? results[0].result : { success: false, reason: 'no_result' };

          if (
            (!discovery || discovery.reason === 'discovery_function_missing') &&
            attempt < LOGIN_ENTRY_DISCOVERY_MAX_ATTEMPTS
          ) {
            setTimeout(function () {
              runLoginEntryDiscoveryOnTab(tabId, primaryUrl, attempt + 1, onDone);
            }, LOGIN_ENTRY_DISCOVERY_RETRY_DELAY_MS);
            return;
          }

          onDone(discovery || { success: false, reason: 'no_result' });
        },
      );
    },
  );
}

function openPageAndDiscoverLoginEntry(primaryUrl, sendResponse) {
  return openLoginEntryDiscoveryTab(primaryUrl, sendResponse, function (tabId, finishSession) {
    runLoginEntryDiscoveryOnTab(tabId, primaryUrl, 0, function (discovery) {
      if (!discovery || typeof discovery !== 'object') {
        finishSession({ ok: false, reason: 'discovery_no_result' });
        return;
      }

      if (discovery.__transportError) {
        finishSession({ ok: false, reason: discovery.reason || 'discovery_run_failed' });
        return;
      }

      finishSession({
        ok: true,
        via: 'login-entry-discovery',
        discovery: discovery,
      });
    });
  });
}

function runIdentityFirstAutofillOnTab(tabId, loginFields, credentials, attempt, onDone) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId, allFrames: true },
      world: 'MAIN',
      files: GENERIC_REAL_SITE_SCRIPT_FILES.identityFirst,
    },
    function () {
      if (chrome.runtime.lastError) {
        if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
          setTimeout(function () {
            runIdentityFirstAutofillOnTab(
              tabId,
              loginFields,
              credentials,
              attempt + 1,
              onDone,
            );
          }, GENERIC_REAL_SITE_RETRY_DELAY_MS);
          return;
        }
        onDone({
          ok: false,
          reason: chrome.runtime.lastError.message || 'script_injection_failed',
          filled: 0,
        });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId, allFrames: true },
          world: 'MAIN',
          func: function (fields, creds) {
            if (typeof runIdentityFirstAutofill !== 'function') {
              return { ok: false, reason: 'identity_first_function_missing', filled: 0 };
            }
            return runIdentityFirstAutofill({
              loginFields: fields,
              credentials: creds,
            });
          },
          args: [loginFields, credentials],
        },
        function (results) {
          if (chrome.runtime.lastError) {
            if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
              setTimeout(function () {
                runIdentityFirstAutofillOnTab(
                  tabId,
                  loginFields,
                  credentials,
                  attempt + 1,
                  onDone,
                );
              }, GENERIC_REAL_SITE_RETRY_DELAY_MS);
              return;
            }
            onDone({
              ok: false,
              reason: chrome.runtime.lastError.message || 'identity_first_run_failed',
              filled: 0,
            });
            return;
          }

          var result = pickBestGenericFrameResult(results, 'no_result');

          if ((!result || !result.ok) && attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
            setTimeout(function () {
              runIdentityFirstAutofillOnTab(
                tabId,
                loginFields,
                credentials,
                attempt + 1,
                onDone,
              );
            }, genericRetryDelayMs(result));
            return;
          }

          onDone(
            Object.assign({ via: 'identity-first-autofill' }, result || { ok: false, filled: 0 }),
          );
        },
      );
    },
  );
}

function openPageAndIdentityFirstAutofill(urlString, loginFields, credentials, sendResponse) {
  if (
    !credentials ||
    typeof credentials !== 'object' ||
    !loginFields ||
    !Array.isArray(loginFields)
  ) {
    sendResponse({ ok: false, reason: 'missing_vault_payload', filled: 0 });
    return false;
  }

  return openGenericRealSiteTab(
    urlString,
    sendResponse,
    'identity-first-autofill',
    function (tabId, finishSession) {
      runIdentityFirstAutofillOnTab(tabId, loginFields, credentials, 0, finishSession);
    },
  );
}

function openPageAndGenericAutofill(urlString, loginFields, credentials, sendResponse) {
  if (
    !credentials ||
    typeof credentials !== 'object' ||
    !loginFields ||
    !Array.isArray(loginFields)
  ) {
    sendResponse({ ok: false, reason: 'missing_vault_payload' });
    return false;
  }

  return openGenericRealSiteTab(
    urlString,
    sendResponse,
    'generic-autofill',
    function (tabId, finishSession) {
      runGenericAutofillOnTab(tabId, loginFields, credentials, 0, finishSession);
    },
  );
}

function isManagedAutofillRetryable(result) {
  if (!result || result.ok) {
    return false;
  }
  return (
    result.reason === 'targets_not_ready' ||
    result.reason === 'zero_match' ||
    result.reason === 'managed_function_missing' ||
    result.reason === 'executor_missing'
  );
}

/** Phase 120 §5D — Managed diagnostic logs only (never credentials). */
function logManagedAutofillDiag(event, fields) {
  console.log('[ManagedAutofillDiag]', event, fields || {});
}

function attachManagedAutofillDiagLifecycle(tabId) {
  function onUpdated(updatedTabId, changeInfo, tab) {
    if (updatedTabId !== tabId) {
      return;
    }
    logManagedAutofillDiag('onUpdated', {
      tabId: tabId,
      status: changeInfo && changeInfo.status,
      url: (changeInfo && changeInfo.url) || (tab && tab.url) || undefined,
    });
  }

  function onRemoved(removedTabId) {
    if (removedTabId !== tabId) {
      return;
    }
    logManagedAutofillDiag('onRemoved', { tabId: tabId });
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
  }

  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onRemoved.addListener(onRemoved);

  return function detachManagedAutofillDiagLifecycle() {
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
  };
}

function enrichManagedTargetsNotReadyResult(tabId, result, done) {
  chrome.tabs.get(tabId, function (tab) {
    var gone = Boolean(chrome.runtime.lastError) || !tab;
    var tabUrl = gone ? undefined : tab.url;
    var enriched = {
      ok: false,
      reason: result && result.reason ? result.reason : 'targets_not_ready',
      fieldId: result && result.fieldId,
      locator: result && result.locator,
      detail: result && result.detail,
      observedUrl: result && result.observedUrl,
      tabId: tabId,
      finalObservedUrl: tabUrl || (result && result.observedUrl) || undefined,
      tabExistsAtFailure: !gone,
    };
    if (result && result.fillDiagnostics) {
      enriched.fillDiagnostics = result.fillDiagnostics;
    }
    logManagedAutofillDiag('targets_not_ready', {
      tabId: enriched.tabId,
      fieldId: enriched.fieldId,
      locator: enriched.locator,
      detail: enriched.detail,
      observedUrl: enriched.observedUrl,
      finalObservedUrl: enriched.finalObservedUrl,
      tabExistsAtFailure: enriched.tabExistsAtFailure,
    });
    done(enriched);
  });
}

/**
 * Phase 120 §5D — assess-only late probes AFTER Hub already received targets_not_ready.
 * No credentials. No fill. Does not alter fill-path retry timing.
 */
function scheduleManagedLateReadinessProbes(tabId, payload) {
  var mappings =
    payload && Array.isArray(payload.fieldMappings) ? payload.fieldMappings : [];
  var allowedOrigin = payload && payload.allowedOrigin;
  var offsets = MANAGED_AUTOFILL_DIAG_LATE_PROBE_MS;

  for (var i = 0; i < offsets.length; i += 1) {
    (function (offsetMs) {
      setTimeout(function () {
        chrome.tabs.get(tabId, function (tab) {
          if (chrome.runtime.lastError || !tab) {
            logManagedAutofillDiag('lateProbe', {
              offsetMs: offsetMs,
              tabId: tabId,
              tabExists: false,
            });
            return;
          }
          chrome.scripting.executeScript(
            {
              target: { tabId: tabId, frameIds: [0] },
              world: 'MAIN',
              files: GENERIC_REAL_SITE_SCRIPT_FILES.managed,
            },
            function () {
              if (chrome.runtime.lastError) {
                logManagedAutofillDiag('lateProbe', {
                  offsetMs: offsetMs,
                  tabId: tabId,
                  tabExists: true,
                  error: chrome.runtime.lastError.message,
                });
                return;
              }
              chrome.scripting.executeScript(
                {
                  target: { tabId: tabId, frameIds: [0] },
                  world: 'MAIN',
                  func: function (opts) {
                    if (typeof assessManagedTargetsReady !== 'function') {
                      return { ready: false, reason: 'assess_fn_missing' };
                    }
                    return assessManagedTargetsReady(opts);
                  },
                  args: [
                    {
                      allowedOrigin: allowedOrigin,
                      fieldMappings: mappings,
                    },
                  ],
                },
                function (results) {
                  var assessment =
                    results && results[0] && results[0].result
                      ? results[0].result
                      : { ready: false, reason: 'no_result' };
                  logManagedAutofillDiag('lateProbe', {
                    offsetMs: offsetMs,
                    tabId: tabId,
                    tabExists: true,
                    tabUrl: tab.url,
                    ready: assessment.ready === true,
                    reason: assessment.reason,
                    fieldId: assessment.fieldId,
                    locator: assessment.locator,
                    detail: assessment.detail,
                    observedUrl: assessment.observedUrl,
                  });
                },
              );
            },
          );
        });
      }, offsetMs);
    })(offsets[i]);
  }
}

/** D-121-72 — `run` (Hub fill run): no step after the run ended; retries die with it. */
function runManagedAutofillOnTab(tabId, payload, attempt, onDone, run) {
  if (run && !run.active()) {
    return;
  }
  var retryLater = run ? run.later : setTimeout;
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId, frameIds: [0] },
      world: 'MAIN',
      files: GENERIC_REAL_SITE_SCRIPT_FILES.managed,
    },
    function () {
      if (run && !run.active()) {
        return;
      }
      if (chrome.runtime.lastError) {
        if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
          retryLater(function () {
            runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone, run);
          }, MANAGED_AUTOFILL_RETRY_DELAY_MS);
          return;
        }
        onDone({
          ok: false,
          reason: chrome.runtime.lastError.message || 'script_injection_failed',
        });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId, frameIds: [0] },
          world: 'MAIN',
          func: function (opts) {
            if (typeof runManagedAutofill !== 'function') {
              return { ok: false, reason: 'managed_function_missing' };
            }
            return runManagedAutofill(opts);
          },
          args: [
            {
              allowedOrigin: payload.allowedOrigin,
              fieldMappings: payload.fieldMappings,
              credentials: payload.credentials,
              diagnosticPath:
                typeof payload.diagnosticPath === 'string' && payload.diagnosticPath.trim()
                  ? payload.diagnosticPath.trim()
                  : 'unknown',
            },
          ],
        },
        function (results) {
          if (run && !run.active()) {
            return;
          }
          if (chrome.runtime.lastError) {
            if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
              retryLater(function () {
                runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone, run);
              }, MANAGED_AUTOFILL_RETRY_DELAY_MS);
              return;
            }
            onDone({
              ok: false,
              reason: chrome.runtime.lastError.message || 'managed_run_failed',
            });
            return;
          }

          var result =
            results && results[0] && results[0].result
              ? results[0].result
              : { ok: false, reason: 'no_result' };

          if (result && result.fillDiagnostics) {
            logManagedAutofillDiag('fillDiagnostics', {
              runId: result.fillDiagnostics.runId,
              path: result.fillDiagnostics.path,
              stampCount: Array.isArray(result.fillDiagnostics.stamps)
                ? result.fillDiagnostics.stamps.length
                : 0,
              stamps: result.fillDiagnostics.stamps,
            });
          }

          if (
            (!result || !result.ok) &&
            attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS &&
            isManagedAutofillRetryable(result)
          ) {
            retryLater(function () {
              runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone, run);
            }, MANAGED_AUTOFILL_RETRY_DELAY_MS);
            return;
          }

          onDone(result || { ok: false, reason: 'no_result' });
        },
      );
    },
  );
}

/**
 * Phase 120.2-AP — Admin Managed-parity readiness probe (assess-only).
 * Same assessManagedTargetsReady contract as Managed fill. No credentials. No fill.
 * Reuses existing Managed retry spacing — does not add timing as uniqueness substitute.
 */
function runManagedReadinessProbeOnTab(tabId, payload, attempt, onDone) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId, frameIds: [0] },
      world: 'MAIN',
      files: GENERIC_REAL_SITE_SCRIPT_FILES.managed,
    },
    function () {
      if (chrome.runtime.lastError) {
        if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
          setTimeout(function () {
            runManagedReadinessProbeOnTab(tabId, payload, attempt + 1, onDone);
          }, MANAGED_AUTOFILL_RETRY_DELAY_MS);
          return;
        }
        onDone({
          ok: false,
          reason: chrome.runtime.lastError.message || 'script_injection_failed',
        });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId, frameIds: [0] },
          world: 'MAIN',
          func: function (opts) {
            if (typeof assessManagedTargetsReady !== 'function') {
              return { ready: false, reason: 'assess_fn_missing' };
            }
            return assessManagedTargetsReady(opts);
          },
          args: [
            {
              allowedOrigin: payload.allowedOrigin,
              fieldMappings: payload.fieldMappings,
            },
          ],
        },
        function (results) {
          if (chrome.runtime.lastError) {
            if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
              setTimeout(function () {
                runManagedReadinessProbeOnTab(tabId, payload, attempt + 1, onDone);
              }, MANAGED_AUTOFILL_RETRY_DELAY_MS);
              return;
            }
            onDone({
              ok: false,
              reason: chrome.runtime.lastError.message || 'probe_run_failed',
            });
            return;
          }

          var assessment =
            results && results[0] && results[0].result
              ? results[0].result
              : { ready: false, reason: 'no_result' };

          if (assessment && assessment.ready === true) {
            var mappingCount = Array.isArray(payload.fieldMappings)
              ? payload.fieldMappings.length
              : 0;
            onDone({
              ok: true,
              ready: true,
              mappingCount: mappingCount,
              reason: 'managed_readiness_ok',
            });
            return;
          }

          var probeFail = {
            ok: false,
            ready: false,
            reason: (assessment && assessment.reason) || 'targets_not_ready',
            fieldId: assessment && assessment.fieldId,
            locator: assessment && assessment.locator,
            detail: assessment && assessment.detail,
            observedUrl: assessment && assessment.observedUrl,
          };

          if (
            attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS &&
            isManagedAutofillRetryable(probeFail)
          ) {
            setTimeout(function () {
              runManagedReadinessProbeOnTab(tabId, payload, attempt + 1, onDone);
            }, MANAGED_AUTOFILL_RETRY_DELAY_MS);
            return;
          }

          onDone(probeFail);
        },
      );
    },
  );
}

/**
 * Phase 120.2-AP — open Login Entry and run assess-only Managed readiness probe.
 * Top document only. No vault credentials in payload.
 */
function openPageAndManagedReadinessProbe(message, sendResponse, sender) {
  var loginEntryUrl =
    message && typeof message.loginEntryUrl === 'string'
      ? message.loginEntryUrl.trim()
      : '';
  var allowedOrigin =
    message && typeof message.allowedOrigin === 'string'
      ? message.allowedOrigin.trim()
      : '';
  var fieldMappings =
    message && Array.isArray(message.fieldMappings) ? message.fieldMappings : null;

  if (!loginEntryUrl || !allowedOrigin || !fieldMappings || fieldMappings.length === 0) {
    sendResponse({ ok: false, reason: 'missing_probe_payload' });
    return false;
  }

  // Explicitly reject any credentials key — assess-only contract.
  if (message && message.credentials) {
    sendResponse({ ok: false, reason: 'credentials_forbidden_on_probe' });
    return false;
  }

  var probeOptions = {
    initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS,
  };
  var placement = buildManagedTabCreateProperties(sender);
  if (placement) {
    probeOptions.tabCreateProperties = placement;
  }

  var payload = {
    allowedOrigin: allowedOrigin,
    fieldMappings: fieldMappings,
  };

  return openGenericRealSiteTab(
    loginEntryUrl,
    sendResponse,
    'admin-managed-readiness-probe',
    function (tabId, finishSession) {
      runManagedReadinessProbeOnTab(tabId, payload, 0, function (result) {
        finishSession(result || { ok: false, reason: 'no_result' });
      });
    },
    probeOptions,
  );
}

/**
 * D-117-19 — Managed tab adjacent to Hub when sender.tab is available.
 * Placement-only soft fallback when sender.tab missing (default strip placement).
 */
function buildManagedTabCreateProperties(sender) {
  if (
    !sender ||
    !sender.tab ||
    typeof sender.tab.id !== 'number' ||
    typeof sender.tab.index !== 'number'
  ) {
    return null;
  }
  return {
    index: sender.tab.index + 1,
    openerTabId: sender.tab.id,
  };
}

/**
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
  var loginEntryUrl =
    message && typeof message.loginEntryUrl === 'string'
      ? message.loginEntryUrl.trim()
      : '';
  var allowedOrigin =
    message && typeof message.allowedOrigin === 'string'
      ? message.allowedOrigin.trim()
      : '';
  var fieldId =
    message && typeof message.fieldId === 'string' ? message.fieldId.trim() : '';
  if (!loginEntryUrl || !allowedOrigin || !fieldId) {
    sendResponse({ ok: false, reason: 'missing_visual_mapping_payload' });
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

  var visualOptions = {
    initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS,
  };
  var placement = buildManagedTabCreateProperties(sender);
  if (placement) {
    visualOptions.tabCreateProperties = placement;
  }

  return openGenericRealSiteTab(
    loginEntryUrl,
    respondAndDisarm,
    'admin-visual-mapping',
    function (tabId, finishSession) {
      session.tabId = tabId;
      var navAbortArmed = false;

      function onNavAbort(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) {
          return;
        }
        if (typeof changeInfo.url === 'string' && changeInfo.url) {
          try {
            var nextOrigin = new URL(changeInfo.url).origin;
            if (nextOrigin !== allowedOrigin) {
              chrome.tabs.onUpdated.removeListener(onNavAbort);
              finishSession({
                ok: false,
                reason: 'origin_mismatch',
                fieldId: fieldId,
              });
            }
          } catch (err) {
            chrome.tabs.onUpdated.removeListener(onNavAbort);
            finishSession({
              ok: false,
              reason: 'origin_mismatch',
              fieldId: fieldId,
            });
          }
        }
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId, frameIds: [0] },
          world: 'MAIN',
          files: [
            'generic/managed-target-eligibility.js',
            'generic/locator-determinism.js',
            'generic/visual-target-pick.js',
          ],
        },
        function () {
          if (chrome.runtime.lastError) {
            finishSession({
              ok: false,
              reason:
                chrome.runtime.lastError.message || 'visual_pick_inject_failed',
              fieldId: fieldId,
            });
            return;
          }
          if (session.cancelled) {
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
              chrome.tabs.onUpdated.removeListener(onNavAbort);
              if (chrome.runtime.lastError) {
                finishSession({
                  ok: false,
                  reason:
                    chrome.runtime.lastError.message ||
                    'visual_pick_run_failed',
                  fieldId: fieldId,
                });
                return;
              }
              var result =
                results && results[0] && results[0].result
                  ? results[0].result
                  : {
                      ok: false,
                      reason: 'no_result',
                      fieldId: fieldId,
                    };
              finishSession(result);
            },
          );
        },
      );
    },
    visualOptions,
  );
}

/**
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
 * Phase 118 Admin inspect — SafePageStructure only (no values / fill / submit).
 */
function openPageAndInspectLoginStructure(message, sendResponse, sender) {
  var loginEntryUrl =
    message && typeof message.loginEntryUrl === 'string'
      ? message.loginEntryUrl.trim()
      : '';
  var allowedOrigin =
    message && typeof message.allowedOrigin === 'string'
      ? message.allowedOrigin.trim()
      : '';
  if (!loginEntryUrl || !allowedOrigin) {
    sendResponse({ ok: false, reason: 'missing_inspect_payload' });
    return false;
  }

  var inspectOptions = {
    // Subordinate settle only; readiness_wait_inputs poll/early-exit is normative.
    initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS,
  };
  var placement = buildManagedTabCreateProperties(sender);
  if (placement) {
    inspectOptions.tabCreateProperties = placement;
  }

  return openGenericRealSiteTab(
    loginEntryUrl,
    sendResponse,
    'admin-login-page-inspect',
    function (tabId, finishSession) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId, frameIds: [0] },
          world: 'MAIN',
          files: [
            'generic/managed-target-eligibility.js',
            'generic/locator-determinism.js',
            'generic/page-structure-inspect.js',
          ],
        },
        function () {
          if (chrome.runtime.lastError) {
            finishSession({
              ok: false,
              reason: chrome.runtime.lastError.message || 'inspect_inject_failed',
            });
            return;
          }
          chrome.scripting.executeScript(
            {
              target: { tabId: tabId, frameIds: [0] },
              world: 'MAIN',
              func: function (expectedOrigin, maxTotalWaitMs, pollIntervalMs) {
                if (
                  typeof collectSafePageStructureWithReadiness !== 'function'
                ) {
                  return Promise.resolve({
                    ok: false,
                    reason: 'inspect_fn_missing',
                  });
                }
                return collectSafePageStructureWithReadiness({
                  expectedOrigin: expectedOrigin,
                  maxTotalWaitMs: maxTotalWaitMs,
                  pollIntervalMs: pollIntervalMs,
                });
              },
              args: [
                allowedOrigin,
                ADMIN_INSPECT_READINESS_MAX_WAIT_MS,
                ADMIN_INSPECT_READINESS_POLL_MS,
              ],
            },
            function (results) {
              if (chrome.runtime.lastError) {
                finishSession({
                  ok: false,
                  reason:
                    chrome.runtime.lastError.message || 'inspect_run_failed',
                });
                return;
              }
              var result =
                results && results[0] && results[0].result
                  ? results[0].result
                  : { ok: false, reason: 'no_result' };
              finishSession(result);
            },
          );
        },
      );
    },
    inspectOptions,
  );
}

/** D-121-25 / 121.1-IF — SPECIAL Visual pick bound + the armed tab and frames (for cancel). */
var SPECIAL_VISUAL_PICK_DEFAULT_TIMEOUT_MS = 60000;
var SPECIAL_VISUAL_PICK_MAX_TIMEOUT_MS = 120000;
var specialVisualPickArmed = null;

/**
 * Phase 121.1 §4.6 / D-121-21 — open OR reuse SPECIAL authoring tab.
 * §4.6.1 / D-121-27: Hub session tab (message.tabId) first; else prefer the most
 * recently accessed already-open same-origin authoring tab; else open authoringUrl.
 * MUST NOT use Hub active tab when origin mismatches.
 * After opener progression, same-origin revealed tab is reused (no entry reopen).
 */
function ensureSpecialAuthoringTab(message, callback) {
  var allowedOrigin =
    message && typeof message.allowedOrigin === 'string'
      ? message.allowedOrigin.trim()
      : '';
  var authoringUrl =
    message && typeof message.authoringUrl === 'string'
      ? message.authoringUrl.trim()
      : '';

  if (!allowedOrigin) {
    callback({ ok: false, reason: 'missing_inspect_payload' });
    return;
  }

  function originOf(urlString) {
    try {
      return new URL(urlString).origin;
    } catch (_err) {
      return null;
    }
  }

  function isUsableAuthoringTab(tab) {
    if (!tab || typeof tab.id !== 'number' || typeof tab.url !== 'string') {
      return false;
    }
    if (
      tab.url.indexOf('chrome:') === 0 ||
      tab.url.indexOf('chrome-extension:') === 0 ||
      tab.url.indexOf('edge:') === 0 ||
      tab.url.indexOf('about:') === 0
    ) {
      return false;
    }
    return originOf(tab.url) === allowedOrigin;
  }

  function waitTabComplete(tabId, done) {
    var settled = false;
    var timeout = setTimeout(function () {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      done('tab_load_timeout');
    }, GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS);

    function finish(err) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      done(err || null);
    }

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === 'complete') {
        chrome.tabs.get(tabId, function (tab) {
          if (chrome.runtime.lastError || !isUsableAuthoringTab(tab)) {
            finish('origin_mismatch');
            return;
          }
          finish(null);
        });
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId, function (tab) {
      if (chrome.runtime.lastError) {
        finish('tab_unavailable');
        return;
      }
      if (tab && tab.status === 'complete' && isUsableAuthoringTab(tab)) {
        finish(null);
      }
    });
  }

  function openAuthoringUrl() {
    if (!authoringUrl || !isAllowedGenericAutofillUrl(authoringUrl)) {
      callback({ ok: false, reason: 'missing_authoring_url' });
      return;
    }
    if (originOf(authoringUrl) !== allowedOrigin) {
      // Fail-closed: resolved URL must match expected origin (§4.7 + origin gate).
      callback({ ok: false, reason: 'origin_mismatch' });
      return;
    }
    chrome.tabs.create({ url: authoringUrl, active: true }, function (tab) {
      if (chrome.runtime.lastError || !tab || typeof tab.id !== 'number') {
        callback({
          ok: false,
          reason: chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : 'no_tab',
        });
        return;
      }
      waitTabComplete(tab.id, function (err) {
        if (err) {
          callback({ ok: false, reason: err });
          return;
        }
        callback({ ok: true, tabId: tab.id, opened: true, reused: false });
      });
    });
  }

  // D-121-27: fallback = most recently accessed same-origin tab (not query order).
  function findOrOpen() {
    chrome.tabs.query({}, function (tabs) {
      if (chrome.runtime.lastError) {
        callback({
          ok: false,
          reason: chrome.runtime.lastError.message || 'tab_query_failed',
        });
        return;
      }
      var best = pickMostRecentlyAccessedTab(
        (Array.isArray(tabs) ? tabs : []).filter(isUsableAuthoringTab),
      );
      if (best) {
        callback({
          ok: true,
          tabId: best.id,
          opened: false,
          reused: true,
          sessionTab: false,
        });
        return;
      }
      openAuthoringUrl();
    });
  }

  // D-121-27: Hub session tab (message.tabId) wins while it exists and matches origin.
  if (message && typeof message.tabId === 'number') {
    chrome.tabs.get(message.tabId, function (tab) {
      if (!chrome.runtime.lastError && isUsableAuthoringTab(tab)) {
        callback({ ok: true, tabId: tab.id, opened: false, reused: true, sessionTab: true });
        return;
      }
      findOrOpen();
    });
    return;
  }

  findOrOpen();
}

/** D-121-27 — highest `lastAccessed` wins; ties / missing values keep earlier entry. */
function pickMostRecentlyAccessedTab(tabs) {
  var best = null;
  var bestAt = -1;
  for (var i = 0; i < tabs.length; i += 1) {
    var at = typeof tabs[i].lastAccessed === 'number' ? tabs[i].lastAccessed : 0;
    if (best === null || at > bestAt) {
      best = tabs[i];
      bestAt = at;
    }
  }
  return best;
}

/**
 * D-121-27 — bring the SPECIAL authoring tab to front (activate + focus window)
 * before a continuation click or Visual arm, so the Admin sees the tab the system uses.
 * Best-effort: reports whether activation succeeded; never changes the target tab.
 */
function activateSpecialAuthoringTab(tabId, done) {
  chrome.tabs.update(tabId, { active: true }, function (tab) {
    if (chrome.runtime.lastError || !tab) {
      done(false);
      return;
    }
    if (typeof tab.windowId !== 'number') {
      done(true);
      return;
    }
    chrome.windows.update(tab.windowId, { focused: true }, function () {
      void chrome.runtime.lastError;
      done(true);
    });
  });
}

/**
 * D-121-27 — tag a SPECIAL response with the (origin-verified) session tab so the
 * Hub can resend it as `tabId`. Only called after the tab passed the origin gate.
 */
function withAuthoringTab(result, tabId, ensured, activated) {
  var out = result && typeof result === 'object' ? result : { ok: false, reason: 'no_result' };
  out.authoringTabId = tabId;
  out.authoringTabReused = Boolean(ensured && ensured.reused === true);
  out.authoringTabOpened = Boolean(ensured && ensured.opened === true);
  if (typeof activated === 'boolean') {
    out.authoringTabActivated = activated;
  }
  return out;
}

function rejectIfReopenLoginEntryRequested(message, sendResponse) {
  if (message && message.reopenLoginEntry === true) {
    sendResponse({
      ok: false,
      reason: 'reopen_login_entry_forbidden',
      reopenLoginEntry: true,
    });
    return true;
  }
  return false;
}

/**
 * 121.1-IF — SPECIAL authoring frame surface (authoring only).
 * STANDARD handlers stay frame 0. frameIds never leave the extension; the Hub
 * only sees { frameLocator, frameOrigin } descriptors and frameKey strings.
 */
var SPECIAL_INSPECT_FILES = [
  'generic/managed-target-eligibility.js',
  'generic/locator-determinism.js',
  'generic/page-structure-inspect.js',
];
var SPECIAL_PICK_FILES = [
  'generic/managed-target-eligibility.js',
  'generic/locator-determinism.js',
  'generic/visual-target-pick.js',
];
var SPECIAL_CORRELATION_FILES = [
  'generic/locator-determinism.js',
  'generic/frame-correlation.js',
];
var SPECIAL_RESERVED_ACTION_KINDS = ['final_submit'];
var SPECIAL_READINESS_POLL_MS = 400;
var SPECIAL_READINESS_DEFAULT_TIMEOUT_MS = 8000;
var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;
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
var SPECIAL_VISUAL_NON_WINNING_REASONS = [
  'visual_pick_superseded',
  'visual_pick_superseded_other_frame',
  'visual_pick_cancelled',
  'visual_pick_timeout',
  'visual_pick_fn_missing',
  'visual_pick_inject_failed',
  'visual_pick_run_failed',
  'origin_mismatch',
  'no_result',
];

function specialFrameProbe() {
  var isTop = false;
  var isDepth1 = false;
  try {
    isTop = window === window.top;
    isDepth1 = !isTop && window.parent === window.top;
  } catch (_e) {
    isTop = false;
    isDepth1 = false;
  }
  return {
    origin: String(location.origin || ''),
    protocol: String(location.protocol || ''),
    isTop: isTop,
    isDepth1: isDepth1,
  };
}

function specialIsHttpsExactOrigin(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    var u = new URL(value);
    return u.protocol === 'https:' && u.origin === value;
  } catch (_e) {
    return false;
  }
}

/**
 * D-121-36 — the frame's initial document (not yet navigated): origin empty or
 * "null", or a non-HTTP(S) protocol (about:blank may inherit its parent's origin).
 */
function specialIsLoadingFrameDocument(origin, protocol) {
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return true;
  if (typeof protocol === 'string' && protocol !== '') {
    return protocol !== 'https:' && protocol !== 'http:';
  }
  return !/^https?:\/\//i.test(origin);
}

function specialFrameKeyOf(descriptor) {
  return descriptor ? descriptor.frameLocator + '|' + descriptor.frameOrigin : 'top';
}

function specialFrameDescriptorOf(record) {
  if (!record || record.frameId === 0) return null;
  return { frameLocator: record.frameLocator || null, frameOrigin: record.origin };
}

function specialEmptyUnsupported() {
  return {
    nested: 0,
    nonHttps: 0,
    notInjectable: 0,
    shadowCredential: 0,
    notAddressable: 0,
    correlationUnavailable: 0,
  };
}

/**
 * D-121-29 exact-one rule: a nonce maps to a frameId only if exactly one frame
 * received it AND that frame received exactly one nonce of this attempt.
 * Nonces not sent in this attempt are ignored. Returns one entry per nonce:
 * { state: 'ok'|'none'|'ambiguous', frameId|null }.
 */
function specialMatchFrameNonces(nonces, receipts) {
  var sent = (nonces || []).filter(function (n) {
    return typeof n === 'string' && n;
  });
  var receiversByNonce = {};
  var countByFrame = {};
  (receipts || []).forEach(function (r) {
    if (!r || typeof r.frameId !== 'number' || r.frameId === 0 || !Array.isArray(r.result)) return;
    var seen = {};
    r.result.forEach(function (n) {
      if (typeof n !== 'string' || sent.indexOf(n) < 0 || seen[n]) return;
      seen[n] = true;
      (receiversByNonce[n] = receiversByNonce[n] || []).push(r.frameId);
      countByFrame[r.frameId] = (countByFrame[r.frameId] || 0) + 1;
    });
  });
  return (nonces || []).map(function (n) {
    var receivers = typeof n === 'string' && n ? receiversByNonce[n] : null;
    if (!receivers || receivers.length === 0) return { state: 'none', frameId: null };
    if (receivers.length !== 1 || countByFrame[receivers[0]] !== 1) {
      return { state: 'ambiguous', frameId: null };
    }
    return { state: 'ok', frameId: receivers[0] };
  });
}

/**
 * D-121-29 handshake: (1) nonce listener into all frames (ISOLATED, idempotent),
 * (2) `send` runs in frame 0 (ISOLATED) and posts fresh nonces into iframe
 * elements, (3) after a bounded wait read back from all frames. Only a failure
 * of the handshake itself yields frame_correlation_unavailable.
 */
function specialFrameNonceHandshake(tabId, send, cb) {
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

/**
 * Probe every frame of the (already R1-checked) tab and correlate depth-1
 * frames to exact-one iframe locators via the nonce handshake. No webNavigation,
 * no URL / size / order guessing; correlation failure is reported (fail-closed
 * for frames), never silent.
 */
function enumerateSpecialAuthoringFrames(tabId, allowedOrigin, cb, opts) {
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
      var probes = {};
      (probeResults || []).forEach(function (r) {
        if (r && typeof r.frameId === 'number' && r.result) probes[r.frameId] = r.result;
      });
      var top = probes[0];
      if (!top || top.origin !== allowedOrigin) {
        cb({ ok: false, reason: 'origin_mismatch' });
        return;
      }
      if (probeTimedOut) {
        finish(null, 'frame_probe_timeout');
        return;
      }
      specialFrameNonceHandshake(
        tabId,
        {
          func: function () {
            if (typeof __collectFrameCorrelation !== 'function') {
              return { ok: false, reason: 'frame_correlation_unavailable' };
            }
            return __collectFrameCorrelation();
          },
          bounded: bounded,
          trace: trace,
        },
        function (hs) {
          if (!hs.ok) {
            finish(null, hs.reason || 'frame_correlation_unavailable');
            return;
          }
          var elements = Array.isArray(hs.sent.frames) ? hs.sent.frames : [];
          finish(
            elements.map(function (f, i) {
              var m = hs.matches[i];
              return {
                frameId: m.frameId,
                handshake: m.state,
                frameLocator: f.frameLocator || null,
                visible: Boolean(f.visible),
                rectArea: f.rectArea || 0,
              };
            }),
            null,
          );
        },
      );

      function finish(iframes, correlationError) {
        var records = [
          {
            frameId: 0,
            origin: top.origin,
            frameLocator: null,
            visible: true,
            status: 'top',
          },
        ];
        var unsupported = specialEmptyUnsupported();
        if (probeTimedOut) unsupported.correlationUnavailable += 1;
        var correlatedById = {};
        (iframes || []).forEach(function (f) {
          if (f && typeof f.frameId === 'number') correlatedById[f.frameId] = f;
        });
        Object.keys(probes).forEach(function (key) {
          var id = Number(key);
          if (id === 0) return;
          var p = probes[id];
          if (!p || p.isTop) return;
          if (!p.isDepth1) {
            records.push({
              frameId: id,
              origin: p.origin,
              frameLocator: null,
              visible: true,
              status: 'nested',
            });
            unsupported.nested += 1;
            return;
          }
          if (correlationError) {
            unsupported.correlationUnavailable += 1;
            return;
          }
          var f = correlatedById[id];
          var visible = Boolean(f && f.visible);
          if (p.protocol !== 'https:') {
            records.push({
              frameId: id,
              origin: p.origin,
              frameLocator: null,
              visible: visible,
              status: 'depth1_non_https',
            });
            if (visible) unsupported.nonHttps += 1;
            return;
          }
          if (!f || !f.frameLocator) {
            records.push({
              frameId: id,
              origin: p.origin,
              frameLocator: null,
              visible: visible,
              status: 'not_addressable',
            });
            if (visible) unsupported.notAddressable += 1;
            return;
          }
          records.push({
            frameId: id,
            origin: p.origin,
            frameLocator: f.frameLocator,
            visible: visible,
            status: 'depth1_https',
          });
        });
        (iframes || []).forEach(function (f) {
          if (!f || !f.visible) return;
          if (f.handshake === 'ambiguous') {
            unsupported.notAddressable += 1;
            return;
          }
          if (typeof f.frameId !== 'number' || !probes[f.frameId]) {
            records.push({
              frameId: null,
              origin: '',
              frameLocator: f.frameLocator || null,
              visible: true,
              status: 'not_injectable',
            });
            unsupported.notInjectable += 1;
          }
        });
        cb({
          ok: true,
          records: records,
          unsupported: unsupported,
          correlationError: correlationError || null,
        });
      }
  }
}

/**
 * Resolve a stored { frameLocator, frameOrigin } descriptor to a live frameId:
 * exact-one iframe match, depth-1, live origin === declared origin.
 * opts.loadingIsPending (readiness polling only): a frame still on its initial
 * document → { reason: 'frame_loading' } instead of frame_origin_mismatch.
 */
function resolveDeclaredFrame(tabId, allowedOrigin, descriptor, cb, opts) {
  var loadingIsPending = Boolean(opts && opts.loadingIsPending === true);
  // D-121-60: opts.bounded (authoring click target) — a timeout fails closed, never skipped.
  var bounded = Boolean(opts && opts.bounded === true);
  if (
    !descriptor ||
    typeof descriptor.frameLocator !== 'string' ||
    !descriptor.frameLocator.trim() ||
    !specialIsHttpsExactOrigin(descriptor.frameOrigin)
  ) {
    cb({ ok: false, reason: 'invalid_frame' });
    return;
  }
  specialFrameNonceHandshake(
    tabId,
    {
      func: function (frameLocator, expectedTopOrigin) {
        if (String(location.origin || '') !== expectedTopOrigin) {
          return { ok: false, reason: 'origin_mismatch' };
        }
        if (typeof __resolveFrameByLocator !== 'function') {
          return { ok: false, reason: 'frame_correlation_unavailable' };
        }
        return __resolveFrameByLocator(frameLocator);
      },
      args: [descriptor.frameLocator, allowedOrigin],
      bounded: bounded,
    },
    function (hs) {
      if (!hs.ok) {
        cb({ ok: false, reason: hs.reason || 'frame_missing' });
        return;
      }
      var m = hs.matches[0];
      if (!m || m.state === 'none') {
        cb({ ok: false, reason: 'frame_missing' });
        return;
      }
      if (m.state !== 'ok') {
        cb({ ok: false, reason: 'frame_ambiguous' });
        return;
      }
      var frameId = m.frameId;
      specialAuthoringExec(
        bounded,
        { target: { tabId: tabId, frameIds: [frameId] }, func: specialFrameProbe },
        function (probe, probeErr) {
          if (probeErr) {
            cb({ ok: false, reason: 'frame_missing' });
            return;
          }
          var p = probe && probe[0] && probe[0].result;
          if (!p) {
            cb({ ok: false, reason: 'frame_missing' });
            return;
          }
          if (!p.isDepth1) {
            cb({ ok: false, reason: 'frame_not_depth1' });
            return;
          }
          if (p.origin !== descriptor.frameOrigin) {
            if (loadingIsPending && specialIsLoadingFrameDocument(p.origin, p.protocol)) {
              cb({ ok: false, reason: 'frame_loading', liveOrigin: p.origin });
              return;
            }
            cb({ ok: false, reason: 'frame_origin_mismatch', liveOrigin: p.origin });
            return;
          }
          cb({ ok: true, frameId: frameId });
        },
      );
    },
  );
}

function specialInjectThenRun(tabId, frameId, files, run, cb, bounded) {
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

function specialAuthoringTabGate(message, sendResponse, extra, onReady) {
  var allowedOrigin =
    message && typeof message.allowedOrigin === 'string' ? message.allowedOrigin.trim() : '';
  ensureSpecialAuthoringTab(message, function (ensured) {
    if (!ensured || !ensured.ok || typeof ensured.tabId !== 'number') {
      sendResponse(
        Object.assign({ ok: false, reason: (ensured && ensured.reason) || 'no_authoring_tab' }, extra),
      );
      return;
    }
    var tabId = ensured.tabId;
    chrome.tabs.get(tabId, function (tab) {
      if (chrome.runtime.lastError || !tab || typeof tab.url !== 'string') {
        sendResponse(
          Object.assign(
            {
              ok: false,
              reason: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'tab_unavailable',
            },
            extra,
          ),
        );
        return;
      }
      try {
        if (new URL(tab.url).origin !== allowedOrigin) {
          sendResponse(Object.assign({ ok: false, reason: 'origin_mismatch' }, extra));
          return;
        }
      } catch (_err) {
        sendResponse(Object.assign({ ok: false, reason: 'origin_mismatch' }, extra));
        return;
      }
      onReady(tabId, ensured, allowedOrigin);
    });
  });
}

/**
 * Eligible credential inputs across top + visible depth-1 HTTPS frames: Set of "frameKey::locator".
 * D-121-60 (authoring click): every frame call is bounded; a frame that does not answer in time is
 * listed in `skipped` (frameKey → true) and contributes no entries (discovery only).
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
    // D-121-61: visible depth-1 frames with no exact-one locator (frameIds never leave the extension).
    var unaddressable = {};
    en.records.forEach(function (r) {
      if (r.status === 'not_addressable' && r.visible && typeof r.frameId === 'number') unaddressable[r.frameId] = true;
    });
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
            if (trace) trace('snapshot_done', { ms: Date.now() - started, entries: entries.length, skipped: Object.keys(skipped).length, unaddressable: Object.keys(unaddressable).length });
            cb({ ok: true, entries: entries, skipped: skipped, unaddressable: unaddressable });
          }
        },
        true,
      );
    });
  }, { bounded: true, trace: trace });
}

/**
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
        func: function (origin, locator, target) {
          var liveOrigin = String(location.origin || '');
          if (liveOrigin !== origin) {
            return {
              met: false,
              originMismatch: true,
              liveOrigin: liveOrigin,
              liveProtocol: String(location.protocol || ''),
            };
          }
          // D-121-63 B: readiness into an action-only step = its exit: exact-one + visible / interactable.
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
      },
      function (r) {
        if (r && r.originMismatch) {
          // D-121-36: a depth-1 frame still on its initial document is loading, not foreign.
          if (frameId !== 0 && specialIsLoadingFrameDocument(r.liveOrigin, r.liveProtocol)) {
            cb({ ok: true, met: false });
            return;
          }
          cb({
            ok: false,
            reason: frameId === 0 ? 'origin_mismatch' : 'frame_origin_mismatch',
            liveOrigin: typeof r.liveOrigin === 'string' ? r.liveOrigin : '',
          });
          return;
        }
        cb({ ok: true, met: Boolean(r && r.met === true) });
      },
    );
  }
  if (!readiness.frame) {
    checkIn(0, allowedOrigin);
    return;
  }
  resolveDeclaredFrame(
    tabId,
    allowedOrigin,
    readiness.frame,
    function (resolved) {
      if (!resolved.ok) {
        if (resolved.reason === 'frame_missing' || resolved.reason === 'frame_loading') {
          cb({ ok: true, met: false });
          return;
        }
        cb({ ok: false, reason: resolved.reason, liveOrigin: resolved.liveOrigin });
        return;
      }
      checkIn(resolved.frameId, readiness.frame.frameOrigin);
    },
    { loadingIsPending: true },
  );
}

function specialSameFrameMessage(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.frameLocator === b.frameLocator && a.frameOrigin === b.frameOrigin;
}

/**
 * Phase 121.1 §4.6 / 121.1-IF — inspect SPECIAL authoring tab surfaces
 * (top document + depth-1 HTTPS frames). R1 (top origin === allowedOrigin)
 * runs first. Legacy page/actionCandidates = the top surface.
 */
function inspectCurrentAuthoringTab(message, sendResponse, _sender) {
  if (rejectIfReopenLoginEntryRequested(message, sendResponse)) {
    return false;
  }
  var allowedOrigin =
    message && typeof message.allowedOrigin === 'string'
      ? message.allowedOrigin.trim()
      : '';
  if (!allowedOrigin) {
    sendResponse({ ok: false, reason: 'missing_inspect_payload' });
    return false;
  }

  specialAuthoringTabGate(message, sendResponse, {}, function (tabId, ensured) {
    enumerateSpecialAuthoringFrames(tabId, allowedOrigin, function (en) {
      if (!en.ok) {
        sendResponse(withAuthoringTab({ ok: false, reason: en.reason }, tabId, ensured));
        return;
      }
      var targets = en.records.filter(function (r) {
        return (
          r.status === 'top' ||
          ((r.status === 'depth1_https' || r.status === 'not_addressable') && r.visible)
        );
      });
      var collected = {};
      var pending = targets.length;
      targets.forEach(function (record) {
        specialInjectThenRun(
          tabId,
          record.frameId,
          SPECIAL_INSPECT_FILES,
          {
            func: function (expectedOrigin, maxTotalWaitMs, pollIntervalMs) {
              if (typeof collectSafePageStructureWithReadiness !== 'function') {
                return Promise.resolve({ ok: false, reason: 'inspect_fn_missing' });
              }
              return collectSafePageStructureWithReadiness({
                expectedOrigin: expectedOrigin,
                maxTotalWaitMs: maxTotalWaitMs,
                pollIntervalMs: pollIntervalMs,
                stableLocators: true,
              }).then(function (result) {
                var actions =
                  typeof collectSpecialAuthoringActionCandidates === 'function'
                    ? collectSpecialAuthoringActionCandidates({ stableLocators: true })
                    : [];
                if (result && typeof result === 'object') {
                  result.actionCandidates = Array.isArray(actions) ? actions : [];
                  result.authoringTabId = null;
                }
                return result;
              });
            },
            args: [
              record.frameId === 0 ? allowedOrigin : record.origin,
              ADMIN_INSPECT_READINESS_MAX_WAIT_MS,
              ADMIN_INSPECT_READINESS_POLL_MS,
            ],
          },
          function (result) {
            collected[record.frameId] = result;
            pending -= 1;
            if (pending === 0) done();
          },
        );
      });

      function done() {
        var topResult = collected[0] || { ok: false, reason: 'no_result' };
        if (!topResult.ok) {
          sendResponse(withAuthoringTab(topResult, tabId, ensured));
          return;
        }
        var unsupported = Object.assign(specialEmptyUnsupported(), en.unsupported);
        var surfaces = [];
        targets.forEach(function (record) {
          var r = collected[record.frameId];
          if (!r || r.ok !== true) return;
          var shadow =
            r.page && typeof r.page.shadowCredentialCandidates === 'number'
              ? r.page.shadowCredentialCandidates
              : 0;
          unsupported.shadowCredential += shadow;
          var descriptor = specialFrameDescriptorOf(record);
          surfaces.push({
            frameKey:
              record.frameId === 0
                ? 'top'
                : record.frameLocator
                  ? specialFrameKeyOf(descriptor)
                  : 'unaddressable|' + record.origin,
            frame: descriptor,
            status: record.status,
            page: r.page || null,
            actionCandidates: Array.isArray(r.actionCandidates) ? r.actionCandidates : [],
          });
        });
        var response = Object.assign({}, topResult, {
          surfaces: surfaces,
          unsupported: unsupported,
          frameCorrelation: en.correlationError ? 'unavailable' : 'ok',
        });
        sendResponse(withAuthoringTab(response, tabId, ensured));
      }
    });
  });
  return true;
}

/**
 * Phase 121.1 §4.6 / 121.1-IF — Visual Mapping on SPECIAL authoring tab.
 * Arms the pick per frame (top + depth-1 HTTPS pick; nested frames report_only);
 * the first real click wins and every other frame is disarmed.
 */
function visualMappingCurrentAuthoringTab(message, sendResponse, _sender) {
  if (rejectIfReopenLoginEntryRequested(message, sendResponse)) {
    return false;
  }
  var allowedOrigin =
    message && typeof message.allowedOrigin === 'string'
      ? message.allowedOrigin.trim()
      : '';
  var fieldId =
    message && typeof message.fieldId === 'string' ? message.fieldId.trim() : '';
  if (!allowedOrigin || !fieldId) {
    sendResponse({ ok: false, reason: 'missing_visual_mapping_payload' });
    return false;
  }
  var pickTimeoutMs =
    typeof message.pickTimeoutMs === 'number' && message.pickTimeoutMs > 0
      ? Math.min(message.pickTimeoutMs, SPECIAL_VISUAL_PICK_MAX_TIMEOUT_MS)
      : SPECIAL_VISUAL_PICK_DEFAULT_TIMEOUT_MS;
  // D-121-35 §2: opener / transition pick uses the action pick mode; default is field pick.
  var pickTarget = message.pickTarget === 'action' ? 'action' : 'field';

  specialAuthoringTabGate(message, sendResponse, { fieldId: fieldId }, function (tabId, ensured) {
    // D-121-27: bring the session tab to front before arming the pick.
    activateSpecialAuthoringTab(tabId, function (activated) {
      function reply(result) {
        sendResponse(withAuthoringTab(result, tabId, ensured, activated));
      }
      enumerateSpecialAuthoringFrames(tabId, allowedOrigin, function (en) {
        if (!en.ok) {
          reply({ ok: false, reason: en.reason, fieldId: fieldId });
          return;
        }
        var targets = en.records.filter(function (r) {
          if (r.status === 'top' || r.status === 'nested') return true;
          return (r.status === 'depth1_https' || r.status === 'not_addressable') && r.visible;
        });
        var recordsById = {};
        targets.forEach(function (r) {
          recordsById[r.frameId] = r;
        });
        var armedFrameIds = targets.map(function (r) {
          return r.frameId;
        });
        specialVisualPickArmed = { tabId: tabId, frameIds: armedFrameIds };
        var settled = {};
        var remaining = targets.length;
        var finished = false;

        function isWinning(result) {
          return (
            result &&
            typeof result === 'object' &&
            SPECIAL_VISUAL_NON_WINNING_REASONS.indexOf(result.reason) < 0
          );
        }

        function clearArmed() {
          if (specialVisualPickArmed && specialVisualPickArmed.tabId === tabId) {
            specialVisualPickArmed = null;
          }
        }

        function disarmOtherFrames(winnerFrameId) {
          armedFrameIds.forEach(function (fid) {
            if (fid === winnerFrameId || settled[fid]) return;
            chrome.scripting.executeScript(
              {
                target: { tabId: tabId, frameIds: [fid] },
                world: 'MAIN',
                func: function () {
                  if (typeof __disarmVisualTargetPick === 'function') {
                    return __disarmVisualTargetPick('visual_pick_superseded_other_frame') === true;
                  }
                  return false;
                },
              },
              function () {
                void chrome.runtime.lastError;
              },
            );
          });
        }

        function tagWinner(frameId, result) {
          var record = recordsById[frameId];
          var out = Object.assign({}, result, { fieldId: fieldId, unsupported: en.unsupported });
          if (!record || record.status === 'top') {
            out.frameKey = 'top';
            out.frame = null;
            return out;
          }
          if (record.status === 'nested') {
            return Object.assign(out, { ok: false, reason: 'nested_frame_unsupported' });
          }
          if (result && result.ok === true && result.frameOrigin && result.frameOrigin !== record.origin) {
            return Object.assign(out, { ok: false, reason: 'frame_origin_mismatch' });
          }
          if (record.status === 'not_addressable') {
            return Object.assign(out, {
              ok: false,
              reason: result && result.ok === true ? 'frame_not_addressable' : out.reason,
              frameOrigin: record.origin,
            });
          }
          var descriptor = specialFrameDescriptorOf(record);
          out.frame = descriptor;
          out.frameKey = specialFrameKeyOf(descriptor);
          return out;
        }

        function aggregateNoWinner() {
          var ordered = armedFrameIds.map(function (fid) {
            return settled[fid];
          });
          var pick = function (reason) {
            return ordered.filter(function (r) {
              return r && r.reason === reason;
            })[0];
          };
          var chosen =
            pick('visual_pick_cancelled') ||
            pick('visual_pick_timeout') ||
            pick('visual_pick_superseded') ||
            settled[0] ||
            ordered[0] || { ok: false, reason: 'no_result' };
          return Object.assign({}, chosen, { fieldId: fieldId, unsupported: en.unsupported });
        }

        targets.forEach(function (record) {
          specialInjectThenRun(
            tabId,
            record.frameId,
            SPECIAL_PICK_FILES,
            {
              func: function (expectedOrigin, mappedFieldId, boundMs, pickMode, targetKind) {
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
                  timeoutMs: boundMs,
                  mode: pickMode,
                  pickTarget: targetKind,
                  stableLocators: true,
                });
              },
              args: [
                record.frameId === 0 ? allowedOrigin : record.origin,
                fieldId,
                pickTimeoutMs,
                record.status === 'nested' ? 'report_only' : 'pick',
                pickTarget,
              ],
            },
            function (result) {
              var normalized =
                result && result.injectFailed
                  ? { ok: false, reason: 'visual_pick_inject_failed', fieldId: fieldId }
                  : result;
              settled[record.frameId] = normalized;
              remaining -= 1;
              if (!finished && isWinning(normalized)) {
                finished = true;
                clearArmed();
                disarmOtherFrames(record.frameId);
                reply(tagWinner(record.frameId, normalized));
                return;
              }
              if (!finished && remaining === 0) {
                finished = true;
                clearArmed();
                reply(aggregateNoWinner());
              }
            },
          );
        });
      });
    });
  });
  return true;
}

/**
 * D-121-25 / 121.1-IF — disarm the armed SPECIAL Visual pick in every frame
 * of the session tab (same origin gate). Pending START resolves as cancelled.
 */
function cancelVisualMappingCurrentAuthoringTab(message, sendResponse, _sender) {
  var allowedOrigin =
    message && typeof message.allowedOrigin === 'string'
      ? message.allowedOrigin.trim()
      : '';
  if (!allowedOrigin) {
    sendResponse({ ok: false, disarmed: false, reason: 'missing_cancel_payload' });
    return false;
  }
  // D-121-27: disarm in the Hub session tab (the tab the pick was armed in);
  // armed-tab record is the fallback when the Hub has no session tab.
  var armedTabId = specialVisualPickArmed ? specialVisualPickArmed.tabId : null;
  var tabId = typeof message.tabId === 'number' ? message.tabId : armedTabId;
  if (typeof tabId !== 'number') {
    sendResponse({ ok: true, disarmed: false, reason: 'no_armed_pick' });
    return false;
  }
  chrome.tabs.get(tabId, function (tab) {
    if (chrome.runtime.lastError || !tab || typeof tab.url !== 'string') {
      if (armedTabId === tabId) specialVisualPickArmed = null;
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
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId, allFrames: true },
        world: 'MAIN',
        func: function () {
          if (typeof __disarmVisualTargetPick === 'function') {
            return __disarmVisualTargetPick('visual_pick_cancelled') === true;
          }
          return false;
        },
      },
      function (results) {
        if (chrome.runtime.lastError) {
          sendResponse({
            ok: false,
            disarmed: false,
            reason: chrome.runtime.lastError.message || 'visual_pick_cancel_failed',
            authoringTabId: tabId,
          });
          return;
        }
        var disarmed = (results || []).some(function (r) {
          return r && r.result === true;
        });
        sendResponse({ ok: true, disarmed: disarmed, authoringTabId: tabId });
      },
    );
  });
  return true;
}

/**
 * D-121-35 §4 (G4) — test-proof integrity. Page-side (ISOLATED world, every
 * frame): flag trusted user gestures between the Ext click and readiness.
 * Nothing is stored beyond the window; collect removes the listeners.
 */
function specialGestureWatchInstall(token) {
  var KEY = '__pvSpecialGestureWatch';
  var existing = window[KEY];
  if (existing && existing.token === token) return { installed: true };
  if (existing && typeof existing.remove === 'function') existing.remove();
  var state = { token: token, seen: false, remove: null };
  var events = ['pointerdown', 'keydown'];
  function onGesture(event) {
    if (event && event.isTrusted === true) state.seen = true;
  }
  events.forEach(function (type) {
    window.addEventListener(type, onGesture, true);
  });
  state.remove = function () {
    events.forEach(function (type) {
      window.removeEventListener(type, onGesture, true);
    });
  };
  window[KEY] = state;
  return { installed: true };
}

function specialGestureWatchCollect(token) {
  var KEY = '__pvSpecialGestureWatch';
  var state = window[KEY];
  if (!state) return { present: false, seen: false };
  var seen = state.token === token && state.seen === true;
  if (typeof state.remove === 'function') state.remove();
  try {
    delete window[KEY];
  } catch (_err) {
    window[KEY] = undefined;
  }
  return { present: true, seen: seen };
}

/** A success is not proven when a trusted user gesture occurred before readiness. */
function specialGestureVerdict(outcome, watch) {
  if (!outcome || outcome.ok !== true) return outcome;
  if (!watch || watch.ok !== true) return { ok: false, reason: 'gesture_watch_unavailable' };
  if (watch.seen === true) return { ok: false, reason: 'user_gesture_during_test' };
  return outcome;
}

function specialGestureWatchRun(tabId, func, token, cb, bounded) {
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

function specialGestureToken() {
  var bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.prototype.map
    .call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    })
    .join('');
}

/**
 * Phase 121.1 / 121.1-IF — click approved authoring action (top or declared
 * depth-1 frame). Requires approvedForAuthoringContinuation === true.
 * final_submit is reserved. No fill / submit / vault secrets.
 * R3: success only when the declared readiness field (or, in reveal mode, a
 * newly revealed credential input) is present — never the clicked opener.
 */
function authoringClickApprovedAction(message, sendResponse, _sender) {
  if (rejectIfReopenLoginEntryRequested(message, sendResponse)) {
    return false;
  }
  if (message && (message.fillCredentials === true || message.submitForm === true)) {
    sendResponse({ ok: false, reason: 'fill_or_submit_forbidden' });
    return false;
  }
  if (message && SPECIAL_RESERVED_ACTION_KINDS.indexOf(message.kind) >= 0) {
    sendResponse({ ok: false, reason: 'reserved_action_kind' });
    return false;
  }
  if (!message || message.approvedForAuthoringContinuation !== true) {
    sendResponse({ ok: false, reason: 'unapproved_authoring_click' });
    return false;
  }
  var allowedOrigin =
    typeof message.allowedOrigin === 'string' ? message.allowedOrigin.trim() : '';
  var locator = typeof message.locator === 'string' ? message.locator.trim() : '';
  if (!allowedOrigin || !locator || message.locatorType !== 'css') {
    sendResponse({ ok: false, reason: 'missing_click_payload' });
    return false;
  }
  var clickFrame =
    message.frame && typeof message.frame === 'object' ? message.frame : null;
  var readinessMode = message.readinessMode === 'declared' ? 'declared' : 'reveal';
  // D-121-47 (G8): single-step floating authoring tests only; declared mode never.
  var requirePasswordSurface =
    readinessMode === 'reveal' && message.requirePasswordSurface === true;
  // D-121-63 D: a multi-step transition test (reveal mode) may end on a screen with actions only.
  var allowActionsOnly =
    readinessMode === 'reveal' && !requirePasswordSurface && message.allowActionsOnly === true;
  // D-121-63 B: declared readiness into an action-only step names a button, not a field.
  var readinessTarget = message.readinessTarget === 'action' ? 'action' : 'field';
  var readiness =
    message.readiness && typeof message.readiness === 'object' ? message.readiness : null;
  var readinessLocator =
    readiness && typeof readiness.locator === 'string' ? readiness.locator.trim() : '';
  var readinessFrame =
    readiness && readiness.frame && typeof readiness.frame === 'object' ? readiness.frame : null;
  var readinessTimeoutMs =
    readiness && typeof readiness.timeoutMs === 'number' && readiness.timeoutMs > 0
      ? readiness.timeoutMs
      : SPECIAL_READINESS_DEFAULT_TIMEOUT_MS;
  if (readinessMode === 'declared') {
    if (!readinessLocator) {
      sendResponse({ ok: false, reason: 'missing_click_payload' });
      return false;
    }
    if (readinessLocator === locator && specialSameFrameMessage(readinessFrame, clickFrame)) {
      sendResponse({ ok: false, reason: 'readiness_is_self' });
      return false;
    }
  }

  var trace = specialAuthoringTraceStart();
  trace('received', { mode: readinessMode, framed: Boolean(clickFrame), requirePassword: requirePasswordSurface });
  specialAuthoringTabGate(message, sendResponse, {}, function (tabId, ensured) {
    trace('tab_ready', { reused: Boolean(ensured && ensured.reused) });
    // D-121-27: bring the session tab to front before the continuation click.
    activateSpecialAuthoringTab(tabId, function (activated) {
      var gestureToken = null;
      // D-121-60: frames skipped (no answer in time) in the pre-click snapshot are never compared.
      var skippedBefore = {};
      var pollTicks = 0;

      function send(outcome) {
        var result = Object.assign({ readinessMode: readinessMode }, outcome);
        trace('reply', { ok: result.ok === true, reason: result.ok === true ? null : result.reason || null });
        sendResponse(withAuthoringTab(result, tabId, ensured, activated));
      }

      function reply(outcome) {
        if (!gestureToken) {
          send(outcome);
          return;
        }
        var token = gestureToken;
        gestureToken = null;
        specialGestureWatchRun(tabId, specialGestureWatchCollect, token, function (watch) {
          trace('gesture_collect', { ok: watch.ok === true, timedOut: watch.timedOut === true });
          send(specialGestureVerdict(outcome, watch));
        }, true);
      }

      // Idempotent per token: re-run on each poll tick to cover frames that load after the click.
      function refreshGestureWatch(next) {
        if (!gestureToken) {
          next();
          return;
        }
        specialGestureWatchRun(tabId, specialGestureWatchInstall, gestureToken, function () {
          next();
        }, true);
      }

      function resolveClickFrame(next) {
        if (!clickFrame) {
          next(0);
          return;
        }
        resolveDeclaredFrame(tabId, allowedOrigin, clickFrame, function (resolved) {
          trace('click_frame', { ok: resolved.ok === true, reason: resolved.ok ? null : resolved.reason });
          if (!resolved.ok) {
            reply({ ok: false, reason: resolved.reason, liveOrigin: resolved.liveOrigin });
            return;
          }
          next(resolved.frameId);
        }, { bounded: true });
      }

      function clickIn(frameId, next) {
        var token = specialGestureToken();
        specialGestureWatchRun(tabId, specialGestureWatchInstall, token, function (installed) {
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
      }

      function clickInFrame(frameId, next) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId, frameIds: [frameId] },
            world: 'MAIN',
            func: function (clickLocator, expectedOrigin) {
              if (String(location.origin || '') !== expectedOrigin) {
                return { ok: false, reason: 'frame_origin_mismatch' };
              }
              var targets = document.querySelectorAll(clickLocator);
              if (targets.length !== 1) {
                return {
                  ok: false,
                  reason:
                    targets.length === 0 ? 'click_target_missing' : 'click_target_ambiguous',
                };
              }
              targets[0].click();
              return { ok: true };
            },
            args: [locator, clickFrame ? clickFrame.frameOrigin : allowedOrigin],
          },
          function (results) {
            if (chrome.runtime.lastError) {
              reply({
                ok: false,
                reason: chrome.runtime.lastError.message || 'authoring_click_failed',
              });
              return;
            }
            var result =
              results && results[0] && results[0].result
                ? results[0].result
                : { ok: false, reason: 'no_result' };
            if (!result.ok) {
              reply(result);
              return;
            }
            next();
          },
        );
      }

      function pollDeclared(deadline) {
        specialDeclaredReadinessMet(
          tabId,
          allowedOrigin,
          { locator: readinessLocator, frame: readinessFrame, target: readinessTarget },
          function (r) {
            if (!r.ok) {
              reply({ ok: false, reason: r.reason, liveOrigin: r.liveOrigin });
              return;
            }
            if (r.met) {
              reply({ ok: true });
              return;
            }
            if (Date.now() >= deadline) {
              reply({ ok: false, reason: 'readiness_timeout' });
              return;
            }
            setTimeout(function () {
              refreshGestureWatch(function () {
                pollDeclared(deadline);
              });
            }, SPECIAL_READINESS_POLL_MS);
          },
        );
      }

      // D-121-63 D: eligible vocabulary actions before the click (null = not collected → never actions_only).
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
      // D-121-61: a visible depth-1 frame with no exact-one locator appeared after the click.
      var sawNewUnaddressable = false;
      var unaddressableBefore = {};
      function pollReveal(before, deadline) {
        collectSpecialRevealSnapshot(tabId, allowedOrigin, function (snap) {
          if (!snap.ok) {
            reply({ ok: false, reason: snap.reason });
            return;
          }
          var freshAll = snap.entries.filter(function (e) {
            return !before[e.key] && !skippedBefore[specialFrameKeyOf(e.frame)];
          });
          pollTicks += 1;
          if (pollTicks === 1 || pollTicks % 5 === 0) {
            trace('poll', { tick: pollTicks, fresh: freshAll.length, skipped: Object.keys(snap.skipped || {}).length });
          }
          if (freshAll.some(function (e) { return e.password !== true; })) sawFreshNonPassword = true;
          if (Object.keys(snap.unaddressable || {}).some(function (id) { return !unaddressableBefore[id]; })) {
            sawNewUnaddressable = true;
          }
          var fresh = freshAll.filter(function (e) {
            return !requirePasswordSurface || e.password === true;
          })[0];
          if (fresh) {
            reply({
              ok: true,
              revealed: { frameKey: specialFrameKeyOf(fresh.frame), frame: fresh.frame },
            });
            return;
          }
          if (Date.now() >= deadline) {
            if (allowActionsOnly && !actionsOnlyTried) {
              actionsOnlyTried = true;
              revealActionsOnly(function () {
                pollReveal(before, deadline);
              });
              return;
            }
            if (sawFreshNonPassword) {
              reply({ ok: false, reason: 'surface_not_login' });
              return;
            }
            if (sawNewUnaddressable) {
              reply({ ok: false, reason: 'surface_frame_not_addressable' });
              return;
            }
            reply({ ok: false, reason: 'surface_not_revealed' });
            return;
          }
          setTimeout(function () {
            refreshGestureWatch(function () {
              pollReveal(before, deadline);
            });
          }, SPECIAL_READINESS_POLL_MS);
        });
      }

      resolveClickFrame(function (frameId) {
        if (readinessMode === 'declared') {
          clickIn(frameId, function () {
            pollDeclared(Date.now() + readinessTimeoutMs);
          });
          return;
        }
        collectRevealBefore(function (pre) {
          if (!pre.ok) {
            reply({ ok: false, reason: pre.reason });
            return;
          }
          var before = {};
          pre.entries.forEach(function (e) {
            before[e.key] = true;
          });
          skippedBefore = pre.skipped || {};
          unaddressableBefore = pre.unaddressable || {};
          clickIn(frameId, function () {
            pollReveal(before, Date.now() + readinessTimeoutMs);
          });
        }, trace);
      });
    });
  });
  return true;
}

function openPageAndManagedAutofill(urlString, payload, sendResponse, sender) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !payload.allowedOrigin ||
    !Array.isArray(payload.fieldMappings) ||
    !payload.credentials ||
    typeof payload.credentials !== 'object'
  ) {
    sendResponse({ ok: false, reason: 'missing_managed_payload' });
    return false;
  }

  var managedOptions = {
    initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS,
  };
  var placement = buildManagedTabCreateProperties(sender);
  if (placement) {
    managedOptions.tabCreateProperties = placement;
  }

  var detachDiag = null;
  managedOptions.onTabCreatedDiag = function (createdTabId) {
    logManagedAutofillDiag('createdTabId', { tabId: createdTabId });
    detachDiag = attachManagedAutofillDiagLifecycle(createdTabId);
    return detachDiag;
  };
  managedOptions.hubRunId = payload.runId;

  return openGenericRealSiteTab(
    urlString,
    sendResponse,
    'managed-autofill',
    function (tabId, finishSession, run) {
      runManagedAutofillOnTab(tabId, payload, 0, function (result) {
        function afterFinish(finalResult) {
          finishSession(finalResult);
          if (detachDiag) {
            detachDiag();
            detachDiag = null;
          }
          if (finalResult && finalResult.reason === 'targets_not_ready') {
            scheduleManagedLateReadinessProbes(tabId, payload);
          }
        }

        if (result && result.reason === 'targets_not_ready') {
          enrichManagedTargetsNotReadyResult(tabId, result, afterFinish);
          return;
        }
        afterFinish(result || { ok: false, reason: 'no_result' });
      }, run);
    },
    managedOptions,
  );
}

/**
 * Phase 121.2 — SPECIAL login flow runtime (121.3: FLOATING_SCREEN + MULTI_STEP). One
 * engine for Digital Home and Admin Test: open entry → R1 → [approved opener click →
 * declared readiness] → per step: fill + verify via the unchanged Managed runner (top,
 * or the step's depth-1 frame with frameContext) → if the step has an exit: click it →
 * declared readiness of the next step. Last step → STOPPED_FOR_USER. Never submits.
 * Click / readiness / fill targets come only from the validated plan document.
 */
var SPECIAL_RUNTIME_READINESS_MAX_MS = 30000;
var SPECIAL_RUNTIME_PENDING_REVEAL_LOCATOR = '[data-pv-pending-reveal]';
var SPECIAL_RUNTIME_MULTI_STEP_MIN = 2;
var SPECIAL_RUNTIME_MULTI_STEP_MAX = 4;

function specialRuntimeNonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** undefined/null → top (null); valid → clean copy; anything else → false. */
function specialRuntimeFrame(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  if (!specialRuntimeNonEmpty(value.frameLocator) || !specialIsHttpsExactOrigin(value.frameOrigin)) {
    return false;
  }
  return { frameLocator: value.frameLocator, frameOrigin: value.frameOrigin };
}

/**
 * One step's css mappings in one frame (Hub stepRows): rows, or 'shape' / 'frame'.
 * D-121-63 A: allowEmpty (an action-only MULTI_STEP step) → [].
 */
function specialRuntimeStepRows(rawMappings, allowEmpty) {
  var raw = Array.isArray(rawMappings) ? rawMappings : [];
  if (raw.length === 0 && allowEmpty === true && Array.isArray(rawMappings)) return [];
  if (raw.length === 0) return 'shape';
  for (var i = 0; i < raw.length; i += 1) {
    var m = raw[i];
    if (
      !m ||
      typeof m !== 'object' ||
      !specialRuntimeNonEmpty(m.fieldId) ||
      m.locatorType !== 'css' ||
      !specialRuntimeNonEmpty(m.locator)
    ) {
      return 'shape';
    }
  }
  var rows = [];
  for (var j = 0; j < raw.length; j += 1) {
    var frame = specialRuntimeFrame(raw[j].frame);
    if (frame === false) return 'frame';
    rows.push({ fieldId: raw[j].fieldId, locator: raw[j].locator, frame: frame });
  }
  for (var k = 1; k < rows.length; k += 1) {
    if (!specialSameFrameMessage(rows[k].frame, rows[0].frame)) return 'frame';
  }
  return rows;
}

function specialRuntimeCssAction(action, kind) {
  return (
    Boolean(action) &&
    typeof action === 'object' &&
    action.kind === kind &&
    action.approvedForRuntime === true &&
    action.locatorType === 'css' &&
    specialRuntimeNonEmpty(action.locator)
  );
}

function specialRuntimeActionFrames(action) {
  var frame = specialRuntimeFrame(action.frame);
  var r = action.readiness;
  var readinessFrame = r && typeof r === 'object' ? specialRuntimeFrame(r.frame) : null;
  if (frame === false || readinessFrame === false) return null;
  return { frame: frame, readinessFrame: readinessFrame };
}

function specialRuntimeHasField(rows, locator, frame) {
  return rows.some(function (row) {
    return row.locator === locator && specialSameFrameMessage(row.frame, frame);
  });
}

/**
 * Readiness of an opener / transition: a declared field of the revealed step, never the
 * action itself, never a field of the step still on screen (ownRows). null = invalid.
 * D-121-63 B: into an action-only step (no rows) it is that step's exit (revealedExit);
 * the readiness then targets an element to click, not a field.
 */
function specialRuntimeReadiness(action, frames, revealedRows, ownRows, revealedExit) {
  var r = action.readiness;
  var toAction = revealedRows.length === 0;
  var revealedOk = false;
  if (toAction) {
    var exitFrame = revealedExit && typeof revealedExit === 'object' ? specialRuntimeFrame(revealedExit.frame) : false;
    revealedOk =
      exitFrame !== false &&
      r &&
      typeof r === 'object' &&
      r.locator === revealedExit.locator &&
      specialSameFrameMessage(frames.readinessFrame, exitFrame);
  } else {
    revealedOk = Boolean(r && typeof r === 'object') && specialRuntimeHasField(revealedRows, r.locator, frames.readinessFrame);
  }
  if (
    !r ||
    typeof r !== 'object' ||
    r.kind !== 'exact_one_eligible_css' ||
    r.locatorType !== 'css' ||
    !specialRuntimeNonEmpty(r.locator) ||
    typeof r.timeoutMs !== 'number' ||
    !(r.timeoutMs > 0) ||
    r.locator === SPECIAL_RUNTIME_PENDING_REVEAL_LOCATOR ||
    (r.locator === action.locator && specialSameFrameMessage(frames.readinessFrame, frames.frame)) ||
    !revealedOk ||
    (ownRows !== null && specialRuntimeHasField(ownRows, r.locator, frames.readinessFrame))
  ) {
    return null;
  }
  return {
    locator: r.locator,
    frame: frames.readinessFrame,
    target: toAction ? 'action' : 'field',
    timeoutMs: Math.min(r.timeoutMs, SPECIAL_RUNTIME_READINESS_MAX_MS),
  };
}

function specialRuntimeAction(action, frames, readiness) {
  return {
    actionId: typeof action.actionId === 'string' ? action.actionId : '',
    locator: action.locator,
    frame: frames.frame,
    readiness: readiness,
  };
}

function specialRuntimeStep(step, rows, exit) {
  return { stepId: typeof step.stepId === 'string' ? step.stepId : '', rows: rows, exit: exit };
}

function specialRuntimeFloatingShape(preamble, steps) {
  var shape = { ok: false, reason: 'plan_shape_unsupported' };
  if (preamble.length !== 1 || !specialRuntimeCssAction(preamble[0], 'floating_opener')) return shape;
  if (steps.length !== 1 || !steps[0] || typeof steps[0] !== 'object' || steps[0].exitTransition) return shape;
  var rows = specialRuntimeStepRows(steps[0].fieldMappings);
  if (rows === 'shape') return shape;
  var frames = specialRuntimeActionFrames(preamble[0]);
  if (rows === 'frame' || !frames) return { ok: false, reason: 'frame_invalid' };
  var readiness = specialRuntimeReadiness(preamble[0], frames, rows, null);
  if (!readiness) return { ok: false, reason: 'readiness_invalid' };
  return {
    ok: true,
    opener: specialRuntimeAction(preamble[0], frames, readiness),
    steps: [specialRuntimeStep(steps[0], rows, null)],
  };
}

function specialRuntimeMultiStepShape(preamble, steps) {
  var shape = { ok: false, reason: 'plan_shape_unsupported' };
  if (
    preamble.length !== 0 ||
    steps.length < SPECIAL_RUNTIME_MULTI_STEP_MIN ||
    steps.length > SPECIAL_RUNTIME_MULTI_STEP_MAX
  ) {
    return shape;
  }
  var last = steps.length - 1;
  for (var i = 0; i < steps.length; i += 1) {
    if (!steps[i] || typeof steps[i] !== 'object') return shape;
    var exit = steps[i].exitTransition;
    if (i < last ? !specialRuntimeCssAction(exit, 'intermediate_transition') : exit) return shape;
  }
  // D-121-63 A: a middle step may be action-only; C: a fieldId may repeat across steps.
  var allRows = [];
  for (var s = 0; s < steps.length; s += 1) {
    var rows = specialRuntimeStepRows(steps[s].fieldMappings, s > 0 && s < last);
    if (rows === 'shape') return shape;
    if (rows === 'frame') return { ok: false, reason: 'frame_invalid' };
    allRows.push(rows);
  }
  var out = [];
  for (var t = 0; t < steps.length; t += 1) {
    var action = null;
    if (t < last) {
      var raw = steps[t].exitTransition;
      var frames = specialRuntimeActionFrames(raw);
      if (!frames) return { ok: false, reason: 'frame_invalid' };
      var readiness = specialRuntimeReadiness(raw, frames, allRows[t + 1], allRows[t], steps[t + 1].exitTransition || null);
      if (!readiness) return { ok: false, reason: 'readiness_invalid' };
      action = specialRuntimeAction(raw, frames, readiness);
    }
    out.push(specialRuntimeStep(steps[t], allRows[t], action));
  }
  return { ok: true, opener: null, steps: out };
}

/** Parity with Hub validateSpecialPlanComplete + validateSpecialRunnable (RT-2.1 / 121.3 R-1). */
function specialValidateRunPlan(plan, credentials) {
  function fail(reason) {
    return { ok: false, reason: reason };
  }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return fail('plan_invalid');
  if (!specialRuntimeNonEmpty(plan.pattern)) return fail('plan_invalid');
  var preamble = Array.isArray(plan.preambleActions) ? plan.preambleActions : [];
  var steps = Array.isArray(plan.steps) ? plan.steps : [];
  var actions = preamble.slice();
  steps.forEach(function (s) {
    if (s && s.exitTransition) actions.push(s.exitTransition);
  });
  for (var a = 0; a < actions.length; a += 1) {
    if (actions[a] && SPECIAL_RESERVED_ACTION_KINDS.indexOf(actions[a].kind) >= 0) {
      return fail('reserved_action_kind');
    }
  }
  var shaped =
    plan.pattern === 'FLOATING_SCREEN'
      ? specialRuntimeFloatingShape(preamble, steps)
      : plan.pattern === 'MULTI_STEP'
        ? specialRuntimeMultiStepShape(preamble, steps)
        : fail('pattern_not_supported_yet');
  if (!shaped.ok) return shaped;
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    return fail('credentials_incomplete');
  }
  // R-4: required = union of every step's mapped fieldIds; each step receives only its own.
  var mappedIds = [];
  shaped.steps.forEach(function (step) {
    step.rows.forEach(function (row) {
      mappedIds.push(row.fieldId);
    });
  });
  var keys = Object.keys(credentials);
  for (var k = 0; k < keys.length; k += 1) {
    if (mappedIds.indexOf(keys[k]) < 0) return fail('credentials_unexpected');
  }
  for (var c = 0; c < mappedIds.length; c += 1) {
    if (!specialRuntimeNonEmpty(credentials[mappedIds[c]])) return fail('credentials_incomplete');
  }
  return {
    ok: true,
    opener: shaped.opener,
    steps: shaped.steps.map(function (step) {
      var stepCredentials = {};
      step.rows.forEach(function (row) {
        stepCredentials[row.fieldId] = credentials[row.fieldId];
      });
      return {
        stepId: step.stepId,
        frame: step.rows.length > 0 ? step.rows[0].frame : null,
        fieldMappings: step.rows.map(function (row) {
          return { fieldId: row.fieldId, locatorType: 'css', locator: row.locator };
        }),
        credentials: stepCredentials,
        exit: step.exit,
      };
    }),
  };
}

function runSpecialLoginFlow(message, sendResponse, sender) {
  var runId = specialRuntimeNonEmpty(message.runId) ? message.runId.trim().slice(0, 64) : specialGestureToken();
  var diagnosticPath = specialRuntimeNonEmpty(message.diagnosticPath)
    ? message.diagnosticPath.trim().slice(0, 32)
    : 'unknown';
  var entryUrl = specialRuntimeNonEmpty(message.entryUrl) ? message.entryUrl.trim() : '';
  var allowedOrigin = specialRuntimeNonEmpty(message.allowedOrigin) ? message.allowedOrigin.trim() : '';

  function diag(stage, fields) {
    logManagedAutofillDiag('specialRun', Object.assign({ runId: runId, stage: stage }, fields || {}));
  }

  var plan = specialValidateRunPlan(message.plan, message.credentials);
  if (plan.ok) {
    var entryOrigin = '';
    try {
      entryOrigin = new URL(entryUrl).origin;
    } catch (_err) {
      entryOrigin = '';
    }
    if (!specialIsHttpsExactOrigin(allowedOrigin) || entryOrigin !== allowedOrigin) {
      plan = { ok: false, reason: 'entry_unresolved' };
    }
  }
  if (!plan.ok) {
    diag('validate', { reason: plan.reason });
    sendResponse({
      ok: false,
      state: 'FAILED',
      stage: 'validate',
      reason: plan.reason,
      tabOpened: false,
      runId: runId,
    });
    return false;
  }

  var openOptions = { initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS, hubRunId: runId };
  var placement = buildManagedTabCreateProperties(sender);
  if (placement) {
    openOptions.tabCreateProperties = placement;
  }
  diag('open', {
    stepId: plan.steps[0].stepId,
    actionId: plan.opener ? plan.opener.actionId : '',
    steps: plan.steps.length,
  });

  return openGenericRealSiteTab(
    entryUrl,
    sendResponse,
    'special-login-flow',
    function (tabId, finishSession, run) {
      var runDeadline = Date.now() + GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS - 1000;
      var gestureToken = null;
      var gestureSeen = false;
      var gestureWatched = false;
      var gestureUnknown = false;
      var filledTotal = 0;
      var done = false;
      // R-6: every outcome names the step and the action in progress.
      var at = { stepId: plan.steps[0].stepId, actionId: plan.opener ? plan.opener.actionId : '' };

      // D-121-72: checkpoint before every wait, click and fill — a closed tab / Hub cancel
      // already answered the run; nothing more happens in the tab.
      function live() {
        return !done && run.active();
      }

      function until(ms) {
        return Math.min(Date.now() + ms, runDeadline);
      }

      function collectGesture(next) {
        if (!gestureToken) {
          next();
          return;
        }
        var token = gestureToken;
        gestureToken = null;
        specialGestureWatchRun(tabId, specialGestureWatchCollect, token, function (watch) {
          if (watch && watch.ok === true) {
            gestureWatched = true;
            if (watch.seen === true) gestureSeen = true;
          } else {
            gestureUnknown = true;
          }
          next();
        });
      }

      // Evidence only (RT-4.6): an install failure omits the field; the run continues.
      function installGesture(next) {
        var token = specialGestureToken();
        specialGestureWatchRun(tabId, specialGestureWatchInstall, token, function (installed) {
          if (installed && installed.ok === true) {
            gestureToken = token;
          } else {
            gestureUnknown = true;
          }
          next();
        });
      }

      function finish(outcome) {
        if (!live()) return;
        done = true;
        collectGesture(function () {
          var result = Object.assign(
            {
              state: outcome.ok ? 'STOPPED_FOR_USER' : 'FAILED',
              stepId: at.stepId,
              actionId: at.actionId,
              tabOpened: true,
              runId: runId,
            },
            outcome,
          );
          if (gestureSeen) {
            result.userGestureDuringRun = true;
          } else if (gestureWatched && !gestureUnknown) {
            result.userGestureDuringRun = false;
          }
          diag(result.stage || 'done', {
            state: result.state,
            reason: result.reason,
            stepId: result.stepId,
            actionId: result.actionId,
            fieldId: result.fieldId,
            locator: result.locator,
            frameKey: result.frameKey,
          });
          finishSession(result);
        });
      }

      function refreshGestureWatch(next) {
        if (!gestureToken) {
          next();
          return;
        }
        specialGestureWatchRun(tabId, specialGestureWatchInstall, gestureToken, function () {
          next();
        });
      }

      // R1 / R-3 — tab URL origin and the live top document origin, before every click and fill.
      function checkR1(next) {
        if (!live()) return;
        chrome.tabs.get(tabId, function (tab) {
          if (!live()) return;
          if (chrome.runtime.lastError || !tab) {
            finish({ ok: false, stage: 'r1', reason: 'no_tab' });
            return;
          }
          var tabOrigin = '';
          try {
            tabOrigin = new URL(tab.url).origin;
          } catch (_err) {
            tabOrigin = '';
          }
          if (tabOrigin !== allowedOrigin) {
            finish({ ok: false, stage: 'r1', reason: 'origin_mismatch' });
            return;
          }
          chrome.scripting.executeScript(
            { target: { tabId: tabId, frameIds: [0] }, func: specialFrameProbe },
            function (probe) {
              if (!live()) return;
              var p = !chrome.runtime.lastError && probe && probe[0] && probe[0].result;
              if (!p || p.origin !== allowedOrigin) {
                finish({ ok: false, stage: 'r1', reason: 'origin_mismatch' });
                return;
              }
              next();
            },
          );
        });
      }

      function resolveActionDocument(action, stage, next) {
        var frame = action.frame;
        if (!frame) {
          next(0, allowedOrigin);
          return;
        }
        resolveDeclaredFrame(tabId, allowedOrigin, frame, function (resolved) {
          if (!resolved.ok) {
            finish({
              ok: false,
              stage: stage,
              reason: resolved.reason,
              liveOrigin: resolved.liveOrigin,
              locator: action.locator,
              frameKey: specialFrameKeyOf(frame),
            });
            return;
          }
          next(resolved.frameId, frame.frameOrigin);
        });
      }

      // Opener or transition: exact-one .click() in the MAIN world; retried until the deadline.
      function clickAction(action, stage, frameId, expectedOrigin, deadline, onClicked) {
        if (!live()) return;
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId, frameIds: [frameId] },
            world: 'MAIN',
            func: function (clickLocator, origin) {
              if (String(location.origin || '') !== origin) {
                return { ok: false, originMismatch: true };
              }
              var targets;
              try {
                targets = document.querySelectorAll(clickLocator);
              } catch (_err) {
                return { ok: false, count: 0 };
              }
              if (targets.length !== 1) {
                return { ok: false, count: targets.length };
              }
              targets[0].click();
              return { ok: true };
            },
            args: [action.locator, expectedOrigin],
          },
          function (results) {
            if (!live()) return;
            var r = !chrome.runtime.lastError && results && results[0] && results[0].result;
            var failBase = {
              ok: false,
              stage: stage,
              locator: action.locator,
              frameKey: specialFrameKeyOf(action.frame),
            };
            if (r && r.originMismatch) {
              finish(
                Object.assign(failBase, {
                  reason: frameId === 0 ? 'origin_mismatch' : 'frame_origin_mismatch',
                }),
              );
              return;
            }
            if (r && r.ok === true) {
              diag(stage, { stepId: at.stepId, actionId: action.actionId, locator: action.locator });
              onClicked();
              return;
            }
            if (Date.now() >= deadline) {
              var count = r && typeof r.count === 'number' ? r.count : 0;
              var reasons =
                stage === 'opener'
                  ? { none: 'opener_missing', many: 'opener_ambiguous' }
                  : { none: 'transition_missing', many: 'transition_ambiguous' };
              finish(Object.assign(failBase, { reason: count > 1 ? reasons.many : reasons.none }));
              return;
            }
            run.later(function () {
              refreshGestureWatch(function () {
                clickAction(action, stage, frameId, expectedOrigin, deadline, onClicked);
              });
            }, SPECIAL_READINESS_POLL_MS);
          },
        );
      }

      /**
       * Declared readiness of the revealed step. After a transition the tab may be
       * navigating: a frame that cannot be correlated yet is not ready (never success)
       * until the deadline; a foreign top origin still fails closed (origin_mismatch).
       */
      function pollReadiness(readiness, afterTransition, deadline, onMet) {
        if (!live()) return;
        specialDeclaredReadinessMet(
          tabId,
          allowedOrigin,
          { locator: readiness.locator, frame: readiness.frame, target: readiness.target },
          function (r) {
            if (!live()) return;
            var frameKey = specialFrameKeyOf(readiness.frame);
            var navigating = afterTransition && !r.ok && r.reason === 'frame_correlation_unavailable';
            if (!r.ok && !navigating) {
              finish({
                ok: false,
                stage: r.reason === 'origin_mismatch' ? 'r1' : 'frame',
                reason: r.reason,
                liveOrigin: r.liveOrigin,
                locator: readiness.locator,
                frameKey: frameKey,
              });
              return;
            }
            if (r.ok && r.met) {
              collectGesture(onMet);
              return;
            }
            if (Date.now() >= deadline) {
              finish({
                ok: false,
                stage: 'readiness',
                reason: 'readiness_timeout',
                locator: readiness.locator,
                frameKey: frameKey,
              });
              return;
            }
            run.later(function () {
              refreshGestureWatch(function () {
                pollReadiness(readiness, afterTransition, deadline, onMet);
              });
            }, SPECIAL_READINESS_POLL_MS);
          },
        );
      }

      // Per attempt: re-resolve the step frame (loading ≠ foreign) before credentials leave the Ext.
      function resolveFillDocument(frame, next) {
        if (!frame) {
          next({ ok: true, frameId: 0, origin: allowedOrigin });
          return;
        }
        resolveDeclaredFrame(
          tabId,
          allowedOrigin,
          frame,
          function (resolved) {
            if (!resolved.ok) {
              next(resolved);
              return;
            }
            next({ ok: true, frameId: resolved.frameId, origin: frame.frameOrigin });
          },
          { loadingIsPending: true },
        );
      }

      function retryFill(index, attempt) {
        run.later(function () {
          fillAttempt(index, attempt + 1);
        }, MANAGED_AUTOFILL_RETRY_DELAY_MS);
      }

      function fillStep(index) {
        var step = plan.steps[index];
        var revealedBy = index === 0 ? (plan.opener ? plan.opener.actionId : '') : plan.steps[index - 1].exit.actionId;
        at.stepId = step.stepId;
        at.actionId = revealedBy || (step.exit ? step.exit.actionId : '');
        // D-121-63 A: an action-only step has nothing to fill; its transition re-runs R1 first.
        if (step.fieldMappings.length === 0) {
          runTransition(index);
          return;
        }
        fillAttempt(index, 0);
      }

      function fillAttempt(index, attempt) {
        if (!live()) return;
        if (Date.now() >= runDeadline) {
          finish({ ok: false, stage: 'fill', reason: 'operation_timeout', frameKey: specialFrameKeyOf(plan.steps[index].frame) });
          return;
        }
        checkR1(function () {
          fillInDocument(index, attempt);
        });
      }

      // A transition is clicked only after this step's fill was verified (R-2).
      function afterVerifiedFill(index, outcome) {
        var step = plan.steps[index];
        if (typeof outcome.filled === 'number') filledTotal += outcome.filled;
        if (!step.exit) {
          outcome.filled = filledTotal;
          finish(outcome);
          return;
        }
        runTransition(index);
      }

      function fillInDocument(index, attempt) {
        var step = plan.steps[index];
        var frameKey = specialFrameKeyOf(step.frame);
        resolveFillDocument(step.frame, function (doc) {
          if (!live()) return;
          if (!doc.ok) {
            var pending = doc.reason === 'frame_missing' || doc.reason === 'frame_loading';
            if (pending && attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
              retryFill(index, attempt);
              return;
            }
            finish({
              ok: false,
              stage: 'frame',
              reason: doc.reason === 'frame_loading' ? 'frame_missing' : doc.reason,
              liveOrigin: doc.liveOrigin,
              frameKey: frameKey,
            });
            return;
          }
          var runOptions = {
            allowedOrigin: doc.origin,
            fieldMappings: step.fieldMappings,
            credentials: step.credentials,
            diagnosticPath: diagnosticPath,
          };
          // D-121-70: the exit click waits for this fill; the last step keeps A2.4.
          if (step.exit) runOptions.skipPostRuntimeObserve = true;
          if (doc.frameId !== 0) {
            runOptions.frameContext = { mode: 'declared_depth1' };
          }
          chrome.scripting.executeScript(
            {
              target: { tabId: tabId, frameIds: [doc.frameId] },
              world: 'MAIN',
              files: GENERIC_REAL_SITE_SCRIPT_FILES.managed,
            },
            function () {
              if (!live()) return;
              if (chrome.runtime.lastError) {
                if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
                  retryFill(index, attempt);
                  return;
                }
                finish({ ok: false, stage: 'fill', reason: 'script_injection_failed', frameKey: frameKey });
                return;
              }
              chrome.scripting.executeScript(
                {
                  target: { tabId: tabId, frameIds: [doc.frameId] },
                  world: 'MAIN',
                  func: function (opts) {
                    if (typeof runManagedAutofill !== 'function') {
                      return { ok: false, reason: 'managed_function_missing' };
                    }
                    return runManagedAutofill(opts);
                  },
                  args: [runOptions],
                },
                function (results) {
                  if (!live()) return;
                  if (chrome.runtime.lastError) {
                    if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
                      retryFill(index, attempt);
                      return;
                    }
                    finish({ ok: false, stage: 'fill', reason: 'managed_run_failed', frameKey: frameKey });
                    return;
                  }
                  var result =
                    results && results[0] && results[0].result
                      ? results[0].result
                      : { ok: false, reason: 'no_result' };
                  if (!result.ok && attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS && isManagedAutofillRetryable(result)) {
                    retryFill(index, attempt);
                    return;
                  }
                  var outcome = {
                    ok: result.ok === true,
                    stage: 'fill',
                    frameKey: frameKey,
                  };
                  if (typeof result.filled === 'number') outcome.filled = result.filled;
                  if (result.fillDiagnostics) outcome.fillDiagnostics = result.fillDiagnostics;
                  if (outcome.ok) {
                    afterVerifiedFill(index, outcome);
                    return;
                  }
                  outcome.reason = typeof result.reason === 'string' ? result.reason : 'managed_failed';
                  outcome.fieldId = result.fieldId;
                  outcome.locator = result.locator;
                  outcome.detail = result.detail;
                  if (result.reason === 'targets_not_ready') {
                    enrichManagedTargetsNotReadyResult(tabId, result, function () {
                      finish(outcome);
                    });
                    return;
                  }
                  finish(outcome);
                },
              );
            },
          );
        });
      }

      function runTransition(index) {
        var exit = plan.steps[index].exit;
        at.stepId = plan.steps[index].stepId;
        at.actionId = exit.actionId;
        checkR1(function () {
          installGesture(function () {
            resolveActionDocument(exit, 'transition', function (frameId, expectedOrigin) {
              clickAction(exit, 'transition', frameId, expectedOrigin, until(exit.readiness.timeoutMs), function () {
                at.stepId = plan.steps[index + 1].stepId;
                pollReadiness(exit.readiness, true, until(exit.readiness.timeoutMs), function () {
                  fillStep(index + 1);
                });
              });
            });
          });
        });
      }

      checkR1(function () {
        var token = plan.opener ? specialGestureToken() : null;
        if (!token) {
          fillStep(0);
          return;
        }
        specialGestureWatchRun(tabId, specialGestureWatchInstall, token, function (installed) {
          if (installed && installed.ok === true) {
            gestureToken = token;
          } else {
            gestureUnknown = true;
          }
          var opener = plan.opener;
          resolveActionDocument(opener, 'opener', function (frameId, expectedOrigin) {
            clickAction(opener, 'opener', frameId, expectedOrigin, until(opener.readiness.timeoutMs), function () {
              pollReadiness(opener.readiness, false, until(opener.readiness.timeoutMs), function () {
                fillStep(0);
              });
            });
          });
        });
      });
    },
    openOptions,
  );
}

chrome.runtime.onMessageExternal.addListener(function (
  message,
  sender,
  sendResponse,
) {
  console.log('[Practice] Background received message', message && message.type);

  if (!message) {
    sendResponse({ ok: false, reason: 'no_message' });
    return false;
  }

  if (message.type === 'POC_FILL_DEMO') {
    openLocalPageAndFill(message.url, sendResponse, message);
    return true;
  }

  if (message.type === 'POC_GENERIC_DETECT') {
    openPageAndDetectGenericLogin(
      message.url,
      message.loginFields,
      sendResponse,
    );
    return true;
  }

  if (message.type === 'HUB_LOGIN_ENTRY_DISCOVERY') {
    openPageAndDiscoverLoginEntry(message.primaryUrl, sendResponse);
    return true;
  }

  if (message.type === 'HUB_DISCOVERY_FETCH_HTML') {
    var fetchUrl = typeof message.url === 'string' ? message.url.trim() : '';
    if (!fetchUrl) {
      sendResponse({ ok: false, reached: false, reason: 'missing_url' });
      return false;
    }

    function resolveHostnameViaDoh(hostname) {
      return fetch(
        'https://cloudflare-dns.com/dns-query?name=' +
          encodeURIComponent(hostname) +
          '&type=A',
        {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/dns-json' },
        },
      )
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (!data || data.Status !== 0) {
            return false;
          }
          var answers = data.Answer || [];
          return answers.some(function (answer) {
            // 1=A, 28=AAAA, 5=CNAME — host is resolvable
            return (
              answer &&
              (answer.type === 1 || answer.type === 28 || answer.type === 5)
            );
          });
        })
        .catch(function () {
          return false;
        });
    }

    fetch(fetchUrl, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-store',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    })
      .then(function (response) {
        return response.text().then(function (html) {
          // Host answered (including 404) — distinct from NXDOMAIN / network miss.
          sendResponse({
            ok: response.ok,
            reached: true,
            status: response.status,
            html: html,
            finalUrl: response.url || fetchUrl,
            reason: response.ok ? undefined : 'http_' + response.status,
          });
        });
      })
      .catch(function (error) {
        var hostname = '';
        try {
          hostname = new URL(fetchUrl).hostname;
        } catch (e) {
          hostname = '';
        }
        var networkReason =
          error && error.message ? error.message : 'network_error';
        if (!hostname) {
          sendResponse({
            ok: false,
            reached: false,
            reason: networkReason,
          });
          return;
        }
        // Fetch failed (TLS/bot/offline path) but DNS may still prove auth host exists.
        resolveHostnameViaDoh(hostname).then(function (exists) {
          if (exists) {
            sendResponse({
              ok: false,
              reached: true,
              status: 0,
              dnsExists: true,
              finalUrl: fetchUrl,
              reason: 'dns_exists_fetch_failed',
            });
            return;
          }
          sendResponse({
            ok: false,
            reached: false,
            reason: networkReason,
          });
        });
      });
    return true;
  }

  if (message.type === 'HUB_MANAGED_AUTOFILL') {
    openPageAndManagedAutofill(message.url, message, sendResponse, sender);
    return true;
  }

  /**
   * D-121-72 — stop a Hub fill run (Managed or SPECIAL) by its run id.
   */
  if (message.type === 'HUB_MANAGED_AUTOFILL_CANCEL') {
    return cancelHubFillRun(message, sendResponse);
  }

  /**
   * Phase 121.2 — SPECIAL login flow runtime (Digital Home + Admin Test, one engine).
   */
  if (message.type === 'HUB_SPECIAL_LOGIN_FLOW') {
    return runSpecialLoginFlow(message, sendResponse, sender);
  }

  /**
   * Phase 118 — Admin authoring inspect only.
   * Opens Login Entry, returns SafePageStructure. No fill, no credentials, no LLM.
   */
  if (message.type === 'ADMIN_LOGIN_PAGE_INSPECT') {
    openPageAndInspectLoginStructure(message, sendResponse, sender);
    return true;
  }

  /**
   * Phase 120.2-AP — Admin Managed-parity readiness probe (assess-only).
   * Same assessManagedTargetsReady as Managed fill. No credentials. No fill.
   */
  if (message.type === 'ADMIN_MANAGED_READINESS_PROBE') {
    openPageAndManagedReadinessProbe(message, sendResponse, sender);
    return true;
  }

  /**
   * Phase 119.2 — Admin Visual Mapping (real Login Entry tab click → CSS locator).
   * No fill, no credentials, no LLM, no iframe/shadow pierce.
   */
  if (message.type === 'ADMIN_VISUAL_MAPPING_START') {
    openPageAndVisualMapping(message, sendResponse, sender);
    return true;
  }

  /**
   * D-121-42 — cancel the pending STANDARD Visual pick (no mapping written).
   */
  if (message.type === 'ADMIN_VISUAL_MAPPING_CANCEL') {
    return cancelStandardVisualMapping(message, sendResponse);
  }

  /**
   * Phase 121.1 — existing-tab inspect. MUST NOT open/reopen Login Entry.
   */
  if (message.type === 'ADMIN_CURRENT_TAB_INSPECT') {
    inspectCurrentAuthoringTab(message, sendResponse, sender);
    return true;
  }

  /**
   * Phase 121.1 — existing-tab Visual Mapping. MUST NOT open/reopen Login Entry.
   */
  if (message.type === 'ADMIN_CURRENT_TAB_VISUAL_MAPPING_START') {
    visualMappingCurrentAuthoringTab(message, sendResponse, sender);
    return true;
  }

  /**
   * D-121-25 — cancel an armed SPECIAL Visual pick (no mapping written).
   */
  if (message.type === 'ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL') {
    return cancelVisualMappingCurrentAuthoringTab(message, sendResponse, sender);
  }

  /**
   * Phase 121.1 — authoring click of already-approved action.
   * Not Login Flow Orchestrator / DH / Admin Test SPECIAL. No fill/submit.
   */
  if (message.type === 'ADMIN_AUTHORING_CLICK_APPROVED') {
    authoringClickApprovedAction(message, sendResponse, sender);
    return true;
  }

  if (message.type === 'POC_GENERIC_FILL') {
    openPageAndGenericAutofill(
      message.url,
      message.loginFields,
      message.credentials,
      sendResponse,
    );
    return true;
  }

  if (message.type === 'POC_IDENTITY_FIRST_FILL') {
    openPageAndIdentityFirstAutofill(
      message.url,
      message.loginFields,
      message.credentials,
      sendResponse,
    );
    return true;
  }

  sendResponse({ ok: false, reason: 'unknown_message' });
  return false;
});
