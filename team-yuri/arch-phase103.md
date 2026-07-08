# Architecture Phase 103

## Phase Identifier
PHASE=103

## Status
STATUS: READY_FOR_MANAGER

## Phase Goal
Deliver **one unified service execution pipeline** for Digital Home tile open: built-in catalog, user-created custom services, and (when present) admin-managed registry entries — with **deterministic open-first behavior** and **metadata-driven generic autofill**, without `loginUrl` discovery on tile click.

Phase 103 owns **execution orchestration and autofill gating** only. Registry metadata model, discovery, and persistence remain Phase 102 / 107 / 109.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=103`
- `team-Yuri/PLAN.md` §7 — Unified Service Execution Flow
- `team-Yuri/PLAN.md` §18 — Phase 103 acceptance criteria (AC-103-1 … AC-103-10)
- `team-Yuri/arch-phase102.md` — APPROVED; registry-backed catalog, login URL cache, tile open stabilization
- `team-Yuri/dev-phase102.md` — Phase 102 stabilization evidence; Shufersal/Clalit autofill regression fixed
- `src/execution/serviceExecution.ts` — current split path (adapter vs open-only)
- `src/execution/adapters/genericAutofillAdapter.ts` — Phase 102 interim `adapterId: generic`
- `src/catalog/builtinCatalogOverlay.ts` — Phase 102 interim registry overlay
- `src/service/legacyService.ts` — `hasConfiguredLoginFields`, `getServiceOpenUrl`
- `extension/background.js` — `POC_GENERIC_FILL`, `GENERIC_REAL_SITE_ALLOWED_HOSTS`
- `src/Dashboard.tsx` — profile resolution before tile execution
- `src/discovery/execution/DISCOVERY_EXECUTION.md` — discovery vs tile execution boundary

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-103-1: Single Hub execution entry point** | AC-103-1, AC-103-10 | All Digital Home tile opens call **one** function: `executeServiceFromTile` (name may remain; behavior unified). No parallel tile paths in `Dashboard`, `pocAutofill`, or service-id switches. |
| **D-103-2: Profile resolution stays upstream of execution** | AC-103-2, AC-103-3; PLAN §7 step 2–3 | `Dashboard` (or future execution facade) resolves Access Profile **before** calling execution. Execution receives `service`, resolved `credential`, and `loginFields` — it does not branch on service origin. |
| **D-103-3: Open URL resolution** | AC-103-4 | `openUrl = service.loginUrl ?? service.url` (registry `login_url` / `primary_url` after mapper). No inline discovery when `loginUrl` missing. |
| **D-103-4: Open-first, autofill-second (progressive enhancement)** | AC-103-9 | Navigation must succeed even when extension unavailable, credentials incomplete, or autofill fails. Autofill never blocks open. |
| **D-103-5: Metadata-driven generic autofill** | AC-103-5, AC-103-8 | Generic autofill runs when **`hasConfiguredLoginFields(service)`** and **`hasCompleteCredentials(credential, loginFields)`** — independent of service id, category, or `source`. Target URL is always `openUrl` from D-103-3. |
| **D-103-6: Site adapters are exclusive paths** | AC-103-6, AC-103-7 | When `adapterId` is a **site-specific** adapter (`htzone`, `practice`), that adapter owns open+fill. Generic engine is **not** attempted first for those services. |
| **D-103-7: Retire `adapterId: generic` interim** | Phase 102 stabilization debt; PLAN §7 generic-first | Shufersal and Clalit autofill is preserved via **registry `loginFields` + `loginUrl`**, not via `adapterId: generic`. Remove `genericAutofillAdapter` from public adapter registry. Optional SQL migration clears `adapter_id = 'generic'` on built-in rows. |
| **D-103-8: Unified orchestration order** | Reconciles PLAN §7 with AC-103-6 | **(1)** Resolve `openUrl`. **(2)** If site-specific `adapterId` → adapter path. **(3)** Else default pipeline: open tab, then generic autofill if D-103-5 true. **(4)** Return deterministic `ServiceExecutionResult`. |
| **D-103-9: Single open authority** | AC-103-9; avoid double tabs | For generic path: extension `POC_GENERIC_FILL` opens the tab **or** Hub `window.open` fallback — never both on success. For open-only: Hub `window.open` once. |
| **D-103-10: Remove extension POC host allowlist** | Phase 102 tech debt; AC-103-8 | Delete `GENERIC_REAL_SITE_ALLOWED_HOSTS` gating. Replace with **URL safety policy**: allow `https:` for real sites; allow `http:` only for localhost / 127.0.0.1 (practice demo); reject dangerous protocols. User-initiated tile click is the trust boundary. |
| **D-103-11: No tile-click discovery** | Phase 102 boundary; PLAN §18 | `discoverLogin`, `discoverAndPersistLoginUrl`, and extension discovery tabs are **not** invoked from `Dashboard.handleServiceOpen`. Discovery remains on custom-service add / admin flows only. |
| **D-103-12: Non-blocking metadata health signal (minimal)** | PLAN §18 stale-metadata note | On autofill failure or obvious navigation mismatch, execution may emit an internal signal (e.g. `metadataHealth: 'fill_failed'`) for future Phase 109 UX. **Must not** block open, run discovery inline, or show engine errors to users. User messaging stays Hebrew, non-technical (existing copy patterns). |
| **D-103-13: Narrow `builtinCatalogOverlay`** | Phase 102 interim | After Phase 103, overlay may merge **presentation-only** gaps (icon, category, favicon metadata) — **not** `adapterId`, `loginUrl`, or `loginFields` for execution. Registry (+ seed migrations) is execution authority. |
| **D-103-14: Extension message contract unchanged** | Minimize bridge churn | Hub continues `POC_GENERIC_FILL` with `{ url, loginFields, credentials }`. HTZone `POC_FILL_IL` and practice `POC_FILL_DEMO` unchanged. Bump extension `manifest.json` version on background changes. |
| **D-103-15: Dev POC dashboard buttons remain dev-gated** | Phase 100 boundary | `pocAutofill` demo buttons stay behind `isPocControlsVisible()`; they must not become a second production execution path. |

### Unified execution pipeline (normative)

```text
Service Tile (Dashboard)
↓
Resolve Access Profile          ← Dashboard (AC-103-2)
↓
Load Credentials by profileId   ← Dashboard / vaultState (AC-103-3)
↓
executeServiceFromTile(service, credential, loginFields)   ← AC-103-1
↓
openUrl ← loginUrl ?? primaryUrl                            ← AC-103-4
↓
┌─ adapterId ∈ { htzone, practice }? ─────────────────────┐
│  YES → site adapter.execute (open + fill)               │ ← AC-103-6/7
└─ NO → default pipeline ─────────────────────────────────┘
        ↓
        open tab (extension generic or window.open fallback)
        ↓
        generic autofill IF loginFields configured AND credentials complete
        ↓
        on autofill failure: tab stays open; optional metadata health signal
