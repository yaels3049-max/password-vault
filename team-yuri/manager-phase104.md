# Manager Phase 104

## Phase Identifier
PHASE=104

## Status
STATUS: READY_FOR_DEVELOPER

## Architecture Amendment (2026-07-07)
**Operator-driven UX refinement** per `team-Yuri/arch-phase104.md` — strict **administration vs execution separation**. Supersedes prior Manager approval and D-104-10 / AC-104-17 interpretation that exposed **פתיחה** on Service Management cards.

**Intent:** Service Management is **administration-only** (selection, **ניהול**, **הסרה**). **Digital Home** is the **sole execution surface** (tile → `openServiceWithProfile` → `executeServiceFromTile`). No change to credential storage, `AccessProfile` model, or profile CRUD capabilities — **presentation and entry-point simplification only** (D-104-19).

## Phase Goal
Deliver **production-grade Service Management UX** (**ניהול שירותים**): a card-based, two-section **administration-only** surface where users view selected services, discover catalog services, manage profiles and credentials via **ניהול**, and add custom services — with **deterministic persistence**, **immediate Digital Home consistency**, and **regression protection** for Phase 103 Digital Home execution.

**Service execution** (open site + autofill) remains **Digital Home only**.

Phase 104 owns **management UX and selection orchestration** only. It does not own registry curation (Phase 107), Digital Home production polish (Phase 105), full icon lifecycle (Phase 111), or URL canonicalization (Phase 113).

## Source References
- `team-Yuri/arch-phase104.md` (including Architecture Amendment 2026-07-07)
- `team-Yuri/PLAN.md` §14 — Service Management (**ניהול שירותים**)
- `team-Yuri/PLAN.md` §18 — Phase 104 acceptance criteria (AC-104-1 … AC-104-23)
- `team-Yuri/PHASE.md` — `PHASE=104`
- `team-Yuri/arch-phase102.md` — APPROVED; registry-backed catalog metadata
- `team-Yuri/arch-phase103.md` — unified execution pipeline (`executeServiceFromTile`)
- `team-Yuri/dev-phase103.md` — Phase 103 execution regression gate baseline

## Architecture Summary (Phase 104 constraints)
- **Two sections:** **השירותים שלי** (selected) + **גילוי שירותים** (discover) with clear visual separation (AC-104-2, AC-104-3, AC-104-18).
- **Screen title:** exactly **ניהול שירותים** (AC-104-1).
- **Registry read, selection write:** Service Management reads `service_registry`; writes `user_services` + vault only — never mutates global registry identity (AC-104-11, AC-104-20).
- **Persisted selection authority:** Digital Home reflects `selectedIds` only after successful `persistVault` — no optimistic phantom tiles (AC-104-9, AC-104-14, AC-104-15).
- **Service cards:** Discover cards — icon, name, category, badge, add/remove. **Selected (My Services)** — **compact row**: small icon, name, badge, profile count when >1, **ניהול** + **הסרה** only (D-104-6, D-104-10).
- **Single custom-add entry:** one global **הוסף שירות מותאם** in Discover; Dashboard **הוסף שירותים נוספים** navigates here (AC-104-4).
- **Execution vs administration (D-104-17):** Digital Home **only** invokes execution. Service Management **must not** import or call `executeServiceFromTile`, `openServiceWithProfile`, or any execution helper.
- **ניהול modal (D-104-19):** single-profile → credential edit directly (profile chrome hidden); multi-profile → full profile management inside modal.
- **Idempotent + pending guards:** no duplicate tiles/rows on rapid clicks; controls disabled during persist (AC-104-12, AC-104-13, AC-104-23).
- Phase 100 `isDevBuild()` unchanged — practice category dev-only.

