/**
 * D-121-72 — Hub fill-run control: one run token per (lane, executionKey).
 * Holds the in-flight lock, «עצור» (Admin) and the Hub safety bound. A stopped or
 * timed-out run releases its lock at once; a late extension answer of that token is ignored.
 * No secrets: keys are `serviceId::accessProfileId` / `serviceId::admin_test`.
 */

import { sendExtensionMessageAsync } from './extensionBridge';

export const HUB_FILL_RUN_CANCEL_MESSAGE = 'HUB_MANAGED_AUTOFILL_CANCEL';

/** Extension worst case: `GENERIC_REAL_SITE_TAB_LOAD_TIMEOUT_MS` + `GENERIC_REAL_SITE_OPERATION_TIMEOUT_MS`. */
const EXT_RUN_TAB_LOAD_MAX_MS = 120000;
const EXT_RUN_OPERATION_MAX_MS = 120000;
const FILL_RUN_BOUND_MARGIN_MS = 20000;

export const FILL_RUN_HUB_BOUND_MS =
  EXT_RUN_TAB_LOAD_MAX_MS + EXT_RUN_OPERATION_MAX_MS + FILL_RUN_BOUND_MARGIN_MS;

/** Hub-side reason when the safety bound fires (the extension never answered). */
export const FILL_RUN_TIMEOUT_REASON = 'run_timeout';

export const MSG_ADMIN_FILL_TEST_STOPPED = 'הבדיקה נעצרה.';
export const MSG_ADMIN_FILL_TEST_TAB_CLOSED = 'הכרטיסייה נסגרה — הבדיקה הופסקה.';
export const MSG_ADMIN_FILL_TEST_TIMEOUT = 'הבדיקה לא הסתיימה בזמן — נסו שוב.';
/** Digital Home — neutral, generic. */
export const MSG_FILL_RUN_STOPPED = 'המילוי האוטומטי הופסק.';
export const MSG_FILL_RUN_TIMEOUT = 'המילוי האוטומטי לא הסתיים בזמן. נסו שוב.';

export const FILL_RUN_END_REASONS: ReadonlySet<string> = new Set([
  'cancelled',
  'tab_closed',
  FILL_RUN_TIMEOUT_REASON,
]);

/** Copy for a run ended by «עצור», a closed tab or the Hub bound; `null` for any other reason. */
export function fillRunEndMessage(
  reason: string | undefined,
  path: 'admin_test' | 'digital_home',
): string | null {
  if (!reason || !FILL_RUN_END_REASONS.has(reason)) return null;
  if (path === 'admin_test') {
    if (reason === 'cancelled') return MSG_ADMIN_FILL_TEST_STOPPED;
    if (reason === 'tab_closed') return MSG_ADMIN_FILL_TEST_TAB_CLOSED;
    return MSG_ADMIN_FILL_TEST_TIMEOUT;
  }
  return reason === FILL_RUN_TIMEOUT_REASON ? MSG_FILL_RUN_TIMEOUT : MSG_FILL_RUN_STOPPED;
}

export type FillRunLane = 'managed' | 'special';

export type FillRunRace<T> =
  | { kind: 'answer'; value: T }
  | { kind: 'cancelled' }
  | { kind: 'timeout' };

export interface FillRunHandle {
  /** Run key sent to the extension as `runId` (the cancel names it). */
  token: string;
  race<T>(answer: Promise<T>, boundMs?: number): Promise<FillRunRace<T>>;
  release(): void;
}

interface FillRunEntry {
  token: string;
  stop: () => void;
}

const fillRuns = new Map<string, FillRunEntry>();

function laneKey(lane: FillRunLane, executionKey: string): string {
  return `${lane}|${executionKey.trim()}`;
}

function newFillRunToken(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sendFillRunCancel(token: string): void {
  void sendExtensionMessageAsync({ type: HUB_FILL_RUN_CANCEL_MESSAGE, runId: token }).catch(() => undefined);
}

export function isFillRunActive(lane: FillRunLane, executionKey: string): boolean {
  return fillRuns.has(laneKey(lane, executionKey));
}

export function fillRunCount(lane: FillRunLane): number {
  let count = 0;
  for (const key of fillRuns.keys()) {
    if (key.startsWith(`${lane}|`)) count += 1;
  }
  return count;
}

/** `null` → a run of this key is already in flight (busy). */
export function acquireFillRun(lane: FillRunLane, executionKey: string): FillRunHandle | null {
  const key = laneKey(lane, executionKey);
  if (fillRuns.has(key)) return null;

  const token = newFillRunToken();
  let settle: ((outcome: { kind: 'cancelled' }) => void) | null = null;
  let stopped = false;

  const entry: FillRunEntry = {
    token,
    stop: () => {
      stopped = true;
      if (settle) settle({ kind: 'cancelled' });
    },
  };
  fillRuns.set(key, entry);

  function release(): void {
    if (fillRuns.get(key) === entry) fillRuns.delete(key);
  }

  return {
    token,
    release,
    race<T>(answer: Promise<T>, boundMs: number = FILL_RUN_HUB_BOUND_MS): Promise<FillRunRace<T>> {
      if (stopped) return Promise.resolve({ kind: 'cancelled' });
      return new Promise<FillRunRace<T>>((resolve) => {
        let done = false;
        const finish = (outcome: FillRunRace<T>) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          settle = null;
          release();
          resolve(outcome);
        };
        const timer = setTimeout(() => {
          sendFillRunCancel(token);
          finish({ kind: 'timeout' });
        }, boundMs);
        settle = finish;
        answer.then(
          (value) => finish({ kind: 'answer', value }),
          () => finish({ kind: 'answer', value: null as T }),
        );
      });
    },
  };
}

/**
 * «עצור» — cancel to the extension (by token), lock released now, the waiting run
 * resolves as cancelled and any later answer of that token is ignored.
 */
export function stopFillRun(lane: FillRunLane, executionKey: string): boolean {
  const key = laneKey(lane, executionKey);
  const entry = fillRuns.get(key);
  if (!entry) return false;
  fillRuns.delete(key);
  sendFillRunCancel(entry.token);
  entry.stop();
  return true;
}
