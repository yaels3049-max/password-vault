/**
 * D-121-63 — the exact validateSpecialPlan.ts edits (action-only MULTI_STEP step + readiness
 * into it = that step's exit), as [new, old] pairs.
 */
export const D12163_VALIDATOR_EDITS = [
  [
    `/**
 * D-121-63 A: a MULTI_STEP step other than the first and the last may have no field
 * mappings when it has an intermediate_transition exit (a choice screen).
 */
export function isActionOnlyStep(plan: LoginFlowPlanDocument, index: number): boolean {
  const step = plan.steps[index];
  return (
    plan.pattern === 'MULTI_STEP' &&
    index > 0 &&
    index < plan.steps.length - 1 &&
    Array.isArray(step?.fieldMappings) &&
    step!.fieldMappings.length === 0 &&
    step!.exitTransition?.kind === 'intermediate_transition'
  );
}

function validateAction(
  action: FlowAction,
  revealedStepMappings: SpecialFieldMapping[] | null,
  revealedStepExit: FlowAction | null = null,
): SpecialPlanValidation {`,
    `function validateAction(
  action: FlowAction,
  revealedStepMappings: SpecialFieldMapping[] | null,
): SpecialPlanValidation {`,
  ],
  [
    `  // D-121-63 B: into an action-only step, readiness = that step's exit (locator + frame).
  const declared =
    revealedStepMappings !== null && revealedStepMappings.length === 0 && revealedStepExit
      ? action.readiness.locator === revealedStepExit.locator &&
        sameFrame(action.readiness.frame, revealedStepExit.frame)
      : (revealedStepMappings ?? []).some(
          (m) => m.locator === action.readiness.locator && sameFrame(m.frame, action.readiness.frame),
        );`,
    `  const declared = (revealedStepMappings ?? []).some(
    (m) => m.locator === action.readiness.locator && sameFrame(m.frame, action.readiness.frame),
  );`,
  ],
  [
    `  for (let s = 0; s < plan.steps.length; s += 1) {
    const step = plan.steps[s]!;
    if (isActionOnlyStep(plan, s)) {
      stepMappings.push([]);
      continue;
    }
    if (!step.fieldMappings || step.fieldMappings.length === 0) return fail('emptyFieldMappings');`,
    `  for (const step of plan.steps) {
    if (!step.fieldMappings || step.fieldMappings.length === 0) return fail('emptyFieldMappings');`,
  ],
  [
    `      const exitOk = validateAction(exit, stepMappings[i + 1] ?? null, plan.steps[i + 1]?.exitTransition ?? null);`,
    `      const exitOk = validateAction(exit, stepMappings[i + 1] ?? null);`,
  ],
];

/** Revert the D-121-63 validator edits; throws unless each edit is present exactly once. */
export function revertD12163ValidatorEdits(src) {
  let out = src;
  for (const [next, prev] of D12163_VALIDATOR_EDITS) {
    const n = out.split(next).length - 1;
    if (n !== 1) throw new Error(`D-121-63 validator edit present ${n}× (expected 1): ${next.slice(0, 80)}`);
    out = out.replace(next, () => prev);
  }
  return out;
}
