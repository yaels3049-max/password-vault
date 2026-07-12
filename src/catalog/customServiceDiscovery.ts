import { discoverAndPersistLoginUrl } from '../registry/loginUrlDiscovery';
import type { DiscoveryResult } from '../discovery';
import {
  classifyDiscoveryReviewStatus,
  shouldPersistDiscoveredLoginUrl,
} from '../discovery/loginDiscoveryPolicy';
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
const EXTENSION_UNAVAILABLE_MESSAGE =
  'השירות נוסף, אך הרחבת הדפדפן לא זמינה לגילוי דף כניסה. טענו מחדש את התוסף (manifest 1.4.1+) ונסו שוב.';

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

export { classifyDiscoveryReviewStatus, shouldPersistDiscoveredLoginUrl };

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

export type RegistryLoginDiscoveryResult = CustomServiceDiscoveryResult;

/**
 * Run login entry discovery for any service_registry row (user or global).
 * Shared pipeline for custom service add and admin global catalog create.
 */
export async function discoverLoginForRegistryService(
  definition: ServiceDefinition,
  options?: {
    primaryUrl?: string;
    force?: boolean;
    source?: 'auto' | 'admin' | 'user';
    forceAdminOverwrite?: boolean;
  },
): Promise<RegistryLoginDiscoveryResult> {
  const primaryUrl = (options?.primaryUrl ?? definition.url).trim();
  const source = options?.source ?? (definition.source === 'user-created' ? 'user' : 'auto');

  logCustomDiscovery('discovery started');

  const persistResult = await discoverAndPersistLoginUrl(definition, {
    primaryUrl,
    force: options?.force,
    forceAdminOverwrite: options?.forceAdminOverwrite,
    source,
  });

  if (persistResult.skipped) {
    if (persistResult.skipReason === 'admin_override') {
      return failureResult(
        persistResult.definition,
        null,
        'כתובת כניסה מוגנת — עריכת מנהל. השתמשו בכוח מפורש לדריסה.',
      );
    }

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
      message: persistResult.persisted
        ? DISCOVERY_SUCCESS_MESSAGE
        : 'גילוי הצליח אך לא נשמר בקטלוג. ניתן לערוך ידנית או לנסות שוב.',
    },
  };
}

/** @deprecated Use discoverLoginForRegistryService — kept for ManageServices import stability. */
export const discoverLoginForCustomService = discoverLoginForRegistryService;
