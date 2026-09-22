/**
 * Phase 118 — top-document SafePageStructure extraction.
 * Phase 119 — readiness_wait_inputs: bounded observe/retry until eligible inputs
 * appear or max wait (Admin inspect timing only; not Managed Autofill).
 * Never reads typed input contents, document cookies, or storage.
 * Loaded into page MAIN world for Admin inspect only.
 */
(function initPageStructureInspect(global) {
  var MAX_INPUTS = 40;
  var MAX_STRING = 120;
  var MAX_CANDIDATES = 8;
  /** Default readiness window — generic product default; not hostname-tuned. */
  var DEFAULT_READINESS_MAX_WAIT_MS = 10000;
  /** Default observation cadence — generic UI poll; not hostname-tuned. */
  var DEFAULT_READINESS_POLL_MS = 250;

  function truncate(value) {
    if (typeof value !== 'string') return undefined;
    var trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed) return undefined;
    return trimmed.length > MAX_STRING ? trimmed.slice(0, MAX_STRING) : trimmed;
  }

  /**
   * Observation / identification presence — NOT Managed eligibility.
   * May report controls that fail Managed isVisible / isSafeFillTarget.
   * Must not equal Managed isVisible alone (120.4 §1A).
   */
  function isObservedForIdentification(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled) return false;
    var style = global.getComputedStyle(el);
    if (!style) return true;
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    // Do not reject opacity:0 alone (observation; Managed also does not).
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function managedEligibleFor(el) {
    var shared = global.ManagedTargetEligibility;
    if (shared && typeof shared.isSafeFillTarget === 'function') {
      return shared.isSafeFillTarget(el) === true;
    }
    return false;
  }

  function cssEscapeIdent(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  function labelFor(el) {
    if (el.id) {
      var byFor = el.ownerDocument.querySelector(
        'label[for="' + cssEscapeIdent(el.id) + '"]',
      );
      if (byFor) return truncate(byFor.textContent || '');
    }
    var parentLabel = el.closest && el.closest('label');
    if (parentLabel) return truncate(parentLabel.textContent || '');
    return undefined;
  }

  function nearbyText(el) {
    var prev = el.previousElementSibling;
    if (prev) {
      var t = truncate(prev.textContent || '');
      if (t) return t;
    }
    var parent = el.parentElement;
    if (parent) {
      var cloned = parent.cloneNode(true);
      var inputs = cloned.querySelectorAll('input, textarea, select, button');
      for (var i = 0; i < inputs.length; i += 1) {
        inputs[i].remove();
      }
      return truncate(cloned.textContent || '');
    }
    return undefined;
  }

  function buildCandidates(el) {
    var out = [];
    var doc = el && el.ownerDocument ? el.ownerDocument : global.document;
    function push(locator, hint) {
      if (!locator || out.length >= MAX_CANDIDATES) return;
      if (out.some(function (c) { return c.locator === locator; })) return;
      var matchCount = 0;
      var shared = global.LocatorDeterminism;
      if (shared && typeof shared.countLocatorMatches === 'function') {
        matchCount = shared.countLocatorMatches(locator, doc);
      } else {
        try {
          matchCount = doc.querySelectorAll(locator).length;
        } catch (err) {
          matchCount = 0;
        }
      }
      out.push({
        strategy: 'css',
        locator: locator,
        stabilityHint: hint,
        matchCount: matchCount,
      });
    }
    if (el.id) push('#' + cssEscapeIdent(el.id), 'id');
    if (el.name) {
      push(
        el.tagName.toLowerCase() + '[name="' + String(el.name).replace(/"/g, '\\"') + '"]',
        'name',
      );
    }
    var ac = el.getAttribute('autocomplete');
    if (ac && ac !== 'on' && ac !== 'off') {
      push(
        el.tagName.toLowerCase() + '[autocomplete="' + String(ac).replace(/"/g, '\\"') + '"]',
        'autocomplete',
      );
    }
    var aria = el.getAttribute('aria-label');
    if (aria) {
      push(
        el.tagName.toLowerCase() +
          '[aria-label="' +
          String(aria).replace(/"/g, '\\"').slice(0, 80) +
          '"]',
        'aria',
      );
    }
    return out;
  }

  function collectSafePageStructure() {
    var doc = global.document;
    var nodes = doc.querySelectorAll('input, textarea');
    var inputs = [];
    var truncated = false;
    for (var i = 0; i < nodes.length; i += 1) {
      if (inputs.length >= MAX_INPUTS) {
        truncated = true;
        break;
      }
      var el = nodes[i];
      var type = (el.getAttribute('type') || el.type || 'text').toLowerCase();
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'image') {
        continue;
      }
      // Never read the live typed contents of the control
      var candidates = buildCandidates(el);
      if (!candidates.length) continue;
      inputs.push({
        inputId: 'in-' + String(inputs.length + 1),
        tagName: el.tagName.toLowerCase(),
        type: type,
        idAttr: el.id || undefined,
        nameAttr: el.name || undefined,
        autocomplete: el.getAttribute('autocomplete') || undefined,
        placeholder: truncate(el.getAttribute('placeholder') || ''),
        ariaLabel: truncate(el.getAttribute('aria-label') || ''),
        associatedLabelText: labelFor(el),
        nearbySafeText: nearbyText(el),
        // Observation only — may be true for Managed-ineligible controls (§1A).
        visible: isObservedForIdentification(el),
        managedEligible: managedEligibleFor(el),
        editable: !el.readOnly && !el.disabled,
        disabled: Boolean(el.disabled),
        readOnly: Boolean(el.readOnly),
        locatorCandidates: candidates,
      });
    }

    return {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      finalUrl: String(global.location.href || ''),
      origin: String(global.location.origin || ''),
      title: truncate(doc.title || ''),
      documentLanguage: truncate(doc.documentElement.lang || ''),
      inputs: inputs,
      limits: {
        truncated: truncated,
        maxInputsApplied: MAX_INPUTS,
      },
    };
  }

  function sleepMs(ms) {
    return new Promise(function (resolve) {
      global.setTimeout(resolve, ms);
    });
  }

  function originMatchesExpected(expectedOrigin) {
    if (typeof expectedOrigin !== 'string' || !expectedOrigin) {
      return false;
    }
    if (typeof global.location === 'undefined') {
      return false;
    }
    return global.location.origin === expectedOrigin;
  }

  /**
   * Bounded poll/observe until eligible top-doc inputs appear or timeout.
   * Early-exits on first non-empty collectSafePageStructure().inputs.
   * Does not use a single arbitrary sleep as the sole readiness mechanism.
   * Never reads input values / cookies / storage.
   *
   * @param {{ expectedOrigin: string, maxTotalWaitMs?: number, pollIntervalMs?: number }} options
   * @returns {Promise<{ ok: true, page: object, readiness: object } | { ok: false, reason: string }>}
   */
  async function collectSafePageStructureWithReadiness(options) {
    var expectedOrigin =
      options && typeof options.expectedOrigin === 'string'
        ? options.expectedOrigin
        : '';
    var maxTotalWaitMs =
      options && typeof options.maxTotalWaitMs === 'number'
        ? options.maxTotalWaitMs
        : DEFAULT_READINESS_MAX_WAIT_MS;
    var pollIntervalMs =
      options && typeof options.pollIntervalMs === 'number'
        ? options.pollIntervalMs
        : DEFAULT_READINESS_POLL_MS;

    if (!originMatchesExpected(expectedOrigin)) {
      return { ok: false, reason: 'origin_mismatch' };
    }

    var startedAt =
      typeof Date.now === 'function' ? Date.now() : new Date().getTime();

    while (true) {
      if (!originMatchesExpected(expectedOrigin)) {
        return { ok: false, reason: 'origin_mismatch' };
      }

      var page = collectSafePageStructure();
      if (!page || page.origin !== expectedOrigin) {
        return { ok: false, reason: 'origin_mismatch' };
      }

      var waitedMs =
        (typeof Date.now === 'function' ? Date.now() : new Date().getTime()) -
        startedAt;
      var eligibleCount = Array.isArray(page.inputs) ? page.inputs.length : 0;

      if (eligibleCount > 0) {
        return {
          ok: true,
          page: page,
          readiness: {
            capability: 'readiness_wait_inputs',
            waitedMs: waitedMs,
            earlyExit: true,
            timedOut: false,
          },
        };
      }

      if (waitedMs >= maxTotalWaitMs) {
        return {
          ok: true,
          page: page,
          readiness: {
            capability: 'readiness_wait_inputs',
            waitedMs: waitedMs,
            earlyExit: false,
            timedOut: true,
          },
        };
      }

      var remaining = maxTotalWaitMs - waitedMs;
      var delay = Math.min(pollIntervalMs, remaining);
      await sleepMs(delay);
    }
  }

  global.collectSafePageStructure = collectSafePageStructure;
  global.collectSafePageStructureWithReadiness =
    collectSafePageStructureWithReadiness;
  /** Verify-only helpers (synthetic fixtures). */
  global.__pageStructureInspectHelpers = {
    DEFAULT_READINESS_MAX_WAIT_MS: DEFAULT_READINESS_MAX_WAIT_MS,
    DEFAULT_READINESS_POLL_MS: DEFAULT_READINESS_POLL_MS,
    originMatchesExpected: originMatchesExpected,
  };
})(typeof window !== 'undefined' ? window : globalThis);
