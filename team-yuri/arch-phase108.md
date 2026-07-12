# Architecture Phase 108

## Phase Identifier
PHASE=108

## Status
STATUS: REJECTED_PENDING_M11

## Amendment
AMENDED: 2026-07-12 — **Consumer false-positive gate** (Zap business `/login`, modal-on-primary, Mizrahi-class). Adds D-108-14 … D-108-17 and AC-108-18 … AC-108-20.

AMENDED: 2026-07-12 (evening) — **True-positive preservation / anti-over-rejection** after M9 broke previously successful discoveries. Revises D-108-14…16, adds **D-108-18**, **AC-108-21**, milestone **M10**. Reject only with **positive evidence** of wrong audience or modal-only surface; do not blank-reject ordinary consumer `/login` pages.

AMENDED: 2026-07-12 (night) — **M10 live failure / process correction.** Developer claimed M10 COMPLETE on static fixtures while operator live add/rediscover still leaves `login_url=NULL` for previously successful sites (admin + custom). Adds **D-108-19**, **D-108-20**, milestone **M11**. Static fixtures are necessary but **not sufficient**. Live U22 is a hard gate. Architect rejects M10 “COMPLETE” until live evidence passes.

## Phase Goal
Deliver **Browser Integration and Login Discovery**: Chrome and Edge extension support via a **browser integration abstraction**, production packaging strategy, graceful Hub degradation without extension — and a **unified login-entry discovery pipeline** that enriches `service_registry` with a **confident consumer** `loginUrl` (or safely leaves it `NULL` with Phase 112 deferral metadata) on custom-service add and admin refresh — **without** autofill, credentials, form submit, or execution-path changes (AC-108-10, discovery boundary).

