# Architecture Phase 117

## Phase Identifier
PHASE=117

## Status
STATUS: READY_FOR_MANAGER

AMENDED: 2026-09-15 — Architecture review corrections: (1) remove implicit any→`not_configured` reset; state transitions are explicit only; (2) bind live validation to `validation.metadataVersion` / Managed Autofill config version; (3) AC/tests for stale-validation rejection.

Implementation must not start until Architecture (and CEO if required) accept this contract. Do not hand this phase to the Developer from an unapproved draft.

Manager Detailed Design may proceed only after this document is approved. Developer implementation may proceed only after Manager plan approval **and** the Rivhit field-ID precondition (D-117-0) passes.

## Title
Phase 117 — Managed Autofill: Deterministic Single-Page Mapping

## Phase Goal
Deliver a **generic, administrator-managed, deterministic Autofill path** for simple single-page login forms.

For catalog services that the administrator has **explicitly configured and live-validated**, Digital Home must open the approved Login Entry and the browser extension must fill **all** mapped credential fields by stable `field.id` → CSS locator, then verify the fill. The user submits the external form manually.

**First vertical slice (configuration only, not a code fork):** Rivhit Online.

**MVP product context:** Accounting firms. Universal Autofill across arbitrary websites is **not** required.

## Source References
- Operator Autofill MVP Phase 1 architecture validation (Rivhit) — readiness **B** resolved by Admin credential schema `username` / `password` / `business_id`.
- Operator Rivhit implementation-mapping report (Architecture → codebase) — READY FOR PHASE 1 DETAILED DESIGN.
- `team-Yuri/PLAN.md` §18 — Phase 117 (this revision).
- Credential schema / modes: `arch-phase102.md`, `arch-phase107.md` (`loginFields`, `metadata.credentialMode`).
- Explicit Login Entry: `arch-phase108.md` (human-owned `login_url`; no discovery).
- Legacy generic Autofill: Phases 103 / 110 / 112 (retained; **bypassed** on Managed path).
- Launch Card / credential UX: `arch-phase113.md` (preserve semantics/copy unless Architecture amends).
- URL identity: Phase 116 (unchanged — identity ≠ execution target).

## Current-State Dependencies (codebase-mapped)

| Concern | Existing location | Phase 117 use |
|---------|-------------------|---------------|
| Global catalog row + `login_fields` + `metadata` | `service_registry` via `src/admin/adminRegistryApi.ts`, `src/registry/registryMapper.ts`, `src/registry/registryLoader.ts` | Persist `metadata.autofillProfile`; read through existing metadata pass-through |
| Credential mode | `metadata.credentialMode` + `src/service/credentialSchema.ts` | Gate: Managed Autofill requires `credential_fields` |
| Login Entry open URL | `login_url` / `getServiceOpenUrl` (`src/service/legacyService.ts`) | Validated path uses approved Login Entry (not splash-only) |
| Admin global edit UI | `src/admin/RegistryAdmin.tsx`, `CredentialFieldsEditor.tsx`, `IntegrationStatusPanel.tsx` | Extend for locators + supportState; **do not** invent a second field schema |
| Tile / Launch Autofill entry | `src/loginAssistance/assistanceActions.ts` → `executeServiceFromTile` | Soft entry unchanged; routing change inside execution |
| Unified execution | `src/execution/serviceExecution.ts` | Branch: validated Managed path **before** legacy generic / LI |
| Legacy generic fill | `src/execution/genericAutofill.ts` → `POC_GENERIC_FILL` | Non-validated services only |
| Extension tab orchestration | `extension/background.js` (`openGenericRealSiteTab`, URL match helpers) | Reuse for Managed open |
| Fill write + verify | `extension/generic/fill-executor.js` (`GenericFillExecutor`) | **Reuse** on Managed path |
| Heuristic mapping | `extension/generic/field-mapper.js`, `form-detector.js`, `generic-autofill.js`, `assessStandardLogin` | **Bypass** on Managed path; do not delete |
| Multi-frame fill | `allFrames: true` + `pickBestGenericFrameResult` | **Must not** be used on Managed path (Rivhit hidden iframe) |
| Hub↔extension messaging | `src/browserIntegration/` / `extensionBridge.ts` | New message type for explicit mapping payload |
| Site adapters | `src/execution/adapters/*` (`htzone`, `practice`) | Rivhit must **not** use `adapter_id` |

