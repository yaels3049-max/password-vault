# Developer Phase 123

## Phase Identifier
PHASE=123

## Status
- Slice 123.1: COMPLETE — Manager review round 1 evidence corrections added (dependencies, docs, manual functional run). The manual run was not performed: no real account available (see "Functional Testability — manual run").
- Slice 123.2 (Catalog) + task R-123-1: COMPLETE — see section "Slice 123.2". Manual steps: not run — awaiting Owner. Stopping for Manager → Architect review. 123.3 not started.
- Slice 123.1 — D-123-1 (reopened, fix only): ROOT CAUSE FOUND on the real account. Another session's upsert-only full-state dual-write recreates the deleted profile in the cloud, and hydrate restores it. The fix is in persistence (protected) → STOP, reported to the Architect. No source or test changed. See section "Slice 123.1 — D-123-1".
- Fix round D-123-1…5 (slices 123.1 + 123.2 reopened for these items; AD-123-18 + amendment A approved; H-1 applied): IMPLEMENTED — automated T-1 set PASS on the frozen tree. D-123-5 real-account timing and the Owner re-runs (123.1 step 6 with two windows, 123.2 steps 5–6): not run — awaiting Owner (the test-account password was exposed in chat and is not reused). See section "Fix round D-123-1…5".
- Slice 123.2b (AD-123-19 catalog visibility gate): IMPLEMENTED — automated T-1 set PASS on the same frozen tree. Live hidden-site count and the Owner visibility check: not run — awaiting Owner. See section "Slice 123.2b".
- Completion round (Manager checklist + Architect addendum AD-123-19 (a) / (b) + early read on Known Issue 5), on top of the previous submission:
  - amendment A evidence completed: old vault unlocks, lock-unlock, failed insert keeps its id; the crypto / vault diff trimmed to the field declaration, the decode default and the persist mapping, quoted below;
  - Known Issue 5: the login repair writes only rows that differ from the cloud as read, and logs a dev-only `[timing] login` line;
  - AD-123-19 (a) and (b) implemented.
- B-1 (re-frozen): the tree was frozen again after these changes. Fingerprint `c06950a50486cfef9fcfd041622aebbd3e5dfaa7a3d85e99038d9dff93ff1c21` (command and scope: section "Frozen-tree fingerprint" at the end). Every result marked "frozen tree" below ran on that tree; no source, test or config file was edited after it. Submitted together for Manager → Architect review.
- Fix round D-123-6…8: COMPLETE — D-123-6, D-123-7 and D-123-8 implemented; one clean sequential T-1 run (68 jobs) + `tsc` + build PASS on frozen tree `1de67427…e387`. Owner re-check: awaiting Owner (after the Architect review). 123.3 not open. See section "Fix round D-123-6…8".
- Slice 123.3 (Remove app): COMPLETE — Step 0 DELETED (accepted), Item 0a (KI-5), confirm + Undo, AD-123-11 commit order, AD-123-12 edge rules, PQ-123-1, AD-123-14 clarification, KI-3. One clean sequential T-1 run (70 jobs) + `tsc` + build PASS on frozen tree `664646a0…18af` (identical before / after). Owner manual steps: awaiting Owner. Stopping for Manager → Architect review; 123.4 not open. See section "Slice 123.3 - Remove app".

## Source References
- `team-Yuri/manager-phase123.md` — sections "Slice 123.1", "Slice 123.2", "Task R-123-1", N-1…N-8, Test Policy (T-1).
- `team-Yuri/arch-phase123.md` — AD-123-2, -3, -5, -6, -7, -13; Review Notes MC-1, MC-2 (MC-3 is for 123.3 Step 0); AD-123-8, AD-123-14, AD-123-17 and the Review Notes of 2026-10-04 (123.2).
- Test policy T-1 (Owner approved 2026-10-03).

---

## Slice 123.1 — App context

### Implementation Summary
- **Pure helpers** (`src/digitalHome/appContext.ts`):
  - `appHasProfile`: an app has ≥ 1 profile.
  - `initialActiveProfile`: the default profile, else the first in display order, else `null`.
  - `appContextActions`: switcher when ≥ 2 profiles; edit when ≥ 1; add always; empty state when 0; menu flags (`remove_app` always, `edit_site_details` only for custom sites).
  - `deleteProfilePlan`: one of `simple`, `auto_default` or `choose_default`.
  - `addProfileWithCredential`: one profile plus an optional credential in one state step.
  - Type `ProfileManagementRequest`.
- **`deleteAccessProfile(state, profileId, replacementDefaultId?)`** follows AD-123-13:
  - The last profile can now be deleted (the guard is removed).
  - Deleting the default leaves one other profile → that profile becomes the default.
  - Deleting the default leaves ≥ 2 others → `replacementDefaultId` is required and must be one of the remaining profiles of the same app. Otherwise it throws `Choose a new default profile` and the state is unchanged.
  - Deleting a non-default profile leaves the default unchanged.
- **AD-123-5:**
  - Every `ensureDefaultProfileForService(` call is gone from user flows (App, host, ManageServices).
  - The export stays, and `vaultMigration.ts` is unchanged.
  - Lock/unlock of an app with 0 profiles stays at 0 profiles (no «ראשי» is recreated).
- **AD-123-3:** exactly one host.
  - `DigitalHomeCredentialModal` is rendered once by `App` as `profileHost`, on both the Home and Manage screens.
  - It is opened through `openProfileManagement({ serviceId, profileId?, mode })`.
  - ManageServices no longer embeds the modal; «ניהול» calls `onOpenProfileManagement`.
- **Modal** (`ServiceProfileManagementModal`):
  - Opens on `initialProfileId`, or on `initialActiveProfile` when none is given.
  - Add mode (`initialMode='add'`, or 0 profiles) is one form: name, optional credential fields, «שמירת פרופיל» and «ביטול».
  - One save → one profile (+ credential) → one persist. Cancel or close → zero writes.
  - Deleting the last profile is allowed.
  - Deleting the default with ≥ 2 others shows an in-modal step («בחירת ברירת מחדל», radio list). Confirm stays disabled until a profile is chosen. No browser dialog.
  - The inline «+ הוספת פרופיל נוסף» stays collapsed in edit mode.
- **Host** (`DigitalHomeCredentialModal`):
  - No auto-create.
  - Profile delete runs in three steps:
    1. pre-validate the local delete (fail-closed, before any cloud call);
    2. `deleteAccessProfileFromCloud`; on error show a Hebrew error and leave local state untouched;
    3. `deleteAccessProfile` through `onVaultStateChange` → `persistVault`.
  - Add uses `addProfileWithCredential` and then the same single persist.
- **Panel** (`LoginAssistancePanel`):
  - Switcher when profiles ≥ 2, regardless of credentials (`showProfileChips = profileUi && actions.switcher`).
  - Each open starts at `initialActiveProfile`. Switching is session-only state with no writes.
  - The active profile is kept while it still exists; otherwise it falls back to the initial one.
  - «עריכת פרופיל» (opens the modal on the active profile) and «הוספת פרופיל».
  - 0-profile empty state «עדיין אין פרופיל לאתר זה.» with «הוסף פרופיל».
  - No app-menu entries yet (123.2 / 123.3).
- **Dashboard:** the tile dot is `appHasProfile` (AD-123-6). `Tile.tsx` is unchanged (no count, no text).

### Files Changed
- New:
  - `src/digitalHome/appContext.ts`
  - `scripts/verifyPhase123AppContext.mjs`
- Modified, product code:
  - `src/vault/profileManagement.ts`
  - `src/ServiceProfileManagementModal.tsx`
  - `src/loginAssistance/DigitalHomeCredentialModal.tsx`
  - `src/loginAssistance/LoginAssistancePanel.tsx`
  - `src/loginAssistance/credentialsGate.ts` (`launchKindOffersProfileUi`)
  - `src/loginAssistance/messages.ts` (4 Hebrew strings)
  - `src/Dashboard.tsx`
  - `src/ManageServices.tsx`
  - `src/App.tsx`
  - `src/App.css`
- Modified, legacy verifies (superseded assertions only; see below):
  - `scripts/verifyPhase102CredentialSchema.mjs`
  - `scripts/verifyPhase109Accounts.mjs`
  - `scripts/verifyPhase113LoginAssistance.mjs`
- Not modified: PHASE / arch / manager / plan files, `src/admin/**`, `extension/**`, `src/vault/crypto.ts`, `src/vault/db.ts`, `src/vault/vault.ts`, `src/vault/vaultMigration.ts`, `src/supabase/**`, `src/execution/**`, migrations.

### New verify — `scripts/verifyPhase123AppContext.mjs`
Built in the existing harness style: `mutationArgs` + `tempDir`, an esbuild bundle, and Playwright Edge on a local 127.0.0.1 server (so IndexedDB works). The browser layer runs the real `unlockVault` / `persistVault` / `lockVault`. Only `src/supabase/persistence.ts` (cloud calls logged, failure switch) and `useServiceLogos` are stubbed.

Check layers:
- **Pure:**
  - helper matrix;
  - `deleteAccessProfile` (last / auto / choose; missing, unknown, other-app or deleted replacement → throws with state unchanged);
  - **MC-2:** the first profile added to a 0-profile app is the default; one profile per save; credential optional;
  - validation accepts 0 profiles.
- **Static:**
  - AD-123-5: no `ensureDefaultProfileForService(` call in user flows;
  - AD-123-3: one modal render site and one host;
  - panel gating not tied to credentials, no persisted active profile, no app menu;
  - AD-123-6: dot source, and `Tile.tsx` unchanged vs HEAD;
  - N-3, N-4, N-5, N-6, N-8;
  - **MC-1:** the N-1 / N-2 unchanged check over `src/vault/crypto.ts`, `src/vault/vault.ts`, `src/vault/db.ts`, `src/vault/vaultMigration.ts`, `src/supabase/persistence.ts`, `src/supabase/registryPersistence.ts`, `src/execution`, `extension`, `extension/manifest.json`, plus the `src/admin` diff.
- **Browser:**
  - green dot;
  - 0-profile empty state and the add flow (cancel / close = 0 writes; save = 1 default profile + credential in 1 persist);
  - switcher (also without credentials), reopen on the default, switching = 0 writes, active profile kept while it exists;
  - tile → window → «עריכת פרופיל» (2 actions) opens the modal on the active profile;
  - delete flows (choose step, auto default, last profile → empty state, then lock/unlock still at 0 profiles);
  - cloud error on profile delete → Hebrew error, local state unchanged.

Mutations:

| Id | Mutation | Caught by |
|----|----------|-----------|
| M1 | last-profile guard restored | pure reducer check |
| M2 | `choose_default` auto-promotes | pure reducer check |
| M3 | host re-adds `ensureDefaultProfileForService` on open | AD-123-5 static check |
| M4 | dot back to "complete credentials" | AD-123-6 static check |
| M5 | switcher gated on credentials | AD-123-2 static check |
| M6 | window reopens on the last switched profile | FR-05 browser check |
| M7 | add-mode cancel writes a profile | FR-09 browser check |
| M8 | second modal render site in ManageServices | AD-123-3 static check |
| M9 (MC-2) | first added profile left non-default | FR-04 pure check |

### T-1 Results (final code)
New verify:
- `node scripts/verifyPhase123AppContext.mjs --no-mutations`
  - `PASS — Phase 123.1 App context: 18 check groups, mutation sweep skipped (--no-mutations) — 18s` (wall 19.1s)
- `node scripts/verifyPhase123AppContext.mjs --mutations=M1,M2,M3,M4,M5,M6,M7,M8,M9`
  - `PASS — Phase 123.1 App context: 18 check groups, 9 selected mutations caught — 27s` (wall 28.5s)

Directly touched verifies, found with `rg -l "<basename>" scripts --glob "verify*.mjs"` (retired scripts excluded). None of them has a mutation sweep, so they run plain:

| Verify | Result | Wall time |
|--------|--------|-----------|
| verifyPhase102CredentialSchema | `PASS: Phase 102 credential schema helper …` | 0.2s |
| verifyPhase103Execution | exit 0 | 0.1s |
| verifyPhase104ServiceManagement | `PASS: Phase 104 custom-add classifier runtime …` | 0.5s |
| verifyPhase108BrowserIntegration | exit 0 | 0.2s |
| verifyPhase108KnownServiceBootstrap | exit 0 | 0.1s |
| verifyPhase108M1ExplicitLoginEntry | `PASS: Phase 108 M1 explicit login entry …` | 0.2s |
| verifyPhase109Accounts | `verifyPhase109Accounts: PASS` | 0.2s |
| verifyPhase111Assets | exit 0 | 0.1s |
| verifyPhase113LoginAssistance | `verifyPhase113LoginAssistance: PASS` | 0.1s |
| verifyPhase116CustomAddIdentity | `verifyPhase116CustomAddIdentity: PASS (S0–S4 static + R1–R11)` | 1.0s |
| verifyPhase117ManagedAutofill | `verifyPhase117ManagedAutofill: PASS (T0–T28 …)` | 0.7s |
| verifyServiceSourceOwnership | `PASS: service source/ownership root-cause regression` | 0.2s |

Phase 121 / 122 admin verifies: 43 scripts, all run plain except `verifyPhase122AdminWorkspace`, which runs with `--no-mutations`.
- **40 PASS**, including `verifyPhase122AdminWorkspace --no-mutations` (`PASS — Phase 122 Admin Workspace up to 122.8: 32 check groups … — 2m 09s`), `verifyPhase122AdminNotes` (46.8s) and `verifyPhase122SubmitterProfiles` (49.6s).
- **3 FAIL, pre-existing and independent of 123.1** (see Known Issues):
  - `verifyPhase121IframeSurface`
  - `verifyPhase121InspectReadinessEligible`
  - `verifyPhase121PartialOcclusionPick`

Build and diff checks:
- `npx tsc -b` → exit 0.
- `npm run build` → exit 0 (Vite build OK; only the existing chunk-size warning).
- `git diff --stat -- src/admin` → empty.
- `git diff --stat HEAD -- src/admin extension src/vault/crypto.ts src/vault/db.ts src/vault/vault.ts src/vault/vaultMigration.ts src/supabase src/execution` → empty.
- Lints (ReadLints) on all edited source files → none.
- Temp cleanup: 0 `node_modules/.tmp/pv-*` and 0 `%TEMP%/pv-123*` dirs left.

### Dependencies Installed
None added.
- `playwright`, `esbuild` and `linkedom` were already devDependencies (`package.json` lines 19–26).
- `git diff --stat HEAD -- package.json package-lock.json` is empty.

### Documentation Update Evidence
- Updated: this file (`team-Yuri/dev-phase123.md`, section "Slice 123.1").
- No other docs needed:
  - 123.1 adds no setup step, command, environment variable, dependency or migration.
  - The new verify is picked up automatically by `scripts/runOfflineRegression.mjs`, which runs every top-level `scripts/verify*.mjs`.
  - The user-facing behaviour is specified in `arch-phase123.md` / `manager-phase123.md`, which the Developer does not edit.
  - The superseded legacy assertions are documented in-line with an AD comment and in the table below.

### Functional Testability — manual run on the dev server (round 1 correction)
**Status: NOT PERFORMED by the Developer — no real signed-in account available.**

Reason:
- A manual run needs a real signed-in account (Supabase auth + vault unlock) on `http://localhost:5173/`.
- No account credentials were provided to the Developer for this phase.
- Reading environment / secret configuration was blocked by auto-review earlier in this phase: "The requested command inspects environment configuration files and secret names without authorization in the user prompt." Accessing the live DB is outside the Developer's authorization under the same constraint.
- Signing in therefore requires the Owner, or an account handed over explicitly.
- No outcome below has been invented.

The code is in the tree and builds (`npm run build` exit 0), so the run can be done by anyone with an account: `npm run dev`, sign in and unlock, then pick an app with 0 profiles.

| # | Step | Expected (123.1) | Outcome |
|---|------|------------------|---------|
| 1 | Open the tile of an app with 0 profiles → empty state → «הוסף פרופיל» → enter name (+ optional credentials) → «שמירת פרופיל» | Panel shows «עדיין אין פרופיל לאתר זה.» + «הוסף פרופיל»; modal opens in add mode; after save the profile is the default and the tile shows the dot | not run — no account |
| 2 | Add a second profile («הוספת פרופיל» in the window, or «+ הוספת פרופיל נוסף» in the modal) | Exactly one new profile, non-default; switcher chips now appear in the window | not run — no account |
| 3 | In the window switch to the non-default profile → close → reopen the tile | Reopens on the default profile; switching causes no save | not run — no account |
| 4 | Switch to a profile → «עריכת פרופיל» | Modal opens focused on that same profile | not run — no account |
| 5 | Delete the default profile (needs ≥ 3 profiles for the choose step; with 2, the other one becomes default automatically) | ≥ 2 left: in-modal «choose new default» step, confirm disabled until chosen; 1 left: it becomes default; no browser dialog | not run — no account |
| 6 | Delete the remaining profiles | Last-profile delete allowed; modal shows the add form (cancel = no write); tile dot disappears; window shows the empty state | not run — no account |
| 7 | Lock → unlock | The app still has 0 profiles (no «ראשי» recreated); still no dot | not run — no account |

Differences noted: none observed (run not performed).

The closest existing evidence for steps 1–7 is the automated browser layer of `verifyPhase123AppContext.mjs`, re-run by the Manager. It runs the real `unlockVault` / `persistVault` / `lockVault` against real IndexedDB, but the cloud is stubbed, so it does not replace this manual run.

#### Slice 123.2 manual steps (C-123.1-1) — performed by the Owner
Same setup: `npm run dev` → `http://localhost:5173/`, sign in and unlock, Digital Home. The Developer did not run these (no account was handed over); no outcome has been invented.

| # | Step | Expected (123.2) | Outcome |
|---|------|------------------|---------|
| 1 | «+ הוספת אפליקציה» → type a term that matches nothing → Enter (or the search icon) | Large central modal (RTL), focus in the search field; «לא נמצאו אתרים תואמים. נסו חיפוש אחר או הוסיפו אתר מותאם אישית.»; Escape closes the modal and focus returns to «+ הוספת אפליקציה» | not run — awaiting Owner |
| 2 | Clear the search → click a category chip, then «הכל» | Only apps of that category are listed (chip pressed); «הכל» lists all again; no «practice» chip | not run — awaiting Owner |
| 3 | On a built-in app that is not in the Digital Home → «הוספה» → close the modal | The card turns into the disabled «✓ כבר בבית הדיגיטלי»; one new tile appears on Digital Home with **no** green dot (no profile created) | not run — awaiting Owner |
| 4 | Reopen the catalog and find an app that is already on Digital Home | Marked «✓ כבר בבית הדיגיטלי» (disabled), no «הוספה»; no duplicate tile can be created | not run — awaiting Owner |
| 5 | «+ הוספת אתר מותאם אישית» → name + HTTPS address → «הוסף» | Hebrew outcome inside the modal: ««name» נוסף לבית הדיגיטלי.» for a new site; for a site that already exists in the catalog / in the home, the existing Hebrew offer / message (same as «ניהול אתרים» before) | not run — awaiting Owner |
| 6 | Open the tile of a custom site → app-actions menu ⋮ «פעולות אפליקציה» → «עריכת פרטי האתר» → change the name → «שמור». If available, repeat on a custom site whose window shows no profile UI (no-stored-credentials / not-configured) | The window closes and the existing «עריכת כתובת כניסה» form opens prefilled; after save the tile shows the new name. The menu is present for the no-stored / not-configured custom site too (AD-123-17) | not run — awaiting Owner |
| 7 | Open the tile of a built-in app | No ⋮ menu and no «עריכת פרטי האתר» in the window | not run — awaiting Owner |

Differences noted: none observed (run not performed). Closest automated evidence: the browser layer of `verifyPhase123Catalog.mjs` (real Dashboard / panel / catalog / AddSiteModal, real `persistVault` + `addToSelection`; App host mirrored, cloud and registry stubbed), which does not replace this run.

### Superseded legacy assertions (updated with an AD comment; nothing else weakened)

| Script | Old assertion | New assertion | Superseding AD |
|--------|---------------|---------------|----------------|
| `verifyPhase102CredentialSchema.mjs` | panel has `LABEL_ADD_CREDENTIALS` | panel has `LABEL_EDIT_PROFILE` + `LABEL_ADD_FIRST_PROFILE` | AD-123-2 |
| `verifyPhase109Accounts.mjs` | ManageServices cloud-deletes the credential and profile, cloud before local | Same three assertions, retargeted to the single host `DigitalHomeCredentialModal.tsx`. The cloud-before-local ordering regex is kept (it now also allows the extra `replacementDefaultId` argument). | AD-123-3 |
| `verifyPhase113LoginAssistance.mjs` (chips) | `profiles.length > 1` inline | `actions.switcher`, plus `appContext.ts` defines `switcher: count >= 2` (same rule) | AD-123-2 |
| `verifyPhase113LoginAssistance.mjs` (CTA) | panel has `LABEL_ADD_CREDENTIALS` | panel has `LABEL_EDIT_PROFILE` + `LABEL_ADD_PROFILE` + `LABEL_ADD_FIRST_PROFILE` | AD-123-2 |
| `verifyPhase113LoginAssistance.mjs` (wiring) | `onAddCredentials` / `openHomeCredentialModal` | `onOpenProfileManagement` / `openProfileManagement` (still `DigitalHomeCredentialModal`) | AD-123-3 |
| `verifyPhase113LoginAssistance.mjs` (AC-113-43) | `[showAddProfile] = useState(false)` | `[adding] = useState(() => initialMode === 'add' \|\| 0 profiles ? 'entry' : null)`, so it is still collapsed in edit mode | AD-123-3 |

Not superseded, so the behaviour was restored instead of changing the assertion: AC-113-45, "return focus to the «ניהול» opener". ManageServices remembers the opener on click and refocuses it when App reports that the host closed (new prop `profileManagementOpen`).

### N-1…N-8 Compliance
- **N-1:** `git diff --stat -- src/admin` is empty. The admin verifies pass except the 3 pre-existing failures below, which don't come from 123.1.
- **N-2:** all protected paths are unchanged vs HEAD (MC-1 paths: `src/vault/crypto.ts`, `src/vault/db.ts`). This is enforced in the verify and by the `git diff` above.
- **N-3:** no new IndexedDB / Supabase write call sites in Digital Home components. Imports are a subset of HEAD's. Writes go only through the existing reducers → `onVaultStateChange` → `persistVault`, plus the existing `deleteAccessProfileFromCloud` / `deleteCloudEncryptedCredentialByLocalProfileId`.
- **N-4:** no `window.confirm` / `alert` / `prompt` (or bare calls) in `src/` outside admin. The choose-new-default step is inside the modal.
- **N-5:** no site / hostname / serviceId / fixture branches; scanned.
- **N-6:** all new copy is Hebrew, the layout is RTL, and tiles show no count or text.
- **N-7:** cloud error on profile delete → Hebrew error, local state unchanged, no success shown. The local delete is pre-validated before the cloud call. Proven in the browser.
- **N-8:** no `src/admin/**` imports in the new Digital Home code.

### Known Issues / Limitations
1. **BLOCKED (stop-rule candidate, awaiting Architect decision; behaviour unchanged):** the profile UI is gated on form credential entries.
   - The switcher, «עריכת פרופיל», «הוספת פרופיל» and the empty state appear only when the panel launch kind is `credentials` or `missing-user-credentials` (`launchKindOffersProfileUi`).
   - The modal shows profile UI only for `entry.kind === 'form'`.
   - So for `no-stored-credentials` and `not-configured` apps, the panel shows no profile UI, as today. Showing it would change the PRD behaviour for those modes.
   - The Architect should decide whether AD-123-2 applies to them.
2. **Pre-existing admin verify failures (not caused by 123.1):** `verifyPhase121IframeSurface`, `verifyPhase121InspectReadinessEligible` and `verifyPhase121PartialOcclusionPick`.
   - Their scope checks revert their slice edits in `extension/generic/*.js` and expect the result to equal `git show HEAD:<file>`, i.e. a pre-slice HEAD.
   - Since commit `909cc8b` (Phase 122), HEAD already contains those edits, so the comparison can't hold.
   - The scripts read only `extension/` files, and `extension/` has zero diff against HEAD, so the outcome is the same with or without 123.1.
   - Re-baselining them is outside 123.1 scope and was not done. Needs a Manager decision (e.g. a re-baseline task).
3. `verifyPhase122AdminWorkspace` full mutation sweep: not run (T-1: only on "END OF ROUND").

