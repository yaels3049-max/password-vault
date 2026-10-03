# Architecture Phase 121

## Phase Identifier
PHASE=121

## Status
STATUS: **OWNER ACCEPTED — ARCHITECTURE FROZEN** (2026-09-24)

CREATED: 2026-09-23 — Additive special login-flow patterns around Phase 120 frozen Managed Autofill baseline.

**Implementation (general):** **NOT AUTHORIZED** beyond 121.1 corrections D-121-22, D-121-23, D-121-24.  
**121.0 DD:** **Architecture PASS** (2026-09-24) — `manager-phase121.md` Slice 121.0.  
**121.0-impl:** **Architecture ACCEPTED / CLOSED** (2026-09-24).  
**121.1 DD:** **Architecture PASS** (2026-09-24) — `manager-phase121.md` Slice 121.1.  
**121.1-impl:** **REOPENED** (Owner 2026-09-27) — §5.1 / D-121-22 auto-Analyze of revealed surface; D-121-23 approval-panel text; **D-121-24** Managed Autofill grid guidance when pattern is SPECIAL (AUTHORIZED 2026-09-27). §4.7 + §4.6/D-121-21 PASS retained.  
**121.2 (FLOATING_SCREEN runtime, shared orchestrator):** **AUTHORIZED** (Owner 2026-09-28) — Manager DD first (§8, §8.3, §4.10 runtime, D-121-38); Developer only after Architecture PASS on the DD.  
**121.3:** **OWNER APPROVED / AUTHORIZED (2026-09-29)** — MULTI_STEP execution (see «121.3 — MULTI_STEP execution»). **121.4+:** **NOT AUTHORIZED.**

## Title
Phase 121 — Special Login Flow Patterns (Admin Authoring + Shared Runtime Orchestration)

## Phase Goal

Extend the **accepted Phase 120 Managed Autofill contract** so Admin can explicitly configure, and Admin Test + Digital Home can deterministically execute, **special login patterns** that violate the Phase 120 assumption that all credential fields are immediately available on one normal login surface — **without changing** STANDARD authoring or fill behavior.

Phase 121 covers:

1. **Admin authoring/configuration** for special flows  
2. **Shared runtime execution** for **Admin Test** and **Digital Home** (one engine, one persisted plan)

---

## 1. Phase 120 frozen baseline (NON-NEGOTIABLE)

Phase 120 is **FORMALLY CLOSED / ARCHITECTURE ACCEPTED / FROZEN PRODUCTION BASELINE**.

### 1.1 Accepted STANDARD contract (must remain unchanged)

| Capability | Frozen rule |
|---|---|
| Admin field authoring | Analyze Login Page, Visual Mapping, manual/admin mechanisms as accepted |
| Semantic identity vs DOM | Login-field semantic id separate from technical DOM name |
| Locators | Approved field locators are deterministic (css exact-one semantics as accepted) |
| Visual verification | Applies to the locator that was actually verified |
| Managed Runtime | Executes approved configuration deterministically; fail-closed |
| No unsafe targeting | No first-match; no silent runtime fallback; no automatic final submit/login |
| Analyze confidence | Existing STANDARD field-analysis confidence behavior/thresholds unchanged |
| Visual Mapping (STANDARD) | Behavior unchanged |
| Field fill (STANDARD) | Behavior unchanged |
| Persisted mapping contract | Unchanged for STANDARD services |

### 1.2 Protection mandate

Phase 121 **MUST NOT** refactor, rewrite, simplify, generalize, or alter these behaviors merely to support new capabilities.

For **STANDARD** login flows:

- Analyze Login Page → **unchanged** Phase 120 path  
- AI field-detection / confidence / accept-reject → **unchanged**  
- Visual Mapping → **unchanged**  
- Persisted field mapping contract → **unchanged**  
- Runtime field-fill → **unchanged** Phase 120 fill authority  

Any design that requires rewriting the STANDARD path is **rejected**.

Prefer **additive orchestration around** Phase 120.

### 1.3 Dynamic multi-tenant model + authority separation

| Rule | Binding |
|---|---|
| Product model | Multi-tenant, fully dynamic — may start with **zero** configured services; Tenant Admin creates/configures per customer need |
| No site identity | No old/legacy/known-Generic site categories; **no** global supported-site catalog; fixtures ≠ architecture |
| Service availability | **≠** special-flow plan authority (see §7.3) |
| Terminology | Prefer **DRAFT / ACTIVE / ACTIVATE / INACTIVE / NOT READY** — activation = activating a **customer’s configuration**, not deploying software or “publishing a site to Production” |
| STANDARD | Phase 120 configuration + runtime — **does not** require `loginFlowPlan.active`; **does not** use Phase 121 orchestrator |
| SPECIAL | Requires complete ACTIVE `loginFlowPlan` + Phase 121 orchestrator; no Generic fallback |
| Admin Test | Product **validation** feature (not a TEST deployment environment) — may run DRAFT with the same runtime behavior DH will use after ACTIVATE |
| Migration | Must **not** silently alter already-ACTIVE customer configuration without ACTIVATE |

### 1.4 Final Architect review question

> Can Phase 121 be implemented while an ACTIVE service configured for `STANDARD` login follows the same Phase 120 authoring and runtime path accepted at Phase 120 closure — without requiring `loginFlowPlan`?

**Architectural target answer: YES.**

Mechanism: Service availability uses the generic service lifecycle. STANDARD uses frozen Phase 120. SPECIAL uses ACTIVE `loginFlowPlan` + orchestrator only. No site-identity branching.

If implementation evidence ever shows NO → **STOP**; do not proceed.

### 1.5 NON-NEGOTIABLE — Configure dynamically, execute deterministically

**Product-wide invariant (Phase 121 and beyond):**

The product is dynamic at **CONFIGURATION TIME**. It is **NOT** dynamic at **LOGIN EXECUTION TIME**.

| Meaning of “dynamic” | Binding |
|---|---|
| **Allowed** | Any tenant/customer can configure any service/site the product has never seen before, **without software changes** |
| **Forbidden** | Runtime decides how to log in again on every Digital Home execution |

There is **one ACTIVE login contract** per configured service. Once that service is ACTIVE, login behavior is already **explicitly defined, approved, and persisted**. Digital Home **executes the stored contract** — it does **not** re-decide how that site should work.

**Target product contract:**

```text
CONFIGURE ONCE → TEST → ACTIVATE → EXECUTE THE SAVED CONTRACT REPEATEDLY
```

**Not:**

```text
OPEN SITE → REDISCOVER HOW TO LOGIN EACH TIME
```

#### STANDARD (ACTIVE)

- Uses the approved Phase 120 contract  
- Approved entry URL / login schema / deterministic mappings are already configured  
- Runtime executes Phase 120 **deterministically**  
- Runtime does **not** re-analyze the page or ask AI to choose targets  

#### SPECIAL (ACTIVE)

- ACTIVE `loginFlowPlan` contains the approved ordered flow  
- Opener / transitions / readiness / field mappings are already persisted  
- Runtime executes that plan **deterministically**  

#### Normal Digital Home runtime MUST NOT

- Infer the login pattern  
- Call AI to analyze the login flow  
- Rediscover field mappings  
- Choose between alternative login strategies  
- Discover a different transition button  
- Repair the configuration dynamically  
- Reinterpret the site because its DOM changed  

#### Contract mismatch

If the saved contract no longer matches the site:

```text
FAIL CLOSED
→ Admin edits DRAFT
→ Analyze / Visual Mapping
→ Admin Test
→ ACTIVATE updated configuration
```

#### Generic clarification (compat only)

Historical/compatibility Generic behavior may remain where required by existing Phase 120 compatibility. It **MUST NOT** define the normative onboarding model for newly configured customer services.

---

## 2. Scope

### 2.1 In scope

| Area | Scope |
|---|---|
| Config | New independent Admin property `loginFlowPattern` («אופי הכניסה») |
| Patterns | `STANDARD`, `FLOATING_SCREEN`, `MULTI_STEP`, `FLOATING_SCREEN_MULTI_STEP` |
| Authoring | Same buttons (Analyze Login Page, Visual Mapping); internal routing by pattern |
| AI | Authoring-only proposals for declared pattern; Admin approval required |
| Runtime | Shared Login Flow Orchestrator; Admin Test ≡ Digital Home |
| Fill | Reuse Phase 120 fill engine exclusively for credential writes |
| Field shape | Split logical credential → N ordered targets (generic) |
| Compatibility | Field-compatibility **investigation** only when a fixture proves a generic gap (see §10 / 121.5) — `type=tel` alone is **not** presumed to need enablement |
| Safety | Fail-closed; no final Login auto-click; no runtime AI |

### 2.2 Explicit non-scope / deferred

| Deferred | Rule |
|---|---|
| Login Variant branching (e.g. password vs phone on same page) | Future phase — no heuristic partial solution |
| External IdP login (Google/Facebook as provider) | Not part of `loginFlowPattern` |
| Generic iframe architecture | Only if a Phase 121 fixture proves impossible without it; do not pre-build |
| OTP / SMS / authenticator automation | Excluded — user-controlled |
| Final Login / Sign-In auto-click | Excluded |
| Runtime AI | Excluded |
| Automatic repair when sites change | Future |
| Bank Leumi investigation | **KNOWN RELIABILITY LIMITATION / PAUSED** — do not reopen; do not alter shared fill for Leumi |
| Government Personal Area special runtime | Configuration/onboarding evidence only — not a Phase 121 site feature |
| Calling MULTI_STEP “two-factor authentication” | Forbidden naming |

Example services (PAGI, Mizrahi, CAL, Gmail, Dropbox, Maccabi Sheli, Amex, CityCar) are **validation fixtures only** — **no** site-specific runtime branches.

---

## 3. Architectural principles

| ID | Principle |
|---|---|
| D-121-1 | Phase 120 STANDARD path is frozen; Phase 121 is additive orchestration |
| D-121-2 | Admin explicitly selects `loginFlowPattern`; AI/runtime never infer pattern |
| D-121-3 | AI proposes; Admin **ACTIVATEs** atomic ACTIVE login contract (`loginContractActivation` + plan/Phase 120 as applicable); Admin Test may run immutable **DRAFT snapshot** (C8) when runtime exists |
| D-121-4 | One shared Login Flow Orchestrator for Admin Test and Digital Home **special-flow** execution (same resolution/fill/fail-closed; plan *context* may differ per C8) |
| D-121-5 | Orchestrator sequences SPECIAL only; Phase 120 Ext fill semantics remain field-fill authority (see §8.2 evidence) |
| D-121-6 | Every runtime **and authoring-continuation** click requires prior explicit Admin approval of that action |
| D-121-7 | Final authentication action is never automated |
| D-121-8 | Configuration over code; no hostname/serviceId runtime branches |
| D-121-9 | Fail closed on ambiguity/missing/timeout; no silent substitution/fallback |
| D-121-10 | **Service availability ≠ ACTIVE login contract ≠ special-flow plan** — `service_status` / `loginContractActivation` / `loginFlowPlan` are distinct authorities |
| D-121-11 | Do not overload existing credential-store / login-entry URL fields |
| D-121-12 | Split-field is the separate field-shape capability (121.6). `type=tel` is **not** presumed to need a Phase 121 compatibility extension (Phase 120 §29) |
| D-121-13 | Special-flow SoT = `metadata.loginFlowPlan` only; never dual-write step mappings into `autofillProfile.fieldMappings` |
| D-121-14 | Special-flow runtime: **no** `POC_GENERIC_FILL` / Generic discovery fallback |
| D-121-15 | Flow pattern is **configuration**, not service/site identity — no runtime branches on serviceId/hostname/fixture names |
| D-121-16 | `STANDARD` = Phase 120 standard login-flow contract (dynamic config) — **not** “legacy site”; Phase 121 **not** mandatory for STANDARD |
| D-121-17 | Admin Test = product validation feature — **not** the TEST deployment environment |
| D-121-18 | **Configure dynamically, execute deterministically** — one ACTIVE login contract; DH executes saved contract only (§1.5) |
| D-121-20 | SPECIAL authoring initial surface + expected origin resolve from configured login-entry mode (HOME→Home URL; DEDICATED→Login Entry URL) — §4.7; no site identity |
| D-121-21 | SPECIAL authoring Analyze/Visual open or reuse tab at resolved §4.7 authoring URL/origin — not Hub active tab; fail-closed origin; no Login Entry reopen after SPECIAL progression — §4.6 |
| D-121-22 | After a **successful approved** authoring continuation click, authoring automatically runs SPECIAL current-surface Analyze on the revealed surface (same tab, no reopen). No further clicks; unapproved candidates never clicked; Visual never auto-invoked; results remain draft proposals (manual Save). Admin-facing success/failure copy must be plain language — §5.1 |
| D-121-23 | Admin messages referencing a button quote its exact label; approval-panel labels renamed to plain Hebrew (§5.1 table). Text-only — §5.1 |
| D-121-25 | SPECIAL editor Visual Mapping (field + opener/transition): per-control in-progress indicator; clear stale success/error on start; bounded timeout + explicit «ביטול» so the editor never locks. Does **not** add iframe support — §4.9 |
| D-121-26 | Manual Analyze shows top-ranked proposal even if already in draft; skip-already-in-draft only for `after_continue`; proposals enter the draft only on «זה הכפתור הנכון»; «דחה» removes from draft — §5.2 |
| D-121-27 | SPECIAL authoring uses one deterministic session tab (Ext returns `authoringTabId`, Hub resends as `tabId`); fallback = most recently accessed same-origin tab; tab activated + window focused before continuation click and Visual arm — §4.6.1 |
| D-121-28 | Generic depth-1 iframe credential surface for SPECIAL (fields + actions), Admin-approved HTTPS frame origin, true-surface readiness, no location assumption, genericity proof on iframe + top-document fixtures, extensible action kinds (`final_submit` reserved, not authorized) — §4.10. Delivery via Manager DD «121.1-IF» |
| D-121-34 | **OWNER APPROVED / AUTHORIZED 2026-09-27** — Test-then-choose (test press = consent to click; success = chosen; failure = cleared; «זה הכפתור הנכון» removed) + tested button never replaced; follow-up proposals only from the revealed surface, pattern-relevant kinds, separate panel — §4.15 |
| D-121-33 | **OWNER APPROVED / AUTHORIZED 2026-09-27** — Bug: non-contract saves re-send login-contract keys → merge rejects every save after a SPECIAL draft exists. Non-contract writers strip contract keys (shared helper); draft save sends draft only; merge guard unchanged — §4.14 |
| D-121-32 | **OWNER APPROVED / AUTHORIZED 2026-09-27** — Button-approval panel: one approval sets both flags, visible feedback, plain labels («זה לא הכפתור», «בדוק שהכפתור פותח את המסך»), «אשר לשימוש בהפעלה» removed — §4.13 |
| D-121-31 | **OWNER APPROVED / AUTHORIZED 2026-09-27** — SPECIAL editor top buttons: Analyze busy indicator, plain-Hebrew labels, all three always shown; manual opener / transition pick enabled only for the patterns they serve, recomputed live on pattern change — §4.12 |
| D-121-30 | **OWNER APPROVED / AUTHORIZED 2026-09-27** — SPECIAL editor action bar: plain-Hebrew labels + explanation line; ACTIVATE SPECIAL with confirmation, disabled while Snapshot incomplete; ACTIVATE STANDARD removed — SPECIAL→STANDARD happens via the regular grid activation (with confirmation) — §4.11 |
| D-121-29 | **OWNER APPROVED / AUTHORIZED 2026-09-27** — Replace `chrome.runtime.getFrameId` (not implemented in Chrome; Firefox-only) with a generic **postMessage nonce handshake** for iframe element ↔ frameId correlation — §4.10.1. No manifest / permission change, no `webNavigation`, no Chrome-version requirement |
| D-121-24 | When the selected authoring pattern is SPECIAL, the «מילוי אוטומטי מנוהל» grid shows plain-Hebrew guidance that field mapping is done in «אופי הכניסה», and its Login-Entry Analyze / Visual Mapping buttons are disabled. UI guidance only — no change to STANDARD mapping / persist / ACTIVATE logic; STANDARD pattern ⇒ grid unchanged — §4.8 |
---

## 4. Admin UX / configuration contract

### 4.1 New property (independent)

| | |
|---|---|
| UI label | **אופי הכניסה** |
| Architecture name | Authoring: DRAFT pattern selection; **ACTIVE SPECIAL:** `loginFlowPlan.active.pattern`; **ACTIVE STANDARD:** Phase 120 contract (no `loginFlowPlan.active` required) |
| Values | `STANDARD` \| `FLOATING_SCREEN` \| `MULTI_STEP` \| `FLOATING_SCREEN_MULTI_STEP` |
| Hebrew | רגיל \| מסך צף \| כניסה רב־שלבית \| מסך צף + כניסה רב־שלבית |
| Default / Digital Home | Service must be **ACTIVE** (§7.3); then STANDARD→Phase 120 / SPECIAL→ACTIVE plan |
| Selector | Admin explicit — binds to **DRAFT** until ACTIVATE; **not** AI; **not** immediate DH change |

**Namespace note (CALL OUT):** Phase 112 Login Intelligence historically mentioned registry metadata `loginFlowType` as detection-oriented. Phase 121 **`loginFlowPattern` is a different, Admin-owned authoring/runtime contract**. Do **not** overload or auto-sync from Phase 112 detection. Consumption of LI metadata for display hints is optional and non-authoritative.

### 4.2 Existing config preserved

Do **not** redefine:

- whether credentials are stored for the service  
- existing login-entry / URL / home-vs-login entry behavior  

### 4.3 Existing authoring buttons preserved

| Button | Behavior |
|---|---|
| Analyze Login Page | Same control; **internal workflow** depends on `loginFlowPattern` |
| Visual Mapping | Same control; additive targets for special flows only |

**Forbidden:** separate buttons “Analyze Floating Screen”, “Map Multi-Step”, etc.

### 4.4 Authoring routing

| `loginFlowPattern` | Analyze / Visual path |
|---|---|
| `STANDARD` / absent | **Existing Phase 120 path UNCHANGED** — no Phase 121 orchestration |
| `FLOATING_SCREEN` | Phase 121 authoring orchestration (opener + readiness + fields) |
| `MULTI_STEP` | Phase 121 authoring orchestration (ordered steps + transitions) |
| `FLOATING_SCREEN_MULTI_STEP` | Composition of the same concepts |

### 4.5 Explicit Admin approval of actions

Admin MUST see and approve every runtime-clickable action, distinguished from credential fields:

```text
Step 1
  Field: Email | locator | detected/approved
  Transition action: "Next" | locator | detected/approved

Step 2
  Field: Password | locator | detected/approved
```

No runtime click from unapproved dynamically discovered buttons. Missing/ambiguous transition → authoring cannot activate / runtime FAIL CLOSED.

### 4.6 SPECIAL authoring — current-surface reuse of Phase 120 (clarification)

Applies to `FLOATING_SCREEN` and later `MULTI_STEP` / `FLOATING_SCREEN_MULTI_STEP` authoring.

**Do NOT interpret** “reuse Phase 120 Analyze Login Page / Visual Mapping” as calling the **complete existing STANDARD authoring entry paths** unchanged.

Phase 120 evidence: STANDARD Analyze owns navigation/opening of Login Entry before inspection; STANDARD Visual Mapping (`ADMIN_VISUAL_MAPPING_START` / `openPageAndVisualMapping`) also owns page opening. After SPECIAL progression (`entry → approved opener/transition → click → readiness → CURRENT SPECIAL SURFACE`), reopening Login Entry would **destroy** authoring state.

#### Phase 121 owns (SPECIAL authoring orchestration)

- Opening/reusing the authoring tab  
- Approved opener/transition execution  
- Readiness  
- Progression between special-flow surfaces  

#### Once the required special-flow surface is already open

Phase 121 **MUST** reuse existing Phase 120 **credential-field authoring semantics on that CURRENT / ALREADY-OPEN surface**, including:

- Phase 120 page observation / field-discovery semantics  
- AI semantic mapping contract  
- HIGH / MEDIUM confidence behavior  
- Managed eligibility / safety checks  
- Locator determinism rules  
- Admin review authority  
- Phase 120 Visual Mapping target-selection / verification / provenance semantics  

Phase 121 **MUST NOT** introduce: a second credential-field discovery engine; new field confidence thresholds; weaker locator rules; a SPECIAL-only fill-field interpretation.

SPECIAL authoring **MUST** have an **additive existing-tab / current-surface** authoring orchestration entry. It **MUST NOT** call the complete STANDARD Analyze or Visual entry path if that path would reopen Login Entry or replace the currently revealed SPECIAL surface.

**STANDARD Analyze / Visual behavior remains completely unchanged.**

#### Opener / transition detection terminology

When the same «Analyze Login Page» UI control proposes a floating opener or intermediate transition, that is **Phase 121 SPECIAL authoring routing** under the existing button. Do **not** state or imply that the frozen Phase 120 credential-field Analyze engine already understands floating openers or transition buttons.

```text
configured entry URL
→ SPECIAL Analyze routing proposes opener/transition (Phase 121 — not Phase 120 field-Analyze)
→ if needed, Admin may choose Visual Mapping to identify the opener/transition
→ Admin explicitly approves
→ authoring clicks the approved action
→ wait for readiness / next SPECIAL surface
```

#### Visual Mapping (revealed SPECIAL surface)

Visual Mapping remains an **explicit Admin choice**. It is **NEVER** an automatic fallback.

```text
Admin chooses Visual Mapping
→ Phase 121 keeps the current special-flow tab/surface
→ reuse Phase 120 Visual target-picking, eligibility, locator determinism,
  verification, and provenance semantics on that current surface
→ Do NOT reopen Login Entry merely to start Visual Mapping
```

#### Persistence (SPECIAL)

Credential-field discovery may reuse Phase 120 authoring semantics, but SPECIAL mappings **MUST** be persisted **only** into the SPECIAL DRAFT plan:

```text
metadata.loginFlowPlan.draft → steps[*].fieldMappings
```

They **MUST NOT** be dual-written into `metadata.autofillProfile.fieldMappings`.  
`autofillProfile.fieldMappings` remains **STANDARD Phase 120 SoT only**.

#### Runtime — Digital Home / Admin Test (SPECIAL)

| Surface | Binding |
|---|---|
| **Digital Home** | ACTIVE `loginFlowPlan` only; saved opener/transitions/readiness/mappings; **no** Analyze; **no** Visual Mapping; **no** rediscovery; **no** runtime AI |
| **Admin Test** | Explicitly selected ACTIVE plan **or** immutable DRAFT snapshot; same orchestrator/runtime behavior; **no** Analyze during execution; **no** Visual Mapping during execution; **no** ACTIVATE side effect; **no** ACTIVE mutation |

### 4.7 SPECIAL authoring — initial surface from configured login-entry mode (Owner live validation)

**Issue class:** GENERIC — not fixture/site identity. Owner validation fixture (e.g. Mizrahi-Tefahot) demonstrates **HOME ENTRY + FLOATING_SCREEN** only.

SPECIAL authoring must **not** assume a dedicated Login Entry URL always exists. Initial authoring surface / expected-origin source MUST resolve from the service’s **existing configured login-entry mode**:

| Configured mode | Authoring surface URL (binding) |
|---|---|
| **HOME ENTRY** (`primary_page` / same-as-website) | Configured **Home URL** (`primary_url`) |
| **DEDICATED LOGIN ENTRY** (`direct_url`) | Configured **Login Entry URL** (`login_url`) |

Reuse the repository’s existing generic login-entry resolution contract (`ExplicitLoginEntryType` / `primary_page` vs `direct_url` — e.g. `src/catalog/explicitLoginEntry.ts`). **Do not** invent hostname / serviceId / fixture-name / site-specific branches.

#### FLOATING_SCREEN authoring (generic)

```text
resolve configured entry (HOME → Home URL; DEDICATED → Login Entry URL)
→ Analyze / Visual Mapping operate on that current surface
→ propose/map opener
→ Admin approves
→ continue to revealed surface
→ reuse Phase 120 field-authoring semantics there (§4.6 existing-tab)
```

#### Origin validation

- Preserve **fail-closed** origin validation.  
- Fix the **expected-origin source** to the resolved entry URL above.  
- **Do NOT** weaken the origin check.

#### Forbidden

| Forbidden | |
|---|---|
| Requiring non-empty dedicated `login_url` when mode is HOME ENTRY | STOP |
| Site / hostname / serviceId / Mizrahi / fixture-name logic | STOP |
| Weakening origin fail-closed | STOP |
| 121.2+ / SPECIAL runtime | STOP |

---

## 5. AI authoring contract

| Rule | Binding |
|---|---|
| Role | Authoring assist only |
| Input | Declared `loginFlowPattern` + **current surface** structure + schema |
| Output | Proposed candidate(s) for **this surface only** (fields and/or next action) |
| Persist | Draft authoring only until ACTIVATE (§7.3–§7.4); Admin selector edits do **not** activate |
| Runtime | **Never** calls AI to choose field/button/path |
| Confidence | STANDARD field-analysis confidence **unchanged** |
| New targets | Opener/transition detection define **their own** safety/confidence contract without weakening field thresholds |
| Failure | Safe authoring fail → Admin may use Visual Mapping |

### 5.1 Progressive action approval (C3) — mandatory for special-flow authoring

For `FLOATING_SCREEN` / `MULTI_STEP` / `FLOATING_SCREEN_MULTI_STEP`, the next surface often cannot be inspected until an opener/transition is clicked. **No system click** (including Analyze continuation) may occur before Admin approval.

**Required sequence:**

```text
Analyze current surface
→ AI proposes opener/transition candidate (+ field proposals for current surface)
→ show candidate + locator + confidence to Admin
→ Admin explicitly approves action for authoring continuation
→ only then may authoring click it
→ wait for next surface (bounded readiness)
→ analyze next fields/action
→ repeat as required
→ final plan review
→ Save draft / ACTIVATE (§7.4)
```

| Rule | Binding |
|---|---|
| Unapproved candidate | **Never** clicked automatically — even during authoring |
| Visual Mapping | Must support the **equivalent** controlled sequence (Admin picks action → confirms → then continuation) |
| STANDARD Analyze | **Unchanged** — this sequence does **not** apply to STANDARD / absent pattern |
| Next-surface Analyze (D-121-22) | After a **successful** approved continuation click + bounded readiness, authoring **automatically** runs SPECIAL current-surface Analyze on the revealed surface (same tab). Analyze performs **no click**. Newly proposed actions still require explicit approval. Analyze fail → show message; **never** auto-invoke Visual. Proposals are draft-only; Save stays manual |
| Admin copy | Success/failure messages in plain Hebrew; no internal terms (e.g. “Orchestrator”, “Phase 120/121”) |
| Button references (D-121-23) | Any message that tells Admin to press a button MUST quote that button’s **exact** visible label. Approval panel labels (binding): title «נמצא כפתור באתר»; approve-for-authoring «זה הכפתור הנכון»; continuation click «פתח את מסך הכניסה»; approve-for-runtime «אשר לשימוש בהפעלה»; reject «דחה». Text-only — no behavior change |

---

## 6. Visual Mapping extension contract

| Mode | Rule |
|---|---|
| STANDARD fields | Phase 120 Visual Mapping **frozen** — do not rewrite |
| Special flows (additive) | May select: floating opener; intermediate transition; readiness-related element if required; special-flow fields |
| Progressive continuation | Visual-selected action also requires explicit Admin approval before authoring click-to-continue |
| Isolation | STANDARD Visual path must not execute special-flow pick modes unless Admin is in a special-flow authoring context |

---

## 7. Persisted data model (normative — C1 / C4 / **C7**)

### 7.1 Chosen source of truth (C1 — FROZEN)

Inspected Phase 120 persistence: Managed Autofill lives under **`service_registry.metadata.autofillProfile`**. Phase 121 follows the same metadata bag pattern.

| Concern | Exact storage | Ownership |
|---|---|---|
| Login field schema | `service_registry.login_fields` | Existing |
| **Service availability** | `service_status` (`active` / `disabled` / …) | Generic catalog — **availability only** |
| **ACTIVE login contract discriminator** | `metadata.loginContractActivation` (conceptual; exact name finalized in **121.0**) | Selects STANDARD vs SPECIAL — **not** site identity |
| **STANDARD** field mappings / Managed readiness | `metadata.autofillProfile` (`fieldMappings`, `supportState`, entry URL, origin) | **Phase 120 SoT — unchanged** |
| Authoring pattern selection (DRAFT) | Admin DRAFT config (may use `loginFlowPlan.draft.pattern` while authoring SPECIAL, or equivalent DRAFT field) | Authoring only — **never** DH authority until ACTIVATE |
| **ACTIVE SPECIAL plan** | **`metadata.loginFlowPlan.active`** | **Sole SPECIAL execution SoT** when discriminator mode = SPECIAL |
| **STANDARD ACTIVE login** | Phase 120 `autofillProfile` only | **No** `loginFlowPlan.active` required |

**Conceptual ACTIVE discriminator (binding authority model; persist naming finalized in 121.0):**

```text
// Discriminated contract — exact TypeScript/storage shape is a 121.0 DD decision

STANDARD:
  { mode: 'STANDARD' }

SPECIAL:
  {
    mode: 'SPECIAL'
    activePlanVersion: number   // REQUIRED — MUST equal loginFlowPlan.active.planVersion
  }
```

| mode | `loginFlowPlan.active` | `activePlanVersion` |
|---|---|---|
| **STANDARD** | **Not** required | **Not** required |
| **SPECIAL** | **REQUIRED** (complete) | **REQUIRED** and MUST equal `loginFlowPlan.active.planVersion` |

**Authority separation (binding):**

```text
Service availability          ≠  ACTIVE login contract  ≠  Special-flow plan
service_status                ≠  loginContractActivation ≠  loginFlowPlan.active
availability only             ≠  STANDARD vs SPECIAL     ≠  SPECIAL plan document
```

| Authority | Selects | Must NOT |
|---|---|---|
| `service_status` | Availability in Digital Home | Login mode (STANDARD vs SPECIAL) |
| `loginContractActivation.mode` | ACTIVE login contract (STANDARD vs SPECIAL) | Be inferred from site/DOM/DRAFT/`loginFlowPlan.active` absence |
| `loginFlowPlan.active` | SPECIAL plan content when mode = SPECIAL | Act as STANDARD/SPECIAL discriminator by itself |

`loginFlowPlan` is the source of truth for **SPECIAL plan content** only — **not** for general service availability and **not** for STANDARD Phase 120.

**Do not** require `loginFlowPlan.active` for STANDARD. **Do not** route STANDARD through the Phase 121 orchestrator.

**Do not use** DRAFT, site inspection, runtime inference, or `service_status` as login-mode authority.

**Invariant — no dual write of mappings:**

- SPECIAL FLOW step mappings / openers / transitions / readiness live **only** in `metadata.loginFlowPlan`.
- They **MUST NOT** be independently persisted in `metadata.autofillProfile.fieldMappings`.
- Special-flow fill reads mappings **only** from the plan document selected for that execution context (ACTIVE for DH; ACTIVE or DRAFT snapshot for Admin Test — §8.3).
- `autofillProfile.fieldMappings` remains SoT for **STANDARD** only.

Entry URL / allowedOrigin for special flows may continue to use `autofillProfile.loginEntryUrl` / `allowedOrigin` without storing special-flow field locators there.

### 7.2 `loginFlowPlan` shape (SPECIAL SoT)

```text
metadata.loginFlowPlan: {
  draft: LoginFlowPlanDocument | null     // authoring; may be incomplete
  active: LoginFlowPlanDocument | null    // ACTIVATED special plan; DH special-flow authority
}

LoginFlowPlanDocument {
  planVersion: number
  pattern: FLOATING_SCREEN | MULTI_STEP | FLOATING_SCREEN_MULTI_STEP
  // STANDARD does NOT require this document / active presence
  preambleActions?: FlowAction[]
  steps: FlowStep[]
  // no finalAuthAction
}

FlowStep {
  stepId: string
  fieldMappings: AutofillFieldMapping[] | SplitFieldMapping[]
  exitTransition?: FlowAction
}

FlowAction {
  actionId: string
  kind: 'floating_opener' | 'intermediate_transition'
  label: string
  locatorType: 'css'
  locator: string
  approvedForAuthoringContinuation?: boolean
  approvedForRuntime: boolean
  readiness: ReadinessCondition
}
```

### 7.3 Three authorities: availability, ACTIVE login contract, special-flow plan (**binding**)

#### A. Service availability (generic customer configuration)

| State | Meaning |
|---|---|
| **DRAFT / NOT READY** | Tenant Admin configures; not yet ACTIVE for that customer’s Digital Home |
| **ACTIVE** | Available in that tenant/customer Digital Home (use existing `service_status` contract where appropriate, e.g. `active`) |
| **INACTIVE / NOT READY** | Unavailable for that customer’s Digital Home (e.g. `service_status=disabled` or not yet activated) |

Activation of availability means activating a **customer’s service presence** — not deploying software or publishing a global site catalog. `service_status` remains **availability only**.

#### B. ACTIVE login contract discriminator (`loginContractActivation`)

| `mode` | Digital Home runtime | `loginFlowPlan.active` | `activePlanVersion` | Orchestrator? |
|---|---|---|---|---|
| **STANDARD** (or **missing** discriminator — backward compat only) | Frozen **Phase 120** contract | **Not** required | **Not** required | **No** |
| **SPECIAL** | Phase 121 orchestrator executes ACTIVE plan | **REQUIRED** (complete) | **REQUIRED**; MUST equal `loginFlowPlan.active.planVersion` | **Yes** |

| SPECIAL failure (any of these) | Binding |
|---|---|
| missing `activePlanVersion` | **FAIL CLOSED** |
| missing `loginFlowPlan.active` | **FAIL CLOSED** |
| corrupt ACTIVE plan | **FAIL CLOSED** |
| `activePlanVersion` ≠ `loginFlowPlan.active.planVersion` | **FAIL CLOSED** |
| internal pattern/plan mismatch | **FAIL CLOSED** |
| Fall back to STANDARD or Generic | **Forbidden** |

**Backward compatibility:** Existing Phase 120 services that predate the discriminator: **missing** `loginContractActivation` → treat as **STANDARD** (preserve frozen Phase 120). This default **MUST NOT** apply to a service that has been **explicitly activated as SPECIAL** under Phase 121.

The discriminator is **configuration authority**, not site identity. It **MUST NOT** cause STANDARD to traverse the Phase 121 orchestrator.

**Forbidden resolution:** runtime inference; site/DOM inspection; DRAFT; `service_status` as login-mode authority; treating `loginFlowPlan.active` absence alone as “must be STANDARD.”

#### C. Runtime authority by consumer

| Consumer | Authority |
|---|---|
| **Digital Home** | Service available (`service_status`) + ACTIVE `loginContractActivation` → STANDARD Phase 120 **or** SPECIAL ACTIVE plan. **Never** DRAFT. |
| **Admin Test** | Product validation — may execute immutable **DRAFT snapshot** (§8.3) with the **same runtime behavior** Digital Home will use after ACTIVATE (when that runtime slice exists). **Not** a TEST deployment environment. |
| Admin UI «אופי הכניסה» while editing | Binds to **DRAFT** only |

#### D. Atomic ACTIVATE transitions (121.0 must define and prove)

| Transition | Binding |
|---|---|
| **STANDARD → STANDARD** | Atomic Phase 120 STANDARD activate/update; mode remains STANDARD; no SPECIAL plan required |
| **STANDARD → SPECIAL** | Validate complete SPECIAL draft → **atomically** set discriminator mode=SPECIAL + write ACTIVE plan/`activePlanVersion` |
| **SPECIAL → SPECIAL** | Validate replacement draft → **atomically** replace ACTIVE plan/version; previous ACTIVE remains until success |
| **SPECIAL → STANDARD** | Validate/activate Phase 120 STANDARD contract **first** as part of the **same logical** activation → **atomically** set mode=STANDARD + retire/clear SPECIAL active authority |

| Failure / mixed state | Binding |
|---|---|
| ACTIVATE fails | Previous ACTIVE contract **unchanged** |
| Forbidden observable states | STANDARD discriminator + partially active SPECIAL plan; **or** SPECIAL discriminator + missing required ACTIVE plan |

#### E. Edit while ACTIVE login contract already set

| Step | Binding |
|---|---|
| While editing | **Previous ACTIVE** login contract remains Digital Home runtime authority |
| Admin work | Creates/updates **DRAFT** |
| Admin Test | May execute immutable **DRAFT snapshot** (when runtime slice exists) |
| Digital Home | Continues using previous ACTIVE contract |
| Successful **ACTIVATE** | Atomic transition per §7.3.D |
| Abandon / ACTIVATE failure | Previous ACTIVE contract **unchanged** |

#### Binding invariants

