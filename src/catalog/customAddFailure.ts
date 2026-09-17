/**
 * Phase 116 corrective — Custom Add upsert/cloud failure classification.
 * Safe Hebrew UX only. Never expose DB internals, stack traces, or secrets.
 */

export type CustomAddFailureClass =
  | 'connectivity'
  | 'auth_policy'
  | 'persistence_validation'
  | 'duplicate_reuse';

export const CUSTOM_ADD_FAIL_CONNECTIVITY_HE =
  'לא ניתן להוסיף את האתר כרגע. בדקו חיבור לרשת ונסו שוב.';

export const CUSTOM_ADD_FAIL_AUTH_POLICY_HE =
  'לא ניתן להוסיף את האתר כרגע. התחברו מחדש או בדקו את הרשאות החשבון.';

export const CUSTOM_ADD_FAIL_PERSISTENCE_HE =
  'לא ניתן לשמור את האתר כרגע. נסו שוב מאוחר יותר.';

export const CUSTOM_ADD_FAIL_DUPLICATE_HE =
  'האתר כבר קיים ברשימה שלכם.';

function readErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message ?? '';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.code, record.details, record.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim());
    return parts.join(' ');
  }
  return '';
}

function readStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const record = error as Record<string, unknown>;
  for (const key of ['status', 'statusCode', 'status_code']) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && /^\d{3}$/.test(value.trim())) {
      return Number(value.trim());
    }
  }
  return null;
}

/**
 * Classify Custom Add cloud/upsert failures for user-facing messaging.
 * Known duplicate/reuse should be handled before calling this when typed.
 */
export function classifyCustomAddFailure(error: unknown): {
  failureClass: CustomAddFailureClass;
  userMessage: string;
} {
  const text = readErrorText(error);
  const lower = text.toLowerCase();
  const status = readStatusCode(error);
  const code =
    error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
      ? String((error as { code: string }).code).toUpperCase()
      : '';

  // Connectivity / transport
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('err_network') ||
    lower.includes('err_internet_disconnected') ||
    lower.includes('err_connection') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('timeout') ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    return {
      failureClass: 'connectivity',
      userMessage: CUSTOM_ADD_FAIL_CONNECTIVITY_HE,
    };
  }

  // Authentication / authorization / policy (RLS, JWT, 401/403)
  if (
    status === 401 ||
    status === 403 ||
    code === '401' ||
    code === '403' ||
    code === 'PGRST301' ||
    lower.includes('jwt') ||
    lower.includes('not authenticated') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('rls') ||
    lower.includes('policy')
  ) {
    return {
      failureClass: 'auth_policy',
      userMessage: CUSTOM_ADD_FAIL_AUTH_POLICY_HE,
    };
  }

  // Known duplicate signals that escaped typed handling
  if (
    code === '23505' ||
    lower.includes('duplicate') ||
    lower.includes('unique constraint') ||
    lower.includes('already exists')
  ) {
    return {
      failureClass: 'duplicate_reuse',
      userMessage: CUSTOM_ADD_FAIL_DUPLICATE_HE,
    };
  }

  // Persistence / validation (default for unknown upsert failures — not network)
  return {
    failureClass: 'persistence_validation',
    userMessage: CUSTOM_ADD_FAIL_PERSISTENCE_HE,
  };
}

export function userMessageForCustomAddFailure(error: unknown): string {
  return classifyCustomAddFailure(error).userMessage;
}
