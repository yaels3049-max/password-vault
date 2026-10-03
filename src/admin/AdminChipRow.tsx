import { useLayoutEffect, useRef, useState } from 'react';

export interface AdminChip {
  key: string;
  label: string;
  className?: string;
}

const CHIP_GAP_PX = 6;

/**
 * Phase 122.8 R1 — chips on one line. Chips that do not fit collapse into one «+N» chip whose
 * tooltip lists the hidden chips (nothing is removed). Widths come from a hidden measuring row.
 */
export default function AdminChipRow({ chips }: { chips: readonly AdminChip[] }) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(chips.length);
  const chipsKey = chips.map((chip) => `${chip.key}:${chip.label}`).join('|');

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const compute = () => {
      const available = row.clientWidth;
      const nodes = Array.from(measure.children) as HTMLElement[];
      const widths = nodes.slice(0, chips.length).map((node) => node.offsetWidth);
      const moreWidth = nodes[chips.length]?.offsetWidth ?? 0;
      const total = widths.reduce((sum, w, i) => sum + w + (i > 0 ? CHIP_GAP_PX : 0), 0);
      if (available <= 0 || total <= available) {
        setVisibleCount(chips.length);
        return;
      }
      let used = moreWidth;
      let count = 0;
      for (const width of widths) {
        const next = used + CHIP_GAP_PX + width;
        if (next > available) break;
        used = next;
        count += 1;
      }
      setVisibleCount(Math.max(0, count));
    };
    compute();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(compute) : null;
    observer?.observe(row);
    return () => observer?.disconnect();
  }, [chipsKey, chips.length]);

  const shown = chips.slice(0, visibleCount);
  const hidden = chips.slice(visibleCount);

  return (
    <div className="admin-chip-row" ref={rowRef} data-part="chip-row">
      {shown.map((chip) => (
        <span key={chip.key} className={`admin-badge ${chip.className ?? ''}`.trim()} data-chip={chip.key}>
          {chip.label}
        </span>
      ))}
      {hidden.length > 0 ? (
        <span
          className="admin-badge admin-badge--muted admin-chip-more"
          data-chip="more"
          title={hidden.map((chip) => chip.label).join(', ')}
        >
          +{hidden.length}
        </span>
      ) : null}
      <div className="admin-chip-row-measure" ref={measureRef} aria-hidden>
        {chips.map((chip) => (
          <span key={chip.key} className={`admin-badge ${chip.className ?? ''}`.trim()}>
            {chip.label}
          </span>
        ))}
        <span className="admin-badge admin-chip-more">+{chips.length}</span>
      </div>
    </div>
  );
}
