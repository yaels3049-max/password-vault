# Architecture Phase 119

## Phase Identifier
PHASE=119

## Status
STATUS: APPROVED

APPROVED: 2026-09-17 — Architecture Owner APPROVED corrected `arch-phase119.md` as normative Phase 119 contract.

CREATED: 2026-09-17 — Architecture definition for Owner review. **Does not authorize Manager Detailed Design or Developer implementation** until Owner APPROVES this contract.

AMENDED: 2026-09-17 — Owner REJECT correction applied: do **not** pre-commit same-origin iframe as Slice 119.3. After Visual Mapping, Slice 119.3 is **evidence-driven capability selection**. Structural implementation slices only after generic evidence classifies the unseen-control structure. CLOSE requires 119.1+119.2; later structural capabilities are authorized-from-evidence or explicitly deferred.

SLICE AUTHORIZATION: **119.1 ACCEPTED**. **119.2 ACCEPTED / LIVE VERIFIED**. **119.3 Investigation COMPLETE** (Owner A → readiness). **`readiness_wait_inputs` = LIVE VERIFIED / ACCEPTED** (AC-119-R-1…R-9 PASS; Owner retest 2026-09-20 after explicit Chrome unpacked Reload). Prior R-9 fail = **D1 stale extension** (ACCEPTED). **All other structural capabilities NOT authorized.**

## Title
Phase 119 — Generic Advanced Login Mapping

## Phase Goal

Extend the Phase 117 / 118 architecture beyond **simple top-document automatic mapping** by establishing a **Generic Login Experience Framework** and shipping the **smallest useful advanced capability slices** that keep authoring generic (capability-based, not service-specific).

**Authoring model (normative):**

```text
Agent analyzes (when capability allows)
  → Admin visually maps / corrects when necessary
  → Admin validates configuration
  → Deterministic Managed Autofill runtime executes
```

The AI remains an **AUTHORING assistant only**. It must **never** participate in normal credential-fill execution.

---

## 1. Purpose and scope

### In scope (Phase 119)

- Define a **Login Experience capability model** that can grow incrementally (iframe, Shadow DOM, modal, multi-step, dynamic controls, Visual Mapping) without per-service adapters.
- Implement **independently testable development slices** (see §13), starting with framework + Visual Mapping; **then** evidence-driven selection of any further structural capability.
- Preserve Phase 117 Managed Autofill and Phase 118 Assisted Mapping contracts; extend enums/contracts rather than replace them.
- Use Bank Hapoalim as a **validation / investigation target**, not as architecture.

### Out of scope (Phase 119)

- “Support every website” as an acceptance criterion (North Star only).
- Autofill Runtime Convergence (htzone / practice / legacy generic retirement) — **DEFERRED** workstream.
- Hapoalim-specific or hostname/serviceId adapters.
- Runtime AI Autofill.
- Automatic submit.
- Closed Shadow DOM as a mandatory Phase 119 deliverable (may be a later slice if justified).
- Unrestricted production Admin Analyze without completing **D-118-13** (carried production-readiness gate).

---

## 2. Product North Star vs Phase 119 bounded scope

| | |
|---|---|
| **North Star** | Arbitrary web login experiences become **configurable** without permanent service-specific production code. |
| **Phase 119** | Establish the **generic capability framework** and ship **119.1 + 119.2** (committed). Further structural capabilities only after **evidence-driven** authorization. Success ≠ every site works. |
| **Rule** | A newly supported login pattern should normally require a new **GENERIC CAPABILITY**, not a new service-specific adapter. |

Forbidden unless Architecture explicitly approves an exceptional case:

- `if (hostname === …)` / `if (serviceId === …)` in product fill/authoring paths  
- service-specific selector knowledge  
- service-specific runtime adapters  

---

## 3. Current architecture baseline (Phases 117 / 118)

### Phase 117 — Managed Autofill (preserve)

- `metadata.autofillProfile`: CSS `fieldMappings`, `loginEntryUrl` / `allowedOrigin`, `supportState`, monotonic `configVersion`, validation bind.
- Deterministic runtime: exact-one visible editable CSS target; top-document fill inject today; **no auto-submit**; human Save / live validation authority for `validated`.
- Schema-dynamic: join by `field.id` only.

### Phase 118 — Assisted Mapping (preserve)

- Authoring-only Agent; `InspectionCapability: single_page_top`; `AgentTask: propose_field_mappings`.
- Extension → `SafePageStructure` (no values/cookies); `MappingLlmProvider` server-side; deterministic safety before HIGH prefill.
- **D-118-14:** empty `inputs` → fail closed **before** provider.
- Agent never saves / never sets `validated`.

### Must preserve vs may extend

| Must preserve | May extend (this phase) |
|---|---|
| Managed profile model + supportState/configVersion rules | New `InspectionCapability` / authoring capability enum members |
| CSS (or successor **safe target**) representation for runtime fill | Target descriptors that still compile to deterministic runtime bindings |
| Authoring-only AI; no LLM on Managed execution | Visual Mapping authoring path (Admin+extension; no AI required for click-pick) |
| D-118-14 empty-input pre-provider gate | Capability-aware inspect that can populate inputs when a capability is enabled |
| No auto-submit; Admin-only authoring | Fail-closed when capability unsupported (no silent heuristic/adapter fallback) |
| Existing validated services behavior | Additive slices only |

---

## 4. Login Experience capability model

### 4.1 Principle

