# Architecture Phase 117

## Phase Identifier
PHASE=117

## Status
STATUS: APPROVED

AMENDED: 2026-09-15 — Architecture review corrections: (1) remove implicit any→`not_configured` reset; state transitions are explicit only; (2) bind live validation to `validation.metadataVersion` / Managed Autofill config version; (3) AC/tests for stale-validation rejection.

AMENDED: 2026-09-16 — **Dynamic service / field independence.** D-117-0 is Rivhit vertical-slice verification only — not a generic field-name contract. Managed Autofill is schema-dynamic (`field.id` join only). Prohibit Rivhit/hostname/service-ID hard-coding and username/password semantic assumptions on the deterministic path. Add synthetic non-Rivhit genericity test and AC-117-29.

AMENDED: 2026-09-16 — **Managed Autofill latency / readiness (Operator M8).** Root cause accepted: Managed path inherited legacy `GENERIC_REAL_SITE_INITIAL_DELAY_MS = 4000` from shared `openGenericRealSiteTab`. Managed Autofill must not use that fixed post-load delay. Readiness = all required mapped targets safe. Bounded adaptive retry only. **In-progress Hub UX is mandatory** (suggested Hebrew: «ממלא פרטי כניסה...»). Legacy/generic 4s behavior unchanged. D-117-17 / D-117-18; AC-117-30…36. **Implementation of this amendment is authorized.** Phase 117 remains OPEN until Operator Rivhit retest passes.

AMENDED: 2026-09-16 — **Tab placement + execution concurrency (Operator retest).** D-117-19: Managed target tab adjacent to Hub via `sender.tab` (`index + 1`, `openerTabId` when appropriate); fail soft if `sender.tab` missing; legacy/generic placement unchanged; concurrent launches from same Hub may race adjacent index (acceptable). D-117-20: replace global Managed in-flight boolean with `(serviceId, accessProfileId)` execution key; allow different profiles/services concurrent; re-launch after settle allowed; no cooldown; clear key on every terminal outcome. AC-117-36 revised; AC-117-37. **Implementation authorized.** Phase 117 remains OPEN pending Operator verification.

APPROVED: 2026-09-16 — Architecture accepted for Manager Detailed Design. Developer implementation must not start until `manager-phase117.md` is approved and D-117-0 passes for Rivhit E2E validation.

## Title
Phase 117 — Managed Autofill: Deterministic Single-Page Mapping

## Phase Goal
Deliver a **generic, administrator-managed, deterministic Autofill path** for simple single-page login forms.

For catalog services that the administrator has **explicitly configured and live-validated**, Digital Home must open the approved Login Entry and the browser extension must fill **all** mapped credential fields by stable `field.id` → CSS locator, then verify the fill. The user submits the external form manually.

**First vertical slice (configuration only, not a code fork):** Rivhit Online. Rivhit’s field IDs are **that service’s configured schema**, not the Managed Autofill engine’s required vocabulary.

**MVP product context:** Accounting firms. Universal Autofill across arbitrary websites is **not** required.

