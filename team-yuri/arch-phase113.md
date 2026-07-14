# Architecture Phase 113

## Phase Identifier
PHASE=113

## Status
STATUS: READY_FOR_MANAGER

FINAL: 2026-07-14 — Operator-approved clarifications incorporated. Contract is **final** for Manager handoff.

AMENDED: 2026-07-14 — **No dependency on Phase 112.** Phase 113 is a **User Experience** and **Login Assistance** phase. It does **not** fix or replace Phase 112; does **not** introduce Login Intelligence, website detection, or field detection; automatic assistance uses **currently available runtime implementation only** as Best Effort; **success or failure of automatic credential completion is not an acceptance criterion**.

AMENDED: 2026-07-14 — **Login Assistance panel UX (operator screenshot).** Floating panel anchored to the clicked service tile (not a full-width top dock). Width ≈ **50%** of current panel; **semi-transparent** over the existing Home grid so the clicked tile remains visible. Remove subtitle «סיוע בהתחברות» and visible «Best Effort» badge text. Iconify Copy / Show password / Close (X). Show profile chip (e.g. «ראשי») **only when profile count > 1**. Modern floating popover aesthetic. **D-113-15**.

AMENDED: 2026-07-14 — **Panel UX polish (second operator screenshot — Hapoalim).** Credential field row width ≈ **70%** of current (cap so fields align with the width of the two bottom CTAs). **Increase** panel glass transparency. Anchor popover to the **left** of the clicked tile (not the right). Reveal-password control **always** uses an **eye** icon (never a non-eye / slashed glyph when hidden). Show the **service icon** immediately beside the service title (to the **right** of the name in RTL layout) so recognition is icon-first. **D-113-15** extended.

AMENDED: 2026-07-14 — **Hebrew-only copy + credentials gate (third screenshot — Super-Pharm).** All user-visible assistance strings must be **Hebrew only** (no «Manual Only» / «Best Effort» / English jargon in banners). Friendlier copy when login URL is missing: explain that a login page was not found and the **home page** will open. If the service has **no credentials / no usable profile**, **do not open** the floating panel; show a **modern, friendly inline/toast-style message** directing the user to enter credentials in **ניהול שירותים**. Empty panel with empty fields is forbidden. **D-113-16**.

AMENDED: 2026-07-14 — **Digital Home chrome / layout (fourth screenshot).** Align **shell content width** of Digital Home with **הוספת שירותים / ניהול** (exact same content max-width). Keep service icon grid usable width: **max 5 cubes per row** (phone-like), with left/right margin inside the wider shell (do not stretch to 6+). Remove all **test/POC fill buttons** from Home header. Remove subtitle «פתחו את השירותים…». Title becomes «הבית הדיגיטלי של {שם פרטי שם משפחה}» from users table / session. Center **ניהול שירותים** as a modern CTA matching «לבית הדיגיטלי» styling on Discover. **D-113-17**.

AMENDED: 2026-07-14 — **Manage Services UX (fifth request).** Remove subtitle «הוסיפו, פתחו ונהלו…». Move «לבית הדיגיטלי» CTA to the **top** (same chrome position family as Home’s «ניהול שירותים»). Redesign «השירותים שלי»: **category accordion** (chevron/triangle) listing only categories the user actually has services in; expand one or many; **search** matching Discover search UX. Remove catalog service **תרגול התחברות** entirely. Stop showing status «דורש תשומת לב» for multi-profile when credentials are fine (`ServiceCard` `multiple_profiles` attention). **D-113-18**.

AMENDED: 2026-07-14 — **Product glossary: שירות→אתר.** All user-visible Hebrew UI copy uses **אתר / אתרים** instead of **שירות / שירותים** (buttons, titles, empty states, toasts, banners, aria-labels that users hear). Code identifiers, DB tables, TypeScript types, and English AC text stay unchanged. Exceptions: phrases where «שירות» means a backend/platform capability (e.g. account/infra «שירות החשבון»), not a catalog website. **D-113-19**.

AMENDED: 2026-07-14 — **Shared soft background + rounded shells.** Digital Home and Manage Sites (ניהול אתרים) share the operator-provided light blue wave/halftone background. Content shells get **visible rounded corners** (CSS `border-radius`, not relying on baked image corners). Background via CSS on the shells; clip with `overflow: hidden` + radius. Asset committed under `public/` (or app static). **D-113-20**.

