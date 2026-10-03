/**
 * Phase 121.2 RT-3.2 — plain-Hebrew copy for SPECIAL login flow outcomes.
 * Admin Test copy vs Digital Home end-user copy. Unknown reasons never map to success.
 */

import { FRAME_NOT_LOADED_HE } from '../assistedMapping/types';
import {
  MSG_ADMIN_MANAGED_TEST_INCOMPLETE,
  MSG_MANAGED_BUSY,
  MSG_MANAGED_EXTENSION_UNAVAILABLE,
  MSG_MANAGED_FILL_FAILED,
  MSG_MANAGED_FILL_OK,
  MSG_MANAGED_OPEN_FAILED,
} from './managedAutofill';
import { fillRunEndMessage } from './fillRunControl';

const LTR_MARK = '\u200E';

export const MSG_SPECIAL_ADMIN_FILL_OK = 'המילוי הושלם. בדקו את השדות ולחצו על כניסה באתר.';
/** A2 — a trusted gesture was seen between the opener click and readiness. */
export const MSG_SPECIAL_ADMIN_NOT_PROVEN_GESTURE = 'לא הוכח — נראה שלחצת באתר בזמן הבדיקה.';
/** A2 — the gesture watch gave no evidence, so an untouched run cannot be proven. */
export const MSG_SPECIAL_ADMIN_NOT_PROVEN_NO_EVIDENCE =
  'לא הוכח — לא ניתן היה לוודא שלא לחצת באתר בזמן הבדיקה.';
export const MSG_SPECIAL_ADMIN_PATTERN_UNSUPPORTED =
  'סוג תהליך הכניסה הזה עדיין לא נתמך בבדיקת מילוי.';
export const MSG_SPECIAL_ADMIN_PLAN_INVALID =
  'המיפוי אינו תקין להרצה. עדכנו את המיפוי ושמרו.';
export const MSG_SPECIAL_ADMIN_ENTRY_UNRESOLVED =
  'כתובת הכניסה של השירות חסרה או אינה מאובטחת (HTTPS).';
export const MSG_SPECIAL_ADMIN_DRAFT_UNSAVED =
  'יש שינויים שלא נשמרו — שמרו את המיפוי לפני בדיקה.';
export const MSG_SPECIAL_ADMIN_DRAFT_MISSING = 'אין מיפוי שמור לשירות זה.';
export const MSG_SPECIAL_ADMIN_ORIGIN_MISMATCH = 'האתר נפתח בכתובת של אתר אחר — הבדיקה נעצרה.';
export const MSG_SPECIAL_ADMIN_OPENER =
  'כפתור פתיחת מסך הכניסה לא נמצא באתר (או נמצא יותר מאחד). ייתכן שהאתר השתנה — עדכנו את המיפוי.';
export const MSG_SPECIAL_ADMIN_READINESS_TIMEOUT =
  'המסך לא נפתח — שדה הכניסה המוגדר לא הופיע בזמן.';
export const MSG_SPECIAL_ADMIN_FRAME = 'מסגרת מסך הכניסה לא נמצאה באופן חד-משמעי — הבדיקה נעצרה.';
/** 121.3 R-6 — multi-step: the Admin-chosen button that moves to the next step. */
export const MSG_SPECIAL_ADMIN_TRANSITION =
  'הכפתור שממשיך לשלב הבא לא נמצא באתר (או נמצא יותר מאחד). ייתכן שהאתר השתנה — עדכנו את המיפוי.';
export const MSG_SPECIAL_ADMIN_STEP_READINESS_TIMEOUT = 'השדות של השלב הזה לא הופיעו בזמן.';
/** 121.3 R-6 — «המילוי נעצר בשלב N: …» (multi-step plans only). */
export const MSG_SPECIAL_ADMIN_STOPPED_AT_STEP = (stepNumber: number, message: string): string =>
  `המילוי נעצר בשלב ${stepNumber}: ${message}`;