↓
Execution Complete (deterministic result)                   ← AC-103-9
```

**Origin independence (AC-103-10):** Built-in, user-created, and admin-managed services all enter `executeServiceFromTile` with the same orchestration rules. Differentiation is **registry metadata only** (`loginUrl`, `loginFields`, `adapterId`).

## Constraints / Non-Negotiables
- No `loginUrl` discovery or refresh on tile click (Phase 102 / 107 / 109 own discovery and maintenance).
- No plaintext credentials in registry (ADR-002 unchanged).
- No registration/login UX (Phase 190).
- No admin platform UI (Phase 107).
- No `service_role` key in client.
- No service-id branching in Hub execution code (`if (service.id === 'shufersal')` forbidden).
- Phase 100 `isDevBuild()` rules unchanged — practice service dev-only.
- **Shufersal and Clalit autofill must remain validated** after refactor (AC-103-7).
- **HTZone and practice** remain on approved adapters (AC-103-7).
- Execution failure must never prevent opening a usable URL (AC-103-9).

## Technical Boundaries / Out of Scope
- `loginUrl` discovery, RPC persist, and registry refresh UX (Phase 102 cache model, Phase 107 admin, Phase 109 lifecycle hints).
- Broad national-catalog autofill reliability program (ADR-003 breadth — metadata enables autofill; success per site not guaranteed in 103).
- Auto-submit login forms.
- New site adapters beyond `htzone` and `practice`.
- Vault crypto, IndexedDB format, or cloud credential read path changes.
- Digital Home / Manage Services production UX redesign (Phases 104–105).
- Phase 112 login intelligence, DOM learning, or adapter recommendation.
- Removing `builtinCatalog.ts` from repo (seed reference remains).
- Admin-managed global catalog entries (no Phase 107 admin rows yet — pipeline must be ready, not admin UI).

## Dependencies and Interfaces

### Hub modules (Developer — target ownership)

| Module | Responsibility |
|--------|----------------|
| `src/execution/serviceExecution.ts` | **Unified orchestrator** implementing D-103-8; sole tile entry point |
| `src/execution/autofillEligibility.ts` (new) | `shouldAttemptGenericAutofill(service, credential, loginFields)` — wraps D-103-5 rules |
| `src/execution/genericAutofill.ts` | Extension bridge for `POC_GENERIC_FILL`; open fallback when extension unavailable |
| `src/execution/extensionBridge.ts` | `sendExtensionMessage`, `openUrlInNewTab` — unchanged surface |
| `src/execution/adapters/registry.ts` | **Site-specific adapters only** (`htzone`, `practice`) after D-103-7 |
| `src/execution/adapters/htzoneAdapter.ts` | Unchanged contract |
| `src/execution/adapters/practiceAdapter.ts` | Unchanged contract |
| `src/Dashboard.tsx` | Profile resolution → `executeServiceFromTile`; no discovery on tile click |
| `src/catalog/builtinCatalogOverlay.ts` | Narrow per D-103-13 (presentation-only) |
| `src/registry/registryLoader.ts` | No execution branching; continues catalog load |

**Remove or internalize:** `src/execution/adapters/genericAutofillAdapter.ts` (interim Phase 102).

### Extension modules

| Area | Change |
|------|--------|
| `extension/background.js` | Remove `GENERIC_REAL_SITE_ALLOWED_HOSTS` / `isAllowedGenericRealSiteUrl` host checks |
| URL policy | New `isAllowedGenericAutofillUrl(url)` — https for internet; http for localhost dev/demo only |
| `POC_GENERIC_FILL` handler | Unchanged payload; apply new URL policy |
| `manifest.json` | Version bump; host_permissions may remain broad (MV3 scripting); policy enforced in code |

### Optional data migration (non-blocking for dev)

```sql
-- Clear interim generic adapter; autofill from login_fields + login_url
update public.service_registry
set adapter_id = null, updated_at = now()
where id in ('shufersal', 'clalit')
  and adapter_id = 'generic'
  and owner_user_id is null;
