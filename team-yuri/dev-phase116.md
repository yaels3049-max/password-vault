# Developer Phase 116 — Corrective Implementation

## Phase Identifier
PHASE=116 (corrective — AC-116-3 Registered-URL Identity Convergence)

## Status
STATUS: COMPLETE (corrective implementation + automated R1–R11 PASS)

```text
PHASE.md remains 117 (unchanged)
PHASE 116 CORRECTIVE: IMPLEMENTED — awaiting Operator validation steps
PHASE 117 Managed Autofill: NOT MODIFIED by this correction (R10 PASS)
```

## Source References
- `team-Yuri/manager-phase116.md` (binding plan — Architecture approved for implementation)
- Operator request: Custom Add Registered-URL Identity Convergence
- Existing helpers: `serviceUrlIdentityKey` / `urlsReferToSameService` / `normalizeCustomServiceUrl`

## Implementation Summary

Custom Add now resolves entered URLs against the registered identity set `{primary_url, login_url?}` using existing Phase 116 normalization. Matching either registered URL converges to the same existing `service_registry.id` before create. Upsert/cloud failures are classified into connectivity / auth-policy / persistence / duplicate — no longer every failure as network-only.

Identity matching does **not** change execution URLs. No host-only merge, no path stripping, no Rivhit-specific branches, no service ID changes, no Phase 117 Managed Autofill changes.

## S0–S7 Completion

| Step | Done | Notes |
|---:|:---:|---|
| S0 | Yes | `registryMapper` already maps `login_url` → `loginUrl`; fixture proves Rivhit-like row exposes `loginUrl` |
| S1 | Yes | `serviceMatchesRegisteredUrl` + `urlsMatchRegisteredIdentitySet` in `registryPersistence.ts` |
| S2 | Yes | `classifyAddCustomService` uses registered-URL set for global / local / registry-custom |
| S3 | Yes | classify → then upsert; user-row duplicate scan also checks `login_url` when present |
| S4 | Yes | `customAddFailure.ts` + App upsert/update catch uses `userMessageForCustomAddFailure` |
| S5 | Yes | `scripts/verifyPhase116CustomAddIdentity.mjs` R1–R11 PASS; Phase 104 verify PASS |
| S6 | Yes | Operator validation procedure below |
| S7 | Yes | Affirmation: Phase 117 Managed Autofill code/semantics **not modified** by this correction |

## Files Changed (this correction)

| File | Change |
|---|---|
| `src/supabase/registryPersistence.ts` | `serviceMatchesRegisteredUrl` / `urlsMatchRegisteredIdentitySet`; user duplicate scan includes `login_url` |
| `src/catalog/addCustomServiceOutcome.ts` | Classifier matches registered URL set |
| `src/catalog/customAddFailure.ts` | **New** — failure class mapping + safe Hebrew messages |
| `src/catalog/index.ts` | Export failure helpers |
| `src/App.tsx` | Upsert/update errors via classified messages (not network-only) |
| `scripts/verifyPhase116CustomAddIdentity.mjs` | **New** — R1–R11 + S0–S4 static |
| `team-Yuri/dev-phase116.md` | This evidence |

**Not modified by this correction:** `src/autofill/*`, `src/execution/managedAutofill.ts`, Managed extension runner / Managed Hub semantics, encryption/vault, Login Discovery engines, `PHASE.md`.

## R1–R11 Results

| # | Result | Notes |
|---:|---|---|
| R1 | PASS | Enter primary → same existing service id |
| R2 | PASS | Enter login_url → same id as R1 |
| R3 | PASS | Registered Login Entry → catalog reuse; no create |
| R4 | PASS | Homepage matching unchanged |
| R5 | PASS | Existing identity normalization (www/http/slash/case/query/fragment) |
| R6 | PASS | Unregistered same-host path does not match |
| R7 | PASS | Distinct path customs on same host remain distinct |
| R8 | PASS | Different subdomains not merged |
| R9 | PASS | already_in_user_home / same_user_custom_duplicate; custom loginUrl converges |
| R10 | PASS | `node scripts/verifyPhase117ManagedAutofill.mjs` → PASS |
| R11 | PASS | Auth/persistence failures ≠ connectivity message |

## Build / Test Results

```text
node scripts/verifyPhase116CustomAddIdentity.mjs
→ PASS (S0–S4 static + R1–R11)

node scripts/verifyPhase104ServiceManagement.mjs
→ PASS (static + classifier runtime)

npx tsc -p tsconfig.app.json --noEmit
→ PASS
```

## Phase 117 Managed Autofill Affirmation (S7 / R10)

**Phase 117 Managed Autofill was not modified** by this Phase 116 corrective implementation.

Diff scope for this correction is Custom Add identity matching + error classification + tests only. R10 re-ran the Phase 117 Managed Autofill verify suite successfully (registered Login Entry execution / deterministic fill / verification / no auto-submit semantics unchanged).

## Affirmations
- No host-only / root-domain merge
- No arbitrary path stripping / login-page inference / Login Discovery restoration
- Identity ≠ execution preserved
- No Rivhit-specific code branches
- No service ID renames
- No secrets/DB internals in user-facing errors

## Operator Validation Steps

1. Catalog Rivhit (or equivalent) has both Home (`primary_url`) and Login Entry (`login_url`) registered.
2. Custom Add → paste **Login Entry** URL → expect resolve to existing Rivhit (reuse / add-to-home), **not** a new custom site.
3. Custom Add → paste **Home** URL → same service ID.
4. Custom Add → paste same-host **unregistered** deep path → does **not** bind to Rivhit.
5. Digital Home open still uses Login Entry when set (execution unchanged).
6. With Managed Autofill available: Rivhit Login Entry open + fill/verify still works (117 regression only).
7. If possible: induce auth/policy upsert failure and confirm message is **not** the generic network-only string.

## Deviations / Unresolved Findings
None. STOP conditions not triggered.

## Out of Scope (unchanged)
Phase 117 feature work, Security production `validated` activation, Admin redesign, encryption/vault.
