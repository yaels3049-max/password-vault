# Manager Phase 111

## Phase Identifier
PHASE=111

## Status
STATUS: READY_FOR_DEVELOPER
FOCUS: **M8 ICON REGRESSION — HIGHEST PRIORITY**

## Architecture Amendments

**Amendment A (2026-07-14) — Admin file upload (D-111-16 / AC-111-16).** Admin file picker → Storage → active managed icon. Metadata-only “אייקון (מטא-דאטה בלבד)” is not acceptable as the only path. Upload is **additive** for sites where discovery/site icon fails (e.g. Clalit).

**Amendment B (2026-07-14 regression) — Hard paint cutover blanked catalog icons.** Architect **REJECTED_PENDING_ICON_REGRESSION**. Operator: ~80% of site icons that worked via `faviconSiteUrl` / prior path are **GONE** after Phase 111. Root cause class: **M5 hard cutover** — paint uses managed Storage URLs **only**; empty `service_assets` → blank icons. Admin upload was never a license to remove the prior working path. Revises **D-111-6**, **D-111-13**; adds **D-111-17**, **AC-111-17**.

**Manager REJECTS Developer COMPLETE claim** in `dev-phase111.md` (“managed Storage URLs only — no Google / no resolveServiceLogo on paint”) while catalog icons are blank. Opens **M8** immediately.

## Phase Goal
Deliver **Service Assets and Icon Management** as an **additive** capability: Storage-backed managed icons + Admin file upload when site icons fail — **without regressing** icons that already worked via `faviconSiteUrl` / pre-111 presentation.

**Immediate (M8):** Restore paint **CASCADE** so prior good icons return **without** mass admin re-upload.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=111`
- `team-Yuri/arch-phase111.md` — **REJECTED_PENDING_ICON_REGRESSION**; D-111-1…17; AC-111-1…17
- `team-Yuri/PLAN.md` §18 — Phase 111 (incl. AC-111-17)
- `team-Yuri/dev-phase111.md` — COMPLETE claim **REJECTED** (Storage-only paint regression)
- `src/catalog/definitionToLegacyService.ts` / `logoCache` / `resolveServiceLogo.ts` — restore cascade step (2)
- `src/admin/IconMetadataEditor.tsx` — keep file upload (AC-111-16)

## Architecture Summary (constraints — amended)

| Decision | Requirement |
|---|---|
| **D-111-1…5, 7–12, 14–16** | As prior (Storage, validate, normalize, admin upload, isolation, etc.) |
| **D-111-6 (REVISED)** | **Paint CASCADE:** (1) active managed Storage URL if present; (2) **else pre-111 path** (`faviconSiteUrl` → highResFavicon / `resolveServiceLogo` / `logoCache`); (3) else emoji/deterministic fallback. **Forbidden:** blank icons solely because `service_assets` empty. |
| **D-111-13 (REVISED)** | Eliminating third-party on paint is a **later** goal after backfill — **forbidden as day-one hard cutover** without preserving visible icons. |
| **D-111-16** | Admin file upload remains required and **wins** cascade step (1) when uploaded. |
| **D-111-17** | **No icon regression** — prior working site icons must keep showing without mass admin upload. |

### Normative paint cascade (M8 — REQUIRED NOW)

```text
Service card / row paint
  → (1) if active managed Storage asset URL → use it  (Admin upload wins)
  → (2) else pre-111 path: faviconSiteUrl / highResFavicon / resolveServiceLogo / logoCache
  → (3) else emoji / deterministic fallback
  → NEVER blank the catalog because service_assets is empty
```

### Normative admin upload (unchanged, additive)

```text
Admin file upload → Storage → assetSource=admin, active
  → cascade step (1) wins
  → for Clalit-class / no usable site icon
  → refresh must NOT overwrite admin without force
