# Developer Phase 112

## Phase Identifier
PHASE=112

## Status
STATUS: **REJECTED_IN_PROGRESS** (Architect governance REJECTED)

**FORBIDDEN claims while open:** COMPLETE · partial · infrastructure-complete.

Blocking: **BD-112-1…6** until M9 live list + M10 statuses + **D-112-24 evidence** + operator revalidation H7 green.

Dependent autofill phases: **BLOCKED** (D-112-25).

---

## D-112-24 Evidence Package

### (1) Exact PLAN ACs (Phase 112)

| AC | Statement (summary) |
|---|---|
| AC-112-1…24 | Prior LI / health / admin / no unsafe automation (unchanged) |
| **AC-112-25** | Medium email/username/id-first: fill visible identity without same-page password; no auto-submit; no auto-Continue |
| **AC-112-26** | Non-success medium attempt → exactly one explicit status: login form not detected \| first field not detected \| no credentials for selected profile \| website not supported \| blocked by website \| system error. Silent open-only forbidden |

### (2) Requirement → implementation mapping

| Req / AC / BD | Implementation |
|---|---|
| D-112-20 / AC-112-25 | `POC_IDENTITY_FIRST_FILL` → `runIdentityFirstAutofill` (not Phase 110 standard gate) |
| D-112-21 | Success = `filled >= 1`; password absence expected |
| D-112-22 / M9 | Published supported list + fixture; live UAT **PENDING_OPERATOR** per site |
| D-112-23 / AC-112-26 / M10 | `mapMediumOutcomeToUserStatus` → Hebrew; Hub **awaits** extension |
| D-112-24 | This package |
| D-112-25 | Declared freeze — no dependent phase start |
| BD-112-1 | Identity-first path + supported list gate |
| BD-112-2/3/6 | Distinct Hebrew statuses; success vs failure visible |
| BD-112-4 | `activeProfileId` required + logged on medium attempt |
| BD-112-5 | Extension reasons + Hub logs `pageDetected` / identity_step_* |

### (3) Files changed (M9/M10 governance pass)

| File | Role |
|---|---|
| `src/loginIntelligence/mediumAssist.ts` | Async identity-first; await result; profile + supported gate |
| `src/loginIntelligence/mediumStatus.ts` | AC-112-26 mapping + failure taxonomy |
| `src/loginIntelligence/supportedMediumSites.ts` | Published supported list |
| `src/execution/serviceExecution.ts` | Async; medium awaits; complex → explicit unsupported-style status |
| `src/serviceManagement/openWithProfile.ts` | Passes `activeProfileId` |
| `src/Dashboard.tsx` | Surfaces warn statuses (non-silent) |
| `extension/generic/identity-first-autofill.js` | Partial fill engine |
| `extension/generic/form-detector.js` | `detectVisibleIdentityStep` |
| `extension/generic/field-mapper.js` | `mapIdentityFieldsOnly` |
| `extension/background.js` | `POC_IDENTITY_FIRST_FILL` handler |
| `scripts/fixtures/phase112-email-first-step1.html` | HTML fixture |
| `public/phase112-email-first-step1.html` | Served fixture for live local UAT |
| `scripts/verifyPhase112IdentityFirst.mjs` | Fixture + static |
| `scripts/verifyPhase112MediumStatus.mjs` | Status mapping units |
| `docs/MIGRATION_PHASE_112.md` | Operator notes |
| `team-Yuri/dev-phase112.md` | This evidence |

### (4) Activation conditions

1. Released / local build running (`npm run build` or `npm run dev`)
2. Extension loaded (manifest ≥ **1.4.22**), host permissions OK
3. `VITE_PHASE112_MEDIUM` not `false` (feature **on**)
4. Active Digital Home **profile selected**
5. Identity credential present on profile for service (non-password field)
6. Service LI `loginComplexity=medium` (Admin override/refresh)
7. Open URL host matches **published supported list**

### (5) Named supported websites (published)

| # | Id | Display name | Host match | Operator live status |
|---:|---|---|---|---|
| 1 | `fixture-email-first` | Phase 112 email-first fixture | `localhost` / `127.0.0.1` + path `phase112-email-first` | **CI fixture PASS**; live local **PENDING_OPERATOR** |
| 2 | `amazon-il` | Amazon ישראל | `amazon.co.il` / `amazon.com` | **PENDING_OPERATOR** |
| 3 | `ksp` | KSP | `ksp.co.il` / `auth.ksp.co.il` | **PENDING_OPERATOR** |

