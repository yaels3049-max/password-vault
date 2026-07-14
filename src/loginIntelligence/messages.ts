/**
 * Friendly Hebrew user copy only (D-112-14). Never expose raw detection errors.
 */

export const LI_USER_MESSAGES = {
  openOk: 'פתחנו את האתר.',
  mediumAssist:
    'פתחנו את האתר. אם מופיע שלב נוסף (המשך / Continue) — המשיכו ידנית; לא נלחץ עבורכם.',
  complexOpen:
    'פתחנו את האתר. המילוי האוטומטי עדיין לא נתמך במלואו לאתר זה — ניתן להמשיך ידנית.',
  unknownOpen: 'פתחנו את האתר. ניתן להמשיך את ההתחברות ידנית.',
  fillUnavailable:
    'האתר נפתח. מילוי אוטומטי לא זמין כרגע — ניתן למלא את השדות ידנית.',
  credentialsMissing:
    'הגדירו פרטי כניסה במסך «ניהול האתרים» — לחצו «הוסף אתרים נוספים».',
} as const;

export function hebrewMessageForComplexity(
  complexity: 'basic' | 'medium' | 'complex' | 'unknown',
  opts?: { fillFailed?: boolean },
): string | undefined {
  if (opts?.fillFailed) {
    return LI_USER_MESSAGES.fillUnavailable;
  }
  switch (complexity) {
    case 'medium':
      return LI_USER_MESSAGES.mediumAssist;
    case 'complex':
      return LI_USER_MESSAGES.complexOpen;
    case 'unknown':
      return LI_USER_MESSAGES.unknownOpen;
    default:
      return undefined;
  }
}
