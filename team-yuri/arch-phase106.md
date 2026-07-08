# Architecture Phase 106

## Phase Identifier
PHASE=106

## Status
STATUS: READY_FOR_MANAGER

## Architecture Amendment (2026-07-08)
**Operator refinement:** Vault state and lock/unlock controls are **application-wide** — a single **global UI element** on every primary screen (AC-106-19). Supersedes narrower D-106-4 wording that implied sensitive-context-only visibility. Sarah/Developer parallel work should align to this amendment.

**Operator refinement (same date):** Browser assistance in the Hub credential editor is **field-specific** (AC-106-20). Username/email fields may use appropriate browser autocomplete; **password fields only** must suppress password-manager save, generation, and update prompts. Supersedes prior D-106-5 blanket `autoComplete="off"` on all non-password fields.

## Phase Goal
Deliver **Security and Trust Experience** UX: make Zero-Knowledge protection **understandable, visible, and consistent** in Hebrew — vault state indicators, credential-editor browser password-manager suppression, sensitive-operation feedback, first-time security explanation — **without changing** encryption, vault, authentication, execution, or Access Profile architecture.

Phase 106 owns **trust presentation and credential-editor interaction hardening** only. It does not own crypto algorithms (existing vault), Digital Home layout (105), Service Management selection (104), Admin platform (107), or browser packaging (108).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=106`
- `team-Yuri/PLAN.md` §18 — Phase 106 (AC-106-1 … AC-106-20); Security UX / Vault / Credential editor / Trust indicators
- `docs/DECISIONS.md` — ADR-002 Zero-Knowledge Architecture
- `team-Yuri/arch-phase104.md` — APPROVED; credential management lives in Service Management modal
- `team-Yuri/arch-phase105.md` — APPROVED; Digital Home execution-only; trust copy may appear as calm reassurance only
- `src/UnlockScreen.tsx` — Master Password unlock entry
- `src/ServiceProfileManagementModal.tsx` — primary credential editor (currently `autoComplete="current-password"` / `username` — invites browser PM)
- `src/CredentialModal.tsx` — legacy/secondary credential UI if still mounted
- `src/vault/vault.ts` / `src/vault/crypto.ts` — **read-only** this phase (AC-106-12)
- `src/execution/serviceExecution.ts` — **read-only** this phase

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-106-1: UX-only phase** | AC-106-12, PLAN regression protection | **Forbidden:** changes to KDF/cipher, vault blob schema, IndexedDB layout, Supabase dual-write crypto payload shape, `executeServiceFromTile`, Access Profile model, auth. **Allowed:** copy, indicators, form attributes, feedback UI, short onboarding surfaces. |
| **D-106-2: Accurate Zero-Knowledge language** | AC-106-1, AC-106-8, AC-106-11, ADR-002 | Hebrew trust copy must state, in plain language: credentials are encrypted **on the device** before leaving; the product **cannot read** user passwords; Master Password unlocks the local vault. **Must not** claim impossible guarantees (e.g. “never lost”, “government-proof”). Losing Master Password may prevent recovery — stated honestly where first-use explains protection. |
| **D-106-3: Shared trust copy module** | AC-106-5, AC-106-8 | Introduce a single source of short Hebrew strings / indicator labels (e.g. `src/trust/` or `src/securityUx/`) consumed by Unlock, credential editor, and optional Digital Home/Service Management trust chips — avoid divergent marketing phrases. |
| **D-106-4: Global vault chrome (application-wide)** | AC-106-2, AC-106-10, AC-106-19 | Vault state and lock/unlock controls live in a **single consistent global UI element** mounted in the application shell (`App.tsx` or shared layout), visible on **every primary screen** after routing — at minimum **הבית הדיגיטלי** and **ניהול שירותים**. Shows locked/unlocked state; exposes **lock** while unlocked (calls existing `lockVault` / session clear — **no new crypto APIs**). When locked, user returns to existing `UnlockScreen` flow. State updates immediately on lock/unlock without navigation. **No per-screen duplicate** vault controls in Dashboard or ManageServices headers. |
| **D-106-5: Field-specific browser assistance (normative)** | AC-106-3, AC-106-4, AC-106-20 | Hub credential editor (`ServiceProfileManagementModal`; also `CredentialModal` if live) applies **per-field** browser policy — not one blanket rule for the whole form: |
| | | • **Username / email / text identity fields:** may use **appropriate** `autoComplete` (e.g. `username`, `email`, or field-appropriate token derived from `loginFields` label/id). Browser autocomplete **allowed** where it improves entry without conflating Hub vault with site-login save flows. |
| | | • **Password-type fields:** must **suppress** password-manager **save**, **generation**, and **save/update** prompts (Chrome, Edge). Use `autoComplete="new-password"` or `"off"` — **never** `current-password`. Optional hardening attributes (e.g. `data-lpignore`, `data-1p-ignore`) permitted on password inputs only if UAT requires. |
| | | • Form may use `autoComplete="off"` at form level; **field-level** tokens override for username/email per HTML semantics. |
| | | • Preserve accessibility: labels, focus order, keyboard submit unchanged. |
| | | • Optional `readOnly`-until-focus on **password fields only** if attribute-only suppression fails UAT — must remain a11y-safe. |
| | | Master Password on **UnlockScreen** remains a real Hub password entry — may keep `current-password`. |
| **D-106-6: Sensitive operation feedback** | AC-106-6, AC-106-7 | Credential save/update (and delete if shown) must show clear Hebrew **success** feedback. Persist/encrypt failures show **friendly** recovery guidance — never stack traces, never crypto internals, never raw exception strings. Optional brief “שומר בצורה מוצפנת…” during in-flight save is allowed; must clear on success/failure. |
| **D-106-7: First-time security explanation** | AC-106-9 | First-time users (new vault creation and/or first visit to credential management) receive a **short** Hebrew explanation: what Master Password protects; that credentials are encrypted client-side; that the product cannot read them; recovery limitation if Master Password is lost. Must be dismissible / not blocking every open. Prefer one lightweight surface (unlock-first-create or first credential-editor banner) — avoid multi-page security course. |
| **D-106-8: Trust indicators** | AC-106-5 | Reusable visual/text indicators (e.g. “מוצפן במכשיר”, “Zero-Knowledge” / Hebrew equivalent) may appear near credential management and unlock. Same vocabulary everywhere (D-106-3). Indicators must reflect real architecture — encrypted client-side vault — not decorative false claims. |
| **D-106-9: Digital Home / Service Management boundary** | Phase 104/105 | Digital Home remains execution-only — no credential editing there. Trust reassurance on Digital Home may stay minimal (existing calm subtitle OK). Full Zero-Knowledge explanation belongs primarily where credentials are managed (Service Management / profile modal) and at vault unlock/create. |
| **D-106-10: Product naming in copy** | Consistency with Phase 105 | Prefer current product surfaces (**הבית הדיגיטלי**, **ניהול שירותים**) in user-visible copy. If PLAN references a brand name (e.g. STRAIX) for “cannot read credentials,” Manager may choose Hebrew “המוצר” / product name already used — claims must still match ADR-002. |

### Normative global vault chrome (application shell)

```text
App shell (all primary routes while session active)
└── GlobalVaultChrome — fixed position, consistent placement (e.g. app header bar)
    ├── State: כספת פתוחה | כספת נעולה  (or equivalent from D-106-3 copy)
    └── Action: נעילת כספת (lock) when unlocked
