# Architecture Phase 108

## Phase Identifier
PHASE=108

## Status
STATUS: APPROVED_WITH_DEFERRED_U27

## Amendment
AMENDED: 2026-07-12 — **Consumer false-positive gate** (Zap business `/login`, modal-on-primary, Mizrahi-class). Adds D-108-14 … D-108-17 and AC-108-18 … AC-108-20.

AMENDED: 2026-07-12 (evening) — **True-positive preservation / anti-over-rejection** after M9 broke previously successful discoveries. Revises D-108-14…16, adds **D-108-18**, **AC-108-21**, milestone **M10**. Reject only with **positive evidence** of wrong audience or modal-only surface; do not blank-reject ordinary consumer `/login` pages.

AMENDED: 2026-07-12 (night) — **M10 live failure / process correction.** Developer claimed M10 COMPLETE on static fixtures while operator live add/rediscover still leaves `login_url=NULL` for previously successful sites (admin + custom). Adds **D-108-19**, **D-108-20**, milestone **M11**. Static fixtures are necessary but **not sufficient**. Live U22 is a hard gate. Architect rejects M10 “COMPLETE” until live evidence passes.

AMENDED: 2026-07-13 — **Trusted-auth priority / Bank Hapoalim-class over-reject (M12).** Live rediscovery finds a consumer auth URL (e.g. `https://login.bankhapoalim.co.il/ng-portals/auth/he/login`) but persists `login_url=NULL` with `needs_review`, `rejectedLoginUrl` set, reason “Consumer login is modal-based; alternate portal candidate rejected.”, `loginIntelligenceHint=alternate_audience_portal`, `phase112Deferred=true`. Root cause: audience gate lets **homepage modal** and/or **weak alternate-audience wording** veto a **trusted consumer auth host** on the same brand; SPA path tokens like `ng-portals` and retail Hebrew like `כניסת לקוחות` are treated as portal evidence. Adds **D-108-21 … D-108-23**, **AC-108-22**, milestone **M12**. Zap-class reject stays mandatory. Phase 112 must **not** own “found navigable consumer URL but gate blanked it.”

AMENDED: 2026-07-13 (evening) — **Trusted-auth host probe / KSP-class discovery gap (M13).** Operator live KSP rediscovery: `method=common-path`, `loginUrl=https://ksp.co.il/login` (dead page), `confidence=low`, `outcome=needs_review`, `rejectedLoginUrl=null`, `success=false`. Real consumer login is `https://auth.ksp.co.il/login?...` but was **never found** as a link on `primaryUrl`. M12 gate accept is insufficient when discovery never candidates the auth host. Adds **D-108-24**, **D-108-25**, **AC-108-23**, milestone **M13**. Same-brand trusted-auth hosts must be **probed** when DOM/link discovery yields no high-confidence consumer URL; low-confidence inventing of same-origin `/login` must not win over a validated auth-host probe. Zap REJECT and discovery boundary (no credentials/fill/submit) unchanged.

AMENDED: 2026-07-13 (night) — **Validated common-path persist / GitHub-class (M13 expanded).** Operator live GitHub rediscovery: `loginUrl=https://github.com/login` (correct consumer login page), `method=common-path`, `confidence=low`, `outcome=needs_review`, `success=false`. Persist policy currently blank-rejects **all** `common-path` / `confidence=low` — correct for dead KSP invents, **wrong** for real same-origin `/login` pages. Adds **D-108-26**, expands **AC-108-23**. Validate then persist: same-origin `/login` with login-page evidence + audience pass must store `login_url`; only **unvalidated** / unreachable / non-login common-path stays `needs_review` / NULL.

AMENDED: 2026-07-13 (late) — **Federated / parent IdP accept (M14) + M13 KSP persist unfinished.** Operator: after M13, GitHub ACCEPTs; Trello finds correct `https://id.atlassian.com/login?application=trello--direct-signup&continue=https://trello.com/auth/atlassian/callback` but outcome `needs_review` / not persisted (cross-registrable IdP vs `trello.com`). KSP probe now lists `auth.ksp.co.il/login` and `/signin` in `topCandidates` (score 8, confidence low) but `loginUrl=null`, `reason=login_entry_not_found` — **M13 U24 not done** (validate+persist probed same-brand auth hosts). Adds **D-108-27**, **AC-108-24**, milestone **M14**. Federated IdP ACCEPT when trusted IdP host + return/continue/callback ties to primary brand. Zap REJECT unchanged.

