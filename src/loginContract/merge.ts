/**
 * Phase 121.0 — merge login contract keys into registry metadata (atomic).
 * Does not execute SPECIAL flows. Phase 120 autofill merge remains separate/first.
 *
 * Non-intent / draft-authoring path:
 * - MAY write loginFlowPlan.draft (existing active unchanged)
 * - MUST NOT write loginContractActivation mode=SPECIAL
 * - MUST NOT write / replace loginFlowPlan.active
 * ACTIVE SPECIAL (discriminator + active) ONLY via loginContractActivateIntent → planner.
 */

import {
  LOGIN_CONTRACT_ACTIVATE_INTENT_KEY,
  LOGIN_CONTRACT_ACTIVATION_META_KEY,
  LOGIN_FLOW_PLAN_META_KEY,
} from './constants';
import {
  parseLoginFlowPlanDocument,
  readLoginFlowPlanFromMetadata,
  serializeLoginFlowPlanBag,
  serializeLoginContractActivation,
  parseLoginContractActivation,
} from './parse';
import {
  assertLoginContractMetadataConsistent,
  planLoginContractActivate,
  type LoginContractActivateIntent,
} from './planActivate';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isActivateIntent(value: unknown): value is LoginContractActivateIntent {
  if (!isRecord(value)) return false;
  return (
    value.transition === 'STANDARD_TO_STANDARD' ||
    value.transition === 'STANDARD_TO_SPECIAL' ||
    value.transition === 'SPECIAL_TO_SPECIAL' ||
    value.transition === 'SPECIAL_TO_STANDARD'
  );
}

export const LOGIN_CONTRACT_MERGE_ERROR = {
  unknownTransition: 'מעבר הפעלת חוזה כניסה אינו מוכר.',
  corruptPlan: 'תוכנית זרימת הכניסה פגומה או לא ניתנת לפירוש.',
  forbiddenMixedState: 'מצב מעורב אסור של מפעיל חוזה ותוכנית זרימה.',
  activateRequiresIntent:
    'הפעלת חוזה SPECIAL (מפעיל + תוכנית פעילה) מותרת רק דרך loginContractActivateIntent.',
} as const;

export function stripLoginContractControlKeys(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...metadata };
  delete next[LOGIN_CONTRACT_ACTIVATE_INTENT_KEY];
  return next;
}

/**
 * Apply Phase 121.0 login-contract metadata changes atomically.
 *
 * - If `loginContractActivateIntent` present → planner result (single write).
 * - Else draft-authoring only: may update draft; must not set SPECIAL activation or active.
 * - If neither key present → no-op.
 */
