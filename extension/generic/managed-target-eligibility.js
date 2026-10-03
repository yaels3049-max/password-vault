'use strict';

/**
 * Phase 120.4 / 120.6 — authoritative Managed Autofill target-safety eligibility.
 * Single shared contract for fill-executor, form-detector, page inspect, visual pick.
 *
 * V3: aria-hidden SELF on the target remains absolute reject.
 * V4: ancestor aria-hidden is NOT an absolute reject (120.6 classification B).
 * V8: multi-point elementFromPoint hit-test replaces the lost V4 protection.
 * opacity:0 alone and readOnly alone do NOT fail this contract.
 */
(function (root) {
  function isAssociatedLabel(hit, target) {
    if (!hit || !target || String(hit.tagName || '').toUpperCase() !== 'LABEL') {
      return false;
    }
    if (typeof hit.contains === 'function' && hit.contains(target)) {
      return true;
    }
    var id = target.id;
    if (!id) {
      return false;
    }
    if (hit.htmlFor === id) {
      return true;
    }
    // Some DOM implementations expose the association only via the for attribute.
    if (typeof hit.getAttribute === 'function' && hit.getAttribute('for') === id) {
      return true;
    }
    return false;
  }

  var LABELABLE_SELECTOR = 'button, input:not([type="hidden"]), meter, output, progress, select, textarea';

  /**
   * D-121-49 — the label's labeled control: native HTMLLabelElement.control; DOMs
   * without it resolve per the HTML rule (for= id, else first labelable descendant).
   */
  function labelControlOf(label) {
    if (!label || String(label.tagName || '').toUpperCase() !== 'LABEL') {
      return null;
    }
    if (typeof label.control !== 'undefined') {
      return label.control || null;
    }
    var forId = typeof label.getAttribute === 'function' ? label.getAttribute('for') : null;
    if (forId !== null) {
      var doc = label.ownerDocument;
      var byId = doc && typeof doc.getElementById === 'function' ? doc.getElementById(forId) : null;
      return byId && typeof byId.matches === 'function' && byId.matches(LABELABLE_SELECTOR) ? byId : null;
    }
    return typeof label.querySelector === 'function' ? label.querySelector(LABELABLE_SELECTOR) : null;
  }

  /** D-121-49 — hit inside the target's own associated label (for= or nested). */
  function isInsideOwnLabel(hit, target) {
    if (!hit || typeof hit.closest !== 'function') {
      return false;
    }
    var label = hit.closest('label');
    return Boolean(label) && labelControlOf(label) === target;
  }

  /** Normative PASS: target | descendant of target | associated label | inside the target's own label. */
  function hitRelationshipOk(hit, target) {
    if (!hit) {
      return false;
    }
    if (hit === target) {
      return true;
    }
    if (typeof target.contains === 'function' && target.contains(hit)) {
      return true;
    }
    if (isAssociatedLabel(hit, target)) {
      return true;
    }
    if (isInsideOwnLabel(hit, target)) {
      return true;
    }
    return false;
  }

  function viewportSize() {
    var doc = root.document;
    var el = doc && doc.documentElement;
    var iw =
      typeof root.innerWidth === 'number' && root.innerWidth > 0
        ? root.innerWidth
        : el && el.clientWidth
          ? el.clientWidth
          : 0;
    var ih =
      typeof root.innerHeight === 'number' && root.innerHeight > 0
        ? root.innerHeight
        : el && el.clientHeight
          ? el.clientHeight
          : 0;
    return { width: iw, height: ih };
  }

  function pointInViewport(x, y) {
    var vp = viewportSize();
    if (!(vp.width > 0 && vp.height > 0)) {
      return false;
    }
    return x >= 0 && y >= 0 && x < vp.width && y < vp.height;
  }

  /** Center + four 25% inset points (5 total). */
  function samplePoints(rect) {
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var ix = rect.width * 0.25;
    var iy = rect.height * 0.25;
    return [
      { x: cx, y: cy },
      { x: rect.left + ix, y: cy },
      { x: rect.right - ix, y: cy },
      { x: cx, y: rect.top + iy },
      { x: cx, y: rect.bottom - iy },
    ];
  }

  /**
   * V8 hit-test classifier. Returns { ok:true } or { ok:false, reason }.
   * reason ∈ occluded | not_interactable
   */
  function classifyHitTest(element) {
    var doc = element.ownerDocument || root.document;
    if (!doc || typeof doc.elementFromPoint !== 'function') {
      return { ok: false, reason: 'not_interactable' };
    }

    var style = root.getComputedStyle(element);
    if (style && style.pointerEvents === 'none') {
      return { ok: false, reason: 'not_interactable' };
    }

    function evaluate() {
      var rect = element.getBoundingClientRect();
      var points = samplePoints(rect);
      var inView = [];
      for (var i = 0; i < points.length; i += 1) {
        if (pointInViewport(points[i].x, points[i].y)) {
          inView.push(points[i]);
        }
      }
      if (inView.length < 3) {
        return { ok: false, reason: 'not_interactable' };
      }

      // D-121-71: the center must be in view and hit the target, and at least 3 in-view
      // points must hit it (an overlay over an edge of the field does not block it).
      var center = points[0];
      if (!pointInViewport(center.x, center.y)) {
        return { ok: false, reason: 'not_interactable' };
      }
      var centerHit = doc.elementFromPoint(center.x, center.y);
      if (!hitRelationshipOk(centerHit, element)) {
        return {
          ok: false,
          reason: centerHit == null ? 'not_interactable' : 'occluded',
        };
      }

      var passed = 0;
      var missed = false;
      var missHit = null;
      for (var j = 0; j < inView.length; j += 1) {
        var hit = doc.elementFromPoint(inView[j].x, inView[j].y);
        if (hitRelationshipOk(hit, element)) {
          passed += 1;
        } else if (!missed) {
          missed = true;
          missHit = hit;
        }
      }
      if (passed >= 3) {
        return { ok: true };
      }
      return {
        ok: false,
        reason: missHit == null ? 'not_interactable' : 'occluded',
      };
    }

    var first = evaluate();
    if (first.ok) {
      return first;
    }

    // One bounded scrollIntoView, then re-sample once.
    if (typeof element.scrollIntoView === 'function') {
      try {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } catch (_scrollOptionsError) {
        try {
          element.scrollIntoView(true);
        } catch (_scrollBoolError) {
          // ignore
        }
      }
    }

    return evaluate();
  }

  function passesHitTest(element) {
    return classifyHitTest(element).ok === true;
  }

  /**
   * Managed visibility / interactivity (V1–V3, V5–V8).
   * Absolute ancestor aria-hidden (old V4) removed — V8 covers occlusion.
   */
  function isVisible(element) {
    if (!element || element.disabled) {
      return false;
    }
    if (element.type === 'hidden') {
      return false;
    }
    // V3 — aria-hidden SELF absolute reject (do NOT use closest ancestor).
    if (element.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    var style = root.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    // Do not reject opacity:0 alone — SPA themes animate opacity during paint.
    if (element.getClientRects().length === 0) {
      return false;
    }
    var rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      return false;
    }
    // V8 — generic occlusion / interactivity hit-test.
    if (!passesHitTest(element)) {
      return false;
    }
    return true;
  }

  /**
   * Managed safe fill target (S1–S5). readOnly alone does NOT fail.
   */
  function isSafeFillTarget(element) {
    if (!element || element.tagName !== 'INPUT') {
      return false;
    }
    if (element.type === 'hidden' || element.disabled) {
      return false;
    }
    return isVisible(element);
  }

  /**
   * Optional sub-detail when isSafeFillTarget is false (no secrets).
   * Order: not_input → hidden → disabled → aria_hidden_self → CSS/layout → V8.
   * Ancestor aria-hidden is NOT a reject-causing code.
   */
  function classifyManagedIneligibility(element) {
    if (!element) {
      return 'missing';
    }
    if (element.tagName !== 'INPUT') {
      return 'not_input';
    }
    if (element.type === 'hidden') {
      return 'hidden_target';
    }
    if (element.disabled) {
      return 'non_editable';
    }
    if (element.getAttribute('aria-hidden') === 'true') {
      return 'aria_hidden_self';
    }
    var style = root.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return 'display_or_visibility';
    }
    if (element.getClientRects().length === 0) {
      return 'zero_rects';
    }
    var rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      return 'too_small';
    }
    var hit = classifyHitTest(element);
    if (!hit.ok) {
      return hit.reason || 'not_interactable';
    }
    return 'unsafe_target';
  }

  root.ManagedTargetEligibility = {
    isVisible: isVisible,
    isSafeFillTarget: isSafeFillTarget,
    classifyManagedIneligibility: classifyManagedIneligibility,
    // Test/diagnostics hooks (same algorithm; no alternate policy).
    passesHitTest: passesHitTest,
    classifyHitTest: classifyHitTest,
    labelControlOf: labelControlOf,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
