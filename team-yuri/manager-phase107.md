# Manager Phase 107

## Phase Identifier
PHASE=107

## Status
STATUS: READY_FOR_DEVELOPER — **M9 Admin Console UI/UX Modernization**

## Scheduling (critical)
- Current `team-Yuri/PHASE.md` is **`PHASE=113`** — **do not change it**.
- Run Admin **M9 as a parallel track** OR after Phase 113 Credential M7.
- **Do not** fold Admin redesign into Phase 113 / Credential Details work.
- Ownership remains Phase **107** (AC-107-8…18 / D-107-13…20).

## Phase Goal
Deliver an **Admin Management Platform** — a separate operational console for **catalog curation** and **integration health review**: category management, global `service_registry` CRUD, user-submission approval, login URL refresh/rediscovery, interim icon metadata editing, and integration status visibility — while **never** accessing user credential plaintext (AC-107-7 / AC-107-18, ADR-002).

**UX bar (M9):** The console must feel like a **premium Digital Home management app**, not a legacy CRUD editor — same visual language as Digital Home (Heebo, colors, radius, spacing, cards, shadows, buttons).

Phase 107 owns **admin surfaces, admin authorization, and registry/category write policies** for platform operators. It does not own end-user Digital Home (105), Service Management (104), full icon asset pipeline (111), browser packaging (108), or production account registration UX (190).

## Source References
- `team-Yuri/arch-phase107.md` — READY_FOR_MANAGER; **Admin Console UI Modernization** (D-107-13…20); Handoff Notes
- `team-Yuri/PLAN.md` §6 — Service Registry lifecycle and governance
- `team-Yuri/PLAN.md` §12 — Product Governance / approval workflow
- `team-Yuri/PLAN.md` §15 — Admin Architecture
- `team-Yuri/PLAN.md` §18 — Phase 107 acceptance criteria (**AC-107-1 … AC-107-18**); changelog **5.33**
- `team-Yuri/PHASE.md` — currently `PHASE=113` (parallel-track; do not rewrite to 107 for M9 alone)
- `docs/DECISIONS.md` — ADR-002 Zero-Knowledge Architecture
- `team-Yuri/arch-phase102.md` — `service_registry`, RLS, `persist_discovered_login_url` RPC
- `team-Yuri/arch-phase104.md` — user custom services (`source_type=user`)
- Primary M9 targets: `src/admin/**` (`AdminApp`, `RegistryAdmin`, `ApprovalQueue`, `CategoriesAdmin`, `IntegrationStatusPanel`, `admin.css`)
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
- **Digital Home visual parity (D-107-13, AC-107-8):** Heebo, type scale, BG/shell colors, primary/secondary, radius, spacing, button/card/shadow/icon styles; RTL Hebrew.
- **Website cards (D-107-14, AC-107-9):** Icon, name, category, status, login URL when set, added date, added-by origin — not dense CRUD lists.
- **More Details modal (D-107-15, AC-107-10):** Technical IDs/JSON/adapter/source_type/diagnostics behind «פרטים נוספים» only.
- **Nav copy (D-107-16, AC-107-11):** «אתרים מובנים»; «אתרים בהוספה ע"י משתמשים»; אתר/אתרים glossary.
- **Pending queue cards (D-107-17, AC-107-12):** Submitted date/by, preview icon, category, Approve, Reject.
- **Home URL + optional Login URL (D-107-18, AC-107-13):** No jargon; empty login → Home URL for Digital Home.
- **Compact edit (D-107-19, AC-107-15):** Collapsible sections; Save/Cancel.
- **Search & filters (D-107-20, AC-107-16, AC-107-17):** Filters + search; responsive; no unnecessary horizontal scroll.
- **Category auto-code (D-107-5 amended, AC-107-14):** Name (+ optional icon) only; system generates unique code/id.
- **Presentation-only integrity (AC-107-18):** Do not change registry/approval/discovery business logic unless an AC requires it. Preserve AC-107-7 zero credential access.

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
| AC-107-8 | Admin console visual design matches Digital Home (typography, colors, radius, spacing, cards, buttons, shadows, icons) |
| AC-107-9 | Built-in websites are presented as modern cards showing icon, name, category, status, login URL when set, added date, and added-by origin |
| AC-107-10 | Technical identifiers, raw metadata/JSON, adapter internals, and UUIDs are hidden by default and available only via an explicit «פרטים נוספים» / More Details modal |
| AC-107-11 | Navigation labels use «אתרים מובנים» and «אתרים בהוספה ע"י משתמשים» (or equivalent Hebrew); admin UI uses אתר/אתרים glossary |
| AC-107-12 | Pending user websites queue shows submitted date, submitted by, preview icon, category, approve, and reject in a card-friendly layout |
| AC-107-13 | Admin can configure Home URL and optional Login URL for websites without exposure to implementation jargon; missing Login URL means Digital Home uses Home URL |
| AC-107-14 | Category creation collects name (and optional icon) only; the system generates a unique category code/id |
| AC-107-15 | Website edit uses compact sections / collapsible groups with clear Save and Cancel (not oversized full-page forms) |
| AC-107-16 | Admin can filter by category, built-in, custom, user-submitted, active, inactive and search by website name, category, or login URL |
| AC-107-17 | Admin screens are usable on desktop/tablet/laptop without unnecessary horizontal scrolling or oversized controls |
| AC-107-18 | Existing approval, registry write policies, rediscovery, and zero-credential-access rules remain intact (presentation changes only unless an AC above requires behavior) |

