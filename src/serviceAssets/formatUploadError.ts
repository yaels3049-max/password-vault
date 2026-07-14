/**
 * Turn raw Storage/PostgREST/proxy errors into short Hebrew messages.
 * Never surface HTML/script bodies (e.g. network filter interstitial pages).
 */
export function formatIconUploadError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  const text = raw.trim();
  if (!text) {
    return 'העלאת האייקון נכשלה. נסו שוב.';
  }

  const looksLikeHtml =
    /<\/?[a-z][\s\S]*>/i.test(text) ||
    /<!doctype/i.test(text) ||
    /<script/i.test(text) ||
    /safepage\.|neto\.net\.il/i.test(text) ||
    /Unexpected token\s+'<'/i.test(text) ||
    /is not valid JSON/i.test(text);

  if (looksLikeHtml) {
    return (
      'ההעלאה נחסמה ע״י פילטר רשת (למשל Netfree/safepage) או הוחזר HTML במקום תשובת Storage. ' +
      'ב־DEV בקשות אמורות לעבור דרך /dev-supabase-proxy — רעננו את הדף ונסו שוב. ' +
      'אם ממשיך: אפשרו *.supabase.co בפילטר, או ודאו שמיגרציית Phase 111 רצה (דלי service-assets).'
    );
  }

  if (/ProxyBlocked|HTML filter page|safepage redirect/i.test(text)) {
    return (
      'ההעלאה נחסמה ע״י פילטר רשת בין Vite ל־Supabase. ' +
      'אפשרו *.supabase.co בתהליך Node (או ב־Netfree), הפעילו מחדש את npm run dev, ונסו שוב.'
    );
  }

  if (/bucket not found|not found.*service-assets|No such bucket/i.test(text)) {
    return 'דלי Storage בשם service-assets לא קיים. יש להריץ את מיגרציית Phase 111.';
  }

  if (/row-level security|RLS|permission denied|not authorized|401|403/i.test(text)) {
    return 'אין הרשאה להעלות אייקון. ודאו שאתם מחוברים כמנהל ושמדיניות Storage מאפשרת העלאה (is_admin).';
  }

  if (/relation ["']?service_assets["']? does not exist|Could not find the table/i.test(text)) {
    return 'טבלת service_assets חסרה. יש להריץ את מיגרציית Phase 111.';
  }

  if (/Failed to fetch|NetworkError|network/i.test(text)) {
    return 'כשל רשת בהעלאה ל־Storage. בדקו חיבור לאינטרנט ול־Supabase (או את פרוקסי הפיתוח).';
  }

  // Truncate very long technical messages
  if (text.length > 220) {
    return `${text.slice(0, 200)}…`;
  }

  return text;
}
