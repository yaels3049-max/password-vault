# Developer Phase 120

## Phase Identifier
PHASE=120

## Status
STATUS: **120.3.6-impl COMPLETE** — Dedicated Site-Adapter Legacy Debt Removal — awaiting Architecture review of Package A/B evidence  
(Prior: 120.2-AP complete; P4 still FAIL pending remap; Owner live validation not started for P4)

---

# Slice 120.3.6-impl — Dedicated Site-Adapter Legacy Debt Removal (2026-09-22)

**Authorized:** Architecture PASS §12.4; binding DD `manager-phase120.md` Slice 120.3.6.  
**STOP:** Architecture review of this evidence. No scope expansion. No Owner UAT of retired fixture Autofill required.

## Explicit statements
- **No** replacement dedicated adapter / hostname / serviceId Autofill added.  
- **No** Managed imitation of the retired dedicated-adapter site.  
- **No** fixture-preserving Managed config authored for the retired seed.  
- **No** new generic capability.  
- Practice DEV path **untouched**.  
- Managed fail-closed / no auto-submit / no silent Managed→generic **preserved**.

---

## Package A — Dead / POC exclusive hygiene (non-behavior-changing)

| # | Artifact | Action | Exclusive ownership |
|---|---|---|---|
| A1 | `LEGACY_ADAPTER_ID_BY_SERVICE_ID = {}` in `legacyCatalogMap.ts` | **Deleted**; lookup uses `service.adapterId` only | DEAD empty map |
| A2 | `openIsraeliSiteAutofillTest`, `openHtzoneTile`, `POC_IL_SITE_URL`, `HTZONE_SERVICE_ID`, `htzoneAdapter` import in `pocAutofill.ts` | **Deleted** | HTZone-only helpers |
| A3 | DEV Dashboard wiring to A2 | **N/A** — already absent (`verifyPhase113` asserts no PoC fill buttons) | — |

**Retained in `pocAutofill.ts`:** practice / Shufersal / Clalit / generic POC helpers.

### Package A files
| File | Change |
|---|---|
| `src/service/legacyCatalogMap.ts` | Remove dead map; `adapterId` from service only |
| `src/pocAutofill.ts` | Remove HTZone-only exports/helpers |

### Package A Digital Home routing
**Unchanged** (no production tile path edit).

---

## Package B — Production dedicated-adapter stack retirement (behavior-changing)

| # | Artifact | Action |
|---|---|---|
| B1 | `src/execution/adapters/htzoneAdapter.ts` | **Deleted** |
| B2 | `registry.ts` | `SITE_SPECIFIC_ADAPTER_IDS = {practice}` only; remove htzone registration |
| B3 | `builtinCatalog.ts` htzone seed | **Clear** `adapterId` (row retained) |
| B4 | `supportLevel.ts` | Remove `htzone` arm; keep `practice` |
| B5–B9 | Ext `POC_FILL_IL`, `isHtzoneLoginUrl`, open/fill/retry/mocks, `htzone-login` pageConfig | **Deleted** from `background.js` |
| B10 | `extension/htzone-adapter.js` | **Deleted** |
| B11 | Named `htzone.co.il` `host_permissions` | **Removed**; `https://*/*` retained |
| B12 | `serviceExecution.ts` comment | practice-only site-adapter set |
| — | `supabase/migrations/20260922120000_phase120_clear_htzone_adapter_id.sql` | Clear live `adapter_id` for `htzone` |

### Target tree after Package B (§4)
```text
1. adapterId ∈ {practice} AND registered → practiceAdapter → STOP
2. Managed claim/validated/eligible → Managed (fail-closed; never generic)
3–7. LI / medium / legacy generic / open-only (unchanged)
```
Former `adapterId=htzone` seed (now cleared) enters steps 2–7 like any non-adapter service — **no** dedicated fill; **no** special hostname behavior.

### Package B files
| File | Change |
|---|---|
| `src/execution/adapters/htzoneAdapter.ts` | Deleted |
| `src/execution/adapters/registry.ts` | practice-only |
| `src/catalog/builtinCatalog.ts` | clear htzone `adapterId` |
| `src/loginAssistance/supportLevel.ts` | remove htzone arm |
| `src/execution/serviceExecution.ts` | comment accuracy |
| `extension/background.js` | remove dedicated HTZone path |
| `extension/htzone-adapter.js` | Deleted |
| `extension/manifest.json` | remove named htzone hosts |
| `supabase/migrations/20260922120000_phase120_clear_htzone_adapter_id.sql` | NEW clear migration |
| `scripts/verifyPhase103Execution.mjs` | post-retirement expectations + LI Dashboard path |
| `scripts/verifyPhase108AdapterRouting.mjs` | practice-only / htzone cleared |
| `scripts/verifyPhase113LoginAssistance.mjs` | practice-only automatic arm |
| `scripts/checkRegistryAdapterIds.mjs` | expect htzone `adapter_id` null |
| `scripts/verifyPhase120DedicatedAdapterRetirement.mjs` | NEW A+B+§13 gate |

