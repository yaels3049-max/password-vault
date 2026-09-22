import { practiceAdapter } from './practiceAdapter';
import type { ServiceAdapter } from './types';

/** Site-specific adapters registered for Digital Home adapter-first routing. Practice only after 120.3.6. */
const SITE_SPECIFIC_ADAPTER_IDS = new Set(['practice']);

const ADAPTERS: Record<string, ServiceAdapter> = {
  practice: practiceAdapter,
};

export function isSiteSpecificAdapter(adapterId: string): boolean {
  return SITE_SPECIFIC_ADAPTER_IDS.has(adapterId);
}

export function getServiceAdapter(adapterId: string): ServiceAdapter | null {
  return ADAPTERS[adapterId] ?? null;
}
