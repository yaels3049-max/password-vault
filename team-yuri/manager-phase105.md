# Manager Phase 105

## Phase Identifier
PHASE=105

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Deliver **production Digital Home UX** (**הבית הדיגיטלי**) as the user’s daily **execution surface**: category-grouped service tiles, calm execution-oriented presentation, Useful Services and Notifications foundations, friendly empty/loading/offline states — while **preserving Phase 103 unified execution** and **strict separation from Service Management** (Phase 104).

Phase 105 owns **Digital Home presentation and UX orchestration** only. It does not own service selection/administration (104), registry curation (107), security/trust UX (106), full icon pipeline (111), or URL canonicalization (113).

## Source References
- `team-Yuri/arch-phase105.md`
- `team-Yuri/PLAN.md` §14 — Digital Home vs Service Management
- `team-Yuri/PLAN.md` §18 — Phase 105 acceptance criteria (AC-105-1 … AC-105-20)
- `team-Yuri/PHASE.md` — `PHASE=105`
- `team-Yuri/arch-phase103.md` — `executeServiceFromTile` unified pipeline (read-only this phase)
- `team-Yuri/arch-phase104.md` — administration-only Service Management; Digital Home sole execution surface
- `team-Yuri/dev-phase104.md` — Service Management final UX baseline

## Architecture Summary (Phase 105 constraints)
- **Screen title:** exactly **הבית הדיגיטלי** (AC-105-1); replace interim **המרכז הדיגיטלי שלי**.
- **Execution-only surface:** Digital Home consumes selection/metadata/credentials for open; **no** manage/remove/edit on tiles (AC-105-9, AC-105-16).
- **Single open path:** tile → `openServiceWithProfile` → `executeServiceFromTile` — **do not change** orchestrator (AC-105-4, AC-105-17, AC-105-19).
- **One tile per selected service;** multi-identity via profile chooser only when needed (AC-105-3, AC-105-5, AC-105-6).
- **Category grouping;** hide empty categories; RTL-correct responsive layout (AC-105-2, AC-105-15).
- **Page structure:** Header → Useful Services → Notifications → Category sections (D-105-8).
- **Useful Services / Notifications:** area **must exist**; placeholder or minimal content OK — not ranking/engine completeness (AC-105-10, AC-105-11).
- **Open resilience:** missing credentials / autofill failure must not block open when URL available; no silent failures; no auto-close of execution tabs (AC-105-7, AC-105-8, AC-105-19).
- **Soft-defer Phase 111 / 113:** interim logos and existing open-URL rules OK (D-105-14).
- Phase 100 `isDevBuild()` gating unchanged for practice/POC.