Managed Autofill must work for **any** simple single-page catalog service whose administrator configures and validates mappings for that service’s active credential `field.id` values.

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
| Extension tab orchestration | `extension/background.js` (`openGenericRealSiteTab`, URL match helpers) | Managed may reuse URL/tab helpers **but must not** apply `GENERIC_REAL_SITE_INITIAL_DELAY_MS` (D-117-17) |
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
| **D-117-0: Rivhit vertical-slice precondition (configuration check only)** | Rivhit is the first end-to-end proving service. Its known Admin schema for that slice happens to use `username`, `password`, `business_id`. | Before using Rivhit as the first end-to-end validation service, Developer verifies the live Rivhit `login_fields` IDs still match that known test configuration. Mismatch → **STOP Rivhit validation**, return the discrepancy to Architecture. No silent repair, rename, migration, or hard-code around it. **These IDs are not architectural requirements of Managed Autofill.** They must not appear in generic runtime eligibility logic, must not be required field names for other services, and must not be hard-coded into the generic Managed Autofill implementation. |
| **D-117-1: Managed Autofill is configuration-driven** | Administrator is the source of service-specific Autofill knowledge. | No Rivhit-specific executor/adapter. Rivhit is the first **configuration** of a generic contract. |
| **D-117-2: Stable `field.id` is the only join key** | Labels, order, and DOM names are not identity. Semantic field names are not a fixed vocabulary. | Mapping rows join each service’s active `fieldId` → CSS `locator`. The engine makes **no** assumption that fields are named `username` / `password` / `business_id` or any other predefined set. Changing an external selector must not require changing credential `field.id`. |
| **D-117-16: Schema-dynamic execution (service / field independence)** | Another simple catalog service may use entirely different field IDs (e.g. `customer_number`+`pin`, or `company_code`+`user_identifier`+`secret`). | Hub and extension Managed paths read the active credential schema and validated mappings dynamically. Adding such a service requires Admin configuration + validation only — **not** Managed Autofill runtime or extension code changes. |
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
| **D-117-17: Managed readiness — no fixed post-load delay** | Operator M8: after Rivhit tab is visible, fixed 4s sleep before fill makes Autofill appear failed. Inherited from legacy `GENERIC_REAL_SITE_INITIAL_DELAY_MS`. | Managed Autofill must **not** use that fixed 4-second initial delay. After approved target URL reached, allowed origin confirmed, and top document confirmed, immediately attempt deterministic mappings. Readiness = **all** required mapped locators resolve to exactly one safe enabled/editable target. If not ready: **bounded adaptive** retry only — never replace 4s with another arbitrary fixed delay. When ready: fill via existing fill-executor + post-fill verify. Success only after verification. Legacy/generic Autofill may keep the 4s delay (out of scope for this correction). |
| **D-117-18: Mandatory Managed in-progress Hub UX** | Waiting for extension result without feedback causes false “failure” perception. | On Managed Autofill initiation for an execution, Hub must **immediately** enter a non-success working state for **that** execution while awaiting the structured extension result. Suggested Hebrew: «ממלא פרטי כניסה...». Not success; not failure; ends on structured success/failure; no credentials/field values; must not claim fields were filled before verification. No fixed UX timer. In-progress UX is scoped to the running `(serviceId, accessProfileId)` — must not make unrelated profiles/services appear unavailable (see D-117-20). |
| **D-117-19: Managed tab adjacent to Hub** | Operator: «פתח אתר» opens beside Hub (`window.open`); Managed `chrome.tabs.create` without `index` opens at strip end. | When `sender.tab` is available on `HUB_MANAGED_AUTOFILL`, create the Managed target tab with `index: sender.tab.index + 1` and `openerTabId: sender.tab.id` where supported/appropriate. If `sender.tab` unavailable: fail soft for **placement only** — create tab with existing default placement; do not weaken Managed runtime/security validation. Do **not** change legacy/generic tab placement in Phase 117. Concurrent launches from the same Hub tab may compete for the same adjacent index; visual order is **not** guaranteed — acceptable; no tab-order manager in this phase. |
| **D-117-20: Execution-scoped Managed concurrency** | Global `managedAutofillInFlight` boolean blocks intentional parallel profiles. | Replace global Managed busy lock with in-flight tracking keyed by `(serviceId, accessProfileId)` only (no credential/field/selector secrets). **A** same service+profile in flight → no duplicate. **B** same service, different profile → concurrent OK. **C** different service → concurrent OK. **D** same service+profile after prior settle → new run OK immediately (no cooldown). Clear the key on every terminal outcome (verified success, structured failure, unavailable/not-ready, communication failure, unexpected handled error). No global Managed Autofill busy lock. |

---

## Constraints / Non-Negotiables

