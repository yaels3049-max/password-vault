'use strict';

(function (root) {
  /** Identity fields need more than type-alone (score 10). Password type-alone is 50. */
  var MIN_IDENTITY_SCORE = 60;
  var MIN_PASSWORD_SCORE = 50;
  /** If runner-up is within this margin of best, treat as ambiguous → no fill. */
  var AMBIGUITY_MARGIN = 20;

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function getLabelText(input) {
    if (!input) {
      return '';
    }

    if (input.labels && input.labels.length > 0) {
      return input.labels[0].textContent || '';
    }

    if (input.id) {
      var escapedId =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(input.id)
          : String(input.id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      var label = document.querySelector('label[for="' + escapedId + '"]');
      if (label) {
        return label.textContent || '';
      }
    }

    var labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      var parts = String(labelledBy).split(/\s+/);
      var texts = [];
      for (var p = 0; p < parts.length; p += 1) {
        var node = document.getElementById(parts[p]);
        if (node && node.textContent) {
          texts.push(node.textContent);
        }
      }
      if (texts.length > 0) {
        return texts.join(' ');
      }
    }

    var parentLabel = input.closest('label');
    if (parentLabel) {
      var clone = parentLabel.cloneNode(true);
      var nested = clone.querySelector('input, select, textarea');
      if (nested) {
        nested.remove();
      }
      return clone.textContent || '';
    }

    // Angular Material / similar: label lives in a wrapping form-field, not on <label for=>.
    var formField = input.closest(
      '.mat-form-field, .mat-mdc-form-field, .form-field, [class*="form-field"]',
    );
    if (formField) {
      var floating = formField.querySelector(
        'mat-label, .mat-mdc-floating-label, .mat-form-field-label, label',
      );
      if (floating && floating.textContent) {
        return floating.textContent;
      }
    }

    return input.getAttribute('aria-label') || input.placeholder || '';
  }

  function nameOrIdMatches(input, fieldId) {
    var id = normalizeText(input.id);
    var name = normalizeText(input.name);
    var target = normalizeText(fieldId);
    return id === target || name === target;
  }

  function labelMatches(input, fieldLabel) {
    var labelText = normalizeText(getLabelText(input));
    var target = normalizeText(fieldLabel);
    if (!labelText || !target) {
      return false;
    }
    return labelText.indexOf(target) !== -1 || target.indexOf(labelText) !== -1;
  }

  /**
   * Deterministic identity-label synonyms (no service-id branching).
   * Helps Hebrew banking/retail labels map to vault field id `username` / `email`.
   */
  function identityLabelCandidates(field) {
    var labels = [];
    if (field.label) {
      labels.push(field.label);
    }
    if (field.type === 'password') {
      labels.push('סיסמה', 'סיסמא', 'password', 'passwd', 'pwd');
      return labels;
    }
    var id = normalizeText(field.id);
    if (id === 'username' || id === 'usercode' || id === 'user' || id === 'userid') {
      labels.push(
        'קוד משתמש',
        'שם משתמש',
        'משתמש',
        'קוד',
        'username',
        'user',
        'user id',
        'userid',
        'usercode',
        // Retail sites often use email as the account identity.
        'אימייל',
        'דואל',
        'דוא"ל',
        'מייל',
        'email',
        'e-mail',
      );
    }
    if (id === 'email') {
      labels.push('אימייל', 'דואל', 'מייל', 'email', 'e-mail');
    }
    if (id === 'idnumber' || id === 'tz' || id === 'nationalid') {
      labels.push('תעודת זהות', 'מספר זהות', 'ת.ז', 'id');
    }
    return labels;
  }

  function anyLabelMatches(input, field) {
    var candidates = identityLabelCandidates(field);
    for (var i = 0; i < candidates.length; i += 1) {
      if (labelMatches(input, candidates[i])) {
        return true;
      }
    }
    return false;
  }

  function autocompleteMatches(input, field) {
    var autocomplete = normalizeText(input.autocomplete);
    if (!autocomplete) {
      return false;
    }
    if (field.type === 'password') {
      return autocomplete === 'current-password' || autocomplete === 'new-password';
    }
    if (
      field.id === 'username' ||
      field.id === 'email' ||
      field.id === 'userCode' ||
      field.id === 'user'
    ) {
      return (
        autocomplete === 'username' ||
        autocomplete === 'email' ||
        autocomplete.indexOf('username') !== -1
      );
    }
    return false;
  }

  function scoreInputForField(input, field) {
    var score = 0;
    var inputType = (input.type || 'text').toLowerCase();
    var inputId = normalizeText(input.id);
    var inputName = normalizeText(input.name);

    if (field.type === 'password') {
      if (inputType === 'password') {
        score += 50;
      } else if (
        (inputType === 'text' || inputType === 'tel' || inputType === '') &&
        (autocompleteMatches(input, field) || anyLabelMatches(input, field))
      ) {
        // Some banks render the secret field as type=text.
        score += 45;
      } else {
        return -1;
      }
    } else if (inputType === 'password') {
      return -1;
    } else {
      score += 10;
      // Retail/e-commerce: account identity is often type=email or named email/login.
      if (
        field.id === 'username' ||
        field.id === 'email' ||
        field.id === 'userCode' ||
        field.id === 'user'
      ) {
        if (inputType === 'email') {
          score += 55;
        } else if (
          inputId.indexOf('email') !== -1 ||
          inputName.indexOf('email') !== -1 ||
          inputId.indexOf('login') !== -1 ||
          inputName.indexOf('login') !== -1 ||
          inputId.indexOf('user') !== -1 ||
          inputName.indexOf('user') !== -1
        ) {
          score += 55;
        }
      }
    }

    if (nameOrIdMatches(input, field.id)) {
      score += 100;
    }
    // Avoid double-counting label/autocomplete already used for password-as-text gate.
    if (field.type !== 'password' || inputType === 'password') {
      if (autocompleteMatches(input, field)) {
        score += 80;
      }
      if (anyLabelMatches(input, field)) {
        score += 60;
      }
    } else {
      if (autocompleteMatches(input, field)) {
        score += 30;
      }
      if (anyLabelMatches(input, field)) {
        score += 20;
      }
    }

    return score;
  }

  function minScoreForField(field) {
    return field.type === 'password' ? MIN_PASSWORD_SCORE : MIN_IDENTITY_SCORE;
  }

  /**
   * Map vault loginFields → visible DOM inputs.
   * Deterministic HTML signals only (id/name/autocomplete/label/type).
   * Low confidence or ambiguous → do not fill (AC-110-14).
   * No service-id / host branching.
   */
  function mapLoginFields(loginFields, formDetection) {
    if (!loginFields || !formDetection) {
      return { ok: false, reason: 'missing_input', mappings: [] };
    }

    var usedInputs = new Set();
    var mappings = [];

    for (var i = 0; i < loginFields.length; i += 1) {
      var field = loginFields[i];
      var pool;
      if (field.type === 'password') {
        pool =
          formDetection.passwordInputs && formDetection.passwordInputs.length > 0
            ? formDetection.passwordInputs
            : formDetection.textInputs;
      } else {
        pool = formDetection.textInputs;
      }

      var bestInput = null;
      var bestScore = -1;
      var secondScore = -1;

      for (var j = 0; j < pool.length; j += 1) {
        var input = pool[j];
        if (usedInputs.has(input)) {
          continue;
        }
        var score = scoreInputForField(input, field);
        if (score > bestScore) {
          secondScore = bestScore;
          bestScore = score;
          bestInput = input;
        } else if (score > secondScore) {
          secondScore = score;
        }
      }

      var minScore = minScoreForField(field);
      if (!bestInput || bestScore < minScore) {
        return {
          ok: false,
          reason: 'low_confidence',
          fieldId: field.id,
          mappings: mappings,
        };
      }

      if (
        secondScore >= minScore &&
        bestScore - secondScore <= AMBIGUITY_MARGIN
      ) {
        return {
          ok: false,
          reason: 'ambiguous_mapping',
          fieldId: field.id,
          mappings: mappings,
        };
      }

      usedInputs.add(bestInput);
      mappings.push({
        fieldId: field.id,
        element: bestInput,
        score: bestScore,
      });
    }

    return { ok: true, mappings: mappings };
  }

  /**
   * Phase 112 M9 — map non-password loginFields only (D-112-20/21).
   * Password vault fields are skipped when no password input is on the page.
   */
  function mapIdentityFieldsOnly(loginFields, formDetection) {
    if (!loginFields || !formDetection) {
      return { ok: false, reason: 'missing_input', mappings: [] };
    }

    var identityFields = [];
    for (var f = 0; f < loginFields.length; f += 1) {
      if (loginFields[f].type !== 'password') {
        identityFields.push(loginFields[f]);
      }
    }

    if (identityFields.length === 0) {
      return { ok: false, reason: 'no_identity_fields', mappings: [] };
    }

    var usedInputs = new Set();
    var mappings = [];

    for (var i = 0; i < identityFields.length; i += 1) {
      var field = identityFields[i];
      var pool = formDetection.textInputs || [];
      var bestInput = null;
      var bestScore = -1;
      var secondScore = -1;

      for (var j = 0; j < pool.length; j += 1) {
        var input = pool[j];
        if (usedInputs.has(input)) {
          continue;
        }
        var score = scoreInputForField(input, field);
        if (score > bestScore) {
          secondScore = bestScore;
          bestScore = score;
          bestInput = input;
        } else if (score > secondScore) {
          secondScore = score;
        }
      }

      var minScore = minScoreForField(field);
      if (!bestInput || bestScore < minScore) {
        // Soft-skip this vault field; another identity field may still map.
        continue;
      }

      if (
        secondScore >= minScore &&
        bestScore - secondScore <= AMBIGUITY_MARGIN
      ) {
        continue;
      }

      usedInputs.add(bestInput);
      mappings.push({
        fieldId: field.id,
        element: bestInput,
        score: bestScore,
      });
    }

    if (mappings.length < 1) {
      return { ok: false, reason: 'no_identity_mapping', mappings: [] };
    }

    return { ok: true, mappings: mappings };
  }

  root.GenericFieldMapper = {
    mapLoginFields: mapLoginFields,
    mapIdentityFieldsOnly: mapIdentityFieldsOnly,
    getLabelText: getLabelText,
    MIN_IDENTITY_SCORE: MIN_IDENTITY_SCORE,
    MIN_PASSWORD_SCORE: MIN_PASSWORD_SCORE,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
