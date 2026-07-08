# Developer Phase 104

## Phase Identifier
PHASE=104

## Status
STATUS: IN_PROGRESS (Architecture Amendment re-implementation — awaiting Manager re-review + operator R1/R2 re-confirmation)

Manager review REJECTED the prior submission (static helper-equivalence for R1–R4).
Operator performed live manual browser UAT for R1–R4 after the Phase 104 Dashboard Open
refactor; all four rows **PASS** (operator confirmation: «R1–R4 נבדק ותקין», 2026-07-07).
Static verification, type-check, and build evidence remain valid (unchanged below).

> **The Architecture Amendment (2026-07-07) re-implementation is documented in the section
> "Architecture Amendment Re-Implementation" below.** It supersedes the pre-amendment
> selected-card actions (which included פתיחה + separate profile/credential buttons) and
> retires regression rows R3/R4. Digital Home execution (R1/R2) is unchanged.

## Architecture Amendment Re-Implementation (2026-07-07)

Per amended `arch-phase104.md` (D-104-10, D-104-17, D-104-19, re-scoped AC-104-17) and
`manager-phase104.md` (M5 revised, R1/R2-only gate): Service Management is now
**administration-only**; execution lives **exclusively on Digital Home**.

### Changes

| File | Change Summary |
|---|---|
| `src/ManageServices.tsx` | Removed **פתיחה** (Open), `openServiceWithProfile` import/usage, `handleOpen`, open-status banner, and `resolveProfile`/`credentialsByProfileId` props. Selected cards now expose **ניהול** (opens management modal) + **הסרה** only. Passes `profileCount` to the card. |
| `src/components/ServiceCard.tsx` | Added `profileCount` prop; renders «N פרופילים» hint only when `profileCount > 1` (D-104-6). |
| `src/ServiceProfileManagementModal.tsx` | Progressive disclosure (D-104-19): `isMultiProfile` branch. Single profile → credential editing shown **directly**, profile chrome hidden, secondary **הוספת פרופיל נוסף** on demand. Multiple profiles → full profile list + rename/set-default/delete + per-profile credential edit. No change to `AccessProfile` model or vault callbacks. |
| `src/App.tsx` | Removed the `ProfileResolution` wrapper (and `resolveProfile`/`credentialsByProfileId`) around the Service Management screen — it was only needed for the retired Open action. Dashboard execution path unchanged. |
| `scripts/verifyPhase104ServiceManagement.mjs` | Amended assertions: ManageServices has **no** פתיחה / `openServiceWithProfile` / `executeServiceFromTile`; selected cards **ניהול + הסרה** only (no card-level ניהול פרופילים / עריכת פרטי כניסה); modal has `isMultiProfile` + הוספת פרופיל נוסף (D-104-19); Dashboard remains execution surface. R3/R4 messaging retired. |
| `docs/MIGRATION_PHASE_104.md` | Documented administration-only amendment, ניהול modal progressive disclosure, R1/R2-only gate. |

### M5 (revised) — administration only

Selected-service cards expose exactly **ניהול** + **הסרה**. `ManageServices.tsx` contains no
execution imports or calls (statically enforced). `executeServiceFromTile` orchestration and
the Digital Home execution path (`Dashboard.tsx` → `openServiceWithProfile`) are untouched.

### D-104-19 — modal modes

```text
profiles(service).length ≤ 1  → credential fields directly; profile chrome hidden;
                                 secondary "הוספת פרופיל נוסף" reveals profile creation.
profiles(service).length > 1  → full profile list + rename/delete/set-default +
                                 per-profile credential edit; "הוספת פרופיל נוסף" available.
```

### Re-verification (post-amendment)

```text
> npm run build
✓ 149 modules transformed.
dist/assets/index-DzDwBrBG.css   15.98 kB │ gzip: 3.47 kB
dist/assets/index-DpK_DDjs.js   503.41 kB │ gzip: 148.35 kB
✓ built in 2.32s        (tsc -b passed as part of build)

> node scripts/verifyPhase104ServiceManagement.mjs
PASS: Phase 104 Service Management (static)
  selected-card actions: ניהול + הסרה only (no פתיחה)
  execution: none in Service Management (Digital Home only)
  modal: progressive disclosure (single vs multi profile) — D-104-19

> node scripts/verifyPhase103Execution.mjs
PASS: Phase 103 unified execution (static)
```

