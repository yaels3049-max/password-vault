# Developer Phase 117

## Phase Identifier
PHASE=117

## Status
STATUS: **CLOSED** (2026-09-16) — Operator authorized close; program advancing to next phase

```text
PHASE 117: CLOSED — FUNCTIONALLY COMPLETE
OPERATOR RIVHIT RETEST: PASS
OPERATOR CLOSE: «אפשר לסגור את פאזה 117. אנחנו עוברים לפאזה הבאה.»
SECURITY REVIEW (broad production validated): still PENDING outside this close
BROAD PRODUCTION ACTIVATION: still BLOCKED until Security Owner
```

Operator live Rivhit retest: **PASS**. Operator directed phase close and advance (2026-09-16).

Functional plumbing + latency (D-117-17/18) + tab/concurrency (D-117-19/20) accepted. Closing Phase 117 does **not** by itself unlock broad production `validated` — that remains a Security Owner gate.

**Handoff:** Manager/Architecture advance `PHASE.md` and authorize the next phase plan. Developer does not rewrite `PHASE.md` or start the next phase until that plan exists.

## Phase Goal (as implemented)
Generic administrator-managed deterministic Autofill: `field.id` → CSS locator in `service_registry.metadata.autofillProfile`. Schema-dynamic. Legacy Autofill retained. No Rivhit/hostname/field-name hard-codes in the Managed engine.

## M0 / D-117-0 — Rivhit field-ID check

**D-117-0: PASS** (2026-09-16)

Source: authenticated **Admin UI** evidence provided by the Operator (live/current Rivhit credential schema). Developer unauthenticated anon `service_registry` read could not see global rows (RLS); Operator Admin UI is the accepted live configuration source.

| Item | Value |
|---|---|
| Result | **PASS** — exact ID set match |
| Expected IDs | `username`, `password`, `business_id` |
| Active IDs found | `username`, `password`, `business_id` |
| Required | all three required |

Additional observed Admin configuration (not a field-ID mismatch; no repair):

| field.id | input | required | masked |
|---|---|---|---|
| `username` | text | yes | no |
| `password` | text | yes | yes |
| `business_id` | number input | yes | no |

These IDs remain **Rivhit configuration only**. They are **not** encoded in `src/autofill`, `src/execution/managedAutofill.ts`, or `extension/generic/validated-autofill.js`.

## M8 — Operator-only Rivhit functional validation

Operator decision (2026-09-16): M8 may proceed as controlled Operator-only functional validation. **Does not constitute Security approval.** External Security Reviewer remains the gate for broad production release.

### M8-A — Live locator / in-memory runner (prior)

**Live Login Entry (GET only):** `https://online1.rivhit.co.il/loginmanager/login`

| Check | Result |
|---|---|
| HTTP | 200 |
| Final URL | same Login Entry (no splash redirect) |
| Origin | `https://online1.rivhit.co.il` — matches `allowedOrigin` |
| `#username` / `#password` / `#osek` | exact-one visible editable |
| `#remember` | present; **not mapped**; remained unchecked after fill |
| Managed runner on live HTML (in-memory) | `ok`, filled **3** |
| Auto-submit | **not** invoked |
| Credential values in this report | **none** |

### M8-B — Hub tile path prepared (awaiting Operator)

**Controlled path (DEV only):** Admin → Rivhit → «אשר מיפוי» (app confirm dialog; dynamic service name) sets `supportState=validated` + stamps `validation.metadataVersion = configVersion` for **this service only**. Production builds omit the button (`import.meta.env.DEV`).

**Not done until Operator reports live tile result:**
- Operator Digital Home → Rivhit tile → extension Managed fill on live Login Entry
- Manual submit by Operator
- M8 Verification Report to Architecture with runtime evidence (no credentials)

**Operator live test checklist (no credential values in replies):**
1. Admin (localhost DEV) → Rivhit → confirm mappings → «אשר מיפוי» → מצב תמיכה = «מאומת»
2. Reload Digital Home; extension loaded; Rivhit credentials saved (Operator account only)
3. Click Rivhit tile → Login Entry `…/loginmanager/login` opens
4. Expect fill of username / password / business id only; `#remember` untouched; no auto-submit
5. Operator submits manually; note PASS/FAIL (fields filled? wrong origin? generic path?)
6. Do **not** paste passwords / usernames / business ids into chat or screenshots of filled fields