**Contradiction check:** None that invalidate the architecture. Legacy Autofill uses inference + `allFrames: true`; Phase 117 adds a parallel deterministic path rather than rewriting those components.

---

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-117-0: Rivhit field-ID precondition (hard stop)** | Authoritative vault keys already chosen by Admin. Silent rename/migration is forbidden. | Before any Phase 117 implementation change, Developer verifies live Rivhit `login_fields` IDs are exactly `username`, `password`, `business_id`. If not → **STOP PHASE 117**, return to Architecture. No code repair, no migration. |
| **D-117-1: Managed Autofill is configuration-driven** | Administrator is the source of service-specific Autofill knowledge. | No Rivhit-specific executor/adapter. Rivhit is the first **configuration** of a generic contract. |
| **D-117-2: Stable `field.id` is the only join key** | Labels, order, and DOM names are not identity. | Mapping rows join `fieldId` → CSS `locator`. Changing `#osek` must not change `business_id`. |
| **D-117-3: Persist profile in `service_registry.metadata`** | Metadata already holds `credentialMode`, Login Intelligence, login-entry stamps; admin RLS covers global writes. | No new DB table for Phase 117. Contract key: `metadata.autofillProfile`. |
| **D-117-4: CSS locators only** | Single-page deterministic MVP. | `locatorType` must be `"css"`. No XPath, AI, discovery, shadow DOM, or iframe automation DSL. |
| **D-117-5: Exact-one visible editable input** | Determinism and injection safety. | 0 / many / hidden / disabled / non-input → **FAIL**. No silent fallback to heuristics. |
| **D-117-6: Support state is explicit** | Selectors existing ≠ production-supported. | States: `not_configured` \| `validated` \| `unsupported`. Structural validity alone never sets `validated`. Transitions are **deliberate Admin actions** only — never a side effect of clearing or editing mappings. |
| **D-117-7: Structural vs live validation split** | Security-sensitive injection destinations. | Structural validation may save draft config. `validated` requires approved successful live validation + explicit Admin activation. |
| **D-117-15: Validation bound to configuration version** | Stale validated evidence must not authorize a changed mapping/origin. | Persist `validation.metadataVersion` equal to the Managed Autofill `configVersion` that passed live validation. Security-relevant config changes bump `configVersion` and **invalidate** prior validation eligibility. Runtime Managed Autofill requires version match. |
| **D-117-8: Top-document-only execution** | Rivhit has a hidden same-origin duplicate login iframe. | Managed inject uses top frame only (`frameIds: [0]` or `allFrames: false`). No general iframe automation. |
| **D-117-9: Reuse fill-executor; bypass heuristics** | Compatible write/verify already exist (Phase 110). | Managed runner calls `GenericFillExecutor`; does not call `mapLoginFields` / `assessStandardLogin` / `runGenericAutofill`. |
| **D-117-10: Legacy Autofill retained** | Migration safety. | Non-validated services keep current path. Validated-path failure **must not** silently fall back to generic inference and then report success. |
| **D-117-11: No auto-submit** | User confirms external login. | Extension never clicks Rivhit «התחבר» / `submit`. |
| **D-117-12: Security activation gate** | Mappings control plaintext injection destinations. | Implement plumbing before Security Owner approval; production `validated` + real credential-bearing live validation wait for approval. |
| **D-117-13: Do not redefine credentialMode / Phase 113 copy** | Orthogonal concerns. | `autofillProfile.supportState` ≠ `credentialMode`. Launch Card copy/semantics unchanged unless Architecture amends. |
| **D-117-14: Allowed origin bound to Login Entry** | Prevent cross-origin injection. | `allowedOrigin` derived from Login Entry URL origin (Rivhit: `https://online1.rivhit.co.il`). |

