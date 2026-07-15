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
  /** Optional subtitle under the heading (e.g. admin login hint). */
  subtitle?: string;
}

export default function AuthEntryScreen({
  onAuthenticated,
  initialEmail = '',
  loginOnly = false,
  heading,
  subtitle,
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
    if (loading || next === mode) return;
    setMode(next);
    setError('');
    // Do not carry credentials between login and register (fresh form each mode).
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setShowPassword(false);
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
          {(subtitle || !loginOnly) && (
            <p className="unlock-trust-line">
              {subtitle ??
                (mode === 'register'
                  ? AUTH_COPY.registerAccountHint
                  : AUTH_COPY.accountPasswordHint)}
            </p>
          )}
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

        <form key={mode} onSubmit={handleSubmit} data-testid="auth-entry-form">
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
            <span>
              {loginOnly ? AUTH_COPY.adminPassword : AUTH_COPY.password}
            </span>
            <div className="auth-password-wrap">
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
                className="auth-password-eye"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                aria-label={showPassword ? AUTH_COPY.hidePassword : AUTH_COPY.showPassword}
                aria-pressed={showPassword}
                title={showPassword ? AUTH_COPY.hidePassword : AUTH_COPY.showPassword}
              >
                <AuthEyeIcon open={showPassword} />
              </button>
            </div>
          </label>

          {mode === 'register' && (
            <>
              <label className="unlock-field">
                <span>{AUTH_COPY.passwordConfirm}</span>
                <div className="auth-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="auth-password-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    aria-label={showPassword ? AUTH_COPY.hidePassword : AUTH_COPY.showPassword}
                    aria-pressed={showPassword}
                    title={showPassword ? AUTH_COPY.hidePassword : AUTH_COPY.showPassword}
                  >
                    <AuthEyeIcon open={showPassword} />
                  </button>
                </div>
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

function AuthEyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M12 5c-5.5 0-9.5 5.2-9.9 5.8a1 1 0 0 0 0 1.1C2.5 12.6 6.5 18 12 18s9.5-5.4 9.9-6.1a1 1 0 0 0 0-1.1C21.5 10.2 17.5 5 12 5zm0 11a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M3.3 2.3 2.2 3.4l3.1 3.1C3.5 8.1 2.2 10 1.9 10.6a1 1 0 0 0 0 1.1C2.5 12.6 6.5 18 12 18c1.7 0 3.2-.5 4.5-1.2l3.1 3.1 1.1-1.1L3.3 2.3zM12 16c-4.1 0-7.4-3.5-8.5-5 .7-1 2.1-2.6 4-3.6l1.6 1.6A4.5 4.5 0 0 0 12 15.5V16zm2.6-3.9-2.7-2.7a2 2 0 0 1 2.7 2.7zM12 6c.5 0 1 .1 1.5.2l1.5-1.5C14 4.3 13 4 12 4 6.5 4 2.5 9.2 2.1 9.9c.1.2.4.6.8 1.1L4.2 9.7C5.4 7.9 8.3 6 12 6zm9.9 4.5c-.3.5-1.6 2.4-3.8 3.9l-1.3-1.3c1.6-.9 2.8-2.2 3.4-3.1-.7-1-2.1-2.6-4-3.6l1.2-1.2C20.5 7.2 21.7 9.2 21.9 9.6a1 1 0 0 1 0 .9z"
      />
    </svg>
  );
}
