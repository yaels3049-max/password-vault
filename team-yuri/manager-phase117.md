# Manager Phase 117

## Phase Identifier
PHASE=117

## Status
STATUS: READY_FOR_DEVELOPER

**OPERATOR_APPROVAL: APPROVED** (2026-09-16) — Manager Detailed Design approved for Developer implementation.

Proceed per approved `arch-phase117.md` and this plan. All STOP conditions and Security gates remain binding. Production `validated` activation and real credential-bearing live validation remain **blocked** until Security Owner approval.

At completion: Developer returns full Phase 117 Implementation / Verification Report for Architecture review.

Architecture contract: `team-Yuri/arch-phase117.md` — **STATUS: APPROVED** (2026-09-16).

## Phase Goal
Deliver a **generic, administrator-managed, deterministic Autofill path** for simple single-page login forms.

For catalog services that the administrator has **explicitly configured and live-validated**, Digital Home opens the approved Login Entry and the browser extension fills **all** mapped credential fields by stable `field.id` → CSS locator, then verifies the fill. The user submits the external form manually.

**First vertical slice (configuration only, not a code fork):** Rivhit Online. Rivhit’s field IDs are **that service’s configured schema**, not the Managed Autofill engine’s required vocabulary.

**MVP product context:** Accounting firms. Universal Autofill across arbitrary websites is **not** required.

Managed Autofill must work for **any** simple single-page catalog service whose administrator configures and validates mappings for that service’s active credential `field.id` values.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=117` (confirmed)
- `team-Yuri/arch-phase117.md` — **APPROVED**; D-117-0 … D-117-16; AC-117-0 … AC-117-29; STOP conditions
- `team-Yuri/PLAN.md` §18 — Phase 117; changelog **5.47…5.49**
- Credential schema / modes: `arch-phase102.md`, `arch-phase107.md`
- Explicit Login Entry: `arch-phase108.md`
- Legacy generic Autofill: Phases 103 / 110 / 112 (retained; bypassed on Managed path)
- Launch Card / credential UX: `arch-phase113.md` (preserve copy unless Architecture amends)
- URL identity: Phase 116 (unchanged)

## Architecture Summary (binding decisions)

| Decision | Manager binding |
|---|---|
| **D-117-0** | Rivhit vertical-slice field-ID check — **E2E only**; not a generic vocabulary. Mismatch → STOP Rivhit validation; return to Architecture. |
| **D-117-1** | Configuration-driven; no Rivhit-specific executor/adapter |
| **D-117-2** | Stable `field.id` is the **only** join key |
| **D-117-16** | Schema-dynamic execution; adding another service = Admin config + validation only (AC-117-29) |
| **D-117-3** | Persist in `service_registry.metadata.autofillProfile` — no new table |
| **D-117-4** | CSS locators only (`locatorType: "css"`) |
| **D-117-5** | Exact-one visible editable input; else FAIL |
| **D-117-6** | Support states explicit: `not_configured` \| `validated` \| `unsupported`; transitions are deliberate Admin actions only |
| **D-117-7** | Structural vs live validation split; structural alone never sets `validated` |
| **D-117-15** | `validation.metadataVersion` must equal `configVersion` that was live-validated; security-relevant edits bump version and invalidate |
| **D-117-8** | Top-document-only inject (`frameIds: [0]` / `allFrames: false`) |
| **D-117-9** | Reuse `GenericFillExecutor`; bypass heuristics |
| **D-117-10** | Legacy Autofill retained for non-validated; no silent Managed→generic success fallback |
| **D-117-11** | No auto-submit |
| **D-117-12** | Security activation gate: plumbing vs production `validated` |
| **D-117-13** | Do not redefine `credentialMode`; do not change Phase 113 copy |
| **D-117-14** | `allowedOrigin` bound to Login Entry URL origin |

### Metadata contract (`metadata.autofillProfile`)

```text
autofillProfile: {
  supportState: 'not_configured' | 'validated' | 'unsupported'
  configVersion: number
  loginEntryUrl: string
  allowedOrigin: string
  fieldMappings: Array<{ fieldId, locatorType: 'css', locator }>
  validation?: {
    metadataVersion: number   // MUST equal configVersion that was live-validated
    validatedAt?: string
    validatedBy?: 'admin'
    resultSummary?: string    // non-secret only
  }
}
```

**Version / invalidation rules (D-117-15):**
1. Bump `configVersion` on any security-relevant change: `fieldMappings`, locator/locatorType, `loginEntryUrl`, `allowedOrigin`.
2. On approved live validation + explicit activation: stamp `validation.metadataVersion = configVersion`.
3. While `validated`, security-relevant edit → bump `configVersion` → transition to `unsupported`; do not leave effectively eligible.
4. Runtime Managed eligibility requires `supportState === 'validated'` **and** `validation.metadataVersion === configVersion` (+ credentialMode / complete credentials / mapping↔schema checks).
5. Version mismatch → not eligible (fail closed).

### Support-state transitions (explicit only)

| From | To | Allowed when |
|------|-----|--------------|
| `not_configured` | `validated` | Structural OK + approved live validation + explicit Admin activation |
| `validated` | `unsupported` | Explicit Admin disable **or** known-broken **or** security-relevant config change |
| `unsupported` | `validated` | Corrected config + approved live validation + explicit activation |

**Optional explicit reset to `not_configured`:** deliberate Admin control only — never a side effect of clearing/editing mappings.

**Forbidden:** implicit `any → not_configured` on mapping clear; remaining `validated` after security-relevant edit; inferring support from selectors/credentials/legacy success.

### Rivhit first configuration (vertical-slice data only — after D-117-0)

| fieldId | locatorType | locator |
|---------|-------------|---------|
| `username` | `css` | `#username` |
| `password` | `css` | `#password` |
| `business_id` | `css` | `#osek` |

