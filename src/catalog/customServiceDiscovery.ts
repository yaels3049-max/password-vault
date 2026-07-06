import { discoverAndPersistLoginUrl } from '../registry/loginUrlDiscovery';
import type { DiscoveryResult } from '../discovery';
import {
  validateServiceDefinition,
  type ServiceDefinition,
} from '../service/serviceModel';

export type CustomServiceDiscoveryOutcome =
  | { status: 'success'; message: string }
  | { status: 'failure'; message: string };

export interface CustomServiceDiscoveryResult {
  definition: ServiceDefinition;
  discovery: DiscoveryResult | null;
  outcome: CustomServiceDiscoveryOutcome;
}

const DISCOVERY_SUCCESS_MESSAGE = 'השירות נוסף בהצלחה';
const DISCOVERY_FAILURE_MESSAGE =
  'השירות נוסף. ייתכן שנצטרך לפתוח אותו דרך דף הבית.';
const EXTENSION_UNAVAILABLE_MESSAGE = DISCOVERY_FAILURE_MESSAGE;

function logCustomDiscovery(message: string, detail?: unknown): void {
  if (!import.meta.env.DEV) {
    return;
  }

  if (detail === undefined) {
    console.log(`[Custom Discovery] ${message}`);
    return;
  }

  console.log(`[Custom Discovery] ${message}`, detail);
}

/** Whether a discovered login URL is stable enough to persist (Iteration 3.3b). */
export function shouldPersistDiscoveredLoginUrl(result: DiscoveryResult): boolean {
  if (!result.success || !result.loginUrl) {
    return false;
  }

  if (result.method === 'common-path') {
    return false;
  }

  if (result.confidence === 'low') {
    return false;
  }

  return true;
}

export function applyDiscoveredLoginUrl(
  definition: ServiceDefinition,
  loginUrl: string,
): ServiceDefinition {
  const candidate: ServiceDefinition = {
    ...definition,
    loginUrl,
  };

  const validated = validateServiceDefinition(candidate);
  if (!validated.valid) {
    const details = validated.issues
      .map((issue) => `${issue.field}: ${issue.message}`)
      .join('; ');
    throw new Error(`Discovered loginUrl is invalid for "${definition.id}": ${details}`);
  }

  return validated.definition;
}

function failureResult(
  definition: ServiceDefinition,
  discovery: DiscoveryResult | null,
  message: string,
): CustomServiceDiscoveryResult {
  logCustomDiscovery('persisted loginUrl', null);

  return {
    definition,
    discovery,
    outcome: {
      status: 'failure',
      message,
    },
  };
}

/**
 * Run login entry discovery for a newly created custom service.
 * Persists discovered URL to user registry row when Supabase is configured (Phase 102).
 */
export async function discoverLoginForCustomService(
  definition: ServiceDefinition,
  options?: { primaryUrl?: string },
): Promise<CustomServiceDiscoveryResult> {
  const primaryUrl = (options?.primaryUrl ?? definition.url).trim();

  logCustomDiscovery('discovery started');

  const persistResult = await discoverAndPersistLoginUrl(definition, { primaryUrl });

  if (persistResult.skipped) {
    logCustomDiscovery('discovery skipped — login URL already valid in registry');
    return {
      definition: persistResult.definition,
      discovery: null,
      outcome: {
        status: 'success',
        message: DISCOVERY_SUCCESS_MESSAGE,
      },
    };
  }

  const discovery = persistResult.discovery;
  logCustomDiscovery('discovery result', discovery);

  if (!discovery) {
    logCustomDiscovery('fallback to primary URL');
    return failureResult(definition, null, EXTENSION_UNAVAILABLE_MESSAGE);
  }

  if (!shouldPersistDiscoveredLoginUrl(discovery)) {
    return failureResult(definition, discovery, DISCOVERY_FAILURE_MESSAGE);
  }

  const enriched = applyDiscoveredLoginUrl(persistResult.definition, discovery.loginUrl!);
  logCustomDiscovery('persisted loginUrl', enriched.loginUrl ?? null);

  return {
    definition: enriched,
    discovery,
    outcome: {
      status: 'success',
      message: DISCOVERY_SUCCESS_MESSAGE,
    },
  };
}