Phase 108 owns **browser host integration**, **DiscoveryExecutor** behavior, **loginUrl metadata persistence rules**, **evidence-based false-positive rejection**, **true-positive preservation**, **discovery deferral signals**, and **bulk refresh orchestration**. It does not own admin console chrome (107 UI), standard autofill coverage (110), **authoritative** complex login classification / modal interaction (112), full URL canonicalization (113), or credential lifecycle (109).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=108`
- `team-Yuri/PLAN.md` §13 — Browser Compatibility; §18 — Phase 108 (AC-108-1 … AC-108-21)
- `team-Yuri/arch-phase102.md` — `service_registry`, `login_url_status`, `persist_discovered_login_url` RPC
- `team-Yuri/arch-phase103.md` — execution pipeline (**read-only** this phase)
- `team-Yuri/arch-phase107.md` — admin registry UI consumes Phase 108 discovery APIs
- `src/execution/extensionBridge.ts` — current Chrome-coupled messaging (to abstract)
- `src/discovery/execution/` — `discoverLogin`, `extensionTabDiscoveryExecutor`
- `src/registry/loginUrlDiscovery.ts` — `discoverAndPersistLoginUrl`
- `src/registry/loginDiscoveryMetadata.ts` — Phase 108 metadata patch helper
- `src/catalog/customServiceDiscovery.ts` — `discoverLoginForRegistryService` shared pipeline
- `extension/` — MV3 extension (background, discovery, autofill modules)
- `scripts/verifyPhase108CustomDiscovery.mjs` — partial static gate (extend in M8)

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-108-1: Browser Integration Abstraction (required)** | AC-108-3, PLAN §13 | Introduce stable Hub contract between execution/discovery and browser hosts: **extension availability probe**, **sendMessage envelope**, **openUrl/tab helpers**. Chrome and Edge implement same interface; Hub modules (`extensionBridge`, discovery executor) call abstraction — **not** raw `chrome.*` scattered in feature code. Edge uses Chromium `chrome` namespace today; abstraction documents host adapter pattern for future Firefox eval. |
| **D-108-2: Chrome + Edge production targets** | AC-108-1, AC-108-2 | Verify extension on **current Chrome stable** and **Edge stable** (Chromium). Document store packaging differences in `docs/MIGRATION_PHASE_108.md` (AC-108-4): manifest, icons, store listing, `externally_connectable` origins for production Hub URL. Shared extension **core**; separate store artifacts/branding if required. |
| **D-108-3: Graceful Hub degradation** | AC-108-5 | When extension unavailable: Digital Home **open-URL-only** (`window.open`) with friendly Hebrew guidance (existing pattern); custom-service **creation succeeds** with `primary_url` + `login_url_status` reflecting missing discovery (AC-108-8, AC-108-9). No broken technical errors; no blocked add flow. |
| **D-108-4: Single discovery pipeline** | AC-108-6 … AC-108-10 | **One** production discovery entry: `discoverLoginForRegistryService` → `discoverAndPersistLoginUrl` → `discoverLogin` → active `DiscoveryExecutor`. User custom add (**App.tsx**), admin create/rediscovery (**adminRegistryApi**), and bulk refresh **must** use this path — no parallel harness (`runLoginDiscoverySession`) in production flows. **Ordering:** upsert `service_registry` row **before** discovery (create-then-discover). |
| **D-108-5: Discovery boundary (strict)** | AC-108-10, AC-108-18…21, PLAN non-goals | Discovery identifies a **consumer** login entry from `primaryUrl` when evidence supports it. **Forbidden:** credential use, autofill, form submit, CAPTCHA/OTP, adapter execution, multi-step login intelligence, persisting alternate-audience portals, inventing navigable URLs when the **only** consumer path is modal-on-primary. Responsibility ends at `loginUrl` persistence **or** evidence-based `NULL` + Phase 112 deferral metadata. **Must not** over-reject ordinary consumer login pages (AC-108-21). |
| **D-108-6: DiscoveryExecutor tab isolation** | AC-108-16 | Production executor: **extension-owned background tab** for DOM inspection (`HUB_LOGIN_ENTRY_DISCOVERY`). Tab **must close** on success, failure, timeout, or cancel. Discovery tabs are **never** reused for Digital Home execution opens. Execution tabs use `executeServiceFromTile` / `openUrlInNewTab` — separate lifecycle. Document timeout budget in Manager plan. |
| **D-108-7: Registry metadata contract** | AC-108-7, AC-108-8 | Persist on `service_registry`: `primary_url` (always on create); `login_url` when confident; `login_url_status` (normative set below); `login_fields` when discovered; `metadata` patch via `buildDiscoveryMetadataPatch`: `loginUrlSource`, `loginUrlConfidence`, `loginUrlLastDiscoveredAt`, `loginUrlLastCheckedAt`, `loginUrlDiscoveryError`, `discoveryMethod`, `lastDiscoveryOutcome`. Map legacy Phase 102 `unknown`/`valid`/`invalid` to expanded statuses where needed (migration). |
| **D-108-8: login_url_status (normative)** | AC-108-8 | Allowed values: `valid`, `missing`, `stale`, `failed`, `needs_review`, plus transitional `unknown`/`invalid` from Phase 102 until migrated. **missing** — no loginUrl after discovery attempt; **failed** — discovery error; **stale** — admin-marked or heuristic; **needs_review** — low confidence candidate. Service creation **never blocked** solely by status. |
| **D-108-9: loginUrlSource + admin override** | AC-108-15, AC-108-11 | `metadata.loginUrlSource`: `auto` \| `admin` \| `user` \| `unknown`. **Admin manual edit** sets `loginUrlSource=admin` and `login_url_status=valid`. Automated rediscovery/bulk refresh **must not overwrite** `admin` URLs unless operator passes **explicit force/approve** flag (admin UI checkbox or dedicated action). |
| **D-108-10: Admin discovery operations (API layer)** | AC-108-11 … AC-108-14 | Phase 108 delivers **engine + API** (in `adminRegistryApi` / registry layer): single-service rediscovery, **bulk refresh** with rate limit + partial failure report. Phase 107 admin **UI** wires buttons to these APIs — 108 owns semantics, idempotency, and metadata rules. Bulk refresh: queue global + eligible user rows; skip `loginUrlSource=admin` unless forced; concurrency cap; per-row error collection; non-blocking UI. |
| **D-108-11: Custom service create flow** | AC-108-6 … AC-108-9 | On user add: normalize URL (Phase 113 rules **where already available** — no new canonicalization engine); upsert registry row; attempt discovery with `source:user`, `force:true`; persist metadata; link `user_services` + vault selection per Phase 104 persist-first rules. Failure → friendly message; service remains created with `primary_url`. |
| **D-108-12: No execution regression** | Phase 103 | **Do not** modify `executeServiceFromTile` orchestration, autofill engine, or tile open behavior except routing messaging through abstraction layer with identical outcomes. Re-run `verifyPhase103Execution.mjs` as regression gate. |
| **D-108-13: Extension discovery message contract** | AC-108-1, AC-108-2 | Normative message: `HUB_LOGIN_ENTRY_DISCOVERY` with `{ primaryUrl }` → `{ ok, discovery \| reason }`. Background opens tab, injects/runs `discoverLoginEntry` engine, closes tab. Hub extension version aligned with manifest (bump documented in migration guide). |
| **D-108-14: Dual-objective gate (revised)** | AC-108-18…21 | **Two objectives, equal weight:** (1) never persist a **wrong** login page; (2) **preserve true positives** — ordinary consumer login pages that discovery found before M9 must still persist. **Reject only with positive evidence** of alternate audience (portal wording/URL/title) **or** modal-only consumer login with **no** separate consumer navigable candidate. Keyword/`/login` path alone is never enough to **accept a portal**, and also never enough by itself to **reject a same-origin consumer candidate** that has a dedicated login form / strong link evidence. Weak uncertainty (e.g. homepage also has a login button) must **not** blank all navigable results. |
| **D-108-15: Reject alternate-audience portals** | AC-108-18 | Candidates with **positive** business/merchant/partner/admin/vendor signals must be rejected (Zap `sa.zap.co.il/.../login` — “כניסה לממשק העסק”). Persist: `login_url=NULL`, `rejectedLoginUrl`, `phase112Deferred`, `loginIntelligenceHint=alternate_audience_portal`. Clear auto false-positives on rediscovery (never clear `loginUrlSource=admin`). **Do not** treat “portal sibling link somewhere on the page” as a veto of a stronger same-origin **consumer** candidate. |
| **D-108-16: Modal-on-primary is selective (revised)** | AC-108-19, AC-108-21 | Apply modal-only → `NULL` **only when** consumer login is modal/overlay on `primaryUrl` **and** there is **no** separate validated consumer navigable login URL. A modal **trigger** on the homepage must **not** veto an otherwise valid navigable consumer `/login` (or equivalent) candidate. When modal-only: `loginEntryType=modal`, `usesModal=true`, `phase112Deferred=true`, `loginIntelligenceHint=modal_on_primary`. |
| **D-108-17: Complex navigable surfaces (Mizrahi-class)** | AC-108-20, Phase 112 boundary | If a **consumer** navigable login page exists but login still needs an extra floating step: Phase 108 **may store** that navigable consumer URL when audience is consumer; set `loginIntelligenceHint=complex_login_surface` / `phase112Deferred=true`. Do **not** NULL it merely because a modal step exists on the correct consumer page. Phase 108 does not open/fill the modal. |
| **D-108-18: True-positive regression gate** | AC-108-21 | M9/M10/M11 changes must not wipe previously successful consumer discoveries. Required regression set: at least **Shufersal**, **Clalit**, **HTZone**. After **live** rediscovery/add, `login_url` must remain non-NULL and consumer-valid unless the live site genuinely changed. Static fixtures must include **accept** cases, not only reject cases — and must not be used alone to claim COMPLETE. |
| **D-108-19: Live path is the authority** | AC-108-21 | Production discovery for custom add and admin rediscovery runs through the **extension** (`HUB_LOGIN_ENTRY_DISCOVERY` → bundled `login-entry-discovery.js`). Hub/JSDOM fixture passes are **not** proof of live behavior. After every discovery-engine change: (1) `npm run build` / `build:extension-discovery`, (2) **reload the side-loaded extension**, (3) re-run Hub, (4) execute live U22. Claiming M10/M11 done without live U22 Pass is a process failure. |
| **D-108-20: Operator-visible discovery outcome** | AC-108-8, AC-108-21 | After every custom add / admin rediscovery, the operator must be able to see **why** `login_url` is NULL or set — at minimum in admin Integration Status / discovery metadata: `loginUrlDiscoveryOutcome`, `loginUrlDiscoveryError` / reason, `discoveryMethod`, `loginUrlConfidence`, `rejectedLoginUrl`, `phase112Deferred`, `loginIntelligenceHint`. Developer debugging must capture the raw extension discovery payload for failed live U22 rows before further gate tuning. Blind “fixed again” without this evidence is not acceptable. |

### Normative discovery persist flow

```text
primaryUrl (+ existing registry row)
→ discoverLogin(primaryUrl)           // DiscoveryExecutor
→ evidence-based audience + surface gates (D-108-14…18)
→ shouldPersistDiscoveredLoginUrl()   // reject only on positive bad evidence or weak common-path
→ on success: login_url + login_fields + login_url_status=valid + metadata patch
→ on reject/defer (evidence-based): login_url = NULL (clear auto false-positive only) + needs_review|missing
     + metadata: rejectedLoginUrl?, loginEntryType?, usesModal?, phase112Deferred, loginIntelligenceHint, reason
