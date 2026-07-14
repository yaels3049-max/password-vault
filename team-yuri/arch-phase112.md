# Architecture Phase 112

## Phase Identifier
PHASE=112

## Status
STATUS: REJECTED

AMENDED: 2026-07-14 — **Operator UAT: email-first / medium step-1 never fills** (M9 path required: D-112-20…22, AC-112-25).

AMENDED: 2026-07-14 — **Formal Architecture Review (governance).** Official status remains **Rejected**. Observed: no observable Home improvement; step-1 not filled; **no positive or negative visible result** so user cannot distinguish unsupported vs failure vs inactive feature. Blocking defects BD-112-1…6. Mandatory non-silent user status (D-112-23 / AC-112-26). Development evidence package required before revalidation (D-112-24). Dependent automatic-completion phases **blocked** until Phase 112 revalidation PASS (D-112-25). Infra/refactor/code-complete are **not** acceptance evidence. Phase must not be called complete, partially accepted, or infrastructure-complete.

## Phase Goal
Extend the platform from **standard single-page autofill (Phase 110)** to **modern multi-pattern login experiences** by classifying login complexity, enriching **authoritative Login Intelligence** metadata in Service Registry, orchestrating safe **medium** flows **including observable identity-first field fill on step 1 with explicit success/failure feedback**, recommending adapters for **complex** flows, and producing **integration health** signals — while preserving Phase **103** open-first execution, never blocking navigation, and never introducing auto-submit, hidden-field fill, federated automation, CAPTCHA/OTP bypass, or service-specific branching outside approved adapters.

Phase 112 owns **Login Intelligence classification + metadata lifecycle + medium orchestration + adapter recommendation**. It does **not** own `loginUrl` discovery (108), standard-form-only generic matching expansion (110), account/auth (109), admin CRUD ownership (107), or URL identity/canonicalization (113).

### Normative expected behaviour (medium / two-step — acceptance bar)

For a **supported** website with a two-step login flow, the system shall:

1. Open or identify the login interface.
2. Identify the first login field.
3. Select credentials associated with the **active Digital Home profile**.
4. Fill the first field (email, username, customer number, or other explicitly supported identifier).
5. Stop before the next step unless that next step is explicitly in phase requirements (Continue click / password step remain out of default scope).
6. Provide **visible feedback** when the field cannot be identified or filled (AC-112-26) — never silent no-op.

