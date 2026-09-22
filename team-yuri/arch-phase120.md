# Architecture Phase 120

## Phase Identifier
PHASE=120

## Status
STATUS: **PHASE 120 — FORMALLY CLOSED / ARCHITECTURE ACCEPTED** (2026-09-22)

CREATED: 2026-09-20 — Phase 120 architecture after Phase 119 FORMAL CLOSE.  
CLOSED: 2026-09-22 — Final Acceptance Matrix complete; 120.9 Owner live L1–L4 **PASS**.

SLICE AUTHORIZATION: **120.4–120.9 CLOSED**. **§25 ACCEPTED**. **120.9 LIVE OWNER ACCEPTANCE PASS**. Phase 120 Final Closure **CLOSED**. Do **not** reopen 120.6 / 120.8 identity / Managed exact-one. Do **not** start Phase 121 from this record alone. Production Readiness / deferred debt remain **explicitly open** (not Phase 120 blockers).

## Title
Phase 120 — Unified Managed Autofill Runtime

## Phase Goal

Converge supported Autofill behavior toward **one deterministic, configuration-driven Managed Autofill runtime**.

**Target architecture (normative intent):**

```text
Admin authors configuration
  → Admin validates configuration
  → configuration becomes the authoritative service definition
  → one Managed Autofill runtime executes the validated definition
  → runtime returns structured result
  → no service-specific runtime behavior required for normal supported services
```

**Mandatory sequencing:** Phase 120 **MUST NOT** begin with deletion or migration.  
**First:** establish the exact current runtime inventory from **repository evidence** (Slice 120.1) — **DONE**.

Predecessor: Phase 119 CLOSED (`arch-phase119.md`). Phase 119 deferred “Autofill Runtime Convergence” is **superseded** by this phase’s inventory-first approach.

---

## 1. Purpose and scope

### In scope (Phase 120 overall)
- Evidence-backed inventory of all reachable Autofill / identity-fill mechanisms (**120.1 COMPLETE**)
- Architecture classification of each mechanism
- Owner-gated convergence sequence (approved **individually** after inventory)
- Preservation of Phase 117 Managed security/determinism rules as the TARGET runtime

### Out of scope until Owner authorizes a migration slice
- Runtime / adapter / flag / fallback deletion or removal
- Service migration onto Managed (except when Owner authorizes a numbered slice)
- Managed runtime modification
- Service-specific new code
- iframe / Shadow DOM / modal / multi-step capabilities
- Autofill Health Monitoring implementation
- Treating Clalit / Shufersal / HTZone as architectural requirements (investigation targets only)

### Reserved for future architecture (NOT 120.1 / not first 120.2)
**Managed Autofill Health Monitoring / Mapping Drift Detection** — recorded; not authorized.

---

## 2. Architectural decisions (Phase 120)

| Decision | Rationale | Consequence |
|---|---|---|
| **D-120-1: Inventory before mutation** | Unknown parallel paths remain; deletion without evidence is unsafe | 120.1 is read-only investigation |
| **D-120-2: Managed is TARGET runtime** | Phase 117 deterministic config-driven fill is the intended production model | Classify paths relative to Managed |
| **D-120-3: No big-bang delete/migrate** | Avoid outage and silent capability loss | Owner approves each migration individually |
| **D-120-4: Repository evidence is authoritative** | Historical discussion ≠ current reachability | Do not assume mechanisms still exist |
| **D-120-5: Investigation targets ≠ requirements** | Clalit/Shufersal/HTZone inform legacy understanding | No hostname-driven architecture |
| **D-120-6: Health monitoring reserved** | Valuable but separate from convergence inventory | Recorded; not 120.1 |
| **D-120-7: Preserve Phase 117/118/119 contracts** | Do not weaken Managed, Assisted Mapping, Visual Mapping, readiness | 120.1 makes no production changes |
| **D-120-8: Single shared Global Registry DB (topology)** | Localhost Admin Hub and deployed Production Hub both use Supabase project `wbehjoraatkrpsbgyunx` | Global Managed config is **not** environment-isolated; S3–S7 writes are Production-visible. Separate config promotion is **not** applicable until Owner creates separate config environments |
| **D-120-9: Named services are validation fixtures only** | Phase target is a **generic**, configuration-driven Managed Autofill runtime for arbitrary supported services | **No** production runtime behavior, deployment mechanism, environment mechanism, or configuration lifecycle may be designed around a named service (including Shufersal, Rivhit, Meuhedet, etc.). Named services are **validation fixtures only** |
| **D-120-10: Representative config-only convergence** | Phase 120.3 proves simple logins can be represented entirely by configuration; it does **not** require migrating every simple catalog service | Existing simple services may be used as **representative migration fixtures only**. Architectural objective = eliminate dependency on legacy execution mechanisms via **sufficient representative evidence**, not exhaustive one-by-one catalog migration |
| **D-120-11: Model generic login capabilities, never individual sites** | Target architecture is capability → configuration → validated Managed runtime | Popup/modal, multi-step, iframe, Shadow DOM, pre-fill activation, etc. are **generic** capabilities (or explicit **unsupported**). **Never** hostname/serviceId/named-site adapters or site selectors in production runtime as the product model. Named services are fixtures only. If a capability is missing → **UNSUPPORTED** until a **generic** design is separately approved — not a new site-specific path |
| **D-120-12: One Managed Autofill execution path** | Admin Test and Digital Home must not become two Autofill engines | Different **credential value sources** may feed one shared Managed fill pipeline (`HUB_MANAGED_AUTOFILL` / assess / fill / verify). **No** test-only weaker safety, selectors, or fill algorithm |
| **D-120-13: Admin candidate test ≠ Digital Home production eligibility** | Owner needs to test **saved** mappings before validate | Admin-only harness may execute **saved candidate** mappings explicitly for diagnostics. Digital Home **must** continue requiring the normal Managed production eligibility/validation contract. Test runs must **not** stamp validated / change supportState / activate |

**Prior draft input (checklist only):** `team-Yuri/inventory-autofill-runtime-convergence.md`.

---

## 3. Slice 120.1 — Autofill Runtime Inventory

### Status
**COMPLETE — Architecture Review PASS** (2026-09-20). Full report: `team-Yuri/manager-phase120.md`.

### Charter (historical — fulfilled)
Read-only repository investigation; classify each path; return inventory + A–E before any migration slice. AC-120.1-1…7 — **PASS**.

---

## 4. Architect Review — Slice 120.1 Inventory (PASS)

ARCHITECT_REVIEW_STATUS: **120.1 PASS** (inventory accepted)

### Verdict
Manager report satisfies AC-120.1-1…7. Key claims re-checked against current `executeServiceFromTile`, adapter registry, catalog, and medium allowlist.

### Verified inventory (Architect-accepted)

| Mechanism | Production reachable | Classification | Architect note |
|---|---|---|---|
| Managed Autofill (`HUB_MANAGED_AUTOFILL`) | Yes when validated+eligible | **TARGET** | Fail-closed open+message; **no** silent generic fallback — confirmed |
| HTZone adapter (`POC_FILL_IL`) | Yes when `adapterId=htzone` | **MIGRATION CANDIDATE** (prep may become **TEMPORARY EXCEPTION**) | Sole production site adapter besides practice |
| Practice adapter (`POC_FILL_DEMO`) | Demo/localhost | **DEVELOPMENT / POC** | Confirmed |
| Legacy generic (`POC_GENERIC_FILL`) | Yes for basic/unknown without Managed/adapter | **MIGRATION CANDIDATE** | Clalit/Shufersal path when no Managed |
| Identity-first medium (`POC_IDENTITY_FIRST_FILL`) | Yes when LI=medium + allowlist + flag | **MIGRATION CANDIDATE** | amazon-il / ksp / localhost fixture |
| LI complex / open-only | Yes | **TEMPORARY EXCEPTION** (by design) | No fill |
| POC Hub helpers / `?pocAutofill=1` | DEV | **DEVELOPMENT / POC** | Confirmed |
| `LEGACY_ADAPTER_ID_BY_SERVICE_ID` | Empty `{}` | **DEAD / UNREACHABLE** | Confirmed |

### Target investigations (verified)
| Target | Finding |
|---|---|
| **HTZone** | Dedicated adapter + extension path — **yes** |
| **Clalit** | **No** dedicated adapter — catalog + Managed-if-validated else **legacy generic** |
| **Shufersal** | **No** dedicated adapter — same as Clalit |

### Decision tree (verified)
```text
adapter {htzone, practice}
  → Managed (claim/validated/eligible) — fail → open+msg; NEVER generic
  → LI complex → open
  → LI medium → identity-first
  → generic (basic|unknown + eligibility)
  → open-only
```

Full table + sections A–E: `team-Yuri/manager-phase120.md`.

### Corrections required of Manager
**None** for 120.1 acceptance. Non-blocking: keep “open-only” as both intentional LI-complex and fail-closed Managed/generic outcomes (do not merge).

### Explicitly not authorized by this review
Deletion · flag/fallback removal · HTZone retirement · generic retirement · Managed runtime changes · Health Monitoring · iframe/shadow/modal/multi-step

---

## 5. Slice 120.2 — Simple Catalog Managed Migration Pilot (AUTHORIZED)

### Status
**AUTHORIZED** (Owner 2026-09-20) — **Shufersal ONLY**.

### Objective
Prove the **generic** migration procedure: move one existing simple catalog service from **legacy generic Autofill** to **validated Managed Autofill**.  
This is a **migration pilot**, not legacy retirement.

### Pilot service (validation fixture only — D-120-9)
| Field | Value |
|---|---|
| Role | **Validation fixture** for the generic Managed migration procedure — **not** a service-specific architectural target |
| Service id | `shufersal` |
| Catalog display | שופרסל |
| Built-in Login Entry (catalog seed — verify live) | `https://www.shufersal.co.il/online/he/login` |
| Built-in schema seed (historical — **not** normative) | seed still has `email`,`password` — **OUT OF SLICE** hygiene debt |
| **Normative live schema (S1 PASS)** | **`username`, `password`** |
| `adapterId` | live `""` ≡ **none** (must not create adapter; no cosmetic rewrite) |

**Binding (D-120-9):** No production runtime behavior, deployment mechanism, environment mechanism, or configuration lifecycle may be designed around the name `shufersal` or any other named service. Pilot success must transfer to other services via **configuration only**.

### Target flow (normative)
```text
Shufersal catalog service
  → explicit Login Entry
  → credential schema with stable field IDs
  → explicit Managed field mappings
  → Admin validation / approval
  → validated Managed configuration
  → Digital Home tile
  → deterministic Managed Autofill (orchestrator precedence)
  → manual submit
```

Once validated Managed is active, Shufersal **must** execute through Managed. Legacy generic **must not** execute as fallback for that validated Managed service (existing orchestrator behavior — confirm with evidence).

### Authoring (existing capabilities only)
Manager DD must be based on **CURRENT** Shufersal catalog/schema and **live** login structure — do not assume historical selectors/schema.  
Use Phase 117/118/119 authoring: Analyze Login Page, Visual Mapping, `readiness_wait_inputs`, explicit Admin approval.  
**No** service-specific runtime implementation.

### Success criteria (AC-120.2-*)

| ID | Criterion |
|---|---|
| AC-120.2-1 | Shufersal remains a normal catalog service |
| AC-120.2-2 | No Shufersal adapter is created |
| AC-120.2-3 | No hostname/serviceId branch added to runtime |
| AC-120.2-4 | Managed configuration is validated (`supportState=validated`) |
| AC-120.2-5 | Digital Home launch selects Managed runtime |
| AC-120.2-6 | Required credential fields fill correctly on live login page |
| AC-120.2-7 | No auto-submit |
| AC-120.2-8 | Managed failure does not silently fall back to legacy generic |
| AC-120.2-9 | Existing non-Shufersal runtime behavior unchanged |
| AC-120.2-10 | Evidence demonstrates which runtime path executed |
| AC-120.2-11 | Topology acknowledged: localhost Admin + deployed Hub share one Global Registry DB |
| AC-120.2-12 | S3–S7 global-row writes treated as **Production-visible** configuration changes (not a private TEST sandbox) |
| AC-120.2-13 | Explicit `supportState` / activation discipline on the shared row (no silent Managed eligibility without deliberate Admin activate) |
| AC-120.2-14 | Minimal Production-path smoke (deployed Hub and/or localhost against shared DB + current extension): Managed path + fill + no auto-submit + no silent generic fallback |

### Hard stops (out of scope)
- Do **not** delete or globally disable legacy generic  
- Do **not** migrate Clalit  
- Do **not** modify: HTZone adapter, identity-first medium, LI complex, open-only, Practice adapter, global orchestrator precedence  
- Do **not** start runtime retirement  
- Do **not** implement Health Monitoring / iframe / shadow / modal / multi-step  
- Do **not** copy user vault credentials between users or invent a second Supabase project in this slice  
- Do **not** design/implement TEST→PROD **configuration promotion** while topology remains single-DB (Owner 2026-09-21)  
- Do **not** claim a private TEST Global Registry exists when it does not  
- Do **not** design production behavior around a named service (D-120-9)  
- Do **not** authorize or implement service-specific production code  
- Do **not** start Fresh Service Creation validation (120.FSC) until Owner authorizes after the migration pilot  

### Process (Owner) — topology-corrected
```text
Admin authoring on shared Global Registry (localhost Admin Hub OK)
  → save/validate evidence (path proof) — RETAIN
  → treat global writes as Production-visible immediately
  → deliberate supportState activation on shared row
  → smoke on Production-visible path (shared DB + appropriate Hub/extension build)
  → Architecture acceptance
  → return to Owner before next migration
```

### Manager DD requirements (updated)
1. Re-read current catalog row / registry shape for `shufersal` (schema + Login Entry) — **live shared baseline**.  
2. Live structure check (Analyze / Visual Mapping / readiness as needed).  
3. Define config-only steps to produce Managed profile on the **shared** global row (no new runtime code).  
4. Define verification evidence for AC-120.2-1…14 (path proof mandatory; topology awareness mandatory).  
5. Explicit regression: non-Shufersal paths untouched; generic still available for other services.  
6. **SUPERSEDE** prior “TEST vs PROD promotion” DD ask: do **not** design Configuration Promotion while §5B shows one shared DB. Document shared-row blast radius + activation/smoke/deployment distinctions instead.

---

## 5A. Architecture correction — Production delivery path (Owner 2026-09-21) — SUPERSEDED IN PART

**Supersession:** The prior assumption that separate TEST vs PRODUCTION **configuration** environments exist is **false** under current topology (§5B). Therefore **Configuration Promotion design is withdrawn** for 120.2 until Owner creates separate config environments.

Retained from 5A intent:
- Production-visible delivery still matters (activation + smoke + Hub/extension parity).
- Credentials must never be copied between users/environments.
- TEST **evidence** (path proof work) remains valid and must be retained — but “TEST” means **Operator workflow / localhost Hub UI**, not a separate Global Registry database.

---

## 5B. Environment topology verification (Owner 2026-09-21) — authoritative

**Method:** Read-only inspection of `.env.local` (URL only), `supabase/config.toml` / linked project, extension `externally_connectable`, and deployed Hub JS at `https://password-vault-sable.vercel.app/`. **No environments or data changed.**

### Findings

| # | Question | Answer |
|---|---|---|
| 1 | Which Supabase project localhost Admin Hub uses | **`wbehjoraatkrpsbgyunx`** (`VITE_SUPABASE_URL=https://wbehjoraatkrpsbgyunx.supabase.co` in `.env.local`; Vite may proxy in DEV but `remoteUrl` is this project) |
| 2 | Which Supabase project deployed Production Hub uses | **Same `wbehjoraatkrpsbgyunx`** — embedded in production bundle `https://password-vault-sable.vercel.app/assets/index-*.js` as `https://wbehjoraatkrpsbgyunx.supabase.co` |
| 3 | Are Global Registry rows (e.g. `shufersal`) physically shared? | **Yes** — one `service_registry` table in one project; global rows = `owner_user_id IS NULL` |
| 4 | Is Managed Autofill config on that row therefore immediately shared? | **Yes** — `metadata.autofillProfile` (and related fields) written via `updateGlobalRegistryRow` are readable by authenticated clients of both localhost Hub and deployed Hub |
| 5 | How is user-owned data/credentials isolated? | **Separate tables + RLS:** `user_services` / `access_profiles` / `encrypted_credentials` scoped by `auth.uid()`; ciphertext only; **not** stored on the global `shufersal` row. User-owned registry submissions use `owner_user_id = user` and are not catalog-global until promoted. |
| 6 | What still requires separate deployment/release? | See table below |

### Deployment / release distinctions (still real)

| Kind | Shared across localhost vs deployed Hub? | Notes |
|---|---|---|
| **Global service configuration** (`service_registry` global rows + Managed metadata) | **Yes — shared now** | S3–S7 Admin saves write Production-visible config |
| Hub source code | **No** — separate build/host | localhost Vite vs Vercel deploy |
| Extension | **No** — separate load/release | unpacked local vs store/packaged; `externally_connectable` includes localhost **and** `password-vault-sable.vercel.app` |
| Edge Functions | **Same Supabase project** | Deployed to the shared project; code release is separate from Hub UI |
| Database migrations | **Same Supabase project** | Schema shared; apply once to the shared DB |
| Configuration “promotion” TEST→PROD | **N/A** | No second config database exists |

### Direct Owner question answer

**Does Shufersal S3–S7 configuration already modify Production-visible global configuration?**  
**YES.** Any Admin persist of Managed profile / schema / Login Entry / `supportState` on global `id=shufersal` updates the same row the Production Hub loads. There is no private TEST Global Registry sandbox in the current topology.

Caveats (do not confuse with “separate config DB”):
- **Hub/extension code version** on Production may lag localhost → runtime path can still differ until those are released.
- **`supportState`**: Managed eligibility still depends on validated/activated profile rules; drafting mappings without `validated` may not select `HUB_MANAGED_AUTOFILL`, but the **stored configuration bytes are already Production-visible**.
- Activate UI remains DEV-gated in source — Production Hub build may lack the Operator activate button even though the shared DB can already hold `supportState=validated` if set from localhost DEV Admin.

### Consequence for Configuration Promotion

**Do not design Configuration Promotion** for 120.2 under current topology. Separate configuration environments **do not exist**. Building TEST→PROD promote would be fiction.

If Owner later wants isolated config sandboxes, that is a **new infrastructure decision** (second Supabase project or equivalent) — out of scope until authorized.

### Revised minimum correction for 120.2
1. Treat localhost Admin work on global rows as **Production-visible config editing**.  
2. Keep path-proof evidence; continue S3–S7 with that blast-radius awareness.  
3. Gate **runtime** Production readiness via: deliberate `supportState`, Hub deploy parity, extension parity, and smoke — **not** via config copy.  
4. Manager: amend DD to remove promotion design; document shared topology + activation/smoke/deploy distinctions.  
5. Promotion implementation: **NOT APPLICABLE / NOT AUTHORIZED**.

---

## 5C. P1/P4 live failure — Managed runtime investigation (2026-09-22)

**Authority:** Repository Managed path (`extension/background.js`, `extension/generic/validated-autofill.js`) + Owner live logs. **No patch. No fixture config change.** Shufersal = D-120-9 fixture only.

### Live evidence (Owner)
```text
[Managed Autofill] Hub: sending explicit mappings
{ type: 'HUB_MANAGED_AUTOFILL', url: '.../online/he/login',
  allowedOrigin: 'https://www.shufersal.co.il',
  fieldIds: ['username','password'], extensionAvailable: true, executionKeyPresent: true }

1) fill failed after tab open — reason: 'No tab with id: 1389656305'
2) subsequent fill failed after tab open — reason: 'targets_not_ready'
Owner-visible: Managed Autofill failed.
```

### A. Why opened tab can disappear / become invalid (`No tab with id`)
| Fact | Evidence |
|---|---|
| Error source | Chrome `chrome.runtime.lastError.message` from `chrome.scripting.executeScript` when `tabId` no longer exists — **not** a `validated-autofill.js` reason code |
| Tab id stability | Navigation / SPA redirect **does not** change `tab.id`. Invalid id ⇒ tab **closed** (or otherwise removed from the browser session), not merely navigated |
| Managed path behavior | `openGenericRealSiteTab` creates a tab and keeps it open after fill; Managed path does **not** call `tabs.remove` on completion (unlike discovery helpers) |
| Retry behavior | `runManagedAutofillOnTab` retries inject/`runManagedAutofill` up to `GENERIC_REAL_SITE_MAX_ATTEMPTS` (60) × `MANAGED_AUTOFILL_RETRY_DELAY_MS` (300ms). If the tab is closed mid-retry, eventual `onDone({ reason: lastError.message })` surfaces as `No tab with id: …` |
| Missing abort | No `tabs.onRemoved` listener on Managed fill — closed tab is not classified as `tab_closed`; it burns retries then returns the Chrome string |

**Likely causes (ordered):** Operator/user closed the tab during first attempt; extension/service-worker restart mid-session; less likely browser discard/crash. **Not** explained by in-tab redirect alone.

### B. Exact condition for `targets_not_ready`
From `assessManagedTargetsReady` (`validated-autofill.js`) — returned when readiness fails **before** any fill:

| Condition | `detail` |
|---|---|
| `querySelectorAll(locator)` length **0** | `zero_match` |
| length **≠ 1** | `multi_match` |
| exactly one node but `GenericFillExecutor.isSafeFillTarget` false | `hidden_target` / `non_editable` / `unsafe_target` (visibility via `GenericFormDetector.isVisible`; hidden/disabled INPUT rejected) |

Also gated earlier by: wrong origin, not top frame, no/invalid mappings (those use **other** reason codes, not `targets_not_ready`).

Owner log did **not** include `detail`/`fieldId` — sub-cause not yet pinned.

### C. Bounded readiness vs Phase 119 Admin `readiness_wait_inputs`
| Path | Mechanism | Bound | Purpose |
|---|---|---|---|
| **Admin inspect (119)** | In-page `collectSafePageStructureWithReadiness` poll | ≤10s / 250ms; early-exit when **any** eligible inputs exist | Structure capture timing |
| **Managed runtime (117)** | Background adaptive retry of inject + `assessManagedTargetsReady` | ≤60 × 300ms ≈ **18s**; `initialDelayMs=0` (D-117-17) | Wait until **all mapped** locators are exactly-one safe targets |

**Comparable purpose (wait for DOM readiness):** yes, partially.  
**Same capability:** **no.**

Gaps vs Admin readiness architecture:
1. Managed does **not** use the in-page `readiness_wait_inputs` observer loop — only inject/retry from the service worker.  
2. Managed arms fill on first `tabs.onUpdated` **complete** + URL match, then **removes** the update listener — **no re-gate** if SPA navigates again after that.  
3. Admin waits for *any* inputs; Managed waits for *specific* CSS locators (stricter, correct for fill) but without post-complete navigation settle.

### D. Navigation / redirect vs tab id
| Event | Tab id | Managed effect |
|---|---|---|
| Same-tab navigation / SPA | **Unchanged** | Can cause `targets_not_ready` (zero_match / unsafe) on transitional or final DOM; does **not** produce `No tab with id` |
| Tab closed / removed | **Invalid** | `No tab with id: …` on `executeScript` |
| New tab opened by site | New id | Fill still targets **original** `tabId` (orphaned session if original closed) |

### E. Do `#j_username` / `#j_password` exist in final top document?
| Signal | Implication |
|---|---|
| P3 mappings authored via Analyze/Visual on Live Login Entry | At authoring time, those locators resolved in **top document** (Managed/Visual also `frameIds: [0]`) |
| Live P4 `targets_not_ready` | At fill attempt(s), readiness failed for at least one mapped locator (sub-detail unknown) |
| **Not proven from this package** | Continuously present, visible, and editable in the **settled** final top document after all redirects |

**Do not change locators yet.** Optional non-mutating diagnostic: Admin inspect / Visual re-check on the same Login Entry after full settle — config untouched.

### F. Generic runtime gap vs service configuration error?
| Classification | Verdict |
|---|---|
| Path selection / config activation | **Not the failure** — P1+P3 prove validated Managed path and mappings were used |
| Silent legacy generic fallback | **Not observed** — Managed failed closed (correct) |
| Fixture-specific config error (wrong CSS) | **Possible but not primary** — same locators were Admin-validated; more likely timing/settle/visibility than permanently wrong selectors |
| **Generic Managed runtime capability gap** | **PRIMARY classification** — (1) tab-closed → opaque Chrome error + wasted retries; (2) post-`complete` SPA/navigation not re-settled; (3) Managed readiness ≠ Admin `readiness_wait_inputs` (no shared settle contract); (4) need structured `detail` on failure |

### Root-cause classification (Architecture)
```text
PRIMARY: GENERIC_MANAGED_RUNTIME_GAP
  - tab lifecycle: closed tab → "No tab with id" (no tab_closed reason)
  - DOM settle / mapped-target readiness after first URL-complete
SECONDARY (unconfirmed): TARGETS_NOT_READY_SUBTYPE unknown (need detail)
NOT AUTHORIZED TO BLAME FIRST: Shufersal locator config
FORBIDDEN RESPONSES: hostname branch, serviceId branch, Shufersal delays,
  fixture config rewrite, legacy generic fallback, production patch
```

### Disposition (binding)
1. **P4 = FAIL** — do not claim PASS.  
2. **Do not** modify Shufersal Managed configuration.  
3. **Do not** add service-specific runtime/selectors/delays.  
4. **No production fix** until Owner accepts this classification and Architecture authorizes a **generic** remediation DD.  
5. Fixture remains D-120-9 validation only.  
6. **§5D** — non-mutating P4 diagnostic instrumentation is **AUTHORIZED** (Owner 2026-09-22). Runtime **fix remains NOT AUTHORIZED**.

---

## 5D. P4 diagnostic instrumentation — AUTHORIZED (2026-09-22)

**Owner:** Architecture accepts §5C classification.  
**Authorization:** **Diagnostic instrumentation / evidence only.**  
**NOT authorized:** Managed readiness/tab-lifecycle **fix**, mapping changes, retry-timing changes on the fill path, hostname/serviceId branches, legacy generic fallback, credential logging.

### Goal
One fresh Managed Autofill attempt must distinguish **configuration failure** from **generic readiness / navigation / tab-lifecycle failure** with direct runtime evidence.

### Required evidence (single Owner live run after Developer ships diagnostic)

