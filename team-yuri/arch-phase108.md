# Architecture Phase 108

## Phase Identifier
PHASE=108

## Status
STATUS: READY_FOR_MANAGER

Implementation must not start until the CEO accepts this revision. Do not hand this phase to the Developer from this document alone.

## Title
Phase 108 — Browser Integration and Explicit Login Entry Management

## Phase Goal
Deliver two independent capabilities:

1. **Browser Integration** — a stable Hub contract for Chrome and Edge (availability probe, messaging, open-URL/tab helpers) and graceful Hub behavior when the extension is absent.
2. **Explicit Login Entry Management** — a human-owned login entry point for each service. The administrator owns global/catalog login entries. The user owns login entries for private custom services.

Automatic Login Discovery is not a Phase 108 responsibility and is not an MVP capability.

## Architectural Purpose
Phase 108 exists so Digital Home can open a service at a login entry that a person configured, and so execution/autofill can use the browser through one abstraction. It does not exist to find, infer, crawl, rank, or replace that entry.

Browser Integration and Explicit Login Entry Management do not depend on each other. Removing or never invoking discovery must not disable the browser abstraction. Configuring a login entry must not require the extension.

## Scope

In scope:

- Browser host abstraction used by Hub feature code (`src/browserIntegration/`, `src/execution/extensionBridge.ts`).
- Chrome and Edge as production browser hosts sharing that abstraction.
- Graceful open-URL behavior when the extension is unavailable.
- Explicit create/edit of login entry data for global catalog services (administrator) and user-created custom services (user).
- Deterministic open behavior when a dedicated login URL is absent: use the primary/website URL. No search fallback.
- Ownership isolation between global catalog login metadata and user-owned custom-service login metadata.
- Persistence of core login-entry fields on `service_registry` without discovery writes.

Out of scope for this revision's implementation authority: this document does not authorize code deletion, migrations, or runtime changes. Those follow only after CEO acceptance and a Manager plan.

## Architectural Principles

- A login entry point is explicit. A person provides it, or explicitly chooses that the website URL is the login entry.
- The system must not crawl, infer, guess, rank, or automatically replace a login URL.
- Creation, update, URL change, a missing login URL, and validation failure must not start discovery.
- Global and user-owned login metadata are isolated. Neither silently replaces the other.
- Browser Integration remains valid with zero discovery messages and zero discovery tabs.
- Existing stored `login_url` values are retained. Removal of discovery does not null them.
- Credential data and authentication are untouched by this phase revision.

## Architecture History
Automatic Login Discovery was an approved responsibility of the previous Phase 108 architecture (DiscoveryExecutor, audience gates, probes, rediscovery, bulk refresh, discovery metadata). It was removed from the MVP baseline after product-scope reassessment (2026-09-14). The previous implementation must not be treated as the approved architecture for any future Login Discovery. If Automatic Login Discovery is reconsidered, it requires a new architectural review and must not automatically reuse the previous implementation. Historical changelog rows in `team-yuri/PLAN.md` that describe discovery milestones remain historical. They are not active requirements.