After Operator PASS: set phase status to FUNCTIONALLY VALIDATED; Security Review still PENDING; broad activation still BLOCKED.

## Metadata sample (configuration evidence — Operator functional activate stamps validation)

Redacted conceptual Rivhit `autofillProfile` (would persist under `service_registry.metadata`; **must stay `not_configured` in production until Security**):

```json
{
  "supportState": "not_configured",
  "configVersion": 1,
  "loginEntryUrl": "https://online1.rivhit.co.il/loginmanager/login",
  "allowedOrigin": "https://online1.rivhit.co.il",
  "fieldMappings": [
    { "fieldId": "username", "locatorType": "css", "locator": "#username" },
    { "fieldId": "password", "locatorType": "css", "locator": "#password" },
    { "fieldId": "business_id", "locatorType": "css", "locator": "#osek" }
  ]
}
```

`#remember` is not mapped. No credential values.

## Implementation (M1–M8)

| Milestone | What shipped |
|---|---|
| M1 | `src/autofill/validatedProfile.ts` — parse / structural validate / plan write; `configVersion` + `validation.metadataVersion`; explicit support-state actions; schema-dynamic joins |
| M2 | `updateGlobalRegistryRow` merges `autofillProfile` via `mergeAutofillProfileMetadata`; rejects unknown fieldId / non-css / non-HTTPS / incomplete coverage; strips control keys |
| M3 | `AutofillProfileEditor.tsx` locators from `login_fields`; `IntegrationStatusPanel` shows supportState; save as draft; explicit reset / disable; **no production activate** |
| M4 | `extension/generic/validated-autofill.js`; background `HUB_MANAGED_AUTOFILL` + `frameIds: [0]`; reuses `GenericFillExecutor`; bypasses heuristics |
| M5 | `executeServiceFromTile` Managed branch **after adapters, before LI/generic**; `executeManagedAutofill` never calls generic fill |
| M6 | `scripts/verifyPhase117ManagedAutofill.mjs` T0–T28 + fixtures including synthetic `customer_number`+`pin` |
| M7 | Security package below — plumbing vs blocked production activation |
| M8 | **In progress** — locator PASS; Hub path prepared (DEV activate); awaiting Operator live tile |

## Automated tests (T0–T29)

Command:

```text
> node scripts/verifyPhase117ManagedAutofill.mjs
verifyPhase117ManagedAutofill: PASS (T0–T28 automated; T29 = this script + tsc/build)

> npx tsc -b --pretty false
(exit 0)

> npm run build
✓ 247 modules transformed.
✓ built in 3.22s
```

M8 live locator command (GET + in-memory runner; no credentials transmitted):

```text
> node scripts/verifyPhase117RivhitLiveM8.mjs
```

Live GET + runner evidence from this session: HTTP 200; origin match; three locators exact-one; runner `ok` filled 3; `#remember` unchecked; submit not invoked; no credential values logged.

No separate lint script in `package.json`. No unused-lint errors on touched files.

| # | Result |
|---:|---|
| T0 | PASS (D-117-0 live Admin UI: `username`, `password`, `business_id`) |
| T1 | PASS valid mapping accepted |
| T2 | PASS unknown `field.id` rejected |
| T3 | PASS missing required mapping rejected |
| T4 | PASS wrong origin fails |
| T5 | PASS non-HTTPS / origin mismatch rejected |
| T6 | PASS zero-match fails |
| T7 | PASS multi-match fails |
| T8 | PASS hidden target rejected |
| T9 | PASS non-editable (disabled) rejected |
| T10 | PASS partial fill is not success |
| T11–T13 | PASS Rivhit-**config** fixture fill (`#username` / `#password` / `#osek`) — test evidence only |
| T14 | PASS `#remember` not mapped / not filled |
| T15 | PASS top-frame inject `frameIds: [0]` (iframe document N/A in linkedom) |
| T16 | PASS submit never invoked |
| T17 | PASS Managed hub/runner do not call `mapLoginFields` / `runGenericAutofill` / `executeGenericAutofill(` |
| T18 | PASS `executeGenericAutofill` retained on legacy path |
| T19 | PASS missing-credentials / NOT_CONFIGURED / NO_STORED not Managed-eligible; Launch Card copy unchanged |
| T20 | PASS no credential values in Managed logs |
| T21 | PASS runtime requires `validation.metadataVersion === configVersion` |
| T22 | PASS locator change bumps version → `unsupported` / not eligible |
| T23 | PASS Login Entry change bumps version / invalidates |
| T24 | PASS clearing mappings cannot remain `validated` (structural reject) |
| T25 | PASS reset to `not_configured` only via explicit action; cannot reset from `validated` |
| T26 | PASS structural save never sets `validated`; activate requires `liveValidationApproved` |
| T27 | PASS no Rivhit hostname / `#osek` / `business_id` in Managed engine modules |
| T28 | PASS synthetic `customer_number`+`pin` → `#customer-number`/`#pin` same engine |
| T29 | PASS verify script + `tsc -b` + `npm run build` |

