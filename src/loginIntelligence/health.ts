import type { AutofillHealthCode } from '../execution/autofillEligibility';
import type { IntegrationHealth, LoginComplexity, LoginIntelligence } from './types';

export type FillOutcomeKind =
  | 'fill_ok'
  | 'fill_failed'
  | 'not_standard_login'
  | 'open_only'
  | 'detection_failed'
  | 'transient_detection_failed';

/**
 * Map detect/fill outcomes → integration health (AC-112-8, AC-112-22).
 * Never produce user-facing raw engine stacks here.
 */
export function mapOutcomeToIntegrationHealth(input: {
  complexity: LoginComplexity;
  fillOutcome?: FillOutcomeKind | AutofillHealthCode | null;
  adapterRecommended?: boolean;
}): IntegrationHealth {
  if (input.adapterRecommended || input.complexity === 'complex') {
    return 'adapter_required';
  }

  switch (input.fillOutcome) {
    case 'fill_ok':
      return 'healthy';
    case 'fill_failed':
      return 'degraded';
    case 'not_standard_login':
      return input.complexity === 'medium' ? 'degraded' : 'needs_review';
    case 'detection_failed':
      return 'needs_review';
    case 'transient_detection_failed':
      return 'degraded';
    case 'open_only':
      return input.complexity === 'basic' ? 'healthy' : 'needs_review';
    default:
      if (input.complexity === 'basic') return 'healthy';
      if (input.complexity === 'medium') return 'degraded';
      if (input.complexity === 'unknown') return 'needs_review';
      return 'needs_review';
  }
}

export function applyHealthToIntelligence(
  li: LoginIntelligence,
  fillOutcome?: FillOutcomeKind | AutofillHealthCode | null,
): LoginIntelligence {
  return {
    ...li,
    integrationHealth: mapOutcomeToIntegrationHealth({
      complexity: li.loginComplexity,
      fillOutcome,
      adapterRecommended: li.adapterRecommended,
    }),
  };
}

/** Transient failures may retry once; permanent wait for admin/manual (AC-112-23). */
export const DETECTION_RETRY_POLICY = {
  maxTransientRetries: 1,
  retryDelayMs: 400,
} as const;
