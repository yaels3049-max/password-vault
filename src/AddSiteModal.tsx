import { useState } from 'react';
import { validateCustomPrimaryUrl } from './catalog';
import {
  EMPTY_LOGIN_URL_MESSAGE,
  INVALID_LOGIN_URL_MESSAGE,
  LOGIN_URL_FIELD_LABEL,
  SAME_AS_WEBSITE_LABEL,
  isExplicitHttpUrl,
} from './catalog/explicitLoginEntry';
import { categoryLabels, runtimeCategoryLabels, type ServiceCategory } from './mockServices';
import { useBackdropDismiss, useEscapeToClose } from './digitalHome/dialogDismiss';

export const CATEGORY_REQUIRED_MESSAGE = 'יש לבחור קטגוריה';
export const CATEGORY_PLACEHOLDER_LABEL = 'בחרו קטגוריה';

export interface AddSiteFormValues {
  displayName: string;
  primaryUrl: string;
  category: ServiceCategory;
  sameAsWebsite: boolean;
  dedicatedLoginUrl: string;
}

interface AddSiteModalProps {
  onAdd: (values: AddSiteFormValues) => void | Promise<void>;
  onCancel: () => void;
  /** Selectable categories (practice is dev-only and excluded by the caller). */
  categoryOptions: ServiceCategory[];
  error?: string | null;
  isSaving?: boolean;
  mode?: 'create' | 'edit';
  initialDisplayName?: string;
  initialPrimaryUrl?: string;
  initialCategory?: ServiceCategory;
  initialSameAsWebsite?: boolean;
  initialLoginUrl?: string;
}

export default function AddSiteModal({
  onAdd,
  onCancel,
  categoryOptions,
  error,
  isSaving = false,
  mode = 'create',
  initialDisplayName = '',
  initialPrimaryUrl = '',
  initialCategory,
  initialSameAsWebsite = true,
  initialLoginUrl = '',
}: AddSiteModalProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [primaryUrl, setPrimaryUrl] = useState(initialPrimaryUrl);
  // D-123-4: create starts with no category (required); edit keeps the stored one.
  const [category, setCategory] = useState<ServiceCategory | ''>(
    mode === 'edit' ? (initialCategory ?? categoryOptions[0] ?? '') : '',
  );
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const cancelIfIdle = () => {
    if (!isSaving) onCancel();
  };
  const backdrop = useBackdropDismiss(cancelIfIdle, { containsForm: true });
  useEscapeToClose(cancelIfIdle);
  const [sameAsWebsite, setSameAsWebsite] = useState(initialSameAsWebsite);
  const [dedicatedLoginUrl, setDedicatedLoginUrl] = useState(
    initialSameAsWebsite ? '' : initialLoginUrl,
  );
  const [urlError, setUrlError] = useState<string | null>(null);

  function normalizeUrlField(url: string): string | null {
    const result = validateCustomPrimaryUrl(url);
    if (!result.valid) {
      setUrlError(result.message);
      return null;
    }

    setUrlError(null);
    if (result.normalizedUrl !== url.trim()) {
      setPrimaryUrl(result.normalizedUrl);
    }
    return result.normalizedUrl;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;

    const trimmedName = displayName.trim();
    const trimmedUrl = primaryUrl.trim();
    if (!trimmedName || !trimmedUrl) return;
    const normalized = normalizeUrlField(trimmedUrl);
    if (!normalized) return;
    if (!category) {
      setCategoryError(CATEGORY_REQUIRED_MESSAGE);
      return;
    }

    if (!sameAsWebsite) {
      const dedicated = dedicatedLoginUrl.trim();
      if (!dedicated) {
        setUrlError(EMPTY_LOGIN_URL_MESSAGE);
        return;
      }
      if (!isExplicitHttpUrl(dedicated)) {
        setUrlError(INVALID_LOGIN_URL_MESSAGE);
        return;
      }
    }

    void onAdd({
      displayName: trimmedName,
      primaryUrl: normalized,
      category,
      sameAsWebsite,
      dedicatedLoginUrl: dedicatedLoginUrl.trim(),
    });
  }

  return (
    <div className="modal-overlay" data-dialog-form="true" {...backdrop}>
      <div
        className="modal-dialog modal-dialog--frost"
        dir="rtl"
      >
        <h2 className="modal-title">
          {mode === 'edit' ? 'עריכת כתובת כניסה' : 'הוספת אתר חדש'}
        </h2>
        <form onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>שם להצגה</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              disabled={isSaving}
            />
          </label>
          <label className="modal-field">
            <span>כתובת ראשית (HTTPS)</span>
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              value={primaryUrl}
              onChange={(e) => {
                setPrimaryUrl(e.target.value);
                if (urlError) {
                  normalizeUrlField(e.target.value);
                }
              }}
              onBlur={() => {
                if (primaryUrl.trim()) {
                  normalizeUrlField(primaryUrl);
                }
              }}
              placeholder="example.co.il או https://www…"
              dir="ltr"
              disabled={isSaving}
            />
          </label>
          <label className="modal-check">
            <input
              type="checkbox"
              checked={sameAsWebsite}
              disabled={isSaving}
              onChange={(e) => {
                setSameAsWebsite(e.target.checked);
                if (urlError === EMPTY_LOGIN_URL_MESSAGE || urlError === INVALID_LOGIN_URL_MESSAGE) {
                  setUrlError(null);
                }
              }}
            />
            <span>{SAME_AS_WEBSITE_LABEL}</span>
          </label>
          {!sameAsWebsite && (
            <label className="modal-field">
              <span>{LOGIN_URL_FIELD_LABEL}</span>
              <input
                type="url"
                inputMode="url"
                autoComplete="url"
                value={dedicatedLoginUrl}
                onChange={(e) => setDedicatedLoginUrl(e.target.value)}
                placeholder="https://example.com/login"
                dir="ltr"
                disabled={isSaving}
                required
              />
            </label>
          )}
          <label className="modal-field">
            <span>קטגוריה</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ServiceCategory | '');
                if (e.target.value) setCategoryError(null);
              }}
              disabled={isSaving}
              aria-required="true"
              aria-invalid={categoryError ? true : undefined}
              data-field="category"
            >
              {category === '' && (
                <option value="" disabled>
                  {CATEGORY_PLACEHOLDER_LABEL}
                </option>
              )}
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {runtimeCategoryLabels[option] ?? categoryLabels[option] ?? option}
                </option>
              ))}
            </select>
          </label>
          {(urlError || categoryError || error) && (
            <p className="modal-field-error" role="alert">
              {urlError ?? categoryError ?? error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="submit"
              className="modal-btn modal-btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'שומר…' : mode === 'edit' ? 'שמור' : 'הוסף'}
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={onCancel}
              disabled={isSaving}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