## Acceptance / Gating Criteria
- AC-105-1: Screen titled **הבית הדיגיטלי**
- AC-105-2: Services are grouped by category; empty categories are hidden
- AC-105-3: Exactly one tile per selected service
- AC-105-4: Tile click uses the Phase 103 unified execution entry point
- AC-105-5: Profile chooser appears only when multiple profiles exist for the selected service
- AC-105-6: Single-profile services open without profile-management friction
- AC-105-7: Missing credentials do not prevent opening the service when a URL is available
- AC-105-8: Autofill failure does not prevent website opening and does not close the tab
- AC-105-9: No profile, credential, remove, or management controls appear on tiles
- AC-105-10: Useful Services area exists with placeholder or minimal data-driven content
- AC-105-11: Notifications area exists with placeholder or empty state
- AC-105-12: Empty state guides the user to Service Management when no services are selected
- AC-105-13: Loading state is stable and does not cause major layout jumps
- AC-105-14: Offline/error states are friendly and do not expose technical errors
- AC-105-15: Category and tile layout is responsive and RTL-correct
- AC-105-16: Digital Home does not mutate Service Registry, Access Profiles, credentials, or user_services except through approved execution telemetry/future signals
- AC-105-17: Shufersal and Clalit validated autofill behavior remains preserved
- AC-105-18: Custom and admin-managed services appear and execute identically to catalog services when selected
- AC-105-19: No Digital Home tile opens a temporary discovery tab or closes a user-visible execution tab automatically
- AC-105-20: Build passes

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| M1 | Title + header CTA + calm layout base | Rename to **הבית הדיגיטלי**; header with optional reassurance; CTA → Service Management; calmer hierarchy base | Title exact; header navigates to Management | AC-105-1, AC-105-15 |
| M2 | Category grouping + tile polish | Group selected services by category; hide empty categories; one tile per service; icon+name; no manage controls; responsive RTL | Empty categories absent; tiles execution-feeling | AC-105-2, AC-105-3, AC-105-9, AC-105-15 |
| M3 | Useful Services foundation | Area present with placeholder or minimal data-driven content (not permanent fake catalog) | Section visible; no hardcoded fake services | AC-105-10 |
| M4 | Notifications foundation | Area present with placeholder or friendly empty state | Section visible; no fake urgent alerts | AC-105-11 |
| M5 | Empty / loading / offline states | Empty selection → CTA to Management; stable loading shells; Hebrew friendly offline/error | No major layout jumps; no technical errors | AC-105-12, AC-105-13, AC-105-14 |
| M6 | Open-path status alignment | Align Dashboard status handling with Phase 103 results (`ok` / `open_only` / `credentials_missing`); open when URL available; no discovery-on-click | Missing-cred open + guidance observable | AC-105-4, AC-105-5, AC-105-6, AC-105-7, AC-105-8, AC-105-19 |
| M7 | Verification + regression + docs | `verifyPhase105DigitalHome.mjs`; re-run `verifyPhase103Execution.mjs`; `docs/MIGRATION_PHASE_105.md`; Digital Home Shufersal/Clalit UAT | Scripts PASS; R1/R2 PASS; build PASS | AC-105-17, AC-105-18, AC-105-20 |

## Detailed Development Plan

### M1 — Title + header CTA + calm layout base
- Primary heading exactly **הבית הדיגיטלי** (replace **המרכז הדיגיטלי שלי**).
- Header may include short security/reassurance subtitle (non-management jargon).
- Clear navigation to **ניהול שירותים** (existing `onAddMore` / manage navigation).
- Establish calmer layout base in `Dashboard.tsx` / `App.css` per D-105-8.

### M2 — Category grouping + tile polish
- Group selected services by category; **hide empty categories** (AC-105-2).
- **Category order:** use existing category enum / display order already used in Service Management (document choice in `dev-phase105.md`).
- Exactly **one tile** per selected service (AC-105-3).
- `Tile.tsx`: icon + name; optional **minimal** credentials-ready indicator only; **no** edit/remove/manage buttons (AC-105-9).
- Hover/focus interactive; interim logos via `useServiceLogos` (Phase 111 soft-deferred).
- Pass tile click into existing `openServiceWithProfile` only.

### M3 — Useful Services foundation
- Area **must exist** in page order after header (D-105-8).
- Placeholder or **minimal** data-driven content OK (e.g. recently used if already feasible without new schema).
- **Must not** permanently hardcode a fake catalog (AC-105-10).
- Full ranking algorithm **out of scope**.

### M4 — Notifications foundation
- Area **must exist** after Useful Services (D-105-8).
- Placeholder or friendly empty state OK (AC-105-11).
- No advanced notification engine; no fake urgent alerts.

### M5 — Empty / loading / offline states
| Scenario | Required behavior |
|---|---|
| No selected services | Friendly empty state + CTA to Service Management (AC-105-12) |
| Loading | Reserved shells / min-height — no major layout jumps when data arrives (AC-105-13) |
| Offline / catalog error | Hebrew friendly copy; no stack traces; prefer keeping viewable already-loaded tiles (AC-105-14) |

