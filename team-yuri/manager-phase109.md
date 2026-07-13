# Manager Phase 109

## Phase Identifier
PHASE=109

## Status
STATUS: READY_FOR_DEVELOPER

## Architecture Amendments (2026-07-13)

**Amendment A — Single Digital Home password.** Removes the second “Master Password / vault unlock” door. Login/Create Account unlocks or creates the local vault with the **same** password in one step. Vault lock / global lock = **full logout** → Login screen (AC-109-24). Ban dual-door trust copy (“סיסמת מאסטר נפרדת…”). AC-109-32 documents **single-password coupling** + MFA deferred to Phase 191 — **not** password split. **No MFA in Phase 109.**

**Amendment B — Admin Login on `#/admin` (D-109-22).** When `AdminGate` has no email session, show **Login** (reuse Auth Login; same Digital Home password), then re-check `is_admin` / `role`. Do **not** only show “denied — go to home”. After SQL promote, refresh/re-login must pick up admin. **One SPA deploy;** admin is `#/admin` (and/or `/admin`) bookmark — **not** a second deployment.

**Amendment C — Client workspace isolation (D-109-23; AC-109-36/37).** Operator report: new user saw previous user’s Digital Home / Manage. **Local vault / IndexedDB MUST be keyed by authenticated `userId`.** Same password on two accounts must not open the other workspace. Clear prior in-memory vault/UI on login/register/logout/switch. Discover = global catalog (`built_in`, `admin`, `approved_global`) for all + **own** `source_type=user` customs only. **Hard gate before approval:** two users on one browser — B must not see A’s Home/Manage; Discover must not list A’s private customs.

**Required corrections before approval:**
1. Dual-door UX — reverse to single password + lock=logout.
2. Admin unauthenticated path — Admin Login on `#/admin` (not deny-only).
3. **Cross-user workspace leak** — userId-scoped vault + clear-on-switch + Discover visibility (D-109-23).

## Phase Goal
Deliver a **production-ready user account and authentication foundation**: explicit Login and Create Account flows, **one user-facing Digital Home password**, one immutable authenticated `userId`, database-enforced user isolation, **client workspace isolation per `userId`**, session restore/logout, Chrome and Edge account continuity, and an audited cleanup path for unintended anonymous users — **without** a second vault-password screen, without redesigning Vault crypto algorithms, execution, or registry discovery, and without subscription/billing or MFA.

Phase 109 owns the **account shell** that future subscription (151), MFA/session hardening (191), and vault/account security (192) extend. It stops anonymous user proliferation, dual-door UX, and **cross-account workspace leakage** on shared browsers.

## Source References
- `team-Yuri/arch-phase109.md` (AMENDED 2026-07-13 — single password + D-109-22 + **D-109-23 workspace isolation**)
- `team-Yuri/PLAN.md` §18 — Ownership Authority; Client workspace isolation; Catalog/Discover visibility; AC-109-1 … AC-109-37
- `team-Yuri/PHASE.md` — `PHASE=109`
- `docs/DECISIONS.md` — ADR-002
- `team-Yuri/arch-phase107.md` — `AdminGate` / `is_admin()`
- `team-Yuri/arch-phase108.md` — regression only; Phase 108 M11 out of scope
- `src/vault/vault.ts` — KDF unchanged; **storage must be userId-namespaced**
- `src/App.tsx` — clear prior user in-memory state on auth switch
- `team-Yuri/dev-phase109.md` — prior dual-door + isolation fixes required

## Parallel-track note — Phase 108 M11
Phase 108 live discovery (M11) may still be open. Phase 109 must not own discovery fixes. Re-run Phase 103/108 static gates as regression only.

## Architecture Summary (Phase 109 constraints)
- **Explicit Auth entry — single password (D-109-1):** Login | Create Account only; no Master Password door.
- **Single Digital Home password (D-109-2, AC-109-32):** Auth + vault KDF same password in one step; document coupling + MFA deferral.
- **Kill anonymous create (D-109-3):** No `signInAnonymously` / `ensureAnonymousUserId`.
- **Login + vault in one step (D-109-8):** For **this** `userId` namespace only.
- **Lock = logout (D-109-12, AC-109-24):** Clear session + in-memory vault → Login.
- **Ban dual-door trust copy.**
- **MFA deferred (D-109-21).**
- **Admin Login (D-109-22):** `#/admin` Login when unauthenticated; one SPA bookmark.
- **Client workspace isolation (D-109-23, AC-109-36/37):** Local vault/IndexedDB **keyed by `userId`**. Same password across two accounts must not share workspace. Clear prior `VaultState`/UI on login/register/logout/switch. Digital Home + Manage = current user only. Discover = globals for all + own private customs only.
- Profile schema, email uniqueness, atomic registration, RLS, Chrome/Edge, audit, no subscription/billing — as prior.

