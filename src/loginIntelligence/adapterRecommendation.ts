import type { AdapterLifecycle, LoginIntelligence } from './types';
import { ADAPTER_LIFECYCLES } from './types';

const ORDER: Record<AdapterLifecycle, number> = {
  recommended: 0,
  approved: 1,
  implemented: 2,
  validated: 3,
  deprecated: 4,
};

export function canTransitionAdapterLifecycle(
  from: AdapterLifecycle | null,
  to: AdapterLifecycle,
): boolean {
  if (!from) {
    return to === 'recommended';
  }
  if (from === to) return true;
  if (to === 'deprecated') return true;
  return ORDER[to] >= ORDER[from];
}

/** Set recommendation when policy triggers (AC-112-9, AC-112-21). No new bank adapters. */
export function recommendAdapter(
  li: LoginIntelligence,
  reason: string,
): LoginIntelligence {
  const lifecycle: AdapterLifecycle =
    li.adapterLifecycle && ADAPTER_LIFECYCLES.includes(li.adapterLifecycle)
      ? li.adapterLifecycle
      : 'recommended';

  return {
    ...li,
    adapterRecommended: true,
    adapterReason: reason,
    adapterLifecycle: lifecycle === 'deprecated' ? 'recommended' : lifecycle,
    integrationHealth:
      li.integrationHealth === 'healthy' ? 'adapter_required' : li.integrationHealth === 'degraded'
        ? 'adapter_required'
        : li.integrationHealth === 'needs_review'
          ? 'adapter_required'
          : li.integrationHealth,
    loginComplexity: li.loginComplexity === 'basic' ? 'complex' : li.loginComplexity,
  };
}

export function advanceAdapterLifecycle(
  li: LoginIntelligence,
  next: AdapterLifecycle,
): LoginIntelligence {
  if (!canTransitionAdapterLifecycle(li.adapterLifecycle, next)) {
    return li;
  }
  return {
    ...li,
    adapterRecommended: next !== 'deprecated' ? true : li.adapterRecommended,
    adapterLifecycle: next,
  };
}
