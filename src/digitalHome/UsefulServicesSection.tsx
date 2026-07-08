import type { ReactNode } from 'react';

export interface UsefulServicesSectionProps {
  /** Future: real useful-service entries. Empty / omitted → section stays hidden. */
  children?: ReactNode;
}

/**
 * Useful Services foundation (AC-105-10 / D-105-9).
 * Hidden until meaningful content exists — no empty placeholder / reserved space.
 * Future phases enable by passing real content as children.
 */
export default function UsefulServicesSection({
  children,
}: UsefulServicesSectionProps) {
  if (children == null) {
    return null;
  }

  return (
    <section className="dh-panel dh-useful" aria-labelledby="dh-useful-title">
      <h2 id="dh-useful-title" className="dh-panel-title">
        שירותים שימושיים
      </h2>
      <div className="dh-panel-body">{children}</div>
    </section>
  );
}