### Normative entry / session flow

```text
App load (Digital Home)
  → no usable session OR vault key missing?
       YES → Auth entry (Login | Create Account)
       NO  → load vault namespace for auth.uid() only → route by THAT user’s user_services

App load (#/admin or /admin)
  → no email session? → Admin Login (same password)
  → session ok → is_admin? → Admin shell : friendly deny

Login / Create Account (email + Digital Home password)
  → authenticate / register (never anonymous create)
  → clear any previous user’s in-memory vault/UI state
  → unlock/create vault blob for THIS userId with the same password
  → load THIS user’s user_services / profiles / credentials only
  → route

Vault lock / Logout
  → auth.signOut + lockVault + clear in-memory workspace → Auth Login
```

### Normative Discover visibility (AC-109-37)

```text
INCLUDE: owner_user_id IS NULL AND source_type IN (built_in, admin, approved_global)
INCLUDE: owner_user_id = auth.uid() AND source_type = user
EXCLUDE: other users’ private customs
Digital Home: only current user’s user_services / vault selection for that userId
```

## Acceptance / Gating Criteria (verbatim — PLAN §18)

| ID | Criterion |
|---|---|
| AC-109-1 | The entry screen provides clearly separate Login and Create Account flows |
| AC-109-2 | Entering an unknown email or incorrect password never creates a user |
| AC-109-3 | A user is created only through successful explicit registration |
| AC-109-4 | Registration collects first name, last name, email, phone, password and password confirmation |
| AC-109-5 | Every registered user receives one stable immutable user identifier |
| AC-109-6 | Normalized email uniqueness is enforced by the database |
| AC-109-7 | Repeated registration submissions do not create duplicate authentication or profile records |
| AC-109-8 | A linked row is created in the existing application users table for every successful registration |
| AC-109-9 | Failed profile persistence does not produce an apparently successful but incomplete account |
| AC-109-10 | Login authenticates existing users without modifying or recreating their identity |
| AC-109-11 | Successful authentication restores the correct user-owned services, profiles and encrypted credential records |
| AC-109-12 | Users cannot read, update or delete data owned by another user |
| AC-109-13 | User isolation is enforced by database authorization rules, not only by UI filtering |
| AC-109-14 | Users with persisted selected services are routed to Digital Home |
| AC-109-15 | Users without persisted selected services are routed to Service Management / Add Services |
| AC-109-16 | Digital Home derives the authenticated user’s services from persisted `user_services` state |
| AC-109-17 | The same account and Digital Home data are available after login from supported Chrome and Edge browsers |
| AC-109-18 | Changing browsers does not create a new user |
| AC-109-19 | Login and Digital Home remain usable when the browser extension is unavailable, with extension-dependent functions degrading gracefully |
| AC-109-20 | Registration always assigns the normal user role |
| AC-109-21 | Administrator role can be assigned or removed only through protected database/server-side administration |
| AC-109-22 | Client-side manipulation cannot grant administrator access |
| AC-109-23 | Session state survives a normal page refresh without creating a new user |
| AC-109-24 | Logout and vault lock both clear authenticated and decrypted in-memory state, return to the Login screen, and do not delete persisted account data |
| AC-109-25 | Authentication errors are friendly and do not expose technical internals |
| AC-109-26 | Passwords, tokens, decrypted credentials and encryption keys never appear in logs |
| AC-109-27 | Offline or failed registration does not create a phantom local-only account |
| AC-109-28 | The existing unintended user records are audited before cleanup |
| AC-109-29 | Data-bearing unintended users are not deleted or reassigned silently |
| AC-109-30 | After migration, arbitrary password entry no longer increases the database user count |
| AC-109-31 | The temporary relaxed password policy is development-configured and cannot be mistaken for the production policy |
| AC-109-32 | One user-facing Digital Home password: Login/Create Account unlocks or creates the local vault in the same step; no separate Master Password screen; lock returns to Login; coupling and MFA deferral are documented |
| AC-109-33 | Existing functionality delivered through Phase 108 passes regression testing |
| AC-109-34 | Validated Shufersal and Clalit behavior remains preserved |
| AC-109-35 | Build passes |
| AC-109-36 | After login or registration, Digital Home and Service Management show only the authenticated user’s workspace — never another user’s selections, profiles, or credentials (client vault/storage must be scoped by `userId`) |
| AC-109-37 | Discover / Add Services lists global catalog services (`built_in`, `admin`, `approved_global`) for all users, and lists private user-created custom services only for the owning user |