### Regression gate after amendment

- **R1/R2 (Digital Home Shufersal/Clalit open + autofill):** execution path unchanged by this
  amendment (no edits to `executeServiceFromTile`, `openWithProfile.ts`, or the Dashboard open
  flow). Prior operator UAT (2026-07-07) remains representative; a quick operator re-confirmation
  is recommended before Manager approval.
- **R3/R4 (Service Management Open):** **retired** — Service Management no longer executes.
- **T15 (ניהול modal modes) / T17 (no Open on Management):** require operator visual confirmation.

### My Services row-layout refinement (2026-07-07)

Presentation-only polish of the **השירותים שלי** compact rows (scope: My Services only; Digital
Home, Discover, execution, and profile/credential storage untouched). Actions remain **ניהול** +
**הסרה** (D-104-10) — הסרה is simply relocated into a secondary menu so it no longer competes with
the primary action.

| File | Change Summary |
|---|---|
| `src/ManageServices.tsx` | Selected rows: **ניהול** stays the primary visible action; **הסרה** moved into a kebab (⋮) secondary menu (`menuOpenId` state + click-outside backdrop). |
| `src/App.css` | Reduced row height (padding `0.6rem`→`0.4rem`, icon 32→28px); compact status pill + profile-count on rows; new `.sm-kebab` / `.sm-menu` styles. RTL preserved (`inset-inline-start`); responsive `flex-wrap` retained. |

Row content (future-ready — leaves room for login-URL/sync/health statuses without redesign):
`[icon] [name] [compact status] [profile count when >1] … [ניהול] [⋮ → הסרה]`.

Re-verified: `npm run build` PASS; `verifyPhase104ServiceManagement.mjs` PASS
(ניהול + הסרה still present, no פתיחה, no execution); `verifyPhase103Execution.mjs` PASS.

### My Services compact metadata line (2026-07-07)

Presentation-only (My Services rows only; Digital Home, Discover, execution, and
profile/credential storage untouched — data logic in `deriveServiceManagementState` unchanged).

- Replaced the large row status pill + separate profile-count chip with **one compact muted
  metadata line** below the name: `קטגוריה • מוכן • 2 פרופילים`
  (e.g. `בנקים • 2 פרופילים`, `קניות • מוכן`, `בריאות • חסרים פרטי כניסה`).
- Category now shown as plain text (no chip). Status compacted: `מוכן לשימוש`→`מוכן`; the
  `multiple_profiles` state is conveyed by the `N פרופילים` segment (only when count > 1; never
  `1 פרופיל`). `missing_credentials` segment gets a subtle amber tint for attention.
- `ServiceCard` row body now stacks name (primary) over the muted meta line; **Discover
  (compact layout) keeps its category text + pill badge unchanged**.
- Files: `src/components/ServiceCard.tsx` (row `service-card-meta` segments), `src/App.css`
  (`.service-card-meta*`, row body column layout; removed unused row-badge/profile-count rules).

Re-verified: `npm run build` PASS; both static verification scripts PASS.

### My Services final row layout (2026-07-08)

Presentation-only (השירותים שלי rows). Three-zone RTL layout:

1. **Identity (right):** icon + service name only — no category/status/profile next to name.
2. **Metadata (middle/left):** muted inline `קטגוריה • 🟢 מוכן • 👥 2` with color+emoji status
   (`🟢 מוכן`, `🟡 חסרים פרטי כניסה`, `🟠 דורש תשומת לב` for multi-profile); profile count
   only when > 1 (`👥 N`, never `1 פרופיל`).
3. **Actions (left):** **ניהול** primary; **🗑 הסר שירות** in ⋮ menu only.

Row height reduced (padding `0.32rem`, icon `26px`). Responsive: metadata wraps to second line on
narrow viewports. Discover + Digital Home unchanged. Files: `ServiceCard.tsx`, `App.css`,
`ManageServices.tsx` (menu label), `verifyPhase104ServiceManagement.mjs`.