**Keep AC-107-1…7 intact.** M9 adds presentation + limited UX functional improvements (AC-107-8…18) without regressing platform gates.

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
| **M9** | **Admin Console UI/UX Modernization** | DH visual parity; website cards; More Details; nav rename; pending cards; Home/Login URL copy; auto category codes; compact edit; filters/search; evidence | Screenshots + AC-107-8…18; AC-107-7/18 still affirmed | AC-107-8…18 (preserve 1…7) |

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

### M9 — Admin Console UI/UX Modernization (AC-107-8…18 / D-107-13…20)

**Scheduling:** Parallel to Phase 113 **or** after 113 Credential M7. **Do not** implement under Phase 113. Do not change `PHASE.md`.

**Primary rule:** UI/UX primary. Do **not** change registry/approval/discovery business logic unless an AC requires it. Preserve **zero admin credential access** (AC-107-7, AC-107-18). Prefer Phase 111 Storage icons on cards when present (same DH paint cascade).

**Targets:** `src/admin/**` — `AdminApp`, `RegistryAdmin`, `ApprovalQueue`, `CategoriesAdmin`, `IntegrationStatusPanel`, `admin.css` (+ shared design tokens if already used by Digital Home).

#### M9.1 — Visual parity with Digital Home (AC-107-8 / D-107-13)
- Heebo font, type scale, BG/shell colors, primary/secondary, border-radius, spacing.
- Cards, buttons, shadows, icons match Digital Home language.
- RTL Hebrew throughout admin shell.
- Premium management feel — not a separate “legacy admin skin”.

#### M9.2 — Website cards (AC-107-9 / D-107-14)
Primary card fields for built-in / global catalog:
- Icon (DH cascade)
- Name
- Category
- Status
- Login URL (when set)
- Added date
- Added-by origin: **Built-in** / **Administrator** / **username** (Hebrew origin wording OK)
- Compact cards — no full-width oversized fields dominating layout.

#### M9.3 — «פרטים נוספים» / More Details modal (AC-107-10 / D-107-15)
Hidden by default; modal only:
- Global ID / UUIDs
- Raw metadata / JSON
- Adapter name / `adapter_id`
- `source_type`
- Internal status enums / flags
- Validation/build / discovery diagnostics
- Integration status fields (AC-107-6) surface primarily here after modernization

#### M9.4 — Nav rename (AC-107-11 / D-107-16)
- «קטלוג גלובלי» → **«אתרים מובנים»**
- «תור אישורים» → **«אתרים בהוספה ע"י משתמשים»**
- Use אתר/אתרים glossary in Hebrew admin UI

#### M9.5 — Pending queue cards (AC-107-12 / D-107-17)
Card-friendly (not dense CRUD table):
- Submitted date
- Submitted by
- Preview icon
- Category
- Approve / Reject actions
- **Do not** change promote/reject semantics (AC-107-3 / AC-107-18)