## Acceptance / Gating Criteria
- AC-104-1: Screen titled **ניהול שירותים**
- AC-104-2: **Selected services** section shows what appears on Digital Home
- AC-104-3: **Discovery/search** section for finding catalog services
- AC-104-4: Exactly **one** “add custom service” entry point globally
- AC-104-5: Category filtering available in discovery
- AC-104-6: Service cards used for browse and select (modern card UX)
- AC-104-7: Profile and credential management reachable from selected service context
- AC-104-8: Every service card displays its current management state
- AC-104-9: Changes made in Service Management are immediately reflected in Digital Home
- AC-104-10: Service Management remains usable when discovery/search is temporarily unavailable: existing selected services can still be viewed and managed, while unavailable discovery/search actions show a friendly error or empty state
- AC-104-11: Service Management uses Service Registry as metadata source but never modifies registry identity directly
- AC-104-12: Add/remove service operations are idempotent. Repeated clicks or repeated submit events must not create duplicate `user_services` rows or duplicate Digital Home tiles
- AC-104-13: While a service add/remove/update operation is pending, relevant action controls are disabled or ignored to prevent duplicate writes
- AC-104-14: If persistence fails, Service Management must show a friendly error and must not leave a phantom service card or Digital Home tile
- AC-104-15: Digital Home must reflect only persisted selected services, not optimistic local-only state that failed to sync
- AC-104-16: Removing a service updates Service Management and Digital Home consistently without orphaning Access Profiles or encrypted credentials
- AC-104-17: **(Amended interpretation — see below)** Unified execution entry — **Digital Home only**; Service Management administration-only
- AC-104-18: Production-ready baseline UX — My Services / Discover separation, consistent cards, status badges, loading/empty/error/offline states, responsive layout
- AC-104-19: No regression to profile or credential management (Access Profiles, default profile, encrypted credentials, associations preserved)
- AC-104-20: Removing a service affects only user association — never deletes or modifies global `service_registry` entry
- AC-104-21: Resilient during concurrent updates — no duplicate cards, lost selection, or overwrite of newer persisted data
- AC-104-22: Every user-visible operation produces deterministic outcome — success, validation, or friendly error; no silent failures
- AC-104-23: Navigation away during pending operation must not leave partial UI or inconsistent persisted data

### AC-104-17 (amended interpretation — acceptance / gating)

**Original PLAN text:** Opening a service from Service Management must use the same execution entry as Digital Home.

**Phase 104 refinement (2026-07-07):** AC-104-17 is **re-scoped**, not retired. Satisfied by **Digital Home-only execution**:

```text
Digital Home tile click → openServiceWithProfile → executeServiceFromTile   ← sole execution surface
Service Management      → no Open action; no executeServiceFromTile call   ← administration only
```

**Unified execution entry** means **one execution path in the product**, not **two surfaces that both execute**. Removing **פתיחה** from Service Management **strengthens** PLAN §14 execution vs management separation; it does not create a parallel execution module.

**Gating signals:**
- `ManageServices.tsx` has **no** `פתיחה`, **no** `openServiceWithProfile`, **no** `executeServiceFromTile` imports or calls.
- Selected cards expose **ניהול** + **הסרה** only (D-104-10).
- Digital Home tile execution unchanged (Phase 103 regression R1/R2).

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1 | ServiceCard + state derivation | `ServiceCard` with compact selected-row variant; `deriveServiceManagementState()` + Hebrew badges | Badges + profile count when >1 on selected rows |
| M2 | Two-section layout + title | **השירותים שלי** + **גילוי שירותים**; title **ניהול שירותים**; `isFirstRun` copy variant | AC-104-1, AC-104-2, AC-104-3, AC-104-18 |
| M3 | Discovery search + category filter | Client-side search by display name and domain; category chips in Discover | AC-104-3, AC-104-5 |
| M4 | Idempotent selection + pending UX | `serviceSelection.ts` wrapping `persistVault`; in-flight guards | AC-104-12 … AC-104-15, AC-104-23 |
| M5 | Card actions — administration only | Selected cards: **ניהול** (D-104-19 modal) + **הסרה** only; **remove Open** and card-level profile/credential buttons; **no execution** in Service Management | AC-104-7, amended AC-104-17 |
| M6 | Single custom-add consolidation | One **הוסף שירות מותאם** in Discover; Dashboard navigates here | AC-104-4 |
| M7 | Error / offline / empty states | Catalog failure: My Services usable; Discover error; persist failure Hebrew message | AC-104-10, AC-104-18, AC-104-22 |
| M8 | Verification + regression gate | Updated `verifyPhase104ServiceManagement.mjs`; `verifyPhase103Execution.mjs`; `docs/MIGRATION_PHASE_104.md` | Script PASS; R1/R2 Digital Home UAT |

## Detailed Development Plan

### M1 — ServiceCard + state derivation
Create:
- `src/components/ServiceCard.tsx` — **Discover** variant (icon, name, category, badge, actions); **Selected** compact row (small icon, name, badge, profile count when `profiles > 1`, action slot)
- `src/serviceManagement/serviceManagementState.ts` — `deriveServiceManagementState()` per D-104-7

Badges are **informational** — they do not block administration. Execution and `credentials_missing` handling remain on Digital Home tiles only (Phase 103).

### M2 — Two-section layout + title
| Section | Hebrew heading | Content |
|---|---|---|
| Selected | **השירותים שלי** | Compact selected-service rows (D-104-6) |
| Discover | **גילוי שירותים** | Searchable/filterable catalog cards |

