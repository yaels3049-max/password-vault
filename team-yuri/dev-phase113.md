# Developer Phase 113

## Phase Identifier
PHASE=113

## Status
STATUS: COMPLETE (includes D-113-25 Credential Details M7; verify + build PASS; vault data model unchanged)

## Source References
- `team-Yuri/PHASE.md` — `PHASE=113`
- `team-Yuri/arch-phase113.md` — Credential Details Modal Redesign (D-113-25)
- `team-Yuri/manager-phase113.md`
- `team-Yuri/PLAN.md` §18 — AC-113-1 … AC-113-45; changelog through **5.32**
- `docs/MIGRATION_PHASE_113.md`

## Implementation Summary
Login Assistance + Manage chrome from prior milestones, plus **M7 Credential Details redesign (D-113-25 / AC-113-37…45)**:

1. Compact `ServiceProfileManagementModal` (~580px) with sticky header «פרטי כניסה», X close top-left (RTL physical left), no bottom Close.
2. Dirty close / dirty profile-switch confirm («השינויים עדיין לא נשמרו»).
3. Compact service identity (icon + name + category).
4. Profile chips (multi) / static chip (single); switch isolates credentials; re-hides password.
5. Copy + eye/eye-off (36×36); toasts never include secrets; no `alert()`.
6. «שמירת שינויים» disabled when clean; loading / success / fail keeps values; `type="button"` (Phase 106 PM hardening).
7. Delete via header ⋮ + confirm; no large red delete text; delete callbacks unchanged.
8. «+ הוספת פרופיל נוסף» collapsed by default.
9. Open/fill not present on this screen → AC-113-44 N/A.
10. Focus trap, Escape, return focus to «ניהול» opener.

**UI-only:** no credential schema, encryption, autofill engine, Phase 112, notes, or DB changes.

## Implemented Milestones

| Milestone | Completed | Notes |
|---|:---:|---|
| M1 Open URL rules (AC-113-1…4) | Yes | `openUrlRules.ts` |
| M2 Profile highlight/switch/refresh (AC-113-6…9) | Yes | Panel chips |
| M3 Per-field copy + password protect (AC-113-10…12) | Yes | `copyField.ts` |
| M4 Support badge + Manual-only gate (AC-113-16…17) | Yes | Logic levels; `leumi` fixture |
| M5 Optional existing completion + one status (AC-113-13…15) | Yes | Soft-wrap `executeServiceFromTile` |
| M6 Evidence + build + docs (AC-113-19…21) | Yes | Verify + migration |
| M7 Floating glass popover (D-113-15) | Yes | Left-prefer float panel |
| M7 Credential Details redesign (D-113-25) | Yes | AC-113-37…45; screenshot fixtures |
| M8 Hebrew + credentials gate (D-113-16) | Yes | AC-113-22…24 |
| M9 Home chrome (D-113-17) | Yes | Shared shell width |
| M10 Manage findability (D-113-18) | Yes | Accordion + mine search |
| M11 Glossary אתר/אתרים (D-113-19) | Yes | AC-113-32 |
| M12 Shared BG + radius (D-113-20) | Yes | JPEG shell BG |
| M13 Typeface Assistant | Yes | `@fontsource/assistant` |
| M14 BG pattern visibility (D-113-22) | Yes | Wash removed |
| M15 Soft corners + Manage glass grids | Yes | Translucent `.sm-section` |
| M16 Lock inside shell (D-113-23) | Yes | AC-113-35 |
| M17 Remove-site menu (D-113-24) | Yes | AC-113-36 |

## Files Changed (M7 Credential Details)

