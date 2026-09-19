# Developer Phase 119

## Phase Identifier
PHASE=119

## Status
STATUS: READY_FOR_ARCHITECT — **`readiness_wait_inputs` LIVE VERIFIED / ACCEPTED**; **AC-119-R-9 = OWNER LIVE PASS** (retest after Reload); prior FAIL = **D1 stale extension** (ACCEPTED)

## Slice authorization obeyed
| Slice | Action |
|---|---|
| **119.1** Capability / Inspection Framework | **ACCEPTED** (Owner) |
| **119.2** Visual Mapping MVP | **ACCEPTED / LIVE VERIFIED** (Owner) |
| **119.3** Investigation | **COMPLETE** (Owner decision A) |
| **`readiness_wait_inputs`** | **LIVE VERIFIED / ACCEPTED** (AC-119-R-1…R-8 automated + **AC-119-R-9 Owner live PASS**) |
| **AC-119-R-9 discrepancy investigation** | **CLOSED** — root cause **D1 stale extension** (ACCEPTED) |
| iframe / shadow / modal / multi-step | **NOT DONE** (not authorized) |
| Autofill Runtime Convergence | NOT STARTED (deferred) |

## Source
- `team-Yuri/arch-phase119.md` — **`readiness_wait_inputs` LIVE VERIFIED / ACCEPTED** (Owner 2026-09-20)
- `team-Yuri/manager-phase119.md` — readiness DD (historical) + discrepancy investigation closed by Owner retest

---

## 119.1 Implementation (ACCEPTED)

| Layer | Change |
|---|---|
| Catalog | `src/assistedMapping/capabilities.ts` |
| Hub / Edge | unsupported capability fail-closed; D-118-14 preserved |
| Verify | `scripts/verifyPhase119CapabilityFramework.mjs` → PASS |

---

## 119.2 Implementation — Visual Mapping MVP

| Layer | Change |
|---|---|
| Extension pick | `extension/generic/visual-target-pick.js` — top-doc click arm; exact-one CSS; no values/cookies/storage; no submit |
| Background | `ADMIN_VISUAL_MAPPING_START` → `openPageAndVisualMapping` (real Login Entry tab, `frameIds: [0]`, origin abort) |
| Hub | `src/assistedMapping/visualMapping.ts` — `startVisualMappingForField` (no LLM, no persist, no credentials) |
| Admin UI | `AutofillProfileEditor` — per-field **מיפוי חזותי**; prefills locator; Admin still **שמור מיפוי** |
| Fixture | `scripts/fixtures/phase119-visual-pick-login.html` |
| Verify | `scripts/verifyPhase119VisualMapping.mjs` |

### Confirmations
- Real-tab model (no Admin Login Entry embed): **YES**
- Admin need not type CSS for happy path (derived `#id` / exact-one): **YES**
- No credential values required/captured: **YES**
- Mapping is editor prefill only until explicit Save: **YES**
- No auto-submit: **YES**
- Origin bind + mismatch abort: **YES**
- Admin-only (AutofillProfileEditor / AdminGate): **YES**
- No iframe / shadow / modal / multi-step / Hapoalim logic: **YES**
- Phase 118 Assisted Mapping Agent unchanged path: **YES**
- Phase 117 Managed runtime unchanged (accepts saved CSS): **YES**

---

## Verification evidence (119.2)

```text
node scripts/verifyPhase119VisualMapping.mjs
→ PASS

node scripts/verifyPhase119CapabilityFramework.mjs
→ PASS

node scripts/verifyPhase118AssistedMapping.mjs
→ PASS

node scripts/verifyPhase117ManagedAutofill.mjs
→ PASS

npx tsc -p tsconfig.app.json --noEmit
→ PASS (exit 0)
```

---

## Slice `readiness_wait_inputs` — Implementation