**AC-117-29 / T28** is the genericity proof: different schema, same planner + runner, no Rivhit field assumptions, no service-specific code.

## Version invalidation (AC-117-23…28)

- Activate stamps `validation.metadataVersion = configVersion`.
- Security-relevant edit while `validated` increments `configVersion` and sets `unsupported`.
- `isManagedAutofillEligible` requires version match; mismatch is not eligible (fail closed to legacy rules).
- Mapping-clear save is rejected structurally (does not implicit-reset to `not_configured`).
- Dedicated Admin control `reset_not_configured` (forbidden from `validated`).

## Runtime notes

- Admin can save CSS locators; structural OK; state remains `not_configured`.
- Mock DOM: Rivhit-shaped fixture filled three mapped fields; `#remember` empty; no submit.
- Synthetic non-Rivhit schema filled `#customer-number` and `#pin`.
- Top-frame-only: background Managed inject uses `frameIds: [0]`; does not call `pickBestGenericFrameResult`.
- **M8:** live Rivhit Login Entry HTML fetched (GET); Managed runner filled the three mapped fields in-memory; no POST; production `validated` not written.

Post-edit eligibility: changing a locator after `validated` (in planner tests) blocks Managed until re-validation + explicit activation (activation itself still Security-gated / blocked for broad production).

## Affirmations

- Validated/Managed path does **not** call `mapLoginFields` / `runGenericAutofill` / `executeGenericAutofill(`.
- Managed Hub (`managedAutofill.ts`) and extension runner (`validated-autofill.js`) contain **no** Rivhit field-ID / hostname / service-ID fill hard-coding.
- No encryption / vault / key changes.
- No Phase 116 identity changes.
- No Login Discovery changes.
- No Phase 113 Launch Card copy changes (`פתח אתר`, missing/no-stored/not-configured strings unchanged).
- `credentialMode` is not redefined by `supportState`.
- Silent Managed→generic success fallback is not implemented.
- Production release builds do **not** expose activate (`import.meta.env.DEV` gate). DEV Operator may activate one service for functional validation only.

## Operator UX correction (2026-09-16)

UX-only. Gate still `autofillLiveValidationApproved: false`. Production `validated` not enabled.

| Change | File |
|---|---|
| Removed Admin Security-gate copy; save confirmation «המיפוי נשמר בהצלחה» (~4s + סגירה); errors unchanged | `src/admin/AutofillProfileEditor.tsx` |
| Keep editor mounted across save reload so confirmation stays ~4s (key=id, locators sync without remount) | `src/admin/RegistryAdmin.tsx`, `src/admin/AutofillProfileEditor.tsx` |
| Success row dismiss control | `src/admin/admin.css` |
| AC-117-20 assert now checks internal gate, not Admin copy | `scripts/verifyPhase117ManagedAutofill.mjs` |
| Admin save «יש להתחבר לחשבון» after login: App boot signOut no longer runs after navigate to `#/admin`; session resolver uses local session + refresh before failing | `src/App.tsx`, `src/auth/session.ts` |
| Hide `configVersion` from Admin UI; rename reset to «נקה מיפוי» with confirm «לנקות את המיפוי השמור?» | `src/admin/AutofillProfileEditor.tsx` |
| DEV-only Operator «אשר מיפוי» → `activate_validated` (app confirm dialog, dynamic service name); production builds omit enablement | `src/admin/AutofillProfileEditor.tsx`, `src/admin/admin.css` |
| Always show four Managed Autofill actions in stable order; enable/disable by validity; rename «הגדר כלא נתמך»; stronger disabled affordance (dashed border, grayscale, not-allowed) | `src/admin/AutofillProfileEditor.tsx`, `src/admin/admin.css` |
| «נקה מיפוי» clears current form inputs only (not persisted); Save enabled when empty form differs from saved | `src/admin/AutofillProfileEditor.tsx` |
| Action-row UX evidence A/B/C (fixture screenshots + `disabled`/`aria-disabled`/`data-enabled`) | `team-Yuri/evidence/phase117-autofill-actions-ux/` |

