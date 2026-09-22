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
    'generic/form-detector.js',
    'generic/field-mapper.js',
    'generic/login-form-detect.js',
  ],
  fill: [
    'generic/form-detector.js',
    'generic/field-mapper.js',
    'generic/fill-executor.js',
    'generic/generic-autofill.js',
    'generic/identity-first-autofill.js',
  ],
  identityFirst: [
    'generic/form-detector.js',
    'generic/field-mapper.js',
    'generic/fill-executor.js',
    'generic/identity-first-autofill.js',
  ],
  managed: [
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
 * @param {object} [options]
 * @param {number} [options.initialDelayMs] — post-URL-match delay before onTabReady.
 *   Defaults to GENERIC_REAL_SITE_INITIAL_DELAY_MS (legacy/generic 4s).
 *   Managed Autofill must pass MANAGED_AUTOFILL_INITIAL_DELAY_MS (0).
 * @param {object} [options.tabCreateProperties] — Managed-only placement hints
 *   (e.g. index, openerTabId). Legacy/generic must omit this.
 * @param {function(number): void} [options.onTabCreatedDiag] — Managed §5D only.
 */
function openGenericRealSiteTab(urlString, sendResponse, sessionLabel, onTabReady, options) {
  if (!isAllowedGenericAutofillUrl(urlString)) {
    sendResponse({ ok: false, reason: 'url_not_allowed' });
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
    respond(result);
  }

  function armOperationTimeout() {
    clearOperationTimeout();
    operationTimeout = setTimeout(function () {
      if (settled) {
        return;
      }
      settled = true;
      respond({ ok: false, reason: 'operation_timeout' });
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

    if (options && typeof options.onTabCreatedDiag === 'function') {
      try {
        options.onTabCreatedDiag(tabId);
      } catch (_diagErr) {
        // Diagnostic must never block Managed/generic sessions.
      }
    }

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

function runManagedAutofillOnTab(tabId, payload, attempt, onDone) {
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
            runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone);
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
            },
          ],
        },
        function (results) {
          if (chrome.runtime.lastError) {
            if (attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
              setTimeout(function () {
                runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone);
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

          if (
            (!result || !result.ok) &&
            attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS &&
            isManagedAutofillRetryable(result)
          ) {
            setTimeout(function () {
              runManagedAutofillOnTab(tabId, payload, attempt + 1, onDone);
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
 * Phase 119.2 Admin Visual Mapping — open Login Entry, arm top-doc click pick.
 * No credentials, no fill, no submit, no LLM. frameIds: [0] only.
 */
function openPageAndVisualMapping(message, sendResponse, sender) {
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

  var visualOptions = {
    initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS,
  };
  var placement = buildManagedTabCreateProperties(sender);
  if (placement) {
    visualOptions.tabCreateProperties = placement;
  }

  return openGenericRealSiteTab(
    loginEntryUrl,
    sendResponse,
    'admin-visual-mapping',
    function (tabId, finishSession) {
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
          files: ['generic/visual-target-pick.js'],
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
          if (!navAbortArmed) {
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
          files: ['generic/page-structure-inspect.js'],
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
  };

  return openGenericRealSiteTab(
    urlString,
    sendResponse,
    'managed-autofill',
    function (tabId, finishSession) {
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
      });
    },
    managedOptions,
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