1. Editing DRAFT is **AUTHORING only** — **MUST NOT** immediately change Digital Home.  
2. While authoring, the **currently ACTIVE** login contract remains effective.  
3. SPECIAL ACTIVATE writes discriminator + complete plan (+ version) **atomically**.  
4. SPECIAL ACTIVE internal pattern/steps mismatch → **FAIL CLOSED**.  
5. Corrupt/partial SPECIAL ACTIVE under mode=SPECIAL → **FAIL CLOSED**.  
6. STANDARD under mode=STANDARD uses **Phase 120** only — **no** mandatory `loginFlowPlan.active`.  
7. **No** site-identity categories in resolution.

### 7.4 Safe authoring lifecycle (normative)

```text
Tenant Admin creates/configures service
  → DRAFT
  → Analyze / Visual Mapping
  → Admin Test (product validation; DRAFT snapshot; same runtime as post-ACTIVATE — when slice exists)
  → ACTIVATE (atomic loginContractActivation + contract payload)

If loginContractActivation.mode = STANDARD:
  → Phase 120 runtime (no loginFlowPlan.active; no orchestrator)

If loginContractActivation.mode = SPECIAL:
  → Phase 121 ACTIVE loginFlowPlan + orchestrator
  → activePlanVersion REQUIRED and MUST equal loginFlowPlan.active.planVersion
  → missing/invalid plan, missing activePlanVersion, version mismatch, or pattern/plan mismatch → FAIL CLOSED (never STANDARD/Generic fallback)

When already ACTIVE and editing:
  prior ACTIVE login contract remains live for Digital Home
  → Admin edits DRAFT
  → Admin Test may run DRAFT snapshot (when runtime exists)
  → ACTIVATE atomically replaces ACTIVE login contract (§7.3.D)
  → abandon/fail → previous ACTIVE unchanged
```

### 7.5 Distinguishing intermediate vs final auth (authoring)

| Class | Persisted? | Runtime |
|---|---|---|
| Intermediate (`Next` / `Continue` / reveal login) | Only if Admin approved as `FlowAction` | May click |
| Final (`Login` / `Sign In` / התחבר) | **Must not** be stored as auto-click action | User only |
| Ambiguous button | Authoring FAIL / withhold approval | Runtime never clicks |

### 7.6 Backward compatibility (**outside** the normative Phase 121 SPECIAL model)

| Case | Behavior |
|---|---|
| Missing `loginContractActivation` (pre-discriminator Phase 120 services) | Treat as **STANDARD** — frozen Phase 120 preserved |
| Explicitly activated SPECIAL | Missing/corrupt plan → **FAIL CLOSED** — **not** the missing-discriminator STANDARD default |
| Phase 120 `supportState=validated` | Remains Managed STANDARD readiness contract |

| Allowed | Forbidden as architecture |
|---|---|
| STANDARD without `loginFlowPlan` | Using `loginFlowPlan.active` absence alone as STANDARD proof for SPECIAL-activated services |
| Unchanged Phase 120 Managed path for mode=STANDARD | Routing STANDARD through Phase 121 orchestrator |
| SPECIAL-only plan content in `loginFlowPlan` | Silent Generic/STANDARD fallback for mode=SPECIAL |

Generic / historical `POC_GENERIC_FILL` is **not** part of the Phase 121 SPECIAL lifecycle model.

---

## 8. Runtime: Login Flow Orchestrator

### 8.1 Responsibility

**Sequencing only:**

- resolve **execution-context plan document** for SPECIAL only (Digital Home: ACTIVE `loginFlowPlan` per §7.3; Admin Test: ACTIVE or DRAFT snapshot per §8.3). STANDARD bypasses orchestrator → Phase 120.
- execute approved preamble/transition actions from that document  
- wait for approved readiness  
- invoke **Phase 120 Ext Managed fill semantics** for **current step mapping subset** on the **already-open** tab  
- advance steps  
- **STOP** before final authentication  

**MUST NOT:** become another autofill engine; duplicate fill algorithms; invent clicks; call AI; call `POC_GENERIC_FILL`.

### 8.2 Phase 120 fill reuse per step — implementation evidence (C2)

#### What exists today

| Layer | Symbol | Contract |
|---|---|---|
| Hub DH entry | `executeManagedAutofill` (`managedAutofill.ts`) | Requires `isManagedAutofillEligible` → **full** profile covers **all** required `login_fields`; sends **entire** `profile.fieldMappings`; message `HUB_MANAGED_AUTOFILL` → **opens Login Entry tab** then fills |
| Hub shared send | `sendManagedAutofillPayloadAndAwait` / `buildManagedAutofillPayload` | Accepts **caller-supplied** `fieldMappings` array + credentials; still uses Ext message that **opens** URL |
| Ext runner | `runManagedAutofill(options)` (`validated-autofill.js`) | `assessManagedTargetsReady` + fill + verify over **`options.fieldMappings` only** (exact-one per locator); does **not** independently require full service schema |
| Ext verify | `verifyMappings` on `filledTrail` | Verifies fields filled **in that invocation**, not “all login_fields globally” |

#### Can Phase 120 fill execute an approved subset?

| Path | Subset OK? | Notes |
|---|---|---|
| Ext `runManagedAutofill` | **YES** | Pass only that step’s mappings; readiness/fill/verify scoped to that array |
| Hub `executeManagedAutofill` | **NO** (for per-step) | Full-schema eligibility + full profile mappings + **always opens** page — calling once per step would **re-open URL** and break MULTI_STEP / post-opener fill |

#### Does per-step use change Phase 120 semantics?

| Approach | Verdict |
|---|---|
| Orchestrator calls `executeManagedAutofill` once per step | **REJECTED** — changes open/eligibility semantics; not “unchanged Phase 120” |
| Orchestrator **additive** API: open once (or reuse tab), then invoke **same Ext** `runManagedAutofill` with step subset on **existing tab** | **REQUIRED** — Ext fill contract unchanged; STANDARD Hub entry untouched |
| Modify `isManagedAutofillEligible` / `mappingsCoverRequiredSchema` / `executeManagedAutofill` to allow partial schema | **STOP — forbidden** (would alter accepted Phase 120 core contract) |

**Architecture target (binding):** Phase 121 orchestrates. Phase 120 Ext fill (`runManagedAutofill` + `GenericFillExecutor.fillField`) remains the field-fill authority **unchanged**. Phase 121 adds Hub/background **existing-tab fill** orchestration that reuses that Ext runner — **not** a second fill engine and **not** a silent refactor of `executeManagedAutofill`.

**CALL OUT:** If implementation cannot add existing-tab reuse without modifying Ext `runManagedAutofill` fill/verify semantics or STANDARD `executeManagedAutofill` eligibility → **STOP** and return for architecture review. Do not hide behind an “adapter.”

### 8.3 Shared execution — Admin Test & Digital Home (**C8**)

**Admin Test** is a product **validation** feature — **not** the TEST deployment environment.

**Same runtime behavior** as Digital Home will use after ACTIVATE:

| Login config | Shared path |
|---|---|
| STANDARD | Phase 120 path (no orchestrator) |
| SPECIAL | Login Flow Orchestrator + Phase 120 Ext fill semantics + fail-closed + stop-before-final-auth |

| Surface | SPECIAL plan context | Must NOT |
|---|---|---|
| **Digital Home** | **ACTIVE `loginFlowPlan` only** | Execute DRAFT; ACTIVATE as side-effect; Generic fallback |
| **Admin Test** | Explicitly selected **ACTIVE** **or** immutable **DRAFT snapshot** | ACTIVATE DRAFT as side-effect of Test; mutate ACTIVE; alter DH; persist test credentials; invent a test-only fill engine |

| Allowed difference | Binding |
|---|---|
| Plan version/context | ACTIVE vs DRAFT snapshot selection (SPECIAL) |
| Credential source | Admin Test temporary vs Digital Home vault (Phase 120 D-120-12 spirit) |

**DRAFT Admin Test contract (SPECIAL):**

- Snapshot is **immutable** for the duration of the test run (copy of draft at Test start).  
- Running Admin Test **does not** ACTIVATE, does not write `loginFlowPlan.active`, does not change Digital Home.  
- Incomplete/invalid DRAFT snapshot → Admin Test **FAIL CLOSED** (same rules as invalid ACTIVE).  
- Owner can validate real orchestrator behavior **before** ACTIVATE.

This preserves “Admin Test = Digital Home execution behavior” without requiring an untested SPECIAL plan to become ACTIVE first.

### 8.4 Pattern contracts

#### STANDARD / absent

```text
Open configured entry URL
→ existing executeManagedAutofill / Phase 120 path
→ STOP
```

#### FLOATING_SCREEN / MULTI_STEP / FLOATING_SCREEN_MULTI_STEP

Require valid plan document for the execution context (**ACTIVE** for DH; selected ACTIVE or DRAFT snapshot for Admin Test). Else **FAIL CLOSED** (no Generic fallback).

```text
Open entry (once)
→ [optional preamble opener + readiness]
→ for each step:
    Ext Managed fill(step.fieldMappings) on existing tab
    optional approved transition + readiness
→ STOP
```

### 8.5 State model (deterministic)

```text
OPENING
READY_FOR_STEP
FILLING_STEP
WAITING_FOR_TRANSITION
EXECUTING_TRANSITION
WAITING_FOR_NEXT_STEP
COMPLETED_FILL
STOPPED_FOR_USER
FAILED
```

Guards: last step without exitTransition → `STOPPED_FOR_USER`; never click unapproved/final-auth; `FAILED` terminal.

### 8.6 Readiness / wait

Approved deterministic condition; bounded `timeoutMs`; timeout → `FAILED`. Exact vocabulary v1 deferred to 121.0 (Q3).

### 8.7 Failure contract (special-flow ops)

Opener/transition/readiness/field/split/timeout/DOM replacement → **FAIL CLOSED**; observable reason; no silent alternate.

---

## 9. Field-shape extension — split credential

**Not** a `loginFlowPattern`. Generic mapping capability. **Own sub-phase 121.6** (separate from `type=tel`).

```text
one logical login_fields.id
→ ordered targets[0..N-1] (deterministic locators)
→ distribute credential characters/segments in order
```

| Concern | Contract |
|---|---|
| Analyze | May propose split when N parallel inputs score as one logical field |
| Visual | Admin can bind ordered targets if AI fails |
| Approval | Explicit Admin approval of ordered list |
| Runtime | Deterministic distribution; length vs N mismatch → FAIL CLOSED |
| Isolation | One-field → one-target Phase 120 behavior **unchanged** when split not configured |
| Distribution rules | Evidence-gated (Q4) — not prematurely fixed |

Fixture (only): American Express — **no** Amex-specific code.

---

## 10. Field compatibility investigation — evidence first (121.5)

**Not** a flow pattern. **Not** presumed to be a `type=tel` enablement slice.

Phase 120 §29 evidence: `type=tel` is already supported by Visual identification, Analyze observation, Managed eligibility, and Admin Test / Managed runtime fill — **no** supported-input-type contract gap for tel was established. Therefore Phase 121 **MUST NOT** assume that `type=tel` itself requires a compatibility extension, eligibility change, or “enable type=tel” implementation target.

| Requirement | Binding |
|---|---|
| Start | **Read-only / evidence-only** |
| Method | Reproduce failure → identify exact layer (Analyze / locator / Visual target / event behavior / value writing / formatting / readiness / other generic contract) → compare to Phase 120 accepted behavior |
| Fixture | e.g. CityCar — only to locate the **actual generic** failure point; **not** site-specific product feature |
| If no generic product gap proven | **Close 121.5 with NO CHANGE** |
| If generic gap proven | **STOP** → Manager DD required → Architecture approval required before any implementation |
| Forbidden | Using `type=tel` alone to justify Managed eligibility or fill-safety changes; weakening STANDARD fill semantics |

**121.6** (split/composite credential) remains the separate new capability candidate (Phase 120 §29 already supports that as distinct from tel).

---

## 11. Safety / privacy / click risk

| Rule | Binding |
|---|---|
| Credentials | Never log values; Phase 120 credential-safety preserved |
| Diagnostics | Locators/semantics/reasons only |
| Clicks | Only approved openers/intermediate transitions |
| Final auth | User-controlled always |
| New risk | Automatic clicks can navigate/submit unintended paths → mitigated by approval + fail-closed + no final-auth automation |

---

## 12. Determinism / fail-closed (summary)

| Consumer | Authority |
|---|---|
| **Digital Home** | Service available + ACTIVE `loginContractActivation` → mode STANDARD: Phase 120; mode SPECIAL: **required** `activePlanVersion` + **required** complete ACTIVE `loginFlowPlan` with matching `planVersion`; **never DRAFT** |
| **Admin Test** | Product validation — same runtime as post-ACTIVATE; SPECIAL may use ACTIVE **or** immutable DRAFT snapshot (when runtime slice exists) |

For SPECIAL (mode=SPECIAL), every runtime target must originate from the **execution-context plan document** only. STANDARD (mode=STANDARD or missing-discriminator compat) does **not** use the orchestrator or `loginFlowPlan`.

Forbidden at special-flow runtime: AI choice; opportunistic discovery; silent substitution; nearest/first-match under multi-candidate; auto-repair; Generic fallback; silent STANDARD fallback when mode=SPECIAL.

### 12.1 Closed Generic boundary (C5 — normative)

Phase 121 special-flow execution is **Managed / approved-plan execution only**.

When `loginContractActivation.mode = SPECIAL` (patterns `FLOATING_SCREEN` | `MULTI_STEP` | `FLOATING_SCREEN_MULTI_STEP`):

| Condition | Required behavior |
|---|---|
| missing `activePlanVersion` | **FAIL CLOSED** |
| missing `loginFlowPlan.active` | **FAIL CLOSED** |
| corrupt ACTIVE plan | **FAIL CLOSED** |
| `activePlanVersion` ≠ `loginFlowPlan.active.planVersion` | **FAIL CLOSED** |
| internal pattern/plan mismatch | **FAIL CLOSED** |
| Required opener/transition/step mapping missing | **FAIL CLOSED** |
| Admin Test DRAFT snapshot incomplete/invalid | **FAIL CLOSED** |

**Forbidden:**

- Silent fallback to `POC_GENERIC_FILL`
- Silent fallback to STANDARD because SPECIAL plan/`activePlanVersion` is missing or mismatched
- Generic runtime discovery of special-flow actions/buttons
- Generic transition-button heuristics

Historical Generic behavior for services **outside** Phase 121 special-flow patterns remains **unchanged** (not expanded, not used as special-flow backup) — and is **not** part of the Phase 121 SPECIAL lifecycle model.

---

## 13. Observability

| Surface | Requirement |
|---|---|
| Admin Test / DH | Structured outcome: pattern, stepId, actionId, reason, timeouts — **no secrets** |
| Diagnostics | Correlate with existing Managed diagnostics where applicable without changing Phase 120 stamp semantics for STANDARD |

---

## 14. Regression protection (first-class AC)

### 14.1 Phase 120 frozen regression suite

Must pass **unchanged** through every Phase 121 sub-phase, including at minimum:

- Phase 117–120 Managed STANDARD acceptance suites  
- Accepted STANDARD Analyze / Visual / fill fixtures  
- No silent Managed→generic regression for validated Managed services  

### 14.2 Isolation preference

STANDARD / absent pattern **must not** traverse special-flow branches.

### 14.3 Per-capability AC requirement

No Phase 121 capability accepted if STANDARD behavior regresses.

---

## 15. Phased implementation plan (controlled)

| Sub-phase | Scope | Forbidden | Gate |
|---|---|---|---|
| **121.0** | Define DRAFT/ACTIVE model; immutable DRAFT snapshot **contract**; atomic ACTIVATE semantics including `loginContractActivation` discriminator + STANDARD↔SPECIAL transitions (§7.3.D); exact persist naming after repo evidence; STANDARD remains Phase 120 | **Any** SPECIAL runtime execution (Admin Test or DH); requiring `loginFlowPlan` for STANDARD; mixed discriminator/plan writes | **DD PASS**; **121.0-impl Architecture ACCEPTED / CLOSED** (2026-09-24) |
| **121.1** | Admin SPECIAL DRAFT authoring; progressive action approval; build/validate immutable DRAFT snapshot **representation**; **§4.7** entry-mode surface; **§4.6** initial open/reuse of resolved authoring tab | **Actual** SPECIAL Admin Test execution that requires opener/transition/runtime orchestration; DH special-flow execution; temporary/test-only SPECIAL execution engine; duplicate Admin Test runtime; early 121.2/121.3 execution | **DD PASS**; **121.1-impl REOPENED** for §5.1 / D-121-22 (Owner 2026-09-27; §4.7 + §4.6 PASS retained) |
| **121.2** | FLOATING_SCREEN execution via **shared** orchestrator — **same** engine: Admin Test (immutable DRAFT **or** ACTIVE plan context) **and** Digital Home (ACTIVE only) | MULTI_STEP; composition; tel investigation as fill change; split; separate Admin-Test-only engine | Fixture live AC; STANDARD regression PASS |
| **121.3** | MULTI_STEP execution via **same** shared orchestrator — Admin Test and Digital Home with their allowed plan contexts | Composition; fill changes via tel assumption; split; separate Admin-Test-only engine | Fixture live AC; STANDARD regression PASS |
| **121.4** | FLOATING_SCREEN_MULTI_STEP composition via **same** shared orchestrator rule as 121.2/121.3 | New engines; site branches; tel-as-enablement; split | Composition AC; STANDARD regression PASS |
| **121.5** | **Field-compatibility investigation — evidence first** (read-only reproduce → exact layer → compare Phase 120). Close with **NO CHANGE** if no generic gap; if gap proven → STOP + DD + Arch approval before impl. `type=tel` alone does **not** justify eligibility/fill changes | Implementing “enable type=tel”; changing Managed eligibility because input is tel; split credential; flow-pattern changes | Evidence report; NO CHANGE or approved DD; STANDARD regression PASS |
| **121.6** | **Split credential only** | Treating tel investigation as split; flow-pattern changes | Own evidence + DD + regression + Amex fixture + STOP |

**Admin Test execution sequencing (binding):** Special-flow Admin Test that runs opener/transition/readiness/fill exists **only** when the corresponding shared runtime capability exists (121.2+). §7.4 / §8.3 describe completed product behavior; this roadmap governs capability availability by slice.

Each sub-phase: permitted/forbidden changes; tests; regression gates; live acceptance; **STOP**.

Principle: **one bounded capability at a time** — especially 121.5 (evidence-only unless gap proven) vs 121.6 (split credential).

---

## 16. Acceptance matrix (capabilities)

| Capability | Admin config | AI Analyze | Visual Mapping (Admin choice) | Admin approval | Persisted | Admin Test | Digital Home | Failure | P120 regression |
|---|---|---|---|---|---|---|---|---|---|
| STANDARD | pattern STANDARD | Phase 120 only | Phase 120 (explicit Admin choice; never auto-fallback) | Phase 120 fields | autofillProfile (no loginFlowPlan required) | Phase 120 | Phase 120 | Phase 120 | **Must PASS** |
| FLOATING_SCREEN | DRAFT→ACTIVATE | progressive | explicit Admin choice only | ACTIVATE atomic | `loginFlowPlan` | ACTIVE **or** DRAFT snapshot (from **121.2+**) | **ACTIVE plan only** | no Generic | **Must PASS** |
| MULTI_STEP | DRAFT→ACTIVATE | progressive | explicit Admin choice only | ACTIVATE atomic | `loginFlowPlan` | ACTIVE **or** DRAFT snapshot (from **121.3+**) | **ACTIVE plan only** | no Generic | **Must PASS** |
| FLOATING_SCREEN_MULTI_STEP | DRAFT→ACTIVATE | progressive | explicit Admin choice only | ACTIVATE atomic | `loginFlowPlan` | ACTIVE **or** DRAFT snapshot (from **121.4+**) | **ACTIVE plan only** | no Generic | **Must PASS** |
| field-compat investigation (121.5) | evidence-first | evidence-only | if Admin chooses during investigation authoring | N/A until gap proven | no persist change unless Arch-approved after gap | N/A unless approved | N/A unless approved | NO CHANGE if no gap | **Must PASS** |
| split credential | ordered targets (121.6) | propose split | map ordered (Admin choice) | ordered list | mapping shape (not dual SoT) | distribute→verify | same | length mismatch fail | **Must PASS** |

**Fixtures (non-architectural):**  
FLOATING_SCREEN: Bank PAGI, Mizrahi-Tefahot, CAL  
MULTI_STEP: Gmail, Dropbox, Maccabi Sheli  
SPLIT: American Express  
TEL: CityCar  

---

## 17. Component reuse vs change matrix

| Change | Reuse (P120) | New (P121) | Must existing change? | Why unavoidable? | P120 protection |
|---|---|---|---|---|---|
| STANDARD author/fill | Analyze, Visual, autofillProfile, Managed fill | — | **No** | — | Bypass orchestrator |
| loginFlowPattern UI | Admin service editor shell | Pattern selector | Additive UI only | Config entry point | Default STANDARD |
| Floating / multi-step author | Analyze/Visual buttons | Plan editor; action approval; readiness | Analyze **routing** only when pattern ≠ STANDARD | Context for AI proposal | STANDARD route untouched |
| Runtime special flow | Ext `runManagedAutofill` | Orchestrator + existing-tab fill entry | **Must not** change Ext fill semantics or STANDARD `executeManagedAutofill` | Subset fill + no re-open | STANDARD bypass; Ext contract regression |
| Split field (121.6) | Fill executor write loop | Ordered multi-target mapping type | Possible additive write API | Shape not 1:1 | 1:1 path unchanged when unset |
| Field-compat investigation (121.5) | Phase 120 Analyze/Visual/eligibility/fill (incl. tel per §29) | Evidence report only unless gap proven | **Default: No** | Only if generic gap proven + DD + Arch approval | Close NO CHANGE if no gap; `type=tel` alone ≠ eligibility change |

**CALL OUT:** 121.5 is evidence-first and must **not** assume tel enablement. 121.6 (split) is the separate capability candidate. Do **not** modify `executeManagedAutofill` full-schema eligibility to “enable” per-step special flows.

---

## 18. Security / privacy (phase)

Preserve Phase 120 ZK/credential rules. New click automation is navigation/reveal only under Admin approval. No secret logging.

---

## 19. Testing and lint expectations

- Unit/contract tests for plan parse, readiness timeout, fail-closed  
- STANDARD regression suite mandatory green per sub-phase  
- Fixture live UAT per capability (Owner)  
- Lint/tsc as repo standard  
- No site-id branches in production runtime (static verify)

---

## 20. Functional testability

| Item | |
|---|---|
| Page | Admin service editor (`#/admin`); Digital Home tile |
| User-visible | Select «אופי הכניסה»; Analyze/Visual; approve actions; Admin Test / DH launch |
| Observable | Special-flow sequence executes; stops before final login; STANDARD services unchanged |
| Minimal E2E | One FLOATING_SCREEN fixture + one MULTI_STEP fixture + one STANDARD control |

---

## 21. Open architectural questions

| # | Question | Why it matters | Decision needed |
|---|---|---|---|
| Q3 | Readiness vocabulary v1 minimal set? | Prevent overbuild | Resolve during **121.0** (before runtime impl); start candidate: exact-one visible eligible css element |
| Q4 | Split-field: character-per-input vs chunking rules? | Amex-class | Evidence-gated in **121.6** dedicated DD — do not fix prematurely |

**Resolved / removed from open list:**

| Former | Resolution |
|---|---|
| Q1 storage location | SPECIAL SoT = **`metadata.loginFlowPlan`**; STANDARD = Phase 120 `autofillProfile` — **not** unified under `loginFlowPlan.active` |
| Q2 dual SoT | SPECIAL mappings **only** in plan; STANDARD remains `autofillProfile.fieldMappings` — §7.1 |
| Q5 Generic boundary | Special-flow → FAIL CLOSED; **no** `POC_GENERIC_FILL` fallback — §12.1 |
| C9 site-identity | **WITHDRAWN** |
| Unified loginFlowPlan for STANDARD | **REJECTED** — would make Phase 121 mandatory for STANDARD and risk frozen Phase 120 |
| Service vs plan authority | Separated — §7.3 |
| ACTIVE login contract discriminator | `loginContractActivation.mode` — §7.1 / §7.3; missing → STANDARD compat only |
| type=tel as Phase 121 enablement | **REJECTED as presumption** — Phase 120 §29; 121.5 = evidence-first investigation (§10) |

---

## 22. STOP gates

| Gate | Condition |
|---|---|
| Arch | Owner ACCEPT of `arch-phase121.md` — **ACCEPTED / FROZEN** (2026-09-24); per-slice AUTHORIZE still required |
| Per slice | Explicit AUTHORIZE 121.x — **121.0-impl CLOSED**; **121.1 §5.1 / D-121-22 AUTHORIZED** (Owner 2026-09-27); **121.2+ NOT AUTHORIZED** |
| Any slice | STANDARD regression FAIL → STOP capability acceptance |
| Final auth | Any auto-click of final login → REJECT design |
| Site branch | Any `if (serviceId===…)` runtime → REJECT |
| Leumi | Reopening Leumi via 121 fill changes → REJECT |
| Fill contract | Changing Ext fill semantics or STANDARD `executeManagedAutofill` eligibility for per-step → **STOP** / architecture re-review |
| Runtime rediscovery | Any DH login that re-analyzes / AI-chooses / rediscovers / auto-repairs instead of executing the ACTIVE contract (§1.5) → REJECT |

---

## 23. Handoff notes for Manager

- Normative contract: this file  
- Phase 120: **do not modify** accepted STANDARD behavior  
- First authorized post-121.0 slice: **121.1 Manager DD AUTHORIZED** (Owner 2026-09-24). **121.1-impl** after Arch PASS on DD. **121.2+ NOT AUTHORIZED.** One bounded slice at a time.  
- Admin Test SPECIAL execution (opener/transition/orchestrator) arrives with the matching shared runtime slice (121.2+), not in 121.1  
- Fixtures ≠ architecture; no global supported-site catalog  

---

## Architect Review

ARCHITECT_REVIEW_STATUS: **OWNER ACCEPTED — ARCHITECTURE FROZEN** (2026-09-24)

### Review Notes

Owner architecture review completed 2026-09-24, including full cross-check against Phase 120 architecture, Manager DD, and Developer implementation evidence. Phase 121 Architecture is **ACCEPTED** and **FROZEN**.

**121.0 DD Architecture PASS** (2026-09-24): persist keys, discriminator, atomic ACTIVATE matrix, immutable DRAFT snapshot contract (no SPECIAL runtime), STANDARD Phase 120 protection — aligned with §7 / §7.3.D / §8.3 / §15. Required corrections: **None**.

**121.0-impl Architecture FAIL** (2026-09-24): Core model/planner/snapshot/resolve largely match DD and AC evidence. **Blocking:** `mergeLoginContractMetadata` non-intent path may write `loginContractActivation` mode=SPECIAL and/or `loginFlowPlan.active` when structurally consistent, **bypassing** `planLoginContractActivate` + `validateSpecialPlanComplete` (version bump / completeness / transition gates). Non-ACTIVATE merge must allow **draft-only** authoring writes; ACTIVE SPECIAL (discriminator + `active`) must go **only** through the ACTIVATE planner. Add regression test. Then re-STOP for Architecture.

**121.0-impl Architecture PASS / CLOSED** (2026-09-24): Correction verified — non-intent merge is draft-only; raw SPECIAL+active without intent rejected (`activateRequiresIntent`); ACTIVE SPECIAL only via `loginContractActivateIntent` → planner. Regression evidence in `dev-phase121.md` / `verifyPhase121LoginContract.mjs`.

**121.1 DD Architecture PASS** (2026-09-24): SPECIAL DRAFT authoring + C3 progressive approval + §4.6 current-surface / existing-tab (no Login Entry reopen) + Visual explicit-only + draft-only mapping persist + snapshot representation + thin ACTIVATE via 121.0 planner. No SPECIAL runtime. Required corrections: **None**.

**121.1-impl Architecture FAIL** (2026-09-24): Existing-tab field Analyze/Visual, progressive click gate, draft-only persist, snapshot, thin ACTIVATE, and STANDARD freeze evidence are largely aligned. **Blocking:** SPECIAL «Analyze» on current surface proposes **credential fields only**; opener/transition candidates are **Visual-only**. Frozen §5.1 / DD §2.1 / §3.4 require Phase 121 SPECIAL Analyze **routing** to propose opener/transition candidate(s) on the current surface (Admin may still choose Visual explicitly; never auto-fallback). Field Analyze must continue reusing Phase 120 semantics via existing-tab entry — do **not** claim Phase 120 field-Analyze understands openers.

**121.1-impl Architecture PASS / CLOSED** (2026-09-24): Correction verified — `proposeSpecialActionCandidates` / `analyzeSpecialCurrentSurface` provide Phase 121 opener/transition routing on current surface; field Analyze remains Phase 120 semantics separately; proposals unapproved until Admin continuation; Visual never auto-fallback; Login Entry not reopened; STANDARD inspect unchanged. Evidence in `dev-phase121.md` / `verifyPhase121SpecialDraftAuthoring.mjs`.

**121.1 Owner live validation — REOPENED** (2026-09-24): SPECIAL authoring incorrectly depended on dedicated Login Entry URL alone (`login_url`), blocking HOME ENTRY + FLOATING_SCREEN. Binding correction **§4.7** / D-121-20. Mizrahi-Tefahot = fixture only. **121.2 NOT AUTHORIZED.**

**121.1 §4.7 correction Architecture PASS / CLOSED** (2026-09-24): `resolveSpecialAuthoringEntry` maps HOME→`primary_url` / DEDICATED→`login_url`; Analyze/Visual gated on resolved HTTPS entry + origin; fail-closed preserved (non-HTTPS / missing dedicated rejected); no site-identity branches. Evidence in `dev-phase121.md` / `verifyPhase121SpecialDraftAuthoring.mjs`.

**121.1 Owner live validation — §4.6 open/reuse REOPENED** (2026-09-24): After §4.7, Hub correctly shows HOME surface `https://www.mizrahi-tefahot.co.il/`, but Analyze / Visual Mapping still fail with collapsed generic «לא ניתן לנתח…» / mapping equivalent. Root class (generic): SPECIAL current-surface path inspects `active` / last-focused tab only; clicking Analyze from Hub focuses Hub → origin fail-closed vs resolved authoring origin. Frozen §4.6 already assigns Phase 121 ownership of **Opening/reusing the authoring tab** before field/opener semantics on that surface. Mizrahi = fixture only. **§4.7 PASS retained. 121.2 NOT AUTHORIZED.**

#### Binding correction — §4.6 initial open/reuse (**AUTHORIZED** Owner 2026-09-24 → **PASS / CLOSED**)

```text
resolve §4.7 authoring URL + allowedOrigin
→ Phase 121 open OR reuse a tab at that origin/URL (SPECIAL authoring orchestration)
→ then Analyze / Visual on THAT tab (existing-tab semantics)
→ fail-closed origin unchanged
→ after approved opener/transition progression: keep revealed surface; do NOT reopen entry
```

| Allowed | Forbidden |
|---|---|
| Open/reuse tab for resolved HOME or DEDICATED authoring URL | Calling STANDARD Analyze/Visual entry that reopens Login Entry **after** SPECIAL progression |
| Prefer existing same-origin authoring tab if already open | Weakening origin fail-closed |
| Surfacing distinct fail reasons (optional UX) | Site / hostname / serviceId / Mizrahi branches |
| | 121.2+ / SPECIAL runtime |

**121.1 §4.6 / D-121-21 Architecture PASS / CLOSED** (2026-09-24): `ensureSpecialAuthoringTab` prefers same-origin reuse else opens §4.7 `authoringUrl`; SPECIAL inspect / visual / click target that tab (not Hub active); Hub passes resolved `authoringUrl` + `allowedOrigin`; origin fail-closed preserved; no STANDARD Login Entry reopen paths; no site-identity branches. Evidence in `dev-phase121.md` / `verifyPhase121SpecialDraftAuthoring.mjs`. §4.7 PASS retained.

**121.1 Owner live validation — §5.1 / D-121-22 AUTHORIZED** (2026-09-27): After approved continuation click reveals the floating screen, Admin had to press Analyze again to map credential fields — the first Analyze ran before the fields existed and could only propose the opener. Contract §5.1 already sequences “wait for next surface → analyze next fields/action”; auto-Analyze of the revealed surface is AUTHORIZED. Also: success message «לחיצת המשך בוצעה על הלשונית הנוכחית (לא Orchestrator).» is internal jargon — replace with plain Hebrew. Generic; Mizrahi = fixture only. **121.2 NOT AUTHORIZED.**

**121.1 Owner live validation — D-121-23 AUTHORIZED** (2026-09-27): After D-121-22, Analyze message «…אשרו אותו ולחצו «המשך»…» references no existing button label (actual: «אשר להמשך כתיבה» / «המשך (לחיצה מאושרת)»); panel labels also unclear. Text-only rename per §5.1 table + exact-label rule. D-121-22 review folded into this re-review. **121.2 NOT AUTHORIZED.**

**121.1 Owner live validation — D-121-24 AUTHORIZED** (2026-09-27): Registry Admin always renders both «אופי הכניסה» (SPECIAL authoring) and «מילוי אוטומטי מנוהל» (STANDARD authoring). Owner expected to continue floating-screen field mapping in the Managed Autofill grid. That grid's Analyze / Visual reopen the Login Entry (floating screen closed → fields absent) and persist to `autofillProfile` (D-121-13 forbids SPECIAL dual-write). Owner approved UI guidance + disabling those two buttons while pattern is SPECIAL. **121.2 NOT AUTHORIZED.**

#### §4.8 Binding — Managed Autofill grid when authoring pattern is SPECIAL (D-121-24)

| Rule | Binding |
|---|---|
| Trigger | Pattern currently selected in «אופי הכניסה» (live selection, before Save Draft) ∈ {FLOATING_SCREEN, MULTI_STEP, FLOATING_SCREEN_MULTI_STEP}. Selection state may be lifted to the Registry Admin parent; it is **not** persisted by this change |
| Guidance | Visible plain-Hebrew notice in «מילוי אוטומטי מנוהל», e.g. «בשירות עם אופי כניסה מיוחד (כמו מסך צף), מיפוי שדות הכניסה נעשה בגריד «אופי הכניסה».» — quoted names must match exact visible labels (D-121-23 rule) |
| Disabled | That grid's Login-Entry «נתח דף כניסה» and «מיפוי חזותי» buttons (all field rows) |
| Unchanged | All other Managed Autofill controls and logic; STANDARD Analyze/Visual engines; `autofillProfile` persist / validate / ACTIVATE; SPECIAL editor behavior |
| STANDARD pattern | Grid renders and behaves exactly as today (no notice, nothing disabled) |
| Forbidden | Hiding/removing the grid; auto-migrating mappings between grids; writing SPECIAL mappings to `autofillProfile`; site / hostname / serviceId / fixture branches; 121.2+ |

Evidence: verify proves notice + disabled only when pattern is SPECIAL; STANDARD unchanged; exact-label rule; `data-action` attributes retained.

**121.1 Owner live validation — D-121-25 AUTHORIZED** (2026-09-27): SPECIAL editor Visual Mapping gives no in-progress feedback, keeps stale messages, and can lock indefinitely when the pick never resolves. UX-only fix approved in parallel with the iframe diagnostic. **121.2 NOT AUTHORIZED.**

#### §4.9 Binding — SPECIAL editor Visual Mapping feedback (D-121-25)

| Rule | Binding |
|---|---|
| Scope | SPECIAL editor («אופי הכניסה») Visual Mapping for credential fields **and** «מיפוי חזותי — פותח» / «מיפוי חזותי — מעבר» |
| Indicator | While a pick is armed, the pressed control shows plain-Hebrew in-progress text (parity with STANDARD grid, e.g. «ממתין ללחיצה על השדה…» / «ממתין ללחיצה על הכפתור…») plus a status line naming what is awaited |
| Stale messages | Starting Visual (and Analyze / continuation) clears previous success **and** error |
| Timeout | Bounded (e.g. 60s). On timeout: disarm the pick in the tab, release the editor, show plain-Hebrew message (e.g. «לא נקלטה לחיצה בזמן. נסו שוב או לחצו «ביטול».» — exact-label rule) |
| Cancel | Visible «ביטול» while armed; disarms the pick in the tab (listener removed, no mapping written) and releases the editor |
| Unchanged | Pick semantics (eligibility, locator determinism, origin fail-closed), frame 0 scope, D-121-21 open/reuse, draft-only persist, STANDARD grid |
| Forbidden | iframe / multi-frame support (pending §2.2 trigger decision); auto-fallback; site / hostname / serviceId / fixture branches; 121.2+ |