Authoring and (where applicable) inspection declare **capabilities**. Runtime execution uses only **Admin-validated deterministic bindings**. Unsupported capability → **fail closed** (honest UX), never silent fallback to heuristic or service-specific adapters.

### 4.2 Capability catalog (framework; not all shipped in 119)

| Capability id (illustrative) | Meaning |
|---|---|
| `single_page_top` | Phase 118 — top-document light-DOM `input`/`textarea` inspect + Assisted Mapping |
| `visual_target_selection` | Admin picks visible control on real Login Entry tab; extension derives target |
| `same_origin_frame_inspect` | Aggregate safe structure from same-origin (policy-bound) child frames |
| `open_shadow_pierce` | Collect controls from **open** shadow roots |
| `readiness_wait_inputs` | Bounded wait/retry until inputs appear or timeout |
| `modal_activation` | Declared interaction step to reveal login UI (generic step model) |
| `multi_step_sequence` | Ordered steps before fields are available |
| `dynamic_control_appear` | Observe controls that appear after interaction/time (bounded) |

Phase 119 **defines** the catalog and ships slices for a **subset** (§13). Later phases add capabilities without rewriting the framework.

### 4.3 Generic capability rule

```text
New login pattern → new generic capability (+ contracts + AC)
               NOT → new per-service adapter
```

---

## 5. Visual Mapping architecture

### 5.1 Purpose

When Assisted Mapping cannot confidently produce a usable mapping (including `inputs.length === 0` after D-118-14, or uncertain fields), Admin enters **Visual Mapping** mode.

### 5.2 Preferred security / UX shape (normative direction)

1. **Do not** embed arbitrary third-party login pages inside the Admin Hub (no third-party iframe embed of Login Entry in Admin).
2. Open the **real Login Entry** in a browser tab via the extension (same trust model as inspect/Managed open).
3. Admin selects the **credential field** being mapped in the Hub.
4. Admin **identifies/clicks** the corresponding visible control on the real login page.
5. Extension derives a **technical target/locator description** (safe representation — §7).
6. Admin does **not** need to know or type CSS selectors.
7. **No credential values** required during field selection.
8. Mapping remains **configuration** until Admin explicitly validates (Phase 117 rules).
9. **No automatic submit.**

### 5.3 Trust boundaries

- Hub ↔ extension messaging: Admin-only session; message types scoped to Visual Mapping authoring.
- Page content is **untrusted**; click coordinates / DOM reads happen in extension-controlled inject with origin bind to configured Login Entry / `allowedOrigin`.
- Derived targets must pass deterministic safety (candidate allowlist or equivalent Visual Mapping validation) before HIGH/runtime eligibility — Visual Mapping does not bypass Phase 117 exact-one / origin rules at **validation** time.

### 5.4 Relationship to AI

Visual Mapping is **Admin+extension**, not an LLM vision requirement for Phase 119 MVP. AI Assisted Mapping remains optional when structure exists; Visual Mapping is the recovery / advanced authoring path.

---

## 6. Inspection / extension contracts

### 6.1 Existing (preserve)

- `ADMIN_LOGIN_PAGE_INSPECT` → `SafePageStructure` for `single_page_top` (`frameIds: [0]`, light-DOM `input`/`textarea`).
- Managed: `HUB_MANAGED_AUTOFILL` with CSS mappings; top-document fill inject today.

### 6.2 Extensions (Phase 119 framework)

Introduce capability-scoped inspect / authoring messages (names illustrative; Manager freezes):

| Concern | Contract direction |
|---|---|
| Capability declaration | Inspect/authoring requests carry `InspectionCapability` (or equivalent capability set) |
| Frame-aware inspect | Optional same-origin child-frame aggregation with explicit policy (never “all frames blindly”) |
| Visual Mapping session | Hub selects `fieldId` → extension arms click capture on Login Entry tab → returns target descriptor |
| Fail closed | Unsupported capability → structured error / empty structure; **no** provider call on empty inputs (D-118-14 remains) |

### 6.3 What Phase 118 inspect does **not** do today (baseline fact)

- Child frames (`frameIds: [0]` only)  
- Shadow DOM pierce  
- Wait/retry for SPA inputs (`initialDelayMs: 0`, no empty-input retry)  
- Non-`input`/`textarea` controls  

---

## 7. Generic target / locator representation

### 7.1 Runtime today

Phase 117: `locatorType: 'css'` + locator string; exact-one visible editable match at fill time.

### 7.2 Phase 119 direction

- Authoring may produce targets via Assisted Mapping **or** Visual Mapping.
- Runtime continues to prefer **deterministic, Admin-validated** bindings.
- Any richer target descriptor (e.g. frame path + CSS, open-shadow path + CSS) must:
  - be serializable in `autofillProfile` (or additive metadata with version bump rules),
  - be executable by Managed runtime **without AI**,
  - preserve exact-one / origin / no-submit invariants,
  - fail closed if frame/shadow path unavailable at runtime.

**Do not** introduce XPath/AI locators on the Managed execution path.

---

## 8. Runtime execution model

```text
Digital Home / open
  → executeServiceFromTile
  → (unchanged priority for deferred adapters/generic — Convergence DEFERRED)
  → if Managed validated+eligible → HUB_MANAGED_AUTOFILL
       → open Login Entry
       → apply validated fieldMappings (CSS / extended safe targets)
       → fill only; user submits
```

