/**
 * Canonical Login Entry Discovery result (Phase 3 — Iteration 3.2).
 * Generic model — not tied to ServiceDefinition persistence.
 */

/** How the login entry was identified. */
export type DiscoveryMethod =
  | 'dedicated-login-page'
  | 'redirect'
  | 'visible-link'
  | 'visible-button'
  | 'modal-trigger'
  | 'common-path';

export type DiscoveryConfidence = 'high' | 'medium' | 'low';

/** A ranked candidate discovered during inspection (diagnostics / future UI). */
export interface DiscoveryCandidate {
  url: string;
  method: DiscoveryMethod;
  confidence: DiscoveryConfidence;
  label?: string;
  score: number;
}

/** Visible modal/popup trigger when no navigable login URL is available. */
export interface ModalLoginTrigger {
  label: string;
  tagName: string;
  role?: string;
  href?: string;
}

export interface DiscoveryResult {
  /** Whether a navigable login URL was identified. */
  success: boolean;

  /** Primary URL the discovery started from. */
  primaryUrl: string;

  /** Resolved login URL when success is true. */
  loginUrl?: string;

  /** Method that produced the winning result. */
  method?: DiscoveryMethod;

  /** Confidence in the discovered login URL. */
  confidence?: DiscoveryConfidence;

  /** Human-readable explanation when discovery fails or is incomplete. */
  reason?: string;

  /** Redirect URLs followed from primaryUrl, in order (excluding primary). */
  redirectChain?: string[];

  /** Final URL after redirect following when attempted. */
  finalUrlAfterRedirects?: string;

  /** Modal trigger metadata when a popup login entry is visible but has no href. */
  modalTrigger?: ModalLoginTrigger;

  /** Ranked candidates considered during discovery (optional diagnostics). */
  candidates?: DiscoveryCandidate[];
}

export function discoveryFailure(
  primaryUrl: string,
  reason: string,
  partial?: Pick<
    DiscoveryResult,
    'redirectChain' | 'finalUrlAfterRedirects' | 'modalTrigger' | 'candidates'
  >,
): DiscoveryResult {
  return {
    success: false,
    primaryUrl,
    reason,
    ...partial,
  };
}

export function discoverySuccess(
  primaryUrl: string,
  loginUrl: string,
  method: DiscoveryMethod,
  confidence: DiscoveryConfidence,
  partial?: Pick<
    DiscoveryResult,
    'redirectChain' | 'finalUrlAfterRedirects' | 'modalTrigger' | 'candidates'
  >,
): DiscoveryResult {
  return {
    success: true,
    primaryUrl,
    loginUrl,
    method,
    confidence,
    ...partial,
  };
}
