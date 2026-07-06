import type { Credential } from '../credentials';
import { hasCompleteCredentials } from '../credentials';
import {
  getLoginFields,
  getServiceOpenUrl,
  type LoginField,
  type Service,
} from '../mockServices';
import { getServiceAdapter } from './adapters/registry';
import { openUrlInNewTab } from './extensionBridge';

const MISSING_CREDENTIALS_MESSAGE =
  'הגדירו פרטי כניסה במסך «ניהול השירותים» — לחצו «הוסף שירותים נוספים».';

const OPEN_ONLY_MESSAGE =
  'האתר נפתח. מילוי אוטומטי אינו זמין עבור אתר זה כרגע.';

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
 * Phase 102 tile execution:
 * - Services with `adapterId` (generic, htzone, practice) use the adapter registry.
 * - All other services open `loginUrl ?? primaryUrl` only (banks, custom, catalog) until Phase 103.
 * - Tabs are not closed automatically on tile click.
 *
 * Phase 103 unifies open + optional autofill without the extension POC host allowlist.
 */
export function executeServiceFromTile(
  service: Service,
  credential: Credential | undefined,
  loginFields: LoginField[] = getLoginFields(service),
): ServiceExecutionResult {
  const openUrl = getServiceOpenUrl(service);
  const adapterId = service.adapterId?.trim();
  const credentialsComplete = hasCompleteCredentials(credential, loginFields);

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

  openUrlInNewTab(openUrl);

  if (!credentialsComplete) {
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
