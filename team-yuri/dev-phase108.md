# Developer Phase 108

## Phase Identifier
PHASE=108

## Status
STATUS: **CLOSED** — **APPROVED_WITH_DEFERRED_U27** (D-108-31 / Amendment 8).

**M15 closed** with **U27 PayPal auto-discovery deferred → M16 backlog** (Phase 108 — **not** Phase 112). **M16 is not open.**

### Operator live green — REGRESSION LOCK (do not regress)
| Gate | Live result | Lock |
|---|---|---|
| **U19 Zap** | `login_url=NULL` (not sa.zap… / not bare `/login`) | **LOCK** |
| **U24 KSP** | non-NULL `auth.ksp…/login` | **LOCK** |
| **U28 Zoom** | non-NULL `https://zoom.us/signin` | **LOCK** |
| **U27 PayPal auto** | empty / not required for M15 close | **DEFERRED → M16** |

### Freeze (mandatory)
- **No further discovery-heuristic / gate churn** for PayPal (or any tuning that risks Zap/KSP/Zoom).
- Do **not** start M16 unless Manager/Architect reopen it.
- Optional only (not done here): catalog/admin seed `https://www.paypal.com/login` with `loginUrlSource=admin|catalog_seed` — **seed ≠ U27 Pass**.
- Program may proceed to **next phases**.

## Source References
- `team-Yuri/manager-phase108.md` (Amendment 8 — M15 CLOSED / M16 backlog)
- `team-Yuri/arch-phase108.md` (**STATUS: APPROVED_WITH_DEFERRED_U27**; **D-108-31**)
- `docs/MIGRATION_PHASE_108.md`
- `team-Yuri/PLAN.md` §18 — AC-108-25 (U27 deferred)

## M10 claim disposition
M10 marked COMPLETE on JSDOM ACCEPT/REJECT fixtures while **U22 remained PENDING_OPERATOR** and operator live add/rediscover still saw `login_url=NULL`. That contradicts AC-108-21 / D-108-19. **M10 is necessary but not sufficient. M11 is required.**

## M11 — Live discovery restoration (D-108-19, D-108-20)

### Failure-mode analysis (live NULL after M9/M10)

| # | Mode | Finding |
|---:|---|---|
| **d** | Persist/clear over-clears | **Confirmed bug:** rediscovery reject used `clearLoginUrl: true` for any non-persist result, wiping seeded Shufersal/Clalit/HTZone URLs. Extension/timeout failures also cleared. **Fixed** via `shouldClearAutoLoginUrlOnDiscoveryReject` — clear only with positive portal/audience evidence; never on infra failure. |
| **c** | Live over-accept / wrong candidate | **Confirmed on live Clalit HTML:** homepage chrome button to `…/Pages/default.aspx` beat `e-services…/login.aspx`. **Fixed:** skip self-page candidates; boost trusted auth subdomain scoring. |
| a | Stale extension bundle | Process risk — checklist below; manifest bumped to **1.4.1** |
| b | common-path / low confidence | Still refused by persist gate; must not clear good existing URL (covered by clear policy) |
| e | Extension unavailable | Metadata recorded; **no longer clears** existing login_url |

### Observability (D-108-20) — implemented

- `metadata.rawExtensionDiscovery` — raw `HUB_LOGIN_ENTRY_DISCOVERY` summary (success, loginUrl, method, confidence, reason, topCandidates)
- `metadata.lastDiscoveryOutcome` — includes method, confidence, rejectedLoginUrl, phase112Deferred, loginIntelligenceHint
- Admin **Integration Status** panel shows all D-108-20 fields after rediscovery
- DEV console: `[registry] HUB_LOGIN_ENTRY_DISCOVERY raw payload`

### Extension rebuild + reload checklist (D-108-19) — **required every attempt**

```text
[ ] npm run build:extension-discovery
[ ] npm run build   (or npx vite build if tsc auth stubs block)
[ ] chrome://extensions → Reload unpacked extension (manifest 1.4.3+)
[ ] Hard-refresh Hub (localhost:5173)
[ ] Admin → select service → Rediscover (force) OR custom add
[ ] Copy Integration Status: rawExtensionDiscovery + login_url + lastDiscoveryOutcome
```

