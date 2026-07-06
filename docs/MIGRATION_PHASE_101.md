# Phase 101 — Supabase migration and dual-write

This document describes how to configure Supabase for Phase 101: schema + RLS migrations, anonymous auth, and client dual-write (IndexedDB remains the read path).

## Prerequisites

1. **Supabase project** — project ref `wbehjoraatkrpsbgyunx` (or your own).
2. **Anonymous sign-in enabled** — Supabase Dashboard → **Authentication** → **Providers** → **Anonymous** → Enable.
3. **Node.js** and npm (certificate trust configured for your network if required).

## Environment variables

Create or update `.env.local` at the repository root (gitignored):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

**Important (D-101-8):** `VITE_SUPABASE_URL` must be the project base URL only — **no** `/rest/v1/` suffix.

Never commit `.env.local`. Do **not** put `service_role` or other secret keys in Vite env vars.

Optional test hook (dev only):

```env
VITE_PHASE101_FORCE_CLOUD_FAIL=true
```

When set, cloud dual-write throws after local IndexedDB persist succeeds (failure-mode verification).

## Apply migrations

Migration files (ordered):

1. `supabase/migrations/20260702121500_phase101_schema.sql` — seven tables + seed data
2. `supabase/migrations/20260702121600_phase101_rls.sql` — RLS policies

### Option A — Supabase CLI (recommended)

```bash
npx supabase link --project-ref wbehjoraatkrpsbgyunx
npx supabase db push
```

Provide the database password when prompted (Dashboard → Project Settings → Database).

### Option B — Supabase Dashboard SQL Editor

1. Open **SQL Editor** in the Supabase Dashboard.
2. Paste and run `20260702121500_phase101_schema.sql` in full.
3. Paste and run `20260702121600_phase101_rls.sql` in full.

### Verify schema

After apply, confirm these tables exist:

- `users`, `categories`, `service_registry`, `user_services`, `access_profiles`, `encrypted_credentials`, `subscription_plans`

Run the verification script:

```bash
node scripts/verifyPhase101Supabase.mjs
```

## Migration policy (AC-101-5)

### Default: fresh start in the cloud

- **New anonymous users** start with an empty cloud dataset.
- **Existing IndexedDB vaults** continue to work locally unchanged until the user unlocks and saves (dual-write runs on `persistVault`).
- Phase 101 does **not** read credentials from Supabase; IndexedDB is authoritative for unlock and display.
- No automatic merge of pre-existing local vault into cloud on first login.

### Optional one-time import (manual / dev)

A future dev script or Phase 190+ flow may import a local vault into cloud rows. For Phase 101:

1. Unlock vault locally.
2. Trigger any save (e.g. edit credentials) — dual-write upserts encrypted rows.
3. Confirm ciphertext rows in Dashboard → `encrypted_credentials`.

**Not supported in Phase 101:** conflict resolution, multi-device read, offline queue.

### Identity upgrade (Phase 190)

Anonymous `auth.uid()` sessions are interim. Registered login and identity migration are planned for Phase 190.

## App behavior (Phase 101)

| Concern | Behavior |
|---|---|
| Unlock | IndexedDB only (unchanged) |
| Read path | IndexedDB only |
| Write path | IndexedDB + best-effort Supabase upsert |
| Auth UX | None — silent `signInAnonymously()` on first cloud write |
| Credential storage in Postgres | Ciphertext + IV + field ids only |
| Plaintext in DB | Display names, service ids, category labels — never password/username values |

## Failure handling

If Supabase is unreachable or RLS rejects a write:

- Local `persistVault` **still succeeds** (IndexedDB).
- Cloud sync errors are logged in dev builds only.
- User-visible behavior is unchanged.

Test failure mode: set `VITE_PHASE101_FORCE_CLOUD_FAIL=true`, save credentials, reload and unlock — local data must persist.

## Security notes

- RLS isolates `users`, `user_services`, `access_profiles`, `encrypted_credentials` by `auth.uid()`.
- Global tables (`categories`, `subscription_plans`, `service_registry`) are SELECT-only for authenticated clients.
- Master password never leaves the client; Supabase cannot decrypt vault ciphertext.