### Goal obeyed
Admin Analyze / `ADMIN_LOGIN_PAGE_INSPECT` uses **bounded observation/retry** until eligible top-document inputs appear or timeout; early-exit when ≥1 eligible input; timeout → empty structure → **D-118-14**. Not a sole arbitrary sleep.

### Parameters (Manager DD — generic, not Hapoalim-tuned)

| Constant | Value | Justification echo |
|---|---|---|
| `ADMIN_INSPECT_READINESS_MAX_WAIT_MS` | **10000** | Upper bound for typical SPA/client hydration on login shells without unbounded Admin hangs. Generic Assisted Mapping default — **not** measured from any hostname. |
| `ADMIN_INSPECT_READINESS_POLL_MS` | **250** | Observation cadence for quick early-exit without busy-spin. Generic UI-poll convention — **not** service-specific. |
| Early exit | first observation with ≥1 eligible input | Avoids unnecessary full-window wait |
| Residual `initialDelayMs` on Admin inspect | **0** (`MANAGED_AUTOFILL_INITIAL_DELAY_MS`) | Subordinate; readiness poll is normative |

### Files changed
| File | Change |
|---|---|
| `extension/generic/page-structure-inspect.js` | `collectSafePageStructureWithReadiness` — poll/early-exit/timeout; origin check each cycle; value-free |
| `extension/background.js` | Admin inspect calls readiness helper with constants; still `frameIds: [0]` |
| `src/assistedMapping/capabilities.ts` | `ADMIN_INSPECT_READINESS_CAPABILITY_ID` / `ADMIN_INSPECT_READINESS_ENABLED`; Analyze propose mode remains `single_page_top` only |
| `src/assistedMapping/index.ts` | Re-export readiness timing markers |
| `scripts/fixtures/phase119-readiness-present.html` | Immediate eligible inputs |
| `scripts/fixtures/phase119-readiness-delayed.html` | Empty mount; verify inserts mid-window |
| `scripts/fixtures/phase119-readiness-never.html` | Never eligible inputs |
| `scripts/verifyPhase119ReadinessWaitInputs.mjs` | AC-119-R-1…R-8 signals |

### Explicit non-changes
- Phase 117 Managed Autofill fill timing / runner: **unchanged**
- Phase 118 safety filtering / D-118-14: **preserved** (empty → zero provider)
- iframe / Shadow DOM / modal / multi-step: **not implemented**
- Hostname / serviceId / Hapoalim selectors or wait tables: **none**
- Analyze LLM inspect capability remains **`single_page_top`**; readiness is **timing layer only**

### Automated verification

```text
node scripts/verifyPhase119ReadinessWaitInputs.mjs
→ PASS
  - AC-119-R-1 poll/early-exit architecture
  - AC-119-R-2 present → early exit (duration ≪ max wait)
  - AC-119-R-3 delayed appear → captured in SafePageStructure
  - AC-119-R-4 timeout empty → D-118-14 zero provider calls
  - AC-119-R-5 frameIds [0] + origin fail-closed; no iframe/shadow/modal/multi-step
  - AC-119-R-6 no Hapoalim/hostname/serviceId in readiness
  - AC-119-R-7 no values/cookies/submit
  - AC-119-R-8 signals in this script; regression below

node scripts/verifyPhase119CapabilityFramework.mjs
→ PASS

node scripts/verifyPhase119VisualMapping.mjs
→ PASS

node scripts/verifyPhase118AssistedMapping.mjs
→ PASS

node scripts/verifyPhase117ManagedAutofill.mjs
→ PASS

npx tsc -p tsconfig.app.json --noEmit
→ PASS (exit 0)
```

| AC | Result |
|---|---|
| AC-119-R-1 | **PASS** |
| AC-119-R-2 | **PASS** |
| AC-119-R-3 | **PASS** |
| AC-119-R-4 | **PASS** (D-118-14 preserved) |
| AC-119-R-5 | **PASS** |
| AC-119-R-6 | **PASS** |
| AC-119-R-7 | **PASS** (+ 117/118 regression) |
| AC-119-R-8 | **PASS** |
| AC-119-R-9 | **PENDING Owner live** — not claimed |

