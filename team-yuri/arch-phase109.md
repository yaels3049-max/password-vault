# Architecture Phase 109

## Phase Identifier
PHASE=109

## Status
STATUS: READY_FOR_MANAGER

## Amendment
AMENDED: 2026-07-13 — **Single Digital Home password.** Removes the second “Master Password / vault unlock” door. Login/Create Account unlock or create the local vault with the same password in one step. Vault lock = logout → Login screen. MFA deferred to Phase 191+. Revises D-109-1, D-109-2, D-109-8, D-109-12; updates AC-109-24/32 alignment.

AMENDED: 2026-07-13 (admin access) — **D-109-22.** Admin console must offer Login on `#/admin` / `/admin` when unauthenticated (same account password). One SPA deploy; admin is a route/bookmark, not a second deployment.

AMENDED: 2026-07-13 (workspace isolation) — **D-109-23.** Operator report: new user saw previous user’s Digital Home / Manage services. Root cause class: **device-global local vault / UI state not scoped by `userId`**. Adds AC-109-36/37. Client vault storage and Discover visibility must be user-scoped; private customs never leak across accounts.

AMENDED: 2026-07-13 (cross-browser hydrate) — **D-109-24 / AC-109-38.** Operator report: same user has services in Chrome Digital Home but empty Home in Edge. Root cause: local IndexedDB is per-browser; login unlocked an empty Edge vault and never hydrated from cloud `user_services` / encrypted blobs. Cloud hydrate after login is mandatory for AC-109-17.

AMENDED: 2026-07-13 (workspace durability) — **D-109-25 / AC-109-39.** Operator report: after internet dropout, one user’s Digital Home survived; the **admin** user’s services and passwords were gone and must be re-added. Likely class: **destructive sync/hydrate** (empty or partial local state dual-written / wiping cloud ciphertext; or empty cloud treated as authority after local cache loss) — **not** an inherent “admin role deletes Home” rule. Admin Digital Home uses the same vault/`userId` rules as any user. Adds anti-wipe constraints.

## Phase Goal
Deliver a **production-ready user account and authentication foundation**: explicit Login and Create Account flows, **one user-facing Digital Home password**, one immutable authenticated `userId`, database-enforced user isolation, **client workspace isolation per `userId`**, session restore/logout, Chrome and Edge account continuity, and an audited cleanup path for unintended anonymous users — **without** a second vault-password screen, without redesigning Vault crypto algorithms, execution, or registry discovery, and without subscription/billing or MFA.

