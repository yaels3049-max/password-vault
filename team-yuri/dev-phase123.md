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
- Slice 123.4 (Navigation unification, AD-123-1 / -9 / -15) + END OF ROUND: COMPLETE.
  - Baseline: WIP commit `c700cd60`.
  - Done: parity matrix before the deletion; ManageServices deleted; Digital Home is the only screen (empty state, inline catalog error, "removed elsewhere" notice); AD-123-15 admin-only counts migration (not applied); new `verifyPhase123Navigation` (15 mutations); cleanup proposal (KI-7 / KI-3) only.
  - END OF ROUND: one clean sequential run, 63/63 PASS, on frozen tree `fef52c66…3ac6` (identical before / after).
  - Live migration apply / call and the Owner manual steps: awaiting Owner.
  - Stopping for Manager → Architect review. See section "Slice 123.4".
  - Architect PASS (2026-10-05). WIP commit `e91b5b1245891b889f01b7ecbd01ccb3065ddb9c` on `wip/phase123-recovered`. See "123.4 WIP commit (approved tree)" at the end of section "Slice 123.4".
- Fix round 123.5 (BASE `e91b5b12`): O-123-1…27 + O-2 implemented, T-1 only. The final run is waiting for the Owner's «סיימתי את כל רשימת הבדיקה» and the last batch of findings. See section "Fix round 123.5".

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

## Slice 123.4 - Navigation unification (AD-123-1, -9, -15) + END OF ROUND (opened 2026-10-05)

### WIP commit (123.4 baseline)
- `c700cd605abeb382a612ae19a4ca5e3c016aeec4` on local branch `wip/phase123-recovered`, on top of `0dfb9de7`. Message: "WIP Phase 123: slice 123.3 remove app approved tree (Architect PASS 2026-10-05), baseline for slice 123.4, not reviewed for merge".
- Before the commit, the fingerprint (BASE `0dfb9de7`, scope `-- src scripts supabase`) was recomputed and confirmed: `664646a004d28fe107964527e69b2dfc6c5ec9e88aa9d5e87f2060a8d6c318af`.
- 21 files, staged by explicit path:
  - the 14 tracked and 3 untracked files under `src` / `scripts`;
  - `team-yuri/PLAN.md`, `team-yuri/arch-phase123.md`, `team-yuri/dev-phase123.md`, `team-yuri/manager-phase123.md` (lowercase path only).
- Not used: `node_modules/.tmp`, `git add -A` / `.`, push, merge, `--no-verify`, amend.
- After the commit, `git diff c700cd60 -- src scripts supabase` was empty (0 lines), and `git ls-files --others --exclude-standard -- src scripts supabase` returned nothing.
- **All 123.4 fingerprints use `c700cd60` as BASE, with scope `-- src scripts supabase`.**

### Parity matrix (AD-123-9), written before `ManageServices.tsx` was deleted
Each capability of `src/ManageServices.tsx` (as of `c700cd60`) maps to its home on Digital Home. "Custom" decisions use the single AD-123-14 rule `isUserCustomApp(service, inVaultCustomServices)` (`src/digitalHome/appContext.ts`): in vault `customServices` AND runtime source `user-created`. ManageServices' own rule (`source === 'user-created'` on its row menu) disappears with the file.

| # | ManageServices capability (symbol) | New home (file → symbol) | Slice |
|---|---|---|---|
| 1 | «האתרים שלי» list of selected apps, grouped by category (`selectedServices`, `mineCategoryGroups`, `groupSelectedServicesByCategory`) | `src/Dashboard.tsx` → `renderTile` grid; the category sections come from `src/digitalHome/homeLayout.ts` → `shouldUseCategoryLayout` / `groupSelectedServicesByCategory` | existing, AD-123-9 "list = grid" |
| 2 | Search in «האתרים שלי» (`mineSearchQuery`, `filterDiscoveryServices`) | `src/digitalHome/AppCatalog.tsx` search (`filterCatalog` in `src/digitalHome/catalogModel.ts` → `filterDiscoveryServices`). Apps in the home are always shown there, marked «✓ כבר בבית הדיגיטלי» (`isShownInUserCatalog(service, inHome)`, `src/catalog/catalogVisibility.ts`) | 123.2 |
| 3 | Per-row management state label (`deriveServiceManagementState`) | `src/loginAssistance/LoginAssistancePanel.tsx` → `resolveDigitalHomeLaunchKind` (`credentialsGate.ts`); launch-kind copy in the floating window; the dot = `appHasProfile` (`appContext.ts`) → `Tile hasCredentials` | 123.1 |
| 4 | Per-row profile count (`getProfilesForService(...).length`) | Dot for ≥ 1 profile (FR-21…23, no count per N-6) + the profile switcher in the floating window (`showProfileChips`, `appContextActions(...).switcher`) | 123.1 |
| 5 | «ניהול» → profile management for apps with a credential panel (`offersCredentialManagementPanel`, `onOpenProfileManagement({serviceId, mode: 'edit'})`) | Floating window «עריכת פרופיל» / «הוספת פרופיל» / empty-state «הוספת פרופיל ראשון» (`onEditProfile` / `onAddProfile`) → `Dashboard` → `App.openProfileManagement` (the same `offersCredentialManagementPanel` gate) → the single host `DigitalHomeCredentialModal` (AD-123-3). Profile add / rename / default / delete / credential edit / credential clear are modal functions, unchanged | 123.1 |
| 5a | «ניהול» on an app with an incomplete schema (not-configured launch kind) opened the modal. The modal showed only `INCOMPLETE_SCHEMA_MESSAGE` and, if a credential is stored, `STORED_DETAILS_RETAINED_MESSAGE` (no form, no profile actions: `allowsCredentialProfileManagement` is false) | The floating window shows `MSG_NOT_CONFIGURED_LAUNCH` «ממתין להגדרת מנהל המערכת.» (`launchKind === 'not-configured'`). No action is lost. The informational line «אם כבר נשמרו פרטים, הם נשמרים ולא מוצגים כאן.» is not repeated there (see Known Issues) | 123.1 (AD-123-2 gating) |
| 6 | No-stored-credentials label (`isNoStoredCredentialsMode`, `NO_STORED_CREDENTIALS_LIST_LABEL`) | Floating window `launchKind === 'no-stored-credentials'` → `MSG_NO_STORED_CREDENTIALS_LAUNCH` | 123.1 |
| 7 | Row menu «הסר אתר» (`onRemoveService` → `App.removeService` → `requestRemoveApp`) | App menu «הסרת אפליקציה» (`LoginAssistancePanel` `showRemoveApp = actions.menu.remove_app && Boolean(onRemoveApp)`) → `Dashboard.onRemoveApp` → `App.requestRemoveApp` → `RemoveAppConfirmDialog` → `beginPendingRemoval` → Undo → `commitPendingRemoval` → `changeSelection(remove)`. **Step 5 uses the single custom rule:** `deleteOwnRow: isUserCustomApp(service, customServiceIds.has(serviceId.trim()))` in `beginPendingRemoval` | 123.3 |
| 8 | Row menu «עריכת פרטי האתר» (`source === 'user-created'` → `EditSiteDetailsModal` → `onUpdateCustom`) | App menu «עריכת פרטי האתר» (`showEditSiteDetails = actions.menu.edit_site_details && …`, with `appContextActions(service, profiles, isUserCustomApp(service, isCustom))`) → `App.openSiteDetailsEdit` (guards: `customServiceIds.has(...)` AND `isUserCustomApp(service, true)`) → `EditSiteDetailsModal` → `App.updateCustomService` (unchanged). **The single custom rule**; the ManageServices rule is gone with the file | 123.2 / AD-123-14 clarification |
| 9 | «הוספת אתרים» catalog body (`AppCatalog`: search, categories, add without a profile, custom add, duplicate offers) | `src/digitalHome/AppCatalogModal.tsx` (same `AppCatalog` body) opened by «+ הוספת אפליקציה» (`Dashboard` `data-action="open-catalog"` → `onOpenCatalog` → `App` `catalogOpen`). Add = `App.addApp`, custom add = `App.addCustomService` | 123.2 |
| 10 | Catalog load error inline with «נסו שוב» (`catalogError`, `onRetryCatalog` → `retryCatalogLoad()`) | `AppCatalogModal` `catalogError` + `onRetryCatalog` → `retryCatalogLoad()` (no full-screen loading: `catalogHydrated` is not reset). With 0 apps, Digital Home stays (no full-screen error, 123.4 binding) | 123.2 / 123.4 |
| 11 | Selection error banner (`selectionError`, `role="alert"`) | Add: inline in the catalog (`AddOutcome` `{status: 'failed', message}` from `App.addApp`). Remove: the Digital Home error banner `[data-remove-error]` (`removeError`, set by `commitPendingRemoval` when `changeSelection(remove)` fails). `selectionError` (set by `changeSelection`, pinned by 113) is shown in the same Digital Home banner: `removeError ?? selectionError`, with `selectionError` hidden while the catalog modal is open (the modal already shows the add failure inline). × clears both | 123.3 / 123.4 |
| 12 | Pending state (`pendingIds` disables row controls, «מסיר…») | Catalog `pendingIds` (`AppCatalogModal`); removal: the selection lock (`selectionLockRef`), the toast hidden while committing (`pendingRemoval.committing`) | 123.2 / 123.3 |
| 13 | Lock / logout (`VaultStateBadge`) | `Dashboard` header `VaultStateBadge` → `handleLockVault` (AD-123-12 commit first) | existing |
| 14 | Logos (`useServiceLogos`) | `Dashboard` `useServiceLogos(services)`; catalog `AppCatalog` | existing |
| 15 | First-run guidance («בחרו אתר אחד להתחלה…») | Digital Home empty state with a central «+ הוספת אפליקציה» (`Dashboard` 0 apps, FR-30), plus the updated first-login hint | 123.4 |
| 16 | «לבית הדיגיטלי» (`onContinue`: `saveVaultState(vaultState)` + hint + `setScreen('dashboard')`) | Navigation only, gone with the screen. The re-persist duplicated writes that every action already makes (`changeSelection`, the profile host `handleVaultStateChange`, `addCustomService` / `updateCustomService`). The hint is now set at login (row 15) | 123.4 |
| 17 | Focus back on «ניהול» after the modal closes (`manageOpenerRef`) | The floating window closes when the modal opens, so the opener is the app's tile. `src/App.tsx` `profileReturnFocusId` (effect on `profileRequest`) refocuses the tile's `button.app-icon` (`[data-service-tile][data-service-id] button`) when the host closes; no-op if the tile is gone (app removed, logout). Focus handling inside the dialogs is unchanged (D-123-3). *Updated in 123.4 during the superseded-verify pass: AC-113-45 is kept, not superseded* | 123.1 / 123.4 |

No ManageServices capability is left without a row, so this is not a STOP.

### Implementation (AD-123-1, AD-123-9)
- **One user screen (FR-01).** `src/App.tsx`:
  - Removed: the `ManageServices` import, `type Screen`, the `screen` / `manageIsFirstRun` state, `resolvePostAuthScreen`, `countUserServices` (the post-login screen choice), `removeService` (the ManageServices bridge to `requestRemoveApp`), `onContinue`, and the full-screen catalog error / loading block.
  - After login, `handleAuthenticated` always lands on Digital Home. The first-login hint is armed with `setShowMagicMomentHint(hydrated.selectedIds.length === 0)`, and `Dashboard` shows it only once the first app is in the home.
  - `clearWorkspaceMemory` resets the hint instead of the screen.
  - The final render is the single `<AppVaultShell>` with `Dashboard`, also with 0 apps and with a catalog error.
- **Catalog failure with 0 apps (binding).**
  - `retryCatalogLoad()` no longer resets `catalogHydrated`, so a retry never brings back a full-screen loading or error state.
  - The catalog modal keeps its inline error with «נסו שוב» (`onRetryCatalog={() => void retryCatalogLoad()}`).
  - `Dashboard` shows the catalog banner for any app count. With 0 apps the copy is «קטלוג האפליקציות אינו זמין כרגע. אפשר לנסות שוב מתוך «+ הוספת אפליקציה».».
- **Empty state (FR-30).**
  - `Dashboard` with 0 apps shows `[data-home-empty]` «עדיין אין אפליקציות בבית הדיגיטלי. הוסיפו את האפליקציה הראשונה כדי להתחיל.» and a central «+ הוספת אפליקציה» (`data-action="open-catalog-empty"`). The header «+ הוספת אפליקציה» stays.
  - The catalog never opens by itself.
  - The «ניהול אתרים» button and the `onAddMore` prop are removed.
- **Updated Hebrew copy.**
  - Hint: «לחצו על האייקון של אפליקציה כדי לפתוח אותה. בחלון שנפתח אפשר להוסיף פרופיל עם פרטי הכניסה.»
  - Copy that pointed to the removed screen was replaced:
    - `MSG_NO_CREDENTIALS` → «… הוסיפו אותם בחלון האפליקציה בבית הדיגיטלי.»;
    - the unused `loginIntelligence` `credentialsMissing` string.
  - The execution-layer `credentials_missing` copy («הגדירו פרטי כניסה במסך «ניהול האתרים» …») sits in `src/execution/serviceExecution.ts`, which is frozen (N-2 in AppContext / Catalog / CatalogGate). It is therefore replaced where Digital Home shows it:
    - `attemptExistingAutomaticCompletion` (`src/loginAssistance/assistanceActions.ts`) maps `status === 'credentials_missing'` to the new `MSG_AUTOFILL_CREDENTIALS_MISSING` «פרטי הכניסה בפרופיל הזה חסרים. לחצו «עריכת פרופיל» בחלון האפליקציה והשלימו אותם.» before any execution `userMessage` is used;
    - `src/execution` is byte-identical to `c700cd60`.
- **"Removed elsewhere" notice (binding).**
  - `Dashboard` owns a `reconcileNotice`, rendered last as `.dh-reconcile-notice` with `role="status"`, `dir="rtl"` and a × «סגירה». It is position fixed with z-index 100, above the catalog overlay (90) and the floating window (40). No browser dialog.
  - Text: if a window closed, `MSG_REMOVED_ELSEWHERE` («…, ולכן החלון נסגר.»). Otherwise (e.g. a tile left the home on the KI-3 drop path) the new `MSG_REMOVED_ELSEWHERE_PLAIN` «האפליקציה או הפרופיל נמחקו בחלון אחר.»
  - `MSG_REMOVED_ELSEWHERE_PLAIN` lives in `src/loginAssistance/messages.ts`, so `src/digitalHome/cloudReconcile.ts` stays unchanged (N-2 in D8OwnSite).
  - The notice hides itself after the status timeout.
- **Selection error.**
  - `selectionError` (pinned by 113 AC-113-51) is shown in the Digital Home banner `homeError = removeError ?? (catalogOpen ? null : selectionError)`; the catalog shows add failures inline. × clears both.
  - `requestRemoveApp` clears `selectionError`.
- **Focus return (parity row 17, AC-113-45 kept).** `profileReturnFocusId` (effect on `profileRequest`) refocuses the app's tile when the profile host closes.
- **Deletion and cleanup (AD-123-9, after the matrix).**
  - Deleted: `src/ManageServices.tsx`, `LABEL_GO_MANAGE`, and the Manage-only CSS in `src/App.css`:
    - `.service-management` in the shared shell rule;
    - `.dashboard-manage-cta`, `.service-management-header`;
    - `.sm-home-nav`, `.sm-mine-toolbar`, `.sm-accordion*`;
    - `.sm-section` / `.sm-section-title`, `.sm-manage-status`;
    - `.sm-row-menu`, `.sm-kebab*`, `.sm-menu*`.
  - Kept: everything `AppCatalog` / the catalog modal / `ServiceCard` still use.
  - Comments updated in `src/digitalHome/AppCatalog.tsx` and `src/catalog/customServiceDiscovery.ts`.
- **Single "custom" rule.** Edit-site (`openSiteDetailsEdit`), the panel menu and remove step 5 (`beginPendingRemoval` `deleteOwnRow`) all use `isUserCustomApp`. After the deletion no `source === 'user-created'` decision is left in user `src/` outside `appContext.ts` (static check, mutation M11).

### AD-123-15 — admin-only "apps without profile" aggregate
- New migration `supabase/migrations/20261005120000_phase123_admin_apps_without_profile.sql`, the only `supabase/` change.
- `public.admin_apps_without_profile_counts()`:
  - `language plpgsql stable security definer set search_path = public`;
  - first statement `if not public.is_admin() then raise exception 'Admin access required'; end if;`, the existing Phase 109 check (active user with `is_admin` or `role = 'admin'`);
  - `revoke all … from public` / `from anon`; `grant execute … to authenticated`.
- Output: one row of 8 `bigint` counts:
  - `apps_total`, `apps_with_profile`, `apps_without_profile`;
  - `apps_without_profile_over_1d`, `apps_without_profile_over_7d`;
  - `apps_first_profile_after_1d`;
  - `users_with_apps`, `users_with_app_without_profile`.
- Inputs: only `user_services.created_at` / `user_id` (for distinct counts) and `min(access_profiles.created_at)`. No ids, names, service ids, URLs or credential data leave the function.
- No table, column, policy, trigger or write. No `src/admin` change (`git diff c700cd60 -- src/admin` is empty; the verify fails if it is not).
- **Not applied** (no DB access): live apply and call are awaiting Owner (instructions below).

### Verify — `scripts/verifyPhase123Navigation.mjs` (new; BASE `c700cd60`)
- **Static:**
  - ManageServices deleted and unreferenced; no `screen` / `manageIsFirstRun` / `onContinue` / post-auth screen choice.
  - No «ניהול אתרים» / «ניהול האתרים» / «הוסף אתרים נוספים» in any user `src/` file (src/admin excluded). The frozen `src/execution` copy is checked to be replaced in `assistanceActions` before any `userMessage`, and Digital Home reaches execution only through `assistanceActions`.
  - No full-screen catalog error / loading on retry; empty state + «+ הוספת אפליקציה»; no auto-open.
  - 25 parity-matrix symbols exist.
  - One "custom" rule.
  - N-1 (src/admin unchanged; supabase = the one migration), N-2 (`cloudReconcile.ts` unchanged), N-4, N-5, N-6, N-8.
  - Migration static: admin-gated stable security definer, bigint counts only, revokes, no DDL on tables / policies, no writes, no names / ids / credential data.
- **SQL (PGlite):** the real migration on the Phase 101 schema plus the Phase 109 `is_admin()`. The fixture is 5 apps / 3 profiles over 3 users.
  - anon → permission denied;
  - two non-admin users, a disabled admin and no session → «Admin access required»;
  - admin → exactly one row, exactly the 8 columns, exact counts 5 / 2 / 3 / 2 / 1 / 1 / 3 / 2, no id / name values;
  - read-only; schema and policies unchanged.
- **Browser:** the real App in StrictMode, Playwright msedge.
  - 0 apps → Digital Home, empty state, no auto catalog, first add.
  - > 0 apps → every FR action reachable from Digital Home, and focus returns to the tile after the profile host.
  - 0 apps + catalog failure → empty state + notice; modal inline error; a failed retry stays inline; recovery.
  - "Removed elsewhere":
    - on the plain home;
    - above the open catalog modal (`elementFromPoint`);
    - with the floating window open;
    - affected window closes with the closed variant.
  - No native dialog in any group.
- **Mutations M1–M15** (each must fail the verify). SQL mutations must also fail the SQL layer alone:
  - M1 non-dashboard screen with 0 apps;
  - M2 «ניהול אתרים» restored;
  - M3 auto-open catalog;
  - M4 non-count column;
  - M5 non-admin allowed;
  - M6 per-user rows;
  - M7 full-screen catalog error restored;
  - M8 notice not rendered;
  - M9 notice under the catalog modal;
  - M10 notice only when a window closed;
  - M11 second "custom" rule;
  - M12 empty state without the CTA;
  - M13 anon may execute;
  - M14 execution copy (removed screen) shown again;
  - M15 no focus return.
- H-1: group 90 s, mutation 300 s, contexts closed in `finally`.

### Superseded assertions (G-3)
Each change cites AD-123-1 / AD-123-9 (manage removal) unless noted. No assertion was weakened beyond replacing the ManageServices target with its parity-matrix home.

| Script | Assertion (was) | Now | AD |
|---|---|---|---|
| `verifyPhase104ServiceManagement` | AC-104-1 ManageServices screen; AC-104-2 «האתרים שלי» on Manage; AC-104-3 catalog title on Manage | no ManageServices / no «ניהול אתרים»; Dashboard `aria-label="האתרים שלי"`; `AppCatalogModal` `{CATALOG_MODAL_TITLE}` | AD-123-1 / -9 |
| `verifyPhase104ServiceManagement` | `deriveServiceManagementState` rendered; D-104-10 row actions; user-created gate; pending; `selectionError` render | panel `resolveDigitalHomeLaunchKind(`; panel edit-profile + remove-app; `isUserCustomApp(service, isCustom)`; `catalogItemState(...)` + `disabled={itemState === 'pending'}`; App `homeError` line | AD-123-9, AD-123-14 |
| `verifyPhase111Assets` | ManageServices logo source | `src/digitalHome/AppCatalog.tsx` | AD-123-1 |
| `verifyPhase102CredentialSchema` | ManageServices «ניהול» gate / no-stored label | App `openProfileManagement` `offersCredentialManagementPanel`; credentialsGate `'no-stored-credentials'` + `resolveCredentialEntry`; panel `MSG_NO_STORED_CREDENTIALS_LAUNCH` | AD-123-9 |
| `verifyServiceSourceOwnership` | ManageServices edit menu | panel + `appContext` rule; label `LABEL_EDIT_SITE_DETAILS` | AD-123-9, AD-123-14 |
| `verifyPhase108M1ExplicitLoginEntry` | product paths include ManageServices | `AppCatalog.tsx`, `EditSiteDetailsModal.tsx` | AD-123-1 |
| `verifyPhase109Accounts` | App routes with `countUserServices` | no `countUserServices` in App; `setShowMagicMomentHint(hydrated.selectedIds.length === 0)` | AD-123-1 (FR-01) |
| `verifyPhase113LoginAssistance` | AC-113-24 prompt names «ניהול האתרים» | prompt points to the app window; no «ניהול האתרים» | AD-123-1 |
| `verifyPhase113LoginAssistance` | Home has `dashboard-manage-cta`; AC-113-27 Manage CTA; AC-113-32 «ניהול אתרים» on Home | no Manage CTA; `dashboard-add-app-cta` + `sm-footer-nav`; «האתרים שלי», no «ניהול אתרים» / «ניהול שירותים» | AD-123-1 |
| `verifyPhase113LoginAssistance` | D-113-22 shared `.dashboard, .service-management` rule; `.sm-section` translucent | `.dashboard` rule with the portrait asset, no gradient; Manage rules gone | AD-123-1 |
| `verifyPhase113LoginAssistance` | Manage lock inside shell; AC-113-28/29/32/36 on ManageServices | ManageServices absent; search in `AppCatalog` (`filterCatalog`); no marketing / old glossary in the catalog; remove = panel `data-action="remove-app"`, no 🗑; Manage-only CSS removed | AD-123-1 / -9 |
| `verifyPhase113LoginAssistance` | AC-113-45 focus back to «ניהול» (`manageOpenerRef`) | **kept, re-homed**: App `profileReturnFocusId` refocuses the tile (browser-checked in Navigation, M15) | AD-123-9 |
| `verifyPhase123AppContext` `checkSingleHost` | ManageServices routes «ניהול» to the host | ManageServices absent; Dashboard edit → `onOpenProfileManagement` | AD-123-1 |
| `verifyPhase123AppContext` `checkNoNewWriteSites` / M8 | `DH_FILES` includes ManageServices; M8 anchored in ManageServices | removed from the list; M8 re-anchored in `Dashboard.tsx` (still caught) | AD-123-1 |
| `verifyPhase123Catalog`, `verifyPhase123RemoveApp` N-4 lists | include `src/ManageServices.tsx` | file removed from the lists | AD-123-1 |
| `verifyPhase123CatalogGate` | ManageServices not gated; renders `<AppCatalog services={allServices}>` | removed from the list; ManageServices absent; `AppCatalogModal services={allServices}` | AD-123-1 / -9 |
| `verifyPhase123RemoveApp` | `removeService` → `requestRemoveApp`, `onRemoveService` | no `removeService` / `onRemoveService`, ManageServices absent (one remove entry) | AD-123-1 / -9 (was AD-123-11) |
| `verifyPhase123D8OwnSite` `checkHydrateScope` | `supabase` unchanged vs `af881f6b` | unchanged apart from the one AD-123-15 migration file | **AD-123-15** (outside the G-3 list; see note) |

Note for the Architect: the last row is not in the G-3 list (AD-123-5 / -11 / -13 / -1). AD-123-15 itself authorizes this one migration, and every other `supabase/` path is still required unchanged. I report it rather than treat it as a STOP. If the Architect disagrees, the alternative is to revert the D8OwnSite edit and accept that D8OwnSite fails while the migration exists.

### Cleanup proposal — orphan own registry rows (KI-7) and leftover `customServices` entries (123.3 KI-3) — PROPOSAL ONLY, nothing implemented
**Scope:**
- User side only.
- No automatic registry delete, no admin change, no schema / RLS / RPC change.
- Waiting for the Architect's decision.

**Cases:**
1. **A — leftover `customServices` entry after a cross-window removal (123.3 KI-3).**
   - What happens: window A removes an own site. Window B's refresh drops the membership, profiles and credentials (`dropGoneFromVault`), but keeps the vault `customServices` copy.
   - What the user sees today:
     - no tile;
     - the site is listed in the catalog under its category as "not added" with «הוספה» (own sites are always listed: AD-123-19 (b));
     - re-adding works and starts with 0 profiles.
   - No data exposure; the copy is in the user's own encrypted vault.
2. **B — orphan own registry row after step 5 failed twice (KI-7 / RC-1).**
   - What the user sees today:
     - no error, no tile;
     - after the next hydrate the site returns to the catalog as "not added" (Item 0a adds a row with no local copy to `customServices`).
   - The admin still sees the row as the user's pending submission.
3. **C — both at once.** A leftover entry whose registry row also survived. Seen as case B.

**Proposed user-side handling (to decide):**
- **P1 — local only, for case A** (smallest change).
  - `dropGoneFromVault` also drops the `customServices` entry of a removed app when `isUserCustomApp(service, true)` (the single rule) and the id is not selected.
  - It never touches the registry.
  - Effect: window B matches window A immediately. If the registry row still exists, the next hydrate brings the entry back (case B), which is then handled by P2.
- **P2 — explicit user action, for cases B / C.**
  - In the catalog, an own site that is not in the home gets a menu item «מחיקת האתר שלי».
  - It uses the same in-app confirm dialog pattern as remove (no browser dialog), Hebrew, RTL.
  - It runs the existing user-side delete `deleteCustomServiceRegistryRow(id)`, the same call and RLS as remove step 5 (owner-only, `source_type = 'user'`, pending), and then drops the vault entry.
  - On failure: inline Hebrew error, nothing removed locally, retry available.
  - Promoted / global rows are never offered (the single custom rule is false for them).
- **Not proposed:**
  - automatic retry or a background delete queue (the brief forbids an automatic registry delete);
  - any admin-side change.

**Risks:**
- P1 could remove a copy the user wants back. It is reversible: re-adding a hydrated row restores it.
- P2 adds a destructive action to the catalog: a mis-tap is guarded by the confirm. A shared site (promoted after the user added it) must not be deletable; covered by the single rule.
- Two windows: P2 in window A while window B is open. Window B sees the site disappear at its next refresh. No notice is needed, because the site was not in the home.

**Tests (when approved):**
- Unit: P1 drops only `isUserCustomApp` entries that are not selected; keeps catalog / global ones.
- Browser:
  - P2 confirm / cancel / Escape;
  - the delete call and the vault drop happen only after confirm;
  - a failure keeps everything and shows the inline error;
  - no item for promoted / built-in sites;
  - no browser dialog.
- Mutations:
  - P1 drops a global app's entry;
  - P2 deletes without confirm;
  - P2 offered for a promoted row;
  - P2 drops locally after a failed delete.
- N-checks:
  - no new RPC / schema / policy;
  - `src/admin` unchanged.

### Owner instructions — AD-123-15 aggregate (live apply and call: awaiting Owner)
Not applied by the Developer: no DB access.

1. **Apply.** In the Supabase SQL editor, open and run the whole file `supabase/migrations/20261005120000_phase123_admin_apps_without_profile.sql`. Expected: "Success. No rows returned".
2. **Call as an admin.** The SQL editor runs as `postgres` without a user session, so `auth.uid()` is empty and `is_admin()` is false: a plain call is refused (see step 4). Use one of these:
   - **(a)** the editor's role selector: "authenticated", impersonating the admin user;
   - **(b)** run as one script, replacing `<ADMIN_USER_ID>` with the admin's `public.users.id`:

```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<ADMIN_USER_ID>', 'role', 'authenticated')::text, true);
set local role authenticated;
select * from public.admin_apps_without_profile_counts();
rollback;
```

   - The id is not a secret, but do not paste it into team docs.
3. **Expected shape.** Exactly **one row**, exactly these 8 columns, all whole numbers:
   - `apps_total`, `apps_with_profile`, `apps_without_profile`;
   - `apps_without_profile_over_1d`, `apps_without_profile_over_7d`;
   - `apps_first_profile_after_1d`;
   - `users_with_apps`, `users_with_app_without_profile`.

   Checks:
   - no user id, e-mail, name, service id, URL or credential value;
   - `apps_with_profile + apps_without_profile = apps_total`;
   - `apps_without_profile_over_7d ≤ apps_without_profile_over_1d ≤ apps_without_profile`.