**This attempt (developer workstation):** extension bundle rebuilt (`login-entry-discovery.js` ~37.7kb); manifest **1.4.1**. Live extension tab UAT **not executed in this agent environment** (no side-loaded Chrome session / site network timeouts for several hosts).

### Live HTML diagnostic (not extension authority)

```text
node scripts/capturePhase108LiveDiscovery.mjs
```

| Site | Fetch | Engine result (fetch+JSDOM) | Notes |
|---|---|---|---|
| Clalit | OK | `loginUrl=https://e-services.clalit.co.il/onlineweb/general/login.aspx`, persist=true | After M11 scoring/self-page fix |
| Shufersal | fetch failed (timeout) | — | Need extension UAT |
| HTZone | fetch failed | — | Need extension UAT |
| Zap | fetch failed | — | Need extension UAT |

Report: `scripts/fixtures/phase108-live-capture-report.json`

### Per-site live evidence package (extension path) — **PENDING_OPERATOR**

| Site | Raw HUB_LOGIN_ENTRY_DISCOVERY payload | Persisted metadata | login_url | Result |
|---|---|---|---|---|
| Shufersal | _pending operator paste_ | _pending_ | must be non-NULL consumer | **PENDING_OPERATOR** |
| Clalit | _pending operator paste_ | _pending_ | must be non-NULL consumer | **PENDING_OPERATOR** (live HTML diagnostic PASS) |
| HTZone | _pending operator paste_ | _pending_ | must be non-NULL consumer | **PENDING_OPERATOR** |
| Zap | _pending operator paste_ | _pending_ | must be NULL; not sa.zap | **PENDING_OPERATOR** |

#### Operator paste template (per site)

```text
Site:
Extension version:
Reload checklist done: yes/no
Path: admin rediscovery / custom add

RAW payload (rawExtensionDiscovery / console):
  success:
  loginUrl:
  method:
  confidence:
  reason:
  rejectedLoginUrl:
  topCandidates:

Persisted:
  login_url:
  login_url_status:
  loginUrlDiscoveryOutcome:
  loginUrlDiscoveryError:
  discoveryMethod:
  loginUrlConfidence:
  rejectedLoginUrl:
  phase112Deferred:
  loginIntelligenceHint:

Pass/Fail:
```

### Static gates (necessary, not sufficient)

```text
node scripts/verifyPhase108FalsePositiveGate.mjs  → PASS
node scripts/verifyPhase108LivePath.mjs           → PASS (clear policy + observability contracts)
node scripts/verifyPhase108ModalAudience.mjs      → PASS
node scripts/verifyPhase103Execution.mjs          → PASS
npm run build:extension-discovery                 → PASS
npx vite build                                    → PASS
```

### Files changed (M11 delta)

| File | Change |
|---|---|
| `src/registry/loginUrlClearPolicy.ts` | Clear auto URL only on positive portal/audience evidence |
| `src/registry/loginUrlDiscovery.ts` | Wire clear policy; never clear on infra failure; log/store raw payload |
| `src/registry/loginDiscoveryMetadata.ts` | `rawExtensionDiscovery` field |
| `src/admin/IntegrationStatusPanel.tsx` | D-108-20 operator-visible fields |
| `src/discovery/discoveryUtils.ts` | Boost trusted auth subdomain scores |
| `src/discovery/discoverLoginEntry.ts` | Skip self-page chrome candidates |
| `src/discovery/loginDiscoveryPolicy.ts` | Reject primary==loginUrl persist |
| `extension/manifest.json` | 1.4.3 (was 1.4.2) |
| `extension/background.js` | Discovery tab host match: www↔apex / same-brand (fixes live timeout) |
| `src/App.tsx` | mergeCustomDefinitions keeps vault loginUrl; post-discovery registry sync |
| `src/registry/registryMapper.ts` | category null-safe; metadata marks succeeded when loginUrl present |
| `src/discovery/discoveryKeywords.ts` | Trust `services` / `online` auth subdomains (Bank Jerusalem-class) |
| `src/discovery/loginAudienceGate.ts` | Accept trusted auth OR Login.aspx dedicated path; bare `/login` on untrusted host still REJECT |
| `scripts/fixtures/phase108-accept-services-login-aspx.html` | Bank Jerusalem-class ACCEPT |
| `scripts/verifyPhase108LivePath.mjs` | M11 static contracts |
| `scripts/capturePhase108LiveDiscovery.mjs` | Live HTML diagnostic |
| `scripts/fixtures/phase108-accept-clalit-home-chrome.html` | Clalit-class ACCEPT |

