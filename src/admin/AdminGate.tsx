import { useCallback, useEffect, useState, type ReactNode } from 'react';
import AuthEntryScreen from '../auth/AuthEntryScreen';
import { signOutAccount, type AppUserProfile } from '../auth';
import { resolveAdminAccess } from './adminAuth';

interface AdminGateProps {
  children: ReactNode;
}

type GateState = 'loading' | 'need_login' | 'denied' | 'allowed';

/**
 * `#/admin` always shows Login first (step-up). An existing Digital Home session
 * must not open the control center without entering email + admin password again.
 * After successful login, re-check is_admin / role. Vault unlock is not required.
 */
export default function AdminGate({ children }: AdminGateProps) {
  const [gateState, setGateState] = useState<GateState>('loading');
  const [loginBanner, setLoginBanner] = useState<string | null>(null);
  const [denyMessage, setDenyMessage] = useState<string | null>(null);

  const evaluateAccess = useCallback(async (): Promise<GateState> => {
    const access = await resolveAdminAccess();

    if (access.status === 'allowed') {
      setLoginBanner(null);
      setDenyMessage(null);
      setGateState('allowed');
      return 'allowed';
    }

    if (access.status === 'unauthenticated') {
      setLoginBanner(null);
      setDenyMessage(null);
      setGateState('need_login');
      return 'need_login';
    }

    if (access.status === 'not_admin' || access.status === 'inactive') {
      await signOutAccount();
      setLoginBanner(
        access.status === 'inactive'
          ? 'החשבון אינו פעיל. התחברו עם חשבון מנהל פעיל.'
          : 'החשבון הנוכחי אינו מנהל. התחברו עם חשבון מנהל, או פנו למפעיל.',
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
      const access = await resolveAdminAccess();
      if (cancelled) return;

      if (access.status === 'misconfigured' || access.status === 'error') {
        setDenyMessage(access.error ?? 'לא ניתן לאמת הרשאות ניהול.');
        setGateState('denied');
        return;
      }

      // Always require the login screen — never skip from an existing hub/admin session.
      if (access.status === 'not_admin' || access.status === 'inactive') {
        await signOutAccount();
        if (cancelled) return;
        setLoginBanner(
          access.status === 'inactive'
            ? 'החשבון אינו פעיל. התחברו עם חשבון מנהל פעיל.'
            : 'החשבון הנוכחי אינו מנהל. התחברו עם חשבון מנהל, או פנו למפעיל.',
        );
      } else {
        setLoginBanner(null);
      }

      setDenyMessage(null);
      setGateState('need_login');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
        {loginBanner ? (
          <p className="admin-gate-login-banner" role="status">
            {loginBanner}
          </p>
        ) : null}
        <AuthEntryScreen
          loginOnly
          heading="מרכז הבקרה"
          subtitle="התחבר כדי לנהל את שירותי המערכת, המשתמשים, ההרשאות ותצורת הכספת."
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