Acceptance requires behaviour that is **observable, repeatable, testable, documented, and demonstrated in the delivered environment**. A feature that produces no observable behaviour is **non-functional**.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=112`
- `team-Yuri/PLAN.md` §18 — Phase 112 (AC-112-1 … AC-112-26); Changelog **4.6**, **4.7**, **5.16**, **5.17**
- Formal Architecture Review document (operator / governance) — 2026-07-14 Rejected
- `team-Yuri/arch-phase103.md` — execution pipeline (consume; do not redesign)
- `team-Yuri/arch-phase108.md` — discovery ownership; deferral hooks (consume; do not reopen gates)
- `team-Yuri/arch-phase110.md` — standard `basic` autofill — **must not** be the sole medium identity-first implementation
- `team-Yuri/arch-phase107.md` — Admin surfaces
- Operator evidence: multiple two-step sites — no step-1 fill; no distinguishable failure UX
- Phase 108 PayPal M16 — not Phase 112 discovery

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-112-1: Authoritative Login Intelligence owner** | PLAN Login Intelligence Ownership | Phase 112 is the **only** writer of authoritative LI fields listed in PLAN (complexity, flow type, detection status/confidence/engine version, adapter recommendation/lifecycle, integration health, supportedCredentialFields, federated options, OTP/CAPTCHA/iframe/modal/multi-step flags, `lastValidatedBy`). Other phases may **consume** or write **deferral hints** (108) / fill outcomes (110) but must not overwrite LI without 112 policy. |
| **D-112-2: Complexity model** | AC-112-1, AC-112-2 | Registry supports `loginComplexity`: `basic` \| `medium` \| `complex` \| `unknown` (exact column names may follow schema conventions / JSON metadata). Definitions per PLAN: basic = Phase 110 territory; medium = limited generic orchestration; complex = adapter/review; unknown = not yet classified or failed safely. |
| **D-112-3: Decision order (normative)** | PLAN Login Intelligence Decision Flow | (1) Admin-validated metadata wins. (2) Else latest validated auto metadata. (3) `basic` → Phase 110 generic autofill. (4) `medium` → Phase 112 orchestration. (5) `complex` → approved adapter when present. (6) Else open website only. (7) Failure never blocks navigation. (8) Admin override never auto-replaced without explicit approval. |
| **D-112-4: Reclassification + confidence** | AC-112-19, AC-112-20 | LI is mutable on rediscovery / scheduled refresh / admin reclassify. High confidence → may auto-apply; medium → store + recommend review; low → must not replace verified metadata. Prefer audit/history of previous values when supported. |
| **D-112-5: Consume Phase 108 deferrals** | arch-108 D-108-15…17 | When `phase112Deferred=true` and/or hints (`modal_on_primary`, `complex_login_surface`, `needs_review`; **not** gate-bug `alternate_audience_portal` on trusted-auth blanks), Phase 112 **classifies** the surface. It does **not** invent a second consumer `loginUrl` discovery pipeline or “fix” Portal-vs-trusted-auth blanking that arch-108 forbids mapping to 112. |
| **D-112-6: Medium orchestration scope (amended)** | AC-112-4, AC-112-5, AC-112-25 | Detect/classify and, when safe: email-first / username-first / id-first / Continue-Next / password-second-step; prefer native email path on auth-method-selection screens. On identity-only step 1, **must fill visible identity field(s)** with saved credentials when extension + credentials + field mapping allow (AC-112-25). **no auto-submit** (AC-112-13); **do not** auto-click Continue/Next by default. Password step after user Continue is optional later work — **not** required to reopen this reject; step-1 identity fill **is** required. |
| **D-112-7: Federated / OTP / CAPTCHA / iframe / modal / popup** | AC-112-6, AC-112-7 | Detect and metadata-mark only. No federated click automation. No CAPTCHA solve. No OTP read. iframe/modal/popup: evaluate feasibility; automate interaction only when fields are visible and policy-safe (modal may be medium when on-page and visible; iframe/popup default complex / unsupported until adapter). Failure → open site only. |
| **D-112-8: Adapter recommendation + lifecycle** | AC-112-9, AC-112-21 | Mark `adapterRecommended` + `adapterReason` when generic repeatedly fails, ambiguity high, bank-specific/dynamic, iframe/popup constraints, OTP/CAPTCHA-dominated, or admin confirms insufficiency. Lifecycle: `recommended` → `approved` → `implemented` → `validated` → `deprecated`. No service-specific JS outside approved adapters (AC-112-15). |
| **D-112-9: Integration health** | AC-112-8, AC-112-22 | Explicit states: `healthy` \| `degraded` \| `needs_review` \| `adapter_required` \| `unsupported`. Visible in Admin. Produced from detection/autofill outcomes; never shown as raw engine errors to end users. |
| **D-112-10: Retry policy** | AC-112-23 | Transient detection failures may retry per documented policy. Permanent failures wait for admin rediscovery / scheduled refresh / manual update. No duplicate conflicting LI rows. |
| **D-112-11: Engine provenance** | AC-112-24 | Persist `loginDetectionEngineVersion` and `lastValidatedBy` ∈ {`auto`,`admin`,`adapter`}. |
| **D-112-12: Preserve 103 / 110 / regression** | AC-112-3, AC-112-16, AC-112-17 | Do not redesign `executeServiceFromTile`. Phase 110 `basic` path must not regress. Shufersal + Clalit remain mandatory PASS anchors. |
| **D-112-13: Admin UX** | AC-112-10 | Admin shows LI fields (complexity, flow, status, confidence, last checked, engine version, lastValidatedBy, adapter recommendation/lifecycle, health, reason) + **reclassify / refresh** + **manual override**. Align with Phase 107 patterns. |
| **D-112-14: User-facing copy** | PLAN user-facing | Friendly Hebrew only; no technical complexity labels / raw detection errors. Examples per PLAN (“פתחנו את האתר…”, “…שלב נוסף…”, “…אישור ידני…”). |
| **D-112-15: Flow taxonomy (minimum)** | PLAN Supported flow classifications | Classify at least: `standard_single_page`, `email_first`, `username_first`, `id_first`, `password_second_step`, `auth_method_selection`, `modal_login`, `popup_login`, `iframe_login`, `federated_login_available`, `federated_only`, `otp_required`, `captcha_required`, `adapter_required`, `unknown`. |
| **D-112-16: Schema placement** | AC-112-2 | Prefer extending existing Service Registry / `service_providers.metadata` (or dedicated columns if Manager/Dev choose) with LI keys. Migration + `docs/MIGRATION_PHASE_112.md` required for operators. Exact names may snake_case in DB. |
| **D-112-17: Non-goals boundary** | PLAN Non-goals | No CAPTCHA solve, OTP read, auto-submit, federated automation, password rotation, credential sharing, Phase 116 identity work, Phase 108 discovery ownership, browser-security bypass, plaintext credential storage. PayPal seed/admin path remains 108 M16 — not 112 discovery. |
| **D-112-18: Hub ↔ extension** | Execution safety | Prefer **extend** existing Hub↔extension messaging (detect/fill) for classification signals and medium step assist. Do not invent a parallel execution protocol. Extension injectability still subject to host permissions (document in migration notes). |
| **D-112-19: Depth vs classification (amended)** | Ship safety + UAT | Classification + Admin + health alone are **insufficient** to close Phase 112 while medium step-1 remains broken. Rich step-2 password auto-fill after Continue may still ship incrementally. Prefer safe non-action over risky automation when confidence is low — **but** calling Phase 110 standard gate on identity-only pages is not “safe non-action”; it is a **failed medium path** and must be fixed per D-112-20. |
| **D-112-20: Medium must not reuse Phase 110 standard gate** | AC-112-25; operator UAT | `executeMediumAssist` / medium extension path **MUST NOT** solely call `runGenericAutofill` / `assessStandardLogin` (requires same-page password). Implement a **dedicated identity-first / partial-field** path: detect ≥1 visible identity input; map non-password `loginFields` only; fill those; treat missing password on DOM as expected (not failure to start). Phase 110 `basic` path stays unchanged for same-page forms. |
| **D-112-21: Partial fill success semantics** | AC-112-25 | Medium step-1 success = at least one visible identity field filled and verified. Do **not** require `filled === loginFields.length` when password (or later-step fields) are absent from the DOM. Surface friendly Hebrew that user must click Continue/Next. |
| **D-112-22: Operator-visible medium proof** | AC-112-25, M9 | Closing M9 requires live UAT on ≥1 known email-first (or username-first) surface: step-1 identity field actually receives vault value. Fixture-only / classify-only evidence is not enough for AC-112-4/25. Document fixture HTML + one live site in migration/dev notes. |
| **D-112-23: No silent failure — explicit user status** | AC-112-26; BD-112-2/3/6 | When automatic completion cannot run, Hub **must** show one explicit, understandable status (Hebrew). Allowed categories (map to user copy; keep technical reason in diagnostic logs only): (1) login form not detected; (2) first login field not detected; (3) no credentials for selected profile; (4) website not supported; (5) blocked by the website; (6) system error. Opening the site alone with a generic “continue manually” message that does not distinguish these cases is **insufficient**. Never expose raw stack traces or credential values. |
| **D-112-24: Revalidation evidence package** | Governance review | Before Architect re-review, Manager/Dev must deliver: exact PLAN ACs for 112; requirement→implementation mapping; files/components changed; activation conditions; **named supported websites** used in development/UAT; recorded evidence of step-1 fill; console + extension logs from a failed attempt; each failure classified (login interface not detected \| field not detected \| profile not resolved \| credential not available \| browser permission missing \| script not injected \| website security restriction \| unsupported login flow \| unhandled implementation defect). |
| **D-112-25: Dependent phases blocked** | Governance | Automatic-completion / medium-or-complex login work in **later phases** must not be started or accepted until Phase 112 revalidation PASS. Do not describe 112 as complete, partially accepted, or infrastructure-complete while REJECTED. |

### Normative execution sketch

```text
executeServiceFromTile (Phase 103 — orchestration unchanged)
  → openUrl = loginUrl ?? primaryUrl  (always open / keep open on failure)
  → site-specific adapterId? → adapter (unchanged)
  → else read Login Intelligence (admin override > validated auto):
       basic    → Phase 110 generic autofill (unchanged — standard same-page gate OK)
       medium   → Phase 112 identity-first path (D-112-20/21): fill visible identity only;
                  NEVER require assessStandardLogin / map password on step 1;
                  no auto-submit; no auto-click Continue
       complex  → approved adapter if available; else open + friendly guidance + health
       unknown  → open; optional conservative detect-or-110 if clearly standard; else health=needs_review
  → consume phase112Deferred / loginIntelligenceHint as classification inputs (not as discovery rewrite)
