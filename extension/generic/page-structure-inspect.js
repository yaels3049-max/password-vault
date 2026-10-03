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
  var MAX_ACTION_CANDIDATES = 24;
  var STABLE_EXTRA_CANDIDATES = 4;
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

  function buildCandidates(el, opts) {
    var out = [];
    var doc = el && el.ownerDocument ? el.ownerDocument : global.document;
    var forAction = Boolean(opts && opts.action === true);
    var cap = forAction ? MAX_ACTION_CANDIDATES : MAX_CANDIDATES;
    // D-121-68: volatile-token filter + anchored fallback in every pattern.
    var volatileFilter = global.LocatorDeterminism || null;
    // D-121-48: the other stable extras stay SPECIAL authoring only.
    var stable = opts && opts.stableLocators === true ? volatileFilter : null;
    if (stable) cap += STABLE_EXTRA_CANDIDATES;
    function push(locator, hint, uncapped) {
      if (!locator || (out.length >= cap && !uncapped)) return;
      if (out.some(function (c) { return c.locator === locator; })) return;
      if (volatileFilter && volatileFilter.locatorReferencesUnstableId(locator, doc)) return;
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

  function collectSafePageStructure(options) {
    var stableLocators = Boolean(options && options.stableLocators === true);
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
      var candidates = stableLocators ? buildCandidates(el, { stableLocators: true }) : buildCandidates(el);
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
      // 121.1-IF — booleans / counts only (additive; STANDARD ignores them).
      frameContext: frameContext(),
      shadowCredentialCandidates: countShadowCredentialCandidates(doc),
    };
  }

  function frameContext() {
    var isTop = false;
    var isDepth1 = false;
    try {
      isTop = global.top === global;
      isDepth1 = !isTop && global.parent === global.top;
    } catch (_err) {
      /* cross-origin access to top/parent identity is allowed; ignore otherwise */
    }
    return { isTop: isTop, isDepth1: isDepth1 };
  }

  var MAX_SHADOW_HOSTS = 400;
  var MAX_SHADOW_DEPTH = 4;

  function isCredentialLikeInput(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName.toLowerCase();
    if (tag !== 'input') return false;
    var type = (el.getAttribute('type') || el.type || 'text').toLowerCase();
    return (
      type === 'password' ||
      type === 'text' ||
      type === 'email' ||
      type === 'tel' ||
      type === 'number'
    );
  }

  /**
   * 121.1-IF UNSUPPORTED evidence: credential-like inputs under OPEN shadow roots
   * (bounded walk). Counted only — never added to inputs[], never proposed.
   */
  function countShadowCredentialCandidates(doc) {
    var count = 0;
    var visitedHosts = 0;
    function walk(root, depth) {
      if (!root || depth > MAX_SHADOW_DEPTH) return;
      var all;
      try {
        all = root.querySelectorAll('*');
      } catch (_err) {
        return;
      }
      for (var i = 0; i < all.length; i += 1) {
        var host = all[i];
        if (!host.shadowRoot) continue;
        visitedHosts += 1;
        if (visitedHosts > MAX_SHADOW_HOSTS) return;
        var inner;
        try {
          inner = host.shadowRoot.querySelectorAll('input');
        } catch (_err) {
          inner = [];
        }
        for (var j = 0; j < inner.length; j += 1) {
          if (isCredentialLikeInput(inner[j]) && isObservedForIdentification(inner[j])) count += 1;
        }
        walk(host.shadowRoot, depth + 1);
      }
    }
    walk(doc, 0);
    return count;
  }

  /**
   * 121.1-IF R3 reveal readiness: exact-one locators of Managed-eligible,
   * credential-like inputs in THIS document. Locators only (no values).
   */
  function collectSpecialEligibleCredentialLocators() {
    var doc = global.document;
    var nodes = doc.querySelectorAll('input');
    var out = [];
    for (var i = 0; i < nodes.length && out.length < MAX_INPUTS; i += 1) {
      var el = nodes[i];
      if (!isCredentialLikeInput(el) || !managedEligibleFor(el)) continue;
      var candidates = buildCandidates(el);
      for (var c = 0; c < candidates.length; c += 1) {
        if (candidates[c].matchCount === 1) {
          out.push(candidates[c].locator);
          break;
        }
      }
    }
    return out;
  }

  /**
   * D-121-47 (G8): same inputs as collectSpecialEligibleCredentialLocators, each tagged
   * with whether it is a password field. Locators + a boolean only (no values).
   */
  function collectSpecialEligibleCredentialInputs() {
    var doc = global.document;
    var nodes = doc.querySelectorAll('input');
    var out = [];
    for (var i = 0; i < nodes.length && out.length < MAX_INPUTS; i += 1) {
      var el = nodes[i];
      if (!isCredentialLikeInput(el) || !managedEligibleFor(el)) continue;
      var candidates = buildCandidates(el);
      for (var c = 0; c < candidates.length; c += 1) {
        if (candidates[c].matchCount === 1) {
          var type = String(el.getAttribute('type') || el.type || '').toLowerCase();
          var autocomplete = String(el.getAttribute('autocomplete') || '').toLowerCase();
          out.push({
            locator: candidates[c].locator,
            password: type === 'password' || /(^|\s)current-password(\s|$)/.test(autocomplete),
          });
          break;
        }
      }
    }
    return out;
  }

  /** 121.1-IF R3 declared readiness: exact-one Managed-eligible element for locator. */
  function isSpecialDeclaredReadinessMet(locator) {
    if (typeof locator !== 'string' || !locator) return false;
    var matches;
    try {
      matches = global.document.querySelectorAll(locator);
    } catch (_err) {
      return false;
    }
    return Boolean(matches && matches.length === 1 && managedEligibleFor(matches[0]));
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
   * D-121-52: counts only (no values). The page is settled for inspect when at least one
   * input is Managed-eligible and no observed-visible input is still Managed-ineligible
   * (e.g. inputs rendered under a boot overlay / transition on SPA login pages).
   */
  function inspectReadinessCounts(inputs) {
    var eligible = 0;
    var visibleIneligible = 0;
    var list = Array.isArray(inputs) ? inputs : [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].managedEligible === true) eligible += 1;
      else if (list[i].visible === true) visibleIneligible += 1;
    }
    return { eligibleInputs: eligible, visibleIneligibleInputs: visibleIneligible };
  }

  /**
   * Bounded poll/observe until eligible top-doc inputs appear or timeout.
   * Early-exits on the first poll where inspectReadinessCounts reports ≥1 eligible input
   * and 0 visible-ineligible inputs; on timeout returns the last snapshot.
   * Does not use a single arbitrary sleep as the sole readiness mechanism.
   * Never reads input values / cookies / storage.
   *
   * @param {{ expectedOrigin: string, maxTotalWaitMs?: number, pollIntervalMs?: number, stableLocators?: boolean }} options
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

      var page = collectSafePageStructure(
        options && options.stableLocators === true ? { stableLocators: true } : undefined,
      );
      if (!page || page.origin !== expectedOrigin) {
        return { ok: false, reason: 'origin_mismatch' };
      }

      var waitedMs =
        (typeof Date.now === 'function' ? Date.now() : new Date().getTime()) -
        startedAt;
      var counts = inspectReadinessCounts(page.inputs);

      if (counts.eligibleInputs > 0 && counts.visibleIneligibleInputs === 0) {
        return {
          ok: true,
          page: page,
          readiness: {
            capability: 'readiness_wait_inputs',
            waitedMs: waitedMs,
            earlyExit: true,
            timedOut: false,
            eligibleInputs: counts.eligibleInputs,
            visibleIneligibleInputs: counts.visibleIneligibleInputs,
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
            eligibleInputs: counts.eligibleInputs,
            visibleIneligibleInputs: counts.visibleIneligibleInputs,
          },
        };
      }

      var remaining = maxTotalWaitMs - waitedMs;
      var delay = Math.min(pollIntervalMs, remaining);
      await sleepMs(delay);
    }
  }

  /**
   * D-121-47 — same vocabulary as the Hub (`src/assistedMapping/specialActionIntent.ts`);
   * a verify pins the two lists equal. Whole words; a Hebrew word may carry one prefix letter.
   */
  var ACTION_INTENT_VOCABULARY = {
    login: ['התחברות', 'כניסה', 'התחבר', 'אזור אישי', 'login', 'log in', 'sign in', 'my account'],
    negative: [
      'slide',
      'carousel',
      'prev',
      'previous',
      'contact',
      'צור קשר',
      'chat',
      "צ'אט",
      'cart',
      'עגלה',
      'search',
      'חיפוש',
      'newsletter',
      'דיוור',
      'הרשמה',
      'register',
      'נגישות',
      'נגיש',
      'accessibility',
      'accessible',
    ],
    transition: ['next', 'continue', 'המשך', 'הבא', 'קדימה', 'proceed', 'אישור', 'שלח', 'submit'],
  };
  var HEBREW_PREFIX_LETTERS = 'והבלמשכ';
  var HEBREW_RE = /[\u0590-\u05FF]/;

  function intentTokens(text) {
    return String(text)
      .toLowerCase()
      .replace(/[\u05F3`\u2019]/g, "'")
      .replace(/[^\p{L}\p{N}']+/gu, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
  }

  function intentTokenMatches(token, word) {
    if (token === word) return true;
    return (
      HEBREW_RE.test(word) &&
      token.length === word.length + 1 &&
      HEBREW_PREFIX_LETTERS.indexOf(token[0]) >= 0 &&
      token.slice(1) === word
    );
  }

  function intentHasPhrase(tokens, phrase) {
    var words = phrase.split(' ');
    for (var i = 0; i + words.length <= tokens.length; i += 1) {
      var all = true;
      for (var j = 0; j < words.length; j += 1) {
        if (!intentTokenMatches(tokens[i + j], words[j])) {
          all = false;
          break;
        }
      }
      if (all) return true;
    }
    return false;
  }

  function intentAny(texts, phrases) {
    for (var t = 0; t < texts.length; t += 1) {
      if (typeof texts[t] !== 'string' || !texts[t]) continue;
      var tokens = intentTokens(texts[t]);
      for (var p = 0; p < phrases.length; p += 1) {
        if (intentHasPhrase(tokens, phrases[p])) return true;
      }
    }
    return false;
  }

  /** R-f order (R-a: a login word is never demoted). Lower = first. */
  function actionRankTier(texts, popupSemantics) {
    if (intentAny(texts, ACTION_INTENT_VOCABULARY.login)) return popupSemantics ? 0 : 1;
    if (intentAny(texts, ACTION_INTENT_VOCABULARY.negative)) return 4;
    return popupSemantics ? 2 : 3;
  }

  /**
   * Phase 121.1 — SPECIAL authoring action candidates (opener/transition).
   * Observation only for CURRENT-TAB SPECIAL Analyze routing.
   * NOT used by Phase 120 credential-field Analyze. No clicks.
   */
  function collectSpecialAuthoringActionCandidates(options) {
    var candidateOpts =
      options && options.stableLocators === true
        ? { action: true, stableLocators: true }
        : { action: true };
    var doc = global.document;
    var nodes = doc.querySelectorAll(
      'button, a[href], [role="button"], input[type="button"], input[type="submit"]',
    );
    var shared = global.LocatorDeterminism || {};
    var out = [];
    var MAX_ACTIONS = 40;
    var MAX_SCAN = 400;
    for (var i = 0; i < nodes.length && i < MAX_SCAN; i += 1) {
      var el = nodes[i];
      if (!isObservedForIdentification(el)) continue;
      if (typeof shared.isSkipLink === 'function' && shared.isSkipLink(el)) continue;
      var candidates = buildCandidates(el, candidateOpts);
      if (!candidates.length) continue;
      // Prefer exact-one + identity locators for authoring proposals.
      var deterministic =
        typeof shared.chooseDeterministicLocator === 'function'
          ? shared.chooseDeterministicLocator(candidates, el, doc)
          : null;
      var exact = candidates.filter(function (c) {
        return c.matchCount === 1;
      });
      var chosen = deterministic || (exact.length ? exact[0] : candidates[0]);
      if (!chosen || !chosen.locator) continue;
      // D-121-47 (G5): texts sent separately; the shown label prefers the visible text.
      var visibleText = truncate(el.textContent || '');
      var ariaLabel = truncate(el.getAttribute('aria-label') || '');
      var title = truncate(el.getAttribute('title') || '');
      var buttonCaption =
        el.tagName.toLowerCase() === 'input' ? truncate(el.getAttribute('value') || '') : undefined;
      var label = visibleText || buttonCaption || ariaLabel || title || chosen.locator;
      var popupSemantics =
        typeof shared.hasPopupSemantics === 'function' && shared.hasPopupSemantics(el);
      out.push({
        actionCandidateId: '',
        tagName: el.tagName.toLowerCase(),
        label: label,
        visibleText: visibleText || buttonCaption,
        ariaLabel: ariaLabel,
        title: title,
        locator: chosen.locator,
        locatorType: 'css',
        matchCount: typeof chosen.matchCount === 'number' ? chosen.matchCount : undefined,
        visible: true,
        popupSemantics: popupSemantics,
        rankTier: actionRankTier([visibleText || buttonCaption, ariaLabel, title], popupSemantics),
      });
    }
    // D-121-47 (R-f) before the cap: login + popup → login → popup → plain → negative; stable.
    var ranked = out
      .map(function (a, idx) { return { a: a, idx: idx }; })
      .sort(function (x, y) { return x.a.rankTier - y.a.rankTier || x.idx - y.idx; })
      .map(function (x) {
        delete x.a.rankTier;
        return x.a;
      })
      .slice(0, MAX_ACTIONS);
    ranked.forEach(function (a, idx) {
      a.actionCandidateId = 'act-' + String(idx + 1);
    });
    return ranked;
  }

  global.collectSafePageStructure = collectSafePageStructure;
  global.collectSafePageStructureWithReadiness =
    collectSafePageStructureWithReadiness;
  global.collectSpecialAuthoringActionCandidates =
    collectSpecialAuthoringActionCandidates;
  global.collectSpecialEligibleCredentialLocators = collectSpecialEligibleCredentialLocators;
  global.collectSpecialEligibleCredentialInputs = collectSpecialEligibleCredentialInputs;
  global.isSpecialDeclaredReadinessMet = isSpecialDeclaredReadinessMet;
  /** Verify-only helpers (synthetic fixtures). */
  global.__pageStructureInspectHelpers = {
    DEFAULT_READINESS_MAX_WAIT_MS: DEFAULT_READINESS_MAX_WAIT_MS,
    DEFAULT_READINESS_POLL_MS: DEFAULT_READINESS_POLL_MS,
    originMatchesExpected: originMatchesExpected,
    countShadowCredentialCandidates: countShadowCredentialCandidates,
    frameContext: frameContext,
    buildCandidates: buildCandidates,
    ACTION_INTENT_VOCABULARY: ACTION_INTENT_VOCABULARY,
    actionRankTier: actionRankTier,
  };
})(typeof window !== 'undefined' ? window : globalThis);
