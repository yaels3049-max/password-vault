/**
 * Phase 121.1 — SPECIAL current-surface authoring entry (§4.6 / D-121-21).
 * Ext open/reuse targets resolved §4.7 authoringUrl / allowedOrigin — NOT Hub active tab.
 * MUST NOT reopen Login Entry after SPECIAL progression. STANDARD paths unchanged.
 *
 * SPECIAL Analyze = Phase 121 opener/transition **routing**
 * + Phase 120 credential-field Analyze semantics (separate engines).
 *
 * 121.1-IF — surfaces = top document + depth-1 HTTPS frames. Phase 120 field
 * Analyze runs once per surface (no merged pseudo-page); frame origins need
 * explicit Admin approval (R2) before anything framed is written or clicked.
 */

import { sendExtensionMessageAsync, probeExtensionAvailable } from '../browserIntegration';
import { originFromHttpsLoginEntry } from '../autofill/validatedProfile';
import { proposeFieldMappings, assistedMappingAuditSummary } from './agentService';
import { schemaFromLoginFields } from './mockProvider';
import { applyConfidentPrefill } from './safetyValidation';
import {
  proposeSpecialActionCandidates,
  type SpecialActionCandidateObservation,
  type SpecialActionProposal,
} from './specialAnalyzeRouting';
import {
  ADMIN_CURRENT_TAB_INSPECT_MESSAGE,
  ADMIN_CURRENT_TAB_VISUAL_MAPPING_START_MESSAGE,
  ADMIN_AUTHORING_CLICK_APPROVED_MESSAGE,
  ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL_MESSAGE,
  ADMIN_VISUAL_PICK_TIMEOUT_MS,
  ANALYZE_FAILED_LABEL_HE,
  ANALYZE_NEED_SCHEMA_LABEL_HE,
  ANALYZE_NEED_LOGIN_ENTRY_LABEL_HE,
  VISUAL_MAPPING_FAILED_LABEL_HE,
  VISUAL_MAPPING_NEED_LOGIN_ENTRY_LABEL_HE,
  VISUAL_MAPPING_SUCCESS_LABEL_HE,
  VISUAL_MAPPING_MANAGED_INELIGIBLE_LABEL_HE,
  VISUAL_MAPPING_ORIGIN_MISMATCH_LABEL_HE,
  VISUAL_MAPPING_UNSUPPORTED_TARGET_LABEL_HE,
  SURFACE_NOT_OPENED_HE,
  SURFACE_NOT_LOGIN_HE,
  MAPPED_FIELD_NOT_APPEARED_HE,
  SURFACE_FRAME_NOT_ADDRESSABLE_HE,
  AUTHORING_TEST_NOT_PROVEN_REASON,
  AUTHORING_TEST_NOT_PROVEN_HE,
  VISUAL_ACTION_UNSUPPORTED_TARGET_HE,
  UNSUPPORTED_NESTED_FRAME_HE,
  UNSUPPORTED_SHADOW_DOM_HE,
  UNSUPPORTED_NON_HTTPS_FRAME_HE,
  FRAME_NOT_ADDRESSABLE_HE,
  FRAME_ORIGIN_CHANGED_HE,
  FRAME_CORRELATION_UNAVAILABLE_HE,
  type FramedSurface,
  type FrameUnsupportedSummary,
  type MappingProposalRow,
  type SafePageStructure,
  type StructuredMappingProposal,
} from './types';
import type { AnalyzeLoginPageResult } from './analyzeLoginPage';
import type { VisualMappingResult } from './visualMapping';
import {
  canPerformAuthoringClick,
  DEFAULT_READINESS_TIMEOUT_MS,
  readinessModeFor,
} from '../loginContract/specialDraftAuthoring';
import {
  cloneFrameDescriptor,
  isFrameOriginApproved,
  isValidFrameDescriptor,
} from '../loginContract/frameDescriptor';
import type { FlowAction, FrameDescriptor, SpecialLoginPattern } from '../loginContract/types';

/** D-121-27 — every SPECIAL Ext response names the origin-verified authoring tab it used. */
interface AuthoringTabResponse {
  authoringTabId?: number;
}

interface InspectSurfaceResponse {
  frameKey?: string;
  frame?: { frameLocator?: string | null; frameOrigin?: string } | null;
  status?: string;
  page?: SafePageStructure | null;
  actionCandidates?: SpecialActionCandidateObservation[];
}

interface InspectResponse extends AuthoringTabResponse {
  ok?: boolean;
  reason?: string;
  page?: SafePageStructure;
  actionCandidates?: SpecialActionCandidateObservation[];
  surfaces?: InspectSurfaceResponse[];
  unsupported?: Partial<FrameUnsupportedSummary>;
  reopenLoginEntry?: boolean;
}