---

## Constraints / Non-Negotiables

- Do not rename, repurpose, regenerate, or migrate Rivhit field IDs `username`, `password`, `business_id`.
- Do not create Autofill field IDs outside the active credential schema.
- Do not remove or expand legacy heuristic Autofill in this phase.
- Do not hardcode Rivhit in an adapter or Hub `if (serviceId === …)` fill branch.
- Do not auto-submit.
- Do not fill `#remember` or any unmapped control.
- Do not change encryption, vault/key architecture, authentication, or credential serialization.
- Do not claim zero knowledge.
- Do not modify Phase 116 identity rules or restore Login Discovery.
- Credential values must never appear in logs, errors, analytics, or telemetry.
- Do not leave a service effectively Managed-validated after security-relevant Autofill config changes (D-117-15).
- Do not reset `supportState` to `not_configured` as a side effect of clearing mappings.

## Technical Boundaries / Out of Scope

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
- Changing Phase 113 Launch Card copy (unless returned to Architecture)

---

## Data / Metadata Contract

### Persistence
`service_registry.metadata.autofillProfile` (JSONB object), written only by Admin global update paths (`updateGlobalRegistryRow` / equivalent admin-only merge), read by Hub via existing `registryRowToServiceDefinition` metadata pass-through.

### Conceptual shape

```text
autofillProfile: {
  supportState: 'not_configured' | 'validated' | 'unsupported'
  configVersion: number              // Managed Autofill configuration version (monotonic)
  loginEntryUrl: string              // must match / bind to authoritative login_url
  allowedOrigin: string              // origin of loginEntryUrl
  fieldMappings: Array<{
    fieldId: string                  // must exist in active login_fields[].id
    locatorType: 'css'
    locator: string                  // e.g. "#username"
  }>
  validation?: {
    metadataVersion: number          // MUST equal configVersion that was live-validated
    validatedAt?: string             // ISO timestamp
    validatedBy?: 'admin'
    resultSummary?: string           // non-secret outcome codes only
  }
}
```

### Configuration versioning and validation binding (D-117-15)

Use existing registry metadata conventions (`service_registry.metadata` JSON + admin writes that already bump row `metadata_version` in `updateGlobalRegistryRow`). **Managed Autofill eligibility is not keyed solely to the row-level `metadata_version`**, because unrelated metadata edits (icons, Login Intelligence, etc.) must not be confused with Autofill security configuration.

Instead:

1. **`autofillProfile.configVersion`** — integer starting at `1` (or `0` before first Autofill profile save). Increment **exactly when** any security-relevant Managed Autofill field changes:
   - `fieldMappings` (add/remove/reorder of security-relevant identity)
   - any mapping `locator` / `locatorType`
   - `loginEntryUrl` (Login Entry binding)
   - `allowedOrigin`
2. **`autofillProfile.validation.metadataVersion`** — set **only** on approved successful live validation + explicit activation, to the **`configVersion` value that was validated**. Name retained as `metadataVersion` per Architecture (Autofill configuration version stamp inside validation evidence).
3. **On any security-relevant config change while `supportState === validated`:**
   - bump `configVersion`
   - transition `supportState` → **`unsupported`** (explicit invalidation — known-broken / config changed)
   - do **not** leave the service effectively eligible: either clear `validation` or leave `validation.metadataVersion` pointing at the **previous** version so it no longer matches
4. **Runtime Managed Autofill eligibility** requires **all** of:
   - `supportState === 'validated'`
   - `validation.metadataVersion` is present and equals current `configVersion`
   - credentialMode / complete credentials / mapping↔schema checks (unchanged)
