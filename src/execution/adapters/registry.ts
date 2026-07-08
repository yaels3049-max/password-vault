import { htzoneAdapter } from './htzoneAdapter';
import { practiceAdapter } from './practiceAdapter';
import type { ServiceAdapter } from './types';

const SITE_SPECIFIC_ADAPTER_IDS = new Set(['htzone', 'practice']);

const ADAPTERS: Record<string, ServiceAdapter> = {
  htzone: htzoneAdapter,
  practice: practiceAdapter,
};

export function isSiteSpecificAdapter(adapterId: string): boolean {
  return SITE_SPECIFIC_ADAPTER_IDS.has(adapterId);
}

export function getServiceAdapter(adapterId: string): ServiceAdapter | null {
  return ADAPTERS[adapterId] ?? null;
}
