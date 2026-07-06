# Manager Phase 102

## Phase Identifier
PHASE=102

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Make the **service registry** the runtime source of catalog metadata (built-in Israeli catalog + user custom services), with **login URL discovery on demand** and **persisted login URL / loginFields cache** — without changing unified execution (Phase 103), registration UX (Phase 190), or vault read path (IndexedDB remains authoritative for unlock/credentials).

## Source References
- `team-Yuri/arch-phase102.md`
- `team-Yuri/PLAN.md` §6 — Service Registry
- `team-Yuri/PLAN.md` §18 — Phase 102 acceptance criteria (AC-102-1 … AC-102-6)
- `team-Yuri/PHASE.md` — `PHASE=102`
- `team-Yuri/arch-phase101.md` — APPROVED; baseline `service_registry` table and Phase 101 dual-write

## Architecture Summary (Phase 102 constraints)
- **Runtime catalog** loads from Supabase `service_registry`, not `builtinCatalog.ts` in production.
- **Built-in seed** via SQL migration (12 production services from `builtinCatalog.ts`; **exclude** dev-only `hub-practice-login`).
- **User custom services** create user-scoped registry rows (`owner_user_id = auth.uid()`, `source_type = user`).
- **Login URL cache:** discovery runs only when `login_url` is null OR `login_url_status = invalid`; persist discovered URL + `login_fields` when confidence rules pass.
- **Global built-in cache updates** via SECURITY DEFINER RPC (Phase 101 denied direct client UPDATE on global registry).
- **User-owned rows:** client UPDATE allowed under RLS for `login_url`, `login_fields`, `login_url_status`.
- Phase 100 `isDevBuild()` boundary unchanged — practice service injected client-side only in dev.

## Acceptance / Gating Criteria
- AC-102-1: Registry entries include `primaryUrl`, `loginUrl`, category, icon metadata
- AC-102-2: Built-in Israeli catalog loaded from registry, not application source code
- AC-102-3: Custom services create user-scoped registry references
- AC-102-4: Login discovery runs only when `loginUrl` is missing or marked invalid
- AC-102-5: Discovered `loginUrl` persisted to registry cache
- AC-102-6: `loginFields` schema stored on registry entry when known

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| 1 | Schema delta + seed migration | Extend `service_registry` (`owner_user_id`, `login_url_status`); seed 12 production built-in rows from `builtinCatalog.ts` | Delta applied; seeded global rows visible; practice service not seeded |
| 2 | RLS delta + login URL cache RPC | Replace Phase 101 select-only registry policy; add user-owned CRUD policies; deploy `persist_discovered_login_url` SECURITY DEFINER function | User A cannot read user B custom rows; RPC updates global built-in login URL when null/invalid only |
| 3 | Registry loader client | Fetch registry from Supabase; map rows → `ServiceDefinition` / legacy `Service`; dev-only practice injection | Production catalog loads from DB; `catalogLoader.ts` no longer reads `BUILTIN_CATALOG_DEFINITIONS` at runtime |
| 4 | Custom service registry upsert | On custom service create, upsert user-scoped `service_registry` row + existing vault/`user_services` dual-write | Custom add creates `source_type=user` row with `owner_user_id = auth.uid()` |
| 5 | Discovery gate + persist | Gate discovery on `login_url` / `login_url_status`; persist via RPC (global) or direct UPDATE (user row); reuse `shouldPersistDiscoveredLoginUrl()` | Discovery skipped when URL valid; persisted URL + fields visible in Supabase after successful discovery |
| 6 | Verification steps & evidence | Operator doc, verification script, build + functional E2E proof | `npm run build` passes; script proves seed count, RLS, RPC, custom row, discovery persist |

## Detailed Development Plan

### M1 — Schema delta + seed migration
Deliver ordered SQL migrations under `supabase/migrations/`:

**Schema delta** — extend `service_registry`:
- `owner_user_id uuid null references public.users(id) on delete cascade` — NULL = global (built-in/admin)
- `login_url_status text not null default 'unknown'` with CHECK in (`unknown`, `valid`, `invalid`)
- Partial index on `owner_user_id` where not null

