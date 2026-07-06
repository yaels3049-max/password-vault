# Architecture Phase 101

## Phase Identifier
PHASE=101

## Status
STATUS: APPROVED

## Phase Goal
Establish the production Supabase data layer with zero-knowledge credential storage: deploy schema and RLS, wire the client to encrypt before cloud write, and document migration from prototype IndexedDB — without registration UX (Phase 190) or catalog-from-registry cutover (Phase 102).

## Source References
- `team-Yuri/PLAN.md` §5 — Database and Supabase Architecture
- `team-Yuri/PLAN.md` §9 — Security and Zero-Knowledge Rules (S1–S2)
- `team-Yuri/PLAN.md` §10 — Synchronization Architecture (ciphertext-only; full multi-device sync deferred)
- `team-Yuri/PLAN.md` §18 — Phase 101 acceptance criteria (AC-101-1 … AC-101-5)
- `team-Yuri/arch-phase100.md` — APPROVED; production/dev boundary unchanged
- `src/vault/vault.ts`, `src/vault/crypto.ts`, `src/vault/db.ts` — current IndexedDB + Argon2id/AES-GCM vault
- `src/profile/accessProfileModel.ts` — Access Profile canon
- `.env.local` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (project `wbehjoraatkrpsbgyunx`; connectivity verified)

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-101-1: SQL migrations in `supabase/migrations/`** | Versioned, reviewable schema; standard Supabase workflow | Manager/Developer deliver ordered migration files; apply via Supabase CLI or Dashboard SQL |
| **D-101-2: Relational model aligned to PLAN §5** | AC-101-1 requires seven named tables | Normalized rows for profiles, selections, and per-profile ciphertext — not a single monolithic vault blob in Postgres |
| **D-101-3: Per-profile ciphertext in `encrypted_credentials`** | Matches vault keying (`credentials[profileId]`) and sync architecture §10 | One row per `access_profile_id`; credential field values never stored in clear text |
| **D-101-4: Access Profile display metadata may be plaintext in Postgres** | Names/defaults are not secrets (ADR-002); only credential material is encrypted | `access_profiles` stores `display_name`, `is_default`, etc.; secrets only in `encrypted_credentials.ciphertext` |
| **D-101-5: Interim identity via Supabase Anonymous Auth** | Phase 190 delivers registration UI; Phase 101 still requires `auth.uid()` for RLS (AC-101-4) | Client silently calls `signInAnonymously()` on first cloud persistence need; `users.id` = `auth.users.id`; no email/password product UX in this phase |
| **D-101-6: Dual-write persistence in Phase 101** | Minimize regression risk; IndexedDB unlock path is proven | `persistVault` continues IndexedDB write; adds encrypted Supabase upsert; **read path stays IndexedDB** in this phase |
| **D-101-7: `service_registry` + `categories` schema-only seed** | Catalog load from registry is Phase 102 | Migrations create tables + seed `categories`; optional minimal registry seed acceptable; app continues built-in TypeScript catalog |
| **D-101-8: Env contract** | Prior connectivity test used wrong URL suffix | `VITE_SUPABASE_URL` = project base only (`https://<ref>.supabase.co`); client library adds `/rest/v1/` |
| **D-101-9: Publishable key (`sb_publishable_...`)** | User project uses new Supabase key format | Use `@supabase/supabase-js` client defaults; do not send publishable key as `Authorization: Bearer` in custom fetch |
| **D-101-10: Migration policy — fresh start default** | AC-101-5; avoids risky silent merge | Document: new cloud users start empty; existing IndexedDB vaults remain local until explicit opt-in import (manual/dev path acceptable in 101) |

## Constraints / Non-Negotiables
- **S1 / S2 / S3:** Encrypt before Supabase write; no plaintext credential values in any column; master password never sent to server.
- **S8:** Anonymous/product auth session ≠ vault unlock — signing in anonymously does not decrypt vault.
- No Supabase Auth registration/login UI (Phase 190).
- No cutover of built-in catalog to `service_registry` reads (Phase 102).
- No removal of IndexedDB vault in this phase.
- No `service_role` / secret key in frontend code or env exposed to Vite.
- Phase 100 production/dev boundary (`isDevBuild`) unchanged.

## Technical Boundaries / Out of Scope
- Multi-device sync read, conflict resolution UI, offline queue (PLAN §10 — later phases).
- `subscription_plans` enforcement / billing (Phase 150+); table structure + seed row only.
- Admin platform writes to registry (Phase 107).
- Row-level account recovery, MFA, rate limiting hardening beyond baseline RLS.
- Automated one-click IndexedDB → cloud migration UI (document + dev script sufficient for 101).
- Replacing practice/dev tooling from Phase 100.

## Dependencies and Interfaces

