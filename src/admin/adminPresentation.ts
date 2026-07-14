import type { AdminRegistryRow } from './adminRegistryApi';

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

/** Card “added by” origin (AC-107-9) — Built-in / Administrator / username. */
export function addedByLabel(row: AdminRegistryRow): string {
  if (row.source_type === 'built_in') return 'מובנה';
  if (row.source_type === 'admin') return 'מנהל מערכת';

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
  if (row.owner_user_id) {
    return `משתמש ${row.owner_user_id.slice(0, 8)}…`;
  }
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
