import { TRUST_TERMS } from './copy';

interface VaultStateBadgeProps {
  unlocked: boolean;
  onLock?: () => void;
  className?: string;
}

/**
 * Immediate vault lock/unlock visibility (AC-106-2, AC-106-10).
 * Reflects session truth — not a second crypto state machine.
 */
export default function VaultStateBadge({
  unlocked,
  onLock,
  className = '',
}: VaultStateBadgeProps) {
  return (
    <div
      className={`vault-state-badge ${unlocked ? 'vault-state-badge--open' : 'vault-state-badge--locked'} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="vault-state-badge-dot" aria-hidden="true" />
      <span className="vault-state-badge-label">
        {unlocked ? TRUST_TERMS.vaultOpen : TRUST_TERMS.vaultLocked}
      </span>
      {unlocked && onLock && (
        <button type="button" className="vault-state-badge-lock" onClick={onLock}>
          {TRUST_TERMS.vaultLockAction}
        </button>
      )}
    </div>
  );
}
