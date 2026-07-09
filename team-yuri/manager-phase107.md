# Manager Phase 107

## Phase Identifier
PHASE=107

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Deliver an **Admin Management Platform** — a separate operational console for **catalog curation** and **integration health review**: category management, global `service_registry` CRUD, user-submission approval, login URL refresh/rediscovery, interim icon metadata editing, and integration status visibility — while **never** accessing user credential plaintext (AC-107-7, ADR-002).

Phase 107 owns **admin surfaces, admin authorization, and registry/category write policies** for platform operators. It does not own end-user Digital Home (105), Service Management (104), full icon asset pipeline (111), browser packaging (108), or production account registration UX (190).

## Source References
- `team-Yuri/arch-phase107.md` (READY_FOR_MANAGER)
- `team-Yuri/PLAN.md` §6 — Service Registry lifecycle and governance
- `team-Yuri/PLAN.md` §12 — Product Governance / approval workflow
- `team-Yuri/PLAN.md` §15 — Admin Architecture
- `team-Yuri/PLAN.md` §18 — Phase 107 acceptance criteria (AC-107-1 … AC-107-7)
- `team-Yuri/PHASE.md` — `PHASE=107`
- `docs/DECISIONS.md` — ADR-002 Zero-Knowledge Architecture
- `team-Yuri/arch-phase102.md` — `service_registry`, RLS, `persist_discovered_login_url` RPC
- `team-Yuri/arch-phase104.md` — user custom services (`source_type=user`)
- `supabase/migrations/20260702121500_phase101_schema.sql` — baseline schema
- `supabase/migrations/20260703120200_phase102_rls_delta.sql` — registry visibility + user-owned CRUD

## Architecture Summary (Phase 107 constraints)
- **Separate admin surface (D-107-1, PLAN §15):** Dedicated route/shell (e.g. `/admin`); **not** part of Digital Home or Service Management. End-user primary nav does **not** expose admin entry to non-admins. Hebrew RTL admin UI.
- **Admin authorization interim (D-107-2):** `users.is_admin boolean not null default false` + `public.is_admin()` helper. Existing Supabase Auth session — **no `service_role` key in browser**.
- **Admin RLS (D-107-3):** Platform-table writes gated by `is_admin()`; regular user policies unchanged.
- **Zero credential access (D-107-10, AC-107-7):** Admin **must not** query `encrypted_credentials`, decrypt vault blobs, or display credential values. No admin UI for `access_profiles` secrets. Static verification required.
- **Global registry CRUD (D-107-4, AC-107-2):** Global rows (`owner_user_id IS NULL`); `source_type` in (`built_in`, `admin`, `approved_global`). Stable `id` — discourage breaking id changes in UI.
- **Category management (D-107-5, AC-107-1):** CRUD `categories` (`id`, `display_name`, `sort_order`).
- **Approval queue (D-107-6, AC-107-3):** Review user-owned rows; promote to global `approved_global` or reject to `disabled`.
- **Login URL refresh (D-107-7, AC-107-4):** Manual edit; mark invalid; trigger rediscovery via existing `discoverLogin` + admin-wrapped persist path.
- **Icon management interim (D-107-8, AC-107-5):** Metadata only — `icon` (emoji/text), `metadata.faviconSiteUrl`, optional `metadata.iconSource`. **No** Supabase Storage upload (Phase 111).
- **Integration status (D-107-9, AC-107-6):** Read-only panel — `adapter_id`, `login_url_status`, discovery metadata; no new telemetry pipeline.
- **No execution/administration blur (D-107-11):** Admin does not open services for autofill, manage `user_services`, or edit vault state.
- **Registry cache invalidation (D-107-12):** After admin writes, clear/invalidate client catalog cache (`clearRegistryCatalogCache`).

### Canonical `service_status` values (Phase 107)

| Value | Meaning |
|---|---|
| `active` | Selectable / executable per existing rules |
| `pending_review` | User-submitted; visible to submitter; admin queue |
| `deprecated` | Hidden from new discovery; existing selections may still resolve |
| `disabled` | Not selectable; audit/migration only |

Extend `service_registry` check constraint if not already present.

### Canonical `source_type` values (Phase 107)