**1. On `targets_not_ready` (structured — Hub response and/or extension console):**
| Field | Required |
|---|---|
| `fieldId` | yes |
| `locator` | yes (CSS string only — no values) |
| `detail` | `zero_match` \| `multi_match` \| `hidden_target` \| `non_editable` \| `unsafe_target` |
| `finalObservedUrl` | tab URL at failure |
| `tabId` | yes |

**2. Lifecycle evidence (same attempt):**
| Event | Required |
|---|---|
| `createdTabId` | at `tabs.create` success |
| Navigation/update for that tab | relevant `tabs.onUpdated` (`status`, `url` when present) until fill session ends |
| `tabs.onRemoved` | whether it fires for that `tabId` (and when relative to failure) |
| Final tab existence | `tabs.get(tabId)` at failure → exists / gone |

**3. Late-validity probe (same tab, after fill already failed `targets_not_ready`):**
After Managed fill session has **already** returned `targets_not_ready` to Hub, run **assess-only** (no fill, no credentials in logs) on the **same** `tabId` at fixed diagnostic offsets (suggested: **+2s, +5s, +10s** from failure return). Record whether `assessManagedTargetsReady` becomes `ready: true` later.

- Must **not** alter `MANAGED_AUTOFILL_RETRY_DELAY_MS`, `GENERIC_REAL_SITE_MAX_ATTEMPTS`, or fill-path retry logic.
- Late probes are **additive diagnostic only**, after `finishSession` / Hub already received failure.

**4–8. Hard stops**
- Do **not** log credential values (or any secret field contents).  
- Do **not** change mappings / registry config.  
- Do **not** change fill-path retry timing.  
- Do **not** add hostname/serviceId-specific instrumentation.  
- Do **not** fall back to legacy generic.

### Smallest instrumentation surface (normative for Manager/Developer)

| Location | Change (diagnostic only) |
|---|---|
| `extension/generic/validated-autofill.js` | On not-ready: include `locator` alongside existing `fieldId`/`detail`; include `observedUrl: location.href` (no secrets). Prefer assess-only export usable for post-failure probe. |
| `extension/background.js` — Managed session only | Log/attach: `createdTabId`; per-tab `onUpdated` (status/url); `onRemoved`; at failure `tabs.get` + `finalObservedUrl`; pass through readiness fields on `sendResponse`. After `targets_not_ready` session end: schedule assess-only late probes (+2/+5/+10s) — **no fill**. Tag all logs `[ManagedAutofillDiag]`. |
| Hub (optional, DEV-only) | Surface extension failure `detail`/`fieldId`/`locator`/`tabId`/`url` in console — **never** credentials. |

**Remove or gate:** Diagnostic may be always-on temporarily for this Owner run, or behind a single generic flag (e.g. message `diagnostic: true` / DEV console) — must remain **service-agnostic**. Prefer temporary always-on Managed diag logs for one evidence package, then strip or disable after Architecture review (strip not required before evidence).

### Process
```text
Developer implements smallest §5D diagnostic
  → Verification: no secrets in logs; no retry timing change; no mapping change
  → Owner: one fresh Digital Home Managed launch (fixture)
  → Capture console + structured failure payload → Architect §5D evidence
  → Architecture classifies config vs generic gap with direct evidence
  → Only then: possible generic FIX authorization (separate)
```

### Implementation authorization
| Item | Status |
|---|---|
| §5D diagnostic patch | **AUTHORIZED** |
| §5C runtime fix | **NOT AUTHORIZED** |
| Mapping / config edits | **FORBIDDEN** |
| Legacy generic fallback | **FORBIDDEN** |

---


## 5E. §5D evidence — root-cause reclassification (2026-09-22)

### Direct §5D evidence (Owner)
| Fact | Observed |
|---|---|
| Tab lifecycle | Tab **remained alive** (not `No tab with id`) |
| URL | **Stable** through failure + late probes |
| Failing mapping | `password` → `#j_password` |
| Readiness detail | **`multi_match`** |
| Late probes (+2s / +5s / +10s) | **Same `multi_match`** — no readiness/timing recovery |
| Timing/navigation hypothesis | **Falsified** for this failure |

### How could Admin set `supportState=validated` if Managed rejects `#j_password`?

| Layer | What it actually checks | Enforces exactly-one live target? |
|---|---|---|
| **Structural save** (`validateAutofillProfileStructural`) | Schema coverage, CSS locator type, Login Entry/origin shape | **No** — never touches live DOM |
| **Visual Mapping pick** (`preferExactOneLocator`) | At **click time only**, prefers a candidate with `querySelectorAll` length === 1 | **Point-in-time only** — not re-checked at activate |
| **Analyze / Assisted Mapping** | Proposals from page structure / LLM path | **No** lasting uniqueness gate equal to Managed fill |
| **Admin «אשר מיפוי» / `activate_validated`** | Confirm dialog → `liveValidationApproved: true` boolean → stamps `validation.resultSummary: 'live_validation_ok'` | **No** — does **not** call `assessManagedTargetsReady` / `HUB_MANAGED_AUTOFILL` / throwaway fill |
| **Managed runtime** (`assessManagedTargetsReady`) | Every mapped locator → exactly one safe top-doc target | **Yes** — `multi_match` fail-closed (correct per D-117-17 / AC-117-9) |

**Conclusion:** Product “live validation / activate” today is **administrative attestation**, not a **runtime-parity probe**. Architecture D-117-7 intended “approved **successful** live validation”; implementation stamps success without executing the Managed readiness contract. That is why `validated` and later `multi_match` can coexist for the same locator string.

### Classification (critical question)

| Option | Verdict |
|---|---|
| **A) validation/runtime DOM-scope mismatch** | **Not primary** — Visual/Managed both top-document (`frameIds: [0]`). Duplicate `#j_password` is in the **same** scope Managed queries. |
| **B) validation contract defect** | **PRIMARY** — activate/`validated` does not require the same exactly-one readiness contract Managed enforces. |
| **C) runtime contract defect** | **Not primary** — rejecting `multi_match` is **correct**; must **not** weaken exactly-one / first-match. |
| **D) authoring/validation evidence defect** | **Contributing / inseparable from B** — `resultSummary: 'live_validation_ok'` is stamped without Managed assess/fill evidence; Visual uniqueness is not re-verified at activate. |
| Timing / tab lifecycle (§5C primary) | **Superseded for this P4** — falsified by §5D. |

**Root cause (Architecture):**  
`VALIDATION_CONTRACT_DEFECT` — missing **Managed-parity live uniqueness/readiness gate** before `supportState=validated`. Persistent top-document `multi_match` on `#j_password` is the **runtime-correct** fail; activation was allowed without that check.

### §5C update
| Prior §5C claim | Status after §5D |
|---|---|
| PRIMARY `GENERIC_MANAGED_RUNTIME_GAP` (tab close / settle timing) | **Demoted** — may remain a separate generic hardening item; **not** the cause of this P4 |
| `targets_not_ready` subtype unknown | **Resolved:** `password` / `#j_password` / **`multi_match`** (persistent) |
| Blame fixture locator first | Still **forbidden** as architecture “fix”; uniqueness failure must be blocked by **generic** activate gate; remapping is Admin config after that gate exists |

### Forbidden responses (unchanged)
- Manually change Shufersal locator as the architectural “fix”  
- Service-specific selector / hostname / serviceId branch  
- Choose first match / weaken exactly-one safe target  
- Timing delays as substitute for uniqueness  
- Legacy generic fallback  

### Generic architectural correction proposal (NO FIX AUTHORIZED YET)

**Intent:** Align Admin activation with Managed runtime readiness (D-117-7 / D-117-17 / AC-117-9) without service-specific logic.

1. **Normative activate gate (generic):** Before `activate_validated` may succeed, run a **Managed-parity probe** on the configured Login Entry (top document only):
   - Same readiness function as runtime (`assessManagedTargetsReady` or equivalent shared contract).  
   - Optional Security-gated throwaway fill + verify (Phase 117 design) — never vault decrypt.  
   - Fail closed on `zero_match` / `multi_match` / unsafe details; surface `fieldId` + `detail` (+ locator) to Admin.  
2. **Evidence stamp:** Persist validation metadata that records probe outcome codes (no secrets) — do not treat UI confirm alone as `live_validation_ok`.  
3. **Authoring:** Visual/Analyze may propose locators; **activate** must re-verify uniqueness. Point-in-time Visual uniqueness is insufficient alone.  
4. **Runtime:** Keep exactly-one rule; no first-match.  
5. **Remediation path for current fixture (after fix ships):** Admin remaps under the new gate (more specific unique CSS) — **config**, not runtime special-case.

**Implementation:** **120.2 CLOSED / ACCEPTED** (P4 Owner live **PASS** 2026-09-22). **120.FSC NOT AUTHORIZED.**

---


## 6. Slice roadmap

| Slice | Intent | Status |
|---|---|---|
| **120.1** | Autofill Runtime Inventory | **ACCEPTED** |
| **120.2** | Shufersal Managed migration pilot (**fixture**) | **CLOSED / ACCEPTED** (2026-09-22) — P1/P3/AP/P4 **PASS** |
| **120.2-AP** | Managed-parity activate gate (generic) | **CLOSED** |
| **120.3.0** | Runtime Convergence investigation | **ACCEPTED** (2026-09-22; sequence clarification applied) |
| **120.3.1** | Manager Disposition DD (enforceable convergence plan) | **ARCHITECTURE PASS / ACCEPTED** (2026-09-22) |
| **120.3.2** | Optional dead/POC hygiene | **NOT AUTHORIZED** |
| **120.3.3** | Representative Config-Only Managed Convergence Validation | **RESOLVED in §24** — composite **PASS** (evidence reuse); not a separate engineering slice |
| **120.3.4** | Dedicated adapter capability analysis (fixture → generic gap) | **ACCEPTED** + §10.8 Owner clarification |
| **120.3.5** | Generic Capability Boundary (site-independent) | **ACCEPTED** (§11 / D-120-11) |
| **120.3.6** / **120.3.6-impl** | Dedicated Site-Adapter Legacy Debt Removal | **ACCEPTED / CLOSED** |
| **§13** | Authoring vs Managed `unsafe_target` investigation | **ACCEPTED** (Owner) — contract mismatch |
| **120.4** | Unify Managed target-safety across Analyze / Visual / parity / runtime | **ACCEPTED / CLOSED** |
| **120.4-impl** | Developer implementation of 120.4 | **ACCEPTED / CLOSED** (2026-09-22) |
| **120.5** | Admin Managed Autofill Test Harness | **ACCEPTED / CLOSED** — live evidence via Rivhit + Blind-ID (§23) |
| **120.6** | Managed visibility correction | **ACCEPTED / CLOSED** |
| **120.7** | Clear Managed Mapping persistence | **ACCEPTED / CLOSED** |
| **120.8** | Identity decoupling + HIGH/MEDIUM + provenance | **ACCEPTED / CLOSED** — live Owner **PASS** (§23) |
| Phase 120 Final Acceptance | §24 Matrix + **§25/120.9** | **CLOSED / ACCEPTED** (2026-09-22) |
| **120.9** | Authoring Locator Verification Integrity | **FORMALLY CLOSED / ARCHITECTURE ACCEPTED** — live Owner L1–L4 **PASS** (2026-09-22) |
| **120.FSC** (reserved) | Generic Fresh Service Creation validation | **RESERVED — NOT AUTHORIZED** — Production Readiness (post-120) |

### Reserved — Fresh Service Creation validation (NOT STARTED / NOT AUTHORIZED)

After Owner/Architecture authorize (post-120.2; still **not** started):

| Step | Intent |
|---|---|
| Create | Clean global service with **no** legacy assumptions |
| Schema | Explicit credential schema (stable field IDs; may differ from DOM names) |
| Author | Analyze / Visual Mapping / Managed-parity activate |
| Prove | Managed Autofill without runtime code changes |

**Do not start 120.FSC yet.**

---

## 7. Constraints / Non-Negotiables

- Repository evidence authoritative  
- **D-120-9 / D-120-10 / D-120-11** — fixtures ≠ architecture; representative ≠ exhaustive; **generic capabilities only**  
- Target: Login Experience Capability → configuration → validated Managed — **never** Website Identity → special production code  
- Missing capability → explicit **UNSUPPORTED** — never a new site-specific implementation  
- Do **not** implement unsupported generic capabilities in Phase 120 merely to preserve a named historical fixture  
- No weakening Phase 117 Managed security / 120.2-AP activate parity / fail-closed / no silent legacy fallback / no auto-submit  
- Legacy site-specific paths may still exist physically until safely retired — they are **debt**, not target architecture  
- Health Monitoring reserved  
- 120.3.3 remains deferred to Phase 120 Acceptance Matrix  
- No Developer work until Architecture review ACCEPT + explicit engineering-slice authorization  

---

## 8. Handoff Notes — 120.5 Architecture

1. **120.4 / 120.5 remain CLOSED.**  
2. **§16 ACCEPTED (B).** **120.6-impl Architecture ACCEPTED / CLOSED.**  
3. **LIVE OWNER RETEST AUTHORIZED** (see Architect Review exact sequence).  
4. Final Acceptance **OPEN / PENDING** until live evidence. Do **not** stamp validated before live probe PASS.  

---

---

## 9. Slice 120.3 — Runtime Convergence & Service-Specific Logic Elimination

### Status
**120.3.0 ACCEPTED** (Owner 2026-09-22) — inventory, decision tree, classifications, capability gaps, retain list, and Phase 117/118/119/120.2 guarantee preservation **ACCEPTED**.  
Sequence clarification applied (**D-120-10** / §9.4).  
**Next:** **120.3.1 Manager Disposition DD ONLY** — then STOP for Architecture review.  
No Developer implementation / adapter removal / service migration / 120.FSC.

### Title
Runtime Convergence & Service-Specific Logic Elimination

### Goal
Production Autofill runtime must be **genuinely configuration-driven**. Supported simple login services execute through the **same Managed Autofill runtime** regardless of service identity. A service is defined by **configuration/data**, not by production runtime code that knows service name, service ID, hostname, or site-specific selectors.

### Normative authoring flow (target — already largely delivered by 117/118/119/120.2-AP)
```text
Admin defines/selects service + explicit Login Entry
  → credential schema (stable field IDs)
  → Analyze Login Page (HIGH mappings review)
  → else Visual Mapping
  → structural save
  → Managed-parity validation probe MUST pass
  → only then supportState=validated
```

Analyze / Visual Mapping = **authoring only**. Production Managed runtime must not know which authoring mechanism produced the config.

### Normative production runtime (target)
```text
Digital Home
  → Managed Autofill
  → validated service configuration
  → configured Login Entry
  → configured field mappings
  → deterministic field resolution
  → deterministic fill
  → manual user submit
```

### Production runtime MUST NOT depend on
service name; service ID; hostname-specific branches; dedicated selectors in source; Shufersal/HTZone/Clalit-specific behavior; dedicated adapters where Managed can represent the same login experience; silent legacy fallback after Managed is selected.

Named services = **validation fixtures only** (D-120-9).

### Hard stops (investigation + future implementation)
- Do **not** delete/modify adapters in this investigation  
- Do **not** migrate another service yet  
- Do **not** start 120.FSC  
- Do **not** remove HTZone (or any adapter) merely because it is service-specific  
- Do **not** introduce replacement service-specific logic  
- Do **not** weaken Phase 117/118/119/120.2 guarantees  

---

### 9.1 Post-120.2 re-inventory (repository evidence — 2026-09-22)

**Method:** Read-only inspection of `src/execution/*`, adapters, LI medium allowlist, `pocAutofill.ts`, extension Managed/HTZone/generic paths. No production changes.

#### A. Reachable production Autofill execution paths

| # | Path | Entry | Production reachable? | Classification |
|---|---|---|---|---|
| 1 | **Managed Autofill** | `executeServiceFromTile` → claim/eligible → `executeManagedAutofill` → Ext `HUB_MANAGED_AUTOFILL` → `assessManagedTargetsReady` + fill | **Yes** when validated+eligible | **TARGET** |
| 2 | **Site adapter: htzone** | `adapterId===htzone'` → `htzoneAdapter` → Ext `POC_FILL_IL` / `htzone-adapter.js` | **Yes** when catalog `adapter_id=htzone` | **MIGRATION CANDIDATE** |
| 3 | **Site adapter: practice** | `adapterId===practice'` → practice demo fill | **Limited** (demo/localhost) | **DEVELOPMENT / POC** |
| 4 | **Legacy generic** | After adapters+Managed miss; LI basic/unknown; `shouldAttemptGenericAutofill` → `POC_GENERIC_FILL` | **Yes** (e.g. Clalit if not Managed) | **MIGRATION CANDIDATE** |
| 5 | **Identity-first medium** | LI `medium` → `executeMediumAssist` + host/serviceId allowlist | **Yes** when LI=medium + allowlisted | **MIGRATION CANDIDATE** (allowlist is service/host-specific) |
| 6 | **LI complex / open-only** | LI `complex` → open + `website_not_supported` | **Yes** | **TEMPORARY EXCEPTION** |
| 7 | **Open-only / credentials missing** | Various fail-closed opens | **Yes** | Operational (not a parallel fill engine) |
| 8 | **POC Hub helpers** | `pocAutofill.ts` named HTZone/Shufersal/Clalit; DEV UI | **No** as production Digital Home UX | **DEVELOPMENT / POC** |
| 9 | **LEGACY_ADAPTER_ID_BY_SERVICE_ID** | Empty `{}` map | **No** | **DEAD / UNREACHABLE** |
| 10 | **Admin authoring** | Analyze / Visual / Managed-parity probe | Admin only — not Digital Home fill | Authoring (out of fill-runtime; preserve) |

**Post-120.2 delta vs 120.1:** Fixture **Shufersal** now uses **Managed** when validated (pilot CLOSED). Clalit still typically **legacy generic** unless separately authored. HTZone still **adapter-first** (before Managed in decision tree).

#### B. Exact runtime decision tree (current — `executeServiceFromTile`)
```text
Digital Home / executeServiceFromTile(service, credential, loginFields)
  openUrl := loginUrl ?? primaryUrl

  1. IF adapterId ∈ {htzone, practice} AND adapter registered:
       → adapter.execute(...)  → STOP
       (Managed / LI / generic NEVER reached for that tile)

  2. IF Managed claim OR validated profile OR eligible:
       IF !credential → open Managed Login Entry; STOP
       IF !eligible → open + MSG_MANAGED_NOT_READY; STOP
       → executeManagedAutofill (...)
       → on fail: open_only + message; STOP
       → NEVER executeGenericAutofill on Managed path

  3. Resolve Login Intelligence complexity

  4. IF complexity === 'complex':
       → open + website_not_supported; STOP

  5. IF complexity === 'medium':
       → executeMediumAssist (identity-first; host/serviceId allowlist); STOP

  6. IF shouldAttemptGenericAutofill AND (basic|unknown):
       → executeGenericAutofill (POC_GENERIC_FILL); STOP

  7. ELSE open_only / credentials_missing
```

#### C. Service-specific production logic inventory

| Finding | Location | Nature | Classification |
|---|---|---|---|
| `SITE_SPECIFIC_ADAPTER_IDS` / `htzone`+`practice` registry | `adapters/registry.ts` | adapterId branch before Managed | HTZone: **MIGRATION CANDIDATE**; practice: **POC** |
| `htzoneAdapter` + email/password payload shape | `htzoneAdapter.ts` | Hard-coded credential shape for Ext | **MIGRATION CANDIDATE** — assess vs Managed capability |
| Ext HTZone hostname gate + `htzone-adapter.js` | `extension/background.js`, `htzone-adapter.js` | Hostname + dedicated selectors/scripts | **MIGRATION CANDIDATE** / possible **capability gap** |
| Medium allowlist `hostIncludes` + optional `serviceId` | `supportedMediumSites.ts` | Entries: localhost fixture, `amazon-il`, `ksp` — host/serviceId match | **TEMPORARY EXCEPTION** + **capability gap** (multi-step identity-first); do not expand as architecture |
| `pocAutofill.ts` SHUFERSAL/CLALIT/HTZONE constants | `pocAutofill.ts` | Named service helpers | **DEVELOPMENT / POC** |
| `builtinCatalog` `adapterId` htzone/practice; seed ids shufersal/clalit/amazon-il/ksp | `builtinCatalog.ts` | Catalog data (not a runtime branch by itself) | Data; HTZone `adapterId` drives path **1** |
| Empty `LEGACY_ADAPTER_ID_BY_SERVICE_ID` | `legacyCatalogMap.ts` | Dead map | **DEAD / UNREACHABLE** |
| Manifest `host_permissions` HTZone hosts | `extension/manifest.json` | Packaging for dedicated adapter | Packaging; not Managed architecture |
| Ext hostname gate `htzone.co.il` + `htzone-adapter.js` injection | `extension/background.js`, `htzone-adapter.js` | Dedicated selectors/scripts behind hostname | **MIGRATION CANDIDATE** / possible **capability gap** — retain until capability proof |
| Managed / Managed-parity activate / generic eligibility | Managed + `shouldAttemptGenericAutofill` | Config-driven; origin-independent generic gate | **TARGET** / generic path — keep Managed; generic = migration candidate |

**Shufersal / Clalit:** No dedicated fill adapter in verified inventory (unchanged from 120.1). Shufersal post-120.2 = Managed config. Clalit = generic until Managed-authored.

#### D. Capability-gap inventory (generic WHY — not service identity)

| Gap | Why Managed (current) cannot yet replace |
|---|---|
| **Multi-step / identity-first** | Managed fills mapped fields on one Login Entry top document; no first-class multi-step identity flow |
| **Complex / non-standard login** | LI complex = open-only by design until richer Managed capability |
| **iframe / shadow / modal automation** | Managed top-document CSS only (D-117-8); general iframe automation out of scope historically |
| **Pre-fill DOM prep / non-CSS site choreography** | If a site requires imperative prep beyond CSS locators, Managed cannot express it yet — **investigate HTZone against this bar before removing adapter** |
| **Duplicate/ambiguous DOM ids** | Not a runtime gap — **authoring** uniqueness (120.2-AP); Visual Mapping remaps |

**Removable via current Managed capability (representative validation — D-120-10):**  
Simple single-page username/password (or schema-mapped) logins still on **legacy generic** may be used as **representative fixtures** once Admin authors + Managed-parity activate — **config-only**, no runtime code. Phase 120.3 does **not** require migrating every simple catalog service.

#### E. What can converge without weakening support (proposed — not authorized to execute)
1. Keep Managed + 120.2-AP activate contract intact.  
2. Do **not** remove HTZone until capability analysis answers: *Can existing generic Managed represent the login behavior currently handled by the dedicated adapter?* (YES → config+validation+Managed proof before retirement considered; NO → document missing **generic** capability — never HTZone-specific replacement).  
3. Prove simple-login config-driven convergence via **representative** fixtures (D-120-10) — not exhaustive catalog migration.  
4. Treat medium allowlist (`amazon-il`, `ksp`, localhost fixture) as **explicit temporary exception** / capability decision boundary — Phase 120 need **not** implement multi-step Managed; documented temporary exception may be an acceptable Phase 120 outcome if simple-login runtime convergence is complete. Do not expand host lists as architecture.  
5. Leave practice/POC off production Digital Home path (already DEV-gated).  
6. Dead legacy adapter map: safe cleanup candidate in a later hygiene slice.  
7. Never silent Managed→generic fallback (already guaranteed).  
8. Legacy generic retirement (**120.3.6**) only when reachable dependents are identified and either Managed-represented or explicitly classified as approved exception.

#### E2. Must **not** remove yet (and why — generic)
| Item | Why retain |
|---|---|
| HTZone adapter + Ext HTZone path | Adapter runs **before** Managed; removing without proving Managed can express the same login experience would weaken support; capability analysis not done |
| Medium assist + host allowlist | Multi-step identity-first is a **capability gap** for current Managed; list is temporary exception |
| LI complex → open-only | By design until richer Managed capability exists |
| Managed fail-closed (no silent generic) | Phase 117 / 120.2 security contract |
| Practice adapter | DEV/demo; removing is hygiene only — not a production convergence win |

#### F. Phase 117/118/119/120.2 guarantees — verification
| Guarantee | Intact? |
|---|---|
| Managed exactly-one / no auto-submit / fail-closed | **Yes** |
| Authoring Analyze/Visual ≠ runtime knowledge of authoring path | **Yes** |
| Managed-parity activate before `validated` (120.2-AP) | **Yes** |
| Shared Global Registry topology (§5B) | **Yes** |
| D-120-9 fixtures ≠ architecture | **Yes** |
| No big-bang adapter delete in 120.3 investigation | **Yes** (binding) |

---

### 9.2 Proposed 120.3 boundaries

| In scope (eventually; after investigation ACCEPT) | Out of scope |
|---|---|
| Evidence-backed convergence plan eliminating **unnecessary** service-specific production fill paths | Deleting HTZone/practice adapters without capability proof |
| **Representative** config-only Managed convergence validation (D-120-10) | Exhaustive one-by-one migration of every simple catalog service |
| Documenting temporary exceptions with generic capability rationale | Expanding hostname allowlists as product architecture |
| Optional dead-code / POC path hygiene | Starting 120.FSC / Health Monitoring / iframe DSL / assuming multi-step Managed must ship in Phase 120 |
| Owner-gated implementation sub-slices (120.3.1…) | Weakening Managed security or exactly-one; silent legacy fallback; service-specific replacement logic |

**120.3.0:** investigation + boundaries + AC + sequence — **ACCEPTED** (2026-09-22).

---

### 9.3 Acceptance criteria (AC-120.3-*) — investigation slice (120.3.0)

| ID | Criterion | Result |
|---|---|---|
| AC-120.3-1 | Post-120.2 inventory covers all reachable production Autofill paths from repository evidence | **PASS / ACCEPTED** |
| AC-120.3-2 | Decision tree from Digital Home to fill/open is exact and current | **PASS / ACCEPTED** |
| AC-120.3-3 | Every service-specific production branch/adapter/hostname/serviceId/hard-coded selector path is listed and classified | **PASS / ACCEPTED** |
| AC-120.3-4 | Capability gaps stated in **generic capability** terms (not “because HTZone”) | **PASS / ACCEPTED** |
| AC-120.3-5 | Explicit list of what must **not** be removed yet and why | **PASS / ACCEPTED** |
| AC-120.3-6 | Phase 117/118/119/120.2 guarantees affirmed intact | **PASS / ACCEPTED** |
| AC-120.3-7 | No production code changed in 120.3 investigation | **PASS / ACCEPTED** |
| AC-120.3-8 | Proposed phased convergence sequence is Owner-reviewable | **PASS / ACCEPTED** (clarification applied → D-120-10 / §9.4) |