### Live custom-add login_url regression (GitHub / Hapoalim / all sites)

Two bugs prevented `login_url` from sticking after add:

1. **Extension:** `tabUrlMatchesDiscoveryPrimary` required exact `origin` — redirects `www`→apex (common) never matched → discovery timed out → no loginUrl.
2. **Hub:** `mergeCustomDefinitions` let registry (null login_url) overwrite vault enrichment after catalog reload.

**Fix shipped in manifest 1.4.2.** Operator must reload unpacked extension, hard-refresh Hub, re-add GitHub / Hapoalim.

### Bank Jerusalem over-reject (`services.*.…/Pages/Login.aspx`)

Live log showed `rejectedLoginUrl: https://services.bankjerusalem.co.il/Pages/Login.aspx` with `cross_subdomain_untrusted` because `services` was not a trusted auth prefix.

**Fix (1.4.3):** add `services` (+ `online`) to `AUTH_SUBDOMAIN_PREFIXES`; narrow dedicated-path escape hatch to `Login.aspx` only (so `portal.*/login` stays REJECT; Zap `sa.*` still REJECT).

## M12 — Trusted-auth priority / Bank Hapoalim-class (D-108-21…23, AC-108-22)

### Bug (operator evidence)
Discovery finds `https://login.bankhapoalim.co.il/ng-portals/auth/he/login` but persists `login_url=NULL` with `rejectedLoginUrl`, `needs_review`, reason “Consumer login is modal-based; alternate portal candidate rejected.”, `loginIntelligenceHint=alternate_audience_portal`, `phase112Deferred=true`.

### Root cause
1. `evaluateLoginAudience` applied homepage modal / primary-page context wording **before** same-brand trusted-auth accept.
2. Bare retail Hebrew `כניסת לקוחות` was a standalone alternate-audience token (false portal signal on banking homes).
3. SPA shell path tokens (`ng-portals`) were at risk of being treated as portal evidence.

### Implementation (this attempt)

| Decision | Change |
|---|---|
| D-108-21 | Reordered `evaluateLoginAudience`: (1) strong alternate on **candidate URL/label only** → reject; (2) same-brand trusted auth / dedicated `Login.aspx` → **ACCEPT** even with `primaryHasModalLoginTrigger`; (3) else modal / cross-sub / page-context rules |
| D-108-22 | Removed bare `כניסת לקוחות`; kept `לקוחות עסקיים` / `ממשק העסק` / `כניסה לממשק העסק` / business interface / sa\|seller\|b2b markers |
| D-108-23 | `stripApplicationShellPathTokens` — `portal` / `portals` / `ng-portals` alone are **not** portal evidence |
| Fixtures | `scripts/fixtures/phase108-accept-hapoalim-ng-portals.html` + **T37** ACCEPT; Zap REJECT unchanged |
| Extension | Rebuilt `login-entry-discovery.js` (~39.0kb); manifest **1.4.10** |

### Files touched
- `src/discovery/loginAudienceGate.ts` — M12 gate reorder + wording/path narrowing
- `src/discovery/index.ts` — export `isSameBrandHost`
- `scripts/fixtures/phase108-accept-hapoalim-ng-portals.html` — new ACCEPT fixture
- `scripts/verifyPhase108FalsePositiveGate.mjs` — T37 + contracts
- `scripts/verifyPhase108ModalAudience.mjs` — Case F flipped to modal+trusted ACCEPT
- `extension/discovery/login-entry-discovery.js` — rebuilt
- `extension/manifest.json` — **1.4.10**

### Static verify (this workstation)

