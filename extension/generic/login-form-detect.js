'use strict';

(function (root) {
  function describeInput(input) {
    return {
      type: (input.type || 'text').toLowerCase(),
      name: input.name || '',
      id: input.id || '',
    };
  }

  function runGenericLoginFormDetection(options) {
    var loginFields = options && options.loginFields;
    var detector = root.GenericFormDetector;

    if (!detector || typeof detector.detectVisibleLoginForm !== 'function') {
      return { ok: false, reason: 'detector_unavailable' };
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
          textFieldCount: detection.textInputs.length,
          passwordFieldCount: detection.passwordInputs.length,
        };
      }
    }

    var result = {
      ok: true,
      reason: 'form_detected',
      formId: detection.form.id || '',
      formAction: detection.form.action || '',
      textFieldCount: detection.textInputs.length,
      passwordFieldCount: detection.passwordInputs.length,
      textFields: detection.textInputs.map(describeInput),
      passwordFields: detection.passwordInputs.map(describeInput),
    };

    if (
      loginFields &&
      loginFields.length &&
      root.GenericFieldMapper &&
      typeof root.GenericFieldMapper.mapLoginFields === 'function'
    ) {
      var mapResult = root.GenericFieldMapper.mapLoginFields(
        loginFields,
        detection,
      );
      result.fieldMapping = {
        ok: mapResult.ok,
        reason: mapResult.reason || undefined,
        fieldId: mapResult.fieldId || undefined,
        mappedFieldCount: mapResult.ok ? mapResult.mappings.length : 0,
        mappings: mapResult.mappings.map(function (mapping) {
          return {
            fieldId: mapping.fieldId,
            input: describeInput(mapping.element),
          };
        }),
      };
      result.ok = result.ok && mapResult.ok;
      if (!mapResult.ok) {
        result.reason = mapResult.reason || 'mapping_failed';
      }
    }

    return result;
  }

  root.runGenericLoginFormDetection = runGenericLoginFormDetection;
})(typeof globalThis !== 'undefined' ? globalThis : window);
