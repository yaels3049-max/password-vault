'use strict';

const SUCCESS_MESSAGE = 'המילוי בוצע בהצלחה';
const AUTO_FILL_DELAYS_MS = [100, 400, 800, 1200, 2000, 3000];

function setFieldValue(element, value) {
  element.focus();
  setNativeInputValue(element, value);
  dispatchInputEvents(element);
}

function showFillSuccess() {
  let el = document.getElementById('poc-fill-success');
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
    const form = document.querySelector('form');
    if (form) {
      form.insertAdjacentElement('afterend', el);
    } else {
      document.body.appendChild(el);
    }
  }
  el.textContent = SUCCESS_MESSAGE;
  el.hidden = false;
}

function resolveFillContext(message) {
  const pageKey = (message && message.demoPage) || getPageKey();
  if (!pageKey) {
    return null;
  }

  const mapping =
    (message && message.mapping) ||
    getMappingForPageKey(pageKey) ||
    getMappingForPage();
  const credentials =
    (message && message.credentials) ||
    getMockCredentialsForPageKey(pageKey) ||
    getMockCredentialsForPage();

  if (!mapping || !credentials) {
    return null;
  }

  return { pageKey, mapping, credentials };
}

function resolveGenericFillContext(message) {
  const pageKey = (message && message.demoPage) || getPageKey();
  if (!pageKey) {
    return null;
  }

  const loginFields =
    (message && message.loginFields) ||
    getLoginFieldsForPageKey(pageKey) ||
    getLoginFieldsForPage();
  const credentials =
    (message && message.credentials) ||
    getMockCredentialsForPageKey(pageKey) ||
    getMockCredentialsForPage();

  if (!loginFields || !credentials) {
    return null;
  }

  return { pageKey, loginFields, credentials };
}

function fillWithGenericEngine(message) {
  if (typeof runGenericAutofill !== 'function') {
    return null;
  }

  const context = resolveGenericFillContext(message);
  if (!context) {
    return { ok: false, reason: 'no_generic_context' };
  }

  return runGenericAutofill({
    loginFields: context.loginFields,
    credentials: context.credentials,
  });
}

function fillPracticeVaultMessage(message) {
  console.log('[Practice] Fill message received');

  const credentials = message && message.credentials;
  if (!credentials) {
    return { ok: false, reason: 'no_credentials' };
  }

  const usernameEl = document.querySelector('#username');
  const passwordEl = document.querySelector('#password');

  if (usernameEl) {
    console.log('[Practice] Username field found');
  }

  if (passwordEl) {
    console.log('[Practice] Password field found');
  }

  if (!usernameEl || !passwordEl) {
    return { ok: false, reason: 'fields_not_found' };
  }

  const username = credentials.username;
  const password = credentials.password;

  if (!username || !password) {
    return { ok: false, reason: 'missing_vault_values' };
  }

  setFieldValue(usernameEl, username);
  setFieldValue(passwordEl, password);
  showFillSuccess();
  console.log('[Practice] Fields filled');

  return { ok: true, filled: 2 };
}

function fillCredentialsLegacy(message) {
  const context = resolveFillContext(message);
  if (!context) {
    return { ok: false, reason: 'no_mapping' };
  }

  let filled = 0;

  for (let i = 0; i < context.mapping.length; i += 1) {
    const field = context.mapping[i];
    const element = queryFieldElement(field);
    const value = context.credentials[field.credentialId];

    if (!element || value == null || value === '') {
      continue;
    }

    setFieldValue(element, value);
    filled += 1;
  }

  const ok = filled === context.mapping.length;
  if (ok) {
    showFillSuccess();
  }

  return { ok, filled };
}

function fillCredentials(message) {
  if (message && message.vaultFill) {
    return fillPracticeVaultMessage(message);
  }

  if (isLocalDemoPage()) {
    const genericResult = fillWithGenericEngine(message);
    if (genericResult && genericResult.ok) {
      showFillSuccess();
      return genericResult;
    }
    console.log('[Legacy Autofill] fallback used');
  }

  return fillCredentialsLegacy(message);
}

function shouldAutoFillFromUrl() {
  if (!isLocalDemoPage()) {
    return false;
  }
  return new URLSearchParams(location.search).get('pocAutofill') === '1';
}

function runAutoFillFromUrl() {
  if (!shouldAutoFillFromUrl()) {
    return;
  }
  fillCredentials();
}

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message) {
    return false;
  }

  if (message.type === 'PRACTICE_PING') {
    sendResponse({ ready: true });
    return false;
  }

  if (message.type !== 'FILL') {
    return false;
  }

  if (!isLocalDemoPage() && !message.demoPage) {
    return false;
  }

  sendResponse(fillCredentials(message));
  return false;
});

function scheduleAutoFill() {
  runAutoFillFromUrl();
  for (let i = 0; i < AUTO_FILL_DELAYS_MS.length; i += 1) {
    setTimeout(runAutoFillFromUrl, AUTO_FILL_DELAYS_MS[i]);
  }
}

if (isLocalDemoPage()) {
  console.log('[Practice] Content script loaded on demo page');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleAutoFill);
} else {
  scheduleAutoFill();
}
