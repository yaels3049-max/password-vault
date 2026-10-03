import { ADMIN_VISUAL_PICK_HUB_GRACE_MS, ADMIN_VISUAL_PICK_TIMEOUT_MS } from '../assistedMapping/types';

/** Disarms the page listener (best-effort; the editor never waits for it). */
export type VisualPickDisarm = () => unknown;

export type VisualPickRunOutcome<R> = { stale: true } | { stale: false; result: R };

interface Timers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

function disarmSafely(disarm: VisualPickDisarm | null): void {
  if (!disarm) return;
  void Promise.resolve()
    .then(disarm)
    .catch(() => undefined);
}

const defaultTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * D-121-42 — one armed Admin Visual pick at a time: Hub safety bound (page bound +
 * grace), cancel, and a token so a late Ext response after timeout / cancel / a
 * newer pick is ignored. Every give-up path disarms the page listener.
 */
export class AdminVisualPickSession {
  private token = 0;
  private activeToken: number | null = null;
  private activeDisarm: VisualPickDisarm | null = null;
  private timer: unknown = null;
  private readonly timers: Timers;

  constructor(timers: Timers = defaultTimers) {
    this.timers = timers;
  }

  get armed(): boolean {
    return this.activeToken !== null;
  }

  async run<R>(opts: {
    start: () => Promise<R>;
    disarm: VisualPickDisarm;
    /** Hub gave up (no Ext answer within bound + grace); page already disarmed. */
    onHubTimeout: () => void;
  }): Promise<VisualPickRunOutcome<R>> {
    this.release();
    const token = (this.token += 1);
    this.activeToken = token;
    this.activeDisarm = opts.disarm;
    this.timer = this.timers.set(() => {
      if (this.activeToken !== token) return;
      const disarm = this.activeDisarm;
      this.release();
      this.token += 1;
      disarmSafely(disarm);
      opts.onHubTimeout();
    }, ADMIN_VISUAL_PICK_TIMEOUT_MS + ADMIN_VISUAL_PICK_HUB_GRACE_MS);

    let result: R;
    try {
      result = await opts.start();
    } catch (err) {
      if (this.activeToken !== token) return { stale: true };
      this.release();
      this.token += 1;
      throw err;
    }
    if (this.activeToken !== token) return { stale: true };
    this.release();
    this.token += 1;
    return { stale: false, result };
  }

  /** Admin «ביטול» / unmount. Returns false when nothing is armed. */
  cancel(): boolean {
    if (this.activeToken === null) return false;
    const disarm = this.activeDisarm;
    this.release();
    this.token += 1;
    disarmSafely(disarm);
    return true;
  }

  private release(): void {
    if (this.timer !== null) {
      this.timers.clear(this.timer);
      this.timer = null;
    }
    this.activeToken = null;
    this.activeDisarm = null;
  }
}
