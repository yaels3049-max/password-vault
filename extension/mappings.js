'use strict';

const DEMO_PAGES = {
  'demo-login-3-fields.html': {
    loginFields: [
      { id: 'idNumber', label: 'תעודת זהות', type: 'text' },
      { id: 'userCode', label: 'קוד משתמש', type: 'text' },
      { id: 'password', label: 'סיסמה', type: 'password' },
    ],
    mapping: [
      { credentialId: 'idNumber', selector: '#idNumber' },
      { credentialId: 'userCode', selector: '#userCode' },
      { credentialId: 'password', selector: '#password' },
    ],
    mockCredentials: {
      idNumber: '123456789',
      userCode: 'demo-code',
      password: 'demo-pass',
    },
  },
  'demo-login.html': {
    loginFields: [
      { id: 'username', label: 'שם משתמש', type: 'text' },
      { id: 'password', label: 'סיסמה', type: 'password' },
    ],
    mapping: [
      { credentialId: 'username', selector: '#username' },
      { credentialId: 'password', selector: '#password' },
    ],
    mockCredentials: {
      username: 'demo-user',
      password: 'demo-pass',
    },
  },
};

function getDemoPageKey() {
  const path = location.pathname || '';

  if (path.indexOf('demo-login-3-fields.html') !== -1) {
    return 'demo-login-3-fields.html';
  }

  if (path.indexOf('demo-login.html') !== -1) {
    return 'demo-login.html';
  }

  return null;
}

function getPageKey() {
  return getDemoPageKey();
}

function isLocalDemoPage() {
  return getDemoPageKey() !== null;
}

function isPocPage() {
  return isLocalDemoPage();
}

function isThreeFieldDemoPage() {
  return getDemoPageKey() === 'demo-login-3-fields.html';
}

function setNativeInputValue(element, value) {
  const prototype = window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function dispatchInputEvents(element) {
  element.dispatchEvent(
    new InputEvent('input', { bubbles: true, cancelable: true }),
  );
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function queryFieldElement(field) {
  if (!field.selector) {
    return null;
  }
  return document.querySelector(field.selector);
}

function getMappingForPage() {
  const pageKey = getPageKey();
  if (!pageKey) {
    return null;
  }
  return DEMO_PAGES[pageKey].mapping;
}

function getMockCredentialsForPage() {
  const pageKey = getPageKey();
  if (!pageKey) {
    return null;
  }
  return DEMO_PAGES[pageKey].mockCredentials;
}

function getMockCredentialsForPageKey(pageKey) {
  if (!pageKey || !DEMO_PAGES[pageKey]) {
    return null;
  }
  return DEMO_PAGES[pageKey].mockCredentials;
}

function getLoginFieldsForPageKey(pageKey) {
  if (!pageKey || !DEMO_PAGES[pageKey]) {
    return null;
  }
  return DEMO_PAGES[pageKey].loginFields;
}

function getLoginFieldsForPage() {
  const pageKey = getPageKey();
  if (!pageKey) {
    return null;
  }
  return DEMO_PAGES[pageKey].loginFields;
}

function getMappingForPageKey(pageKey) {
  if (!pageKey || !DEMO_PAGES[pageKey]) {
    return null;
  }
  return DEMO_PAGES[pageKey].mapping;
}
