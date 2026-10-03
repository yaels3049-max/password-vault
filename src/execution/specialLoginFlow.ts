/**
 * Phase 121.2 / 121.3 — ONE Hub entry for SPECIAL login flow runs (FLOATING_SCREEN, MULTI_STEP).
 * Digital Home (ACTIVE plan, vault credential) and Admin Test (ACTIVE or immutable
 * DRAFT snapshot, temp credential) differ only in plan context and credential source.
 * No persistence: never writes metadata, never activates, never stamps.
 */

import type { Credential } from '../credentials';
import type { Service } from '../mockServices';
import { checkSpecialDraft } from '../admin/specialActionBar';
import {
  createImmutableDraftSnapshot,
  readLoginFlowPlanFromMetadata,
  resolveActiveLoginContract,
  resolveSpecialAuthoringEntry,
  serializeLoginFlowPlanDocument,
  validateSpecialPlanComplete,
  validateSpecialRunnable,
  type ImmutableDraftSnapshot,
  type LoginContractValidateCode,
  type LoginFlowPlanDocument,
  type SpecialFieldMapping,
} from '../loginContract';
import { isExtensionAvailable, openUrlInNewTab, sendExtensionMessageAsync } from './extensionBridge';
import {
  adminManagedTestExecutionKey,
  managedAutofillExecutionKey,
  type ManagedFillDiagnostics,
} from './managedAutofill';
import { acquireFillRun, FILL_RUN_TIMEOUT_REASON } from './fillRunControl';

export const HUB_SPECIAL_LOGIN_FLOW_MESSAGE = 'HUB_SPECIAL_LOGIN_FLOW';

/**
 * D-121-72 Hub safety bound (= `FILL_RUN_HUB_BOUND_MS`: Ext tab load 120s + operation 120s
 * + margin). No answer by then → `run_timeout`, lock released, a late answer ignored.
 * A3: no response or an unknown-message reply → extension_unavailable (no fallback).
 */
export const SPECIAL_HUB_RESPONSE_TIMEOUT_MS = 260000;

export type SpecialRunContext =
  | { kind: 'active'; plan: LoginFlowPlanDocument; activePlanVersion: number }
  | { kind: 'draft_snapshot'; snapshot: ImmutableDraftSnapshot };

export type SpecialRunStage =
  | 'validate'
  | 'open'
  | 'r1'
  | 'opener'
  | 'readiness'
  | 'frame'
  | 'fill'
  | 'transition';

export interface SpecialRunOutcome {
  /** true only when state === 'STOPPED_FOR_USER' after a verified fill. */
  ok: boolean;
  state: 'STOPPED_FOR_USER' | 'FAILED';
  stage?: SpecialRunStage;
  reason?: string;
  stepId?: string;
  /** 1-based position of `stepId` in a multi-step plan (Admin «המילוי נעצר בשלב N»). */
  stepNumber?: number;
  actionId?: string;
  fieldId?: string;
  locator?: string;
  /** `frameLocator|frameOrigin` or 'top' — never a frameId. */
  frameKey?: string;
  liveOrigin?: string;
  detail?: string;
  filled?: number;
  userGestureDuringRun?: boolean;
  tabOpened: boolean;
  extensionUsed: boolean;
  fillDiagnostics?: ManagedFillDiagnostics;
  context: 'active' | 'draft_snapshot';
  planVersion: number;
  snapshotId?: string;
  /** Pre-rendered Admin detail (e.g. «הטיוטה לא מלאה: …»). */
  detailMessage?: string;
}

const RUN_STAGES = new Set<SpecialRunStage>([
  'validate',
  'open',
  'r1',
  'opener',
  'readiness',
  'frame',
  'fill',
  'transition',
]);

/** Ext reasons that mean the entry tab never loaded (Hub opens the entry instead). */
const SPECIAL_TAB_NOT_OPENED_REASONS = new Set([
  'url_not_allowed',
  'no_tab',
  'tab_load_error',
  'tab_load_timeout',
]);

