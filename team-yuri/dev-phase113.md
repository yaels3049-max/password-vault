# Developer Phase 113

## Phase Identifier
PHASE=113

## Status
STATUS: COMPLETE (includes M11 remove-site durability / D-113-29; verify PASS)

## Source References
- `team-Yuri/PHASE.md` — `PHASE=113`
- `team-Yuri/arch-phase113.md` — D-113-20 / D-113-22 / D-113-26 (wave-v2 + Login)
- `team-Yuri/manager-phase113.md` — M8 Background wave-v2 + Login
- `team-Yuri/PLAN.md` — AC-113-33 / AC-113-46
- `docs/MIGRATION_PHASE_113.md`

## Implementation Summary
Login Assistance + Manage chrome + Credential Details from prior milestones, plus **M8 Background wave-v2 + Login (D-113-26 / AC-113-33 / AC-113-46)**:

1. Copied operator asset `team-Yuri/assets/digital-home-shell-wave-v2.png` into `src/assets/backgrounds/` and `public/backgrounds/`.
2. `--app-shell-bg-image` points at wave-v2 PNG; prior JPG retired as product BG.
3. Applied on Digital Home (`.dashboard`), Manage/Add Sites (`.service-management`), Login/Auth (`.unlock.auth-entry`).
4. No heavy white wash (D-113-22) — pattern perceptible on Home + Login evidence shots.
5. Admin console chrome **not** restyled (Phase 107); admin **login gate** only may share the shell asset for Auth entry.

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
| M8 Hebrew + credentials gate (D-113-16) | Yes | AC-113-22…24 (earlier numbering) |
| **M8 Background wave-v2 + Login (manager)** | **Yes** | D-113-26; AC-113-33 / AC-113-46 |
| M9 Home chrome (D-113-17) | Yes | Shared shell width |
| M10 Manage findability (D-113-18) | Yes | Accordion + mine search |
| M11 Glossary אתר/אתרים (D-113-19) | Yes | AC-113-32 |
| M12 Shared BG + radius (D-113-20) | Yes | Superseded asset by M8 wave-v2 |
| M13 Typeface Assistant | Yes | `@fontsource/assistant` |
| M14 BG pattern visibility (D-113-22) | Yes | Wash removed; wave-v2 still no wash |
| M15 Soft corners + Manage glass grids | Yes | Translucent `.sm-section` |
| M16 Lock inside shell (D-113-23) | Yes | AC-113-35 |
| M17 Remove-site menu (D-113-24) | Yes | AC-113-36 |
| **M9 Shell −10% (D-113-27)** | **Yes** | `--app-content-max: 792px`; AC-113-47 |
| **M10 Credential Details freeze + header (D-113-28)** | **Yes** | AC-113-48…50; no ⋮; X\|lock left cluster |
| **M11 Remove-site durability (D-113-29)** | **Yes** | AC-113-51; cloud delete before success; sync selectedIds-only |

## M11 — Remove-site durability (blocking)

| Field | Value |
|---|---|
| Decisions | D-113-29 |
| ACs | AC-113-51 (also AC-104-14…16, AC-109-39) |
| Root causes | (1) `removeUserServiceFromCloud` silent-returned without client/auth; App swallowed errors then painted success. (2) `syncVaultStateToSupabase` re-upserted `user_services` from leftover local `accessProfiles` after remove → hydrate resurrected tiles. |
| Fix | Throw when cloud remove unavailable; cloud delete before local success; Hebrew error + keep selection on failure; sync membership = `selectedIds` only |
| Files | `src/App.tsx`, `src/supabase/persistence.ts`, `src/serviceManagement/serviceSelection.ts`, verify + migration |
| Evidence | Operator UAT: remove → Home empty of site → re-login → still gone; `user_services` row absent |
| Verify | `node scripts/verifyPhase113LoginAssistance.mjs` → PASS; `node scripts/verifyPhase109Accounts.mjs` → PASS |

## M10 — Credential Details freeze + header chrome (blocking)