#### M9.6 — Home URL + optional Login URL (AC-107-13 / D-107-18)
- Every website: **Home URL** + optional **Login URL** (friendly labels — no `primary_url` / adapter jargon in primary UI)
- Helper copy: if Login URL empty, Digital Home uses Home URL
- Applies to custom/promoted websites as configured today

#### M9.7 — Category create auto-code (AC-107-14 / D-107-5 amended)
- Admin enters **name** (+ optional icon) only
- System generates unique category code/`id` (slug + uniqueness; document in migration note if needed)
- Admin never types technical identifiers for create

#### M9.8 — Compact collapsible edit (AC-107-15 / D-107-19)
- Edit website like credential modal: compact sections, collapsible groups
- Clear **Save** / **Cancel**
- Not huge vertical full-page forms

#### M9.9 — Filters + search + responsive (AC-107-16, AC-107-17 / D-107-20)
**Filters:** category, built-in, custom, user-submitted, active, inactive  
**Search:** website name, category, login URL  
**Responsive:** desktop / tablet / laptop usable; no unnecessary horizontal scroll; no oversized controls

#### M9.10 — Evidence (AC-107-18 + AC-107-7)
Screenshots required:
1. Built-in website cards (all primary fields visible)
2. Pending queue cards (date/by/icon/category/approve/reject)
3. Category create (name + optional icon; **no** manual code field)
4. Compact edit + Save/Cancel
5. «פרטים נוספים» modal with technical fields
6. Filters / search in use
7. Nav labels showing new Hebrew names

Plus:
- Re-run `node scripts/verifyPhase107Admin.mjs` — still affirms **no credential access**
- Explicit AC-107-7 / AC-107-18 affirmation in `dev-phase107.md` (M9 section)
- `npm run build` PASS
- Brief note in `docs/MIGRATION_PHASE_107.md` (or addendum) for M9 UX + category auto-id

#### M9 AC mapping

| Work item | AC | Decision |
|---|---|---|
| Visual parity | AC-107-8 | D-107-13 |
| Website cards | AC-107-9 | D-107-14 |
| More Details modal | AC-107-10 | D-107-15 |
| Nav rename | AC-107-11 | D-107-16 |
| Pending cards | AC-107-12 | D-107-17 |
| Home + optional Login URL | AC-107-13 | D-107-18 |
| Category auto-code | AC-107-14 | D-107-5 |
| Compact edit | AC-107-15 | D-107-19 |
| Filters + search | AC-107-16 | D-107-20 |
| Responsive | AC-107-17 | D-107-20 |
| Integrity / no credential access | AC-107-18 (+ AC-107-7) | D-107-10 |

#### M9 out-of-scope reminders
- Phase 113 Credential Details / Login Assistance work
- Changing approval/promote/reject/rediscovery semantics
- Credential / vault / decrypt UI
- Full Phase 111 icon upload pipeline (prefer existing Storage assets when present)
- End-user Digital Home redesign

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
| T23 | DH visual parity | Open `/admin` next to Digital Home | Typography/colors/radius/spacing/cards/buttons match DH language | AC-107-8 |
| T24 | Website cards | View «אתרים מובנים» | Cards show icon, name, category, status, login URL (if set), added date, added-by | AC-107-9 |
| T25 | More Details | Open «פרטים נוספים» | IDs/JSON/adapter/source_type/diagnostics only in modal; not primary layout | AC-107-10 |
| T26 | Nav rename | Inspect admin nav | «אתרים מובנים» + «אתרים בהוספה ע"י משתמשים» | AC-107-11 |
| T27 | Pending cards | Open user-submission queue | Date, by, preview icon, category, Approve, Reject | AC-107-12 |
| T28 | Home / Login URL | Edit website URLs | Friendly labels; empty Login → copy that Home is used | AC-107-13 |
| T29 | Category auto-code | Create category with name only | Unique code generated; no manual code input required | AC-107-14 |
| T30 | Compact edit | Edit website | Collapsible sections; Save/Cancel; not oversized form | AC-107-15 |
| T31 | Filters + search | Apply filters; search name/category/login URL | Results match filters; search works | AC-107-16 |
| T32 | Responsive | Desktop + tablet/laptop widths | Usable; no unnecessary horizontal scroll | AC-107-17 |
| T33 | Integrity + no credentials | Approve/reject/rediscovery still work; verify script | Semantics intact; verify still PASS; no credential UI | AC-107-18, AC-107-7 |

