# Manager Phase 106

## Phase Identifier
PHASE=106

## Status
STATUS: READY_FOR_DEVELOPER

## Architecture Amendments (2026-07-08)

**Amendment 1 — Global vault chrome (AC-106-19):** Vault state and lock/unlock controls are **application-wide** — a single **global UI element** on every primary screen. Supersedes narrower D-106-4 wording that implied sensitive-context-only visibility.

**Amendment 2 — Field-specific browser assistance (AC-106-20; amended AC-106-3, AC-106-4):** Browser assistance in the Hub credential editor is **field-specific**. Username/email fields may use appropriate browser autocomplete; **password fields only** must suppress password-manager save, generation, and update prompts. Supersedes prior D-106-5 blanket `autoComplete="off"` on all non-password fields.

## Phase Goal
Deliver **Security and Trust Experience** UX: make Zero-Knowledge protection **understandable, visible, and consistent** in Hebrew — vault state indicators, credential-editor browser password-manager suppression, sensitive-operation feedback, first-time security explanation — **without changing** encryption, vault, authentication, execution, or Access Profile architecture.

Phase 106 owns **trust presentation and credential-editor interaction hardening** only. It does not own crypto algorithms, Digital Home layout (105), Service Management selection (104), Admin platform (107), or browser packaging (108).

## Source References
- `team-Yuri/arch-phase106.md` (including Architecture Amendments 2026-07-08)
- `team-Yuri/PLAN.md` §18 — Phase 106 acceptance criteria (AC-106-1 … AC-106-20)
- `team-Yuri/PHASE.md` — `PHASE=106`
- `docs/DECISIONS.md` — ADR-002 Zero-Knowledge Architecture
- `team-Yuri/arch-phase104.md` — credential management via **ניהול** → `ServiceProfileManagementModal`
- `team-Yuri/arch-phase105.md` — Digital Home execution-only; optional calm trust reassurance only

## Architecture Summary (Phase 106 constraints)
- **UX-only phase (AC-106-12):** Forbidden — vault/crypto algorithms, vault blob/IndexedDB schema, Supabase ciphertext payload shape, `executeServiceFromTile` orchestration, Access Profile model/behavior, auth architecture. Allowed — copy, indicators, form attributes, feedback UI, short onboarding surfaces.
- **Accurate Zero-Knowledge language (AC-106-1, AC-106-8, AC-106-11):** Hebrew claims must match ADR-002 — encrypt on device; product cannot read passwords; Master Password unlocks local vault; no impossible guarantees.
- **Shared trust copy module (D-106-3, AC-106-14):** Single source of Hebrew strings / indicator labels (`src/trust/` or `src/securityUx/`); one name per concept (Vault, Master Password, Encrypted, Zero-Knowledge, Client-side Encryption).
- **Global vault chrome (D-106-4, AC-106-19):** Single **GlobalVaultChrome** in application shell (`App.tsx` or shared layout), visible on **every primary screen** after routing — at minimum **הבית הדיגיטלי** and **ניהול שירותים**. Shows locked/unlocked state; exposes **lock** while unlocked (existing `lockVault` / session clear — **no new crypto APIs**). Locked state routes to existing `UnlockScreen`. Updates immediately on lock/unlock. **No per-screen duplicate** controls in `Dashboard` or `ManageServices`.
- **Field-specific browser assistance (D-106-5, AC-106-3, AC-106-4, AC-106-20):** Per-field policy in Hub credential editor — username/email may use appropriate `autoComplete` (`username`, `email`, or field-appropriate token); **password fields only** use `new-password` or `off` — **never** `current-password`; must suppress PM save/generate/update prompts (Chrome + Edge). Form may use `autoComplete="off"` at form level; field-level tokens override for username/email. Unlock Master Password may keep `current-password`.
- **Sensitive operation feedback (AC-106-6, AC-106-7):** Clear Hebrew success on save/update; friendly errors only.
- **First-time security explanation (AC-106-9):** Short, dismissible; not a multi-page course.
- **Security messaging discipline (AC-106-15, AC-106-16):** Distinguish account information from encrypted Vault data; avoid unnecessary warnings; actionable information only.
- **Consistent UX across service types (AC-106-17):** Same trust/autocomplete contract for catalog, custom, and future service types in credential editor.
- **Security Settings foundation (AC-106-18):** Minimal UX/navigation foundation anticipating future settings (Auto Lock, Trusted Devices, etc.) — capabilities themselves are **out of scope** this phase.
- Prefer product surfaces **הבית הדיגיטלי** / **ניהול שירותים** in copy (D-106-10).

