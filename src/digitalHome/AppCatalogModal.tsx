import { useEffect, useRef, useState } from 'react';
import AppCatalog, { type AppCatalogProps } from './AppCatalog';

export const LABEL_ADD_APP = '+ הוספת אפליקציה';
export const CATALOG_MODAL_TITLE = 'הוספת אתר לבית הדיגיטלי';
/**
 * O-123-35 / O-123-44 — the catalog (with any add form inside it) fades out after an add, then the home
 * shows the new tiles. Must equal the `dh-catalog-exit` duration in App.css.
 */
export const CATALOG_FADE_MS = 500;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface AppCatalogModalProps extends Omit<AppCatalogProps, 'searchInputRef' | 'onAddSequenceDone'> {
  onClose: () => void;
  /**
   * O-123-35 — called after the post-add fade instead of onClose; the host closes the catalog and
   * moves focus to the first new tile (the opener is not refocused).
   */
  onAdded?: (ids: string[]) => void;
}

/** AD-123-8 — large central catalog modal over Digital Home. Closing keeps Digital Home as it was. */
export default function AppCatalogModal({ onClose, onAdded, ...catalogProps }: AppCatalogModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const restoreFocusRef = useRef(true);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (searchRef.current ?? dialogRef.current)?.focus();
    return () => {
      if (restoreFocusRef.current && opener?.isConnected) {
        window.requestAnimationFrame(() => opener.focus());
      }
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog || closingRef.current) return;
      // AddSiteModal / catalog offer are layered inside the catalog and own the keyboard while open.
      // O-123-13/14: the catalog offer sits above the still-open (inert) form; the top layer owns Tab.
      const layers = dialog.querySelectorAll<HTMLElement>('.modal-overlay:not([inert])');
      const layer = layers.length > 0 ? layers[layers.length - 1] : null;
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

  function finishAdd(ids: string[]) {
    if (closingRef.current) return;
    closingRef.current = true;
    const done = () => {
      if (onAdded) {
        restoreFocusRef.current = false;
        onAdded(ids);
      } else {
        onCloseRef.current();
      }
    };
    // O-123-44: reduced motion closes at once, with no fade.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done();
      return;
    }
    setClosing(true);
    window.setTimeout(done, CATALOG_FADE_MS);
  }

  return (
    // D-123-3: the catalog contains a form (search), so the backdrop never closes it.
    <div
      className="dh-catalog-overlay"
      data-dialog-form="true"
      data-closing={closing ? 'true' : undefined}
      inert={closing}
    >
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
        <AppCatalog {...catalogProps} searchInputRef={searchRef} onAddSequenceDone={finishAdd} />
      </div>
    </div>
  );
}