## Source References
- Prior Phase 108 contract in this file (discovery baseline, superseded).
- Read-only dependency audit of the current implementation (2026-09-14). Evidence files cited in Engineering Change Boundary.
- `team-yuri/PLAN.md` Phase 108 section (to be kept aligned with this contract).
- `src/browserIntegration/`, `src/execution/extensionBridge.ts`, `src/execution/serviceExecution.ts`, `src/service/legacyService.ts` `getServiceOpenUrl`.
- `service_registry.login_url`, `login_url_status`, `metadata` as implemented. Do not infer a second store.

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-108-1: Browser Integration Abstraction (retained)** | Execution, autofill, adapters, and login assistance already call the Hub browser contract. | `src/browserIntegration/` and `src/execution/extensionBridge.ts` remain. Feature code does not scatter raw `chrome.*`. Chrome and Edge share the Chromium host adapter. Discovery is not a client of this contract in the MVP. |
| **D-108-2: Chrome + Edge production targets (retained)** | Existing packaging commitment. | Extension remains the host for execution/autofill messages. Store packaging differences stay documented for operators. No discovery message is required for packaging. |
| **D-108-3: Graceful Hub degradation (retained)** | AC-108-11. | When the extension is unavailable, Digital Home still opens the configured entry with `window.open` / `openUrlInNewTab` and friendly Hebrew guidance. Service create/edit succeeds without the extension. |
| **D-108-4: No Automatic Login Discovery (normative)** | MVP product decision, final. | Create, update, approval/promote, open, background, retry, and bulk paths must not call a discovery engine, open a discovery tab, or replace `login_url` from inferred candidates. |
| **D-108-5: Human-owned login entry** | Administrator is authoritative for global catalog rows. The creating user is authoritative for that user's private custom row. | Automatic logic must not overwrite a stored login entry. There is no `force` overwrite flag in the MVP. |
| **D-108-6: Two login entry types only** | Phase 112's read of discovery `loginEntryType` (`navigable` / `modal` / `unknown`) is a soft seed, not a hard dependency. `classifyLoginIntelligence` does not invent `loginUrl` and operates without those hints. | Active values are `direct_url` and `primary_page` only. Discovery classifications are not active requirements. |
| **D-108-7: Explicit same-as-website default for custom services** | Users currently cannot enter a login URL; add always discovered. MVP must not leave a hole that discovery used to fill. | Custom add defaults "Login page is the same as the website URL" to enabled. Enabled writes `loginUrl` equal to the website URL and `loginEntryType=primary_page`. Disabled requires a separate Login URL and `loginEntryType=direct_url`. |
| **D-108-8: Global login entry is administrator input** | Admin create/edit already has Primary URL and optional Login URL fields, but create then overwrites via discovery. | Create and edit persist the administrator's values and stop. If the administrator chooses `primary_page`, persist `loginUrl` equal to Primary URL. If `direct_url`, Login URL is required. |
| **D-108-9: Missing dedicated URL is a deterministic open fallback, not a trigger** | `getServiceOpenUrl` already uses `loginUrl ?? url`. | New writes must not leave a "please discover" gap: `primary_page` stores the primary URL as `loginUrl`. Legacy rows with null `login_url` open the primary URL and must not start discovery. No search fallback. |
| **D-108-10: Ownership isolation** | User and global rows already differ by `owner_user_id`. Discovery persist could write both. | A user-created save updates only that user's row. A global save updates only `owner_user_id IS NULL` rows. Global metadata never overwrites a user-owned row. A user save never updates global catalog login fields. |
| **D-108-11: `loginUrlSource` is ownership, not a discovery method** | Today `auto` / `catalog_seed` / `unknown` interact with overwrite gates that exist only because discovery writes. | Active writes: `admin` or `user` only. Do not write `auto`, `discovered`, or `unknown`. |
| **D-108-12: Approval does not discover** | `promoteUserSubmissionWithDiscovery` always runs discovery after promote. | Promote/approve must not call discovery. The administrator sets the global login entry explicitly. The approval UI may prefill from the user-owned row's already stored explicit fields for the administrator to confirm or edit. Saving the global row must not mutate the user-owned row. |
| **D-108-13: Stop writing discovery metadata; do not delete columns yet** | Live rows may contain discovery keys. Nulling `login_url` would change open and autofill. | Classified in Data / State. No migration in this architecture task. Cleanup is a later candidate after implementation no longer reads or writes those keys. |
| **D-108-14: Phase 112 does not require discovery seeds** | Verified soft dependency only (`signalsFromDiscoveryMetadata`). | Phase 108 must not write `phase112Deferred`, `loginIntelligenceHint`, discovery `usesModal`, or discovery `loginEntryType`. Phase 112 classifies from its own signals. Missing discovery hints are not a defect. |
| **D-108-15: No execution-pipeline redesign** | Open and autofill already consume stored `loginUrl`. | Do not change `executeServiceFromTile` orchestration except to guarantee it never calls discovery. Open URL remains the explicit login entry, else primary URL for legacy nulls. |
| **D-108-16: Build must not require the discovery bundle** | `package.json` `build` runs `build:extension-discovery` first. | Engineering must detach that step when the bundle is no longer produced. This document does not perform that change. |

