# Architecture Phase 111

## Phase Identifier
PHASE=111

## Status
STATUS: REJECTED_PENDING_ICON_REGRESSION

## Amendment
AMENDED: 2026-07-14 — **Admin binary icon upload is a hard UX requirement.** Current Admin `IconMetadataEditor` is metadata-only (emoji + `faviconSiteUrl` + `iconSource`) with an explicit “Phase 111 will add upload” hint — that screen is **insufficient**. Operator needs to **choose an image file**, upload it, and have that image become the **active managed icon** used across Digital Home / Manage / Admin when discovery finds nothing useful. Adds **D-111-16**, **AC-111-16**. Metadata URL fields may remain optional secondary tools; they are **not** a substitute for file upload.

AMENDED: 2026-07-14 (regression) — **Hard paint cutover broke working site icons.** Operator report: before Phase 111 ~80% of services showed correct icons from site/favicon presentation (`faviconSiteUrl` / Google favicon / prior `logoCache`+`resolveServiceLogo`). After Developer M5 “managed Storage URLs only — no Google / no resolveServiceLogo on paint”, **no site icons render** for catalog rows that never received a populated `service_assets` active row. Admin upload is additive for **failed** discovery (e.g. Clalit) — **not** a license to remove the prior working path. Revises **D-111-6**, **D-111-13**; adds **D-111-17**, **AC-111-17**. Normative paint is a **cascade**: (1) active managed Storage asset if present; (2) **pre-111 presentation path unchanged**; (3) emoji/deterministic fallback. “Never third-party on paint” is a **future** hardening goal **after** backfill — **forbidden as day-one hard cutover** without migration that preserves visible icons. Architect **REJECTS** Phase 111 COMPLETE while site icons are blank across previously working services.

## Phase Goal
Deliver **Service Assets and Icon Management** as an **additive** capability: Storage-backed managed icons + **Admin file upload** when site icon loading/discovery fails — **without regressing** icons that already worked via `faviconSiteUrl` / existing presentation (operator: ~80% of sites). Local managed assets are preferred **when present**; otherwise the **pre-111 icon path remains**. Assets never couple to login, execution, or credentials (AC-111-1 … AC-111-17).

**Operator-critical paths:**
1. **Preserve** existing working site icons on paint (regression hard gate).
2. **Admin file upload** when no usable site icon (e.g. Clalit) — becomes active managed asset and wins over auto.
3. Optional discovery/backfill into Storage over time — never blank the UI waiting for it.