**Seed migration** — insert all **12 production** built-in entries from `src/catalog/builtinCatalog.ts`:
- **Exclude** `hub-practice-login` (dev-only; D-102-3)
- Preserve existing service ids (`hapoalim`, `leumi`, `shufersal`, `clalit`, `htzone`, etc.) for vault compatibility
- Field mapping:
  - `url` → `primary_url`
  - `loginUrl` → `login_url`
  - `loginFields` → `login_fields` (jsonb)
  - `adapterId` → `adapter_id`
  - `category` → `category_id`
  - `displayName` → `display_name`
  - `icon` → `icon`; favicon URL → `metadata.faviconSiteUrl`
  - `source_type` = `built_in`, `service_status` = `active`
- Set `login_url_status = valid` where `login_url` is present; `unknown` where null
- Use `ON CONFLICT (id) DO UPDATE` for idempotent re-apply

### M2 — RLS delta + RPC for login URL cache
Replace Phase 101 `service_registry_select_authenticated` with visibility policy (D-102-5):
- SELECT allowed when `(owner_user_id IS NULL OR owner_user_id = auth.uid())` AND `service_status = 'active'`

Add user-owned CRUD policies (D-102-6):
- INSERT/UPDATE/DELETE only where `owner_user_id = auth.uid()` AND `source_type = 'user'`
- Global rows (`owner_user_id IS NULL`) remain non-writable by client except via RPC

Deploy SECURITY DEFINER RPC `persist_discovered_login_url`:
```sql
persist_discovered_login_url(
  p_service_id text,
  p_login_url text,
  p_login_fields jsonb default null
) returns void
```
Requirements:
- Requires authenticated session (`auth.uid()` not null)
- Updates **only** global built-in row matching `p_service_id` where `owner_user_id IS NULL` AND `source_type = 'built_in'`
- Allowed only when `login_url IS NULL` OR `login_url_status = 'invalid'`
- Sets `login_url`, optional `login_fields`, `login_url_status = valid`, `updated_at = now()`
- Must not allow arbitrary row updates or user-owned row modification

Grant EXECUTE to `authenticated`.

### M3 — Registry loader client
Implement client modules per `arch-phase102.md`:

| Module | Responsibility |
|--------|----------------|
| `src/registry/registryLoader.ts` | Fetch registry rows; return validated `ServiceDefinition[]` |
| `src/registry/registryMapper.ts` | Row ↔ `ServiceDefinition` mapping (AC-102-1 field table) |
| `src/catalog/catalogLoader.ts` | Delegate to registry loader; inject `hub-practice-login` only when `isDevBuild()` |

Behavior:
- When Supabase configured and authenticated: load catalog from `service_registry` query (global + own user rows)
- **Production:** do not read `BUILTIN_CATALOG_DEFINITIONS` at runtime (AC-102-2)
- **Dev:** inject practice service after fetch (same Phase 100 behavior)
- **Offline fallback (D-102-12):** if fetch fails, use in-memory/session cache OR surface error — do **not** silently revert to `builtinCatalog.ts` in production

Mapping must produce: `primaryUrl`, `loginUrl`, category, icon metadata, `loginFields`, `adapterId`.

### M4 — Custom service registry upsert
Extend custom service creation flow:
- On successful custom service create (existing Manage Services / Add Site flow):
  - Ensure anonymous auth session (Phase 101 bootstrap)
  - Upsert `service_registry` row: `source_type = user`, `owner_user_id = auth.uid()`, stable `id`, `primary_url`, category, icon/metadata
  - Continue Phase 101 dual-write to vault IndexedDB and `user_services`
- User-scoped row uses same `id` referenced in `user_services.service_id`
- Vault blob may still contain custom definition during transition; registry is preferred source on load when Supabase configured

### M5 — Discovery gate + persist
Implement `src/registry/loginUrlDiscovery.ts` (or equivalent) integrating with existing `customServiceDiscovery.ts`:

**Gate (AC-102-4):** run discovery only when:
- `login_url IS NULL` OR `login_url_status = 'invalid'`
- Do **not** re-run when `login_url_status = valid` and URL present

**Confidence gate:** reuse `shouldPersistDiscoveredLoginUrl()` before persist (exclude `common-path`, exclude `low` confidence).

**Persist (AC-102-5, AC-102-6):**
- **Global built-in row:** call `persist_discovered_login_url` RPC
- **User-owned row:** direct client UPDATE under RLS (`login_url`, `login_fields`, `login_url_status = valid`)
- Update vault/local definition after successful registry persist (existing custom service flow)

**Invalid marking (minimal scope):** document mechanism to set `login_url_status = invalid` (dev flag or execution failure hook acceptable; full deprecation UX deferred).

Wire discovery into custom service add flow and any built-in open path that triggers on-demand discovery when URL missing/invalid.

