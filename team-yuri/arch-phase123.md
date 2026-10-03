# Architecture Phase 123 — Unified Digital Home (user side)

## Phase Identifier
PHASE=123

## Status
STATUS: DRAFT — technical design complete for review; behaviour that depends on open Product questions (§12) is marked GATED and must not be implemented before Product decides.

## Phase Goal
Make the Digital Home the single user workspace: open apps, switch profiles, edit a profile and its credentials, add profiles, add apps from a catalog overlay, and remove apps — all without leaving the Digital Home. The standalone «ניהול אתרים» screen stops being a user destination. The Admin area is unchanged.

## Source References
- Product input (source of truth for behaviour / UX): Tika, "digital-home-unified-PRD" (Owner-provided, 2026-10-03). Referenced by its IDs: §8.1–8.7, FR-01…FR-18, A1–A6, R1–R6, OQ-01…OQ-03. Not rewritten here.
- Code map (read 2026-10-03): `src/App.tsx`, `src/Dashboard.tsx`, `src/Tile.tsx`, `src/loginAssistance/*` (floating window), `src/ManageServices.tsx`, `src/ServiceProfileManagementModal.tsx`, `src/loginAssistance/DigitalHomeCredentialModal.tsx`, `src/AddSiteModal.tsx`, `src/vault/*`, `src/profile/*`, `src/serviceManagement/*`, `src/supabase/persistence.ts`, `src/supabase/registryPersistence.ts`, migrations phase101 / phase102 / phase109.
- Prior decisions kept: AC-104-16 (remove-site semantics) — superseded only by the OQ-01 decision; Phase 121 / 122 Admin decisions (untouched).

## 1. Current state (facts the design builds on)

| Topic | Today | Gap vs PRD |
|---|---|---|
| Navigation | `App.tsx` `Screen = 'manage' \| 'dashboard'`; post-login goes to `manage` when the user has no sites; Dashboard «ניהול אתרים» ↔ ManageServices «לבית הדיגיטלי» | §8.1 / FR-01: one workspace |
| Tile indicator | Green dot = default profile has ALL login fields filled (`Dashboard.tsx` `hasCompleteCredentials` on `credentialsByServiceId`) | A4 is not true today; FR-15 redefines the dot as "≥ 1 profile" |
| Floating window | `LoginAssistancePanel`: profile chips (only when > 1 profile and credentials exist), read-only fields, «פתח אתר», «נסה מילוי אוטומטי», «הוסף פרטי כניסה» (only when missing) | No edit, add-profile, remove-app; no empty state (FR-06/08/14/17) |
| Profile management | `ServiceProfileManagementModal` (tabs, save credentials, rename, set default, delete profile, add profile, in-dialog confirmations); already reachable from Digital Home via `DigitalHomeCredentialModal` | Reusable as the PRD "Profile Management Modal" (FR-07) |
| Profile auto-creation | `ensureDefaultProfileForService` creates «ראשי» whenever the credential modal opens | Conflicts with FR-13/14 (an app can legitimately have 0 profiles) and with the new dot meaning |
| Catalog | Only inside ManageServices «הוספת אתרים»: search, category chips, cards, «✓ כבר בבית הדיגיטלי», «הוספה», «+ הוסף אתר» (custom) with duplicate classifier | Must open over the Digital Home (FR-09…FR-12) |
| Add without profile | Adding a catalog app only adds the id to `selectedIds` — already profile-less | FR-13 satisfied by the data model |
| Remove app | ManageServices kebab «הסר אתר», NO confirmation; local profiles / credentials kept (AC-104-16) while the cloud cascade deletes them | FR-17/18; inconsistent local vs cloud (OQ-01) |
| Delete profile | Cloud first, then local; the LAST profile cannot be deleted; deleting the default promotes another | OQ-02; 0-profile state now valid |
| Dialogs | No `window.confirm` on the user side; per-screen modal markup; Admin has `AdminConfirmDialog` (not shared) | Need a user-side confirm primitive |
| Telemetry | None (no analytics SDK); dev-only console | PRD metrics (§6) |

## 2. Architectural Decisions

