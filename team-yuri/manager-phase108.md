# Manager Phase 108

## Phase Identifier
PHASE=108

## Status
STATUS: READY_FOR_DEVELOPER

Prior discovery milestones in this artifact (M9–M16, U27, PayPal auto-discovery, Zap dual-gate, DiscoveryExecutor churn) are **withdrawn**. They are not active requirements. Do not implement them.

CEO accepted the revised architecture on 2026-09-14. This plan is the only active Manager contract for Phase 108.

## Phase Goal
Implement Phase 108 as Browser Integration and Explicit Login Entry Management.

First authorized Developer work (M1): human-owned login entries work on create and edit, and no product flow invokes Automatic Login Discovery. Do not delete the discovery engine in M1. Do not null stored `login_url` values. Do not change authentication, credentials, vault encryption, Phase 111 icon discovery, or catalog search.

## Source References
- `team-yuri/PHASE.md` — `PHASE=108`
- `team-yuri/arch-phase108.md` — approved 2026-09-14 revision, including Engineering Change Boundary and AC-108-1 through AC-108-20
- `team-yuri/PLAN.md` — Phase 108 section and changelog 5.41
- CEO approval: phased sequence is mandatory (explicit behavior and stop invocation, then verify, then remove discovery-only code, then separate legacy cleanup)

## Architecture Summary
Two independent responsibilities remain: Browser Integration, and explicit login-entry management.

Automatic Login Discovery is not in the MVP. The system must not crawl, infer, guess, rank, rediscover, bulk-refresh, or automatically replace a login URL.

Ownership:
- Global catalog (`owner_user_id IS NULL`): administrator. `loginUrlSource=admin`.
- User-created custom (`owner_user_id` set): that user. `loginUrlSource=user`.
- A user save must not update global login fields. A global save must not update user-owned login fields.

Entry types:
- `primary_page`: persist `loginUrl` equal to the website/primary URL. No crawling.
- `direct_url`: a human-provided Login URL is required.

Custom services: control "Login page is the same as the website URL" defaults to enabled. User-facing copy is Hebrew, consistent with existing Add Site and Admin copy. Use label «דף הכניסה זהה לכתובת האתר». Separate field label «כתובת כניסה», matching Admin.

Legacy rows with null `login_url` stay null until a human saves. Open uses the primary URL. Do not backfill by crawling. Do not delete or null existing `login_url` values.

Active writes: `loginUrlSource` `admin` or `user` only; `loginEntryType` `direct_url` or `primary_page`; `login_url_status=valid` on a human save. Stop writing discovery metadata. Do not delete historical discovery keys in M1. Do not add a migration in M1.

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| 1 | M1 Explicit login entry; stop invocation | Add explicit create/edit persist. Remove discovery calls from product flows. Leave discovery engine files in the tree. | AC-108-1 through AC-108-14 and AC-108-16 through AC-108-20 evidenced. `npm run build` passes. No product path calls discovery. |
| 2 | M2 Manager evidence review | Manager reviews M1 evidence in `dev-phase108.md`. Not a Developer coding milestone. | MANAGER_REVIEW_STATUS APPROVED for M1, or REJECTED with corrections. |
| 3 | M3 Remove discovery-only implementation | Authorized only after M2 approves M1. Remove engine, messages, bundle step, and discovery-only UI/scripts once no production caller remains. | No production reference to discovery entry points. `npm run build` passes without `build:extension-discovery`. Regression checks still pass. Stored `login_url` unchanged by the removal. |
| 4 | M4 Legacy data cleanup | Not authorized in this plan. | Separate CEO-approved change. Not this phase increment. |

## Detailed Development Plan

### M1 — authorized now

Do not start M3. Do not add migrations. Do not drop columns, RPCs, or metadata keys. Do not null `login_url`.

