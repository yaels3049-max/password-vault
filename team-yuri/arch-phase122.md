# Phase 122 — Admin Workspace (full-width Admin layout)

Status: OWNER APPROVED / AUTHORIZED 2026-10-01 — 122.1 + 122.2 + 122.3 in one Developer run (Owner choice); one combined Owner live check.
Type: presentation / layout only. Phase 121 continues in parallel (live checks only).

## 1. Problem
- `admin.css` caps `.admin-app-header` / `.admin-app-main` at `max-width: 1100px` (centered), so the Admin looks like the phone-shaped Digital Home on a wide screen.
- In «כל האתרים», `.admin-split` gives the site list ~40 % of that width; the editor gets ~560 px.
- `RegistryAdmin.tsx` renders the whole service in one long column inside one `<form>`: name, URLs, login entry type, credential mode + `CredentialFieldsEditor`, `LoginPatternGrid`, `SpecialLoginDraftEditor`, `AutofillProfileEditor`, `AdminFillTestGrid`, category, icon, `LoginUrlRefresh`, «פרטים נוספים» (`IntegrationStatusPanel`, `LoginIntelligencePanel`), delete.

## 2. Goal
Full-width Admin used on a desktop screen: a catalog mode for all sites and a focused workspace for one site, with the existing grids grouped into tabs and a real steps sidebar for multi-step flows. Owner reference: product-manager mockup (inspiration only; see §6 for what is excluded).

## 3. Binding constraints
- **Presentation only.** No change to: save paths and payloads (service form save incl. D-121-64 / D-121-65 guards, SPECIAL draft save, approve), validators, contract, runtime, extension, manifest / permissions, Supabase schema / RLS, Digital Home.
- Every existing control keeps its behavior, copy and enablement rules (gates, locks, busy states, D-121-67 step panel, D-121-69 remove, fill test, approve readback).
- **No unmount of stateful editors on tab switch.** Tabs hide panels (`hidden` / CSS); `SpecialLoginDraftEditor`, `AutofillProfileEditor`, `AdminFillTestGrid`, the service form state and in-progress Visual pick / fill test survive tab changes.
- **Unsaved-changes guard.** Leaving the site (site switcher, «מעבר לרשימת האתרים», nav to another Admin section) while the service form or a SPECIAL draft is dirty asks for confirmation (existing dirty signals: form / `configurationTouched`, `specialDraftDirty`). Cancel keeps everything.
- `FLOATING_SCREEN_MULTI_STEP` («שילוב») stays NOT AUTHORIZED (121.4): shown disabled with a short note, or hidden — never selectable.
- RTL, Hebrew, existing Admin visual language (colors, radius, font); Digital Home stays phone-shaped.
- No site / hostname / serviceId branches.

## 4. Design

