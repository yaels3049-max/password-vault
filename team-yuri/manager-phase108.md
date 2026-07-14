# Manager Phase 108

## Phase Identifier
PHASE=108

## Status
STATUS: M15_CLOSED_U27_DEFERRED

## Architecture Amendments

**Amendment 1 (day) — Consumer false-positive gate (M9):** D-108-14…17; AC-108-18…20. Prefer `NULL` over wrong URL; Zap-class portals rejected; Phase 112 deferral metadata.

**Amendment 2 (evening) — True-positive preservation (M10):** D-108-14…16 revised; D-108-18; AC-108-21; ACCEPT fixtures. Reject only with positive evidence.

**Amendment 3 (night) — M10 live failure / process correction (M11):** Architect **REJECTED** M10 “COMPLETE”. Operator live add (admin + custom) still leaves `login_url=NULL` on sites that worked before Zap/M9. Developer marked M10 COMPLETE on static fixtures while **U22 remains PENDING_OPERATOR**. Static JSDOM fixtures ≠ live extension discovery path. Adds **D-108-19**, **D-108-20**, milestone **M11**.

**Amendment 4 (2026-07-13) — Trusted-auth over-reject / Bank Hapoalim-class (M12):** Architect **REJECTED_PENDING_M12**. Live rediscovery finds a consumer auth URL (e.g. `https://login.bankhapoalim.co.il/ng-portals/auth/he/login`) but persists `login_url=NULL` with `needs_review`, `rejectedLoginUrl` set, reason “Consumer login is modal-based; alternate portal candidate rejected.”, `loginIntelligenceHint=alternate_audience_portal`, `phase112Deferred=true`. Root cause: audience gate lets **homepage modal** and/or **weak alternate-audience wording** veto a **trusted consumer auth host** on the same brand; SPA path tokens like `ng-portals` and retail Hebrew like `כניסת לקוחות` are treated as portal evidence. Adds **D-108-21 … D-108-23**, **AC-108-22**, milestone **M12**. Zap-class reject stays mandatory. **Do NOT defer trusted-auth blanking to Phase 112.**

**Amendment 5 (2026-07-13 evening/night) — Trusted-auth host probe + validated common-path (M13):** Architect **REJECTED_PENDING_M13**. Two operator failures under AC-108-23:
1. **KSP-class (D-108-24, D-108-25):** Live rediscovery returns `method=common-path`, `loginUrl=https://ksp.co.il/login` (dead page), `confidence=low`, `outcome=needs_review`, `success=false`. Real consumer login `https://auth.ksp.co.il/login?...` was **never candidate** because homepage has no link. M12 gate-accept is insufficient when discovery never probes the auth host. Same-brand `AUTH_SUBDOMAIN_PREFIXES` must be **probed** when DOM/link discovery yields no high-confidence consumer URL; unvalidated dead common-path must not win over a validated auth probe.
2. **GitHub-class (D-108-26):** Live rediscovery finds correct `https://github.com/login` via `common-path` / `confidence=low` but persist policy blank-rejects **all** common-path/low — wrong for validated login pages. After login-page validation + audience pass, **persist** (may upgrade confidence/method). Only unvalidated / unreachable / non-login common-path stays `needs_review` / NULL.

**Catalog/admin seed for `login_url` is interim only — does not close M13.**

**Amendment 6 (2026-07-13 late) — Federated / parent IdP (M14) + M13 U24 unfinished (historical):** Architect **REJECTED_PENDING_M14**. Federated IdP ACCEPT when brand-return evidence (Trello → `id.atlassian.com`). M13 U24 was unfinished at that time (auth.ksp in `topCandidates` without persist).

**Operator update (2026-07-14):** **M13 COMPLETE** — KSP found **and** Zap `login_url=NULL` (dual gate achieved). **Must not regress Zap.**

**Amendment 7 (2026-07-14) — Live candidate validation + sibling-TLD (M15):** Architect opened M15 for PayPal live-validate, Zoom sibling-TLD, Zap dual-gate hard (**D-108-28…30**, **AC-108-25**).

**Amendment 8 (2026-07-14 closeout) — M15 accepted with PayPal deferred (D-108-31):** Architect **APPROVED_WITH_DEFERRED_U27**. Operator live green: **Zap NULL + KSP non-NULL + Zoom non-NULL**. PayPal auto `login_url` empty again after churn. **Stop** further discovery-heuristic churn for PayPal. **Defer U27 → M16** (Phase 108 — not Phase 112). Interim: catalog/admin seed `https://www.paypal.com/login`. Program may proceed to next phases.

**Phase completion gate (operator closeout 2026-07-14):**
- **M13 COMPLETE** — KSP + Zap NULL (protect).
- **M15 CLOSED** — **accepted with deferred U27**; live green Zap + KSP + Zoom (U28).
- **U27** — PayPal auto-discovery backlog → **M16** only when explicitly opened.
- **Freeze** discovery-gate churn now. Optional PayPal seed/admin only.
- Program may advance other phases; Phase 108 remaining discovery backlog = PayPal auto (M16) + any still-open prior ledger items (e.g. M14).