| Field | Value |
|---|---|
| Decisions | D-113-28 |
| ACs | AC-113-48 (no freeze), AC-113-49 (remove ⋮), AC-113-50 (X + lock left), AC-113-42 delete secondary |
| Root cause | (1) `loadProfile` depended on `credentials` identity. (2) **Critical:** `useServiceLogos([service])` + effect deps `[serviceIds, services]` → new array every render → infinite `setLogos` (cached logos resolve sync) → Hub freeze on focus/use |
| Fix | Profile-isolated load + dirtyRef; `useServiceLogos` keyed only by `serviceIds` + bail if logo unchanged; memoize `[service]` in modal; drop competing `autoFocus` |
| Files | `src/ServiceProfileManagementModal.tsx`, `src/App.css`, fixture + verify |
| Evidence | `docs/evidence/phase113-credential-details-header-m10.png`; interactive: open → type → save/close responsive |
| Verify | `node scripts/verifyPhase113LoginAssistance.mjs` → PASS; `npx tsc -b` → PASS |

## M9 — Shared shell −10% (phone silhouette)

| Field | Value |
|---|---|
| Token | `--app-content-max: 792px` (was 880px; ≈10% reduction) |
| Surfaces | `.dashboard` + `.service-management` only (same var) |
| Tiles | Max 5/row unchanged (`--dh-launcher-max`) |
| Admin | Unchanged |
| Evidence | `docs/evidence/phase113-shell-narrow.png` |
| Verify | `node scripts/verifyPhase113LoginAssistance.mjs` asserts 792px |

## M8 — Backgrounds (portrait Home vs landscape Login/Admin)

Operator correction: wave-v2 is **not** for Digital Home/Add Sites; those use the **portrait** asset. wave-v2 is for Login + Control Center.

### Acceptance mapping

| AC / Decision | Evidence |
|---|---|
| D-113-20 / AC-113-33 | Portrait `--app-shell-bg-image` on Home/Manage |
| D-113-22 | No ~62% white wash; pattern visible |
| AC-113-46 | Login uses landscape `--app-wide-bg-image` (wave-v2) |
| Control Center | Phase 107: wave-v2 on `.admin-app` + `.admin-gate` |

### Paths

| Path | Role |
|---|---|
| `digital-home-shell-portrait.png` | Home + Manage/Add Sites (485×1024); black baked phone-mask corners filled to `#e8eef6` so shell radius is clean |
| `digital-home-shell-wave-v2.png` | Login + מרכז הבקרה (1024×576) |
| `src/App.css` | `--app-shell-bg-image` / `--app-wide-bg-image` |
| `src/admin/admin.css` | `--admin-wide-bg-image` on all admin surfaces |
| `docs/evidence/phase113-wave-v2-home.png` | Portrait Home |
| `docs/evidence/phase113-wave-v2-login.png` | Landscape Login |

### Files Changed (M8)

| File | Change Summary | Reason |
|---|---|---|
| `src/assets/backgrounds/digital-home-shell-portrait.png` | Portrait asset | Home/Manage |
| `src/assets/backgrounds/digital-home-shell-wave-v2.png` | Landscape asset | Login + Admin |
| `src/App.css` | Split `--app-shell-bg-image` / `--app-wide-bg-image` | Surface split |
| `src/admin/admin.css` | wave-v2 on `.admin-app` + `.admin-gate` | Control Center |
| `scripts/verifyPhase113LoginAssistance.mjs` | Assert portrait vs wave-v2 wiring | Soft gate |
| `docs/evidence/phase113-wave-v2-*.png` | Home portrait + Login wide | Visual proof |
| `docs/MIGRATION_PHASE_113.md` | Two-asset note | Operator docs |

### Build / verify (M8)

| Field | Value |
|---|---|
| Command | `node scripts/verifyPhase113LoginAssistance.mjs` |
| Result | PASS |
| Command | `npm run build` |
| Result | PASS |
| Bundled | `digital-home-shell-portrait-*.png` + `digital-home-shell-wave-v2-*.png` |

## Files Changed (M10 Credential Details freeze + header)