| Value | Meaning |
|---|---|
| `built_in` | Product-shipped seeds |
| `user` | End-user private row |
| `admin` | Admin-authored global row |
| `approved_global` | Promoted from user submission |

Extend check constraint if needed; promotion creates **new global row** when ids diverge (PLAN §6).

## Acceptance / Gating Criteria (verbatim — PLAN §18)

| ID | Criterion |
|---|---|
| AC-107-1 | Admin can manage categories |
| AC-107-2 | Admin can CRUD service registry entries |
| AC-107-3 | Admin can approve user-submitted services for global registry |
| AC-107-4 | Admin can trigger login URL refresh / rediscovery |
| AC-107-5 | Admin can manage service icons |
| AC-107-6 | Admin can view integration status (generic vs adapter, last discovery outcome) |
| AC-107-7 | Admin cannot view user credential plaintext |

### AC-107-5 interim interpretation (Phase 111 deferral)
**PLAN §15** references full icon lifecycle (upload, Storage, Phase 111). For Phase 107, AC-107-5 is satisfied by **metadata-level** icon editing only:
- `icon` column (emoji / short text glyph)
- `metadata.faviconSiteUrl` (URL hint for future discovery)
- `metadata.iconSource` (provenance label)

**Out of scope:** Supabase Storage upload, normalization, versioning, auto-discovery pipeline. Document Phase 111 as follow-on.

### Critical security forbid list (AC-107-7)
Developer **must not**:
- Query `encrypted_credentials` from admin code paths
- Import or call `vault/crypto` decrypt paths for display
- Use `service_role` key in client bundle or `VITE_*` env
- Expose credential field values, vault blobs, or `access_profiles` secret UI
- Modify `executeServiceFromTile` orchestration or vault encryption

Evidence must include explicit **AC-107-7 affirmation** plus static verify proof.

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| M1 | `is_admin` migration + RLS + AdminGate | SQL migration; `is_admin()` helper; admin RLS policies; `AdminGate` + `/admin` route | Non-admin denied; admin passes gate; RLS enforced server-side | AC-107-7 (foundation) |
| M2 | Categories CRUD | `CategoriesAdmin.tsx` — list, create, edit, reorder | Admin can CRUD categories | AC-107-1 |
| M3 | Global registry CRUD | `RegistryAdmin.tsx` — global row create/read/update/delete | Admin maintains global catalog entries | AC-107-2 |
| M4 | Approval queue promote/reject | `ApprovalQueue.tsx` — review user submissions; atomic promote/reject | Approve creates `approved_global`; reject disables submission | AC-107-3 |
| M5 | Login URL refresh / rediscovery | `LoginUrlRefresh.tsx` — manual edit, mark invalid, trigger discovery | `login_url_status` updates; rediscovery persists | AC-107-4 |
| M6 | Interim icon metadata editor | `IconMetadataEditor.tsx` — emoji/favicon metadata only | Icon fields editable without Storage | AC-107-5 |
| M7 | Integration status panel | `IntegrationStatusPanel.tsx` — adapter, discovery, health metadata | Status visible per service | AC-107-6 |
| M8 | Verify script + docs + manual matrix | `verifyPhase107Admin.mjs`; `docs/MIGRATION_PHASE_107.md`; build PASS; regression scripts | Static + manual gates PASS; AC-107-7 affirmed | AC-107-7, all ACs |

## Detailed Development Plan

### M1 — `is_admin` migration + RLS + AdminGate

**SQL migration** (`supabase/migrations/*_phase107_admin_auth_rls.sql`):

1. Add column:
```sql
alter table public.users
  add column if not exists is_admin boolean not null default false;
```

2. Helper function:
```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_admin from public.users u where u.id = auth.uid()),
    false
  );
$$;
```

3. Grant execute on `is_admin()` to `authenticated` (read-only helper).

**Admin RLS policies** (additive — do not weaken existing user policies):

