# Architecture Phase 102

## Phase Identifier
PHASE=102

## Status
STATUS: APPROVED

## Phase Goal
Make the **service registry** the runtime source of catalog metadata (built-in Israeli catalog + user custom services), with **login URL discovery on demand** and **persisted login URL / loginFields cache** — without changing unified execution (Phase 103), registration UX (Phase 190), or vault read path (IndexedDB remains authoritative for unlock/credentials in this phase).

## Source References
- `team-Yuri/PLAN.md` §6 — Service Registry
- `team-Yuri/PLAN.md` §18 — Phase 102 acceptance criteria (AC-102-1 … AC-102-6)
- `team-Yuri/arch-phase101.md` — APPROVED; `service_registry` table exists; RLS select-only for clients on global registry
- `src/catalog/builtinCatalog.ts` — current built-in seed data (to migrate, not runtime authority)
- `src/catalog/catalogLoader.ts`, `src/mockServices.ts` — current runtime catalog path
- `src/catalog/customServiceDiscovery.ts` — discovery + `shouldPersistDiscoveredLoginUrl`
- `supabase/migrations/20260702121500_phase101_schema.sql` — baseline `service_registry` columns

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-102-1: Seed built-in catalog via SQL migration** | AC-102-2 requires catalog in platform data, not TS runtime | One migration seeds all production built-in rows from current `builtinCatalog.ts` (excluding dev-only `hub-practice-login`) |
| **D-102-2: Runtime catalog reads Supabase** | AC-102-2 | Replace `getBuiltinCatalogDefinitions()` network/DB fetch; map registry rows → `ServiceDefinition` / legacy `Service` |
| **D-102-3: Dev-only practice service stays client-gated** | Phase 100 boundary preserved | `hub-practice-login` **not** seeded in production registry; inject only when `isDevBuild()` (same as Phase 100) |
| **D-102-4: User-scoped registry rows for custom services** | AC-102-3 | Add `owner_user_id uuid null` on `service_registry`; NULL = global (built-in/admin); set = owning user |
| **D-102-5: RLS — read global + own user rows** | Isolation + discoverability | SELECT: `owner_user_id IS NULL OR owner_user_id = auth.uid()` AND `service_status = 'active'` (deprecated handling deferred) |
| **D-102-6: RLS — user INSERT/UPDATE own rows only** | Custom service CRUD | INSERT/UPDATE/DELETE on rows where `owner_user_id = auth.uid()` AND `source_type = 'user'` |
| **D-102-7: Global login URL cache via SECURITY DEFINER RPC** | AC-102-5 for built-in rows; Phase 101 denied client UPDATE on global registry | Function `persist_discovered_login_url(p_service_id, p_login_url, p_login_fields)` updates `login_url` / `login_fields` / freshness metadata only when `login_url` is null or marked invalid |
| **D-102-8: Discovery gate** | AC-102-4 | Run discovery only if `login_url IS NULL` OR `login_url_status = 'invalid'`; reuse `shouldPersistDiscoveredLoginUrl()` confidence rules before persist |
| **D-102-9: `login_url_status` column** | Explicit invalid marking for AC-102-4 | Values: `unknown` (null URL), `valid`, `invalid`; default `unknown` when URL null, `valid` when seeded with URL |
| **D-102-10: Icon metadata in registry** | AC-102-1 | Store emoji in `icon`; favicon URL in `metadata.faviconSiteUrl` (matches current `ServiceDefinition.metadata`) |
| **D-102-11: IndexedDB vault unchanged for reads** | Phase 101 dual-write continuity | Custom service definitions may still exist in vault blob during transition; Phase 102 adds registry row on custom create and prefers registry on load when Supabase configured |
| **D-102-12: Offline fallback** | PLAN §10 offline behavior (partial) | If Supabase fetch fails, fall back to last cached registry snapshot in memory/session OR minimal error state — document; no silent revert to `builtinCatalog.ts` in production |

## Constraints / Non-Negotiables
- No plaintext credentials in registry (unchanged ADR-002).
- No registration/login UX (Phase 190).
- No unified execution refactor beyond using registry `loginUrl` / `loginFields` where already consumed (Phase 103 owns full pipeline).
- No admin platform UI (Phase 107).
- No `service_role` key in client.
- Phase 100 `isDevBuild()` rules unchanged.
- Built-in seed must preserve existing service ids (e.g. `shufersal`, `clalit`, `htzone`) for vault compatibility.