### Normative global vault chrome (application shell)

```text
App shell (all primary routes while session active)
└── GlobalVaultChrome — fixed position, consistent placement (e.g. app header bar)
    ├── State: כספת פתוחה | כספת נעולה  (or equivalent from D-106-3 copy)
    └── Action: נעילת כספת (lock) when unlocked
```

Unlock is **not** duplicated in the chrome — locked state routes to existing `UnlockScreen`. Prefer single global source of truth; no second indicator inside modals unless minimal inline echo (optional — global chrome is authoritative).

### Normative browser assistance contract (Hub credential editor)

```text
Per loginField from service metadata:

  field.type !== 'password'
    → autoComplete: appropriate token (username | email | off) — browser autocomplete ALLOWED

  field.type === 'password'
    → autoComplete: new-password | off
    → MUST NOT trigger PM save / generate / update prompts (Chrome + Edge UAT)
    → MUST NOT use current-password
```

**Do not** apply password-field suppression tokens to username/email fields. **Do not** use `current-password` on service credential password inputs.

## Acceptance / Gating Criteria (verbatim — PLAN §18)

| ID | Criterion |
|---|---|
| AC-106-1 | Zero-Knowledge is explained in clear, non-technical Hebrew where credentials are managed |
| AC-106-2 | Vault lock/unlock state is always visible during sensitive operations |
| AC-106-3 | Internal credential editor **password fields** prevent Chrome and Edge password-manager save, generation, and update prompts |
| AC-106-4 | Username and email fields in the internal credential editor may use appropriate browser autocomplete; password fields must not trigger password-manager interference |
| AC-106-5 | Trust indicators consistently communicate encrypted client-side storage |
| AC-106-6 | Credential save/update operations provide clear success feedback |
| AC-106-7 | Security-related errors are friendly and never expose technical implementation details |
| AC-106-8 | Security messaging is consistent throughout the application |
| AC-106-9 | First-time users receive a short explanation of how credentials are protected |
| AC-106-10 | Vault state changes immediately update the UI |
| AC-106-11 | No security claim contradicts the Zero-Knowledge architecture |
| AC-106-12 | Phase 106 does not modify encryption, authentication, execution, or vault architecture |
| AC-106-13 | Build passes |
| AC-106-14 | Security terminology remains consistent across all application screens |
| AC-106-15 | Security UX clearly distinguishes account information from encrypted Vault data |
| AC-106-16 | Security messaging avoids unnecessary warnings and presents only actionable security information |
| AC-106-17 | Security UX behaves consistently for catalog services, custom services, and future service types |
| AC-106-18 | Security Settings foundation exists and can be extended in future phases without redesigning the user experience |
| AC-106-19 | Vault state and lock/unlock controls are available from every primary application screen through a consistent global UI element |
| AC-106-20 | Browser assistance in the internal credential editor is field-specific — username/email autocomplete allowed; password fields suppress password-manager prompts |

### Critical architecture forbid list (AC-106-12)
Developer **must not** change:
- `src/vault/crypto.ts` algorithms / KDF / ciphertext format
- Vault / IndexedDB architecture or dual-write crypto payload shape
- `executeServiceFromTile` orchestration or execution adapters
- Access Profile model or CRUD **behavior** (only UX wrapping around existing callbacks)
- Authentication architecture