### M6 — Open-path status alignment (no orchestrator changes)
- Keep open contract: `Tile click → resolveProfile → openServiceWithProfile → executeServiceFromTile`.
- **Do not** modify `executeServiceFromTile` orchestration.
- Align Dashboard status messaging with Phase 103 results:
  - Missing credentials + URL available → still open / guide to Service Management (AC-105-7)
  - Autofill failure → site remains open; tab not closed (AC-105-8)
  - No silent no-ops (AC-105-14/22 spirit)
- Multi-profile → chooser only when needed (AC-105-5); single-profile → direct open (AC-105-6).
- **No** `discoverLogin` / discovery tab on tile click (AC-105-19).

### M7 — Verification + Digital Home regression gate

**Static verification:** `scripts/verifyPhase105DigitalHome.mjs` proving:
- Title string **הבית הדיגיטלי**
- Useful Services + Notifications section markers present
- No manage/remove/credential-edit controls on tiles / Dashboard tile UI
- Open path still `openServiceWithProfile` → `executeServiceFromTile`
- No discovery-on-click imports in Dashboard
- Empty-category hide pattern assertable where feasible

Re-run `node scripts/verifyPhase103Execution.mjs` — must **PASS** (orchestrator unchanged).

**Documentation:** `docs/MIGRATION_PHASE_105.md` — scope, verify commands, soft-defer 111/113, regression gate.

**Build:** `npm run build` must **PASS** (AC-105-20).

## Digital Home Regression Gate (Manager approval blocker)

Same spirit as Phase 104 R1/R2 — **Digital Home only** (Service Management Open remains retired).

| # | Surface | Service | Expected |
|---:|---|---|---|
| R1 | Digital Home tile | Shufersal | Opens `loginUrl`; generic autofill; tab stays open |
| R2 | Digital Home tile | Clalit | Opens `loginUrl`; 3-field autofill; tab stays open |

R1/R2 are **mandatory**. Manager rejects if either fails.

Also confirm:
- No temporary discovery tab on tile click (AC-105-19).
- Custom selected service (if available) appears and opens via same path (AC-105-18).

## Functional Test Matrix

**Prerequisites:** vault unlocked; extension installed; Phase 102–104 complete; `npm run dev`.

| # | Test | Steps | Expected | AC |
|---:|---|---|---|---|
| T1 | Screen title | Open Digital Home | Heading **הבית הדיגיטלי** | AC-105-1 |
| T2 | Category grouping | Select services in ≥2 categories | Grouped sections; empty categories hidden | AC-105-2 |
| T3 | One tile per service | Inspect selected set | Exactly one tile per selected service | AC-105-3 |
| T4 | Unified open path | Click any tile | Uses `openServiceWithProfile` → `executeServiceFromTile` | AC-105-4 |
| T5 | Multi-profile chooser | Open service with 2+ profiles | Chooser once, then open | AC-105-5 |
| T6 | Single-profile open | Open service with 1 profile | Opens without profile friction | AC-105-6 |
| T7 | Missing credentials | Service with URL, incomplete creds | Site opens when possible + Hebrew guidance to Management | AC-105-7 |
| T8 | Autofill failure resilience | Force / observe fill fail | Tab stays open; site not closed by Hub | AC-105-8 |
| T9 | No manage controls on tiles | Inspect tile UI | No remove / profile / credential edit controls | AC-105-9 |
| T10 | Useful Services area | Scroll page | Area exists (placeholder or minimal OK) | AC-105-10 |
| T11 | Notifications area | Scroll page | Area exists (placeholder/empty OK) | AC-105-11 |
| T12 | Empty selection | Remove all selected services | Empty state CTA → Service Management | AC-105-12 |
| T13 | Loading stability | Reload / catalog load | No major layout jump | AC-105-13 |
| T14 | Offline/error friendly | Simulate catalog/network error | Hebrew friendly copy; no technical dump | AC-105-14 |
| T15 | RTL / responsive | Narrow + desktop widths | RTL-correct category/tile layout | AC-105-15 |
| T16 | No mutation from Home | Attempt UI | No registry/profile/cred/`user_services` writes from Digital Home UI | AC-105-16 |
| T17 | Shufersal regression | Digital Home tile | Login open + autofill (R1) | AC-105-17 |
| T18 | Clalit regression | Digital Home tile | Login open + 3-field autofill (R2) | AC-105-17 |
| T19 | Origin independence | Custom selected service | Appears and executes like catalog | AC-105-18 |
| T20 | No discovery / no auto-close | Tile open | No temp discovery tab; execution tab not auto-closed | AC-105-19 |
| T21 | Build | `npm run build` | PASS | AC-105-20 |