| ID | Decision | Rationale | Consequence |
|---|---|---|---|
| AD-123-1 | One user screen: Digital Home. Remove `'manage'` from user navigation; post-login always lands on Digital Home (0 apps → empty-home state with «+ הוספת אפליקציה») | §8.1, FR-01 | `resolvePostAuthScreen` / `Screen` simplified; ManageServices retired after parity (AD-123-9) |
| AD-123-2 | Floating window (`LoginAssistancePanel`) becomes the app context: profile switcher, «עריכת פרופיל» (active profile), «הוספת פרופיל», empty state, an app-actions menu with «הסרת אפליקציה» | §8.2/8.3/8.5/8.7, FR-02/05/06/08/14/17; reuse existing component | Panel grows by actions only; R5 — no general management inside the panel |
| AD-123-3 | The PRD "Profile Management Modal" = the existing `ServiceProfileManagementModal`, opened via one Digital Home host (merge the duplicated wiring of `DigitalHomeCredentialModal` into a single host), focused on the active profile, with an "add profile" entry mode | FR-06/07/08; no new credential UI | No new save path; copy / error mapping unified |
| AD-123-4 | Credentials and profiles are written ONLY through the existing reducers (`addAccessProfile`, `renameAccessProfile`, `setDefaultAccessProfile`, `saveCredentialForProfile`, `deleteCredentialForProfile`, `deleteAccessProfile`) + `persistVault` + existing cloud functions. No new storage, crypto, key or sync mechanism | Owner constraint; zero-knowledge model unchanged | Crypto / unlock / `persistVault` / RLS untouched |
| AD-123-5 | A profile is created only by an explicit user "add profile" save. Opening the modal never auto-creates «ראשי» on the user path (`ensureDefaultProfileForService` no longer called from Digital Home flows) | FR-13/14; green dot must mean what it says | Legacy migration helper `vaultMigration.ensureDefaultProfileForService` unchanged (unlock-time migration of old vaults) |
| AD-123-6 | Green dot rule = the app has ≥ 1 profile (`accessProfiles.some(p => p.serviceId === id)`), one pure helper used by the tile; no count, no textual status on tiles | FR-15/16, §8.6 | Behaviour change for profiles with incomplete credentials — see TQ-1 |
| AD-123-7 | Default profile: exactly-one-default invariant kept (`normalizeExactlyOneDefaultPerService`). Floating window opens on the default (fallback: the only / first profile). Switching in the window is session-local and does not change the stored default; the default is changed only by the explicit modal action | FR-04/05; existing invariant | TQ-3 confirms with Product |
| AD-123-8 | Catalog overlay: extract ManageServices «הוספת אתרים» (search, categories, cards, already-added marking, add, custom add + duplicate classifier) into a container-agnostic `AppCatalog` body hosted in an overlay opened from Digital Home «+ הוספת אפליקציה». Closing returns to the same Digital Home state | FR-09…FR-13, R6 (reuse), OQ-03 (container is a UX choice) | Default container = large modal until OQ-03 decides; body independent of container |
| AD-123-9 | Retirement of ManageServices as a user destination: delete the screen only after a parity matrix shows every capability lives in Digital Home context (list = Digital Home grid; edit / profiles = modal; add = catalog; remove = app menu; custom site details edit = app menu for `user-created` apps, see TQ-2) | A6, migration safety | Reversible until the last slice; no data migration needed (§7) |
| AD-123-10 | User-side confirm primitive: one accessible in-app dialog (focus trap, Escape, `role="alertdialog"`), no browser dialogs. Copy-only parameters | FR-18, R4 | May reuse the pattern of `AdminConfirmDialog`, but no import from `src/admin` (boundary) |
| AD-123-11 | Removal / profile-deletion semantics are implemented exactly as Product decides OQ-01 / OQ-02, applied consistently to BOTH the local vault and the cloud in one operation (no state where local and cloud disagree after success) | R4; today's AC-104-16 inconsistency | GATED until Product decision |
| AD-123-12 | Observability without a new telemetry system: PRD diagnostic metrics are computed server-side from existing timestamps (`user_services.created_at`, `access_profiles.created_at`) via an admin-only aggregate (SQL / RPC, counts only, no per-user data, no credential data). Client logs stay dev-only and never contain credential values | §6 diagnostic metric; no analytics SDK exists | Adding product analytics (task funnels) = separate decision (§10) |