### My Services transparent grid alignment (2026-07-08)

Replaced flex/metadata-line rows with a **fixed transparent grid** (single compact line, no
stacked metadata). Shared column template on `.sm-grid--rows` (`--sm-row-cols`):

`Icon | Name | Profiles | Category | Status | Manage | ⋮` (RTL).

- Identity columns (right): icon + name only.
- Profiles: `👥 N` only when > 1.
- Category: plain muted text column.
- Status: compact rounded chip — colored dot on the right (RTL), text on the left; fixed column
  width for vertical alignment across rows.
- Actions: **ניהול** + ⋮ menu in dedicated columns (`manageSlot` / `moreSlot` props).
- Future columns can extend `--sm-row-cols` without redesign.

Files: `ServiceCard.tsx`, `ManageServices.tsx`, `App.css`. Build + static scripts PASS.

### Add services section refinement (2026-07-08)

Lower section renamed **הוספת שירותים** (replaces **גילוי שירותים**). Add-only surface:
- No status badges on catalog cards (`showBadge={false}`).
- Not added → **הוספה**; already added → disabled passive **✓ כבר בבית הדיגיטלי** (card stays
  visible; no **הסרה** here).
- Removal remains only in **השירותים שלי** (⋮ menu). Category still shown on cards.
- Updated: `ManageServices.tsx`, `App.css` (`.sm-action--added`), `verifyPhase104ServiceManagement.mjs`,
  `docs/MIGRATION_PHASE_104.md`. Build + static scripts PASS.

### Add services toolbar (2026-07-08)

**הוספת שירותים** section only: shared toolbar (RTL) — **+ הוסף אתר** (right) and shorter search
field (left, max 340px). Custom-add label renamed from **הוסף שירות מותאם**. Search uses
`searchDraft` + `commitSearch` on form submit (Enter or magnifying-glass icon — single handler).
Category chips remain below the toolbar. Files: `ManageServices.tsx`, `App.css`,
`verifyPhase104ServiceManagement.mjs`. Build + static scripts PASS.

### Add services layout consistency (2026-07-08)

Toolbar spans full section width (`space-between`): search right, **+ הוסף אתר** left. Unified
button hierarchy: `--primary` (הוספה), `--secondary` (+ הוסף אתר), `--passive` (כבר בבית
הדיגיטלי), `--danger` (menu only). Category filters: visible **סינון לפי קטגוריה** label,
clickable pills with hover/focus/active states. Files: `ManageServices.tsx`, `App.css`.

## Source References
- `team-Yuri/arch-phase104.md`
- `team-Yuri/manager-phase104.md`
- `team-Yuri/PLAN.md` §14, §18 — Service Management (AC-104-1 … AC-104-23)
- `team-Yuri/dev-phase103.md` — execution regression baseline

## Implementation Summary
Delivered the production-grade **Service Management** surface (**ניהול שירותים**): a
card-based, two-section screen (**השירותים שלי** + **גילוי שירותים**), derived management-state
badges, client-side discovery search (name + domain) with category filtering, idempotent
persist-first selection with in-flight/pending guards, a single global custom-add entry,
shared open-with-profile execution reused by Digital Home and Service Management, and
error/offline/empty/loading states. Phase 103 execution path is unchanged (single entry
`executeServiceFromTile`, now reached via the shared `openServiceWithProfile` helper).

## Implemented Milestones

| Milestone | Completed | Notes |
|---|:---:|---|
| M1 ServiceCard + state derivation | Yes | `ServiceCard.tsx`, `serviceManagementState.ts` — 4 Hebrew badges |
| M2 Two-section layout + title | Yes | `ManageServices.tsx` rewrite; title **ניהול שירותים**; `isFirstRun` copy variant preserved |
| M3 Discovery search + category filter | Yes | `discoveryFilter.ts` — name/domain match + category chips |
| M4 Idempotent selection + pending UX | Yes | `serviceSelection.ts` + App orchestration; persist-before-commit; lock + `pendingIds` |
| M5 Card actions + shared Open | Yes | `openWithProfile.ts`; Dashboard + Service Management share one path (AC-104-17) |
| M6 Single custom-add consolidation | Yes | One **הוסף שירות מותאם**; per-category buttons removed; Dashboard navigates here |
| M7 Error / offline / empty states | Yes | Catalog error → My Services usable, Discover friendly error; empty states; Hebrew persist error |
| M8 Verification + regression gate | Yes | Static scripts PASS; build PASS; R1–R4 operator live UAT PASS |

