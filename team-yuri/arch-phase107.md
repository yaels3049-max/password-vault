# Architecture Phase 107

## Phase Identifier
PHASE=107

## Status
STATUS: READY_FOR_MANAGER

## Phase Goal
Deliver an **Admin Management Platform** — a separate operational console for **catalog curation** and **integration health review**: category management, global `service_registry` CRUD, user-submission approval, login URL refresh/rediscovery, interim icon metadata editing, and integration status visibility — while **never** accessing user credential plaintext (AC-107-7, ADR-002).

Phase 107 owns **admin surfaces, admin authorization, and registry/category write policies** for platform operators. It does not own end-user Digital Home (105), Service Management (104), full icon asset pipeline (111), browser packaging (108), or production account registration UX (190).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=107`
- `team-Yuri/PLAN.md` §6 — Service Registry; §15 — Admin Architecture; §18 — Phase 107 (AC-107-1 … AC-107-7)
- `docs/DECISIONS.md` — ADR-002 Zero-Knowledge
- `team-Yuri/arch-phase102.md` — APPROVED; `service_registry`, RLS, `persist_discovered_login_url` RPC
- `team-Yuri/arch-phase103.md` — execution pipeline (read-only; admin does not change)
- `team-Yuri/arch-phase104.md` — user custom services create `source_type=user` rows
- `supabase/migrations/20260702121500_phase101_schema.sql` — `categories`, `service_registry`, `users`
- `supabase/migrations/20260703120200_phase102_rls_delta.sql` — client cannot write global registry today
- `src/registry/loginUrlDiscovery.ts` — discovery + persist patterns (reuse for admin refresh)
- `src/registry/registryLoader.ts` / `registryMapper.ts` — registry row shape, `login_url_status`, `adapter_id`

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-107-1: Separate admin surface** | PLAN §15; P5 execution vs management | Admin console is **not** part of Digital Home or Service Management. Dedicated route/shell (e.g. `/admin`) with its own navigation. End-user primary nav does not expose admin entry to non-admins. Hebrew RTL admin UI. |
| **D-107-2: Admin authorization (interim)** | AC-107-7; Phase 190 deferred | Introduce **`users.is_admin boolean not null default false`** (migration). Helper `public.is_admin()` (SECURITY DEFINER, stable) returns true when `auth.uid()` has `is_admin`. **No `service_role` key in browser.** Phase 107 uses existing Supabase Auth session + admin flag — not full Phase 190 account product UX. Dev/bootstrap: seed one admin user via migration/SQL doc; production assignment is operational (out of band). |
| **D-107-3: Admin RLS for platform tables** | AC-107-1, AC-107-2, AC-107-3 | Add RLS policies gated by `is_admin()` for: **`categories`** INSERT/UPDATE/DELETE; **`service_registry`** SELECT all rows (for review queue); global row (`owner_user_id IS NULL`) INSERT/UPDATE/DELETE; controlled UPDATE on user rows for **approval promotion** fields only. Regular authenticated users retain Phase 102 policies unchanged. |
| **D-107-4: Global registry CRUD** | AC-107-2 | Admins maintain **global** catalog entries (`owner_user_id IS NULL`) with `source_type` in (`built_in`, `admin`, `approved_global`). CRUD covers: `id`, `display_name`, `primary_url`, `login_url`, `login_fields`, `category_id`, `adapter_id`, `icon`, `metadata`, `service_status`. Stable `id` required — breaking id changes need explicit migration strategy (discourage in UI). |
| **D-107-5: Category management** | AC-107-1 | Admins CRUD `categories` (`id`, `display_name`, `sort_order`). `id` is stable key referenced by `service_registry.category_id`. Hebrew `display_name` supported. Reorder via `sort_order`. |
| **D-107-6: User submission approval** | AC-107-3, PLAN lifecycle | **Approval queue** lists user-owned registry rows (`owner_user_id IS NOT NULL`, `source_type = user`) optionally filtered by `service_status = pending_review` when that status is used. **Approve** promotes to **global** catalog: create or update global row (`owner_user_id = NULL`, `source_type = approved_global`, `service_status = active`) with curated metadata; record provenance in `metadata` (e.g. `promotedFromUserId`, `promotedFromServiceId`, `promotedAt`). **Reject** sets user row `service_status = disabled` or admin-visible rejection flag — user private row may remain in vault but hidden from global discover. User keeps private definition; global gains curated entry (PLAN governance). |
| **D-107-7: Login URL refresh** | AC-107-4 | Admin actions on global (and promotable) services: **manual edit** `login_url` + `login_fields`; **mark invalid** (`login_url_status = invalid`) to allow rediscovery; **trigger rediscovery** reusing existing `discoverLogin` + persist path (`discoverAndPersistLoginUrl` / admin-wrapped RPC where global writes require elevated path). Extend or add **admin SECURITY DEFINER RPC** for global `login_url` updates beyond `persist_discovered_login_url` narrow cache contract if needed. Discovery runs with extension available (document operator prerequisite). |
| **D-107-8: Icon management (interim)** | AC-107-5, Phase 111 boundary | Phase 107 allows **metadata-level** icon editing only: `icon` (emoji/text), `metadata.faviconSiteUrl`, optional `metadata.iconSource` — **no** Supabase Storage upload pipeline, normalization, or versioning (Phase 111). Execution and tiles must tolerate missing/broken icons (existing fallbacks). |
| **D-107-9: Integration status view** | AC-107-6 | Read-only admin panel per service showing: `adapter_id` (generic vs site-specific), `login_url_status`, `login_url` presence, `metadata.discoveryMethod`, `metadata.integrationHealth` (if present), `updated_at`, last discovery outcome from `metadata` (structure documented in Manager plan). No new telemetry pipeline required in 107 — display registry truth + manual admin notes field in `metadata` if useful. |
| **D-107-10: Zero credential access** | AC-107-7, ADR-002 | Admin platform **must not** query `encrypted_credentials`, decrypt vault blobs, or display credential field values. No admin UI for `access_profiles` secrets. Admin code paths statically verifiable — no imports from `vault/crypto` decrypt paths for display. |
| **D-107-11: No execution/administration blur** | P5, Phase 104/105 | Admin console does not open services for end-user autofill, does not manage user `user_services` selections, does not edit user vault state. Registry/catalog metadata only. |
| **D-107-12: Registry cache invalidation** | Phase 102 runtime | After admin writes, clear/invalidate client registry catalog cache (`clearRegistryCatalogCache`) so Hub reload reflects changes — document operator refresh; optional auto-invalidate on admin save success. |

### Normative approval flow

```text
User-owned row (source_type=user, owner_user_id set)
  → Admin reviews in queue
  → Approve:
       global row (owner_user_id=NULL, source_type=approved_global, service_status=active)
       metadata.provenance ← user submission reference
  → Reject:
       user row service_status=disabled (or pending_review cleared)
       no global row created
