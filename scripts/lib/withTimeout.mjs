/**
 * H-1 (Phase 123) — bounded verify runs. A timeout is a FAILED run, never a caught mutation:
 * mutation loops must test `isTimeout(error)` before counting a throw as "caught".
 */
export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
    this.isTimeout = true;
  }
}

export const isTimeout = (error) => error instanceof TimeoutError || error?.isTimeout === true;

/** Resolves / rejects like `work` (a promise or a function returning one), or rejects after `ms`. */
export function withTimeout(work, ms, label) {
  const promise = typeof work === 'function' ? Promise.resolve().then(work) : Promise.resolve(work);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export const mutationTimeoutMessage = (id, ms) => `mutation timed out: ${id} after ${Math.round(ms / 1000)}s`;
export const checkTimeoutMessage = (group) => `check timed out: ${group}`;

/** Closes an http server without waiting on keep-alive sockets; bounded. */
export function closeServer(server, ms = 5000) {
  return withTimeout(
    new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    }),
    ms,
    checkTimeoutMessage('static server close'),
  );
}

/** Prints the failure, runs a bounded cleanup and exits 1 (open handles cannot keep it alive). */
export async function failRun(message, cleanup) {
  console.error(`\nFAIL — ${message}`);
  if (cleanup) {
    try {
      await withTimeout(cleanup, 10000, 'cleanup timed out');
    } catch {
      // exit regardless
    }
  }
  process.exit(1);
}