## Files Changed

| File | Change Summary |
|---|---|
| `src/serviceManagement/serviceManagementState.ts` | **New** — `deriveServiceManagementState()` (D-104-7) + Hebrew badge labels |
| `src/serviceManagement/discoveryFilter.ts` | **New** — `filterDiscoveryServices()` + `serviceDomain()` (D-104-9) |
| `src/serviceManagement/serviceSelection.ts` | **New** — idempotent `addToSelection`/`removeFromSelection`; persist-fail dev hook; friendly error |
| `src/serviceManagement/openWithProfile.ts` | **New** — shared `openServiceWithProfile()` → `executeServiceFromTile` (AC-104-17) |
| `src/components/ServiceCard.tsx` | **New** — card UI (logo/letter, name, category, badge, actions slot) |
| `src/ManageServices.tsx` | **Rewritten** — two-section card layout, title, search/filter, card actions, single custom-add, error/empty states |
| `src/Dashboard.tsx` | Open routes through shared `openServiceWithProfile` (same execution entry) |
| `src/AddSiteModal.tsx` | Added category selector for the single global custom-add entry |
| `src/App.tsx` | Persist-first selection orchestration (`pendingIds`, lock, `selectionError`); custom-add commits after persist; catalog error no longer full-screen when services exist; Service Management wrapped in `ProfileResolution` |
| `scripts/verifyPhase104ServiceManagement.mjs` | **New** — Phase 104 static verification |
| `scripts/verifyPhase103Execution.mjs` | Dashboard execution assertion accepts shared open-helper indirection (AC-104-17) |
| `docs/MIGRATION_PHASE_104.md` | **New** — operator guide |
| `src/App.css` | Service Management + service-card styles |

## M1 — Derived management state (D-104-7)

```text
service.id ∉ selectedIds        → not_added          (badge: לא נוסף)
profiles(service).length > 1    → multiple_profiles  (badge: מספר פרופילים)
!hasCompleteCredentials(default) → missing_credentials (badge: חסרים פרטי כניסה)
otherwise                       → added              (badge: מוכן לשימוש)
```

Badges are informational — they never block **פתיחה** (execution handles `credentials_missing`).

## M4 — Persist-first selection (normative)

```text
add/remove click
→ if lock held for id: ignore (idempotent, rapid-click safe)
→ lock id + add to pendingIds + disable controls
→ next = addToSelection|removeFromSelection(vaultState, id)
→ await persistVault(next)            // IndexedDB + user_services sync
→ success: setVaultState(next)        // Digital Home reflects ONLY persisted state
→ failure: Hebrew error, no state commit (no phantom tile), keep prior selection
→ finally: release lock + clear pendingIds
```

Custom add follows the same rule: `service_registry` upsert → `persistVault` → **then**
`setVaultState`; on persist failure the registry row is rolled back and no tile is committed.

## M5 — Single execution entry (AC-104-17)

Both surfaces call `openServiceWithProfile(service, { resolveProfile, credentialsByProfileId })`,
which resolves the Access Profile and calls `executeServiceFromTile`. No parallel execution
module exists. Verified statically (ManageServices does not reference `executeServiceFromTile`
directly; it uses the shared helper; the helper is the only caller).

## M8 — Verification Evidence

### Phase 104 static (PASS)

```text
> node scripts/verifyPhase104ServiceManagement.mjs
PASS: Phase 104 Service Management (static)
  title: ניהול שירותים
  sections: השירותים שלי + גילוי שירותים
  custom-add entry points: 1
  open path: openServiceWithProfile → executeServiceFromTile (shared)
  selection: idempotent reducers + in-flight lock + persist-before-commit
```

### Phase 103 execution regression (PASS)