| File | Change Summary | Reason |
|---|---|---|
| `src/ServiceProfileManagementModal.tsx` | Compact credential-details UI per D-113-25 | AC-113-37…45 |
| `src/App.css` | `.cd-*` styles (~580px, sticky header, chips, fields) | Visual contract |
| `src/trust/HubCredentialInput.tsx` | Optional `revealAsText` | Eye reveal without dropping hardening |
| `src/loginAssistance/icons.tsx` | `IconEyeOff` for Details toggle | AC-113-40 |
| `src/ManageServices.tsx` | Return focus to «ניהול» opener | A11y |
| `scripts/verifyPhase113LoginAssistance.mjs` | Static asserts AC-113-37…45 | Soft gate |
| `scripts/verifyPhase106SecurityTrust.mjs` | Allow `cd-save` type=button save | Keep PM hardening |
| `scripts/fixtures/phase113-credential-details.html` | Desktop/mobile mockup | Visual evidence |
| `docs/evidence/phase113-credential-details-*.png` | Screenshots | Validation evidence |
| `docs/MIGRATION_PHASE_113.md` | D-113-25 contract | Operator docs |
| `team-Yuri/dev-phase113.md` | This evidence | Developer artifact |

## Dependencies Installed

| Dependency / Tool | Command Used | Reason |
|---|---|---|
| None | — | Existing stack only |

## Unit Tests

| Field | Value |
|---|---|
| Command | `node scripts/verifyPhase113LoginAssistance.mjs` |
| Result | PASS |
| Notes | Includes AC-113-37…45 static wiring; no autofill success asserts; vault schema untouched |

## Lint

| Field | Value |
|---|---|
| Command | `npm run build` (`tsc -b` + vite) |
| Result | PASS |
| Notes | No separate eslint script; TypeScript build is the gate |

## Functional Testability Evidence

| Field | Value |
|---|---|
| Method | CLI verify + production build + Edge headless fixture screenshots |
| Steps | 1) Verify script. 2) `npm run build`. 3) Open Manage → «ניהול»: compact modal, dirty guard, chips, copy/eye, disabled clean save, ⋮ delete, collapsed add-profile. 4) Confirm vault credentials unchanged by UI-only diff. |
| Expected Result | AC-113-37…45 satisfied; build green; desktop+mobile screenshots |
| Actual Result | PASS (CLI + build). Fixtures: `docs/evidence/phase113-credential-details-desktop.png`, `…-mobile.png` |
| Notes | Live UAT recommended for dirty-save/fail paths and multi-profile isolation |

### Acceptance mapping (observable)

| AC | Evidence |
|---|---|
| AC-113-1…36 | Prior milestones + verify script |
| AC-113-37 | Sticky header «פרטי כניסה»; `aria-label="סגירה"`; no bottom Close; screenshots |
| AC-113-38 | Dirty confirm copy + `requestSwitchProfile` / `requestClose` |
| AC-113-39 | `cd-chip` + `setPasswordVisible(false)` on load |
| AC-113-40 | Copy / `IconEyeOff`; `הסיסמה הועתקה`; no `alert(` |
| AC-113-41 | Save disabled when `!dirty`; fail message keeps values |
| AC-113-42 | ⋮ «מחיקת פרופיל»; confirm dialog; no large red delete text |
| AC-113-43 | `showAddProfile` default false; secondary toggle |
| AC-113-44 | N/A — open/fill never on this screen |
| AC-113-45 | UI-only; dialog a11y; return focus; CSS max-width 580px |

## Documentation Update Evidence

| Field | Value |
|---|---|
| Documentation Updated | YES |
| Files Updated | `docs/MIGRATION_PHASE_113.md`, `team-Yuri/dev-phase113.md` |
| Reason if Not Required | — |

## Known Issues / Limitations
- Arch wording mentions Heebo; live app typeface remains **Assistant** (Phase 113 M13).
- Operator live UAT of dirty-save / delete / multi-profile still recommended.
- Phase 106 verify script still references removed `UnlockScreen.tsx` (pre-existing; unrelated to M7).

## Scope Compliance
- **In scope:** Credential Details presentation/interaction only (D-113-25).
- **Out of scope (honored):** data model, encryption, profile cardinality, autofill engine, Phase 112, notes field, new field types, DB tables.

## Developer Declaration
Detected phase: 113  
Selected state: IMPLEMENT  
Status: COMPLETE  

Sarah (Team Yuri Developer) — M7 Credential Details redesign shipped UI-only; vault data unchanged; autofill success not required.