### Live residual procedure (AC-119-R-9) — Owner executes

**Do not claim Owner PASS from this package.**

1. Reload extension build that includes readiness_wait_inputs.
2. Admin → Bank Hapoalim Login Entry → **Analyze Login Page** (Analyze’s own tab).
3. When Analyze finishes, confirm inspection payload observes rendered controls corresponding to `#userCode` and `#password` (eligible candidates / ids).
4. **PASS residual:** those controls are present in the structure at finish time.
5. **STOP → Architecture:** controls are **visibly rendered** on the Analyze tab before finish, but structure still has zero / missing those inputs — do **not** auto-add another capability.

---

## 119.3 — Investigation (COMPLETE — historical)

**Status:** COMPLETE. Owner decision **(A)** authorized `readiness_wait_inputs`. Evidence F1–F25 retained below for audit.

### OBSERVED FACT — entering 119.3 (prior live + code)

| # | Fact | Source |
|---|---|---|
| F1 | Login Entry opens successfully | Phase 118 live (arch §12) |
| F2 | Login controls visibly present to Operator | Phase 118 live |
| F3 | `single_page_top` inspect → `page.inputs.length === 0` | Phase 118 live Request payload |
| F4 | D-118-14 stops before MappingLlmProvider when inputs empty | `src/assistedMapping/agentService.ts` + live |
| F5 | Inspect inject uses `frameIds: [0]` only | `extension/background.js` `openPageAndInspectLoginStructure` |
| F6 | Inspect post-load delay is `MANAGED_AUTOFILL_INITIAL_DELAY_MS` (= **0**) | same; no empty-input retry loop (pre-readiness) |
| F7 | Collector is light-DOM only: `document.querySelectorAll('input, textarea')` | `extension/generic/page-structure-inspect.js` |
| F8 | Collector does **not** traverse iframes, framesets, or Shadow roots | same |
| F9 | Collector skips `hidden` / `submit` / `button` / `image` types | same |
| F10 | Collector **drops** nodes that yield **zero** locator candidates | same |
| F11 | SafePageStructure payload does **not** report iframe count / shadow roots | same |
| F12 | Visual Mapping (119.2) top-document only (`frameIds: [0]`) | `visual-target-pick.js` + background |
| F13 | Visual Mapping does not pierce iframe/shadow | same |
| F14 | Phase 117 Managed fill also top-frame (`frameIds: [0]`) + CSS exact-one | Phase 117 |
| F15 | Executable inspect capability today = `single_page_top` only; readiness is timing layer | `capabilities.ts` |
| F15b | Analyze opens Login Entry via `chrome.tabs.create`, then inspects after `complete` + delay 0 | `openPageAndInspectLoginStructure` |

### OBSERVED FACT — Visual Mapping (2026-09-20)

| # | Fact | Source |
|---|---|---|
| F16 | Visual Mapping successfully selected both visible login controls | Operator live |
| F17 | Hub locators: `user_code` → `#userCode`; `password` → `#password` | Operator live |
| F18 | Those controls were top-doc eligible `input`/`textarea` **at click time** | F12–F13 + F16–F17 |

### OBSERVED FACT — P1 / P2 (2026-09-20)

| # | Fact | Source |
|---|---|---|
| F19 | Analyze again produced zero-input behavior | Operator live |
| F20 | Analyze opens its **own** Login Entry tab | Operator live |
| F21 | P1 did not prove inspect-after-ready on the inspected tab | F19–F20 + F15b |
| F22 | Analyze opened a new Login Entry tab | Operator live |
| F23 | Analyze **completed before** the visible Hapoalim login controls appeared on **that** tab | Operator live |
| F24 | `#userCode` / `#password` became visible **only after** Analyze had already finished | Operator live |
| F25 | At the inspection moment on the Analyze tab, those controls were **not yet available** | F22–F24 |