interface ClickResponse extends AuthoringTabResponse {
  ok?: boolean;
  reason?: string;
  liveOrigin?: string;
  revealed?: { frameKey?: string; frame?: FrameDescriptor | null };
  actionsOnly?: boolean;
}

/** Hub-side session tab: sent as `tabId`, echoed back as `authoringTabId`. */
export interface AuthoringTabSession {
  /** Session tab from a previous SPECIAL response; Ext re-validates origin / existence. */
  authoringTabId?: number | null;
}

/** R2 input: session-approved frame origins (draft descriptors are approvals too). */
export interface FrameApprovalContext {
  approvedFrameOrigins?: ReadonlySet<string>;
}

function authoringTabIdOf(response: AuthoringTabResponse | null | undefined): number | undefined {
  return typeof response?.authoringTabId === 'number' ? response.authoringTabId : undefined;
}

function sessionTabField(input: AuthoringTabSession): { tabId?: number } {
  return typeof input.authoringTabId === 'number' ? { tabId: input.authoringTabId } : {};
}

/**
 * 121.1-IF — one confident credential proposal with the surface it came from.
 * `ready` = top document, or a frame whose origin is approved (R2 / A2).
 */
export interface FramedFieldProposal {
  fieldId: string;
  locator: string;
  frame: FrameDescriptor | null;
  /** Origin of an unaddressable frame (display only). */
  frameOrigin?: string;
  state: 'ready' | 'needs_frame_approval' | 'frame_not_addressable';
}

export type SpecialCurrentSurfaceAnalyzeResult = (
  | {
      ok: true;
      /** Phase 121 SPECIAL Analyze routing — opener/transition proposals (unapproved). */
      actionProposals: SpecialActionProposal[];
      /** Phase 120 field-Analyze semantics on current surfaces (not opener-aware). */
      fieldAnalyze: AnalyzeLoginPageResult & { ok: true };
      /** Confident per-field proposals (not already mapped), tagged with their frame. */
      framedFieldProposals: FramedFieldProposal[];
      /** Plain-Hebrew UNSUPPORTED text when nothing usable was found (never silent). */
      unsupportedMessage?: string;
    }
  | {
      ok: false;
      message: string;
      reason?: string;
      actionProposals?: SpecialActionProposal[];
      fieldAnalyze?: AnalyzeLoginPageResult;
      framedFieldProposals?: FramedFieldProposal[];
      unsupportedMessage?: string;
    }
) & { authoringTabId?: number };

function emptyUnsupported(): FrameUnsupportedSummary {
  return {
    nested: 0,
    nonHttps: 0,
    notInjectable: 0,
    shadowCredential: 0,
    notAddressable: 0,
    correlationUnavailable: 0,
  };
}

function normalizeUnsupported(raw: Partial<FrameUnsupportedSummary> | undefined): FrameUnsupportedSummary {
  const out = emptyUnsupported();
  if (!raw) return out;
  for (const key of Object.keys(out) as Array<keyof FrameUnsupportedSummary>) {
    const v = raw[key];
    out[key] = typeof v === 'number' && v > 0 ? v : 0;
  }
  return out;
}

/** Plain-Hebrew UNSUPPORTED messages for the counts (never a silent failure). */
export function unsupportedMessagesHe(u: FrameUnsupportedSummary): string[] {
  const out: string[] = [];
  if (u.correlationUnavailable > 0) out.push(FRAME_CORRELATION_UNAVAILABLE_HE);
  if (u.nested > 0) out.push(UNSUPPORTED_NESTED_FRAME_HE);
  if (u.shadowCredential > 0) out.push(UNSUPPORTED_SHADOW_DOM_HE);
  if (u.nonHttps > 0 || u.notInjectable > 0) out.push(UNSUPPORTED_NON_HTTPS_FRAME_HE);
  if (u.notAddressable > 0) out.push(FRAME_NOT_ADDRESSABLE_HE);
  return out;
}

function surfaceFrame(raw: InspectSurfaceResponse): FrameDescriptor | null {
  const f = raw.frame;
  if (!f || typeof f.frameLocator !== 'string') return null;
  const d = { frameLocator: f.frameLocator, frameOrigin: String(f.frameOrigin ?? '') };
  return isValidFrameDescriptor(d) ? cloneFrameDescriptor(d) : null;
}

