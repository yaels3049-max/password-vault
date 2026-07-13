import { useState } from 'react';
import {
  AUTH_COPY,
  loginWithPassword,
  mapAuthErrorToFriendly,
  registerAccount,
  type AppUserProfile,
} from './index';
import { getAccountPasswordPolicy } from './passwordPolicy';

type AuthMode = 'login' | 'register';

interface AuthEntryScreenProps {
  /** Auth success; Hub also unlocks vault with the same password. Admin may ignore password. */
  onAuthenticated: (profile: AppUserProfile, password: string) => Promise<void>;
  /** Optional email prefill after refresh (AC-109-32). */
  initialEmail?: string;
  /** D-109-22 admin: Login only (Create Account linked to Digital Home). */
  loginOnly?: boolean;
  /** Optional heading override (e.g. admin console). */
  heading?: string;
}

export default function AuthEntryScreen({
  onAuthenticated,
  initialEmail = '',
  loginOnly = false,
  heading,
}: AuthEntryScreenProps) {
  const [mode, setMode] = useState<AuthMode>(loginOnly ? 'login' : 'login');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const policy = getAccountPasswordPolicy();

  function switchMode(next: AuthMode) {
    if (loading) return;
    setMode(next);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);
    try {
      const profile =
        mode === 'login'
          ? await loginWithPassword({ email, password })
          : await registerAccount({
              firstName,
              lastName,
              email,
              phone,
              password,
              passwordConfirm,
            });
      await onAuthenticated(profile, password);
    } catch (err) {
      const raw =
        err instanceof Error && err.message.trim() ? err.message.trim() : '';
      const known = new Set(Object.values(AUTH_COPY));
      setError(
        raw &&
          (known.has(raw as (typeof AUTH_COPY)[keyof typeof AUTH_COPY]) ||
            raw.includes('(פרטי פיתוח:'))
          ? raw
          : mapAuthErrorToFriendly(err, mode === 'register' ? 'register' : 'login'),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="unlock auth-entry">
      <div className="unlock-card auth-entry-card">
        <header className="unlock-header">
          <h1>{heading ?? AUTH_COPY.productTitle}</h1>
          <p className="unlock-trust-line">{AUTH_COPY.accountPasswordHint}</p>
        </header>

        {!loginOnly && (
        <div className="auth-entry-tabs" role="tablist" aria-label="מצב חשבון">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'auth-tab auth-tab-active' : 'auth-tab'}
            onClick={() => switchMode('login')}
            disabled={loading}
            data-testid="auth-tab-login"
          >
            {AUTH_COPY.loginTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'auth-tab auth-tab-active' : 'auth-tab'}
            onClick={() => switchMode('register')}
            disabled={loading}
            data-testid="auth-tab-register"
          >
            {AUTH_COPY.registerTab}
          </button>
        </div>
        )}

        {loginOnly && (
          <p className="auth-policy-hint">
            אין חשבון?{' '}
            <a className="admin-link" href="#/">
              צרו חשבון בבית הדיגיטלי
            </a>
          </p>
        )}

        <form onSubmit={handleSubmit} data-testid="auth-entry-form">
          {mode === 'register' && !loginOnly && (
            <>
              <label className="unlock-field">
                <span>{AUTH_COPY.firstName}</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  disabled={loading}
                  required
                />
              </label>
              <label className="unlock-field">
                <span>{AUTH_COPY.lastName}</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  disabled={loading}
                  required
                />
              </label>
              <label className="unlock-field">
                <span>{AUTH_COPY.phone}</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  disabled={loading}
                  required
                />
              </label>
            </>
          )}

          <label className="unlock-field">
            <span>{AUTH_COPY.email}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
              required
              autoFocus
            />
          </label>

          <label className="unlock-field">
            <span>{AUTH_COPY.password}</span>
            <div className="auth-password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
              >
                {showPassword ? AUTH_COPY.hidePassword : AUTH_COPY.showPassword}
              </button>
            </div>
          </label>

          {mode === 'register' && (
            <>
              <label className="unlock-field">
                <span>{AUTH_COPY.passwordConfirm}</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />
              </label>
              <p className="auth-policy-hint">
                {policy.isDevelopmentPolicy
                  ? `מדיניות פיתוח זמנית: לפחות ${policy.minLength} תווים (לא מדיניות ייצור).`
                  : `לפחות ${policy.minLength} תווים, כולל אות וספרה.`}
              </p>
            </>
          )}

          {error && (
            <p className="unlock-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="unlock-btn" disabled={loading} data-testid="auth-submit">
            {loading
              ? AUTH_COPY.pending
              : mode === 'login'
                ? AUTH_COPY.loginSubmit
                : AUTH_COPY.registerSubmit}
          </button>
        </form>
      </div>
    </div>
  );
}