| File | Change Summary | Reason |
|---|---|---|
| `src/ServiceProfileManagementModal.tsx` | Profile-isolated load + dirtyRef sync; remove ⋮; delete secondary; left X\|lock cluster; memoized logo list | AC-113-48…50 |
| `src/useServiceLogos.ts` | Effect keyed by `serviceIds` only; skip redundant setState | **AC-113-48 freeze** (inline `[service]` loop) |
| `src/App.css` | `.cd-header` grid + `.cd-header-start` / `.cd-secondary-*`; drop overflow CSS | Header chrome |
| `scripts/verifyPhase113LoginAssistance.mjs` | Asserts for freeze pattern + no ⋮ + cluster CSS | Soft gate |
| `scripts/fixtures/phase113-credential-details.html` | M10 header mock (ביטוח לאומי) | Screenshot source |
| `docs/evidence/phase113-credential-details-header-m10.png` | Header evidence | UAT / AC-113-50 |
| `docs/MIGRATION_PHASE_113.md` | D-113-28 contract | Operator docs |
| `team-Yuri/dev-phase113.md` | M10 evidence | Developer record |

## Files Changed (M7 Credential Details)

| File | Change Summary | Reason |
|---|---|---|
| `src/ServiceProfileManagementModal.tsx` | Compact credential-details UI per D-113-25 | AC-113-37…45 |
| `src/App.css` | `.cd-*` styles (~580px, sticky header, chips, fields) | Visual contract |
| `src/trust/HubCredentialInput.tsx` | Optional `revealAsText` | Eye reveal without hardening drop |
| `src/loginAssistance/icons.tsx` | `IconEyeOff` for Details toggle | AC-113-40 |
| `src/ManageServices.tsx` | Return focus to «ניהול» opener | A11y |
| `scripts/verifyPhase113LoginAssistance.mjs` | Static asserts AC-113-37…45 | Soft gate |
| `scripts/verifyPhase106SecurityTrust.mjs` | Allow `cd-save` type=button save | Keep PM hardening |
| `scripts/fixtures/phase113-credential-details.html` | Desktop/mobile mockup | Visual evidence |
| `docs/evidence/phase113-credential-details-*.png` | Screenshots | Validation evidence |
| `docs/MIGRATION_PHASE_113.md` | D-113-25 contract | Operator docs |

## Dependencies Installed

| Dependency / Tool | Command Used | Reason |
|---|---|---|
| None | — | Existing stack only |

## Unit Tests

| Field | Value |
|---|---|
| Command | `node scripts/verifyPhase113LoginAssistance.mjs` |
| Result | PASS |
| Notes | Includes wave-v2 + Auth shell asserts; Credential Details asserts; no autofill success gate |

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
| Steps | 1) Verify script. 2) `npm run build` (confirm hashed wave-v2 PNG). 3) Open Home / Manage / Login — waves perceptible, no flat wash. 4) Confirm Admin console chrome unchanged. |
| Expected Result | AC-113-33 / AC-113-46; D-113-22 pattern visible; build green |
| Actual Result | PASS. Evidence: `docs/evidence/phase113-wave-v2-home.png`, `…-login.png` |
| Notes | Live UAT recommended on Device/browser for production URL load of hashed PNG |

### Acceptance mapping (Credential Details — prior)

| AC | Evidence |
|---|---|
| AC-113-1…36 | Prior milestones + verify script |
| AC-113-37…45 | M7 Credential Details (delete path updated by M10) |
| AC-113-33 / AC-113-46 | M8 wave-v2 + Login |
| AC-113-47 | M9 shell −10% |
| AC-113-48…50 | M10 freeze + header chrome + no ⋮ |
| AC-113-51 | M11 remove-site survives re-login |

## Documentation Update Evidence

| Field | Value |
|---|---|
| Documentation Updated | YES |
| Files Updated | `docs/MIGRATION_PHASE_113.md`, `team-Yuri/dev-phase113.md` |
| Reason if Not Required | — |

## Known Issues / Limitations
- Arch wording mentions Heebo; live app typeface remains **Assistant** (Phase 113 M13).
- Prior `digital-home-shell.jpg` may remain on disk unused by product CSS.
- Admin login gate uses wave-v2 for Auth continuity only — AdminApp interiors stay Phase 107.

## Scope Compliance
- **In scope (M11):** Durable «הסר אתר» across re-entry (D-113-29); cloud delete + hydrate/sync fix; UI-only errors.
- **Out of scope (honored):** registry deletes; weakening anti-wipe for empty-cloud; schema/encryption changes.

## Developer Declaration
Detected phase: 113  
Selected state: IMPLEMENT  
Status: COMPLETE  

Sarah (Team Yuri Developer) — M11 blocking: remove persists after re-login; no phantom success.