## 3. Constraints / Non-Negotiables
- Admin area (`src/admin/**`, `#/admin`, admin RPCs / policies) unchanged.
- No change to authentication, unlock, key derivation, encryption, `persistVault`, sync algorithm, or RLS of user tables.
- No new credential storage or alternative save path (AD-123-4).
- No browser dialogs; Hebrew RTL; existing Digital Home visual language.
- Fail-closed on cloud errors for destructive actions (existing pattern: block and show an error, nothing changes locally).
- No extension / manifest change. Login / autofill execution (`executeServiceFromTile`, managed autofill) unchanged.
- GATED items (§12) not implemented before a written Product decision.

## 4. Technical Boundaries / Out of Scope
- Out: Admin; registry / approval model; catalog data model; login execution; credential crypto; Phase 2 refinements (PRD §13); product analytics SDK.
- Out (pre-existing, recorded, not fixed here unless separately approved): see §11 risks P-1…P-4.
- Boundary — Digital Home: tiles, floating window (app context), app-actions menu, empty states, hosts for the modal and the catalog.
- Boundary — App Catalog: discovery and "add to home" only (search, categories, cards, already-added, add, custom add). It never edits profiles and never removes apps.
- Boundary — Profile Management: one app's profiles and credentials only (modal). It never adds / removes apps.

## 5. Components — changed / unchanged

| Component | Change |
|---|---|
| `App.tsx` | Remove `'manage'` screen path and `manageIsFirstRun`; host the catalog overlay and the single profile-management host; wire remove-app with confirmation |
| `Dashboard.tsx` | Replace «ניהול אתרים» with «+ הוספת אפליקציה»; empty-home state; green-dot helper (AD-123-6) |
| `Tile.tsx` | Indicator input changes to "has profile"; markup unchanged |
| `LoginAssistancePanel.tsx` (+ `credentialsGate.ts`, `messages.ts`) | Profile switcher for ≥ 2 profiles regardless of credential completeness; «עריכת פרופיל»; «הוספת פרופיל»; 0-profile empty state + CTA; app-actions menu («הסרת אפליקציה»; «עריכת פרטי האתר» for `user-created`, TQ-2) |
| `ServiceProfileManagementModal.tsx` | Open on a given profile; "add profile" entry mode; deletion rules per OQ-02 |
| `DigitalHomeCredentialModal.tsx` | Becomes the single Digital Home host (or merged); no auto-create |
| New `AppCatalog` body + overlay host | Extracted from ManageServices (logic reused: `filterDiscoveryServices`, `userFacingCategories`, `classifyAddCustomService`, `AddSiteModal`) |
| New user confirm dialog | AD-123-10 |
| `ManageServices.tsx` | Retired at the end (AD-123-9) |
| `serviceSelection.ts`, `profileManagement.ts`, `persistence.ts` | Reused; only the removal / profile-delete composition changes per OQ-01 / OQ-02 |
| Unchanged | `src/vault/crypto.ts`, `vault.ts` (`persistVault`), `db.ts`, sync / hydrate algorithm, `src/execution/**`, `extension/**`, `src/admin/**`, registry loaders, migrations of user tables |

## 6. Interface contracts (between Digital Home, App Catalog, Profile Management)
- Digital Home → Catalog: `openCatalog()`; Catalog → host callbacks `onAddApp(serviceId) → Promise<AddOutcome>`, `onAddCustom(definition) → Promise<CustomAddOutcome>` (existing `addService` / `addCustomService` semantics), `onClose()`. Input: `selectedIds`, catalog services, categories, pending ids. No profile data enters the catalog.
- Digital Home → Profile Management: `openProfileManagement({ serviceId, profileId?, mode: 'edit' | 'add' })`. Callbacks reuse the existing reducer set (AD-123-4) through `onVaultStateChange`, plus `onDeleteProfile` per OQ-02. Output to Digital Home: updated `VaultState` only.
- Digital Home → removal: `removeApp(serviceId) → Promise<'removed' | 'failed'>`, always behind the confirm dialog; implementation per OQ-01.
- Pure helpers (testable): `appHasProfile(state, id)`, `initialActiveProfile(profiles)`, `appContextActions(service, profiles)`.

