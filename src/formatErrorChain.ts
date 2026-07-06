/** Extract a readable message from Supabase auth / fetch errors. */
export function formatUnknownError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const candidates = [record.message, record.error_description, record.error, record.code];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
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
