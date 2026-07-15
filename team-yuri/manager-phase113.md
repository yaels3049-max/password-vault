# Manager Phase 113

## Phase Identifier
PHASE=113

## Status
STATUS: READY_FOR_DEVELOPER — **M8 Background wave-v2 + Login**

## Contract note
Architecture contract is **FINAL** (operator-approved clarifications). Manager must **not** redefine architecture. Follow `arch-phase113.md` and PLAN ACs strictly.

**Active milestone for this handoff:** **M8** — Background asset v2 + Login (D-113-20, D-113-22, D-113-26 / AC-113-33, AC-113-46).  
Do **not** fold Admin console (Phase 107) into this task.

## Phase Goal
Improve the **user journey around login** in Digital Home: open the correct URL, select an Access Profile, display stored credentials, and enable reliable **manual credential copying** — with optional **Best Effort** automatic credential completion **only when an existing runtime implementation is available**.

**Phase type:** UX / Login Assistance — **NOT** automation-engine work.

### Guaranteed journey (acceptance spine)

1. Open Login URL (else Home/`primaryUrl`; else friendly message — no silent blank tab)
2. Select desired profile (highlighted; drives credentials)
3. Display stored credentials for that profile
4. Optional: call **currently available** automatic completion if support level allows (Best Effort; outcome **not** acceptance)
5. Graceful manual copy fallback if auto fails/skips — workflow uninterrupted

## Source References
- `team-Yuri/PHASE.md` — `PHASE=113` (**confirmed**)
- `team-Yuri/arch-phase113.md` — **FINAL**; D-113-20 / D-113-22 / D-113-26 (M8); Handoff Notes item 6
- `team-Yuri/PLAN.md` §18 — Phase 113; **AC-113-33**, **AC-113-46**; changelog **5.34**
- Operator asset: `team-Yuri/assets/digital-home-shell-wave-v2.png`
- `team-Yuri/arch-phase103.md` — open/execute (soft UX wrappers only)
- `team-Yuri/arch-phase105.md` — Digital Home surfaces
- `team-Yuri/arch-phase106.md` — password reveal/copy Trust UX
- URL identity/canonicalization is **Phase 116** — not 113

## Critical bindings (non-negotiable)

| Binding | Rule |
|---|---|
| **No Phase 112 dependency** | Do not fix/replace/revalidate/gate on 112. AC-113-21 / D-113-2 |
| **No new LI / detection** | No Login Intelligence, website detection, field detection. D-113-3 |
| **Auto = existing runtime only** | Call currently available completion Best Effort; do not build a new engine. D-113-4 |
| **Auto success NOT acceptance** | AC-113-13, AC-113-19 amended / D-113-5 |
| **Manual UX first** | Prefer M1–M4 before optional M5 wire |
| **No schema migration** | AC-113-18 / D-113-8 |
| **No Phase 116 under 113** | Canonicalization out of scope |
| **Observable UX accept** | Open/profile/copy/password/support-level/fallback — **not** autofill PASS demos. D-113-14 |

## Architecture Summary (D-113-0 … D-113-14)

| Decision | Manager binding |
|---|---|
| **D-113-0** | Phase type = UX / Login Assistance |
| **D-113-1** | Guaranteed journey; prove steps 1–3 + 5 always; step 4 optional non-gating |
| **D-113-2** | Zero dependency on Phase 112 |
| **D-113-3** | No new LI / website / field detection |
| **D-113-4** | Auto = current runtime Best Effort only |
| **D-113-5** | Auto success/failure is **not** an acceptance criterion |
| **D-113-6** | Support levels visible before open: Automatic Login Supported \| Best Effort \| Manual Login Only |
| **D-113-7** | Open order: `loginUrl` → Home/`primaryUrl` → friendly message; new tab; Home stays open |
| **D-113-8** | Preserve data model — no profile/credential schema migration |
| **D-113-9** | One active profile, highlight, switch refreshes credentials, never mix |
| **D-113-10** | Per-field Copy; non-blocking confirmation; no `alert()`; no password in toast |
| **D-113-11** | Password hidden by default; reveal/hide; copy while hidden; switch re-hides |
| **D-113-12** | If auto attempted → exactly one visible status; silent failure forbidden |
| **D-113-13** | Soft-wrap around existing open/execute; no 103 redesign; no 116 |
| **D-113-14** | Infra alone ≠ accept; observable UX required |
| **D-113-20** | Shared soft background + CSS rounded shells on landscape Digital Home / Manage shells (amended: asset = wave-v2; Login in scope via D-113-26) |
| **D-113-22** | Wave/dot pattern must be **perceptible** — no heavy white wash / flat washed card |
| **D-113-26** | Ship `team-Yuri/assets/digital-home-shell-wave-v2.png` as sole DH-family shell BG; apply Home + Manage/Add Sites + **Login/Auth**; retire prior JPG as product BG; Admin **not** required in 113 |

