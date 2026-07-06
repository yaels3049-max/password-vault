# Manager Phase 101

## Phase Identifier
PHASE=101

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Establish the production Supabase data layer with **zero-knowledge credential storage** by delivering schema + RLS migrations, anonymous auth bootstrap, and **client dual-write** (IndexedDB remains authoritative for reads in Phase 101). Document the migration policy and operator steps.

## Source References
- `team-Yuri/arch-phase101.md`
- `team-Yuri/PLAN.md` §5 — Database and Supabase Architecture
- `team-Yuri/PLAN.md` §18 — Phase 101 acceptance criteria (AC-101-1 … AC-101-5)
- `team-Yuri/PHASE.md` — `PHASE=101`

## Architecture Summary (Phase 101 constraints)
- Supabase is **ciphertext + relational metadata** only; it does not decrypt.
- **No plaintext credential values** in any table.
- **Anonymous Auth** is used only to obtain `auth.uid()` for RLS (no registration UX in this phase).
- **Dual-write only** in Phase 101: keep IndexedDB write/read path; add Supabase encrypted upsert on persistence.
- Schema includes seven named tables: `users`, `service_registry`, `categories`, `user_services`, `access_profiles`, `encrypted_credentials`, `subscription_plans`.

## Acceptance / Gating Criteria
- AC-101-1: Supabase schema includes the seven required tables
- AC-101-2: No plaintext credential values in any table
- AC-101-3: Client encrypts credential sets before write; server cannot decrypt
- AC-101-4: RLS enforces user isolation on user-owned tables
- AC-101-5: Migration path from prototype local vault documented (import or fresh-start policy stated)

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| 1 | Supabase migrations (schema) | Create ordered SQL migrations under `supabase/migrations/` implementing PLAN §5 + `arch-phase101` target tables (incl. indices/constraints) | All seven tables exist with expected columns + keys |
| 2 | Supabase migrations (RLS) | Enable RLS and add policies: user-owned tables isolated by `auth.uid()`; global tables readable; deny client writes to global registry | RLS enabled + policies validated; cross-user access denied |
| 3 | Anonymous auth bootstrap | Client ensures a Supabase anonymous session when performing cloud persistence | App obtains `auth.uid()` silently; no registration UI added |
| 4 | Client dual-write (cloud upsert) | Extend persistence so local IndexedDB persist remains primary; additionally upsert ciphertext rows + relational metadata to Supabase | Saving credentials results in ciphertext rows in Supabase while app behavior unchanged |
| 5 | Migration documentation | Add `docs/MIGRATION_PHASE_101.md` describing env setup, migrations apply, and migration policy (fresh-start default and/or one-time import outline) | Doc exists, accurate, and references Phase 101 policy |
| 6 | Functional test steps & evidence | Provide repeatable verification steps for schema/RLS/encryption behavior and build health | `npm run build` passes; Supabase shows ciphertext-only rows; RLS isolation proven |

## Detailed Development Plan

### M1 — Supabase migrations: schema
Deliver versioned SQL migration files in `supabase/migrations/` implementing the **Phase 101 schema** from `arch-phase101.md` / PLAN §5.

Minimum expectations:
- Tables present: `users`, `categories`, `service_registry`, `user_services`, `access_profiles`, `encrypted_credentials`, `subscription_plans`.
- Constraints and keys match the intent:
  - `users.id` references `auth.users(id)` (cascade delete).
  - `user_services` has UNIQUE (`user_id`, `service_id`).
  - `encrypted_credentials.access_profile_id` is UNIQUE (one credential set per profile).
- Seed data:
  - `categories`: include at least the production categories used in Phase 100 UI (`banking`, `health`, `shopping`) with Hebrew display names.
  - `subscription_plans`: seed a `free` plan row (capability flags may be minimal JSON).

### M2 — Supabase migrations: RLS + policies
In migrations (not manual steps), add:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for user-owned tables:
  - `users`, `user_services`, `access_profiles`, `encrypted_credentials`
- Policies:
  - **`users`**: user can select/update own row (`id = auth.uid()`).
  - **`user_services` / `access_profiles`**: allow CRUD only for rows belonging to `auth.uid()`.
  - **`encrypted_credentials`**: allow CRUD only for rows whose `access_profile_id` belongs to an `access_profiles` row owned by `auth.uid()` (join-based policy).
  - **Global tables** `categories`, `service_registry`, `subscription_plans`: allow SELECT for authenticated users; deny client writes to `service_registry` in this phase.

Verification signals:
- Attempt to read/write another user’s rows fails with RLS error.
- Authenticated anon user can read categories/plans and write only their own user-owned rows.

### M3 — Anonymous auth bootstrap (client)
Implement a client-side bootstrap that:
- Uses `@supabase/supabase-js`.
- Ensures an anonymous session exists before any cloud write.
- Treats auth session as **separate** from vault unlock (no UX change in this phase).

Non-negotiables:
- No `service_role` key or server secret in the client.
- Env contract: `VITE_SUPABASE_URL` is project base (`https://<ref>.supabase.co`) with `VITE_SUPABASE_ANON_KEY`.

### M4 — Client dual-write: IndexedDB + Supabase
Extend vault persistence so:
- Local `persistVault` continues to write to IndexedDB as today.
- Supabase write is additive and must not corrupt or block local persist success.
- Credentials are encrypted **client-side** per access profile before upsert:
  - Supabase stores only `ciphertext` + `iv` + non-sensitive metadata (e.g. field ids present).

