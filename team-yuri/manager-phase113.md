# Manager Phase 113

## Phase Identifier
PHASE=113

## Status
STATUS: READY_FOR_DEVELOPER

## Contract note
Architecture contract is **FINAL** (operator-approved clarifications, 2026-07-14). Manager must **not** redefine architecture. Follow `arch-phase113.md` and PLAN AC-113-1…21 strictly.

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
- `team-Yuri/arch-phase113.md` — **FINAL**; READY_FOR_MANAGER; D-113-0 … D-113-14
- `team-Yuri/PLAN.md` §18 — Phase 113 (AC-113-1 … AC-113-21); changelog **5.18…5.20**
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

**Ship order:** M1→M4 before M5. Do not delay Manual UX for auto wiring.

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

**Critical:** T1–T9, T11–T14. T10 optional/non-gating.

## Required Developer Evidence
`team-Yuri/dev-phase113.md` must include:

| Evidence area | Required content |
|---|---|
| Implementation summary | Journey UX; support levels; optional existing-auto wire |
| Files changed | List |
| M1–M4 UAT | Open/profile/copy/password/badge/Manual Only observations |
| M5 | How existing auto is called (or skipped); status if attempted; affirm success not required |
| M6 | `MIGRATION_PHASE_113.md`; build PASS |
| Acceptance | Guaranteed journey + graceful fallback evidenced |
| Affirmations | No Phase 112 work; no new LI/detection; no schema migration; no 116; no autofill-PASS gate |
| Scope | No federated/modal/multi-step automation engines |

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

## Risks / Open Questions
- Accidentally coupling support levels to Phase 112 LI fields — use independent UX mapping/metadata only.
- Expanding M5 into engine work — reject; Best Effort call only.
- UAT blocked waiting for autofill success — wrong bar; Manual journey is enough.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
- PHASE.md confirmed `PHASE=113`.
- Manager plan synced from **FINAL** `arch-phase113.md` + PLAN AC-113-1…21 (changelog 5.20).
- Acceptance = observable open/profile/copy/password/support-level/fallback — **not** autofill PASS demos.
- STATUS: **READY_FOR_DEVELOPER** — hand off to Sarah (prefer Manual UX M1–M4 first).

### Required Corrections
_None at planning._