Primary title: **ניהול שירותים**. First-run: same screen, helper copy + continue CTA (D-104-18).

### M3 — Discovery search + category filter
`src/serviceManagement/discoveryFilter.ts` — name + domain search; category chips (banking, health, shopping; practice dev-only).

### M4 — Idempotent selection + pending UX
Persist-first flow unchanged (D-104-4, D-104-5, D-104-14). See prior plan for normative persist sequence.

### M5 — Card actions — administration only (revised)
**Selected-service cards (D-104-10)** — exactly two actions:

| Action | Behavior |
|---|---|
| **ניהול** | Opens `ServiceProfileManagementModal` per D-104-19 (replaces separate **ניהול פרופילים** + **עריכת פרטי כניסה** on card) |
| **הסרה** | Remove from `selectedIds`; persist; non-destructive to registry (AC-104-16, AC-104-20) |

**Forbidden on selected cards:**
- **פתיחה** (Open)
- Card-level **ניהול פרופילים** / **עריכת פרטי כניסה** buttons

**Forbidden in `ManageServices.tsx`:**
- Imports or calls to `executeServiceFromTile`, `openServiceWithProfile`, or execution helpers
- Remove `openServiceWithProfile` usage from `ManageServices.tsx` (keep on `Dashboard.tsx` only)

**D-104-19 — Progressive-disclosure modal modes:**

```text
profiles(service).length ≤ 1
  → modal: credential fields for default/sole profile + save
  → hidden: profile list, rename, delete, set-default
  → inside modal: "הוספת פרופיל נוסף" (creates second profile → multi mode on next open)

profiles(service).length > 1
  → modal: full profile list + rename + delete + set-default + per-profile credential edit
  → inside modal: "הוספת פרופיל נוסף", "ניהול פרופילים"
```

Underlying `AccessProfile` model and vault callbacks **unchanged** — UX entry-point simplification only.

Discover-section cards: add/remove only (no management modal from Discover).

**Do not** modify `executeServiceFromTile` orchestration or Digital Home execution path.

### M6 — Single custom-add consolidation
Unchanged from prior plan — one **הוסף שירות מותאם**; remove per-category duplicates.

### M7 — Error / offline / empty states
Unchanged from prior plan.

### M8 — Verification + Phase 103 regression gate

**Static verification:** `scripts/verifyPhase104ServiceManagement.mjs` must prove:
- Screen title **ניהול שירותים**
- Sections **השירותים שלי** + **גילוי שירותים**
- Single custom-add entry point
- `deriveServiceManagementState` exists
- **`ManageServices.tsx` has no execution** — no `executeServiceFromTile`, `openServiceWithProfile`, or `פתיחה`
- Selected-card actions: **ניהול** + **הסרה** only (no **פתיחה**, no card-level **ניהול פרופילים** / **עריכת פרטי כניסה**)
- Idempotent/pending guard patterns present
- No direct global `service_registry` mutation from Service Management UI
- Progressive-disclosure modal mode hook if statically assertable (D-104-19)

Re-run `node scripts/verifyPhase103Execution.mjs` — must **PASS** (Digital Home execution unchanged).

**Execution regression (Manager approval blocker):**

| # | Surface | Service | Expected |
|---:|---|---|---|
| R1 | Digital Home tile | Shufersal | Opens `loginUrl`; generic autofill; tab stays open |
| R2 | Digital Home tile | Clalit | Opens `loginUrl`; 3-field autofill; tab stays open |

**Retired:** R3/R4 (Service Management Open no longer exists per amendment).

R1/R2 are **regression gate** — Manager rejects if either fails.

**Documentation:** Update `docs/MIGRATION_PHASE_104.md` for amendment (administration-only Service Management, R1/R2 only).

## Functional Test Matrix

**Prerequisites:** vault unlocked; extension installed; Phase 102/103 complete; `npm run dev`.

