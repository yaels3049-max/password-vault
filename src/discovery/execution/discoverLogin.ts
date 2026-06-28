import type { DiscoveryExecutionOutcome, DiscoveryExecutor } from './discoveryExecution';
import { extensionTabDiscoveryExecutor } from './extensionTabDiscoveryExecutor';

let activeExecutor: DiscoveryExecutor = extensionTabDiscoveryExecutor;

/** Current production executor. Swappable for tests or future browser capabilities. */
export function getDiscoveryExecutor(): DiscoveryExecutor {
  return activeExecutor;
}

/** Override the active executor (tests, future rollout). Not used in normal product flow. */
export function setDiscoveryExecutor(executor: DiscoveryExecutor): void {
  activeExecutor = executor;
}

/** Reset to the default production executor. */
export function resetDiscoveryExecutor(): void {
  activeExecutor = extensionTabDiscoveryExecutor;
}

/**
 * Request login entry discovery for a primary URL.
 *
 * The Hub calls this without knowing how discovery is executed. The active
 * {@link DiscoveryExecutor} performs DOM access and runs the discovery engine.
 */
export function discoverLogin(primaryUrl: string): Promise<DiscoveryExecutionOutcome> {
  return activeExecutor.discoverLogin(primaryUrl.trim());
}

export { extensionTabDiscoveryExecutor } from './extensionTabDiscoveryExecutor';
export type { DiscoveryExecutionOutcome, DiscoveryExecutor } from './discoveryExecution';