AMENDED: 2026-07-14 — **Live candidate page validation + sibling-TLD brand (M15).** Operator: **M13 complete** (KSP ACCEPT **and** Zap NULL — dual gate preserved). PayPal: `topCandidates` include correct `https://www.paypal.com/login` (score 25) plus weak `auth.paypal.com/*` invents; result `loginUrl=null`, `no_login_page_found` — scored by path **without** opening the page. Zoom: `https://zoom.us/signin` found high-confidence from `zoom.com` but rejected as modal/portal (`zoom.com`≠`zoom.us`). Adds **D-108-28**, **D-108-29**, **AC-108-25**, milestone **M15**. Live-validate reachable + ≥1 identity field; sibling-TLD same SLD. **Hard dual gate unchanged:** Zap `login_url` must stay **NULL** (never `sa.zap…` / business-interface `/login`). **Identity-field presence alone must NOT accept alternate-audience portals** — Zap’s business login also has form fields; audience gate (D-108-15) runs and wins over field validation. Claiming M15 COMPLETE without live Zap NULL + PayPal/Zoom PASS is a process failure (same lesson as M13 KSP↔Zap).

AMENDED: 2026-07-14 (operator closeout) — **M15 accepted with PayPal deferred (U27).** After repeated discovery churn, operator live green set is: **Zap NULL + KSP non-NULL + Zoom non-NULL**; **PayPal `login_url` empty again** (earlier live success regressed). Further heuristic churn risks re-breaking Zap/KSP/Zoom. Adds **D-108-31**. Operator prioritizes advancing the program; PayPal auto-discovery deferred to a later Phase 108 follow-up (**M16** or reopen U27) — **not** Phase 112. Interim: catalog seed / admin `loginUrl=https://www.paypal.com/login` with `loginUrlSource=admin|catalog_seed`. Freeze discovery-gate churn unless a later milestone explicitly reopens PayPal.

## Phase Goal
Deliver **Browser Integration and Login Discovery**: Chrome and Edge extension support via a **browser integration abstraction**, production packaging strategy, graceful Hub degradation without extension — and a **unified login-entry discovery pipeline** that enriches `service_registry` with a **confident consumer** `loginUrl` (or safely leaves it `NULL` with Phase 112 deferral metadata) on custom-service add and admin refresh — **without** autofill, credentials, form submit, or execution-path changes (AC-108-10, discovery boundary).

