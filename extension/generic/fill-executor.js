'use strict';

/**
 * Phase 110 fill executor — visible mapped fields only.
 * NEVER auto-submit the login form (AC-110-6).
 * NEVER write hidden / unrelated fields (AC-110-7).
 */
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

  function valueForEvent(element) {
    return element.value || '';
  }

  function dispatchInputEvents(element) {
    var data = String(valueForEvent(element));
    try {
      element.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          composed: true,
          inputType: 'insertText',
          data: data,
        }),
      );
    } catch (_beforeInputError) {
      // Optional event; ignore if unsupported.
    }
    try {
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          composed: true,
          inputType: 'insertText',
          data: data,
        }),
      );
    } catch (_inputEventError) {
      element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    try {
      element.dispatchEvent(
        new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Unidentified' }),
      );
    } catch (_keyError) {
      // Optional; ignore if KeyboardEvent construction fails.
    }
  }

  function readValue(element) {
    if (!element) {
      return '';
    }
    return String(element.value || '').trim();
  }

  function isSafeFillTarget(element) {
    if (!element || element.tagName !== 'INPUT') {
      return false;
    }
    if (element.type === 'hidden' || element.disabled) {
      return false;
    }
    // readOnly is cleared during fill — banks often set it until focus to defeat autofill.
    var detector = root.GenericFormDetector;
    if (detector && typeof detector.isVisible === 'function') {
      return detector.isVisible(element);
    }
    return true;
  }

  function fillField(element, value, isSecret) {
    if (!element || value == null || value === '') {
      return { ok: false, reason: 'missing_value' };
    }

    if (!isSafeFillTarget(element)) {
      return { ok: false, reason: 'hidden_or_unsafe_target' };
    }

    var wasReadOnly = element.readOnly;
    if (wasReadOnly) {
      element.readOnly = false;
    }

    element.focus();
    setNativeInputValue(element, value);
    dispatchInputEvents(element);
    element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));

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
    isSafeFillTarget: isSafeFillTarget,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
