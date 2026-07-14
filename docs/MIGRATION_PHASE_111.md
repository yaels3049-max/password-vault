# Migration Phase 111 — Service Assets and Icon Management

## Goal
Storage-backed managed icons **plus** Admin file upload for services where discovery fails (e.g. Clalit).  
**Day-one paint is a CASCADE — not Storage-only** (M8 / D-111-17 / AC-111-17).

## Prerequisites
- Phase 107 Admin auth (`is_admin()`)
- Supabase project with Storage enabled
- Apply migration: `supabase/migrations/20260714120000_phase111_service_assets.sql`

## Paint CASCADE (REQUIRED — M8)

```text
Service card paint
  → (1) active managed Storage URL (metadata.activeIcon / admin upload) if present
  → (2) else pre-111 path: faviconSiteUrl → highResFavicon + logoCache/resolveServiceLogo
  → (3) else emoji / deterministic initial fallback
```

| Rule | Detail |
|---|---|
| Admin upload | **Wins** when present (`assetSource=admin`) |
| Empty `service_assets` | **Must not** blank icons that worked via `faviconSiteUrl` |
| Mass upload | **Not** the fix for catalog regression |
| Future hard cutover | Optional **later** after backfill — forbidden as day-one |

## Storage + schema
| Piece | Detail |
|---|---|
| Bucket | `service-assets` (public read for paint URLs; admin write globals) |
| Table | `public.service_assets` — references only (path, checksum, version, status, `asset_source`) |
| Global path | `global/<serviceId>/<checksum>/<size>.png` |
| Private path | `user/<userId>/...` (RLS) |
| Registry pointer | `service_registry.metadata.activeIcon` — **URL + metadata**, not image bytes |

Binaries are **never** the primary store inside `service_registry` JSON.

## Admin file-upload (operator steps) — AC-111-16
1. Open Admin → Registry → select a **global** service.
2. Panel **「אייקון מנוהל (העלאת קובץ)」**.
3. Preview shows current managed icon or cascade/fallback.
4. **בחירת קובץ והעלאה** → PNG/JPEG/WebP/ICO (≤2MB).
5. Upload → normalize 32/64/128 → Storage → `asset_source=admin`, `status=active`.
6. Confirm same icon on Admin / Digital Home / Manage.
7. Use when automatic favicon fails (e.g. Clalit) — **additive**, not a full catalog re-upload.

Secondary (advanced): emoji / `faviconSiteUrl` metadata — optional.

## Cutover notes (revised M8)
| Incorrect day-one (rejected) | Correct day-one |
|---|---|
| Paint = managed Storage **only** | Paint = **cascade** managed → pre-111 favicon path → fallback |
| Blank when `service_assets` empty | Prior `faviconSiteUrl` icons still show |
| Fix by mass-uploading all icons | Fix by cascade restore (upload only failed ones) |

`resolveServiceLogo` / Google favicon helper remain **tier (2)** until a later phased cutover after backfill.

## Refresh / overwrite protection
- Admin refresh: **does not** overwrite `assetSource=admin` without `force`.
- Bulk `refreshServiceAssets([...], { force: false })` skips admin-protected pointers.

## Discovery (non-blocking)
- `discoverServiceIconSafe` never blocks service create.
- Order: admin → existing → apple-touch → favicon → og → fallback.

## Backfill (optional later)
Populate managed assets async if desired; **not** required to restore Home icons after M8 cascade.

## Rollback / freeze
1. Keep cascade; do not re-introduce Storage-only paint without backfill.
2. Admin upload remains available for failed icons.
3. Phase 108 login discovery untouched.

## Execution independence
Missing icons never block tile open / autofill / credentials.

## Verify
```text
node scripts/verifyPhase111Assets.mjs
npm run build
```

## Operator spot-check (M8 Pass)
1. Hard-refresh Hub.
2. Banks/retail sample that previously showed favicons — visible again **without** mass upload.
3. Clalit (or similar) — Admin file upload still works and wins on Home/Manage/Admin.
