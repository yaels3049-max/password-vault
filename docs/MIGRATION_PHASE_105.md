# Migration Guide — Phase 105 (Digital Home UX)

## Scope

Phase 105 delivers the production **Digital Home** surface (**הבית הדיגיטלי**):
category-grouped execution tiles, Useful Services and Notifications foundations,
friendly empty/loading/offline states, and calm presentation — while **preserving
Phase 103 unified execution** and **strict separation from Service Management**
(Phase 104).

No database migration and **no extension reload** are required for this phase —
it is a web-app Digital Home UX change only.

## What changed

- Screen title **הבית הדיגיטלי** (replaces interim **המרכז הדיגיטלי שלי**).
- Page structure: Header → (Useful Services / Notifications when content exists) → selected services.
  Empty foundations stay **hidden** — no placeholder cards and no reserved vertical space.
- **Adaptive selected-services layout** (count selected services only; Useful/Notifications excluded):
  - **≤ 12** → flat app-launcher grid (no category headers)
  - **≥ 13** → category-grouped sections (empty categories hidden; each service once)
  Category remains Service Registry metadata for Service Management / search / future features.
- **Launcher grid density:** desktop max **5 tiles per row**; tablet ~4; mobile ~3–4. Larger
  fixed tile size with comfortable spacing (presentation only — execution unchanged).
- **No** manage / remove / credential-edit controls on tiles.
- Tile open path unchanged: `openServiceWithProfile` → `executeServiceFromTile`.
- Missing-credentials open still opens the site when a URL is available and shows Hebrew guidance.
- Empty selection → CTA to Service Management; soft catalog loading shells; friendly offline/error copy.
- Soft-deferred: Phase 111 icons (interim logos), Phase 113 URL canonicalization.

## Verification

```bash
# Phase 105 static verification
node scripts/verifyPhase105DigitalHome.mjs

# Phase 103 execution regression (must still PASS — orchestrator unchanged)
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

Service Management Open remains **retired** (Phase 104). Digital Home is the sole execution surface.

## Soft-deferred (explicitly out of scope)

- **Phase 111** — full icon asset pipeline / Supabase Storage (interim `useServiceLogos`).
- **Phase 113** — URL canonicalization / duplicate-registry prevention.
- Advanced notification engine; full Useful Services ranking algorithm.
- Security/trust UX (Phase 106), registry CRUD (Phase 107), lifecycle health (Phase 109).

## Known limitation

Useful Services and Notifications ship as **foundation modules** that remain **hidden until
meaningful content exists**. Empty placeholders and reserved vertical space are intentionally
avoided. Future phases enable both sections dynamically without redesign.