- Login Entry: `https://online1.rivhit.co.il/loginmanager/login`
- Allowed origin: `https://online1.rivhit.co.il`
- Do not map `#remember`

These IDs must **not** appear in generic runtime eligibility, Hub Managed routing, or extension Managed executor hard-codes.

---

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| **M0** | **D-117-0 Rivhit field-ID check** | Live dump/verify Rivhit `login_fields` IDs vs known slice config. E2E gate only — **not** generic vocabulary | Match → proceed Rivhit E2E; mismatch → STOP Rivhit validation, Architecture | AC-117-0 |
| **M1** | Contract module | Pure TS parse / structural validate / plan write: `configVersion`, `validation.metadataVersion`, explicit support-state transitions; schema-dynamic joins | Unit tests for reject + version invalidation | AC-117-1, 3, 4, 18, 23–28 |
| **M2** | Admin API merge | Extend `updateGlobalRegistryRow` metadata merge; reject unknown fieldId / non-css / non-HTTPS / incomplete coverage | API unit tests PASS | AC-117-1…3, 23–28 |
| **M3** | Admin UI | Locator editor derived from `login_fields`; supportState display; structural validate before save | Admin can configure without inventing field IDs | AC-117-2, 4, 18 |
| **M4** | Extension Managed runner | Top-frame inject; mapping-driven fill via `GenericFillExecutor`; new message handler; no heuristics | Mock DOM tests: exact-one, origin, no submit | AC-117-6…11, 14, 19 |
| **M5** | Hub routing | Branch in `executeServiceFromTile` before legacy LI/generic; version-matched eligibility; no silent fallback | Routing unit/integration tests | AC-117-6, 12, 13, 17, 24 |
| **M6** | Automated test suite | Full matrix below incl. **synthetic non-Rivhit schema** (AC-117-29) | All required automated tests PASS | AC-117-0…29 (as applicable) |
| **M7** | Security package | Plumbing complete; document what awaits Security Owner | Security review package delivered | AC-117-20 |
| **M8** | Rivhit activation (gated) | Live validate + activate `validated` — **only after** M0 green + Security Owner approval | Runtime evidence; production gate status | AC-117-5, 15, 16, 20, 23 |