Phase 108 owns **browser host integration**, **DiscoveryExecutor** behavior, **loginUrl metadata persistence rules**, **evidence-based false-positive rejection**, **true-positive preservation**, **discovery deferral signals**, and **bulk refresh orchestration**. It does not own admin console chrome (107 UI), standard autofill coverage (110), **authoritative** complex login classification / modal interaction (112), full URL canonicalization (113), or credential lifecycle (109).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=108`
- `team-Yuri/PLAN.md` §13 — Browser Compatibility; §18 — Phase 108 (AC-108-1 … AC-108-25)
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
| **D-108-5: Discovery boundary (strict)** | AC-108-10, AC-108-18…22, PLAN non-goals | Discovery identifies a **consumer** login entry from `primaryUrl` when evidence supports it. **Forbidden:** credential use, autofill, form submit, CAPTCHA/OTP, adapter execution, multi-step login intelligence, persisting alternate-audience portals, inventing navigable URLs when the **only** consumer path is modal-on-primary. Responsibility ends at `loginUrl` persistence **or** evidence-based `NULL` + Phase 112 deferral metadata. **Must not** over-reject ordinary consumer login pages or same-brand trusted auth hosts (AC-108-21, AC-108-22). |
| **D-108-6: DiscoveryExecutor tab isolation** | AC-108-16 | Production executor: **extension-owned background tab** for DOM inspection (`HUB_LOGIN_ENTRY_DISCOVERY`). Tab **must close** on success, failure, timeout, or cancel. Discovery tabs are **never** reused for Digital Home execution opens. Execution tabs use `executeServiceFromTile` / `openUrlInNewTab` — separate lifecycle. Document timeout budget in Manager plan. |
| **D-108-7: Registry metadata contract** | AC-108-7, AC-108-8 | Persist on `service_registry`: `primary_url` (always on create); `login_url` when confident; `login_url_status` (normative set below); `login_fields` when discovered; `metadata` patch via `buildDiscoveryMetadataPatch`: `loginUrlSource`, `loginUrlConfidence`, `loginUrlLastDiscoveredAt`, `loginUrlLastCheckedAt`, `loginUrlDiscoveryError`, `discoveryMethod`, `lastDiscoveryOutcome`. Map legacy Phase 102 `unknown`/`valid`/`invalid` to expanded statuses where needed (migration). |
| **D-108-8: login_url_status (normative)** | AC-108-8 | Allowed values: `valid`, `missing`, `stale`, `failed`, `needs_review`, plus transitional `unknown`/`invalid` from Phase 102 until migrated. **missing** — no loginUrl after discovery attempt; **failed** — discovery error; **stale** — admin-marked or heuristic; **needs_review** — low confidence candidate. Service creation **never blocked** solely by status. |
| **D-108-9: loginUrlSource + admin override** | AC-108-15, AC-108-11 | `metadata.loginUrlSource`: `auto` \| `admin` \| `user` \| `unknown`. **Admin manual edit** sets `loginUrlSource=admin` and `login_url_status=valid`. Automated rediscovery/bulk refresh **must not overwrite** `admin` URLs unless operator passes **explicit force/approve** flag (admin UI checkbox or dedicated action). |
| **D-108-10: Admin discovery operations (API layer)** | AC-108-11 … AC-108-14 | Phase 108 delivers **engine + API** (in `adminRegistryApi` / registry layer): single-service rediscovery, **bulk refresh** with rate limit + partial failure report. Phase 107 admin **UI** wires buttons to these APIs — 108 owns semantics, idempotency, and metadata rules. Bulk refresh: queue global + eligible user rows; skip `loginUrlSource=admin` unless forced; concurrency cap; per-row error collection; non-blocking UI. |
| **D-108-11: Custom service create flow** | AC-108-6 … AC-108-9 | On user add: normalize URL (Phase 113 rules **where already available** — no new canonicalization engine); upsert registry row; attempt discovery with `source:user`, `force:true`; persist metadata; link `user_services` + vault selection per Phase 104 persist-first rules. Failure → friendly message; service remains created with `primary_url`. |
| **D-108-12: No execution regression** | Phase 103 | **Do not** modify `executeServiceFromTile` orchestration, autofill engine, or tile open behavior except routing messaging through abstraction layer with identical outcomes. Re-run `verifyPhase103Execution.mjs` as regression gate. |
| **D-108-13: Extension discovery message contract** | AC-108-1, AC-108-2 | Normative message: `HUB_LOGIN_ENTRY_DISCOVERY` with `{ primaryUrl }` → `{ ok, discovery \| reason }`. Background opens tab, injects/runs `discoverLoginEntry` engine, closes tab. Hub extension version aligned with manifest (bump documented in migration guide). |
| **D-108-14: Dual-objective gate (revised)** | AC-108-18…22 | **Two objectives, equal weight:** (1) never persist a **wrong** login page; (2) **preserve true positives** — ordinary consumer login pages and same-brand trusted auth hosts that discovery found must still persist. **Reject only with positive evidence** of alternate audience (portal wording/URL/title) **or** modal-only consumer login with **no** separate consumer navigable candidate (including trusted auth). Keyword/`/login` path alone is never enough to **accept a portal**, and also never enough by itself to **reject a same-origin / trusted-auth consumer candidate** that has a dedicated login form / strong link evidence. Weak uncertainty (e.g. homepage also has a login button) must **not** blank all navigable results. |
| **D-108-15: Reject alternate-audience portals** | AC-108-18, AC-108-22 | Candidates with **strong positive** business/merchant/partner/admin/vendor signals must be rejected (Zap `sa.zap.co.il/.../login` — “כניסה לממשק העסק”). Persist: `login_url=NULL`, `rejectedLoginUrl`, `phase112Deferred`, `loginIntelligenceHint=alternate_audience_portal`. Clear auto false-positives on rediscovery (never clear `loginUrlSource=admin`). **Do not** treat “portal sibling link somewhere on the page” as a veto of a stronger same-origin **consumer** candidate. **Do not** treat same-brand trusted auth hosts as portals without strong positive evidence on that candidate (D-108-21…23). |
| **D-108-16: Modal-on-primary is selective (revised)** | AC-108-19, AC-108-21, AC-108-22 | Apply modal-only → `NULL` **only when** consumer login is modal/overlay on `primaryUrl` **and** there is **no** separate validated consumer navigable login URL (including same-brand **trusted auth hosts** — D-108-21). A modal **trigger** on the homepage must **not** veto an otherwise valid navigable consumer `/login` (or equivalent) candidate, and must **not** short-circuit evaluation before trusted-auth accept. When modal-only: `loginEntryType=modal`, `usesModal=true`, `phase112Deferred=true`, `loginIntelligenceHint=modal_on_primary`. |
| **D-108-17: Complex navigable surfaces (Mizrahi-class)** | AC-108-20, Phase 112 boundary | If a **consumer** navigable login page exists but login still needs an extra floating step: Phase 108 **may store** that navigable consumer URL when audience is consumer; set `loginIntelligenceHint=complex_login_surface` / `phase112Deferred=true`. Do **not** NULL it merely because a modal step exists on the correct consumer page. Phase 108 does not open/fill the modal. |
| **D-108-18: True-positive regression gate** | AC-108-21, AC-108-22 | M9–M12 changes must not wipe previously successful consumer discoveries. Required regression set: at least **Shufersal**, **Clalit**, **HTZone**, plus **Bank Hapoalim-class trusted-auth ACCEPT** and **Zap REJECT**. After **live** rediscovery/add, `login_url` must remain non-NULL and consumer-valid unless the live site genuinely changed. Static fixtures must include **accept** cases, not only reject cases — and must not be used alone to claim COMPLETE. |
| **D-108-19: Live path is the authority** | AC-108-21, AC-108-22 | Production discovery for custom add and admin rediscovery runs through the **extension** (`HUB_LOGIN_ENTRY_DISCOVERY` → bundled `login-entry-discovery.js`). Hub/JSDOM fixture passes are **not** proof of live behavior. After every discovery-engine change: (1) `npm run build` / `build:extension-discovery`, (2) **reload the side-loaded extension**, (3) re-run Hub, (4) execute live U22 / U23. Claiming M10–M12 done without live dual-gate evidence is a process failure. |
| **D-108-20: Operator-visible discovery outcome** | AC-108-8, AC-108-21 | After every custom add / admin rediscovery, the operator must be able to see **why** `login_url` is NULL or set — at minimum in admin Integration Status / discovery metadata: `loginUrlDiscoveryOutcome`, `loginUrlDiscoveryError` / reason, `discoveryMethod`, `loginUrlConfidence`, `rejectedLoginUrl`, `phase112Deferred`, `loginIntelligenceHint`. Developer debugging must capture the raw extension discovery payload for failed live U22/U23 rows before further gate tuning. Blind “fixed again” without this evidence is not acceptable. |
| **D-108-21: Trusted consumer auth host priority** | AC-108-22 | Same-brand trusted auth subdomain (`login`, `auth`, `signin`, `secure`, `e-services`, `services`, `online`, and equivalents already in discovery keywords) that yields a consumer navigable login URL **ACCEPT** unless the **candidate itself** has **strong positive** alternate-audience evidence. Evaluation order: (1) strong positive alternate-audience on **this** candidate → reject candidate; (2) else if trusted auth (or dedicated consumer login path) on same brand → **accept**, even when `primaryHasModalLoginTrigger`; (3) else apply cross-subdomain / modal rules. Homepage modal must never run as a blanket veto **before** step (2). |
| **D-108-22: Narrow weak alternate-audience wording** | AC-108-18, AC-108-22 | Alternate-audience wording must not treat retail Israeli banking/consumer phrases as B2B by default. **Remove or narrow** bare `כניסת לקוחות` as a standalone reject token (too common for retail customers). Keep strong business tokens: `לקוחות עסקיים`, `ממשק העסק`, `כניסה לממשק העסק`, `business interface`, seller/merchant/partner/admin/b2b markers. Label/title wording alone must not veto a D-108-21 trusted-auth candidate without strong positive evidence on the candidate URL/host. |
| **D-108-23: Application-shell path tokens are not portals** | AC-108-18, AC-108-22 | Path segments such as `portal`, `portals`, `ng-portals` **alone** are **not** alternate-audience evidence (Bank Hapoalim SPA shells). Require business/audience markers on host, path, query, or strong wording. Do not map “found trusted-auth URL + blanked” to `loginIntelligenceHint=alternate_audience_portal` / Phase 112 deferral — that is a gate failure, not a complex-login deferral. |
| **D-108-24: Same-brand trusted-auth host probe** | AC-108-23 | When link/DOM discovery on `primaryUrl` does **not** yield a **high-confidence** consumer navigable `loginUrl`, Phase 108 **must probe** constructed candidates on the **same registrable brand** using existing `AUTH_SUBDOMAIN_PREFIXES` (priority at least: `auth`, `login`, `secure`, `e-services`, then remaining prefixes). Probe paths: `/login` and other existing common login path fallbacks as needed. Each probe: open/inspect in DiscoveryExecutor (or fetch equivalent already used by discovery), require **login-page evidence** (credential form / strong login markers) + pass audience gate (D-108-21). First validated probe **ACCEPT** and persist. Cap concurrency/timeout so bulk refresh stays rate-limited (AC-108-14). **Do not** invent cross-brand hosts. **Do not** probe alternate-audience prefixes (`sa`, `seller`, …). |
| **D-108-25: Common-path must not beat validated auth probe** | AC-108-20, AC-108-23 | Same-origin `common-path` guesses such as `{primary}/login` with `confidence=low` must **not** be preferred over a validated same-brand trusted-auth probe. Do **not** persist **unvalidated** low-confidence common-path when it fails reachability or lacks login-page evidence (KSP `https://ksp.co.il/login` is a canonical anti-pattern). Metadata may record the weak guess for operators, but `login_url` persistence requires validated evidence. |
| **D-108-26: Validated same-origin common-path may persist** | AC-108-23 | Persist policy **must not** blank-reject solely because `method=common-path` or initial `confidence=low`. When a same-origin (or same-brand) candidate such as `https://github.com/login` is **validated** as a consumer login page (login-page evidence + audience gate accept + not portal), Phase 108 **must persist** it and may upgrade confidence/method metadata accordingly. Canonical ACCEPT: GitHub. Canonical REJECT of invent: dead KSP `ksp.co.il/login` without login evidence. **Same rule applies to validated same-brand trusted-auth probe candidates** (e.g. `auth.ksp.co.il/login` in `topCandidates`): must persist after validation — listing in `topCandidates` with `loginUrl=null` / `login_entry_not_found` is **M13 incomplete**. |
| **D-108-27: Federated / parent IdP with brand-return evidence** | AC-108-24 | When a candidate login URL is on a **different registrable domain** than `primaryUrl` but is a **trusted IdP host** (`id`, `login`, `auth`, `accounts`, `sso`, `identity`, or equivalents already used as auth prefixes) **and** query/path shows **positive return-to-primary evidence** (`continue`, `callback`, `return`, `return_url`, `redirect_uri`, `redirect_url`, `next`, `RelayState`, `application` value containing the primary brand label, etc. pointing at the primary registrable domain), Phase 108 **must ACCEPT** and persist that IdP login URL after audience checks (not a B2B portal). Canonical ACCEPT: Trello → `https://id.atlassian.com/login?...&continue=https://trello.com/...`. Do **not** reject solely because `application` contains `signup` when the host is IdP login and continue/callback binds the primary brand. Do **not** accept arbitrary cross-domain URLs without brand-return evidence. Do **not** probe invent federated hosts blindly — only accept when discovered (link/redirect) or equivalently evidenced. Zap-class `sa.*` without brand-return to consumer primary remains REJECT. |
| **D-108-28: Live candidate page validation (reachable + identity field)** | AC-108-25, AC-108-18 | Scoring a URL by path/link alone is **not** sufficient to ACCEPT or to conclude `no_login_page_found` when candidates exist. For ranked candidates (including `common-path` and trusted-auth probes), DiscoveryExecutor **must** open/inspect the candidate page (isolated discovery tab; close reliably) and require: (1) **reachable** login surface (HTTP success / stable document — not soft-404 marketing stub without form); (2) **≥1 consumer identity input** visible or present in DOM suitable for login (email / username / phone / equivalent — reuse Phase 110 field heuristics **read-only**). Password field preferred but not mandatory when identity-only step is the entry page. **Forbidden:** autofill, typing credentials, submit. On pass of reachability+fields: still run **audience gate** — **field presence does NOT override** strong alternate-audience evidence (Zap business `/login` / `sa.zap…` / “ממשק העסק” still REJECT / NULL). On audience reject: keep `login_url=NULL`, record `rejectedLoginUrl`. On validation fail: drop candidate, try next. Canonical ACCEPT: PayPal `https://www.paypal.com/login`. Canonical DROP: dead invents. Canonical REJECT despite fields: Zap portal. Cap validation to top N candidates for rate limits. |
| **D-108-29: Sibling-TLD / same SLD brand family** | AC-108-25 | Hosts that share the same second-level label under different public suffixes (e.g. `zoom.com` ↔ `zoom.us`) **must be treated as same brand** for `isCrossSubdomainCandidate` / audience / modal gates when the candidate path is a consumer sign-in (`/signin`, `/login`, `/sign-in`, …) with strong link or validated page evidence. Canonical ACCEPT: Zoom primary `https://www.zoom.com/` → persist `https://zoom.us/signin`. Do **not** classify as `alternate_audience_portal` solely for sibling-TLD. Do **not** treat unrelated shared labels as siblings without shared-SLD + login-path/validation evidence. Sibling-TLD must **not** weaken Zap dual gate. |
| **D-108-30: M15 dual-gate hard regression (Zap NULL)** | AC-108-18, AC-108-21, AC-108-25 | Operator history: discovery fixes repeatedly over-accepted Zap (wrong `/login` or business portal) while chasing true positives. **M15 ACCEPT for PayPal/Zoom is invalid unless live Zap rediscovery still yields `login_url=NULL`** (U19). Static Zap REJECT fixture PASS alone is insufficient. Same bar that closed M13: **KSP non-NULL + Zap NULL**. Order of evaluation for every candidate: (1) strong alternate-audience → reject; (2) live validate reachability+identity; (3) sibling-TLD / trusted-auth / federated rules; (4) persist only consumer-validated. |
| **D-108-31: PayPal auto-discovery deferred; freeze gate churn** | AC-108-25 (deferred U27), operator priority | Operator 2026-07-14 closeout: live **Zap NULL + KSP + Zoom** green; **PayPal auto `login_url` empty** after churn that previously succeeded then regressed. **Stop further Phase 108 discovery-heuristic churn** for PayPal now — risk of re-breaking Zap/KSP/Zoom outweighs benefit. **Defer U27** to future Phase 108 milestone (**M16**) when scheduled; until then use **catalog seed / admin** `https://www.paypal.com/login`. Do **not** move PayPal to Phase 112. Do **not** claim full AC-108-25 without documenting U27 deferred. M15 may close as **accepted with deferred U27**. |

