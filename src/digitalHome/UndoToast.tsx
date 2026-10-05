import { useEffect, useRef, useState } from 'react';

export const UNDO_WINDOW_MS = 5000;
export const UNDO_TOAST_TEXT = (name: string) => `האפליקציה ${name} הוסרה.`;
export const UNDO_TOAST_ACTION = 'ביטול';

export interface UndoToastProps {
  serviceName: string;
  /** `Date.now()` value at which the removal commits. */
  deadline: number;
  onUndo: () => void;
}

/** AD-123-11 — Undo window of a pending removal. The commit timer is owned by the caller. */
export default function UndoToast({ serviceName, deadline, onUndo }: UndoToastProps) {
  const undoRef = useRef<HTMLButtonElement | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // The opener (the app's menu) is gone; keep «ביטול» one keystroke away.
    const active = document.activeElement;
    if (!active || active === document.body) {
      undoRef.current?.focus();
    }
  }, []);

  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));

  return (
    <div className="dh-undo-toast" role="status" aria-live="polite" dir="rtl" data-undo-toast="true">
      <span className="dh-undo-text">{UNDO_TOAST_TEXT(serviceName)}</span>
      <span className="dh-undo-countdown" aria-hidden="true" data-undo-seconds={seconds}>
        {seconds}
      </span>
      <button ref={undoRef} type="button" className="dh-undo-btn" data-action="undo-remove-app" onClick={onUndo}>
        {UNDO_TOAST_ACTION}
      </button>
    </div>
  );
}