## 7. Data / State Considerations
- Data model: no schema change required for MVP. 0-profile apps are already representable locally (`selectedIds` without profiles) and in the cloud (`user_services` without `access_profiles`).
- Default profile: `AccessProfile.isDefault` + invariant unchanged.
- Behaviour per profile count:
  - 0 → no dot; window shows empty state + «הוספת פרופיל»; no autofill action.
  - 1 → dot; window shows that profile (no switcher); edit / add available.
  - ≥ 2 → dot (no count); window opens on the default; switcher; edit acts on the active profile.
- Backward compatibility / migration:
  - Existing users: no data migration. Apps already in `selectedIds` appear as before.
  - Existing auto-created «ראשי» profiles without credentials remain profiles → they get a dot under AD-123-6 (TQ-1 decides whether that is acceptable or whether such empty profiles are treated differently — no data rewrite either way without approval).
  - Users who land on the old `manage` screen state (in-memory only) are routed to Digital Home; nothing persisted references the screen.
  - Local credentials retained from earlier removals (AC-104-16) are handled per OQ-01 (e.g. purge on next removal only, or a one-time cleanup — Product / Architect decision after OQ-01).

## 8. Failure states
- Cloud unavailable / no session during add, remove, delete profile: existing fail-closed behaviour (operation blocked, clear Hebrew error, local state unchanged).
- Credential save: today `persistVault` sync is fire-and-forget (local save succeeds, cloud sync may fail silently). Kept as is (AD-123-4); recorded as risk P-3.
- Catalog load error inside the overlay: inline error + retry; Digital Home stays usable.
- Concurrent actions: existing selection lock (`pendingIds`) reused for add / remove; actions disabled while pending.
- Admin disabled / removed an app: existing prune / registry-presence logic unchanged.

## 9. Security / Privacy Considerations
- Zero-knowledge model unchanged; credentials only in the encrypted vault and per-profile cloud ciphertext.
- Removal must leave no orphaned ciphertext in the cloud and, per OQ-01, no silently retained local copies unless Product chooses a recovery option (then retention must be explicit and bounded).
- Confirmation before destructive actions (FR-18); copy states what is deleted (depends on OQ-01).
- No credential values in logs, metrics, or the catalog. Metrics are aggregate counts only, admin-only.
- Custom site submissions: removal does not touch other users; registry row handling per OQ-01b.

## 10. Observability
- Required for the phase: admin-only aggregate for the PRD diagnostic metric (% apps added without profile; % still without profile after 7 days), computed from existing timestamps; no new client telemetry.
- Not in MVP without a separate decision: event analytics for task completion / funnels (PRD §6 items 2–4 are measured in usability tests; item 5 from the support system).
- Dev-only diagnostics may log action names and outcomes, never values.

## 11. Risks (technical)
- T-1 Behaviour change of the green dot (complete credentials → has profile): profiles without credentials now show a dot. Mitigation: TQ-1.
- T-2 Removing the `manage` screen loses an un-migrated capability. Mitigation: parity matrix (AD-123-9) before deletion.
- T-3 Floating window complexity (R5). Mitigation: only the listed actions; management stays in the modal.
- Pre-existing, outside scope unless approved separately:
  - P-1 User-submitted custom rows are `pending_review`, but the owner's RLS read requires `active` → own custom sites may not hydrate on a second device and could be pruned. Affects custom apps in the unified home.
  - P-2 Remove-site local retention vs cloud cascade (AC-104-16) — resolved by OQ-01.
  - P-3 Credential cloud sync failures are silent (fire-and-forget; best-effort cloud credential delete can resurrect a deleted credential on next hydrate).
  - P-4 Profile delete cloud-first then local can desync on a local failure.