## AC → Milestone → Verify Script Mapping

| AC | Primary milestone(s) | Static / SQL verify | Manual UAT |
|---|---|---|---|
| AC-109-1 | M4 | `verifyPhase109Accounts.mjs` | Login \| Create Account only |
| AC-109-2 | M1, M3, M7 | No anonymous create; user-count UAT | Failed login count stable |
| AC-109-3 | M3, M4 | Registration path only | Register creates; login does not |
| AC-109-4 | M4 | Form fields | Registration form |
| AC-109-5…13 | M2, M3 | Schema + RLS | As prior |
| AC-109-14…16 | M6 | Routing | Home vs Manage |
| AC-109-17…19 | M9 | — | Chrome↔Edge; extension off |
| AC-109-20…22 | M2, M5, M10 | role=user; client cannot set role; AdminGate | Bootstrap SQL; **Admin Login on `#/admin`** (D-109-22) |
| AC-109-23 | M5 | — | Refresh → Login if vault key gone (same password once) |
| AC-109-24 | M4, M5 | Lock→logout path in verify | Lock **and** logout → Login |
| AC-109-25…27 | M3, M4 | — | Friendly errors; no phantom |
| AC-109-28…30 | M1, M7, M8 | Audit + kill anonymous | Empty-only cleanup |
| AC-109-31 | M10 | Dev config isolation | Docs |
| AC-109-32 | M4, M10 | Docs: coupling + MFA deferral; **no dual-door** | One password → Home; no UnlockScreen |
| AC-109-33…35 | M10 | Phase 103/108 static + build | Regression |
| **AC-109-36** | **M4, M7, M11** | userId vault namespace in verify | **Two-user UAT: B ≠ A’s Home/Manage** |
| **AC-109-37** | **M6, M11** | Discover filter assertions | Globals for all; own customs only |

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| M1 | Auth audit + kill anonymous design | Root cause + call-site inventory; `requireAuthenticatedUserId` design | Documented in `dev-phase109.md` | AC-109-2, AC-109-30 |
| M2 | Schema: profile, email unique, role/status | Migration; UNIQUE email; role↔is_admin; client cannot set role | Migration applied | AC-109-5, AC-109-6, AC-109-12, AC-109-13, AC-109-20…22 |
| M3 | Registration atomicity + login | Auth + profile atomic; login never creates; then same-password vault in M4 path | User-count stable on fail | AC-109-2, AC-109-3, AC-109-7…10 |
| **M4** | **Auth UI + vault in one step** | Same password unlocks/creates **this userId’s** vault namespace; remove second door; clear prior user memory on success | One password → Home/Manage; no Master Password screen | AC-109-1, AC-109-4, AC-109-24, AC-109-25, AC-109-32, **AC-109-36** |
| M5 | Session / lock=logout / Admin Login | Refresh + lock=logout; `#/admin` Login then `is_admin` | Lock→Login; Admin Login not deny-only | AC-109-23, AC-109-24, AC-109-20…22 |
| M6 | Post-auth routing + Discover visibility | Route by `user_services`; Discover globals + own customs only | Routing + AC-109-37 | AC-109-14…16, **AC-109-37** |
| M7 | Replace anonymous call sites | Kill `ensureAnonymousUserId` | verify PASS | AC-109-2, AC-109-3, AC-109-30 |
| M8 | Unintended-user audit + cleanup | Audit; empty-only delete | Audit evidence | AC-109-28…30 |
| M9 | Chrome + Edge continuity UAT | Same account both browsers; extension-unavailable OK | UAT PASS | AC-109-17…19 |
| M10 | Docs + verify + regression + build | Coupling + admin bookmark + **userId vault namespaces**; verify + Phase 103/108 static + build | Scripts + build PASS | AC-109-31…35 |
| **M11** | **Client workspace isolation hard gate** | userId-scoped vault; clear-on-switch; two-user UAT on one browser | **B never sees A’s Home/Manage; Discover excludes A’s customs** | **AC-109-36, AC-109-37** |