| Table | Policy | Operation | Condition |
|---|---|---|---|
| `categories` | `categories_admin_write` | INSERT, UPDATE, DELETE | `is_admin()` |
| `service_registry` | `service_registry_admin_select_all` | SELECT | `is_admin()` — sees **all** rows including `pending_review`, `disabled`, other users' submissions |
| `service_registry` | `service_registry_admin_global_write` | INSERT, UPDATE, DELETE | `is_admin()` AND `owner_user_id IS NULL` |
| `service_registry` | `service_registry_admin_user_review` | UPDATE | `is_admin()` AND `owner_user_id IS NOT NULL` — **limited** to approval fields: `service_status`, `metadata` (provenance/rejection), `updated_at` |

**No new policies** on `encrypted_credentials`, `access_profiles`, or `user_services` for admin — admins have **no path** to credential tables.

**Client:**
- `src/admin/AdminGate.tsx` — load session; check `is_admin` (via `users` row or lightweight RPC); redirect/deny non-admins.
- `src/App.tsx` — register `/admin` route behind gate; **no admin nav link** for non-admins.
- `src/admin/adminRegistryApi.ts` — centralized Supabase mutations under admin RLS.

**Bootstrap `is_admin` SQL** (document in `docs/MIGRATION_PHASE_107.md`):

```sql
-- After operator signs in once (creates public.users row via existing auth flow):
update public.users
set is_admin = true
where id = '<auth-users-uuid>';
```

Optional dev seed in migration (commented or env-gated) — **never** commit real production UUIDs.

### M2 — Categories CRUD (AC-107-1)
- List all categories sorted by `sort_order`.
- Create: stable `id` (slug), Hebrew `display_name`, `sort_order`.
- Edit `display_name` and `sort_order`; reorder (drag or numeric).
- Delete with guard if `service_registry.category_id` references exist (friendly error or reassign prompt).
- Hebrew RTL; friendly errors — no raw stack traces.

### M3 — Global registry CRUD (AC-107-2)
- List/filter global rows (`owner_user_id IS NULL`).
- Create global entry: `id`, `display_name`, `primary_url`, `login_url`, `login_fields`, `category_id`, `adapter_id`, `icon`, `metadata`, `service_status`, `source_type` (`admin` or `built_in` maintenance).
- Update fields; soft-disable via `service_status = disabled` preferred over hard delete for built-ins.
- **Discourage** `id` changes in UI; if required, explicit migration strategy documented.
- On save success: call `clearRegistryCatalogCache()` (D-107-12).

### M4 — Approval queue promote/reject (AC-107-3)

**Normative approval flow:**

```text
User-owned row (source_type=user, owner_user_id set, service_status=pending_review)
  → Admin reviews in ApprovalQueue
  → Approve:
       INSERT or UPDATE global row (owner_user_id=NULL, source_type=approved_global, service_status=active)
       metadata.provenance ← { promotedFromUserId, promotedFromServiceId, promotedAt, promotedBy }
       user row may remain (private definition preserved)
  → Reject:
       UPDATE user row service_status=disabled (or clear pending_review)
       no global row created
```

**RPC decision (Manager specifies):**
- **Prefer direct admin RLS** for reject (user row `service_status` update).
- **Use SECURITY DEFINER RPC `promote_user_submission`** when atomic promote requires INSERT global + UPDATE user + provenance in one transaction. RPC **must** validate `is_admin()` inside body.
- Promotion when global `id` differs from user private `id` — record provenance in `metadata`; do not orphan `user_services` references.

### M5 — Login URL refresh / rediscovery (AC-107-4)

**Normative login URL refresh flow:**

```text
Admin selects global (or promotable) service
  → Option A: manual edit login_url + login_fields → login_url_status=valid
  → Option B: mark login_url_status=invalid → trigger rediscovery
  → Rediscovery: discoverLogin (extension) → persist via admin path
  → Integration status panel reflects updated registry fields
```

**RPC decision (Manager specifies):**
- Existing `persist_discovered_login_url` is **narrow**: global `built_in`, `active`, only when `login_url` null or `login_url_status=invalid`.
- Add **`admin_update_login_url`** SECURITY DEFINER RPC for:
  - Manual admin edit on global rows (`admin`, `approved_global`, `built_in`)
  - Sets `login_url`, `login_fields`, `login_url_status`, `metadata.lastAdminEdit`, `metadata.lastAdminUserId`, `updated_at`
  - Validates `is_admin()` inside function
