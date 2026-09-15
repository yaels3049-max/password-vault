import type { CredentialInputType, LoginField } from './serviceModel';

export type StoredCredentialSchemaStatus = 'valid' | 'missing' | 'empty' | 'invalid';

export const INCOMPLETE_SCHEMA_MESSAGE =
  'לא ניתן להזין פרטי כניסה — שדות הכניסה לאתר זה עדיין לא הוגדרו.';

export const STORED_DETAILS_RETAINED_MESSAGE =
  'אם כבר נשמרו פרטים, הם נשמרים ולא מוצגים כאן.';

export const ADMIN_SCHEMA_NOT_CONFIGURED =
  'שדות הכניסה לאתר זה עדיין לא הוגדרו.';

export const ID_CHANGE_WARNING =
  'שינוי או הסרה של מזהה השדה עלולים לנתק ערכים שכבר נשמרו. הערכים לא יוצגו ולא יועתקו למזהה חדש. להמשיך?';

export const MODE_CLEAR_WARNING =
  'הגדרת השדות תימחק. פרטים שכבר נשמרו לא יוצגו ולא יועתקו. להמשיך?';

export const NO_STORED_CREDENTIALS_MESSAGE =
  'הבית הדיגיטלי לא שומר פרטי כניסה לאתר זה. ההזדהות מתבצעת באתר עצמו.';

export const REJECT_CREDENTIAL_FIELDS_WITHOUT_LIST =
  'לא ניתן לשמור «יש לשמור פרטי כניסה» בלי שדה כניסה תקין אחד לפחות.';

export const REJECT_NO_STORED_WITH_FIELDS =
  'לא ניתן לשמור «אין לשמור פרטי כניסה» יחד עם שדות כניסה פעילים.';

export const REJECT_NOT_CONFIGURED_WITH_FIELDS =
  'לא ניתן לשמור «טרם הוגדר» כל עוד רשימת שדות פעילה.';

export const NUMBER_DIGITS_ONLY_MESSAGE =
  'שדה מספרי יכול להכיל ספרות בלבד. אפסים מובילים נשמרים.';

export const ADMIN_MODE_NOT_CONFIGURED_LABEL = 'טרם הוגדר';
export const ADMIN_MODE_CREDENTIAL_FIELDS_LABEL = 'יש לשמור פרטי כניסה';
export const ADMIN_MODE_NO_STORED_LABEL = 'אין לשמור פרטי כניסה';
export const ADMIN_NO_STORED_HINT = 'ההזדהות מתבצעת באתר עצמו.';

/** Informational only. Shown in the manage-action slot for NO_STORED_CREDENTIALS. */
export const NO_STORED_CREDENTIALS_LIST_LABEL = 'ללא פרטי כניסה';

export type CredentialMode =
  | 'not_configured'
  | 'credential_fields'
  | 'no_stored_credentials';

/** Render-time only. Never persist because a form opened. */
export const CUSTOM_DEFAULT_LOGIN_FIELDS: LoginField[] = [
  { id: 'username', label: 'שם משתמש', type: 'text', required: true, masked: false },
  { id: 'password', label: 'סיסמה', type: 'password', required: true, masked: true },
];

export type StoredCredentialSchema =
  | { status: 'valid'; fields: LoginField[] }
  | { status: 'missing' }
  | { status: 'empty' }
  | { status: 'invalid' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

/**
 * Classify a stored `login_fields` value. Does not invent Username + Password.
 * An invalid or empty value is not repaired.
 */
export function classifyStoredLoginFields(raw: unknown): StoredCredentialSchema {
  if (raw === undefined || raw === null) {
    return { status: 'missing' };
  }
  if (!Array.isArray(raw)) {
    return { status: 'invalid' };
  }
  if (raw.length === 0) {
    return { status: 'empty' };
  }

  const fields: LoginField[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!isRecord(entry)) {
      return { status: 'invalid' };
    }
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    if (!id || !label || seen.has(id)) {
      return { status: 'invalid' };
    }
    if (!isOptionalBoolean(entry.required) || !isOptionalBoolean(entry.masked)) {
      return { status: 'invalid' };
    }
    const type = entry.type === undefined ? 'text' : entry.type;
    if (type !== 'text' && type !== 'password') {
      return { status: 'invalid' };
    }
    if (
      entry.inputType !== undefined &&
      entry.inputType !== 'text' &&
      entry.inputType !== 'number'
    ) {
      return { status: 'invalid' };
    }

    const field: LoginField = { id, label, type };
    if (typeof entry.required === 'boolean') {
      field.required = entry.required;
    }
    if (typeof entry.masked === 'boolean') {
      field.masked = entry.masked;
    }
    if (entry.inputType === 'text' || entry.inputType === 'number') {
      field.inputType = entry.inputType;
    }
    seen.add(id);
    fields.push(field);
  }

  return { status: 'valid', fields };
}