## Required Developer Evidence
`team-Yuri/dev-phase107.md` must include:

| Evidence area | Required content |
|---|---|
| Files changed | Full list including migrations, `src/admin/**`, `App.tsx` |
| M1–M8 milestones | Completion table (prior platform work) |
| **M9 milestone** | Completion table for M9.1–M9.10 |
| M8/M9 static verify | `node scripts/verifyPhase107Admin.mjs` (**PASS**) after M9 |
| **AC-107-7 affirmation** | Explicit: no `encrypted_credentials` queries; no vault decrypt in admin; no `service_role` in client |
| **AC-107-18 affirmation** | Approval/registry/rediscovery unchanged except AC-required presentation/UX; no credential access |
| Bootstrap SQL | How dev admin user was granted `is_admin=true` |
| Functional matrix | T1–T33 results (or N/A with reason) |
| Approval flow | Screenshot or log: promote + reject paths |
| Login URL refresh | Manual edit + rediscovery observation |
| **M9 screenshots** | Built-in cards; pending cards; category create (no manual code); compact edit; More Details; filters; nav labels |
| Phase 111 deferral | Prefer Storage icons when present; no new Storage pipeline under M9 |
| Documentation | `docs/MIGRATION_PHASE_107.md` (+ M9 / category auto-id note) |
| Build | `npm run build` (**PASS**) |
| Regression | `verifyPhase102Registry.mjs` (and Phase 103 if applicable) |
| Scheduling note | Affirm work not folded into Phase 113 |
| Tests / lint | Result or NOT AVAILABLE with reason |

## Out of Scope (must not be implemented)
- Full Phase 111 icon pipeline (Storage, normalization, versioning, auto-discovery) — cards may **consume** existing 111 assets
- Phase 108 browser store packaging
- Phase 109 / **113** credential lifecycle / Credential Details / Login Assistance (do not merge Admin M9 into 113)
- Phase 116 URL canonicalization engine
- Phase 150+ subscription gating in admin
- Phase 190 full registration/login product UX (`is_admin` flag only this phase)
- Enterprise org admin, SSO, audit log product
- Automated integration health scoring from live fill telemetry
- End-user Digital Home or Service Management redesign (Admin may **match** DH visual language only)
- Changing approval/promote/reject/rediscovery **business logic** unless an AC requires it
- Admin autofill / execution / vault editing
- Querying or displaying `encrypted_credentials` ciphertext or decrypted values

## Risks / Open Questions
- **UI-only admin gate is insufficient** — RLS must enforce all writes; verify with non-admin direct Supabase client attempts.
- **Promotion id divergence** — global id may differ from user private id; provenance metadata mandatory.
- **Rediscovery requires extension** — document operator prerequisite; manual edit fallback always available.
- **Built-in seed stability** — discourage destructive deletes; prefer `disabled` / `deprecated`.
- **Catalog cache staleness** — Hub may need reload after admin publish; auto-invalidate on admin save recommended.
- **RLS policy interaction** — admin SELECT policy must not break existing `service_registry_select_visible` for regular users (additive policies).
- **M9 scope creep into Phase 113** — keep Admin redesign under Phase 107 artifacts; leave `PHASE.md` at 113.
- **Category auto-id collisions** — generation must enforce uniqueness (slug + disambiguator).
- **Accidentally changing approve/reject under card UI** — presentation change only; smoke T33.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
- PHASE.md remains **113**. M9 planned as **parallel track** (or after 113 Credential M7) — not merged into 113.
- M9 covers D-107-13…20 / AC-107-8…18; AC-107-1…7 and AC-107-7 zero-credential access preserved.
- STATUS: **READY_FOR_DEVELOPER** — hand off M9 to Sarah.

### Required Corrections
_None at M9 planning._