## 12. Open questions — Product (Tika) decides; implementation GATED
- OQ-01 Removal semantics (PRD): when an app with profiles is removed — (a) are profiles and credentials deleted locally and in the cloud; (b) for a user-created (custom) app, is its submission / registry row also removed; (c) is recovery offered (none / short undo window / restore)?
- OQ-02 Profile deletion (PRD): (a) may the user delete the LAST profile (returning the app to the 0-profile state)? (b) when the default is deleted, which profile becomes default (automatic rule, e.g. oldest remaining, or the user chooses)?
- OQ-03 Catalog container (PRD): modal / drawer / overlay. The body is container-agnostic; a large modal is the interim default.
- TQ-1 What counts as "a profile" for the green dot: any saved profile, or only a profile with credentials? (Today's auto-created empty «ראשי» profiles depend on this.)
- TQ-2 Custom (user-created) apps: confirm «+ הוספת אתר שאינו ברשימה» lives in the catalog overlay and «עריכת פרטי האתר» lives in the app-actions menu.
- TQ-3 Switching profile in the floating window: session-only (stored default unchanged), as designed in AD-123-7?
- TQ-4 Empty home (user with 0 apps): empty-state copy + «+ הוספת אפליקציה» (no automatic catalog opening)?

## 13. Slices (proposed order; each functionally testable)
- 123.1 App context: green-dot rule, no auto-create, floating window switcher / «עריכת פרופיל» / «הוספת פרופיל» / empty state, single modal host. (Depends on TQ-1, TQ-3.)
- 123.2 Catalog overlay from Digital Home (search, categories, already-added, add without profile, custom add). (Depends on OQ-03 for the container only; TQ-2.)
- 123.3 Remove app from app context with confirmation; profile deletion rules. (GATED: OQ-01, OQ-02.)
- 123.4 Navigation unification: post-login to Digital Home, empty home, remove «ניהול אתרים», parity matrix, retire ManageServices; admin aggregate for the diagnostic metric. (TQ-4.)

## Testing and Lint Expectations
- New `verifyPhase123*` scripts per slice (real components in the existing harness style), following the T-1 test policy (per-prompt `--no-mutations` + slice mutations; full sweep and `scripts/runOfflineRegression.mjs` at END OF ROUND).
- PRD traceability: one check per FR-01…FR-18 (table below) plus per-profile-count behaviour (0 / 1 / ≥ 2).
- Persistence checks: every profile / credential write goes through the AD-123-4 reducers + `persistVault` (static scan: no new IndexedDB / Supabase writes in Digital Home components).
- Removal checks (after OQ-01): local and cloud state identical after success; nothing changes on cloud failure; confirmation required.
- Admin unchanged: `git diff --stat src/admin supabase/migrations` limited to the approved admin aggregate (if any); all Phase 121 / 122 admin verifies pass.
- tsc / build clean; no `window.confirm` / `alert` in `src/` outside admin.

| FR | Verified by |
|---|---|
| FR-01 | Navigation test: every action reachable from Digital Home; no `manage` screen |
| FR-02 | Tile click opens the floating window |
| FR-03 | One tile per app with ≥ 2 profiles |
| FR-04 | Window opens on the default profile |
| FR-05 | Switcher changes the active profile; stored default unchanged |
| FR-06 / FR-07 | «עריכת פרופיל» opens the modal on the active profile; saves via the existing reducers |
| FR-08 | «הוספת פרופיל» creates exactly one profile on save |
| FR-09 / 10 / 11 | Catalog overlay opens over Digital Home; search; categories |
| FR-12 | Added app marked; no duplicate instance |
| FR-13 | Add from catalog creates no profile |
| FR-14 | 0-profile app: no dot; empty state + CTA |
| FR-15 / 16 | ≥ 1 profile: dot; no count / text on tiles |
| FR-17 / 18 | Remove from app menu behind the confirm dialog |

## Functional Testability
- Page/screen the user can open: the user app (`http://localhost:5173/`), Digital Home after login.
- User-visible behavior: tile → floating window with profiles / edit / add / remove; «+ הוספת אפליקציה» → catalog overlay; no «ניהול אתרים» screen.
- Command-line flow: `node scripts/verifyPhase123*.mjs`; `node scripts/runOfflineRegression.mjs` at END OF ROUND.
- API endpoint / request: none new for users; existing Supabase tables via existing functions.
- Minimal end-to-end flow: add an app from the catalog without a profile → no dot → open → empty state → add profile → dot → open → edit password → save → remove app → confirm.
- Expected observable result: every PRD MVP action completes inside the Digital Home; Admin unchanged.

## Handoff Notes for Manager
Not handed off. Waiting for (1) Owner architecture review of this design and (2) Product decisions on §12. Slices 123.1 / 123.2 may be authorized after TQ-1 / TQ-2 / TQ-3 are answered; 123.3 only after OQ-01 / OQ-02.

## Architect Review
ARCHITECT_REVIEW_STATUS: NOT_REVIEWED

### Review Notes

### Required Corrections
