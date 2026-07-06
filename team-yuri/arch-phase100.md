# Architecture Phase 100

## Phase Identifier
PHASE=100

## Status
STATUS: APPROVED

## Phase Goal
Remove prototype artifacts from the user-facing product and isolate developer tooling so production builds present a clean baseline before Supabase (Phase 101).

## Source References
- `team-Yuri/PLAN.md` §18 — Phase 100 acceptance criteria (AC-100-1 … AC-100-5)
- `team-Yuri/PLAN.md` §3 — Prototype Phases 1–4 complete; Phase 100+ active
- `src/pocAutofill.ts`, `src/Dashboard.tsx`, `src/App.tsx`, `src/ManageServices.tsx`
- `src/dev/discoveryHarnessDev.ts`, `public/demo-login*.html`

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-100-1: `import.meta.env.DEV` is the production/dev boundary** | Vite already strips dead branches in production builds; no new env surface required | Dev-only code paths compile out of production bundles |
| **D-100-2: Practice service and category are dev-only** | `hub-practice-login` exists solely to validate autofill during prototype | Production catalog and first-run flow exclude practice |
| **D-100-3: Demo static pages excluded from production artifact** | `public/` contains only demo HTML | `publicDir` disabled in production Vite config |
| **D-100-4: Extension message types keep internal POC names** | Renaming extension protocol is out of scope; not user-visible | AC-100-2 satisfied for UI strings only |
| **D-100-5: Interim screen titles retained** | PLAN allows interim naming until Phases 104–105 | No rename to «הבית הדיגיטלי» / «ניהול שירותים» in this phase |

## Constraints / Non-Negotiables
- No Supabase, schema, or persistence changes (Phase 101).
- No changes to vault crypto, IndexedDB format, or extension autofill engine behavior.
- Zero-knowledge model unchanged.
- Prototype Phases 1–4 code paths remain available in dev builds for engineering regression.

## Technical Boundaries / Out of Scope
- Production UX redesign (Phases 104–105).
- Service registry migration (Phase 102).
- Renaming extension messaging protocol.
- Removing practice adapter or demo pages from the repository (dev-only retention).

## Dependencies and Interfaces
- **Vite** `import.meta.env.DEV` / `mode === 'production'` for build boundary.
- **Built-in catalog** (`getBuiltinCatalogDefinitions`) feeds `mockServices`.
- **Extension bridge** unchanged; `VITE_POC_EXTENSION_ID` remains dev configuration name.

## Data / State Considerations
- Existing vaults with `hub-practice-login` in `selectedIds` may still reference the service after upgrade; production UI will not offer re-selection; tiles for unknown/filtered services should not appear (filtered from `selectedServices`).
- New users in production start with empty `selectedIds` on first unlock.

## Security / Privacy Considerations
- Demo pages must not ship in production static output (no local credential test surfaces).
- No new data collection or persistence.

## Testing and Lint Expectations
- `npm run build` must succeed (production mode).
- `tsc -b` via build pipeline.
- No unit-test framework in project; functional verification via dev vs production build behavior.
- Lint: NOT AVAILABLE (no lint script in `package.json`).

## Functional Testability

- Page/screen the user can open: Unlock → Manage Services (production build via `npm run build && npm run preview`)
- User-visible behavior: No POC/demo autofill buttons; no practice category; no first-run auto-selection of תרגול התחברות; no «דמו»/«POC»/«mock» in Hebrew/English UI copy
- Command-line flow: `npm run build` then `npm run preview`
- API endpoint / request: N/A
- Minimal end-to-end flow: Fresh vault unlock in preview → onboarding shows banking/health/shopping only → dashboard has no dev controls
- Expected observable result: Clean production-facing baseline matching AC-100-1 … AC-100-5

## Handoff Notes for Manager
1. Introduce `src/dev/devMode.ts` as single `isDevBuild()` helper.
2. Filter practice from catalog loader and category list in production.
3. Change `App.tsx` first-run to skip auto-selecting `HUB_PRACTICE_LOGIN_ID` in production.
4. Remove practice-specific onboarding copy from `ManageServices` in production.
5. Simplify `Dashboard` magic-moment and extension banners (no practice-specific paths).
6. Set `publicDir: false` when `mode === 'production'` in `vite.config.mjs`.
7. Add `docs/PROTOTYPE_LIMITATIONS.md` for AC-100-4.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- **Phase alignment:** `PHASE=100` in `PHASE.md`; `arch-phase100.md`, `manager-phase100.md`, and `dev-phase100.md` all declare `PHASE=100`. Manager review status is APPROVED.
- **D-100-1 (`isDevBuild`):** `src/dev/devMode.ts` introduced; used in `catalogLoader.ts`, `mockServices.ts`, `pocAutofill.ts`, `App.tsx`, and `ManageServices.tsx`. Consistent production/dev gate.
- **D-100-2 (practice dev-only):** `hub-practice-login` filtered from built-in catalog in production; `practice` category omitted from `categories` export. Production first-run no longer auto-selects practice (`App.tsx`).
- **D-100-3 (demo static pages):** `vite.config.mjs` sets `publicDir: false` when `mode === 'production'`. Production JS bundle contains no user-facing POC/demo strings (`פתח ומלא`, `דמו`, `hub-practice-login`, `תרגול התחברות`).
- **D-100-4 (extension protocol):** Internal `POC_*` message types unchanged; not user-visible. Acceptable per architecture contract.
- **D-100-5 (interim titles):** Dashboard and Manage Services titles unchanged — compliant with PLAN interim naming allowance.
- **AC-100-1:** POC autofill buttons gated behind `isPocControlsVisible()` → `isDevBuild()`; dead-branch elimination confirmed in production bundle.
- **AC-100-2:** Production user-facing copy cleaned in `Dashboard.tsx` and `ManageServices.tsx`; no prototype jargon in shipped JS.
- **AC-100-3:** Discovery harness remains `import.meta.env.DEV`-gated in `discoveryHarnessDev.ts`; POC controls dev-only.
- **AC-100-4:** `docs/PROTOTYPE_LIMITATIONS.md` present, accurate, covers persistence, extension, dev tooling, and Phase 101 pointer.
- **AC-100-5:** Interim screen naming retained.
- **Constraints:** No Supabase, persistence, vault crypto, or extension engine changes observed. Scope compliant.
- **Verification:** Developer build evidence accepted. Unit tests and lint NOT AVAILABLE — documented and acceptable for this project. Functional evidence via build + bundle inspection is sufficient for this phase.
- **Observation (non-blocking):** `discoveryHarnessDev.ts` uses `import.meta.env.DEV` directly rather than `isDevBuild()` — behavior equivalent; optional consistency improvement in a future hygiene pass. Stale `demo-login*.html` in `dist/` may persist if an old artifact predates the Vite config change; enforce clean `npm run build` before deploy.

### Required Corrections
_None._