**Ship order:** M0 (when Rivhit E2E scheduled) → M1→M6 plumbing → M7 Security → M8 activation.  
Generic implementation (M1–M6) may proceed with synthetic schemas even if Rivhit E2E is deferred after M0 STOP — but Rivhit E2E and production `validated` must not proceed without M0 green + Security approval.

---

## Detailed Development Plan

### M0 — D-117-0 Rivhit vertical-slice field-ID check (E2E only)

**Purpose:** Precondition for using Rivhit as the first end-to-end validation service.

**Steps:**
1. Read live Rivhit global `service_registry` row `login_fields` (Admin/DB dump or Hub catalog load).
2. Compare IDs to known Rivhit test configuration: `username`, `password`, `business_id` (exact set).
3. Document dump in `dev-phase117.md` (or Architecture note if Rivhit E2E deferred).

**On mismatch:** **STOP Rivhit E2E validation**; return discrepancy to Architecture. No silent rename, repair, migration, or hard-code.

**On match:** Rivhit may be used as configuration evidence for E2E; still **must not** encode these IDs into generic Managed Autofill runtime.

**Not required for:** designing/testing the generic engine with synthetic schemas (M1–M6).

### M1 — Contract module (schema-dynamic)

**New module (suggested):** `src/autofill/validatedProfile.ts` (name flexible; mirror `src/service/credentialSchema.ts`).

Responsibilities:
- Parse `metadata.autofillProfile`
- Structural validation: fieldIds ⊆ active `login_fields`; css-only; HTTPS Login Entry; origin bind; required coverage
- Plan metadata writes: bump `configVersion` on security-relevant edits; enforce support-state / validation-version rules
- **No** fixed field-name lists (`username`/`password`/`business_id` must not be engine requirements)

### M2 — Admin API

**File:** `src/admin/adminRegistryApi.ts` — extend `updateGlobalRegistryRow` metadata merge for `autofillProfile`.

Reject: unknown `fieldId`, missing required mappings, non-`css` locatorType, non-HTTPS Login Entry.  
Enforce D-117-15 invalidation when merging over a previously `validated` profile.

### M3 — Admin UI

**Files:**
- `src/admin/RegistryAdmin.tsx` (global / `owner_user_id IS NULL` rows with `credentialMode === credential_fields`)
- Optional small locator editor component
- `src/admin/IntegrationStatusPanel.tsx` — surface `supportState`
- `src/admin/CredentialFieldsEditor.tsx` — **do not** invent a second field schema; locators derived from existing `login_fields`

Minimum capability:
1. List active credential fields (read-only ids/labels)
2. One CSS locator input per field (no free-typed `fieldId`)
3. Save profile (typically `not_configured` until live gate)
4. Show `supportState`
5. Structural validation before save — failures without activating `validated`
6. Optional explicit Admin reset to `not_configured` (dedicated control)
7. Optional (Security-gated for production): live validation with **throwaway test values** only

Tika owns final Hebrew copy after structural UI exists.

### M4 — Extension Managed runner

**Files:**
- New: `extension/generic/validated-autofill.js` (or managed-autofill) — thin deterministic runner
- `extension/background.js` — message handler; reuse `openGenericRealSiteTab` / URL readiness; **top-frame only** inject
- Reuse: `extension/generic/fill-executor.js` (`GenericFillExecutor`)
- `extension/manifest.json` — only if new script must be listed

**Bypass (do not delete):** `form-detector.js`, `field-mapper.js`, `generic-autofill.js`, identity-first, `allFrames: true` / `pickBestGenericFrameResult`

**Must not:** decide `supportState`; invent mappings; alter schema; submit form; branch on Rivhit/hostname/service-id; hard-code Rivhit selectors or field names.

