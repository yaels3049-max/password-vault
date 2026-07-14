# Developer Phase 110

## Phase Identifier
PHASE=110

## Status
STATUS: IN_PROGRESS — code + static verify + build delivered; **Shufersal + Clalit live UAT PENDING_OPERATOR** (H7). Expanded non-anchor fill UAT also PENDING_OPERATOR.

## Source References
- `team-Yuri/manager-phase110.md` (READY_FOR_DEVELOPER; M1–M8; H1–H8)
- `team-Yuri/arch-phase110.md`
- `team-Yuri/PLAN.md` §18 Phase 110 (AC-110-1 … AC-110-15)
- `team-Yuri/arch-phase103.md` — pipeline preserved
- `docs/MIGRATION_PHASE_110.md`
- `team-Yuri/PHASE.md` — `PHASE=110`

## Implementation Summary

Expanded **generic** autofill coverage for standard single-page logins across catalog / custom / admin origins by hardening the existing Phase 103 extension engine (standard-login gate, deterministic confidence / ambiguity rejection, visible-only fill, never submit) and Hub-side friendly `fill_failed` signal. Eligibility remains metadata-driven (`loginFields` + credentials) — **not** a Shufersal/Clalit allowlist. `executeServiceFromTile` orchestration unchanged.

### Operator follow-up — Hapoalim open-only (2026-07-13)
Root cause: catalog/`service_registry` had **no `loginUrl`** → tile opened marketing homepage; fill never saw the login form. Also SPA may omit `<form>`.

Fix: seed `loginUrl` + label `קוד משתמש`; SQL migration; formless detection; identity label synonyms; SPA path match. Field ids stay `username`/`password` (existing vault values unchanged).

### Operator follow-up — Hapoalim URL ok, fields empty (2026-07-13)
Operator confirmed open URL `https://login.bankhapoalim.co.il/ng-portals/auth/he/` but fields still empty.

Additional fixes (extension **1.4.7**):
- Inject detect/fill with **`allFrames: true`** and pick the best frame result (iframe login)
- Map password when banks use `type=text` + password label
- Clear `readOnly` during fill; Angular-friendlier input events; Material/aria label walk
- Align seed URL to `/ng-portals/auth/he/`; settle delay 4s

**Operator:** reload extension `1.4.7`, hard-refresh Hub, retest Hapoalim tile.

### Operator follow-up — other sites open-only (Bank Jerusalem, 2026-07-13)
Engine fixes were always **generic** (not Hapoalim-only). Hapoalim also received a catalog `loginUrl` seed.

Bank Jerusalem (`https://services.bankjerusalem.co.il/Pages/Login.aspx`) failed because:
1. Custom/discovered rows often have `loginUrl` but **null `loginFields`** → Hub only opened the tab (eligibility required explicit fields). Fixed: complete DEFAULT credentials + `loginUrl` now attempt fill.
2. Radware bot interstitial before the form — wait/retry on `bot_interstitial`.
3. Hidden OTP-tab inputs no longer veto the visible password tab.

Extension **1.4.8**.

### Operator follow-up — Ivory open, no fill (2026-07-13)
Ivory (`https://www.ivory.co.il/users.php?act=login`) has a standard password form plus SMS option and reCAPTCHA footer.

Fixes (extension **1.4.9**, generic — no Ivory branch):
- reCAPTCHA no longer vetoes fill (still never auto-submit)
- Scope detection around the password field when page mixes search/newsletter/SMS
- Map email-named / `type=email` inputs to vault `username`


## Implemented Milestones

| Milestone | Completed | Notes |
|---|---:|---|
| M1 Audit / allowlists | Yes | Hub eligibility already origin-independent; background https policy; no host allowlist restored |
| M2 Mapper + standard gate | Yes | `assessStandardLogin`; MIN scores; ambiguity margin |
| M3 Fill executor safety | Yes | `isSafeFillTarget`; never submit; never hidden |
| M4 Origin-independent | Yes | Same `shouldAttemptGenericAutofill` for all origins; doc matrix |
| M5 Failure / health | Yes | `fill_failed` + Hebrew non-blocking Dashboard message; `not_standard_login` extension reason |
| M6 Metadata proposal | **Deferred** | Explicit — no silent admin overwrite (D-110-11) |
| M7 Migration doc | Yes | Coverage matrix + permission notes |
| M8 Verify + build | Static Yes / UAT Pending | Scripts + build below |

## Files Changed

| File | Change |
|---|---|
| `extension/generic/form-detector.js` | Visibility / aria-hidden; `assessStandardLogin`; OTP/CAPTCHA traps |
| `extension/generic/field-mapper.js` | Confidence floors; ambiguity reject; no service branches |
| `extension/generic/fill-executor.js` | Visible-only; refuse unsafe targets; never submit |
| `extension/generic/generic-autofill.js` | Standard gate before map/fill |
| `extension/generic/login-form-detect.js` | Standard gate on detect path |
| `src/execution/autofillEligibility.ts` | Origin-independent docs; health code type |
| `src/execution/serviceExecution.ts` | Friendly `fill_failed` userMessage (minimal touch) |
| `src/serviceManagement/openWithProfile.ts` | Pass `metadataHealth` |
| `src/Dashboard.tsx` | Non-blocking fill_failed banner |
| `scripts/verifyPhase110StandardAutofill.mjs` | New static verify |
| `docs/MIGRATION_PHASE_110.md` | Coverage matrix + permissions + defer M6 |

## Hard Gates

| Gate | Status |
|---|---|
| H1 No auto-submit | PASS (static) |
| H2 No hidden fill | PASS (static) |
| H3 Open-first | PASS (Phase 103 path preserved) |
| H4 No AI / probabilistic | PASS (static) |
| H5 No generic service branching | PASS (static) |
| H6 Phase 103 pipeline unchanged | PASS |
| H7 Shufersal + Clalit UAT | **PENDING_OPERATOR** |
| H8 Verify + docs + build | Static PASS / UAT pending |

## Static verify

| Command | Result |
|---|---|
| `node scripts/verifyPhase110StandardAutofill.mjs` | **PASS** |
| `node scripts/verifyPhase103Execution.mjs` | **PASS** |
| `npm run build` | **PASS** |

## UAT evidence (required — H7)

| # | Test | Result |
|---:|---|---|
| T8 | Shufersal tile → fill, no submit | **PENDING_OPERATOR** |
| T9 | Clalit tile → fill, no submit | **PENDING_OPERATOR** |
| T4 | ≥1 non-anchor standard service fill | **PENDING_OPERATOR** |
| T5 | Non-standard page → open, no unsafe fill | **PENDING_OPERATOR** |

Operator paste:

```text
Shufersal Pass/Fail:
Clalit Pass/Fail:
Non-anchor service id/url:
Non-anchor Pass/Fail:
Non-standard open-only Pass/Fail:
```

## M6 deferral

Metadata proposal / silent `loginFields` enrichment **deferred**. `POC_GENERIC_DETECT` unchanged for future use. Documented in `docs/MIGRATION_PHASE_110.md`.

## Scope Compliance

- No Phase 112 complex-login classifiers invented (signals only)
- No Phase 108 discovery ownership
- No Phase 109 auth/hydrate ownership
- No Phase 116 canonicalization
- No `executeServiceFromTile` redesign

## Developer Declaration

```text
Detected phase: 110
Selected state: IMPLEMENT
Status: IN_PROGRESS
```

Complete after operator records Shufersal + Clalit (+ expanded) UAT Pass above.