const VALIDATOR_CODE_REASON: Partial<Record<LoginContractValidateCode, string>> = {
  reservedActionKind: 'reserved_action_kind',
  invalidFrame: 'frame_invalid',
  mixedFrameInStep: 'frame_invalid',
  invalidReadiness: 'readiness_invalid',
  readinessIsSelf: 'readiness_invalid',
  readinessNotDeclaredField: 'readiness_invalid',
};

function contextPlan(context: SpecialRunContext): LoginFlowPlanDocument {
  return context.kind === 'active' ? context.plan : context.snapshot.plan;
}

function contextFields(context: SpecialRunContext): Pick<SpecialRunOutcome, 'context' | 'planVersion' | 'snapshotId'> {
  const plan = contextPlan(context);
  return context.kind === 'active'
    ? { context: 'active', planVersion: context.activePlanVersion }
    : { context: 'draft_snapshot', planVersion: plan.planVersion, snapshotId: context.snapshot.snapshotId };
}

function newRunId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function logSpecialDev(message: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.log(message, detail ?? {});
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readFillDiagnostics(raw: unknown): ManagedFillDiagnostics | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.runId !== 'string' || typeof obj.path !== 'string' || !Array.isArray(obj.stamps)) {
    return undefined;
  }
  return obj as unknown as ManagedFillDiagnostics;
}

/**
 * RT-2.3 / 121.3 R-4 — every mapped fieldId of every step must have a non-blank value;
 * payload = that union (the Ext hands each step only its own subset).
 */
export function buildSpecialCredentialSubset(
  plan: LoginFlowPlanDocument,
  credentials: Credential,
): { ok: true; credentials: Credential } | { ok: false } {
  const out: Credential = {};
  const mappings = plan.steps.flatMap((step) => step.fieldMappings ?? []) as SpecialFieldMapping[];
  for (const mapping of mappings) {
    const value = credentials[mapping.fieldId];
    if (typeof value !== 'string' || !value.trim()) return { ok: false };
    out[mapping.fieldId] = value.trim();
  }
  return { ok: true, credentials: out };
}

function stepNumberOf(plan: LoginFlowPlanDocument, stepId: string | undefined): number | undefined {
  if (plan.steps.length < 2 || !stepId) return undefined;
  const index = plan.steps.findIndex((step) => step.stepId === stepId);
  return index >= 0 ? index + 1 : undefined;
}

