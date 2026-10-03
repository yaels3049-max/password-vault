# Manager Phase 121

## Phase Identifier
PHASE=121

## Status
STATUS: **READY_FOR_APPROVAL** — Slice **121.2** Detailed Design (FLOATING_SCREEN runtime via the shared Login Flow Orchestrator — Admin Test «בדיקת מילוי» SPECIAL route + Digital Home)  
Architecture **DD review required**. **STOP after DD.** **No Developer handoff. No implementation** until Architecture PASS on this DD.  
**121.0-impl CLOSED.** **121.1 DD PASS**; 121.1 corrections D-121-22…36 closed per `arch-phase121.md`. **121.1-IF DD PASS (A1–A2) + impl PASS (offline) + D-121-29.** **121.3+** remains **NOT AUTHORIZED**.

## Slice authorization
| Slice | Status |
|---|---|
| **Architecture** `arch-phase121.md` | **OWNER ACCEPTED — FROZEN** (+ §4.10 / §4.10.1, D-121-28…38) |
| **121.0** DRAFT/ACTIVE + discriminator + ACTIVATE | **CLOSED** |
| **121.1** SPECIAL DRAFT authoring | **DD PASS**; corrections per arch log |
| **121.1-IF** generic iframe credential surface | **DD PASS** (A1–A2); **impl PASS (offline)**; D-121-29 handshake PASS |
| **D-121-38 Part A** (grid relocation, STANDARD route, SPECIAL options disabled) | Developer track (prerequisite of 121.2-impl, see §RT-0) |
| **121.2** FLOATING_SCREEN runtime (shared orchestrator) | **AUTHORIZED** (Owner 2026-09-28) — **DD READY_FOR_APPROVAL** (Manager only) |
| **121.2-impl** | **NOT AUTHORIZED** until Architecture PASS on this DD |
| **121.3+** (MULTI_STEP, composition, …) | **NOT AUTHORIZED** |
| Phase 120 STANDARD path change | **FORBIDDEN** |

## Source (authoritative)
- `team-Yuri/arch-phase121.md` §4.4–§4.6, §5 / §5.1 (C3), §6, §7, §8.3 (C8 representation), §15 row **121.1**
- 121.0 shipped: `planLoginContractActivate`, `createImmutableDraftSnapshot`, persist keys `loginContractActivation` / `loginFlowPlan`
- 121.1-IF: `arch-phase121.md` §4.10 (D-121-28), §4.6.1 (D-121-27), §4.9 (D-121-25), §5.2 (D-121-26), §2.2 trigger
- 121.2: `arch-phase121.md` §1.3, §1.5, §7.3, §8.1–§8.7, §11, §12 / §12.1, §13, §14, §15 row 121.2, §4.10 runtime + §4.10.1 (D-121-29), D-121-35 / D-121-36, D-121-38 Part B, 121.1-IF-impl review note ("121.2 runtime must re-validate R2 from the active plan, not from the message")

---

# Slice 121.0 — Detailed Design: DRAFT / ACTIVE Login Contract Model — HISTORICAL (CLOSED)

## Goal
Establish the **persisted representation and atomic ACTIVATE semantics** for Phase 121 login contracts:

1. **DRAFT / ACTIVE** model (authoring vs Digital Home authority)  
2. **`loginContractActivation` discriminator** (`STANDARD` \| `SPECIAL` + required `activePlanVersion` when SPECIAL)  
3. **Atomic ACTIVATE** transitions: STANDARD↔STANDARD, STANDARD↔SPECIAL, SPECIAL↔SPECIAL, SPECIAL↔STANDARD  
4. **Immutable DRAFT snapshot contract** (representation/contract only — **no** SPECIAL runtime execution)  
5. **Exact persist naming** after repository evidence  
6. **STANDARD remains frozen Phase 120** — no `loginFlowPlan.active` required; no orchestrator  

**121.0 does not** execute SPECIAL flows, build SPECIAL authoring UI beyond model needs, or introduce the Login Flow Orchestrator.

## Binding principles (from Architecture)
```text
Service availability  ≠  ACTIVE login contract  ≠  Special-flow plan
service_status        ≠  loginContractActivation ≠  loginFlowPlan.active

CONFIGURE → (later TEST) → ACTIVATE → EXECUTE saved contract
Editing DRAFT MUST NOT change Digital Home until ACTIVATE succeeds
```

D-121-1 / D-121-16 / D-121-18 / D-121-19 apply.

---

## Hard stops (121.0)
| Forbidden | |
|---|---|
| Any SPECIAL runtime execution (Admin Test or Digital Home) | STOP |
| Requiring `loginFlowPlan` / `loginFlowPlan.active` for STANDARD | STOP |
| Mixed / non-atomic discriminator + plan writes (observable half-states) | STOP |
| 121.1 SPECIAL authoring UI beyond what 121.0 model/types need | STOP |
| Early 121.2/121.3 orchestrator / opener / transition / fill execution | STOP |
| Changing Phase 120 STANDARD authoring, `autofillProfile` planner, Managed fill, eligibility | STOP |
| Inferring mode from site/DOM/DRAFT/`service_status`/`loginFlowPlan.active` absence alone | STOP |
| Silent STANDARD/Generic fallback when SPECIAL ACTIVE invalid | STOP |
| Developer impl before Architecture PASS on this DD | STOP |

---

## 1. Exact persist naming (repository evidence)

### 1.1 Existing Phase 120 bag (unchanged)
| Persist key | Constant / location | Role |
|---|---|---|
| `metadata.autofillProfile` | `AUTOFILL_PROFILE_META_KEY = 'autofillProfile'` | **STANDARD** Managed Autofill SoT — frozen |

### 1.2 Phase 121 keys (finalize — sibling keys in same metadata bag)

| Persist key (exact string) | TypeScript constant (impl) | Role |
|---|---|---|
| **`loginContractActivation`** | `LOGIN_CONTRACT_ACTIVATION_META_KEY = 'loginContractActivation'` | ACTIVE login contract **discriminator** |
| **`loginFlowPlan`** | `LOGIN_FLOW_PLAN_META_KEY = 'loginFlowPlan'` | SPECIAL plan SoT: `{ draft, active }` |

**Storage location:** `service_registry.metadata` — same JSON metadata object as `autofillProfile` (C1).  
**Do not** nest Phase 121 keys under `autofillProfile`.  
**Do not** put SPECIAL field mappings into `autofillProfile.fieldMappings`.

### 1.3 Discriminator shape (exact)

```text
metadata.loginContractActivation:

  // STANDARD (explicit)
  { "mode": "STANDARD" }

  // SPECIAL (explicit — both fields required)
  {
    "mode": "SPECIAL",
    "activePlanVersion": <number>   // MUST equal metadata.loginFlowPlan.active.planVersion
  }

  // MISSING key / null / unrecognized → treat as STANDARD (backward compat ONLY)
  // MUST NOT apply this default if service was explicitly activated as SPECIAL
  // under Phase 121 and then corrupted — corrupt SPECIAL → FAIL CLOSED at resolution
  // (runtime slices); 121.0 defines validation rules for ACTIVATE writers.
```

| mode | `loginFlowPlan.active` | `activePlanVersion` |
|---|---|---|
| **STANDARD** | **Not** required | **Not** required (omit field) |
| **SPECIAL** | **REQUIRED** (complete document) | **REQUIRED**; MUST equal `loginFlowPlan.active.planVersion` |

### 1.4 `loginFlowPlan` shape (exact persist document)

```text
metadata.loginFlowPlan: {
  draft: LoginFlowPlanDocument | null
  active: LoginFlowPlanDocument | null
}

LoginFlowPlanDocument {
  planVersion: number                    // monotonic; set/bumped on successful SPECIAL ACTIVATE
  pattern: "FLOATING_SCREEN" | "MULTI_STEP" | "FLOATING_SCREEN_MULTI_STEP"
  preambleActions?: FlowAction[]
  steps: FlowStep[]
  // no finalAuthAction
}

FlowStep {
  stepId: string
  fieldMappings: AutofillFieldMapping[] | SplitFieldMapping[]  // Split unused until 121.6
  exitTransition?: FlowAction
}

FlowAction {
  actionId: string
  kind: "floating_opener" | "intermediate_transition"
  label: string
  locatorType: "css"
  locator: string
  approvedForAuthoringContinuation?: boolean
  approvedForRuntime: boolean
  readiness: ReadinessCondition
}

ReadinessCondition (121.0 representation — Q3 minimal vocabulary)
{
  kind: "exact_one_eligible_css"   // v1 candidate from Architecture Q3
  locatorType: "css"
  locator: string
  timeoutMs: number                // bounded; exact defaults deferred to runtime slices
}
```

**121.0:** Persist/parse/validate **structure** only. **Do not** execute readiness. Incomplete DRAFT allowed in `draft`; **ACTIVE** SPECIAL plan must be complete at ACTIVATE (see §4).

### 1.5 No dual-write invariant
| Content | Allowed SoT |
|---|---|
| SPECIAL openers / transitions / readiness / step mappings | **`loginFlowPlan` only** |
| STANDARD field mappings / supportState | **`autofillProfile` only** |
| Entry URL / allowedOrigin | May remain on `autofillProfile` for both (no SPECIAL locators there) |

---

## 2. DRAFT / ACTIVE model

### 2.1 Three authorities (binding)

| Authority | Persist | Selects |
|---|---|---|
| **A. Service availability** | Existing `service_status` (e.g. `active` / `disabled`) | Whether service appears in customer Digital Home |
| **B. ACTIVE login contract** | `metadata.loginContractActivation` | STANDARD vs SPECIAL for DH execution |
| **C. SPECIAL plan content** | `metadata.loginFlowPlan.active` | SPECIAL steps when mode=SPECIAL |

### 2.2 DRAFT vs ACTIVE (login contract)

| Concept | Meaning | DH authority? |
|---|---|---|
| **DRAFT** | Admin authoring workspace: pattern selection, incomplete SPECIAL plan in `loginFlowPlan.draft`, unsaved STANDARD edits per Phase 120 | **Never** |
| **ACTIVE login contract** | Last successful ACTIVATE result: discriminator + (if SPECIAL) complete `loginFlowPlan.active` | **Yes** (when service available) |
| **ACTIVATE** | Atomic write that replaces ACTIVE login contract from validated DRAFT / Phase 120 STANDARD activation | — |

### 2.3 Edit while ACTIVE
| Step | Binding |
|---|---|
| While editing | Previous ACTIVE login contract remains DH authority |
| Admin work | Updates **DRAFT** only (`loginFlowPlan.draft` and/or Phase 120 draft form state) |
| Successful ACTIVATE | Atomic transition (§4) |
| Abandon / ACTIVATE failure | Previous ACTIVE **unchanged** |

### 2.4 Terminology
Prefer: DRAFT / ACTIVE / ACTIVATE / INACTIVE / NOT READY.  
Activation = activating a **customer’s configuration**, not deploying software.

---

## 3. Immutable DRAFT snapshot contract (C8 — representation only in 121.0)

### 3.1 Purpose
Define the **data contract** Admin Test will later use (121.2+) to validate SPECIAL behavior **before** ACTIVATE — without implementing execution now.

### 3.2 Snapshot definition
```text
ImmutableDraftSnapshot = deep freeze/copy of LoginFlowPlanDocument
  taken from metadata.loginFlowPlan.draft at "snapshot create" time
  + optional snapshotId / createdAt (Hub-only, not required in metadata persist)
```

| Property | Binding |
|---|---|
| Immutability | Snapshot **must not** change if Admin continues editing `draft` after snapshot creation |
| Completeness | Incomplete/invalid snapshot → future Admin Test **FAIL CLOSED** (same rules as invalid ACTIVE) |
| Side effects | Creating/holding a snapshot **MUST NOT** ACTIVATE, write `loginFlowPlan.active`, mutate discriminator, or change DH |
| Persist of snapshot | **121.0 does not require** storing snapshots in registry metadata — in-memory / ephemeral for future Test is OK; if persisted, must be clearly non-ACTIVE (out of 121.0 minimum) |

### 3.3 121.0 deliverable for snapshots
- TypeScript type + pure builder: `createImmutableDraftSnapshot(draft) → Snapshot | ValidationError`  
- Validation rules shared with ACTIVE completeness checks where applicable  
- **No** Ext message, **no** orchestrator call, **no** Admin Test SPECIAL run  

---

## 4. Atomic ACTIVATE transitions (§7.3.D)

### 4.1 Planner surface (Hub)
Introduce a dedicated ACTIVATE planner (name free, e.g. `planLoginContractActivate`) that:

1. Reads **current** metadata (`loginContractActivation`, `loginFlowPlan`, `autofillProfile`)  
2. Accepts an explicit ACTIVATE intent + payload  
3. Returns **one atomic metadata patch** (all keys together) **or** fail with previous state unchanged  

Registry write path must apply the patch as a **single metadata update** (same transaction/write as today’s Admin save). Partial application after validation PASS is **forbidden**.

### 4.2 Transition matrix

| Transition | Preconditions | Atomic write on success |
|---|---|---|
| **STANDARD → STANDARD** | Phase 120 STANDARD activate/update rules PASS (`planAutofillProfileWrite` / `activate_validated` as today) | Update `autofillProfile` per Phase 120; set/keep `loginContractActivation = { mode: "STANDARD" }` (or leave missing ≡ STANDARD); **do not** require/create `loginFlowPlan.active` |
| **STANDARD → SPECIAL** | Complete SPECIAL **draft** validates (§4.4); Phase 120 STANDARD path not used for SPECIAL content | Set `loginContractActivation = { mode: "SPECIAL", activePlanVersion: V }`; set `loginFlowPlan.active = completeDoc` with `planVersion: V`; draft may remain or clear per product choice (DD default: **keep draft** copy unless Admin clears) |
| **SPECIAL → SPECIAL** | Replacement **draft** validates complete; version bump `V' > active.planVersion` (or equal-replace with new content + new version — **require bump**) | Atomically replace `loginFlowPlan.active` + `activePlanVersion`; previous ACTIVE unchanged until success |
| **SPECIAL → STANDARD** | Phase 120 STANDARD contract validated/activated **in the same logical ACTIVATE** | Atomically: apply STANDARD `autofillProfile` activate; set `loginContractActivation = { mode: "STANDARD" }`; **retire** SPECIAL active authority (`loginFlowPlan.active = null` and omit `activePlanVersion`) |