Phase 119 **must not** require AI at fill time.  
Phase 119 **must not** silently fall back to heuristic/`POC_GENERIC_FILL` or site adapters when Managed is claimed but capability unsupported — fail closed with clear Admin/user messaging.

---

## 9. Security and privacy boundaries

| Requirement | Normative rule |
|---|---|
| Untrusted page content | Treat all page text/DOM/attrs as untrusted (prompt injection if sent to AI) |
| Credentials | Never send credential **values** to mapping AI; Visual Mapping needs no values |
| Cookies / tokens / storage | Never export to AI or Hub logs |
| AI-authored scripts | Forbidden — no arbitrary script execution authored by AI |
| Admin-only | Analyze / Visual Mapping / capability inspect = Global Admin only |
| Origin / navigation | Bind to configured HTTPS Login Entry / `allowedOrigin` |
| Frame boundaries | Explicit capability + policy; no unrestricted cross-origin frame read |
| Safe targets | Deterministic representation; validated before `validated` supportState |
| No auto-submit | Absolute |
| Deterministic runtime | Managed fill remains non-LLM |
| Fail closed | Unsupported capability / empty structure / origin mismatch |
| No silent fallback | No heuristic or service-specific adapter fallback when Managed/authoring capability fails |
| Auditability | Admin-authored mappings and Visual Mapping actions auditable without secrets |

**D-118-13** remains an explicit **production** Admin Analyze readiness gate (deferred completion; not silently done).

---

## 10. Failure behavior

| Condition | Behavior |
|---|---|
| `single_page_top` returns `inputs.length === 0` | D-118-14: no provider call; honest closed/uncertain UX; offer Visual Mapping when that slice is live |
| Requested capability unsupported | Fail closed; do not invent mappings; do not call adapter/heuristic silently |
| Visual Mapping origin mismatch / navigation away | Abort session; no partial silent bind |
| Managed fill target missing / not exact-one | Existing Phase 117 fail-closed fill outcome |
| Provider/AI error | Form mappings unchanged (Phase 118 AC spirit) |

---

## 11. Genericity requirements

- No hostname / serviceId branching in new Phase 119 product paths.
- No Hapoalim vocabulary, selectors, or special cases.
- Fixtures for AC must use **synthetic** pages (iframe fixture, shadow fixture, visual-pick fixture) — live Hapoalim is Operator validation evidence only.
- Schema remains dynamic (`field.id`).

---

## 12. Hapoalim structural investigation — facts vs hypotheses

**Login Entry (Phase 118 live):** `https://login.bankhapoalim.co.il/ng-portals/auth/he/login`  
**Role:** validation / investigation **target only** — not architecture; no Hapoalim-specific product logic.

### 12.1 OBSERVED FACT (live + code)

| Fact | Source |
|---|---|
| Login Entry tab opened successfully | Phase 118 live |
| Phase 118 `single_page_top` inspect returned `page.inputs.length === 0` | Phase 118 live Request payload |
| D-118-14 correctly stops before provider when inputs empty | Phase 118 live + code |
| Current inspector examines **top document only** (`frameIds: [0]`) | `extension/background.js` |
| Current inspector does **not** pierce Shadow DOM | `page-structure-inspect.js` |
| Current inspector does **not** wait/retry for delayed controls (`initialDelayMs: 0`, no empty-input retry) | inspect path |
| Current collector only queries light-DOM `input`/`textarea` (with locator-candidate filter) | `page-structure-inspect.js` |

These facts prove a **capability boundary** of `single_page_top`, **not** which advanced structure Hapoalim uses.

### 12.2 CAPABILITY HYPOTHESIS (not proven; must not drive normative slice choice)

Any of the following **may** explain unseen controls; **none** is established by current live evidence alone:

- child **iframe** (same-origin or cross-origin)  
- **Shadow DOM** (open or closed)  
- **delayed SPA** rendering  
- **custom / non-input** controls  
- locator-candidate filter dropping present inputs  
- other structure / state  

Historical Phase 110 notes about banking portals and `allFrames` are **hypothesis-supporting context only**, not Phase 119 proof that Hapoalim fields are in a same-origin iframe.

### 12.3 Architecture rule

```text
OBSERVED FACT  → informs that advanced capture/Visual Mapping is needed
CAPABILITY HYPOTHESIS → must be confirmed by generic inspection evidence
                         BEFORE authorizing a structural implementation slice
```

Bank Hapoalim must **not** be the reason Phase 119 pre-commits to same-origin iframe inspection (or any other single structural capability).

---

## 13. Development slices

Slices are **independently testable**. Implementation is **not authorized** by this document until Owner APPROVES and Manager issues DD **per slice**.

### 13.1 Committed initial implementation scope

| Slice | Name | Status |
|---|---|---|
| **119.1** | Login Experience Capability / Inspection Framework | **ACCEPTED** (Owner 2026-09-17) |
| **119.2** | Visual Mapping MVP | **ACCEPTED / LIVE VERIFIED** (Owner 2026-09-20) |

### 13.2 After Visual Mapping — evidence gate (not a pre-chosen capability)

| Slice | Name | Status |
|---|---|---|
| **119.3** | Evidence-Driven Advanced Capture Investigation / Capability Selection | **COMPLETE** (Owner decision **A** 2026-09-20) |

### 13.3 Evidence-authorized implementation slices

| Slice | Capability | Status |
|---|---|---|
| **119.3-impl / readiness** | `readiness_wait_inputs` | **LIVE VERIFIED / ACCEPTED** (Owner 2026-09-20; AC-119-R-1…R-9 PASS) |
| iframe / Shadow DOM / modal / multi-step / other | — | **NOT AUTHORIZED** |