```text
node scripts/verifyPhase108FalsePositiveGate.mjs   → PASS (incl. T37 Hapoalim ACCEPT; Zap REJECT)
node scripts/verifyPhase108ModalAudience.mjs       → PASS (F modal+trusted ACCEPT; Zap-class still reject in A)
npm run build:extension-discovery                  → PASS (login-entry-discovery.js 39.0kb)
node scripts/verifyPhase103Execution.mjs           → PASS (manifest 1.4.10)
npx tsc -b                                         → PASS
```

### Extension rebuild + reload checklist (D-108-19) — **every attempt**

```text
[x] npm run build:extension-discovery
[x] node scripts/verifyPhase108FalsePositiveGate.mjs
[x] node scripts/verifyPhase108ModalAudience.mjs
[ ] chrome://extensions → Reload unpacked extension (manifest **1.4.10**)
[ ] Hard-refresh Hub (localhost:5173)
[ ] Admin → Bank Hapoalim (or equivalent) → Rediscover (force) OR custom add
[ ] Copy Integration Status: rawExtensionDiscovery + login_url + lastDiscoveryOutcome
```

### Live gates — M12 / M11

| Gate | Expectation | Result |
|---|---|---|
| **U23** Hapoalim-class | `login_url` non-NULL trusted-auth (`login.bankhapoalim.co.il/...`); **not** `alternate_audience_portal` blank | **PENDING_OPERATOR** |
| **U19** Zap | `login_url` NULL; not `sa.zap…` | **PENDING_OPERATOR** (static Zap REJECT still PASS) |
| **U22** Shufersal/Clalit/HTZone | each non-NULL consumer `login_url` | **PENDING_OPERATOR** (M11; not replaced by M12) |

Optional admin “approve rejectedLoginUrl” UX: **not shipped** (non-blocking; not a substitute for the gate fix).

## M13 — Trusted-auth host probe + validated common-path (D-108-24…26, AC-108-23)

### Bugs (operator evidence)
1. **KSP:** `method=common-path`, `loginUrl=https://ksp.co.il/login` (dead), `confidence=low`, `needs_review`; real `https://auth.ksp.co.il/login` never candidate (no homepage link).
2. **GitHub:** correct `https://github.com/login` via `common-path` / `low` blank-rejected solely by persist policy.

### Implementation (this attempt)

| Decision | Change |
|---|---|
| D-108-24 | `buildTrustedAuthHostProbeUrls` + probe loop in `discoverLoginEntry` before invent; validate password-form evidence + audience; first valid probe ACCEPT |
| D-108-25 | Unvalidated same-origin `{primary}/login` invent is **not** returned as success when probe HTML lacks login form |
| D-108-26 | Removed blanket `common-path`/`low` reject from `shouldPersistDiscoveredLoginUrl`; validated pages upgrade to `dedicated-login-page` / medium+ |
| Extension | `HUB_DISCOVERY_FETCH_HTML` background fetch (no CORS) + `fetchProbeHtmlViaBackground` in page entry |
| Fixtures | KSP home (no link) + auth login HTML; GitHub home (no link) + login page HTML — **T41/T42** |
| Manifest | **1.4.11** |

### Files touched
- `src/discovery/trustedAuthProbe.ts` — new probe URL builder
- `src/discovery/discoverLoginEntry.ts` — probe + validate-before-invent
- `src/discovery/loginDiscoveryPolicy.ts` — D-108-26 persist / review deferral
- `src/extension/discoveryPageEntry.ts` — background probe fetch bridge
- `extension/background.js` — `HUB_DISCOVERY_FETCH_HTML`
- `extension/discovery/login-entry-discovery.js` — rebuilt (~46kb)
- `scripts/fixtures/phase108-accept-ksp-*.html`, `phase108-accept-github-*-no-link.html` / login-page
- `scripts/verifyPhase108FalsePositiveGate.mjs` — T41/T42

### Static verify (this workstation)

```text
node scripts/verifyPhase108FalsePositiveGate.mjs   → PASS (T41 KSP auth ACCEPT; T42 GitHub ACCEPT; Zap REJECT)
node scripts/verifyPhase108ModalAudience.mjs       → PASS
npm run build:extension-discovery                  → PASS (~46.0kb)
node scripts/verifyPhase103Execution.mjs           → PASS (manifest 1.4.11)
npx tsc -b                                         → PASS
```

### Extension rebuild + reload checklist (D-108-19)

