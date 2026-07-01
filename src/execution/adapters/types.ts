import type { Credential } from '../../credentials';
import type { LoginField, Service } from '../../mockServices';

export type AdapterExecutionResult =
  | { ok: true; extensionUsed: boolean; autofillAttempted: boolean }
  | { ok: false; reason: 'credentials_missing' };

export interface ServiceAdapter {
  execute(input: {
    service: Service;
    openUrl: string;
    credential: Credential | undefined;
    loginFields: LoginField[];
  }): AdapterExecutionResult;
}
