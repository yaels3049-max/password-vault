'use strict';

(function (root) {
  function isVisible(element) {
    if (!element || element.disabled) {
      return false;
    }
    if (element.type === 'hidden') {
      return false;
    }
    if (element.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    if (element.closest && element.closest('[aria-hidden="true"]')) {
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
    return true;
  }

  function isFillableInput(element) {
    if (!element || element.tagName !== 'INPUT') {
      return false;
    }
    var type = (element.type || 'text').toLowerCase();
    if (
      type === 'hidden' ||
      type === 'submit' ||
      type === 'button' ||
      type === 'checkbox' ||
      type === 'radio' ||
      type === 'file' ||
      type === 'image'
    ) {
      return false;
    }
    return (
      type === 'password' ||
      type === 'text' ||
      type === 'email' ||
      type === 'tel' ||
      type === 'number' ||
      type === ''
    );
  }

  /** Collect inputs from light DOM and open shadow roots (no closed shadow). */
  function collectInputsDeep(rootNode, acc) {
    if (!rootNode) {
      return acc;
    }
    var list = rootNode.querySelectorAll ? rootNode.querySelectorAll('input') : [];
    for (var i = 0; i < list.length; i += 1) {
      acc.push(list[i]);
    }
    var all = rootNode.querySelectorAll ? rootNode.querySelectorAll('*') : [];
    for (var j = 0; j < all.length; j += 1) {
      var el = all[j];
      if (el.shadowRoot) {
        collectInputsDeep(el.shadowRoot, acc);
      }
    }
    return acc;
  }

  function getVisibleInputs(rootEl) {
    var scope = rootEl || document;
    var collected = [];
    collectInputsDeep(scope, collected);
    var visible = [];
    for (var i = 0; i < collected.length; i += 1) {
      var input = collected[i];
      if (isFillableInput(input) && isVisible(input)) {
        visible.push(input);
      }
    }
    return visible;
  }

  function normalizeAttr(value) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  /**
   * Deterministic OTP / multi-step traps — visible signals only.
   * CAPTCHA widgets do NOT veto fill: Phase 110 still fills identity+password and
   * never submits; the user solves CAPTCHA manually (Phase 112 territory).
   */
  function formHasNonStandardSignals(scope) {
    if (!scope) {
      return false;
    }

    // Only visible inputs — inactive SMS/OTP panels must not veto the password tab.
    var inputs = getVisibleInputs(scope);
    for (var i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      var autocomplete = normalizeAttr(input.autocomplete);
      var name = normalizeAttr(input.name);
      var id = normalizeAttr(input.id);
      var type = normalizeAttr(input.type);

      if (autocomplete === 'one-time-code') {
        return true;
      }
      if (
        name.indexOf('otp') !== -1 ||
        id.indexOf('otp') !== -1 ||
        name.indexOf('one-time') !== -1 ||
        id.indexOf('one-time') !== -1 ||
        name.indexOf('2fa') !== -1 ||
        id.indexOf('2fa') !== -1
      ) {
        return true;
      }
      if (type === 'password' && (name.indexOf('confirm') !== -1 || id.indexOf('confirm') !== -1)) {
        return true;
      }
    }

    return false;
  }

  /**
   * When the page has many unrelated inputs (search, newsletter, SMS) but no
   * clean <form> score, scope around the visible password field.
   */
  function scopeAroundPasswordInput(passwordInput) {
    if (!passwordInput) {
      return null;
    }

    var form = passwordInput.closest && passwordInput.closest('form');
    if (form) {
      return form;
    }

    var node = passwordInput.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      var inputs = getVisibleInputs(node);
      var hasPassword = false;
      for (var i = 0; i < inputs.length; i += 1) {
        if (inputs[i] === passwordInput) {
          hasPassword = true;
          break;
        }
      }
      if (
        hasPassword &&
        inputs.length >= 2 &&
        inputs.length <= 4
      ) {
        return node;
      }
      node = node.parentElement;
    }

    return null;
  }

  /**
   * Bot / anti-automation interstitial before the real login form
   * (Radware, Cloudflare, etc.). Generic text/DOM signals only — no host branching.
   */
  function looksLikeBotInterstitial() {
    var body = document.body;
    if (!body) {
      return false;
    }
    var text = String(body.innerText || body.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!text) {
      // Some challenge pages put copy only in title / noscript.
      text = String(document.title || '').toLowerCase();
    }
    if (
      text.indexOf('verifying your browser') !== -1 ||
      text.indexOf('just a moment') !== -1 ||
      text.indexOf('checking your browser') !== -1 ||
      text.indexOf('attention required') !== -1 ||
      text.indexOf('enable javascript and cookies') !== -1
    ) {
      return true;
    }
    if (document.getElementById('challenge-form') || document.getElementById('cf-challenge-running')) {
      return true;
    }
    if (document.querySelector && document.querySelector('#radware, .rw-challenge, [data-dtconfig]')) {
      // Dynatrace/Radware challenge shells often expose data-dtconfig before login DOM.
      var visible = getVisibleInputs(document);
      if (visible.length < 2 && /radware/i.test(document.title || '')) {
        return true;
      }
    }
    var visibleInputs = getVisibleInputs(document);
    if (
      visibleInputs.length === 0 &&
      (/radware/i.test(document.title || '') || /verifying/i.test(document.title || ''))
    ) {
      return true;
    }
    return false;
  }

  function scoreLoginForm(form) {
    var inputs = getVisibleInputs(form);
    var passwordCount = 0;
    var textCount = 0;

    for (var i = 0; i < inputs.length; i += 1) {
      var type = (inputs[i].type || 'text').toLowerCase();
      if (type === 'password') {
        passwordCount += 1;
      } else {
        textCount += 1;
      }
    }

    // Banks sometimes render password as type=text; still count as identity+secret pair via pool size.
    if (passwordCount < 1 && textCount < 2) {
      return -1;
    }
    if (passwordCount < 1 && textCount >= 2) {
      return textCount;
    }
    if (passwordCount < 1 || textCount < 1) {
      return -1;
    }

    return passwordCount * 10 + textCount;
  }

  function partitionInputs(visibleInputs) {
    var textInputs = [];
    var passwordInputs = [];
    for (var j = 0; j < visibleInputs.length; j += 1) {
      var input = visibleInputs[j];
      var inputType = (input.type || 'text').toLowerCase();
      if (inputType === 'password') {
        passwordInputs.push(input);
      } else {
        textInputs.push(input);
      }
    }
    // If no type=password, leave passwordInputs empty — mapper may still match via label on text pool.
    return { textInputs: textInputs, passwordInputs: passwordInputs };
  }

  function assessStandardLogin(detection) {
    if (!detection || !detection.form) {
      return { ok: false, reason: 'form_not_found' };
    }

    var passwordCount = detection.passwordInputs.length;
    var textCount = detection.textInputs.length;
    var total = passwordCount + textCount;

    // Standard: one password + 1–3 identity, OR 2–4 text fields when bank uses type=text for secret.
    if (passwordCount === 1 && textCount >= 1 && textCount <= 3) {
      // ok
    } else if (passwordCount === 0 && total >= 2 && total <= 4) {
      // ok — password-as-text pattern
    } else {
      return { ok: false, reason: 'not_standard_login' };
    }

    if (formHasNonStandardSignals(detection.form)) {
      return { ok: false, reason: 'not_standard_login' };
    }

    return { ok: true };
  }

  function buildDetection(scope, visibleInputs) {
    var parts = partitionInputs(visibleInputs);
    if (parts.passwordInputs.length + parts.textInputs.length < 2) {
      return null;
    }
    if (parts.passwordInputs.length < 1 && parts.textInputs.length < 2) {
      return null;
    }
    return {
      form: scope,
      textInputs: parts.textInputs,
      passwordInputs: parts.passwordInputs,
      allInputs: visibleInputs,
    };
  }

  function detectVisibleLoginForm() {
    var forms = document.querySelectorAll('form');
    var bestForm = null;
    var bestScore = -1;

    for (var i = 0; i < forms.length; i += 1) {
      var form = forms[i];
      var score = scoreLoginForm(form);
      // Prefer classic password forms over large text-only scoresheets.
      if (score > bestScore) {
        bestScore = score;
        bestForm = form;
      }
    }

    if (bestForm) {
      var formDetection = buildDetection(bestForm, getVisibleInputs(bestForm));
      if (formDetection) {
        var standard = assessStandardLogin(formDetection);
        if (standard.ok) {
          return formDetection;
        }
      }
    }

    // Retail pages often mix newsletter/search/SMS with login — scope to password.
    var pageInputs = getVisibleInputs(document);
    var passwordCandidate = null;
    for (var p = 0; p < pageInputs.length; p += 1) {
      if ((pageInputs[p].type || '').toLowerCase() === 'password') {
        passwordCandidate = pageInputs[p];
        break;
      }
    }

    if (passwordCandidate) {
      var localScope = scopeAroundPasswordInput(passwordCandidate);
      if (localScope) {
        var localDetection = buildDetection(localScope, getVisibleInputs(localScope));
        if (localDetection && assessStandardLogin(localDetection).ok) {
          return localDetection;
        }
      }
    }

    return buildDetection(document.body || document.documentElement, pageInputs);
  }

  root.GenericFormDetector = {
    isVisible: isVisible,
    detectVisibleLoginForm: detectVisibleLoginForm,
    assessStandardLogin: assessStandardLogin,
    looksLikeBotInterstitial: looksLikeBotInterstitial,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
