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

const MOCK_HTZONE_CREDENTIALS = {
  email: 'demo-user@mock.test',
  password: 'demo-pass',
};

const HTZONE_LOGIN_PATH = '/login';

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

function isHtzoneLoginUrl(urlString) {
  try {
    const url = new URL(urlString);
    const isHtzone =
      url.hostname === 'www.htzone.co.il' || url.hostname === 'htzone.co.il';
    const path = url.pathname.replace(/\/$/, '');
    return isHtzone && (path === HTZONE_LOGIN_PATH || path.indexOf('/login/') === 0);
  } catch (_error) {
    return false;
  }
}

function getPageConfig(urlString) {
  if (isHtzoneLoginUrl(urlString)) {
    return { id: 'htzone-login' };
  }

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

const HTZONE_RETRY_DELAYS_MS = [0, 500, 1500, 2500, 4000, 6000, 8000, 10000];

function invokeHtzoneFill(tabId, credentials, onDone) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
      world: 'MAIN',
      func: function (creds) {
        if (typeof window.__israeliVaultHtzoneFill !== 'function') {
          return {
            ok: false,
            reason: 'adapter_function_missing',
          };
        }
        return window.__israeliVaultHtzoneFill(creds);
      },
      args: [credentials],
    },
    function (results) {
      if (chrome.runtime.lastError) {
        console.log(
          '[Israeli Vault POC] HTZone invoke lastError:',
          chrome.runtime.lastError.message,
        );
      }
      const result =
        results && results[0] ? results[0].result : { ok: false };
      console.log('[Israeli Vault POC] HTZone invoke result:', result);
      onDone(result);
    },
  );
}

function runHtzoneAdapterFill(tabId, credentials, attempt, onDone) {
  console.log(
    '[Israeli Vault POC] HTZone injecting htzone-adapter.js attempt:',
    attempt,
  );
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
      files: ['htzone-adapter.js'],
      world: 'MAIN',
    },
    function () {
      if (chrome.runtime.lastError) {
        console.log(
          '[Israeli Vault POC] HTZone adapter injection failed:',
          chrome.runtime.lastError.message,
        );
        scheduleHtzoneRetry(tabId, credentials, attempt, onDone, {
          ok: false,
          reason: chrome.runtime.lastError.message,
        });
        return;
      }

      console.log('[Israeli Vault POC] HTZone htzone-adapter.js injected: true');
      invokeHtzoneFill(tabId, credentials, function (result) {
        if (result && result.ok) {
          onDone(Object.assign({ via: 'htzone-adapter' }, result));
          return;
        }
        scheduleHtzoneRetry(tabId, credentials, attempt, onDone, result);
      });
    },
  );
}