## Acceptance Criteria (AC-113-1 … AC-113-21)

| AC | Statement |
|---|---|
| AC-113-1 | When Login URL configured, open it in a new tab |
| AC-113-2 | When no Login URL, open Home URL in a new tab |
| AC-113-3 | When neither URL, friendly message; no silent unexplained tab |
| AC-113-4 | Digital Home remains open; selected profile remains active |
| AC-113-5 | Never auto-submit; never auto-click Next/Continue/Sign In |
| AC-113-6 | Multiple Access Profiles; exactly one active, visually highlighted |
| AC-113-7 | Switching profiles immediately refreshes credentials; never mix profiles |
| AC-113-8 | Copy always uses selected profile; single profile may auto-select |
| AC-113-9 | Credential panel shows existing supported fields; no new credential types |
| AC-113-10 | Dedicated Copy per field; explicit user click |
| AC-113-11 | Copy confirmation immediate, non-blocking, auto-dismiss; no alert; no reload; never reveal password in toast |
| AC-113-12 | Passwords hidden by default; reveal/hide; copy while hidden; switch re-hides |
| AC-113-13 | May invoke **existing** runtime auto as Best Effort when support allows; **success not required** for acceptance |
| AC-113-14 | When auto unavailable/fails, profile + panel remain for manual copy; never blocks manual login |
| AC-113-15 | Every auto attempt that is made → exactly one visible status; silent failure forbidden |
| AC-113-16 | Visible support level before open (Supported / Best Effort / Manual Only) |
| AC-113-17 | Manual Login Only → open + profile/copy; **no** auto attempt |
| AC-113-18 | Existing names/icons/categories/profiles/storage/create-edit unchanged; **no data-model migration** |
| AC-113-19 | Validation evidence: open Login/Home; multi-profile; copy; password protect; graceful fallback; ≥1 Manual Only service; **successful auto is not acceptance** |
| AC-113-20 | Build passes |
| AC-113-21 | No Phase 112 dependency; does not fix/replace 112; no new LI / website / field detection |

### M8 background ACs (amendments — changelog 5.34)

| AC | Statement |
|---|---|
| AC-113-33 | Digital Home and Manage Sites share the approved soft background + rounded shells; wave/dot pattern must be visually perceptible (not a flat washed card). **Approved asset:** wave-v2 (`team-Yuri/assets/digital-home-shell-wave-v2.png` shipped into app static) |
| AC-113-46 | Login / Auth entry uses the same wave-v2 shell background; pattern remains perceptible (no heavy wash) |

## Hard Gates

### H1 — Guaranteed journey UAT (AC-113-1…4, 6…12, 14, 19)
Observable open/profile/display/copy/password/fallback — **without** requiring autofill PASS.

### H2 — No Phase 112 work (AC-113-21)
No 112 fixes, LI, detection, or gate on 112 PASS.

### H3 — Manual Login Only + support levels (AC-113-16, 17)
Badge visible; Manual Only skips auto.

### H4 — Auto Best Effort only; success non-gating (AC-113-13…15, D-113-5)
If auto attempted → one status; never silent. Outcome does not gate PASS.

### H5 — No schema / no 116 / no auto-submit (AC-113-5, 18)
### H6 — Build + docs (AC-113-20)
`docs/MIGRATION_PHASE_113.md` + `npm run build` PASS.

**Reject COMPLETE that hinges on autofill demos or Phase 112 deliverables.**

## Ordered Milestones (prefer Manual UX first)

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| **M1** | Open URL rules | `loginUrl` → Home → friendly message; new tab; Home stays open | UAT open paths | AC-113-1…4 |
| **M2** | Profile UX | Highlight, switch, credential refresh, no mix | Multi-profile UAT | AC-113-6…9 |
| **M3** | Copy + password | Per-field copy, confirmations, reveal/hide | Copy/password UAT | AC-113-10…12 |
| **M4** | Support level badge | Supported / Best Effort / Manual Only; Manual skips auto | Badge + Manual Only UAT | AC-113-16, 17 |
| **M5** | Optional existing auto wire | Call **current** runtime completion if available; one status if attempted; never block on outcome | Optional; non-gating | AC-113-13…15 |
| **M6** | Evidence + build + docs | Guaranteed journey evidence; **no autofill-success requirement**; migration doc | PASS | AC-113-19…21 |
| **M8** | **Background wave-v2 + Login** | Ship wave-v2 PNG; apply Home + Manage/Add Sites + Login/Auth; perceptible pattern; retire JPG as product BG | Screenshots Home + Login with new waves | AC-113-33, AC-113-46 |