export const MSG_SPECIAL_ADMIN_FRAME_ORIGIN = (origin: string | undefined): string => {
  const live = String(origin ?? '').trim();
  if (!live || live === 'null') return FRAME_NOT_LOADED_HE;
  return `מסגרת מסך הכניסה שייכת כעת לאתר אחר (${LTR_MARK}${live}${LTR_MARK}) — המילוי נחסם.`;
};

export const MSG_SPECIAL_DH_CONTRACT_INVALID =
  'הגדרת הכניסה לשירות זה אינה תקינה. האתר נפתח — מלאו את הפרטים ידנית.';
export const MSG_SPECIAL_DH_PATTERN_UNSUPPORTED =
  'מילוי אוטומטי עדיין לא זמין לסוג הכניסה של שירות זה. האתר נפתח — מלאו את הפרטים ידנית.';
export const MSG_SPECIAL_DH_ORIGIN_MISMATCH = 'האתר נפתח בכתובת לא צפויה — המילוי נחסם.';
export const MSG_SPECIAL_DH_SCREEN_NOT_OPENED =
  'לא הצלחנו לפתוח את מסך הכניסה. האתר נפתח — מלאו את הפרטים ידנית.';
export const MSG_SPECIAL_DH_FRAME_ORIGIN = 'מסך הכניסה נטען ממקור לא צפוי — המילוי נחסם.';

const PATTERN_REASONS = new Set(['pattern_not_supported_yet', 'plan_shape_unsupported']);
const PLAN_REASONS = new Set(['plan_invalid', 'readiness_invalid', 'frame_invalid', 'reserved_action_kind']);
const OPENER_REASONS = new Set(['opener_missing', 'opener_ambiguous']);
const TRANSITION_REASONS = new Set(['transition_missing', 'transition_ambiguous']);
const FRAME_REASONS = new Set([
  'frame_missing',
  'frame_ambiguous',
  'frame_not_depth1',
  'frame_correlation_unavailable',
  'invalid_frame',
]);
const OPEN_REASONS = new Set([
  'url_not_allowed',
  'tab_load_error',
  'tab_load_timeout',
  'operation_timeout',
  'no_tab',
]);
const CREDENTIAL_REASONS = new Set(['credentials_incomplete', 'credentials_unexpected']);

export interface SpecialMessageInput {
  ok: boolean;
  reason?: string;
  liveOrigin?: string;
  /** Pre-rendered detail (e.g. «המיפוי לא מלא: …» from checkSpecialDraft). */
  detailMessage?: string;
  /** 1-based step of a multi-step plan where the run stopped (absent for single-step plans). */
  stepNumber?: number;
}

/** Admin Test outcome message (success wording is decided by the A2 presentation). */
export function specialAdminMessage(input: SpecialMessageInput): string {
  if (input.ok) return MSG_SPECIAL_ADMIN_FILL_OK;
  const ended = fillRunEndMessage(input.reason, 'admin_test');
  if (ended) return ended;
  const step = input.stepNumber;
  if (typeof step === 'number' && Number.isInteger(step) && step > 0) {
    const reason = input.reason ?? '';
    const message =
      reason === 'readiness_timeout' ? MSG_SPECIAL_ADMIN_STEP_READINESS_TIMEOUT : specialAdminReasonMessage(input);
    return MSG_SPECIAL_ADMIN_STOPPED_AT_STEP(step, message);
  }
  return specialAdminReasonMessage(input);
}

