/**
 * Phase 120.9 — shared locator determinism (exact-one + same target element).
 * Same semantics for Visual choose and Analyze inspect evidence.
 * Loaded into page MAIN world for Admin authoring only.
 */
(function initLocatorDeterminism(global) {
  /**
   * PASS iff locator resolves to exactly one node and that node is observedEl.
   * @param {string} locator
   * @param {Element} observedEl
   * @param {Document} doc
   * @returns {boolean}
   */
  function assertLocatorDeterministic(locator, observedEl, doc) {
    if (!locator || !observedEl || !doc || typeof doc.querySelectorAll !== 'function') {
      return false;
    }
    var matches;
    try {
      matches = doc.querySelectorAll(locator);
    } catch (err) {
      return false;
    }
    return Boolean(matches && matches.length === 1 && matches[0] === observedEl);
  }

  /**
   * Count matches for a CSS locator in doc (0 on invalid selector).
   * @param {string} locator
   * @param {Document} doc
   * @returns {number}
   */
  function countLocatorMatches(locator, doc) {
    if (!locator || !doc || typeof doc.querySelectorAll !== 'function') {
      return 0;
    }
    try {
      return doc.querySelectorAll(locator).length;
    } catch (err) {
      return 0;
    }
  }

  /**
   * First candidate with querySelectorAll.length === 1 (exact-one choose).
   * Callers that require same-target must also run assertLocatorDeterministic.
   * @param {Array<{locator: string, stabilityHint?: string}>} candidates
   * @param {Document} doc
   * @returns {{locator: string, locatorType: string, stabilityHint: *, locatorCandidates: *} | null}
   */
  function preferExactOneLocator(candidates, doc) {
    if (!Array.isArray(candidates) || !doc) {
      return null;
    }
    for (var i = 0; i < candidates.length; i += 1) {
      var locator = candidates[i].locator;
      if (!locator) continue;
      var matches;
      try {
        matches = doc.querySelectorAll(locator);
      } catch (err) {
        continue;
      }
      if (matches && matches.length === 1) {
        return {
          locator: locator,
          locatorType: 'css',
          stabilityHint: candidates[i].stabilityHint,
          locatorCandidates: candidates,
        };
      }
    }
    return null;
  }

  global.LocatorDeterminism = {
    assertLocatorDeterministic: assertLocatorDeterministic,
    countLocatorMatches: countLocatorMatches,
    preferExactOneLocator: preferExactOneLocator,
  };
})(typeof window !== 'undefined' ? window : globalThis);
