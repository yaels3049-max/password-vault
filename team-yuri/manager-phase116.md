# Manager Phase 116 — Corrective Work

## Phase Identifier
PHASE=116

## Status
STATUS: READY_FOR_APPROVAL

**Track:** Corrective implementation of **existing** Phase 116 contract — specifically **AC-116-3** (Custom Add Registered-URL Identity Convergence).

**This is NOT a Phase 117 Managed Autofill change.**

**OPERATOR / ARCHITECTURE REQUEST:** Architecture classified the discovered issue as an **incomplete implementation** of the approved Phase 116 contract (AC-116-3). Manager produces this corrective Detailed Design for **Architecture approval before Developer handoff**.

**Do not implement** until Architecture approves this plan.

### Parallel program status (context — not in scope to change)
| Item | Status |
|------|--------|
| PHASE.md | Remains **117** (Manager must not rewrite PHASE for this correction) |
| Phase 117 | FUNCTIONALLY VALIDATED |
| Phase 116 AC-116-3 correction | **OPEN** (this plan) |
| Security review | PENDING |
| Broad production activation | BLOCKED |

## Phase Goal (corrective)
Before creating a new custom `service_registry` row, Custom Add must resolve the entered URL against the **explicitly registered URL identity set** of existing catalog (and applicable custom) services.

For this correction the registered identity set per service is:

- `primary_url` (Hub: `ServiceDefinition.url`)
- `login_url`, **when present** (Hub: `ServiceDefinition.loginUrl`)

Matching **either** registered URL (under existing Phase 116 URL identity normalization) must resolve to the **same** existing `service_registry.id`.

Additionally: Custom Add must **stop presenting every unknown cloud/upsert failure as a network/connectivity error**, while preserving safe user-facing messages and distinguishing failure classes (below).

## Source References
- `team-Yuri/PLAN.md` §18 — Phase 116 (AC-116-1 … AC-116-10); especially **AC-116-3**, AC-116-1, AC-116-4, AC-116-6, AC-116-8, AC-116-9
- Architecture corrective decision (operator request 2026-09-16) — Registered-URL Identity Convergence
- Existing identity helpers: `src/supabase/registryPersistence.ts` — `normalizeCustomServiceUrl`, `serviceUrlIdentityKey`, `urlsReferToSameService`
- Custom Add classifier: `src/catalog/addCustomServiceOutcome.ts` — `classifyAddCustomService`
- Custom Add orchestration: `src/App.tsx` — `addCustomService`
- Persistence upsert: `src/supabase/registryPersistence.ts` — `upsertCustomServiceRegistryRow`
- Catalog mapping: `src/registry/registryMapper.ts` / loaders (ensure `loginUrl` is available on catalog definitions used by classifier)
- Phase 104 verify: `scripts/verifyPhase104ServiceManagement.mjs` (classifier coverage — extend, do not weaken)
- Phase 117 contract: `team-Yuri/arch-phase117.md` — **out of modification scope**; regression only

## Problem Statement (observed gap)

**Example — Rivhit (illustrative, not Rivhit-specific code):**

| Field | Value |
|-------|--------|
| Existing `primary_url` | `https://online1.rivhit.co.il/` |
| Existing `login_url` | `https://online1.rivhit.co.il/loginmanager/login` |
| Operator entered | `https://online1.rivhit.co.il/loginmanager/login` |

**Current behavior:** `classifyAddCustomService` compares the entered URL only to `existing.url` (primary). It does **not** compare to `existing.loginUrl`. The Login Entry therefore fails to resolve to the catalog service and Custom Add proceeds toward **new custom registry creation**.

**Contract violation:** Incomplete AC-116-3 / duplicate-prevention intent — an explicitly registered Login Entry must converge to the existing service identity before insert.

**Secondary defect:** Upsert/cloud failures in `addCustomService` are often rethrown as a single connectivity-style Hebrew message (`CUSTOM_SERVICE_CLOUD_FAIL_MESSAGE`), masking auth/policy/persistence/validation failures.

## Architecture Decision (binding for this correction)

