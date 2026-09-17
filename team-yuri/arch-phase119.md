# Architecture Phase 119

## Phase Identifier
PHASE=119

## Status
STATUS: READY_FOR_OWNER_REVIEW

CREATED: 2026-09-17 — Architecture definition for Owner review. **Does not authorize Manager Detailed Design or Developer implementation** until Owner APPROVES this contract.

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
- Implement **independently testable development slices** (see §13), starting with framework + Visual Mapping + the first evidence-backed structural inspect capability.
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
| **Phase 119** | Establish the **generic capability framework** and ship **small, evidence-ordered slices** that make advanced authoring possible. Success ≠ every site works. |
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

## 12. Hapoalim structural investigation findings (read-only)

**Login Entry (Phase 118):** `https://login.bankhapoalim.co.il/ng-portals/auth/he/login`  
**Observed:** tab opens; `SafePageStructure.inputs.length === 0`; D-118-14 correctly skips provider.

### Code-backed classification

| Cause | Likelihood | Evidence |
|---|---|---|
| **Iframe** — fields outside top frame | **High** | Inspect hard-coded `frameIds: [0]`; Phase 110 docs/dev notes: banking portals often need `allFrames: true` for fillable fields |
| **Dynamic rendering / too early** | **Medium–High** | Inspect `initialDelayMs: 0`; no wait-for-inputs; Angular `ng-portals` SPA; Phase 110 used multi-second SPA settle for banks |
| **Shadow DOM** | **Medium** as gap; lower as sole proof without live pierce evidence | Inspect does not traverse shadow; legacy detector pierces **open** shadow only |
| **Locator-candidate filter** | **Low–Medium** | Inputs without id/name/autocomplete/aria-label dropped |
| **Custom non-input controls** | **Low–Medium** | Collector only `input`/`textarea` |
| **Navigation / wrong origin** | **Low** for empty success | Empty `ok: true` implies origin matched |

**Conclusion:** Limitation is **structural capture / capability**, not AI mapping quality. Hapoalim remains a **validation target** for advanced inspect/Visual Mapping slices — **not** an architecture fork.

---

## 13. Development slices

Slices are **independently testable**. Implementation is **not authorized** by this document until Owner APPROVES and Manager issues DD **per slice**.

### Slice order (evidence-based)

| Slice | Name | Rationale |
|---|---|---|
| **119.1** | Login Experience inspection / capability model | Framework first: enums, fail-closed unsupported capability, contract stubs, D-118-14 preserved |
| **119.2** | Visual Mapping (MVP) | Unblocks Admin when structure/AI cannot map; matches product direction; no third-party embed |
| **119.3** | Same-origin frame inspect (policy-bound) | Highest-likelihood Hapoalim/Phase-110 gap vs `single_page_top` |
| **119.4** | Readiness wait-for-inputs (bounded) | Co-factor for SPA banks; small; pairs with 119.3 |
| **119.5+** | Open-shadow pierce / modal activation / multi-step | Later; only when evidence justifies; each a separate authorization |

**Illustrative only if Owner reorders after review** — default order above is normative for handoff unless Owner amends.

### Per-slice rule

Manager creates DD **only** for the individually authorized slice. Developer implements **only** that slice. No “support everything” mega-implementation.

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

### Slice 119.3 — Same-origin frame inspect

| ID | Criterion |
|---|---|
| AC-119.3-1 | Capability-gated frame inspect aggregates same-origin (policy) frame inputs into SafePageStructure |
| AC-119.3-2 | Cross-origin frames not scraped |
| AC-119.3-3 | Synthetic iframe fixture: child-frame inputs visible to inspect when capability enabled |
| AC-119.3-4 | Default/`single_page_top` path unchanged when capability not requested |
| AC-119.3-5 | No service-specific frame rules |
| AC-119.3-6 | Operator optional: Hapoalim re-inspect under capability — report `inputs.length` only (no site-specific code) |
| AC-119.3-7 | Phase 117/118 regression PASS |

### Slice 119.4 — Readiness wait-for-inputs

| ID | Criterion |
|---|---|
| AC-119.4-1 | Bounded wait/retry until inputs appear or timeout |
| AC-119.4-2 | Timeout → fail closed / empty structure; D-118-14 applies |
| AC-119.4-3 | Synthetic delayed-render fixture PASS |
| AC-119.4-4 | No hostname-specific delays |
| AC-119.4-5 | Phase 117/118 regression PASS |

Later slices (shadow/modal/multi-step) receive AC tables when Architecture authorizes them.

---

## 15. Regression requirements (Phases 117 / 118)

