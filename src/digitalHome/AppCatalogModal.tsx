import { useEffect, useRef } from 'react';
import AppCatalog, { type AppCatalogProps } from './AppCatalog';

export const LABEL_ADD_APP = '+ הוספת אפליקציה';
export const CATALOG_MODAL_TITLE = 'הוספת אפליקציה';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface AppCatalogModalProps extends Omit<AppCatalogProps, 'searchInputRef'> {
  onClose: () => void;
}

/** AD-123-8 — large central catalog modal over Digital Home. Closing keeps Digital Home as it was. */
export default function AppCatalogModal({ onClose, ...catalogProps }: AppCatalogModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (searchRef.current ?? dialogRef.current)?.focus();
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
      // AddSiteModal / catalog offer are layered inside the catalog and own the keyboard while open.
      const layer = dialog.querySelector<HTMLElement>('.modal-overlay');
      if (event.key === 'Escape') {
        if (layer) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const scope = layer ?? dialog;
      const items = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !scope.contains(active)) {
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
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    // D-123-3: the catalog contains a form (search), so the backdrop never closes it.
    <div className="dh-catalog-overlay" data-dialog-form="true">
      <div
        ref={dialogRef}
        className="dh-catalog-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dh-catalog-title"
        dir="rtl"
        tabIndex={-1}
        data-catalog-modal="true"
      >
        <header className="dh-catalog-header">
          <h2 id="dh-catalog-title" className="dh-catalog-title">
            {CATALOG_MODAL_TITLE}
          </h2>
          <button type="button" className="la-icon-btn dh-catalog-close" aria-label="סגירה" onClick={onClose}>
            ×
          </button>
        </header>
        <AppCatalog {...catalogProps} searchInputRef={searchRef} />
      </div>
    </div>
  );
}