**Ship order:** M1→M4 before M5. **Active handoff:** M8 (background). Do not fold Admin console into M8.

## AC → Milestone Mapping

| AC | Milestone(s) | Manual UAT |
|---|---|---|
| AC-113-1…4 | M1 | Login URL / Home URL / no-URL message; Home remains open |
| AC-113-5 | M1, M5 | Never submit/Continue click |
| AC-113-6…9 | M2 | Two profiles; highlight; switch; copy uses active |
| AC-113-10…12 | M3 | Per-field copy; toast; password protect |
| AC-113-13…15 | M5 | Optional auto attempt + one status; success not required |
| AC-113-14 | M3, M5 | Fallback to copy always works |
| AC-113-16…17 | M4 | Support badge; Manual Only no auto |
| AC-113-18 | M6 | Affirm no schema change |
| AC-113-19 | M6 | Journey evidence package (not autofill PASS) |
| AC-113-20 | M6 | Build PASS |
| AC-113-21 | All | Affirm no 112 dependency / no new detection |
| AC-113-33 | M8 | Home + Manage share wave-v2; pattern perceptible; rounded shells |
| AC-113-46 | M8 | Login/Auth uses same wave-v2; pattern perceptible |

## Detailed Development Plan

### M1 — Open URL rules
- Open `loginUrl` if set, else Home/`primaryUrl`, else friendly Hebrew message (no silent blank tab).
- New browser tab; Digital Home remains open; profile stays active.
- Soft-wrap existing open/execute — no 103 redesign.

### M2 — Profile selection UX
- Exactly one active profile, visually highlighted.
- Switch immediately refreshes displayed credentials; never show mixed profiles.
- Single profile may auto-select.
- Copy always bound to active profile.

### M3 — Per-field copy + password protection
- Dedicated Copy control per credential field; explicit click.
- Immediate non-blocking auto-dismiss confirmation; no `alert()`; no page reload; never show password value in toast.
- Password hidden by default; reveal/hide; copy while hidden; profile switch re-hides.

### M4 — Support level badge
- Before open, show: Automatic Login Supported | Automatic Login (Best Effort) | Manual Login Only.
- Manual Login Only → open + profile/copy only; **never** attempt auto.
- Levels are UX signals — must not require a working autofill engine or Phase 112 LI.

### M5 — Optional wire to **existing** completion (non-gating)
- If a completion implementation already exists at runtime **and** support level allows: invoke Best Effort.
- If attempted → exactly one visible status (AC-113-15).
- If unavailable/fails → graceful fallback; panel remains (AC-113-14).
- **Do not** build new detection/LI/medium engines.
- **Do not** require auto success for PASS.

### M6 — Evidence + build + docs
**Acceptance evidence must show:**
- Open Login URL / Home URL / no-URL message
- Multi-profile select + credential refresh
- Per-field copy + password protect
- Support level badge + ≥1 Manual Login Only service
- Graceful fallback when auto unavailable or fails
- **Not required:** successful autofill demo

Also: `docs/MIGRATION_PHASE_113.md`; `npm run build` PASS; affirm AC-113-18 / AC-113-21.

### M8 — Background asset wave-v2 + Login (D-113-20, D-113-22, D-113-26)

**Source asset (committed):** `team-Yuri/assets/digital-home-shell-wave-v2.png`

**Tasks:**
1. **Copy** wave-v2 into app static — `src/assets/backgrounds/` (Vite bundles this when `publicDir: false`) and/or `public/backgrounds/` for local serving. Replace prior `digital-home-shell.jpg` as the **product** background (retire JPG from CSS/`--app-shell-bg-image` usage).
2. **Apply** on:
   - Digital Home (landscape shell)
   - Manage Sites / Add Sites (wide landscape shells)
   - **Login / Auth entry** (`AuthEntryScreen` / vault entry)
3. **Keep pattern perceptible** (D-113-22): soft blue waves / fine lines / dot clusters must be noticeable to a normal user. Reduce/remove heavy white scrim/wash. Flat gray/white card with only radius = **FAIL**.
4. Treatment: `background-size: cover`, centered; CSS `border-radius` on shells + `overflow: hidden` (D-113-20). Keep text contrast.
5. Confirm asset loads at runtime (DevTools Network 200 for bundled PNG).
6. **Do not** apply to Admin console in this milestone (Phase 107 owns Admin UX).

**Evidence required:**
- Screenshot: Digital Home showing new wave pattern
- Screenshot: Login / Auth entry showing same wave pattern
- Optionally Manage/Add Sites if easy; Home + Login are mandatory
- Note in `dev-phase113.md` (M8): file paths changed; wash/scrim approach; affirm Admin not touched
- `npm run build` PASS if CSS/assets touched
- Update `docs/MIGRATION_PHASE_113.md` background asset note to wave-v2 + Login scope