```text
[x] npm run build:extension-discovery
[x] node scripts/verifyPhase108FalsePositiveGate.mjs
[ ] chrome://extensions → Reload unpacked extension (manifest **1.4.11**)
[ ] Hard-refresh Hub
[ ] Rediscover KSP → expect auth.ksp.co.il/login (U24)
[ ] Rediscover GitHub → expect github.com/login persisted (U25)
[ ] Regression: Zap NULL (U19); Shufersal/Clalit/HTZone non-NULL (U22); Hapoalim trusted auth (U23)
```

### Live gates

| Gate | Expectation | Result |
|---|---|---|
| **U24** KSP | non-NULL `auth.ksp.co.il/.../login` (not dead `ksp.co.il/login`); **must not** `loginUrl=null` / `login_entry_not_found` while auth in `topCandidates` | **PENDING_OPERATOR** (soft-persist shipped in 1.4.12) |
| **U25** GitHub | persisted `https://github.com/login` | **PENDING_OPERATOR** (may already Pass) |
| U19 / U22 / U23 | unchanged obligations | **PENDING_OPERATOR** |

**Catalog/admin seed is interim only — does not close M13.**

## M13 U24 finish — persist probed auth (Amendment 6)

### Operator gap
After probe listing, KSP `topCandidates` included `auth.ksp.co.il/login` + `/signin` (score 8, confidence low) but `loginUrl=null`, `reason=login_entry_not_found`. U25 GitHub PASS ≠ U24 done.

### Root cause
`validateConsumerLoginPageUrl` required fetchable HTML with a static password field. Live auth hosts are often SPA / fetch-miss → validation null → failure while probes remain in candidates only.

### Fix (D-108-26 on probe results)
Same-brand trusted-auth probe URLs with a login-like path **soft-ACCEPT** when HTML fetch fails or page lacks a static password field. Upgraded to `dedicated-login-page` / `medium` so persist policy stores them. Dead same-origin invents (`{apex}/login`) still require form evidence.

Static: **T41c** — home fixture + no auth HTML map → still persists `auth.ksp.co.il/login`; not `login_entry_not_found`.

## M14 — Federated / parent IdP (D-108-27, AC-108-24)

### Operator gap
Trello discovers `https://id.atlassian.com/login?application=trello--direct-signup&continue=https://trello.com/...` but `needs_review` / not persisted (cross-registrable IdP vs primary).

### Implementation

| Decision | Change |
|---|---|
| D-108-27 | `isTrustedFederatedIdPHost` + `hasPrimaryBrandReturnEvidence` + early ACCEPT in `evaluateLoginAudience` |
| Brand-return | `continue` / `callback` / `redirect_*` / `application` (etc.) containing primary brand |
| Signup | `application=<brand>--direct-signup` must **not** sole-reject |
| No invent | Do not invent cross-registrable IdP hosts; accept when discovered with brand-return |
| Zap | REJECT unchanged |
| Fixtures | `phase108-accept-trello-home-idp.html`; **T46** ACCEPT; **T48** signup; **T49** no brand-return REJECT |
| Manifest | **1.4.12**; bundle ~49.3kb |

### Files touched (U24 + M14)
- `src/discovery/loginAudienceGate.ts` — federated IdP gate
- `src/discovery/discoveryKeywords.ts` — `sso` / `identity` + `FEDERATED_IDP_HOST_PREFIXES`
- `src/discovery/discoverLoginEntry.ts` — U24 soft-accept trusted-auth probes
- `src/discovery/index.ts` — exports
- `scripts/fixtures/phase108-accept-trello-home-idp.html`
- `scripts/verifyPhase108FalsePositiveGate.mjs` — T41c / T46 / T48 / T49
- `extension/manifest.json` → **1.4.12**
- `extension/discovery/login-entry-discovery.js` — rebuilt

### Static verify (this workstation)

```text
node scripts/verifyPhase108FalsePositiveGate.mjs   → PASS (T41/T41c/T42/T46/T48/T49; Zap REJECT)
node scripts/verifyPhase108ModalAudience.mjs       → PASS
npm run build:extension-discovery                  → PASS (~49.3kb)
node scripts/verifyPhase103Execution.mjs           → PASS (manifest 1.4.12)
```

