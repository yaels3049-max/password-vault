/**
 * Phase 120.8 — current per-field authoring provenance (facts only).
 * Admin authoring metadata; Managed Runtime must ignore this bag.
 */

export type FieldAuthoringSource = 'analyze' | 'visual_mapping' | 'manual';
export type FieldAuthoringConfidence = 'high' | 'medium' | null;

export interface FieldAuthoringEntry {
  fieldId: string;
  source: FieldAuthoringSource;
  /** Non-null only when source === 'analyze'. */
  confidence: FieldAuthoringConfidence;
  observedInputId?: string | null;
  visualMappingVerified: boolean;
  adminTestPassedAtConfigVersion?: number | null;
}

export const CONFIDENCE_HIGH_LABEL_HE = 'ביטחון גבוה';
export const CONFIDENCE_MEDIUM_LABEL_HE = 'ביטחון בינוני';
export const CONFIDENCE_MEDIUM_REVIEW_HINT_HE = 'דורש בדיקת מנהל';
export const VISUAL_VERIFIED_LABEL_HE = 'אומת במיפוי חזותי';
export const MANUAL_EDITED_LABEL_HE = 'נערך ידנית';
export const ADMIN_TEST_PASSED_LABEL_HE = 'נבדק בהצלחה';

export function parseFieldAuthoringBag(raw: unknown): FieldAuthoringEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: FieldAuthoringEntry[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const fieldId = typeof record.fieldId === 'string' ? record.fieldId.trim() : '';
    if (!fieldId || seen.has(fieldId)) continue;
    const source = record.source;
    if (source !== 'analyze' && source !== 'visual_mapping' && source !== 'manual') {
      continue;
    }
    let confidence: FieldAuthoringConfidence = null;
    if (source === 'analyze') {
      if (record.confidence === 'high' || record.confidence === 'medium') {
        confidence = record.confidence;
      } else {
        confidence = null;
      }
    }
    const visualMappingVerified = record.visualMappingVerified === true;
    const observedInputId =
      typeof record.observedInputId === 'string' && record.observedInputId.trim()
        ? record.observedInputId.trim()
        : record.observedInputId === null
          ? null
          : undefined;
    let adminTestPassedAtConfigVersion: number | null | undefined;
    if (
      typeof record.adminTestPassedAtConfigVersion === 'number' &&
      Number.isInteger(record.adminTestPassedAtConfigVersion)
    ) {
      adminTestPassedAtConfigVersion = record.adminTestPassedAtConfigVersion;
    } else if (record.adminTestPassedAtConfigVersion === null) {
      adminTestPassedAtConfigVersion = null;
    }
    const row: FieldAuthoringEntry = {
      fieldId,
      source,
      confidence,
      visualMappingVerified,
    };
    if (observedInputId !== undefined) {
      row.observedInputId = observedInputId;
    }
    if (adminTestPassedAtConfigVersion !== undefined) {
      row.adminTestPassedAtConfigVersion = adminTestPassedAtConfigVersion;
    }
    out.push(row);
    seen.add(fieldId);
  }
  return out;
}

export function serializeFieldAuthoringBag(
  entries: FieldAuthoringEntry[] | undefined,
): FieldAuthoringEntry[] | undefined {
  if (!entries || entries.length === 0) {
    return undefined;
  }
  return entries.map((entry) => {
    const row: FieldAuthoringEntry = {
      fieldId: entry.fieldId,
      source: entry.source,
      confidence: entry.source === 'analyze' ? entry.confidence : null,
      visualMappingVerified: entry.visualMappingVerified === true,
    };
    if (entry.observedInputId !== undefined) {
      row.observedInputId = entry.observedInputId;
    }
    if (entry.adminTestPassedAtConfigVersion !== undefined) {
      row.adminTestPassedAtConfigVersion = entry.adminTestPassedAtConfigVersion;
    }
    return row;
  });
}