---

### 9.4 Recommended phased convergence sequence (**normative after Owner clarification**)

| Sub-slice | Intent | Gate |
|---|---|---|
| **120.3.0** | Investigation (this §9) | **ACCEPTED** (2026-09-22) |
| **120.3.1** | Manager DD: enforceable disposition matrix + convergence plan | **ARCHITECTURE PASS / ACCEPTED** (2026-09-22) |
| **120.3.2** | Optional: dead/POC hygiene that cannot affect production tiles | Owner authorize |
| **120.3.3** | **Representative Config-Only Managed Convergence Validation** — **DEFERRED** (Owner 2026-09-22) to **final Phase 120 Acceptance Matrix**; not executed as a separate engineering slice now | Deferred — evidence at phase close |
| **120.3.4** | Dedicated adapter analysis → generic gap discovery | **ACCEPTED** + §10.8 clarification |
| **120.3.5** | **Generic Capability Boundary** (site-independent) + debt removal analysis | **ACCEPTED** (Owner 2026-09-22) |
| **120.3.6** | **Dedicated Site-Adapter Legacy Debt Removal** (engineering) | **ACCEPTED / CLOSED** |
| **§13 / 120.4** | Authoring↔Managed safety unification | **§13 ACCEPTED**; **120.4 Manager DD AUTHORIZED** |
| Prior “120.3.6 legacy generic retirement” | Renamed intent: generic retirement remains **future / conditional** — **not** this slice | Use a later id if/when authorized |

**Developer implementation of 120.3.2+ is NOT AUTHORIZED** until Architecture PASS on 120.3.1 DD + explicit sub-slice authorization.

---

### 9.5 Implementation authorization
| Item | Status |
|---|---|
| 120.3.0 investigation (§9) | **ACCEPTED** |
| **120.3.1** Manager Disposition DD | **ARCHITECTURE PASS / ACCEPTED** |
| **120.3.3** Representative validation | **DEFERRED** → Phase 120 Acceptance Matrix |
| **120.3.4** Dedicated adapter capability analysis | **ACCEPTED** + Owner clarification §10.8 |
| **120.3.5** Generic Capability Boundary | **ACCEPTED** (Owner 2026-09-22) |
| **120.3.6** Dedicated Site-Adapter Legacy Debt Removal | **DD PASS / ACCEPTED**; **120.3.6-impl AUTHORIZED** |
| Developer implementation / new capabilities / 120.FSC | Impl **AUTHORIZED** for 120.3.6 only; capabilities / 120.FSC still **FORBIDDEN** |

---

### 9.6 Architecture requirements for 120.3.1 Manager Disposition DD

Manager DD **must** convert §9 investigation into an **enforceable** convergence plan containing:

1. **Retirement intent** — which production mechanisms are intended for retirement (and which are not yet).  
2. **Temporary retains** — what remains temporarily, with generic capability rationale.  
3. **Prerequisites / evidence** — exact gates before each retirement (config, Managed-parity activate, live Managed path proof, regression).  
4. **Representative validation strategy** — per D-120-10 / 120.3.3 (fixtures only; not exhaustive catalog migration).  
5. **Regression requirements** — Phase 117/118/119/120.2 Managed contracts must not regress.  
6. **Rollback / fail-closed requirements** — no silent Managed→legacy fallback; retirement must be reversible or fail-closed without capability loss.  
7. **Explicit prohibition** — no service-specific replacement logic (hostname/serviceId/selectors/adapters that re-encode named-service knowledge where Managed can represent the experience).

Named services = fixtures only (D-120-9).

### 9.7 Architecture review — Slice 120.3.1 Disposition DD

| §9.6 requirement | Result | Evidence in `manager-phase120.md` |
|---|---|---|
| 1. Retirement intent (what / not yet) | **PASS** | §1.1 / §1.2 / §1.3 |
| 2. Temporary retains + generic capability rationale | **PASS** | §2 |
| 3. Exact prerequisites/evidence before each retirement | **PASS** | §3.1 gate matrix + §3.2 |
| 4. Representative validation (120.3.3; fixtures only) | **PASS** | §4 (D-120-10; Shufersal counts; not exhaustive) |
| 5. Regression 117/118/119/120.2 | **PASS** | §5 |
| 6. Rollback / fail-closed | **PASS** | §6 |
| 7. Ban on service-specific replacement | **PASS** | §7 |
| Hard stops (no code / no migration / no 120.FSC / HTZone = equivalence only / multi-step not assumed) | **PASS** | Hard stops table + phased sequence |

**Decision: ARCHITECTURE PASS / ACCEPTED.** No required corrections.

---

## 10. Slice 120.3.4 — Dedicated Adapter Capability Analysis (investigation only)

### Status
**ACCEPTED with Owner clarification** (2026-09-22) — investigation finding **B** retained; disposition corrected in §10.8 (fixture ≠ architecture; gap = generic UNSUPPORTED; do not implement in Phase 120 to preserve named site).

### Architectural question (binding)
**Not:** “How do we support [named site]?”  
**Yes:** What **generic** behavior did the dedicated adapter provide, and can **existing** Managed represent it without service-specific production code?

### Conclusion (evidence-backed — repository)
**B. GENERIC_CAPABILITY_GAP** — **pre-fill login-surface activation** (generic).

See **§10.8** for corrected product disposition (supersedes any “retain adapter to preserve fixture Autofill” reading).

---

### 10.1 End-to-end execution trace (dedicated adapter path)

```text
Digital Home tile
  → executeServiceFromTile(service, credential, loginFields)
  → openUrl := loginUrl ?? primaryUrl  (catalog: https://www.htzone.co.il/login)
  → adapterId === 'htzone' AND isSiteSpecificAdapter → STOP before Managed
  → htzoneAdapter.execute(...)
       · map vault fields → { email, password } (hard-coded shape)
       · sendExtensionMessage({ type: 'POC_FILL_IL', url, credentials, withAutofillParam: false })
  → extension/background.js onMessageExternal POC_FILL_IL
  → openHtzonePageAndFill(url, credentials, …)
       · hostname+path gate: isHtzoneLoginUrl (htzone.co.il|/login)
       · chrome.tabs.create(url)
       · on tab complete → delay 800ms → runHtzoneAdapterFill
  → inject htzone-adapter.js (MAIN world)
  → invoke window.__israeliVaultHtzoneFill(credentials)
       · prepareLoginPopup()   ← imperative DOM choreography
       · findLoginFields() via hard-coded CSS requiring form.login_form.active
       · setNativeValue + input/change/blur (+ optional jQuery label_content.active)
       · NO form submit
  → structured result { ok, … } / retries via HTZONE_RETRY_DELAYS_MS
```

**Managed path is never reached** for this tile while `adapterId=htzone` remains (orchestrator step 1 exclusive).

---

### 10.2 Service-specific production artifact inventory

| Artifact | Location | Nature |
|---|---|---|
| Adapter registration `htzone` | `src/execution/adapters/registry.ts` | Site-specific set + map |
| Hub adapter | `src/execution/adapters/htzoneAdapter.ts` | `POC_FILL_IL`; email/password payload mapper |
| Orchestrator exclusive branch | `src/execution/serviceExecution.ts` | adapter before Managed |
| Catalog `adapterId: 'htzone'` | `src/catalog/builtinCatalog.ts` | Routing metadata (fixture seed) |
| Support-level special-case | `src/loginAssistance/supportLevel.ts` | `adapterId === 'htzone'\|'practice'` |
| Ext message `POC_FILL_IL` | `extension/background.js` | Dedicated message type |
| Hostname/path gate `isHtzoneLoginUrl` | `extension/background.js` | `htzone.co.il` + `/login` |
| `openHtzonePageAndFill` / inject / retry | `extension/background.js` | Dedicated open+fill orchestration |
| `MOCK_HTZONE_CREDENTIALS`, `HTZONE_RETRY_DELAYS_MS` | `extension/background.js` | Hard-coded mocks/timing |
| Dedicated script | `extension/htzone-adapter.js` | Selectors + `prepareLoginPopup` + fill |
| Hard-coded selectors | `htzone-adapter.js` | `form.popup_form.login_form.active input[name="email"\|"password"]` |
| Host permissions (named) | `extension/manifest.json` | `htzone.co.il` (also broader `https://*/*`) |
| POC helpers | `src/pocAutofill.ts` | DEV named helpers / direct `POC_FILL_IL` |
| Dedicated automated tests | *(none found as first-class unit suite keyed to HTZone fill)* | Inventory: no dedicated production test suite required for this conclusion |

---

### 10.3 Behavior comparison (adapter vs existing Managed)

| Concern | Dedicated adapter | Existing Managed (117/118/119/120.2) |
|---|---|---|
| **Opening / navigation** | Ext creates tab to Login URL; hostname gate | Ext opens configured `loginEntryUrl` / allowedOrigin |
| **Readiness** | Retries until hard-coded fields visible after prep; `fields_not_ready` | `assessManagedTargetsReady`: exactly-one safe CSS target per mapping; fail-closed |
| **Field discovery / selection** | Hard-coded selectors in source | Config CSS locators from Admin Analyze/Visual |
| **Field filling** | Native value setter + input/change/blur | `GenericFillExecutor.fillField` (native + events + verify) |
| **DOM interaction / choreography** | **`prepareLoginPopup`**: force popup display, overlay, toggle `.active`, show `form_wrap` | **None** — requires fields already safe/visible |
| **Event dispatch** | InputEvent/change/blur + optional jQuery triggers | beforeinput/input/change/keyup/blur (no jQuery label helper) |
| **Sequencing** | Fixed 800ms + multi-delay retries | Managed readiness retries / late probes (generic) |
| **Frame / document** | Top document MAIN-world script | Top document only (`not_top_frame` fail) |
| **Submit** | **No auto-submit** | **No auto-submit** |
| **Credential model** | Fixed `{email,password}` shape | Schema fieldIds + mappings |
| **Activate gate** | N/A (adapter path) | Managed-parity activate required before `validated` |
| **Fail-closed / silent legacy** | Open without fill if message fails | Fail-closed; **never** silent generic fallback |

---

### 10.4 Capability-equivalence matrix

| Adapter behavior | Existing Managed equivalent | Verdict | Evidence |
|---|---|---|---|
| Open Login Entry tab | Managed opens `loginEntryUrl` | **Equivalent** | `executeManagedAutofill` / Ext Managed open |
| No auto-submit | Managed never submits | **Equivalent** | `validated-autofill.js`; adapter returns after fill only |
| Fill visible email/password inputs via CSS | Config CSS locators + `fillField` | **Equivalent** *if* surface already ready | Phase 117 fill executor; 120.2 fixture proof class |
| Schema-flexible field IDs | Managed mappings by `fieldId` | **Equivalent** (Managed stronger) | `buildManagedPayload` |
| Exactly-one / activate parity | Managed-parity activate + assess | **Equivalent** (Managed stronger; adapter weaker) | 120.2-AP |
| Fail closed without silent generic | Managed path exclusive fail-closed | **Equivalent** (different message types) | `serviceExecution` Managed branch |
| Hard-coded site selectors in source | Admin config locators | **Not required as runtime** if config can express | Authoring 118/119 |
| Hostname/`serviceId` product gate | Managed uses allowedOrigin + mappings | **Not required** for Managed model | D-120-9 |
| **`prepareLoginPopup` imperative reveal** | **No Managed/config primitive** | **Not equivalent** | `htzone-adapter.js` `prepareLoginPopup` |
| Selectors depending on `.login_form.active` / forced display | Managed rejects zero_match / hidden / unsafe | **Not equivalent** without prior surface activation | assess + `isSafeFillTarget` |
| jQuery `.label_content.active` after fill | No jQuery helper in GenericFillExecutor | **Unknown** (may be unnecessary if surface ready) | Adapter-only; not proven required generically |
| Adapter-exclusive orchestrator order | N/A (routing, not fill capability) | Routing artifact | `serviceExecution` step 1 |

---

### 10.5 Conclusion detail — **B. GENERIC_CAPABILITY_GAP** (unchanged finding; disposition revised in §10.8)

**Missing generic capability (identity-free wording):**  
**Pre-fill login-surface activation / modal-or-popup choreography** — make a login surface visible and interactive **before** deterministic field fill when the Login Entry document does not already present uniquely locatable safe fill targets.

**Why not A / C:** As previously recorded — repository evidence of `prepareLoginPopup` vs Managed readiness-only model is sufficient.

---

### 10.6 Superseded recommendation (historical)

Prior §10.6 recommended retaining the dedicated adapter until Managed equivalence and treating “preserve fixture Autofill” as a temporary exception. **Superseded by Owner clarification §10.8 and §11.**

---

### 10.7 Acceptance criteria — investigation (AC-120.3.4-*)

| ID | Criterion | Result |
|---|---|---|
| AC-120.3.4-1 | End-to-end adapter execution trace documented | **PASS** (§10.1) |
| AC-120.3.4-2 | Service-specific artifact inventory complete | **PASS** (§10.2) |
| AC-120.3.4-3 | Behavior comparison vs Managed documented | **PASS** (§10.3) |
| AC-120.3.4-4 | Capability-equivalence matrix with evidence | **PASS** (§10.4) |
| AC-120.3.4-5 | Exactly one conclusion A/B/C with evidence | **PASS** — **B** |
| AC-120.3.4-6 | No production code / no capability implementation in investigation | **PASS** |
| AC-120.3.4-7 | Disposition revised per Owner clarification (fixture ≠ architecture) | **PASS** (§10.8) |

---

### 10.8 Corrected disposition (Owner clarification 2026-09-22) — **BINDING**

| Statement | Disposition |
|---|---|
| Investigation finding | **Valuable:** discovered **generic** gap = pre-fill login-surface activation |
| Named fixture used in analysis | Historical/example **only** — **not** a product requirement to preserve site-specific Autofill |
| Does the gap force Phase 120 to implement the capability? | **No.** Do **not** implement pre-fill/modal activation in Phase 120 merely to preserve that fixture |
| Correct product state for experiences needing the gap | **UNSUPPORTED** (for that capability) until a **generic**, configuration-driven design is separately approved |
| Forbidden | HTZone/Clalit/Shufersal “support”; hostname/serviceId branches; dedicated adapters; site selectors in production runtime as architecture |
| Desired architecture | Login Experience Capability → configuration → validated generic Managed Runtime — **never** Website Identity → special production code |
| Physical legacy adapter code | May still exist until **safe retirement** — it is **legacy debt**, not target architecture |
| Prior “retain adapter until Managed equivalence / do not retire” rule | **Superseded** for fixtures with **no product requirement** to preserve site-specific behavior. Retirement is a **debt-removal** decision (see §11.3), not “implement capability to keep the site working” |

**D-120-11 applies.**

---

## 11. Slice 120.3.5 — Generic Capability Boundary

### Status
**DEFINED** (Architecture clarification — Owner 2026-09-22).  
Site-independent. **STOP** for Owner review. No Developer work in this slice.

### Normative target (binding)
```text
For every SUPPORTED login experience:
  Login Experience Capability → configuration → validated generic Managed Runtime

Never:
  Website Identity → special production code

If a generic capability is not supported:
  → explicit UNSUPPORTED
  not → create/use a new site-specific implementation
```

Do **not** create site-specific exceptions as the desired architecture. Historical legacy paths may still exist physically until retirement — **debt only**.

---

### 11.1 Generic Managed capability matrix (site-independent)

| Login-experience capability | Status today | Notes (generic only) |
|---|---|---|
| **Simple top-document single-page fields** (visible, uniquely CSS-locatable, safe inputs) | **Supported generically today** | Explicit Login Entry + schema + mappings + Managed-parity activate + deterministic fill; no auto-submit; fail-closed |
| **Delayed / dynamically appearing fields** (become present & safe without imperative activation) | **Supported generically today** (bounded) | Managed readiness assess + retries / late probes; still fail-closed on timeout / multi_match / unsafe |
| **Modal / popup activation** (force or choreograph surface visibility before fill) | **Unsupported generically today** | Discovered via 120.3.4 fixture analysis; **reserved** as future **generic** capability only |
| **Pre-fill interaction / activation** (imperative DOM prep beyond fill) | **Unsupported generically today** | Same family as modal/popup activation; **reserved** future generic — **not** Phase 120 implement-to-preserve-fixture |
| **Multi-step login** (identity-first / sequential steps) | **Unsupported generically today** | Existing medium host/serviceId path = **legacy debt**, not target architecture; **reserved** future generic |
| **iframe traversal** | **Unsupported generically today** | Historically out of Managed scope (top document); **reserved** future generic |
| **Shadow DOM interaction** | **Unsupported generically today** | **Reserved** future generic |
| **Auto-submit after fill** | **Unsupported by design** | Must remain unsupported (security contract) |
| **First-match / heuristic silent fill after Managed selected** | **Unsupported by design** | Forbidden |
| **Managed Autofill Health Monitoring / mapping drift** | **Already planned/reserved** | Recorded earlier in Phase 120; not authorized for implementation now |

**Authoring** (Analyze / Visual Mapping / Managed-parity probe) = configuration production — not a parallel fill capability.

---

### 11.2 Legacy / site-specific debt inventory (not target architecture)

| Mechanism | Classification | Role vs target |
|---|---|---|
| Dedicated `htzone` adapter + Ext `POC_FILL_IL` / `htzone-adapter.js` / hostname gate | **Legacy debt** | Site-specific; **no product requirement** to preserve (Owner) |
| Catalog `adapterId: 'htzone'` routing | **Legacy debt** | Forces adapter-first; blocks Managed path for that seed |
| Medium assist + `hostIncludes` / `serviceId` allowlist | **Legacy debt** | Hostname/serviceId product branch for unsupported multi-step |
| Legacy generic `POC_GENERIC_FILL` | **Migration candidate / debt** | Origin-independent heuristics; still reachable for non-Managed simple logins until dependents addressed |
| Practice adapter | **DEV / POC debt** | Demo path; not production Digital Home requirement |
| Empty `LEGACY_ADAPTER_ID_BY_SERVICE_ID` | **Dead debt** | Unreachable |
| POC Hub named helpers (`pocAutofill.ts`) | **DEV debt** | Not production UX |
| Managed + activate + authoring | **TARGET** | Keep |

---

### 11.3 Removal analysis (A / B / C)

#### A. Reachable site-specific mechanisms that can now be removed safely
*(no product requirement to preserve their site-specific behavior; removal → experiences needing unsupported capabilities become explicit open-only / unsupported — acceptable per D-120-11)*

| Mechanism | Why safe to remove (architecture) | Caveat |
|---|---|---|
| **HTZone dedicated adapter stack** (Hub adapter, registry entry, Ext `POC_FILL_IL` path, `htzone-adapter.js`, catalog `adapterId=htzone` clear/none) | Owner: no product requirement to preserve that site-specific Autofill; gap remains **UNSUPPORTED** generically — correct | Requires authorized engineering slice + regression that Managed / other tiles / practice (if kept) still work; no silent new site-specific replacement |
| **Empty legacy adapter map** | Dead / unreachable | Hygiene |
| **POC named HTZone helpers** (optional with above) | DEV-only | Hygiene |

#### B. Mechanisms that cannot yet be removed (removal could affect other required/reachable behavior)

| Mechanism | Why retain for now |
|---|---|
| **Managed Autofill + Managed-parity activate** | TARGET — never remove |
| **Legacy generic fill** | Still reachable for simple non-Managed catalog/custom services; removal before dependents matrix risks capability loss for supported-simple experiences still on generic |
| **Medium assist + allowlist** | Still reachable for allowlisted medium LI flows; Owner has not declared those product flows disposable; treat as debt but **do not** delete until Owner decides unsupported-vs-retain-debt for Phase 120 |
| **LI complex → open-only** | Operational unsupported signaling — aligns with explicit unsupported |
| **Practice adapter** | DEV demo; optional later hygiene — not required for Phase 120 convergence PASS |
| **Open-only / credentials-missing** | Operational |

#### C. Should removal occur inside Phase 120 before final Acceptance Matrix?

| Item | Recommendation |
|---|---|
| **Dedicated HTZone site-specific stack (A)** | **Yes — recommended inside Phase 120** as a numbered **legacy debt removal** engineering slice **after** Owner ACCEPT of §11 — demonstrates target architecture (no Website Identity → special code) without implementing unsupported capabilities |
| **Empty map / POC HTZone helpers** | **Yes — may bundle** with that debt-removal slice |
| **Medium allowlist / legacy generic retirement** | **No — not required** before Acceptance Matrix; remain debt; 120.3.6-style conditional later |
| **Implement modal/pre-fill/multi-step/iframe/Shadow Managed** | **No — out of Phase 120** unless separately approved as generic designs |
| **120.3.3 representative live validation** | **Deferred** to Acceptance Matrix (unchanged) |

---

### 11.4 Remaining engineering work before final Phase 120 Acceptance Matrix

| # | Work | Authorization needed |
|---|---|---|
| 1 | Owner ACCEPT of §10.8 + §11 + D-120-11 | **DONE** (2026-09-22) |
| 2 | Manager DD + (later) Developer: **120.3.6** dedicated site-adapter legacy debt removal (§12 / §11.3 A) | **Manager DD AUTHORIZED now** |
| 3 | Regression: Managed contracts + no new site-specific code; orchestrator fail-closed | Within 120.3.6 impl (after DD PASS) |
| 4 | Optional **120.3.2** broader POC hygiene | Owner |
| 5 | **Do not** implement unsupported generic capabilities for Phase 120 close | Binding |
| 6 | **Final Phase 120 Acceptance Matrix** including deferred **120.3.3** | After engineering slices PASS |

---

### 11.5 Explicit non-goals (Phase 120)

- Implementing pre-fill / modal / multi-step / iframe / Shadow DOM Managed support  
- “Migrating” a named fixture onto Managed to preserve its unsupported experience  
- Expanding hostname allowlists  
- Treating legacy medium/adapter paths as target architecture  
- Exhaustive catalog migration (D-120-10)  
- 120.FSC (still reserved / not authorized)

---

## Architect Review
ARCHITECT_REVIEW_STATUS: **120.3.4 disposition CORRECTED (Owner clarification)**; **120.3.5 Generic Capability Boundary DEFINED**; **STOP for Owner review**; **no Developer work**

### Review Notes
2026-09-22 — Owner supersedes any reading that a named fixture must remain a supported architectural Autofill target. System models **generic** login capabilities only (D-120-11). 120.3.4 gap finding retained as **generic** knowledge; fixture itself is not a product requirement; Phase 120 must **not** implement the gap to preserve that site.

2026-09-22 — §11 records supported vs unsupported vs reserved capabilities; legacy debt inventory; removal A/B/C. **Recommend** Phase 120 debt-removal of dedicated site-adapter stack (§11.3 A) before Acceptance Matrix; **do not** remove legacy generic / medium yet; **do not** implement unsupported capabilities.

### Required Corrections
_Awaiting Owner ACCEPT of §10.8 + §11._

### Exact next step
**STOP.** Owner accept or correct §11. On ACCEPT → authorize Manager DD for legacy debt-removal engineering slice (§11.3 A / §11.4). **No Developer work until then.**

---

## 12. Slice 120.3.6 — Dedicated Site-Adapter Legacy Debt Removal

### Status
**AUTHORIZED — Manager Disposition / Detailed Design ONLY** (Owner 2026-09-22).  
**STOP after DD for Architecture review.** Developer implementation **NOT AUTHORIZED** until Architecture explicitly accepts the DD.

### Owner ACCEPT (prerequisite — COMPLETE)
| Item | Status |
|---|---|
| §10.8 corrected 120.3.4 disposition | **ACCEPTED** |
| §11 Generic Capability Boundary | **ACCEPTED** |
| **D-120-11** | **ACCEPTED** |

### Binding target architecture (reaffirmed)
```text
Supported experience:
  generic capability → configuration → validation → generic Managed runtime

Unsupported generic capability:
  → explicit unsupported state

Never:
  website/service identity → dedicated production Autofill implementation
```

Website identity must **never** select special Autofill production behavior.

### Goal
Remove **dedicated site-adapter legacy debt** (§11.3 A) from production reachability without replacing it with another site-specific path and without implementing new generic capabilities.

### In scope (retirement planning / DD)
- Dedicated site-adapter routing (`adapterId` site-specific set / registry entry for dedicated adapter)  
- Hub dedicated adapter execution path  
- Extension `POC_FILL_IL` dedicated path  
- Dedicated site script (e.g. `htzone-adapter.js`)  
- Dedicated hostname gate for that path  
- Empty legacy adapter map  
- Related dedicated/obsolete POC helpers **proven exclusively** owned by this retired path  

### Out of scope (hard)
- Managed Autofill behavior/contracts  
- Legacy generic retirement  
- Medium / identity-first implementation or retirement  
- LI complex / open-only  
- New modal/popup, pre-fill activation, multi-step, iframe, Shadow DOM capabilities  
- Health monitoring  
- 120.FSC  
- Final representative site validation (120.3.3 / Acceptance Matrix)  
- Replacement for the removed dedicated adapter  
- Making Managed imitate the retired site  
- Adding configuration solely to preserve that named fixture  

### Practice adapter note
**Practice** remains **out of primary retirement scope** unless Manager DD proves a specific artifact is exclusively part of the dedicated site-adapter debt being retired **and** Owner later expands scope. Default: leave practice DEV path untouched in 120.3.6.

---

### 12.1 Manager DD mandatory contents (AC-120.3.6-DD-*)

Manager DD in `team-Yuri/manager-phase120.md` (Slice 120.3.6) **MUST**:

| # | Requirement |
|---|---|
| 1 | Trace **every** code artifact planned for removal (Hub + extension + catalog routing + POC + tests/docs references as applicable) |
| 2 | Prove each artifact is **exclusively owned** by the dedicated legacy adapter path before deletion (or classify shared and protect it) |
| 3 | Identify **shared code that MUST NOT be removed** |
| 4 | Define the **target `executeServiceFromTile` decision tree** after removal |
| 5 | Ensure **no** replacement hostname / `serviceId` / site-specific Autofill logic is added |
| 6 | Define behavior when a former dedicated-adapter service remains in catalog but experience is **not** representable by current Managed: must **not** silently acquire special behavior — fall through to normal non-adapter paths (Managed if eligible; else LI/generic/open-only per existing tree) with **explicit** unsupported/open behavior as applicable |
| 7 | Preserve explicit **fail-closed / unsupported** behavior |
| 8 | Preserve **no auto-submit** |
| 9 | Preserve **no silent fallback after Managed selection** |
| 10 | Define **regression coverage** for Phase 117 / 118 / 119 / 120.2 Managed contracts |
| 11 | Define **build / type / test** requirements |
| 12 | Define **rollback** criteria |
| 13 | Include **repository search evidence plan** proving retired dedicated message types / scripts / routes have **no remaining reachable callers** after implementation |
| 14 | **Separate** deletion of proven dead/POC code from **behavior-changing** production retirement so evidence is reviewable (two evidence packages or clearly labeled phases inside the slice) |

### 12.2 Implementation authorization
| Item | Status |
|---|---|
| Manager DD 120.3.6 | **ARCHITECTURE PASS / ACCEPTED** (2026-09-22) |
| Developer implementation (**120.3.6-impl**) | **AUTHORIZED** — binding DD in `manager-phase120.md` Slice 120.3.6 |
| New generic capabilities | **FORBIDDEN** in this slice |

### 12.3 Exact next step
Developer implements per accepted DD → evidence (A/B, searches, regression) → Architecture review.

### 12.4 Architecture review — Slice 120.3.6 Manager DD

| §12.1 # | Requirement | Result | DD evidence |
|---|---|---|---|
| 1 | Artifact trace | **PASS** | §1 Package A/B tables |
| 2 | Exclusive-ownership proof | **PASS** | §2 + uncertain→protect rule |
| 3 | Shared code protect list | **PASS** | §3 |
| 4 | Target decision tree | **PASS** | §4 (practice-only site-adapter set) |
| 5 | No replacement site-specific Autofill | **PASS** | §5 |
| 6 | Non-representable former adapter → no silent special | **PASS** | §6 (UNSUPPORTED / normal fall-through) |
| 7 | Fail-closed / unsupported | **PASS** | §7 |
| 8 | No auto-submit | **PASS** | §8 |
| 9 | No silent Managed→legacy fallback | **PASS** | §9 |
| 10 | Regression 117/118/119/120.2 | **PASS** | §10 |
| 11 | Build/type/test | **PASS** | §11 |
| 12 | Rollback | **PASS** | §12 |
| 13 | Repo search evidence plan | **PASS** | §13 |
| 14 | Separate A vs B packages | **PASS** | Evidence packaging + §14 |

**Confirmations:**
| Check | Result |
|---|---|
| Practice untouched by default | **PASS** |
| No replacement adapter/capability | **PASS** |
| No Managed imitation | **PASS** |
| No fixture-preserving config | **PASS** |
| No Managed / legacy generic / medium retirement in this slice | **PASS** |

**Decision: ARCHITECTURE PASS / ACCEPTED.** No required corrections.

### 12.5 Architecture review — 120.3.6-impl (FINAL) — **PASS / CLOSED**

**Verified against actual repository + commits `a1d16e2` (A) / `f015baf` (B), not summary alone.**

| # | Check | Result |
|---|---|---|
| 1 | Package A dead/exclusive | **PASS** — empty map deleted; HTZone-only POC helpers deleted; practice/Shufersal/Clalit POC retained; no Digital Home routing edit |
| 2 | Package B complete dedicated production path removed | **PASS** — Hub adapter file gone; registry practice-only; catalog `adapterId` cleared; supportLevel htzone arm gone; Ext `POC_FILL_IL` + hostname gate + open/fill/retry/mocks + `htzone-adapter.js` + named host_permissions gone |
| 3 | No replacement hostname/serviceId/site Autofill | **PASS** — §13 ZERO in `src/`+`extension/` for retired symbols |
| 4 | Practice untouched | **PASS** — `practiceAdapter` / `POC_FILL_DEMO` / registry `practice` retained |
| 5 | Managed not modified to imitate retired adapter | **PASS** — no fixture Managed config; no site-special Managed branch |
| 6 | Managed fail-closed intact | **PASS** — Managed branch returns open_only + message on fail |
| 7 | Managed failure cannot silent-fall to legacy generic | **PASS** — explicit never-fall-through; fail returns before LI/generic |
| 8 | No auto-submit introduced | **PASS** — no submit added in A/B |
| 9 | Former dedicated config cannot select missing path | **PASS** — `isSiteSpecificAdapter('htzone')` false; seed `adapterId` cleared; DB migration clears live `adapter_id` |
| 10 | DB migration bounded | **PASS** — `adapter_id=null` where `id='htzone'` only; no Managed authoring |
| 11 | Regression/build/search evidence | **PASS** — retirement verify + 103/108/113/117/120.2-AP/ownership + `tsc -b` reported; Architect confirmed ZERO retired symbols in prod paths |
| 12 | Target tree matches DD §4 | **PASS** — see below |
| 13 | Reachable dedicated-site Autofill remaining? | **NONE** for retired dedicated stack |

#### Commit hygiene — Package B + prior Ext 120.2 work
`f015baf` also lands previously Architecture-authorized **§5D diagnostics** + **120.2-AP** `ADMIN_MANAGED_READINESS_PROBE` assess-only path in `extension/background.js`.

| Hygiene question | Finding |
|---|---|
| Previously Architecture-approved/accepted? | **Yes** — §5D authorized; 120.2-AP **CLOSED** |
| Separable from 120.3.6 retirement? | **Yes** — additive Managed authoring/diagnostics vs subtractive dedicated-adapter deletion |
| Unapproved behavior via mixed commit? | **No** — no replacement site Autofill; probe remains assess-only / no credentials |
| Invalidates Package B evidence? | **No** — Owner rule: do not reject solely for shared commit of previously accepted work |

#### Post-removal production decision tree (normative)
```text
Digital Home / executeServiceFromTile
  1. IF adapterId ∈ {practice} AND registered → practiceAdapter → STOP
  2. IF Managed claim/validated/eligible → Managed (fail-closed; NEVER generic)
  3–4. LI complex → open + unsupported
  5. LI medium → medium assist (legacy debt; unchanged)
  6. generic eligible (basic|unknown) → POC_GENERIC_FILL (legacy debt; unchanged)
  7. ELSE open_only / credentials_missing
```

Former dedicated-adapter seed (catalog row retained, `adapterId` cleared): enters steps 2–7 like any non-adapter service — **unsupported** for pre-fill/modal activation class; **no** dedicated fill.

#### Remaining legacy production Autofill debt (not target architecture)
| Debt | Notes |
|---|---|
| Practice adapter + `POC_FILL_DEMO` | DEV/demo — retained by design this slice |
| Legacy generic `POC_GENERIC_FILL` | Still reachable for non-Managed simple logins |
| Medium assist + host/serviceId allowlist | Unsupported multi-step class; legacy debt |
| LI complex → open-only | Explicit unsupported signaling — keep |

#### Next required ENGINEERING before Final Acceptance Matrix
**None mandatory** from 120.3.6 close.

Do **not** authorize new generic capability work.  
Do **not** auto-start Final Acceptance Matrix.  
Optional (packaging coherence, not a FAIL): land remaining Hub-side 120.2-AP working-tree artifacts consistently with Ext probe already in `f015baf`.  
Owner may next authorize **Phase 120 Final Acceptance Matrix** (includes deferred **120.3.3** representative evidence).

---

## Architect Review
ARCHITECT_REVIEW_STATUS: **120.3.6-impl PASS / ACCEPTED / CLOSED**; Final Acceptance Matrix **NOT AUTHORIZED**; no new capability work

### Review Notes
2026-09-22 — Verified Packages A/B against repository and commits. Dedicated site-adapter Autofill path fully retired. Practice retained. Managed contracts intact. Mixed-commit Ext 120.2-AP/§5D content provenance established — does not invalidate B.

### Required Corrections
None.

### Exact next step
**STOP.** Owner may authorize Final Acceptance Matrix when ready. No Developer capability work. No automatic Acceptance Matrix start.

---

## 13. Final Acceptance defect investigation — authoring vs Managed `unsafe_target` (2026-09-22)

### Status
**INVESTIGATION COMPLETE (read-only).** Final Phase 120 acceptance remains **OPEN / PENDING**.  
**No fix authorized.** Fixture used for evidence only (D-120-9 / D-120-11) — **not** architecture.

### Owner observation (genericized)
1. Analyze proposed mapping `fieldId` → CSS `#UserName` (id-based locator).  
2. Managed-parity activate rejected: `detail: unsafe_target`, same locator.  
3. Visual Mapping click on the visible username control independently produced **the same** `#UserName`.  
4. Therefore Analyze + Visual agree; Managed safety rejects.

---

### A–B. Why `unsafe_target` / exact condition

**Code path** (`extension/generic/validated-autofill.js`):

```text
querySelectorAll(locator) → exactly one node
→ GenericFillExecutor.isSafeFillTarget(element) === false
→ detail =
    type === 'hidden'     → hidden_target
    disabled || readOnly  → non_editable
    else                  → unsafe_target
```

**`isSafeFillTarget`** (`extension/generic/fill-executor.js`):

| Check | Fail → |
|---|---|
| `tagName !== 'INPUT'` | unsafe (not input) |
| `type === 'hidden'` \|\| `disabled` | (detail may say hidden/non_editable) |
| else `GenericFormDetector.isVisible(element)` | **false → `unsafe_target`** when not hidden/disabled/readOnly |

**Managed visibility** (`extension/generic/form-detector.js` `isVisible`):

| Condition that returns **false** |
|---|
| `disabled` |
| `type === 'hidden'` |
| `aria-hidden="true"` on element |
| ancestor `[aria-hidden="true"]` |
| computed `display:none` or `visibility:hidden` |
| `getClientRects().length === 0` |
| bounding rect `width < 2` or `height < 2` |

**Note:** Managed does **not** treat `opacity:0` alone as invisible. `readOnly` does **not** fail `isSafeFillTarget` (fill clears readOnly).

Given Owner saw `unsafe_target` (not `hidden_target` / `non_editable`), the selected node was:

- exactly one `#UserName` match,  
- an `INPUT` (or assess would still say unsafe if non-INPUT),  
- not `type=hidden`, not `disabled`, not `readOnly` at assess time,  
- and **`GenericFormDetector.isVisible` returned false**.

Most probable generic DOM causes (not site identity):

1. **`aria-hidden="true"` on the input or an ancestor** while the control still has non-zero layout and is human-clickable (common accessibility / overlay pattern).  
2. **Sub-2px** laid-out size (`0 < size < 2`) that Visual/Analyze still treat as visible.  
3. **`getClientRects().length === 0`** while `getBoundingClientRect()` still reports size (Visual/Analyze only use bounding rect).

Live DOM attribute dump was not captured in this investigation session; classification does **not** depend on naming the fixture.

---

### C. Can Visual Mapping emit a locator Managed can never accept?

**Yes — today.** Visual Mapping success does **not** call `GenericFillExecutor.isSafeFillTarget`.

Visual eligibility (`extension/generic/visual-target-pick.js` `isEligibleControl`):

- allows `input` **or** `textarea`;  
- own `isVisible` (display/visibility/opacity/bbox>0) — **no `aria-hidden`**, **no `<2px` rule**, **no `getClientRects`**;  
- rejects `readOnly`/`disabled`;  
- then picks exact-one CSS candidate (prefer `#id`).

So Visual can return `#UserName` for a control Managed later rejects as `unsafe_target`.

---

### D. Do Analyze / Visual use the same safety contract as Managed?

**No.**

| Layer | Visibility / eligibility source | Shared with Managed `isSafeFillTarget`? |
|---|---|---|
| Analyze inspect | `page-structure-inspect.js` `isVisible` (opacity:0 reject; bbox>0; **no aria-hidden**) | **No** |
| Analyze safety | `safetyValidation.isAllowedTarget`: `visible && editable && !disabled && !readOnly` using inspect flags | **No** (inherits inspect visibility) |
| Visual Mapping | `visual-target-pick.js` (same family as inspect visibility) | **No** |
| Managed-parity / Managed fill | `fill-executor.isSafeFillTarget` → `form-detector.isVisible` | **Yes (self)** |

Authoring and validation/runtime therefore use **two different visibility predicates**.

---

### E. Architectural classification

**2. Authoring / validation contract mismatch.**

Not (1) “genuinely unsafe and authoring correctly blocked” — authoring **accepted** the same target.  
Not primarily (3) false rejection alone without acknowledging authoring drift — Managed rule may be intentional (aria-hidden / min size), but shipping authoring that ignores it is the defect.  
Not (4) a new login-experience capability gap (modal/iframe/etc.) — this is **contract alignment** between existing authoring and existing Managed safety.

Site-specific mapping / hostname fixes are **forbidden** and unnecessary for disposition.

---

### F. Synthetic / non-site reproduction (generic)

Reproducible in principle with a synthetic Login Entry fixture (no named bank required), e.g.:

```html
<div aria-hidden="true">
  <input id="UserName" type="text" style="width:120px;height:24px" />
</div>
```

Expected under **current** code:

| Step | Expected |
|---|---|
| Analyze inspect | May list input with `visible: true` (no aria-hidden check) |
| Visual click | May accept + return `#UserName` |
| Managed-parity / `assessManagedTargetsReady` | `targets_not_ready` + `detail: unsafe_target` |

Alternate synthetic: `width:1px;height:1px` visible input with id — Visual/Analyze may accept; Managed rejects (`< 2`).

*(Fixture not executed in this Architecture session; expected from code paths above.)*

---

### Smallest generic correction proposal (NOT authorized to implement yet)

**Goal:** Authoring must not successfully emit (or must not allow Admin to treat as ready) a locator that Managed readiness will reject — **without** weakening Managed safety.

| Option | Intent |
|---|---|
| **Preferred** | Unify Analyze inspect + Visual Mapping eligibility to call the **same** `isSafeFillTarget` / shared Managed `isVisible` (or extract one shared module used by inspect, visual-pick, and fill-executor). Reject at authoring time with an honest reason. |
| **Diagnostic only (optional companion)** | Enrich `unsafe_target` with a non-secret sub-detail (`aria_hidden` / `zero_rects` / `too_small` / `not_input`) for Admin clarity — still fail-closed. |
| **Forbidden** | Relax Managed `isVisible`; hostname/`serviceId` exceptions; bypass parity gate; invent permissive selectors; stamp `validated` despite failure |

**Out of scope for this correction:** implementing modal/pre-fill capabilities; site migration; weakening exactly-one.

---

### Acceptance impact
Final Phase 120 acceptance remains **OPEN / PENDING** until Owner accepts this disposition and authorizes a numbered correction slice (Manager DD → Developer).

### 13.1 Owner ACCEPT (COMPLETE — 2026-09-22)
| Item | Status |
|---|---|
| §13 investigation | **ACCEPTED** |
| Classification AUTHORING / VALIDATION CONTRACT MISMATCH | **BINDING** |
| Corrective slice | **120.4** — Manager DD authorized (§14) |

**Target invariant (Owner):** Any target accepted/generated by an authoring mechanism for Managed Autofill must satisfy the same relevant target-safety eligibility contract that Managed-parity/runtime will enforce. Analyze, Visual Mapping, Managed-parity validation, and Managed runtime fill must not disagree due to incompatible visibility/safety definitions.

---

## 14. Slice 120.4 — Unify Managed Target-Safety Eligibility (authoring ↔ runtime)

### Status
**AUTHORIZED — Manager Detailed Design ONLY** (Owner 2026-09-22).  
**STOP after DD for Architecture review.** Developer **NOT AUTHORIZED** until Architecture PASS on DD.

### Purpose
Smallest **generic** correction so Analyze, Visual Mapping, Managed-parity, and Managed runtime share one Managed target-safety eligibility contract — eliminating §13 mismatch **without** weakening Managed safety.

### Binding invariant
```text
Authoring accept/generate target
  ≡ eligible under Managed target-safety contract
  ≡ Managed-parity / Managed fill accept that target
```

Disagreement caused by incompatible visibility/safety definitions is a **defect**.

### Hard stops (slice)
| Forbidden | |
|---|---|
| Weaken `isSafeFillTarget` / Managed `isVisible` reject conditions | STOP |
| Make `aria-hidden` (or other currently rejected conditions) fillable to pass a fixture | STOP |
| Manually change fixture locator / site-specific selectors | STOP |
| Hostname / `serviceId` / named-site exceptions | STOP |
| Bypass Managed-parity activate gate | STOP |
| Unrelated capability work (modal/pre-fill/multi-step/iframe/Shadow) | STOP |
| Stamp `validated` despite readiness failure | STOP |
| Developer implementation before DD PASS | STOP |

Named live fixtures may be **retested only as acceptance evidence** after correction — **not** design targets (D-120-9 / D-120-11).

---

### 14.1 Manager DD mandatory contents (AC-120.4-DD-*)

Manager DD in `team-Yuri/manager-phase120.md` (Slice 120.4) **MUST** define:

| # | Requirement |
|---|---|
| 1 | **One authoritative** Managed Autofill target-safety contract (normative rules = current Managed `isSafeFillTarget` + Managed visibility semantics — do not weaken) |
| 2 | How **Analyze** inspection / proposal safety uses that contract |
| 3 | How **Visual Mapping** target capture uses that contract |
| 4 | How **Managed-parity** and **runtime fill** continue using the same contract |
| 5 | Whether implementation shares **one reusable function/module** (or equivalent synced contract) across extension contexts |
| 6 | Exact behavior when Admin **clicks** a visually selectable but Managed-**ineligible** element: no approvable mapping; clear **generic** reason; **no** silent substitute DOM target |
| 7 | **Analyze** behavior when a proposed target is Managed-ineligible: must **not** become accepted/prefilled Managed mapping |
| 8 | Preserve **fail-closed** |
| 9 | Preserve **exact-one** target requirement |
| 10 | Preserve **no auto-submit** |
| 11 | Preserve **origin / top-document / security** boundaries |
| 12 | **No** hostname/`serviceId`/site-specific exceptions |
| 13 | **Regression coverage** for: normal visible input; aria-hidden self; aria-hidden ancestor; hidden/display-none/visibility-hidden; zero-client-rect; sub-2px; disabled/readOnly/hidden input; existing delayed-input readiness; Phase 117 Managed fill; Phase 118 Analyze; Phase 119 Visual Mapping; Phase 120.2 Managed-parity activation |
| 14 | **Synthetic reproduction** proving original mismatch eliminated **without** relying on the named live site |
| 15 | Optional `unsafe_target` diagnostic sub-detail — may propose; **no** credential/page values; omit if it unnecessarily expands scope |

### 14.2 Implementation authorization
| Item | Status |
|---|---|
| Manager DD 120.4 (first draft) | **FAIL** (§14.4) — superseded |
| Manager DD 120.4 **REVISED** | **PASS / ACCEPTED** (§14.5) |
| Developer 120.4-impl | **ACCEPTED / CLOSED** (§14.6) |
| Live Owner acceptance retest | **AUTHORIZED** |
| Final Phase 120 Acceptance | **OPEN / PENDING** |

### 14.3 Exact next step
Owner live acceptance retest (optional evidence). Final Acceptance remains OPEN/PENDING.

### 14.4 Architecture review — Slice 120.4 Manager DD (2026-09-22) — **FAIL**

#### A. Safety-unification (§14.1) — largely OK
| Check | Result |
|---|---|
| Authoritative contract = current Managed `isSafeFillTarget` / `isVisible` | **PASS** (§1) — not weakened; aria-hidden remains ineligible |
| Analyze / Visual / parity / runtime align to that contract | **PASS** direction (§2–4) |
| Shared module preferred; no drifted copy | **PASS** (§5 A/B; C forbidden) |
| Contract-parity tests if dual impl | **PARTIAL** — require explicit parity-test gate for any non-single-module path (§5 B) |
| No site exceptions / no parity bypass / no silent substitute | **PASS** (§6, §12) |
| Exact-one / fail-closed / no auto-submit / origin-top-doc | **PASS** (§8–11) |
| Regression + synthetic without named site | **PASS** as safety-agreement matrix (§13–14) — **insufficient** for identification state (below) |
| Optional unsafe_target sub-detail | **PASS** (optional/bounded) |

#### B. Identification ≠ Managed eligibility (Owner clarification) — **FAIL**
Owner live evidence: Analyze and Visual correctly identified `#UserName`; Managed correctly rejected `unsafe_target`. Semantic identification may be **correct** while Managed eligibility fails.

**Binding distinction (now Architecture-normative for 120.4):**

| Concern | Question |
|---|---|
| **SEMANTIC IDENTIFICATION** | Which page control corresponds to the credential field? |
| **MANAGED ELIGIBILITY** | Is that identified DOM target safe/eligible for deterministic Managed Autofill under the authoritative safety contract? |

A target may be: correctly identified; correctly human-clicked; **and still Managed-ineligible**.

**120.4 MUST NOT** solve the mismatch by pretending such a field was never identified.

#### C. Required state model — **MISSING / UNDER-SPECIFIED in DD**
DD must represent (names flexible) at least:

| State | Meaning |
|---|---|
| **NOT_IDENTIFIED** | No reliable semantic target |
| **IDENTIFIED_AND_MANAGED_ELIGIBLE** | Identified **and** passes Managed safety → only this may become approvable/prefilled Managed mapping |
| **IDENTIFIED_BUT_MANAGED_INELIGIBLE** | Identified, fails Managed safety → **must not** collapse into NOT_IDENTIFIED |

#### D. Where the current DD fails this requirement
| DD location | Problem |
|---|---|
| §2 “Prefer: omit from mappable set entirely” | Risks collapsing **IDENTIFIED_BUT_MANAGED_INELIGIBLE** into “not identified / not found” |
| §2 inspect: report `visible` only when Managed `isVisible` | Conflates observation/identification signals with Managed eligibility; may erase useful identification of Managed-ineligible controls |
| §7 / Fixture A Analyze expectation | Specifies “must not accept as Managed mapping” but **does not require** preserving identification as a distinct ineligible result |
| No explicit result model | States #1 vs #3 not separated |

Visual §6 (`managed_ineligible`, no substitute) is **closer** to correct for clicks, but must not be framed as “target not found,” and Analyze must match the three-state discipline.

#### E. Exact required DD corrections (Manager revise — then re-review)
1. Record **SEMANTIC IDENTIFICATION ≠ MANAGED ELIGIBILITY** as binding.  
2. Define a **generic result/state model** with at least the three outcomes above (exact names free). State #3 must not collapse into #1.  
3. **Analyze:** if semantic evidence identifies a control that fails Managed eligibility → **preserve** identification; **do not** approvable/prefill Managed mapping; **do not** misreport as merely “field not found” / NOT_IDENTIFIED; expose generic **identified but not eligible for Managed Autofill**.  
4. Remove “prefer omit entirely” as the default that hides #3; omission alone is insufficient unless a parallel identified-ineligible channel exists.  
5. **Visual:** human click on real but Managed-ineligible control → recognize selection; **no** approvable mapping; return **Managed eligibility** failure (not “not found”); no silent substitute; no safety weaken.  
6. Inspect/Hub payloads: separate **identification/observation** facts from **`managedEligible`** (or equivalent) — do not force Managed `isVisible` to be the only way a control can be “seen” for semantic mapping.  
7. Synthetic Fixture A + regression: assert Analyze yields **IDENTIFIED_BUT_MANAGED_INELIGIBLE** (or equivalent), Visual yields eligibility reject after click, parity still `unsafe_target` — **agreement on eligibility**, not erasure of identification.  
8. If implementation is not a single shared module: **mandatory contract-parity tests** proving identical Managed eligibility decisions across Analyze / Visual / parity / runtime for the synthetic matrix.

#### F. Decision (first review)
**FAIL.** Do **not** authorize 120.4-impl.  
Safety-unification intent is accepted in principle; DD must be revised for identification-vs-eligibility before PASS.

### 14.5 Architecture re-review — revised 120.4 DD (2026-09-22) — **PASS**

| Owner / §14.4 check | Result |
|---|---|
| E.1 SEMANTIC IDENTIFICATION ≠ MANAGED ELIGIBILITY | **PASS** — I2 binding |
| E.2 Three-state model NOT_IDENTIFIED / IDENTIFIED_AND_MANAGED_ELIGIBLE / IDENTIFIED_BUT_MANAGED_INELIGIBLE | **PASS** — I3 |
| E.3 #3 never collapses into #1 | **PASS** — hard stop + I3 |
| E.4 Analyze preserves ID when Managed-ineligible; no approvable/prefill; not “not found” | **PASS** — §2 / §7 |
| E.5 Visual recognizes click; eligibility reject; no substitute | **PASS** — §3 / §6 |
| E.6 Observation ≠ `managedEligible` | **PASS** — §1A |
| E.7 Fixture A asserts IDENTIFIED_BUT_MANAGED_INELIGIBLE | **PASS** — §14 |
| E.8 Shared module preferred; else mandatory contract-parity tests | **PASS** — §5 / 5B |
| Managed `isSafeFillTarget`/`isVisible` authoritative; not weakened; aria-hidden ineligible | **PASS** — §1 |
| No site exceptions; no parity bypass; exact-one; fail-closed; no auto-submit; no unrelated capability | **PASS** — §8–12 / out of scope |

**How DD represents IDENTIFIED_BUT_MANAGED_INELIGIBLE:** I3 state #3; Analyze §2 preserves candidate + locator + generic “identified but not eligible for Managed Autofill”; Visual §3/§6 returns Managed eligibility failure after recognized click; Hub approvability gated only on state #2 / `managedEligible === true`.

**Decision: ARCHITECTURE PASS / ACCEPTED.**  
**120.4-impl AUTHORIZED** — Developer implements per revised DD only.

### 14.6 Architecture review — 120.4-impl (FINAL) — **PASS / CLOSED**

**Verified against actual code + `verifyPhase120ManagedEligibility.mjs` (Architect re-ran → PASS), not summary alone.**