function normalizeSurfaces(inspect: InspectResponse): FramedSurface[] {
  const out: FramedSurface[] = [];
  if (Array.isArray(inspect.surfaces)) {
    for (const raw of inspect.surfaces) {
      if (!raw || !raw.page) continue;
      const status =
        raw.status === 'top' || raw.status === 'depth1_https' || raw.status === 'not_addressable'
          ? raw.status
          : null;
      if (!status) continue;
      const frame = status === 'top' ? null : surfaceFrame(raw);
      if (status === 'depth1_https' && !frame) continue;
      const unaddressableOrigin =
        status === 'not_addressable' && typeof raw.frame?.frameOrigin === 'string'
          ? raw.frame.frameOrigin
          : '';
      out.push({
        frameKey:
          typeof raw.frameKey === 'string' && raw.frameKey
            ? raw.frameKey
            : status === 'top'
              ? 'top'
              : `unaddressable|${unaddressableOrigin}`,
        frame: status === 'not_addressable' ? null : frame,
        status,
        page: raw.page,
        actionCandidates: Array.isArray(raw.actionCandidates) ? raw.actionCandidates : [],
        ...(unaddressableOrigin ? { unaddressableOrigin } : {}),
      });
    }
  }
  if (!out.some((s) => s.status === 'top') && inspect.page) {
    // Legacy Ext shape: single top surface.
    out.unshift({
      frameKey: 'top',
      frame: null,
      status: 'top',
      page: inspect.page,
      actionCandidates: Array.isArray(inspect.actionCandidates) ? inspect.actionCandidates : [],
    });
  }
  return out;
}

async function inspectCurrentTabPage(input: {
  loginEntryUrl: string;
} & AuthoringTabSession): Promise<
  (
    | {
        ok: true;
        page: SafePageStructure;
        actionCandidates: SpecialActionCandidateObservation[];
        surfaces: FramedSurface[];
        unsupported: FrameUnsupportedSummary;
        allowedOrigin: string;
      }
    | { ok: false; message: string; reason: string }
  ) & { authoringTabId?: number }
> {
  const allowedOrigin = originFromHttpsLoginEntry(input.loginEntryUrl.trim());
  if (!allowedOrigin) {
    return { ok: false, message: ANALYZE_NEED_LOGIN_ENTRY_LABEL_HE, reason: 'missing_login_entry' };
  }
  if (!probeExtensionAvailable()) {
    return { ok: false, message: ANALYZE_FAILED_LABEL_HE, reason: 'extension_unavailable' };
  }
  const inspect = await sendExtensionMessageAsync<InspectResponse>({
    type: ADMIN_CURRENT_TAB_INSPECT_MESSAGE,
    requestId: crypto.randomUUID(),
    allowedOrigin,
    // §4.7 resolved authoring URL — Ext open/reuse targets this origin, not Hub.
    authoringUrl: input.loginEntryUrl.trim(),
    ...sessionTabField(input),
    reopenLoginEntry: false,
  });
  const authoringTabId = authoringTabIdOf(inspect);
  if (inspect?.reopenLoginEntry === true) {
    return {
      ok: false,
      message: ANALYZE_FAILED_LABEL_HE,
      reason: 'reopen_login_entry_forbidden',
    };
  }
  if (!inspect?.ok || !inspect.page) {
    return {
      ok: false,
      message: ANALYZE_FAILED_LABEL_HE,
      reason: inspect?.reason === 'origin_mismatch' ? 'origin_mismatch' : 'inspect_failed',
      authoringTabId,
    };
  }
  return {
    ok: true,
    page: inspect.page,
    actionCandidates: Array.isArray(inspect.actionCandidates) ? inspect.actionCandidates : [],
    surfaces: normalizeSurfaces(inspect),
    unsupported: normalizeUnsupported(inspect.unsupported),
    allowedOrigin,
    authoringTabId,
  };
}

/**
 * Analyze fields on the **already-open** authoring tab (existing-tab entry).
 * Reuses Phase 120 propose + safety + HIGH/MEDIUM prefill semantics.
 * Does not propose openers/transitions — use analyzeSpecialCurrentSurface for that.
 */
export async function analyzeCurrentTabForMapping(input: {
  serviceId: string;
  loginFields: Array<{ id: string; label: string; type?: string; description?: string }>;
  loginEntryUrl: string;
  currentLocators: Record<string, string>;
}): Promise<AnalyzeLoginPageResult> {
  const schema = schemaFromLoginFields(input.loginFields);
  if (schema.length === 0) {
    return { ok: false, message: ANALYZE_NEED_SCHEMA_LABEL_HE };
  }

  const inspected = await inspectCurrentTabPage({ loginEntryUrl: input.loginEntryUrl });
  if (!inspected.ok) {
    return {
      ok: false,
      message: inspected.message,
      proposal: {
        schemaVersion: 1,
        requestId: crypto.randomUUID(),
        serviceId: input.serviceId,
        status: 'error',
        errorCode:
          inspected.reason === 'origin_mismatch' ? 'origin_mismatch' : 'inspect_failed',
        proposals: [],
        unmappedFieldIds: schema.map((f) => f.fieldId),
      },
    };
  }

  const requestId = crypto.randomUUID();
  const proposal = await proposeFieldMappings({
    requestId,
    serviceId: input.serviceId,
    schema,
    page: inspected.page,
  });
  if (import.meta.env.DEV) {
    console.info('[special-draft-current-tab-fields]', assistedMappingAuditSummary(proposal));
  }
  if (proposal.status === 'error') {
    return { ok: false, message: ANALYZE_FAILED_LABEL_HE, proposal };
  }
  const prefill = applyConfidentPrefill(input.currentLocators, proposal);
  return { ok: true, proposal, prefill };
}

