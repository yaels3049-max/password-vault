/**
 * Phase 121.1 — SPECIAL Analyze **routing** for opener/transition candidates.
 *
 * Distinct from Phase 120 credential-field Analyze (`proposeFieldMappings`).
 * Do NOT claim Phase 120 field-Analyze understands openers/transitions.
 * Proposals are unapproved — Admin must set approvedForAuthoringContinuation
 * before any authoring click. Never auto-invokes Visual Mapping.
 */

import {
  actionKindRelevantForPattern,
  createActionCandidate,
} from '../loginContract/specialDraftAuthoring';
import { actionIntent, type ActionIntent } from './specialActionIntent';
import { frameKey } from '../loginContract/frameDescriptor';
import type { FlowAction, FrameDescriptor, SpecialLoginPattern } from '../loginContract/types';

export interface SpecialActionCandidateObservation {
  actionCandidateId: string;
  tagName: string;
  label: string;
  locator: string;
  locatorType: 'css';
  matchCount?: number;
  visible?: boolean;
  /** 121.1-IF — surface the candidate was observed in (absent/null = top document). */
  frame?: FrameDescriptor | null;
  /** 121.1-IF — observed in a depth-1 iframe with no deterministic frame locator. */
  frameNotAddressable?: boolean;
  /** D-121-35 — has aria-haspopup / aria-controls / aria-expanded / data-(bs-)toggle / data-(bs-)target. */
  popupSemantics?: boolean;
  /** D-121-47 (G5) — truncated accessible texts, sent separately (never input values). */
  visibleText?: string;
  ariaLabel?: string;
  title?: string;
}

export type SpecialActionProposalKind = FlowAction['kind'];

export interface SpecialActionProposal {
  kind: SpecialActionProposalKind;
  confidence: 'high' | 'medium' | 'low';
  evidenceNote: string;
  action: FlowAction;
  /** Raw observation id from page collect (if any). */
  actionCandidateId?: string;
  /** 121.1-IF — shown with a message, never approvable. */
  frameNotAddressable?: boolean;
}

/**
 * D-121-47 rank tiers (lower = first). Opener: login word + popup → login word → popup →
 * plain → negative (R-f). A login word is never demoted by a negative word (R-a).
 */
type RankTier = 0 | 1 | 2 | 3 | 4;

interface ScoredKind {
  kind: SpecialActionProposalKind;
  tier: RankTier;
  note: string;
}

function observationTexts(obs: SpecialActionCandidateObservation): string[] {
  return [obs.visibleText, obs.ariaLabel, obs.title, obs.label].filter(
    (t): t is string => typeof t === 'string' && t.trim() !== '',
  );
}

function openerTier(intent: ActionIntent, popup: boolean): { tier: RankTier; note: string } {
  if (intent.login) {
    return popup
      ? { tier: 0, note: 'special_routing_opener_login_popup' }
      : { tier: 1, note: 'special_routing_opener_login' };
  }
  if (intent.negative) return { tier: 4, note: 'special_routing_negative_intent' };
  if (popup) return { tier: 2, note: 'special_routing_opener_popup' };
  return { tier: 3, note: 'special_routing_floating_default_opener' };
}

function transitionTier(intent: ActionIntent): { tier: RankTier; note: string } {
  if (intent.negative && !intent.login) return { tier: 4, note: 'special_routing_negative_intent' };
  if (intent.transition) return { tier: 1, note: 'special_routing_transition_label' };
  if (intent.login) return { tier: 2, note: 'special_routing_transition_login_label' };
  return { tier: 3, note: 'special_routing_multistep_default_transition' };
}

/** G6: only kinds the pattern uses (actionKindRelevantForPattern) are ever proposed. */
function scoreKind(
  obs: SpecialActionCandidateObservation,
  pattern: SpecialLoginPattern,
): ScoredKind {
  const intent = actionIntent(observationTexts(obs));
  const popup = obs.popupSemantics === true;
  const openerOk = actionKindRelevantForPattern('floating_opener', pattern);
  const transitionOk = actionKindRelevantForPattern('intermediate_transition', pattern);
  const asTransition =
    transitionOk && (!openerOk || (intent.transition && !intent.login));
  if (asTransition) {
    return { kind: 'intermediate_transition', ...transitionTier(intent) };
  }
  return { kind: 'floating_opener', ...openerTier(intent, popup) };
}

const TIER_CONFIDENCE: Record<RankTier, 'high' | 'medium' | 'low'> = {
  0: 'high',
  1: 'high',
  2: 'medium',
  3: 'low',
  4: 'low',
};

/**
 * Propose opener/transition FlowAction candidates from current-surface observations.
 * All actions leave approvedForAuthoringContinuation / approvedForRuntime = false.
 */
export function proposeSpecialActionCandidates(input: {
  pattern: SpecialLoginPattern;
  actionCandidates: SpecialActionCandidateObservation[];
  maxProposals?: number;
}): SpecialActionProposal[] {
  const max = typeof input.maxProposals === 'number' && input.maxProposals > 0
    ? input.maxProposals
    : 5;
  const ranked: Array<SpecialActionProposal & { tier: RankTier; popup: boolean }> = [];
  // Dedupe key = locator + frameKey (frame is identity, never a ranking signal).
  const seen = new Set<string>();

  for (const obs of input.actionCandidates) {
    if (!obs.locator || obs.locatorType !== 'css') continue;
    if (obs.matchCount !== undefined && obs.matchCount !== 1) continue;
    const key = `${obs.locator.trim()}@@${
      obs.frameNotAddressable ? 'unaddressable' : frameKey(obs.frame)
    }`;
    if (seen.has(key)) continue;
    seen.add(key);
    const scored = scoreKind(obs, input.pattern);
    // Only allowed kinds are ever produced; reserved kinds (final_submit) are never proposed.
    const action = createActionCandidate({
      actionId: obs.actionCandidateId || `route-${scored.kind}-${ranked.length + 1}`,
      kind: scored.kind,
      // G5: the Admin sees the visible text when present.
      label: (obs.visibleText?.trim() || obs.label || obs.locator).trim(),
      locator: obs.locator.trim(),
      frame: obs.frame ?? null,
    });
    // Explicit: unapproved — progressive gate still required before click.
    // Readiness = pending reveal marker (R3), never opener-self.
    action.approvedForAuthoringContinuation = false;
    action.approvedForRuntime = false;
    ranked.push({
      kind: scored.kind,
      confidence: TIER_CONFIDENCE[scored.tier],
      evidenceNote: scored.note,
      action,
      actionCandidateId: obs.actionCandidateId,
      ...(obs.frameNotAddressable ? { frameNotAddressable: true } : {}),
      tier: scored.tier,
      popup: obs.popupSemantics === true,
    });
  }

  // Tier first; D-121-35 §3 popup tie-breaker within a tier; otherwise stable (DOM order).
  ranked.sort((a, b) => a.tier - b.tier || Number(b.popup) - Number(a.popup));
  return ranked.slice(0, max).map(({ tier: _tier, popup: _popup, ...proposal }) => proposal);
}
