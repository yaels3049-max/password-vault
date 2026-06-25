'use strict';

(function (root) {
  function isVisible(element) {
    if (!element || element.disabled) {
      return false;
    }
    if (element.type === 'hidden') {
      return false;
    }
    var style = root.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    return element.getClientRects().length > 0;
  }

  function isFillableInput(element) {
    if (!element || element.tagName !== 'INPUT') {
      return false;
    }
    var type = (element.type || 'text').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'checkbox') {
      return false;
    }
    return type === 'password' || type === 'text' || type === 'email' || type === 'tel';
  }

  function getVisibleInputs(form) {
    var inputs = form.querySelectorAll('input');
    var visible = [];
    for (var i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      if (isFillableInput(input) && isVisible(input)) {
        visible.push(input);
      }
    }
    return visible;
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

    if (passwordCount < 1) {
      return -1;
    }

    return passwordCount * 10 + textCount;
  }

  function detectVisibleLoginForm() {
    var forms = document.querySelectorAll('form');
    var bestForm = null;
    var bestScore = -1;

    for (var i = 0; i < forms.length; i += 1) {
      var form = forms[i];
      var score = scoreLoginForm(form);
      if (score > bestScore) {
        bestScore = score;
        bestForm = form;
      }
    }

    if (!bestForm) {
      return null;
    }

    var visibleInputs = getVisibleInputs(bestForm);
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

    if (passwordInputs.length < 1) {
      return null;
    }

    return {
      form: bestForm,
      textInputs: textInputs,
      passwordInputs: passwordInputs,
      allInputs: visibleInputs,
    };
  }

  root.GenericFormDetector = {
    isVisible: isVisible,
    detectVisibleLoginForm: detectVisibleLoginForm,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