AMENDED: 2026-07-14 — **App typeface = Heebo.** Site-wide UI font family is **Heebo** (Hebrew + Latin). Load via Google Fonts and/or self-hosted `@fontsource/heebo` — **operator need not supply font files**. Apply on root/`body` so Home, Manage, Assist, Auth, Admin inherit unless a justified exception exists. **D-113-21**.

AMENDED: 2026-07-14 — **Background must be operator-visible (UAT fail).** Screenshot shows rounded shell + pale flat fill only — **wave/dot pattern not perceptible**. Wiring `url(...digital-home-shell.jpg)` + heavy white scrim is insufficient for AC-113-33. Pattern must be clearly visible on Digital Home and Manage Sites. Reduce/remove washing scrim; verify asset loads in runtime. **D-113-20 / D-113-22**.

AMENDED: 2026-07-14 — **Vault chrome inside shell.** Move lock / «הגישה פתוחה»+«נעל» controls **inside** the rounded content shell (Digital Home and Manage/Add Sites). Remove exterior floating chrome around the background. **Remove** the name+email user info chip/label everywhere on those screens. **D-113-23**.

AMENDED: 2026-07-14 — **Add-site discovery must stay hidden.** Operator: custom «הוסף» opens/closes a visible browser tab. UX requirement: discovery runs silently (arch-108 **D-108-32 / AC-108-26**). Phase 113 Manage flow consumes that behavior — do not “fix” via Hub `window.open`.

AMENDED: 2026-07-14 — **My-sites kebab Remove menu.** Operator screenshot: «הסר» popover is **clipped** by the container; trash icon + red text. Fix overflow/positioning so the full control is visible; label **blue** (not danger-red); **no trash icon**. Glossary: «הסר אתר» (אתרים). **D-113-24**.

AMENDED: 2026-07-14 — **Credential Details modal redesign (UI only).** Operator full specification: modern compact modal for `ServiceProfileManagementModal` / credential details. Sticky header + X close; profile chips; inline copy/eye; secondary add-profile; delete in overflow; open/fill compact; unsaved-change guards. **No** data-model / encryption / autofill-engine / Phase 112 changes. **D-113-25**; AC-113-37…45. Full normative detail in section **Credential Details Modal Redesign** below.

NOTE: **Admin Console UI modernization** is Phase **107** ownership (`arch-phase107.md` D-107-13…20) — not Phase 113. Do not implement Admin redesign under Credential Details M7.
## Phase Goal
Improve the **user journey around login** in Digital Home: open the correct URL, select an Access Profile, display stored credentials, and enable reliable **manual credential copying** — with optional **best-effort** automatic credential completion **only when an existing implementation is available at runtime**.

Phase 113 is a **User Experience** and **Login Assistance** phase. It is **not** an automation-engine phase: it must **not** expand or modify the website automation / detection engine.

### Explicit non-goals vs Phase 112

- Phase 113 does **not** depend on Phase 112.
- Phase 113 does **not** fix, reopen, revalidate, or replace Phase 112.
- Phase 113 does **not** introduce new **Login Intelligence**, **website detection**, or **field detection** capabilities.
- Phase 113 does **not** treat automatic credential completion success as a phase acceptance gate.

### Guaranteed user journey (acceptance spine)

1. Open the Login URL (or the Home URL when no Login URL is configured).
2. Select the desired profile.
3. Display the stored credentials.
4. Attempt automatic credential completion **when supported by the existing implementation** at runtime (Best Effort only).
5. If the attempt fails (or no implementation is available), **gracefully fall back** to manual credential copying without interrupting the user's workflow.

