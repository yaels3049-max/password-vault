# Migration Phase 113 — Login Access UX / Login Assistance

## Goal
Improve the **Digital Home login journey**: open the correct URL, select an Access Profile, display credentials, per-field copy with password protection, visible support levels, and optional Best Effort call to the **existing** runtime completion path.

Phase 113 is **UX / Login Assistance** — **not** an automation-engine phase. It does **not** depend on Phase 112.

## Prerequisites
- Phase 103 open / `executeServiceFromTile` (consume only; soft-wrap)
- Phase 104 / 105 Digital Home + Access Profiles
- Phase 106 Trust UX patterns (password hide/reveal, non-blocking confirmations)

## Schema / data model
**No schema migration.** No new credential field types. No profile/service table changes (AC-113-18 / D-113-8).

### Optional metadata key (presentation only)

| Key | Values | Notes |
|---|---|---|
| `loginAssistanceLevel` | `automatic_supported` \| `best_effort` \| `manual_only` | Optional override on `Service.metadata` / registry metadata. Independent of Phase 112 LI fields. |

When absent, runtime mapping:

```text
adapterId htzone|practice → automatic_supported
no openable URL → manual_only
no loginUrl (home only) → manual_only
else → best_effort
```

Built-in catalog marks **בנק לאומי** (`leumi`) with `loginAssistanceLevel: 'manual_only'` for AC-113-17 / AC-113-19.

## Typeface Assistant
- Self-hosted via `@fontsource/assistant` (Hebrew + Latin weights 400/500/600/700).
- Primary stack on `:root` / `body` in `src/index.css`; all app shells inherit.

## Shared background + rounded shells (D-113-20 / D-113-22 / AC-113-33)
- Asset: `src/assets/backgrounds/digital-home-shell.jpg` (JPEG; also mirrored under `public/backgrounds/` for local serving). Operator-provided soft wave/dot art; baked black rounded corners are soft-filled before commit.
- Production Vite build sets `publicDir: false`, so the shell BG is bundled via CSS from `src/assets` (Network should show hashed `digital-home-shell-*.jpg` 200 from `/assets/`).
- `.dashboard` and `.service-management` share `background-size: cover`, CSS `border-radius: 24px`, `overflow: hidden`.
- **D-113-22:** Do **not** stack a heavy white linear-gradient scrub (~62%) over the JPG — the asset is already light and the wash made Home look like a flat pale card. Shell uses the JPG directly (soft `#e8eef6` fallback only). Wave/dot pattern must be operator-visible; CSS `url()` alone is not acceptance.
- **Corner fill:** Source JPG had baked rounded corners with near-black pixels (JPEG has no alpha). Those corners are filled with soft blue-white so Home/Manage edges stay soft. Page `body` ambient matches `#e8eef6`.
- **Manage sections:** `.sm-section` uses translucent glass (not solid white) so the shell pattern shows through discovery/mine grids; service cards remain solid for readability.

## Vault chrome inside shell (D-113-23 / AC-113-35)
- On Digital Home and Manage/Add Sites, **no** persistent name+email identity chip (`.app-vault-account-chip` removed from `AppVaultShell`).
- «הגישה פתוחה» / «נעל» (`VaultStateBadge`) renders **inside** `.dashboard` / `.service-management` headers (`.shell-lock-row`) — not in a gray exterior bar around the BG card.
- `AppVaultShell` is a thin layout wrapper only.

## Remove-site kebab menu (D-113-24 / AC-113-36)
- «האתרים שלי» ⋮ menu uses a `createPortal` + `position: fixed` popover so shell/`overflow: hidden` cannot clip it.
- Label «הסר אתר» only (no 🗑); blue text (same family as «ניהול»), not danger-red.

## Credential Details modal (D-113-25 / AC-113-37…45)
- Target: `ServiceProfileManagementModal` from Manage Sites «ניהול».
- **UI/interaction only** — no credential schema, encryption, profile cardinality, autofill engine, notes field, or Phase 112 changes.
- Compact dialog (~580px desktop); sticky header title «פרטי כניסה»; X close (`aria-label="סגירה"`); no large bottom Close.
- Dirty close / dirty profile-switch → «השינויים עדיין לא נשמרו» / «המשך עריכה» | «יציאה ללא שמירה».
- Profile chips (multi) or static chip (single); switch isolates one profile and re-hides password.
- Compact copy + eye/eye-off; toasts never include secret values; no `alert()`.
- Primary «שמירת שינויים» disabled when clean; save uses `type="button"` (Phase 106 PM hardening).
- Delete via header ⋮ («מחיקת פרופיל» / «מחיקת פרטי כניסה») + confirm; no large red delete text.
- «+ הוספת פרופיל נוסף» collapsed by default.
- Open/fill actions were not on this screen → AC-113-44 N/A (no new open/fill UI).
- Return focus to the «ניהול» opener on close.