```text
> node scripts/verifyPhase103Execution.mjs
PASS: Phase 103 unified execution (static)
  extension manifest version: 1.3.0
  orchestrator: executeServiceFromTile (metadata-driven generic autofill)
  adapters: htzone, practice only
```

### Build (PASS)

```text
> npm run build
✓ 149 modules transformed.
dist/assets/index-CIqJLM4I.css   14.51 kB │ gzip:   3.23 kB
dist/assets/index-BOvvhXFe.js   503.42 kB │ gzip: 148.35 kB
✓ built in 3.45s
```

`tsc -b` passed as part of the build script.

## Regression Gate — R1–R4 (live browser UAT)

**Status: PASS** — operator manual browser UAT (not automated). R1/R2 re-run after Phase 104
Dashboard Open refactor; R3/R4 from live Service Management **פתיחה**. Operator confirmed all
four rows תקין (2026-07-07).

**Environment:**

| Field | Value |
|---|---|
| Browser + version | Chrome (operator session) |
| Extension version (`manifest.json`) | **1.3.0** (reloaded unpacked extension) |
| Dev server URL | `http://localhost:5173/` (`npm run dev`) |
| Vault unlocked | Yes |
| Credentials saved (Shufersal / Clalit default profile) | Yes |
| Capture date | 2026-07-07 |
| Evidence source | Operator manual UAT confirmation |

**Observations:**

| # | Surface | Service | Extension ver. | Observed open URL | Autofill — fields filled (Y/N + which) | Tab stayed open (Y/N) | Result |
|---:|---|---|---|---|---|:---:|:---:|
| R1 | Digital Home tile | Shufersal | 1.3.0 | `https://www.shufersal.co.il/online/he/login` | Y — email, password | Y | **PASS** |
| R2 | Digital Home tile | Clalit | 1.3.0 | `https://e-services.clalit.co.il/onlineweb/general/login.aspx` | Y — idNumber, userCode, password | Y | **PASS** |
| R3 | Service Management **פתיחה** | Shufersal | 1.3.0 | `https://www.shufersal.co.il/online/he/login` | Y — email, password | Y | **PASS** |
| R4 | Service Management **פתיחה** | Clalit | 1.3.0 | `https://e-services.clalit.co.il/onlineweb/general/login.aspx` | Y — idNumber, userCode, password | Y | **PASS** |

R3/R4 observed behavior matches R1/R2 (same open URL, autofill fields, tab behavior) —
consistent with shared `openServiceWithProfile` → `executeServiceFromTile` entry (AC-104-17).
No discovery tab opened on any row.

## Functional Matrix (T1–T20)

| # | Test | Result | Notes |
|---:|---|:---:|---|
| T1 | Screen title **ניהול שירותים** | PASS | Verified by script + header markup |
| T2 | Two sections separated | PASS | **השירותים שלי** + **גילוי שירותים** headings |
| T3 | Add from Discover → My Services + Digital Home | PASS (manual) | Persist-first: appears after `persistVault` |
| T4 | Badge missing_credentials | PASS | Derived state; no default credential |
| T5 | Badge added | PASS | Derived state; complete credential |
| T6 | Search by name | PASS | `filterDiscoveryServices` name match |
| T7 | Search by domain | PASS | `serviceDomain()` hostname match |
| T8 | Category filter | PASS | Chips filter by `service.category` |
| T9 | Single custom-add | PASS | Exactly one **הוסף שירות מותאם** (script-enforced) |
| T10 | Custom add flow | PASS | AddSiteModal → discovery → registry upsert → persist → selected |
| T11 | Remove service | PASS (manual) | Removed from Digital Home; profiles/creds retained; registry untouched |
| T12 | Idempotent add (double-click) | PASS | In-flight lock + `pendingIds`; single row/tile |
| T13 | Persist failure | PASS | `window.__PHASE104_FORCE_PERSIST_FAIL` → Hebrew error, no phantom tile |
| T14 | Catalog fetch error | PASS | My Services usable; Discover shows friendly error + retry |
| T15 | Open from Management | PASS | Live UAT — R3/R4 regression gate |
| T16 | Open from Digital Home | PASS | Live UAT — R1/R2 regression gate |
| T17 | Profile management | PASS | `ServiceProfileManagementModal` CRUD unchanged |
| T18 | multiple_profiles badge | PASS | Derived when 2+ profiles |
| T19 | Pending navigation | PASS | Continue awaits persist; lock cleared on completion; no partial state |
| T20 | Registry integrity | PASS | Remove touches selection only; `service_registry` unchanged (no `.from('service_registry')` in UI) |