## Technical Boundaries / Out of Scope
- Full multi-device registry sync read path (Phase 101+ sync scope unchanged for credentials).
- Admin approval workflow for user-submitted global catalog (`PendingReview` → `ApprovedGlobal`).
- Deprecation UX for `service_status = deprecated`.
- Registry versioning / `metadataVersion` conflict resolution (later).
- Removing `builtinCatalog.ts` from repo (may remain as **seed reference** for migrations until admin tools exist).
- HTZone adapter / generic autofill engine changes beyond reading registry metadata.

## Dependencies and Interfaces

### Schema migration (Phase 102 delta)
Extend `service_registry`:
| Column | Purpose |
|--------|---------|
| `owner_user_id` | `uuid null` FK → `users(id)`; NULL = global |
| `login_url_status` | `text not null default 'unknown'` check in (`unknown`,`valid`,`invalid`) |

Add index: `(owner_user_id)` where not null.

### Seed migration
- Insert all production entries from `builtinCatalog.ts` (12 services, **exclude** `hub-practice-login`).
- Map fields: `url` → `primary_url`, `loginUrl` → `login_url`, `loginFields` → `login_fields`, `adapterId` → `adapter_id`, `category` → `category_id`, `source_type` = `built_in`, `service_status` = `active`.
- Set `login_url_status = valid` where `login_url` present; else `unknown`.

### RLS migration (Phase 102 delta)
Replace broad `service_registry_select_authenticated` with visibility policy (D-102-5).

Add policies for user-owned registry CRUD (D-102-6).

Add RPC + grant:
```sql
-- Signature concept (Manager/Developer finalize)
persist_discovered_login_url(
  p_service_id text,
  p_login_url text,
  p_login_fields jsonb default null
) returns void
-- SECURITY DEFINER; validates auth.uid() is not null;
-- updates only global built_in row when login_url is null OR login_url_status = 'invalid';
-- sets login_url_status = valid, updated_at = now()
```

User-owned custom rows: client UPDATE allowed directly for `login_url`, `login_fields`, `login_url_status` on own rows (D-102-6).

### Client modules (Developer — target interfaces)
| Module | Responsibility |
|--------|----------------|
| `src/registry/registryLoader.ts` | Fetch + map registry → `ServiceDefinition[]` |
| `src/registry/registryMapper.ts` | Row ↔ `ServiceDefinition` field mapping |
| `src/registry/loginUrlDiscovery.ts` | Gate discovery (D-102-8); call RPC or direct update per row ownership |
| `src/catalog/catalogLoader.ts` | Delegate to registry loader; dev-only practice injection |
| `src/catalog/customServiceDiscovery.ts` | After discovery, persist to user registry row + vault |
| `src/supabase/persistence.ts` | Upsert user-scoped `service_registry` row when custom service created |

### Registry row → ServiceDefinition mapping (AC-102-1)
| Registry | ServiceDefinition |
|----------|-------------------|
| `primary_url` | `url` |
| `login_url` | `loginUrl` |
| `category_id` | `category` |
| `icon` | `icon` |
| `adapter_id` | `adapterId` |
| `login_fields` | `loginFields` |
| `metadata` | `metadata` (incl. favicon) |
| `id` | `id` |
| `display_name` | `displayName` |

## Data / State Considerations
- **Existing vaults:** `selectedIds` and `customServices` in IndexedDB remain valid; built-in ids unchanged.
- **Custom services:** Creating custom service inserts `service_registry` row (`source_type=user`, `owner_user_id=auth.uid()`) and references same `id` in `user_services`.
- **Dual-write:** Phase 101 persistence continues; Phase 102 adds registry upsert for custom definitions.
- **Discovery idempotency:** Do not re-run discovery when `login_url_status = valid` and URL present.
- **Invalid marking:** Phase 102 may mark invalid on failed open/autofill (minimal: manual/dev flag or execution failure hook — Manager scopes minimal trigger).

## Security / Privacy Considerations
- RPC must not allow arbitrary row updates (service id + null/invalid guard only).
- User registry rows isolated by `owner_user_id`.
- Discovery fetches third-party HTML only through existing extension/proxy paths; no new credential exposure.
- Registry rows never contain user secrets.

## Testing and Lint Expectations
- `npm run build` passes.
- Apply Phase 102 migrations to Supabase project.
- Verification script or documented SQL checks: seeded built-in count, RLS isolation (user A cannot read user B custom registry row), RPC updates global login URL when allowed.
- Unit tests for mapper + discovery gate if feasible; else document NOT AVAILABLE.

