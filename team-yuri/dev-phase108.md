# Developer Phase 108

## Phase Identifier
PHASE=108

## Status
STATUS: COMPLETE (M1 only). M2 and M3 were not started.

Prior discovery completion claims in this file are withdrawn. They are not M1 evidence.

## Source References
- `team-yuri/PHASE.md` — PHASE=108
- `team-yuri/arch-phase108.md` — 2026-09-14 revision
- `team-yuri/manager-phase108.md` — M1 authorized; M3 not authorized

## Implementation Summary
M1 adds an explicit human-owned login entry on custom create/edit and admin create/edit/approve, and stops product create/edit/approve/refresh UI from invoking Automatic Login Discovery.

Custom add defaults «דף הכניסה זהה לכתובת האתר» on. Checked saves `loginUrl` equal to the website URL, `loginEntryType=primary_page`, `loginUrlSource=user`, `login_url_status=valid`. Unchecked requires «כתובת כניסה» and saves `direct_url`. Empty or invalid dedicated URL is rejected. No URL is guessed. Create does not call discovery and does not require the extension.

Custom edit is on the existing Manage Services row menu («עריכת כתובת כניסה») and reuses the add modal. Opening edit does not write `login_url`. Default: checkbox on when stored `loginUrl` is null or the same site as the website URL; off with the stored URL shown when they differ.

Admin create/edit has entry type «כניסה מדף הבית» / «כתובת כניסה ייעודית». Save sets `loginUrlSource=admin` and `login_url_status=valid` without a discovery call. Bulk refresh, force-overwrite, and rediscover controls are removed from product UI. Approval calls `promoteUserSubmission` only, then writes the administrator-confirmed entry on the global row (`owner_user_id IS NULL`).

The discovery engine, extension discovery messages, and `build:extension-discovery` remain. No migration was added. No stored `login_url` was nulled or deleted.

## Implemented Milestones

| Milestone | Completed: Yes/No | Notes |
|---|---:|---|
| M1 Explicit login entry; stop invocation | Yes | This record |
| M2 Manager evidence review | No | Not a Developer coding milestone |
| M3 Remove discovery-only implementation | No | Not authorized |
| M4 Legacy data cleanup | No | Not authorized |

## Files Changed

| File | Change Summary | Reason |
|---|---|---|
| `src/catalog/explicitLoginEntry.ts` | Added | Explicit entry resolve, labels, metadata stamp |
| `src/catalog/customService.ts` | Create/edit definition writes explicit login URL and metadata | AC-108-3, AC-108-4, AC-108-16 |
| `src/AddSiteModal.tsx` | Checkbox, login URL field, no discovery progress | AC-108-4, AC-108-5, AC-108-6 |
| `src/ManageServices.tsx` | Add/edit persist without discovery | AC-108-6, AC-108-7 |
| `src/App.tsx` | Registry upsert only; no discovery call | AC-108-6, AC-108-7 |
| `src/registry/registryMapper.ts` | User insert writes `loginUrlSource` / `loginEntryType`; stops discovery outcome defaults | M1 registry insert |
| `src/admin/RegistryAdmin.tsx` | Entry type; no create-discovery, bulk, or rediscover | AC-108-1, AC-108-6, AC-108-9 |
| `src/admin/adminRegistryApi.ts` | Global/user saves stamp ownership and `valid`; client follow-up no longer adds discovery outcome fields | AC-108-2, AC-108-10, AC-108-18 |
| `src/admin/ApprovalQueue.tsx` | Promote without discovery; admin confirms entry | AC-108-6, D-108-12 |
| `src/admin/LoginUrlRefresh.tsx` | Manual save only; rediscover removed | AC-108-9 |
| `src/admin/IntegrationStatusPanel.tsx` | Shows URLs and entry ownership; not discovery status | M1 UI |
| `src/App.css` | Checkbox layout | Add/edit control |
| `docs/MIGRATION_PHASE_108.md` | Short note that discovery is not the MVP path | User-visible contract change |
| `scripts/verifyPhase108M1ExplicitLoginEntry.mjs` | Static path audit + persist helper | Evidence |

## Dependencies Installed

| Dependency / Tool | Command Used | Reason |
|---|---|---|
| None | — | Existing toolchain was sufficient |

## Unit Tests

