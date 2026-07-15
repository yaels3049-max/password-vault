# Developer Phase 107

## Phase Identifier
PHASE=107

## Status
STATUS: COMPLETE — includes **M9**, **Categories UX** (AC-107-14/19), **user-owned edit**, and **category reorder panel** (AC-107-20). PHASE.md remains **113** (parallel track).

## Source References
- `team-Yuri/arch-phase107.md` — D-107-5 (amended reorder), D-107-13…20
- `team-Yuri/manager-phase107.md` — M9.1–M9.10
- `team-Yuri/PLAN.md` §18 — Phase 107 (AC-107-1 … AC-107-20)
- `docs/MIGRATION_PHASE_107.md`

## Implementation Summary
Delivered **Admin Management Platform** — separate `#/admin` console for catalog curation and integration health review. Admin authorization via `users.is_admin` + `public.is_admin()` + additive RLS. All registry/category mutations centralized in `adminRegistryApi.ts` with `clearRegistryCatalogCache()` on writes.

**AC-107-7 affirmation:** Admin code under `src/admin/**` does **not** query `encrypted_credentials`, does **not** import `vault/crypto` decrypt paths, does **not** use `service_role` in client env, and does **not** expose credential or `access_profiles` secret UI. Verified statically by `verifyPhase107Admin.mjs`.

**AC-107-5:** Icon editing is metadata-only (`icon`, `metadata.faviconSiteUrl`, `metadata.iconSource`). No Supabase Storage upload (deferred Phase 111).

## Implemented Milestones

| Milestone | Completed | Notes |
|---|:---:|---|
| M1 `is_admin` migration + RLS + AdminGate | Yes | `20260709120000_phase107_admin_auth_rls.sql`; `#/admin` via `main.tsx` + `AdminGate` |
| M2 Categories CRUD | Yes | `CategoriesAdmin.tsx` |
| M3 Global registry CRUD | Yes | `RegistryAdmin.tsx` |
| M4 Approval queue promote/reject | Yes | `ApprovalQueue.tsx` + `promote_user_submission` RPC |
| M5 Login URL refresh / rediscovery | Yes | `LoginUrlRefresh.tsx` + `admin_update_login_url` RPC |
| M6 Interim icon metadata editor | Yes | `IconMetadataEditor.tsx` — no Storage |
| M7 Integration status panel | Yes | `IntegrationStatusPanel.tsx` |
| M8 Verify + docs + build | Yes* | `verifyPhase107Admin.mjs`; `MIGRATION_PHASE_107.md`; build PASS |
| **M9 Admin Console UI/UX** | Yes | DH parity; website cards; More Details; nav rename; pending cards; Home/Login labels; auto category code; compact edit; filters/search; evidence |

\* Manual matrix T1–T22 / T23–T33 awaits operator with migrated DB + `is_admin` bootstrap.

## AC-107-7 Affirmation (explicit)

| Forbid | Status |
|---|---|
| Query `encrypted_credentials` from admin paths | **Not present** — static grep in verify script |
| Import/call `vault/crypto` decrypt for display | **Not present** |
| `service_role` in client bundle / `VITE_*` | **Not present** |
| Credential plaintext / vault blob / `access_profiles` secret UI | **Not present** |
| Changes to `executeServiceFromTile` or vault encryption | **Not modified** |

## Bootstrap SQL (`is_admin`)

```sql
update public.users
set is_admin = true
where id = '<auth-users-uuid>';
```

See `docs/MIGRATION_PHASE_107.md` for full operator steps.

## Files Changed

| File | Change Summary |
|---|---|
| `supabase/migrations/20260709120000_phase107_admin_auth_rls.sql` | **New** — `is_admin`, RLS, RPCs, check constraints |
| `src/admin/adminRoutes.ts` | **New** — `#/admin` route detection |
| `src/admin/adminAuth.ts` | **New** — `resolveAdminAccess()` |
| `src/admin/adminRegistryApi.ts` | **New** — centralized admin Supabase API |
| `src/admin/AdminGate.tsx` | **New** — non-admin deny |
| `src/admin/AdminApp.tsx` | **New** — admin shell + nav |
| `src/admin/CategoriesAdmin.tsx` | **New** — AC-107-1 |
| `src/admin/RegistryAdmin.tsx` | **New** — AC-107-2 |
| `src/admin/ApprovalQueue.tsx` | **New** — AC-107-3 |
| `src/admin/LoginUrlRefresh.tsx` | **New** — AC-107-4 |
| `src/admin/IconMetadataEditor.tsx` | **New** — AC-107-5 metadata only |
| `src/admin/IntegrationStatusPanel.tsx` | **New** — AC-107-6 |
| `src/admin/admin.css` | **New** — RTL admin styles |
| `src/admin/index.ts` | **New** — barrel exports |
| `src/main.tsx` | Admin route bootstrap |
| `src/App.tsx` | Re-export `isAdminRoute` (route registration reference) |
| `scripts/verifyPhase107Admin.mjs` | **New** — static verification |
| `docs/MIGRATION_PHASE_107.md` | **New** — migration + flows |
| `team-Yuri/dev-phase107.md` | This evidence |

