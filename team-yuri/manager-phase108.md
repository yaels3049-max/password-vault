# Manager Phase 108

## Phase Identifier
PHASE=108

## Status
STATUS: READY_FOR_DEVELOPER

## Architecture Amendments (2026-07-12)

**Amendment 1 (day) — Consumer false-positive gate (M9):** D-108-14…17; AC-108-18…20. Prefer `NULL` over wrong URL; Zap-class portals rejected; Phase 112 deferral metadata.

**Amendment 2 (evening) — True-positive preservation (M10):** D-108-14…16 revised; D-108-18; AC-108-21; ACCEPT fixtures. Reject only with positive evidence.

**Amendment 3 (night) — M10 live failure / process correction (M11):** Architect **REJECTED** M10 “COMPLETE”. Operator live add (admin + custom) still leaves `login_url=NULL` on sites that worked before Zap/M9. Developer marked M10 COMPLETE on static fixtures while **U22 remains PENDING_OPERATOR**. Static JSDOM fixtures ≠ live extension discovery path. Adds **D-108-19**, **D-108-20**, milestone **M11**.

**Phase completion gate:** **M10 is insufficient for phase approval.** Static ACCEPT/REJECT fixture PASS alone does **not** satisfy AC-108-21. **Do not accept “fixed” without live U22 Pass** (Shufersal, Clalit, HTZone non-NULL `login_url`) **while Zap stays NULL (U19).** Phase 108 complete approval requires **M11** live dual gate + per-site evidence + observability (D-108-20).

## Phase Goal
Deliver **Browser Integration and Login Discovery**: Chrome and Edge extension support via a **browser integration abstraction**, production packaging strategy, graceful Hub degradation without extension — and a **unified login-entry discovery pipeline** that enriches `service_registry` with a **confident consumer** `loginUrl` (or safely leaves it `NULL` with Phase 112 deferral metadata) on custom-service add and admin refresh — **without** autofill, credentials, form submit, or execution-path changes (AC-108-10, discovery boundary).

Phase 108 owns **browser host integration**, **DiscoveryExecutor** behavior, **loginUrl metadata persistence rules**, **evidence-based false-positive rejection**, **true-positive preservation**, **live-path authority**, **discovery outcome observability**, **discovery deferral signals**, and **bulk refresh orchestration**. It does not own admin console chrome (107 UI), standard autofill coverage (110), **authoritative** complex login classification / modal interaction (112), full URL canonicalization (113), or credential lifecycle (109).

## Source References
- `team-Yuri/arch-phase108.md` (**STATUS: REJECTED_PENDING_M11** — night amendment 2026-07-12)
- `team-Yuri/PLAN.md` §13 / §18 — AC-108-1 … AC-108-21
- `team-Yuri/PHASE.md` — `PHASE=108`
- `team-Yuri/dev-phase108.md` — M10 claimed COMPLETE on static fixtures; **U22 PENDING_OPERATOR** — **rejected for phase approval**
- `scripts/verifyPhase108FalsePositiveGate.mjs` — necessary; **not sufficient** alone
- `scripts/verifyPhase103Execution.mjs` — execution regression

## Architecture Summary (Phase 108 constraints)
- Prior constraints M1–M10 remain in force (abstraction, single pipeline, dual-objective gate, Zap reject, selective modal, ACCEPT fixtures).
- **Live path is the authority (D-108-19):** Production discovery runs through the **extension** (`HUB_LOGIN_ENTRY_DISCOVERY` → bundled `login-entry-discovery.js`). Hub/JSDOM fixture passes are **not** proof of live behavior.
- **Operator-visible discovery outcome (D-108-20):** After every custom add / admin rediscovery, operator must see **why** `login_url` is NULL or set — at minimum: `loginUrlDiscoveryOutcome`, `loginUrlDiscoveryError`/reason, `discoveryMethod`, `loginUrlConfidence`, `rejectedLoginUrl`, `phase112Deferred`, `loginIntelligenceHint`. Developer must capture **raw extension discovery payload** for failed live U22 rows before further gate tuning.
- **True-positive regression (D-108-18, AC-108-21):** After **live** rediscovery/add, Shufersal / Clalit / HTZone must keep non-NULL consumer `login_url`; Zap stays NULL. Static fixtures must not be used alone to claim COMPLETE.