### 13.4 Subsequent structural slices (illustrative — still not pre-authorized)

Only after further evidence (or residual failure after readiness) may Owner authorize **one** of, for example:

- same-origin iframe inspection  
- open Shadow DOM traversal  
- custom-control targeting  
- modal activation  
- another generic capability  

Each such slice gets its own AC table when authorized.

**Residual rule after readiness:** If live Analyze still reports zero inputs while controls are visibly rendered, **STOP** — return to Architecture investigation. Do **not** auto-add another capability.

### Per-slice rule

Manager creates DD **only** for the individually authorized slice. Developer implements **only** that slice. No “support everything” mega-implementation. No pre-commitment to iframe implementation from likelihood alone.

---

## 14. Acceptance criteria per slice

### Slice 119.1 — Capability model

| ID | Criterion |
|---|---|
| AC-119.1-1 | Capability enum/catalog documented and enforced in authoring/inspect request path |
| AC-119.1-2 | Unsupported capability → fail closed (structured outcome); no silent heuristic/adapter fallback |
| AC-119.1-3 | `single_page_top` behavior preserved for existing Assisted Mapping |
| AC-119.1-4 | D-118-14 still holds (empty inputs → no provider call) |
| AC-119.1-5 | No hostname/serviceId branching introduced |

### Slice 119.2 — Visual Mapping MVP

| ID | Criterion |
|---|---|
| AC-119.2-1 | Admin maps `fieldId` ↔ page control via Hub selection + click on real Login Entry tab (extension) |
| AC-119.2-2 | No third-party Login Entry embed inside Admin Hub |
| AC-119.2-3 | Admin need not type CSS; extension derives safe target |
| AC-119.2-4 | No credential values required for selection |
| AC-119.2-5 | Mapping is config only until Phase 117 validation/activation |
| AC-119.2-6 | No automatic submit |
| AC-119.2-7 | Origin bind to configured Login Entry / `allowedOrigin` |
| AC-119.2-8 | Admin-only |
| AC-119.2-9 | Synthetic fixture E2E: pick control → locator appears in editor |
| AC-119.2-10 | Phase 117/118 regression PASS |

### Slice 119.3 — Evidence-Driven Advanced Capture Investigation / Capability Selection

| ID | Criterion |
|---|---|
| AC-119.3-1 | Investigation produces a written classification of unseen-control structure using **generic** evidence (not service-specific code) |
| AC-119.3-2 | Report explicitly separates **OBSERVED FACT** from **CAPABILITY HYPOTHESIS** / conclusion |
| AC-119.3-3 | Classification is specific enough to select **or defer** a next generic capability (iframe / shadow / wait / custom / modal / other / inconclusive) |
| AC-119.3-4 | Optional Operator targets (e.g. Hapoalim) used only as validation evidence; no hostname/serviceId product branching |
| AC-119.3-5 | Architecture records either (A) authorization of exactly one next structural slice with AC, or (B) explicit deferral of all structural slices |
| AC-119.3-6 | No structural inspect/runtime capability is implemented under the 119.3 slice itself |
| AC-119.3-7 | Phase 117/118 regression unaffected (investigation-only; or any throwaway probe tooling is DEV-only and removed/gated) |

### Slice readiness_wait_inputs — bounded Admin inspect readiness (AUTHORIZED)

| ID | Criterion |
|---|---|
| AC-119-R-1 | Admin Analyze/inspect uses bounded observation/retry for eligible top-document inputs (not a single arbitrary sleep as the sole architecture) |
| AC-119-R-2 | If eligible inputs already present → continue without unnecessary full-window wait |
| AC-119-R-3 | If eligible inputs appear within the readiness window → captured in SafePageStructure |
| AC-119-R-4 | If window expires with zero eligible inputs → D-118-14 applies; **zero** MappingLlmProvider calls |
| AC-119-R-5 | Top-document scope unchanged (`frameIds: [0]`); allowedOrigin enforced; no iframe/shadow/modal/multi-step |
| AC-119-R-6 | No hostname/serviceId branching; no Hapoalim-specific timing/selectors |
| AC-119-R-7 | No credentials or live input values captured; no auto-submit; Phase 117 Managed runtime unchanged; Phase 118 safety filtering unchanged |
| AC-119-R-8 | Automated verify covers present / delayed / timeout+D-118-14 / origin safety + Phase 117/118 regression PASS |
| AC-119-R-9 | Live residual (Bank Hapoalim): Analyze observes `#userCode` / `#password` after readiness. **Owner live retest 2026-09-20 after explicit Chrome unpacked Reload: PASS** |

**Post-119.3 structural slices:** AC tables authored only when Architecture authorizes that capability from evidence.

---

## 15. Regression requirements (Phases 117 / 118)

Before any **implementation** slice CLOSE (119.1, 119.2, and any later authorized structural slice):

| Suite | Requirement |
|---|---|
| `verifyPhase117ManagedAutofill.mjs` | PASS |
| `verifyPhase118AssistedMapping.mjs` | PASS |
| Existing validated services (e.g. Rivhit / Meuhedet Managed) | Must not regress Operator-known PASS behavior |
| No new LLM on Managed runtime | Static/grep PASS |

Slice **119.3** (investigation) must not regress production behavior.

---

## 16. Explicit non-goals