### Superseded decisions
D-108-4 through D-108-32 of the previous discovery contract (single discovery pipeline, DiscoveryExecutor, audience gates, probes, bulk refresh, PayPal deferral, discovery tab focus) are **withdrawn**. They are not amended. They are not active. Do not implement M16 or any discovery follow-up under this phase number.

## Browser Integration responsibilities

Retained:

- Probe extension availability.
- Send extension messages used by execution, generic autofill, adapters, and login assistance.
- Open a URL in a new tab, or fall back to a window open when the extension is absent.
- Chrome and Edge host adapter.
- Extension background handling for non-discovery messages (`POC_GENERIC_FILL`, `POC_GENERIC_DETECT`, `POC_IDENTITY_FIRST_FILL`, adapter fill messages, practice fill).

Not a Browser Integration responsibility:

- `HUB_LOGIN_ENTRY_DISCOVERY`
- `HUB_DISCOVERY_FETCH_HTML`
- Discovery tabs, discovery windows, discovery injection retries
- Any executor whose purpose is to inspect third-party DOM to find a login URL

Browser Integration must keep working if those discovery messages are absent.

## Global / Catalog Login Entry behavior

The administrator is authoritative for `owner_user_id IS NULL` services.

The administrator must be able to maintain:

- Service name
- Primary URL (required)
- Login URL
- Login Entry Type (`direct_url` or `primary_page`)

Rules:

- Create persists the administrator's values and returns. It must not search for a login page afterward.
- Edit persists the administrator's values and returns. Changing Primary URL or Login URL must not start discovery.
- `primary_page`: persist `loginUrl` equal to Primary URL, `loginEntryType=primary_page`, `loginUrlSource=admin`, `login_url_status=valid`.
- `direct_url`: Login URL is required, must be a valid URL under existing admin URL rules, `loginEntryType=direct_url`, `loginUrlSource=admin`, `login_url_status=valid`. It may differ from Primary URL.
- Validation failure rejects the save. It must not fall back to discovery.
- No rediscovery control. No bulk login refresh. No "discover login" control.
- An empty dedicated Login URL is not a discovery signal. For new saves, the administrator chooses `primary_page` instead of leaving the entry unspecified.
- Existing rows with null `login_url` remain openable via Primary URL until an administrator saves an explicit entry. Do not backfill them by crawling.

## Custom Service Login Entry behavior

The creating user is authoritative for that private service (`owner_user_id` set, `source_type=user`).

The add and edit interaction must include:

- Website URL (required, existing HTTPS primary-URL validation)
- Control: "Login page is the same as the website URL"
- Default: enabled

If enabled:

- `loginUrl` = website URL
- `loginEntryType` = `primary_page`
- `loginUrlSource` = `user`
- `login_url_status` = `valid`

If disabled:

- The user must provide a separate Login URL before save.
- `loginEntryType` = `direct_url`
- `loginUrlSource` = `user`
- `login_url_status` = `valid`
- Example: website `https://example.com`, control off, login URL `https://example.com/login`

The system must not guess a missing Login URL. Service creation still succeeds when the user completes the explicit fields, including when the extension is absent. There is no discovery failure message.

Edit of a custom service must allow the same choice. Edit must not call discovery. When opening edit for an existing row: if `loginUrl` is null or equal to the website URL, the control defaults to enabled; if `loginUrl` differs, the control defaults to off and shows the stored Login URL. Saving applies the same persist rules. Do not crawl to decide the default.

## Login URL ownership