## Phase Goal
Deliver **Browser Integration and Login Discovery**: Chrome and Edge extension support via a **browser integration abstraction**, production packaging strategy, graceful Hub degradation without extension — and a **unified login-entry discovery pipeline** that enriches `service_registry` with a **confident consumer** `loginUrl` (or safely leaves it `NULL` with Phase 112 deferral metadata) on custom-service add and admin refresh — **without** autofill, credentials, form submit, or execution-path changes (AC-108-10, discovery boundary).

Phase 108 owns **browser host integration**, **DiscoveryExecutor** behavior, **loginUrl metadata persistence rules**, **evidence-based false-positive rejection**, **true-positive preservation** (trusted auth hosts, auth-host probe, validated common-path, **live candidate page validation**, **sibling-TLD brand**, **federated IdP**), **live-path authority**, **discovery outcome observability**, **discovery deferral signals**, and **bulk refresh orchestration**. It does not own admin console chrome (107 UI), standard autofill coverage (110), **authoritative** complex login classification / modal interaction (112), full URL canonicalization (113), or credential lifecycle (109).

## Source References
- `team-Yuri/arch-phase108.md` (**STATUS: APPROVED_WITH_DEFERRED_U27** — D-108-31; M15 closeout)
- `team-Yuri/PLAN.md` §13 / §18 — AC-108-1 … **AC-108-25** (U27 deferred documented)
- `team-Yuri/PHASE.md` — program may advance; Phase **108** backlog = PayPal auto-discovery (**M16**)
- `team-Yuri/dev-phase108.md` — freeze PayPal discovery churn; optional seed only; protect Zap/KSP/Zoom
- `scripts/verifyPhase108FalsePositiveGate.mjs` — keep Zap REJECT + Zoom ACCEPT green
- DiscoveryExecutor / audience gate — **frozen** for PayPal heuristic work until M16

## Architecture Summary (Phase 108 constraints)
- Prior constraints M1–M15 remain in force where already delivered.
- **M15 closeout (D-108-31):** Accepted with **U27 deferred**. Live operator green: **Zap NULL + KSP + Zoom**. PayPal auto-discovery **stopped** for now.
- **Freeze discovery-heuristic churn** — do not reopen PayPal gate tuning unless **M16** is opened.
- **Interim PayPal:** catalog/admin seed `https://www.paypal.com/login` only — not a claim of U27 Pass.
- **Regression lock:** Zap NULL, KSP non-NULL, Zoom non-NULL must stay green.
- Live validation (D-108-28), sibling-TLD (D-108-29), Zap dual-gate (D-108-30) remain the rules when discovery runs; M16 must re-prove Zap+KSP+Zoom on same build if/when PayPal auto is reopened.
- Federated IdP (M14) / other prior gates unchanged.

### Normative consumer validation (M9–M15)

**Mandatory evaluation order for every candidate (D-108-30):**

```text
(1) strong alternate-audience evidence → REJECT FIRST
      — Zap business / sa.zap / ממשק העסק — WINS even if page has identity fields
(2) LIVE-VALIDATE (D-108-28): open candidate in DiscoveryExecutor
      — reachable login surface + ≥1 consumer identity field (read-only)
      — NO autofill / credentials / submit
      — fail → drop candidate (do not conclude no_login_page_found while unopened candidates remain)
(3) sibling-TLD / trusted-auth / federated brand-return rules (D-108-29, D-108-21…27)
(4) persist only consumer-validated URL
```

**Fields never override Zap/portal reject.**

**Sibling-TLD (D-108-29):** same second-level label across public suffixes (`zoom.com`↔`zoom.us`) = same brand for audience/cross-host/modal when consumer sign-in path + link or live-validation evidence. Modal must not veto solely because TLDs differ.

**Seed note:** Catalog/admin SQL seed remains **interim only** — not milestone complete.

Dual-objective ranking remains: reject portal candidate with **strong positive** evidence; ACCEPT strong consumer navigable; modal-only → NULL only when no navigable consumer remains (including trusted auth).

**Trusted-auth evaluation order (D-108-21 — normative for M12):**

```text
evaluateLoginAudience / discovery reject path:
  (1) strong positive alternate-audience on THIS candidate → reject candidate
  (2) else if same-brand trusted auth host OR dedicated consumer login path
         → ACCEPT
         — even if primaryHasModalLoginTrigger
  (3) else apply cross-subdomain / modal / remaining rules
```

Homepage modal must **never** run as a blanket veto **before** step (2).

**Wording (D-108-22):** Remove or narrow bare `כניסת לקוחות` as a standalone reject token. Keep strong business tokens: `ממשק העסק`, `לקוחות עסקיים`, `כניסה לממשק העסק`, `business interface`, `sa` / seller / merchant / partner / admin / b2b markers.

**Path tokens (D-108-23):** `portal` / `portals` / `ng-portals` **alone** are **NOT** alternate-audience evidence (Bank Hapoalim SPA shells). Do not map “found trusted-auth URL + blanked” to `loginIntelligenceHint=alternate_audience_portal` / Phase 112 — that is a **gate failure**, not a complex-login deferral.

**Trusted-auth host probe + common-path (D-108-24…26 — normative for M13):**

