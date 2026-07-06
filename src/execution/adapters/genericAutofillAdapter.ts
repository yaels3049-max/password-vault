import { executeGenericAutofill } from '../genericAutofill';
import type { ServiceAdapter } from './types';

/**
 * Phase 2 validated generic autofill (Shufersal, Clalit).
 * Routed via registry `adapterId: 'generic'` — not service-id branching in tile execution.
 */
export const genericAutofillAdapter: ServiceAdapter = {
  execute({ openUrl, credential, loginFields }) {
    const result = executeGenericAutofill(openUrl, credential, loginFields);

    if (!result.ok) {
      return { ok: false, reason: 'credentials_missing' };
    }

    return {
      ok: true,
      extensionUsed: result.extensionUsed,
      autofillAttempted: true,
    };
  },
};
