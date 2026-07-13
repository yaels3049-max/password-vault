import type { ReactNode } from 'react';
import VaultStateBadge from './VaultStateBadge';

interface AppVaultShellProps {
  children: ReactNode;
  vaultUnlocked: boolean;
  /** Display name (first + last); falls back to email-only chip when empty. */
  accountDisplayName?: string | null;
  accountEmail?: string | null;
  /** Phase 109: lock = full logout → Login (AC-109-24) */
  onLockVault: () => void;
}

/**
 * Global unlocked-app shell — account identity + vault lock on every primary screen.
 * «נעל» performs full logout (no separate logout control).
 */
export default function AppVaultShell({
  children,
  vaultUnlocked,
  accountDisplayName = null,
  accountEmail = null,
  onLockVault,
}: AppVaultShellProps) {
  const name = accountDisplayName?.trim() || null;
  const email = accountEmail?.trim() || null;
  const showIdentity = Boolean(name || email);

  return (
    <div className="app-vault-shell">
      <header className="app-vault-shell-bar" aria-label="מצב כספת">
        {showIdentity && (
          <div className="app-vault-account-chip" title={email ?? name ?? undefined}>
            {name ? (
              <>
                <span className="app-vault-account-name">{name}</span>
                {email && <span className="app-vault-account-email">{email}</span>}
              </>
            ) : (
              <span className="app-vault-account-name">{email}</span>
            )}
          </div>
        )}
        <VaultStateBadge unlocked={vaultUnlocked} onLock={onLockVault} />
      </header>
      {children}
    </div>
  );
}