```

## Constraints / Non-Negotiables
- AC-112-1 … AC-112-26 (full PLAN table).
- Navigation never blocked; autofill failure never closes tab (AC-112-11, AC-112-12).
- No auto-submit; no hidden-field filling (AC-112-13, AC-112-14).
- No service-specific branching outside approved adapters (AC-112-15).
- Phase 103 flow unchanged (AC-112-16); Shufersal/Clalit preserved (AC-112-17); build passes (AC-112-18).
- Admin overrides protected from silent auto-replace (AC-112-19, AC-112-20).
- Medium step-1 identity fill mandatory when supported + credentials/extension allow (AC-112-25 / D-112-20).
- **No silent failure** — explicit user status required (AC-112-26 / D-112-23).
- Credentials never used during discovery/classification; never in user messages / screenshots / logs.
- Prefer safe non-action over risky autofill — but identity-first medium must not silently no-op via Phase 110 standard gate, and must not fail without status.
- Do not reopen Phase 108 discovery freeze / Zap / PayPal M16 as Phase 112 scope.
- Dependent autofill phases blocked until revalidation (D-112-25).

### Blocking defects (acceptance stoppers)

| ID | Defect |
|---|---|
| **BD-112-1** | First field in a supported two-step login flow is not populated |
| **BD-112-2** | No visible failure reason when completion does not run |
| **BD-112-3** | Delivered behaviour does not demonstrate Phase 112 is active |
| **BD-112-4** | No evidence active user profile is connected to the attempted fill |
| **BD-112-5** | No evidence the tested login page was detected |
| **BD-112-6** | No distinction between unsupported website and implementation failure |

### Revalidation criteria (all required)

1. Released build contains Phase 112 implementation and feature is enabled in the tested environment.
2. Active Digital Home profile is correctly selected.
3. First field is filled on **every website defined as supported** by the phase (published supported list).
4. Unsupported cases display an **explicit** AC-112-26 status.
5. Results repeatable after closing and reopening the browser.
6. No credentials exposed in logs, screenshots, or error messages.
7. Evidence package (D-112-24) attached to Manager/Dev handoff for Architect.

## Technical Boundaries / Out of Scope
- Redesigning `discoverLoginEntry` / audience gates / sibling-TLD / PayPal discovery.
- Redesigning Phase 103 pipeline or weakening Phase 110 `basic` standard gate (medium gets a **separate** path; basic stays strict).
- Implementing every bank-specific adapter in this phase (recommendation + lifecycle only unless an adapter is already approved).
- Phase 116 canonicalization / duplicate merge.
- Solving CAPTCHA / reading OTP / federated IdP automation.
- Auto-click Continue/Next; mandatory password fill after user Continue (deferred unless later amendment).
- Storing plaintext passwords; AI/ML login detection.

## Dependencies and Interfaces
| Interface | Direction | Notes |
|---|---|---|
| Phase 103 `executeServiceFromTile` | consume + soft branch on LI | Orchestration shell unchanged |
| Phase 110 generic engine | consume for `basic` only | Must not be sole medium path |
| Phase 112 identity-first fill | new / extend | Extension mode or parallel helper (D-112-20) |
| Phase 108 metadata / deferrals | consume | Hints + deferred flags |
| Service Registry / Supabase | write LI | Migration + RLS-safe admin writes |
| Admin UI (Phase 107 patterns) | update | View / refresh / override |
| Extension detect/fill messages | extend | Medium identity-first assist |
| User toast / non-blocking copy | produce | Friendly Hebrew only |

## Data / State Considerations
- LI metadata keys (PLAN list): complexity, flow type, detection status/confidence/lastChecked/error/engineVersion, lastValidatedBy, adapterRecommended/Reason/Lifecycle, integrationHealth, supportedCredentialFields, federatedLoginOptions, requiresOtp/Captcha, usesIframe/Modal, isMultiStep.
- Reclassification must not duplicate rows; upsert/merge under provider id.
- High/medium/low confidence gates apply vs verified admin state.
- Engine version bumped when classification **or** medium fill heuristics change.

## Security / Privacy Considerations
- No credentials in classification probes.
- No CAPTCHA/OTP bypass; no federated button automation.
- Do not fill hidden fields.
- Admin-only mutation of overrides / forced reclassify.
- User never sees raw detection stacks.

## Testing and Lint Expectations
- Unit: classifiers; confidence; override; health; identity-first fixture; **status mapping unit tests for each AC-112-26 category**.
- Integration / verify: medium path does not use `assessStandardLogin` as hard veto for identity-only pages.
- Regression: Shufersal + Clalit via Phase 110/`basic`.
- Live UAT: every **declared supported** site fills step-1; unsupported shows explicit status; repeat after browser restart.
- `npm run build` PASS (AC-112-18).
- Docs: `docs/MIGRATION_PHASE_112.md` — supported site list, activation conditions, status catalogue, identity-first mode.

## Functional Testability
- Observable: step-1 field fills **or** an AC-112-26 status is shown — never silent open-only for a medium attempt.
- Minimal E2E: (1) supported two-step → first field filled. (2) force each failure class → matching status. (3) basic Shufersal/Clalit unchanged. (4) browser restart → still works.

## Handoff Notes for Manager
1. Official status: **Rejected**. Sync manager/dev; **do not** claim COMPLETE / partial / infrastructure-complete.
2. Blocking work remaining:
   - **M9** — identity-first fill observable on supported list (BD-112-1, AC-112-25); if code landed, prove **live** UAT.
   - **M10** — mandatory failure feedback (D-112-23 / AC-112-26); kill silent / ambiguous medium outcomes (BD-112-2,3,6).
3. Collect **D-112-24 evidence package** before Architect re-review (see Required Development-Team Response in review).
4. Publish **supported websites list** used for acceptance; unsupported → explicit status.
5. Dependent autofill phases blocked (D-112-25).
6. Out of scope: Continue auto-click, mandatory step-2 password, CAPTCHA/OTP, federated, 108 rediscovery.

## Architect Review
ARCHITECT_REVIEW_STATUS: REJECTED

### Review Notes
Formal Architecture Review confirms Rejected. Prior medium path (and any code-only M9 without live proof / without distinctive failure UX) does not meet acceptance: no observable step-1 fill and silent/ambiguous outcomes. Non-functional if not observable. Re-review only after M9+M10 + D-112-24 package + revalidation criteria.

### Required Corrections
1. Observable step-1 fill on every declared supported two-step site (BD-112-1 / AC-112-25 / D-112-20…22).
2. Explicit AC-112-26 user status on all non-success medium attempts (BD-112-2,3,6 / D-112-23) — **M10**.
3. Evidence: profile → credentials → page detection → fill or classified failure (BD-112-4,5 / D-112-24).
4. Supported vs unsupported distinguishable in UX (BD-112-6).
5. Shufersal + Clalit regression PASS; no credential leakage.
6. Do not mark complete until revalidation criteria all PASS; keep dependent phases blocked.
