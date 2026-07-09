import { useEffect, useState, type ReactNode } from 'react';
import { resolveAdminAccess } from './adminAuth';

interface AdminGateProps {
  children: ReactNode;
}

type GateState = 'loading' | 'denied' | 'allowed';

export default function AdminGate({ children }: AdminGateProps) {
  const [gateState, setGateState] = useState<GateState>('loading');
  const [denyMessage, setDenyMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const access = await resolveAdminAccess();
      if (cancelled) {
        return;
      }

      if (access.error && !access.userId) {
        setDenyMessage(access.error);
        setGateState('denied');
        return;
      }

      if (!access.isAdmin) {
        setDenyMessage('אין לכם הרשאות ניהול. פנו למפעיל המערכת.');
        setGateState('denied');
        return;
      }

      setGateState('allowed');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (gateState === 'loading') {
    return (
      <div className="admin-gate admin-gate--loading" dir="rtl">
        <p>בודק הרשאות ניהול…</p>
      </div>
    );
  }

  if (gateState === 'denied') {
    return (
      <div className="admin-gate admin-gate--denied" dir="rtl">
        <h1>גישה נדחתה</h1>
        <p>{denyMessage}</p>
        <a className="admin-link" href="#/">
          חזרה לבית הדיגיטלי
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