### M5 — Hub routing

**Files:**
- `src/execution/serviceExecution.ts` — after site adapters, **before** legacy LI/generic:
  ```text
  IF supportState === 'validated'
     AND validation.metadataVersion === configVersion
     AND credentialMode === credential_fields
     AND credentials complete
     AND mappings cover required field.ids ⊆ active schema
  THEN Managed Autofill helper
  ELSE legacy behavior
  ```
- New Managed helper next to `src/execution/genericAutofill.ts`
- Entry remains `attemptExistingAutomaticCompletion` → `executeServiceFromTile` (`src/loginAssistance/assistanceActions.ts` only if eligibility wiring needed)

On Managed failure: structured failure; **never** call `executeGenericAutofill` as silent success fallback.

### M6 — Automated tests + verify script

- `scripts/verifyPhase117*.mjs` (or project pattern) + unit/integration tests covering the Test Plan below
- **Required:** synthetic non-Rivhit schema fixture (e.g. `customer_number` + `pin` → `#customer-number`, `#pin`) proving AC-117-29
- Do **not** create a production catalog service solely for the genericity test

### M7 — Security package

Document Security Owner review package covering:
- Admin-only mapping modification (RLS + UI)
- Server-authoritative mapping / `supportState`
- Login Entry + origin binding
- Selector-controlled injection
- Plaintext Hub→extension transfer (document; do not claim ZK)
- Extension host permissions
- Top-document / frame enforcement
- Live validation (test values only)
- Configuration tampering resistance
- No credential values in logs/telemetry

### M8 — Production Rivhit activation (gated)

**May implement before Security approval (plumbing):** M1–M6 as listed in arch “May implement before Security Owner approval”.

**Must wait for Security Owner approval:**
- Production transition to `supportState: validated`
- Admin live validation that injects into real Rivhit origin in production
- Host-permission policy changes beyond current baseline

Do not fake validation to close the phase.

---

## File / Module Mapping (Admin · Hub · Extension)

| Area | Path | Milestone |
|------|------|-----------|
| Contract (new) | `src/autofill/validatedProfile.ts` | M1 |
| Admin API | `src/admin/adminRegistryApi.ts` | M2 |
| Admin UI | `src/admin/RegistryAdmin.tsx`, optional editor, `IntegrationStatusPanel.tsx` | M3 |
| Credential schema (read) | `src/service/credentialSchema.ts`, `CredentialFieldsEditor.tsx` | M3 (consume; don’t fork schema) |
| Registry read | `src/registry/registryMapper.ts`, `registryLoader.ts` | M5 (metadata pass-through) |
| Hub execution | `src/execution/serviceExecution.ts`, new Managed helper | M5 |
| Launch wiring | `src/loginAssistance/assistanceActions.ts` | M5 (only if needed) |
| Extension runner (new) | `extension/generic/*validated*autofill*.js` | M4 |
| Fill executor (reuse) | `extension/generic/fill-executor.js` | M4 |
| Background | `extension/background.js` | M4 |
| Manifest | `extension/manifest.json` | M4 (if required) |
| Verify / tests | `scripts/verifyPhase117*.mjs` + unit tests | M6 |

**Do not modify:** encryption/vault/key modules; Phase 116 identity; Login Discovery; Phase 113 Launch Card copy; site adapters for Rivhit (`adapter_id` must not be Rivhit’s delivery path).

---

## Security Gate (plumbing vs production)

| Layer | Allowed before Security Owner approval | Blocked until approval |
|-------|----------------------------------------|------------------------|
| Metadata contract + structural validation | Yes | — |
| Admin locator UI (save as `not_configured`) | Yes | — |
| Hub routing (only activates when `validated`) | Yes (feature-safe) | — |
| Extension Managed executor + mock DOM tests | Yes | — |
| Test/mock-value validation harness | Yes | — |
| Production `supportState: validated` | — | **Blocked** |
| Live inject into real Rivhit origin in production | — | **Blocked** |
| Host-permission expansion | — | **Blocked** |