| Field | Value |
|---|---|
| Command | NOT AVAILABLE |
| Result | NOT AVAILABLE |
| Notes | `package.json` has no unit-test script and no test runner. Persist rules were exercised by `node scripts/verifyPhase108M1ExplicitLoginEntry.mjs` instead. |

## Lint

| Field | Value |
|---|---|
| Command | NOT AVAILABLE |
| Result | NOT AVAILABLE |
| Notes | `package.json` has no lint script. |

## Functional Testability Evidence

| Field | Value |
|---|---|
| Method | CLI persist helper + static product-path audit. Browser click-through was not run in this session. |
| Steps | `node scripts/verifyPhase108M1ExplicitLoginEntry.mjs` then `npm run build` |
| Expected Result | Helper stores human login URL and entry type; empty dedicated URL rejected; product UI files do not reference discovery entry points; build passes with the discovery bundle step still attached. |
| Actual Result | PASS |
| Notes | Helper: same-as-website `https://www.example.co.il/` → `loginUrl` equal to that URL, `loginEntryType=primary_page`. Dedicated `https://example.com/login` → `direct_url` and that URL. Empty dedicated URL throws «יש להזין כתובת כניסה». Null stored login URL defaults the control on. Stamp writes `loginUrlSource=user` and does not invent `loginUrlDiscoveryAttempted`. Live admin/user clicks were not performed. |

### AC notes (persist mapping, not a live click)

| ID | What would be stored |
|---|---|
| AC-108-1 | Admin form entry type + login URL persisted via `createGlobalRegistryRow` / `updateGlobalRegistryRow` (`loginUrlSource=admin`, `login_url_status=valid`). |
| AC-108-4 | Checkbox on → `loginUrl` = website URL, `primary_page`, `user`. Helper PASS. |
| AC-108-5 / AC-108-17 | Checkbox off with empty login URL rejected. Helper PASS. |
| AC-108-6 | `App.tsx`, `RegistryAdmin.tsx`, `ApprovalQueue.tsx` do not reference discovery functions. Static PASS. |
| AC-108-12 | `getServiceOpenUrl` remains `loginUrl ?? url`. Unchanged. |
| AC-108-16 | `primary_page` stores website/primary URL as `loginUrl`. Helper PASS. |

## Documentation Update Evidence

| Field | Value |
|---|---|
| Documentation Updated | YES |
| Files Updated | `docs/MIGRATION_PHASE_108.md` |
| Reason if Not Required | `README.md` does not describe login discovery or the add-site flow. A short note was added to the phase migration doc. It was not rewritten into a second architecture. |

## Known Issues / Limitations
- RPC `admin_update_login_url` (`supabase/migrations/20260712120000_phase108_admin_login_url_clears_discovery.sql`) still stamps discovery-shaped metadata on a manual save when status is `valid`: `loginUrlDiscoveryOutcome=succeeded`, `loginUrlDiscoveryAttempted=true`, `loginUrlLastDiscoveredAt`, `lastDiscoveryOutcome.method=admin_manual`. M1 does not add a migration. The client follow-up no longer adds those fields. The RPC does not start discovery and does not change credentials.
- `src/admin/adminRegistryApi.ts` still contains unused `createGlobalRegistryRowWithDiscovery`, `promoteUserSubmissionWithDiscovery`, `adminTriggerLoginRediscovery`, and `adminBulkRefreshLoginUrls`. Product UI does not call them. Removal is M3.
- Dev harness route (`src/dev/DiscoveryHarness.tsx`) remains. It is not a product create/edit path. Removal is M3.
- `promote_user_submission` still converts the user row in place when the global id equals the user id. That RPC was not changed (no migration). The confirmation write after promote updates only `owner_user_id IS NULL`.
- Operator confirmed on 2026-09-14 that the M1 screens look correct («הכל נראה תקין»).

## Scope Compliance
M1 only. Discovery engine files, extension discovery messages, and `build:extension-discovery` were not deleted. No migration. No `login_url` nulling. Authentication, credentials, vault encryption, Phase 111 icon discovery, catalog search (`filterDiscoveryServices`), and `executeServiceFromTile` orchestration were not redesigned. Withdrawn discovery milestones were not implemented. M3 was not started.

## Developer Declaration
Detected phase: 108  
Selected state: IMPLEMENT  
Status: COMPLETE  

Sarah (Team Yuri Developer) — Phase 108 M1 only.