## Security package (M7) — plumbing vs blocked production

| Topic | Implemented (plumbing) | Awaits Security Owner |
|---|---|---|
| Admin-only mapping writes | Uses existing `updateGlobalRegistryRow` (global RLS / admin UI) | Confirm RLS still sufficient |
| Server-authoritative profile | Profile persisted in `service_registry.metadata.autofillProfile` | Production `validated` stamp |
| Login Entry + origin bind | HTTPS + `allowedOrigin === origin(loginEntryUrl)` | Live origin inject |
| Selector-controlled injection | Extension fills only explicit CSS mappings | Host-permission policy (no expansion shipped) |
| Plaintext Hub→extension | Same existing channel as generic fill; documented; **not ZK** | Review of channel |
| Top-document / frames | `frameIds: [0]`; runner refuses non-top | Confirm against live Rivhit iframe |
| Live validation | Planner supports `activate_validated` **only** with `liveValidationApproved` | External Security Reviewer before production UI activate |
| Tampering resistance | Version match + invalidation on security-relevant edits | Residual review |
| Logs/telemetry | Managed logs fieldIds/url/origin only | Residual review |
| Production `validated` in release builds | **Not exposed** (no activate button when `!DEV`) | **Blocked (AC-117-20)** |
| Operator-only M8 functional (DEV activate + live tile) | Path ready; **awaiting Operator tile result** | Not a Security approval |
| Broad production activation | **Not enabled** | **Blocked** |

## Files changed / added

| Path | Role |
|---|---|
| `src/autofill/validatedProfile.ts` | M1 contract |
| `src/autofill/index.ts` | barrel |
| `src/admin/adminRegistryApi.ts` | M2 merge |
| `src/admin/AutofillProfileEditor.tsx` | M3 locator UI |
| `src/admin/RegistryAdmin.tsx` | M3 wire |
| `src/admin/IntegrationStatusPanel.tsx` | M3 supportState |
| `src/admin/admin.css` | M3 styles |
| `src/execution/managedAutofill.ts` | M5 helper |
| `src/execution/serviceExecution.ts` | M5 branch |
| `extension/generic/validated-autofill.js` | M4 runner |
| `extension/background.js` | M4 handler / top-frame inject |
| `scripts/verifyPhase117ManagedAutofill.mjs` | M6 T0–T29 |
| `scripts/verifyPhase117RivhitLiveM8.mjs` | M8 live locator + in-memory runner (no credentials transmitted) |
| `scripts/fixtures/phase117-rivhit-e2e-gate.json` | T0 / M8 gate |
| `scripts/fixtures/phase117-rivhit-login.html` | T11–T16 slice fixture |
| `scripts/fixtures/phase117-synthetic-pin.html` | T28 |
| `team-Yuri/dev-phase117.md` | this report |

Not modified: encryption, Phase 116, discovery engines, Phase 113 Launch Card copy, site adapters, `PHASE.md` / arch / manager artifacts.

## STOP conditions

All Architecture STOP conditions remain in force for **production** activation. D-117-0 is PASS. Latency + tab/concurrency amendments implemented (AC-117-30…37). **Operator Rivhit retest: PASS.** Broad production `validated` remains blocked pending the external Security Reviewer. Origin, top-frame, mapping-version, and logging protections were not weakened. Encryption and credential handling were not changed.

## M8 Operator live FAIL — root cause + fix (2026-09-16)