### 4.3 Failure / forbidden observable states
| Case | Binding |
|---|---|
| ACTIVATE fails validation or write | Previous ACTIVE contract **unchanged** |
| Forbidden | `mode=STANDARD` + partially written SPECIAL active plan |
| Forbidden | `mode=SPECIAL` + missing `active` / missing `activePlanVersion` / version mismatch |
| Forbidden | Writing discriminator in one request and plan in another without atomic planner |

### 4.4 SPECIAL complete-draft validation (ACTIVATE gate)
Before SPECIAL ACTIVATE, draft MUST have:

- `pattern` ∈ allowed SPECIAL patterns  
- `planVersion` assigned by planner on activate (from draft version or new bump)  
- At least one step with fieldMappings (non-empty) **or** architecture-minimum for pattern (FLOATING_SCREEN may require preamble opener — if incomplete → FAIL)  
- Every `FlowAction` used at runtime marked `approvedForRuntime: true`  
- Every readiness object structurally valid  
- **No** dual-write of SPECIAL mappings into `autofillProfile.fieldMappings`  

Exact “minimum steps per pattern” details may be tightened in 121.1 authoring; 121.0 must reject empty/corrupt ACTIVE candidates.

### 4.5 STANDARD path protection
| Rule | Binding |
|---|---|
| Existing Phase 120 services | Missing `loginContractActivation` → **STANDARD**; existing activate_validated **unchanged** |
| STANDARD ACTIVATE | Must not create `loginFlowPlan.active` |
| STANDARD runtime | Must not call Phase 121 orchestrator (orchestrator absent in 121.0 anyway) |
| Regression | Phase 117–120 STANDARD suites must PASS after 121.0-impl |

### 4.6 Resolution helper (read-only, 121.0)
```text
resolveActiveLoginContract(metadata) →
  | { mode: 'STANDARD' }
  | { mode: 'SPECIAL', plan: LoginFlowPlanDocument, activePlanVersion: number }
  | { mode: 'SPECIAL_INVALID', reason }   // for future FAIL CLOSED — no fallback

Rules:
  missing/null activation → STANDARD
  mode STANDARD → STANDARD (ignore loginFlowPlan.active for routing)
  mode SPECIAL → require active + matching activePlanVersion else SPECIAL_INVALID
```

**121.0:** Implement resolve + validate for tests/planner. **Do not** wire Digital Home or Admin Test SPECIAL execution to it yet.

---

## 5. What 121.0 implements vs defers

| Deliverable | In 121.0-impl (after Arch PASS) | Deferred |
|---|---|---|
| Meta keys + parse/serialize + types | **Yes** | — |
| Atomic ACTIVATE planner + registry merge | **Yes** | — |
| Immutable snapshot builder/validator | **Yes** (pure) | Execution |
| Minimal Admin affordance to ACTIVATE STANDARD/SPECIAL using model | **Only if** needed to exercise ACTIVATE (prefer Hub/API + thin UI); not full 121.1 plan editor | Full SPECIAL authoring UI |
| SPECIAL Admin Test / DH / orchestrator | **No** | 121.2+ |
| Progressive action approval UI | **No** | 121.1 |
| Readiness runtime polling | **No** | 121.2+ |

---

## 6. Acceptance criteria (AC-121.0-*)

| ID | Criterion |
|---|---|
| AC-121.0-1 | Exact persist keys: `loginContractActivation`, `loginFlowPlan` siblings of `autofillProfile` |
| AC-121.0-2 | Discriminator shapes: STANDARD / SPECIAL(+activePlanVersion) / missing≡STANDARD |
| AC-121.0-3 | SPECIAL requires matching `loginFlowPlan.active.planVersion` |
| AC-121.0-4 | Atomic ACTIVATE: STANDARD→STANDARD, STANDARD→SPECIAL, SPECIAL→SPECIAL, SPECIAL→STANDARD |
| AC-121.0-5 | ACTIVATE failure leaves previous ACTIVE unchanged |
| AC-121.0-6 | Forbidden mixed states rejected by planner |
| AC-121.0-7 | STANDARD never requires `loginFlowPlan.active`; no orchestrator |
| AC-121.0-8 | No dual-write SPECIAL mappings into `autofillProfile.fieldMappings` |
| AC-121.0-9 | Immutable DRAFT snapshot contract defined; snapshot ≠ ACTIVATE |
| AC-121.0-10 | No SPECIAL runtime execution in 121.0 |
| AC-121.0-11 | Phase 120 STANDARD regression suite PASS after impl |
| AC-121.0-12 | 121.1+ not started |

Manager self-check (DD completeness): **PASS**.

---

## 7. Regression / evidence requirements (post-impl only)

_Not a handoff — when Architecture PASS + 121.0-impl authorized:_

1. Unit tests: parse/serialize discriminator + plan; version match; missing→STANDARD.  
2. ACTIVATE transition table tests (success + fail leaves prior ACTIVE).  
3. Forbidden mixed-state rejection tests.  
4. Snapshot immutability: mutate draft after snapshot → snapshot unchanged.  
5. Proof STANDARD activate path does not write `loginFlowPlan.active`.  
6. Phase 120 Managed STANDARD regression suite PASS.  
7. Statement: no SPECIAL Ext/orchestrator/Admin Test SPECIAL execution shipped.  

---

## 8. Out of scope
- SPECIAL Admin Test execution / Digital Home SPECIAL  
- Login Flow Orchestrator  
- Full SPECIAL DRAFT authoring UI / progressive approval (121.1)  
- FLOATING_SCREEN / MULTI_STEP runtime (121.2+)  
- Split credential / tel investigation  
- Changing Phase 120 Analyze/Visual/fill/eligibility  

---

## Manager Review (121.0)
MANAGER_REVIEW_STATUS: **CLOSED** (historical — DD PASS + 121.0-impl ACCEPTED)

### Review Notes
121.0 persist model + ACTIVATE planner + immutable DRAFT snapshot contract. Active work: **Slice 121.1** at end of this file.

### Exact next step
_(historical)_ Do not reopen 121.0.

---

## Prompt — Architect (Yuri) — 121.0 HISTORICAL

```text
_(superseded — 121.0 CLOSED)_
```

---

# Slice 121.1 — Detailed Design: SPECIAL DRAFT Authoring + Progressive Approval

## Goal
Enable Admin to **author SPECIAL login DRAFT** configuration (`loginFlowPlan.draft`) with:

1. Pattern selection (`FLOATING_SCREEN` | `MULTI_STEP` | `FLOATING_SCREEN_MULTI_STEP`)  
2. Progressive action approval (C3 / §5.1) — no system click before Admin approval  
3. Current-surface reuse of Phase 120 credential-field Analyze/Visual **semantics** via additive existing-tab entry (§4.6)  
4. Visual Mapping as **explicit Admin choice only** (never automatic fallback)  
5. SPECIAL mappings persist **only** to `loginFlowPlan.draft.steps[*].fieldMappings`  
6. Build/validate immutable DRAFT snapshot **representation** (wire `createImmutableDraftSnapshot` — **no** execution)  
7. Thin ACTIVATE entry calling existing `planLoginContractActivate` (authoring → ACTIVATE; **no** SPECIAL runtime)

**121.1 does not** run SPECIAL Admin Test, Digital Home SPECIAL, or Login Flow Orchestrator.

## Binding principles
```text
service_status ≠ loginContractActivation ≠ loginFlowPlan
Missing loginContractActivation ≡ STANDARD

DRAFT edits MUST NOT change Digital Home until ACTIVATE
SPECIAL field mappings → loginFlowPlan.draft ONLY
autofillProfile.fieldMappings → STANDARD Phase 120 ONLY

Phase 121 owns: tab/surface progression + opener/transition routing
Phase 120 owns: field discovery/confidence/eligibility/locator determinism/Visual pick semantics ON current surface
```

---

## Hard stops (121.1)
| Forbidden | |
|---|---|
| Any SPECIAL runtime execution (Admin Test or Digital Home) | STOP |
| Login Flow Orchestrator / opener-transition-fill **execution engine** for DH/Test | STOP |
| Temporary/test-only SPECIAL execution engine | STOP |
| Duplicate Admin Test runtime | STOP |
| Early 121.2 / 121.3 work | STOP |
| Dual-write SPECIAL mappings into `autofillProfile.fieldMappings` | STOP |
| Calling complete STANDARD Analyze/Visual entry that **reopens Login Entry** after SPECIAL surface revealed | STOP |
| Changing Phase 120 STANDARD Analyze/Visual/fill/eligibility | STOP |
| Automatic Visual Mapping fallback | STOP |
| Unapproved system click of opener/transition | STOP |
| Developer impl before Architecture PASS on this DD | STOP |

---

## 1. Admin SPECIAL DRAFT authoring — pattern + draft plan

### 1.1 Pattern selector (DRAFT-only)
| Rule | Binding |
|---|---|
| UI | Admin «אופי הכניסה» (or equivalent) binds to **DRAFT** only |
| Values | `STANDARD` \| `FLOATING_SCREEN` \| `MULTI_STEP` \| `FLOATING_SCREEN_MULTI_STEP` |
| `STANDARD` / absent | Existing Phase 120 Autofill Profile Editor path **UNCHANGED** — no Phase 121 orchestration |
| SPECIAL patterns | Enter SPECIAL DRAFT authoring shell; initialize/ensure `metadata.loginFlowPlan.draft` |
| Selector change | Does **not** ACTIVATE; does **not** mutate `loginContractActivation` |

### 1.2 DRAFT document lifecycle
| Action | Persist |
|---|---|
| Save DRAFT | Write `metadata.loginFlowPlan.draft` only (registry metadata merge; **not** ACTIVATE intent) |
| Incomplete draft | Allowed in `draft` |
| ACTIVE | Unchanged until thin ACTIVATE (§7) |

### 1.3 Minimum DRAFT structure while authoring
```text
loginFlowPlan.draft: {
  planVersion: number          // authoring version; ACTIVATE assigns ACTIVE version via 121.0 planner
  pattern: FLOATING_SCREEN | MULTI_STEP | FLOATING_SCREEN_MULTI_STEP
  preambleActions?: FlowAction[]   // openers (FLOATING_SCREEN*)
  steps: FlowStep[]                // ordered; each may have fieldMappings + exitTransition
}
```

Admin may add/edit:
- Opener / transition `FlowAction` candidates (locator, label, kind, readiness, approval flags)  
- Step `fieldMappings` (Phase 120 mapping shape)  
- Step exit transitions  

---

## 2. Progressive action approval (C3 / §5.1)

### 2.1 Normative sequence
```text
Analyze current SPECIAL surface (Phase 121 routing)
  → AI proposes opener/transition candidate(s) and/or field proposals for THIS surface only
  → show candidate + locator + confidence to Admin
  → Admin explicitly approves action for authoring continuation
       (approvedForAuthoringContinuation = true)
  → ONLY THEN may authoring perform the click (Admin-gated click helper)
  → wait for next surface (bounded readiness — authoring wait only; not DH orchestrator)
  → analyze next fields/action
  → repeat as required
  → final plan review
  → Save DRAFT / ACTIVATE (§7)
```

### 2.2 Binding rules
| Rule | Binding |
|---|---|
| Unapproved candidate | **Never** clicked automatically — including Analyze continuation |
| `approvedForRuntime` | Separate from authoring continuation; required before SPECIAL ACTIVATE completeness (121.0 validate) |
| Visual Mapping for actions | Equivalent controlled sequence: Admin picks → confirms → then continuation click |
| STANDARD | Progressive sequence **does not** apply |

### 2.3 Authoring click helper (121.1 — not orchestrator)
- Narrow Admin-only Ext/Hub helper to click an **already-approved** locator on the **current tab** and optionally wait for readiness condition defined on the action.  
- **Must not** be Digital Home path, Admin Test SPECIAL runner, or Login Flow Orchestrator.  
- **Must not** fill credentials or submit forms.  
- Failure → honest authoring error; DRAFT unchanged unless Admin saves.

---

## 3. Current-surface Phase 120 field semantics (§4.6)

### 3.1 Phase 121 owns (SPECIAL authoring orchestration)
- Opening/reusing the authoring tab  
- Presenting opener/transition proposals (SPECIAL Analyze **routing**)  
- Gating progressive clicks (§2)  
- Authoring readiness wait between surfaces  
- Ensuring SPECIAL Visual/Analyze field tools target **current / already-open** surface  

### 3.2 Once required SPECIAL surface is open — reuse Phase 120 semantics
On that surface, reuse **without forking**:
- Page observation / field-discovery semantics  
- AI semantic mapping (120.8 identity decoupling)  
- HIGH / MEDIUM confidence  
- Managed eligibility / safety (120.4/120.6)  
- Locator determinism (120.9)  
- Visual target-selection / verification / provenance  

**MUST NOT** introduce a second field-discovery engine, weaker thresholds, or SPECIAL-only fill interpretation.

### 3.3 Additive existing-tab entry (critical)
| Required | Forbidden |
|---|---|
| New Hub/Ext entry: inspect / Visual-pick **current tab** (existing-tab / current-surface) | Calling complete STANDARD Analyze / `ADMIN_VISUAL_MAPPING_START` paths that **open/reopen Login Entry** after SPECIAL surface is revealed |
| Keep SPECIAL revealed surface | Destroying authoring state by navigation back to Login Entry solely to start field tools |

**STANDARD Analyze / Visual entry paths remain completely unchanged** for `pattern=STANDARD`.

### 3.4 SPECIAL Analyze routing vs Phase 120 field-Analyze
When «Analyze Login Page» proposes a floating opener / intermediate transition under SPECIAL DRAFT:
- That is **Phase 121 SPECIAL authoring routing** under the same button.  
- Do **not** claim Phase 120 credential-field Analyze already understands openers/transitions.

```text
configured entry URL
→ SPECIAL routing proposes opener/transition (Phase 121)
→ Admin may choose Visual Mapping to identify opener/transition (explicit)
→ Admin approves
→ authoring click
→ readiness / next SPECIAL surface
→ field Analyze/Visual on CURRENT surface (Phase 120 semantics via existing-tab entry)
```

---

## 4. Visual Mapping — explicit Admin choice only