### Supabase project (existing)
- Project ref: `wbehjoraatkrpsbgyunx`
- Credentials: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored)
- Enable **Anonymous sign-in** in Supabase Auth settings (required for D-101-5)

### New package (Developer)
- `@supabase/supabase-js` — browser client

### Client modules (Developer — interfaces only)
| Module | Responsibility |
|--------|----------------|
| `src/supabase/client.ts` | Singleton Supabase client from env |
| `src/supabase/auth.ts` | Ensure anonymous session; expose `userId` |
| `src/supabase/persistence.ts` | Map `VaultState` ↔ relational rows; encrypt credentials per profile before upsert |
| `src/vault/vault.ts` | Extend `persistVault` with dual-write hook (failure must not corrupt local vault) |

### Schema (target)

#### `users`
| Column | Notes |
|--------|-------|
| `id` | `uuid` PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `created_at`, `updated_at` | timestamptz |

#### `categories`
| Column | Notes |
|--------|-------|
| `id` | text PK (e.g. `banking`, `health`) |
| `display_name` | text (Hebrew label) |
| `sort_order` | int |

#### `service_registry`
| Column | Notes |
|--------|-------|
| `id` | text PK (stable service id) |
| `display_name`, `primary_url` | text |
| `login_url` | text nullable |
| `category_id` | FK → `categories` |
| `icon`, `adapter_id` | text nullable |
| `login_fields` | jsonb nullable |
| `source_type`, `service_status` | text enums per PLAN §6 |
| `metadata` | jsonb |
| `metadata_version` | int default 1 |
| `created_at`, `updated_at` | timestamptz |

#### `user_services`
| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `user_id` | FK → `users` |
| `service_id` | text (references `service_registry.id` when present) |
| `sort_order` | int nullable |
| `created_at` | timestamptz |
| UNIQUE (`user_id`, `service_id`) | |

#### `access_profiles`
| Column | Notes |
|--------|-------|
| `id` | uuid PK (new cloud ids; map from vault `profile-*` on sync) |
| `user_id` | FK → `users` |
| `user_service_id` | FK → `user_services` |
| `display_name` | text |
| `is_default` | boolean |
| `schema_version` | int |
| `created_at`, `updated_at` | timestamptz |

#### `encrypted_credentials`
| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `access_profile_id` | FK → `access_profiles` ON DELETE CASCADE, UNIQUE |
| `ciphertext` | text (base64 AES-GCM payload of credential JSON for that profile) |
| `iv` | text (base64) |
| `algorithm` | text default `aes-256-gcm` |
| `field_ids_present` | text[] or jsonb — **ids only, never values** |
| `updated_at` | timestamptz |

#### `subscription_plans`
| Column | Notes |
|--------|-------|
| `id` | text PK (e.g. `free`) |
| `display_name` | text |
| `capability_flags` | jsonb |
| Seed one `free` row |

### RLS policy intent (AC-101-4)
| Table | Policy |
|-------|--------|
| `users` | SELECT/UPDATE own row (`id = auth.uid()`) |
| `user_services`, `access_profiles`, `encrypted_credentials` | ALL where `user_id = auth.uid()` (via join for credentials) |
| `categories`, `service_registry`, `subscription_plans` | SELECT for `authenticated` |
| Writes to global registry | Deny for anon/authenticated clients (service role / Phase 107 only) |

### Encryption contract (AC-101-2, AC-101-3)
- Reuse vault unlock `CryptoKey` (or derived export) to encrypt each profile's credential object before upsert.
- Ciphertext + IV stored in `encrypted_credentials`; server/Supabase admin sees opaque blobs only.
- Supabase sync failure logs dev-only; does not surface ciphertext in UI.

## Data / State Considerations
- **ID mapping:** Vault uses client-generated `profile-*` ids; cloud uses UUIDs. Persistence layer maintains mapping in memory during session or via `access_profiles` metadata column — Manager must specify stable mapping strategy on first dual-write.
- **IndexedDB authoritative for read in 101:** Cloud write proves persistence; read-from-cloud deferred.
- **Existing local vaults:** Unaffected until unlock + dual-write runs with anonymous session.
- **Empty registry:** Valid; `user_services.service_id` still stores catalog ids from built-in source.

## Security / Privacy Considerations
- Enable RLS on all user-owned tables before any client wiring ships.
- Anonymous sessions are revocable; document that Phase 190 will migrate identity.
- No credential values in `access_profiles`, `user_services`, or logs.
- `.env.local` must remain gitignored; document env setup in migration doc.

