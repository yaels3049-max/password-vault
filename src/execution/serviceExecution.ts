import type { Credential } from '../credentials';
import { hasCompleteCredentials } from '../credentials';
import {
  getLoginFields,
  getServiceOpenUrl,
  hasConfiguredLoginFields,
  type LoginField,
  type Service,
} from '../mockServices';
import { getServiceAdapter, isSiteSpecificAdapter } from './adapters/registry';
import { shouldAttemptGenericAutofill } from './autofillEligibility';
import { executeGenericAutofill } from './genericAutofill';
import { openUrlInNewTab } from './extensionBridge';

const MISSING_CREDENTIALS_MESSAGE =
  'הגדירו פרטי כניסה במסך «ניהול השירותים» — לחצו «הוסף שירותים נוספים».';

export type ServiceExecutionStatus =
  | 'ok'
  | 'credentials_missing'
  | 'open_only';

export interface ServiceExecutionResult {
  status: ServiceExecutionStatus;
  extensionUsed: boolean;
  autofillAttempted: boolean;
  userMessage?: string;
  /** Internal signal for future metadata-health UX (D-103-12). Never blocks open. */
  metadataHealth?: 'fill_failed';
}

/**
 * Phase 103 unified tile execution (D-103-8):
 * 1. openUrl = loginUrl ?? primaryUrl
 * 2. Site-specific adapters (htzone, practice) only
 * 3. Default: open tab (extension or window.open), then generic autofill when eligible
 * 4. No service-id branching; origin-independent orchestration
 */
export function executeServiceFromTile(
  service: Service,
  credential: Credential | undefined,
  loginFields: LoginField[] = getLoginFields(service),
): ServiceExecutionResult {
  const openUrl = getServiceOpenUrl(service);
  const adapterId = service.adapterId?.trim();

  if (adapterId && isSiteSpecificAdapter(adapterId)) {
    const adapter = getServiceAdapter(adapterId);
    if (!adapter) {
      openUrlInNewTab(openUrl);
      return {
        status: 'open_only',
        extensionUsed: false,
        autofillAttempted: false,
      };
    }

    const adapterResult = adapter.execute({
      service,
      openUrl,
      credential,
      loginFields,
    });

    if (!adapterResult.ok) {
      openUrlInNewTab(openUrl);
      return {
        status: 'credentials_missing',
        extensionUsed: false,
        autofillAttempted: false,
        userMessage: MISSING_CREDENTIALS_MESSAGE,
      };
    }

    return {
      status: 'ok',
      extensionUsed: adapterResult.extensionUsed,
      autofillAttempted: adapterResult.autofillAttempted,
    };
  }

  if (shouldAttemptGenericAutofill(service, credential, loginFields)) {
    const fillResult = executeGenericAutofill(openUrl, credential, loginFields);
    return {
      status: 'ok',
      extensionUsed: fillResult.ok && fillResult.extensionUsed,
      autofillAttempted: true,
      ...(fillResult.ok && !fillResult.extensionUsed
        ? { metadataHealth: 'fill_failed' as const }
        : {}),
    };
  }

  openUrlInNewTab(openUrl);

  if (
    hasConfiguredLoginFields(service) &&
    !hasCompleteCredentials(credential, loginFields)
  ) {
    return {
      status: 'credentials_missing',
      extensionUsed: false,
      autofillAttempted: false,
      userMessage: MISSING_CREDENTIALS_MESSAGE,
    };
  }

  return {
    status: 'open_only',
    extensionUsed: false,
    autofillAttempted: false,
  };
}
