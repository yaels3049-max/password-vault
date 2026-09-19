# Manager Phase 119 — Detailed Design

## Phase Identifier
PHASE=119

## Status
STATUS: **`readiness_wait_inputs` LIVE VERIFIED / ACCEPTED** (AC-119-R-1…R-9 PASS)

## Status history
- READY_FOR_DEVELOPER — Slice 119.1 ONLY (authorized)
- SLICE_119_1_VERIFIED — Developer + Verification complete (see `dev-phase119.md`)
- 119.1 ACCEPTED (Owner 2026-09-17)
- READY_FOR_DEVELOPER — Slice 119.2 ONLY (authorized Owner 2026-09-17)
- SLICE_119_2_VERIFIED — Developer + Verification complete
- 119.2 ACCEPTED / LIVE VERIFIED (Owner 2026-09-20)
- 119.3 Investigation COMPLETE — Owner decision **(A)** 2026-09-20
- READY_FOR_DEVELOPER — **`readiness_wait_inputs` ONLY** (Owner 2026-09-20; DD)
- readiness automated R-1…R-8 PASS; package for Architect
- **AC-119-R-9 Owner live = FAIL** (2026-09-20 first attempt) — discrepancy investigation authorized
- READY_FOR_DEVELOPER — Discrepancy investigation ONLY (diagnostic)
- **AC-119-R-9 Owner live = PASS** (2026-09-20 retest after explicit Chrome unpacked Reload)
- Prior FAIL classified **D1 stale extension** (**ACCEPTED**)
- Discrepancy investigation **CLOSED**
- STATUS: **`readiness_wait_inputs` LIVE VERIFIED / ACCEPTED**

## Slice authorization
| Slice | Status |
|---|---|
| **119.1** Capability / Inspection Framework | **ACCEPTED** |
| **119.2** Visual Mapping MVP | **ACCEPTED / LIVE VERIFIED** |
| **119.3** Evidence investigation | **COMPLETE** (Owner decision A) |
| **`readiness_wait_inputs`** | **LIVE VERIFIED / ACCEPTED** (AC-119-R-1…R-9 PASS) |
| **AC-119-R-9 discrepancy investigation** | **CLOSED** |
| D2 eligibility tightening | **Not required** |
| iframe / shadow / modal / multi-step / Convergence | **NOT AUTHORIZED** — **do not authorize further structural DD** |

## Source
- `team-Yuri/PHASE.md` — `PHASE=119`
- `team-Yuri/arch-phase119.md` — **`readiness_wait_inputs` — LIVE VERIFIED / ACCEPTED** (Owner 2026-09-20)
- Owner retest after explicit Chrome unpacked-extension Reload
- Prior readiness DD retained below as historical implementation record

---

## CLOSED — AC-119-R-9 / Discrepancy Investigation

### Outcome
| Item | Record |
|---|---|
| **AC-119-R-9** | **OWNER LIVE PASS** (retest 2026-09-20) |
| **`readiness_wait_inputs`** | **LIVE VERIFIED / ACCEPTED** |
| Discrepancy investigation | **CLOSED** |
| Production readiness “fix” | **Not required** — D1 (stale extension) explained prior FAIL |

### Prior failure (historical — ACCEPTED root cause)
| Item | Record |
|---|---|
| First live attempt | AC-119-R-9 FAIL (~0.5s Analyze complete before controls; no-high-confidence) |
| Root cause | **D1 — stale loaded Chrome extension** (pre-readiness build still executing) |
| Classification | Implementation/integration execution discrepancy — **not** a new structural capability gap |
| **D2** premature early-exit / eligibility tightening | **Not required** by retest evidence |
| iframe / Shadow DOM / modal / multi-step | **Not required** for this validation target on current evidence |

### Owner OBSERVED FACT — live retest (after Reload)
| Fact | Status |
|---|---|
| Explicit Chrome unpacked-extension **Reload** performed | OBSERVED |
| Analyze did **not** complete immediately | OBSERVED |
| Analyze **waited** while Login Entry page rendered | OBSERVED |
| Login **controls became available** | OBSERVED |
| Analyze successfully **produced/populated field mappings** | OBSERVED |
| Approved readiness behavior exhibited with current build loaded | OBSERVED |