```

## Acceptance Criteria

| AC | Statement |
|---|---|
| AC-111-1…4 | As prior |
| **AC-111-5 (revised)** | When an **active managed** asset exists, use it; when it does **not**, the pre-111 presentation path **must** still render the site icon — blank catalog icons after Phase 111 are a regression |
| AC-111-6…15 | As prior (fallback; non-blocking create; admin upload; refresh protect; isolation; consistency; versioning; execution independence; build) |
| AC-111-16 | Admin file picker upload remains required; usable when site icon failed |
| **AC-111-17** | **No icon regression:** services that displayed working site icons before Phase 111 must continue to display them after Phase 111 without requiring mass admin re-upload; hard cutover to empty managed Storage-only paint is forbidden |

## Hard Gates

### H1 — Admin file upload (AC-111-16) — keep
File picker → Storage → active admin asset. Still required.

### H2 — Paint CASCADE (AC-111-5 / AC-111-17) — **HARD NOW (M8)**
Managed if present → else pre-111 favicon path → else fallback. Storage-only paint with empty assets is **forbidden**.

### H3 — No icon regression (AC-111-17 / D-111-17) — **HARD**
Spot-check banks/retail sample: prior good icons visible again **without** uploading every catalog icon. Clalit (or equivalent) still admin-uploadable.

### H4 — Admin overwrite protection (AC-111-10)
Refresh does not overwrite admin upload without force.

### H5 — Execution independence (AC-111-14)
Tile open unchanged.

### H6 — Verify + docs + build
Update verify/docs for **cascade** (not “no third-party on paint” as day-one absolute). Build PASS.

**Reject COMPLETE until H2 + H3 Pass.** Do not require mass catalog upload to “fix” Home.

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| M1–M4 | Storage / discovery / Admin upload | As delivered or required | Prior signals | AC-111-1…4, 8, 16 |
| **M5 (OBSOLETE as shipped)** | Hard Storage-only cutover | **Caused regression** — superseded by cascade | Must undo Storage-only paint | — |
| M6–M7 | Refresh / docs / verify | Update for cascade semantics | Docs + verify describe cascade | AC-111-10, 15 |
| **M8** | **Icon regression fix (CASCADE)** | Restore paint cascade immediately; keep Admin upload | Spot-check prior icons back + Clalit uploadable | **AC-111-5, 17** |

**M8 is highest priority over new features.**

## AC → Milestone Mapping (regression focus)

| AC | Milestone | Live / UAT |
|---|---|---|
| AC-111-16 | M4 | Admin upload still works (Clalit-class) |
| **AC-111-5 / 17** | **M8** | Banks/retail sample icons visible again without mass upload |
| AC-111-10 | M6 | Admin upload preserved on refresh |
| AC-111-15 | M7/M8 | Build PASS |

## Detailed Development Plan

### M8 — Icon regression fix (**DO THIS NOW**)

1. **Restore paint CASCADE immediately** in resolver / `definitionToLegacyService` / `logoCache` (and any surface still Storage-only):
   - (1) active managed Storage URL if present
   - (2) else pre-111 path (`faviconSiteUrl` → highResFavicon / `resolveServiceLogo` / `logoCache`)
   - (3) else emoji / deterministic fallback
2. **Keep** Admin file upload (AC-111-16) — wins when uploaded (cascade step 1).
3. **Do NOT** require uploading every catalog icon to fix Home.
4. Reverse M5 “managed only / no Google / no resolveServiceLogo on paint” absolute.
5. Update `verifyPhase111Assets.mjs` + `docs/MIGRATION_PHASE_111.md`: day-one = **cascade**; hard cutover to managed-only is future/optional after backfill.
6. UAT before any new COMPLETE claim:
   - Spot-check prior good icons (banks, retail that used faviconSiteUrl) **visible again**
   - Clalit (or failed-discovery) still **admin-uploadable** and shows after upload
   - Zap/login/execution untouched

### M1–M4, M6 (keep)
Admin upload, Storage, discovery, refresh-protect admin — retain. Do not break while fixing paint.

### M5 — superseded
Treat shipped “Storage URLs only” as a **bug**. Replace with cascade. Do not re-introduce Storage-only hard cutover as COMPLETE.

### M7 — docs/verify update for cascade
Rewrite any claim that Phase 111 day-one forbids third-party presentation on paint.

## Functional Test Matrix (M8 critical)

| # | Test | Expected | AC |
|---:|---|---|---|
| **T15** | **Prior faviconSiteUrl catalog tile (bank/retail sample)** | Site icon visible again **without** admin upload | **AC-111-17** |
| **T16** | **~catalog not blank** | Majority of prior-good icons restored; not universally empty | **AC-111-17** |
| **T17** | **Admin upload still works** | Clalit-class upload → Home shows uploaded icon | AC-111-16 |
| **T18** | **Uploaded wins** | Where admin asset active, managed URL used | AC-111-5 |
| T19 | Cascade empty assets | Falls through to pre-111 path; not blank | AC-111-5, 17 |
| T20 | Refresh | Does not wipe admin upload | AC-111-10 |
| T21 | Build + verify | PASS with cascade contracts | AC-111-15 |

**Critical:** T15–T18 before COMPLETE.

## Required Developer Evidence
`team-Yuri/dev-phase111.md` must **withdraw COMPLETE** and document M8:

| Evidence area | Required content |
|---|---|
| COMPLETE disposition | Acknowledge REJECTED_PENDING_ICON_REGRESSION; Storage-only paint was wrong |
| Cascade implementation | Explicit (1)/(2)/(3) in paint path |
| Spot-check UAT | Banks/retail sample prior icons **Pass** without mass upload |
| Admin upload retained | Clalit (or equivalent) upload Still Pass |
| Docs/verify | Cascade semantics; no day-one Storage-only absolute |
| Build | PASS |

## Out of Scope (for M8)
- Mass-uploading all catalog icons as the “fix”
- Requiring full Storage backfill before showing icons again
- Hard cutover to managed-only paint
- Phase 108 discovery churn
- New asset features before T15–T18 Pass

## Risks / Open Questions
- Leaving Storage-only paint = continued ~80% blank icons — unacceptable.
- Future managed-only cutover only after backfill (D-111-13 revised).
- Do not break Clalit admin-upload path while restoring cascade.

## Manager Review
MANAGER_REVIEW_STATUS: REJECTED

### Review Notes
- Architect **REJECTED_PENDING_ICON_REGRESSION** (AC-111-17 / D-111-17).
- **Reject Developer COMPLETE** — M5 “managed Storage only” blanked catalog icons; contradicts additive Admin-upload intent.
- Operator: ~80% prior site icons gone; Admin upload must remain for failures (Clalit), not replace the catalog path.
- **M8 opened** — paint cascade restore is **highest priority**.
- STATUS: **READY_FOR_DEVELOPER** focused on **M8 only**.

### Required Corrections
1. Restore paint CASCADE immediately (managed → pre-111 favicon path → fallback).
2. Keep Admin file upload; do not require mass catalog upload.
3. Spot-check prior good icons restored + Clalit still uploadable.
4. Update verify/docs; withdraw COMPLETE until T15–T18 Pass.
5. No new features until icon regression fixed.