- Do not silently rename, repair, or migrate Rivhit’s configured field IDs if D-117-0 fails — return to Architecture.
- Do not treat `username` / `password` / `business_id` as required names for Managed Autofill or other services.
- Do not put Rivhit field-ID literals into generic runtime eligibility, Hub Managed routing, or the extension Managed executor.
- Do not create Autofill field IDs outside the active credential schema of the service being configured.
- Do not remove or expand legacy heuristic Autofill in this phase.
- Do not hardcode Rivhit (or any service) in an adapter, hostname branch, service-ID fill branch, or hard-coded selectors in the generic executor.
- Do not assume username/password (or any fixed pair) semantics on the deterministic Managed path.
- Do not auto-submit.
- Do not fill unmapped controls (for Rivhit config: do not fill `#remember`).
- Do not change encryption, vault/key architecture, authentication, or credential serialization.
- Do not claim zero knowledge.
- Do not modify Phase 116 identity rules or restore Login Discovery.
- Credential values must never appear in logs, errors, analytics, or telemetry.
- Do not leave a service effectively Managed-validated after security-relevant Autofill config changes (D-117-15).
- Do not reset `supportState` to `not_configured` as a side effect of clearing mappings.
- Do not apply legacy `GENERIC_REAL_SITE_INITIAL_DELAY_MS` (or any arbitrary fixed multi-second post-load sleep) on the Managed Autofill path (D-117-17).
- Do not report Managed success before post-fill verification.
- Do not omit in-progress Hub feedback while Managed Autofill awaits the extension (D-117-18).
- Do not use a global Managed Autofill busy lock (D-117-20).
- Do not put credential values, field values, or selectors into in-flight execution identity.

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

### Generic field contract (D-117-2 / D-117-16)

Managed Autofill operates dynamically from each service’s **active credential schema**:

```text
Service credential schema (login_fields)
    ↓
active stable field.id values
    ↓
Admin-defined mapping for those field.id values
    ↓
validated Managed Autofill profile (version-matched)
    ↓
deterministic execution (no semantic field understanding)
```

The Managed Autofill engine must make **no** semantic assumption that credential fields are named `username`, `password`, `business_id`, or any other fixed vocabulary. A different service may define e.g. `customer_number` + `pin`, or `company_code` + `user_identifier` + `secret`, without application or extension code changes. The stable `field.id` remains the only join key between vault values and locators.

### Rivhit first configuration (vertical-slice data only — after D-117-0)

This table is **Rivhit configuration evidence** for the first end-to-end slice. It is **not** the Managed Autofill field vocabulary.

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
Reuse URL/tab open and match helpers in `extension/background.js`. Managed Autofill may share infrastructure with generic open **only if** it does **not** apply `GENERIC_REAL_SITE_INITIAL_DELAY_MS` (D-117-17). Prefer a Managed-specific initial delay of `0` / dedicated Managed orchestrator.

**Frame enforcement (normative):** Managed inject must use `target: { tabId, frameIds: [0] }` or `allFrames: false` so Rivhit’s hidden `LoginManager/Login/Index` iframe is not filled. Do **not** use `pickBestGenericFrameResult` on this path.

### Managed tab orchestration / latency (D-117-17) — normative

After approved target URL is reached, allowed origin will be enforced in-page, and top document is the inject target, Managed Autofill may **immediately** attempt deterministic mappings.

**Readiness:** every required mapped locator resolves to exactly one safe, enabled/editable target. If not ready: bounded adaptive retry only — never another arbitrary fixed multi-second delay. When ready: fill via existing fill-executor, then post-fill verification. Success only after verification.

Legacy/generic Autofill’s 4-second initial delay is **unchanged**.

### Bypassed (not deleted)
- `form-detector.js` / `assessStandardLogin`
- `field-mapper.js` / `mapLoginFields`
- `generic-autofill.js` / `runGenericAutofill`
- Identity-first path
- `allFrames: true` best-frame selection
- Fixed `GENERIC_REAL_SITE_INITIAL_DELAY_MS` on the **Managed** path only (legacy keeps it)

### Extension must not
Decide business `supportState`; invent mappings; alter credential schema; submit the form; branch on Rivhit / hostname / service id; hard-code Rivhit selectors; hard-code expected credential field names; assume username/password (or any fixed) field semantics; apply legacy fixed post-load delay on the Managed path.

The generic executor receives the validated mapping and credential map keyed by `field.id` and executes it. It does not need to understand the business meaning of a field.

### Managed tab placement (D-117-19) — normative

On Managed `chrome.tabs.create` (Managed path only):

- If `sender.tab` is available: `index: sender.tab.index + 1`, and `openerTabId: sender.tab.id` where supported/appropriate.
- If `sender.tab` is unavailable: omit placement hints (existing default); do not fail the Managed fill for placement alone.
- Legacy/generic `tabs.create` placement unchanged.
- No tab-order orchestration / tab manager in Phase 117.

