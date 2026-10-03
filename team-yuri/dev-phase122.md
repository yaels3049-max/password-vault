# Developer Phase 122

## Phase Identifier
PHASE=122

## Status
STATUS: COMPLETE

## Source References
- `team-Yuri/arch-phase122.md` (all sections; §3 binding constraints, §4.3 tab placement, §4.4 multi-step layout, §6 excluded items, §7 verification).
- Owner authorization 2026-10-01: «Phase 122 — Admin Workspace (OWNER APPROVED / AUTHORIZED)», slices 122.1 → 122.2 → 122.3 in one run.
- Owner authorization 2026-10-01: «Phase 122.7 (OWNER APPROVED / AUTHORIZED)» — arch §8d + G-122-6 copy note; §3 exception: one Supabase migration (admin-only RPC).
- Owner authorization 2026-10-02: «Phase 122.8 (OWNER APPROVED / AUTHORIZED)» — arch §8e R1–R4 in one run (R5 not in scope, R3 filter not included); §3 exception: one Supabase migration (admin-only notes table).
- Deviation: `PHASE.md` still says `PHASE=121` and `manager-phase122.md` does not exist; implemented on the Owner's explicit authorization. PHASE / arch / manager / plan files not modified.

## Implementation Summary
Presentation-only restructuring of the Admin «הגדרת אתרים» page:
- **122.1** Full-width shell (no 1100px cap), top app bar (title, nav with «הגדרת אתרים», «חזרה לבית הדיגיטלי», signed-in admin), catalog mode (search / filters / «אתר חדש» / multi-column cards) and workspace mode (site strip: icon, name, status chip, site switcher with search, «מעבר לרשימת האתרים»). Unsaved-changes confirm when leaving a site (back, switcher, Admin nav) with a dirty service form or a dirty SPECIAL draft.
- **122.2** Workspace tabs «פרטי אתר» / «הגדרת כניסה ומילוי» / «בדיקה והפעלה» per §4.3. Panels use the `hidden` attribute inside the one service form, so every editor stays mounted. Sticky save bar (שמור / ביטול) on every tab, same submit handler. Create mode: only «פרטי אתר» (+ today's credential section) with the other tabs disabled and a hint. User-owned rows: hint text, no authoring / fill test (as today). An invalid hidden required field brings «פרטי אתר» forward.
- **122.3** «אופי הכניסה» radio row («שילוב» shown disabled, never selectable). Multi-step patterns: «שלבי התהליך» sidebar (step buttons with a short status; replaces the «שלב נוכחי» select — G-122-1), «שדות השלב» table (name | locator + location or «—» | «מיפוי חזותי», «הסר מיפוי»), step button card (D-121-67 A/E controls / last-step text) under the table; Analyze / manual-pick bar, proposals and completeness line stay in the step panel.

No change to save paths / payloads (incl. D-121-64 / D-121-65), validators, contract, runtime, extension, manifest, Supabase, Digital Home.

**Conformance fixes (arch §8 Implementation review):**
- **G-122-1** The «שלב נוכחי» select is no longer rendered; the «שלבי התהליך» sidebar replaces it (§4.4). `selectedStepId` state unchanged; the sidebar buttons set it and `aria-current` follows it.
- **G-122-2** The scroll container (`.admin-workspace-body`) reserves `scroll-padding-bottom: calc(--admin-save-bar-height + 0.65rem)` and the save bar has that fixed height. The extra 0.65rem is the panel padding the sticky bar sits inside; with only the bar height, controls scrolled into view still ended ~10px under the bar. (Superseded in 122.4: the scroller has no bottom padding, so the reserve is exactly the bar height.)

**122.4 «Visual system + readable widths»** (arch §8a / §8b, Owner authorization 2026-10-01):
- **Width rules.** Workspace max 1440px, centered in a 28px main padding. All admin text inputs / textareas ≤ 560px, selects / short fields / fill-test inputs ≤ 420px, buttons auto width. `.admin-field-grid`: 2 columns ≥ 1200px, 1 below. No horizontal overflow from 360px up (fieldset `min-width: 0`, `overflow-wrap: anywhere`, narrow fallbacks for the fields table / categories / filters).
- **One scroll per page.** Workspace tabs scroll only in `.admin-workspace-body`; the side stack no longer has collapsible inner boxes; categories scroll only in their section. The catalog keeps its pane scroll.
- **12-column grid.** The service `<form>` is `display: contents` inside `.admin-workspace-columns` (explicit rows: head, notice, details 8 | side stack 4, login, test, 1fr spacer, save bar), so the save bar stays inside the form (same submit / validation) and the side stack stays outside it (it has its own forms). ≤ 900px: side stack below.
- **«פרטי אתר»:** main card (2-col field grid) + «אזור מסוכן» card at the bottom with the same השבת / «מחיקת אתר» buttons (same handlers / confirmations). Side stack: icon card, login-URL card, «פרטים נוספים» collapsible (former modal content; bound to the same `showMoreDetails` state).
- **«הגדרת כניסה ומילוי»:** credential-mode + fields in one card; fields as a card grid (~360px per field, same controls and order, icons on ↑ ↓ הסר / «הוסף שדה»); pattern radios as segmented cards; steps sidebar 260px.
- **«בדיקה והפעלה»:** fill-test card | «תוצאה ומצב» card (mapping status line, results, empty state).
- **«קטגוריות»:** one table (max 960px): שם | עריכה | מחיקה | סידור, «קטגוריה חדשה» inline at the top; no second list column.
- **Visual system** (tokens in `admin.css`): Assistant 15px base, 24 / 18 / 16 / 13 scale, line-height 1.5; bg #f5f7fb, white cards radius 14, 1px #e6eaf0, soft shadow, 24px padding, 16 / 24 spacing; inputs 40px radius 10, 3px 25% primary focus ring, disabled / error states; buttons primary / secondary / danger / ghost 36–40px; underlined tab bar with icons; chips green / amber / red / gray; section headers with a one-line description; empty states (icon + sentence); inline SVG icons (`adminIcons.tsx`, no dependency); 150ms hover / focus transitions, off under `prefers-reduced-motion`.
- **Sticky save bar (G-122-3):** full workspace width, opaque white, top shadow, flush with the bottom of the scroller at any scroll position.

**122.5 «Save bar on details, pattern change, in-app dialogs»** (arch §8c R1–R4 + G-122-4, Owner authorization 2026-10-01):
- **R1** «פרטי כניסה» (mode) and the CredentialFieldsEditor moved to «פרטי אתר» as their own «שדות כניסה» card (between the details card and «אזור מסוכן»). «שמור / ביטול» shows only on «פרטי אתר». Same form, same `handleSave`, same payload; nothing unmounts (the save bar is `hidden` on the other tabs). «הגדרת כניסה ומילוי» = pattern + mapping (authoring grids keep today's condition: global row, not creating, credential_fields; otherwise a hint). «בדיקה והפעלה» = fill test + status. Other tabs show «יש שינויים שלא נשמרו בפרטי האתר» with a «מעבר לפרטי אתר» link while the service form is dirty.
- **R2** «אופי הכניסה» shows a read-only summary «אופי הכניסה: <pattern>» and «שינוי אופי הכניסה». No stored mapping → the cards open directly. A stored mapping (STANDARD profile with a locator, SPECIAL draft, or a live non-STANDARD contract; this also covers «approved for users») → the in-app warning first: [«שינוי בכל זאת»] / [«ביטול»], «ביטול» focused. Choosing a card closes the chooser. What the switch does is unchanged (documented below); the copy states it. `patternSelectorLocked` also locks the button. «שילוב» stays disabled.
- **R3** One `AdminConfirmDialog` (`useAdminConfirm()` → `ask(options): Promise<boolean>`): title, body, primary / danger, Esc = cancel, Tab trap, click outside = cancel, focus back on close, RTL, same frame as the «אשר מיפוי» confirmation. Replaced every browser dialog in Admin (list in Known Issues).
- **R4** Field remove / id change warnings only for ids in the last saved `login_fields` of a global site whose saved status is active. MODE_CLEAR_WARNING only when such saved fields exist. No warning for new fields, label / attribute edits, inactive / draft sites, user-owned rows, create mode.
- **G-122-4** At ≥ 1200px the categories table (max 960px) is centered in the content area; the heading and messages use the same centered column.

**Fix G-122-5 «returning to the saved pattern reloads the saved draft»** (arch «122.5 implementation review» → G-122-5, Owner authorization 2026-10-01):
- `SpecialLoginDraftEditor.onPatternChange`: selecting a SPECIAL pattern equal to the saved draft's pattern loads the saved draft through the first-open path (`normalizeLegacyDraftReadiness(ensureSpecialDraft(pattern, savedDraft))`, same as the initial state and as `savedSpecialDraftStateKey`), so the editor is not dirty after the load. Step 1 selected; pending / follow-up proposals, held framed fields and proposal-step links cleared (none exist on first open).
- A different SPECIAL pattern keeps today's `ensureSpecialDraft(next, current)` (empty when coming from STANDARD). STANDARD unchanged (the STANDARD grid stays mounted with the saved profile).
- Pattern-change dialog shortened to 3 plain lines (below). The STANDARD approved-mapping exception is still true (`mappingStatus.ts` unchanged) and stays as one sentence.
- No save-path / payload / validator / contract / runtime / extension / Supabase change.

**122.7 «Admin clean-ups + richer submissions»** (arch §8d + copy note G-122-6, Owner authorization 2026-10-01; §3 exception: one Supabase migration):
- **«כתובת כניסה» side card removed** from «פרטי אתר» (`LoginUrlRefresh`, with «שמור ידנית» / «סמן כלא תקין»). The component had no other user, so `LoginUrlRefresh.tsx` and its `onManualSave` / `onMarkInvalid` handlers in `RegistryAdmin` are deleted (the API functions `adminUpdateLoginUrl` / `markGlobalLoginUrlInvalid` stay in `adminRegistryApi.ts`; other code and tests read them). The main form edits and saves the login URL as before.
- **Open links:** `UrlFieldWithCopy` gets an optional `openLabel`; «כתובת הבית» shows «דף הבית», «כתובת כניסה» shows «דף כניסה» (that field is rendered only for a dedicated login URL, so the link is absent for home-page entry). `href` = the current input value (unsaved too), only when `httpUrlOrNull` accepts it (absolute http / https with a host); `target="_blank" rel="noopener noreferrer"`; the copy button stays.
- **App bar:** «חזרה לבית הדיגיטלי» removed. `readSignedInAdmin()` (session email + own `public.users` row via `loadAppUserProfile`) and `signedInAdminLabel()` → «<first> <last> · <email>», the email alone when the name is empty.
- **Catalog toolbar:** `.admin-catalog-bar` stretches, so «אתר חדש» has the height and top of the search / filter row.
- **Queue cards («אתרים בהוספה ע"י משתמשים»):** cards ≥ 400px (3 per row at 1440, 2 at 1280), 20px padding. Facts list: «הוגש ע"י:» name + `mailto:` email (email only when the name is empty; «משתמש לא מזוהה» when the profile is not returned); «תאריך הגשה:» date + HH:mm in `Asia/Jerusalem`; «כתובת הבית:» / «כתובת כניסה:» as new-tab links showing the URL (text only for non-http(s), «—» when empty). No status chip, no «משתמש <uuid>». Approve / reject / details modal unchanged.
- **Data:** migration `supabase/migrations/20261001120000_phase122_admin_submitter_profiles.sql` — `public.admin_submitter_profiles(p_user_ids uuid[])` returns `(id, first_name, last_name, email)`; `security definer`, `set search_path = public`, raises unless `public.is_admin()`; only requested users who own a `service_registry` row with `source_type = 'user'`; `revoke all` from public and anon, `grant execute` to authenticated. No table / policy change. `fetchSubmitterProfiles(ids)` calls it once per queue load with the distinct owner ids; on error the cards fall back to «משתמש לא מזוהה» (the queue still loads).
- **G-122-6:** dialog line 1 → «…הוא יוחלף רק אחרי «שמור מיפוי» באופי הכניסה החדש.»
- No save-path / payload / validator / contract / runtime / extension / Digital Home change.

**G-122-7 «submitter names on catalog cards»** (arch «G-122-7 — OWNER APPROVED / AUTHORIZED», 2026-10-01):
- Catalog cards of user-submitted sites show «על ידי: <first> <last>», the email when the name is empty, «משתמש לא מזוהה» without a profile — never the uuid (the `משתמש <id…>` branch of `addedByLabel` is removed).
- Shared helpers (used by the queue and the catalog, no duplicate): `loadSubmitterProfiles(rows)` in the new `src/admin/submitterProfiles.ts` — one `admin_submitter_profiles` call with the distinct `owner_user_id`s of `source_type = 'user'` rows (no call when there are none); on failure an empty map. `submitterLabel(profile)` + `UNKNOWN_SUBMITTER_HE` in `adminPresentation.ts`; `addedByLabel(row, profile)` uses them.
- RPC failure → the catalog loads normally, the cards show the fallback, no error message.
- No migration; no other UI / save / runtime / extension change.

**G-122-8 «login URL on submission cards» + G-122-9 «SPECIAL step editor layout»** (arch G-122-8 / G-122-9, Owner authorization 2026-10-01, one run; presentation only):
- G-122-8: one helper `dedicatedLoginUrlOrNull(loginEntryType, loginUrl)` (`adminPresentation.ts`) — the URL only for `direct_url` + valid http(s), else null. Used by the queue card «כתובת כניסה» (null → «—»), a new «כתובת כניסה» row in the queue details modal (same rule), and the «דף כניסה» link in «פרטי אתר» (`UrlFieldWithCopy` gets an optional `openUrl`). Stored data, promote / Login Discovery unchanged.
- G-122-9: in `SpecialLoginDraftEditor`, the button card(s) (opener / follow-up proposal, step exit) and «מיפוי שדות» sit in `.admin-special-step-cards`. From 1280px (viewport) with a button card: a two-column grid, equal height, button column on the start side (right), «מיפוי שדות» on the end side. Below 1280px the button column is `display: contents` + `order`, so the stack keeps today's order (proposals → fields → step exit). The completeness (gap) message, «שמור מיפוי» / «אשר מיפוי» and the help text stay outside, full width below. A field-only step caps «מיפוי שדות» at 960px. The step-exit card moved out of the «מיפוי שדות» block into the button column (same component, same controls / handlers); «מיפוי שדות» is now a bordered card like the button cards.

### 122.5 — What a pattern switch does today (documented before R2)
Read from `RegistryAdmin.tsx`, `LoginPatternGrid.tsx`, `SpecialLoginDraftEditor.tsx` (`onPatternChange`, `saveDraft`, `activateSpecial`), `AutofillProfileEditor.tsx`, `specialDraftAuthoring.ts` (`ensureSpecialDraft`), `planActivate.ts`, `mappingStatus.ts`. Unchanged by 122.5; only the path to the chooser changed.

**At switch time nothing is written.** The selection is RegistryAdmin state (`authoringPatternSelection`, per row, not persisted; untouched = the saved pattern: the saved SPECIAL draft's pattern, else STANDARD). `LoginPatternGrid` only calls `onPatternChange`. No server call, no metadata change.

**In the editors (memory only):**
| Switch | Effect |
|---|---|
| SPECIAL → STANDARD | The SPECIAL editor's in-memory draft is set to null; pending / follow-up actions cleared. Unsaved SPECIAL edits are lost. The saved draft stays stored. The STANDARD grid shows (it was hidden but mounted, so its own unsaved edits are still there). |
| STANDARD → SPECIAL | The STANDARD grid is hidden but stays mounted (its unsaved edits are kept). The SPECIAL draft starts from `ensureSpecialDraft(pattern, null)`: an empty step 1. **It does not reload the saved draft**, also when coming back to SPECIAL after SPECIAL → STANDARD in the same session. **→ Changed by G-122-5:** when the chosen pattern is the saved draft's pattern, the saved draft is loaded (not dirty); otherwise an empty step 1 as before. |
| SPECIAL → other SPECIAL | `ensureSpecialDraft(next, draft)` keeps steps / mappings and changes the pattern; step 1 becomes the selected step; the draft is dirty. **G-122-5:** if `next` is the saved draft's pattern, the saved draft is loaded instead (not dirty). |

**What replaces a stored mapping (only on an explicit button):**
- SPECIAL «שמור מיפוי» (`saveDraft`) writes `loginFlowPlan.draft`, **replacing the saved draft**. The STANDARD profile and the live contract are kept.
- STANDARD «שמור מיפוי» writes `autofillProfile` (via `withoutLoginContractKeys`, so the live contract and the SPECIAL draft are kept), **replacing the saved STANDARD profile**.
- SPECIAL «אשר מיפוי» → STANDARD_TO_SPECIAL / SPECIAL_TO_SPECIAL: users move to SPECIAL vN; the STANDARD profile stays stored but unused; the draft is kept.
- STANDARD «אשר מיפוי» while live is SPECIAL → existing in-app confirmation (GRID_SPECIAL_TO_STANDARD) → SPECIAL_TO_STANDARD: users move to STANDARD; the active plan becomes null; the draft is kept.

**Effect on users:**
- Before «אשר מיפוי»: users keep the current live approved mapping (switching and «שמור מיפוי» of a SPECIAL draft change nothing for them).
- Exception (today's STANDARD rule, `mappingStatus.ts`): saving a change to an already approved STANDARD mapping sets it back to not approved, which stops managed fill for users until it is approved again. This is the same with or without a pattern switch.
- After «אשר מיפוי»: users get the newly approved mapping.

**Dialog copy (R2) states exactly this:** the switch deletes nothing on the server; switching to STANDARD drops unsaved SPECIAL edits and a new SPECIAL mapping starts empty; «שמור מיפוי» after the switch replaces the saved mapping of that kind; users keep the approved mapping until «אשר מיפוי», except the STANDARD rule above.

**122.8 (arch §8e, R1–R4):**
- **R1 uniform cards.** Catalog and submissions grids use `grid-auto-rows: 1fr` and the cards stretch. Each card has a header (icon + name clamped to 2 lines, with the full name as a tooltip), one chip line (`AdminChipRow`: chips that do not fit become one «+N» chip whose tooltip lists them) and a footer pinned to the bottom (`margin-top: auto`). The catalog card also has a top row for the R3 badge, and its footer holds «נוסף / על ידי» plus the R4 «יש הערה» marker. Nothing was removed. Categories is a table (122.4), not a card grid, and its rows already have one height; the verify asserts that.
- **R2 fill-test completeness gate.** STANDARD runs only when every declared login field has a saved locator (`standardUnmappedFields`). SPECIAL runs only when `checkSpecialDraft(saved draft).complete` (`fillTestRoute().specialComplete`). When a saved mapping exists but is incomplete, the run button is disabled and a fixed in-tab notice appears (`data-notice="fill-test-incomplete"`). It shows the title, the gap detail (SPECIAL: the `checkSpecialDraft` message; STANDARD: «שדות ללא מיפוי שמור: <labels>») and «מעבר להגדרת כניסה ומילוי», which switches to the login tab. Saves are untouched, so partial saves stay allowed.
- **R3 approval badge.** `userApproval.ts` → `userApprovalState(row)` reads only the saved row and mirrors the runtime:
  - `resolveActiveLoginContract`: SPECIAL_INVALID → «חסום למשתמשים»; SPECIAL (including saved changes not yet approved) → «מאושר למשתמשים».
  - STANDARD: a profile with `supportState: 'validated'` that is version-matched (`isVersionMatchedValidated`) and covers the saved login fields (`mappingsCoverRequiredSchema`, credential_fields mode) → approved. A `validated` profile that fails this check is fail-closed at runtime → «חסום למשתמשים».
  - Otherwise, any saved STANDARD locator or saved SPECIAL draft → «טרם אושר למשתמשים», and nothing saved → «אין מיפוי». Saving a change to an approved STANDARD mapping sets `unsupported`, so it shows amber.
  - `UserApprovalBadge` renders it on every catalog card (top corner) and in the workspace header (`size="lg"`: larger, filled, icon, before the «פעיל» chip).
- **R4 admin notes.** Migration `20261002120000_phase122_admin_service_notes.sql` creates the table, with RLS and one `public.is_admin()` policy per command; anon has no grants.
  - API: `fetchAdminServiceNote`, `fetchAdminNoteServiceIds` (ids only) and `saveAdminServiceNote` (upsert with `updated_by`; an empty body deletes the row).
  - Fourth tab «הערות» (`AdminNotesPanel`): auto-grow textarea (≤ 880px wide, `maxLength` 20000), «שמור הערה» / «בטל שינויים» in the tab, «עודכן לאחרונה: <date, HH:mm>» (Israel time) and the helper line.
  - An unsaved note joins `workspaceDirty` (`notesDirty`), so the existing leave guard asks.
  - The catalog load makes one ids-only query for the «יש הערה» markers. If it fails, no markers are shown and the catalog still loads. After a save, the marker set is updated locally.

**Dialog copy after G-122-5** (`PATTERN_CHANGE_HE.body`):
> לאתר הזה כבר יש מיפוי שמור. השינוי לא מוחק אותו — הוא יוחלף רק אחרי «שמור מיפוי» באופי הכניסה החדש. (G-122-6, 122.7)
> המשתמשים ממשיכים לקבל את המיפוי המאושר עד «אשר מיפוי».
> חריג: שמירת שינוי במיפוי רגיל שכבר אושר עוצרת את המילוי אצל המשתמשים עד שיאושר שוב.

## Implemented Milestones

| Milestone | Completed: Yes/No | Notes |
|---|---:|---|
| 122.1 Shell + modes + unsaved guard | Yes | Guard = service form snapshot vs loaded / last-saved baseline + `specialDraftDirty` of the row |
| 122.2 Workspace tabs + sticky save bar | Yes | `hidden` panels; payload snapshot-equal to pre-phase from every tab |
| 122.3 Multi-step layout | Yes | Sidebar bound to the existing `selectedStepId` state; FLOATING keeps the single-column layout |
| 122.4 Visual system + readable widths | Yes | CSS tokens + 12-col grid; JSX regrouping only (cards, danger zone, side stack, categories table); payloads unchanged |
| 122.5 R1–R4 + G-122-4 | Yes | Credentials card on «פרטי אתר», save bar there only, unsaved notice; pattern summary + warning; AdminConfirmDialog everywhere; R4 option b; categories centered |
| Fix G-122-5 | Yes | Saved pattern → saved draft reloaded (first-open path, not dirty); other SPECIAL / STANDARD unchanged; 3-line dialog copy |
| G-122-8 login URL rule | Yes | Queue card + modal + «דף כניסה» via `dedicatedLoginUrlOrNull`; primary_page / missing metadata / invalid → «—» |
| G-122-9 step cards | Yes | ≥1280px button card | «מיפוי שדות» equal height; stacked below as today; actions / gap full width; field-only ≤ 960px |
| G-122-7 catalog submitter names | Yes | Name / email / «משתמש לא מזוהה» on user-submitted catalog cards; one RPC call per catalog load via the shared loader; fail-safe |
| 122.7 clean-ups + submissions | Yes | Side card removed; open links; app bar name · email; toolbar height; queue cards + `admin_submitter_profiles` RPC; G-122-6 copy |
| 122.8 R1–R4 | Yes | Uniform cards + «+N»; fill test only for a complete saved mapping + in-tab notice; runtime-derived approval badge (cards + header); admin notes table / tab / guard / marker |
| G-122-12 | Yes | «אתר חדש» 180px + «+» icon, card takes the rest, full width above the card ≤ 1024px; category required on every save (no pre-select, placeholder, inline error + focus, no save call) |

## Files Changed

| File | Change Summary | Reason |
|---|---|---|
| `src/admin/adminWorkspace.ts` (new) | Copy, tab ids, `workspaceTabEnabled`, `serviceFormSnapshot`, `workspaceDirty`, `confirmLeaveWorkspace`, `registryRowMatches` | 122.1 / 122.2 pure helpers |
| `src/admin/adminAuth.ts` | `readSignedInAdminEmail()` (read-only session email) | 122.1 app bar |
| `src/admin/AdminApp.tsx` | App bar, nav label «הגדרת אתרים», guard on Admin nav, `onDirtyChange` | 122.1 |
| `src/admin/RegistryAdmin.tsx` | Catalog / workspace modes, site strip + switcher + back, dirty baseline, tabs, panels, sticky save bar, details aside, test-tab status line. `handleSave` untouched | 122.1 / 122.2 |
| `src/admin/LoginPatternGrid.tsx` | `<select>` → radio fieldset; «שילוב» disabled + note | 122.3 |
| `src/admin/SpecialLoginDraftEditor.tsx` | Multi-step layout (sidebar, step panel, fields table head, cells, button card after the table) | 122.3 |
| `src/admin/specialStepsSidebar.ts` (new) | Sidebar items + short per-step status; layout copy | 122.3 |
| `src/admin/admin.css` | Full width, app bar, catalog, workspace, strip, switcher, tabs, columns, save bar, radio row, sidebar, fields table, ≤ 900px fallbacks | 122.1–122.3 |
| `scripts/verifyPhase122AdminWorkspace.mjs` (new) | Real-browser verify (Edge via Playwright), 7 groups, 14 mutations | §7 |
| `scripts/lib/phase122-baseline/*.tsx.txt` (new) | Pre-phase copies | Payload snapshot equality |
| `scripts/verifyPhase121GridStructure.mjs` | Re-pointed «אופי הכניסה» selector assertions + M4 anchor | `<select>` → radio row |
| `scripts/verifyPhase107Admin.mjs` | Re-pointed AC-107-11 nav label | «כל האתרים» → «הגדרת אתרים» |
| `src/admin/SpecialLoginDraftEditor.tsx`, `src/admin/admin.css` | G-122-1 select removed; G-122-2 reserved bottom space | §8 conformance |
| `scripts/verifyPhase122AdminWorkspace.mjs` | Sidebar drives / follows (M12 / M13), no select (M15), save-bar group at 1280 / 1920 (M16) → 8 groups, 16 mutations | §8 conformance |
| `scripts/verifyPhase121{MultiStepTransition,ChoiceScreen,StepButtons,RemoveFieldRow,GridStructure,UnifiedVocabulary}.mjs` | Step selection read / driven via the sidebar instead of the select | G-122-1 |
| `src/admin/admin.css` | 122.4 tokens, input / button / tab / chip / card / empty-state styles, width caps, 12-col workspace grid, side stack, danger zone, flush opaque save bar, credential card grid, segmented pattern cards, 260px sidebar, fill-test 2 columns, categories table, narrow fallbacks, reduced motion | 122.4 |
| `src/admin/adminIcons.tsx` (new) | Inline SVG icon set + `AdminEmptyState` | 122.4 icons / empty states |
| `src/admin/adminWorkspace.ts` | Tab descriptions, layout copy («אזור מסוכן», «תוצאה ומצב», empty-state sentences), `statusBadgeClass` | 122.4 |
| `src/admin/RegistryAdmin.tsx` | Tab icons, status chips, workspace head + description, details main card + «אזור מסוכן», side stack with «פרטים נוספים» collapsible (modal removed), credentials card, test-tab status line passed into the result card, catalog empty state | 122.4 |
| `src/admin/AdminFillTestGrid.tsx` | Two cards: fill-test run | result + status (`statusLine` prop), empty state | 122.4 |
| `src/admin/CredentialFieldsEditor.tsx` | Actions row class + icons (same controls, copy, order) | 122.4 |
| `src/admin/CategoriesAdmin.tsx` | Single table with inline create, row cells (name / שמור / מחק / reorder), drag handle | 122.4 |
| `scripts/verifyPhase122AdminWorkspace.mjs` | Default slice 122.4; `--only=<group>`; groups `checkReadableWidths`, `checkCategoriesTable`; re-pointed widths / tabs checks and M6 / M16 anchors; mutations M17–M21 → 10 groups, 21 mutations | 122.4 tests |
| `src/admin/AdminConfirmDialog.tsx` (new) | In-app confirmation + `useAdminConfirm()` | 122.5 R3 |
| `src/admin/patternChange.ts` (new) | `patternChangeNeedsWarning`, pattern-change copy / dialog options | 122.5 R2 |
| `src/admin/RegistryAdmin.tsx` | «שדות כניסה» card moved to «פרטי אתר»; save bar `hidden` off «פרטי אתר»; unsaved-details notice; login-tab hint; pattern chooser state + warning; in-app dialogs for leave / switch / credential-mode clear (×2) / השבת; R4 `savedFieldIdsInUse`. `handleSave` payload untouched | 122.5 R1–R4 |
| `src/admin/LoginPatternGrid.tsx` | Summary row + «שינוי אופי הכניסה»; cards `hidden` until opened; «סגירה»; still stateless | 122.5 R2 |
| `src/admin/CredentialFieldsEditor.tsx` | `protectedFieldIds` + `confirmFieldChange` props; remove / id change ask only for protected ids | 122.5 R3 / R4 |
| `src/admin/AdminApp.tsx`, `src/admin/adminWorkspace.ts` | Admin-nav guard via the in-app dialog; `confirmLeaveWorkspace` async + `leaveWorkspaceDialog`; notice / hint copy; tab descriptions | 122.5 R1 / R3 |
| `src/admin/CategoriesAdmin.tsx`, `src/admin/AutofillProfileEditor.tsx` | Delete-category / «נקה מיפוי» via the in-app dialog (same texts) | 122.5 R3 |
| `src/admin/admin.css` | Dialog body, unsaved notice, link button, pattern summary / chooser, credentials-card legend visually hidden, categories centered ≥ 1200px | 122.5 |
| `scripts/verifyPhase122AdminWorkspace.mjs` | Default slice 122.5; in-app dialog observer (native dialogs fail a check); re-pointed guard / tabs / tab rules / save payload / multi-step / widths / categories checks and M1 / M3 / M6 anchors; groups `checkSaveBarOnDetails`, `checkPatternChange`, `checkInAppDialogs`, `checkFieldWarnings`; mutations M22–M33 | 122.5 tests |
| `scripts/verifyPhase121CredentialFieldCopy.mjs` | Id / remove warning via `confirmFieldChange` + `protectedFieldIds` (async groups); M13 re-pointed; M20 / M21 added | R3 / R4 |
| `scripts/verifyPhase121GridStructure.mjs` | Allows only «שינוי אופי הכניסה» / «סגירה» buttons; cards hidden until opened; button lock; M8 anchor | R2 |
| `src/admin/SpecialLoginDraftEditor.tsx` | `onPatternChange`: saved draft's pattern → load the saved draft (first-open path) | G-122-5 |
| `src/admin/patternChange.ts` | 3-line dialog copy; header comment | G-122-5 |
| `scripts/verifyPhase122AdminWorkspace.mjs` | Exact dialog copy in `checkPatternChange` (old «starts a new draft» assertion removed); new group `checkPatternReturn`; mutations M34–M37 | G-122-5 tests |
| `supabase/migrations/20261001120000_phase122_admin_submitter_profiles.sql` (new) | Admin-only `admin_submitter_profiles(uuid[])` RPC | 122.7 item 5 (§3 exception) |
| `src/admin/adminRegistryApi.ts` | `SubmitterProfile`, `fetchSubmitterProfiles(ids)` | 122.7 item 5 |
| `src/admin/ApprovalQueue.tsx` | Profiles fetched once per load; card facts (submitter + mailto, date + time, URL links, «—»); status chip and uuid label removed | 122.7 item 5 |
| `src/admin/adminPresentation.ts` | `formatAdminDateTime` (Israel time), `httpUrlOrNull`, `signedInAdminLabel` | 122.7 items 2, 3, 5 |
| `src/admin/UrlFieldWithCopy.tsx` | Optional `openLabel` new-tab link from the current value | 122.7 item 2 |
| `src/admin/RegistryAdmin.tsx` | «כתובת כניסה» side card + handlers / imports removed; `openLabel` «דף הבית» / «דף כניסה» | 122.7 items 1, 2 |
| `src/admin/LoginUrlRefresh.tsx` (deleted) | No other user | 122.7 item 1 |
| `src/admin/adminAuth.ts`, `src/admin/AdminApp.tsx`, `src/admin/adminWorkspace.ts` | `readSignedInAdmin()`; app bar without the home link, «name · email»; `signedInAs` copy removed | 122.7 item 3 |
| `src/admin/admin.css` | Toolbar stretch; open-link style; queue card grid / facts | 122.7 items 2, 4, 5 |
| `src/admin/patternChange.ts` | «…רק אחרי «שמור מיפוי»…» | G-122-6 |
| `scripts/verifyPhase122AdminWorkspace.mjs` | Default slice 122.7; stubs `readSignedInAdmin` / `fetchPendingSubmissions` / `fetchSubmitterProfiles` + queue fixtures; `timezoneId` / `init` options; virtual `./LoginUrlRefresh` stub for the pre-phase baseline build; header assertion re-pointed; groups `checkDetailsLinks`, `checkHeader`, `checkCatalogToolbar`, `checkSubmissionCards`; mutations M38–M46; G-122-6 copy | 122.7 tests |
| `scripts/verifyPhase122SubmitterProfiles.mjs` (new) | Real migration on PGlite: admin-only, submitters only, columns, schema / policies unchanged; Hub call; 5 mutations | 122.7 RPC tests |
| `src/admin/adminPresentation.ts` | `dedicatedLoginUrlOrNull` | G-122-8 |
| `src/admin/ApprovalQueue.tsx` | Card «כתובת כניסה» + new modal row via the helper | G-122-8 |
| `src/admin/UrlFieldWithCopy.tsx`, `src/admin/RegistryAdmin.tsx` | Optional `openUrl`; «דף כניסה» from the helper | G-122-8 |
| `src/admin/SpecialLoginDraftEditor.tsx` | `.admin-special-step-cards` wrapper + button column (proposal panels, step-exit card moved out of the fields block); `data-panel` hooks | G-122-9 |
| `src/admin/admin.css` | Step-card grid ≥1280px, stacked order below, fields card border, field-only 960px cap, compact field-table columns in the two-column mode | G-122-9 |
| `scripts/verifyPhase122AdminWorkspace.mjs` | Stubs load as TS; `currentTabAuthoring` wrapped (`__pvAnalyze` hook for SPECIAL Analyze); FLOATING_SCREEN fixture via init; pending fixtures sub-four (login = home) / sub-five (no metadata) / sub-six (invalid URL); groups `checkSubmissionLoginUrl`, `checkStepCards`; multi-step order assertion re-pointed (fields + button card side by side); M39 anchor updated; mutations M50–M53 | G-122-8 / G-122-9 tests |
| `src/admin/submitterProfiles.ts` (new) | `loadSubmitterProfiles(rows)`: one RPC call, distinct owners of user rows, empty map on failure | G-122-7 |
| `src/admin/adminPresentation.ts` | `UNKNOWN_SUBMITTER_HE`, `submitterLabel`; `addedByLabel(row, profile)` without the uuid label | G-122-7 |
| `src/admin/ApprovalQueue.tsx` | Uses the shared loader / label (same output) | G-122-7 |
| `src/admin/RegistryAdmin.tsx` | Catalog load fetches submitter profiles once; card label `data-part="added-by"` | G-122-7 |
| `scripts/verifyPhase122AdminWorkspace.mjs` | Optional catalog user rows / profiles / RPC failure via init script; group `checkCatalogSubmitters`; mutations M47–M49 | G-122-7 tests |
| `scripts/verifyPhase122SubmitterProfiles.mjs` | Static client check re-pointed: shared loader (one call, distinct owners of user rows, empty map on failure), one loader call per queue / catalog load | G-122-7 re-point |
| `scripts/verifyPhase107Admin.mjs`, `scripts/verifyPhase108M1ExplicitLoginEntry.mjs` | `LoginUrlRefresh.tsx` → `UrlFieldWithCopy.tsx` / main-form login URL; «הוגש על ידי» → «הוגש ע"י» | 122.7 re-points |
| `supabase/migrations/20261002120000_phase122_admin_service_notes.sql` (new) | `public.admin_service_notes` (PK/FK cascade, ≤ 20000 chars), RLS + 4 `is_admin()` policies, anon revoked | 122.8 R4 (§3 exception) |
| `src/admin/adminRegistryApi.ts` | `AdminServiceNote`, `ADMIN_NOTE_MAX_LENGTH`, `fetchAdminServiceNote`, `fetchAdminNoteServiceIds`, `saveAdminServiceNote` | 122.8 R4 |
| `src/admin/AdminNotesPanel.tsx` (new) | «הערות» tab content | 122.8 R4 |
| `src/admin/userApproval.ts` (new), `src/admin/UserApprovalBadge.tsx` (new) | Shared pure approval helper + pill | 122.8 R3 |
| `src/admin/AdminChipRow.tsx` (new) | One-line chips with «+N» overflow (hidden measuring row, ResizeObserver) | 122.8 R1 |
| `src/admin/fillTestContext.ts` | `specialComplete` / `specialGapMessage` (via `checkSpecialDraft`), `standardUnmappedFields`, notice copy | 122.8 R2 |
| `src/admin/AdminFillTestGrid.tsx` | Completeness in `canRunManagedTest` / `canRunSpecialTest`; incomplete notice + `onGoToLoginTab` | 122.8 R2 |
| `src/admin/adminWorkspace.ts` | Tab `notes` («הערות») + description; `workspaceDirty` reads `notesDirty` | 122.8 R4 |
| `src/admin/RegistryAdmin.tsx` | Catalog card layout (badge row, clamped name, chip row, footer + marker), header badge, notes tab panel, notes dirty / ids state, ids query in `reload()`, `onGoToLoginTab` | 122.8 R1 / R3 / R4 |
| `src/admin/ApprovalQueue.tsx` | Card: clamped name in the head, chip row, facts as the pinned footer; `has-selection` grid class | 122.8 R1 |
| `src/admin/adminIcons.tsx` | `IconNote`, `IconCheckCircle`, `IconClock`, `IconBlock`, `IconMinusCircle` | 122.8 |
| `src/admin/admin.css` | 1fr grid rows, card cell / name clamp / chip row / footer / marker, approval pills, incomplete notice, notes tab | 122.8 |
| `scripts/verifyPhase122AdminWorkspace.mjs` | Default slice 122.8; notes API stubs + svc-f1 note; 122.8 fixtures via `__pv1228`; four tabs; create mode disables `notes`; M2 / M38 anchors re-pointed; groups `checkUniformCards`, `checkApprovalBadge`, `checkHelperShared`, `checkFillTestGate`, `checkNotes`; mutations M54–M63; slice-scoped mutation runs | 122.8 tests |
| `scripts/verifyPhase122AdminNotes.mjs` (new) | Real migration on PGlite: admin CRUD, anon / non-admin / disabled admin / no session, length, FK + cascade, other schema unchanged; Hub static checks; 8 mutations | 122.8 R4 tests |
| `src/admin/RegistryAdmin.tsx` | Create form starts with `category_id` null; category guard at the top of `handleSave` (error + «פרטי אתר» + focus, return); select placeholder «בחרו קטגוריה» (disabled, empty value), `aria-required` / `aria-invalid` / error line; «אתר חדש» with `IconPlus` | G-122-12 |
| `src/admin/adminWorkspace.ts` | `categoryPlaceholder`, `categoryRequired` copy | G-122-12 |
| `src/admin/admin.css` | Catalog bar: toolbar `flex: 0 0 180px`, card `flex: 1 1 0`; ≤ 1024px column with the button first; `.admin-field-error` | G-122-12 |
| `scripts/verifyPhase122AdminWorkspace.mjs` | `__pvExtraRows` harness hook; `saveScenarios` create picks cat-a; groups `checkNewSiteButton`, `checkCategoryRequired`; mutations M72–M74 | G-122-12 tests |

## Dependencies Installed

| Dependency / Tool | Command Used | Reason |
|---|---|---|
| none | — | Playwright 1.63 + system Edge already available |

## Unit Tests

| Field | Value |
|---|---|
| Command | `node scripts/verifyPhase122AdminWorkspace.mjs --slice=122.1 / 122.2 / 122.3`; regression loop over `verifyPhase(116–122)*`, 101FailureMode, 109Accounts, 113LoginAssistance, 102CredentialSchema, 107Admin, 108M1ExplicitLoginEntry, 111Assets |
| Result | PASS (Phase 122: 7 groups, 14 mutations caught; after G-122-1 / G-122-2: 8 groups, 16 mutations; after 122.4: 10 groups, 21 mutations; after 122.5: 14 groups, 33/33 mutations; after G-122-5: 15 groups, 37/37 mutations; after 122.7: 19 groups, 46/46 mutations; after G-122-7: 20 groups, 49/49 mutations; after G-122-8 + G-122-9: 22 groups, 53/53 mutations; after 122.8: 27 groups, 63/63 mutations; after G-122-12: 32 groups, 74/74 mutations). `verifyPhase122AdminNotes` (122.8, real migration on PGlite): PASS, 8/8 mutations, each also caught by the database run alone. `verifyPhase122SubmitterProfiles` (122.7, real migration on PGlite): PASS, 5 mutations (also after the G-122-7 re-point). `verifyPhase121CredentialFieldCopy` 7 groups / 21 mutations, `verifyPhase121GridStructure` 7 groups / 12 mutations. Regression after 122.1: 63/64; after 122.2: 63/64; final: 64/65; after G-122-1 / G-122-2: 64/65; after 122.4: 64/65; after 122.5: 64/65; after G-122-5: 64/65; after 122.7: 64/65 plus the new `verifyPhase122SubmitterProfiles` = 65/66 (incl. the 122 verify); after G-122-7: 64/65 (+ 122 verify PASS) — `verifyPhase122SubmitterProfiles` first failed on its static check of the old inline queue call, was re-pointed to the shared loader and re-run alone: PASS; after G-122-8 + G-122-9: 64/65 (+ 122 verify PASS); after 122.8: 66/67 incl. the new `verifyPhase122AdminNotes` (+ 122 verify PASS). The one failure is `verifyPhase107Admin` |
| Notes | `verifyPhase107Admin` fails pre-phase at «Approval queue must run Login Discovery on promote» (line 147, before the re-pointed nav check). Not introduced by Phase 122. Its later static checks (lines 149–280: AC-107-9…20 registry / categories / API / CSS tokens / wave-v2 background / no credential access) were re-stated in a standalone read-only script after 122.4, again after 122.5, again after 122.7 (with the re-pointed login-URL / «הוגש ע"י» checks) and again after 122.8: all hold (the only failing condition is the same `promoteUserSubmissionWithDiscovery` string, also asserted at line 204) |

## Lint

| Field | Value |
|---|---|
| Command | `npx tsc -b`; `npm run build`; IDE lints |
| Result | PASS |
| Notes | No ESLint configured in the project |

## Functional Testability Evidence

| Field | Value |
|---|---|
| Method | End-to-end in a real browser (the real AdminApp / RegistryAdmin / editors / admin.css; stubbed API, auth, logos, extension) |
| Steps | See `verifyPhase122AdminWorkspace.mjs` groups: widths, modes, guard, tabs, tab rules, save payload, multi-step layout, readable widths, categories table, save bar on details, pattern change, in-app dialogs, field warnings |
| Expected Result | Per arch §7 |
| Actual Result | PASS |
| Notes | Screenshots via `PHASE122_SCREENSHOTS=<dir>`: catalog 1920, workspace strip, each tab, create, multi-step; 122.4: `122-4-{catalog,details,login-multi,login-standard,test-multi,test-standard,categories}-{1280,1440,1920}`, `122-4-catalog-{900,360}`, `122-4-details-360`; 122.5: `122-5-details-standard-{1280,1440,1920}`, `122-5-details-credentials`, `122-5-unsaved-notice`, `122-5-pattern-chooser`, `122-5-pattern-dialog`, `122-5-leave-dialog`, `122-5-field-warning` (categories shots now centered); G-122-5: `122-5-pattern-dialog` (new copy), `122-5-g5-multi-empty`; 122.7: `122-7-details-links`, `122-7-header`, `122-7-catalog-toolbar`, `122-7-submissions-1440` (`122-5-pattern-dialog` regenerated with the G-122-6 copy); G-122-7: `g-122-7-catalog-1440`; G-122-8: `g-122-8-submissions-1440`; G-122-9: `g-122-9-floating-1440`, `g-122-9-floating-1024`, `g-122-9-multi-1440`; 122.8: `122-8-catalog-1440`, `122-8-catalog-1440-badges`, `122-8-submissions-1440`, `122-8-header-approved`, `122-8-test-blocked`, `122-8-notes` |

## Documentation Update Evidence

| Field | Value |
|---|---|
| Documentation Updated | YES |
| Files Updated | `team-Yuri/dev-phase122.md` |
| Reason if Not Required | — |

## Known Issues / Limitations
- Re-pointed DOM assertions (existing verifies):
  - `verifyPhase121GridStructure` checkCrossCuttingGrid: «one `<select>` with 4 `<option>`» → 4 radios / no select; «`<option selected>`» → exactly one checked radio with the pattern value; «no button / input» → no button, inputs only the pattern radios; «`<select disabled>`» → `<fieldset disabled>`; M4 anchor `</label>` → `</fieldset>`.
  - `verifyPhase107Admin` AC-107-11: label read from `ADMIN_WORKSPACE_HE.registryNav` = «הגדרת אתרים» (the check also runs in the Phase 122 verify, since 107 stops earlier on its pre-existing failure).
- The pattern labels stay as today (רגיל / מסך צף / רב־שלבים / מסך צף + רב־שלבים); «שילוב» is the disabled «מסך צף + רב־שלבים» radio with «לא זמין כעת».
- The unsaved guard covers the service form and the SPECIAL draft (per the request); the STANDARD grid's own unsaved state keeps its existing in-grid handling.
- FLOATING_SCREEN: same single-column layout; field rows now group locator / location and the buttons into cells (same text, same controls).
- 122.4 deviations:
  - «אשר מיפוי» stays in its editors (login tab), per §4.3 binding; the test tab's result card shows the mapping status line next to the test result.
  - «פרטים נוספים» is now a collapsible in the side stack instead of a modal (the spec places it there). Same content, same `showMoreDetails` state; the «סגור» modal button is gone.
  - Categories: drag starts from the ⋮⋮ handle (rows now contain inputs); ↑ / ↓ unchanged. The per-row «שם תצוגה» label is visually hidden (the column header says «שם»).
  - The side stack renders for user-owned rows too (only «פרטים נוספים» in it), so that content stays reachable without the modal.
  - Mutation M20 (save bar not flush) is caught by the scrolled-into-view clearance check, which fires before the flush check.
- 122.5 deviations / notes:
  - The save bar is `hidden` (not unmounted) off «פרטי אתר», so implicit submit (Enter) and the `onInvalid` → «פרטי אתר» rule keep working from every tab.
  - Browser dialogs replaced (all of them found in `src/admin`): RegistryAdmin credential-mode clear (on change and on save), השבת אתר, leave guard (back / site switcher); AdminApp nav guard; CredentialFieldsEditor remove / id change; CategoriesAdmin delete; AutofillProfileEditor «נקה מיפוי». `DeleteServiceDialog` was already in-app; there is no `beforeunload`. The verify statically scans `src/admin` for `window.confirm / alert / prompt` and fails on any native dialog in the browser runs.
  - The pattern warning also fires for a live non-STANDARD contract without a stored draft / profile (it is a stored mapping users run on).
  - R4 reads the last saved `service_status` and `login_fields` (not the unsaved form values), so editing the status in the form does not change which fields are protected until saved.
  - The chooser has a «סגירה» button and a one-line hint (not in the spec text) so it can be closed without choosing.
  - G-122-4: the categories heading and messages are centered in the same 960px column as the table.
  - A switch that creates a dirty SPECIAL draft makes the leave guard ask on leaving the site (today's dirty rule, unchanged).
  - Re-pointed existing verifies: `verifyPhase121CredentialFieldCopy` (confirm via props, async), `verifyPhase121GridStructure` (summary button + hidden chooser).
- G-122-5 notes:
  - "Byte-equal" is checked on the stored draft. «שמור מיפוי» (unchanged save path) writes the plan bag without an empty `"active": null`; the synthetic fixture had stored that key, so the bag differs by that key only. The draft bytes are identical. Same as saving right after first open.
  - "Not dirty" is observed as: leaving the site does not ask (the leave guard reads the editor's dirty flag), and the rendered editor text equals first open.
  - Returning to the saved pattern from another SPECIAL pattern (e.g. MULTI_STEP → FLOATING_SCREEN → MULTI_STEP) also reloads the saved draft (rule 1); unsaved FLOATING_SCREEN edits are dropped, as in SPECIAL → STANDARD today.
  - Transient proposals (pending / follow-up action, held framed fields) are cleared on the reload, matching first open.
  - The old 122.5 assertion «back to SPECIAL starts a new draft» was replaced (it asserted the bug).
- 122.7 deviations / notes:
  - `LoginUrlRefresh.tsx` deleted (no other user). Re-pointed: `verifyPhase107Admin` (file list + «login URL is edited in the main form» via `UrlFieldWithCopy label="כתובת כניסה"`; «הוגש ע"י»), `verifyPhase108M1ExplicitLoginEntry` (product file list). The 122 verify's pre-phase baseline build (payload equality) resolves `./LoginUrlRefresh` to a null component.
  - «אתר חדש» matches the height and top of the whole search / filter card (≈74px at 1440 / 1280 / 1920), the literal reading of "the search / filter row".
  - The app bar shows «name · email» without a «מחובר/ת:» prefix.
  - The RPC returns only owners of `source_type = 'user'` rows (the same filter as the queue query).
  - If the RPC fails (e.g. the migration is not yet applied), the queue still loads and the cards show «משתמש לא מזוהה».
  - Card URLs: the link text is the URL itself; non-http(s) values are plain text; empty login URL → «—».
  - Date / time format: «1 באוק׳ 2026, 00:05» (he-IL, 24h, Asia/Jerusalem).
  - The queue also lists `active` user rows (unchanged query); the chip is removed for all of them.
  - `signedInAdminLabel` lives in `adminPresentation.ts` so the browser test runs the real label logic while `adminAuth` is stubbed.
  - Catalog cards (not the queue) still showed «על ידי: משתמש <id>» for user-owned rows → fixed by G-122-7.
- G-122-7 notes:
  - The RPC is called only for `source_type = 'user'` owners (as specified). A row of another source type that still has an owner (not produced by today's write paths) shows «משתמש לא מזוהה» instead of the uuid.
  - For owned rows the label now comes from the profile only; the legacy `metadata.submittedBy` fallback still applies to rows without an owner (no write path sets it today).
  - No call is made when the catalog has no user-submitted rows.
- G-122-8 / G-122-9 notes:
  - The queue details modal had no login-URL row; one was added («כתובת כניסה», same helper) so the modal follows the rule. The raw metadata JSON in the modal still shows the stored values.
  - "Workspace width ≥ 1280px" is implemented as a viewport media query `(min-width: 1280px)`.
  - Column split 1 : 1.4 (button column narrower); in the two-column mode the field table uses compact column minimums so it fits at 1280 without overflow.
  - DOM order inside the step panel is now button column → fields (start side first); the 122.3 order assertion was re-pointed to "Analyze before both, both before completeness". Below 1280px the visual stack is unchanged (CSS `order`).
  - «מיפוי שדות» now has a card border (to read as the second card); content and controls unchanged.
  - The floating-screen check drives SPECIAL «Analyze» through a harness hook (real module, only that function answers a fixed opener proposal); the real Analyze code is unchanged.
- 122.8 deviations / notes:
  - R1: Categories is the 122.4 table, not a card grid. Its rows already have one height and the verify asserts that; no categories markup changed. In the submissions grid, an opened card (approval form) switches the grid to `grid-auto-rows: auto` (`has-selection`) so the form is not squeezed into a 1fr row; at rest every card has one height.
  - R1: the «+N» count uses a zero-size, clipped measuring row, so hidden chips never cause overflow. The chip text is unchanged.
  - R2: with no saved STANDARD mapping at all, the existing «בדיקת מילוי מנוהל זמינה לאחר שמירת מיפוי…» message stays. The new notice appears only when a saved mapping exists but is incomplete. A one-step MULTI_STEP draft is "complete" for `checkSpecialDraft` (the step-count rule is the runtime gate, `validateSpecialRunnable`), so the gate follows `checkSpecialDraft` exactly as specified.
  - R3: a STANDARD profile marked `validated` whose version or fields no longer match is shown as «חסום למשתמשים» (the runtime fails closed for it, `serviceClaimsValidatedManagedProfile`). The badge reads the saved row only; unsaved form, grid or draft edits never move it (asserted).
  - R4: «הערות» is available on every saved site (any status or pattern, user submissions too). It is disabled in create mode, like the other tabs, because a note needs a saved service id. An empty note deletes the row. The legacy unused `updateAdminNotes` (metadata) API was left untouched and is not used.
  - R4: saving a note writes only `admin_service_notes`; the service save bar stays on «פרטי אתר» (the notes tab has its own buttons, per §8e).
  - Verify runtime: 122.8 mutations run only the 122.8 groups, and older mutations skip the 122.8 groups. Each older mutation was caught by the pre-122.8 groups before 122.8 existed, and each 122.8 mutation targets 122.8 behaviour.
- G-122-10 notes:
  - (a) The notes card is capped at 960px and the textarea fills its content width (`max-width: none` lifts the 122.4 560px input cap for this textarea only). The textarea starts at 14 lines (`rows={14}` + a 14-line `min-height`). It grows with the text up to `70vh` (also on window resize); past that it scrolls inside (`overflow-y: auto` only when capped). Save / cancel / «עודכן לאחרונה» / helper line unchanged.
  - (b) `updateAdminNotes` removed from `adminRegistryApi.ts`. It had no caller, and nothing in `src/` reads `metadata.adminNotes`. `verifyPhase121ContractSafeSaves` listed it among the metadata writers that must strip contract keys; that entry was removed (the other writers are still checked). Existing `metadata.adminNotes` values in stored rows (if any) are not touched — no migration, as specified.
  - Verify: the 122 harness keeps a stubbed seam (e.g. `adminRegistryApi`) stubbed when a mutation overrides it, so the new source scan (`checkNoMetadataNotes`, which reads the override source) is what catches "`updateAdminNotes` back". The 30-line case reaches the 70vh cap at 1440×900, so the test checks growth without inner scroll at 20 lines and the cap + inner scroll at 30 lines.
- G-122-11 notes (with D-121-72):
  - (a) The fill-test buttons sit in `.admin-fill-test-actions` (flex row, `gap: var(--admin-space-1)`) with `margin-top: var(--admin-space-2)` (16px), the 122.4 field-to-action token. Verified: last temp input bottom → «כניסה לאתר ומילוי שדות» top = computed `--admin-space-2`. «עצור» (D-121-72) sits in the same row while running.
  - (b) Notes textarea: `dir="rtl"` (was `auto`) + `unicode-bidi: plaintext` + `text-align: start`. Each line takes its direction from its first strong character, so English lines start at the left and Hebrew lines at the right. A line with no letters (e.g. «123.») is laid out left-to-right by Chromium under `plaintext`. The saved text is unchanged (no direction marks added).
  - Verify: `checkStopFillTest` (spacing; «עצור» only while «ממלא…», next to it; stop → cancel sent, «הבדיקה נעצרה.» for STANDARD + SPECIAL, new run allowed at once) and `checkNotesBidi` (dir / computed `unicode-bidi` / `text-align`; mixed lines saved byte-identical). Mutations M67–M71: spacing removed; plaintext removed; `dir="auto"` back; «עצור» never shown; stop shown as a failure.
- B-122-2 test hygiene (scripts only; closes B-122-1):
  - `verifyPhase112IdentityFirst.mjs`: the fixture loads `managed-target-eligibility.js` first (same list and order as `identityFirst` in `background.js`, asserted statically) and stubs the hit test (viewport 1280×800; `elementFromPoint` / `elementsFromPoint` return the email input). Mutation: eligibility script dropped → `identity_step_not_found` (caught). The extension globals are cleared before each fixture, because linkedom windows write through to the Node global (otherwise the first load leaks into the mutation).
  - Retired to `scripts/retired/` (README: what each checked + the superseding commit): 105DigitalHome, 106SecurityTrust, 107Admin, 108CustomDiscovery, 108LivePath, 108FalsePositiveGate. Not fixed or ported.
  - 101Supabase / 102Registry: LIVE-ONLY header; excluded by `LIVE_ONLY` in the new `scripts/runOfflineRegression.mjs`. Not run.
  - New `scripts/runOfflineRegression.mjs`: no runner / list existed in the repo (earlier rounds used throwaway `%TEMP%` runners). It runs every top-level `scripts/verify*.mjs` except `LIVE_ONLY`; `retired/` is outside its scan. Run once: 80 scripts, 80 PASS, 0 FAIL (live-only not run); 0 `pv-*` dirs left.
  - Left untouched (import `jsdom`, not a dependency): `reproSimpleLoginDiscovery.mjs`, `reproModalPortalDiscovery.mjs`, `capturePhase108M15LivePath.mjs`, `capturePhase108LiveDiscovery.mjs`. Historical `docs/MIGRATION_PHASE_*.md` still show the old `node scripts/verifyPhase10x…` commands (docs not in scope).
- G-122-12 notes / deviations:
  - (a) The stacked layout applies at `max-width: 1024px` (the text says "below 1024px", the test requires it at 1024). Above that the button is 180px, stretched to the card's height and top; the card takes the remaining width. No horizontal overflow at 1024 / 1280 / 1440 / 1920.
  - (b) No inline field-error component existed; the select uses the existing `aria-invalid` red border plus a new `.admin-field-error` line (`--admin-error`, `role="alert"`). No native `required` (it would show the browser bubble); `aria-required` instead.
  - (b) The old «ללא קטגוריה» option was removed (a category is now required); the placeholder has an empty value and is `disabled`.
  - (b) A save started from another tab (Enter) with no category switches to «פרטי אתר» and focuses the select. Choosing a category clears the error.
  - The guard runs before the payload is built, so the payload code (and `verifyPhase121ServiceFormSave`'s slice of it) is unchanged. The 122 verify's `saveScenarios` create path now picks cat-a explicitly (the pre-phase baseline pre-selected it), so the payload equality check still compares the same payload.
- Test policy T-1 (Owner 2026-10-03), mutation switch (scripts only):
  - New `scripts/lib/mutationArgs.mjs`: `parseMutationArgs` / `selectMutations` / `mutationId` / `formatElapsed`, shared by verifies with a mutation sweep. No switch = full sweep (END OF ROUND); `--no-mutations` = clean run only; `--mutations=M72,M73` = clean run + those mutations. The id is the leading token of the mutation label.
  - Fail-closed: an unknown id, `--no-mutations` together with `--mutations=`, an empty list, `--only` with `--mutations=`, or a selected mutation outside `--slice` throws before the browser starts (exit 1).
  - `verifyPhase122AdminWorkspace.mjs` uses it and prints its run time on the PASS line. `runOfflineRegression.mjs` is unchanged (it is END OF ROUND only and runs the full sweep).
  - Evidence: `--no-mutations` PASS, 32 groups, 3m 14s; `--mutations=M72,M74` PASS, 2 selected caught, 4m 24s (both run in parallel); the five fail-closed cases exit 1 with their message. Full sweep for comparison (G-122-12): ≈ 53m 37s.
- Test policy (Owner 2026-10-02):
  - Temp dirs: `scripts/lib/tempDir.mjs` (`makeTempDir` / `removeTempDir` / `withTempDir`). Every verify that creates a `node_modules/.tmp/pv-*` dir now removes it in a `finally` (pass or fail); an exit hook remains only as a safety net for `process.exit()` paths. Bundle-then-import helpers remove the dir once the import resolves; browser harnesses remove it after the last page use.
  - One-time cleanup: 1918 `node_modules/.tmp/pv-*` directories removed (nothing else under `node_modules` touched).
  - Scripts converted (33): `verifyPhase122AdminWorkspace` and `verifyPhase121` ContractSafeSaves, IframeSurface, Runtime, InspectReadinessEligible, GridStructure, CredentialFieldCopy, UnifiedVocabulary, RemoveFieldRow, StepButtons, ChoiceScreen, MultiStepTransition, ActionBar, SingleOpener, TestThenChoose, ServiceFormSave, SpecialSaveGuard, AnalyzeProposalQuality, MultiStepRuntime, FloatingFieldsAfterOpener, DeclaredFrameReadiness, ApproveSavedOnly, FillTestGrid (`viewDir` only), FrameBySource, AuthoringClickBounded, PasswordlessSurface, OpenerIdentification, AccessibilityNotOpener, ApproveReadback, AnalyzeExactOne, DeleteService, NoChangesToSave, UniformVisualPick. Runtime, MultiStepRuntime, InspectReadinessEligible, AnalyzeExactOne and FillTestGrid's view dir had no cleanup at all before (the source of most leftovers); the others had an exit hook only. Scripts that use the OS temp dir (`tmpdir()`) are out of scope and unchanged.
  - Each converted script: `node --check` OK, ran to exit 0 with its unchanged PASS line, and left no `pv-*` dir behind (0 `pv-*` dirs in `node_modules/.tmp` after all runs).

## Scope Compliance
- Presentation only. `handleSave` and every save path / payload unchanged (snapshot equality from every tab incl. create, user-owned and credential-mode change). 122.5: UX only; no payload, validator, contract, runtime, extension or Supabase change. 122.7: the single authorized §3 exception is the migration `20261001120000_phase122_admin_submitter_profiles.sql` (one admin-only RPC; no table / RLS change, verified by schema / policy fingerprint); save paths, payloads, validators, contract, runtime, extension and Digital Home unchanged. 122.8: the single authorized §3 exception is `20261002120000_phase122_admin_service_notes.sql` (one admin-only table; no other table / column / RLS flag / policy changed, verified by fingerprint). Fill-test gate is Admin-only; runtime, validators, approval gates, contract and extension unchanged. G-122-12: presentation + form validation only; no DB, payload shape, runtime or extension change.
- `extension/` unchanged by the 122 slices; `extension/background.js` changed only by D-121-72 (Phase 121 slice, delivered in the same run as G-122-11, see dev-phase121). Before D-121-72: 17 file hashes identical to the pre-phase snapshot; `git diff extension/` identical to the pre-phase diff of uncommitted Phase 121 work).
- No site / hostname / serviceId branches. final_submit untouched. 121.4 not implemented. No env / secrets / live DB access.

## Developer Declaration
Implemented 122.1 → 122.2 → 122.3, the G-122-1 / G-122-2 fixes, 122.4, 122.5 (R1–R4, R4 option b, G-122-4) , fix G-122-5, 122.7 (items 1–6 incl. G-122-6), G-122-7, G-122-8, G-122-9, 122.8 (R1–R4), G-122-10 (+ test policy temp-dir cleanup), G-122-11 (with D-121-72), B-122-2 and G-122-12 within the authorized scope, with verify evidence per slice.
