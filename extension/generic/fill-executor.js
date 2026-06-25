'use strict';

(function (root) {
  function maskSecret(value) {
    if (!value) {
      return '(empty)';
    }
    return '*'.repeat(Math.min(String(value).length, 8));
  }

  function setNativeInputValue(element, value) {
    var prototype = root.HTMLInputElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  function dispatchInputEvents(element) {
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: String(valueForEvent(element)),
      }),
    );
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function valueForEvent(element) {
    return element.value || '';
  }

  function readValue(element) {
    if (!element) {
      return '';
    }
    return String(element.value || '').trim();
  }

  function fillField(element, value, isSecret) {
    if (!element || value == null || value === '') {
      return { ok: false, reason: 'missing_value' };
    }

    element.focus();
    setNativeInputValue(element, value);
    dispatchInputEvents(element);

    var actual = readValue(element);
    var expected = String(value).trim();
    var verified = actual === expected;

    return {
      ok: verified,
      verified: verified,
      actual: isSecret ? maskSecret(actual) : actual,
    };
  }

  function verifyMappings(mappings, credentials) {
    var results = [];
    var allVerified = true;

    for (var i = 0; i < mappings.length; i += 1) {
      var mapping = mappings[i];
      var expected = credentials[mapping.fieldId];
      var actual = readValue(mapping.element);
      var verified =
        expected != null && String(expected).trim() === actual;

      if (!verified) {
        allVerified = false;
      }

      results.push({
        fieldId: mapping.fieldId,
        verified: verified,
      });
    }

    return { ok: allVerified, results: results };
  }

  root.GenericFillExecutor = {
    fillField: fillField,
    verifyMappings: verifyMappings,
    readValue: readValue,
    maskSecret: maskSecret,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
