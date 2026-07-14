import type { LoginComplexity, LoginIntelligence } from './types';
import { readLoginIntelligence } from './readWrite';

/**
 * Resolve effective LI for execution (D-112-3):
 * admin override / lastValidatedBy=admin wins over auto.
 */
export function resolveLoginIntelligenceForExecution(
  metadata: Record<string, unknown> | null | undefined,
): LoginIntelligence | null {
  return readLoginIntelligence(metadata);
}

export function complexityForExecution(li: LoginIntelligence | null): LoginComplexity {
  return li?.loginComplexity ?? 'unknown';
}