- Support every website in Phase 119  
- Runtime AI Autofill  
- Auto-submit  
- Per-service adapters (Hapoalim/htzone/etc.) as the solution model  
- Autofill Runtime Convergence migrations/deletions  
- Embedding third-party login pages in Admin  
- Weakening Phase 117 deterministic rules  
- Replacing Phase 118 Assisted Mapping  
- **Pre-committing to same-origin iframe inspect (or any structural capability) without evidence-backed Architecture authorization**  
- Completing D-118-13 inside Phase 119 by default (remains production gate unless Owner expands)

---

## 17. Deferred capabilities / workstreams

| Item | Status |
|---|---|
| **Autofill Runtime Convergence** | **DEFERRED** — inventory preserved: `team-Yuri/inventory-autofill-runtime-convergence.md` (htzone, practice, `POC_GENERIC_FILL`, medium/identity-first, Clalit/legacy consumers) |
| **D-118-13** | Production Admin security/privacy review — deferred readiness |
| **Hapoalim / zero-capture as full product support** | Deferred capability; Hapoalim remains a validation target only |
| **Filtered-network operational NFR** | Deferred production-readiness |
| **Same-origin iframe inspect / open shadow / modal / multi-step** | **Not committed** — remain deferred unless separately authorized from residual evidence |
| **`readiness_wait_inputs`** | **AUTHORIZED** (Owner 2026-09-20) — see implementation charter; not deferred |

---

## 18. Phase 119 CLOSE criteria

Phase 119 may CLOSE only when:

1. **Committed scope:** Slices **119.1** and **119.2** are implemented, verified, and Operator-accepted (unless Owner explicitly narrows further — not below both without amendment).  
2. **Evidence gate:** Slice **119.3** investigation is complete with Architecture record of either:  
   - **(A)** a specific structural capability authorized from evidence and that slice completed to PASS, **or**  
   - **(B)** all post–Visual Mapping structural capabilities **explicitly deferred**.  
3. Phase 119 CLOSE **must not** require Same-Origin Frame Inspect (or any other structural capability) **unless** Architecture later authorized that capability from evidence under (A).  
4. Phase 117 + 118 regression PASS for all implementation slices in the CLOSE set.  
5. No service-specific adapters introduced by 119.  
6. Visual Mapping MVP meets AC-119.2-*.  
7. Deferred workstreams remain explicitly listed (Convergence, D-118-13, structural caps under (B), etc.) — not silently marked complete.  
8. Architecture Owner formal CLOSE review recorded.

---

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-119-1: Capability framework over adapters** | North Star without per-site code | New patterns → generic capabilities |
| **D-119-2: AI authoring-only** | Preserve Phase 117 determinism | No LLM on fill path |
| **D-119-3: Visual Mapping via real tab + extension** | Avoid embedding untrusted login UI in Admin | Hub field select + page click → derived target |
| **D-119-4: Slice-based delivery** | Independently testable; no “support everything” | Manager DD per authorized slice only |
| **D-119-5: Facts vs hypotheses; evidence before structural impl** | Empty top-doc inputs ≠ proof of iframe/shadow/delay class | 119.3 = investigation/selection; no pre-commit to iframe |
| **D-119-6: Hapoalim is validation target only** | Observed capability gap only | No Hapoalim-specific product logic |
| **D-119-7: Convergence deferred** | Separate workstream | Do not migrate/delete htzone/practice/generic in 119 |
| **D-119-8: Fail closed, no silent fallback** | Safety | Unsupported → honest failure |
| **D-119-9: Extend 117/118, do not replace** | Compatibility | Additive contracts; regression mandatory |
| **D-119-10: Untrusted page + Admin-only** | Security | Injection-safe; no secrets to AI |
| **D-119-11: Initial CLOSE scope = 119.1 + 119.2** | Owner correction | Structural caps after VM are (A) evidence-authorized or (B) deferred |

---

## Constraints / Non-Negotiables

- No production implementation until Owner APPROVES this arch **and** Manager authorizes a specific slice DD.  
- No service-specific Autofill adapters for advanced login in Phase 119.  
- No automatic submit.  
- No credential values to AI.  
- Preserve validated Managed services.  
- D-118-14 remains in force.  
- Do not implement structural inspect capabilities under 119.3 itself.

---

## Dependencies and Interfaces

- Phase 117: `autofillProfile`, Managed runtime, Admin editor  
- Phase 118: Assisted Mapping, SafePageStructure, Edge provider path, D-118-14  
- Extension: inspect + new Visual Mapping / capability inspect messages  
- Deferred: Convergence inventory paths remain live until a future phase  

---

## Functional Testability

- **Admin:** Visual Mapping session on synthetic fixture Login Entry; Assisted Mapping still works for simple top-doc.  
- **Runtime:** Managed fill using Visual Mapping–authored locator on fixture.  
- **119.3:** Generic evidence package + Architecture (A)/(B) decision; optional Operator target reports without product branching.  
- **Expected:** Capability failures fail closed; simple sites unchanged.

---

## Handoff Notes for Manager

