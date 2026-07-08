import { useEffect, useState } from 'react';
import {
  isFirstTimeSecurityTipDismissed,
  SecurityExplanationBanner,
  TRUST_COPY,
  TrustIndicator,
} from './trust';
import { vaultExists } from './vault/vault';

interface UnlockScreenProps {
  onUnlock: (password: string) => Promise<void>;
}

export default function UnlockScreen({ onUnlock }: UnlockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewVault, setIsNewVault] = useState<boolean | null>(null);
  const [showSecurityTip, setShowSecurityTip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void vaultExists().then((exists) => {
      if (cancelled) return;
      setIsNewVault(!exists);
      if (!exists || !isFirstTimeSecurityTipDismissed()) {
        setShowSecurityTip(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setError('');
    setLoading(true);
    try {
      await onUnlock(password);
    } catch {
      setError(TRUST_COPY.wrongPassword);
    } finally {
      setLoading(false);
    }
  }

  const creating = isNewVault === true;

  return (
    <div className="unlock">
      <div className="unlock-card">
        <header className="unlock-header">
          <h1>{creating ? TRUST_COPY.createTitle : TRUST_COPY.unlockTitle}</h1>
          <TrustIndicator />
          <p className="unlock-trust-line">{TRUST_COPY.unlockProtects}</p>
        </header>

        {showSecurityTip && (
          <SecurityExplanationBanner onDismiss={() => setShowSecurityTip(false)} />
        )}

        <form onSubmit={handleSubmit}>
          <label className="unlock-field">
            <span>{creating ? 'בחרו סיסמה ראשית' : 'סיסמה ראשית'}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              autoFocus
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
          {error && <p className="unlock-error">{error}</p>}
          <button type="submit" className="unlock-btn" disabled={loading}>
            {loading
              ? 'נכנס...'
              : creating
                ? TRUST_COPY.createButton
                : TRUST_COPY.unlockButton}
          </button>
        </form>
      </div>
    </div>
  );
}