5. If `supportState === 'validated'` but versions mismatch → treat as **not eligible** for Managed Autofill (fail closed to legacy path rules for non-validated; do not execute stale mappings as validated). Persist repair should move state to `unsupported` on the next Admin write that detects the mismatch.

Clearing or editing mappings is a **configuration change**, not a state machine shortcut to `not_configured`.

### Rivhit first configuration (after D-117-0)

| fieldId | locatorType | locator |
|---------|-------------|---------|
| `username` | `css` | `#username` |
| `password` | `css` | `#password` |
| `business_id` | `css` | `#osek` |

- Login Entry: `https://online1.rivhit.co.il/loginmanager/login`
- Allowed origin: `https://online1.rivhit.co.il`
- Do not map `#remember`

### Support-state transitions

Approved transitions **only**:

| From | To | Allowed when |
|------|-----|--------------|
| `not_configured` | `validated` | Structural OK + **approved** successful live validation + explicit Admin activation (stamps `validation.metadataVersion = configVersion`) |
| `validated` | `unsupported` | Explicit Admin disable **or** known-broken invalidation **or** security-relevant Autofill configuration change (D-117-15) |
| `unsupported` | `validated` | Corrected configuration + approved successful live validation + explicit activation (new `validation.metadataVersion =` current `configVersion`) |

**Explicit Admin reset to `not_configured` (optional):** permitted only as a **deliberate Admin state transition** (dedicated control / confirmed action), from `unsupported` or from a draft that was never production-validated. It must **not** occur as a side effect of clearing mappings, editing a locator, or changing Login Entry / origin.

**Forbidden:**

- `any → not_configured` because mappings were cleared or emptied
- Remaining `validated` (or executing as validated) after security-relevant config change
- Inferring support from credential fields / selectors / Login Entry / legacy Autofill success

No automatic demotion from ordinary end-user fill failures in Phase 117.

### Serialization conventions
Follow existing metadata camelCase used by `credentialMode` and Login Intelligence (`src/loginIntelligence/readWrite.ts`). Provide a dedicated parse/plan module (mirror `src/service/credentialSchema.ts`) — do not invent a second metadata subsystem. Plan writes must bump `configVersion` and enforce support-state / validation-version rules above when merging `autofillProfile`.

---

## Admin Changes

**Extend:** `src/admin/RegistryAdmin.tsx` (global / `owner_user_id IS NULL` rows with `credentialMode === credential_fields`).

**Minimum capability:**

1. List active credential fields from existing `login_fields` (read-only ids/labels).
2. One CSS locator input per field (derived rows only — no free-typed `fieldId`).
3. Save Managed Autofill configuration into `metadata.autofillProfile` (typically `not_configured` until live gate).
4. Show current `supportState` (also surface in `IntegrationStatusPanel.tsx`).
5. Run **structural** validation before save; show failures without activating `validated`.

**Optional (Security-gated for production):** Admin-triggered live validation using **throwaway test values** (never vault decrypt for validation).

Tika owns final Hebrew copy and visual UX. Do not build a general automation designer.

**Write API:** extend `updateGlobalRegistryRow` metadata merge in `adminRegistryApi.ts`. Reject unknown `fieldId`, missing required mappings, non-`css` locatorType, non-HTTPS Login Entry.

---

## Digital Home / Hub Changes

### Routing (minimum)
In `executeServiceFromTile` (`src/execution/serviceExecution.ts`), after site-specific adapters and **before** legacy LI/generic Autofill:

```text
IF autofillProfile.supportState === 'validated'
   AND validation.metadataVersion === autofillProfile.configVersion
   AND credentialMode === credential_fields
   AND required credentials complete
   AND mappings cover required field.ids and ⊆ active schema
THEN execute Managed Autofill (new helper)
ELSE existing legacy behavior
```

Managed helper responsibilities:

- Resolve Login Entry from profile binding / `login_url`
- Send only mapped credential values + approved mappings + `allowedOrigin`
- New extension message (e.g. `HUB_VALIDATED_FILL` / `HUB_MANAGED_AUTOFILL`)
- On Managed failure: open page if appropriate + structured failure; **never** call `executeGenericAutofill` as a silent success fallback
- Refuse Managed path when validation version is missing or mismatched (stale evidence)

### Credential / Launch eligibility (behavior only)

| State | Autofill |
|-------|----------|
| `credential_fields` + complete credentials + `supportState=validated` + matching `validation.metadataVersion` | Eligible for deterministic Managed Autofill |
| `missing-user-credentials` | Preserve existing credential-management flow |
| `not_configured` / `no_stored_credentials` | No credential Autofill |

Do not change Phase 113 Launch Card copy in this phase.

Entry remains `attemptExistingAutomaticCompletion` → `executeServiceFromTile` unless Architecture later amends 113.

---

## Extension Changes

### New deterministic runner
Add a thin module (e.g. `extension/generic/validated-autofill.js` / managed-autofill) that:

1. Enforces `location.origin === allowedOrigin` (and Login Entry path policy as specified by Manager).
2. Operates on **top document only**.
3. For each mapping: `document.querySelectorAll(locator)` → require length === 1; element must pass `GenericFillExecutor.isSafeFillTarget` (visible, enabled, editable `INPUT`, not hidden).
4. Fills via `GenericFillExecutor.fillField`.
5. Verifies all required mappings via `verifyMappings`.
6. Returns structured `{ ok, reason, … }` with **no credential values**.
7. Never submits the form.

### Background orchestration
Reuse `openGenericRealSiteTab` / URL readiness helpers in `extension/background.js`.

**Frame enforcement (normative):** Managed inject must use `target: { tabId, frameIds: [0] }` or `allFrames: false` so Rivhit’s hidden `LoginManager/Login/Index` iframe is not filled. Do **not** use `pickBestGenericFrameResult` on this path.

### Bypassed (not deleted)
- `form-detector.js` / `assessStandardLogin`
- `field-mapper.js` / `mapLoginFields`
- `generic-autofill.js` / `runGenericAutofill`
- Identity-first path
- `allFrames: true` best-frame selection

### Extension must not
Decide business `supportState`; invent mappings; alter credential schema; submit the form.

---

## Runtime Sequence (validated service)

```text
User requests Autofill
  → Digital Home resolves catalog service
  → verify credentialMode = credential_fields
  → verify autofillProfile.supportState = validated
  → verify validation.metadataVersion === configVersion
  → verify complete required credentials
  → verify fieldMappings against active field IDs
  → resolve approved Login Entry
  → open external page (extension)
  → send mapped values + mapping + allowedOrigin
  → extension verifies origin
  → extension targets top document only
  → wait for configured elements
  → resolve explicit CSS selectors (exact one each)
  → GenericFillExecutor fill + verify
  → structured success/failure to Hub
  → user manually submits external form
```

---

## Failure Behavior

| Condition | Outcome |
|-----------|---------|
| Precondition D-117-0 fails | Stop Phase 117 implementation |
| Structural validation fails | Reject save / keep non-validated; never set `validated` |
| Live validation fails | Remain `not_configured` or `unsupported`; no fake `validated` |
| Security-relevant config change while `validated` | Bump `configVersion`; transition to `unsupported`; Managed eligibility ends immediately |
| Stale `validation.metadataVersion` ≠ `configVersion` | Not eligible for Managed Autofill (fail closed) |
| Managed runtime: wrong origin | Fail |
| Managed runtime: 0 / many / hidden / non-editable | Fail |
| Managed runtime: partial fill | **Not success** |
| Managed runtime failure | Do **not** silent-fallback to generic inference as success |
| Extension unavailable | Preserve graceful open / existing Hebrew guidance patterns; do not claim fill success |
| Non-validated service | Legacy Autofill path unchanged |

---

## Legacy Migration Behavior