| Record | Owner | Who may write `login_url` / `loginUrlSource` / `loginEntryType` |
|---|---|---|
| Global / catalog (`owner_user_id IS NULL`) | Administrator / Global Catalog | Administrator saves only |
| User-created custom (`owner_user_id` = that user) | That user | That user, or an administrator editing that submission through the admin user-row editor without copying the write onto other rows |

A user-created save must never modify global Service Registry login metadata.

A global save must never silently replace user-owned custom-service login metadata.

Promotion to the global catalog creates or updates a **global** row under administrator authority. It must not run discovery. Prefill from the user row is allowed only as administrator-confirmed input on the global row. It must not rewrite the user-owned row as a side effect.

## Login Entry Types

Active MVP values, stored as `metadata.loginEntryType`:

- `direct_url` — dedicated login URL, supplied by the owner. Open target is that URL.
- `primary_page` — login begins from the service primary/website page (including a button or modal on that page). Open target is the website URL, stored as `loginUrl` so open does not depend on a null check to mean "please discover".

Not active:

- `navigable`, `modal`, `unknown` as discovery classifications
- `usesModal`, `phase112Deferred`, `loginIntelligenceHint` as Phase 108 outputs
- Audience / consumer-vs-business portal classification
- Confidence scores

Phase 112 may still classify modal and complexity from its own detection. It must not require Phase 108 to have classified them. Existing stored discovery values are legacy. Do not delete them in this task. Do not write them on new saves.

## Data / State Considerations

Core MVP login data (retain and keep writing):

- `service_registry.primary_url` — website / home URL
- `service_registry.login_url` — explicit login entry URL
- `service_registry.login_url_status` — column retained. Active writes: `valid` for a human-saved entry. Legacy null entries may remain `unknown` until a human saves. Explicit administrator "mark stale" may continue to write `stale` if that control remains an administrator action, not a discovery result.
- `metadata.loginUrlSource` — active writes `admin` or `user` only
- `metadata.loginEntryType` — active writes `direct_url` or `primary_page`

Obsolete discovery metadata — do not delete in this task:

| Field | Classification |
|---|---|
| `login_url`, `primary_url` | Retain for MVP |
| `login_url_status` column | Retain for MVP. Stop writing `needs_review`, `failed`, `missing` as discovery outcomes. |
| `loginUrlSource=admin` / `user` | Retain for MVP |
| `loginUrlSource=catalog_seed` | Legacy / migration candidate. Existing Hapoalim seed. Treat as explicit catalog data, not discovery. Do not overwrite. Do not write new `catalog_seed` values. Later migration may map to `admin`. Not an immediate delete. |
| `loginUrlSource=auto` / `unknown` / `discovered` | Stop Writing. Legacy / migration candidate. Must not authorize any automatic replacement. |
| `loginUrlConfidence`, `discoveryMethod`, `loginUrlLastDiscoveredAt`, `loginUrlLastCheckedAt`, `loginUrlDiscoveryError`, `loginUrlDiscoveryOutcome`, `loginUrlDiscoveryAttempted`, `lastDiscoveryOutcome`, `rawExtensionDiscovery`, `rejectedLoginUrl` | Stop Writing. Legacy / migration candidate. Safe removal candidate only after runtime no longer reads them and after development data is handled. |
| Discovery `loginEntryType` values `navigable` / `modal` / `unknown` | Stop Writing. Legacy. Active contract replaces them on the next human save. |
| `phase112Deferred`, `loginIntelligenceHint` written by discovery | Stop Writing from Phase 108. Phase 112 must not require them. Do not delete stored values in this task. |
| `usesModal` | Shared with Phase 112 Login Intelligence, which also writes it. Phase 108 must stop writing it. Not a safe removal candidate. |
| RPC `persist_discovered_login_url` | Stop calling. Legacy. Gate still mentions `invalid`, which Phase 108 mapped to `stale`. Do not drop until no caller remains. |
| RPC `persist_login_discovery_review` | Stop calling. Legacy / future removal candidate after callers are gone. |
| RPC `admin_update_login_url` | Retain for explicit administrator saves. Must no longer be used as a discovery success path. Must not stamp discovery success metadata on a non-discovery write. |
| RPC `ensure_known_builtin_registry_row` | Do not touch. Coalesces `login_url` and must not start discovery. |
| No discovery history table exists | Nothing to drop. `lastDiscoveryOutcome` is a single object, not a log. |