function scheduleHtzoneRetry(tabId, credentials, attempt, onDone, lastResult) {
  if (attempt < HTZONE_RETRY_DELAYS_MS.length - 1) {
    const delay =
      HTZONE_RETRY_DELAYS_MS[attempt + 1] - HTZONE_RETRY_DELAYS_MS[attempt];
    setTimeout(function () {
      console.log(
        '[Israeli Vault POC] HTZone retry attempt:',
        attempt + 1,
      );
      invokeHtzoneFill(tabId, credentials, function (result) {
        if (result && result.ok) {
          onDone(Object.assign({ via: 'htzone-adapter' }, result));
          return;
        }
        scheduleHtzoneRetry(tabId, credentials, attempt + 1, onDone, result);
      });
    }, delay);
    return;
  }

  onDone(
    Object.assign({ via: 'htzone-adapter' }, lastResult || {
      ok: false,
      reason: 'htzone_fill_failed',
    }),
  );
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
  if (!pageConfig || pageConfig.id === 'htzone-login') {
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

function openHtzonePageAndFill(urlString, credentials, options, sendResponse) {
  const urlMatchesHtzone = isHtzoneLoginUrl(urlString);
  console.log('[Israeli Vault POC] HTZone request received');
  console.log('[Israeli Vault POC] HTZone target URL:', urlString);
  console.log(
    '[Israeli Vault POC] HTZone URL matches htzone.co.il/login:',
    urlMatchesHtzone,
  );

  if (!urlMatchesHtzone) {
    console.log(
      '[Israeli Vault POC] HTZone rejected: URL does not match htzone login',
    );
    sendResponse({ ok: false, reason: 'not_htzone_login' });
    return false;
  }

  const useAutofillParam = options && options.withAutofillParam;
  const targetUrl = useAutofillParam ? withAutofillParam(urlString) : urlString;
  const fillCredentials = credentials || MOCK_HTZONE_CREDENTIALS;

  if (credentials && credentials.email) {
    console.log('[Israeli Vault POC] HTZone fill source: vault');
  } else {
    console.log('[Israeli Vault POC] HTZone fill source: mock');
  }

  chrome.tabs.create({ url: targetUrl }, function (tab) {
    if (chrome.runtime.lastError || !tab || !tab.id) {
      if (chrome.runtime.lastError) {
        console.log(
          '[Israeli Vault POC] HTZone tabs.create lastError:',
          chrome.runtime.lastError.message,
        );
      }
      sendResponse({
        ok: false,
        reason: chrome.runtime.lastError
          ? chrome.runtime.lastError.message
          : 'no_tab',
      });
      return;
    }

    const tabId = tab.id;
    console.log('[Israeli Vault POC] HTZone tab opened:', tabId, targetUrl);

    function onTabUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        console.log('[Israeli Vault POC] HTZone tab load complete, starting fill');
        setTimeout(function () {
          runHtzoneAdapterFill(tabId, fillCredentials, 0, sendResponse);
        }, 800);
        return;
      }

      if (
        changeInfo.status === 'loading' &&
        changeInfo.url === 'chrome-error://chromewebdata/'
      ) {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        sendResponse({ ok: false, reason: 'tab_load_error' });
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
  ],
};

const GENERIC_REAL_SITE_RETRY_DELAY_MS = 300;
const GENERIC_REAL_SITE_MAX_ATTEMPTS = 25;
const GENERIC_REAL_SITE_INITIAL_DELAY_MS = 1500;
/** Time allowed for a heavy real-site login page to reach the target URL. */
const GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS = 120000;
/** Time allowed for detect/fill once the login page is ready (retries included). */
const GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS = 90000;

/** @deprecated Phase 102 stabilization — POC only. Phase 103 removes host allowlist branching. */
const GENERIC_REAL_SITE_ALLOWED_HOSTS = {
  'www.shufersal.co.il': true,
  'shufersal.co.il': true,
  'e-services.clalit.co.il': true,
};

function isAllowedGenericRealSiteUrl(urlString) {
  try {
    var url = new URL(urlString);
    return (
      url.protocol === 'https:' &&
      GENERIC_REAL_SITE_ALLOWED_HOSTS[url.hostname] === true
    );
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
    if (expectedPath) {
      return parsed.pathname.replace(/\/$/, '') === expectedPath;
    }
    return parsed.hostname === expected.hostname;
  } catch (_error) {
    return false;
  }
}

function openGenericRealSiteTab(urlString, sendResponse, sessionLabel, onTabReady) {
  if (!isAllowedGenericRealSiteUrl(urlString)) {
    sendResponse({ ok: false, reason: 'url_not_allowed' });
    return false;
  }

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

  chrome.tabs.create({ url: urlString }, function (tab) {
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
      }, GENERIC_REAL_SITE_INITIAL_DELAY_MS);
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
  });

  return true;
}

function runGenericDetectOnTab(tabId, loginFields, attempt, onDone) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
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
          target: { tabId: tabId },
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

          var result =
            results && results[0] ? results[0].result : { ok: false, reason: 'no_result' };

          if ((!result || !result.ok) && attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
            setTimeout(function () {
              runGenericDetectOnTab(tabId, loginFields, attempt + 1, onDone);
            }, GENERIC_REAL_SITE_RETRY_DELAY_MS);
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
      target: { tabId: tabId },
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
          target: { tabId: tabId },
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

          var result =
            results && results[0] ? results[0].result : { ok: false, reason: 'no_result' };

          if ((!result || !result.ok) && attempt < GENERIC_REAL_SITE_MAX_ATTEMPTS) {
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
const LOGIN_ENTRY_DISCOVERY_OPERATION_TIMEOUT_MS = 90000;
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

function tabUrlMatchesDiscoveryPrimary(tabUrl, primaryUrl) {
  if (!tabUrl) {
    return false;
  }

  try {
    var expected = new URL(primaryUrl);
    var parsed = new URL(tabUrl);
    if (parsed.origin !== expected.origin) {
      return false;
    }

    var expectedPath = expected.pathname.replace(/\/$/, '');
    if (expectedPath) {
      return parsed.pathname.replace(/\/$/, '') === expectedPath;
    }

    return parsed.hostname === expected.hostname;
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

function openLoginEntryDiscoveryTab(primaryUrl, sendResponse, onTabReady) {
  if (!isAllowedLoginEntryDiscoveryUrl(primaryUrl)) {
    sendResponse({ ok: false, reason: 'url_not_allowed' });
    return false;
  }

  var respond = onceExternalSendResponse(sendResponse, 'login-entry-discovery');
  var settled = false;
  var readyWorkStarted = false;
  var operationTimeout = null;
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
    refocusReturnTab(returnTabId);
    respond(result);
  }

  function armOperationTimeout() {
    clearOperationTimeout();
    operationTimeout = setTimeout(function () {
      if (settled) {
        return;
      }
      settled = true;
      refocusReturnTab(returnTabId);
      respond({ ok: false, reason: 'operation_timeout' });
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
        closeDiscoveryTabSafely(tabId, function () {
          finishSession({ ok: false, reason: 'tab_load_error' });
        });
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
      closeDiscoveryTabSafely(tabId, function () {
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
  });
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

  if (message.type === 'POC_FILL_IL') {
    console.log('[Israeli Vault POC] HTZone external message POC_FILL_IL received');
    openHtzonePageAndFill(
      message.url,
      message.credentials,
      { withAutofillParam: message.withAutofillParam !== false },
      sendResponse,
    );
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

  if (message.type === 'POC_GENERIC_FILL') {
    openPageAndGenericAutofill(
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
