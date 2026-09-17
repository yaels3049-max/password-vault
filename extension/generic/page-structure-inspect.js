/**
 * Phase 118 — top-document SafePageStructure extraction.
 * Never reads typed input contents, document cookies, or storage.
 * Loaded into page MAIN world for Admin inspect only.
 */
(function initPageStructureInspect(global) {
  var MAX_INPUTS = 40;
  var MAX_STRING = 120;
  var MAX_CANDIDATES = 8;

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
    function push(locator, hint) {
      if (!locator || out.length >= MAX_CANDIDATES) return;
      if (out.some(function (c) { return c.locator === locator; })) return;
      out.push({ strategy: 'css', locator: locator, stabilityHint: hint });
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
        visible: isVisible(el),
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

  global.collectSafePageStructure = collectSafePageStructure;
})(typeof window !== 'undefined' ? window : globalThis);