```

Registry seed reference (`builtinCatalog.ts`) should drop `adapterId: 'generic'` from Shufersal/Clalit when Manager orders seed hygiene (optional same phase or follow-up migration).

### Execution result contract

Keep `ServiceExecutionResult` shape; statuses must cover:

| Status | Meaning |
|--------|---------|
| `ok` | Tab opened; autofill attempted or not per metadata |
| `credentials_missing` | Tab opened; user prompted to configure credentials (Hebrew copy) |
| `open_only` | Tab opened; autofill not eligible (no configured `loginFields` or incomplete credentials) |

Autofill failure after open maps to `ok` + `autofillAttempted: true` (site stays open per AC-103-9). Do not surface extension error strings in UI.

### Phase 102 interim → Phase 103 migration map

| Interim (102) | Phase 103 target |
|---------------|------------------|
| Split path: `adapterId` → adapter, else `window.open` only | Single orchestrator; default path always opens, optionally autofills |
| `adapterId: generic` on Shufersal/Clalit | Metadata-only generic autofill (D-103-7) |
| `builtinCatalogOverlay` fills `adapterId`, `loginFields`, `loginUrl` | Overlay presentation-only (D-103-13); execution reads registry |
| `GENERIC_REAL_SITE_ALLOWED_HOSTS` | URL safety policy (D-103-10) |
| `pocAutofill.openShufersalLoginFromTile` etc. | Dev-only; must call same `executeServiceFromTile` or `executeGenericAutofill` without bypassing orchestrator |

## Data / State Considerations
- **Vault / profiles:** Unchanged. Credentials keyed by `profile_id`; Dashboard resolves profile before execution.
- **Registry:** Execution consumes mapped `Service` / `ServiceDefinition` fields only. No new registry columns in Phase 103.
- **Custom services:** When discovery persisted `loginUrl` + `loginFields` on user registry row, D-103-5 applies identically to built-ins (AC-103-8).
- **Banks with `loginFields` but no `loginUrl`:** Open `primaryUrl`; generic autofill may be attempted on homepage if fields+credentials present — failure is non-blocking (AC-103-9).
- **Session catalog cache:** After execution refactor, hard refresh or catalog retry clears loader cache; no execution-specific cache.

## Security / Privacy Considerations
- Generic autofill on arbitrary `https` URLs is allowed only after explicit user tile click (D-103-10).
- Extension `externally_connectable` remains localhost dev origins; production Hub deployment must match extension policy when introduced.
- Credentials travel Hub → extension via existing message bridge only; never written to registry or logs.
- URL policy must reject `javascript:`, `file:`, and non-http(s) schemes.
- Removing host allowlist increases reach of generic engine — mitigated by user-initiated execution and https default.

## Testing and Lint Expectations
- `npm run build` passes.
- `npx tsc -b` passes.
- Add or update `scripts/verifyPhase103Execution.mjs` (static + documented manual matrix).
- Update `scripts/verifyPhase102TileRegression.mjs` or supersede — ensure no regression to Shufersal/Clalit.
- Extension manual reload required after `background.js` changes.
- Unit tests for `autofillEligibility` encouraged; if NOT AVAILABLE, document in `dev-phase103.md`.

## Functional Testability

- **Page/screen:** Digital Home (`Dashboard`) at dev URL (e.g. `http://localhost:5173/`)
- **User-visible behavior:**
  - Shufersal: opens login URL, credentials fill, tab stays open
  - Clalit: opens login URL, 3-field fill, tab stays open
  - HTZone: adapter path, autofill works
  - Practice (dev): adapter path on demo page
  - Leumi (or similar bank): opens URL only, no autofill, tab stays open
  - Custom service with discovered `loginUrl` + `loginFields`: same pipeline as catalog when credentials saved
  - Incomplete credentials: site opens + Hebrew prompt to configure credentials