`login_fields` and credential storage are not discovery data. Do not modify them as part of removing discovery.

## Security / Privacy / Validation boundaries

- Login URL and website URL are explicit inputs. Validate format. Reject empty when the entry type requires a dedicated URL. Do not "repair" an invalid URL by searching the site.
- Custom website URL remains HTTPS under the existing custom-URL validation. A separate custom Login URL uses the same URL validity rules as the service model (http(s) URL). Do not invent a new canonicalization engine (Phase 116).
- No third-party page fetch for the purpose of finding a login page.
- No credentials in login-entry save paths.
- No service-role key in the client.
- Discovery logs and raw page payloads must not be written on new saves. Existing `rawExtensionDiscovery` is legacy data, not a new collection surface.
- Global writes stay on global rows. User writes stay on that user's rows. RLS/RPC ownership checks must not be weakened to remove discovery.

## Relationship to other phases

| Phase | Relationship after this revision |
|---|---|
| 102 Service Registry | Owns the table. Phase 108 defines which login fields are active MVP data. |
| 103 Execution | Opens `loginUrl` when set, else primary URL for legacy nulls. Must not call discovery. |
| 104 Service Management | Custom add/edit collects explicit login entry. Catalog search named "discovery" (`filterDiscoveryServices`) is unrelated and must remain. |
| 105 Digital Home | Tile open unchanged. No discovery on click. |
| 107 Admin | Admin UI maintains explicit login entry. Must not expose rediscovery or bulk login discovery as MVP behavior. |
| 109 Accounts | No change to authentication. Regression only. |
| 110 Autofill | Consumes an explicitly stored `loginUrl` (or login fields). Does not require that the URL was discovered. Must not propose silent `loginUrl` replacement. |
| 111 Service Assets | Icon discovery is a different pipeline (`src/serviceAssets/discovery.ts`). Unaffected. Must not be removed because of the shared word "discovery". |
| 112 Login Intelligence | Authoritative for complexity classification. Must not depend on Phase 108 discovery hints. Must not invent `loginUrl`. |
| 113 Login assistance | Uses stored `loginUrl`, else home URL. No discovery. |
| 116 URL identity | Not this phase. |

## Regression protection

Removal of Login Discovery must not change:

- Creating a global service (persist administrator fields; succeed if extension is absent)
- Editing a global service
- Creating a custom service (explicit fields; row created without a discovery step)
- Editing a custom service
- Opening a service (`executeServiceFromTile` / `getServiceOpenUrl`)
- Browser Integration used by open, autofill, and adapters
- Digital Home tile behavior
- Service Registry identity, category, and non-login fields
- Authentication and session (Phase 109)
- Credential storage and vault encryption
- Autofill eligibility based on already stored `loginUrl` or `loginFields`
- Service ownership and global/user isolation
- Icon assets (Phase 111)
- Existing stored `login_url` values, including catalog seeds

## Non-goals

The MVP does not include:

- Automatic login-page discovery
- Crawling websites to locate login pages
- Guessing or inferring login URLs
- Discovery confidence scoring
- Automatic rediscovery
- Bulk login discovery
- Background or scheduled login discovery
- Automatic portal or audience determination
- AI-based login-page discovery
- Automatic validation of a login URL by running discovery
- DiscoveryExecutor, discovery tabs, candidate ranking, common-path invention, trusted-auth probes, federated IdP accept/reject
- `needs_review` caused by discovery
- `loginUrlSource=auto`
- PayPal/Zap/KSP discovery milestones (withdrawn, including deferred M16)
- Credential lifecycle, autofill expansion, login-intelligence redesign, URL canonicalization, or admin chrome redesign beyond removing discovery controls

## Constraints / Non-Negotiables

