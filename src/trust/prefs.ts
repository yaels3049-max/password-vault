/**
 * UI-only prefs for Phase 106 security tip (no secrets).
 */

const FIRST_TIME_SECURITY_TIP_KEY = 'dh.trust.firstTimeSecurityTipDismissed';

export function isFirstTimeSecurityTipDismissed(): boolean {
  try {
    return localStorage.getItem(FIRST_TIME_SECURITY_TIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissFirstTimeSecurityTip(): void {
  try {
    localStorage.setItem(FIRST_TIME_SECURITY_TIP_KEY, '1');
  } catch {
    // Ignore quota / private-mode failures — tip may reappear; no secrets stored.
  }
}