- **Command-line flow:** `node scripts/verifyPhase103Execution.mjs`
- **Minimal end-to-end flow:**
  1. Unlock vault; ensure extension installed (`VITE_POC_EXTENSION_ID`)
  2. Select Shufersal, Clalit, Leumi, one custom service on dashboard
  3. Save complete credentials for Shufersal/Clalit/custom (matching `loginFields` ids)
  4. Click each tile; observe open + fill behavior per matrix above
  5. Confirm no temporary discovery tab opens/closes on tile click
- **Expected observable result:** AC-103-1 … AC-103-10 satisfied; Shufersal/Clalit regression from Phase 102 stabilization preserved.

## Handoff Notes for Manager

1. **Scope single orchestrator refactor** in `serviceExecution.ts` — largest milestone; adapters and extension policy are parallel milestones.
2. **Milestone order suggested:** (M1) eligibility + orchestrator logic in Hub → (M2) remove `generic` adapter + narrow overlay → (M3) extension allowlist removal + URL policy → (M4) verification script + manual regression matrix → (M5) docs `docs/MIGRATION_PHASE_103.md`.
3. **Acceptance mapping:** Publish AC-103-1…10 verbatim; add functional matrix from Functional Testability section.
4. **Regression gate:** Phase 102 Shufersal/Clalit UAT must pass before Manager approval.
5. **Do not** add tile-click discovery, admin UI, or new adapters.
6. **Optional SQL:** document `adapter_id` cleanup migration; not required for local dev if orchestrator is metadata-driven.
7. **Developer evidence:** `dev-phase103.md` with build output, script PASS, manual test checklist signed, extension version noted.
8. **DISCOVERY_EXECUTION.md:** Update Phase 103 row — unified pipeline replaces Phase 102 stabilization table.

## Architect Review
ARCHITECT_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
_Pending implementation and Manager/Developer cycle._

### Required Corrections
_None at architecture authoring._