## Functional Testability

- Page/screen: Manage Services / Dashboard (existing flows)
- User-visible behavior: Same service list as today; sources loaded from Supabase after unlock + network
- Command-line: apply migrations; optional `node scripts/verifyPhase102Registry.mjs`
- Minimal E2E:
  1. Unlock vault (IndexedDB)
  2. Open Manage Services — catalog shows seeded banks/health/shopping from registry
  3. Add custom site URL — user registry row created (`source_type=user`)
  4. If no login URL — discovery runs once — `login_url` persisted (user row direct or RPC for global)
  5. Supabase Table Editor — `service_registry` shows built-in seeds + user custom row with metadata
- Expected: AC-102-1…AC-102-6 satisfied; no regression to vault unlock or credential save

## Handoff Notes for Manager

1. **Migrations order:** schema delta → seed built-in → RLS delta → RPC function.
2. **Remove runtime dependency** on `BUILTIN_CATALOG_DEFINITIONS` for production; keep for seed generation reference.
3. **Practice service:** dev-only injection only; do not seed in SQL.
4. **RPC vs direct UPDATE:** global built-in → RPC; user custom → direct client UPDATE under RLS.
5. **Document** operator steps in `docs/MIGRATION_PHASE_102.md` or extend Phase 101 doc with §102 addendum.
6. **Verification:** prove catalog load from DB; prove discovery persist; prove custom user row isolation.
7. **Do not** start Phase 103 unified execution refactor beyond consuming registry fields already used.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- **Phase alignment:** `PHASE=102`; artifacts aligned. Manager review APPROVED; operator applied migrations; `verifyPhase102Registry.mjs` reported PASS per manager notes.
- **D-102-1 / D-102-2:** Four ordered migrations; runtime catalog via `loadBuiltinCatalogDefinitions()` → `loadRegistryCatalog()`; `getBuiltinCatalogDefinitions()` removed (throws). Production path does not iterate `BUILTIN_CATALOG_DEFINITIONS` for catalog load.
- **D-102-3:** `hub-practice-login` not seeded in SQL; injected client-side via `injectDevPractice()` when `isDevBuild()` only.
- **D-102-4 / D-102-5 / D-102-6:** Schema delta adds `owner_user_id`, `login_url_status`; RLS visibility policy + user-owned CRUD; global rows non-writable except RPC.
- **D-102-7:** `persist_discovered_login_url` SECURITY DEFINER enforces `owner_user_id IS NULL`, `source_type = built_in`, and `(login_url IS NULL OR login_url_status = invalid')` guard; granted to `authenticated` only.
- **D-102-8 / AC-102-4:** `shouldRunLoginUrlDiscovery()` gates discovery; wired in `discoverAndPersistLoginUrl`, custom add flow, and `Dashboard.handleServiceOpen`.
- **D-102-9:** `login_url_status` check constraint (`unknown`, `valid`, `invalid`); seed sets `valid` where URL present.
- **D-102-10:** Seed stores `icon` + `metadata.faviconSiteUrl`; mapper restores `ServiceDefinition` fields per AC-102-1 table.
- **D-102-11:** IndexedDB vault read/unlock unchanged; Phase 101 dual-write preserved; custom registry upsert on create.
- **D-102-12:** Fetch failure surfaces `catalogError` UI in `App.tsx`; session cache reuse on subsequent loads; no silent production fallback to TS builtin catalog.
- **AC-102-1 … AC-102-6:** Satisfied per code review and manager/operator verification evidence (seed count 13 production built-ins excluding practice — matches `builtinCatalog.ts`, not understated manager “12”).
- **Constraints:** No Phase 103 execution refactor, no Phase 190 auth UX, no admin UI, no `service_role` in client, no credential plaintext in registry.
- **Verification:** Build PASS documented; RLS isolation, RPC allow/deny, user custom row, and discovery persist evidenced in verification script. Unit tests/lint NOT AVAILABLE — acceptable.
- **Observations (non-blocking):** `src/service/CATALOG_MAPPING.md` still references TS catalog as authoritative — update in a docs hygiene pass. `markLoginUrlInvalid()` limited to user rows (global invalid marking deferred). `dev-phase102.md` verification sections marked PENDING superseded by operator apply + script PASS.

### Required Corrections
_None._