### M6 — Verification steps & evidence

**Operator documentation:**
- Add `docs/MIGRATION_PHASE_102.md` OR §102 addendum to `docs/MIGRATION_PHASE_101.md`
- Include: migration apply order, RPC purpose, verification commands, offline fallback behavior

**Verification script:** `scripts/verifyPhase102Registry.mjs` (or equivalent) proving:
1. Seeded built-in count = 12 (exclude practice)
2. Sample built-in row has `primary_url`, category, icon metadata
3. User A creates custom registry row; user B cannot SELECT it
4. RPC updates global row when `login_url` null/invalid; rejects when already valid
5. User row direct UPDATE persists `login_url` + `login_fields`

**Functional E2E (manual or scripted):**
1. Apply Phase 102 migrations
2. `npm run build` — must pass
3. `npm run dev` (or preview) → unlock vault
4. Manage Services — catalog shows banks/health/shopping from registry (not TS builtin)
5. Add custom site URL — user registry row created in Supabase
6. Trigger discovery for service with missing login URL — URL + fields persisted once
7. Re-trigger discovery for same service with valid URL — discovery skipped
8. Confirm vault unlock and credential save still work (Phase 101 regression)

## Required Developer Evidence
- `team-Yuri/dev-phase102.md` including:
  - Files changed list
  - Migration files + apply method + seed count confirmation
  - RLS isolation proof (user A vs user B custom rows)
  - RPC proof (allowed update when null/invalid; denied when valid)
  - Registry loader proof (production path does not use `BUILTIN_CATALOG_DEFINITIONS`)
  - Custom service upsert proof (Supabase row with `owner_user_id`, `source_type=user`)
  - Discovery gate + persist proof (skip when valid; persist when missing)
  - Documentation update
  - `npm run build` output
  - Tests + lint results, or NOT AVAILABLE with reason

## Out of Scope (must not be implemented)
- Unified execution refactor (Phase 103)
- Registration/login UX (Phase 190)
- Admin platform / registry curation UI (Phase 107)
- Admin approval workflow (`PendingReview` → `ApprovedGlobal`)
- Deprecation UX for `service_status = deprecated`
- Multi-device registry sync read path or conflict resolution
- Removing `builtinCatalog.ts` from repo (may remain as seed reference)
- Cloud read path for vault credentials (IndexedDB authoritative)
- `service_role` key in client

## Risks / Open Questions
- **Offline / fetch failure:** Developer must document chosen fallback (cache vs error) and verify no silent production revert to TS catalog.
- **Existing vault custom services:** May exist only in IndexedDB until next save; document transition behavior.
- **RPC security:** Function must guard against updating user-owned or non-built-in rows; include negative test in verification script.
- **Service id stability:** Seed must preserve ids from Phase 100/101 vaults; any id change breaks `selectedIds`.

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes
- Phase identifier aligned (`PHASE=102`); developer artifact complete with migrations, RLS/RPC evidence, registry loader proof, custom upsert, discovery gate/persist, documentation, and build output.
- **Operator confirmation + independent verification:** All 4 Phase 102 SQL migrations applied; `node scripts/verifyPhase102Registry.mjs` **PASS** (13 built-in seed, RLS isolation, RPC allow/deny, custom row + user UPDATE).
- **M1/M2:** Schema delta (`owner_user_id`, `login_url_status`), 13 production built-in seeds (excludes `hub-practice-login`; matches `builtinCatalog.ts` — manager plan “12” was understated), visibility RLS + user CRUD, `persist_discovered_login_url` SECURITY DEFINER with null/invalid guard.
- **M3:** `loadBuiltinCatalogDefinitions()` → Supabase fetch; `getBuiltinCatalogDefinitions()` throws; dev practice injected client-side only; offline shows error UI (no silent TS catalog fallback).
- **M4/M5:** `upsertCustomServiceRegistryRow()` on custom create; discovery gated via `shouldRunLoginUrlDiscovery()`; RPC for global built-in, direct UPDATE for user rows; wired in custom add + Dashboard open paths.
- AC-102-1 through AC-102-6 satisfied. Scope compliant — no Phase 103 execution refactor, no auth UX, no vault cloud read, no `service_role` in client.
- Unit tests/lint NOT AVAILABLE per project; acceptable.
- Minor artifact gap: `dev-phase102.md` still lists verification as “PENDING OPERATOR APPLY” in two sections; superseded by operator apply + script PASS (non-blocking).

### Required Corrections
_None._