### Manager conclusions
1. Repo readiness wiring is validated live when the **current** extension build is loaded.  
2. Automated R-1…R-8 PASS + Owner R-9 PASS after reload = capability **LIVE VERIFIED / ACCEPTED**.  
3. Operator procedure: after readiness (or any extension) code changes, **Reload** unpacked extension before live Analyze residual tests.  
4. **Do not authorize further structural DD** (iframe / shadow / modal / multi-step / Convergence) from this acceptance.

### Residual rule (unchanged)
If a future live Analyze reports zero inputs while controls are visibly rendered **with a confirmed-current extension build**, STOP → Architecture investigation. Do not auto-add capability.

### Hard stops (unchanged)
No iframe / Shadow DOM / modal / multi-step implementation. No Hapoalim-specific product logic. Convergence remains deferred. No further structural DD under Phase 119 from this closeout.

---

## Slice `readiness_wait_inputs` — Detailed Design (HISTORICAL — LIVE VERIFIED / ACCEPTED)

### Goal
Admin Analyze / Login Page inspect must **not** finalize a zero-input `SafePageStructure` solely because inspection ran before eligible top-document controls finished rendering.

Ship **bounded observation/retry** on the Admin inspect path only: wait up to a maximum window, poll at a controlled interval, **early-exit** when eligible inputs appear; on timeout with zero eligible inputs → empty structure → **D-118-14** (no provider calls).

### Normative behavior
```text
Admin Analyze → ADMIN_LOGIN_PAGE_INSPECT
  → open/use Login Entry tab (existing)
  → enforce allowedOrigin; frameIds: [0] only
  → LOOP (bounded):
       collect eligible top-doc inputs (same eligibility spirit as page-structure-inspect)
       IF count > 0 → return SafePageStructure immediately (early exit)
       ELSE wait pollIntervalMs; repeat until maxTotalWaitMs
  → IF still zero → return empty/zero-input structure
  → Hub: D-118-14 → zero MappingLlmProvider calls; fail-closed UX
```

**Forbidden architecture:** a single arbitrary `sleep(N)` as the sole readiness mechanism (AC-119-R-1).

### Generic default parameters (Manager — justified, NOT Hapoalim-tuned)

| Parameter | Default | Justification |
|-----------|---------|---------------|
| **`maxTotalWaitMs`** | **10_000** | Upper bound for typical SPA/client hydration on login shells without unbounded Admin hangs. Chosen as a **generic** product default for Assisted Mapping inspect — **not** measured from Bank Hapoalim or any hostname. |
| **`pollIntervalMs`** | **250** | Observation cadence that allows quick early-exit once inputs appear, without busy-spin / excessive script wakeups. Generic UI-poll convention; **not** service-specific. |
| **Early exit** | On first observation with **≥1 eligible** top-document input | Satisfies AC-119-R-2 / R-3; avoids unnecessary full-window wait. |
| **Timeout** | Return structure with **zero** eligible inputs | Triggers existing D-118-14 path (AC-119-R-4). |

**Constants:** name clearly (e.g. `ADMIN_INSPECT_READINESS_MAX_WAIT_MS`, `ADMIN_INSPECT_READINESS_POLL_MS`) in Admin-inspect code — **do not** reuse or alter Phase 117 Managed fill timing constants as the readiness architecture (Managed timing remains untouched).

**Do not** add hostname/serviceId overrides, Hapoalim selectors (`#userCode` / `#password` as product branches), or per-bank wait tables.

### Eligibility (inspect spirit)
Reuse the **same eligibility spirit** as `collectSafePageStructure` / `page-structure-inspect.js` (visible editable light-DOM inputs suitable for mapping — exclude hidden/submit/button/image as today).  
**Never** capture credential values or live input `.value` contents (AC-119-R-7).

### Scope

| In | Out |
|---|---|
| Admin Analyze / `ADMIN_LOGIN_PAGE_INSPECT` readiness only | Phase 117 Managed Autofill timing / fill / verify changes |
| Top document `frameIds: [0]` | iframe / Shadow DOM / modal / multi-step |
| `allowedOrigin` enforcement | hostname / serviceId / Hapoalim-specific timing or selectors |
| Catalog id `readiness_wait_inputs` as this capability | Auto-submit; AI/runtime Autofill changes |
| D-118-14 when still zero after window | Weakening Phase 118 safety filtering |
| Automated AC-119-R-1…R-8 | Other structural capability DDs |

