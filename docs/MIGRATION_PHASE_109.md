# Migration Guide — Phase 109 (Account & Authentication Foundation)

Phase 109 delivers an explicit **Login | Create Account** shell, one immutable authenticated `userId`, database profile/RLS isolation, session restore/logout, Chrome/Edge continuity, and an audited cleanup path for unintended anonymous users — **without** subscription/billing or MFA/recovery.

## Prerequisites

- Phases 101–108 migrations applied
- Hub: `npm run dev`
- Supabase project with **Email** auth provider enabled
- After Hub cutover is verified: disable **Anonymous** sign-in in Supabase Auth settings

## Apply migration

**Do not paste this markdown file into the Supabase SQL editor** — it is documentation only. Run the SQL migration files:

| Method | What to run |
|---|---|
| CLI | `supabase db push` |
| SQL Editor | Paste contents of each file in order (see below) |

1. `supabase/migrations/20260712200000_phase109_user_profile_auth.sql`
2. `supabase/migrations/20260713090000_phase109_user_number.sql` — human-friendly `#100+` display id
3. `supabase/migrations/20260713110000_phase109_harden_register_trigger.sql` — harden trigger for `user_number` (fixes Create Account after empty `users`)

Audit/cleanup (later, separate step) use:

- `scripts/sql/phase109_audit_unintended_users.sql`
- `scripts/sql/phase109_cleanup_empty_orphans.sql`

### Clean slate before retrying Create Account

```sql
delete from auth.users
where lower(email) = lower('levi7156279@gmail.com');

delete from public.users
where email_normalized = lower('levi7156279@gmail.com');
```

Also: **Authentication → Providers → Email → Confirm email = OFF** for local/dev.

Failed Create Account now shows `(פרטי פיתוח: …)` under the Hebrew error, and Console logs `[auth] register failed:`.

### Confirm email (common registration blocker)

If Create Account fails asking to confirm email, or seems to succeed then fail:

**Supabase Dashboard → Authentication → Providers → Email → disable “Confirm email”** for local/dev,  
or confirm the message and then use **Login**.

### If Create Account says “email already exists” but `public.users` is empty

Emptying `public.users` does **not** delete Supabase Auth identities. Check **Authentication → Users** (or `auth.users`).

Delete the leftover Auth user (Dashboard), or run the clean-slate SQL above.

Then register again. Hub also recovers automatically if you register with the **same password** as the orphan Auth user (recreates `public.users` without a second Auth row).

## User number vs UUID

| Field | Purpose |
|---|---|
| `users.id` (UUID) | = `auth.users.id` / `auth.uid()` — **ownership + RLS** (immutable) |
| `users.user_number` (starts at 100) | Human-friendly display id for operators (`#100`, `#101`, …) |

Do not use `user_number` as a foreign key or ownership key.

## Single Digital Home password (AC-109-32) — amended 2026-07-13

One user-facing password at **Login | Create Account**:

| Use | How |
|---|---|
| Supabase Auth | `signInWithPassword` / `signUp` with that password |
| Local vault KDF | `unlockVault(password)` / create vault **in the same step** |

**There is no second Master Password / Unlock screen.**

| Behavior | Expected |
|---|---|
| Login / Create Account | Auth success → unlock or create local vault with the **same** password → Home/Manage |
| Vault lock / global lock | Full logout (`signOut` + `lockVault`) → **Login** screen (AC-109-24) |
| Page refresh | Vault key is gone → **Login** (email may prefill); enter the Digital Home password once |
| New browser | Same account login restores cloud metadata; local vault is created/unlocked with that password on the device (ZK — ciphertext stays local) |

**Coupling tradeoff:** the Auth password and vault KDF secret are the same user-facing secret in Phase 109. The server never stores vault plaintext or keys. Architecture can later re-separate secrets and/or add MFA in **Phase 191+** without changing `userId`. **No MFA in Phase 109.**

Never log the Digital Home password, tokens, or vault keys.

Ban dual-door trust copy such as «סיסמת מאסטר נפרדת…».

## Development vs production account-password policy (AC-109-31)

| Environment | Policy |
|---|---|
| Development (`import.meta.env.DEV` / `isDevBuild()`) | Relaxed temporary minimum (length ≥ 6) — labeled in UI as development policy |
| Production | Stronger minimum (length ≥ 8, letter + digit) |

The development policy is **not** the production policy. Non-empty password is always required.

## Client workspace isolation (D-109-23, AC-109-36/37)