Evidence must include an explicit **no-architecture-change affirmation**.

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| M1 | Shared trust copy + TrustIndicator + GlobalVaultChrome | `src/trust/*` — centralized Hebrew strings, indicator component, **`GlobalVaultChrome`** shell component | Single vocabulary; chrome component exists | AC-106-5, AC-106-8, AC-106-11, AC-106-14 |
| M2 | Unlock / first-time security explanation | Short Hebrew protection explanation on vault create and/or first sensitive visit; dismissible | Tip shown once; not blocking every open | AC-106-1, AC-106-9, AC-106-16 |
| M3 | Global vault chrome in App shell | Mount **GlobalVaultChrome** from `App.tsx` on all primary routes; wire lock to existing session APIs; **no duplicates** in Dashboard/ManageServices | Visible on Digital Home + Service Management; lock returns to UnlockScreen | AC-106-2, AC-106-10, AC-106-19 |
| M4 | Field-specific autocomplete contract + a11y | Apply D-106-5 per-field policy on `ServiceProfileManagementModal` (+ `CredentialModal` if live); preserve labels/focus/keyboard | Password fields suppress PM; username/email autocomplete allowed | AC-106-3, AC-106-4, AC-106-17, AC-106-20 |
| M5 | Save/update success + friendly security errors | Clear Hebrew success feedback; friendly failure guidance; no stack traces / crypto internals | Save shows success; errors friendly | AC-106-6, AC-106-7 |
| M6 | Trust copy + Security Settings foundation | Wire shared strings near credential fields; distinguish account vs Vault data; minimal settings foundation; optional light Digital Home reassurance | Credentials-managed surfaces show ZK explanation; settings extensible | AC-106-1, AC-106-5, AC-106-8, AC-106-15, AC-106-18 |
| M7 | Verify script + Chrome/Edge PM UAT + global chrome UAT + docs | `verifyPhase106SecurityTrust.mjs`; Chrome **and** Edge password-field PM UAT; username autocomplete check; **global chrome UAT** Digital Home ↔ Service Management; `docs/MIGRATION_PHASE_106.md`; build PASS | Scripts PASS; P1–P5 + G1–G4 PASS; AC-106-12 affirmed | AC-106-3, AC-106-4, AC-106-12, AC-106-13, AC-106-19, AC-106-20 |

## Detailed Development Plan

### M1 — Shared trust copy + TrustIndicator + GlobalVaultChrome
Create `src/trust/` (or `src/securityUx/`) with:
- Short Hebrew themes (Manager-approved intent): encrypted on this device; product cannot read passwords; Master Password unlocks vault; loss may prevent access; save success; friendly errors; vault open/locked labels.
- Consistent terminology: Vault / Master Password / Encrypted / Zero-Knowledge / Client-side Encryption (Hebrew equivalents — **one name per concept**, AC-106-14).
- `TrustIndicator` component (“מוצפן במכשיר”, etc.) — must reflect real architecture.
- **`GlobalVaultChrome`** (or equivalent): state display + lock action when unlocked; consumes shared copy from M1.

### M2 — Unlock / first-time security explanation
- Surface on **new vault create** and/or **first credential-management visit**.
- Single dismiss flag (UI-only `localStorage` / prefs — **no secrets**).
- Content: what Master Password protects; client-side encryption; product cannot read credentials; recovery limitation if Master Password lost.
- Keep short; prefer one lightweight surface; no security-fatigue (AC-106-16).

### M3 — Global vault chrome in App shell (AC-106-19)
- Mount **GlobalVaultChrome** from `App.tsx` (or shared layout) on **all primary routes** while session is active.
- Minimum screens: **הבית הדיגיטלי** (`Dashboard`) and **ניהול שירותים** (`ManageServices`).
- Shows **כספת פתוחה / כספת נעולה** (or M1 copy); **נעילת כספת** action when unlocked.
- Lock calls existing `lockVault` / session clear — **no new crypto APIs**. Locked → existing `UnlockScreen` flow.
- State updates **immediately** on lock/unlock without navigation (AC-106-10).
- **`Dashboard.tsx` and `ManageServices.tsx` must NOT** add local vault lock/unlock duplicates — consume global chrome only.
- Sensitive flows (credential modal) inherit global state; prefer single global source of truth.