Hosts not listed → AC-112-26 **website not supported** (never silent).

### (6) Recorded step-1 fill evidence

| Evidence | Result |
|---|---|
| HTML fixture via linkedom + identity-first engine | **PASS** — email field set to vault value; `filled>=1`; `passwordAbsent=true` |
| Command | `node scripts/verifyPhase112IdentityFirst.mjs` → **PASS** |
| Live Amazon IL | **PENDING_OPERATOR** (required before Architect) |
| Live KSP | **PENDING_OPERATOR** (required before Architect) |
| Live localhost fixture in Chrome + extension | **PENDING_OPERATOR** |

### (7) Console + extension logs of a failed attempt (template for operator paste)

**Hub (expected on failure):**
```text
[Phase112 Medium] attempt_start { activeProfileId, serviceId, openHost, supportedSiteId, fieldIds }
[Phase112 Medium] step1_failed { reason, filled, failureClass, pageDetected, … }  // never credentials
```

**Extension (expected):**
```text
[External] sendResponse: identity-first-autofill { ok: false, reason: '<classified>', filled: 0, via: 'identity-first-autofill' }
```

**Operator:** attach real failed-attempt logs for ≥1 failure class below when running live UAT.

### (8) Failure classification map (Hub reason → class)

| Class (D-112-24) | Example reason / gate | AC-112-26 Hebrew category |
|---|---|---|
| login_interface_not_detected | `identity_step_not_found`, `form_not_found` | login form not detected |
| field_not_detected | `no_identity_mapping`, `identity_fill_failed` | first field not detected |
| profile_not_resolved | missing `activeProfileId` | no credentials for profile |
| credential_not_available | no identity vault value | no credentials for profile |
| browser_permission_missing | extension missing / id unset | system error |
| script_not_injected | `script_injection_failed`, engine missing | system error |
| website_security_restriction | `bot_interstitial`, CSP-like | blocked by website |
| unsupported_login_flow | not on supported list / `url_not_allowed` | website not supported |
| unhandled_implementation_defect | unknown / timeout / null response | system error |

### BD-112-4 — Profile → credential linkage
- `openServiceWithProfile` resolves profile → `credentialsByProfileId[profileId]`
- Passes `activeProfileId` into `executeServiceFromTile` → `executeMediumAssist`
- Missing profile / missing identity credential → explicit AC-112-26 status (3); logged without secret values

### BD-112-5 — Login-page detection
- Extension: `detectVisibleIdentityStep` (≥1 identity input; no `assessStandardLogin` veto)
- Failure reason `identity_step_not_found` → “login form not detected”
- Hub diagnostic includes `pageDetected` boolean on step1_failed / step1_filled logs

---

## Commands (code gate — not acceptance)

```text
node scripts/verifyPhase112IdentityFirst.mjs     → PASS
node scripts/verifyPhase112MediumStatus.mjs      → PASS
node scripts/verifyPhase112LoginIntelligence.mjs → PASS
node scripts/verifyPhase110StandardAutofill.mjs  → PASS
node scripts/verifyPhase103Execution.mjs         → PASS
npm run build                                    → PASS
```

## Revalidation checklist (H7 — all required for Architect)

```text
[ ] Released build + feature on
[ ] Profile selected
[ ] Fixture localhost step-1 fills
[ ] Amazon IL step-1 fills (supported list)
[ ] KSP step-1 fills (supported list)
[ ] Unsupported site → explicit “website not supported”
[ ] Repeat after browser restart
[ ] No credential leakage in UI/logs
[ ] Shufersal basic/110 PASS
[ ] Clalit basic/110 PASS
[ ] Failed-attempt logs attached (section 7)
```

## Scope affirmation
No auto Continue · no mandatory step-2 password · no CAPTCHA/OTP/federated · no 108 rediscovery · D-112-25 freeze observed.

## Developer Declaration
M9/M10 **code** delivered with fixture + status units.  
Architect status remains **REJECTED**.  
**Do not re-review until operator live UAT green on every supported-list site + failed-log evidence.**

```text
Detected phase: 112
Selected state: IMPLEMENT
Status: REJECTED_IN_PROGRESS (M9/M10 code + fixture Pass; live UAT PENDING_OPERATOR; COMPLETE forbidden)
```