**AC-117-20:** Production `validated` activation remains Security-gated. Do not fake validation.

---

## Acceptance / Gating Criteria (AC-117-0 … AC-117-29)

| ID | Criterion | Milestone |
|----|-----------|-----------|
| AC-117-0 | Before Rivhit E2E, live Rivhit field IDs match known config; not generic vocabulary | M0 |
| AC-117-1 | Profile in `service_registry.metadata` without new table | M1–M2 |
| AC-117-2 | Admin CSS locator per active field; no foreign field IDs | M3 |
| AC-117-3 | Structural validation: schema join, HTTPS, origin, css-only, coverage | M1–M3 |
| AC-117-4 | Structural pass alone never sets `validated` | M1–M3 |
| AC-117-5 | `validated` requires approved live validation + explicit activation | M8 |
| AC-117-6 | Validated path sends explicit mappings; no heuristic mapper | M4–M5 |
| AC-117-7 | Reuse `GenericFillExecutor`; never auto-submit | M4 |
| AC-117-8 | Top-document-only; Rivhit hidden iframe not written | M4 |
| AC-117-9 | Exact-one visible editable input or fail | M4 |
| AC-117-10 | Partial fill cannot report success | M4 |
| AC-117-11 | Wrong origin fails | M4 |
| AC-117-12 | Managed failure must not silent-fallback to generic success | M5 |
| AC-117-13 | Non-validated services retain legacy Autofill | M5 |
| AC-117-14 | No Rivhit-specific adapter / hardcoded fill branch | M4–M5 |
| AC-117-15 | Rivhit config: `business_id` → `#osek` without renaming vault field id | M8 / config |
| AC-117-16 | Rivhit config: `#remember` never filled | M4 / M8 |
| AC-117-17 | Missing-credentials / NOT_CONFIGURED / NO_STORED_CREDENTIALS preserved | M5 |
| AC-117-18 | `supportState` does not redefine `credentialMode` | M1–M3 |
| AC-117-19 | No credential values in logs/errors/telemetry | All |
| AC-117-20 | Production `validated` remains Security-gated | M7–M8 |
| AC-117-21 | Build/lint/tests required by this plan pass | M6 |
| AC-117-22 | Phase 113 Launch Card copy unchanged | M5 (affirm) |
| AC-117-23 | Live validation stamps `validation.metadataVersion = configVersion` | M1 / M8 |
| AC-117-24 | Runtime requires version match; mismatch not eligible | M1 / M5 |
| AC-117-25 | Changing validated locator/mappings invalidates prior eligibility | M1–M2 |
| AC-117-26 | Changing Login Entry / `allowedOrigin` invalidates prior eligibility | M1–M2 |
| AC-117-27 | Clearing/editing mappings cannot silently preserve `validated` | M1–M2 |
| AC-117-28 | `not_configured` only via explicit Admin reset — not mapping-clear side effect | M1–M3 |
| AC-117-29 | Genericity: different schema needs config only — synthetic non-Rivhit test required | M6 |

**Hard gates:** AC-117-0 (Rivhit E2E), AC-117-20 (Security), AC-117-29 (genericity). Failure of AC-117-29 = architectural failure of Phase 117 genericity.

---

## Automated Test Plan (maps to AC-117-0 … AC-117-29)