#### 1. User custom create
- `src/AddSiteModal.tsx`, `src/ManageServices.tsx`, `src/catalog/customService.ts`, `src/App.tsx`.
- Keep website URL required and HTTPS-validated.
- Add checkbox «דף הכניסה זהה לכתובת האתר», default checked.
- If checked: persist `loginUrl` equal to the website URL, `loginEntryType=primary_page`, `loginUrlSource=user`, `login_url_status=valid`.
- If unchecked: require «כתובת כניסה» before save. Persist that URL, `loginEntryType=direct_url`, `loginUrlSource=user`, `login_url_status=valid`. Reject save if the URL is empty. Do not guess a URL.
- Remove discovery progress copy («מוסיף את האתר…» discovery wait, discovery success/failure messages that mention finding a login page or reloading the extension for discovery).
- `App` add path must upsert the row with the explicit login entry and must not call `discoverLoginForRegistryService` or `recordLoginDiscoveryPipelineFailure`.
- Create must succeed when the extension is absent.
- Must not update any `owner_user_id IS NULL` login field.

#### 2. User custom edit
- On the existing service-management surface for that user's custom service, allow the same control and Login URL field. Do not add a new product area.
- Edit default: if stored `loginUrl` is null or equal to the website URL, checkbox on. If `loginUrl` differs, checkbox off and show the stored Login URL. Do not crawl to decide the default.
- Save uses the same persist rules. Do not call discovery.
- Opening edit must not change stored `login_url` until the user saves.

#### 3. Admin global create and edit
- `src/admin/RegistryAdmin.tsx`, `src/admin/adminRegistryApi.ts`.
- Create must not call `createGlobalRegistryRowWithDiscovery` or show «שומר אתר ומחפש דף כניסה…».
- Persist administrator name, primary URL, login entry type, and login URL, then stop.
- Add an explicit entry-type control: `primary_page` («כניסה מדף הבית») and `direct_url` («כתובת כניסה ייעודית»).
- `primary_page`: set `login_url` equal to primary URL, `loginEntryType=primary_page`, `loginUrlSource=admin`, `login_url_status=valid`.
- `direct_url`: Login URL required. Persist it, `loginEntryType=direct_url`, `loginUrlSource=admin`, `login_url_status=valid`.
- Edit uses the same rules. Changing primary URL or login URL must not start discovery.
- Main-form save must set `loginUrlSource=admin` and `login_url_status=valid` when the administrator saves an entry. Today `updateGlobalRegistryRow` does not. Fix that without a discovery call.
- Do not call `discoverLoginForRegistryService`, `adminTriggerLoginRediscovery`, or `adminBulkRefreshLoginUrls` from any reachable UI.

#### 4. Admin manual login URL panel
- `src/admin/LoginUrlRefresh.tsx`: keep manual save of Login URL. Remove the «גילוי מחדש» button and its handler.
- Manual save remains `adminUpdateLoginUrl` / RPC `admin_update_login_url` for the URL write.
- Do not add discovery outcome fields on the client follow-up (`loginUrlDiscoveryOutcome`, `lastDiscoveryOutcome`, `loginUrlDiscoveryAttempted`, `discoveryMethod`). Set `loginUrlSource=admin` and `login_url_status=valid`.
- If the existing RPC still stamps discovery-shaped keys and that cannot be stopped without a migration, do not add a migration in M1. Record the residual RPC write in `dev-phase108.md`. It must not start discovery and must not change credentials. Do not delete historical keys.

#### 5. Approval / promote
- `src/admin/ApprovalQueue.tsx`: call `promoteUserSubmission` only. Do not call `promoteUserSubmissionWithDiscovery`.
- No «מאשר ומחפש דף כניסה…» state.
- Administrator confirms the global login entry explicitly. Prefill from the user row is allowed only as editable input on the global row. Saving the global row must not rewrite the user-owned row.

#### 6. Registry insert metadata
- `src/registry/registryMapper.ts` `serviceDefinitionToRegistryInsert`: do not write `loginUrlDiscoveryOutcome` or `loginUrlDiscoveryAttempted` as if discovery ran. Write explicit `loginUrlSource` and `loginEntryType` from the definition.

