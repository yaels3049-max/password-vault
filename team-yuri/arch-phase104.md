# Architecture Phase 104

## Phase Identifier
PHASE=104

## Status
STATUS: READY_FOR_MANAGER

## Architecture Amendment (2026-07-07)
**Operator-driven UX refinement** after initial Phase 104 approval. Supersedes prior D-104-10 / AC-104-17 interpretation that exposed **פתיחה** (Open) on Service Management cards.

**Intent:** Strict separation of **service administration** (Service Management) from **service execution** (Digital Home). No change to credential storage, `AccessProfile` model, Digital Home execution pipeline, or profile CRUD capabilities — **presentation and entry-point simplification only**.

Prior `ARCHITECT_REVIEW_STATUS: APPROVED` was superseded by this amendment; final post-amendment review is recorded below.

## Phase Goal
Deliver **production-grade Service Management UX** (**ניהול שירותים**): a card-based, two-section **administration-only** surface where users view selected services, add catalog services, manage profiles and credentials, and add custom services — with **deterministic persistence** and **immediate Digital Home consistency**.

**Service execution** (open site + autofill) remains **Digital Home only** (Phase 103 `executeServiceFromTile` via tile click). Service Management must not invoke execution.

Phase 104 owns **management UX and selection orchestration** only. It does not own registry curation (Phase 107), Digital Home production polish (Phase 105), full icon lifecycle (Phase 111), or URL canonicalization (Phase 113).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=104`
- `team-Yuri/PLAN.md` §14 — Service Management (**ניהול שירותים**)
- `team-Yuri/PLAN.md` §18 — Phase 104 acceptance criteria (AC-104-1 … AC-104-23)
- `team-Yuri/arch-phase102.md` — APPROVED; registry-backed catalog metadata
- `team-Yuri/arch-phase103.md` — unified execution pipeline (`executeServiceFromTile`)
- `team-Yuri/dev-phase103.md` — COMPLETE; execution regression gate PASS
- `src/ManageServices.tsx` — current category-checkbox onboarding UI (to be replaced/evolved)
- `src/Dashboard.tsx` — Digital Home; derives `selectedServices` from `selectedIds`
- `src/App.tsx` — screen routing, `handleToggle`, `persistVault`, catalog load
- `src/supabase/persistence.ts` — `user_services` upsert on vault persist
- `src/vault/profileManagement.ts` — profiles and credentials CRUD
- `src/execution/serviceExecution.ts` — sole tile execution entry (Digital Home only; amended AC-104-17)
- `src/ServiceProfileManagementModal.tsx` — progressive-disclosure management modal (D-104-19)
- `src/useServiceLogos.ts` / `logoCache.ts` — interim icon presentation

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-104-1: Two-section layout** | AC-104-2, AC-104-3, AC-104-18 | Service Management screen has **השירותים שלי** (selected) and **הוספת שירותים** (add/catalog) as distinct sections with clear visual separation. (Section formerly titled **גילוי שירותים** — renamed in final UX.) |
| **D-104-2: Screen title** | AC-104-1 | Primary heading is exactly **ניהול שירותים** (not onboarding variants). First-run copy may appear as subtitle/helper text only. |
| **D-104-3: Registry read, selection write** | AC-104-11, PLAN §6 | Service Management **reads** `service_registry` for catalog/discovery metadata. It **never** mutates global registry identity (URLs, ids, built-in rows). User changes write **`user_services`** (+ vault blob) only. |
| **D-104-4: Persisted selection is authority for Digital Home** | AC-104-9, AC-104-15 | Digital Home reflects **`selectedIds` only after successful `persistVault`**. No optimistic add/remove that shows a tile before persistence succeeds. |
| **D-104-5: Idempotent selection operations** | AC-104-12, AC-104-13 | Add/remove uses stable `service_id` keys with in-flight guards (ref + disabled UI). Repeated clicks during pending operations are ignored. `user_services` upsert uses existing `onConflict: user_id, service_id`. |
| **D-104-6: Service card as primary UI unit** | AC-104-6, AC-104-18 | Both sections render **service cards** (not checkbox lists). **My Services:** transparent fixed grid row — `Icon \| Name \| Profiles \| Category \| Status chip \| Manage \| ⋮` (RTL). Profiles column only when count > 1. **הוספת שירותים:** add-only catalog cards — no status badges; add button or passive **✓ כבר בבית הדיגיטלי**; no remove in this section. |
| **D-104-7: Derived management state** | AC-104-8 | Card state is computed — not stored — from `selectedIds`, access profiles, and credential completeness: `not_added`, `added`, `missing_credentials`, `multiple_profiles`. |
| **D-104-8: Single custom-service entry point** | AC-104-4 | Exactly **one** global **+ הוסף אתר** action in **הוספת שירותים** toolbar. Remove per-category duplicate buttons. Dashboard **הוסף שירותים נוספים** navigates to Service Management (not a second add flow). |
| **D-104-9: Discovery search and filter** | AC-104-3, AC-104-5 | Client-side search over loaded registry catalog: match **display name** and **domain**. Toolbar search (~3 grid units) with icon-submit and clear-X reset; **+ הוסף אתר** (~1 unit); category filter chips below. Add results area stable min-height (≥2 desktop rows) to prevent footer jump. |
| **D-104-10: Selected-card actions (administration only)** | AC-104-7 | Selected rows: primary **ניהול** (opens modal per D-104-19); remove only via ⋮ menu (**🗑 הסר שירות**). **No פתיחה (Open)** — execution is Digital Home only. **הוספת שירותים** is add-only (no remove, no status badges). |
| **D-104-11: Remove is non-destructive to registry** | AC-104-16, AC-104-20 | Removing a service deletes **`user_services`** association and removes id from `selectedIds`. It does **not** delete global `service_registry` rows. Access profiles and encrypted credentials remain in vault (user may re-add later). |
| **D-104-12: Failure-visible, no phantom UI** | AC-104-14, AC-104-22 | Failed persist shows friendly Hebrew error. UI must roll back or never advance local selection on failure. No silent failures. |
| **D-104-13: Resilient discovery section** | AC-104-10 | When registry/catalog fetch fails, **My Services** remains usable from vault state. Discover section shows friendly error/empty state; selected services still manageable. |
| **D-104-14: Pending-operation safety** | AC-104-13, AC-104-23 | While add/remove/custom-add persist is in flight: disable relevant controls; block navigation side-effects that would leave inconsistent state; clear in-flight lock on success or failure. |
| **D-104-15: Icons interim** | Phase 111 dependency | Cards use existing logo resolution (`useServiceLogos`, favicon metadata). Full Supabase Storage icon pipeline is **out of scope** for Phase 104. |
| **D-104-16: Phase 113 integration boundary** | PLAN dependency note | Custom add continues current `createCustomServiceDefinition` + discovery flow. **Full URL canonicalization and duplicate registry prevention** deferred to Phase 113. Phase 104 may add **user-visible reuse messaging** only when existing logic already detects a match — no new canonicalization engine. |
| **D-104-17: Execution vs management separation (strict)** | PLAN §14, P5, amended AC-104-17 | **Digital Home** is the **sole user-facing execution surface** — tile click → `openServiceWithProfile` → `executeServiceFromTile`. **Service Management** is **administration-only**: selection, credential/profile management via **ניהול**, remove via ⋮ **הסר שירות**. Service Management must not import or call `executeServiceFromTile`, `openServiceWithProfile`, or any execution helper. Footer secondary CTA: **לבית הדיגיטלי**. |
| **D-104-18: First-run mode** | Existing product flow | `isFirstRun` remains a **layout/copy variant** of the same Service Management screen (simplified helper text, continue CTA). Same components and persistence rules apply. |
| **D-104-19: Progressive-disclosure management modal** | AC-104-7, UX simplification | **ניהול** opens `ServiceProfileManagementModal` with mode derived from profile count. **Single-profile service:** modal shows **credential editing directly** for the implicit default profile — profile chrome (rename, delete, set-default, profile list) **hidden**; default profile is internal, not surfaced as a named entity on the card. **Multi-profile service:** modal shows **full profile-aware management** — profile list, rename, delete, set-default, per-profile credential edit. Secondary actions **הוספת פרופיל נוסף** and **ניהול פרופילים** (profile-structure controls) appear **inside the modal only**, not on the card. Underlying `AccessProfile` model, vault credential storage, and CRUD callbacks unchanged. |

### Management state derivation (normative)

```text
if service.id ∉ selectedIds → not_added
else if profiles(service).length > 1 → multiple_profiles
else if !hasCompleteCredentials(defaultProfile) → missing_credentials
else → added
```

Badges are **informational** — they do not block administration actions. Execution and `credentials_missing` handling remain on Digital Home tiles only (Phase 103).

### AC-104-17 (amended interpretation)

**Original PLAN text:** Service Management Open must use the same execution entry as Digital Home.

**Phase 104 refinement:** AC-104-17 is **re-scoped**, not retired. Satisfied by **Digital Home-only execution**:

```text
Digital Home tile click → openServiceWithProfile → executeServiceFromTile   ← sole execution surface
Service Management      → no Open action; no executeServiceFromTile call   ← administration only
```

**Unified execution entry** means **one execution path in the product**, not **two surfaces that both execute**. Removing Open from Service Management **strengthens** separation; it does not create a parallel execution module. Regression gate R3/R4 (Open from Service Management) are **retired**; R1/R2 (Digital Home Shufersal/Clalit) remain mandatory.

### Selected-card layout (normative — My Services)

```text
Icon | Name | Profiles (>1 only) | Category | Status chip | ניהול | ⋮ → 🗑 הסר שירות
```

Transparent fixed CSS grid (`--sm-row-cols`). Profile count is display-only (`👥 N`). Status chip is informational. Remove must not compete with primary **ניהול**.

### Management modal modes (normative — D-104-19)

```text
profiles(service).length ≤ 1
  → modal: credential fields for default/sole profile + save
  → hidden: profile list, rename, delete, set-default, "ניהול פרופילים"
  → available inside modal: "הוספת פרופיל נוסף" (creates second profile → switches to multi mode on next open)