Phase 113 owns **Login Access UX, credential presentation/copy experience, support-level surfacing, and optional wiring to whatever completion already exists at runtime**. It does **not** own loginUrl discovery (108), Login Intelligence (112), URL identity/canonicalization (**Phase 116**), account/auth (109), or redesign of `executeServiceFromTile` (103).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=113`
- `team-Yuri/PLAN.md` §18 — Phase 113 (AC-113-1 … AC-113-45); Changelog through **5.32**
- Operator UI Task 2026-07-14 — Credential Details screen redesign (normative in this arch § Credential Details Modal Redesign)
- `team-Yuri/arch-phase103.md` — open target / execution (consume; soft UX wrappers only)
- `team-Yuri/arch-phase105.md` — Digital Home surfaces (credential panel host)
- `team-Yuri/arch-phase106.md` — Trust UX (password reveal/copy, non-blocking confirmations)
- PLAN: Service Identity / URL Canonicalization is **Phase 116** (not 113)
- Phase 112 artifacts exist historically but are **not** a dependency of this contract

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-113-0: Phase type = UX / Login Assistance** | Operator approval | Scope is journey, presentation, copy, open, graceful fallback. **Not** automation-engine expansion or modification. |
| **D-113-1: Guaranteed journey is open → profile → display → optional auto → manual fallback** | Operator journey; AC-113-1…14 | Acceptance proves steps 1–3 and step 5 always. Step 4 runs only if an existing completion implementation is available; its outcome is **not** an acceptance criterion. |
| **D-113-2: Zero dependency on Phase 112** | Operator; 112 REJECTED | No gating on 112 PASS. No “soft consume 112 hooks” as a product dependency. No 112 fix disguised as 113. |
| **D-113-3: No new LI / detection** | Operator; PLAN Out of scope | Forbidden: new Login Intelligence, website detection, field detection, identity-first engines, medium orchestration under 113. |
| **D-113-4: Auto = current runtime Best Effort only** | Operator; AC-113-13…15 | If a completion path already exists in the product at runtime, 113 may call it when support level allows. If unavailable, skip gracefully. Do not build a new engine. |
| **D-113-5: Auto success is not acceptance** | Operator; AC-113-19 amended | UAT must not require a successful autofill site. Require: open/copy/profile/password UX + graceful fallback when auto fails or is skipped + Manual Login Only behaviour. |
| **D-113-6: Support levels (visible before open)** | AC-113-16, 17 | `Automatic Login Supported` \| `Automatic Login (Best Effort)` \| `Manual Login Only`. Manual → open + copy only; no auto attempt. Levels are UX signals; they do not require a working autofill engine. |
| **D-113-7: Open URL order** | AC-113-1…3 | `loginUrl` if set → else Home/`primaryUrl` → else friendly message; **no** silent blank tab. New tab; Digital Home stays open; profile stays active (AC-113-4). |
| **D-113-8: Preserve data model** | AC-113-18 | No profile/service/credential schema migration. No new credential field types. |
| **D-113-9: Profile selection UX** | AC-113-6…8 | One active profile, highlighted; switch refreshes credentials; never mix; copy uses active profile; single profile may auto-select. |
| **D-113-10: Per-field copy** | AC-113-10, 11 | Dedicated Copy per field; explicit click; immediate non-blocking auto-dismiss confirmation; no `alert()`; no reload; never show password value in toast. |
| **D-113-11: Password protection** | AC-113-12; Phase 106 | Hidden by default; reveal/hide; copy while hidden; profile switch re-hides. |
| **D-113-12: Status when auto is attempted** | AC-113-15 | If an auto attempt is made, show exactly one visible status. Silent failure forbidden. If no attempt (Manual Only / no runtime impl), do not invent fake success. |
| **D-113-13: No 103 / 116 redesign** | PLAN | Soft-wrap Home UX around existing open/execute. No Phase 116 canonicalization. |
| **D-113-14: Observable UX acceptance** | Governance | Infra alone ≠ accept. Operator must observe open/copy/profile/password/support-level/fallback behaviour. |
| **D-113-15: Floating assistance panel (operator UX)** | Screenshots 2026-07-14 | Panel is a **floating overlay** on Digital Home (not a separate top strip). **Anchor** adjacent to the clicked service tile; with dozens of services and mid/bottom scroll, stay next to that tile. Default placement: open to the **left of the cube** (operator request; flip only if needed to stay in viewport). Width ≈ half of former full dock; credential inputs ≈ **70%** of current field width / max width aligned with the combined bottom CTA row («פתח אתר…» + «נסה מילוי אוטומטי»). Surface **more transparent** glass so Home shows through strongly. Title row: **service icon + service name** (icon to the **right** of the name in RTL — icon-first recognition). **Remove** «סיוע בהתחברות» and visible «Best Effort» text. Compact equal icons: Copy; password reveal **always eye** (same eye glyph whether shown or hidden — do not swap to a non-eye icon); Close = **X**. Profile chip only if **profile count > 1**. Modern glass popover. |
| **D-113-16: Hebrew-only + no empty-credential panel** | Screenshot Super-Pharm | **All** user-visible Login Assistance copy is Hebrew only (no English product jargon in banners/labels). When login URL is absent and Home will open: friendlier Hebrew explaining that a **login page was not found**, therefore the **home page** opens. When the selected service has **no stored credentials** (no profile / empty credentials): **do not open** the floating assistance panel; instead show a **innovative, friendly** non-blocking message that credentials are missing and must be entered in «ניהול השירותים». Opening an empty panel with blank fields is a UX defect. |
| **D-113-17: Digital Home chrome aligned with Discover** | Operator Home screenshot | Digital Home and Discover/Manage **share the same content shell max-width** (prefer Discover’s width as source of truth). Inside Home, the **icon grid retains phone-like density: max 5 tiles per row**, with intentional side padding (room for future chrome). Remove PoC/test fill buttons from Home. Remove marketing subtitle under the title. H1: «הבית הדיגיטלי של {fullName}» using authenticated user name from users/session (e.g. יעל שיינברג). Center «ניהול שירותים» CTA; style innovatively like Discover’s «לבית הדיגיטלי» button. |
| **D-113-18: Manage Services — findable “My services”** | Operator request | Remove marketing subtitle under «ניהול שירותים». Place «לבית הדיגיטלי» at the **top** of the screen (paired chrome with Home’s manage CTA). «השירותים שלי» must not be a long flat scroll-only list: group by **category accordion** (expand/collapse chevron; show only categories that contain at least one of the user’s selected services; allow multiple open sections). Add a **search field** matching the Discover add-grid search look/feel; filter «השירותים שלי» to matches. Remove **תרגול התחברות** from product catalog / inject paths so users no longer see or add it. Remove false «דורש תשומת לב» for multi-profile (`multiple_profiles` attention status) — multi-profile alone is not attention-needed. |
| **D-113-19: Glossary — אתר / אתרים** | Operator request | User-facing Hebrew: replace **שירות→אתר**, **שירותים→אתרים** everywhere in the app UI (Home, Manage/Discover, Login Assistance, LI messages, admin Hebrew UI, toasts). Examples: «ניהול אתרים», «הוספת אתרים», «האתרים שלי», «הסר אתר». Do not rename code/`service_*` APIs. Do not break compound words incorrectly; prefer natural Hebrew (e.g. «קטלוג האתרים»). Exception: non-catalog meanings of «שירות» (infra/account backend). After rename, apply consistent spelling across related prior UX strings (D-113-15…18 titles included). |
| **D-113-20: Home + Manage shared background & radius** | Operator background image | Apply the provided soft tech background to **Digital Home** and **Manage Sites** content shells (same visual family). Shells use CSS **border-radius** (modern, clearly rounded — match design ≈16–28px) + `overflow: hidden` so corners clip cleanly. Prefer CSS radius over painted round corners in the bitmap (avoids white gaps when `cover`/`contain` scales). Keep contrast for dark text. Do not force the same decorative treatment on Login/Admin unless already in scope. |
| **D-113-21: Typeface Heebo** | Operator request | Global UI font is **Heebo**. Set on `:root`/`body` (and vault shell) so Hebrew/Latin UI inherits. Prefer self-host (`@fontsource/heebo`) or Google Fonts with weights used in product (at least 400/500/600/700 as needed). Replace prior default stacks (system/Inter/etc.) for app chrome. No operator font upload required. |
| **D-113-22: Background pattern must be visible** | Operator UAT screenshot 2026-07-14 | AC-113-33 fails if the shell looks like a flat gray/white card with only radius. Soft wave/halftone must be **noticeable** to a normal user. A CSS reference alone is not acceptance. If a readability scrim is used, keep it light enough that blue dots/waves remain visible (current ~62% white wash is too strong for this light asset). Confirm in DevTools that the JPG requests succeed (200) from the bundled `src/assets` path. |
| **D-113-23: Lock chrome inside shell; hide identity chip** | Operator screenshot | On **Digital Home** and **Manage/Add Sites**, do not leave lock/access controls outside the decorated shell (“around” the background). Place «הגישה פתוחה» / «נעל» (or equivalent lock control) **inside** the inner rounded shell/grid area. **Remove** the user display chip showing full name + email on these screens (identity remains available via account flows elsewhere if needed — not as persistent Home/Manage chrome). Same treatment on both screens. |
| **D-113-24: Remove-site menu not clipped; calm styling** | Operator screenshot | In «האתרים שלי», the ⋮ menu action «הסר» / «הסר אתר» must be **fully visible** (fix clip from `overflow: hidden` on shell/rows — flip/align menu inward, portal, or allow overflow for the menu). Text **blue** (same family as primary Manage actions), **not** red/danger. **No trash / 🗑 icon** — text only. |
| **D-113-25: Credential Details UI redesign (presentation only)** | Operator UI Task 2026-07-14 | Redesign `ServiceProfileManagementModal` (credential details) to a modern compact credential-manager modal per the **Credential Details Modal Redesign** section. Reuse Digital Home / Heebo / shell visual language. **Forbidden:** DB/schema changes, encryption, profile cardinality rules, autofill/LI engine, new credential field types, notes field, silent data migration, unrelated screens. Preserve existing save/delete/add-profile/open/fill **logic**; change presentation and interaction only. |

### Normative execution sketch (login assist — unchanged)

```text
Select site → select profile → view credentials
  → (optional) Copy field(s) with confirmation
  → Open site
       → loginUrl ?? primaryUrl  (else friendly message — no silent tab)
       → if existing completion available AND support level allows:
            attempt (Best Effort) → one visible status
       → else / on failure: graceful fallback — copy remains