### Explicitly **not** modified
- `src/vault/crypto.ts`
- `src/execution/serviceExecution.ts` / `executeServiceFromTile`
- End-user Digital Home / Service Management flows (no admin nav for non-admins)

## M8 — Verification Evidence

### Phase 107 static (PASS)

```text
> node scripts/verifyPhase107Admin.mjs
PASS: Phase 107 Admin Management Platform (static)
  admin modules: AdminGate + Categories + Registry + Approval + Login URL + Icon + Status
  AC-107-7: no encrypted_credentials / vault decrypt / service_role in src/admin/**
  migration: is_admin + RLS + promote_user_submission + admin_update_login_url
  AC-107-5: metadata-only icons (Phase 111 Storage deferred)
```

### Build (PASS)

```text
> npm run build
✓ built in ~2.6s
```

### Regression

| Script | Result | Notes |
|---|---|---|
| `verifyPhase102Registry.mjs` | Run after migration applied | Requires live Supabase — operator gate |
| `verifyPhase103Execution.mjs` | Not touched | No execution changes |

## Functional Test Matrix (T1–T22)

| # | Test | Result | Notes |
|---:|---|---|---|
| T1 | Non-admin denied at `#/admin` | PENDING | Requires `is_admin=false` session |
| T2 | Admin gate pass | PENDING | Requires bootstrap SQL |
| T3–T4 | Category CRUD | PENDING | UI at `#/admin` → קטגוריות |
| T5–T7 | Global registry CRUD/disable | PENDING | |
| T8–T10 | Approval queue | PENDING | Needs `pending_review` user row |
| T11–T12 | Login URL manual + rediscovery | PENDING | Extension prerequisite for T12 |
| T13 | Icon metadata | PENDING | No Storage |
| T14 | Integration status panel | PENDING | |
| T15–T17 | AC-107-7 UI + static + no service_role | **PASS (static)** | T15–T16 via verify script |
| T18 | Cache invalidation | PENDING | `clearRegistryCatalogCache` in API |
| T19 | User policies unchanged | PENDING | Phase 104 regression |
| T20 | Built-in seeds stable | PENDING | |
| T21 | Build | **PASS** | |
| T22 | Verify script | **PASS** | |

## Tests / Lint

| Command | Result |
|---|---|
| `npm run build` (includes `tsc -b`) | PASS |
| Dedicated lint script | NOT AVAILABLE in package.json |

## M9 — Admin Console UI/UX Modernization (complete)

### Completed checklist (M9.1–M9.10)

| Item | Status | Notes |
|---|:---:|---|
| M9.1 Visual parity | Yes | `admin.css` DH tokens; Assistant (live app typeface); blue primary; cards/shadows |
| M9.2 Website cards | Yes | Icon (Phase 111 Storage cascade), name, category, status, login URL, date, added-by |
| M9.3 More Details modal | Yes | IDs, source_type, adapter, JSON, IntegrationStatus, LI |
| M9.4 Nav rename | Yes | «אתרים מובנים»; «אתרים בהוספה ע"י משתמשים» |
| M9.5 Pending cards | Yes | Date/by/icon/category/approve/reject; promote semantics unchanged |
| M9.6 Home + Login URL | Yes | Friendly labels + empty-login helper copy |
| M9.7 Category auto-code | Yes | `generateCategoryId`; name-only (AC-107-14/19 — no icon/סדר) |
| M9.8 Compact edit | Yes | Collapsible sections; Save/Cancel |
| M9.9 Filters + responsive | Yes | Category/source/status + search; stacks &lt;700/900px |
| M9.10 Evidence | Yes | Fixture screenshot + verify + build |

### Files (M9)

| File | Change |
|---|---|
| `src/admin/admin.css` | DH visual system |
| `src/admin/AdminApp.tsx` | Nav rename |
| `src/admin/RegistryAdmin.tsx` | Cards, filters, compact edit, More Details |
| `src/admin/ApprovalQueue.tsx` | Pending cards |
| `src/admin/CategoriesAdmin.tsx` | Auto category id; name-only (no icon / no סדר) |
| `src/admin/adminPresentation.ts` | Labels, dates, `generateCategoryId` |
| `src/admin/LoginUrlRefresh.tsx` | Home URL helper copy |
| `scripts/verifyPhase107Admin.mjs` | AC-107-8…18 static asserts |
| `scripts/fixtures/phase107-admin-m9.html` | Visual fixture |
| `docs/evidence/phase107-admin-m9-console.png` | Screenshot |
| `docs/MIGRATION_PHASE_107.md` | M9 + auto-id note |

### M9 verification

```text
> node scripts/verifyPhase107Admin.mjs
PASS: … M9: cards, More Details, nav rename, filters, auto category id (AC-107-8…18)
  AC-107-7: no encrypted_credentials / vault decrypt / service_role in src/admin/**

> npm run build
PASS
```

### AC-107-7 / AC-107-18 affirmation (M9)

