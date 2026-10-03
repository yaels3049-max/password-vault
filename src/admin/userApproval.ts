/**
 * Phase 122.8 R3 — «do users get automatic fill for this site right now», from what the user
 * runtime resolves (`serviceExecution.executeServiceFromTile`), never from editor state:
 * - SPECIAL contract → the approved plan runs (also while saved changes wait for approval).
 * - SPECIAL_INVALID → users are blocked (fail closed).
 * - STANDARD → the version-matched validated profile covering the saved login fields; a profile
 *   that claims `validated` but fails that is blocked; saved changes after approval set the
 *   profile to `unsupported`, so users get nothing until the next approval.
 */
import {
  isVersionMatchedValidated,
  mappingsCoverRequiredSchema,
  readAutofillProfileFromMetadata,
} from '../autofill/validatedProfile';
import { resolveGlobalCredentialConfiguration } from '../service/credentialSchema';
import { isSpecialLoginPattern, readLoginFlowPlanFromMetadata, resolveActiveLoginContract } from '../loginContract';

export type UserApprovalState = 'approved' | 'not_approved' | 'blocked' | 'no_mapping';

export const USER_APPROVAL_HE: Record<UserApprovalState, string> = {
  approved: 'מאושר למשתמשים',
  not_approved: 'טרם אושר למשתמשים',
  blocked: 'חסום למשתמשים',
  no_mapping: 'אין מיפוי',
};

export interface UserApprovalRow {
  metadata?: unknown;
  login_fields?: unknown;
}

export function userApprovalState(row: UserApprovalRow): UserApprovalState {
  const metadata = row.metadata ?? {};
  const contract = resolveActiveLoginContract(metadata);
  if (contract.mode === 'SPECIAL_INVALID') return 'blocked';
  if (contract.mode === 'SPECIAL') return 'approved';

  const profile = readAutofillProfileFromMetadata(metadata);
  if (profile?.supportState === 'validated') {
    const resolved = resolveGlobalCredentialConfiguration({ metadata, loginFields: row.login_fields });
    const runs =
      resolved.status === 'credential_fields' &&
      isVersionMatchedValidated(profile) &&
      mappingsCoverRequiredSchema(profile, resolved.fields);
    return runs ? 'approved' : 'blocked';
  }

  const standardMapped = Boolean(profile?.fieldMappings.some((m) => m.locator.trim()));
  const draft = readLoginFlowPlanFromMetadata(metadata)?.draft ?? null;
  const specialSaved = draft !== null && isSpecialLoginPattern(draft.pattern);
  return standardMapped || specialSaved ? 'not_approved' : 'no_mapping';
}