**Regression gate rows:** R1/R2 (= T17/T18).

## Required Developer Evidence
`team-Yuri/dev-phase105.md` must include:

| Evidence area | Required content |
|---|---|
| Files changed | Full list with change summary |
| M1–M7 milestones | Completion table with notes |
| M7 verification | `node scripts/verifyPhase105DigitalHome.mjs` output (**PASS**) |
| Phase 103 static | `node scripts/verifyPhase103Execution.mjs` output (**PASS**) — orchestration unchanged |
| **Regression gate R1–R2** | Manual UAT: Shufersal + Clalit Digital Home open+fill (extension version, URL, fields, tab stayed open) |
| Functional matrix | Results for T1–T21 (or documented N/A with reason) |
| Documentation | `docs/MIGRATION_PHASE_105.md` (scope, soft-defer 111/113, verify commands) |
| Build | `npm run build` output (**PASS**) (AC-105-20) |
| Tests / lint | Result or NOT AVAILABLE with reason |
| Screenshots | Optional — title + Useful/Notifications + category sections |

## Soft-Deferred Dependencies
| Phase | Phase 105 stance |
|---|---|
| 111 — Icon pipeline | Soft-defer; interim `useServiceLogos` / favicon OK |
| 113 — URL canonicalization | Soft-defer; existing `loginUrl` / `primaryUrl` open rules OK |

Do **not** block Phase 105 on 111/113.

## Out of Scope (must not be implemented)
- Credential/profile CRUD or service remove from Digital Home
- Service Registry editing / admin actions
- New login discovery on tile click
- Advanced notification engine; full Useful Services ranking
- Changes to `executeServiceFromTile` orchestration
- New execution adapters
- Auto-submit login forms
- Full Phase 111 icon Storage pipeline / Phase 113 canonicalization engine
- Security/trust UX (Phase 106)

## Risks / Open Questions
- **Phase 103 regression:** R1/R2 mandatory after Dashboard rewrite — highest-risk surface.
- **Layout jump:** Useful/Notifications/category shells must reserve space during load (AC-105-13).
- **Useful Services content:** Prefer honest placeholder over inventing permanent fake services.
- **credentials_missing messaging:** Align UI with D-105-6 so open-when-URL-available is user-observable.
- Category enumeration order should match existing product order to avoid UX thrash.

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes
- **Re-review** after prior REJECTED (R1/R2 PENDING). Required corrections **addressed** in updated `dev-phase105.md`.
- Phase identifier aligned (`PHASE=105`); M1–M7 complete; files changed; docs present; functional matrix T1–T21 filled.
- **Independent re-verification:** `verifyPhase105DigitalHome.mjs` **PASS**; `verifyPhase103Execution.mjs` **PASS**; `npm run build` **PASS**.
- **Regression gate R1–R2 (operator live UAT, 2026-07-08):** Both **PASS** with required observation fields — extension 1.3.0, observed `loginUrl`s, autofill fields (Shufersal email/password; Clalit 3-field), tab stayed open. Operator confirmation «נבדק והכל תקין». T17/T18 PASS. Status COMPLETE. Prior blocking gap closed.
- AC-105-1 through AC-105-20 satisfied within phase scope (AC-105-17 via live UAT; AC-105-20 via build). Orchestrator unchanged as required.
- Unit tests/lint NOT AVAILABLE per project; acceptable.
- Soft-defer Phase 111/113 documented; no scope violation.

### Required Corrections
_None._
