/**
 * O-123-13 — copy of the catalog offer shown when a custom add matches a catalog site. `name` is
 * always the catalog site's display name, never the name the user typed.
 */
export function catalogOfferFoundTitle(name: string): string {
  return `מצאנו את ${name} בחנות האתרים`;
}

export function catalogOfferSupportedText(name: string): string {
  return `${name} כבר נתמך, ולכן אין צורך להוסיף אותו כאתר מותאם אישית.`;
}

export const CATALOG_OFFER_ADD_LABEL = 'הוספה לבית הדיגיטלי';
export const CATALOG_OFFER_BACK_LABEL = 'חזרה לחנות האתרים';

/** O-123-35 — catalog picker copy. */
export const LABEL_ALL_CATEGORIES = 'הכול';
export const LABEL_ALREADY_IN_HOME = '✓ כבר נוסף';

export function pickAddLabel(count: number): string {
  return count === 1 ? 'הוספת האתר' : `הוספת ${count} אתרים`;
}

export function pickAddedLabel(count: number): string {
  return count === 1 ? '✓ נוסף לבית' : `✓ נוספו ${count} אתרים`;
}