```text
Link/DOM discovery on primaryUrl
  → high-confidence consumer loginUrl? → ACCEPT (existing path)
  → else:
       Probe same-brand AUTH_SUBDOMAIN_PREFIXES (priority: auth, login, secure, e-services, …)
         — paths /login (+ existing common login path fallbacks)
         — require login-page evidence + audience gate (D-108-21)
         — first validated probe → ACCEPT + persist
         — no cross-brand; no sa/seller/… prefixes
  → Same-origin common-path candidate (e.g. {primary}/login)?
       → Validated login page (D-108-26): ACCEPT + persist (GitHub-class)
         — do NOT blank-reject solely for method=common-path / confidence=low
       → Unvalidated / unreachable / not a login page (D-108-25):
         — do NOT persist invent (KSP dead ksp.co.il/login)
         — prefer validated auth probe when available
  → Probed same-brand auth candidates in topCandidates (auth.ksp /login, /signin)?
       → Validate + persist (D-108-26) — MUST persist (M13 COMPLETE: KSP + Zap NULL)
  → Cross-registrable IdP host + brand-return to primary (D-108-27)?
       → ACCEPT + persist (Trello → id.atlassian.com/login?...&continue=trello.com/...)
         — do NOT reject solely for signup in application= when IdP + brand-return present
         — no arbitrary cross-domain without brand-return
  → LIVE-VALIDATE top candidates before no_login_page_found / persist (D-108-28 / M15)
       → reachable + ≥1 identity field → continue; else drop invent (PayPal path)
  → Sibling-TLD same SLD consumer signin (D-108-29 / M15)?
       → ACCEPT (Zoom zoom.com → zoom.us/signin); modal must not veto solely for TLD
```

**Seed note:** Catalog/admin SQL seed of `login_url` is **interim only** — not milestone complete.

### Extension rebuild + reload checklist (D-108-19 — when discovery changes)

```text
1. npm run build  (and/or npm run build:extension-discovery as documented)
2. Reload the side-loaded extension
3. Confirm extension version / bundle timestamp
4. Hard-refresh Hub with correct VITE_POC_EXTENSION_ID
5. Re-prove regression lock: U19 Zap NULL + U24 KSP + U28 Zoom
6. (M16 only, when opened): also prove U27 PayPal auto on same build
```

**M15 closed:** do **not** run further PayPal discovery churn. Optional seed only.
**Reject** any claim that PayPal seed = U27 Pass.

## Acceptance / Gating Criteria (verbatim — PLAN §18)

| ID | Criterion |
|---|---|
| AC-108-1 | Extension functions on current Chrome stable |
| AC-108-2 | Extension functions on current Edge stable |
| AC-108-3 | Browser integration abstraction layer isolates messaging and tab APIs |
| AC-108-4 | Packaging strategy documented for Chrome Web Store and Edge Add-ons |
| AC-108-5 | Hub degrades gracefully when extension is not installed |
| AC-108-6 | Adding a custom service attempts `loginUrl` discovery |
| AC-108-7 | `service_registry` stores `loginUrl` when discovery succeeds with **consumer** confidence |
| AC-108-8 | `service_registry` stores `primaryUrl` and a clear `loginUrl` status when discovery fails |
| AC-108-9 | Discovery failure does not prevent service creation |
| AC-108-10 | Discovery never uses credentials, never autofills, and never submits forms |
| AC-108-11 | Admin can manually edit `loginUrl` for a service |
| AC-108-12 | Admin can trigger rediscovery for a single service |
| AC-108-13 | Admin can trigger bulk `loginUrl` refresh |
| AC-108-14 | Bulk refresh is rate-limited and reports partial failures |
| AC-108-15 | Manual admin `loginUrl` overrides are not overwritten without explicit approval |
| AC-108-16 | Temporary discovery tabs, if used, close reliably and are never confused with user-opened execution tabs |
| AC-108-17 | Build passes |
| AC-108-18 | Discovery never persists a non-consumer / alternate-audience portal as `loginUrl` (including URLs whose path contains `login` but whose page is business/merchant/partner/admin). `login_url` remains `NULL`; `metadata` records `rejectedLoginUrl` and deferral reason for Phase 112 |
| AC-108-19 | When consumer login is modal/overlay on `primaryUrl` **and** there is no separate validated consumer navigable login URL, `login_url` remains `NULL` and `metadata` records `loginEntryType=modal` / `usesModal=true` / `phase112Deferred=true`. A homepage modal trigger must not veto a separate consumer navigable candidate |
| AC-108-20 | Reject with **positive evidence** of wrong audience or modal-only surface; document deferrals in `metadata`. Do not blank-reject ordinary same-origin consumer login pages solely because path contains `login` or a weak modal heuristic fired |
| AC-108-21 | True-positive regression: after false-positive gate changes, rediscovery of known consumer catalog services (at least Shufersal, Clalit, HTZone or current Phase 103 equivalents) must still persist a non-NULL consumer `login_url`, while Zap-class portals remain rejected |
| **AC-108-22** | **Trusted consumer auth host priority:** when discovery finds a same-brand trusted auth-host candidate (e.g. `login.*` / `auth.*` / `e-services.*` / `services.*`) that is a consumer navigable login URL, persist it unless the **candidate** has strong positive alternate-audience evidence. Homepage modal triggers and weak wording (including retail `כניסת לקוחות`, and path tokens `portal`/`portals`/`ng-portals` alone) must not force `login_url=NULL`. Bank Hapoalim-class ACCEPT; Zap-class REJECT remains required |
| **AC-108-23** | **Trusted-auth host probe and validated common-path persist:** (1) when DOM/link discovery yields no high-confidence consumer `loginUrl`, probe same-brand trusted auth hosts (`auth.` / `login.` / equivalents), validate login-page evidence, and persist (KSP-class: `auth.ksp.co.il/login`, not dead `ksp.co.il/login`); (2) when same-origin `/login` (e.g. `https://github.com/login`) is validated as a consumer login page, persist it — do **not** leave `needs_review` solely because `method=common-path` or initial `confidence=low`. **Probed candidates that appear in `topCandidates` must not leave `login_url` empty.** Zap-class REJECT remains required; no cross-brand invent-probing |
| **AC-108-24** | **Federated / parent IdP:** when discovery finds a trusted IdP host on a different registrable domain (`id.` / `login.` / `auth.` / `accounts.` / equivalents) **and** brand-return evidence ties the login to the primary site (`continue` / `callback` / `redirect_*` / `application` containing primary brand, etc.), persist that IdP `loginUrl`. Trello → `id.atlassian.com/login` ACCEPT; do not reject solely for `signup` in query when brand-return is present; arbitrary cross-domain without brand-return remains REJECT; Zap-class REJECT unchanged |
| **AC-108-25** | **Live candidate validation and sibling-TLD brand with Zap dual-gate hard:** (1) open/inspect top candidates — reachable + ≥1 identity field (no fill/submit) — PayPal `https://www.paypal.com/login` is the normative auto target; (2) sibling-TLD same SLD — Zoom `https://zoom.us/signin` ACCEPT; (3) identity fields must not override alternate-audience reject — Zap stays NULL; (4) **Operator closeout 2026-07-14:** live Zoom + Zap + KSP accepted; **PayPal auto-discovery (U27) explicitly deferred** to a later Phase 108 milestone (M16) with interim catalog/admin seed — dual-gate stability preferred over further heuristic churn (D-108-31) |

