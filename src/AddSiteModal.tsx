import { useState } from 'react';

interface AddSiteModalProps {
  onAdd: (name: string, url: string) => void;
  onCancel: () => void;
}

export default function AddSiteModal({ onAdd, onCancel }: AddSiteModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;
    onAdd(trimmedName, trimmedUrl);
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-dialog"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">הוספת אתר חדש</h2>
        <form onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>שם האתר</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="modal-field">
            <span>כתובת האתר</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              dir="ltr"
            />
          </label>
          <div className="modal-actions">
            <button type="submit" className="modal-btn modal-btn-primary">
              הוסף
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={onCancel}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