---

## §13 repository search evidence (src/ + extension/)

| Search | Result |
|---|---|
| `POC_FILL_IL` | **ZERO** |
| `htzone-adapter` | **ZERO** |
| `openHtzonePageAndFill` / `isHtzoneLoginUrl` / `runHtzoneAdapterFill` / `__israeliVaultHtzoneFill` | **ZERO** |
| `htzoneAdapter` / `adapters/htzoneAdapter` | **ZERO** |
| `MOCK_HTZONE` / `HTZONE_RETRY` | **ZERO** |
| `adapterId: 'htzone'` in catalog | **ZERO** |
| `SITE_SPECIFIC_ADAPTER_IDS` | **`practice` only** |
| Named `htzone.co.il` in manifest | **ZERO** |
| `LEGACY_ADAPTER_ID_BY_SERVICE_ID` | **ZERO** |
| `openIsraeliSiteAutofillTest` / `openHtzoneTile` | **ZERO** |

Historical `team-Yuri/` / old SQL seed text may still mention htzone inventory — non-runtime. Live clear: migration `20260922120000_phase120_clear_htzone_adapter_id.sql`.

---

## §10–11 regression / build / test

```text
node scripts/verifyPhase120DedicatedAdapterRetirement.mjs
→ PASS (Package A + B + §13)

node scripts/verifyPhase103Execution.mjs
→ PASS (adapters: practice only)

node scripts/verifyPhase108AdapterRouting.mjs
→ PASS (post 120.3.6)

node scripts/verifyPhase113LoginAssistance.mjs
→ PASS

node scripts/verifyPhase117ManagedAutofill.mjs
→ PASS

node scripts/verifyPhase120ManagedActivateGate.mjs
→ PASS

node scripts/verifyServiceSourceOwnership.mjs
→ PASS

npx tsc -b
→ exit 0
```

### §10 notes
| Area | Result |
|---|---|
| Managed exactly-one / fail-closed | Unchanged — 117 PASS |
| Managed-parity activate | Unchanged — 120.2-AP PASS |
| No silent Managed→generic | `serviceExecution` Managed branch still fail-closed open_only |
| Practice DEV path | Registry + `POC_FILL_DEMO` retained |
| Orchestrator tree | practice-only site-adapter set (§4) |
| No new hostname Autofill | §13 ZERO |
| Live retired-fixture Autofill UAT | **NOT REQUIRED** for slice PASS |

### Rollback
- Package B revertible as a unit (restore adapter + Ext path + catalog `adapterId`).  
- Package A independent (dead map / POC hygiene).

---

## Developer report (Architecture review)

| Field | Value |
|---|---|
| Slice | **120.3.6-impl** |
| Status | **COMPLETE** — Package A + Package B + §13 + §10–11 |
| Next | Architecture review of this evidence |
| Not done | Scope expansion; Managed imitation; fixture-preserving config; Owner UAT of retired Autofill |

---

## Status (prior slices retained below)
STATUS: **120.2-AP IMPLEMENTATION COMPLETE** — awaiting Architecture review of Developer report  
P4 remains **FAIL** (fixture multi_match) until Admin remaps under new gate + fill evidence  
Owner live validation **NOT AUTHORIZED** / **not started**

## Production code changes (120.2-AP Managed-parity activate gate)
| File | Change |
|---|---|
| `src/autofill/validatedProfile.ts` | Activate requires `managedReadinessProbePassed`; stamp `resultSummary: managed_readiness_ok`; strip control key |
| `src/autofill/managedReadinessProbe.ts` | **NEW** — Hub `ADMIN_MANAGED_READINESS_PROBE` caller; Hebrew failure surfaces `fieldId`/`detail`/`locator` |
| `src/autofill/index.ts` | Export probe-proof key + `MANAGED_READINESS_OK_SUMMARY` |
| `src/admin/AutofillProfileEditor.tsx` | Confirm → real assess-only probe → persist only on success |
| `extension/background.js` | `ADMIN_MANAGED_READINESS_PROBE` / `openPageAndManagedReadinessProbe` / `runManagedReadinessProbeOnTab` (assess-only; rejects `credentials`) |
| `scripts/verifyPhase120ManagedActivateGate.mjs` | **NEW** — AC-120.2-AP-1…11 regression |
| `scripts/verifyPhase117ManagedAutofill.mjs` | Activate asserts require probe proof + `managed_readiness_ok` |
| Shufersal registry / locators / `#j_password` | **UNCHANGED** |
| Managed fill uniqueness / retry timing | **UNCHANGED** (probe reuses existing `MANAGED_AUTOFILL_RETRY_DELAY_MS`) |

