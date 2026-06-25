'use strict';

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
        url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      return isLocal && url.pathname.endsWith('/demo-login.html');
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

function buildFillMessage(pageConfig) {
  return {
    type: 'FILL',
    demoPage: pageConfig.id,
    credentials: pageConfig.credentials,
    mapping: pageConfig.mapping,
  };
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

function openLocalPageAndFill(urlString, sendResponse) {
  const pageConfig = getPageConfig(urlString);
  if (!pageConfig || pageConfig.id === 'htzone-login') {
    sendResponse({ ok: false, reason: 'not_allowed_page' });
    return false;
  }

  const targetUrl = withAutofillParam(urlString);
  const fillMessage = buildFillMessage(pageConfig);

  chrome.tabs.create({ url: targetUrl }, function (tab) {
    if (chrome.runtime.lastError || !tab || !tab.id) {
      sendResponse({
        ok: false,
        reason: chrome.runtime.lastError
          ? chrome.runtime.lastError.message
          : 'no_tab',
      });
      return;
    }

    const tabId = tab.id;

    function onTabUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        sendFillWithRetry(tabId, fillMessage, 0, sendResponse);
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

chrome.runtime.onMessageExternal.addListener(function (
  message,
  _sender,
  sendResponse,
) {
  if (!message) {
    sendResponse({ ok: false, reason: 'no_message' });
    return false;
  }

  if (message.type === 'POC_FILL_DEMO') {
    return openLocalPageAndFill(message.url, sendResponse);
  }

  if (message.type === 'POC_FILL_IL') {
    console.log('[Israeli Vault POC] HTZone external message POC_FILL_IL received');
    return openHtzonePageAndFill(
      message.url,
      message.credentials,
      { withAutofillParam: message.withAutofillParam !== false },
      sendResponse,
    );
  }

  sendResponse({ ok: false, reason: 'unknown_message' });
  return false;
});
