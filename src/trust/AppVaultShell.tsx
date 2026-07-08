import type { ReactNode } from 'react';
import VaultStateBadge from './VaultStateBadge';

interface AppVaultShellProps {
  children: ReactNode;
  vaultUnlocked: boolean;
  onLockVault: () => void;
}

/**
 * Global unlocked-app shell — vault state + lock control on every primary screen.
 * Single implementation for Digital Home and Service Management (Phase 106).
 */
export default function AppVaultShell({
  children,
  vaultUnlocked,
  onLockVault,
}: AppVaultShellProps) {
  return (
    <div className="app-vault-shell">
      <header className="app-vault-shell-bar" aria-label="מצב כספת">
        <VaultStateBadge unlocked={vaultUnlocked} onLock={onLockVault} />
      </header>
      {children}
    </div>
  );
}