| Rule | Binding |
|---|---|
| Never automatic fallback when Analyze fails | **Binding** |
| SPECIAL context | Phase 121 keeps current special-flow tab/surface; reuse Phase 120 Visual pick/eligibility/determinism/provenance on that surface |
| Do not reopen Login Entry merely to start Visual | **Binding** |
| Isolation | STANDARD Visual path must not enter special-flow pick modes unless Admin is in SPECIAL DRAFT authoring context |
| Modes (additive) | May select: floating opener; intermediate transition; readiness-related element if required; special-flow credential fields |

---

## 5. Persistence — SPECIAL mappings ONLY in draft plan

| Content | Persist target |
|---|---|
| SPECIAL step field mappings | `metadata.loginFlowPlan.draft.steps[*].fieldMappings` **only** |
| SPECIAL openers / transitions / readiness | `draft.preambleActions` / `steps[*].exitTransition` **only** |
| STANDARD field mappings | `metadata.autofillProfile.fieldMappings` **only** |

**Dual-write forbidden.** Save DRAFT must reject or strip any attempt to copy SPECIAL locators into `autofillProfile.fieldMappings`.

Entry URL / `allowedOrigin` may remain on `autofillProfile` without storing SPECIAL field locators there.

---

## 6. Immutable DRAFT snapshot representation (no execution)

### 6.1 Wire existing 121.0 API
- Use `createImmutableDraftSnapshot(draft)` from `src/loginContract/draftSnapshot.ts`  
- Admin affordance: create/validate snapshot completeness for ACTIVATE readiness preview  

### 6.2 Binding
| Rule | Binding |
|---|---|
| Snapshot = deep freeze/copy at create time | Editing `draft` afterward does not mutate snapshot |
| Incomplete snapshot | Validation fail / `isComplete=false` — authoring preview only in 121.1 |
| Side effects | Snapshot create **MUST NOT** ACTIVATE, write `loginFlowPlan.active`, change discriminator, or run SPECIAL fill |
| Execution | **None** in 121.1 |

---

## 7. Thin ACTIVATE entry (reuse 121.0 planner)

### 7.1 UI / Hub
Provide thin Admin control(s):
- **ACTIVATE SPECIAL** from current complete DRAFT → `planLoginContractActivate` with `STANDARD_TO_SPECIAL` or `SPECIAL_TO_SPECIAL`  
- **ACTIVATE STANDARD** / switch back → Phase 120 activate + `SPECIAL_TO_STANDARD` / `STANDARD_TO_STANDARD` as applicable  

### 7.2 Binding
| Rule | Binding |
|---|---|
| All ACTIVATE writes | Go through existing atomic planner (`planLoginContractActivate` + `loginContractActivateIntent`) |
| No new activate semantics | Do not bypass 121.0 mixed-state / version / completeness gates |
| No SPECIAL runtime after ACTIVATE in this slice | DH SPECIAL still not authorized until 121.2+ |
| DRAFT save ≠ ACTIVATE | Explicit |

---

## 8. Authoring UX surfaces (121.1 minimum)

| Surface | Purpose |
|---|---|
| Pattern selector | DRAFT pattern |
| SPECIAL DRAFT plan editor | Steps / actions / mappings list (structured) |
| Progressive approval panel | Show candidate action; Approve / Reject; then Continue |
| Current-surface Analyze / Visual | Field + action identification without Login Entry reopen |
| Snapshot validate | Completeness preview |
| Save DRAFT | Persist `loginFlowPlan.draft` |
| ACTIVATE | Thin entry to 121.0 planner |

Hebrew labels OK; no site-specific copy.

---

## 9. Acceptance criteria (AC-121.1-*)

| ID | Criterion |
|---|---|
| AC-121.1-1 | SPECIAL DRAFT authoring for FLOATING_SCREEN / MULTI_STEP / FLOATING_SCREEN_MULTI_STEP patterns |
| AC-121.1-2 | Progressive approval: no unapproved system click |
| AC-121.1-3 | Current-surface field Analyze/Visual reuse Phase 120 semantics; additive existing-tab entry |
| AC-121.1-4 | Does not call STANDARD entry paths that reopen Login Entry after SPECIAL surface revealed |
| AC-121.1-5 | Visual Mapping explicit Admin choice only — never automatic fallback |
| AC-121.1-6 | SPECIAL mappings persist only to `loginFlowPlan.draft.steps[*].fieldMappings` |
| AC-121.1-7 | No dual-write to `autofillProfile.fieldMappings` |
| AC-121.1-8 | Snapshot create/validate via `createImmutableDraftSnapshot`; no ACTIVATE side effect |
| AC-121.1-9 | Thin ACTIVATE uses `planLoginContractActivate` only |
| AC-121.1-10 | No SPECIAL runtime / orchestrator / Admin Test SPECIAL execution |
| AC-121.1-11 | STANDARD Analyze/Visual/fill/eligibility unchanged; missing activation ≡ STANDARD |
| AC-121.1-12 | Phase 120 STANDARD regression PASS after impl |

Manager self-check (DD completeness): **PASS**.

---

## 10. Regression / evidence (post-impl only)

_Not a handoff — after Architecture PASS + 121.1-impl auth:_

1. Progressive approval: unapproved click blocked.  
2. Persist: SPECIAL mappings only under `loginFlowPlan.draft`; dual-write rejected.  
3. Existing-tab Analyze/Visual does not reopen Login Entry in SPECIAL progression fixture (synthetic).  
4. Visual not auto-invoked on Analyze fail.  
5. Snapshot immutability + no ACTIVATE side effect.  
6. ACTIVATE still routed only through 121.0 planner tests.  
7. STANDARD path regression suite PASS.  
8. Statement: no orchestrator / SPECIAL Admin Test / DH SPECIAL execution.

---

## 11. Out of scope
- SPECIAL Admin Test execution / Digital Home SPECIAL  
- Shared Login Flow Orchestrator (121.2+)  
- Full production-grade readiness polling beyond authoring wait helper  
- Split credential / tel investigation  
- Changing 121.0 persist keys or ACTIVATE matrix  

---

## Manager Review (121.1)
MANAGER_REVIEW_STATUS: **CLOSED — DD PASS** (Architecture 2026-09-24). 121.1-impl reopened by Owner for D-121-22…27 (Track A); tracked in `arch-phase121.md` / `dev-phase121.md`, not in this file.

---

# Slice 121.1-IF — Detailed Design: Generic iframe Credential Surface (SPECIAL authoring)

## IF-0. Source, trigger, class

| Item | Value |
|---|---|
| Authority | `arch-phase121.md` §4.10 (D-121-28, OWNER APPROVED 2026-09-27); §2.2 trigger FIRED |
| Interacts with | §4.6.1 D-121-27 (session tab), §4.9 D-121-25 (Visual indicator / timeout / «ביטול»), §5.2 D-121-26 (proposal vs draft), §5.1 D-121-22 (auto-Analyze after continuation), D-121-23 (plain-Hebrew labels), D-121-24 (Managed grid guidance) |
| Class | Generic capability (D-120-11). Fixtures = evidence only |
| Evidence that fired the trigger | Mizrahi-Tefahot (FLOATING_SCREEN fixture, fixture only): `#logInBtn` count = 1; synthetic click opens the floating screen; with it open `[iframe count, top-document password input] = [2, false]`; SPECIAL Visual (frame 0 listener) never sees the click; Analyze finds no fields |
| Supersession | D-121-25 / D-121-26 / D-121-27 rows «Forbidden: iframe work» and «Unchanged: frame 0 scope» are **superseded for SPECIAL authoring only** by §4.10 once 121.1-IF-impl is authorized. Every other row of those bindings stays in force |

**Hard rule for the whole slice:** zero branches on hostname, serviceId, site name, URL path, or fixture identity — in Hub, Ext, verify fixtures' *production code under test*, or copy. Location of the credential surface (top-document modal vs depth-1 iframe) is always **discovered from evidence**, never assumed.

---

## IF-1. Scope / non-scope

### IF-1.1 In scope (121.1-IF)
1. Optional **frame descriptor** on SPECIAL field mappings, flow actions (opener / transition), and readiness conditions — persisted **only** in `metadata.loginFlowPlan` (draft; carried unchanged into active via existing 121.0 ACTIVATE).
2. **Frame discovery** (Ext) for the SPECIAL authoring tab: top document + **depth-1** frames; deterministic mapping `iframe element ↔ frameId ↔ frameOrigin` without new permissions.
3. **Analyze** (SPECIAL «נתח דף כניסה (משטח נוכחי)») across top + depth-1 frames; Phase 120 field semantics applied **per frame surface**; action candidates per frame; every proposal tagged with its frame descriptor (or none = top).
4. **Visual Mapping** (fields + «מיפוי חזותי — פותח» / «מיפוי חזותי — מעבר») armed in top + all depth-1 frames; first click resolves; all others disarm; D-121-25 timeout / «ביטול» cover every armed frame.
5. **Frame-origin approval** (R2): explicit Admin approval in plain Hebrew showing the origin; never silent use.
6. **Authoring continuation click** targeting top or an approved depth-1 frame.
7. **R3 readiness** replacing opener-self readiness (authoring + persisted readiness); failure → «המסך לא נפתח».
8. **UNSUPPORTED** detection + plain-Hebrew authoring messages: nested frames, Shadow DOM credential fields, non-HTTPS frames.
9. Completeness validation additions (shared ACTIVATE / snapshot gate) for frame descriptors and R3 readiness.
10. Reserved action kind `final_submit` — **reserved name only** (rejected by parse / validator / click gate).

### IF-1.2 Non-scope (forbidden or deferred)
| Item | Rule |
|---|---|
| SPECIAL runtime (orchestrator, Admin Test SPECIAL, Digital Home SPECIAL, frame-targeted fill) | **121.2 — NOT AUTHORIZED.** §IF-9 is design-only |
| STANDARD (`autofillProfile`, Managed Autofill grid, `HUB_MANAGED_AUTOFILL`, Login Entry inspect/visual, Phase 120 Ext fill) | **Unchanged**, frame 0 as today |
| Changes to Phase 120 fill/verify **semantics** (`GenericFillExecutor.fillField`, `runManagedAutofill`, `ManagedTargetEligibility` rules) | Forbidden. Eligibility is **invoked** inside frames, not altered |
| Nested frames, Shadow DOM credential fields, non-HTTPS frames | UNSUPPORTED (message only) |
| `final_submit` storage or click | Forbidden (separate Owner decision) |
| Manifest permission changes (`webNavigation`, `<all_urls>`, `http://*/*`, `frames` etc.) | Forbidden. Existing `scripting` + `https://*/*` only |
| Weakening R1 (top origin == resolved `allowedOrigin`, §4.7) | Forbidden |
| Automatic frame-origin trust (allow-lists, "same registrable domain", heuristics) | Forbidden — explicit Admin approval only |
| Changes to 121.0 persist keys / ACTIVATE matrix | Forbidden |

---

## IF-2. Data model changes (`src/loginContract/`)

### IF-2.1 Types (`types.ts`)
```ts
/** Depth-1 only: iframe element located in the TOP document. */
export interface FrameDescriptor {
  frameLocator: string;   // exact-one CSS for the <iframe> element in the top document
  frameOrigin: string;    // HTTPS origin of that frame's document (Admin-approved)
}

export interface SpecialFieldMapping extends AutofillFieldMapping {
  frame?: FrameDescriptor;          // absent = top document
}

export type StepFieldMapping = SpecialFieldMapping | SplitFieldMapping;

export interface ReadinessCondition {
  kind: 'exact_one_eligible_css';
  locatorType: 'css';
  locator: string;
  timeoutMs: number;
  frame?: FrameDescriptor;          // NEW — absent = top document
}

export interface FlowAction {
  /* existing fields unchanged */
  frame?: FrameDescriptor;          // NEW — absent = top document
}

export type FlowActionKind = 'floating_opener' | 'intermediate_transition';
/** Names reserved for future kinds; parse / validate / click MUST reject them. */
export const RESERVED_FLOW_ACTION_KINDS = ['final_submit'] as const;
```

Rules:
- `AutofillFieldMapping` (STANDARD type in `src/autofill/validatedProfile`) is **not modified**. The frame lives on the SPECIAL extension type only.
- **No** stored `frameId`, `documentId`, `src` URL, or tab id — those are ephemeral and re-resolved on every operation from `frameLocator` (§IF-3.2).
- **No** plan-level trust list. The set of approved frame origins for a draft = `{ d.frameOrigin | d ∈ descriptors in draft }` ∪ current editor-session approvals not yet written (§IF-4.3). A descriptor is only ever written after its origin was approved, so presence in the draft **is** the approval record.
- Presence of `frame` on a SPECIAL element is the only way to say "inside an iframe". Absence = top document (backward compatible: every existing 121.0/121.1 draft parses unchanged and means "top").

### IF-2.2 Extensibility (item 6)
Action shape stays `{ actionId, kind, label, locatorType, locator, frame?, readiness, approvals }`. Adding a future kind = add to `FlowActionKind` union + parse allow-list + one validator branch + (if clickable) click-gate allow-list. No schema redesign, no migration. `final_submit`: `parseFlowAction` returns **null** (corrupt) for it; `validateSpecialPlanComplete` rejects; Ext click handler rejects `kind === 'final_submit'` with `reason: 'reserved_action_kind'`; Hub never proposes it.

### IF-2.3 Parse / serialize (`parse.ts`)
Today `parseFlowAction`, `parseFieldMapping`, `parseReadiness` rebuild objects field-by-field and **drop unknown keys** → a frame descriptor would be silently lost on save/reload. Required:
- New `parseFrameDescriptor(raw)`: record with non-empty trimmed `frameLocator` and `frameOrigin`; `frameOrigin` must parse via `new URL(o)`, `protocol === 'https:'`, and equal its own `.origin` (no path / trailing slash). Otherwise → **null (corrupt)**, never silently dropped.
- `parseFieldMapping` / `parseFlowAction` / `parseReadiness`: `frame` absent → omit; present and valid → copy; present and invalid → whole document parse returns null (fail-closed, surfaced as existing `corruptPlan` message).
- `serialize*` round-trips `frame` exactly (no normalization beyond trim).
- `deepClonePlanDocument` / `createImmutableDraftSnapshot`: frame descriptor is cloned and deep-frozen with the rest (verify asserts).

