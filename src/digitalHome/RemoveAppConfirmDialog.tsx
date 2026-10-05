import { useEffect, useRef } from 'react';

export const REMOVE_APP_CONFIRM_TITLE = (name: string) => `להסיר את ${name}?`;
export const REMOVE_APP_CONFIRM_BODY =
  'כל הפרופילים ופרטי ההתחברות של האפליקציה יימחקו מכל המכשירים שלך.';
export const REMOVE_APP_CONFIRM_ACTION = 'הסרה';
export const REMOVE_APP_CONFIRM_CANCEL = 'ביטול';

const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface RemoveAppConfirmDialogProps {
  serviceName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** AD-123-11 — in-app confirm for «הסרת אפליקציה» (N-4: never a browser dialog). Escape = cancel. */
export default function RemoveAppConfirmDialog({ serviceName, onConfirm, onCancel }: RemoveAppConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => {
      if (opener?.isConnected) {
        window.requestAnimationFrame(() => opener.focus());
      }
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
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
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="dh-confirm-overlay" data-remove-app-confirm="true">
      <div
        ref={dialogRef}
        className="dh-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dh-remove-app-title"
        aria-describedby="dh-remove-app-body"
        dir="rtl"
      >
        <h2 id="dh-remove-app-title" className="dh-confirm-title">
          {REMOVE_APP_CONFIRM_TITLE(serviceName)}
        </h2>
        <p id="dh-remove-app-body" className="dh-confirm-body">
          {REMOVE_APP_CONFIRM_BODY}
        </p>
        <div className="dh-confirm-actions">
          <button type="button" className="dh-confirm-btn dh-confirm-btn--danger" data-action="confirm-remove-app" onClick={onConfirm}>
            {REMOVE_APP_CONFIRM_ACTION}
          </button>
          <button ref={cancelRef} type="button" className="dh-confirm-btn" data-action="cancel-remove-app" onClick={onCancel}>
            {REMOVE_APP_CONFIRM_CANCEL}
          </button>
        </div>
      </div>
    </div>
  );
}