| Service class | Path |
|---------------|------|
| `supportState === validated` **and** `validation.metadataVersion === configVersion` | Deterministic Managed Autofill only |
| Otherwise | Existing legacy Autofill (generic / LI / adapters) may remain |

Validated-path failure ≠ license to “try heuristics and report ok”.

---

## Security Constraints and Activation Gate

### Security Owner review must cover
- Admin-only mapping modification (existing global RLS + UI)
- Server-authoritative mapping / `supportState`
- Login Entry + origin binding
- Selector-controlled injection destination
- Plaintext Hub → extension transfer (existing channel; document, do not claim ZK)
- Extension host permissions
- Top-document / frame enforcement
- Live validation mechanism (test values only)
- Configuration tampering resistance
- Logging/telemetry: **no credential values**

### May implement before Security Owner approval
- Metadata contract + structural validation
- Admin locator configuration UI (save as `not_configured`)
- Deterministic Hub routing (feature-safe: only activates when `validated`)
- Extension Managed executor + unit/mock DOM tests
- Test/mock-value validation harness

### Must wait for Security Owner approval
- Production transition to `supportState: validated`
- Admin live validation that injects into the real Rivhit origin in production
- Any host-permission policy change beyond current baseline

Do not fake validation to close the phase. Do not change encryption/auth/vault keys.

---

## Exact Implementation Order

0. **D-117-0 precondition** — dump/verify live Rivhit `login_fields` IDs. STOP if mismatch.
1. Pure TypeScript contract module: parse / structural validate / plan metadata write (`configVersion`, `validation.metadataVersion`, explicit support-state transitions).
2. Admin API merge of `autofillProfile` + unit tests for reject rules **and** version invalidation on security-relevant edits.
3. Admin UI: locator editor derived from `login_fields` + supportState display.
4. Extension Managed runner + top-frame inject + message handler (reuse fill-executor).
5. Hub `executeServiceFromTile` branch + Managed send helper.
6. Automated tests (list below).
7. Runtime evidence with mock/test values on Rivhit Login Entry (non-production activation).
8. Security Owner review package.
9. Only then: Admin live validation + activate `validated` for Rivhit.

---

## Likely Files / Modules to Modify

| Area | Path |
|------|------|
| Contract (new) | `src/autofill/validatedProfile.ts` (name flexible; mirror credentialSchema style) |
| Admin API | `src/admin/adminRegistryApi.ts` |
| Admin UI | `src/admin/RegistryAdmin.tsx`, optional small editor component, `IntegrationStatusPanel.tsx` |
| Hub execution | `src/execution/serviceExecution.ts`, new Managed Autofill helper next to `genericAutofill.ts` |
| Launch wiring | `src/loginAssistance/assistanceActions.ts` only if needed for eligibility (prefer execution branch) |
| Extension | `extension/background.js`, new `extension/generic/*validated*autofill*.js`, reuse `fill-executor.js` |
| Manifest | `extension/manifest.json` only if new script must be listed for packaging |
| Verify scripts / tests | `scripts/verifyPhase117*.mjs` (or project’s established pattern) |

Do not modify encryption modules, Phase 116 identity, or discovery engines.

---

## Automated Test Plan

Must cover at least:

1. Rivhit field-ID precondition check (fixture or live read gate).
2. Valid mapping accepted.
3. Unknown `field.id` rejected.
4. Missing required mapping rejected.
5. Wrong origin rejected.
6. Non-HTTPS Login Entry / invalid config rejected.
7. Selector zero-match fails.
8. Selector multi-match fails.
9. Hidden target rejected.
10. Non-editable target rejected.
11. Partial fill is NOT success.
12. `username` fills and verifies.
13. `password` fills and verifies.
14. `business_id` fills and verifies.
15. `#remember` remains untouched.
16. Hidden Rivhit iframe remains untouched (top-frame-only assertion).
17. Submit is never invoked.
18. Validated path does not invoke generic mapper.
19. Non-validated service retains legacy behavior.
20. Missing-user-credentials behavior preserved.
21. Credential values do not appear in logs/errors.
22. Runtime Managed eligibility requires `validation.metadataVersion === configVersion`.
23. Changing a validated selector bumps config version and cannot continue executing under the old validation.
24. Changing Login Entry / `allowedOrigin` bumps config version and cannot continue executing under the old validation.
25. Clearing or changing mappings cannot silently preserve `validated` eligibility.
26. Reset to `not_configured` is only via explicit Admin state transition (not a side effect of clearing mappings).