### Capability wiring
- Catalog id **`readiness_wait_inputs`** is already reserved in `LOGIN_EXPERIENCE_CAPABILITY_CATALOG`.
- **Default Analyze structure/proposal capability remains `single_page_top`.**
- Readiness is the **timing layer** on Admin inspect before structure is finalized — enable/record `readiness_wait_inputs` as the inspect readiness behavior for this slice (audit/labels OK).
- Do **not** treat readiness as a second LLM inspect mode that replaces `single_page_top`.
- Do **not** enable iframe/shadow/modal/multi-step catalog ids.

### Design decisions (Manager)

| ID | Decision |
|---|---|
| **M-119-R-1** | Implement bounded poll/observe in the **Admin inspect** path (`ADMIN_LOGIN_PAGE_INSPECT` / background + page-structure collection), not in Managed Autofill runner |
| **M-119-R-2** | Parameters: `maxTotalWaitMs=10000`, `pollIntervalMs=250`, early exit on eligible inputs — generic defaults documented above |
| **M-119-R-3** | Prefer injecting readiness loop adjacent to existing `collectSafePageStructure` call (background `func` or small helper in `page-structure-inspect.js`) — still `frameIds: [0]`, origin check each cycle or before return |
| **M-119-R-4** | If a fixed `initialDelayMs` exists today on Admin inspect open, it must **not** remain the sole readiness architecture; readiness poll/early-exit is normative. Any residual short settle delay must be subordinate and documented — not Hapoalim-tuned |
| **M-119-R-5** | Timeout + zero inputs → return empty inputs structure; Hub keeps **D-118-14** (assert zero provider calls in verify) |
| **M-119-R-6** | No credentials/values in inspect payload; no form submit |
| **M-119-R-7** | No hostname/serviceId branching in new/changed readiness code |
| **M-119-R-8** | Phase 117 Managed runtime and Phase 118 safety filtering **unchanged** except consuming non-empty structure when readiness succeeds |

### Files expected to change
- `extension/background.js` — Admin login-page inspect session: bounded readiness observe/retry before finish
- `extension/generic/page-structure-inspect.js` — optional helper for eligible-count / wait loop (keep value-free)
- `src/assistedMapping/capabilities.ts` — mark readiness inspect behavior available / comments; do not enable unauthorized structural caps
- `src/assistedMapping/analyzeLoginPage.ts` — only if Hub must pass readiness flags/timeouts (prefer defaults in extension if possible)
- `src/assistedMapping/types.ts` — constants/labels if needed
- `scripts/fixtures/phase119-readiness-*.html` (or equivalent) — present / delayed / never-appear
- `scripts/verifyPhase119ReadinessWaitInputs.mjs` (new) — AC-119-R-1…R-8 signals
- `team-Yuri/dev-phase119.md` — readiness evidence section

**Do not change:** Managed Autofill fill path semantics, Visual Mapping happy path (except carefully shared inspect helpers), encryption, Phase 116 identity.

### Order of work
1. Extension readiness observe/retry on Admin inspect (origin + top-frame preserved)  
2. Wire early-exit + timeout → empty structure  
3. Confirm Hub Analyze still applies D-118-14 on empty inputs (no provider)  
4. Capability catalog comment / support marking for `readiness_wait_inputs` (inspect timing only)  
5. Fixtures + `verifyPhase119ReadinessWaitInputs.mjs`  
6. Run readiness verify + Phase 119.1/119.2 + 118 + 117 + `tsc`  
7. Document evidence; note **live residual Hapoalim** for Owner (AC-119-R-9) — not a Developer auto-close gate without Owner

### Acceptance Criteria (AC-119-R-1 … AC-119-R-9)

