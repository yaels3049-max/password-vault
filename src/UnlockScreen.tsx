import { useState } from 'react';

interface UnlockScreenProps {
  onUnlock: (password: string) => Promise<void>;
}

export default function UnlockScreen({ onUnlock }: UnlockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setError('');
    setLoading(true);
    try {
      await onUnlock(password);
    } catch {
      setError('סיסמה שגויה');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="unlock">
      <div className="unlock-card">
        <header className="unlock-header">
          <h1>פתיחת הכספת</h1>
        </header>
        <form onSubmit={handleSubmit}>
          <label className="unlock-field">
            <span>סיסמה ראשית</span>
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
            {loading ? 'פותח...' : 'פתח כספת'}
          </button>
        </form>
      </div>
    </div>
  );
}
