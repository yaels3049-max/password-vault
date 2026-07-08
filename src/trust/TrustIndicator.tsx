import { TRUST_COPY, TRUST_TERMS } from './copy';

interface TrustIndicatorProps {
  /** Compact chip vs short explanatory line. */
  variant?: 'chip' | 'inline';
  className?: string;
}

/**
 * Visual trust marker — reflects real client-side encrypted vault (D-106-8).
 */
export default function TrustIndicator({
  variant = 'chip',
  className = '',
}: TrustIndicatorProps) {
  if (variant === 'inline') {
    return (
      <p className={`trust-indicator trust-indicator--inline ${className}`.trim()} role="note">
        {TRUST_COPY.credentialsManagedHint}
      </p>
    );
  }

  return (
    <span
      className={`trust-indicator trust-indicator--chip ${className}`.trim()}
      title={TRUST_COPY.cannotReadPasswords}
    >
      <span className="trust-indicator-dot" aria-hidden="true" />
      {TRUST_TERMS.encryptedOnDevice}
    </span>
  );
}