### Root cause
Hub `executeManagedAutofill` used fire-and-forget `sendExtensionMessage` and returned `{ ok: true, extensionUsed: true }` as soon as the message was **dispatched**, without awaiting tab open or fill verification. Digital Home then mapped that empty success to Phase 113 soft copy `MSG_AUTO_ATTEMPTED` («ניסיון מילוי אוטומטי הופעל…»). If the extension did not create a tab (handler miss / error / outdated extension), the Operator saw success with **no new tab**.

### Fix
| Path | Change |
|---|---|
| `src/execution/managedAutofill.ts` | Async Hub: `await sendExtensionMessageAsync`; structured success/failure copy; open-failed vs fill-failed; `serviceClaimsValidatedManagedProfile` |
| `src/execution/serviceExecution.ts` | `await executeManagedAutofill`; validated claim fail-closed before LI/generic |
| `src/loginAssistance/assistanceActions.ts` | Validated services never get `MSG_AUTO_ATTEMPTED`; surface structured Managed messages + outcome |
| `src/loginAssistance/LoginAssistancePanel.tsx` | Status tone from structured outcome |
| `scripts/verifyPhase117ManagedAutofill.mjs` | M8 await / fail-closed / no-MSG_AUTO regressions |

### Confirmed
- Validated Rivhit (supportState=validated) does **not** fall through to legacy/generic mapping.
- «פתח אתר» unchanged.
- Origin / top-frame / version checks unchanged.
- No credential value logging.

### Automated evidence
```text
node scripts/verifyPhase117ManagedAutofill.mjs
→ PASS (T0–T28 + M8 await/fail-closed regressions)
```

### Operator retest required
M8 remains **OPEN / FAIL** until Operator repeats the Rivhit live tile test:
1. Reload Hub + extension (ensure `HUB_MANAGED_AUTOFILL` handler is loaded).
2. Rivhit validated + credentials present.
3. Click «נסה מילוי אוטומטי» — must open `https://online1.rivhit.co.il/loginmanager/login` in a **new tab**, fill `#username` / `#password` / `#osek`, leave `#remember`, no submit.
4. UI message must reflect verified fill or clear failure — never «ניסיון מילוי אוטומטי הופעל…» on click alone.

## Latency amendment D-117-17 / D-117-18 (2026-09-16) — IMPLEMENTED

Authorized by `arch-phase117.md`. AC-117-30…36.

### Timing comparison (no credential values)

| Stage | Before (Managed inherited legacy) | After (D-117-17) |
|---|---|---|
| Post URL-match / top-frame ready | Fixed `GENERIC_REAL_SITE_INITIAL_DELAY_MS = 4000` before first fill attempt | `MANAGED_AUTOFILL_INITIAL_DELAY_MS = 0` — attempt mappings immediately |
| Not-ready targets | Same 4s gate + limited retries | Bounded adaptive retry (`MANAGED_AUTOFILL_RETRY_DELAY_MS = 300`, max attempts shared bound) on `targets_not_ready` only |
| Legacy/generic Autofill | 4000ms initial delay | **Unchanged** 4000ms (AC-117-33) |
| Hub UX while awaiting | No working state → false “failed” perception | Immediate «ממלא פרטי כניסה...» then verified success/failure (D-117-18) |

### Files changed (latency amendment)
| Path | Change |
|---|---|
| `extension/background.js` | `openGenericRealSiteTab(..., { initialDelayMs })`; Managed passes `0`; adaptive retry on `targets_not_ready`; legacy callers keep default 4s |
| `extension/generic/validated-autofill.js` | `assessManagedTargetsReady`; fill only when all mapped targets exact-one safe; verify after fill |
| `src/execution/managedAutofill.ts` | `MSG_MANAGED_IN_PROGRESS`; in-flight lock (AC-117-36) |
| `src/loginAssistance/LoginAssistancePanel.tsx` | Immediate in-progress status; block parallel clicks |
| `scripts/verifyPhase117ManagedAutofill.mjs` | AC-117-30…36 + prior Managed/M8 regressions |

### Preserved
Origin / top-document / version match / fail-closed / no legacy fallback for validated / no auto-submit / no Rivhit-specific branches / no secrets in logs / «פתח אתר» unchanged.

### Automated evidence
```text
node scripts/verifyPhase117ManagedAutofill.mjs
→ PASS (T0–T28 + M8 await + AC-117-30…36 latency amendment)

npx tsc -p tsconfig.app.json --noEmit
→ PASS
```