function surfaceActionObservations(surfaces: FramedSurface[]): SpecialActionCandidateObservation[] {
  const out: SpecialActionCandidateObservation[] = [];
  surfaces.forEach((surface, index) => {
    for (const raw of surface.actionCandidates) {
      if (!raw || typeof raw !== 'object') continue;
      const id =
        surface.status === 'top' || !raw.actionCandidateId
          ? raw.actionCandidateId
          : `f${index}-${raw.actionCandidateId}`;
      out.push({
        ...raw,
        actionCandidateId: id,
        frame: surface.status === 'depth1_https' ? surface.frame : null,
        ...(surface.status === 'not_addressable' ? { frameNotAddressable: true } : {}),
      });
    }
  });
  return out;
}

/**
 * Merge per-surface Phase 120 results. A field is proposed only when exactly one
 * surface has a confident (HIGH/MEDIUM + deterministic) row; confident rows on
 * more than one surface → not confidently mapped (no prefill).
 */
export function mergeSurfaceFieldProposals(input: {
  surfaces: FramedSurface[];
  proposals: StructuredMappingProposal[];
  currentLocators: Record<string, string>;
  approvedFrameOrigins: ReadonlySet<string>;
  entryAllowedOrigin: string;
}): {
  merged: StructuredMappingProposal;
  framed: FramedFieldProposal[];
  prefill: { next: Record<string, string>; appliedFieldIds: string[] };
} {
  const { surfaces, proposals, currentLocators } = input;
  const confidentBySurface = proposals.map((p) => applyConfidentPrefill({}, p));
  const fieldIds = new Set<string>();
  proposals.forEach((p) => p.proposals.forEach((r) => fieldIds.add(r.fieldId)));

  const rows: MappingProposalRow[] = [];
  const framed: FramedFieldProposal[] = [];
  const next = { ...currentLocators };
  const appliedFieldIds: string[] = [];
  const decided = new Set<string>();
  const topIndex = surfaces.findIndex((s) => s.status === 'top');

  for (const fieldId of fieldIds) {
    const winners = confidentBySurface
      .map((c, i) => (c.appliedFieldIds.includes(fieldId) ? i : -1))
      .filter((i) => i >= 0);
    if (winners.length !== 1) {
      if (winners.length === 0 && topIndex >= 0) {
        rows.push(...proposals[topIndex].proposals.filter((r) => r.fieldId === fieldId));
      }
      continue;
    }
    const i = winners[0];
    const surface = surfaces[i];
    const row = proposals[i].proposals.find(
      (r) => r.fieldId === fieldId && r.locator === confidentBySurface[i].next[fieldId],
    );
    if (!row) continue;
    rows.push(row);
    decided.add(fieldId);
    if ((currentLocators[fieldId] ?? '').trim()) continue;

    if (surface.status === 'not_addressable') {
      const origin = surface.unaddressableOrigin;
      framed.push({
        fieldId,
        locator: row.locator,
        frame: null,
        ...(origin ? { frameOrigin: origin } : {}),
        state: 'frame_not_addressable',
      });
      continue;
    }
    const frame = surface.status === 'depth1_https' ? surface.frame : null;
    const ready =
      !frame ||
      isFrameOriginApproved(frame.frameOrigin, input.approvedFrameOrigins, input.entryAllowedOrigin);
    framed.push({
      fieldId,
      locator: row.locator,
      frame,
      state: ready ? 'ready' : 'needs_frame_approval',
    });
    if (ready) {
      next[fieldId] = row.locator;
      appliedFieldIds.push(fieldId);
    }
  }

  const base = proposals[topIndex >= 0 ? topIndex : 0];
  const merged: StructuredMappingProposal = {
    ...base,
    status: decided.size > 0 ? base.status : 'no_confident_mapping',
    proposals: rows,
    unmappedFieldIds: Array.from(
      new Set([...proposals.flatMap((p) => p.unmappedFieldIds), ...fieldIds]),
    ).filter((id) => !decided.has(id)),
    identifiedButManagedIneligible: proposals.flatMap((p) => p.identifiedButManagedIneligible ?? []),
  };
  return { merged, framed, prefill: { next, appliedFieldIds } };
}

