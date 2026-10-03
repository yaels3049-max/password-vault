/**
 * D-121-45 — cross-cutting «אופי הכניסה» grid: pattern selector + explanation + the
 * shared status line (D-121-43) of the selected pattern + «פרטים טכניים».
 * No authoring controls; the mapping grids below hold those.
 */
import { useMemo } from 'react';
import type { AdminRegistryRow } from './adminRegistryApi';
import {
  AUTOFILL_SUPPORT_STATE_LABEL_HE,
  readAutofillProfileFromMetadata,
} from '../autofill/validatedProfile';
import {
  LOGIN_PATTERN_LABEL_HE,
  isSpecialLoginPattern,
  resolveActiveLoginContract,
  resolveSpecialAuthoringEntry,
  type AuthoringLoginPattern,
} from '../loginContract';
import { ADMIN_GRID_COPY_HE } from './mappingCopy';
import { PATTERN_CHANGE_HE } from './patternChange';
import { specialMappingStatus, standardMappingStatus } from './mappingStatus';
import MappingStatusLine from './MappingStatusLine';

interface Props {
  row: AdminRegistryRow;
  pattern: AuthoringLoginPattern;
  onPatternChange: (pattern: AuthoringLoginPattern) => void;
  /** The visible mapping grid is busy (same lock the selector had inside the SPECIAL editor). */
  disabled?: boolean;
  /** Phase 122.5 R2 — the chooser shows only after «שינוי אופי הכניסה» (the parent may warn first). */
  chooserOpen?: boolean;
  onRequestChange?: () => void;
  onCloseChooser?: () => void;
}

/** Phase 122.3 — «שילוב» (floating + multi-step) is shown for orientation only; never selectable. */
const PATTERN_BLOCKED_NOTE_HE = 'לא זמין כעת';
function patternBlocked(pattern: AuthoringLoginPattern): boolean {
  return pattern === 'FLOATING_SCREEN_MULTI_STEP';
}

function SpecialTechnical({ row }: { row: AdminRegistryRow }) {
  const entry = resolveSpecialAuthoringEntry({
    primaryUrl: row.primary_url,
    loginUrl: row.login_url,
    metadata: row.metadata,
  });
  const active = resolveActiveLoginContract(row.metadata ?? {});
  return (
    <p className="admin-muted" data-status="special-technical">
      משטח כניסה:{' '}
      <strong>
        {entry.ok ? (entry.entryType === 'primary_page' ? 'דף הבית' : 'כתובת כניסה ייעודית') : 'לא זמין'}
      </strong>
      {entry.ok ? (
        <>
          {' · '}
          <code dir="ltr">{entry.authoringUrl}</code>
        </>
      ) : null}
      {' · '}
      פעיל כעת:{' '}
      <strong>
        {active.mode === 'SPECIAL'
          ? `SPECIAL v${active.activePlanVersion}`
          : active.mode === 'SPECIAL_INVALID'
            ? 'SPECIAL לא תקין'
            : 'STANDARD'}
      </strong>
    </p>
  );
}

function StandardTechnical({ row }: { row: AdminRegistryRow }) {
  const state = readAutofillProfileFromMetadata(row.metadata)?.supportState ?? null;
  return (
    <p className="admin-muted" data-status="standard-technical">
      מצב תמיכה: <strong>{AUTOFILL_SUPPORT_STATE_LABEL_HE[state ?? 'not_configured']}</strong>
    </p>
  );
}

export default function LoginPatternGrid({
  row,
  pattern,
  onPatternChange,
  disabled = false,
  chooserOpen = false,
  onRequestChange,
  onCloseChooser,
}: Props) {
  const special = isSpecialLoginPattern(pattern);
  const status = useMemo(
    () => (special ? specialMappingStatus(row.metadata) : standardMappingStatus(row.metadata)),
    [special, row.metadata],
  );
  return (
    <section className="admin-panel admin-login-pattern" data-grid="login-pattern">
      <h3 className="admin-panel-title">{ADMIN_GRID_COPY_HE.loginPatternTitle}</h3>
      <p className="admin-panel-hint">{ADMIN_GRID_COPY_HE.loginPatternHint}</p>
      <div className="admin-pattern-summary" data-part="login-pattern-summary">
        <span>
          {PATTERN_CHANGE_HE.summaryLabel} <strong data-status="login-pattern">{LOGIN_PATTERN_LABEL_HE[pattern]}</strong>
        </span>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          data-action="change-login-pattern"
          aria-expanded={chooserOpen}
          disabled={disabled}
          onClick={onRequestChange}
        >
          {PATTERN_CHANGE_HE.change}
        </button>
      </div>
      <fieldset
        className="admin-pattern-radios"
        data-action="login-pattern"
        disabled={disabled}
        hidden={!chooserOpen}
        aria-label={ADMIN_GRID_COPY_HE.loginPatternTitle}
      >
        <legend className="admin-sr-only">{ADMIN_GRID_COPY_HE.loginPatternTitle}</legend>
        {(Object.keys(LOGIN_PATTERN_LABEL_HE) as AuthoringLoginPattern[]).map((key) => {
          const blocked = patternBlocked(key);
          return (
            <label
              key={key}
              className={`admin-pattern-radio${pattern === key ? ' is-selected' : ''}${blocked ? ' is-blocked' : ''}`}
              data-pattern={key}
            >
              <input
                type="radio"
                name={`login-pattern-${row.id}`}
                value={key}
                checked={pattern === key}
                disabled={blocked}
                onChange={() => {
                  if (!blocked) onPatternChange(key);
                }}
              />
              <span>{LOGIN_PATTERN_LABEL_HE[key]}</span>
              {blocked ? <small className="admin-muted">{PATTERN_BLOCKED_NOTE_HE}</small> : null}
            </label>
          );
        })}
        <p className="admin-field-hint admin-pattern-chooser-hint">{PATTERN_CHANGE_HE.chooserHint}</p>
        <button
          type="button"
          className="admin-btn admin-btn-ghost admin-pattern-chooser-close"
          data-action="close-login-pattern"
          onClick={onCloseChooser}
        >
          {PATTERN_CHANGE_HE.closeChooser}
        </button>
      </fieldset>
      <MappingStatusLine
        status={status}
        technical={special ? <SpecialTechnical row={row} /> : <StandardTechnical row={row} />}
      />
    </section>
  );
}
