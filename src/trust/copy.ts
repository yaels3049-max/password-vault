/**
 * Phase 106 — centralized Hebrew trust / Zero-Knowledge copy (D-106-3).
 * Claims align with ADR-002. Single vocabulary for Vault / Master Password /
 * Encrypted / Zero-Knowledge across Unlock and credential management.
 */

/** Preferred Hebrew names (one per concept). */
export const TRUST_TERMS = {
  vault: 'כספת',
  masterPassword: 'סיסמה ראשית',
  encrypted: 'מוצפן',
  encryptedOnDevice: 'המידע מוגן בהצפנה',
  zeroKnowledge: 'ידע-אפס',
  clientSideEncryption: 'הצפנה במכשיר',
  vaultOpen: 'הגישה פתוחה',
  vaultLocked: 'הגישה נעולה',
  vaultLockAction: 'נעל',
} as const;

export const TRUST_COPY = {
  /** Short chip / indicator — consistent across all screens. */
  encryptedOnDeviceShort: TRUST_TERMS.encryptedOnDevice,

  /** Zero-Knowledge one-liner for credential management. */
  cannotReadPasswords:
    'המוצר לא יכול לקרוא את הסיסמאות שלכם — הפרטים מוצפנים במכשיר לפני השמירה (ידע-אפס).',

  /** Unlock / create reassurance — Master Password entry screen. */
  unlockProtects:
    'הסיסמה הראשית מאמתת את זהותכם ומאפשרת גישה בטוחה לפרטי הכניסה שלכם.\nרק אתם יכולים לגשת למידע השמור.',

  /** First-time explanation body (AC-106-9). */
  firstTimeTitle: 'איך הפרטים שלכם מוגנים',
  firstTimeBody:
    'פרטי הכניסה מוצפנים במכשיר שלכם לפני שמירה. המוצר לא יכול לקרוא את הסיסמאות שלכם. הסיסמה הראשית פותחת את הכספת במכשיר זה — אם תאבדו אותה, ייתכן שלא תוכלו לגשת לפרטים השמורים.',
  firstTimeDismiss: 'הבנתי',

  /** Credential editor helper under fields. */
  credentialsManagedHint:
    'פרטי הכניסה נשמרים בצורה מוצפנת בכספת שלכם במכשיר. המוצר לא יכול לקרוא אותם.',

  /** In-flight / success / error feedback (AC-106-6 / AC-106-7). */
  savingEncrypted: 'שומר בצורה מוצפנת…',
  saveSuccess: 'פרטי הכניסה נשמרו בצורה מאובטחת.',
  updateSuccess: 'פרטי הכניסה עודכנו בצורה מאובטחת.',
  deleteSuccess: 'פרטי הכניסה נמחקו מהכספת.',
  persistFailed:
    'לא ניתן לשמור כרגע. בדקו שהכספת פתוחה ונסו שוב.',
  vaultLockedRetry: 'הכספת נעולה. פתחו אותה מחדש ונסו שוב.',
  genericSecurityError: 'משהו השתבש בשמירה המאובטחת. נסו שוב בעוד רגע.',

  /** Unlock screen titles. */
  unlockTitle: 'כניסה לבית הדיגיטלי',
  createTitle: 'יצירת כספת לבית הדיגיטלי',
  unlockButton: 'היכנסו לבית הדיגיטלי',
  createButton: 'צרו כספת והיכנסו',
  wrongPassword: 'סיסמה שגויה',

  /** Digital Home optional calm reassurance (D-106-9) — keep minimal. */
  digitalHomeCalm: 'הפרטים שלכם מוצפנים במכשיר.',
} as const;