### Normative consumer validation (M9–M11)
Same dual-objective ranking as M10: reject portal candidate with positive evidence; ACCEPT strong consumer navigable; modal-only → NULL only when no navigable consumer remains; do not blank-reject ordinary consumer `/login`.

### Extension rebuild + reload checklist (D-108-19 — **every Developer attempt**)

```text
1. npm run build  (and/or npm run build:extension-discovery as documented)
2. Reload the side-loaded extension (chrome://extensions or edge://extensions → Reload)
3. Confirm extension version / bundle timestamp matches the change under test
4. Restart or hard-refresh Hub (npm run dev) with correct VITE_POC_EXTENSION_ID
5. Execute live U19 (Zap) + live U22 (Shufersal, Clalit, HTZone)
6. Record per-site raw extension payload + persisted metadata
```

Claiming M10/M11 done **without** this checklist + live U22 Pass is a **process failure**.

## Acceptance / Gating Criteria (verbatim — PLAN §18)

| ID | Criterion |
|---|---|
| AC-108-1 | Extension functions on current Chrome stable |
| AC-108-2 | Extension functions on current Edge stable |
| AC-108-3 | Browser integration abstraction layer isolates messaging and tab APIs |
| AC-108-4 | Packaging strategy documented for Chrome Web Store and Edge Add-ons |
| AC-108-5 | Hub degrades gracefully when extension is not installed |
| AC-108-6 | Adding a custom service attempts `loginUrl` discovery |
| AC-108-7 | `service_registry` stores `loginUrl` when discovery succeeds with **consumer** confidence |
| AC-108-8 | `service_registry` stores `primaryUrl` and a clear `loginUrl` status when discovery fails |
| AC-108-9 | Discovery failure does not prevent service creation |
| AC-108-10 | Discovery never uses credentials, never autofills, and never submits forms |
| AC-108-11 | Admin can manually edit `loginUrl` for a service |
| AC-108-12 | Admin can trigger rediscovery for a single service |
| AC-108-13 | Admin can trigger bulk `loginUrl` refresh |
| AC-108-14 | Bulk refresh is rate-limited and reports partial failures |
| AC-108-15 | Manual admin `loginUrl` overrides are not overwritten without explicit approval |
| AC-108-16 | Temporary discovery tabs, if used, close reliably and are never confused with user-opened execution tabs |
| AC-108-17 | Build passes |
| AC-108-18 | Discovery never persists a non-consumer / alternate-audience portal as `loginUrl` (including URLs whose path contains `login` but whose page is business/merchant/partner/admin). `login_url` remains `NULL`; `metadata` records `rejectedLoginUrl` and deferral reason for Phase 112 |
| AC-108-19 | When consumer login is modal/overlay on `primaryUrl` **and** there is no separate validated consumer navigable login URL, `login_url` remains `NULL` and `metadata` records `loginEntryType=modal` / `usesModal=true` / `phase112Deferred=true`. A homepage modal trigger must not veto a separate consumer navigable candidate |
| AC-108-20 | Reject with **positive evidence** of wrong audience or modal-only surface; document deferrals in `metadata`. Do not blank-reject ordinary same-origin consumer login pages solely because path contains `login` or a weak modal heuristic fired |
| AC-108-21 | True-positive regression: after false-positive gate changes, rediscovery of known consumer catalog services (at least Shufersal, Clalit, HTZone or current Phase 103 equivalents) must still persist a non-NULL consumer `login_url`, while Zap-class portals remain rejected |

## AC → Milestone → Verify / Live Mapping

| AC | Primary milestone(s) | Static verify | Live hard gate |
|---|---|---|---|
| AC-108-18 | M9, M10, **M11** | FalsePositiveGate REJECT | **U19** Zap NULL |
| AC-108-19 | M9, M10, **M11** | Modal-only REJECT; modal+navigable ACCEPT | U20 as applicable |
| AC-108-20 | M9, M10, **M11** | Positive-evidence gates | U19, U21 |
| AC-108-21 | M10 (fixtures), **M11 (authority)** | ACCEPT fixtures (necessary) | **U22** live non-NULL |
| AC-108-8 | M3, **M11** | Outcome metadata fields | Operator-visible after add (D-108-20) |
| Regression | M1, M8, M11 | `verifyPhase103Execution.mjs` | U18 |

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| M1–M8 | Browser integration … verify | As previously delivered | Static scripts + build | AC-108-1…17 |
| M9 | Consumer false-positive gate | Zap REJECT; modal-only NULL | Reject fixtures; Zap must stay green | AC-108-18…20 |
| M10 | True-positive preservation (static) | Dual gate; ACCEPT fixtures; no over-reject heuristics | Static ACCEPT+REJECT PASS | AC-108-21 (partial) |
| **M11** | **Live discovery restoration** | Fix **live extension path**; observability; per-site live evidence | **Live U22 Pass** + U19 Zap NULL + payloads | **AC-108-21** (hard) |