### Deviations
- With 0 profiles, the panel shows only the empty state's «הוסף פרופיל», not also «הוספת פרופיל», to avoid two identical add buttons.
- The old panel button «הוסף פרטי כניסה» is removed; «עריכת פרופיל» and the empty state replace it. `LABEL_ADD_CREDENTIALS` stays exported in `messages.ts` for the copy checks.
- After deleting the last profile, the modal shows the add form; cancel closes it with zero writes.
- The dead "cannot delete last profile" Hebrew error mapping was removed with the guard.
- No extra add-success message; the newly selected profile chip is the feedback.
- `Dashboard` gained `customServiceIds` so `isCustom` / `edit_site_details` is accurate when the menu arrives in 123.2/123.3. Nothing is rendered for it yet.
- No profile-validation change was needed: validation already accepts 0 profiles and a single profile.

### Scope Compliance
- Only slice 123.1 was implemented. No app-menu entries, no remove-app / edit-site flows, and no catalog work (123.2 / 123.3 not started).
- Admin area, auth, unlock, crypto, `persistVault`, sync and user-table RLS are untouched.
- No extension or manifest change. No migration.

### Developer Declaration
Slice 123.1 was implemented within the authorized scope.
- The new verify passes, with M1–M9 caught.
- All directly touched verifies pass.
- `tsc` and `build` pass, and `src/admin` is unchanged.
- Three Phase 121 admin verifies fail for a pre-existing, unrelated baseline reason, recorded above for Manager decision.
- One item is BLOCKED pending an Architect decision with behaviour unchanged (Known Issue 1).

Stopping for Manager review → Architect review.

---

## Slice 123.1 — D-123-1 (Owner C-123.1-1 step 6 FAILED)

**Status: ROOT CAUSE FOUND — STOP, reported to the Architect (brief item 3).** The fix is in persistence (protected). No source or test changed.

Defect: "PayPal גרסה 2" (profiles created before Phase 123). All profiles were deleted in the modal; afterwards the dot stays and the window shows the 1-profile-without-credentials state, immediately and after logout / login.

### 1. Reproduction on the real flow — DONE (2026-10-04, account handed over by the Owner in chat)

Method:
- Local `npm run dev`; Playwright Edge, one fresh browser context per run; login through the real UI.
- State was read from the React tree: **metadata only** (id, name, default flag, dates, service-id bytes, credential field count). No credential values were read or logged.
- Network: only POST / DELETE calls to `access_profiles` were logged, with times. No environment file was read and the database was not queried directly.
- The password was passed only via a process environment variable; it isn't in any file or report.

Surviving profile (the app "PayPal גרסה 2" = service id `paypal`):
- id `profile-6ab17bc4-3cb9-474d-b8b7-dc5c8a12b7f4`, displayName «יעל 2», `isDefault: true`, no credential (0 fields).
- `createdAt` `2026-09-30T21:28:37.863969+00:00`: microsecond precision, so it comes from the cloud row via hydrate.
- serviceId `"paypal"`: length 6, hex `70617970616c`, no whitespace.
- The only profile of `paypal` in the state.
- No duplicate profile ids; no credential keyed by a service id; no custom site with a PayPal name.

Observed runs:

| Run | Observed |
|---|---|
| R1 login | 1 PayPal profile (above). Dot on. Panel: «עדיין לא שמרת פרטי כניסה לאתר זה.» + «עריכת פרופיל» + «הוספת פרופיל» — the Owner's observation. Modal lists exactly this profile; «מחיקת פרופיל» is present. |
| R2 delete (same session) | Confirm text = the last-profile body. `DELETE access_profiles … local_profile_id=eq.profile-6ab17bc4…` → **204** at 10:34:01.359. Right after: state 0 PayPal profiles, **dot off**, modal shows the 0-profile add form. Correct locally. |
| R3 fresh login | **Profile is back**: same id, but cloud `createdAt` `2026-10-04T10:34:07.088949+00:00`, so the row was **recreated 6 s after our DELETE**. Dot on again. |
| R4 delete again, logging every `access_profiles` upsert body this session sends | At login (before this session wrote anything), the row's `updatedAt` was already `10:35:34.269`, i.e. upserted by **another session**. This session's only upsert of the profile was its own login dual-write (10:35:55.810). DELETE → 204 at 10:36:03.635. In the following ~30 s, this session's post-delete dual-write did **not** upsert the profile; state stayed at 0, dot off. |
| R5 fresh login | 0 PayPal profiles (this time no other write had happened yet). |
| Side note | Between R1 and R3 a custom site «פנגו» was added to this account, together with a `user_services` row. None of my runs did that, so **another session of this account was active at the same time**. |

So the surviving profile **reappears** after a cloud round-trip (login / hydrate). In a single session the local delete is correct.

### 2. Root cause (confirmed by R3–R5)

**H1, multi-session variant: upsert-only full-state dual-write resurrects a profile deleted elsewhere.**
1. Session A deletes profile P: cloud row deleted (204), local state without P.
2. Session B of the same account (another tab, browser or device, logged in earlier) still has P in its local `vaultState` / IndexedDB. Hydrate runs only at login.
3. Any persist in session B (e.g. adding a site) runs `syncVaultStateToSupabase`, which **upserts every local profile** (`onConflict: user_id,local_profile_id`). P's cloud row is recreated with the same `local_profile_id` and a new `created_at`.
4. The next login of session A: `hydrateWorkspaceFromCloud` treats the cloud as authoritative for services that have cloud profiles and restores P locally. Dot on, 1-profile-without-credentials state; also after logout / login.
- The cloud has no tombstone or deletion marker, and the dual-write can't tell "deleted elsewhere" from "never synced". By design (D-109-25 / AC-109-39) it never deletes by omission and always re-upserts what it has.

**Secondary (code-level, same family, not observed):** inside one session, `deleteAccessProfileFromCloud` doesn't bump `dualWriteGeneration`. A dual-write already in flight from an earlier persist, whose state still contains P, can re-upsert P right after the DELETE (see the H1 analysis below).

**"Immediately":** not reproduced in a single session. Here the dot went off immediately (R2, R4). The likely explanation is the same multi-session mechanism: the Owner looked at a session that still held P, or logged in again after another session had re-upserted it. The Owner can confirm whether the account was open in another tab, browser or device during step 6.

**H2:** ruled out in practice; consecutive and single deletes leave correct local state (R2, R4).
**H3:** ruled out; same id and bytes everywhere, the modal listed the profile, no duplicates and no second service id.

### 3. Why the Developer stops here
- The fix needs a persistence decision in protected files (`src/supabase/persistence.ts` dual-write / hydrate, possibly `vault.ts`). Examples:
  - deletion tombstones (a server-side deleted marker, or a `deleted_profiles` table checked by upsert and hydrate);
  - having the dual-write skip profiles whose cloud row is missing but that were synced before;
  - a generation bump in `deleteAccessProfileFromCloud`.
- None of these is the Developer's call → **reported to the Architect; awaiting approval of the fix design.**
- Regression (brief item 4) is deferred to the approved design so that it tests the actual fix. Planned sequence in `verifyPhase123AppContext`:
  - two sessions on a stub cloud: session A deletes the last profile;
  - session B persists stale state;
  - session A hydrates → expect 0 profiles, no dot, empty state;
  - a mutation that restores the plain upsert reproduces D-123-1.
- Account side effect: profile «יעל 2» of PayPal was deleted twice by these runs and was resurrected once in between. At R5 the account has 0 PayPal profiles. A still-open other session holding P will recreate it on its next persist.

### 4. Earlier code analysis (read-only), kept for the record

**H3 — a profile that counts but is not listed in the modal: ruled out for whitespace / predicate differences.**
- The modal list (`getProfilesForService`), the panel (`profilesForService`) and the dot (`appHasProfile`) all use the same predicate, `profile.serviceId.trim() === serviceId.trim()`, over the same `vaultState.accessProfiles` array.
- `ServiceProfileManagementModal` only sorts that list; it filters nothing.
- The host is opened with `allServices.find(id === request.serviceId)`, the same id as the tile and the panel.
- `deleteAccessProfile` removes every entry with that id.
- So in one `vaultState`, the modal can't reach 0 profiles (add form) while the dot / panel still see 1 for the same id. Not ruled out without data: two different service ids behind one display name, or a modal opened for a different service.

**H2 — stale `vaultState` closure during consecutive deletes: not supported by the code.**
- Each delete is serialized by the modal's `saving` flag. `handleVaultStateChange` calls `setVaultState(next)` before `persistVault`, so the next delete runs from a fresh render.
- The only window is the `await deleteAccessProfileFromCloud` inside one delete. No other writer changes `accessProfiles` during it: the App writers are the profile host, the selection change, custom add / update, the selection-only prune, and login hydrate.

**Fail-closed path (fits "immediately" + "after login"; needs confirmation).**
- If `deleteAccessProfileFromCloud` throws (no session, network or RLS error), the host shows `PROFILE_DELETE_CLOUD_FAILED_MESSAGE` and the modal shows `MSG_SAVE_FAIL`. Local state is left unchanged (N-7, by design), and the cloud row still exists.
- Result: the dot stays immediately and after re-login, and the window shows the surviving profile.
- To confirm, we need to know whether a Hebrew error line appeared in the modal on the last delete.

**H1 — cloud resurrection: a real race exists in the code; it explains "after login", not "immediately".**
- Every `persistVault` starts an async, upsert-only `syncVaultStateToSupabase` of the whole state. Each persist bumps `dualWriteGeneration`, but an older dual-write is aborted only between upserts.
- `deleteAccessProfileFromCloud` does **not** bump the generation (unlike `removeUserServiceFromCloud`).
- Race: delete profile B → persist P1, whose state still contains A → P1's dual-write is iterating. The user deletes A: the cloud delete of A runs, then P1's in-flight dual-write upserts A again (`onConflict local_profile_id`).
- Local state has 0 profiles, cloud has A. On the next login, `hydrateWorkspaceFromCloud` treats the cloud as authoritative for that service's profiles and restores A (and the dot).
- A fix would touch the dual-write / cloud-delete ordering (`src/supabase/persistence.ts` / `vault.ts`, or a generation bump in the host), which is persistence behaviour. Per the brief → **report to the Architect before any change.**
- Also on unlock, `migrateVaultPayload` creates a «ראשי» `profile-legacy-<serviceId>` for any credential still keyed by a service id. A possible legacy source; also unlock-only.

---

## Slice 123.2 — Catalog (+ task R-123-1)

Phase 123, slice 123.2 "Catalog" (manager-phase123.md "Slice 123.2"), plus test-only task R-123-1 (subsection at the end).