Phase 111 owns asset discovery/validation/normalization/lifecycle, Supabase Storage binaries, registry **metadata references only**, **Admin file upload / preview / replace**, approve/refresh/restore, duplicate prevention, fallbacks, and consistent rendering. It does not own login discovery (108), autofill (110), complex login (112), URL identity (113), or credential crypto (109).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=111`
- `team-Yuri/PLAN.md` §18 — Phase 111 (AC-111-1 … AC-111-16)
- `team-Yuri/arch-phase102.md` — `service_registry` metadata patterns
- `team-Yuri/arch-phase107.md` — Admin surfaces that will gain asset management UI
- `team-Yuri/arch-phase108.md` — discovery tab / bulk refresh patterns (reuse rate-limit ideas; do not couple to loginUrl)
- `src/catalog/definitionToLegacyService.ts` — current Google favicon proxy / `faviconSiteUrl`
- `src/resolveServiceLogo.ts` — live third-party icon probing (to be replaced for normal rendering)
- `src/admin/IconMetadataEditor.tsx` — **current gap:** “מטא-דאטה בלבד” emoji + favicon URL; Phase 111 **must replace** with file upload
- `supabase/` — Storage buckets + RLS (new migrations this phase)

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-111-1: Binaries in object storage, not `service_registry`** | AC-111-2 | Store image bytes in **Supabase Storage**. Registry / related tables hold only references + metadata (`assetId`, type, status, source, version, path/key, checksum, timestamps). Never Base64-blob icons into registry JSON as the primary store. |
| **D-111-2: Extensible asset-type model** | PLAN supported types | Schema and APIs are **asset-type aware** (`favicon` \| `apple_touch_icon` \| `app_icon` initially; room for logo/banner/thumbnail later) without redesign. Phase 111 delivers **icon family** end-to-end; unused types may be stubbed in enum only. |
| **D-111-3: Deterministic discovery order** | AC-111-3, AC-111-7 | On create/refresh (non-blocking): (1) admin-approved existing, (2) existing managed active asset, (3) apple-touch-icon, (4) favicon, (5) OG image only if square-ish / suitable, (6) generated fallback. Discovery failure **never** blocks service create (same spirit as login discovery). |
| **D-111-4: Validate before store** | AC-111-4, security | Reject unsupported MIME/format, oversize, unreadable decode, unsafe URL/protocol, unsafe redirect chains. SVG only if explicitly sanitized (default Phase 111: **PNG/WebP/JPEG/ICO**; SVG deferred or sanitizer-gated). |
| **D-111-5: Normalize to managed sizes** | AC-111-4, AC-111-5 | Produce consistent square outputs (at least **32 / 64 / 128**; 256 optional). Preserve transparency where possible. Published bytes are immutable until a new version replaces them. |
| **D-111-6: Paint cascade (managed first, legacy preserved)** | AC-111-5, AC-111-12, AC-111-17 | Render resolver **MUST** be layered: (1) if an **active** managed Storage asset URL exists → use it; (2) else use the **pre-111 presentation path** (`metadata.faviconSiteUrl` → Google/high-res favicon helper and/or prior `resolveServiceLogo` / `logoCache` behavior); (3) else emoji / deterministic fallback. **Forbidden:** returning null/blank for all services solely because `service_assets` is empty. Managed-only paint is invalid until icons are preserved or backfilled. |
| **D-111-7: Deterministic fallback** | AC-111-6 | If **no** managed asset **and** legacy path yields nothing: stable fallback (initials / category / generic / emoji) — same choice every time for the same service id. Never broken empty icon hole when a prior path would have shown something. |
| **D-111-8: Ownership isolation** | AC-111-11 | Global catalog assets are shared. User custom services may own **private** assets. Private must not auto-promote to global. Promote only via **admin approve**. RLS: users read globals + own privates; only admin writes global assets. |
| **D-111-9: Admin precedence + refresh safety** | AC-111-8, AC-111-10, AC-111-16 | `assetSource=admin` (upload or explicit approve) wins over auto **and** over legacy favicon paint when active. Bulk/single refresh **must not** overwrite admin-approved / admin-uploaded assets unless explicit force. |
| **D-111-10: Duplicate prevention** | AC-111-9 | Content checksum (e.g. SHA-256) / deterministic storage key reuse — identical bytes not stored twice. |
| **D-111-11: Lifecycle states** | AC-111-13 | Normative states: `discovering` → `discovered` → `approved` → `active` → `stale` \| `failed` \| `archived`. **Only `active`** managed assets take paint priority step (1). Absence of active managed ≠ hide legacy icons. |
| **D-111-12: Execution independence** | AC-111-14 | Asset pipeline **must not** change `executeServiceFromTile`, autofill, credentials, loginUrl. Missing icon never blocks tile open. |
| **D-111-13: Optional later hard cutover (not day-one)** | AC-111-5 revised, AC-111-17 | Eliminating third-party favicon CDN on paint is a **later** goal only after: backfill/migration populates managed assets **or** operator accepts per-service admin uploads. Phase 111 day-one **must not** hard-cut paint to Storage-only. Document phased cutover in migration guide when ready. |
| **D-111-14: Async refresh** | PLAN refresh | Single / selected / bulk refresh: rate-limited, non-blocking UI, partial failure report. Refresh may **populate** managed assets from discovery without removing legacy paint fallback. |
| **D-111-15: No credential leakage in ops metrics** | PLAN operational visibility | Metrics: discovery/validation/refresh failure counts, fallback usage — no PII/credentials/HTML dumps. |
| **D-111-16: Admin file-upload icon is primary additive path** | AC-111-8, AC-111-16 | Admin file picker remains required for sites with **no usable icon**. Upload → Storage → active admin asset → wins cascade step (1). Optional emoji/`faviconSiteUrl` secondary. |
| **D-111-17: No icon regression (hard gate)** | AC-111-17 | Phase 111 must **not** blank icons that worked before this phase. UAT: sample of prior good icons (banks, retail that used faviconSiteUrl) must still show site icons after fix without requiring mass admin upload. Developer COMPLETE claim rejected while catalog icons are universally empty. |

### Normative render path (cascade — mandatory)

```text
Service card / row paint
  → (1) active managed Storage asset? → render it (admin upload / populated discovery)
  → (2) else pre-111 path: faviconSiteUrl / highResFavicon / resolveServiceLogo/logoCache
        (MUST restore — this is what showed ~80% of site icons)
  → (3) else emoji / deterministic fallback
  → NEVER blank all icons because service_assets is empty
```

### Normative admin upload path

```text
Admin → service row → Icon / Assets panel
  → shows current icon (managed OR legacy preview)
  → file input: choose image (PNG/JPEG/WebP/ICO)
  → validate + normalize + Storage upload
  → assetSource=admin, status=active
  → cascade step (1) wins on all surfaces
  → rediscovery/refresh must NOT overwrite unless force
```

### Normative discovery/refresh path

```text
create or refresh(service)
  → if admin-approved active → skip overwrite (unless force)
  → else discover candidates in order (D-111-3) — optional enhancement
  → download + validate + normalize + store when successful
  → on failure → service remains; **legacy paint path still works**