export async function executeSpecialLoginFlow(input: {
  context: SpecialRunContext;
  entry: { authoringUrl: string; allowedOrigin: string };
  credentials: Credential;
  executionKey: string;
  diagnosticPath: 'admin_test' | 'digital_home';
}): Promise<SpecialRunOutcome> {
  const plan = contextPlan(input.context);
  const base = contextFields(input.context);

  function failed(
    reason: string,
    extra: Partial<SpecialRunOutcome> = {},
  ): SpecialRunOutcome {
    return {
      ok: false,
      state: 'FAILED',
      reason,
      tabOpened: false,
      extensionUsed: false,
      ...base,
      ...extra,
    };
  }

  const complete = validateSpecialPlanComplete(plan);
  if (!complete.ok) {
    return failed(VALIDATOR_CODE_REASON[complete.code] ?? 'plan_invalid', {
      stage: 'validate',
      detailMessage: complete.message,
    });
  }
  const runnable = validateSpecialRunnable(plan);
  if (!runnable.ok) return failed(runnable.reason, { stage: 'validate' });

  const subset = buildSpecialCredentialSubset(plan, input.credentials);
  if (!subset.ok) return failed('credentials_incomplete', { stage: 'validate' });

  const executionKey = input.executionKey.trim();
  if (!executionKey) return failed('busy');
  const fillRun = acquireFillRun('special', executionKey);
  if (!fillRun) return failed('busy');

  try {
    const entryUrl = input.entry.authoringUrl;
    if (!isExtensionAvailable()) {
      openUrlInNewTab(entryUrl);
      return failed('extension_unavailable', { tabOpened: true });
    }

    const runId = fillRun.token;
    const message = {
      type: HUB_SPECIAL_LOGIN_FLOW_MESSAGE,
      runId,
      entryUrl,
      allowedOrigin: input.entry.allowedOrigin,
      plan: serializeLoginFlowPlanDocument(plan),
      credentials: subset.credentials,
      diagnosticPath: input.diagnosticPath,
    };
    logSpecialDev('[Special Login Flow] Hub: sending run', {
      runId,
      entryUrl,
      allowedOrigin: input.entry.allowedOrigin,
      fieldIds: Object.keys(subset.credentials),
      context: base.context,
      planVersion: base.planVersion,
    });

    const raced = await fillRun.race(
      sendExtensionMessageAsync<Record<string, unknown>>(message),
      SPECIAL_HUB_RESPONSE_TIMEOUT_MS,
    );

    // D-121-72 — «עצור» / Hub bound: the tab may be open; nothing more is opened.
    if (raced.kind === 'cancelled') {
      return failed('cancelled', { tabOpened: true, extensionUsed: true });
    }
    if (raced.kind === 'timeout') {
      return failed(FILL_RUN_TIMEOUT_REASON, { tabOpened: true, extensionUsed: true });
    }
    const response = raced.value;

    // A3 — old extension (no handler) or no response: fail closed, open the entry only.
    if (
      !response ||
      typeof response !== 'object' ||
      response.reason === 'unknown_message' ||
      response.reason === 'no_message'
    ) {
      openUrlInNewTab(entryUrl);
      return failed('extension_unavailable', { tabOpened: true });
    }

    const fillDiagnostics = readFillDiagnostics(response.fillDiagnostics);
    const stage = str(response.stage) as SpecialRunStage | undefined;
    const common: Partial<SpecialRunOutcome> = {
      stage: stage && RUN_STAGES.has(stage) ? stage : undefined,
      stepId: str(response.stepId),
      stepNumber: stepNumberOf(plan, str(response.stepId)),
      actionId: str(response.actionId),
      fieldId: str(response.fieldId),
      locator: str(response.locator),
      frameKey: str(response.frameKey),
      liveOrigin: str(response.liveOrigin),
      detail: str(response.detail),
      filled: typeof response.filled === 'number' ? response.filled : undefined,
      userGestureDuringRun:
        typeof response.userGestureDuringRun === 'boolean' ? response.userGestureDuringRun : undefined,
      fillDiagnostics,
      extensionUsed: true,
    };

    if (response.ok === true && response.state === 'STOPPED_FOR_USER') {
      return { ...base, ...common, ok: true, state: 'STOPPED_FOR_USER', tabOpened: true, extensionUsed: true };
    }

    const reason = str(response.reason) || 'managed_failed';
    const tabOpened =
      response.tabOpened === true ||
      (response.tabOpened !== false && !SPECIAL_TAB_NOT_OPENED_REASONS.has(reason));
    if (!tabOpened) {
      openUrlInNewTab(entryUrl);
    }
    return failed(reason, {
      ...common,
      stage: common.stage ?? (SPECIAL_TAB_NOT_OPENED_REASONS.has(reason) ? 'open' : undefined),
      tabOpened: true,
    });
  } finally {
    fillRun.release();
  }
}

