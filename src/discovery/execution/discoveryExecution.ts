import type { DiscoveryResult } from '../discoveryResult';

/**
 * Outcome of a login discovery execution request.
 * The discovery engine produces {@link DiscoveryResult}; executors deliver it (or a failure).
 */
export type DiscoveryExecutionOutcome =
  | { status: 'success'; result: DiscoveryResult }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; reason: string };

/**
 * Executes login entry discovery for a primary URL without exposing how DOM access is obtained.
 *
 * Implementations may use extension tabs, background browsers, offscreen documents, or other
 * browser capabilities. The Hub and discovery engine depend only on this contract.
 */
export interface DiscoveryExecutor {
  /** Stable identifier for diagnostics and future executor selection. */
  readonly id: string;

  discoverLogin(primaryUrl: string): Promise<DiscoveryExecutionOutcome>;
}