### M4 — Field-specific autocomplete contract (critical — AC-106-20)
Apply **per-field** browser policy per D-106-5 normative contract (see Architecture Summary).

- Primary target: `ServiceProfileManagementModal.tsx` (replace `current-password` on service password fields; allow appropriate tokens on username/email).
- Also apply to `CredentialModal.tsx` if still reachable.
- Same contract for catalog, custom, and future service `loginFields` (AC-106-17).
- **UnlockScreen** Master Password may keep `current-password` (real Hub password entry).
- Preserve accessibility: labels, focus order, keyboard submit unchanged.
- Optional `readOnly`-until-focus on **password fields only** if attribute-only suppression fails UAT — must stay a11y-safe.
- Optional `data-lpignore` / `data-1p-ignore` on password inputs only if UAT requires.

### M5 — Sensitive operation feedback
- Credential save/update (and delete if shown): clear Hebrew **success** feedback.
- Persist/encrypt failures: friendly recovery guidance only — never stack traces, crypto internals, or raw exception strings.
- Optional brief in-flight “שומר בצורה מוצפנת…” that clears on success/failure.

### M6 — Trust copy on management surfaces + Security Settings foundation
- Show Zero-Knowledge / encrypted-on-device explanation where credentials are managed.
- Reuse M1 strings (AC-106-8); distinguish account information from encrypted Vault data (AC-106-15).
- Digital Home: optional minimal calm reassurance only — **no** credential editing there (D-106-9).
- **Security Settings foundation (AC-106-18):** minimal navigation/UX hook that future phases can extend (Auto Lock, Trusted Devices, Biometric Unlock, MFA, Recovery) — **do not implement** those capabilities in Phase 106.

### M7 — Verification + critical UAT gates + docs

**Static:** `scripts/verifyPhase106SecurityTrust.mjs` proving:
- Shared trust module / centralized strings exist
- **`GlobalVaultChrome` mounted from `App.tsx`** — not duplicated in `Dashboard.tsx` / `ManageServices.tsx`
- **Field-specific** autocomplete contract: password fields use `new-password`/`off`, not `current-password`; username/email **not** forced to blanket `off`
- No UI-only files altering `vault/crypto` algorithm surface
- Unlock remains Master Password entry

**Build:** `npm run build` **PASS** (AC-106-13).

**Docs:** `docs/MIGRATION_PHASE_106.md` — field-specific attribute contract, Chrome/Edge password-field PM UAT, username autocomplete allowance, **global chrome UAT**, AC-106-12 forbid list.

**Regression (if lightly touched):** re-run Phase 103/105 verify scripts if Dashboard/Management changed only for trust — execution path must remain PASS.

## Critical UAT Gate — Chrome + Edge Password Fields (AC-106-3, AC-106-4, AC-106-20)

**Manager approval blocker.** Static attributes are **necessary but not sufficient**.

| # | Browser | Surface | Steps | Expected |
|---:|---|---|---|---|
| P1 | **Chrome** | Service Management → **ניהול** → **password** field | Enter password → Save | **No** “Save password?” / save-to-password-manager / generate / update prompt for Hub **password** field |
| P2 | **Chrome** | Same editor → **username/email** field | Focus field; browser has saved credentials | Browser autocomplete **allowed** on username/email; does **not** conflate with Hub vault save flow |
| P3 | **Edge** | Same as P1 | Save Hub password | **No** Edge save/generate/update-password UI for Hub **password** field |
| P4 | **Edge** | Same as P2 | Username/email autocomplete | Autocomplete **allowed**; password field not overwritten by browser PM |
| P5 | **Chrome + Edge** | Password field only | Enter password; observe PM UI | Password field does **not** trigger PM save/generate/update; username/email behavior per P2/P4 |