---

## Runtime Verification Plan

- Admin configures Rivhit locators; structural validation passes; state remains non-`validated` until live gate.
- After Security approval: live validate with throwaway values on `https://online1.rivhit.co.il/loginmanager/login`; all three fields verify; no submit; hidden iframe empty.
- Activate `validated`.
- Digital Home user with complete Rivhit credentials: Managed Autofill fills all three; user submits manually.
- Incomplete credentials: existing missing-credentials flow.
- A non-validated catalog service still uses legacy Autofill.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-117-0 | Rivhit live `login_fields` IDs are exactly `username`, `password`, `business_id` before implementation proceeds |
| AC-117-1 | Managed Autofill profile persists in `service_registry.metadata` without a new table |
| AC-117-2 | Admin can set CSS locator per active credential field; cannot invent foreign field IDs |
| AC-117-3 | Structural validation enforces schema join, HTTPS Login Entry, origin bind, css-only, required coverage |
| AC-117-4 | Structural pass alone never sets `supportState=validated` |
| AC-117-5 | `validated` requires approved live validation + explicit activation |
| AC-117-6 | Validated runtime sends explicit mappings; does not call heuristic field mapper |
| AC-117-7 | Extension reuses `GenericFillExecutor`; never auto-submits |
| AC-117-8 | Top-document-only fill; Rivhit hidden iframe not written |
| AC-117-9 | Each locator must resolve exactly one visible editable input or fail |
| AC-117-10 | Partial fill cannot report success |
| AC-117-11 | Wrong origin fails |
| AC-117-12 | Validated-path failure does not silent-fallback to generic inference success |
| AC-117-13 | Non-validated services retain legacy Autofill behavior |
| AC-117-14 | Rivhit requires no service-specific adapter / hardcoded fill branch |
| AC-117-15 | `business_id` maps to `#osek` without renaming vault field id |
| AC-117-16 | `#remember` never filled |
| AC-117-17 | Missing-user-credentials / NOT_CONFIGURED / NO_STORED_CREDENTIALS behaviors preserved |
| AC-117-18 | credentialMode is not redefined by supportState |
| AC-117-19 | No credential values in logs/errors/telemetry |
| AC-117-20 | Production `validated` activation remains Security-gated |
| AC-117-21 | Build/lint/tests required by Manager plan pass |
| AC-117-22 | Phase 113 Launch Card copy unchanged unless Architecture amendment exists |
| AC-117-23 | Live validation stamps `validation.metadataVersion` to the exact Managed Autofill `configVersion` that was validated |
| AC-117-24 | Managed Autofill runtime requires `supportState=validated` **and** `validation.metadataVersion === configVersion`; mismatch is not eligible |
| AC-117-25 | Changing a validated locator / fieldMappings bumps `configVersion`, moves state to `unsupported` (or equivalent non-eligible), and cannot continue executing under the prior validation |
| AC-117-26 | Changing Login Entry binding or `allowedOrigin` likewise invalidates prior validation eligibility |
| AC-117-27 | Clearing or editing mappings does not silently preserve `validated` eligibility |
| AC-117-28 | Transition to `not_configured` occurs only via explicit Admin reset action — never as a side effect of clearing mappings |

---

## Functional Testability

