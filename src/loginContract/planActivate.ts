/**
 * Phase 121.0 — atomic ACTIVATE planner.
 * Returns one metadata patch (all keys together) or fail — previous ACTIVE unchanged.
 * No SPECIAL runtime execution.
 */

import {
  AUTOFILL_PROFILE_META_KEY,
  parseAutofillProfile,
  planAutofillProfileWrite,
  serializeAutofillProfile,
  type AutofillProfile,
  type AutofillProfileAction,
  type PlanAutofillProfileWriteInput,
} from '../autofill/validatedProfile';
import {
  LOGIN_CONTRACT_ACTIVATION_META_KEY,
  LOGIN_FLOW_PLAN_META_KEY,
} from './constants';
import {
  deepClonePlanDocument,
  parseLoginFlowPlanDocument,
  readLoginContractActivationFromMetadata,
  readLoginFlowPlanFromMetadata,
  serializeLoginContractActivation,
  serializeLoginFlowPlanBag,
} from './parse';
import { resolveActiveLoginContract } from './resolve';
import type {
  LoginContractActivateTransition,
  LoginContractActivation,
  LoginFlowPlanBag,
  LoginFlowPlanDocument,
} from './types';
import {
  LOGIN_CONTRACT_VALIDATE_ERROR,
  validateSpecialPlanComplete,
} from './validateSpecialPlan';

export const LOGIN_CONTRACT_ACTIVATE_ERROR = {
  ...LOGIN_CONTRACT_VALIDATE_ERROR,
  unknownTransition: 'מעבר הפעלת חוזה כניסה אינו מוכר.',
  wrongCurrentMode: 'מצב החוזה הפעיל אינו תואם למעבר המבוקש.',
  missingDraft: 'אין טיוטת תוכנית מיוחדת להפעלה.',
  versionBumpRequired: 'הפעלת SPECIAL חוזרת דורשת מספר גרסת תוכנית גבוה יותר.',
  forbiddenMixedState: 'מצב מעורב אסור של מפעיל חוזה ותוכנית זרימה.',
  standardActivateFailed: 'הפעלת חוזה STANDARD נכשלה בבדיקת Phase 120.',
  specialContentMustNotTouchAutofillMappings:
    'הפעלת SPECIAL אינה כותבת מיפויים לתוך autofillProfile.fieldMappings.',
} as const;

export type LoginContractActivateErrorCode = keyof typeof LOGIN_CONTRACT_ACTIVATE_ERROR;

export type LoginContractActivateIntent =
  | {
      transition: 'STANDARD_TO_STANDARD';
      /** Phase 120 activate/save input — reused unchanged. */
      autofill: Omit<PlanAutofillProfileWriteInput, 'previous'> & {
        previous?: AutofillProfile | null;
      };
    }
  | {
      transition: 'STANDARD_TO_SPECIAL';
      /** Defaults to current loginFlowPlan.draft */
      draft?: LoginFlowPlanDocument | null;
      /** Optional explicit version; otherwise assigned (draft.planVersion or 1). */
      planVersion?: number;
    }
  | {
      transition: 'SPECIAL_TO_SPECIAL';
      draft?: LoginFlowPlanDocument | null;
      /** Must be > current active.planVersion when provided; else auto-bump. */
      planVersion?: number;
    }
  | {
      transition: 'SPECIAL_TO_STANDARD';
      autofill: Omit<PlanAutofillProfileWriteInput, 'previous'> & {
        previous?: AutofillProfile | null;
      };
    };

export type LoginContractActivatePlan =
  | {
      ok: true;
      transition: LoginContractActivateTransition;
      /** Atomic metadata fields to write in a single registry update. */
      metadataPatch: Record<string, unknown>;
      nextActivation: LoginContractActivation;
      nextPlanBag: LoginFlowPlanBag | null;
      nextAutofillProfile: AutofillProfile | null | undefined;
    }
  | {
      ok: false;
      code: LoginContractActivateErrorCode;
      message: string;
    };

function fail(code: LoginContractActivateErrorCode): LoginContractActivatePlan {
  return {
    ok: false,
    code,
    message: LOGIN_CONTRACT_ACTIVATE_ERROR[code],
  };
}

function currentModeFromMetadata(metadata: unknown): 'STANDARD' | 'SPECIAL' | 'CORRUPT' {
  const resolved = resolveActiveLoginContract(metadata);
  if (resolved.mode === 'SPECIAL_INVALID') {
    // SPECIAL_INVALID from corrupt activation is CORRUPT; missing active while mode SPECIAL
    // still counts as SPECIAL for transition gating (must repair via SPECIAL_TO_* or fail).
    const raw = readLoginContractActivationFromMetadata(metadata);
    if (raw === 'CORRUPT_SPECIAL') return 'CORRUPT';
    if (raw && raw.mode === 'SPECIAL') return 'SPECIAL';
    return 'CORRUPT';
  }
  return resolved.mode;
}