### Hub in-progress UX (D-117-18) — normative

On Managed Autofill initiation, Hub/Launch Card must immediately show a working state for **that** `(serviceId, accessProfileId)` (suggested Hebrew: «ממלא פרטי כניסה...») — not success, not failure — until structured extension success/failure replaces it. No fixed UX timer. No credentials/field values in that state. Unrelated profiles/services must remain actionable.

### Managed execution concurrency (D-117-20) — normative

Hub tracks in-flight Managed executions by `(serviceId, accessProfileId)` only. Reject accidental duplicate activation of the same key while in flight. Allow concurrent different profiles and different services. After settle, same key may launch again immediately. Clear the key on every terminal outcome. No global Managed busy boolean.

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
  → Hub enters in-progress working state («ממלא פרטי כניסה...»)  [D-117-18]
  → open external page (extension)
  → send mapped values + mapping + allowedOrigin
  → extension verifies origin / top document
  → immediately attempt mappings (NO fixed 4s post-load delay)  [D-117-17]
  → adaptive retry until ALL required mapped targets are ready
  → GenericFillExecutor fill + verify
  → structured success/failure to Hub
  → Hub replaces in-progress with verified success or failure
  → user manually submits external form
```

---

## Failure Behavior

| Condition | Outcome |
|-----------|---------|
| Precondition D-117-0 fails | Stop **Rivhit** end-to-end validation; return configuration discrepancy to Architecture. Do not hard-code around it. Managed Autofill generic implementation may continue to be designed/tested with synthetic schemas. |
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

0. **D-117-0** — If Rivhit is used as the first end-to-end validation service, dump/verify live Rivhit `login_fields` IDs against the known Rivhit test configuration. Mismatch → STOP Rivhit validation, return to Architecture (do not hard-code).
1. Pure TypeScript contract module: parse / structural validate / plan metadata write (`configVersion`, `validation.metadataVersion`, explicit support-state transitions). Schema-dynamic — no fixed field-name lists in the contract module beyond “active login_fields”.
2. Admin API merge of `autofillProfile` + unit tests for reject rules **and** version invalidation on security-relevant edits.
3. Admin UI: locator editor derived from `login_fields` + supportState display.
4. Extension Managed runner + top-frame inject + message handler (reuse fill-executor); mapping-driven only.
5. Hub `executeServiceFromTile` branch + Managed send helper (schema-dynamic credentials/mappings).
6. Automated tests including **synthetic non-Rivhit schema** genericity test (below).
7. Runtime evidence with mock/test values on Rivhit Login Entry (non-production activation) **only after** D-117-0 green.
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

1. Rivhit vertical-slice field-ID check (fixture or live read gate for Rivhit E2E only — not a generic engine requirement).
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
12. Rivhit config: `username` fills and verifies (slice evidence).
13. Rivhit config: `password` fills and verifies (slice evidence).
14. Rivhit config: `business_id` fills and verifies (slice evidence).
15. Rivhit config: `#remember` remains untouched.
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
27. **Genericity (required):** synthetic second service/configuration fixture that does **not** use Rivhit field IDs — e.g. schema `customer_number`, `pin` with test locators `#customer-number`, `#pin` (names/selectors may follow existing test conventions). Prove the **same** Managed Autofill implementation:
    - reads that service’s active credential schema;
    - resolves mappings by stable `field.id`;
    - passes dynamically keyed credential values;
    - deterministically fills configured targets and verifies;
    - requires **no** service-specific code;
    - requires **no** `username` / `password` / `business_id` assumptions.
    Do **not** create a production catalog service solely for this test; fixture/mock/test configuration is sufficient.
