# Architecture Phase 107

## Phase Identifier
PHASE=107

## Status
STATUS: READY_FOR_MANAGER

CEO FINAL APPROVAL: 2026-09-14 — **APPROVED FOR DEVELOPMENT MANAGER HANDOFF.** Credential mode and input-type controls are approved. Saves must keep `credentialMode` consistent with `login_fields` (D-102-27). Developer execution follows the revised `manager-phase102.md` only.

CEO FINAL APPROVAL: 2026-09-14 — **APPROVED FOR DEVELOPMENT MANAGER HANDOFF** as the administrator configuration surface of the Phase 102 credential-schema amendment. Do not plan Automatic Login Discovery. Rediscovery must not write `login_fields`. Sequencing of Developer work waits on the pending credential-mode amendment.

AMENDED: 2026-09-14 — **MVP Dynamic Credential Fields (configuration surface).** Phase 107 owns administrator configuration of global credential fields. Phase 102 remains the schema owner. Structured field editor is the primary method; raw JSON is not. Rediscovery must not create or modify `login_fields`. See section **Global credential-field configuration**. Security gate in `arch-phase102.md` applies before implementation that changes schema validation or credential serialization. This amendment does not create a new phase.

AMENDED: 2026-07-14 — **Admin Console UI/UX Modernization.** Operator specification: restyle entire Admin console to Digital Home visual identity; website cards; hide technical fields behind «פרטים נוספים»; rename nav; auto category codes; compact edit; filters/search. UI/UX primary; limited functional improvements listed below. Existing registry/approval/discovery business logic preserved unless explicitly changed. Adds **D-107-13 … D-107-20**, **AC-107-8 … AC-107-18**, milestone **M9**. Ownership remains Phase **107** (not 113 Credential Details). Current `PHASE.md` may stay 113 — Manager may run Admin UX as a parallel track or schedule after 113 gate; do not merge Admin redesign into Phase 113 Credential M7.

## Phase Goal
Deliver an **Admin Management Platform** — a separate operational console for **catalog curation** and **integration health review**: category management, global `service_registry` CRUD, user-submission approval, login URL refresh/rediscovery, icon management (interim + Phase 111 assets when present), and integration status visibility — while **never** accessing user credential plaintext (AC-107-7, ADR-002).

