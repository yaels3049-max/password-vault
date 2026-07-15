import { useCallback, useEffect, useState } from 'react';
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  reorderAdminCategories,
  updateAdminCategory,
  type AdminCategory,
} from './adminRegistryApi';
import { generateCategoryId } from './adminPresentation';

export default function CategoriesAdmin() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

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

  async function persistOrder(next: AdminCategory[]) {
    setReordering(true);
    setError(null);
    setSuccess(null);
    const previous = categories;
    setCategories(next);

    try {
      await reorderAdminCategories(next.map((c) => c.id));
      setSuccess('סדר התצוגה עודכן.');
      await reload();
    } catch (err) {
      setCategories(previous);
      setError(err instanceof Error ? err.message : 'עדכון סדר הקטגוריות נכשל.');
    } finally {
      setReordering(false);
    }
  }

  function moveCategory(categoryId: string, direction: -1 | 1) {
    if (reordering) return;
    const index = categories.findIndex((c) => c.id === categoryId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;

    const next = [...categories];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    void persistOrder(next);
  }

  function onDragStart(categoryId: string) {
    if (reordering) return;
    setDragId(categoryId);
  }

  function onDragOver(event: React.DragEvent, overId: string) {
    event.preventDefault();
    if (!dragId || dragId === overId || reordering) return;
  }

  function onDrop(overId: string) {
    if (!dragId || dragId === overId || reordering) {
      setDragId(null);
      return;
    }
    const from = categories.findIndex((c) => c.id === dragId);
    const to = categories.findIndex((c) => c.id === overId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    const next = [...categories];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void persistOrder(next);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const id = generateCategoryId(
      trimmedName,
      categories.map((c) => c.id),
    );
    const maxOrder = categories.reduce(
      (max, c) => Math.max(max, Number.isFinite(c.sort_order) ? c.sort_order : 0),
      0,
    );

    try {
      await createAdminCategory({
        id,
        display_name: trimmedName,
        sort_order: maxOrder + 10,
      });
      setNewName('');
      setSuccess(`הקטגוריה נוצרה (קוד: ${id}).`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'יצירת קטגוריה נכשלה.');
    }
  }

  async function handleUpdate(category: AdminCategory, displayName: string) {
    setError(null);
    setSuccess(null);

    try {
      await updateAdminCategory(category.id, {
        display_name: displayName,
      });
      setSuccess('הקטגוריה עודכנה.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'עדכון קטגוריה נכשל.');
    }
  }

  async function handleDelete(categoryId: string) {
    if (!window.confirm('למחוק את הקטגוריה?')) {
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
    <section className="admin-section admin-section--categories">
      <header className="admin-section-header">
        <h2>קטגוריות</h2>
        <p>יצירה ועריכה של קטגוריות לאתרי הקטלוג. הקוד הטכני נוצר אוטומטית.</p>
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

      <div className="admin-categories-layout">
        {/* First in DOM = right in RTL (editor). Second = left (reorder panel). */}
        <div className="admin-category-editor">
          <form
            className="admin-edit-shell admin-category-create"
            onSubmit={(event) => void handleCreate(event)}
          >
            <h3>קטגוריה חדשה</h3>
            <div className="admin-category-row">
              <label className="admin-field admin-category-name">
                <span>שם</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="לדוגמה: בנקים"
                />
              </label>
              <button type="submit" className="admin-btn admin-btn-primary">
                הוסף קטגוריה
              </button>
            </div>
          </form>

          <div className="admin-scroll-panel admin-category-scroll" aria-label="עריכת קטגוריות">
            <ul className="admin-list admin-category-list">
              {categories.map((category) => (
                <li key={category.id} className="admin-list-item admin-category-item">
                  <CategoryRow
                    category={category}
                    onSave={handleUpdate}
                    onDelete={() => void handleDelete(category.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="admin-category-reorder" aria-label="סידור קטגוריות">
          <h3>סידור תצוגה</h3>
          <p className="admin-field-hint">
            גררו קטגוריה, או השתמשו בחצים, כדי לשנות את סדר התצוגה בקטלוג.
          </p>
          {categories.length === 0 ? (
            <p className="admin-muted">אין עדיין קטגוריות לסידור.</p>
          ) : (
            <ul className="admin-reorder-list">
              {categories.map((category, index) => (
                <li
                  key={category.id}
                  className={`admin-reorder-item${dragId === category.id ? ' is-dragging' : ''}`}
                  draggable={!reordering}
                  onDragStart={() => onDragStart(category.id)}
                  onDragOver={(event) => onDragOver(event, category.id)}
                  onDrop={() => onDrop(category.id)}
                  onDragEnd={() => setDragId(null)}
                >
                  <span className="admin-reorder-handle" aria-hidden="true">
                    ⋮⋮
                  </span>
                  <span className="admin-reorder-name">{category.display_name}</span>
                  <div className="admin-reorder-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn--compact"
                      disabled={reordering || index === 0}
                      aria-label={`העבר את ${category.display_name} למעלה`}
                      onClick={() => moveCategory(category.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn--compact"
                      disabled={reordering || index === categories.length - 1}
                      aria-label={`העבר את ${category.display_name} למטה`}
                      onClick={() => moveCategory(category.id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}

function CategoryRow({
  category,
  onSave,
  onDelete,
}: {
  category: AdminCategory;
  onSave: (category: AdminCategory, displayName: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [displayName, setDisplayName] = useState(category.display_name);

  useEffect(() => {
    setDisplayName(category.display_name);
  }, [category.display_name]);

  return (
    <form
      className="admin-category-row"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(category, displayName);
      }}
    >
      <label className="admin-field admin-category-name">
        <span>שם תצוגה</span>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <div className="admin-category-actions">
        <button type="submit" className="admin-btn admin-btn-secondary admin-btn--compact">
          שמור
        </button>
        <button type="button" className="admin-btn admin-btn-danger admin-btn--compact" onClick={onDelete}>
          מחק
        </button>
      </div>
      <details className="admin-details admin-category-details">
        <summary>פרטים נוספים</summary>
        <p className="admin-muted">
          קוד מערכת: <span className="admin-chip">{category.id}</span>
        </p>
      </details>
    </form>
  );
}
