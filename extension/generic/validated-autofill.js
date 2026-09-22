'use strict';

/**
 * Phase 117 — deterministic Managed Autofill runner.
 * Mapping-driven only. Reuses GenericFillExecutor. Never submits. Top document only.
 * Readiness = all required mapped locators → exactly one safe target (D-117-17).
 */
(function (root) {
  /**
   * Assess whether every mapped locator resolves to exactly one safe fill target.
   * Does not fill. Returns structured readiness — retryable when targets_not_ready.
   */
  function assessManagedTargetsReady(options) {
    var executor = root.GenericFillExecutor;
    if (!executor || typeof executor.isSafeFillTarget !== 'function') {
      return { ready: false, reason: 'executor_missing' };
    }

    if (root.top && root.top !== root) {
      return { ready: false, reason: 'not_top_frame' };
    }

    var allowedOrigin = options && options.allowedOrigin;
    if (!allowedOrigin || root.location.origin !== allowedOrigin) {
      return { ready: false, reason: 'wrong_origin' };
    }

    var mappings = options && Array.isArray(options.fieldMappings) ? options.fieldMappings : [];
    if (mappings.length === 0) {
      return { ready: false, reason: 'no_mappings' };
    }

    var targets = [];

    for (var i = 0; i < mappings.length; i += 1) {
      var mapping = mappings[i];
      var fieldId = mapping && mapping.fieldId;
      var locator = mapping && mapping.locator;
      if (!fieldId || !locator) {
        return { ready: false, reason: 'invalid_mapping' };
      }

      var nodes;
      try {
        nodes = root.document.querySelectorAll(locator);
      } catch (_selectorError) {
        return { ready: false, reason: 'invalid_selector', fieldId: fieldId };
      }

      if (!nodes || nodes.length === 0) {
        return {
          ready: false,
          reason: 'targets_not_ready',
          fieldId: fieldId,
          locator: locator,
          detail: 'zero_match',
          observedUrl: String(root.location.href || ''),
        };
      }
      if (nodes.length !== 1) {
        return {
          ready: false,
          reason: 'targets_not_ready',
          fieldId: fieldId,
          locator: locator,
          detail: 'multi_match',
          observedUrl: String(root.location.href || ''),
        };
      }

      var element = nodes[0];
      if (!executor.isSafeFillTarget(element)) {
        var eligibility = root.ManagedTargetEligibility;
        var detail = 'unsafe_target';
        if (
          eligibility &&
          typeof eligibility.classifyManagedIneligibility === 'function'
        ) {
          detail = eligibility.classifyManagedIneligibility(element) || detail;
        } else if (element && element.type === 'hidden') {
          detail = 'hidden_target';
        } else if (element && element.disabled) {
          detail = 'non_editable';
        }
        return {
          ready: false,
          reason: 'targets_not_ready',
          fieldId: fieldId,
          locator: locator,
          detail: detail,
          observedUrl: String(root.location.href || ''),
        };
      }

      targets.push({ fieldId: fieldId, element: element });
    }

    return { ready: true, targets: targets };
  }

  function runManagedAutofill(options) {
    var readiness = assessManagedTargetsReady(options);
    if (!readiness.ready) {
      return {
        ok: false,
        reason: readiness.reason,
        fieldId: readiness.fieldId,
        locator: readiness.locator,
        detail: readiness.detail,
        observedUrl: readiness.observedUrl,
      };
    }

    var executor = root.GenericFillExecutor;
    var credentials =
      options && options.credentials && typeof options.credentials === 'object'
        ? options.credentials
        : {};

    var verifyMappings = [];
    var filledCount = 0;

    for (var i = 0; i < readiness.targets.length; i += 1) {
      var target = readiness.targets[i];
      var value = credentials[target.fieldId];
      var fillResult = executor.fillField(target.element, value, true);
      if (!fillResult || !fillResult.ok) {
        return {
          ok: false,
          reason: (fillResult && fillResult.reason) || 'fill_failed',
          fieldId: target.fieldId,
        };
      }

      filledCount += 1;
      verifyMappings.push({ fieldId: target.fieldId, element: target.element });
    }

    var verified = executor.verifyMappings(verifyMappings, credentials);
    if (!verified || !verified.ok) {
      return { ok: false, reason: 'partial_fill', filled: filledCount };
    }

    return { ok: true, filled: filledCount, reason: 'ok' };
  }

  root.assessManagedTargetsReady = assessManagedTargetsReady;
  root.runManagedAutofill = runManagedAutofill;
})(typeof globalThis !== 'undefined' ? globalThis : window);
