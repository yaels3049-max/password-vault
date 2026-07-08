# Manager Phase 103

## Phase Identifier
PHASE=103

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Deliver **one unified service execution pipeline** for Digital Home tile open: built-in catalog, user-created custom services, and (when present) admin-managed registry entries — with **deterministic open-first behavior** and **metadata-driven generic autofill**, without `loginUrl` discovery on tile click.

Phase 103 owns **execution orchestration and autofill gating** only. Registry metadata model, discovery, and persistence remain Phase 102 / 107 / 109.

## Source References
- `team-Yuri/arch-phase103.md`
- `team-Yuri/PLAN.md` §7 — Unified Service Execution Flow
- `team-Yuri/PLAN.md` §18 — Phase 103 acceptance criteria (AC-103-1 … AC-103-10)
- `team-Yuri/PHASE.md` — `PHASE=103`
- `team-Yuri/arch-phase102.md` — APPROVED; registry-backed catalog and login URL cache
- `team-Yuri/dev-phase102.md` — Phase 102 stabilization evidence (Shufersal/Clalit autofill regression)

## Architecture Summary (Phase 103 constraints)
- **Single entry point:** all Digital Home tile opens call `executeServiceFromTile` (AC-103-1).
- **Profile resolution upstream:** Dashboard resolves Access Profile and loads credentials by `profile_id` before execution (AC-103-2, AC-103-3).
- **Open URL:** `loginUrl ?? primaryUrl` — no inline discovery on tile click (AC-103-4).
- **Default pipeline:** open tab first; generic autofill when `loginFields` configured and credentials complete (AC-103-5, AC-103-9).
- **Site adapters exclusive:** `htzone` and `practice` use adapter path only — generic engine not attempted first (AC-103-6, AC-103-7).
- **Retire `adapterId: generic`:** Shufersal/Clalit autofill via registry `loginFields` + `loginUrl`, not interim generic adapter (D-103-7).
- **Origin independence:** built-in, user-created, and admin-managed services share identical orchestration (AC-103-10).
- **Extension policy:** remove `GENERIC_REAL_SITE_ALLOWED_HOSTS`; replace with URL safety policy (https for real sites; http localhost only) (D-103-10).
- Phase 100 `isDevBuild()` unchanged — practice dev-only; POC dashboard buttons remain dev-gated.

## Acceptance / Gating Criteria
- AC-103-1: Every service tile uses the same execution entry point
- AC-103-2: Profile resolution runs for all service types before open
- AC-103-3: Credentials loaded by `profile_id` for all service types
- AC-103-4: Open target is `loginUrl` when present, else `primaryUrl`
- AC-103-5: Generic autofill used when `loginFields` and complete credentials exist
- AC-103-6: Adapters invoked only when registry `adapterId` requires fallback
- AC-103-7: Preserve validated Shufersal and Clalit autofill behavior. Practice and HTZone continue through approved adapters
- AC-103-8: Custom services with discovery metadata participate identically to catalog services
- AC-103-9: Deterministic outcome — open URL always; autofill optional; failure never prevents site from opening
- AC-103-10: Execution independent of service origin — same pipeline for built-in, admin-managed, and user-created services

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| 1 | Unified orchestrator + autofill eligibility | Refactor `serviceExecution.ts` to D-103-8 pipeline; add `autofillEligibility.ts`; single `executeServiceFromTile` entry | All tile paths route through orchestrator; no service-id branching |
| 2 | Retire generic adapter + narrow overlay | Remove `genericAutofillAdapter` from registry; narrow `builtinCatalogOverlay` to presentation-only; optional SQL clears `adapter_id=generic` on Shufersal/Clalit | Generic autofill driven by metadata, not `adapterId: generic` |
| 3 | Remove tile-click discovery | Ensure `Dashboard.handleServiceOpen` does not call `discoverLogin` / `discoverAndPersistLoginUrl` | No discovery tab flash on tile click |
| 4 | Extension URL policy | Remove `GENERIC_REAL_SITE_ALLOWED_HOSTS`; implement `isAllowedGenericAutofillUrl`; bump `manifest.json` version | Generic fill works on https real sites; rejects dangerous protocols |
| 5 | Verification script + regression gate | Add/update `verifyPhase103Execution.mjs`; supersede or extend Phase 102 tile regression; document manual matrix | Script PASS; Phase 102 Shufersal/Clalit autofill regression preserved |
| 6 | Documentation + operator steps | Add `docs/MIGRATION_PHASE_103.md`; update `DISCOVERY_EXECUTION.md` Phase 103 row | Doc accurate; extension reload steps documented |

## Detailed Development Plan

### M1 — Unified orchestrator + autofill eligibility
Refactor `src/execution/serviceExecution.ts` as the **sole tile execution entry point** (D-103-1, D-103-8).

