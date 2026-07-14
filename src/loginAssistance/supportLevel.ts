/**
 * Phase 113 — support levels (AC-113-16 / D-113-6).
 * UX signals only — independent of Phase 112 Login Intelligence.
 */

import type { Service } from '../service/legacyService';
import { resolveLoginAssistanceOpenUrl } from './openUrlRules';
import {
  LABEL_SUPPORT_AUTOMATIC,
  LABEL_SUPPORT_BEST_EFFORT,
  LABEL_SUPPORT_MANUAL,
} from './messages';

export type LoginAssistanceLevel =
  | 'automatic_supported'
  | 'best_effort'
  | 'manual_only';

export const LOGIN_ASSISTANCE_LEVEL_META_KEY = 'loginAssistanceLevel';

export function resolveLoginAssistanceLevel(service: Service): LoginAssistanceLevel {
  const raw = service.metadata?.[LOGIN_ASSISTANCE_LEVEL_META_KEY];
  if (
    raw === 'automatic_supported' ||
    raw === 'best_effort' ||
    raw === 'manual_only'
  ) {
    return raw;
  }

  // Site-specific adapters already present at runtime (103) — not Phase 112 LI.
  if (service.adapterId === 'htzone' || service.adapterId === 'practice') {
    return 'automatic_supported';
  }

  const open = resolveLoginAssistanceOpenUrl(service);
  if (open.kind === 'unavailable') {
    return 'manual_only';
  }

  // Home-only (no loginUrl): open + copy, never auto (AC-113-17 examples).
  const loginUrl = typeof service.loginUrl === 'string' ? service.loginUrl.trim() : '';
  if (!loginUrl) {
    return 'manual_only';
  }

  return 'best_effort';
}

export function allowsAutomaticCompletionAttempt(
  level: LoginAssistanceLevel,
): boolean {
  return level === 'automatic_supported' || level === 'best_effort';
}

export function supportLevelLabel(level: LoginAssistanceLevel): string {
  switch (level) {
    case 'automatic_supported':
      return LABEL_SUPPORT_AUTOMATIC;
    case 'best_effort':
      return LABEL_SUPPORT_BEST_EFFORT;
    case 'manual_only':
      return LABEL_SUPPORT_MANUAL;
  }
}