## Testing and Lint Expectations
- `npm run build` must pass after client integration.
- Apply migrations to linked Supabase project; verify tables + RLS via Dashboard or `supabase db lint` if CLI configured.
- Unit tests: add for persistence mapping/encryption helpers if Manager scopes them; else document NOT AVAILABLE with reason.
- Lint: per project rules if script exists.
- Manual verification: Supabase Table Editor shows ciphertext rows after in-app credential save; no plaintext password column anywhere.

## Functional Testability

- Page/screen the user can open: App unlock → Manage Services → save credentials for a profile (existing flow)
- User-visible behavior: No change to unlock/UX; app behaves as today reading from IndexedDB
- Command-line flow: `supabase db push` or apply migration SQL; `npm run build`
- API endpoint / request: PostgREST upsert to `encrypted_credentials` with anon JWT after `signInAnonymously`
- Minimal end-to-end flow: Unlock → ensure anonymous auth → add/edit credential → `persistVault` dual-write → confirm encrypted row in Supabase Dashboard
- Expected observable result: AC-101-1…AC-101-5 satisfied; user sees normal app; operator sees ciphertext-only cloud rows

## Handoff Notes for Manager

1. **Prerequisite:** User enables Anonymous sign-in in Supabase Dashboard (Auth → Providers).
2. **Fix `.env.local`:** `VITE_SUPABASE_URL` without `/rest/v1/` suffix before client work.
3. **Deliver migrations** in dependency order: `categories` → `subscription_plans` → `users` → `service_registry` → `user_services` → `access_profiles` → `encrypted_credentials` → RLS policies.
4. **Seed data:** `categories` (banking, health, shopping, …); `subscription_plans` (`free`); registry seed optional.
5. **Client milestones:** supabase client → anonymous auth bootstrap → vault dual-write → id mapping layer.
6. **Document** `docs/MIGRATION_PHASE_101.md`: fresh-start default, opt-in IndexedDB import outline, anonymous → registered upgrade pointer to Phase 190.
7. **Error handling:** Supabase write failure must not block local `persistVault` success.
8. **Do not** implement Phase 102 catalog reads or Phase 190 login screens.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- **Phase alignment:** `PHASE=101` in `PHASE.md`; `arch-phase101.md`, `manager-phase101.md`, and `dev-phase101.md` aligned. Manager review status APPROVED with no corrections.
- **D-101-1 (migrations):** `20260702121500_phase101_schema.sql` creates all seven required tables with constraints and seeds (`categories`, `free` plan). `20260702121600_phase101_rls.sql` enables RLS and policies per contract.
- **D-101-2 / D-101-3:** Relational model with per-profile `encrypted_credentials`; `encryptCredentialSet()` in `crypto.ts` applies AES-256-GCM before upsert; only `ciphertext`, `iv`, `field_ids_present` stored in cloud.
- **D-101-4:** Plaintext limited to non-secret metadata (`display_name`, `service_id`, category labels); no credential values in clear columns.
- **D-101-5:** `ensureAnonymousUserId()` via `signInAnonymously()`; no registration UX; auth session separate from vault unlock (`persistVault` requires unlocked vault key).
- **D-101-6:** `persistVault` writes IndexedDB first, then `syncVaultStateToSupabaseSafe` (best-effort, non-blocking); read path unchanged.
- **D-101-7:** Built-in catalog not read from `service_registry`; schema + category seed only; app catalog source unchanged.
- **D-101-8 / D-101-9:** `env.ts` normalizes base URL (strips `/rest/v1/`); `@supabase/supabase-js` via `createClient`; no `service_role` in client env or code.
- **D-101-10:** `docs/MIGRATION_PHASE_101.md` documents fresh-start default, optional import outline, Phase 190 pointer, env and migration apply steps.
- **ID mapping:** `access_profiles.local_profile_id` maps vault `profile-*` ids to stable cloud UUIDs via upsert on `(user_id, local_profile_id)` — satisfies handoff requirement.
- **AC-101-1:** Seven tables present in migrations. **AC-101-2:** No plaintext credential columns. **AC-101-3:** Client-side encryption before write. **AC-101-4:** RLS on user-owned tables; cross-user isolation evidenced in `verifyPhase101Supabase.mjs`. **AC-101-5:** Migration doc complete.
- **Constraints:** No Phase 190 login UI, no Phase 102 registry read cutover, no cloud read path, Phase 100 `isDevBuild` boundary untouched.
- **Verification:** Developer build PASS; manager independent review; architect code review confirms implementation matches contract. Unit tests/lint NOT AVAILABLE — documented and acceptable.
- **Observations (non-blocking):** `customServices` remain in IndexedDB encrypted blob only (not denormalized to `service_registry` until Phase 102). Failure-mode script simulates cloud failure; source-level IndexedDB-first + safe wrapper is sufficient. Verification scripts require corporate CA in this environment (`NODE_EXTRA_CA_CERTS`).

### Required Corrections
_None._
