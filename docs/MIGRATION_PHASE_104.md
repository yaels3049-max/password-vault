# Migration Guide — Phase 104 (Service Management UX)

## Scope

Phase 104 delivers the production-grade **Service Management** surface (**ניהול שירותים**):
a card-based, two-section **administration-only** screen for viewing selected services,
discovering catalog services, managing profiles/credentials, and adding custom services —
with deterministic (persist-first) selection and Phase 103 execution regression protection.

> **Amendment (2026-07-07):** Service Management is **administration-only**. Service
> **execution** (open site + autofill) now lives **exclusively on Digital Home** (tile click).
> The **פתיחה** action was removed from Service Management cards, and the separate
> **ניהול פרופילים** / **עריכת פרטי כניסה** card buttons were unified into a single
> **ניהול** action that opens a progressive-disclosure management modal.

No database migration and **no extension reload** are required for this phase — it is a
web-app UX and orchestration change only. `service_registry` is read-only from the UI.

## What changed

- **Two-section layout** replacing the category-checkbox onboarding:
  - **השירותים שלי** — cards for currently selected services.
  - **הוספת שירותים** — searchable/filterable catalog cards for adding services only (no remove,
    no status badges; already-added cards show passive **✓ כבר בבית הדיגיטלי**).
- **Screen title** is now exactly **ניהול שירותים**.
- **Service cards** with a derived management-state badge
  (`לא נוסף` / `מוכן לשימוש` / `חסרים פרטי כניסה` / `מספר פרופילים`).
- **Discovery search** matches display name **and** domain; **category filter** chips.
- **Single** **הוסף שירות מותאם** entry (per-category "הוסף אתר משלי" buttons removed).
  Dashboard **הוסף שירותים נוספים** navigates to Service Management (no second modal).
- **Persist-first selection**: Digital Home reflects a selection change only **after**
  `persistVault` succeeds — no optimistic phantom tiles. Rapid clicks are ignored via an
  in-flight lock; controls disable while pending.
- **Selected-service cards** are compact management rows: small icon, service name (primary),
  and a compact muted **metadata line** below the name — `קטגוריה • סטטוס • N פרופילים`
  (e.g. `בנקים • 2 פרופילים`, `קניות • מוכן`, `בריאות • חסרים פרטי כניסה`). Profile count shows
  only when > 1. **ניהול** is the primary visible action; **הסרה** lives in a secondary kebab
  (⋮) menu so the destructive action does not visually dominate. The row is future-ready —
  more status/metadata (e.g. login-URL/sync/health) can be added to the line without a redesign.
- **Administration vs execution separation** (amended AC-104-17): Service Management has
  **no Open action** and never calls execution helpers. Digital Home tiles remain the sole
  execution surface (`openServiceWithProfile` → `executeServiceFromTile`).
- **ניהול — progressive-disclosure modal** (D-104-19):
  - **Single profile** (default private user): credential editing is shown **directly**;
    the implicit default profile is internal and profile chrome is hidden. A secondary
    **הוספת פרופיל נוסף** reveals profile creation on demand.
  - **Multiple profiles**: full profile management inside the modal — select, rename,
    set default, delete, and edit credentials per profile.

## Verification

```bash
# Phase 104 static verification (title, sections, single custom-add, derived state,
# shared open path, idempotent/pending guards, no direct registry mutation)
node scripts/verifyPhase104ServiceManagement.mjs

# Phase 103 execution regression (must still PASS)
node scripts/verifyPhase103Execution.mjs

# Build (tsc -b + vite build)
npm run build
```

## Manual regression gate (R1–R2)

Prerequisites: `npm run dev`, vault unlocked, extension installed, complete credentials saved.

| # | Surface | Service | Expected |
|---:|---|---|---|
| R1 | Digital Home tile | Shufersal | Opens `loginUrl`; generic autofill; tab stays open |
| R2 | Digital Home tile | Clalit | Opens `loginUrl`; 3-field autofill; tab stays open |

Execution runs **only** from Digital Home. **R3/R4 are retired** — Service Management no
longer exposes **פתיחה**; the absence of any execution path in Service Management is proven
statically by `verifyPhase104ServiceManagement.mjs`.

## Persist-failure test hook (T13)

To simulate a persistence failure in a dev build (verify the Hebrew error appears and no
phantom tile is created), run in the browser console before an add/remove:

```js
window.__PHASE104_FORCE_PERSIST_FAIL = true;   // enable
window.__PHASE104_FORCE_PERSIST_FAIL = false;  // disable
```

The hook is a no-op in production builds.

## Deferred (explicitly out of scope)

- **Phase 111** — full icon asset pipeline / Supabase Storage. Phase 104 uses interim
  favicon/logo resolution (`useServiceLogos`).
- **Phase 116** — URL canonicalization and duplicate-registry prevention. Custom add reuses
  the Phase 102 discovery contract; duplicate messaging only where existing logic detects it.
- Digital Home production redesign (Phase 105), registry CRUD/admin (Phase 107),
  lifecycle health UX (Phase 109).

## Known limitation

Removing a service updates local selection (authoritative) and preserves Access Profiles and
encrypted credentials. Cloud `user_services` mirroring remains best-effort under the existing
"last successful persist wins" policy; multi-device convergence beyond that is out of scope.
Global `service_registry` rows are never modified by Service Management.