#### 7. Discovery UI that must disappear in M1 even if engine files remain
- Bulk button «רענון כניסה מרוכז» and «דרוס עריכות מנהל» in `RegistryAdmin.tsx`.
- Rediscover button.
- Create/approve discovery progress text.
- `IntegrationStatusPanel.tsx`: do not present discovery outcome, confidence, method, or raw discovery payload as a live product status. May still show `login_url` and `primary_url`.

#### 8. Do not break retained behavior
- Do not edit `src/browserIntegration/**` except if a compile break is caused by an import the Developer must stop using. Do not remove the abstraction.
- Do not change `executeServiceFromTile` orchestration except to ensure it does not import discovery. Open URL remains `loginUrl`, else primary URL for legacy null.
- Do not change credential modules, auth, vault encryption, adapters' fill behavior, `src/serviceAssets/discovery.ts`, or `src/serviceManagement/discoveryFilter.ts`.
- Do not change `ensure_known_builtin_registry_row` coalesce behavior.
- Do not remove `src/discovery/**`, extension discovery messages, or `build:extension-discovery` in M1. `npm run build` may still run that step until M3.

### M3 — not authorized until M2 approves M1

After Manager approval only:

- Confirm no production caller of `discoverLogin`, `discoverLoginForRegistryService`, `discoverAndPersistLoginUrl`, `HUB_LOGIN_ENTRY_DISCOVERY`, or `HUB_DISCOVERY_FETCH_HTML`.
- Then remove the architecture REMOVE list: `src/discovery/**`, `src/extension/discoveryPageEntry.ts`, generated `extension/discovery/login-entry-discovery.js`, `scripts/buildExtensionDiscovery.mjs`, discovery branches only in `extension/background.js`, `src/registry/bulkLoginUrlRefresh.ts`, `src/registry/loginUrlClearPolicy.ts`, `src/catalog/customServiceDiscovery.ts`, discovery persist functions in `src/registry/loginUrlDiscovery.ts`, DiscoveryHarness and its route, and discovery-only scripts as release gates.
- Detach `build:extension-discovery` from `package.json` `build`.
- Do not null `login_url`. Do not drop database objects. That is M4, not authorized.

### M4 — out of scope
Legacy metadata, discovery RPCs, and `catalog_seed` mapping are a later approved change. Do not include them in M1 or M3.

## Acceptance / Gating Criteria

M1 is not complete unless all of the following are true:

| ID | Gate |
|---|---|
| AC-108-1 | Admin can set name, primary URL, login URL, and login entry type on a global service. |
| AC-108-2 | No automatic path overwrites an administrator login URL. |
| AC-108-3 | User custom service has an explicit login entry. |
| AC-108-4 | Same-as-website control defaults on and sets `loginUrl` to the website URL. |
| AC-108-5 | Separate Login URL is required when the control is off. Empty save is rejected. |
| AC-108-6 | Admin create, user add, and promote do not call discovery. |
| AC-108-7 | Admin edit and user edit do not call discovery. |
| AC-108-8 | Null `login_url` does not start discovery. Open uses primary URL. |
| AC-108-9 | No rediscover, bulk refresh, background, or retry discovery from product UI. |
| AC-108-10 | User save does not update global login fields. Global save does not update user-owned login fields. |
| AC-108-11 | Extension-absent open still works. Discovery messages are not required for open. |
| AC-108-12 | Tile open uses stored `loginUrl`, or primary URL only for legacy null. |
| AC-108-13 | No credential row or vault blob writes in this change. |
| AC-108-14 | No auth/session/encryption edits. |
| AC-108-15 | `npm run build` passes. |
| AC-108-16 | `primary_page` stores `loginUrl` equal to the website/primary URL. |
| AC-108-17 | `direct_url` cannot save without a Login URL. |
| AC-108-18 | Writes are scoped by `owner_user_id`. |
| AC-108-19 | Open and autofill do not read discovery confidence or method. Phase 112 is not changed to require discovery hints. |
| AC-108-20 | Icon discovery and `filterDiscoveryServices` still exist and are not deleted as "discovery". |

