# Developer Phase 102

## Phase Identifier
PHASE=102

## Status
STATUS: COMPLETE

## Source References
- `team-Yuri/arch-phase102.md`
- `team-Yuri/manager-phase102.md`
- `team-Yuri/PLAN.md` §6, §18 — Phase 102 (AC-102-1 … AC-102-6)

## Implementation Summary
Delivered Phase 102 service registry cutover: schema delta (`owner_user_id`, `login_url_status`), built-in seed migration (13 production services, no practice), RLS visibility + user CRUD policies, `persist_discovered_login_url` SECURITY DEFINER RPC, runtime registry loader (Supabase fetch + dev practice injection), custom service registry upsert, discovery gate/persist (RPC for global, direct UPDATE for user rows), operator documentation, and verification script.

## Implemented Milestones

| Milestone | Completed: Yes/No | Notes |
|---|---:|---|
| M1 Schema delta + seed | Yes | 4 migration files under `supabase/migrations/` |
| M2 RLS delta + RPC | Yes | Visibility policy + user CRUD + `persist_discovered_login_url` |
| M3 Registry loader client | Yes | `src/registry/registryLoader.ts`, `registryMapper.ts`, `catalogLoader.ts` |
| M4 Custom service registry upsert | Yes | `src/supabase/registryPersistence.ts` + `App.tsx` |
| M5 Discovery gate + persist | Yes | `src/registry/loginUrlDiscovery.ts`, `customServiceDiscovery.ts`, `Dashboard.tsx` |
| M6 Verification + docs | Yes | `scripts/verifyPhase102Registry.mjs`, `docs/MIGRATION_PHASE_102.md` |

## Files Changed

| File | Change Summary | Reason |
|---|---|---|
| `supabase/migrations/20260703120000_phase102_schema_delta.sql` | `owner_user_id`, `login_url_status` | D-102-4, D-102-9 |
| `supabase/migrations/20260703120100_phase102_seed_builtin.sql` | Seed 13 built-in services | D-102-1, AC-102-2 |
| `supabase/migrations/20260703120200_phase102_rls_delta.sql` | Registry visibility + user CRUD | D-102-5, D-102-6 |
| `supabase/migrations/20260703120300_phase102_rpc.sql` | `persist_discovered_login_url` RPC | D-102-7, AC-102-5 |
| `src/registry/registryMapper.ts` | Row ↔ `ServiceDefinition` mapping | AC-102-1 |
| `src/registry/registryLoader.ts` | Supabase fetch + session cache + dev practice | D-102-2, D-102-12 |
| `src/registry/loginUrlDiscovery.ts` | Discovery gate + RPC/user persist | AC-102-4 … AC-102-6 |
| `src/catalog/catalogLoader.ts` | Async `loadBuiltinCatalogDefinitions()` | AC-102-2 |
| `src/catalog/customServiceDiscovery.ts` | Delegates to registry discovery | M5 |
| `src/supabase/registryPersistence.ts` | Custom service registry upsert | AC-102-3 |
| `src/App.tsx` | Async catalog load; custom upsert; error UI | M3, M4, D-102-12 |
| `src/Dashboard.tsx` | Built-in open path discovery gate | AC-102-4 |
| `src/mockServices.ts` | `setRuntimeBuiltinServices()` runtime population | Phase 102 async catalog |
| `src/pocAutofill.ts` | Lazy service lookup after catalog load | Dev POC compatibility |
| `docs/MIGRATION_PHASE_102.md` | Operator guide | M6 |
| `scripts/verifyPhase102Registry.mjs` | Automated registry/RLS/RPC proof | M6 |

## Dependencies Installed

| Dependency / Tool | Command Used | Reason |
|---|---|---|
| None | — | Uses existing `@supabase/supabase-js` from Phase 101 |

## Unit Tests

| Field | Value |
|---|---|
| Command | N/A |
| Result | NOT AVAILABLE |
| Notes | No unit-test framework in project |

## Lint

| Field | Value |
|---|---|
| Command | N/A |
| Result | NOT AVAILABLE |
| Notes | No lint script in `package.json` |

## Migration + Seed Evidence

| Field | Value |
|---|---|
| Apply method | Supabase Dashboard → SQL Editor (4 files in order) — same as Phase 101 |
| Migration files | `20260703120000` schema → `20260703120100` seed → `20260703120200` RLS → `20260703120300` RPC |
| Expected built-in seed count | **13** (all `builtinCatalog.ts` entries except `hub-practice-login`) |
| Verification command | `$env:NODE_EXTRA_CA_CERTS="C:\certs\netspark-ca-bundle.pem"; node scripts/verifyPhase102Registry.mjs` |
| Verification result | **PENDING OPERATOR APPLY** — run after migrations applied |

### Seed services (global `owner_user_id IS NULL`, `source_type=built_in`)
`hapoalim`, `leumi`, `discount`, `mizrahi`, `clalit`, `maccabi`, `meuhedet`, `leumit`, `shufersal`, `rami-levy`, `amazon-il`, `ksp`, `htzone`

## RLS Evidence (script checks)

| Check | Expected |
|---|---|
| User A custom row | INSERT allowed (`source_type=user`, `owner_user_id=auth.uid()`) |
| User B SELECT user A custom row | **Denied** (empty result) |
| Global built-in direct UPDATE | **Denied** (RPC only) |