## AC → Milestone → Verify / Live Mapping

| AC | Primary milestone(s) | Static verify | Live hard gate |
|---|---|---|---|
| AC-108-18 | M9–M15 | Zap REJECT (fields do not accept) | **U19** Zap NULL (**green — lock**) |
| AC-108-21 | M11 | ACCEPT fixtures | **U22** as required |
| **AC-108-22** | **M12** | Hapoalim ACCEPT | **U23** |
| **AC-108-23** | **M13** | KSP + GitHub ACCEPT; Zap REJECT | **U24 KSP + U19** (**COMPLETE — lock**) |
| **AC-108-24** | **M14** | Trello IdP ACCEPT | **U26** if still open |
| **AC-108-25** | **M15 closed / M16 backlog** | Zoom ACCEPT; Zap REJECT; PayPal fixture normative | **U28 Zoom + U19 green**; **U27 → M16 deferred** |

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| M1–M12 | As prior | Prior delivery | As prior | AC-108-1…22 |
| **M13** | Trusted-auth probe + common-path | KSP + Zap dual gate | **COMPLETE** — lock regression | **AC-108-23** |
| **M14** | Federated IdP (Trello) | Brand-return IdP | Keep if open | **AC-108-24** |
| **M15** | Live validation + sibling-TLD | Zoom + Zap dual gate; PayPal deferred | **CLOSED** — APPROVED_WITH_DEFERRED_U27 | **AC-108-25** (U27 deferred) |
| **M16** | PayPal auto-discovery (backlog) | Reopen U27 only; same-build Zap+KSP+Zoom regression | Not open now | AC-108-25 / U27 |

**M15:** **CLOSED** (accepted with deferred U27). Live green: Zap NULL + KSP + Zoom. **No more PayPal discovery gate work until M16.**

**M16:** **Backlog only** — not open. When opened: PayPal auto-discover only + re-prove Zap/KSP/Zoom on same build.

## Detailed Development Plan

### M1–M9
As previously delivered / claimed. Zap reject must stay green through M10–M15. **M13 dual gate (KSP + Zap NULL) must not regress.**

### M10 — True-positive preservation (static only — **not phase-complete**)

Static dual-gate work (ACCEPT + REJECT fixtures) remains valuable and must stay green. **Manager does not accept M10 as phase-complete** while U22 is PENDING_OPERATOR or live sites still NULL.

Do **not** claim “fixed” based on JSDOM/`discoverLoginEntry` Hub fixtures alone.

### M11 — Live discovery restoration (D-108-19, D-108-20) — **HARD GATE**

**Manager approval blocker for Phase 108 complete** (alongside M12).

#### Dual live gate (normative)