- Rediscovery trigger: reuse `src/registry/loginUrlDiscovery.ts` (`discoverAndPersistLoginUrl` or admin wrapper calling discovery then `admin_update_login_url` / extended persist).
- Document operator prerequisite: **browser extension available** for automated rediscovery.

### M6 — Interim icon metadata editor (AC-107-5)
- Edit `icon` (emoji/text), `metadata.faviconSiteUrl`, `metadata.iconSource`.
- **No** file upload UI; **no** Supabase Storage bucket wiring.
- Tiles must tolerate missing/broken icons (existing fallbacks).
- Note in UI copy: full icon pipeline is Phase 111.

### M7 — Integration status panel (AC-107-6)
Read-only per-service panel showing registry truth:
- `adapter_id` (generic vs site-specific)
- `login_url_status`, `login_url` presence
- `metadata.discoveryMethod`, `metadata.integrationHealth` (if present)
- `metadata.lastDiscoveryOutcome` or equivalent (structure documented in migration guide)
- `updated_at`, `source_type`, `service_status`
- Optional admin notes field in `metadata.adminNotes`

No live telemetry pipeline required in 107.

### M8 — Verification + docs + manual matrix

**Static:** `scripts/verifyPhase107Admin.mjs` proving:
- `src/admin/**` modules exist (`AdminGate`, section pages, `adminRegistryApi`)
- **No** `encrypted_credentials` table queries or imports in `src/admin/**`
- **No** `vault/crypto` decrypt imports in `src/admin/**`
- **No** `service_role` in client env usage (`VITE_*`, `import.meta.env`)
- Admin route registration + gate reference in `App.tsx`
- Global registry write paths go through `adminRegistryApi` layer (not ad-hoc scattered mutations)
- Migration file references `is_admin` column and `is_admin()` function

**Build:** `npm run build` **PASS**.

**Docs:** `docs/MIGRATION_PHASE_107.md` — bootstrap SQL, RLS summary, RPC list, approval + login URL flows, Phase 111 icon deferral, cache invalidation note.

**Regression:** Re-run `verifyPhase102Registry.mjs` (and Phase 103 execution static if touched); end-user catalog load unchanged for non-admin users.

## Admin RLS / RPC Plan (normative summary)

```text
Authorization layer
├── users.is_admin (boolean, default false)
├── public.is_admin() SECURITY DEFINER helper
└── No service_role in browser — authenticated session only

RLS (additive)
├── categories: admin INSERT/UPDATE/DELETE via is_admin()
├── service_registry:
│   ├── admin SELECT all rows (queue visiblity)
│   ├── admin INSERT/UPDATE/DELETE global rows (owner_user_id IS NULL)
│   └── admin UPDATE user rows (approval fields only)
└── encrypted_credentials / access_profiles: NO admin policies

RPCs (SECURITY DEFINER — each validates is_admin() internally)
├── promote_user_submission(...)     — atomic approval (if RLS insufficient)
├── admin_update_login_url(...)      — manual login URL + fields on global rows
└── (optional) extend persist_discovered_login_url for admin-curated source_types

Direct RLS preferred where sufficient; RPC for atomic promotion and admin login URL writes.
```

## Functional Test Matrix

**Prerequisites:** Supabase migrations applied; one `is_admin=true` user; one regular user; optional user-submitted `pending_review` row; extension for rediscovery UAT; `npm run dev`.