1. **Do not** create Developer DD until Architecture Owner marks this document **APPROVED**.  
2. After APPROVED, authorize **119.1**, then **119.2**, then **119.3 investigation** — each with its own DD/authorization.  
3. **Do not** open same-origin iframe (or other structural) DD until Architecture completes 119.3 and authorizes that capability.  
4. Do not open Convergence migrations under Phase 119.  
5. Do not add Hapoalim-specific implementation tasks.  
6. Security Owner: keep D-118-13 visible as production gate.  
7. Verification: require Phase 117/118 scripts PASS every **implementation** slice.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
2026-09-17 — Initial draft for Owner review.  
2026-09-17 — **Owner REJECT correction applied:** Slice 119.3 is evidence-driven capability selection (not pre-committed iframe). CLOSE = 119.1+119.2 + (A) evidence-authorized structural slice or (B) explicit deferral. Hapoalim §12 separates OBSERVED FACT vs CAPABILITY HYPOTHESIS. Convergence deferred. No implementation authorized.

2026-09-17 — **Owner APPROVED.** Slice **119.1** authorized only. 119.2 / 119.3 / structural caps not authorized.

2026-09-17 — **Slice 119.1 COMPLETE (pending Owner acceptance).** Manager DD → Developer → Verification finished. Evidence: `team-Yuri/dev-phase119.md`, `team-Yuri/manager-phase119.md`. AC-119.1-1…5 PASS; Phase 117 + 118 regression PASS; tsc PASS. **119.2 / 119.3 / structural / Convergence still NOT authorized.**

2026-09-17 — **Owner ACCEPTED Slice 119.1.** Evidence package accepted. **Slice 119.2 AUTHORIZED only.** 119.3 / structural / Convergence remain NOT authorized.

2026-09-20 — **Owner ACCEPTED / LIVE VERIFIED Slice 119.2.** Independent real-site cases: Meuhedet + Spotify via Visual Mapping → explicit approval → Managed Autofill PASS. **119.3 investigation later authorized separately.**

2026-09-20 — **Owner AUTHORIZED 119.3 — INVESTIGATION ONLY.** See Slice 119.3 charter. Structural implementation NOT authorized.

2026-09-20 — **Owner decision (A):** 119.3 investigation COMPLETE. Authorize implementation slice **`readiness_wait_inputs`** (Admin Analyze/inspect bounded observation/retry). Residual live gate: Hapoalim Analyze must observe `#userCode` / `#password` after render. iframe/shadow/modal/multi-step/Convergence remain NOT AUTHORIZED.

### Required Corrections
None.

---

## Slice 119.1 — Completion / Evidence Package (Architecture Owner Review)

### Verdict
**119.1 ACCEPTED** (Owner 2026-09-17) — Capability / Inspection Framework.

### What shipped
| Item | Detail |
|---|---|
| Catalog | `LOGIN_EXPERIENCE_CAPABILITY_CATALOG` (shipped + reserved ids) |
| Supported set | `SUPPORTED_INSPECTION_CAPABILITIES` = [`single_page_top`] only |
| Hub gate | `proposeFieldMappings` fail-closed on unsupported before provider / before D-118-14 empty path |
| Edge gate | `inspectionCapability !== 'single_page_top'` → `unsupported_capability` (400) |
| Error code | `unsupported_capability` on `MappingProposalErrorCode` |

### Acceptance criteria
| AC | Result |
|---|---|
| AC-119.1-1 | **PASS** — catalog + supported set enforced |
| AC-119.1-2 | **PASS** — unsupported → zero provider calls; structured error |
| AC-119.1-3 | **PASS** — `single_page_top` preserved (118 verify + 119.1 verify) |
| AC-119.1-4 | **PASS** — D-118-14 empty inputs → zero provider calls |
| AC-119.1-5 | **PASS** — no host/service branching in capability module |

### Regression
| Suite | Result |
|---|---|
| `verifyPhase119CapabilityFramework.mjs` | **PASS** |
| `verifyPhase118AssistedMapping.mjs` | **PASS** |
| `verifyPhase117ManagedAutofill.mjs` | **PASS** |
| `tsc -p tsconfig.app.json --noEmit` | **PASS** |

### Explicitly not done at 119.1 acceptance time (historical)
- 119.2 / 119.3 / structural / Convergence were not authorized at 119.1 acceptance

### Artifacts
- Architecture: `team-Yuri/arch-phase119.md` (this document)
- Manager DD: `team-Yuri/manager-phase119.md`
- Developer evidence: `team-Yuri/dev-phase119.md`
- Code: `src/assistedMapping/capabilities.ts`, Hub `agentService.ts`, Edge `propose-field-mappings`, verify script

### Owner ask
~~Accept Slice 119.1~~ → **ACCEPTED** (Owner 2026-09-17).

---

## Slice 119.2 — Completion / Evidence Package (Architecture Owner Review)

### Verdict
**119.2 ACCEPTED / LIVE VERIFIED** (Owner 2026-09-20) — Visual Mapping MVP.

### What shipped
| Item | Detail |
|---|---|
| UX | Admin selects field → מיפוי חזותי → real Login Entry tab → click control → CSS locator prefills editor → explicit Save |
| Extension | `visual-target-pick.js` + `ADMIN_VISUAL_MAPPING_START` (top document only) |
| Hub | `startVisualMappingForField` — no LLM, no credentials, no persist |
| Safety | Origin bind; unsupported/non-exact-one fail closed; no auto-submit |
| Fixture | `scripts/fixtures/phase119-visual-pick-login.html` (`#visual-user`) |