| Site | Expected after live admin rediscovery **and/or** custom add |
|---|---|
| **Shufersal** | `login_url` **non-NULL** consumer URL |
| **Clalit** | `login_url` **non-NULL** consumer URL |
| **HTZone** | `login_url` **non-NULL** consumer URL |
| **Zap** | `login_url` **NULL**; never `sa.zap.co.il/.../login` |

#### Per-site live evidence package (**required** for each of Shufersal, Clalit, HTZone, Zap)

Developer must attach in `dev-phase108.md`:

1. **Raw extension discovery payload** from `HUB_LOGIN_ENTRY_DISCOVERY` response, including at least:
   - `success` / ok
   - `loginUrl` (or null)
   - `method` / `discoveryMethod`
   - `confidence` / `loginUrlConfidence`
   - `reason` / error / rejection reason
2. **Persisted `service_registry` metadata** after the attempt:
   - `login_url`, `login_url_status`
   - `loginUrlDiscoveryOutcome`
   - `loginUrlDiscoveryError` (or reason)
   - `discoveryMethod`
   - `loginUrlConfidence`
   - `rejectedLoginUrl` (if any)
   - `phase112Deferred`, `loginIntelligenceHint` (if any)
3. Confirmation that **extension rebuild + reload checklist** was executed for that attempt.
4. Path used: admin rediscovery and/or custom add (both must not leave true positives NULL).

#### Likely live-only failure modes (investigate before more heuristic churn)

| # | Failure mode | Symptom |
|---:|---|---|
| a | Stale extension bundle not reloaded after `build:extension-discovery` | Fixtures PASS; live still old behavior |
| b | Live `method=common-path` / `confidence=low` → persist gate always refuses | Fixtures use dedicated-login-page; live common-path NULL |
| c | Live `success=false` (modal/audience) while consumer navigable URL exists on real page | Over-reject on live DOM |
| d | Persist/clear path wiping URL even when discovery returned a candidate | `clearLoginUrl` / review RPC over-clears |
| e | Extension unavailable / timeout | NULL with `extension_unavailable` / `discovery_timeout` |
| f | Trusted-auth blanked as `alternate_audience_portal` due to modal / weak wording / `ng-portals` | Hapoalim-class NULL — **M12** |
| g | Dead same-origin common-path invent; real auth host never probed | KSP `ksp.co.il/login` low / needs_review; `auth.ksp` missing — **M13** |
| h | Validated common-path blank-rejected solely for method/confidence | GitHub `github.com/login` needs_review — **M13** |
| i | Probed auth in `topCandidates` but `loginUrl=null` / `login_entry_not_found` | KSP auth.ksp listed, not persisted — **M13 U24 STILL OPEN** |
| j | Correct federated IdP URL not persisted (cross-registrable) | Trello `id.atlassian.com` needs_review — **M14** |

#### Observability (D-108-20)

- Admin Integration Status (and/or equivalent) must show discovery outcome fields after every add/rediscover.
- Blind “fixed again” without raw payload + persisted metadata is **not acceptable**.
- If live U22–U26 fails, capture payload **before** further gate tuning.

#### Acceptance for M11 done

| Gate | Required |
|---|---|
| Extension rebuild + reload checklist | Documented per attempt |
| Live U22 | **Pass** — Shufersal, Clalit, HTZone each non-NULL consumer `login_url` |
| Live U19 | **Pass** — Zap NULL; not business portal |
| Per-site evidence | Raw payload + persisted metadata for all four sites |
| Static fixtures | Still PASS (ACCEPT + REJECT) — necessary, not sufficient |
| `verifyPhase103Execution.mjs` | PASS |
| `npm run build` | PASS |

#### Out of M11 scope
- Phase 112 modal open/fill
- Claiming COMPLETE on static fixtures alone
- Hard-coded per-site allowlists as primary solution
- Treating M12 as a substitute for U22 evidence

### M12 — Trusted-auth priority / Bank Hapoalim-class (D-108-21…23, AC-108-22) — **HARD GATE**

**Focused correction.** Does **not** replace M11. Operator evidence: Hapoalim discovery returns `rejectedLoginUrl=https://login.bankhapoalim.co.il/ng-portals/auth/he/login` with `loginUrl=null`, `outcome=needs_review`, `loginIntelligenceHint=alternate_audience_portal`, `phase112Deferred=true`. That URL is a same-brand trusted consumer auth host — Phase 108 **must persist it**.

#### Required code/gate changes

1. **Reorder** `evaluateLoginAudience` (and any parallel discovery reject path) per D-108-21:
   - strong positive alternate-audience on **THIS** candidate → reject
   - else same-brand trusted auth / dedicated consumer login path → **ACCEPT** even if `primaryHasModalLoginTrigger`
   - else modal / cross-subdomain rules
2. **Narrow `ALTERNATE_AUDIENCE_WORDING`:** remove/narrow bare `כניסת לקוחות`; keep `ממשק העסק` / `לקוחות עסקיים` / `business interface` / `sa`|seller|b2b markers.
3. **Path tokens:** `portal` / `portals` / `ng-portals` alone are **NOT** alternate-audience evidence (D-108-23).
4. **Do NOT** set `loginIntelligenceHint=alternate_audience_portal` / `phase112Deferred=true` solely because a trusted-auth consumer URL was blanked — fix the gate; do **not** defer trusted-auth blanking to Phase 112.
5. **Fixtures:** ACCEPT Bank Hapoalim-class URL; REJECT Zap **unchanged**.
6. **Extension rebuild + reload checklist (D-108-19)** on **every** attempt before claiming live Pass.
7. **Optional (non-blocking):** admin one-click “approve `rejectedLoginUrl`” UX — interim only; **not** a substitute for the gate fix.