| # | Check | Result |
|---|---|---|
| 1 | Shared module authoritative on all paths | **PASS** — `managed-target-eligibility.js`; fill-executor / form-detector delegate; inspect/visual call shared; `background.js` `managed` inject lists module first |
| 2 | Managed semantics not weakened | **PASS** — V1–V7 / S1–S5 intact; opacity:0 and readOnly alone still non-rejects |
| 3 | aria-hidden self/ancestor ineligible | **PASS** — shared + Fixture A `aria_hidden` |
| 4 | hidden/disabled/unsafe rejects intact | **PASS** — validated-autofill detail path + matrix R7/R8/R6 |
| 5 | Analyze preserves #3; no HIGH/prefill | **PASS** — `identifiedButManagedIneligible` channel; `isManagedApprovableTarget` requires `managedEligible`; prefill empty on Fixture A |
| 6 | Visual click → `managed_ineligible`; no substitute | **PASS** — identify then eligibility; returns #3 + detail; Hub maps reason |
| 7 | #3 cannot collapse to NOT_IDENTIFIED | **PASS** — parallel channel; Visual Hub state; hard-stop in DD honored in code |
| 8 | Parity/runtime same contract | **PASS** — `isSafeFillTarget` → shared via fill-executor; assess uses executor |
| 9 | Fixture A eliminates mismatch without named site | **PASS** — synthetic HTML; Analyze #3; Visual ineligible; parity/runtime `unsafe_target` |
| 10 | R1–R14 / regressions | **PASS** — eligibility script + 117/118/119/120.2-AP verifies (Dev + Architect eligibility re-run) |
| 11 | No site exceptions | **PASS** — static assert; no hostname Autofill in shared/safety |
| 12 | No parity bypass / auto-submit / unrelated capability / safety relaxation | **PASS** |

**Decision: 120.4-impl ACCEPTED / CLOSED.**  
**Live Owner acceptance retest AUTHORIZED** (evidence only).  
**Phase 120 Final Acceptance remains OPEN / PENDING.** Do **not** close Phase 120.

---

## 15. Slice 120.5 — Admin Managed Autofill Test Harness

### Status
**120.5-impl ACCEPTED / CLOSED.** LIVE OWNER ACCEPTANCE TEST **AUTHORIZED.**  
**Not** part of 120.4. Final Phase 120 Acceptance remains **OPEN / PENDING**. Phase 120 **NOT closed**.

### Title
Admin Managed Autofill Test Harness (optional diagnostic)

### Purpose
Admin-only tool to exercise a **saved** Managed mapping on the real Login Entry using **temporary Admin test values**, **before or after** mapping approval — for visual inspection and mapping iteration.

**Not** an approval requirement. **Not** an activation gate. **Not** a Digital Home path.

### Binding decisions
| ID | Decision |
|---|---|
| **D-120-12** | One Managed Autofill execution path — Admin Test and Digital Home share fill/safety/exact-one/readiness; only **value source** differs |
| **D-120-13** | Admin may test **saved candidate** mappings; Digital Home production eligibility/validation **unchanged** and **not** bypassed |

Phase **120.4** remains binding (authoritative Managed target-safety; identification ≠ eligibility).

---

### 15.1 System flow

```text
Admin Autofill Profile Editor
  → Managed mapping SAVED (candidate or validated — both OK)
  → Test section renders one input per current credential-schema fieldId
  → Admin enters temporary test values (session memory only)
  → All fields non-empty → enable «כניסה לאתר ומילוי שדות»
  → Admin click
       → Hub Admin-only gate (auth + saved mapping present + all values)
       → Build Managed payload from:
            Login Entry URL + allowedOrigin
            + SAVED fieldMappings (candidate OK)
            + temporary Admin credentials (not vault)
       → ★ CONVERGENCE ★ same Managed execution as Digital Home:
            HUB_MANAGED_AUTOFILL
            → open Login Entry / origin check / top document
            → assessManagedTargetsReady (same isSafeFillTarget)
            → runManagedAutofill / verify
            → structured result (no auto-submit)
  → Admin UI shows structured result (no secret values)
  → Temp values remain in UI memory (retention B) until page/session recreate
  → supportState / validation metadata / production credentials UNCHANGED
```

Digital Home remains:

```text
Digital Home tile
  → production eligibility (validated + version match + vault credentials + …)
  → ★ same Managed execution ★
```

---

### 15.2 Convergence boundary (prove: not two engines)

| Layer | Digital Home | Admin Test Harness |
|---|---|---|
| **Value source** | Vault / Digital Home credentials | Temporary Admin test values (memory) |
| **Mapping source** | Production-eligible Managed profile | **Saved** profile mappings (candidate **or** validated) |
| **Hub eligibility gate** | Existing Managed production contract | **Admin-only** gate: saved mappings + complete temp values + Login Entry — **explicitly not** “validated required” |
| **Extension message** | `HUB_MANAGED_AUTOFILL` | **Same** `HUB_MANAGED_AUTOFILL` |
| **Payload shape** | url, allowedOrigin, fieldMappings, credentials | **Same shape** |
| **Target resolution / exact-one / readiness / safety / fill / verify** | Managed runtime | **Identical** — no test-only branch in assess/fill |
| **Auto-submit** | Forbidden | Forbidden |

**Convergence point (normative):** Once the Managed payload `{ url, allowedOrigin, fieldMappings, credentials }` is constructed, execution **must** enter the **same** extension Managed orchestrator used by Digital Home (`openPageAndManagedAutofill` → `assessManagedTargetsReady` → `runManagedAutofill`). Prefer a shared Hub helper that both Digital Home and Admin Test call for “send Managed payload and await structured result.”

**Forbidden divergence:** separate test fill algorithm; weaker `isSafeFillTarget`; different selector interpretation; bypass exact-one; test-only origin/top-document relaxation; `ADMIN_*_FILL` that reimplements fill.

If an `executionContext: 'admin_test'` flag is needed for Hub telemetry or concurrency keys, the **extension fill path must ignore it for safety/fill semantics** (or omit the flag from the extension entirely).

---

### 15.3 Trust / security boundaries

| Boundary | Rule |
|---|---|
| Authorization | **Admin-only** UI + Admin-authenticated Hub path |
| Temp values | Sensitive credential material while in memory/transit |
| Persistence | **None** — not DB, not localStorage/sessionStorage, not cookies |
| AI/LLM | **Never** send test values or mapping payload to Analyze/LLM |
| Logs / telemetry / errors | **No** test values, no vault secrets; fieldId/detail/locator/reason only |
| Extension | Same Managed security: origin, top-document, fail-closed |
| Digital Home | Unchanged production gate — **cannot** use unvalidated mappings via this feature |

---

### 15.4 Temporary value lifecycle (Owner retention B)

| Event | Behavior |
|---|---|
| Enter values in Admin UI | Held in **page/component memory** only |
| After test run | Values **remain** for convenient repeat |
| Refresh / navigate away / close / remount editor | Values **cleared** |
| Password-type schema fields | Masked input (`type=password` or equivalent) |
| Save mapping / activate / other persist | Must **not** write temp values |

---

### 15.5 Dynamic schema-driven UI contract

| Rule | Binding |
|---|---|
| Render | One editable test field per **current** service credential schema `fieldId` |
| Labels | From schema labels when available; identity = `fieldId` |
| No fixed vocabulary | No hard-coded username/password/business_id assumptions |
| Schema change | UI fields follow current schema dynamically |
| Button «כניסה לאתר ומילוי שדות» | Enabled **iff** every schema field has non-empty trimmed temp value |
| Partial fill | **Forbidden** via this tool |

Availability: shown when a Managed mapping is **saved** (has persisted fieldMappings / profile structural save) — **independent** of `supportState === 'validated'`. Also available after approval for diagnostics.

Unsaved editor drafts: **out of scope** for execution (test uses **saved** mapping only). Manager DD may clarify UX when dirty vs saved diverge (e.g. disable test until save).

---

### 15.6 Saved candidate mapping test contract (D-120-13)

| Actor | May use saved unvalidated mapping? |
|---|---|
| **Admin Test Harness** | **Yes** — explicit Admin diagnostic of **candidate** configuration |
| **Digital Home Managed Autofill** | **No** — existing production eligibility/validation required |

**Narrow Admin-only mechanism (normative):**

1. Hub entrypoint distinct from Digital Home tile execution (e.g. `executeAdminManagedAutofillTest`).  
2. Preconditions: Admin authorization; Login Entry + allowedOrigin present; **saved** `fieldMappings` structurally present (CSS locators); **all** schema fieldIds have non-empty temp values.  
3. Does **not** require `supportState=validated` or version-matched validation evidence.  
4. Does **not** call `activate_validated`, does **not** write `supportState`, validation metadata, or credentials.  
5. Builds the **same** Managed payload and enters ★ convergence ★.  
6. Failures use the **same** Managed structured reasons (including `unsafe_target` / Managed-ineligible).

**Proof of non-weakening:** A mapping that is IDENTIFIED_BUT_MANAGED_INELIGIBLE / would fail Managed-parity still fails Admin Test the same way — harness is **not** a workaround for unsafe targets.

---

### 15.7 Structured result contract

Admin UI must surface generic outcomes aligned with existing Managed results, e.g.:

| Class | Examples (non-exhaustive) |
|---|---|
| Success | Fill verified OK; page left for manual submit |
| Not ready / missing | `targets_not_ready` + `zero_match` |
| Multiple matches | `multi_match` |
| Non-editable / hidden | `non_editable` / `hidden_target` |
| Managed-ineligible / unsafe | `unsafe_target` (+ optional 120.4 sub-detail) |
| Origin / navigation | `wrong_origin`, `no_tab`, load errors |
| Extension / busy / other | Existing Managed structured failures |

**Forbidden in results:** temp values, vault values, named-site branching, AI content.

---

### 15.8 Failure behavior

| Case | Behavior |
|---|---|
| Incomplete temp values | Button disabled; no execution |
| No saved mapping | Tool unavailable / disabled |
| Managed safety fail | Fail-closed structured result; no auto-submit; no approve |
| Extension unavailable | Honest failure; optional open Login Entry without fill only if consistent with existing Managed patterns — Manager DD specifies without inventing weaker fill |
| Concurrent tests | Fail-closed or busy — do not corrupt in-flight Digital Home keys; prefer Admin-scoped execution key distinct from `(serviceId, accessProfileId)` vault path |

---

### 15.9 Non-functional / genericity (D-120-9 / D-120-11)

- Works from: credential schema + saved Managed mapping + Login Entry + temp values.  
- New simple service/schema → **no** Managed runtime code change.  
- Named websites = fixtures only.  
- No hostname/`serviceId` Autofill branches; no dedicated adapters.

---

### 15.10 Regression requirements (when implemented)

| Area | Requirement |
|---|---|
| Convergence | Admin Test and Digital Home both hit same extension Managed assess/fill (static/call-graph or shared helper evidence) |
| Safety | aria-hidden / exact-one / origin / top-document unchanged vs 120.4 |
| Separation | Digital Home still rejects unvalidated; Admin Test can run on saved candidate without stamping validated |
| No side effects | After test: supportState, validation metadata, vault credentials unchanged |
| Temp lifecycle | No persistence; cleared on remount; password fields masked |
| Schema dynamic | N-field schema renders N inputs; button gate = all filled |
| Results | Structured reasons without secrets |
| Regress | Phase 117 Managed fill; 120.2-AP activate; 120.4 eligibility states |

---

### 15.11 Acceptance criteria (AC-120.5-*)

| ID | Criterion |
|---|---|
| AC-120.5-1 | Test section available for **saved** Managed mapping without requiring validated |
| AC-120.5-2 | Schema-dynamic temp inputs; no fixed field-name assumptions |
| AC-120.5-3 | Button enabled only when all schema fields have non-empty temp values |
| AC-120.5-4 | Test uses same Managed execution path as Digital Home after payload construction (D-120-12) |
| AC-120.5-5 | Admin may test saved candidate; Digital Home production gate unchanged (D-120-13) |
| AC-120.5-6 | Test does not approve, activate, stamp validation, or modify production credentials |
| AC-120.5-7 | Temp values: memory-only; retention B; no storage/DB/LLM/logs |
| AC-120.5-8 | Password-type fields masked in UI |
| AC-120.5-9 | No auto-submit |
| AC-120.5-10 | Managed safety identical (incl. unsafe_target / Managed-ineligible) |
| AC-120.5-11 | Structured result without secret values |
| AC-120.5-12 | No hostname/serviceId/site-specific Autofill behavior |
| AC-120.5-13 | 120.4 contracts preserved |

---

### 15.12 Out of scope
- Making Admin Test an approval/activation requirement  
- Weakening Managed safety or Digital Home eligibility  
- Persisting test values  
- Partial-schema fills  
- Second fill engine / test-only selectors  
- Unrelated capabilities (modal/pre-fill/multi-step/iframe/Shadow)  
- Closing Final Phase 120 Acceptance  

---

### 15.13 Implementation authorization
| Item | Status |
|---|---|
| Architecture §15 | **ACCEPTED** (binding) |
| Manager DD 120.5 | **Architecture PASS** — binding DD: `team-Yuri/manager-phase120.md` **Slice 120.5** |
| Developer 120.5-impl | **ACCEPTED / CLOSED** — evidence: `team-Yuri/dev-phase120.md` Slice 120.5-impl |
| LIVE OWNER ACCEPTANCE TEST | **AUTHORIZED** |
| Final Phase 120 Acceptance | **OPEN / PENDING** |
| Phase 120 | **NOT closed** |
| Phase 120.4 | **CLOSED** (unchanged) |

---

## Architect Review
ARCHITECT_REVIEW_STATUS: **120.5-impl PASS / ACCEPTED / CLOSED**; LIVE OWNER ACCEPTANCE TEST **AUTHORIZED**; Final Acceptance **OPEN/PENDING**; Phase 120 **NOT closed**; **120.4 CLOSED** (unchanged)

### Review Notes
2026-09-22 — Evidence review of 120.5-impl against §15 / DD Slice 120.5 / AC-120.5-1…13.

**D-120-12:** `executeManagedAutofill` and `executeAdminManagedAutofillTest` both call `sendManagedAutofillPayloadAndAwait` → `buildManagedAutofillPayload` (`type: HUB_MANAGED_AUTOFILL`, url/allowedOrigin/fieldMappings/credentials). Ext `background.js` routes to `openPageAndManagedAutofill` → assess/fill; **no** `admin_test` / Admin-only fill branch. Admin execution key `serviceId::admin_test` is concurrency-only.

**D-120-13:** Admin entry omits `serviceIsManagedAutofillEligible` / supportState. DH gate `isManagedAutofillEligible` still requires version-matched validated. `serviceExecution.ts` does not call Admin harness. Candidate runtime reaches shared send; DH rejects non-validated.

**Side effects:** `requestManagedTest` / Admin entry — no registry write, approve, supportState, validation stamp, vault mutate.

**Temps:** `useState` only; clear on `row.id`/`updated_at`; no localStorage/sessionStorage; password `type=password`; summary/logs omit credential values; DEV hub log uses fieldIds only.

**Dirty/saved:** `!hasUnsavedChanges` + payload=`existing` saved profile; Hebrew dirty warning; schema-dynamic `fields.map`; button gated on `allTempValuesFilled`.

**120.4:** Fixture A → `unsafe_target` preserved; verify scripts re-run PASS.

**Re-run:** `verifyPhase120AdminManagedTestHarness.mjs` PASS; `verifyPhase120ManagedEligibility.mjs` PASS.

### Required Corrections
_None._

### Exact next step
**LIVE OWNER ACCEPTANCE TEST** of Admin Managed Autofill Test Harness. Final Phase 120 Acceptance remains **OPEN / PENDING**. Do **not** close Phase 120.

---

## 16. Live Final Acceptance — `#UserName` `unsafe_target` exact-predicate investigation (2026-09-22)

### Status
**INVESTIGATION COMPLETE.** Exact live predicate **CONFIRMED**.  
**FINAL classification: B** (ancestor `aria-hidden` absolute reject is generically over-restrictive for Managed Autofill).  
**No implementation yet.** No site-specific fix. No approval bypass.  
Final Phase 120 Acceptance remains **OPEN / PENDING**.  
120.4 / 120.5 remain **CLOSED** until Owner authorizes a follow-on safety-contract slice (Manager DD required).

### Binding live evidence (Owner diagnostic)
```json
{
  "ok": true,
  "unsafe_target": { "reason": "aria_hidden_ancestor" },
  "target": {
    "tagName": "INPUT",
    "type": "text",
    "disabled": false,
    "readOnly": false,
    "ariaHiddenSelf": null,
    "display": "block",
    "visibility": "visible",
    "opacity": "1",
    "clientRects": 1,
    "width": 313.48,
    "height": 30
  },
  "ariaHiddenAncestor": {
    "tagName": "DIV",
    "id": "content",
    "role": "document",
    "classSample": "ng-scope"
  }
}
```

**Exact rejection chain (current contract):**
```text
#UserName
  → closest [aria-hidden="true"] = DIV#content[role=document]
  → Managed isVisible V4 false
  → isSafeFillTarget false
  → assess detail unsafe_target
```

Target itself is **not** hidden/disabled/readOnly/display-none/visibility-hidden/zero-rects/sub-2px. Layout and CSS visibility are present.

Named attributes (`#content`, `role=document`, `ng-scope`, hostname, `#UserName`) are **evidence only** — not architecture (D-120-9 / D-120-11).

### Prior Owner observations (still valid)
Analyze / Visual IDENTIFIED_BUT_MANAGED_INELIGIBLE / Admin Test / Managed-parity all agree on eligibility reject. Convergence expected (D-120-12 / 120.4). **Not** a harness defect. Digital Home must remain blocked until a **generic** contract change (if Owner authorizes) lands and mapping re-validates.

---

### 16.1 Browser / DOM semantics of ancestor `aria-hidden="true"`

Per ARIA, `aria-hidden="true"` means the element (and its descendants) are **not exposed in the accessibility tree**. It is an **AT exposure** directive.

It does **not**, by itself, mean:
- CSS `display`/`visibility` hide;
- zero layout / no client rects;
- `disabled` / non-editable;
- inability to receive focus, click, or programmatic `value` assignment;
- that the control is a honeypot.

W3C guidance: authors **should not** place focusable content inside `aria-hidden` subtrees. When they do, the DOM remains interactively fillable while AT excludes the tree — an authoring conflict, not a browser “input is unsafe” signal.

### 16.2 Four distinct axes (must not be conflated)

| Axis | What it measures | Live target |
|---|---|---|
| **Accessibility-tree visibility** | Exposed to AT (`aria-hidden` removes) | Excluded via **ancestor** |
| **CSS / layout visibility** | display, visibility, rects, size | **Present** (block/visible/1 rect / ~313×30) |
| **Editability / interactivity** | INPUT, not disabled, not type=hidden | **Editable** |
| **Managed Autofill suitability** | Deterministic safe programmatic fill | Currently rejected **only** by V4 |

**Conclusion:** Current V4 treats axis 1 as sufficient to fail axis 4. That conflation is the defect under classification **B**.

Human clickability alone is **not** the proof of B. The proof is the **semantic mismatch** between ARIA AT-exclusion and DOM/CSS/editability, confirmed by live properties that already pass every other Managed deterministic check.

### 16.3 FINAL classification: **B**

**B — FALSE REJECTION IN THE GENERIC MANAGED VISIBILITY CONTRACT (ancestor rule only)**

Absolute rejection for **any** `aria-hidden="true"` **ancestor** is generically over-restrictive for Managed Autofill: ancestor ARIA accessibility-tree exclusion is **not** equivalent to CSS/layout invisibility or non-editability, and is **not** by itself reliable evidence that a descendant INPUT is an unsafe deterministic fill target.

| Sub-rule | Classification | Remains binding? |
|---|---|---|
| **`aria-hidden` SELF** on the INPUT | **A** (genuine Autofill-unsuitable signal — decoy / AT-hidden control) | **YES — keep absolute reject** |
| **`aria-hidden` ANCESTOR** absolute reject (V4) | **B** | **NO — must not remain absolute** |

**Not C:** No missing capability (iframe/Shadow/modal pre-fill). Exact-one CSS locator resolves; fill would be ordinary INPUT value set.  
**Not A for ancestor:** Live node passes all non-ARIA Managed predicates; ARIA ancestor alone caused reject.  
**Not D:** Evidence fits B cleanly once self vs ancestor are split.

### 16.4 Security vs accessibility (separate)

| Concern | Assessment |
|---|---|
| **Accessibility** | Autofill does not repair site ARIA. Filling a DOM-visible control whose ancestor is incorrectly `aria-hidden` does not make ARIA “correct”; it also does not require Autofill to treat AT exclusion as fill prohibition. |
| **Security / wrong-target risk** | Real risk class: **inactive background** under modal/overlay — main tree marked `aria-hidden` while overlay is active; background INPUTs may still have layout. Absolute V4 was a blunt proxy for that. Removing V4 **without** a replacement interactivity signal could allow filling background fields. |
| **Honeypot** | Better covered by **self** `aria-hidden`, `type=hidden`, zero rects, CSS hide — not by “any ancestor.” |

Therefore: **B does not authorize “delete V4 and ship.”** B authorizes removing V4 as an **absolute** criterion and replacing ancestor-only ARIA with a **generic interactivity / hit-test** fail-closed signal (below).

### 16.5 Smallest generic correction (Architecture proposal — NOT authorized to implement yet)

**Normative intent (if Owner accepts):**

1. **Keep** absolute reject: `aria-hidden="true"` on the **target itself** (V3).  
2. **Remove** absolute reject: ancestor `[aria-hidden="true"]` alone (V4).  
3. **Add** generic fail-closed **hit-test** (interactive reachability), e.g. at the center of the target’s bounding rect, `document.elementFromPoint(x,y)` must resolve to the target or a relationship that still indicates the target is the topmost interactive control (exact algorithm in Manager DD — no hostname logic).  
4. **Keep** unchanged: exact-one, origin, top-document, type=hidden, disabled, display/visibility, clientRects, min dimensions, no auto-submit, readiness fail-closed.  
5. **Split diagnostics:** `aria_hidden_self` vs former ancestor path; hit-test failure → e.g. `occluded` / `not_interactable`.  
6. **No** hostname / serviceId / `#UserName` / `#content` / `role=document` / framework branches.

**Why hit-test (not “rely on CSS only”):** CSS/layout checks already pass for many occluded background fields under overlays. Hit-test addresses the modal/background risk that V4 was bluntly approximating.  
**Why not keep V4:** Live evidence + ARIA semantics show V4 false-rejects legitimate laid-out editable targets.

**Self vs ancestor:** **Different treatment required.** Do not change them together.

### 16.6 Synthetic acceptance fixtures (generic)

| Fixture | DOM pattern | Expected after correction |
|---|---|---|
| **F-self** | `<input aria-hidden="true" …>` with layout | **Reject** — `aria_hidden_self` |
| **F-anc-active** | Ancestor `aria-hidden=true`, descendant INPUT laid out, editable, hit-test hits INPUT | **Accept** (Managed-eligible) |
| **F-anc-occluded** | Background form under opaque overlay; background may be `aria-hidden`; hit-test does **not** hit INPUT | **Reject** — occluded / not interactable |
| **F-css-hidden** | `display:none` / `visibility:hidden` / zero rects / too_small | **Reject** — existing V5–V7 |
| **F-plain** | Normal visible INPUT, no aria-hidden | **Accept** (regression) |

Current Fixture A (ancestor aria-hidden + laid-out input) becomes **F-anc-active** expectation flip relative to 120.4 — must be explicit in DD/regression.

### 16.7 Observability (required in any follow-on slice)

Managed structured failures **should** expose safe non-secret subreasons, e.g.:

| Coarse | Subreason examples |
|---|---|
| `unsafe_target` | `aria_hidden_self`, `aria_hidden_ancestor` *(legacy/diagnostic)*, `zero_rects`, `too_small`, `display_or_visibility`, `occluded` / `not_interactable` |

**Forbidden in payloads:** credential values, typed input values, cookies, tokens, storage, unrelated HTML dumps.

Prefer wiring `assessManagedTargetsReady` / Admin Test / readiness / Visual to extended `classifyManagedIneligibility`.

### 16.8 Regression impact

| Area | Impact |
|---|---|
| 120.4 Fixture A / R3 ancestor-aria tests | **Must change expectation** if V4 removed (eligible when hit-test passes) |
| Self aria-hidden / CSS hide / zero rects / exact-one / origin / top-doc | **Unchanged reject** |
| Analyze / Visual three-state | Eligibility may flip to IDENTIFIED_AND_MANAGED_ELIGIBLE for F-anc-active patterns |
| Admin Test / Digital Home | Same engine (D-120-12); both gain eligibility where V4 alone blocked |
| Modal/overlay pages | Depend on new hit-test — must have **F-anc-occluded** fixture |
| Named live fixture | May become approvability-eligible **after** generic change + re-probe — still config-only; no site code |

### 16.9 Disposition / authorization

| Item | Status |
|---|---|
| Exact predicate | **CONFIRMED:** `aria_hidden_ancestor` → V4 |
| FINAL classification | **B** (ancestor absolute rule) |
| Ancestor V4 remains binding? | **No** (Architect recommendation) — **still enforced in code until Owner-authorized slice ships** |
| Self aria-hidden remains binding? | **Yes** |
| Smallest generic correction | Remove absolute V4; keep V3; add generic hit-test; observability subreasons |
| Implementation | **NOT AUTHORIZED** |
| **Manager DD** | **REQUIRED** before any implementation (safety-contract change) |
| Locator / hostname / validate bypass | **FORBIDDEN** |
| Final Phase 120 Acceptance | **OPEN / PENDING** |

### Owner decision gate
Owner **ACCEPTED** §16.3–§16.5 (classification **B**). Manager DD Slice **120.6** Architecture PASS. **120.6-impl Architecture ACCEPTED / CLOSED.** LIVE OWNER RETEST **AUTHORIZED**. Final Acceptance **OPEN / PENDING**.

---

## 17. Live 120.6 retest — Admin mapping-state investigation (2026-09-22)

### Status
**INVESTIGATION COMPLETE (read-only).** No implementation. No Developer handoff yet.  
**120.6 remains CLOSED** (shared Managed eligibility not implicated).  
Final Phase 120 Acceptance remains **OPEN / PENDING**. Do **not** approve/validate the live mapping yet.

### Live Owner observations
| # | Observation |
|---|---|
| 1 | Visual Mapping selected real field → `#UserName`; no Managed-ineligible message (supports 120.6) |
| 2 | Save Mapping disabled; Approve Mapping enabled |
| 3 | Admin Managed Test «כניסה לאתר ומילוי שדות» disabled |
| 4 | After refresh, `#UserName` still present → persisted candidate |
| 5–8 | Clear Mapping → fields empty → Save → refresh restores old mapping |