- Do not delete Phase 108.
- Do not renumber later phases.
- Do not null historical `login_url` while removing discovery.
- Do not drop database columns or discovery metadata in the same change that detaches the engine, unless a later approved migration follows verified unused state.
- Do not treat `src/serviceAssets/discovery.ts` or `filterDiscoveryServices` as Login Discovery.
- Do not modify credential rows.
- Service creation must not depend on the extension.

## Technical Boundaries / Out of Scope

See Non-goals. In addition, this architecture task does not authorize edits to application source, migrations, Manager artifacts, or Developer artifacts.

## Testing and Lint Expectations

When engineering is later authorized:

- `npm run build` passes after the discovery bundle is detached from the build if that bundle is removed.
- No production path references `discoverLogin`, `discoverLoginForRegistryService`, `discoverAndPersistLoginUrl`, `HUB_LOGIN_ENTRY_DISCOVERY`, or `HUB_DISCOVERY_FETCH_HTML`.
- Existing execution and autofill regression checks still pass.
- No new discovery tests are required. Discovery-only scripts are not a release gate.

This document does not run those checks.

## Functional Testability

- Page/screen: Admin catalog create/edit; user Add Site (and custom edit); Digital Home tile open.
- User-visible behavior: administrator sets name, primary URL, login entry type, and login URL. User sees the same-as-website control defaulting on, and a separate Login URL field when off. No "searching for login page" state. No discovery tab.
- Command-line flow: not the acceptance path. Build pass is a later engineering gate (AC-108-15).
- API endpoint / request: registry insert/update of `login_url` and ownership metadata. No discovery RPC on those requests.
- Minimal end-to-end flow: create custom site with same-as-website on; create another with a distinct login URL; create global service with an administrator login URL; open each tile; confirm no discovery message and no overwrite after edit.
- Expected observable result: stored `login_url` equals the human-provided value; `loginUrlSource` is `user` or `admin`; open uses that URL.

## Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-108-1 | Global catalog services support an administrator-defined login entry point (name, primary URL, login URL, login entry type). |
| AC-108-2 | Administrator-provided login URLs are never overwritten by automatic discovery. No automatic discovery path exists. |
| AC-108-3 | User-created custom services support an explicitly defined login entry point. |
| AC-108-4 | For a custom service, the user can specify that the website URL is also the login entry point. That control defaults to enabled and sets `loginUrl` equal to the website URL. |
| AC-108-5 | A user can provide a separate login URL when the login entry point differs from the website URL. Save is rejected if that URL is missing while the control is off. |
| AC-108-6 | No service creation flow performs Login Discovery, including admin create, user add, and approval/promote. |
| AC-108-7 | No service update flow performs Login Discovery. |
| AC-108-8 | Missing Login URL information never triggers Login Discovery. Legacy null `login_url` opens the primary URL. |
| AC-108-9 | No background, bulk, retry, or rediscovery Login Discovery executes. |
| AC-108-10 | Global and user-owned login metadata remain isolated. A user save does not update global login fields. A global save does not update user-owned login fields. |
| AC-108-11 | Browser Integration continues to operate independently of Login Discovery, including when discovery messages are absent, and Hub open still works without the extension. |
| AC-108-12 | Opening a service uses explicitly configured login-entry metadata (`loginUrl`), or the primary URL only as the documented legacy/primary-page fallback. |
| AC-108-13 | Removal of Login Discovery does not modify credential data. |
| AC-108-14 | Removal of Login Discovery does not alter authentication. |
| AC-108-15 | After later engineering implementation, build and existing execution/autofill regression validation pass. |
| AC-108-16 | `primary_page` persists `loginUrl` equal to the primary/website URL without crawling or inference. |
| AC-108-17 | `direct_url` requires a human-provided Login URL. |
| AC-108-18 | User custom save and admin global save cannot cross-write the other ownership class (verified against `owner_user_id`). |
| AC-108-19 | Phase 112 classification does not require `phase112Deferred` or discovery `loginIntelligenceHint`. Opening and autofill do not require discovery confidence or method. |
| AC-108-20 | Phase 111 icon discovery and catalog search (`filterDiscoveryServices`) remain functional. They are not Login Discovery. |