profiles(service).length > 1
  → modal: full profile list + rename + delete + set-default + per-profile credential edit
  → available inside modal: "הוספת פרופיל נוסף", "ניהול פרופילים" (profile-structure section)
```

### Selection persist flow (normative)

```text
User action (add / remove / custom add complete)
↓
Set pending + disable controls
↓
Update VaultState (selectedIds, customServices, profiles as needed)
↓
await persistVault(state)  → IndexedDB + user_services cloud sync
↓
on success: commit UI state, clear pending
on failure: show Hebrew error, revert selection delta, clear pending
↓
Digital Home re-renders from persisted selectedIds
```

## Constraints / Non-Negotiables
- Screen title **ניהול שירותים** (AC-104-1).
- **One** custom-service entry point globally (AC-104-4).
- Digital Home reflects **persisted** selection only (AC-104-15).
- **Digital Home only** invokes `executeServiceFromTile` (amended AC-104-17). Service Management **must not** expose Open or call execution helpers.
- Selected My Services rows: **ניהול** primary + remove via ⋮ only (D-104-10). No **פתיחה**, **ניהול פרופילים**, or **עריכת פרטי כניסה** on the row.
- No change to credential storage, `AccessProfile` model, vault encryption, or profile CRUD **capabilities** — UX entry-point simplification only (D-104-19).
- No regression to Phase 103 Digital Home execution, profile model, or vault encryption (AC-104-19).
- No modification of global `service_registry` identity from Service Management (AC-104-11, AC-104-20).
- No plaintext credentials in registry or logs (ADR-002).
- Hebrew, user-friendly error copy — no engine/POC terminology (PLAN §7 messages).
- Phase 100 `isDevBuild()` rules unchanged (practice category dev-only).

## Technical Boundaries / Out of Scope
- Digital Home production UX redesign (Phase 105): grouping, useful services, notifications.
- Admin platform / registry CRUD (Phase 107).
- Lifecycle health UX for stale `loginUrl` (Phase 109).
- Full icon asset pipeline and Storage (Phase 111).
- URL canonicalization, duplicate registry prevention, deep-link homepage resolution (Phase 113).
- Subscription / capability gating (Phase 150+).
- Auto-submit login forms.
- New execution adapters or autofill engine changes.
- Multi-device conflict resolution beyond “last successful persist wins” (document limitation if concurrent tabs).

## Dependencies and Interfaces

### Upstream (must be complete)

| Phase | Provides |
|-------|----------|
| 102 | Registry catalog load, custom service registry rows, discovery on custom add |
| 103 | `executeServiceFromTile`, profile resolution contract, autofill orchestration |

### Hub modules (Developer — target ownership)

| Module | Responsibility |
|--------|----------------|
| `src/ManageServices.tsx` (or `src/screens/ServiceManagement/`) | Two-section layout (**השירותים שלי** + **הוספת שירותים**), **ניהול**/⋮ remove, add toolbar, pending state; **no execution imports** |
| `src/components/ServiceCard.tsx` (new) | Grid row + compact catalog card; status chip; profile count when >1; `manageSlot` / `moreSlot` |
| `src/serviceManagement/serviceManagementState.ts` (new) | `deriveServiceManagementState()`, badge labels (Hebrew) |
| `src/serviceManagement/serviceSelection.ts` (new) | Idempotent add/remove/custom-add orchestration wrapping `persistVault` |
| `src/serviceManagement/discoveryFilter.ts` (new) | Search by name/domain + category filter |
| `src/App.tsx` | Passes catalog + vault state; handles navigation from Dashboard **הוסף שירותים נוספים** without duplicate custom-add modal |
| `src/Dashboard.tsx` | **Unchanged** execution path (`openServiceWithProfile` → `executeServiceFromTile`); receives updated `selectedServices` after persist |
| `src/execution/serviceExecution.ts` | **Read-only** — Digital Home execution entry only |
| `src/serviceManagement/openWithProfile.ts` | **Digital Home only** — remove usage from `ManageServices.tsx` |
| `src/ServiceProfileManagementModal.tsx` | Progressive-disclosure modes per D-104-19 (single-profile credential-direct vs multi-profile full) |
| `src/AddSiteModal.tsx` | Reused for single custom-add entry (AC-104-4) |

### Data interfaces

| Store | Role in Phase 104 |
|-------|-------------------|
| `VaultState.selectedIds` | Local authoritative selection list |
| `VaultState.customServices` | Custom definitions (transition; registry preferred on load) |
| `VaultState.accessProfiles` / `credentials` | Profile and credential management (unchanged) |
| `user_services` (Supabase) | Cloud selection mirror via `persistence.ts` |
| `service_registry` | Read-only catalog for Discover section |

### Custom add flow (unchanged contract)

1. User opens single **+ הוסף אתר** from **הוספת שירותים** toolbar.
2. `AddSiteModal` → `discoverLoginForCustomService` → `onAddCustom` in `App.tsx`.
3. Registry upsert + vault persist + add to `selectedIds`.
4. Same idempotent/pending rules as catalog add (D-104-5, D-104-14).

### Management action contract (replaces open-from-management)

**ניהול** on a selected-service row must:
1. Open `ServiceProfileManagementModal` for that `serviceId`.
2. Choose modal mode per D-104-19 from `profiles(service).length`.
3. Use existing vault callbacks (`onSaveCredential`, `onAddProfile`, etc.) — no new persistence layer.

**הסרה** (via ⋮ **🗑 הסר שירות**) follows D-104-11 (selection + `user_services` only).

Service Management must **not** call `executeServiceFromTile`, `openServiceWithProfile`, or `ProfileResolution` for execution purposes. `ProfileResolution` wrapper on Service Management screen is removed (was Open-only).

## Data / State Considerations
- **Remove service:** Remove id from `selectedIds`; `persistVault` removes `user_services` row. Profiles/credentials for that `serviceId` remain in vault until user deletes via profile UI (AC-104-16).
- **Re-add service:** Idempotent upsert restores `user_services`; existing profiles become visible again.
- **Catalog load failure:** `App.tsx` `catalogError` already surfaces; Service Management must not assume `allServices` is complete when error present (D-104-13).
- **Concurrent refresh:** If catalog reload runs while user toggles selection, apply **last successful persist wins**; do not duplicate cards (AC-104-21). Avoid merging stale `selectedIds` over newer vault state.
- **Sort order:** Preserve `sort_order` in `user_services` on upsert (existing `persistence.ts` behavior).

## Security / Privacy Considerations
- Service Management displays credential **status** only (missing/complete) — never plaintext secrets on cards.
- Custom add discovery uses existing extension/proxy paths (Phase 102) — no new third-party fetch surface.
- Removing a service from home does not delete encrypted credentials without explicit user action.
- Search/filter is client-side over already-fetched registry — no new server endpoints.

## Testing and Lint Expectations
- `npm run build` passes.
- `npx tsc -b` passes.
- `scripts/verifyPhase104ServiceManagement.mjs` — static checks: title, **השירותים שלי** + **הוספת שירותים**, single custom-add, **no execution in ManageServices**, selected actions **ניהול** + **הסר שירות** (menu), D-104-19 modal hook, Dashboard remains execution surface.
- Manual regression matrix (Manager publishes from Functional Testability).
- Re-run `scripts/verifyPhase103Execution.mjs` — Digital Home execution path unchanged.

## Functional Testability

- **Page/screen:** Service Management at dev URL (`http://localhost:5173/`) via Manage Services navigation
- **User-visible behavior:**
  - Title **ניהול שירותים** with **השירותים שלי** and **הוספת שירותים** sections
  - My Services: transparent grid — Icon | Name | Profiles | Category | Status | **ניהול** | ⋮
  - Remove only via ⋮ **🗑 הסר שירות**; **ניהול** primary
  - **ניהול** single-profile: credential edit directly in modal (no profile chrome)
  - **ניהול** multi-profile: full profile management inside modal
  - **הוספת שירותים:** add-only; search + **+ הוסף אתר** toolbar; already-added → **✓ כבר בבית הדיגיטלי**; no status badges/remove
  - Footer secondary: **לבית הדיגיטלי**
  - **No Open on Service Management** — Digital Home R1/R2 only
  - Failed persist shows Hebrew error; no phantom tile on Digital Home
  - Catalog fetch error: My Services still works; Add section shows friendly error
