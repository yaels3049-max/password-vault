import { useState } from 'react';
import type { CredentialInputType, LoginField, LoginFieldType } from '../service/serviceModel';
import {
  ADMIN_SCHEMA_NOT_CONFIGURED,
  ID_CHANGE_WARNING,
  fieldInputType,
  isFieldMasked,
  isFieldRequired,
} from '../service/credentialSchema';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from './adminIcons';

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

export const CREDENTIAL_FIELD_COPY_HE = {
  label: 'שם השדה',
  labelHint: 'כך השדה יופיע למשתמש. הסוכן משתמש בו גם כדי למצוא את השדה באתר.',
  sitePassword: 'זה שדה הסיסמה של האתר',
  sitePasswordHint:
    'כשמסומן: המערכת תחפש לו שדה סיסמה באתר, תשמור את הערך בדיוק כפי שהוקלד (כולל רווחים), והערך יוסתר תמיד אצל המשתמש.',
  legacyMasked: 'מוסתר בתצוגה',
  allowedValue: 'ערך מותר',
  allowedAny: 'כל תו',
  allowedDigits: 'ספרות בלבד',
  allowedAnyHint: 'אפשר להקליד אותיות, ספרות וסימנים.',
  allowedDigitsHint: 'המערכת תדחה אותיות ותווים שאינם ספרות (למשל ת"ז).',
  required: 'חובה למלא',
  requiredHint: 'המשתמש לא יוכל לשמור בלי ערך בשדה הזה.',
  advanced: 'מתקדם',
  technicalId: 'מזהה טכני',
  technicalIdHint: 'לשימוש פנימי. שינוי ינתק ערכים שכבר נשמרו אצל משתמשים.',
} as const;

/** The only writer of type / masked from the site-password control. */
export function sitePasswordPatch(checked: boolean): Pick<EditorCredentialField, 'type' | 'masked'> {
  return checked ? { type: 'password', masked: true } : { type: 'text', masked: false };
}

/** Legacy only: a non-password field stored with masked true keeps a way to clear it. */
export function showsLegacyMaskedControl(field: EditorCredentialField): boolean {
  return field.type !== 'password' && field.masked === true;
}

function newFieldId(): string {
  return `field-${crypto.randomUUID().slice(0, 8)}`;
}

export type CredentialFieldChange = 'remove' | 'id';

interface CredentialFieldsEditorProps {
  fields: EditorCredentialField[];
  onChange: (fields: EditorCredentialField[]) => void;
  /**
   * Phase 122.5 R4 — ids in the last saved login_fields of an active global site. Only
   * removing / renaming one of these asks first; new fields and other edits never ask.
   */
  protectedFieldIds?: readonly string[];
  confirmFieldChange?: (change: CredentialFieldChange, message: string) => Promise<boolean>;
}

const NO_PROTECTED_IDS: readonly string[] = [];

export default function CredentialFieldsEditor({
  fields,
  onChange,
  protectedFieldIds = NO_PROTECTED_IDS,
  confirmFieldChange,
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

  function needsConfirm(id: string): boolean {
    return protectedFieldIds.includes(id);
  }

  async function confirmIfProtected(id: string, change: CredentialFieldChange): Promise<boolean> {
    if (!needsConfirm(id)) return true;
    return confirmFieldChange ? confirmFieldChange(change, ID_CHANGE_WARNING) : false;
  }

  async function removeField(index: number) {
    const target = fields[index];
    if (!target || !(await confirmIfProtected(target.id, 'remove'))) {
      return;
    }
    const removed = fields[index];
    if (removed) {
      setRemovedIds((ids) => (ids.includes(removed.id) ? ids : [...ids, removed.id]));
    }
    onChange(fields.filter((_, i) => i !== index));
  }

  async function commitId(index: number, nextId: string) {
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
    if (!(await confirmIfProtected(current.id, 'id'))) {
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
              <div data-control="label">
                <label className="admin-field">
                  <span>{CREDENTIAL_FIELD_COPY_HE.label}</span>
                  <input
                    value={field.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                    required
                  />
                </label>
                <p className="admin-field-hint">{CREDENTIAL_FIELD_COPY_HE.labelHint}</p>
              </div>
              <div data-control="site-password">
                <label className="admin-chip">
                  <input
                    type="checkbox"
                    checked={field.type === 'password'}
                    onChange={(event) => update(index, sitePasswordPatch(event.target.checked))}
                  />{' '}
                  {CREDENTIAL_FIELD_COPY_HE.sitePassword}
                </label>
                <p className="admin-field-hint">{CREDENTIAL_FIELD_COPY_HE.sitePasswordHint}</p>
              </div>
              {showsLegacyMaskedControl(field) ? (
                <div data-control="legacy-masked">
                  <label className="admin-chip">
                    <input
                      type="checkbox"
                      checked={field.masked}
                      onChange={(event) => update(index, { masked: event.target.checked })}
                    />{' '}
                    {CREDENTIAL_FIELD_COPY_HE.legacyMasked}
                  </label>
                </div>
              ) : null}
              <div data-control="allowed-value">
                <label className="admin-field">
                  <span>{CREDENTIAL_FIELD_COPY_HE.allowedValue}</span>
                  <select
                    value={field.inputType}
                    onChange={(event) =>
                      update(index, { inputType: event.target.value as CredentialInputType })
                    }
                  >
                    <option value="text">{CREDENTIAL_FIELD_COPY_HE.allowedAny}</option>
                    <option value="number">{CREDENTIAL_FIELD_COPY_HE.allowedDigits}</option>
                  </select>
                </label>
                <p className="admin-field-hint">
                  {field.inputType === 'number'
                    ? CREDENTIAL_FIELD_COPY_HE.allowedDigitsHint
                    : CREDENTIAL_FIELD_COPY_HE.allowedAnyHint}
                </p>
              </div>
              <div data-control="required">
                <label className="admin-chip">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) => update(index, { required: event.target.checked })}
                  />{' '}
                  {CREDENTIAL_FIELD_COPY_HE.required}
                </label>
                <p className="admin-field-hint">{CREDENTIAL_FIELD_COPY_HE.requiredHint}</p>
              </div>
              <details className="admin-details" data-control="advanced">
                <summary>{CREDENTIAL_FIELD_COPY_HE.advanced}</summary>
                <label className="admin-field">
                  <span>{CREDENTIAL_FIELD_COPY_HE.technicalId}</span>
                  <input
                    value={idDrafts[field.id] ?? field.id}
                    onChange={(event) =>
                      setIdDrafts((drafts) => ({ ...drafts, [field.id]: event.target.value }))
                    }
                    onBlur={(event) => void commitId(index, event.target.value)}
                    dir="ltr"
                  />
                </label>
                <p className="admin-field-hint">{CREDENTIAL_FIELD_COPY_HE.technicalIdHint}</p>
              </details>
              <div className="admin-actions-row admin-credential-field-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => move(index, -1)} disabled={index === 0}>
                  <IconArrowUp />
                  למעלה
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => move(index, 1)}
                  disabled={index === fields.length - 1}
                >
                  <IconArrowDown />
                  למטה
                </button>
                <button type="button" className="admin-btn admin-btn-danger" onClick={() => void removeField(index)}>
                  <IconTrash />
                  הסר
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="admin-btn admin-btn-secondary" onClick={addField}>
        <IconPlus />
        הוסף שדה
      </button>
    </fieldset>
  );
}