/** Keep authoring rows that still have a non-empty mapping locator. */
export function pruneFieldAuthoringToMappings(
  authoring: FieldAuthoringEntry[] | undefined,
  fieldMappings: Array<{ fieldId: string; locator: string }>,
): FieldAuthoringEntry[] {
  const active = new Set(
    fieldMappings
      .filter((m) => m.fieldId.trim() && m.locator.trim())
      .map((m) => m.fieldId.trim()),
  );
  return (authoring ?? []).filter((row) => active.has(row.fieldId));
}

export function upsertFieldAuthoring(
  current: FieldAuthoringEntry[],
  next: FieldAuthoringEntry,
): FieldAuthoringEntry[] {
  const without = current.filter((row) => row.fieldId !== next.fieldId);
  return [...without, next];
}

export function markManualEdit(
  current: FieldAuthoringEntry[],
  fieldId: string,
): FieldAuthoringEntry[] {
  return upsertFieldAuthoring(current, {
    fieldId,
    source: 'manual',
    confidence: null,
    visualMappingVerified: false,
    adminTestPassedAtConfigVersion: null,
  });
}

/**
 * Visual Mapping SAME-target (120.9): E1 or E3 only.
 * E2 (current ∈ visualLocatorCandidates) removed — candidate membership is not
 * determinism and must not preserve a non-unique Analyze locator.
 * Locator persistence is always Visual's verified unique (Hub apply path).
 */
export function visualTargetsEquivalent(input: {
  currentLocator: string;
  currentObservedInputId?: string | null;
  visualLocator: string;
  visualObservedInputId?: string | null;
  /** Ignored (120.9) — retained for call-site compatibility only. */
  visualLocatorCandidates?: string[];
}): boolean {
  const current = input.currentLocator.trim();
  const visual = input.visualLocator.trim();
  if (!current || !visual) {
    return false;
  }
  const curObs = (input.currentObservedInputId ?? '').trim();
  const visObs = (input.visualObservedInputId ?? '').trim();
  // E1 — same observed input identity
  if (curObs && visObs && curObs === visObs) {
    return true;
  }
  // E3 — current locator already equals Visual verified unique
  if (current === visual) {
    return true;
  }
  return false;
}

export function applyVisualMappingAuthoring(input: {
  current: FieldAuthoringEntry[];
  fieldId: string;
  sameTarget: boolean;
  previous?: FieldAuthoringEntry;
  visualObservedInputId?: string | null;
}): FieldAuthoringEntry[] {
  if (input.sameTarget) {
    const prev = input.previous;
    return upsertFieldAuthoring(input.current, {
      fieldId: input.fieldId,
      source: prev?.source ?? 'visual_mapping',
      confidence: prev?.source === 'analyze' ? (prev.confidence ?? null) : null,
      observedInputId: input.visualObservedInputId ?? prev?.observedInputId ?? null,
      visualMappingVerified: true,
      adminTestPassedAtConfigVersion: prev?.adminTestPassedAtConfigVersion ?? null,
    });
  }
  return upsertFieldAuthoring(input.current, {
    fieldId: input.fieldId,
    source: 'visual_mapping',
    confidence: null,
    observedInputId: input.visualObservedInputId ?? null,
    visualMappingVerified: true,
    adminTestPassedAtConfigVersion: null,
  });
}

export function stampAdminTestPassed(
  current: FieldAuthoringEntry[],
  fieldIds: string[],
  configVersion: number,
): FieldAuthoringEntry[] {
  let next = [...current];
  for (const fieldId of fieldIds) {
    const prev = next.find((row) => row.fieldId === fieldId);
    next = upsertFieldAuthoring(next, {
      fieldId,
      source: prev?.source ?? 'manual',
      confidence: prev?.source === 'analyze' ? prev.confidence : null,
      observedInputId: prev?.observedInputId ?? null,
      visualMappingVerified: prev?.visualMappingVerified === true,
      adminTestPassedAtConfigVersion: configVersion,
    });
  }
  return next;
}

export function adminTestSuccessVisible(
  entry: FieldAuthoringEntry | undefined,
  configVersion: number,
): boolean {
  return (
    typeof entry?.adminTestPassedAtConfigVersion === 'number' &&
    entry.adminTestPassedAtConfigVersion === configVersion
  );
}