28. Managed path does **not** impose a fixed multi-second sleep after tab `complete` when all mapped targets are already present.
29. If targets appear later, fill still succeeds via adaptive readiness/retry (no fixed-only strategy).
30. In-progress Hub state appears immediately after Managed Autofill initiation.
31. In-progress state is not rendered/interpreted as success; replaced by verified success or structured failure.
32. Rapid duplicate activation of the same `(serviceId, accessProfileId)` does not start a second run; different profiles/services may run concurrently; same profile may re-launch after settle (D-117-20).
33. Managed target tab opens adjacent to Hub when `sender.tab` exists; placement fallback when unavailable (D-117-19).
34. Origin mismatch / top-frame / partial-fill / no legacy fallback / no auto-submit / no secrets in logs — regression suite from latency analysis items 3–11 as applicable.
35. No global Managed busy state remains on the execution path.

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
| AC-117-0 | Before Rivhit end-to-end validation, live Rivhit `login_fields` IDs match the known Rivhit test configuration (`username`, `password`, `business_id`); mismatch stops Rivhit validation and returns to Architecture — these IDs are **not** generic Managed Autofill requirements |
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
| AC-117-15 | Rivhit config maps `business_id` → `#osek` without renaming that vault field id |
| AC-117-16 | Rivhit config: `#remember` never filled |
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
| AC-117-29 | **Genericity:** Adding another simple single-page catalog service with a **different** credential schema and administrator-configured CSS mappings must **not** require a code change to the Managed Autofill runtime or browser extension. Configuration and validation are expected; new service-specific execution code is a phase failure. Proven by the required synthetic non-Rivhit schema test |
| AC-117-30 | Managed Autofill does **not** use `GENERIC_REAL_SITE_INITIAL_DELAY_MS` (or equivalent fixed multi-second post-load sleep) |
| AC-117-31 | After target URL + origin/top-document constraints, Managed attempts fill based on mapped-target readiness; adaptive bounded retry only if targets not yet ready |
| AC-117-32 | When all required mapped targets are ready, fill proceeds immediately via existing fill-executor; success only after post-fill verification |
| AC-117-33 | Legacy/generic Autofill retains its existing 4-second initial delay behavior (unchanged by this amendment) |
| AC-117-34 | Hub shows mandatory in-progress working state immediately on Managed Autofill start for that execution (suggested «ממלא פרטי כניסה...»); not success; not failure; no credentials; unrelated profiles/services remain available |
| AC-117-35 | In-progress state is replaced only by verified success or structured failure; no fixed UX timer |
| AC-117-36 | Managed in-flight dedupe is keyed by `(serviceId, accessProfileId)` only: same key in flight → no duplicate; different profile or service → concurrent OK; after settle → re-launch OK immediately; no global Managed busy lock; key cleared on every terminal outcome; identity contains no secrets |
| AC-117-37 | When `sender.tab` is available, Managed target tab opens adjacent to the originating Hub tab (`index + 1`, `openerTabId` where appropriate); if unavailable, placement fails soft without weakening Managed validation; legacy/generic placement unchanged |

---


## Functional Testability

- **Page/screen:** Admin Registry (global Rivhit row as first slice); Digital Home Launch Card for a validated service.
- **User-visible behavior:** After `validated` + complete credentials, Autofill populates **that service's mapped fields** (for Rivhit config: username, password, business id); user submits externally.
- **Minimal end-to-end flow:** Admin maps CSS locators from active schema → Security-approved live validate → activate → user Autofill → all required fields verified → manual submit.
- **Expected observable result:** Deterministic fill without heuristic mapping; no submit by extension; legacy services unchanged; synthetic non-Rivhit schema also works via the same engine.

---

## STOP Conditions

- D-117-0 Rivhit configuration mismatch → STOP Rivhit E2E validation, return to Architecture (do not hard-code field names into the engine).
- Proposal to hard-code Rivhit / hostname / service-ID / fixed field-name assumptions into Managed Autofill → STOP.
- Proposal to rename/migrate Rivhit field IDs silently → STOP.
- Proposal to remove legacy Autofill in 117 → STOP.
- Proposal to auto-submit or add iframe automation → STOP.
- Setting `validated` without live validation / Security approval → STOP.
- Remaining effectively validated after security-relevant Autofill config change → STOP.
- Implicit `not_configured` reset as a side effect of clearing mappings → STOP.
- Silent fallback from Managed failure to generic success → STOP.
- Proposal to apply or reintroduce a fixed multi-second post-load delay on Managed Autofill → STOP.
- Omitting mandatory in-progress Hub UX for Managed Autofill → STOP.
- Reporting Managed success before post-fill verification → STOP.
- Current code contradiction that cannot be resolved without architecture change → return to Architecture (none identified at contract time).

