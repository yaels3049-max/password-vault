/**
 * Phase 121.1 D-121-34 (§4.15) — which action auto-Analyze may propose after a
 * successful «בדוק…» test. Pure selection; never writes the draft, never approves.
 */

import { frameKey } from '../loginContract/frameDescriptor';
import {
  actionIdentity,
  listDraftActions,
  selectPendingForManualAnalyze,
} from '../loginContract/specialDraftAuthoring';
import type {
  FlowAction,
  FrameDescriptor,
  LoginFlowPlanDocument,
  SpecialLoginPattern,
} from '../loginContract/types';

/** Kinds the pattern still needs after the tested action (FLOATING_SCREEN: none after the opener). */
export function followUpKindsForPattern(pattern: SpecialLoginPattern): FlowAction['kind'][] {
  return pattern === 'MULTI_STEP' || pattern === 'FLOATING_SCREEN_MULTI_STEP'
    ? ['intermediate_transition']
    : [];
}

/**
 * Surface(s) the test revealed: where this Analyze found new credential fields
 * (top document = frameKey(null)). When every field was already mapped, the
 * surfaces of the step's existing mappings.
 */
export function revealedSurfaceKeys(input: {
  fieldProposals: ReadonlyArray<{ frame: FrameDescriptor | null; state: string }>;
  stepMappings: ReadonlyArray<{ locator?: string; frame?: FrameDescriptor | null }>;
}): Set<string> {
  const fresh = input.fieldProposals.filter((p) => p.state !== 'frame_not_addressable');
  if (fresh.length > 0) return new Set(fresh.map((p) => frameKey(p.frame)));
  return new Set(
    input.stepMappings.filter((m) => (m.locator ?? '').trim()).map((m) => frameKey(m.frame ?? null)),
  );
}

/**
 * after_continue: first candidate that is on a revealed surface, of a kind the
 * pattern needs, not the same kind on the same surface as the tested action, and
 * not already approved for continuation in the draft. Resolved against the draft
 * like a manual proposal (unapproved, collision-safe id).
 * D-121-63 D: `testedGone` (actions_only reveal — the tested button left the page) lifts the
 * same-kind-same-surface skip; the tested action itself is still never proposed.
 */
export function selectFollowUpAfterContinue(input: {
  draft: LoginFlowPlanDocument;
  pattern: SpecialLoginPattern;
  candidates: FlowAction[];
  tested: FlowAction;
  revealedSurfaceKeys: ReadonlySet<string>;
  testedGone?: boolean;
}): FlowAction | null {
  const kinds = followUpKindsForPattern(input.pattern);
  if (kinds.length === 0 || input.revealedSurfaceKeys.size === 0) return null;
  const testedSurface = frameKey(input.tested.frame ?? null);
  const approved = new Set(
    listDraftActions(input.draft)
      .filter((a) => a.approvedForAuthoringContinuation)
      .map(actionIdentity),
  );
  for (const candidate of input.candidates) {
    const surface = frameKey(candidate.frame ?? null);
    if (!kinds.includes(candidate.kind)) continue;
    if (!input.revealedSurfaceKeys.has(surface)) continue;
    if (!input.testedGone && candidate.kind === input.tested.kind && surface === testedSurface) continue;
    if (actionIdentity(candidate) === actionIdentity(input.tested)) continue;
    if (approved.has(actionIdentity(candidate))) continue;
    return selectPendingForManualAnalyze(input.draft, [candidate]);
  }
  return null;
}