### Investigation conclusion (accepted by Owner A)
**Proven:** readiness/timing on Analyze’s tab explained zero-input at inspect. **Not proven:** absence of further structural boundaries after readiness. Owner authorized `readiness_wait_inputs` only.

---

## AC-119-R-9 discrepancy investigation (diagnostic ONLY — 2026-09-20)

**Authorization:** Architecture + Manager ACTIVE investigation. **No production code changes** in this section. **No** iframe/shadow/modal/multi-step. **No** Hapoalim-specific tuning. **No fix shipped.**

### Owner OBSERVED FACT (binding — from Architecture)
| Fact | Status |
|---|---|
| Analyze opened Login Entry tab | OBSERVED |
| Analyze completed **before** visible login fields appeared | OBSERVED |
| Hub showed no-high-confidence-mappings | OBSERVED |
| Operator estimate ≈ **~0.5s** to Analyze completion; controls appeared shortly after | OBSERVED (estimate) |
| Expected if starting from zero eligible inputs: observe/retry up to **~10s** unless early-exit | NORMATIVE (DD) |

Symptom **does not match** a full 10s empty-input readiness wait.

---

### E1 — Live extension build includes readiness?

#### E1a — On-disk unpacked extension path (Developer-verified THIS SESSION)

| Check | Result |
|---|---|
| `extension/background.js` contains `ADMIN_INSPECT_READINESS_MAX_WAIT_MS = 10000` | **YES** (line ~666) |
| `extension/background.js` Admin inspect calls `collectSafePageStructureWithReadiness` | **YES** (args include max wait + poll 250) |
| `extension/generic/page-structure-inspect.js` defines `collectSafePageStructureWithReadiness` | **YES** |
| File mtimes (local) | `background.js` / `page-structure-inspect.js` **2026-09-20 ~01:30**; `manifest.json` older (**2026-09-16**) |
| `extension/manifest.json` `version` | Still **`1.4.25`** — **not bumped** when readiness landed → version string alone **cannot** prove Chrome reloaded |

**Command used (PowerShell):**
```text
Select-String -Path extension\background.js,extension\generic\page-structure-inspect.js -Pattern "ADMIN_INSPECT_READINESS_MAX_WAIT_MS|collectSafePageStructureWithReadiness"
Get-Item extension\background.js,extension\generic\page-structure-inspect.js,extension\manifest.json
```

#### E1b — Live Chrome process reload proof

| Check | Result |
|---|---|
| Operator chrome://extensions → Reload unpacked (this session) | **NOT CAPTURED** by Developer |
| Service-worker console showing readiness symbols after reload | **NOT CAPTURED** |
| Analyze after explicit reload | **NOT CAPTURED** |

**OBSERVED FACT (repo):** `onceExternalSendResponse` already logs full payload:
`console.log('[External] sendResponse:', label, payload)` — label for this path is `admin-login-page-inspect`. After a true reload, that log **must** include `readiness` if the new build ran.

**E1 verdict:** On-disk source **HAS** readiness (**E1a PASS**). Live loaded extension **NOT proven** this session (**E1b OPEN**). Stale-extension (**D1**) remains a leading hypothesis until E1b+E2.

**Operator capture for E1b (no code change):**
1. `chrome://extensions` → unpacked path = this repo `extension/` → **Reload**.
2. Open service worker DevTools → Confirm Sources or search shows `collectSafePageStructureWithReadiness` / `ADMIN_INSPECT_READINESS_MAX_WAIT_MS = 10000`.
3. Paste proof note to Architect/Manager (screenshot or SW console line).

---

### E2 — One live Analyze inspect response