| # | Test | AC |
|---:|---|---|
| T0 | Rivhit vertical-slice field-ID check (fixture or live read gate for Rivhit E2E only) | AC-117-0 |
| T1 | Valid mapping accepted | AC-117-1, 3 |
| T2 | Unknown `field.id` rejected | AC-117-2, 3 |
| T3 | Missing required mapping rejected | AC-117-3 |
| T4 | Wrong origin rejected | AC-117-11 |
| T5 | Non-HTTPS Login Entry / invalid config rejected | AC-117-3 |
| T6 | Selector zero-match fails | AC-117-9 |
| T7 | Selector multi-match fails | AC-117-9 |
| T8 | Hidden target rejected | AC-117-9 |
| T9 | Non-editable target rejected | AC-117-9 |
| T10 | Partial fill is NOT success | AC-117-10 |
| T11 | Rivhit config: `username` fills and verifies (slice evidence) | AC-117-15 path |
| T12 | Rivhit config: `password` fills and verifies | — |
| T13 | Rivhit config: `business_id` fills and verifies | AC-117-15 |
| T14 | Rivhit config: `#remember` remains untouched | AC-117-16 |
| T15 | Hidden Rivhit iframe remains untouched (top-frame-only) | AC-117-8 |
| T16 | Submit is never invoked | AC-117-7 |
| T17 | Validated path does not invoke generic mapper | AC-117-6 |
| T18 | Non-validated service retains legacy behavior | AC-117-13 |
| T19 | Missing-user-credentials behavior preserved | AC-117-17 |
| T20 | Credential values do not appear in logs/errors | AC-117-19 |
| T21 | Runtime Managed eligibility requires `validation.metadataVersion === configVersion` | AC-117-24 |
| T22 | Changing a validated selector bumps config version; cannot execute under old validation | AC-117-25 |
| T23 | Changing Login Entry / `allowedOrigin` bumps version; cannot execute under old validation | AC-117-26 |
| T24 | Clearing/changing mappings cannot silently preserve `validated` eligibility | AC-117-27 |
| T25 | Reset to `not_configured` only via explicit Admin state transition | AC-117-28 |
| T26 | Structural pass alone never sets `validated` | AC-117-4 |
| T27 | No Rivhit hostname/service-ID/field-name hard-code in Managed Hub/extension | AC-117-14, 29 |
| T28 | **Genericity (required):** synthetic schema e.g. `customer_number`+`pin` with `#customer-number`/`#pin` — same engine, dynamic schema, no Rivhit field assumptions, no service-specific code | AC-117-29 |
| T29 | Build / lint / verify script PASS | AC-117-21 |

**Critical for phase genericity:** T28 (AC-117-29). **Critical for Rivhit E2E:** T0. **Critical for security eligibility:** T21–T25.

---

## Functional Testability Criteria

- **Page/screen:** Admin Registry (global Rivhit row as first slice); Digital Home Launch Card for a validated service.
- **User-visible behavior:** After `validated` + complete credentials + version match, Autofill populates that service’s mapped fields; user submits externally.
- **Command-line:** `node scripts/verifyPhase117*.mjs` (or equivalent); unit test runner; `npm run build`.
- **Minimal end-to-end flow:** Admin maps CSS locators from active schema → (Security-approved) live validate → activate → user Autofill → all required fields verified → manual submit.
- **Expected observable result:** Deterministic fill without heuristic mapping; no submit by extension; legacy services unchanged; synthetic non-Rivhit schema works via the same engine.

### Runtime verification (post-Security, after M0 green)

1. Admin configures Rivhit locators; structural OK; state remains non-`validated` until live gate.
2. Live validate with throwaway values on Login Entry; all three fields verify; no submit; hidden iframe empty.
3. Activate `validated` (stamps `validation.metadataVersion = configVersion`).
4. Digital Home user with complete Rivhit credentials: Managed fill; user submits manually.
5. Incomplete credentials: existing missing-credentials flow.
6. Non-validated catalog service: legacy Autofill.
7. Change a locator after `validated`: state → `unsupported` / not eligible until re-validation.

---

## STOP Conditions (from Architecture — non-negotiable)

