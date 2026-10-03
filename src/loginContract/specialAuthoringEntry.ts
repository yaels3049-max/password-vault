/**
 * Phase 121 §4.7 / D-121-20 — SPECIAL authoring initial surface + expected origin.
 *
 * Reuses ExplicitLoginEntryType semantics (HOME = primary_page, DEDICATED = direct_url).
 * Generic only — no site-identity / serviceId / fixture-name branches.
 */

import type { ExplicitLoginEntryType } from '../catalog/explicitLoginEntry';

export type SpecialAuthoringEntryResolution =
  | {
      ok: true;
      entryType: ExplicitLoginEntryType;
      /** Resolved authoring surface URL (Home or dedicated Login Entry). */
      authoringUrl: string;
      /** Fail-closed HTTPS origin of authoringUrl. */
      allowedOrigin: string;
    }
  | { ok: false; reason: 'missing_primary_url' | 'missing_login_url' | 'invalid_origin' };

/**
 * Mirror of catalog defaultLoginEntryType for SPECIAL authoring (no persistence deps).
 * Explicit stored type wins; empty dedicated login → HOME ENTRY.
 */
function resolveEntryType(
  loginUrl: string,
  primaryUrl: string,
  storedEntryType: unknown,
): ExplicitLoginEntryType {
  if (storedEntryType === 'direct_url') {
    return 'direct_url';
  }
  if (storedEntryType === 'primary_page') {
    return 'primary_page';
  }
  if (!loginUrl) {
    return 'primary_page';
  }
  try {
    const login = new URL(loginUrl);
    const primary = new URL(primaryUrl);
    if (login.href === primary.href) {
      return 'primary_page';
    }
  } catch {
    // fall through — treat as dedicated if login present but unparsable vs primary
  }
  return 'direct_url';
}

/**
 * HOME ENTRY → primary_url (Home URL).
 * DEDICATED LOGIN ENTRY → login_url.
 * Origin is fail-closed HTTPS of the resolved authoring URL (not weakened).
 */
export function resolveSpecialAuthoringEntry(input: {
  primaryUrl: string | null | undefined;
  loginUrl: string | null | undefined;
  metadata?: Record<string, unknown> | null;
}): SpecialAuthoringEntryResolution {
  const primaryUrl = (input.primaryUrl ?? '').trim();
  const loginUrl = (input.loginUrl ?? '').trim();
  if (!primaryUrl) {
    return { ok: false, reason: 'missing_primary_url' };
  }

  const entryType = resolveEntryType(
    loginUrl,
    primaryUrl,
    input.metadata?.loginEntryType,
  );

  let authoringUrl: string;
  if (entryType === 'primary_page') {
    authoringUrl = primaryUrl;
  } else {
    if (!loginUrl) {
      return { ok: false, reason: 'missing_login_url' };
    }
    authoringUrl = loginUrl;
  }

  try {
    const parsed = new URL(authoringUrl);
    if (parsed.protocol !== 'https:') {
      return { ok: false, reason: 'invalid_origin' };
    }
    return {
      ok: true,
      entryType,
      authoringUrl,
      allowedOrigin: parsed.origin,
    };
  } catch {
    return { ok: false, reason: 'invalid_origin' };
  }
}
