/**
 * D-121-43 — shared status line derived from the saved row (never from unsaved edits).
 * SPECIAL keeps users on the approved plan until the next approval; STANDARD stops
 * users when an approved mapping is changed (supportState → unsupported), so a
 * changed STANDARD mapping reads «נשמר — עדיין לא אושר למשתמשים».
 */
import {
  isVersionMatchedValidated,
  readAutofillProfileFromMetadata,
} from '../autofill/validatedProfile';
import {
  isSpecialLoginPattern,
  normalizeLegacyDraftReadiness,
  readLoginFlowPlanFromMetadata,
  resolveActiveLoginContract,
  serializeLoginFlowPlanDocument,
  type LoginFlowPlanDocument,
} from '../loginContract';
import type { AdminMappingStatus } from './mappingCopy';

/** Approval copies the saved plan and assigns planVersion; compare everything else. */
export function planContentKey(plan: LoginFlowPlanDocument): string {
  const serialized = serializeLoginFlowPlanDocument(normalizeLegacyDraftReadiness(plan));
  return JSON.stringify({ ...serialized, planVersion: 0 });
}

export function specialMappingStatus(metadata: unknown): AdminMappingStatus | null {
  const saved = readLoginFlowPlanFromMetadata(metadata ?? {})?.draft ?? null;
  if (!saved || !isSpecialLoginPattern(saved.pattern)) return null;
  const live = resolveActiveLoginContract(metadata ?? {});
  if (live.mode !== 'SPECIAL') return 'saved_not_approved';
  return planContentKey(saved) === planContentKey(live.plan) ? 'approved' : 'changes_not_approved';
}

export function standardMappingStatus(metadata: unknown): AdminMappingStatus | null {
  const profile = readAutofillProfileFromMetadata(metadata);
  if (!profile || !profile.fieldMappings.some((m) => m.locator.trim())) return null;
  const usersGetIt =
    isVersionMatchedValidated(profile) && resolveActiveLoginContract(metadata ?? {}).mode === 'STANDARD';
  return usersGetIt ? 'approved' : 'saved_not_approved';
}
