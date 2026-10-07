/** Phase 113 — user-facing Login Assistance copy (Hebrew only — AC-113-22 / D-113-16). */

export const MSG_NO_OPEN_URL =
  'אין קישור פתיחה לאתר זה. ניתן להעתיק פרטים ולהתחבר ידנית.';

/** Friendly Manual-mode guidance — no English jargon. */
export const MSG_MANUAL_ONLY =
  'באתר זה המילוי האוטומטי לא זמין. אפשר להעתיק את הפרטים ולהזין אותם באתר.';

export const MSG_COPIED = 'הועתק';

export const MSG_COPY_FAILED = 'ההעתקה נכשלה — בחרו את השדה והעתיקו ידנית.';

export const MSG_AUTO_ATTEMPTED =
  'ניסיון מילוי אוטומטי הופעל. אם השדות לא מולאו — העתיקו ידנית.';

export const MSG_OPENED = 'האתר נפתח בכרטיסייה חדשה.';

/** AC-113-23 — no loginUrl; Home URL will open. */
export const MSG_OPENED_HOME_FALLBACK =
  'לא אותר דף התחברות לאתר זה, לכן יפתח דף הבית.';

/** Retired from Digital Home tile-click (was a page-level yellow banner). */
export const MSG_NO_CREDENTIALS =
  'עדיין לא הוזנו פרטי התחברות לאתר זה. הוסיפו אותם בחלון האפליקציה בבית הדיגיטלי.';

/** Launch Card copy for CREDENTIAL_FIELDS without stored user values. */
export const MSG_MISSING_USER_CREDENTIALS_LAUNCH =
  'עדיין לא שמרת פרטי כניסה לאתר זה.';

export const LABEL_ADD_CREDENTIALS = 'הוסף פרטי כניסה';

/** Phase 123.1 — app context (AD-123-2). */
export const LABEL_EDIT_PROFILE = 'עריכת פרופיל';
/** O-123-26 — the same edit action when the profile it opens has incomplete credentials. */
export const LABEL_COMPLETE_CREDENTIALS = 'השלמת פרטי כניסה';
/** D-123-8 — own site approved with changed login fields; the profile still holds other values. */
export const MSG_LOGIN_FIELDS_UPDATED = 'שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.';
export const LABEL_ADD_PROFILE = 'הוספת פרופיל';
export const LABEL_ADD_FIRST_PROFILE = 'הוסף פרופיל';
export const MSG_NO_PROFILES = 'עדיין אין פרופיל לאתר זה.';
/** Phase 123.2 — app-actions menu (AD-123-14 / AD-123-17). */
export const LABEL_APP_ACTIONS = 'פעולות אפליקציה';
export const LABEL_EDIT_SITE_DETAILS = 'עריכת פרטי האתר';
/** Phase 123.3 — remove app (AD-123-11). */
export const LABEL_REMOVE_APP = 'הסרת אתר';

/** Launch Card copy for resolved NO_STORED_CREDENTIALS (informational — not an error). */
export const MSG_NO_STORED_CREDENTIALS_LAUNCH =
  'פרטי הכניסה לאתר אינם נשמרים בבית הדיגיטלי.';

/** Launch Card copy for resolved NOT_CONFIGURED (informational — not the page banner). */
export const MSG_NOT_CONFIGURED_LAUNCH =
  'ממתין להגדרת מנהל המערכת.';

export const LABEL_SUPPORT_AUTOMATIC = 'מילוי אוטומטי זמין';
export const LABEL_SUPPORT_BEST_EFFORT = 'מילוי אוטומטי — נסה וחזור';
export const LABEL_SUPPORT_MANUAL = 'מילוי ידני בלבד';

/** Launch Card service-open CTA — action only; service identity is the card header. */
export const LABEL_OPEN_SITE = 'פתח אתר';
export const LABEL_TRY_AUTO = 'מילוי פרטים אוטומטי';
export const LABEL_COPY = 'העתק';
export const LABEL_SHOW_PASSWORD = 'הצג סיסמה';
export const LABEL_HIDE_PASSWORD = 'הסתר סיסמה';
export const LABEL_CLOSE = 'סגור';
export const LABEL_ASSISTANCE = 'סיוע בהתחברות';

export const MSG_SELECT_PROFILE = 'בחרו פרופיל לפני ניסיון מילוי אוטומטי.';

/**
 * AD-123-1: replaces the execution-layer credentials_missing copy, which still names the removed
 * manage screen (src/execution is frozen, N-2).
 */
export const MSG_AUTOFILL_CREDENTIALS_MISSING =
  'פרטי הכניסה בפרופיל הזה חסרים. לחצו «השלמת פרטי כניסה» בחלון האתר והשלימו אותם.';