Previous AC-108-1 through AC-108-26 that required discovery, rediscovery, bulk refresh, audience gates, or discovery-tab behavior are withdrawn.

## Required engineering deliverables

Not authorized until CEO accepts this revision and the Manager plans the work. When authorized, engineering must:

1. Stop calling discovery from user add, admin create, admin edit, and promote/approve.
2. Add the custom-service same-as-website control and separate Login URL field; persist the rules in D-108-7.
3. Make admin create/edit persist explicit login entry without a follow-up discovery call; set `loginUrlSource=admin` on that save.
4. Remove discovery-only UI (rediscover, bulk login refresh, discovery progress, discovery diagnostics that exist only for the engine).
5. Leave Browser Integration, execution messages, and icon discovery in place.
6. Stop writing obsolete discovery metadata. Do not delete columns or historical keys in the first implementation change.
7. Detach the discovery bundle from `npm run build` if the bundle is removed.
8. Prove AC-108-1 through AC-108-20 without changing credentials or authentication.

## Engineering Change Boundary

### A. RETAIN
Required for the MVP.

- `src/browserIntegration/**`, `src/execution/extensionBridge.ts`
- Extension messages other than discovery: `POC_GENERIC_FILL`, `POC_GENERIC_DETECT`, `POC_IDENTITY_FIRST_FILL`, `POC_FILL_DEMO`, `POC_FILL_IL` in `extension/background.js`
- `service_registry.primary_url`, `service_registry.login_url`, `service_registry.login_url_status`
- `getServiceOpenUrl` in `src/service/legacyService.ts`; `executeServiceFromTile` in `src/execution/serviceExecution.ts`
- `shouldAttemptGenericAutofill` in `src/execution/autofillEligibility.ts` (consumes stored `loginUrl`; do not require discovery)
- Admin catalog fields for name, primary URL, login URL in `src/admin/RegistryAdmin.tsx`
- `adminUpdateLoginUrl` / RPC `admin_update_login_url` as the explicit administrator save path only
- `createGlobalRegistryRow`, `updateGlobalRegistryRow`, `updateUserOwnedRegistryRow` (without discovery wrappers)
- `src/catalog/builtinCatalog.ts` explicit `loginUrl` seeds
- `ensure_known_builtin_registry_row` coalesce behavior
- `src/serviceManagement/discoveryFilter.ts` (catalog search)
- `src/serviceAssets/discovery.ts` and admin icon refresh (Phase 111)
- Authentication and credential modules

### B. MODIFY
Required by the MVP, currently coupled to Login Discovery.

- `src/App.tsx` custom add: keep upsert; remove `discoverLoginForRegistryService` and `recordLoginDiscoveryPipelineFailure`. Add explicit login-entry persistence.
- `src/AddSiteModal.tsx` and `src/ManageServices.tsx`: add same-as-website control and optional separate Login URL. No discovery progress copy.
- `src/catalog/customService.ts` `createCustomServiceDefinition`: accept explicit login entry; do not leave `loginUrl` unset for new creates under the new rules.
- `src/admin/adminRegistryApi.ts`: `createGlobalRegistryRowWithDiscovery` and `promoteUserSubmissionWithDiscovery` must become explicit saves. `adminTriggerLoginRediscovery` and `adminBulkRefreshLoginUrls` must not remain reachable. `adminUpdateLoginUrl` must set ownership metadata without discovery outcome theater that implies a discovery run. Main-form save must set `loginUrlSource=admin` and `login_url_status=valid` when the administrator saves an entry.
- `src/admin/RegistryAdmin.tsx` create path must not set discovering state or call the discovery wrapper. Remove bulk refresh control.
- `src/admin/LoginUrlRefresh.tsx`: keep manual login URL save; remove "גילוי מחדש".
- `src/admin/ApprovalQueue.tsx`: approve must not call `promoteUserSubmissionWithDiscovery`.
- `src/registry/registryMapper.ts` `serviceDefinitionToRegistryInsert`: stop writing discovery outcome keys as if discovery ran. Write explicit source and entry type.
- `package.json` `build` script: must not require `build:extension-discovery` once the bundle is unused.
- `src/admin/IntegrationStatusPanel.tsx`: stop presenting discovery outcome as a live product status. May still show `login_url` and `primary_url`.