## Hard Gates (Manager approval blockers)

### H1 — Failed login never creates users (AC-109-2, AC-109-30)
Wrong password / unknown email → friendly error; user counts unchanged.

### H2 — Kill anonymous production path (AC-109-3, AC-109-30)
No production `signInAnonymously` / `ensureAnonymousUserId`.

### H3 — Single Digital Home password (AC-109-32) — **amended**
- Login/Create Account unlocks or creates vault **in the same step** with the same password.
- **No** separate Master Password / vault-unlock screen.
- **No** dual-door trust copy (“סיסמת מאסטר נפרדת…”).
- Docs describe **coupling + tradeoff + MFA deferred to Phase 191** — not password split.
- If dual-door already shipped → **required correction** before approval.

### H4 — Lock = logout (AC-109-24)
Vault lock / global lock clears auth session + decrypted vault state and returns to **Login**. No authenticated+locked mid-state.

### H5 — Unintended-user audit before cleanup (AC-109-28, AC-109-29)
Audit first; empty-only auto-delete; no silent merge of data-bearing rows.

### H6 — Chrome + Edge + extension-unavailable (AC-109-17…19)
Same account continuity; login + Digital Home without extension.

### H7 — No MFA / no subscription in Phase 109
MFA is Phase 191+; no billing/entitlements.

### H8 — Admin Login on `#/admin` (D-109-22)
- Unauthenticated `#/admin` → **Login** then `is_admin`/`role` check — not deny-only.
- SQL promote + refresh/re-login picks up admin.
- One SPA deploy; `#/admin` bookmark documented.

### H9 — Client workspace isolation (D-109-23, AC-109-36/37) — **HARD GATE**
**Manager will not approve Phase 109 without this evidence.**

| Requirement | Expected |
|---|---|
| Vault storage | Local vault ciphertext / IndexedDB (or equivalent) **namespaced by `userId`** |
| Same password, two accounts | Must **not** load the other account’s `selectedIds`, customs, profiles, or credentials |
| Clear-on-switch | Login / register / logout clears previous user’s in-memory `VaultState` / UI before loading the new namespace |
| Two-user UAT (one browser) | User A has selections + private custom → logout → User B register/login → **B must not see A’s Digital Home or Manage selections**; Discover shows globals + **B’s own customs only** (not A’s) |
| Verify script | Assert userId-scoped vault API / storage keying + Discover filter helpers |

Do **not** “fix” by sharing one vault when passwords match.

## Required Correction (dual-door already shipped)

Developer evidence currently claims M4 as Auth + separate Master Password unlock and H3 as “Account ≠ Master Password”. **That is obsolete and must be reversed:**

| Remove / stop | Replace with |
|---|---|
| Post-auth `UnlockScreen` as standing Master Password door | Vault unlock/create inside Login/Create Account success path |
| Trust copy claiming separate master password | Single Digital Home password messaging |
| `docs/MIGRATION_PHASE_109.md` “Account ≠ Master Password” section | Coupling + lock=logout + MFA deferral |
| Global vault chrome lock → unlock-only | Lock → full logout → Login |
| `verifyPhase109Accounts.mjs` expecting password split | Assert **no** dual unlock screen; lock→login path |
| `AdminGate` deny-only when unauthenticated | Show Admin Login first; then `is_admin` / `role` check |
| Device-global vault / User B sees User A Home | **userId-scoped vault** + clear-on-switch + Discover filter (D-109-23) |

Update `dev-phase109.md` accordingly before Manager re-review.

## Detailed Development Plan

### M1 — Auth audit + kill anonymous design
Document root cause and call sites; design `requireAuthenticatedUserId()`.

### M2 — Schema migration
Profile columns, UNIQUE `email_normalized`, role/status/`deleted`, role↔`is_admin`; registration trigger/RPC `role=user`.

### M3 — Registration + login (auth identity)
Atomic Auth + profile; login never creates users; prove AC-109-2 with counts.

