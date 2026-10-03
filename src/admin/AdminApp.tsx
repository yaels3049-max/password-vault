import { useEffect, useRef, useState } from 'react';
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
            <nav className="admin-nav" aria-label="ניווט ניהול">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-nav-btn ${tab === item.id ? 'is-active' : ''}`}
                  data-nav={item.id}
                  aria-current={tab === item.id ? 'page' : undefined}
                  onClick={() => void selectTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
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
        </header>

        <main className="admin-app-main">
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