/**
 * SPECIAL «Analyze» on current / already-open surface (§4.6 / §5.1 / 121.1-IF).
 *
 * 1) Phase 121 routing → opener/transition candidate proposals (unapproved)
 * 2) Phase 120 field-Analyze semantics per surface (top + depth-1 HTTPS frames)
 *
 * Never reopens Login Entry. Never auto-invokes Visual. Never clicks.
 */
export async function analyzeSpecialCurrentSurface(input: {
  serviceId: string;
  pattern: SpecialLoginPattern;
  loginFields: Array<{ id: string; label: string; type?: string; description?: string }>;
  loginEntryUrl: string;
  currentLocators: Record<string, string>;
} & AuthoringTabSession & FrameApprovalContext): Promise<SpecialCurrentSurfaceAnalyzeResult> {
  const schema = schemaFromLoginFields(input.loginFields);
  const inspected = await inspectCurrentTabPage({
    loginEntryUrl: input.loginEntryUrl,
    authoringTabId: input.authoringTabId,
  });
  const authoringTabId = inspected.authoringTabId;
  if (!inspected.ok) {
    return {
      ok: false,
      message: inspected.message,
      reason: inspected.reason,
      actionProposals: [],
      authoringTabId,
    };
  }

  // Phase 121 SPECIAL Analyze routing (NOT Phase 120 field-Analyze).
  const actionProposals = proposeSpecialActionCandidates({
    pattern: input.pattern,
    actionCandidates: surfaceActionObservations(inspected.surfaces),
  });
  const unsupportedMessages = unsupportedMessagesHe(inspected.unsupported);

  if (schema.length === 0) {
    return {
      ok: true,
      actionProposals,
      fieldAnalyze: {
        ok: true,
        proposal: {
          schemaVersion: 1,
          requestId: crypto.randomUUID(),
          serviceId: input.serviceId,
          status: 'ok',
          proposals: [],
          unmappedFieldIds: [],
        },
        prefill: { next: { ...input.currentLocators }, appliedFieldIds: [] },
      },
      framedFieldProposals: [],
      authoringTabId,
    };
  }

  const perSurface: StructuredMappingProposal[] = [];
  for (const surface of inspected.surfaces) {
    const proposal = await proposeFieldMappings({
      requestId: crypto.randomUUID(),
      serviceId: input.serviceId,
      schema,
      page: surface.page,
    });
    if (import.meta.env.DEV) {
      console.info('[special-draft-current-tab-fields]', surface.frameKey, assistedMappingAuditSummary(proposal));
    }
    perSurface.push(proposal);
  }

  const topIndex = inspected.surfaces.findIndex((s) => s.status === 'top');
  const topProposal = perSurface[topIndex >= 0 ? topIndex : 0];
  if (!topProposal || topProposal.status === 'error') {
    return {
      ok: false,
      message: ANALYZE_FAILED_LABEL_HE,
      reason: 'field_analyze_failed',
      actionProposals,
      fieldAnalyze: topProposal
        ? { ok: false, message: ANALYZE_FAILED_LABEL_HE, proposal: topProposal }
        : undefined,
      authoringTabId,
    };
  }

  const usable = inspected.surfaces
    .map((s, i) => ({ s, p: perSurface[i] }))
    .filter(({ p }) => p.status !== 'error');
  const { merged, framed, prefill } = mergeSurfaceFieldProposals({
    surfaces: usable.map((u) => u.s),
    proposals: usable.map((u) => u.p),
    currentLocators: input.currentLocators,
    approvedFrameOrigins: input.approvedFrameOrigins ?? new Set(),
    entryAllowedOrigin: inspected.allowedOrigin,
  });

  const usableCredential = framed.some((f) => f.state !== 'frame_not_addressable');
  const alreadyMapped = Object.values(input.currentLocators).some((v) => (v ?? '').trim());
  const notAddressableField = framed.some((f) => f.state === 'frame_not_addressable');
  const messages = [...unsupportedMessages];
  if (notAddressableField && !messages.includes(FRAME_NOT_ADDRESSABLE_HE)) {
    messages.push(FRAME_NOT_ADDRESSABLE_HE);
  }
  const unsupportedMessage =
    !usableCredential && !alreadyMapped && messages.length > 0 ? messages.join(' ') : undefined;

  return {
    ok: true,
    actionProposals,
    fieldAnalyze: { ok: true, proposal: merged, prefill },
    framedFieldProposals: framed,
    ...(unsupportedMessage ? { unsupportedMessage } : {}),
    authoringTabId,
  };
}

type SpecialVisualInterpretation = VisualMappingResult & {
  /** 121.1-IF — frame the picked element lives in (null = top document). */
  frame?: FrameDescriptor | null;
  /** Timeout while some visible frame could not be armed (append hint). */
  maybeUnsupportedFrame?: boolean;
};