function assignSpecialActive(
  draft: LoginFlowPlanDocument,
  planVersion: number,
): LoginFlowPlanDocument {
  const next = deepClonePlanDocument(draft);
  next.planVersion = planVersion;
  return next;
}

/**
 * Plan an atomic ACTIVATE. On failure, callers must not write — previous ACTIVE unchanged.
 */
export function planLoginContractActivate(input: {
  currentMetadata: Record<string, unknown> | null | undefined;
  intent: LoginContractActivateIntent;
}): LoginContractActivatePlan {
  const currentMetadata = input.currentMetadata ?? {};
  const currentActivation = readLoginContractActivationFromMetadata(currentMetadata);
  const currentPlanBag = readLoginFlowPlanFromMetadata(currentMetadata) ?? {
    draft: null,
    active: null,
  };
  const mode = currentModeFromMetadata(currentMetadata);

  if (mode === 'CORRUPT' && input.intent.transition !== 'SPECIAL_TO_STANDARD') {
    // Allow recovery to STANDARD; other transitions reject corrupt SPECIAL.
    if (
      input.intent.transition === 'STANDARD_TO_STANDARD' ||
      input.intent.transition === 'STANDARD_TO_SPECIAL'
    ) {
      return fail('forbiddenMixedState');
    }
  }

  switch (input.intent.transition) {
    case 'STANDARD_TO_STANDARD': {
      if (mode === 'SPECIAL') {
        return fail('wrongCurrentMode');
      }
      const previousProfile =
        input.intent.autofill.previous !== undefined
          ? input.intent.autofill.previous
          : parseAutofillProfile(currentMetadata[AUTOFILL_PROFILE_META_KEY]);
      const planned = planAutofillProfileWrite({
        ...input.intent.autofill,
        previous: previousProfile,
        action: (input.intent.autofill.action ?? 'activate_validated') as AutofillProfileAction,
      });
      if (!planned.ok) {
        return fail('standardActivateFailed');
      }
      const nextActivation: LoginContractActivation = { mode: 'STANDARD' };
      // Do not create loginFlowPlan.active. Keep existing bag if present (draft only).
      const nextPlanBag: LoginFlowPlanBag | null =
        currentPlanBag.draft || currentPlanBag.active
          ? {
              draft: currentPlanBag.draft,
              active: null, // STANDARD must not retain SPECIAL active authority
            }
          : null;

      const metadataPatch: Record<string, unknown> = {
        [AUTOFILL_PROFILE_META_KEY]: serializeAutofillProfile(planned.profile),
        [LOGIN_CONTRACT_ACTIVATION_META_KEY]: serializeLoginContractActivation(nextActivation),
      };
      if (nextPlanBag) {
        metadataPatch[LOGIN_FLOW_PLAN_META_KEY] = serializeLoginFlowPlanBag(nextPlanBag);
      }
      // If no plan bag existed, do not invent loginFlowPlan key.
      return {
        ok: true,
        transition: 'STANDARD_TO_STANDARD',
        metadataPatch,
        nextActivation,
        nextPlanBag,
        nextAutofillProfile: planned.profile,
      };
    }

    case 'STANDARD_TO_SPECIAL': {
      if (mode === 'SPECIAL') {
        return fail('wrongCurrentMode');
      }
      const draftSource =
        input.intent.draft !== undefined ? input.intent.draft : currentPlanBag.draft;
      if (!draftSource) {
        return fail('missingDraft');
      }
      const parsed = parseLoginFlowPlanDocument(
        deepClonePlanDocument(draftSource),
      );
      if (!parsed) {
        return fail('corruptPlan');
      }
      const complete = validateSpecialPlanComplete(parsed);
      if (!complete.ok) {
        return fail(complete.code);
      }
      const V =
        typeof input.intent.planVersion === 'number' && input.intent.planVersion >= 1
          ? input.intent.planVersion
          : parsed.planVersion >= 1
            ? parsed.planVersion
            : 1;
      const activeDoc = assignSpecialActive(parsed, V);
      const nextActivation: LoginContractActivation = {
        mode: 'SPECIAL',
        activePlanVersion: V,
      };
      // DD default: keep draft copy unless Admin clears.
      const nextPlanBag: LoginFlowPlanBag = {
        draft: currentPlanBag.draft ? deepClonePlanDocument(currentPlanBag.draft) : deepClonePlanDocument(parsed),
        active: activeDoc,
      };
      const metadataPatch: Record<string, unknown> = {
        [LOGIN_CONTRACT_ACTIVATION_META_KEY]: serializeLoginContractActivation(nextActivation),
        [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag(nextPlanBag),
      };
      // AC-121.0-8: do NOT write SPECIAL mappings into autofillProfile.
      return {
        ok: true,
        transition: 'STANDARD_TO_SPECIAL',
        metadataPatch,
        nextActivation,
        nextPlanBag,
        nextAutofillProfile: undefined,
      };
    }

    case 'SPECIAL_TO_SPECIAL': {
      if (mode !== 'SPECIAL') {
        return fail('wrongCurrentMode');
      }
      const currentActive = currentPlanBag.active;
      if (!currentActive) {
        return fail('forbiddenMixedState');
      }
      if (
        currentActivation !== 'CORRUPT_SPECIAL' &&
        currentActivation &&
        currentActivation.mode === 'SPECIAL' &&
        currentActivation.activePlanVersion !== currentActive.planVersion
      ) {
        return fail('forbiddenMixedState');
      }
      const draftSource =
        input.intent.draft !== undefined ? input.intent.draft : currentPlanBag.draft;
      if (!draftSource) {
        return fail('missingDraft');
      }
      const parsed = parseLoginFlowPlanDocument(deepClonePlanDocument(draftSource));
      if (!parsed) {
        return fail('corruptPlan');
      }
      const complete = validateSpecialPlanComplete(parsed);
      if (!complete.ok) {
        return fail(complete.code);
      }
      const currentV = currentActive.planVersion;
      const requested = input.intent.planVersion;
      const nextV =
        typeof requested === 'number' && requested > currentV
          ? requested
          : currentV + 1;
      if (nextV <= currentV) {
        return fail('versionBumpRequired');
      }
      const activeDoc = assignSpecialActive(parsed, nextV);
      const nextActivation: LoginContractActivation = {
        mode: 'SPECIAL',
        activePlanVersion: nextV,
      };
      const nextPlanBag: LoginFlowPlanBag = {
        draft: currentPlanBag.draft
          ? deepClonePlanDocument(currentPlanBag.draft)
          : deepClonePlanDocument(parsed),
        active: activeDoc,
      };
      return {
        ok: true,
        transition: 'SPECIAL_TO_SPECIAL',
        metadataPatch: {
          [LOGIN_CONTRACT_ACTIVATION_META_KEY]: serializeLoginContractActivation(nextActivation),
          [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag(nextPlanBag),
        },
        nextActivation,
        nextPlanBag,
        nextAutofillProfile: undefined,
      };
    }

    case 'SPECIAL_TO_STANDARD': {
      if (mode !== 'SPECIAL' && mode !== 'CORRUPT') {
        return fail('wrongCurrentMode');
      }
      const previousProfile =
        input.intent.autofill.previous !== undefined
          ? input.intent.autofill.previous
          : parseAutofillProfile(currentMetadata[AUTOFILL_PROFILE_META_KEY]);
      const planned = planAutofillProfileWrite({
        ...input.intent.autofill,
        previous: previousProfile,
        action: (input.intent.autofill.action ?? 'activate_validated') as AutofillProfileAction,
      });
      if (!planned.ok) {
        return fail('standardActivateFailed');
      }
      const nextActivation: LoginContractActivation = { mode: 'STANDARD' };
      const nextPlanBag: LoginFlowPlanBag = {
        draft: currentPlanBag.draft,
        active: null,
      };
      return {
        ok: true,
        transition: 'SPECIAL_TO_STANDARD',
        metadataPatch: {
          [AUTOFILL_PROFILE_META_KEY]: serializeAutofillProfile(planned.profile),
          [LOGIN_CONTRACT_ACTIVATION_META_KEY]: serializeLoginContractActivation(nextActivation),
          [LOGIN_FLOW_PLAN_META_KEY]: serializeLoginFlowPlanBag(nextPlanBag),
        },
        nextActivation,
        nextPlanBag,
        nextAutofillProfile: planned.profile,
      };
    }

    default:
      return fail('unknownTransition');
  }
}

/**
 * Reject forbidden mixed states for a proposed metadata bag (post-merge check).
 */
export function assertLoginContractMetadataConsistent(
  metadata: Record<string, unknown>,
): { ok: true } | { ok: false; code: 'forbiddenMixedState'; message: string } {
  const activation = readLoginContractActivationFromMetadata(metadata);
  const planBag = readLoginFlowPlanFromMetadata(metadata);

  if (activation === 'CORRUPT_SPECIAL') {
    return {
      ok: false,
      code: 'forbiddenMixedState',
      message: LOGIN_CONTRACT_ACTIVATE_ERROR.forbiddenMixedState,
    };
  }

  if (activation && activation.mode === 'SPECIAL') {
    if (!planBag?.active) {
      return {
        ok: false,
        code: 'forbiddenMixedState',
        message: LOGIN_CONTRACT_ACTIVATE_ERROR.forbiddenMixedState,
      };
    }
    if (planBag.active.planVersion !== activation.activePlanVersion) {
      return {
        ok: false,
        code: 'forbiddenMixedState',
        message: LOGIN_CONTRACT_ACTIVATE_ERROR.forbiddenMixedState,
      };
    }
  }

  if (
    (activation === null || activation.mode === 'STANDARD') &&
    planBag?.active
  ) {
    // mode=STANDARD (or missing≡STANDARD) must not retain SPECIAL active authority
    return {
      ok: false,
      code: 'forbiddenMixedState',
      message: LOGIN_CONTRACT_ACTIVATE_ERROR.forbiddenMixedState,
    };
  }

  return { ok: true };
}
