import type { AdminRegistryRow, SubmitterProfile } from './adminRegistryApi';

export const UNKNOWN_SUBMITTER_HE = 'משתמש לא מזוהה';

/** Submitter display parts from an `admin_submitter_profiles` row (empty strings when unknown). */
export function submitterLabel(profile: SubmitterProfile | null | undefined): { name: string; email: string } {
  const name = [profile?.first_name, profile?.last_name]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
  return { name, email: profile?.email?.trim() ?? '' };
}

/** AC-107-14 — unique category code from display name (+ uniqueness). */
export function generateCategoryId(
  displayName: string,
  existingIds: Iterable<string>,
): string {
  const taken = new Set(
    [...existingIds].map((id) => id.trim().toLowerCase()).filter(Boolean),
  );
  const slug = displayName
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const base = slug || `cat_${Date.now().toString(36)}`;
  let candidate = base;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}_${n}`;
    n += 1;
  }
  return candidate;
}

export function formatAdminDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Date and HH:mm in Israel time (submission cards). */
export function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Jerusalem',
  });
  const time = date.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem',
  });
  return `${day}, ${time}`;
}

/** App bar «<first> <last> · <email>»; the email alone when the name is empty. */
export function signedInAdminLabel(admin: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): { name: string | null; email: string } {
  const name = [admin.firstName, admin.lastName].map((part) => part?.trim() ?? '').filter(Boolean).join(' ');
  return { name: name || null, email: admin.email };
}

/** The trimmed value when it is an absolute http(s) URL with a host; otherwise null (no link). */
export function httpUrlOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * The dedicated login URL to show / open: only for `direct_url` entry with a valid http(s) URL.
 * With home-page entry `login_url` holds the home URL (explicitLoginEntry), so nothing is shown.
 */
export function dedicatedLoginUrlOrNull(
  loginEntryType: unknown,
  loginUrl: string | null | undefined,
): string | null {
  return loginEntryType === 'direct_url' ? httpUrlOrNull(loginUrl) : null;
}

export function statusLabelHe(status: string): string {
  switch (status) {
    case 'active':
      return 'פעיל';
    case 'deprecated':
      return 'מיושן';
    case 'disabled':
      return 'מושבת';
    case 'pending_review':
      return 'ממתין לאישור';
    default:
      return status;
  }
}

/** Card “added by” origin (AC-107-9) — Built-in / Administrator / submitter name. Never the owner uuid. */
export function addedByLabel(row: AdminRegistryRow, submitter?: SubmitterProfile | null): string {
  if (row.source_type === 'built_in') return 'מובנה';
  if (row.source_type === 'admin') return 'מנהל מערכת';
  if (row.source_type === 'user' || row.owner_user_id) {
    const { name, email } = submitterLabel(submitter);
    return name || email || UNKNOWN_SUBMITTER_HE;
  }

  const meta = row.metadata ?? {};
  const fromMeta =
    (typeof meta.submittedBy === 'string' && meta.submittedBy.trim()) ||
    (typeof meta.submitted_by === 'string' && meta.submitted_by.trim()) ||
    (typeof meta.provenance === 'object' &&
      meta.provenance &&
      typeof (meta.provenance as { submittedBy?: string }).submittedBy ===
        'string' &&
      (meta.provenance as { submittedBy: string }).submittedBy.trim()) ||
    '';

  if (fromMeta) return fromMeta;
  if (row.source_type === 'approved_global') return 'מאושר ממשתמש';
  return '—';
}

export function sourceFilterKind(
  row: AdminRegistryRow,
): 'built_in' | 'custom' | 'user_submitted' {
  if (row.source_type === 'built_in') return 'built_in';
  if (
    row.owner_user_id != null ||
    row.source_type === 'user' ||
    row.source_type === 'approved_global'
  ) {
    return 'user_submitted';
  }
  return 'custom';
}

export function sourceKindLabelHe(row: AdminRegistryRow): string {
  switch (sourceFilterKind(row)) {
    case 'built_in':
      return 'מובנה';
    case 'user_submitted':
      return 'הוגש ע"י משתמש';
    default:
      return 'מותאם / מנהל';
  }
}
