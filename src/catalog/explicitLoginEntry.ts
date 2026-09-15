import { urlsReferToSameService } from '../supabase/registryPersistence';

/** Active MVP login-entry types (D-108-6). Discovery classifications are not written. */
export type ExplicitLoginEntryType = 'primary_page' | 'direct_url';

export type ExplicitLoginUrlSource = 'admin' | 'user';

export const SAME_AS_WEBSITE_LABEL = 'דף הכניסה זהה לכתובת האתר';
export const LOGIN_URL_FIELD_LABEL = 'כתובת כניסה';
export const ADMIN_PRIMARY_PAGE_LABEL = 'כניסה מדף הבית';
export const ADMIN_DIRECT_URL_LABEL = 'כתובת כניסה ייעודית';
export const EMPTY_LOGIN_URL_MESSAGE = 'יש להזין כתובת כניסה';
export const INVALID_LOGIN_URL_MESSAGE = 'כתובת הכניסה אינה תקינה';

export function isExplicitHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Checkbox / entry-type default from stored fields only. Does not crawl.
 * Null or same as the website URL → same-as-website (primary_page).
 */
export function defaultSameAsWebsite(
  loginUrl: string | null | undefined,
  websiteUrl: string,
): boolean {
  const stored = loginUrl?.trim();
  if (!stored) {
    return true;
  }
  return urlsReferToSameService(stored, websiteUrl);
}

export function defaultLoginEntryType(
  loginUrl: string | null | undefined,
  websiteUrl: string,
  storedEntryType?: unknown,
): ExplicitLoginEntryType {
  if (storedEntryType === 'direct_url') {
    return 'direct_url';
  }
  if (storedEntryType === 'primary_page') {
    return 'primary_page';
  }
  return defaultSameAsWebsite(loginUrl, websiteUrl) ? 'primary_page' : 'direct_url';
}

/**
 * Resolve the human-owned login URL. Does not guess a missing dedicated URL.
 * `sameAsWebsite` true writes the website URL (`primary_page`).
 */
export function resolveExplicitLoginEntry(input: {
  websiteUrl: string;
  sameAsWebsite: boolean;
  dedicatedLoginUrl?: string | null;
}): { loginUrl: string; loginEntryType: ExplicitLoginEntryType } {
  const websiteUrl = input.websiteUrl.trim();
  if (input.sameAsWebsite) {
    return { loginUrl: websiteUrl, loginEntryType: 'primary_page' };
  }

  const dedicated = input.dedicatedLoginUrl?.trim() ?? '';
  if (!dedicated) {
    throw new Error(EMPTY_LOGIN_URL_MESSAGE);
  }
  if (!isExplicitHttpUrl(dedicated)) {
    throw new Error(INVALID_LOGIN_URL_MESSAGE);
  }

  return { loginUrl: dedicated, loginEntryType: 'direct_url' };
}

/**
 * Ownership metadata for an explicit save. Preserves unrelated keys.
 * Does not write discovery outcome, confidence, or method.
 */
export function stampExplicitLoginMetadata(
  metadata: Record<string, unknown> | null | undefined,
  source: ExplicitLoginUrlSource,
  loginEntryType: ExplicitLoginEntryType,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    loginUrlSource: source,
    loginEntryType,
  };
}
