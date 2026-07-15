import { useState } from 'react';
import AdminGate from './AdminGate';
import CategoriesAdmin from './CategoriesAdmin';
import RegistryAdmin from './RegistryAdmin';
import ApprovalQueue from './ApprovalQueue';
import './admin.css';

type AdminTab = 'categories' | 'registry' | 'approvals';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'categories', label: 'קטגוריות' },
  { id: 'registry', label: 'כל האתרים' },
  { id: 'approvals', label: 'אתרים בהוספה ע"י משתמשים' },
];

export default function AdminApp() {
  const [tab, setTab] = useState<AdminTab>('registry');

  return (
    <AdminGate>
      <div className="admin-app" dir="rtl">
        <header className="admin-app-header">
          <div className="admin-app-header-top">
            <h1>מרכז הבקרה של הכספת</h1>
          </div>
          <p className="admin-app-subtitle">
            ניהול אתרים, הגשות משתמשים ואינטגרציה — ללא גישה לפרטי כניסה של משתמשים.
          </p>
          <nav className="admin-nav" aria-label="ניווט ניהול">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`admin-nav-btn ${tab === item.id ? 'is-active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <a className="admin-link" href="#/">
            חזרה לבית הדיגיטלי
          </a>
        </header>

        <main className="admin-app-main">
          {tab === 'categories' && <CategoriesAdmin />}
          {tab === 'registry' && <RegistryAdmin />}
          {tab === 'approvals' && <ApprovalQueue />}
        </main>
      </div>
    </AdminGate>
  );
}