### Operator Rivhit retest (required — Phase 117 stays OPEN)
1. Reload Hub **and** extension (latency + Managed handler).
2. Rivhit validated + credentials.
3. Click «נסה מילוי אוטומטי»:
   - UI immediately shows «ממלא פרטי כניסה...» (not success).
   - New tab opens to Login Entry without an artificial ~4s wait before fill attempt.
   - Fields `#username` / `#password` / `#osek` fill when ready; `#remember` untouched; no auto-submit.
   - Status replaced by verified success or clear failure.
4. Confirm rapid double-click on the **same** profile does not start a second Managed run; a **different** profile may still run.

## Tab placement + concurrency D-117-19 / D-117-20 (2026-09-16) — IMPLEMENTED

Authorized by `arch-phase117.md`. AC-117-36 revised; AC-117-37.

### Architecture approval regression items 1–9

| # | Item | Evidence |
|---|---|---|
| 1 | Adjacent Managed tab when `sender.tab` available (`index+1`, `openerTabId`) | `buildManagedTabCreateProperties` + `HUB_MANAGED_AUTOFILL` forwards `sender`; static assert AC-117-37 |
| 2 | Placement soft fallback when `sender.tab` missing / adjacent create fails | Omit hints → default `tabs.create({url})`; retry URL-only on Managed placement failure |
| 3 | In-flight keyed by `(serviceId, accessProfileId)` only | `managedAutofillExecutionKey` / `managedAutofillInFlightKeys` Set |
| 4 | Same key in flight → no duplicate | Hub regression: second same-key call → `busy` |
| 5 | Different profile / different service → concurrent OK | Hub regression while first deferred |
| 6 | Clear key on every terminal outcome; re-launch after settle OK (no cooldown) | `finally` delete + relaunch assert |
| 7 | No global Managed busy boolean | Assert absence of `let managedAutofillInFlight = false`; UI uses `autoBusyProfileId` + keyed check |
| 8 | Prior Managed / security / latency / genericity tests still PASS | Full `verifyPhase117ManagedAutofill.mjs` suite |
| 9 | Legacy/generic tab placement unchanged | Generic open helpers omit `tabCreateProperties` |

### Files changed (this amendment)
| Path | Change |
|---|---|
| `extension/background.js` | Managed `tabs.create` placement from `sender.tab`; soft fallback; legacy callers untouched |
| `src/execution/managedAutofill.ts` | Replace global boolean with keyed Set; require `accessProfileId` |
| `src/execution/serviceExecution.ts` | Pass `options.activeProfileId` into Managed Hub |
| `src/loginAssistance/LoginAssistancePanel.tsx` | In-progress / busy scoped to active profile execution |
| `scripts/verifyPhase117ManagedAutofill.mjs` | AC-117-36/37 + regression items 1–9 |

### Preserved
Origin / top-document / version match / fail-closed / no legacy fallback for validated / no auto-submit / no Rivhit-specific branches / no secrets in keys or logs / Managed delay=0 / legacy 4s / «פתח אתר» unchanged.

### Automated evidence
```text
node scripts/verifyPhase117ManagedAutofill.mjs
→ PASS (T0–T28 + M8 + AC-117-30…37 tab/concurrency)

npx tsc -p tsconfig.app.json --noEmit
→ PASS

node --check extension/background.js
→ PASS
```

### Operator Rivhit retest — **PASS** (2026-09-16)

Operator confirmation: «נבדק ותקין. אפשר להמשיך הלאה».

No credential values recorded. Functional M8 / latency / tab-adjacency / keyed concurrency accepted.

## Architecture review (2026-09-16)

ARCHITECTURE_REVIEW: **ACCEPTED_WITH_PRODUCTION_GATE**

Plumbing accepted. **D-117-0: PASS.** Latency + tab/concurrency amendments **implemented** (AC-117-30…37 automated PASS). **Operator Rivhit retest: PASS.** **Phase 117 CLOSED** by Operator direction (2026-09-16) for program advance. External Security Reviewer remains required before broad production `validated` / release. Next phase awaits Manager/Architecture (`PHASE.md` + plan) — Developer does not start it unilaterally.
