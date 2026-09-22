/**
 * Phase 117 — Managed Autofill profile contract.
 * Schema-dynamic: joins only on active login_fields[].id. No fixed field vocabulary.
 */

import type { FieldAuthoringEntry } from '../assistedMapping/fieldAuthoring';
import {
  parseFieldAuthoringBag,
  pruneFieldAuthoringToMappings,
  serializeFieldAuthoringBag,
} from '../assistedMapping/fieldAuthoring';
import {
  classifyStoredLoginFields,
  isFieldRequired,
  resolveGlobalCredentialConfiguration,
} from '../service/credentialSchema';
import type { LoginField } from '../service/serviceModel';
import type { Credential } from '../credentials';

export type AutofillSupportState = 'not_configured' | 'validated' | 'unsupported';

export type AutofillProfileAction =
  | 'save'
  | 'reset_not_configured'
  | 'clear_managed_mappings'
  | 'disable_unsupported'
  | 'activate_validated';

export interface AutofillFieldMapping {
  fieldId: string;
  locatorType: 'css';
  locator: string;
}

export interface AutofillValidationEvidence {
  metadataVersion: number;
  validatedAt?: string;
  validatedBy?: 'admin';
  resultSummary?: string;
}

export interface AutofillProfile {
  supportState: AutofillSupportState;
  configVersion: number;
  loginEntryUrl: string;
  allowedOrigin: string;
  fieldMappings: AutofillFieldMapping[];
  validation?: AutofillValidationEvidence;
  /** Phase 120.8 — Admin authoring provenance (facts). Runtime fill ignores. */
  fieldAuthoring?: FieldAuthoringEntry[];
}

export const AUTOFILL_PROFILE_META_KEY = 'autofillProfile';
export const AUTOFILL_PROFILE_ACTION_KEY = 'autofillProfileAction';
export const AUTOFILL_LIVE_VALIDATION_APPROVED_KEY = 'autofillLiveValidationApproved';
/** Hub control key: true only after a successful Managed-parity readiness probe (assess-only). */
export const AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY =
  'autofillManagedReadinessProbePassed';

/** Evidence stamp when activate succeeded via Managed-parity probe (not UI-confirm alone). */
export const MANAGED_READINESS_OK_SUMMARY = 'managed_readiness_ok';

export const AUTOFILL_SUPPORT_STATE_LABEL_HE: Record<AutofillSupportState, string> = {
  not_configured: 'לא הוגדר',
  validated: 'מאומת',
  unsupported: 'לא נתמך',
};

export const AUTOFILL_PROFILE_ERROR = {
  unknownFieldId: 'לא ניתן לשמור מיפוי לשדה שאינו בשדות הכניסה הפעילים.',
  missingRequiredMapping: 'יש למפות בורר CSS לכל שדה כניסה נדרש.',
  locatorTypeMustBeCss: 'סוג הבורר חייב להיות CSS.',
  emptyLocator: 'יש להזין בורר CSS לכל שדה ממופה.',
  duplicateFieldId: 'לא ניתן למפות את אותו שדה יותר מפעם אחת.',
  loginEntryMustBeHttps: 'כתובת הכניסה למילוי אוטומטי חייבת להיות HTTPS.',
  originMismatch: 'מקור ההזרקה חייב להתאים למקור כתובת הכניסה.',
  invalidLoginEntry: 'כתובת הכניסה למילוי אוטומטי אינה תקינה.',
  noActiveSchema: 'אין שדות כניסה פעילים לשמירת מיפוי מילוי אוטומטי.',
  cannotActivateWithoutLiveValidation:
    'לא ניתן לסמן מאומת בלי אימות חי מאושר והפעלה מפורשת.',
  cannotActivateWithoutManagedReadinessProbe:
    'לא ניתן לסמן מאומת בלי בדיקת מוכנות מנוהלת מוצלחת בדף הכניסה.',
  cannotResetValidated:
    'לא ניתן לאפס ל«לא הוגדר» ממצב מאומת. יש להשבית קודם.',
  cannotClearWithoutProfile:
    'אין מיפוי מנוהל שמור למחיקה.',
  unknownAction: 'פעולת מילוי אוטומטי מנוהל אינה מוכרת.',
} as const;

