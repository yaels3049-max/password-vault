import { useCallback, useEffect, useState } from 'react';
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
  type AdminCategory,
} from './adminRegistryApi';

export default function CategoriesAdmin() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newSortOrder, setNewSortOrder] = useState(100);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await fetchAdminCategories();
      setCategories(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת קטגוריות נכשלה.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await createAdminCategory({
        id: newId,
        display_name: newName,
        sort_order: newSortOrder,
      });
      setNewId('');
      setNewName('');
      setSuccess('הקטגוריה נוצרה.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'יצירת קטגוריה נכשלה.');
    }
  }

  async function handleUpdate(category: AdminCategory, displayName: string, sortOrder: number) {
    setError(null);
    setSuccess(null);

    try {
      await updateAdminCategory(category.id, {
        display_name: displayName,
        sort_order: sortOrder,
      });
      setSuccess(`הקטגוריה "${category.id}" עודכנה.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'עדכון קטגוריה נכשל.');
    }
  }

  async function handleDelete(categoryId: string) {
    if (!window.confirm(`למחוק את הקטגוריה "${categoryId}"?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await deleteAdminCategory(categoryId);
      setSuccess('הקטגוריה נמחקה.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'מחיקת קטגוריה נכשלה.');
    }
  }

  return (
    <section className="admin-section">
      <header className="admin-section-header">
        <h2>ניהול קטגוריות</h2>
        <p>יצירה, עריכה וסידור קטגוריות לקטלוג השירותים.</p>
      </header>

      {loading && <p className="admin-muted">טוען…</p>}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="admin-success" role="status">
          {success}
        </p>
      )}

      <form className="admin-form admin-form-inline" onSubmit={(event) => void handleCreate(event)}>
        <label className="admin-field">
          <span>מזהה (slug)</span>
          <input value={newId} onChange={(e) => setNewId(e.target.value)} required />
        </label>
        <label className="admin-field">
          <span>שם תצוגה</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
        </label>
        <label className="admin-field admin-field--narrow">
          <span>סדר</span>
          <input
            type="number"
            value={newSortOrder}
            onChange={(e) => setNewSortOrder(Number(e.target.value))}
          />
        </label>
        <button type="submit" className="admin-btn admin-btn-primary">
          הוסף קטגוריה
        </button>
      </form>

      <ul className="admin-list">
        {categories.map((category) => (
          <li key={category.id} className="admin-list-item">
            <CategoryRow
              category={category}
              onSave={handleUpdate}
              onDelete={() => void handleDelete(category.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryRow({
  category,
  onSave,
  onDelete,
}: {
  category: AdminCategory;
  onSave: (category: AdminCategory, displayName: string, sortOrder: number) => Promise<void>;
  onDelete: () => void;
}) {
  const [displayName, setDisplayName] = useState(category.display_name);
  const [sortOrder, setSortOrder] = useState(category.sort_order);

  useEffect(() => {
    setDisplayName(category.display_name);
    setSortOrder(category.sort_order);
  }, [category.display_name, category.sort_order]);

  return (
    <form
      className="admin-form admin-form-inline"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(category, displayName, sortOrder);
      }}
    >
      <span className="admin-chip">{category.id}</span>
      <label className="admin-field">
        <span className="admin-sr-only">שם תצוגה</span>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <label className="admin-field admin-field--narrow">
        <span className="admin-sr-only">סדר</span>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </label>
      <button type="submit" className="admin-btn admin-btn-secondary">
        שמור
      </button>
      <button type="button" className="admin-btn admin-btn-danger" onClick={onDelete}>
        מחק
      </button>
    </form>
  );
}
