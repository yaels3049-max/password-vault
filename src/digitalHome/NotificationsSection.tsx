import type { ReactNode } from 'react';

export interface NotificationsSectionProps {
  /** Future: real notification entries. Empty / omitted → section stays hidden. */
  children?: ReactNode;
}

/**
 * Notifications foundation (AC-105-11 / D-105-10).
 * Hidden until meaningful content exists — no empty placeholder / reserved space.
 * Future phases enable by passing real content as children.
 */
export default function NotificationsSection({
  children,
}: NotificationsSectionProps) {
  if (children == null) {
    return null;
  }

  return (
    <section className="dh-panel dh-notifications" aria-labelledby="dh-notifications-title">
      <h2 id="dh-notifications-title" className="dh-panel-title">
        התראות
      </h2>
      <div className="dh-panel-body">{children}</div>
    </section>
  );
}
