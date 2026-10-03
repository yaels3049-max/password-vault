/**
 * Phase 122.5 R2 — «שינוי אופי הכניסה»: when to warn before the pattern chooser opens, and
 * the dialog copy. The copy states what a switch really does (dev-phase122.md §122.5, G-122-5):
 * the switch itself writes nothing and returning to the saved pattern shows the saved mapping;
 * «שמור מיפוי» in the new pattern replaces the saved mapping of that kind; users keep the
 * approved mapping until the next «אשר מיפוי».
 */
import { resolveActiveLoginContract } from '../loginContract';
import type { AdminConfirmOptions } from './AdminConfirmDialog';
import { specialMappingStatus, standardMappingStatus } from './mappingStatus';

export const PATTERN_CHANGE_HE = {
  summaryLabel: 'אופי הכניסה:',
  change: 'שינוי אופי הכניסה',
  chooserHint: 'בחרו את אופי הכניסה. הבחירה עצמה לא נשמרת ולא משנה דבר אצל המשתמשים.',
  closeChooser: 'סגירה',
  title: 'לשנות את אופי הכניסה?',
  body: [
    'לאתר הזה כבר יש מיפוי שמור. השינוי לא מוחק אותו — הוא יוחלף רק אחרי «שמור מיפוי» באופי הכניסה החדש.',
    'המשתמשים ממשיכים לקבל את המיפוי המאושר עד «אשר מיפוי».',
    'חריג: שמירת שינוי במיפוי רגיל שכבר אושר עוצרת את המילוי אצל המשתמשים עד שיאושר שוב.',
  ].join('\n'),
  confirm: 'שינוי בכל זאת',
} as const;

/**
 * Warn when a mapping is stored (STANDARD profile, SPECIAL draft or live contract) or the
 * site's login is approved for users; otherwise the chooser opens directly.
 */
export function patternChangeNeedsWarning(metadata: unknown): boolean {
  return (
    standardMappingStatus(metadata) !== null ||
    specialMappingStatus(metadata) !== null ||
    resolveActiveLoginContract(metadata ?? {}).mode !== 'STANDARD'
  );
}

export const PATTERN_CHANGE_DIALOG: AdminConfirmOptions = {
  name: 'change-login-pattern',
  title: PATTERN_CHANGE_HE.title,
  body: PATTERN_CHANGE_HE.body,
  confirmLabel: PATTERN_CHANGE_HE.confirm,
  defaultFocus: 'cancel',
};