Phase 109 owns the **account shell** that future subscription (151), MFA/session hardening (191), and vault/account security (192) extend. It stops anonymous user proliferation, stops dual-door UX, and stops **cross-account workspace leakage** on shared browsers.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=109`
- `team-Yuri/PLAN.md` §18 — Phase 109 (AC-109-1 … AC-109-37); Ownership Authority; Client workspace isolation; Catalog / Discover visibility
- `docs/DECISIONS.md` — ADR-002 Zero-Knowledge
- `team-Yuri/arch-phase102.md` — RLS: user-owned registry rows visible only to owner
- `team-Yuri/arch-phase104.md` / `105` — Digital Home / Service Management consume per-user selection
- `team-Yuri/arch-phase107.md` — admin
- `src/vault/vault.ts` — local vault must become **userId-namespaced** (KDF algorithms unchanged)
- `src/App.tsx` — must clear prior user in-memory state on auth switch

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-109-1: Explicit Auth entry shell (single password)** | AC-109-1…4 | Auth Login \| Create Account only; one password; no Master Password door. |
| **D-109-2: Single Digital Home password (coupled secret)** | AC-109-32 | Same password for Auth + vault KDF in one step; document coupling; MFA later. |
| **D-109-3: Stop anonymous auto-user creation** | AC-109-2, AC-109-3, AC-109-30 | Kill `signInAnonymously` / `ensureAnonymousUserId`. |
| **D-109-4: Single identity link** | AC-109-5, AC-109-8 | `public.users.id` = `auth.users.id`. |
| **D-109-5: Application user profile schema** | Account model | Profile columns; role/status; client cannot set role. |
| **D-109-6: Email normalization + DB uniqueness** | AC-109-6, AC-109-7 | UNIQUE `email_normalized`. |
| **D-109-7: Atomic registration** | AC-109-7…9 | Auth + profile; then vault for **this** userId. |
| **D-109-8: Login + vault in one step** | AC-109-10, AC-109-11, AC-109-32 | Auth → unlock/create **this userId’s** vault namespace → route. |
| **D-109-9: Post-auth routing** | AC-109-14…16 | Prefer cloud `user_services` for **this** user; never another user’s data. |
| **D-109-10: Ownership Authority** | PLAN | Only authenticated `userId`. |
| **D-109-11: RLS security boundary** | AC-109-12, AC-109-13 | DB isolation. |
| **D-109-12: Lock = logout; refresh** | AC-109-23, AC-109-24 | Lock → logout → Login; clear in-memory vault. |
| **D-109-13: Chrome + Edge continuity** | AC-109-17…19 | Same account across browsers. |
| **D-109-14: Admin role** | AC-109-20…22 | SQL promote only. |
| **D-109-15: Unintended-user cleanup** | AC-109-28…30 | Audit; empty-only delete. |
| **D-109-16: Dev password policy** | AC-109-31 | Dev config only. |
| **D-109-17: Future Subscription Boundary** | PLAN | No billing in 109. |
| **D-109-18: Auth module boundary** | Separation | Auth owns identity; vault consumers pass userId-scoped storage. |
| **D-109-19: Phase 108 regression** | AC-109-33, AC-109-34 | No discovery redesign. |
| **D-109-20: Phone** | PLAN | Required; not primary identity. |
| **D-109-21: MFA deferred** | Non-goals | No 2FA in 109. |
| **D-109-22: Admin console access** | Phase 107 | `#/admin` Login when unauthenticated; one SPA. |
| **D-109-23: Client workspace isolation (userId-scoped vault)** | AC-109-11, AC-109-12, AC-109-36, AC-109-37; operator bug | **Local vault ciphertext / IndexedDB (or equivalent) MUST be keyed by authenticated `userId`.** Same password on two accounts must not open the other account’s workspace. On login/register/logout/account-switch: clear previous user’s in-memory `VaultState` / UI selections before loading the new user’s namespace. Digital Home and Manage derive only from the current `userId`. **Discover catalog:** show global rows (`built_in`, `admin`, `approved_global`) to all users; show `source_type=user` private customs **only** when `owner_user_id = auth.uid()`. Never paint another user’s customs or selections. |
| **D-109-24: Cross-browser workspace hydrate (cloud authority)** | AC-109-17, AC-109-18, AC-109-38; operator bug Chrome≠Edge | IndexedDB is **per-browser**. After Login: `hydrateWorkspaceFromCloud(userId)` before paint. Cloud membership authoritative **when cloud has selections**; decrypt credentials client-side; persist into this browser’s vault. |
| **D-109-25: Workspace durability / anti-wipe** | AC-109-39; operator data-loss after outage | **Admin role does not own a separate Digital Home vault** — same `userId`-scoped rules as any user. Hard rules: (1) **Hydrate must never replace a non-empty local workspace with an empty result** solely because cloud read returned zero rows, timed out, or failed partially — treat uncertain cloud as “keep local”. (2) **Dual-write must never delete cloud `encrypted_credentials` for a profile merely because the in-memory credential map omitted that profile’s values** during re-key/sync — delete ciphertext only on explicit user remove-credential / remove-service flows. (3) **Dual-write must never delete `user_services` rows** that are absent from a partial local snapshot unless the user explicitly removed those services. (4) Offline / reconnect: local IndexedDB remains source of truth until a **successful, complete** cloud read; then merge with non-destructive rules (union or cloud-wins-only-when-cloud-non-empty for membership; never empty-wins over local non-empty). (5) Creating a new empty local vault blob (missing IndexedDB) must still hydrate from cloud when online; if both empty, that is true empty — not a wipe. |

