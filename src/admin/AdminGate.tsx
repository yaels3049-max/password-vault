import { useCallback, useEffect, useState, type ReactNode } from 'react';
import AuthEntryScreen from '../auth/AuthEntryScreen';
import { signOutAccount, type AppUserProfile } from '../auth';
import { resolveAdminAccess } from './adminAuth';

interface AdminGateProps {
  children: ReactNode;
}

type GateState = 'loading' | 'need_login' | 'denied' | 'allowed';

/**
 * D-109-22: `#/admin` without admin access → Login (same Digital Home password),
 * then re-check is_admin / role. Not deny-only when logged out or logged in as non-admin.
 * Vault unlock is not required for catalog admin UI.
 */
export default function AdminGate({ children }: AdminGateProps) {
  const [gateState, setGateState] = useState<GateState>('loading');
  const [loginBanner, setLoginBanner] = useState<string | null>(null);
  const [denyMessage, setDenyMessage] = useState<string | null>(null);

  const evaluateAccess = useCallback(async (): Promise<GateState> => {
    const access = await resolveAdminAccess();

    if (access.status === 'unauthenticated') {
      setLoginBanner(null);
      setDenyMessage(null);
      setGateState('need_login');
      return 'need_login';
    }

    if (access.status === 'allowed') {
      setLoginBanner(null);
      setDenyMessage(null);
      setGateState('allowed');
      return 'allowed';
    }

    // Logged-in but not admin (or inactive): clear session and show Login —
    // do not leave operators on a deny-only page with a tiny link.
    if (access.status === 'not_admin' || access.status === 'inactive') {
      await signOutAccount();
      setLoginBanner(
        access.status === 'inactive'
          ? 'החשבון אינו פעיל. התחברו עם חשבון מנהל פעיל.'
          : 'החשבון הנוכחי אינו מנהל. התחברו עם חשבון שקודם ל־admin ב-SQL, או פנו למפעיל.',
      );
      setDenyMessage(null);
      setGateState('need_login');
      return 'need_login';
    }

    setDenyMessage(access.error ?? 'לא ניתן לאמת הרשאות ניהול.');
    setGateState('denied');
    return 'denied';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setGateState('loading');
    void (async () => {
      const next = await evaluateAccess();
      if (cancelled) {
        return;
      }
      setGateState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [evaluateAccess]);

  async function handleAdminAuthenticated(_profile: AppUserProfile, _password: string) {
    setGateState('loading');
    setLoginBanner(null);
    await evaluateAccess();
  }

  if (gateState === 'loading') {
    return (
      <div className="admin-gate admin-gate--loading" dir="rtl">
        <p>בודק הרשאות ניהול…</p>
      </div>
    );
  }

  if (gateState === 'need_login') {
    return (
      <div className="admin-gate admin-gate--login" dir="rtl" data-testid="admin-gate-login">
        <h1 className="admin-gate-login-title">התחברות לניהול הפלטפורמה</h1>
        {loginBanner ? (
          <p className="admin-gate-login-banner" role="status">
            {loginBanner}
          </p>
        ) : (
          <p className="admin-gate-login-hint">
            הזינו אימייל וסיסמת הבית הדיגיטלי של חשבון מנהל. אחרי קידום ב-SQL התחברו כאן מחדש.
          </p>
        )}
        <AuthEntryScreen
          loginOnly
          heading="התחברות לניהול"
          onAuthenticated={handleAdminAuthenticated}
        />
        <p className="admin-gate-home-link">
          <a className="admin-link" href="#/">
            חזרה לבית הדיגיטלי
          </a>
        </p>
      </div>
    );
  }

  if (gateState === 'denied') {
    return (
      <div className="admin-gate admin-gate--denied" dir="rtl" data-testid="admin-gate-denied">
        <h1>לא ניתן לפתוח את ניהול הפלטפורמה</h1>
        <p>{denyMessage}</p>
        <a className="admin-link" href="#/">
          חזרה לבית הדיגיטלי
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
