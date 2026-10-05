# Manager Phase 123 — Unified Digital Home (user side)

## Phase Identifier
PHASE=123 (from `team-Yuri/PHASE.md`).

## Status
READY_FOR_ARCHITECT_REVIEW — slice 123.4 (AD-123-1, -9, -15) + END OF ROUND Manager APPROVED (round 1, 2026-10-05) on frozen tree `fef52c66…3ac6` (BASE WIP `c700cd60`, scope `-- src scripts supabase`); END OF ROUND 63/63 in one clean sequential run. Was: OPEN (2026-10-05). Slice 123.3 is Architect PASS (frozen tree `664646a0…18af`, BASE `0dfb9de7`; RC-1 closed by dev Known Issue 7). Precondition: Sarah's WIP commit of the 123.3 tree = the 123.4 baseline. All Owner manual steps (D-123-6…8, `[catalog-gate]` count, 123.3, 123.4) are in ONE consolidated Owner run after END OF ROUND. Branch `wip/phase123-recovered` (no push / merge).
- History: slice 123.2 + R-123-1 Architect PASS; 123.1 reopened by D-123-1.
- Slice 123.1: Manager APPROVED (round 2); Architect PASS (conditional). It closes only when C-123.1-1 (the Owner's manual run) is recorded.
- Slices 123.3 → 123.4 are each opened only after the Architect reviews the previous slice (see Slice Authorization).

## Phase Goal
Make the Digital Home the single user screen. Every PRD v1.1 MVP action happens inside it (FR-01…FR-30):
- open an app, switch / edit / add / delete profiles;
- add apps from a catalog modal, add / edit custom sites;
- remove an app (confirm + 5 s Undo, full deletion).

The «ניהול אתרים» screen (`ManageServices`) is removed at the end. The Admin area is unchanged.

## Source References
- `team-Yuri/arch-phase123.md` — normative, STATUS: APPROVED FOR HANDOFF (Owner, 2026-10-04), v2, AD-123-1…AD-123-17 (AD-123-17 added by the Architect on 2026-10-04 in the 123.1 review, together with R-123-1 and C-123.1-1), §3 non-negotiables, §6 interface contracts, §7 data, §8 failure states, §9 security, §11 risks, §12 open items, §13 slices, Testing and Lint Expectations, FR table, Functional Testability.
- Product input: Tika "digital-home-unified-PRD" v1.1 (FR-01…FR-30), referenced by ID through `arch-phase123.md` only.
- Test policy T-1 (Owner approved 2026-10-03, defined in `team-Yuri/arch-phase122.md`): `scripts/lib/mutationArgs.mjs` (`parseMutationArgs`, `mutationId`, `selectMutations`, `formatElapsed`), `scripts/lib/tempDir.mjs`.
- Current code (read for this plan, not modified by the Manager):
  - `src/App.tsx`: `type Screen = 'manage' | 'dashboard'`, `resolvePostAuthScreen`, `changeSelection`, `addService`, `removeService`, `addCustomService`, `updateCustomService`, `openHomeCredentialModal` (calls `ensureDefaultProfileForService`), `clearWorkspaceMemory`, `handleLogout`, `handleLockVault`.
  - `src/Dashboard.tsx`: «ניהול אתרים» button (`onAddMore`); the `Tile` `hasCredentials` input = `hasCompleteCredentials(credentials[service.id], …)`; `LoginAssistancePanel` host.
  - `src/loginAssistance/LoginAssistancePanel.tsx`: chips only when `launchKind === 'credentials' && profiles.length > 1`; active profile seeded by `preselectedProfileId`; `onAddCredentials` button for `missing-user-credentials`.
  - `src/loginAssistance/DigitalHomeCredentialModal.tsx`: wraps `ServiceProfileManagementModal`; auto-creates through `ensureDefaultProfileForService` in a `useEffect`; profile delete is cloud first (`deleteAccessProfileFromCloud`), then local.
  - `src/ManageServices.tsx`: own `openProfileManagement` (calls `ensureDefaultProfileForService`) and own embedded `ServiceProfileManagementModal` wiring; local `userFacingCategories()`; `AddSiteModal`; `filterDiscoveryServices`.
  - `src/vault/profileManagement.ts`: `deleteAccessProfile(state, profileId)` throws `'Cannot delete the last profile for a service'` and auto-promotes the first remaining profile.
  - `src/profile/profileValidation.ts`: `normalizeExactlyOneDefaultPerService`.
  - `src/serviceManagement/serviceSelection.ts`: `addToSelection`, `removeFromSelection` (AC-104-16, preserves profiles).
  - `src/supabase/persistence.ts`: `deleteAccessProfileFromCloud`, `removeUserServiceFromCloud` (throws when no client or session; verifies the row is gone), `bumpDualWriteGeneration`.
  - `src/supabase/registryPersistence.ts`: `deleteCustomServiceRegistryRow` (filters on owner + `source_type='user'`; returns silently when no client or session, and does **not** detect a 0-row delete).

## Architecture Summary
- **One screen (AD-123-1, AD-123-9):** the `'manage'` screen is removed at the end, after a parity matrix.
- **App context (AD-123-2):** `LoginAssistancePanel` becomes the app context:
  - switcher when there are ≥ 2 profiles;
  - «עריכת פרופיל» and «הוספת פרופיל»;
  - 0-profile empty state;
  - app-actions menu with «הסרת אפליקציה», plus «עריכת פרטי האתר» for custom sites only.
- **Single modal host (AD-123-3):** one host for `ServiceProfileManagementModal`, focused on a given profile, with an add mode.
- **Writes (AD-123-4):** only through existing reducers + `persistVault` + existing cloud functions.
- **Profiles (AD-123-5, AD-123-7, AD-123-13):**
  - A profile is created only by an explicit add-profile save.
  - Exactly one default when ≥ 1 profile.
  - Switching profiles is session-only.
  - Deleting the last profile is allowed.
  - Deleting the default asks the user to choose a new default when ≥ 2 profiles remain.
- **Green dot (AD-123-6):** dot = `appHasProfile`.
- **Sync (AD-123-18 + amendment A, Owner / Architect approved):**
  - a cloud insert happens only for ids in a persisted outbox inside the encrypted vault payload;
  - every other row is update-only;
  - a row absent in the cloud and not in the outbox is removed locally;
  - refresh on return; `bumpDualWriteGeneration` before deletes;
  - fail-closed.
- **Catalog visibility gate (AD-123-19):** only `approved` or `no_stored_credentials` global sites are listed or offered. Home apps are never removed by the gate. `userApprovalState` is shared, and admin re-exports it.
- **Profile UI scope (AD-123-17):**
  - Profile UI only for form-credential apps (launch kinds `credentials` / `missing-user-credentials`; custom sites are always forms).
  - `no-stored-credentials` / `not-configured` apps keep today's window.
  - The green dot stays the pure AD-123-6 rule.
  - The app-actions menu («עריכת פרטי האתר» for custom sites; «הסרת אפליקציה») MUST be available for EVERY launch kind.
- **Catalog (AD-123-8, AD-123-14):** a large central modal reusing existing catalog pieces. Custom add / edit go through the unchanged `addCustomService` / `updateCustomService`.
- **Removal (AD-123-10/11/12):**
  - user-side confirm dialog + Undo toast;
  - deferred, full deletion with a fixed write order;
  - one pending removal at a time;
  - nothing persisted during the Undo window.
- **Admin aggregate (AD-123-15):** admin-only, counts only.
- **AD-123-16:** a conditional additive registry select policy, added only if a real own pending-row delete fails today.

## Slice Authorization

| Slice | Scope | Authorized | Gate before the next slice |
|---|---|---|---|
| 123.1 | App context + profile rules + single modal host + green dot | DONE: Manager APPROVED (round 2), Architect PASS (conditional, 2026-10-04). CLOSED only after C-123.1-1 is recorded | C-123.1-1 recorded in `dev-phase123.md` before 123.3 opens |
| 123.2 | Catalog modal + custom add + «עריכת פרטי האתר» (+ AD-123-17 menu rule) + R-123-1 (test-only) | DONE: Manager APPROVED (round 1, 2026-10-04); awaiting Architect review | Manager Review PASS → Architect review PASS; Owner's combined manual run (123.1 seven steps + 123.2 steps) recorded |
| Fix round + 123.2b | D-123-1…5 + AD-123-18 + amendment A; 123.2b catalog gate (AD-123-19) | DONE: Manager APPROVED round 2 (frozen tree c06950a5…ff1c21); Architect PASS (conditional), standing after the incident recovery (WIP `af881f6b`). Owner items 1–3 PASS, item 4 pending | Owner item 4 recorded |
| Fix round D-123-6…8 | D-123-6 admin copy (N-1 copy exception), D-123-7 URL scheme-only, D-123-8 REVISED (vault copy until approved; Step 1 root cause, then user-side fix) | YES (Architect ruling 2026-10-04; D-123-8 revised by the Owner; re-added 2026-10-05). D-123-6 / D-123-7 accepted at Architect level; D-123-8 released 2026-10-05 with the narrow N-2 exception (own-site hydrate merge + App catalog merge only). DONE: Manager APPROVED round 1 (frozen tree `1de67427…e387`); Architect PASS (2026-10-05) | Owner re-check moved to the consolidated Owner run at the end of the phase (no longer gates 123.3) |
| 123.3 | Remove app (confirm, Undo, deferred full deletion) | **DONE:** Manager round 1 CHANGES REQUIRED (documentation only) → RC-1 closed by dev KI-7 (fingerprint `664646a0…18af` unchanged); Architect PASS (2026-10-05). Was: OPEN (2026-10-05) after Architect PASS on fix round D-123-6…8; Owner re-checks deferred to the consolidated end-of-phase run (Owner preference). C-123.1-1 (two windows) was recorded PASS as Owner item 1. Precondition: WIP commit of the approved tree. **Order:** Item 0a (KI-5) → Step 0 (AD-123-16, MC-3), a hard sub-gate: STOP and report before any migration / product code → rest of 123.3 | Manager Review PASS → Architect review PASS |
| 123.4 | Navigation unification + ManageServices deletion + admin aggregate + END OF ROUND | **Manager APPROVED round 1 (2026-10-05)** on frozen tree `fef52c66…3ac6` (BASE `c700cd60`) → awaiting Architect review. Was: OPEN (2026-10-05) after Architect PASS on 123.3. Precondition: WIP commit of the 123.3 tree (= 123.4 baseline; `c700cd60`). The orphan / leftover cleanup is a PROPOSAL only, implemented only after an Architect decision | Manager Review PASS → Architect review PASS → consolidated Owner run → phase close |

Each slice is one Developer round. It writes or updates `team-Yuri/dev-phase123.md` with a section per slice, then STOPS.

## Non-Negotiables (all slices; arch §3, verbatim from Owner handoff)
Admin area unchanged; no change to auth / unlock / crypto / persistVault / sync / user-table RLS; writes only via existing reducers + persistVault + existing cloud functions (AD-123-4); no browser dialogs; no site / hostname / serviceId branches; no extension / manifest change; fail-closed on cloud errors; Hebrew RTL.

Derived checks, enforced every slice:
- **N-1:** `git diff --stat -- src/admin` is empty. Phase 121 / 122 admin verifies still pass.
- **N-2:** these files are unchanged: `src/vault/crypto.ts`, `src/vault/vault.ts` (`persistVault`), `src/vault/db.ts`, `src/vault/vaultMigration.ts`, the sync / hydrate modules, the functions in `src/supabase/persistence.ts` and `src/supabase/registryPersistence.ts`, `src/execution/**`, `extension/**`, `manifest*`.
- **N-3:** no new IndexedDB / Supabase write call sites in Digital Home components. Every write goes through:
  - existing reducers in `profileManagement.ts` / `serviceSelection.ts`, plus the new pure reducers named by the architecture;
  - `persistVault`;
  - existing cloud functions (`deleteAccessProfileFromCloud`, `deleteCloudEncryptedCredentialByLocalProfileId`, `removeUserServiceFromCloud`, `deleteCustomServiceRegistryRow`, `upsertCustomServiceRegistryRow` via the existing `addCustomService` / `updateCustomService`).
- **N-4:** no `window.confirm` / `alert` / `prompt` (or bare `confirm(` / `alert(` / `prompt(`) in `src/` outside `src/admin/**`.
- **N-5:** no branches on a specific site, hostname, or serviceId, and no fixture branches in product code.
- **N-6:** user-visible copy is Hebrew and the layout is RTL. Use the existing Digital Home visual language. No counts or status text on tiles.
- **N-7:** fail-closed. On any cloud error in a destructive step, the UI shows a Hebrew error, local state is unchanged, and success is not shown.
- **N-8:** the new user UI primitives (confirm dialog, Undo toast, catalog modal) do not import from `src/admin/**`.

## Stop Rule (all slices)
Stop and report to the Architect, without changing behaviour, in either case:
- a technical limitation would change PRD behaviour (FR-01…FR-30 as traced in arch);
- an AD cannot be implemented as written.

Record the limitation in `dev-phase123.md` under Known Issues with status BLOCKED. Do not ship a workaround that changes user-visible behaviour.

Known candidates for this rule:
- profile UI for apps whose credential entry is not a form (today `offersCredentialManagementPanel` / `resolveCredentialEntry` gate the modal);
- any FR that seems to need persisted Undo state (forbidden by AD-123-12);
- any FR that seems to need a schema change.

## Test Policy (T-1, per slice)
For each slice, the Developer runs and reports all of the following, each with its PASS line and elapsed time:
1. **Slice verify, no mutations:** `node scripts/verifyPhase123<Slice>.mjs --no-mutations`.
2. **New or touched mutations only:** `node scripts/verifyPhase123<Slice>.mjs --mutations=<IDs added or changed in this slice>`.
3. **Directly touched verifies:** every existing `scripts/verify*.mjs` (not `scripts/retired/**`) that references a file changed in the slice, found with `rg -l "<changed file basename>" scripts --glob "verify*.mjs"`. Run with `--no-mutations` where supported, otherwise plain.
   - Candidates seen by the Manager: `verifyPhase104ServiceManagement.mjs`, `verifyPhase109Accounts.mjs`, `verifyPhase113LoginAssistance.mjs`, `verifyPhase102CredentialSchema.mjs`, `verifyPhase103Execution.mjs`, `verifyPhase108M1ExplicitLoginEntry.mjs`, `verifyPhase108BrowserIntegration.mjs`, `verifyPhase111Assets.mjs`, `verifyPhase117ManagedAutofill.mjs`, `verifyServiceSourceOwnership.mjs`.
4. **Admin unchanged:** Phase 121 / 122 admin verifies with `--no-mutations` (or plain where T-1 is not supported), plus `git diff --stat -- src/admin` (must be empty).
5. **Type check and build:** `npx tsc -b` and `npm run build`.

Harness rules:
- Use the existing style: linkedom / static scans as in Phase 122.
- Use `parseMutationArgs` / `selectMutations` / `formatElapsed`.
- A mutation id is the leading token of its label (`M1 …`, `M2 …`) and is unique within its script.
- Temp dirs are created through `scripts/lib/tempDir.mjs` and removed in `finally`, whether the run passes or fails.

Superseded legacy assertions:
- Some existing verifies assert behaviour that Phase 123 replaces, e.g. AC-104-16 "remove keeps profiles", "cannot delete the last profile", the `'manage'` post-login screen, `ensureDefaultProfileForService` on open.
- The Developer updates only those assertions, each with a comment naming the superseding AD (e.g. `AD-123-13`).
- Each one is listed in `dev-phase123.md` (script, assertion, superseding AD).
- Weakening an assertion that is not superseded is forbidden.

END OF ROUND (after 123.4 only):
- full mutation sweep of every `verifyPhase123*` script (no switch);
- `node scripts/runOfflineRegression.mjs`.

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---|---|---|---|
| 1 | 123.1 App context | Green dot = has profile; no auto-create on user paths; switcher / «עריכת פרופיל» / «הוספת פרופיל» / 0-profile empty state; single modal host; profile delete rules incl. last profile + choose-new-default | `verifyPhase123AppContext.mjs` PASS (+ T-1 set); Architect review PASS |
| 2 | 123.2 Catalog | «+ הוספת אפליקציה» opens a large central catalog modal over Digital Home: search, categories, already-added marking, add without profile, custom add; «עריכת פרטי האתר» in the app menu for custom sites only | `verifyPhase123Catalog.mjs` PASS (+ T-1 set); Architect review PASS |
| 3 | 123.3 Remove app | AD-123-16 verification + report FIRST; confirm dialog; 5 s Undo toast; deferred full local + cloud deletion; own custom row deletion; leftover cleanup on re-add; edge rules | AD-123-16 report accepted by Architect; `verifyPhase123RemoveApp.mjs` PASS (+ T-1 set); Architect review PASS |
| 4 | 123.4 Navigation | Post-login always lands on Digital Home; empty home (FR-30); remove «ניהול אתרים»; parity matrix; delete ManageServices; admin-only aggregate | `verifyPhase123Navigation.mjs` PASS; END OF ROUND full sweep + `runOfflineRegression.mjs` PASS; Architect review PASS |

## Detailed Development Plan

### Slice 123.1 — App context (AD-123-2, -3, -5, -6, -7, -13)

**Pure helpers.** These live in a user-side pure module, not under `src/admin/**`. Suggested location: `src/digitalHome/appContext.ts`. The Developer records the final location.
- `appHasProfile(state, serviceId): boolean`: true iff ≥ 1 `accessProfiles` entry for that service (trimmed id). Credentials are ignored (AD-123-6, FR-21/22).
- `initialActiveProfile(profiles): string | null`:
  - 0 profiles → `null`;
  - otherwise the default profile's id;
  - if no default is marked (legacy data), the first profile in display order, matching the existing `preselectedProfileId`.
  - It never reads persisted "last used" state (AD-123-7).
- `appContextActions(service, profiles, isCustom)` returns the action set for the floating window:
  - `switcher` iff profiles ≥ 2;
  - `edit_profile` iff profiles ≥ 1;
  - `add_profile` always;
  - `empty_state` iff profiles = 0;
  - app menu: `remove_app` always, `edit_site_details` iff `isCustom`.
  - `isCustom` = the app is in vault `customServices` (AD-123-14).
  - The helper's contract is complete from 123.1, but the UI renders app-menu entries only from the slice that wires them: «עריכת פרטי האתר» in 123.2, «הסרת אפליקציה» in 123.3.
- `deleteProfilePlan(profiles, profileId)`:
  - `'simple'` when the target is not the default;
  - `'auto_default'` when the target is the default and exactly 1 profile remains after deletion;
  - `'choose_default'` when the target is the default and ≥ 2 remain;
  - also `'simple'` when the target is the last profile.

**`src/vault/profileManagement.ts` — `deleteAccessProfile(state, profileId, replacementDefaultId?)` (AD-123-13):**
- Remove the last-profile guard; deleting the last profile leaves the app with 0 profiles.
- If the target is the default and exactly 1 profile remains → that profile becomes the default.
- If the target is the default and ≥ 2 remain → `replacementDefaultId` is required, must be a remaining profile of the same service, and is set as the default. If it is missing or invalid, throw `ProfileManagementError` (fail-closed; nothing changes).
- If the target is not the default → `replacementDefaultId` is ignored. The existing default is kept.
- The credential of the deleted profile is removed, as today.
- Afterwards: exactly one default when ≥ 1 profile remains; none when 0 remain.
- Make sure `normalizeExactlyOneDefaultPerService` / `validateExactlyOneDefaultPerService` accept 0-profile services and a single remaining profile marked default. Change validation only if it currently rejects these cases, and report any change.
- The cloud-first order is unchanged: `deleteAccessProfileFromCloud`, then the local reducer + `persistVault`. P-4 stays out of scope.

**AD-123-5 — no auto-creation on user paths:**
- Remove every `ensureDefaultProfileForService` call from user flows:
  - `App.tsx` `openHomeCredentialModal`;
  - the `DigitalHomeCredentialModal` `useEffect`;
  - `ManageServices.tsx` `openProfileManagement` (ManageServices still exists until 123.4).
- Do not delete the export. `vaultMigration.ts` keeps its own private helper, unchanged.
- Static check: no `ensureDefaultProfileForService(` call in `src/` outside `src/vault/profileManagement.ts` (the definition) and `src/vault/vaultMigration.ts` (private helper).

**AD-123-3 — single modal host:**
- Replace `homeCredentialService` with one App-level host state `{ serviceId, profileId?, mode: 'edit' | 'add' } | null`, opened via `openProfileManagement({ serviceId, profileId?, mode })` (arch §6).
- Exactly one rendering site of `ServiceProfileManagementModal` remains in `src/` (outside admin): the host, i.e. `DigitalHomeCredentialModal` merged or renamed.
- ManageServices' own embedded `ServiceProfileManagementModal` wiring is removed. Its profile entry calls the App host through a callback prop.
- The host handles cloud-first profile delete and credential delete exactly as today, plus the `replacementDefaultId` step.

**`ServiceProfileManagementModal.tsx`:**
- Opens focused on the given `profileId`; edit mode defaults to `initialActiveProfile`.
- **Add mode:** profile name plus credential fields. One save → one reducer chain (`addAccessProfile`, then `saveCredentialForProfile` when fields were entered) → one `persistVault`.
  - Exactly one new profile is created (FR-09).
  - Cancel / close → zero writes.
  - A profile without credentials is valid (FR-21).
- **Delete:** the last profile can be deleted (FR-10/11/12).
  - For `deleteProfilePlan === 'choose_default'`, an in-modal step asks the user to pick the new default before the delete runs (FR-13). It is not a browser dialog.
  - For `'auto_default'`, no extra step.
- The `toHebrewProfileError` mapping for `'Cannot delete the last profile for a service'` becomes dead. Remove it or leave it unused, and say which in the evidence.

**`LoginAssistancePanel.tsx` (+ `credentialsGate.ts`, `messages.ts`) — app context:**
- **Switcher:** rendered when profiles ≥ 2, regardless of credentials (AD-123-2, FR-03/05). Selecting changes the active profile for this window session only and never calls a write (FR-05/06).
- **Opening:** each open of the window starts at `initialActiveProfile` (FR-05 "reopen → default").
  - While the window stays open, an update to `accessProfiles` keeps the current active profile if it still exists.
  - If it was deleted, the window falls back to `initialActiveProfile`.
- **«עריכת פרופיל»:** rendered when profiles ≥ 1. Opens the host with `{ serviceId, profileId: activeProfileId, mode: 'edit' }`. Tile → window → «עריכת פרופיל» is ≤ 2 actions (FR-07/08).
- **«הוספת פרופיל»:** always rendered. Opens the host with `{ serviceId, mode: 'add' }`.
- **0-profile empty state:** Hebrew empty-state text plus «הוסף פרופיל» (opens add mode). No credential fields and no chips.
- Credential display, copy, and auto-attempt behaviour for the active profile are unchanged. Login execution is unchanged.

**`Dashboard.tsx` / `Tile.tsx` — green dot:**
- The tile indicator input becomes `appHasProfile(vaultState, service.id)` (FR-21/22/23).
- Tile markup is unchanged: no count and no text.

**Not in 123.1:** catalog, app-actions menu entries, removal, navigation / «ניהול אתרים» removal.

**Verify script `scripts/verifyPhase123AppContext.mjs`, minimum checks:**
- **Pure helpers:**
  - `appHasProfile`: 0 / 1 / 2 profiles; with and without credentials.
  - `initialActiveProfile`: 0 → null; default chosen; legacy no-default → first.
  - `appContextActions` matrix: profiles 0 / 1 / 2 × custom / built-in.
  - `deleteProfilePlan`: all three outcomes plus the last-profile case.
- **`deleteAccessProfile`:**
  - last profile allowed → 0 profiles, credential removed;
  - default with 1 remaining → auto default;
  - default with ≥ 2 remaining: no replacement → throws, state unchanged; invalid / other-service / deleted id → throws; valid → that id is the default and exactly one default remains;
  - non-default delete keeps the default.
- **Static checks:**
  - no `ensureDefaultProfileForService(` call outside the two allowed files;
  - exactly one `<ServiceProfileManagementModal` render site outside admin;
  - panel switcher condition does not depend on `launchKind === 'credentials'`;
  - Dashboard tile input uses `appHasProfile`;
  - no `window.confirm|alert|prompt` outside admin;
  - N-1 / N-2 file-unchanged checks (diff or hash baseline);
  - no new Supabase / IndexedDB call sites in Digital Home components.
- **Unlock check:** delete the last profile → `persistVault` → lock / unlock (existing offline harness) → still 0 profiles, no auto-created «ראשי».
- **Mutations:** at least one per rule. Each must make the script FAIL:
  - **M1:** restore the last-profile guard.
  - **M2:** auto-promote on `choose_default` instead of requiring `replacementDefaultId`.
  - **M3:** re-add `ensureDefaultProfileForService` on open.
  - **M4:** dot back to complete credentials.
  - **M5:** switcher gated on credentials.
  - **M6:** window reopens on the last switched profile instead of the default.
  - **M7:** add mode writes on open or cancel.
  - **M8:** second modal render site.

**FR coverage for 123.1:** FR-02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 21, 22, 23 (see the FR table).

### Slice 123.2 — Catalog modal + custom sites (AD-123-8, -14)
- **Extract a container-agnostic `AppCatalog` body** from `ManageServices.tsx`. It reuses `filterDiscoveryServices`, `userFacingCategories` (moved out of `ManageServices.tsx` into a shared user-side module), `classifyAddCustomService`, and `AddSiteModal`. ManageServices may temporarily render the same body until 123.4.
- **Catalog modal host in `App.tsx`:** «+ הוספת אפליקציה» on Digital Home opens a large central modal (FR-14). `openCatalog()`; `onAddApp(serviceId) → Promise<AddOutcome>`; `onAddCustom(definition) → Promise<AddCustomServiceResult>`; `onClose()` (arch §6).
  - Inputs: `selectedIds`, services, categories, pending ids.
  - No profile data enters the catalog.
  - Focus trap and Escape close the modal. Hebrew RTL.
- **Search (FR-15) and categories (FR-16).**
- **Already-added marking (FR-17):** apps in `selectedIds` are marked, and adding them again cannot create a duplicate tile.
- **Add (FR-18):** goes through the existing `addService` → `changeSelection(id, 'add')` path. No profile is created and no `ensureDefaultProfileForService` is called.
- **Custom add (FR-19):** through the unchanged `addCustomService`. Its existing outcomes (`created`, `already_in_user_home`, `same_user_custom_duplicate`, errors) are shown inside the modal in Hebrew.
- **Catalog load error:** inline error + retry inside the modal. Digital Home stays usable (arch §8).
- **App-actions menu in the floating window**, first entry «עריכת פרטי האתר», shown iff `appContextActions(...).edit_site_details` (FR-20; custom = in vault `customServices`):
  - opens the existing `AddSiteModal` edit flow;
  - saves through the unchanged `updateCustomService`;
  - is never shown for built-in apps.
- **AD-123-17 menu rule (binding for 123.2 and 123.3):**
  - The app-actions menu renders for EVERY launch kind: `credentials`, `missing-user-credentials`, `no-stored-credentials`, `not-configured`.
  - It must not sit inside the profile-UI gate (`launchKindOffersProfileUi` / `entry.kind === 'form'`) or depend on the credential mode.
  - In 123.2 the menu contains «עריכת פרטי האתר» for custom sites. For a built-in app the menu control may stay hidden while it has no entries; it gains «הסרת אפליקציה» in 123.3 with the same every-launch-kind rule.
  - The profile UI keeps the AD-123-17 gating unchanged.
- **Temporary coexistence:** «ניהול אתרים» and the `ManageServices` screen stay until 123.4. «+ הוספת אפליקציה» is added next to them. ManageServices may render the extracted `AppCatalog` body.
- **Verify `scripts/verifyPhase123Catalog.mjs`:**
  - filter / category helpers on catalog data;
  - already-added marking;
  - the add path creates 0 profiles;
  - custom add delegates to `addCustomService` unchanged;
  - edit-site only for custom;
  - **AD-123-17:** the app-actions menu with «עריכת פרטי האתר» is reachable for a custom site in each of the four launch kinds (browser or linkedom check), and the menu render is not inside the profile-UI gate (static check);
  - no profile reducers imported by the catalog body;
  - N-checks.
- **Mutations, at least:**
  - add creates a profile;
  - already-added not marked;
  - edit-site visible for built-in;
  - **app menu gated on the profile-UI condition / launch kind (AD-123-17)**;
  - catalog imports from `src/admin`;
  - catalog writes directly (bypassing `addService` / `addCustomService`).
- **Manual run, combined (C-123.1-1):**
  - The Developer adds the 123.2 manual steps to `dev-phase123.md`, after the existing 123.1 seven-step table:
    - empty-catalog search;
    - category filter;
    - add a built-in app (no dot);
    - an already-added app is marked;
    - custom add;
    - «עריכת פרטי האתר» on a custom site, including one with a `no-stored-credentials` or `not-configured` launch kind if available;
    - no «עריכת פרטי האתר» on a built-in app.
  - The Owner performs both tables on `http://localhost:5173/` and the outcomes are recorded. Outcomes are never filled in without an actual run.
  - This must be recorded before 123.3 opens.

### Task R-123-1 — Re-baseline three Phase 121 admin verifies (test-only; runs with 123.2)
Authorized by the Architect, 2026-10-04 (arch Review Notes).
- **Scripts:** `scripts/verifyPhase121IframeSurface.mjs`, `scripts/verifyPhase121InspectReadinessEligible.mjs`, `scripts/verifyPhase121PartialOcclusionPick.mjs`.
- **Change:** replace only their "revert slice edits == `git show HEAD:<file>`" scope checks with a comparison against a frozen pre-slice reference.
  - **Option 1:** `git show 909cc8b^:<file>`, used only if that revision reproduces the pre-slice file exactly. Prove it: reverting the slice edits on the current file yields byte-identical content to `909cc8b^:<file>`.
  - **Option 2:** otherwise, frozen baseline files under `scripts/lib/phase121-baseline/`, following the `scripts/lib/phase122-baseline/` precedent.
  - Record which option was used per file and why.
- **Constraints:**
  - No behavioural assertion or mutation is removed or weakened.
  - `extension/**` untouched (`git diff --stat HEAD -- extension` empty).
  - No product code change.
- **Proof:**
  - all three scripts PASS (run plain, or with `--no-mutations` if supported, plus any mutations they own);
  - a deliberate one-line edit outside the slice edits in a copy of the target file makes the re-baselined scope check FAIL (show the check still bites). Done in a temp copy, cleaned up in `finally`, with `extension/**` never edited.
- **Deadline:** all three PASS before the 123.4 END OF ROUND. Doing it in the 123.2 round is required.
- **Evidence:** a separate subsection "R-123-1" in `dev-phase123.md`: files changed, the baseline option per script, the before (FAIL) / after (PASS) outputs, the bite proof, and the `extension` diff.

### Joint resubmission — fix round D-123-1…5 (+ AD-123-18, amendment A) and slice 123.2b (Architect ruling 2026-10-04)
- **One frozen tree.** The fix round and 123.2b are submitted together, with no edits to the working tree from submission until the Manager review ends.
  - The Developer records a tree fingerprint at submission: the command and its value, covering `git diff HEAD` plus the untracked files under `src/`, `scripts/`, `supabase/`.
  - The Manager recomputes it before and after the review. A mismatch is BLOCKED.
- **Separate evidence.** `dev-phase123.md` keeps the section "Fix round D-123-1…5", updated with amendment A and H-1, and gets a new section "Slice 123.2b". Each section has its own verify results, superseded assertions and known issues.
- **Order of work:** H-1 harness corrections first, so every later run is bounded; then amendment A; then complete 123.2b; then freeze and run the full T-1 set for both.
- **H-1 is a precondition** for both sections (see Required Corrections, round 1, item 2).

### Fix round D-123-1…5 + AD-123-18 + amendment A — review criteria
**D-123-1 / AD-123-18 (arch Review Notes):**
- Insert rule; update-only for every other row; "deleted elsewhere" → removed locally through the existing reducers + `persistVault`.
- Refresh on focus / visibility return, throttled.
- An open window / modal on a vanished item closes with a Hebrew notice.
- `bumpDualWriteGeneration` before the cloud profile delete.
- Fail-closed when existence can't be checked.

**Amendment A — persisted outbox:**
- **Payload:** the in-memory "created by this session" set is replaced by an outbox. The outbox is one field in the existing encrypted vault payload, holding ids of profiles, app memberships and custom sites that were created locally and are not yet confirmed in the cloud.
  - A vault without the field decodes to an empty outbox (backward compatible).
- **Rule (i):** a cloud INSERT happens only for an outbox id. An id leaves the outbox only after its insert is confirmed; a failed insert keeps it.
- **Rule (ii):** at login / re-hydrate, a local row absent in the cloud is kept and inserted if its id is in the outbox. Otherwise it is removed locally together with its credentials.
- **Rule (iii):** legacy rows (not in the outbox) are cloud-authoritative.
- Fail-closed and the D-123-1 protection must still hold. A stale session never re-inserts a row that is not in its own outbox.
- **N-2 scope for amendment A (Manager reading; the Architect confirms at review).** The payload shape lives in `src/vault/crypto.ts` (payload type + decode defaults) and `src/vault/vault.ts` (`VaultState`, `emptyVaultState`, persist mapping). Allowed edits in those files are limited to:
  - declaring the outbox field;
  - its empty default when decoding an existing vault;
  - copying it in the persist mapping.
  - Nothing else in encryption / decryption, KDF, keys, unlock or `persistVault` logic changes. The exact diff of both files is quoted in the evidence.
  - If more is needed → STOP and report (stop rule).
- **Required checks:**
  - an unsynced creation survives a reload / lock-unlock and is inserted on the next sync / login;
  - an offline creation is kept and inserted later;
  - a legacy row absent in the cloud is removed locally with its credentials;
  - an old vault without the field decodes with an empty outbox and unlocks;
  - a failed insert keeps the id;
  - a confirmed insert removes it;
  - a stale session B never inserts a row it does not hold in its own outbox (D-123-1 still reproduced under the pre-AD-123-18 mutation).
  - Each rule gets a mutation that must FAIL the verify.
- The earlier Known Issue 1 is resolved by amendment A and must be marked so.

**D-123-2…D-123-5:** as in arch Review Notes. D-123-5 real-account stage times are reported by the Owner run, or marked "not run — awaiting Owner".

### Slice 123.2b — Catalog visibility gate (AD-123-19)
Authorized by the Architect (AD-123-19), handed over by the Owner, and added to this plan on 2026-10-04.
- **Shared approval derivation:**
  - `userApprovalState` moves with unchanged logic from `src/admin/userApproval.ts` to a shared user-side module (`src/service/userApproval.ts`).
  - **N-1 exception (Architect-authorized):** `src/admin/userApproval.ts` changes only by replacing the moved logic with a re-export. `USER_APPROVAL_HE` and all other admin code stay unchanged.
  - Evidence:
    - the moved function body is byte-identical to the HEAD admin version (static check);
    - the admin file diff shows only the re-export;
    - the admin badge behaviour is unchanged (Phase 122 admin verifies pass).
- **Listing rule:** a global catalog site is listed in the user catalog iff either:
  - `userApprovalState(row) === 'approved'`, or
  - the admin explicitly configured `no_stored_credentials`.
  `no_mapping`, `not_approved`, `blocked` and `not_configured` are hidden. The rule applies to admin-created sites and to promoted user submissions alike (promotion alone does not publish).
- **Same gate for new adds:**
  - the custom-add classifier offers `catalog_service_available` only for listed sites;
  - no catalog path can add a hidden site.
- **Not changed:**
  - apps already on a user's Digital Home are not removed when a site leaves the approved state (runtime fail-closed as today);
  - an unpromoted user-created site stays visible only to its owner (existing RLS);
  - the admin area sees everything.
  - Report how the catalog shows a non-approved app that is already on the user's home. AD-123-19 doesn't specify it, so the Architect rules on it at review.
- **Client-side filter only:** no RLS, schema or migration change. `src/dev/*` diagnostics are dev-only (`isDevBuild()`) and log no credential values.
- **Evidence AD-123-19 requires:** how many currently listed sites become hidden, measured on the real catalog by the Owner run (or by a read-only count the Owner runs), with the per-state breakdown.
- **Verify `scripts/verifyPhase123CatalogGate.mjs`** (bounded per H-1):
  - each approval state → listed / hidden;
  - `no_stored_credentials` listed;
  - promoted user submission without approved mapping hidden;
  - classifier offer gated;
  - hidden site cannot be added;
  - home tile of a de-approved app stays;
  - admin re-export byte-identity;
  - N-checks.
  - Mutations, at least:
    - gate removed;
    - `not_configured` listed;
    - `no_stored_credentials` hidden;
    - classifier ungated;
    - de-approved home app removed;
    - admin logic changed instead of re-exported.
- **Manual (Owner):** the catalog shows only approved / no-stored-credential sites; the admin still sees all; an existing home app of a non-approved site stays.

### Fix round D-123-6…8 (Architect ruling 2026-10-04; D-123-8 as REVISED by the Owner; re-added 2026-10-05 after the incident)
Context:
- The joint resubmission (fix round D-123-1…5 + 123.2b) is Architect PASS (conditional). Owner items 1–3 PASS. Item 4 (123.2b visibility + `[catalog-gate]` count) is pending and may run in parallel with this round.
- Normative: arch Review Notes, entry "Owner manual run … partial" (D-123-6, D-123-7, and D-123-8 REVISED, which supersedes the original rules (i)–(iii)), and entry "Incident …" (recovery ACCEPTED).
- **Baseline:** WIP commit `af881f6b` on local branch `wip/phase123-recovered` = the frozen joint-resubmission tree. Work continues on that branch; no push / merge.
- **Fingerprint:** computed against `af881f6b`, excluding `team-Yuri/` (both casings).
- One Developer round. It writes the section "Fix round D-123-6…8" in `dev-phase123.md`, then STOPS. D-123-8 has an internal STOP after Step 1 (below).
- **Update 2026-10-05 (arch Review Notes "D-123-8 rulings after Step 1"):**
  - Sarah's Step 1 BLOCK was correct; its facts are accepted.
  - D-123-6 and D-123-7 are accepted at Architect level (final review together with D-123-8): DONE, no further work. The 10 other admin id messages stay as they are (cosmetic backlog).
  - The test-only re-pin of the three Phase 123 verifies to `909cc8b` is accepted.
  - D-123-8 is released for implementation under the rulings below.
  - The earlier double concurrent T-1 run is not acceptable as final evidence.

**D-123-6: admin approval message shows an internal id: DONE (accepted at Architect level 2026-10-05; final review with D-123-8)**
- **N-1 exception (Architect-authorized):** copy only, only in `src/admin/ApprovalQueue.tsx`.
  - The success message `אושר כאתר גלובלי (${globalId}).` becomes «"<display name>" אושר כאתר גלובלי.», with no id.
  - The name comes from data the component already holds. No new query, no logic / flow / state change.
- **Superseded admin assertion (Architect addition):** if an existing admin verify asserts the old copy, update only that assertion, with a comment naming D-123-6, and list it in a superseded-assertions table. No other admin verify change.
- **Inventory, report only:** every other admin-visible message in `src/admin/**` that prints an internal id (`custom-…`, uuids, global ids), with file, line and copy.
  - Do NOT change them; changes need Architect approval.
- **Evidence:**
  - the `ApprovalQueue.tsx` diff is the copy line only;
  - a static check (no id interpolated, display name used);
  - the superseded-assertion table;
  - Phase 122 admin verifies pass.

**D-123-7: custom-site URL gets `www.`: DONE (accepted at Architect level 2026-10-05: scheme only, identity unchanged, new verify 6 groups / 9 mutations; final review with D-123-8)**
- `validateCustomPrimaryUrl` (`src/catalog/customService.ts`) only completes the scheme:
  - no scheme → `https://`;
  - `http://` → `https://`.
- It never adds `www.` and never changes the host, path or query the user typed. This applies on create and edit; an edit stores the typed URL (scheme-completed).
- Existing stored URLs are not migrated; the user fixes them by edit.
- **Identity must not regress:** Phase 116 identity / offer matching (`catalog_service_available`, «already in home») keeps working for www / non-www variants. Proof: `verifyPhase116CustomAddIdentity` passes, with the www / non-www cases shown.
- **Identity fixes on the user side only (Architect addition):** if www / non-www matching needs a fix, keep it in the user-side classifier / identity helpers. No registry, mapper or admin change. If that isn't enough, STOP and report.
- **Verify** (new script, or a new group in a Phase 123 verify; bounded per H-1). It checks:
  - `wolt.com/he/discovery` → `https://wolt.com/he/discovery`;
  - an existing `www.` host is kept;
  - path and query are preserved;
  - `http://` → `https://`;
  - an edit round-trip keeps the typed URL.
- **Mutations, at least:**
  - `www.` re-added for apex hosts;
  - path / query changed;
  - edit overwrites the typed URL;
  - www / non-www identity broken (caught by the identity proof).

**D-123-8: custom-site credentials disappear after an admin change. REVISED by the Owner (supersedes rules (i)–(iii) of the original ruling)**
- **Owner rule:** an admin change to a user's own custom site has NO effect on that user's environment until the site's mapping is complete and its status is «מאושר למשתמשים» (`userApprovalState = approved`), exactly like a global site.
  - Until then, the owner keeps seeing the site as they created it (name, URL, category, login fields) with their saved credentials.
  - Saving credentials before mapping stays allowed; nothing is deleted.
- **Once the site is approved for users,** the admin definition applies:
  - stored values under unchanged field ids are shown;
  - values under other ids are kept (never deleted by any admin change, sync, hydrate or load) until the user saves that profile;
  - the window shows «שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.» with «עריכת פרופיל» (Hebrew RTL, inside the floating window, no browser dialog).
- **Architect direction (to be confirmed by Step 1): user side only.** For an app in vault `customServices`, the effective definition is the vault copy unless the registry entry is `approved`, in which case it is the registry definition. No `src/admin` / registry / mapper change.
- **Step 1, read-only root-cause report (no code change), in `dev-phase123.md`:**
  - where the effective definition / field ids of an own custom site switch from the vault copy to the admin-changed registry entry (file, function, read path), for a rename / category / URL / promotion / mapping change;
  - **whether the vault `customServices` copy holds everything the window needs** (name, URL, category, login fields / field ids, launch kind) to keep showing the site as created;
  - whether any path really drops stored values (sync, hydrate, load, save), or whether they only become invisible (`serviceHasUsableCredentials` reads only current field ids);
  - whether the existing profile-modal save drops values under missing ids (allowed by the ruling only when the user saves that profile);
  - **notice scope (Architect addition):** the notice rule is generic (no site / source branches), so it also applies to global sites whose fields an admin changed. Report which stored-key patterns would raise the notice on global / built-in sites (e.g. legacy keys vs current mapping ids), so the Architect can judge whether existing users would see it unexpectedly;
  - the proposed user-side fix, and anything that would need more than the user side.
- **Reproduction (Architect addition, as relayed by the Owner 2026-10-05):**
  - Allowed: a live reproduction with the Owner's account, in the TEST environment, through the app UI. Read-only DB queries are allowed.
  - No passwords or credential values in files, logs, screenshots or evidence; report field ids / key names / counts only.
  - The harness verify with the real code paths (registry mapper, `credentialsGate`, profile modal) is still required.
- **STOP for Architect approval** if the fix needs anything outside the user side: `src/admin/**`, registry persistence, the mapper, sync, hydrate, `src/vault/crypto.ts` or `persistVault`. Implement nothing there; report and wait.
- **Step 1 result (2026-10-05):** BLOCKED correctly. The Architect accepted these facts:
  - hydrate (`persistence.ts` ≈ 983–995) overwrites the vault copy of an own site with the registry row on every unlock;
  - the App catalog merge takes login fields from the registry;
  - in-place promotion makes the global version win;
  - stored values are only hidden, never deleted (except by the user's own profile save).
  The superseded "Implementation after Step 1" is replaced by the rulings below.

**D-123-8 implementation (Architect rulings after Step 1, 2026-10-05; normative: arch Review Notes "D-123-8 rulings after Step 1", items 1–5)**
1. **Scope (Owner): own custom sites only, permanently.**
   - "Own custom site" = an app in the owner's vault `customServices`.
   - Global sites keep today's behaviour: admin edits apply immediately; approval gates catalog listing and autofill only. No draft / publish model for globals.
2. **Vault copy = the last version the owner may see.** For an own custom site, the effective definition (name, URL, category, login URL, login fields, launch kind) is:
   - **registry `approved`** (`userApprovalState` from `src/service/userApproval.ts`): the registry definition applies, and hydrate refreshes the vault copy from it;
   - **registry not approved** (any other state): the vault copy, resolved as a user-created site, i.e. the default custom form it had at creation;
   - **approval lost after a re-edit:** the vault copy (the last approved version). Never the newer unapproved edits, and never a flip back to the original;
   - **unknown / unreadable approval or registry row:** the vault copy (fail-closed).
   - ONE resolved definition feeds the window, launch kind, login URL, execution and managed autofill. Execution / autofill code is unchanged; only its input definition is resolved.
3. **N-2 exception (Architect-APPROVED, narrow):**
   - **`hydrateWorkspaceFromCloud`:** only the own-site merge changes. It replaces the vault copy with the registry row only when that row is `approved` (same `userApprovalState` helper); otherwise the vault copy is kept unchanged.
   - **App catalog merge:** it stops taking registry login fields for non-approved own sites.
   - Nothing else changes in hydrate / sync / crypto / `persistVault` / RLS / schema / registry / mapper / `src/admin`.
   - **Evidence:** the hydrate diff quoted IN FULL in `dev-phase123.md`, plus a static check that the rest of `hydrateWorkspaceFromCloud` / `persistence.ts` is unchanged against `af881f6b`.
4. **Promotion under a different global id:** no automatic move.
   - The owner keeps their own site, with profiles and credentials untouched.
   - The global site appears in their catalog once approved (Phase 116 offer / «already in home» as today).
5. **After approval with changed fields:**
   - same-field-id values are shown;
   - other values are kept until the user saves that profile;
   - the floating window shows «שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.» with «עריכת פרופיל» (Hebrew RTL, no browser dialog).
   - **Notice scope: own sites only.** Global sites are unchanged (no notice).
- **Rules:**
  - The fix never writes, renames or deletes stored credential values, except through the user's own profile save.
  - No site / hostname / serviceId branches. The own-site test is "in vault `customServices`", not an id pattern.
- **Verify** (new or extended Phase 123 verify; bounded per H-1). It checks:
  - own site, registry NOT approved after an admin rename / category / URL / login-URL / field change: window, launch kind, login URL and the autofill input use the vault copy with the stored values; no notice; hydrate leaves the vault copy unchanged;
  - own site, registry `approved`: the registry definition applies; hydrate refreshes the vault copy; with changed fields, same-id values are shown, other-id values are still in the vault, and the notice + «עריכת פרופיל» appear;
  - approved, then a re-edit drops approval: the last approved version is shown (not the new edits, not the original);
  - unknown / unreadable approval: the vault copy is shown;
  - promotion under a new global id: the own site and its credentials are untouched, and the global site is offered in the catalog once approved;
  - global site with admin field changes: today's behaviour, no notice;
  - approved and nothing hidden: no notice;
  - static: hydrate diff limited to the own-site merge; App catalog merge rule; no site / serviceId branches.
- **Mutations, at least:**
  - registry definition used while not approved;
  - vault copy not refreshed while approved;
  - approval lost shows the newer unapproved edits;
  - approval lost flips back to the original;
  - unknown approval uses the registry;
  - hydrate change outside the own-site merge;
  - notice shown on a global site;
  - values under missing ids deleted;
  - display keyed by position (or label) instead of field id;
  - notice missing after approval with changed fields;
  - registry login fields used in the App catalog merge for a non-approved own site.

**Rules for the whole fix round:**
- T-1: `--no-mutations` plus the new / touched mutations, the directly touched verifies (incl. `verifyPhase116CustomAddIdentity`, the D-123-7 verify, `verifyPhase123Sync` because hydrate is touched, and the Phase 123 floating-window / catalog verifies), the Phase 122 admin verifies, `tsc` and build.
- **Final evidence = ONE clean sequential T-1 run on a single frozen tree.** No concurrent runs. The fingerprint (vs `af881f6b`, excluding `team-Yuri/`) is taken immediately before and after the run and must be identical. Partial or concurrent runs are not evidence.
- H-1 bounds in every new browser group / mutation.
- Frozen tree with a fingerprint against `af881f6b`, excluding `team-Yuri/`.
- No site / hostname / serviceId branches, no browser dialogs, Hebrew RTL, no credential values or secrets in logs.
- No env / secrets access. Live DB: only the read-only queries of the D-123-8 reproduction.
- Non-Negotiables N-1…N-8 apply, except the D-123-6 copy exception.
- **Owner re-check (moved 2026-10-05 into the consolidated Owner run at the end of the phase; no longer gates 123.3):** item 4 (if not already recorded), D-123-7 (create / edit `wolt.com/he/discovery` keeps the URL) and D-123-8:
  - an admin change to an own unapproved site has no effect for the owner;
  - after approval, the admin definition applies; with changed fields, the notice + «עריכת פרופיל» appear and same-id values are shown;
  - a re-edit that drops approval keeps the last approved version.

### Slice 123.3 — Remove app (AD-123-10, -11, -12, -16; PQ-123-1)
**Opened 2026-10-05** (fix round D-123-6…8 Architect PASS; gate change per arch Review Notes "Owner re-check deferred"). Bindings added from arch Review Notes: Item 0a (KI-5), the KI-3 ruling, the AD-123-14 clarification, `showAppMenu`, and MC-3.

**Precondition: WIP commit of the approved tree (before any 123.3 change)**
- Sarah commits the Architect-approved tree (fingerprint `1de67427…e387`, scope `-- src scripts supabase` vs `af881f6b`) on local branch `wip/phase123-recovered`.
- Same rules as `af881f6b`: explicit paths only (no `git add -A` / `.`); team docs only under lowercase `team-yuri/` (no `team-Yuri/` second-casing paths in the commit); no push, merge, `--no-verify` or amend; no other history change.
- Before committing, recompute the fingerprint and confirm `1de67427…e387`. After committing, `git diff <hash> -- src scripts supabase` is empty and there are no untracked files under those paths.
- Report the hash in `dev-phase123.md` (123.3). **That commit is the 123.3 fingerprint baseline** (scope `-- src scripts supabase`).

**Item 0a — KI-5 hydrate completeness (first product change; Architect binding)**
- The hydrate own-site block in `hydrateWorkspaceFromCloud` refreshes the vault copy only when the row is approved AND passes the same completeness predicate the resolver uses (category + icon).
  - One shared helper in `src/digitalHome/ownSiteDefinition.ts`, used by both `resolveOwnSiteDefinition` and the hydrate block.
  - The change stays inside the same block; a row with no local copy is still added (today).
- No other hydrate / `persistence.ts` change. Static check: `persistence.ts` equals the baseline commit apart from that block (and its import); the `verifyPhase123AppContext` / `verifyPhase123D8OwnSite` block pins are updated narrowly, with a comment naming KI-5.
- **Mutations, at least:**
  - an approved but incomplete row replaces the copy;
  - resolver and hydrate use different predicates (helper not shared);
  - hydrate change outside the block.
- `verifyPhase123D8OwnSite` keeps all 17 existing mutations.

**Step 0 — AD-123-16 verification. Hard gate: no product code and no migration before the report is accepted.** (Item 0a is the only change allowed before the Step 0 report; it is not part of the removal feature.)
- **MC-3 (Architect):** if the Developer has no admin / service-role read, she prepares the row and the call and gives the Owner a read-only SQL query to run (no secrets, no credential values). The Owner's result is the proof. This is the only Owner action inside 123.3.
1. With a real signed-in test user, create an own custom site through the existing custom add so its `service_registry` row is `source_type='user'`, `status='pending_review'`, `owner_user_id = user`.
2. Call the existing `deleteCustomServiceRegistryRow(id)` as that user.
3. Prove the outcome independently of the function. The function does not detect a 0-row delete, so "no error" is not proof.
   - Read the row with an admin / service-role read (existing admin tooling or SQL editor).
   - Report one of two results:
     - **DELETED:** row gone.
     - **BLOCKED:** row still present, or an error was raised. Include the error / RLS detail.
4. Write the result in `dev-phase123.md` (123.3 Step 0): user (redacted id), row id, status before, call result, independent read after, and the conclusion.
5. STOP and report to the Architect.
   - **If DELETED:** no migration is written and 123.3 continues after Architect acknowledgement.
   - **If BLOCKED:** the narrow additive owner-select policy (AD-123-16) is written only after the Architect accepts the report, and nothing else in RLS changes.
   - The Developer must not write any migration before this report is accepted.

**After the gate:**
- **User-side confirm dialog** (`role="alertdialog"`, focus trap, Escape = cancel) and **Undo toast** (`role="status"`, keyboard-reachable «ביטול», 5 s countdown). Both are new user primitives and import nothing from `src/admin` (AD-123-10).
  - The confirm copy states that all profiles and login details of the app will be deleted from all of the user's devices (arch §9).
- **App-actions menu entry «הסרת אפליקציה»** (always shown) → `requestRemoveApp(serviceId)` → confirm → `beginPendingRemoval(serviceId)` (FR-24/26).
  - The tile is hidden by UI-only pending state, with no write.
  - The toast starts.
  - `undoPendingRemoval()` → tile back, zero writes (FR-27).
- **New pure reducer `removeAppFromVault(state, serviceId)`** in `src/serviceManagement/serviceSelection.ts`. It removes:
  - the id from `selectedIds`;
  - all `accessProfiles` of the app;
  - their `credentials`;
  - the `customServices` entry when present.
- **`commitPendingRemoval() → 'removed' | 'failed'`**, a single operation in this order (AD-123-11):
  1. `bumpDualWriteGeneration`
  2. `removeUserServiceFromCloud`
  3. `persistVault(removeAppFromVault(...), { awaitCloudSync: true })`
  4. `removeUserServiceFromCloud` (re-verify)
  5. custom site only: `deleteCustomServiceRegistryRow`
- **Commit failures:**
  - Failure in steps 2–4 → tile reappears, Hebrew error (existing `SELECTION_REMOVE_CLOUD_FAILED_MESSAGE` or equivalent), local unchanged, result `'failed'`.
  - Failure in step 5 → the app is already removed for the user; one retry, then dev-warn only.
- The existing selection lock (`pendingIds` / `selectionLockRef`) covers the commit (arch §8). `changeSelection(id, 'remove')` is replaced by this orchestration; AD-123-11 supersedes AC-104-16.
- **Edge rules (AD-123-12):**
  - Only one pending removal at a time. A second removal request, logout (`handleLogout`), or vault lock (`handleLockVault`) commits the pending one immediately, before clearing the workspace.
  - Adding the same app from the catalog during the window commits the removal first, then adds the app fresh with no profiles. While pending, the catalog shows the app as not added.
  - Page close / reload during the window → nothing committed and no persisted pending state. This is PQ-123-1, recommended behaviour pending Tika; if Tika chooses the alternative, the Architect revises 123.3 before it closes.
- **Leftover cleanup on re-add (arch §7):** `addService` first applies `removeAppFromVault` semantics for leftover profiles / credentials of that app (from earlier AC-104-16 removals), then adds it. Old credentials never reappear. No cleanup at unlock.
- **After `'removed'` (FR-25/28/29):** no local profiles / credentials of the app; no cloud `user_services` / `access_profiles` / `encrypted_credentials` rows (cascade); no own custom registry row; no restore path.
- **Verify `scripts/verifyPhase123RemoveApp.mjs`:**
  - `removeAppFromVault` purity and coverage, built-in and custom;
  - commit order (instrumented fakes of the cloud functions);
  - Undo → zero writes;
  - failure in steps 2 / 3 / 4 → no local change and the tile is restored;
  - failure in step 5 → removed + one retry;
  - second removal / logout / lock commits the pending one;
  - re-add during the window → commit then fresh add with 0 profiles;
  - leftover cleanup on re-add;
  - no persisted pending state (static: no storage write in the pending path);
  - dialog / toast ARIA roles and Escape;
  - N-checks.
- **Mutations, at least:** step order swapped (local before cloud); Undo writes; failure keeps the tile hidden; step-5 failure reverts the user removal; pending persisted to storage; re-add keeps old profiles; `removeAppFromVault` keeps credentials; confirm uses `window.confirm`.

**Bindings added at opening (2026-10-05; arch Review Notes):**
- **AD-123-14 clarification:**
  - «עריכת פרטי האתר» requires BOTH: the app is in vault `customServices`, AND its runtime source is `user-created`.
  - A vault-custom id whose runtime source is the catalog (promoted) is catalog-origin: no edit entry, and removal deletes the membership only (step 5 matches no row).
  - Digital Home uses this single "custom" rule.
- **`showAppMenu` = any menu entry** (`edit_site_details || remove_app`). Since `remove_app` is always true, the menu shows for every app and every launch kind (AD-123-17).
  - The 123.2 AD-123-17 fixture changes: the every-launch-kind proof uses «הסרת אפליקציה» on built-in apps in all four launch kinds (`credentials`, `missing-user-credentials`, `no-stored-credentials`, `not-configured`).
  - Mutations: menu hidden for one launch kind; edit entry shown for a promoted (catalog-runtime) vault-custom id.
- **KI-3 ruling (removal of the last app seen from another window):**
  - An empty cloud membership stays "cannot verify" in general (D-109-25), EXCEPT for apps this session saw in the cloud at its last successful baseline read (login baseline / focus refresh). Those are reported gone and dropped like any other removed app.
  - Apps never seen in the cloud this session are kept.
  - Uses the existing in-memory baseline (`sessionSyncScope`); no schema / RPC change; fail-closed on read errors (a failed read changes nothing).
  - Any change in sync / hydrate needed for this must stay within that rule. If it needs more, STOP and report.
  - Verify (in `verifyPhase123Sync` or the 123.3 verify): last app removed in window A → window B, empty cloud on refresh, drops it; a never-seen app on an empty cloud is kept; a read error keeps everything.
  - Mutations, at least: an app seen in the cloud stays after removal elsewhere; a never-seen app is dropped on an empty cloud; a read error drops apps.
- **Already in this plan, restated as binding:** AD-123-11 commit order; AD-123-12 Undo edge rules; PQ-123-1 (page closed / reloaded during Undo = not removed, no persisted pending state).
- **Rules:**
  - T-1 per slice (`--no-mutations` + new / touched mutations, touched verifies incl. `verifyPhase123Sync`, `verifyPhase123D8OwnSite`, `verifyPhase123AppContext`, `verifyPhase123Catalog`, the Phase 122 admin verifies, `tsc`, build).
  - H-1 bounds.
  - **Final evidence = ONE clean sequential T-1 run on one frozen tree,** fingerprint vs the WIP commit (scope `-- src scripts supabase`) identical immediately before and after; no concurrent runs.
  - No site / hostname / serviceId branches; no browser dialogs; Hebrew RTL; no credential values or secrets in logs; no env / secrets access (Step 0 per MC-3).
- **Owner manual steps for 123.3** (remove flow, Undo, cross-window last-app removal, own-site registry row gone): go into the consolidated Owner run at the end of the phase. Mark them "awaiting Owner".

### Slice 123.4 — Navigation unification (AD-123-1, -9, -15) + END OF ROUND
- **`App.tsx`:**
  - Remove `'manage'` from `Screen`.
  - `resolvePostAuthScreen` / `handleAuthenticated` / `clearWorkspaceMemory` always land on Digital Home after login (FR-01).
  - Remove `manageIsFirstRun` / `onContinue` wiring.
  - The full-screen catalog error for 0 apps becomes the Digital Home empty state with the catalog modal's inline error (arch §8). Digital Home stays usable.
- **`Dashboard.tsx`:**
  - Remove «ניהול אתרים».
  - With 0 apps: empty state + «+ הוספת אפליקציה», and the catalog does not open automatically (FR-30).
  - Copy that refers to «ניהול אתרים» (e.g. the magic-moment hint) is updated in Hebrew.
- **Parity matrix (AD-123-9), written in `dev-phase123.md` before deletion.** Every ManageServices capability maps to its new home:
  - list → grid;
  - profiles / credentials → modal (123.1);
  - add / custom add → catalog (123.2);
  - custom edit + remove → app menu (123.2 / 123.3).
  - Rows cite file + symbol.
  - Any capability without a row is a STOP (stop rule), not a silent drop.
- **Delete `src/ManageServices.tsx`** and its now-dead imports and CSS. Keep anything still used by `AppCatalog`.
- **Admin-only aggregate "apps without profile" (AD-123-15):**
  - a counts-only admin read function from `user_services.created_at` / `access_profiles.created_at`;
  - no schema change, no credential data;
  - the admin UI and `src/admin/**` stay unchanged. The function is admin-gated through the existing admin check.
  - Its migration is the only one allowed in 123.4. Together with the possible AD-123-16 policy, these are the only migrations of the phase.
  - If exposing it to admins would require a change in `src/admin/**`, STOP and report to the Architect.
- **Verify `scripts/verifyPhase123Navigation.mjs`:**
  - no `'manage'` screen and no `ManageServices` import / file;
  - post-login → dashboard for 0 and > 0 apps;
  - empty state + «+ הוספת אפליקציה», no auto catalog;
  - no «ניהול אתרים» string in user `src/`;
  - parity-matrix symbols exist;
  - aggregate migration = counts only, admin-gated, no new table;
  - N-checks;
  - FR-01 reachability: every FR action has an entry point from Digital Home.
- **Mutations, at least:** post-login to a non-dashboard screen with 0 apps; «ניהול אתרים» restored; auto-open catalog on empty home; aggregate exposes non-count columns.
- **END OF ROUND:** full mutation sweep of all four `verifyPhase123*` scripts + `node scripts/runOfflineRegression.mjs`, with results and elapsed times in `dev-phase123.md`. (Superseded by the END OF ROUND binding below: ALL Phase 123 verifies, in one run.)

**Opened 2026-10-05** (slice 123.3 Architect PASS). Bindings added at opening:

**Precondition: WIP commit of the 123.3 tree (before any 123.4 change)**
- Sarah commits the Architect-approved 123.3 tree (fingerprint `664646a0…18af`, BASE `0dfb9de7`, scope `-- src scripts supabase`; recompute and confirm first) on local branch `wip/phase123-recovered`.
- Same rules as before: explicit paths only (no `git add -A` / `.`); team docs only under lowercase `team-yuri/` (no `team-Yuri/` paths); no `node_modules/.tmp`; no push, merge, `--no-verify` or amend; no other history change.
- After the commit, `git diff <hash> -- src scripts supabase` is empty and there are no untracked files under those paths.
- Report the hash in `dev-phase123.md` (123.4). **That commit is the 123.4 fingerprint baseline** (scope `-- src scripts supabase`).

**Bindings:**
- **Parity matrix cites the AD-123-14 single "custom" rule:**
  - the custom edit row uses `isUserCustomApp` (in vault `customServices` AND runtime `user-created`);
  - the remove row uses the same rule for step 5.
  - When ManageServices is deleted, no second "custom" rule remains in user `src/` (ends 123.2 dev Known Issue 2). Static check in `verifyPhase123Navigation`.
- **0 apps + failed catalog retry → Digital Home empty state + inline error.** This replaces the existing full-screen error (123.2 dev Known Issue 1, accepted only until 123.4).
  - Digital Home stays usable (header, lock / logout, «+ הוספת אפליקציה»); the catalog modal shows the inline error with its retry.
  - Verify: 0 apps + catalog load failure → dashboard with empty state + inline error, no full-screen error screen.
  - Mutation: full-screen error restored for 0 apps.
- **"Removed elsewhere" notice wherever the user can be.** The existing notice (AD-123-18 / KI-3 drop path) used to show on ManageServices too. With ManageServices gone, it must appear on Digital Home, including when the catalog modal or the floating window is open (Hebrew, `role="status"`, no browser dialog).
  - Verify: a drop while on Digital Home / with the catalog open shows the notice.
  - Mutation: the notice is only rendered on the removed screen / not rendered on Digital Home.
- **Orphan own registry rows (dev KI-7) and leftover `customServices` entries (123.3 dev KI-3): PROPOSAL ONLY.**
  - Sarah writes a proposal in `dev-phase123.md` (123.4): the cases, what the user sees today, the proposed user-side handling, its risks, and its tests.
  - Constraints: user side only; no automatic registry delete (no delete outside the explicit removal flow); no admin change; no schema / RLS / RPC change.
  - **Nothing is implemented until the Architect decides.** If the decision comes during 123.4, it is added to this plan first.
- **KI-1 (owner edit vs admin draft): Owner decision 2026-10-05: stays as today**, moved to the backlog for a future phase. Not part of 123.4.

**END OF ROUND (binding):**
- ONE clean sequential run on one frozen tree, containing:
  - the full mutation sweeps of ALL Phase 123 verifies (`verifyPhase123AppContext`, `verifyPhase123Catalog`, `verifyPhase123CatalogGate`, `verifyPhase123Sync`, `verifyPhase123FixD6D8`, `verifyPhase123D8OwnSite`, `verifyPhase123RemoveApp`, `verifyPhase123Navigation`);
  - `node scripts/runOfflineRegression.mjs`;
  - the 43 admin verifies (40 × `verifyPhase121*`, `verifyPhase122AdminNotes`, `verifyPhase122SubmitterProfiles`, `verifyPhase122AdminWorkspace` full);
  - the touched verifies; `npx tsc -b`; `npm run build`.
- Fingerprint vs the 123.4 WIP commit (scope `-- src scripts supabase`) taken immediately before and after, identical. No concurrent runs.
- Results with elapsed times per job in `dev-phase123.md`.
- H-1 bounds apply; a timeout is a FAIL.

**Rules:** T-1 per slice before END OF ROUND; H-1; no site / hostname / serviceId branches; no browser dialogs; Hebrew RTL; no credential values or secrets in logs; no env / secrets / live DB access. The AD-123-15 migration is the only migration allowed, and is STOP if `src/admin/**` would change.

**Owner manual steps for 123.4** go into the consolidated Owner run, marked "awaiting Owner":
- login lands on Digital Home (0 / > 0 apps);
- no «ניהול אתרים»;
- empty state;
- catalog failure inline;
- "removed elsewhere" notice;
- admin aggregate visible to admins only.

## Acceptance / Gating Criteria
- **G-1:** every slice satisfies N-1…N-8 and the T-1 command set, with PASS lines and elapsed times in `dev-phase123.md`.
- **G-2:** each slice's verify covers its FR rows (FR table below), and every listed mutation fails the script when applied.
- **G-3:** the only superseded legacy assertions edited are those of AD-123-5 / AD-123-11 (AC-104-16) / AD-123-13 / AD-123-1. Each is listed with its AD.
- **G-4:** 123.3 Step 0 report present and accepted before any 123.3 product code or migration. Migrations in the phase are limited to the AD-123-15 aggregate and, only if BLOCKED was reported and accepted, the AD-123-16 policy.
- **G-5:** 123.4 parity matrix complete before `ManageServices.tsx` is deleted.
- **G-6:** END OF ROUND after 123.4: full sweep + `runOfflineRegression.mjs` PASS.
- **G-8 (AD-123-17):** from 123.2 on, the app-actions menu is reachable for every launch kind, enforced by a check plus a mutation in `verifyPhase123Catalog.mjs`. 123.3 extends both to «הסרת אפליקציה».
- **G-9 (R-123-1):** the three Phase 121 verifies are re-baselined and PASS before the 123.4 END OF ROUND, with no weakened assertion or mutation and `extension/**` untouched.
- **G-11 (joint resubmission):** one frozen tree, with a fingerprint that is identical before and after the Manager review. H-1 is met: every browser verify is bounded, a timeout fails the run, the bite proof is shown, and the M1–M13 single run and the M7–M9 chain ×3 complete.
- **G-12 (amendment A / 123.2b):** amendment A rules (i)–(iii) each covered by a check plus a mutation, with the crypto.ts / vault.ts diff limited to the outbox field. The AD-123-19 listing / add gate is covered by a check plus a mutation, the admin diff is a re-export only, and the hidden-site count is reported.
- **G-10 (C-123.1-1):** the Owner's combined manual run (123.1 + 123.2 tables) is recorded in `dev-phase123.md` before 123.3 opens.
- **G-7:** stop rule respected. No PRD behaviour changes for technical reasons without Architect approval.

### FR traceability (from arch; slice that delivers / verifies)

| FR | Behaviour (arch) | Slice | Verify |
|---|---|---|---|
| FR-01 | Every MVP action reachable from Digital Home; no `manage` screen | 123.4 | Navigation |
| FR-02 | Tile click opens the floating window | 123.1 | AppContext |
| FR-03 | One tile per app with ≥ 2 profiles | 123.1 | AppContext |
| FR-04 | Exactly one default whenever ≥ 1 profile | 123.1 | AppContext |
| FR-05 | Switching changes active profile; stored default unchanged; reopen → default | 123.1 | AppContext |
| FR-06 | Default changes only via the modal action | 123.1 | AppContext |
| FR-07 / 08 | «עריכת פרופיל» opens the central modal on the active profile (≤ 2 actions) | 123.1 | AppContext |
| FR-09 | «הוספת פרופיל» creates exactly one profile on save | 123.1 | AppContext |
| FR-10 / 11 / 12 | Delete profile incl. last → 0-profile state, no dot, empty state | 123.1 | AppContext |
| FR-13 | Delete default: ≥ 2 remaining → choose; 1 remaining → auto | 123.1 | AppContext |
| FR-14 / 15 / 16 | Catalog as a large central modal; search; categories | 123.2 | Catalog |
| FR-17 | Added app marked; no duplicate tile | 123.2 | Catalog |
| FR-18 | Add from catalog creates no profile | 123.2 | Catalog |
| FR-19 | Custom add from the catalog | 123.2 | Catalog |
| FR-20 | «עריכת פרטי האתר» only for custom sites | 123.2 | Catalog |
| FR-21 / 22 / 23 | Dot for ≥ 1 profile, also without credentials; no count / text | 123.1 | AppContext |
| FR-24 / 26 | Remove from the app menu behind the confirm dialog | 123.3 | RemoveApp |
| FR-25 | After commit: no profiles / credentials locally or in the cloud | 123.3 | RemoveApp |
| FR-27 / 28 | Undo for 5 s restores without writes; after expiry no restore path | 123.3 | RemoveApp |
| FR-29 | Custom site removal deletes the own registry row | 123.3 | RemoveApp |
| FR-30 | 0 apps → empty state + «+ הוספת אפליקציה» | 123.4 | Navigation |

## Functional Testability Criteria
- **Page:** the user app, `http://localhost:5173/` (via `npm run dev`), Digital Home after login.
- **User-visible behaviour per slice:**
  - **123.1:** tile → floating window.
    - 0 profiles: empty state + «הוסף פרופיל», no dot.
    - 1 profile: dot, «עריכת פרופיל» / «הוספת פרופיל».
    - ≥ 2 profiles: switcher, opens on the default, and reopening returns to the default.
    - Modal: add / edit / delete incl. last; choose new default when deleting the default with ≥ 2 remaining.
  - **123.2:** «+ הוספת אפליקציה» → central catalog modal; search / categories; added apps marked; add → tile without dot; custom add; «עריכת פרטי האתר» only on custom apps.
  - **123.3:** app menu «הסרת אפליקציה» → confirm → tile hidden + Undo toast (5 s). «ביטול» restores. Expiry → app gone locally and in the cloud (custom row too). A cloud failure brings the tile back with a Hebrew error.
  - **123.4:** login always lands on Digital Home; no «ניהול אתרים»; an empty home shows «+ הוספת אפליקציה».
- **CLI:** `node scripts/verifyPhase123AppContext.mjs`, `verifyPhase123Catalog.mjs`, `verifyPhase123RemoveApp.mjs`, `verifyPhase123Navigation.mjs` (T-1 switches); `node scripts/runOfflineRegression.mjs` at END OF ROUND.
- **API:** nothing new for users (existing tables / functions). Admins get the aggregate read (123.4).
- **Minimal end-to-end flow (after 123.4):**
  1. Start from an empty home and add an app from the catalog: no profile, no dot.
  2. Open the app: empty state.
  3. Add a profile: dot appears.
  4. Edit the password, then add a second profile.
  5. Delete the default and choose the new default.
  6. Delete the remaining profiles: no dot.
  7. Remove the app, press Undo, then remove it again.
  8. Wait 5 s: the app is gone locally and in the cloud.
- **Expected result:** every PRD MVP action completes inside Digital Home. Admin unchanged.

## Required Developer Evidence (`team-Yuri/dev-phase123.md`, one section per slice)
- Phase id + slice id.
- Implementation summary.
- Files changed (path + one line each).
- Dependencies: none expected; any addition needs Architect approval.
- Unit / verify commands and results: the full T-1 set with PASS lines and elapsed times. The mutation ids run and their FAIL-under-mutation confirmation.
- Lint / type commands and results: `npx tsc -b`, `npm run build`.
- Functional testability: manual steps performed on `localhost:5173` for the slice.
- Docs updated or why not.
- Superseded legacy assertions (script / assertion / AD).
- N-1…N-8 compliance (incl. `git diff --stat -- src/admin` output).
- Known issues: any stop-rule items, marked BLOCKED.
- Scope compliance: nothing from later slices implemented.
- Declaration.
- 123.3 additionally: the Step 0 AD-123-16 report (before anything else in the section).
- 123.4 additionally: the parity matrix and END OF ROUND results.

## Out of Scope
- Admin area (`src/admin/**`, `#/admin`, admin RPCs / policies). One side effect is accepted by arch §8.11: removing a pending custom site removes it from the admin queue.
- Auth, unlock, key derivation, encryption, `persistVault`, sync algorithm, RLS of user tables, schema changes.
- Login / autofill execution, the extension, the manifest.
- Registry / approval model, catalog data model, analytics SDK, PRD §13 Phase 2 (Undo usage, funnels, credential-failure analysis).
- Pre-existing P-1 (beyond the conditional AD-123-16), P-3, P-4.
- One-time cleanup of local leftovers at unlock.
- Persisted Undo / pending-removal state.

## Risks / Open Questions
- **T-1 (arch):** green-dot meaning changes from complete credentials to has-profile. Accepted (§8.8). Legacy auto-created empty «ראשי» profiles now show a dot; the user can delete them.
- **T-2:** losing a ManageServices capability. Mitigated by the 123.4 parity matrix and STOP on any gap.
- **T-3:** floating-window complexity. Only the listed actions are allowed.
- **T-4 / PQ-123-1:** page close during Undo = not removed. Recommended behaviour, pending Tika; the Architect revises 123.3 if Tika chooses the alternative.
- **T-5:** a step-5 failure leaves an orphan own registry row. Low impact; one retry + dev-warn.
- **Manager note:** `deleteCustomServiceRegistryRow` does not detect a 0-row delete. The 123.3 Step 0 proof must read the row independently. If BLOCKED, any detection change belongs to the Architect's response, not to the Developer.
- **Manager note:** several legacy verifies (Phase 104 / 109 / 113) likely assert superseded behaviour. G-3 controls how they are edited.
- **Manager note:** non-form credential entries (`resolveCredentialEntry(...).kind !== 'form'`) keep today's gating of profile UI. If PRD FRs require profile UI for them, apply the stop rule.

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED (round 1, 2026-10-05) — slice 123.4 + END OF ROUND, frozen tree sha256=fef52c66c81fe5c8a95661f0a0cb5172ccc1df7cb536c3554e1e5a84611a3ac6 (BASE WIP `c700cd60`, scope `-- src scripts supabase`). Handed to the Architect. The consolidated Owner run is a carried condition before phase close. Previous: slice 123.3 CHANGES REQUIRED round 1 (documentation only) → RC-1 closed by dev KI-7 → Architect PASS (2026-10-05) — slice 123.3 on frozen tree sha256=664646a004d28fe107964527e69b2dfc6c5ec9e88aa9d5e87f2060a8d6c318af (BASE `0dfb9de7`, scope `-- src scripts supabase`). Code and tests pass all review criteria; one Known Issue required by the Architect is missing from the evidence (RC-1). No code change and no re-run are needed (team docs are outside the fingerprint scope). Then hand off to the Architect. Previous: fix round D-123-6…8 APPROVED (round 1), Architect PASS (2026-10-05), frozen tree sha256=1de67427489e2d49eb5d6a8ff377c2ab17572e420e316d8a738bd4b6af49e387; Owner re-check moved to the consolidated end-of-phase run. Previous: APPROVED (round 2), Architect PASS (conditional) — joint resubmission: fix round D-123-1…5 + AD-123-18 + amendment A + H-1 + Known Issue 5, and slice 123.2b (AD-123-19 + addenda (a)/(b)), frozen tree sha256=c06950a50486cfef9fcfd041622aebbd3e5dfaa7a3d85e99038d9dff93ff1c21. Handed to the Architect. Owner items are carried as conditions. (Earlier: fix round round 1 BLOCKED; slice 123.2 + R-123-1 APPROVED round 1; slice 123.1 APPROVED round 2.)

### Review Notes
Slice 123.4 + END OF ROUND, Manager review round 1 (2026-10-05) — **APPROVED → Architect review.**
- **Frozen tree:**
  - HEAD `c700cd60` (WIP 123.4 baseline), no commit after it.
  - The fingerprint (`$env:TEMP\pv-fingerprint-123-4.mjs`, BASE `c700cd60`, scope `-- src scripts supabase`) is `fef52c66…3ac6` before and after all Manager runs (21 tracked changed incl. the deleted `src/ManageServices.tsx`, 2 untracked). 0 other runners at start.
- **1. Parity matrix:**
  - 17 rows (+ 5a) in `dev-phase123.md`, each citing file + symbol. Every ManageServices capability maps to a Digital Home location (grid, floating window, single profile host, catalog modal, app menu, Dashboard banner / header) or to a documented retirement: row 16 «לבית הדיגיטלי» (navigation only, duplicate re-persist), and row 5a (informational line not repeated, dev KI-1).
  - The matrix references `c700cd60` symbols, and `verifyPhase123Navigation` checks that 25 matrix symbols exist.
  - "Written before deletion" is the Developer's declaration. There is no intermediate commit, so git cannot prove the order; the content is consistent with it.
- **2. One "custom" rule:**
  - Edit-site (`openSiteDetailsEdit`), remove step 5 (`beginPendingRemoval` `deleteOwnRow`) and the panel menu all use `isUserCustomApp`. `checkSingleCustomRule` + M11 enforce it; no `edit_site_details` / `deleteOwnRow` decision exists elsewhere.
  - No hostname / serviceId branch, `window.confirm` / `alert` / `prompt` in the added lines.
  - *Observation O-1 (non-blocking):* six `source === 'user-created'` checks remain in user `src/`, all pre-existing at `c700cd60` with identical counts: `App.tsx` ×2 (merge / dedupe), `catalogVisibility` (AD-123-19 (b) own_site gate), `addCustomServiceOutcome` (duplicate classifier), `credentialSchema` / `credentialsGate` (custom form default), `customServiceDiscovery` (source attribution). They're source attribution, not custom-app action rules, so the binding is met. The dev sentence "no `source === 'user-created'` decision left in user `src/` outside `appContext.ts`" overstates it.
- **3. Empty state / inline error / notice:**
  - 0 apps → `[data-home-empty]` with Hebrew copy and a central «+ הוספת אפליקציה». The catalog opens only through `onOpenCatalog` (no auto-open; M3).
  - Catalog failure → Dashboard banner + modal inline error with «נסו שוב»; `retryCatalogLoad` no longer resets `catalogHydrated` (no full-screen error / loading; M7).
  - "Removed elsewhere" notice: `.dh-reconcile-notice`, `role="status"`, `dir="rtl"`, above the catalog overlay and the floating window. It is browser-checked on the plain home, above the open catalog (`elementFromPoint`) and with the window open (M8–M10). No native dialog in any group.
- **4. AD-123-15 migration:**
  - `public.admin_apps_without_profile_counts()`: `security definer`, `set search_path = public`; first statement `if not public.is_admin() then raise exception`.
  - Returns exactly 8 `bigint` counts from `user_services.created_at` / `user_id` and `min(access_profiles.created_at)`. No ids / names / URLs / credential data. No DDL on tables / policies, no writes.
  - `revoke all … from public, anon`; `grant execute … to authenticated`.
  - PGlite proves: anon denied, non-admin / disabled admin / no session refused, admin gets one row of 8 exact counts (M4 / M5 / M6 / M13).
  - Not applied (Owner instructions recorded). `git diff c700cd60 -- src/admin` empty.
- **5. Frozen files:**
  - `src/execution`, `src/digitalHome/cloudReconcile.ts`, `src/supabase/**`, `src/admin`, `extension/` and package files: no diff vs `c700cd60`; `supabase/` = the one new migration only.
  - The `assistanceActions.ts` override maps `status === 'credentials_missing'` to `MSG_AUTOFILL_CREDENTIALS_MISSING` before any execution `userMessage` is used (M14 caught).
  - *Observation O-2 (cosmetic):* in `src/loginAssistance/messages.ts` the AD-123-1 doc comment sits above `MSG_REMOVED_ELSEWHERE_PLAIN` instead of `MSG_AUTOFILL_CREDENTIALS_MISSING`.
- **6. `verifyPhase123Navigation`:** the Manager re-run gives 12 groups / 15 mutations caught (1m 17s). The evidence shows one sequential loop per attempt with a 0-runner check before each; no concurrent runs.
- **7. END OF ROUND history:**
  - Attempt 1 (tree `7d9ca62d`): FAIL on a stale RemoveApp M8 anchor. It was re-anchored to the same mutation (still caught), then re-frozen.
  - Attempt 2 (`fef52c66`): 62/63; AdminWorkspace hit the 30-min job bound but passed inside `runOfflineRegression` in 3159 s.
  - Attempt 3: shell interrupted at job 52.
  - Attempt 4: 63/63 clean, 114 min, fingerprint identical.
  - The bound change (30 → 90 min per job, equal to `runOfflineRegression`'s per-script bound) lives in the runner loop only. No repo file changed, so no assertion was weakened. AdminWorkspace in attempt 4: 32 groups / 74 mutations in 46m 11s.
- **Manager re-runs on the frozen tree (sequential, all exit 0):**
  - `verifyPhase123Navigation` (full) 12 / 15;
  - `verifyPhase123RemoveApp --no-mutations` 13;
  - `verifyPhase123D8OwnSite` (full) 10 / 20;
  - `verifyPhase123AppContext --mutations=M3,M8,M10..M15` 23 / 8;
  - `verifyPhase123CatalogGate` (full) 8 / 20; `verifyPhase123Sync` (full) 15 / 35;
  - touched: 113, 104, ServiceSourceOwnership, 109, 102;
  - admin sample: 121DeleteService (43), 122AdminNotes (8), 121IframeSurface;
  - `npx tsc -b` exit 0; `npm run build` exit 0.
  - The full END OF ROUND set (63 jobs incl. `runOfflineRegression` 88/88 and AdminWorkspace full) is accepted from the evidence.
- **Flags for the Architect (not decided by the Manager):**
  - (a) **D8OwnSite superseded assertion outside the G-3 list:** `checkHydrateScope` drops `supabase` from the unchanged list and instead allows exactly one path, the AD-123-15 migration file. Every other `supabase/` path must stay unchanged. Narrow, but it cites AD-123-15, which is not in G-3.
  - (b) **Developer's own-call deviations:**
    - focus return to the tile after the profile host closes (AC-113-45 kept and re-homed; M15);
    - the copy override in `assistanceActions.ts` for the frozen execution `credentials_missing` text (M14);
    - `MSG_REMOVED_ELSEWHERE_PLAIN` placed in `loginAssistance/messages.ts` so `cloudReconcile.ts` stays frozen.
  - (c) **Cleanup proposal P1 / P2:** proposal only, nothing implemented. P1: local drop of a leftover own `customServices` entry in `dropGoneFromVault`. P2: an explicit «מחיקת האתר שלי» catalog action using the existing owner delete.
  - Also for awareness: dev KI-2 (× on the notice also closes an open floating window, as an outside click); KI-3 dead code kept; O-1 / O-2 above.
- **Carried condition:** the consolidated Owner run (D-123-6…8, `[catalog-gate]` count, 123.3 steps, 123.4 steps incl. the AD-123-15 apply / admin call / refusals) before phase close.

2026-10-05: **slice 123.3 Architect PASS** (arch Review Notes "Slice 123.3 Architect review (2026-10-05): PASS").
- **RC-1 CLOSED:** dev Known Issue 7 was added (documentation only). The Manager confirmed the fingerprint `664646a0…18af` is unchanged (HEAD `0dfb9de7`).
  - KI-7 corrects the Manager's trace in two places: a *pending* own row returns to the catalog after the next refresh / login (not immediately); an *active* row stays listed. The Architect accepted KI-7 as written; it supersedes the Manager trace in round 1.
- Accepted by the Architect: Known Issues 1–3 and 7. For 123.4 consideration: orphan own rows and leftover `customServices` entries (proposal only, see 123.4).
- **Owner decision on KI-1 (owner edit vs admin draft):** stays as today and goes to the backlog for a future phase, not 123.4.
- **Slice 123.4 + END OF ROUND opened** with:
  - the WIP-commit precondition (it becomes the 123.4 baseline);
  - bindings: parity matrix cites the AD-123-14 single custom rule; 0 apps + failed catalog → empty state + inline error; the "removed elsewhere" notice on Digital Home; orphan / leftover cleanup as a proposal only;
  - END OF ROUND as one clean sequential run of all Phase 123 sweeps + offline regression + 43 admin verifies + `tsc` / build.
- The 123.4 Owner steps go into the consolidated Owner run.

Slice 123.3, Manager review round 1 (2026-10-05) — **CHANGES REQUIRED (documentation only, RC-1).** Everything else passes.
- **Frozen tree:**
  - HEAD `0dfb9de7` (Sarah's WIP baseline on `wip/phase123-recovered`).
  - The fingerprint (`$env:TEMP\pv-fingerprint-123-3.mjs`, BASE `0dfb9de7`, scope `-- src scripts supabase`) is `664646a0…18af` before and after all Manager runs, matching the evidence (14 tracked + 3 untracked).
  - `git diff 0dfb9de7` of `src/admin`, `extension`, `supabase`, `package.json`: empty.
- **Item 0a (KI-5):**
  - `ownSiteFollowsRegistry` (approved + category + icon) is the one shared helper, used by `resolveOwnSiteDefinition` and the hydrate block.
  - The `persistence.ts` hydrate change is the block predicate + import only.
  - M18–M20 are added to `verifyPhase123D8OwnSite` (10 groups / 20 mutations).
- **Step 0:** DELETED, accepted by the Architect (MC-3 Owner SQL, 0 rows). No migration.
- **AD-123-11 order** (`App.tsx` `changeSelection(id, 'remove', {deleteOwnRow})`):
  - `bumpDualWriteGeneration` → `removeUserServiceFromCloud` → `persistSelectionState(removeAppFromVault, {awaitCloudSync: true})` → `removeUserServiceFromCloud` (re-verify) → `deleteOwnCustomRow` (user-created custom only).
  - Step 2 fails → return before any local write; `SELECTION_REMOVE_CLOUD_FAILED_MESSAGE`.
  - Step 3 / 4 fails → `restoreLocalAfterFailedRemove(previous)` = `persistVault(previous, { skipCloudSync: true })`, i.e. local-only, never synced (N-3 pin "every added call is local-only" unchanged). `vaultStateRef` / state are not advanced, so the tile comes back. `commitPendingRemoval` sets the Hebrew `role="alert"` banner and returns `'failed'`.
  - Step 5: one retry, dev-warn only, never throws or reverts.
  - Browser-verified with instrumented fakes (order, step 2 / 3 / 4 failures, retry).
- **AD-123-12 / PQ-123-1:**
  - The pending state lives in a React state + ref only; no storage write in request / begin / undo (static + reload group).
  - A second request, logout / lock, a catalog re-add of the pending id, and a custom add with the same URL identity all commit first. The catalog shows the pending app as not added.
  - Re-add starts with 0 profiles (arch §7 leftover cleanup in `addToSelection`).
- **AD-123-14 + `showAppMenu`:**
  - `isUserCustomApp` = in vault `customServices` AND runtime `user-created`. It drives the edit entry, `openSiteDetailsEdit` and the step-5 decision; a promoted id gets remove only.
  - `showAppMenu = showEditSiteDetails || showRemoveApp`.
  - Browser-proven: «הסרת אפליקציה» on built-in apps in all four launch kinds (RemoveApp) and in the Catalog menu group.
- **KI-3:**
  - `sessionSyncScope.cloudServiceIds` is set from the login baseline and replaced on every successful refresh read.
  - In `refreshWorkspaceFromCloud`, an empty cloud drops only local apps that are in the previous seen set (`dropGoneFromVault`). Never-seen apps are kept (`null`, as before); read errors return `null` before the seen set is touched.
  - No schema / RPC change; the dual-write `canReportGone` is unchanged.
  - `verifyPhase123Sync` 15 groups / 35 mutations (M31–M35).
- **Superseded assertions (8):** narrow. Each replaces only the pre-123.3 "no remove-app" / protected-file / pin text with the AD-123-11 / -12 / -14 / KI-3 / KI-5 equivalent, with a comment naming the decision.
  - The N-3 count allows exactly +1 `persistVault` call, and the "added calls are local-only" pin stays.
  - The promoted-id edit path is asserted absent, not removed.
- **Manager re-runs on the frozen tree (sequential, all exit 0):**
  - `verifyPhase123RemoveApp` (full) 13 / 20;
  - `verifyPhase123Sync` (full) 15 / 35;
  - `verifyPhase123D8OwnSite` (full) 10 / 20;
  - `verifyPhase123AppContext --mutations=M3,M8,M10..M15` 23 / 8;
  - `verifyPhase123Catalog --mutations=M1..M18` 19 / 18;
  - `verifyPhase123CatalogGate --no-mutations`; `verifyPhase104ServiceManagement`;
  - admin sample: `verifyPhase121DeleteService` (43), `verifyPhase122AdminNotes` (8), `verifyPhase122SubmitterProfiles` (5), `verifyPhase121IframeSurface`;
  - `npx tsc -b` exit 0.
  - The 70-job single sequential run and the build are accepted from the evidence.
- **Architect question: step 5 fails after its retry. Answer: YES, the removed own site still appears in the owner's catalog. It is NOT in the Known Issues → RC-1.** Code trace:
  - The own row is `source_type='user'` → runtime `source='user-created'` → `catalogGateState` = `own_site` → always listed (AD-123-19 (b)).
  - `mergeCustomDefinitions` keeps registry-only own rows from `catalogDefinitions`, so the site stays in the runtime list after its vault copy is removed.
  - At the next login, hydrate adds the row back into vault `customServices` ("a row with no local copy is still added"; not selected).
  - What the user sees:
    - no error (dev-warn only);
    - the tile is gone;
    - the site is still listed in the catalog under its category as not added, with the add action;
    - adding it creates a fresh app with 0 profiles; old credentials don't return;
    - nothing retries the delete later, so the row stays until the user adds and removes it again or an admin deletes it;
    - the admin still sees the row (e.g. as a pending submission).
- **Known Issues 1–3:** pre-accepted by the Architect (the leftover `customServices` entry is for 123.4). KI-4…6 are noted, not blocking.

2026-10-05: **fix round D-123-6…8 Architect PASS** (arch Review Notes "Fix round D-123-6…8 Architect review (2026-10-05): PASS").
- Accepted: D-123-6, D-123-7, D-123-8 per rulings 1–5, the two additions, and Known Issues 1–4 (KI-1 → backlog, Owner decision before 123.4).
- Flag 1 (KI-5) accepted for this round and made the binding first item of 123.3. Flag 2 (notice trigger) accepted and checked in the consolidated Owner run.
- **Gate change (Owner preference):** the Owner re-check of D-123-6…8 and the `[catalog-gate]` count move into ONE consolidated Owner run at the end of the phase (after 123.4 + END OF ROUND). 123.3 opens now. Accepted risk (Architect): a live-only D-123-8 / hydrate defect may surface late; mitigated by the automated verifies.
- **Slice 123.3 opened** with these bindings:
  - precondition: WIP commit of the approved tree (it becomes the fingerprint baseline);
  - Item 0a (KI-5: shared completeness predicate in the hydrate block);
  - Step 0 per MC-3;
  - the KI-3 ruling (empty cloud: drop only apps seen in the cloud at the last successful baseline read);
  - the AD-123-14 clarification and `showAppMenu` = any entry (proven with «הסרת אפליקציה» on built-ins in all four launch kinds);
  - AD-123-11 / AD-123-12 / PQ-123-1;
  - one clean sequential T-1 run.
- The 123.3 Owner manual steps go into the consolidated run.

Fix round D-123-6…8, Manager review round 1 (2026-10-05) — **APPROVED → Architect review.**
- **Frozen tree:**
  - Branch `wip/phase123-recovered`, HEAD `af881f6b`.
  - The fingerprint (`$env:TEMP\pv-fingerprint-d8.mjs`, scope `-- src scripts supabase` vs `af881f6b`; team docs outside the scope) was recomputed before and after all Manager runs: `1de67427…e387` both times. It matches the evidence (tracked_changed=12, untracked=3).
- **Hydrate, N-2 exception:**
  - `git diff af881f6b -- src/supabase/persistence.ts` = exactly the `isApprovedForUsers` import + the 5-line own-site block inside the `customRows` loop of `hydrateWorkspaceFromCloud`. It matches the full diff quoted in the evidence.
  - The rest of the file is byte-identical to `af881f6b` (asserted by `verifyPhase123D8OwnSite`, mutation M7 caught).
  - A row with no local copy is still added; an unreadable row falls into the existing `catch`.
  - No diff vs `af881f6b` in `src/vault`, `src/service`, `src/registry`, `src/execution`, `src/supabase/registryPersistence.ts`, `supabase/` or `extension/`. `src/admin` = only the D-123-6 line.
- **One resolved definition (item 2):**
  - `resolveOwnSiteDefinition` returns the registry entry whole when approved (fail-closed `isApprovedForUsers`: no entry / throw → false), else the vault copy whole. No mixing.
  - `mergeCustomDefinitions` keys every vault copy through it; the old overlay that took registry `loginFields` / `metadata` is removed (App catalog merge rule).
  - The result feeds `legacyCustomServices`, i.e. the one `Service` used by the window, launch kind, login URL, execution and managed autofill.
  - No execution / autofill file changed; `verifyPhase117ManagedAutofill` and `verifyPhase103Execution` pass.
  - `legacyBuiltinServices` drops ids in `customServiceIds`, so an in-place-promoted global is represented only by the resolved own entry.
- **Notice (item 5):**
  - Shown only when `isCustom && ownSiteApproved` + profile UI + active profile + form entry + a non-blank stored key the form doesn't show.
  - Hebrew copy exact, `role="status"`, no browser dialog. Exactly one «עריכת פרופיל» (the bar button is hidden while the notice shows).
  - Display by field id; no write path added.
- **Verify `verifyPhase123D8OwnSite`:**
  - 9 groups / 17 mutations. M1–M13 cover the 11 required mutations: M10 + M11 for position / label, M4 + M5 for the two approval-lost variants, M12 + M13 for notice missing and catalog login fields. M14–M17 are extra.
  - The v0 → v1 → v2 hydrate sequence proves "last approved version, never the newer edits, never the original".
- **Superseded AppContext assertion:** narrow. `hydrateWorkspaceFromCloud` must equal BASE `909cc8b` after removing the exact D-123-8 block, which must occur exactly once; the other 8 pinned functions stay byte-identical. The test-only re-pin `HEAD` → `909cc8b` is as accepted by the Architect.
- **The two additions beyond the ruling:**
  - *Resolver fallback for an approved entry without category / icon:* fail-closed toward the vault copy (crash guard for tile rendering), in the same direction as the ruling. No new behaviour outside D-123-8. It is not mirrored in hydrate; see flag 1.
  - *Panel reposition:* only adds `showFieldsUpdated` to the existing `useLayoutEffect` dependency list, so the panel repositions when the notice changes its height. No new behaviour.
- **Manager re-runs on the frozen tree (sequential, all exit 0):**
  - `verifyPhase123D8OwnSite` (full) PASS 9 / 17;
  - `verifyPhase123FixD6D8` (full) PASS 6 / 9;
  - `verifyPhase123Sync` (full) PASS 14 / 30;
  - `verifyPhase123AppContext --mutations=M3,M8,M10..M15` PASS 23 / 8;
  - `verifyPhase116CustomAddIdentity` PASS (R1–R12);
  - `verifyPhase123CatalogGate --no-mutations`, `verifyPhase117ManagedAutofill`, `verifyPhase103Execution` PASS;
  - admin sample: `verifyPhase121DeleteService` (43 mutations), `verifyPhase122AdminWorkspace --no-mutations` (32 groups), `verifyPhase122AdminNotes` (8 mutations), `verifyPhase121IframeSurface` PASS;
  - `npx tsc -b` exit 0.
  - The full 68-job sequential run and the build are accepted from the evidence: one run, with the same fingerprint before and after.
- **Known Issues 1–4:** pre-accepted by the Architect. KI-1 (owner edit overwrites a pending admin draft) is a backlog Owner decision before 123.4.
- **Flags for the Architect (not blocking at Manager level):**
  1. **KI-5, resolver vs hydrate asymmetry:** hydrate refreshes on approval alone, while the resolver also requires a category / icon. For an approved row without category / icon, the next unlock replaces the vault copy with that row. The resolver then shows it whole as "not approved", so no notice appears. It was possible before and is rare; please confirm, or rule that hydrate should mirror the guard (that would widen the N-2 diff).
  2. **Notice trigger:** any non-blank stored key not in the current form raises it (own approved sites only). If a credential can hold non-field keys for a custom site, the notice could show without a field change. The verify's "nothing hidden → no notice" case uses clean fixtures. Please confirm, or have the Owner re-check cover it.
  3. **No live reproduction:** the evidence says there were no Owner credentials and env / DB were kept off-limits. The harness verify covers the rulings; the Owner re-check is the live confirmation.
  4. **Owner re-check pending:**
     - item 4 (if still open);
     - D-123-6 approve message;
     - D-123-7 (create / edit keep the typed URL, www / non-www recognised);
     - D-123-8 (an admin edit has no effect until approval; after approval with changed fields, the notice + «עריכת פרופיל» appear; a re-edit that drops approval keeps the last approved version; globals as today).
- **Gate:** 123.3 stays closed until Architect PASS on D-123-6…8 and the Owner re-check is recorded.

2026-10-05, Architect rulings after Sarah's D-123-8 Step 1 BLOCK (arch Review Notes "D-123-8 rulings after Step 1"):
- The BLOCK was correct. Step 1 facts are accepted: hydrate overwrites the own-site vault copy on every unlock; the App catalog merge takes registry login fields; values are hidden, not deleted.
- **D-123-6 / D-123-7:** accepted at Architect level, final review with D-123-8. They're marked DONE in the plan. The test-only re-pin of the three Phase 123 verifies to `909cc8b` is accepted.
- **D-123-8 is released**:
  - own custom sites only, permanently; globals unchanged;
  - the vault copy is the last version the owner may see;
  - the registry applies only while `approved` (hydrate then refreshes the vault copy); a loss of approval keeps the last approved version; unknown approval keeps the vault copy;
  - one definition for window / launch kind / login URL / execution / autofill;
  - no automatic move on promotion under a new global id;
  - the notice applies to own sites only.
- **N-2 exception approved, narrow:** the own-site merge in `hydrateWorkspaceFromCloud` (replace the vault copy only when approved) and the App catalog merge (no registry login fields for non-approved own sites). Nothing else.
- The plan's D-123-8 section is updated: implementation rules, verify, and 11 mutations (incl. the 8 named by the Owner); the hydrate diff must be quoted in full.
- **Final evidence:** ONE clean sequential T-1 run on one frozen tree, with the fingerprint vs `af881f6b` (excluding `team-Yuri/`) identical before and after. The earlier concurrent double run doesn't count.
- 123.3 stays closed.

2026-10-05, after the incident:
- The Owner's checkpoint restore undid the D-123-6…8 section first written on 2026-10-04. Recovery is ACCEPTED by the Architect (arch Review Notes "Incident …"): the tree is the frozen joint resubmission, committed as WIP `af881f6b` on local branch `wip/phase123-recovered`. The Manager confirmed the branch and commit.
- The joint-resubmission Architect PASS (conditional) stands.
- The section "Fix round D-123-6…8" is re-added, with D-123-8 as REVISED by the Owner (vault copy until the registry entry is approved) and the four Architect additions:
  1. live reproduction allowed in TEST via the app UI, with read-only DB queries, no credential values, and the harness still required;
  2. a notice-scope report for global sites;
  3. the D-123-6 superseded admin assertion;
  4. D-123-7 identity fixes on the user side only.
- **Manager note for the Architect:** the earlier addition said "no live DB, no real account" for the D-123-8 reproduction. The Owner relayed the revised rule (live, TEST environment, read-only queries) on 2026-10-05; it is not yet in `arch-phase123.md` Review Notes. Please record it at review.
- Status: awaiting submission. 123.3 stays closed.

Joint resubmission, Manager review round 2 (2026-10-04) — **APPROVED → Architect review.**
- **Frozen tree:**
  - The fingerprint was recomputed with `$env:TEMP\pv-fingerprint.mjs` before and after all Manager runs, with `team-Yuri/` included: identical both times, `c06950a5…ff1c21` (diff_bytes=229284, tracked_changed=30, untracked_in_scope=19).
  - No file moved during the review (G-11).
- **N-2 exception (amendment A):**
  - `src/vault/crypto.ts` and `src/vault/vault.ts` each differ from HEAD by exactly 3 lines: one `./syncOutbox` import, the `syncOutbox?: SyncOutbox` field, and the decode default (`normalizeSyncOutbox(raw.syncOutbox)`) or the persist mapping (`syncOutbox: state.syncOutbox`).
  - No change to the KDF, the cipher, unlock or `persistVault`.
  - `normalizeSyncOutbox` maps a missing or malformed field to empty, so legacy vaults decode unchanged.
- **N-1 exception:**
  - The `src/admin/userApproval.ts` diff is re-export only: logic removed, a type import and `export { userApprovalState, … } from '../service/userApproval'` added, and `USER_APPROVAL_HE` kept.
  - The moved `userApprovalState` body in `src/service/userApproval.ts` is byte-identical to HEAD.
- **Known Issue 5 login repair (`src/App.tsx` `handleAuthenticated`; `src/supabase/persistence.ts`):**
  - `fetchCloudSyncBaseline` only reads: `select` on `user_services` / `access_profiles` (own `user_id`) plus credential reads decrypted with the cloud key. No insert / update / RPC / schema change.
  - The pre-hydrate full re-key `syncVaultStateToSupabase(cloudCredKey, loaded)` is removed; the verify asserts this statically.
  - A credential counts as "in the cloud" only if the cloud row decrypts with the cloud key to the same values. Legacy vault-key ciphertext therefore stays pending and is rewritten under the cloud key by the repair.
  - The verify's fake cipher makes `vk:` ciphertext readable only by the vault key. Its assertion checks that the repaired row is plain cloud-key ciphertext, i.e. decryptable without the vault key (another browser / Edge). M25 (baseline treats every local credential as in the cloud) is caught.
  - The repair writes only differing rows (idle login = 0 writes). Insert is outbox-only (amendment A (i)); gone rows are dropped and confirmed inserts cleared.
- **Fix-round criteria, D-123-1…5 + AD-123-18 + amendment A (i)–(iii):** covered by `verifyPhase123Sync` (14 groups / 30 mutations) and by the AppContext / Catalog groups listed in the evidence. Re-run by the Manager, below.
- **H-1:**
  - Pages are closed in `finally`; the static server closes with `closeAllConnections()` and a bounded wait.
  - A shared `withTimeout` fails the run and is never counted as caught. The bite proofs are recorded in the evidence.
  - Manager check: `verifyPhase123Catalog --mutations=M1..M18` in ONE run gave a single PASS in 2m 38s with no stall. Round 1's reproduction of this run stalled >10 min in M9.
- **123.2b:**
  - The catalog lists only `approved` / `no_stored_credentials` global sites.
  - Addendum (a): a non-approved site already in the home is shown «✓ כבר בבית הדיגיטלי» with no add action.
  - Addendum (b): own unpromoted custom sites stay listed for their owner.
  - Covered by `verifyPhase123CatalogGate` (8 groups / 20 mutations) and Catalog M14–M18.
- **Manager re-runs on the frozen tree (sequential, all exit 0):**
  - `verifyPhase123Sync` (full) PASS 14 / 30;
  - `verifyPhase123CatalogGate` (full) PASS 8 / 20;
  - `verifyPhase123AppContext --mutations=M3,M8,M10..M15` PASS (23 groups, 8 mutations);
  - `verifyPhase123Catalog --mutations=M1..M18` PASS (19 groups, 18 mutations, 2m 38s);
  - `verifyPhase104ServiceManagement`, `verifyPhase116CustomAddIdentity`, `verifyPhase109Accounts`, `verifyPhase113LoginAssistance` PASS;
  - `verifyPhase121DeleteService` PASS (43 mutations); `verifyPhase121IframeSurface` PASS (R-123-1 baseline holds);
  - `npx tsc -b` exit 0.
  - The 43/43 admin sweep and the build were not re-run by the Manager; they are accepted from the evidence (same frozen tree).
- **Flags for the Architect (not blocking at Manager level):**
  1. **Baseline-read failure fallback:** if `fetchCloudSyncBaseline` returns null, the baseline is the hydrated vault, so a legacy vault-key credential is NOT re-keyed at that login. It is deferred to the next login with a successful read. Same exposure as HEAD, where re-key failure was a dev warning. Other browsers still read it with the vault key (`hydrateWorkspaceFromCloud` tries `[cloudCredKey, vaultKey]`); Edge (cloud key only) cannot until the deferred repair. Please confirm this is acceptable.
  2. **Amendment A (ii)/(iii) as specified:** a legacy local-only row (absent in the cloud, not in the outbox) is removed locally at login, together with its local credentials. The Developer's implementation follows the ruling; please confirm there's no data-loss case you want to carve out (e.g. a vault last saved while the cloud write failed before this phase).
  3. **Amendment A outbox scope:** the outbox holds `serviceIds` / `profileIds`. Custom sites are covered through their membership id, because the registry row is written before the local commit. Credentials travel with their profile. Please confirm this matches "persisted outbox" as ruled.
  4. **KI-3** (empty cloud membership guard) must be re-decided in 123.3, per your early read.
  5. **Addendum (b) category:** an own unpromoted custom site appears under its stored category. «מותאם אישית» appears only if it is stored as `custom`.
  6. **Owner items pending (conditions, not Developer corrections):**
     - 123.1 step 6 (two windows, C-123.1-1);
     - 123.2 steps 5–6;
     - real-account login / custom-save timings (D-123-5; dev `[timing]` lines);
     - live hidden count (dev `[catalog-gate]` line);
     - the 123.2b manual visibility check.
- **Gate:** 123.3 stays closed until Architect PASS on this resubmission and the Owner items above are recorded (Slice Authorization). 123.3 Step 0 = AD-123-16 verification (MC-3).

2026-10-04, Architect ruling on the round 1 BLOCK (arch Review Notes):
- **B-1 resolved:** 123.2b is authorized (AD-123-19); the `src/admin/userApproval.ts` re-export is authorized as an N-1 exception, re-export only. The plan now has "Joint resubmission" and "Slice 123.2b" sections.
- **H-1 confirmed** as required before the Architect review.
- **Known Issue 1 → AD-123-18 amendment A** (persisted outbox). Added to the fix-round review criteria.
- **Manager note for the Architect:** amendment A's "one payload field" lives in `src/vault/crypto.ts` + `src/vault/vault.ts`. The plan limits the N-2 exception to the field, its empty default and the persist mapping; please confirm at review.
- Status: awaiting the joint resubmission.

Fix round D-123-1…D-123-5 + AD-123-18 (normative: arch Review Notes of 2026-10-04), Manager review round 1 (2026-10-04, 15:38–15:55) — **BLOCKED. Not handed to the Architect.**
- **B-1, moving tree:** while this review ran, 13 files were modified between 15:43 and 15:50.
  - Files: `src/service/userApproval.ts` (new), `src/admin/userApproval.ts`, `src/catalog/catalogVisibility.ts` (new), `src/catalog/addCustomServiceOutcome.ts`, `src/digitalHome/AppCatalog.tsx`, `src/dev/catalogGateSummary.ts` (new), `src/App.tsx`, `scripts/verifyPhase123CatalogGate.mjs` (new), `scripts/verifyPhase104ServiceManagement.mjs`, `scripts/verifyPhase116CustomAddIdentity.mjs`, `scripts/verifyPhase122AdminWorkspace.mjs`, `scripts/verifyPhase123AppContext.mjs`, `scripts/verifyPhase123Catalog.mjs`.
  - This is AD-123-19 (catalog visibility gate = 123.2b) work. It is not part of the submitted fix round, and 123.2b has not been opened by the Manager.
  - It includes a change in `src/admin/` (`userApproval.ts`: −44 / +2, logic moved to `src/service/userApproval.ts` and re-exported). N-1 forbids this unless the Architect authorizes it under AD-123-19.
  - A review of the fix round is impossible on this tree: results cannot be attributed to the submission. A diagnostic catalog run at 15:50 failed on `AppCatalog.tsx imports outside the read-only allow-list (../catalog/catalogVisibility)`, i.e. the new 123.2b edit, not the fix round.
- **H-1, verify hang. Cause NOT established; no timeout exists. Required for END OF ROUND.**
  - Developer evidence calls the M9 stall "a one-off hang of the headless browser" and adds no timeout.
  - The Manager reproduced a stall: `verifyPhase123Catalog --mutations=M7..M13` did not finish in 10 min, against ≈ 2 min expected, and was stopped by the Manager. The run overlapped the B-1 edits, so the reproduction is not clean evidence of the cause.
    - Its output: the clean run passed, M7 and M8 were caught (both inside browser checks, so both leaked a page), then there was no progress inside **M9**. This is the same point as the Developer's stall, so it is reproducible, not a one-off.
    - The run started at 15:39, before B-1 began at 15:43, but M9 may have started after the edits.
  - **Harness defects found by reading the code**; any of them can turn a single slow or stuck step into an unbounded wait:
    1. Every browser check (`verifyPhase123Catalog.mjs` and `verifyPhase123AppContext.mjs`) calls `openPage` … `closePage` without `try/finally`. A caught mutation throws mid-check and leaks its browser context and page into the shared browser. M7 / M8 / M9 each leak one before the next runs.
    2. `runAll`'s `finally` awaits `server.close()`, which resolves only when every connection ends (leaked pages keep them), with no bound.
    3. No per-group / per-mutation watchdog exists. Raw `page.mouse.*`, `page.evaluate` and `boundingBox` calls are unbounded. `scripts/lib/mutationArgs.mjs` has no timeout helper.
- **Re-runs on the tree as it was at ≈ 15:38–15:44, before / at the start of B-1:**
  - `verifyPhase123Sync` → PASS, 7 groups, 19 mutations caught (2s).
  - `verifyPhase123AppContext --mutations=M10,M11,M12` → PASS (1m 18s).
  - `npx tsc -b` → exit 0.
  - `persistence.ts`: +281 / −23 (AD-123-18 scope; not yet reviewed line by line, blocked by B-1).
- **For the Architect once unblocked (not Manager defects):**
  - **Known Issue 1:** rows that exist only locally (never synced) are dropped locally as "gone" at the login repair. This may delete user profiles / credentials that were never in the cloud. AD-123-18 (2) says "cloud row *no longer* exists", which presumes the row once existed. Needs an explicit Architect ruling before acceptance.
  - The D-123-5 saving combined with AD-123-18.
- **Still pending, Owner:** real-account D-123-5 stage times; re-run of 123.1 step 6 (two windows) and 123.2 steps 5–6.

Slice 123.2 + R-123-1, round 1 (2026-10-04):
- **Evidence complete** per Required Developer Evidence: implementation summary, files changed, dependencies (none; `package.json` / lock unchanged), T-1 results with times, functional testability (automated table + the 123.2 manual table, "not run — awaiting Owner"), docs line, superseded assertions, N-1…N-8, known issues (none BLOCKED), scope compliance, declaration, and the R-123-1 subsection.
- **Manager re-ran these on the submitted tree. All match the evidence:**
  - `verifyPhase123Catalog.mjs --mutations=M1..M6` → PASS, 15 check groups, 6 caught (24s); each mutation fails for its stated rule.
  - `verifyPhase123AppContext.mjs --no-mutations` → PASS (22s).
  - R-123-1 scripts `verifyPhase121IframeSurface` / `InspectReadinessEligible` / `PartialOcclusionPick` → exit 0 (they failed before, as reproduced in the 123.1 review).
  - `verifyPhase104ServiceManagement`, `113LoginAssistance`, `109Accounts`, `ServiceSourceOwnership` → exit 0.
  - `npx tsc -b` → exit 0.
  - Protected-path diff (`src/admin`, `extension`, `src/vault/{crypto,db,vault,vaultMigration}.ts`, `src/supabase`, `src/execution`, `supabase`, `package*.json`) → empty.
- **Code spot-check: conforms.**
  - `LoginAssistancePanel`: `showAppMenu = showEditSiteDetails = actions.menu.edit_site_details && Boolean(onEditSiteDetails)`. It is rendered in `la-panel-header`, outside the `profileUi` (`launchKindOffersProfileUi`) gate. This satisfies AD-123-17 / G-8.
  - The «+ הוספת אתר מותאם אישית» label is the AD-123-14 text, not invented.
  - Catalog add = `addApp` → `addService` → `changeSelection(id,'add')`; `addCustomService` / `updateCustomService` unchanged vs HEAD (checked by the verify).
- **R-123-1 diff reviewed** (13+ / 5−):
  - Only the three "revert slice edits == HEAD" scope references now point to `909cc8b~1`. No behavioural assertion or mutation changed. The InspectReadiness sha256 pin is unchanged. `extension/**` untouched.
  - Option 1 is justified by the byte-identity proof. Using `~1` instead of `^` (the cmd.exe escape) is correct and explained.
  - The bite proof re-stated the same comparison on a temp copy rather than editing `extension/**`. Accepted under the constraint. G-9 is met (all three PASS ahead of END OF ROUND).
- **Accepted observations, not defects:**
  - M1 / M3 / M4 are caught by the earliest (pure / static) layer. The browser layer asserts the same behaviour but wasn't shown per mutation. Acceptable: each mutation is still caught.
  - Two "custom" rules coexist until 123.4: Digital Home uses vault `customServices` (AD-123-14); the ManageServices row menu uses `source === 'user-created'`. This ends when ManageServices is deleted in 123.4; the 123.4 parity matrix must cite the AD-123-14 rule.
  - The AD-123-17 runtime fixture for `no-stored-credentials` / `not-configured` custom apps uses vault-custom ids with a catalog runtime source (the AD-123-14 promoted-site case). Acceptable, since user-created sources always resolve to a form.
  - With 0 apps, a failed inline retry falls back to App's existing full-screen catalog error (AC-104-10). Pre-existing; 123.4 replaces it with the empty state + inline error (already in the 123.4 plan).
- **Open for closure:** C-123.1-1 / G-10. The Owner's combined manual run (123.1 seven steps + 123.2 seven steps in `dev-phase123.md`) is still "not run — awaiting Owner". 123.3 cannot open until it is recorded.

2026-10-04, after the Architect review of 123.1 (PASS, conditional):
- AD-123-17, R-123-1 and C-123.1-1 are integrated into this plan: Status, Architecture Summary, Slice Authorization, the Slice 123.2 section, Task R-123-1, and G-8 / G-9 / G-10.
- Slice 123.2 + R-123-1 opened for the Developer.

Slice 123.1, round 2:
- **Round 1 corrections:**
  - Dependencies statement added (none added; `package.json` / lock unchanged). Accepted.
  - Docs line added (no doc beyond `dev-phase123.md` needed; the new verify is picked up by `runOfflineRegression.mjs`). Accepted.
  - Manual run on `localhost:5173`: not performed, with an acceptable reason. The Developer has no authorized real account, and she correctly did not work around the blocked secret / environment access.
    - The seven-step table is recorded with expected results and every outcome marked "not run — no account". No unobserved results are claimed.
    - The step-5 note (≥ 3 profiles needed for the choose step) is correct per AD-123-13.
- **No code changed since round 1:** the same file set as reviewed, so the round 1 Manager re-runs stand.
- **Condition carried to the Architect review (C-123.1-1):** the Owner, or an account explicitly handed to the Developer, performs the seven-step manual table in `dev-phase123.md` with `npm run dev` and records each outcome there. Slice 123.1 is not closed until this is recorded with no unexplained differences.
- **Still open for the Architect:**
  - Known Issue 1: does AD-123-2 apply to `no-stored-credentials` / `not-configured` apps?
  - The three Phase 121 verifies with a stale HEAD baseline: re-baseline or explicit exclusion before the 123.4 END OF ROUND.

Slice 123.1, round 1:
Slice 123.1, round 1:
- **Artifact correction (Manager):** N-2 paths corrected to `src/vault/crypto.ts` / `src/vault/db.ts` (arch review note MC-1). The Developer's verify already checks the correct paths.
- **Manager re-ran these on the submitted tree. All match the evidence:**
  - `verifyPhase123AppContext.mjs --no-mutations` → PASS, 18 check groups (33s).
  - `--mutations=M1,…,M9` → PASS, 9 caught (33s); each mutation fails for its stated rule.
  - `npx tsc -b` → exit 0.
  - Directly touched verifies 102CredentialSchema, 103, 104, 108M1, 109, 113, 116, 117, ServiceSourceOwnership → exit 0.
  - `git diff --stat HEAD` over `src/admin`, `extension`, `src/vault/{crypto,db,vault,vaultMigration}.ts`, `src/supabase`, `src/execution`, `supabase` → empty.
  - `package.json` / `package-lock.json` unchanged.
- **Code spot-check against the plan: conforms.**
  - `ensureDefaultProfileForService(` is called only in `vaultMigration.ts` (private helper); the export is kept (AD-123-5).
  - One `<ServiceProfileManagementModal` render site, in `DigitalHomeCredentialModal.tsx` (AD-123-3).
  - No `window.confirm` / `alert` / `prompt` outside admin (N-4).
  - `deleteAccessProfile` follows AD-123-13: last profile allowed; auto default with 1 remaining; `replacementDefaultId` required and validated with ≥ 2 remaining.
  - The host pre-validates the local delete, deletes in the cloud first, and is fail-closed on cloud error (N-7).
  - The pure helpers in `src/digitalHome/appContext.ts` match the §6 contracts.
  - MC-2 is covered (M9).
- **Superseded legacy assertions:** accepted as listed (AD-123-2 / AD-123-3). For AC-113-45, restoring the behaviour rather than editing the assertion is the correct choice.
- **Deviations accepted as within plan:**
  - with 0 profiles, a single add button (empty state);
  - «הוסף פרטי כניסה» removed;
  - the add form after deleting the last profile, with cancel = 0 writes;
  - the dead error mapping removed;
  - `customServiceIds` passed to Dashboard without rendering anything yet.
- **Phase 121 admin verify failures** (`verifyPhase121IframeSurface`, `verifyPhase121InspectReadinessEligible`, `verifyPhase121PartialOcclusionPick`):
  - The Manager reproduced `verifyPhase121IframeSurface` failing on "untouched outside the D-121-49 edits" with `extension/` at zero diff against HEAD (`909cc8b`). This confirms a stale HEAD baseline, independent of 123.1.
  - Not a 123.1 blocker.
  - Re-baselining is outside Phase 123 scope and cannot be authorized by the Manager; it goes to the Architect.
  - It must be resolved, or explicitly excluded by the Architect, before the 123.4 END OF ROUND.
- **Known Issue 1 (BLOCKED, Architect):** profile UI stays gated on form credential entries, with behaviour unchanged. This is the stop rule applied correctly. For the Architect at review: does AD-123-2 apply to `no-stored-credentials` / `not-configured` apps?

### Required Corrections
Slice 123.4 + END OF ROUND, round 1: none. O-1 (wording) and O-2 (doc-comment placement) are non-blocking observations; the consolidated Owner run is a carried condition.

Slice 123.3, round 1 (documentation only; no code change, no re-run), CLOSED 2026-10-05 by dev KI-7:
1. **RC-1:** add a Known Issue to `dev-phase123.md` → "123.3 Known Issues", answering the Architect's question: when `deleteCustomServiceRegistryRow` still fails after its retry, the removed own site stays in the owner's catalog. State what the user sees, per the Manager's code trace in Review Notes:
   - no error;
   - the tile is gone;
   - the site is listed in the catalog as not added, with the add action (own sites always listed, AD-123-19 (b); `mergeCustomDefinitions` keeps registry-only own rows);
   - hydrate puts it back into vault `customServices` at the next login (not selected);
   - re-adding it gives 0 profiles;
   - no later retry; the admin still sees the row.
   Correct the trace if the code says otherwise. Confirm the frozen-tree fingerprint `664646a0…18af` is unchanged.

Fix round D-123-6…8, round 1: none. The Owner re-check is a condition carried to the Architect review, not a Developer correction.

Joint resubmission, round 2: none. The Owner items (Review Notes, flag 6) are conditions carried to the Architect review, not Developer corrections.

Fix round D-123-1…5, Manager round 1 (BLOCKED):
1. **B-1 (superseded by the Architect ruling of 2026-10-04):** 123.2b stays in the tree. The fix round and 123.2b are resubmitted together on one frozen tree, with a fingerprint, as described in "Joint resubmission".
2. **H-1, both `verifyPhase123Catalog.mjs` and `verifyPhase123AppContext.mjs` (and `verifyPhase123Sync.mjs` if it can wait):**
   - (a) every `openPage` is paired with a `closePage` / `context.close()` in `finally`, so a caught mutation never leaks a page;
   - (b) the per-run static server closes with `closeAllConnections()` and a bounded wait;
   - (c) a shared helper in `scripts/lib/` (e.g. `withTimeout(promise, ms, label)`) bounds every browser group and every mutation run. A timeout **fails the run** with `mutation timed out: <id> after <n>s` (or `check timed out: <group>`). It is never counted as "caught" and never blocks.
   - (d) bite proof: a temporary mutation / fixture that never resolves makes the script FAIL with the timeout message within the bound. Show the output; the temporary code is removed after.
   - (e) state the established cause of the M9 stall, or, if it cannot be pinned down, show that (a)–(c) turn it into a bounded failure. Re-run `verifyPhase123Catalog --mutations=M1..M13` in one run to a single PASS line, and repeat the M7–M9 chain 3 times without a stall.
3. Implement amendment A (fix-round criteria) and complete 123.2b. Then freeze the tree and resubmit both sections, each with the T-1 set re-run on the frozen tree.

Slice 123.2 + R-123-1, round 1: none.

Slice 123.1, round 2: none. C-123.1-1, the Owner's manual run, is a condition carried to the Architect review, not a Developer correction.

Slice 123.1, round 1 (resolved in round 2) — add to `dev-phase123.md`, section "Slice 123.1":
1. **Dependencies:** a statement is missing. State "none added". `playwright` / `esbuild` / `linkedom` were already devDependencies, and `package.json` / lock are unchanged.
2. **Docs updated or why not:** the line is missing. State which docs were updated, or why none are needed.
3. **Functional testability:** the plan requires manual steps on `http://localhost:5173/`; the evidence has only the automated browser harness, which stubs the cloud. Perform and record a short manual run on the dev server with a real signed-in account:
   - 0-profile empty state → add a profile → dot;
   - add a second profile;
   - switch, close, reopen → back on the default;
   - «עריכת פרופיל» opens on the active profile;
   - delete the default → choose the new default;
   - delete the remaining profiles → no dot;
   - lock / unlock → still 0 profiles.
   Record the outcome of each step and anything that differs. If a step can't be done (e.g. no dev account), say so and give the reason.