| Rule | Behavior |
|---|---|
| Vault storage | IndexedDB key `user:<auth.uid()>` — **not** a device-global `main` blob |
| Same password, two accounts | Opens **different** vault namespaces |
| Login / register / logout | Clears prior in-memory `VaultState` / catalog cache before loading the new user |
| Digital Home / Manage | Only the authenticated user’s selections for that `userId` |
| Discover | Globals (`built_in`, `admin`, `approved_global`) for all + **own** `source_type=user` customs only |

Legacy device-global vault id `main` (pre-109) is **not** auto-attached to new accounts — each user starts with an empty namespace until they save data.

### Two-user UAT (one browser) — required before phase approval

| Step | Action | Pass |
|---:|---|---|
| 1 | User A: register/login; add services + one private custom | A’s Home/Manage populated |
| 2 | Lock/logout | Login screen |
| 3 | User B: register/login (may use same password string) | B’s empty/own workspace only |
| 4 | B Digital Home / Manage | **Must not** show A’s selections |
| 5 | B Discover | Globals visible; **A’s private custom absent** |

## Bootstrap admin (SQL only — AC-109-21)

1. Register the admin person via **Create Account** on the Digital Home URL (role will be `user`).
2. Promote in SQL (service role / SQL editor):

```sql
-- Prefer the helper (requires an already-admin session) OR run as service role:
select set_config('app.allow_role_change', 'on', true);

update public.users
set role = 'admin',
    is_admin = true,
    updated_at = now()
where email_normalized = lower(trim('admin@example.com'));
```

Or:

```sql
select public.admin_set_user_role_by_email('admin@example.com', 'admin');
```

Demote with `'user'`. Client registration **cannot** set `role` / `is_admin`.

3. Open **`#/admin`** (or `/admin`) on the **same** Hub SPA URL → Login with the Digital Home password → admin shell.  
   After promote: **refresh** or **re-login** on the admin URL so `AdminGate` re-reads `public.users`.

## One SPA deploy — admin is a bookmark (D-109-22)

| Fact | Detail |
|---|---|
| Deployments | **One** Hub SPA (same origin as Digital Home) |
| Admin URL | Bookmark `#/admin` and/or `/admin` — **not** a second product deploy |
| Password | Same Digital Home password (no admin-only password) |
| Unauthenticated `#/admin` | Shows **Login** (reuse Auth Login) — not deny-only “go home” |
| After login | Re-check `role=admin` / `is_admin`; non-admin → friendly deny + link home |
| End-user nav | Does **not** advertise admin entry |

## Kill anonymous production path (AC-109-30)

Hub no longer calls `signInAnonymously()` / `ensureAnonymousUserId()`.
Cloud writes use `requireAuthenticatedUserId()` / `tryGetAuthenticatedUserId()`.

Operator step (after code deploy + smoke):

1. Supabase Dashboard → Authentication → Providers → **Anonymous** → disable
2. Confirm failed login does not increase `auth.users` / `public.users` counts

## Unintended-user audit + cleanup (AC-109-28, AC-109-29)

**Order is mandatory: audit → backup → empty-only delete → operator decisions for data-bearing.**

1. Run audit (read-only):

```bash
# In Supabase SQL editor / psql:
# scripts/sql/phase109_audit_unintended_users.sql
```

2. Export/classify results (`empty_orphan` vs `data_bearing`).
3. Empty-only cleanup preview:

```bash
# scripts/sql/phase109_cleanup_empty_orphans.sql
# Review count, then uncomment the DELETE after confirmation.
```

4. **Data-bearing rows:** do **not** auto-delete or silent-merge. Record an explicit operator decision (retain / manual migrate / later lifecycle).

## Post-auth routing

When an authenticated session exists, routing prefers cloud `user_services`:

- Non-empty → Digital Home
- Empty → Service Management / Add Services
- If cloud count unavailable → fall back to local vault `selectedIds`

## Chrome + Edge continuity (AC-109-17…19)

| Scenario | Expected |
|---|---|
| Register in Chrome | Auth + profile + vault unlocked with same password |
| Login same email in Edge | Same `userId`; same Digital Home cloud data; vault unlock/create with same password |
| Wrong password | Friendly error; user counts unchanged |
| Extension disabled | Login + Digital Home still work; autofill degrades |
| Refresh | → Login (email may prefill); same password once; no new user |
| Lock or Logout | Memory cleared → Login; account/ciphertext retained |

## Verify

```bash
node scripts/verifyPhase109Accounts.mjs
node scripts/verifyPhase103Execution.mjs
node scripts/verifyPhase108BrowserIntegration.mjs
node scripts/verifyPhase108CustomDiscovery.mjs
node scripts/verifyPhase108FalsePositiveGate.mjs
npm run build
```

## Out of scope (do not expect)

- Subscription / billing / entitlements
- MFA, passkeys, password recovery
- Phase 108 M11 live discovery heuristic work