| # | Test | Steps | Expected | AC |
|---:|---|---|---|---|
| T1 | Screen title | Open Service Management | Heading **ניהול שירותים** | AC-104-1 |
| T2 | Two sections | View layout | **השירותים שלי** + **גילוי שירותים** clearly separated | AC-104-2, AC-104-3, AC-104-18 |
| T3 | Add from Discover | Add Shufersal | Appears in My Services; after persist, on Digital Home | AC-104-2, AC-104-9 |
| T4 | State badge — missing creds | Add service without credentials | Badge **missing_credentials** | AC-104-8 |
| T5 | State badge — added | Save credentials via **ניהול** | Badge **added** | AC-104-8, AC-104-7 |
| T6 | Search by name | Type service display name in Discover | Matching cards shown | AC-104-3 |
| T7 | Search by domain | Type domain fragment | Matching cards shown | AC-104-3 |
| T8 | Category filter | Select banking category | Only banking services in Discover | AC-104-5 |
| T9 | Single custom add | Inspect UI globally | One **הוסף שירות מותאם** only | AC-104-4 |
| T10 | Custom add flow | Add custom URL | Registry row + vault persist + selected | AC-104-4, AC-104-12 |
| T11 | Remove service | **הסרה** from My Services | Gone from Digital Home; profiles/creds remain | AC-104-16, AC-104-20 |
| T12 | Idempotent add | Double-click add rapidly | Single tile; single `user_services` row | AC-104-12, AC-104-13 |
| T13 | Persist failure | Simulate failed `persistVault` | Hebrew error; no phantom Digital Home tile | AC-104-14, AC-104-15, AC-104-22 |
| T14 | Catalog fetch error | Simulate registry load failure | My Services usable; Discover friendly error | AC-104-10 |
| T15 | **ניהול** modal modes | Single-profile: **ניהול** → credential fields direct; add second profile → multi mode on reopen | Single: no profile chrome; multi: full profile list + CRUD | AC-104-7, D-104-19 |
| T16 | Digital Home regression | Tile click Shufersal + Clalit with credentials | Open + autofill; tab stays open (R1/R2) | Amended AC-104-17, AC-104-19 |
| T17 | No Open on Management | Inspect selected cards | **No פתיחה**; **ניהול** + **הסרה** only | D-104-10, amended AC-104-17 |
| T18 | Multiple profiles badge | Service with 2+ profiles | Badge **multiple_profiles**; profile count on row | AC-104-8 |
| T19 | Pending navigation | Start add; navigate away | No inconsistent persisted state | AC-104-23 |
| T20 | Registry integrity | Remove built-in service | Global `service_registry` row unchanged | AC-104-11, AC-104-20 |

**Regression gate rows:** R1/R2 (T16).

## Required Developer Evidence
`team-Yuri/dev-phase104.md` must include (post-amendment re-implementation):

| Evidence area | Required content |
|---|---|
| Files changed | Full list — highlight removal of Open/execution from `ManageServices.tsx` |
| M1–M7 milestones | Completion table; M5 reflects **ניהול**/**הסרה** only + D-104-19 modal modes |
| M8 verification | `verifyPhase104ServiceManagement.mjs` output (**PASS**) — includes no-execution assertions |
| Phase 103 static | `verifyPhase103Execution.mjs` output (**PASS**) |
| **Regression gate R1–R2** | Manual UAT: Shufersal + Clalit open+fill from **Digital Home only** |
| Functional matrix | Manual results for T1–T20 (T15 modal modes; T16/T17 administration/execution separation) |
| Persist failure test | Evidence for T13 |
| Documentation | Updated `docs/MIGRATION_PHASE_104.md` (amendment, R1/R2 only) |
| Build | `npm run build` output (**PASS**) |
| Tests / lint | Result or NOT AVAILABLE with reason |

## Out of Scope (must not be implemented)
- Digital Home production UX redesign (Phase 105)
- Admin platform / registry CRUD (Phase 107)
- Lifecycle health UX for stale `loginUrl` (Phase 109)
- Full icon asset pipeline / Supabase Storage (Phase 111)
- URL canonicalization, duplicate registry prevention (Phase 113)
- Subscription / capability gating (Phase 150+)
- **Open / execution from Service Management** (retired by amendment)
- Changes to `executeServiceFromTile` orchestration or Digital Home execution path
- Changes to credential storage, `AccessProfile` model, or vault encryption (UX only)
- New execution adapters or autofill engine changes
- Auto-submit login forms
- Multi-device conflict resolution beyond last-successful-persist-wins

## Risks / Open Questions
- **Phase 103 regression:** Digital Home R1/R2 mandatory; execution must not regress when removing Open from Service Management.
- **Modal progressive disclosure:** Single-profile users must not see confusing profile chrome (D-104-19).
- **Prior implementation:** Code may still have `openServiceWithProfile` on `ManageServices` — Developer must remove per M5.
- **Optimistic UI:** Digital Home must not update until `persistVault` succeeds.
- **Phase 111 / 113:** Interim favicon/logo acceptable; deferred.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
_Prior APPROVED (2026-07-07) **superseded** by Architecture Amendment — administration/execution separation. Awaiting Developer re-implementation and updated `dev-phase104.md` per amended plan._

### Required Corrections
_Pending Developer cycle per amended M5, AC-104-17, regression gate (R1/R2 only), and verification script._