export type AutofillProfilePlan =
  | { ok: true; profile: AutofillProfile }
  | { ok: false; message: string; code: keyof typeof AUTOFILL_PROFILE_ERROR };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSupportState(value: unknown): value is AutofillSupportState {
  return value === 'not_configured' || value === 'validated' || value === 'unsupported';
}

function isAutofillProfileAction(value: unknown): value is AutofillProfileAction {
  return (
    value === 'save' ||
    value === 'reset_not_configured' ||
    value === 'clear_managed_mappings' ||
    value === 'disable_unsupported' ||
    value === 'activate_validated'
  );
}

export function originFromHttpsLoginEntry(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function parseMapping(raw: unknown): AutofillFieldMapping | null {
  if (!isRecord(raw)) {
    return null;
  }
  const fieldId = typeof raw.fieldId === 'string' ? raw.fieldId.trim() : '';
  const locator = typeof raw.locator === 'string' ? raw.locator.trim() : '';
  const locatorType = raw.locatorType;
  if (!fieldId) {
    return null;
  }
  if (locatorType !== 'css') {
    return null;
  }
  return { fieldId, locatorType: 'css', locator };
}

function parseValidation(raw: unknown): AutofillValidationEvidence | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  if (typeof raw.metadataVersion !== 'number' || !Number.isInteger(raw.metadataVersion)) {
    return undefined;
  }
  const evidence: AutofillValidationEvidence = {
    metadataVersion: raw.metadataVersion,
  };
  if (typeof raw.validatedAt === 'string' && raw.validatedAt.trim()) {
    evidence.validatedAt = raw.validatedAt.trim();
  }
  if (raw.validatedBy === 'admin') {
    evidence.validatedBy = 'admin';
  }
  if (typeof raw.resultSummary === 'string' && raw.resultSummary.trim()) {
    evidence.resultSummary = raw.resultSummary.trim();
  }
  return evidence;
}

/** Parse stored metadata.autofillProfile. Invalid / absent → null. */
export function parseAutofillProfile(raw: unknown): AutofillProfile | null {
  if (!isRecord(raw)) {
    return null;
  }
  if (!isSupportState(raw.supportState)) {
    return null;
  }
  if (typeof raw.configVersion !== 'number' || !Number.isInteger(raw.configVersion) || raw.configVersion < 1) {
    return null;
  }
  if (typeof raw.loginEntryUrl !== 'string' || !raw.loginEntryUrl.trim()) {
    return null;
  }
  if (typeof raw.allowedOrigin !== 'string' || !raw.allowedOrigin.trim()) {
    return null;
  }
  if (!Array.isArray(raw.fieldMappings)) {
    return null;
  }
  const fieldMappings: AutofillFieldMapping[] = [];
  for (const entry of raw.fieldMappings) {
    const mapping = parseMapping(entry);
    if (!mapping) {
      return null;
    }
    fieldMappings.push(mapping);
  }
  const profile: AutofillProfile = {
    supportState: raw.supportState,
    configVersion: raw.configVersion,
    loginEntryUrl: raw.loginEntryUrl.trim(),
    allowedOrigin: raw.allowedOrigin.trim(),
    fieldMappings,
  };
  const validation = parseValidation(raw.validation);
  if (validation) {
    profile.validation = validation;
  }
  const fieldAuthoring = parseFieldAuthoringBag(raw.fieldAuthoring);
  const pruned = pruneFieldAuthoringToMappings(fieldAuthoring, fieldMappings);
  if (pruned.length > 0) {
    profile.fieldAuthoring = pruned;
  }
  return profile;
}

export function serializeAutofillProfile(profile: AutofillProfile): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    supportState: profile.supportState,
    configVersion: profile.configVersion,
    loginEntryUrl: profile.loginEntryUrl,
    allowedOrigin: profile.allowedOrigin,
    fieldMappings: profile.fieldMappings.map((mapping) => ({
      fieldId: mapping.fieldId,
      locatorType: mapping.locatorType,
      locator: mapping.locator,
    })),
  };
  if (profile.validation) {
    serialized.validation = { ...profile.validation };
  }
  const authoring = serializeFieldAuthoringBag(
    pruneFieldAuthoringToMappings(profile.fieldAuthoring, profile.fieldMappings),
  );
  if (authoring && authoring.length > 0) {
    serialized.fieldAuthoring = authoring;
  }
  return serialized;
}

