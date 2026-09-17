# Autofill Runtime Convergence — Read-Only Inventory (DEFERRED workstream)

**Status:** PRESERVED INPUT — **DEFERRED** relative to Phase 119.  
**Phase 119 name:** Generic Advanced Login Mapping (`arch-phase119.md`) — Convergence is **not** Phase 119 scope.  
**Source:** Phase 118 post-CLOSE Architecture inventory (read-only; no production changes).  
**Implementation:** NOT STARTED (deferred workstream)

## Post-118 items carried forward

| Item | Classification |
|---|---|
| D-118-13 | Production-readiness security/privacy gate (provider data handling before unrestricted production Admin Analyze) |
| Autofill Runtime Convergence | **This phase (119)** — architectural workstream |
| Hapoalim zero-capture / advanced login experiences | Deferred capability (out of simple `single_page_top` Managed success) |
| Filtered-network operational NFR | Deferred production-readiness |

## Target

One production fill runtime for supported **simple** services: **Phase 117 Managed Autofill**. Service-specific adapters and permanent parallel fill engines must not remain the long-term production model.

**Migration principle (per service):**  
working path → author Managed config → live-validate Managed → switch runtime to Managed → regression verify → only then remove obsolete path.  
No big-bang. No designed outage. No weakening Phase 117 rules. No moving adapter-specific behavior into generic Managed merely to preserve an old path.

## Orchestrator

`executeServiceFromTile` (`src/execution/serviceExecution.ts`)

**Priority:** (1) site `adapterId` → (2) Managed → (3) LI medium identity-first → (4) legacy generic → (5) open-only.

## Path inventory

| # | Path | Class | Hub | Extension message |
|---|---|---|---|---|
| 1 | Managed Autofill | Phase 117 Managed | `managedAutofill.ts` | `HUB_MANAGED_AUTOFILL` |
| 2 | HTZone adapter | Service-specific | `adapters/htzoneAdapter.ts` | `POC_FILL_IL` |
| 3 | Practice adapter | Service-specific (local demo) | `adapters/practiceAdapter.ts` | `POC_FILL_DEMO` |
| 4 | Generic heuristic fill | Legacy generic | `genericAutofill.ts` | `POC_GENERIC_FILL` |
| 5 | Medium / identity-first | Legacy generic variant (+ host allowlist) | `mediumAssist.ts` | `POC_IDENTITY_FIRST_FILL` |
| 6 | Complex / open-only | Open-only | LI + orchestrator | — |
| 7 | POC Hub helpers / `?pocAutofill=1` | POC/demo/test | `pocAutofill.ts`, `content.js` | demo / IL |

Site-specific adapter registry: **only** `{ htzone, practice }`.

## Service-specific production paths

### HTZone (`adapterId: htzone`)

- **Locations:** `htzoneAdapter.ts`; `extension/htzone-adapter.js`; `background.js` `openHtzonePageAndFill`; catalog seed  
- **Selection:** `adapterId === 'htzone'` before Managed/generic  
- **Behavior:** email/password → HTZone `/login` → site script → **prepare login popup** → site CSS fill; no submit; Hub fire-and-forget  
- **Managed-representable?** Partial — schema + HTTPS + CSS yes; popup/DOM prep is **not** Managed contract (must not push into Managed core)  
- **Before remove:** Managed profile authored + live validate without adapter prep (or classify out of simple Managed) → clear `adapterId` → regression → then delete adapter code  

### Practice (`hub-practice-login` / `adapterId: practice`)

- **Locations:** `practiceAdapter.ts`; `PAGE_CONFIGS` / `mappings.js`; localhost demos  
- **Managed-representable?** No under current HTTPS Login Entry rules  
- **Before remove:** Keep as dev/POC policy, or HTTPS Managed demo redesign  

## Legacy generic (retain until migrated)

| Path | Typical users | Notes |
|---|---|---|
| `POC_GENERIC_FILL` | Clalit, Shufersal, customs without Managed | Heuristic detect→map→fill; no service-id branch in mapper |
| `POC_IDENTITY_FIRST_FILL` | LI=`medium` + allowlisted hosts (e.g. amazon-il, ksp) | Fourth Hub production path |

Clalit/Shufersal: catalog schema + Login Entry + **legacy generic**, not adapters — still parallel to Managed until validated Managed profiles exist.

## Suggested migration stages (architecture draft input only)

| Stage | Scope |
|---|---|
| M0 | Inventory freeze (this document) |
| M1 | HTZone pilot (Managed or explicit out-of-simple decision) |
| M2 | Catalog generics (Clalit, Shufersal, …) per-service |
| M3 | Medium sites cohort |
| M4 | Retire adapters after switch+regression |
| M5 | Retire legacy generic as production default when no dependents remain |
| M6 | Optional medium-path retirement |

## Conditions to retire legacy generic (draft)

1. Every supported simple production service has Managed `validated` (or explicitly unsupported).  
2. Orchestrator no longer uses silent generic fallback for “has loginFields.”  
3. Former generic anchors PASS on Managed.  
4. No product feature depends on heuristic mapping.  
5. Dev-only generic behind `import.meta.env.DEV` optional.

## Non-goals for Phase 119 Architecture (until arch-phase119 says otherwise)

- Phase 118 Assisted Mapping changes  
- Weakening Phase 117 deterministic rules  
- Big-bang adapter deletion  
- Expanding zero-capture / Hapoalim into simple Managed without new capability  