**121.1 Owner live validation — D-121-22 REGRESSION FINDING** (2026-09-27): After D-121-22..25, manual «נתח דף כניסה (משטח נוכחי)» on the fixture HOME surface proposes a wrong opener (`#gotoMenu` — menu/logo) instead of the correct opener found in earlier runs. Code evidence (generic, not site-specific):
- `runSpecialAnalyze` uses `pickNewActionCandidate` for **manual** Analyze too (not only `after_continue`). It skips every candidate whose locator is already in the draft. Earlier runs already upserted the correct opener into the draft → manual Analyze now skips it and proposes the next-ranked control.
- Fallback that would show the known draft action runs only when no `pendingAction` exists → correct opener stays hidden.
- Every proposal is upserted into the draft preamble **before** Admin approval (`upsertPreambleAction` on propose) → wrong candidates (e.g. `IPB Center TLV`, `#gotoMenu`) accumulate in the draft and are persisted on «שמור טיוטה».
Owner workaround until fixed: «מיפוי חזותי — פותח» (sets the pending action directly; not affected).

#### §5.2 Binding — proposal vs draft (D-121-26, **AUTHORIZED** Owner 2026-09-27)

| Rule | Binding |
|---|---|
| Manual Analyze | Pending action = **top-ranked** proposal for the current surface, even if its locator already exists in the draft (then show the existing draft action with its current approval state) |
| `after_continue` Analyze | May skip the action just clicked (and other already-approved draft actions) so the next step is proposed — D-121-22 intent retained |
| Draft write | Proposals are **not** written to the draft plan until Admin presses «זה הכפתור הנכון». «דחה» removes that action from the draft if present |
| Unchanged | Routing/ranking heuristics, click gate, origin fail-closed, D-121-21/23/24/25, STANDARD |
| Forbidden | Site / hostname / serviceId / fixture branches; iframe work; 121.2+ |

**121.1 Owner live validation — authoring tab identity finding** (2026-09-27, after D-121-26): (1) «פתח את מסך הכניסה» reports success, auto-Analyze reports fields not found, but the floating screen does **not** open in the tab the Owner is looking at (Owner then opened it manually — harmless). (2) Field «מיפוי חזותי» shows «ממתין ללחיצה על השדה…» but clicking the field in the visible tab does nothing. Code evidence (generic):
- Hub never passes a `tabId`; `ensureSpecialAuthoringTab` reuses the **first** same-origin tab returned by `chrome.tabs.query({})` (window/index order — not recency, not the tab the Admin is viewing).
- The reused tab is **never activated / focused**.
- With more than one same-origin tab open (earlier authoring runs open new tabs when none match), click, auto-Analyze and Visual arm may all run in a **hidden** tab → exactly symptoms (1) and (2).
- The iframe hypothesis (§ open items) remains possible independently; Owner right-click diagnostic still pending.

**Owner correction (2026-09-27):** only **one** fixture tab was open when symptoms (1)+(2) occurred → tab-identity is **not** the root cause here. D-121-27 stays authorized as generic hardening only. Remaining explanations:
- **(2) Visual pick never resolves in the single visible tab with the floating screen open** → leading cause = credential fields inside an **iframe** (top-document capture listener never sees clicks in a child frame; a Shadow DOM click would still reach the top document and yield a message, not silence). Owner right-click diagnostic («הצג מקור מסגרת») decides the §2.2 trigger.
- **(1) Continuation click “succeeds” but the floating screen does not open** → (a) the pending action may not be the real opener (need the locator shown in «נמצא כפתור באתר»); and/or (b) default readiness = the clicked opener's own locator, so readiness passes immediately and success is reported **without** evidence that a new surface appeared (existing readiness finding). Success is therefore not proof of opening.

**Owner diagnostics (2026-09-27):** (a) Right-click inside the username input showed the editable-field menu without frame items — **inconclusive** (browsers omit frame items on editable fields). (b) Pending opener locator = `#logInBtn` → plausible real opener; issue (1) therefore lies in the click itself (synthetic `element.click()` possibly ignored) and/or readiness verification, not candidate choice. Next Owner check (DevTools console, top frame): `#logInBtn` match count; whether `document.querySelector('#logInBtn').click()` opens the floating screen; with it open, `[iframe count, top-document password input present]`.

**Owner console results (2026-09-27, fixture tab, top frame):** `#logInBtn` count = **1**; `document.querySelector('#logInBtn').click()` **opens** the floating screen; with it open: `[iframe count, top-document password input] = [2, false]`.
Conclusions:
- Synthetic click on the chosen opener **works** → issue (1) is not click method / candidate choice. Remaining: tab not foregrounded at click time (D-121-27 addresses) and readiness that cannot prove the surface opened (§4.10 R3).
- Credential fields are **not** in the top document while the floating screen is open and the page has iframes → credential surface is inside an **iframe**. Explains Visual silence (top-document listener) and Analyze “fields not found”.
- **§2.2 trigger FIRED:** a Phase 121 FLOATING_SCREEN fixture is impossible to author/execute without generic iframe support. §4.10 below — **OWNER APPROVED** (2026-09-27).

### 4.10 Generic iframe credential surface (**OWNER APPROVED** 2026-09-27 — D-121-28; Manager DD «121.1-IF» **Architecture PASS** 2026-09-27 with A1–A2; **121.1-IF-impl AUTHORIZED** Owner 2026-09-27)

**Class:** generic capability (D-120-11). Fixture = evidence only. No hostname / serviceId / site branches.

#### Model

| Element | Binding |
|---|---|
| Frame descriptor | Optional per SPECIAL step (and per field mapping if needed): `frame = { frameLocator, frameOrigin }`. `frameLocator` = exact-one CSS for the `<iframe>` element in the top document; `frameOrigin` = HTTPS origin of that frame's document. Depth **1** only (iframe inside top document); nested frames → UNSUPPORTED |
| Field locators | Unchanged Phase 120 CSS rules, evaluated **inside** the declared frame document |
| Storage | `loginFlowPlan` step only (SPECIAL). `autofillProfile` / STANDARD unchanged; no frame support for STANDARD in Phase 121 |

#### Origin policy (fail-closed, not weakened)

| Rule | Binding |
|---|---|
| R1 Top | Top frame origin must equal resolved `allowedOrigin` (§4.7) — unchanged |
| R2 Frame | A frame origin is usable only if **HTTPS** and **explicitly approved by Admin** during authoring (shown in plain Hebrew with the origin). Stored as `frameOrigin`. Runtime acts only when the live frame matched by `frameLocator` has exactly this origin; else FAIL CLOSED |
| R3 Readiness | After an approved opener/transition click, readiness = declared credential field present (in its declared frame when present), bounded; opener-self readiness no longer counts as success. Failure → plain-Hebrew «המסך לא נפתח» (no false success) |

#### Authoring (121.1 correction scope)

| Capability | Binding |
|---|---|
| Inspect / Analyze | Ext collects safe page structure from top + depth-1 frames (`allFrames` injection, results tagged by frame); Phase 120 field semantics applied per frame; proposals carry frame descriptor. Frames whose origin is not yet Admin-approved are proposed with an approval prompt, never silently used |
| Visual Mapping | Arm pick in top + depth-1 frames; first frame receiving the Admin click resolves; all others disarm (D-121-25 timeout/cancel cover all frames) |
| Opener/transition | May be in the top document **or** a depth-1 Admin-approved frame (same frame descriptor model) — covers common “continue” buttons inside login iframes without a later redesign |
| Permissions | Existing `scripting` + `https://*/*` host permissions suffice; **no** new manifest permissions |

#### Runtime (121.2 scope — design only here)

Shared orchestrator targets the declared frame (`frameIds`) and invokes the **unchanged** Phase 120 Ext fill semantics (`runManagedAutofill` / `GenericFillExecutor.fillField`) inside that frame. Changing the injection **target** is allowed; changing fill/verify **semantics** is not (§ CALL OUT stands). STANDARD Hub entry untouched (frame 0).

#### Forbidden

Site / hostname / serviceId / fixture branches · nested frames · non-HTTPS or unapproved frame origins · weakening R1 · STANDARD changes · runtime before 121.2 AUTHORIZE.

#### Generality (Owner requirement 2026-09-27 — binding)

| Rule | Binding |
|---|---|
| Onboarding a new site | Admin authoring only (Analyze / Visual Mapping / approvals / Save / ACTIVATE). **No** code, deploy, or per-site configuration by developers |
| Frame-origin approval | One explicit Admin approval per site during authoring (security: prevents filling credentials into third-party / ad frames). Not a development step |
| No assumption about location | A floating screen may live in the top document (modal) **or** in a depth-1 iframe. Authoring detects where fields/actions actually are; the iframe path is used only when evidence shows it. Mizrahi (iframe) does not imply all floating screens are iframes |
| Genericity proof | DD + implementation evidence must pass on **Mizrahi-Tefahot (iframe) plus at least one FLOATING_SCREEN fixture whose credential fields are in the top document** (e.g. Bank PAGI or CAL, whichever evidences it), with zero fixture-specific code |
| Extensible action kinds | Action model (kind + locator + optional frame descriptor + readiness) must allow adding kinds later without schema redesign. **Reserved, NOT authorized:** `final_submit` (final «כניסה» button) — storing its locator for automated health checks, and any click on it, require a separate Owner decision (§2.2 excludes final Login auto-click) |
| Known limits (explicit UNSUPPORTED until separately designed) | Nested frames (iframe inside iframe); Shadow DOM credential fields; non-HTTPS frames. Unsupported cases must surface a plain-Hebrew authoring message, never silent failure |
| Site changes | Admin re-authors; automatic repair remains future (§2.2) |

#### Delivery recommendation

Substantial cross-layer change → **Manager DD** (slice «121.1-IF») before implementation; then Developer; then Architecture review. 121.2 later consumes the model.

#### Architect Review — Track A D-121-22 … D-121-27 (2026-09-27): **PASS / CLOSED**

Code + `dev-phase121.md` evidence reviewed:
- **D-121-22** auto-Analyze only after successful approved click; no click inside Analyze; Visual never auto-invoked ✔.
- **D-121-23** approval-panel labels «נמצא כפתור באתר» / «זה הכפתור הנכון» / «פתח את מסך הכניסה» / «אשר לשימוש בהפעלה» / «דחה»; exact-label sweep ✔; no internal jargon in Admin copy ✔.
- **D-121-24** Managed grid notice + Login-Entry Analyze/Visual disabled only while live pattern is SPECIAL; STANDARD unchanged ✔.
- **D-121-25** armed indicator, stale-message clear, bounded timeout + «ביטול» disarm in tab ✔.
- **D-121-26** `selectPendingForManualAnalyze` / `selectPendingAfterContinue`; propose never writes draft; «זה הכפתור הנכון» / «אשר לשימוש בהפעלה» add; «דחה» removes ✔.
- **D-121-27** session tab (`authoringTabId` → `tabId`, row-scoped), fallback `lastAccessed`, activation after origin gate and before Visual arm / continuation click; inspect never activates; cancel targets session tab ✔.
- Origin fail-closed, frame 0, STANDARD paths and no site/hostname/serviceId branches preserved ✔. STANDARD regression scripts reported PASS.

Non-blocking notes: (1) drafts saved before D-121-26 may still hold unapproved actions — Admin removes via «דחה» (no auto-cleanup authorized); (2) opener-self readiness remains until 121.1-IF R3 / A1; (3) Owner live check of field mapping on the iframe fixture is expected to fail until 121.1-IF — not a Track A defect.

#### Architect Review — 121.1-IF DD (2026-09-27): **PASS** with binding amendments A1–A2

Checked against §4.10 + forbidden list: R1 unchanged and executed first in every SPECIAL handler (AC-IF-13) ✔ · R2 explicit approval + live exact-one/origin/depth-1 re-check before any use (IF-5) ✔ · R3 replaces opener-self readiness, declared/reveal modes, ACTIVATE requires declared (IF-5.1, AC-IF-11) ✔ · depth-1 only; nested/Shadow DOM/non-HTTPS/not-addressable UNSUPPORTED with plain-Hebrew messages, never silent (AC-IF-12) ✔ · descriptor SPECIAL-only, `AutofillFieldMapping`/`autofillProfile`/STANDARD unchanged (AC-IF-1, AC-IF-16) ✔ · no manifest permission changes, no `webNavigation` ✔ · `final_submit` reserved and rejected at parse/validate/propose/click (AC-IF-5) ✔ · zero site/hostname/serviceId/fixture branches + grep gate ✔ · genericity proof Mizrahi-Tefahot (iframe) + PAGI or CAL (top document) (AC-IF-15, L-1/L-2) ✔ · no location assumption (AC-IF-14) ✔ · no 121.2 work (IF-9 design only, AC-IF-18) ✔ · D-121-21/22/23/24/25/26/27 interactions specified (IF-6) ✔.

**Supersession (§IF-0) confirmed:** D-121-25/26/27 rows «iframe work forbidden» / «frame 0 scope unchanged» are superseded **for SPECIAL authoring only** once 121.1-IF-impl is authorized. All other rows stay in force. STANDARD stays frame 0.

**Binding amendments (Developer must implement; part of 121.1-IF-impl AC):**
- **A1 — Legacy draft readiness normalization.** Drafts saved before this slice carry opener-self readiness (`createDefaultReadiness(locator)`). Authoring-side (draft only, never ACTIVE): on editor load and before snapshot/ACTIVATE validation, if an action's readiness is self or the pending marker **and** the revealed step already has a first credential mapping → apply `deriveRevealReadiness`. Otherwise leave as-is (validator reports `readinessIsSelf` / `readinessNotDeclaredField`). Verify case required.
- **A2 — R2 clarification (same origin as configured entry).** A depth-1 frame whose origin is **identical** to the resolved §4.7 `allowedOrigin` counts as already approved (the Admin configured that origin). No prompt; descriptor still written; live exact-one + origin + depth-1 re-check still mandatory. Any **other** origin → explicit «אשר מסגרת» as designed. Similarity (subdomain / registrable domain) is still **not** approval.