## Production code changes (120.2 §5D diagnostic ONLY)
| File | Change |
|---|---|
| `extension/generic/validated-autofill.js` | `targets_not_ready` includes `locator` + `observedUrl` (no secrets) |
| `extension/background.js` | Managed `[ManagedAutofillDiag]` lifecycle + structured failure fields; late assess-only probes +2s/+5s/+10s after `finishSession(targets_not_ready)` |
| Fill-path retry timing | **UNCHANGED** (`MANAGED_AUTOFILL_RETRY_DELAY_MS = 300`) |
| Mappings / config / hostname / legacy fallback | **NONE** |

---

## Slice 120.2-AP — Managed-parity activate gate (2026-09-22)

**Authorized:** Architecture DD PASS + Owner PROCEED TO DEVELOPER (`arch-phase120.md` §5E / Architect Review).  
**Not authorized:** Owner live validation; editing Shufersal locators; claiming P4 PASS.

### Behavior
1. Admin «אשר מיפוי» opens confirm → on confirm runs `runManagedReadinessProbe`.
2. Extension opens Login Entry (top doc), injects Managed scripts, calls **`assessManagedTargetsReady`** only (same exactly-one contract as Managed fill).
3. Fail closed on `zero_match` | `multi_match` | `hidden_target` | `non_editable` | `unsafe_target`; Admin error includes `fieldId` · `detail` · `locator`.
4. Only on probe success: Hub sets `autofillLiveValidationApproved` + `autofillManagedReadinessProbePassed` and planner stamps `supportState=validated` with `validation.resultSummary = managed_readiness_ok`.
5. Bare `liveValidationApproved` without probe proof → planner reject (`cannotActivateWithoutManagedReadinessProbe`).

### Forbidden items — affirmations
| Forbidden | Affirmed |
|---|---|
| first-match | Assess requires `nodes.length === 1` |
| hostname/serviceId branches | None in gate files |
| service-specific selectors | None |
| timing as uniqueness fix | Probe reuses existing Managed retry spacing only |
| legacy generic fallback | Distinct Admin probe message; no `POC_GENERIC_FILL` |
| Shufersal-specific code | None in gate modules |
| Changing Shufersal locator | Not edited |

### Automated regression evidence

```text
node scripts/verifyPhase120ManagedActivateGate.mjs
→ verifyPhase120ManagedActivateGate: PASS (AC-120.2-AP-1…11)

node scripts/verifyPhase117ManagedAutofill.mjs
→ verifyPhase117ManagedAutofill: PASS (T0–T28 + M8 + …)

npx tsc -b
→ exit 0
```

### AC-120.2-AP checklist

| AC | Result |
|---|---|
| AC-120.2-AP-1 | Activate without probe cannot set `validated` — **PASS** (planner + merge) |
| AC-120.2-AP-2 | Same `assessManagedTargetsReady` — **PASS** |
| AC-120.2-AP-3 | Fail closed + Admin surfaces fieldId/detail/locator — **PASS** (format + DOM) |
| AC-120.2-AP-4 | No first-match — **PASS** |
| AC-120.2-AP-5 | No hostname/serviceId — **PASS** (static) |
| AC-120.2-AP-6 | No timing-as-uniqueness — **PASS** (static) |
| AC-120.2-AP-7 | No vault credentials on probe — **PASS** (`credentials_forbidden_on_probe`) |
| AC-120.2-AP-8 | No legacy generic fallback — **PASS** |
| AC-120.2-AP-9 | Evidence `managed_readiness_ok` — **PASS** |
| AC-120.2-AP-10 | Fixture locators not edited — **PASS** |
| AC-120.2-AP-11 | Structural save never validated; fill uniqueness unchanged — **PASS** |

### Developer report (for Architecture review)