**M10 status for phase approval:** **INSUFFICIENT** — Architect REJECTED COMPLETE claim. Static fixtures PASS while live operator still sees `login_url=NULL` does not satisfy AC-108-21.

**M11:** **REQUIRED** hard gate before Phase 108 complete approval.

## Detailed Development Plan

### M1–M9
As previously delivered / claimed. Zap reject must stay green through M10/M11.

### M10 — True-positive preservation (static only — **not phase-complete**)

Static dual-gate work (ACCEPT + REJECT fixtures) remains valuable and must stay green. **Manager does not accept M10 as phase-complete** while U22 is PENDING_OPERATOR or live sites still NULL.

Do **not** claim “fixed” based on JSDOM/`discoverLoginEntry` Hub fixtures alone.

### M11 — Live discovery restoration (D-108-19, D-108-20) — **HARD GATE**

**Manager approval blocker for Phase 108 complete.**

#### Dual live gate (normative)

| Site | Expected after live admin rediscovery **and/or** custom add |
|---|---|
| **Shufersal** | `login_url` **non-NULL** consumer URL |
| **Clalit** | `login_url` **non-NULL** consumer URL |
| **HTZone** | `login_url` **non-NULL** consumer URL |
| **Zap** | `login_url` **NULL**; never `sa.zap.co.il/.../login` |

#### Per-site live evidence package (**required** for each of Shufersal, Clalit, HTZone, Zap)

Developer must attach in `dev-phase108.md`:

1. **Raw extension discovery payload** from `HUB_LOGIN_ENTRY_DISCOVERY` response, including at least:
   - `success` / ok
   - `loginUrl` (or null)
   - `method` / `discoveryMethod`
   - `confidence` / `loginUrlConfidence`
   - `reason` / error / rejection reason
2. **Persisted `service_registry` metadata** after the attempt:
   - `login_url`, `login_url_status`
   - `loginUrlDiscoveryOutcome`
   - `loginUrlDiscoveryError` (or reason)
   - `discoveryMethod`
   - `loginUrlConfidence`
   - `rejectedLoginUrl` (if any)
   - `phase112Deferred`, `loginIntelligenceHint` (if any)
3. Confirmation that **extension rebuild + reload checklist** was executed for that attempt.
4. Path used: admin rediscovery and/or custom add (both must not leave true positives NULL).

#### Likely live-only failure modes (investigate before more heuristic churn)

| # | Failure mode | Symptom |
|---:|---|---|
| a | Stale extension bundle not reloaded after `build:extension-discovery` | Fixtures PASS; live still old behavior |
| b | Live `method=common-path` / `confidence=low` → persist gate always refuses | Fixtures use dedicated-login-page; live common-path NULL |
| c | Live `success=false` (modal/audience) while consumer navigable URL exists on real page | Over-reject on live DOM |
| d | Persist/clear path wiping URL even when discovery returned a candidate | `clearLoginUrl` / review RPC over-clears |
| e | Extension unavailable / timeout | NULL with `extension_unavailable` / `discovery_timeout` |

#### Observability (D-108-20)

- Admin Integration Status (and/or equivalent) must show discovery outcome fields after every add/rediscover.
- Blind “fixed again” without raw payload + persisted metadata is **not acceptable**.
- If live U22 fails, capture payload **before** further gate tuning.

#### Acceptance for M11 done

| Gate | Required |
|---|---|
| Extension rebuild + reload checklist | Documented per attempt |
| Live U22 | **Pass** — Shufersal, Clalit, HTZone each non-NULL consumer `login_url` |
| Live U19 | **Pass** — Zap NULL; not business portal |
| Per-site evidence | Raw payload + persisted metadata for all four sites |
| Static fixtures | Still PASS (ACCEPT + REJECT) — necessary, not sufficient |
| `verifyPhase103Execution.mjs` | PASS |
| `npm run build` | PASS |