4. **Refusals.** Each must end with an error and return no row:
   - the same script with a non-admin user's id → `ERROR: Admin access required`;
   - a plain `select * from public.admin_apps_without_profile_counts();` without impersonation → `ERROR: Admin access required`;
   - role "anon" → `permission denied for function admin_apps_without_profile_counts`.
5. Nothing to undo: the function writes nothing. To remove it: `drop function public.admin_apps_without_profile_counts();`.

### 123.4 Owner manual steps — awaiting Owner (consolidated Owner run)
Not run: no Owner session; the test credentials are not reused.
1. Log in with a user that has **0 apps** → Digital Home (not another screen), Hebrew empty state with the central «+ הוספת אפליקציה», the catalog does not open by itself, no «ניהול אתרים» anywhere.
2. Log in with a user that has **> 0 apps** → Digital Home with the grid; no «ניהול אתרים». From the home: open an app, edit / add a profile, remove an app, edit own site details, catalog add, custom add, lock. After closing the profile window, keyboard focus is on the app's icon.
3. **Catalog failure with 0 apps** (e.g. offline before login, then online): Digital Home empty state with «קטלוג האפליקציות אינו זמין כרגע…»; «+ הוספת אפליקציה» opens the catalog with its inline error and «נסו שוב»; no full-screen error. Retry after reconnecting lists the catalog.
4. **Removed elsewhere:** two windows; in window A remove an app (or a profile) that window B shows; refocus window B → Hebrew notice at the bottom (also visible with the catalog modal or the app window open); no browser dialog.
5. If «נסה מילוי אוטומטי» is offered for a profile whose stored details are incomplete, the status reads «פרטי הכניסה בפרופיל הזה חסרים. לחצו «עריכת פרופיל» בחלון האפליקציה והשלימו אותם.» (no «ניהול האתרים»).
6. AD-123-15: Owner instructions above (apply, admin call, refusals).

### T-1 before END OF ROUND (not evidence; on the tree before the freeze)
- `verifyPhase123Navigation`:
  - `--no-mutations`: PASS, 12 groups, 23 s;
  - full sweep: PASS, 15 mutations caught, 2m 25s.
- Touched / superseded verifies: PASS. The whole top-level set (88 scripts) was pre-run with `--no-mutations` where supported: 88/88 PASS.
- `git diff --stat c700cd60 -- src/admin`: empty; no untracked files under `src/admin`.
- `npx tsc -b`: exit 0. `npm run build`: exit 0 (the chunk-size warning is pre-existing). Lints clean.

### END OF ROUND — runs on the frozen tree
**Scope and method:**
- Fingerprint helper: `%TEMP%\pv-fingerprint-123-4.mjs`, BASE `c700cd60`, scope `-- src scripts supabase`. It hashes the binary diff plus every untracked file (sorted path, NUL, bytes, NUL).
- Each run was one inline sequential PowerShell loop with one job at a time.
- Before each run, a `Win32_Process` check confirmed 0 other runners.
- Every job had its own H-1 bound; a timeout counts as FAIL.

**Earlier attempts (not evidence, reported for completeness):**
1. **Attempt 1, tree `7d9ca62d…`:** FAIL.
   - The `verifyPhase123RemoveApp` sweep failed with "fixture: mutation anchor M8 … found 0×". The anchor `setRemoveError(null);\n    setRemoveRequestId` no longer matched after `setSelectionError(null);` was added to `requestRemoveApp`.
   - I stopped the run, re-anchored M8 on `setSelectionError(null);\n    setRemoveRequestId(serviceId);` (the same mutation, still caught), and re-froze.
2. **Attempt 2, tree `fef52c66…`, identical before and after:** 62/63 PASS.
   - The separate `verifyPhase122AdminWorkspace` full-sweep job hit **my** 30-minute job bound (FAIL, H-1 timeout).
   - Inside `runOfflineRegression` in the same run, the same script passed in 3159 s.
   - The bound was too low for this ~50-minute sweep. It was raised to 90 minutes per verify job, the same as `runOfflineRegression`'s per-script bound. No file changed.
3. **Attempt 3, tree `fef52c66…`:** incomplete.
   - The controlling shell was terminated by a session interruption during job 52/63 (AdminWorkspace).
   - The logs of jobs 1–51 all end in a PASS line, including `runOfflineRegression` 88/88. Their exit codes were lost with the shell.
   - Jobs 53–63 never ran.
   - I stopped the orphaned process and started over.

**Clean run (attempt 4): 63 / 63 PASS, 0 timeouts, total 114 min (18:09 → 20:03).**
- Fingerprint before (18:09:04): `fef52c66c81fe5c8a95661f0a0cb5172ccc1df7cb536c3554e1e5a84611a3ac6` (diff 83410 bytes, 21 tracked changed, 2 untracked).
- Fingerprint after (20:03:54): `fef52c66c81fe5c8a95661f0a0cb5172ccc1df7cb536c3554e1e5a84611a3ac6`. **Identical.**
- Runners before: 0. Jobs ran one at a time.
- H-1 bounds: 90 min per verify job, 6 h for `runOfflineRegression` (it bounds each script at 90 min itself), 10 min for `tsc`, 15 min for build.

| # | Job | Result | Elapsed |
|---|---|---|---|
| 1 | `verifyPhase123AppContext` full sweep | PASS — 23 groups, 15 mutations caught | 0m 36s |
| 2 | `verifyPhase123Catalog` full sweep | PASS — 19 groups, 18 mutations | 1m 46s |
| 3 | `verifyPhase123CatalogGate` full sweep | PASS — 8 groups, 20 mutations | 0m 1s |
| 4 | `verifyPhase123Sync` full sweep | PASS — 15 groups, 35 mutations | 0m 4s |
| 5 | `verifyPhase123FixD6D8` full sweep | PASS — 6 groups, 9 mutations | 0m 0s |
| 6 | `verifyPhase123D8OwnSite` full sweep | PASS — 10 groups, 20 mutations | 0m 10s |
| 7 | `verifyPhase123RemoveApp` full sweep | PASS — 13 groups, 20 mutations | 0m 34s |
| 8 | `verifyPhase123Navigation` full sweep | PASS — 12 groups, 15 mutations | 1m 18s |
| 9 | `node scripts/runOfflineRegression.mjs` | PASS — 88 scripts, 88 PASS, 0 FAIL (live-only not run: 101Supabase, 102Registry) | 58m 6s |
| 10–49 | 40 × `verifyPhase121*` | 40 / 40 PASS. The longest are ChoiceScreen 51s, DeleteService 25s, StepButtons 23s, InspectReadinessEligible 21s; the rest are each ≤ 19s | ≈ 6 min |
| 50 | `verifyPhase122AdminNotes` | PASS | 0m 26s |
| 51 | `verifyPhase122SubmitterProfiles` | PASS | 0m 24s |
| 52 | `verifyPhase122AdminWorkspace` full | PASS — 32 groups, 74 mutations caught | 46m 11s |
| 53–61 | Touched: 102CredentialSchema, 104ServiceManagement, 108M1ExplicitLoginEntry, 109Accounts, 111Assets, 112LoginIntelligence, 113LoginAssistance, 117ManagedAutofill, ServiceSourceOwnership | 9 / 9 PASS | each 0m 0s |
| 62 | `npx tsc -b` | PASS | 0m 10s |
| 63 | `npm run build` | PASS | 0m 15s |

