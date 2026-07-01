import type { Credential } from '../credentials';
import {
  getLoginFields,
  getServiceOpenUrl,
  hasLoginIntegrationMetadata,
  type LoginField,
  type Service,
} from '../mockServices';
import { hasCompleteCredentials } from '../credentials';
import { getServiceAdapter } from './adapters/registry';
import { openUrlInNewTab } from './extensionBridge';
import { executeGenericAutofill } from './genericAutofill';

const OPEN_ONLY_MESSAGE =
  'האתר נפתח. מילוי אוטומטי אינו זמין עבור אתר זה כרגע.';

const EXTENSION_UNAVAILABLE_MESSAGE =
  'דף ההתחברות נפתח. התקינו את תוסף הדפדפן כדי לאפשר מילוי אוטומטי.';

export type ServiceExecutionStatus =
  | 'ok'
  | 'credentials_missing'
  | 'open_only';

export interface ServiceExecutionResult {
  status: ServiceExecutionStatus;
  extensionUsed: boolean;
  autofillAttempted: boolean;
  userMessage?: string;
}

/**
 * Unified tile execution for every service type.
 * Caller resolves Access Profile and supplies profile-scoped credentials.
 *
 * Pipeline: open URL from metadata → generic autofill → adapter only when adapterId is set.
 */
export function executeServiceFromTile(
  service: Service,
  credential: Credential | undefined,
  loginFields: LoginField[] = getLoginFields(service),
): ServiceExecutionResult {
  const openUrl = getServiceOpenUrl(service);
  const adapterId = service.adapterId?.trim();

  if (adapterId) {
    const adapter = getServiceAdapter(adapterId);
    if (!adapter) {
      openUrlInNewTab(openUrl);
      return {
        status: 'ok',
        extensionUsed: false,
        autofillAttempted: false,
        userMessage: OPEN_ONLY_MESSAGE,
      };
    }

    const adapterResult = adapter.execute({
      service,
      openUrl,
      credential,
      loginFields,
    });

    if (!adapterResult.ok) {
      return {
        status: 'credentials_missing',
        extensionUsed: false,
        autofillAttempted: true,
      };
    }

    return {
      status: 'ok',
      extensionUsed: adapterResult.extensionUsed,
      autofillAttempted: adapterResult.autofillAttempted,
      userMessage:
        adapterResult.autofillAttempted && !adapterResult.extensionUsed
          ? EXTENSION_UNAVAILABLE_MESSAGE
          : undefined,
    };
  }

  if (!hasLoginIntegrationMetadata(service)) {
    openUrlInNewTab(openUrl);
    return {
      status: 'open_only',
      extensionUsed: false,
      autofillAttempted: false,
      userMessage: OPEN_ONLY_MESSAGE,
    };
  }

  if (!hasCompleteCredentials(credential, loginFields)) {
    return {
      status: 'credentials_missing',
      extensionUsed: false,
      autofillAttempted: true,
    };
  }

  const result = executeGenericAutofill(openUrl, credential, loginFields);
  if (!result.ok) {
    return {
      status: 'credentials_missing',
      extensionUsed: false,
      autofillAttempted: true,
    };
  }

  return {
    status: 'ok',
    extensionUsed: result.extensionUsed,
    autofillAttempted: true,
    userMessage: result.extensionUsed ? undefined : EXTENSION_UNAVAILABLE_MESSAGE,
  };
}