### Implementation Summary
- **Container-agnostic catalog body** (`src/digitalHome/AppCatalog.tsx`, AD-123-8), extracted from ManageServices «הוספת אתרים»:
  - Reuses `filterDiscoveryServices` (through `filterCatalog`), `userFacingCategories` (moved from ManageServices into the shared user-side module `src/digitalHome/catalogModel.ts`), `classifyAddCustomService` (unchanged, still inside App's `addCustomService`) and `AddSiteModal`.
  - Search (FR-15): draft + commit on Enter / the search icon; clearing the field shows all.
  - Category chips (FR-16): «הכל» + `userFacingCategories()` (no «practice»), `aria-pressed`.
  - Every card's state comes from `catalogItemState(id, selectedIds, pendingIds)`. An app already on Digital Home is marked with a disabled «✓ כבר בבית הדיגיטלי» and has no «הוספה», so a duplicate tile can't be created (FR-17).
  - «הוספה» calls `onAddApp(serviceId)`. A `failed` outcome shows a Hebrew `role=alert` banner inside the catalog.
  - «+ הוספת אתר מותאם אישית» (AD-123-14) opens `AddSiteModal mode="create"` and calls `onAddCustom(definition)`. Every outcome is shown in Hebrew inside the modal: created → ««name» נוסף לבית הדיגיטלי.»; `already_in_user_home` / `same_user_custom_duplicate` / `catalog_service_available` → the existing offer dialog and copy, moved unchanged from ManageServices; thrown errors → `toFriendlySecurityError` inside the add-site form.
  - Catalog load error → inline «לא ניתן לטעון את קטלוג האתרים כרגע. האתרים שלכם עדיין זמינים.» + «נסו שוב» (`onRetryCatalog`).
  - Inputs: `services`, `categories`, `selectedIds`, `pendingIds`, `catalogError` and callbacks only. No profile data enters the catalog, and it writes nothing itself.
- **Digital Home catalog modal** (`src/digitalHome/AppCatalogModal.tsx`):
  - Dashboard's manage bar shows «+ הוספת אפליקציה» (`onOpenCatalog`). App hosts one `AppCatalogModal` (`catalogOpen`): a large central dialog, `min(1100px, 96vw)` × ≤ 92vh, `role=dialog`, `aria-modal`, RTL, title «הוספת אפליקציה».
  - Focus moves to the search field on open and returns to the opener on close. Tab is trapped in the dialog, or in the nested add-site / offer layer while one is open.
  - Escape, × and a backdrop click close the modal. Escape is ignored while a nested layer is open.
  - App wiring: `onAddApp = addApp`, `onAddCustom = addCustomService`, `onClose`.
  - `onRetryCatalog = retryCatalogLoad({ inline: true })`: the retry skips the full-screen loading flip, so Digital Home stays visible behind the modal.
- **Add path** (FR-18, AD-123-8): `addApp(id)` → `addService(id)` → `changeSelection(id, 'add')` → `addToSelection` + the existing `persistSelectionState` / `persistVault`. No profile is created.
  - `addApp` returns `already_added` for an id already selected; otherwise `added` or `failed` (Hebrew `SELECTION_PERSIST_FAILED_MESSAGE`).
  - `changeSelection` now returns `true` on success. Locked and failure paths keep their bare `return;` (verifyPhase113 AC-113-51 regex).
- **«עריכת פרטי האתר»** (AD-123-14, AD-123-17):
  - `LoginAssistancePanel` has an app-actions menu in the window header: ⋮ «פעולות אפליקציה» (`aria-haspopup="menu"`) → `role=menuitem` «עריכת פרטי האתר».
  - `showEditSiteDetails = actions.menu.edit_site_details && Boolean(onEditSiteDetails)`, where `edit_site_details` = the app is in the vault `customServices` (`Dashboard.isCustom = customServiceIds.has(id)`).
  - `showAppMenu = showEditSiteDetails`: it depends only on the menu's entries. It is outside the profile-UI gate (`launchKindOffersProfileUi`) and independent of credential mode, so it renders for every launch kind. For built-in apps the control stays hidden while it has no entries (allowed by AD-123-17). The profile UI keeps its current gating.
  - Choosing it closes the window. App's `openSiteDetailsEdit` (guarded by `customServiceIds.has`) opens `EditSiteDetailsModal`, which wraps the existing `AddSiteModal mode="edit"` (prefilled; `defaultSameAsWebsite`) and saves through the unchanged `updateCustomService`.
- **ManageServices** stays until 123.4:
  - It renders the same `AppCatalog` body in «הוספת אתרים» and the same `EditSiteDetailsModal` for its row-menu «עריכת פרטי האתר».
  - Prop `onAddService` → `onAddApp` (App passes `addApp`).
  - The row menu still gates on `source === 'user-created'` (verifyServiceSourceOwnership).
- `addCustomService` and `updateCustomService` are byte-identical to HEAD (checked by the verify). No new `persistVault` call site.

### Files Changed and Dependencies
- New, product code:
  - `src/digitalHome/catalogModel.ts`: `AddOutcome`, `userFacingCategories`, `filterCatalog`, `catalogItemState`. Named `catalogModel` because `appCatalog.ts` collided with `AppCatalog.tsx` on Windows (TS1149).
  - `src/digitalHome/customSiteForm.ts`: `buildCustomSiteDefinition` (AddSiteModal values → `createCustomServiceDefinition`).
  - `src/digitalHome/AppCatalog.tsx`
  - `src/digitalHome/AppCatalogModal.tsx`
  - `src/digitalHome/EditSiteDetailsModal.tsx`
- Modified, product code:
  - `src/App.tsx`: catalog / edit-site hosts, `addApp`, `changeSelection` return value, inline retry.
  - `src/Dashboard.tsx`: «+ הוספת אפליקציה», `onEditSiteDetails`.
  - `src/loginAssistance/LoginAssistancePanel.tsx`: app-actions menu.
  - `src/loginAssistance/messages.ts`: `LABEL_APP_ACTIONS`, `LABEL_EDIT_SITE_DETAILS`.
  - `src/ManageServices.tsx`: renders `AppCatalog` / `EditSiteDetailsModal`; local catalog code removed.
  - `src/App.css`: `.dh-catalog-*`, `.la-app-menu*`, `.app-catalog-status`; the manage bar wraps.
- New verify: `scripts/verifyPhase123Catalog.mjs`.
- Modified verifies (see "Superseded legacy assertions"): `scripts/verifyPhase123AppContext.mjs`, `scripts/verifyPhase104ServiceManagement.mjs`; R-123-1: `scripts/verifyPhase121IframeSurface.mjs`, `scripts/verifyPhase121InspectReadinessEligible.mjs`, `scripts/verifyPhase121PartialOcclusionPick.mjs`.
- Not modified: PHASE / arch / manager / plan files, `src/admin/**`, `extension/**`, `src/vault/**` (crypto / db / vault / vaultMigration / profileManagement), `src/supabase/**`, `src/serviceManagement/serviceSelection.ts`, `src/AddSiteModal.tsx`, `src/execution/**`, migrations.
- **Dependencies installed: none.** `git diff --stat HEAD -- package.json package-lock.json` is empty; `esbuild` / `playwright` were already devDependencies.

### New verify — `scripts/verifyPhase123Catalog.mjs`
Same style as `verifyPhase123AppContext.mjs`: `mutationArgs` + `tempDir` (cleanup in `finally`), in-memory mutations via `replaceOnce`, esbuild + Playwright Edge on 127.0.0.1. Static checks run first, so a mutation only a scan can see never reaches the bundler.
- **Static:**
  - Catalog files import only an allow-list of read-only modules: no profile reducers, `src/admin`, `vault`, `persistence` or `serviceSelection`. From `registryPersistence` they take copy / types only. They contain no direct write tokens (`persistVault`, `indexedDB`, `addToSelection`, `addAccessProfile`, `accessProfiles`, …), and `AppCatalogProps` has no profile input.
  - App wiring:
    - `addApp` → `addService(id)` → `changeSelection(id, 'add')` → `addToSelection`;
    - catalog host `onAddApp={addApp}` / `onAddCustom={addCustomService}`; edit host `onSave={updateCustomService}`;
    - `addCustomService` / `updateCustomService` bodies identical to HEAD;
    - `openSiteDetailsEdit` guard;
    - no new `persistVault`.
  - **AD-123-17 static:**
    - the `showAppMenu` / `showEditSiteDetails` definitions contain no `profileUi`, `showCredentialUi`, `launchKind`, `entry`, `credentialMode` or `form`;
    - `{showAppMenu && (` sits inside `<header className="la-panel-header">` with no such condition before it, and the header is not inside one;
    - profile-UI gating still `launchKindOffersProfileUi`;
    - no remove-app entry yet.
  - N-4 / N-5 / N-6 scans; N-1 / N-2 (11 protected paths incl. `serviceSelection.ts` and `AddSiteModal.tsx`, plus `src/admin`).
- **Pure:**
  - `userFacingCategories`;
  - `filterCatalog` = `filterDiscoveryServices` on 7 cases (name / domain / category / combined / no match);
  - `catalogItemState`;
  - `addToSelection` → 0 profiles, 0 credentials, idempotent;
  - `appContextActions.menu.edit_site_details = isCustom` for 0 / 1 / 2 profiles.
- **Browser** (real Dashboard, panel, AppCatalogModal, AppCatalog, AddSiteModal, EditSiteDetailsModal, real `persistVault` + `addToSelection`; the harness host mirrors App's `addApp` / `onAddCustom` / `onSave` contracts, and App itself is checked statically):
  - **Modal:** open, RTL, focus in search, 40 Tab / Shift+Tab presses stay inside, Escape / × / backdrop close, focus back to the opener, 0 writes.
  - **Search (FR-15) and categories (FR-16):** no match in Hebrew, name, domain, category, combined, «הכל».
  - **FR-17 / FR-18:** already-added apps marked and disabled; add → 1 persist, 0 profiles, 0 credentials, no dot, one tile; persist failure → Hebrew error in the modal, 0 writes, app stays available.
  - **FR-19:** 5 custom adds, each delegated once to `onAddCustom`: created, already-in-home, own duplicate, catalog-available offer (its «הוסף לבית הדיגיטלי» → `onAddApp`, 0 profiles), registry error. All shown in Hebrew inside the modal. Escape under a layer keeps the catalog.
  - **Catalog error:** inline Hebrew error + «נסו שוב» → `onRetryCatalog` → recovers; Digital Home stays usable.
  - **AD-123-17 runtime:** four custom apps, one per launch kind (`credentials`, `missing-user-credentials`, `no-stored-credentials`, `not-configured`; launch kind asserted from `data-launch-kind`). Each shows ⋮ «פעולות אפליקציה» → «עריכת פרטי האתר» → prefilled edit form; save (not-configured case) → `onUpdateCustom` once with the same id, new name on the tile.
    - Profile UI present only for the two form kinds (gating unchanged).
    - Built-in app: no menu, no «עריכת פרטי האתר».
    - 0 local writes.
    - Fixture note: a user-created source always resolves to a credential form, so the no-stored / not-configured custom apps are vault-custom ids whose runtime source is the catalog (AD-123-14 promoted-site note). The menu keys only on `isCustom`.

Mutations (each must FAIL the script):

| Id | Mutation (in memory) | Caught by |
|----|----------------------|-----------|
| M1 | `addToSelection` also appends a default «ראשי» profile | pure "FR-18: addToSelection creates 0 profiles" |
| M2 | `catalogItemState` ignores `selectedIds` | pure "FR-17: selected app → added" |
| M3 | `edit_site_details: true` | pure "AD-123-14: edit_site_details = isCustom (…custom=false)" |
| M4 | `showAppMenu = profileUi && showEditSiteDetails` | static AD-123-17 "app menu does not depend on launch kind / profile UI" |
| M5 | `AppCatalog.tsx` imports `../admin/adminRoutes` | static "N-8 / AD-123-8: … imports from src/admin" |
| M6 | `AppCatalog.tsx` imports `persistVault` and calls it after `onAddApp` | static "AD-123-8: … imports outside the read-only allow-list (../vault/vault)" |

The runner stops at the first failing check, so each mutation is reported by the earliest layer that sees it. M1 / M3 / M4 behaviour is also asserted by the browser layer (0 profiles after add; no menu for built-in; menu in all four kinds), but that layer was not separately demonstrated per mutation.

### T-1 Results (final code)
New / updated Phase 123 verifies:

| Command | Result | Wall time |
|---------|--------|-----------|
| `node scripts/verifyPhase123Catalog.mjs --no-mutations` | `PASS — Phase 123.2 Catalog: 15 check groups, mutation sweep skipped (--no-mutations) — 18s` | 21.0s |
| `node scripts/verifyPhase123Catalog.mjs --mutations=M1,M2,M3,M4,M5,M6` | `PASS — Phase 123.2 Catalog: 15 check groups, 6 selected mutations caught — 18s` | 21.1s |
| `node scripts/verifyPhase123AppContext.mjs --no-mutations` | `PASS — Phase 123.1 App context: 18 check groups, mutation sweep skipped (--no-mutations) — 21s` | 25.2s |

Verifies referencing a changed file. Found with rg for `App.tsx`, `ManageServices`, `Dashboard`, `LoginAssistance`, `messages.ts`, `App.css` and `digitalHome/` in `scripts/verify*.mjs`, retired scripts excluded. Only `verifyPhase122AdminWorkspace` supports `--no-mutations`; the others run plain:

| Verify | Result | Wall time |
|--------|--------|-----------|
| verifyPhase102CredentialSchema | `PASS: Phase 102 credential schema helper …` | 0.3s |
| verifyPhase103Execution | `PASS: Phase 103 unified execution (static)` | 0.1s |
| verifyPhase104ServiceManagement | first run FAIL (`Added services in add section must show passive "כבר בבית הדיגיטלי" state`, catalog strings moved to `AppCatalog.tsx`); after the AD-123-8 / AD-123-14 retarget: `PASS: Phase 104 Service Management (static)` + `PASS: Phase 104 custom-add classifier runtime …` | 0.3s / 1.7s |
| verifyPhase108BrowserIntegration | `PASS: Phase 108 browser integration abstraction (static)` | 0.2s |
| verifyPhase108KnownServiceBootstrap | `PASS: Phase 108 known-service empty-DB bootstrap (static)` | 0.1s |
| verifyPhase108M1ExplicitLoginEntry | `PASS: Phase 108 M1 explicit login entry …` | 0.2s |
| verifyPhase109Accounts | `verifyPhase109Accounts: PASS` | 0.2s |
| verifyPhase111Assets | `verifyPhase111Assets: PASS` | 0.1s |
| verifyPhase112LoginIntelligence | `verifyPhase112LoginIntelligence: PASS` | 0.2s |
| verifyPhase113LoginAssistance | `verifyPhase113LoginAssistance: PASS` | 0.1s |
| verifyPhase116CustomAddIdentity | `verifyPhase116CustomAddIdentity: PASS (S0–S4 static + R1–R11)` | 1.2s |
| verifyPhase117ManagedAutofill | `verifyPhase117ManagedAutofill: PASS (T0–T28 …)` | 0.8s |
| verifyPhase122AdminWorkspace `--no-mutations` | `PASS — Phase 122 Admin Workspace up to 122.8: 32 check groups, mutation sweep skipped (--no-mutations) — 2m 30s` | 152.0s |
| verifyServiceSourceOwnership | `PASS: service source/ownership root-cause regression` | 0.3s |

Phase 121 / 122 admin verifies: **43 / 43 PASS.**
- The three R-123-1 scripts pass (outputs in the R-123-1 subsection): IframeSurface 6.8s, InspectReadinessEligible 24.2s, PartialOcclusionPick 2.7s.
- `verifyPhase122AdminWorkspace --no-mutations` passes (above).
- The other 39 run plain, all exit 0. The longest are ChoiceScreen 51.9s, DeleteService 46.0s, AdminNotes 55.0s, SubmitterProfiles 50.4s, StepButtons 27.1s and PasswordlessSurface 21.7s.

Build and diff checks:
- `git diff --stat -- src/admin` → empty.
- `git diff --stat HEAD -- extension` → empty, also after `npm run build`, which regenerates `extension/discovery/login-entry-discovery.js` byte-identically.
- `npx tsc -b` → exit 0.
- `npm run build` → exit 0 (Vite build OK; only the existing chunk-size warning).
- Lints (ReadLints) on all edited source and script files → none.
- Temp cleanup: no `%TEMP%/pv-1232-*`, `pv-123-*` or `pv-r1231-*` dirs or scripts, and no `node_modules/.tmp/pv-*` dirs left.
- Not run, per T-1: full mutation sweeps, `runOfflineRegression`, live-only `verifyPhase101Supabase` / `verifyPhase102Registry`.

### Functional Testability
Automated (`verifyPhase123Catalog.mjs`):

| Requirement | Automated check | Layer |
|-------------|-----------------|-------|
| FR-15 search | no match (Hebrew), name, domain, cleared | pure + browser |
| FR-16 categories | chip filter, `aria-pressed`, combined with search, «הכל», no «practice» | pure + browser |
| FR-17 already added | marked, disabled «✓ כבר בבית הדיגיטלי», no «הוספה», one tile each | pure + browser |
| FR-18 add, no profile | `addToSelection` 0 profiles; browser add → 1 persist, 0 profiles, no dot; App path → `changeSelection(id,'add')` | pure + browser + static |
| FR-19 custom add | 5 outcomes in Hebrew inside the modal; delegated to `onAddCustom` = unchanged `addCustomService` | browser + static |
| Catalog load error | inline error + retry inside the modal; Digital Home usable | browser |
| Modal a11y | focus in search, Tab trap, Escape / × / backdrop, focus return, RTL | browser |
| AD-123-14 edit-site custom only | `edit_site_details = isCustom`; App guard; no menu on built-in | pure + static + browser |
| AD-123-17 menu for every launch kind | four custom apps, one per launch kind; menu not inside the profile gate | browser + static |
| N-7 fail-closed | add persist failure → Hebrew error, 0 writes | browser |

Manual: the 7-step 123.2 table is under "Functional Testability — manual run" (after the 123.1 table). All outcomes are "not run — awaiting Owner".

### Documentation Update Evidence
- Updated: this file (section "Slice 123.2", the 123.2 manual-step table, the Status / Source References lines).
- No other docs needed:
  - 123.2 adds no setup step, command, environment variable, dependency or migration.
  - `verifyPhase123Catalog.mjs` is picked up automatically by `scripts/runOfflineRegression.mjs`.
  - The behaviour is specified in `arch-phase123.md` / `manager-phase123.md`, which the Developer does not edit.

### Superseded legacy assertions (updated with an AD comment; nothing else weakened)

| Script | Old assertion | New assertion | Superseding AD |
|--------|---------------|---------------|----------------|
| `verifyPhase123AppContext.mjs` (`checkPanelStatic`) | no `menu.remove_app` / `menu.edit_site_details` / «הסרת אפליקציה» / «עריכת פרטי האתר» in the panel (123.1 scope) | still no `menu.remove_app` / «הסרת אפליקציה» (123.3); «עריכת פרטי האתר» now allowed | AD-123-14 / AD-123-17 |
| `verifyPhase123AppContext.mjs` (N-3 import baseline) | Supabase imports of each Digital Home file ⊆ that file's HEAD imports | Same, except that the code extracted from ManageServices (`AppCatalog.tsx`, `EditSiteDetailsModal.tsx`, `customSiteForm.ts`) uses ManageServices' HEAD imports as its baseline. The new Digital Home files were also added to the N-3 / N-5 / N-8 scan list (stricter) | AD-123-8 |
| `verifyPhase104ServiceManagement.mjs` (surface) | strings read from `ManageServices.tsx` only | strings read from `ManageServices.tsx` + `AppCatalog.tsx` (ManageServices renders it). Presence checks unchanged; absence checks now also cover the catalog body | AD-123-8 |
| `verifyPhase104ServiceManagement.mjs` (AC-104-4) | exactly one «+ הוסף אתר» | exactly one «+ הוספת אתר מותאם אישית» and zero «+ הוסף אתר» | AD-123-14 |

### N-1…N-8 Compliance
- **N-1:** `git diff --stat -- src/admin` is empty; 43 / 43 Phase 121 / 122 admin verifies pass.
- **N-2:** protected paths unchanged vs HEAD and with no new files, enforced in the verify: `src/vault/crypto.ts`, `src/vault/vault.ts`, `src/vault/db.ts`, `src/vault/vaultMigration.ts`, `src/supabase/persistence.ts`, `src/supabase/registryPersistence.ts`, `src/serviceManagement/serviceSelection.ts`, `src/AddSiteModal.tsx`, `src/execution`, `extension`, `extension/manifest.json`. Auth / unlock / sync / user-table RLS untouched, no migration.
- **N-3 / AD-123-4:** no new write path.
  - Catalog add = existing `addToSelection` → `persistSelectionState` → `persistVault`.
  - Custom add / edit = existing `addCustomService` / `updateCustomService`, unchanged vs HEAD.
  - No new `persistVault` call site in App; catalog / edit-site files contain no IndexedDB / Supabase / vault calls.
- **N-4:** no `window.confirm` / `alert` / `prompt`. The catalog offer, add-site and edit-site forms are in-page dialogs; the browser layer also asserts no native dialog appeared.
- **N-5:** no site / hostname / serviceId / fixture branches in the new files, panel or Dashboard (scanned).
- **N-6:** all new copy is Hebrew («+ הוספת אפליקציה», «הוספת אפליקציה», «+ הוספת אתר מותאם אישית», «פעולות אפליקציה», «עריכת פרטי האתר», catalog messages). The modal is `dir="rtl"`; tiles are unchanged.
- **N-7:** fail-closed. Catalog-add persist failure → Hebrew error, no tile, no write. Custom add / edit errors → Hebrew error in the form, state unchanged. Catalog load error → inline error, Digital Home usable.
- **N-8:** no `src/admin` imports in Digital Home code (M5 proves the check bites).

### Known Issues / Limitations
1. **0 apps + failed inline retry:** if the user has 0 apps on Digital Home and a catalog retry from inside the modal fails, App's existing full-screen catalog error (`catalogError && selectedIds.size === 0`, AC-104-10) replaces Digital Home. With ≥ 1 app the error stays inline in the modal. This is pre-existing App behaviour and was left unchanged; not BLOCKED.
2. **Two "custom" rules until 123.4:** the Digital Home menu uses vault `customServices` (AD-123-14). The ManageServices row menu still uses `source === 'user-created'`, kept so verifyServiceSourceOwnership stays unchanged. ManageServices is removed in 123.4.
3. **AD-123-17 fixture note:** a user-created custom site can only be `credentials` / `missing-user-credentials`. The no-stored / not-configured custom cases exist only for vault-custom ids whose runtime source is the catalog (AD-123-14 promoted-site note); the runtime check uses that fixture.
4. **Copy change in «ניהול אתרים»:** the custom-add button there now reads «+ הוספת אתר מותאם אישית» (was «+ הוסף אתר»), because ManageServices renders the shared catalog body with the AD-123-14 label.
5. The Slice 123.1 Known Issue 2 (three Phase 121 baselines) is resolved by R-123-1. Slice 123.1 Known Issue 1 was decided by the Architect as AD-123-17 and is implemented here.

No BLOCKED items in 123.2.

### Scope Compliance
- Only slice 123.2 + R-123-1. No remove-app flow, no «הסרת אפליקציה» entry, and «ניהול אתרים» / ManageServices remain (123.3 / 123.4 not started).
- Admin area unchanged; no change to auth / unlock / crypto / `persistVault` / sync / user-table RLS; writes only via existing reducers + `persistVault` + existing cloud functions; no browser dialogs; no site / hostname / serviceId branches; no extension / manifest change; Hebrew RTL.

### R-123-1 — Phase 121 scope-check re-baseline (test-only)

**Files changed** (only the "revert slice edits == HEAD" scope comparisons; no behavioural assertion or mutation touched):

| Script | Check replaced | Option | Reference |
|--------|----------------|--------|-----------|
| `verifyPhase121IframeSurface.mjs` (§10, line ~1079) | `revert49(revert71(managed-target-eligibility.js)) === HEAD` | **1** | `git show 909cc8b~1:extension/generic/managed-target-eligibility.js` |
| `verifyPhase121InspectReadinessEligible.mjs` (`checkScope`, `revertD12149Ok`) | (a) the `oldRule` must be present in `HEAD:page-structure-inspect.js`; (b) `revert49(revert71(managed-target-eligibility.js)) === HEAD` | **1** | `PRE_SLICE_REV = '909cc8b~1'` for both |
| `verifyPhase121PartialOcclusionPick.mjs` (`checkScope`, line ~269) | `revert49(revert71(managed-target-eligibility.js)) === HEAD` | **1** | `git show 909cc8b~1:extension/generic/managed-target-eligibility.js` (message: "…reproduces the pre-slice bytes") |

`git diff --stat` of the three scripts: 6 + 8 + 4 lines (13 insertions, 5 deletions).

**Why Option 1 (proof):** a read-only standalone probe in `%TEMP%` (since deleted) imported the scripts' own revert helpers and compared LF-normalized bytes:
- `revertD12149EligibilityEdits(revertD12171EligibilityEdits(current managed-target-eligibility.js)) === git show 909cc8b^:…` → **true** (vs `HEAD` → false; current file vs `909cc8b^` → false, so the comparison isn't trivial).
- InspectReadiness check (a) is an inclusion check, not an equality check. The Phase 119 `oldRule` is present in `909cc8b^:page-structure-inspect.js` → **true** (in `HEAD` → false). Its separate sha256 pin check (`c4dd466d…`) was already passing and is unchanged.
- So the frozen files under `scripts/lib/phase121-baseline/` (Option 2) were not needed for any script.

`909cc8b~1` is used instead of `909cc8b^`. Both resolve to `e22caf2d8ec84ba40ba663994808a4ab4bf0af6b` (`git rev-parse`), but the scripts call git through `execSync`, i.e. `cmd.exe` on Windows, where `^` is the escape character: `909cc8b^:` silently became `909cc8b:` (= HEAD). The first edit with `^` still failed for exactly that reason; `~1` has no shell metacharacter.

**Before (current HEAD baseline, all FAIL, exit 1):**
- `verifyPhase121IframeSurface.mjs` (5.3s): sections 1–9 ✓, then `Error: extension/generic/managed-target-eligibility.js untouched outside the D-121-49 edits` at line 1078.
- `verifyPhase121InspectReadinessEligible.mjs` (8.6s): rules 1–4 ✓, then `Error: pre-slice rule = the committed Phase 119 early-exit rule` (checkScope, line 270).
- `verifyPhase121PartialOcclusionPick.mjs` (2.7s): items 1–2 ✓, then `Error: eligibility: reverting D-121-71 then D-121-49 reproduces HEAD (only evaluate() changed)` (checkScope, line 268).

**After (frozen pre-slice reference, all PASS, exit 0):**
- `verifyPhase121IframeSurface.mjs` (6.8s): `PASS — Phase 121.1-IF iframe credential surface (AC-121.1-IF-1…18 static/unit; live items listed above)`; LIVE_ONLY (4) listed, not reported as PASS.
- `verifyPhase121InspectReadinessEligible.mjs` (24.2s): 5 check groups ✓ incl. `scope: only the readiness decision changed …`; mutations M1–M7 all caught; `PASS — Phase 121 D-121-52 inspect readiness (5 check groups, 7 mutations caught)`.
- `verifyPhase121PartialOcclusionPick.mjs` (2.7s): 6 check groups ✓ incl. `scope: manifest unchanged; only evaluate() and the pick field branch changed …`; mutations M1–M8 all caught; `PASS — Phase 121 D-121-71 partial occlusion + point pick (6 check groups, 8 mutations caught)`.

**Bite proof:** a standalone `%TEMP%` script (deleted afterwards) restated the re-baselined comparison exactly: same revert helpers, same `execSync('git show 909cc8b~1:…')`. It ran on a temp copy (`mkdtemp`, removed in `finally`):
- control, unmodified copy → `true` (passes);
- one-line edit outside the slice edits (line 1 appended with `// bite`; `evaluate()` is at line 141) → `false` (the check **FAILS**);
- `temp dir removed: true`.
The same comparison is shared by all three scripts. The InspectReadiness `oldRule` inclusion check bites against HEAD, as shown by the "before" failure above.

**Extension diff:** `git diff --stat HEAD -- extension` → empty (before and after `npm run build`). No product code changed by R-123-1.

### Developer Declaration
Slice 123.2 and task R-123-1 were implemented within the authorized scope.
- `verifyPhase123Catalog.mjs` passes, with M1–M6 caught. `verifyPhase123AppContext.mjs` passes.
- Every verify that references a changed file passes (verifyPhase104 after an AD-123-8 / AD-123-14 retarget, listed above), and 43 / 43 Phase 121 / 122 admin verifies pass.
- `tsc` and `build` pass; `src/admin` and `extension` are unchanged.
- Manual steps: not run — awaiting Owner. No BLOCKED items.

Stopping for Manager review → Architect review. 123.3 not started.

---

## Fix round D-123-1…5

Normative: `arch-phase123.md` Review Notes D-123-1…D-123-5, AD-123-18 and **AD-123-18 amendment A** (persisted outbox), plus the H-1 corrections (a)–(e). Slices 123.1 + 123.2 reopened for these items only. 123.3 not started.

### Implementation Summary

**D-123-1 / AD-123-18 + amendment A — outbox-scoped sync.** Amendment A replaces my earlier session-scoped insert set, its tombstones and Known Issue 1 (legacy rows).
1. **Persisted outbox (amendment A).** New `src/vault/syncOutbox.ts`.
   - The encrypted vault payload gains one field: `syncOutbox: { serviceIds, profileIds }`. Default is empty; a missing or malformed value normalizes to empty (`normalizeSyncOutbox`: strings only, trimmed, unique).
   - It holds the ids of app memberships and profiles created locally and not yet confirmed in the cloud. A custom site's registry row is written before the local commit, so only its membership can be unconfirmed, and it goes in `serviceIds`.
   - `VaultState.syncOutbox` is optional: missing = empty. This keeps `hydrateWorkspaceFromCloud` byte-identical to HEAD.
   - Every local state change goes through `recordLocalCreations(latest, next)` (App prune, `changeSelection`, `addCustomService`, `handleVaultStateChange`). It adds ids that are new in `next` and removes ids no longer in `next`. The base is always the latest committed outbox.
   - No cloud schema change. Crypto, keys, unlock and `persistVault` semantics are unchanged. `crypto.ts` / `vault.ts` change by exactly three lines each: the import, the field declaration, and the decode default (`normalizePayload`) or the persist mapping (`payloadFromVaultState`). Diff quoted under "Amendment A"; checked by `checkVaultPayloadShapeOnly`.
2. **Insert rule.** `syncVaultStateToSupabase` inserts (upserts) a membership or profile only when its id is in the outbox.
   - Every other known profile is written update-only: `.update(...).eq(user_id).eq(local_profile_id).select('id')`. Zero rows means the row is gone.
   - A membership not in the outbox is never written: an existing one is reused, and a missing one is reported gone.
   - Rows unchanged since the in-memory baseline are skipped (D-123-5).
   - The sync returns `confirmed: { serviceIds, profileIds }`: an outbox membership found existing or inserted, and an outbox profile whose insert returned its row.
3. **Clear only on a confirmed insert.** The Safe wrapper emits confirmations through `setCloudConfirmedListener`. App removes those ids with `clearConfirmedInserts` and saves with `persistVault(next, { skipCloudSync: true })`.
   - A failed, skipped or aborted insert confirms nothing, so the id stays and is retried on the next sync.
   - A confirmation can arrive before the state that carries its outbox entry is committed (`addCustomService` awaits its sync). It is held (`rememberEarlyConfirmations`) and applied on the next commit (`takeEarlyConfirmations`).
4. **Login / re-hydrate keep-or-drop.** `applyOutboxAfterHydrate(local, hydrated, cloudIds)` in `src/digitalHome/cloudReconcile.ts`:
   - a local row absent from the cloud is kept, with its credentials, if its id is in the outbox. It is inserted by the next sync;
   - otherwise it is removed locally with its credentials. Legacy rows (no outbox) follow this removal rule;
   - outbox ids already in the cloud are confirmed and cleared;
   - when the cloud ids cannot be read (`null`), or the cloud membership is empty (D-109-25), nothing is dropped.
   At login App runs: hydrate → cloud baseline read (`fetchCloudSyncBaseline`) → `applyOutboxAfterHydrate` → baseline = the cloud as read → repair sync of the differing rows only (no `writeAll`, Known Issue 5 below) → drop gone rows and clear confirmed ids → persist (local only).
5. **Gone → local removal.**
   - The sync returns `{ goneProfileIds, goneServiceIds }` and the Safe wrapper emits them through `setCloudGoneListener`.
   - App drops those rows with `dropGoneFromVault`: the app selection, its profiles and their credentials, and single profiles with their credentials, with defaults normalized. It then saves local-only.
   - A stale screen cannot re-add a dropped row: dropped ids are held in memory (`noteDroppedRows`) and `recordLocalCreations` will not put them back in the outbox. A deliberate re-add of the same app by the user (`noteDeliberateAdd`) lifts the guard, and that app is inserted.
6. **Re-hydrate on return.**
   - On `visibilitychange` / `focus`, App calls `refreshWorkspaceFromCloud`, throttled to once per 10 s and never two at a time.
   - It reads the cloud ids (`null` = cannot verify, nothing changes), runs the existing `hydrateWorkspaceFromCloud`, applies the same keep-or-drop rule, overlays pending local edits of kept profiles, and rebases the baseline.
   - An empty cloud membership with known local apps aborts (D-109-25). A refresh result is discarded if local state changed during the read.
   - A floating window on an affected app closes with the Hebrew notice «האפליקציה או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.» (Dashboard, via the `cloudReconcile` prop). The profile modal and the site editor on a removed item close too, with the same notice.
7. **In-memory baseline (D-123-5 only).** `src/supabase/sessionSyncScope.ts` now only keeps the "has this row changed since login / last sync" baseline: profile value snapshots and credential object references. No secret is copied. It no longer decides inserts and holds no tombstones.
8. **Same-session race.** `DigitalHomeCredentialModal` calls `bumpDualWriteGeneration()` right before `await deleteAccessProfileFromCloud(profileId)`.
9. **Fail-closed.**
   - A failed membership read throws: nothing is inserted, nothing is confirmed, nothing is reported gone, and local state is unchanged.
   - A failed id read in the refresh → `null`, nothing changes.
   - An empty cloud membership never reports gone.
10. **Not changed:** keys, unlock, the KDF functions, `persistVault` semantics, RLS, schema, the RPC set. `hydrateWorkspaceFromCloud`, the upsert helpers, the credential delete, `ensureUserRow` and `removeUserServiceFromCloud` are byte-identical to HEAD (9 named functions, checked by `verifyPhase123AppContext`).

**D-123-2 — catalog size.** `.dh-catalog-dialog` has `height: min(820px, 92vh)` (was content height) and is a flex column with `overflow: hidden`. Only `.sm-add-results` scrolls (`flex: 1; min-height: 0`). The size no longer changes on search or category.

**D-123-3 — backdrop rule in all user dialogs.** New `src/digitalHome/dialogDismiss.ts`:
- `useBackdropDismiss(onClose, { containsForm })`: no backdrop close for form dialogs; for other dialogs, a close only when the press AND the release are on the backdrop.
- `useEscapeToClose`.

Applied to:

| Dialog | Kind | Change |
|---|---|---|
| `AddSiteModal` (create + edit-site) | form | no backdrop close; Escape closes (not while saving) |
| `AppCatalogModal` (contains the search form) | form | overlay mousedown close removed |
| `ServiceProfileManagementModal` | form | overlay click close removed (its Escape / dirty prompt kept) |
| `ProfileChooserModal` | form | overlay click close removed; Escape added |
| `CredentialModal` (not rendered anywhere today) | form | same as above |
| catalog offer (`AppCatalog`) | no form | press + release rule; Escape closes |

×, «ביטול» and Escape still close. Admin dialogs are out of scope (`src/admin` unchanged, N-1). The `ManageServices` row-menu backdrop is a dropdown, not a dialog, and is unchanged.

**D-123-4 — custom-site category.**
- In create mode the category starts empty, with the disabled placeholder «בחרו קטגוריה».
- Submit is blocked with «יש לבחור קטגוריה» (`role="alert"`, `aria-invalid`).
- Edit mode keeps the stored category (`initialCategory`).

**D-123-5 — custom-site save time.** See "D-123-5 measurement" below.
- Outside protected code: the catalog / category reload after a custom create / edit now runs in the background (`refreshCatalogAfterCustomSave`). The tile already comes from vault `customServices`.
- Dev-only stage timing (`src/dev/saveTiming.ts`, `console.info('[timing] …')` only when `isDevBuild()`): `registryUpsert`, `persistVaultAndSync`, `catalogReload (background)`, `totalMs`.
- The main cost was the full-state sync. Under AD-123-18 it writes only the changed or new rows, as the prompt allowed ("may combine with item 1"). **Flagged for the Architect.**

### D-123-5 measurement
- **Before (observed on the real account in the D-123-1 reproduction, network log):**
  - the awaited full-state dual-write upserted every membership (10:34:32.0 → 36.8, ≈ 4.8 s);
  - then every profile + credential (10:33:45.3 → 54.5, ≈ 9.2 s);
  - ≈ 140 sequential requests (≈ 47 memberships, 48 profiles, ≈ 40 credentials) ≈ 14 s;
  - plus the registry upsert (3 requests) and the awaited catalog / category reload.
- **After (request counts, measured by `verifyPhase123Sync` against the fake client):**
  - a new app + 2 profiles + 1 credential = 6 table requests + 1 presence RPC;
  - an idle save = **0 requests**;
  - a rename = 2 writes (`users` + 1 profile update).
  - A custom-site create's sync = `ensureUserRow` + presence RPC + 1 membership read + 1 membership insert. A name / URL / category edit changes only `customServices`, so the sync tables are not written. The catalog reload no longer blocks the form.
- **Real-account stage times: not run — awaiting Owner.** The test-account password was exposed in chat and is not reused. When the Owner runs the dev server, every custom create / edit prints `[timing] custom-site create|edit { registryUpsert, persistVaultAndSync, catalogReload (background), totalMs }` in the console. No credential value is logged.

### Files Changed
- **Product (new):** `src/vault/syncOutbox.ts` (amendment A), `src/supabase/sessionSyncScope.ts` (baseline only), `src/digitalHome/cloudReconcile.ts`, `src/digitalHome/dialogDismiss.ts`, `src/dev/saveTiming.ts`.
- **Product (modified):**
  - `src/vault/crypto.ts`, `src/vault/vault.ts` (amendment A: the one payload field only, 3 lines each);
  - `src/supabase/persistence.ts` (AD-123-18 + amendment A; completion round: new read-only `fetchCloudSyncBaseline` for Known Issue 5);
  - `src/supabase/sessionSyncScope.ts` (completion round: `resetSessionSyncBaselineFromCloud`);
  - `src/App.tsx` (login keep-or-drop + cloud baseline + diff-only repair + `[timing] login`, gone and confirmed listeners, outbox recording, focus refresh, surface close, D-123-5 timing + background reload);
  - `src/Dashboard.tsx` (window close + notice);
  - `src/loginAssistance/DigitalHomeCredentialModal.tsx` (bump before delete);
  - `src/App.css` (D-123-2);
  - `src/AddSiteModal.tsx` (D-123-3 / D-123-4);
  - `src/digitalHome/AppCatalog.tsx`, `src/digitalHome/AppCatalogModal.tsx`, `src/ServiceProfileManagementModal.tsx`, `src/profile/ProfileChooserModal.tsx`, `src/CredentialModal.tsx` (D-123-3).
- **Tests:** new `scripts/verifyPhase123Sync.mjs` and `scripts/lib/withTimeout.mjs` (H-1); modified `scripts/verifyPhase123AppContext.mjs`, `scripts/verifyPhase123Catalog.mjs`, `scripts/verifyPhase121DeleteService.mjs`.
- **Dependencies:** none (`package.json` / lock unchanged). No DB, RLS or migration change.

### New verify — `scripts/verifyPhase123Sync.mjs`
- Node bundle of the **real** `persistence.ts`, `sessionSyncScope.ts`, `syncOutbox.ts`, `registryPresence.ts` and `cloudReconcile.ts`.
- They are loaded as **two independent module instances**: sessions A and B of one user.
- Both sessions share one in-memory fake Supabase (`user_services` / `access_profiles` / `encrypted_credentials` with FK cascades). Stubs: client, auth, a reversible fake cipher, devMode, registryMapper. The fake cipher also models legacy vault-key ciphertext (prefix `vk:`), readable only when the vault key is among the keys.
- Second bundle (completion round): the **real** `vault.ts` + `crypto.ts` (argon2id + AES-GCM, as in the app). Only IndexedDB (`db.ts`, in-memory map) and the cloud seams of `vault.ts` are stubbed.
- The `login` helper mirrors App: hydrate with `[cloudKey, vaultKey]` → `fetchCloudSyncBaseline` → `applyOutboxAfterHydrate` → `resetSessionSyncBaselineFromCloud` (fallback `resetSessionSyncBaseline` when the read fails) → repair without `writeAll` → drop gone + clear confirmed.
- Fixture = the D-123-1 account shape («יעל 2» on a pay app, plus an app whose only profile is deleted).
- 14 groups (12–14 added in the completion round):
  1. `checkWiring`: static App / host wiring;
  2. `checkOutboxHelpers`: normalize (missing / malformed → empty), record (add new, remove deleted, never re-add a dropped row, deliberate re-add lifts the guard), clear;
  3. `checkStaleProfileNotRecreated`: stale B (an unrelated save, an edit of the deleted profile, the `writeAll` repair) never recreates «יעל 2»; gone reported; dropped locally with its credential;
  4. `checkStaleAppNotRecreated`: app removed in A; B's edit and repair never recreate the membership or profile; re-add after the drop inserts;
  5. `checkOwnCreationsInserted`: an outbox profile (+ credential) and an outbox app are inserted; idle save 0 requests; rename update-only;
  6. `checkNeverSyncedSurvivesReload`: a profile created offline survives a reload (outbox in the payload), survives a login against a cloud without it, and is inserted by the next online sync;
  7. `checkDeletedElsewhereRemovedAtLogin`: a row deleted elsewhere is removed at login, for an outbox vault and for a legacy vault (no outbox). Completion round: it also asserts that the keep-or-drop step alone removes them, before any sync;
  8. `checkOutboxClearedOnlyOnConfirm`: a failed insert keeps the id; a confirmed insert clears it; early confirmations are handed over;
  9. `checkFocusRefresh`: drops deleted profiles and removed apps, keeps outbox rows, confirms outbox rows already in the cloud; a discarded refresh plus a stale save recreate nothing;
  10. `checkFailClosed`: membership / profile read errors, empty cloud; background gone → listener;
  11. `checkNoOutboxNoInsertAndGeneration`: an empty outbox inserts nothing; a bumped generation aborts an in-flight write;
  12. `checkLoginWritesOnlyDiffs` (Known Issue 5): an idle login writes 0 membership / profile / credential rows; a legacy vault-key credential is still re-keyed; a local credential missing in the cloud is uploaded; the next login is idle again;
  13. `checkFailedInsertKeepsId`: a failed profile insert confirms nothing and keeps its id, also across a reload (row + credential kept); once the cloud accepts it, it is inserted and the confirmed id leaves the outbox;
  14. `checkOldVaultUnlocks` (real `vault.ts` + `crypto.ts`): a HEAD-format vault (no `syncOutbox`) unlocks with an empty outbox and its profiles, credentials and apps; a wrong password is still rejected; an unsynced creation survives `persistVault` → `lockVault` → `unlockVault` and is inserted at the next login.
- Mutations M1–M30 (M1 = the pre-AD-123-18 upsert, which reproduces D-123-1; M24–M30 added in the completion round). The regressions amendment A names map to these mutations:
  - an unsynced creation survives reload / lock-unlock and is inserted later: M7, M8, M18, M19;
  - an offline creation is kept: M7, M8, M9;
  - a legacy absent row is removed with its credentials: M6 (caught by the login check: the keep-or-drop step alone must remove it), M5 (the second path at login, the repair's gone report);
  - an old vault decodes + unlocks: M24 (and M15 in `verifyPhase123AppContext`);
  - a failed insert keeps the id: M11, M30;
  - a confirmed insert removes it: M12, M22, M23;
  - a stale session B never inserts a row outside its own outbox: M1 (D-123-1 reproduced), M2, M3, M16, M17, M21.
- Known Issue 5 mutations: M25 (login baseline treats every credential as in the cloud → legacy re-key lost), M26 (empty login baseline → the idle login rewrites every row), M27 (`writeAll` back in the login repair), M28 (login baseline from the hydrated state), M29 (`[timing] login` not logged).

### Changes to existing verifies
- `verifyPhase123AppContext.mjs`:
  - persistence stub gains the new exports;
  - new static `checkPersistenceScope` (AD-123-18 limits) and `checkDialogBackdropRule` (all 6 user dialog overlays);
  - new browser checks `checkRemovedElsewhereCloses` and `checkProfileDialogBackdrop`;
  - new static `checkVaultPayloadShapeOnly` (amendment A). Completion round, stricter: an explicit allow-list of exactly 3 lines per file; removing each once must give HEAD byte for byte (CRLF normalized);
  - completion round: the persistence stub gains `fetchCloudSyncBaseline`; the App import allow-list is now `fetchCloudSyncBaseline` and `resetSessionSyncBaselineFromCloud` instead of `fetchCloudWorkspaceIds`;
  - new mutations M10–M15 (M13 = `persistVault` semantics changed next to the outbox field, M14 = vault crypto (payload format in `encryptPayload`) changed, M15 = the outbox not normalized on unlock).
- `verifyPhase123Catalog.mjs`:
  - new browser checks `checkCatalogFixedHeight` (D-123-2), `checkDialogBackdropRule` (D-123-3: drag from an input to the backdrop keeps add-site / catalog / edit-site and their values; the offer closes only on press + release; Escape) and `checkCustomCategoryRequired` (D-123-4);
  - `fillCustomSite` now picks a category;
  - new mutations M7–M13.
- **H-1 (all four Phase 123 verifies).** New `scripts/lib/withTimeout.mjs`:
  - (a) every `openPage` is paired with `closePage` / `context.close()` in a `finally`. Open contexts are tracked, and the group `finally` closes any a failing check left behind (the script prints how many);
  - (b) `closeServer(server, 5000)`: `server.close()` plus `closeAllConnections()`, bounded;
  - (c) `withTimeout(work, ms, label)` bounds every browser group (Catalog / AppContext 90 s), the CatalogGate pure load (60 s), every Sync scenario (30 s) and every mutation run (Catalog / AppContext 240 s, Sync 120 s, CatalogGate 90 s). A timeout FAILS the run through `failRun`: `FAIL — mutation timed out: <id> after <n>s` or `FAIL — check timed out: <group>`, then a bounded cleanup and exit 1. A timeout is never counted as caught.

### Superseded legacy assertions (updated with a comment naming the decision; nothing else weakened)
| Verify | Old assertion | Now | Decision |
|---|---|---|---|
| verifyPhase123AppContext `checkProtectedUnchanged` | `src/supabase/persistence.ts` byte-identical to HEAD | removed from the list; replaced by `checkPersistenceScope`: 9 named functions byte-identical (now including `removeUserServiceFromCloud`), crypto imports identical, no new RPC / service_role / schema text, the profile delete only adds `forgetProfile` after success | AD-123-18, amendment A |
| verifyPhase123AppContext `checkProtectedUnchanged` | `src/vault/crypto.ts`, `src/vault/vault.ts` byte-identical to HEAD | removed from the list; replaced by `checkVaultPayloadShapeOnly` (equal to HEAD once the `syncOutbox` lines are removed; field written + normalized) and mutations M13–M15 | amendment A ("payload gains one field") |
| verifyPhase123AppContext `checkNoNewWriteSites` | no new Supabase import in App / host; App `persistVault(` count ≤ HEAD | explicit allow-list: App `refreshWorkspaceFromCloud`, `setCloudGoneListener`, `setCloudConfirmedListener`, `fetchCloudSyncBaseline` (read-only), `clearSessionSyncScope`, `resetSessionSyncBaseline`, `resetSessionSyncBaselineFromCloud`; host `bumpDualWriteGeneration`; ≤ HEAD + 3 persist calls, and no new cloud-writing call (every added one is `skipCloudSync: true`) | AD-123-18, amendment A |
| verifyPhase123Catalog `checkProtectedUnchanged` | `src/vault/crypto.ts`, `src/vault/vault.ts` unchanged | removed from the list (covered by `verifyPhase123AppContext` `checkVaultPayloadShapeOnly`) | amendment A |
| verifyPhase123Catalog `checkAppWiring` | `addCustomService` identical to HEAD after the D-123-5 undo | the undo also maps the amendment A lines (`noteDeliberateAdd`, `recordLocalCreations`) back to HEAD | amendment A |
| verifyPhase123Catalog `checkAppWiring` | `addCustomService` / `updateCustomService` byte-identical to HEAD | identical after removing the timing lines and restoring the inline reload; the background reload runs the same 4 HEAD lines | D-123-5 |
| verifyPhase123Catalog `checkAppWiring` | no new `persistVault(` call site in App | no new cloud-writing call site | AD-123-18 |
| verifyPhase123Catalog `checkProtectedUnchanged` | `persistence.ts`, `AddSiteModal.tsx` unchanged | removed from the list (checked by the AD-123-18 scope check and the D-123-3 / D-123-4 browser checks) | AD-123-18, D-123-3 / D-123-4 (prompt: "AddSiteModal.tsx may change") |
| verifyPhase123Catalog `checkCatalogModalShell` | a backdrop click closes the catalog | a backdrop click keeps it; × closes | D-123-3 (the catalog contains the search form) |
| verifyPhase123Catalog `checkCustomAdd` | Escape with the add-site layer open keeps it open | Escape closes the add-site layer only; the catalog stays | D-123-3 (Escape still closes) |
| verifyPhase123Catalog `CATALOG_ALLOWED_IMPORTS` | — | `./dialogDismiss` allowed (UI hooks only) | D-123-3 |
| verifyPhase123Sync `checkWiring` (own verify, previous round) | login = `fetchCloudWorkspaceIds` keep-or-drop + `resetSessionSyncBaseline` + `writeAll` repair | login = `fetchCloudSyncBaseline` keep-or-drop + `resetSessionSyncBaselineFromCloud` + repair without `writeAll` + `[timing] login`; no pre-hydrate re-key write | Known Issue 5 (Architect early read) |
| verifyPhase123Sync `checkWiring` / M19 | vault maps `syncOutbox: state.syncOutbox ?? emptySyncOutbox()` | `syncOutbox: state.syncOutbox` (the default is applied on decode only) | amendment A (N-2 trim) |
| verifyPhase121DeleteService B1 / B2 / B5 | sync against an empty cloud with no session upserts the registry-present apps | each case puts the local rows in the outbox (`asOwnCreations`), so they are local creations and the D-121-51 filter is exercised as before; mutation C1 still caught | AD-123-18, amendment A |

### Amendment A
Replaces the earlier Known Issue 1 (legacy rows): **resolved by amendment A** (see Known Issues).

**N-2 exception: the outbox field only.** `git diff HEAD -- src/vault/crypto.ts src/vault/vault.ts` on the frozen tree, in full:

```diff
--- a/src/vault/crypto.ts
+++ b/src/vault/crypto.ts
@@ -3,6 +3,7 @@ import type { Credential } from '../credentials';
 import type { AccessProfile } from '../profile/accessProfileModel';
 import type { ServiceDefinition } from '../service/serviceModel';
 import { normalizeStoredCustomServices } from '../catalog/customServiceStorage';
+import { normalizeSyncOutbox, type SyncOutbox } from './syncOutbox';
@@ -16,6 +17,7 @@ export interface VaultPayload {
   accessProfiles: AccessProfile[];
   selectedIds: string[];
   customServices: ServiceDefinition[];
+  syncOutbox?: SyncOutbox;
 }
@@ -152,6 +154,7 @@ export function normalizePayload(
     accessProfiles: normalizeAccessProfiles(raw.accessProfiles),
     selectedIds: raw.selectedIds ?? [],
     customServices: normalizeStoredCustomServices(rawCustomServices),
+    syncOutbox: normalizeSyncOutbox(raw.syncOutbox),
   };
 }
--- a/src/vault/vault.ts
+++ b/src/vault/vault.ts
@@ -18,6 +18,7 @@ import {
 } from './crypto';
 import { getVault, putVault, vaultStorageIdForUser, type VaultRecord } from './db';
 import { migrateVaultPayload } from './vaultMigration';
+import type { SyncOutbox } from './syncOutbox';
@@ -40,6 +41,7 @@ export interface VaultState {
   accessProfiles: AccessProfile[];
   selectedIds: string[];
   customServices: ServiceDefinition[];
+  syncOutbox?: SyncOutbox;
 }
@@ -98,6 +100,7 @@ function payloadFromVaultState(state: VaultState): VaultPayload {
     accessProfiles: state.accessProfiles,
     selectedIds: state.selectedIds,
     customServices: state.customServices,
+    syncOutbox: state.syncOutbox,
   };
 }
```

- Field declaration (`VaultPayload`, `VaultState`), empty default on decode (`normalizePayload` → `normalizeSyncOutbox`: missing or malformed = empty), persist mapping (`payloadFromVaultState`), plus the two imports. Nothing else: `createEmptyPayload`, `emptyVaultState`, `encryptPayload` / `decryptPayload`, KDF, keys, `unlockVault`, `lockVault` and `persistVault` are byte-identical to HEAD.
- `unlockVault` is unchanged: decrypt → `normalizePayload` (adds the empty default) → `migrateVaultPayload` (spreads `...payload`, so the field is carried).
- Guarded by `verifyPhase123AppContext` `checkVaultPayloadShapeOnly`: exactly these 3 lines per file; removing them gives HEAD byte for byte. Mutations M13 (persistVault semantics changed next to the field), M14 (payload format in `encryptPayload` changed) and M15 (no decode default) are caught.

**Required checks** (each with a mutation that fails the verify; frozen-tree results in the T-1 table):

| Check | Where | Mutation(s) caught |
|---|---|---|
| An unsynced creation survives reload and is inserted later | Sync `checkNeverSyncedSurvivesReload` | M7, M8, M18, M19 |
| An unsynced creation survives lock-unlock and is inserted later (real `vault.ts` + `crypto.ts`) | Sync `checkOldVaultUnlocks` | M19 (static) |
| An offline creation is kept (failed sync, offline reload) | Sync `checkNeverSyncedSurvivesReload` | M7, M8, M9 |
| A legacy absent row is removed with its credentials (outbox vault and legacy vault) | Sync `checkDeletedElsewhereRemovedAtLogin` | M6 (keep-or-drop step); M5 (gone report) |
| An old vault (HEAD payload, no field) decodes and unlocks; a wrong password is still rejected (real argon2id + AES-GCM) | Sync `checkOldVaultUnlocks`, `checkOutboxHelpers` | M24; AppContext M15 |
| A failed insert keeps the id (also across a reload) | Sync `checkFailedInsertKeepsId`, `checkOutboxClearedOnlyOnConfirm` | M11, M30 |
| A confirmed insert removes it | Sync `checkOwnCreationsInserted`, `checkFailedInsertKeepsId`, `checkOutboxClearedOnlyOnConfirm` | M12, M22, M23 |
| A stale session B never inserts a row outside its own outbox; D-123-1 still reproduced under the pre-AD-123-18 mutation | Sync `checkStaleProfileNotRecreated`, `checkStaleAppNotRecreated` | M1 (reproduces D-123-1), M2, M3, M16, M17, M21 |

### Known Issue 5 — login repair writes only differing rows (Architect early read)
Inside the AD-123-18 exception: only `persistence.ts` (one new read-only function), `sessionSyncScope.ts` and the App login change. Auth, unlock, crypto, `persistVault`, RLS and the write helpers are untouched.

- **Before:** the login ran a pre-hydrate re-key sync of `loaded` (every credential re-encrypted with the cloud key), then a `writeAll` repair that wrote every profile row.
- **Now:**
  - `fetchCloudSyncBaseline(userId, cloudKey)` reads the cloud rows once: memberships, profiles (snapshot of serviceId / name / default / schema), and each credential decrypted with the **cloud key only**. Any error → `null`.
  - `resetSessionSyncBaselineFromCloud` makes that read the baseline. A local credential counts as "in the cloud" only if the cloud row decrypts with the cloud key to the same values. Otherwise it stays pending. So a legacy vault-key ciphertext is still re-keyed, and a credential missing in the cloud is uploaded.
  - The repair runs without `writeAll` and writes only rows that differ. Gone rows at login come from the hydrate read itself (keep-or-drop) and from update-only on rows absent from the cloud.
  - When the baseline read fails, the fallback is the previous behaviour (`resetSessionSyncBaseline` on the hydrated state), still without `writeAll`.
  - The separate pre-hydrate re-key call was removed; the re-key now happens in the one repair, only for credentials that need it.
- **Check:** `checkLoginWritesOnlyDiffs`:
  - an idle login writes `user_services=0, access_profiles=0, encrypted_credentials=0`;
  - a legacy vault-key credential plus a credential missing in the cloud → exactly 2 credential writes, 0 membership writes. Each credential write goes through the existing update-only profile path, so 2 same-value profile updates come with it;
  - the next login is idle again.
- **Mutations:** M25 (every credential treated as already in the cloud → re-key lost), M26 (empty login baseline → the idle login rewrites 4 profiles + 2 credentials), M27 (`writeAll` back in the login repair), M28 (baseline from the hydrated state), M29 (`[timing] login` not logged).
- **Dev-only timing:** `startSaveTiming('login')` → `console.info('[timing] login', { unlock, hydrate, cloudBaseline, persistLocal, repairSync, totalMs })`, only when `isDevBuild()`. No credential value is logged. Real-account numbers: not run — awaiting Owner.

### H-1
**(d) Bite proof.** A temporary never-resolving mutation (and, for Catalog, a browser group that opens a page and never resolves) was added to each script, run alone, and then removed. Last lines of each run:

| Script | Temporary fixture | Output | Exit |
|---|---|---|---|
| verifyPhase123Sync `--mutations=M99` | mutation run never resolves | `FAIL — mutation timed out: M99 after 120s (M99 TEMP bite proof — the mutation run never resolves)` | 1 |
| verifyPhase123CatalogGate `--mutations=M99` | mutation run never resolves | `FAIL — mutation timed out: M99 after 90s (M99 TEMP bite proof — the mutation run never resolves)` | 1 |
| verifyPhase123AppContext `--mutations=M99` | mutation run never resolves | `FAIL — mutation timed out: M99 after 240s (M99 TEMP bite proof — the mutation run never resolves)` | 1 |
| verifyPhase123Catalog `--mutations=M98` | first browser group opens a page, never resolves | `FAIL — check timed out: checkCatalogModalShell (M98 TEMP bite proof — a browser group never resolves)` | 1 |
| verifyPhase123Catalog `--mutations=M99` | mutation run never resolves | `FAIL — mutation timed out: M99 after 240s (M99 TEMP bite proof — the mutation run never resolves)` | 1 |

Two attempts did not reach the bite and are reported as observed:
- The first Catalog M98 run failed `fixture: every browser override loaded (0/1)`: the bundler counted the temporary `__biteGroupHang` flag as a file override. A temporary filter (also removed) let it through.
- The first Catalog M99 run failed in its clean pass with `page.waitForSelector: Timeout 10000ms exceeded` (waiting for `[data-service-tile]`). Four browser verifies were running in parallel at that time. Re-run alone, the clean pass passed and the bite failed as shown. Every later run, including the frozen-tree set, ran one verify at a time.

After removal, `rg "__bite|M98|M99|TEMP H-1" scripts` → no matches.

**(e) M9 stall cause.** Probable cause, not proven: I cannot re-run the old script, because its stall is what H-1 removes.
- Before H-1, a check that threw before `closePage` left its browser context open with a live page. Every caught browser mutation does exactly that. The H-1 bookkeeping now counts these: the M1–M13 run reports `H-1: 6 browser context(s) left open by a failing check were closed by the group finally`, and each M7–M9 run reports 3, one per caught mutation. In the old script they piled up in one browser for the whole run.
- The old static server closed with a plain `server.close()`, which on Node v22.12.0 waits for every open socket. A leaked page keeps its keep-alive socket, so that close could wait forever.
- With (a)–(c) the leaked contexts are closed in the group `finally`, the server close is bounded at 5 s, and any remaining hang is a bounded FAIL (bite proof above).

**Re-runs (frozen tree):**

| Command | Result | Time |
|---|---|---|
| `node scripts/verifyPhase123Catalog.mjs --mutations=M1,M2,M3,M4,M5,M6,M7,M8,M9,M10,M11,M12,M13` (one run) | `PASS — Phase 123.2 Catalog: 19 check groups, 13 selected mutations caught — 1m 50s` | 1m 52s |
| `--mutations=M7,M8,M9`, run 1 | `PASS — … 19 check groups, 3 selected mutations caught — 1m 10s` | 71s |
| `--mutations=M7,M8,M9`, run 2 | `PASS — … 19 check groups, 3 selected mutations caught — 1m 12s` | 73s |
| `--mutations=M7,M8,M9`, run 3 | `PASS — … 19 check groups, 3 selected mutations caught — 1m 08s` | 71s |

No stall. Each run includes the clean pass first.

### T-1 Results — Fix round D-123-1…5 (frozen tree `c06950a5…ff1c21`, 2026-10-04)
One sequential run of the whole set (`%TEMP%\pv-t1-freeze2.ps1`, one verify at a time), 18:08:07 → 18:21:29. The previous round's results are superseded by this run. Re-run because the completion round touched them: the Phase 123 verifies, the touched set and the admin set (a superset of the affected verifies).

**Slice verifies**
| Command | Result | Time |
|---|---|---|
| `node scripts/verifyPhase123Sync.mjs` (full sweep) | `PASS — Phase 123 sync: 14 check groups, 30 mutations caught — 4s` | 4.7s |
| `node scripts/verifyPhase123Sync.mjs --no-mutations` | `PASS — Phase 123 sync: 14 check groups, mutation sweep skipped (--no-mutations) — 2s` | 2.3s |
| `node scripts/verifyPhase123AppContext.mjs --no-mutations` | `PASS — Phase 123.1 App context: 23 check groups, mutation sweep skipped (--no-mutations) — 18s` | 19.1s |
| `node scripts/verifyPhase123AppContext.mjs --mutations=M3,M8,M10,M11,M12,M13,M14,M15` (M10–M15 + anchors in touched files) | `PASS — Phase 123.1 App context: 23 check groups, 8 selected mutations caught — 46s` | 47.2s |
| `node scripts/verifyPhase123Catalog.mjs --no-mutations` | `PASS — Phase 123.2 Catalog: 19 check groups, mutation sweep skipped (--no-mutations) — 21s` | 22.6s |
| `node scripts/verifyPhase123Catalog.mjs --mutations=M1,M2,M3,M4,M5,M6,M7,M8,M9,M10,M11,M12,M13` (one run) | `PASS — Phase 123.2 Catalog: 19 check groups, 13 selected mutations caught — 1m 40s` | 101.5s |

**Directly touched verifies** (shared by both submissions). Found with `rg -l` in `scripts/verify*.mjs` for every changed product file of the fix round and 123.2b (the dialogs, `Dashboard`, `ManageServices`, `App.tsx`, `App.css`, the login-assistance files, `profileManagement`, the `digitalHome` modules, `syncOutbox`, `cloudReconcile`, `vault/vault`, `vault/crypto`, `sessionSyncScope`, `persistence`, `catalogVisibility`, `addCustomServiceOutcome`, `userApproval`, `catalogGateSummary`). Retired scripts are excluded; the Phase 121 / 122 hits are in the admin set. Run plain, all exit 0:
- verifyPhase102CredentialSchema (0.2s), verifyPhase103Execution (0.1s), verifyPhase104ServiceManagement (0.4s)
- verifyPhase108AdapterRouting (0.2s), verifyPhase108BrowserIntegration (0.2s), verifyPhase108KnownServiceBootstrap (0.1s), verifyPhase108M1ExplicitLoginEntry (0.3s)
- verifyPhase109Accounts (0.3s), verifyPhase111Assets (0.1s), verifyPhase113LoginAssistance (0.1s)
- verifyPhase116CustomAddIdentity (1.2s), verifyPhase117ManagedAutofill (0.6s), verifyPhase120IdentityAuthoring (0.2s), verifyServiceSourceOwnership (0.2s)

**Admin verifies (N-1)** (shared). 43 Phase 121 / 122 scripts, run plain except `verifyPhase122AdminWorkspace --no-mutations`.
- **43 / 43 PASS (exit 0)**, including:
  - `verifyPhase121DeleteService` (`PASS — D-121-51 delete site: 4 check groups (SQL / client / dialog / Admin API), 43 mutations caught`, 37.3s);
  - `verifyPhase122AdminWorkspace --no-mutations` (`PASS — … 32 check groups, mutation sweep skipped (--no-mutations) — 2m 07s`);
  - `verifyPhase122AdminNotes` (37.9s), `verifyPhase122SubmitterProfiles` (33.3s);
  - the three R-123-1 scripts (IframeSurface 5.3s, InspectReadinessEligible 21.6s, PartialOcclusionPick 0.9s).

**Type check / build** (frozen tree, after the verify run, separate commands): `npx tsc -b` → exit 0 (16.4s). `npm run build` → exit 0 (`✓ built in 5.20s`; only the pre-existing chunk-size warning). Lints on the changed source and verify files: none.

**Scope** (frozen tree):
- `git diff --stat HEAD -- src/admin` → `src/admin/userApproval.ts | 46 ++--------------------------------------------` / `1 file changed, 2 insertions(+), 44 deletions(-)` (the 123.2b re-export only);
- `git status --porcelain -- extension package.json package-lock.json supabase` → empty, also after `npm run build`, which regenerates `extension/discovery/login-entry-discovery.js` byte-identically;
- fingerprint recomputed after tsc / build → unchanged.

**Not run, per T-1:** full mutation sweeps of the existing slice verifies (END OF ROUND), `runOfflineRegression`, live-only `verifyPhase101Supabase` / `verifyPhase102Registry`.

### Functional Testability
- **Automated:** the tables above.
- **Owner re-runs** (manager hand-off), **not run — awaiting Owner.** I have no usable account: the test-account password was exposed and is not reused.
  - 123.1 step 6 with two windows: delete a profile in window A, then save / return in window B → the profile stays deleted; B's open window closes with the notice.
  - 123.2 steps 5–6: catalog size, backdrop rule, required category, save time.
  - Completion round: log out and in again with nothing changed → the dev console shows one `[timing] login { unlock, hydrate, cloudBaseline, persistLocal, repairSync, totalMs }` line, and the network log shows no `access_profiles` / `user_services` / `encrypted_credentials` writes.

### Known Issues / Limitations (none BLOCKED)
Numbering as in the Architect's early read.
1. **Legacy local rows — resolved by amendment A.** A local row absent from the cloud and not in the outbox is removed locally with its credentials at login. Vaults saved before amendment A have no outbox, so their local-only rows follow this removal rule, as the amendment specifies. Only rows created after the upgrade survive an offline period. (Checks: "Amendment A" table.)
2. A credential deleted in another session is not re-uploaded by a stale session, but stays locally in that session until its profile is refreshed or dropped. Accepted (Architect).
3. An empty cloud membership blocks gone reporting, dropping and the refresh (D-109-25 spirit): a fully emptied account is not mirrored into a stale session or a login until it has at least one app again. Stays until 123.3 (Architect).
4. The "removed elsewhere" notice is shown on the Digital Home screen. On the «ניהול שירותים» screen the affected modal still closes, but no notice is shown. Accepted (Architect).
5. **Login time — addressed in the completion round.** The login repair now writes only rows that differ from the cloud as read (no `writeAll`); an idle login writes 0 rows. The baseline read is one extra read of the user's rows plus one cloud-key decrypt per credential. Implemented inside the AD-123-18 exception; see "Known Issue 5 — login repair". Real-account timing: not run — awaiting Owner (`[timing] login`).
6. The refresh runs at most once per 10 s on focus / visibility return; changes made elsewhere while this window keeps focus are seen on the next save (as gone) or the next return. Accepted (Architect).
7. The dropped-row guard is in memory. After a reload, a stale screen no longer exists, so there is nothing to guard; a row deleted elsewhere is removed again by the next login / re-hydrate.

### Documentation Update Evidence
- Updated: this file only (Status lines, this section, the "Slice 123.2b" section, the fingerprint section).
- No other docs needed: no setup step, command, environment variable, dependency or migration was added. `verifyPhase123Sync.mjs` and `verifyPhase123CatalogGate.mjs` are picked up by `scripts/runOfflineRegression.mjs` like the other verifies. The behaviour is specified in `arch-phase123.md` / `manager-phase123.md`, which the Developer does not edit.

### N-1…N-8 Compliance
- **N-1:** `src/admin` unchanged by the fix round (the only `src/admin` change is the 123.2b re-export).
- **N-2:** db, migration, registryPersistence, serviceSelection, execution and extension are unchanged. Exceptions, each as ruled and each checked:
  - `crypto.ts` / `vault.ts`: the amendment A outbox field only (3 lines each, quoted under "Amendment A");
  - `persistence.ts` / `sessionSyncScope.ts` / App login: the AD-123-18 sync change, including the Known Issue 5 login repair (one new read-only function, no new write helper, no RPC, no schema).
  - Auth, unlock, keys, KDF, `persistVault` semantics and user-table RLS are unchanged.
- **N-3 / AD-123-4:** no new write path from Digital Home components. Writes go only through the existing reducers, `persistVault` and the existing cloud functions; App's new persists are local-only reconcile commits.
- **N-4:** no browser dialogs.
- **N-5:** no site / hostname / serviceId branches.
- **N-6:** new copy is Hebrew, RTL.
- **N-7:** fail-closed on cloud errors (baseline read error → fallback baseline, nothing dropped; membership read error → nothing inserted, confirmed or reported gone).
- **N-8:** no admin imports.

### Scope Compliance
- Only the five listed items, amendment A, H-1 and the completion items (Known Issue 5, amendment A evidence) were changed.
- No PHASE, arch, manager or plan file was edited.
- No env file, secret or live DB was accessed. No credential value was logged or persisted by the timing code or the tests.

### Developer Declaration
Fix round D-123-1…5, with AD-123-18 amendment A, H-1 and the completion items (amendment A evidence, Known Issue 5), is implemented within the authorized scope. All results above are from the frozen tree `c06950a5…ff1c21`.
- `verifyPhase123Sync` passes with M1–M30 caught. It reproduces D-123-1 under M1 and covers every amendment A check (old vault unlocks with real argon2id + AES-GCM, lock-unlock, failed insert keeps its id) and the Known Issue 5 login repair (idle login = 0 row writes).
- `verifyPhase123AppContext` passes with M3, M8, M10–M15 caught; `verifyPhase123Catalog` passes with M1–M13 caught in one run (M7–M9 three times without a stall in the previous round, H-1).
- The crypto / vault diff is the outbox field only (quoted).
- H-1: every Phase 123 verify bounds its browser groups and mutation runs; the bite proofs FAIL with the timeout message (exit 1) and were removed.
- Every touched verify passes, and 43 / 43 admin verifies pass.
- `tsc` and `build` pass; `extension` is unchanged.
- Items for the Architect:
  - unchanged from the last round: the D-123-5 sync-cost saving was combined with AD-123-18;
  - new: the Known Issue 5 login repair is implemented inside the AD-123-18 exception. It adds one read-only `fetchCloudSyncBaseline` and removes the HEAD pre-hydrate re-key call; the re-key now happens in the one repair, for credentials that differ only.
- Real-account timing (custom-site and login) and the Owner re-runs: not run — awaiting Owner.

---

## Slice 123.2b — Catalog visibility gate

Normative: `arch-phase123.md` AD-123-19 and the 123.2b manager prompt. Submitted together with the fix round (B-1), on the same frozen tree, with separate results below.

### Implementation Summary
- **Shared helper.** `userApprovalState` (Phase 122.8 R3) moved unchanged to `src/service/userApproval.ts` (function, types and imports identical to the HEAD admin helper). `src/admin/userApproval.ts` keeps its Hebrew labels (`USER_APPROVAL_HE`) and re-exports `userApprovalState`, `UserApprovalRow` and `UserApprovalState` from the shared module. Nothing else under `src/admin` changed, and the user side imports nothing from `src/admin` (N-8).
- **Gate** (`src/catalog/catalogVisibility.ts`, pure):
  - `catalogGateState(entry)` returns `own_site` for a user's own site (`source === 'user-created'`, already limited to its owner by RLS); `no_stored_credentials` when the resolved global credential configuration says so explicitly; otherwise the user approval state (`approved` / `not_approved` / `blocked` / `no_mapping`);
  - `isListedInUserCatalog(entry)` is true only for `own_site`, `no_stored_credentials` and `approved`. A promotion alone (`approvalStatus`) does not publish, and `not_configured` is not treated as `no_stored_credentials`.
- **Catalog listing** (`AppCatalog`): `listed = services.filter((service) => isShownInUserCatalog(service, selectedIds.has(service.id)))`. Search and category filters work on `listed` only, so a hidden site is neither listed nor found.
- **AD-123-19 (a) — non-approved site already in the home** (`isShownInUserCatalog(entry, inHome) = inHome || isListedInUserCatalog(entry)`):
  - it stays in the catalog, marked by the existing FR-17 state: a disabled «✓ כבר בבית הדיגיטלי» and no «הוספה» action (`catalogItemState` → `added`);
  - it is decided on the current home (`selectedIds`, a memo dependency): once the app leaves the home it is no longer listed, also while the catalog is open.
- **AD-123-19 (b) — own sites:** the gate applies to global sites only. A user's own not-yet-promoted custom site (`source === 'user-created'` → `own_site`) is always listed for its owner, with no mapping needed.
  - Category: it is shown under the category stored on the site. «מותאם אישית» is the seeded `custom` registry category (`supabase/migrations/20260712170000_phase108_seed_custom_category.sql`) and appears as a catalog chip like any registry category.
  - Today the custom-site form lets the user choose the category (D-123-4). No code forces `custom`; the verify checks an own site stored with `custom` under the «מותאם אישית» chip.
- **Custom add** (`classifyAddCustomService`): «already in your home» is checked first for every global match. `catalog_service_available` is offered only when the match is listed; a hidden match falls through to the normal custom-create path.
- **Home not gated:** apps already in a home stay. App home tiles, `allServices`, the prune of inactive selections, Dashboard, ManageServices home, the panel, the loader, the mapper and execution do not use the gate (checked).
- **Dev evidence** (`src/dev/catalogGateSummary.ts`): on catalog load in a dev build only, `console.info('[catalog-gate]', { globalBefore, listedAfter, hiddenByState: { no_mapping: n, not_approved: n, blocked: n }, hidden: ['<name> (<state>)', …] })`. Site names, states and counts only, no user data. `not_configured` and a corrupt `no_stored_credentials` resolve to their approval state (usually `no_mapping`) and are counted there.

### Files Changed
- **Product (new):** `src/catalog/catalogVisibility.ts`, `src/service/userApproval.ts`, `src/dev/catalogGateSummary.ts`.
- **Product (modified):** `src/admin/userApproval.ts` (re-export only), `src/catalog/addCustomServiceOutcome.ts`, `src/digitalHome/AppCatalog.tsx` (listing via `isShownInUserCatalog`, completion round), `src/App.tsx` (the dev summary call only). Completion round: `src/catalog/catalogVisibility.ts` gains `isShownInUserCatalog`; `src/dev/catalogGateSummary.ts` gains `hiddenByState`.
- **Tests:** new `scripts/verifyPhase123CatalogGate.mjs`; modified `scripts/verifyPhase123Catalog.mjs`, `scripts/verifyPhase104ServiceManagement.mjs`, `scripts/verifyPhase116CustomAddIdentity.mjs`, `scripts/verifyPhase122AdminWorkspace.mjs`.
- **Dependencies:** none. No DB, RLS, migration or extension change.

### New verify — `scripts/verifyPhase123CatalogGate.mjs`
- Node bundle of the real gate, classifier and both `userApproval` modules; H-1 bounds (pure load 60 s, each mutation run 90 s).
- 8 groups: `checkGateStates`, `checkShownInCatalog` (completion round), `checkSharedHelper`, `checkClassifier` (behavior); `checkSharedLogicUnchanged`, `checkAdminReexportOnly`, `checkListingWiring`, `checkHomeNotGated` (static).
- Prompt checks → where:
  - each state listed / hidden, `no_stored_credentials` listed, promoted-without-approval hidden: `checkGateStates` (definitions and runtime Services);
  - classifier gated, a hidden site cannot be added through the offer: `checkClassifier`;
  - a hidden site cannot be added from the catalog: it is not rendered (`checkListingWiring`, Catalog browser group);
  - a de-approved home app stays: `checkHomeNotGated` + the Catalog browser group (tile + window kept);
  - (a) / (b): `checkShownInCatalog` + the Catalog browser group;
  - admin re-export byte identity: `checkAdminReexportOnly` (`USER_APPROVAL_HE` block byte-identical to HEAD, nothing but the re-export) and `checkSharedLogicUnchanged` (shared function, types and imports byte-identical to the HEAD admin body);
  - N-checks: `checkHomeNotGated`, `checkSharedLogicUnchanged` (N-8), `checkAdminReexportOnly` (N-1).
- Mutations M1–M20:
  - every non-listed state listed (M1–M4; M10 = `not_configured` listed); listed states hidden (M5 = `no_stored_credentials` hidden, M6);
  - own site gated (M7); promotion alone publishes (M8); the stored-schema status ignored (M9);
  - catalog or classifier ungated (M11, M12 = classifier ungated); the gate before «already in home» (M13);
  - admin logic changed instead of re-exported (M14); shared logic changed (M15);
  - de-approved home app removed (M16 = home tiles gated); the dev summary in production builds (M17);
  - completion round, AD-123-19 (a): M18 (a site in the home not shown), M19 (every site shown), M20 (the catalog ignores the home).
- `verifyPhase123Catalog` browser group `checkCatalogGateListing`:
  - hidden sites are not listed and not searchable; tiles and windows are kept;
  - completion round: (a) the two non-approved home apps are shown as «✓ כבר בבית הדיגיטלי» (disabled, no «הוספה»), and after `removeFromHome` (catalog open) the removed one is no longer listed; (b) the own site `svc-own-new` is listed and addable under the «מותאם אישית» chip (harness categories set through the real `setRuntimeCategoryCatalog`, incl. the seeded `custom`).
  - Mutations: M14 (lists every site), M15 (a promotion publishes), M16 (a non-approved home app not shown), M17 (shown decided on the home at catalog open → still listed after removal), M18 (own site gated).

### Superseded legacy assertions (updated with a comment naming the decision)
| Verify | Old assertion | Now | Decision |
|---|---|---|---|
| verifyPhase116CustomAddIdentity `def()` | catalog fixtures without credential metadata are offered | `def()` gives fixtures an explicit `credentialMode: 'no_stored_credentials'` (published), so the identity cases still exercise the offer; hidden sites are covered by verifyPhase123CatalogGate | AD-123-19 |
| verifyPhase104ServiceManagement classifier fixtures | same as above | same published default | AD-123-19 |
| verifyPhase123Catalog listing | the catalog lists every fixture service | it lists `LISTED` (approved / no_stored / own + apps in the home); the `HIDDEN` fixtures (not approved, not in the home) are absent | AD-123-19, AD-123-19 (a) |
| verifyPhase123Catalog `checkCatalogGateListing` (previous round) | the two non-approved home apps are not listed | they are shown as already added, no add action; they leave the list once removed from the home | AD-123-19 (a) |
| verifyPhase123Catalog `checkSearchAndCategories` | «בריאות» filter = `svc-clinic` | `svc-clinic, svc-c-nostored, svc-c-notconf` (the two home apps in that category are shown) | AD-123-19 (a) |
| verifyPhase123CatalogGate `checkListingWiring` | `services.filter(isListedInUserCatalog)` | `services.filter((service) => isShownInUserCatalog(service, selectedIds.has(service.id)))` with `selectedIds` as a dependency | AD-123-19 (a) |
| verifyPhase123Catalog `checkProtectedUnchanged` | `src/admin` diff empty | only `src/admin/userApproval.ts` may change (the re-export) | AD-123-19 |
| verifyPhase122AdminWorkspace R3, M57 / M58 | the helper logic is read from `src/admin/userApproval.ts` | admin must re-export the shared helper; the logic is read from, and M57 / M58 mutate, `src/service/userApproval.ts` | AD-123-19 |
| verifyPhase123CatalogGate `checkHomeNotGated` | App prune identical to HEAD | identical after mapping the amendment A `recordLocalCreations` line back to its HEAD form | amendment A (fix round) |

### Hidden-site count
- **Repository seed:** 13 built-in sites (`is_known_builtin_service_id`): hapoalim, leumi, discount, mizrahi, clalit, maccabi, meuhedet, leumit, shufersal, rami-levy, amazon-il, ksp, htzone. None has a mapping in the seed, so all 13 are `no_mapping` and hidden by the gate. Apps already in a user's home stay there.
- **Live registry: not run — awaiting Owner.** Live mappings, approvals and promotions differ from the seed, and I do not access the live DB.
  - Read-only count for the Owner: in a dev build the console prints, on catalog load, `[catalog-gate] { globalBefore, listedAfter, hiddenByState, hidden }`. `hiddenByState` is the per-state breakdown (`no_mapping` / `not_approved` / `blocked`). It reads the already-loaded catalog only and writes nothing.

### T-1 Results — Slice 123.2b (frozen tree `c06950a5…ff1c21`, 2026-10-04)
Same sequential run as the fix round (18:08:07 → 18:21:29).

| Command | Result | Time |
|---|---|---|
| `node scripts/verifyPhase123CatalogGate.mjs` (full sweep) | `PASS — Phase 123.2b catalog gate: 8 check groups, 20 mutations caught — 3s` | 3.3s |
| `node scripts/verifyPhase123CatalogGate.mjs --no-mutations` | `PASS — Phase 123.2b catalog gate: 8 check groups, mutations skipped (--no-mutations) — 1s` | 0.7s |
| `node scripts/verifyPhase123Catalog.mjs --mutations=M14,M15,M16,M17,M18` (gate + (a) / (b)) | `PASS — Phase 123.2 Catalog: 19 check groups, 5 selected mutations caught — 1m 00s` | 61.5s |
| `node scripts/verifyPhase123Catalog.mjs --no-mutations` (incl. the (a) / (b) browser checks) | `PASS — Phase 123.2 Catalog: 19 check groups, mutation sweep skipped (--no-mutations) — 21s` | 22.6s |

Touched verifies, the 43 admin verifies, `tsc`, `build`, lints and the scope checks (`git diff --stat HEAD -- src/admin` included) are shared with the fix round and ran once on the frozen tree: all pass (see "T-1 Results — Fix round D-123-1…5"). The touched set includes the three retargeted verifies (104, 116, 122AdminWorkspace). The 123.2b H-1 bite proof (CatalogGate M99) is in "H-1".

### Functional Testability
- **Automated:** the table above.
- **Owner visibility check**, **not run — awaiting Owner:**
  - in the catalog, an unapproved or unmapped global site that is not in the home is neither listed nor found by search;
  - an app already in the home stays on Digital Home and is shown in the catalog as «✓ כבר בבית הדיגיטלי» without «הוספה»; after removing it from the home it is no longer listed;
  - an own custom site is listed;
  - the dev console shows the `[catalog-gate]` counts with `hiddenByState`.

### Known Issues / Limitations (none BLOCKED)
1. With the seed alone, the catalog lists no built-in site until an admin approves a mapping or sets `no_stored_credentials`. This is the AD-123-19 rule; the live effect depends on the live registry (count above).
2. A hidden site the user types by URL is not offered from the catalog; the add continues on the normal custom-create path (AD-123-19: listing / offers only).
3. AD-123-19 (b): an own custom site appears under the category stored on it. Only sites stored with `custom` appear under «מותאם אישית»; the form does not force that category today (D-123-4 lets the user choose). Reported, not changed: forcing it would change the D-123-4 form, which is outside this slice.

### Documentation Update Evidence
- Updated: this file only (this section, Status lines, the fingerprint section).
- No other docs needed: no setup step, command, environment variable, dependency or migration was added; `verifyPhase123CatalogGate.mjs` is picked up by `scripts/runOfflineRegression.mjs`. The behaviour is specified in `arch-phase123.md` (AD-123-19 + addendum), which the Developer does not edit.

### N-1…N-8 Compliance
- **N-1:** under `src/admin` only `userApproval.ts` changed: a re-export of the shared `userApprovalState` and its types. `USER_APPROVAL_HE` is byte-identical to HEAD, and the shared body is byte-identical to the HEAD admin body (both checked; M14 / M15 caught). `git diff --stat HEAD -- src/admin` is in the T-1 table. The 43 admin verifies pass.
- **N-2:** no change to auth / unlock / crypto / `persistVault` / sync / user-table RLS by 123.2b. No migration, registry loader, mapper or execution change (checked).
- **N-3 / AD-123-4:** the gate is a client-side filter of the listing and the offer only; no write path. Adds still go through `onAddApp` / `onAddCustom`.
- **N-4:** no browser dialogs.
- **N-5:** no site / hostname / serviceId branches: the gate reads source, metadata and login fields only.
- **N-6:** Hebrew RTL; (a) reuses the existing «✓ כבר בבית הדיגיטלי» label.
- **N-7:** fail-closed: an unknown or unreadable approval state hides the site; apps already in the home are never removed.
- **N-8:** the user side imports nothing from `src/admin` (checked).

### Scope Compliance
- Only AD-123-19 and its addendum (a) / (b). The admin change is the ruled re-export only.
- Home apps are never removed. Dashboard, ManageServices home, the panel, the loader, the mapper and execution are not gated.
- No PHASE, arch, manager or plan file was edited. No env file, secret or live DB was accessed.

### Developer Declaration
Slice 123.2b, with the AD-123-19 addendum (a) and (b), is implemented within the authorized scope, on the frozen tree:
- the `src/admin` change is limited to the re-export;
- `verifyPhase123CatalogGate` passes with M1–M20 caught;
- `verifyPhase123Catalog` passes with M14–M18 caught;
- every touched verify and 43 / 43 admin verifies pass;
- `tsc` and `build` pass.

The live hidden count and the Owner visibility check: not run — awaiting Owner.

---

## Frozen-tree fingerprint
- **Value:** `sha256=c06950a50486cfef9fcfd041622aebbd3e5dfaa7a3d85e99038d9dff93ff1c21` (`diff_bytes=229284 tracked_changed=30 untracked_in_scope=19`).
- **Command:** `node "$env:TEMP\pv-fingerprint.mjs" C:\password-vault`. The script is a read-only helper outside the repo. It computes SHA-256 over:
  1. the bytes of `git diff HEAD --binary` (all tracked changes);
  2. then, for every file from `git ls-files --others --exclude-standard -z -- src scripts supabase` sorted by path: `<path>\0`, the file bytes, `\0`.
- **Scope note:** `git diff HEAD` also covers the tracked `team-yuri/PLAN.md` / `arch-phase123.md` changes, which I did not make. An edit to them by the Manager or Architect changes the value without any code change. This file (`team-Yuri/dev-phase123.md`) is untracked and outside `src` / `scripts` / `supabase`, so it is not part of the value.
- **Timeline:**
  - computed at the freeze;
  - the T-1 run (18:08 → 18:21);
  - `npx tsc -b`, `npm run build`;
  - recomputed → same value.
  - No source, test or config file was edited after the freeze. Only this file was edited afterwards.
- An earlier freeze (`72fdd69c…`) was abandoned before its run finished: I added the keep-or-drop assertion to `checkDeletedElsewhereRemovedAtLogin` so that M6 is caught by the login check itself. Its partial results are not used.

Stopping for Manager review → Architect review (fix round and 123.2b together).

---

## Recovery 2026-10-04

At 2026-10-04 21:07:21 the files of the frozen tree `c06950a5…ff1c21` were truncated (0 or 2 bytes) or rewritten. `src/App.tsx` was later reset to HEAD by an inline Undo. The Architect approved this recovery plan. No feature work was done; no code was re-implemented.

### Source
- **Cursor's local agent data**, read-only, on a copy (`%TEMP%\pv-recovery`). The Owner authorized this for this recovery only.
  - Each agent edit records `afterContentId = composer.content.<sha256>`, a full snapshot of the file after that edit.
  - For every affected file I took the snapshot of the last edit in this chat. The SHA-256 of each blob matched its key.
  - The last `src/` / `scripts/` edit was before the final freeze; after it, only this file was edited.
- **Sources that could not be used:**
  - Cursor local History: newest entry 2026-09-15.
  - Chat checkpoints: they do not cover the Phase 123 files.
- **Line endings:**
  - Tracked files: as at the freeze, taken from git's LF→CRLF warnings at the first freeze (18 LF, 10 CRLF).
  - Untracked files: CRLF (proved by the fingerprint below).
- **Proof:** a scratch tree (outside the repo; separate work tree and a copied index) with the recovered files and the frozen versions of `team-yuri/PLAN.md` / `arch-phase123.md` reproduced the original value exactly: `sha256=c06950a50486cfef9fcfd041622aebbd3e5dfaa7a3d85e99038d9dff93ff1c21` (`diff_bytes=229284 tracked_changed=30 untracked_in_scope=19`). Those frozen team-doc versions also came from the agent data; they were used only in the scratch tree.

### Files (49; all found)
"same" = the file kept its content at 21:07 and was already byte-identical, so nothing was written.

| File | Bytes | Before |
|---|---|---|
| scripts/lib/withTimeout.mjs | 1816 | 2 |
| scripts/verifyPhase102CredentialSchema.mjs | 19922 | 0 |
| scripts/verifyPhase104ServiceManagement.mjs | 23237 | 0 |
| scripts/verifyPhase109Accounts.mjs | 19129 | same |
| scripts/verifyPhase113LoginAssistance.mjs | 24978 | 0 |
| scripts/verifyPhase116CustomAddIdentity.mjs | 14624 | 0 |
| scripts/verifyPhase121DeleteService.mjs | 61915 | 0 |
| scripts/verifyPhase121IframeSurface.mjs | 85664 | 0 |
| scripts/verifyPhase121InspectReadinessEligible.mjs | 22408 | 0 |
| scripts/verifyPhase121PartialOcclusionPick.mjs | 19327 | 0 |
| scripts/verifyPhase122AdminWorkspace.mjs | 189421 | 0 |
| scripts/verifyPhase123AppContext.mjs | 71654 | same |
| scripts/verifyPhase123Catalog.mjs | 84337 | 2 |
| scripts/verifyPhase123CatalogGate.mjs | 28566 | same |
| scripts/verifyPhase123Sync.mjs | 69748 | 2 |
| src/AddSiteModal.tsx | 8055 | same |
| src/App.css | 53987 | 0 |
| src/App.tsx | 43151 | 33736 (HEAD) |
| src/CredentialModal.tsx | 6457 | 0 |
| src/Dashboard.tsx | 10609 | 0 |
| src/ManageServices.tsx | 16203 | same |
| src/ServiceProfileManagementModal.tsx | 34661 | same |
| src/admin/userApproval.ts | 427 | 0 |
| src/catalog/addCustomServiceOutcome.ts | 3200 | 0 |
| src/catalog/catalogVisibility.ts | 2065 | 2 |
| src/dev/catalogGateSummary.ts | 1136 | 2 |
| src/dev/saveTiming.ts | 736 | 2 |
| src/digitalHome/AppCatalog.tsx | 15375 | same |
| src/digitalHome/AppCatalogModal.tsx | 3530 | 2 |
| src/digitalHome/EditSiteDetailsModal.tsx | 2249 | 2 |
| src/digitalHome/appContext.ts | 3798 | 2 |
| src/digitalHome/cloudReconcile.ts | 5771 | 2 |
| src/digitalHome/customSiteForm.ts | 752 | same |
| src/digitalHome/dialogDismiss.ts | 1781 | same |
| src/loginAssistance/DigitalHomeCredentialModal.tsx | 5661 | 0 |
| src/loginAssistance/LoginAssistancePanel.tsx | 17953 | same |
| src/loginAssistance/credentialsGate.ts | 3317 | 0 |
| src/loginAssistance/messages.ts | 3436 | 0 |
| src/profile/ProfileChooserModal.tsx | 2527 | same |
| src/service/userApproval.ts | 2327 | 2 |
| src/supabase/persistence.ts | 34883 | same |
| src/supabase/sessionSyncScope.ts | 6356 | same |
| src/vault/crypto.ts | 6888 | 0 |
| src/vault/profileManagement.ts | 8815 | same |
| src/vault/syncOutbox.ts | 6278 | same |
| src/vault/vault.ts | 6082 | 0 |
| %TEMP%\pv-fingerprint.mjs | 1117 | 2 |
| %TEMP%\pv-t1-freeze.ps1 | 2494 | 2 |
| %TEMP%\pv-t1-freeze2.ps1 | 2626 | 2 |

- `src/digitalHome/catalogModel.ts` (part of the frozen tree) was not touched at 21:07 (last written 08:34); no recovery was needed.
- **Write and backup:** 34 files written, 15 already identical, 0 hash mismatches after writing. A backup of the 49 files is in `%TEMP%\pv-recovery-files-backup` (kept until the Architect accepts).

### New fingerprint (excluding team docs)
- **Command:** `node "$env:TEMP\pv-fingerprint-noteam.mjs" C:\password-vault`. This is the same formula as `pv-fingerprint.mjs`, limited to `-- src scripts supabase`:
  - the bytes of `git diff HEAD --binary -- src scripts supabase`;
  - then every untracked file under those paths, sorted (`<path>\0`, bytes, `\0`).
- **Value:** `sha256=8cf4427a35707527f41161aae489ec2c02b7a0ec36e4b76bced6145947251ef1` (`diff_bytes=155189 tracked_changed=28 untracked_in_scope=19`).
  - Computed right after the restore and again after the T-1 run, `tsc` and `build`: identical. No file changed in between.
  - Measured against HEAD `909cc8b`, before the WIP commit below. After the commit the same command measures against the new HEAD and no longer gives this value.
- For reference, the original formula (`pv-fingerprint.mjs`, with the current team docs) now gives `4c216dda…0e216` (`diff_bytes=237050`). It differs from `c06950a5` only because `team-yuri/PLAN.md` / `arch-phase123.md` changed after the freeze.

### Diff checks
- `git diff HEAD -- src/vault/crypto.ts src/vault/vault.ts` gives exactly the 3 + 3 added lines quoted in Amendment A (blobs `f87f6bf..cd05aa9`, `9c5f4fd..2f24646`).
- `git diff --stat HEAD -- src/admin` gives `src/admin/userApproval.ts | 46 ++------…`, 1 file, 2 insertions(+), 44 deletions(-) (the re-export only).

### T-1 re-run (restored tree, 2026-10-04 22:58 → 23:08; `%TEMP%\pv-t1-recovery.ps1`, results in `%TEMP%\pv-t1-recovery-results.txt`)

| Run | Result | Recorded |
|---|---|---|
| `verifyPhase123Sync` (full) | PASS: 14 check groups, 30 mutations caught | same |
| `verifyPhase123CatalogGate` (full) | PASS: 8 check groups, 20 mutations caught | same |
| `verifyPhase123AppContext --mutations=M3,M8,M10,M11,M12,M13,M14,M15` | PASS: 23 check groups, 8 caught | same |
| `verifyPhase123Catalog --mutations=M1,…,M18` (one run) | PASS: 19 check groups, 18 caught | 13 + 5 caught (two runs) |
| 14 touched verifies | 14/14 PASS (exit 0) | same |
| 43 admin verifies (`verifyPhase12[12]*`, AdminWorkspace `--no-mutations`) | 43/43 PASS. DeleteService: 4 groups, 43 mutations. AdminWorkspace: 32 groups | same |
| `npx tsc -b` | exit 0 | same |
| `npm run build` | exit 0 (existing chunk-size warning) | same |

The build left `extension/`, `package*.json` and `supabase/` unchanged.

### WIP commit (Owner decision 2026-10-04)
- **Branch:** `wip/phase123-recovered`, created from HEAD `909cc8b` with the working tree kept.
- **Commit:** `af881f6b6d891894f4109aea3bf3f27bdd670b19`, "WIP Phase 123: joint resubmission frozen tree (recovered 2026-10-04), not reviewed for merge". 51 files: 28 modified + 19 new under `src/` / `scripts/`, plus 4 team docs.
- **No** push, merge, amend or `--no-verify`. No `node_modules/.tmp`, `%TEMP%` or env / secret files.
- **Case paths:**
  - All 98 tracked team files are recorded as `team-yuri/` (`core.ignorecase=true`); the folder on disk is `team-Yuri`.
  - A dry run showed git would record the two new docs as `team-Yuri/…`, a second casing. I reported this.
  - The Owner chose lowercase. They are committed as `team-yuri/dev-phase123.md` and `team-yuri/manager-phase123.md`. The commit has 0 `team-Yuri/` paths.
- **After the commit:**
  - `git status --short` was clean.
  - All 49 recovered files were still byte-identical to the backup.
- This section was written after the commit, so `team-yuri/dev-phase123.md` now shows as modified.

### What truncated the files
Probable cause: Cursor itself, after a hang and restart. It is not proven, and no agent command was involved.
- **Before the restart** (previous log session):
  - at 21:06:40 the agent window was blocked for ~15.6 s;
  - the extension hosts then exited.
- **Restart:** Cursor started a new session at 21:06:55.
- **The writes:** all between 21:07:21.46 and 21:07:21.98, during startup of this workspace's window. No tool call of mine was running then; my last one was hours earlier.
- **Pattern:**
  - Only files edited by this chat were affected, including the `%TEMP%` helpers. `catalogModel.ts` and other files were untouched.
  - Each file kept its line endings: LF files became 0 bytes, CRLF files 2 bytes, and 15 were rewritten with unchanged content.
  - This fits Cursor restoring its saved state of this chat's pending agent changes, with part of the content loading empty.
- The logs do not name the writer.

### Pending
- `%TEMP%\pv-recovery` (database copy, ~8.7 GB) will be deleted only after the Architect accepts.
- `%TEMP%\pv-recovery-files-backup` is kept until then.

Stopping for Manager + Architect check of the recovery.

---

## Fix round D-123-6…8 (2026-10-05)

Detected phase: 123
Selected state: Fix round D-123-6…8 — CONTINUATION: D-123-8 implementation (Architect "D-123-8 rulings after Step 1 (2026-10-05)" items 1–5 + additions; Manager "D-123-8 implementation")
Status: COMPLETE — D-123-8 implemented within the approved N-2 exception. One clean sequential T-1 run (68 jobs, all exit 0), `tsc` and build PASS on frozen tree `1de67427…e387` (identical before and after). D-123-6 / D-123-7 unchanged since their acceptance. Owner re-check: awaiting Owner. 123.3 not open.

### Baseline and frozen tree
- Branch `wip/phase123-recovered`, HEAD `af881f6b`. No push, merge, amend, checkout, reset, stash or `--no-verify`.
- **Fingerprint for D-123-8** (Architect 2026-10-05; `%TEMP%\pv-fingerprint-d8.mjs`, read-only helper outside the repo): SHA-256 over `git diff af881f6b --binary -- src scripts supabase`, then every untracked, non-ignored file under those paths (sorted; `<path>\0`, bytes, `\0`). Team docs are outside the scope, so the `team-Yuri` / `team-yuri` casing cannot affect the value.
  - Frozen tree: `sha256=1de67427489e2d49eb5d6a8ff377c2ab17572e420e316d8a738bd4b6af49e387` (`diff_bytes=29186 tracked_changed=12 untracked=3`).
  - Taken at 08:58:50 (immediately before T-1) and at 09:13:48 (after T-1, `tsc` and build): identical.
- Earlier, for D-123-6 / D-123-7 only (old helper `%TEMP%\pv-fingerprint-af881.mjs`, scope `-- . ':(exclude,icase)team-yuri'`): `7c63e915…503a`. Its T-1 ran twice concurrently and is superseded by the single run below.

### Files changed (vs `af881f6b`)
| File | Item |
|---|---|
| `src/admin/ApprovalQueue.tsx` | D-123-6: one copy line |
| `src/catalog/customService.ts` | D-123-7: `www.` completion and the `isLikelyApexHostname` helper removed; doc comment |
| `src/digitalHome/ownSiteDefinition.ts` (new) | D-123-8: `isApprovedForUsers`, `resolveOwnSiteDefinition`, `hiddenCredentialFieldIds` (read-only helpers) |
| `src/supabase/persistence.ts` | D-123-8 (N-2 exception): one import + the own-site merge block in `hydrateWorkspaceFromCloud` (full diff below) |
| `src/App.tsx` | D-123-8: `mergeCustomDefinitions` → one resolved definition per own site; own ids left out of the builtin list; `approvedOwnSiteIds` to Dashboard |
| `src/Dashboard.tsx` | D-123-8: `approvedOwnSiteIds` prop → `ownSiteApproved` for the open window |
| `src/loginAssistance/LoginAssistancePanel.tsx` | D-123-8: notice + «עריכת פרופיל»; the bar's edit button is hidden while the notice shows; notice in the position-effect deps |
| `src/loginAssistance/messages.ts` | D-123-8: `MSG_LOGIN_FIELDS_UPDATED` |
| `src/App.css` | D-123-8: `.la-fields-updated` layout |
| `scripts/verifyPhase123FixD6D8.mjs` (new) | D-123-6 / D-123-7 bounded verify + 9 mutations |
| `scripts/verifyPhase123D8OwnSite.mjs` (new) | D-123-8 bounded verify: 9 groups + 17 mutations |
| `scripts/verifyPhase116CustomAddIdentity.mjs` | D-123-7: new group R12 (www / non-www through the real validator + classifier) |
| `scripts/verifyPhase123AppContext.mjs` | verify baseline `HEAD` → `909cc8b`; N-1 allows the D-123-6 line; D-123-8: hydrate pin = BASE apart from the own-site block |
| `scripts/verifyPhase123Catalog.mjs`, `verifyPhase123CatalogGate.mjs` | verify baseline `HEAD` → `909cc8b`; N-1 allows the D-123-6 line |

Dependencies: none added (`package.json` / `package-lock.json` unchanged). Docs: this section and one Status line at the top of this file.

### D-123-6 — approve success copy
Admin-exception diff (`git diff -U0 af881f6b -- src/admin`, the whole admin diff):
```
@@ -189 +189 @@ export default function ApprovalQueue() {
-      setSuccess(`אושר כאתר גלובלי (${globalId}).`);
+      setSuccess(`"${selected.display_name}" אושר כאתר גלובלי.`);
```
- `selected` is the submission row the component already holds. No logic, query or state change; `globalId` is still used for `updateGlobalRegistryRow`.
- **Static check** (`verifyPhase123FixD6D8`):
  - exactly one success line, equal to the new copy, with no `globalId` / `.id` / `owner_user_id`;
  - `src/admin` differs from `af881f6b` only in `ApprovalQueue.tsx`, by this one line (1−/1+).
  - Mutations M8 (id back) and M9 (id appended to the name) are caught.

**Superseded assertions:** none needed for the copy itself. No verify asserted «אושר כאתר גלובלי» (search over the whole repo: matches only in the source and team docs). The scope assertions that D-123-6 supersedes are listed under "Verify baseline" below.

**Other admin-visible messages that print an internal id (reported, not changed):**
| File:line | Shown |
|---|---|
| `ApprovalQueue.tsx:339–343` | input «מזהה גלובלי (אופציונלי)», `placeholder={row.id}` (submission id `custom-…`) |
| `ApprovalQueue.tsx:413–414` | «מזהה» → `selected.id` |
| `ApprovalQueue.tsx:421–422` | «owner_user_id» → `selected.owner_user_id` (uuid) |
| `RegistryAdmin.tsx:1306–1307` | «מזהה גלובלי» → `selectedRow.id` (under «פרטים נוספים») |
| `IntegrationStatusPanel.tsx:34–35` | «מזהה אתר» → `row.id` |
| `CategoriesAdmin.tsx:123` | success `הקטגוריה נוצרה (קוד: ${id}).` |
| `CategoriesAdmin.tsx:315` | «קוד מערכת:» chip → `category.id` |
| `specialApproveReadback.ts:50` | `writer=${writerUserId.slice(0, 8)}` in the reason shown under «פרטים טכניים» (`SpecialLoginDraftEditor.tsx:619`) |
| `SpecialTestResultView.tsx:57` | `צילום ${outcome.snapshotId}` |
| `adminRegistryApi.ts:119` | `${fallback} (${message})`: raw DB error text, may contain ids |

Borderline (login field ids, not site / user ids): `<code>{field.id}</code>` in `AdminFillTestGrid.tsx:366` and `AutofillProfileEditor.tsx:663`.

### D-123-7 — scheme-only URL completion
- `validateCustomPrimaryUrl` now only completes the scheme: none → `https://`, `http://` → `https://`. It never adds `www.`; host, path and query stay as typed.
  - `new URL(...).href` still lowercases the host and turns an empty path into `/` (unchanged behaviour).
- **Create and edit** both use it: `AddSiteModal.normalizeUrlField` on blur and on submit → `buildCustomSiteDefinition` → `createCustomServiceDefinition`. Edit opens on the stored `service.url` and saves the typed value. Stored URLs are not migrated.
- **Identity:** no change needed. `serviceUrlIdentityKey` already ignores `www.`. `verifyPhase116CustomAddIdentity` R12 shows it through the real validator and classifier:
  ```
  R12 PASS: typed shop.example → https://shop.example/ vs https://www.shop.example/ [offer] → catalog_service_available
  R12 PASS: typed shop.example → https://shop.example/ vs https://www.shop.example/ [home] → already_in_user_home
  R12 PASS: typed www.shop2.example → https://www.shop2.example/ vs https://shop2.example/ [offer] → catalog_service_available
  R12 PASS: typed www.shop2.example → https://www.shop2.example/ vs https://shop2.example/ [home] → already_in_user_home
  R12 PASS: typed mine.example → https://mine.example/ vs own https://www.mine.example/ → same_user_custom_duplicate
  verifyPhase116CustomAddIdentity: PASS (S0–S4 static + R1–R12)
  ```
- No verify asserted the old `www.` behaviour (104 / 108 M1 / 113 / 116 pass without changes to their assertions).
- **`verifyPhase123FixD6D8` groups:**
  - 10 URL cases, including `wolt.com/he/discovery` → `https://wolt.com/he/discovery`, existing `www.` kept, path / query / fragment kept, `http` → `https`; each is stable on re-validation (blur, then submit). 4 invalid cases.
  - Create stores the typed URL (`url`, `faviconSiteUrl`, same-as-website `loginUrl`). Edit stores the typed URL and keeps the id. An edit round-trip of a stored `www.` URL or a path URL leaves it unchanged.
  - www ⇄ non-www identity: catalog offer, «already in home», same-user duplicate.
  - Static: no `www` in the validator code, create / edit wired through it, no site / hostname / id branches.
  - Mutations M1–M7, all caught: `www.` re-added, path / query dropped, query dropped, `www.` stripped, `http` kept, edit overwrites the typed URL with the stored one, identity broken.

```
PASS — Phase 123 fix round D-123-6…8: 6 check groups, 9 mutations caught — 2s
```

### Verify baseline (three Phase 123 verifies)
On the first freeze, `verifyPhase123AppContext`, `verifyPhase123Catalog` and `verifyPhase123CatalogGate` failed:
- «crypto.ts differs from HEAD by more than the outbox field»;
- «addCustomService unchanged vs HEAD apart from timing…»;
- «fixture: HEAD admin helper found».

**Cause:** these verifies compare against `HEAD`, meaning the pre-Phase-123 tree. Since the WIP commit, HEAD is `af881f6b`, which already contains the Phase 123 edits to `App.tsx`, `crypto.ts` and `userApproval.ts`. None of the failing checks look at a file this round touched.

**Fix (test-only):**
- A constant `BASE = 909cc8b…` (the Phase 122 commit, parent of `af881f6b`) replaces `HEAD` in `git show` / `git diff`. This keeps their original meaning.
- The N-1 `src/admin` scope assertions now also allow `src/admin/ApprovalQueue.tsx`, with a comment naming D-123-6. The line's content is checked by `verifyPhase123FixD6D8`.

| Superseded assertion (D-123-6) | Was | Now |
|---|---|---|
| `verifyPhase123AppContext` N-1 | `src/admin` diff = `userApproval.ts` only | + `ApprovalQueue.tsx` |
| `verifyPhase123Catalog` N-1 | same | same |
| `verifyPhase123CatalogGate` `checkAdminReexportOnly` | ≤ 1 file, `userApproval.ts` | ≤ 2 files, + `ApprovalQueue.tsx` |

### D-123-8 Step 1 (read-only; no code change)

**Method:**
- Read the code paths listed below.
- Ran a scratch probe (`%TEMP%\pv-d8-step1\probe.mjs`) that bundles the real `registryMapper`, `definitionToLegacyService`, `credentialsGate`, `userApproval` and `catalogVisibility`. It uses placeholder values; output is field ids, kinds and key names only.
- **Live reproduction: not done.** I cannot sign in as the Owner (the exposed password must not be reused), and DB access would need env / secrets, which stay off-limits. The Owner can reproduce through the app UI.

**1. Where the definition switches from the user's copy to the admin-changed registry entry.** There are three paths, all in user-side code that already exists.
- **(i) Catalog merge** (`App.tsx` `mergeCustomDefinitions`, lines 141–173; used at 313–319). For an own row (`source_type='user'`, mapped `user-created`) the code builds `{...registry, ...vault, loginFields: vault ?? registry, metadata: {...registry, ...vault}}`.
  - Name, URL and category: the vault value wins.
  - Login fields: the registry value wins, because the vault copy has none (`createCustomServiceDefinition` never sets `loginFields`).
  - Admin metadata keys (`credentialMode`, `autofillProfile`, …) are not in the vault copy, so the registry values apply.
- **(ii) Hydrate overwrites the vault copy** (`persistence.ts` `hydrateWorkspaceFromCloud`, lines 983–995). Each owned registry row replaces the vault `customServices` entry wholesale (`customById.set(definition.id, registryRowToServiceDefinition(row))`). The result is persisted to IndexedDB on every unlock (`App.tsx:777`, `persistVault(hydrated, { skipCloudSync: true })`).
  - So after the next unlock, admin rename / category / URL / login fields / mapping changes **are** the vault copy.
  - The user's own definition is not kept anywhere.
- **(iii) Promotion.** The default `promote_user_submission` converts the row in place: same id, `owner_user_id=null`, `built_in`. The row becomes a global, the hydrate query (`source_type='user'`) stops returning it, and the vault copy stays as it was.
  - `dedupeServicesByPrimaryUrl` (`App.tsx:192–229`) keeps the catalog / global row over the user-created copy (same id, both selected).
  - So the global definition applies whatever its approval state.
  - With an alternate global id, the user's own row stays (stamped `approvalStatus: approved`, `promotedGlobalId`), and nothing changes for the user.

Probe output (stored keys = `username`, `password`, as saved before mapping):

| Case | Approval | Effective fields | Launch kind | Hidden keys |
|---|---|---|---|---|
| Vault copy only | — (own site) | `username,password` | credentials | — |
| Own row, admin fields, no mapping | `no_mapping` | `idNumber,password` | credentials | `username` |
| Own row, admin fields + mapping | `not_approved` | `idNumber,password` | credentials | `username` |
| Own row, admin fields + validated | `approved` | `idNumber,password` | credentials | `username` |
| Promoted in place, no fields | `no_mapping` | none (admin name) | not-configured | `username,password` |
| Promoted in place, fields, not validated | `not_approved` | `idNumber,password` (admin name) | credentials | `username` |

Admin fields reach the owner before approval, which is the Owner's report. After hydrate, the name / category / URL become the admin's as well.

**2. Does the vault copy hold everything the window needs?**
- *As created* it holds name, URL, category, `loginUrl` / `loginEntryType` (explicit login entry) and `faviconSiteUrl`.
- It holds no `loginFields`. `resolveCredentialEntry` renders `CUSTOM_DEFAULT_LOGIN_FIELDS` (`username`, `password`) for `user-created`, which is what the user saved against. The launch kind for `user-created` is always a form (`credentials` / `missing-user-credentials`).
- **But** (ii) replaces the copy with the registry row on every unlock. Once an admin has changed the own row, the user's original definition is gone from the vault. Restoring "the site as the user created it" therefore needs hydrate to stop overwriting, or a separate user copy. Both are `persistence.ts` / hydrate changes.

**3. Are values dropped or only hidden?** Only hidden on load / hydrate / sync / prune:
- Credentials are stored per profile as whole objects (`Record<fieldId, string>`). Hydrate, the outbox and the profile scope keep or drop whole profiles, never individual field keys.
- `vaultMigration` moves legacy service-id keys to profile ids without touching field keys.
- The App prune spares vault `customServices` ids.
- `serviceHasUsableCredentials` / `hasCompleteCredentials` read only the current field ids, so other keys become invisible.

**4. Does the profile-modal save drop values under missing ids?**
- Yes, on the user's own save only. `ServiceProfileManagementModal.handleSaveCredentials` → `serializeCredentialValues(loginFields, values)` writes only the current field ids. `saveCredentialForProfile` then replaces the profile's credential object.
- This matches the rule ("kept until the user saves that profile").

**5. Notice scope.** Credential objects contain only field-id keys, so a generic "stored keys not among the current field ids" test would raise the notice on a global / built-in site when:
- (a) values were saved under the custom-default `username` / `password` and the site was later promoted to a global with other ids (e.g. seed patterns `idNumber,userCode,password` or `email,password`);
- (b) an admin changed a global's login field ids after users saved.

Legacy service-key credentials are not a separate pattern (migrated to profile ids, field keys unchanged). Proposal: raise the notice only on the approved switch of an app in the vault `customServices`, unless the Architect wants it on globals too.

**6. Architect additions.**
- **(a) Global sites today:**
  - An admin change to the name, URL, category, login URL or login fields of a global reaches every user who has it in the home on the next catalog load, with no re-approval.
  - AD-123-19 (a) keeps home tiles ungated, and the floating window, launch kind and login URL follow the registry row.
  - Approval gates only managed autofill (`userApprovalState` / validated profile) and catalog listing for new adds.
  - So global sites do **not** behave "no effect until approved". **Conflict:** "like a global site" does not describe what globals do today.
- **(b) Re-editing an approved site:**
  - A security-relevant mapping change sets a validated profile to `unsupported` (`validatedProfile.ts:509–525`), so the state becomes `not_approved`.
  - A login-field change the mappings no longer cover gives `blocked` (`mappingsCoverRequiredSchema`).
  - Name, primary URL, category and login URL edits (`updateGlobalRegistryRow`, `admin_update_login_url`) do not touch the profile, so the site stays `approved`.
  - **Conflict:** under the rule as written, name / URL / category / login URL edits would reach the owner immediately (still approved). A mapping / field edit would flip the owner back to the vault copy, which is stale and, after (ii), already admin-overwritten; values saved after approval under the new ids would be hidden again. The rule does not say what applies once approval is lost.

**7. Proposed fix, for the Architect's ruling.** Not implemented.
1. Keep the user's own definition. Hydrate must not overwrite vault `customServices` entries from the registry, or it must store the registry row separately. This is `src/supabase/persistence.ts` (hydrate), a stop-rule item.
2. In `App.tsx`, make one effective definition per vault `customServices` id: the registry entry (own row, or the in-place promoted global with the same id) when `userApprovalState === 'approved'`, otherwise the vault copy whole (no field / URL mixing). Replace the overlay in `mergeCustomDefinitions` and the same-id preference in `dedupeServicesByPrimaryUrl`. Execution and managed autofill read only the runtime `Service` (`serviceExecution.ts:70–72,143,237`), so this one choice drives window, launch, login URL, execution and autofill. Execution / autofill code stays unchanged.
3. In `LoginAssistancePanel`: when approved and the profile has non-empty values under ids outside the effective fields, show «שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.» with «עריכת פרופיל» (floating window, RTL, no browser dialog). Nothing is written except by the user's own profile save.

**Questions for the Architect:**
- Q1 (a): does the rule apply to own sites only? Gating globals too would change AD-123-19 (a) and need an admin "pending changes" model.
- Q2 (b): when an approved own site loses approval after a re-edit, should the owner fall back to their own copy, or keep the last-approved definition? Keeping it needs a stored snapshot, i.e. a registry / persistence change.
- Q3: is the hydrate change in item 1 approved?
- Q4: with an alternate-id promotion the owner keeps their own row. Should the owner move to the global id after approval? The rule does not say.

### T-1 for D-123-6 / D-123-7 (frozen tree `7c63e915`, 2026-10-05 07:14 → 07:27) — superseded
Not accepted as evidence (two concurrent runs). Kept for the record; the single clean run is "T-1 — D-123-8 final" below.

| Run | Result |
|---|---|
| `verifyPhase123FixD6D8 --no-mutations` / full | PASS: 6 check groups / 9 mutations caught |
| `verifyPhase123AppContext --no-mutations` / `--mutations=M3,M8,M10–M15` | PASS: 23 groups / 8 caught |
| `verifyPhase123Catalog --no-mutations` / `--mutations=M1–M18` | PASS: 19 groups / 18 caught |
| `verifyPhase123CatalogGate --no-mutations` / full | PASS: 8 groups / 20 caught |
| `verifyPhase123Sync --no-mutations` | PASS: 14 groups |
| Touched: 116 (R1–R12), 104, 108 M1, 108 ModalAudience, 113, 117, ServiceSourceOwnership | 7/7 PASS |
| Admin: 40 × `verifyPhase121*`, `verifyPhase122AdminNotes`, `verifyPhase122SubmitterProfiles`, `verifyPhase122AdminWorkspace --no-mutations` | 43/43 PASS (AdminWorkspace 32 groups; DeleteService 43 mutations) |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0 (existing chunk-size warning); `extension/`, `package*.json`, `supabase/` unchanged |

- Results: `%TEMP%\pv-t1-d6d8-results.txt`; logs: `%TEMP%\pv-t1-d6d8-logs`.
- The set ran twice, concurrently. A runner call reported as rejected had in fact started, and I then started the same job list inline.
  - The second start reset the shared results file, so it holds 115 job lines (59 + 56): one complete run plus the remainder of the other. All 115 have exit 0.
  - The concurrent runs did not interfere: no failure, and the fingerprint was unchanged afterwards.
- H-1: the new verify bounds the bundle step and each mutation with `withTimeout`; a timeout fails the run via `failRun` and is never counted as caught. It opens no pages or servers.

### D-123-8 — implementation (rulings of 2026-10-05, items 1–5)

**Rule as implemented.** "Own site" = an app whose id is in the vault `customServices`; nothing else (no site / hostname / serviceId branch). Global sites are unchanged: admin edits apply immediately, approval gates listing and autofill only.

**One resolved definition** (`src/digitalHome/ownSiteDefinition.ts`):
- `isApprovedForUsers(entry)` = `userApprovalState({ metadata, login_fields }) === 'approved'` (the shared helper from `src/service/userApproval.ts`). A missing entry or any throw → `false` (fail-closed).
- `resolveOwnSiteDefinition(vaultCopy, registryEntry)`:
  - approved (and the entry has a category and an icon, so it renders as a tile) → the registry entry, whole;
  - anything else (not approved, blocked, no mapping, approval lost, no row, unreadable approval) → the vault copy, whole. No field mixing.
- `hiddenCredentialFieldIds(credential, currentFieldIds)` = stored keys with a non-blank value that the current form does not show. Read-only.

**App** (`App.tsx`):
- `mergeCustomDefinitions(vaultCustom, catalog)` now looks up each vault copy's registry entry among all catalog definitions by id (the own row, or the global it was promoted to in place) and keeps `resolveOwnSiteDefinition(...).definition`. It returns `{ definitions, approvedOwnIds }`. The old overlay `{...registry, ...vault, loginFields: vault ?? registry, metadata: {...registry, ...vault}}` is gone, so **the App catalog merge no longer takes registry login fields (or metadata) for a non-approved own site**.
- Own-row registry entries with no vault copy are still listed as before.
- `legacyBuiltinServices` leaves out ids that are in `customServiceIds`. A global promoted in place (same id) is shown through the resolved own entry, so the old `dedupeServicesByPrimaryUrl` preference for the global row no longer applies to it.
- The window, launch kind, login URL, execution and managed autofill all read that one legacy `Service`. Execution / autofill code is unchanged.
- `approvedOwnSiteIds={ownSites.approvedOwnIds}` → Dashboard → `ownSiteApproved` on the floating window.

**Notice** (`LoginAssistancePanel.tsx`): shown when `isCustom && ownSiteApproved`, the window offers profile UI, there is an active profile, the entry is a form, and the active profile has a non-blank value under a field id the form does not show.
- Copy: «שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.» with «עריכת פרופיל» (opens the existing single profile host on the active profile). Inline in the floating window, `role="status"`, RTL; no browser dialog.
- While the notice shows, the action bar's own «עריכת פרופיל» is hidden, so the window has exactly one.
- Values are shown by field id only: same-id values appear, new ids are empty, other values stay in the vault until the user saves that profile (the existing `serializeCredentialValues` save). Nothing else writes, renames or deletes credential values.

**Promotion under a different global id (item 4):** no automatic move. The own site, its profiles and credentials stay; the global is listed / offered through Phase 116 once approved («already in home» before that, through the own site).

**Hydrate — the N-2 exception, full diff** (`git diff af881f6b -- src/supabase/persistence.ts`, the whole file diff):
```diff
@@ -29,6 +29,7 @@ import {
 } from './sessionSyncScope';
 import { outboxOf, type ConfirmedInserts } from '../vault/syncOutbox';
 import { applyOutboxAfterHydrate } from '../digitalHome/cloudReconcile';
+import { isApprovedForUsers } from '../digitalHome/ownSiteDefinition';
 import {
   dropServicesMissingFromRegistry,
   fetchRegistryPresence,
@@ -986,6 +987,11 @@ export async function hydrateWorkspaceFromCloud(
     for (const row of (customRows ?? []) as ServiceRegistryRow[]) {
       try {
         const definition = registryRowToServiceDefinition(row);
+        // D-123-8: the vault copy is the last version the owner may see — replaced only by an
+        // approved row; a row with no local copy is still added.
+        if (customById.has(definition.id) && !isApprovedForUsers(definition)) {
+          continue;
+        }
         customById.set(definition.id, definition);
       } catch {
         if (isDevBuild()) {
```
- Effect: an approved own row replaces the vault copy (refresh); a non-approved row leaves it unchanged, so after an approval is lost the copy is the last approved version (never the newer edits, never the original). An unreadable row already fell into the existing `catch` and keeps the copy.
- **Static check that the rest of `persistence.ts` is unchanged:** `verifyPhase123D8OwnSite` removes exactly that import line and that block (each must occur once, the block inside the `customRows` loop of `hydrateWorkspaceFromCloud`) and asserts the remainder is byte-identical to `git show af881f6b:src/supabase/persistence.ts`. It also asserts no diff / no new files vs `af881f6b` in `src/vault/crypto.ts`, `src/vault/vault.ts`, `src/supabase/registryPersistence.ts`, `src/registry/registryMapper.ts`, `src/supabase/sessionSyncScope.ts`, `src/digitalHome/cloudReconcile.ts`, `supabase/`, and nothing under `src/admin` apart from the D-123-6 line. No change to sync, crypto, `persistVault`, RLS, schema, registry, mapper or `src/admin`.

**Superseded assertion (D-123-8):**
| Verify | Was | Now |
|---|---|---|
| `verifyPhase123AppContext` `checkPersistenceScope` | `hydrateWorkspaceFromCloud` byte-identical to BASE `909cc8b` | identical to BASE once the exact D-123-8 own-site block is removed; the block must occur exactly once (comment names D-123-8). The other 8 pinned functions stay byte-identical. |

### D-123-8 — verify (`scripts/verifyPhase123D8OwnSite.mjs`)
Real sources, mutations in memory, synthetic fixtures; no credential value is logged.
- **Pure** (Node bundle): the real resolver, `registryMapper`, `definitionToLegacyService`, `credentialSchema`, `credentialsGate`, `catalogVisibility`, `addCustomServiceOutcome`, `managedAutofill` payload builder / eligibility, and the App's own `mergeCustomDefinitions` + `isUserCreatedDefinition`, extracted from `App.tsx` as written.
  - Not approved after an admin rename / category / URL / login-URL / field change → the vault copy: name, URL, category, login URL, form = `username,password`, launch kind `credentials` with the stored values, no managed autofill from the unapproved mapping.
  - Approved → the registry entry; form = registry fields; the autofill payload holds same-field-id values only; managed autofill only after the profile has the new field (execution unchanged); the other-id key is reported hidden; stored values never change.
  - Approval lost → the vault copy (last approved version). No row / unreadable approval (metadata that throws on read) → the vault copy. An approved entry without a category → the vault copy, and the result always renders as a tile.
  - App merge: each own site → exactly the vault-copy object or the registry entry; `own-np.loginFields` stays undefined (no registry login fields); `approvedOwnIds` = the approved ones only; globals are not touched; a registry-only own row is still listed.
  - Promotion under a new global id: the own site stays its vault copy and is not "approved"; the approved global is listed and Phase 116 answers `catalog_service_available` for it; an unapproved global is not listed, and the own site answers «already in home».
- **Hydrate** (Node bundle of the real `persistence.ts` over an in-memory Supabase fake; stubs: client, auth, crypto, devMode, a message constant):
  - not approved / approval lost / unreadable row → the copy stays unchanged; approved → refreshed from the registry; an own row with no local copy is added (today);
  - credentials and profiles are untouched (other-id values still in the vault);
  - sequence v0 (created) → v1 (approved, copy refreshed) → v2 (admin re-edit, approval lost) keeps v1: not v2 (newer edits) and not v0 (original); the App merge then shows v1.
- **Static:** the hydrate scope above; App merge rule (resolver call, no `loginFields` / `loginUrl` / `metadata` in the merge); promoted-in-place dedupe; Dashboard wiring; the Owner edit (`updateCustomService`) byte-identical to `af881f6b`; the resolver writes nothing; no site / hostname / serviceId branch in the resolver, the merge, the panel or Dashboard; Hebrew copy exact; no browser dialogs.
- **Browser** (Edge via Playwright, real Dashboard + floating window, services resolved by the real App merge; stubs: persistence, logos; `<html lang="he" dir="rtl">`):
  - not approved: vault-copy fields, stored values shown, no notice, the admin's name not shown;
  - approved with changed fields: registry fields, the same-id value shown, the new id empty, notice text + RTL, exactly one «עריכת פרופיל», which opens the profile host on the active profile (`edit`);
  - approved with nothing hidden: values shown, no notice, the bar keeps its button;
  - global site with changed fields: admin fields (today), no notice;
  - no page errors, no native dialogs.

Mutations (all caught on the frozen tree):
| # | Mutation | Caught by |
|---|---|---|
| M1 | registry definition used while not approved | resolver: «not approved → the vault copy» |
| M2 | vault copy not refreshed while approved (hydrate skips approved rows) | hydrate: «approved → refreshed» |
| M3 | registry not applied while approved | resolver: «approved → the registry definition» |
| M4 | approval lost shows the newer unapproved edits (any mapped state counts as approved) | resolver |
| M5 | approval lost flips back to the original (approved refresh never stored) | hydrate |
| M6 | unknown approval uses the registry | resolver: «unreadable approval → not approved» |
| M7 | hydrate change outside the own-site merge | static: persistence.ts identical apart from the block |
| M8 | notice on a global site | browser: «global: no notice» |
| M9 | missing-id values deleted on approval | hydrate: «credential values untouched» |
| M10 | display keyed by position | browser: «new field id shows no value» |
| M11 | display keyed by label | browser: «stored values shown» |
| M12 | notice missing after approval with changed fields | static: Dashboard wiring |
| M13 | registry login fields in the App catalog merge for a non-approved own site | App merge |
| M14 | App merge does not report approved own ids | App merge |
| M15 | hydrate drops a new own row that has no local copy | hydrate |
| M16 | promoted-in-place global listed twice | static |
| M17 | approved entry without category used (tile render crash) | resolver |

```
PASS — Phase 123 fix round D-123-8: 9 check groups, 17 mutations caught — 18s
```

H-1: the pure / hydrate bundles, the hydrate scenarios, the browser bundle and the browser group each run under `withTimeout` (90 s); each mutation run under 240 s. A timeout fails the run via `failRun` and is never counted as caught. The browser context and the local server are closed in `finally`.

### T-1 — D-123-8 final (frozen tree `1de67427…e387`, 2026-10-05 08:59:01 → 09:12:15)
- **One** sequential run: a single inline PowerShell loop, 68 jobs one after another. Before it, `Get-CimInstance Win32_Process` showed no `pv-t1` / `scripts/verifyPhase` process; after it, none either. No other runner was started.
- Results: `%TEMP%\pv-t1-d8-results.txt` (68 job lines, `nonzero=0`); one log per job in `%TEMP%\pv-t1-d8-logs`.

| Run | Result |
|---|---|
| `verifyPhase123D8OwnSite --no-mutations` / full | PASS: 9 groups / 17 mutations caught |
| `verifyPhase123FixD6D8 --no-mutations` / full | PASS: 6 groups / 9 mutations caught |
| `verifyPhase116CustomAddIdentity` | PASS (S0–S4 static + R1–R12) |
| `verifyPhase123Sync --no-mutations` / full (hydrate is touched) | PASS: 14 groups / 30 mutations caught |
| `verifyPhase123AppContext --no-mutations` / `--mutations=M3,M8,M10,M11,M12,M13,M14,M15` | PASS: 23 groups / 8 caught |
| `verifyPhase123Catalog --no-mutations` / `--mutations=M1…M18` | PASS: 19 groups / 18 caught |
| `verifyPhase123CatalogGate --no-mutations` / full | PASS: 8 groups / 20 caught |
| Touched (every verify reading a touched file, + 108 ModalAudience as before): 102 CredentialSchema, 103 Execution, 104 ServiceManagement, 108 BrowserIntegration, 108 KnownServiceBootstrap, 108 M1, 108 ModalAudience, 109 Accounts, 111 Assets, 113 LoginAssistance, 117 ManagedAutofill, ServiceSourceOwnership | 12/12 PASS |
| Admin: 40 × `verifyPhase121*`, `verifyPhase122AdminNotes`, `verifyPhase122SubmitterProfiles`, `verifyPhase122AdminWorkspace --no-mutations` | 43/43 PASS (DeleteService 4 groups / 43 mutations, it calls hydrate; AdminWorkspace 32 groups) |
| `npx tsc -b` (separate plain command) | exit 0 |
| `npm run build` (separate plain command) | exit 0 (existing chunk-size warning); `extension/`, `package*.json`, `supabase/` unchanged |
| Fingerprint before (08:58:50) / after T-1 + `tsc` + build (09:13:48) | `1de67427…e387` both times |

Not run, per T-1 / standing rules: full mutation sweeps of AppContext / AdminWorkspace (END OF ROUND), `runOfflineRegression`, live-only `verifyPhase101Supabase` / `verifyPhase102Registry`. No live reproduction: no Owner credentials, and env / secrets / DB stay off-limits.

### Known Issues
1. **Owner edit of a non-approved own site («עריכת פרטי האתר», AD-123-14) and pending admin edits — unchanged, reported.** `updateCustomService` (byte-identical to `af881f6b`) calls `upsertCustomServiceRegistryRow(definition)`, which upserts the whole owner row (`onConflict: 'id'`) from `serviceDefinitionToRegistryInsert`, then writes the definition into the vault copy.
   - The form opens on the resolved site (for a non-approved site: the vault copy) and builds the definition from the form values + the vault copy's metadata (`EditSiteDetailsModal` → `buildCustomSiteDefinition` → `createCustomServiceDefinition`, which sets no `loginFields`).
   - So the upsert overwrites any pending admin edits on that row: name, URL, category, login URL; `login_fields` → `null`; `metadata` → the vault copy's metadata (the admin's pending mapping / `autofillProfile` draft is dropped); `service_status` → `pending_review`. The admin's unapproved work on that row is lost without a notice to either side.
   - If the vault copy came from an approved version, its metadata still holds that validated `autofillProfile`; written back with `login_fields: null`, the row is not `approved` (no credential fields), so the owner keeps seeing the own copy.
   - After an approved own site is edited by its owner, the same upsert applies; the row then loses approval and the owner sees the edited copy.
2. **In-place promotion and hydrate.** After `promote_user_submission` converts the row in place (`built_in`, `owner_user_id=null`), hydrate no longer returns it (`source_type='user'` query), so the vault copy is not refreshed from the global. The App still shows the approved global (resolved by id from the catalog). If that global later loses approval, the owner falls back to the vault copy = the last approved **own-row** version, not the last approved global version.
3. **No migration.** Vault copies already overwritten by the pre-fix hydrate (admin edits copied in before approval) stay as they are; the original owner definition cannot be restored.
4. **New device / empty local vault.** An own row with no local copy is still added as is (today's behaviour), so on a fresh device the current, possibly unapproved, row becomes the copy.
5. **Approved row without category / icon.** The resolver keeps the vault copy for such an entry, but hydrate refreshes on approval alone (the N-2 rule as written), so such a row would replace the copy. This was already possible before (the old hydrate and the old merge did the same); not changed, to keep the N-2 diff to the approved rule.
6. Admin icon uploads (registry metadata / icon) are not shown for a non-approved own site, because the vault copy is used whole.
7. `Dashboard` keeps `assistance.service` as a click-time snapshot (pre-existing): if approval changes while the window is open, the window updates on the next open.
8. The admin id-display messages listed under D-123-6 are reported, not changed.

### Owner re-check
Awaiting Owner, after the Architect review: item 4 if still open; D-123-7 (create / edit keep the typed URL; www / non-www recognised); D-123-6 (approve message); D-123-8 (an own site edited by an admin stays as the owner's copy until approved; after approval with changed fields the window shows «שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.» with «עריכת פרופיל»; global sites behave as today). 123.3 is not open.

Stopping for the Manager / Architect review of D-123-8.

## Slice 123.3 - Remove app (opened 2026-10-05)

### WIP commit (baseline)
- `0dfb9de70f50933b86b3b140c13bda28c8af523a`, on top of `af881f6b`. It holds the accepted fix-round tree: fingerprint `1de67427…e387` confirmed immediately before the commit, 19 files, explicit paths only, team docs under lowercase `team-yuri/`, no `node_modules/.tmp`. After the commit, `git diff` for `src scripts supabase` was empty.
- All 123.3 fingerprints use `0dfb9de7` as BASE, with scope `-- src scripts supabase`. Each is the binary diff plus the untracked files.

### Item 0a - KI-5 (approved + complete, one shared helper)
The vault copy of an own site is now replaced on hydrate only by a row that is approved AND complete (category + icon). This is the same rule the resolver uses, and both now call one helper, `ownSiteFollowsRegistry` in `src/digitalHome/ownSiteDefinition.ts`. A row with no local copy is still added. `persistence.ts` has no other change: the import line and the 3 lines of the block.

```diff
+export function ownSiteFollowsRegistry(
+  entry: Pick<ServiceDefinition, 'metadata' | 'loginFields' | 'category' | 'icon'> | null | undefined,
+): boolean {
+  return Boolean(entry?.category && entry.icon) && isApprovedForUsers(entry);
+}
 ...
-  if (registryEntry?.category && registryEntry.icon && isApprovedForUsers(registryEntry)) {
+  if (registryEntry && ownSiteFollowsRegistry(registryEntry)) {
```

```diff
-import { isApprovedForUsers } from '../digitalHome/ownSiteDefinition';
+import { ownSiteFollowsRegistry } from '../digitalHome/ownSiteDefinition';
 ...
-        // D-123-8: the vault copy is the last version the owner may see — replaced only by an
-        // approved row; a row with no local copy is still added.
-        if (customById.has(definition.id) && !isApprovedForUsers(definition)) {
+        // D-123-8 / KI-5: the vault copy is the last version the owner may see — replaced only by
+        // an approved, complete row; a row with no local copy is still added.
+        if (customById.has(definition.id) && !ownSiteFollowsRegistry(definition)) {
```

Pins updated narrowly (superseded assertions; each change is commented with KI-5):
- `verifyPhase123AppContext.mjs`: `checkPersistenceScope` now pins the new block text. Everything else in that check is unchanged.
- `verifyPhase123D8OwnSite.mjs`:
  - The `af881f6b` scope check uses the new import and block texts.
  - New static group `checkKi5SharedPredicate`. It checks that:
    - `persistence.ts` equals `0dfb9de7` once the import and block are swapped back;
    - the helper body is approved + category + icon;
    - the resolver and the hydrate block both use only the helper.
  - New behaviour cases:
    - resolver: an approved entry without an icon keeps the vault copy;
    - hydrate: an approved row with `category_id: null` keeps the existing copy;
    - hydrate: an approved row with no icon and no local copy is still added.
  - All 17 earlier mutations are kept. M1, M2, M15 and M17 are re-anchored to the helper text. New mutations:
    - M18: hydrate bypasses completeness (an approved but incomplete row replaces the copy);
    - M19: the resolver uses its own predicate instead of the shared helper;
    - M20: a hydrate change outside the block.

| Verify | Result |
|---|---|
| `verifyPhase123D8OwnSite` (full) | PASS: 10 groups / 20 mutations caught |
| `verifyPhase123AppContext --no-mutations` | exit 0 |
| `verifyPhase123Sync --no-mutations` | exit 0 |

Working-tree fingerprint after Item 0a: `8998f16a…b3f5`, 4 files (the two verifies, `ownSiteDefinition.ts`, `persistence.ts`). This is not the final freeze. The single T-1 run comes at the end of 123.3.

### 123.3 Step 0 - AD-123-16 (owner delete of a pending own row)
**Status: DELETED (2026-10-05): owner view + the Owner's post-run SQL (MC-3), 0 rows.**

Run (Owner decision, test environment):
- One PowerShell command. The test-account variables and `NODE_TLS_REJECT_UNAUTHORIZED=0` (Architect-approved, this single run only, because of a local TLS inspector) were set, used and removed in that command. Afterwards, none of the three is left in the shell.
- The credentials are not in any file, log or this report. TLS-off is not in any project file or verify.

| Step | Result |
|---|---|
| Sign-in (anon client) | ok, user `2bc7…` (36 chars) |
| Custom add (real `createCustomServiceDefinition` → `upsertCustomServiceRegistryRow`) | ok, id shape `custom-<uuid>`, marker host `pv-step0-0647de59.example.test` |
| Owner read before | 1 row: `source_type='user'`, `service_status='pending_review'`, `owner_user_id` = the signed-in user |
| `deleteCustomServiceRegistryRow(id)` as the owner | returned without error |
| Owner read after | 0 rows, no error |
| Owner SQL (MC-3), before the run (10:29) | 0 rows. The row did not exist yet, so this is not proof. |
| Owner SQL (MC-3), after the run (10:31) | "Success. No rows returned": 0 rows. This is the independent proof. |

Conclusion: DELETED. Under the current RLS, the owner can delete her own pending custom row. AD-123-16 needs no migration and no owner-select policy. `%TEMP%\pv-step0` was deleted after the run.

Execution path (Architect addition, Owner-authorized, test environment):
- One-off script `%TEMP%\pv-step0\step0.mjs`, outside the repo and not committed. It will be deleted after the run.
  1. It reads only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `.env.local`. They are not printed and not written into the bundle: `import.meta.env` maps to a runtime global.
  2. It bundles the real `upsertCustomServiceRegistryRow`, `deleteCustomServiceRegistryRow`, `createCustomServiceDefinition` and `getSupabaseClient`.
  3. It signs in with the anon client using `PV_TEST_EMAIL` / `PV_TEST_PASSWORD` from the process environment. These are never echoed, logged or written.
  4. It creates one custom site, `https://pv-step0-<8 hex>.example.test/` in category `shopping`, through the real custom-add registry path (`source_type='user'`, `service_status='pending_review'`, own `owner_user_id`).
  5. It reads the row as the owner, calls `deleteCustomServiceRegistryRow(id)`, and re-reads as the owner.
  6. Output: the id shape only, the redacted user id (4 chars + length), and error code / message only.
- Dry run (`--dry-run`: bundle + client, no sign-in, no write): passed.
- Independent proof (MC-3): the Owner's read-only SQL, below. Expected result if DELETED: 0 rows.

```sql
select id, source_type, service_status, owner_user_id is not null as has_owner, created_at
from service_registry
where primary_url like 'https://pv-step0-%.example.test/%';
```

Results: recorded in the table above. Architect: Step 0 = DELETED, ACCEPTED (arch Review Notes "123.3 progress (2026-10-05)"). No migration and no owner-select policy; the AD-123-16 conditional branch is closed. Item 0a (KI-5) is accepted as part of this submission.

### 123.3 Implementation
**Status: COMPLETE.** One clean sequential T-1 run (70 jobs, all exit 0), plus `tsc` and build, on frozen tree `664646a0…18af`. The fingerprint was identical before and after. Owner manual steps: awaiting Owner. Stopping for Manager → Architect review. 123.4 is not open.

**User-side primitives** (new files, nothing imported from `src/admin`):
- `src/digitalHome/RemoveAppConfirmDialog.tsx`:
  - `role="alertdialog"`, `aria-modal`, labelled and described, `dir="rtl"`;
  - focus starts on «ביטול»; Tab / Shift+Tab are trapped; Escape cancels (capture phase, so no other Escape handler runs); focus returns to the opener if it is still in the page;
  - copy: «להסיר את {name}?» / «כל הפרופילים ופרטי ההתחברות של האפליקציה יימחקו מכל המכשירים שלך.» / «הסרה» (danger) / «ביטול».
- `src/digitalHome/UndoToast.tsx`: `role="status"`, `aria-live="polite"`, RTL; «האפליקציה {name} הוסרה.» with a seconds countdown (`UNDO_WINDOW_MS = 5000`); the «ביטול» button gets focus when nothing else has it, and Tab reaches it.
- CSS in `src/App.css` (`.dh-confirm-*`, `.dh-undo-*`, `.dh-remove-error`, `.la-app-menu-item--danger`). New message `LABEL_REMOVE_APP = 'הסרת אפליקציה'`.

**Menu (AD-123-11 / AD-123-14 clarification).**
- New predicate `isUserCustomApp(service, inVaultCustomServices)` in `appContext.ts`: in vault `customServices` AND runtime `source === 'user-created'`.
- The panel uses this predicate for `appContextActions`.
- In the panel: `showEditSiteDetails = menu.edit_site_details && onEditSiteDetails`, `showRemoveApp = menu.remove_app && onRemoveApp`, `showAppMenu = showEditSiteDetails || showRemoveApp`.
- Effect:
  - built-in apps get «הסרת אפליקציה» in every launch kind;
  - user-created customs also get «עריכת פרטי האתר»;
  - a promoted id (in `customServices` but resolved to the global) gets remove only.
  - `App.openSiteDetailsEdit` applies the same rule.
- The `showFieldsUpdated` input (D-123-8) is unchanged.

**Flow (`App.tsx`).**
- Digital Home (panel → Dashboard → App) and ManageServices (`removeService`) both call `requestRemoveApp(id)`.
- `requestRemoveApp`: if this id is already pending, nothing happens. If another removal is pending, it is committed first (AD-123-12). Then the confirm dialog opens.
- Confirm → `beginPendingRemoval`:
  - React state + ref only: `{serviceId, serviceName, url, deleteOwnRow, deadline, committing}`; `deleteOwnRow` comes from the single custom rule;
  - one 5 s timer;
  - the tile is hidden on Digital Home, in the catalog and in ManageServices through `visibleSelectedIds` (the CatalogGate pins on `selectedServices` / `allServices` stay unchanged).
  - Nothing is written.
- Undo: clears the timer and the pending state; writes nothing.
- `commitPendingRemoval()` returns `'removed' | 'failed' | 'none'` (`'none'` = nothing pending). It is shared by the timer, a second request, logout / lock, a catalog re-add and a custom re-add with the same URL identity. While it runs, the toast is hidden.
- Commit = `changeSelection(id, 'remove', {deleteOwnRow})`, in AD-123-11 order:
  1. bump the dual-write generation;
  2. `removeUserServiceFromCloud(id)`;
  3. `persistSelectionState(removeAppFromVault(state, id), {awaitCloudSync: true})`;
  4. `removeUserServiceFromCloud(id)` again (re-verify);
  5. user-created custom only: `deleteCustomServiceRegistryRow(id)`, with one retry. A second failure gives a dev-only `console.warn`; nothing is thrown or reverted.
  - Steps 2–4 fail → the tile reappears, Hebrew error banner (`role="alert"`, `SELECTION_REMOVE_CLOUD_FAILED_MESSAGE`), result `'failed'`.
  - If steps 3 / 4 fail, the previous vault is written back local-only (`skipCloudSync: true`), so local stays unchanged (see Known Issue 1).
- `removeAppFromVault` (`serviceSelection.ts`, pure) removes:
  - the selection;
  - every profile of the app, with its credentials, plus a credential keyed by the service id;
  - the `customServices` entry.
  - It adds nothing to the outbox, and the removed profile ids leave it (arch ruling 3).
- Arch §7: `addToSelection` of an app that is not selected first drops leftover profiles / credentials of that app, so a re-add starts with 0 profiles.
- AD-123-12:
  - one pending removal at a time;
  - a second request, logout and lock (`handleLogout`) commit first;
  - `addApp` of the pending id commits first and then adds fresh; if that commit fails, the add returns the failure message;
  - `addCustomService` with the same URL identity commits first.
- PQ-123-1: the pending state is never stored, so a reload during the window commits nothing.

**KI-3 (ruling: an app this session saw in the cloud is dropped when the cloud read comes back empty).**
- `sessionSyncScope.ts` keeps `cloudServiceIds` per session: the login baseline read, then every focus refresh read. New exports: `servicesSeenInCloud(userId)` (a copy) and `noteCloudServicesRead(userId, ids)`.
- In `refreshWorkspaceFromCloud`, for an empty cloud with local apps:
  - local apps this session saw in the cloud are dropped with their profiles / credentials (`dropGoneFromVault`);
  - apps never seen there are kept (D-109-25 protection);
  - nothing seen → `null`, as before;
  - read errors → `null` (fail-closed).
- The dual-write `canReportGone` is unchanged.

### 123.3 Verifies
- **New `scripts/verifyPhase123RemoveApp.mjs`:** 13 check groups, 20 mutations.
  - Pure groups:
    - `removeAppFromVault`, including outbox ruling 3;
    - leftover cleanup on re-add;
    - the single custom rule.
  - Static groups:
    - commit order and step 5;
    - pending state in memory only and the commit-first call sites;
    - panel menu;
    - N-1 / N-4 / N-5 / N-6 / N-8.
  - Browser groups (real `App` in StrictMode; persistence / vault / registry delete instrumented):
    - menu in all four launch kinds;
    - confirm dialog + Undo toast (Escape, focus trap, countdown, no writes);
    - commit order and the persisted vault;
    - step 2 / 3 / 4 failures;
    - step-5 retry;
    - AD-123-12 edge rules (second request, lock, catalog re-add with 0 profiles) and the reload (PQ-123-1).
  - Mutations M1–M20 cover the required list:
    - step order swapped;
    - Undo writes;
    - a failed commit hides the tile;
    - step 5 reverts the removal;
    - pending state persisted;
    - re-add keeps the old profiles;
    - credentials kept;
    - `window.confirm` used;
    - menu hidden for one launch kind;
    - edit entry shown for a promoted id;
    - plus 10 extras (M11–M20).
- **`scripts/verifyPhase123Sync.mjs`:** new scenario `checkKi3EmptyCloudSeenApps` (15 groups) and mutations M31–M35 (35 in total). The scenario checks that, after window A empties the cloud:
  - a read error gives `null`;
  - apps seen at a focus refresh or at the login baseline are dropped with their profiles and credentials;
  - a never-seen app is kept;
  - the next empty read gives `null`;
  - a session without a baseline read gives `null`.

### 123.3 Superseded assertions (narrow updates, each commented with its AD)
| Script / check | Old assertion | New assertion | AD |
|---|---|---|---|
| `verifyPhase123AppContext` `checkPanelStatic` | no «הסרת אפליקציה» before 123.3 | `showRemoveApp = actions.menu.remove_app && Boolean(onRemoveApp)` | AD-123-11 |
| `verifyPhase123AppContext` `checkNoNewWriteSites` (N-3) | App.tsx `persistVault` count ≤ HEAD + 3 (AD-123-18) | ≤ HEAD + 3 + 1. The +1 is the local-only restore after a failed step 3 / 4. The "every added call is local-only" pin is unchanged | AD-123-11 |
| `verifyPhase123Catalog` `withoutD1235` | `addCustomService` = HEAD after the D-123-5 undo | the undo also strips the `commitPendingRemovalForUrl` line | AD-123-12 |
| `verifyPhase123Catalog` `checkMenuOutsideProfileGate` | menu = `edit_site_details` only, no remove-app | `showRemoveApp` = `menu.remove_app`, not gated by launch kind / profile UI; `showAppMenu` = edit \|\| remove | AD-123-11 |
| `verifyPhase123Catalog` `checkProtectedUnchanged` | `serviceSelection.ts` unchanged | removed from the protected list (`removeAppFromVault`, leftover cleanup) | AD-123-11, arch §7 |
| `verifyPhase123Catalog` M4 anchor | `const showAppMenu = showEditSiteDetails;` | `const showAppMenu = showEditSiteDetails \|\| showRemoveApp;` | AD-123-11 |
| `verifyPhase123Catalog` `checkAppMenuAllKinds` | «עריכת פרטי האתר» for every vault-custom app in all kinds; no app menu for a built-in app | remove-app in every kind; promoted ids have no edit entry; the save path uses a user-created app; built-in menu = remove-app only | AD-123-11, AD-123-14 clarification |
| `verifyPhase123D8OwnSite` `checkKi5SharedPredicate` / `checkHydrateScope` | `persistence.ts` = `0dfb9de7` after the KI-5 undo; `sessionSyncScope.ts` unchanged | first the exact KI-3 edits are undone (each must appear exactly once), then the same identities are checked | KI-3 ruling |

### T-1 — Slice 123.3 final (frozen tree `664646a0…18af`, 2026-10-05 11:11:39 → 11:25:00)
- **One** sequential run: a single inline PowerShell loop running 70 jobs one after another.
  - Before it, `Get-CimInstance Win32_Process` showed no `pv-t1` / `scripts/verifyPhase` process; after it, none either. No other runner was started.
  - Results: `%TEMP%\pv-t1-123-3-results.txt` (70 job lines, `nonzero=0`); one log per job in `%TEMP%\pv-t1-123-3-logs`.
- **Fingerprint:** `%TEMP%\pv-fingerprint-123-3.mjs` (read-only helper outside the repo). BASE `0dfb9de7`, scope `-- src scripts supabase`: binary diff + untracked files. 14 tracked files changed, 3 untracked, `diff_bytes=70805`.
  - Before (11:11:30): `664646a004d28fe107964527e69b2dfc6c5ec9e88aa9d5e87f2060a8d6c318af`.
  - After T-1 + `tsc` + build (11:26:09): `664646a004d28fe107964527e69b2dfc6c5ec9e88aa9d5e87f2060a8d6c318af`. Identical.
  - The Item 0a value `8998f16a…b3f5` is superseded.

| Run | Result |
|---|---|
| `verifyPhase123RemoveApp --no-mutations` / full | PASS: 13 groups (19s) / 20 mutations caught (38s) |
| `verifyPhase123Sync --no-mutations` / full (includes M31–M35) | PASS: 15 groups / 35 mutations caught (8s) |
| `verifyPhase123D8OwnSite --no-mutations` / full | PASS: 10 groups / 20 mutations caught |
| `verifyPhase123AppContext --no-mutations` / `--mutations=M3,M8,M10,M11,M12,M13,M14,M15` | PASS: 23 groups / 8 caught |
| `verifyPhase123Catalog --no-mutations` / `--mutations=M1…M18` (includes M3 / M4) | PASS: 19 groups / 18 caught (2m 10s) |
| `verifyPhase123CatalogGate --no-mutations` / full | PASS: 8 groups / 20 caught |
| `verifyPhase123FixD6D8 --no-mutations` / full | PASS: 6 groups / 9 caught |
| Touched (every non-retired verify reading a touched file, found with `rg`, + 108 ModalAudience as before): 116 CustomAddIdentity, 102 CredentialSchema, 103 Execution, 104 ServiceManagement, 108 BrowserIntegration, 108 KnownServiceBootstrap, 108 M1, 108 ModalAudience, 109 Accounts, 111 Assets, 113 LoginAssistance, 117 ManagedAutofill, ServiceSourceOwnership | 13/13 PASS |
| Admin: 40 × `verifyPhase121*`, `verifyPhase122AdminNotes`, `verifyPhase122SubmitterProfiles`, `verifyPhase122AdminWorkspace --no-mutations` | 43/43 PASS (DeleteService: 4 groups / 43 mutations; AdminWorkspace: 32 groups, 1m 44s) |
| `git diff --stat 0dfb9de7 -- src/admin` (inside the run) | empty |
| `npx tsc -b` (separate plain command) | exit 0 |
| `npm run build` (separate plain command) | exit 0 (existing chunk-size warning); `extension/`, `package*.json`, `supabase/` unchanged |

Before the freeze (not evidence):
- Pre-runs found one superseded pin, the AppContext N-3 count, fixed as in the table above.
- `npx tsc -b` and lints were clean.

Not run, per T-1 / standing rules:
- full mutation sweeps of AppContext / Catalog / AdminWorkspace (END OF ROUND);
- `runOfflineRegression`;
- live-only `verifyPhase101Supabase` / `verifyPhase102Registry`.

No live run: the test credentials are not reused, and env / secrets / DB stay off-limits.

### 123.3 Known Issues
1. **Step 3 / 4 failure after step 2 succeeded.** By then the cloud membership is already deleted, while local keeps the app (restored as required). On the next login reconcile / sync the app may be dropped as "removed elsewhere", or written back by a later dual-write. The user saw the error and the tile came back, so the outcome is still consistent with "failed", but cloud and local can differ until the next sync.
2. **Dual-write still does not report "gone" against an empty cloud** (`canReportGone` is unchanged). The KI-3 drop happens only on the focus / visibility refresh of another window.
3. **`dropGoneFromVault` keeps the `customServices` entry** of an app removed in another window. This is pre-existing and not changed. The membership and profiles go; the custom definition copy stays in the vault without being selected.
4. A registry-only, incomplete own row added by hydrate (no category / icon; Item 0a rule: "a row with no local copy is still added") could fail `definitionToLegacyService` and not render. This is pre-existing and not changed.
5. `commitPendingRemoval` also returns `'none'` (nothing pending), in addition to the planned `'removed' | 'failed'`.
6. ManageServices removal is covered statically (same `requestRemoveApp`); the browser groups drive Digital Home only.
7. **RC-1 — the own registry row survives when step 5 fails twice** (Architect question; pre-accepted once documented; cleanup is for 123.4). `App.deleteOwnCustomRow` tries `deleteCustomServiceRegistryRow(id)` twice. After the second failure it only logs a dev warning. The traced code differs from the question in two places, marked *correction* below.
   - **What the user sees right away:**
     - No error. Nothing is thrown or reverted, and `commitPendingRemoval` returns `'removed'`.
     - The tile is gone.
     - The vault no longer holds the selection, the profiles, the credentials or the `customServices` entry (`removeAppFromVault`).
     - In the cloud, the `user_services` row is deleted (`removeUserServiceFromCloud`). Its `access_profiles` and `encrypted_credentials` rows go with it through the FK cascade (`supabase/migrations/20260702121500_phase101_schema.sql`: `access_profiles.user_service_id … on delete cascade`, `encrypted_credentials.access_profile_id … on delete cascade`).
   - **Catalog, same session — *correction*:**
     - The catalog loader reads only `service_status = 'active'` rows (`src/registry/registryLoader.ts` → `fetchRegistryRows`, `isCatalogVisibleRegistryRow`).
     - An own row is created as `pending_review` (`src/registry/registryMapper.ts`; Step 0 also read `pending_review`), so it is not in `catalogDefinitions`.
     - `mergeCustomDefinitions` (`App.tsx`) therefore has no registry-only copy to keep, and the vault entry is gone.
     - So, immediately after the removal, a pending own site is **not** listed in the catalog. Only an own row that is `active` would still be listed right away (through `catalogDefinitions` → `mergeCustomDefinitions` → `allServices`).
   - **When the row returns — *correction*: not only at the next login:**
     - `hydrateWorkspaceFromCloud` (`persistence.ts`) reads the owner's rows (`owner_user_id = me`, `source_type = 'user'`, no status filter). A row with no local copy is added to `customServices` (the Item 0a rule). `reconcileWithRegistry` keeps it, because the row exists.
     - Hydrate runs at the next login. It also runs on the next focus / visibility refresh, through `refreshWorkspaceFromCloud` → `applyOutboxAfterHydrate` (`...hydrated` keeps `customServices`) → `commitReconciledState`, as long as the cloud still has at least one app for this user. If the cloud is empty, the refresh stops before hydrate, so the row returns only at the next login.
     - The site is not selected: membership comes from the cloud, or from the local selection, and neither holds the id. No tile comes back.
   - **Catalog after that hydrate:**
     - The site is listed under its category as not added, with the add action.
     - Own sites are always listed: AD-123-19 (b), `catalogGateState` → `'own_site'`, `isShownInUserCatalog` in `AppCatalog`. The entry comes from vault `customServices` → `mergeCustomDefinitions` → `allServices`.
   - **Re-add:**
     - `addApp` → `addToSelection` → `removeAppProfiles` (arch §7): the app comes back fresh with 0 profiles.
     - The old credentials cannot return: they were removed locally (step 3), and their cloud rows were cascaded away in step 2.
   - **No later retry:**
     - Nothing queues or retries the delete.
     - The row stays until the user adds the site and removes it again (step 5 runs again, because it is still a user-created custom app), or an admin deletes it.
     - The admin still sees the row as the user's pending submission, so it can still be approved (promoted in place) or deleted there.
   - **Impact:** no data exposure. The row holds only the site definition, and RLS limits it to its owner and admins. The failure is rare: the delete must fail twice. Leftover `customServices` entries and orphan own rows are for 123.4.

### 123.3 Owner manual steps — awaiting Owner (consolidated final run)
Not run: no Owner session; the test credentials are not reused.
1. Remove flow: open an app → ⋮ → «הסרת אפליקציה» → dialog (Escape / «ביטול» cancel; «הסרה» confirms) → tile disappears, toast with countdown.
2. Undo: «ביטול» within 5 s → the tile is back with its profiles; nothing changed after a reload.
3. Commit: wait 5 s → the app is gone after a reload, on a second device, and from the catalog as "not added"; re-adding it starts with 0 profiles.
4. Cross-window last-app removal (KI-3): two windows. Remove the last app in window A; refocus window B → the app disappears there too.
5. Own site: remove a user-created custom site → its registry row is gone (Owner SQL on `service_registry` by id → 0 rows). A promoted site keeps its global row.
6. Pending re-checks from earlier rounds: D-123-6 (approve message), D-123-7 (typed URL kept; www / non-www recognised), D-123-8 (owner copy until approval; «שדות הכניסה לאתר עודכנו …» after approval with changed fields), and the live `[catalog-gate]` hidden-site count.

### Changed files (123.3, vs `0dfb9de7`)
- **Source:**
  - `src/App.tsx`, `src/App.css`, `src/Dashboard.tsx`;
  - `src/digitalHome/appContext.ts`, `src/digitalHome/ownSiteDefinition.ts` (Item 0a), new `src/digitalHome/RemoveAppConfirmDialog.tsx`, new `src/digitalHome/UndoToast.tsx`;
  - `src/loginAssistance/LoginAssistancePanel.tsx`, `src/loginAssistance/messages.ts`;
  - `src/serviceManagement/serviceSelection.ts`;
  - `src/supabase/persistence.ts` (Item 0a + KI-3), `src/supabase/sessionSyncScope.ts`.
- **Tests:** new `scripts/verifyPhase123RemoveApp.mjs`; modified `scripts/verifyPhase123Sync.mjs`, `scripts/verifyPhase123AppContext.mjs`, `scripts/verifyPhase123Catalog.mjs`, `scripts/verifyPhase123D8OwnSite.mjs`.
- `src/admin`, `extension/`, `supabase/`, package files: unchanged. No commit made.

Stopping for Manager → Architect review. 123.4 is not open.