### C. REMOVE
Exclusive to Automatic Login Discovery. Not architecturally required. Do not remove until CEO accepts and Manager sequences the work.

- `src/discovery/**` (engine, policy, audience gate, probes, executor, harness session)
- `src/extension/discoveryPageEntry.ts`
- Generated `extension/discovery/login-entry-discovery.js` and `scripts/buildExtensionDiscovery.mjs` after the build script no longer calls it
- `HUB_LOGIN_ENTRY_DISCOVERY` and `HUB_DISCOVERY_FETCH_HTML` branches in `extension/background.js` only
- `src/registry/bulkLoginUrlRefresh.ts`
- `src/registry/loginUrlClearPolicy.ts`
- `src/catalog/customServiceDiscovery.ts` once no caller remains
- `src/registry/loginUrlDiscovery.ts` discovery persist functions (`discoverAndPersistLoginUrl`, `recordLoginDiscoveryPipelineFailure`)
- `src/dev/DiscoveryHarness.tsx` and its route in `src/main.tsx`
- `scripts/verifyPhase108*.mjs`, `scripts/capturePhase108*.mjs`, `scripts/fixtures/phase108-*` as release gates
- Admin controls: rediscover, bulk login refresh, force-overwrite checkbox

### D. LEGACY DATA / CLEANUP CANDIDATE
Remove only after runtime dependencies and existing development data are handled.

- Metadata keys listed as Stop Writing / Legacy in Data / State
- RPC `persist_discovered_login_url`, `persist_login_discovery_review`
- Status values `needs_review`, `failed`, `missing` if no remaining reader and no rows require them
- `loginUrlSource=catalog_seed` mapping to `admin` (optional later migration; do not null `login_url`)
- Unused exports with no production callers: `discoverLoginForCustomService`, `markLoginUrlInvalid`, `registryRowNeedsDiscovery`, `buildInitialDiscoveryMetadata`, `mergeDiscoveryOntoKnownSeed`
- `src/discovery/execution/DISCOVERY_EXECUTION.md` (stale relative to implementation; not an active contract)

### E. DO NOT TOUCH
- Phase 109 authentication, session, vault encryption
- Credential tables and vault credential blobs
- `executeServiceFromTile` orchestration except to ensure it does not import discovery
- Adapter execute implementations except that they keep receiving the already resolved open URL
- Phase 111 asset tables, Storage, icon upload
- Phase 112 classification engine, except it must tolerate missing discovery hints (already true)
- `filterDiscoveryServices`
- `src/serviceAssets/discovery.ts`

## Handoff Notes for Manager

Do not start Developer work until the CEO accepts this revision.

When accepted:

- Plan implementation against this document, not against `manager-phase108.md` discovery milestones. That Manager artifact still describes withdrawn discovery work. The Architect does not edit Manager artifacts.
- Do not reopen PayPal M16 or discovery-gate churn.
- Do not delete historical `login_url` values.
- Sequence: stop invocation and add explicit UI persist first; remove engine and messages second; database cleanup last, in a separate approved change.
- Icon discovery and catalog search stay.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
2026-09-14. Phase 108 revised to Browser Integration and Explicit Login Entry Management. Automatic Login Discovery is withdrawn from the MVP. Phase number retained. Later phases are not renumbered. Ready for Manager planning only after CEO acceptance. No implementation is authorized by this approval alone.

### Required Corrections
None for the architecture contract. Manager and Developer artifacts that still require discovery are stale relative to this revision and must not be used as the implementation source.