### Extension rebuild + reload checklist (D-108-19) — **every U24/U26 attempt**

```text
[x] npm run build:extension-discovery
[x] node scripts/verifyPhase108FalsePositiveGate.mjs
[ ] chrome://extensions → Reload unpacked extension (manifest **1.4.12**)
[ ] Hard-refresh Hub
[ ] Rediscover KSP → login_url persists auth.ksp…/login (U24) — not topCandidates-only
[ ] Rediscover Trello → login_url persists id.atlassian.com/login?…continue=trello… (U26)
[ ] Regression: GitHub U25; Zap NULL (U19); Hapoalim U23; U22 consumer sites
```

### Live gates (M13/M14)

| Gate | Expectation | Result |
|---|---|---|
| **U24** KSP | **persisted** `auth.ksp…/login` (not `login_entry_not_found` while scored) | **OPERATOR PASS** (reported) |
| **U25** GitHub | persisted `github.com/login` | **PENDING_OPERATOR** |
| **U26** Trello | persisted `id.atlassian.com/login` + brand-return | **PENDING_OPERATOR** (1.4.13 signup→login) |
| U19 Zap | NULL; not sa.* | **PENDING_OPERATOR** |

## M14 follow-up — live Trello signup shell (manifest **1.4.13**)

### Operator evidence
`rejectedLoginUrl=https://id.atlassian.com/signup?application=trello--direct-signup&continue=…trello.com…`, `usesModal=true`, `reason=modal + alternate portal`, `loginIntelligenceHint=alternate_audience_portal`. Homepage "Log in" is modal; discovered navigable URL was IdP **`/signup`**, not `/login`.

### Root cause
1. Federated ACCEPT required a login-ish path that excluded `/signup`.
2. Primary-page context wording (e.g. "Business") + cross-registrable host → `alternate_audience_portal` before IdP rule applied.
3. Modal-only path stored `needs_review` instead of canonical `/login`.

### Fix
- Treat IdP `/signup` / `/sign-up` / `/register` as federated entry when brand-return present.
- `canonicalizeFederatedIdPLoginUrl` → persist **`/login`** with same query.
- Federated + brand-return ACCEPT before portal/context veto; navigable wins over homepage modal.
- Fixture mirrors live signup shell + modal + "Business" wording; T46/T48 updated.

### Verify
```text
node scripts/verifyPhase108FalsePositiveGate.mjs → PASS (T46 signup→login)
npm run build:extension-discovery → ~50.6kb; manifest **1.4.13**
```

### Reload checklist
```text
[ ] Reload unpacked extension **1.4.13**
[ ] Hard-refresh Hub
[ ] Rediscover Trello → expect login_url = id.atlassian.com/login?…continue=trello…
```

## Zap invent regression (manifest **1.4.14**)

### Operator evidence
After U24 soft-accept, Zap rediscovery persisted `https://auth.zap.co.il/login` (host/page does not exist). Correct pre-fix state was `login_url=NULL`.

### Root cause
Soft-ACCEPT of same-brand `auth.*/login` **without fetched login-surface HTML** invented dead hosts.

### Fix
- Never soft-ACCEPT when probe HTML is missing/unreachable.
- Soft-ACCEPT SPA only when fetched HTML shows login-surface evidence (title/heading login keywords, identity form, or password) and is not a 404/error page.
- Static: **T41d** / **T50** / **T50b** invent REJECT; **T41c** SPA shell with login title still ACCEPT.

### Verify
```text
node scripts/verifyPhase108FalsePositiveGate.mjs → PASS (T50 invent REJECT; Zap T24 REJECT)
npm run build:extension-discovery → ~51.9kb; manifest **1.4.14**
```

### Reload checklist
```text
[ ] Reload unpacked extension **1.4.14**
[ ] Hard-refresh Hub
[ ] Rediscover Zap → login_url NULL (not auth.zap.co.il/login)
[ ] Regression: KSP still auth.ksp…/login; Trello still id.atlassian.com/login
```

## U24/KSP restore without Zap invent (manifest **1.4.15**)

### Operator evidence
Zap NULL ✓; Trello IdP ✓; KSP login_url empty again after 1.4.14 (too strict: no persist without HTML markers).