### 4.1 Shell (122.1)
- Remove the 1100 px cap: header and main span the viewport with side padding (content max ~1600 px or none; no centered narrow column).
- **Top app bar:** title «מרכז הבקרה של הכספת» + subtitle; primary nav (existing tabs: «כל האתרים» → label «הגדרת אתרים», «אתרים בהוספה ע"י משתמשים», «קטגוריות»); «חזרה לבית הדיגיטלי» and the signed-in admin at the far side.
- «קטגוריות» and «אתרים בהוספה ע"י משתמשים» use the full width with their current content (list / detail split may stay, now wider).

### 4.2 Catalog mode (122.1)
- «הגדרת אתרים» opens the site catalog full width: search, category / source / status filters, «אתר חדש», site cards in a responsive multi-column grid (same card content and badges as today).
- Selecting a site (or «אתר חדש») enters workspace mode; the catalog is not shown next to the workspace.

### 4.3 Workspace mode (122.1 shell, 122.2 tabs)
- **Site strip:** icon + name, status chip (existing status: פעיל / ממתין לאישור / מושבת / אושר למשתמשים as derived today), site switcher dropdown (same list + search as the catalog; subject to the unsaved guard), «מעבר לרשימת האתרים».
- **Tabs (122.2):**
  1. «פרטי אתר» — name, Home URL, login entry type + login URL, category, icon (`IconAssetEditor`), `LoginUrlRefresh`, «פרטים נוספים» (`IntegrationStatusPanel`, `LoginIntelligencePanel`), delete (`DeleteServiceDialog`).
  2. «הגדרת כניסה ומילוי» — credential mode, `CredentialFieldsEditor`, `LoginPatternGrid`, `SpecialLoginDraftEditor`, `AutofillProfileEditor` (same conditions as today: global row, not creating, `credential_fields`). User-owned rows: the tab shows today's user-owned state (no authoring).
  3. «בדיקה והפעלה» — `AdminFillTestGrid` (fill test, result, approve) + mapping status line.
- The service form save button (today at the form bottom) is visible on every tab (sticky action bar) and saves the whole form exactly as today; SPECIAL «שמור מיפוי» / «אשר מיפוי» stay in their editors.
- «אתר חדש»: only «פרטי אתר» (+ credential fields if today's create flow shows them) until the first save; other tabs disabled with a hint.
- Wide screens: within a tab, sections may use two columns where content is independent (e.g. «פרטי אתר» form | icon + details); authoring grids use the full tab width.

### 4.4 Multi-step authoring layout (122.3)
Applies inside «הגדרת כניסה ומילוי» for MULTI_STEP (and FLOATING_SCREEN as a single step).
- Pattern choice as a horizontal radio row: «כניסה רגילה» / «מסך צף» / «תהליך רב־שלבי» / «שילוב» (disabled, 121.4). Same `LoginPatternGrid` logic and locks.
- **Steps sidebar «שלבי התהליך»:** one item per draft step («שלב N» + short status: fields mapped count, button chosen / ממתין לבדיקה / אין כפתור / שלב אחרון). Selecting an item = today's «שלב נוכחי» selection (same state). No «הוסף שלב», no drag reorder.
- **Main panel for the selected step:**
  - «שדות השלב» table: field name (from login_fields) | mapping status (locator + location or «—») | actions: «מיפוי חזותי», «הסר מיפוי» (D-121-69), per today's rules.
  - «כפתור מעבר» table / card: the step's exit (D-121-67 A/E): label / locator, location, status, «בדוק», «זה לא הכפתור», «מיפוי חזותי»; last step «שלב אחרון — אין כפתור מעבר».
  - Proposals for this step (D-121-67 B) and the Analyze / manual-pick top bar stay attached to the panel.
- Completeness line and messages unchanged, placed under the step panel.

## 5. Slices
- **122.1 — Shell + catalog / workspace modes:** full width, top app bar, catalog mode, workspace site strip with switcher + back, unsaved guard. Existing long column moves as-is into the workspace.
- **122.2 — Workspace tabs:** split the workspace into the three tabs (§4.3), sticky save bar, no-unmount rule, create-mode tab rules.
- **122.3 — Multi-step layout:** pattern radio row, steps sidebar, step fields table, step button card (§4.4).
Owner chose one run for all three (2026-10-01): implement in order 122.1 → 122.2 → 122.3 with verify evidence per slice; one combined Owner live check at the end.

## 6. Excluded from the mockup (conflicts with the model)
- «הוסף שלב», drag reorder of steps — steps are created only by a tested transition (R3 / D-121-58).
- «הוסף פעולה», action-type dropdown — actions come only from Analyze / «בדוק» / «מיפוי חזותי».
- Duplicate icons; per-row delete other than «הסר מיפוי».
- Free «סוג שדה» per step — field types are the service login_fields (edited in `CredentialFieldsEditor`, same logic).
- «שילוב» as selectable.

## 7. Verification (per slice)
- Layout: at 1920 / 1440 / 1280 widths the workspace uses the full width; no 1100 px cap; ≤ 900 px falls back to one column.
- Mode switch: selecting a site hides the catalog; back / switcher restore it; unsaved guard fires for dirty form and dirty SPECIAL draft, not otherwise.
- Tabs: switching tabs keeps unsaved form values, SPECIAL draft, running fill test / Visual pick; save from any tab persists the same payload as before (payload snapshot equality).
- 122.3: sidebar selection == «שלב נוכחי» state; D-121-67 / D-121-69 verifies still pass; «שילוב» not selectable.
- All existing verifies pass unchanged except DOM-structure assertions that must be re-pointed (list them); `tsc -b`, build, lint clean; no extension diff.

## 8. Implementation review — PASS with 2 conformance fixes (2026-10-01)
Evidence (Developer): new `verifyPhase122AdminWorkspace.mjs` (real Admin page in Edge, in-memory data; all groups per slice; 14/14 mutations); save writes identical to pre-phase `RegistryAdmin` from all three tabs (edit, credential-mode change, user-owned, create); D-121-67 / D-121-69 verifies pass; regression 64/65 — `verifyPhase107Admin` fails on a pre-existing check ("Approval queue must run Login Discovery on promote"), unrelated; tsc / build clean; no `extension/` diff. Re-pointed: `verifyPhase121GridStructure` (select → radio row, fieldset disabled), `verifyPhase107Admin` nav label (also asserted in the 122 verify). Screens reviewed: catalog 1920 (6 columns), details tab (form | icon + login-URL column), multi-step layout.
Accepted deviations: no `manager-phase122.md` / `PHASE.md` still 121 (Owner-authorized direct run; PHASE.md is not Architect-writable after INIT); pattern labels unchanged («מסך צף + רב־שלבים» disabled); unsaved guard covers service form + SPECIAL draft (STANDARD grid keeps its own handling); FLOATING rows in cells.
Conformance fixes (within the approved spec, no new authorization):
- **G-122-1:** §4.4 — the sidebar replaces «שלב נוכחי»; the old select is still rendered above the sidebar. Hide it (state stays the same; sidebar drives it). Verifies that read the select re-point to the sidebar.
- **G-122-2:** the sticky save bar overlaps the last controls of the scroll area (step button card buttons hidden under «שמור / ביטול» in the multi-step screen). Reserve bottom space equal to the bar height (padding / scroll-padding) so the last control is fully visible and clickable at scroll end, on every tab.
Backlog: B-122-1 — pre-existing `verifyPhase107Admin` failure (promote → Login Discovery check); owner-side triage later.
Owner live: checklist 1–10 from the Developer report after G-122-1 / G-122-2. Phase 122 CLOSED on live PASS.

**G-122-1 / G-122-2 review — PASS (2026-10-01).** Evidence: 122 verify 8 groups, 16/16 mutations (M15 select restored, M16 space removed); six 121 verifies re-pointed to the sidebar; regression 64/65 (B-122-1 only); tsc / build clean; extension hashes identical. Screens 1280 / 1920 scroll-end: sidebar only, step card + «שמור מיפוי / אשר מיפוי» above the bar.
Cosmetic note G-122-3 (non-blocking, Owner to judge live): mid-scroll, content is visible in the ~10 px strip **below** the sticky bar (the bar sits inside the panel padding), e.g. button tops peeking under «שמור / ביטול» at 1280. Fix only if the Owner finds it disturbing (bar flush with the container bottom or opaque strip under it).
Owner live: Developer checklist 1–10. Phase 122 CLOSED on live PASS.

## 8a. Owner live feedback (2026-10-01) — widths and look
Screens (Zoom service, all tabs + «קטגוריות»):
- **Over-stretched controls:** every input / select spans the whole tab width (≈ 1000 px+ for a URL or a short name); labels sit far from content; long empty rows.
- **«פרטי אתר»:** one very wide form card; the icon / login-URL column is narrow with its **own** scrollbar; large empty area below.
- **«הגדרת כניסה ומילוי»:** `CredentialFieldsEditor` field cards stretch full width; **horizontal overflow** — the page is cut on the left («מעבר לרשימת האת…» clipped, select arrow off-screen).
- **«בדיקה והפעלה»:** two fill-test inputs across the full width, nothing beside them.
- **«קטגוריות»:** the reorder list rows span ~70 % of the screen with the arrows at the far edge; the editor list is narrow with its own scrollbar.
- General: small type relative to the screen, flat hierarchy, nested scroll areas.
Root cause: 122.1 removed the cap on the shell **and** let every inner block fill the width; full width was meant for the workspace layout, not for individual controls.

## 8b. 122.4 — Visual system + readable widths (OWNER APPROVED / AUTHORIZED 2026-10-01 — Developer)
Presentation only; §3 binding constraints apply unchanged (no save / payload / logic / extension changes; no unmount on tab switch; guards unchanged).
1. **Width rules.**
   - Shell full width; **workspace content max 1440 px**, centered, side padding 24–32 px.
   - **Controls never stretch:** text / URL inputs max 560 px (short fields such as name / select ≤ 420 px); buttons auto width. Forms use a **2-column field grid** on ≥ 1200 px (label above input), 1 column below.
   - Tables may use the content width but with fixed / min-max column widths (no 600 px gap between a name and its buttons).
   - **No horizontal overflow** at any width ≥ 360 px (fix the login-tab overflow).
   - **One scroll** per page (window / workspace body). Remove nested scrollbars from side columns and category lists; only the catalog grid and long lists that already page may keep a pane scroll.
2. **Layout per tab (12-column grid).**
   - «פרטי אתר»: main card (8 cols) with the 2-column field grid; side stack (4 cols): icon card, login-URL card, «פרטים נוספים» collapsible — natural height, no inner scroll; destructive actions (השבת / מחיקת אתר) in a separate «אזור מסוכן» card at the bottom.
   - «הגדרת כניסה ומילוי»: credential fields as a **compact table / card grid** (one row or card ≈ 360 px per field: name, password-field checkbox, allowed value, required, ↑ ↓ הסר), «הוסף שדה» below; pattern radio row as segmented cards; authoring area full content width with the steps sidebar (≈ 260 px) + step panel.
   - «בדיקה והפעלה»: two columns — fill-test card (inputs ≤ 420 px, button) | result + status + «אשר מיפוי» card.
   - «קטגוריות»: one table (max 960 px): name | edit | delete | ↑ ↓, plus «קטגוריה חדשה» inline at the top; no second list column.
3. **Modern visual system (design tokens in `admin.css`).**
   - Base font 15–16 px (Assistant), clear scale: page title 24, section 18, card title 16, hint 13; line-height 1.5.
   - Neutral background (#f5f7fb), white cards, radius 14, soft shadow, 1 px #e6eaf0 borders, 24 px card padding, 16 / 24 px spacing scale.
   - Inputs 40 px high, radius 10, visible focus ring (primary 3 px, 25 % alpha), consistent disabled / error states.
   - Buttons: primary (filled), secondary (outline), danger (soft red), ghost; 36–40 px high; icon + text where useful.
   - Tabs as an underlined tab bar with icons; status chips as pills (green / amber / red / gray).
   - Section headers with a short description line; empty states with an icon and one sentence.
   - Icons: inline SVG set in the codebase (no new dependency).
   - Subtle motion only (150 ms hover / focus); respects `prefers-reduced-motion`.
   - Sticky save bar: full workspace width, opaque, top shadow, flush with the bottom (resolves G-122-3).
4. **Verification.** At 1280 / 1440 / 1920: no input wider than its cap; no horizontal scroll (`scrollWidth ≤ clientWidth`); no nested scrollbars on the details / login / test tabs and categories; save bar opaque and flush; all 122 / 121 verifies pass; payload equality unchanged; screenshots of every tab + categories at 1440 and 1920.

**122.4 implementation review — PASS (2026-10-01).** Evidence: 122 verify 10 groups, 21/21 mutations (M17–M21 new); payload equality from all tabs unchanged; categories API calls identical; regression 64/65 (B-122-1 only; its later CSS / categories checks run separately and hold); tsc / build clean; extension hashes identical. Screens reviewed (1440): details 8 | 4 with 2-column field grid + «אזור מסוכן»; login multi-step with 260 px sidebar, step card clear of the bar; test tab two cards with empty state; categories single table. Widths / overflow / nested-scroll issues from §8a resolved.
Accepted deviations: «אשר מיפוי» stays in the login-tab editor (§4.3); «פרטים נוספים» collapsible instead of modal; categories drag by ⋮⋮ handle; user submissions get a side stack with «פרטים נוספים» only.
Cosmetic G-122-4 (fold into 122.5): the categories table (max 960 px) hugs the right edge with a large empty area on the left at ≥ 1440 — center it in the content area.
Pattern segmented cards from 122.4 are superseded by 122.5 R2 (summary + guarded change).

## 8c. Owner requests 2026-10-01 → 122.5 (OWNER APPROVED / AUTHORIZED 2026-10-01, R4 = option b) + 122.6 (design note, later)
R4 (b) operational rule: Admin has no access to user credentials, so "users already use it" = the site's saved status is active (visible to users). Warn (in-app dialog, R3) only when removing or changing the id of a field whose id is in the **last saved** login_fields of an **active** site. No warning for: new / unsaved fields, label or other attribute edits, inactive / draft sites, user-owned rows. Same rule for the credential-mode clear warning (`MODE_CLEAR_WARNING`): only when saved fields exist on an active site.
**R1 — save bar only on «פרטי אתר».** Today «הגדרת כניסה ומילוי» hosts credential mode + `CredentialFieldsEditor`, which the service-form save persists — so the bar is relevant there now. Resolution: move «פרטי כניסה» (credential mode) + «שדות כניסה» (`CredentialFieldsEditor`) to «פרטי אתר» (own card «שדות כניסה»), and show «שמור / ביטול» only on «פרטי אתר». «הגדרת כניסה ומילוי» = pattern + mapping (own «שמור מיפוי»); «בדיקה והפעלה» = fill test + «אשר מיפוי». Same form, same `handleSave`, same payload; no unmount.
**R2 — «אופי הכניסה» is not a casual control.**
- Replace the radio / segmented row by a read-only summary «אופי הכניסה: <pattern>» + «שינוי אופי הכניסה» button. While the site has no saved mapping for the current pattern, the button opens the chooser directly (cards) — new sites choose freely.
- When a saved mapping (STANDARD profile or SPECIAL draft / live contract) exists, or the site is approved for users, the button first opens an in-app warning dialog: what will be replaced, that users keep the current approved mapping until a new «אשר מיפוי» (state the actual effect — the Developer documents exactly what switching does today and the copy must match it), [«שינוי בכל זאת»] [«ביטול»] (ביטול = default focus).
- No pattern change may delete a stored mapping without that confirmation. Locks (`patternSelectorLocked`) unchanged; «שילוב» stays disabled.
**R3 — no browser dialogs.** Replace every `window.confirm` / `alert` in Admin with one in-app `AdminConfirmDialog` (title, body, primary / secondary / danger buttons, Esc = cancel, focus trap, RTL), same style as the existing «אשר מיפוי» confirmation. Sites today: `RegistryAdmin` (credential-mode clear ×2, disable site, workspace leave guard), `AdminApp` (nav leave guard), `CredentialFieldsEditor` (field id change / remove), `CategoriesAdmin` (delete category), `AutofillProfileEditor` (confirm). Errors / results show in-app (existing notices), never as browser alerts. Exception: the native `beforeunload` prompt (browser-only) may stay.
**R4 — field-id warning in «פרטי אתר».** `ID_CHANGE_WARNING` exists because user-saved credential values are keyed by field id: changing / removing a saved field id hides users' stored values for that field (not copied). Owner: Admin must not be nagged. Options for the Owner (see question): (a) no warning at all; (b) warn only when removing / renaming a field id **that is already saved** on a site **that users already use** — never for new / unsaved fields or label edits. Architect recommends (b).
**122.5 implementation review — PASS (2026-10-01).** Evidence: 122 verify 14 groups, 33/33 mutations (4 new groups: details-only save bar, pattern change, in-app dialogs incl. a native-dialog tripwire + static scan, R4 matrix); `verifyPhase121CredentialFieldCopy` / `GridStructure` re-pointed; regression 64/65 (B-122-1 only); tsc / build clean; extension hashes identical. Pattern-switch behavior documented in `dev-phase122.md` before R2 (switch writes nothing; only «שמור מיפוי» / «אשר מיפוי» replace stored data). Screens: details 1440 with «שדות כניסה» card; pattern warning dialog.
Accepted deviations: save bar hidden (not removed) on other tabs (Enter-to-save + invalid-field jump); warning also when the live mode is SPECIAL without a stored draft / profile; R4 uses last saved state; «סגירה» on the chooser; categories header centered with the table; a switch can create an unsaved SPECIAL draft → existing leave guard.
**Finding G-122-5 (from the documented behavior — the root of the Owner's "one click destroys the mapping"):** STANDARD → SPECIAL starts the SPECIAL editor from an **empty** draft and does **not** reload the saved SPECIAL draft — also when returning to the saved pattern in the same session (e.g. MULTI_STEP → STANDARD → MULTI_STEP). The editor then looks wiped, and a «שמור מיפוי» there replaces the saved draft with the empty / partial one. The dialog copy is also long (5 technical bullets).
Fix G-122-5 — OWNER APPROVED / AUTHORIZED 2026-10-01 (Developer): selecting a SPECIAL pattern equal to the saved draft's pattern loads the saved draft (as on first open); a different SPECIAL pattern keeps today's behavior (`ensureSpecialDraft`). Returning to STANDARD shows the saved STANDARD profile (already true — mounted). Dialog copy shortened to 2–3 plain lines matching the corrected behavior. No save-path / payload change.

**G-122-5 implementation review — PASS (2026-10-01).** Evidence: 122 verify 15 groups, 37/37 mutations (new `checkPatternReturn`, M34–M37); the old assertion that encoded the bug removed; 121 suite pass; regression 64/65 (B-122-1); tsc / build clean; extension hashes identical. Code path: `onPatternChange` → saved pattern ⇒ same load path as first open (not dirty); other SPECIAL ⇒ unchanged.
Accepted deviations: byte-equality on the draft (save path already drops an empty `"active": null` key — pre-existing); returning to the saved pattern from another SPECIAL pattern also reloads (unsaved edits of the other pattern dropped; the warning dialog precedes any switch on a site with a saved mapping); unsaved proposals cleared on reload.
Copy note G-122-6 (fold into 122.7): Admin copy elsewhere uses neutral plural («בחרו», «בדקו»); the dialog says «תלחצי». Change to «…הוא יוחלף רק אחרי «שמור מיפוי» באופי הכניסה החדש.»

## 8d. 122.7 — Admin clean-ups + richer submissions (OWNER APPROVED / AUTHORIZED 2026-10-01 — Developer, after G-122-5)
1. **Remove the «כתובת כניסה» side card** (`LoginUrlRefresh`) from «פרטי אתר». The main form already edits the login URL and saves it. Its «שמור ידנית» duplicates that; «סמן כלא תקין» is dropped with it (the next form save sets `login_url_status = 'valid'` anyway). `onManualSave` / `onMarkInvalid` handlers removed only if unused elsewhere.
2. **Open links next to the URLs** in «פרטי אתר»: beside «כתובת הבית» a link «דף הבית», beside «כתובת כניסה» a link «דף כניסה» (login URL; hidden when entry type is the home page). `target="_blank" rel="noopener noreferrer"`, uses the **current form value**, shown only for a valid http(s) URL; the copy button stays.
3. **App bar:** remove «חזרה לבית הדיגיטלי» from the Admin header. Show the signed-in admin as «<שם פרטי> <שם משפחה> · <email>» (own `public.users` row, already readable); fall back to email only when the name is empty.
4. **Catalog toolbar:** «אתר חדש» matches the height of the search / filter row and is vertically aligned with it.
5. **«אתרים בהוספה ע"י משתמשים» cards** — larger cards (≈ 2–3 per row at 1440) with:
   - «הוגש ע"י: <שם פרטי> <שם משפחה>» + the submitter's email as a `mailto:` link (no «משתמש <uuid>»; fallback «משתמש לא מזוהה» when not resolvable).
   - Submission date **and time** (HH:mm, Israel time).
   - «כתובת הבית» as a clickable link (new tab) + the URL text.
   - «כתובת כניסה» always shown: the link + text when given, «—» when empty.
   - **No status chip** (the queue lists pending submissions only — `fetchPendingSubmissions`).
   - The details modal keeps its content (technical ids may stay there).
   **Data:** Admin RLS cannot read other users' rows (`users_select_own`). Add one Supabase migration: `SECURITY DEFINER` RPC `admin_submitter_profiles(p_user_ids uuid[])` → `(id, first_name, last_name, email)`; requires `public.is_admin()`; returns only users who own at least one user-submitted registry row; `revoke all from public; grant execute to authenticated`. No table / policy change; no credential data. Explicit exception to §3 "no Supabase" for this item only.
- Unchanged: save paths / payloads, validators, contract, runtime, extension, Digital Home. In-app dialogs (122.5) for anything that confirms.
- Verify: card fields (name, mailto, date + time, both links, «—» for empty login URL, no status chip); RPC returns nothing for a non-admin and nothing for ids without a submission; links use the live form value, open in a new tab, hidden for invalid URLs; header without «חזרה לבית הדיגיטלי», with name + email; «אתר חדש» height == search row height; «כתובת כניסה» card absent; mutations.

**122.6 (later, Owner «בהמשך») — fixed message area.** Answer: do not cap each grid; make the workspace an app shell: header + site strip + tabs fixed, a fixed **message bar** at the bottom (latest status: Analyze / field detection / fill-test progress / errors / success, with time; expandable recent history), and **only the tab body scrolls** between them. Long lists inside (steps sidebar) stay sticky; a grid gets its own scroll only if it alone exceeds the body. The 122.4 "one scroll per page" becomes "one scroll per tab body". Spec + approval when the Owner asks.

**122.7 implementation review — PASS (2026-10-01).** Migration `20261001120000_phase122_admin_submitter_profiles.sql` read: `security definer`, `set search_path = public`, `is_admin()` guard with raise, returns only id/first_name/last_name/email of requested ids owning a `source_type='user'` registry row, null-safe input, execute revoked from public/anon and granted to authenticated; no table/RLS change — conforms to §8d. Evidence: 122 verify 19 groups 46/46 mutations; RPC verify on PGlite (non-admin / disabled admin / anon / no session rejected; column set exact; schema + policies unchanged; 5 mutations); regression 65/66 (B-122-1); tsc / build clean; extension identical. Screenshot of submission cards conforms (name + mailto, date + HH:mm, links, «—», fallback «משתמש לא מזוהה», no status chip).
Accepted deviations: `LoginUrlRefresh.tsx` deleted; «אתר חדש» matched to the search/filter card height; no «מחובר/ת:» prefix; RPC failure degrades to «משתמש לא מזוהה» (fail-safe, queue still loads); non-http(s) URLs shown as plain text.
G-122-7 (backlog, small): catalog cards still show «על ידי: משתמש <id>» for user-submitted sites — can reuse the same RPC. Owner action: apply the migration in Supabase before the live check.

**G-122-7 — OWNER APPROVED / AUTHORIZED (2026-10-01), before the live check.** Catalog cards of user-submitted sites show «על ידי: <first> <last>», or the email when the name is empty, or «משתמש לא מזוהה» — never the uuid. Data: the existing `admin_submitter_profiles` RPC, called once per catalog load with the distinct `owner_user_id`s of `source_type='user'` rows; reuse the queue's fetch/label helper. RPC failure → fallback label, catalog still loads. No migration, no other change.

**Owner live finding (2026-10-01):** queue cards show «משתמש לא מזוהה» for all submitters — diagnosis: the 122.7 migration not yet applied in Supabase (RPC missing → designed fallback). Owner action: apply the migration; if the names are still missing after that, reopen.

**G-122-8 — OWNER APPROVED / AUTHORIZED (2026-10-01), after G-122-7.** When a user gives no login URL, Digital Home stores `login_url = primary_url` with `metadata.loginEntryType = 'primary_page'` (`explicitLoginEntry.ts`), so the queue card shows the home URL as the login URL. Rule: queue cards and the details modal show the «כתובת כניסה» link only when `metadata.loginEntryType === 'direct_url'` and the URL is valid http(s); otherwise «—». The «דף כניסה» link in «פרטי אתר» already follows this rule. Presentation only: stored data, promote / discovery and runtime unchanged.

**G-122-9 — OWNER APPROVED / AUTHORIZED (2026-10-01), same run as G-122-8.** Owner live: in the SPECIAL step editor, «נמצא כפתור באתר» and «מיפוי שדות» are stacked and each stretches to the full width. 122.4 capped control widths but defined no side-by-side rule for sibling cards. Rule:
- At workspace width ≥ 1280px, a step that has both an opener/exit card and a field-mapping card shows them in a two-column grid with equal heights: the button card on the start side (right in RTL), «מיפוי שדות» on the end side. Below 1280px they stack.
- The gap message, «שמור מיפוי» / «אשר מיפוי» and the help text span the full width below both cards.
- A step with only field mapping keeps that card at a readable width (the 122.4 cap), not stretched.
- Applies to every SPECIAL pattern that shows both cards (floating screen, multi-step). CSS / layout only: the same DOM order and controls, no behaviour, save, validator, runtime or extension change.

**G-122-7 review — PASS (2026-10-01, from `dev-phase122.md`; the Owner did not forward a separate report).** Shared `loadSubmitterProfiles(rows)` (one RPC call, distinct owners of user rows, empty map on failure) + `submitterLabel`; the uuid branch of `addedByLabel` removed; queue and catalog use the same helpers. Conforms.

**G-122-8 + G-122-9 review — PASS (2026-10-02).** Evidence: 122 verify 22 groups, 53/53 mutations (M50–M53 as required); regression 64/65 (B-122-1); tsc / build clean; extension unchanged. Screenshots conform: queue cards show the login link only for `direct_url`, «—» otherwise; floating step at 1440 shows the button card (right) and «מיפוי שדות» (left) with equal heights and the gap message full width below; 1024 stacked.
Accepted deviations: «כתובת כניסה» row added to the details modal; breakpoint as a viewport media query; column ratio 1 : 1.4 with smaller field-table minimums; the step-exit card moved into the button column (DOM order changed, visual order below 1280 restored with `display: contents` + `order`; the 122.3 order check updated accordingly); «מיפוי שדות» bordered; a test-harness opener proposal for screenshots only (real Analyze unchanged).
Phase 122 code slices 122.1–122.5, 122.7, G-122-1…G-122-9 all reviewed PASS. Remaining: Owner applies the 122.7 migration, then one combined live check.

## 8e. 122.8 — Owner requests 2026-10-02 (R1–R4 OWNER APPROVED / AUTHORIZED 2026-10-02 — Developer, one run; R3 catalog filter NOT included; R5 deferred)

**R1 — uniform site cards.** Owner screenshot: catalog cards in the same grid have different heights (chip rows wrap differently). Rule for every Admin card grid (catalog «הגדרת אתרים», «אתרים בהוספה ע"י משתמשים», categories): all cards of a grid have one height (`grid-auto-rows: 1fr`, card stretches); fixed internal layout — header (icon + name, name clamped to 2 lines with a title tooltip), chips row (one line; overflow → «+N» chip with a tooltip listing the hidden chips), footer pinned to the bottom (`margin-top: auto`). No content removed. Presentation only.

**R2 — «בדיקת מילוי» only for a complete saved mapping.** Code read: the test is gated on "saved + not dirty + temp values", not on completeness. STANDARD `savedProfileReady` = at least ONE mapped field + entry URL + origin; SPECIAL `specialRunnable` = a saved draft of a runnable pattern (`fillTestContext.ts`). `checkSpecialDraft` exists but the test does not use it. Rule:
- SPECIAL: runnable only when `checkSpecialDraft(saved draft).complete`.
- STANDARD: runnable only when every declared login field has a saved mapping with a locator (plus the existing entry URL / origin conditions).
- When blocked by completeness: the run button is disabled and a fixed in-tab notice (not a toast) shows «המיפוי השמור עדיין לא הושלם — לא ניתן להריץ בדיקת מילוי.» plus the existing gap detail (SPECIAL: the `checkSpecialDraft` message; STANDARD: the names of the unmapped fields) and a link-button «מעבר להגדרת כניסה ומילוי». Partial saves stay allowed.
- Admin-only gate; runtime, validators and approval gates unchanged.

**R3 — "approved for users" badge.** Meaning: «do users get automatic fill for this site right now». It must be derived from what the user runtime actually resolves (the active login contract / approved STANDARD profile), not from editor state. Notes: STANDARD `changes_not_approved` stops user fill until re-approval (per the 122.5 dialog exception) → NOT approved; SPECIAL `changes_not_approved` keeps the previously approved plan → approved.
- States: «מאושר למשתמשים» (strong green), «טרם אושר למשתמשים» (strong amber), «חסום למשתמשים» (strong red: SPECIAL_INVALID / approved mapping invalid), «אין מיפוי» (neutral, when there is no mapping at all).
- Where: workspace header next to the site name, visually dominant over the «פעיל / מושבת» chip (larger pill, filled colour, icon); on every catalog card in a fixed position (top corner), same colours. Optional catalog filter «מצב אישור» next to the existing filters.
- Presentation only; one shared pure helper used by header, cards and filter.

**R4 — Admin notes per site (needs ONE migration — explicit exception).** A fourth workspace tab «הערות» after «בדיקה והפעלה», always available (any status, any pattern, also user submissions).
- Storage: new table `public.admin_service_notes (service_id text primary key references service_registry(id) on delete cascade, body text not null check (char_length(body) <= 20000), updated_at timestamptz not null default now(), updated_by uuid)`. RLS enabled; select / insert / update / delete only `public.is_admin()`. NOT in `service_registry.metadata` (metadata reaches users and the runtime).
- UI: a large textarea (readable width, auto-grow), «שמור הערה» + «בטל שינויים» inside the tab (exception to the "save bar only on «פרטי אתר»" rule: notes are a separate document), «עודכן לאחרונה: <date HH:mm>». Unsaved notes join the existing unsaved guard (AdminConfirmDialog). A small «יש הערה» marker on catalog cards that have a note (one extra query per catalog load, ids only).
- Helper line in the tab: «ההערות גלויות למנהלים בלבד. לא לשמור כאן סיסמאות.» (notes are not encrypted).

**122.8 implementation review — PASS (2026-10-02).** Migration `20261002120000_phase122_admin_service_notes.sql` read: table as specified (PK + FK cascade, 20000 check), RLS on, four `is_admin()` policies to authenticated, anon / public revoked — conforms. Evidence: 122 verify 27 groups 63/63 mutations; `verifyPhase122AdminNotes` on PGlite 8/8; regression 66/67 (B-122-1); tsc / build clean. Screenshots: uniform catalog cards with all four badge states and «+N»; header badge filled and dominant over «פעיל»; blocked test notice with the missing field + tab button; notes tab.
Accepted deviations: categories is a table (rows already equal); an opened submission card uses auto row height; STANDARD with nothing saved keeps the "unavailable" message; one-step MULTI_STEP follows `checkSpecialDraft`; stale `validated` STANDARD → «חסום»; notes tab disabled in create mode; empty note = delete.
Findings → G-122-10: (a) the notes textarea is small (560px cap, ~5 lines, no auto-grow) — a notes document needs the card width (cap 960px), min ~14 lines and auto-grow; (b) the legacy unused `updateAdminNotes` in `adminRegistryApi.ts` writes `metadata.adminNotes` into `service_registry` (user-readable) — remove it and any reader so notes can never go to metadata. **G-122-10 OWNER APPROVED / AUTHORIZED (2026-10-02).**

**G-122-10 review — PASS (2026-10-02).** Notes card ≤ 960px, textarea full card width, 14-line start, auto-grow to ~70vh then inner scroll (screenshot conforms); `updateAdminNotes` removed, no `metadata.adminNotes` reader in `src/`; 122 verify 28 groups 66/66 (M64–M66); notes PGlite 8/8; tsc / build clean. Test policy applied: 1,918 temp dirs removed, 33 verifies clean up in `finally` via `scripts/lib/tempDir.mjs`. Accepted deviations: 20-line growth / 30-line cap check; OS-temp scripts unchanged; exit-hook safety net. Owner action (data, optional): check for legacy `metadata.adminNotes` in `service_registry` rows and strip it if present (user-readable).

**G-122-11 (OWNER APPROVED / AUTHORIZED 2026-10-02, Owner live):** (a) «בדיקה והפעלה»: the «כניסה לאתר ומילוי שדות» button touches the last temp-value input — add the standard field-to-action spacing (the 122.4 token). (b) «הערות»: per-line direction — Hebrew lines and lines with no letters (e.g. «123.») align right, lines starting with Latin letters align left: textarea `dir="rtl"` + `unicode-bidi: plaintext` + `text-align: start` (each line takes its direction from its first strong character; neutral lines keep RTL). If a browser does not support it, everything stays right-aligned. **Review — PASS (2026-10-02):** spacing `--admin-space-2` (16px) above the fill button; notes `dir=rtl` + `plaintext` + `start`. Chromium renders letter-less lines (e.g. «123.») LTR under `plaintext`; Owner decision 2026-10-02: keep as is (Hebrew right, Latin and number-only lines left).

**G-122-12 (OWNER APPROVED / AUTHORIZED 2026-10-03, Owner):** (a) Catalog toolbar: «אתר חדש» is a narrow tall block next to the search / filter card. Make it a proportional button: fixed width about the width of one filter select (~180px), «+» icon + «אתר חדש», same height as the card (kept from 122.7); the search / filter card takes the remaining width. Below 1024px the button goes full width above the card. (b) New site form: `RegistryAdmin.tsx` pre-selects `categories[0]` (L125), so Admins forget to choose. The category select starts empty with a placeholder option «בחרו קטגוריה» (not selectable as a value) and is required: «שמור» in «פרטי אתר» shows the inline field error «יש לבחור קטגוריה» and does not save while it is empty (create and edit, so existing rows without a category must get one when saved). No DB change; no browser dialog.
**G-122-12 review — PASS (2026-10-03).** Button 180px, same height / top as the card, card fills the rest (1440 screenshot); stacked at ≤1024; category starts empty with a disabled placeholder, required on every save with inline error + focus, no native `required` popup; payload unchanged for rows with a category. 122 verify 32 groups 74/74 (M72–M74); 13 touched verifies PASS; tsc / build clean. Accepted deviations: stacked at 1024 inclusive; new `.admin-field-error` line; «ללא קטגוריה» option removed; save from another tab jumps to «פרטי אתר».
Cosmetic notes (backlog, fold into the next UI slice): the «יש הערה» marker squeezes the card footer so «מנהל מערכת» wraps; the search placeholder is clipped at 1024.
**Test-time finding:** the full 122 verify with all mutations takes ≈54 min on every prompt (each mutation re-runs the harness). Proposal T-1: per prompt run the verify once without mutations + only the mutations added or touched by the slice; the full mutation sweep only at END OF ROUND. **T-1 OWNER APPROVED (2026-10-03).** Implemented + reviewed PASS (2026-10-03): `scripts/lib/mutationArgs.mjs`; 122 verify `--no-mutations` (3m14s) / `--mutations=IDs` (2 mutations 4m24s) vs full sweep ≈53m37s; bad input (unknown ID, both switches, empty list, `--only` + list, later-slice ID) fails before the browser starts; run time on the PASS line; default = full sweep (END OF ROUND).

**R5 — user notes per site (Digital Home).** Owner suggested deferring. Architect: defer to a separate phase. Design note: per user per service, private, encrypted client-side with the vault key like credentials (a note like «להעביר כסף ביהב» is personal data), reachable from the site tile. Not part of 122.8.

## 9. Change log
- 2026-10-01 — DRAFT created (direction approved by Owner).
- 2026-10-01 — Spec OWNER APPROVED; 122.1–122.3 AUTHORIZED as one run.