### Acceptance criteria (automated / prior package)
| AC | Result |
|---|---|
| AC-119.2-1 | **PASS** — Hub field + extension pick → locator prefill |
| AC-119.2-2 | **PASS** — no Login Entry embed in Admin |
| AC-119.2-3 | **PASS** — derived CSS; Admin need not type CSS |
| AC-119.2-4 | **PASS** — no credential values |
| AC-119.2-5 | **PASS** — config/prefill only until Save |
| AC-119.2-6 | **PASS** — no automatic submit |
| AC-119.2-7 | **PASS** — origin bind / mismatch abort |
| AC-119.2-8 | **PASS** — Admin editor only |
| AC-119.2-9 | **PASS** — synthetic fixture → `#visual-user` |
| AC-119.2-10 | **PASS** — Phase 117/118 regression |

### Regression (package)
| Suite | Result |
|---|---|
| `verifyPhase119VisualMapping.mjs` | **PASS** |
| `verifyPhase119CapabilityFramework.mjs` | **PASS** |
| `verifyPhase118AssistedMapping.mjs` | **PASS** |
| `verifyPhase117ManagedAutofill.mjs` | **PASS** |
| `tsc -p tsconfig.app.json --noEmit` | **PASS** |

### Owner live validation (2026-09-20) — independent of Analyze / AI

Normative proof path confirmed:

```text
Admin field selection
  → real-tab visual target selection
  → locator derivation
  → explicit Admin approval
  → validated Managed configuration
  → deterministic Managed Autofill
```

**Constraints held during live validation:** no Analyze Login Page; no AI mapping; no manual CSS entry; no service-specific implementation; no auto-submit.

#### CASE 1 — Meuhedet
| Step | Evidence |
|---|---|
| Start | Existing mappings cleared |
| Visual Mapping | `id_number` → `#Username`; `mobile_number` → `#MobilePhoneNumber` |
| Approval | Operator explicitly approved |
| Runtime | Digital Home → Meuhedet → Managed Autofill |
| Result | identification number filled **PASS**; mobile number filled **PASS** |

#### CASE 2 — Spotify
| Step | Evidence |
|---|---|
| Login Entry | `https://accounts.spotify.com/en/login?...` (Operator-provided) |
| Schema | credential field `email` |
| Visual Mapping | `email` → `#username` |
| Note | Initial runtime before mapping approval is **not** classified as a defect |
| After approval | `supportState = validated` |
| Runtime | Digital Home → Spotify → Managed Autofill |
| Result | email field filled automatically **PASS** |

### Explicitly not done (authorization boundaries held)
- 119.3 investigation — **COMPLETE** (Owner decision A)
- `readiness_wait_inputs` — **AUTHORIZED** separately (implementation charter)
- iframe / Shadow DOM / modal / multi-step **implementation** — **NOT AUTHORIZED**
- Autofill Runtime Convergence — **DEFERRED**
- Bank Hapoalim / any service-specific product logic — **NONE**

### Artifacts
- Manager DD: `team-Yuri/manager-phase119.md` (Slice 119.2)
- Developer evidence: `team-Yuri/dev-phase119.md` (Manager/Verification to append live evidence)
- Code: `extension/generic/visual-target-pick.js`, `extension/background.js`, `src/assistedMapping/visualMapping.ts`, `src/admin/AutofillProfileEditor.tsx`

### Owner ask
~~Accept Slice 119.2~~ → **ACCEPTED / LIVE VERIFIED** (Owner 2026-09-20).

2026-09-17 — Slice 119.2 package COMPLETE (automated).  
2026-09-20 — **Owner ACCEPTED / LIVE VERIFIED** with Meuhedet + Spotify cases.

---

## Slice 119.3 — Investigation COMPLETE + Owner Decision (A)

### Investigation status
**COMPLETE.** Owner reviewed evidence and selected **(A) AUTHORIZE next implementation slice**.

### Classification (Owner-accepted OBSERVED FACT)
**Delayed / dynamic rendering (readiness / timing)** on the Analyze-owned tab lifecycle:

1. Login Entry tab opens.  
2. Inspection completes.  
3. Visible login controls appear only afterward.

Therefore current inspection can execute **before** eligible login inputs exist.

### Additional OBSERVED FACT (post-render Visual Mapping)
After rendering, Visual Mapping successfully selected:
- `user_code` → `#userCode`
- `password` → `#password`

### Architecture decision (A)
Authorize generic capability **`readiness_wait_inputs`** for **Admin Analyze/inspection** only.

### Decision (B) not selected
Structural deferral of readiness is **not** chosen.

### Explicitly not authorized by this decision
iframe · Shadow DOM · modal · multi-step · Convergence · Hapoalim-specific anything · Managed runtime changes

---

## Slice `readiness_wait_inputs` — Implementation Charter (AUTHORIZED)

### Status
**AUTHORIZED** for Manager DD → Developer → Verification (Owner 2026-09-20).  
Return evidence package to Architecture Owner **before** Owner live acceptance.

### Capability
Catalog id: `readiness_wait_inputs` (already reserved in `LOGIN_EXPERIENCE_CAPABILITY_CATALOG`).

### Normative behavior
Admin Analyze/inspection **must not** immediately conclude zero inputs when the page may still be rendering eligible top-document controls.

Use **bounded observation/retry**:
- maximum total wait  
- controlled retry/observation interval  
- **immediate continuation** once eligible inputs are observed  
- timeout → fail-closed / empty structure → **D-118-14** (zero provider calls)

**Do not** use a single arbitrary sleep as the architecture. Exact parameters are Manager DD responsibility, justified as **generic defaults** — not Hapoalim-tuned.

