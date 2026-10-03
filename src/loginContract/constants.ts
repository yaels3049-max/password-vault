/** Phase 121.0 — exact persist keys (siblings of autofillProfile). */

export const LOGIN_CONTRACT_ACTIVATION_META_KEY = 'loginContractActivation';
export const LOGIN_FLOW_PLAN_META_KEY = 'loginFlowPlan';

/**
 * Hub control key: when present on a registry metadata patch, run
 * `planLoginContractActivate` and apply its atomic metadata write.
 * Stripped before persist (never stored).
 */
export const LOGIN_CONTRACT_ACTIVATE_INTENT_KEY = 'loginContractActivateIntent';
