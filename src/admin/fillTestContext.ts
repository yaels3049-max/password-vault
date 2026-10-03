/**
 * Phase 121 «בדיקת מילוי» (Admin UI only). D-121-43: no context selector — the run
 * always uses the saved mapping of the service's selected «אופי הכניסה»
 * (STANDARD → saved autofillProfile; SPECIAL → saved loginFlowPlan.draft).
 */
import type { FieldAuthoringEntry } from '../assistedMapping';
import {
  ensureSpecialDraft,
  isSpecialLoginPattern,
  normalizeLegacyDraftReadiness,
  readLoginFlowPlanFromMetadata,
  resolveActiveLoginContract,
  serializeLoginFlowPlanDocument,
  type AuthoringLoginPattern,
  type LoginFlowPlanDocument,
  type SpecialFieldMapping,
} from '../loginContract';
import type { AutofillProfile } from '../autofill/validatedProfile';
import type { LoginField } from '../service/serviceModel';
import { checkSpecialDraft } from './specialActionBar';

export const FILL_TEST_GRID_HE = {
  title: 'בדיקת מילוי',
  incompleteTitle: 'המיפוי השמור עדיין לא הושלם — לא ניתן להריץ בדיקת מילוי.',
  incompleteMissingFields: (labels: string[]): string => `שדות ללא מיפוי שמור: ${labels.join(', ')}`,
  goToLoginTab: 'מעבר להגדרת כניסה ומילוי',
  specialPatternLater: 'בדיקת מילוי לסוג כניסה זה תופעל בשלב מאוחר יותר.',
  specialTechnicalDetails: 'פרטים טכניים',
  specialInvalid:
    'המיפוי המאושר למשתמשים בשירות זה אינו תקין. מילוי אוטומטי לשירות זה חסום עד שיאושר מיפוי תקין.',
  unavailable: 'בדיקת מילוי מנוהל זמינה לאחר שמירת מיפוי עם כתובת כניסה.',
  dirty: 'יש שינויים שלא נשמרו — שמרו את המיפוי לפני בדיקה.',
  run: 'כניסה לאתר ומילוי שדות',
  running: 'ממלא…',
  /** D-121-72 — shown only while a run is in flight. */
  stop: 'עצור',
} as const;

export type FillTestRoute = 'standard' | 'special';

export interface FillTestRouteInfo {
  route: FillTestRoute;
  /** Live contract is SPECIAL_INVALID (fail-closed; users are blocked). */
  specialInvalid: boolean;
  /** 121.3: FLOATING_SCREEN and MULTI_STEP (saved draft pattern) run; other SPECIAL patterns do not. */
  specialRunnable: boolean;
  /** Selected SPECIAL pattern is not runnable yet. */
  specialPatternLater: boolean;
  /** Mapped fieldIds of every step of the saved draft (the temp values the run requires). */
  specialMappedFieldIds: string[];
  /** 122.8 R2: the saved draft passes the shared completeness check (`checkSpecialDraft`). */
  specialComplete: boolean;
  /** `checkSpecialDraft` message for the saved draft (the gap detail when incomplete). */
  specialGapMessage: string;
}

const RUNNABLE_SPECIAL_PATTERNS: readonly string[] = ['FLOATING_SCREEN', 'MULTI_STEP'];

function allStepsFieldIds(plan: LoginFlowPlanDocument | null | undefined): string[] {
  const mappings = (plan?.steps ?? []).flatMap((step) => step.fieldMappings ?? []) as SpecialFieldMapping[];
  const ids = mappings
    .map((m) => (typeof m.fieldId === 'string' ? m.fieldId.trim() : ''))
    .filter(Boolean);
  return [...new Set(ids)];
}

/** «אופי הכניסה» as the SPECIAL editor initializes it from the saved row. */
export function savedAuthoringPattern(metadata: unknown): AuthoringLoginPattern {
  const draft = readLoginFlowPlanFromMetadata(metadata ?? {})?.draft ?? null;
  return draft && isSpecialLoginPattern(draft.pattern) ? draft.pattern : 'STANDARD';
}

export function fillTestRoute(metadata: unknown, selectedPattern: AuthoringLoginPattern): FillTestRouteInfo {
  const draft = readLoginFlowPlanFromMetadata(metadata ?? {})?.draft ?? null;
  const route: FillTestRoute = isSpecialLoginPattern(selectedPattern) ? 'special' : 'standard';
  const specialRunnable = draft !== null && RUNNABLE_SPECIAL_PATTERNS.includes(draft.pattern);
  const check = checkSpecialDraft(draft);
  return {
    specialComplete: check.complete,
    specialGapMessage: check.message,
    route,
    specialInvalid: resolveActiveLoginContract(metadata ?? {}).mode === 'SPECIAL_INVALID',
    specialRunnable,
    specialPatternLater:
      route === 'special' &&
      (!RUNNABLE_SPECIAL_PATTERNS.includes(selectedPattern) || (draft !== null && !specialRunnable)),
    specialMappedFieldIds: allStepsFieldIds(draft),
  };
}

/**
 * 122.8 R2 — declared login fields without a saved locator in the saved STANDARD profile
 * (the STANDARD fill test runs only when this is empty).
 */
export function standardUnmappedFields(profile: AutofillProfile | null, fields: readonly LoginField[]): LoginField[] {
  const mapped = new Set(
    (profile?.fieldMappings ?? []).filter((m) => m.fieldId.trim() && m.locator.trim()).map((m) => m.fieldId.trim()),
  );
  return fields.filter((field) => !mapped.has(field.id));
}

/**
 * Comparable key of the SPECIAL editor state (pattern + A1-normalized draft).
 * Saved key uses the same derivation as the editor's initial state.
 */
export function specialDraftStateKey(pattern: string, draft: LoginFlowPlanDocument | null): string {
  if (!draft) return `${pattern}|`;
  return `${pattern}|${JSON.stringify(serializeLoginFlowPlanDocument(normalizeLegacyDraftReadiness(draft)))}`;
}

export function savedSpecialDraftStateKey(metadata: unknown): string {
  const saved = readLoginFlowPlanFromMetadata(metadata ?? {})?.draft ?? null;
  if (!saved || !isSpecialLoginPattern(saved.pattern)) return specialDraftStateKey('STANDARD', null);
  return specialDraftStateKey(saved.pattern, ensureSpecialDraft(saved.pattern, saved));
}

/** SPECIAL editor unsaved state the fill-test grid observes (blocks the SPECIAL test). */
export interface SpecialDraftDirtyState {
  rowId: string;
  dirty: boolean;
}

/** Managed grid state the fill-test grid observes (dirty / busy / in-memory authoring facts). */
export interface ManagedGridSharedState {
  rowId: string;
  hasUnsavedChanges: boolean;
  /** saving / analyzing / probing / Visual Mapping in progress. */
  busy: boolean;
  /** analyzing / probing (locks the temp inputs, as before). */
  inputsLocked: boolean;
  fieldAuthoring: FieldAuthoringEntry[];
}
