'use strict';

(function (root) {
  function runGenericAutofill(options) {
    var loginFields = options && options.loginFields;
    var credentials = options && options.credentials;

    if (!loginFields || !credentials) {
      return { ok: false, reason: 'missing_credentials_or_fields' };
    }

    console.log('[Generic Autofill] started');

    var detection = root.GenericFormDetector.detectVisibleLoginForm();
    if (!detection) {
      return { ok: false, reason: 'form_not_found' };
    }

    console.log('[Generic Autofill] visible form detected');

    var mapResult = root.GenericFieldMapper.mapLoginFields(
      loginFields,
      detection,
    );
    if (!mapResult.ok) {
      return {
        ok: false,
        reason: mapResult.reason || 'mapping_failed',
        fieldId: mapResult.fieldId,
      };
    }

    console.log(
      '[Generic Autofill] mapped fields: ' +
        mapResult.mappings.length +
        '/' +
        loginFields.length,
    );

    var filled = 0;
    for (var i = 0; i < mapResult.mappings.length; i += 1) {
      var mapping = mapResult.mappings[i];
      var value = credentials[mapping.fieldId];
      if (value == null || value === '') {
        continue;
      }

      var isSecret = mapping.fieldId === 'password' || loginFields.some(function (field) {
        return field.id === mapping.fieldId && field.type === 'password';
      });

      var fillResult = root.GenericFillExecutor.fillField(
        mapping.element,
        value,
        isSecret,
      );
      if (fillResult.ok) {
        filled += 1;
      }
    }

    var verifyResult = root.GenericFillExecutor.verifyMappings(
      mapResult.mappings,
      credentials,
    );

    var expectedCount = loginFields.length;
    var ok = filled === expectedCount && verifyResult.ok;

    if (ok) {
      console.log('[Generic Autofill] fill verified');
    }

    return {
      ok: ok,
      filled: filled,
      expected: expectedCount,
      verified: verifyResult.ok,
      reason: ok ? undefined : verifyResult.ok ? 'partial_fill' : 'verification_failed',
    };
  }

  root.runGenericAutofill = runGenericAutofill;
})(typeof globalThis !== 'undefined' ? globalThis : window);
