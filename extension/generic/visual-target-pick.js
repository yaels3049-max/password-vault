/**
 * Phase 119.2 / 120.4 — Visual Mapping click capture (top document only).
 * Identification (click recognized) is separate from Managed eligibility.
 * Derives safe CSS locators; never reads typed values, cookies, or storage.
 * Loaded into page MAIN world for Admin Visual Mapping only.
 */
(function initVisualTargetPick(global) {
  var MAX_CANDIDATES = 8;
  var MAX_ACTION_CANDIDATES = 24;
  var STABLE_EXTRA_CANDIDATES = 4;
  var MAX_STRING = 120;

  function truncate(value) {
    if (typeof value !== 'string') return undefined;
    var trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed) return undefined;
    return trimmed.length > MAX_STRING ? trimmed.slice(0, MAX_STRING) : trimmed;
  }

  function cssEscapeIdent(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  function buildCandidates(el, opts) {
    var out = [];
    var forAction = Boolean(opts && opts.action === true);
    var cap = forAction ? MAX_ACTION_CANDIDATES : MAX_CANDIDATES;
    // D-121-68: volatile-token filter + anchored fallback in every pattern.
    var volatileFilter = global.LocatorDeterminism || null;
    // D-121-48: the other stable extras stay SPECIAL authoring only.
    var stable = opts && opts.stableLocators === true ? volatileFilter : null;
    var doc = el && el.ownerDocument ? el.ownerDocument : global.document;
    if (stable) cap += STABLE_EXTRA_CANDIDATES;
    function push(locator, hint, uncapped) {
      if (!locator || (out.length >= cap && !uncapped)) return;
      if (out.some(function (c) {
        return c.locator === locator;
      })) {
        return;
      }
      if (volatileFilter && volatileFilter.locatorReferencesUnstableId(locator, doc)) return;
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
    if (stable) {
      stable.formAttributeCandidates(el).forEach(function (c) {
        push(c.locator, c.hint);
      });
    }
    var aria = el.getAttribute('aria-label');
    if (aria && !(stable && stable.isSharedAriaLabel(aria, doc))) {
      push(
        el.tagName.toLowerCase() +
          '[aria-label="' +
          String(aria).replace(/"/g, '\\"').slice(0, 80) +
          '"]',
        'aria',
      );
    }
    if (stable) {
      var ph = stable.placeholderCandidate(el);
      if (ph) push(ph.locator, ph.hint);
    }
    var sharedVocab = global.LocatorDeterminism;
    if (forAction && sharedVocab && typeof sharedVocab.actionLocatorCandidates === 'function') {
      sharedVocab.actionLocatorCandidates(el).forEach(function (c) {
        push(c.locator, c.hint);
      });
    }
    if (volatileFilter && !volatileFilter.chooseDeterministicLocator(out, el, doc)) {
      volatileFilter.anchoredStructuralCandidates(el, doc).forEach(function (c) {
        push(c.locator, c.hint, true);
      });
    }
    return out;
  }

  function preferExactOneLocator(candidates, doc) {
    var shared = global.LocatorDeterminism;
    if (shared && typeof shared.preferExactOneLocator === 'function') {
      return shared.preferExactOneLocator(candidates, doc);
    }
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

  function assertLocatorDeterministic(locator, observedEl, doc) {
    var shared = global.LocatorDeterminism;
    if (shared && typeof shared.assertLocatorDeterministic === 'function') {
      return shared.assertLocatorDeterministic(locator, observedEl, doc) === true;
    }
    if (!locator || !observedEl || !doc) return false;
    var matches;
    try {
      matches = doc.querySelectorAll(locator);
    } catch (err) {
      return false;
    }
    return Boolean(matches && matches.length === 1 && matches[0] === observedEl);
  }

  /**
   * Semantic identification: is this a login-field-like control a human clicked?
   * NOT Managed eligibility (aria-hidden / opacity / readOnly may still identify).
   */
  function isIdentifiableControl(el) {
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
    return true;
  }

  var FILLABLE_INPUT_TYPES = ['text', 'email', 'password', 'tel', 'number', 'search', 'url'];

  /**
   * D-121-49 — a click inside a <label> maps to its native labeled control when that
   * control is a fillable text-like input; otherwise null (no resolution).
   */
  function labelFillableControl(el) {
    if (!el || el.nodeType !== 1 || typeof el.closest !== 'function') return null;
    var shared = global.ManagedTargetEligibility;
    if (!shared || typeof shared.labelControlOf !== 'function') return null;
    var label = el.closest('label');
    var control = label ? shared.labelControlOf(label) : null;
    if (!control || control.tagName !== 'INPUT') return null;
    var type = (control.getAttribute('type') || 'text').toLowerCase();
    return FILLABLE_INPUT_TYPES.indexOf(type) >= 0 ? control : null;
  }

  /**
   * D-121-71 — the single identifiable fillable INPUT under the click point, same document
   * (an element over part of a field takes the click). None or more than one → null.
   */
  function pointFillableControl(doc, event) {
    if (!doc || typeof doc.elementsFromPoint !== 'function' || !event) return null;
    if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return null;
    var stack = doc.elementsFromPoint(event.clientX, event.clientY) || [];
    var found = null;
    for (var i = 0; i < stack.length; i += 1) {
      var el = stack[i];
      if (!el || el === found || el.tagName !== 'INPUT' || !isIdentifiableControl(el)) continue;
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      if (FILLABLE_INPUT_TYPES.indexOf(type) < 0) continue;
      if (found) return null;
      found = el;
    }
    return found;
  }

  function managedEligibleFor(el) {
    var shared = global.ManagedTargetEligibility;
    if (shared && typeof shared.isSafeFillTarget === 'function') {
      return shared.isSafeFillTarget(el) === true;
    }
    return false;
  }

  function managedIneligibilityDetail(el) {
    var shared = global.ManagedTargetEligibility;
    if (shared && typeof shared.classifyManagedIneligibility === 'function') {
      return shared.classifyManagedIneligibility(el);
    }
    return 'unsafe_target';
  }

  function isVisibleActionTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled) return false;
    var style = global.getComputedStyle ? global.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * D-121-35 §2 / D-121-41 — SPECIAL action pick (floating_opener / intermediate_transition).
   * The Admin is trusted: target = nearest actionable ancestor if one exists,
   * otherwise the clicked element itself. Visible; exact-one + identity.
   * No skip-link or other heuristic filter (those apply to Analyze only).
   * No Managed fill eligibility (actions are clicked, never filled).
   */
  function identifyActionTarget(target, doc, stableLocators) {
    var shared = global.LocatorDeterminism || {};
    var clicked = target && target.nodeType === 3 ? target.parentElement : target;
    if (!clicked || clicked.nodeType !== 1 || !doc) {
      return { ok: false, reason: 'unsupported_target', state: 'NOT_IDENTIFIED' };
    }
    var actionable =
      typeof shared.resolveActionableTarget === 'function'
        ? shared.resolveActionableTarget(clicked)
        : null;
    var el = actionable || clicked;
    // Page background (html / body) is not an element choice.
    if (el === doc.documentElement || el === doc.body) {
      return { ok: false, reason: 'unsupported_target', state: 'NOT_IDENTIFIED' };
    }
    if (!isVisibleActionTarget(el)) {
      return { ok: false, reason: 'action_target_not_visible', state: 'NOT_IDENTIFIED' };
    }
    var candidates = buildCandidates(
      el,
      stableLocators === true ? { action: true, stableLocators: true } : { action: true },
    );
    if (!candidates.length) {
      return { ok: false, reason: 'no_locator_candidates', state: 'NOT_IDENTIFIED' };
    }
    var chosen = null;
    for (var i = 0; i < candidates.length; i += 1) {
      if (assertLocatorDeterministic(candidates[i].locator, el, doc)) {
        chosen = candidates[i];
        break;
      }
    }
    if (!chosen) {
      return { ok: false, reason: 'no_exact_one_locator', state: 'NOT_IDENTIFIED' };
    }
    return {
      ok: true,
      locator: chosen.locator,
      locatorType: 'css',
      stabilityHint: chosen.stabilityHint,
      locatorCandidates: candidates,
      tagName: el.tagName.toLowerCase(),
      state: 'IDENTIFIED_ACTION',
      actionTarget: true,
      meta: { idAttr: el.id ? truncate(el.id) : undefined },
    };
  }

  function swallowPointer(event) {
    try {
      event.preventDefault();
      event.stopPropagation();
    } catch (_err) {
      /* ignore */
    }
  }

  var ACTION_PICK_SWALLOW_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];

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
    // Optional bound (SPECIAL authoring passes one; STANDARD omits → unbounded as before).
    var timeoutMs =
      options && typeof options.timeoutMs === 'number' && options.timeoutMs > 0
        ? options.timeoutMs
        : 0;
    // 121.1-IF (SPECIAL only): 'pick' | 'report_only'. Absent (STANDARD) → legacy behavior.
    var mode =
      options && (options.mode === 'pick' || options.mode === 'report_only')
        ? options.mode
        : null;
    // D-121-35 (SPECIAL only): 'action' selects the opener / transition pick; else field pick.
    var pickTarget = mode && options.pickTarget === 'action' ? 'action' : 'field';
    // D-121-48 (SPECIAL only): the stable extras. STANDARD passes no mode. The volatile
    // filter + anchored fallback (D-121-68) apply without it.
    var stableLocators = Boolean(mode) && options.stableLocators === true;
    var doc = global.document;

    function frameTags() {
      var isTop = false;
      try {
        isTop = global.top === global;
      } catch (_err) {
        isTop = false;
      }
      return {
        frameOrigin: typeof location !== 'undefined' ? String(location.origin || '') : '',
        isTop: isTop,
      };
    }

    return new Promise(function (resolve) {
      var settled = false;
      var timer = null;

      function disarm(reason) {
        finish({
          ok: false,
          reason: typeof reason === 'string' && reason ? reason : 'visual_pick_cancelled',
          fieldId: fieldId,
        });
        return true;
      }

      function finish(result) {
        if (settled) return;
        settled = true;
        if (mode && result && typeof result === 'object') {
          var tags = frameTags();
          result.frameOrigin = tags.frameOrigin;
          result.isTop = tags.isTop;
        }
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        try {
          doc.removeEventListener('click', onClick, true);
        } catch (err) {
          /* ignore */
        }
        if (pickTarget === 'action') {
          ACTION_PICK_SWALLOW_EVENTS.forEach(function (type) {
            try {
              doc.removeEventListener(type, swallowPointer, true);
            } catch (_err) {
              /* ignore */
            }
          });
        }
        if (global.__disarmVisualTargetPick === disarm) {
          global.__disarmVisualTargetPick = undefined;
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

        if (mode === 'report_only') {
          // Nested frame: a click here is reported as UNSUPPORTED, never mapped.
          finish({ ok: false, reason: 'nested_frame_unsupported', fieldId: fieldId });
          return;
        }

        if (mode) {
          var path =
            typeof event.composedPath === 'function' ? event.composedPath() : [];
          if (path.length && path[0] !== event.target) {
            // Click landed inside a shadow root (retargeted to its host).
            finish({ ok: false, reason: 'shadow_dom_unsupported', fieldId: fieldId });
            return;
          }
        }

        if (pickTarget === 'action') {
          var actionResult = identifyActionTarget(event.target, doc, stableLocators);
          actionResult.fieldId = fieldId;
          finish(actionResult);
          return;
        }

        var el = event.target;
        if (el && el.nodeType === 3) {
          el = el.parentElement;
        }
        if (!isIdentifiableControl(el)) {
          el = labelFillableControl(el) || el;
        }
        if (!isIdentifiableControl(el)) {
          el = pointFillableControl(doc, event) || el;
        }
        if (!isIdentifiableControl(el)) {
          finish({
            ok: false,
            reason: 'unsupported_target',
            fieldId: fieldId,
            state: 'NOT_IDENTIFIED',
          });
          return;
        }

        // Click recognized → identification occurred (even if Managed-ineligible).
        var candidates = stableLocators ? buildCandidates(el, { stableLocators: true }) : buildCandidates(el);
        if (!candidates.length) {
          finish({
            ok: false,
            reason: 'no_locator_candidates',
            fieldId: fieldId,
            identified: true,
            state: 'IDENTIFIED_BUT_MANAGED_INELIGIBLE',
          });
          return;
        }

        var chosen = preferExactOneLocator(candidates, doc);
        if (!chosen) {
          finish({
            ok: false,
            reason: 'no_exact_one_locator',
            fieldId: fieldId,
            identified: true,
            state: 'IDENTIFIED_BUT_MANAGED_INELIGIBLE',
          });
          return;
        }

        // 120.9: exact-one locator must resolve to the clicked element (identity).
        if (!assertLocatorDeterministic(chosen.locator, el, doc)) {
          finish({
            ok: false,
            reason: 'locator_target_mismatch',
            fieldId: fieldId,
            identified: true,
            state: 'IDENTIFIED_BUT_MANAGED_INELIGIBLE',
          });
          return;
        }

        if (!managedEligibleFor(el)) {
          finish({
            ok: false,
            reason: 'managed_ineligible',
            fieldId: fieldId,
            identified: true,
            state: 'IDENTIFIED_BUT_MANAGED_INELIGIBLE',
            detail: managedIneligibilityDetail(el),
            // Locator evidence only — Hub must NOT treat as mapping success.
            locatorEvidence: chosen.locator,
            locatorType: 'css',
            tagName: el.tagName.toLowerCase(),
            meta: {
              idAttr: el.id ? truncate(el.id) : undefined,
              nameAttr: el.name ? truncate(String(el.name)) : undefined,
            },
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
          state: 'IDENTIFIED_AND_MANAGED_ELIGIBLE',
          managedEligible: true,
          // Never include value / cookies / storage
          meta: {
            idAttr: el.id ? truncate(el.id) : undefined,
            nameAttr: el.name ? truncate(String(el.name)) : undefined,
          },
        });
      }

      // A newer pick supersedes any still-armed one so listeners never stack.
      if (typeof global.__disarmVisualTargetPick === 'function') {
        global.__disarmVisualTargetPick('visual_pick_superseded');
      }
      global.__disarmVisualTargetPick = disarm;
      doc.addEventListener('click', onClick, true);
      if (pickTarget === 'action') {
        // Opener pick: the site must not react to the press before the click is captured.
        ACTION_PICK_SWALLOW_EVENTS.forEach(function (type) {
          doc.addEventListener(type, swallowPointer, true);
        });
      }
      if (timeoutMs > 0) {
        timer = setTimeout(function () {
          disarm('visual_pick_timeout');
        }, timeoutMs);
      }
    });
  }

  global.armVisualTargetPick = armVisualTargetPick;
  global.__visualTargetPickHelpers = {
    buildCandidates: buildCandidates,
    preferExactOneLocator: preferExactOneLocator,
    assertLocatorDeterministic: assertLocatorDeterministic,
    isIdentifiableControl: isIdentifiableControl,
    labelFillableControl: labelFillableControl,
    pointFillableControl: pointFillableControl,
    managedEligibleFor: managedEligibleFor,
    identifyActionTarget: identifyActionTarget,
  };
})(typeof window !== 'undefined' ? window : globalThis);