### M4 — Auth UI + vault unlock/create in one step (**correction focus**)
- Auth entry: Login | Create Account only.
- On success: clear prior user memory → unlock/create vault for **THIS `userId`** with the same password → route.
- Retire post-auth Master Password `UnlockScreen`.
- Scrub dual-door trust copy; wire lock → logout.

### M5 — Session / lock = logout / Admin Login (D-109-22)
- Refresh with missing vault key → Login; lock/logout → Login.
- `#/admin` unauthenticated → Admin Login → re-check `is_admin`/`role`.
- SQL promote → refresh/re-login picks up admin.

### M6 — Post-auth routing + Discover visibility (AC-109-37)
- `user_services` non-empty → Digital Home; else Manage (current user only).
- Discover/catalog loader: include globals (`built_in`, `admin`, `approved_global`); include private customs only when `owner_user_id = auth.uid()`; **never** list other users’ customs.

### M7 — Replace all anonymous call sites
Kill `ensureAnonymousUserId` everywhere.

### M8 — Unintended-user audit + cleanup
Audit → empty-only delete; no silent merge.

### M9 — Chrome + Edge continuity UAT
| # | Scenario | Expected |
|---:|---|---|
| C1 | Register (one password) | Account + vault ready → Home/Manage **without** second password screen |
| C2 | Login Edge same account | Same `userId` / Home |
| C3 | Wrong password | User count unchanged |
| C4 | Extension off | Login + Home usable |
| C5 | Vault lock / global lock | Returns to **Login** |
| C6 | Logout | Same as lock for session clear; data retained |
| A1 | Open `#/admin` logged out | **Admin Login** shown (not deny-only) |
| A2 | Login non-admin on `#/admin` | Friendly deny + link home |
| A3 | Login admin on `#/admin` | Admin shell |
| A4 | SQL promote then refresh/re-login | Admin access picked up |
| A5 | Docs / operator note | One SPA deploy; `#/admin` bookmark |
| I1 | Two users one browser (M11) | B never sees A’s Home/Manage; Discover excludes A’s customs |

### M10 — Docs, verify, regression, build
**Docs** `docs/MIGRATION_PHASE_109.md` must cover:
- Single Digital Home password coupling (Auth + vault KDF)
- Security tradeoff; MFA deferred to Phase 191
- Lock = logout
- Admin access (D-109-22): one Hub deploy; `#/admin` bookmark
- **Client workspace isolation (D-109-23):** userId-scoped vault; Discover visibility; clear-on-switch
- Dev vs production password policy; cleanup; bootstrap admin

**`scripts/verifyPhase109Accounts.mjs`** must prove:
- Auth Login / Create Account; no dual unlock door; lock→Login
- AdminGate Login when unauthenticated
- No production anonymous ensure; client cannot set role
- **userId-scoped vault storage / API**
- **Discover filter** (globals + own customs only)
- Docs reference coupling + admin bookmark + vault namespaces

**Regression:** `verifyPhase103Execution.mjs` PASS; Phase 108 static as applicable; `npm run build` PASS.

### M11 — Client workspace isolation hard gate (D-109-23) — **REQUIRED**
1. Implement vault persistence namespaced by authenticated `userId` (KDF algorithms unchanged).
2. On every auth success / logout: clear previous in-memory workspace before loading the new one.
3. Enforce Discover visibility (AC-109-37).
4. **Live two-user UAT on one browser** (document in `dev-phase109.md`):

| Step | Action | Expected |
|---:|---|---|
| 1 | User A: register/login; add selection + private custom service | A’s Home/Manage show A’s data |
| 2 | Logout | Login screen; memory cleared |
| 3 | User B: register or login (may use same password string) | B’s workspace only |
| 4 | Inspect Digital Home | **No** A tiles/selections |
| 5 | Inspect Manage / Discover | Globals visible; **A’s private custom absent**; B’s own customs only if B added any |

Without Pass on steps 3–5, Phase 109 is **not** approvable.

## Functional Test Matrix