→ never blocks registry row / user_services creation
→ never clear a good auto login_url solely because a weak modal heuristic fired
```

### Normative consumer validation (Phase 108) — revised

```text
For each candidate (ranked):
  → Positive alternate-audience evidence on THIS candidate?  YES → reject candidate (keep evaluating others)
  → Strong consumer navigable evidence (dedicated form page / strong consumer link)?
       YES → ACCEPT (persist) — even if homepage also has a login button/modal trigger
       → if extra modal step on that page → keep URL + complex_login_surface hint
  → Modal-only on primary AND no remaining consumer navigable candidate?
       YES → NULL + modal_on_primary deferral
  → Otherwise keep pre-M9 persist heuristics (confidence/method) — do not invent new blanket NULLs
```

### Normative bulk refresh flow

```text
Admin triggers bulk refresh (optional forceAdminOverwrite flag)
→ Load eligible services (skip loginUrlSource=admin unless force)
→ Rate-limited queue (e.g. N concurrent, delay between batches)
→ Per row: discoverAndPersistLoginUrl({ force, source: auto })
→ Aggregate report: succeeded / failed / skipped (admin override)
→ UI shows partial failures; registry cache invalidated
```

### Phase boundary map

| Phase | Owns |
|-------|------|
| **108** | Browser abstraction, discovery executor, consumer `loginUrl` (or NULL), false-positive rejection, Phase 112 deferral metadata, bulk refresh |
| **107** | Admin UI surfaces that **call** 108 APIs |
| **110** | Generic autofill using validated navigable `loginUrl` |
| **112** | Modal / complex login classification and interaction (consumes 108 deferral signals) |
| **113** | URL canonicalization / identity |

## Constraints / Non-Negotiables
- Discovery never uses credentials, autofills, or submits forms (AC-108-10).
- Service creation succeeds even when discovery fails (AC-108-9).
- Admin manual `loginUrl` not silently overwritten (AC-108-15).
- Discovery tabs isolated from execution tabs (AC-108-16).
- **Never persist non-consumer portal login URLs** (AC-108-18) — Zap-class business `/login` is a hard reject **for that candidate**.
- **Never invent navigable `loginUrl` when the only consumer path is modal-on-primary** (AC-108-19).
- **Reject with positive evidence only** — do not blank-reject ordinary consumer login pages (AC-108-20 revised, AC-108-21).
- **True-positive regression required** after any false-positive gate change (AC-108-21 / D-108-18).
- No `service_role` in client.
- Build passes (AC-108-17).
- Hebrew friendly user/admin messages on discovery failure.

## Technical Boundaries / Out of Scope
- Standard autofill expansion (Phase 110).
- Opening/filling modal overlays, OTP/CAPTCHA/iframe login intelligence, and authoritative `loginComplexity` (Phase 112) — Phase 108 only **defers** via metadata.
- Full URL canonicalization engine (Phase 113) — use existing helpers only.
- Credential lifecycle UX (Phase 109).
- Firefox/Safari store shipping (evaluation only per PLAN §13).
- Service-specific execution adapters changes.
- Admin category CRUD / approval queue UI (Phase 107).
- Hard-coded per-site allowlists as the primary solution (heuristics + audience gates are required; curated exceptions only via admin `loginUrlSource=admin`).

## Dependencies and Interfaces

### Upstream (must be complete)

| Phase | Provides |
|-------|----------|
| 102 | `service_registry`, discovery RPC, catalog load |
| 104 | Custom service add entry, persist-first selection |
| 107 | Admin UI hooks for manual edit + refresh triggers (may be in progress) |

### Hub modules (Developer — target ownership)

| Module | Responsibility |
|--------|----------------|
| New `src/browserIntegration/` (or extend `src/extension/`) | Abstraction interface + Chrome/Edge host adapters |
| `src/execution/extensionBridge.ts` | Refactor to use abstraction; execution messaging unchanged semantically |
| `src/discovery/execution/` | `DiscoveryExecutor` registry; `extensionTabDiscoveryExecutor` tab lifecycle |
| `src/registry/loginUrlDiscovery.ts` | Persist rules, admin/global RPC paths, bulk refresh queue |
| `src/registry/loginDiscoveryMetadata.ts` | Metadata patch contract (extend if needed) |
| `src/catalog/customServiceDiscovery.ts` | Shared `discoverLoginForRegistryService` |
| `src/admin/adminRegistryApi.ts` | Wire rediscovery + bulk refresh to 108 engine (API) |
| `extension/background.js` | `HUB_LOGIN_ENTRY_DISCOVERY` handler; reliable tab close |
| `extension/discovery/login-entry-discovery.js` | DOM discovery engine (no fill/submit) |
| `supabase/migrations/*_phase108_*` | Optional `login_url_status` check expansion; metadata indexes |
| `scripts/verifyPhase108BrowserIntegration.mjs` | **New** — abstraction, no direct chrome in Hub feature code |
| `scripts/verifyPhase108CustomDiscovery.mjs` | Extend for bulk refresh + admin override guards |
| `docs/MIGRATION_PHASE_108.md` | Chrome + Edge packaging, operator test matrix |

### Extension ↔ Hub message surface (normative)

| Message | Direction | Purpose |
|---------|-----------|---------|
| `HUB_LOGIN_ENTRY_DISCOVERY` | Hub → Extension | Run login entry discovery for `primaryUrl` |
| `HUB_GENERIC_AUTOFILL` / adapter messages | Hub → Extension | **Execution only** (Phase 103) — not discovery |

## Data / State Considerations
- `login_url_status` migration must not break Phase 102 rows; map `invalid` → `stale` or `failed` per operational choice (document in migration).
- Bulk refresh progress: UI-only job state acceptable (no server job table required in 108).
- Rate limits: client-side queue defaults (Manager specifies constants); avoid hammering sites.
- `clearRegistryCatalogCache()` after bulk admin refresh completes.
- Dev: `VITE_POC_EXTENSION_ID` remains extension id source until Phase 108 packaging doc defines production id strategy.
- **Phase 108 discovery deferral metadata** (write-allowed; Phase 112 later classifies authoritatively):
  - `rejectedLoginUrl` — false-positive candidate that was not persisted
  - `loginEntryType` — `navigable` \| `modal` \| `unknown`
  - `usesModal` — boolean observation
  - `phase112Deferred` — `true` when Phase 112 must handle the surface
  - `loginIntelligenceHint` — `alternate_audience_portal` \| `modal_on_primary` \| `complex_login_surface` \| `needs_review`
  - existing: `loginUrlDiscoveryError`, `loginUrlDiscoveryOutcome`, `lastDiscoveryOutcome`
- Rediscovery / review persist must **clear** auto `login_url` only when D-108-15/16 reject with **positive evidence**; never clear admin overrides; never clear a good consumer URL because a weak modal heuristic fired (D-108-18).

## Security / Privacy Considerations
- Discovery fetches third-party pages in extension context — no user credentials transmitted.
- Discovery logs must not include page HTML dumps in production user-visible errors.
- Extension `host_permissions` for production must be reviewed for store policy (broad `https://*/*` may need justification or activeTab pattern in future hardening — document, do not block 108 on full permission refactor unless store requires).

## Testing and Lint Expectations
- `npm run build` passes (AC-108-17).
- `node scripts/verifyPhase108BrowserIntegration.mjs` — PASS.
- `node scripts/verifyPhase108CustomDiscovery.mjs` — PASS.
- `node scripts/verifyPhase103Execution.mjs` — PASS (regression).
- `node scripts/verifyPhase108FalsePositiveGate.mjs` — PASS for **reject** fixtures (Zap / modal-only) **and** **accept** fixtures (ordinary consumer `/login` / Phase 103 catalog pages) — AC-108-21.
- Manual matrix: Chrome + Edge; Zap → NULL; **Shufersal / Clalit / HTZone rediscover → login_url non-NULL**; Mizrahi-class → consumer URL kept if navigable consumer entry exists.

## Functional Testability

- **Custom add:** Add custom URL → registry row created → discovery attempted → consumer `loginUrl` when evidence supports it, else `NULL` + metadata
- **Zap (false-positive):** `login_url` NULL — **not** `sa.zap.co.il/.../login`
- **True-positive regression (M10):** Rediscover Shufersal, Clalit, HTZone → `login_url` remains set (AC-108-21)
- **No extension:** Add still succeeds; open-URL-only on tile; friendly banner
- **Admin / Isolation / scripts:** unchanged from prior contract

## Handoff Notes for Manager

1. Publish AC-108-1 … AC-108-21; sync `manager-phase108.md` with **M11**.
2. **REJECT Developer claim that M10 is COMPLETE** while live operator still sees `login_url=NULL` on previously successful sites. Static ACCEPT fixtures ≠ live U22.
3. M11 — Live discovery restoration (required):
   - Capture per-site live evidence for Shufersal, Clalit, HTZone, Zap: raw discovery result (success, loginUrl, method, confidence, reason) + persisted metadata.
   - Fix the **live extension path** (not only Hub/JSDOM fixtures). Confirm extension rebuild + reload checklist every attempt.
   - Investigate likely live-only failure modes before more heuristic churn:
     a. Stale extension bundle not reloaded after `build:extension-discovery`
     b. Live result `method=common-path` / `confidence=low` → persist gate always refuses (fixtures often use dedicated-login-page)
     c. Live result `success=false` (modal / audience) while a consumer navigable URL exists on the real page
     d. Persist/clear path wiping URL even when discovery returned a candidate (`clearLoginUrl` on review)
     e. Extension unavailable / timeout → NULL with `extension_unavailable` / `discovery_timeout`
   - Operator-visible outcome after add/rediscover (D-108-20).
   - Live U22 Pass required; Zap U19 still NULL.
4. Do **not** approve Phase 108 complete until M11 live dual gate passes.
5. Phase 103 execution regression remains mandatory.

## Architect Review
ARCHITECT_REVIEW_STATUS: REJECTED

### Review Notes
_Operator reports live add/rediscover still leaves `login_url=NULL` for sites that worked before M9. `dev-phase108.md` marks M10 COMPLETE with static fixtures PASS and **U22 PENDING_OPERATOR** — that is insufficient and contradicts AC-108-21. Fixtures exercise Hub `discoverLoginEntry` via JSDOM; production uses the extension bundle. Until live Shufersal/Clalit/HTZone persist non-NULL `login_url` and Zap stays NULL, Phase 108 discovery gate remains open (M11)._

### Required Corrections
1. Manager: mark M10 incomplete for phase approval; open **M11** with live evidence hard gate.
2. Developer: stop claiming fixed without live U22 + raw discovery payload per site.
3. Fix live extension path; keep Zap reject green.
4. Surface discovery reason/method in admin/UI metadata after every attempt.