/** Digital Home — ACTIVE plan only (resolver), vault credential of the access profile. */
export async function executeDigitalHomeSpecialLoginFlow(
  service: Service,
  credential: Credential,
  accessProfileId: string,
): Promise<SpecialRunOutcome> {
  const contract = resolveActiveLoginContract(service.metadata ?? {});
  const fallback: SpecialRunOutcome = {
    ok: false,
    state: 'FAILED',
    stage: 'validate',
    reason: 'special_contract_invalid',
    tabOpened: false,
    extensionUsed: false,
    context: 'active',
    planVersion: 0,
  };
  if (contract.mode !== 'SPECIAL') return fallback;
  if (!service.id.trim() || !accessProfileId.trim()) {
    return { ...fallback, reason: 'not_eligible', planVersion: contract.activePlanVersion };
  }
  const entry = resolveSpecialAuthoringEntry({
    primaryUrl: service.url,
    loginUrl: service.loginUrl,
    metadata: service.metadata ?? null,
  });
  if (!entry.ok) {
    return { ...fallback, reason: 'entry_unresolved', planVersion: contract.activePlanVersion };
  }
  return executeSpecialLoginFlow({
    context: { kind: 'active', plan: contract.plan, activePlanVersion: contract.activePlanVersion },
    entry: { authoringUrl: entry.authoringUrl, allowedOrigin: entry.allowedOrigin },
    credentials: credential,
    executionKey: managedAutofillExecutionKey(service.id, accessProfileId),
    diagnosticPath: 'digital_home',
  });
}

export type AdminSpecialContextChoice = 'special_draft' | 'special_active';

export interface AdminSpecialServiceRow {
  id: string;
  primary_url: string | null | undefined;
  login_url?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Admin Test — ACTIVE (saved row) or DRAFT snapshot taken once at press time via
 * checkSpecialDraft. Temp credentials stay in memory. Never persists anything.
 */
export async function executeAdminSpecialLoginFlowTest(input: {
  serviceRow: AdminSpecialServiceRow;
  contextChoice: AdminSpecialContextChoice;
  tempCredentials: Credential;
  draftHasUnsavedChanges?: boolean;
}): Promise<SpecialRunOutcome> {
  const row = input.serviceRow;
  const metadata = row.metadata ?? {};
  const draftChoice = input.contextChoice === 'special_draft';

  function failedEarly(reason: string, extra: Partial<SpecialRunOutcome> = {}): SpecialRunOutcome {
    return {
      ok: false,
      state: 'FAILED',
      stage: 'validate',
      reason,
      tabOpened: false,
      extensionUsed: false,
      context: draftChoice ? 'draft_snapshot' : 'active',
      planVersion: 0,
      ...extra,
    };
  }

  let context: SpecialRunContext;
  if (draftChoice) {
    if (input.draftHasUnsavedChanges) return failedEarly('draft_unsaved_changes');
    const draft = readLoginFlowPlanFromMetadata(metadata)?.draft ?? null;
    if (!draft) return failedEarly('draft_missing');
    const check = checkSpecialDraft(draft);
    if (!check.complete) {
      return failedEarly('draft_incomplete', { detailMessage: check.message, planVersion: draft.planVersion });
    }
    const snap = createImmutableDraftSnapshot(check.normalized, { snapshotId: newRunId() });
    if (!snap.ok) {
      return failedEarly('draft_incomplete', { detailMessage: snap.message, planVersion: draft.planVersion });
    }
    context = { kind: 'draft_snapshot', snapshot: snap.snapshot };
  } else {
    const contract = resolveActiveLoginContract(metadata);
    if (contract.mode !== 'SPECIAL') return failedEarly('special_contract_invalid');
    context = { kind: 'active', plan: contract.plan, activePlanVersion: contract.activePlanVersion };
  }

  const entry = resolveSpecialAuthoringEntry({
    primaryUrl: row.primary_url,
    loginUrl: row.login_url,
    metadata,
  });
  if (!entry.ok) {
    return failedEarly('entry_unresolved', contextFields(context));
  }
  return executeSpecialLoginFlow({
    context,
    entry: { authoringUrl: entry.authoringUrl, allowedOrigin: entry.allowedOrigin },
    credentials: input.tempCredentials,
    executionKey: adminManagedTestExecutionKey(row.id),
    diagnosticPath: 'admin_test',
  });
}

/** Admin detail line: stage · reason · locator · frame (no values). */
export function formatSpecialRunDetail(outcome: SpecialRunOutcome): string {
  return [outcome.stage, outcome.reason, outcome.fieldId, outcome.detail, outcome.locator, outcome.frameKey]
    .filter(Boolean)
    .join(' · ');
}