1. **Identity set for Custom Add matching:** `primary_url` + `login_url` (when present).
2. **Match rule:** If normalized entered URL equals the identity key of **either** registered URL → same existing `service_registry.id`.
3. **Normalization:** Reuse existing Phase 116 helpers (`serviceUrlIdentityKey` / `urlsReferToSameService` / `normalizeCustomServiceUrl`). Do **not** invent a second normalization stack unless Architecture later amends.
4. **Identity ≠ execution:** Resolving identity must not change which URL execution opens (`loginUrl` when set, else `primaryUrl` — Phase 103 / AC-116-6).
5. **No host-only merge:** Same host with an **unregistered** path must **not** automatically match. Different subdomains are not automatically merged (AC-116-8).
6. **No Rivhit-specific branches.**
7. **No service ID renames; no execution URL rewrites; no Phase 117 Managed Autofill semantic changes.**

### Explicit DO NOT list
- Strip arbitrary URL paths
- Assume same host ⇒ same service
- Merge by root domain
- Infer login pages from path names / discovery
- Add Rivhit-specific behavior
- Change existing service IDs
- Change execution URLs
- Change Phase 117 Managed Autofill semantics
- Restore Login Discovery on Custom Add (explicit login entry only remains)

## Root-cause mapping (current code — Manager observation)

| Location | Gap |
|----------|-----|
| `classifyAddCustomService` | Matches only `existing.url`; ignores `existing.loginUrl` |
| `upsertCustomServiceRegistryRow` duplicate scan | Selects/compares user `primary_url` only (not catalog `login_url`; global catalog convergence must happen **before** create) |
| `App.tsx` `addCustomService` catch | Maps unknown upsert failures → network-only user message |
| Catalog snapshot for classifier | Must expose `loginUrl` when registry has `login_url` (verify mapper pass-through; fix only if missing) |

## Affected Components

| Component | Path | Change type |
|-----------|------|-------------|
| Identity helpers | `src/supabase/registryPersistence.ts` | Possibly extend with a small “registered URL set” matcher (or keep helpers pure and match both URLs at call sites). Prefer one shared helper to avoid drift. |
| Custom Add classifier | `src/catalog/addCustomServiceOutcome.ts` | **Primary fix** — match entered URL against primary **and** loginUrl |
| Custom Add orchestrator | `src/App.tsx` (`addCustomService`) | Use updated classifier; **error class mapping** for upsert failures |
| Catalog definitions | `src/registry/registryMapper.ts` / loaders used by `snapshotCatalogForCustomAdd` | Ensure `loginUrl` populated for classifier |
| Verify / tests | `scripts/verifyPhase104ServiceManagement.mjs` and/or new `scripts/verifyPhase116*.mjs` | Regression suite for AC-116-3 convergence + error classes |
| Friendly copy | Local constants near Custom Add / `src/trust/friendlyErrors.ts` if reused | Safe Hebrew messages per failure class — no DB internals/secrets |

**Out of touch:** Phase 117 Managed Autofill modules (`src/autofill/*`, Managed extension runner, Managed Hub branch semantics), encryption/vault, Phase 108 discovery engines, Admin registry CRUD (unless required only to confirm catalog `login_url` visibility).

## Implementation Boundaries

### In scope
- Pre-insert identity convergence: entered URL ↔ `{primary_url, login_url?}` of existing services
- Preserve existing outcomes: `catalog_service_available`, `already_in_user_home`, `same_user_custom_duplicate`, `created`
- Clear reuse feedback (AC-116-4)
- Distinguish Custom Add failure classes (connectivity / auth-policy / persistence-validation / known duplicate-reuse)
- Automated + operator regression listed below
- Affirm Phase 117 Managed Autofill unchanged (regression PASS only)

### Out of scope
- Phase 117 feature work, Security Owner production `validated` activation
- Changing normalization rules beyond “apply existing key to both registered URLs”
- Homepage inference / deep-link crawling / Login Discovery
- Changing how Digital Home **opens** URLs
- Merging distinct path-based customs on the same host
- Admin console redesign