export function mergeLoginContractMetadata(input: {
  existingMetadata: Record<string, unknown> | null | undefined;
  patchMetadata: Record<string, unknown>;
}):
  | { ok: true; metadata: Record<string, unknown> }
  | { ok: false; message: string; code: string } {
  const existing = input.existingMetadata ?? {};
  const patch = input.patchMetadata;
  const hasIntent = Object.prototype.hasOwnProperty.call(
    patch,
    LOGIN_CONTRACT_ACTIVATE_INTENT_KEY,
  );
  const hasActivation = Object.prototype.hasOwnProperty.call(
    patch,
    LOGIN_CONTRACT_ACTIVATION_META_KEY,
  );
  const hasPlan = Object.prototype.hasOwnProperty.call(patch, LOGIN_FLOW_PLAN_META_KEY);

  if (!hasIntent && !hasActivation && !hasPlan) {
    return { ok: true, metadata: { ...existing, ...patch } };
  }

  if (hasIntent) {
    const intentRaw = patch[LOGIN_CONTRACT_ACTIVATE_INTENT_KEY];
    if (!isActivateIntent(intentRaw)) {
      return {
        ok: false,
        code: 'unknownTransition',
        message: LOGIN_CONTRACT_MERGE_ERROR.unknownTransition,
      };
    }
    const planned = planLoginContractActivate({
      currentMetadata: existing,
      intent: intentRaw,
    });
    if (!planned.ok) {
      return { ok: false, code: String(planned.code), message: planned.message };
    }
    const merged = stripLoginContractControlKeys({
      ...existing,
      ...patch,
      ...planned.metadataPatch,
    });
    const consistent = assertLoginContractMetadataConsistent(merged);
    if (!consistent.ok) {
      return consistent;
    }
    return { ok: true, metadata: merged };
  }

  // --- Non-intent / draft-authoring path ---
  // Reject ACTIVE SPECIAL bypass: SPECIAL activation and/or active plan writes.
  if (hasActivation) {
    const parsedAct = parseLoginContractActivation(patch[LOGIN_CONTRACT_ACTIVATION_META_KEY]);
    if (parsedAct === 'CORRUPT_SPECIAL' || (parsedAct !== null && parsedAct.mode === 'SPECIAL')) {
      return {
        ok: false,
        code: 'activateRequiresIntent',
        message: LOGIN_CONTRACT_MERGE_ERROR.activateRequiresIntent,
      };
    }
  }

  if (hasPlan) {
    const planRaw = patch[LOGIN_FLOW_PLAN_META_KEY];
    if (!isRecord(planRaw) && planRaw !== null) {
      return {
        ok: false,
        code: 'corruptPlan',
        message: LOGIN_CONTRACT_MERGE_ERROR.corruptPlan,
      };
    }
    if (isRecord(planRaw) && Object.prototype.hasOwnProperty.call(planRaw, 'active')) {
      // Writing or replacing loginFlowPlan.active is ACTIVATE-only.
      return {
        ok: false,
        code: 'activateRequiresIntent',
        message: LOGIN_CONTRACT_MERGE_ERROR.activateRequiresIntent,
      };
    }
  }

  const existingPlan = readLoginFlowPlanFromMetadata(existing) ?? {
    draft: null,
    active: null,
  };

  const merged = stripLoginContractControlKeys({
    ...existing,
    ...patch,
  });

  if (hasPlan) {
    const planRaw = patch[LOGIN_FLOW_PLAN_META_KEY];
    if (planRaw === null) {
      // Clearing the whole bag without intent is not draft-authoring; reject active retirement.
      return {
        ok: false,
        code: 'activateRequiresIntent',
        message: LOGIN_CONTRACT_MERGE_ERROR.activateRequiresIntent,
      };
    }
    if (!isRecord(planRaw)) {
      return {
        ok: false,
        code: 'corruptPlan',
        message: LOGIN_CONTRACT_MERGE_ERROR.corruptPlan,
      };
    }
    let nextDraft = existingPlan.draft;
    if (Object.prototype.hasOwnProperty.call(planRaw, 'draft')) {
      if (planRaw.draft === null) {
        nextDraft = null;
      } else {
        const parsedDraft = parseLoginFlowPlanDocument(planRaw.draft);
        if (!parsedDraft) {
          return {
            ok: false,
            code: 'corruptPlan',
            message: LOGIN_CONTRACT_MERGE_ERROR.corruptPlan,
          };
        }
        nextDraft = parsedDraft;
      }
    }
    // Preserve existing active unchanged (draft authoring only).
    merged[LOGIN_FLOW_PLAN_META_KEY] = serializeLoginFlowPlanBag({
      draft: nextDraft,
      active: existingPlan.active,
    });
  }

  if (hasActivation) {
    const parsedAct = parseLoginContractActivation(patch[LOGIN_CONTRACT_ACTIVATION_META_KEY]);
    // SPECIAL / CORRUPT already rejected above; allow STANDARD or omit/null (missing≡STANDARD).
    if (parsedAct === null) {
      if (patch[LOGIN_CONTRACT_ACTIVATION_META_KEY] == null) {
        delete merged[LOGIN_CONTRACT_ACTIVATION_META_KEY];
      } else {
        merged[LOGIN_CONTRACT_ACTIVATION_META_KEY] = serializeLoginContractActivation({
          mode: 'STANDARD',
        });
      }
    } else if (parsedAct !== 'CORRUPT_SPECIAL' && parsedAct.mode === 'STANDARD') {
      merged[LOGIN_CONTRACT_ACTIVATION_META_KEY] = serializeLoginContractActivation(parsedAct);
    }
  }

  const consistent = assertLoginContractMetadataConsistent(merged);
  if (!consistent.ok) {
    return consistent;
  }
  return { ok: true, metadata: merged };
}