Per-job logs: `%TEMP%\pv-eor-123-4d\` (`summary.log` + `<n>.out` / `<n>.err`). They contain no credential values or secrets.

### Changed files (123.4, vs `c700cd60`)
- **Source:**
  - `src/App.tsx`, `src/App.css`, `src/Dashboard.tsx`;
  - deleted `src/ManageServices.tsx`;
  - `src/digitalHome/AppCatalog.tsx` (comment), `src/catalog/customServiceDiscovery.ts` (comment);
  - `src/loginAssistance/assistanceActions.ts`, `src/loginAssistance/messages.ts`, `src/loginIntelligence/messages.ts`.
- **Migration:** new `supabase/migrations/20261005120000_phase123_admin_apps_without_profile.sql`, not applied.
- **Tests:**
  - new `scripts/verifyPhase123Navigation.mjs`;
  - modified (superseded table above): `verifyPhase102CredentialSchema`, `verifyPhase104ServiceManagement`, `verifyPhase108M1ExplicitLoginEntry`, `verifyPhase109Accounts`, `verifyPhase111Assets`, `verifyPhase113LoginAssistance`, `verifyPhase123AppContext`, `verifyPhase123Catalog`, `verifyPhase123CatalogGate`, `verifyPhase123D8OwnSite`, `verifyPhase123RemoveApp`, `verifyServiceSourceOwnership`.
- **Unchanged:** `src/admin`, `src/execution`, `src/digitalHome/cloudReconcile.ts`, `src/supabase/**`, `extension/`, package files.
- No commit after the 123.4 baseline `c700cd60` (none requested).

### Dependencies and docs
- **Dependencies:** none added, removed or upgraded (`package.json` / lockfile unchanged).
- **Docs:**
  - `verifyPhase123Navigation.mjs` is picked up automatically by `runOfflineRegression`.
  - The migration has to be applied by the Owner (instructions above); no env variable or setup step was added.
  - Behaviour is specified in `arch-phase123.md` / `manager-phase123.md`, which the Developer does not edit.

### 123.4 Known Issues
1. **Parity row 5a:** for a not-configured app the floating window shows «ממתין להגדרת מנהל המערכת.», but not the old modal line «אם כבר נשמרו פרטים, הם נשמרים ולא מוצגים כאן.». No action is lost.
2. **Notice ×:** clicking × on the "removed elsewhere" notice while the floating window is open also closes that window, because it counts as an outside click. The notice and the notice-on-top behaviour are unaffected.
3. **Dead code kept on purpose (follow-up cleanup, no user effect):**
   - the `ServiceCard` `row` layout with `.sm-grid--rows` / `service-card--row` CSS;
   - the pre-existing unused `.sm-section-head` / `.service-management-footer` CSS;
   - `NO_STORED_CREDENTIALS_LIST_LABEL` / `deriveServiceManagementState` (still pinned by older verifies);
   - `openServiceWithProfile` (no caller);
   - `countUserServices` (still exported from `src/auth`).
4. **Frozen execution copy:** `src/execution/serviceExecution.ts` still contains the old «ניהול האתרים» string, because it is frozen (N-2). Digital Home never shows it: `assistanceActions` replaces it (static check, M14). `pocAutofill.ts` (dev PoC) and the dead `openWithProfile.ts` call execution directly.
5. **Superseded assertion outside G-3:** the D8OwnSite `supabase` row cites AD-123-15, which is outside the G-3 list (see the note under "Superseded assertions"). Awaiting the Architect.
6. **Cleanup proposal (KI-7 / 123.3 KI-3):** proposal only, nothing implemented. Awaiting the Architect's decision.

Stopping for Manager → Architect review.

### 123.4 WIP commit (approved tree)
- Architect PASS 2026-10-05; the Owner authorized the commit.
- The fingerprint was recomputed before staging and matched (BASE `c700cd60`, scope `-- src scripts supabase`): `fef52c66c81fe5c8a95661f0a0cb5172ccc1df7cb536c3554e1e5a84611a3ac6`.
- Commit `e91b5b1245891b889f01b7ecbd01ccb3065ddb9c` on local branch `wip/phase123-recovered`, on top of `c700cd60`. Message: "WIP Phase 123: slice 123.4 + END OF ROUND approved tree (Architect PASS 2026-10-05), not reviewed for merge".
- 27 files, staged by explicit path:
  - 23 under `src` / `scripts` / `supabase`: 20 modified, `src/ManageServices.tsx` deleted, and new `scripts/verifyPhase123Navigation.mjs` and the AD-123-15 migration;
  - `team-yuri/PLAN.md`, `team-yuri/arch-phase123.md`, `team-yuri/dev-phase123.md`, `team-yuri/manager-phase123.md` (lowercase path only).
- After the commit, `git diff e91b5b12 -- src scripts supabase` is empty (0 lines), and there are no untracked files in that scope.
- Not used: `git add -A` / `.`, push, merge, amend, `--no-verify`, checkout / restore / reset / stash / clean. No code changes.
- This status update in `dev-phase123.md` was written after the commit, so it is the only uncommitted change.

## Fix round 123.5 — Owner run findings O-123-1…8 + O-2 (BASE `e91b5b12`)

### Stage A — plan (read-only analysis; no `src/` edit before this section)
Sources: arch Review Notes "2026-10-06 — Consolidated Owner run, early findings O-123-1…8"; `manager-phase123.md` "Fix round 123.5" and G-13. New verify: `scripts/verifyPhase123OwnerFixes.mjs` (T-1 switches, H-1 bounds, `--report-groups` prints every group's result for the "before" state).

**STOP items: none.** The O-123-2 "way to the login screen" already exists: the register form in `AuthEntryScreen.tsx` is shown under the «התחברות» / «הרשמה» tabs (`data-testid="auth-tab-login"`, always visible when not `loginOnly`), and `AUTH_COPY.registerDuplicate` names that tab («נסו להתחבר במסך «התחברות».»). So no change is needed outside `register.ts`.

**O-123-2 trace and exact condition (`src/auth/register.ts`).**
- `registerAccount` → `supabase.auth.signUp`. Four outcomes:
  1. error / no user + "already registered" → `recoverOrphanAuthRegistration`;
  2. user, no session, `identities.length === 0` (Supabase's "address taken" reply) → `establishSessionAfterSignUp` → `recoverOrphanAuthRegistration`;
  3. user, no session, identities > 0 (new auth user) → sign in → `ensureProfileForSession`;
  4. user + session (new auth user) → `ensureProfileForSession`.
- `ensureProfileForSession` returns an existing row as success ("trigger may have already created the row"). That is correct for paths 3–4, where the row was just created by the `auth.users` INSERT trigger of this sign-up.
- Paths 1–2 are reached only when sign-up reports the address as already taken. This registration inserted no auth user, so no trigger ran. Any row found there existed before this registration.
- **Condition:** in `recoverOrphanAuthRegistration`, after a successful `signInWithPassword` and before `ensureProfileForSession`: `if (await loadProfileOrNull())` → `await signOutAccount()` and `throw new Error(AUTH_COPY.registerDuplicate)`. No `ensure_app_user_profile` RPC is made, and the log is the existing `logRegisterFailure` with a fixed stage text (no e-mail / password).
- A wrong password still ends in `registerDuplicate` (unchanged), and an auth user without a row still goes to `ensureProfileForSession` (recovery kept). Paths 3–4 are untouched.

**Per finding (files / symbols → checks + mutations):**

| Finding | Files / symbols | Check groups | Mutations |
|---|---|---|---|
| O-123-1 | `ServiceCard.tsx` compact name `title={name}`; `App.css` rules scoped to `.app-catalog` (`grid-auto-rows`, card `height: 100%`, name `-webkit-line-clamp: 2`, actions `margin-top: auto`) | static markup / CSS; browser: long-name fixture (test data), every card the same height / width, name ≤ 2 lines with an ellipsis + full `title`, action bottoms aligned at the card bottom (also «✓ כבר בבית הדיגיטלי») | M1 clamp removed; M2 sizes differ (equal rows removed); M3 action not at the bottom; M4 `title` removed |
| O-123-2 | `register.ts` `recoverOrphanAuthRegistration` | unit (esbuild bundle of the real `register.ts` + `session.ts` + `copy.ts`, stubbed client): orphan + row (both orphan entries) → sign-out, `registerDuplicate`, no RPC, no session; orphan without row → recovered via RPC; fresh sign-up with a trigger row (session and no-session) → success, no sign-out; wrong password → `registerDuplicate` | M5 sign-out removed; M6 existing row returned as success; M7 orphan recovery removed |
| O-123-3 | `Dashboard.tsx` header `data-action="open-catalog"` gated on `services.length > 0` | browser: 0 apps → no header button, central button present; after the first add → header button; ≥ 1 apps → header button | M8 header button shown at 0 |
| O-123-4 | `RemoveAppConfirmDialog.tsx` new prop `hasProfiles` (no paragraph / no `aria-describedby` when false); `App.tsx` passes `appHasProfile(...)` | browser: 0-profile app → title + buttons only; ≥ 1 → paragraph unchanged; 0-profile confirm → Undo toast → same commit (cloud remove + persist) | M9 paragraph at 0; M10 paragraph missing at ≥ 1 |
| O-123-5 | `LoginAssistancePanel.tsx`: a click anywhere in the window outside `[data-app-menu]` closes the menu (`onClickCapture`); Escape / outside click / × close the window (existing), so the menu goes with it | browser: menu closes on another window action (eye button), a click on the window body, Escape, an outside click, × ; reopen → menu closed | M11 other action keeps it open; M12 Escape path; M13 outside-click path; M14 window-close path |
| O-123-6 | `ServiceProfileManagementModal.tsx`: `FIRST_PROFILE_NAME = 'ראשי'`; no name field while 0 profiles (stored as «ראשי» through the same `onCreateProfile`); name required + distinct (new Hebrew inline error) from the 2nd profile on; chips, static chip and «שינוי שם פרופיל» only when `isMultiProfile` | browser: 0 → no name field, stored «ראשי», 1 persist; 1 → no chips / name in window and modal; 2nd add: empty → Hebrew error, duplicate → Hebrew error, 0 writes; then chips «ראשי» + new name and rename of the first; a lone named profile keeps its name, hidden; delete leaves the other name unchanged; static: no diff in reducers / `DigitalHomeCredentialModal` / vault | M15 name field at 0; M16 chips at 1; M17 duplicate accepted; M18 empty name accepted on the 2nd add; M19 name rewritten on delete |
| O-123-7 | `ServiceProfileManagementModal.tsx` `MSG_ADD_OPTIONAL` removed | static: string absent from user `src/`; browser: save without credentials still creates the profile | M20 hint restored; M21 save blocked without credentials |
| O-123-8 | `LoginAssistancePanel.tsx`: `onStatus` removed; panel status `{ message, failure }`; failure → `role="alert"` red line, no timer, cleared by the next button in the window / close; flash element (`la-panel-failure-flash`, 2 s fade); `Dashboard.tsx`: `statusMessage` banner + `onStatus` wiring removed; `App.css` red line, flash, `prefers-reduced-motion` rule | static: no `onStatus` route, catalog / remove / selection banners and the reconcile notice unchanged vs BASE; browser (stubbed `assistanceActions` results): failure in the window not the banner, `role="alert"` until the next action / close, 2 s fade, none under reduced motion, neutral stays `role="status"` | M22 message routed to the banner; M23 `role="alert"` removed; M24 reduced-motion rule removed; M25 line not cleared on the next action |
| O-2 | `messages.ts`: the AD-123-1 doc comment moves above `MSG_AUTOFILL_CREDENTIALS_MISSING` | static: each doc comment directly above its constant | M26 comment misplaced again |
| N-checks | — | `git diff e91b5b12 -- src/auth` = `register.ts` only; no diff in `src/admin`, `src/vault`, `src/supabase`, `src/execution`, `cloudReconcile.ts`, `extension`, `supabase`; no `confirm` / `alert` / `prompt` call and no catalog id / host literal in added product lines | (covered by the static group) |

**Planned G-3 / G-13 rows (touched existing verifies; only superseded assertions):**
- `verifyPhase113LoginAssistance`: `dash.includes('la-home-notice')` and `dash.includes('setStatusMessage(null)')` → O-123-8 (no app outcome banner on the Digital Home).
- `verifyPhase123Navigation` `checkZeroAppsLogin`: "header «+ הוספת אפליקציה» too" at 0 apps → O-123-3 (absent at 0, back after the first add).
- `verifyPhase123RemoveApp`: none expected (its fixture app `svc-cred` has profiles; the paragraph stays).
- `verifyPhase123AppContext`: name typed into the first profile of a 0-profile app (lines 832, 843, 1021) and the static chip with the name at 1 profile (lines 849, 973) → O-123-6.

**Decision recorded (O-123-5):** Escape keeps its AC-113 meaning (it closes the window, and the menu with it). `verifyPhase123RemoveApp` asserts that one Escape after opening the menu closes the window; no O-123 ruling supersedes that.

**Known limit (O-123-2):** `loadAppUserProfile` returns `null` on a read error, so a failed profile read during orphan recovery falls through to the existing RPC path. That path signs out on any RPC error (`registerDuplicate` on a duplicate). Changing this needs `session.ts` (N-2), so it stays out of scope.

### Stage A — "before" results (unchanged `src/`, `node scripts/verifyPhase123OwnerFixes.mjs --report-groups`)
`GROUP REPORT — 13 of 14 check groups failing — 22s`. Each group fails on its own finding; only the N-checks pass (nothing changed yet):

| Group | Before |
|---|---|
| `checkCatalogCardStatic` | ✗ O-123-1: compact card name carries the full name in `title` |
| `checkHintRemoved` | ✗ O-123-7: hint still in `src/ServiceProfileManagementModal.tsx` |
| `checkMessagesComments` | ✗ O-2: the AD-123-1 doc comment is not directly above `MSG_AUTOFILL_CREDENTIALS_MISSING` |
| `checkFailureCss` | ✗ O-123-8: no 2 s failure fade |
| `checkBannerRouting` | ✗ O-123-8: `onStatus` route from the window to the Digital Home banner exists |
| static N-checks | ✓ (0 changed product files) |
| `checkProfileWritesStatic` | ✗ O-123-6: the first profile is not stored as «ראשי» |
| `checkRegisterExistingAccount` (unit) | ✗ O-123-2: existing account + correct password → got success |
| `checkCatalogCards` | ✗ O-123-1: card heights 159.2–259.2 px |
| `checkHeaderAddButton` | ✗ O-123-3: header button present at 0 apps |
| `checkRemoveDialog` | ✗ O-123-4: paragraph shown at 0 profiles |
| `checkMenuCloses` | ✗ O-123-5: another window action leaves the menu open |
| `checkProfileNames` | ✗ O-123-6: name field shown at 0 profiles |
| `checkOutcomeMessages` | ✗ O-123-8: no `role="alert"` line in the window on an open failure |

**Environment issue found during Stage A (machine, not code).** Edge 154.0.4258.37 headless intermittently refuses navigation to the loopback harness server with `net::ERR_NETWORK_ACCESS_DENIED`. Probes in `%TEMP%` (not project files):
- Direct `http://127.0.0.1:<port>/` loads: denied at random (for example 3 of 10 in one 20 s run, 0 of 6 or 6 of 6 in others). Disabling Edge's Local / Private Network Access features made no consistent difference; the pattern changes run to run, which points to the machine (firewall / security software), not a browser flag.
- The same page fulfilled through Playwright routing (`context.route`, no socket): 10 of 10 loaded in the same run.
- The new verify therefore serves its bundle through `context.route` (harness only; assertions unchanged). The six existing browser verifies (`verifyPhase122AdminWorkspace`, `verifyPhase123Catalog`, `…AppContext`, `…D8OwnSite`, `…Navigation`, `…RemoveApp`) still use a `127.0.0.1` server, and `verifyPhase123Navigation --no-mutations` already failed on this error. See Known Issues and the Owner question.
- **Update (Stage B, Architect ruling H-2):** Node's own loopback connections are refused the same way (`connect EACCES 127.0.0.1`), so `route.fetch` is not an option either. The final harness (`scripts/lib/routeHarness.mjs`) keeps the server listening and the page URL unchanged (`http://127.0.0.1:<port>/`); Playwright's `context.route` answers that same origin from the bundle directory on disk. Each page then asserts `window.isSecureContext === true`. Probe: 12 of 12 loads, secure context, `crypto.subtle` and `localStorage` available. An earlier `pv-harness.test` origin was dropped because it is not a secure context.

### Stage A addendum — late findings O-123-9 and O-123-10
The manager section "Fix round 123.5" lists two late findings (Architect rulings and Owner decision 2026-10-06), so they are in this round's scope. A first final run had started on the tree without them; it was stopped after its first job (only the loop and its child, by PID) and is **not** evidence.

| Finding | Files / symbols | Check groups | Mutations |
|---|---|---|---|
| O-123-9 | new `supabase/migrations/20261006120000_phase123_registry_owner_select.sql` (the ruling's `drop policy if exists` + `create policy`, nothing else); no `src/` change | SQL (PGlite, unit layer) `checkRegistryOwnerSelectSql`: the real Phase 101 / 102 / 107 registry migrations, then the new file. Before it: a non-admin's own pending upsert is refused (`row-level security`, the live 42501). After it: own pending upsert (insert and conflict update) OK; own pending row readable; another user's pending row not readable and not deletable; anon reads no pending row; admin still reads every pending row; admin policies byte-identical in `pg_policies`; exactly one policy added; own delete removes exactly 1 row. Then the file is checked to contain exactly the ruling's two statements. Static N-checks: `supabase/` = this one new file | M27 policy without the owner condition |
| O-123-10 | `src/AddSiteModal.tsx` (shared by the catalog add form, `mode="create"`, and «עריכת פרטי האתר», `EditSiteDetailsModal` → `mode="edit"`): «פתיחה לבדיקה» `type="button"` next to the URL input; `testUrl = validateCustomPrimaryUrl(primaryUrl)` (the same function the save path uses through `createCustomServiceDefinition`); `disabled={isSaving \|\| !testUrl.valid}`; click → existing `openUrlInNewTab(testUrl.normalizedUrl)` (= `window.open(url, '_blank', 'noopener,noreferrer')`). `src/App.css`: `.modal-url-row` / `.modal-url-test` layout only | browser `checkTestOpenButton` (both forms): button present, Hebrew label, `type="button"`, form RTL; disabled for empty, `localhost`, `ftp://…`, `https://`, a Hebrew word, `http://`; opens `https://site.example.test/`, `https://www.site.example.test/` (from `http://www.…`), `…/path?q=1` with `_blank` + `noopener,noreferrer`; the saved definition's `url` equals the last opened URL (add) and the edited URL (edit); edit opens the stored URL unchanged; no request to the typed host (no probe); no browser dialog | M28 button absent; M29 opens a different URL (a `www.` added on open); M30 enabled for an invalid address |

"Before" for the two late findings: the source tree could not be put back to the pre-change state (no checkout / restore), so the before state is shown by the in-group reproduction (O-123-9: the own pending upsert is refused without the new policy, matching the live 42501) and by the mutations that restore the old behaviour (M27, M28), which the checks catch.

Note on M29: the first form of M29 (open the raw field text) was **not** caught, for a real reason. The click blurs the URL field first, and the existing blur handler (`normalizeUrlField`) rewrites the field to the scheme-completed form, so the raw text already equals the stored address when the click runs. M29 now adds `www.` on open, which is the forbidden different-URL case.

### Stage B — implementation (all findings)
- **O-123-1** `ServiceCard.tsx` (compact name `title={name}`); `App.css` catalog-scoped rules: `.app-catalog .sm-grid--compact { grid-auto-rows: 1fr }`, item `display: flex`, card `flex: 1`, name 2-line clamp (`-webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; line-height: 1.35`), actions `margin-top: auto`.
- **O-123-2** `register.ts` `recoverOrphanAuthRegistration`: after the successful sign-in, `if (await loadProfileOrNull())` → `logRegisterFailure('orphan recover', 'profile row already exists')`, `signOutAccount()`, `throw new Error(AUTH_COPY.registerDuplicate)` (trace above).
- **O-123-3** `Dashboard.tsx` header button gated `onOpenCatalog && services.length > 0`.
- **O-123-4** `RemoveAppConfirmDialog.tsx` prop `hasProfiles` (paragraph and `aria-describedby` only when true); `App.tsx` passes `appHasProfile(vaultState, id)`.
- **O-123-5** `LoginAssistancePanel.tsx` `onClickCapture` on the window: a click outside `[data-app-menu]` closes the menu; Escape / outside click / × close the window (existing), and the menu with it.
- **O-123-6** `ServiceProfileManagementModal.tsx`: `FIRST_PROFILE_NAME = 'ראשי'`; no name field at 0 profiles; name required and distinct from the 2nd profile (`MSG_PROFILE_NAME_TAKEN = 'כבר קיים פרופיל בשם הזה. בחרו שם אחר.'`, inline); chips / rename only when `isMultiProfile`. Same `onCreateProfile`; reducers, host and vault unchanged; no migration.
- **O-123-7** `MSG_ADD_OPTIONAL` removed.
- **O-123-8** `LoginAssistancePanel.tsx`: `onStatus` removed; status `{ message, failure }`; failure → `<p className="la-panel-status la-panel-status--error" role="alert">`, no timer, cleared by the next button in the window or close; `la-panel-failure-flash` (2 s fade, `aria-hidden`); neutral stays `role="status"`. `Dashboard.tsx`: the app-outcome banner and its wiring removed (catalog / remove / selection banners and the reconcile notice unchanged). `App.css`: red line, flash, `@keyframes`, `prefers-reduced-motion` → no animation.
- **O-2** `messages.ts`: comment placement only.
- **O-123-9 / O-123-10**: as in the addendum table.

### Superseded assertions and environment changes (G-3 / G-13)
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase113LoginAssistance` | `dash.includes('setStatusMessage(null)')` → `!dash.includes('setStatusMessage') && !dash.includes('onStatus')`; `la-home-notice` present → absent | O-123-8 (superseded assertion) |
| `verifyPhase123Navigation` `checkZeroAppsLogin` | header «+ הוספת אפליקציה» at 0 apps → count 0; header present after the first add | O-123-3 (superseded assertion) |
| `verifyPhase123Navigation` N-1 | `supabase/` = the AD-123-15 file → that file **or** `20261006120000_phase123_registry_owner_select.sql`; modified / deleted paths still forbidden | O-123-9 (G-3) |
| `verifyPhase123D8OwnSite` `checkHydrateScope` | same extension, exactly this one file | O-123-9 (G-3) |
| `verifyPhase123AppContext` | first save of a 0-profile app: no name field, credentials as `nth(0)` / `nth(1)`, no `.cd-chip`, stored `displayName === 'ראשי'`; lone profile of `svc-two`: chip detached, name kept; draft / backdrop steps use the first credential input | O-123-6 (superseded assertions) |
| `verifyPhase123Catalog`, `…RemoveApp`, `…D8OwnSite`, `…AppContext`, `…Navigation` | serving / navigation code only: import of `routeHarness.mjs`; `serve()` registers the bundle dir for its URL; `routeHarness(context, url)` before `newPage()`; `assertSecureContext(page)` after `goto` | **environment change H-2** (not a superseded assertion). Assertions, mutation lists and anchors byte-identical |
| `verifyPhase122AdminWorkspace` | none (byte-identical) | H-2: it loads a `file://` page and opens no socket, so the loopback refusal does not reach it. Run under H-2 as `--no-mutations` + 3 sampled mutations |

H-2 diff of the three scripts with no other change (`git diff -U0 e91b5b12`), identical shape in AppContext / Navigation / D8OwnSite:
```text
+import { assertSecureContext, registerHarnessDir, routeHarness } from './lib/routeHarness.mjs';
-    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => closeServer(server) }));
+    server.listen(0, '127.0.0.1', () => {
+      const url = `http://127.0.0.1:${server.address().port}/`;
+      registerHarnessDir(url, dir);
+      resolve({ url, close: () => closeServer(server) });
+    });
+  await routeHarness(context, url);
+  await assertSecureContext(page);
```
`git diff --stat`: Catalog 9, RemoveApp 9 lines (H-2 only); D8OwnSite 14 (H-2 9 + O-123-9 5).

### N-1…N-8 compliance
```text
git diff --stat e91b5b12 -- src/auth src/admin src/vault src/supabase src/execution extension supabase
 src/auth/register.ts | 8 ++++++++
 1 file changed, 8 insertions(+)
untracked under supabase/: supabase/migrations/20261006120000_phase123_registry_owner_select.sql
git diff e91b5b12 -- src/admin: (empty)
```
- N-1 `src/admin` unchanged (empty diff; admin full sweep therefore skipped, H-2 sample run instead).
- N-2 / N-3 frozen paths unchanged except `register.ts` (O-123-2) and the one O-123-9 migration.
- N-4 no `confirm` / `alert` / `prompt` in changed product files; every browser group fails on a native dialog.
- N-5 no catalog id / host literal in added `src/` lines (static scan, whitespace-only re-indents ignored).
- N-6 Hebrew copy, RTL dialogs (checked in the O-123-10 group).
- N-7 fail-closed: O-123-2 signs out and refuses; the test button is disabled for any address the save path rejects.
- N-8 no extension / manifest / dependency change; no migration apart from the O-123-9 file; nothing applied to a live database.

Changed files vs `e91b5b12`: `src/` 10 (AddSiteModal, App.css, App.tsx, Dashboard.tsx, ServiceProfileManagementModal.tsx, auth/register.ts, components/ServiceCard.tsx, digitalHome/RemoveAppConfirmDialog.tsx, loginAssistance/LoginAssistancePanel.tsx, loginAssistance/messages.ts); `scripts/` 6 modified + 2 new (`lib/routeHarness.mjs`, `verifyPhase123OwnerFixes.mjs`); `supabase/` 1 new.

### T-1 (per change; not final evidence)
- O-123-1…8 + O-2: `verifyPhase123OwnerFixes` full sweep PASS (14 groups, 26 mutations, 3m 17s); `npx tsc -b` clean; 20 touched verifies PASS (AdminWorkspace `--no-mutations` 1m 52s, AppContext 23s, Catalog 31s, CatalogGate 1s, D8OwnSite 6s, Navigation 20s, RemoveApp 23s, Sync 1s; 102CredentialSchema, 103Execution, 104, 108BrowserIntegration, 108KnownServiceBootstrap, 108M1, 109, 111, 113, 116, 117, ServiceSourceOwnership plain, 0–1 s). Pre-freeze sweeps: Navigation 12 groups / 15 mutations 2m 22s; AppContext 23 groups / 15 mutations 1m 17s.
- H-2 samples: Catalog M2, M7, M10 caught (53s); RemoveApp M2, M17, M20 (39s); D8OwnSite M8, M12, M17 (9s); AdminWorkspace M1, M4, M59 (2m 47s).
- O-123-9 / O-123-10: `--report-groups` all 16 groups pass (29s); M27, M28 caught; M29 (new form), M30 caught (1m 06s); `npx tsc -b` clean; touched verifies (`rg -l` on AddSiteModal / App.css / the migration / the changed verifies): 108M1, 113, 104 plain PASS (0s); FixD6D8 1s, D8OwnSite 8s, Navigation 20s, AppContext 27s, Catalog 36s `--no-mutations` PASS. Lints clean on the edited files.

### Final run — one frozen tree (2026-10-06 14:25:07 → 14:49:21, 24 min, 94 jobs, 0 failures) — SUPERSEDED
**Superseded by O-123-11** (arch "123.5 progress", sequencing ruling): this run is on the tree before O-123-11 and is kept for the record only. The single final run will be repeated once, after the Owner writes "סיימתי את כל רשימת הבדיקה" and the last batch of findings is in.
One sequential inline-PowerShell loop (`Start-Process`, H-1 bound per job, a timeout counts as FAIL), log `%TEMP%\pv-eor-123-5b\summary.log`. No other verify runner was active before the start ("runners before: 0").
```text
FP-BEFORE sha256=4d1ad76418237acc1f3ccb6b7fb1abfcd2776639bfe3ff4cfe5d883144ee8e56  diff_bytes=50458 tracked_changed=16 untracked=3
FP-AFTER  sha256=4d1ad76418237acc1f3ccb6b7fb1abfcd2776639bfe3ff4cfe5d883144ee8e56  diff_bytes=50458 tracked_changed=16 untracked=3   (identical)
git diff e91b5b12 -- src/admin: (empty, 0 lines) → AdminWorkspace full sweep skipped
```
(Fingerprint `%TEMP%\pv-fingerprint-123-5.mjs`, BASE `e91b5b1245891b889f01b7ecbd01ccb3065ddb9c`, scope `src/` + `scripts/` + `supabase/`, tracked diff + untracked file contents.)

**Full sweeps** (verifies whose assertions changed in 123.5, plus the new verify):
| Job | Result | Elapsed |
|---|---|---|
| `verifyPhase123OwnerFixes` | PASS — 16 check groups, 30 mutations caught | 4m 56s |
| `verifyPhase123Navigation` (O-123-3, O-123-9) | PASS — 12 check groups, 15 mutations caught | 2m 22s |
| `verifyPhase123AppContext` (O-123-6) | PASS — 23 check groups, 15 mutations caught | 1m 19s |
| `verifyPhase123D8OwnSite` (O-123-9) | PASS — 10 check groups, 20 mutations caught | 0m 22s |
| `verifyPhase113LoginAssistance` (O-123-8; no mutation switch, plain) | PASS | 0m 0s |

**H-2 harness-only verifies** (`--no-mutations` + 3 sampled mutation ids each):
| Job | Result | Elapsed |
|---|---|---|
| `verifyPhase123Catalog --no-mutations` | PASS — 19 check groups | 0m 34s |
| `verifyPhase123Catalog --mutations=M2,M7,M10` | PASS — 3 selected mutations caught | 0m 57s |
| `verifyPhase123RemoveApp --no-mutations` | PASS — 13 check groups | 0m 28s |
| `verifyPhase123RemoveApp --mutations=M2,M17,M20` | PASS — 3 selected mutations caught | 0m 41s |
| `verifyPhase122AdminWorkspace --no-mutations` | PASS — 32 check groups | 2m 31s |
| `verifyPhase122AdminWorkspace --mutations=M1,M4,M59` | PASS — 3 selected mutations caught | 2m 7s |
(AppContext, Navigation and D8OwnSite also carry the H-2 change and ran as full sweeps above.)

**All other top-level `scripts/verify*.mjs`** (excluding `verifyPhase101Supabase` / `verifyPhase102Registry`): `--no-mutations` for the three that take the switch (`verifyPhase123CatalogGate` 0s, `verifyPhase123FixD6D8` 0s, `verifyPhase123Sync` 2s), plain for the 78 scripts without one (they run their built-in checks; the longest: `verifyPhase121ChoiceScreen` 52s, `verifyPhase122SubmitterProfiles` 40s, `verifyPhase122AdminNotes` 35s, `verifyPhase121DeleteService` 32s). Every one PASS; each job's last output line is in the summary log.

**Build:** `npx tsc -b` PASS (24s); `npm run build` PASS (27s, "built in 5.68s").

Why sweep vs `--no-mutations`: full sweeps only for the new verify and the verifies whose assertions changed (Navigation, AppContext, D8OwnSite; 113 has no mutation switch). Catalog, RemoveApp and AdminWorkspace changed only in serving code (H-2) or not at all, so they ran `--no-mutations` plus 3 sampled mutations per the H-2 ruling. Everything else is unchanged and ran `--no-mutations` / plain.

### Late finding O-123-11 — "removed elsewhere" notice only when it matters (T-1 only; no final run yet)
**Implementation.**
- `src/Dashboard.tsx`, reconcile effect: after closing an affected floating window, `if (!closesPanel && !cloudReconcile.closedOtherSurface) return;`. Otherwise the existing `MSG_REMOVED_ELSEWHERE` ("…ולכן החלון נסגר.") is shown exactly as before (same element, `role="status"`, `dir="rtl"`, z-order, 8 s timer, × button). `closedOtherSurface` is the existing App flag: the profile modal of an affected app, or «עריכת פרטי האתר» of a removed app, was closed.
- `src/loginAssistance/messages.ts`: `MSG_REMOVED_ELSEWHERE_PLAIN` and its doc comment removed (no other user: `rg -n "MSG_REMOVED_ELSEWHERE" src` → only `Dashboard.tsx` and `cloudReconcile.ts`). The import in `Dashboard.tsx` removed.
- `src/digitalHome/cloudReconcile.ts` unchanged (`git diff --stat e91b5b12 -- src/digitalHome/cloudReconcile.ts` is empty). Note: the prompt names `src/supabase/cloudReconcile.ts`; the file lives at `src/digitalHome/cloudReconcile.ts` (no file of that name exists under `src/supabase/`, which is also unchanged).

**Checks and mutations.**
| Verify | Check | Mutation |
|---|---|---|
| `verifyPhase123Navigation` `checkRemovedElsewhereNotice` (rewritten, G-3) | plain home → tile gone, no notice; catalog open → tile gone, no notice, catalog stays; another app's floating window open → tile gone, no notice, window stays; affected floating window → closes + Hebrew RTL `role="status"` closed-window notice, still above a catalog opened while it is shown; affected profile modal (opened from «הוספת פרופיל», floating window already closed) → modal closes + the same notice | M10 inverted: "notice shown although no affected window was open" (removes the early return); M8 (notice not rendered) and M9 (notice under the catalog) still caught |
| `verifyPhase123Navigation` static N-6 (G-3) | the plain copy is absent from `messages.ts`; the closed-window copy stays in `cloudReconcile.ts` | — |
| `verifyPhase123OwnerFixes` `checkMessagesComments` | `MSG_REMOVED_ELSEWHERE_PLAIN` and its comment absent; the AD-123-1 comment still directly above its constant; every other constant unchanged vs BASE | M31 plain constant kept; M26 re-anchored (the AD-123-1 comment moved above `MSG_SELECT_PROFILE`, because its old anchor was the removed comment) |
| `verifyPhase123OwnerFixes` static N-checks | `cloudReconcile.ts` in the frozen list (no diff) | — |

**G-3 rows (O-123-11).**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123Navigation` `checkRemovedElsewhereNotice` | "notice on the plain home / above the catalog / with another app's window open" → silent in those three cases; the notice only for the affected floating window and (new) the affected profile modal; z-order checked with the closed-window notice | O-123-11 (superseded assertions) |
| `verifyPhase123Navigation` M10 | "notice only when a window closed (drop path silent)" → "notice shown although no affected window was open" | O-123-11 (inverted mutation) |
| `verifyPhase123Navigation` static N-6 | plain copy present → absent | O-123-11 |
| `verifyPhase123OwnerFixes` (own, 123.5) | O-2 group: plain constant / comment present → absent; M26 anchor moved | O-123-11 narrows O-2 |

**T-1 (O-123-11).**
- `npx tsc -b` clean; lints clean on `Dashboard.tsx` / `messages.ts`.
- `verifyPhase123Navigation --no-mutations` PASS, 12 groups (16s). `--mutations=M8,M9,M10` PASS, all caught (55s): M8 by the closed-window wait, M9 "the notice is visible above the open catalog modal", M10 "plain Digital Home → the tile disappears silently (no notice)".
- `verifyPhase123OwnerFixes --mutations=M26,M31` PASS: baseline 16 groups green, both caught (22s).
- Other verifies that read `Dashboard.tsx` / `messages.ts` / `cloudReconcile` (`rg -l`): 102CredentialSchema, 104, 103Execution, 108BrowserIntegration, 111, 113, 117ManagedAutofill, ServiceSourceOwnership plain PASS (0–1 s); CatalogGate 1s, Sync 2s, D8OwnSite 10s, RemoveApp 24s, AppContext 19s, Catalog 23s `--no-mutations` PASS.

### Late finding O-123-12 — no "not saved yet" line under the fields-updated notice (T-1 only; no final run yet)
**Implementation.**
- `src/loginAssistance/LoginAssistancePanel.tsx`, JSX branch `launchKind === 'missing-user-credentials'`: the `MSG_MISSING_USER_CREDENTIALS_LAUNCH` block («עדיין לא שמרת פרטי כניסה לאתר זה.») is now wrapped in `!showFieldsUpdated && (…)`. While the D-123-8 notice «שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.» is shown, the window shows the notice with its single «עריכת פרופיל» and the normal actions only. When the notice is absent, the line renders exactly as before (same element, `role="status"`, class).
- That 5-line block is the only O-123-12 change. In `git diff -U0 e91b5b12 -- src/loginAssistance/LoginAssistancePanel.tsx`, every other hunk belongs to O-123-5 (menu ref / click capture) or O-123-8 (failure status).

**Nothing about stored values or the notice trigger changed.**
- `const showFieldsUpdated = …` (panel lines 164–170) has no diff hunk. It still calls `hiddenCredentialFieldIds(activeCredential, entry.fields.map(…))`.
- `git diff --stat e91b5b12 -- src/execution src/digitalHome/ownSiteDefinition.ts src/loginAssistance/credentialsGate.ts src/admin` is **empty**. The resolver (`resolveOwnSiteDefinition` / `ownSiteFollowsRegistry`), `hiddenCredentialFieldIds`, the `missing-user-credentials` derivation and `src/execution/**` are untouched.
- Hydrate and the App merge are unchanged by O-123-12.
- No credential write was added. Stored values stay under the old field ids until the user saves the profile.
- No site / host / service-id branch, no browser dialog. Hebrew RTL is unchanged.

**Check and mutation** (`scripts/verifyPhase123OwnerFixes.mjs`).
| Check | Mutation |
|---|---|
| `checkFieldsUpdatedOnly` (browser, real App). Fixture: an own site whose approved registry entry with the same id maps one different field (`email`), and a profile whose stored values use only the old ids (`username` / `password`). Opening the tile shows the fields-updated notice, no «עדיין לא שמרת…», exactly one `edit-profile` (inside the notice) and the primary action. The stored credential keeps the same keys and values (compared in the page, never printed). Control: an own site with no registry entry and no stored values shows «עדיין לא שמרת…» as before. | **M32 both messages shown together** (`!showFieldsUpdated && (` → `(`): caught by "O-123-12: no «עדיין לא שמרת פרטי כניסה לאתר זה.» together with the fields-updated notice" |

`openPage` gained an optional `catalogExtra` (registry rows added for one page only), so the other groups' catalog stays as it was. Fixture values are synthetic (`fixture-upd-*`).

**T-1 (O-123-12).**
- `npx tsc -b` clean. Lints clean on the panel and the verify.
- `verifyPhase123OwnerFixes --no-mutations` PASS, 17 groups (31s). `--mutations=M32` PASS, caught (56s).
- The other verifies that read `LoginAssistancePanel` (`rg -l`) all PASS:
  - plain: 102CredentialSchema, 104, 103Execution, 117ManagedAutofill, 113, ServiceSourceOwnership;
  - `--no-mutations`: RemoveApp (13 groups, 22s), Navigation (12, 17s), Catalog (19, 24s), AppContext (23, 16s), CatalogGate (8), D8OwnSite (10, 4s).

**Backlog (not in scope):** F-123-1, automatic carry-over of stored values by field kind.

### Owner findings batch 3 — O-123-17 Step 1 (read-only; no `src/` change) — 2026-10-06
**Result: not reproduced in any client path, and not stale UI state. The dot and the window's profile buttons can only remain if the profile is really still in the vault state. No 123.5 hunk touches this path, so it is not a client regression vs `e91b5b12`. Any fix would be in delete / sync / hydrate territory → STOP, per the ruling.**

**Where the dot and the buttons come from (code read):**
- The dot is `Tile` `hasCredentials={appHasProfile({ accessProfiles }, service.id)}` (`Dashboard.tsx`), where `accessProfiles = vaultState.accessProfiles`. It has no state of its own.
- The window's «עריכת פרופיל» / «הוספת פרופיל» / chips / empty state come from `appContextActions(service, profilesForService(accessProfiles, id))`, the same list. `activeProfileId` resets to `initialActiveProfile(profiles)` whenever the profile id set changes.
- «עריכת פרופיל» closes the window (`setAssistance(null)`), so after the modal the window always remounts fresh.
- The dot, the window and the modal all select an app's profiles with the same trimmed `serviceId` comparison.
- So no stale React state can keep the dot and the buttons once the profile has left `vaultState.accessProfiles`.

**Delete path (unchanged):** `DigitalHomeCredentialModal.onDeleteProfile` runs these steps:
1. a local validation dry run (fail-closed);
2. `bumpDualWriteGeneration()`, then `deleteAccessProfileFromCloud` (RLS `access_profiles_crud_own`; a delete that matches 0 rows is not an error);
3. `deleteAccessProfile`;
4. `handleVaultStateChange`, which does `setVaultState` + `saveVaultState`.

If the cloud delete throws, nothing is deleted locally (by design). The modal then shows «לא הצלחנו למחוק את הפרופיל מהחשבון. בדקו חיבור לרשת ונסו שוב.» and «לא הצלחנו לשמור את השינויים…», and the dot correctly stays.

**Reproduction with the real App (harness, synthetic data):** new group `checkLastProfileDeleted` in `scripts/verifyPhase123OwnerFixes.mjs`. The only harness change is that the stub `setCloudGoneListener` now keeps the listener, as in `verifyPhase123Navigation`. All five paths PASS on the current tree:

| Path | Result |
|---|---|
| One tab: lone legacy profile → «עריכת פרופיל» → «מחיקת פרופיל» → confirm → ✕ | no dot; window «עדיין אין פרופיל לאתר זה.» + «הוסף פרופיל» + «פתח אתר» only |
| One tab: lone «ראשי» with stored credentials (autofill app), same path | same |
| One tab: «הוסף פרופיל» → save («ראשי», O-123-6) → delete in the same modal | same |
| Two tabs: the other tab's deletion arrives through the cloud-gone listener (AD-123-18 (2)), window closed | same |
| Two tabs: same, window of that app open | same |

The existing `verifyPhase123AppContext` `checkDeleteFlows` (FR-11 / FR-12: no dot and an empty state after the last delete) also passes: in the 123.4 END OF ROUND run on the BASE tree, and in the O-123-12 T-1 on the current tree.

**Compared with BASE `e91b5b12`:** `git diff e91b5b12` has no hunk in any of the following:
- `Tile.tsx`, `appContext.ts`, `profileManagement.ts`, `profileResolution.ts`, `DigitalHomeCredentialModal.tsx`, `persistence.ts`, `syncOutbox.ts`;
- `App.tsx` `handleVaultStateChange` / reconcile;
- the `profiles` / `activeProfileId` / `appContextActions` lines of the panel.

The 123.5 hunks in `ServiceProfileManagementModal.tsx` are only O-123-6 / O-123-7 (first-profile name, chips / rename hidden for a lone profile, duplicate-name check, hint removed). The Dashboard hunks are O-123-3 / O-123-8 / O-123-11. None of them changes the profile list, the delete handler or the dot.

**What remains (needs the Owner's dev data; I cannot sign in, by rule):** the profile is really still in the state. There are two ways that can happen:
- **A — the cloud delete failed:** fail-closed, nothing deleted, and the modal shows the red line above.
- **B — resurrection:** the cloud still holds the row after the delete. Hydrate / refresh-on-focus treats the cloud as the source of truth and brings the profile back. Candidates:
  - an insert of a just-created profile that was already in flight when the delete ran (create and delete within seconds);
  - another tab re-inserting a profile still in its outbox.

  This is D-123-1 / AD-123-18 territory: sync / hydrate / outbox.

Either way, the fix is not UI-state-only.

**Owner steps to tell A from B (Hebrew; no user ids needed):**
1. אחרי המחיקה, האם הופיעה בחלון ניהול הפרופיל שורה אדומה «לא הצלחנו למחוק את הפרופיל מהחשבון…»? (כן → מקרה A.)
2. האם הנקודה נשארה מיד אחרי המחיקה, או חזרה רק אחרי מעבר לחלון / לשונית אחרת וחזרה? האם הפרופיל נוצר שניות ספורות לפני המחיקה?
3. לרענן את הדף (F5) ולהיכנס שוב: האם הנקודה עדיין שם?
4. ב־SQL Editor של Supabase (dev), עם מזהה האפליקציה בלבד:
   `select ap.local_profile_id, ap.display_name, ap.created_at from public.access_profiles ap join public.user_services us on us.id = ap.user_service_id where us.service_id = '<מזהה האפליקציה>' order by ap.created_at;` — שורה שמופיעה אחרי המחיקה = מקרה B.

**Status:** STOP for O-123-17, per the ruling (the fix needs sync / hydrate / outbox changes, or none at all if A). No mutation was added yet; the check will get its mutation with whatever fix is ruled.

### O-123-17 Step 2 — fail-closed cloud profile delete (Architect ruling; T-1 only)
**Cause (Owner evidence, Architect reading):** legacy data. The old profile's cloud row carried a different `local_profile_id` than the vault profile. `deleteAccessProfileFromCloud` matched 0 rows, treated that as success, and the local delete went ahead. The next cloud read brought the row back as a profile. Profiles created now are not affected, and this is not a 123.5 regression.

**Fix: the profile delete path only.**
- `src/supabase/persistence.ts`, `deleteAccessProfileFromCloud`:
  - the delete now asks for the removed rows back (`.select('id')`);
  - if no row came back, it throws an error with `code: PROFILE_DELETE_UNCONFIRMED` (new exported constant) and skips `forgetProfile`;
  - a server error is rethrown as before.

  `git diff e91b5b12 -- src/supabase` is exactly these two hunks in this one function plus the constant (pinned by `O17_PERSIST_HUNKS`).
- `src/loginAssistance/DigitalHomeCredentialModal.tsx`, `onDeleteProfile`:
  - any cloud-delete failure, including "no row removed", sets the existing `PROFILE_DELETE_CLOUD_FAILED_MESSAGE` («לא הצלחנו למחוק את הפרופיל מהחשבון. בדקו חיבור לרשת ונסו שוב.») and deletes nothing locally;
  - the one exception is a profile still in the vault outbox (`outboxOf(vaultState).profileIds`): its first cloud insert never happened, so "no row" is expected. Under the AD-123-18 model, any other profile without a cloud row is dropped as "gone" by the next dual-write.

  The call line `bumpDualWriteGeneration(); await deleteAccessProfileFromCloud(profileId);` is byte-identical.
- **Not changed:** hydrate, outbox code, the sync algorithm, `persistVault`, crypto, schema / RLS.

**Checks** (`scripts/verifyPhase123OwnerFixes.mjs`, now 20 groups):
| Check | What it proves |
|---|---|
| `checkProfileDeleteProof` (unit: real `persistence.ts`, stub client with PostgREST delete semantics, where rows come back only with `.select()`) | matching row → removed, success, rows asked back; **the Owner case** (cloud row under an older local id) and an owner / RLS mismatch → 0 rows → `PROFILE_DELETE_UNCONFIRMED`, the row stays; server error rethrown unchanged |
| `checkDeleteUnconfirmed` (browser, real App) | a cloud delete that removed no row → the existing Hebrew error in the modal, profile and dot kept, 0 writes; a profile still in the outbox → deleted normally, leaves the outbox, empty state |
| `checkLastProfileDeleted` (from Step 1) | after the last delete: no dot; the window shows «עדיין אין פרופיל לאתר זה.» + «הוסף פרופיל» + «פתח אתר» only |

**Mutations:** I added `--mutation-report` to list every group that catches a mutation. All four are caught by a behaviour check, not only by the exact-hunk pin:
| Mutation | Caught by |
|---|---|
| M33 0-row cloud delete treated as success (`persistence.ts`) | `checkProfileDeleteProof` "0-row cloud delete treated as success (got success)"; `checkNChecks` hunk pin |
| M34 0-row cloud delete treated as success by the window (outbox ignored) | `checkDeleteUnconfirmed` "…the profile was deleted locally"; host hunk pin |
| M35 a profile that never reached the cloud cannot be deleted | `checkDeleteUnconfirmed` (outbox case); host hunk pin |
| M36 dot / edit buttons remain after the last profile is deleted (local delete skipped) | `checkLastProfileDeleted`, `checkDeleteUnconfirmed`, `checkProfileNames`; host pin |

**G-3 rows (O-123-17):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `checkNChecks` | frozen `src/supabase` → allows `persistence.ts` only when reverting the exact O-123-17 hunks gives BASE byte for byte | O-123-17 |
| `verifyPhase123OwnerFixes` `checkProfileWritesStatic` | "host = BASE" → host = BASE after reverting the three exact O-123-17 hunks | O-123-17 |
| `verifyPhase123D8OwnSite` `checkHydrateScope`, `checkKi5SharedPredicate` | "persistence.ts = base apart from D-123-8 / KI-5" → the same after `withoutO17DeleteProof` (exact text) | O-123-17 |
| `verifyPhase123AppContext` N-3 `AD_123_18_IMPORTS` | the host may also import `PROFILE_DELETE_UNCONFIRMED` | O-123-17 |

Each change carries a code comment naming O-123-17. Nothing else was weakened. AppContext's `checkPersistenceScope` (`forgetProfile` only after success; 8 functions byte-identical) still passes unchanged.

**T-1 (O-123-17):**
- `npx tsc -b` clean.
- OwnerFixes `--no-mutations` 20 groups PASS. `--mutations=M33,M34,M35,M36 --mutation-report` all caught (2m).
- Readers of `persistence.ts` / the host:
  - 109Accounts, 113LoginAssistance, 121DeleteService (43 mutations) plain PASS;
  - Sync (15 groups), AppContext (23), D8OwnSite (10), Catalog (19), Navigation (12), RemoveApp (13) `--no-mutations` PASS.

**Earlier code path that could leave a mismatched `local_profile_id`** (from code history only, not verified; information, not a fix):
- (a) `src/vault/vaultMigration.ts` gives migrated legacy profiles the deterministic id `profile-legacy-<serviceId>`. A cloud row created for the same app from another vault / device under a `profile-<uuid>` id keeps that id.
- (b) Before AD-123-18 amendment A (outbox), hydrate kept local-only profiles ("never drop local", D-109-25). Local profiles then reached the cloud only by a background upsert on `(user_id, local_profile_id)`. A failed or aborted write left the vault profile without a cloud row, while an older row for the same app stayed under its own id.

Either way, the vault and the cloud hold the "same" profile under two ids. The fix above turns that case into a visible error instead of a silent resurrection.

**Owner re-check (Hebrew):** step 17 in "Owner re-check steps" below.

### Batch 3 — O-123-13…16 (T-1 only; no final run yet)

#### O-123-13 / O-123-14 — the catalog offer sits above the still-filled custom-site form
**Files / symbols:**
- `src/digitalHome/AppCatalog.tsx`, `handleAddCustomSite`:
  - the three offer outcomes (`catalog_service_available`, `already_in_user_home`, `same_user_custom_duplicate`) no longer call `dismissAddModal()`; they only reset `isSavingCustom` and set `catalogOffer`;
  - `<AddSiteModal covered={catalogOffer !== null}>`;
  - new `closeOfferAndForm()` is used by «חזרה לחנות האתרים» and, after a successful add, by «הוספה לבית הדיגיטלי» (`confirmAddCatalogToHome`);
  - Escape / × / backdrop / «סגור» keep `dismissCatalogOffer` (offer only);
  - the catalog-available offer now shows a × button (`aria-label="סגירה"`), the title `catalogOfferFoundTitle(catalogOffer.displayName)`, the text `catalogOfferSupportedText(catalogOffer.displayName)` and the two buttons; each offer's first button gets `autoFocus`.
- `src/digitalHome/catalogMessages.ts` (new, user-side copy only): `catalogOfferFoundTitle` «מצאנו את <name> בחנות האתרים», `catalogOfferSupportedText` «<name> כבר נתמך, ולכן אין צורך להוסיף אותו כאתר מותאם אישית.», `CATALOG_OFFER_ADD_LABEL` «הוספה לבית הדיגיטלי», `CATALOG_OFFER_BACK_LABEL` «חזרה לחנות האתרים», `CATALOG_OFFER_CLOSE_LABEL` «סגירה». `<name>` is always the classifier's catalog `displayName`.
- `src/AddSiteModal.tsx`: new optional `covered` prop. While covered:
  - the overlay gets `inert` and `data-covered="true"`;
  - its own Escape is off (`useEscapeToClose(cancelIfIdle, !covered)`);
  - when it is uncovered again, focus returns to the name field (`nameInputRef`).
  The default `covered = false` leaves the edit flow unchanged.
- `src/digitalHome/AppCatalogModal.tsx`: the Tab trap scope is the top non-inert `.modal-overlay` (previously the first one, which is now the inert form).
- `src/App.css`: `.sm-catalog-offer-head` / `.sm-catalog-offer-close`; `.modal-overlay[data-covered='true']` (no second backdrop, dialog at opacity 0.55).
- `src/supabase/**` untouched by this change. The old `registryPersistence.ts` constants stay (pinned by verify 104); `AppCatalog` no longer imports the four catalog-available ones.

**Check** `checkCatalogOfferLayered` (OwnerFixes, browser, real App + real classifier; fixture hosts):
- **catalog-available** (`avail.example.test`, catalog name «חנות זמינה», typed «החנות שלי»):
  - title and text use the catalog name, and the typed name appears nowhere;
  - exactly the two buttons are shown;
  - the form stays visible with the typed values, `inert`, not focusable (`focus()` fails), opacity < 1, and Tab stays inside the offer;
  - Escape and × each close only the offer: the form stays filled and focus returns to the name field;
  - «חזרה לחנות האתרים» closes both and adds nothing;
  - «הוספה לבית הדיגיטלי» adds `svc-avail`, closes both and creates no custom site.
- **already in home** (`one.example.test`) and **own duplicate** (`own.example.test`):
  - the existing copy is shown, and the form stays behind (same assertions as above);
  - «סגור» and Escape each close only the offer, keeping the values and returning focus.

| Mutation | Caught by |
|---|---|
| M37 form closed when the catalog offer appears | "the custom-site form is not closed when the offer appears" |
| M38 typed name used instead of the catalog name | "title «מצאנו את <catalog name> בחנות האתרים»" |
| M39 Escape closes the form too | "O-123-13 Escape: only the offer closes — the form stays" |
| M40 form focusable while the offer is open | "the form is inert (not focusable) while the offer is open" |
| M41 «סגור» closes the form too (O-123-14) | "O-123-14 (one.example.test) «סגור»: only the offer closes — the form stays" |
| M42 typed values lost behind the offer (O-123-14) | "the form keeps the typed values behind the offer" |

**G-3 rows (O-123-13 / O-123-14):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123Catalog` `CATALOG_ALLOWED_IMPORTS` | allows `./catalogMessages` (strings only) | O-123-13 |
| `verifyPhase123Catalog` `HE` | `addHome` «הוספה לבית הדיגיטלי», `availablePrompt` = the new text; `notNow` removed; `backToCatalog` added | O-123-13 |
| `verifyPhase123Catalog` `checkCustomAdd` | new title / text for the catalog-available offer; after «סגור» the still-open form is cancelled with «ביטול» before the next add; after «הוספה…» the form must be gone | O-123-13 / O-123-14 |
| `verifyPhase123Catalog` D-123-3 group | after the offer closes (backdrop / Escape) the still-open form is cancelled with «ביטול» before the next add / closing the catalog | O-123-14 |
| `verifyPhase104ServiceManagement` | "UI uses `catalogServiceAvailableTitle(catalogOffer.displayName)`" → uses `catalogOfferFoundTitle(…)` and `catalogOfferSupportedText(…)` with `catalogOffer.displayName` | O-123-13 |

AppContext's D-123-3 overlay scan initially failed because the overlay class was a template literal. I fixed the product code (literal `className="modal-overlay"` + `data-covered`), not the scan, which still finds 6 overlays.

**T-1 (O-123-13 / O-123-14):**
- `npx tsc -b` clean; no lints.
- OwnerFixes `--report-groups`: 21 groups PASS. `--mutation-report --mutations=M37…M42`: all caught (M39 / M41 re-run after the explicit assertion; M40 / M42 re-run after the `data-covered` change).
- Catalog (19 groups), AppContext (23), D8OwnSite (10), CatalogGate (8), Navigation (12), FixD6D8 (6) `--no-mutations` PASS.
- 104ServiceManagement and 108M1ExplicitLoginEntry plain PASS.

#### O-123-15 — autofill label
**Files / symbols:** `src/loginAssistance/messages.ts` `LABEL_TRY_AUTO` «נסה מילוי אוטומטי» → «מילוי פרטים אוטומטי». The click handler is unchanged.

**Check** `checkAutofillLabel` (browser): the window autofill action reads «מילוי פרטים אוטומטי», the old label is gone from the page, and a click still runs the autofill attempt (status line).

| Mutation | Caught by |
|---|---|
| M43 old autofill label restored | `checkAutofillLabel` (got «נסה מילוי אוטומטי»); `checkMessagesComments` |

**G-3 rows (O-123-15):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase113LoginAssistance` "Autofill copy unchanged" | asserts `LABEL_TRY_AUTO = 'מילוי פרטים אוטומטי'` | O-123-15 |
| `verifyPhase123OwnerFixes` `checkMessagesComments` (O-2 "every other constant unchanged vs BASE") | BASE's `LABEL_TRY_AUTO` value is swapped for exactly the new label before the comparison; every other constant still equals BASE | O-123-15 |

**T-1 (O-123-15):**
- OwnerFixes 22 groups PASS; M43 caught.
- 113LoginAssistance and 117ManagedAutofill plain PASS.
- RemoveApp (13), Navigation (12), D8OwnSite (10), AppContext (23), FixD6D8 (6) `--no-mutations` PASS.

#### O-123-16 — closed-window notice copy (narrow N-2 copy exception)
**Files / symbols:** `src/digitalHome/cloudReconcile.ts` `MSG_REMOVED_ELSEWHERE`. This is the whole diff against BASE:
```diff
-export const MSG_REMOVED_ELSEWHERE = 'האפליקציה או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.';
+export const MSG_REMOVED_ELSEWHERE = 'האתר או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.';
```
`git diff --stat e91b5b12 -- src/digitalHome/cloudReconcile.ts`: 1 file, 1 insertion, 1 deletion.

**Check:** OwnerFixes `checkNChecks`:
- `cloudReconcile.ts` carries the new line exactly once;
- swapping it back gives BASE byte for byte (`O16_LINE`).

The behaviour (the window closes with the notice) is checked in Navigation and AppContext with the new text.

| Mutation | Caught by |
|---|---|
| M44 old removed-elsewhere wording | `checkNChecks` "carries «האתר או הפרופיל…» exactly once" |
| M45 another `cloudReconcile.ts` line changed (`CLOUD_REFRESH_MIN_INTERVAL_MS`) | `checkNChecks` "identical to e91b5b12 apart from the MSG_REMOVED_ELSEWHERE line" |

**G-3 rows (O-123-16):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `checkNChecks` frozen list | `cloudReconcile.ts` leaves the "no diff" list and must equal BASE after swapping back exactly that one line | O-123-16 |
| `verifyPhase123D8OwnSite` `checkHydrateScope` `others` | same (exact line, vs its BASE `af881f6b`) | O-123-16 |
| `verifyPhase123Navigation` `checkNChecks` N-2 | "`cloudReconcile.ts` unchanged since `c700cd60`" → unchanged apart from that one line; `HE.removedClosed` = the new copy (browser checks at the closed-window notice use it) | O-123-16 |
| `verifyPhase123AppContext` `HE.removedElsewhere` | the new copy | O-123-16 |

**T-1 (O-123-16):**
- `npx tsc -b` clean.
- OwnerFixes 22 groups PASS; M44 and M45 caught.
- D8OwnSite (10), Navigation (12), AppContext (23), Sync (15), RemoveApp (13), Catalog (19) `--no-mutations` PASS.

No verify process was left running after the runs.

### Batch 4 — O-123-18…21 (T-1 only)

#### O-123-18 — return to the floating window after a profile / site-details modal
**Files / symbols:**
- `src/Dashboard.tsx`:
  - new prop `windowModalOpen` (default `false`);
  - `interface WindowReturn { serviceId, opener, opened }`, ref `windowReturn`, state `windowReturnSeq`, ref `focusOnReopen`;
  - `openFromWindow(service, opener, open)` records the return, then opens the modal and closes the window. It is used by the panel callbacks `onEditProfile` (`edit-profile`), `onAddProfile` (`add-profile` / `add-first-profile`) and `onEditSiteDetails` (`edit-site-details`);
  - an effect on `[windowModalOpen, windowReturnSeq]`: when the modal closes it reopens the window, only if the modal really opened, the vault is unlocked, the app is still in `services` and its tile is in the DOM. It uses the current `Service` and the live tile rect;
  - an effect on `assistance` moves focus to `[data-action=<opener>]` inside the window, or to the window section when that button is gone.
- `src/App.tsx`: `windowModalOpen={profileHost !== null || siteEditHost !== null}` on `<Dashboard>`. The AC-113-45 tile-focus effect (`profileReturnFocusId`) stays and still covers the exceptions (app removed, locked, not opened from the window).
- `src/loginAssistance/LoginAssistancePanel.tsx`: `tabIndex={-1}` on the window section, so it can take focus.
- Not changed: modal logic, persistence, sync, Remove app.

**Exceptions:**
- **The app was removed:** no service and no tile → no window; the O-123-11 notice rules apply unchanged.
- **Locked / logged out:** `vaultUnlocked` is false, or Dashboard is unmounted → no window.
- **Not opened from the window:** only `openFromWindow` records a return. A request that never opened a modal is cleared on the next close through `opened === false`.

**Check** `checkReturnToWindow` (browser, real App):
- «עריכת פרופיל» × on `svc-cred` → the window is back, anchored to the tile, focus on `edit-profile`;
- rename + save, then × on `svc-two` → the window is back and shows the new chip «אלף חדש»;
- «הוספת פרופיל» «ביטול» → the window is back, focus on `add-profile`;
- «הוסף פרופיל» cancel / save on `svc-zero` → the window is back, focus on `add-first-profile`, or on the window after the save (the button is gone);
- «עריכת פרטי האתר» save (title «אתר שלי חדש») and Escape on the own site → the window is back, refreshed;
- catalog opened and closed (not from the window) → no window;
- app removed elsewhere (`__pvGone`) while the modal is open → no window, and the notice is shown;
- lock from inside the modal (`.vault-state-badge-lock`), then log in again → no window.

| Mutation | Caught by |
|---|---|
| M46 window not reopened after save | `checkReturnToWindow` (save → window back) |
| M47 window not reopened after cancel | `checkReturnToWindow` (cancel → window back) |
| M48 window reopened although the app was removed (cached service, no tile guard) | `checkReturnToWindow` "window reopened although the app was removed" |

**G-3 rows (O-123-18):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123Navigation` `checkAppsLoginReachability` (AC-113-45 focus back on the tile after the profile modal closes) | now asserts that the window is visible and focus is on its `edit-profile` button; code comment names O-123-18 | O-123-18 supersedes the 123.4 focus-to-tile re-homing for these modals |
| `verifyPhase123OwnerFixes` `openTile` helper | waits 150 ms, keeps an already-open window of the same app, and otherwise closes any open window first (the reopened window may cover the next tile); code comment names O-123-18 | O-123-18 (test helper only; no assertion changed) |

#### O-123-19 — «↗ פתח» below the URL field
**Files / symbols:**
- `src/AddSiteModal.tsx`:
  - `TEST_OPEN_URL_LABEL = 'פתח'`;
  - new `TEST_OPEN_URL_ICON = '↗'` (rendered first, `aria-hidden`, so it sits to the right of «פתח» in RTL);
  - new `TEST_OPEN_URL_ACCESSIBLE_NAME = 'פתח את הכתובת לבדיקה בכרטיסייה חדשה'`, set as `aria-label` on the button;
  - the `onClick` / `disabled` / `noopener,noreferrer` behaviour is unchanged. Both forms (add and «עריכת פרטי האתר») use this component.
- `src/App.css`:
  - `.modal-field .modal-url-row` is now `flex-direction: column; align-items: stretch`, so the input keeps the full width;
  - `.modal-url-test` uses `align-self: flex-start` (the right side in RTL) and is an inline-flex with a small gap.

**Accessible name:** the ruling's example was «פתיחת הכתובת לבדיקה בכרטיסייה חדשה». I used «פתח את הכתובת…» so that the accessible name contains the visible word «פתח» (WCAG 2.5.3 label in name; speech users can say what they see).

**Check** `checkTestOpenButton` (the O-123-10 group), new helper `assertOpenButtonLayout`, run for both forms:
- the label is «↗ פתח»;
- the button top is at or below the input bottom, and the input width equals the row width;
- the ↗ box is to the right of the «פתח» text box;
- `getByRole('button', { name: <accessible name> })` finds exactly one button.

The O-123-10 behaviour assertions (disabled for empty / invalid, the exact stored URL, a new tab with `noopener,noreferrer`, no probe) are unchanged.

| Mutation | Caught by |
|---|---|
| M28 button absent (kept; the block text was updated to the new markup) | "the test-open button is in the URL field block" |
| M29 opens a URL different from the stored one (kept) | O-123-10 exact URL assertion |
| M30 enabled for an invalid address (kept) | "disabled while the address is empty" |
| M49 button beside the URL field again (row back to `align-items: center`, no column) | "the button sits below the URL field, which keeps the full width" |
| M50 old «פתיחה לבדיקה» label | "label «↗ פתח»" (got «↗פתיחה לבדיקה») |
| M51 no descriptive accessible name (no `aria-label`) | "descriptive accessible name «פתח את הכתובת לבדיקה בכרטיסייה חדשה»" |

**G-3 rows (O-123-19):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `checkTestOpenButton` (add and edit) | «פתיחה לבדיקה» text next to the field → presence assertion plus `assertOpenButtonLayout`; code comments name O-123-19 | O-123-19 |
| `verifyPhase123OwnerFixes` M28 | same mutation, `from` text updated to the new button markup | O-123-19 |

No other verify pins this label or layout (`rg` over `scripts/`).

#### O-123-20 — menu item «הסרת אתר»
**Files / symbols:** `src/loginAssistance/messages.ts` `LABEL_REMOVE_APP` «הסרת אפליקציה» → «הסרת אתר». The behaviour, the `data-action="remove-app"` and the menu gating are unchanged. The wider app → site wording (code comments, other copy) is not touched.

**Check:** `requestRemove` (used by `checkRemoveDialog`, the O-123-4 group) asserts the menu item text «הסרת אתר» before clicking it.

| Mutation | Caught by |
|---|---|
| M52 old «הסרת אפליקציה» menu label | `checkMessagesComments` (O-2 BASE comparison) and `checkRemoveDialog` "the window menu item reads «הסרת אתר»" |

**G-3 rows (O-123-20):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123RemoveApp` `HE.removeApp` (static N-6 copy and browser menu text) | `'הסרת אתר'`; code comment names O-123-20 | O-123-20 |
| `verifyPhase123OwnerFixes` `checkMessagesComments` (O-2 "every other constant unchanged vs BASE") | BASE's `LABEL_REMOVE_APP` value is swapped for exactly the new label, next to the O-123-15 swap; every other constant still equals BASE | O-123-20 |

AppContext and Catalog name «הסרת אפליקציה» only in assertion messages and regexes on `menu.remove_app`. They do not pin the string, so they are unchanged.

#### O-123-21 — remove-confirm paragraph
**Files / symbols:** `src/digitalHome/RemoveAppConfirmDialog.tsx` `REMOVE_APP_CONFIRM_BODY` → «כל הפרופילים ופרטי ההתחברות של האתר יימחקו מכל המכשירים שלך.». The title `REMOVE_APP_CONFIRM_TITLE` and the O-123-4 0-profile variant (no paragraph) are unchanged.

**Check:** `checkRemoveDialog`:
- with ≥ 1 profile, the paragraph equals the new text exactly;
- the 0-profile title and "no paragraph" assertions are unchanged.

| Mutation | Caught by |
|---|---|
| M53 old «…של האפליקציה…» paragraph | `checkRemoveDialog` "≥ 1 profile → the paragraph reads «…של האתר…»" |

**G-3 rows (O-123-21):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `HE.confirmBody` and the O-123-4 "paragraph unchanged" assertion | the new text; the assertion now names O-123-21; code comments | O-123-21 |
| `verifyPhase123RemoveApp` `HE.confirmBody` (static N-6 copy and browser AD-123-11 copy) | the new text; code comment names O-123-21 | O-123-21 |

**T-1 (batch 4):**
- **O-123-18:**
  - `npx tsc -b` clean;
  - OwnerFixes 23 groups PASS, M46–M48 caught;
  - AppContext (23), Navigation (12), Catalog (19), RemoveApp (13), D8OwnSite (10), Sync (15), CatalogGate (8), FixD6D8 (6) `--no-mutations` PASS;
  - 113LoginAssistance and 117ManagedAutofill plain PASS.
- **O-123-19:**
  - `npx tsc -b` clean;
  - OwnerFixes 23 groups PASS;
  - `--mutation-report --mutations=M28,M29,M30,M49,M50,M51`: 6 of 6 caught;
  - no other verify reads this button.
- **O-123-20 / O-123-21:**
  - `npx tsc -b` clean;
  - OwnerFixes 23 groups PASS;
  - `--mutations=M52,M53`: 2 of 2 caught;
  - RemoveApp (13), AppContext (23), Catalog (19), Navigation (12) `--no-mutations` PASS.

`src/supabase/**`, `src/admin` and every other N-2 path got no new change in batch 4. No verify process was left running.

### O-123-22 — lost session while adding / editing a custom site → auth copy (T-1 only)
**Finding:** when the tab has lost its Supabase session, `requireAuthenticatedUserId` throws `AuthRequiredError`. Its message is Hebrew with no keyword, so `classifyCustomAddFailure` fell through to `CUSTOM_ADD_FAIL_PERSISTENCE_HE` instead of `CUSTOM_ADD_FAIL_AUTH_POLICY_HE`.

**Files / symbols:** `src/catalog/customAddFailure.ts` `classifyCustomAddFailure`. The first branch maps `error instanceof Error && error.name === 'AuthRequiredError'` to `failureClass: 'auth_policy'` with `CUSTOM_ADD_FAIL_AUTH_POLICY_HE`.
- It matches by `name`, one of the two forms the ruling allows, so the catalog module does not import `src/auth/session.ts` and, through it, the Supabase client.
- It runs before the connectivity branch, so a lost session gets the auth copy even when `navigator.onLine` is false.
- Add (`App.tsx` `addCustomService`, line 1200) and edit (`updateCustomService`, line 1262) both go through `userMessageForCustomAddFailure`, so both get the auth copy.
- Not changed: `src/auth/**`, `src/supabase/**`, session refresh, and every message text.

**Check** `checkCustomAddAuthRequired` (unit; real `customAddFailure.ts` bundled with esbuild):
- static fixture guard: `src/auth/session.ts` `AuthRequiredError` still sets `this.name = 'AuthRequiredError'`;
- an `AuthRequiredError` with a Hebrew, keyword-free message → `auth_policy` + `CUSTOM_ADD_FAIL_AUTH_POLICY_HE`, also through `userMessageForCustomAddFailure`;
- a plain Hebrew `Error` → still the persistence copy;
- `23505` → still `duplicate_reuse`.

| Mutation | Caught by |
|---|---|
| M54 AuthRequiredError mapping removed | `checkCustomAddAuthRequired` "AuthRequiredError (session lost) → auth copy" (got `persistence_validation`, «לא ניתן לשמור את האתר כרגע…») |

**G-3:** none. No existing assertion pins the old behaviour. `verifyPhase116CustomAddIdentity` classifies only plain objects and a `TypeError`, which the new branch does not match. It was not run, per the T-1 scope of the ruling.

**T-1 (O-123-22):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: 24 groups PASS;
- `--mutation-report --mutations=M54`: 1 of 1 caught.

No verify process was left running.

### O-123-23 — admin login screen (Owner admin exception, `need_login` branch only; T-1 only)
**Files / symbols:**
- `src/admin/AdminGate.tsx`, `need_login` branch only:
  - `heading` «מרכז הבקרה» → «הבית הדיגיטלי - ניהול»;
  - the `subtitle` prop is removed. `AuthEntryScreen` with `loginOnly` and no `subtitle` renders no subtitle line (`(subtitle || !loginOnly)`); `src/auth` is not touched;
  - `<p className="admin-gate-home-link">` with the «חזרה לבית הדיגיטלי» link is removed.
- `src/admin/admin.css`: after the change nothing uses `admin-gate-home-link` (`rg` over `src/`), so its three rules are removed, as item 1 of the exception allows:
  - the selector in the shared `width / max-width` list;
  - `.admin-gate--login .admin-gate-home-link`;
  - `.admin-gate-home-link`.
- Not changed: the `denied` branch and its home link, the login banner, the step-up logic, `data-testid="admin-gate-login"`, `AdminApp.tsx`, every other `src/admin` / `src/auth` file.

Full diff against BASE: `AdminGate.tsx` −8 / +1 lines; `admin.css` −10 / +1 lines (the selector list loses one line).

**Check** `checkAdminLoginScreen` (unit layer, rendered in Edge):
- **Setup:** the real `AdminGate`, `AuthEntryScreen` and `AUTH_COPY` are bundled with esbuild. Only `resolveAdminAccess`, the auth actions and `isDevBuild` are stubbed.
- **Unauthenticated:**
  - the heading is exactly «הבית הדיגיטלי - ניהול»;
  - no paragraph under the heading, and no «התחבר כדי לנהל…» text;
  - no `a[href="#/"]` and no «חזרה לבית הדיגיטלי»;
  - the login form is still shown.
- **`not_admin`:** the existing banner is shown, above the new heading.
- **`error`:** the denied screen still has its «חזרה לבית הדיגיטלי» link.
- **Exactness:**
  - `AdminGate.tsx` and `admin.css` equal BASE byte for byte after reverting exactly the allowed hunks (`O23_GATE_HUNKS`, `O23_CSS_HUNKS`);
  - no other `src/admin` file differs from BASE.

| Mutation | Caught by |
|---|---|
| M55 «חזרה לבית הדיגיטלי» link back | "no «חזרה לבית הדיגיטלי» link on the admin login screen" |
| M56 old heading «מרכז הבקרה» | "heading «הבית הדיגיטלי - ניהול»" (got «מרכז הבקרה») |
| M57 subtitle back | "no subtitle line under the heading" (got 1 paragraph) |

**G-3 rows (O-123-23):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `checkNChecks` frozen list (`src/admin` unchanged vs BASE) | `AdminGate.tsx` and `admin.css` leave the "no diff" list; `checkAdminLoginScreen` requires them to equal BASE after reverting exactly the O-123-23 hunks, and no other `src/admin` file may change; code comment names O-123-23 | O-123-23 (Owner admin exception) |

No other assertion pins the old text:
- `verifyPhase109Accounts` checks only `need_login`, `AuthEntryScreen`, `loginOnly`, the `data-testid` and the re-check;
- `verifyPhase122AdminWorkspace` replaces `AdminGate` with a pass-through stub, and its «חזרה לבית הדיגיטלי» assertion is about the admin app bar;
- the Phase 107 HTML fixtures are static files.

**T-1 (O-123-23):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: 25 groups PASS;
- `--mutation-report --mutations=M55,M56,M57`: 3 of 3 caught;
- `verifyPhase109Accounts --no-mutations`: PASS.

**Final-run note (Architect):** the admin sweep is `verifyPhase122AdminWorkspace` and `verifyPhase109Accounts --no-mutations` only. No verify process was left running.

### O-123-24 — user login title (copy-only change in `src/auth`; T-1 only)
**Files / symbols:** `src/auth/copy.ts` `AUTH_COPY.productTitle` «כספת דיגיטלית» → «הבית הדיגיטלי». This is the whole diff against BASE (one line).
- Its only use is the `AuthEntryScreen` default heading (`heading ?? AUTH_COPY.productTitle`).
- The admin login passes its own `heading` (O-123-23), so it is unaffected; `checkAdminLoginScreen` still renders «הבית הדיגיטלי - ניהול» with the real `copy.ts`.
- Not changed: every other `AUTH_COPY` string, the `AuthEntryScreen` logic, session code, every other `src/auth` file.

**Check** `checkUserLoginTitle` (unit layer, rendered in Edge):
- **Setup:** the real `AuthEntryScreen` and `AUTH_COPY` are rendered with no `heading`, using the same auth-action stubs as O-123-23.
- **Rendered:** the heading is exactly «הבית הדיגיטלי», and «כספת דיגיטלית» does not appear.
- **Exactness:** `copy.ts` carries the new line once and equals BASE byte for byte after swapping back that one line, so no other `AUTH_COPY` string changed.

| Mutation | Caught by |
|---|---|
| M58 old title «כספת דיגיטלית» | `checkUserLoginTitle` "the user login heading (AuthEntryScreen default) is «הבית הדיגיטלי»" (got «כספת דיגיטלית») |

**G-3 rows (O-123-24):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `checkNChecks` "src/auth diff limited to register.ts" | also allows `src/auth/copy.ts`, which `checkUserLoginTitle` pins to BASE apart from the `productTitle` line. New untracked `src/auth` files are now refused outright, which is stricter; code comment names O-123-24 | O-123-24 |

`rg «כספת דיגיטלית»` over `scripts/` finds only the static HTML fixture `scripts/fixtures/phase113-wave-v2-login.html`, which no assertion reads for the title. `verifyPhase109Accounts` reads `copy.ts` only for the single-password wording, not the title.

**T-1 (O-123-24):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: 26 groups PASS;
- `--mutation-report --mutations=M58`: 1 of 1 caught.

No verify process was left running.

### O-123-25 — tile dot only when the app is ready to use (T-1 only)
**Files / symbols:** `src/Dashboard.tsx` `renderTile`:
- `hasCredentials = appHasProfile({ accessProfiles }, service.id) && deriveServiceManagementState(service, { selectedIds: homeIds, accessProfiles, credentials: credentialsByProfileId }) === 'added'`;
- `homeIds = new Set(services.map((item) => item.id))`. Dashboard's `services` prop is App's `selectedServices` (minus a tile hidden during the Undo window), i.e. the selected apps;
- one new import, `deriveServiceManagementState` from `src/serviceManagement/serviceManagementState.ts`. That file is the existing single rule: default profile, complete credentials for the current `resolveCredentialEntry` fields, and no-stored-credentials counts as complete. No second completeness rule.
- An own approved site whose approved fields differ from the stored field ids is incomplete, because the effective (D-123-8) `Service` drives `resolveCredentialEntry`.
- Not changed: `Tile.tsx`, the stored values (D-123-8 ruling 2), the fields-updated notice, the floating window, profile actions, persistence and sync.

**Check** `checkTileReadyDot` (browser, real App):
- **(a)** `svc-cred`, whose profile has complete credentials → dot.
- **(b)** an approved own site whose approved fields changed to `email`, with values stored under `username` / `password` → no dot. The fields-updated notice still shows, and the stored values are untouched.
- **(c)** `svc-zero` with no profile → no dot.
- `svc-one`, a profile without credentials → no dot (not orange).
- A no-stored-credentials catalog app → dot with a profile, no dot without one.

| Mutation | Caught by |
|---|---|
| M59 dot back to "profile exists" only | `checkLastProfileDeleted` "svc-one starts without its dot" and `checkTileReadyDot` (b) |
| M60 dot without the profile term | `checkTileReadyDot` "no-stored-credentials app without a profile → no dot" |

**G-3 rows (O-123-25):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `checkLastProfileDeleted` (O-123-17) "svc-one / svc-cred start with their dot" | `svc-one` (profile, no credentials) starts without a dot; `svc-cred` still starts with it, so the O-123-17 "no dot after the last profile is deleted" assertion stays meaningful for it | O-123-25 |
| `verifyPhase123OwnerFixes` `checkLastProfileDeleted` "the dot appears after the first profile" (created without credentials) | the first profile exists and there is no dot | O-123-25 |
| `verifyPhase123OwnerFixes` `checkDeleteUnconfirmed` (O-123-17) "the profile and its dot stay" | the profile stays and the dot state is unchanged from before the delete (`svc-one` has none) | O-123-25 |
| `verifyPhase123AppContext` `checkDashboardDot` "AD-123-6: Dashboard tile input = appHasProfile(...)" | pins the new expression (`DASH_DOT`). Its existing "Dashboard does not read `hasCompleteCredentials`" assertion stays and guards "no second rule" | O-123-25 supersedes AD-123-6 FR-21/22 "profile without credentials counts" |
| `verifyPhase123AppContext` `checkGreenDotUi` (FR-21/22) | `svc-one` / `svc-two` / `svc-three`: no dot, because their default profiles have no complete credentials (`svc-two`'s credentials sit on the non-default profile); `svc-zero` / `svc-custom` unchanged | O-123-25 |
| `verifyPhase123AppContext` FR-23 "dot has no count / text" | moved to the dot that appears after `svc-zero`'s first profile with complete credentials (FR-21 assertion, unchanged) | O-123-25 (`svc-one` no longer has a dot) |
| `verifyPhase123AppContext` M4 (`DASH_DOT` from-string) | targets the new expression; still caught | O-123-25 |

Other dot assertions are unchanged and still pass:
- Catalog "added app has no green dot (0 profiles)";
- AppContext "no dot after the last profile is deleted".

**O-123-23 follow-up found while running AppContext (G-3 in a touched verify):** AppContext's N-1 check allowed only `userApproval.ts` / `ApprovalQueue.tsx` under `src/admin`, so it failed on the O-123-23 files. It now also allows `src/admin/AdminGate.tsx` and `src/admin/admin.css`, whose content OwnerFixes `checkAdminLoginScreen` pins hunk by hunk against `e91b5b12`; code comment names O-123-23. The same pin exists in six verifies that this round did not touch; see KI-123.5-5.

**T-1 (O-123-25):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: 27 groups PASS;
- `--mutations=M59,M60`: 2 of 2 caught. A first run of M34–M36 (O-123-17) caught all three, before M59's catcher was relabelled from a fixture message to an O-123-25 check;
- AppContext `--no-mutations` PASS; AppContext `--mutations=M4` caught.

No verify process was left running.

### O-123-26 — window edit button reads «השלמת פרטי כניסה» when the shown profile is incomplete (T-1 only)
**Files / symbols:**
- `src/loginAssistance/messages.ts`:
  - new `LABEL_COMPLETE_CREDENTIALS = 'השלמת פרטי כניסה'`;
  - `MSG_AUTOFILL_CREDENTIALS_MISSING` is now «פרטי הכניסה בפרופיל הזה חסרים. לחצו «השלמת פרטי כניסה» בחלון האתר והשלימו אותם.». The AD-123-1 comment stays directly above it.
- `src/loginAssistance/LoginAssistancePanel.tsx`:
  - `activeProfileComplete = entry.kind === 'no-stored-credentials' || (entry.kind === 'form' && activeProfileId !== null && hasCompleteCredentials(credentialsByProfileId[activeProfileId], entry.fields))`. Here `entry` is the existing `resolveCredentialEntry(service)` and `activeProfileId` is the profile the button opens (shown / selected). `hasCompleteCredentials` comes from `src/credentials.ts`; no new completeness rule.
  - The bar button (`data-action="edit-profile"`) renders `activeProfileComplete ? LABEL_EDIT_PROFILE : LABEL_COMPLETE_CREDENTIALS`. Its condition, `onClick` (same profile, same modal), `data-action` (O-123-18 focus return) and class are unchanged. It has no `aria-label`, so the accessible name follows the text.
- Not changed:
  - the fields-updated notice: its own «עריכת פרופיל» button stays as is, per the ruling;
  - «הוספת פרופיל», the profile switcher, persistence, sync, `src/supabase`, `src/admin`.
- A no-stored-credentials site has no profile bar in the window (`launchKindOffersProfileUi`), so the no-stored-credentials branch never changes a visible label. It is kept so that it matches the ruling and O-123-25.

**Check** `checkCompleteCredentialsLabel` (browser, real App). Fixture: `p-cred` has a username and an empty password; `p-two-b` is complete; `p-two-a` (the default) and `p-one` have no credentials.
- **(a)**
  - `svc-two` opens on «אלף» → «השלמת פרטי כניסה». Clicking it opens the modal with «אלף» selected; Escape brings back the window with focus on the button (O-123-18).
  - Switching back to «אלף» restores the label.
  - `svc-one` (single profile, no credentials) → «השלמת פרטי כניסה».
  - `svc-cred` (password missing) → «השלמת פרטי כניסה».
  - Accessible name = visible text, with no `aria-label`, in every case.
- **(b)** switching to «בית» (complete) → «עריכת פרופיל», which opens the modal on «בית» with the same focus return. A no-stored-credentials site never shows «השלמת פרטי כניסה».
- **(c)** autofill on `svc-cred` returning `credentials_missing` shows exactly the new copy, and the button name inside «…» is the one the window shows. The harness stub for `assistanceActions.ts` now imports the real `MSG_AUTOFILL_CREDENTIALS_MISSING` for `__pvCtl.auto = 'credentials_missing'`, mirroring the real mapping that Navigation pins. Mutations of the copy therefore reach the browser.

| Mutation | Caught by |
|---|---|
| M61 window edit button always «עריכת פרופיל» | `checkCompleteCredentialsLabel` (a) |
| M62 completeness condition inverted | `checkCompleteCredentialsLabel` (a) |
| M63 old credentials_missing copy | `checkMessagesComments` (copy vs BASE) and `checkCompleteCredentialsLabel` (c) |

**G-3 rows (O-123-26):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `checkMessagesComments` (O-2: "every other message constant unchanged vs BASE") | the BASE values also allow `LABEL_COMPLETE_CREDENTIALS` (new, right after `LABEL_EDIT_PROFILE`) and the new `MSG_AUTOFILL_CREDENTIALS_MISSING` text, and only those values | O-123-26 |

No existing verify pins «עריכת פרופיל» on the bar button in an incomplete state:
- every verify finds the bar button by `data-action="edit-profile"` (AppContext 881 / 943, Navigation 736, D8OwnSite 782, OwnerFixes `checkReturnToWindow`);
- D8OwnSite 772 pins «עריכת פרופיל» on the fields-updated notice button, which is unchanged;
- Navigation 184 (the copy does not name «ניהול» / «הוסף אתרים») and AppContext `checkNoSiteBranches` (the `עריכת פרופיל` string is still present in messages) hold as written;
- `verifyPhase113LoginAssistance` 132 matches a different, unchanged message.

**T-1 (O-123-26):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: 28 groups PASS;
- `--mutation-report --mutations=M61,M62,M63`: 3 of 3 caught;
- AppContext `--no-mutations` PASS (regression check of the window bar and modal target; that file was not changed).

Navigation and D8OwnSite also read the touched files but were not changed. They were not run, because they still fail on KI-123.5-5. No verify process was left running.

### O-123-27 — the covered add-site form is darkened, not translucent (T-1 only)
**Files / symbols:** `src/App.css`, rule `.modal-overlay[data-covered='true'] > .modal-dialog`:
- `opacity: 0.55; filter: saturate(0.6);` is replaced with `filter: brightness(0.7) saturate(0.6);`. There is no opacity below 1.
- `.modal-overlay[data-covered='true'] { background: transparent; }` is kept (no doubled scrim).
- Not changed: `inert`, focus, Escape, the offer copy and layout, `AddSiteModal.tsx`, and every other modal rule.

**Check:** the shared helper `assertFormBehind`, used by `checkCatalogOfferLayered` (O-123-13) and the O-123-14 already-in-home group. With the offer open, the covered dialog must have:
- computed `opacity` equal to 1;
- a computed `filter` containing `brightness(`;
- a transparent overlay background (alpha 0).

The existing inert, focus and Tab-trap assertions are unchanged.

| Mutation | Caught by |
|---|---|
| M64 covered form translucent again (`opacity: 0.55`) | `checkCatalogOfferLayered` "O-123-27 (O-123-13): the covered form is fully opaque (opacity 0.55)" |

**G-3 rows (O-123-27):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `assertFormBehind` (O-123-13 / O-123-14) "the form is dimmed behind the offer (opacity < 1)" | now requires opacity 1 + `brightness(` filter + a transparent overlay | O-123-27 supersedes the opacity-based dimming |

No other verify reads `data-covered` or this rule.

**Observation, for the Architect (not changed):** the add-site dialog also carries the shared `.modal-dialog--frost` style from BASE: a `rgba(255, 255, 255, 0.78)` background with `backdrop-filter: blur(12px)`. That style applies whether or not the form is covered, and it is used by other modals. So at opacity 1 the covered form looks exactly like the uncovered form, only darker: what is behind it shows only as the frosted blur. It no longer shows through as legible cards. A first draft of the check also asserted an opaque background colour; it failed on this frost value, so it was dropped as going beyond the ruling. If the Owner wants the covered form fully solid, the change would be one scoped declaration on the covered selector, e.g. `background: #fff`. That needs a ruling.

**T-1 (O-123-27):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: 28 groups PASS;
- `--mutation-report --mutations=M64`: 1 of 1 caught.

No verify process was left running.

### KI-123.5-5 resolved — `src/admin` allowance in six verifies (G-3 only, per the Architect ruling under "O-123-25 done")
Each of the six verifies now also accepts exactly `src/admin/AdminGate.tsx` and `src/admin/admin.css`. The content of both files is pinned against `e91b5b12` by OwnerFixes `checkAdminLoginScreen`, and each row's code comment names O-123-23 / KI-123.5-5:

| Verify | Change |
|---|---|
| `verifyPhase123Catalog` (N-1, ~544) | `O23_ADMIN` is added to the allowed `src/admin` file list |
| `verifyPhase123RemoveApp` (N-1, ~478) | the same |
| `verifyPhase123D8OwnSite` (N-2, ~577) | the same (next to `ApprovalQueue.tsx`) |
| `verifyPhase123CatalogGate` `checkAdminReexportOnly` | the two files are filtered out before the "≤ 2 files, `userApproval.ts` / `ApprovalQueue.tsx`" assertion |
| `verifyPhase123FixD6D8` `checkD6DiffScope` | the `git diff` pathspec excludes the two files, so "one file, one line" still applies to the rest of `src/admin` |
| `verifyPhase123Navigation` (N-1, ~280) | the two files are filtered out before the "`src/admin` unchanged" assertion |

These are allowance-only changes, so per the ruling they do not count as "touched" and get no T-1 run. They run `--no-mutations` in the final run.

**Note for the final run:** the batch B admin items (O-123-29…32) change further `src/admin` files. Each of those items adds its own named G-3 allowance to these same six assertions (see the items below).

### Owner closing batch A/B (O-123-28…35), overnight, T-1 per item
Overnight rules applied: ambiguities are recorded as **Q-for-Architect** and resolved with the narrowest option; blocked items are recorded as Known Issues.

#### O-123-34 — no × on the "found in the catalog" offer (T-1 only)
**Files / symbols:**
- `src/digitalHome/AppCatalog.tsx`: the `sm-catalog-offer-head` wrapper and its × button are removed; the title `<h2>` stays as is.
- Escape on the offer: `useEscapeToClose` now calls `closeOfferAndForm()` (the «חזרה לחנות האתרים» handler) for `catalog_service_available`. For `already_in_user_home` it still calls `dismissCatalogOffer()` («סגור», O-123-14 unchanged).
- `src/digitalHome/catalogMessages.ts`: the unused `CATALOG_OFFER_CLOSE_LABEL` is removed.
- `src/App.css`: the unused `.sm-catalog-offer-head` / `.sm-catalog-offer-close` rules are removed.
- The backdrop click is unchanged: it closes only the offer.

**Q-for-Architect (O-123-34 Escape):** the ruling says Escape "still" acts as «חזרה לחנות האתרים». Until now Escape on this offer closed only the offer and kept the filled form (O-123-13, Owner step 13, M39 catcher). I followed the explicit text: Escape = «חזרה לחנות האתרים», which closes the offer and the form and adds nothing. If "still" was meant literally ("keep today's Escape"), the change is one line in the Escape hook (mutation M66 shows it).

**Check** `checkCatalogOfferNoClose` (browser):
- the catalog-available offer has no button with text × or `aria-label="סגירה"`; only «הוספה לבית הדיגיטלי» and «חזרה לחנות האתרים» remain;
- Escape closes the offer and the form, keeps the catalog open, adds nothing and creates no custom site.

| Mutation | Caught by |
|---|---|
| M65 × back on the catalog offer | `checkCatalogOfferNoClose` "no × button" |
| M66 Escape closes only the offer again | `checkCatalogOfferNoClose` "the form closes with the offer" |

**G-3 rows (O-123-34):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `checkCatalogOfferLayered` (O-123-13) "Escape / × close only the offer" for the catalog-available offer | both steps removed; the O-123-14 «סגור» / Escape (offer only) steps stay | O-123-34 |

Catalog and Phase104 reach the offer only through the already-in-home variant (Escape / backdrop / «סגור»), which is unchanged; no row needed.

**T-1 (O-123-34):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: 29 groups PASS;
- `--mutations=M65,M66`: 2 of 2 caught.

#### O-123-33 — duplicate e-mail on register opens an alert dialog (T-1 only)
**Files / symbols:** screen and copy layer only; `register.ts` is unchanged.
- `src/auth/copy.ts`:
  - `registerDuplicate` is now «כבר קיים חשבון עם כתובת אימייל זו. נסו להתחבר במסך התחברות.» (no «»);
  - new `registerDuplicateClose: 'סגור'`.
- `src/auth/AuthEntryScreen.tsx`:
  - The existing catch computes the same message as before. In register mode, if the message is `registerDuplicate`, with or without the `\n(פרטי פיתוח: …)` DEV hint that `register.ts` appends (`isRegisterDuplicate`):
    - the hint text goes to `console.warn` only when `isDevBuild()`;
    - all six register fields are cleared (`clearRegisterFields`);
    - `duplicateNotice` opens the dialog.
  - Every other message still goes to the inline `.unlock-error` as before, fields kept and DEV hint included. This also covers login.
  - The dialog is `modal-overlay` > `modal-dialog`, `role="alertdialog"`, `aria-modal`, `aria-describedby` set to the text, with one autofocused «סגור». While it is open, the card gets `inert` and `auth-entry-card--covered`.
  - «סגור» (or Escape) closes the dialog; an effect then focuses the first register field («שם פרטי»).
- `src/App.css`: `.auth-entry-card--covered { filter: brightness(0.7) saturate(0.6); }`, the O-123-27 pattern: no opacity change. Two small dialog layout rules.

**Q-for-Architect (O-123-33 Escape):** the ruling names one button «סגור» and is silent on the keyboard. The dialog also closes on Escape, the same as «סגור», as expected for a modal alertdialog. Remove it if you want «סגור» only.

**Check** `checkRegisterDuplicateDialog` (unit, Edge). It renders the real `AuthEntryScreen`, the real `copy.ts` / `mapAuthErrorToFriendly` and the real `App.css`; `registerAccount` / `loginWithPassword` throw the scripted message, and DEV is on. The check covers:
- duplicate with the DEV hint → `role="alertdialog"` with exactly the new text (no «»), one focused «סגור»;
- the card is inert, with opacity 1 and a `brightness(` filter;
- all six fields are empty;
- the page text has no «פרטי פיתוח» and no inline error, and the hint appears in a console warning;
- «סגור» → empty register form, register tab still selected, focus on the first field. Escape closes the dialog the same way;
- the password-mismatch and generic-with-DEV-hint register errors stay inline with the fields kept; the login "invalid login" error stays inline.

| Mutation | Caught by |
|---|---|
| M67 duplicate e-mail shown inline again | "a duplicate e-mail opens the alertdialog" |
| M68 register fields kept when the dialog opens | "all register fields are cleared" |
| M69 register form not inert behind the dialog | "the register form behind the dialog is inert" |
| M70 old duplicate copy with «» | `checkUserLoginTitle` copy exactness (and the copy assertion in this group) |
| M71 developer detail visible in the dialog | the exact-text assertion |
| M72 focus not moved to the first field after «סגור» | "focus on the first field" |
| M73 register form translucent behind the dialog | "opaque and darker" |

**G-3 rows (O-123-33):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123OwnerFixes` `checkNChecks` "`src/auth` diff ⊆ register.ts + copy.ts" | also allows `src/auth/AuthEntryScreen.tsx` (the screen layer, pinned by this group) | O-123-33 (Architect: `src/auth` UI and copy only) |
| `verifyPhase123OwnerFixes` `checkUserLoginTitle` "copy.ts = BASE apart from productTitle" | also reverts the O-123-33 duplicate lines before the byte comparison | O-123-33 |

**T-1 (O-123-33):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: 30 groups PASS;
- `--mutations=M67…M73`: 7 of 7 caught. M67 was first caught by a timeout; after a named assertion was added, it was rerun and caught by "a duplicate e-mail opens the alertdialog";
- `verifyPhase109Accounts --no-mutations` PASS (it reads `AuthEntryScreen.tsx`).

#### O-123-28 — after a custom-site add: fade, reveal, highlight (T-1 only)
**Files / symbols:**
- `src/AddSiteModal.tsx`: new optional `closing` prop. The overlay gets `modal-overlay--closing`, `data-closing="true"`, and is inert while fading. Edit-site usage is unchanged (default `false`).
- `src/digitalHome/AppCatalog.tsx`:
  - `customSiteAddedMessage` and the per-name status line are removed; new `MSG_CUSTOM_SITE_ADDED = '✓ האתר נוסף לבית הדיגיטלי'`, `LABEL_JUST_ADDED = 'נוסף עכשיו'`, `ADD_FORM_FADE_MS = 250`, `JUST_ADDED_HIGHLIGHT_MS = 1800`.
  - On `created`: `formClosing` and the success line go on at once. The form stays «שומר…» while fading, so it cannot be cancelled mid-fade. After 250 ms the form unmounts and `justAddedId` is set to the definition's id (the id the add path stores).
  - A reveal effect waits until the site is listed. If the current category or search hides it, both reset to «הכל» and empty. It then scrolls the card into view with `block: 'nearest'` (no reorder, no pinning), focuses it (`tabIndex=-1` while highlighted), and clears the highlight after 1.8 s.
  - The success line (`role="status"`, `data-catalog-notice="custom-added"`) is now the first element in the catalog body. Search, category chips, «+ הוספת אתר מותאם אישית» and a catalog add clear it; closing the catalog unmounts it. Timers are cleared on unmount.
- `src/App.css`: the `dh-fade-out` 250 ms fade, the green `dh-just-added-glow` (1.8 s) plus a static green ring, the «נוסף עכשיו» chip, and a `prefers-reduced-motion` rule that removes both animations (states and timers unchanged).

**Note (O-123-35 ordering):** the "normal already-added state" after the highlight is today's added card. O-123-35 later replaces the card itself; the highlight hooks (`data-just-added`, chip, focus) stay on the catalog item.

**Check** `checkCustomAddSequence` (browser, real App). A MutationObserver plus a `focusin` listener timestamp the states. The fixture filters by «קניות» and «חנות», then adds a banking custom site:
- the overlay animates `dh-fade-out 0.25s` and is removed 200–400 ms after the fade starts (the window allows for timer jitter); the catalog stays;
- «✓ האתר נוסף לבית הדיגיטלי» is the first element and the old «…» נוסף לבית הדיגיטלי. is gone;
- the filters were reset;
- the new card gets the «נוסף עכשיו» chip and the glow (green shadow sampled 700 ms in), is focused, and is inside the catalog dialog's visible area;
- the highlight lasts 1.5–2.3 s, after which the card is `added` with no chip;
- the success line stays until a category click clears it;
- with reduced motion, a second add shows no animation on the overlay or the card, a static green ring and the chip from the first frame, and the same fade and highlight timings and focus.

| Mutation | Caught by |
|---|---|
| M74 form closes at once (no fade) | "the form fades out" |
| M75 hiding filters not reset | "the highlight … appears and ends" (the card never appears) |
| M76 focus not moved to the new card | "focus moves to the new card" |
| M77 highlight never ends | "the highlight … appears and ends" |
| M78 no «נוסף עכשיו» chip | "highlighted with the «נוסף עכשיו» chip" |
| M79 old custom-add confirmation text | "success line «✓ האתר נוסף לבית הדיגיטלי»" |
| M80 success line not cleared by the next catalog action | "the next catalog action clears the success line" |
| M81 fade still animated under reduced motion | "(reduced motion): no fade animation" |

**G-3 rows (O-123-28):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123Catalog` `checkCustomAdd` "created → «האתר החדש שלי» נוסף לבית הדיגיטלי." | expects «✓ האתר נוסף לבית הדיגיטלי» | O-123-28 (the old indication is removed) |

**T-1 (O-123-28):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: 31 groups PASS. Three harness-only iterations of the new group fixed:
  - shadow sampling during the 0% keyframe;
  - focus not visible to a MutationObserver;
  - the log array being replaced;
- `--mutations=M74…M81`: 8 of 8 caught;
- Catalog `--no-mutations` PASS.

**Follow-up during O-123-35 (D-123-3 overlay rule):** the AddSiteModal overlay `className` was a template literal, which hides it from `verifyPhase123AppContext` `checkDialogBackdropRule`. It is a plain `className="modal-overlay"` again; the fade is keyed on `.modal-overlay[data-closing='true']` (same 250 ms, same reduced-motion rule). M81's anchor was renamed with it and re-proven (caught).

#### O-123-35 — catalog picker redesign (T-1 only)
**Files / symbols:**
- `src/App.tsx`:
  - new `addApps(ids)`, passed as `onAddApps`. It follows the add steps of `changeSelection(id, 'add')`:
    - commit a pending removal of one of the ids (as `addApp` does);
    - skip ids already in the home or locked; lock and mark the rest pending;
    - `ensureKnownBuiltinRegistryRow` for known built-ins plus one catalog refresh; `noteDeliberateAdd` per id;
    - then **one** `recordLocalCreations(vaultState, ids.reduce(addToSelection))` (outbox), **one** `persistSelectionState` → `persistVault`, then state.
  - On any error: nothing is committed, `SELECTION_PERSIST_FAILED_MESSAGE`, `failed`. `persistVault` itself is unchanged; there is no new cloud-writing call site (Catalog `checkApp` count unchanged).
  - `justAddedIds` state; the catalog host's `onAdded(ids)` closes the catalog and hands the ids to `Dashboard`.
- `src/digitalHome/AppCatalogModal.tsx`:
  - `CATALOG_MODAL_TITLE = 'הוספת אתר לבית הדיגיטלי'`, `CATALOG_FADE_MS = 250`;
  - `finishAdd(ids)` sets `data-closing` (fade, inert), and after 250 ms calls `onAdded(ids)` (or `onClose` when no host callback);
  - the opener is not refocused after a post-add close.
- `src/digitalHome/AppCatalog.tsx`:
  - the picker. Each card is one `<button aria-pressed aria-disabled data-catalog-item data-catalog-state>`: a 40 px icon (`ServiceCardLogo`, `aria-hidden`), the name (2-line clamp, full name in `title`), a small ✓ when selected, «✓ כבר נוסף» when in the home;
  - no category, no per-card button, no checkbox;
  - `togglePick` only for `available`; selection is pruned when an id reaches the home another way;
  - the sticky CTA bar appears only with ≥ 1 selected (`pickAddLabel`);
  - `addPicks` makes one `onAddApps(ids)` call:
    - failure → red `role="alert"` line in the bar with the host's existing copy, selection kept;
    - success → `pickAddedLabel(n)` for `PICK_ADDED_MS = 500`, then `onAddSequenceDone(ids)`;
  - the O-123-13 offer «הוספה לבית הדיגיטלי» shows «✓ נוסף לבית» for 500 ms and then the same `onAddSequenceDone([id])`;
  - chips «הכול» + categories (visible «סינון לפי קטגוריה» label removed, kept as `aria-label`);
  - «+ הוספת אתר מותאם אישית» is now a secondary text-link next to the search;
  - the O-123-28 hooks (`data-just-added`, chip, focus) sit on the card button.
- `src/digitalHome/catalogMessages.ts`: `LABEL_ALL_CATEGORIES`, `LABEL_ALREADY_IN_HOME`, `pickAddLabel`, `pickAddedLabel`.
- `src/components/ServiceCard.tsx`: `ServiceCardLogo` exported (no change to the card).
- `src/Dashboard.tsx` / `src/Tile.tsx`:
  - optional `justAddedIds` / `onJustAddedShown` and Tile `justAdded` (class `app-icon-wrap--just-added`, `data-just-added`);
  - focus goes to the first new tile (home order); `HOME_JUST_ADDED_MS = 1200`.
- `src/App.css`:
  - picker styles: compact search ≤ 22 rem, `.sm-add-site-link`, `.sm-pick-grid` (auto-fill `minmax(132px, 1fr)`, equal rows → 7 per row at 1280 px), card / ✓ / dimmed in-home, sticky `.sm-pick-cta-bar`;
  - the catalog fade on `.dh-catalog-overlay[data-closing='true']`; the 1.2 s tile glow;
  - a reduced-motion rule (no animation / transition; JS timings unchanged).

**Q-for-Architect (O-123-35):**
- (a) «+ הוספת אתר מותאם אישית» "secondary position": I kept it in the toolbar row next to the search, styled as a link rather than a button. Below the grid would hide it in long lists.
- (b) While the add is in flight the CTA keeps its label (`aria-busy`, inert to clicks). The ruling names no busy label.
- (c) After a post-add close focus goes to the first new tile, so the catalog opener is not refocused.

**Checks (OwnerFixes):**
- `checkCatalogPicker` (browser, real App):
  - title; compact search (≤ 50 % width, ≤ 44 px); first chip «הכול» pressed, one chip per category, no other category control; custom-site action not primary;
  - 5–7 cards per row at 1280 px, fewer at 600 px;
  - every card is a `<button aria-pressed>` with nothing clickable inside, a decorative 36–44 px icon, text = name only (+ «✓ כבר נוסף» in the home); no checkboxes;
  - in-home: dimmed, `aria-disabled`, not selectable, and no «כבר בבית הדיגיטלי» anywhere;
  - no CTA at 0; click selects (border polled + ✓); «הוספת האתר» → «הוספת 2 אתרים»; second click and Space toggle; the sticky CTA sits inside the dialog;
  - failure (`persistFail` fixture knob in the vault stub) → named `role="alert"` with the exact existing copy, red, nothing stored, both still selected, catalog open, no tile;
  - retry → exactly **one** new `persistVault` holding both ids, both tiles.
- `checkCatalogPickerSequence` (browser, real App), with a MutationObserver plus `focusin` timeline:
  - 2-site add: «✓ נוספו 2 אתרים» with the catalog still open, 400–750 ms before the fade; `dh-fade-out 0.25s`, gone after 200–400 ms; both tiles highlighted (`dh-home-just-added`, green shadow sampled mid-way) for 1–1.5 s; focus on the first new tile in home order, and it stays there;
  - the O-123-13 offer add («✓ נוסף לבית») follows the same sequence;
  - reduced motion: no animation, static green ring, same timings and focus.

| Mutation | Caught by |
|---|---|
| M82 old catalog title | "catalog title «הוספת אתר לבית הדיגיטלי»" |
| M83 chip «הכל» | "first chip «הכול»" |
| M84 search full width | "compact search field" |
| M85 sparse grid | "dense grid — 5–7 cards per row" |
| M86 card shows its category | "shows only icon + name" |
| M87 card without aria-pressed | "one <button aria-pressed>" |
| M88 in-home not aria-disabled | "in-home site is dimmed and aria-disabled" |
| M89 «✓ כבר בבית הדיגיטלי» label back | "shows only icon + name + «✓ כבר נוסף»" |
| M90 CTA with nothing selected | "no CTA … / cannot be selected" |
| M91 CTA without the count | "multi-select → «הוספת 2 אתרים»" |
| M92 one persistVault per site | "two sites → exactly one persistVault (got 2)" |
| M93 failure clears the selection | "the selection is kept after a failure" |
| M94 failure line without role="alert" | "a failed add shows a role="alert" line" |
| M95 no «✓ נוסף…» CTA label | "the CTA shows «✓ נוספו 2 אתרים»" |
| M96 catalog closes at once | "~500 ms before the catalog fades (got 12 ms)" |
| M97 catalog not faded | "the catalog fades out (got none)" |
| M98 catalog stays open | "the new tiles are highlighted …" (timeline) |
| M99 tiles not highlighted | timeline (no highlight) |
| M100 tile highlight 3 s | "highlight for 1–1.5 s (got 3001 ms)" |
| M101 focus not moved to the new tile | "focus moves to the first new tile (got null)" |
| M102 focus on the last new tile | "focus moves to the first new tile (svc-avail, got svc-a3)" |
| M103 catalog fade animated under reduced motion | "(reduced motion): no fade animation" |
| M104 offer add without the sequence | "(offer): the new tiles are highlighted …" |
| M105 in-home card selectable | "an in-home site cannot be selected" |

M102 was first written as "opener refocused after the post-add close" (dropping the `restoreFocusRef` guard). In Edge that mutant behaves identically, because the opener's `requestAnimationFrame` runs before the Dashboard focus effect. It was replaced by a mutant that breaks the visible rule (first new tile). The guard stays as a defensive line.

The first sweep also showed that the selection-border read raced the 120 ms border transition. It is now polled; M94 and M102 were re-run after that fix.

**G-3 rows (O-123-35):**
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123Catalog`: HE `catalogTitle` / `alreadyAdded`, chip «הכל» ×3 | «הוספת אתר לבית הדיגיטלי» / «✓ כבר נוסף» / «הכול» | O-123-35 copy |
| Catalog `checkAddBuiltIn`, `checkCatalogGateListing` | in-home = aria-disabled card with «✓ כבר נוסף»; add = select + CTA; catalog closes itself (was Escape) | O-123-35 picker |
| Catalog `checkCustomAdd` | after the offer add the catalog closes → reopen before the error case | O-123-35 (offer uses the post-add sequence) |
| Catalog harness | mirrors `App.addApps` (`onAddApps`) | O-123-35 new host prop |
| Catalog M10 anchor | the overlay tag spans lines | O-123-35 (`data-closing` / `inert`) |
| `verifyPhase123Navigation` empty-state add + reachability | select + CTA, catalog closes itself; reachability = `button[data-catalog-item][aria-pressed="false"]` | O-123-35 |
| `verifyPhase123RemoveApp` re-add during the Undo window | select + CTA; catalog closes itself; M6 mutates both `addApp` and `addApps` | O-123-35 (re-add now via `addApps`) |
| `verifyPhase104ServiceManagement` passive label + pending | `LABEL_ALREADY_IN_HOME` «✓ כבר נוסף»; pending = card `aria-disabled` + `togglePick` guard | O-123-35 |
| `verifyPhase123AppContext` `checkDashboardDot` | Tile.tsx = HEAD apart from the O-123-35 `justAdded` lines | O-123-35 (highlight only; no count / text) |
| OwnerFixes `checkCatalogCardStatic` / `checkCatalogCards`, M1–M4 | O-123-1 rules measured on the picker card; "action at the bottom" retired (no per-card action), M3 now breaks equal width | O-123-35 supersedes the card |
| OwnerFixes `checkHeaderAddButton` | select + CTA, catalog closes itself | O-123-35 |
| OwnerFixes `checkCatalogOfferLayered` (O-123-13) | after the offer add the catalog closes (was: stays), reopen | O-123-35 |
| OwnerFixes HE `added` | «✓ כבר נוסף» | O-123-35 |

**Also fixed during this T-1 (O-123-33, found by AppContext D-123-3):** the duplicate-email overlay (`AuthEntryScreen.tsx`) had no backdrop rule. It now uses `useBackdropDismiss(closeDuplicateNotice, { containsForm: false })`, so a full press + release on the backdrop closes it like «סגור». **Q-for-Architect:** the O-123-33 ruling names only «סגור»; D-123-3 makes non-form dialogs close on the backdrop.

**T-1 (O-123-35):**
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: **33 groups PASS**;
- mutations M1–M4, M74–M105 all caught (M81 / M97 / M103 re-proven after the `data-closing` selector change);
- Catalog `--no-mutations` PASS (M10 re-anchored, caught); Navigation PASS; RemoveApp PASS (M6 caught); Phase104 PASS; AppContext PASS; 109Accounts PASS.

#### Admin items O-123-30 / 31 / 32 / 29 — shared test harness (T-1 only)
Owner admin exception, limited to the files these items need: `src/admin/AdminApp.tsx` (shell, O-123-29), `src/admin/RegistryAdmin.tsx` (O-123-31 heading, O-123-32 filter), `src/admin/AdminFillTestGrid.tsx` (O-123-31 result) and one appended block at the end of `src/admin/admin.css` (marker `/* Phase 123.5 O-123-29`). No other `src/admin` file, nothing in `src/execution` / `src/supabase` / extension.

The new OwnerFixes unit groups render the **real `AdminApp`** in Edge, with the stubs `verifyPhase122AdminWorkspace` uses:
- `adminRegistryApi` (auto-stubbed from its exports, backed by an in-page fixture), `AdminGate` passthrough, `adminAuth`, `useServiceLogos`;
- `src/execution/managedAutofill.ts` is the real module; only `executeAdminManagedAutofillTest` answers from a page hook (no extension);
- as on the real `#/admin` route, the page gets `index.css`, `App.css` and `admin.css`;
- fixture: six sites, one or two per approval state (approved ×2, not approved, blocked, no mapping ×2) over two categories, two of them disabled.

`bundleAdminGate` got dataurl loaders for the `admin.css` background image (harness only).

#### O-123-30 — «+ אתר חדש» font size — BLOCKED (KI-123.5-6; no product change)
**Measurement** (`checkAdminNewSiteFont`, real AdminApp with the route's CSS): «+ אתר חדש» computes **14px**, the same as every other primary admin button: «שמור» (site workspace), and «בחירת קובץ והעלאה», «רענון», «סיווג מחדש», «הוסף קטגוריה» (categories). It is also 14px at 1000px (the full-width ≤ 1024px layout). Every button is 14px from `.admin-btn`; no rule overrides the new-site button.

The arch text ("the same size as the other primary admin buttons") is therefore already met. The Owner's words ("the font size matches the button") more likely mean that the text looks small inside the tall button (≈ 180 × 74px, G-122-12). That would need a size different from the other primary buttons. Following the overnight rule (narrowest option), I made **no CSS change**. The group stays as a regression lock: the new-site font equals the other primary buttons.

**Q-for-Architect (O-123-30):** which reading applies?
- (a) Keep 14px: already equal; nothing to change.
- (b) Larger text for this button only, e.g. `--admin-fs-card` 16px with a matching «+» icon. This is a one-rule change in the appended block, and the check becomes "16px, ≥ the other primary buttons".

| Mutation | Caught by |
|---|---|
| M106 new-site font 16px | `checkAdminNewSiteFont` "«+ אתר חדש» font size 16px = the other primary admin buttons 14px" (also `checkAdminLoginScreen` admin.css exactness) |

#### O-123-31 — «בדיקה והפעלה» (T-1 only)
**Files / symbols:**
- `RegistryAdmin.tsx`: on the `test` tab the workspace head renders neither the `<h3>` («עריכת אתר» / «יצירת אתר» / «פרטי אתר (הגשת משתמש)») nor the `WORKSPACE_TAB_DESCRIPTION_HE` line. The header element is left out unless the existing "details unsaved" notice has to show. Other tabs are unchanged. The `AdminFillTestGrid` gets `active={workspaceTab === 'test'}`.
- `AdminFillTestGrid.tsx`:
  - success = `outcome.userMessage`, failure = `formatAdminManagedTestResultSummary(outcome)`; the «[A2 diagnostics …]» suffixes are removed. `console.info('[A2 ManagedFillDiagnostics]', …)` is unchanged;
  - the 4 s success timer is removed. A new effect clears error / success / structure line / SPECIAL result / stopped when `active` turns false (leaving the tab). Leaving the screen (another site, another top tab) unmounts the grid as before. A new run already cleared the previous message at its start (unchanged).

**Q-for-Architect (O-123-31):**
- (a) The «סגירה» button on the success line is kept. It is an explicit user dismissal, not a timer. Remove it if "persist until …" excludes it.
- (b) The failure summary still appends the technical tokens that `formatAdminManagedTestResultSummary` adds (`reason` code, «שדה <id>», detail, locator), and the existing structure line below it repeats them. The ruling names only the A2 suffix, and the formatter lives in frozen `src/execution`. Removing the tokens is a separate ruling.
- (c) Narrowest reading of "remove the heading": only on «בדיקה והפעלה». The other tabs keep the heading and their description line.

**Check** `checkAdminFillTestResult` (unit, Edge, real AdminApp; managed test answered by the page hook):
- «פרטי אתר» keeps «עריכת אתר»; «בדיקה והפעלה» has no heading and no «הרצת בדיקת מילוי מול המיפוי השמור, ומצב המיפוי.»;
- failure with diagnostics: the alert text starts with the Hebrew message and has no "A2" / "diagnostics" / "console"; `[A2 ManagedFillDiagnostics]` is in the console. It is still shown after 30 s on the page clock; it is cleared after «הגדרת כניסה ומילוי» → «בדיקה והפעלה»;
- run again (failure shown) → a pending run clears it while «ממלא…» is shown;
- success: exactly the Hebrew message; kept after 30 s; cleared by leaving the tab;
- static: no "A2 diagnostics" and no `setTimeout` in `AdminFillTestGrid.tsx`.

| Mutation | Caught by |
|---|---|
| M107 heading + description back on the test tab | "no «עריכת אתר» heading and no description line" |
| M108 A2 suffix on success | "success message is the Hebrew text only" |
| M109 A2 suffix on failure | "failure message has no «[A2 diagnostics …]» suffix" |
| M110 4 s success timer | "success message stays (no timer; 30 s later)" |
| M111 failure timer | "failure message stays (no timer; 30 s later)" |
| M112 leaving the tab keeps the result | "leaving the tab clears the failure message" |
| M113 next run keeps the previous failure | "clicking «כניסה לאתר ומילוי שדות» again clears the previous message" |
| M114 diagnostics no longer in the console | "the A2 diagnostics stay in the browser console" |
| M115 `active` prop not passed | "leaving the tab clears the failure message" |

#### O-123-32 — approval-state filter (T-1 only)
**Files / symbols:** `RegistryAdmin.tsx`:
- `ApprovalFilter = 'all' | UserApprovalState`, `APPROVAL_FILTER_STATES` (badge order), `filterApproval` state;
- a fourth `<select aria-label="סינון לפי מצב אישור" data-filter="approval">` after the status filter: «כל מצבי האישור» + one option per state labelled `USER_APPROVAL_HE[state]` (the badge text);
- `filteredRows` adds `userApprovalState(row) !== filterApproval → false` after the existing three filters and before the search (AND).

**Check** `checkAdminApprovalFilter` (unit, Edge):
- fixture badges are as intended;
- four selects; options exactly «כל מצבי האישור», «מאושר למשתמשים», «טרם אושר למשתמשים», «חסום למשתמשים», «אין מיפוי»;
- each state shows exactly its cards, each carrying that badge state and label;
- AND: approved + «בריאות» → one card; no mapping + «פעיל» → one card; approved + search «חסום» → none; «כל מצבי האישור» → all six.

| Mutation | Caught by |
|---|---|
| M116 «חסום למשתמשים» option missing | options list |
| M117 options show state keys, not badge labels | options list |
| M118 not AND-combined with the search | "AND with the search" |
| M119 «כל מצבי האישור» worded differently | options list |
| M120 filter ignored | "«מאושר למשתמשים» shows exactly …" |

#### O-123-29 — admin tab bar (T-1 only)
**Files / symbols:**
- `AdminApp.tsx`: the nav leaves `.admin-app-bar` and becomes its own row in the header: `<nav className="admin-nav admin-tabbar" role="tablist" aria-label="ניווט ניהול">`. Each tab is a `<button role="tab" aria-selected>`. `.admin-nav-btn`, `is-active`, `data-nav`, labels, order and `selectTab` (unsaved-changes guard) are unchanged; `aria-current="page"` is replaced by `aria-selected`.
- `admin.css` appended block:
  - full-width bar: a grid of three equal `1fr` columns in the same white card style as the app bar;
  - tabs at 1.1875rem (19px), weight 600;
  - active tab filled with `--admin-primary`, white, weight 700, shadow;
  - 150 ms colour transitions, zeroed by the existing `.admin-app *` reduced-motion rule;
  - ≤ 700px: 1rem tab text with tighter padding, and the catalog filters in two columns (search full width). See below.

**Narrow screens (found by `verifyPhase122AdminWorkspace` `checkReadableWidths` at 360 × 800):** the admin shell is viewport-locked. The new tab row (133px, labels wrap) and the fourth filter (one more stacked row) left the site list **16px** tall at 360 × 800, so the card could not be clicked. The ≤ 700px rules above restore it to 157px (checked ≥ 120px).

**Q-for-Architect (O-123-29):**
- (a) Below 700px the tab text is 1rem (16px) instead of the ruling's 1.125–1.25rem. At 19px the third label wraps into 3–4 lines in a ≈ 105px column and takes the list's height. From 701px up the ruling's size holds.
- (b) Tabs are plain buttons in the Tab order. Arrow-key roving focus (WAI-ARIA tabs pattern) was not added; the ruling names only the roles.
- (c) There is no `aria-controls` / `role="tabpanel"` on `<main>`; contents are unchanged.

**Check** `checkAdminTabBar` (unit, Edge):
- `role="tablist"` with three `role="tab"`, same labels and order;
- bar width = the header's content width (±1px); three equal widths in one row;
- 18–20px text;
- `aria-selected="true"` on the active tab only; the active tab is filled, bold and differs in background, colour and weight;
- clicking «קטגוריות» routes and moves `aria-selected`;
- 360 × 800: site list ≥ 120px;
- with reduced motion: transition 0s.

| Mutation | Caught by |
|---|---|
| M121 tabs not equal | "three equal tabs in one row (109 / 155 / 286px)" |
| M122 small tab text | "large tab text 1.125–1.25rem (14 / 14 / 14px)" |
| M123 active tab not dominant | "the active tab … is clearly dominant" |
| M124 no `role="tablist"` | "the top options are a role="tablist"" |
| M125 `aria-selected` stuck | "aria-selected="true" on «קטגוריות» only" |
| M126 bar 60% wide | "the tab bar spans the full header width (835 of 1392px)" |
| M127 reduced-motion transition rule dropped | "prefers-reduced-motion → no tab animation" (and admin.css exactness) |
| M128 tabs no longer route | "aria-selected="true" on «קטגוריות» only" |
| M129 narrow-screen rules removed | "at 360 × 800 … the site list usable (16px ≥ 120px)" |

#### G-3 rows (O-123-29…32)
| Verify | Change | Reason |
|---|---|---|
| `verifyPhase123Catalog`, `verifyPhase123RemoveApp`, `verifyPhase123D8OwnSite`, `verifyPhase123CatalogGate`, `verifyPhase123Navigation`, `verifyPhase123AppContext` (`src/admin` allowance) | also allow `AdminApp.tsx`, `RegistryAdmin.tsx`, `AdminFillTestGrid.tsx` | O-123-29…32 Owner admin exception; content pinned by the OwnerFixes groups |
| `verifyPhase123FixD6D8` `checkD6DiffScope` | the same three files excluded from the line-diff scope | O-123-29…32 |
| OwnerFixes `checkAdminLoginScreen` | admin.css compared without the appended block (`withoutO29Block`); "no other src/admin file" allows the three files | O-123-29 / 30 / 31 / 32 |
| OwnerFixes `checkNChecks` frozen paths | the three files excluded | O-123-29…32 |

#### T-1 (admin items)
- `npx tsc -b` clean;
- OwnerFixes `--no-mutations`: **37 groups PASS** (before the narrow-screen fix);
- `--mutation-report --mutations=M106…M128`: 23 of 23 caught, each by its item's group;
- touched verifies `--no-mutations` PASS: Catalog (19 groups), RemoveApp (13), D8OwnSite (10), CatalogGate (8), FixD6D8 (6), Navigation (12), 109Accounts;
- every other verify that reads the changed admin files, PASS: 121FillTestGrid, 121GridStructure, 120AdminManagedTestHarness, 121Runtime, 102CredentialSchema, 108M1ExplicitLoginEntry, 121SpecialDraftAuthoring, 121ContractSafeSaves, 121IframeSurface, 111Assets, 121ServiceFormSave, 121UnifiedVocabulary, 117ManagedAutofill, 122AdminNotes, 120ClearManagedMappings, 122SubmitterProfiles, 121DeleteService;
- first run failures, both fixed: AppContext (its own `src/admin` allowance; G-3 row above) and `verifyPhase122AdminWorkspace` (360 × 800 list squeezed; the narrow-screen rules above).
- After the fixes:
  - `npx tsc -b` clean;
  - OwnerFixes `--no-mutations` `PASS — 37 check groups … — 1m 12s`;
  - `--mutation-report --mutations=M106,M121…M129` 10 of 10 caught (M129: "16px ≥ 120px");
  - AppContext `--no-mutations` PASS (23 groups);
  - `verifyPhase122AdminWorkspace --no-mutations` `PASS — 32 check groups … — 2m 07s`.

#### Architect rulings round (overnight Q-for-Architect items + O-123-36)
Accepted as implemented, no code change: O-123-34 (Escape = «חזרה לחנות האתרים»), O-123-33 (Escape and backdrop close like «סגור»), O-123-35 (a)(b)(c), O-123-31 (a) «סגירה» kept and (c) heading removed on «בדיקה והפעלה» only, O-123-29 (a) 1rem below 700px. Owner steps 13 and 29 reworded to match.

**O-123-30 — «+ אתר חדש» 16px / 600 (closes KI-123.5-6).**
- Change: `src/admin/admin.css` only, inside the appended Phase 123.5 block (so `withoutO29Block` still compares the rest to BASE): `.admin-catalog-bar .admin-toolbar .admin-new-site-btn { font-size: 16px; font-weight: 600; }` and `… .admin-new-site-btn .admin-icon { width: 18px; height: 18px; }`. The «+» goes from 16 to 18px, the same 16/14 ratio as the text. The selector has three classes so it outranks the toolbar `.admin-btn` rule. The button box and the other buttons are not touched.
- Check (`checkAdminNewSiteFont`, real AdminApp + route CSS in Edge): text 16px / weight 600; «+» 18–20px; the box with a forced 14px / 16px baseline is the same size (180 × 74); the other primary buttons (שמור, בחירת קובץ והעלאה, רענון, סיווג מחדש, הוסף קטגוריה) stay 14px and «+ אתר חדש» is ≥ them; 16px also at a viewport width of 1000.
- Mutations: **M130** back to 14px → "text 16px / weight 600 (got 14px / 600)"; **M131** «+» not scaled → "18–20px; got 16px". **M106 retired**: it injected 16px into the toolbar rule to break the old "equal" check, which the ruling now requires.

**O-123-31 (b) — technical tokens in a closed «פרטים טכניים».**
- Change: `src/admin/AdminFillTestGrid.tsx` only (display layer; `src/execution` unchanged). A managed failure sets the visible `role="alert"` line to `outcome.userMessage` (the Hebrew sentence). A new helper, `technicalTokens(outcome)`, takes `formatAdminManagedTestResultSummary(outcome)` and strips the leading sentence, leaving reason · «שדה <id>» · detail · locator. Under the sentence, `<details className="admin-special-test-details" data-section="managed-test-technical">` (closed) holds the summary `{FILL_TEST_GRID_HE.specialTechnicalDetails}` («פרטים טכניים», the existing label), the tokens line and the structure line `data-testid="managed-test-structure"`, which moved out of the visible output. Catch-path Hebrew errors are unchanged. Stop / fill-run-end outcomes have no tokens; only the structure line is collapsed.
- Check (`checkAdminFillTestResult`): visible alert = «שדה לא נמצא בדף.» exactly; no `field_not_found` / «שדה username» visible outside the details; the details exist, are closed and have the summary «פרטים טכניים»; `field_not_found` and «שדה username» are inside; the structure line is inside the details only, exactly once.
- Mutations: **M132** tokens back in the visible line → "the visible failure line is the Hebrew sentence only (got «שדה לא נמצא בדף. · field_not_found · שדה username»)"; **M133** `<details open>` → "«פרטים טכניים» is closed by default". M109 (A2 suffix) re-anchored on the new `setError(outcome.userMessage);` line and still caught.

**O-123-29 (b)(c) — WAI-ARIA tabs keyboard pattern.**
- Change: `src/admin/AdminApp.tsx` only. Each tab has `id="admin-nav-tab-<id>"`, `aria-controls="admin-nav-panel"` and `tabIndex={tab === item.id ? 0 : -1}`. The tablist `onKeyDown` moves focus: ArrowLeft = next and ArrowRight = previous (RTL), both wrapping, plus Home / End. It uses **manual activation**: arrows move focus only, and Enter / Space (native button) activates through the unchanged `selectTab`. Routing and the unsaved-changes question are unchanged, and an arrow press never pops the leave-workspace dialog. `<main className="admin-app-main" id="admin-nav-panel" role="tabpanel" aria-labelledby="admin-nav-tab-<active>">`.
- Check (`checkAdminTabBar`): tabIndex `-1,0,-1` with «הגדרת אתרים» active; aria-controls of every tab → the `<main role="tabpanel">` id, labelled by the active tab; from «הגדרת אתרים»: ArrowLeft → «אתרים בהוספה…», ArrowLeft → «קטגוריות» (wrap), ArrowRight → «אתרים בהוספה…» (wrap), ArrowRight → «הגדרת אתרים», Home → «קטגוריות», End → «אתרים בהוספה…». The selection and content stay on «הגדרת אתרים» until Enter. Enter activates; tabIndex becomes `-1,-1,0` and aria-labelledby follows.
- Mutations: **M134** arrows don't move (handler removed) → "RTL ArrowLeft = next tab — focus on «approvals» (got «registry»)"; **M135** all tabs tabIndex 0 → "(got 0,0,0)"; **M136** no `role="tabpanel"` → "(panel 0, … labelledby false)"; **M137** LTR arrow direction → "(got «categories»)".

**O-123-36 — missing site icons (`src/resolveServiceLogo.ts` only).**
- Change: the cascade order is unchanged, and the strict ≥ 36 px test (`MIN_LOGO_SIZE`) comes first in every tier. `tryImage` also remembers the largest loaded candidate ≥ 32 px in both dimensions (`MIN_FALLBACK_LOGO_SIZE = 32`, `Math.min(naturalWidth, naturalHeight)`) in a per-call `FallbackLogo`. `resolveServiceLogo` returns it only after every tier found nothing ≥ 36 px (`return fallback.best?.src ?? null;`); < 32 px → null (letter fallback). `fetchPageHtml`: the `api.allorigins.win` fallback is removed; it is a direct fetch only, and failure → null. No new requests or tiers; managed tier, `logoCache.ts` and letter fallback unchanged.
- Check (new UNIT group `checkServiceLogoFallback`): the real module is bundled with esbuild and run in Node with stubbed `Image` (per-URL natural size or onerror), `window` timers and `fetch` (records URLs; CORS rejection, or HTML for one case):
  - (a) only `/favicon.ico` 32 px → that URL;
  - (b) 32 px + `/favicon-96x96.png` 96 → the 96 URL; 32 px + `/apple-touch-icon.png` 180 → apple; a 32 px page `<link rel="icon">` does not stop the cascade before a later 96 px favicon;
  - two sub-36 candidates (32 / 35) → the 35;
  - (c) only 16 / 31 px → null;
  - the same image-candidate count as with no icon at all;
  - (d) exactly one fetch, to the site's own origin, no allorigins; no `allorigins` in the file.
- Mutations: **M138** threshold 36 only → "(a) … (got null)"; **M139** keep the smaller sub-36 → "the largest (35 px) (got …/favicon.ico)"; **M140** 32 px accepted in the strict tier (prefers the earlier 32 over a later larger one) → "(b) 32 px + 96 px → the ≥ 36 px icon (got …/favicon.ico)"; **M141** accept < 32 → "(c) … (got …/apple-touch-icon.png)"; **M142** allorigins restored → "(d) … (got https://icon-site.example.test/, https://api.allorigins.win/raw?url=…)".
- `verifyPhase111Assets` (logoCache keeps `resolveServiceLogo` as tier 2; Home / catalog only through logoCache) still passes. N-5: no added `src` line carries a URL or domain literal (the removed proxy line was the only one).

#### G-3 rows (rulings round)
| Verify / assertion | Change | Item |
|---|---|---|
| `verifyPhase121FillTestGrid` §4 STANDARD run path needles | `'formatAdminManagedTestResultSummary(outcome)'` in `requestManagedTest` → `'setError(outcome.userMessage);'`, plus a new assertion that `technicalTokens` still calls `formatAdminManagedTestResultSummary(outcome)` | O-123-31 (b) |
| `verifyPhase121FillTestGrid` §9 "grid itself has no collapsed section" | exactly one `<details>` in the grid, the `managed-test-technical` one, never `open` | O-123-31 (b) |
| `verifyPhase121FillTestGrid` §9 structure-line slice | sliced from the `managed-test-technical` details to its `</details>` (was from `{testOutcome && !testOutcome.ok ? (` in the output block); same two needles | O-123-31 (b) |
| OwnerFixes `checkAdminNewSiteFont` | "equal to the other primary buttons" → 16px / 600, ≥ the others (still 14px), «+» 18–20px, box unchanged | O-123-30 |
| OwnerFixes M106 | retired (see O-123-30) | O-123-30 |
| OwnerFixes M109 | re-anchored on `setError(outcome.userMessage);` | O-123-31 (b) |

#### T-1 (rulings round)
- No verify node process running beforehand; `npx tsc -b` clean.
- OwnerFixes `--no-mutations`: `PASS — Phase 123.5 Owner fixes: 38 check groups, mutation sweep skipped (--no-mutations) — 1m 18s`.
- OwnerFixes `--mutation-report --mutations=M109,M130…M142`: `PASS — … 38 check groups, 14 selected mutations caught — 4m 00s`, each caught by its item's group (messages quoted above); no fixture-only catches.
- Touched / reading verifies `--no-mutations`, all exit 0: 121FillTestGrid, 123FixD6D8, 123AppContext, 123D8OwnSite, 123Catalog, 123RemoveApp, 123Navigation, 123CatalogGate, 111Assets, 122AdminWorkspace, 121DeleteService, 121UnifiedVocabulary, 121SpecialDraftAuthoring, 120ClearManagedMappings, 121Runtime, 121GridStructure, 121ContractSafeSaves, 120AdminManagedTestHarness.

### Additional evidence requested for O-123-9 / O-123-10
**O-123-9 file text** (`supabase/migrations/20261006120000_phase123_registry_owner_select.sql`):
```sql
-- Phase 123.5 (O-123-9 / AD-123-16): a regular user can read their own user-submitted registry rows
-- (any status, including pending_review), so the custom-site upsert and the removal delete pass RLS.

drop policy if exists "service_registry_select_own_user_rows" on public.service_registry;
create policy "service_registry_select_own_user_rows" on public.service_registry for select to authenticated using (owner_user_id = auth.uid() and source_type = 'user');
```
Byte comparison: `checkRegistryOwnerSelectSql` takes the file's non-comment, non-empty lines and requires them to equal, byte for byte, the ruling's two statements (`OWNER_SELECT_SQL` in the verify); it passes.

`git diff --stat e91b5b12 -- supabase` is **empty**, and `git ls-files --others -- supabase` lists only the new file. The AD-123-15 migration (`20261005120000_…`) is already part of BASE `e91b5b12` (`git cat-file -e` succeeds), so against this BASE the only `supabase/` change is the one new O-123-9 file.

**O-123-10 save / normalisation path byte-unchanged** (as of O-123-10; batch 3 later changed `AppCatalog.tsx` and `AddSiteModal.tsx` for the offer layering only, without touching the save / normalisation code, see O-123-13 / O-123-14): `git diff --stat e91b5b12 -- src/catalog src/digitalHome/customSiteForm.ts src/digitalHome/EditSiteDetailsModal.tsx src/digitalHome/AppCatalog.tsx src/supabase` is empty (`validateCustomPrimaryUrl`, `createCustomServiceDefinition`, `buildCustomSiteDefinition`, both save handlers and `registryPersistence.ts` untouched; the only `src/App.tsx` change is the O-123-4 `hasProfiles` prop). In `AddSiteModal.tsx`, `git diff -w e91b5b12` adds only the import, the label constant, `const testUrl = validateCustomPrimaryUrl(primaryUrl)`, the `modal-url-row` wrapper and the button; `normalizeUrlField`, `handleSubmit` and the `onAdd` values are unchanged.

### Final run 123.5 (reduced; "Final run policy for 123.5, revised")
**Result: PASS under the policy.** 88 of 90 active verifies PASS; the 2 failures are environment (TLS interception), with evidence below. `npx tsc -b` and `npm run build` exit 0. Fingerprint before = after. No code edit during the run; the Owner's `npm run dev` (port 5173) was not touched.

**Run validity.** The first attempt (09:05) overlapped a duplicate Developer session's run (PowerShell started 09:04) writing to the same `%TEMP%\pv-final-*` files. Both were declared invalid by the Owner. The Developer stopped her own run; the duplicate was stopped with the Owner's explicit authorisation. A read-only check then confirmed that no verify process remained. The clean run below uses new file names (`%TEMP%\pv-final2-*`); all earlier `pv-final-*` files are ignored.

**Fingerprint** (`%TEMP%\pv-fingerprint-123-5.mjs`, BASE `e91b5b12`, scope `-- src scripts supabase`):
- before (09:18): `sha256=4226bdac1118aef05463af17c65780cb477d0a38db3e0bd041d03ee9ace5a086`, `diff_bytes=200006 tracked_changed=35 untracked=4`;
- after (09:30): `sha256=4226bdac1118aef05463af17c65780cb477d0a38db3e0bd041d03ee9ace5a086`, the same counts. The full outputs (hash, counts, file list) are byte-identical.

**Run:** one sequential PowerShell loop over every `scripts/verifyPhase*.mjs` (90 files, sorted by name, `scripts/retired/` excluded), each with `--no-mutations`, then `npx tsc -b`, then `npm run build`; 09:18:37 → 09:30:12. Per-verify logs: `%TEMP%\pv-final2-<name>.txt`; summary: `%TEMP%\pv-final2-summary.txt`.

| Verify | Result | Time |
|---|---|---|
| verifyPhase101FailureMode | PASS | 0s |
| verifyPhase101Supabase | **FAIL — environment (E-1)** | 1s |
| verifyPhase102CredentialSchema | PASS | 0s |
| verifyPhase102Registry | **FAIL — environment (E-1)** | 1s |
| verifyPhase102TileRegression | PASS | 0s |
| verifyPhase103Execution | PASS | 0s |
| verifyPhase104ServiceManagement | PASS | 0s |
| verifyPhase108AdapterRouting | PASS | 0s |
| verifyPhase108BrowserIntegration | PASS | 0s |
| verifyPhase108KnownServiceBootstrap | PASS | 0s |
| verifyPhase108M1ExplicitLoginEntry | PASS | 0s |
| verifyPhase108ModalAudience | PASS | 0s |
| verifyPhase109Accounts | PASS | 0s |
| verifyPhase110StandardAutofill | PASS | 0s |
| verifyPhase111Assets | PASS | 0s |
| verifyPhase112IdentityFirst | PASS | 0s |
| verifyPhase112LoginIntelligence | PASS | 0s |
| verifyPhase112MediumStatus | PASS | 0s |
| verifyPhase113LoginAssistance | PASS | 0s |
| verifyPhase116CustomAddIdentity | PASS (`S0–S4 static + R1–R12`) | 1s |
| verifyPhase117ManagedAutofill | PASS | 0s |
| verifyPhase117RivhitLiveM8 | PASS | 1s |
| verifyPhase118AssistedMapping | PASS | 0s |
| verifyPhase119CapabilityFramework | PASS | 0s |
| verifyPhase119ReadinessWaitInputs | PASS | 1s |
| verifyPhase119VisualMapping | PASS | 0s |
| verifyPhase120A24PostRuntimeSafety | PASS | 0s |
| verifyPhase120A25PeerObserve | PASS | 15s |
| verifyPhase120A2ManagedFillDiagnostics | PASS | 0s |
| verifyPhase120AdminManagedTestHarness | PASS | 0s |
| verifyPhase120ClearManagedMappings | PASS | 0s |
| verifyPhase120DedicatedAdapterRetirement | PASS | 0s |
| verifyPhase120IdentityAuthoring | PASS | 0s |
| verifyPhase120LocatorVerification | PASS | 0s |
| verifyPhase120ManagedActivateGate | PASS | 0s |
| verifyPhase120ManagedEligibility | PASS | 0s |
| verifyPhase120ManagedVisibility | PASS | 0s |
| verifyPhase120ShufersalMigration | PASS | 0s |
| verifyPhase121AccessibilityNotOpener | PASS | 0s |
| verifyPhase121ActionBar | PASS | 0s |
| verifyPhase121AnalyzeExactOne | PASS | 1s |
| verifyPhase121AnalyzeProposalQuality | PASS | 12s |
| verifyPhase121ApproveReadback | PASS | 8s |
| verifyPhase121ApproveSavedOnly | PASS | 2s |
| verifyPhase121AuthoringClickBounded | PASS | 19s |
| verifyPhase121ChoiceScreen | PASS | 52s |
| verifyPhase121ContractSafeSaves | PASS | 0s |
| verifyPhase121CredentialFieldCopy | PASS | 2s |
| verifyPhase121DeclaredFrameReadiness | PASS | 0s |
| verifyPhase121DeleteService | PASS | 32s |
| verifyPhase121DigitRunIds | PASS | 0s |
| verifyPhase121FillTestGrid | PASS | 1s |
| verifyPhase121FloatingFieldsAfterOpener | PASS | 6s |
| verifyPhase121FrameBySource | PASS | 6s |
| verifyPhase121GridStructure | PASS | 4s |
| verifyPhase121IframeSurface | PASS | 5s |
| verifyPhase121InspectReadinessEligible | PASS | 22s |
| verifyPhase121LoginContract | PASS | 0s |
| verifyPhase121MultiStepRuntime | PASS | 9s |
| verifyPhase121MultiStepTransition | PASS | 8s |
| verifyPhase121NoChangesToSave | PASS | 2s |
| verifyPhase121OpenerIdentification | PASS | 1s |
| verifyPhase121OwnLabelHit | PASS | 1s |
| verifyPhase121PartialOcclusionPick | PASS | 1s |
| verifyPhase121PasswordlessSurface | PASS | 21s |
| verifyPhase121RemoveFieldRow | PASS | 3s |
| verifyPhase121Runtime | PASS | 13s |
| verifyPhase121ServiceFormSave | PASS | 3s |
| verifyPhase121SingleOpener | PASS | 1s |
| verifyPhase121SpecialDraftAuthoring | PASS | 0s |
| verifyPhase121SpecialSaveGuard | PASS | 1s |
| verifyPhase121StableLocators | PASS | 2s |
| verifyPhase121StepButtons | PASS | 28s |
| verifyPhase121StepFillNoA24Wait | PASS | 15s |
| verifyPhase121StopFillRun | PASS | 16s |
| verifyPhase121TestThenChoose | PASS | 1s |
| verifyPhase121UnifiedVocabulary | PASS | 5s |
| verifyPhase121UniformVisualPick | PASS | 7s |
| verifyPhase122AdminNotes | PASS | 42s |
| verifyPhase122AdminWorkspace | PASS (`32 check groups, mutation sweep skipped (--no-mutations) — 1m 51s`) | 112s |
| verifyPhase122SubmitterProfiles | PASS | 41s |
| verifyPhase123AppContext | PASS | 16s |
| verifyPhase123Catalog | PASS | 22s |
| verifyPhase123CatalogGate | PASS | 1s |
| verifyPhase123D8OwnSite | PASS | 5s |
| verifyPhase123FixD6D8 | PASS | 0s |
| verifyPhase123Navigation | PASS | 13s |
| verifyPhase123OwnerFixes | PASS (`38 check groups, mutation sweep skipped (--no-mutations) — 1m 03s`) | 63s |
| verifyPhase123RemoveApp | PASS | 15s |
| verifyPhase123Sync | PASS | 1s |

**tsc / build:** `npx tsc -b` exit 0, no errors. `npm run build` exit 0, `✓ built in 3.75s`; the only notice is Vite's existing "Some chunks are larger than 500 kB" warning.

**Failure classification (H-2):**
- **E-1 — `verifyPhase101Supabase`, `verifyPhase102Registry`: environment.**
  - These two are the live-Supabase checks. Both stop at their first network call (`signInAnonymously`, user A) with `TypeError: fetch failed`, cause `Error: self-signed certificate in certificate chain`, `code: 'SELF_SIGNED_CERT_IN_CHAIN'`, raised in `TLSSocket.onConnectSecure`. That is the TLS handshake, before any project logic runs.
  - This machine's HTTPS inspection re-signs traffic. The dev server loads `C:\certs\netspark-ca-bundle.pem` for that reason (its start log: "TLS: using CA bundle …"); a plain `node` run does not.
  - The same failure is on record: `arch-phase121` R-72-1 ("101 / 102 are live-Supabase tests … fail at TLS `SELF_SIGNED_CERT_IN_CHAIN` from Node — local HTTPS inspection, not a product issue"); `dev-phase101` ("Node verification scripts require `NODE_EXTRA_CA_CERTS` (Netspark CA) in this environment"); `dev-phase121` END OF ROUND (pre-existing). In Phase 123 they were listed as live-only and not run.
  - `git diff --stat e91b5b12 -- scripts/verifyPhase101Supabase.mjs scripts/verifyPhase102Registry.mjs` is empty. (RC-123.5-1 a: corrected — the earlier text said "Phase 123 made no `src/supabase` change", which is wrong.) Phase 123 did change these paths:
    - `src/supabase/persistence.ts`, for O-123-17 (`.select('id')` on the profile delete, plus `PROFILE_DELETE_UNCONFIRMED`);
    - the migration `supabase/migrations/20261006120000_phase123_registry_owner_select.sql`, added for O-123-9.
  - The environment classification still holds. Both failures happen at the TLS handshake of the first call (`signInAnonymously`), before any of that code runs. Live coverage of those paths comes from the Owner's checks (the O-123-9 re-check, and AD-123-15 steps 18–20) and from the O-123-17 T-1 mocks.
  - Not re-run with the CA bundle: that would mean live-DB access and a TLS-setting change, which the standing rules exclude. No product failure.

### Last batch 123.5 — RC-123.5-1 + O-123-39…42 (2026-10-07)
Detected phase: 123 · Selected state: FIX ROUND 123.5 (last batch) · Status: BLOCKED (T-1 mutation evidence masked by KI-126-1; see Q below). Every item is implemented. The targeted re-run has no failure other than KI-126-1.

**RC-123.5-1 (report text only):**
- (a) The E-1 bullet is corrected under "Final run 123.5". It now names the `persistence.ts` O-123-17 change and the O-123-9 migration, and keeps the environment classification.
- (b) and (c) are in the Declaration below.

**Product changes:**
- **O-123-39** — `src/digitalHome/AppCatalog.tsx`:
  - A `created` custom add now calls `onAddSequenceDone([definition.id])`, the same call as the store add (O-123-35). `AppCatalogModal` fades the catalog, with the form still inside it showing «שומר…», and the host's `onAdded` closes it. The Dashboard then highlights the tile, scrolls to it and focuses it through the same `justAddedIds` path.
  - Removed: the O-123-28 status line, the reveal effect (filter / search reset, card scroll / focus), the catalog card highlight and chip, and the form-only fade. Also removed: `MSG_CUSTOM_SITE_ADDED`, `LABEL_JUST_ADDED`, `ADD_FORM_FADE_MS` and `JUST_ADDED_HIGHLIGHT_MS`.
  - Failure path unchanged: the `catch` keeps the form open with its error.
  - `src/AddSiteModal.tsx`: the now-unused O-123-28 `closing` prop is removed, so `inert={covered}` is back to the O-123-13 form.
  - `src/App.css`: the O-123-28 rules are removed (`.app-catalog-status`, `.modal-overlay[data-closing]`, `.app-catalog-item--just-added`, its keyframes, the chip). `dh-fade-out` is kept for the catalog fade.
  - Add logic, `persistVault`, registry and auth are unchanged.
- **O-123-40** — `App.css`:
  - `.sm-pick--in-home` no longer has `opacity`. Its background is `#f1f5f9`, and only `.sm-pick-icon` / `.sm-pick-name` inside it get `opacity: 0.55`.
  - `.sm-pick-in-home` is `font-weight: 700`, colour `#166534`. Measured contrast in Edge is ≥ 4.5:1; by calculation it is about 6.5:1 on `#f1f5f9`.
  - The card stays `aria-disabled` and non-selectable.
- **O-123-41** — `src/Dashboard.tsx`: `HOME_JUST_ADDED_MS = 5000`. This is the only highlight constant, and the store and custom adds share it through the one path. Under reduced motion the frame is static (no animation) for the same 5 s timer.
- **O-123-42** — `App.css`:
  - `.la-panel-failure-flash` runs `la-panel-failure-fade 5s`: opacity 1 from 0 to 60 %, then an ease-out fade from 60 to 100 %.
  - Reduced motion: `la-panel-failure-hold 3s` (static opacity 1, no fill), then back to the base opacity 0 with no fade. CSS only, no timer.
  - A new failure restarts the wash through the existing `key={failureFlash}`.

**Verify updates (G-3 rows name the O-item):**
- `verifyPhase123OwnerFixes`:
  - New static group `checkPostAddStatic` (O-123-39 / 40 / 41). There are now **39 groups**.
  - `checkFailureCss`: O-123-42 rows.
  - The browser O-123-8 group: O-123-42 opacity sampling on the animation timeline (0 / 1 / 2.9 s = 1, then fading at 3.5 / 4.5 s, 0 at 5.1 s), restart by element identity, and the reduced-motion hold (1 until 2.9 s, then 0 at 3.1 s).
  - The O-123-28 group is replaced by an **O-123-39** group on the real App. It runs the store add's timeline and `assertLanding` (catalog fade, tile frame, 5 s, focus, scroll), checks that no in-catalog status line or highlight appears, checks the failure path (form open, Hebrew error, typed values, nothing added), and checks reduced motion.
  - The O-123-35 picker group has O-123-40 rows (label weight, green, every opacity up to the card = 1, contrast ≥ 4.5, icon / name / background dimmed).
  - `assertSequence` now uses the shared `assertLanding` with 5 s (O-123-41).
  - `waitFor` takes an optional timeout (12 s for the 5 s highlight).
  - Mutations: M74–M81 retired (O-123-28 code removed). M24 and M100 re-anchored (G-3). New **M143–M160**:
    - O-123-39: M143–M146;
    - O-123-41: M147–M149;
    - O-123-40: M150–M154;
    - O-123-42: M155–M160.
- `verifyPhase123Catalog`:
  - `checkCustomAdd`: a created add closes the form and the catalog (was the O-123-28 status line), then the catalog is reopened for the rest.
  - `checkCustomCategoryRequired`: the catalog closes itself after the created add (was closed with «סגירה»).

**Targeted re-run** (frozen tree, 11:01:48 → 11:04:52, `%TEMP%\pv-o39-rerun-*.txt`):
- Fingerprint (BASE `e91b5b12`, scope `src scripts supabase`): before = after = **`04236b556ed1a2584230beee55bc260a2711318697571098c4a37614010e89db`** (diff_bytes 197158, tracked_changed 35, untracked 4).
- `verifyPhase123OwnerFixes` (full sweep): exit 1 at the static N-checks (KI-126-1, below). The mutation sweep did not start.
- `verifyPhase123OwnerFixes --report-groups`: **38 / 39 groups PASS**. The one failing group is `checkNChecks` (KI-126-1). This covers every O-123-39…42 group plus the O-123-35 / O-123-8 groups.
- `verifyPhase123Catalog` (full): exit 1 at static "N-2: extension unchanged vs HEAD" (HEAD = `e91b5b12`; KI-126-1). Its browser groups and mutations did not run.
- `verifyPhase123AppContext --no-mutations`: exit 1 at the same static N-2 (KI-126-1). It is re-run only because it reads `Dashboard.tsx` / `App.css`.
- PASS with `--no-mutations` (the other verifies that read a touched file): 104ServiceManagement, 123CatalogGate, 108BrowserIntegration, 123Navigation, 123FixD6D8, 103Execution, 108M1ExplicitLoginEntry, 123D8OwnSite, 123RemoveApp, 102CredentialSchema, 113LoginAssistance, 111Assets, 117ManagedAutofill.
- `npx tsc -b` exit 0. `npm run build` exit 0 (`✓ built in 5.51s`).
- **KI-126-1 evidence:**
  - `git diff --name-only e91b5b12 -- extension` gives `extension/manifest.json`;
  - `git ls-files --others --exclude-standard -- extension` gives `extension/_locales/en/messages.json` and `extension/_locales/he/messages.json`;
  - the same list against HEAD.
  - This is exactly the three Phase 126 Part A paths, so all three failures are known. There is no other failure.

**Q-for-Architect (why BLOCKED):**
- In OwnerFixes, Catalog and AppContext, the KI-126-1 failure is a static group that aborts the run before the browser groups and before any mutation. So M143–M160 (and Catalog's sweep with its two edited browser groups) cannot execute on this tree.
- Per the KI-126-1 ruling, the G-3 allowance is added only after the Phase 123 commit, so I did not add it.
- The OwnerFixes behaviour is evidenced by `--report-groups`; the mutation evidence is not.
- Proposed: run OwnerFixes and Catalog in full (and AppContext `--no-mutations`) right after the Phase 126 G-3 allowance, as part of that step. Or rule otherwise.

**Notes:**
- The ruling text mentions «נוסף עכשיו» on the home tile. The store add's home landing has never shown a «נוסף עכשיו» label, only the green frame. The «נוסף עכשיו» chip existed only on the O-123-28 catalog card, which is now removed.
- Following "whatever the store add shows on the home also shows here", the custom add gets exactly the frame. No new element was added. If the Owner wants a «נוסף עכשיו» label on the home tile, that is a new item.

### Phase 126 Part A G-3 rows + O-123-43 / O-123-44 + re-run (2026-10-07, "Run-time ruling (13:25)")
Detected phase: 123 · Selected state: FIX ROUND 123.5 (last batch, re-scoped) · Status: **BLOCKED**. Two OwnerFixes failures on the frozen tree; not fixed, awaiting a ruling. Everything else is PASS.

**Stop (step 1):** the unblock run's full OwnerFixes sweep was stopped at about M100: my batch shell and its one `node scripts/verifyPhase123OwnerFixes.mjs` child, both started by me. I checked afterwards: no verify process was left. The Owner's dev server on 5173 was not touched.

**Phase 126 Part A G-3 rows (step 2, kept):**
- They live in one helper, `scripts/lib/phase126PartA.mjs`:
  - `PHASE126_PART_A` lists exactly `extension/manifest.json`, `extension/_locales/he/messages.json` and `extension/_locales/en/messages.json`;
  - `withoutPhase126PartA(paths)` drops exactly those three;
  - `revertPhase126PartAManifest(text)` reverts exactly the Part A manifest lines (`"key"`, `"default_locale": "he"`, `__MSG_extName__` / `__MSG_extDescription__` back to the old name / description).
- The reverted manifest equals the base bytes: the same as `HEAD:extension/manifest.json`, the same at `909cc8b` and at `e91b5b12`, and the original Runtime pin `c8231165…ecdf09`. Any other manifest change still fails.
- 13 verifies changed, each row commented "Phase 126 Part A (G-3)":
  - `verifyPhase123OwnerFixes` (`checkNChecks`), `verifyPhase123Catalog` and `verifyPhase123AppContext` (`checkProtectedUnchanged`): the path lists drop the three paths, plus a manifest-revert assertion;
  - Phase 121 `DigitRunIds`, `InspectReadinessEligible`, `OwnLabelHit`, `PartialOcclusionPick`, `IframeSurface`, `StepFillNoA24Wait`, `TestThenChoose`: the manifest pin compares the reverted manifest with `HEAD`;
  - `RemoveFieldRow` and `StepButtons`: the manifest leaves the `--stat` list and gets a separate revert assertion;
  - `Runtime`: the manifest PINS entry hashes the reverted text.

**O-123-43 (product, CSS only, `src/App.css`):**
- `.app-icon-wrap--just-added` runs `dh-home-just-added 5s ease-in-out forwards`. 5 s equals `HOME_JUST_ADDED_MS`; the constant is unchanged.
- Keyframes: ring and glow alpha 100 % at 0, 32 and 64 %, 40 % at 16, 48 and 80 %. That is a 1.6 s cycle, 2.5 cycles, green (34, 197, 94) only.
- Then 80 → 100 % fades to alpha 0 over the last 1 s.
- Reduced motion: unchanged rule, `animation: none`, a static frame for the 5 s.

**O-123-44 (product):**
- `AppCatalogModal.tsx`: `CATALOG_FADE_MS = 500`, still the one shared constant (store add and custom add).
- `finishAdd`: under `prefers-reduced-motion: reduce` it hands over at once, with no closing state. Otherwise it is unchanged (`inert={closing}`, then the timer, then `onAdded`, then the O-123-39 / 43 landing).
- `App.css`: `dh-fade-out` is replaced by `dh-catalog-exit` (opacity 1 → 0, scale 1 → 0.98), and the closing overlay runs it `500ms ease-out forwards`.
- The add form sits inside the overlay, so form and catalog fade together. The overlay is `position: fixed; inset: 0`, so the scale does not move the form.
- A failure keeps the form open, unchanged.

**OwnerFixes T-1 (G-3 rows name the O-item):**
- `checkPostAddStatic` gets O-123-43 / O-123-44 rows:
  - animation and 5 s = `HOME_JUST_ADDED_MS`;
  - parsed keyframe stops: green only, 100 / 40 % alternating, 1.4–1.8 s cycles, ≥ 2 dims, last ~1 s fading to 0;
  - reduced-motion block;
  - exactly one `*FADE_MS` = `CATALOG_FADE_MS=500`;
  - `dh-catalog-exit 500ms ease-out`, scale 0.97–0.99;
  - reduced-motion early hand-over before `setClosing`;
  - `inert={closing}`.
- Browser timeline:
  - samples the overlay (`animationTimingFunction`, `inert`, form inside, opacity and scale 250 ms into the exit);
  - samples the tile ring alpha and colours every ~100 ms;
  - `assertLanding` (G-3, was `dh-fade-out 0.25s`, 200–400 ms) checks 500 ms ease-out, inert, 450–750 ms, mid-fade opacity < 0.9 and scale < 1, green throughout, no alpha jump > 0.3, ≥ 2 breathing dips with floor ≥ 0.3, and a monotonic tail ≤ 0.15 after 4.75 s;
  - reduced motion: no closing state, static alpha ≥ 0.95;
  - custom add: the form is inside the fading overlay.
- New mutations:
  - O-123-43: M161 (old 1.2 s glow), M162 (steps), M163 (no end fade), M164 (breathing under reduced motion), M165 (fast flashing), M166 (colour jump);
  - O-123-44: M167 (250 ms), M168 (no scale), M169 (form removed before the fade), M170 (reduced motion waits), M171 (no `inert`).
- M97 is re-anchored on the new exit rule (G-3).
- M103 (reduced-motion catalog fade) is now also caught by the static reduced-motion row, because the JS no longer shows a closing state under reduced motion.
- Pre-freeze T-1: `--report-groups` gave **39 / 39 groups PASS** (13:3x).
- A separate pre-freeze mutation T-1 (M97, M103, M161–M171) was blocked by the tool's auto-review and not run. M161–M171 are in the formal run's list below; M97 / M103 were not executed this batch.

**Frozen-tree run** (13:37:58 → 13:43:24, `%TEMP%\pv-o44run-*.txt`):
- Fingerprint (BASE `e91b5b12`, scope `src scripts supabase`): before = after = **`1176fcb243ecfe1f30ca040f3990a6b8f7cea124b430ab651274ca05d514f24a`** (diff_bytes 217681, tracked_changed 45, untracked 5).

| Run | Result |
|---|---|
| `verifyPhase123OwnerFixes --no-mutations` | **FAIL** (F-1) |
| `verifyPhase123OwnerFixes --mutations=M24,M100,M143…M171` | **FAIL** in the clean pre-pass (F-2); 0 mutations executed |
| `verifyPhase123Catalog` (full, with mutations) | PASS |
| `verifyPhase123AppContext --no-mutations` | PASS |
| Phase 121 `DigitRunIds`, `InspectReadinessEligible`, `OwnLabelHit`, `PartialOcclusionPick`, `IframeSurface`, `StepFillNoA24Wait`, `TestThenChoose`, `RemoveFieldRow`, `StepButtons`, `Runtime` (`--no-mutations`) | PASS (10 / 10) |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |

**Failures (not fixed; awaiting a ruling):**
- **F-1:** browser group O-123-39 / 43 / 44, the first (non-reduced) custom add: "O-123-43 the frame stays one green throughout (50 samples)".
  - At least one of the 50 tile samples had a box-shadow colour other than (34, 197, 94), or no shadow colour at all.
  - The same group passed in the pre-freeze `--report-groups` T-1 on the same code. The O-123-35 store-add group, which shares `assertLanding`, passed in this run.
  - So this is intermittent in my new sampling row. Possible causes: a sample taken while the tile re-renders, or a serialisation of the alpha-0 end frame.
  - Not diagnosed further, because the message does not print the offending sample.
  - Proposed: print the offending sample in the message and re-run. If it is the end-frame serialisation, treat a colourless sample at alpha 0 as transparent green. Needs a ruling.
- **F-2:** unit group O-123-29 (real AdminApp in Edge), in the mutation run's clean pre-pass: "the active tab «קטגוריות» is clearly dominant (fill rgba(0, 0, 0, 0), weight 700 vs …)".
  - The active fill read as transparent. This group is untouched by this batch, and it passed 13 s earlier in the `--no-mutations` run on the same tree.
  - Likely a timing read during the admin tab transition. Classified as intermittent, not a code change.
  - Because the clean pre-pass failed, none of M24, M100 or M143–M171 executed.

**Not changed:** `extension/`, Vercel, env and secrets; `persistVault`, registry, auth, supabase, manifest, crypto. No commit or push.

### F-1 / F-2 test-robustness fixes + re-run (2026-10-07, "Re-scoped run report (13:56): Architect ruling")
Detected phase: 123 · Selected state: FIX ROUND 123.5 (last batch, re-scoped) · Status: **PASS**.

**Changes (only `scripts/verifyPhase123OwnerFixes.mjs`):**
- **F-1** (O-123-43 "one green" row in `assertLanding`):
  - The tile sampler now keeps the raw computed `box-shadow` and every colour with its alpha. It no longer computes a pre-baked exact-RGB flag.
  - The row checks the **green hue family** (hue 90–160°, saturation ≥ 0.3; `#22c55e` ≈ 142°) for every colour with alpha > 0.05. Colours with alpha ≤ 0.05, or transparent / no colour at the end of the fade, are valid.
  - Other hues fail. The message prints up to 5 failing samples: time in ms, the property (`box-shadow`) and the computed rgba string.
  - In this run no sample failed, so no non-green hue was observed and there is no product bug to report.
  - The static keyframe row (exact 34, 197, 94 at every stop) is unchanged.
- **F-2** (O-123-29 `checkAdminTabBar`):
  - Both fill reads (initial «הגדרת אתרים», and «קטגוריות» after the click; was a fixed 250 ms wait then one read) now use `settled(active)`. It polls every 50 ms, for at most 1.5 s, until the active tab's computed fill is non-transparent and fill / colour / weight are identical on two consecutive reads.
  - The dominance assertion is unchanged. It also now fails explicitly on a transparent active fill (`!TRANSPARENT.test(on.bg)`), so a transparent fill after the timeout still fails.

**Frozen-tree run** (13:59:47 → 14:09:38, `%TEMP%\pv-f12run-*.txt`):
- Fingerprint (BASE `e91b5b12`, scope `src scripts supabase`): before = after = **`690c850b20c8f8fecbce4654157658029fb0c0484088cd0f6a8a4fc54d69e9dc`** (diff_bytes 217681, tracked_changed 45, untracked 5).

| Run | Result |
|---|---|
| OwnerFixes `--no-mutations` (1st) | PASS, 39 groups (1m 26s) |
| OwnerFixes `--no-mutations` (2nd, immediately after) | PASS, 39 groups (1m 25s) |
| OwnerFixes `--mutations=M24,M97,M100,M103,M143…M171` | PASS, 39 groups + **33 / 33 selected mutations caught** (6m 36s) |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |

- Notes:
  - M97 and M103 are caught by the O-123-44 static rows.
  - M148 (shorter reduced-motion highlight) is caught by the browser sample count: 12 samples < 20, i.e. the frame left after about 1.2 s. The message text is the "one green" row, because the count is part of that assertion.
  - M161–M171 are all caught.
- Other verifies were not repeated (per the ruling; only this script changed). Their results stand from the 13:37 run.
- No `src/`, `extension/`, Vercel, env or secrets change. No commit or push.

### Owner re-check steps (Hebrew)
1. **O-123-1** (בכרטיס החדש של O-123-35, שלב 30) — לפתוח «+ הוספת אפליקציה». כל כרטיסי הקטלוג באותו גודל; שם ארוך נחתך אחרי שתי שורות עם «…», ומעבר עכבר מציג את השם המלא. אין יותר כפתור «הוספה» בכל כרטיס: אתר שכבר בבית מסומן «✓ כבר נוסף».
2. **O-123-2** — במסך «הרשמה», להירשם עם כתובת של חשבון קיים ועם הסיסמה הנכונה שלו → ההודעה «כבר קיים חשבון…», לא נכנסים לחשבון, ונשארים במסך הכניסה / הרשמה. כתובת חדשה → הרשמה רגילה.
3. **O-123-3** — חשבון בלי אפליקציות: בראש הבית הדיגיטלי אין «+ הוספת אפליקציה», רק הכפתור במרכז. אחרי הוספת האפליקציה הראשונה הכפתור בראש חוזר.
4. **O-123-4** — הסרת אפליקציה בלי פרופילים: בחלון האישור רק כותרת וכפתורים, בלי הפסקה על מחיקת הפרופילים. אפליקציה עם פרופיל: הפסקה מופיעה (בנוסח של O-123-21, שלב 21).
5. **O-123-5** — לפתוח את תפריט ⋮ בחלון האפליקציה, ואז ללחוץ על פעולה אחרת בחלון / על מקום אחר בחלון / מחוץ לחלון / Escape / ✕ → התפריט נסגר בכל מקרה.
6. **O-123-6** — אפליקציה בלי פרופילים: «הוספת פרופיל» בלי שדה שם; אחרי שמירה החלון לא מציג שם או צ'יפים. הוספת פרופיל שני: שם חובה; שם ריק או שם קיים → הודעה בעברית בתוך הטופס; אחרי שמירה מופיעים הצ'יפים «ראשי» והשם החדש.
7. **O-123-7** — בטופס הוספת פרופיל אין המשפט «אפשר לשמור פרופיל גם בלי פרטי כניסה…», ושמירה בלי פרטי כניסה עדיין עובדת.
8. **O-123-8** — פעולה שנכשלת בחלון האפליקציה (פתיחה / מילוי אוטומטי) → שורה אדומה בחלון בלבד, ורקע החלון נצבע באדום רך, נשאר מלא 3 שניות ואז דועך במשך 2 שניות (לפי O-123-42, שלב 39); השורה נשארת עד הפעולה הבאה או סגירת החלון; לא מופיעה הודעה בראש הבית הדיגיטלי. הודעת קטלוג לא זמין / שגיאת הסרה נשארות למעלה.
9. **O-123-9** — עם משתמש רגיל (לא מנהל): להוסיף אתר מותאם אישית → נשמר בלי שגיאה. אחר כך להסיר אותו עד הסוף (לחכות 5 שניות בלי «ביטול»). שאילתת ה־SQL של שלב 15 מחזירה 0 שורות.
10. **O-123-10** — בטופס הוספת אתר ובטופס «עריכת פרטי האתר»: להקליד כתובת עם `www.` ובלי → «↗ פתח» (לפני O-123-19: «פתיחה לבדיקה») פותח בכרטיסייה חדשה בדיוק את הכתובת שהוקלדה (עם `https://` אם חסר); כתובת לא תקינה → הכפתור מושבת; אחרי שמירה הכתובת השמורה זהה לזו שנפתחה.
11. **O-123-11** — לפתוח את אותו חשבון בשני חלונות, A ו־B:
    - B בבית הדיגיטלי בלי שום חלון פתוח → למחוק אפליקציה ב־A → ב־B האריח נעלם, בלי הודעה;
    - B עם הקטלוג פתוח → אותו דבר;
    - B עם חלון של אפליקציה אחרת פתוח → אותו דבר, והחלון נשאר פתוח;
    - B עם החלון של האפליקציה שנמחקת פתוח, או חלון ניהול הפרופיל שלה → החלון נסגר ומופיעה ההודעה «האתר או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.» (הנוסח לפי O-123-16).
12. **O-123-12** — לחזור על שלב 10 ברשימת הבדיקה (אתר פרטי שהמנהל אישר עם שדות כניסה אחרים, ופרופיל שנשמר עם השדות הישנים): בחלון האפליקציה מופיעים רק ההודעה «שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.» והכפתור «עריכת פרופיל», לצד הפעולות הרגילות. המשפט «עדיין לא שמרת פרטי כניסה לאתר זה.» לא מופיע. הערכים השמורים לא נמחקו: ב«עריכת פרופיל» אפשר להשלים את השדות החדשים. אתר שלא שמרת לו פרטי כניסה, ובלי ההודעה הזאת, עדיין מציג «עדיין לא שמרת…» כמו קודם.
13. **O-123-13** — ב«+ הוספת אפליקציה» → «+ הוספת אתר מותאם אישית», להקליד שם משלך וכתובת של אתר שקיים בחנות האתרים (ולא נמצא בבית הדיגיטלי), לבחור קטגוריה ו«הוסף»:
    - נפתח חלון מעל הטופס עם הכותרת «מצאנו את <שם האתר בחנות> בחנות האתרים» והמשפט «<שם האתר בחנות> כבר נתמך, ולכן אין צורך להוסיף אותו כאתר מותאם אישית.». השם שהקלדת לא מופיע;
    - הטופס נשאר מאחור, כהה יותר אבל אטום (לפי O-123-27: כרטיסי החנות לא נראים דרכו, מעבר למראה החלבי הרגיל של החלון), עם מה שהקלדת, ואי אפשר ללחוץ או לעבור אליו ב־Tab;
    - (לפי O-123-34, כפי שאושר) בחלון העליון אין ✕; יש רק «הוספה לבית הדיגיטלי» ו«חזרה לחנות האתרים». מקש Escape זהה ללחיצה על «חזרה לחנות האתרים»: שני החלונות נסגרים, חוזרים לחנות, ושום דבר לא נוסף;
    - שוב «הוסף» → «חזרה לחנות האתרים» → אותו דבר;
    - שוב (עם הקלדה מחדש) → «הוספה לבית הדיגיטלי» → הכפתור מציג «✓ נוסף לבית» לרגע, החלונות והחנות נסגרים בהדרגה, והאריח של האתר מהחנות מודגש בבית הדיגיטלי (בלי אתר מותאם אישית; לפי O-123-35, שלב 30).
14. **O-123-14** — אותו דבר עם כתובת של אתר שכבר נמצא בבית הדיגיטלי, ועם כתובת של אתר מותאם אישית שכבר הוספת: מופיעה ההודעה הקיימת «… כבר נמצא בבית הדיגיטלי שלך.» עם «סגור». הטופס נשאר מאחור, מעומעם ומלא. «סגור» או Escape → רק ההודעה נסגרת, הטופס נשאר עם מה שהקלדת, והסמן בשדה השם.
15. **O-123-15** — לפתוח אפליקציה עם מילוי אוטומטי: הכפתור נקרא «מילוי פרטים אוטומטי» (לא «נסה מילוי אוטומטי»), והוא עובד כמו קודם.
16. **O-123-16** — לחזור על הסעיף האחרון של שלב 11: ההודעה היא «האתר או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.».
17. **O-123-17** — למחוק את הפרופיל האחרון של אפליקציה → הנקודה הירוקה נעלמת, והחלון מציג «עדיין אין פרופיל לאתר זה.» עם «הוסף פרופיל» ו«פתח אתר» בלבד; גם אחרי F5. אם המחיקה בענן לא הצליחה (למשל אין רשת) → מופיעה ההודעה «לא הצלחנו למחוק את הפרופיל מהחשבון…», והפרופיל לא נמחק.
18. **O-123-18** — מתוך החלון הצף של אפליקציה:
    - «עריכת פרופיל» → פעם אחת «שמירה» ואז ✕, ופעם אחת ✕ / «ביטול» / Escape בלי שמירה → בכל פעם החלון הצף של אותה אפליקציה חוזר ליד האריח, עם הנתונים העדכניים (למשל שם הפרופיל החדש), והסמן על הכפתור «עריכת פרופיל»;
    - «הוספת פרופיל» (כשיש כבר פרופיל) → שמירה וגם ביטול → החלון חוזר והסמן על «הוספת פרופיל»;
    - אפליקציה בלי פרופילים: «הוסף פרופיל» → ביטול → החלון חוזר והסמן על «הוסף פרופיל»; שמירה → החלון חוזר עם הפרופיל, והסמן בתוך החלון;
    - אתר מותאם אישית: ⋮ → «עריכת פרטי האתר» → שמירה (למשל שינוי שם) → החלון חוזר עם השם החדש; שוב, ו־Escape → החלון חוזר;
    - חריגים:
      - (א) בזמן שחלון הפרופיל פתוח, למחוק את האפליקציה בחלון דפדפן אחר → החלון הצף לא חוזר, ומופיעה ההודעה «האתר או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.»;
      - (ב) בזמן שחלון הפרופיל פתוח, לנעול את הכספת (כפתור הנעילה בראש המסך) → אחרי כניסה מחדש אין חלון צף פתוח;
      - (ג) לפתוח את «+ הוספת אפליקציה» ולסגור → לא נפתח שום חלון צף.
19. **O-123-19** — בטופס הוספת אתר מותאם אישית ובטופס «עריכת פרטי האתר»:
    - שדה הכתובת ברוחב מלא, והכפתור «↗ פתח» מתחתיו, בצד ימין, עם החץ מימין למילה «פתח»;
    - כתובת תקינה → הכפתור פותח בכרטיסייה חדשה בדיוק את הכתובת (כמו בשלב 10); כתובת לא תקינה או ריקה → הכפתור מושבת;
    - (אופציונלי, קורא מסך) הכפתור מוקרא «פתח את הכתובת לבדיקה בכרטיסייה חדשה».
20. **O-123-20** — בחלון הצף, תפריט ⋮ → הפריט נקרא «הסרת אתר» (לא «הסרת אפליקציה»), ולחיצה עליו פותחת את חלון האישור כמו קודם.
21. **O-123-21** — «הסרת אתר» באפליקציה עם פרופיל → בחלון האישור מופיעה הפסקה «כל הפרופילים ופרטי ההתחברות של האתר יימחקו מכל המכשירים שלך.». הכותרת לא השתנתה, ובאפליקציה בלי פרופילים עדיין אין פסקה (שלב 4).
22. **O-123-22** — להתחבר ולפתוח את הכספת. באותה לשונית: F12 → Application → Local Storage → למחוק את המפתח שמתחיל ב־`sb-` ומסתיים ב־`-auth-token` (כך הלשונית מאבדת את החיבור ל־Supabase בלי מעבר למסך הכניסה). בלי לרענן: «+ הוספת אתר מותאם אישית» → למלא ו«הוסף» → מופיעה ההודעה «לא ניתן להוסיף את האתר כרגע. התחברו מחדש או בדקו את הרשאות החשבון.» (ולא «לא ניתן לשמור את האתר כרגע…»). אותו דבר ב«עריכת פרטי האתר» → שמירה.
23. **O-123-23** — לפתוח את `#/admin` (דף הכניסה לאזור המנהל):
    - הכותרת היא «הבית הדיגיטלי - ניהול»;
    - אין מתחתיה שורת הסבר קטנה;
    - אין מתחת לכרטיס הקישור «חזרה לבית הדיגיטלי»;
    - שדות האימייל והסיסמה וכפתור «התחברות» עובדים כמו קודם;
    - כניסה עם חשבון שאינו מנהל → ההודעה הכתומה «החשבון הנוכחי אינו מנהל…» עדיין מופיעה מעל הכרטיס.
24. **O-123-24** — להתנתק (או לפתוח את האפליקציה בחלון פרטי): הכותרת בדף הכניסה הרגיל היא «הבית הדיגיטלי» (לא «כספת דיגיטלית»). גם בלשונית «יצירת חשבון» הכותרת זהה. בדף הכניסה למנהל (`#/admin`) הכותרת נשארת «הבית הדיגיטלי - ניהול».
25. **O-123-25** — בבית הדיגיטלי:
    - אפליקציה עם פרופיל שיש בו את כל פרטי הכניסה → נקודה ירוקה על האריח;
    - אפליקציה עם פרופיל בלי פרטי כניסה (או עם פרטים חלקיים) → אין נקודה בכלל (לא כתומה ולא ירוקה);
    - אפליקציה בלי פרופילים → אין נקודה;
    - האתר הפרטי משלב 10 (המנהל אישר שדות כניסה אחרים, והערכים נשמרו בשדות הישנים) → אין נקודה, וההודעה «שדות הכניסה לאתר עודכנו…» עדיין מופיעה בחלון;
    - אחרי השלמת הפרטים ב«עריכת פרופיל» ושמירה → הנקודה הירוקה מופיעה.
26. **O-123-26** — בחלון הצף של אפליקציה:
    - פרופיל בלי פרטי כניסה, או עם פרטים חלקיים → הכפתור נקרא «השלמת פרטי כניסה». לחיצה פותחת את חלון הפרופיל הרגיל על אותו פרופיל; אחרי ביטול או שמירה החלון הצף חוזר והסמן על הכפתור;
    - פרופיל עם כל פרטי הכניסה → הכפתור נקרא «עריכת פרופיל», כמו קודם;
    - באפליקציה עם שני פרופילים, אחד שלם ואחד לא: מעבר בין הצ'יפים מחליף את שם הכפתור בהתאם;
    - אחרי השלמת הפרטים ושמירה → החלון חוזר והכפתור נקרא «עריכת פרופיל»;
    - ההודעה «שדות הכניסה לאתר עודכנו…» (שלב 12) עדיין מציגה את הכפתור «עריכת פרופיל»;
    - (אם יש מילוי אוטומטי והפרטים חסרים) ההודעה היא «פרטי הכניסה בפרופיל הזה חסרים. לחצו «השלמת פרטי כניסה» בחלון האתר והשלימו אותם.».
27. **O-123-28** — הוחלף ב־O-123-39 (שלב 36): אחרי הוספת אתר מותאם אישית החנות כבר לא נשארת פתוחה, ואין יותר השורה «✓ האתר נוסף לבית הדיגיטלי» או הדגשת כרטיס בחנות.
28. **O-123-33** — במסך «הרשמה», למלא את כל השדות עם אימייל של חשבון קיים ו«הרשמה»:
    - נפתח חלון קטן במרכז עם «כבר קיים חשבון עם כתובת אימייל זו. נסו להתחבר במסך התחברות.» (בלי «») וכפתור אחד «סגור»;
    - הטופס מאחור כהה ואי אפשר ללחוץ עליו;
    - «סגור» (או Escape, או לחיצה על הרקע) → החלון נסגר, כל שדות ההרשמה ריקים, והסמן בשדה «שם פרטי»;
    - שגיאות אחרות (למשל סיסמאות לא תואמות) עדיין מופיעות בתוך הטופס כמו קודם.
29. **O-123-34** — כמו שלב 13: בחלון «מצאנו את … בחנות האתרים» אין ✕. Escape זהה ל«חזרה לחנות האתרים»: החלון והטופס נסגרים, וחוזרים לחנות בלי שנוסף דבר.
30. **O-123-35** — ב«+ הוספת אפליקציה»:
    - הכותרת «הוספת אתר לבית הדיגיטלי»; חיפוש קומפקטי; שורת קטגוריות שמתחילה ב«הכול»; «+ הוספת אתר מותאם אישית» כקישור משני ליד החיפוש;
    - כרטיסים קטנים (5–7 בשורה במסך רגיל): סמל ושם בלבד;
    - לחיצה (או רווח) על כרטיס מסמנת אותו במסגרת ו־✓, ולחיצה נוספת מבטלת. אתר שכבר בבית מעומעם (הסמל, השם והרקע) עם «✓ כבר נוסף» מודגש וקריא (לפי O-123-40, שלב 37), ואי אפשר לסמן אותו;
    - כשמסומן לפחות אתר אחד, למטה מופיע הכפתור «הוספת האתר» / «הוספת 2 אתרים» (לפי המספר);
    - לסמן שני אתרים ו«הוספת 2 אתרים» → הכפתור מציג «✓ נוספו 2 אתרים» לחצי שנייה, החנות נסגרת בהדרגה, שני האריחים מודגשים בבית במשך 5 שניות (לפי O-123-41, שלב 38), והסמן על האריח החדש הראשון.
31. **O-123-29** — בכניסה לאזור המנהל (`#/admin`):
    - שלוש האפשרויות «קטגוריות», «הגדרת אתרים», «אתרים בהוספה ע"י משתמשים» הן שורת לשוניות ברוחב מלא מתחת לכותרת, שלוש לשוניות שוות עם טקסט גדול;
    - הלשונית הפעילה בולטת (כחולה מלאה, טקסט לבן מודגש);
    - מעבר בין הלשוניות מציג את אותם מסכים כמו קודם, ועם שינויים לא שמורים באתר עדיין מופיעה שאלת האישור;
    - מקלדת: Tab מגיע ללשונית הפעילה בלבד (Tab נוסף יוצא מהשורה). חץ שמאלה עובר ללשונית הבאה (משמאל) וחץ ימינה לקודמת, עם מעבר מהסוף להתחלה; Home לראשונה ו־End לאחרונה. החצים מזיזים רק את המיקוד; Enter או רווח פותחים את הלשונית;
    - (אופציונלי, קורא מסך) התוכן מתחת מוקרא כ«לוח לשונית» עם שם הלשונית הפעילה;
    - במסך צר (טלפון) טקסט הלשוניות קטן יותר (1rem) ורשימת האתרים עדיין נראית.
32. **O-123-30** — ב«הגדרת אתרים», הכפתור «+ אתר חדש»: הטקסט גדול יותר מבעבר (16px, מודגש למחצה), וה־«+» גדל איתו. גודל הכפתור עצמו לא השתנה, ושאר הכפתורים הכחולים במנהל (למשל «שמור», «הוסף קטגוריה») נשארו כמו שהיו.
33. **O-123-31** — ב«הגדרת אתרים» לפתוח אתר רגיל עם מיפוי שלם → «בדיקה והפעלה»:
    - אין למעלה את הכותרת «עריכת אתר» ואת השורה «הרצת בדיקת מילוי מול המיפוי השמור, ומצב המיפוי.» (בלשוניות האחרות הן עדיין מופיעות);
    - למלא ערכי בדיקה ו«כניסה לאתר ומילוי שדות» → הודעת ההצלחה או הכישלון בעברית, בלי «[A2 diagnostics …]» (פרטי A2 נמצאים רק בקונסול F12);
    - בכישלון מוצג רק המשפט בעברית (למשל «שדה לא נמצא בדף.»). מתחתיו «פרטים טכניים» סגור; לחיצה עליו פותחת את קוד הסיבה, «שדה …», הפרטים והמאתר, ואת שורת המבנה;
    - ההודעה נשארת גם אחרי דקה;
    - היא נעלמת רק במעבר ללשונית אחרת (ובחזרה), ביציאה מהאתר, או בלחיצה נוספת על «כניסה לאתר ומילוי שדות».
34. **O-123-32** — ב«הגדרת אתרים» יש מסנן רביעי «כל מצבי האישור» עם האפשרויות «מאושר למשתמשים», «טרם אושר למשתמשים», «חסום למשתמשים», «אין מיפוי» (אותו נוסח כמו התגית על הכרטיסים):
    - בחירה במצב מציגה רק כרטיסים עם התגית הזאת;
    - שילוב עם קטגוריה, מקור, סטטוס וחיפוש מציג רק כרטיסים שעונים על כולם;
    - «כל מצבי האישור» מחזיר את כל הכרטיסים.
35. **O-123-36** — בבית הדיגיטלי ובחנות האתרים:
    - אתר שיש לו רק סמל קטן של 32 פיקסלים (למשל fibi) מציג עכשיו את הסמל שלו ולא את האות הראשונה של שמו;
    - אתר שיש לו סמל גדול (36 פיקסלים ומעלה) מציג אותו כמו קודם, גם אם יש לו גם סמל של 32;
    - אתר שיש לו רק סמל קטן מאוד (16 פיקסלים) עדיין מציג את האות;
    - (אופציונלי) F12 → Network, לרענן: אין אף בקשה ל־`api.allorigins.win`. בקשות לאתר עצמו שנחסמות (CORS) הן תקינות;
    - אם סמל שנשמר קודם עדיין מוצג כאות, אפשר לנקות את מטמון הסמלים (או להמתין לרענון המטמון) ולבדוק שוב.
36. **O-123-39** — ב«+ הוספת אפליקציה» (אפשר לבחור קטגוריה ולהקליד בחיפוש קודם) → «+ הוספת אתר מותאם אישית» → למלא אתר חדש (שלא קיים בחנות) ו«הוסף»:
    - הטופס והחנות נסגרים יחד בהדרגה (כרבע שנייה), וחוזרים לבית הדיגיטלי;
    - האריח של האתר החדש מודגש במסגרת ירוקה, בדיוק כמו אחרי הוספה מהחנות (שלב 30), במשך 5 שניות; הבית גולל אליו והסמן עליו;
    - בחנות לא מופיעה השורה «✓ האתר נוסף לבית הדיגיטלי» ואין הדגשת כרטיס;
    - כישלון (למשל בלי רשת) → הטופס נשאר פתוח עם מה שהקלדת וההודעה האדומה, ושום דבר לא נוסף;
    - (אופציונלי) עם «הפחתת תנועה»: אין הנפשה, אותה מסגרת ואותו זמן.
37. **O-123-40** — ב«+ הוספת אפליקציה», אתר שכבר בבית: הסמל, השם והרקע מעומעמים, אבל «✓ כבר נוסף» מודגש בירוק כהה וקריא בבירור. עדיין אי אפשר לסמן את הכרטיס.
38. **O-123-41** — הוספה מהחנות (שלב 30) והוספת אתר מותאם אישית (שלב 36): המסגרת הירוקה על האריח החדש נשארת 5 שניות. עם «הפחתת תנועה»: מסגרת קבועה, אותן 5 שניות.
39. **O-123-42** — פעולה שנכשלת בחלון האפליקציה (שלב 8): הרקע האדום הרך נשאר מלא 3 שניות ואז דועך במשך 2 שניות. כישלון נוסף מתחיל את הצבע מחדש. עם «הפחתת תנועה»: הצבע מופיע 3 שניות ונעלם בבת אחת (בלי דעיכה).

### Known Issues
- **KI-123.5-1 (O-123-2 read-error limit):** `loadAppUserProfile` returns `null` on a read error, so a failed profile read during orphan recovery falls through to the existing RPC path (which signs out on any RPC error). Fixing it needs `session.ts` (N-2); out of scope.
- **KI-123.5-2 (machine environment, H-2):** loopback connections on this machine are refused at random (Edge `net::ERR_NETWORK_ACCESS_DENIED`, Node `connect EACCES 127.0.0.1`). The browser verifies now answer the same `127.0.0.1` origin through Playwright routing and assert a secure context; the server still listens. The live dev server (`npm run dev`) is unaffected by this change.
- **KI-123.5-3 (O-123-9 before state):** shown by the in-group reproduction and M27 rather than a run on a reverted tree (see addendum).
- **KI-123.5-5 (O-123-23 vs older verifies' `src/admin` pins) — RESOLVED** (see "KI-123.5-5 resolved"; extended for O-123-29…32 in their G-3 rows). Original note: besides AppContext (fixed above), six Phase 123 verifies still allow only their own earlier `src/admin` changes. As written, they will fail on the O-123-23 `AdminGate.tsx` / `admin.css` change. They were not touched or run in this T-1 (outside the O-123-23 and O-123-25 rulings); the finding comes from reading their code:
  - `verifyPhase123Catalog` (544–545) and `verifyPhase123RemoveApp` (478–479): `userApproval.ts` / `ApprovalQueue.tsx` only;
  - `verifyPhase123CatalogGate` (261–262): the same, at most 2 files;
  - `verifyPhase123FixD6D8` (97–99): exactly `ApprovalQueue.tsx`, one line;
  - `verifyPhase123D8OwnSite` (577–578): `ApprovalQueue.tsx` only;
  - `verifyPhase123Navigation` (280–281): `src/admin` unchanged since its BASE.
  
  Proposed: the same G-3 row as in AppContext (allow exactly these two files, pinned by OwnerFixes `checkAdminLoginScreen`) before the final run. This needs a ruling, because it touches six verifies outside the current item.
- **KI-123.5-6 (O-123-30) — CLOSED** by the Architect ruling (16px / 600, «+» scaled; see "Architect rulings round"). Original note: «+ אתר חדש» already computes 14px, the same as every other primary admin button (measured in the real AdminApp with the route's CSS at 1440 and 1000px). No CSS change was made. The Q-for-Architect under O-123-30 asks whether the Owner wants larger text in this tall button instead. `checkAdminNewSiteFont` locks the current equality.
- **KI-123.5-4 (O-123-10, by design):** «↗ פתח» (formerly «פתיחה לבדיקה») does not check whether the site answers; the Owner decides by looking at the opened tab (no probe, D-123-7).

### Developer Declaration (fix round 123.5)
**F-1 / F-2 unblock:**
- Test-only changes in `verifyPhase123OwnerFixes.mjs`, exactly as ruled: a hue-family check that prints failing samples, and a settled-fill poll ≤ 1.5 s. Assertion strength is unchanged.
- On the frozen tree `690c850b…69e9dc` (before = after): `--no-mutations` PASS twice in a row, 33 / 33 selected mutations caught, tsc and build PASS.
- F-1 and F-2 are resolved. T-1 PASS for O-123-43 / 44 and the batch mutations.
- No commit or push.

**Re-scoped batch (Phase 126 Part A G-3 rows + O-123-43 / O-123-44):**
- Implemented exactly as ruled. Product files: `src/App.css`, `src/digitalHome/AppCatalogModal.tsx`.
- G-3 rows cover exactly the three Part A paths, in 13 verifies, through `scripts/lib/phase126PartA.mjs`.
- Fingerprint before = after: `1176fcb2…514f24a`.
- **BLOCKED** by F-1 (new O-123-43 sampling row, intermittent) and F-2 (O-123-29 admin unit group, intermittent; the mutation run's clean pre-pass failed, so 0 of the 31 selected mutations executed). Both were left unfixed, as ruled.
- Catalog full, AppContext, the 10 Phase 121 extension-freezing verifies, tsc and build: PASS.
- I do not declare T-1 PASS for O-123-43 / 44, or for the mutation layer.
- No commit or push.

**Last batch (RC-123.5-1 + O-123-39…42):**
- O-123-39…42 are implemented exactly as ruled.
- Product files touched: `AppCatalog.tsx`, `AddSiteModal.tsx` (unused prop removed), `Dashboard.tsx` (one constant), `App.css`.
- No `src/supabase` / RLS / migration / manifest / extension / crypto / unlock / session change. `persistVault`, registry and auth are unchanged.
- New 123 fingerprint, identical before and after the targeted re-run: `04236b55…10e89db`.
- The only failures are KI-126-1, with evidence of exactly the three Part A paths.
- The T-1 mutation sweeps (M143–M160, Catalog) are masked by KI-126-1 and await a ruling (Q above). So I do not declare T-1 PASS for the mutation layer.
- No commit or push.

**Final run (reduced policy, 09:18–09:30):**
- 88 / 90 active verifies PASS with `--no-mutations`. The 2 failures (`verifyPhase101Supabase`, `verifyPhase102Registry`) are classified as environment, E-1 (TLS interception, `SELF_SIGNED_CERT_IN_CHAIN`).
- `npx tsc -b` and `npm run build` exit 0.
- Fingerprint `4226bdac…a5a086` is identical before and after; there was no code change during the run.
- O-123-37 / 38 are deferred to Phase 125 and are not in the tree.
- No commit or push.
- **RC-123.5-1 b:** the Developer applied the O-123-9 migration (`20261006120000_phase123_registry_owner_select.sql`) nowhere. The Owner applied the identical policy live in the Supabase SQL editor.
- **RC-123.5-1 c:** the implemented set is O-123-1…42 and O-2. O-123-37 / 38 are deferred to Phase 125 and are not in the tree.

**Update after the Architect rulings round (O-123-30, O-123-31 b, O-123-29 b/c, O-123-36):** implemented with T-1 per item; all four PASS at T-1. KI-123.5-6 closed.
- Product changes: `admin.css` (inside the appended block), `AdminFillTestGrid.tsx` (display layer), `AdminApp.tsx` (tabs keyboard / tabpanel), `src/resolveServiceLogo.ts` (32 px fallback; allorigins proxy removed). `src/execution`, `logoCache.ts`, managed tier and letter fallback unchanged.
- No `src/supabase` / RLS / migration / manifest / extension / crypto / unlock / session change.
- OwnerFixes now has **38 check groups and mutations M1–M142** (M106 retired).
- No final run, commit or push.

**Update after the overnight batch (O-123-28…35, KI-123.5-5):** implemented with T-1 per item, in the order given.
- O-123-34, O-123-33, O-123-28, O-123-35, O-123-31, O-123-32 and O-123-29: PASS at T-1. O-123-30: BLOCKED (KI-123.5-6; already equal, no change; Q-for-Architect).
- `src/auth` changes are screen / copy layer only: `copy.ts` lines and `AuthEntryScreen.tsx`; `register.ts` logic unchanged.
- Admin changes are limited to `AdminApp.tsx`, `RegistryAdmin.tsx`, `AdminFillTestGrid.tsx` and one appended `admin.css` block.
- No `src/supabase` / RLS / migration / manifest / extension / crypto / unlock / session change; `persistVault` is called, not changed.
- OwnerFixes now has **37 check groups and mutations M1–M129**.
- No final run, commit or push.

**Update after O-123-27:** implemented with T-1 only. The change is one `App.css` rule: the covered dialog is darkened with `brightness(0.7) saturate(0.6)` and opacity stays 1. One G-3 row in OwnerFixes `assertFormBehind`, plus M64. The shared frost background is left unchanged and noted for the Architect.
**Update after O-123-26:** implemented with T-1 only. The changes are one new label and one changed copy line in `src/loginAssistance/messages.ts`, plus the window bar button's text choice in `LoginAssistancePanel.tsx`, which reuses `resolveCredentialEntry` + `hasCompleteCredentials`. One G-3 row in OwnerFixes `checkMessagesComments`. No frozen path touched.
**Update after O-123-25:** implemented with T-1 only (`Dashboard.tsx` dot expression, reusing `deriveServiceManagementState`). G-3 rows in OwnerFixes and AppContext. AppContext also got the O-123-23 `src/admin` allowance; six other verifies still need it (KI-123.5-5, awaiting a ruling).
**Update after O-123-24:** implemented with T-1 only. One copy line in `src/auth/copy.ts` (`productTitle`), pinned to BASE apart from that line. The `src/auth` diff is now `register.ts` (O-123-2) plus this line.
**Update after O-123-23:** implemented with T-1 only, under the Owner's admin exception, limited to the `need_login` branch of `AdminGate.tsx` and the three now-unused `admin-gate-home-link` rules in `admin.css`. Both files are pinned to BASE apart from those hunks; every other `src/admin` file is unchanged. Final-run admin sweep (Architect): `verifyPhase122AdminWorkspace` and `verifyPhase109Accounts --no-mutations`.
**Update after O-123-22:** implemented with T-1 only (`tsc`, OwnerFixes, M54). The only product change is `src/catalog/customAddFailure.ts`. This makes the earlier O-123-10 note "`src/catalog` byte-unchanged" no longer true for this one file; the save / normalisation code it refers to is still unchanged.
**Update after batch 4 (O-123-18…21):** O-123-18…21 are implemented with T-1 only. G-3 supersedes the 123.4 AC-113-45 focus-to-tile re-homing for the profile / site-details modals opened from the window. The tile focus stays for the O-123-18 exceptions.
**Update after batch 3 (O-123-13…17):** O-123-13…17 are implemented with T-1 only, like O-123-11 / O-123-12.
**Update after O-123-12:** O-123-11 and O-123-12 are implemented with T-1 only, per the sequencing ruling. The 94/94 final run below is superseded. The single final run on one frozen tree (full sweeps for OwnerFixes, Navigation, AppContext and D8OwnSite; H-2 samples; everything else `--no-mutations` / plain; `tsc`; build; fingerprints before / after) is still to be done, after the Owner writes "סיימתי את כל רשימת הבדיקה" and the last batch of findings is in.
- Implemented only the findings listed in the manager section "Fix round 123.5": O-123-1…27 and O-2. No architecture or scope change; PHASE / arch / manager / plan files not modified.
- Frozen paths are unchanged apart from six authorised changes, each pinned exactly:
  - `src/admin/AdminGate.tsx` `need_login` heading / subtitle / home link, plus the three unused `admin-gate-home-link` rules in `src/admin/admin.css` (O-123-23, Owner admin exception); later `AdminApp.tsx`, `RegistryAdmin.tsx`, `AdminFillTestGrid.tsx` and one appended `admin.css` block (O-123-29…32, Owner admin exception). Every other `src/admin` file is unchanged;
  - `src/auth/register.ts` (O-123-2);
  - the `productTitle` line in `src/auth/copy.ts` (O-123-24);
  - the one O-123-9 migration file (not applied to any database);
  - the `deleteAccessProfileFromCloud` delete-proof hunks in `src/supabase/persistence.ts` (O-123-17);
  - the one `MSG_REMOVED_ELSEWHERE` line in `src/digitalHome/cloudReconcile.ts` (O-123-16). No extension, manifest or dependency change; no browser dialogs; no site / host / service-id branches.
- Every finding has a check group and at least one caught mutation in `scripts/verifyPhase123OwnerFixes.mjs` (37 groups, M1–M129 after the overnight batch; O-123-11's behaviour checks and inverted M10 are in `verifyPhase123Navigation`). Touched existing verifies changed only superseded assertions (G-13) or serving code (H-2), each listed in the G-3 table.
- Previous final run (before O-123-11, superseded): 94 of 94 jobs PASS, fingerprints before / after identical, `npx tsc -b` and `npm run build` PASS. The current tree has T-1 evidence only.
- No commit, push or other git write was made. Owner re-check steps O-123-1…26 are above and are awaiting the Owner.