## Functional Test Matrix

| # | Test | Expected | AC |
|---:|---|---|---|
| T1 | Service with loginUrl | Opens Login URL new tab; Home stays open | AC-113-1, 4 |
| T2 | Service with Home only | Opens Home URL | AC-113-2 |
| T3 | No URLs | Friendly message; no unexplained silent tab | AC-113-3 |
| T4 | Two profiles | Highlight; switch refreshes; no mix | AC-113-6, 7 |
| T5 | Copy username/password | Per-field copy; toast; password not in toast | AC-113-10, 11 |
| T6 | Password reveal | Hidden default; re-hide on profile switch | AC-113-12 |
| T7 | Support badge | Visible before open | AC-113-16 |
| T8 | Manual Login Only | Open + copy; **no** auto attempt | AC-113-17 |
| T9 | Auto unavailable/fail | Panel remains; copy works | AC-113-14, 19 |
| T10 | Auto attempted (if available) | One visible status; no silent fail | AC-113-15 |
| T11 | No autofill success needed | Phase can PASS without autofill demo | AC-113-13, 19 |
| T12 | No 112 / no new detection | Affirmation | AC-113-21 |
| T13 | No schema change | Affirmation | AC-113-18 |
| T14 | Build | PASS | AC-113-20 |
| T15 | Wave-v2 on Digital Home | Open Home; operator sees soft blue waves/dots | Pattern perceptible; not flat wash | AC-113-33 |
| T16 | Wave-v2 on Manage/Add Sites | Open wide Manage/Add shell | Same approved asset; pattern perceptible | AC-113-33 |
| T17 | Wave-v2 on Login | Open Auth entry / Login | Same wave-v2; pattern perceptible | AC-113-46 |
| T18 | Asset load | DevTools Network | Bundled wave-v2 PNG 200; old JPG not the product BG | D-113-26 |
| T19 | Admin not in M8 | Admin console | No requirement to adopt wave-v2 under 113 M8 | D-113-26 |

**Critical:** T1–T9, T11–T14 (journey). **M8 critical:** T15, T17 (Home + Login evidence). T10 optional/non-gating.

## Required Developer Evidence
`team-Yuri/dev-phase113.md` must include:

| Evidence area | Required content |
|---|---|
| Implementation summary | Journey UX; support levels; optional existing-auto wire |
| Files changed | List |
| M1–M4 UAT | Open/profile/copy/password/badge/Manual Only observations |
| M5 | How existing auto is called (or skipped); status if attempted; affirm success not required |
| M6 | `MIGRATION_PHASE_113.md`; build PASS |
| **M8** | wave-v2 copied to app static; CSS/path updated; Home + Manage/Add + Login applied; screenshots Home + Login; no heavy wash; Admin not folded in |
| Acceptance | Guaranteed journey + graceful fallback evidenced |
| Affirmations | No Phase 112 work; no new LI/detection; no schema migration; no 116; no autofill-PASS gate |
| Scope | No federated/modal/multi-step automation engines; **no Admin console restyle under M8** |

## Out of Scope
- Phase **112** fixes, revalidation, LI, detection, medium orchestration
- Phase **116** URL identity / canonicalization
- New Login Intelligence / website detection / field detection
- New automation engine / identity-first engine under 113
- Federated / modal / multi-step automation
- Schema migration / new credential field types
- Auto-submit / auto-click Next/Continue/Sign In
- Phase 108 rediscovery / Zap / PayPal M16
- Treating autofill PASS as phase acceptance
- **Admin console** background / restyle (Phase 107 M9 — do not fold into M8)

## Risks / Open Questions
- Accidentally coupling support levels to Phase 112 LI fields — use independent UX mapping/metadata only.
- Expanding M5 into engine work — reject; Best Effort call only.
- UAT blocked waiting for autofill success — wrong bar; Manual journey is enough.
- **M8 wash regression:** prior ~62% white scrim made pattern invisible — keep wash light enough for wave-v2 (D-113-22).
- **Asset path:** prefer bundled `src/assets/backgrounds/` so production build (`publicDir: false`) still serves the PNG.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
- PHASE.md confirmed `PHASE=113`.
- **M8** planned from arch D-113-20 / D-113-22 / D-113-26 + PLAN AC-113-33 / AC-113-46 (changelog 5.34).
- Source asset present: `team-Yuri/assets/digital-home-shell-wave-v2.png`.
- Acceptance for M8: Home + Login screenshots with perceptible new waves — not Admin work.
- STATUS: **READY_FOR_DEVELOPER** — hand M8 to Sarah.

### Required Corrections
_None at M8 planning._