export type SpecialVisualMappingResult = SpecialVisualInterpretation & {
  authoringTabId?: number;
};

/**
 * Visual Mapping on current tab — explicit Admin choice only.
 */
export async function startCurrentTabVisualMapping(input: {
  fieldId: string;
  loginEntryUrl: string;
  /** D-121-35 §2 — 'action' arms the opener / transition pick; absent → field pick. */
  pickTarget?: 'field' | 'action';
} & AuthoringTabSession): Promise<SpecialVisualMappingResult> {
  const pickTarget = input.pickTarget === 'action' ? 'action' : 'field';
  const fieldId = input.fieldId.trim();
  const allowedOrigin = originFromHttpsLoginEntry(input.loginEntryUrl.trim());
  if (!fieldId) {
    return { ok: false, message: VISUAL_MAPPING_FAILED_LABEL_HE, reason: 'missing_field' };
  }
  if (!allowedOrigin) {
    return {
      ok: false,
      message: VISUAL_MAPPING_NEED_LOGIN_ENTRY_LABEL_HE,
      reason: 'missing_login_entry',
    };
  }
  if (!probeExtensionAvailable()) {
    return {
      ok: false,
      message: VISUAL_MAPPING_FAILED_LABEL_HE,
      reason: 'extension_unavailable',
    };
  }

  const response = await sendExtensionMessageAsync<CurrentTabVisualResponse>({
    type: ADMIN_CURRENT_TAB_VISUAL_MAPPING_START_MESSAGE,
    requestId: crypto.randomUUID(),
    fieldId,
    allowedOrigin,
    authoringUrl: input.loginEntryUrl.trim(),
    ...sessionTabField(input),
    pickTimeoutMs: ADMIN_VISUAL_PICK_TIMEOUT_MS,
    ...(pickTarget === 'action' ? { pickTarget } : {}),
    reopenLoginEntry: false,
  });
  return {
    ...interpretCurrentTabVisualResponse(response, fieldId, pickTarget),
    authoringTabId: authoringTabIdOf(response),
  };
}

interface CurrentTabVisualResponse extends AuthoringTabResponse {
  ok?: boolean;
  reason?: string;
  fieldId?: string;
  locator?: string;
  identified?: boolean;
  state?: string;
  detail?: string;
  meta?: { idAttr?: string; nameAttr?: string };
  locatorCandidates?: Array<{ locator?: string } | string>;
  reopenLoginEntry?: boolean;
  frameKey?: string;
  frame?: { frameLocator?: string | null; frameOrigin?: string } | null;
  frameOrigin?: string;
  unsupported?: Partial<FrameUnsupportedSummary>;
}