| Field | Value |
|---|---|
| Slice | **120.2-AP** |
| Status | **COMPLETE** (implementation + automated regression) |
| Root cause addressed | §5E `VALIDATION_CONTRACT_DEFECT` — confirm-only activate |
| Evidence | `verifyPhase120ManagedActivateGate.mjs` PASS; Phase 117 PASS; `tsc -b` PASS |
| P4 | Still **FAIL** until Admin remaps unique locators under gate + Managed fill evidence |
| Owner live validation | **NOT STARTED** / **NOT AUTHORIZED** by this handoff |
| Next | Architecture review → (only if PASS) Manager/Owner may authorize live validation |

### Scope compliance
- Implemented only approved 120.2-AP DD scope.
- Did **not** edit Shufersal registry mappings or claim P4 PASS.
- Did **not** proceed to Owner live validation.

---

## §5D — P4 diagnostic (2026-09-22)

**Authorized:** diagnostic instrumentation only (`arch-phase120.md` §5D).  
**Not authorized:** readiness/tab-lifecycle **fix**, mapping edits, retry-timing changes, hostname/serviceId branches, legacy generic fallback.

### Owner live run — reload + capture

1. `chrome://extensions` → unpacked `C:\password-vault\extension` → **Reload**.
2. Open extension **service worker** DevTools (keep open).
3. Digital Home → fixture Managed launch (**one** attempt). Do not close Login Entry tab during the attempt unless testing close.
4. Capture and paste to Architecture:
   - All console lines tagged **`[ManagedAutofillDiag]`** (`createdTabId`, `onUpdated`, `onRemoved`, `targets_not_ready`, `lateProbe` at +2s/+5s/+10s)
   - Hub/extension failure payload fields: `fieldId`, `locator`, `detail`, `finalObservedUrl` / `observedUrl`, `tabId` (**no credential values**)
5. **Do not** claim P4 PASS. **Do not** implement a fix until Architecture reviews this package.

### What to expect on `targets_not_ready`
Structured response includes `fieldId`, `locator`, `detail` (`zero_match` \| `multi_match` \| `hidden_target` \| `non_editable` \| `unsafe_target`), `observedUrl`, `tabId`, `finalObservedUrl`, `tabExistsAtFailure`. Late probes are **assess-only** (no fill, no credentials in logs).

---

# §120.2 — Shufersal Managed migration pilot

## Goal
Config-only migration of `shufersal` → validated Managed using **live** field IDs **`username`** + **`password`**.

## Normative live baseline (Architecture S1 PASS — 2026-09-21)

| Field | Live (normative) |
|---|---|
| `id` | `shufersal` |
| `login_fields` | **`username`**, **`password`** ONLY |
| Login Entry | `https://www.shufersal.co.il/online/he/login` |
| `adapter_id` | `""` ≡ **none** — **do not rewrite** |
| Managed map | **`username`** + **`password`** only |
| Forbidden | username→email; `builtinCatalog` change; invent foreign field IDs |

**builtinCatalog seed** may still list `email`/`password` — **seed hygiene out of slice**; do not “fix” seed in 120.2.

---

## S0 — Extension reload

| Item | Required |
|---|---|
| Reload unpacked `C:\password-vault\extension` | Before Analyze / Visual Mapping / Managed launch |
| Same Hub for Admin + Digital Home | Yes |

---

## S1 — PASS (recorded)

| Gate | Result |
|---|---|
| Authenticated live dump | **CAPTURED** (Architecture / Operator 2026-09-21) |
| Schema | **`username`, `password`** |
| Login Entry / primary | **MATCH** |
| `adapter_id=""` ≡ none | **PASS** (no cosmetic rewrite) |
| vs seed `email` | Historical **MISMATCH** — disposed: use **live**; no seed rewrite |
| **S1** | **PASS** against live baseline |

Prior BLOCKED / clipboard-helper failure retained as audit only (superseded).

---

## S3–S7 — Admin Autofill authoring (AUTHORIZED)

### Binding
Map Managed to **`username`** + **`password`** only. Derive locators from **live** Analyze / Visual Mapping / readiness — **do not invent CSS**.

### Developer assist (Hub console)

| Step | Action |
|---|---|
| **Status / P3 probe** | Paste `scripts/operatorAssistS3S7ShufersalHubConsole.js` (`MODE='status'`) |
| **S3 only** | Set `MODE='s3'` in that script → `credential_mode=credential_fields` preserving live `login_fields` |

### Admin UI runbook (Operator executes S4–S7)