## Ordered Implementation Steps

| Step | Work | Done when |
|---:|---|---|
| **S0** | Confirm catalog snapshot used by Custom Add includes `loginUrl` when `login_url` is set | Fixture/read proves Rivhit-like definition exposes loginUrl |
| **S1** | Add shared helper e.g. `serviceMatchesRegisteredUrl(definition, enteredUrl)` / `urlsMatchRegisteredIdentitySet(primary, login?, entered)` using **existing** `urlsReferToSameService` against each registered URL | Unit tests: primary match; login match; neither; empty login ignored |
| **S2** | Update `classifyAddCustomService` global + local + registry-custom branches to use S1 (not primary-only) | Entering registered Login Entry → catalog reuse outcome; no create path |
| **S3** | Ensure cloud create path cannot bypass classifier (order remains: classify → only then `upsertCustomServiceRegistryRow`). Optionally harden user-row duplicate check without inventing host-merge | No new custom row when Login Entry matches catalog |
| **S4** | Error classification for upsert/cloud failures: map to safe user messages for (a) connectivity/transport (b) auth/authorization/policy (c) persistence/validation (d) known duplicate/reuse — never dump PostgREST/SQL secrets | Non-network failures no longer look like “check your network” only |
| **S5** | Automated regression suite (below) + extend Phase 104 classifier verify as needed | All required tests PASS |
| **S6** | Operator validation procedure (below) + Phase 117 Managed Autofill smoke | Evidence recorded in `dev-phase116.md` (or corrective section) |
| **S7** | Explicit Developer affirmation: **Phase 117 Managed Autofill code/semantics not modified** | Affirmation in evidence |

## Error Handling Design (required)

Preserve safe Hebrew UX. Distinguish **at minimum**:

| Class | Typical signals (implementation detail) | User-facing intent |
|-------|----------------------------------------|--------------------|
| Connectivity / transport | `Failed to fetch`, network offline, timeout | Check connection / try again |
| Authentication / authorization / policy | 401/403, RLS rejected, not authenticated | Sign-in / permission style message (no internals) |
| Persistence / validation | Constraint/validation upsert errors not covered by duplicate | Generic “could not save” — no SQL/schema dump |
| Known duplicate / reuse | `DuplicateCustomServiceError` / classifier outcomes | Existing reuse / already-in-home messaging (AC-116-4) |

**Do not** expose database internals, stack traces, or secrets to the user. DEV logging may remain for operators.

## Required Automated Tests

| # | Test | Expected |
|---:|---|---|
| R1 | Service with `primary_url` + `login_url`: enter **primary** | Same existing service ID |
| R2 | Same service: enter **login_url** | **Same** existing service ID as R1 |
| R3 | Enter Rivhit-like registered Login Entry | **No** new custom `service_registry` row; catalog reuse outcome |
| R4 | Existing homepage matching | Unchanged PASS |
| R5 | Existing Phase 116 URL normalization (www/http/trailing slash/case/query/fragment as currently encoded in `serviceUrlIdentityKey`) | PASS |
| R6 | Unregistered path on **same host** | Does **not** automatically match catalog service |
| R7 | Legitimate distinct path-based custom on same host | Remains distinct |
| R8 | Different subdomains | Not automatically merged |
| R9 | Existing duplicate-prevention (same-user custom / already in home) | PASS |
| R10 | Phase 117 Managed Autofill regression | Registered Login Entry still opens; deterministic fill/verify unchanged (**no 117 code change**) |
| R11 | Non-network persistence/auth/policy failure | **Not** presented as network-only failure |

Prefer pure unit tests for classifier/helper + static verify script; add integration-style fixtures where the repo pattern already supports them.

## Operator Validation Procedure