| # | Test | Expected | AC |
|---:|---|---|---|
| T1 | Auth entry modes | Login \| Create Account only | AC-109-1 |
| T2 | Wrong password | Friendly error; count unchanged | AC-109-2, AC-109-30 |
| T3 | Register one password | Vault for **this userId**; no UnlockScreen | AC-109-3, AC-109-32 |
| T4 | Login one password | Home/Manage without second door | AC-109-10, AC-109-11, AC-109-32 |
| T5 | Dual-door copy absent | No “סיסמת מאסטר נפרדת…” | AC-109-32 |
| T6 | Vault lock | → Login; session cleared | AC-109-24 |
| T7 | Logout | → Login; data retained | AC-109-24 |
| T8 | Refresh without vault key | Login (same password once) | AC-109-23, AC-109-32 |
| T9–T21 | Isolation, routing, role, audit, Chrome/Edge | As prior | AC-109-5…22, 25…31 |
| T22 | verifyPhase109Accounts | PASS (incl. userId vault + Discover) | — |
| T23 | verifyPhase103Execution | PASS | AC-109-34 |
| T24 | Phase 108 static | PASS as applicable | AC-109-33 |
| T25 | Build | PASS | AC-109-35 |
| T26 | No MFA shipped | Affirmation | D-109-21 |
| T27 | `#/admin` logged out | Admin Login (not deny-only) | D-109-22 |
| T28 | `#/admin` non-admin | Friendly deny + link home | AC-109-20…22 |
| T29 | `#/admin` after SQL promote | Admin shell | AC-109-21 |
| T30 | One SPA deploy docs | `#/admin` bookmark | D-109-22 |
| **T31** | **Two-user Home isolation** | B does not see A’s Digital Home | **AC-109-36** |
| **T32** | **Two-user Manage isolation** | B does not see A’s selections | **AC-109-36** |
| **T33** | **Discover private customs** | A’s custom absent for B; globals present | **AC-109-37** |
| **T34** | **Same password, two accounts** | Still isolated workspaces | **AC-109-36** |

**Critical:** T3–T6, T22, T27–T30; **T31–T34 (workspace isolation hard gate)**.

## Required Developer Evidence
`team-Yuri/dev-phase109.md` must include:

| Evidence area | Required content |
|---|---|
| Dual-door correction | Second door removed |
| M4 one-step auth→vault | Same password; **this userId** namespace |
| AC-109-24 | Lock and logout → Login |
| AC-109-32 docs | Coupling + MFA deferral |
| **D-109-22 Admin Login** | A1–A5 UAT |
| **D-109-23 / M11** | userId-scoped vault; clear-on-switch; **two-user UAT Pass (T31–T34)** |
| **AC-109-36/37** | Explicit Pass with observations |
| `verifyPhase109Accounts.mjs` | PASS (vault namespace + Discover filter) |
| Phase 103 / 108 static | PASS as applicable |
| Build | PASS |
| Scope | No MFA; no shared vault when passwords match |

## Out of Scope
- MFA / 2FA (Phase 191+)
- Subscription/billing (151+)
- Password recovery, passkeys, social login
- Redesigning AES/KDF algorithms (storage keying only)
- Phase 108 discovery / M11 live U22
- Standing second Master Password door
- Second admin deployment / separate admin password
- Sharing one vault across accounts when passwords match
- Silent merge of data-bearing unintended users
- Advertising admin in end-user primary nav

## Risks / Open Questions
- Device-global vault under single-password is the confirmed cross-user leak — M11 is mandatory.
- Incomplete M4 / UnlockScreen left reachable blocks approval.
- AdminGate deny-only blocks operators — D-109-22 mandatory.
- Migrating existing single-blob vaults: document how prior device data maps (or starts empty per new userId).

## Manager Review
MANAGER_REVIEW_STATUS: REJECTED

### Review Notes
- Synced **D-109-23** + **AC-109-36/37** (2026-07-13 workspace isolation).
- Operator cross-user Digital Home leak is an architecture-confirmed defect — **H9 / M11 hard gate**.
- Phase approval blocked until: single-password + Admin Login + **two-user isolation UAT Pass** + verify evidence.

### Required Corrections
1. Single Digital Home password; remove Master Password door; lock=logout.
2. Ban dual-door trust copy; docs = coupling + MFA deferral.
3. D-109-22 Admin Login on `#/admin`.
4. **D-109-23:** userId-scoped local vault; clear-on-switch; Discover = globals + own customs only.
5. Evidence: two users on one browser — B must not see A’s Home/Manage; A’s private custom absent from B’s Discover.
6. Update `verifyPhase109Accounts.mjs` + `dev-phase109.md`.
7. No MFA; do not share one vault when passwords match.
