import { useEffect, useRef, type MouseEvent } from 'react';

/**
 * D-123-3 — backdrop rule for every user dialog:
 * - a dialog that contains a form never closes on a backdrop click;
 * - any other dialog closes only when the press AND the release are both on the backdrop
 *   (a text-selection drag that ends on the backdrop is not a backdrop click).
 * ×, «ביטול» and Escape stay the explicit ways to close.
 */
export function useBackdropDismiss(
  onClose: () => void,
  options: { containsForm: boolean; disabled?: boolean },
): { onMouseDown?: (event: MouseEvent<HTMLElement>) => void; onClick?: (event: MouseEvent<HTMLElement>) => void } {
  const pressStartedOnBackdrop = useRef(false);
  if (options.containsForm) {
    return {};
  }
  return {
    onMouseDown: (event) => {
      pressStartedOnBackdrop.current = event.target === event.currentTarget;
    },
    onClick: (event) => {
      const started = pressStartedOnBackdrop.current;
      pressStartedOnBackdrop.current = false;
      if (!options.disabled && started && event.target === event.currentTarget) {
        onClose();
      }
    },
  };
}

/** Escape closes the dialog (document listener; later-mounted inner layers run after outer ones). */
export function useEscapeToClose(onClose: () => void, enabled = true): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