### Normative discovery persist flow

```text
primaryUrl (+ existing registry row)
→ discoverLogin(primaryUrl)           // DiscoveryExecutor: links/DOM first
→ if no high-confidence consumer URL: trusted-auth host probe (D-108-24)
→ LIVE-VALIDATE top candidates (D-108-28): reachable + ≥1 identity field
→ audience gate ALWAYS after/with validation — fields never override portal reject (D-108-15, D-108-30)
→ evidence-based audience + surface gates (D-108-14…30)
  including federated IdP (D-108-27) and sibling-TLD same brand (D-108-29)
→ shouldPersistDiscoveredLoginUrl()   // reject only on positive bad evidence or weak common-path
→ on success: login_url + login_fields + login_url_status=valid + metadata patch
→ on reject/defer (evidence-based): login_url = NULL (clear auto false-positive only) + needs_review|missing
     + metadata: rejectedLoginUrl?, loginEntryType?, usesModal?, phase112Deferred, loginIntelligenceHint, reason
→ never blocks registry row / user_services creation
→ never clear a good auto login_url solely because a weak modal heuristic fired
→ never blank a same-brand trusted-auth consumer URL solely because homepage has a modal (D-108-21)
```

### Normative consumer validation (Phase 108) — revised

```text
For each candidate (ranked):
  → Strong positive alternate-audience evidence on THIS candidate?  YES → reject candidate (keep evaluating others)
       **FIRST / wins over field validation** — Zap business login has fields too (D-108-15, D-108-30)
       (sa/seller/b2b host, business path/query, strong business wording — NOT bare כניסת לקוחות,
        NOT path token portals/ng-portals alone)
  → LIVE-VALIDATE (D-108-28): reachable + ≥1 identity field? NO → drop candidate
  → Same-brand trusted auth / dedicated path / sibling-TLD signin / federated IdP brand-return?
       YES → ACCEPT (persist) if audience still clean
  → Modal-only on primary AND no remaining consumer navigable candidate?
       YES → NULL + modal_on_primary deferral
  → Otherwise keep pre-M9 persist heuristics — do not invent new blanket NULLs
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
- **Trusted auth host priority** — same-brand `login.*` / auth hosts must persist despite homepage modal or weak portal wording (AC-108-22 / D-108-21…23).
- **Live candidate validation** — open candidate pages; require reachable + ≥1 identity field; **fields never override Zap/portal reject** (AC-108-25 / D-108-28 / D-108-30).
- **Sibling-TLD brand** — `zoom.com`↔`zoom.us` class same-brand for login discovery (AC-108-25 / D-108-29).
- **Dual gate hard** — PayPal/Zoom ACCEPT without live Zap `login_url=NULL` is **not** M15 complete (D-108-30).
- **True-positive regression required** after any false-positive gate change (AC-108-21 … AC-108-25).
- No `service_role` in client.
- Build passes (AC-108-17).
- Hebrew friendly user/admin messages on discovery failure.

## Technical Boundaries / Out of Scope
- Standard autofill expansion (Phase 110).
- Opening/filling modal overlays, OTP/CAPTCHA/iframe login intelligence, and authoritative `loginComplexity` (Phase 112) — Phase 108 only **defers** via metadata when the surface is genuinely modal-only or complex **after** a correct consumer URL decision. Blanking a found trusted-auth consumer URL is **in scope for Phase 108 to fix**, not to defer. Same-brand auth host missing from homepage links is fixed by **trusted-auth probe** (D-108-24 / M13), not by Phase 112.
- Full URL canonicalization engine (Phase 113) — use existing helpers only.
- Credential lifecycle UX (Phase 109).
- Firefox/Safari store shipping (evaluation only per PLAN §13).
- Service-specific execution adapters changes.
- Admin category CRUD / approval queue UI (Phase 107).
- Hard-coded per-site allowlists as the primary solution (heuristics + audience gates + trusted-auth probes are required; curated exceptions only via admin `loginUrlSource=admin` / catalog seed as interim until probe works).

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
- Rediscovery / review persist must **clear** auto `login_url` only when D-108-15/16 reject with **positive evidence**; never clear admin overrides; never clear a good consumer URL because a weak modal heuristic fired (D-108-18); never clear / refuse a same-brand trusted-auth consumer URL under D-108-21…23.

## Security / Privacy Considerations
- Discovery fetches third-party pages in extension context — no user credentials transmitted.
- Discovery logs must not include page HTML dumps in production user-visible errors.
- Extension `host_permissions` for production must be reviewed for store policy (broad `https://*/*` may need justification or activeTab pattern in future hardening — document, do not block 108 on full permission refactor unless store requires).