### Normative entry / session flow

```text
App load (Digital Home)
  → no usable session OR vault key missing?
       YES → Auth entry (Login | Create Account)
       NO  → unlock vault namespace for auth.uid()
           → if online: hydrateWorkspaceFromCloud(userId) then paint
           → route by THAT user’s user_services

App load (#/admin or /admin)
  → no email session? → Admin Login (same password)
  → session ok → is_admin? → Admin shell : friendly deny

Login / Create Account (email + Digital Home password)
  → authenticate / register (never anonymous create)
  → clear any previous user’s in-memory vault/UI state
  → unlock/create vault blob for THIS userId with the same password
  → hydrateWorkspaceFromCloud(THIS userId)   // REQUIRED for Chrome↔Edge parity
  → paint Digital Home / Manage from hydrated state
  → route

Vault lock / Logout
  → auth.signOut + lockVault + clear in-memory workspace → Auth Login
```

### Normative cross-browser continuity

```text
Chrome (user U): add services → dual-write user_services + encrypted blobs
Edge (same U): Login with same Digital Home password
  → same userId
  → local Edge vault may be empty
  → hydrate from Supabase → Digital Home shows same service tiles
  → decrypt credentials client-side with password-derived key
  → persist into Edge IndexedDB user:U for offline
```

### Normative hydrate / sync durability (D-109-25)

```text
hydrate(local, cloud):
  if cloud_read_failed OR cloud_read_incomplete → return local unchanged
  if cloud.selectedIds empty AND local.selectedIds non-empty → keep local membership
  if cloud.selectedIds non-empty → use cloud membership (AC-109-38)
  credentials: merge; never drop local credential for profile P because cloud decrypt failed
       unless user explicitly removed P
  persist local; dual-write only additive/upsert of known-good credentials

dual-write(state):
  upsert user_services / profiles present in state
  upsert encrypted_credentials only when credential values present
  DO NOT delete cloud encrypted_credentials for “missing in this payload”
  DO NOT delete user_services not present in this payload (except explicit remove-service API)
```

### Normative Discover visibility

```text
Catalog query for authenticated user U:
  INCLUDE: service_registry where owner_user_id IS NULL
           AND source_type IN (built_in, admin, approved_global)
           AND service_status allows discovery
  INCLUDE: service_registry where owner_user_id = U.id AND source_type = user
  EXCLUDE: other users’ private customs
Digital Home tiles: only U’s user_services (and U’s vault selection for that userId)
```

### Normative registration atomicity

```text
Validate + pending guard
  → Auth signUp
  → public.users profile (role=user)
  → unlock/create vault namespace for new userId (empty selection)
  → On failure: no success UI; rollback/incomplete path
```

## Constraints / Non-Negotiables
- Failed login never creates a user (AC-109-2).
- Users only via explicit registration (AC-109-3).
- No `signInAnonymously()` in production Hub paths (AC-109-30).
- **One user-facing password; no Master Password screen** (AC-109-32).
- **Lock = logout → Login** (AC-109-24).
- **Admin URL shows Login when unauthenticated** (D-109-22).
- **No cross-user workspace leak** (AC-109-36); vault storage scoped by `userId` (D-109-23).
- **Same user Chrome↔Edge must show the same Digital Home after login** via cloud hydrate (AC-109-17, AC-109-38, D-109-24).
- **Never wipe a non-empty workspace via empty/partial hydrate or destructive dual-write** (AC-109-39, D-109-25).
- **Private customs only for owner** in Discover (AC-109-37).
- Ownership only via `userId`; RLS; ADR-002 ciphertext client-side.
- No subscription/billing; no MFA in this phase.
- Passwords/tokens/keys never in logs (AC-109-26).
- Build passes (AC-109-35).

## Technical Boundaries / Out of Scope
- MFA / 2FA (Phase 191+).
- Subscription/billing (151+).
- Password recovery, passkeys, social login.
- Redesigning AES/KDF algorithms (reuse existing vault APIs; change **storage keying** only).
- Phase 108 discovery heuristic fixes.
- Admin self-promotion UI.
- Silent merge of unintended users’ data into another account.

