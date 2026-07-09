# Migration Guide — Phase 107 (Admin Management Platform)

Phase 107 adds an operator admin console at `#/admin` for catalog curation and integration health review. **No credential plaintext access** (AC-107-7, ADR-002).

## Prerequisites

- Phases 101–104 migrations applied
- Supabase project with anonymous auth enabled (existing Hub setup)
- `npm run build` passes after applying this migration

## Apply migration

```bash
# Via Supabase CLI (recommended)
supabase db push

# Or apply manually:
# supabase/migrations/20260709120000_phase107_admin_auth_rls.sql
```

## Bootstrap admin operator (`is_admin`)

After the operator signs in once (creates `public.users` row via existing auth flow):

```sql
-- Replace with your auth.users UUID from Supabase dashboard or local session
update public.users
set is_admin = true
where id = '<auth-users-uuid>';
```

Verify:

```sql
select id, is_admin from public.users where is_admin = true;
```

**Never commit production operator UUIDs.** Optional dev-only seed may remain commented in migration files.

## Authorization model

| Layer | Mechanism |
|---|---|
| Client gate | `AdminGate` reads `users.is_admin` for `auth.uid()` |
| Server | `public.is_admin()` SECURITY DEFINER helper |
| RLS | Additive policies on `categories` and `service_registry` |

**No `service_role` key in the browser.** Authenticated session + RLS only.

## Admin RLS summary

| Table | Policy | Operation | Condition |
|---|---|---|---|
| `categories` | `categories_admin_*` | INSERT, UPDATE, DELETE | `is_admin()` |
| `service_registry` | `service_registry_admin_select_all` | SELECT | `is_admin()` — all rows |
| `service_registry` | `service_registry_admin_global_*` | INSERT, UPDATE, DELETE | `is_admin()` AND `owner_user_id IS NULL` |
| `service_registry` | `service_registry_admin_user_review` | UPDATE | `is_admin()` AND `owner_user_id IS NOT NULL` |

**No admin policies** on `encrypted_credentials`, `access_profiles`, or `user_services`.

## SECURITY DEFINER RPCs

Each validates `is_admin()` internally:

| RPC | Purpose |
|---|---|
| `promote_user_submission(p_user_service_id, p_global_service_id?)` | Atomic approval → global `approved_global` row + provenance metadata |
| `admin_update_login_url(p_service_id, p_login_url, p_login_fields?, p_login_url_status?)` | Manual login URL edit on global rows (`built_in`, `admin`, `approved_global`) |

Existing `persist_discovered_login_url` remains narrow (global `built_in` discovery cache). Admin rediscovery uses `admin_update_login_url` after extension discovery.

## Approval flow

```text
User row (source_type=user, owner_user_id set)
  → Admin reviews in ApprovalQueue
  → Approve: promote_user_submission RPC
       same id → UPDATE row in-place: owner_user_id=NULL, source_type=built_in, service_status=active
       alternate id → INSERT new built_in row; user private row remains
       metadata.provenance ← promotedFromUserId, promotedFromServiceId, promotedAt, promotedBy
  → Reject: direct UPDATE user row service_status=disabled (+ metadata rejectionReason)
```

## Login URL refresh flow

```text
Admin selects global service
  → Manual edit: admin_update_login_url → login_url_status=valid
  → Mark invalid: UPDATE login_url_status=invalid
  → Rediscovery: discoverLogin (extension) → admin_update_login_url
  → Integration status panel reads registry metadata
```

**Operator prerequisite:** browser extension available for automated rediscovery; manual edit always available.

## Canonical enums (check constraints)

**`source_type`:** `built_in`, `user`, `admin`, `approved_global`

**`service_status`:** `active`, `pending_review`, `deprecated`, `disabled`

## Icon management (AC-107-5 interim)

Phase 107 edits metadata only:

- `icon` column (emoji / short text)
- `metadata.faviconSiteUrl`
- `metadata.iconSource`

**Deferred to Phase 111:** Supabase Storage upload, normalization, versioning, auto-discovery pipeline.

## Registry cache invalidation (D-107-12)

All admin writes call `clearRegistryCatalogCache()` in `adminRegistryApi.ts`. Hub clients reload catalog on next fetch; operator may refresh the end-user app to see changes immediately.

## Verification

```bash
node scripts/verifyPhase107Admin.mjs
npm run build
node scripts/verifyPhase102Registry.mjs   # regression
```

## AC-107-7 affirmation

Admin platform **must not**:

- Query `encrypted_credentials`
- Import or call `vault/crypto` decrypt paths
- Use `service_role` in client bundle or `VITE_*` env
- Expose credential field values or `access_profiles` secret UI

Static proof: `scripts/verifyPhase107Admin.mjs`.
