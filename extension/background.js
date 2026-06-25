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

function openPageAndFill(urlString, sendResponse) {
  const pageConfig = getPageConfig(urlString);
  if (!pageConfig) {
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

chrome.runtime.onMessageExternal.addListener(function (
  message,
  _sender,
  sendResponse,
) {
  if (!message || message.type !== 'POC_FILL_DEMO') {
    sendResponse({ ok: false, reason: 'unknown_message' });
    return false;
  }

  return openPageAndFill(message.url, sendResponse);
});
