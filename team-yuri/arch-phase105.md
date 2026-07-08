# Architecture Phase 105

## Phase Identifier
PHASE=105

## Status
STATUS: READY_FOR_MANAGER

## Phase Goal
Deliver **production Digital Home UX** (**הבית הדיגיטלי**) as the user’s daily **execution surface**: category-grouped service tiles, calm execution-oriented presentation, Useful Services and Notifications foundations, friendly empty/loading/offline states — while **preserving Phase 103 unified execution** and **strict separation from Service Management** (Phase 104).

Phase 105 owns **Digital Home presentation and UX orchestration** only. It does not own service selection/administration (104), registry curation (107), security/trust UX (106), full icon pipeline (111), or URL canonicalization (113).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=105`
- `team-Yuri/PLAN.md` §18 — Phase 105 (AC-105-1 … AC-105-20); layout architecture; execution/UX rules
- `team-Yuri/PLAN.md` §14 — Digital Home vs Service Management separation
- `team-Yuri/arch-phase103.md` — `executeServiceFromTile` unified pipeline
- `team-Yuri/arch-phase104.md` — APPROVED; administration-only Service Management; Digital Home sole execution surface
- `team-Yuri/dev-phase104.md` — Service Management final UX; footers navigate to Digital Home
- `src/Dashboard.tsx` — Digital Home execution surface (title target: **הבית הדיגיטלי**)
- `src/Tile.tsx` — tile presentation
- `src/serviceManagement/openWithProfile.ts` — shared open helper → `executeServiceFromTile`
- `src/execution/serviceExecution.ts` — sole orchestrator (read-only this phase)
- `src/profile/profileResolutionHost.tsx` — profile chooser on multi-profile open
- `src/useServiceLogos.ts` / `logoCache.ts` — interim icons (Phase 111 deferred)

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-105-1: Screen title** | AC-105-1 | Primary heading is exactly **הבית הדיגיטלי**. Replace interim **המרכז הדיגיטלי שלי**. Optional short security/reassurance subtitle allowed; must not introduce management jargon. |
| **D-105-2: Execution-only surface** | AC-105-4, AC-105-9, AC-105-16, PLAN principles | Digital Home **consumes** registry metadata, `selectedIds` / `user_services`, Access Profiles, and credentials for **display and open**. It **must not** mutate registry, profiles, credentials, or `user_services`. No edit/remove/manage controls on tiles. Navigation to Service Management is via dedicated header/empty-state CTAs only. |
| **D-105-3: Single unified open path** | AC-105-4, AC-105-17, AC-105-19 | Tile click → existing `openServiceWithProfile` → `executeServiceFromTile`. **No** new execution module, **no** service-id branching, **no** discovery on tile click, **no** auto-close of execution tabs. Phase 103 orchestration is **read-only**. |
| **D-105-4: One tile per selected service** | AC-105-3 | Exactly one tile for each service in the selected set. Multiple identities ≠ multiple tiles; resolved via profile chooser (D-105-5). |
| **D-105-5: Progressive profile disclosure** | AC-105-5, AC-105-6 | Multi-profile → chooser on open (existing `resolveProfile`). Single-profile → open without profile management friction. Profile CRUD remains Service Management only. |
| **D-105-6: Open resilience** | AC-105-7, AC-105-8 | Missing credentials must not block opening when a URL is available (`loginUrl` / `primaryUrl`); show friendly guidance to Service Management. Autofill failure must not prevent open or close the tab. Align Dashboard status handling with Phase 103 results (`ok` / `open_only` / `credentials_missing` after open). No silent failures. |
| **D-105-7: Category-grouped layout** | AC-105-2, AC-105-15 | Group selected services by category. **Hide empty categories**. Stable RTL-correct responsive sections. Prefer reserved skeleton/min-height so filtering/loading does not cause major layout jump (AC-105-13). |
| **D-105-8: Page structure (normative)** | PLAN layout architecture | Digital Home contains, in order: (1) **Header** — title, optional reassurance, navigation to Service Management; (2) **Useful Services** area; (3) **Notifications** area; (4) **Category sections** with tiles. Calm visual hierarchy; tiles larger/more visual than Service Management rows. |
| **D-105-9: Useful Services foundation** | AC-105-10 | Area **must exist**. Placeholder or **minimal** data-driven content (e.g. recently used / most-used from local signals if already available) is acceptable. **Must not** permanently hardcode a fake catalog. Full ranking algorithm **out of scope**. |
| **D-105-10: Notifications foundation** | AC-105-11 | Area **must exist** with placeholder or friendly empty state. Reserved for future service/credential/sync/security notices. **No** advanced notification engine. |
| **D-105-11: Empty / loading / offline** | AC-105-12, AC-105-13, AC-105-14 | Empty selected set → guide user to Service Management (clear CTA). Loading → stable layout, no major jumps. Offline/error → Hebrew friendly copy; no technical/stack traces; do not block viewing already-loaded selected tiles when possible. |
| **D-105-12: Tile presentation** | AC-105-9, AC-105-15 | Tile shows icon + name. Optional **minimal** execution-relevant indicator only (e.g. credentials-ready hint) — never management controls. Hover/focus must feel interactive. Interim logos via existing `useServiceLogos` (Phase 111 deferred). |
| **D-105-13: Origin independence** | AC-105-18 | Custom and admin-managed selected services appear and execute identically to built-in catalog services (metadata-driven Phase 103 path). |
| **D-105-14: Soft upstream deps** | PLAN dependency note | Phase 111 (icons) and Phase 113 (URL canonicalization) remain **soft**. Phase 105 ships with interim favicon/logo resolution and existing login/primary URL open rules. Do not block Phase 105 on 111/113. |
| **D-105-15: Dev-only surfaces** | Phase 100 | POC/demo fill buttons remain behind `isPocControlsVisible()` / `isDevBuild()`. Production Digital Home must not show them. |

### Normative page map

```text
הבית הדיגיטלי
├── Header (title + optional reassurance + → ניהול שירותים)
├── Useful Services (foundation / placeholder OK)
├── Notifications (foundation / empty OK)
└── Category sections (only non-empty)
    └── Tiles (icon + name → openServiceWithProfile)