| Field | Value this session |
|---|---|
| `ok` | **NOT CAPTURED** |
| `page.inputs.length` | **NOT CAPTURED** |
| `page.inputs[].idAttr` (no values) | **NOT CAPTURED** |
| `readiness.waitedMs` | **NOT CAPTURED** |
| `readiness.earlyExit` | **NOT CAPTURED** |
| `readiness.timedOut` | **NOT CAPTURED** |

#### Capture path (existing — no production change)

| Surface | What it shows |
|---|---|
| **Extension service worker console** | `[External] sendResponse: admin-login-page-inspect { ok, page, readiness? }` — **authoritative for E2** |
| Hub DEV `console.info('[assisted-mapping]', …)` | Proposal **audit only** (`requestId`, `status`, counts) — **does NOT log `readiness` or `idAttr`s** |

**OBSERVED FACT:** Hub `analyzeLoginPageForMapping` types/uses `{ ok, reason, page }` only and never logs `inspect.readiness`. Therefore **Hub console alone cannot decide D1 vs D2**. Absence of `readiness` in Hub logs ≠ proof of stale extension.

**Operator steps for E2:**
1. Complete E1b Reload.
2. Open extension **service worker** DevTools (keep open).
3. Admin → Analyze Login Page on residual Login Entry.
4. Copy the `[External] sendResponse: admin-login-page-inspect` object fields listed above (**idAttr only — never values**).
5. Optionally note Hub proposal `status` / whether warning includes `no_observed_inputs` (helps empty vs non-empty distinguish).

**E2 verdict:** **MISSING** — Manager gate: package cannot finalize class without E2.

---

### E3 — Classification (D1 vs D2 vs other)

Architecture rules (binding):
1. `readiness` **absent** on live inspect response → strong **D1** (or stripping).
2. `readiness.earlyExit===true` && `waitedMs≪10000` && ids **not** `userCode`/`password` → **D2**.
3. `readiness.timedOut===true` && `waitedMs≈10000` vs Operator ~0.5s → reconcile UX vs inspect duration.
4. Do **not** finalize without E1+E2.

| Class | Fit to Owner ~0.5s + no-high-confidence | Status |
|---|---|---|
| **D1** Stale extension / not loaded | Strong if pre-readiness single-shot + delay 0 → empty → D-118-14 in ≪10s | **LEADING CANDIDATE** until E1b+E2; **not confirmed** |
| **D2** Premature early-exit | Strong if ≥1 eligible (possibly non-visible) input before `#userCode`/`#password`; visibility **not** required for inclusion (repo FACT) | **EQUAL CANDIDATE** until E2; **not confirmed** |
| D3 Helper not reached | Weaker — usually Analyze **failed** UX, not no-high-confidence | Unlikely without E2 contradicting |
| D4 Tab lifecycle abort | Weaker — usually fail-closed reason | Unlikely without E2 |
| D5 Other | Only if D1–D4 ruled out | N/A |

**Additional repo FACT relevant to D2:** `collectSafePageStructure` records `visible` but **does not require visibility** for inclusion / readiness early-exit.

**Additional repo FACT relevant to “stripping”:** Extension `finishSession` returns full result including `readiness`; Hub does not strip it from the message — it simply **ignores** it for propose + DEV audit. SW log remains the source of truth.

**E3 verdict:** **INCONCLUSIVE — not finalized.** Need Operator paste of E2 (and E1b). Do **not** authorize a production fix on guesswork between D1 and D2.

---

### E4 — Why automated R-1…R-8 PASS vs live R-9 FAIL

| Automated verify | Live Owner Analyze |
|---|---|
| Readiness helper on **synthetic fixtures** (linkedom) | Real bank SPA + Chrome extension runtime |
| Asserts **source wiring** in repo `background.js` / inspect script | Requires **loaded/reloaded** unpacked build matching that source |
| Does **not** drive Hub → `chrome.tabs` → Login Entry SPA | Full Admin Analyze path |
| Never proved Operator’s Chrome process executed the 10s window | Owner saw ~0.5s completion before visible fields |