**UX bar (2026-07-14):** The console must feel like a **premium Digital Home management app**, not a legacy CRUD / database editor — same typography (Heebo), colors, radius, spacing, cards, shadows, and buttons as Digital Home.

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
| **D-107-5: Category management** | AC-107-1, AC-107-14, AC-107-19, AC-107-20 | Admins manage `categories`. Create/edit UI exposes **display name only**. System **auto-generates** unique technical `id` / code. **No category icon** (create or list). **No numeric «סדר» / sort_order text field** — admins never type an order number. **Amended 2026-07-15 (operator layout):** Categories screen uses the **empty left region** for a **reorder panel** of existing categories (drag-and-drop and/or ↑↓). Reorder persists via underlying `sort_order` (or equivalent) transparently. Right side remains create + name edit + compact Save/Delete + «פרטים נוספים». Hebrew `display_name` supported. |
| **D-107-6: User submission approval** | AC-107-3, PLAN lifecycle | **Approval queue** lists user-owned registry rows (`owner_user_id IS NOT NULL`, `source_type = user`) optionally filtered by `service_status = pending_review` when that status is used. **Approve** promotes to **global** catalog: create or update global row (`owner_user_id = NULL`, `source_type = approved_global`, `service_status = active`) with curated metadata; record provenance in `metadata` (e.g. `promotedFromUserId`, `promotedFromServiceId`, `promotedAt`). **Reject** sets user row `service_status = disabled` or admin-visible rejection flag — user private row may remain in vault but hidden from global discover. User keeps private definition; global gains curated entry (PLAN governance). |
| **D-107-7: Login URL refresh** | AC-107-4 | **Amended 2026-09-14:** Admin actions on global services include **manual edit** of `login_url`. Credential fields are **not** edited by rediscovery. Marking a login URL invalid, or any residual rediscovery path, must not create, replace, or enrich `login_fields`. Credential-field definition is D-107-21, not a discovery side effect. |
| **D-107-8: Icon management** | AC-107-5, Phase 111 | Prefer Phase **111** managed Storage icons on cards when present (same paint cascade as Digital Home). Metadata-level emoji/favicon remains available where 111 asset missing. |
| **D-107-9: Integration status view** | AC-107-6 | Read-only admin panel per service showing: `adapter_id` (generic vs site-specific), `login_url_status`, `login_url` presence, `metadata.discoveryMethod`, `metadata.integrationHealth` (if present), `updated_at`, last discovery outcome from `metadata` (structure documented in Manager plan). No new telemetry pipeline required in 107 — display registry truth + manual admin notes field in `metadata` if useful. Surfaced primarily via **More Details** after modernization (D-107-15). |
| **D-107-10: Zero credential access** | AC-107-7, ADR-002 | Admin platform **must not** query `encrypted_credentials`, decrypt vault blobs, or display credential field values. No admin UI for `access_profiles` secrets. Admin code paths statically verifiable — no imports from `vault/crypto` decrypt paths for display. |
| **D-107-11: No execution/administration blur** | P5, Phase 104/105 | Admin console does not open services for end-user autofill, does not manage user `user_services` selections, does not edit user vault state. Registry/catalog metadata only. |
| **D-107-12: Registry cache invalidation** | Phase 102 runtime | After admin writes, clear/invalidate client registry catalog cache (`clearRegistryCatalogCache`) so Hub reload reflects changes — document operator refresh; optional auto-invalidate on admin save success. |
| **D-107-13: Digital Home visual parity** | Operator Admin UX Task | Admin shell/screens use the **same design language** as Digital Home: Heebo, type scale, BG/shell colors, primary/secondary, border-radius, spacing, button/card/shadow/icon styles. RTL Hebrew. Not a separate “legacy admin skin”. |
| **D-107-14: Website cards, not long lists** | Operator | Built-in catalog uses **modern website cards** (icon, name, category, status, login URL when set, added date, added-by origin). Feel similar to Digital Home tiles/cards. Compact — no full-width oversized fields dominating layout. |
| **D-107-15: Technical details on demand** | Operator AC-107-11 | Hide by default: Global ID, UUIDs, raw metadata/JSON, adapter name, source_type, internal status enums, diagnostics. Primary UI shows operator-friendly “פרטים נוספים” / “More Details” → **modal** with technical fields. |
| **D-107-16: Nav copy (אתרים)** | Glossary + operator | Rename «קטלוג גלובלי» → **«אתרים מובנים»**. Rename «תור אישורים» → **«אתרים בהוספה ע"י משתמשים»**. Use אתר/אתרים in Hebrew admin UI (align D-113-19 glossary). |
| **D-107-17: Pending submissions card** | AC-107-3 | Queue shows submitted date, submitted by, preview icon, category, Approve, Reject — card-friendly, not dense CRUD table. |
| **D-107-18: Home URL + optional Login URL** | Operator | Every website supports **Home URL** + optional **Login URL** (including custom/promoted). Admin configures without implementation jargon. If Login URL empty, Digital Home uses Home URL (existing execution rule — surface clearly in admin copy). |
| **D-107-19: Compact edit experience** | Operator | Edit website like credential modal: compact sections, collapsible groups, clear Save/Cancel — not huge vertical forms. |
| **D-107-20: Search & filters** | Operator | Filter: category, built-in, custom, user-submitted, active, inactive. Search: name, category, login URL. Responsive desktop/tablet/laptop; no unnecessary horizontal scroll. |

## Admin Console UI Modernization (normative — D-107-13…20)

Primary targets: `src/admin/**` (`AdminApp`, `RegistryAdmin`, `ApprovalQueue`, `CategoriesAdmin`, `IntegrationStatusPanel`, `admin.css`).

### Visual
Match Digital Home (typography, fonts/sizes, colors, radius, spacing, buttons, cards, shadows, icons). Premium management feel.

### Forms → cards
Replace long oversized forms with compact cards; group logically; progressive disclosure for secondary fields.

### Website card fields (primary)
Icon (DH cascade) · Name · Category · Status · Login URL (if set) · Added date · Added by (`Built-in` / `Administrator` / username who submitted). Same for “origin” wording in Hebrew.

### More Details modal
Button opens modal with metadata, IDs, UUID, adapter, source type, flags, validation/build info — not in main layout.

### Categories (D-107-5 / AC-107-14 / AC-107-19 / AC-107-20)
- **Right:** create (name only) + existing rows (name edit, compact Save/Delete, «פרטים נוספים»). No icon. No typed «סדר».
- **Left (currently empty — fill this):** **reorder panel** for existing categories — visual order control (drag-and-drop preferred; ↑↓ acceptable). Persist order without exposing numeric order fields. Responsive: on narrow widths stack reorder above/below rather than forcing unused left void.

### Editing
Compact sections, collapsible groups, Save + Cancel; avoid huge vertical forms.

### Functional constraints
Do not change approval/promote/reject semantics, RLS/auth, credential access rules, or discovery scoring unless a listed amendment requires it. Login URL rediscovery remains available; presentation simplifies.