```

### Normative open flow (unchanged contract)

```text
Tile click
→ resolveProfile(serviceId)     # chooser only if multiple profiles
→ openServiceWithProfile
→ executeServiceFromTile        # Phase 103 — sole orchestrator
→ friendly status / guidance as needed
```

## Constraints / Non-Negotiables
- Screen title **הבית הדיגיטלי** (AC-105-1).
- Tile open uses **only** Phase 103 path via `openServiceWithProfile` / `executeServiceFromTile` (AC-105-4).
- **No** management controls on tiles (AC-105-9).
- **No** mutation of registry, Access Profiles, credentials, or `user_services` from Digital Home (AC-105-16).
- Empty categories **hidden** (AC-105-2); exactly **one** tile per selected service (AC-105-3).
- Shufersal / Clalit autofill regression preserved (AC-105-17, AC-105-19).
- Hebrew, user-friendly errors — no engine/POC terminology in production UI.
- Phase 100 `isDevBuild()` gating unchanged for practice/POC.

## Technical Boundaries / Out of Scope
- Service Management UX / selection orchestration (Phase 104 — already delivered).
- Security and Trust UX / password-manager interference (Phase 106).
- Admin platform / registry CRUD (Phase 107).
- Lifecycle health UX for stale `loginUrl` (Phase 109).
- Full icon asset pipeline / Storage (Phase 111).
- URL canonicalization / duplicate prevention (Phase 113).
- Advanced notification engine; full Useful Services ranking algorithm.
- New login discovery on tile click.
- New execution adapters or changes to `executeServiceFromTile` orchestration.
- Auto-submit login forms.
- Credential/profile CRUD or service remove from Digital Home.

## Dependencies and Interfaces

### Upstream (must be complete)

| Phase | Provides |
|-------|----------|
| 102 | Registry-backed catalog metadata for tiles |
| 103 | `executeServiceFromTile`, autofill orchestration, open resilience |
| 104 | Selected services from administration; navigation from Management footer **לבית הדיגיטלי** |

### Soft / deferred

| Phase | Role in 105 |
|-------|-------------|
| 111 | Interim logos acceptable |
| 113 | Existing open URL rules acceptable |

### Hub modules (Developer — target ownership)

| Module | Responsibility |
|--------|----------------|
| `src/Dashboard.tsx` | Primary Digital Home screen rewrite/evolution — title, sections, states, CTAs |
| `src/Tile.tsx` | Execution tile presentation (icon, name, optional minimal indicator); no manage controls |
| New optional `src/digitalHome/*` | Useful Services / Notifications presentational helpers if needed to keep Dashboard thin |
| `src/serviceManagement/openWithProfile.ts` | **Read-only** — keep as Digital Home open helper |
| `src/execution/serviceExecution.ts` | **Read-only** — no orchestration changes |
| `src/profile/*` | Reuse existing multi-profile chooser; no model changes |
| `src/App.tsx` | Pass selected services, credentials, resolveProfile; wire navigation to Service Management; loading/catalog error props as needed |
| `src/App.css` | Digital Home layout polish — calmer hierarchy, Useful/Notifications shells, stable loading |

### Data interfaces (read-only for Digital Home)

| Store | Role |
|-------|------|
| Selected `Service[]` from vault `selectedIds` + catalog | Tile source of truth |
| `accessProfiles` / credentials | Profile resolution + optional ready indicator |
| Catalog load / network error flags from App | Friendly offline/error copy |
| Optional local “recent/useful” signals | Useful Services foundation only if already feasible without new persistence schema |

## Data / State Considerations
- Digital Home **re-renders** when persisted selection changes in App after Service Management — no local optimistic selection.
- Useful Services: if no usage telemetry exists yet, ship **placeholder** or empty friendly content — do not invent permanent fake services.
- Notifications: empty/placeholder — no fake urgent alerts.
- Loading: prefer reserved section shells so Useful/Notifications/categories do not jump when data arrives (AC-105-13).
- Category order: use existing category enum order (or stable Hebrew label order); document choice in Manager plan.

## Security / Privacy Considerations
- Tiles must not display plaintext credentials — status indicators only.
- No new third-party fetch for Useful/Notifications in this phase.
- Dev POC controls remain non-production.
- Status banners remain user-facing Hebrew guidance to Service Management when credentials missing.

## Testing and Lint Expectations
- `npm run build` passes (AC-105-20).
- `npx tsc -b` passes (via build).
- Add `scripts/verifyPhase105DigitalHome.mjs` — static checks: title **הבית הדיגיטלי**; Useful Services + Notifications section markers; no manage/remove/credential-edit controls on tiles; open path still `openServiceWithProfile` → `executeServiceFromTile`; empty categories not rendered (pattern assertable); no discovery-on-click imports in Dashboard.
- Re-run `scripts/verifyPhase103Execution.mjs` — must PASS.
- Manual matrix including Shufersal/Clalit Digital Home open+fill (R1/R2 style).

## Functional Testability

- **Page/screen:** Digital Home after unlock (`http://localhost:5173/`)
- **User-visible behavior:**
  - Title **הבית הדיגיטלי**
  - Useful Services + Notifications areas present
  - Selected services grouped by category; empty categories absent
  - One tile per service; click opens via Phase 103 path
  - Multi-profile → chooser; single-profile → direct open
  - Empty selection → CTA to Service Management
  - No manage/remove on tiles
  - Loading/offline/error friendly, stable layout
- **Command-line:** `node scripts/verifyPhase105DigitalHome.mjs`; `node scripts/verifyPhase103Execution.mjs`
- **Minimal end-to-end flow:**
  1. Unlock vault with selected Shufersal + Clalit
  2. Confirm title and category grouping
  3. Click Shufersal tile → login opens + autofill (AC-105-17)
  4. Click Clalit tile → same
  5. Remove all services in Service Management → empty state CTA on Digital Home
  6. Multi-profile service (if available) → chooser once, then open
- **Expected:** AC-105-1 … AC-105-20 satisfied; Phase 103/104 contracts intact

## Handoff Notes for Manager

1. Publish AC-105-1 … AC-105-20 verbatim with milestone mapping.
2. Suggested milestones: (M1) title + header CTA + calm layout base → (M2) category grouping / hide empty + tile polish → (M3) Useful Services foundation → (M4) Notifications foundation → (M5) empty/loading/offline states + stable layout → (M6) open-path alignment for AC-105-7/8 status messaging → (M7) `verifyPhase105DigitalHome.mjs` + Phase 103 regression + docs.
3. **Regression gate:** Digital Home Shufersal + Clalit open+fill (same spirit as Phase 104 R1/R2). No Service Management Open regression (retired in 104).
4. Explicitly **do not** modify `executeServiceFromTile` orchestration.
5. Soft-defer Phase 111 / 113 — interim icons and URLs OK.
6. Useful Services / Notifications: define acceptance as **area exists + placeholder/minimal** — not ranking/engine completeness.
7. Align any Dashboard `credentials_missing` handling with D-105-6 so open-when-URL-available is observable.
8. Developer evidence in `dev-phase105.md`: build, both verify scripts, functional matrix, optional screenshots.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- **Phase alignment:** `PHASE=105` in `PHASE.md`; `arch-phase105.md`, `manager-phase105.md`, and `dev-phase105.md` all declare `PHASE=105`. Manager review **APPROVED** after R1/R2 live operator UAT (2026-07-08).
- **D-105-1:** `Dashboard.tsx` title exactly **הבית הדיגיטלי**; interim **המרכז הדיגיטלי שלי** removed (script-enforced). Optional reassurance subtitle present.
- **D-105-2 / AC-105-9 / AC-105-16:** Execution-only surface — tiles have no manage/remove/credential-edit controls; Dashboard has no `ServiceProfileManagementModal` / `onRemoveService`; navigation via header **ניהול שירותים** and empty-state **הוספת שירותים** only. No vault/registry mutations from Digital Home.
- **D-105-3 / AC-105-4 / AC-105-19:** Tile open → `openServiceWithProfile` → `executeServiceFromTile`. No direct orchestrator call or discovery-on-click in Dashboard. Phase 103 orchestration unread/unchanged. Live UAT R1/R2 PASS (Shufersal + Clalit).
- **D-105-4 / D-105-7 / AC-105-2 / AC-105-3:** Category enum order with `group.services.length > 0` filter; one `Tile` per selected service per category.
- **D-105-5:** Existing `resolveProfile` / `ProfileResolution` path preserved (multi-profile chooser; single-profile frictionless).
- **D-105-6 / AC-105-7 / AC-105-8:** Dashboard surfaces `credentials_missing` with friendly guidance after open path; messaging aligns with open-when-URL-available. Autofill/tab behavior owned by unchanged Phase 103 orchestrator.
- **D-105-8 / D-105-9 / D-105-10:** Page order Header → `UsefulServicesSection` (**שירותים שימושיים** placeholder) → `NotificationsSection` (**התראות** empty) → category sections — no fake permanent catalog or fake urgent alerts.
- **D-105-11:** Empty selection CTA; loading shell when catalog loading + empty selection; soft catalog-error banner when tiles already present — friendly Hebrew, no technical dump.
- **D-105-12 / D-105-14 / D-105-15:** Icon+name tiles with optional credentials-ready badge; interim logos; POC controls still `isPocControlsVisible()`-gated.
- **AC-105-1 … AC-105-20:** Satisfied within phase scope per Manager approval, static scripts (`verifyPhase105DigitalHome.mjs`, `verifyPhase103Execution.mjs` PASS), build PASS, functional matrix T1–T21, and R1/R2 live UAT.
- **Constraints / non-goals:** No Phase 106/107/109/111/113 scope creep; no new adapters; Useful Services / Notifications remain foundations only.
- **Verification:** Unit tests/lint NOT AVAILABLE — documented and acceptable. Operator live UAT meets functional regression requirement for Digital Home execution.

### Required Corrections
_None._
