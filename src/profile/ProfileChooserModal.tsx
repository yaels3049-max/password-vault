import { useState } from 'react';
import type { AccessProfile } from './accessProfileModel';
import { useEscapeToClose } from '../digitalHome/dialogDismiss';

interface ProfileChooserModalProps {
  serviceName: string;
  profiles: AccessProfile[];
  initialProfileId: string | null;
  onConfirm: (profileId: string) => void;
  onCancel: () => void;
}

export default function ProfileChooserModal({
  serviceName,
  profiles,
  initialProfileId,
  onConfirm,
  onCancel,
}: ProfileChooserModalProps) {
  const [selectedProfileId, setSelectedProfileId] = useState(
    () => initialProfileId ?? profiles[0]?.id ?? '',
  );
  // D-123-3: form dialog — closes via «ביטול» / Escape only.
  useEscapeToClose(onCancel);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfileId) {
      return;
    }
    onConfirm(selectedProfileId);
  }

  return (
    <div className="modal-overlay" data-dialog-form="true">
      <div className="modal-dialog profile-chooser-dialog" dir="rtl">
        <h2 className="modal-title">בחירת פרופיל</h2>
        <p className="modal-subtitle">{serviceName}</p>
        <form onSubmit={handleSubmit}>
          <ul className="profile-chooser-list">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <label className="profile-chooser-item">
                  <input
                    type="radio"
                    name="execution-profile"
                    value={profile.id}
                    checked={selectedProfileId === profile.id}
                    onChange={() => setSelectedProfileId(profile.id)}
                  />
                  <span className="profile-chooser-item-label">
                    {profile.displayName}
                    {profile.isDefault && (
                      <span className="profile-default-badge">ברירת מחדל</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="modal-actions">
            <button type="submit" className="modal-btn modal-btn-primary">
              המשך
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
