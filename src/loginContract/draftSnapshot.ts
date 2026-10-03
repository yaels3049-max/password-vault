/**
 * Phase 121.0 — immutable DRAFT snapshot (C8 representation only).
 * Creating a snapshot MUST NOT ACTIVATE, write active, or mutate discriminator.
 */

import { deepClonePlanDocument, parseLoginFlowPlanDocument } from './parse';
import type { ImmutableDraftSnapshot, LoginFlowPlanDocument } from './types';
import {
  LOGIN_CONTRACT_VALIDATE_ERROR,
  validateSpecialPlanComplete,
} from './validateSpecialPlan';

export type DraftSnapshotResult =
  | { ok: true; snapshot: ImmutableDraftSnapshot }
  | { ok: false; message: string; code: 'corruptPlan' };

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object') {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

function newSnapshotId(): string {
  return `draft-snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Pure builder: deep-copy + freeze draft. Does not write metadata / ACTIVATE.
 * Corrupt draft → ValidationError. Incomplete but parseable → snapshot with isComplete=false.
 */
export function createImmutableDraftSnapshot(
  draft: LoginFlowPlanDocument | null | undefined,
  options?: { snapshotId?: string; createdAt?: string; nowIso?: string },
): DraftSnapshotResult {
  if (!draft) {
    return {
      ok: false,
      code: 'corruptPlan',
      message: LOGIN_CONTRACT_VALIDATE_ERROR.corruptPlan,
    };
  }
  const parsed = parseLoginFlowPlanDocument(
    // Accept already-typed docs by round-tripping through serialize path via clone.
    deepClonePlanDocument(draft),
  );
  if (!parsed) {
    return {
      ok: false,
      code: 'corruptPlan',
      message: LOGIN_CONTRACT_VALIDATE_ERROR.corruptPlan,
    };
  }
  const completeness = validateSpecialPlanComplete(parsed);
  const plan = deepFreeze(deepClonePlanDocument(parsed));
  const snapshot: ImmutableDraftSnapshot = {
    snapshotId: options?.snapshotId ?? newSnapshotId(),
    createdAt: options?.createdAt ?? options?.nowIso ?? new Date().toISOString(),
    plan,
    isComplete: completeness.ok,
  };
  return { ok: true, snapshot: deepFreeze(snapshot) };
}