export function isFieldRequired(field: LoginField): boolean {
  return field.required !== false;
}

export function isFieldMasked(field: LoginField): boolean {
  if (field.masked === true) return true;
  if (field.masked === false) return false;
  return field.type === 'password';
}

/** Omitted inputType is text. Does not read password role. */
export function fieldInputType(field: Pick<LoginField, 'inputType'>): CredentialInputType {
  return field.inputType === 'number' ? 'number' : 'text';
}

/** ASCII digits only. Does not coerce through Number. */
export function isLosslessDigitString(value: string): boolean {
  return /^\d+$/.test(value);
}

export function readStoredCredentialMode(metadata: unknown): CredentialMode | 'absent' | 'unrecognized' {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    return 'absent';
  }
  const value = (metadata as Record<string, unknown>).credentialMode;
  if (value === undefined) {
    return 'absent';
  }
  if (
    value === 'not_configured' ||
    value === 'credential_fields' ||
    value === 'no_stored_credentials'
  ) {
    return value;
  }
  return 'unrecognized';
}

export type ResolvedGlobalCredential =
  | { status: 'credential_fields'; fields: LoginField[] }
  | { status: 'no_stored_credentials' }
  | { status: 'not_configured'; reason: 'missing' | 'empty' }
  | { status: 'configuration_invalid' };

function hasActiveFields(classified: StoredCredentialSchema): classified is { status: 'valid'; fields: LoginField[] } {
  return classified.status === 'valid';
}

/**
 * Global mode resolution. Never infers NO_STORED_CREDENTIALS from an empty array.
 * A contradictory stored pair stays configuration-invalid.
 */
export function resolveGlobalCredentialConfiguration(input: {
  metadata?: unknown;
  loginFields?: unknown;
  storedLoginFieldsStatus?: StoredCredentialSchemaStatus;
}): ResolvedGlobalCredential {
  const classified = input.storedLoginFieldsStatus === 'invalid'
    ? ({ status: 'invalid' } as const)
    : classifyStoredLoginFields(input.loginFields === undefined ? undefined : input.loginFields);
  const status = input.storedLoginFieldsStatus && input.storedLoginFieldsStatus !== 'invalid'
    ? input.storedLoginFieldsStatus
    : classified.status;
  const active = status === 'valid' && hasActiveFields(classified) ? classified.fields : null;
  const mode = readStoredCredentialMode(input.metadata);
  const explicit = mode === 'absent' || mode === 'unrecognized' ? null : mode;

  if (explicit === 'credential_fields') {
    return active ? { status: 'credential_fields', fields: active } : { status: 'configuration_invalid' };
  }
  if (explicit === 'no_stored_credentials') {
    if (active || status === 'invalid') {
      return { status: 'configuration_invalid' };
    }
    return { status: 'no_stored_credentials' };
  }
  if (explicit === 'not_configured') {
    if (active) {
      return { status: 'configuration_invalid' };
    }
    return { status: 'not_configured', reason: status === 'empty' ? 'empty' : 'missing' };
  }

  if (active) {
    return { status: 'credential_fields', fields: active };
  }
  return { status: 'not_configured', reason: status === 'empty' ? 'empty' : 'missing' };
}

export type CredentialEntryResolution =
  | { kind: 'form'; origin: 'explicit' | 'custom-default'; fields: LoginField[] }
  | { kind: 'incomplete'; status: 'missing' | 'empty' | 'invalid' | 'contradictory' }
  | { kind: 'no-stored-credentials' };

/** Credential-management panel may open for form and incomplete. Not for no-stored. */
export function offersCredentialManagementPanel(
  input: Parameters<typeof resolveCredentialEntry>[0],
): boolean {
  return resolveCredentialEntry(input).kind !== 'no-stored-credentials';
}