Developer evidence must record **browser version**, Hub URL, and Pass/Fail per P1–P5.

## Critical UAT Gate — Global Vault Chrome (Digital Home ↔ Service Management)

**Manager approval blocker** (AC-106-19, AC-106-2, AC-106-10). Static mount checks are **necessary but not sufficient**.

| # | Surface | Steps | Expected |
|---:|---|---|---|
| G1 | **הבית הדיגיטלי** (Digital Home) | Unlock vault → view Digital Home | Global vault chrome visible; shows **כספת פתוחה** (or M1 equivalent); **נעילת כספת** action present |
| G2 | **ניהול שירותים** (Service Management) | Navigate from Digital Home → Service Management | **Same** global chrome element; consistent placement; same state |
| G3 | Lock from Service Management | Tap **נעילת כספת** on Service Management | Immediate UI update; user routed to `UnlockScreen`; no stale unlocked state |
| G4 | Lock from Digital Home | Unlock again → navigate to Digital Home → lock | Same behavior as G3; chrome updates immediately without full-page navigation artifacts |

Also confirm during G1/G2:
- No duplicate vault controls in Dashboard or ManageServices headers
- Credential modal open (optional): global chrome still authoritative; state remains visible

Developer evidence must record observations for G1–G4.

## Functional Test Matrix

**Prerequisites:** vault; Chrome **and** Edge available for PM tests; `npm run dev`.

| # | Test | Steps | Expected | AC |
|---:|---|---|---|---|
| T1 | ZK explanation at management | Open **ניהול** credentials | Clear non-technical Hebrew ZK / on-device encryption copy | AC-106-1 |
| T2 | Global chrome on Digital Home | View **הבית הדיגיטלי** | GlobalVaultChrome visible; unlocked state + lock action (G1) | AC-106-19, AC-106-2 |
| T3 | Global chrome on Service Management | Navigate to **ניהול שירותים** | Same global chrome; consistent placement (G2) | AC-106-19, AC-106-8 |
| T4 | Lock from either screen | Lock from Digital Home and Service Management | UnlockScreen; immediate state update (G3, G4) | AC-106-10, AC-106-19 |
| T5 | No per-screen duplicates | Inspect Dashboard + ManageServices headers | No local vault lock/unlock controls | AC-106-19 |
| T6 | Chrome password PM suppression | Save Hub **password** in Chrome | No PM save/generate/update prompt (P1) | AC-106-3, AC-106-20 |
| T7 | Edge password PM suppression | Save Hub **password** in Edge | No PM save/generate/update prompt (P3) | AC-106-3, AC-106-20 |
| T8 | Username/email autocomplete allowed | Focus username/email in Chrome/Edge | Appropriate autocomplete works (P2, P4) | AC-106-4, AC-106-20 |
| T9 | Password field no PM interference | Password field vs browser saved passwords | Password not clobbered; no PM prompts | AC-106-4 |
| T10 | Trust indicators | View credential management / unlock | Consistent “encrypted on device” messaging | AC-106-5 |
| T11 | Save success feedback | Save credentials | Clear Hebrew success | AC-106-6 |
| T12 | Friendly security errors | Force persist/vault error if hook available | Friendly Hebrew; no technical dump | AC-106-7 |
| T13 | Messaging consistency | Unlock + Management surfaces | Same vocabulary (M1) | AC-106-8, AC-106-14 |
| T14 | First-time explanation | New vault and/or first credential visit | Short tip; dismissible | AC-106-9 |
| T15 | Account vs Vault distinction | Review management copy | Account info distinguished from encrypted Vault data | AC-106-15 |
| T16 | No unnecessary warnings | Browse trust surfaces | Actionable info only; no security fatigue | AC-106-16 |
| T17 | Consistent across service types | **ניהול** on catalog + custom service | Same trust + autocomplete contract | AC-106-17 |
| T18 | Security Settings foundation | Locate settings entry/shell | Minimal extensible foundation present | AC-106-18 |
| T19 | Claims vs ADR-002 | Review trust copy | No contradictory / false guarantees | AC-106-11 |
| T20 | Architecture unchanged | Diff / affirmation | No crypto / execution / Access Profile behavior changes | AC-106-12 |
| T21 | Build | `npm run build` | PASS | AC-106-13 |
| T22 | Unlock Master Password autocomplete | Unlock screen | May use `current-password`; service password fields must not | D-106-5 |
| T23 | Accessibility | Tab through credential form | Labels/focus/keyboard submit preserved | D-106-5 |