```

### Phase boundary map

| Phase | Owns |
|-------|------|
| **111** | Managed icons/assets, Storage, metadata, admin asset ops, render consistency |
| **102 / 107** | Registry shell / admin chrome that **calls** 111 APIs |
| **108** | Login URL discovery — unrelated pipeline |
| **110** | Autofill — must ignore assets |
| **112+** | Future logo/banner types may extend 111 model only |

## Constraints / Non-Negotiables
- Binaries not primary-stored in `service_registry` (AC-111-2).
- **No icon regression** — pre-111 working site icons must keep showing (AC-111-17 / D-111-17).
- Discovery failure never blocks service creation (AC-111-7).
- Admin assets not silently overwritten (AC-111-10).
- Global vs private isolation (AC-111-11).
- Assets never affect login/execution/credentials (AC-111-14).
- Admin file upload delivered for failed cases (AC-111-16).
- Build passes (AC-111-15).
- Admin file upload is a hard delivered UX (AC-111-16) — metadata-only icon panel is not acceptable as the Phase 111 outcome.
- No `service_role` in client; Storage policies via RLS / signed URLs as designed.
- Hebrew-friendly admin/user messages on upload/discovery failure.

## Technical Boundaries / Out of Scope
- Redesigning login discovery, autofill, or execution.
- Full logo/banner/screenshot product surfaces (schema may allow types; product UI can stay icons-only).
- AI-generated icons / style transfer.
- CDN redesign outside Supabase Storage (unless Manager documents mirror).
- **Day-one hard cutover** that removes Google favicon / legacy paint before icons are preserved or backfilled.
- Forcing every historical row into Storage before UI works again.

## Dependencies and Interfaces

### Upstream
| Phase | Provides |
|-------|----------|
| 102 | `service_registry` |
| 107 | Admin UI host for asset management |
| 109 | Auth / admin role for elevated asset ops |

### Target modules (Developer ownership — indicative)
| Module | Responsibility |
|--------|----------------|
| `src/assets/` (or `src/serviceAssets/`) | Discover, validate, normalize, resolve render URL |
| Storage helpers / Supabase client | Upload, signed/public URL, delete old versions |
| `supabase/migrations/*_phase111_*` | Buckets, policies, metadata tables/columns |
| Admin API + UI | **File upload** + preview + approve/refresh/restore; retire metadata-only-only panel |
| `ServiceCard` / Digital Home / Discover | Consume managed resolver only |
| `docs/MIGRATION_PHASE_111.md` | Operator: Storage setup, backfill, rollback |
| `scripts/verifyPhase111Assets.mjs` | Static contracts for metadata + no third-party paint dependency |

## Data / State Considerations
- Prefer a dedicated `service_assets` table (or clearly versioned metadata blob) keyed by `service_id` + `asset_type` + `version`; `active` pointer per service/type.
- Checksum column for dedupe.
- Private assets: path prefix `user/<userId>/...` or equivalent; global `global/<serviceId>/...`.
- Cache invalidation: bump `assetVersion` so clients discard stale URLs.
- Preserve emoji `icon` field as optional fallback input when no image exists (deterministic).

## Security / Privacy Considerations
- Validate content-type vs magic bytes where feasible.
- Cap max bytes and max dimension.
- SSRF: discovery fetch only http(s); block private IP ranges / metadata endpoints; limit redirects.
- Users must not read other users’ private asset objects.
- Admin upload: type allowlist; virus scanning not required this phase unless platform standard exists.

## Testing and Lint Expectations
- `npm run build` PASS (AC-111-15).
- `node scripts/verifyPhase111Assets.mjs` PASS (new).
- Regression: Digital Home still opens services (assets missing → fallback; execution unchanged).
- Manual: prior faviconSiteUrl services show icons again; Admin file upload for Clalit-class failures; refresh does not clobber admin; Zap/login untouched.

## Functional Testability

- **Icon regression (hard):** Digital Home shows site icons again for services that had working icons before Phase 111 (banks/retail sample) without mass admin upload.
- **Custom add:** Service appears with managed icon, legacy favicon path, or deterministic fallback; create never blocked by icon failure.
- **Admin file upload:** Admin picks a local image when discovery fails → becomes active → all surfaces show uploaded image.
- **Cascade:** managed > legacy favicon > emoji/fallback.
- **Refresh:** Auto rediscovery may fill Storage; admin-uploaded preserved without force; legacy path remains until managed exists.
- **Execution independence:** Tile open/autofill unchanged.

## Handoff Notes for Manager

1. Sync `manager-phase111.md`: **REJECT Developer COMPLETE** until icon regression fixed (AC-111-17).
2. Milestone: restore paint cascade in `definitionToLegacyService` / `logoCache` — managed if present, else pre-111 favicon path (un-deprecate `highResFavicon` for product paint).
3. Keep Admin file upload (AC-111-16); do not remove Storage.
4. UAT: visual spot-check catalog tiles + Clalit admin upload path.
5. Optional later: backfill then reconsider CDN cutover — not a blocker to restore icons now.

## Architect Review
ARCHITECT_REVIEW_STATUS: REJECTED

### Review Notes
_Operator 2026-07-14: after Phase 111, previously working site icons (~80%) gone. Root cause class: hard paint cutover to empty managed Storage (M5) contradicting additive Admin-upload intent. D-111-6/13 were over-strict for day-one. Required: cascade restore + AC-111-17._

### Required Corrections
1. Manager: open regression milestone; reject COMPLETE.
2. Developer: restore legacy paint fallback immediately; keep managed-first + admin upload.
3. Do not require uploading 100% of catalog icons to fix blank Home.