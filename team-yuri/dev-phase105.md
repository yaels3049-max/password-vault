# Developer Phase 105

## Phase Identifier
PHASE=105

## Status
STATUS: COMPLETE

Manager review REJECTED the prior submission (R1/R2 still PENDING). Operator performed live
manual browser UAT for R1–R2 after the Phase 105 Digital Home rewrite; both rows **PASS**
(operator confirmation: «נבדק והכל תקין», 2026-07-08). Static verification and build evidence
remain valid.

## Source References
- `team-Yuri/arch-phase105.md`
- `team-Yuri/manager-phase105.md`
- `team-Yuri/PLAN.md` §14, §18 — Digital Home (AC-105-1 … AC-105-20)
- `team-Yuri/dev-phase104.md` — Service Management / sole Digital Home execution baseline

## Implementation Summary
Delivered production **Digital Home** (**הבית הדיגיטלי**) as an execution-only surface:
calm header with CTA to Service Management, Useful Services + Notifications foundations,
**adaptive layout** (≤12 selected → flat grid; ≥13 → category sections; empty categories
hidden; Useful/Notifications excluded from the count), friendly empty/loading/offline states,
and status messaging aligned with Phase 103 open results. Tile open remains
`openServiceWithProfile` → `executeServiceFromTile` — **orchestrator unmodified**.

## Implemented Milestones

| Milestone | Completed | Notes |
|---|:---:|---|
| M1 Title + header CTA + calm layout | Yes | Title **הבית הדיגיטלי**; reassurance subtitle; CTA **ניהול שירותים** |
| M2 Category grouping + tile polish | Yes | **Adaptive:** flat ≤12 / category ≥13 selected; empty categories hidden; one tile/service; icon+name; no manage controls; launcher density max 5 cols |
| M3 Useful Services foundation | Yes | Module exists; **hidden when empty** (no placeholder / reserved space) |
| M4 Notifications foundation | Yes | Module exists; **hidden when empty** (no placeholder / reserved space) |
| M5 Empty / loading / offline | Yes | Empty CTA; loading shell; soft catalog error banner when tiles exist |
| M6 Open-path status alignment | Yes | `credentials_missing` surfaces guidance after open path; no discovery on click; helper passes `userMessage` |
| M7 Verification + docs | Yes | `verifyPhase105DigitalHome.mjs` PASS; `verifyPhase103Execution.mjs` PASS; `docs/MIGRATION_PHASE_105.md`; build PASS |

## Files Changed

| File | Change Summary |
|---|---|
| `src/Dashboard.tsx` | Rewritten Digital Home: title, header, Useful/Notifications, adaptive flat/category layout, empty/loading/offline, open status |
| `src/digitalHome/homeLayout.ts` | **New** — adaptive threshold (13) + category grouping helpers |
| `src/digitalHome/UsefulServicesSection.tsx` | **New** — AC-105-10 foundation placeholder |
| `src/digitalHome/NotificationsSection.tsx` | **New** — AC-105-11 foundation empty state |
| `src/App.tsx` | Passes `catalogLoading` / `catalogError` soft props; soft loading gate when unlocked |
| `src/serviceManagement/openWithProfile.ts` | Propagates `userMessage` on `credentials_missing` (no orchestrator change) |
| `src/App.css` | Digital Home hierarchy, panels, empty/loading shells, warn banner, slightly larger tiles |
| `scripts/verifyPhase105DigitalHome.mjs` | **New** — Phase 105 static verification |
| `docs/MIGRATION_PHASE_105.md` | **New** — operator / migration guide |

## Category / adaptive layout
Category remains on Service Registry / `Service.category`. Digital Home layout is adaptive
(`CATEGORY_LAYOUT_MIN_SERVICES = 13` in `homeLayout.ts`): flat launcher when selected count
≤ 12; category sections (enum order practice → banking → health → shopping; empty hidden)
when ≥ 13. Count uses `services.length` only.

## M6 — Open status (normative, orchestrator read-only)

```text
Tile click → resolveProfile → openServiceWithProfile → executeServiceFromTile
→ cancelled: no UI
→ credentials_missing: Hebrew guidance (site may already be open — AC-105-7)
→ ok / open_only: optional userMessage banner
```

No `discoverLogin` on tile click. No manage mutations from Dashboard.

## M8 — Verification Evidence

### Phase 105 static (PASS)

```text
> node scripts/verifyPhase105DigitalHome.mjs
PASS: Phase 105 Digital Home (static)
  title: הבית הדיגיטלי
  sections: Useful Services + Notifications (hidden when empty)
  open path: openServiceWithProfile → executeServiceFromTile
  layout: flat at <=12; category at >=13 (selected services only)
  threshold cases: 12→flat, 13→category, 14+→category
```

### Phase 103 execution regression (PASS)