### Fix
- Probe fetch returns `reached` (HTTP answer vs NXDOMAIN/network miss).
- Unreachable invent → NULL (Zap).
- Reachable 2xx trusted-auth `/login` (incl. SPA / non-error HTML) → ACCEPT (KSP).
- HTTP 4xx / dead-page body → NULL.
- Origin reachability fallback when `/login` probe misses but host answers.

### Verify / reload
```text
node scripts/verifyPhase108FalsePositiveGate.mjs → PASS (T41e/T41f + T50)
manifest **1.4.15**; rebuild ~53.8kb
[ ] Reload **1.4.15** → Rediscover KSP (auth.ksp…/login), Zap NULL, Trello IdP
```

## U24/KSP restore #2 (manifest **1.4.16**)

### Operator evidence
Zap NULL ✓; Trello ✓; KSP still NULL after 1.4.15 (HTML/fetch reachability alone insufficient — likely fetch fail / modal early-exit / bot gate).

### Fix
1. **Probe before modal-only failure** — trusted-auth probe runs even when homepage has a modal login control; skipped when portal-on-page (sa.*).
2. **DNS-over-HTTPS fallback** in `HUB_DISCOVERY_FETCH_HTML` — if HTML fetch fails but hostname resolves → soft-ACCEPT; NXDOMAIN stays NULL (Zap).
3. Soft-ACCEPT gated HTTP **401/403/429** on trusted-auth `/login` (not 404).

### Verify / reload
```text
node scripts/verifyPhase108FalsePositiveGate.mjs → PASS (T41g/T41h)
manifest **1.4.16**; rebuild ~55.3kb
[ ] Reload **1.4.16** (+ reload background.js) → Rediscover KSP, Zap NULL, Trello OK
```

## U24 Zap invent rollback (manifest **1.4.18**)

### Operator evidence
KSP PASS with 1.4.17, but Zap invented `https://auth.zap.co.il/login` (host does not exist) via `allowUnverifiedAuthLoginInvent`.

### Fix
- Removed unverified auth-host invent (extension no longer invents without reachability).
- ACCEPT only when SW HTML / DNS / in-page **no-cors** proves host exists (KSP yes, dead invent no).
- Clear policy rolls back stored `auth.*/login` invents when rediscovery no longer persists them.
- Catalog KSP seed remains interim.

### Reload
```text
[ ] Reload extension **1.4.18**
[ ] Rediscover Zap → login_url NULL (clears auth.zap invent)
[ ] Rediscover KSP → auth.ksp.co.il/login still set (no-cors/DNS)
[ ] Trello unchanged
```

## M15 — Live candidate validation + sibling-TLD + Zap dual-gate hard (D-108-28…30)

### Operator gaps (from Amendment 7)
1. **PayPal:** `https://www.paypal.com/login` in `topCandidates` but `loginUrl=null` / `no_login_page_found` → **D-108-28**.
2. **Zoom:** `https://zoom.us/signin` from `zoom.com` rejected as portal/modal → **D-108-29**.
3. **Zap dual-gate (D-108-30):** fields never override portal reject; COMPLETE only if **same build** proves **U27 + U28 + U19**.

### Live failure diagnosis (after 1.4.19 — why U27/U28 still empty)

| Site | Live probe | Why loginUrl stayed null |
|---|---|---|
| **PayPal** `/login` | HTTP **403** DataDome; no identity fields | Soft-ACCEPT covered trusted-auth only (KSP), not same-host `/login` bot gates |
| **Zoom** `/signin` | HTTP **200** SPA; title **Sign In \| Zoom**; no email/password in static DOM | Soft-ACCEPT required identity fields; sibling-TLD audience already OK |

### Fix (manifest **1.4.20**)
| Decision | Code |
|---|---|
| Soft-ACCEPT same-host / sibling-TLD / trusted-auth consumer sign-in when reachable | `isConsumerSignInSoftPath` |
| Bot gate 401/403/429 (PayPal DataDome) | consumer soft path + `trustedAuthProbeMaySoftAccept` |
| Fieldless SPA with login title (Zoom) | `htmlLooksLikeLoginSpaShell` |
| Prefer scored candidate URL | persist `paypal.com/login` even if SW lands on `/signin` |
| Bare `/login` soft-ACCEPT suppressed when portal sibling on page | `pageHasAlternatePortalCandidate` (D-108-30) |