function specialAdminReasonMessage(input: SpecialMessageInput): string {
  const reason = input.reason ?? '';
  if (reason === 'draft_incomplete' || reason === 'plan_invalid') {
    return input.detailMessage || MSG_SPECIAL_ADMIN_PLAN_INVALID;
  }
  if (reason === 'draft_unsaved_changes') return MSG_SPECIAL_ADMIN_DRAFT_UNSAVED;
  if (reason === 'draft_missing') return MSG_SPECIAL_ADMIN_DRAFT_MISSING;
  if (reason === 'special_contract_invalid') return input.detailMessage || MSG_SPECIAL_ADMIN_PLAN_INVALID;
  if (PATTERN_REASONS.has(reason)) return MSG_SPECIAL_ADMIN_PATTERN_UNSUPPORTED;
  if (PLAN_REASONS.has(reason)) return MSG_SPECIAL_ADMIN_PLAN_INVALID;
  if (reason === 'entry_unresolved') return MSG_SPECIAL_ADMIN_ENTRY_UNRESOLVED;
  if (CREDENTIAL_REASONS.has(reason)) return MSG_ADMIN_MANAGED_TEST_INCOMPLETE;
  if (reason === 'origin_mismatch') return MSG_SPECIAL_ADMIN_ORIGIN_MISMATCH;
  if (OPENER_REASONS.has(reason)) return MSG_SPECIAL_ADMIN_OPENER;
  if (TRANSITION_REASONS.has(reason)) return MSG_SPECIAL_ADMIN_TRANSITION;
  if (reason === 'readiness_timeout') return MSG_SPECIAL_ADMIN_READINESS_TIMEOUT;
  if (FRAME_REASONS.has(reason)) return MSG_SPECIAL_ADMIN_FRAME;
  if (reason === 'frame_origin_mismatch') return MSG_SPECIAL_ADMIN_FRAME_ORIGIN(input.liveOrigin);
  if (reason === 'extension_unavailable') return MSG_MANAGED_EXTENSION_UNAVAILABLE;
  if (reason === 'busy') return MSG_MANAGED_BUSY;
  if (OPEN_REASONS.has(reason)) return MSG_MANAGED_OPEN_FAILED;
  return MSG_MANAGED_FILL_FAILED;
}

/**
 * Digital Home end-user message. `credentials_incomplete` is handled by the tile's
 * existing missing-credentials UX before this engine runs.
 */
export function specialEndUserMessage(input: SpecialMessageInput): string {
  if (input.ok) return MSG_MANAGED_FILL_OK;
  const ended = fillRunEndMessage(input.reason, 'digital_home');
  if (ended) return ended;
  const reason = input.reason ?? '';
  if (reason === 'special_contract_invalid' || reason === 'entry_unresolved' || PLAN_REASONS.has(reason)) {
    return MSG_SPECIAL_DH_CONTRACT_INVALID;
  }
  if (PATTERN_REASONS.has(reason)) return MSG_SPECIAL_DH_PATTERN_UNSUPPORTED;
  if (reason === 'origin_mismatch') return MSG_SPECIAL_DH_ORIGIN_MISMATCH;
  if (OPENER_REASONS.has(reason) || reason === 'readiness_timeout' || FRAME_REASONS.has(reason)) {
    return MSG_SPECIAL_DH_SCREEN_NOT_OPENED;
  }
  if (reason === 'frame_origin_mismatch') return MSG_SPECIAL_DH_FRAME_ORIGIN;
  if (reason === 'extension_unavailable') return MSG_MANAGED_EXTENSION_UNAVAILABLE;
  if (reason === 'busy') return MSG_MANAGED_BUSY;
  if (OPEN_REASONS.has(reason)) return MSG_MANAGED_OPEN_FAILED;
  return MSG_MANAGED_FILL_FAILED;
}

export type SpecialAdminPresentationKind = 'success' | 'not_proven' | 'failure';

/**
 * A2 — Admin Test is a success only when the fill was verified AND the gesture
 * watch positively reported no trusted user gesture. Digital Home ignores this.
 */
export function specialAdminPresentation(input: SpecialMessageInput & { userGestureDuringRun?: boolean }): {
  kind: SpecialAdminPresentationKind;
  message: string;
} {
  if (!input.ok) return { kind: 'failure', message: specialAdminMessage(input) };
  if (input.userGestureDuringRun === true) {
    return { kind: 'not_proven', message: MSG_SPECIAL_ADMIN_NOT_PROVEN_GESTURE };
  }
  if (input.userGestureDuringRun !== false) {
    return { kind: 'not_proven', message: MSG_SPECIAL_ADMIN_NOT_PROVEN_NO_EVIDENCE };
  }
  return { kind: 'success', message: MSG_SPECIAL_ADMIN_FILL_OK };
}
