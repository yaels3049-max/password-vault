/**
 * Phase 121.1 D-121-33 (§4.14) — outgoing metadata of writers that do not own the login contract.
 *
 * `updateGlobalRegistryRow` / `updateUserOwnedRegistryRow` / `createGlobalRegistryRow` lay the
 * patch over the stored row, so a key that is absent here keeps its stored value. Re-sending a
 * stored `loginFlowPlan` bag (it carries `active`, even null) or a SPECIAL activation is treated
 * by the strict merge guard as an activation bypass, so these writers must never send them.
 *
 * Only for writers whose destination merges with the stored metadata. A direct whole-row
 * `metadata` update would delete the keys instead.
 */
import {
  LOGIN_CONTRACT_ACTIVATE_INTENT_KEY,
  LOGIN_CONTRACT_ACTIVATION_META_KEY,
  LOGIN_FLOW_PLAN_META_KEY,
} from '../loginContract';
import {
  AUTOFILL_LIVE_VALIDATION_APPROVED_KEY,
  AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY,
  AUTOFILL_PROFILE_ACTION_KEY,
  AUTOFILL_PROFILE_META_KEY,
} from '../autofill/validatedProfile';

export const LOGIN_CONTRACT_OWNED_KEYS = [
  LOGIN_CONTRACT_ACTIVATION_META_KEY,
  LOGIN_FLOW_PLAN_META_KEY,
  LOGIN_CONTRACT_ACTIVATE_INTENT_KEY,
] as const;

/** The STANDARD mapping and its write-control keys; only the regular grid writes them. */
export const AUTOFILL_OWNED_KEYS = [
  AUTOFILL_PROFILE_META_KEY,
  AUTOFILL_PROFILE_ACTION_KEY,
  AUTOFILL_LIVE_VALIDATION_APPROVED_KEY,
  AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY,
] as const;

/**
 * D-121-64 / D-121-65: SPECIAL-editor writes and service-form edits never send autofillProfile
 * (or its control keys), so the stored value is kept as is and the registry write does not
 * re-plan it against the current login fields.
 */
export function withoutAutofillProfile(metadata: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...metadata };
  for (const key of AUTOFILL_OWNED_KEYS) {
    delete next[key];
  }
  return next;
}

export function withoutLoginContractKeys(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(metadata ?? {}) };
  for (const key of LOGIN_CONTRACT_OWNED_KEYS) {
    delete next[key];
  }
  return next;
}
