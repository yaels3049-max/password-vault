import { isDevBuild } from './devMode';

/** D-123-5 — stage durations of a save (ms). Dev builds only; never logs values. */
export interface SaveTiming {
  mark: (stage: string) => void;
  done: () => void;
}

export function startSaveTiming(label: string): SaveTiming {
  const start = performance.now();
  let last = start;
  const stages: Record<string, number> = {};
  return {
    mark(stage) {
      const now = performance.now();
      stages[stage] = Math.round(now - last);
      last = now;
    },
    done() {
      if (isDevBuild()) {
        console.info(`[timing] ${label}`, {
          ...stages,
          totalMs: Math.round(performance.now() - start),
        });
      }
    },
  };
}
