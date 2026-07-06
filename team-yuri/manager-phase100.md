# Manager Phase 100

## Phase Identifier
PHASE=100

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Deliver a production-clean user experience by hiding prototype/demo surfaces from production builds while preserving full dev tooling for engineering.

## Source References
- `team-Yuri/arch-phase100.md`
- `team-Yuri/PLAN.md` §18 — Phase 100
- `team-Yuri/PHASE.md` — `PHASE=100`

## Architecture Summary
Use Vite's `import.meta.env.DEV` as the sole production/dev gate. Filter practice catalog entry and category from production. Stop auto-selecting practice on first unlock in production. Exclude demo HTML from production build output. Document prototype limitations in `docs/`.

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| 1 | Dev mode helper | Add `src/dev/devMode.ts` with `isDevBuild()` | Single import used across app |
| 2 | Catalog filter | Omit `hub-practice-login` from built-in catalog in production | Practice absent from `mockServices` in prod bundle |
| 3 | Category filter | Omit `practice` from visible categories in production | Manage Services shows 3 categories only in prod |
| 4 | First-run flow | Production: empty `selectedIds`; Dev: keep practice auto-select | Fresh prod unlock shows no pre-checked service |
| 5 | UI copy cleanup | Remove practice/demo/mock references from user-facing strings | AC-100-2 satisfied in Dashboard and ManageServices |
| 6 | Production static assets | Disable `publicDir` in production Vite config | `dist/` has no `demo-login*.html` |
| 7 | Limitations doc | Add `docs/PROTOTYPE_LIMITATIONS.md` | AC-100-4 satisfied |

## Detailed Development Plan

### M1 — `devMode.ts`
Create `export function isDevBuild(): boolean { return import.meta.env.DEV; }`.

### M2 — Catalog (`catalogLoader.ts`)
After validation, if `!isDevBuild()`, filter definitions where `id !== HUB_PRACTICE_LOGIN_ID`.

### M3 — Categories (`mockServices.ts`)
Export `categories` as dev-full list or production list without `practice`. Update `pocAutofill.isPocControlsVisible()` to delegate to `isDevBuild()`.

### M4 — First run (`App.tsx`)
When `loaded.selectedIds.length === 0`:
- **Dev:** current behavior (auto-select `HUB_PRACTICE_LOGIN_ID`, first-run manage screen).
- **Production:** set `manageIsFirstRun(true)`, `screen='manage'`, do **not** persist pre-selection.

### M5 — UI strings
- `ManageServices.tsx`: show practice first-run note only when `isDevBuild()`.
- `Dashboard.tsx`: remove `hasPracticeService` branching; generic magic-moment and extension banners only.

### M6 — Vite config
```js
export default defineConfig(({ mode }) => ({
  publicDir: mode === 'production' ? false : 'public',
  ...
}));
```

### M7 — Documentation
`docs/PROTOTYPE_LIMITATIONS.md` — IndexedDB-only persistence, extension requirement, no cloud sync, no account auth, catalog scope, dev-only tooling location (`#/dev/discovery`, POC dashboard buttons).

## Acceptance / Gating Criteria
- AC-100-1: No demo/test autofill buttons in production preview
- AC-100-2: No POC/demo/mock jargon in user-facing UI (production)
- AC-100-3: Discovery harness and POC controls remain dev-only
- AC-100-4: `docs/PROTOTYPE_LIMITATIONS.md` exists and is accurate
- AC-100-5: Interim screen titles unchanged (acceptable per PLAN)

## Functional Testability Criteria

- Page/screen the user can open: `npm run preview` after `npm run build`
- User-visible behavior: Clean onboarding and dashboard without prototype surfaces
- Command-line flow: `npm run build` (must pass)
- API endpoint / request: N/A
- Minimal end-to-end flow: Build → preview → unlock new vault → verify manage screen → continue → dashboard
- Expected observable result: Matches all AC-100-* criteria

## Required Developer Evidence
- `team-Yuri/dev-phase100.md` with files changed, build result, functional steps, documentation update

## Out of Scope
- Supabase setup
- Screen title renames (Phases 104–105)
- Extension protocol renames
- Unit test framework introduction

## Risks / Open Questions
- **Existing vaults** with practice selected: filtered service won't render tile; acceptable for prototype-to-production transition.
- **No lint script:** document NOT AVAILABLE.

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes
- Phase identifier aligned (`PHASE=100`); developer artifact complete with files changed, build result, functional steps, and documentation evidence.
- All seven milestones verified in source: `isDevBuild()` gate, catalog/category filters, production first-run flow, UI copy cleanup, `publicDir: false` in production, and `docs/PROTOTYPE_LIMITATIONS.md`.
- Independent verification: `npm run build` succeeded; `dist/` contains only `index.html` and `assets/` (no `demo-login*.html`); production bundle excludes POC button strings (`פתח ומלא`, `דמו`, `hub-practice-login`).
- AC-100-1 through AC-100-5 satisfied. Discovery harness gated by `import.meta.env.DEV` in `discoveryHarnessDev.ts`.
- Unit tests and lint reported NOT AVAILABLE per phase risks; acceptable.
- Functional evidence used build + dist inspection rather than documented `npm run preview` E2E unlock flow; artifact inspection and code review confirm production behavior. Minor evidence gap only — does not block approval.

### Required Corrections
_None._
