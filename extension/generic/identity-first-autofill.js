'use strict';

/**
 * Phase 112 M9 — identity-first / partial-field autofill (D-112-20 / D-112-21).
 * MUST NOT call assessStandardLogin as a hard gate (Phase 110 same-page password).
 * Success = ≥1 visible identity field filled when password is absent from the DOM.
 * NEVER submit. NEVER auto-click Continue/Next.
 */
(function (root) {
  function runIdentityFirstAutofill(options) {
    var loginFields = options && options.loginFields;
    var credentials = options && options.credentials;

    if (!loginFields || !credentials) {
      return { ok: false, reason: 'missing_credentials_or_fields', filled: 0 };
    }

    var detector = root.GenericFormDetector;
    var mapper = root.GenericFieldMapper;
    var executor = root.GenericFillExecutor;

    if (
      !detector ||
      !mapper ||
      !executor ||
      typeof detector.detectVisibleIdentityStep !== 'function' ||
      typeof mapper.mapIdentityFieldsOnly !== 'function' ||
      typeof executor.fillField !== 'function'
    ) {
      return { ok: false, reason: 'engine_unavailable', filled: 0 };
    }

    if (
      typeof detector.looksLikeBotInterstitial === 'function' &&
      detector.looksLikeBotInterstitial()
    ) {
      return { ok: false, reason: 'bot_interstitial', filled: 0 };
    }

    // Deliberately does NOT call assessStandardLogin (D-112-20).
    var detection = detector.detectVisibleIdentityStep();
    if (!detection || !detection.textInputs || detection.textInputs.length < 1) {
      return { ok: false, reason: 'identity_step_not_found', filled: 0 };
    }

    var mapResult = mapper.mapIdentityFieldsOnly(loginFields, detection);
    if (!mapResult.ok || !mapResult.mappings || mapResult.mappings.length < 1) {
      return {
        ok: false,
        reason: mapResult.reason || 'identity_mapping_failed',
        filled: 0,
      };
    }

    var filled = 0;
    var verifiedMappings = [];
    for (var i = 0; i < mapResult.mappings.length; i += 1) {
      var mapping = mapResult.mappings[i];
      var value = credentials[mapping.fieldId];
      if (value == null || value === '') {
        continue;
      }

      var fillResult = executor.fillField(mapping.element, value, false);
      if (fillResult.ok) {
        filled += 1;
        verifiedMappings.push(mapping);
      }
    }

    // D-112-21: success = ≥1 identity field filled (password absence is expected).
    var ok = filled >= 1;

    return {
      ok: ok,
      filled: filled,
      expected: mapResult.mappings.length,
      verified: ok,
      mode: 'identity_first',
      passwordAbsent: !detection.passwordInputs || detection.passwordInputs.length === 0,
      reason: ok ? undefined : 'identity_fill_failed',
    };
  }

  root.runIdentityFirstAutofill = runIdentityFirstAutofill;
})(typeof globalThis !== 'undefined' ? globalThis : window);