/** True only for resolved NO_STORED_CREDENTIALS. Never inferred from empty fields. */
export function isNoStoredCredentialsMode(
  input: Parameters<typeof resolveCredentialEntry>[0],
): boolean {
  return resolveCredentialEntry(input).kind === 'no-stored-credentials';
}

/** Profiles and credential fields only when a real form is available. */
export function allowsCredentialProfileManagement(entry: CredentialEntryResolution): boolean {
  return entry.kind === 'form';
}

/**
 * Credential-entry resolution only. Does not write `login_fields`.
 * Global missing/empty/invalid does not become the custom default.
 */
export function resolveCredentialEntry(input: {
  source?: string | null;
  loginFields?: LoginField[] | null;
  metadata?: unknown;
  storedLoginFieldsStatus?: StoredCredentialSchemaStatus;
}): CredentialEntryResolution {
  const classified = input.storedLoginFieldsStatus === 'invalid'
    ? ({ status: 'invalid' } as const)
    : classifyStoredLoginFields(
        input.loginFields === undefined ? undefined : input.loginFields,
      );
  const isCustom = input.source === 'user-created';

  if (isCustom) {
    if (classified.status === 'valid') {
      return { kind: 'form', origin: 'explicit', fields: classified.fields };
    }
    return { kind: 'form', origin: 'custom-default', fields: CUSTOM_DEFAULT_LOGIN_FIELDS };
  }

  const resolved = resolveGlobalCredentialConfiguration(input);
  if (resolved.status === 'credential_fields') {
    return { kind: 'form', origin: 'explicit', fields: resolved.fields };
  }
  if (resolved.status === 'no_stored_credentials') {
    return { kind: 'no-stored-credentials' };
  }
  if (resolved.status === 'configuration_invalid') {
    return { kind: 'incomplete', status: 'contradictory' };
  }
  if (classified.status === 'invalid' || input.storedLoginFieldsStatus === 'invalid') {
    return { kind: 'incomplete', status: 'invalid' };
  }
  if (resolved.reason === 'empty' || classified.status === 'empty') {
    return { kind: 'incomplete', status: 'empty' };
  }
  return { kind: 'incomplete', status: 'missing' };
}

export type CredentialWritePlan =
  | { ok: true; credentialMode: CredentialMode; loginFields: LoginField[] | null }
  | { ok: false; message: string };

/**
 * Reject a contradictory mode/field pair. Does not invent Username + Password.
 * A confirmed clear is represented by null or [] fields, not by a silent rewrite.
 */
export function planCredentialConfigurationWrite(input: {
  mode: CredentialMode;
  fields?: LoginField[] | null;
}): CredentialWritePlan {
  const classified = classifyStoredLoginFields(
    input.fields === undefined ? null : input.fields,
  );
  const active = classified.status === 'valid';

  if (input.mode === 'credential_fields') {
    if (!active) {
      return { ok: false, message: REJECT_CREDENTIAL_FIELDS_WITHOUT_LIST };
    }
    return { ok: true, credentialMode: 'credential_fields', loginFields: classified.fields };
  }

  if (active || classified.status === 'invalid') {
    return {
      ok: false,
      message:
        input.mode === 'no_stored_credentials'
          ? REJECT_NO_STORED_WITH_FIELDS
          : REJECT_NOT_CONFIGURED_WITH_FIELDS,
    };
  }

  return {
    ok: true,
    credentialMode: input.mode,
    loginFields: null,
  };
}

/**
 * Current schema ids only. Empty optional fields are omitted.
 * Does not copy values onto a different id.
 */
export function serializeCredentialValues(
  fields: LoginField[],
  values: Record<string, string>,
): { ok: true; credential: Record<string, string> } | { ok: false; message?: string } {
  const credential: Record<string, string> = {};

  for (const field of fields) {
    const raw = values[field.id] ?? '';
    const trimmed = raw.trim();
    if (!trimmed) {
      if (isFieldRequired(field)) {
        return { ok: false };
      }
      continue;
    }
    if (fieldInputType(field) === 'number') {
      if (!isLosslessDigitString(trimmed)) {
        return { ok: false, message: NUMBER_DIGITS_ONLY_MESSAGE };
      }
      credential[field.id] = trimmed;
      continue;
    }
    credential[field.id] = field.type === 'password' ? raw : trimmed;
  }

  return { ok: true, credential };
}