export function interpretCurrentTabVisualResponse(
  response: CurrentTabVisualResponse | null | undefined,
  fieldId: string,
  pickTarget: 'field' | 'action' = 'field',
): SpecialVisualInterpretation {
  if (response?.reopenLoginEntry === true) {
    return {
      ok: false,
      message: VISUAL_MAPPING_FAILED_LABEL_HE,
      reason: 'reopen_login_entry_forbidden',
    };
  }

  if (!response?.ok || typeof response.locator !== 'string' || !response.locator.trim()) {
    const reason = response?.reason;
    if (reason === 'visual_pick_timeout' || reason === 'visual_pick_cancelled') {
      // Editor owns the Admin copy for these (exact button labels).
      return {
        ok: false,
        message: VISUAL_MAPPING_FAILED_LABEL_HE,
        reason,
        maybeUnsupportedFrame: normalizeUnsupported(response?.unsupported).notInjectable > 0,
      };
    }
    if (reason === 'origin_mismatch') {
      return { ok: false, message: VISUAL_MAPPING_ORIGIN_MISMATCH_LABEL_HE, reason };
    }
    if (reason === 'shadow_dom_unsupported') {
      return { ok: false, message: UNSUPPORTED_SHADOW_DOM_HE, reason };
    }
    if (reason === 'nested_frame_unsupported') {
      return { ok: false, message: UNSUPPORTED_NESTED_FRAME_HE, reason };
    }
    if (reason === 'frame_not_addressable') {
      return { ok: false, message: FRAME_NOT_ADDRESSABLE_HE, reason };
    }
    if (reason === 'frame_origin_mismatch') {
      return {
        ok: false,
        message: FRAME_ORIGIN_CHANGED_HE(String(response?.frameOrigin ?? '')),
        reason,
      };
    }
    if (reason === 'frame_correlation_unavailable') {
      return { ok: false, message: FRAME_CORRELATION_UNAVAILABLE_HE, reason };
    }
    if (pickTarget === 'action') {
      if (
        reason === 'unsupported_target' ||
        reason === 'no_locator_candidates' ||
        reason === 'no_exact_one_locator' ||
        reason === 'locator_target_mismatch' ||
        reason === 'action_target_not_visible'
      ) {
        return {
          ok: false,
          message: VISUAL_ACTION_UNSUPPORTED_TARGET_HE,
          reason,
          state: 'NOT_IDENTIFIED',
        };
      }
    }
    if (reason === 'managed_ineligible') {
      return {
        ok: false,
        message: VISUAL_MAPPING_MANAGED_INELIGIBLE_LABEL_HE,
        reason,
        state: 'IDENTIFIED_BUT_MANAGED_INELIGIBLE',
        detail: typeof response?.detail === 'string' ? response.detail : undefined,
      };
    }
    if (reason === 'unsupported_target' || reason === 'no_locator_candidates') {
      return {
        ok: false,
        message: VISUAL_MAPPING_UNSUPPORTED_TARGET_LABEL_HE,
        reason,
        state: 'NOT_IDENTIFIED',
      };
    }
    return {
      ok: false,
      message: VISUAL_MAPPING_FAILED_LABEL_HE,
      reason: reason ?? 'visual_mapping_failed',
    };
  }

  let frame: FrameDescriptor | null = null;
  if (response.frame) {
    frame = surfaceFrame({ frame: response.frame });
    if (!frame) {
      return { ok: false, message: FRAME_NOT_ADDRESSABLE_HE, reason: 'frame_not_addressable' };
    }
  }

  return {
    ok: true,
    fieldId: typeof response.fieldId === 'string' && response.fieldId ? response.fieldId : fieldId,
    locator: response.locator.trim(),
    locatorType: 'css',
    message: VISUAL_MAPPING_SUCCESS_LABEL_HE,
    state: 'IDENTIFIED_AND_MANAGED_ELIGIBLE',
    observedInputId:
      typeof response.meta?.idAttr === 'string' && response.meta.idAttr.trim()
        ? `id:${response.meta.idAttr.trim()}`
        : undefined,
    locatorCandidates: Array.isArray(response.locatorCandidates)
      ? response.locatorCandidates
          .map((c) => (typeof c === 'string' ? c : typeof c?.locator === 'string' ? c.locator : ''))
          .filter((c) => c.trim())
      : undefined,
    frame,
  };
}

/**
 * D-121-25 — disarm an armed SPECIAL Visual pick in the authoring tab.
 * Listener removed page-side; no mapping is produced. Best-effort: the editor
 * releases itself regardless of the response.
 */
export async function cancelCurrentTabVisualMapping(input: {
  loginEntryUrl: string;
} & AuthoringTabSession): Promise<{
  ok: boolean;
  disarmed: boolean;
  reason?: string;
  authoringTabId?: number;
}> {
  const allowedOrigin = originFromHttpsLoginEntry(input.loginEntryUrl.trim());
  if (!allowedOrigin || !probeExtensionAvailable()) {
    return { ok: false, disarmed: false, reason: 'unavailable' };
  }
  const response = await sendExtensionMessageAsync<
    { ok?: boolean; disarmed?: boolean; reason?: string } & AuthoringTabResponse
  >({
    type: ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL_MESSAGE,
    requestId: crypto.randomUUID(),
    allowedOrigin,
    ...sessionTabField(input),
  });
  return {
    ok: response?.ok === true,
    disarmed: response?.disarmed === true,
    reason: response?.reason,
    authoringTabId: authoringTabIdOf(response),
  };
}

const CLICK_FAILED_HE = 'לחיצת המשך נכשלה. בדקו שהלשונית הנוכחית פתוחה במקור הנכון.';

/**
 * D-121-60 — Hub wait for the authoring click = the action's readiness timeout + this margin.
 * The margin covers the extension's bounded flow (discovery calls ≤ SPECIAL_AUTHORING_CALL_TIMEOUT_MS
 * each, before and after the readiness window), so the Hub never gives up before the extension.
 */
export const AUTHORING_CLICK_HUB_MARGIN_MS = 90_000;
export const AUTHORING_CLICK_NO_RESPONSE_REASON = 'authoring_click_no_response';

