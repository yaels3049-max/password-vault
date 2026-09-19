import { sendExtensionMessageAsync, probeExtensionAvailable } from '../browserIntegration';
import { originFromHttpsLoginEntry } from '../autofill/validatedProfile';
import {
  ADMIN_VISUAL_MAPPING_START_MESSAGE,
  VISUAL_MAPPING_FAILED_LABEL_HE,
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
    }
  | { ok: false; message: string; reason?: string };

interface VisualMappingExtensionResponse {
  ok?: boolean;
  reason?: string;
  fieldId?: string;
  locator?: string;
  locatorType?: string;
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
    if (reason === 'origin_mismatch') {
      return {
        ok: false,
        message: VISUAL_MAPPING_ORIGIN_MISMATCH_LABEL_HE,
        reason,
      };
    }
    if (reason === 'unsupported_target' || reason === 'no_locator_candidates') {
      return {
        ok: false,
        message: VISUAL_MAPPING_UNSUPPORTED_TARGET_LABEL_HE,
        reason,
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
  };
}
