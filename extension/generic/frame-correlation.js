/**
 * Phase 121.1-IF (§4.10) / D-121-29 (§4.10.1) — deterministic iframe element ↔ frameId
 * correlation via a postMessage nonce handshake. ISOLATED world only; no extra
 * permission, no webNavigation, no URL / size / order matching.
 *
 * Injected into every frame (idempotent):
 *  - depth-1 frames: a listener that holds `{ type, nonce }` only when
 *    event.source === window.parent AND window.parent === window.top.
 *  - top frame: senders that post a fresh random nonce into each light-DOM
 *    `<iframe>` (enumerate) or the exact-one `<iframe>` of a stored locator (resolve).
 * The extension reads the held nonces back per frameId and maps element ↔ frameId.
 * Messages carry only the nonce — no URLs, locators, values or secrets.
 */
(function initFrameCorrelation(global) {
  var NONCE_MESSAGE_TYPE = 'pv-frame-correlation-nonce';
  var NONCE_PATTERN = /^[0-9a-f]{32}$/;
  var MAX_HELD_NONCES = 32;
  var HELD_NONCE_TTL_MS = 30000;

  function cssEscapeIdent(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  function quoteAttr(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function isDepth1Window() {
    try {
      return global !== global.top && global.parent === global.top;
    } catch (_err) {
      return false;
    }
  }

  function heldNonces() {
    if (!Array.isArray(global.__pvFrameCorrelationHeld)) global.__pvFrameCorrelationHeld = [];
    return global.__pvFrameCorrelationHeld;
  }

  function onNonceMessage(event) {
    if (!event || event.source !== global.parent || !isDepth1Window()) return;
    var data = event.data;
    if (!data || typeof data !== 'object' || data.type !== NONCE_MESSAGE_TYPE) return;
    if (typeof data.nonce !== 'string' || !NONCE_PATTERN.test(data.nonce)) return;
    var held = heldNonces();
    held.push({ nonce: data.nonce, at: Date.now() });
    if (held.length > MAX_HELD_NONCES) held.splice(0, held.length - MAX_HELD_NONCES);
  }

  if (!global.__pvFrameCorrelationListener && typeof global.addEventListener === 'function') {
    global.__pvFrameCorrelationListener = true;
    global.addEventListener('message', onNonceMessage, false);
  }

  /** Read back (and discard) the nonces of THIS attempt held by this frame. */
  function readFrameCorrelationNonces(expected) {
    var wanted = Array.isArray(expected) ? expected : [];
    var now = Date.now();
    var held = heldNonces();
    var out = [];
    var keep = [];
    for (var i = 0; i < held.length; i += 1) {
      var h = held[i];
      if (wanted.indexOf(h.nonce) >= 0) {
        if (out.indexOf(h.nonce) < 0) out.push(h.nonce);
      } else if (now - h.at < HELD_NONCE_TTL_MS) {
        keep.push(h);
      }
    }
    global.__pvFrameCorrelationHeld = keep;
    return out;
  }

  function freshNonce() {
    var c = global.crypto;
    if (!c || typeof c.getRandomValues !== 'function') return null;
    var bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    var hex = '';
    for (var i = 0; i < bytes.length; i += 1) {
      hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return hex;
  }

  function postNonce(el, nonce) {
    try {
      var win = el.contentWindow;
      if (win && typeof win.postMessage === 'function') {
        win.postMessage({ type: NONCE_MESSAGE_TYPE, nonce: nonce }, '*');
      }
    } catch (_err) {
      /* never received → element stays unmapped */
    }
  }

  /**
   * D-121-61 — `iframe[src^="<origin><path>"]` (query / hash dropped) for an HTTPS src
   * attribute written as an absolute URL; null otherwise. Kept only if exact-one (caller).
   */
  function srcPrefixLocator(el) {
    var raw = el.getAttribute('src');
    if (typeof raw !== 'string' || !/^https:\/\//i.test(raw.trim())) return null;
    var url;
    try {
      url = new URL(raw.trim());
    } catch (_err) {
      return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    var prefix = url.origin + url.pathname;
    if (raw.trim().indexOf(prefix) !== 0 || prefix.length > 300 || /[\u0000-\u001f|]/.test(prefix)) return null;
    return 'iframe[src^="' + quoteAttr(prefix) + '"]';
  }

  /**
   * Stable-attribute candidates (same spirit as field locators; never nth-child).
   * D-121-61: then the src prefix, then the D-121-48 anchored structural locator
   * (nearest stable ancestor + iframe; :nth-of-type only inside that ancestor).
   */
  function frameLocatorCandidates(el, doc) {
    var out = [];
    function push(locator, hint) {
      if (!locator) return;
      for (var i = 0; i < out.length; i += 1) {
        if (out[i].locator === locator) return;
      }
      out.push({ locator: locator, stabilityHint: hint });
    }
    if (el.id) push('iframe#' + cssEscapeIdent(el.id), 'id');
    var name = el.getAttribute('name');
    if (name) push('iframe[name="' + quoteAttr(name) + '"]', 'name');
    var title = el.getAttribute('title');
    if (title) push('iframe[title="' + quoteAttr(title.slice(0, 120)) + '"]', 'title');
    var aria = el.getAttribute('aria-label');
    if (aria) push('iframe[aria-label="' + quoteAttr(aria.slice(0, 80)) + '"]', 'aria');
    push(srcPrefixLocator(el), 'src');
    var shared = global.LocatorDeterminism;
    if (doc && shared && typeof shared.anchoredStructuralCandidates === 'function') {
      var anchored = shared.anchoredStructuralCandidates(el, doc);
      if (anchored.length && anchored[0].locator.indexOf('|') < 0) push(anchored[0].locator, 'anchored');
    }
    return out;
  }

  function exactOneFrameLocator(el, doc) {
    var shared = global.LocatorDeterminism;
    var candidates = frameLocatorCandidates(el, doc);
    for (var i = 0; i < candidates.length; i += 1) {
      var loc = candidates[i].locator;
      var ok =
        shared && typeof shared.assertLocatorDeterministic === 'function'
          ? shared.assertLocatorDeterministic(loc, el, doc)
          : (function () {
              try {
                var m = doc.querySelectorAll(loc);
                return m.length === 1 && m[0] === el;
              } catch (_err) {
                return false;
              }
            })();
      if (ok) return loc;
    }
    return null;
  }

  function isVisibleFrame(el) {
    try {
      var style = global.getComputedStyle(el);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (_err) {
      return false;
    }
  }

  /**
   * Enumerate top-document (light DOM) iframes → { frameId: null, nonce, frameLocator|null,
   * visible, rectArea }. The extension fills frameId from the nonce read-back.
   */
  function collectFrameCorrelation() {
    if (global.top !== global) {
      return { ok: false, reason: 'not_top_frame' };
    }
    var doc = global.document;
    var nodes = doc.querySelectorAll('iframe');
    var frames = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      var nonce = freshNonce();
      if (!nonce) return { ok: false, reason: 'frame_correlation_unavailable' };
      var rect = null;
      try {
        rect = el.getBoundingClientRect();
      } catch (_err) {
        rect = null;
      }
      frames.push({
        frameId: null,
        nonce: nonce,
        frameLocator: exactOneFrameLocator(el, doc),
        visible: isVisibleFrame(el),
        rectArea: rect ? Math.round(rect.width * rect.height) : 0,
      });
      postNonce(el, nonce);
    }
    return { ok: true, frames: frames };
  }

  /** Runtime lookup: exact-one `<iframe>` for a stored frameLocator → nonce posted into it. */
  function resolveFrameByLocator(frameLocator) {
    if (global.top !== global) return { ok: false, reason: 'not_top_frame' };
    var matches;
    try {
      matches = global.document.querySelectorAll(frameLocator);
    } catch (_err) {
      return { ok: false, reason: 'frame_missing' };
    }
    if (!matches || matches.length === 0) return { ok: false, reason: 'frame_missing' };
    if (matches.length > 1) return { ok: false, reason: 'frame_ambiguous' };
    var el = matches[0];
    if (!el || String(el.tagName).toLowerCase() !== 'iframe') {
      return { ok: false, reason: 'frame_missing' };
    }
    var nonce = freshNonce();
    if (!nonce) return { ok: false, reason: 'frame_correlation_unavailable' };
    postNonce(el, nonce);
    return { ok: true, frameId: null, nonce: nonce };
  }

  global.__collectFrameCorrelation = collectFrameCorrelation;
  global.__resolveFrameByLocator = resolveFrameByLocator;
  global.__readFrameCorrelationNonces = readFrameCorrelationNonces;
  global.__frameCorrelationHelpers = {
    frameLocatorCandidates: frameLocatorCandidates,
    exactOneFrameLocator: exactOneFrameLocator,
    nonceMessageType: NONCE_MESSAGE_TYPE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