### Finding A — Admin Test disabled → **EXPECTED**
`canRunManagedTest` requires **all** of:
1. `savedProfileReady` (persisted mappings + login entry + origin) — **true** here;
2. `!hasUnsavedChanges` — **true** (Save disabled + Approve enabled ⇒ clean vs saved);
3. `allTempValuesFilled` — every schema field has non-empty **temporary** test value (120.5 retention B, memory-only).

With Save disabled and Approve enabled, the mapping is a **saved clean candidate**. The Test button remains disabled until Admin fills **all temporary credential test inputs**. That is **intentional 120.5** — not a UI defect and not a 120.6 regression.

**Owner action for A:** Enter non-empty temp values for every schema field → Test enables → run Admin Test (still does not approve).

### Finding B — Clear + Save + Refresh restores mapping → **DEFECT**
**Clear Mapping** (`requestClearMapping`): clears **form state only**. Explicit product comment: does not mutate persisted mapping. Clear alone = expected.

**Save on empty form** (`formIsEmpty` → `persist('reset_not_configured')`): intended to wipe candidate configuration, but `planAutofillProfileWrite`:

1. Always runs **structural** validation on proposed `fieldMappings` **before** action handling;
2. Cleared form sends mappings with **empty locators** → structural fails (`emptyLocator` / missing required);
3. Even if structural were bypassed, `reset_not_configured` only sets `supportState=not_configured` and deletes `validation` — it **does not clear `fieldMappings`**.

Therefore Clear → Save cannot persist an empty/removed mapping; after refresh, prior `#UserName` (etc.) reloads. **Admin authoring semantics defect** (clear/remove persisted mapping unreachable). **Not** site-specific. **Not** empty-omit-from-payload alone — structural gate + reset not clearing mappings.

**Classification:** Admin Autofill Profile Editor / `planAutofillProfileWrite` authoring defect. **Manager DD required** before fix (authoring contract: clear vs delete vs reset). Out of scope for 120.6.

### Finding C — Approve enabled → **VALID**
`canApprove` for saved, structural-OK, non-dirty, non-validated candidate is **valid**. Confirm path still runs Managed-parity readiness probe (`runManagedReadinessProbe`) before `activate_validated` (120.2-AP). Enabling the button ≠ validated stamp. **Do not approve yet** until Admin Test / intentional Owner probe.

### 120.6 status → **REMAINS CLOSED**
Visual path produced `#UserName` without Managed-ineligible → consistent with §16 B / V8. Issues A/B are Admin authoring/UX gates, not shared eligibility regression. Do **not** reopen 120.6.

### Disposition
| Item | Result |
|---|---|
| A Admin Test disabled | **EXPECTED** (empty temp test values) |
| B Clear/Save/Refresh | **DEFECT FIXED** — **120.7-impl Architecture ACCEPTED / CLOSED**; LIVE OWNER RETEST **AUTHORIZED** |
| C Approve enabled | **VALID** (probe still required) |
| 120.6 | **REMAINS CLOSED** |
| Final Acceptance | **OPEN / PENDING** |

---

## Architect Review
ARCHITECT_REVIEW_STATUS: **120.7-impl PASS / ACCEPTED / CLOSED**; LIVE OWNER RETEST **AUTHORIZED**; **120.6 CLOSED**; Final Acceptance **OPEN/PENDING**

### Review Notes
2026-09-22 — Evidence review of 120.7-impl vs DD Slice 120.7 / §17 B.

**PASS:** `clear_managed_mappings` early-returns with `fieldMappings: []`, `supportState=not_configured`, validation omitted, configVersion bump when prior non-empty mappings; structural validation skipped only on that action branch; normal `save` still structurally rejects empty locators; Editor P1 Clear→confirm→Save persists clear with `fieldMappings: []` payload; validated stronger confirm; eligibility false after validated clear (verify C2); persist success copy only after `await updateGlobalRegistryRow`; no vault/login_fields mutation; no site branches. Developer: `verifyPhase120ClearManagedMappings.mjs` PASS; `tsc -b` exit 0.

### Required Corrections
_None._

### Exact next step — LIVE OWNER RETEST (authorized)
1. Reload Admin Hub.  
2. Service with **persisted** mapping (e.g. field → `#UserName`).  
3. «נקה מיפוי» → confirm → fields empty.  
4. «שמור מיפוי» → success: mappings removed; credentials untouched.  
5. **Refresh** Admin → locators **remain empty** (C1).  
6. Optional: validated service clear → confirm warning → Save → refresh empty; Digital Home Managed **not** eligible until remap+approve (C2).  
7. Do **not** reopen 120.6. Final Acceptance remains **OPEN / PENDING**.

---

## 18. Live Analyze empty-HIGH investigation (Rivhit / Hadoar) — 2026-09-22

### Status
**INVESTIGATION COMPLETE.**  
**Final classification: Analyze healthy (no-overwrite) + misleading UI toast (wording debt).**  
No implementation. **120.6 remains CLOSED.** Final Acceptance **OPEN / PENDING** — **may continue**.

### Live Rivhit audit (Owner — conclusive)
```text
[assisted-mapping]
{ serviceId: "online1-rivhit", status: "partial",
  errorCode: undefined, proposalCount: 3, highCount: 2, unmappedCount: 1 }
```
Toast: «לא נמצאו מיפויים בביטחון גבוה. השדות נותרו ריקים.»

### Exact post-audit path (repo)
```text
applySafetyAndConfidence → proposal.proposals (highCount=2 logged here)
  → applyHighConfidencePrefill(currentLocators, proposal)
       for each HIGH row:
         if (currentLocators[fieldId] already non-empty) SKIP  // Phase 118 no silent overwrite
         else apply → appliedFieldIds
  → AutofillProfileEditor toast:
       appliedFieldIds.length > 0  → «הוצעו מיפויים בביטחון גבוה…»
       else if #3 ineligible       → «זוהה אך אינו כשיר…»
       else                        → «לא נמצאו מיפויים בביטחון גבוה…»  ← USED
```

### Exact reason highCount=2 produced this toast
The two HIGH proposals **survived** safety (logged). Prefill **intentionally skipped** them because the Admin locator fields for those fieldIds were **already non-empty** (`applyHighConfidencePrefill`: `if (existing) continue`). `appliedFieldIds.length === 0` → toast branch that claims “no HIGH found” — **false relative to pipeline health**; true only relative to “nothing newly applied.”

`status: partial` + `unmappedCount: 1` matches historical Rivhit pattern (two HIGH-capable fields + one non-HIGH / unmapped — historically `business_id` / `#osek` MEDIUM).

HIGH proposals were **not** dropped after the audit point (C ruled out). Broad 120.6 Analyze regression **ruled out** by this evidence (audit shows HIGH after Managed-eligibility gate).

### Final §18 answers
| Question | Answer |
|---|---|
| Classification | **A** (Analyze healthy / no-overwrite) **+** **B** (toast misleading for no-overwrite) |
| Analyze regression | **NO** |
| 120.6 | **REMAINS CLOSED** |
| UI wording defect/debt | **YES** — non-blocking; toast should distinguish “HIGH found but slots already filled” vs “no HIGH” |
| Manager DD for Analyze/120.6 | **Not required** for acceptance continuation; optional later UX DD for toast |
| Final Acceptance | **May continue** (OPEN/PENDING) |

### Exactly ONE next Owner action
Continue Final Phase 120 Acceptance on the **current saved Rivhit mapping** (Admin Test / Managed path as planned). Treat Analyze as **healthy**; do **not** reopen 120.6 for this toast. Optional later: UX copy fix when `highCount > 0 && appliedFieldIds.length === 0`.

---

## Architect Review
ARCHITECT_REVIEW_STATUS: **§18 COMPLETE — Analyze NO regression**; toast **misleading (debt)**; **120.6 CLOSED**; Final Acceptance **may continue** / **OPEN/PENDING**

### Review Notes
2026-09-22 — Rivhit audit highCount=2 + empty-HIGH toast explained by Phase 118 no-overwrite prefill + incorrect toast when nothing newly applied. Not a 120.6 Analyze regression.

### Required Corrections
_None blocking._ Optional future: toast when HIGH exist but slots filled.

### Exact next step
**Owner:** Continue Final Acceptance. Do not implement toast fix in this gate unless separately authorized.

### Status
| Gate | Result |
|---|---|
| Authenticated live dump | **CAPTURED** |
| Normative schema | **`username`, `password`** (live) |
| Login Entry / primary URL | **MATCH** (verified live) |
| `adapter_id` `""` | **≡ no adapter** (no cosmetic rewrite) |
| Amended DD (live schema) | **APPROVED** |
| §5B DD amendment | **APPROVED** (2026-09-21 re-review) |
| **S1** | **PASS** against live baseline |
| Admin S3–S7 | **AUTHORIZED** (writes **Production-visible** shared global row — §5B) |
| Owner UAT / path proof | After P1–P5 package |
| Configuration Promotion | **N/A** — no separate config DB |
| P1 / P3 / P4 | **P1 path PASS**; **P3 PASS**; **P4 PASS** |
| **120.2** slice | **CLOSED / ACCEPTED** (2026-09-22) |
| **120.2-AP** | **CLOSED** |
| Post-AP remapping + activate | **PASS** — `password` → `input[name="j_password"]` |
| Analyze empty-result UX copy | **Non-blocking debt** |
| 120.FSC Fresh Service Creation | **RESERVED — NOT AUTHORIZED** |

### Amended DD re-review checklist (PASS)
| # | Requirement | Result |
|---|---|---|
| 1 | Live registry = normative baseline | **PASS** |
| 2 | Field IDs `username`, `password` | **PASS** |
| 3 | No username→email migration | **PASS** |
| 4 | Vault key compatibility preserved | **PASS** |
| 5 | Live Login Entry / primary URL | **PASS** |
| 6 | `adapter_id=""` ≡ none, no rewrite | **PASS** |
| 7 | credentialMode/supportState via Admin only | **PASS** |
| 8 | Seed hygiene out of slice | **PASS** |
| 9 | No runtime/orchestrator/generic/adapters | **PASS** |
| 10 | Shufersal only | **PASS** |

### §5B DD amendment checklist (PASS)
| # | Requirement | Result |
|---|---|---|
| 1 | Shared Supabase `wbehjoraatkrpsbgyunx` recorded | **PASS** |
| 2 | S3–S7 = Production-visible immediately | **PASS** |
| 3 | Configuration Promotion not designed | **PASS** |
| 4 | Hub / extension / Edge / migrations distinguished from shared config | **PASS** |
| 5 | `supportState` activation + Production-path smoke | **PASS** |
| 6 | Evidence retained; P1/P3/P4 pending honest | **PASS** |
| 7 | No service-specific production code | **PASS** |

### Next authorized steps
1. None for 120.2 — **CLOSED**.  
2. Do **not** start **120.FSC** or any new migration without explicit Architecture authorization.  
3. Optional later debt only: Analyze UX copy; catalog seed hygiene; §5C tab-lifecycle hardening.

### Historical record
Prior S1 BLOCKED / MISMATCH / STOP dispositions retained for audit; superseded by this PASS for execution purposes.
Prior §5A Configuration Promotion design retained historically but **superseded by §5B**.

---

## 19. Investigate — credential field.id vs Analyze semantic coupling (2026-09-22)

**Scope:** Architecture investigation only. No implementation. Triggered during clean Rivhit Analyze after successful Clear Mapping (120.7).

**Verdict:** **PARTIALLY_COUPLED**. Architecture gap (schema/Agent contract debt). **Not** a Phase 120 Final Acceptance blocker for Managed Autofill.

### 19.1 Current Agent input contract (evidence)

| Layer | Contract | Semantic fields supplied |
|---|---|---|
| `LoginField` (`serviceModel.ts`) | `id`, `label`, `type`, optional `required`/`masked`/`inputType` | No `description`, no `semanticRole`, no credential-role enum |
| `CredentialSchemaField` (`assistedMapping/types.ts`) | `{ fieldId, label, type? }` only | Same three |
| `schemaFromLoginFields` | maps `id→fieldId`, `label`, `type` | Nothing else |
| Edge `propose-field-mappings` | system prompt + JSON `schema` + `page` | Prompt: map `fieldId`; “Semantic non-lexical matches allowed (e.g. business id field…)”; lexical helpful not required |
| Mock `defaultLiveProposals` | password regex on **fieldId + label + type**; lexical `idAttr/nameAttr/autocomplete === fieldId`; then 1:1 uniqueness | Explicitly uses **fieldId as semantic/lexical signal** |
| Page observation | `SafePageInput` type/id/name/autocomplete/labels/nearby text/locators | Independent of schema IDs |

**Per credential field, Agent receives today:**

| Signal | Present? | Role |
|---|---|---|
| `field.id` / `fieldId` | **Yes** | Persistence join key **and** de facto semantic token (English catalog IDs; mock lexical; prompt examples) |
| Admin-visible `label` | **Yes** | Human/Agent-readable meaning when Admin writes real labels |
| `type` (`text` \| `password`) | **Yes** | Strong password-role signal |
| description | **No** | — |
| autocomplete intent (schema-side) | **No** | (page autocomplete is observation only) |
| credential semantic role enum | **No** | — |
| other schema metadata | **No** for Analyze | `inputType`/`masked`/`required` not forwarded |

### 19.2 Answers to architecture questions

1. **Opaque IDs `field_1`/`field_2`/`field_3` with identical other metadata unchanged**  
   - If **labels + types remain distinguishing** (e.g. Hebrew login/password/business labels, `type=password` on secret): a real LLM **can** still map from label/type ↔ page evidence. Architecture intent (D-118-8) allows that.  
   - Mock lexical path **loses** id/name affinity (correct). Password path still works via `type`/`label`. Remaining multi-field cases without label semantics → ambiguity.  
   - If labels are also opaque/identical → **correct** behavior is no confident mapping.

2. **Is `field.id` used as both A and B?** **Yes.**  
   - **A** Stable identity: vault keys, `fieldMappings[].fieldId`, schema join, unmappedFieldIds.  
   - **B** Semantic description: catalog conventions (`username`/`password`/`business_id`); mock regex + lexical equality to DOM; Edge prompt frames semantics via fieldId examples.

3. **Architecture gap?** **Yes — partial.** Identity and meaning are conflated by practice and mock; label/type partially compensate but are not a dedicated Agent semantic descriptor. Not a Managed Autofill runtime safety defect.

4. **Proper separation**  
   - **Stable field identity** = opaque `field.id` (persistence / join only).  
   - **Human/Agent semantic meaning** = explicit metadata (`label` minimum; preferably `description` and/or `semanticRole`).  
   - **Page observation** = control meaning evidence.  
   - Analyze maps: **credential semantic meaning → observed control meaning**; join result by `field.id`.

5. **Authoritative semantic descriptor independent of id today?**  
   - **Partial:** `label` + `type` are the only non-id meaning carriers. No dedicated Agent semantic field.  
   - Catalog IDs are conventionally meaningful English tokens — not required by schema, but relied on in the wild.

6. **Smallest generic schema extension (if Owner authorizes later)**  
   - Add optional `description?: string` **or** `semanticRole?: string` (free-text or small closed vocab) on `LoginField` → forward on `CredentialSchemaField`.  
   - Agent contract: match using `label` + `description`/`semanticRole` + `type`; treat `fieldId` as opaque join key; forbid requiring meaningful id naming.  
   - Mock: remove fieldId↔DOM lexical as primary semantic path (keep page-side id/name as observation only).  
   - Do **not** invent meanings for opaque fields with empty semantics.

### 19.3 Classification

| Item | Result |
|---|---|
| Coupling | **PARTIALLY_COUPLED** |
| Phase 120 blocking architecture gap? | **Yes — Owner override (2026-09-22)** — elevated to Final Acceptance blocker → Slice **120.8** |
| Manager DD required? | **Yes** — Slice 120.8 DD **Architecture PASS**; **120.8-impl AUTHORIZED** |

### 19.4 Blind-ID acceptance fixtures (proposed; not implemented)

**Positive — opaque IDs + explicit semantics**

```text
schema:
  { fieldId: "credential_a", label: "מזהה התחברות", type: "text",
    description: "login identifier / username or account login name" }
  { fieldId: "credential_b", label: "סיסמה", type: "password",
    description: "secret password" }
  { fieldId: "credential_c", label: "מספר עוסק", type: "text",
    description: "business / VAT / commercial account identifier" }

page (unrelated DOM ids):
  #loginName, #pwdSecret, #osekNum   (labels/nearby text align with descriptions)

Expect: Analyze maps by semantics/evidence, NOT by string equality of fieldId to DOM.
  credential_a → #loginName
  credential_b → #pwdSecret
  credential_c → #osekNum
```

**Negative — opaque IDs + no distinguishing semantics**

```text
schema:
  { fieldId: "credential_a", label: "שדה 1", type: "text" }
  { fieldId: "credential_b", label: "שדה 2", type: "text" }
  { fieldId: "credential_c", label: "שדה 3", type: "text" }
  // no description / semanticRole; types identical

page: three text inputs with unrelated ids

Expect: no HIGH invention; unmapped / low confidence; no false semantic_role_match.
```

### 19.5 Phase impact

- **120.7 Clear Mapping** live path remains valid; Analyze after clear using meaningful labels/IDs is expected.  
- Final Phase 120 Acceptance remains **OPEN / PENDING**.  
- Do **not** reopen 120.6. No implementation in this investigation.

---

## Architect Review (§19)
ARCHITECT_REVIEW_STATUS: **§19 COMPLETE — PARTIALLY_COUPLED**; **Owner override → Final Acceptance blocker**; **120.8 DD PASS**; **120.8-impl AUTHORIZED**; Final Acceptance **OPEN/PENDING**; **120.6/120.7 CLOSED**

### Review Notes
2026-09-22 — Investigate: PARTIALLY_COUPLED. Owner elevated to Phase 120 Final Acceptance blocker. Manager DD 120.8 reviewed **PASS** (identity≠meaning; label+type mandatory; optional description; no semanticRole; prompt/mock forbid fieldId semantics; Blind POS/NEG; no vault/ID migration; authoring-only).

### Required Corrections
_None._

### Exact next step
**Manager:** Amend Slice **120.8 DD** for §20 MEDIUM-prefill before Developer handoff. **Developer:** implement only against the **amended** 120.8 DD. Final Acceptance remains **OPEN / PENDING**.

---

## 20. Architecture Amendment — MEDIUM-confidence Admin Analyze proposals (2026-09-22)

**Status:** **PASS / SUPERSEDING** for Slice **120.8** (pre-implementation). No new slice. No Managed Runtime change. Do **not** reopen 120.6 / 120.7.

### 20.1 Owner intent
Analyze is an **Admin authoring assistant**, not an approval authority. Structurally/safety-validated **MEDIUM** proposals are useful draft information and must not be discarded solely for being non-HIGH.

### 20.2 Binding prefill eligibility (supersedes Phase 118 HIGH-only prefill)

| Final confidence (after safety validation) | Prefill empty mapping slot? | UI requirement |
|---|---|---|
| **HIGH** | **Yes** | Visibly marked **HIGH** |
| **MEDIUM** | **Yes** — as explicit **AI PROPOSAL** | Visibly marked **MEDIUM**; communicate **Admin review required**; **must not** appear equivalent to HIGH |
| **LOW** / unknown / ambiguous / safety-rejected / managed-ineligible | **No** | No locator prefill |