1. Ensure catalog Rivhit (or equivalent) has both Home and Login Entry registered.
2. Custom Add → paste **Login Entry** URL → expect resolve to existing Rivhit (reuse / add-to-home), **not** a new custom site.
3. Custom Add → paste **Home** URL → same service ID.
4. Custom Add → paste same-host **unregistered** deep path → does **not** bind to Rivhit; allowed as distinct custom only if product rules permit create.
5. Confirm Digital Home open still uses Login Entry when set (execution unchanged).
6. With Managed Autofill available in the validated environment: open Rivhit Login Entry + fill/verify still works (117 regression only).
7. Induce or simulate a non-network upsert failure (e.g. auth) and confirm message is **not** the generic network-only string.

## Rollback / Regression Considerations

- **Rollback:** Revert classifier/helper/error-mapping commits only; no schema migration expected for this correction.
- **Risk:** Over-broad matching (host-only) would incorrectly collapse services — mitigated by DO NOT list and R6–R8.
- **Risk:** Catalog definitions missing `loginUrl` would leave gap unfixed — mitigated by S0.
- **Risk:** Touching Managed Autofill — **forbidden**; R10 + S7 affirmation.
- Re-run Phase 104 Custom Add verify + any Phase 116 verify script after change.
- Do not couple this fix to Security Owner / broad production activation gates for Phase 117.

## Confirmation — Phase 117 Managed Autofill

**Manager binding:** This corrective plan **must not** modify Phase 117 Managed Autofill semantics, metadata contract, Hub Managed routing, extension Managed executor, or production `validated` activation rules.

Developer evidence **must** explicitly confirm: **Phase 117 Managed Autofill was not modified** (diff limited to Phase 116 Custom Add identity/error paths + tests).

Regression R10 only verifies behavior still PASS.

## Acceptance Criteria (corrective mapping)

| Criterion | Source |
|-----------|--------|
| Entered registered `login_url` resolves to existing service before create | AC-116-3 completion / Architecture decision |
| Entered registered `primary_url` still resolves | AC-116-1, AC-116-9 |
| Clear reuse feedback | AC-116-4 |
| Identity matching does not change execution target | AC-116-6 |
| No automatic subdomain / host-path merge beyond registered URL set | AC-116-8 + Architecture DO NOT |
| Failure messages distinguish classes; no network-only mislabel | Operator corrective requirement |
| Phase 117 unchanged + regression PASS | Parallel program constraint |

## STOP Conditions (corrective track)

- Proposal to match by hostname / root domain alone → **STOP**
- Proposal to strip arbitrary paths or “infer homepage” via discovery → **STOP**
- Proposal to add Rivhit-specific branches → **STOP**
- Proposal to change execution URLs or service IDs → **STOP**
- Proposal to modify Phase 117 Managed Autofill under this ticket → **STOP**
- Implementing before Architecture approval of this plan → **STOP**

## Required Developer Evidence (after Architecture approval + implementation)

`team-Yuri/dev-phase116.md` (corrective section) must include:

- Files changed (diff scope)
- S0–S7 completion notes
- Automated R1–R11 results
- Operator validation notes / screenshots as applicable
- Explicit statement: **Phase 117 Managed Autofill not modified**
- Affirmation: no host-only merge; no discovery restoration; identity ≠ execution preserved

## Out of Scope (summary)
- Phase 117 feature / Security production activation
- Login Discovery / path inference
- Admin UX modernization
- Encryption / vault / Phase 116 rule redesign beyond registered-URL set matching
- Broad production activation unblocking

## Risks / Open Questions
- If Architecture later expands “registered URL set” beyond `primary_url` + `login_url`, return to Architecture (do not invent aliases in this correction).
- Hebrew copy for new error classes: keep safe and short; Tika optional polish after structural mapping exists.
- Whether user-owned custom rows with only `primary_url` need symmetric loginUrl matching when present — **yes**, same identity set rule for consistency when `loginUrl` exists on that definition.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
- Corrective Detailed Design for **AC-116-3 Registered-URL Identity Convergence** + Custom Add error-class hygiene.
- STATUS: **READY_FOR_APPROVAL** — return to Architecture; **no Developer handoff** until approved.
- Explicit: **Phase 117 Managed Autofill is not modified** by this plan.

### Required Corrections
_Awaiting Architecture approval._
