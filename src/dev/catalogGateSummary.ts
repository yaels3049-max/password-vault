import { catalogGateState, isListedInUserCatalog } from '../catalog/catalogVisibility';
import type { ServiceDefinition } from '../service/serviceModel';
import { isDevBuild } from './devMode';

/**
 * AD-123-19 evidence — which global catalog sites the gate hides, from the loaded registry.
 * Dev builds only; site names and states only.
 */
export function logCatalogGateSummary(definitions: ServiceDefinition[]): void {
  if (!isDevBuild() || definitions.length === 0) return;
  const global = definitions.filter((definition) => catalogGateState(definition) !== 'own_site');
  const hidden = global.filter((definition) => !isListedInUserCatalog(definition));
  const hiddenByState: Record<string, number> = {};
  for (const definition of hidden) {
    const state = catalogGateState(definition);
    hiddenByState[state] = (hiddenByState[state] ?? 0) + 1;
  }
  console.info('[catalog-gate]', {
    globalBefore: global.length,
    listedAfter: global.length - hidden.length,
    hiddenByState,
    hidden: hidden.map((definition) => `${definition.displayName} (${catalogGateState(definition)})`),
  });
}