Implement `src/execution/autofillEligibility.ts`:
- `shouldAttemptGenericAutofill(service, credential, loginFields)` wrapping D-103-5 rules
- Uses `hasConfiguredLoginFields(service)` and `hasCompleteCredentials(credential, loginFields)`
- Independent of service id, category, or `source`

**Orchestration order (normative):**
1. Resolve `openUrl = service.loginUrl ?? service.url` (AC-103-4)
2. If `adapterId` is site-specific (`htzone`, `practice`) → adapter path (AC-103-6, AC-103-7)
3. Else default pipeline:
   - Open tab via extension `POC_GENERIC_FILL` **or** `window.open` fallback (D-103-9 — never both)
   - Generic autofill if eligibility true (AC-103-5)
   - On autofill failure: tab stays open; optional `metadataHealth` signal internal only (D-103-12)
4. Return deterministic `ServiceExecutionResult` (`ok` | `credentials_missing` | `open_only`)

**Forbidden:**
- `if (service.id === 'shufersal')` or any service-id branching in execution code
- Parallel tile paths in `Dashboard`, `pocAutofill`, or service-id switches

**Dashboard contract (AC-103-2, AC-103-3):**
- Resolve Access Profile before `executeServiceFromTile`
- Pass resolved `credential` and `loginFields` into execution

### M2 — Retire generic adapter + narrow overlay
**Remove interim Phase 102 debt (D-103-7, D-103-13):**
- Remove or internalize `src/execution/adapters/genericAutofillAdapter.ts`
- Update `src/execution/adapters/registry.ts` — **site-specific adapters only** (`htzone`, `practice`)
- Narrow `src/catalog/builtinCatalogOverlay.ts` to presentation-only merges (icon, category, favicon metadata) — **not** `adapterId`, `loginUrl`, or `loginFields` for execution
- Registry (+ seed) is execution authority for integration metadata

**Optional SQL migration** (document in `docs/MIGRATION_PHASE_103.md`):
```sql
update public.service_registry
set adapter_id = null, updated_at = now()
where id in ('shufersal', 'clalit')
  and adapter_id = 'generic'
  and owner_user_id is null;
```

Update seed reference in `builtinCatalog.ts` to drop `adapterId: 'generic'` from Shufersal/Clalit when ordered.

**Dev POC buttons (D-103-15):** `pocAutofill` demo helpers must call same orchestrator or `executeGenericAutofill` — no bypass.

### M3 — Remove tile-click discovery
Phase 103 does **not** own `loginUrl` discovery (D-103-11).

Ensure `src/Dashboard.tsx`:
- Does **not** invoke `discoverLogin`, `discoverAndPersistLoginUrl`, or extension discovery tabs on tile click
- Calls `executeServiceFromTile` only after profile resolution

Discovery remains on custom-service add / admin flows (Phase 102).

### M4 — Extension URL policy
Update `extension/background.js` (D-103-10, D-103-14):
- Remove `GENERIC_REAL_SITE_ALLOWED_HOSTS` / `isAllowedGenericRealSiteUrl`
- Add `isAllowedGenericAutofillUrl(url)`:
  - Allow `https:` for internet URLs
  - Allow `http:` only for `localhost` / `127.0.0.1` (practice demo)
  - Reject `javascript:`, `file:`, and non-http(s) schemes
- Apply policy in `POC_GENERIC_FILL` handler; payload unchanged
- Bump `extension/manifest.json` version; document manual extension reload in migration doc

### M5 — Verification script + Phase 102 regression gate

**Static verification:** add or update `scripts/verifyPhase103Execution.mjs` proving:
- `executeServiceFromTile` is sole orchestrator
- No service-id branching in `serviceExecution.ts`
- `genericAutofillAdapter` not in public adapter registry
- `Dashboard.tsx` has no tile-click discovery imports/calls
- `builtinCatalogOverlay` is presentation-only (no execution field overrides)
- Extension background has URL policy helper; allowlist removed

**Regression gate (Manager approval blocker):**
Phase 102 Shufersal and Clalit autofill **must pass** manual UAT after Phase 103 refactor.

| Regression check | Requirement |
|---|---|
| Shufersal tile | Opens `loginUrl`; extension autofills username/password; tab stays open |
| Clalit tile | Opens `loginUrl`; extension autofills 3 fields; tab stays open |
| No generic adapter | Autofill via metadata (`loginFields` + `loginUrl`), not `adapterId: generic` |
| No discovery on click | No temporary discovery tab on tile open |

Supersede or update `scripts/verifyPhase102TileRegression.mjs` — Phase 103 expectations differ (generic adapter removed). Document which script is authoritative post-103.

