/** Extract a readable message from Supabase auth / fetch errors. */
export function formatUnknownError(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of ['message', 'details', 'hint', 'error_description', 'error', 'code'] as const) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim() && !parts.includes(candidate.trim())) {
        parts.push(candidate.trim());
      }
    }
    if (parts.length > 0) {
      return parts.join(' — ');
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'unknown error';
}

/** Flatten Error.cause chain for user-visible diagnostics. */
export function formatErrorChain(error: unknown): string {
  if (!(error instanceof Error)) {
    return formatUnknownError(error);
  }

  const parts: string[] = [];
  const primary = error.message.trim() || formatUnknownError(error.cause ?? error);
  if (primary) {
    parts.push(primary);
  }

  let current: unknown = error.cause;
  let depth = 0;

  while (current && depth < 4) {
    const message =
      current instanceof Error
        ? current.message.trim() || formatUnknownError(current)
        : formatUnknownError(current);

    if (message && !parts.includes(message)) {
      parts.push(message);
    }

    current = current instanceof Error ? current.cause : undefined;
    depth += 1;
  }

  return parts.length > 0 ? parts.join(' — ') : 'unknown error';
}
