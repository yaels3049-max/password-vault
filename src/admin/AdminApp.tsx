import { useState } from 'react';
import AdminGate from './AdminGate';
import CategoriesAdmin from './CategoriesAdmin';
import RegistryAdmin from './RegistryAdmin';
import ApprovalQueue from './ApprovalQueue';
import { TrustIndicator } from '../trust';
import './admin.css';

type AdminTab = 'categories' | 'registry' | 'approvals';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'categories', label: 'קטגוריות' },
  { id: 'registry', label: 'קטלוג גלובלי' },
  { id: 'approvals', label: 'תור אישורים' },
];

export default function AdminApp() {
  const [tab, setTab] = useState<AdminTab>('registry');

  return (
    <AdminGate>
      <div className="admin-app" dir="rtl">
        <header className="admin-app-header">
          <div className="admin-app-header-top">
            <h1>ניהול פלטפורמה</h1>
            <TrustIndicator />
          </div>
          <p className="admin-app-subtitle">
            קטלוג שירותים, אישורים ואינטגרציה — ללא גישה לפרטי כניסה של משתמשים.
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