| Step | Action | Field IDs |
|---|---|---|
| **S3** | Ensure `credential_fields` (console `MODE=s3` or Admin credential mode UI) | Keep `username`, `password` |
| **S4** | Autofill editor → **Analyze Login Page** (readiness) on Login Entry | — |
| **S5** | Accept HIGH proposals and/or **Visual Mapping** per field | **`username`**, **`password`** only |
| **S6** | **Save** (structural validation only — not yet validated) | — |
| **S7** | Live validate (throwaway/test values per Phase 117 Security) → **explicit** activate `supportState=validated` | version stamp |

### Execution status (this Developer package)

| Step | Status |
|---|---|
| S3 | **ASSIST READY** — Operator applies via Hub console `MODE=s3` or Admin UI |
| S4–S7 | **OPERATOR LIVE** — requires Admin UI + extension; Developer does **not** invent locators |
| S3–S7 complete | **NOT YET EVIDENCED** in this package until Operator returns status dump with `s7Done: true` |

**Honest gate:** Developer cannot complete Analyze/Visual/activate without Operator’s Admin session + Live Login Entry. This package **authorizes and equips** S3–S7; it does **not** claim S7/`validated` without Operator evidence.

---

## P1–P5 capture (honest)

| ID | Signal | Status |
|---|---|---|
| **P1** | Digital Home launch → `HUB_MANAGED_AUTOFILL` (not `POC_GENERIC_FILL`) | **PENDING** — not claimed; needs post-S7 launch log |
| **P2** | Managed fail ≠ silent generic | **PASS (static)** — orchestrator Managed gate (prior verify) |
| **P3** | Redacted profile `supportState=validated`; mappings `username`/`password`; Login Entry bind | **PENDING** — capture via S3–S7 status script after S7 |
| **P4** | Live username+password filled; manual submit | **PENDING** — Owner UAT **NOT AUTHORIZED** |
| **P5** | `adapter_id` none; no shufersal adapter/branch | **PASS (static)** + live `adapter_id=""` baseline |

**Do not claim P1/P3/P4 PASS without evidence.**

### After Operator finishes S7 — P3 capture recipe
1. Paste `operatorAssistS3S7ShufersalHubConsole.js` (`MODE='status'`).
2. Confirm `s7Done: true` and redacted `fieldMappings` for `username` + `password`.
3. Paste JSON to Developer → append to this file as **P3 EVIDENCE**.

### P1 capture recipe (after S7; still not Owner UAT)
1. Extension SW DevTools open.
2. Digital Home → Shufersal Assist/Launch with credentials.
3. Confirm message type **`HUB_MANAGED_AUTOFILL`**.
4. Paste redacted log line → **P1 EVIDENCE** (Architecture before Owner UAT).

---

## Regression / affirmations

| Check | Status |
|---|---|
| Clalit not migrated | Affirmed |
| No username→email | Affirmed (normative) |
| No builtinCatalog change | Affirmed |
| No adapter / orchestrator / generic edits | Affirmed |
| Generic still available for others | Affirmed (static) |
| HTZone / Practice / medium unchanged | Affirmed |

---

## Automated static verify

```text
node scripts/verifyPhase120ShufersalMigration.mjs
→ PASS (static) — seed hygiene preserved (email in builtin); no shufersal runtime branch
```

---

## AC-120.2 checklist (current)

| AC | Result |
|---|---|
| AC-120.2-1 | Catalog `shufersal` retained — **PASS** (live id) |
| AC-120.2-2 | No adapter — **PASS** (`""` ≡ none) |
| AC-120.2-3 | No hostname/serviceId branch — **PASS (static)** |
| AC-120.2-4 | `validated` — **PENDING** (S7 / P3) |
| AC-120.2-5 | Managed path — **PENDING** (P1) |
| AC-120.2-6 | Live fill — **PENDING** (Owner UAT not authorized) |
| AC-120.2-7 | No auto-submit — **PENDING** UAT |
| AC-120.2-8 | No silent generic fallback — **PASS (static P2)** |
| AC-120.2-9 | Non-Shufersal unchanged — **PASS (affirmation)** |
| AC-120.2-10 | Path evidence — **PARTIAL** (P2/P5; P1/P3/P4 pending) |

---

## Package handoff

| Item | Status |
|---|---|
| S1 | **PASS** (live `username`/`password`) |
| Admin S3–S7 | **AUTHORIZED** — Operator execute + Developer assist scripts |
| P1 / P3 / P4 PASS claims | **FORBIDDEN** until evidence |
| Owner UAT | **NOT AUTHORIZED** |
| Next | Operator: S0 Reload → S3 (`MODE=s3` or UI) → S4–S7 Admin Autofill → return status JSON (`s7Done`) + optional P1 log |

Architecture reviews P1–P5 package **before** Owner UAT authorization.