#### Live gates for M12

| # | Scenario | Expected | Gate |
|---:|---|---|---|
| **U23** | Live Bank Hapoalim-class rediscovery / add | `login_url` **non-NULL** trusted auth host (e.g. `login.bankhapoalim.co.il/...`); must **not** remain NULL with `alternate_audience_portal` solely due to homepage modal / weak wording / `ng-portals` | Hard |
| **U19** | Live Zap | still **NULL**; not business portal | Hard (regression) |
| **U22** | Live Shufersal / Clalit / HTZone | still **non-NULL** (regression) | Hard (regression) |

#### Acceptance for M12 done

| Gate | Required |
|---|---|
| Evaluation order | D-108-21 implemented and documented |
| Wording / path tokens | D-108-22 / D-108-23 applied |
| Static fixtures | Hapoalim-class **ACCEPT** PASS; Zap **REJECT** PASS |
| Extension rebuild + reload | Checklist documented for U23 attempt |
| Live U23 | **Pass** — Hapoalim-class non-NULL trusted-auth `login_url` + raw payload + persisted metadata |
| Live U19 | Still **Pass** (Zap NULL) |
| Live U22 | Still **Pass** (three catalog non-NULL) — or still explicitly PENDING with honest status; **phase complete** still needs U22 Pass |
| No Phase 112 deferral misuse | Trusted-auth blanking not marked as Phase 112 ownership |
| `verifyPhase108FalsePositiveGate.mjs` | PASS (accept + reject including Hapoalim-class) |
| `verifyPhase103Execution.mjs` | PASS |
| `npm run build` | PASS |
| Optional approve-rejected UX | Optional only; must not be claimed as M12 substitute |

#### Out of M12 scope
- Replacing M11 / skipping U22 evidence
- Phase 112 modal open/fill / authoritative `loginComplexity`
- Claiming COMPLETE on fixtures alone
- Hard-coded Hapoalim-only allowlist as the primary “fix” (prefer generic trusted-auth rules)

### M13 — Trusted-auth host probe + validated common-path (D-108-24…26, AC-108-23) — **HARD GATE**

**Focused correction.** Does **not** replace M11 or M12.

**Operator evidence (evening):** KSP → `method=common-path`, `loginUrl=https://ksp.co.il/login` (dead), `confidence=low`, `outcome=needs_review`, `success=false`; real `https://auth.ksp.co.il/login?...` never candidate.

**Operator evidence (night):** GitHub → correct `https://github.com/login` via common-path / low confidence but `needs_review` / not persisted solely due to blanket common-path / low-confidence persist reject. **U25 may now Pass after M13 common-path fix.**

**Operator evidence (late — U24 STILL OPEN):** After probe work, KSP `topCandidates` include `auth.ksp.co.il/login` and `/signin` (score 8, confidence low) but `loginUrl=null`, `reason=login_entry_not_found`. **Listing candidates is not sufficient — validate + persist.** GitHub U25 PASS does **not** close U24.

#### Required code/discovery changes

1. **Trusted-auth host probe (D-108-24):** When link/DOM discovery yields **no high-confidence** consumer `loginUrl`, probe constructed same-brand hosts from existing `AUTH_SUBDOMAIN_PREFIXES` (priority at least: `auth`, `login`, `secure`, `e-services`, then remaining). Probe `/login` (+ existing common login path fallbacks as needed). Each probe: DiscoveryExecutor open/inspect (or existing fetch equivalent); require **login-page evidence** + audience gate pass (D-108-21). First validated probe **ACCEPT** and persist. Cap concurrency/timeout for bulk refresh (AC-108-14). **No** cross-brand invent-probing. **No** alternate-audience prefixes (`sa`, `seller`, …).
2. **Prefer validated auth probe over unvalidated common-path (D-108-25):** Do **not** prefer / persist dead invents such as `https://ksp.co.il/login` when a validated same-brand auth probe exists (or when the invent lacks login-page evidence / reachability).
3. **Validated common-path may persist (D-108-26):** **STOP** blank-rejecting solely because `method=common-path` or initial `confidence=low` in `shouldPersistDiscoveredLoginUrl` (and sanitize path). When same-origin (or same-brand) candidate such as `https://github.com/login` is **validated** as a consumer login page → **persist**.
4. **U24 unfinished — persist probed auth (D-108-26 on probe results):** When `topCandidates` contain same-brand trusted-auth URLs (`auth.ksp.co.il/login`, `/signin`), discovery **must validate + persist** — must **not** end with `loginUrl=null` / `login_entry_not_found` while those candidates are scored.
5. **Fixtures:** KSP-class ACCEPT `auth.ksp.co.il/login`; GitHub-class ACCEPT `github.com/login`; Zap REJECT unchanged.
6. **Extension rebuild + reload checklist (D-108-19)** every attempt before claiming live Pass.
7. **Seed is interim only** — catalog/admin SQL `login_url` seed does **not** close M13.