### Evidence
Screenshots: Built-in cards, Pending queue, Category create (no manual code), Edit compact, More Details modal, filters; confirm AC-107-7 still holds.

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
  → Login entry: explicit login URL edit only (Phase 108). Rediscovery must not write login_fields
  → Credential fields: structured editor (D-107-21), not discovery
```

## Constraints / Non-Negotiables
- Admin **never** views credential plaintext (AC-107-7).
- Admin credential-field configuration follows **D-107-21 … D-107-25**. Rediscovery must not write `login_fields`. Do not invent a username+password schema for a global service.
- No `service_role` key in client bundle (Phase 102 constraint preserved).
- No changes to `executeServiceFromTile` orchestration or vault encryption (AC-107-7 implicit).
- Global built-in seed ids (`shufersal`, `clalit`, etc.) must remain stable unless explicit migration.
- Hebrew admin UI; friendly errors — no raw stack traces in production admin surfaces.
- Phase 100 `isDevBuild()` / practice service rules unchanged for end-user app.

## Technical Boundaries / Out of Scope
- Full Phase 111 icon pipeline (Storage, normalization, versioning, auto-discovery).
- Phase 108 browser store packaging.
- Phase 109 credential lifecycle UX.
- Phase 116 URL canonicalization engine.
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

1. Publish AC-107-1 … AC-107-18 with milestone mapping.
2. Prior M1–M8 (platform) as before; add **M9 — Admin UI/UX modernization** (D-107-13…20 / AC-107-8…18): Digital Home visual parity, website cards, «פרטים נוספים» modal, nav rename, auto category codes, compact edit, search/filters — preserve AC-107-7 and approval/rediscovery semantics.
3. **Scheduling:** `PHASE.md` may remain **113**. Run Admin M9 as a **parallel track** or after Phase 113 Credential M7 — **do not** implement under Phase 113.
4. **Bootstrap:** Document how to set `is_admin=true` for operator account in dev.
5. **Category auto-id:** Document generation (slug + uniqueness). Prefer Phase 111 icons on cards when present.
6. Developer evidence: modernized Admin screenshots + verify script still affirms no credential access.

## Global credential-field configuration (normative — 2026-09-14)

Phase 102 defines what a credential schema is, how values bind to `field.id`, how a global form must render, and what happens when a global schema is missing, empty, or invalid. User credential entry is Phase 102 AC-102-17 … AC-102-24. This section is only the administrator configuration surface. Do not redefine those criteria here. Do not create a parallel model. An admin save must not invent a schema that would make a global service appear to satisfy AC-102-17. Missing, empty, and invalid global schemas stay AC-102-20, AC-102-21, and AC-102-22 until an administrator publishes a valid explicit schema.

### Administrator authority

The administrator is authoritative for the credential schema of a global / catalog service (`owner_user_id` is null). Users consuming that service must not redefine it. Promoting a user submission must not invent a global schema and must not copy a render-time username+password default into `login_fields`.

### Structured editor (primary method)

The primary configuration surface is a structured ordered field editor, not raw JSON.

For each field the administrator can set:

- order (add, remove, reorder)
- `label` (required; display only)
- `required` (default true)
- `masked` (default false). Masking must not set `type: password`
- stable `id`, assigned once when the field is added. Editing the label must not regenerate `id`

`type` (site-password / autofill role) is not implied by label, position, or masking. Existing `type: password` on a field already stored must be preserved unless the administrator explicitly changes that role. An explicit change of password role is an advanced control, separate from the mask control. Saving other fields must not strip an existing password role and must not add one in order to mask.

Raw JSON may remain only behind «פרטים נוספים». It is not the primary method. An explicit empty schema must not be rewritten to Username + Password on save. Omitting the editor must not invent a schema.

### Id-change warning

Before the administrator changes, removes, or reuses a `field.id`, the UI must warn that existing stored values may no longer match, and must require explicit confirmation. The warning must not show credential values. Confirmation does not migrate values. Reuse of a removed id is a meaning change and uses the same warning. No silent credential migration.

### Publish

Saving a credential-schema change increments `metadata_version`. That is metadata only. It does not rewrite ciphertext and does not backfill `login_fields`.

A global service may remain in the catalog without a valid schema. The editor must show that credential fields are not configured. That state is not cured by substituting Username + Password.

### Custom services

This editor is not offered to end users. User-created custom services keep the Phase 102 render-time Username + Password default. Do not add an end-user schema designer.

### Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-107-21: Structured credential-field editor** | CEO: administrator must define fields without raw JSON as the primary method | Ordered fields: label, required, masked, stable id. JSON only under More Details |
| **D-107-22: Warn on id change** | `field.id` is stored-value identity | Confirm before change/remove/reuse. No value display. No silent migration |
| **D-107-23: Admin save must not invent a schema** | Absent schema is not username+password | Empty or omitted editor input is not rewritten to the default pair |
| **D-107-24: Discovery does not write credential fields** | Explicit configuration only | Rediscovery and login-URL edits must not create or modify `login_fields` |
| **D-107-25: Users do not own the global schema** | Administrator is authoritative | No end-user designer. Promotion does not invent `login_fields` |

### Acceptance criteria

| ID | Criterion |
|---|---|
| AC-107-21 | An administrator can define, reorder, and save global credential fields in a structured editor, including a schema with no password-role field, without using raw JSON as the primary method |
| AC-107-22 | Masking a field does not set `type: password`. Label edits do not change `field.id` |
| AC-107-23 | Changing, removing, or reusing a `field.id` requires an explicit warning and confirmation. The warning does not reveal credential values. No silent migration runs |
| AC-107-24 | Saving a global service does not rewrite a missing or empty schema to Username + Password. Promotion of a user submission does not invent a global schema |
| AC-107-25 | Login URL edit and any residual rediscovery path do not create or modify `login_fields` |
| AC-107-26 | Admin still cannot view credential plaintext (AC-107-7 remains) |

### Engineering change boundary (configuration surface)

| Area | Class | Notes |
|---|---|---|
| Admin structured credential-field editor | MODIFY | Primary configuration. Phase 107 |
| Raw JSON `login_fields` textarea as primary UX | REMOVE as primary | May remain under More Details only |
| Defaulting empty admin `login_fields` to username+password | REMOVE | Must not invent a schema |
| Rediscovery / discovery writes of `login_fields` | DO NOT TOUCH as an approved writer | Must not remain an approved schema source. Do not expand Phase 108 discovery removal here |
| Credential form renderer, schema validity, encryption | DO NOT TOUCH in this document | Phase 102 contract. Security gate applies |
| Autofill, vault, KDF, authentication | DO NOT TOUCH | |

## Credential mode configuration (normative — approved 2026-09-14)

Phase 102 owns the three modes and user-facing behavior. This section is only the administrator control. Do not infer mode from an empty field list.

The primary editor offers an explicit choice, not raw JSON:

- Credentials required — then the structured field editor. This stores `credentialMode=credential_fields` only when the field list is valid.
- No credentials stored by Digital Home — authentication occurs on the external website, for example Google or Microsoft. This stores `credentialMode=no_stored_credentials`. It does not require a field list. Clearing the field list without this choice is not this mode.

A service the administrator has not explicitly configured remains NOT_CONFIGURED (`credentialMode` absent or `not_configured`). The administrator can explicitly return a service to that state. Doing so must not invent Username + Password and must not be saved as `no_stored_credentials`.

A save is rejected when it would store CREDENTIAL_FIELDS without a valid field list, or NO_STORED_CREDENTIALS together with active fields. The editor may clear the active field list only on a confirmed transition to NO_STORED_CREDENTIALS or NOT_CONFIGURED. That clear does not delete ciphertext and does not write Username + Password.

For each field when credentials are required, the administrator sets label, order, required, `inputType` (`text` or `number`), and masked. Mask and input type are separate controls. Neither sets `type: password`. Password/autofill role stays the existing advanced control.

Copy may follow existing Hebrew admin language. The three choices must remain visibly distinct.

### Acceptance criteria

| ID | Maps | Criterion |
|---|---|---|
| AC-107-27 | AC-A, AC-B, AC-C | The administrator explicitly chooses NOT_CONFIGURED, CREDENTIAL_FIELDS, or NO_STORED_CREDENTIALS without raw JSON as the primary method |
| AC-107-28 | AC-G | Saving an empty field list does not set `no_stored_credentials` |
| AC-107-29 | AC-I, AC-J, AC-L, AC-M | Each field has a TEXT or NUMBER control and a separate mask control. Masking NUMBER does not set `type: password` |

### Engineering change boundary

Unchanged from the Phase 102 credential-mode boundary. This surface is MODIFY. It does not add a credential store, an Autofill rule, or a custom-service mode designer.

### Handoff notes for this amendment

1. User credential entry and credential modes are Phase 102, approved for Manager handoff. Phase 107 owns the controls (AC-107-27 … AC-107-29) and must reject inconsistent mode/field saves (D-102-27). Developer execution waits on the revised `manager-phase102.md`.
2. Do not implement under Phase 108 or Phase 113.
3. Do not hand directly to the Developer from this revision.
4. Security review is required before release of validation and serialization changes identified in Phase 102. Do not redesign encryption as part of that review.

## Architect Review
ARCHITECT_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
Admin Console UI/UX Modernization incorporated (D-107-13…20, AC-107-8…18). Ready for Manager handoff on M9.

### Required Corrections
None yet (await M9 implementation / UAT).