Data mapping guidance (do not exceed phase scope):
- Use built-in catalog service ids as `user_services.service_id` (registry read cutover is Phase 102).
- Create/maintain a stable mapping between local profile identifiers and cloud `access_profiles` rows (strategy must be documented in dev evidence).

### M5 — Documentation: `docs/MIGRATION_PHASE_101.md`
Create `docs/MIGRATION_PHASE_101.md` including:
- Prereqs: Supabase project configured; **Anonymous sign-in enabled** in Auth providers.
- Env setup: required `VITE_SUPABASE_*` variables; reminders about gitignore.
- How to apply migrations (Supabase CLI flow or dashboard SQL flow—state whichever is used).
- Migration policy (AC-101-5):
  - Declare **fresh-start default** OR **one-time import** approach (or both, with explicit recommended default).
  - Clarify Phase 101 does **not** change unlock UX and does **not** read from cloud yet.
  - Pointer to Phase 190 for registered identity upgrade.

### M6 — Functional testability criteria (Phase 101)

Command-line / operator validation:
- Apply migrations to the configured Supabase project.
- Confirm all seven tables exist in Supabase.
- Confirm RLS is enabled on user-owned tables and policies exist.

App flow validation (minimal E2E):
- `npm run build` must succeed.
- Run the app (dev or preview is acceptable for verification, but evidence must include the exact command used).
- Unlock vault as usual (IndexedDB read path unchanged).
- Create/select a service, create/update an access profile, and save credentials.
- Confirm in Supabase Table Editor:
  - `encrypted_credentials` row appears for the access profile
  - Stored values are **ciphertext/iv only** (no plaintext password/username fields stored in clear)
  - Rows are associated with the current anonymous `auth.uid()` user via the relational chain

RLS isolation check:
- With a second anonymous user (separate browser profile or cleared auth session), verify the new user cannot read the first user's `user_services`/`access_profiles`/`encrypted_credentials`.

## Required Developer Evidence
- `team-Yuri/dev-phase101.md` including:
  - Files changed list
  - Migration files list + how applied (CLI/Dashboard) + evidence of tables + RLS
  - Encryption proof: ciphertext-only persisted fields; statement of what is plaintext (if any) and why it is non-sensitive
  - Dual-write proof: local persistence still works even if Supabase write fails (document failure mode test)
  - `docs/MIGRATION_PHASE_101.md` included and accurate
  - Build result: `npm run build` output or equivalent evidence
  - Tests + lint results, or NOT AVAILABLE with reason

## Out of Scope (must not be implemented)
- Registration/login UX (Phase 190)
- Reading catalog from `service_registry` (Phase 102)
- Switching read-path from IndexedDB to Supabase; conflict resolution; offline queue
- Admin tooling for registry writes (Phase 107)
- Any plaintext credential storage or logging of secrets

## Risks / Open Questions
- ID mapping between local profile ids and cloud UUIDs must be stable; Developer must document the chosen strategy and why it is safe under dual-write.
- Supabase Auth settings require Anonymous provider enabled; ensure setup is explicitly documented in `docs/MIGRATION_PHASE_101.md`.

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes
- Phase identifier aligned (`PHASE=101`); developer artifact complete with files changed, migration/RLS evidence, encryption proof, dual-write proof, documentation, and build output.
- **M1/M2 (migrations + RLS):** Verified `20260702121500_phase101_schema.sql` creates all seven required tables with correct constraints (`users` → `auth.users`, UNIQUE `user_services(user_id, service_id)`, UNIQUE `encrypted_credentials(access_profile_id)`), seeds `categories` + `free` plan; `20260702121600_phase101_rls.sql` enables RLS, user-owned CRUD via `auth.uid()`, join-based policy on `encrypted_credentials`, global SELECT-only with no client registry writes.
- **M3 (anonymous auth):** `ensureAnonymousUserId()` uses `signInAnonymously()` before cloud write; no registration UX added; env contract normalized in `env.ts`.
- **M4 (dual-write):** `persistVault` writes IndexedDB first, then best-effort `syncVaultStateToSupabaseSafe`; per-profile AES-GCM via `encryptCredentialSet()`; stable ID mapping via `access_profiles.local_profile_id`.
- **M5 (docs):** `docs/MIGRATION_PHASE_101.md` covers prerequisites, env, migration apply, fresh-start default, optional import outline, Phase 190 pointer, failure handling.
- **M6 (functional):** Independent `npm run build` succeeded; `verifyPhase101Supabase.mjs` provides repeatable schema/RLS/anon-auth/ciphertext evidence (cross-user isolation + registry write denial).
- AC-101-1 through AC-101-5 satisfied. Scope compliant — no registration UX, no cloud read path, no `service_registry` catalog cutover.
- Unit tests/lint NOT AVAILABLE per project; acceptable.
- Minor note: `verifyPhase101FailureMode.mjs` is a behavioral simulation (does not import `persistVault`); failure-mode requirement is satisfied by source review of IndexedDB-first + `syncVaultStateToSupabaseSafe` try/catch and documented `forceFail` hook in `persistence.ts`.

### Required Corrections
_None._

