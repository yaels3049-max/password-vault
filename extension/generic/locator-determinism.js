/**
 * Phase 120.9 — shared locator determinism (exact-one + same target element).
 * Same semantics for Visual choose and Analyze inspect evidence.
 * Loaded into page MAIN world for Admin authoring only.
 */
(function initLocatorDeterminism(global) {
  /**
   * PASS iff locator resolves to exactly one node and that node is observedEl.
   * @param {string} locator
   * @param {Element} observedEl
   * @param {Document} doc
   * @returns {boolean}
   */
  function assertLocatorDeterministic(locator, observedEl, doc) {
    if (!locator || !observedEl || !doc || typeof doc.querySelectorAll !== 'function') {
      return false;
    }
    var matches;
    try {
      matches = doc.querySelectorAll(locator);
    } catch (err) {
      return false;
    }
    return Boolean(matches && matches.length === 1 && matches[0] === observedEl);
  }

  /**
   * Count matches for a CSS locator in doc (0 on invalid selector).
   * @param {string} locator
   * @param {Document} doc
   * @returns {number}
   */
  function countLocatorMatches(locator, doc) {
    if (!locator || !doc || typeof doc.querySelectorAll !== 'function') {
      return 0;
    }
    try {
      return doc.querySelectorAll(locator).length;
    } catch (err) {
      return 0;
    }
  }

  /**
   * First candidate with querySelectorAll.length === 1 (exact-one choose).
   * Callers that require same-target must also run assertLocatorDeterministic.
   * @param {Array<{locator: string, stabilityHint?: string}>} candidates
   * @param {Document} doc
   * @returns {{locator: string, locatorType: string, stabilityHint: *, locatorCandidates: *} | null}
   */
  function preferExactOneLocator(candidates, doc) {
    if (!Array.isArray(candidates) || !doc) {
      return null;
    }
    for (var i = 0; i < candidates.length; i += 1) {
      var locator = candidates[i].locator;
      if (!locator) continue;
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

  // ─── Phase 121.1 D-121-35 — SPECIAL opener / transition identification ─────
  // Text-free, non-positional vocabulary for ACTION elements only. Field
  // locators never use it (callers append it after id / name / autocomplete /
  // aria-label, and only for action targets).

  var ACTIONABLE_SELECTOR =
    'button, a, [role="button"], input[type="button"], input[type="submit"]';
  var TEST_ATTRS = ['data-testid', 'data-test', 'data-qa', 'data-cy'];
  var POPUP_ATTRS = [
    'aria-haspopup',
    'aria-controls',
    'aria-expanded',
    'data-toggle',
    'data-bs-toggle',
    'data-target',
    'data-bs-target',
  ];
  var STATE_CLASS_RE =
    /^(active|show|shown|open|opened|hover|focus|focused|disabled|selected|visible|hidden|collapsed|in|fade|current)$|^(is|has)-/i;
  var CSS_IN_JS_PREFIX_RE = /^(css|sc|jsx|emotion|styled|svelte|astro|tw)-/i;

  function attrValueUsable(value) {
    return (
      typeof value === 'string' &&
      value.trim() !== '' &&
      value.length <= 200 &&
      !/[\u0000-\u001f]/.test(value)
    );
  }

  function quoteAttr(value) {
    return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function cssIdent(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  /** Reject hashed / numeric-looking / state classes (not stable across renders). */
  function isStableClassName(name) {
    if (typeof name !== 'string') return false;
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) return false;
    if (name.length < 2 || name.length > 40) return false;
    if (/\d{3,}/.test(name)) return false;
    if (CSS_IN_JS_PREFIX_RE.test(name)) return false;
    if (STATE_CLASS_RE.test(name)) return false;
    var segments = name.split(/[-_]+/);
    for (var i = 0; i < segments.length; i += 1) {
      var s = segments[i];
      if (s.length >= 5 && /\d/.test(s) && /[A-Za-z]/.test(s)) return false;
    }
    return true;
  }

  /** href usable as a locator: a real path — not empty, not a fragment, not javascript:. */
  function isRealPathHref(href) {
    if (!attrValueUsable(href)) return false;
    var h = href.trim();
    if (h.charAt(0) === '#') return false;
    if (/^javascript:/i.test(h)) return false;
    return true;
  }

  /**
   * Action-only locator vocabulary, in binding order (D-121-35 §1):
   * test attributes; aria-controls; data-target combined with data-toggle;
   * real-path href; tag.class; role combined with each of the above.
   * @param {Element} el
   * @returns {Array<{locator: string, hint: string}>}
   */
  function actionLocatorCandidates(el) {
    var out = [];
    if (!el || el.nodeType !== 1 || typeof el.getAttribute !== 'function') return out;
    var tag = el.tagName.toLowerCase();
    var base = [];
    function add(locator, hint) {
      if (!locator) return;
      for (var i = 0; i < base.length; i += 1) {
        if (base[i].locator === locator) return;
      }
      base.push({ locator: locator, hint: hint });
    }
    TEST_ATTRS.forEach(function (attr) {
      var v = el.getAttribute(attr);
      if (attrValueUsable(v)) add(tag + '[' + attr + '=' + quoteAttr(v) + ']', 'test_attr');
    });
    var controls = el.getAttribute('aria-controls');
    if (attrValueUsable(controls)) {
      add(tag + '[aria-controls=' + quoteAttr(controls) + ']', 'aria_controls');
    }
    var targetAttr = attrValueUsable(el.getAttribute('data-bs-target'))
      ? 'data-bs-target'
      : attrValueUsable(el.getAttribute('data-target'))
        ? 'data-target'
        : '';
    if (targetAttr) {
      var toggleAttr = attrValueUsable(el.getAttribute('data-bs-toggle'))
        ? 'data-bs-toggle'
        : attrValueUsable(el.getAttribute('data-toggle'))
          ? 'data-toggle'
          : '';
      add(
        tag +
          (toggleAttr ? '[' + toggleAttr + '=' + quoteAttr(el.getAttribute(toggleAttr)) + ']' : '') +
          '[' + targetAttr + '=' + quoteAttr(el.getAttribute(targetAttr)) + ']',
        'data_target',
      );
    }
    var href = el.getAttribute('href');
    if (isRealPathHref(href)) add(tag + '[href=' + quoteAttr(href) + ']', 'href');
    var stable = [];
    var classAttr = el.getAttribute('class');
    var classList = typeof classAttr === 'string' ? classAttr.split(/\s+/).filter(Boolean) : [];
    for (var c = 0; c < classList.length && stable.length < 3; c += 1) {
      if (isStableClassName(classList[c])) stable.push(classList[c]);
    }
    stable.forEach(function (name) {
      add(tag + '.' + cssIdent(name), 'class');
    });
    if (stable.length > 1) {
      add(tag + stable.map(function (n) { return '.' + cssIdent(n); }).join(''), 'class');
    }
    base.forEach(function (b) {
      out.push(b);
    });
    var role = el.getAttribute('role');
    if (attrValueUsable(role)) {
      base.forEach(function (b) {
        out.push({ locator: b.locator + '[role=' + quoteAttr(role) + ']', hint: 'role+' + b.hint });
      });
    }
    return out;
  }

  function hasPopupSemantics(el) {
    if (!el || typeof el.hasAttribute !== 'function') return false;
    for (var i = 0; i < POPUP_ATTRS.length; i += 1) {
      if (el.hasAttribute(POPUP_ATTRS[i])) return true;
    }
    return false;
  }

  var DIALOG_SELECTOR =
    'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]';

  /**
   * D-121-41 — rendered in-page content: not [hidden] / aria-hidden="true"
   * (self or ancestor), not display:none / visibility:hidden, non-zero box,
   * and not a dialog (self or ancestor).
   */
  function isVisibleInPageContent(target) {
    if (!target || target.nodeType !== 1) return false;
    if (typeof target.closest === 'function') {
      try {
        if (target.closest('[hidden], [aria-hidden="true"]')) return false;
        if (target.closest(DIALOG_SELECTOR)) return false;
      } catch (_err) {
        return false;
      }
    }
    var style = typeof global.getComputedStyle === 'function' ? global.getComputedStyle(target) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    if (typeof target.getBoundingClientRect === 'function') {
      var rect = target.getBoundingClientRect();
      if (!rect || !(rect.width > 0 && rect.height > 0)) return false;
    }
    return true;
  }

  /**
   * In-page skip link (Analyze only, D-121-41): anchor whose href is "#<id>"
   * resolving to an existing element that is visible in-page content, with no
   * popup semantics. href="#" alone is not a skip link. A hidden or dialog
   * target (modal container) makes the anchor an opener candidate.
   */
  function isSkipLink(el) {
    if (!el || el.nodeType !== 1 || el.tagName.toLowerCase() !== 'a') return false;
    var href = el.getAttribute('href');
    if (typeof href !== 'string') return false;
    var h = href.trim();
    if (h.length < 2 || h.charAt(0) !== '#') return false;
    if (hasPopupSemantics(el)) return false;
    var id = h.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch (_err) {
      /* keep raw */
    }
    var doc = el.ownerDocument;
    var target = doc && typeof doc.getElementById === 'function' ? doc.getElementById(id) : null;
    return Boolean(target) && isVisibleInPageContent(target);
  }

  /** Nearest actionable element for a click target (self or ancestor). */
  function resolveActionableTarget(target) {
    var el = target && target.nodeType === 3 ? target.parentElement : target;
    if (!el || el.nodeType !== 1 || typeof el.closest !== 'function') return null;
    try {
      return el.closest(ACTIONABLE_SELECTOR);
    } catch (_err) {
      return null;
    }
  }

  /** First candidate that is exact-one AND resolves to el (identity). */
  function chooseDeterministicLocator(candidates, el, doc) {
    if (!Array.isArray(candidates)) return null;
    for (var i = 0; i < candidates.length; i += 1) {
      var c = candidates[i];
      if (c && assertLocatorDeterministic(c.locator, el, doc)) return c;
    }
    return null;
  }

  // ─── Phase 121 D-121-48 / D-121-68 — never anchor on generated ids / names ──
  // The volatile-token filter and the anchored fallback apply in every authoring
  // candidate builder (all patterns). The other helpers here (shared aria-label,
  // form / test attrs, placeholder) are used only with { stableLocators: true }.

  var FRAMEWORK_ID_RES = [
    /^(mat|cdk)-[a-z][a-z0-9-]*-\d+$/i,
    /^react-select-\d+-/i,
    /^:r[0-9a-z]*:$/i,
    /^\u00abr[0-9a-z]*\u00bb$/i,
    /^ember\d+$/i,
    /^ext-gen\d+$/i,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  ];
  var SHARED_ARIA_LABEL_MIN = 3;
  var MAX_ANCHOR_DEPTH = 12;
  var MAX_PATH_DEPTH = 8;
  var ID_REFERENCE_ATTRS = /^(id|for|aria-controls|aria-labelledby|aria-describedby|aria-owns|data-target|data-bs-target|href)$/i;
  /** Per-load numbers (timestamps, random suffixes); ≤ 7 digits stays stable (step2, field_2024). */
  var VOLATILE_DIGIT_RUN = 8;

  function hasLongDigitRun(value) {
    var runs = String(value).match(/\d+/g);
    if (!runs) return false;
    for (var i = 0; i < runs.length; i += 1) {
      if (runs[i].length >= VOLATILE_DIGIT_RUN) return true;
    }
    return false;
  }

  /** D-121-68: a name attribute carrying a per-load number is never a locator. */
  function isUnstableName(name) {
    return typeof name === 'string' && hasLongDigitRun(name);
  }

  function hasLongHexRun(id) {
    if (/^[0-9a-f]{12,}$/i.test(id) && /\d/.test(id)) return true;
    var runs = id.split(/[^0-9a-fA-F]+/);
    for (var i = 0; i < runs.length; i += 1) {
      if (runs[i].length >= 16 && /\d/.test(runs[i]) && /[a-f]/i.test(runs[i])) return true;
    }
    return false;
  }

  /** Another id in doc differs from this one only by its trailing number. */
  function hasCounterSiblings(id, doc) {
    var m = /^(.*\D)(\d+)$/.exec(id);
    if (!m || !doc || typeof doc.querySelectorAll !== 'function') return false;
    var stem = m[1];
    var nodes;
    try {
      nodes = doc.querySelectorAll('[id^=' + quoteAttr(stem) + ']');
    } catch (_err) {
      return false;
    }
    for (var i = 0; i < nodes.length; i += 1) {
      var other = nodes[i].getAttribute('id') || '';
      if (other !== id && other.length > stem.length && /^\d+$/.test(other.slice(stem.length))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Framework counter / hash id (mat-input-N, cdk-*-N, react-select-N-*, :r…:,
   * ember N, ext-gen N, UUID / long hex, a run of ≥ 8 digits, or a trailing
   * counter shared with same-shape ids in the document). Never a locator; still
   * identity evidence.
   */
  function isUnstableId(id, doc) {
    if (typeof id !== 'string' || !id.trim()) return false;
    for (var i = 0; i < FRAMEWORK_ID_RES.length; i += 1) {
      if (FRAMEWORK_ID_RES[i].test(id)) return true;
    }
    return hasLongHexRun(id) || hasLongDigitRun(id) || hasCounterSiblings(id, doc);
  }

  function unescapeCss(value) {
    return String(value)
      .replace(/\\([0-9a-fA-F]{1,6})\s?/g, function (_m, hex) {
        return String.fromCodePoint(parseInt(hex, 16));
      })
      .replace(/\\(.)/g, '$1');
  }

  /**
   * True when the locator names an unstable id (#id, [for=…], [aria-controls=…], …)
   * or an unstable name ([name=…] with a per-load number).
   */
  function locatorReferencesUnstableId(locator, doc) {
    if (typeof locator !== 'string' || !locator) return false;
    var idRe = /#((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[A-Za-z0-9_\-\u00A0-\uFFFF])+)/g;
    var stripped = locator.replace(/\[[^\]]*\]/g, '');
    var m;
    while ((m = idRe.exec(stripped)) !== null) {
      if (isUnstableId(unescapeCss(m[1]), doc)) return true;
    }
    var attrRe = /\[\s*([A-Za-z-]+)\s*[~|^$*]?=\s*"((?:\\.|[^"\\])*)"\s*\]/g;
    while ((m = attrRe.exec(locator)) !== null) {
      if (/^name$/i.test(m[1]) && isUnstableName(unescapeCss(m[2]))) return true;
      if (!ID_REFERENCE_ATTRS.test(m[1])) continue;
      var parts = unescapeCss(m[2]).replace(/^#/, '').split(/\s+/);
      for (var i = 0; i < parts.length; i += 1) {
        if (isUnstableId(parts[i], doc)) return true;
      }
    }
    return false;
  }

  /** Generic message shared by many elements (e.g. an accessibility-plugin aria-label). */
  function isSharedAriaLabel(value, doc) {
    if (!attrValueUsable(value) || !doc || typeof doc.querySelectorAll !== 'function') return false;
    try {
      return doc.querySelectorAll('[aria-label=' + quoteAttr(value) + ']').length >= SHARED_ARIA_LABEL_MIN;
    } catch (_err) {
      return false;
    }
  }

  /** formcontrolname / stable data-test attributes (SPECIAL fallback, after autocomplete). */
  function formAttributeCandidates(el) {
    var out = [];
    if (!el || typeof el.getAttribute !== 'function') return out;
    var tag = el.tagName.toLowerCase();
    ['formcontrolname'].concat(TEST_ATTRS).forEach(function (attr) {
      var v = el.getAttribute(attr);
      if (attrValueUsable(v)) out.push({ locator: tag + '[' + attr + '=' + quoteAttr(v) + ']', hint: attr === 'formcontrolname' ? 'formcontrolname' : 'test_attr' });
    });
    return out;
  }

  function placeholderCandidate(el) {
    if (!el || typeof el.getAttribute !== 'function') return null;
    var v = el.getAttribute('placeholder');
    if (!attrValueUsable(v)) return null;
    return { locator: el.tagName.toLowerCase() + '[placeholder=' + quoteAttr(v) + ']', hint: 'placeholder' };
  }

  /** Selectors that name ancestor a without generated ids, nearest-first strategies. */
  function anchorSelectorsFor(a, doc) {
    var out = [];
    var tag = a.tagName.toLowerCase();
    var id = a.getAttribute('id');
    if (attrValueUsable(id) && !isUnstableId(id, doc)) out.push('#' + cssIdent(id));
    if (tag.indexOf('-') > 0) out.push(tag);
    var role = a.getAttribute('role');
    if (role === 'dialog' || role === 'alertdialog') out.push(tag + '[role=' + quoteAttr(role) + ']');
    var classAttr = a.getAttribute('class');
    var classList = typeof classAttr === 'string' ? classAttr.split(/\s+/).filter(Boolean) : [];
    var stable = 0;
    for (var c = 0; c < classList.length && stable < 2; c += 1) {
      if (isStableClassName(classList[c])) {
        out.push(tag + '.' + cssIdent(classList[c]));
        stable += 1;
      }
    }
    return out;
  }

  function leafSelector(el) {
    var tag = el.tagName.toLowerCase();
    var type = el.getAttribute('type');
    return tag + (attrValueUsable(type) ? '[type=' + quoteAttr(type.toLowerCase()) + ']' : '');
  }

  /** Child path from ancestor a down to el; :nth-of-type only where same-tag siblings exist. */
  function childPath(a, el) {
    var steps = [];
    var n = el;
    while (n && n !== a) {
      if (steps.length >= MAX_PATH_DEPTH) return null;
      var parent = n.parentElement;
      if (!parent) return null;
      var tag = n.tagName.toLowerCase();
      var step = n === el ? leafSelector(el) : tag;
      var same = 0;
      var index = 0;
      for (var s = parent.firstElementChild; s; s = s.nextElementSibling) {
        if (s.tagName === n.tagName) {
          same += 1;
          if (s === n) index = same;
        }
      }
      if (same > 1) step += ':nth-of-type(' + index + ')';
      steps.unshift(step);
      n = parent;
    }
    return n === a ? steps : null;
  }

  /**
   * Anchored structural locator (last fallback, all patterns): nearest stable ancestor
   * (stable id, custom-element tag, role="dialog", stable class) + tag[type];
   * a child path with :nth-of-type is used only when the plain form is not exact-one.
   */
  function anchoredStructuralCandidates(el, doc) {
    if (!el || el.nodeType !== 1 || !doc) return [];
    var leaf = leafSelector(el);
    var depth = 0;
    for (var a = el.parentElement; a && a.nodeType === 1 && depth < MAX_ANCHOR_DEPTH; a = a.parentElement) {
      depth += 1;
      if (a === doc.body || a === doc.documentElement) break;
      var anchors = anchorSelectorsFor(a, doc);
      for (var i = 0; i < anchors.length; i += 1) {
        var plain = anchors[i] + ' ' + leaf;
        if (assertLocatorDeterministic(plain, el, doc)) return [{ locator: plain, hint: 'anchored' }];
        var path = childPath(a, el);
        if (path) {
          var pathed = anchors[i] + ' > ' + path.join(' > ');
          if (assertLocatorDeterministic(pathed, el, doc)) return [{ locator: pathed, hint: 'anchored' }];
        }
      }
    }
    return [];
  }

  global.LocatorDeterminism = {
    assertLocatorDeterministic: assertLocatorDeterministic,
    countLocatorMatches: countLocatorMatches,
    preferExactOneLocator: preferExactOneLocator,
    ACTIONABLE_SELECTOR: ACTIONABLE_SELECTOR,
    actionLocatorCandidates: actionLocatorCandidates,
    isStableClassName: isStableClassName,
    isRealPathHref: isRealPathHref,
    hasPopupSemantics: hasPopupSemantics,
    isSkipLink: isSkipLink,
    isVisibleInPageContent: isVisibleInPageContent,
    resolveActionableTarget: resolveActionableTarget,
    chooseDeterministicLocator: chooseDeterministicLocator,
    isUnstableId: isUnstableId,
    isUnstableName: isUnstableName,
    locatorReferencesUnstableId: locatorReferencesUnstableId,
    isSharedAriaLabel: isSharedAriaLabel,
    formAttributeCandidates: formAttributeCandidates,
    placeholderCandidate: placeholderCandidate,
    anchoredStructuralCandidates: anchoredStructuralCandidates,
  };
})(typeof window !== 'undefined' ? window : globalThis);