#### Out of M11 scope
- Phase 112 modal open/fill
- Claiming COMPLETE on static fixtures alone
- Hard-coded per-site allowlists as primary solution

## Regression Gate — Phase 103 Execution

| Script | When | Expected |
|---|---|---|
| `verifyPhase103Execution.mjs` | After M11 live-path changes | **PASS** |
| `verifyPhase108FalsePositiveGate.mjs` | M9–M11 | **PASS** (reject **and** accept) — not sufficient alone |

## Critical UAT Gate — Live Dual Gate (M11)

| # | Scenario | Expected | Gate |
|---:|---|---|---|
| **U19** | Live Zap rediscovery / add | `login_url` NULL; not `sa.zap.co.il/.../login` | Hard |
| **U22** | Live Shufersal + Clalit + HTZone rediscovery / add | Each **non-NULL** consumer `login_url` | Hard |
| U20–U21 | Modal / Mizrahi as applicable | Per AC-108-19/20 | Supporting |

**Do not approve Phase 108 complete without live U22 Pass + U19 Pass + per-site payloads.**

## Functional Test Matrix (M11 focus)

| # | Test | Expected | AC |
|---:|---|---|---|
| T24–T30 | Static REJECT + ACCEPT fixtures | PASS (necessary) | AC-108-18…21 |
| **T31** | **Live U22 Shufersal** | non-NULL `login_url` + payload evidence | AC-108-21 |
| **T32** | **Live U22 Clalit** | non-NULL `login_url` + payload evidence | AC-108-21 |
| **T33** | **Live U22 HTZone** | non-NULL `login_url` + payload evidence | AC-108-21 |
| **T34** | **Live U19 Zap** | NULL + reject metadata + payload | AC-108-18 |
| **T35** | **Observability (D-108-20)** | Outcome/method/reason visible after add | AC-108-8, AC-108-21 |
| T36 | Extension reload checklist | Documented for the attempt that produced T31–T34 | D-108-19 |

## Required Developer Evidence
`team-Yuri/dev-phase108.md` must include for **M11**:

| Evidence area | Required content |
|---|---|
| M10 claim disposition | Acknowledge M10 static-only COMPLETE is **insufficient**; M11 required |
| Extension rebuild + reload | Checklist executed; version/bundle noted |
| **Per-site live evidence** | Shufersal, Clalit, HTZone, Zap — raw extension payload + persisted metadata |
| Live U22 | **Pass** (non-NULL for three catalog sites) |
| Live U19 | **Pass** (Zap NULL) |
| Observability | D-108-20 fields visible / recorded |
| Failure-mode analysis | Which of (a)–(e) applied if any interim NULL |
| Static fixtures | Still PASS |
| Phase 103 regression | PASS |
| Build | PASS |
| Scope | No Phase 112 modal implementation |

## Out of Scope
- Phase 110 / 112 / 113 / 109 product work as previously listed
- Approving phase complete on JSDOM fixture PASS alone
- Blind heuristic churn without live payload evidence

## Risks / Open Questions
- **Stale extension bundle** is the highest process risk (D-108-19).
- Live `common-path` / low confidence may differ from fixture dedicated-login-page paths.
- Persist/clear RPC may over-clear good URLs — verify with payload vs DB.
- Operator reported NULL on **admin and custom** add — both paths must be restored.
- Live sites may change — document genuine site change with payload proof.

## Manager Review
MANAGER_REVIEW_STATUS: REJECTED

### Review Notes
- Architect night amendment 2026-07-12: **REJECTED_PENDING_M11**.
- **Reject Developer M10 COMPLETE claim** — static fixtures PASS + U22 PENDING_OPERATOR while live operator sees `login_url=NULL` contradicts AC-108-21 / D-108-19.
- Static JSDOM ≠ live extension path.
- **M10 insufficient for phase approval.** **M11** opened as hard gate.
- Phase 108 complete blocked until live U22 Pass (non-NULL) + Zap U19 NULL + per-site raw payloads + D-108-20 observability.

### Required Corrections
1. Do not claim fixed without **live U22 Pass**.
2. Capture raw extension discovery payload + persisted metadata per site (Shufersal, Clalit, HTZone, Zap).
3. Run extension rebuild + reload checklist every attempt.
4. Fix live extension path / persist gate / observability (D-108-19, D-108-20); keep Zap green.
5. Update `dev-phase108.md` with M11 evidence only when live dual gate passes.
