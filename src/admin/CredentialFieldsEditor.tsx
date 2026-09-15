import { useState } from 'react';
import type { CredentialInputType, LoginField, LoginFieldType } from '../service/serviceModel';
import {
  ADMIN_SCHEMA_NOT_CONFIGURED,
  ID_CHANGE_WARNING,
  fieldInputType,
  isFieldMasked,
  isFieldRequired,
} from '../service/credentialSchema';

export interface EditorCredentialField {
  id: string;
  label: string;
  required: boolean;
  masked: boolean;
  inputType: CredentialInputType;
  type: LoginFieldType;
}

export function editorFieldsFromStored(fields: LoginField[] | null | undefined): EditorCredentialField[] {
  if (!fields || fields.length === 0) {
    return [];
  }
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    required: isFieldRequired(field),
    masked: isFieldMasked(field),
    inputType: fieldInputType(field),
    type: field.type,
  }));
}

export function editorFieldsToStored(fields: EditorCredentialField[]): LoginField[] {
  return fields.map((field) => ({
    id: field.id,
    label: field.label.trim(),
    required: field.required,
    masked: field.masked,
    inputType: field.inputType,
    type: field.type,
  }));
}

function newFieldId(): string {
  return `field-${crypto.randomUUID().slice(0, 8)}`;
}

interface CredentialFieldsEditorProps {
  fields: EditorCredentialField[];
  onChange: (fields: EditorCredentialField[]) => void;
}

export default function CredentialFieldsEditor({
  fields,
  onChange,
}: CredentialFieldsEditorProps) {
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [idDrafts, setIdDrafts] = useState<Record<string, string>>({});

  function update(index: number, patch: Partial<EditorCredentialField>) {
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= fields.length) return;
    const copy = [...fields];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    onChange(copy);
  }

  function addField() {
    onChange([
      ...fields,
      {
        id: newFieldId(),
        label: '',
        required: true,
        masked: false,
        inputType: 'text',
        type: 'text',
      },
    ]);
  }

  function removeField(index: number) {
    if (!window.confirm(ID_CHANGE_WARNING)) {
      return;
    }
    const removed = fields[index];
    if (removed) {
      setRemovedIds((ids) => (ids.includes(removed.id) ? ids : [...ids, removed.id]));
    }
    onChange(fields.filter((_, i) => i !== index));
  }

  function commitId(index: number, nextId: string) {
    const trimmed = nextId.trim();
    const current = fields[index];
    if (!current || !trimmed || trimmed === current.id) {
      setIdDrafts((drafts) => {
        const next = { ...drafts };
        delete next[current.id];
        return next;
      });
      return;
    }
    const reused = removedIds.includes(trimmed) || fields.some((field, i) => i !== index && field.id === trimmed);
    if (!window.confirm(ID_CHANGE_WARNING)) {
      setIdDrafts((drafts) => {
        const next = { ...drafts };
        delete next[current.id];
        return next;
      });
      return;
    }
    if (reused) {
      setRemovedIds((ids) => ids.filter((id) => id !== trimmed));
    }
    update(index, { id: trimmed });
    setIdDrafts((drafts) => {
      const next = { ...drafts };
      delete next[current.id];
      return next;
    });
  }

  return (
    <fieldset className="admin-field admin-credential-fields">
      <legend>שדות כניסה</legend>
      {fields.length === 0 ? (
        <p className="admin-field-hint">{ADMIN_SCHEMA_NOT_CONFIGURED}</p>
      ) : (
        <ol className="admin-credential-field-list">
          {fields.map((field, index) => (
            <li key={field.id} className="admin-credential-field">
              <label className="admin-field">
                <span>תווית</span>
                <input
                  value={field.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  required
                />
              </label>
              <label className="admin-chip">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) => update(index, { required: event.target.checked })}
                />{' '}
                חובה
              </label>
              <label className="admin-field">
                <span>סוג קלט</span>
                <select
                  value={field.inputType}
                  onChange={(event) =>
                    update(index, { inputType: event.target.value as CredentialInputType })
                  }
                >
                  <option value="text">טקסט</option>
                  <option value="number">מספר</option>
                </select>
              </label>
              <label className="admin-chip">
                <input
                  type="checkbox"
                  checked={field.masked}
                  onChange={(event) => update(index, { masked: event.target.checked })}
                />{' '}
                מוסתר
              </label>
              <label className="admin-field">
                <span>תפקיד מילוי (מתקדם)</span>
                <select
                  value={field.type}
                  onChange={(event) =>
                    update(index, { type: event.target.value as LoginFieldType })
                  }
                >
                  <option value="text">טקסט</option>
                  <option value="password">סיסמת אתר</option>
                </select>
              </label>
              <label className="admin-field">
                <span>מזהה</span>
                <input
                  value={idDrafts[field.id] ?? field.id}
                  onChange={(event) =>
                    setIdDrafts((drafts) => ({ ...drafts, [field.id]: event.target.value }))
                  }
                  onBlur={(event) => commitId(index, event.target.value)}
                  dir="ltr"
                />
              </label>
              <div className="admin-actions-row">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => move(index, -1)} disabled={index === 0}>
                  למעלה
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => move(index, 1)}
                  disabled={index === fields.length - 1}
                >
                  למטה
                </button>
                <button type="button" className="admin-btn admin-btn-danger" onClick={() => removeField(index)}>
                  הסר
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="admin-btn admin-btn-secondary" onClick={addField}>
        הוסף שדה
      </button>
    </fieldset>
  );
}
