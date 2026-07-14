'use strict';

/**
 * Generic autofill orchestration (Phase 103 / 110).
 * detect → standard-login gate → map → fill visible only → NEVER submit.
 * No service-id / host branching (AC-110-11).
 */
(function (root) {
  function runGenericAutofill(options) {
    var loginFields = options && options.loginFields;
    var credentials = options && options.credentials;

    if (!loginFields || !credentials) {
      return { ok: false, reason: 'missing_credentials_or_fields' };
    }

    var detector = root.GenericFormDetector;
    var mapper = root.GenericFieldMapper;
    var executor = root.GenericFillExecutor;

    if (
      !detector ||
      !mapper ||
      !executor ||
      typeof detector.detectVisibleLoginForm !== 'function' ||
      typeof mapper.mapLoginFields !== 'function' ||
      typeof executor.fillField !== 'function'
    ) {
      return { ok: false, reason: 'engine_unavailable' };
    }

    if (
      typeof detector.looksLikeBotInterstitial === 'function' &&
      detector.looksLikeBotInterstitial()
    ) {
      return { ok: false, reason: 'bot_interstitial' };
    }

    var detection = detector.detectVisibleLoginForm();
    if (!detection) {
      return { ok: false, reason: 'form_not_found' };
    }

    if (typeof detector.assessStandardLogin === 'function') {
      var standard = detector.assessStandardLogin(detection);
      if (!standard.ok) {
        return {
          ok: false,
          reason: standard.reason || 'not_standard_login',
        };
      }
    }

    var mapResult = mapper.mapLoginFields(loginFields, detection);
    if (!mapResult.ok) {
      return {
        ok: false,
        reason: mapResult.reason || 'mapping_failed',
        fieldId: mapResult.fieldId,
      };
    }

    var filled = 0;
    for (var i = 0; i < mapResult.mappings.length; i += 1) {
      var mapping = mapResult.mappings[i];
      var value = credentials[mapping.fieldId];
      if (value == null || value === '') {
        continue;
      }

      var isSecret =
        mapping.fieldId === 'password' ||
        loginFields.some(function (field) {
          return field.id === mapping.fieldId && field.type === 'password';
        });

      var fillResult = executor.fillField(mapping.element, value, isSecret);
      if (fillResult.ok) {
        filled += 1;
      }
    }

    var verifyResult = executor.verifyMappings(mapResult.mappings, credentials);

    var expectedCount = loginFields.length;
    var ok = filled === expectedCount && verifyResult.ok;

    return {
      ok: ok,
      filled: filled,
      expected: expectedCount,
      verified: verifyResult.ok,
      reason: ok
        ? undefined
        : verifyResult.ok
          ? 'partial_fill'
          : 'verification_failed',
    };
  }

  root.runGenericAutofill = runGenericAutofill;
})(typeof globalThis !== 'undefined' ? globalThis : window);