#### Live gates for M13

| # | Scenario | Expected | Gate |
|---:|---|---|---|
| **U24** | Live KSP rediscovery / add | `login_url` **persists** `https://auth.ksp.co.il/login` (query optional); must **not** leave `loginUrl=null` / `login_entry_not_found` when auth.ksp is in `topCandidates`; must **not** stop at dead `ksp.co.il/login` | Hard — **STILL OPEN** |
| **U25** | Live GitHub rediscovery / add | `login_url` persists `https://github.com/login`; must **not** remain `needs_review` solely because `method=common-path` / initial `confidence=low` | Hard (operator: may Pass; still required for M13 complete) |
| **U19** | Live Zap | still **NULL**; not business portal | Hard (regression) |
| **U22** | Shufersal / Clalit / HTZone | still **non-NULL** (regression) | Hard (M11 — not replaced) |
| **U23** | Hapoalim-class | still **non-NULL** trusted-auth (regression) | Hard (M12 — not replaced) |

#### Acceptance for M13 done

| Gate | Required |
|---|---|
| Auth host probe | D-108-24 implemented when no high-confidence DOM URL |
| Dead common-path demoted | D-108-25 — KSP invent not preferred over validated `auth.ksp` |
| Persist policy | D-108-26 — validated common-path persists; **probed auth topCandidates persist** |
| U24 | **Pass** — `login_url` = `auth.ksp…/login` (not merely topCandidates) |
| U25 | **Pass** — GitHub persisted |
| Static fixtures | KSP auth ACCEPT PASS; GitHub ACCEPT PASS; Zap REJECT PASS |
| Extension rebuild + reload | Checklist documented for U24/U25 attempts |
| Seed | If used, labeled **interim only** — not claimed as M13 complete |
| `verifyPhase108FalsePositiveGate.mjs` | PASS (accept + reject incl. KSP + GitHub + Zap) |
| `verifyPhase103Execution.mjs` | PASS |
| `npm run build` | PASS |

**M13 is not done until U24 Pass.** U25 Pass alone is insufficient.

#### Out of M13 scope
- Replacing M11/M12 / skipping U22/U23 evidence
- Claiming M13 complete via catalog seed alone
- Claiming M13 complete via U25 alone while U24 fails
- Cross-brand invent-probing (federated IdP with brand-return is **M14**, not invent-probing)
- Phase 112 modal open/fill
- Hard-coded KSP-only or GitHub-only allowlist as the primary fix

### M14 — Federated / parent IdP with brand-return (D-108-27, AC-108-24) — **HARD GATE**

**Focused correction.** Does **not** replace M11/M12/M13. Operator: Trello discovers `https://id.atlassian.com/login?application=trello--direct-signup&continue=https://trello.com/auth/atlassian/callback` but outcome `needs_review` / not persisted (cross-registrable IdP vs `trello.com`).

#### Required code/gate changes

1. **ACCEPT** cross-registrable trusted IdP hosts (`id` / `login` / `auth` / `accounts` / `sso` / `identity`, or equivalents already used as auth prefixes) when **brand-return evidence** ties to `primaryUrl` registrable domain: `continue` / `callback` / `return` / `return_url` / `redirect_uri` / `redirect_url` / `next` / `RelayState` / `application` value containing the primary brand label, etc.
2. **Canonical ACCEPT:** Trello → `https://id.atlassian.com/login?...&continue=https://trello.com/...`
3. Do **not** reject solely because `application` contains `signup` when IdP host + brand-return are present.
4. Do **not** accept arbitrary cross-domain URLs without brand-return evidence.
5. Zap-class REJECT unchanged (no consumer brand-return).
6. Do **not** blindly invent/probe every IdP on the internet — ACCEPT when discovery finds IdP URL **with** brand-return evidence.
7. **Fixtures:** Trello-class ACCEPT `id.atlassian.com/login` + brand-return; Zap REJECT unchanged.
8. **Extension rebuild + reload checklist (D-108-19)** every attempt before claiming live Pass.
9. Keep M11/M12/M13 obligations (especially **U24 STILL OPEN**).

#### Live gates for M14

| # | Scenario | Expected | Gate |
|---:|---|---|---|
| **U26** | Live Trello rediscovery / add | `login_url` persists `https://id.atlassian.com/login?...` with continue/callback to trello.com; must not remain `needs_review` solely for cross-registrable IdP | Hard |
| **U19** | Live Zap | still **NULL** | Hard (regression) |
| **U24** | Live KSP | still required Pass for M13 (not replaced by U26) | Hard (M13) |
| **U25** | Live GitHub | still Pass for M13 | Hard (M13) |

#### Acceptance for M14 done