```

## Credential Details Modal Redesign (normative — D-113-25)

Primary implementation target: `src/ServiceProfileManagementModal.tsx` (+ CSS). Opened from Manage Sites «ניהול».

### Structure
1. Focused modal/drawer over current screen; sticky header; single scroll body (no nested scroll stacks).
2. Order: Header → compact service identity → profile selector → credential fields → compact `פתח כניסה` / `נסה מילוי` (if already present) → Save → secondary Add Profile → delete only via overflow/secondary (not equal to Save).
3. No large full-width Close at bottom; no second Close.

### Header
- Title: `פרטי כניסה`; service name under title when useful.
- Top-left (RTL): `X` close, min 40×40, `aria-label="סגירה"`.
- Unsaved close: dialog `השינויים עדיין לא נשמרו` → `המשך עריכה` | `יציאה ללא שמירה` (only if dirty).

### Service identity
- Existing icon + name (+ category / login-assist status only if already shown today). No new metadata.

### Profiles
- Multi: compact chips/tabs/segmented; clear selected state (primary color).
- Single: compact label/chip only — no large selector chrome.
- Switch loads that profile only; never mix credentials; re-hide password on switch.
- Dirty switch: confirm before discarding (same spirit as close guard).

### Fields
- Existing field types only (username/email/customer number/password…). No notes / new types.
- Label above; value; compact copy icon in/near field (min 36×36); password: eye + eye-off + copy (copy without reveal).
- Hebrew a11y labels e.g. `העתקת סיסמה`. Copy toasts: `הסיסמה הועתקה` etc. — never include secret values; no `alert()`.

### Save
- Primary: `שמירת שינויים`; disabled when clean; loading; dedupe; success `פרטי הכניסה נשמרו`; failure keeps values + `לא הצלחנו לשמור את השינויים. הפרטים שהזנת נשארו במסך.` Do not close before successful save completes (unless current intentional post-save close after success).

### Delete
- Remove large red “Delete Credentials” text button.
- Prefer header ⋮ → `מחיקת פרופיל` (or compact trash elsewhere secondary).
- Confirm: title `למחוק את פרטי הכניסה?`; body as specified; `ביטול` | red `מחיקה`. Existing delete semantics unchanged.

### Add profile
- Bottom secondary row: `+ הוספת פרופיל נוסף`; collapsed by default; less prominent than Save; reuses existing create flow.

### Open / auto-fill (if already on screen)
- Compact: `פתח כניסה` (primary reliable) + `נסה מילוי` (secondary); icon+text; existing implementation only; always visible result; no Phase 112 work. Suggested copy: success `פרטי הכניסה מולאו באתר`; fail `לא הצלחנו למלא את הפרטים. אפשר להעתיק אותם ידנית.`

### Security messaging
- No large mandatory “I understand” in normal flow; if needed, compact `המידע שלכם מוגן` box with short Hebrew text.

### Visual / responsive / a11y
- Match DH: radius, soft shadow, primary blue, green success, Heebo, RTL, Hebrew only (no Best Effort / English jargon).
- Desktop modal max-width ~520–620px; mobile near full height; sticky header; touch targets; focus trap; Escape closes unless confirm open; return focus to opener.
- Loading skeleton; empty `עדיין לא נשמרו פרטי כניסה לפרופיל זה`; clipboard error + URL-missing messages as in operator §17.

### Validation evidence (Developer)
Screenshots desktop+mobile; demos: 1 profile, multi-profile, copy username, copy hidden password, unsaved guard, save ok/fail, delete confirm, collapsed add-profile; confirm vault data unchanged.

## Constraints / Non-Negotiables
- AC-113-1 … AC-113-45 (PLAN as amended).
- No dependency on Phase 112 PASS or Phase 112 deliverables.
- No new Login Intelligence / website detection / field detection.
- No auto-submit; no auto-click Next/Continue/Sign In (AC-113-5).
- Credential Details redesign = UI/interaction only (D-113-25).
- Auto success/failure is **not** an acceptance criterion for the phase (D-113-5).
- Glossary אתר/אתרים (D-113-19).
- Build passes (AC-113-20).

## Technical Boundaries / Out of Scope
- Fixing or replacing Phase 112.
- New Login Intelligence, website detection, field detection, or automation-engine changes.
- Universal login detection; modal/multi-step/federated automation.
- Browser password-manager integration; credit-card fill; AI analysis.
- Phase 108 rediscovery / Zap / PayPal M16.
- Phase 116 identity/canonicalization.

## Dependencies and Interfaces
| Interface | Direction | Notes |
|---|---|---|
| Phase 103 execution | consume | Open URL; optional call to **existing** completion if present |
| Phase 105 Home UI | update | Panel, profiles, open, support badge, statuses |
| Phase 106 Trust UX | align | Password reveal, non-blocking toasts |
| Existing completion (if any) | optional runtime | Best Effort only; **not** a Phase 112 dependency |
| Credentials / profiles store | consume | No schema change |
| Clipboard API | use | Per-field copy |

Phase **112** is **not** listed as a dependency.

## Data / State Considerations
- Support level: optional metadata key or UI mapping — document in `docs/MIGRATION_PHASE_113.md` if written. Must not require Phase 112 LI fields.
- Active profile id: local UI state; drives display and copy.
- No credential plaintext in confirmations or logs.

## Security / Privacy Considerations
- Passwords hidden by default; never in confirmation text.
- Copy requires explicit user action.
- No credential leakage in user-visible diagnostics.
- Any auto path must still not submit forms.

## Testing and Lint Expectations
- Unit/UI: URL order; profile isolation; copy confirmation; password re-hide; Manual Only skips auto.
- UAT (acceptance): open Login/Home; no-URL message; multi-profile; copy; password protect; graceful fallback when auto fails/skips; Manual Login Only. **Do not require** a successful autofill demo for phase PASS.
- Optional (non-gating): if runtime auto exists, show one status on attempt.
- Regression: existing services/profiles/credentials intact.
- `npm run build` PASS; lint clean on touched files.
- Docs: `docs/MIGRATION_PHASE_113.md`.

## Functional Testability
- Observable spine: open → profile → credentials → copy works; auto absence/failure does not break the journey.
- Minimal E2E: (1) Login URL open. (2) Home URL fallback. (3) Two profiles + copy. (4) Auto unavailable or fail → copy still works. (5) Manual Login Only — no auto attempt.

## Handoff Notes for Manager
1. Sync `manager-phase113.md`; hand Credential Details redesign (**M7**) to Sarah with `arch-phase113.md` § Credential Details Modal Redesign + operator UI Task.
2. Do **not** gate 113 on Phase 112. Do **not** assign 112 / autofill-engine work under this modal task.
3. Milestone **M7 (blocking for this UX):** Redesign `ServiceProfileManagementModal` per D-113-25 / AC-113-37…45. Evidence: desktop+mobile screenshots + demos in arch Validation evidence list.
4. Out of scope for M7: schema, encryption, LI/detection, notes field, unrelated screens.
5. Acceptance = observable compact modern modal matching Digital Home; no credential data regression.

## Architect Review
ARCHITECT_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
Credential Details redesign incorporated as D-113-25 (UI-only). Ready for Manager/Developer handoff on M7.

### Required Corrections
None yet (await M7 implementation / UAT).
