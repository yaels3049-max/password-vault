import { TRUST_COPY } from './copy';
import { dismissFirstTimeSecurityTip } from './prefs';

interface SecurityExplanationBannerProps {
  onDismiss: () => void;
  className?: string;
}

/** Short dismissible first-time Zero-Knowledge explanation (AC-106-9). */
export default function SecurityExplanationBanner({
  onDismiss,
  className = '',
}: SecurityExplanationBannerProps) {
  function handleDismiss() {
    dismissFirstTimeSecurityTip();
    onDismiss();
  }

  return (
    <aside
      className={`trust-security-banner ${className}`.trim()}
      role="region"
      aria-labelledby="trust-security-title"
    >
      <h2 id="trust-security-title" className="trust-security-title">
        {TRUST_COPY.firstTimeTitle}
      </h2>
      <p className="trust-security-body">{TRUST_COPY.firstTimeBody}</p>
      <button type="button" className="trust-security-dismiss" onClick={handleDismiss}>
        {TRUST_COPY.firstTimeDismiss}
      </button>
    </aside>
  );
}