| Gate | Required |
|---|---|
| Federated IdP rule | D-108-27 implemented (IdP host + brand-return → ACCEPT) |
| Signup query | Not sole reject when IdP + brand-return present |
| No blind cross-domain | Arbitrary cross-domain without brand-return still REJECT |
| Static fixtures | Trello-class ACCEPT PASS; Zap REJECT PASS |
| Extension rebuild + reload | Checklist documented for U26 attempt |
| Live U26 | **Pass** — Trello IdP URL persisted + raw payload + persisted metadata |
| Regression | U19 Zap NULL; U24/U25 still required (U24 may still be open — honest status) |
| verify + build | FalsePositiveGate + Phase 103 + build PASS |

#### Out of M14 scope
- Blind cross-domain accept without brand-return
- Federated login automation / OAuth fill (Phase 112)
- Claiming phase complete without M11/M12/M13 evidence
- Replacing M15 Zap dual gate with U26 alone

### M15 — Live candidate validation + sibling-TLD + Zap dual-gate (D-108-28…31, AC-108-25) — **CLOSED**

**Status:** **CLOSED** as **APPROVED_WITH_DEFERRED_U27** (D-108-31).

**Operator live green (2026-07-14):** Zap `login_url=NULL` + KSP non-NULL + Zoom `zoom.us/signin` non-NULL.

**Deferred:** **U27 PayPal auto-discovery** → **M16** backlog. Interim: optional catalog/admin seed `https://www.paypal.com/login` (`loginUrlSource=admin|catalog_seed`). **Not** Phase 112.

**Freeze:** No further Phase 108 discovery-heuristic churn for PayPal (or related gate tuning that risks Zap/KSP/Zoom). Do not instruct Developer to chase PayPal auto-discovery until M16 is explicitly opened.

#### What M15 delivered / locked
| Gate | Status |
|---|---|
| D-108-28 live-validate machinery | Delivered (as applicable); freeze churn |
| D-108-29 sibling-TLD | **U28 Zoom PASS** — lock |
| D-108-30 Zap dual gate | **U19 Zap NULL** with Zoom — lock (M13 KSP also lock) |
| U27 PayPal auto | **DEFERRED → M16** |

#### Developer stop-work (now)
1. **No more PayPal discovery gate work.**
2. Optional only: catalog/admin seed `https://www.paypal.com/login`.
3. Protect regression: Zap NULL, KSP non-NULL, Zoom non-NULL.
4. Do not claim U27 Pass via seed.

#### When M16 opens later (not now)
- PayPal auto-discover only.
- Same-build regression: Zap NULL + KSP + Zoom must still Pass.
- Extension rebuild + reload (D-108-19).

### M16 — PayPal auto-discovery (BACKLOG — not open)

Deferred U27 only. Do not start unless Architect/Manager reopen.

## Regression Gate — Phase 103 Execution

| Script | When | Expected |
|---|---|---|
| `verifyPhase103Execution.mjs` | If any discovery change | **PASS** |
| `verifyPhase108FalsePositiveGate.mjs` | Keep green | Zap REJECT + Zoom ACCEPT (PayPal fixture may remain normative target) |

## Critical UAT Gate — Locked vs Deferred

| # | Scenario | Status |
|---:|---|---|
| **U19** | Zap NULL | **GREEN — LOCK** (M13 + M15) |
| **U24** | KSP auth non-NULL | **GREEN — LOCK** (M13) |
| **U28** | Zoom `zoom.us/signin` | **GREEN — LOCK** (M15) |
| **U27** | PayPal auto `www.paypal.com/login` | **DEFERRED → M16** |
| **U26** | Trello IdP | Keep if still open (M14) |

**Program may proceed to next phases.** Phase 108 discovery backlog = PayPal auto (M16) ± open prior items.

## Required Developer Evidence (closeout)

| Evidence area | Required content |
|---|---|
| M15 closeout | Acknowledge APPROVED_WITH_DEFERRED_U27; U27 → M16 |
| Live green lock | Zap NULL + KSP + Zoom — protect; no further churn |
| PayPal | No more auto-discovery work; optional seed only; not U27 Pass |
| Freeze | Affirm no further discovery-heuristic changes until M16 |

## Out of Scope (now)
- Further PayPal discovery heuristics / gate churn
- Moving PayPal to Phase 112
- Claiming full AC-108-25 without documenting U27 deferred
- Breaking Zap / KSP / Zoom while “helping” PayPal

## Risks / Open Questions
- Seeded PayPal is interim — M16 must restore auto-discovery carefully with dual-gate proof.
- Any accidental discovery churn before M16 risks Zap/KSP/Zoom regression — freeze is mandatory.

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED_WITH_DEFERRED_U27

### Review Notes
- Architect **APPROVED_WITH_DEFERRED_U27** (D-108-31) 2026-07-14.
- Operator live green: **Zap NULL + KSP + Zoom**. PayPal auto empty after churn — stop.
- **M15 CLOSED** with U27 deferred to **M16**. Freeze discovery-heuristic churn.
- Optional PayPal catalog/admin seed only — not U27 Pass.
- Program may proceed to subsequent phases.
- STATUS: **M15_CLOSED_U27_DEFERRED**.

### Required Corrections
_None for M15 closeout. Developer: stop PayPal discovery work; optional seed; lock Zap/KSP/Zoom. Do not open M16 until instructed._