| # | Test | Steps | Expected | AC |
|---:|---|---|---|---|
| T1 | Non-admin denied | Sign in as regular user → navigate `/admin` | Access denied / redirect; no admin nav link | AC-107-7 |
| T2 | Admin gate pass | Sign in as admin → `/admin` | Admin shell loads | M1 |
| T3 | Create category | Admin → Categories → create | New category in DB; visible in list | AC-107-1 |
| T4 | Edit/reorder category | Change `display_name`, `sort_order` | Persisted; sort order reflected | AC-107-1 |
| T5 | Create global service | Admin → Registry → create global row | Row `owner_user_id IS NULL`, `source_type=admin` | AC-107-2 |
| T6 | Update global service | Edit display name, URLs, fields | Persisted; `updated_at` bumps | AC-107-2 |
| T7 | Disable global service | Set `service_status=disabled` | Hidden from normal catalog load | AC-107-2 |
| T8 | Approval queue visible | User submission `pending_review` exists | Admin sees row in queue | AC-107-3 |
| T9 | Approve submission | Approve user row | Global `approved_global` row; provenance metadata | AC-107-3 |
| T10 | Reject submission | Reject user row | `service_status=disabled`; no global row | AC-107-3 |
| T11 | Manual login URL edit | Admin edits `login_url` + fields | `login_url_status=valid` | AC-107-4 |
| T12 | Mark invalid + rediscover | Mark invalid → trigger rediscovery | Status updates; discovery metadata recorded | AC-107-4 |
| T13 | Icon metadata edit | Set emoji + `faviconSiteUrl` | Saved without Storage upload | AC-107-5 |
| T14 | Integration status panel | Open service detail | Shows adapter, login status, discovery metadata | AC-107-6 |
| T15 | No credential UI | Search admin routes/components | No vault/credential/plaintext screens | AC-107-7 |
| T16 | Static credential isolation | Run verify script | No `encrypted_credentials` / decrypt in `src/admin/**` | AC-107-7 |
| T17 | No service_role client | Inspect env + client bundle patterns | No `service_role` usage | AC-107-7 |
| T18 | Cache invalidation | Admin save → reload Hub catalog | Hub reflects admin change after cache clear | D-107-12 |
| T19 | User policies unchanged | Regular user CRUD own registry row | Phase 104 custom service still works | Regression |
| T20 | Built-in seeds stable | List built-in ids | `shufersal`, `clalit`, etc. unchanged unless admin edit | Constraint |
| T21 | Build | `npm run build` | PASS | — |
| T22 | Verify script | `node scripts/verifyPhase107Admin.mjs` | PASS | M8 |

## Required Developer Evidence
`team-Yuri/dev-phase107.md` must include:

| Evidence area | Required content |
|---|---|
| Files changed | Full list including migrations, `src/admin/**`, `App.tsx` |
| M1–M8 milestones | Completion table |
| M8 static verify | `node scripts/verifyPhase107Admin.mjs` (**PASS**) |
| **AC-107-7 affirmation** | Explicit: no `encrypted_credentials` queries; no vault decrypt in admin; no `service_role` in client |
| Bootstrap SQL | How dev admin user was granted `is_admin=true` |
| Functional matrix | T1–T22 results (or N/A with reason) |
| Approval flow | Screenshot or log: promote + reject paths |
| Login URL refresh | Manual edit + rediscovery observation |
| Phase 111 deferral | Note: AC-107-5 metadata-only; Storage deferred |
| Documentation | `docs/MIGRATION_PHASE_107.md` |
| Build | `npm run build` (**PASS**) |
| Regression | `verifyPhase102Registry.mjs` (and Phase 103 if applicable) |
| Tests / lint | Result or NOT AVAILABLE with reason |

## Out of Scope (must not be implemented)
- Full Phase 111 icon pipeline (Storage, normalization, versioning, auto-discovery)
- Phase 108 browser store packaging
- Phase 109 credential lifecycle UX
- Phase 113 URL canonicalization engine
- Phase 150+ subscription gating in admin
- Phase 190 full registration/login product UX (`is_admin` flag only this phase)
- Enterprise org admin, SSO, audit log product
- Automated integration health scoring from live fill telemetry
- End-user Digital Home or Service Management redesign
- Admin autofill / execution / vault editing
- Querying or displaying `encrypted_credentials` ciphertext or decrypted values

## Risks / Open Questions
- **UI-only admin gate is insufficient** — RLS must enforce all writes; verify with non-admin direct Supabase client attempts.
- **Promotion id divergence** — global id may differ from user private id; provenance metadata mandatory.
- **Rediscovery requires extension** — document operator prerequisite; manual edit fallback always available.
- **Built-in seed stability** — discourage destructive deletes; prefer `disabled` / `deprecated`.
- **Catalog cache staleness** — Hub may need reload after admin publish; auto-invalidate on admin save recommended.
- **RLS policy interaction** — admin SELECT policy must not break existing `service_registry_select_visible` for regular users (additive policies).

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes

### Required Corrections
