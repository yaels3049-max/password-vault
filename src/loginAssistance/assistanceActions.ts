/**
 * Phase 113 — soft-wrap open + optional existing automatic completion
 * (AC-113-1…5, AC-113-13…15 / D-113-4). Does not modify executeServiceFromTile.
 */

import type { Credential } from '../credentials';
import { executeServiceFromTile } from '../execution/serviceExecution';
import {
  MSG_MANAGED_FILL_OK,
  serviceClaimsValidatedManagedProfile,
} from '../execution/managedAutofill';
import { openUrlInNewTab } from '../browserIntegration';
import { getLoginFields, type Service } from '../mockServices';
import {
  resolveLoginAssistanceOpenUrl,
  type OpenUrlResolution,
} from './openUrlRules';
import {
  allowsAutomaticCompletionAttempt,
  resolveLoginAssistanceLevel,
} from './supportLevel';
import { MSG_AUTO_ATTEMPTED, MSG_MANUAL_ONLY, MSG_OPENED, MSG_OPENED_HOME_FALLBACK, MSG_SELECT_PROFILE } from './messages';

export type OpenAssistanceUrlResult =
  | { status: 'opened'; url: string; source: 'loginUrl' | 'homeUrl'; message: string }
  | { status: 'unavailable'; message: string };

export function openAssistanceUrl(service: Service): OpenAssistanceUrlResult {
  const resolution = resolveLoginAssistanceOpenUrl(service);
  if (resolution.kind === 'unavailable') {
    return { status: 'unavailable', message: resolution.message };
  }
  openUrlInNewTab(resolution.url);
  return {
    status: 'opened',
    url: resolution.url,
    source: resolution.source,
    message:
      resolution.source === 'homeUrl' ? MSG_OPENED_HOME_FALLBACK : MSG_OPENED,
  };
}

export type AutomaticCompletionAssistResult =
  | { attempted: false; reason: 'manual_only' | 'no_profile'; message: string; outcome: 'blocked' }
  | {
      attempted: true;
      message: string;
      /** Reflects structured Managed / tile execution — never "clicked". */
      outcome: 'success' | 'failure' | 'opened';
    };

/**
 * Best Effort / Managed call into the **existing** tile execution path.
 * Always returns exactly one user-facing status when attempted (AC-113-15).
 * Never invents a success message when execution did not report one.
 */
export async function attemptExistingAutomaticCompletion(
  service: Service,
  profileId: string | null,
  credentialsByProfileId: Record<string, Credential>,
): Promise<AutomaticCompletionAssistResult> {
  const level = resolveLoginAssistanceLevel(service);
  if (!allowsAutomaticCompletionAttempt(level)) {
    return {
      attempted: false,
      reason: 'manual_only',
      message: MSG_MANUAL_ONLY,
      outcome: 'blocked',
    };
  }
  if (!profileId) {
    return {
      attempted: false,
      reason: 'no_profile',
      message: MSG_SELECT_PROFILE,
      outcome: 'blocked',
    };
  }

  const loginFields = getLoginFields(service);
  const credential = credentialsByProfileId[profileId];
  const result = await executeServiceFromTile(service, credential, loginFields, {
    activeProfileId: profileId,
  });

  const structured = result.userMessage?.trim();
  const managedClaim = serviceClaimsValidatedManagedProfile(service);

  // Validated Managed path: only surface structured execution messages — never MSG_AUTO_ATTEMPTED.
  if (managedClaim) {
    if (structured) {
      const success = result.status === 'ok' && structured === MSG_MANAGED_FILL_OK;
      return {
        attempted: true,
        message: structured,
        outcome: success ? 'success' : 'failure',
      };
    }
    return {
      attempted: true,
      message: 'המילוי האוטומטי המנוהל לא הושלם. נסו שוב או מלאו ידנית.',
      outcome: 'failure',
    };
  }

  if (structured) {
    const success =
      result.status === 'ok' &&
      (structured === MSG_MANAGED_FILL_OK || structured === MSG_OPENED);
    return {
      attempted: true,
      message: structured,
      outcome: success ? 'success' : result.status === 'ok' ? 'opened' : 'failure',
    };
  }

  // Legacy/generic path may omit userMessage on dispatch; keep Phase 113 soft copy
  // only when Managed did not already supply a structured outcome.
  if (result.autofillAttempted && result.status === 'ok' && result.extensionUsed) {
    return { attempted: true, message: MSG_AUTO_ATTEMPTED, outcome: 'opened' };
  }

  return {
    attempted: true,
    message: result.status === 'ok' ? MSG_OPENED : MSG_AUTO_ATTEMPTED,
    outcome: result.status === 'ok' ? 'opened' : 'failure',
  };
}

export function describeOpenResolution(resolution: OpenUrlResolution): string {
  if (resolution.kind === 'unavailable') {
    return resolution.message;
  }
  return resolution.source === 'loginUrl'
    ? `נפתח דף התחברות: ${resolution.url}`
    : `נפתח דף הבית: ${resolution.url}`;
}
