import { useState } from 'react';
import { IconCopy } from '../loginAssistance/icons';
import { copyCredentialField } from '../loginAssistance/copyField';

interface UrlFieldWithCopyProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
}

export default function UrlFieldWithCopy({
  label,
  value,
  onChange,
  required = false,
  placeholder,
  hint,
  autoFocus = false,
  readOnly = false,
}: UrlFieldWithCopyProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const result = await copyCredentialField(trimmed);
    if (result === 'ok') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <label className="admin-field">
      <span>{label}</span>
      <div className="admin-url-field-row">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          autoFocus={autoFocus}
          readOnly={readOnly}
        />
        <button
          type="button"
          className="admin-copy-btn"
          aria-label={`העתקת ${label}`}
          title="העתקה"
          disabled={!value.trim()}
          onClick={() => void handleCopy()}
        >
          <IconCopy copied={copied} />
        </button>
      </div>
      {hint ? <p className="admin-field-hint">{hint}</p> : null}
    </label>
  );
}
