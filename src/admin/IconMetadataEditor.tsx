import type { AdminRegistryRow } from './adminRegistryApi';

interface IconMetadataEditorProps {
  row: AdminRegistryRow;
  onSave: (patch: {
    icon: string;
    faviconSiteUrl: string;
    iconSource: string;
  }) => Promise<void>;
}

export default function IconMetadataEditor({ row, onSave }: IconMetadataEditorProps) {
  const metadata = row.metadata ?? {};

  return (
    <section className="admin-panel">
      <h3 className="admin-panel-title">אייקון (מטא-דאטה בלבד)</h3>
      <p className="admin-panel-hint">
        עריכת אמוג׳י או כתובת favicon בלבד. העלאת קבצים ואחסון יגיעו בפאזה 111.
      </p>
      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const icon = (form.elements.namedItem('icon') as HTMLInputElement).value;
          const faviconSiteUrl = (form.elements.namedItem('faviconSiteUrl') as HTMLInputElement)
            .value;
          const iconSource = (form.elements.namedItem('iconSource') as HTMLInputElement).value;
          void onSave({ icon, faviconSiteUrl, iconSource });
        }}
      >
        <label className="admin-field">
          <span>אייקון (אמוג׳י / טקסט קצר)</span>
          <input name="icon" type="text" defaultValue={row.icon ?? ''} maxLength={8} />
        </label>
        <label className="admin-field">
          <span>כתובת favicon (metadata.faviconSiteUrl)</span>
          <input
            name="faviconSiteUrl"
            type="url"
            defaultValue={String(metadata.faviconSiteUrl ?? '')}
            placeholder="https://example.com/favicon.ico"
          />
        </label>
        <label className="admin-field">
          <span>מקור אייקון (metadata.iconSource)</span>
          <input
            name="iconSource"
            type="text"
            defaultValue={String(metadata.iconSource ?? '')}
            placeholder="manual / seed / approved"
          />
        </label>
        <button type="submit" className="admin-btn admin-btn-primary">
          שמור אייקון
        </button>
      </form>
    </section>
  );
}