- **Page/screen:** Admin Registry (global Rivhit row); Digital Home Launch Card for Rivhit.
- **User-visible behavior:** After `validated` + complete credentials, Autofill populates username, password, and business id on Rivhit login; user clicks «התחבר».
- **Minimal end-to-end flow:** Admin maps three CSS locators → Security-approved live validate → activate → user Autofill → three fields verified filled → manual submit.
- **Expected observable result:** Deterministic fill without heuristic mapping; no submit by extension; legacy services unchanged.

---

## STOP Conditions

- D-117-0 Rivhit field IDs mismatch → STOP, return to Architecture.
- Proposal to rename/migrate field IDs → STOP.
- Proposal to remove legacy Autofill in 117 → STOP.
- Proposal to auto-submit or add iframe automation → STOP.
- Setting `validated` without live validation / Security approval → STOP.
- Remaining effectively validated after security-relevant Autofill config change → STOP.
- Implicit `not_configured` reset as a side effect of clearing mappings → STOP.
- Silent fallback from Managed failure to generic success → STOP.
- Rivhit-specific adapter as the delivery mechanism → STOP.
- Current code contradiction that cannot be resolved without architecture change → return to Architecture (none identified at contract time).

---

## Required Developer Completion Evidence

- Precondition dump proving Rivhit field IDs.
- Metadata sample for Rivhit `autofillProfile` (redacted).
- Automated test run output covering AC list items including version-match and invalidation cases.
- Runtime notes/screenshots: Admin config; fill of three fields; `#remember` empty; no submit; top-frame only.
- Evidence that changing a locator after `validated` blocks Managed execution until re-validation.
- Explicit statement that validated path does not call `mapLoginFields` / `runGenericAutofill`.
- Security gate status: what is implemented vs what awaits Security Owner for production `validated`.
- Confirmation: no encryption/Phase 116/discovery changes; no Phase 113 copy changes.

---

## Known Risks / Dependencies

| Risk / dependency | Mitigation |
|-------------------|------------|
| Live Rivhit row not verified in Architecture session | Hard gate D-117-0 / AC-117-0 |
| Hidden duplicate iframe | Top-frame-only inject (D-117-8) |
| Meta-refresh splash `online1.rivhit.co.il/` | Bind Login Entry to `/loginmanager/login` |
| jQuery Validate on Rivhit | Existing fill-executor events; verify post-fill |
| Broad extension `https://*/*` host permissions | Security review; do not expand scope casually |
| Confusion between `credentialMode` and `supportState` | Namespaced `autofillProfile.supportState` |
| Stale validation after mapping/origin edit | D-117-15 / AC-117-23…28 — version match required |
| Row `metadata_version` vs Autofill `configVersion` | Do not key Managed eligibility only to unrelated metadata bumps; use `autofillProfile.configVersion` |
| Phase 112 LI may still run for non-validated services | Managed branch must short-circuit before LI when validated **and** version-matched |
| Admin live validation UX vs Security | Test values only; activation gated |

---

## Handoff Notes for Manager

1. Open with **D-117-0** as Milestone 0; block all code until green.
2. Split milestones: contract (incl. configVersion / validation.metadataVersion) → Admin structural → extension executor → Hub routing → tests → Security package → Rivhit activation.
3. Keep Rivhit as **config evidence**, not a named code path.
4. Coordinate Security Owner early; do not schedule production `validated` before approval.
5. Tika for Admin/DH microcopy only after structural UI exists.
6. Do not authorize Phase 113 copy edits under this phase.
7. Require tests for explicit state reset vs mapping-clear side effects; forbid implicit `not_configured`.

---

## Architect Review
ARCHITECT_REVIEW_STATUS: READY_FOR_REVIEW

### Review Notes
Architecture review corrections applied 2026-09-15: explicit support-state transitions only; `validation.metadataVersion` bound to Managed Autofill `configVersion`; AC-117-23…28 and tests 22–26 added. **Not approved for Developer implementation** until Architecture/CEO accept this revision and Manager produces an approved Detailed Design.

### Required Corrections
_(applied — awaiting Architecture acceptance)_