### M6 — Documentation
Create `docs/MIGRATION_PHASE_103.md` including:
- Phase 103 scope summary (execution only; no discovery)
- Extension reload requirement after `background.js` change
- Optional SQL migration for `adapter_id` cleanup
- Manual functional test matrix (below)
- Regression gate checklist

Update `src/discovery/execution/DISCOVERY_EXECUTION.md` — Phase 103 row replaces Phase 102 stabilization table.

## Functional Test Matrix

**Prerequisites:** vault unlocked; extension installed (`VITE_POC_EXTENSION_ID`); Phase 102 migrations applied; `npm run dev` at `http://localhost:5173/`.

| # | Service | Type | Credentials | Expected open URL | Expected autofill | Tab stays open on fill fail | AC mapping |
|---:|---|---|---|---|---|---|---|
| T1 | **Shufersal** | Built-in catalog | Complete (username, password) | `loginUrl` from registry | Generic fill via extension | Yes | AC-103-4,5,7,9 |
| T2 | **Clalit** | Built-in catalog | Complete (3 fields per `loginFields`) | `loginUrl` from registry | Generic fill via extension | Yes | AC-103-4,5,7,9 |
| T3 | **HTZone** | Built-in catalog | Complete | Adapter open URL | `htzone` adapter path | Yes | AC-103-6,7,9 |
| T4 | **Practice** (`hub-practice-login`) | Dev-only built-in | Complete | Demo page URL | `practice` adapter path | Yes | AC-103-6,7 (dev only) |
| T5 | **Leumi** (or similar bank) | Built-in catalog | Any / none | `primaryUrl` (no `loginUrl`) | None — open only | Yes | AC-103-4,5,9 |
| T6 | **Custom service** | User-created | Complete + discovered `loginUrl` + `loginFields` | `loginUrl` from user registry row | Same generic pipeline as catalog | Yes | AC-103-8,10 |
| T7 | **Shufersal** | Built-in catalog | Incomplete / missing | `loginUrl` | None; Hebrew credentials prompt | Yes | AC-103-3,9 |
| T8 | Any selected service | Any | N/A | Resolved URL | No discovery tab opens/closes on click | Yes | D-103-11 |
| T9 | Custom vs built-in | Origin comparison | Same metadata shape | Same orchestration path | Identical eligibility rules | Yes | AC-103-10 |

**Pass criteria:** all rows T1–T9 observed; T1 and T2 are **regression gate** — Manager rejects if either fails.

## Required Developer Evidence
`team-Yuri/dev-phase103.md` must include:

| Evidence area | Required content |
|---|---|
| Files changed | Full list with change summary |
| M1 orchestrator | Description of unified pipeline; proof no service-id branching |
| M2 adapter/overlay | Confirmation `genericAutofillAdapter` removed; overlay narrowed |
| M3 discovery boundary | Proof Dashboard has no tile-click discovery |
| M4 extension | `manifest.json` version; URL policy description |
| M5 verification | `node scripts/verifyPhase103Execution.mjs` output (**PASS**) |
| **Regression gate** | Signed manual matrix T1–T2 (**Shufersal, Clalit**) with extension version, browser, and observed behavior |
| Functional matrix | Manual results for T3–T9 (or documented N/A for T4 if not dev build) |
| Documentation | `docs/MIGRATION_PHASE_103.md` + `DISCOVERY_EXECUTION.md` update |
| Build | `npm run build` output (**PASS**) |
| Tests / lint | Result or NOT AVAILABLE with reason |

## Out of Scope (must not be implemented)
- `loginUrl` discovery or refresh on tile click (Phase 102 / 107 / 109)
- Registration/login UX (Phase 190)
- Admin platform UI (Phase 107)
- New site adapters beyond `htzone` and `practice`
- Auto-submit login forms
- Vault crypto, IndexedDB format, or cloud credential read path changes
- Digital Home / Manage Services production UX redesign (Phases 104–105)
- Phase 112 login intelligence / DOM learning
- `service_role` key in client
- National-catalog autofill reliability program (ADR-003 breadth)

## Risks / Open Questions
- **Phase 102 regression:** Shufersal/Clalit autofill is the highest-risk refactor surface; regression gate T1/T2 is mandatory for Manager approval.
- **Extension reload:** Operators must reload unpacked extension after `background.js` changes — document explicitly.
- **Banks without `loginUrl`:** Open `primaryUrl` only; generic autofill may attempt on homepage if fields+credentials present — failure is non-blocking.
- **Overlay narrowing:** Ensure presentation-only overlay does not break icons/categories while execution reads registry integration fields.
- **verifyPhase102TileRegression.mjs:** Expectations change in Phase 103; Developer must update or supersede to avoid false PASS/FAIL.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes

### Required Corrections