## Product glossary (D-113-19 / AC-113-32)
User-facing Hebrew uses **אתר / אתרים** for catalog websites (not שירות / שירותים).  
Code identifiers (`Service`, `service_id`, …) unchanged.  
Exception kept: auth «שירות החשבון…» (backend account service, not a website).

## Manage Services findability (D-113-18 / AC-113-28…31)
- Marketing subtitle removed; «לבית הדיגיטלי» at top (paired with Home manage CTA).
- «האתרים שלי»: category accordion (only categories with selected sites) + Discover-style search.
- Practice login («תרגול התחברות») excluded from user catalog / discovery surfaces.
- Multi-profile alone no longer maps to «דורש תשומת לב».

## Digital Home chrome (D-113-17 / AC-113-25…27)
- Content shell `max-width` shared with Discover/Manage: `--app-content-max: 880px`.
- Icon launcher stays phone-dense (`--dh-launcher-max: 36rem`, max 5 tiles/row) with side margins inside the wider shell.
- H1: «הבית הדיגיטלי של {fullName}» from session (fallback: «הבית הדיגיטלי»).
- PoC fill buttons and marketing subtitle removed; «ניהול אתרים» centered using Discover CTA classes.

## Hebrew-only + credentials gate (D-113-16 / AC-113-22…24)
- All user-visible Login Assistance strings are **Hebrew only** (no «Manual Only» / «Best Effort»).
- Opening with **Home URL** (no loginUrl) shows: «לא אותר דף התחברות לאתר זה, לכן יפתח דף הבית.»
- **No credentials / no usable profile** → do **not** open the floating panel; show Home notice + CTA to «ניהול האתרים».

## Floating panel UX (D-113-15)
- Half-width **glass** popover (`position: fixed`) anchored to the clicked tile — prefer **LEFT** of the cube; flip only if needed.
- Stronger glass transparency; credential fields + CTA row capped at **~70%** panel content width.
- Title shows **tile icon + service name**; eye control always uses an eye glyph (state via aria only).
- Repositions on scroll/resize; clicked tile stays highlighted.
- No visible «סיוע בהתחברות» subtitle; no visible «Best Effort» badge (level kept in `data-support-level` / logic).
- Profile chips **only when profile count > 1**.
- Copy / reveal password / close are compact equal-size **icon** buttons.

## Runtime open order (AC-113-1…3)
```text
loginUrl (trimmed) if set
  → else Home / primary `url`
  → else friendly Hebrew message — no silent blank tab
```

Opens via existing `openUrlInNewTab`. Digital Home stays open; active profile stays selected in the assistance panel (AC-113-4).

## Automatic completion (Best Effort only)
- Only when support level allows (`automatic_supported` or `best_effort`).
- Calls existing `executeServiceFromTile` with the panel’s active profile id.
- **Success/failure is not an acceptance criterion** (AC-113-13 / AC-113-19 / D-113-5).
- If attempted → exactly one visible status (AC-113-15).
- Manual Only → open + copy only; no auto attempt (AC-113-17).

## Out of scope
- Phase 112 fix / replace / revalidation
- New Login Intelligence / website detection / field detection
- Phase 116 URL canonicalization
- Federated / modal / multi-step automation engines
- Form auto-submit / Continue / Sign In clicks

## Verify
```bash
node scripts/verifyPhase113LoginAssistance.mjs
node scripts/verifyPhase106SecurityTrust.mjs
npm run build
```

Fixture mockup: `scripts/fixtures/phase113-credential-details.html`  
Evidence screenshots: `docs/evidence/phase113-credential-details-desktop.png`, `docs/evidence/phase113-credential-details-mobile.png`.

## Operator UAT spine (acceptance)
Observable UX only — **do not** require autofill PASS:

1. Open Login URL when configured  
2. Open Home URL when no Login URL  
3. Empty URL → friendly message  
4. Multi-profile highlight / switch / credential refresh  
5. Per-field copy + password hide/reveal/re-hide  
6. Support badge before open; Manual Only skips auto  
7. Auto fail/skip → copy still works  
