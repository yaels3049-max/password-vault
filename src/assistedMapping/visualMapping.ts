import { sendExtensionMessageAsync, probeExtensionAvailable } from '../browserIntegration';
import { originFromHttpsLoginEntry } from '../autofill/validatedProfile';
import {
  ADMIN_VISUAL_MAPPING_START_MESSAGE,
  VISUAL_MAPPING_FAILED_LABEL_HE,
  VISUAL_MAPPING_MANAGED_INELIGIBLE_LABEL_HE,
  VISUAL_MAPPING_NEED_LOGIN_ENTRY_LABEL_HE,
  VISUAL_MAPPING_ORIGIN_MISMATCH_LABEL_HE,
  VISUAL_MAPPING_SUCCESS_LABEL_HE,
  VISUAL_MAPPING_UNSUPPORTED_TARGET_LABEL_HE,
} from './types';

export type VisualMappingResult =
  | {
      ok: true;
      fieldId: string;
      locator: string;
      locatorType: 'css';
      message: string;
      state: 'IDENTIFIED_AND_MANAGED_ELIGIBLE';
      observedInputId?: string;
      locatorCandidates?: string[];
    }
  | {
      ok: false;
      message: string;
      reason?: string;
      state?: 'NOT_IDENTIFIED' | 'IDENTIFIED_BUT_MANAGED_INELIGIBLE';
      detail?: string;
    };

interface VisualMappingExtensionResponse {
  ok?: boolean;
  reason?: string;
  fieldId?: string;
  locator?: string;
  locatorType?: string;
  state?: string;
  detail?: string;
  identified?: boolean;
  locatorEvidence?: string;
  locatorCandidates?: Array<{ locator?: string } | string>;
  meta?: { idAttr?: string; nameAttr?: string };
}

/**
 * Phase 119.2 — Admin Visual Mapping authoring.
 * Opens real Login Entry via extension; Admin clicks a control; CSS locator returns.
 * Never calls MappingLlmProvider; never persists; never sends credential values.
 */
export async function startVisualMappingForField(input: {
  fieldId: string;
  loginEntryUrl: string;
}): Promise<VisualMappingResult> {
  const fieldId = input.fieldId.trim();
  const loginEntryUrl = input.loginEntryUrl.trim();
  const allowedOrigin = originFromHttpsLoginEntry(loginEntryUrl);

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

  const requestId = crypto.randomUUID();
  const response = await sendExtensionMessageAsync<VisualMappingExtensionResponse>({
    type: ADMIN_VISUAL_MAPPING_START_MESSAGE,
    requestId,
    fieldId,
    loginEntryUrl,
    allowedOrigin,
  });

  if (!response?.ok || typeof response.locator !== 'string' || !response.locator.trim()) {
    const reason = response?.reason;
    const identified =
      response?.identified === true ||
      response?.state === 'IDENTIFIED_BUT_MANAGED_INELIGIBLE';
    if (reason === 'origin_mismatch') {
      return {
        ok: false,
        message: VISUAL_MAPPING_ORIGIN_MISMATCH_LABEL_HE,
        reason,
        state: 'NOT_IDENTIFIED',
      };
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
        message: identified
          ? VISUAL_MAPPING_MANAGED_INELIGIBLE_LABEL_HE
          : VISUAL_MAPPING_UNSUPPORTED_TARGET_LABEL_HE,
        reason,
        state: identified ? 'IDENTIFIED_BUT_MANAGED_INELIGIBLE' : 'NOT_IDENTIFIED',
      };
    }
    if (reason === 'locator_target_mismatch' || reason === 'no_exact_one_locator') {
      return {
        ok: false,
        message: VISUAL_MAPPING_MANAGED_INELIGIBLE_LABEL_HE,
        reason,
        state: 'IDENTIFIED_BUT_MANAGED_INELIGIBLE',
      };
    }
    return {
      ok: false,
      message: VISUAL_MAPPING_FAILED_LABEL_HE,
      reason: reason ?? 'visual_mapping_failed',
    };
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
        : typeof response.meta?.nameAttr === 'string' && response.meta.nameAttr.trim()
          ? `name:${response.meta.nameAttr.trim()}`
          : undefined,
    locatorCandidates: Array.isArray(response.locatorCandidates)
      ? response.locatorCandidates
          .map((c) => (typeof c === 'string' ? c : typeof c?.locator === 'string' ? c.locator : ''))
          .filter((c) => c.trim())
      : undefined,
  };
}
