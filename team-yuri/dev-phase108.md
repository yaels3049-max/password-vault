# Developer Phase 108

## Phase Identifier
PHASE=108

## Status
STATUS: IN_PROGRESS (M11) — M10 static-only COMPLETE is **insufficient** for phase approval (Architect/Manager REJECTED_PENDING_M11). Live dual gate (U22+U19) via **extension path** is the authority (D-108-19).

## Source References
- `team-Yuri/manager-phase108.md` (night amendment — M11)
- `team-Yuri/arch-phase108.md` (D-108-19, D-108-20; STATUS: REJECTED_PENDING_M11)
- `docs/MIGRATION_PHASE_108.md`

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

## Scope Compliance
- M11 only; no Phase 112 modal open/fill
- No service-specific Zap branching in engine
- Do **not** claim phase COMPLETE without live U22+U19 extension evidence

## Developer Declaration

M11 **code + observability + clear-policy** delivered; live custom-add host-match + merge fixes in **1.4.2**; Bank Jerusalem `services` accept in **1.4.3**. Static gates PASS. **Live extension dual gate (U22+U19) remains PENDING_OPERATOR**.

```text
Detected phase: 108
Selected state: IMPLEMENT
Status: IN_PROGRESS
```