## Testing and Lint Expectations
- `npm run build` passes (AC-108-17).
- `node scripts/verifyPhase108BrowserIntegration.mjs` — PASS.
- `node scripts/verifyPhase108CustomDiscovery.mjs` — PASS.
- `node scripts/verifyPhase103Execution.mjs` — PASS (regression).
- `node scripts/verifyPhase108FalsePositiveGate.mjs` — PASS for **reject** fixtures (Zap / modal-only) **and** **accept** fixtures (ordinary consumer `/login` / Phase 103 catalog pages / **Bank Hapoalim-class trusted auth** / **KSP-class auth-host probe**) — AC-108-21, AC-108-22, AC-108-23.
- Manual matrix: Chrome + Edge; **Zap → NULL (hard)**; **Shufersal / Clalit / HTZone → non-NULL**; Hapoalim trusted-auth; **KSP → auth.ksp non-NULL + Zap NULL**; **PayPal → www.paypal.com/login + Zap NULL**; **Zoom → zoom.us/signin + Zap NULL**.

## Functional Testability

- **Custom add:** Add custom URL → registry row created → discovery attempted → consumer `loginUrl` when evidence supports it, else `NULL` + metadata
- **Zap (false-positive) — M15 HARD GATE U19:** after PayPal/Zoom changes, rediscover Zap → `login_url` **NULL** — never `sa.zap…` / business-interface `/login` even when that page has identity fields (D-108-30)
- **True-positive regression (M10/M11):** Rediscover Shufersal, Clalit, HTZone → `login_url` remains set (AC-108-21)
- **Trusted-auth priority (M12 / U23):** Rediscover Bank Hapoalim (or fixture equivalent) → `login_url` persists `login.bankhapoalim.co.il/...` (or same-brand trusted auth); must **not** remain NULL with `alternate_audience_portal` solely due to homepage modal / weak wording / `ng-portals` (AC-108-22)
- **Trusted-auth probe (M13 / U24):** Operator reports M13 complete — keep regression green for KSP/GitHub
- **Validated common-path (M13 / U25):** GitHub → `https://github.com/login` PASS
- **Federated IdP (M14 / U26):** Trello → `id.atlassian.com/login` (keep M14 obligations)
- **Live validation (M15 / U27):** PayPal → persist `https://www.paypal.com/login`; **must be paired with U19 Zap NULL on the same build**
- **Sibling-TLD (M15 / U28):** Zoom → persist `https://zoom.us/signin`; **must be paired with U19 Zap NULL on the same build**
- **Zap dual gate (M15 HARD / U19):** after M15 changes, Zap `login_url` remains **NULL** — never business portal / `sa.zap…` even if that page has identity fields (D-108-30)
- **No extension:** Add still succeeds; open-URL-only on tile; friendly banner
- **Admin / Isolation / scripts:** unchanged from prior contract

