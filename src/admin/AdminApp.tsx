import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import AdminGate from './AdminGate';
import CategoriesAdmin from './CategoriesAdmin';
import RegistryAdmin from './RegistryAdmin';
import ApprovalQueue from './ApprovalQueue';
import { readSignedInAdmin, type SignedInAdmin } from './adminAuth';
import { signedInAdminLabel } from './adminPresentation';
import { useAdminConfirm } from './AdminConfirmDialog';
import { ADMIN_WORKSPACE_HE, confirmLeaveWorkspace, leaveWorkspaceDialog } from './adminWorkspace';
import './admin.css';

type AdminTab = 'categories' | 'registry' | 'approvals';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'categories', label: 'קטגוריות' },
  { id: 'registry', label: ADMIN_WORKSPACE_HE.registryNav },
  { id: 'approvals', label: 'אתרים בהוספה ע"י משתמשים' },
];

export default function AdminApp() {
  const [tab, setTab] = useState<AdminTab>('registry');
  const [signedIn, setSignedIn] = useState<SignedInAdmin | null>(null);
  const registryDirtyRef = useRef(false);
  const { ask, dialog } = useAdminConfirm();
  const account = signedIn ? signedInAdminLabel(signedIn) : null;

  useEffect(() => {
    let cancelled = false;
    void readSignedInAdmin().then((admin) => {
      if (!cancelled) setSignedIn(admin);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectTab(next: AdminTab) {
    if (next === tab) return;
    if (tab === 'registry' && !(await confirmLeaveWorkspace(registryDirtyRef.current, (m) => ask(leaveWorkspaceDialog(m))))) {
      return;
    }
    registryDirtyRef.current = false;
    setTab(next);
  }

  /** O-123-29 — WAI-ARIA tabs: roving focus only (Enter/Space activates), RTL so ArrowLeft is next. */
  function onTabListKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    const last = tabs.length - 1;
    let target: number;
    if (event.key === 'ArrowLeft') target = current === last ? 0 : current + 1;
    else if (event.key === 'ArrowRight') target = current === 0 ? last : current - 1;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = last;
    else return;
    event.preventDefault();
    tabs[target].focus();
  }

  return (
    <AdminGate>
      <div className="admin-app" dir="rtl">
        <header className="admin-app-header" data-part="app-bar">
          <div className="admin-app-bar">
            <div className="admin-app-brand">
              <h1>מרכז הבקרה של הכספת</h1>
              <p className="admin-app-subtitle">
                ניהול אתרים, הגשות משתמשים ואינטגרציה — ללא גישה לפרטי כניסה של משתמשים.
              </p>
            </div>
            <div className="admin-app-account">
              {account ? (
                <span className="admin-app-user" data-part="signed-in-admin">
                  {account.name ? (
                    <>
                      <bdi data-part="signed-in-name">{account.name}</bdi>
                      {' · '}
                    </>
                  ) : null}
                  <bdi dir="ltr" data-part="signed-in-email">{account.email}</bdi>
                </span>
              ) : null}
            </div>
          </div>
          {/* O-123-29 — full-width tab bar: three equal tabs. */}
          <nav className="admin-nav admin-tabbar" role="tablist" aria-label="ניווט ניהול" onKeyDown={onTabListKeyDown}>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`admin-nav-tab-${item.id}`}
                className={`admin-nav-btn ${tab === item.id ? 'is-active' : ''}`}
                data-nav={item.id}
                aria-selected={tab === item.id}
                aria-controls="admin-nav-panel"
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => void selectTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="admin-app-main" id="admin-nav-panel" role="tabpanel" aria-labelledby={`admin-nav-tab-${tab}`}>
          {tab === 'categories' && <CategoriesAdmin />}
          {tab === 'registry' && (
            <RegistryAdmin
              onDirtyChange={(dirty) => {
                registryDirtyRef.current = dirty;
              }}
            />
          )}
          {tab === 'approvals' && <ApprovalQueue />}
        </main>
        {dialog}
      </div>
    </AdminGate>
  );
}