### IF-2.4 Completeness gate (`validateSpecialPlan.ts`) — shared by ACTIVATE + snapshot
New codes (plain Hebrew, final wording subject to D-121-23 exact-label rule):
| Code | Rule | Message (draft) |
|---|---|---|
| `invalidFrame` | Any descriptor not HTTPS / not exact-origin form | «מסגרת בתוכנית אינה תקינה או אינה מאובטחת (HTTPS).» |
| `mixedFrameInStep` | Field mappings of one step must share the same frame (all top, or all the same `frameLocator`+`frameOrigin`) | «כל שדות השלב חייבים להיות באותה מסגרת.» |
| `readinessIsSelf` | Action readiness identical to the action's own `locator` **and** frame (opener-self readiness, R3) | «תנאי המוכנות של פעולת פתיחה/מעבר אינו יכול להיות הכפתור עצמו.» |
| `readinessNotDeclaredField` | Readiness of an opener / exit transition must equal (locator + frame) one of the credential field mappings of the step it reveals (preamble opener → `steps[0]`; `steps[i].exitTransition` → `steps[i+1]`) | «תנאי המוכנות חייב להיות שדה כניסה שמופה בשלב הבא.» |
| `reservedActionKind` | Defensive (parse already rejects) | «סוג פעולה זה שמור ואינו מאושר לשימוש.» |

Existing codes unchanged. Mixed frames **across** steps / between opener and fields are allowed (e.g. top-document opener, fields in frame) — the per-step restriction keeps 121.2 simple and can be relaxed later without schema change.

### IF-2.5 Authoring helpers (`specialDraftAuthoring.ts`)
- `createDefaultReadiness(locator)` (currently opener-self) → **removed from action creation**. Replaced by:
  - `createPendingRevealReadiness()` — authoring-only marker used before the revealed step's fields are mapped (never valid for ACTIVATE; fails `readinessNotDeclaredField`).
  - `deriveRevealReadiness(draft, action)` — when the first credential mapping of the revealed step is written/approved, set the action's `readiness` to `{ kind:'exact_one_eligible_css', locator: mapping.locator, frame: mapping.frame, timeoutMs: default }`. Re-derived whenever that step's first mapping changes.
- `upsertStepFieldMappings` / `upsertPreambleAction` / `setStepExitTransition`: accept and persist `frame`.
- `canPerformAuthoringClick(action, approvedFrameOrigins)`: existing `approvedForAuthoringContinuation === true` **and** (`!action.frame` **or** `approvedFrameOrigins.has(action.frame.frameOrigin)`) **and** kind not reserved.
- New `listApprovedFrameOrigins(draft): Set<string>`.
- `assertNoSpecialDualWriteToAutofill`: additionally asserts no `frame` key ever appears in the `autofillProfile` payload.
- New `src/loginContract/frameDescriptor.ts`: `isHttpsExactOrigin`, `sameFrame(a?, b?)`, `frameKey(d?)` (`'top'` or `locator|origin`), `FRAME_TOP_LABEL_HE`.

---

## IF-3. Extension changes (by file)

### IF-3.1 Unchanged Ext files (asserted by verify)
`extension/manifest.json` (permissions / host_permissions byte-identical), `generic/fill-executor.js`, `generic/validated-autofill.js`, managed autofill entry (`openPageAndManagedAutofill`, `HUB_MANAGED_AUTOFILL` path), STANDARD Login Entry inspect / visual handlers (keep `frameIds: [0]`), `generic/managed-target-eligibility.js` rule set.

### IF-3.2 NEW `extension/generic/frame-correlation.js` (ISOLATED world, top frame only)
Purpose: deterministic `iframe element ↔ frameId` without `webNavigation`.
- Enumerates `<iframe>` elements in the **top document** (light DOM only).
- For each: `frameId = chrome.runtime.getFrameId(iframeEl)` (content-script API, no permission; Chromium ≥ 106). Unavailable / throws → return `{ ok:false, reason:'frame_correlation_unavailable' }` → Hub shows UNSUPPORTED-style message; **never** guesses.
- Computes an exact-one CSS `frameLocator` using the **existing** `locator-determinism.js` rules (same determinism as field locators; must match exactly one `<iframe>` in the top document). No deterministic locator → frame entry `frameLocator: null` (usable for inspection display only; any proposal inside it is marked `frame_not_addressable` and cannot be approved/written).
- Returns `{ frameId, frameLocator|null, visible: boolean, rectArea }` per iframe. No URLs, no content.
- Runtime lookup form (reused by click / readiness / future 121.2): `resolveFrameByLocator(frameLocator)` → exact-one iframe → `frameId`, else `frame_missing` / `frame_ambiguous`.

### IF-3.3 `extension/background.js`
New internal helpers (SPECIAL authoring only):
1. `enumerateSpecialAuthoringFrames(tabId, allowedOrigin, cb)`:
   - R1 first: tab URL origin === `allowedOrigin` (existing check, unchanged).
   - Probe `executeScript({ target:{ tabId, allFrames:true }, func })` returning per frame `{ origin: location.origin, isTop: window===top, isDepth1: window!==top && window.parent===window.top }`, paired with the result's `frameId`.
   - Inject `frame-correlation.js` in `frameIds:[0]` (ISOLATED) → iframe list.
   - Join on `frameId`. Output list of **frame records**: `{ frameId, depth: 0|1|'nested', origin, frameLocator|null, visible, status }` where `status ∈ { top, depth1_https, depth1_non_https, nested, not_injectable, not_addressable }`. Frames that exist as visible `<iframe>` in top but returned no probe result (e.g. `http:` / sandboxed / opaque origin — host permission does not cover them) → `not_injectable`.
   - `frameId`s are used only inside this operation; **never** returned to Hub for storage.
2. `resolveDeclaredFrame(tabId, allowedOrigin, frameDescriptor, cb)`: R1 → `resolveFrameByLocator` (exact-one) → probe that `frameId` → live `location.origin === frameDescriptor.frameOrigin` **and** depth 1 → `{ ok:true, frameId }`; else `{ ok:false, reason: 'frame_missing' | 'frame_ambiguous' | 'frame_origin_mismatch' | 'frame_not_depth1' }` (fail-closed).

Handler changes:
| Handler | Change |
|---|---|
| `inspectCurrentAuthoringTab` | After R1: enumerate frames; inject existing inspect files into `frameIds: [0, …depth1_https frameIds]`; run `collectSafePageStructureWithReadiness` per frame with `expectedOrigin` = `allowedOrigin` for top, = that frame's probed origin for depth-1 (origin re-checked inside the frame by existing `originMatchesExpected`); run `collectSpecialAuthoringActionCandidates` per frame. Response: `surfaces: [{ frameKey, frame: {frameLocator, frameOrigin}|null, status, page, actionCandidates }]` + `unsupported: { nested:n, nonHttps:n, notInjectable:n, shadowCredential:n, notAddressable:n }` (counts only). Legacy `page` / `actionCandidates` = top surface (back-compat for the Hub until Hub switches). Readiness wait (existing) applies to top; depth-1 surfaces use the same bounded wait per frame, run in parallel, overall cap unchanged |
| `visualMappingCurrentAuthoringTab` | After R1 + D-121-27 activation: enumerate frames; inject `visual-target-pick.js` (+ eligibility + determinism) into top + each `depth1_https` frame; issue **one `executeScript` per frameId** (not `allFrames`, so the first result is observable); race; first result with a click outcome wins → immediately call `__disarmVisualTargetPick('visual_pick_superseded_other_frame')` in every other armed frame. Winning result is tagged `{ frameKey, frame|null }`; if winner is depth-1 and its iframe has no `frameLocator` → result `frame_not_addressable`. Track `specialVisualPickArmed = { tabId, frameIds[] }` (replaces single `specialVisualPickTabId`). Global bound = existing `pickTimeoutMs`; on expiry disarm all armed frames. Nested frames are armed in **report-only** mode (see IF-3.5) so a click there yields an UNSUPPORTED result instead of silence |
| `cancelVisualMappingCurrentAuthoringTab` | Disarm in **all** frames of the session tab (`allFrames:true`, calls `__disarmVisualTargetPick('visual_pick_cancelled')`); `disarmed = any frame returned true`. R1 check unchanged |
| `authoringClickApprovedAction` | New payload fields: `frame` (optional descriptor), `readinessMode: 'reveal' | 'declared'`, `readiness` (with optional `frame`). Gate additions: reject `kind === 'final_submit'` (`reserved_action_kind`); if `frame` present → `resolveDeclaredFrame` must pass before click (else fail-closed reason, no click). Click executes in the resolved `frameId` (top = 0) with existing exact-one + `element.click()` semantics. Readiness per §IF-5 |
| `withAuthoringTab` | Unchanged (still returns `authoringTabId`; never returns frameIds) |

### IF-3.4 `extension/generic/page-structure-inspect.js`
- `collectSafePageStructure` result gains `frameContext: { isTop, isDepth1 }` (booleans only).
- New counts (no values, no attributes beyond existing safe set): `shadowCredentialCandidates` = password-type / Phase 120 credential-like inputs found under **open** shadow roots (walk `element.shadowRoot` recursively, bounded). Not added to `inputs[]` (UNSUPPORTED, never proposed).
- `collectSpecialAuthoringActionCandidates` unchanged in ranking; runs per frame; results tagged by background.
- Eligibility / locator rules unchanged (existing `ManagedTargetEligibility` evaluated inside the frame's own document — hit-test (V8) is frame-local; frame's own visibility is covered by the iframe record `visible` flag from top).

### IF-3.5 `extension/generic/visual-target-pick.js`
- `armVisualTargetPick({ expectedOrigin, fieldId, timeoutMs, mode })`: `mode ∈ { 'pick', 'report_only' }` (default `'pick'`).
  - `expectedOrigin` per frame (set by background as above); existing `location.origin !== expectedOrigin` fail-closed kept.
  - Click whose `event.composedPath()[0]` is inside a shadow root (target ≠ path[0]) → resolve `{ ok:false, reason:'shadow_dom_unsupported' }`.
  - `report_only` (nested frames): any click resolves `{ ok:false, reason:'nested_frame_unsupported' }`, prevents default like `pick`, maps nothing.
- Result adds `frameOrigin: location.origin`, `isTop`.
- `__disarmVisualTargetPick(reason)` unchanged contract; supports new reason `visual_pick_superseded_other_frame`.

### IF-3.6 Permissions (item 8)
Only existing `scripting` + `https://*/*`. `allFrames` / `frameIds` injection into `https:` frames is covered; `http:` / opaque frames cannot be injected → reported as `not_injectable` → UNSUPPORTED message. `chrome.runtime.getFrameId` needs no permission. Verify asserts `manifest.json` permission arrays unchanged.

---

## IF-4. Hub changes (by file)

### IF-4.1 `src/assistedMapping/types.ts`
- `FramedSurface { frameKey: string; frame: FrameDescriptor | null; status: 'top' | 'depth1_https' ; page: SafePageStructure; actionCandidates: SpecialActionCandidateObservation[] }`.
- `FrameUnsupportedSummary { nested; nonHttps; notInjectable; shadowCredential; notAddressable }`.
- Plain-Hebrew constants (exact-label rule D-121-23 applies to any quoted button):
  - `FRAME_APPROVAL_PROMPT_HE(origin)` = «שדות הכניסה או הכפתור נמצאים בתוך מסגרת של האתר ‎<origin>‎. לאשר שימוש במסגרת זו בתהליך הכניסה?»
  - buttons `FRAME_APPROVE_LABEL_HE` = «אשר מסגרת», `FRAME_REJECT_LABEL_HE` = «דחה»
  - `SURFACE_NOT_OPENED_HE` = «המסך לא נפתח»
  - `UNSUPPORTED_NESTED_FRAME_HE` = «השדה נמצא במסגרת בתוך מסגרת. מצב זה אינו נתמך כרגע.»
  - `UNSUPPORTED_SHADOW_DOM_HE` = «השדה נמצא ברכיב מוסתר מסוג Shadow DOM. מצב זה אינו נתמך כרגע.»
  - `UNSUPPORTED_NON_HTTPS_FRAME_HE` = «חלק מהדף נמצא במסגרת שאינה מאובטחת (HTTPS) ולא ניתן לבדוק אותה. מצב זה אינו נתמך.»
  - `FRAME_NOT_ADDRESSABLE_HE` = «לא ניתן לזהות את המסגרת באופן חד-משמעי. מצב זה אינו נתמך כרגע.»
  - `FRAME_ORIGIN_CHANGED_HE(origin)` = «המסגרת שייכת כעת לאתר אחר (‎<origin>‎) — הפעולה נחסמה.»
  - `FRAME_CORRELATION_UNAVAILABLE_HE` = «הדפדפן אינו תומך בזיהוי מסגרות. עדכנו את הדפדפן.»
  - `VISUAL_TIMEOUT_MAYBE_UNSUPPORTED_FRAME_HE` (appended to D-121-25 timeout text when `notInjectable > 0`) = «ייתכן שהשדה נמצא במסגרת שאינה נתמכת.»

### IF-4.2 `src/assistedMapping/currentTabAuthoring.ts`
- `inspectCurrentTabPage` returns `surfaces[]` + `unsupported` (falls back to single top surface if Ext returns legacy shape).
- `analyzeSpecialCurrentSurface`:
  - **Field semantics per frame:** call existing `proposeFieldMappings` + `applySafetyAndConfidence` **once per surface** (unchanged Phase 120 engine; no merged pseudo-page). Per `fieldId`, collect confident rows across surfaces. **Exactly one** surface with a HIGH/MEDIUM row → proposal carries that surface's `frame`; confident rows on **>1** surface → `NOT_CONFIDENTLY_MAPPED` (ambiguous across frames, no prefill); none → unmapped.
  - Proposals from a frame whose origin ∉ approved set → state `needs_frame_approval` (shown, **not** prefilled into draft).
  - Proposals from a surface with `frameLocator: null` → `frame_not_addressable` (shown with message, not approvable).
  - **Action candidates:** existing `proposeSpecialActionCandidates` run over the union of per-surface candidates, each carrying `frame`; ranking heuristics unchanged (frame is not a ranking signal — no location assumption). D-121-26 top-ranked / skip rules unchanged, with identity = `locator + frameKey`.
  - `unsupported` counts > 0 and no usable credential proposal → return the matching UNSUPPORTED message(s) instead of generic «לא נמצאו שדות».
