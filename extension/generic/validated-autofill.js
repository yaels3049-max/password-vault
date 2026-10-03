'use strict';

/**
 * Phase 117 — deterministic Managed Autofill runner.
 * Mapping-driven only. Reuses GenericFillExecutor. Never submits. Top document only.
 * D-121-39 — optional frameContext { mode: 'declared_depth1' } (set only by the Ext SPECIAL
 * orchestrator after it resolved the plan's frame) runs in a depth-1 frame instead.
 * Readiness = all required mapped locators → exactly one safe target (D-117-17).
 *
 * Post-120 Corrective A / A2 / A2.1 / A2.2 / A2.3 / A2.4 — optional fillDiagnostics stamps.
 * Diagnostics MUST NOT alter ok / reason / detail / filled / verify decisions.
 * A2.3 observes post-verify async boundaries (microtask / rAF / timeout 0).
 * A2.4 observes post-runtime transitions (P/R/E/L) on admin_test|digital_home paths only.
 */
(function (root) {
  var diagStageOrder = 0;

  function newDiagRunId() {
    return (
      'mfd_' +
      String(Date.now()) +
      '_' +
      String(Math.floor(Math.random() * 1e9))
    );
  }

  function resolveExactOne(locator) {
    try {
      var nodes = root.document.querySelectorAll(locator);
      var n = nodes ? nodes.length : 0;
      if (n === 0) {
        return { matchCount: 0, exactOne: 'zero', element: null };
      }
      if (n !== 1) {
        return { matchCount: n, exactOne: 'multi', element: null };
      }
      return { matchCount: 1, exactOne: 'exact_one', element: nodes[0] };
    } catch (_e) {
      return { matchCount: -1, exactOne: 'invalid_selector', element: null };
    }
  }

  function managedEligibleBool(element) {
    var executor = root.GenericFillExecutor;
    if (!element || !executor || typeof executor.isSafeFillTarget !== 'function') {
      return false;
    }
    return executor.isSafeFillTarget(element) === true;
  }

  /** Boolean only — never returns or logs credential / .value strings. */
  function expectedValueMatch(element, expected) {
    if (!element || expected == null) {
      return false;
    }
    return String(element.value || '').trim() === String(expected).trim();
  }

  function pushStamp(bag, stamp) {
    if (!bag || !Array.isArray(bag.stamps)) {
      return;
    }
    diagStageOrder += 1;
    stamp.stageOrderIndex = diagStageOrder;
    stamp.runId = bag.runId;
    stamp.path = bag.path;
    bag.stamps.push(stamp);
  }

  function stampResolve(bag, stage, fieldId, locator, heldEl, expected) {
    var resolved = resolveExactOne(locator);
    var current = resolved.element;
    var heldConnected =
      heldEl && typeof heldEl.isConnected === 'boolean' ? heldEl.isConnected : null;
    var heldEqualsCurrent =
      heldEl && current ? heldEl === current : heldEl || current ? false : null;
    var targetReplaced =
      heldEl && current ? heldEl !== current || heldEl.isConnected === false : false;

    pushStamp(bag, {
      fieldId: fieldId,
      locator: locator,
      stage: stage,
      exactOne: resolved.exactOne,
      matchCount: resolved.matchCount,
      managedEligible: current ? managedEligibleBool(current) : false,
      heldConnected: heldConnected,
      heldEqualsCurrent: heldEqualsCurrent,
      targetReplaced: targetReplaced,
      expectedValueMatchHeld:
        heldEl && expected != null ? expectedValueMatch(heldEl, expected) : null,
      expectedValueMatchCurrent:
        current && expected != null ? expectedValueMatch(current, expected) : null,
    });
    return resolved;
  }

  /**
   * Assess whether every mapped locator resolves to exactly one safe fill target.
   * Does not fill. Returns structured readiness — retryable when targets_not_ready.
   */
  function assessManagedTargetsReady(options) {
    var executor = root.GenericFillExecutor;
    if (!executor || typeof executor.isSafeFillTarget !== 'function') {
      return { ready: false, reason: 'executor_missing' };
    }

    var frameContext = options && options.frameContext;
    if (frameContext) {
      if (frameContext.mode !== 'declared_depth1' || !root.top || root.top === root) {
        return { ready: false, reason: 'frame_context_mismatch' };
      }
      if (root.parent !== root.top) {
        return { ready: false, reason: 'frame_not_depth1' };
      }
    } else if (root.top && root.top !== root) {
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

      targets.push({ fieldId: fieldId, element: element, locator: locator });
    }

    return { ready: true, targets: targets };
  }

  function stampFillStageMatches(bag, fieldId, locator, heldEl, fillResult) {
    var matches = fillResult && fillResult.fillStageMatches;
    if (!matches || typeof matches !== 'object') {
      return;
    }
    var stages = [
      'fill_post_native_set',
      'fill_post_beforeinput',
      'fill_post_input',
      'fill_post_change',
      'fill_post_keyup',
      'fill_post_events',
      'fill_post_blur',
    ];
    for (var i = 0; i < stages.length; i += 1) {
      var stage = stages[i];
      if (typeof matches[stage] !== 'boolean') {
        continue;
      }
      pushStamp(bag, {
        fieldId: fieldId,
        locator: locator,
        stage: stage,
        exactOne: null,
        matchCount: null,
        managedEligible: managedEligibleBool(heldEl),
        heldConnected:
          heldEl && typeof heldEl.isConnected === 'boolean' ? heldEl.isConnected : null,
        heldEqualsCurrent: null,
        targetReplaced: null,
        expectedValueMatchHeld: matches[stage],
        expectedValueMatchCurrent: null,
      });
    }
  }

  /**
   * A2.5 — read-only peer observation at an existing active-field stage.
   * Never writes values; never throws into fill.
   */
  function stampPeerObserve(bag, peer, activeFieldId, observingActiveStage) {
    try {
      var resolved = resolveExactOne(peer.locator);
      var current = resolved.element;
      var heldEl = peer.element;
      pushStamp(bag, {
        fieldId: peer.fieldId,
        locator: peer.locator,
        stage: 'peer_observe',
        peerFieldId: peer.fieldId,
        activeFieldId: activeFieldId,
        observingActiveStage: observingActiveStage,
        exactOne: resolved.exactOne,
        matchCount: resolved.matchCount,
        managedEligible: current ? managedEligibleBool(current) : false,
        heldConnected:
          heldEl && typeof heldEl.isConnected === 'boolean' ? heldEl.isConnected : null,
        heldEqualsCurrent:
          heldEl && current ? heldEl === current : heldEl || current ? false : null,
        targetReplaced:
          heldEl && current ? heldEl !== current || heldEl.isConnected === false : false,
        expectedValueMatchHeld:
          heldEl && peer.expected != null ? expectedValueMatch(heldEl, peer.expected) : null,
        expectedValueMatchCurrent:
          current && peer.expected != null ? expectedValueMatch(current, peer.expected) : null,
        probeFailed: false,
        epistemics: 'observed_adjacency_only',
      });
    } catch (_peerErr) {
      try {
        pushStamp(bag, {
          fieldId: peer.fieldId,
          locator: peer.locator,
          stage: 'peer_observe',
          peerFieldId: peer.fieldId,
          activeFieldId: activeFieldId,
          observingActiveStage: observingActiveStage,
          exactOne: null,
          matchCount: null,
          managedEligible: null,
          heldConnected: null,
          heldEqualsCurrent: null,
          targetReplaced: null,
          expectedValueMatchHeld: null,
          expectedValueMatchCurrent: null,
          probeFailed: true,
          epistemics: 'observed_adjacency_only',
        });
      } catch (_stampErr) {
        // fail-open
      }
    }
  }

  function makePeerStageProbe(bag, peers, activeFieldId, peerMatchTrail) {
    return function onStageProbe(observingActiveStage) {
      for (var i = 0; i < peers.length; i += 1) {
        var peer = peers[i];
        stampPeerObserve(bag, peer, activeFieldId, observingActiveStage);
        var last = bag.stamps[bag.stamps.length - 1];
        if (
          last &&
          last.stage === 'peer_observe' &&
          last.peerFieldId === peer.fieldId &&
          last.probeFailed !== true
        ) {
          var matchNow = last.expectedValueMatchHeld === true;
          var prev = peerMatchTrail[peer.fieldId];
          if (prev && prev.match === true && matchNow === false && !prev.reportedLoss) {
            pushStamp(bag, {
              fieldId: peer.fieldId,
              locator: peer.locator,
              stage: 'peer_first_observed_loss_boundary',
              peerFieldId: peer.fieldId,
              activeFieldId: activeFieldId,
              observingActiveStage: observingActiveStage,
              firstObservedLossBoundary:
                'after ' +
                prev.observingActiveStage +
                ' / at-or-before ' +
                observingActiveStage,
              epistemics: 'observed_adjacency_only',
              exactOne: null,
              matchCount: null,
              managedEligible: null,
              heldConnected: null,
              heldEqualsCurrent: null,
              targetReplaced: null,
              expectedValueMatchHeld: false,
              expectedValueMatchCurrent: null,
              probeFailed: false,
            });
            peerMatchTrail[peer.fieldId] = {
              match: matchNow,
              observingActiveStage: observingActiveStage,
              reportedLoss: true,
            };
          } else {
            peerMatchTrail[peer.fieldId] = {
              match: matchNow,
              observingActiveStage: observingActiveStage,
              reportedLoss: prev && prev.reportedLoss === true,
            };
          }
        }
      }
    };
  }

  function attachDiagnostics(result, bag) {
    if (!result || !bag) {
      return result;
    }
    result.fillDiagnostics = {
      runId: bag.runId,
      path: bag.path,
      stamps: bag.stamps,
    };
    return result;
  }

  function runManagedAutofill(options) {
    diagStageOrder = 0;
    var path =
      options && typeof options.diagnosticPath === 'string' && options.diagnosticPath.trim()
        ? options.diagnosticPath.trim()
        : 'unknown';
    var bag = {
      runId: newDiagRunId(),
      path: path,
      stamps: [],
    };

    var readiness = assessManagedTargetsReady(options);
    if (!readiness.ready) {
      // Structural stamp for the failing locator when assess provides one.
      if (readiness.fieldId && readiness.locator) {
        stampResolve(
          bag,
          'assess_resolve',
          readiness.fieldId,
          readiness.locator,
          null,
          null,
        );
      }
      return attachDiagnostics(
        {
          ok: false,
          reason: readiness.reason,
          fieldId: readiness.fieldId,
          locator: readiness.locator,
          detail: readiness.detail,
          observedUrl: readiness.observedUrl,
        },
        bag,
      );
    }

    var executor = root.GenericFillExecutor;
    var credentials =
      options && options.credentials && typeof options.credentials === 'object'
        ? options.credentials
        : {};

    var mappings = options && Array.isArray(options.fieldMappings) ? options.fieldMappings : [];
    var locatorByFieldId = {};
    for (var m = 0; m < mappings.length; m += 1) {
      if (mappings[m] && mappings[m].fieldId && mappings[m].locator) {
        locatorByFieldId[mappings[m].fieldId] = mappings[m].locator;
      }
    }
    for (var t = 0; t < readiness.targets.length; t += 1) {
      if (!locatorByFieldId[readiness.targets[t].fieldId] && readiness.targets[t].locator) {
        locatorByFieldId[readiness.targets[t].fieldId] = readiness.targets[t].locator;
      }
    }

    // assess_resolve — one stamp per ready target (held identity at assess).
    for (var a = 0; a < readiness.targets.length; a += 1) {
      var at = readiness.targets[a];
      var aLoc = locatorByFieldId[at.fieldId] || at.locator;
      stampResolve(bag, 'assess_resolve', at.fieldId, aLoc, at.element, null);
    }

    var verifyMappings = [];
    var filledCount = 0;
    var filledTrail = [];
    var peerDiagEnabled =
      bag.path === 'admin_test' || bag.path === 'digital_home';

    for (var i = 0; i < readiness.targets.length; i += 1) {
      var target = readiness.targets[i];
      var locator = locatorByFieldId[target.fieldId] || target.locator;
      var value = credentials[target.fieldId];

      stampResolve(bag, 'pre_fill', target.fieldId, locator, target.element, value);

      var onStageProbe = null;
      var peerMatchTrail = {};
      if (peerDiagEnabled && filledTrail.length > 0) {
        onStageProbe = makePeerStageProbe(
          bag,
          filledTrail.slice(),
          target.fieldId,
          peerMatchTrail,
        );
      }

      var fillResult = executor.fillField(
        target.element,
        value,
        true,
        onStageProbe,
      );
      // A2.1 — observational stamps from fillField stage matches (do not alter ok branch).
      stampFillStageMatches(bag, target.fieldId, locator, target.element, fillResult);
      if (!fillResult || !fillResult.ok) {
        stampResolve(
          bag,
          'post_fill_immediate',
          target.fieldId,
          locator,
          target.element,
          value,
        );
        return attachDiagnostics(
          {
            ok: false,
            reason: (fillResult && fillResult.reason) || 'fill_failed',
            fieldId: target.fieldId,
          },
          bag,
        );
      }

      stampResolve(
        bag,
        'post_fill_immediate',
        target.fieldId,
        locator,
        target.element,
        value,
      );

      // A2.5 — peer observe at existing post_fill_immediate boundary (call-site).
      if (peerDiagEnabled && filledTrail.length > 0 && typeof onStageProbe === 'function') {
        try {
          onStageProbe('post_fill_immediate');
        } catch (_postPeerErr) {
          // fail-open
        }
      }

      filledCount += 1;
      filledTrail.push({
        fieldId: target.fieldId,
        locator: locator,
        element: target.element,
        expected: value,
      });
      verifyMappings.push({ fieldId: target.fieldId, element: target.element });

      // post_field_advance — re-check all filled fields so far (detect E cross-invalidation).
      for (var f = 0; f < filledTrail.length; f += 1) {
        var prior = filledTrail[f];
        stampResolve(
          bag,
          'post_field_advance',
          prior.fieldId,
          prior.locator,
          prior.element,
          prior.expected,
        );
      }
    }

    var verified = executor.verifyMappings(verifyMappings, credentials);

    // verify_held — held references only (existing verify contract).
    for (var v = 0; v < filledTrail.length; v += 1) {
      var hv = filledTrail[v];
      pushStamp(bag, {
        fieldId: hv.fieldId,
        locator: hv.locator,
        stage: 'verify_held',
        exactOne: null,
        matchCount: null,
        managedEligible: managedEligibleBool(hv.element),
        heldConnected:
          hv.element && typeof hv.element.isConnected === 'boolean'
            ? hv.element.isConnected
            : null,
        heldEqualsCurrent: null,
        targetReplaced: null,
        expectedValueMatchHeld: expectedValueMatch(hv.element, hv.expected),
        expectedValueMatchCurrent: null,
      });
    }

    // Build outcome first — existing semantics unchanged.
    // A2.3: outcome is frozen here (ok/reason/filled never reassigned after this).
    var outcome;
    if (!verified || !verified.ok) {
      outcome = { ok: false, reason: 'partial_fill', filled: filledCount };
    } else {
      outcome = { ok: true, filled: filledCount, reason: 'ok' };
    }

    // verify_current_probe — READ-ONLY. Must not change outcome.
    for (var c = 0; c < filledTrail.length; c += 1) {
      var cv = filledTrail[c];
      stampResolve(
        bag,
        'verify_current_probe',
        cv.fieldId,
        cv.locator,
        cv.element,
        cv.expected,
      );
    }

    // A2.3 — post-verification read-only observations (async boundaries only).
    // Does not change ok/reason/filled; only appends stamps before return delivery.
    // A2.4 (admin_test / digital_home diagnostic paths only) chains after A2.3.
    // D-121-70: skipped for a SPECIAL step with an exit — its transition waits for this result.
    var skipA24 = Boolean(options && options.skipPostRuntimeObserve === true);
    return observePostVerifyAsync(bag, filledTrail, outcome).then(function () {
      var runA24 = (bag.path === 'admin_test' || bag.path === 'digital_home') && !skipA24;
      if (!runA24) {
        return attachDiagnostics(outcome, bag);
      }
      return observePostRuntimeA24(bag, filledTrail, outcome).then(function () {
        return attachDiagnostics(outcome, bag);
      });
    });
  }

  /**
   * A2.3 — After outcome freeze + verify_current_probe, observe match at
   * microtask / rAF / setTimeout(0). Never mutates outcome.ok|reason|filled.
   * Never dispatches events, focus, blur, or writes .value.
   */
  function observePostVerifyAsync(bag, filledTrail, outcome) {
    return new Promise(function (resolve) {
      var remaining = 3;

      function finish() {
        remaining -= 1;
        if (remaining > 0) {
          return;
        }
        resolve(null);
      }

      function stampAll(stage) {
        for (var i = 0; i < filledTrail.length; i += 1) {
          var row = filledTrail[i];
          stampResolve(
            bag,
            stage,
            row.fieldId,
            row.locator,
            row.element,
            row.expected,
          );
        }
      }

      if (typeof queueMicrotask === 'function') {
        queueMicrotask(function () {
          stampAll('post_verify_microtask');
          finish();
        });
      } else {
        Promise.resolve()
          .then(function () {
            stampAll('post_verify_microtask');
            finish();
          })
          .catch(function () {
            stampAll('post_verify_microtask');
            finish();
          });
      }

      var scheduleRaf =
        typeof root.requestAnimationFrame === 'function'
          ? function (cb) {
              root.requestAnimationFrame(cb);
            }
          : typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : function (cb) {
                setTimeout(cb, 0);
              };
      scheduleRaf(function () {
        stampAll('post_verify_raf');
        finish();
      });

      setTimeout(function () {
        stampAll('post_verify_timeout_0');
        finish();
      }, 0);
    });
  }

  // --- A2.4 post-runtime transition diagnostics (Safety DD §39.A4.A2.4.S) ---

  /** When false, P is not installed; B (bounded rAF match) is used instead. */
  var A24_P_ENABLED = true;
  var A24_BOUND_MS = 5000;

  function a24CloneDesc(desc) {
    if (!desc) {
      return null;
    }
    var out = {
      configurable: desc.configurable,
      enumerable: desc.enumerable,
    };
    if (Object.prototype.hasOwnProperty.call(desc, 'get') || Object.prototype.hasOwnProperty.call(desc, 'set')) {
      out.get = desc.get;
      out.set = desc.set;
    } else {
      out.value = desc.value;
      out.writable = desc.writable;
    }
    return out;
  }

  function a24ResolveValueForward(el) {
    if (!el) {
      return null;
    }
    var ownDesc = Object.getOwnPropertyDescriptor(el, 'value');
    if (ownDesc) {
      if (typeof ownDesc.get === 'function' && typeof ownDesc.set === 'function') {
        return {
          hadOwn: true,
          savedOwn: a24CloneDesc(ownDesc),
          fwdGet: ownDesc.get,
          fwdSet: ownDesc.set,
        };
      }
      return null;
    }
    var proto = Object.getPrototypeOf(el);
    while (proto) {
      var d = Object.getOwnPropertyDescriptor(proto, 'value');
      if (d && typeof d.get === 'function' && typeof d.set === 'function') {
        return {
          hadOwn: false,
          savedOwn: null,
          fwdGet: d.get,
          fwdSet: d.set,
        };
      }
      proto = Object.getPrototypeOf(proto);
    }
    return null;
  }

  function a24MatchViaFwd(el, expected, fwdGet) {
    if (!el || expected == null || typeof fwdGet !== 'function') {
      return false;
    }
    try {
      return String(fwdGet.call(el) || '').trim() === String(expected).trim();
    } catch (_e) {
      return false;
    }
  }

  /**
   * Install P wrap on one element. Returns handle or null (fail-open).
   * Never modifies prototypes.
   */
  function a24InstallP(el, expected, onBoundary) {
    var fwd = a24ResolveValueForward(el);
    if (!fwd) {
      return null;
    }
    var recording = false;
    var closed = false;
    var handle = {
      el: el,
      expected: expected,
      hadOwn: fwd.hadOwn,
      savedOwn: fwd.savedOwn,
      fwdGet: fwd.fwdGet,
      fwdSet: fwd.fwdSet,
      closed: false,
      teardown: null,
    };

    function diagnosticGet() {
      return fwd.fwdGet.call(el);
    }

    function diagnosticSet(incoming) {
      if (recording || closed) {
        return fwd.fwdSet.call(el, incoming);
      }
      recording = true;
      try {
        var ret = fwd.fwdSet.call(el, incoming);
        var matchAfter = a24MatchViaFwd(el, expected, fwd.fwdGet);
        if (!matchAfter && typeof onBoundary === 'function') {
          onBoundary({
            channel: 'P',
            detail: 'value_setter',
            epistemics: 'observed_at_boundary',
            matchAfterSet: false,
          });
        }
        return ret;
      } finally {
        recording = false;
      }
    }

    try {
      Object.defineProperty(el, 'value', {
        configurable: true,
        enumerable: false,
        get: diagnosticGet,
        set: diagnosticSet,
      });
    } catch (_defineErr) {
      return null;
    }

    handle.teardown = function () {
      if (closed) {
        return { ok: true, restoreFailed: false };
      }
      closed = true;
      handle.closed = true;
      try {
        if (!fwd.hadOwn) {
          delete el.value;
          var stillOwn = Object.getOwnPropertyDescriptor(el, 'value');
          if (stillOwn !== undefined) {
            return { ok: false, restoreFailed: true };
          }
          return { ok: true, restoreFailed: false };
        }
        Object.defineProperty(el, 'value', fwd.savedOwn);
        return { ok: true, restoreFailed: false };
      } catch (_teardownErr) {
        return { ok: false, restoreFailed: true };
      }
    };

    return handle;
  }

  function observePostRuntimeA24(bag, filledTrail, outcome) {
    void outcome;
    return new Promise(function (resolve) {
      if (!filledTrail || filledTrail.length === 0) {
        resolve(null);
        return;
      }

      var verifyEndMs = Date.now();
      var mode = A24_P_ENABLED === true ? 'P' : 'B';
      var pInstallFailures = 0;
      var settled = false;
      var fieldStates = [];
      var sharedTeardowns = [];

      function msSince() {
        return Date.now() - verifyEndMs;
      }

      function pushA24Stamp(row, fields) {
        pushStamp(
          bag,
          Object.assign(
            {
              fieldId: row.fieldId,
              locator: row.locator,
              stage: 'post_runtime_a24',
              exactOne: null,
              matchCount: null,
              managedEligible: null,
              heldConnected: null,
              heldEqualsCurrent: null,
              targetReplaced: null,
              expectedValueMatchHeld: null,
              expectedValueMatchCurrent: null,
              a24Mode: mode,
              msSinceVerifyEnd: msSince(),
            },
            fields || {},
          ),
        );
      }

      pushStamp(bag, {
        fieldId: null,
        locator: null,
        stage: 'post_runtime_a24_start',
        exactOne: null,
        matchCount: null,
        managedEligible: null,
        heldConnected: null,
        heldEqualsCurrent: null,
        targetReplaced: null,
        expectedValueMatchHeld: null,
        expectedValueMatchCurrent: null,
        a24Mode: mode,
        msSinceVerifyEnd: 0,
      });

      function finishAll(reason) {
        if (settled) {
          return;
        }
        settled = true;
        for (var t = 0; t < sharedTeardowns.length; t += 1) {
          try {
            sharedTeardowns[t]();
          } catch (_ignoreTeardown) {
            // fail-open
          }
        }
        for (var i = 0; i < fieldStates.length; i += 1) {
          var st = fieldStates[i];
          if (st.pHandle && typeof st.pHandle.teardown === 'function') {
            var tr = st.pHandle.teardown();
            if (tr && tr.restoreFailed) {
              pushA24Stamp(st.row, {
                channel: 'P',
                detail: 'wrap_restore_failed',
                epistemics: 'correlated_after_loss',
                wrapRestoreFailed: true,
              });
            }
          }
          if (!st.reported) {
            var matchHeld = expectedValueMatch(st.row.element, st.row.expected);
            var resolved = resolveExactOne(st.row.locator);
            pushA24Stamp(st.row, {
              channel: null,
              detail: reason || 'bound_elapsed',
              epistemics: 'idle_no_loss',
              firstLossSource: null,
              expectedValueMatchHeld: matchHeld,
              expectedValueMatchCurrent:
                resolved.element && st.row.expected != null
                  ? expectedValueMatch(resolved.element, st.row.expected)
                  : null,
              heldConnected:
                st.row.element && typeof st.row.element.isConnected === 'boolean'
                  ? st.row.element.isConnected
                  : null,
              heldEqualsCurrent:
                st.row.element && resolved.element
                  ? st.row.element === resolved.element
                  : null,
              targetReplaced:
                st.row.element && resolved.element
                  ? st.row.element !== resolved.element || st.row.element.isConnected === false
                  : false,
            });
            st.reported = true;
          }
        }
        resolve(null);
      }

      function reportLoss(st, channel, detail, epistemics) {
        if (st.reported || settled) {
          return;
        }
        st.reported = true;
        var resolved = resolveExactOne(st.row.locator);
        pushA24Stamp(st.row, {
          channel: channel,
          detail: detail,
          epistemics: epistemics,
          firstLossSource: {
            channel: channel,
            detail: detail,
            epistemics: epistemics,
          },
          expectedValueMatchHeld: expectedValueMatch(st.row.element, st.row.expected),
          expectedValueMatchCurrent:
            resolved.element && st.row.expected != null
              ? expectedValueMatch(resolved.element, st.row.expected)
              : false,
          heldConnected:
            st.row.element && typeof st.row.element.isConnected === 'boolean'
              ? st.row.element.isConnected
              : null,
          heldEqualsCurrent:
            st.row.element && resolved.element ? st.row.element === resolved.element : false,
          targetReplaced:
            !st.row.element ||
            st.row.element.isConnected === false ||
            (resolved.element ? st.row.element !== resolved.element : true),
        });
        var allDone = true;
        for (var j = 0; j < fieldStates.length; j += 1) {
          if (!fieldStates[j].reported) {
            allDone = false;
            break;
          }
        }
        if (allDone) {
          finishAll('all_fields_reported');
        }
      }

      function attachREL(st) {
        var el = st.row.element;
        var locator = st.row.locator;

        function onMaybeLoss(channel, detail, epistemics) {
          if (st.reported || settled) {
            return;
          }
          var matchHeld = expectedValueMatch(el, st.row.expected);
          var resolved = resolveExactOne(locator);
          var matchCurrent =
            resolved.element && st.row.expected != null
              ? expectedValueMatch(resolved.element, st.row.expected)
              : false;
          var replaced =
            !el ||
            el.isConnected === false ||
            (resolved.element ? el !== resolved.element : true);
          if (!matchHeld || !matchCurrent || replaced) {
            var epi = epistemics;
            if (channel === 'E' || channel === 'L') {
              if (matchHeld && matchCurrent && !replaced) {
                return;
              }
              if (!matchHeld || !matchCurrent || replaced) {
                epi = epi || 'correlated_after_loss';
                if (channel === 'R' || (replaced && channel !== 'E')) {
                  epi = 'observed_at_boundary';
                }
              }
            }
            if (channel === 'R') {
              epi = 'observed_at_boundary';
            }
            reportLoss(st, channel, detail, epi);
          }
        }

        // R — replacement / detach
        if (typeof MutationObserver === 'function' && el && el.parentNode) {
          try {
            var mo = new MutationObserver(function () {
              if (st.reported || settled) {
                return;
              }
              if (!el.isConnected) {
                onMaybeLoss('R', 'dom_detached', 'observed_at_boundary');
                return;
              }
              var cur = resolveExactOne(locator).element;
              if (cur && cur !== el) {
                onMaybeLoss('R', 'dom_replaced', 'observed_at_boundary');
              }
            });
            mo.observe(el.parentNode, { childList: true, subtree: true });
            sharedTeardowns.push(function () {
              try {
                mo.disconnect();
              } catch (_d) {
                // ignore
              }
            });
          } catch (_moErr) {
            // fail-open
          }
        }

        // E — passive events
        function makeEHandler(type) {
          return function () {
            if (st.reported || settled) {
              return;
            }
            var matchHeld = expectedValueMatch(el, st.row.expected);
            if (!matchHeld) {
              onMaybeLoss('E', 'event_' + type, 'correlated_after_loss');
            }
          };
        }
        if (el && typeof el.addEventListener === 'function') {
          var types = ['input', 'change'];
          for (var ti = 0; ti < types.length; ti += 1) {
            var typ = types[ti];
            var handler = makeEHandler(typ);
            try {
              el.addEventListener(typ, handler, { capture: true, passive: true });
              sharedTeardowns.push(function (target, ev, fn) {
                return function () {
                  try {
                    target.removeEventListener(ev, fn, true);
                  } catch (_r) {
                    // ignore
                  }
                };
              }(el, typ, handler));
            } catch (_evErr) {
              // fail-open
            }
          }
          if (el.form && typeof el.form.addEventListener === 'function') {
            var resetHandler = makeEHandler('reset');
            try {
              el.form.addEventListener('reset', resetHandler, { capture: true, passive: true });
              sharedTeardowns.push(function () {
                try {
                  el.form.removeEventListener('reset', resetHandler, true);
                } catch (_rr) {
                  // ignore
                }
              });
            } catch (_resetErr) {
              // fail-open
            }
          }
        }
      }

      // L — lifecycle (shared)
      function onLifecycle(type) {
        if (settled) {
          return;
        }
        for (var i = 0; i < fieldStates.length; i += 1) {
          var st = fieldStates[i];
          if (st.reported) {
            continue;
          }
          var matchHeld = expectedValueMatch(st.row.element, st.row.expected);
          if (!matchHeld) {
            reportLoss(st, 'L', 'lifecycle_' + type, 'correlated_after_loss');
          }
        }
        finishAll('lifecycle_' + type);
      }

      if (typeof root.addEventListener === 'function') {
        var lifeHandler = function (ev) {
          onLifecycle(ev && ev.type ? ev.type : 'pagehide');
        };
        try {
          root.addEventListener('pagehide', lifeHandler, true);
          sharedTeardowns.push(function () {
            try {
              root.removeEventListener('pagehide', lifeHandler, true);
            } catch (_l) {
              // ignore
            }
          });
        } catch (_lifeErr) {
          // fail-open
        }
      }

      for (var fi = 0; fi < filledTrail.length; fi += 1) {
        var row = filledTrail[fi];
        var st = {
          row: row,
          reported: false,
          pHandle: null,
        };
        fieldStates.push(st);

        if (A24_P_ENABLED === true) {
          st.pHandle = a24InstallP(row.element, row.expected, function (info) {
            reportLoss(st, info.channel, info.detail, info.epistemics);
          });
          if (!st.pHandle) {
            pInstallFailures += 1;
          }
        }

        attachREL(st);

        if (!st.pHandle) {
          // B — bounded rAF match loop for this field (P skipped/disabled)
          (function (state) {
            var start = Date.now();
            function frame() {
              if (settled || state.reported) {
                return;
              }
              if (!expectedValueMatch(state.row.element, state.row.expected)) {
                reportLoss(state, 'B', 'raf_match', 'observed_at_boundary');
                return;
              }
              if (Date.now() - start >= A24_BOUND_MS) {
                return;
              }
              var raf =
                typeof root.requestAnimationFrame === 'function'
                  ? root.requestAnimationFrame.bind(root)
                  : typeof requestAnimationFrame === 'function'
                    ? requestAnimationFrame
                    : function (cb) {
                        setTimeout(cb, 16);
                      };
              raf(frame);
            }
            var raf0 =
              typeof root.requestAnimationFrame === 'function'
                ? root.requestAnimationFrame.bind(root)
                : typeof requestAnimationFrame === 'function'
                  ? requestAnimationFrame
                  : function (cb) {
                      setTimeout(cb, 16);
                    };
            raf0(frame);
          })(st);
        }
      }

      if (A24_P_ENABLED === true && pInstallFailures > 0) {
        mode = pInstallFailures >= filledTrail.length ? 'B' : 'P_partial';
        pushStamp(bag, {
          fieldId: null,
          locator: null,
          stage: 'post_runtime_a24_mode',
          exactOne: null,
          matchCount: null,
          managedEligible: null,
          heldConnected: null,
          heldEqualsCurrent: null,
          targetReplaced: null,
          expectedValueMatchHeld: null,
          expectedValueMatchCurrent: null,
          a24Mode: mode,
          pInstallFailures: pInstallFailures,
          msSinceVerifyEnd: msSince(),
        });
      } else if (A24_P_ENABLED !== true) {
        pushStamp(bag, {
          fieldId: null,
          locator: null,
          stage: 'post_runtime_a24_mode',
          exactOne: null,
          matchCount: null,
          managedEligible: null,
          heldConnected: null,
          heldEqualsCurrent: null,
          targetReplaced: null,
          expectedValueMatchHeld: null,
          expectedValueMatchCurrent: null,
          a24Mode: 'B',
          pRejectedBySafetyGate: true,
          msSinceVerifyEnd: msSince(),
        });
      }

      setTimeout(function () {
        finishAll('bound_elapsed');
      }, A24_BOUND_MS);
    });
  }

  // Test hooks for N1–N9 (diagnostic-only; do not alter fill).
  root.__ManagedA24 = {
    resolveValueForward: a24ResolveValueForward,
    installP: a24InstallP,
    matchViaFwd: a24MatchViaFwd,
    setPEnabled: function (v) {
      A24_P_ENABLED = v === true;
    },
    isPEnabled: function () {
      return A24_P_ENABLED === true;
    },
    setBoundMs: function (ms) {
      if (typeof ms === 'number' && ms >= 0 && ms <= 5000) {
        A24_BOUND_MS = ms;
      }
    },
    getBoundMs: function () {
      return A24_BOUND_MS;
    },
    BOUND_MS_DEFAULT: 5000,
  };

  root.assessManagedTargetsReady = assessManagedTargetsReady;
  root.runManagedAutofill = runManagedAutofill;
})(typeof globalThis !== 'undefined' ? globalThis : window);
