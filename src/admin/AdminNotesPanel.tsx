import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ADMIN_NOTE_MAX_LENGTH,
  fetchAdminServiceNote,
  saveAdminServiceNote,
} from './adminRegistryApi';
import { formatAdminDateTime } from './adminPresentation';

export const ADMIN_NOTES_HE = {
  title: 'הערות',
  label: 'הערה פנימית לאתר',
  helper: 'ההערות גלויות למנהלים בלבד. לא לשמור כאן סיסמאות.',
  save: 'שמור הערה',
  saving: 'שומר…',
  cancel: 'בטל שינויים',
  updatedAt: (when: string): string => `עודכן לאחרונה: ${when}`,
  never: 'אין עדיין הערה לאתר זה.',
  loading: 'טוען הערה…',
  loadFailed: 'לא ניתן לטעון את ההערה.',
  saved: 'ההערה נשמרה.',
  saveFailed: 'שמירת ההערה נכשלה. נסו שוב.',
} as const;

interface AdminNotesPanelProps {
  serviceId: string;
  /** Unsaved note → joins the leave-site guard. */
  onDirtyChange: (state: { rowId: string; dirty: boolean }) => void;
  /** After a save: whether the service now has a note (catalog marker). */
  onSaved: (serviceId: string, hasNote: boolean) => void;
}

/** Phase 122.8 R4 — «הערות» tab: one admin-only note per site (`public.admin_service_notes`). */
export default function AdminNotesPanel({ serviceId, onDirtyChange, onSaved }: AdminNotesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const [body, setBody] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void fetchAdminServiceNote(serviceId)
      .then((note) => {
        if (cancelled) return;
        setBaseline(note?.body ?? '');
        setBody(note?.body ?? '');
        setUpdatedAt(note?.updated_at ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(ADMIN_NOTES_HE.loadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const dirty = !loading && !loadError && body !== baseline;

  useEffect(() => {
    onDirtyChange({ rowId: serviceId, dirty });
  }, [serviceId, dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange({ rowId: serviceId, dirty: false }), [serviceId, onDirtyChange]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const grow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const full = el.scrollHeight + el.offsetHeight - el.clientHeight;
    const max = Math.floor(window.innerHeight * 0.7);
    el.style.height = `${Math.min(full, max)}px`;
    el.style.overflowY = full > max ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    window.addEventListener('resize', grow);
    return () => window.removeEventListener('resize', grow);
  }, [grow]);

  useLayoutEffect(() => {
    grow();
  }, [body, loading, grow]);

  async function save(): Promise<void> {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await saveAdminServiceNote(serviceId, body);
      const next = saved?.body ?? '';
      setBaseline(next);
      setBody(next);
      setUpdatedAt(saved?.updated_at ?? null);
      setSuccess(ADMIN_NOTES_HE.saved);
      onSaved(serviceId, saved !== null);
    } catch {
      setError(ADMIN_NOTES_HE.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel admin-notes" data-section="admin-notes">
      <h3 className="admin-panel-title">{ADMIN_NOTES_HE.title}</h3>
      <p className="admin-panel-hint" data-part="notes-helper">
        {ADMIN_NOTES_HE.helper}
      </p>
      {loading ? (
        <p className="admin-muted" role="status">
          {ADMIN_NOTES_HE.loading}
        </p>
      ) : loadError ? (
        <p className="admin-error" role="alert" data-notice="notes-load-failed">
          {loadError}
        </p>
      ) : (
        <>
          <label className="admin-field admin-notes-field">
            <span className="admin-sr-only">{ADMIN_NOTES_HE.label}</span>
            <textarea
              ref={textareaRef}
              className="admin-notes-textarea"
              value={body}
              maxLength={ADMIN_NOTE_MAX_LENGTH}
              rows={14}
              dir="rtl"
              aria-label={ADMIN_NOTES_HE.label}
              data-field="admin-note"
              disabled={saving}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <p className="admin-muted admin-notes-updated" data-part="notes-updated-at">
            {updatedAt ? ADMIN_NOTES_HE.updatedAt(formatAdminDateTime(updatedAt)) : ADMIN_NOTES_HE.never}
          </p>
          <div className="admin-notes-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              data-action="save-note"
              disabled={!dirty || saving}
              onClick={() => void save()}
            >
              {saving ? ADMIN_NOTES_HE.saving : ADMIN_NOTES_HE.save}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              data-action="cancel-note"
              disabled={!dirty || saving}
              onClick={() => {
                setBody(baseline);
                setError(null);
              }}
            >
              {ADMIN_NOTES_HE.cancel}
            </button>
          </div>
          {error ? (
            <p className="admin-error" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="admin-success" role="status" data-notice="note-saved">
              {success}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