## RPC Evidence (script checks)

| Check | Expected |
|---|---|
| `persist_discovered_login_url` on `leumi` (null `login_url`) | **Allowed** — sets `login_url`, `login_url_status=valid` |
| Same RPC on `shufersal` (already valid URL) | **Rejected** |
| RPC on user-owned row | **Rejected** (not global built-in) |

## Registry Loader Proof (AC-102-2)

| Field | Value |
|---|---|
| Production path | `loadBuiltinCatalogDefinitions()` → `loadRegistryCatalog()` → Supabase `service_registry` |
| `BUILTIN_CATALOG_DEFINITIONS` runtime use | **Removed** — `getBuiltinCatalogDefinitions()` throws; dev practice only injected from single entry |
| Offline fallback | Error UI in `App.tsx`; session cache reuse on subsequent loads (no silent TS catalog fallback) |
| Dev practice | Injected client-side when `isDevBuild()` — not seeded in SQL |

## Custom Service Upsert Proof (AC-102-3)

| Field | Value |
|---|---|
| Module | `upsertCustomServiceRegistryRow()` |
| Trigger | `App.addCustomService()` after vault save |
| Row shape | `source_type=user`, `owner_user_id=auth.uid()`, stable `id` = vault custom id |
| Phase 101 dual-write | `persistVault` unchanged (IndexedDB + `user_services`) |

## Discovery Gate + Persist Proof (AC-102-4 … AC-102-6)

| Field | Value |
|---|---|
| Gate | `shouldRunLoginUrlDiscovery()` — run when `login_url` null OR `login_url_status=invalid` |
| Confidence | `shouldPersistDiscoveredLoginUrl()` unchanged |
| Global persist | `persist_discovered_login_url` RPC |
| User persist | Direct UPDATE `login_url`, `login_fields`, `login_url_status=valid` |
| Custom add flow | `discoverLoginForCustomService` → `discoverAndPersistLoginUrl` |
| Built-in open flow | `Dashboard.handleServiceOpen` → `discoverAndPersistLoginUrl` before tile execution |
| Skip when valid | `discoverAndPersistLoginUrl` returns `skipped: true` when registry row valid |

## Functional Testability Evidence

| Field | Value |
|---|---|
| Method | Build + operator migration apply + verification script + manual app flow |
| Steps | Apply 4 migrations → `node scripts/verifyPhase102Registry.mjs` → `npm run dev` → unlock → Manage Services → add custom site → open built-in without login URL |
| Expected Result | AC-102-1…AC-102-6; vault unlock/credential save unchanged |
| Actual Result | Build **PASS**; migrations/script pending operator apply in target Supabase project |
| Notes | After Phase 101 migrations, apply Phase 102 SQL files in order (paste contents, not paths) |

## Documentation Update Evidence

| Field | Value |
|---|---|
| Documentation Updated | YES |
| Files Updated | `docs/MIGRATION_PHASE_102.md` |
| Reason if Not Required | — |

## Build Result

| Field | Value |
|---|---|
| Command | `npm run build` |
| Result | **PASS** (exit 0) |

### Output
```text
> israeli-vault@0.0.0 build
> npm run build:extension-discovery && tsc -b && vite build

vite v6.4.3 building for production...
✓ 141 modules transformed.
dist/assets/index-xyXsVdq_.js   490.49 kB │ gzip: 144.93 kB
✓ built in 2.27s
```

## Known Issues / Limitations
- Verification script requires Phase 102 migrations applied to linked Supabase project.
- Manager plan cites 12 built-in services; `builtinCatalog.ts` contains **13** production entries (excluding practice) — seed matches source file.
- Existing vault `customServices` in IndexedDB remain until save; registry preferred on load when Supabase configured.
- `login_url_status=invalid` marking: `markLoginUrlInvalid()` implemented for user rows; full deprecation UX deferred.

## Phase 102 stabilization (operator-approved)

Post-UAT fixes after registry cutover:

| Issue | Fix |
|---|---|
| Tile click ran blocking discovery (tab open + auto-close) | Removed from `Dashboard.handleServiceOpen` |
| Split open path (`login_fields` vs none) | Adapter registry: `generic` (Shufersal/Clalit), `htzone`, `practice`; else open-only |
| Hapoalim silent fail (POC allowlist) | Banks/custom have no `generic` adapter — open only |
| Custom add discovery stole focus | Extension discovery tab `active: false` + refocus Hub |

**Phase 102 tile contract:** Shufersal/Clalit autofill via `adapterId: generic`; other services open `loginUrl` or `primaryUrl`; tab stays open; no discovery on tile click.

**Phase 103 contract:** unified open + optional autofill pipeline; remove `GENERIC_REAL_SITE_ALLOWED_HOSTS` POC allowlist.

Files: `src/execution/serviceExecution.ts`, `docs/MIGRATION_PHASE_102.md` § stabilization.

## Scope Compliance
Phase 102 scope delivered. No Phase 103 unified execution refactor, no Phase 190 auth UX, no admin registry UI, no vault cloud read path, no `service_role` in client.

## Developer Declaration
Phase 102 implementation complete. Ready for Manager and Architect review. Operator must apply Phase 102 migrations before verification script and app registry load succeed.
