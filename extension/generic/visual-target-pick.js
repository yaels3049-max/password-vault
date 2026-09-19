/**
 * Phase 119.2 — Visual Mapping click capture (top document only).
 * Derives safe CSS locators; never reads typed values, cookies, or storage.
 * Loaded into page MAIN world for Admin Visual Mapping only.
 */
(function initVisualTargetPick(global) {
  var MAX_CANDIDATES = 8;
  var MAX_STRING = 120;

  function truncate(value) {
    if (typeof value !== 'string') return undefined;
    var trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed) return undefined;
    return trimmed.length > MAX_STRING ? trimmed.slice(0, MAX_STRING) : trimmed;
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled) return false;
    var style = global.getComputedStyle(el);
    if (!style) return true;
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function cssEscapeIdent(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  function buildCandidates(el) {
    var out = [];
    function push(locator, hint) {
      if (!locator || out.length >= MAX_CANDIDATES) return;
      if (out.some(function (c) {
        return c.locator === locator;
      })) {
        return;
      }
      out.push({ strategy: 'css', locator: locator, stabilityHint: hint });
    }
    if (el.id) push('#' + cssEscapeIdent(el.id), 'id');
    if (el.name) {
      push(
        el.tagName.toLowerCase() +
          '[name="' +
          String(el.name).replace(/"/g, '\\"') +
          '"]',
        'name',
      );
    }
    var ac = el.getAttribute('autocomplete');
    if (ac && ac !== 'on' && ac !== 'off') {
      push(
        el.tagName.toLowerCase() +
          '[autocomplete="' +
          String(ac).replace(/"/g, '\\"') +
          '"]',
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

  function preferExactOneLocator(candidates, doc) {
    for (var i = 0; i < candidates.length; i += 1) {
      var locator = candidates[i].locator;
      var matches;
      try {
        matches = doc.querySelectorAll(locator);
      } catch (err) {
        continue;
      }
      if (matches && matches.length === 1) {
        return {
          locator: locator,
          locatorType: 'css',
          stabilityHint: candidates[i].stabilityHint,
          locatorCandidates: candidates,
        };
      }
    }
    return null;
  }

  function isEligibleControl(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') return false;
    var type = (el.getAttribute('type') || el.type || 'text').toLowerCase();
    if (
      type === 'hidden' ||
      type === 'submit' ||
      type === 'button' ||
      type === 'image'
    ) {
      return false;
    }
    if (!isVisible(el)) return false;
    if (el.readOnly || el.disabled) return false;
    return true;
  }

  /**
   * Arm one-shot click capture. Resolves with structured result.
   * Does not submit forms; prevents default on capture.
   */
  function armVisualTargetPick(options) {
    var expectedOrigin =
      options && typeof options.expectedOrigin === 'string'
        ? options.expectedOrigin
        : '';
    var fieldId =
      options && typeof options.fieldId === 'string' ? options.fieldId : '';
    var doc = global.document;

    return new Promise(function (resolve) {
      var settled = false;

      function finish(result) {
        if (settled) return;
        settled = true;
        try {
          doc.removeEventListener('click', onClick, true);
        } catch (err) {
          /* ignore */
        }
        resolve(result);
      }

      if (
        !expectedOrigin ||
        typeof location === 'undefined' ||
        location.origin !== expectedOrigin
      ) {
        finish({ ok: false, reason: 'origin_mismatch', fieldId: fieldId });
        return;
      }

      function onClick(event) {
        try {
          event.preventDefault();
          event.stopPropagation();
        } catch (err) {
          /* ignore */
        }

        if (
          typeof location === 'undefined' ||
          location.origin !== expectedOrigin
        ) {
          finish({ ok: false, reason: 'origin_mismatch', fieldId: fieldId });
          return;
        }

        var el = event.target;
        if (el && el.nodeType === 3) {
          el = el.parentElement;
        }
        if (!isEligibleControl(el)) {
          finish({
            ok: false,
            reason: 'unsupported_target',
            fieldId: fieldId,
          });
          return;
        }

        var candidates = buildCandidates(el);
        if (!candidates.length) {
          finish({
            ok: false,
            reason: 'no_locator_candidates',
            fieldId: fieldId,
          });
          return;
        }

        var chosen = preferExactOneLocator(candidates, doc);
        if (!chosen) {
          finish({
            ok: false,
            reason: 'no_exact_one_locator',
            fieldId: fieldId,
          });
          return;
        }

        finish({
          ok: true,
          fieldId: fieldId,
          locator: chosen.locator,
          locatorType: chosen.locatorType,
          stabilityHint: chosen.stabilityHint,
          locatorCandidates: chosen.locatorCandidates,
          tagName: el.tagName.toLowerCase(),
          // Never include value / cookies / storage
          meta: {
            idAttr: el.id ? truncate(el.id) : undefined,
            nameAttr: el.name ? truncate(String(el.name)) : undefined,
          },
        });
      }

      doc.addEventListener('click', onClick, true);
    });
  }

  global.armVisualTargetPick = armVisualTargetPick;
  global.__visualTargetPickHelpers = {
    buildCandidates: buildCandidates,
    preferExactOneLocator: preferExactOneLocator,
    isEligibleControl: isEligibleControl,
    isVisible: isVisible,
  };
})(typeof window !== 'undefined' ? window : globalThis);