```

### Normative login URL refresh flow

```text
Admin selects global service
  → Option A: manual edit login_url + login_fields → login_url_status=valid
  → Option B: mark login_url_status=invalid → trigger rediscovery
  → Rediscovery: discoverLogin → persist via admin RPC / existing persist path
  → Integration status view updates from registry fields
```

## Constraints / Non-Negotiables
- Admin **never** views credential plaintext (AC-107-7).
- No `service_role` key in client bundle (Phase 102 constraint preserved).
- No changes to `executeServiceFromTile` orchestration or vault encryption (AC-107-7 implicit).
- Global built-in seed ids (`shufersal`, `clalit`, etc.) must remain stable unless explicit migration.
- Hebrew admin UI; friendly errors — no raw stack traces in production admin surfaces.
- Phase 100 `isDevBuild()` / practice service rules unchanged for end-user app.

## Technical Boundaries / Out of Scope
- Full Phase 111 icon pipeline (Storage, normalization, versioning, auto-discovery).
- Phase 108 browser store packaging.
- Phase 109 credential lifecycle UX.
- Phase 113 URL canonicalization engine.
- Phase 150+ subscription gating in admin.
- Phase 190 full registration/login product UX (interim `is_admin` flag only).
- Enterprise org admin, SSO, audit log product (future).
- Automated integration health scoring from live fill telemetry (display existing metadata only in 107).
- End-user Service Management or Digital Home redesign.

## Dependencies and Interfaces

### Upstream (must be complete)

| Phase | Provides |
|-------|----------|
| 101 | Supabase schema, RLS baseline, `users`, ciphertext tables |
| 102 | `service_registry` runtime catalog, user-owned rows, discovery RPC |
| 103 | Execution metadata fields (`adapter_id`, `login_fields`) — read-only |
| 104 | User custom services create `source_type=user` rows for approval queue |

### Hub modules (Developer — target ownership)

| Module | Responsibility |
|--------|----------------|
| New `src/admin/` or `src/screens/Admin/` | Admin shell, routing, gate, section pages |
| `src/admin/AdminGate.tsx` | Redirect/deny non-admins; load `is_admin` |
| `src/admin/CategoriesAdmin.tsx` | Category CRUD (AC-107-1) |
| `src/admin/RegistryAdmin.tsx` | Global registry CRUD (AC-107-2) |
| `src/admin/ApprovalQueue.tsx` | User submission review + promote/reject (AC-107-3) |
| `src/admin/LoginUrlRefresh.tsx` | Manual edit + invalid + rediscovery trigger (AC-107-4) |
| `src/admin/IconMetadataEditor.tsx` | Interim icon fields (AC-107-5) |
| `src/admin/IntegrationStatusPanel.tsx` | Status display (AC-107-6) |
| `src/admin/adminRegistryApi.ts` | Supabase mutations/queries under admin RLS |
| `supabase/migrations/*_phase107_*` | `is_admin`, RLS policies, admin RPCs |
| `src/App.tsx` | Admin route registration (gated); no admin link for non-admins |
| `src/registry/loginUrlDiscovery.ts` | **Reuse** discovery orchestration; optional thin admin wrapper |
| `scripts/verifyPhase107Admin.mjs` | Static verification |

### Data interfaces

| Store | Admin role |
|-------|------------|
| `categories` | Full CRUD (admin) |
| `service_registry` (global) | Full CRUD (admin) |
| `service_registry` (user-owned) | SELECT all (admin); promote/reject updates |
| `users.is_admin` | Read self; admin flag checked via RLS helper |
| `encrypted_credentials`, vault | **No access** |

## Data / State Considerations
- `service_status` values: extend/check constraint if needed for `pending_review`, `disabled`, `deprecated` per PLAN lifecycle (document canonical set in Manager plan).
- `source_type` values: add `approved_global`, `admin` if not already in check constraint.
- Promotion must not orphan user `user_services` / vault references — global id may differ from user private id; provenance metadata required when ids diverge.
- Admin edits bump `updated_at`; consider `metadata_version` increment on global publish (optional in 107; document if deferred).
- Catalog cache: Hub clients may need reload after admin publish — document in migration guide.

## Security / Privacy Considerations
- Admin gate enforced **both** in UI and RLS — UI-only gate is insufficient.
- Admin SELECT on user registry rows exposes **metadata only** (URLs, names) — not credentials. Treat URLs as operational data, not secrets.
- SECURITY DEFINER RPCs for admin global writes must validate `is_admin()` inside function body.
- Audit fields (`metadata.lastAdminEdit`, `metadata.lastAdminUserId`) recommended — no PII beyond admin auth uid.
- No logging of `login_fields` values beyond admin form session (never credentials).

## Testing and Lint Expectations
- `npm run build` passes.
- `npx tsc -b` passes (via build).
- Add `scripts/verifyPhase107Admin.mjs` — static checks: admin modules exist; **no** `encrypted_credentials` / vault decrypt imports in `src/admin/**`; admin route gated; no `service_role` in client env usage; global registry write paths use admin API layer.
- SQL migration tests via `scripts/verifyPhase107Admin.mjs` or companion SQL smoke (Manager defines).
- Manual matrix: admin user can CRUD category + global service; non-admin denied; approve promotes row; login URL refresh; integration status visible; **no credential screens**.

## Functional Testability

- **Page/screen:** `/admin` (or configured admin path) after unlock + admin auth
- **User-visible behavior:**
  - Non-admin → access denied / redirect
  - Categories list + create/edit/reorder
  - Global registry list + create/edit/delete
  - Approval queue → approve creates global `approved_global` row; reject disables submission
  - Login URL manual edit + rediscovery trigger
  - Icon emoji / favicon URL edit
  - Integration status panel per service
  - **No** credential or vault secret UI
- **Command-line:** `node scripts/verifyPhase107Admin.mjs`
- **Minimal end-to-end flow:**
  1. Sign in as admin (`is_admin=true`)
  2. Create category; create global admin service
  3. Review user-submitted row → approve → appears in global catalog load (after cache clear)
  4. Mark login URL invalid → trigger rediscovery → `login_url_status` updates
  5. Sign in as non-admin → `/admin` blocked
  6. Confirm `encrypted_credentials` never queried from admin code paths
- **Expected:** AC-107-1 … AC-107-7 satisfied

## Handoff Notes for Manager

1. Publish AC-107-1 … AC-107-7 verbatim with milestone mapping.
2. Suggested milestones: (M1) `is_admin` migration + RLS + AdminGate → (M2) categories CRUD → (M3) global registry CRUD → (M4) approval queue promote/reject → (M5) login URL refresh/rediscovery → (M6) interim icon metadata editor → (M7) integration status panel → (M8) verify script + `docs/MIGRATION_PHASE_107.md` + manual matrix.
3. **Bootstrap:** Document how to set `is_admin=true` for operator account in dev (SQL snippet in migration doc).
4. **RPC scope:** Manager must specify whether global registry writes use direct admin RLS or SECURITY DEFINER RPCs — prefer RLS where sufficient; RPC for promotion atomicity if needed.
5. **Phase 111 deferral:** AC-107-5 satisfied by emoji/favicon metadata only — document Storage upload as Phase 111.
6. **Regression:** Re-run `verifyPhase102Registry.mjs` / catalog load scripts if present; Phase 103 execution static unchanged.
7. Developer evidence: `dev-phase107.md` with build, verify script, manual matrix, explicit AC-107-7 affirmation (no credential queries).

## Architect Review
ARCHITECT_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
_Pending Manager plan, Developer implementation, and evidence._

### Required Corrections
_None at architecture authoring._