**Critical gate rows:** P1–P5 (= T6–T9); G1–G4 (= T2–T4).

## Required Developer Evidence
`team-Yuri/dev-phase106.md` must include:

| Evidence area | Required content |
|---|---|
| Files changed | Full list; affirm **no** edits to crypto algorithms / `executeServiceFromTile` / Access Profile behavior |
| M1–M7 milestones | Completion table |
| M7 static verify | `node scripts/verifyPhase106SecurityTrust.mjs` (**PASS**) — global chrome mount + field-specific autocomplete assertions |
| **Chrome + Edge password-field PM UAT (P1–P5)** | Live observations: browser version, result PASS/FAIL; username autocomplete noted |
| **Global chrome UAT (G1–G4)** | Digital Home ↔ Service Management visibility + lock from both screens |
| Functional matrix | T1–T23 results (or N/A with reason) |
| AC-106-12 affirmation | Explicit statement: encryption, auth, execution, vault architecture, Access Profile behavior unchanged |
| Documentation | `docs/MIGRATION_PHASE_106.md` (field-specific PM UAT + global chrome UAT) |
| Build | `npm run build` (**PASS**) |
| Tests / lint | Result or NOT AVAILABLE with reason |

## Hebrew wording (themes — finalize in implementation)
Use short, non-jargony Hebrew aligned with:
- Credentials encrypted on this device before sync/storage
- Product cannot read your passwords (Zero-Knowledge)
- Master Password unlocks your vault on this device
- Losing Master Password may prevent access to saved credentials
- Save success: credentials saved/updated securely
- Errors: friendly retry / unlock required — no technical dump
- Vault state: כספת פתוחה / כספת נעולה; lock action: נעילת כספת

Prefer **המוצר** / existing product naming over inventing a brand unless already used in UI.

## First-time surface decision
**Default:** first vault create **and** first open of credential management (shared dismiss flag — tip once). Developer may choose create-only if one surface is clearly better UX; document choice in `dev-phase106.md`.

## Out of Scope (must not be implemented)
- Changing AES/KDF parameters, salt handling, or ciphertext format
- Changing Supabase Auth / Phase 190 account model
- Digital Home or Service Management redesign beyond trust chips/copy and **forbidden** local vault chrome duplicates
- Admin platform (107), browser store packaging (108), icon pipeline (111)
- Extension-side password-manager policy (Hub HTML attributes only this phase)
- Advanced security dashboard, breach monitoring, 2FA product
- Auto-submit of external login forms
- New vault backup/recovery cryptography
- Editing `executeServiceFromTile` or Access Profile behavior
- Implementing Auto Lock, Trusted Devices, Biometric Unlock, MFA, or Recovery (AC-106-18 foundation only)

## Risks / Open Questions
- **Chrome/Edge password-field PM UAT is a highest-risk gate** — may need optional `readOnly`-until-focus on password fields only if UAT fails.
- **Global chrome placement in RTL** must be consistent across Digital Home and Service Management — avoid layout shift on navigation.
- Trust copy must not over-claim vs ADR-002 (AC-106-11).
- Do not conflate Master Password unlock field autocomplete with Hub **service** credential fields.
- Field-specific policy: do not regress username/email entry by applying password suppression tokens to identity fields.
- Avoid security-fatigue: dismissible tip; no redundant warnings when no action required.
- If Dashboard/Management touched, re-confirm Phase 103/105 static scripts still PASS.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes

### Required Corrections
