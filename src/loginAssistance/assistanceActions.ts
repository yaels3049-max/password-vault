/**
 * Phase 113 — soft-wrap open + optional existing automatic completion
 * (AC-113-1…5, AC-113-13…15 / D-113-4). Does not modify executeServiceFromTile.
 */

import type { Credential } from '../credentials';
import { executeServiceFromTile } from '../execution/serviceExecution';
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
  | { attempted: false; reason: 'manual_only' | 'no_profile'; message: string }
  | { attempted: true; message: string };

/**
 * Best Effort call into the **existing** tile execution path.
 * Outcome success/failure is never an acceptance gate (AC-113-13 / D-113-5).
 * Always returns exactly one user-facing status when attempted (AC-113-15).
 */
export async function attemptExistingAutomaticCompletion(
  service: Service,
  profileId: string | null,
  credentialsByProfileId: Record<string, Credential>,
): Promise<AutomaticCompletionAssistResult> {
  const level = resolveLoginAssistanceLevel(service);
  if (!allowsAutomaticCompletionAttempt(level)) {
    return { attempted: false, reason: 'manual_only', message: MSG_MANUAL_ONLY };
  }
  if (!profileId) {
    return {
      attempted: false,
      reason: 'no_profile',
      message: MSG_SELECT_PROFILE,
    };
  }

  const loginFields = getLoginFields(service);
  const credential = credentialsByProfileId[profileId];
  const result = await executeServiceFromTile(service, credential, loginFields, {
    activeProfileId: profileId,
  });

  return {
    attempted: true,
    message: result.userMessage?.trim() || MSG_AUTO_ATTEMPTED,
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
