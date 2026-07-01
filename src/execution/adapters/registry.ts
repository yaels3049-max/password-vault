import { htzoneAdapter } from './htzoneAdapter';
import { practiceAdapter } from './practiceAdapter';
import type { ServiceAdapter } from './types';

const ADAPTERS: Record<string, ServiceAdapter> = {
  htzone: htzoneAdapter,
  practice: practiceAdapter,
};

export function getServiceAdapter(adapterId: string): ServiceAdapter | null {
  return ADAPTERS[adapterId] ?? null;
}
