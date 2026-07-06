# Phase 102 — Service registry migration

Phase 102 makes `service_registry` the runtime catalog source (built-in Israeli services + user custom services), with login URL discovery cache and RLS isolation.

**Prerequisite:** Phase 101 migrations applied and verified.

## Migration apply order

Apply in Supabase Dashboard → **SQL Editor** (paste **file contents**, not the path):

1. `supabase/migrations/20260703120000_phase102_schema_delta.sql`
2. `supabase/migrations/20260703120100_phase102_seed_builtin.sql`
3. `supabase/migrations/20260703120200_phase102_rls_delta.sql`
4. `supabase/migrations/20260703120300_phase102_rpc.sql`

Or via CLI after `npx supabase link`:

```bash
npx supabase db push
```

## What changes

| Area | Phase 102 behavior |
|---|---|
| Runtime catalog | Loaded from `service_registry` (not `builtinCatalog.ts` in production) |
| Built-in seed | 13 production services (excludes dev-only `hub-practice-login`) |
| Custom services | `source_type=user`, `owner_user_id=auth.uid()` |
| Login URL cache | Discovery runs when `login_url` null or `login_url_status=invalid` |
| Global built-in persist | `persist_discovered_login_url` RPC (SECURITY DEFINER) |
| User custom persist | Direct client UPDATE under RLS |
| Vault read path | IndexedDB unchanged (Phase 101) |

## RPC: `persist_discovered_login_url`

Updates **global built-in** rows only when:

- `owner_user_id IS NULL`
- `source_type = 'built_in'`
- `login_url IS NULL` OR `login_url_status = 'invalid'`

Client custom rows use direct UPDATE (same columns).

## Verification

```powershell
$env:NODE_EXTRA_CA_CERTS="C:\certs\netspark-ca-bundle.pem"
node scripts/verifyPhase102Registry.mjs
```

Checks:

1. Built-in seed count = 13 (no `hub-practice-login`)
2. Sample row metadata (`primary_url`, category, icon)
3. RPC allowed update on `leumi` (null login URL)
4. RPC rejected on `shufersal` (already valid)
5. User A custom row; user B cannot SELECT it
6. User A direct UPDATE persists `login_url` + `login_fields`

## Offline / fetch failure (D-102-12)

If Supabase registry fetch fails after unlock:

- Production shows an error screen (no silent fallback to `builtinCatalog.ts`)
- In-memory session cache is reused on subsequent loads within the same tab session after a successful fetch

## App functional check

1. `npm run dev` → unlock vault
2. Manage Services shows banks/health/shopping from registry
3. Add custom site → `service_registry` row with `owner_user_id` + `source_type=user`
4. Discovery persists `login_url` when confidence rules pass
5. Re-add / re-open service with valid URL → discovery skipped

## Identity note

Anonymous auth (Phase 101) still required for registry access. Registered login deferred to Phase 190.

## Phase 102 stabilization (operator-approved)

Tile open from the Digital Home (`Dashboard`) behavior:

| Rule | Phase 102 |
|---|---|
| Open target | `loginUrl` when cached in registry, else `primaryUrl` |
| Tab lifetime | Normal browser tab — **never** auto-closed by discovery/autofill |
| Validated generic autofill | **Shufersal, Clalit** via `adapterId: generic` (Phase 2 regression preserved) |
| Other built-ins / custom | Open only until Phase 103 |
| Execution path | Adapter registry when `adapter_id` set; otherwise `window.open` |
| Discovery on tile click | **Disabled** — discovery runs only when adding a custom service |

Apply migration `20260706120000_phase102_restore_generic_autofill.sql` so registry rows for Shufersal and Clalit carry `adapter_id = generic`.

Static check: `node scripts/verifyPhase102TileRegression.mjs`

Reload the browser extension after Hub updates if autofill POC behavior was cached.

### Phase 103 handoff (not in scope for 102)

Phase 103 must deliver unified execution:

- Services with and without registry `login_fields` enter the **same** pipeline
- Remove dependence on `GENERIC_REAL_SITE_ALLOWED_HOSTS` (Shufersal/Clalit POC allowlist) in `extension/background.js`
- Optional autofill after open, gated by capability — not by seed shape

See `src/execution/serviceExecution.ts` module comment.
