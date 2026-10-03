/**
 * Phase 122 — Admin Workspace (presentation only): catalog / workspace modes, workspace
 * tabs and the unsaved-changes guard. Pure helpers; no I/O, no save-path logic.
 */
import type { AdminConfirmOptions } from './AdminConfirmDialog';
import type { AdminRegistryRow, GlobalRegistryInput } from './adminRegistryApi';

export const ADMIN_WORKSPACE_HE = {
  registryNav: 'הגדרת אתרים',
  catalogTitle: 'הגדרת אתרים',
  backToCatalog: 'מעבר לרשימת האתרים',
  switchSite: 'החלפת אתר',
  switchSearch: 'חיפוש אתר',
  switchEmpty: 'לא נמצאו אתרים.',
  newSite: 'אתר חדש',
  categoryPlaceholder: 'בחרו קטגוריה',
  categoryRequired: 'יש לבחור קטגוריה',
  unsavedLeave: 'יש באתר הזה שינויים שלא נשמרו. לעזוב בלי לשמור?',
  unsavedLeaveTitle: 'לעזוב את האתר?',
  unsavedLeaveConfirm: 'לעזוב בלי לשמור',
  detailsUnsaved: 'יש שינויים שלא נשמרו בפרטי האתר',
  detailsUnsavedLink: 'מעבר לפרטי אתר',
} as const;

export type WorkspaceTab = 'details' | 'login' | 'test' | 'notes';

export const WORKSPACE_TABS: ReadonlyArray<{ id: WorkspaceTab; label: string }> = [
  { id: 'details', label: 'פרטי אתר' },
  { id: 'login', label: 'הגדרת כניסה ומילוי' },
  { id: 'test', label: 'בדיקה והפעלה' },
  { id: 'notes', label: 'הערות' },
];

export const WORKSPACE_TAB_HE = {
  createOnlyHint: 'זמין לאחר שמירת האתר.',
  userOwnedLogin: 'זו הגשה בבעלות משתמש — הגדרת כניסה ומילוי אינה זמינה כאן.',
  userOwnedTest: 'זו הגשה בבעלות משתמש — בדיקת מילוי אינה זמינה כאן.',
  testNeedsFields: 'בדיקת מילוי זמינה לאחר הגדרת «פרטי כניסה» כשדות כניסה ושמירת האתר.',
  loginNeedsFields: 'הגדרת כניסה ומילוי זמינה לאחר הגדרת «פרטי כניסה» כשדות כניסה ב«פרטי אתר» ושמירת האתר.',
} as const;

/** 122.4 — one-line description under the workspace heading, per tab. */
export const WORKSPACE_TAB_DESCRIPTION_HE: Record<WorkspaceTab, string> = {
  details: 'שם, כתובות, קטגוריה, סטטוס ושדות הכניסה שהמשתמש שומר.',
  login: 'אופי הכניסה, ואיך הכספת ממלאת את השדות באתר.',
  test: 'הרצת בדיקת מילוי מול המיפוי השמור, ומצב המיפוי.',
  notes: 'הערות פנימיות על האתר, למנהלים בלבד.',
};

export const WORKSPACE_LAYOUT_HE = {
  dangerTitle: 'אזור מסוכן',
  dangerHint: 'פעולות שמשפיעות על כל המשתמשים של האתר.',
  testResultTitle: 'תוצאה ומצב',
  testResultEmpty: 'תוצאת הבדיקה תופיע כאן אחרי הרצת הבדיקה.',
  catalogEmpty: 'לא נמצאו אתרים התואמים לסינון.',
} as const;

/** Status chip color per existing service status (green / amber / red / gray). */
export function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return 'admin-badge--ok';
    case 'pending_review':
      return 'admin-badge--warn';
    case 'disabled':
      return 'admin-badge--danger';
    default:
      return 'admin-badge--muted';
  }
}

/** Create mode: only «פרטי אתר» until the first save (§4.3). */
export function workspaceTabEnabled(tab: WorkspaceTab, isCreating: boolean): boolean {
  return tab === 'details' || !isCreating;
}

export interface ServiceFormSnapshotInput {
  form: GlobalRegistryInput;
  loginEntryType: string;
  credentialMode: string;
  credentialFields: unknown;
}

/** Comparable key of everything the service form save reads from the editor state. */
export function serviceFormSnapshot(input: ServiceFormSnapshotInput): string {
  return JSON.stringify([input.form, input.loginEntryType, input.credentialMode, input.credentialFields]);
}

export interface WorkspaceDirtyInput {
  editing: boolean;
  formSnapshot: string;
  formBaseline: string | null;
  rowId: string | null;
  specialDraftDirty: { rowId: string; dirty: boolean } | null;
  notesDirty?: { rowId: string; dirty: boolean } | null;
}

/**
 * Leaving the site loses: unsaved service-form edits (form, login entry, credential mode /
 * fields vs the state loaded or last saved), an unsaved SPECIAL draft and an unsaved admin note
 * of this row.
 * `configurationTouched` is not read: it stays set after a save, while every credential
 * edit it tracks already changes the snapshot.
 */
export function workspaceDirty(input: WorkspaceDirtyInput): boolean {
  if (!input.editing) return false;
  const formDirty = input.formBaseline !== null && input.formSnapshot !== input.formBaseline;
  const specialDirty =
    input.rowId !== null && input.specialDraftDirty?.rowId === input.rowId && input.specialDraftDirty.dirty;
  const notesDirty = input.rowId !== null && input.notesDirty?.rowId === input.rowId && input.notesDirty.dirty;
  return formDirty || specialDirty || notesDirty;
}

/** Guard for leaving the site; Cancel keeps everything. */
export async function confirmLeaveWorkspace(dirty: boolean, ask: (message: string) => Promise<boolean>): Promise<boolean> {
  if (!dirty) return true;
  return ask(ADMIN_WORKSPACE_HE.unsavedLeave);
}

/** In-app dialog for {@link confirmLeaveWorkspace}. */
export function leaveWorkspaceDialog(message: string): AdminConfirmOptions {
  return {
    name: 'leave-site',
    title: ADMIN_WORKSPACE_HE.unsavedLeaveTitle,
    body: message,
    confirmLabel: ADMIN_WORKSPACE_HE.unsavedLeaveConfirm,
    tone: 'danger',
  };
}

/** Same text match as the catalog search. */
export function registryRowMatches(
  row: AdminRegistryRow,
  query: string,
  categoryLabel: (categoryId: string | null | undefined) => string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.display_name, categoryLabel(row.category_id), row.login_url ?? '', row.primary_url ?? '']
    .join(' ')
    .toLowerCase()
    .includes(q);
}