---

## Required Developer Completion Evidence

- Precondition dump for Rivhit E2E (D-117-0), or Architecture note if Rivhit E2E deferred.
- Metadata sample for Rivhit `autofillProfile` (redacted) as configuration evidence only.
- Automated test run including **synthetic non-Rivhit schema** genericity proof (AC-117-29).
- Automated test run covering version-match and invalidation cases.
- Runtime notes/screenshots: Admin config; Rivhit fill of mapped fields; `#remember` empty; no submit; top-frame only.
- Evidence that changing a locator after `validated` blocks Managed execution until re-validation.
- Explicit statement that validated path does not call `mapLoginFields` / `runGenericAutofill`.
- Explicit statement that Managed Hub/extension code contains no Rivhit field-ID / hostname / service-ID fill hard-coding.
- Security gate status: what is implemented vs what awaits Security Owner for production `validated`.
- Confirmation: no encryption/Phase 116/discovery changes; no Phase 113 copy changes.

---

## Known Risks / Dependencies

| Risk / dependency | Mitigation |
|-------------------|------------|
| Live Rivhit row not verified in Architecture session | D-117-0 / AC-117-0 for Rivhit E2E only |
| Accidental hard-coding of Rivhit field names into engine | D-117-16 / AC-117-29 synthetic schema test |
| Hidden duplicate iframe | Top-frame-only inject (D-117-8) |
| Meta-refresh splash `online1.rivhit.co.il/` | Bind Login Entry to `/loginmanager/login` (Rivhit config) |
| jQuery Validate on Rivhit | Existing fill-executor events; verify post-fill |
| Broad extension `https://*/*` host permissions | Security review; do not expand scope casually |
| Confusion between `credentialMode` and `supportState` | Namespaced `autofillProfile.supportState` |
| Stale validation after mapping/origin edit | D-117-15 / AC-117-23…28 — version match required |
| Row `metadata_version` vs Autofill `configVersion` | Do not key Managed eligibility only to unrelated metadata bumps; use `autofillProfile.configVersion` |
| Phase 112 LI may still run for non-validated services | Managed branch must short-circuit before LI when validated **and** version-matched |
| Admin live validation UX vs Security | Test values only; activation gated |

---

## Handoff Notes for Manager

1. Milestone 0 = D-117-0 only when Rivhit E2E validation is scheduled; do not encode Rivhit field names into the generic implementation plan.
2. Split milestones: contract (incl. configVersion / validation.metadataVersion + schema-dynamic joins) → Admin structural → extension executor → Hub routing → tests (**include synthetic schema**) → Security package → Rivhit activation.
3. Keep Rivhit as **config evidence**, not a named code path.
4. Coordinate Security Owner early; do not schedule production `validated` before approval.
5. Tika for Admin/DH microcopy only after structural UI exists.
6. Do not authorize Phase 113 copy edits under this phase.
7. Require tests for explicit state reset vs mapping-clear side effects; forbid implicit `not_configured`.
8. Treat failure of AC-117-29 as architectural failure of Phase 117 genericity.
9. Latency amendment (D-117-17 / D-117-18): Operator Rivhit retest before Phase 117 close.
10. Tab placement + concurrency (D-117-19 / D-117-20): authorize Developer immediately; regression per AC-117-36/37; Operator retest after automated verification.

---

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
Architecture accepted 2026-09-16 for Manager Detailed Design handoff.

**Latency amendment approved 2026-09-16:** D-117-17 / D-117-18; AC-117-30…35.

**Tab placement + concurrency approved 2026-09-16:** D-117-19 / D-117-20; AC-117-36 revised; AC-117-37. **Implementation authorized.**

Phase 117 remains **OPEN** until:

1. Automated regression evidence (adjacent tab, placement fallback, concurrency keys, clear-on-terminal, no global busy, prior Managed/security/genericity tests)
2. Operator Rivhit retest PASS (performance already accepted)

All existing Phase 117 security/runtime constraints remain. No production code authored by Architecture in this review.

### Required Corrections
_(none — implement)_
