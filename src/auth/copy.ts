/** Friendly Hebrew auth errors — never expose stack / DB jargon (AC-109-25). */

export const AUTH_COPY = {
  productTitle: 'כספת דיגיטלית',
  loginTab: 'התחברות',
  registerTab: 'יצירת חשבון',
  email: 'אימייל',
  password: 'סיסמת הבית הדיגיטלי',
  passwordConfirm: 'אימות סיסמה',
  firstName: 'שם פרטי',
  lastName: 'שם משפחה',
  phone: 'טלפון',
  loginSubmit: 'התחברות',
  registerSubmit: 'יצירת חשבון',
  pending: 'רגע…',
  showPassword: 'הצג סיסמה',
  hidePassword: 'הסתר סיסמה',
  /** Single Digital Home password — one secret for Auth + local vault (AC-109-32). */
  accountPasswordHint:
    'סיסמה אחת לבית הדיגיטלי: היא מחברת את החשבון ופותחת את הכספת במכשיר זה.',
  logout: 'התנתקות',
  sessionBlocked: 'החשבון אינו פעיל. פנו לתמיכה אם זו טעות.',
  supabaseMissing: 'שירות החשבון אינו מוגדר בסביבה זו.',
  genericAuthFailure: 'ההתחברות נכשלה. בדקו אימייל וסיסמה ונסו שוב.',
  vaultUnlockFailed:
    'הסיסמה לא פתחה את הכספת במכשיר זה. בדקו את הסיסמה ונסו שוב.',
  registerGenericFailure: 'לא ניתן ליצור את החשבון כרגע. נסו שוב מאוחר יותר.',
  registerDuplicate: 'כבר קיים חשבון עם כתובת אימייל זו. נסו להתחבר במסך «התחברות».',
  registerDatabaseError:
    'יצירת החשבון נכשלה בשרת (פרופיל). ודאו שמיגרציות Phase 109 הורצו, או מחקו משתמש ישן ב-Authentication ונסו שוב.',
  registerConfirmEmail:
    'נשלח אימייל לאימות. אשרו את הכתובת ואז התחברו. בפיתוח מומלץ לכבות Confirm email ב-Supabase Auth.',
  registerAuthOrphanHint:
    'האימייל קיים במערכת ההתחברות אבל הפרופיל חסר. נסו שוב עם אותה סיסמה, או מחקו את המשתמש ב-Authentication.',
  passwordMismatch: 'הסיסמאות אינן תואמות.',
  requiredFields: 'נא למלא את כל השדות החובה.',
  invalidEmail: 'כתובת האימייל אינה תקינה.',
  profileIncomplete: 'יצירת החשבון לא הושלמה. נסו שוב או פנו לתמיכה.',
  authRequired: 'יש להתחבר לחשבון כדי להמשיך.',
} as const;

export type AuthErrorContext = 'login' | 'register';

function errorMessageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error ?? '');
}

export function mapAuthErrorToFriendly(
  error: unknown,
  context: AuthErrorContext = 'login',
): string {
  const message = errorMessageOf(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('already registered') ||
    lower.includes('already been registered') ||
    lower.includes('user already') ||
    lower.includes('email address is already') ||
    lower.includes('email_normalized') ||
    lower.includes('duplicate') ||
    lower.includes('23505')
  ) {
    return AUTH_COPY.registerDuplicate;
  }

  if (
    lower.includes('database error saving new user') ||
    lower.includes('database error') ||
    lower.includes('trigger') ||
    lower.includes('user_number')
  ) {
    return AUTH_COPY.registerDatabaseError;
  }

  if (
    lower.includes('email not confirmed') ||
    (lower.includes('confirm') && lower.includes('email'))
  ) {
    return context === 'register'
      ? AUTH_COPY.registerConfirmEmail
      : AUTH_COPY.genericAuthFailure;
  }

  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return context === 'register'
      ? AUTH_COPY.registerDuplicate
      : AUTH_COPY.genericAuthFailure;
  }

  if (lower.includes('disabled') || lower.includes('deleted') || lower.includes('not active')) {
    return AUTH_COPY.sessionBlocked;
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'אין חיבור לרשת. בדקו את החיבור ונסו שוב.';
  }

  if (
    lower.includes('password') &&
    (lower.includes('least') || lower.includes('weak') || lower.includes('short'))
  ) {
    return 'הסיסמה אינה עומדת בדרישות השרת. נסו סיסמה ארוכה יותר.';
  }

  return context === 'register'
    ? AUTH_COPY.registerGenericFailure
    : AUTH_COPY.genericAuthFailure;
}
