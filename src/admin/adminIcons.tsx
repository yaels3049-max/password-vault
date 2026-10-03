/** Phase 122.4 — inline SVG icon set for the Admin (no icon dependency). Decorative only. */
import type { ReactNode } from 'react';

function Svg({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      className="admin-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconInfo(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Svg>
  );
}

export function IconKey(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.2-8.2M16 7l2 2M14 9l2 2" />
    </Svg>
  );
}

export function IconPlay(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.5 5.5 3.5-5.5 3.5z" />
    </Svg>
  );
}

export function IconWarning(props: { size?: number }) {
  return (
    <Svg {...props}>
      <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </Svg>
  );
}

export function IconSearchEmpty(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4M8.8 11h4.4" />
    </Svg>
  );
}

export function IconFolder(props: { size?: number }) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
    </Svg>
  );
}

export function IconResult(props: { size?: number }) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function IconArrowUp(props: { size?: number }) {
  return (
    <Svg size={16} {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  );
}

export function IconArrowDown(props: { size?: number }) {
  return (
    <Svg size={16} {...props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Svg>
  );
}

export function IconTrash(props: { size?: number }) {
  return (
    <Svg size={16} {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Svg>
  );
}

export function IconPlus(props: { size?: number }) {
  return (
    <Svg size={16} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconNote(props: { size?: number }) {
  return (
    <Svg {...props}>
      <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
      <path d="M14.5 3.5V7.5h4M9 12h6M9 15.5h6" />
    </Svg>
  );
}

export function IconCheckCircle(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8L16 10" />
    </Svg>
  );
}

export function IconClock(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function IconBlock(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.7 5.7 12.6 12.6" />
    </Svg>
  );
}

export function IconMinusCircle(props: { size?: number }) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </Svg>
  );
}

/** Empty state: icon + one sentence. */
export function AdminEmptyState({
  icon,
  children,
  ...rest
}: { icon: ReactNode; children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <div className="admin-empty" {...rest}>
      <span className="admin-empty-icon">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
