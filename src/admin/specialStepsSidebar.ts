/**
 * Phase 122.3 — multi-step layout (presentation only): the «שלבי התהליך» sidebar items and
 * the step fields table copy. Pure; reads the draft, never changes it.
 */
import type { LoginFlowPlanDocument } from '../loginContract';
import { actionSelected, stepButtonView, stepLabelHe } from './specialActionBar';

export const SPECIAL_STEPS_LAYOUT_HE = {
  sidebarTitle: 'שלבי התהליך',
  fieldsTitle: 'שדות השלב',
  columnField: 'שדה',
  columnMapping: 'מיפוי',
  columnActions: 'פעולות',
  mappedCount: (mapped: number, total: number): string => `${mapped}/${total} שדות`,
  buttonChosen: 'כפתור נבחר',
  buttonPending: 'ממתין לבדיקה',
  noButton: 'אין כפתור',
  lastStep: 'שלב אחרון',
} as const;

export type StepButtonState = 'chosen' | 'pending' | 'none' | 'last';

export interface StepsSidebarItem {
  stepId: string;
  label: string;
  mapped: number;
  buttonState: StepButtonState;
  summary: string;
}

const BUTTON_STATE_HE: Record<StepButtonState, string> = {
  chosen: SPECIAL_STEPS_LAYOUT_HE.buttonChosen,
  pending: SPECIAL_STEPS_LAYOUT_HE.buttonPending,
  none: SPECIAL_STEPS_LAYOUT_HE.noButton,
  last: SPECIAL_STEPS_LAYOUT_HE.lastStep,
};

/** One item per draft step, in draft order; the short status = mapped login fields · step button. */
export function stepsSidebarItems(
  draft: LoginFlowPlanDocument,
  loginFieldIds: ReadonlyArray<string>,
): StepsSidebarItem[] {
  return draft.steps.map((step, index) => {
    const mapped = step.fieldMappings.filter((m) => {
      const mapping = m as { fieldId?: string; locator?: string };
      return Boolean(mapping.locator) && loginFieldIds.includes(mapping.fieldId ?? '');
    }).length;
    const view = stepButtonView(draft, step.stepId);
    const buttonState: StepButtonState =
      view?.kind === 'exit'
        ? actionSelected(view.exit)
          ? 'chosen'
          : 'pending'
        : view?.kind === 'last'
          ? 'last'
          : 'none';
    return {
      stepId: step.stepId,
      label: stepLabelHe(index),
      mapped,
      buttonState,
      summary: `${SPECIAL_STEPS_LAYOUT_HE.mappedCount(mapped, loginFieldIds.length)} · ${BUTTON_STATE_HE[buttonState]}`,
    };
  });
}
