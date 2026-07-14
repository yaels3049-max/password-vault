import type { ReactNode } from 'react';

interface AppVaultShellProps {
  children: ReactNode;
}

/**
 * Primary unlocked-app wrapper for Digital Home / Manage Sites.
 * Lock chrome lives inside each content shell (D-113-23 / AC-113-35);
 * identity chip is not shown on these screens.
 */
export default function AppVaultShell({ children }: AppVaultShellProps) {
  return <div className="app-vault-shell">{children}</div>;
}