| Condition | Action |
|-----------|--------|
| D-117-0 Rivhit configuration mismatch | **STOP** Rivhit E2E validation; return to Architecture (do not hard-code field names into the engine) |
| Proposal to hard-code Rivhit / hostname / service-ID / fixed field-name assumptions into Managed Autofill | **STOP** |
| Proposal to rename/migrate Rivhit field IDs silently | **STOP** |
| Proposal to remove legacy Autofill in 117 | **STOP** |
| Proposal to auto-submit or add iframe automation | **STOP** |
| Setting `validated` without live validation / Security approval | **STOP** |
| Remaining effectively validated after security-relevant Autofill config change | **STOP** |
| Implicit `not_configured` reset as a side effect of clearing mappings | **STOP** |
| Silent fallback from Managed failure to generic success | **STOP** |
| Rivhit-specific adapter as the delivery mechanism | **STOP** |
| Code contradiction requiring architecture change | Return to Architecture |

Manager **must reject** Developer COMPLETE that violates any STOP condition.

---

## Required Developer Evidence

When implementation is authorized (after this plan is approved), `team-Yuri/dev-phase117.md` must include:

| Evidence area | Required content |
|---|---|
| M0 / D-117-0 | Precondition dump for Rivhit E2E, **or** Architecture note if Rivhit E2E deferred |
| Metadata sample | Rivhit `autofillProfile` (redacted) as configuration evidence only |
| Automated tests | Full T0–T29 coverage notes; **synthetic non-Rivhit schema** proof (AC-117-29) |
| Version invalidation | Tests for T21–T25 / AC-117-23…28 |
| Runtime notes | Admin config; Rivhit fill; `#remember` empty; no submit; top-frame only |
| Post-edit eligibility | Changing locator after `validated` blocks Managed until re-validation |
| Affirmations | Validated path does not call `mapLoginFields` / `runGenericAutofill` |
| Affirmations | Managed Hub/extension contains no Rivhit field-ID / hostname / service-ID fill hard-coding |
| Security gate | What is implemented vs what awaits Security Owner for production `validated` |
| Scope affirmations | No encryption / Phase 116 / discovery changes; no Phase 113 copy changes |
| Build | `npm run build` (+ lint/tests) **PASS** |

---

## Out of Scope

- Modal / multi-step / OTP / CAPTCHA automation
- Automatic submit
- General iframe automation
- Automatic selector discovery / AI mapping
- XPath / shadow DOM / automation DSL
- Login Discovery
- Phase 116 URL identity changes
- Removal of legacy Autofill
- Credential encryption / key-management redesign
- Custom-service Autofill optimization
- General website automation designer UI
- Phase 113 Launch Card copy changes
- Encoding Rivhit field names into generic Managed Autofill runtime
- Production `validated` before Security Owner approval

---

## Risks / Open Questions

| Risk | Mitigation |
|------|------------|
| Live Rivhit row not verified | M0 / AC-117-0 before Rivhit E2E |
| Accidental Rivhit field-name hard-coding | D-117-16 / AC-117-29 / T28 |
| Hidden duplicate iframe | Top-frame-only (D-117-8) |
| Meta-refresh splash `online1.rivhit.co.il/` | Bind Login Entry to `/loginmanager/login` |
| Confusion `credentialMode` vs `supportState` | Namespaced `autofillProfile.supportState` |
| Stale validation after edit | D-117-15 / AC-117-23…28 |
| Row `metadata_version` vs Autofill `configVersion` | Eligibility keyed to `autofillProfile.configVersion` only |
| Phase 112 LI for non-validated | Managed branch short-circuits before LI when version-matched validated |
| Scheduling production activation too early | M7 before M8; AC-117-20 |

---

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes
- PHASE.md confirmed `PHASE=117`.
- Detailed Design derived from **APPROVED** `arch-phase117.md` (2026-09-16) + PLAN AC-117-0…29 (changelog 5.47–5.49).
- **OPERATOR_APPROVAL: APPROVED** — hand off to Sarah (Developer).
- Security gate unchanged: plumbing OK; production `validated` + real credential-bearing live validation blocked until Security Owner approval.
- On Developer COMPLETE: Manager reviews evidence; Architecture reviews full Implementation / Verification Report.

### Required Corrections
_None at approval._