### Scope
| In | Out |
|---|---|
| Admin Analyze / inspect path readiness | Phase 117 Managed fill timing changes |
| Top document only (`frameIds: [0]`) | iframe / Shadow DOM / modal / multi-step |
| Origin bind preserved | hostname/serviceId / Hapoalim-specific timing or selectors |
| Eligible input observation (same eligibility spirit as inspect) | Capturing credential/current input values |
| D-118-14 if still zero after window | Auto-submit; AI/runtime Autofill changes; weakening Phase 118 safety |

### Verification (required before Owner live)
**Automated:** AC-119-R-1…R-8 signals (present / delayed appear / timeout+D-118-14 / origin / 117+118 regression).

**Live residual — Bank Hapoalim (Operator):** Analyze normally; PASS requires inspection payload to observe rendered login inputs corresponding to `#userCode` and `#password`. If controls visibly rendered but inspection still zero → **STOP** → Architecture investigation; do not auto-add another capability.

### Manager / Developer roles
- **Manager:** Detailed Design for `readiness_wait_inputs` only (parameters + verify plan); no other structural DD.  
- **Developer:** implement only approved readiness DD.  
- **Verification:** AC-119-R-* + 117/118; package for Architect/Owner.  
- **Architect:** review evidence; no production code.

### Checkpoint notes
**`readiness_wait_inputs` LIVE VERIFIED / ACCEPTED** (Owner 2026-09-20). Prior AC-119-R-9 FAIL classified as **D1 stale extension**. No further structural slices authorized from this acceptance.

---

## `readiness_wait_inputs` — LIVE VERIFIED / ACCEPTED (Owner 2026-09-20)

### Status
**AC-119-R-9 = OWNER LIVE PASS** (retest after explicit Chrome unpacked-extension Reload).  
**`readiness_wait_inputs` = LIVE VERIFIED / ACCEPTED.**  
Discrepancy investigation **CLOSED**.

### Prior failure (historical — ACCEPTED root cause)
| Item | Record |
|---|---|
| First live attempt | AC-119-R-9 FAIL (~0.5s Analyze complete before controls; no-high-confidence) |
| Root cause | **D1 — stale loaded Chrome extension** (pre-readiness build still executing) |
| Classification | Implementation/integration execution discrepancy — **not** a new structural capability gap |
| D2 eligibility tightening | **Not required** by retest evidence |
| iframe / Shadow DOM / modal / multi-step | **Not required** for this validation target on current evidence |

### Owner OBSERVED FACT — live retest (after Reload)
| Fact | Status |
|---|---|
| Explicit Chrome unpacked-extension Reload performed | OBSERVED |
| Analyze did **not** complete immediately | OBSERVED |
| Analyze waited while Login Entry page rendered | OBSERVED |
| Login controls became available | OBSERVED |
| Analyze successfully produced/populated field mappings | OBSERVED |
| Approved readiness behavior exhibited with current build loaded | OBSERVED |

### Architecture conclusions
1. Repo readiness wiring is validated live when the **current** extension build is loaded.  
2. Automated R-1…R-8 PASS + Owner R-9 PASS after reload = capability **LIVE VERIFIED**.  
3. Operator procedure note: after readiness (or any extension) code changes, **Reload** unpacked extension before live Analyze residual tests.  
4. No additional structural capability is authorized by this acceptance.

### Residual rule (unchanged)
If a future live Analyze reports zero inputs while controls are visibly rendered **with a confirmed-current extension build**, STOP → Architecture investigation. Do not auto-add capability.

### Hard stops (unchanged)
No iframe / Shadow DOM / modal / multi-step implementation. No Hapoalim-specific product logic. Convergence remains deferred.

### Architect Review note
2026-09-20 — **AC-119-R-9 PASS** after explicit extension Reload. **D1 ACCEPTED** as root cause of prior FAIL. **`readiness_wait_inputs` LIVE VERIFIED / ACCEPTED.** No further structural slices authorized.

---

## Phase 119 — Status Snapshot (post readiness live accept)

| Item | Status |
|---|---|
| 119.1 Capability framework | **ACCEPTED** |
| 119.2 Visual Mapping | **ACCEPTED / LIVE VERIFIED** |
| 119.3 Investigation | **COMPLETE** → Owner **(A)** readiness |
| `readiness_wait_inputs` | **LIVE VERIFIED / ACCEPTED** (R-1…R-9) |
| iframe / shadow / modal / multi-step | **NOT AUTHORIZED** |
| Autofill Runtime Convergence | **DEFERRED** |
| D-118-13 | **Deferred** production Admin Analyze gate |

### CLOSE readiness (Architecture view)
Per §18: committed 119.1+119.2 accepted; 119.3 evidence gate satisfied via **(A)** with readiness slice completed to Owner live PASS. Remaining CLOSE blockers are Owner formal CLOSE review plus explicit listing of deferred workstreams (Convergence, D-118-13, other structural caps). **Architect does not CLOSE Phase 119 in this note** without Owner formal CLOSE authorization.

### Next architecture checkpoint
1. Manager / Developer / Verification **record** Owner retest evidence (reload + wait + Hapoalim Analyze success + D1 classification) in `manager-phase119.md` / `dev-phase119.md`.  
2. Owner decides: **formal Phase 119 CLOSE**, or authorize any further work (none recommended from Hapoalim readiness evidence).  
3. Until Owner CLOSE: Phase 119 remains **ACTIVE** with deferred items listed; no structural implementation.
