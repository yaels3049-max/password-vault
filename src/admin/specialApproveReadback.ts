/**
 * D-121-55 — «אשר מיפוי» (SPECIAL) succeeds only when the stored row, read back after the
 * write, resolves to SPECIAL with the version this approval wrote and the approved content.
 * A global-row update that RLS filters to zero rows returns no error, so the write result
 * alone never proves persistence.
 */
import { resolveActiveLoginContract, type LoginFlowPlanDocument } from '../loginContract';
import { planContentKey } from './mappingStatus';

export interface SpecialApproveReadbackInput {
  /** Stored row metadata read after the write (null/undefined → row not readable). */
  readBackMetadata: Record<string, unknown> | null | undefined;
  /** Whether the row itself was returned by the read-back. */
  rowFound: boolean;
  approvedDraft: LoginFlowPlanDocument;
  /** Active SPECIAL version before this approval (null when it was not SPECIAL). */
  previousSpecialVersion: number | null;
  write: {
    updatedRows: number | null;
    writerUserId: string;
    writtenSpecialVersion: number | null;
  };
}

export type SpecialApproveReadbackResult =
  | { ok: true; activePlanVersion: number; summary: string }
  | { ok: false; reason: string; summary: string };

export function verifySpecialApproveReadback(
  input: SpecialApproveReadbackInput,
): SpecialApproveReadbackResult {
  const { write } = input;
  const resolved = input.rowFound ? resolveActiveLoginContract(input.readBackMetadata ?? {}) : null;
  const readMode = !resolved
    ? 'row_not_found'
    : resolved.mode === 'SPECIAL'
      ? `SPECIAL v${resolved.activePlanVersion}`
      : resolved.mode === 'SPECIAL_INVALID'
        ? `SPECIAL_INVALID (${resolved.reason})`
        : 'STANDARD';
  const activationStored =
    input.rowFound &&
    input.readBackMetadata != null &&
    Object.prototype.hasOwnProperty.call(input.readBackMetadata, 'loginContractActivation');
  const summary = [
    `updatedRows=${write.updatedRows === null ? 'unknown' : write.updatedRows}`,
    `written=${write.writtenSpecialVersion === null ? 'not SPECIAL' : `SPECIAL v${write.writtenSpecialVersion}`}`,
    `readBack=${readMode}`,
    `activationStored=${activationStored ? 'yes' : 'no'}`,
    `writer=${write.writerUserId.slice(0, 8)}`,
  ].join('; ');
  const fail = (reason: string): SpecialApproveReadbackResult => ({
    ok: false,
    reason: `${reason} [${summary}]`,
    summary,
  });

  if (write.updatedRows === 0) {
    return fail('update matched 0 rows (no admin permission for this row, or row missing)');
  }
  if (write.writtenSpecialVersion === null) {
    return fail('write did not carry a SPECIAL activation');
  }
  if (
    input.previousSpecialVersion !== null &&
    write.writtenSpecialVersion <= input.previousSpecialVersion
  ) {
    return fail(
      `written version ${write.writtenSpecialVersion} is not above the previous ${input.previousSpecialVersion}`,
    );
  }
  if (!resolved) {
    return fail('row not found on read-back');
  }
  if (resolved.mode !== 'SPECIAL') {
    return fail(`read-back mode is ${readMode}, expected SPECIAL`);
  }
  if (resolved.activePlanVersion !== write.writtenSpecialVersion) {
    return fail(
      `read-back version ${resolved.activePlanVersion} differs from written ${write.writtenSpecialVersion}`,
    );
  }
  if (planContentKey(resolved.plan) !== planContentKey(input.approvedDraft)) {
    return fail('read-back active mapping differs from the approved mapping');
  }
  return { ok: true, activePlanVersion: resolved.activePlanVersion, summary };
}