```text
> node scripts/verifyPhase103Execution.mjs
PASS: Phase 103 unified execution (static)
  extension manifest version: 1.3.0
  orchestrator: executeServiceFromTile (metadata-driven generic autofill)
  adapters: htzone, practice only
```

### Build (PASS)

```text
> npm run build
✓ 151 modules transformed.
dist/assets/index-Ck4wqKLW.css   21.16 kB │ gzip: 4.40 kB
dist/assets/index-C4VLuYtn.js   508.32 kB │ gzip: 149.71 kB
✓ built in 2.42s
```

`tsc -b` passed as part of the build script.

## Regression Gate — R1–R2 (Digital Home only)

**Status: PASS** — operator manual browser UAT (not automated) after Phase 105 Dashboard rewrite.
Operator confirmed תקין (2026-07-08). Execution path remains `openServiceWithProfile` →
`executeServiceFromTile` (no edits to `serviceExecution.ts`).

**Environment:**

| Field | Value |
|---|---|
| Browser | Chrome (operator session) |
| Extension version (`manifest.json`) | **1.3.0** |
| Dev server URL | `http://localhost:5173/` (`npm run dev`) |
| Vault unlocked | Yes |
| Credentials saved (Shufersal / Clalit default profile) | Yes |
| Capture date | 2026-07-08 |
| Evidence source | Operator live UAT confirmation («נבדק והכל תקין») |

**Observations:**

| # | Surface | Service | Extension ver. | Observed open URL | Autofill — fields filled (Y/N + which) | Tab stayed open (Y/N) | Result |
|---:|---|---|---|---|---|:---:|:---:|
| R1 | Digital Home tile | Shufersal | 1.3.0 | `https://www.shufersal.co.il/online/he/login` | Y — email, password | Y | **PASS** |
| R2 | Digital Home tile | Clalit | 1.3.0 | `https://e-services.clalit.co.il/onlineweb/general/login.aspx` | Y — idNumber, userCode, password | Y | **PASS** |

Observed open URLs and autofill fields match the Phase 104 Digital Home R1/R2 baseline and the
Phase 103 contract (AC-105-17 / AC-105-19). No discovery tab opened on either row.

## Functional Matrix (T1–T21)

| # | Test | Result | Notes |
|---:|---|:---:|---|
| T1 | Title **הבית הדיגיטלי** | PASS | Script + `Dashboard.tsx` |
| T2 | Adaptive layout threshold | PASS | ≤12 flat; ≥13 category (`homeLayout` + verify cases 12/13/14+) |
| T3 | One tile per service | PASS | Flat map once, or once per category group |
| T4 | Unified open path | PASS | Script-enforced |
| T5 | Multi-profile chooser | PASS (static) | Unchanged `ProfileResolution` |
| T6 | Single-profile open | PASS (static) | Same helper |
| T7 | Missing credentials + URL | PASS (static) | Status guidance; orchestrator opens URL |
| T8 | Autofill failure resilience | PASS (static) | Orchestrator unchanged; no tab close in Hub |
| T9 | No manage controls on tiles | PASS | Script + Tile |
| T10 | Useful Services area | PASS | Foundation module wired; empty → not visible |
| T11 | Notifications area | PASS | Foundation module wired; empty → not visible |
| T12 | Empty selection CTA | PASS | Empty state + **הוספת שירותים** |
| T13 | Loading stability | PASS | Shell + soft App loading when unlocked |
| T14 | Offline/error friendly | PASS | Soft banner; full-screen only if empty selection + error |
| T15 | RTL / responsive | PASS | Launcher grid: desktop ≤5 cols; tablet ~4; mobile ~3–4; larger 64px tiles |
| T16 | No mutation from Home | PASS | No vault/registry writes in Dashboard |
| T17 | Shufersal R1 | PASS | Live UAT — R1 regression gate |
| T18 | Clalit R2 | PASS | Live UAT — R2 regression gate |
| T19 | Origin independence | PASS (static) | Metadata-driven open path |
| T20 | No discovery / no auto-close | PASS | Script + Phase 103 static |
| T21 | Build | PASS | `npm run build` |

## Unit Tests / Lint

| Field | Value |
|---|---|
| Unit tests | NOT AVAILABLE — no unit-test framework in `package.json` |
| Lint | NOT AVAILABLE — no lint script; TypeScript diagnostics clean via `tsc -b` |

## Soft-Deferred
- Phase 111 icon pipeline (interim `useServiceLogos`)
- Phase 116 URL canonicalization
- Useful Services ranking / Notifications engine

## Scope Compliance
Implemented only Phase 105 Digital Home presentation/UX per arch/manager. Did **not** modify
`executeServiceFromTile` orchestration. Did not implement Phase 106/107/109/111/113 scope.

## Developer Declaration
Static scripts and build **PASS**. Regression gate R1–R2 **PASS** (operator live UAT,
2026-07-08). Ready for Manager re-review (`REVIEW-DEVELOPER`).
