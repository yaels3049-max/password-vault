(function () {
  'use strict';

  var EMAIL_SELECTOR =
    'form.popup_form.login_form.active input[name="email"]';
  var PASSWORD_SELECTOR =
    'form.popup_form.login_form.active input[name="password"]';

  function maskPassword(value) {
    if (!value) {
      return '(empty)';
    }
    return '*'.repeat(Math.min(value.length, 8));
  }

  function isVisible(el) {
    if (!el || el.disabled) {
      return false;
    }
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    return el.getClientRects().length > 0;
  }

  function isPopupVisible(popup) {
    if (!popup) {
      return false;
    }
    var style = window.getComputedStyle(popup);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function prepareLoginPopup() {
    var fields = findLoginFields();
    if (fields.email && fields.password) {
      return;
    }

    var popup = document.querySelector('.htz_up_popup.popup_login_form');
    if (!popup) {
      return;
    }

    if (isPopupVisible(popup)) {
      return;
    }

    popup.style.display = 'block';
    var overlay = document.getElementById('overlay_popup_up');
    if (overlay) {
      overlay.style.display = 'block';
    }

    var loginButt = popup.querySelector('.login_butt');
    var signinButt = popup.querySelector('.signin_butt');
    if (loginButt) {
      loginButt.classList.add('active');
    }
    if (signinButt) {
      signinButt.classList.remove('active');
    }

    popup.querySelectorAll('.form_wrap').forEach(function (wrap) {
      wrap.style.display = 'none';
    });
    popup.querySelectorAll('.popup_form').forEach(function (form) {
      form.classList.remove('active');
    });

    var loginForm = popup.querySelector('form.popup_form.login_form');
    if (loginForm) {
      loginForm.classList.add('active');
      var loginWrap = loginForm.closest('.form_wrap');
      if (loginWrap) {
        loginWrap.style.display = 'block';
      }
    }
  }

  function findLoginFields() {
    var email = document.querySelector(EMAIL_SELECTOR);
    var password = document.querySelector(PASSWORD_SELECTOR);

    if (email && password && isVisible(email) && isVisible(password)) {
      return { email: email, password: password };
    }

    return { email: null, password: null };
  }

  function setNativeValue(element, value) {
    element.focus();
    var descriptor = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    );
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: value,
      }),
    );
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));

    var jq = window.jQuery || window.$;
    if (jq) {
      jq(element).val(value).trigger('input').trigger('change');
      jq(element).closest('.label_content').addClass('active');
    }
  }

  function readValue(input) {
    if (!input) {
      return '';
    }
    return String(input.value || '').trim();
  }

  function logHtzoneDiagnostics(context) {
    var popup = document.querySelector('.htz_up_popup.popup_login_form');
    var loginForm = document.querySelector('form.popup_form.login_form.active');
    var emailEl = document.querySelector(EMAIL_SELECTOR);
    var passwordEl = document.querySelector(PASSWORD_SELECTOR);

    console.log('[Israeli Vault POC] HTZone adapter loaded (' + context + ')');
    console.log('[Israeli Vault POC] HTZone location.href:', location.href);
    console.log('[Israeli Vault POC] HTZone popup exists:', !!popup);
    console.log('[Israeli Vault POC] HTZone login form exists:', !!loginForm);
    console.log(
      '[Israeli Vault POC] HTZone visible email field exists:',
      !!(emailEl && isVisible(emailEl)),
    );
    console.log(
      '[Israeli Vault POC] HTZone visible password field exists:',
      !!(passwordEl && isVisible(passwordEl)),
    );
    if (passwordEl) {
      console.log(
        '[Israeli Vault POC] HTZone password value (masked):',
        maskPassword(readValue(passwordEl)),
      );
    }
  }

  logHtzoneDiagnostics('initial');

  window.__israeliVaultHtzoneFill = function (credentials) {
    logHtzoneDiagnostics('fill');
    console.log('[Israeli Vault POC] HeitechZone fillRequest received');
    console.log(
      '[Israeli Vault POC] HeitechZone credentials received:',
      credentials ? Object.keys(credentials).join(', ') : '(none)',
    );

    prepareLoginPopup();
    var fields = findLoginFields();

    if (!fields.email || !fields.password) {
      return { ok: false, reason: 'fields_not_ready' };
    }

    if (credentials && credentials.email) {
      setNativeValue(fields.email, credentials.email);
    }
    if (credentials && credentials.password) {
      setNativeValue(fields.password, credentials.password);
    }

    var emailVal = readValue(fields.email);
    var passVal = readValue(fields.password);

    console.log('[Israeli Vault POC] email value after fill:', emailVal);
    console.log(
      '[Israeli Vault POC] password value after fill:',
      maskPassword(passVal),
    );

    var ok = emailVal.length > 0 && passVal.length > 0;
    if (ok) {
      console.log('[Israeli Vault POC] HeitechZone fields filled');
    }

    return {
      ok: ok,
      emailVerified: emailVal.length > 0,
      passwordVerified: passVal.length > 0,
    };
  };
})();
