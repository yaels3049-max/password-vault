/** Phase 109 — email / phone normalization (account identity). */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Digits-only phone; keeps leading + if present for intl. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    return '';
  }
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  return BASIC_EMAIL_RE.test(normalizeEmail(email));
}