**Unchanged:**
- Prefill only into **empty** slots (no silent overwrite of Admin-edited non-empty locators without explicit replace — Phase 118 rule retained).
- Raw `modelConfidence` never drives prefill alone (D-118-7 layer 2 safety remains).
- Only Managed-eligible (state #2) proposals may enter prefill set (120.4).

### 20.3 Authority boundary (normative — HIGH and MEDIUM identical)

Neither HIGH nor MEDIUM means approval or production authority.

Analyze **MUST NOT**:
- save mappings automatically  
- approve mappings automatically  
- set `supportState=validated`  
- bypass Managed readiness / parity (120.2-AP)  
- change Digital Home eligibility  
- bypass target-safety / Managed eligibility validation  

Flow remains:
```text
Analyze → Admin reviews/corrects → Admin Save → Admin Approve → Managed parity/readiness → validated
```

MEDIUM increases useful Admin information only.

### 20.4 Phase 118 impact
| Prior Phase 118 rule | Disposition |
|---|---|
| Prefill **only** final `high` (AC-118-7; editor “medium/low empty”) | **Superseded for Admin authoring prefill** by §20.2 — MEDIUM may prefill with distinct presentation |
| D-118-8 semantic HIGH without mandatory lexical match | **Unchanged** — do **not** artificially downgrade strong semantics because opaque `fieldId` ≠ DOM id/name |
| D-118-10 human persistence authority | **Unchanged** — Save/Approve/`validated` remain Admin-only |
| D-118-7 layers 1–2 (model + safety) | **Unchanged** |
| D-118-9 no invented locators | **Unchanged** |

### 20.5 120.8 Blind-ID fixture extension (mandatory in amended DD)
Retain POS/NEG from §19.4 / Manager §6.

**Additionally** — positive path may include a field whose post-safety confidence is **MEDIUM** (e.g. `credential_c` business/account identifier with related but non-decisive page evidence):

| Expectation | |
|---|---|
| Proposal preserved (not discarded) | Yes |
| Locator may prefill for Admin review | Yes |
| UI marks MEDIUM clearly; review required | Yes |
| No auto-save / approve / `validated` / DH eligibility change | Yes |
| Strong semantic evidence may still be HIGH without fieldId↔DOM lexical affinity | Yes (D-118-8 + 120.8 identity decoupling) |

NEG fixture unchanged: opaque IDs + no distinguishing semantics → **no** HIGH/MEDIUM invention / no prefill.

### 20.6 Scope / non-goals
- Authoring Analyze UI + prefill policy + Agent confidence presentation only  
- **Not** Managed Runtime, 120.6, 120.7, Digital Home, activate gate  
- **Not** a new phase/slice  

### 20.7 Manager obligation
**Manager MUST amend** `manager-phase120.md` Slice **120.8** to incorporate §20 **before** Developer handoff. Architecture previously ACCEPTED 120.8 DD remains base; **§20 supersedes** HIGH-only prefill portions. **120.8-impl authorized only against the amended DD.**

### 20.8 Tests / regressions (for amended DD / impl evidence)
- Prefill HIGH + MEDIUM (empty slots only); LOW/rejected empty  
- UI distinguishes HIGH vs MEDIUM; MEDIUM shows review-required affordance  
- No auto-save / supportState / DH eligibility from Analyze  
- Blind-ID POS: opaque IDs + label/type; may assert MEDIUM preserved+prefilled; may assert HIGH without fieldId lexical affinity  
- Blind-ID NEG: no invented prefill  
- Phase 118 safety / eligibility / invented-locator regressions remain PASS  

---

## Architect Review (§20)
ARCHITECT_REVIEW_STATUS: **§20 MEDIUM-prefill amendment PASS**; **120.8 DD must be Manager-amended**; **120.8-impl AUTHORIZED only vs amended DD**; Final Acceptance **OPEN/PENDING**; **120.6/120.7 CLOSED**

### Review Notes
2026-09-22 — Owner authoring UX amendment accepted. Analyze remains non-authority; MEDIUM post-safety may prefill with mandatory visual/review distinction; LOW/rejected stay empty. Supersedes Phase 118 HIGH-only prefill for Admin form only. Fits 120.8 pre-impl amendment — no new slice.

### Required Corrections
_None architectural._ Manager must amend 120.8 DD to bind §20 before Developer starts.

### Exact next step
**Manager:** Amend 120.8 DD (§20). **STOP** Developer until amended DD ready. Then Developer **120.8-impl** against amended DD only.

---

## 21. Architecture evidence review — 120.8-impl (2026-09-22)

**Verdict: PASS / ACCEPTED / CLOSED**

Inspected source (not summary alone): `mockProvider.ts` default path, Edge prompt, `safetyValidation.ts` / `applyConfidentPrefill`, `fieldAuthoring.ts` (E1–E3), `validatedProfile.ts` parse/serialize/clear, `AutofillProfileEditor.tsx` + CSS chips, `managedAutofill.ts` isolation, `verifyPhase120IdentityAuthoring.mjs` (re-run **PASS** A–K), regressions 118 / 120.5 / 120.7 **PASS**.

| Gate | Result |
|---|---|
| 1 Identity decoupling (default + Edge) | **PASS** — password/label affinity without fieldId tokens; prompt opaque; Blind POS opaque IDs |
| 2 HIGH/MEDIUM/LOW prefill + Hebrew/color | **PASS** — Section 20; MEDIUM review hint; no authority |
| 3 Persisted `fieldAuthoring` facts | **PASS** — sibling bag; Save/serialize/reload; no colors persisted |
| 4 Provenance transitions | **PASS** — Analyze / Visual SAME|DIFF / manual / Clear |
| 5 Admin Test independent | **PASS** — no MEDIUM→HIGH; configVersion bind; temps memory-only |
| 6 E1–E3 authoring-only | **PASS** — `visualTargetsEquivalent`; runtime untouched |
| 7 Runtime isolation | **PASS** — `managedAutofill.ts` has zero `fieldAuthoring` |
| 8 Blind-ID POS/NEG | **PASS** — verify A/B/J |
| 9 Regressions / genericity | **PASS** — 118/120.5/120.7; no site branches; no vault migration |

**Residual (non-blocking):** non-default mock scenarios `lexical_exact` / `semantic_non_lexical` still script fieldId-keyed fixtures for legacy Phase 118 ACs — **not** used by default live path or Edge. Optional later hygiene.

### Live Owner acceptance — AUTHORIZED
Suggested sequence: Admin service with opaque or conventional IDs → Analyze → confirm HIGH/MEDIUM chips (Hebrew+color) → Save → refresh/relogin reconstruct → optional Visual SAME/DIFF → optional Admin Test (MEDIUM stays MEDIUM + נבדק בהצלחה) → Clear → provenance gone. Then continue Final Acceptance matrix as planned.

**SUPERSEDED:** Live Owner acceptance **completed PASS** — see **§23**.

Final Phase 120 Acceptance remains **OPEN / PENDING**.

---

## Architect Review (§20 / §21)
ARCHITECT_REVIEW_STATUS: **120.8-impl PASS / ACCEPTED / CLOSED**; LIVE OWNER ACCEPTANCE **PASS** (§23); Final Acceptance **OPEN/PENDING**; **120.6/120.7 CLOSED**

### Review Notes
2026-09-22 — Source + verify A–K evidence review PASS against amended 120.8 DD / §19 / §20.

### Required Corrections
_None blocking._

### Exact next step
**Owner:** live acceptance completed — see §23. Final Acceptance remains **OPEN / PENDING**. No new capabilities.

---

## 22. Investigate — credential schema Save vs Autofill CSS coupling (2026-09-22)

**Scope:** Investigation only. Triggered during live 120.8 Blind-ID acceptance when Admin saw CSS-required errors while editing credential fields.

### 22.1 Classification

**AUTHORING_CONTRACT_DEFECT** (primary) + **EXPECTED_CONSTRAINT** (narrow).

| Layer | Finding |
|---|---|
| Credential schema Save (`RegistryAdmin.handleSave` → `login_fields`) | **Not** gated by Autofill structural validation — main **«שמור»** only disables while `saving` |
| Autofill mapping Save (`AutofillProfileEditor` → `validateAutofillProfileStructural`) | **Expected** to reject incomplete Managed profiles (empty locators / missing required mappings) |
| Observed Hebrew errors | Emitted **only** by Autofill structural validation / Autofill panel — not by CredentialFieldsEditor |
| Defect | Same Admin surface co-locates schema editor + Autofill editor; Autofill always materializes **one mapping row per schema field** (often empty) and surfaces CSS-required errors as if they block schema authoring; no clean “schema saved, mappings not configured yet” state; schema ID changes do **not** auto-invalidate stale autofillProfile |

**Not:** Managed Runtime / 120.6 / 120.7 clear semantics / Digital Home eligibility defect.

### 22.2 Exact root cause / save path

```text
Credential schema Save:
  RegistryAdmin.handleSave
    → updateGlobalRegistryRow({ login_fields, credential_mode, … })
    → does NOT call validateAutofillProfileStructural
    → does NOT require CSS locators

Autofill mapping UI (always when credential_fields + global row):
  AutofillProfileEditor
    → fieldMappings = fields.map(f => ({ fieldId: f.id, locator: locators[f.id] || '' }))
    → validateAutofillProfileStructural(fieldMappings, login_fields)
         → emptyLocator: "יש להזין בורר CSS לכל שדה ממופה."
         → missingRequiredMapping: "יש למפות בורר CSS לכל שדה כניסה נדרש."
    → canSave Autofill only if structural.ok OR (all locators empty && existing profile → clear path)
    → Analyze / Visual do NOT require structural.ok
```

Error strings live in `AUTOFILL_PROFILE_ERROR` (`validatedProfile.ts`).

### 22.3 Answers

1. **Which save?** Autofill **«שמור מיפוי»** / Autofill structural gate — not schema **«שמור»** (unless Operator conflates the two controls on the same page).  
2. **Schema persistence through Autofill structural?** **No.**  
3. **Empty locator treated invalid during schema-only authoring?** Autofill UI **yes** (displays error; blocks Autofill save when incomplete). Schema save **no**.  
4. **Schema identity change vs mappings?** Old `fieldMappings` / `fieldAuthoring` keyed by prior IDs become stale/orphan; vault credential map keys under old IDs are **not** migrated. Today: login_fields-only update does **not** auto-clear autofillProfile. Desired: invalidate mappings/provenance/validation (clear or not_configured + configVersion bump) when active field-id set changes.  
5. **May Rivhit field IDs be changed?** **No — not safe** for Blind-ID. `field.id` is the vault/encrypted credential key (`ID_CHANGE_WARNING`). Renaming orphans stored values; no copy to new IDs.  
6. **Classification:** **AUTHORING_CONTRACT_DEFECT** (lifecycle/UX coupling) with **EXPECTED_CONSTRAINT** that incomplete Managed Autofill profiles cannot be saved as complete mappings.

### 22.4 Does this block 120.8 live acceptance?

**Does not block** if Blind-ID uses a **fresh synthetic service** created with opaque IDs from the start.  
**Blocks / misleads** if Operator tries to rename Rivhit IDs or treats Autofill CSS errors as a schema-save hard stop.

Analyze remains available with empty locators (`canAnalyze` independent of `structural.ok`).

### 22.5 Smallest generic correction (later; no impl now)

1. Autofill panel: treat “no locators yet” as **not_configured / incomplete mapping** hint — not schema-save failure; do not imply CSS is required to define credentials.  
2. On `login_fields` id-set change: auto-invalidate Managed mappings + `fieldAuthoring` + validation (clear path / not_configured + configVersion) — never silent vault rewrite.  
3. Keep structural CSS requirements **only** for persisting a non-empty Autofill mapping profile / activate path.  

**Manager DD required** before implementation of (1)–(2).

### 22.6 Recommended Blind-ID live procedure (safe)

**Do not rename Rivhit `username` / `password` / `business_id`.**

1. Create **new** Global Admin test service (synthetic Login Entry).  
2. Credential mode = credential_fields with opaque IDs from creation:  
   `credential_a` / `credential_b` / `credential_c`  
   labels: שם משתמש / סיסמה / עוסק מורשה; types text / password / text.  
3. Main form **«שמור»** (schema only) — no CSS required.  
4. Autofill panel may still show incomplete-mapping messages — ignore for schema step; **Analyze** (or Visual) to propose locators.  
5. **«שמור מיפוי»** after HIGH/MEDIUM proposals; optional Admin Test; refresh/relogin for provenance.  
6. Keep Rivhit production config undisturbed for Final Acceptance elsewhere.

### 22.5 Phase impact
Final Phase 120 Acceptance **OPEN / PENDING**. 120.8-impl remains **ACCEPTED**. No implementation in this investigation.

---

## Architect Review (§22)
ARCHITECT_REVIEW_STATUS: **§22 COMPLETE — AUTHORING_CONTRACT_DEFECT** (residual; **not** reopening 120.8); Blind-ID live **PASS** via fresh service (§23); Final Acceptance **OPEN/PENDING**

### Review Notes
2026-09-22 — CSS errors are Autofill structural completeness, not schema Save. Schema/Autofill concerns incorrectly co-presented. Vault keys make Rivhit ID mutation unsafe for Blind-ID. Live Blind-ID later used fresh service (§23).

### Required Corrections
_None for 120.8._ Optional later Manager DD: incomplete-mapping UX + schema id-set autofill invalidation.

### Exact next step
**Owner:** 120.8 live acceptance **PASS** (§23). Residual §22 stays open as non-blocking authoring debt. Final Phase 120 Acceptance remains **OPEN / PENDING**.

---

## 23. Final Live Owner Acceptance — Slice 120.8 (2026-09-22)

**120.8 LIVE OWNER ACCEPTANCE: PASS**

120.8-impl remains **Architecture ACCEPTED / CLOSED**. Slice **120.8 remains CLOSED**. Do **not** reopen 120.8. Do **not** close overall Phase 120.

### 23.1 Rivhit — live HIGH/MEDIUM presentation — **PASS**

Existing Rivhit service analyzed after 120.8:

| Field | Locator | Confidence | Presentation |
|---|---|---|---|
| `username` | `#username` | HIGH | Hebrew HIGH + green |
| `password` | `#password` | HIGH | Hebrew HIGH + green |
| `business_id` | `#osek` | MEDIUM | **«ביטחון בינוני · דורש בדיקת מנהל»** + orange |

MEDIUM was **prefilled** and available for Admin review (supersedes Phase 118 HIGH-only discard).

### 23.2 Provenance persistence — **PASS**

- After Save + Admin page refresh: HIGH and MEDIUM indicators reconstructed (including `#osek` MEDIUM).  
- After Admin logout + login: confidence/provenance presentation remained.

### 23.3 Admin Managed Autofill Test — **PASS**

- Temporary fake values for all three Rivhit fields → **«כניסה לאתר ומילוי שדות»** → all three controls filled correctly (including MEDIUM Osek).  
- After return / new Admin session: AI confidence unchanged; Osek remained MEDIUM/orange; independent **«נבדק בהצלחה»**.  
- Successful Admin Test **did not** rewrite MEDIUM → HIGH.

### 23.4 Blind-ID live acceptance — **PASS**

Fresh test service created (Rivhit login experience reused; **no** mutation of Rivhit vault field IDs).

Opaque schema from creation:

| fieldId | label | type |
|---|---|---|
| `credential_a` | שם משתמש | text |
| `credential_b` | סיסמה | password |
| `credential_c` | עוסק מורשה | text |

Field IDs contained **no** username/password/business vocabulary.

Analyze: mapped all three semantics; business/Osek remained MEDIUM and usable; mappings saved.

Admin Managed Autofill Test: all three opaque-ID values filled correct website controls (`credential_c` → Osek).

**Live proof:** Analyze does **not** require meaningful `fieldId` spelling; label/type + page evidence suffice.

### 23.5 Digital Home scope — **not a 120.8 failure**

Fresh duplicate test service did **not** appear as an addable Digital Home service — expected interaction with duplicate/service-identity rules. Do **not** weaken duplicate prevention for fixtures.

Runtime evidence already sufficient for 120.8:

| Evidence | Path |
|---|---|
| A | Existing real Rivhit — Digital Home Managed Autofill three-field fill (prior live) |
| B | Fresh Blind-ID — Admin Test → same Managed engine → three-field fill (this acceptance) |

Do **not** claim the synthetic service itself was Digital Home tested. No additional synthetic DH fixture required for 120.8.

### 23.6 Specifically accepted live

- identity ≠ meaning  
- opaque field IDs work  
- HIGH proposals prefill  
- MEDIUM proposals prefill  
- confidence text/color presentation  
- MEDIUM remains explicitly review-required  
- persisted provenance survives refresh  
- persisted provenance survives logout/login  
- Admin Test success persists independently  
- successful test does not promote MEDIUM to HIGH  
- no existing stable ID migration required  
- no Managed Runtime redesign required  

### 23.7 Residual finding (retained; not in this slice)

§22 **AUTHORING_CONTRACT_DEFECT** (+ narrow EXPECTED_CONSTRAINT): credential-schema authoring and Autofill mapping presentation/validation on the same page can mislead when mappings are incomplete.

Do **not** implement as part of 120.8. Do **not** reopen 120.8. Manager DD later if Owner elevates.

### 23.8 Phase 120 Final Acceptance status

| Item | Status |
|---|---|
| Slice 120.8 | **CLOSED** — live Owner acceptance **PASS** |
| Final Phase 120 Acceptance | **OPEN / PENDING** |
| Remaining before overall Phase 120 close | Complete Final Acceptance Matrix (incl. deferred **120.3.3** representative evidence and any other open matrix gates); residual §22 is **non-blocking** authoring debt unless Owner elevates |

---

## Architect Review (§23)
ARCHITECT_REVIEW_STATUS: **120.8 LIVE OWNER ACCEPTANCE PASS**; Slice **120.8 CLOSED**; Final Phase 120 Acceptance **OPEN/PENDING**

### Review Notes
2026-09-22 — Owner live evidence recorded: Rivhit HIGH/MEDIUM + provenance persist + Admin Test independence + Blind-ID fresh opaque service Analyze+Admin Test. DH synthetic absence out of scope. §22 residual retained.

### Required Corrections
_None for 120.8._

### Exact next step
**Owner:** proceed with remaining Phase 120 Final Acceptance Matrix items. Do **not** close Phase 120 until the full matrix is satisfied. Do **not** reopen 120.8.

---

## 24. Phase 120 Final Acceptance Matrix (2026-09-22)

**Status:** Matrix **COMPLETE**. Phase 120 **FORMALLY CLOSED** (§27, 2026-09-22).  
**Binding:** D-120-9 / D-120-10 / D-120-11 — fixtures ≠ architecture; representative ≠ exhaustive; generic capabilities only.  
**No** new capabilities claimed. Closed slices not reopened.

### 24.0 Classification legend

| Class | Meaning |
|---|---|
| **PASS** | Already satisfied by recorded Architecture / Owner / verify evidence |
| **LIVE TEST REQUIRED** | Owner must perform a specific live action still missing |
| **EVIDENCE GAP** | Engineering report/verify still required |
| **BLOCKED** | Defect prevents acceptance |
| **DEFERRED / NON-BLOCKING** | Explicitly outside Phase 120 closure |

Named websites below are **validation fixtures only**.

---

### 24.1 Closed-slice evidence (reuse — do not retest)

| ID | Gate | Class | Exact evidence |
|---|---|---|---|
| FA-120.1 | Runtime inventory complete | **PASS** | §4 Architect Review; manager inventory AC-120.1-1…7 |
| FA-120.2 | Config-only Managed migration pilot | **PASS** | §5–§6; Shufersal fixture P1/P3/AP/P4 Owner live **PASS** 2026-09-22 |
| FA-120.2-AP | Managed-parity activate gate | **PASS** | Slice CLOSED; activate requires probe (not UI-confirm alone) |
| FA-120.3.0 | Convergence inventory / decision tree | **PASS** | §9 ACCEPTED |
| FA-120.3.1 | Disposition / enforceable plan | **PASS** | Architecture PASS / ACCEPTED |
| FA-120.3.4 | Adapter→generic gap analysis | **PASS** | §10 + Owner clarification §10.8 |
| FA-120.3.5 | Generic capability boundary | **PASS** | §11 / D-120-11 ACCEPTED |
| FA-120.3.6 | Dedicated site-adapter debt removal | **PASS** | §12 Packages A/B; practice retained by design |
| FA-120.4 | Shared Managed target eligibility | **PASS** | 120.4-impl ACCEPTED/CLOSED; three-state + shared `isSafeFillTarget` |
| FA-120.5 | Admin Managed Autofill Test harness | **PASS** | 120.5-impl CLOSED; live Admin Test on Rivhit + Blind-ID (§23.3–§23.4); D-120-12/13 |
| FA-120.6 | Visibility / occlusion correction | **PASS** | 120.6-impl CLOSED; subsequent Rivhit Managed/Admin fill success implies V8 path live |
| FA-120.7 | Persistent Clear Mapping | **PASS** | 120.7-impl CLOSED; Owner cleared persisted Rivhit mappings + refresh empty (§19 context) before re-Analyze |
| FA-120.8 | Identity≠meaning + HIGH/MEDIUM + provenance | **PASS** | §23 LIVE OWNER ACCEPTANCE **PASS** |

---

### 24.2 Deferred 120.3.3 — Representative Config-Only Managed Convergence (RESOLVED INTO MATRIX)

**Intent (D-120-10):** Prove **generic** config-only Managed Autofill for supported simple login experiences via **sufficient representative fixtures** — **not** migrate/test every catalog service.

**Unsupported by design / out of Phase 120 (do not require):** modal activation, multi-step, iframe, Shadow DOM, auto-submit, first-match fallback.

#### Minimum representative capability set

| Cap | Required proof | Fixture evidence (reuse) | Class |
|---|---|---|---|
| **R1** Simple top-document Managed fill | DH or Admin Test → correct fill; manual submit | Shufersal DH P4; Rivhit DH (prior + §23); Meuhedet/Spotify DH (Phase 119.2) | **PASS** |
| **R2** Dynamic / arbitrary stable field IDs | Schema ≠ DOM vocabulary; opaque IDs OK | Meuhedet Case C (`id_number`/`mobile_number`); **120.8 Blind-ID** `credential_a|b|c` (§23.4) | **PASS** |
| **R3** Delayed-input readiness (bounded) | Analyze/runtime waits then succeeds | Hapoalim readiness (119.3); Shufersal P4 after wait | **PASS** |
| **R4** Authoring Analyze and/or Visual | HIGH/MEDIUM or Visual → Save → Managed | Rivhit Analyze §23; Meuhedet/Spotify Visual 119.2; Blind-ID Analyze §23.4 | **PASS** |
| **R5** Deterministic Managed runtime | exact-one / fail-closed / shared engine | Phase 117 + 120.4/120.5/120.6 contracts + live fills | **PASS** |
| **R6** No silent legacy fallback after Managed selected | Managed fail closed; no generic fill | Shufersal P4 investigation (Managed fail-closed observed); orchestrator Managed-first when validated | **PASS** |
| **R7** Manual submit only | No auto-submit | Binding Phase 117/120; harness AC; live paths | **PASS** |
| **R8** No dedicated website adapter dependency | Config-only Managed for fixtures | 120.3.6 adapter stack removed; Shufersal/Rivhit/Meuhedet/Spotify Managed without site adapters | **PASS** |

**FA-120.3.3 overall: PASS** (composite evidence). No additional live fixture required unless Owner rejects evidence reuse.

---

### 24.3 Legacy / convergence residual mechanisms

| Mechanism | Disposition | Closure impact |
|---|---|---|
| Practice adapter (`POC_FILL_DEMO`) | **C — development-only / non-blocking** | Explicitly retained; not production DH |
| Legacy generic (`POC_GENERIC_FILL`) for non-Managed services | **B — retained temporary migration debt** | Allowed until dependents migrated; **not** Phase 120 blocker (D-120-10 / §11.3) |
| Medium allowlist / identity-first | **B — explicit temporary exception** | Multi-step unsupported generically; do not expand hosts; **not** closure blocker |
| Login Intelligence complex → open-only | **B — retained operational unsupported signaling** | Aligns with explicit UNSUPPORTED; **not** blocker |
| Empty legacy adapter map / retired HTZone stack | **PASS / removed** | 120.3.6 |
| POC Hub named helpers | **C / DEV debt** | Non-blocking |

**No remaining reachable legacy mechanism is classified A (Phase 120 closure blocker)** under current architecture.

---

### 24.4 Production Readiness (separate from Phase 120 architecture closure)

| Item | Class |
|---|---|
| Separate TEST/DEV vs Production backend/projects | **DEFERRED / NON-BLOCKING** (ops) |
| D-118-13 provider/security data-handling review (unrestricted production Admin Analyze) | **DEFERRED / NON-BLOCKING** (production readiness; Phase 118 carry) |
| Autofill health monitoring / mapping drift | **DEFERRED / NON-BLOCKING** (reserved; not authorized) |
| Extension onboarding/health/version visibility | **DEFERRED / NON-BLOCKING** (ops) |
| 120.FSC Fresh Service Creation | **DEFERRED / NON-BLOCKING** — **RESERVED / NOT AUTHORIZED**; not required for Phase 120 close |

---

### 24.5 Residual non-blocking Phase 120 debt

| Item | Class | Notes |
|---|---|---|
| §22 schema↔Autofill incomplete-mapping UX | **DEFERRED / NON-BLOCKING** | AUTHORING_CONTRACT_DEFECT; Manager DD later; **do not reopen 120.8** |
| Analyze empty-HIGH toast / no-overwrite presentation (§18 + Bank Hadoar 2026-09-22) | **DEFERRED / NON-BLOCKING** | Existing filled locators can block proposal apply while UI may show “no mappings”; **not** a 120.9 regression |
| Non-default mock `lexical_exact` / `semantic_non_lexical` fieldId fixtures | **DEFERRED / NON-BLOCKING** | Test-only residual (§21) |
| Exhaustive catalog migration onto Managed | **DEFERRED / NON-BLOCKING** | Explicitly out of scope (D-120-10) |
| Practice development/POC path | **DEFERRED / NON-BLOCKING** | §24.3 C — retained by design |
| Retained legacy generic dependents | **DEFERRED / NON-BLOCKING** | §24.3 B — temporary migration debt |
| Retained medium / identity-first exception | **DEFERRED / NON-BLOCKING** | §24.3 B — do not expand |
| Retained Login Intelligence complex/open-only | **DEFERRED / NON-BLOCKING** | §24.3 B — explicit UNSUPPORTED signaling |
| Future generic capabilities (modal / multi-step / iframe / Shadow DOM) | **DEFERRED / NON-BLOCKING** | Explicitly **not implemented**; out of Phase 120 |

---

### 24.6 Final gates (CLEARED — 2026-09-22)

| ID | Gate | Class | Evidence |
|---|---|---|---|
| **FA-120.9** | Authoring Locator Verification Integrity | **PASS** | §27 — Owner live L1–L4 **PASS**; automated R1–R15 Architecture ACCEPTED |
| **FA-CLOSE-1** | Owner formal acceptance of Final Acceptance Matrix | **PASS** | Owner ACCEPT MATRIX (pre-freeze) + FINAL CLOSURE REVIEW 2026-09-22 post-120.9 |
| **FA-CLOSE-2** | DH Managed smoke | **PASS** | Prior validated Rivhit DH three-field fill + no auto-submit; reconfirmed by **L4** Shufersal DH fill + no auto-submit |

**OPEN mandatory gates remaining: 0.**

---

### 24.7 Explicit Phase 120 closure criteria

Phase 120 may be formally **CLOSED** only when **all** are true:

1. FA-120.1 … FA-120.8 = **PASS** — **satisfied**.  
2. FA-120.3.3 R1–R8 = **PASS** — **satisfied**.  
3. **FA-CLOSE-1** = Owner **ACCEPT MATRIX** — **satisfied**.  
4. **FA-CLOSE-2** = **PASS** — **satisfied**.  
5. FA-120.9 / §25 disposition = **PASS** — **satisfied** (§27).  
6. No **BLOCKED** / **EVIDENCE GAP** rows remain — **satisfied**.  
7. No new capability work claimed as Phase 120 scope — **satisfied**.  
8. `PHASE.md` remains `PHASE=120` until Owner initiates next phase (Architect does **not** auto-advance to 121).

**After CLOSE:** residual §22 / Analyze UX / production-readiness / 120.FSC / legacy generic+medium / unsupported future capabilities remain as **post-120** work — they do **not** reopen Phase 120 unless Owner elevates.

---

### 24.8 Counts (summary — final)

| Class | Count |
|---|---|
| **PASS** (mandatory) | **24** (§24.1: 13 + §24.2: 8 + FA-120.9 + FA-CLOSE-1 + FA-CLOSE-2) |
| **LIVE TEST REQUIRED** | **0** |
| **EVIDENCE GAP** | **0** |
| **BLOCKED** | **0** |
| **DEFERRED / NON-BLOCKING** | retained (§24.4 Production Readiness + §24.5 debt) — **not** closure blockers |

Legacy residuals in §24.3 remain **accepted dispositions** (B/C) — **0** closure blockers.

---

## Architect Review (§24 — historical; superseded by §27)
ARCHITECT_REVIEW_STATUS: **Final Acceptance Matrix COMPLETE**; Phase 120 **FORMALLY CLOSED** (see §27)

### Review Notes
2026-09-22 — Matrix defined; later frozen by §25/120.9; 120.9 live L1–L4 cleared the freeze. FA-CLOSE-1/2 PASS. Deferred Production Readiness and authoring UX debt retained explicitly.

### Required Corrections
_None._

### Exact next step
See §27 — Phase 120 CLOSED. Do **not** start Phase 121 from this review.

---

## 25. Investigation — Visual Mapping “verified” with non-deterministic locator (2026-09-22)

**Scope:** Investigation only. **NO implementation. NO Manager DD. NO locator edits. NO site-specific logic.**

**Live evidence (Shufersal fixture — Final Acceptance):**
- Saved: `username`→`#j_username` HIGH + visual verified; `password`→`#j_password` HIGH + visual verified  
- Admin Test: `targets_not_ready · password · multi_match · #j_password`  
- Managed runtime fail-closed = **correct** (do not weaken exact-one)

**Historical evidence (120.2):** `#j_password` multi_match; Visual then produced `input[name="j_password"]` which passed parity/live fill.

**Phase 120 Final Closure:** historically **FROZEN** by this finding; **CLEARED** by §27 after 120.9 live L1–L4 PASS (2026-09-22).

---

### 25.1 Exact Visual Mapping code path (current)

```text
Admin «מיפוי חזותי»
  → Hub startVisualMappingForField
  → Ext ADMIN_VISUAL_MAPPING_START (background openPageAndVisualMapping)
  → inject generic/visual-target-pick.js (top document / MAIN world)
  → armVisualTargetPick({ expectedOrigin, fieldId })
  → Admin click (capture-phase; preventDefault)
  → isIdentifiableControl(el)          // identification ≠ eligibility
  → buildCandidates(el)                // ordered: #id, tag[name], autocomplete, aria
  → preferExactOneLocator(candidates, document)
       // first candidate with querySelectorAll(locator).length === 1
  → managedEligibleFor(el)             // shared ManagedTargetEligibility.isSafeFillTarget
  → ok:true { locator: chosen, locatorCandidates: full list, meta id/name }
  → Hub: if SAME effective target vs current form locator → KEEP current locator;
         else REPLACE with result.locator
  → applyVisualMappingAuthoring → visualMappingVerified=true (and may keep Analyze confidence)
  → UI chip «אומת במיפוי חזותי»
  → Persist only on Admin «שמור מיפוי»
```

Sources: `extension/generic/visual-target-pick.js`, `src/assistedMapping/visualMapping.ts`, `AutofillProfileEditor.requestVisualMapping`, `fieldAuthoring.visualTargetsEquivalent` / `applyVisualMappingAuthoring`.

---

### 25.2 Locator candidate generation and selection rules

**Generation (`buildCandidates`) — same family as Analyze inspect:**
1. `#` + CSS.escape(id) — hint `id` (**first**)  
2. `tag[name="…"]` — hint `name`  
3. `tag[autocomplete="…"]` — if not on/off  
4. `tag[aria-label="…"]` — truncated  

**Selection (`preferExactOneLocator`):** walk candidates in order; accept first with `document.querySelectorAll(locator).length === 1`; else fail `no_exact_one_locator`.

**Answers A–E:**

| Q | Answer |
|---|---|
| **A** Uniqueness before select? | **Yes** — at click time only (`preferExactOneLocator`) |
| **B** Exactly one element? | **Yes** — length === 1 at click time |
| **C** Same as clicked element? | **No explicit check** — does **not** assert `matches[0] === el` |
| **D** Same Managed eligibility? | **Yes** — `isSafeFillTarget` after locator choose; ineligible → fail (locator evidence only) |
| **E** Can `#id` outrank name when ID duplicated? | **At click time: No** — duplicate ID → length≠1 → skip to next. **After Hub SAME merge: Yes risk** — see §25.3 |

---

### 25.3 Meaning of «אומת במיפוי חזותי» (current)

`visualMappingVerified === true` means:

1. A Visual Mapping click completed successfully (`ok: true`), **and**  
2. Hub applied `applyVisualMappingAuthoring` (SAME or DIFFERENT path).

It does **NOT** currently mean:

- the **persisted form locator string** was re-validated as exact-one after merge, **or**  
- the locator equals Visual’s `preferExactOne` choice when SAME preserves a prior Analyze locator, **or**  
- uniqueness holds at Admin Test / activate / Digital Home time.

---

### 25.4 Critical authoring defect — 120.8 SAME (E2) + Analyze locator

`visualTargetsEquivalent` E2: SAME if Visual’s **full** `locatorCandidates` includes the **current** form locator (trim).

`preferExactOneLocator` returns `locatorCandidates: candidates` = **entire generated list**, including candidates that **failed** exact-one (e.g. `#j_password` when multi_match at click time).

**Provable failure sequence (matches Owner UI: HIGH + visual verified + `#j_password` + later multi_match):**

```text
1. Analyze proposes password → #j_password (HIGH) — candidate list prefers #id; no live uniqueness gate in Analyze safety
2. Prefill saves #j_password into form
3. Admin Visual Mapping clicks the intended password control
4. Extension may choose unique input[name="j_password"] via preferExactOne
   (or choose #j_password if unique at that instant)
5. Hub SAME via E2 because #j_password ∈ locatorCandidates for the clicked control
6. SAME → PRESERVE current #j_password (do not replace with unique name locator)
7. Stamp visualMappingVerified=true + keep Analyze HIGH
8. Admin Save / Admin Test → assessManagedTargetsReady → multi_match on #j_password
```

This is **TARGET IDENTIFICATION / click provenance** conflated with **LOCATOR DETERMINISM** of the **persisted** string.

**Historical vs current (`#j_password` vs `input[name="j_password"]`) — provable from code + timeline:**

| Era | Behavior |
|---|---|
| Pre-120.8 Visual success | Hub set locator to Visual’s **chosen** unique locator → `input[name="j_password"]` when `#id` failed exact-one at click |
| Post-120.8 SAME path | If Analyze already filled `#j_password` and E2 fires, Hub **keeps** Analyze locator while still showing visual verified |

DOM change alone is **not required** to explain the regression; the **120.8 SAME preserve** path is sufficient. DOM timing can still contribute if Visual alone selected `#j_password` during a transient unique window (late probes historically showed **persistent** multi_match — favors authoring-merge explanation when Analyze prefilled `#j_password`).

---

### 25.5 Analyze — semantic confidence vs locator determinism

| Layer | Behavior |
|---|---|
| Inspect `buildCandidates` | Emits `#id` first; **no** uniqueness filter |
| Safety validation | Locator ⊆ candidates; Managed eligibility on observed input; **no** `querySelectorAll` exact-one |
| Prefill HIGH/MEDIUM | Semantic/safety confidence on **field↔observed input**, not locator uniqueness |
| Result | HIGH may attach to `#j_password` even when that locator is / becomes multi_match |

**Conflation:** final `confidence: high` + prefilled CSS is presented as an approvable Managed locator without a separate **LOCATOR DETERMINISM** fact.

Invariant assessment (Owner proposed): **Consistent** with Phase 117 exact-one, 118 D-118-9 (locator from candidates), 119 Visual intent, 120.4 eligibility separation, 120.2-AP parity gate, and 120.8 provenance goals — **current Hub SAME E2 violates the spirit** of “visually verified ⇒ usable Managed locator.”

---

### 25.6 Runtime

Managed `assessManagedTargetsReady` / Admin Test fail on `multi_match` = **correct**.  
**Classification D (runtime defect): NO.**

---

### 25.7 Root-cause classification

| Code | Classification | Justification |
|---|---|---|
| **A** | Visual Mapping authoring contract defect | Missing `matches[0]===el`; success UI does not guarantee persisted locator is the unique chosen one |
| **B** | Analyze authoring contract defect | HIGH/prefill without locator exact-one determinism |
| **C** | Shared authoring defect (primary) | **120.8 E2 SAME preserves non-unique Analyze locator while stamping visual verified** |
| **D** | Runtime defect | **No** — fail-closed correct |
| **E** | Website/DOM change | **Possible contributing**, not required given C; historical late probes showed persistent multi_match |
| **F** | Insufficient evidence | **No** — code path is sufficient to explain |

**Primary: C** (with A+B contributing).

**Ownership / slice:** Authoring merge contract introduced/expanded in **120.8** (`visualTargetsEquivalent` E2 + preserve-on-SAME); Visual exact-one selection from **119.2**; Analyze candidate order from **118**; Managed exact-one from **117**. **Do not reopen 120.6.** Do not blame 120.6 visibility. **Do not reopen 120.8 as “identity decoupling failed”** — this is locator-determinism / SAME-merge, not fieldId semantics.

---

### 25.8 Phase 120 closure

| Item | Status |
|---|---|
| Closure blocked? | **YES — FROZEN** until Owner accepts disposition / correction path |
| §24 FA-CLOSE-1/2 | Must not complete overall CLOSE while §25 unresolved |
| 120.8 live acceptance §23 | Remains valid for identity/MEDIUM/provenance scope; **does not** waive this determinism defect |

---

### 25.9 Smallest GENERIC architectural correction (design only — NOT authorized to implement)

1. **Visual success persistence:** Persist / apply only a locator that passed exact-one **and** `matches[0] === clickedEl` at capture; never stamp `visualMappingVerified` on a different string.  
2. **SAME-target merge:** E2 must not treat “locator appears in candidates” as proof the **current** locator is deterministic. If current fails exact-one (or ≠ chosen unique), **DIFFERENT/replace** with chosen unique **or** fail honestly.  
3. **Analyze:** Separate semantic confidence from locator-determinism; do not prefill/HIGH-present a CSS string that fails exact-one when checkable; preserve identification without approvable Managed locator if none unique.  
4. **Shared contract:** Prefer one exact-one helper used by Visual choose, optional Analyze gate, and Managed assess (same document scope).  
5. **Regression:** Synthetic duplicate-id fixtures; no hostname/serviceId branches; no first-match; no Shufersal special case; 120.4 eligibility unchanged; failure honesty.

**Manager DD** only after Owner accepts §25 classification — **not** in this task.

---

### 25.10 Regression boundaries (must remain unchanged)

- Managed exact-one / fail-closed / no first-match  
- No silent Managed→generic fallback  
- No auto-submit  
- Shared Managed eligibility (120.4/120.6)  
- No site/hostname/serviceId Autofill branches  
- Schema-dynamic field IDs (120.8 identity decoupling)  
- Admin Test / DH share one Managed engine (D-120-12)

---

## Architect Review (§25)
ARCHITECT_REVIEW_STATUS: **§25 COMPLETE — PRIMARY C (shared authoring SAME/E2 + Analyze locator)**; runtime **correct**; Phase 120 closure **FROZEN**; **NO impl / NO DD yet**

### Review Notes
2026-09-22 — Traced Visual exact-one at click; Hub 120.8 E2 can preserve Analyze `#j_password` while stamping visual verified; Admin Test multi_match is correct Managed behavior. Historical name-locator success vs current id-locator matches this merge path.

### Required Corrections
_None in this investigation task._ Owner disposition next; then Manager DD for generic authoring fix if authorized.

### Exact next step
**Owner:** accept or correct §25 classification. Keep Phase 120 Final Closure **FROZEN**. Do not implement yet.

---

## 26. Slice 120.9 — Authoring Locator Verification Integrity (2026-09-22)

### Status
**AUTHORIZED — Manager Detailed Design ONLY.**  
**STOP after DD** for Architecture review.  
Developer implementation **NOT AUTHORIZED** until Architecture PASS on the 120.9 DD.

**Source:** §25 (Owner ACCEPTED root cause).  
**Classification:** **C** shared authoring defect + **A** Visual integration + **B** Analyze locator determinism.  
**Managed Runtime:** correct — **MUST NOT** be changed.

### Goal
A locator may be represented as **visually verified** only when the locator that is **actually persisted** has itself satisfied the deterministic Visual Mapping verification contract.

```text
Target identity equivalence  ≠  Locator equivalence / determinism
```

### Binding invariant (normative)

Visual Mapping already identifies the clicked target and selects a locator using exact-one validation.

After Visual Mapping succeeds:

1. The **persisted** locator must itself be proven **exact-one**.  
2. It must resolve to the **same clicked target**.  
3. It must satisfy the authoritative **Managed eligibility** contract (120.4/120.6).  

The **120.8 SAME / E1–E3** provenance logic **MUST NOT** allow an existing Analyze locator to survive merely because it appears in Visual Mapping candidate evidence.

Specifically forbidden implication:

```text
"existing locator ∈ target's locatorCandidates"
    ≠
"existing locator is deterministic and visually verified"
```

If Visual Mapping selects a **different verified unique** locator for the **same** target:

- preserve target identity / useful provenance appropriately, **and**  
- the persisted Managed locator **MUST** be the Visual **verified deterministic** locator.

Do **not** solve by restoring any historical Shufersal selector (`input[name="j_password"]` is fixture evidence only).

### Analyze (Manager must define smallest generic treatment)

- **Semantic confidence** and **locator determinism** are separate dimensions.  
- HIGH = confidence that the observed control corresponds to the credential field.  
- HIGH **MUST NOT** mean an unsafe/non-unique locator is suitable for Managed execution.  
- Define where generic locator determinism is checked before an Analyze proposal becomes an **approvable/persistable Managed locator**.  
- Preserve useful identification evidence when semantics are strong but determinism fails.  
- Do **not** weaken 120.8 HIGH/MEDIUM authoring semantics except locator **eligibility** for Managed persistence/prefill.

### Hard stops / must not change

| Forbidden | |
|---|---|
| Managed runtime exact-one / multi_match fail-closed | STOP — do not weaken |
| 120.4/120.6 Managed eligibility contract | STOP |
| Digital Home Managed selection / no-fallback / readiness | STOP |
| 120.8 fieldId opaque / semantic decoupling | STOP — not this defect |
| HIGH/MEDIUM confidence **meaning** (except locator eligibility) | STOP |
| Admin Test execution mechanism / approval/parity safety / no-auto-submit | STOP |
| Hostname / serviceId / Shufersal / Rivhit special cases | STOP |
| First-match / hardcoded selectors | STOP |
| Reopen 120.6 | STOP |
| Classify as failure of 120.8 identity decoupling | STOP |
| Accept 120.9 on unit tests alone | STOP — regression lock mandatory |

### Regression lock — automated (mandatory in DD)

Manager DD **MUST** define synthetic fixtures covering at minimum:

| ID | Contract |
|---|---|
| **R1** | Analyze locator exact-one |
| **R2** | Analyze semantic match with non-unique locator → no approvable unsafe Managed locator |
| **R3** | Visual Mapping unique selected locator |
| **R4** | SAME target + existing Analyze locator non-unique + Visual unique → **persisted = Visual unique** |
| **R5** | SAME target + existing locator independently proven deterministic → provenance truthful |
| **R6** | DIFFERENT target behavior from 120.8 remains correct |
| **R7** | Visual verification badge only for locator that actually satisfied Visual verification |
| **R8** | multi_match continues to fail closed in Managed runtime |
| **R9** | 120.4 managed eligibility regression |
| **R10** | 120.6 visibility/occlusion regression |
| **R11** | 120.8 opaque fieldId / semantic decoupling regression |
| **R12** | HIGH/MEDIUM persisted provenance regression |
| **R13** | Admin Test regression |
| **R14** | Clear Mapping regression |
| **R15** | Phase 117 deterministic Managed regression |

Existing relevant verification suites must remain **PASS**.

**120.9 MUST NOT be Architecture-accepted on new unit tests alone.**

### Live regression lock (after impl evidence)

Architect must **NOT** close 120.9 until Owner live verification is authorized.

Capability-based live checks (fixtures only; reuse; no unnecessary migrations):

1. Newly discovered duplicate-locator / SAME-merge case corrected.  
2. Existing normal HIGH Analyze case still works.  
3. 120.8 Blind-ID semantic case still works.  
4. Existing Managed runtime fixture still fills correctly with **no** submit.

### Phase 120 closure

Final Closure remains **FROZEN**.  
**120.9 is a mandatory Phase 120 closure blocker** until:

1. Architecture PASS on Manager DD  
2. 120.9-impl Architecture ACCEPTED  
3. Automated regression lock PASS (R1–R15 + existing suites)  
4. Required Owner live evidence PASS  

### 120.8 / 120.6 status

- **120.6:** CLOSED — do not reopen.  
- **120.8:** Historically accepted for identity/MEDIUM/provenance contracts — do not reopen as failed decoupling.  
- **120.9:** Corrects Analyze locator evidence + Visual exact-one selection + persisted authoring provenance integration.

---

## Architect Review (§26 / 120.9)
ARCHITECT_REVIEW_STATUS: **120.9 FORMALLY CLOSED / ARCHITECTURE ACCEPTED**; Phase 120 **FORMALLY CLOSED** (see §27); **120.6/120.8 identity CLOSED**

### Review Notes
2026-09-22 — DD PASS; 120.9-impl Architecture ACCEPTED (R1–R15); Owner live L1–L4 **PASS** (§27).

### Required Corrections
_None._

### Exact next step
See §27. Do **not** start Phase 121 from this review.

---

## 27. Phase 120 Formal Closure (2026-09-22)

### 27.1 120.9 LIVE OWNER ACCEPTANCE — **PASS**

| # | Result | Evidence (Owner) |
|---|---|---|
| **L1** | **PASS** | Shufersal: Analyze `#j_password` → Visual → persisted `input[name="j_password"]` + «אומת במיפוי חזותי» + Save; Admin Test filled username+password; prior `multi_match · #j_password` did not recur |
| **L2** | **PASS** | Rivhit synthetic: Analyze `#username`/`#password` HIGH, `#osek` MEDIUM; Save; Admin Test filled all three; no Visual required |
| **L3** | **PASS** | Same Blind-ID fixture: opaque field IDs; semantic mapping without fieldId affinity; Admin Test filled all three (L2+L3 shared execution) |
| **L4** | **PASS** | Shufersal Digital Home: username+password filled; **no** auto-submit; site waited for manual Login |

**Automated (prior Architecture ACCEPTED):** R1–R15 PASS; required suites PASS; `tsc` PASS; no deviations; Managed runtime / 120.4 / 120.6 / 120.8 identity unchanged.

**Non-blocking observation retained:** Bank Hadoar Analyze/no-overwrite presentation when locators already filled — §24.5 debt; **not** a 120.9 regression. `not_configured` DH absence expected.

### 27.2 Slice 120.9 — **FORMALLY CLOSED / ARCHITECTURE ACCEPTED**

Closure date: **2026-09-22**.

### 27.3 Final Acceptance Matrix — final state

| Class | State |
|---|---|
| FA-120.1 … FA-120.8 | **PASS** |
| FA-120.3.3 R1–R8 | **PASS** |
| FA-120.9 | **PASS** |
| FA-CLOSE-1 | **PASS** |
| FA-CLOSE-2 | **PASS** |
| BLOCKED / EVIDENCE GAP / LIVE TEST REQUIRED (mandatory) | **0** |

### 27.4 Accepted runtime / authoring architecture state

```text
Admin authors configuration (Analyze / Visual / Manual)
  → semantic confidence ≠ locator determinism
  → Visual verified ⇒ persisted locator is exact-one + same click + Managed-eligible
  → Admin validates (parity / Admin Test = same engine)
  → validated Managed definition is authoritative
  → one Managed Autofill runtime executes (exact-one / fail-closed / no first-match / no silent legacy fallback / no auto-submit)
  → no site/hostname/serviceId special production Autofill required for supported simple login
```

Legacy residuals (Practice / generic dependents / medium / LI complex) remain **explicit debt**, not target architecture.

### 27.5 PHASE 120 — **FORMALLY CLOSED / ARCHITECTURE ACCEPTED**

**Closure date:** 2026-09-22.

Mandatory closure criteria §24.7: **all satisfied**.

### 27.6 Retained Production Readiness gates / debt (explicit — NOT complete)

| Gate / debt | Status |
|---|---|
| Separate TEST/DEV vs Production backend/projects | **OPEN — Production Readiness** |
| D-118-13 provider/security data-handling (unrestricted production Admin Analyze) | **OPEN — Production Readiness** |
| 120.FSC Fresh Service Creation validation | **RESERVED / NOT AUTHORIZED** |
| Autofill health / mapping drift monitoring | **RESERVED / NOT AUTHORIZED** |
| Extension onboarding / health / version visibility | **OPEN — ops debt** |
| §22 schema↔Autofill Admin authoring UX | **DEFERRED debt** |
| Analyze no-overwrite / empty-result presentation UX | **DEFERRED debt** |
| Practice POC path; legacy generic; medium/identity-first; LI complex/open-only | **Retained temporary / explicit** |
| Future: modal activation, multi-step, iframe, Shadow DOM | **NOT implemented** |

### 27.7 Explicit non-actions

- Do **not** start Phase 121 from this closure record alone.  
- Do **not** implement Production Readiness items as part of Phase 120.  
- Do **not** claim unsupported future capabilities as shipped.  
- `PHASE.md` remains `PHASE=120` until Owner initiates next phase.

---

## Architect Review (§27 — FINAL)
ARCHITECT_REVIEW_STATUS: **PHASE 120 FORMALLY CLOSED / ARCHITECTURE ACCEPTED** (2026-09-22)

### Review Notes
Owner live L1–L4 PASS clears 120.9. FA-CLOSE-1/2 PASS. Full §24 matrix mandatory rows PASS. Deferred Production Readiness and authoring/legacy debt retained explicitly. No mandatory OPEN / LIVE / BLOCKED / EVIDENCE GAP remains.

### Required Corrections
_None._

### Exact next step
**STOP.** Phase 120 closed. Owner may later authorize Phase 121 or Production Readiness work separately. Do **not** auto-start either.

---

## 28. POST-120 Investigation — Visual Mapping “managed-ineligible” on apparently eligible input (2026-09-22)

**Status:** INVESTIGATION ONLY. Phase 120 remains **FORMALLY CLOSED** — **not reopened**.  
**Fixture:** Internet Rimon personal-area login (evidence only — **no** site-specific product requirement).  
**Out of scope:** route-selection capability, modal support, implementation, DD, Phase 121.

### 28.1 Owner live report

Hub message shown:

```text
השדה זוהה, אך אינו כשיר למילוי אוטומטי מנוהל.
```

No locator persisted/displayed. Clicked control (manual inspect):

| Property | Observed |
|---|---|
| tag | `INPUT` |
| name | `user_name` |
| type | `text` |
| disabled / readOnly | false |
| aria-hidden self / ancestor | null |
| clientRects | 1 |
| approx size | ~158.4 × 28 |
| computed | display block; visibility visible; opacity 1; pointer-events auto |
| V8-style 5-point `elementFromPoint` | **all five** → same `INPUT[name=user_name]` (`isTarget=true`) |

Page context: parallel login routes (password / SMS). Route-selection itself is **future** work — not attributed as the root cause without path evidence.

### 28.2 Exact Visual Mapping rejection path (repository)

```text
Admin Visual Mapping click (top document capture)
  → event.target (text node → parentElement)
  → isIdentifiableControl(el)     // A: identification
  → buildCandidates(el)           // id → name → autocomplete → aria only
  → preferExactOneLocator(...)    // C: first candidate with querySelectorAll.length === 1
  → assertLocatorDeterministic(chosen, el, doc)  // C: matches[0] === clickedEl
  → managedEligibleFor(el)        // B: ManagedTargetEligibility.isSafeFillTarget
       → isVisible + V8 hit-test
  → ok:true { locator }  OR  ok:false { reason, state }
  → Hub visualMapping.ts maps reason → Hebrew message
  → Admin UI shows result.message only (detail/reason not surfaced)
```

Sources: `extension/generic/visual-target-pick.js`, `managed-target-eligibility.js`, `src/assistedMapping/visualMapping.ts`, `AutofillProfileEditor.requestVisualMapping`.

### 28.3 Generated locator candidates (for this control shape)

Clicked element has **no `id`**, **name=`user_name`**, type text; Owner did not report `autocomplete` / `aria-label`.

| Candidate family | Expected for this click |
|---|---|
| `#id` | **absent** (no id) |
| `input[name="user_name"]` | **present** (primary / likely only candidate) |
| autocomplete / aria | **absent** unless attributes exist |

**Placeholder is not a candidate source** (current contract).

Exact-one for `input[name="user_name"]`:

| Condition | `preferExactOneLocator` |
|---|---|
| Exactly one match in top `document` | chooses that locator → continues to same-target + Managed eligibility |
| **≥2** matches (e.g. password route + SMS route both expose `name=user_name`) | returns **null** → Ext reason **`no_exact_one_locator`** |

Owner did **not** report live `document.querySelectorAll('input[name="user_name"]').length`. Parallel routes make **multi_match ≥ 2** the leading hypothesis for rejection **before** Managed eligibility runs.

### 28.4 Extension reject points that use state `IDENTIFIED_BUT_MANAGED_INELIGIBLE`

| Order | Ext `reason` | Meaning (architecture) | Dimension |
|---|---|---|---|
| 1 | `no_locator_candidates` | identified, no CSS candidates | **C** (generation) |
| 2 | `no_exact_one_locator` | identified, no exact-one candidate | **C** (determinism) |
| 3 | `locator_target_mismatch` | exact-one string ≠ clicked identity | **C** / Visual integrity |
| 4 | `managed_ineligible` + `detail` | `isSafeFillTarget` false | **B** (eligibility) |

Managed eligibility is evaluated **only after** steps 1–3 succeed. Owner’s manual V8 five-point PASS makes true **B** failure **unlikely** for the inspected node, but does not prove Ext did not later fail **B** on a different moment/element.

### 28.5 Hub message mapping (critical)

`VISUAL_MAPPING_MANAGED_INELIGIBLE_LABEL_HE` =
«השדה זוהה, אך אינו כשיר למילוי אוטומטי מנוהל.»

Hub assigns that **same** label when Ext reason is:

- `managed_ineligible` (**B**)
- `no_exact_one_locator` (**C**)
- `locator_target_mismatch` (**C**)
- `no_locator_candidates` when marked identified (**C**)

Existing unused authoring string:

```text
LOCATOR_NOT_DETERMINISTIC_LABEL_HE =
  "זוהה, אך הבורר אינו חד-משמעי למילוי מנוהל"
```

Admin UI displays **`message` only** — Ext `reason` / `detail` (e.g. `occluded`) are **not** shown.

**Therefore:** the Hebrew string Owner saw is **not proof** that Managed eligibility failed. It is consistent with **C** collapsing into a **B**-worded presentation.

### 28.6 Answers to Owner checklist

1. **Exact clicked target (Owner):** `INPUT[type=text][name=user_name]` — identifiable.  
2. **Generated candidates (inferred from code + attrs):** primarily `input[name="user_name"]`; no id/autocomplete/aria reported.  
3. **Exact-one:** **unknown live count** — if `querySelectorAll('input[name="user_name"]').length !== 1`, Ext rejects at `preferExactOneLocator` with `no_exact_one_locator`.  
4. **Managed eligibility result/subreason:** **not proven for this click**. Manual inspect implies would **PASS** V1–V3/V5–V8 for that node; Ext `detail` was not captured.  
5. **Reject point:** **insufficient live Ext reason**. Architecturally ordered: candidates → exact-one → same-target → **then** Managed eligibility. Leading evidence favors fail at **exact-one (C)** given dual-route naming; **B** not ruled out without Ext payload.  
6. **Hub message accuracy:** **NO** if failure was **C** — message asserts Managed ineligibility (B). **YES** only if Ext reason was truly `managed_ineligible`.  
7. **Classification:**
   - **E — Hub presentation/classification defect** — **CONFIRMED** (code): C reasons mapped to B Hebrew; distinct locator-not-deterministic string unused on Visual path; UI hides `reason`/`detail`.  
   - **B — locator-generation/determinism gap** — **LIKELY** for this fixture (name-only control + probable duplicate `user_name` across routes; no alternate unique candidate). Confirm with live matchCount.  
   - **A — expected unsupported capability** — **partial / conditional**: if page truly has only non-unique name and no id/autocomplete/aria, current candidate family cannot author a Managed locator without a new **generic** strategy — that is a post-120 capability/authoring limit, **not** a Rimon special case. Route-selection UI itself is separate future work.  
   - **C — Managed eligibility defect** — **NOT supported** by current evidence (manual V8 PASS).  
   - **D — Visual Mapping defect** (wrong element / wrong contract) — **NOT indicated**; identification occurred; order of gates is intentional.  
   - **F — timing/state** — **H / possible but unproven**.  
   - **H — insufficient evidence** — **YES** for definitive Ext reject reason of this click (need Ext `reason`, optional `detail`, `locatorEvidence`, and `querySelectorAll('input[name="user_name"]').length`).  
8. **Phase 120 impact:** **New post-120 finding.** Does **not** reopen or invalidate Phase 120 closure. Managed exact-one / eligibility contracts remain correct. Finding is authoring path honesty + possible locator-candidate sufficiency on multi-route duplicate-name pages.  
9. **Smallest generic architectural implication (no DD / no impl):** Keep **A/B/C dimensions separate** in Visual Mapping outcomes and Hub copy — do not report locator non-determinism as Managed ineligibility. Any later candidate enrichment must stay **generic** (no hostname/site branches); route-selection remains a separate future login-experience capability.

### 28.7 Optional Owner confirmations (evidence only — not implementation)

On the same page state as the Visual click failure:

1. `document.querySelectorAll('input[name="user_name"]').length`  
2. Extension / Hub response `reason` (and `detail` if present)  
3. Whether SMS-route controls also use `name="user_name"` (or other duplicate names)

### 28.8 Hard stops honored

No implementation. No Phase 120 reopen. No eligibility weaken. No Rimon/modal/route-selection design. No DD. No Phase 121 definition.

---

## Architect Review (§28)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION COMPLETE**; Phase 120 **remains CLOSED**; **no DD / no impl**

### Review Notes
Confirmed Hub collapse of locator-determinism Visual failures into Managed-ineligible Hebrew. Leading fixture hypothesis: non-unique `input[name="user_name"]` → `no_exact_one_locator`. True Managed eligibility failure not evidenced by Owner V8 checks. Need Ext `reason` + matchCount to lock root cause.

### Required Corrections
_None (investigation only)._

### Exact next step
**STOP.** Owner may optionally supply §28.7 evidence. Do **not** implement. Do **not** open DD until Owner elevates a post-120 slice.

