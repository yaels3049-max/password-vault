/**
 * Phase 120.9 — locator determinism gate (exact-one + same observed target).
 * Hub uses inspect matchCount evidence; Extension uses live assertLocatorDeterministic.
 */

import type { LocatorCandidate, SafePageInput } from './types';

/**
 * Inspect-backed exact-one gate (same semantics as Extension assertLocatorDeterministic
 * when candidates were built from the observed input in the same top document).
 *
 * PASS iff the locator is a CSS candidate for the observed input with matchCount === 1.
 */
export function assertLocatorDeterministic(
  locator: string,
  observedInput: SafePageInput,
): boolean {
  const trimmed = locator.trim();
  if (!trimmed) {
    return false;
  }
  const candidate = observedInput.locatorCandidates.find(
    (c) => c.strategy === 'css' && c.locator.trim() === trimmed,
  );
  if (!candidate) {
    return false;
  }
  return candidate.matchCount === 1;
}

/**
 * D-121-54 — Hub twin of the Extension `preferExactOneLocator` (Visual choose):
 * walk the observed input's candidates in order, return the first CSS locator
 * whose inspect matchCount is exactly one. Candidates of other inputs are never read.
 */
export function preferExactOneCandidate(observedInput: SafePageInput): string | null {
  for (const candidate of observedInput.locatorCandidates) {
    const locator = candidate.locator.trim();
    if (!locator) continue;
    if (locatorCandidateIsDeterministic(candidate)) return locator;
  }
  return null;
}

/** True when a LocatorCandidate carries proven exact-one matchCount. */
export function locatorCandidateIsDeterministic(candidate: LocatorCandidate): boolean {
  return candidate.strategy === 'css' && candidate.matchCount === 1;
}