Withdrawn discovery acceptance criteria are not gates.

## Functional Testability Criteria

- Page/screen the user can open: Add Site modal; custom-service edit on Manage Services; Admin catalog create/edit; Digital Home tile.
- User-visible behavior: Hebrew same-as-website checkbox default on; separate Login URL field when off; admin entry-type control; no "searching for login page" state; no discovery tab flash on add.
- Command-line flow: `npm run build`.
- API endpoint / request: registry insert/update sets `login_url`, `login_url_status=valid`, and metadata `loginUrlSource` plus `loginEntryType`. Request must not call discovery RPCs (`persist_discovered_login_url`, `persist_login_discovery_review`).
- Minimal end-to-end flow: add custom site with checkbox on; add another with checkbox off and a distinct Login URL; create global service with administrator `direct_url`; edit each without a discovery call; open each tile.
- Expected observable result: stored `login_url` equals the human value; source is `user` or `admin`; open uses that URL; a pre-existing stored `login_url` is unchanged if that service was not edited.

## Required Developer Evidence

Record in `team-yuri/dev-phase108.md` only. Do not treat the previous discovery evidence in that file as M1 evidence. Replace or clearly supersede it so withdrawn discovery claims are not the completion record.

Required:
- Files changed, limited to the M1 boundary.
- Confirmation that M3 files were not deleted.
- Confirmation that no migration was added and no `login_url` was nulled.
- Commands and results: `npm run build` PASS. There is no lint script in `package.json`. Document `Lint: NOT AVAILABLE` and why (`package.json` has no lint script). Unit-test framework: document `Unit tests: NOT AVAILABLE` if none exists, and what was verified instead.
- Static evidence that product UI and add/create/edit/promote paths do not reference `discoverLogin`, `discoverLoginForRegistryService`, `discoverAndPersistLoginUrl`, `adminTriggerLoginRediscovery`, or `adminBulkRefreshLoginUrls`.
- Functional notes for AC-108-1, AC-108-4, AC-108-5, AC-108-6, AC-108-12, AC-108-16, AC-108-17: what was clicked and what was stored.
- Docs: user-visible behavior changed. State whether `README.md` or `docs/` was updated, or why not. `docs/MIGRATION_PHASE_108.md` describes withdrawn discovery. Do not treat it as the contract. A short note that discovery is not the MVP path is enough if that file is updated. Do not rewrite it into a second architecture.
- Residual RPC stamp, if any, recorded as a known limitation for a later change. Not a reason to add a migration in M1.

## Out of Scope
- Deleting `src/discovery/**`, extension discovery messages, or the discovery build step (M3, after review).
- Migrations, dropping RPCs, deleting metadata keys, mapping `catalog_seed` to `admin`, nulling `login_url` (M4, not authorized).
- PayPal/Zap/KSP discovery work, M16, audience gates, probes.
- Authentication, credentials, vault encryption.
- Phase 111 icon discovery and Phase 112 classifier redesign.
- `filterDiscoveryServices` behavior changes.
- `executeServiceFromTile` redesign.
- New canonicalization (Phase 116).

## Risks / Open Questions
- `admin_update_login_url` may still write discovery-shaped metadata. M1 does not migrate it. Residual write must be documented and must not invoke discovery.
- `npm run build` still runs `build:extension-discovery` until M3. A failing discovery bundle step still fails the build in M1. Do not remove the step in M1 to make the build pass unless the bundle script is broken by an M1 import change, in which case stop and report. Do not expand scope.
- Existing `dev-phase108.md` discovery evidence must not be reused as M1 completion.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
Plan written 2026-09-14 after CEO approval of the revised architecture. Developer handoff is M1 only.

### Required Corrections
None for this plan. Developer must not implement withdrawn discovery requirements from the previous version of this file.