- `startCurrentTabVisualMapping` / `cancelCurrentTabVisualMapping`: pass-through; result carries `frame` + `reason` (`shadow_dom_unsupported`, `nested_frame_unsupported`, `frame_not_addressable` → messages above).
- `performApprovedAuthoringClick`: sends `frame`, `readinessMode`, `readiness` (§IF-5); maps `readiness_timeout` / `surface_not_revealed` → «המסך לא נפתח»; `frame_origin_mismatch` → `FRAME_ORIGIN_CHANGED_HE`.

### IF-4.3 `src/admin/SpecialLoginDraftEditor.tsx`
- Session state: `approvedFrameOrigins: Set<string>` initialised from `listApprovedFrameOrigins(draft)`; **not** persisted on its own.
- **Frame-approval prompt** (R2) rendered whenever a proposal (field or action, Analyze or Visual) carries a frame whose origin is not approved: shows the origin verbatim (LTR-isolated) + «אשר מסגרת» / «דחה».
  - «אשר מסגרת» → adds origin to session set only. Nothing is written to the draft yet.
  - «דחה» → discards that proposal (and all pending proposals with the same origin in this Analyze result); nothing written.
  - While unapproved: «זה הכפתור הנכון» / field accept / «פתח את מסך הכניסה» are **disabled** for that proposal.
- Draft write (D-121-26 unchanged): action enters draft only on «זה הכפתור הנכון»; field mapping only on existing accept path — now with `frame`. Writing a descriptor = durable approval record.
- One approval per site in practice: once any descriptor with origin O is in the draft, later proposals from O need no prompt.
- Each field row / action shows location in plain Hebrew: «בדף הראשי» or «בתוך מסגרת: ‎<origin>‎» (display only).
- R3: after continuation, success banner only when Ext returns `ok:true` from readiness (§IF-5); otherwise «המסך לא נפתח». D-121-22 auto-Analyze runs **only** after readiness success.
- D-121-25 indicator / timeout / «ביטול» unchanged in UI; now cover multi-frame arm (Ext side).
- UNSUPPORTED messages rendered in the existing status line; never silent.

### IF-4.4 Other Hub files
- `src/assistedMapping/specialAnalyzeRouting.ts`: `SpecialActionCandidateObservation` + `SpecialActionProposal` gain optional `frame`; no ranking change; dedupe key = `locator + frameKey`.
- `src/loginContract/index.ts`: export new helpers/types.
- `src/loginContract/merge.ts`, `planActivate.ts`, `resolve.ts`: **no logic change** (frame travels inside the plan document); verify covers round-trip through ACTIVATE.
- `src/admin/RegistryAdmin.tsx`, `AutofillProfileEditor.tsx`, `adminRegistryApi.ts`: **no change** (STANDARD grid + D-121-24 guidance untouched).

---

## IF-5. Origin & security rules (binding restatement for implementation)

| Rule | Implementation |
|---|---|
| **R1 Top** | Every SPECIAL handler checks live tab URL origin === resolved `allowedOrigin` **before** any enumeration, injection, arm, or click. Unchanged code path; frame logic runs only after it passes |
| **R2 Frame** | A depth-1 frame is usable (write descriptor, arm-and-accept, click, readiness) only if (a) `frameOrigin` is HTTPS exact-origin, (b) Admin approved it via «אשר מסגרת» (or it already appears in the draft), (c) at operation time the iframe matched by `frameLocator` is exact-one in the top document **and** its live document origin === `frameOrigin` **and** depth 1. Any mismatch → fail-closed, no action, plain-Hebrew reason |
| Inspection of unapproved frames | Allowed read-only (same safe structure as today: no values, no credentials) solely to produce proposals + approval prompt. No click, no write, no arm-accept into draft |
| **R3 Readiness** | See IF-5.1 |
| No trust inference | Same-site / subdomain / registrable-domain similarity is **not** approval |
| Ephemeral ids | `frameId` / `documentId` never persisted or sent to Hub for storage |
| Credentials | 121.1-IF never fills, reads values, or submits. `fillCredentials` / `submitForm` rejection unchanged |
| `final_submit` | Rejected at parse, validate, Hub propose, Ext click |

### IF-5.1 R3 readiness (authoring + persisted)
- **`readinessMode: 'declared'`** (revealed step already has a mapped field): Ext resolves `readiness.frame` (if any) via `resolveDeclaredFrame`, then polls for **exact-one eligible** element matching `readiness.locator` inside that frame (existing eligibility), bounded by `readiness.timeoutMs`. Frame not yet present → keep polling until bound (iframes may be inserted after click). Timeout → `readiness_timeout` → «המסך לא נפתח».
- **`readinessMode: 'reveal'`** (first authoring pass — revealed step not mapped yet): Ext snapshots, **before** the click, the set of `(frameKey, locator)` of eligible credential-like inputs across top + depth-1 frames (via the inspect collector). After click, polls (bounded, default 8 s, same cap as today) until at least one eligible credential-like input exists whose `(frameKey, locator)` was **not** in the pre-click set (or a new depth-1 HTTPS frame appeared that contains one). None → `surface_not_revealed` → «המסך לא נפתח». Only frames observable without approval are inspected; the result reports the frame where the new input appeared so the Hub can raise the approval prompt.
- **Opener-self readiness never counts**: Ext rejects `readinessMode:'declared'` whose locator+frame equals the clicked action's locator+frame (`readiness_is_self`); validator rejects it for ACTIVATE (`readinessIsSelf`).
- Persisted readiness is set by `deriveRevealReadiness` once the revealed step's first field mapping is accepted (IF-2.5); drafts saved before that carry the pending marker and are **incomplete** (cannot ACTIVATE).

---

## IF-6. Interaction with D-121-21 / 25 / 26 / 27 (item 10)

| Decision | Interaction |
|---|---|
| **D-121-21** open/reuse at §4.7 URL/origin | Unchanged. Frame logic runs inside the tab `ensureSpecialAuthoringTab` returns |
| **D-121-27** session tab | Unchanged: `authoringTabId` → `tabId`; tab activation + window focus before continuation click **and** before multi-frame arm. Frames are always re-resolved inside the session tab per operation; a reload changes frameIds but not descriptors. Cancel targets the session tab (all frames) |
| **D-121-25** indicator / timeout / «ביטול» | Indicator and Hub timeout/grace unchanged. Ext: one global bound; timeout or «ביטול» disarms **every** armed frame (top, depth-1, report-only nested). First-click-wins disarms the rest. Timeout text extended with `VISUAL_TIMEOUT_MAYBE_UNSUPPORTED_FRAME_HE` only when `notInjectable > 0`. Stale-message clearing unchanged |
| **D-121-26** proposal vs draft | Unchanged semantics; identity = `locator + frameKey`. Additional precondition: frame-origin approval before «זה הכפתור הנכון» / field accept is enabled. «דחה» on a frame prompt discards proposals; «דחה» on an action removes it from draft if present (unchanged) |
| **D-121-22** auto-Analyze after continuation | Runs only after R3 readiness success; multi-frame inspect; `after_continue` skip rules unchanged |
| **D-121-23** labels | All new copy plain Hebrew; any quoted button name must equal visible label exactly |
| **D-121-24** Managed grid guidance | Unchanged; STANDARD grid never gains frame support |

---

## IF-7. Acceptance criteria

| ID | Criterion |
|---|---|
| **AC-121.1-IF-1** | `FrameDescriptor` exists only on SPECIAL types; `AutofillFieldMapping` and `autofillProfile` persist shape byte-identical to pre-slice |
| **AC-121.1-IF-2** | Parse/serialize round-trips `frame` on field mapping, action, readiness; invalid descriptor (non-HTTPS, path, empty) → document corrupt (never silently dropped); pre-slice drafts parse unchanged as top |
| **AC-121.1-IF-3** | Snapshot deep-freezes descriptors; ACTIVATE carries them draft→active via unchanged 121.0 planner |
| **AC-121.1-IF-4** | Validator: `invalidFrame`, `mixedFrameInStep`, `readinessIsSelf`, `readinessNotDeclaredField`, `reservedActionKind` enforced; existing codes unchanged |
| **AC-121.1-IF-5** | `final_submit` rejected by parse, validator, Hub proposer, Ext click (`reserved_action_kind`); never stored, never clicked |
| **AC-121.1-IF-6** | Frame correlation uses `chrome.runtime.getFrameId` + exact-one iframe locator; no `webNavigation`; unavailable → `FRAME_CORRELATION_UNAVAILABLE_HE`, no guess |
| **AC-121.1-IF-7** | Analyze returns per-frame surfaces for top + depth-1 HTTPS frames; Phase 120 propose/safety run per surface; cross-frame ambiguity → not confidently mapped |
| **AC-121.1-IF-8** | Unapproved frame origin → approval prompt showing origin; no draft write, no click, no prefill until «אשר מסגרת»; «דחה» discards |
| **AC-121.1-IF-9** | Visual arms top + depth-1 frames; first click wins; others disarmed (`visual_pick_superseded_other_frame`); timeout and «ביטול» disarm all frames; editor never stays locked |
| **AC-121.1-IF-10** | Continuation click in a depth-1 frame requires approved origin + live origin match + exact-one iframe; mismatch → fail-closed with plain-Hebrew reason, no click |
| **AC-121.1-IF-11** | R3: success only when declared field (declared mode) or a new eligible credential input (reveal mode) appears within bound; opener-self readiness rejected; failure → «המסך לא נפתח»; auto-Analyze only after success |
| **AC-121.1-IF-12** | UNSUPPORTED: nested frame click → `UNSUPPORTED_NESTED_FRAME_HE`; open-shadow credential field / shadow click → `UNSUPPORTED_SHADOW_DOM_HE`; non-injectable / non-HTTPS frame → `UNSUPPORTED_NON_HTTPS_FRAME_HE`; iframe without deterministic locator → `FRAME_NOT_ADDRESSABLE_HE`. None silent |
| **AC-121.1-IF-13** | R1 unchanged and executed before any frame logic in every SPECIAL handler |
| **AC-121.1-IF-14** | No location assumption: top-document modal fixture authored with **no** frame descriptors and **no** frame prompt; iframe path only when evidence (surface in depth-1 frame) exists |
| **AC-121.1-IF-15** | Genericity proof: Owner live PASS on Mizrahi-Tefahot (iframe) **and** ≥1 FLOATING_SCREEN fixture with top-document credential fields (Bank PAGI or CAL), zero fixture-specific code (grep gate) |
| **AC-121.1-IF-16** | `manifest.json` permissions unchanged; STANDARD handlers still `frameIds:[0]`; Phase 120 fill / eligibility files unchanged; STANDARD regression suite PASS |
| **AC-121.1-IF-17** | D-121-21/22/23/24/25/26/27 behaviors preserved per §IF-6 (existing verify cases still PASS) |
| **AC-121.1-IF-18** | No SPECIAL runtime: no orchestrator, no frame-targeted fill, no Admin Test / DH SPECIAL execution |

---

## IF-8. Verify plan