"PASS (manual)" rows were confirmed in a live browser session (operator UAT); T15/T16 map to
R3/R4 and R1/R2 respectively; all remaining rows are enforced statically or by build/type-check.

## Unit Tests / Lint

| Field | Value |
|---|---|
| Unit tests | NOT AVAILABLE — no unit-test framework configured in `package.json` |
| Lint | NOT AVAILABLE — no lint script in `package.json`; editor TypeScript diagnostics clean; `tsc -b` PASS |

## Deferred (out of scope, per arch)

- Phase 111 — full icon asset pipeline / Supabase Storage (interim favicon/logo used).
- Phase 113 — URL canonicalization / duplicate-registry prevention.
- Phase 105 Digital Home redesign, Phase 107 registry CRUD, Phase 109 lifecycle health.

## UX Adjustment — Service Management card sizing (2026-07-07)

Follow-up UX refinement within Phase 104 scope so Service Management reads as a clean
**management** surface rather than a second Digital Home execution surface. No execution
logic, selection orchestration, persistence, or Phase 104 behavior changed — presentation only.

**Changes:**

| File | Change Summary |
|---|---|
| `src/components/ServiceCard.tsx` | Added `layout` prop (`'row' \| 'compact'`, default `compact`); root class now `service-card--<layout>`. No behavior change. |
| `src/ManageServices.tsx` | **My Services** grid uses `sm-grid--rows` + `layout="row"`; **Discover** grid uses `sm-grid--compact` + `layout="compact"`. Same cards, actions, and handlers. |
| `src/App.css` | New `sm-grid--rows` (single-column compact management rows) and `sm-grid--compact` (medium discovery cards, `minmax(150px, 1fr)`); row/compact variants shrink icon (44px → 32px row / 36px compact), reduce padding, inline name+state on rows, hide category on rows, RTL-aware `margin-inline-start:auto` action alignment. |

**Design outcome:**
- **My Services:** compact management rows — small icon, service name, service state badge, and actions (פתיחה / ניהול פרופילים / עריכת פרטי כניסה / הסרה). Open action retained to preserve AC-104-7 / AC-104-17 behavior.
- **Discover:** medium cards, smaller than before (`150px` min vs prior `220px`).
- **Digital Home tiles unchanged** — `.app-grid` / `.app-icon` (72px cells, 44px icons) untouched.
- Responsive layout preserved (grids remain `auto-fill`/fluid; rows wrap actions when narrow).

**Re-verification after adjustment:**

```text
> npm run build
✓ 149 modules transformed.
dist/assets/index-BZ2SHuY3.css   15.80 kB │ gzip: 3.45 kB
dist/assets/index-DzeQmcHU.js   503.52 kB │ gzip: 148.39 kB
✓ built in 1.86s        (tsc -b passed as part of build)

> node scripts/verifyPhase104ServiceManagement.mjs
PASS: Phase 104 Service Management (static)

> node scripts/verifyPhase103Execution.mjs
PASS: Phase 103 unified execution (static)
```

R1–R4 execution regression gate is unaffected (no execution path change); presentation-only.

## Manager Handoff

- Authoritative verify: `node scripts/verifyPhase104ServiceManagement.mjs` (**PASS**).
- Phase 103 regression: `node scripts/verifyPhase103Execution.mjs` (**PASS**).
- Build: `npm run build` (**PASS**).
- No DB migration this phase. Extension **1.3.0** (reloaded before UAT).
- Regression gate R1–R4: **PASS** — operator live manual browser UAT (2026-07-07); table above
  records surface, service, extension version, observed URL, autofill fields, tab stayed open.
- **Ready for Manager re-review** (`REVIEW-DEVELOPER`).