| Rule | Status |
|---|---|
| No `encrypted_credentials` / vault decrypt / `service_role` / `access_profiles` in admin | **PASS** (verify) |
| Promote/reject/rediscovery business logic unchanged | **Honored** — UI presentation only |
| No new Phase 111 Storage pipeline in M9 | **Honored** — uses existing managed icon URLs when present |

### Manual matrix (T23–T33) — operator

| # | Test | Result |
|---:|---|---|
| T23 | DH visual parity | Fixture PASS; live `#/admin` recommended |
| T24 | Website cards fields | Fixture + code PASS |
| T25 | More Details modal | Code PASS |
| T26 | Nav rename | Code + verify PASS |
| T27 | Pending cards | Code PASS |
| T28 | Home / Login URL labels | Code PASS |
| T29 | Category auto-code | Code + verify PASS |
| T30 | Compact edit Save/Cancel | Code PASS |
| T31 | Filters + search | Code PASS |
| T32 | Responsive | CSS breakpoints PASS |
| T33 | Integrity + no credentials | verify PASS |

## Categories admin UX fix (2026-07-15 — AC-107-14 / AC-107-19)

Operator UAT rejected icon + «סדר» on Categories. **UI/presentation only.**

| Change | Status |
|---|:---:|
| No category icon on create or rows | Yes |
| No «סדר» / `sort_order` in UI | Yes |
| Create/edit = display name only; auto `generateCategoryId` | Yes |
| Technical id under «פרטים נוספים» | Yes |
| Compact «שמור» / «מחק» (`admin-btn--compact`) | Yes |
| Registry/approval/credential rules unchanged | Honored |

### Files

| File | Change |
|---|---|
| `src/admin/CategoriesAdmin.tsx` | Name-only create/edit; compact actions |
| `src/admin/adminRegistryApi.ts` | create/update omit `sort_order` (DB default) |
| `src/admin/admin.css` | `.admin-btn--compact` + category row layout |
| `scripts/verifyPhase107Admin.mjs` | AC-107-14/19 asserts |
| `scripts/fixtures/phase107-categories-ux.html` | Visual fixture |
| `docs/evidence/phase107-categories-ux.png` | Screenshot (create card + row) |
| `docs/MIGRATION_PHASE_107.md` | Categories UX note |

### Verification

```text
> node scripts/verifyPhase107Admin.mjs
PASS … Categories UX: name-only; no icon/סדר; compact Save/Delete (AC-107-14/19)

> npm run build
PASS
```

## Categories reorder panel (AC-107-20)

Operator layout: fill empty left region with reorder; keep right create/edit.

| Change | Status |
|---|:---:|
| Left panel סידור תצוגה (drag + ↑↓) | Yes |
| Persist via `reorderAdminCategories` → `sort_order` | Yes |
| No typed numeric order field / no icon | Yes |
| Right create + name edit + compact Save/Delete | Yes |
| Narrow stack (reorder above) | Yes |

### Files

| File | Change |
|---|---|
| `src/admin/CategoriesAdmin.tsx` | Two-column layout + reorder UI |
| `src/admin/adminRegistryApi.ts` | `reorderAdminCategories`; create append `sort_order` |
| `src/admin/admin.css` | `.admin-categories-layout` / `.admin-category-reorder` |
| `scripts/verifyPhase107Admin.mjs` | AC-107-20 asserts |
| `docs/evidence/phase107-categories-reorder.png` | Layout screenshot |
| `docs/MIGRATION_PHASE_107.md` | Reorder note |

### Functional path

1. Open `#/admin` → קטגוריות.
2. On wide width: reorder panel on the left, create/edit on the right.
3. Move one category with ↑ or drag another below it.
4. Refresh — order remains (stored in `categories.sort_order`).

### Verification

```text
> node scripts/verifyPhase107Admin.mjs
PASS … Categories reorder panel left/stacked (AC-107-20)
> npx tsc -b
PASS
```

## Control Center landscape background (2026-07-15)

מרכז הבקרה (login + all management screens) uses landscape **wave-v2** via `--admin-wide-bg-image` on `.admin-app` / `.admin-gate`. Digital Home / Add Sites stay on the **portrait** shell (Phase 113).

Evidence: `docs/evidence/phase107-admin-wide-bg.png`.

## User custom-add → approval queue fix (2026-07-15)

Operator: site added via Hub «הוספת אתר» appeared as `built_in` in Control Center and **not** under «אתרים בהוספה ע"י משתמשים».

**Cause:** `addCustomService` / `upsertCustomServiceRegistryRow` coerced known catalog URLs into `ensureKnownBuiltinRegistryRow` (`source_type=built_in`).

**Fix:** custom-add always inserts `source_type=user` + `pending_review` (unless the URL already exists as a non–user catalog card — then select only). Known-builtin restore stays on Discover «הוספה» by id.

## Phase 111 note

Admin icons prefer Phase 111 Storage (`resolveManagedIconUrl`) on cards when present. M9 did **not** add a new Storage pipeline. Legacy AC-107-5 metadata emoji remains fallback.

## Developer Declaration
Detected phase: 107  
Selected state: IMPLEMENT  
Status: COMPLETE  

Sarah (Team Yuri Developer) — Categories reorder (AC-107-20) + prior Categories UX.