```

Unlock is **not** duplicated in the chrome — locked state routes to existing `UnlockScreen`. Sensitive flows (credential modal) inherit the same global state; no second indicator inside modals unless Manager chooses a minimal inline echo (prefer single global source of truth).

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

**Do not** apply password-field suppression tokens to username/email fields. **Do not** use `current-password` on service credential password inputs (current Phase 104 modal behavior — to be corrected).

### Normative trust message themes (Hebrew intent — Manager finalizes wording)

```text
- Credentials encrypted on this device before sync/storage
- Product cannot read your passwords (Zero-Knowledge)
- Master Password unlocks your vault on this device
- Losing Master Password may prevent access to saved credentials
- Save success: credentials saved securely / updated
- Errors: friendly retry / unlock required — no technical dump
```

## Constraints / Non-Negotiables
- AC-106-12: **no** encryption, authentication, execution, or vault architecture modifications.
- Trust copy must not contradict ADR-002 (AC-106-11).
- Credential editors: **field-specific** browser policy — password fields suppress PM prompts (AC-106-3, AC-106-20); username/email may use appropriate autocomplete (AC-106-4).
- Vault lock/unlock via **global chrome** on every primary screen (AC-106-19); state visible during sensitive operations (AC-106-2, AC-106-10).
- Security errors: friendly Hebrew only (AC-106-7).
- Build passes (AC-106-13).
- RTL and accessibility preserved for credential forms.
- Phase 100 `isDevBuild()` / POC surfaces unchanged.

## Technical Boundaries / Out of Scope
- Changing AES/KDF parameters, salt handling, or ciphertext format.
- Changing Supabase Auth / Phase 190 account model.
- Digital Home redesign (105) or Service Management layout redesign (104) beyond trust chips/copy hooks.
- Admin platform (107), browser store packaging (108), icon pipeline (111).
- Extension-side password-manager policy (Hub HTML attributes only this phase).
- Advanced security dashboard, breach monitoring, or 2FA product.
- Auto-submit of external login forms.
- New vault backup/recovery cryptography (honest messaging only if already true for current architecture).

## Dependencies and Interfaces

### Upstream (must be complete)

| Phase | Provides |
|-------|----------|
| 101+ | Client-side encrypted vault + dual-write ciphertext |
| 104 | Credential management entry via **ניהול** → `ServiceProfileManagementModal` |
| 105 | Digital Home calm surface (optional light trust reassurance only) |

### Hub modules (Developer — target ownership)

| Module | Responsibility |
|--------|----------------|
| New `src/trust/*` or `src/securityUx/*` | Shared Hebrew trust strings + `TrustIndicator` + **`GlobalVaultChrome`** (or equivalent) |
| `src/ServiceProfileManagementModal.tsx` | Apply D-106-5 attributes; trust copy near credential fields; save/update success feedback (D-106-6) |
| `src/CredentialModal.tsx` | Same attribute + feedback contract if still reachable |
| `src/UnlockScreen.tsx` | First-time / unlock trust explanation (D-106-7); vault branding consistency; Master Password field may keep authentic autocomplete |
| `src/App.tsx` | Mount **global vault chrome** on all primary routes (D-106-4, AC-106-19); wire lock to existing vault session APIs — **do not** invent new crypto |
| `src/Dashboard.tsx`, `src/ManageServices.tsx` | **Must not** add local vault lock/unlock duplicates — consume global chrome only |
| `src/vault/vault.ts`, `crypto.ts` | **Read-only** |
| `src/execution/*` | **Read-only** |
| Optional `docs/MIGRATION_PHASE_106.md` | Operator notes: browser PM UAT on Chrome + Edge |

## Data / State Considerations
- No new encrypted fields or schema migrations for Phase 106.
- Optional **UI-only** local flag (e.g. `localStorage` / vault UI prefs) for “first-time security tip dismissed” — must not store secrets.
- Vault unlock state continues to derive from existing in-memory key session (`isVaultUnlocked` / App routing) — indicator is a view of truth, not a second state machine.
- Credential save still goes through existing `persistVault` path; Phase 106 only improves **feedback and form attributes** around that path.

## Security / Privacy Considerations
- Suppressing browser PM on Hub editors reduces risk of Chrome/Edge overwriting or capturing the **wrong** password context (site vs Hub vault).
- Never log plaintext credentials while adding feedback/debug paths.
- Trust indicators must not imply server-side zero-knowledge that the stack does not provide — align with ADR-002 (client encrypts; server stores ciphertext).
- Unlock screen remaining use of `current-password` is intentional for Master Password.

## Testing and Lint Expectations
- `npm run build` passes (AC-106-13).
- `npx tsc -b` passes (via build).
- Add `scripts/verifyPhase106SecurityTrust.mjs` — static checks: shared trust copy module; **field-specific** autocomplete contract (password `new-password`/`off`, not `current-password`; username/email not forced to `off`); global vault chrome; no `vault/crypto` algorithm changes from UI files.
- Manual UAT matrix (Manager publishes): Chrome + Edge — **password fields only**: no save/generate/update PM prompts; username/email autocomplete acceptable; global vault chrome on primary screens.
- Re-run Phase 103/105 verify scripts if Dashboard/Management touched only for trust chips — execution path must remain PASS.

## Functional Testability

- **Page/screen:** Unlock / create vault; Service Management → **ניהול** → credential fields
- **User-visible behavior:**
  - Clear Hebrew Zero-Knowledge explanation near credential management / first use
  - **Global vault chrome** on every primary screen — state + lock action
  - Vault state updates immediately on lock/unlock
  - Saving credentials shows success feedback
  - Security errors are friendly Hebrew
  - Chrome/Edge: **password fields** — no save/generate/update PM prompts; username/email may autocomplete
- **Command-line:** `node scripts/verifyPhase106SecurityTrust.mjs`
- **Minimal end-to-end flow:**
  1. Create or unlock vault — see short protection explanation (first time)
  2. Open Service Management → **ניהול** on a service → confirm trust indicator + ZK copy
  3. Enter credentials → Save → success feedback; no Chrome/Edge save-password bubble
  4. Navigate Digital Home ↔ Service Management — same global vault chrome; lock from either screen
  5. Force a friendly error path (if available) — no technical dump
- **Expected:** AC-106-1 … AC-106-20; ADR-002 unchanged in behavior

## Handoff Notes for Manager

1. Publish AC-106-1 … AC-106-20 verbatim with milestone mapping.
2. Suggested milestones: (M1) shared trust copy + TrustIndicator + **GlobalVaultChrome** → (M2) Unlock/first-time security explanation → (M3) **mount global vault chrome in App shell on all primary routes** (AC-106-19) → (M4) credential editor autocomplete contract + a11y check → (M5) save/update success + friendly security errors → (M6) apply trust copy in management modal → (M7) verify script + Chrome/Edge PM UAT + global chrome UAT + docs.
3. **Critical UAT:** Chrome **and** Edge — **password fields only** must not show PM save/generate/update prompts (AC-106-3, AC-106-20); username/email autocomplete allowed (AC-106-4). Global vault chrome on primary screens (AC-106-19).
4. Explicitly **forbid** edits to `vault/crypto.ts` algorithms, execution orchestration, and Access Profile behavior.
5. Finalize Hebrew wording from D-106 trust themes; keep short and non-jargony.
6. Decide first-time surface: vault create vs first credential open (or both with single dismiss flag).
7. Developer evidence: `dev-phase106.md` with build PASS, verify script PASS, Chrome+Edge PM matrix, no-architecture-change affirmation.

## Architect Review
ARCHITECT_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
_Pending Manager plan, Developer implementation, and evidence._

### Required Corrections
_None at architecture authoring._