### Commands run
```text
node scripts/verifyPhase108FalsePositiveGate.mjs → PASS (T50 403 / T50d SPA / T51 / T52)
node scripts/verifyPhase108ModalAudience.mjs → PASS
node scripts/capturePhase108M15LivePath.mjs → PASS
  paypal → https://www.paypal.com/login persist=true
  zoom → https://zoom.us/signin persist=true
  report: scripts/fixtures/phase108-m15-live-path-report.json
node scripts/verifyPhase103Execution.mjs → PASS (1.4.20)
npm run build:extension-discovery → ~67.1kb
```

### Zap regression after 1.4.20 (operator 2026-07-14)
PayPal / Zoom / KSP OK, but Zap rediscovery persisted a bare **LOGIN** URL (invalid). Soft-ACCEPT of same-host `/login` (and inventing `auth.*/login` on 403 beside a homepage modal) over-accepted retail.

### Fix (manifest **1.4.21**)
| Guard | Behavior |
|---|---|
| Modal and/or portal on homepage | Never live-validate / soft-ACCEPT same-host bare `/login` (unless the tab under inspection **is** that login page — T30) |
| Modal + bare `/login` candidates, no trusted-auth DOM link | Skip trusted-auth **invent** probe (keeps T41h KSP modal+probe) |
| Portal + fields | Still REJECT (T52); modal+/login SPA (T52b); modal+/login 403 invent (T52c) |
| PayPal / Zoom soft-ACCEPT | Unchanged when homepage is not retail modal+/login dual surface |

### Commands (1.4.21)
```text
node scripts/verifyPhase108FalsePositiveGate.mjs → PASS (incl. T52b/T52c)
node scripts/verifyPhase108ModalAudience.mjs → PASS
node scripts/capturePhase108M15LivePath.mjs → PASS (PayPal+Zoom)
npm run build:extension-discovery → ~70.0kb; manifest **1.4.21**
```

### Operator reload (SAME build) — superseded by Amendment 8 closeout
Operator live green accepted for **Zap NULL + KSP + Zoom**. PayPal auto not required for M15 close (**U27 → M16**).

## M15 CLOSEOUT — APPROVED_WITH_DEFERRED_U27 (D-108-31)

| Item | Disposition |
|---|---|
| M15 | **CLOSED** — accepted with deferred U27 |
| U19 Zap | Live green — **LOCK** |
| U24 KSP | Live green — **LOCK** |
| U28 Zoom | Live green — **LOCK** |
| U27 PayPal auto-discovery | **DEFERRED → M16** (Phase 108 backlog; not open; not Phase 112) |
| Discovery gate churn | **FROZEN** until M16 explicitly opened |
| PayPal interim | Optional catalog/admin seed only — **not** U27 Pass |
| Program | May proceed to next phases |

### What Developer will not do now
- No more PayPal discovery-gate / soft-ACCEPT / heuristic work
- No DiscoveryExecutor / audience-gate churn that risks Zap/KSP/Zoom
- Do not open or implement M16 until instructed

### Optional seed (not claimed as U27)
If/when needed for Hub UX: set `login_url=https://www.paypal.com/login` via admin or catalog seed with `loginUrlSource=admin|catalog_seed`. That does **not** close U27.

## Scope Compliance
- M15 closed per Amendment 8 / D-108-31
- Dual-gate rules (D-108-28…30) remain code baseline; freeze means no further churn
- Seeded PayPal ≠ auto-discovery Pass
- M16 backlog only — not started

## Developer Declaration

**M15 CLOSED** as **APPROVED_WITH_DEFERRED_U27**. Live lock: **Zap NULL + KSP + Zoom**. **U27 deferred to M16**. Discovery-heuristic freeze in effect. No further PayPal discovery work. Program may advance.

```text
Detected phase: 108
Selected state: IMPLEMENT
Status: CLOSED (M15 APPROVED_WITH_DEFERRED_U27; U27→M16 backlog; freeze Zap/KSP/Zoom lock)
```