export interface AutofillStructuralContext {
  loginFields: unknown;
  loginUrl?: string | null;
}

export interface AutofillStructuralIssue {
  code: keyof typeof AUTOFILL_PROFILE_ERROR;
  message: string;
}

function activeSchemaFields(loginFields: unknown): LoginField[] | null {
  const classified = classifyStoredLoginFields(loginFields === undefined ? undefined : loginFields);
  return classified.status === 'valid' ? classified.fields : null;
}

function mappingFingerprint(mappings: AutofillFieldMapping[]): string {
  return mappings
    .map((mapping) => `${mapping.fieldId}\0${mapping.locatorType}\0${mapping.locator}`)
    .slice()
    .sort()
    .join('\n');
}

function isSecurityRelevantChange(previous: AutofillProfile | null, next: AutofillProfile): boolean {
  if (!previous) {
    return true;
  }
  return (
    previous.loginEntryUrl !== next.loginEntryUrl ||
    previous.allowedOrigin !== next.allowedOrigin ||
    mappingFingerprint(previous.fieldMappings) !== mappingFingerprint(next.fieldMappings)
  );
}

/**
 * Structural validation only. Never sets supportState=validated.
 * Joins mappings to the active schema dynamically — no fixed field names.
 */
export function validateAutofillProfileStructural(
  candidate: {
    fieldMappings: AutofillFieldMapping[];
    loginEntryUrl: string;
    allowedOrigin: string;
  },
  context: AutofillStructuralContext,
): { ok: true } | { ok: false; issues: AutofillStructuralIssue[] } {
  const issues: AutofillStructuralIssue[] = [];
  const fields = activeSchemaFields(context.loginFields);
  if (!fields || fields.length === 0) {
    issues.push({
      code: 'noActiveSchema',
      message: AUTOFILL_PROFILE_ERROR.noActiveSchema,
    });
    return { ok: false, issues };
  }

  const activeIds = new Set(fields.map((field) => field.id));
  const seen = new Set<string>();
  for (const mapping of candidate.fieldMappings) {
    if (mapping.locatorType !== 'css') {
      issues.push({
        code: 'locatorTypeMustBeCss',
        message: AUTOFILL_PROFILE_ERROR.locatorTypeMustBeCss,
      });
    }
    if (!mapping.locator.trim()) {
      issues.push({
        code: 'emptyLocator',
        message: AUTOFILL_PROFILE_ERROR.emptyLocator,
      });
    }
    if (!activeIds.has(mapping.fieldId)) {
      issues.push({
        code: 'unknownFieldId',
        message: AUTOFILL_PROFILE_ERROR.unknownFieldId,
      });
    }
    if (seen.has(mapping.fieldId)) {
      issues.push({
        code: 'duplicateFieldId',
        message: AUTOFILL_PROFILE_ERROR.duplicateFieldId,
      });
    }
    seen.add(mapping.fieldId);
  }

  for (const field of fields) {
    if (!isFieldRequired(field)) {
      continue;
    }
    const mapping = candidate.fieldMappings.find((entry) => entry.fieldId === field.id);
    if (!mapping || !mapping.locator.trim()) {
      issues.push({
        code: 'missingRequiredMapping',
        message: AUTOFILL_PROFILE_ERROR.missingRequiredMapping,
      });
    }
  }

  const loginEntryUrl = candidate.loginEntryUrl.trim();
  if (!loginEntryUrl) {
    issues.push({
      code: 'invalidLoginEntry',
      message: AUTOFILL_PROFILE_ERROR.invalidLoginEntry,
    });
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(loginEntryUrl);
    } catch {
      parsed = null;
    }
    if (!parsed) {
      issues.push({
        code: 'invalidLoginEntry',
        message: AUTOFILL_PROFILE_ERROR.invalidLoginEntry,
      });
    } else if (parsed.protocol !== 'https:') {
      issues.push({
        code: 'loginEntryMustBeHttps',
        message: AUTOFILL_PROFILE_ERROR.loginEntryMustBeHttps,
      });
    } else if (parsed.origin !== candidate.allowedOrigin.trim()) {
      issues.push({
        code: 'originMismatch',
        message: AUTOFILL_PROFILE_ERROR.originMismatch,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true };
}

function fail(code: keyof typeof AUTOFILL_PROFILE_ERROR): AutofillProfilePlan {
  return { ok: false, message: AUTOFILL_PROFILE_ERROR[code], code };
}

function coerceProposedMappings(raw: unknown): AutofillFieldMapping[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const mappings: AutofillFieldMapping[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) {
      return null;
    }
    const fieldId = typeof entry.fieldId === 'string' ? entry.fieldId.trim() : '';
    const locator = typeof entry.locator === 'string' ? entry.locator.trim() : '';
    const locatorType = entry.locatorType === undefined ? 'css' : entry.locatorType;
    if (locatorType !== 'css') {
      return null;
    }
    if (!fieldId) {
      return null;
    }
    mappings.push({ fieldId, locatorType: 'css', locator });
  }
  return mappings;
}

export interface PlanAutofillProfileWriteInput {
  previous: AutofillProfile | null;
  proposed: unknown;
  loginFields: unknown;
  loginUrl?: string | null;
  action?: AutofillProfileAction;
  liveValidationApproved?: boolean;
  /** True only after extension assessManagedTargetsReady succeeded for this activate. */
  managedReadinessProbePassed?: boolean;
  nowIso?: string;
}

function buildCandidateFromProposed(
  previous: AutofillProfile | null,
  proposed: unknown,
  loginUrl: string | null | undefined,
): {
  fieldMappings: AutofillFieldMapping[];
  loginEntryUrl: string;
  allowedOrigin: string;
} | { error: keyof typeof AUTOFILL_PROFILE_ERROR } {
  const record = isRecord(proposed) ? proposed : {};
  const mappings = coerceProposedMappings(record.fieldMappings);
  if (mappings === null && record.fieldMappings !== undefined) {
    return { error: 'locatorTypeMustBeCss' };
  }
  const fieldMappings = mappings ?? previous?.fieldMappings ?? [];
  const loginEntryUrl =
    typeof record.loginEntryUrl === 'string' && record.loginEntryUrl.trim()
      ? record.loginEntryUrl.trim()
      : previous?.loginEntryUrl || (typeof loginUrl === 'string' ? loginUrl.trim() : '');
  const origin = originFromHttpsLoginEntry(loginEntryUrl);
  const allowedOrigin =
    typeof record.allowedOrigin === 'string' && record.allowedOrigin.trim()
      ? record.allowedOrigin.trim()
      : previous?.allowedOrigin || origin || '';
  return { fieldMappings, loginEntryUrl, allowedOrigin };
}

/**
 * Plan a metadata write. Structural pass never yields supportState=validated.
 * Security-relevant edits while validated bump configVersion and move to unsupported.
 * Phase 120.7: `clear_managed_mappings` forces fieldMappings=[] (skips empty-locator structural).
 */
export function planAutofillProfileWrite(input: PlanAutofillProfileWriteInput): AutofillProfilePlan {
  const action = input.action ?? 'save';
  if (!isAutofillProfileAction(action)) {
    return fail('unknownAction');
  }

  // Phase 120.7 — configuration deletion of Managed mappings (not credentials / schema).
  if (action === 'clear_managed_mappings') {
    if (!input.previous) {
      return fail('cannotClearWithoutProfile');
    }
    const previous = input.previous;
    const hadNonEmptyMappings = previous.fieldMappings.some(
      (mapping) => mapping.fieldId.trim() && mapping.locator.trim(),
    );
    const nextClear: AutofillProfile = {
      supportState: 'not_configured',
      configVersion: hadNonEmptyMappings ? previous.configVersion + 1 : previous.configVersion,
      loginEntryUrl: previous.loginEntryUrl,
      allowedOrigin: previous.allowedOrigin,
      fieldMappings: [],
    };
    // validation + fieldAuthoring intentionally omitted (120.7 + 120.8).
    return { ok: true, profile: nextClear };
  }

  const candidate = buildCandidateFromProposed(input.previous, input.proposed, input.loginUrl);
  if ('error' in candidate) {
    return fail(candidate.error);
  }

  const structural = validateAutofillProfileStructural(candidate, {
    loginFields: input.loginFields,
    loginUrl: input.loginUrl,
  });
  if (!structural.ok) {
    return fail(structural.issues[0]!.code);
  }

  const proposedRecord = isRecord(input.proposed) ? input.proposed : {};
  const proposedAuthoring = parseFieldAuthoringBag(proposedRecord.fieldAuthoring);
  const authoringSource =
    proposedAuthoring.length > 0
      ? proposedAuthoring
      : input.previous?.fieldAuthoring ?? [];
  const prunedAuthoring = pruneFieldAuthoringToMappings(
    authoringSource,
    candidate.fieldMappings,
  );

  const nextBase: AutofillProfile = {
    supportState: input.previous?.supportState ?? 'not_configured',
    configVersion: input.previous?.configVersion ?? 1,
    loginEntryUrl: candidate.loginEntryUrl,
    allowedOrigin: candidate.allowedOrigin,
    fieldMappings: candidate.fieldMappings,
    validation: input.previous?.validation ? { ...input.previous.validation } : undefined,
  };
  if (prunedAuthoring.length > 0) {
    nextBase.fieldAuthoring = prunedAuthoring;
  }

  const securityChanged = isSecurityRelevantChange(input.previous, nextBase);
  if (input.previous && securityChanged) {
    nextBase.configVersion = input.previous.configVersion + 1;
  } else if (!input.previous) {
    nextBase.configVersion = 1;
  }

  if (action === 'save') {
    if (input.previous?.supportState === 'validated' && securityChanged) {
      nextBase.supportState = 'unsupported';
    } else if (input.previous?.supportState === 'validated') {
      nextBase.supportState = 'validated';
    } else if (input.previous?.supportState === 'unsupported') {
      nextBase.supportState = 'unsupported';
    } else {
      nextBase.supportState = 'not_configured';
    }
    if (
      nextBase.supportState === 'validated' &&
      nextBase.validation &&
      nextBase.validation.metadataVersion !== nextBase.configVersion
    ) {
      nextBase.supportState = 'unsupported';
    }
    return { ok: true, profile: nextBase };
  }

  if (action === 'disable_unsupported') {
    nextBase.supportState = 'unsupported';
    return { ok: true, profile: nextBase };
  }

  if (action === 'reset_not_configured') {
    if (input.previous?.supportState === 'validated') {
      return fail('cannotResetValidated');
    }
    nextBase.supportState = 'not_configured';
    delete nextBase.validation;
    delete nextBase.fieldAuthoring;
    return { ok: true, profile: nextBase };
  }

  if (action === 'activate_validated') {
    if (!input.liveValidationApproved) {
      return fail('cannotActivateWithoutLiveValidation');
    }
    if (!input.managedReadinessProbePassed) {
      return fail('cannotActivateWithoutManagedReadinessProbe');
    }
    nextBase.supportState = 'validated';
    nextBase.validation = {
      metadataVersion: nextBase.configVersion,
      validatedAt: input.nowIso ?? new Date().toISOString(),
      validatedBy: 'admin',
      resultSummary: MANAGED_READINESS_OK_SUMMARY,
    };
    return { ok: true, profile: nextBase };
  }

  return fail('unknownAction');
}

export function readAutofillProfileFromMetadata(metadata: unknown): AutofillProfile | null {
  if (!isRecord(metadata)) {
    return null;
  }
  return parseAutofillProfile(metadata[AUTOFILL_PROFILE_META_KEY]);
}

export function stripAutofillControlKeys(metadata: Record<string, unknown>): Record<string, unknown> {
  const next = { ...metadata };
  delete next[AUTOFILL_PROFILE_ACTION_KEY];
  delete next[AUTOFILL_LIVE_VALIDATION_APPROVED_KEY];
  delete next[AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY];
  return next;
}

/**
 * Merge autofillProfile into registry metadata. Rejects invalid structural writes.
 * Does not invent credentialMode.
 */
export function mergeAutofillProfileMetadata(input: {
  existingMetadata: Record<string, unknown> | null | undefined;
  patchMetadata: Record<string, unknown>;
  loginFields: unknown;
  loginUrl?: string | null;
}):
  | { ok: true; profile: AutofillProfile | null; metadata: Record<string, unknown> }
  | { ok: false; message: string; code: keyof typeof AUTOFILL_PROFILE_ERROR } {
  const merged = stripAutofillControlKeys({
    ...(input.existingMetadata ?? {}),
    ...input.patchMetadata,
  });
  if (!Object.prototype.hasOwnProperty.call(input.patchMetadata, AUTOFILL_PROFILE_META_KEY)) {
    return {
      ok: true,
      profile: parseAutofillProfile(merged[AUTOFILL_PROFILE_META_KEY]),
      metadata: merged,
    };
  }

  const actionRaw = input.patchMetadata[AUTOFILL_PROFILE_ACTION_KEY];
  const action: AutofillProfileAction = isAutofillProfileAction(actionRaw) ? actionRaw : 'save';
  const liveValidationApproved = input.patchMetadata[AUTOFILL_LIVE_VALIDATION_APPROVED_KEY] === true;
  const managedReadinessProbePassed =
    input.patchMetadata[AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY] === true;

  const planned = planAutofillProfileWrite({
    previous: parseAutofillProfile(input.existingMetadata?.[AUTOFILL_PROFILE_META_KEY]),
    proposed: input.patchMetadata[AUTOFILL_PROFILE_META_KEY],
    loginFields: input.loginFields,
    loginUrl: input.loginUrl,
    action,
    liveValidationApproved,
    managedReadinessProbePassed,
  });
  if (!planned.ok) {
    return planned;
  }
  merged[AUTOFILL_PROFILE_META_KEY] = serializeAutofillProfile(planned.profile);
  return { ok: true, profile: planned.profile, metadata: merged };
}

export function isVersionMatchedValidated(profile: AutofillProfile | null): boolean {
  if (!profile || profile.supportState !== 'validated') {
    return false;
  }
  return profile.validation?.metadataVersion === profile.configVersion;
}

export function mappingsCoverRequiredSchema(
  profile: AutofillProfile,
  loginFields: LoginField[],
): boolean {
  const activeIds = new Set(loginFields.map((field) => field.id));
  for (const mapping of profile.fieldMappings) {
    if (!activeIds.has(mapping.fieldId)) {
      return false;
    }
  }
  for (const field of loginFields) {
    if (!isFieldRequired(field)) {
      continue;
    }
    const mapping = profile.fieldMappings.find((entry) => entry.fieldId === field.id);
    if (!mapping || !mapping.locator.trim()) {
      return false;
    }
  }
  return true;
}

export function hasCompleteRequiredCredentials(
  credential: Credential | undefined,
  loginFields: LoginField[],
): boolean {
  if (!credential) {
    return false;
  }
  return loginFields
    .filter((field) => isFieldRequired(field))
    .every((field) => Boolean(credential[field.id]?.trim()));
}

/**
 * Runtime Managed Autofill eligibility. Fail closed on version mismatch.
 * Does not infer support from selectors or legacy Autofill success.
 */
export function isManagedAutofillEligible(input: {
  metadata: unknown;
  loginFields: unknown;
  credential: Credential | undefined;
}): boolean {
  const resolved = resolveGlobalCredentialConfiguration({
    metadata: input.metadata,
    loginFields: input.loginFields,
  });
  if (resolved.status !== 'credential_fields') {
    return false;
  }
  const profile = readAutofillProfileFromMetadata(input.metadata);
  if (!isVersionMatchedValidated(profile) || !profile) {
    return false;
  }
  if (!mappingsCoverRequiredSchema(profile, resolved.fields)) {
    return false;
  }
  if (!hasCompleteRequiredCredentials(input.credential, resolved.fields)) {
    return false;
  }
  return true;
}
