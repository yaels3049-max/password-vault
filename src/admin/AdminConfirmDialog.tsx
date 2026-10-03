/**
 * Phase 122.5 R3 — the one in-app confirmation for the Admin (no browser dialogs).
 * Same look as the «אשר מיפוי» confirmation; Esc = cancel; Tab stays inside; RTL.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface AdminConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  /** Which button has focus when the dialog opens (default: cancel). */
  defaultFocus?: 'confirm' | 'cancel';
  /** `data-admin-confirm` value, so a caller / test can tell dialogs apart. */
  name: string;
}

interface AdminConfirmDialogProps extends AdminConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let dialogSeq = 0;

export default function AdminConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'ביטול',
  tone = 'primary',
  defaultFocus = 'cancel',
  name,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) idRef.current = `admin-confirm-${(dialogSeq += 1)}`;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (defaultFocus === 'confirm' ? confirmRef : cancelRef).current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) {
        (defaultFocus === 'confirm' ? confirmRef : cancelRef).current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      previous?.focus();
    };
  }, [defaultFocus]);

  const titleId = `${idRef.current}-title`;
  const bodyId = `${idRef.current}-body`;
  return (
    <div
      className="admin-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="admin-modal admin-autofill-confirm admin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
        dir="rtl"
        data-admin-confirm={name}
      >
        <h3 id={titleId} data-part="confirm-title">
          {title}
        </h3>
        {body ? (
          <div id={bodyId} className="admin-confirm-body" data-part="confirm-body">
            {body}
          </div>
        ) : null}
        <div className="admin-actions-row admin-autofill-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="admin-btn admin-btn-secondary"
            data-action="confirm-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`admin-btn ${tone === 'danger' ? 'admin-btn-danger' : 'admin-btn-primary'}`}
            data-action="confirm-accept"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * `ask(options)` opens the dialog and resolves true on confirm, false on cancel / Esc /
 * overlay click. Render `dialog` once in the component.
 */
export function useAdminConfirm(): {
  ask: (options: AdminConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<{
    options: AdminConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  function ask(options: AdminConfirmOptions): Promise<boolean> {
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => setPending({ options, resolve }));
  }

  function settle(value: boolean) {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(value);
  }

  const dialog = pending ? (
    <AdminConfirmDialog {...pending.options} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
  ) : null;
  return { ask, dialog };
}
