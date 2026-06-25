'use strict';

(function (root) {
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
      var label = document.querySelector('label[for="' + input.id + '"]');
      if (label) {
        return label.textContent || '';
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

  function autocompleteMatches(input, field) {
    var autocomplete = normalizeText(input.autocomplete);
    if (!autocomplete) {
      return false;
    }
    if (field.type === 'password') {
      return autocomplete === 'current-password' || autocomplete === 'new-password';
    }
    if (field.id === 'username' || field.id === 'email') {
      return autocomplete === 'username' || autocomplete === 'email';
    }
    return false;
  }

  function scoreInputForField(input, field) {
    var score = 0;
    var inputType = (input.type || 'text').toLowerCase();

    if (field.type === 'password') {
      if (inputType !== 'password') {
        return -1;
      }
      score += 50;
    } else if (inputType === 'password') {
      return -1;
    } else {
      score += 10;
    }

    if (nameOrIdMatches(input, field.id)) {
      score += 100;
    }
    if (autocompleteMatches(input, field)) {
      score += 80;
    }
    if (labelMatches(input, field.label)) {
      score += 60;
    }

    return score;
  }

  function mapLoginFields(loginFields, formDetection) {
    if (!loginFields || !formDetection) {
      return { ok: false, reason: 'missing_input', mappings: [] };
    }

    var usedInputs = new Set();
    var mappings = [];

    for (var i = 0; i < loginFields.length; i += 1) {
      var field = loginFields[i];
      var pool =
        field.type === 'password'
          ? formDetection.passwordInputs
          : formDetection.textInputs;

      var bestInput = null;
      var bestScore = -1;

      for (var j = 0; j < pool.length; j += 1) {
        var input = pool[j];
        if (usedInputs.has(input)) {
          continue;
        }
        var score = scoreInputForField(input, field);
        if (score > bestScore) {
          bestScore = score;
          bestInput = input;
        }
      }

      if (!bestInput || bestScore < 10) {
        return {
          ok: false,
          reason: 'unmapped_field',
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

  root.GenericFieldMapper = {
    mapLoginFields: mapLoginFields,
    getLabelText: getLabelText,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