Before any slice CLOSE:

| Suite | Requirement |
|---|---|
| `verifyPhase117ManagedAutofill.mjs` | PASS |
| `verifyPhase118AssistedMapping.mjs` | PASS |
| Existing validated services (e.g. Rivhit / Meuhedet Managed) | Must not regress Operator-known PASS behavior |
| No new LLM on Managed runtime | Static/grep PASS |

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
- Closed Shadow DOM as mandatory 119 deliverable  
- Completing D-118-13 inside Phase 119 by default (remains production gate unless Owner expands)

---

## 17. Deferred capabilities / workstreams

| Item | Status |
|---|---|
| **Autofill Runtime Convergence** | **DEFERRED** — inventory preserved: `team-Yuri/inventory-autofill-runtime-convergence.md` (htzone, practice, `POC_GENERIC_FILL`, medium/identity-first, Clalit/legacy consumers) |
| **D-118-13** | Production Admin security/privacy review — deferred readiness |
| **Hapoalim / zero-capture as full product support** | Deferred capability beyond slices that generically improve capture |
| **Filtered-network operational NFR** | Deferred production-readiness |
| **Modal / multi-step / closed shadow** | Deferred to later slices/phases unless evidence elevates them |

---

## 18. Phase 119 CLOSE criteria

Phase 119 may CLOSE only when:

1. Owner-approved slices through **at least 119.1 + 119.2** are implemented, verified, and Operator-accepted (or Owner explicitly narrows CLOSE to a declared subset).  
2. Slice **119.3** either PASS or explicitly deferred by Owner with rationale (Hapoalim evidence).  
3. Phase 117 + 118 regression PASS.  
4. No service-specific adapters introduced by 119.  
5. Visual Mapping MVP meets AC-119.2-* (if 119.2 in CLOSE set).  
6. Deferred workstreams remain explicitly listed (Convergence, D-118-13, etc.) — not silently marked complete.  
7. Architecture Owner formal CLOSE review recorded.

---

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-119-1: Capability framework over adapters** | North Star without per-site code | New patterns → generic capabilities |
| **D-119-2: AI authoring-only** | Preserve Phase 117 determinism | No LLM on fill path |
| **D-119-3: Visual Mapping via real tab + extension** | Avoid embedding untrusted login UI in Admin | Hub field select + page click → derived target |
| **D-119-4: Slice-based delivery** | Independently testable; no “support everything” | Manager DD per authorized slice only |
| **D-119-5: Evidence-ordered structural slices** | Hapoalim/Phase 110 point to frames + SPA timing | 119.3 frame inspect; 119.4 readiness after Visual Mapping MVP |
| **D-119-6: Hapoalim is validation target only** | Empty inputs = capability gap | No Hapoalim-specific product logic |
| **D-119-7: Convergence deferred** | Separate workstream | Do not migrate/delete htzone/practice/generic in 119 |
| **D-119-8: Fail closed, no silent fallback** | Safety | Unsupported → honest failure |
| **D-119-9: Extend 117/118, do not replace** | Compatibility | Additive contracts; regression mandatory |
| **D-119-10: Untrusted page + Admin-only** | Security | Injection-safe; no secrets to AI |

---

## Constraints / Non-Negotiables

- No production implementation until Owner APPROVES this arch **and** Manager authorizes a specific slice DD.  
- No service-specific Autofill adapters for advanced login in Phase 119.  
- No automatic submit.  
- No credential values to AI.  
- Preserve validated Managed services.  
- D-118-14 remains in force.

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
- **Optional Operator:** Hapoalim inspect under 119.3/119.4 capabilities — evidence only.  
- **Expected:** Capability failures fail closed; simple sites unchanged.

---

## Handoff Notes for Manager

1. **Do not** create Developer DD until Architecture Owner marks this document **APPROVED**.  
2. After APPROVED, authorize **one slice at a time** starting **119.1** unless Owner reorders.  
3. Do not open Convergence migrations under Phase 119.  
4. Do not add Hapoalim-specific tasks — only generic capability work + optional Operator evidence.  
5. Security Owner: keep D-118-13 visible as production gate.  
6. Verification: require Phase 117/118 scripts PASS every slice.

## Architect Review
ARCHITECT_REVIEW_STATUS: READY_FOR_OWNER_REVIEW

### Review Notes
Architecture definition complete for Owner review (2026-09-17). Hapoalim investigation (read-only) informs slice order: Visual Mapping + same-origin frame inspect + readiness. Convergence deferred. No implementation authorized.

### Required Corrections
None pending Owner review feedback.