## Dependencies and Interfaces

### Target modules (Developer)

| Module | Responsibility |
|--------|----------------|
| `src/auth/` | Login, register, session, `requireAuthenticatedUserId` |
| Auth entry UI | Login / Create Account; drives vault unlock for **current userId** |
| Admin gate + Admin Login | D-109-22 |
| `src/vault/*` | **Namespace persisted vault by userId**; clear memory on switch |
| `src/App.tsx` | On auth success/logout: reset UI state; load only current user workspace; **await hydrate before paint** |
| `src/supabase/persistence.ts` (or `src/workspace/`) | Dual-write **and** hydrate (D-109-24) **with anti-wipe** (D-109-25): no `deleteEncryptedCredential` on missing payload values |
| Catalog / registry loader | Discover filter per D-109-23 / AC-109-37 |
| `docs/MIGRATION_PHASE_109.md` | Coupling; lock=logout; admin bookmark; userId vault; **Chrome↔Edge hydrate** |
| `scripts/verifyPhase109Accounts.mjs` | userId vault namespace; hydrate helper exists; Discover filters |

## Data / State Considerations
- Local vault ciphertext remains device-local and Zero-Knowledge; **one blob (or key prefix) per `userId`**.
- New account on a device that previously held another user’s vault: start empty for the new `userId` — do not inherit prior `selectedIds` / customs.
- Cloud `user_services` / profiles / credentials remain RLS-scoped; client must not overlay another user’s local selection on top.
- Dual-write era: push local→cloud on save; **hydrate cloud→local on login** when online (D-109-24). Cloud membership wins **only when cloud selection is non-empty**; never empty-win over local (D-109-25). Dual-write upserts only; no delete of cloud credentials/`user_services` on partial payloads.

## Security / Privacy Considerations
- Cross-account UI leak is a **privacy defect** even if RLS would block server reads — treat AC-109-36 as a hard gate.
- Same password across two accounts does not authorize shared vault storage.
- Single-password tradeoff (Auth + KDF) remains; MFA later (191).

## Testing and Lint Expectations
- Build + `verifyPhase109Accounts.mjs` PASS (userId vault + hydrate path + discover filters).
- **Manual hard gate (cross-user):** User A then User B on one browser — no leak (AC-109-36/37).
- **Manual hard gate (durability):** Populate Home → simulate offline / reconnect / re-login → services+passwords still present (AC-109-39). Repeat for an `is_admin` user — same expectation.
- Phase 103/108 static regression as applicable.

## Functional Testability

- **Screens:** Auth; Digital Home; Manage/Discover — each user’s personal area.
- **Cross-user:** A’s workspace never appears for B.
- **Cross-browser:** Chrome and Edge for the same user show the same Home after Login + hydrate.
- **Discover:** globals for all; private customs owner-only.
- **E2E:** Register B on device used by A → empty or B-only Home; Discover without A’s customs.

## Handoff Notes for Manager

1. Sync `manager-phase109.md` with **D-109-23/24/25** and **AC-109-36/37/38/39**.
2. Operator Chrome≠Edge empty Home → hydrate (D-109-24). Operator outage data-loss (admin Home wiped) → **anti-wipe** (D-109-25); do not blame `is_admin` without evidence.
3. Developer must: fix destructive `deleteEncryptedCredential` on empty payload sync; hydrate must not empty-win over local; evidence reconnect/outage UAT.
4. Keep prior amendments (single password, Admin Login, isolation, hydrate, no MFA).
5. Phase 110 does not own this fix — schedule under Phase 109 correction even if PHASE.md is 110.

## Architect Review
ARCHITECT_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
_Operator 2026-07-13: after internet drop, non-admin retained Home; admin user lost services+passwords. Architecture: not “admin clears Home”; likely destructive sync/hydrate or cloud never durable + local cache loss. D-109-25 / AC-109-39 added._

### Required Corrections
_Manager sync; Developer: anti-wipe dual-write + hydrate; verify outage/reconnect does not blank a populated workspace._