**Open questions (§IF-11):**
1. **Confirmed.** Per-element descriptors on field mapping, action and readiness; field mappings of one step share one frame (`mixedFrameInStep`); actions/readiness may be in a different frame than the fields; restriction relaxable later without schema change.
2. **Confirmed.** Reveal-mode readiness is authoring-only for the first pass; it is never a valid persisted readiness; ACTIVATE requires declared readiness (with A1 for legacy drafts).
3. **SUPERSEDED by D-121-29 / §4.10.1 (2026-09-27)** — Architect error: `chrome.runtime.getFrameId` is not implemented in Chrome (WECG issue #12; Chrome: "no updates"); the "Chromium ≥ 106" premise and the 121.2 end-user version note below are void. Original text: **Confirmed.** `chrome.runtime.getFrameId` from ISOLATED world in the top frame + exact-one iframe locator; unavailable → `FRAME_CORRELATION_UNAVAILABLE_HE` fail-closed; no `webNavigation`, no positional guessing. Note: manifest `minimum_chrome_version` (93) stays unchanged (manifest freeze); Owner browser must be Chromium ≥ 106 for the iframe path — **verified: Owner Chrome 153.0.8010.54 (2026-09-27)**. **Open for 121.2 (end users):** runtime iframe fill will require Chromium ≥ 106 on user browsers; decide at 121.2 DD between raising `minimum_chrome_version` to 106 (not a permission change) or keeping 93 with fail-closed Hebrew message on iframe sites only. STANDARD / top-document SPECIAL unaffected.

**Sequencing:** 121.1-IF-impl starts only after (a) Owner AUTHORIZE and (b) Track A (D-121-22…27) Architecture re-review PASS — **(b) satisfied 2026-09-27**.

#### §4.10.1 Frame correlation via postMessage nonce handshake (D-121-29, **OWNER APPROVED / AUTHORIZED** 2026-09-27)

**Trigger:** Owner L-1 (2026-09-27): with the Mizrahi floating screen open, manual «נתח» → Hub «הדפדפן אינו תומך בזיהוי מסגרות» (`frame_correlation_unavailable`) on Chrome 153. Cause: `chrome.runtime.getFrameId` exists only in Firefox; Chrome has not shipped it. The offline harness mocked it, so it passed. This is an **Architect error** in the DD Q3 answer; the DD / impl followed it correctly. Same cause explains the «המסך לא נפתח» false negative (frame never enumerated as `depth1_https` → no new input seen).

| Rule | Binding |
|---|---|
| Replace | `getFrameId` is removed from the correlation path. `frame-correlation.js` keeps the public functions (`__collectFrameCorrelation`, `__resolveFrameByLocator`) and output shape; only the id source changes |
| Handshake | (1) Ext injects an ISOLATED **listener** into all frames (`allFrames: true`, idempotent) that accepts one message `{type, nonce}` **only if** `event.source === window.parent` **and** `window.parent === window.top` (depth-1). (2) Ext injects into **frame 0** (ISOLATED): for each light-DOM `<iframe>` (enumerate) or the single element matched by the stored `frameLocator` (resolve), generate a fresh random nonce (`crypto.getRandomValues`, ≥ 128 bit) and `iframe.contentWindow.postMessage(msg, '*')`. (3) After a short bounded wait, Ext reads back from all frames (`allFrames: true`); the executeScript result's `frameId` + received nonce give the frameId ↔ element mapping |
| Exact-one | A mapping is valid only if a nonce was received by **exactly one** frameId and that frameId received **exactly one** nonce from this attempt. Anything else (none, duplicate, mismatch) → that element is `not_addressable` (enumerate) or `frame_missing` / `frame_ambiguous` (resolve). Never guessed from URL, size or order |
| Freshness | Nonces are per attempt, discarded after read-back; stale nonces from a previous attempt never count |
| Unchanged | R1 first; R2 live origin check in the resolved frame (`specialFrameProbe` origin === descriptor origin); depth-1 only; stable-attribute exact-one `frameLocator`; frameIds never leave the Ext; no fill / values; nested / Shadow DOM / non-HTTPS UNSUPPORTED messages |
| Payload | Nonce message carries no URLs, locators, values or secrets. Page scripts in the child frame may observe the nonce; they cannot forge `event.source === window.parent` from a sibling, and a forged claim still fails the R2 live origin check |
| Failure copy | `FRAME_CORRELATION_UNAVAILABLE_HE` is kept only for a real handshake failure (e.g. listener injection error). Its text must not blame the browser version: «לא ניתן לזהות את המסגרת בדף. נסו לרענן את הדף ולנתח שוב.» (exact-label rule applies) |
| Manifest / version | No manifest, permission or `minimum_chrome_version` change. **No Chrome-version requirement** for the iframe path (authoring or future 121.2) |
| Forbidden | `webNavigation`, `debugger`, `chrome.runtime.getFrameId`, URL / size / order matching, site / hostname / serviceId / fixture branches, 121.2 work |
| Evidence | Offline verify must **not** mock `getFrameId`; it must fail if `getFrameId` is referenced in the correlation path. Mock harness simulates handshake (incl. duplicate / missing / sibling-forged nonce). Live: L-1 re-run (Mizrahi, iframe `#iframeLogIn`, same-origin → A2, no prompt expected) + L-2 |

#### §4.11 SPECIAL editor action bar — plain-Hebrew copy + ACTIVATE confirmation (D-121-30, **OWNER APPROVED / AUTHORIZED** 2026-09-27)

| Current | New label (exact) | Explanation line (exact, shown under the bar) | Behavior |
|---|---|---|---|
| «בדוק Snapshot» | «בדוק שהטיוטה מלאה» | «בודק אם כל השלבים והשדות מוגדרים. לא משנה דבר באתר.» | Unchanged (preview only). Result copy: «הטיוטה מלאה ומוכנה להפעלה.» / «הטיוטה לא מלאה: <חסר>.» |
| «שמור טיוטה» | «שמור טיוטה» | «שומר את העבודה. המשתמשים לא מושפעים.» | Unchanged |
| «ACTIVATE SPECIAL» | «הפעל כניסה עם מסך צף» (label follows the selected pattern: «…עם מסך צף» / «…בכמה שלבים» / «…עם מסך צף בכמה שלבים») | «מחליף את המיפוי הרגיל בתהליך הזה עבור כל המשתמשים.» | **Confirmation dialog** before write: «להפעיל את תהליך הכניסה הזה לכל המשתמשים? מילוי אוטומטי לשירות זה יפעל רק אחרי השלמת שלב ההפעלה אצל המשתמשים.» buttons «הפעל» / «ביטול». Disabled while Snapshot is incomplete |
| «ACTIVATE STANDARD» | **Removed** from the SPECIAL editor (Owner 2026-09-27) | — | The return path is the natural Admin flow: set «אופי הכניסה» to the regular pattern → Analyze / Visual in the regular grid → the grid's existing activate. **Binding:** when the live contract is SPECIAL and the Admin activates from the regular grid, that activation carries the `SPECIAL_TO_STANDARD` transition intent (today it does not — code: only `activateStandard()` in the SPECIAL editor writes it, `AutofillProfileEditor` `activate_validated` does not). Confirmation dialog on that grid activation only in this case: «השירות פועל כרגע עם תהליך כניסה מיוחד. להחליף אותו במיפוי הרגיל לכל המשתמשים?» «החלף» / «ביטול». Contract / planner unchanged |

Rules: exact-label rule (D-121-23) applies to every message that names these buttons; no English in Admin-visible labels; no behavior change beyond the two confirmations and the incomplete-Snapshot disable. Contract / validator / ACTIVATE intent unchanged. No site-specific logic. No 121.2 work.

**Architect Review — D-121-30 CORRECTION (2026-09-27): FAIL — one required amendment (A3); everything else PASS.**
- PASS: exact labels per pattern; draft check preview-only; ACTIVATE SPECIAL disabled on incomplete draft + in-app confirm, cancel writes nothing, write unchanged; ACTIVATE STANDARD removed; grid return path with dialog + `SPECIAL_TO_STANDARD` intent; live STANDARD grid payload byte-identical; explanation line; old-label sweep; contract / validator / planner / merge / Ext / manifest untouched.
- Developer flag 1 (`canApprove` allowed when live SPECIAL even if already validated) — **accepted** (required for return path).
- Developer flag 2 (intent `loginUrl` = row `login_url`) — **accepted** (STANDARD profile origin validation unchanged in merge).
- Developer flag 3 (`SPECIAL_INVALID` treated as not SPECIAL) — **rejected → A3.** `resolveActiveLoginContract` fails closed on `SPECIAL_INVALID` (no STANDARD fallback) and `planActivate` explicitly accepts `SPECIAL_TO_STANDARD` as the recovery path from SPECIAL-with-missing-active / CORRUPT. With ACTIVATE STANDARD removed, the grid is the only return path, so treating `SPECIAL_INVALID` as STANDARD leaves such a service permanently without autofill.
- **A3 (binding):** the grid return path (dialog + `SPECIAL_TO_STANDARD` intent + `canApprove` relaxation) applies when the live contract is **not STANDARD** (`SPECIAL` **or** `SPECIAL_INVALID`). Dialog text unchanged. Live STANDARD unchanged (byte-identical, no dialog). Verify: live SPECIAL_INVALID (corrupt activation; missing active; version mismatch) → dialog + intent, planner accepts.

**Architect Re-review — D-121-30 A3 (2026-09-27): PASS.** `liveContractIsNotStandard` = resolved mode `!== 'STANDARD'` (SPECIAL + SPECIAL_INVALID); grid dialog, no-write guard, `SPECIAL_TO_STANDARD` intent and `canApprove` relaxation all driven by it (Architect code check); resolver / planner untouched; live STANDARD unchanged. Verify covers the 3 SPECIAL_INVALID reasons incl. planner acceptance and no-intent negative. **D-121-30 CLOSED.** Next: D-121-31 prompt may be issued.

#### §4.12 SPECIAL editor top buttons — busy indicator, plain labels, contextual manual pick (D-121-31, **OWNER APPROVED / AUTHORIZED** 2026-09-27 with Owner modification: always shown, enabled by pattern)

**Owner finding (2026-09-27, Mizrahi L-1):** (1) «נתח דף כניסה (משטח נוכחי)» shows no indication while running (code: only `disabled={busy}`); (2) the three labels are unclear; (3) «מיפוי חזותי — פותח» / «מיפוי חזותי — מעבר» were never needed — Owner completed the full Mizrahi flow with Analyze only. Code: both manual-pick buttons are always shown for every SPECIAL pattern, including «מעבר» on FLOATING_SCREEN where no intermediate transition exists.

| Item | Binding (exact copy) |
|---|---|
| Analyze label | «זהה כפתור ושדות באתר» |
| Analyze busy | While running (manual **and** auto-Analyze after continuation): button text «מזהה…», `aria-busy`, status line «מזהה כפתורים ושדות באתר. זה יכול לקחת כמה שניות…»; replaced by the result message when done; other bar buttons disabled as today |
| Manual opener pick | Label «סמנו בעצמכם את כפתור פתיחת המסך הצף» (Owner wording 2026-09-27). **Always shown; enabled only** when the selected «אופי הכניסה» is FLOATING_SCREEN or FLOATING_SCREEN_MULTI_STEP (Owner decision 2026-09-27) |
| Manual transition pick | Label «סמנו בעצמכם את כפתור המעבר בין השלבים» (Owner wording 2026-09-27). **Always shown; enabled only** when the selected «אופי הכניסה» is MULTI_STEP or FLOATING_SCREEN_MULTI_STEP |
| Analyze | Always shown; enabled for every SPECIAL pattern |
| Dynamic | Enablement recomputed immediately when the Admin changes «אופי הכניסה» (no save / reload needed). Existing `busy` / `canUseCurrentSurface` disabling still applies on top. If the pattern changes while a manual pick is armed for a now-irrelevant kind → disarm (same path as «ביטול») |
| Superseded | The earlier proposal "shown only after Analyze found nothing / after «דחה»" is **rejected by Owner** — not implemented |
| Waiting state | Existing «ממתין ללחיצה…» / «ביטול» / 60 s timeout unchanged; timeout messages name the new labels (exact-label rule D-121-23) |
| Unchanged | Analyze / Visual / click behavior, progressive approval, §5.2 proposal-vs-draft, iframe rules, contract. Pattern / state based only — no site / hostname / serviceId branches. No 121.2 work |

**Architect Review — D-121-31 CORRECTION (2026-09-27): PASS.** Owner labels exact (Architect code check), timeout texts updated, no old labels in `src/`; busy label / status line on manual + auto-Analyze; `manualPickRelevant` matrix matches §4.12; live recompute; armed irrelevant pick disarmed via «ביטול» path. **Developer decision accepted:** «אופי הכניסה» select stays usable only while an opener / transition pick is armed (needed for the disarm rule); stays disabled during Analyze, click, save / activate and field picks (field picks write to the selected step, which a pattern change resets). No Ext / manifest / contract change. **D-121-31 CLOSED.**

#### §4.13 Button-approval panel — single approval, feedback, plain labels (D-121-32, **OWNER APPROVED / AUTHORIZED** 2026-09-27)

**Owner finding (2026-09-27):** in «נמצא כפתור באתר», pressing «זה הכפתור הנכון» gives no feedback; purpose of «אשר לשימוש בהפעלה» / «דחה» / «פתח את מסך הכניסה» unclear; Owner skipped «אשר לשימוש בהפעלה» and "everything was fine". Code: `approvePendingAuthoring` / `approvePendingRuntime` set flags silently (no message, buttons stay enabled); the panel line «אושר לפתיחת המסך: כן · אושר לשימוש בהפעלה: כן» shows both flags were already set in an earlier session — so the skip was not a real test. `approvedForRuntime` **is required** by the validator (`actionNotApprovedForRuntime`) for the draft check / ACTIVATE.

| Item | Binding (exact copy) |
|---|---|
| Single approval | «זה הכפתור הנכון» sets **both** `approvedForAuthoringContinuation` and `approvedForRuntime` (contract flags and validator unchanged). «אשר לשימוש בהפעלה» button **removed** |
| Feedback | After approval: success message «הכפתור נבחר ונשמר בטיוטה. עכשיו לחצו «בדוק שהכפתור פותח את המסך».»; the approve button shows «הכפתור נבחר» and is disabled while the action stays approved |
| Status line | Replace «אושר לפתיחת המסך … · אושר לשימוש בהפעלה …» with «מצב: נבחר» / «מצב: ממתין לבחירה» |
| Reject | «דחה» → «זה לא הכפתור» (behavior unchanged: removes from draft, clears proposal) |
| Continuation click | «פתח את מסך הכניסה» → «בדוק שהכפתור פותח את המסך» → **amended by Owner 2026-09-27 (D-121-32a): «בדוק את הכפתור וזהה את השדות»** (the click also triggers field identification); success-message and all references updated accordingly (exact-label rule). Behavior unchanged (system clicks the approved button in the site tab, R3 readiness, auto-Analyze). Enabled only after approval. Helper line under the panel: «הבדיקה לוחצת על הכפתור באתר, מוודאת שמסך הכניסה נפתח, ומזהה את השדות שבו.» |
| Legacy drafts | Action with only one of the two flags → shown «מצב: ממתין לבחירה»; one press sets both |
| Exact-label rule | All messages that name these buttons updated (D-121-23); old-string sweep |
| Unchanged | Contract, validator, R3, iframe rules, §5.2, Ext. No site branches. No 121.2 work |

**Architect Review — D-121-32 CORRECTION (2026-09-27): PASS.** Old strings absent from `src/` (Architect grep); single approval sets both flags; feedback + disabled «הכפתור נבחר»; status line; «זה לא הכפתור»; «בדוק שהכפתור פותח את המסך» + helper line; legacy single-flag handled; contract / validator / R3 / iframe / Ext unchanged. Developer flags: (1) test button requires both flags — **accepted** (consistent with single approval; validator requires both anyway); (2) message choice by both flags — **accepted**; (3) frame-prompt «דחה» unchanged — **accepted** (outside §4.13); (4) validator text for continuation-only legacy drafts unchanged — **accepted, non-blocking** (one press clears it). **D-121-32 CLOSED.**

#### §4.14 Non-contract saves must not re-send login-contract keys (D-121-33, **OWNER APPROVED / AUTHORIZED** 2026-09-27)

**Owner finding (2026-09-27, Mizrahi):** save → page-level error «הפעלת חוזה SPECIAL (מפעיל + תוכנית פעילה) מותרת רק דרך loginContractActivateIntent.» (from `mergeLoginContractMetadata`, non-intent path). Code cause: general saves send the **whole** row metadata back (`RegistryAdmin` row «שמור» sends `metadata`; `SpecialLoginDraftEditor.saveDraft` spreads `row.metadata`). Once a SPECIAL draft exists, the stored `loginFlowPlan` bag carries an `active` key (even `null`), and possibly `loginContractActivation`; re-sending them unchanged is treated by the merge as an activation bypass → **every** later save of the service fails. Generic bug, not Mizrahi-specific; merge guard itself is correct.

| Rule | Binding |
|---|---|
| Ownership | Only the ACTIVATE paths (SPECIAL activate with intent; grid return with `SPECIAL_TO_STANDARD` intent) may send `loginContractActivation` / `loginFlowPlan.active` / intent. Every other writer is a **non-contract writer** |
| Non-contract writers | `RegistryAdmin` row save (global + user-owned), `AutofillProfileEditor` non-intent persist, any other metadata save: strip `loginContractActivation`, `loginFlowPlan`, `loginContractActivateIntent` from the outgoing metadata via one shared helper. Server merge "no contract key present" path keeps the existing values unchanged |
| Draft save | `saveDraft` sends `loginFlowPlan: { draft }` only, built from metadata with `loginContractActivation` and the existing bag stripped (no `active` key, no activation key) |
| Merge / planner | **Unchanged** — the bypass guard stays strict |
| Verify | Service with stored bag `{draft, active:null}`, with `{draft, active:<plan>}` + SPECIAL activation, and with SPECIAL_INVALID: row save, grid save and draft save all succeed and leave activation / active byte-identical; ACTIVATE paths unchanged; direct non-intent write of SPECIAL activation / active still rejected |
| Forbidden | Relaxing the merge guard; site branches; 121.2 work |

**Architect Review — D-121-33 BUG FIX (2026-09-27): PASS.** Shared `withoutLoginContractKeys()` applied to RegistryAdmin row save (create / user-owned / global), grid non-intent saves (incl. post-Admin-Test save), draft save (`loginFlowPlan: { draft }` only), icon / notes / Login-Intelligence writers; `updateUserOwnedRegistryRow` strips internally (no contract merge on that path — correct hardening). ACTIVATE paths and merge / planner / validator / Ext / manifest unchanged. Verify drives the real update functions + unchanged merge (root cause reproduced; 4 save types × states; guard negatives; ACTIVATE paths).
- **Exception accepted (state c, SPECIAL_INVALID):** «שמור טיוטה» refused by the merge consistency check (nothing written). Recovery = grid «החלף» (D-121-30 A3), then draft saves work. Acceptable: a broken live contract must be repaired before further SPECIAL authoring. **Non-blocking follow-up:** the refusal text «מצב מעורב אסור של מפעיל חוזה ותוכנית זרימה.» is technical; a later copy fix should say what to do.
- **Left-alone writers accepted:** `markGlobalLoginUrlInvalid` + 2 login-discovery RPC writers replace whole metadata from stored state (not rejected today; stripping would delete the contract). Not in scope.
**121.1 acceptance amended (Owner 2026-09-27): L-4 added — MULTI_STEP authoring** on any real site with username → «המשך/הבא» → password (Owner's choice; e.g. a Microsoft account login). Pass criteria: pattern «רב שלבי» enables transition pick, disables opener pick; Analyze on step 1 proposes the username field + transition button; Admin types the username **manually** in the site (authoring never fills values — expected); «זה הכפתור הנכון» → «בדוק את הכפתור וזהה את השדות» → password field identified on step 2 (or «המסך לא נפתח» if the site did not advance — then advance manually and Analyze step 2); save / reload / «בדוק שהטיוטה מלאה». No ACTIVATE. Runtime multi-step = 121.3.

**D-121-33 CLOSED.** State-c exception = **Architect decision: accepted as final** (no merge change).
**Architect Review — D-121-32a (2026-09-27): PASS.** Label «בדוק את הכפתור וזהה את השדות» + all 6 messages (Architect grep); old string absent; behavior / gating unchanged. **CLOSED.**

#### §4.15 Test-then-choose + no replacement of the tested button (D-121-34, **OWNER APPROVED / AUTHORIZED** 2026-09-27)

**Owner finding (2026-09-27, Mizrahi):** after «בדוק את הכפתור וזהה את השדות» succeeds, auto-Analyze (`after_continue`) proposes an unrelated main-page element (`div[aria-label="IPB Center TLV"]`, `floating_opener`) and the panel **replaces** the tested `#logInBtn` with it («מצב: ממתין לבחירה»). The tested button stays approved in the draft but disappears from view. Owner also expects the natural order **test first, then choose** — approving before testing feels wrong. (Earlier non-blocking finding promoted to blocking UX.)

| Rule | Binding |
|---|---|
| Test-then-choose | Panel buttons: «בדוק את הכפתור וזהה את השדות» and «זה לא הכפתור». «זה הכפתור הנכון» **removed**. Pressing «בדוק…» on the displayed proposal **is** the explicit Admin consent to click that single element (sets `approvedForAuthoringContinuation` for that action only, then clicks). R3 success → also sets `approvedForRuntime`; status «מצב: נבדק ונבחר — המסך נפתח». R3 failure → both flags cleared for that action, status «מצב: לא נבחר — המסך לא נפתח», message «המסך לא נפתח». Contract flags / validator unchanged (a stored runtime-approved action has therefore always passed a live test) |
| No replacement | After a successful test the tested action **stays** in the panel with its status. Auto-Analyze never proposes another action of the **same kind on the same surface (frame)** as the tested one. New action proposals come only from the **revealed** surface and only of kinds the selected pattern needs (e.g. transition for multi-step); they appear in a **separate** panel «נמצא כפתור נוסף» with the same two buttons |
| Legacy | Already approved actions (both flags) show «מצב: נבחר» with «בדוק…» still available for re-test; re-test failure clears flags as above |
| Exact-label rule | All messages naming «זה הכפתור הנכון» updated (e.g. «לחצו «בדוק את הכפתור וזהה את השדות»»); old-string sweep |
| Unchanged | Ext click gate (still requires the continuation flag in the message), R3, iframe rules, §5.2 (proposals enter the draft only by the Admin's test press), contract. No site branches. No 121.2 work |

**Owner live (2026-09-27, PAGI):** frame-approval prompt «…בתוך מסגרת של האתר https://online.pagi.co.il. לאשר שימוש במסגרת זו…» shown — **expected R2 behavior**: credential iframe on a different origin (subdomain) than the entry origin → explicit «אשר מסגרת» required (A2 auto-approves identical origin only; Mizrahi iframe was same-origin). PAGI therefore proves the **R2 explicit-approval path**; Super-Pharm (floating screen, no prompt) is the candidate **top-document** proof for L-2 pending Owner confirmation of «בדף הראשי» labels.

**Owner live (2026-09-27, PAGI) — finding: synthetic click does not open the floating screen.** Opener located correctly (Analyze and manual pick agree on the same locator), but «בדוק את הכפתור וזהה את השדות» → screen does not open. When the Owner clicked the site button by hand during the readiness window, fields were identified immediately. Code: Ext click = `element.click()` in MAIN world (click event only, `isTrusted=false`). Hypotheses: **P1** site opens on `pointerdown` / `mousedown` / `pointerup` (not `click`); **P2** site requires `isTrusted` events (cannot be satisfied without `debugger` — forbidden); **P3** handler on a different element than the located one. **Side finding:** a human click inside the R3 window can make the test "pass" — the test proves the screen opened, not that the synthetic click opened it; must be addressed in the fix design (e.g. require the reveal to follow the Ext click without a user gesture, or label such results). Owner console diagnostic requested (plain `click()` vs full pointer / mouse sequence). No fix until diagnosed; any fix generic.

**Diagnostic result (2026-09-27):** locator `a[aria-label="גישה ישירה לכפתור כניסה לחשבונך"]`. Both plain `click()` and the full pointer / mouse sequence reached the site's handler (`smoothScrollingTo` on `HTMLAnchorElement`, throws `reading 'top'`), screen not opened. ⇒ **P1 / P2 ruled out for this case** (synthetic events are delivered and handled). **P3 confirmed:** the located element is an accessibility *skip link* (in-page anchor that scrolls / moves focus to the real login button), not the opener. Generic gap: opener candidate selection (Analyze, and apparently Visual pick promotion) accepts skip-link anchors. Pending: element facts (href, size / visibility) + real button identity, and how the Visual pick landed on the same element.

**Real opener identified (Owner Inspect, 2026-09-27):** `<a class="login-trigger" href="#" role="button" data-target="#login" data-toggle="modal">` (Bootstrap-style modal trigger). No `id` / `name` / `aria-label`.

**Architect code read — root causes (generic, not PAGI-specific):**
- **G1 (locator vocabulary).** `buildCandidates` (both `page-structure-inspect.js` and `visual-target-pick.js`) emits only `id` / `name` / `autocomplete` / `aria-label`. An element with none of these gets **no locator** → `collectSpecialAuthoringActionCandidates` skips it (`if (!candidates.length) continue`). The real opener is invisible to Analyze; the skip link (has `aria-label`) is the only login-looking candidate → proposed.
- **G2 (manual action pick uses the field picker).** `visualPickAction` → `startCurrentTabVisualMapping({fieldId:'action:…'})` → `armVisualTargetPick`, whose `isIdentifiableControl` accepts **only `input` / `textarea`**. A click on a button / link returns `unsupported_target`; the manual opener pick cannot succeed for any real button. The Owner's "found successfully" was most likely the earlier Analyze panel still displayed. (Same applies to the transition pick.)
- **G3 (no skip-link / non-opener filtering).** In-page skip / anchor links are accepted as opener candidates.
- **G4 (test-proof integrity).** R3 success can be caused by a human click during the readiness window (side finding above).
- Synthetic `click()` itself reached the site's jQuery handler ⇒ event delivery is not the problem for this site.

Next: Owner console check that a synthetic `click()` on the real opener opens the screen (confirms G1–G3 fix is sufficient), then D-121-35 design for Owner approval.

**Console check result (2026-09-27):** `a[data-toggle="modal"][data-target="#login"]` → exactly **1** match; synthetic `.click()` → **floating screen opened**. ⇒ Synthetic click is sufficient; fix is in identification / pick only (G1–G4).

#### D-121-35 (OWNER APPROVED / AUTHORIZED 2026-09-27) — generic opener / transition identification

Scope: 121.1 authoring only. No manifest / permission change; no site / hostname / serviceId branches; `final_submit` stays reserved; fail-closed origin / frame rules (§4.10 / §4.10.1) unchanged.

1. **Locator vocabulary (G1).** Extend the shared candidate builder with generic, text-free strategies **appended after** the existing `id` / `name` / `autocomplete` / `aria-label` (field locators keep their current first choice). Allowed additions, in order:
   - test / automation attributes: `data-testid`, `data-test`, `data-qa`, `data-cy`;
   - popup / target semantics: `aria-controls`; `data-target` / `data-bs-target` combined with `data-toggle` / `data-bs-toggle` when present;
   - `href` when it is a real path (not empty, not `#`, not `javascript:`);
   - `tag.class` combinations using only non-generated class names (reject hashed / numeric-looking classes);
   - `role` combined with one of the above.
   Every locator must be **exact-one** and pass the identity check (resolves to the observed / clicked element). Never text-content, never positional (`nth-child`), never XPath.
2. **Action pick mode (G2).** A dedicated SPECIAL pick mode for opener / transition: resolve the clicked target to the nearest actionable ancestor (`button`, `a`, `[role="button"]`, `input[type=button|submit]`); build the locator per 1; exact-one + identity; visible. The click is still swallowed during picking (the screen does not open while picking). Field picking unchanged (input / textarea only).
3. **Skip-link filter (G3).** Exclude from opener / transition candidates any anchor whose `href` is a same-page fragment `#<id>` that resolves to an existing element **and** has no popup semantics (`aria-haspopup`, `aria-controls`, `aria-expanded`, `data-toggle` / `data-bs-toggle`, `data-target` / `data-bs-target`). `href="#"` alone is not a skip link. Candidates with popup semantics rank first.
4. **Test-proof integrity (G4).** During «בדוק את הכפתור וזהה את השדות», observe trusted user gestures (`isTrusted` pointerdown / keydown) in the tab's frames from the Ext click until readiness. If a user gesture occurred before readiness → result **not proven**: button not marked selected; message «נראה שלחצת בעצמך באתר בזמן הבדיקה. סגרו את המסך ולחצו שוב על "בדוק את הכפתור וזהה את השדות" בלי ללחוץ באתר.» Listeners removed after the window; nothing stored.

**Architect Review — D-121-35 (2026-09-28): PASS (offline).** Read: `locator-determinism.js` (`actionLocatorCandidates` order = §1; `isStableClassName`; `isRealPathHref` rejects any `#…`; `isSkipLink` per §3; `resolveActionableTarget`; `chooseDeterministicLocator` exact-one + identity), `visual-target-pick.js` action branch (visible → skip-link reject → action candidates), `page-structure-inspect.js` (skip filter, deterministic choice, popup-first ordering), `background.js` G4 (install before click fails closed on install error; per-tick refresh for late frames; collect removes listeners; verdict downgrades only successes). Developer decisions 1–6 **accepted**; the two button-pick messages accepted as worded. Residual (accepted, noted): a gesture inside a frame that reloads before collect is not counted; frames the extension cannot script are not observed (§4.10 already rejects such frames for authoring). Verify evidence: new script 24/24 + mutation checks, Phase 116–121 26/26, typecheck + build 0. Remaining: Owner live checks 1–5 below.

**Owner live (2026-09-28):** check 1 PASS (real opener proposed; Ext test opens screen, fields identified); check 2 PASS (manual opener pick succeeds, screen does not open during pick); check 4 PASS (earlier bank fixture unchanged); check 5 PASS (STANDARD field Visual pick unchanged). Check 3 was run as a manual pick on a non-button element → «לא ניתן לזהות את הכפתור שנבחר…» (correct G2 behavior, extra evidence) — the G4 "click during test → not proven" check is still **pending**.

**Check 3 re-run (2026-09-28):** Owner clicked blank page area during the test → «המסגרת שייכת כעת לאתר אחר (‎‎) — הפעולה נחסמה.» (empty origin). Interpretation: a click on the modal backdrop closes the floating screen → declared-readiness frame gone / blank → `resolveDeclaredFrame` fails closed before any success exists (G4 verdict only downgrades successes). Behavior safe (button not selected) but G4 not exercised. Re-run with a gesture that does not close the screen (key press on the site tab). **Backlog (copy):** when the live frame origin is empty, the message should say the frame closed / was not found, not «שייכת לאתר אחר ()».

**Correction (Owner, 2026-09-28):** on PAGI the backdrop is inert and does not close the screen → backdrop hypothesis **withdrawn**. Architect code read: `specialDeclaredReadinessMet` → `resolveDeclaredFrame` → `specialFrameProbe`; if the declared frame element exists but its document is **not yet navigated** (still `about:blank` / initial, origin empty or `"null"`), `p.origin !== descriptor.frameOrigin` → hard `frame_origin_mismatch` with empty `liveOrigin` → test ends immediately. Only `frame_missing` is treated as "not yet". ⇒ **Race bug (generic):** a loading frame is treated as a foreign frame. Independent of the Owner's click; appears once readiness is **declared** in a frame (after fields were saved), which explains why check 1 (reveal mode) passed.

#### D-121-36 (OWNER APPROVED / AUTHORIZED 2026-09-28) — declared-frame readiness: loading ≠ foreign
1. During readiness polling only: a live frame origin that is empty, `"null"`, or non-HTTP(S) (`about:` initial document) = **not yet ready** → keep polling until the readiness timeout (same as `frame_missing`). A **different real HTTPS origin** stays a hard fail (`frame_origin_mismatch`). Timeout → fail. Non-polling uses of `resolveDeclaredFrame` (pick, click frame resolution) unchanged.
2. Copy: when `liveOrigin` is empty / `"null"`, never render «שייכת כעת לאתר אחר ()»; use «המסגרת עדיין לא נטענה או נסגרה — נסו שוב.»
3. Offline fixture: frame blank → then correct origin → readiness met; frame blank → other HTTPS origin → hard fail; frame stays blank → timeout fail.
Constraints: fail-closed preserved; no manifest change; no site branches.

**Architect Review — D-121-36 (2026-09-28): PASS (offline).** `resolveDeclaredFrame(…, {loadingIsPending})` opt-in, passed only by `specialDeclaredReadinessMet`; `specialIsLoadingFrameDocument` (empty / `"null"` origin or non-http(s) protocol) → `frame_loading` → treated as not-yet (like `frame_missing`); real different HTTPS origin → hard `frame_origin_mismatch` carrying `liveOrigin`; timeout unchanged; non-polling callers unchanged. `checkIn` protocol-aware (inherited-origin `about:blank` counted as loading). Copy for empty / `"null"` origin = «המסגרת עדיין לא נטענה או נסגרה — נסו שוב.» Developer decisions (protocol detection; pass-through `liveOrigin`) accepted. Evidence: new script 13/13 + 5 mutations, Phase 116–121 27/27, typecheck + build 0. Pending Owner live (a) declared-frame test success, (b) Shift → not proven (closes D-121-35 G4), (c) bank regression.

**Owner live (2026-09-28):** (a) PASS, (b) PASS (exact not-proven message, button not selected), (c) PASS. ⇒ **D-121-35 CLOSED** (all live checks incl. G4) and **D-121-36 CLOSED**.

**Owner live (2026-09-28) — L-1 finish on PAGI:** «בדוק שהטיוטה מלאה» → "no message change"; visible message stayed «שדות הכניסה זוהו. בדקו ושמרו טיוטה.» Architect code read: `validateSnapshot` sets only `snapshotNote`, rendered as a small gray `admin-muted` line **above** the previous `success` message, which is **not cleared** → the result is easy to miss and the stale green message looks like the answer; a repeat press with the same result changes nothing visible. UX defect (generic).

#### D-121-37 (OWNER APPROVED / AUTHORIZED 2026-09-28) — «בדוק שהטיוטה מלאה» result feedback
1. On press: clear previous `success` / `error` / `snapshotNote`.
2. Complete → show «הטיוטה מלאה ומוכנה להפעלה.» as the green status message (`admin-success`, `role="status"`).
3. Incomplete → show «הטיוטה לא מלאה: …» as the red alert (`admin-error`, `role="alert"`).
4. Re-press with same result must visibly re-render (e.g. clear then set on next tick) so the Admin sees the check ran.
No logic change to `checkSpecialDraft`; ACTIVATE gate unchanged.

**Architect Review — D-121-37 (2026-09-28): PASS (offline).** `validateSnapshot`: A1 normalization kept → clear success / error → token-guarded next-tick set (complete → `admin-success`, incomplete → `admin-error`); `snapshotNote` removed (sole writer). Logic / ACTIVATE gate untouched. Evidence: ActionBar verify extended + 2 mutations; 27/27; typecheck + build 0. Note: a 0 ms gap may be barely perceptible on re-press — if the Owner cannot see the re-render, extend the gap (UI-only follow-up). Pending Owner live check.

**Owner live (2026-09-28):** «הטיוטה מלאה ומוכנה להפעלה.» shown (green) on press, on re-press and after other buttons → **D-121-37 CLOSED**. Also closes **L-1 finish** (PAGI: saved draft reloaded → draft check complete).

#### D-121-38 (OWNER APPROVED / AUTHORIZED 2026-09-28) — unified Admin Test grid «בדיקת מילוי» (all login patterns)

Owner requirement: fill testing in Admin lives in **one** place for every service regardless of login pattern — mirroring Digital Home (one "fill" entry for the user). The test harness now inside «מילוי אוטומטי מנוהל» (`AutofillProfileEditor.tsx` `data-section="managed-test-harness"`: temp values + «כניסה לאתר ומילוי שדות» + outcome) moves to a **separate grid**. Owner chose to authorize 121.2 together (runtime for SPECIAL tests).

| Item | Binding |
|---|---|
| Placement | New top-level grid «בדיקת מילוי» in Registry Admin, sibling of «אופי הכניסה» and «מילוי אוטומטי מנוהל»; shown for **every** service. The managed-test harness is **removed** from «מילוי אוטומטי מנוהל» (no duplicate) |
| Temp values | One set of temporary inputs per service `login_fields` (same for all patterns); in-memory only, never persisted, never logged (unchanged rules) |
| Plan context selector | Options shown only when they exist: «מיפוי רגיל (שמור)» → saved `autofillProfile`; «טיוטת כניסה מיוחדת» → immutable DRAFT snapshot (§8.3); «כניסה מיוחדת פעילה» → ACTIVE `loginFlowPlan`. Default = what users get today (live contract per `resolveActiveLoginContract`); SPECIAL_INVALID → no SPECIAL-active option, fail-closed message |
| STANDARD route | Exactly today's Phase 120 path (`executeAdminManagedAutofillTest`), same guards (saved profile ready, all temps filled, no unsaved changes in the managed grid — dirty state must be observable by the new grid), same success stamp (`stampAdminTestPassed` → `autofillProfile.fieldAuthoring`, contract-safe per D-121-33), same messages / A2 diagnostics. Byte-level behavior unchanged; only location changes |
| SPECIAL route | 121.2 shared orchestrator (§8.1–§8.3): open / reuse tab → approved opener click → R3 readiness → Phase 120 Ext `runManagedAutofill` on the declared frame (§4.10 runtime; R2 re-validated from the **plan document**, not from the message) → STOP before final authentication. No write to `autofillProfile`; no ACTIVATE side-effect; DRAFT snapshot immutable for the run. Until 121.2-impl exists the SPECIAL options are **visible but disabled** with «בדיקת מילוי לכניסה מיוחדת תופעל בקרוב.» |
| Same engine | Digital Home FLOATING_SCREEN (ACTIVE only) uses the **same** orchestrator (121.2). No Admin-only engine |
| Forbidden | Changing Phase 120 fill / verify semantics or `executeManagedAutofill` eligibility; persisting temp credentials; site / hostname / serviceId branches; `final_submit`; MULTI_STEP runtime (121.3) |

Delivery: **Part A (UI relocation, STANDARD route + disabled SPECIAL options)** → Developer now (after D-121-37). **Part B (SPECIAL route = 121.2 runtime incl. Digital Home)** → Manager DD «121.2» → Architecture review → Developer.

**Architect Review — D-121-38 Part A (2026-09-28): PASS (offline).** New `AdminFillTestGrid.tsx` + `fillTestContext.ts`: options only when the plan exists; default per `resolveActiveLoginContract` (SPECIAL → active; STANDARD → saved; SPECIAL_INVALID → no active option + note, fallback to first available option — accepted, Admin-only); STANDARD route = same `executeAdminManagedAutofillTest` / guards / A2 / `stampAdminTestPassed` via contract-safe write; managed-grid dirty / busy state shared; SPECIAL run disabled with exact text; harness removed from managed grid. Developer decisions (stamp source via shared state; selector label «מול איזו הגדרת כניסה לבדוק»; SPECIAL_INVALID note; placement = where sibling grids render) accepted. Evidence: new verify + 5 mutations; 28/28; tsc + build 0. Pending Owner live (a) STANDARD, (b) SPECIAL-draft. A4 satisfied for 121.2-impl once Owner (a) passes. **Owner live (a) STANDARD (Shufersal, 2026-09-28): PASS** — grid shown with «מיפוי רגיל (שמור)»; test runs as before; harness absent from managed grid; unsaved managed edit disables the run and shows the dirty line. **Backlog (UX, Owner):** the dirty line (`admin-muted`) is not visible enough — raise prominence (e.g. warning / alert style) in a later UI slice. (b) PAGI (2026-09-28): «טיוטת כניסה מיוחדת» selectable ✔; run button **enabled**, press → «האתר נפתח. מילוי אוטומטי לא זמין כרגע — ניתן למלא את השדות ידנית.» Interpretation: localhost Hub already serves in-progress 121.2-impl (SPECIAL route wired) while the loaded extension is the pre-121.2 build (no `HUB_SPECIAL_LOGIN_FLOW`) → A3 path (extension_unavailable-class, open-only, no fallback fill) — correct fail-closed behavior. Part A "disabled" state superseded by 121.2 (Owner: disabled state not needed). Re-check after 121.2-impl report with the extension reloaded. **Owner request (2026-09-28): start 121.2-impl before the live checks — accepted** (offline PASS satisfies A4); Owner runs (a)/(b) in parallel; any Part A live defect is fixed first and 121.2 work pauses for it.

**Architect Review — Manager DD «121.2» (2026-09-28): PASS with binding amendments A1–A4.** Checked against §8.1–§8.4, §4.10 / §4.10.1, D-121-35/36/38, §12.1, forbidden lists: one Hub entry + one Ext orchestrator for Admin Test and DH ✔ · STANDARD `executeManagedAutofill` / eligibility / `runManagedAutofillOnTab` and Ext fill files byte-identical; only injection frame differs (existing `allowedOrigin` option = in-document origin re-check) ✔ · R1 before click ✔ · R2 targets only from the validated plan + live exact-one / depth-1 / origin before click and every fill attempt; credentials only to a just-verified document ✔ · R3 declared, bounded, D-121-36 applied ✔ · exactly one click, STOP before final auth, no-submit counters ✔ · DRAFT snapshot once / frozen; zero metadata writes ✔ · DH SPECIAL_INVALID fail-closed, no fallback ✔ · FLOATING_SCREEN-only runtime gate; `final_submit` rejected ✔ · no manifest / webNavigation / debugger / getFrameId; grep gate ✔ · verify plan with parity, tamper, swap, mutation checks ✔.

**Answers to DD RT-10 questions:**
1. Fresh tab for both surfaces — **confirmed**.
2. SPECIAL / SPECIAL_INVALID check before the legacy site-adapter block — **confirmed** (§12.1 no fallback).
3. Gesture watch as evidence in both paths, flow unchanged — **confirmed**, with A2.
4. Credentials required for every **mapped** fieldId only; no coverage requirement on `login_fields` — **confirmed** (no validator / ACTIVATE change). The grid's SPECIAL route requires temp values only for mapped fields.
5. DH SPECIAL_INVALID → open entry, no fill — **confirmed**.
6. Top-document credential fields: offline RT-F-TOP required; live proof **required before 121.2 closure** on the first FLOATING_SCREEN fixture whose fields are «בדף הראשי» (candidate Super-Pharm via 121.1 L-2). Not a blocker for 121.2-impl start.

**Binding amendments:**
- **A1 — Production DB safety (live steps).** localhost uses the production DB. The DD's L-RT-1/2 step 4 (ACTIVATE) and step 5 (DH ACTIVE) are **not** to be executed as written. Live 121.2 validation = Admin Test **DRAFT** only. ACTIVE-path and DH live checks require a separate explicit Owner decision at that time (e.g. a dedicated non-public test service, or a timed ACTIVATE + immediate return via grid «החלף»). ACTIVE / DH behavior is proven offline (RT-DH-ROUTE, RT-PARITY) until then.
- **A2 — Admin Test evidence fail-closed.** In the Admin Test presentation, `userGestureDuringRun === true` **or** absent (watch not installed / not collected) → «לא הוכח…», never success (parity with D-121-35 G4). DH unaffected (evidence only).
- **A3 — Extension version skew.** If the extension does not recognize `HUB_SPECIAL_LOGIN_FLOW` (no handler / no response / unknown-type reply / timeout) → fail closed as `extension_unavailable`-class: DH opens the entry only with end-user copy; **never** falls back to STANDARD / Managed / Generic fill.
- **A4 — Prerequisite.** 121.2-impl starts only after **D-121-38 Part A Architecture PASS**. Developer STOPs otherwise.

**121.2-impl BLOCKED (Developer CALL OUT, 2026-09-28) — confirmed by Architect code read.** `validated-autofill.js` `assessManagedTargetsReady` rejects any non-top document first (`if (root.top && root.top !== root) return {ready:false, reason:'not_top_frame'}`; header "Top document only"). §4.10 "Runtime" and DD RT-4.1 step 6 wrongly assumed "only the injection frame differs" — **Architect error** (the frozen runner has an explicit top-frame gate). Unchanged runner can fill only top-document fields; both live fixtures have iframe fields. Developer's other findings accepted: cross-origin redirect before load → `tab_load_timeout` (safe, no click; RT-F-R1 proves the post-load case only); old extension replies `unknown_message` → A3 class.

#### D-121-39 (OWNER APPROVED / AUTHORIZED 2026-09-28) — opt-in declared-frame mode in the Phase 120 runner (amends RT-1.2 / RT-4.3 / §4.10 Runtime)

One fill engine stays (Owner choice over a separate SPECIAL runner or top-only scope).

| Item | Binding |
|---|---|
| Change | `runManagedAutofill` / `assessManagedTargetsReady` accept an **optional** `frameContext: { mode: 'declared_depth1' }`. Only when present: the `not_top_frame` gate is replaced by — document is **not** top (`root.top !== root`) **and** depth-1 (`root.parent === root.top`); origin check `root.location.origin === allowedOrigin` unchanged (caller passes the plan `frameOrigin`). `frameContext` present while running in the top document → fail `frame_context_mismatch`. Every other readiness / fill / verify / diagnostics rule identical |
| Default | Option absent (all STANDARD callers, `runManagedAutofillOnTab`, `openPageAndManagedAutofill`, readiness probe) → behavior **byte-identical** to today, incl. `not_top_frame` |
| Who may set it | Only the Ext SPECIAL orchestrator, **after** `resolveDeclaredFrame(…, {loadingIsPending})` resolved the frame from the plan descriptor and the live origin matched. Never taken from a Hub message field; Hub cannot request it |
| Audit | Developer must audit `validated-autofill.js` (incl. A2 / A2.4 observers) and `fill-executor.js` for any other top-only assumption (`top`, `parent`, `frameElement`, top navigation). Any further change beyond the gate → **STOP** and report |
| Files | `validated-autofill.js` may change **only** for this option (diff limited to the gate + option plumbing). `fill-executor.js`, `managed-target-eligibility.js`, manifest stay byte-identical |
| Verify | STANDARD parity: existing Phase 117/120 runner verifies unchanged and PASS; new cases — option absent in iframe → `not_top_frame`; option present in depth-1 frame → fills; option present in depth-2 → rejected; option present in top → `frame_context_mismatch`; wrong origin in frame → `wrong_origin`. Mutation: drop depth-1 check → caught |
| Unchanged | R1 / R2 / R3, credentials only to a just-verified document, STOP before final auth, A1–A4, FLOATING_SCREEN only, no manifest / webNavigation / debugger / getFrameId, no site branches |

**Architect Review — 121.2-impl + D-121-39 (2026-09-28): PASS (offline).** Read: `validated-autofill.js` gate — `frameContext` present → must be `declared_depth1` in a non-top document (else `frame_context_mismatch`), parent === top (else `frame_not_depth1`), origin check unchanged; absent → original `not_top_frame` (diff = gate + 2 header lines, hash-pinned). `background.js` orchestrator fill: per attempt `resolveDeclaredFrame(…, {loadingIsPending})` → `allowedOrigin = plan frameOrigin` → `frameContext` set only for non-zero frameId → unchanged runner in `frameIds:[resolved]`; in-document origin re-check closes the resolve→inject race. Audit (item 3) clean accepted. RT-2…RT-6, A1–A4 evidence accepted (parity 14 plans; STANDARD hash-pinned + 9-service routing parity; A2 success only with verified fill and `userGestureDuringRun === false`; A3 incl. `unknown_message` / no response / timeout). Evidence: runtime verify 35 checks / 12 mutations; 29/29; tsc + build 0; lint clean. **Backlog (minor):** pre-load cross-origin redirect → ~2 min `tab_load_timeout` and the Ext tab remains next to the Hub-opened site tab (duplicate tab) — tidy in a later slice. Pending Owner live (DRAFT only): L-RT Mizrahi, PAGI, gesture, unsaved draft, STANDARD regression.

**Owner live 121.2 (2026-09-28, DRAFT only):** (1) Mizrahi-Tefahot — floating screen opened by itself, iframe fields filled, no login click, «המילוי הושלם…» ✔ PASS. (2) PAGI ✔ PASS. (3) Gesture — Owner pressed before the screen opened; fill succeeded and the result was shown as success (no «לא הוכח»). Engine unaffected (by design). Label result **inconclusive**: the watch runs from the opener click until readiness; a key press before the click or while focus was in another tab is outside the window. Owner: acceptable; not blocking — re-verify opportunistically. (4) Unsaved-draft block — not executable live (authored fields render as read-only labels); covered offline — accepted. (5) STANDARD Admin Test + Digital Home tile ✔ PASS. **Finding:** the grid's SPECIAL result shows the full A2 diagnostics JSON under the success message.

#### D-121-40 (OWNER APPROVED / AUTHORIZED 2026-09-28) — technical details collapsed in «בדיקת מילוי»
Result area shows only the plain-Hebrew outcome (+ short context line: «טיוטה» / «פעילה», version, time). The detail line (stage · reason · locator · frame), snapshot id and A2 diagnostics JSON move into a collapsed «פרטים טכניים» section (closed by default; opens on click; `<details>`-style). No content removed; no credential values (unchanged). Applies to SPECIAL results; STANDARD route unchanged.

**Architect Review — D-121-40 (2026-09-28): PASS (offline).** New `SpecialTestResultView.tsx`: outcome message (success → `admin-success`, else `admin-error`) + one context line (טיוטה / פעילה · גרסה · time); detail line, snapshot id, A2 JSON inside `<details>` «פרטים טכניים» (closed by default); presentation / A2 rules unchanged; STANDARD block untouched. Evidence: FillTestGrid verify §9 (3 cases), 29/29, tsc + build 0. Pending Owner live check.

**Owner live (2026-09-28):** D-121-40 PASS (message + short line only; «פרטים טכניים» opens on click; STANDARD unchanged) → **D-121-40 CLOSED**. **Owner decision — A1 lifted:** no real end users exist yet (test stage), so ACTIVE / Digital Home live checks on the production DB are allowed. **Owner live Digital Home:** Mizrahi-Tefahot and PAGI floating-screen fill from Digital Home ✔ PASS (ACTIVE SPECIAL via the shared 121.2 orchestrator); STANDARD services in Digital Home ✔ PASS. Remaining for 121.2 closure: top-document credential-field live proof (Q6) — Super-Pharm (FLOATING_SCREEN) candidate; Owner reports a Super-Pharm bug (pending).

**Owner live (2026-09-28) — Super-Pharm regression after D-121-35.** Super-Pharm = FLOATING_SCREEN (field location — top vs frame — not yet observed). Opener = top-bar link «הרשמה / התחברות». Analyze now proposes `#cart-group` (shopping-cart popup; the test press opens the cart); the login link is not proposed; manual opener pick of the link does not succeed. Worked before D-121-35. Likely generic causes (to confirm with element HTML): **(i)** G3 skip-link rule too broad — an anchor `href="#<id>"` whose target is a hidden modal/dialog is an opener, not a skip link; the same rule is enforced in the manual pick; **(ii)** popup-semantics ranking lifts generic popups (cart) over the login link. **Owner policy (binding):** the Admin is trusted — manual picking must allow any element the Admin clicks (links included); restrictions / heuristics apply only to automated proposals (Analyze / future AI). Exact-one + identity remain (needed to click deterministically at runtime) and the test-then-choose check still proves the choice. Design D-121-41 after the element HTML is seen.

**Element (Owner Inspect):** `<a href="#tologin-form-container" id="loginAnchor">התחברות</a>`; manual pick → «האלמנט שנבחר הוא קישור דילוג בתוך הדף ולא כפתור שפותח מסך…». ⇒ Cause (i) **confirmed**: `isSkipLink` (fragment → existing element, no popup attrs) excludes it in Analyze **and** rejects it in the action pick. It has `id` → exact-one locator `#loginAnchor` exists.

#### D-121-41 (OWNER APPROVED / AUTHORIZED 2026-09-28) — Admin manual pick unrestricted; skip-link rule narrowed to Analyze
1. **Manual action pick (Admin-trusted):** no skip-link rejection; the message «האלמנט שנבחר הוא קישור דילוג…» is removed. Target = nearest actionable ancestor if one exists, otherwise the clicked element itself (any visible element). Exact-one + identity locator still required (runtime determinism); «לא ניתן לזהות את הכפתור שנבחר…» only when no deterministic locator exists.
2. **Analyze (automated proposals):** an anchor `#<id>` counts as a skip link only when the target is **visible in-page content** — rendered (not `display:none` / `visibility:hidden` / zero-size / `hidden` / `aria-hidden="true"`) **and** not a dialog (`<dialog>`, `role="dialog"|"alertdialog"`, `aria-modal="true"`). Hidden / dialog targets (modal containers) → opener candidates. Ranking unchanged (label confidence first; popup attrs tie-break only).
3. Verify (synthetic): anchor → hidden modal container kept in Analyze; anchor → visible content excluded in Analyze; manual pick accepts both; manual pick of a non-actionable visible element with a deterministic locator accepted; prior PAGI-shape (skip link → visible real button) still excluded in Analyze; D-121-35 G1/G2/G4 cases unchanged.
No extension permission / manifest change; no site branches; runtime / 121.2 unchanged.

**Architect Review — D-121-41 (2026-09-28): PASS (offline).** `isSkipLink` now requires the fragment target to be visible in-page content (`isVisibleInPageContent`; hidden / zero-size / dialog incl. ancestors → not a skip link); action pick: skip-link rejection and its Hub message removed; nearest actionable ancestor else clicked element; id first, exact-one + identity kept. Developer decisions 1–4 accepted (ancestor check only widens Analyze; `html` / `body` → «לא ניתן לזהות…»; visibility check retained; two D-121-35 assertions updated to D-121-41 behavior). Evidence: opener verify 32/32 (+8 D-121-41), runtime verify PASS, 29/29, tsc + build 0. Pending Owner live (a) Super-Pharm, (b) PAGI + Mizrahi, (c) Super-Pharm draft fill test.

**Owner live — D-121-41 (2026-09-28): PASS.** (a) Super-Pharm: Analyze proposes the login link (not the cart); test opens the screen and identifies fields; manual pick of the link succeeds. (b) PAGI + Mizrahi unchanged. (c) Super-Pharm draft «בדיקת מילוי» fills the fields. **D-121-41 CLOSED.** Open for 121.2 closure: Super-Pharm field location (top document vs frame) not yet reported — needed for the top-document credential-field live proof (Q6).

**Owner live — Q6 (2026-09-28): PASS.** Super-Pharm credential fields are identified «בדף הראשי» (top document); the SPECIAL draft fill via the shared 121.2 orchestrator (frameId 0, no `frameContext`) fills them (item (c) above). Top-document live proof satisfied. With Mizrahi / PAGI (frame, Admin + Digital Home) and STANDARD parity already PASS, **121.2 CLOSED (2026-09-28).** 121.3+ NOT AUTHORIZED. Same evidence closes **121.1 L-2** (top-document floating screen, no frame prompt). 121.1 acceptance remaining: **L-3 part 1** (field Visual with the floating screen closed → timeout message, editor released; L-3 part 2 STANDARD regression already PASS) and **L-4** (MULTI_STEP authoring).

**Owner live — L-3 part 1 (2026-09-28): PASS.** SPECIAL opener pick with no click → «לא נקלטה לחיצה בזמן… «סמנו בעצמכם את כפתור פתיחת המסך הצף».»; field Visual with the floating screen closed → «לא נקלטה לחיצה בזמן… «מיפוי חזותי» ליד השדה.» **L-3 CLOSED.** 121.1 acceptance remaining: **L-4**.

**Owner finding (2026-09-28) — Visual pick behavior not uniform between SPECIAL and STANDARD.** Owner requirement: behavior must be highly uniform. Architect read (code): STANDARD field Visual (`AutofillProfileEditor.requestVisualMapping` → `startVisualMappingForField` → `ADMIN_VISUAL_MAPPING_START` → `openPageAndVisualMapping` → `armVisualTargetPick` **without `timeoutMs`**) has **(1)** no pick timeout in the page (listener stays armed indefinitely; only the generic 120 s operation timeout ends the Hub wait); **(2)** on that timeout the generic message «לא ניתן להשלים מיפוי חזותי כרגע. נסו שוב.» instead of the «לא נקלטה לחיצה בזמן…» copy; **(3)** no «ביטול» button; **(4)** page listener is not disarmed when the Hub gives up (a late click in the site tab is swallowed/ignored). SPECIAL (D-121-25) has a 60 s bounded pick + Hub grace, in-progress indicator with «לביטול לחצו «ביטול».», cancel that disarms the page, token-guarded late-response ignore, and exact copy. Intended difference (retained): STANDARD opens the Login Entry in a fresh tab (§4.6 SPECIAL reuses the authoring tab).

#### D-121-43 (OWNER APPROVED / AUTHORIZED 2026-09-28 — Owner direction «בוא נאחד פה») — one vocabulary for all login patterns; remove redundant SPECIAL authoring UI

**Owner finding (2026-09-28).** «שמור טיוטה» vs «הפעל כניסה עם מסך צף» shows no difference in the Admin (the fill test fills with both «טיוטת כניסה מיוחדת» and «כניסה מיוחדת פעילה»). STANDARD uses «שמור מיפוי» (works in Admin, not for users) → «אשר מיפוי» (users). Owner requires identical terms for every login pattern and no fields / terms without need (e.g. «שלב נוכחי: step-1» on a single-step floating screen that already works in Digital Home).

**Architect recalculation.** The model is already the same in both: *saved* (Admin tests it) → *approved* (users get it). Only the words differ. Internal names (`loginFlowPlan.draft` / `active`, `autofillProfile.supportState`) stay — **UI vocabulary only; no schema / contract / runtime change.**

| Concept | STANDARD today | SPECIAL today | Unified (both) |
|---|---|---|---|
| Save for Admin testing | «שמור מיפוי» | «שמור טיוטה» | «שמור מיפוי» |
| Give to users | «אשר מיפוי» | «הפעל כניסה עם מסך צף / רב שלבית» | «אשר מיפוי» (same confirm copy pattern) |
| Completeness | automatic line «הבדיקה המבנית תקינה.» | button «בדוק שהטיוטה מלאה» + line | automatic line, same wording in both; button removed; «אשר מיפוי» disabled while incomplete (as today) |
| Fill-test context | «מיפוי רגיל (שמור)» | «טיוטת כניסה מיוחדת» / «כניסה מיוחדת פעילה» | selector removed; «בדיקת מילוי» always runs the **saved mapping of the service's selected אופי הכניסה** |
| Status | «מצב תמיכה: …» | «דפוס טיוטה · משטח כניסה · URL · שלמות · פעיל כעת: SPECIAL vN» | one status line, same words: «נשמר — עדיין לא אושר למשתמשים» / «מאושר למשתמשים» / «יש שינויים שנשמרו ועדיין לא אושרו» |

**Removed / hidden (SPECIAL editor):** «(DRAFT)» in the title; «שלבים ומיפויי שדות (טיוטה)» → «מיפוי שדות»; **«שלב נוכחי» selector shown only for רב שלבי**, with labels «שלב 1 / שלב 2» (never the internal `step-1`); technical status fields (entry surface type, URL, version) move under «פרטים טכניים» (collapsed, as D-121-40). All copy that says «טיוטה» / «שמרו טיוטה» / «הופעלה» → «מיפוי» / «שמרו מיפוי» / «אושר».

**Retained intentional differences:** SPECIAL-only authoring controls (opener / transition pick, «בדוק את הכפתור וזהה את השדות», frame approval) — they exist only where the pattern needs them. STANDARD-only «נקה מיפוי» / «הגדר כלא נתמך» — out of scope (backlog: consider for SPECIAL).

**Open behavior difference (Owner decision required):** saving a **changed** mapping *after* approval — STANDARD: users lose managed fill until «אשר מיפוי» again (`supportState` → `unsupported`); SPECIAL: users keep the previously approved version until «אשר מיפוי» again (immutable active snapshot). Same words would hide this difference.

Sequencing: after D-121-42 closes (both touch `AutofillProfileEditor.tsx`).

**Owner decision (2026-09-28):** after approval, saving a changed mapping keeps users on the **previously approved mapping until «אשר מיפוי» again — for every login pattern** (SPECIAL behavior becomes the rule). Until D-121-44 ships, the D-121-43 status line must reflect the real state (STANDARD changed-after-approval → «נשמר — עדיין לא אושר למשתמשים»).

**Owner reversal (2026-09-28): D-121-44 CANCELLED** — «אני מעדיפה לא לבצע שינוי באתרים הרגילים. כי זה עובד פיקס». STANDARD storage / runtime stay untouched (Phase 120 frozen). The after-approval difference (STANDARD stops users; SPECIAL keeps the previous approved version) remains and is shown truthfully by the D-121-43 status line. **Owner decision (2026-09-28):** SPECIAL after-approval behavior unchanged (users keep the previous approved version; status «יש שינויים שנשמרו ועדיין לא אושרו»). No code change beyond D-121-43. Closed.

**Architect Review — D-121-43 (2026-09-28): PASS (offline) with one CORRECTION.** Read `mappingCopy.ts` (one vocabulary; «שמור מיפוי» / «אשר מיפוי» / structural line / 3 statuses), `mappingStatus.ts` (status from the saved row only; SPECIAL compares saved draft vs active ignoring `planVersion`; STANDARD = version-matched validated AND live STANDARD — truthful for the retained after-approval difference), `specialActionBar.ts` (activate label = shared «אשר מיפוי» for all SPECIAL patterns). Evidence: new verify (real editors / grid / result view; real save + approve logic; truth table) 10 mutations; 31/31; tsc + build 0; no lints. Internal names / storage / runtime untouched; D-121-44 not started ✔.
**CORRECTION C1 (binding, uniformity):** STANDARD «אשר מיפוי» is disabled while there are unsaved changes (`canApprove … !hasUnsavedChanges`); SPECIAL «אשר מיפוי» currently approves unsaved editor state — then the saved mapping is *older* than the approved one and the status «יש שינויים שנשמרו ועדיין לא אושרו» is false. Rule for both: **«אשר מיפוי» approves only the saved mapping; disabled while the editor has unsaved changes** (same guard as STANDARD; approval reads the saved draft, not the editor state). Evidence: verify for disabled-while-dirty + approve-uses-saved + mutation. Owner live after C1.

**Architect Review — D-121-43 C1 (2026-09-28): PASS (offline).** `SpecialLoginDraftEditor.tsx` only: button `disabled={busy || draftDirty || !draftCheck.complete}`; `requestActivateSpecial` refuses while dirty; `activateSpecial` reads the saved draft from `row.metadata`, re-checks dirty + `checkSpecialDraft(saved).complete`, A1-normalizes the saved draft and writes the unchanged activate intent. STANDARD untouched. Evidence: new verify (real editor, real contract merge) 3 mutations; 3 superseded assertions updated; 32/32; tsc + build 0; no lints. Non-blocking: the saved-draft refusals return silently (unreachable via the gated button). Pending Owner live: D-121-42 (1–4), D-121-43 (Super-Pharm / PAGI + regular site), C1 step.

**Owner live (2026-09-29): D-121-42 PASS, D-121-43 PASS, C1 PASS («הכל הכל תקין») → D-121-42 CLOSED, D-121-43 CLOSED.** Remaining Owner checks for Phase 121.1 / 121.2 acceptance: (i) a **new, never-authored FLOATING_SCREEN site** end-to-end by Admin authoring only (genericity proof: Analyze → test → fields → «שמור מיפוי» → «בדיקת מילוי» → «אשר מיפוי» → Digital Home); (ii) **L-4 MULTI_STEP authoring** (authoring + save only; MULTI_STEP runtime / fill test = 121.3, NOT AUTHORIZED).
**Status (2026-09-29):** (i) satisfied by El Al (new FLOATING_SCREEN site, Admin authoring only, end-to-end to Digital Home — combined round PASS). Remaining 121.1 acceptance: **L-4 only**, executed with the current vocabulary (D-121-43 / D-121-45): «אופי הכניסה» = «כניסה רב־שלבית» → grid «מיפוי כניסה רב־שלבית» (only «סמנו בעצמכם את כפתור המעבר בין השלבים» shown) → «זהה כפתור ושדות באתר» on step 1 → type the username manually in the site → «בדוק את הכפתור וזהה את השדות» → step-2 password identified (or advance manually + Analyze) → «שמור מיפוי» → reload → «הבדיקה המבנית תקינה.» No «אשר מיפוי»; «בדיקת מילוי» for MULTI_STEP is expected to refuse (121.3).

#### D-121-45 (OWNER APPROVED / AUTHORIZED 2026-09-29 — Owner request; visibility = selected pattern only) — Admin grid structure: one cross-cutting «אופי הכניסה» grid + one grid per pattern family

**Owner request (2026-09-29).** «אופי הכניסה» grid should hold only what is cross-cutting for all sites (the pattern selector); floating-screen / multi-step management moves to its own grid with a fitting title; «מילוי אוטומטי מנוהל» is renamed (it handles regular sites); later another grid for other specials (e.g. 4 separate text boxes for 4 card digits).

**Today (`RegistryAdmin.tsx`):** `SpecialLoginDraftEditor` (title «אופי הכניסה», contains the selector AND all SPECIAL authoring) → `AutofillProfileEditor` («מילוי אוטומטי מנוהל», STANDARD; shows a notice when SPECIAL selected) → `AdminFillTestGrid` («בדיקת מילוי»).

**Proposed layout (UI composition only; no storage / contract / runtime change):**
1. **«אופי הכניסה»** (cross-cutting): pattern selector + its explanation + the shared status line (D-121-43) for the selected pattern + «פרטים טכניים». No authoring controls.
2. **«מיפוי אתר רגיל»** (was «מילוי אוטומטי מנוהל»): the STANDARD editor unchanged in behavior.
3. **«מיפוי מסך צף ורב שלבי»** — title follows the selected pattern («מיפוי מסך צף» / «מיפוי כניסה רב־שלבית» / «מיפוי מסך צף רב־שלבי»): all SPECIAL authoring (Analyze, opener / transition pick, button panels, frame approval, fields, completeness, «שמור מיפוי» / «אשר מיפוי»).
4. **«בדיקת מילוי»** unchanged.
Split = extract the selector section from `SpecialLoginDraftEditor` into a small cross-cutting component; pattern state lifted to the parent (already reported via `onPatternSelected`).

**Architect Review — D-121-45 (2026-09-29): PASS (offline).** `RegistryAdmin.tsx` composes `LoginPatternGrid` (selector + explanation + status line + «פרטים טכניים»; no authoring, no writes) → SPECIAL grid → «מיפוי אתר רגיל» → «בדיקת מילוי»; pattern state lifted to the parent and drives all four. Decisions accepted: (1) hide-not-unmount (keeps state and the fill-test shared state); (2) selector also locked while the STANDARD grid is busy (prevents a pick finishing inside a hidden grid; Architect agrees); (3) old STANDARD hint removed. Evidence: `verifyPhase121GridStructure.mjs` (6 groups, 10 mutations); 9 superseded assertions in 4 verifies re-homed (listed in dev file); 37/37; tsc + build 0; no lints. **Residual (pre-existing, not introduced):** SPECIAL → STANDARD selector switch discards unsaved in-memory SPECIAL edits (saved draft intact) — backlog; a confirm would be a behavior change needing Owner decision. Next: Owner live D-121-45.
**Owner live D-121-45 (2026-09-29):** layout / titles / selector swap / fill test OK; one issue → **D-121-45 C1 (OWNER REQUESTED / AUTHORIZED 2026-09-29):** manual-pick buttons irrelevant to the selected pattern are **hidden**, not shown disabled: FLOATING_SCREEN → hide «סמנו בעצמכם את כפתור המעבר בין השלבים»; MULTI_STEP → hide «סמנו בעצמכם את כפתור פתיחת המסך הצף»; FLOATING_SCREEN_MULTI_STEP → both shown. Source of truth = existing `manualPickRelevant` (no new rule). UI only; no storage / contract / runtime change.
**Architect Review — D-121-45 C1 (2026-09-29): PASS (offline).** `SpecialLoginDraftEditor.tsx` renders opener / transition manual-pick buttons only when `manualPickRelevant` allows; shown buttons keep today's disabled logic; Analyze always shown. Verify: `verifyPhase121GridStructure.mjs` 7 groups / 12 mutations; `verifyPhase121ActionBar.mjs` superseded "always rendered" assertion re-homed; 37/37; tsc + build + lints clean. Decisions 1–4 accepted. **Owner live PASS (2026-09-29) → D-121-45 + C1 CLOSED.**

**Mercantile live evidence M1 (Owner, 2026-09-29; STANDARD; finding only).** Login page `start.telebank.co.il/login/#/LOGIN_PAGE`, 3 fields; Visual maps `#tzId` / `#tzPassword` / `#aidnum` fine. «נתח דף כניסה» → «זוהה אך אינו כשיר למילוי אוטומטי מנוהל»; audit `status no_confident_mapping`, proposals 0, unmapped 3. ⇒ the fields WERE identified (by the AI / identification surface) but `managedEligible` (`isSafeFillTarget`: display / rects / size / V8 hit test) was false at inspect time → safety validation dropped them. Open: which rule (likely V8 occlusion — e.g. a loading overlay / banner at inspect time, or a non-associated label layer). Awaiting page-console hit evidence.
**M1 evidence (page console, settled page):** all 3 inputs 404×40, visible, all 5 hit points = the input itself (`ok true`). ⇒ eligible once settled; ineligible only at inspect time. **Root cause (Architect read, generic):** `collectSafePageStructureWithReadiness` early-exits on the first poll where `page.inputs.length > 0` — `inputs` includes Managed-ineligible controls (`managedEligible` is only a flag). On SPA login pages (`#/LOGIN_PAGE`) the inputs exist in the DOM while still covered / not yet interactable (boot overlay / transition) → snapshot taken at that moment → all ineligible → safety validation drops them. Visual works because the Admin clicks after the page settles.

#### D-121-52 (OWNER APPROVED / AUTHORIZED 2026-09-29; queue: D-121-50 C1 → D-121-52 → D-121-51) — inspect readiness waits for eligible inputs (all patterns)
- `collectSafePageStructureWithReadiness` early-exit only when ≥1 input is `managedEligible` **and** no observed-visible input is still ineligible; otherwise keep polling (existing 250 ms / 10 s bounds); on timeout return the last snapshot (today's behavior).
- Authoring inspect only (Analyze); runtime fill / Digital Home untouched. Field-level ⇒ applies to STANDARD and SPECIAL (Owner principle). Pages that pass today still exit on the first poll → same result; only "identified but ineligible at first poll" cases change. Cost: pages with a permanently covered visible input wait up to 10 s before the same result.
**Architect Review — D-121-52 (2026-09-29): PASS (offline).** Only `page-structure-inspect.js`: early-exit iff `eligibleInputs > 0 && visibleIneligibleInputs === 0` (read), else existing poll / 10 s bound, timeout returns last snapshot. Counts added to the readiness report (no values). Decisions accepted: "visible" = existing observation flag; other visible-ineligible causes wait 10 s (accepted cost); Phase 119 readiness verify setup corrected to inject eligibility first (assertions unchanged — matches extension injection order). Evidence: `verifyPhase121InspectReadinessEligible.mjs` 5 groups / 7 mutations, pre-slice reproduces Mercantile exactly; 44/44; tsc + build 0; no lints. **Owner live Mercantile PASS (2026-09-29):** «נקה מיפוי» → «נתח דף כניסה» → all 3 fields proposed with «ביטחון גבוה» (`#tzId` / `#tzPassword` / `#aidnum`) → **D-121-52 CLOSED.** Owner-reported: «שמור מיפוי» disabled right after Analyze. Architect read (`AutofillProfileEditor.tsx`): `canSave` requires `hasUnsavedChanges` (current vs saved mapping signature); «נקה מיפוי» clears the form only (not persisted), and Analyze re-proposed exactly the saved locators → no change → save disabled by design; «אשר מיפוי» disabled because the saved mapping is already `validated` (and STANDARD is live). Gap = no explanation on screen. Pending Owner: whether an earlier occurrence had genuinely different values. → **Owner confirmed (2026-09-29): not a bug** — editing any locator enables «שמור מיפוי». Optional UX: a "no changes to save" line. → **D-121-53 (OWNER APPROVED / AUTHORIZED 2026-09-29; copy only):** in both mapping grids (STANDARD «מיפוי אתר רגיל» and the SPECIAL grid), when «שמור מיפוי» is disabled **only** because there are no unsaved changes (not busy, not structural failure), show under the buttons: «אין שינויים לשמירה — המיפוי במסך זהה למיפוי השמור.» Hidden in every other disabled reason and when enabled. No logic change.
**D-121-53 clarification (Developer question, 2026-09-29):** in the SPECIAL grid «שמור מיפוי» is never disabled for "no changes" (enabled whenever not busy), so the condition never occurs there. **Ruling: option A — STANDARD only.** SPECIAL gets no line and no logic change (keeping SPECIAL save semantics unchanged, consistent with D-121-44 cancellation). Document in dev file.
**Architect Review — D-121-53 (2026-09-29): PASS (offline).** `saveBlockedOnlyByNoChanges` = `canSave` conditions with `!hasUnsavedChanges` (read); line under the buttons (`admin-muted`), copy from `mappingCopy.ts`; `canSave` untouched; SPECIAL unchanged. Verify 4 groups / 7 mutations; 45/45; tsc + build 0; no lints. **Owner live PASS (2026-09-29) → D-121-53 CLOSED.**
Owner note: test environment, single user — deleting any site incl. built-ins is acceptable for tests.
- No site branches; no manifest / permission change. Verify: fixture with inputs present but overlaid for N ms → today drops, after fix proposes; fixture eligible at once → exits first poll (unchanged); permanently occluded → times out with today's result; mutations.

**Architect Review — D-121-51 (2026-09-29): PASS with C1 required.** Migration `20260929120000_phase121_admin_delete_service.sql`: `is_admin()` gate, global rows only (`owner_user_id is null`), typed-name check, single transaction incl. audit insert, built-in = re-seed allowlist helper, `registry_service_ids_existing` for reconciliation; revoked from public/anon. Client reconciliation fail-safe (unknown presence → no change). Decisions accepted. Verify 4 groups / 27 mutations (PGlite), 43/43. **Owner live (2026-09-29):** migration not yet applied → dialog shows the raw PostgREST text (PGRST202 "Could not find the function …") and the confirm button stays disabled (correct fail-closed, but unexplained). **D-121-51 C1 (AUTHORIZED):** map errors to plain Hebrew, raw text only under «פרטים טכניים»: function missing (PGRST202) → «מחיקת אתרים עוד לא הופעלה במסד הנתונים (חסר עדכון מסד נתונים). לא נמחק דבר.»; not admin → «אין הרשאת מנהל למחיקה.»; name mismatch → «השם שהוקלד לא תואם לשם האתר.»; other → «המחיקה נכשלה. לא נמחק דבר.»; when the impact check failed, a line under the input: «אי אפשר למחוק כרגע — הבדיקה של השפעת המחיקה נכשלה.» Migration apply = Owner action (Dashboard SQL Editor). **Note:** D-121-50 C1 (value-dependent hints) is NOT present in code / dev file as of this review. (Superseded: implemented later, PASS, Owner live PASS.)
**Architect Review — D-121-51 C1 (2026-09-29): PASS (offline).** `DeleteServiceDialog.tsx` maps errors (PGRST202 / missing function, not admin, name mismatch, other) to the approved Hebrew; raw text only under collapsed «פרטים טכניים»; impact-failed reason line; button stays disabled; API passes raw text through. Decisions accepted. Verify 4 groups / 37 mutations; 44/44; tsc + build 0; no lints. Owner applied the migration (Dashboard SQL, success). Owner live delete pending.
**Owner live (2026-09-29) — built-in Shufersal dialog:** impact works (2 users; built-in). Two red lines contradict: «…הוא יוסר אצלם…» vs «אתר מובנה — יחזור…». Owner: an active global site appears for users automatically, so a built-in that returns is not "removed" from them — only their saved credentials go. Also: impact lines are warnings but styled as errors (red). **D-121-51 C2 (OWNER-REPORTED, AUTHORIZED; copy + style only):** built-in → ONE line: «אתר מובנה: האתר יחזור מיד למצב ההתחלתי, ללא המיפוי. אצל N משתמשים יימחקו פרטי הכניסה ששמרו לאתר.» (N = 0 → «…ללא המיפוי.» only); non-built-in keeps «האתר קיים אצל N משתמשים — הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו.» / «האתר לא נמצא אצל אף משתמש.»; impact lines use a warning style (not `admin-error`); red reserved for failures. No SQL / logic change. → **SUPERSEDED by D-121-51 A1 proposal below (C2 not given to Developer).**
**OWNER DECISION (2026-09-29) — full delete everywhere, incl. built-in; A1 below WITHDRAWN.** Owner: delete the site itself (not only the mapping), for all users, always — built-in too; it must be added again. **Architect correction (read `App.tsx` / `registryPersistence.ts`):** `ensure_known_builtin_registry_row` runs only when a user adds a known built-in (Discover «הוספה» / `changeSelection('add')`), not on load. So D-121-51 as implemented already deletes a built-in fully (incl. users' data); it reappears only when added again (seed state, no mapping). The earlier «יחזור מיד» wording was wrong. **D-121-51 C2 (revised, AUTHORIZED; copy + style only):** built-in → «אתר מובנה: יימחק לגמרי, גם אצל המשתמשים. הוא יחזור רק אם יוסף מחדש, במצב ההתחלתי וללא מיפוי.»; impact line for all sites «האתר קיים אצל N משתמשים — הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו.» / «האתר לא נמצא אצל אף משתמש.»; warning style (not `admin-error`). No SQL / logic change.
**Architect Review — D-121-51 C2 (2026-09-29): PASS (offline).** Built-in copy replaced (old line absent); impact copy unchanged (already matched); impact + built-in lines amber notice, failures stay red. Verify 4 groups / 43 mutations; 45/45; tsc + build 0; no lints. Decision: reused `.admin-gate-login-banner` (only existing amber rule) — accepted for now; backlog: generic `.admin-notice` class rename (one-line CSS). **Owner live PASS (2026-09-29):** built-in Shufersal dialog (amber lines only), typed confirm, «האתר נמחק.», gone from Admin list and Digital Home after refreshes, re-added via «הוספה» in seed state → **D-121-51 (+C1, C2) CLOSED.**
**Owner regression round (2026-09-29, after re-adding Shufersal) — S1:** STANDARD «נתח דף כניסה» → username `#j_username` HIGH; password → «זוהה, אך הבורר אינו חד-משמעי למילוי מנוהל» (identified; locator not exact-one). Suspects: duplicate password control / id on the page captured in the snapshot (D-121-52 now snapshots later, after eligibility settles), or pre-existing. Awaiting page-console evidence. Note: re-added Shufersal field ids are `field-…` (not the earlier `username` / `password`).
**S1 evidence + root cause (Architect read):** Visual on the password → `input[name="j_password"]` (Visual's `preferExactOneLocator` skipped a non-unique first candidate, likely `#j_password`). Analyze: the AI returns one locator from the input's `locatorCandidates` (typically the first / id); `safetyValidation` 120.9 gate checks only that locator (`assertLocatorDeterministic`) and marks the row non-deterministic — it never falls back to another exact-one candidate **of the same observed input**. Visual and Analyze therefore disagree on the same element. Generic; likely pre-existing (not caused by D-121-48/49/52), independent of site.

#### D-121-54 (OWNER APPROVED / AUTHORIZED 2026-09-29) — Analyze uses the same exact-one choice as Visual (all patterns)
- In `safetyValidation` after the semantic gates: if a HIGH / MEDIUM row's locator is not exact-one, replace it with the first exact-one candidate of the **same** `observedInputId` (same order / rule as Visual `preferExactOneLocator`); mark deterministic only if found; otherwise unchanged (today's «אינו חד-משמעי»). Never switches to another input; confidence unchanged; conflict checks re-run on the final locator.
- Field-level → STANDARD + SPECIAL (Owner principle). Rows that pass today are unchanged. No runtime / extension change. Verify: duplicate-id fixture → name locator proposed; unique id → unchanged; no exact-one candidate → today's result; never crosses inputs; mutations.
**Architect Review — D-121-54 (2026-09-29): PASS (offline).** Read: `locatorDeterminism.ts` `preferExactOneCandidate` walks only the observed input's `locatorCandidates` in order, first `css` with `matchCount === 1`; `safetyValidation.ts` swaps only for HIGH / MEDIUM rows whose locator fails `assertLocatorDeterministic`, before the conflict checks and the 120.9 gate; confidence / `observedInputId` unchanged; no candidate → today's result; warning `locator_replaced_with_exact_one`. Decisions accepted: (1) `verifyPhase120LocatorVerification.mjs` R2 / R12 updated — they asserted the old S1 behavior; "not exact-one ⇒ no prefill" moved to an all-non-unique input (not weakened); (2) conflict shift — the same non-unique locator proposed for two **different** observed inputs now resolves to each input's own exact-one locator (correct: distinct elements); same input twice still conflicts; (3) new warning code. Flaky `verifyPhase120A2ManagedFillDiagnostics.mjs` (literal "999" vs random run id) → backlog. Evidence: `verifyPhase121AnalyzeExactOne.mjs` 7 groups / 10 mutations (real inspect + Visual scripts, Visual↔Analyze parity incl. SPECIAL); 46/46; tsc + build 0; no lints. **Owner live Shufersal PASS (2026-09-29):** «נתח דף כניסה» finds the password field → **D-121-54 CLOSED.**

**Owner regression round — Mizrahi M2 (2026-09-29; finding, no slice).** Draft: opener `#logInBtn` (top) + username mapped to `#BranchNumber` **in the top document** (stale — left from the Owner's STANDARD-style Analyze experiment; the real fields are in the same-origin `#iframeLogIn`). «בדוק את הכפתור וזהה את השדות» → screen opens on the site, Admin shows «לא נבחר — המסך לא נפתח», no fields identified. **Root cause (Architect read, `specialDraftAuthoring.ts`):** once the revealed step has a credential mapping, `deriveRevealReadiness` / `rederiveRevealReadiness` set readiness = first credential mapping (IF-2.5 R3) → `readinessModeFor` = `declared` → the test waits for `#BranchNumber` (top) to become exact-one eligible, which the overlay prevents → timeout → «המסך לא נפתח»; declared mode does not scan for new fields. Working as designed for a wrong draft; not a regression of D-121-52 / 54. **Recovery:** field Visual on the real frame fields replaces the stale mapping → readiness re-derives to the frame field → re-test. **M3 (re-created clean Mizrahi, 2026-09-29):** same symptom on a clean site — username `#BranchNumber` and password `#st-search-input` (a search box) mapped **in the top document**, «בדוק» → «המסך לא נפתח» while the screen opens. Architect hypothesis (unconfirmed, pending Owner answer on order of actions): SPECIAL «נתח» before the screen is open prefills main-page inputs as credential fields (HIGH / MEDIUM) → readiness becomes declared on `#BranchNumber` → M2 trap. Possible link to D-121-54: those rows may previously have been non-exact-one (not prefilled) and are now swapped to an exact-one candidate of the same input and prefilled. **Owner answer:** «נתח» was pressed first after re-create. **Root cause confirmed (Architect read `SpecialLoginDraftEditor.runSpecialAnalyze`):** manual «נתח» writes every `ready` field proposal of the current surface (top document included) into the current step, then `rederiveRevealReadiness` → declared readiness on the first one. Before the opener is proven, the current surface is the main page → main-page inputs (`#BranchNumber`, a search box) enter the draft → «בדוק» waits for them → «המסך לא נפתח»; reveal-mode field discovery never runs. Generic: any floating-screen site whose main page has text / search inputs the AI rates HIGH / MEDIUM. (PAGI / Super-Pharm / El Al main pages did not trigger it.)
**D-121-56 (OWNER APPROVED / AUTHORIZED 2026-09-29, option `approve` — no explanatory note line) — floating screen: fields come only from the opened screen.** In FLOATING_SCREEN and FLOATING_SCREEN_MULTI_STEP, for the step revealed by the opener: manual «נתח» writes field proposals into the draft **only when that step's opener is already chosen** (successful «בדוק»). Before that, «נתח» proposes the opener only; main-page field proposals are not written and do not affect readiness (optional one-line note: «שדות יזוהו אחרי שהמסך הצף ייפתח בבדיקה»). After a successful test, auto-Analyze (`after_continue`) and later manual «נתח» work as today. Field Visual stays unrestricted (manual Admin choice). MULTI_STEP (no opener) unchanged; STANDARD unchanged; saved / ACTIVE plans untouched. No contract / validator / runtime / extension change; no site branches. Verify: clean floating-screen draft + main page with text inputs → «נתח» writes no fields, readiness stays reveal, «בדוק» → fields from the opened surface (top-document and framed fixtures); opener chosen → «נתח» writes fields as today; MULTI_STEP unchanged; mutations.
**Architect Review — D-121-56 (2026-09-29): PASS (offline).** Read: `specialActionBar.manualAnalyzeMayWriteFields` — true unless pattern is FLOATING_SCREEN / FLOATING_SCREEN_MULTI_STEP **and** step = `steps[0]` **and** no `floating_opener` is `actionSelected` (both flags — set only by a successful «בדוק»); `runSpecialAnalyze` skips the whole field block when `mode === 'manual'` and the gate is closed (no write, no hold, no readiness re-derive); `after_continue` never gated; opener proposals / copy unchanged. Decisions accepted: (1) chosen = both approval flags (the press-consent flag alone does not lift the gate); (2) gated main-page proposals dropped, not queued; (3) later FLOATING_SCREEN_MULTI_STEP steps (revealed by a transition) **not gated now** — same trap is possible there and in MULTI_STEP step 2+ before the transition test; decide with evidence during 121.1 L-4 (backlog item "transition-revealed steps"). Evidence: `verifyPhase121FloatingFieldsAfterOpener.mjs` (top-document + framed `#iframeLogIn` fixtures, cross-origin held, FSMS step 1, MULTI_STEP, Visual) 8 mutations; 48/48; tsc + build 0; no lints. Pending Owner live: re-created Mizrahi — «נתח» → opener only; «בדוק» → «נבדק ונבחר — המסך נפתח» + fields in `#iframeLogIn`.
UX gaps (backlog): (a) no per-field remove in the SPECIAL grid (SPECIAL «נקה מיפוי» item); (b) «המסך לא נפתח» is misleading in declared mode when the screen opened but the declared field is not ready — candidate copy naming the awaited field; (c) how the top-document `#BranchNumber` entered the SPECIAL draft — unverified (Owner experiment), watch for recurrence.

**121.1 L-4 live — PayPal P2 (2026-09-29; MULTI_STEP authoring gap).** Step 1: username `#email` (Analyze) + transition `#btnNext` «נבדק ונבחר — המסך נפתח»; password on step 2 never identified; selector shows only «שלב 1». **Root cause (Architect read):** (1) a tested transition goes through `writeDraftAction` → no step owns it as `exitTransition` → `upsertPreambleAction` (preamble); nothing in the UI ever calls `setStepExitTransition` with a new step or creates step 2 → the selector can never offer «שלב 2»; (2) `revealedStepFor` of a preamble action = `steps[0]` → readiness is declared on step 1's own `#email` (already present) → the «בדוק» success is a **false positive**; (3) `after_continue` auto-Analyze writes into `currentStepId` (step 1), not the revealed step. ⇒ L-4 cannot pass with today's authoring. Generic (every MULTI_STEP site).
**D-121-58 (OWNER APPROVED / AUTHORIZED 2026-09-29) — multi-step authoring: the transition opens the next step.** Scope MULTI_STEP and FLOATING_SCREEN_MULTI_STEP authoring only (draft), no runtime (121.3 NOT AUTHORIZED):
1. A transition tested / picked while step N is selected becomes **step N's `exitTransition`** (single slot per step, as D-121-46); step N+1 is created (empty) if missing.
2. Its readiness: step N+1 first credential mapping when present (declared); otherwise **reveal mode** — a fresh eligible credential input after the click, never one already present before it (step N fields excluded by the pre-click snapshot).
3. On test success: the selector moves to step N+1 and auto-Analyze writes into **the revealed step** (not the selected one).
4. The D-121-56 gate extends to transition-revealed steps: manual «נתח» on step N+1 writes fields only after step N's transition is chosen (closes the backlog item).
5. Legacy drafts: a MULTI_STEP `intermediate_transition` in `preambleActions` moves to `steps[0].exitTransition` (draft only; ACTIVE untouched).
Unchanged: contract shape (`exitTransition` already exists), validator, runtime, extension, manifest; `final_submit` reserved; no site branches; «בדיקת מילוי» for MULTI_STEP still refuses (121.3). Verify: fixture username → «הבא» → password (same page and navigation) → step 2 created, password in step 2, readiness reveal not self / not step-1 field; false-positive case (readiness on step-1 field) impossible; auto-Analyze target = revealed step; legacy preamble transition migrated; FLOATING_SCREEN unchanged; mutations.
**Architect Review — D-121-58 (2026-09-29): PASS (offline).** Read `specialDraftAuthoring.ts`: `placeTransitionAsStepExit` (removes the same action from preamble, sets the selected step's `exitTransition`, `ensureStepAfter`); `migrateLegacyPreambleTransitions` (MULTI_STEP / FSMS drafts only via `normalizeLegacyDraftReadiness`; chosen legacy transition preferred; occupied chosen slot kept; step 2 ensured); `firstCredentialMapping(step, excluded)` excludes the owner step's fields → transition readiness never on its own step's field, else reveal mode; `revealedStepIdFor`. Editor: test press places on the selected step; success moves the selector and auto-Analyze targets the revealed step; D-121-56 gate extended to step N+1. No STOP: validator already checks each exit against the next step and preamble against step 1; FSMS opener stays preamble. Decisions accepted: (1) placement = step selected at «בדוק»; (2) failed test leaves an unchosen exit + empty next step (as unchosen opener); (3) **addition accepted** — auto-Analyze on a later step does not re-write fields already mapped on an earlier step (same-page steps; Visual unrestricted); (4) FSMS opener test does not move the selector; other legacy preamble transitions dropped (draft only). **Live risk noted:** if «הבא» navigates, frame enumeration mid-navigation may end the test as `surface_not_revealed` → would need an extension slice (evidence first). Evidence: `verifyPhase121MultiStepTransition.mjs` (same page + navigation, step 3, gate, legacy MULTI_STEP / FSMS, FLOATING_SCREEN / FSMS opener unchanged; old false positive reproduced by restoring the old path) 12 mutations; `verifyPhase121FloatingFieldsAfterOpener.mjs` P1 updated for FSMS step 2 gate; 50/50; tsc + build 0; no lints. Pending Owner live L-4 (PayPal).
**Owner live L-4 PayPal (2026-09-29):** Analyze → `#email` + `#btnNext`; email typed manually; «בדוק» → nothing happens on the site; «לא נבחר — המסך לא נפתח». Hypotheses: wrong session tab / `#btnNext` not exact-one / site ignores the script `click()` (untrusted event). Console discriminator requested. Owner policy: full manual mapping by the Admin is acceptable for such sites — Architect note: a transition becomes runtime-approved only by a successful test (same click mechanism the runtime would use), so manual mapping cannot replace a working click; if the site ignores script clicks, the site is not automatable with the current click mechanism (any alternative = separate design; `debugger` forbidden).
**Console evidence (Owner):** one PayPal tab; `document.querySelectorAll('#btnNext').length` = 1; `document.querySelector('#btnNext').click()` → PayPal advances to the password step. The extension's authoring click is the same call (`clickInFrame`: MAIN world, exact-one, `targets[0].click()`). ⇒ Site, locator and click mechanism are fine; **the extension click most likely never ran** (or ran on a different page state). Architect read of the reveal path: before the click, `collectSpecialRevealSnapshot` enumerates all frames (`allFrames` probe + nonce handshake + per-frame inject); PayPal has many cross-origin frames — a slow / never-returning frame callback would keep the click from running while the Hub's wait expires → reported as «המסך לא נפתח». Other candidates: gesture-watch install, a stale session tab, Hub-side timeout shorter than the extension flow. Needs extension service-worker evidence.
**D-121-60 (OWNER APPROVED / AUTHORIZED 2026-09-29) — authoring click must run (diagnose + generic fix).** (1) Root cause with evidence: timestamped service-worker trace of the authoring click message (gate / session tab, gesture watch, frame probe, handshake, per-frame inject callbacks, pre-snapshot, click result, poll) and the Hub-side wait; no values. (2) Generic fix in the failing stage, e.g. bounded per-frame callbacks (a frame that does not answer in time is skipped fail-closed for discovery — never for the click target or a declared frame), Hub wait ≥ extension flow bound. (3) The click itself, origin checks, exact-one, R3 reveal semantics and gesture proof unchanged. Extension change allowed; no manifest / permission change; no `webNavigation` / `debugger` / `getFrameId`; no site branches; `final_submit` reserved. STOP and report if the fix needs more than bounding / ordering. Verify: fixture with a never-answering frame → click runs and reveal proceeds; slow frames within bound → unchanged; declared-frame / frame-origin fail-closed unchanged; Mizrahi / PAGI framed fixtures unchanged; mutations.
**Architect Review — D-121-60 (2026-09-29): PASS (offline); live trace pending.** Root cause (code + fixture, not yet live): reveal-mode pre-click discovery = unbounded `executeScript` chain (allFrames probe, 3-step handshake, per-frame inspect); one non-answering frame stalls it → no click, no reply; Hub had no timeout. Fix read: `SPECIAL_AUTHORING_CALL_TIMEOUT_MS = 2500` bound on every discovery / gesture-watch call (`background.js` L2465–2479); non-answering frames skipped for discovery only and excluded from the post-click comparison (no false reveal); probe timeout → top-only discovery; declared click frame and gesture watch never skipped (timeout = explicit failure, no click); Hub wait = readiness + `AUTHORING_CLICK_HUB_MARGIN_MS` 90 s (> extension worst case readiness + 48.35 s, recomputed by verify) → `authoring_click_no_response`; trace `[D-121-60 authoring-click]` (stages, ms, counts, reason codes only). Click / origin / reveal / gesture / declared poll / runtime unchanged; `background.js` 22 exact edits, SHA pin via revert chain. Evidence: `verifyPhase121AuthoringClickBounded.mjs` 15 checks / 11 mutations; 52/52; tsc + build + `node --check` 0; no lints. Accepted residuals: (1) worst-case Admin wait on a total failure ≈ readiness + 90 s; (2) a legit frame slower than 2.5 s at pre-click is skipped for discovery (its fields then cannot count as revealed) — watch Mizrahi / PAGI / CAL live. Pending Owner live: extension reload → PayPal «בדוק» advances; else send the trace.
**PayPal P4 (Owner, 2026-09-29; finding):** same URL now shows email + password **on one page** (password pre-filled by the browser's password manager). PayPal chooses split vs single-page login per visit (device / cookie recognition, remembered email, experiments). ⇒ **adaptive flow**: one site, different patterns per visit; a fixed MULTI_STEP plan would fail on the single-page visit and vice versa. PayPal is unsuitable as the L-4 acceptance site; use a consistently split flow (e.g. Microsoft account). **Backlog (121.3 design, not authorized):** tolerant multi-step runtime — if the next step's fields are already present, skip the transition (and the reverse for STANDARD). D-121-60 live proof moves to the next multi-step site (trace procedure unchanged).

**Owner regression round — CAL C1 (2026-09-29).** FLOATING_SCREEN: «נתח» proposed the right opener; «בדוק» opened the screen on the site, Admin shows «המסך לא נפתח»; fields not identified. The screen's login fields are «מספר תעודת זהות» + «4 ספרות אחרונות של הכרטיס» (password comes later by SMS) — **no password input**. URL `#` irrelevant (hash does not change origin). **Root cause (Architect read):** `SpecialLoginDraftEditor` sends `requirePasswordSurface: pattern === 'FLOATING_SCREEN'` (D-121-47 G8) → the extension accepts a revealed surface only with a fresh password input → CAL's password-less login screen → `surface_not_login` → «המסך לא נפתח». G8 was meant to reject newsletter / sign-up forms; it also rejects legitimate password-less login screens (ID + card digits, OTP flows). Generic.
**D-121-59 (OWNER APPROVED / AUTHORIZED 2026-09-29) — the password requirement follows the site's own login fields.** Send `requirePasswordSurface` only when the pattern is FLOATING_SCREEN **and** the site's «שדות כניסה» include a field marked «זה שדה הסיסמה של האתר» (`type === 'password'`). Sites without such a field (CAL) → reveal mode accepts any fresh eligible credential input (pre-G8 behavior). Sites with a password field (El Al, PAGI, Mizrahi, Super-Pharm) → unchanged. Hub-only one-condition change; no extension / contract / runtime change; no site branches. Residual: a password-less site could again accept a newsletter form as the surface — same as before G8, limited to such sites; manual pick / «זה לא הכפתור» remain. Verify: schema without password + ID/digits fixture → revealed; schema with password + newsletter fixture → `surface_not_login` (G8 kept); mutations.
**D-121-59 A1 (OWNER APPROVED 2026-09-29; copy only) — one message per failure reason.** Today `authoringClickFailureMessageHe` maps `surface_not_revealed`, `surface_not_login` and `readiness_timeout` all to «המסך לא נפתח» — misleading when the screen did open (CAL, Mizrahi M2). New copy: `surface_not_revealed` → «המסך לא נפתח» (unchanged); `surface_not_login` → «המסך נפתח, אבל לא נמצא בו שדה סיסמה — ייתכן שזה לא מסך הכניסה.»; `readiness_timeout` (declared mode) → «השדה הממופה לא הופיע אחרי הלחיצה — ייתכן שהמסך לא נפתח, או שהשדה הממופה שגוי.» (Architect wording correction: in declared mode the system cannot know the screen opened) The panel status line follows the same split where it shows the failed-test state. No logic change. Closes M2 backlog (b).
**Architect Review — D-121-59 + A1 (2026-09-29): PASS (offline).** Read `specialActionBar.ts`: `requirePasswordSurfaceFor(pattern, loginFields)` = FLOATING_SCREEN ∧ some field `type === 'password'` (stored schema; invalid / empty → not sent); `testFailureOutcome` maps `surface_not_login` → not_login, `readiness_timeout` → field_missing, else not_opened; `authoringClickFailureMessageHe` one message per reason (approved copy, corrected timeout wording). Decisions accepted: panel status «מצב: לא נבחר — המסך נפתח, אבל לא נמצא בו שדה סיסמה» / «מצב: לא נבחר — השדה הממופה לא הופיע אחרי הלחיצה» (main clause of the approved messages — Architect confirms); gesture-interrupted test unchanged; newsletter residual for password-less sites (accepted in D-121-59). Four older verifies updated for pinned code / copy only. Evidence: `verifyPhase121PasswordlessSurface.mjs` (editor → Hub click helper → real `background.js` handler, `chrome` mocked) 5 cases / 6 mutations caught end-to-end; 51/51; tsc + build 0; no lints. Pending Owner live: CAL «בדוק» → screen + both fields.
**Owner live CAL C2 (2026-09-29):** after D-121-59 the screen opens, status «המסך לא נפתח» (= `surface_not_revealed`), no fields. Console (top, screen open): **no visible inputs in the top document**; visible frame `https://connect.cal-online.co.il/index.html` 476×703 with **no id / name / title / aria-label** (others 0×0; four `#popupIframe` duplicates). **Root cause (Architect read `frame-correlation.js` `frameLocatorCandidates`):** frame locator candidates are id / name / title / aria-label only → this iframe is not addressable → not scanned by `collectSpecialRevealSnapshot` (only `depth1_https` visible records) → nothing fresh → «המסך לא נפתח». This is the 121.1-IF non-blocking note ("an iframe with none of these → fail-closed; finding for design") now hit live. Also the Admin message hides the reason (a visible, unaddressable frame appeared).
**D-121-61 (OWNER APPROVED / AUTHORIZED 2026-09-29) — address a frame by its source when it has no name.** In `frameLocatorCandidates`, after id / name / title / aria-label: (a) `iframe[src^="<origin><path>"]` (query / hash stripped; HTTPS only), kept only if exact-one; (b) anchored structural locator — nearest stable ancestor (D-121-48 rules) + `iframe`, exact-one. Stored descriptor shape unchanged (`frameLocator` + `frameOrigin`); runtime `resolveDeclaredFrame` still enforces exact-one + live origin + depth-1 (fail-closed unchanged); a src-prefix locator never replaces the live origin check. Cross-origin → «אשר מסגרת» as today (`connect.cal-online.co.il` ≠ entry origin, A2). Plus copy: when the reveal saw a newly visible frame that is not addressable → «המסך נפתח, אבל השדות נמצאים במסגרת שהמערכת לא יכולה לאתר.» (instead of «המסך לא נפתח»). Extension (authoring collectors + reveal) + Hub copy; no manifest / permission change; no site branches. Verify: nameless iframe with stable src → addressed, fields revealed and held for frame approval; src with query → prefix without query; two iframes same src → not exact-one → structural or fail-closed; runtime origin mismatch still fails; Mizrahi (`#iframeLogIn`) / PAGI unchanged; mutations.
**Architect Review — D-121-61 (2026-09-29): PASS (offline); CAL live pending.** Read: `frame-correlation.js` `srcPrefixLocator` (absolute `https:` src attribute only, no credentials in URL, origin + path, query / hash dropped, length / control-char guard) appended after id / name / title / aria-label, then the D-121-48 anchored structural locator (existing helper); both exact-one or unaddressable. `background.js` reveal records newly visible unaddressable frames → `surface_frame_not_addressable` only when nothing else is fresh (real reveal / `surface_not_login` take priority). Hub copy + panel status per A1 pattern. No contract / validator change (`frameLocator` already any non-empty CSS). Decisions accepted: raw `src` attribute (relative / protocol-relative / http / about: → structural only); live origin check authoritative at runtime (`resolveDeclaredFrame` exact-one + depth-1 + live origin — src match never bypasses it); "newly visible" per frame before vs after the click. Evidence: `verifyPhase121FrameBySource.mjs` 15 checks / 13 mutations (CAL shape with duplicate `#popupIframe`, query / hash, same-src → structural or unaddressable, declared click via src + origin mismatch, new copy, Mizrahi / PAGI unchanged); `verifyPhase121Runtime` pins match after reverting listed edits; 53/53; build + tsc + `node --check` 0; no lints. Pending Owner live (extension reload): CAL «בדוק» → fields in the connect frame, «אשר מסגרת».
**Owner live CAL (2026-09-29): PASS → D-121-61 CLOSED.**

#### PayPal P5 — Owner live L-4 on a split-flow URL (2026-09-29, evidence pending)
Owner: step 1 Analyze mapped email; «בדוק» on `#btnNext` advanced the site (click works → D-121-60 effective); editor then showed step selector = «שלב 2», email «–», password `#password`, panel status «לא נבחר — השדה הממופה לא הופיע אחרי הלחיצה». Reading: step switch to the revealed step (`setSelectedStepId(revealedStepId)`, D-121-58) is by design — step 2 row list shows email unmapped because email belongs to step 1; no code path removes step-1 mappings. Open: (a) confirm step 1 still holds email; (b) the `readiness_timeout` status is inconsistent with a successful first test (success → «opened» + auto-Analyze) — suspect a second press on the already-advanced page (declared readiness `#password`), or a pre-existing step-2 mapping. UX finding (candidate): after the switch the Admin reads the step-2 list as "email deleted" → make the per-step context explicit. No decision yet.
Owner follow-up: (a) confirmed — step 1 holds email. Save shows `actionNotApprovedForRuntime` (`validateSpecialPlan.ts`) → step 1 `exitTransition` `#btnNext` has both flags cleared = `actionAfterTestFailure` ran (the `readiness_timeout` press). Consistent with: press 1 success (advance, auto-Analyze step 2 `#password`, switch) then press 2 on the advanced page → declared `#password` / click fails → flags cleared, overwriting a proven choice. Alternative: single press with a pre-existing step-2 mapping timing out. Asking the Owner the press count. Candidate design gap: a re-test on an already-advanced surface can un-choose a proven action.
Owner answer: **pressed twice** (second press after the site had already advanced) → root cause confirmed. Not a site issue; applies to any action kind (e.g. a second opener press that closes the popup).

#### D-121-62 — A failed re-test never un-chooses a proven action (PROPOSED)
- **A. Keep a proven choice.** `testAndChooseAction`: when the action was already chosen before the press (both flags true in the draft, or outcome `opened` this session) and the re-test fails, do not run `actionAfterTestFailure`; flags and draft stay; panel status stays «נבחר»; show the failure message plus «הבחירה הקודמת נשמרה. אם האתר כבר התקדם, זה צפוי — כדי לבדוק שוב חזרי לדף הכניסה.» An unchosen action keeps today's behavior (failure → both cleared). Un-choosing stays explicit only: «זה לא הכפתור». Runtime unaffected (fail-closed as today).
- **B. Step context copy.** Under the step selector in the field list: «שדות של שלב N» (current step); after the auto-switch success message adds «עברנו לשלב N — שדות שלב קודם נשמרו בו». No logic change.
- Unchanged: R3 readiness, click path, D-121-60 timeouts, validator, contract, manifest; no site / host branches.
- Verify: re-test failure on a chosen action keeps both flags + status + no draft change; failure on an unchosen action still clears; «זה לא הכפתור» still clears; opener and transition both; copy present; D-121-58 step switch unchanged; mutations for each.
- Owner: not answered yet (moved to Gmail) — stays PROPOSED.

#### Gmail L-4 authoring (2026-09-29): PASS
Owner: MULTI_STEP authoring on Gmail mapped both steps; «שמור מיפוי» saved. «בדיקת מילוי» not offered — by design: `fillTestContext.ts` `specialRunnable = draft.pattern === 'FLOATING_SCREEN'` (copy `specialPatternLater`); `runtimeGate.ts` L40 → `pattern_not_supported_yet` for any other pattern. Multi-step fill test + runtime = 121.3, NOT AUTHORIZED. L-4 authoring scope therefore complete.
**Gap G11:** «אשר מיפוי» is enabled for MULTI_STEP / FSMS although the runtime gate fails closed for them → approving would switch users from STANDARD to a plan they cannot run (no autofill for the service). Owner told not to approve Gmail. Fix either inside 121.3 (runtime makes it runnable) or, if 121.3 is deferred, an approve guard for non-runnable patterns.
**Owner (2026-09-29): plan 121.3 now.**

### 121.3 — MULTI_STEP execution (DESIGN PROPOSED 2026-09-29, awaiting Owner approval)
Same shared orchestrator as 121.2 (one Hub entry `executeSpecialLoginFlow`, one Ext handler `runSpecialLoginFlow`); Admin «בדיקת מילוי» (DRAFT snapshot, temp values) and Digital Home (ACTIVE plan, vault) differ only in context + credential source, as in 121.2. Code read: `runtimeGate.ts`, `specialLoginFlow.ts`, `background.js` `specialValidateRunPlan` / `runSpecialLoginFlow` (L3982–4493), `validateSpecialPlan.ts`, `fillTestContext.ts`.

**R-1 Runnable shape (Hub `validateFloatingScreenRunnable` → generalized gate + Ext parity).** MULTI_STEP: no preamble actions; 2–4 steps; every step except the last has an `intermediate_transition` exit with `approvedForRuntime`; the last has none; each step's mappings css + one frame per step (frames may differ between steps); each exit's readiness = declared field of the next step, not self, not a field of its own step (already enforced by `validateSpecialPlanComplete` + D-121-58); a fieldId appears in exactly one step. FLOATING_SCREEN unchanged. FLOATING_SCREEN_MULTI_STEP stays `pattern_not_supported_yet` (121.4). Reserved kinds rejected first (unchanged).
**R-2 Orchestration (one generic step loop, not a second engine).** Sequence = [preamble opener → readiness] (FLOATING only) then for step i: resolve step frame → fill + verify step i (existing `runManagedAutofill`, same retries) → if exit: resolve exit frame → click exact-one (MAIN world, same as opener click) → poll declared readiness of step i+1 (cap `SPECIAL_RUNTIME_READINESS_MAX_MS`) → i+1. Last step: fill + verify → `STOPPED_FOR_USER` (never submit; `final_submit` reserved). A transition is clicked only after step i's fill verified. Whole run within the existing Ext operation deadline and Hub `SPECIAL_HUB_RESPONSE_TIMEOUT_MS`.
**R-3 Origin between steps (fail closed).** Before each fill and each click: tab URL origin + live top-document origin = `allowedOrigin` (R1 repeated); declared frames via `resolveDeclaredFrame` (exact-one + depth-1 + live origin). A transition that navigates to another origin → `origin_mismatch` at the next check. During readiness polling a navigating tab (script injection error) counts as not-yet-ready until the deadline, never as success.
**R-4 Credentials.** `buildSpecialCredentialSubset` + Ext parity: union of mapped fieldIds of all steps; all required non-blank; per step only that step's subset is sent into the page (a step never receives the other steps' values).
**R-5 Tolerant transition (PayPal P4, generic).** Before clicking step i's exit: if step i+1's readiness field is already exact-one eligible, do not click; continue to fill step i+1. No other adaptivity (no reverse / STANDARD fallback). Diagnostic `transitionSkipped: true`.
**R-6 Diagnostics / failures.** New stage `transition`; `stepId` + `actionId` on every failure; reasons `transition_missing` / `transition_ambiguous` / `readiness_timeout` (with the step) / existing fill + frame reasons. Admin copy: «המילוי נעצר בשלב N: …» in plain Hebrew (same mapper as 121.2). No values in logs.
**R-7 Admin UI.** `fillTestContext`: `specialRunnable` for FLOATING_SCREEN and MULTI_STEP; temp inputs = mapped fieldIds of all steps. G11: «אשר מיפוי» enabled only when the saved draft passes the runtime gate (FSMS stays blocked with «אישור לסוג כניסה זה יתאפשר בשלב מאוחר יותר.»).
**Unchanged:** contract shape, parse, validator rules, authoring, STANDARD path, manifest / permissions; no `webNavigation` / `debugger` / `getFrameId`; no site / host / serviceId branches; merge guard; activation flow.
**Acceptance:** fixture (same-page split + navigation split + cross-origin transition → fail closed + tolerant skip + ambiguous transition) with verifies + mutations; FLOATING_SCREEN parity (Mizrahi / PAGI / CAL / El Al) and STANDARD regression PASS; Owner live: Gmail «בדיקת מילוי» → «אשר מיפוי» → Digital Home; one more split site (Microsoft account).
Owner (2026-09-29): «לא עדיין — יש לי שאלות» → stays PROPOSED; D-121-62 also PROPOSED.
**Owner amendment (2026-09-29):** the transition («הבא» or any Admin-chosen button) is always clicked, then the last step (password) is filled and the run stops for the user. **R-5 (tolerant transition skip) REMOVED** — PayPal adaptive flow deferred to backlog. Consequence: on an adaptive visit where the transition is absent, the run fails closed at `transition` (`transition_missing`, step 1), never fills blindly.
**121.3 OWNER APPROVED / AUTHORIZED (2026-09-29)** — scope R-1, R-2, R-3, R-4, R-6, R-7 (no R-5). FLOATING_SCREEN_MULTI_STEP (121.4) NOT AUTHORIZED. D-121-62 not included (stays PROPOSED).

**Architect Review — 121.3 implementation (2026-09-29): PASS (offline); Owner live pending.** Read: `runtimeGate.ts` `validateSpecialRunnable` (reserved first → FLOATING unchanged rules → MULTI_STEP: no preamble, 2–4 steps, approved css exit on every non-last step only, one frame per step, fieldId unique across steps, exit readiness = field of the next step, not self, not of its own step); `background.js` step loop (L4344–4706): `checkR1` before every fill attempt and every transition; `clickAction` shared by opener / transition (exact-one, MAIN world, origin guard, `transition_missing` / `transition_ambiguous` at the deadline); `pollReadiness` after a transition treats `frame_correlation_unavailable` as not ready, top-document injection failure during navigation → not met (via `specialDeclaredReadinessMet`), foreign origin → fail closed; `afterVerifiedFill` → transition only after a verified fill; last step → finish (no submit); per-step credential subset (L4187). Hub/Ext gate parity on 21 plans; 16 checks / 18 mutations; 121.2 verify unchanged; 54/54; build + tsc + `node --check` 0. Decisions accepted: failure step naming (click → step i; readiness → step i+1); origin re-check before fills also for FLOATING (stricter, parity kept); split approve copy (FSMS «…בשלב מאוחר יותר» vs MULTI_STEP gate failure «המיפוי אינו תקין להרצה…»); no new Digital Home copy. **Residuals:** (r1) gesture evidence after a navigation split usually «not proven» in the Admin result — evidence only, run unaffected; Owner to report if the wording confuses. (r2) fieldId uniqueness blocks Maccabi (ID on two steps) — addressed by D-121-63 C. (r3) G11 closed for MULTI_STEP (runnable) and FSMS (approve guard).

#### Maccabi M1 — choice screen between steps (Owner, 2026-09-29)
Flow: screen A (ID) → «המשך» → screen B (no credential fields: «קוד חד־פעמי ב-SMS» / «שיחה קולית» / link «כניסה עם סיסמה») → click «כניסה עם סיסמה» → screen C (ID again, empty + password). Not expressible today: (1) every step needs ≥1 field mapping (`emptyFieldMappings`); (2) a transition's readiness must be a field of the next step (`readinessNotDeclaredField`) — B has none; (3) 121.3 R-1 forbids the same fieldId in two steps, but ID is needed on A and C; (4) authoring reveal for a transition requires a fresh credential input → B would be «המסך לא נפתח»; (5) D-121-58 auto-Analyze skips a fieldId mapped on an earlier step → ID not proposed on C.

#### D-121-63 — Choice screens and repeated fields in multi-step (OWNER APPROVED / AUTHORIZED 2026-09-29, after 121.3 review PASS)
Owner Q (impact on existing multi-step): answered — additive only; each part applies only where today's plan/authoring fails (step without fields, next step without fields, repeated fieldId, no fresh field after a transition, a new element for an earlier field). Residual: authoring may take an error screen with a login-word link for a choice screen → visible to the Admin («זה לא הכפתור»); runtime still exact-one + readiness.
- **A. Action-only step.** A non-last MULTI_STEP step may have no field mappings when it has an approved exit transition (a choice screen). Step 1 and the last step still need fields.
- **B. Readiness into an action-only step** = that step's exit button (exact-one eligible; not the action itself; same frame rules). Validator + runtime gate + Ext parity accept it only in this case; otherwise readiness stays a declared field (unchanged).
- **C. Repeated field.** The same fieldId may be mapped in more than one step; the value is sent to each step that maps it (per-step subset, R-4 unchanged otherwise). Replaces the 121.3 R-1 "exactly one step" rule.
- **D. Authoring reveal for a transition** succeeds when fresh credential inputs appear **or** a fresh eligible action candidate from the Analyze vocabulary appears in a newly revealed surface (screen B) while the tested button is gone; the step is created as action-only and the follow-up panel proposes its exit («כניסה עם סיסמה»). Test → step 3 created → auto-Analyze.
- **E. Auto-Analyze on a later step** proposes a fieldId already mapped earlier only when its locator / frame differs from the earlier mapping (a new element, as on screen C); same element (same-page steps) stays skipped (D-121-58 intent). Visual mapping always allowed.
- Unchanged: `final_submit` reserved; no OTP / SMS handling (the Admin chooses the password option); no site branches; origin rules; manifest.
- Verify: fixture A → B → C (navigation + same page), readiness into B = B's exit, repeated ID filled on A and C, B with fields rejected as action-only misuse, last step without fields rejected, Gmail-shape plans unchanged; mutations.

**Architect Review — D-121-63 (2026-09-29): PASS (offline); Owner live Maccabi pending.** Read: `runtimeGate.ts` `stepRows(allowEmpty)` only for middle steps; `readinessValid(…, revealedExit)` — into an empty step readiness must equal that step's exit (locator + frame), still not self / not own-step field / not pending; fieldId uniqueness removed (C). `background.js`: readiness into an action-only step checked with `target: 'action'` (exact-one + `ManagedTargetEligibility.isVisible`) — required because the field path (`isSafeFillTarget`) never accepts a button / link; field readiness unchanged. Authoring `revealActionsOnly`: only after no fresh credential input, needs pre-click action snapshot (none → never actions_only), fresh vocabulary action not present before (skipped frames excluded) AND `specialAuthoringActionGone` for the tested button; FLOATING / declared never request it. Editor: actions_only writes no fields; follow-up proposes the choice screen's exit. Evidence: `verifyPhase121ChoiceScreen.mjs` 38 checks / 29 mutations (runtime A→B→C same page + navigation, readiness into B checked as action never as field, readiness timeout names step-2 / exit-1, rejected plans across validator / completeness / Hub gate / Ext, authoring accept / reject cases, rule E); 55/55; build + tsc + `node --check` 0; Runtime hash pins hold via revert libs. Decisions accepted: completeness line normalizes readiness before checking (gate stays authoritative; parity on shape verdicts); flake fix in `verifyPhase121AnalyzeProposalQuality` (fixture deadline 120 → 1500 ms, mutation still caught). **Residual:** if screen C's ID is the same element as A's, rule E skips it → Visual mapping on step 3.

#### Maccabi M2 — Owner live authoring (2026-09-29)
Reached step 3 via the choice screen (D-121-63 D works live); step 3 got `#idNumber2` for ID (rule E works — new element). Two findings:
- **M2-a Password not proposed on step 3.** The step grid lists only «מספר תעודת זהות» — the grid rows are the service's login fields, so Maccabi's credential fields contain no password field. Not a defect: nothing can map a field the service does not declare. Owner action: add «סיסמה» (type password) in the service's login fields, then «זהה» on step 3.
- **M2-b Save refused: «אסור לכתוב מיפויי SPECIAL לתוך autofillProfile.fieldMappings.»** `SpecialLoginDraftEditor.tsx` L501–506 runs `assertNoSpecialDualWriteToAutofill` against the row's **saved STANDARD** `autofillProfile`; the overlap rule (L312–331) fails when any STANDARD mapping has the same fieldId + locator as any SPECIAL step mapping. Maccabi's STANDARD profile maps the ID field on screen A to the same element as SPECIAL step 1 → false positive. The SPECIAL save writes only `loginFlowPlan`; it never writes `autofillProfile`, so the check blocks a legitimate save based on data this save does not touch. Generic: any site whose STANDARD mapping and SPECIAL step share an element (e.g. an ID field on the first screen).

#### D-121-64 — SPECIAL save guard checks what the save writes (OWNER APPROVED / AUTHORIZED 2026-09-29)
Save path read: `saveDraft` (L494–526) sends `{...withoutLoginContractKeys(row.metadata), loginFlowPlan: {draft}}` — `autofillProfile` passes through unchanged from the row.
- Replace the locator-overlap rule on SPECIAL save with the real invariant: the SPECIAL save patch does not add, change or remove `autofillProfile` (and never writes a `frame` key into it). Equal locators between STANDARD and SPECIAL are allowed.
- Keep the `frame`-in-autofill rule where autofillProfile is written (STANDARD grid save) — unchanged.
- Unchanged: STANDARD save path, merge guard, contract, runtime, manifest; no site branches.
- Verify: SPECIAL save with a STANDARD profile sharing fieldId + locator → saved, `autofillProfile` byte-identical before / after; a SPECIAL save patch that touches `autofillProfile` → refused; STANDARD grid `frame` rejection unchanged; mutations.

**Architect Review — D-121-64 (2026-09-29): PASS (offline).** Read: `SpecialLoginDraftEditor.tsx` `saveDraft` (L493+) and `activateSpecial` (L557) build the patch with `withoutAutofillProfile(...)` and run `assertSpecialWriteKeepsAutofillProfile` on that exact patch before writing; guard (`specialDraftAuthoring.ts` L344–363): key absent → ok; present → must equal the row value (key order ignored) and carry no `frame`; overlap rule removed. Omitting the key is safe: `updateGlobalRegistryRow` merges `{...existing.metadata, ...patch.metadata}` → stored profile kept verbatim, and the autofill re-plan branch (L570) is not entered. **Beyond-spec accepted:** omission instead of passthrough — required, otherwise the autofill branch re-validates the STANDARD profile against new login fields (same root cause as M3). **Finding accepted, no change:** the STANDARD grid never rejected `frame` — its parser drops the key, so a frame never reaches the DB; the invariant (no frame in `autofillProfile`) holds; refusing instead of dropping is not needed. Evidence: `verifyPhase121SpecialSaveGuard.mjs` (real save / approve code vs in-memory registry; ID-only and after adding «סיסמה»; byte-identical profile; refusals write nothing) 7 groups / 10 mutations incl. restoring the overlap rule; 56/56; build + tsc + `node --check` 0. **Scope gap:** D-121-65 (service form save) NOT implemented in this slice — `RegistryAdmin.tsx` still re-submits `form.metadata` with `autofillProfile` → adding a required login field to a service with a STANDARD profile still fails. Sent to the Developer as the next slice.

#### Maccabi M3 — cannot add a login field (Owner, 2026-09-29)
Owner: service has only «ת.ז»; adding «סיסמה» in the service form → «שמור» → «יש למפות בורר CSS לכל שדה כניסה נדרש.» (`AUTOFILL_PROFILE_ERROR.missingRequiredMapping`). Root cause: `RegistryAdmin.tsx` service save builds `metadata = {...withoutLoginContractKeys(form.metadata), …}` — it re-submits the row's saved STANDARD `autofillProfile`; `adminRegistryApi.updateGlobalRegistryRow` L570–598 sees the `autofillProfile` key in the patch → `mergeAutofillProfileMetadata` → `planAutofillProfileWrite` validates the old STANDARD profile against the NEW login fields → the new password field has no STANDARD mapping → refused. A service-details save that does not intend to write the STANDARD mapping is blocked by it. Not SPECIAL-specific (any service with a saved STANDARD profile cannot gain a required login field); the SPECIAL flow only made it visible. Existing Phase 120 mechanism already covers the stale profile: a login_fields change bumps `metadata_version` → the validated profile is version-mismatched → Managed fill does not use it until re-validated.

**Architect Review — D-121-65 (2026-09-29): PASS (offline).** `RegistryAdmin.tsx` global + user-owned edit send `withoutAutofillProfile(metadata)` (profile + 3 control keys dropped; create unchanged); user-owned path included — it wrote metadata directly and could overwrite the stored profile with a stale form copy (extra fix, accepted). Evidence: `verifyPhase121ServiceFormSave.mjs` (real form save vs in-memory registry) 6 groups / 7 mutations; old code reproduces the Owner error; 57/57; build + tsc + `node --check` 0. **Correction of the Architect spec:** the claim "metadata_version bump → profile version-mismatched" was wrong — `isVersionMatchedValidated` compares `validation.metadataVersion` with the profile's own `configVersion`, never the row's `metadata_version`. Users stay protected by `mappingsCoverRequiredSchema` = false (managed autofill not eligible until the new required field is mapped). **Residual UX gap G12:** the regular grid status still reads «אושר» while users are not filled by it → candidate D-121-66 (status reflects missing required mapping).

#### Maccabi M4 — Owner live re-test (2026-09-30)
All three steps authored: step 1 ID `#idNumber` + «המשך»; step 2 action-only + `a[aria-label="כניסה עם סיסמה"]` (status «נבדק ונבחר — המסך נפתח»); step 3 ID (different element) + password. «שמור מיפוי» succeeded (D-121-64 live OK). Completeness line and «בדיקת מילוי» both: «המיפוי לא מלא: פעולת זרימה חייבת להיות מאושרת לריצה לפני הפעלה.» → at least one step exit (or legacy preamble action) has `approvedForRuntime` false. The visible panel shows only the step-2 exit (chosen), so the failing one is most likely step 1's «המשך» — invisible in the UI. Only code path that clears a chosen action's flags: a failed «בדוק» press (`actionAfterTestFailure`, D-121-62 gap), e.g. pressing «בדוק» on «המשך» again after the site already advanced. The message does not name the step.
**UX finding G13 (Owner):** the button panel is not tied to the step selector — it shows the last proposal / last tested action regardless of the selected step; switching steps changes the field rows but never shows that step's saved exit button or its status. Unmanageable at hundreds of sites; also hides M4's cause.

#### D-121-67 — Per-step button view + a failed re-test never un-chooses (OWNER APPROVED / AUTHORIZED 2026-09-30, incl. amendment E; folds D-121-62 → D-121-62 CLOSED as superseded)
- **A. Per-step button.** For multi-step patterns, the button panel follows «שלב נוכחי»: it shows the selected step's saved exit transition (locator, location, status «נבחר» / «ממתין לבחירה» / last test outcome) with «בדוק…» / «זה לא הכפתור» acting on that exit; the last step shows «שלב אחרון — אין כפתור מעבר». FLOATING_SCREEN keeps one opener panel (unchanged).
- **B. Proposals belong to a step.** An Analyze / follow-up proposal is shown only while its target step is selected (target = the step whose exit it would become); after a successful test the view follows the revealed step (D-121-58) and the tested button stays visible under its own step.
- **C. Keep a proven choice (D-121-62 A).** A failed re-test of an already chosen action keeps both flags and the draft; status «הבחירה הקודמת נשמרה. אם האתר כבר התקדם, זה צפוי — כדי לבדוק שוב חזרי לדף הכניסה.»; unchosen action → today's behavior; un-choosing only via «זה לא הכפתור».
- **D. Messages name the place.** Completeness / fill-test messages for an action or a field include the step: e.g. «המיפוי לא מלא: כפתור המעבר של שלב 1 עדיין לא נבחר — בחרו «שלב 1» ובדקו אותו.»
- **E. Re-map a step's button (Owner amendment 2026-09-30).** In the per-step panel, next to the step's button, a «מיפוי חזותי» button (same armed Visual pick as «סמנו בעצמכם את כפתור המעבר בין השלבים») replaces **that step's** exit at any time — also after the step was passed or its button chosen. The new button is written as that step's exit with status «ממתין לבדיקה» (not chosen: a runtime-approved action always passed a live test — R3 unchanged); «בדוק» sits beside it. Replacing a step's button never deletes later steps or their fields; readiness is re-derived. A step without a button (not last) shows «אין כפתור מעבר» + «מיפוי חזותי». Same for FLOATING_SCREEN opener (one panel, «מיפוי חזותי» replaces the opener). Goal: no multi-step site ever needs delete + rebuild for a wrong button.
- Unchanged: contract, validator rules, runtime, extension, manifest; no site branches.
- Verify: per-step panel content for 3-step fixture (step exits + last step text); proposal hidden on other steps; re-test failure on a chosen exit keeps flags; unchosen still clears; «זה לא הכפתור» clears only that step's exit; step-named completeness messages; FLOATING unchanged; mutations.

**D-121-67 implementation review — PASS (2026-09-30).** Evidence (Developer): 58/58 verify incl. new `verifyPhase121StepButtons.mjs` (20/20 mutations), `tsc -b`, build, `node --check`, lint clean. Code read: `specialActionBar.ts` — `stepButtonView` (exit / last / none), `proposalShownOnStep` (stored exit never duplicated; openers unaffected), `remapStepExit` / `remapFloatingOpener` write the pick un-chosen then `rederiveRevealReadiness`; `placeTransitionAsStepExit` keeps later steps + fields; `clearStepExit` touches only that step. `locateDraftGap` walks exactly the `validateSpecialPlanComplete` order (step rows → exits in order → preamble), and `invalidFrame` falls through rows → actions as the validator does → the first match is the failing element (sound). Contract / validator / runtime / extension untouched.
Accepted deviation: D "field" naming — unreachable (parse rejects bad rows first); field-row gaps are named by step («שלב N: …»).
Accepted decision: re-map pick inside a not-yet-approved frame → proposal only (fail-closed).
Note G14 (copy backlog, non-blocking): when step 1's exit fails `readinessNotDeclaredField` because the next action-only step has **no** exit, the message names step 1 (validator order) though the missing piece is step 2's button. A present-but-unchosen step-2 button is named correctly («כפתור המעבר של שלב 2 עדיין לא נבחר»).
Owner live: Maccabi steps 1–4 per Developer report. D-121-67 CLOSED on live PASS. Next Developer item: D-121-68 (+ amendment).

#### eBay E1 — fill fails on step 1 (Owner live, 2026-09-30)
Authoring OK (email typed manually → «Continue» tested → step 2 mapped). «בדיקת מילוי»: `fill · targets_not_ready · field-3d3a0ad2 · zero_match · #susi_email10180167914112292 · top` (matchCount 0). Root cause: the email locator is an id with a per-load generated number (`susi_email` + 17 digits) — valid during authoring, absent on the next load. `locator-determinism.js` `isUnstableId` (D-121-48) misses it: not a framework pattern; `hasLongHexRun` requires a hex letter in the run (this run is digits only); `hasCounterSiblings` needs a same-stem sibling. Not related to the Developer's in-progress UI work.

#### D-121-68 — Long digit runs make an id unstable (OWNER APPROVED 2026-09-30 — Developer, after D-121-67)
- `isUnstableId`: an id containing a run of ≥ 8 consecutive digits (timestamps, random suffixes) is unstable → never used as a locator (id, `[for]`, `[aria-*]` references), same as other generated ids; the builder falls back to the existing stable candidates (name, autocomplete, type, label, form / test attrs, D-121-48 anchored structural). Applies wherever `isUnstableId` / `locatorReferencesUnstableId` already apply (SPECIAL authoring fields + actions, Visual pick with stable locators).
- Hub parity: `src/assistedMapping/locatorDeterminism.ts` if it mirrors the rule.
- Existing eBay mapping: re-run «זהה» on step 1 (or «מיפוי חזותי» on the email) after the fix.
- Unchanged: STANDARD legacy builders, contract, runtime, manifest; no site branches.
- Verify: `susi_email10180167914112292` → unstable, fallback locator chosen and exact-one after a re-render with a new number; ids with ≤ 7-digit runs (`step2`, `field_2024`, `otp6`) unchanged; mutations.

**D-121-68 amendment (OWNER APPROVED 2026-09-30) — supersedes the scope lines above:**
- **`name` too:** a `name` value with a ≥ 8-digit run is unstable → `[name=…]` candidate dropped (fields + actions).
- **All patterns:** the volatile-token filter (D-121-48 unstable ids + D-121-68 digit-run ids / names) applies in every authoring candidate builder — STANDARD, FLOATING_SCREEN and SPECIAL; Analyze (`page-structure-inspect.js` `buildCandidates`, incl. the non-stable call sites) and Visual pick (`visual-target-pick.js`), fields and actions. When the filter leaves no exact-one candidate, the anchored structural fallback (`anchoredStructuralCandidates`) applies for every pattern. The other SPECIAL-only extras (placeholder, form/test attrs, shared aria-label rule) stay SPECIAL-only.
- **No candidate left → the control is not offered** (existing behaviour; never save a volatile locator).
- Unchanged: runtime resolution, saved mappings (re-map to benefit), contract, manifest; no site branches.
- Extra verify: STANDARD Analyze on a field whose id / name carry a per-load number → stable locator; STANDARD field with a stable id → identical output to today (regression); FLOATING_SCREEN Visual pick same.

**D-121-68 (+ amendment) implementation review — PASS (2026-10-01).** Evidence (Developer): 59/59 verify incl. new `verifyPhase121DigitRunIds.mjs` (8/8 mutations: threshold 8→9 / 8→7, digit rule, name rule, SPECIAL-only re-gate ×2, STANDARD anchored removal ×2), build, `tsc -b`, `node --check`, lint clean. Code read: `locator-determinism.js` `VOLATILE_DIGIT_RUN = 8`, `hasLongDigitRun` in `isUnstableId`, `isUnstableName` + `[name=…]` rejection in `locatorReferencesUnstableId`; `page-structure-inspect.js` / `visual-target-pick.js` `buildCandidates` filter for every caller, anchored fallback for every caller (uncapped push), SPECIAL-only extras still gated by `stableLocators`. Hub: no candidate builder → no parity change (confirmed).
Accepted: anchored fallback runs whenever no exact-one candidate remains (not only when the filter caused it) — also helps STANDARD controls that previously had only multi-match candidates; stable-id / stable-name output byte-identical (verified against reverted sources). D-121-48 id rules now in STANDARD (amendment, as stated to the Owner). aria-label not digit-filtered (in spec).
Owner live: eBay — reload extension → step 1 «זהה» / «מיפוי חזותי» on email (locator ≠ `#susi_email…`) → save → «בדיקת מילוי». D-121-68 CLOSED on live PASS.

#### Live 2026-10-01 — Maccabi + Gmail PASS (Admin fill); eBay E2
- Maccabi (D-121-67) and Gmail (121.3 / D-121-63): Admin «בדיקת מילוי» PASS → D-121-67 CLOSED. Digital Home check pending for both.
- eBay E2: after D-121-68 the email locator is `#userid` (stable — D-121-68 effective). Step 1 holds **two** fields: email `#userid` + password `#pass` (both top frame), though step 1 shows only email live (likely a hidden / pre-rendered password input mapped during earlier authoring). Completeness: «כפתור המעבר של שלב 1: תנאי המוכנות חייב להיות שדה כניסה שמופיע בשלב הבא» — the next step has no field matching step 1's exit readiness (password sits in step 1). No per-field remove exists for SPECIAL (backlog) → Owner deletes + rebuilds (test env).

#### D-121-69 — Remove one mapped field in a SPECIAL step (OWNER APPROVED / AUTHORIZED 2026-10-01 — Developer; applies to FLOATING_SCREEN + MULTI_STEP)
- In the SPECIAL field list of the selected step, each mapped field gets «הסר מיפוי» (draft only, until «שמור מיפוי»): removes that row from that step only; other steps, buttons and fields kept; readiness re-derived (`rederiveRevealReadiness`); completeness line updates. Credential schema (login_fields) unchanged.
- The field can then be re-mapped in the correct step (Analyze / «מיפוי חזותי»).
- Unchanged: contract, validator, runtime, extension, manifest; STANDARD editor; no site branches.
- Verify: remove from step 1 keeps step 2 rows + exits; readiness pointing at a removed row re-derives or reports the step-named gap; save round-trip; mutations.

**D-121-69 implementation review — PASS (2026-10-01).** Evidence (Developer): 60/60 verify incl. new `verifyPhase121RemoveFieldRow.mjs` (8/8 mutations), `tsc -b`, build, `node --check`, lint clean; extension unchanged. Code read: `removeStepFieldMapping` filters one fieldId in one step, no-op when absent, then `upsertStepFieldMappings` + `rederiveRevealReadiness`; editor `removeFieldRow` acts on `currentStepId` only; button only on mapped rows. Guards D-121-64 / D-121-65 unaffected.
Accepted behaviour: last field removed from a middle step with an exit → action-only step (valid, D-121-63); a chosen exit whose readiness re-derives stays chosen (same as every editor re-derive; runtime gate + «בדיקת מילוי» still validate). D-121-69 CLOSED on Owner live (optional — eBay already rebuilt; test by mapping a field into a wrong step and removing it).

#### Live 2026-10-01 — eBay PASS; multi-step slowness (Owner)
- eBay rebuilt → Admin fill PASS (step 1 «זהה» mapped only `#userid`; E2 was a stale mapping) → D-121-68 CLOSED.
- Owner: MULTI_STEP visibly waits several seconds after the step-1 fill before clicking the transition.
- Root cause (code read): the step loop (`background.js` `fillInDocument` → `afterVerifiedFill` → `runTransition`) waits for `runManagedAutofill` to resolve. For `diagnosticPath` `admin_test` / `digital_home`, `validated-autofill.js` chains `observePostRuntimeA24` (Phase 120 A2.4, diagnostic-only) after verify: it holds the result up to `A24_BOUND_MS = 5000` watching for value loss. So every intermediate step adds ~5 s before its exit click, in Admin and for users. It is invisible in single-screen flows (the fields are already filled).

#### D-121-70 — No post-fill observation window before a step transition (OWNER APPROVED / AUTHORIZED 2026-10-01 — Developer)
- In `runSpecialLoginFlow`, a step **with an exit** calls `runManagedAutofill` with a new option `skipPostRuntimeObserve: true` → `validated-autofill.js` skips `observePostRuntimeA24` (A2.3 microtask / rAF / timeout-0 probes stay). The fill + verify outcome is unchanged (A2.4 never changes ok / reason / filled).
- The **last** step keeps A2.4 (diagnostics for the final fill; no visible cost, the user acts on the page).
- STANDARD / FLOATING single-step fills unchanged. R-2 unchanged: the transition is still clicked only after a verified fill.
- Unchanged: contract, gates, manifest; no site branches.
- Verify: intermediate step → no `post_runtime_a24*` stamps, transition dispatched with no 5 s bound; last step → A2.4 stamps present; outcome identical with / without the flag; mutations (flag ignored → bound waits; flag on last step → stamps missing).

**D-121-70 implementation review — PASS (2026-10-01).** Evidence (Developer): 61/61 verify incl. new `verifyPhase121StepFillNoA24Wait.mjs` (real page scripts + real `background.js`, chrome mocked; 5/5 mutations), two byte-pinned verifies revert this slice before comparing, `node --check`, `tsc -b`, build, lint clean. Code read: `validated-autofill.js` `skipA24 = options.skipPostRuntimeObserve === true` gates only the A2.4 chain (A2.3 kept, outcome untouched); `background.js` `fillInDocument` sets the flag only when `step.exit` (last step / FLOATING single step keep A2.4); single sender; STANDARD never sends. R-2 order unchanged.
Owner live: reload extension → MULTI_STEP «בדיקת מילוי» → transition immediate. D-121-70 CLOSED on live PASS.

#### Yahav Y1 — visual pick of the password field rejected (Owner live, 2026-10-01, DIAGNOSING)
FLOATING_SCREEN. Opener identified; inside the login frame (login.yahav.co.il) `#username` and `#pinno` mapped (pinno by visual pick). Visual pick on «סיסמה» → `unsupported_target` («האלמנט שנבחר אינו נתמך למיפוי. בחרו שדה קלט גלוי.»), even with the field focused first.
Code path (`visual-target-pick.js` field branch): `event.target` must be an identifiable control. Otherwise only the D-121-49 `<label>` → control fallback runs. So the click lands on a non-input element over or around the field (likely: a floating label / placeholder element that is not a `<label>`, a transparent overlay of a masked / anti-keylogger password widget, or a non-input custom widget).
Diagnosis requested from the Owner: the element stack under the field centre (tag / id / class / type only, no values). Candidate generic direction (not approved): when the target is not a control, resolve the single visible fillable input under the click point (`elementsFromPoint`, same document), exact-one, fail-closed. Decide after the diagnosis.
**Diagnosis (Owner DevTools, 2026-10-01):** the right-click landed on `DIV.forgotpwd` («הפקת סיסמה» block); the stack at the field centre is `INPUT#password.form-control[password]` → `DIV.form-group` → `FORM#loginform`. Root cause: the forgot-password block overlaps the lower part of the input (the underline the Admin clicks), so `event.target` is the DIV, not the input. The field itself is a normal password input; runtime fill (locator-based) is unaffected. Owner workaround: click the middle of the field. Generic fix D-121-71 proposed: point-under-click resolution (`elementsFromPoint` at the click coordinates, same document, the single visible identifiable fillable input; none / more than one → unchanged `unsupported_target`).
**Owner live (centre click):** the pick now lands on `INPUT#password` but is rejected «השדה זוהה, אך אינו כשיר למילוי אוטומטי מנוהל». Cause: `managed-target-eligibility.js` `classifyHitTest` requires EVERY in-view sample point (centre, left / right 25%, top / bottom 25% inset) to hit the target. The lower 25% point hits `DIV.forgotpwd` → `occluded`. The same gate runs in Analyze (why the system did not find the field), in `fill-executor.js` and in `validated-autofill.js`, so the runtime fill would fail too. The workaround is not enough → a generic fix is needed.

#### D-121-71 — Partial-occlusion tolerance in the Managed hit-test, plus a point-under-click pick (OWNER APPROVED / AUTHORIZED 2026-10-01 — Developer, both parts)
1. `classifyHitTest` (V8): PASS when the centre point is in view and hits the target (same `hitRelationshipOk`), AND at least 3 of the in-view sample points hit the target. Otherwise unchanged (`occluded` / `not_interactable`). The one bounded `scrollIntoView` retry stays. A full overlay (modal / cookie banner covering the centre) still fails. Applies to every caller (Analyze, visual pick, fill executor, validated autofill; STANDARD and SPECIAL alike). No site rule.
2. Visual field pick: when `event.target` is not an identifiable control and the `<label>` fallback gives nothing, use `doc.elementsFromPoint(clientX, clientY)` in the same document. Take the identifiable fillable INPUTs in that stack; exactly one → use it; none or more → unchanged `unsupported_target`. Shadow / nested-frame rules unchanged.
No manifest / permission change; `final_submit` reserved; fail-closed.

**D-121-71 implementation review — PASS (2026-10-02).** Code read: `classifyHitTest` — centre in view and hitting the target (else `not_interactable` / `occluded`), then ≥ 3 in-view points via `hitRelationshipOk`; the < 3 in-view rule, `pointer-events:none` and the single scroll retry kept. `pointFillableControl` — `elementsFromPoint` in the same document, distinct identifiable fillable INPUTs, more than one → null; called only after the direct-control and label fallbacks; the result continues through candidates / determinism / eligibility. Evidence: new `verifyPhase121PartialOcclusionPick.mjs` (6 groups, 8/8 mutations incl. the 4 required, STANDARD + SPECIAL, centre-covered resolved input still `occluded`); byte-pinned verifies revert D-121-71 first; regression 65/66 (B-122-1); `node --check`, tsc, build clean.
Accepted deviations: `verifyPhase121OwnLabelHit` edge-overlay assertion flipped to PASS (+ a centre-overlay assertion); centre out of view → `not_interactable` (safety branch); click order direct → label → point.
Owner live: reload extension → Yahav «סיסמה» (Analyze or visual pick, also via the forgot-password overlay) → «בדיקת מילוי» fills without `occluded`. D-121-71 CLOSED on live PASS.

#### D-121-72 — Stop a fill run; a closed tab ends the run (OWNER APPROVED / AUTHORIZED 2026-10-02 — Developer)
Owner live (Dropbox, Admin «בדיקת מילוי»): the site was already logged in, so the fields never appeared; the Owner closed the tab; the button stayed «ממלא…»; after leaving and returning, a new run got «מילוי אוטומטי כבר בתהליך לפרופיל זה. המתינו לסיום הניסיון הנוכחי.» with no tab open.
Code read: the Hub lock is the in-memory `managedAutofillInFlightKeys` (`managedAutofill.ts`), released only in `finally` after `sendExtensionMessageAsync` resolves; that call has no Hub-side bound. In `background.js` the run's `chrome.tabs.onRemoved` listener (`attachManagedAutofillDiagLifecycle`) only logs — closing the tab does not end the run, so the run waits for its internal waits and the Hub lock stays (until a page reload clears the Set).
Proposal (generic; no manifest / permission change; `final_submit` reserved; fail-closed):
1. Extension: the run's tab being closed ends the run at once with `{ ok:false, reason:'tab_closed' }` (STANDARD Managed run and SPECIAL step run); all listeners / timers of that run detached; no further fill.
2. Extension: a cancel message (e.g. `HUB_MANAGED_AUTOFILL_CANCEL` with the run's executionKey / runId) sets the run cancelled; the run stops at the next checkpoint (between waits / steps / before any fill), answers `{ ok:false, reason:'cancelled' }`, does not close the tab, never fills after the cancel.
3. Hub: a run token per executionKey; «עצור» (Admin «בדיקת מילוי», shown only while running) sends the cancel, releases the lock immediately and ignores any late answer of that token. Messages: «הבדיקה נעצרה.» / «הכרטיסייה נסגרה — הבדיקה הופסקה.».
4. Hub safety bound: if no answer arrives within the run's maximum duration (the longest internal wait + margin), the lock is released with a «הבדיקה לא הסתיימה בזמן» outcome; a late answer is ignored.
Items 1 and 4 also protect Digital Home (same convergence lock); the «עצור» button is Admin-only.

**D-121-72 implementation review — PASS (2026-10-02), with one open regression question.** Evidence: new `verifyPhase121StopFillRun` (real `background.js` + real Hub modules; 16 checks, 7/7 mutations: tab closed mid-wait, cancel mid-wait, unknown cancel, SPECIAL between steps, «עצור» releases the lock + late answer ignored, Hub bound STANDARD / SPECIAL, Digital Home inherits); 122 verify 30 groups / 71 mutations; `fillRunControl.ts` single token owner, bound 260s derived from existing constants (120 + 120 + 20); tsc / build / `node --check` clean; screenshot «ממלא… + עצור» conforms.
Accepted deviations: SPECIAL no-answer → `run_timeout` without opening the page (was `extension_unavailable` + open); the bound also sends the cancel; an in-flight fill call cannot be recalled but its return is inert; stopped = notice, not error; duplicate run id → `busy`.
**Open — R-72-1:** the END-OF-ROUND run used 88 scripts (earlier rounds 65–67). New failures outside the usual set: 101 / 102 (need live Supabase — acceptable), 105 / 106 / 107 / 108×3 (stale file / wiring checks — to classify), and **112IdentityFirst "fails in the generic fill scripts"**. Developer says those scripts did not change after 29.09, but `managed-target-eligibility.js` (D-121-71) and `locator-determinism.js` (D-121-68) did. Required: bisect 112IdentityFirst against HEAD with D-121-72 / D-121-71 / D-121-68 reverted (existing edit libs) and report which slice, if any, flips it; then fix the cause or record it as stale with evidence.
**R-72-1 result — CLOSED, no product regression (2026-10-02).** Bisect: 112IdentityFirst fails with D-121-72, D-121-71 and D-121-68 all reverted; last PASS `78d44d2` (Phase 113), first FAIL `e22caf2` (Phase 120.6), where `form-detector.js` `isVisible` began delegating to `ManagedTargetEligibility.isVisible` and the extension loads that script first; the verify never loads it → stale verify (confirmed: with the script loaded + hit-test stub, fill ok). 105 / 106 / 107 / 108CustomDiscovery / 108LivePath check copy / files / wiring removed in Phases 109–117 (stale); 108FalsePositiveGate imports `jsdom` (never a dependency); 101 / 102 are live-Supabase tests (fail at TLS `SELF_SIGNED_CERT_IN_CHAIN` from Node — local HTTPS inspection, not a product issue). Extension bytes restored identical.
Follow-up B-122-2 (test hygiene, scripts only) — OWNER APPROVED / AUTHORIZED 2026-10-02: fix 112IdentityFirst (load eligibility first + hit-test stub); retire 105 / 106 / 107 / 108CustomDiscovery / 108LivePath / 108FalsePositiveGate into `scripts/retired/` with a one-line reason each (superseded); mark 101 / 102 live-only (out of the offline regression list). B-122-1 closes with 107's retirement.
**B-122-2 review — PASS (2026-10-03).** 6 verifies moved to `scripts/retired/` + README (reason + superseding commit each); 112IdentityFirst loads the eligibility script first (static check: same list / order as `background.js`), hit-test stub, mutation caught; 101 / 102 LIVE-ONLY header; new `scripts/runOfflineRegression.mjs` (top-level `verify*.mjs`, LIVE_ONLY excluded) — the official offline regression from now on: 80 / 80 PASS. No product / extension / package change. Accepted deviations: new runner file (none existed); fixture global reset between runs; retired scripts not runnable from `retired/` (documented); historical docs keep old commands. **B-122-1 CLOSED.** The offline regression is green for the first time since Phase 117.

#### Beinleumi B1 — segment entry pages (Owner question, 2026-09-30)
Site: home page links to per-segment sites (private / business / platinum), each with its own URL; inside, «כניסה לאזור האישי» opens a floating screen. Owner proposal: one catalog service per segment. **Architect recommendation: yes.** Each segment = its own service with its segment URL as the login entry (direct URL) + FLOATING_SCREEN mapping — fits the existing model (a service = one login entry + one plan), zero development, no chained «segment link → opener» plan (that would be a 2-action preamble, outside 121.2 shape / 121.4). Segment accounts usually have separate credentials, so separate vault entries are natural. Only cost: catalog naming — use clear names («הבינלאומי — פרטי», «הבינלאומי — עסקי», …). Revisit a generic "segment chooser" only if more such sites appear. No decision record needed (Admin configuration only).

#### D-121-66 — Regular mapping status shows a missing required field (PROPOSED → Owner: not now, backlog)
- `standardMappingStatus`: when the saved STANDARD profile does not cover the current required login fields (`mappingsCoverRequiredSchema` false), show «חסר מיפוי לשדה חדש — מפו אותו ושמרו. עד אז המשתמשים לא יקבלו מילוי מהמיפוי הרגיל.» instead of «אושר». Display only.
- Unchanged: profile data, eligibility, Phase 120 save / approve semantics, SPECIAL; no site branches.
- Verify: approved profile + added required field → new status; after mapping + save → «נשמר — עדיין לא אושר למשתמשים» (unchanged); covered profile → «אושר» unchanged; mutations.

#### D-121-65 — Service-details save never re-writes the STANDARD mapping (OWNER APPROVED / AUTHORIZED 2026-09-29; bundled with D-121-64)
- The service form save (create excluded — no profile yet) omits the autofill keys (`autofillProfile` + autofill control keys) from its metadata patch, like it already omits login-contract keys; the row's stored profile stays byte-identical (passthrough by the DB merge).
- Changing login fields is therefore always possible; the existing `metadata_version` bump marks the STANDARD profile stale (unchanged Phase 120 behavior); the STANDARD grid shows it needs re-mapping as today.
- Unchanged: STANDARD grid save validation (`missingRequiredMapping` still enforced where the STANDARD mapping IS written), SPECIAL paths, merge guard, contract, runtime; no site branches.
- Verify: service with a saved STANDARD profile → add a required login field → save succeeds, `autofillProfile` byte-identical, `metadata_version` bumped, `isVersionMatchedValidated` false; STANDARD grid save with an unmapped required field still refused; service create unchanged; mutations.

**Owner regression round — HTZone H1 (2026-09-29).** FLOATING_SCREEN: «נתח» proposed the accessibility-widget button («נגיש בקליק» plugin); «בדוק» opened the accessibility panel. **Root cause (Architect read `specialActionIntent.ts`):** the D-121-47 negative vocabulary has no accessibility words, so a popup-semantics accessibility toggle (tier 2) outranks a plain login control (tier 3). Accessibility plugins are common on Israeli sites → generic.
**D-121-57 (OWNER APPROVED / AUTHORIZED 2026-09-29) — accessibility controls are never proposed first.** Add to the shared negative vocabulary (Hub `ACTION_INTENT_VOCABULARY` + the extension copy, parity verify): `נגישות`, `נגיש`, `accessibility`, `accessible`. Binding guard R-a unchanged: a control with a login word is never demoted — El Al's real opener (visible text «התחברות» + plugin `aria-label` «…לנגיש לקורא מסך…») must stay first (fixture). Analyze-only; manual pick unrestricted; no site branches; saved / ACTIVE untouched. Verify: HTZone-shaped fixture (accessibility toggle with popup semantics + plain login control) → login control proposed; El Al fixture unchanged; Super-Pharm / PAGI / Mizrahi fixtures unchanged; mutations (word missing from one side, login demoted by the new words).
**Architect Review — D-121-57 (2026-09-29): PASS (offline).** Read: the four words appended to both vocabulary copies (Hub `specialActionIntent.ts` L27–30, extension `page-structure-inspect.js` L487–490), identical; ranking code unchanged; R-a holds by existing order (login checked before negative, Hub + extension). Decisions accepted: whole-word + one prefix letter (catches «לנגישות», not «נגישה» / «Inaccessible»); `verifyPhase121InspectReadinessEligible.mjs` scope guard strips the four lines (asserted exactly once) before the pinned hash — hash still matches ⇒ nothing else changed. Evidence: `verifyPhase121AccessibilityNotOpener.mjs` (real collector → real Hub; HTZone plain / with login word, El Al, Super-Pharm, PAGI skip link, Mizrahi — each with three accessibility toggles) 5 mutations; 49/49; tsc + build 0; no lints. Pending Owner live (extension reload first): HTZone «נתח» → login control; El Al «התחברות» still first.
**Owner live HTZone (2026-09-29): accessibility toggle no longer proposed — D-121-57 goal PASS.** Residual H2 (finding only): «נתח» now proposes another wrong control, «כניסת מנויים» (construct form «כניסת» ≠ whole word «כניסה» → plain tier); Owner picked the real opener by Visual and the flow worked. Accepted residual (manual pick is the designed fallback, D-121-47). El Al re-check pending (offline guard PASS).

**Owner regression round — PAGI P1 (OWNER-REPORTED BUG 2026-09-29; correction of approved behavior, AUTHORIZED as C-item — D-121-55).** PAGI re-created (FLOATING_SCREEN, fields in a cross-origin frame): «אשר מסגרת» → «קבל מיפוי» ×2 → «שמור מיפוי» → «בדיקת מילוי» filled both fields → «אשר מיפוי» → confirm dialog «לאשר את המיפוי ל…?» → green «המיפוי אושר». **After F5:** status «נשמר — עדיין לא אושר למשתמשים»; «פרטים טכניים» → «פעיל כעת: STANDARD». Digital Home does not fill (consistent: no SPECIAL activation ⇒ resolved STANDARD, and the re-created site has no STANDARD profile). ⇒ The approval write reported success but `loginContractActivation` (and `loginFlowPlan.active`) are **not** in the stored row; the saved draft is (status reads «נשמר»).
Architect read (no root cause yet): `SpecialLoginDraftEditor.activateSpecial` sends `{...row.metadata, loginFlowPlan:{draft}, loginContractActivateIntent:{STANDARD_TO_SPECIAL, draft}}` via `updateGlobalRegistryRow`; `mergeLoginContractMetadata` intent branch → `planLoginContractActivate` → patch with activation + bag; success copy is set after the awaited write with no read-back. No DB trigger touches these keys (grep). Update is filtered `.eq(id).is(owner_user_id, null)` — a 0-row update returns no error. Candidates: (a) 0-row update / wrong row; (b) activation dropped between merge and write (autofill block / later overwrite by another writer spreading stale metadata); (c) a later write (reload-time effect, fill-test stamp, normalization save) replacing the contract keys. Needs runtime evidence.
**D-121-55 scope:** (1) find the root cause with evidence (payload before `.update`, row read-back after write, any later write to the row in the same session); (2) fix so that «אשר מיפוי» on a SPECIAL draft persists activation + active (frame-bearing plans included); (3) fail-closed success: «המיפוי אושר» only after a read-back confirms `resolveActiveLoginContract(row).mode === 'SPECIAL'` with the new version; otherwise «אישור המיפוי נכשל.» (+ raw reason under «פרטים טכניים»). Applies to every SPECIAL pattern; STANDARD approval path unchanged unless the same root cause is proven there (report first). No contract / validator / runtime / manifest change; no site branches. If the fix needs a contract or storage change → STOP and report. Verify: activation persisted and read back (top-document and framed plan); 0-row / dropped-key write → failure message, not success; STANDARD approve unchanged; mutations.
**Architect Review — D-121-55 (2026-09-29): PASS (offline); root cause pending Owner re-run.** Read: `updateGlobalRegistryRow` now `.select('id')` after update → `{ updatedRows, writerUserId, writtenSpecialVersion }` (0 rows still no throw — other callers unchanged); console `[D-121-55 registry contract write]` (modes, row count, 8-char writer prefix; no content / values). `specialApproveReadback.ts` fails on: 0 rows; write without SPECIAL activation; re-approval without version bump; row not found; read-back not SPECIAL; version ≠ written; active content ≠ approved (`planContentKey`). Editor shows «המיפוי אושר» only on pass; else «אישור המיפוי נכשל.» + reason under collapsed «פרטים טכניים». Developer evidence: simulated-DB replay of save → approve (framed plan) sends activation v1 + active, 1 row, read-back SPECIAL ⇒ client planner / merge correct; no triggers; other writers preserve activation. Decisions accepted: version from the sent payload; 0 rows = failure regardless of read-back; no up-front non-admin block (session / permission change — out of scope). Verify `verifyPhase121ApproveReadback.mjs` 21 checks / 11 mutations; `verifyPhase121ApproveSavedOnly.mjs` stub only; 47/47 (known Analyze-quality flake); tsc + build 0; no lints.
Architect note on the leading hypothesis (0 rows, non-admin session): the PAGI draft save used the same function and **did** persist (status «נשמר» after F5), so a non-admin session would require the session to change between save and approve (e.g. a Digital Home sign-in in the same browser). The re-run log discriminates. **Backlog (flagged, not authorized):** (B1) every admin global-row write treats 0 rows as failure (STANDARD approve / save included); (B2) Admin detects a non-admin session and says so instead of silently writing nothing.
**D-121-51 A1 (WITHDRAWN — was: keep users' credentials).** Owner objection (valid): (1) the Admin may re-map minutes later — users should not re-enter credentials; (2) copy/paste users (no extension) lose a site they use. Architect agrees: user credentials do not depend on the site's mapping; the original "remove from users too" came from the initial request, not from a technical need. **Revised design:** «מחיקת אתר» removes only site-level data — registry row (built-in re-seeds from the Hub seed), `service_assets` + Storage objects, audit row. `user_services` / `access_profiles` / `encrypted_credentials` are **not** deleted. Clients: a service id missing from the registry is **hidden** (not deleted locally, membership not removed; no re-create of the registry row); when a site with the same id exists again, it reappears with the saved credentials. Caveat: values are keyed by field id — a new setup with different field ids will not show old values (today's behavior, `ID_CHANGE_WARNING`). Dialog: built-in → «אתר מובנה: האתר יחזור מיד למצב ההתחלתי, ללא המיפוי. פרטי הכניסה ששמרו המשתמשים נשמרים.»; other → «האתר יוסתר אצל N משתמשים. פרטי הכניסה ששמרו נשמרים, ויחזרו אם האתר יוקם מחדש באותו מזהה.» / «האתר לא נמצא אצל אף משתמש.»; warning style. Backlog: users cannot see / purge data of a hidden site (production concern).

#### D-121-51 (OWNER APPROVED / AUTHORIZED 2026-09-29 as proposed; after D-121-50 Owner live) — Admin «מחיקת אתר» (full removal, all users)

**Owner request:** a delete-site button that removes the site from every related table and from all users, with a warning when users have it. Main value in testing (re-create a PAGI-style site from zero); rare in production (a badly broken setup).
**Architect read — data footprint:** `service_registry` (row incl. `login_fields` / `metadata`: autofill profile, `loginFlowPlan`, discovery); `service_assets` (FK cascade) + their Storage binaries (not cascaded); `user_services.service_id` has **no FK** → must be deleted explicitly (cascades `access_profiles` → `encrypted_credentials`). **Client risks:** (R1) users' local IndexedDB vault keeps the site's profiles / ciphertext, and dual-write upserts `user_services` from local `selectedIds` → a deleted site can be **resurrected** by a user's next sync; (R2) built-in ids (`hapoalim` … `htzone`, incl. `mizrahi`, `shufersal`) are re-created by `ensure_known_builtin_registry_row` from the Hub seed → delete of a built-in = reset to seed, not removal. PAGI / Super-Pharm / El Al (Admin-created) delete fully.
**Proposed design:**
1. Server: one admin-only `security definer` RPC `admin_delete_service(p_service_id, p_confirm_display_name)` — one transaction: delete `user_services` for the id (cascade profiles + ciphertext), `service_assets`, then the registry row; returns counts. Preflight RPC `admin_service_delete_impact(p_service_id)` → users count, profiles count, built-in flag.
2. Storage: remove the site's asset objects after the transaction (best-effort, reported).
3. Clients: hydrate drops local selection / profiles / ciphertext of a service id missing from the registry and never re-upserts it (closes R1); generic, not site-specific.
4. Admin UI: «מחיקת אתר» (danger) in the site card → dialog with the impact («האתר קיים אצל N משתמשים — הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו») + typing the site name to confirm; built-in: «אתר מובנה — יחזור למצב ההתחלתי ללא המיפוי».
5. Available in all environments (Owner-only Admin), guarded by typed confirmation. No site branches; audit line (who / when / counts).

#### D-121-50 (OWNER APPROVED / AUTHORIZED 2026-09-29; after D-121-45 C1) — «שדות כניסה» editor: plain-language field roles

**Owner request (2026-09-29):** the purpose of «תפקיד מילוי (מתקדם)» is unclear; each field control should be self-explanatory. **Architect read (`CredentialFieldsEditor.tsx` + consumers):** `type` (text / password) is the site-secret role: sent to field Analyze (AI hint), password values are not trimmed, «העתקת סיסמה» copy, fill-test input type, excluded from identity fields, and it drives the `masked` default. `masked` = display only (•••• in the user's vault). `inputType` number = digits-only validation. `id` = storage key (change detaches saved values — `ID_CHANGE_WARNING`).
**Proposal (UI copy / control only; stored shape `type` / `masked` / `inputType` / `id` unchanged; no runtime / contract change):**
| Today | Proposed control | Hint line |
|---|---|---|
| תווית | «שם השדה» | כך השדה יופיע למשתמש. הסוכן משתמש בו גם כדי למצוא את השדה באתר. |
| תפקיד מילוי (מתקדם): טקסט / סיסמת אתר | checkbox «זה שדה הסיסמה של האתר» (checked ⇔ `type='password'`) | המערכת תחפש לו שדה סיסמה באתר, ותשמור את הערך בדיוק כפי שהוקלד (כולל רווחים). |
| סוג קלט: טקסט / מספר | «ערך מותר»: «כל תו» / «ספרות בלבד» | «ספרות בלבד» — המערכת תדחה אותיות (למשל ת"ז). |
| חובה | «חובה למלא» | המשתמש לא יוכל לשמור בלי ערך בשדה הזה. |
| מוסתר | «הסתר את הערך בתצוגה» — when the password checkbox is on: shown checked + disabled | יוצג כ־•••• בכספת של המשתמש. לא משפיע על המילוי. / (password) שדה סיסמה מוסתר תמיד. |
| מזהה | «מזהה טכני», moved under a collapsed «מתקדם» per field | לשימוש פנימי. שינוי ינתק ערכים שכבר נשמרו אצל משתמשים. |
Order: שם השדה → זה שדה הסיסמה של האתר → ערך מותר → חובה למלא → הסתר את הערך בתצוגה → «מתקדם» (מזהה טכני).
**D-121-50 A1 — FINAL (OWNER DECISION 2026-09-29, supersedes the 3-option draft below):** Owner has no site that hides a non-password value → ONE checkbox «זה שדה הסיסמה של האתר» (checked ⇔ type password; on change: checked → masked true, unchecked → masked false); the «מוסתר» checkbox is removed, except for a legacy non-password field with stored masked true, which shows «מוסתר בתצוגה» until cleared. Untouched fields byte-identical. Rows 2 + 5 of the table are replaced by this.
**Architect Review — D-121-50 + A1 (2026-09-29): PASS (offline).** Only `CredentialFieldsEditor.tsx` changed; `sitePasswordPatch` is the single writer of type / masked (checked → password + masked true; unchecked → text + masked false), called only on Admin toggle; legacy «מוסתר בתצוגה» shown only for non-password + masked true; save / load conversion unchanged. Decisions 1–5 accepted (3: legacy control without a hint — accepted, it is transitional). Evidence: `verifyPhase121CredentialFieldCopy.mjs` 7 groups / 16 mutations; 38/38 (one first-loop timing failure in `verifyPhase121AnalyzeProposalQuality.mjs`, passed on re-run and second loop — flaky, backlog); tsc + build 0; no lints. Owner live pending.
**D-121-50 C1 (OWNER-REPORTED BUG 2026-09-29; authorized — copy only).** The «ערך מותר» hint is static, so «ספרות בלבד — המערכת תדחה אותיות (למשל ת"ז).» also shows under «כל תו». Fix: the hint follows the selected value — «כל תו» → «אפשר להקליד אותיות, ספרות וסימנים.»; «ספרות בלבד» → «המערכת תדחה אותיות ותווים שאינם ספרות (למשל ת"ז).» Same principle for the password checkbox hint (it reads as a fact even when unchecked): prefix «כשמסומן:». No stored-shape change.
**Owner live D-121-50 (2026-09-29):** order, password checkbox, saved values, fill test — PASS; only the C1 copy bug. D-121-50 closes after C1 review (Owner re-check of the two hints).
**Architect Review — D-121-50 C1 (2026-09-29): PASS (offline).** Copy present in `CredentialFieldsEditor.tsx` (read): «כשמסומן: …», `allowedAnyHint`, `allowedDigitsHint`; per-value selection; decision (non-digits → «כל תו» hint) accepted. Verify 7 groups / 19 mutations; 44/44; tsc + build 0; no lints. Owner live re-check PASS (2026-09-29) → **D-121-50 (+A1, C1) CLOSED.**
**D-121-50 A1 draft (superseded).** Owner: a site-password field is hidden by definition — why two controls? Architect agrees: replace rows 2 + 5 with ONE control «סוג השדה»: «רגיל» (type text, masked false) / «רגיל — מוסתר בתצוגה» (text, masked true; e.g. ת"ז, card number) / «סיסמת האתר — מוסתר תמיד» (type password). Hints: רגיל — מוצג גלוי למשתמש. / מוסתר — יוצג כ־•••• אצל המשתמש; לא משפיע על המילוי. / סיסמה — המערכת תחפש לו שדה סיסמה באתר ותשמור את הערך בדיוק כפי שהוקלד. Stored values of fields the Admin did not change stay byte-identical (a legacy password field with masked false is shown as «סיסמת האתר» and is not rewritten unless re-selected; choosing «סיסמת האתר» writes type password + masked true). Constraints as usual; verify: stored output byte-identical for the same choices; copy present; disabled-mask rule; mutations.

**Architect note on the future grid (not authorized; backlog):** split inputs (e.g. card digits in 4 boxes, OTP boxes) are a **field-shape** capability, orthogonal to the login pattern — a regular site or a floating screen can both have them. It must be designed as a field-level mapping extension usable by any pattern grid, not as a new «אופי הכניסה» value. Needs its own design + Owner approval.

**Owner decision (2026-09-29): only the grid of the selected «אופי הכניסה» is shown** (STANDARD → «מיפוי אתר רגיל»; any SPECIAL pattern → the SPECIAL grid). The SPECIAL-selected notice inside the STANDARD grid becomes unnecessary and is removed. Selecting STANDARD while the live contract is SPECIAL keeps today's switch-confirm on «אשר מיפוי». «בדיקת מילוי» follows the selected pattern (D-121-43). Unsaved-changes guard: changing the selector while the visible grid is dirty keeps today's behavior (no silent loss).

**Owner live (2026-09-29) — new FLOATING_SCREEN site (El Al), Admin authoring only.** (a) Analyze proposed a wrong opener (a «contact us»-like control) instead of the login button; (b) manual opener pick + test succeeded; fields partially identified, completed by field Visual; (c) «שמור מיפוי» succeeded, but the completeness line shows «המיפוי לא מלא: פעולת זרימה חייבת להיות מאושרת לריצה לפני הפעלה.» and «בדיקת מילוי» refuses with the same message (no run).

**Root cause (c) — generic, Architect read.** `upsertPreambleAction` upserts by `actionId`; the Analyze-proposed candidate and the manually picked opener have different ids → **both** stay in `preambleActions`. The unchosen candidate keeps `approvedForRuntime:false`; `validateSpecialPlanComplete` runs `validateAction` on **every** preamble action → `actionNotApprovedForRuntime`. The primary panel now shows the manual action, so the stale candidate has no visible «זה לא הכפתור» → the Admin cannot remove it. Not El Al-specific: any site where Analyze proposes the wrong opener and the Admin picks manually. (a) needs separate evidence (element HTML) — later.

**SUPERSEDED by the El Al evidence below** — **Architect analysis — (a) wrong opener proposal (2026-09-29, first read).** `collectSpecialAuthoringActionCandidates` ranks only by **popup semantics first, then DOM order**; (correction: a login-intent regex exists in the Hub, `specialAnalyzeRouting.scoreKind`). Any earlier control with `aria-haspopup` / `aria-controls` / `data-(bs-)target` (e.g. contact / chat / menu) outranks a plain login button. Candidate direction (D-121-47, not yet proposed to Owner): add a generic, language-level login-intent rank (Hebrew + English accessible-name vocabulary, e.g. התחברות / כניסה / התחבר / אזור אישי / login / log in / sign in / my account) above popup semantics; negative intent words (צור קשר / contact / chat / עגלה / cart / חיפוש / search / הרשמה-only) demoted. Analyze-only (manual pick unrestricted, Owner policy); no site branches. **Evidence first** (lesson D-121-35 → Super-Pharm regression): El Al Inspect of the real login control and of the proposed control; fixtures must include Super-Pharm (`#loginAnchor`), PAGI (skip link + real opener), Mizrahi.

**El Al evidence (Owner Inspect, 2026-09-29).** Proposed action = `intermediate_transition: button[aria-label="Next slide"]` (a carousel arrow) on a **FLOATING_SCREEN** draft; its test press scrolled to the page-bottom newsletter form («הרשמה לקבלת דיוורים»: שם פרטי / שם משפחה / כתובת מייל, no password, no opener needed). Real login control: `<button class="notMobileForHeader secondary-action-button" aria-label="על מנת להפוך את האתר לנגיש לקורא מסך לחץ alt + 1. …">התחברות</button>` — visible text «התחברות», but the `aria-label` is an accessibility-plugin message.
**Root causes (generic, Architect read `specialAnalyzeRouting.ts` + `page-structure-inspect.js`):**
- **G5 — label source:** the extension sends `label = aria-label || text || value || title`; `scoreKind` tests only that one string → a non-descriptive `aria-label` hides the visible text «התחברות» → no opener hit → the real opener falls to `low`.
- **G6 — pattern-irrelevant kind:** in FLOATING_SCREEN, `scoreKind` still returns `intermediate_transition` (medium) for transition words → a carousel «Next» outranks every unlabeled/low opener. Transitions are meaningless in single-step FLOATING_SCREEN (the manual pick already follows `manualPickRelevant`); symmetric for openers in MULTI_STEP.
- **G7 — loose words:** `TRANSITION_LABEL_RE` has unanchored `go` / `more` / `next` (matches «Next slide», «Google», «more info»); carousel / slider controls are not demoted.
- **G8 — non-login form as surface:** a form without a password field (newsletter / sign-up: first / last name + email) was accepted as the revealed credential surface for a single-step FLOATING_SCREEN (the transition "opened the screen").
**Impact on D-121-46:** the stale El Al action is an **`intermediate_transition` in a FLOATING_SCREEN draft**, not a second opener → D-121-46 amended (A1 below).

**El Al — opener test «המסך לא נפתח» root cause (Owner console, 2026-09-29) — G9 unstable auto-generated ids.** Opener `button.notMobileForHeader.secondary-action-button` exists and `.click()` opens the floating screen (not a click / locator problem); login fields are in the **top document** (1 password field; only visible iframe = reCAPTCHA). Saved field locators `#mat-input-4` / `#mat-input-5` (Visual pick) → **0 matches** after reopen; the same fields are now `mat-input-6` / `mat-input-7` (framework counter ids — Angular Material assigns `mat-input-N` in creation order; the login dialog is created lazily). Fields have no `name` / `formcontrolname` / `autocomplete`. ⇒ R3 declared readiness waits for a non-existent id → «המסך לא נפתח»; runtime fill would fail the same way. **Generic:** `visual-target-pick.js` / `page-structure-inspect.js` push `#id` first for every id; no generated-id detection (only class names with ≥3 digits are treated unstable). Affects any site on such frameworks, STANDARD included (new mappings).

#### D-121-48 (OWNER APPROVED / AUTHORIZED 2026-09-29 — scope: SPECIAL authoring only; STANDARD locator choice unchanged) — never anchor locators on auto-generated ids

**Owner scope decision:** apply only to SPECIAL authoring (floating screen / multi-step: Analyze, field Visual, opener / transition pick in the SPECIAL editor). STANDARD Visual / Analyze keep today's locator choice (Phase 120 frozen). Implementation must gate the new rule by an explicit SPECIAL option passed from the SPECIAL paths (shared helpers default to legacy behavior). Backlog: STANDARD has the same weakness on counter-id sites — revisit only on Owner request.

1. **Generated-id rule** (shared `locator-determinism.js`): an id is *unstable* when it matches framework counter / hash shapes — `<prefix>-<digits>` from known component prefixes (e.g. `mat-input-N`, `mat-select-N`, `mat-mdc-*-N`, `cdk-*-N`, `react-select-N-*`), React `:r…:` ids, `ember\d+`, `ext-gen\d+`, UUID / long hex, or any id whose trailing numeric counter is the only distinguishing part among siblings of the same shape. Unstable ids and `label[for=<unstable id>]` are never chosen (still usable as identity evidence).
2. **Fallback chain** (still exact-one + identity): `name` → `autocomplete` → `formcontrolname` / stable data-test attributes → `aria-label` (only if not a generic plugin message shared by many elements) → `placeholder` → **anchored structural locator**: nearest stable ancestor (stable id, custom-element tag such as `app-login`, `role="dialog"`, stable class) + `input[type=…]` (+ `:nth-of-type` within that ancestor only when needed).
3. **Opener / action locators** follow the same rule.
4. Existing saved mappings are not rewritten; the Admin re-picks (El Al).
Evidence: synthetic fixtures (counter ids that shift after re-creation; plugin `aria-label` shared by many elements; dialog without name/autocomplete) → locator still exact-one after re-creation; regression: Super-Pharm / PAGI / Mizrahi / Shufersal locators unchanged when their ids are stable; mutations.

**Architect Review — D-121-47 (2026-09-29): PASS (offline).** Read `dev-phase121.md` D-121-47 section. G5 separate texts + visible-text label; G6 via `actionKindRelevantForPattern`; G7 whole-word vocabulary (single Hebrew prefix letter) with parity extension ↔ Hub; R-f tiers in collector (before the 40 cap) and Hub; R-a negatives demote only without a login word; R-b skip-link exclusion first; G8 `requirePasswordSurface` sent only for FLOATING_SCREEN, honoured only in reveal mode, top + depth-1 frames incl. held cross-origin (R-e); R-c / R-d confined to Analyze + authoring click. Developer decisions 1–7 accepted, plus the page-side G8 verify stubbing the eligibility visibility test (linkedom has no layout; module unchanged) (G8 reveal-only — declared mode relies on mapped fields; password = `type=password` or `autocomplete=current-password`; wait until timeout for password; one prefix letter; negatives demote transitions too; background.js pin via exact-edit revert; helper exposure for parity). Evidence: new verify 12 groups / 15 mutations; 34/34; tsc + build 0; no lints. Accepted residual: a separate control with a login word (e.g. «כניסה לעסקים») can outrank a text-less popup opener — manual pick remains. **Note for El Al:** its saved draft is in declared mode with `#mat-input-4` → the «בדוק» test still fails until D-121-48 + re-pick of the fields (G9), independent of D-121-47. Pending Owner live: El Al Analyze proposes «התחברות»; Mizrahi / PAGI / Super-Pharm unchanged. **Owner live (2026-09-29): El Al Analyze proposes the real «התחברות» opener ✔ PASS**; its «בדוק» → «לא נבחר — המסך לא נפתח» while the screen opens = expected G9 (saved `#mat-input-4`), D-121-48. Mizrahi / PAGI / Super-Pharm re-check pending. *Architect clarification (2026-09-29):* credential-**field** proposals (STANDARD `analyzeLoginPage` and SPECIAL `currentTabAuthoring`) use the Phase 118 `proposeFieldMappings` provider — OpenAI via the Supabase Edge function by default when Supabase is configured (`VITE_ASSISTED_MAPPING_PROVIDER`), followed by deterministic safety validation; **opener / transition proposals** (`specialAnalyzeRouting`, D-121-47) are rule-based (no LLM).

**Architect Review — D-121-48 (2026-09-29): PASS (offline).** `isUnstableId` (framework prefix-counter, React `:r…:`, ember / ext-gen, UUID / long hex, document-wide counter-sibling); locators referencing an unstable id anywhere (`#id`, `label[for]`, `aria-controls`, `data-target`) rejected, id kept as evidence; fallback name → autocomplete → formcontrolname / data-test → aria-label (skipped when shared by ≥3) → placeholder → anchored structural (stable ancestor + `tag[type]`, `:nth-of-type` only if needed); actions follow the rule; gated by `stableLocators` only from the three SPECIAL call sites (Visual also requires SPECIAL mode); STANDARD output proven identical to verbatim pre-slice builders. Declared readiness follows re-picked fields via existing `rederiveRevealReadiness` (IF-2.5) — Architect read. Decisions accepted: shared-aria threshold 3; counter-sibling document-wide (residual: deliberate `step1` / `step2` ids fall to the next exact-one strategy, SPECIAL only); SPECIAL candidate cap +4; frame descriptors / reveal snapshot keys out of scope. Evidence: new verify, 8 mutations; 35/35; tsc + build 0; no lints. Next: combined Owner live (D-121-46 / 47 / 48): El Al end-to-end, Mizrahi / PAGI / Super-Pharm regression, one STANDARD site.

**El Al live evidence G10 (Owner, 2026-09-29, post D-121-48; finding only — no slice authorized).** «בדוק» → screen opened; password auto-identified with stable locator `div.mat-mdc-form-field-infix input[type="password"]`; username NOT identified. Visual pick on username → `mat-form-field.MemberOrIdNumber input[type="text"]` (stable, D-121-48 PASS for Visual). Console (dialog open, top document): the username input `mat-input-4` has no name / autocomplete / formcontrolname / aria-label / placeholder; 11 visible inputs total (flight-search inputs, `mat-input-2/3` text, `mat-input-0/1` email); `div.mat-mdc-form-field-infix input[type="text"]` matches 3. The only stable exact-one anchor is the wrapper class `MemberOrIdNumber`. Open question: which stage dropped it (inspect candidate / AI confidence / safety check). Awaiting the admin-console `[special-draft-current-tab-fields]` counts. Possible future direction (not authorized): SPECIAL field Analyze scoped to the revealed surface (dialog), and Material `mat-label` as label evidence.

**El Al live evidence G11 (Owner, 2026-09-29; fill test FAIL).** Saved draft (structural PASS) → fill test: screen opened; `fill · targets_not_ready · username · occluded · mat-form-field.MemberOrIdNumber input[type="text"] · top`; stamp `assess_resolve` exact_one, matchCount 1. So the locator resolves; the V8 hit test (`managed-target-eligibility.js` `classifyHitTest`: 5 points, PASS only for target | descendant | the associated label element itself) fails. Hypothesis (unconfirmed): the empty-state Material floating label / child span (or another overlay) covers the input; a child of `label[for]` is not accepted as the associated label. Awaiting the elementFromPoint console evidence. No slice authorized.
Owner corroboration (2026-09-29): the empty-state label sits over the input; during Visual pick the first click on the username was not captured (it only focused the field / floated the label); a second Visual pick after focus captured it. Consistent with the hypothesis. Candidate direction (pending evidence + Owner decision): treat a hit inside a `<label>` whose `control` is the target as the target (native HTML label semantics), for the hit test and Visual pick; scope SPECIAL only per Owner policy.
**G11 CONFIRMED (console, dialog open, username empty and unfocused):** all 5 sample points hit `MAT-LABEL` (pointer-events `all`, text «מספר חבר מועדון / מספר ת"ז»), inside `label[for="mat-input-4"]` = the target's own id. Today `hitRelationshipOk` accepts only the label element itself, not its descendants → `occluded`.

#### D-121-49 (OWNER APPROVED / AUTHORIZED 2026-09-29 — scope: SPECIAL **and** STANDARD, Owner choice `approve_all`) — associated-label descendant counts as the target

**Owner principle (2026-09-29):** field-level behaviors (how a login field is built on the page) are independent of the site's login pattern and should be handled uniformly for all patterns; pattern scoping applies to flow behavior only. Architect agrees. Related open item: D-121-48 (unstable ids) is also field-level and is currently SPECIAL only — Owner to decide separately whether to extend it to STANDARD. → **DEFERRED (2026-09-29):** Owner reluctant to touch STANDARD (works ~90%); Architect recommends waiting for a concrete STANDARD failure. Backlog.
**Owner scope override:** the Owner chose to apply the rule to all login patterns (uniform behavior). The "SPECIAL only" scope line below is superseded: no gating option; STANDARD also gets the rule. STANDARD proof = every existing STANDARD verify / fixture keeps its result; the only permitted outcome change is `occluded` → PASS where the covering hit is a descendant of the target's own associated label.

- **Hit test** (`managed-target-eligibility.js` `hitRelationshipOk`): additionally PASS when `hit.closest('label')` exists and that label's native `control` === the target (covers `for=` and nested labels). Nothing else relaxed: exact-one, 5-point sampling, pointer-events on the target, viewport rules unchanged; a hit on any other element still `occluded`.
- **Visual pick:** a click whose target is inside a `<label>` with a native `control` that is a fillable input resolves to that control, then the existing locator / exact-one rules apply (D-121-48 stable locators).
- **Runtime:** the fill still writes to the resolved target only; the label is never clicked.
- **Scope:** SPECIAL only (fill test + Digital Home SPECIAL runtime + SPECIAL Visual), via an explicit option like D-121-48's `stableLocators`; STANDARD behavior byte-identical (verify).
- **Constraints:** no site / host / serviceId branches; no manifest / permission change; merge guard strict; `final_submit` reserved.
**Architect Review — D-121-49 (2026-09-29): PASS (offline).** Read `managed-target-eligibility.js`: `labelControlOf` (native `.control` first, else `for=` restricted to labelable elements, else first nested labelable) and `isInsideOwnLabel` (`hit.closest('label')` control === target) added as a separate check in `hitRelationshipOk`; sampling / exact-one / pointer-events / viewport / scroll retry untouched. `visual-target-pick.js` `labelFillableControl`: only when the click target is not already an identifiable control; resolves to an INPUT of type text / email / password / tel / number / search / url; opener / transition pick unchanged. Runtime unchanged (no label click). Decisions 1–5 accepted. Evidence: `verifyPhase121OwnLabelHit.mjs` (5 groups, 7 mutations), 36/36, tsc + build 0, no lints. Next: combined Owner live (D-121-46/47/48/49).
**Owner live PASS — combined round (2026-09-29):** El Al end-to-end (Analyze, «בדוק», Visual, save, fill test, approve, Digital Home), Mizrahi / PAGI / Super-Pharm regression, one STANDARD site — "הכל עובד פיקס". **D-121-46 (+A1), D-121-47, D-121-48, D-121-49 CLOSED.** G10 (username auto-identification on El Al) remains a finding only. Next: D-121-45.

- **Verify:** fixture where a descendant of the associated label covers the input → PASS in SPECIAL, `occluded` in default; a descendant of an unrelated label, or of a label for another control → `occluded`; mutations for each.

#### D-121-47 (OWNER APPROVED / AUTHORIZED 2026-09-29; after D-121-46, before D-121-45) — Analyze proposal quality: pattern-relevant kinds + full accessible text + login-intent

Analyze-only (manual pick unrestricted, Owner policy); generic vocabulary, no site branches; contract / runtime / extension permissions unchanged.
1. **Pattern relevance (G6):** FLOATING_SCREEN proposes only `floating_opener`; MULTI_STEP only `intermediate_transition`; FLOATING_SCREEN_MULTI_STEP both (opener before the first step, transition between steps) — same rule as `manualPickRelevant`.
2. **Label evidence (G5):** the extension also sends the visible text, `aria-label`, `title` separately (truncated; never values); intent matching uses **any** of them; the label shown to the Admin prefers the visible text when present.
3. **Words (G7):** whole-word matching; login-intent (התחברות / כניסה / התחבר / אזור אישי / login / log in / sign in / my account) → high; negative / unrelated (slide / carousel / prev / previous / contact / צור קשר / chat / צ'אט / cart / עגלה / search / חיפוש / newsletter / דיוור / הרשמה-only / register-only) → never high, ranked last.
4. **Surface (G8):** for a single-step FLOATING_SCREEN, a revealed surface counts as the login surface only if it contains an eligible password field; a form of name / email fields only is not a login surface (test → «המסך לא נפתח»). MULTI_STEP step-1 (username only) unaffected.
Evidence: synthetic fixtures (El Al-shaped: plugin `aria-label` + text «התחברות», carousel «Next slide», newsletter form) + regression fixtures Super-Pharm `#loginAnchor`, PAGI (skip link + real opener), Mizrahi; mutations per item.
**Regression guards (binding, Architect 2026-09-29, Owner concern «יפגע במה שכבר עבד?»):** (R-a) a label with both a login word and a negative / sign-up word (e.g. «הרשמה / התחברות») is **login intent**, never demoted — negatives demote only when no login word is present; (R-b) skip-link exclusion stays before intent scoring (a skip link whose `aria-label` contains «כניסה» must not rise); (R-c) G8 applies only to single-step FLOATING_SCREEN *authoring* tests — never to saved / ACTIVE plans, the 121.2 runtime or Digital Home; (R-d) saved drafts and ACTIVE plans are not re-scored. Scope reminder: D-121-47 changes only what Analyze proposes; D-121-46 A1 normalizes SPECIAL drafts only; neither touches ACTIVE plans → Digital Home for Mizrahi / PAGI / Super-Pharm cannot change. Owner re-check after D-121-47: Analyze + «בדוק» on Mizrahi, PAGI, Super-Pharm.
(R-e) **G8 counts password fields in every revealed surface the authoring already handles** — top document, same-origin depth-1 frame (Mizrahi `#iframeLogIn`) and cross-origin frame fields **held pending «אשר מסגרת»** (PAGI): a held password field counts; the frame-approval flow must not be reported as «המסך לא נפתח». (R-f) **Rank order:** login word + popup semantics → login word → popup semantics → plain → negatives. A popup-semantics opener without a login word (e.g. PAGI-shaped `a.login-trigger[data-toggle=modal][data-target]`, no id / aria-label) keeps its current lead over plain controls; it can be outranked only by a control carrying a login word. Fixture must include this shape both with and without login text. Owner live: El Al Analyze proposes «התחברות»; Super-Pharm / PAGI / Mizrahi unchanged.

#### D-121-46 (OWNER APPROVED / AUTHORIZED 2026-09-29; runs BEFORE D-121-45) — one opener per plan; unchosen candidates never block

Rule: a floating-screen plan holds **at most one `floating_opener`** in `preambleActions`. Adding an opener (Analyze proposal or manual pick) **replaces** any existing opener; when an action becomes chosen (test success), no other unchosen action of the same kind remains. Same single-slot rule already holds for `exitTransition` per step (verify it). Legacy saved drafts with extra unchosen openers: on load / save, drop unchosen openers when a chosen one exists (A1-style normalization, SPECIAL draft only; ACTIVE snapshots untouched). No change to validation strictness (every runtime action must still be approved), contract, runtime, manifest.
Evidence: verify — Analyze candidate then manual pick → one opener; saved plan complete; legacy draft with stale candidate normalizes; mutation (append instead of replace). Owner live: El Al — «בדיקת מילוי» fills; «אשר מיפוי» enabled.

**Architect Review — D-121-46 base (2026-09-29): PASS (offline) for the opener slot; slice NOT closed — Amendment A1 outstanding** (Developer stopped before A1 was delivered). Accepted: `upsertPreambleAction` single opener slot; chosen action prunes unchosen same-kind; `dropStaleOpenerCandidates` first inside A1 normalization (load / completeness / fill test / approve; save writes normalized); ACTIVE never normalized; strictness unchanged. Decisions accepted: new opener test replaces even a chosen opener (failure → incomplete, re-test); two chosen or only unchosen openers left untouched (no silent choice / approval). Evidence: new verify 6 mutations; 33/33 (Phase 117 Rivhit live-M8 flake, unrelated, reruns PASS — noted). **Gap:** the live El Al stale action is an `intermediate_transition` in a FLOATING_SCREEN draft → not covered by the opener rule → El Al may still be blocked until A1.

**Amendment A1 (Architect, 2026-09-29, within the approved intent — El Al evidence):** the normalization and the upsert rule also cover **pattern-irrelevant actions**: in a FLOATING_SCREEN draft no `intermediate_transition` (preamble or `exitTransition`) is kept; in a MULTI_STEP draft no `floating_opener`; FLOATING_SCREEN_MULTI_STEP keeps both kinds (one opener; one transition per step). Relevance = the same rule as `manualPickRelevant`. Applied on load / save / pattern change of the SPECIAL draft only; ACTIVE untouched. Added evidence: FLOATING_SCREEN draft with a stale unchosen transition + chosen opener → complete; pattern switch drops irrelevant kinds; mutation (keep irrelevant kind).

**Architect Review — D-121-46 A1 (2026-09-29): PASS (offline) → D-121-46 offline COMPLETE.** Read `actionKindRelevantForPattern` (single rule; `manualPickRelevant` delegates — no drift) and `dropPatternIrrelevantActions` (preamble + `exitTransition`, chosen or not; no approval; identity return when clean), placed first inside A1 normalization (load / save / completeness / fill test / approve); irrelevant writes refused; pattern change normalizes and clears irrelevant panels; ACTIVE untouched. Decision accepted: until D-121-47 G6, «בדוק» on a floating-screen transition proposal still clicks on the site but is never written. Fixture changes in two older verifies accepted (selection assertions unchanged). Evidence: 11 groups / 10 mutations; 33/33; tsc + build 0; no lints. (Correction: the A1 prompt was re-sent; Developer made no change and D-121-47 is **not started** — to be assigned now, A1 PASS.) Pending Owner live: El Al reload → complete → «בדיקת מילוי» fills → «אשר מיפוי» enabled.

#### D-121-44 (CANCELLED by Owner 2026-09-28; was: approved in principle) — STANDARD keeps the approved mapping until re-approval

STANDARD must hold an approved snapshot separate from the saved mapping (as SPECIAL `active` vs `draft`); «שמור מיפוי» changes only the saved mapping; Digital Home Managed Autofill reads only the approved snapshot; «אשר מיפוי» (readiness probe unchanged) replaces it. Touches the Phase 120 frozen STANDARD storage and runtime read path → Architect design section + Manager DD required; legacy rows (single profile) must migrate losslessly (validated → approved snapshot = current). After D-121-43.

**Architect Review — D-121-42 (2026-09-28): PASS (offline).** Read `visualPickSession.ts` (one armed pick; bound = `ADMIN_VISUAL_PICK_TIMEOUT_MS` + grace; token bumped on every exit; late / stale answer ignored; disarm on Hub timeout and cancel), `visualPickCopy.ts` (exact timeout copy shared), `background.js` `openPageAndVisualMapping` (bound counted from request; single pending session; supersede disarms previous; cancelled-before-arm never arms; `respondAndDisarm` on every early answer incl. operation timeout / nav abort; fresh tab, frame 0, same injected files) and `cancelStandardVisualMapping` (origin fail-closed via `tabs.get`). Developer decisions accepted: (1) SPECIAL pick code not moved to the helper (verified flow untouched; parity by shared constants / copy + verify); (2) separate STANDARD cancel message; (3) superseded assertions + SHA pin via exact D-121-42 edit revert. Non-blocking residual: cancel landing between `session.armed = true` and the page arm script executing disarms nothing; the page pick still self-disarms at its bound and the Hub token ignores its answer — accepted. Evidence: new verify 13 checks / 8 mutations; 30/30; tsc + build 0; no lints. Pending Owner live 1–4 (Sarah's list). D-121-43 may start.

#### D-121-42 (OWNER APPROVED / AUTHORIZED 2026-09-28) — uniform Admin Visual pick lifecycle (STANDARD aligned to SPECIAL)

Scope: Admin authoring UI + the STANDARD Visual pick session only. STANDARD field Visual adopts the SPECIAL lifecycle: same bounded pick (`SPECIAL_VISUAL_PICK_TIMEOUT_MS` + Hub grace → rename to a shared constant), page disarm on timeout / cancel / Hub give-up, same in-progress indicator + «ביטול» button, same Hebrew copy («לא נקלטה לחיצה בזמן, והמיפוי החזותי בוטל. כדי לנסות שוב לחצו «מיפוי חזותי» ליד השדה.»), token-guarded late-response ignore. Prefer one shared Hub helper / copy module used by both editors. Unchanged: locator rules (exact-one + identity, managed eligibility), what is saved, fresh-tab model for STANDARD, Managed Autofill runtime / Digital Home / `validated-autofill.js`, manifest / permissions. Evidence: offline verify (timeout, cancel, late response ignored, copy parity between the two editors), Phase 116–121 verifies, tsc + build; Owner live: STANDARD service — Visual with no click → same message; «ביטול» works; successful pick unchanged.

Acceptance (live): PAGI Analyze proposes the real opener (not the skip link); test opens the screen and fields are identified; manual opener pick on the real button succeeds; manual click during the test → «not proven»; Mizrahi regression unchanged; STANDARD field Visual pick unchanged. Offline: synthetic fixtures for 1–4 (no site names).

**Architect Review — D-121-34 CORRECTION (2026-09-27): PASS.** Old strings absent, new statuses / follow-up title present (Architect grep); test press = consent; success sets both flags, failure clears both; tested action never replaced; follow-up rule (`followUpSelection.ts`): revealed surface only, pattern-needed kinds, not same kind + same surface; separate «נמצא כפתור נוסף» panel; manual Analyze unchanged; Ext gate / R3 / iframe / contract / validator / manifest unchanged; new verify + 2 mutation checks (Developer-reported). Developer decisions: (1) failed-test action stays in draft with flags cleared → draft check reports it until re-test or «זה לא הכפתור» — **accepted** (Admin's press recorded intent; never usable at runtime unapproved); (2) flag / status helpers in `specialActionBar.ts` — **accepted**; (3) same-kind rule on single-page multi-step (e.g. 3rd step) needs manual Analyze — **accepted, non-blocking**. **D-121-34 CLOSED.**

#### §4.6.1 Binding — deterministic, visible authoring tab (D-121-27, **AUTHORIZED** Owner 2026-09-27)

| Rule | Binding |
|---|---|
| Session tab | Ext returns `authoringTabId` on every SPECIAL inspect / visual / click response; Hub stores it for the current editor session and sends it as `tabId` on subsequent SPECIAL messages. Ext uses it while it still matches `allowedOrigin` (existing `message.tabId` path) |
| No session tab yet | Among same-origin tabs, pick the **most recently accessed** (`lastAccessed`), not query order; if none → open §4.7 `authoringUrl` (unchanged) |
| Visibility | Before continuation click and before arming Visual, **activate** the authoring tab and focus its window so the Admin acts on the same tab the system uses |
| Hub copy | Status line names the target briefly (e.g. «פועל בלשונית האתר שנפתחה») — exact-label rule applies to any button reference |
| Unchanged | Origin fail-closed, no Login Entry reopen after progression, frame 0 scope, D-121-22..26 behavior, STANDARD |
| Forbidden | Site / hostname / serviceId / fixture branches; iframe work; 121.2+ |

#### Open items (not authorized)

- **Readiness after continuation click (finding, pending Owner diagnostic):** default readiness locator = the clicked opener's own locator, so readiness passes immediately while the revealed surface may still be rendering; auto-Analyze may run too early. Alternative cause: credential fields inside an iframe (frame 0 only). Owner to re-run manual Analyze with the floating screen open to discriminate. Any fix = separate authorization.
- **Owner live 2026-09-27 — SPECIAL field Visual Mapping on revealed floating screen (finding):** Admin presses «מיפוי חזותי» for «משתמש» → all editor buttons disabled, no in-progress indicator, stale green message from the previous action remains; clicking the field on the fixture page does nothing and the editor stays locked. Code evidence: SPECIAL Visual inject + `armVisualTargetPick` run in `frameIds: [0]` only, listener on top `document`, **no timeout / cancel**. A click inside a child iframe never reaches frame 0 → pick never resolves → `busy` stuck. This **strengthens the iframe hypothesis** above (readiness timing cannot explain a manual pick that never resolves). Auto-Analyze proposing an unrelated main-page element as a new opener is consistent with the same cause.
  - **UX defects (independent of cause):** no per-field «ממתין ללחיצה…» indicator (STANDARD grid has one); stale success/error not cleared on Visual start; no timeout/cancel → editor can lock indefinitely.
  - **Architecture trigger:** §2.2 “Generic iframe architecture — only if a Phase 121 fixture proves impossible without it.” If Owner diagnostic confirms the credential fields are in an iframe, this trigger fires and requires a **new generic architecture section** (authoring inspect/visual in frames, frame-aware locator, origin rules per frame, and runtime fill in frames — the latter touches Phase 120 Ext fill frame-0 semantics and belongs to 121.2 design). **Not** a Developer quick fix. No site-specific logic.
  - **Owner diagnostic:** in the fixture tab with the floating screen open, right-click inside the username field. If the browser menu offers «הצג מקור מסגרת» / “View frame source”, the field is inside an iframe.
- **Proposal (not assigned an ID):** approval panel shows the button's visible text + plain-Hebrew kind, locator secondary. Awaiting Owner decision.

### Exact next step

**Track A:** D-121-22 … D-121-27 **Architecture PASS / CLOSED** (2026-09-27) — see review below.  
**Track B:** Manager DD «121.1-IF» **Architecture PASS** (2026-09-27, amendments A1–A2) → **121.1-IF-impl AUTHORIZED** (Owner 2026-09-27) → **121.1-IF-impl Architecture PASS (offline)** 2026-09-27 — see review below. **Next: Owner live L-1 (Mizrahi-Tefahot, iframe) + L-2 (PAGI or CAL, top document) + L-3 (negative / STANDARD regression)** per `dev-phase121.md`. Final Phase 121.1 acceptance pending L-1..L-3.  
Owner iframe diagnostic closed (confirmed iframe via console, `[2,false]`).  
**L-1 BLOCKED (2026-09-27):** `frame_correlation_unavailable` on Chrome 153 — `getFrameId` not in Chrome. **D-121-29 / §4.10.1 OWNER APPROVED + AUTHORIZED (2026-09-27) → Developer correction COMPLETE → Architecture re-review PASS (offline) 2026-09-27 → Next: Owner L-1 / L-2 / L-3 re-run.**  
**L-1 re-run progress (2026-09-27):** fields detected in frame — `#input_user` / `#input_pass` «בתוך מסגרת: https://www.mizrahi-tefahot.co.il», no «אשר מסגרת» prompt (A2 confirmed). Hub also reports a further unapproved button proposal (`fieldsIdentifiedWithAction`) — identity pending Owner report; must not be the in-frame login submit (`final_submit` reserved). Remaining L-1: click-readiness result, field Visual, save / reload.  
- Extra proposal = `floating_opener: div[aria-label="IPB Center TLV"] · בדף הראשי` — unrelated main-page element (not `final_submit`, safety OK). **Finding (non-blocking, generic):** once the revealed step's credential fields are detected, proposing another top-document opener is noise; candidate rule for a later decision: after a step is revealed with credential fields, action proposals are limited to that surface (next-step / future submit). Owner instructed to «דחה».  
- **L-1 continued:** field Visual inside the iframe **succeeded**; «שמור טיוטה» succeeded. Pending: reload check, Snapshot check.
- **Owner finding — action-bar copy (2026-09-27):** «בדוק Snapshot», «שמור טיוטה», «ACTIVATE SPECIAL», «ACTIVATE STANDARD» are unclear to the Admin (English / technical terms). Code: ACTIVATE SPECIAL writes the activate intent immediately (no confirmation); ACTIVATE STANDARD re-activates the STANDARD profile immediately. SPECIAL runtime does not exist until 121.2, so activating SPECIAL on a live service affects end users. **D-121-30 OWNER APPROVED / AUTHORIZED 2026-09-27** (final form in §4.11: ACTIVATE STANDARD removed; SPECIAL→STANDARD via regular grid activation).
- **Owner intent (2026-09-27):** wants the final «כניסה» button to be **proposed and stored** later. `final_submit` remains reserved in 121.1; requires a separate design decision (store-only authoring vs. runtime click = auto-login, 121.2+ security review). Not authorized yet.  
**§4.7 + §4.6 PASS retained. 121.2+ NOT AUTHORIZED.**

### Architect Review — 121.1-IF-impl (2026-09-27) — **PASS (offline); final acceptance pending Owner L-1..L-3**

| Check | Result |
|---|---|
| R1 top origin == allowedOrigin, first in every SPECIAL handler | PASS — `specialAuthoringTabGate`; `resolveDeclaredFrame` re-checks top origin in frame 0 |
| R2 HTTPS + explicit «אשר מסגרת» + live exact-one / origin / depth-1 re-check | PASS — `isFrameOriginApproved` requires HTTPS exact origin; Ext `resolveDeclaredFrame` (invalid / missing / ambiguous / not-depth1 / origin mismatch); in-frame `location.origin` check before click |
| A2 identical origin only | PASS — strict `frameOrigin === entryAllowedOrigin`; subdomain / registrable domain still need approval (verify §4) |
| R3 readiness never opener-self | PASS — Hub validator `readinessIsSelf` / `readinessNotDeclaredField`; Ext rejects `readiness_is_self` before any tab work; all failures → «המסך לא נפתח» |
| A1 legacy normalization draft-only | PASS — `normalizeLegacyDraftReadiness` derives only when revealed step has a credential mapping; otherwise unchanged; `active` untouched |
| Frame correlation | **D-121-29 re-review PASS (offline) 2026-09-27** — postMessage nonce handshake: listener in all frames (ISOLATED, idempotent) accepts only `event.source === window.parent` + depth-1 + 128-bit hex nonce; frame 0 posts fresh nonce per `<iframe>` / exact-one locator match; 150 ms read-back; `specialMatchFrameNonces` exact-one both ways, frame 0 excluded, foreign / stale nonces ignored; R2 live origin + depth-1 probe unchanged. Architect grep: no `getFrameId` / `webNavigation` / `debugger` in `extension/` or `src/`; manifest = HEAD; no site branches (only pre-existing catalog entry). Verify runs real `frame-correlation.js` in simulated windows; 4 mutation checks fail as expected (Developer-reported). Cost: +150 ms per scan (accepted). Non-blocking: frames the Ext cannot inject into are skipped by `allFrames` → element stays unmapped (fail-closed). Earlier: **REOPENED 2026-09-27 (L-1): `getFrameId` not implemented in Chrome — see D-121-29.** Was: PASS — `chrome.runtime.getFrameId` in ISOLATED top frame; stable-attribute exact-one locators only (no nth-child / positional); unavailable → fail-closed; no `webNavigation`; frameIds not returned to Hub |
| Descriptor SPECIAL-only; absent ≡ top; no `frame` key for top drafts | PASS |
| `final_submit` reserved and rejected (parse / validate / propose / click) | PASS |
| UNSUPPORTED (nested / Shadow DOM / non-HTTPS / not addressable) always plain Hebrew | PASS (offline); live Shadow / nested = LIVE_ONLY |
| Manifest unchanged | PASS — `git diff HEAD -- extension/manifest.json` empty (Architect check) |
| Genericity | PASS — no site / hostname / serviceId / fixture branches (Architect grep; only pre-existing localhost checks) |
| STANDARD / Phase 120 frozen | PASS — STANDARD handlers `frameIds:[0]`; Phase 120 fill / eligibility files untouched |
| Evidence | `tsc -b`, `npm run build`, `verifyPhase121IframeSurface.mjs` ×5, Phase 116–121 regression — all exit 0 (Developer-reported) |

**Verify-script changes (accepted):** Phase 117 Managed slice and Phase 119 T-R5(a) narrowed to the STANDARD/Managed function they guard (the guarded code is unchanged); Phase 119 T-R5(b) `shadowRoot` ban excludes only the DD-required count helper, with a new assert keeping it count-only; Phase 121 LoginContract fixture aligned with R3. These are scope corrections, not weakened guards. The comment reword ("vault secrets") is accepted.

**Non-blocking notes:**
- The Ext click handler trusts the Hub for R2 approval; the Ext enforces HTTPS + live exact-one / origin / depth-1. Acceptable for authoring (Admin-only surface). 121.2 runtime must re-validate R2 from the **active** plan, not from the message.
- `frameLocatorCandidates` uses id / name / title / aria-label only. An iframe with none of these → «לא ניתן לאתר את המסגרת» (fail-closed, by design). If L-1 hits this, it's a finding for design, not a quick fix.
- End-user Chromium ≥ 106 decision is deferred to the 121.2 DD (see Q3 note).

**Owner L-1 finding (2026-09-27, step 2):** Mizrahi floating screen **opened visibly**, but Hub reported «המסך לא נפתח» (reveal-mode R3 false negative). Code path: `collectSpecialRevealSnapshot` scans only `top` + visible `depth1_https` frames and succeeds only on a credential locator **absent from the pre-click snapshot**. Hypotheses: **H1** iframe has no id / name / title / aria-label → `not_addressable` → never scanned; **H2** iframe + inputs preloaded and already "eligible" before the click (hidden by opacity / transform / off-screen) → nothing "new"; **H3** iframe loads after > 8 s. Owner console diagnostic requested (iframe attributes + visibility, before / after click). No fix until diagnosed; any fix must stay generic.
**Diagnostic result:** 2 top-level iframes. (a) YouTube embed, `id` numeric, visible both times (unrelated). (b) Login iframe `id="iframeLogIn"`, `title="כניסה לחשבון"`, `src=https://www.mizrahi-tefahot.co.il/login/index.html…` — **preloaded, 0×0 when closed, 352×364 when open**. ⇒ **H1 ruled out** (stable id), **H2 not sufficient** (0×0 ⇒ `visible:false` ⇒ excluded from pre-snapshot, so inputs should count as new), iframe origin = site origin ⇒ **A2 case** (no «אשר מסגרת» prompt expected). Code: exports / inject files correct. Remaining: readiness mode actually sent (legacy draft readiness may route to a stale declared locator), in-frame eligibility during the open transition, or H3. Next discriminator: manual «נתח» with screen already open.

**LIVE_ONLY (4) — must be covered by Owner:** real cross-origin iframe correlation (L-1), top-document floating screen (L-2), plus Shadow DOM / nested frame if the Owner meets such a site (else remain offline-only, recorded as such).
