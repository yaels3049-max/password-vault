import { useState } from 'react';
import { validateCustomPrimaryUrl } from './catalog';
import { categoryLabels, runtimeCategoryLabels, type ServiceCategory } from './mockServices';

interface AddSiteModalProps {
  onAdd: (
    displayName: string,
    primaryUrl: string,
    category: ServiceCategory,
  ) => void | Promise<void>;
  onCancel: () => void;
  /** Selectable categories (practice is dev-only and excluded by the caller). */
  categoryOptions: ServiceCategory[];
  error?: string | null;
  isDiscovering?: boolean;
  discoveryMessage?: string | null;
  discoveryOutcome?: 'success' | 'failure' | null;
}

export default function AddSiteModal({
  onAdd,
  onCancel,
  categoryOptions,
  error,
  isDiscovering = false,
  discoveryMessage = null,
  discoveryOutcome = null,
}: AddSiteModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [primaryUrl, setPrimaryUrl] = useState('');
  const [category, setCategory] = useState<ServiceCategory>(
    categoryOptions[0] ?? 'shopping',
  );
  const [urlError, setUrlError] = useState<string | null>(null);

  function validateUrlField(url: string): boolean {
    const result = validateCustomPrimaryUrl(url);
    if (!result.valid) {
      setUrlError(result.message);
      return false;
    }

    setUrlError(null);
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isDiscovering) return;

    const trimmedName = displayName.trim();
    const trimmedUrl = primaryUrl.trim();
    if (!trimmedName || !trimmedUrl) return;
    if (!validateUrlField(trimmedUrl)) return;
    void onAdd(trimmedName, trimmedUrl, category);
  }

  return (
    <div className="modal-overlay" onClick={isDiscovering ? undefined : onCancel}>
      <div
        className="modal-dialog"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">הוספת אתר חדש</h2>
        <form onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>שם להצגה</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              disabled={isDiscovering}
            />
          </label>
          <label className="modal-field">
            <span>כתובת ראשית (HTTPS)</span>
            <input
              type="url"
              value={primaryUrl}
              onChange={(e) => {
                setPrimaryUrl(e.target.value);
                if (urlError) {
                  validateUrlField(e.target.value);
                }
              }}
              onBlur={() => {
                if (primaryUrl.trim()) {
                  validateUrlField(primaryUrl);
                }
              }}
              placeholder="https://"
              dir="ltr"
              disabled={isDiscovering}
            />
          </label>
          <label className="modal-field">
            <span>קטגוריה</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ServiceCategory)}
              disabled={isDiscovering}
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {runtimeCategoryLabels[option] ?? categoryLabels[option] ?? option}
                </option>
              ))}
            </select>
          </label>
          {(urlError || error) && !isDiscovering && !discoveryMessage && (
            <p className="modal-field-error" role="alert">
              {urlError ?? error}
            </p>
          )}
          {isDiscovering && (
            <p className="modal-discovery-progress" role="status" aria-live="polite">
              <span className="modal-loading-spinner" aria-hidden="true" />
              מוסיף את השירות…
            </p>
          )}
          {discoveryMessage && !isDiscovering && (
            <p
              className={
                discoveryOutcome === 'success'
                  ? 'modal-discovery-success'
                  : 'modal-discovery-failure'
              }
              role="status"
              aria-live="polite"
            >
              {discoveryMessage}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="submit"
              className="modal-btn modal-btn-primary"
              disabled={isDiscovering || Boolean(discoveryMessage)}
            >
              {isDiscovering ? 'מוסיף…' : 'הוסף'}
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={onCancel}
              disabled={isDiscovering}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