| AC | Criterion | Signal |
|---|---|---|
| AC-119-R-1 | Bounded observation/retry (not sole arbitrary sleep) | Code + verify shows poll/early-exit architecture |
| AC-119-R-2 | Inputs already present → continue without full-window wait | Fixture: immediate inputs; duration ≪ max wait |
| AC-119-R-3 | Inputs appear within window → captured in SafePageStructure | Fixture: delayed DOM insert; structure non-empty |
| AC-119-R-4 | Window expires zero inputs → D-118-14; **zero** provider calls | Fixture: never appear + assert no `proposeFieldMappings` / provider |
| AC-119-R-5 | Top-doc `frameIds: [0]`; origin enforced; no iframe/shadow/modal/multi-step | Static + path asserts |
| AC-119-R-6 | No hostname/serviceId; no Hapoalim-specific timing/selectors | Static scan of readiness files |
| AC-119-R-7 | No credentials/values; no auto-submit; Managed runtime unchanged; 118 safety unchanged | Affirmation + 117/118 regression |
| AC-119-R-8 | Automated verify: present / delayed / timeout+D-118-14 / origin + 117/118 PASS | Script PASS |
| AC-119-R-9 | Live residual (Bank Hapoalim): Analyze observes `#userCode` / `#password` after readiness | **OWNER LIVE PASS** (2026-09-20 after explicit Chrome unpacked Reload) |

### Automated verify plan

| Test | Expected | AC |
|---|---|---|
| T-R1 | Readiness uses max wait + interval + early exit (not sleep-only) | R-1 |
| T-R2 | Inputs present at t0 → structure non-empty; wait truncated | R-2 |
| T-R3 | Inputs appear mid-window → structure includes them | R-3 |
| T-R4 | Never appear → empty inputs; Hub/Analyze path makes **zero** provider calls | R-4 / D-118-14 |
| T-R5 | Inspect inject uses `frameIds: [0]`; origin mismatch fails closed | R-5 |
| T-R6 | No hapoalim/hostname/serviceId branches in readiness code | R-6 |
| T-R7 | Inspect payload paths do not read `.value` / credentials; no submit | R-7 |
| T-R8 | `verifyPhase117ManagedAutofill` + Phase 118 verify PASS | R-7, R-8 |
| T-R9 | Prior 119.1 / 119.2 verify PASS; `tsc` PASS | regression |

**Live residual (CLOSED):** Owner retest after Reload — Analyze waited for render; controls available; mappings populated; **AC-119-R-9 PASS**. Prior FAIL = **D1 stale extension** (ACCEPTED).

### Developer STOP conditions
- Implementing iframe / shadow / modal / multi-step / Convergence → **STOP**
- Hapoalim-specific waits, selectors, or hostname branches → **STOP**
- Changing Phase 117 Managed runtime fill timing as part of this slice → **STOP**
- Weakening D-118-14 (provider call on empty inputs) → **STOP**
- Creating DD or code for any other structural capability → **STOP**
- Claiming AC-119-R-9 Owner live PASS without Owner → **STOP** (note residual only)

### Required Developer Evidence
`team-Yuri/dev-phase119.md` (readiness section):
- Files changed; parameter constants + justification echo
- Automated T-R1…T-R9 results
- Explicit: D-118-14 preserved; Managed runtime unchanged; no other structural caps
- Live residual procedure note for Owner (AC-119-R-9)
- Package ready for Architecture Owner review **before** Owner live acceptance

---

## Slice 119.1 — Detailed Design

*(Complete / ACCEPTED — retained for history.)*

119.1 Goal and decisions remain normative. Do not regress.

---

## Slice 119.2 — Detailed Design (Visual Mapping MVP)

*(Complete / ACCEPTED / LIVE VERIFIED — retained for history.)*

### Goal
Ship **generic Visual Mapping** so an Admin can map `fieldId` ↔ a visible page control by selecting the field in the Hub and identifying the control on the **real Login Entry tab** (extension), without typing CSS. Result prefills the mapping editor; Admin **explicitly** saves. Managed Autofill remains Phase 117 deterministic.

119.2 remains historical reference. **Do not** re-open 119.2 scope under readiness. **Do not** author DD for any other structural capability.

---

## Manager Review
MANAGER_REVIEW_STATUS: **COMPLETE** — `readiness_wait_inputs` LIVE VERIFIED / ACCEPTED

### Review Notes
- Owner AC-119-R-9 **PASS** after explicit Chrome unpacked-extension **Reload** (2026-09-20).
- Analyze waited for render; controls available; mappings populated.
- Prior FAIL classified **D1 stale extension** — **ACCEPTED**. D2 / iframe / shadow / modal / multi-step **not required**.
- Discrepancy investigation **CLOSED**.
- **Do not authorize further structural DD** under Phase 119 from this acceptance.

### Required Corrections
_None._
