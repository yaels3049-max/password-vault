/**
 * D-121-43 — one Admin mapping vocabulary for every login pattern, shared by the
 * SPECIAL grid and the STANDARD «מיפוי אתר רגיל» grid (D-121-45 grid titles).
 * Quoted «…» names are exact button labels.
 */
import type { SpecialLoginPattern } from '../loginContract';

/** D-121-45 — cross-cutting grid + STANDARD grid titles. */
export const ADMIN_GRID_COPY_HE = {
  loginPatternTitle: 'אופי הכניסה',
  loginPatternHint: 'בחירת אופי הכניסה לא משנה דבר במסך הבית של המשתמשים עד «אשר מיפוי».',
  standardTitle: 'מיפוי אתר רגיל',
} as const;

/** D-121-45 — the SPECIAL grid title follows the selected pattern. */
export const SPECIAL_GRID_TITLE_HE: Record<SpecialLoginPattern, string> = {
  FLOATING_SCREEN: 'מיפוי מסך צף',
  MULTI_STEP: 'מיפוי כניסה רב־שלבית',
  FLOATING_SCREEN_MULTI_STEP: 'מיפוי מסך צף רב־שלבי',
};

export const ADMIN_MAPPING_COPY_HE = {
  save: 'שמור מיפוי',
  approve: 'אשר מיפוי',
  cancel: 'ביטול',
  saved: 'המיפוי נשמר בהצלחה',
  approved: 'המיפוי אושר',
  saveFailed: 'שמירת המיפוי נכשלה.',
  structuralOk: 'הבדיקה המבנית תקינה.',
  statusLabel: 'מצב:',
  technicalDetails: 'פרטים טכניים',
  /** D-121-53 — shown only when «שמור מיפוי» is disabled solely because nothing changed. */
  noChangesToSave: 'אין שינויים לשמירה — המיפוי במסך זהה למיפוי השמור.',
} as const;

export function approveConfirmTitleHe(serviceDisplayName: string): string {
  return `לאשר את המיפוי ל${serviceDisplayName}?`;
}

export type AdminMappingStatus = 'saved_not_approved' | 'approved' | 'changes_not_approved';

export const ADMIN_MAPPING_STATUS_HE: Record<AdminMappingStatus, string> = {
  saved_not_approved: 'נשמר — עדיין לא אושר למשתמשים',
  approved: 'מאושר למשתמשים',
  changes_not_approved: 'יש שינויים שנשמרו ועדיין לא אושרו',
};
