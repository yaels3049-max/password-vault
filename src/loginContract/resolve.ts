/**
 * Phase 121.0 — resolve ACTIVE login contract (read helper for tests/planner).
 * Do NOT wire Digital Home or Admin Test SPECIAL execution yet.
 */

import {
  parseLoginContractActivation,
  readLoginContractActivationFromMetadata,
  readLoginFlowPlanFromMetadata,
} from './parse';
import type { ResolvedActiveLoginContract } from './types';

/**
 * Resolve ACTIVE login contract from service_registry.metadata.
 *
 * Rules (DD §4.6):
 * - missing/null activation → STANDARD
 * - mode STANDARD → STANDARD (ignore loginFlowPlan.active for routing)
 * - mode SPECIAL → require active + matching activePlanVersion else SPECIAL_INVALID
 * - corrupt SPECIAL discriminator → SPECIAL_INVALID (fail closed; no STANDARD fallback)
 */
export function resolveActiveLoginContract(metadata: unknown): ResolvedActiveLoginContract {
  const activationRaw = readLoginContractActivationFromMetadata(metadata);
  if (activationRaw === 'CORRUPT_SPECIAL') {
    return {
      mode: 'SPECIAL_INVALID',
      reason: 'corrupt_special_activation',
    };
  }
  if (activationRaw === null || activationRaw.mode === 'STANDARD') {
    return { mode: 'STANDARD' };
  }

  const planBag = readLoginFlowPlanFromMetadata(metadata);
  if (!planBag) {
    return { mode: 'SPECIAL_INVALID', reason: 'corrupt_login_flow_plan' };
  }
  const active = planBag.active;
  if (!active) {
    return { mode: 'SPECIAL_INVALID', reason: 'missing_active_plan' };
  }
  if (active.planVersion !== activationRaw.activePlanVersion) {
    return { mode: 'SPECIAL_INVALID', reason: 'active_plan_version_mismatch' };
  }
  return {
    mode: 'SPECIAL',
    plan: active,
    activePlanVersion: activationRaw.activePlanVersion,
  };
}

/** Convenience: parse activation alone (missing → null ≡ STANDARD at resolve). */
export function peekLoginContractActivationMode(
  metadata: unknown,
): 'STANDARD' | 'SPECIAL' | 'CORRUPT_SPECIAL' {
  const parsed = readLoginContractActivationFromMetadata(metadata);
  if (parsed === 'CORRUPT_SPECIAL') return 'CORRUPT_SPECIAL';
  if (parsed === null) return 'STANDARD';
  return parsed.mode;
}

export { parseLoginContractActivation };
