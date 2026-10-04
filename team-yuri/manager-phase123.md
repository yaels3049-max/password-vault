# Manager Phase 123 — Unified Digital Home (user side)

## Phase Identifier
PHASE=123 (from `team-Yuri/PHASE.md`).

## Status
READY_FOR_ARCHITECT_REVIEW — joint resubmission (fix round D-123-1…5 + AD-123-18 + amendment A + H-1 + Known Issue 5, and slice 123.2b / AD-123-19) Manager APPROVED round 2 on frozen tree sha256=c06950a5…ff1c21 (2026-10-04). 123.3 is not opened.
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
| Fix round + 123.2b | D-123-1…5 + AD-123-18 + amendment A; 123.2b catalog gate (AD-123-19) | YES (Architect ruling 2026-10-04); Manager APPROVED round 2 (frozen tree c06950a5…ff1c21) → awaiting Architect review | H-1 met → Manager Review PASS → Architect review PASS; Owner re-runs (123.1 step 6, 123.2 steps 5–6, 123.2b manual) recorded |
| 123.3 | Remove app (confirm, Undo, deferred full deletion) | Owner-authorized; opened only after the 123.2 gate, the fix round + 123.2b gate, **and** C-123.1-1 is recorded. **Hard sub-gate:** AD-123-16 verification first, then STOP and report before any migration | Manager Review PASS → Architect review PASS |
| 123.4 | Navigation unification + ManageServices deletion + admin aggregate + END OF ROUND | Owner-authorized; opened only after the 123.3 gate | Manager Review PASS → Architect review PASS → phase close |

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

### Slice 123.3 — Remove app (AD-123-10, -11, -12, -16; PQ-123-1)

**Step 0 — AD-123-16 verification. Hard gate: no product code and no migration before the report is accepted.**
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
- **END OF ROUND:** full mutation sweep of all four `verifyPhase123*` scripts + `node scripts/runOfflineRegression.mjs`, with results and elapsed times in `dev-phase123.md`.

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
MANAGER_REVIEW_STATUS: APPROVED (round 2) — joint resubmission: fix round D-123-1…5 + AD-123-18 + amendment A + H-1 + Known Issue 5, and slice 123.2b (AD-123-19 + addenda (a)/(b)), frozen tree sha256=c06950a50486cfef9fcfd041622aebbd3e5dfaa7a3d85e99038d9dff93ff1c21. Handed to the Architect. Owner items are carried as conditions. (Earlier: fix round round 1 BLOCKED; slice 123.2 + R-123-1 APPROVED round 1; slice 123.1 APPROVED round 2.)

### Review Notes
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