Automated PASS therefore proves **repo behavior on fixtures + static wiring**, **not** that the Operator’s running extension executed readiness on Hapoalim.

---

### E5 — Fix approach recommendation ONLY (DO NOT IMPLEMENT)

**Blocked until Architecture accepts root cause from E1b+E2.** Conditional approaches:

| If accepted root cause | Recommended approach (text only) | Explicitly not |
|---|---|---|
| **D1** | Operator reload unpacked extension from current `extension/`; optionally bump `manifest.json` version so reload is auditable; re-run AC-119-R-9 | No logic change; no structural caps |
| **D2** | Owner-authorize a **generic** early-exit eligibility tightening DD (e.g. require `visible && editable` for readiness count, or require ≥N eligible, or continue polling until timeout unless login-schema-plausible candidates) — still top-doc, no hostname branches | No Hapoalim selectors (`#userCode`/`#password` as product branches); no iframe/shadow/modal/multi-step |
| **D3/D4/D5** | Re-open Architecture with E2 evidence | Do not invent capability |

**Developer STOP:** No production fix under this investigation authorization.

---

### Investigation package status

| Item | Status |
|---|---|
| E1a on-disk readiness markers | **PASS** |
| E1b live Chrome reload proof | **OPEN** (Operator) |
| E2 live inspect response | **OPEN** (Operator — use SW `[External] sendResponse`) |
| E3 D1 vs D2 final class | **INCONCLUSIVE** pending E1b+E2 |
| E4 automated vs live explanation | **COMPLETE** |
| E5 fix approach | **Conditional only** — not implemented |
| Production code changed this investigation | **NONE** |

**Handoff:** Architect/Manager — reject final root-cause acceptance until Operator supplies E1b + E2. This package is diagnostic progress, not a fix authorization.

---

## Owner live retest — AC-119-R-9 PASS / readiness LIVE VERIFIED (2026-09-20)

**Scope of this record:** Owner live retest evidence only. **No code changes.** **No** structural capabilities added.

### Prior failure (historical)
| Item | Record |
|---|---|
| First live attempt | AC-119-R-9 **FAIL** (~0.5s Analyze complete before controls; no-high-confidence) |
| Accepted root cause | **D1 — stale loaded Chrome extension** (pre-readiness build still executing) |
| Class | Implementation/integration execution discrepancy — **not** a new structural capability gap |
| D2 eligibility tightening | **Not required** by retest evidence |
| iframe / shadow / modal / multi-step | **Not required** on current evidence |

### Owner OBSERVED FACT — live retest (after Reload)

| Fact | Status |
|---|---|
| Explicit Chrome unpacked-extension **Reload** performed | OBSERVED |
| Analyze did **not** complete immediately | OBSERVED |
| Analyze **waited** while Login Entry page rendered (successful wait / readiness behavior) | OBSERVED |
| Login controls became available | OBSERVED |
| Analyze successfully produced/populated **Hapoalim** field mappings | OBSERVED |
| Approved readiness behavior exhibited with **current** build loaded | OBSERVED |

### Acceptance mark

| Gate | Result |
|---|---|
| AC-119-R-1…R-8 (automated) | **PASS** (prior package) |
| **AC-119-R-9** (Owner live residual) | **PASS** |
| `readiness_wait_inputs` | **LIVE VERIFIED / ACCEPTED** |
| Discrepancy investigation | **CLOSED** (D1 ACCEPTED) |

### Operator procedure note
After readiness (or any extension) code changes: **Reload** unpacked extension before live Analyze residual tests.

### Explicit non-claims
- No production code change in this evidence append.
- No iframe / Shadow DOM / modal / multi-step authorization or implementation.
- No Hapoalim-specific product logic.
- Phase 119 formal CLOSE remains Owner decision (Architecture snapshot).