- **Command-line:** `node scripts/verifyPhase104ServiceManagement.mjs`
- **Minimal end-to-end flow:**
  1. Unlock vault; open **ניהול שירותים**
  2. Add Shufersal from **הוספת שירותים** → My Services + Digital Home after persist
  3. Tap **ניהול** → credentials (single-profile) → status chip updates
  4. Footer **לבית הדיגיטלי** → tile click → autofill (R1)
  5. ⋮ → **הסר שירות** → gone from Digital Home; registry row unchanged
  6. Double-click add rapidly → no duplicate tiles
- **Expected:** AC-104-1 … AC-104-23 under amended AC-104-17; Phase 103 Digital Home regression intact (R1/R2)

## Handoff Notes for Manager

1. **Amendment scope:** Update `manager-phase104.md` for refinement — M5 card actions, AC-104-17 interpretation, regression gate (R1/R2 only; retire R3/R4), functional matrix T15/T16, verification script assertions.
2. **Milestone order (M5 revised):** Card actions — **ניהול** (modal per D-104-19) + **הסרה**; remove Open and card-level profile/credential buttons; remove `openServiceWithProfile` from `ManageServices.tsx`.
3. **Publish AC-104-1…23** with **amended AC-104-17** mapping documented above.
4. **Regression gate:** Phase 103 Shufersal/Clalit open+fill from **Digital Home only** (R1/R2). **Retire R3/R4** (Service Management Open no longer exists).
5. **Modal progressive disclosure:** Manager must specify acceptance signals for single-profile vs multi-profile modal modes (D-104-19).
6. **Explicitly defer** Phase 111 icons and Phase 113 canonicalization — document as follow-on, not blockers.
7. **First-run:** Preserve `isFirstRun` behavior; do not create a separate onboarding route.
8. **Developer evidence:** Updated `dev-phase104.md` after re-implementation; build PASS, script PASS, manual checklist.
9. **Do not** modify `executeServiceFromTile` orchestration or Digital Home execution path.
10. **Constraints unchanged:** No credential storage, `AccessProfile` model, or profile CRUD behavior changes — UX only.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- **Phase alignment:** `PHASE=104`; amendment (2026-07-07) + final UX polish (2026-07-08) implemented. Operator attested post-amendment approval with evidence PASS (`npm run build`, `verifyPhase104ServiceManagement.mjs`, `verifyPhase103Execution.mjs`).
- **D-104-17 / amended AC-104-17:** `ManageServices.tsx` has **no** `openServiceWithProfile`, `executeServiceFromTile`, or **פתיחה**. Digital Home (`Dashboard` → `openServiceWithProfile` → `executeServiceFromTile`) remains sole execution surface. R3/R4 correctly retired.
- **D-104-10:** My Services — primary **ניהול**; remove only via ⋮ **🗑 הסר שירות**. No card-level **ניהול פרופילים** / **עריכת פרטי כניסה**. Statically enforced in verify script.
- **D-104-6 (as-built):** Transparent fixed grid `Icon | Name | Profiles | Category | Status chip | Manage | ⋮` — presentation refinement within administration-only contract; does not add execution.
- **D-104-1 / D-104-8 / D-104-9 (as-built):** Lower section **הוספת שירותים** (add-only): no remove, no status badges; already-added **✓ כבר בבית הדיגיטלי**; toolbar search + **+ הוסף אתר**; stable results min-height; footer **לבית הדיגיטלי**. Acceptable UX presentation polish within Phase 104 management scope (not Phase 105 Digital Home redesign).
- **D-104-19:** `ServiceProfileManagementModal` — `isMultiProfile` progressive disclosure; single-profile credential-direct; multi-profile full chrome; **הוספת פרופיל נוסף** inside modal. AccessProfile/credential storage unchanged.
- **D-104-4 / D-104-5 / D-104-14:** Persist-first selection, locks, pending guards preserved from pre-amendment baseline.
- **Constraints:** No Phase 103 orchestration change; no new adapters; no credential plaintext on cards; UX-only relative to vault/profile models.
- **Verification:** Build PASS; Phase 104 + 103 static scripts PASS (operator + Developer evidence). Unit tests/lint NOT AVAILABLE — acceptable.
- **Artifact hygiene (non-blocking):** `manager-phase104.md` may still show `MANAGER_REVIEW_STATUS: NOT_REVIEWED` / `dev-phase104.md` `IN_PROGRESS` headers from mid-amendment — Operator confirmed approval for this review. Recommend Ben/Sarah sync final status fields for archival consistency.

### Required Corrections
_None._
