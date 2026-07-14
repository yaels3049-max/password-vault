import { useEffect, useRef, useState } from 'react';
import type { AdminRegistryRow } from './adminRegistryApi';
import {
  fileAcceptAttribute,
  formatIconUploadError,
  normalizeIconToSizes,
  readActiveIconPointer,
  resolveManagedIconUrl,
  validateIconFile,
} from '../serviceAssets';

interface IconAssetEditorProps {
  row: AdminRegistryRow;
  onUploadFile: (file: File) => Promise<void>;
  onSaveSecondaryMetadata: (patch: {
    icon: string;
    faviconSiteUrl: string;
    iconSource: string;
  }) => Promise<void>;
  onRefreshAsset?: (options?: { force?: boolean }) => Promise<void>;
}

export default function IconAssetEditor({
  row,
  onUploadFile,
  onSaveSecondaryMetadata,
  onRefreshAsset,
}: IconAssetEditorProps) {
  const metadata = row.metadata ?? {};
  const pointer = readActiveIconPointer(metadata);
  const previewUrl = resolveManagedIconUrl({ serviceId: row.id, metadata }) ?? null;
  const fileRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const displayPreview = localPreview || previewUrl;

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
    };
  }, []);

  function replaceLocalPreview(nextUrl: string | null) {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
    if (nextUrl) {
      localPreviewRef.current = nextUrl;
    }
    setLocalPreview(nextUrl);
  }

  return (
    <section className="admin-panel">
      <h3 className="admin-panel-title">אייקון מנוהל (העלאת קובץ)</h3>
      <p className="admin-panel-hint">
        בחרו קובץ תמונה (PNG / JPEG / WebP / ICO). התמונה תנוקה משולי רקע ריקים
        ותוצג כאייקון מלא בריבוע (סגנון אנדרואיד, בלי חיתוך של הלוגו עצמו).
        לאחר העלאה האייקון נשמר ב־Storage והופך לפעיל בכל המסכים.
      </p>

      <div className="admin-icon-preview-row" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div
          className="admin-icon-preview"
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            border: '1px solid #ccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: '#f5f5f5',
            fontSize: 28,
            flexShrink: 0,
          }}
        >
          {displayPreview ? (
            <img
              src={displayPreview}
              alt=""
              width={72}
              height={72}
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            />
          ) : (
            <span>{row.icon?.trim() || row.display_name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: '#444' }}>
          {pointer ? (
            <>
              <div>
                מקור: <strong>{pointer.assetSource}</strong> · גרסה {pointer.version}
              </div>
              <div style={{ wordBreak: 'break-all' }}>{pointer.publicUrl}</div>
            </>
          ) : (
            <div>אין אייקון מנוהל פעיל — יוצג fallback עד להעלאה.</div>
          )}
        </div>
      </div>

      <div className="admin-form" style={{ marginTop: 12 }}>
        <input
          ref={fileRef}
          type="file"
          accept={fileAcceptAttribute()}
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const invalid = validateIconFile(file);
            if (invalid) {
              setError(invalid);
              return;
            }
            setError(null);
            setBusy(true);
            void (async () => {
              try {
                // Show contained/normalized preview ASAP (full logo, no crop).
                const variants = await normalizeIconToSizes(file);
                const previewBlob =
                  variants.find((v) => v.size === 128)?.blob ??
                  variants[variants.length - 1]?.blob;
                if (previewBlob) {
                  replaceLocalPreview(URL.createObjectURL(previewBlob));
                }
                await onUploadFile(file);
              } catch (err: unknown) {
                setError(formatIconUploadError(err));
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'מעלה…' : 'בחירת קובץ והעלאה'}
        </button>
        {onRefreshAsset ? (
          <button
            type="button"
            className="admin-btn"
            disabled={busy}
            style={{ marginInlineStart: 8 }}
            onClick={() => {
              setBusy(true);
              setError(null);
              void onRefreshAsset({ force: false })
                .catch((err: unknown) => {
                  setError(formatIconUploadError(err));
                })
                .finally(() => setBusy(false));
            }}
          >
            רענון אייקון (לא דורס מנהל)
          </button>
        ) : null}
        {error ? (
          <p
            className="admin-error"
            style={{
              color: '#b00020',
              marginTop: 8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 120,
              overflow: 'auto',
            }}
          >
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className="admin-btn"
        style={{ marginTop: 16 }}
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? 'הסתר מתקדם' : 'מתקדם (אמוג׳י / favicon URL — משני)'}
      </button>

      {showAdvanced ? (
        <form
          className="admin-form"
          style={{ marginTop: 8 }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const icon = (form.elements.namedItem('icon') as HTMLInputElement).value;
            const faviconSiteUrl = (form.elements.namedItem('faviconSiteUrl') as HTMLInputElement)
              .value;
            const iconSource = (form.elements.namedItem('iconSource') as HTMLInputElement).value;
            setBusy(true);
            void onSaveSecondaryMetadata({ icon, faviconSiteUrl, iconSource })
              .catch((err: unknown) => {
                setError(formatIconUploadError(err));
              })
              .finally(() => setBusy(false));
          }}
        >
          <label className="admin-field">
            <span>אמוג׳י / טקסט קצר (fallback בלבד)</span>
            <input name="icon" type="text" defaultValue={row.icon ?? ''} maxLength={8} />
          </label>
          <label className="admin-field">
            <span>כתובת אתר לגילוי (משני — לא מחליף העלאה)</span>
            <input
              name="faviconSiteUrl"
              type="url"
              defaultValue={String(metadata.faviconSiteUrl ?? '')}
              placeholder="https://example.com"
            />
          </label>
          <label className="admin-field">
            <span>הערת מקור</span>
            <input
              name="iconSource"
              type="text"
              defaultValue={String(metadata.iconSource ?? '')}
              placeholder="admin / seed"
            />
          </label>
          <button type="submit" className="admin-btn" disabled={busy}>
            שמור מטא-דאטה משנית
          </button>
        </form>
      ) : null}
    </section>
  );
}
