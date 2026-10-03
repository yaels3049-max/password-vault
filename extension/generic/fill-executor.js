'use strict';

/**
 * Phase 110 fill executor — visible mapped fields only.
 * NEVER auto-submit the login form (AC-110-6).
 * NEVER write hidden / unrelated fields (AC-110-7).
 */
(function (root) {
  // A2.5 — sync-only active probe slot for dispatchInputEvents (no 3rd formal arg;
  // preserves A2 call-site fixture `dispatchInputEvents(element, expected)`).
  var activeStageProbe = null;

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

  /**
   * Dispatch the existing Managed fill event sequence (order fixed).
   * Optional expectedTrim: when a string, record read-only boolean match
   * probes after each existing dispatch (A2.2). Never logs values.
   * Optional onStageProbe (A2.5): set via fillField activeStageProbe slot;
   * invoked AFTER each existing stage action; return ignored; exceptions swallowed.
   * Returns { fill_post_beforeinput, fill_post_input, fill_post_change, fill_post_keyup }
   * when expectedTrim is provided; otherwise {}.
   */
  function dispatchInputEvents(element, expectedTrim) {
    var onStageProbe = activeStageProbe;
    var data = String(valueForEvent(element));
    var probe = expectedTrim != null;
    var expected = probe ? String(expectedTrim) : '';
    var matches = {};

    function notify(stage) {
      if (typeof onStageProbe !== 'function') {
        return;
      }
      try {
        onStageProbe(stage);
      } catch (_probeErr) {
        // A2.5 — fail-open; never affect fill.
      }
    }

    function record(stage) {
      if (!probe) {
        return;
      }
      matches[stage] = readValue(element) === expected;
    }

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
    record('fill_post_beforeinput');
    notify('fill_post_beforeinput');

    try {
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    } catch (_inputEventError) {
      element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    record('fill_post_input');
    notify('fill_post_input');

    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    record('fill_post_change');
    notify('fill_post_change');

    try {
      element.dispatchEvent(
        new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Unidentified' }),
      );
    } catch (_keyError) {
      // Optional; ignore if KeyboardEvent construction fails.
    }
    record('fill_post_keyup');
    notify('fill_post_keyup');

    return matches;
  }

  function readValue(element) {
    if (!element) {
      return '';
    }
    return String(element.value || '').trim();
  }

  function isSafeFillTarget(element) {
    var shared = root.ManagedTargetEligibility;
    if (shared && typeof shared.isSafeFillTarget === 'function') {
      return shared.isSafeFillTarget(element);
    }
    // 120.6: shared module is authoritative (incl. V8). Fail-closed without it —
    // never ACCEPT via detector-only or unconditional true (would skip V8).
    return false;
  }

  /**
   * Fill one field. Optional 4th arg onStageProbe(stageId): A2.5 diagnostic only.
   * Invoked AFTER each existing stage action; return ignored; exceptions swallowed.
   * Absent callback ⇒ pre-A2.5 execution path.
   */
  function fillField(element, value, isSecret) {
    // A2.5 — optional 4th arg onStageProbe via arguments (keeps A2 signature fixtures).
    var onStageProbe = arguments.length > 3 ? arguments[3] : null;
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

    var expected = String(value).trim();
    var prevProbe = activeStageProbe;
    activeStageProbe = typeof onStageProbe === 'function' ? onStageProbe : null;

    function notify(stage) {
      if (typeof onStageProbe !== 'function') {
        return;
      }
      try {
        onStageProbe(stage);
      } catch (_probeErr) {
        // A2.5 — fail-open; never affect fill result or control flow.
      }
    }

    try {
      element.focus();
      setNativeInputValue(element, value);
      // A2.1 — read-only match probe (boolean only; no value logging).
      var matchNativeSet = readValue(element) === expected;
      notify('fill_post_native_set');

      var eventMatches = dispatchInputEvents(element, expected);
      var matchEvents = readValue(element) === expected;
      notify('fill_post_events');

      element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
      var matchBlur = readValue(element) === expected;
      notify('fill_post_blur');

      var actual = readValue(element);
      var verified = actual === expected;

      var fillStageMatches = {
        fill_post_native_set: matchNativeSet,
        fill_post_events: matchEvents,
        fill_post_blur: matchBlur,
      };
      if (eventMatches && typeof eventMatches === 'object') {
        if (typeof eventMatches.fill_post_beforeinput === 'boolean') {
          fillStageMatches.fill_post_beforeinput = eventMatches.fill_post_beforeinput;
        }
        if (typeof eventMatches.fill_post_input === 'boolean') {
          fillStageMatches.fill_post_input = eventMatches.fill_post_input;
        }
        if (typeof eventMatches.fill_post_change === 'boolean') {
          fillStageMatches.fill_post_change = eventMatches.fill_post_change;
        }
        if (typeof eventMatches.fill_post_keyup === 'boolean') {
          fillStageMatches.fill_post_keyup = eventMatches.fill_post_keyup;
        }
      }

      return {
        ok: verified,
        verified: verified,
        actual: isSecret ? maskSecret(actual) : actual,
        // Observational only — must not be consulted for fill decisions elsewhere.
        fillStageMatches: fillStageMatches,
      };
    } finally {
      activeStageProbe = prevProbe;
    }
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