### IF-8.1 New `scripts/verifyPhase121IframeSurface.mjs`
Static + unit (pure helpers imported / eval'd as existing Phase 121 verify scripts do):
1. Types/parse: round-trip with frame on all three element kinds; invalid descriptor cases → null; legacy draft → parses, no frame.
2. Validator matrix for every new code + unchanged codes.
3. `final_submit` rejected in parse / validate / proposer / Ext click source.
4. `canPerformAuthoringClick` requires approved origin for framed actions.
5. `deriveRevealReadiness` + `readinessIsSelf` behavior; default action creation no longer opener-self.
6. Cross-frame merge: same fieldId confident in two surfaces → not confidently mapped; one surface → frame carried; unapproved origin → `needs_frame_approval`, no prefill.
7. Ext static: `frame-correlation.js` uses `chrome.runtime.getFrameId`; no `webNavigation` anywhere; SPECIAL handlers call R1 before enumerate; Visual uses per-frame executeScript + disarm-others; cancel uses `allFrames`; click resolves declared frame before click; `reserved_action_kind` present.
8. Ext unit (DOM harness used by existing Phase 120/121 verify, where available) on **synthetic generic fixtures**:
   - **F-IF-TOP**: top-document modal revealed by opener → no frame descriptors, reveal readiness passes.
   - **F-IF-FRAME**: depth-1 cross-origin HTTPS iframe with credential inputs inserted after opener click → surface tagged, approval required, reveal readiness passes via new frame.
   - **F-IF-NESTED**: credential inputs in frame-in-frame → `nested_frame_unsupported`.
   - **F-IF-SHADOW**: credential input in open shadow root → `shadowCredentialCandidates > 0`, shadow click → unsupported.
   - **F-IF-NOADDR**: two identical iframes without deterministic locator → `frame_not_addressable`.
   - **F-IF-SWAP**: approved frame navigates to another origin → `frame_origin_mismatch`, no click.
   - **F-IF-SELF**: opener whose readiness equals itself → rejected.
   Where the harness cannot simulate multi-frame / `getFrameId`, the case is covered by pure-function tests + Owner live, and the verify prints `LIVE_ONLY` for it (never a false PASS).
9. Genericity grep gate over changed Hub/Ext files: no `mizrahi`, `tefahot`, `pagi`, `cal-online`, `icount`, hostnames, `serviceId ===`, fixture ids.
10. STANDARD freeze: `manifest.json` permissions diff = none; STANDARD handlers `frameIds:[0]`; `fill-executor.js`, `validated-autofill.js`, `managed-target-eligibility.js` untouched in slice diff; `AutofillFieldMapping` unchanged.

### IF-8.2 Regression
`verifyPhase121LoginContract.mjs`, `verifyPhase121SpecialDraftAuthoring.mjs` (incl. D-121-21…27 cases), all Phase 120 verify scripts, `npm run build` / typecheck — PASS.

---

## IF-9. Runtime (121.2) — design note only, NOT authorized
Shared orchestrator (future) consumes the same descriptors: `resolveDeclaredFrame` (R1 + R2 live check) → `frameIds:[resolved]` injection target → **unchanged** Phase 120 `runManagedAutofill` / `GenericFillExecutor.fillField` inside that frame; readiness via `readinessMode:'declared'`. STANDARD Hub entry stays frame 0. No 121.2 code, tasks, or verify in this slice.

---

## IF-10. Owner live-validation steps (after impl; both fixtures mandatory)

**Setup:** Extension reloaded; Registry Admin; pattern «מסך צף» (FLOATING_SCREEN); only one fixture tab (D-121-27 works either way).

### L-1 Mizrahi-Tefahot (evidence: credential fields in depth-1 iframe)
1. «נתח דף כניסה (משטח נוכחי)» on HOME → «נמצא כפתור באתר» shows `#logInBtn` (top document, «בדף הראשי»).
2. «זה הכפתור הנכון» → «פתח את מסך הכניסה» → floating screen opens in the visible tab; success reported only after a new credential input appears (reveal readiness). Negative check: if it did not open, message is «המסך לא נפתח».
3. Auto-Analyze → field proposals show «בתוך מסגרת: ‎<origin>‎» and the frame-approval prompt with that exact origin. Confirm nothing entered the draft yet.
4. «דחה» once → proposals discarded, draft unchanged. Re-run Analyze → prompt again → «אשר מסגרת» → accept fields.
5. Field «מיפוי חזותי» → indicator shown; click the username field inside the floating screen → mapping resolves (no lock). Repeat and press «ביטול» → editor released.
6. «שמור טיוטה» → reload editor → descriptors present (location shown), no re-prompt for the same origin; opener readiness now references the mapped field (not `#logInBtn`).
7. Snapshot / ACTIVATE preview complete; STANDARD grid unchanged with D-121-24 notice.

### L-2 Bank PAGI **or** CAL (evidence required: credential fields in top document)
1. Same flow → opener proposed and approved → floating screen opens → readiness success.
2. Auto-Analyze proposals show «בדף הראשי»; **no** frame-approval prompt appears; draft has **no** `frame` keys.
3. Visual field pick works; save/reload; opener readiness = mapped field.
4. Owner records which fixture was used and confirms (DevTools, top frame) that the password input is present in the top document with the screen open.

### L-3 Negative / regression (either fixture)
- Close the floating screen, try field Visual → timeout message (and unsupported-frame hint only if applicable); editor released.
- A STANDARD service: Managed Autofill Analyze / Visual / test harness behave exactly as before.

---

## IF-11. Risks

| Risk | Mitigation |
|---|---|
| `chrome.runtime.getFrameId` unavailable on Owner browser build | Fail closed with `FRAME_CORRELATION_UNAVAILABLE_HE`; verify checks presence; Chromium ≥ 106 documented |
| Iframe has no deterministic locator (no id/name/stable attrs) | `frame_not_addressable` UNSUPPORTED message; never positional guess. Revisit only with evidence |
| Frame reloads / is re-inserted after opener (new frameId) | Descriptor re-resolved per operation; readiness polls until frame present within bound |
| Frame navigates to different origin after approval | R2 live origin check → fail-closed, `FRAME_ORIGIN_CHANGED_HE` |
| Admin approves a third-party/ad frame | Prompt shows exact origin; approval scoped to that origin; only proposals from surfaces that pass Phase 120 credential semantics prompt at all |
| Reveal readiness false positive (unrelated input appears) | Requires credential-like eligible input with new `(frameKey, locator)`; declared readiness replaces it once fields are mapped; ACTIVATE requires declared readiness |
| Closed Shadow DOM undetectable | Click lands on host → existing unsupported-target message; documented limit |
| Multi-frame inspect latency | Parallel per-frame, existing overall cap; counts-only for unsupported frames |
| Race: two frames report clicks nearly simultaneously | First resolved wins; others disarmed; late results ignored by armed-set bookkeeping |
| Scope creep into runtime | AC-121.1-IF-18 + verify gate; §IF-9 design-only |
| Supersession confusion with D-121-25/26/27 "no iframe" rows | §IF-0 supersession statement; Architect to confirm in review |

### Open questions for Architecture
1. Confirm per-element descriptor placement (mapping / action / readiness) with **per-step same-frame** restriction for field mappings (§IF-2.1, §IF-2.4) as the reading of "per step (and per field mapping if needed)".
2. Confirm **reveal-mode** interim readiness (§IF-5.1) as the R3 reading for the first authoring pass before fields are declared.
3. Confirm `chrome.runtime.getFrameId` (ISOLATED world, top frame) as the frame-correlation mechanism under the no-new-permissions constraint.

---

## Manager Review (121.1-IF)
MANAGER_REVIEW_STATUS: **CLOSED — DD PASS** (Architecture 2026-09-27, amendments A1–A2; Q3 superseded by D-121-29 / §4.10.1 nonce handshake). Implementation review tracked in `arch-phase121.md`.

---

# Slice 121.2 — Detailed Design: FLOATING_SCREEN Runtime via the Shared Login Flow Orchestrator

## RT-0. Source, scope class, prerequisites

| Item | Value |
|---|---|
| Authority | `arch-phase121.md` §8.1–§8.4 (+ §8.5–§8.7 state / readiness / failure), §4.10 runtime + §4.10.1, D-121-35 / D-121-36, D-121-38 Part B, §12 / §12.1, §15 row 121.2 |
| Class | Generic runtime capability. Fixtures (Mizrahi-Tefahot, PAGI) = evidence only |
| One engine | Admin Test «בדיקת מילוי» SPECIAL route **and** Digital Home call the **same** Hub entry and the **same** Ext orchestrator. Allowed differences (§8.3): plan context (Admin Test: DRAFT snapshot or ACTIVE; DH: ACTIVE only) and credential source (temporary vs vault). Nothing else |
| Prerequisite | **D-121-38 Part A accepted** (grid «בדיקת מילוי» exists with the STANDARD route relocated and the SPECIAL options visible-but-disabled). 121.2-impl only enables those options and wires them. If Part A is not accepted when 121.2-impl starts → Developer STOPs (no Part A work inside 121.2) |
| Pattern scope | **FLOATING_SCREEN only.** Plans with pattern MULTI_STEP / FLOATING_SCREEN_MULTI_STEP → fail closed «not yet supported» (121.3 / 121.4) |
| CALL OUT (§8.2) | If existing-tab / declared-frame fill cannot be done without modifying Ext `runManagedAutofill` / `GenericFillExecutor.fillField` / `assessManagedTargetsReady` semantics or STANDARD `executeManagedAutofill` / `isManagedAutofillEligible` → **STOP** and return to Architecture |

**Hard rule:** zero branches on hostname, serviceId, site name, URL path, or fixture identity anywhere in Hub, Ext, or production code under verify.

---

## RT-1. Scope / non-scope

### RT-1.1 In scope
1. Hub shared entry `executeSpecialLoginFlow` (context resolution result → plan validation → credential subset → in-flight key → one Ext run message → structured outcome).
2. Ext orchestrator `runSpecialLoginFlow` (background): open entry tab once → R1 → opener click (synthetic `element.click()`, proven sufficient) → R3 declared readiness → Phase 120 fill of the step subset in top document or declared depth-1 frame → **STOP** before final authentication.
3. Runtime R2 re-validated **from the plan document** carried in the run message (never from separate per-action message fields).
4. Admin Test «בדיקת מילוי» SPECIAL options enabled: «טיוטת כניסה מיוחדת» (immutable DRAFT snapshot) and «כניסה מיוחדת פעילה» (ACTIVE).
5. Digital Home routing by `resolveActiveLoginContract`: STANDARD → unchanged Phase 120; SPECIAL → orchestrator; SPECIAL_INVALID → fail closed (no Managed, no Generic, no medium, no STANDARD fallback).
6. Fail-closed outcomes with plain-Hebrew messages (Admin detail vs end-user copy); structured diagnostics without secrets (§13).
7. Verify on synthetic fixtures + STANDARD regression; Owner live AC on Mizrahi-Tefahot and PAGI.

### RT-1.2 Non-scope / forbidden
| Item | Rule |
|---|---|
| MULTI_STEP runtime, composition, `exitTransition` execution | 121.3 / 121.4 — plans containing them fail closed |
| `final_submit` | Reserved; plan containing it rejected; never clicked |
| Any change to `executeManagedAutofill`, `isManagedAutofillEligible`, `mappingsCoverRequiredSchema`, `sendManagedAutofillPayloadAndAwait`, `executeAdminManagedAutofillTest` | Forbidden (STANDARD frozen) |
| Any change to `validated-autofill.js`, `fill-executor.js`, `managed-target-eligibility.js`, `runManagedAutofillOnTab`, `openPageAndManagedAutofill` | Forbidden (Ext fill semantics + STANDARD Ext path frozen). Only the **injection target frame** differs, via a new SPECIAL wrapper |
| Manifest / permission / `minimum_chrome_version` change; `webNavigation`, `debugger`, `chrome.runtime.getFrameId` | Forbidden |
| AI, Analyze, Visual, candidate discovery, skip-link logic, alternative locators at runtime | Forbidden (§1.5 — execute the stored contract) |
| Writes to `autofillProfile`, `loginFlowPlan`, `loginContractActivation`, or any service metadata from a run | Forbidden |
| Persisting temp credentials / logging any credential value | Forbidden |
| Separate Admin-Test-only engine | Forbidden |

---

## RT-2. Plan context resolution (Hub)

| Caller | Context | Source | Gate |
|---|---|---|---|
| Digital Home | ACTIVE only | `resolveActiveLoginContract(service.metadata)` → `{ mode:'SPECIAL', plan, activePlanVersion }` | `SPECIAL_INVALID` → fail closed (`special_contract_invalid`) · `STANDARD` → not this path |
| Admin Test «כניסה מיוחדת פעילה» | ACTIVE | same resolver on the **saved** row metadata | Option shown only when mode = SPECIAL (D-121-38) |
| Admin Test «טיוטת כניסה מיוחדת» | DRAFT snapshot | **saved** `loginFlowPlan.draft` from row metadata → **same** pipeline as «בדוק שהטיוטה מלאה» / activate gate: `checkSpecialDraft` (A1 `normalizeLegacyDraftReadiness` → `createImmutableDraftSnapshot`) | Incomplete → fail closed with the same «הטיוטה לא מלאה: …» message. Unsaved SPECIAL editor changes → blocked «יש שינויים שלא נשמרו בטיוטה. שמרו טיוטה לפני הבדיקה.» (editor dirty state must be observable by the grid, same mechanism Part A uses for the STANDARD dirty guard) |

**Snapshot immutability:** the snapshot is taken **once** at Test press (`snapshotId = crypto.randomUUID()`), deep-frozen, serialized into the run message; the run never re-reads the draft. The editor's draft may change afterwards without affecting the run. The Test button stays disabled while the run is in flight.

**No ACTIVATE side effect:** `executeSpecialLoginFlow` and the grid call **no** persistence API (no `adminRegistryApi` update, no merge, no `loginContractActivateIntent`). Verify spies assert zero metadata writes during and after a run (RT-8).

### RT-2.1 Runtime pattern gate (121.2) — `validateFloatingScreenRunnable(plan)` (new, `src/loginContract/runtimeGate.ts`)
Runs **after** `validateSpecialPlanComplete(plan)` passes (that validator is unchanged). Additional 121.2-only rules:
| Rule | Fail reason |
|---|---|
| `plan.pattern === 'FLOATING_SCREEN'` | `pattern_not_supported_yet` |
| exactly **one** `preambleActions` entry, kind `floating_opener`, `approvedForRuntime === true` | `plan_shape_unsupported` |
| exactly **one** step, **no** `exitTransition` | `plan_shape_unsupported` |
| opener readiness is **declared** (not the reveal marker), not opener-self, equals (locator + frame) one of `steps[0].fieldMappings` (already guaranteed by validator; re-asserted) | `readiness_invalid` |
| every descriptor (opener, readiness, mappings) HTTPS exact-origin; all `steps[0]` mappings share one frame (validator) | `frame_invalid` |
| no reserved kind anywhere | `reserved_action_kind` |

### RT-2.2 Entry URL + allowedOrigin
Resolved from **service configuration** with the same resolver authoring used (§4.7): `resolveSpecialAuthoringEntry({ primaryUrl: service.url, loginUrl: service.loginUrl, metadata })`. `ok:false` → fail closed `entry_unresolved`. This keeps authoring origin ≡ runtime origin (A2 same-origin frames stay valid). No new persisted field.

### RT-2.3 Credentials
- Required set = every `fieldId` in `steps[0].fieldMappings`. Any missing / blank → fail closed `credentials_incomplete` **before** any tab is opened (DH: existing «credentials missing» UX; Admin: the Part A temp-value guard).
- Payload carries **only** that subset (same filtering idea as `buildManagedAutofillPayload`; values never logged).
- Admin Test: temp values from the grid (in-memory, never persisted). DH: vault credential of the active access profile.

### RT-2.4 In-flight keys
New module-local set in the SPECIAL module, **same key format** as Phase 120: DH `serviceId::accessProfileId`, Admin `serviceId::admin_test`. Busy → `MSG_MANAGED_BUSY` (reused constant, import only). `managedAutofill.ts` is not modified.

---

## RT-3. Hub API (by file)

### RT-3.1 NEW `src/execution/specialLoginFlow.ts`
```ts
export const HUB_SPECIAL_LOGIN_FLOW_MESSAGE = 'HUB_SPECIAL_LOGIN_FLOW';

export type SpecialRunContext =
  | { kind: 'active'; plan: LoginFlowPlanDocument; activePlanVersion: number }
  | { kind: 'draft_snapshot'; snapshot: ImmutableDraftSnapshot };

export interface SpecialRunOutcome {
  ok: boolean;                         // true only when state === 'STOPPED_FOR_USER' after a verified fill
  state: 'STOPPED_FOR_USER' | 'FAILED';
  stage?: 'validate' | 'open' | 'r1' | 'opener' | 'readiness' | 'frame' | 'fill';
  reason?: string;                     // machine reason (RT-6)
  stepId?: string; actionId?: string; fieldId?: string; locator?: string;
  frameKey?: 'top' | string;           // `frameLocator|frameOrigin`, never frameId
  userGestureDuringRun?: boolean;      // RT-4.6
  tabOpened: boolean; extensionUsed: boolean;
  fillDiagnostics?: ManagedFillDiagnostics; // A2 stamps, unchanged shape
  context: 'active' | 'draft_snapshot'; planVersion: number; snapshotId?: string;
}

export async function executeSpecialLoginFlow(input: {
  context: SpecialRunContext;
  entry: { authoringUrl: string; allowedOrigin: string };   // from resolveSpecialAuthoringEntry
  credentials: Credential;
  executionKey: string;
  diagnosticPath: 'admin_test' | 'digital_home';
}): Promise<SpecialRunOutcome>;
```
Steps: `validateSpecialPlanComplete` → `validateFloatingScreenRunnable` → credential subset (RT-2.3) → in-flight key → extension availability (unavailable → open entry URL only, `extension_unavailable`, same UX as STANDARD) → send **one** message `{ type, runId, entryUrl, allowedOrigin, plan: serializeLoginFlowPlanDocument(plan), credentials, diagnosticPath }` → map response to `SpecialRunOutcome`. No retries at Hub level (Ext owns bounded waits).

Wrappers (thin, same engine):
- `executeDigitalHomeSpecialLoginFlow(service, credential, accessProfileId)` → resolver (ACTIVE) + entry + `executeSpecialLoginFlow(... 'digital_home')`.
- `executeAdminSpecialLoginFlowTest({ serviceRow, contextChoice, tempCredentials })` → ACTIVE or `checkSpecialDraft` snapshot + entry + `executeSpecialLoginFlow(... 'admin_test')`.

### RT-3.2 NEW `src/execution/specialLoginFlowMessages.ts` — plain Hebrew (exact-label rule D-121-23)
| Reason group | Admin Test (detail line also shows stage · reason · locator · frame) | Digital Home (end user) |
|---|---|---|
| success | «המילוי הושלם. בדקו את השדות ולחצו על כניסה באתר.» | reuse `MSG_MANAGED_FILL_OK` |
| `special_contract_invalid` | — (grid shows no SPECIAL-active option; D-121-38) | «הגדרת הכניסה לשירות זה אינה תקינה. האתר נפתח — מלאו את הפרטים ידנית.» |
| `pattern_not_supported_yet` / `plan_shape_unsupported` | «סוג תהליך הכניסה הזה עדיין לא נתמך בבדיקת מילוי.» | «מילוי אוטומטי עדיין לא זמין לסוג הכניסה של שירות זה. האתר נפתח — מלאו את הפרטים ידנית.» |
| draft incomplete | «הטיוטה לא מלאה: …» (from `checkSpecialDraft`) | n/a |
| `entry_unresolved` | «כתובת הכניסה של השירות חסרה או אינה מאובטחת (HTTPS).» | same as `special_contract_invalid` |
| `credentials_incomplete` | Part A guard text (unchanged) | existing missing-credentials message |
| `origin_mismatch` (R1) | «האתר נפתח בכתובת של אתר אחר — הבדיקה נעצרה.» | «האתר נפתח בכתובת לא צפויה — המילוי נחסם.» |
| `opener_missing` / `opener_ambiguous` | «כפתור פתיחת מסך הכניסה לא נמצא באתר (או נמצא יותר מאחד). ייתכן שהאתר השתנה — עדכנו את הטיוטה.» | «לא הצלחנו לפתוח את מסך הכניסה. האתר נפתח — מלאו את הפרטים ידנית.» |
| `readiness_timeout` | «המסך לא נפתח» + « — שדה הכניסה המוגדר לא הופיע בזמן.» | same end-user copy as opener |
| `frame_missing` / `frame_ambiguous` / `frame_not_depth1` | «מסגרת מסך הכניסה לא נמצאה באופן חד-משמעי — הבדיקה נעצרה.» | same end-user copy as opener |
| `frame_origin_mismatch` | «מסגרת מסך הכניסה שייכת כעת לאתר אחר (‎<origin>‎) — המילוי נחסם.»; empty / `"null"` origin → «המסגרת עדיין לא נטענה או נסגרה — נסו שוב.» (D-121-36 copy) | «מסך הכניסה נטען ממקור לא צפוי — המילוי נחסם.» |
| fill failure (`targets_not_ready`, `zero_match`, verify fail, …) | reuse `MSG_MANAGED_FILL_FAILED` + detail line | reuse `MSG_MANAGED_FILL_FAILED` |
| `extension_unavailable` / `busy` | reuse `MSG_MANAGED_EXTENSION_UNAVAILABLE` / `MSG_MANAGED_BUSY` | same |
| `operation_timeout` / tab errors | reuse `MSG_MANAGED_OPEN_FAILED` | same |

### RT-3.3 `src/execution/serviceExecution.ts` — Digital Home routing
At the **top** of `executeServiceFromTile` (before the site-adapter and Managed blocks):
```ts
const contract = resolveActiveLoginContract(service.metadata ?? {});
if (contract.mode === 'SPECIAL')         return runSpecialFromTile(service, credential, options, contract);
if (contract.mode === 'SPECIAL_INVALID') return failClosedSpecialInvalid(service); // open entry only, no fill
// contract.mode === 'STANDARD' → existing code below, byte-identical
```
- `failClosedSpecialInvalid`: opens the resolved §4.7 entry URL (fallback `getServiceOpenUrl` when unresolvable) with **no** fill of any kind; `status:'open_only'`, `metadataHealth:'fill_failed'`, end-user copy from RT-3.2. No call to `executeManagedAutofill`, `executeGenericAutofill`, `executeMediumAssist`, adapters.
- `runSpecialFromTile`: missing credential → existing `credentials_missing` UX (opens entry URL); else `executeDigitalHomeSpecialLoginFlow`; map to `ServiceExecutionResult` exactly like the Managed branch (`ok` → `status:'ok'`; failure → `open_only` + `fill_failed`).
- All DH entry points already converge on `executeServiceFromTile` (`openWithProfile`, `assistanceActions`, `pocAutofill`) — verify asserts no other DH path reaches Managed/Generic fill for a SPECIAL contract.
- STANDARD (incl. missing discriminator) → the unchanged remainder of the function.

### RT-3.4 Admin Test grid (D-121-38 Part A file) — SPECIAL route
- Enable «טיוטת כניסה מיוחדת» (when a saved draft exists) and «כניסה מיוחדת פעילה» (when resolved mode = SPECIAL); remove the «…תופעל בקרוב.» disabled note. Options for MULTI_STEP / FSMS plans stay visible-but-disabled with «בדיקת מילוי לסוג כניסה זה תופעל בשלב מאוחר יותר.».
- Default selection unchanged from Part A (live contract).
- Press «כניסה לאתר ומילוי שדות» with a SPECIAL option → `executeAdminSpecialLoginFlowTest`. STANDARD option → Part A STANDARD route (untouched).
- **Result recording (SPECIAL):** in-memory, grid session only — outcome message, detail line, context label («טיוטה» / «פעילה»), `planVersion`, `snapshotId`, timestamp, A2 diagnostics block (same formatter). **No** `stampAdminTestPassed`, **no** `autofillProfile.fieldAuthoring` write, **no** `loginFlowPlan` write. A persisted SPECIAL test stamp is **not** in 121.2 (would need a contract decision).
- `userGestureDuringRun === true` → result labelled «לא הוכח — נראה שלחצת באתר בזמן הבדיקה.» and not shown as success (Admin display only; RT-4.6).

### RT-3.5 Unchanged Hub files (asserted)
`managedAutofill.ts`, `autofill/validatedProfile.ts`, `loginContract/{validateSpecialPlan,planActivate,merge,resolve,parse,draftSnapshot}.ts` logic, `AutofillProfileEditor.tsx` (beyond Part A), `SpecialLoginDraftEditor.tsx` (except exposing dirty state if Part A has not already), `RegistryAdmin.tsx` save paths.

---

## RT-4. Ext orchestrator (by file)

### RT-4.1 `extension/background.js` — new message `HUB_SPECIAL_LOGIN_FLOW` → `runSpecialLoginFlow(message, sendResponse, sender)`
State machine (§8.5 subset for FLOATING_SCREEN):
```text
VALIDATING → OPENING → R1 → EXECUTING_OPENER → WAITING_FOR_READINESS → FILLING_STEP → STOPPED_FOR_USER
                                                   any failure ────────────────────────→ FAILED (terminal)
```
1. **VALIDATING** — `specialValidateRunPlan(plan)` (new, pure JS): parity subset of RT-2.1 + validator (pattern, one opener approved for runtime, one step, no exitTransition, declared readiness not self, HTTPS exact-origin descriptors, same-frame step mappings, no reserved kind, credential keys ⊆ mapped fieldIds). Any failure → `FAILED/validate`. All click / readiness / fill targets below are read **only** from this validated plan object (R2 from plan document).
2. **OPENING** — open **one new tab** at `entryUrl` via existing `openGenericRealSiteTab` plumbing with Managed placement (`buildManagedTabCreateProperties(sender)`, `initialDelayMs: MANAGED_AUTOFILL_INITIAL_DELAY_MS`, existing load / operation timeouts). The tab is reused for every later stage of this run; the entry is never re-opened. No reuse of pre-existing tabs at run start (RT-9 Q1).
3. **R1** — tab URL origin === `allowedOrigin` (same check as `specialAuthoringTabGate`, without the authoring-tab selection). Mismatch → `FAILED/r1 origin_mismatch`.
4. **EXECUTING_OPENER** — `specialRuntimeClick(tabId, allowedOrigin, opener)`: resolve `opener.frame` via `resolveDeclaredFrame` (non-polling, unchanged) or frame 0; in-frame `location.origin` check; exact-one `querySelectorAll(locator)`; `element.click()` (same synthetic click as authoring; proven sufficient on both fixtures). Bounded wait for the opener to become exact-one before clicking (poll `SPECIAL_READINESS_POLL_MS`, cap = opener `readiness.timeoutMs`) to cover late-rendered openers. 0 → `opener_missing`; >1 → `opener_ambiguous`. **No** approval flag is read from the message (approval = `approvedForRuntime` in the validated plan).
5. **WAITING_FOR_READINESS** (R3) — poll existing `specialDeclaredReadinessMet(tabId, allowedOrigin, opener.readiness)` every `SPECIAL_READINESS_POLL_MS` until met or `min(readiness.timeoutMs, SPECIAL_RUNTIME_READINESS_MAX_MS = 30000)`. D-121-36 loading ≠ foreign applies unchanged. Timeout → `readiness_timeout`; real foreign HTTPS origin → `frame_origin_mismatch`.
6. **FILLING_STEP** — `specialRunManagedFillInFrame(tabId, allowedOrigin, step, credentials, diagnosticPath)`:
   - Frame: `steps[0]` mappings' shared frame (or top).
   - Per attempt: re-resolve frame with `resolveDeclaredFrame(..., { loadingIsPending: true })` (`frame_missing` / `frame_loading` retryable; anything else hard fail) → inject `GENERIC_REAL_SITE_SCRIPT_FILES.managed` into `frameIds: [frameId]` → call **unchanged** `runManagedAutofill({ allowedOrigin: <frameOrigin or top allowedOrigin>, fieldMappings: <step mappings: fieldId/locatorType/locator only>, credentials, diagnosticPath })`.
   - `allowedOrigin` passed to `runManagedAutofill` = the origin of the document it runs in (plan `frameOrigin` for a frame, `allowedOrigin` for top). This is the **existing** option contract (`root.location.origin !== allowedOrigin` → fail closed inside the runner) — no semantic change; it is a second, in-document R2 check.
   - Retry policy = the Phase 120 wrapper's: `isManagedAutofillRetryable`, `MANAGED_AUTOFILL_RETRY_DELAY_MS`, `GENERIC_REAL_SITE_MAX_ATTEMPTS` (reused constants/functions; `runManagedAutofillOnTab` itself untouched). `targets_not_ready` → existing `enrichManagedTargetsNotReadyResult` for diagnostics.
   - Credentials are sent **only** in this call and **only** to a frameId whose live origin just matched the plan descriptor.
7. **STOPPED_FOR_USER** — return `{ ok:true, state:'STOPPED_FOR_USER', filled, fillDiagnostics, ... }`. **No** further click, key event, `submit()`, or Enter. Final authentication stays with the user.

### RT-4.2 Reused unchanged Ext functions
`openGenericRealSiteTab`, `buildManagedTabCreateProperties`, `resolveDeclaredFrame`, `specialFrameNonceHandshake`, `specialFrameProbe`, `specialDeclaredReadinessMet`, `specialIsHttpsExactOrigin`, `specialIsLoadingFrameDocument`, `specialInjectThenRun`, `isManagedAutofillRetryable`, `enrichManagedTargetsNotReadyResult`, `frame-correlation.js` (§4.10.1 handshake), `page-structure-inspect.js` (`isSpecialDeclaredReadinessMet`), `validated-autofill.js`, `fill-executor.js`, `managed-target-eligibility.js`.

### RT-4.3 Ext files that must stay byte-identical
`manifest.json`, `validated-autofill.js`, `fill-executor.js`, `managed-target-eligibility.js`, `frame-correlation.js`, and in `background.js` the bodies of `runManagedAutofillOnTab`, `openPageAndManagedAutofill`, `runManagedReadinessProbeOnTab`, the `HUB_MANAGED_AUTOFILL` handler, and all authoring handlers (`inspectCurrentAuthoringTab`, `visualMappingCurrentAuthoringTab`, `authoringClickApprovedAction`, …).

### RT-4.4 No authoring behavior at runtime
Runtime never: calls Analyze / inspect collectors, arms Visual, uses reveal-mode readiness, activates / focuses tabs beyond the new tab's default, uses `ensureSpecialAuthoringTab`, reads `approvedForAuthoringContinuation`.

### RT-4.5 Diagnostics (§13)
`logManagedAutofillDiag`-style lines with `runId`, stage, reason, stepId, actionId, fieldId, locator, frameKey — never values, never frameIds leaving the Ext. A2 `fillDiagnostics` passed through unchanged.

### RT-4.6 User gesture during run (D-121-35 G4 carry-over)
The existing gesture watch (`specialGestureWatchInstall` / `Collect`) runs from opener click until readiness in **both** DH and Admin Test (same engine); result field `userGestureDuringRun`. The orchestrator's control flow does **not** change on it (DH users may legitimately click). Only the Admin Test grid presents it as «לא הוכח» (RT-3.4). Install failure → field omitted, run continues (it is evidence, not a gate) — RT-9 Q3.

---

## RT-5. Security / origin rules (runtime)

| Rule | Runtime implementation |
|---|---|
| **R1** | Tab origin === `allowedOrigin` after load, before any click; `resolveDeclaredFrame` re-checks top origin in frame 0 on every frame resolution |
| **R2 from plan** | Frame descriptors come only from the validated plan document in the run message; Hub validated the same plan (complete + runtime gate); presence in an ACTIVE plan / immutable snapshot = the Admin approval record (IF-2.1, A2). Live exact-one iframe + depth-1 + origin === `frameOrigin` before click and before **every** fill attempt; `runManagedAutofill` re-checks origin inside the frame |
| **R3** | Declared readiness only; opener-self rejected (validator + Ext); bounded; failure → «המסך לא נפתח» (Admin) |
| Clicks | Exactly one click per run: the plan's approved opener. Never `final_submit`, never transitions (121.3), never anything discovered |
| Credentials | Only mapped subset; only in the fill call; only to origin-verified document; never logged / persisted |
| Determinism | No AI, no discovery, no alternate locator, no first-match; exact-one everywhere; no silent fallback (§12.1) |
| Permissions | Existing `scripting` + `https://*/*`; nonce handshake only; no `webNavigation` / `debugger` / `getFrameId` |

---

## RT-6. Fail-closed outcome catalogue (machine reasons)

`validate`: `plan_invalid`, `pattern_not_supported_yet`, `plan_shape_unsupported`, `readiness_invalid`, `frame_invalid`, `reserved_action_kind`, `credentials_incomplete`, `special_contract_invalid`, `entry_unresolved`, `draft_incomplete`, `draft_unsaved_changes`
`open`: `url_not_allowed`, `tab_load_error`, `tab_load_timeout`, `operation_timeout`, `no_tab`
`r1`: `origin_mismatch`
`opener` / `frame`: `opener_missing`, `opener_ambiguous`, `frame_missing`, `frame_ambiguous`, `frame_not_depth1`, `frame_origin_mismatch`, `frame_correlation_unavailable`
`readiness`: `readiness_timeout`
`fill`: every existing `runManagedAutofill` reason passed through unchanged
Hub: `extension_unavailable`, `busy`

Every reason maps to a message in RT-3.2; unknown reasons → `MSG_MANAGED_FILL_FAILED` (never a success message).

---

## RT-7. Acceptance criteria

| ID | Criterion |
|---|---|
| **AC-121.2-1** | One Hub entry (`executeSpecialLoginFlow`) and one Ext orchestrator used by Admin Test and DH; only plan context and credential source differ |
| **AC-121.2-2** | DH routing: STANDARD / missing discriminator → existing code path byte-identical (same calls, same order); SPECIAL → orchestrator; SPECIAL_INVALID (corrupt activation / missing active / version mismatch) → open-only, no fill of any kind |
| **AC-121.2-3** | Admin Test DRAFT uses `checkSpecialDraft` snapshot taken once; editor changes during the run do not affect it; unsaved changes block the test |
| **AC-121.2-4** | No metadata write of any kind during/after a run (no ACTIVATE, no `active`, no `autofillProfile`, no stamp) |
| **AC-121.2-5** | Runtime gate: only FLOATING_SCREEN with one runtime-approved opener, one step, no exitTransition, declared readiness; else fail closed with plain Hebrew |
| **AC-121.2-6** | Entry opened once in a new tab; R1 checked before the opener click |
| **AC-121.2-7** | Opener clicked via synthetic `element.click()` only if exact-one in its declared document (top or origin-verified depth-1 frame); missing / ambiguous → fail closed |
| **AC-121.2-8** | R3 declared readiness with bound; D-121-36 loading ≠ foreign; timeout → «המסך לא נפתח» |
| **AC-121.2-9** | Fill runs unchanged `runManagedAutofill` in `frameIds:[resolvedFrameId]` (or 0) with the step subset; `allowedOrigin` option = that document's plan origin; `runManagedAutofillOnTab` / Ext fill files byte-identical |
| **AC-121.2-10** | R2 targets derived only from the plan document; Ext rejects invalid plans; tampered frame fields outside the plan are ignored |
| **AC-121.2-11** | Credentials sent only in the fill call, only to an origin-verified document, only mapped fieldIds; never logged / persisted |
| **AC-121.2-12** | Run stops after fill: zero additional clicks / submits / key events (fixture counters) |
| **AC-121.2-13** | Every failure reason has plain-Hebrew Admin + end-user copy; exact-label rule; no success message on any failure |
| **AC-121.2-14** | Admin Test SPECIAL result shown in-grid with context / planVersion / snapshotId / diagnostics; gesture during run → «לא הוכח» |
| **AC-121.2-15** | MULTI_STEP / FSMS / `final_submit` never executed (fail closed / options disabled) |
| **AC-121.2-16** | Manifest unchanged; no `webNavigation` / `debugger` / `getFrameId`; no site / hostname / serviceId / fixture branches (grep gate) |
| **AC-121.2-17** | STANDARD regression: Phase 116–121 suites PASS; Part A STANDARD Admin Test route and DH STANDARD tile behavior unchanged |
| **AC-121.2-18** | Owner live PASS: Mizrahi-Tefahot (top opener, same-origin depth-1 iframe fields, A2) and PAGI (top opener, cross-origin approved iframe fields) — Admin Test DRAFT + ACTIVE, and Digital Home ACTIVE |

---

## RT-8. Verify plan

### RT-8.1 NEW `scripts/verifyPhase121Runtime.mjs` (synthetic, no site names)
Uses the existing simulated-window harness (as `verifyPhase121IframeSurface.mjs` / D-121-29 handshake tests); real `frame-correlation.js`, real `validated-autofill.js` / `fill-executor.js` loaded unmodified.
| Fixture | Assertion |
|---|---|
| RT-F-TOP | top-document modal opener → top fields → filled → STOPPED_FOR_USER; no frame resolution |
| RT-F-SAME | top opener → same-origin depth-1 iframe fields (A2) → filled in frame |
| RT-F-CROSS | top opener → cross-origin HTTPS iframe fields (descriptor in plan) → filled in frame |
| RT-F-LATE | iframe inserted / navigated after click (blank → origin) → readiness met, fill OK |
| RT-F-SWAP | frame navigates to other HTTPS origin → `frame_origin_mismatch`; **credentials never passed** to any executeScript call (spy) |
| RT-F-R1 | entry redirects to other origin → `origin_mismatch` before click (click counter 0) |
| RT-F-OPENER-0 / -2 | `opener_missing` / `opener_ambiguous` |
| RT-F-TIMEOUT | screen never opens → `readiness_timeout` |
| RT-F-NOSUBMIT | submit / click counters on form + login button stay 0 after STOP |
| RT-F-TAMPER | message with extra `frame` / `approved` fields outside plan → ignored; plan with `http:` descriptor / `final_submit` / 2 steps / exitTransition / reveal marker → rejected at validate |
| RT-PARITY | table of plans: Hub (`validateSpecialPlanComplete` + `validateFloatingScreenRunnable`) and Ext `specialValidateRunPlan` agree |
| RT-SNAPSHOT | snapshot frozen; draft mutation during run not reflected; zero persistence calls (spy on `adminRegistryApi` / Supabase update functions) |
| RT-DH-ROUTE | STANDARD → `executeManagedAutofill` called with identical args; SPECIAL → orchestrator; SPECIAL_INVALID ×3 → no Managed / Generic / medium / adapter call; MULTI_STEP active → `pattern_not_supported_yet` |
| RT-CRED | missing mapped credential → fail before tab open; payload contains only mapped fieldIds |
| RT-GESTURE | simulated trusted gesture → `userGestureDuringRun:true`, flow unchanged |
| RT-STATIC | byte-identical checks of RT-4.3 / RT-3.5 regions vs HEAD; manifest diff empty; grep: no `getFrameId` / `webNavigation` / `debugger`, no fixture names / hostnames / `serviceId ===` in changed files |
Mutation checks (Developer-run, reported): remove R1 check → RT-F-R1 fails; remove per-attempt frame re-resolve → RT-F-SWAP fails; pass top origin to in-frame runner → RT-F-CROSS fails; drop runtime gate → RT-F-TAMPER fails.

### RT-8.2 Regression
All Phase 116–121 verify scripts, `tsc -b`, `npm run build`, lint — exit 0.

---

## RT-9. Owner live validation (after 121.2-impl + Architecture PASS)

Setup: extension reloaded; one browser window; vault unlocked for DH steps.

**L-RT-1 Mizrahi-Tefahot (same-origin iframe, A2)**
1. Registry Admin → «בדיקת מילוי» → select «טיוטת כניסה מיוחדת» → temp values → «כניסה לאתר ומילוי שדות».
2. Expected: one new tab at the HOME entry; floating screen opens by itself (`#logInBtn`); username / password inside the iframe filled; **no** login click; grid shows success with context «טיוטה», planVersion, snapshotId.
3. Confirm nothing changed: live contract, «מילוי אוטומטי מנוהל» data, draft content (reload page).
4. ACTIVATE («הפעל כניסה עם מסך צף» + «הפעל») → «בדיקת מילוי» «כניסה מיוחדת פעילה» → same result, context «פעילה».
5. Digital Home: tile with saved vault credentials → same result; message «המילוי האוטומטי הושלם…»; Owner presses «כניסה» manually.

**L-RT-2 PAGI (cross-origin approved iframe)**
Same steps 1–5. Expected opener = `a[data-toggle="modal"][data-target="#login"]`-type locator from the draft (not the skip link); fields filled inside the `https://online.pagi.co.il` frame; no login click.

**L-RT-3 Negative / regression**
- During an Admin Test run, press a key in the site tab before the screen opens → result «לא הוכח…».
- Admin Test on a STANDARD service («מיפוי רגיל (שמור)») and its DH tile → behavior and messages exactly as before 121.2.
- (Optional, if available) a FLOATING_SCREEN service with top-document fields (e.g. Super-Pharm / CAL) → filled with no frame involvement. If not run live, recorded as offline-only (RT-F-TOP).

---

## RT-10. Risks

| Risk | Mitigation |
|---|---|
| Entry URL redirects (HOME → localized path) so `openGenericRealSiteTab` URL match never fires | Developer must confirm `tabUrlMatchesGenericTarget` behavior on both fixtures; if it blocks → **STOP** and report (changing that shared helper is a STANDARD-path change) |
| Opener rendered late / page still hydrating | Bounded exact-one wait before click (cap = readiness timeout) |
| Floating screen already open state or cookie banner covering opener | Fresh tab per run; synthetic click does not require hit-testing; banner-blocked cases fail closed (`readiness_timeout`) — Admin re-authors |
| Frame reload between readiness and fill | Per-attempt re-resolution + origin check; `runManagedAutofill` origin check in-document |
| Hub and Ext validators drift | RT-PARITY table test |
| DH user clicks during run | Flow unaffected; gesture recorded only |
| SPECIAL_INVALID leaves end users without autofill | Intended fail-closed; Admin recovery via D-121-30 A3 grid return path |
| Scope creep into MULTI_STEP | Runtime gate + AC-121.2-15 |

### Open questions for Architecture
1. **Tab at run start:** always a fresh tab (this DD) — or may Admin Test reuse the SPECIAL authoring session tab? Recommendation: fresh tab for both surfaces (deterministic, identical to DH; avoids an already-open floating screen breaking R3).
2. **DH routing position:** SPECIAL / SPECIAL_INVALID check placed **before** the legacy site-adapter block (§12.1: SPECIAL has no fallback). Confirm.
3. **Gesture watch at runtime:** evidence-only field in both paths, presented only by Admin Test (RT-4.6). Confirm this is within "same runtime behavior".
4. **Schema coverage:** 121.2 requires credentials for every **mapped** fieldId; it does **not** fail when a `login_fields` entry is unmapped in the plan (validator does not require coverage today). Confirm, or require coverage (would be a validator change → affects ACTIVATE).
5. **SPECIAL_INVALID DH behavior:** open the entry URL without fill (parity with STANDARD "not ready") vs. not opening at all. Recommendation: open, no fill.
6. **Top-document fields live proof:** requested live AC covers Mizrahi + PAGI (both iframe fields). Top-document credential fields are covered offline (RT-F-TOP) and optionally live (L-RT-3). Confirm this satisfies §4.10 Genericity for 121.2.

---

## Manager Review (121.2)
MANAGER_REVIEW_STATUS: **READY_FOR_APPROVAL**

### Review Notes
121.2 DD: FLOATING_SCREEN runtime through one Hub entry + one Ext orchestrator shared by Admin Test «בדיקת מילוי» (DRAFT snapshot via `checkSpecialDraft` or ACTIVE) and Digital Home (ACTIVE via `resolveActiveLoginContract`; SPECIAL_INVALID fail-closed, no fallback). Fresh tab → R1 → one approved opener click → R3 declared readiness → unchanged `runManagedAutofill` in top or origin-verified depth-1 frame (R2 from the plan document, re-checked per attempt) → STOP. No metadata writes, no ACTIVATE side-effect, STANDARD / Ext fill byte-identical, no manifest change, no MULTI_STEP / `final_submit`. Prerequisite: D-121-38 Part A accepted.

### Exact next step
**Architecture DD review** of Slice **121.2** (answer RT-10 questions 1–6). **STOP.** Do **not** hand off to Developer until Architecture PASS. 121.3+ NOT AUTHORIZED.

---

## Prompt — Architect (Yuri)

```text
@team-Yuri/.cursor/skills/team-yuri-architect

ROLE: Architect (Yuri)
PHASE: 121.2
TASK: Review Manager DD — FLOATING_SCREEN runtime via the shared Login Flow Orchestrator

READ: team-Yuri/manager-phase121.md (Slice 121.2)
ALSO: team-Yuri/arch-phase121.md §8.1–§8.7, §12 / §12.1, §4.10 runtime + §4.10.1,
      D-121-35 / D-121-36, D-121-38, §15 row 121.2, 121.1-IF-impl review note on R2

APPROVE or REJECT against 121.2 scope and forbidden lists.
Confirm: one engine for Admin Test + DH; STANDARD / executeManagedAutofill eligibility
and Ext runManagedAutofill / fillField semantics unchanged (only injection frame);
R1 first; R2 re-validated from the plan document + live per attempt; R3 declared
readiness; stop before final auth; DRAFT snapshot immutable; no ACTIVATE / metadata
writes; DH SPECIAL_INVALID fail-closed without fallback; FLOATING_SCREEN only;
no final_submit; no manifest / webNavigation / debugger / getFrameId; no site branches;
live AC on Mizrahi-Tefahot + PAGI + STANDARD regression.
Answer DD open questions 1–6 (§RT-10).

RETURN: PASS | FAIL + required corrections
121.2-impl NOT authorized until PASS.
121.3+ NOT AUTHORIZED.
```