## Handoff Notes for Manager

1. Sync `manager-phase108.md`: **M15 accepted with U27 PayPal deferred** (D-108-31). Live green: Zap NULL + KSP + Zoom. PayPal = seed/admin until M16.
2. **Freeze** further discovery-gate churn unless opening **M16** for PayPal only (must re-prove Zap+KSP+Zoom on same build).
3. Advance program phases; Phase 108 discovery backlog = PayPal auto-discovery only (plus any open M14 if still needed).
4. Optional: one-line catalog migration seed for `paypal` → `https://www.paypal.com/login` (same pattern as Hapoalim) — Manager/Developer ops, not heuristic rewrite.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED_WITH_DEFERRED_U27

### Review Notes
_Operator 2026-07-14: After repeated Sarah fixes, stable live set is Zap NULL + KSP + Zoom discovered; PayPal empty again. Further churn risks dual-gate regression. Approve M15 closeout with PayPal auto-discovery deferred (D-108-31); interim seed/admin; resume as M16 later — not Phase 112. Program may proceed to subsequent phases._

### Required Corrections
1. Manager: document deferred U27 / M16 backlog; stop instructing more PayPal discovery heuristics now.
2. Developer: no further M15 discovery churn; optional paypal catalog/admin seed only; lock regression on Zap+KSP+Zoom.
3. When M16 opens: PayPal auto-discover only + same-build Zap/KSP/Zoom regression.