function withAuthoringClickWait(sent: Promise<ClickResponse | null>, action: FlowAction): Promise<ClickResponse | null> {
  const readinessMs =
    action.readiness && action.readiness.timeoutMs > 0 ? action.readiness.timeoutMs : DEFAULT_READINESS_TIMEOUT_MS;
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, reason: AUTHORING_CLICK_NO_RESPONSE_REASON }),
      readinessMs + AUTHORING_CLICK_HUB_MARGIN_MS,
    );
    void sent.then((response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

/** Ext click failure reason → plain-Hebrew Admin message. */
export function authoringClickFailureMessageHe(reason: string | undefined, liveOrigin?: string): string {
  switch (reason) {
    case 'surface_not_revealed':
      return SURFACE_NOT_OPENED_HE;
    case 'surface_not_login':
      return SURFACE_NOT_LOGIN_HE;
    case 'readiness_timeout':
      return MAPPED_FIELD_NOT_APPEARED_HE;
    case 'surface_frame_not_addressable':
      return SURFACE_FRAME_NOT_ADDRESSABLE_HE;
    case 'frame_origin_mismatch':
      return FRAME_ORIGIN_CHANGED_HE(liveOrigin ?? '');
    case 'frame_missing':
    case 'frame_ambiguous':
    case 'frame_not_depth1':
    case 'invalid_frame':
      return FRAME_NOT_ADDRESSABLE_HE;
    case 'frame_correlation_unavailable':
      return FRAME_CORRELATION_UNAVAILABLE_HE;
    case AUTHORING_TEST_NOT_PROVEN_REASON:
      return AUTHORING_TEST_NOT_PROVEN_HE;
    default:
      return CLICK_FAILED_HE;
  }
}

/**
 * Authoring click helper — clicks only when approvedForAuthoringContinuation
 * and (framed action) the frame origin is approved. R3: `ok` only after the
 * revealed surface is ready (declared field, or a newly revealed credential input).
 */
export async function performApprovedAuthoringClick(input: {
  action: FlowAction;
  loginEntryUrl: string;
  /**
   * D-121-47 (G8): single-step FLOATING_SCREEN authoring tests only (reveal mode);
   * D-121-59: only when the site's login fields include a password field.
   */
  requirePasswordSurface?: boolean;
  /**
   * D-121-63 D: MULTI_STEP transition test (reveal mode) — no fresh field, but the tested button
   * is gone and a fresh vocabulary action appeared → ok with `actionsOnly` (a choice screen).
   */
  allowActionsOnly?: boolean;
  /** D-121-63 B: declared readiness names the next step's button (action-only step), not a field. */
  readinessTarget?: 'action' | 'field';
} & AuthoringTabSession & FrameApprovalContext): Promise<
  (
    | { ok: true; revealedFrame?: FrameDescriptor | null; actionsOnly?: boolean }
    | { ok: false; message: string; reason: string }
  ) & { authoringTabId?: number }
> {
  const allowedOrigin = originFromHttpsLoginEntry(input.loginEntryUrl.trim());
  if (!canPerformAuthoringClick(input.action, input.approvedFrameOrigins ?? new Set(), allowedOrigin)) {
    return {
      ok: false,
      message: 'לא ניתן להמשיך לפני אישור מפורש של הפעולה.',
      reason: 'unapproved_authoring_click',
    };
  }
  if (!allowedOrigin) {
    return {
      ok: false,
      message: VISUAL_MAPPING_NEED_LOGIN_ENTRY_LABEL_HE,
      reason: 'missing_login_entry',
    };
  }
  if (!probeExtensionAvailable()) {
    return {
      ok: false,
      message: 'התוסף אינו זמין ללחיצת המשך.',
      reason: 'extension_unavailable',
    };
  }

  const readinessMode = readinessModeFor(input.action);
  const response = await withAuthoringClickWait(sendExtensionMessageAsync<ClickResponse>({
    type: ADMIN_AUTHORING_CLICK_APPROVED_MESSAGE,
    requestId: crypto.randomUUID(),
    allowedOrigin,
    authoringUrl: input.loginEntryUrl.trim(),
    kind: input.action.kind,
    locator: input.action.locator,
    locatorType: 'css',
    ...(input.action.frame ? { frame: input.action.frame } : {}),
    approvedForAuthoringContinuation: true,
    readinessMode,
    readiness: input.action.readiness,
    ...(input.requirePasswordSurface === true && readinessMode === 'reveal'
      ? { requirePasswordSurface: true }
      : {}),
    ...(input.allowActionsOnly === true && readinessMode === 'reveal' ? { allowActionsOnly: true } : {}),
    ...(input.readinessTarget === 'action' && readinessMode === 'declared' ? { readinessTarget: 'action' } : {}),
    ...sessionTabField(input),
    reopenLoginEntry: false,
    fillCredentials: false,
    submitForm: false,
  }), input.action);
  const authoringTabId = authoringTabIdOf(response);

  if (!response?.ok) {
    return {
      ok: false,
      message: authoringClickFailureMessageHe(response?.reason, response?.liveOrigin),
      reason: response?.reason ?? 'authoring_click_failed',
      authoringTabId,
    };
  }
  const revealed = response.revealed?.frame;
  return {
    ok: true,
    ...(revealed !== undefined ? { revealedFrame: revealed ?? null } : {}),
    ...(response.actionsOnly === true && input.allowActionsOnly === true ? { actionsOnly: true } : {}),
    authoringTabId,
  };
}
