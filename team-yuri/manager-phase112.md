# Manager Phase 112

## Phase Identifier
PHASE=112

## Status
STATUS: READY_FOR_DEVELOPER
FOCUS: **M9 + M10 BLOCKING — Architect REJECTED (governance)**

**FORBIDDEN STATUS LABELS (until revalidation PASS):**
- COMPLETE
- partial / partially accepted
- infrastructure-complete
- code-complete as acceptance evidence

Silent open-only = **non-functional**. Fixture-only / infra-only ≠ accept.

## Architecture Amendments

**Amendment A (2026-07-14):** Medium step-1 never filled — reused Phase 110 standard gate. D-112-20…22 / AC-112-25 / M9.

**Amendment B (2026-07-14) — Formal Architecture Review (governance):** Official status **REJECTED**. Observed: no observable Home improvement; step-1 not filled; **no positive or negative visible result** — user cannot distinguish unsupported vs failure vs inactive feature. Blocking defects **BD-112-1…6**. Mandatory non-silent user status (**D-112-23 / AC-112-26 / M10**). Development evidence package (**D-112-24**) required before revalidation. Dependent autofill phases **blocked** until Phase 112 PASS (**D-112-25**). Changelog PLAN **5.16 / 5.17**.

## Phase Goal (acceptance bar — normative)

Supported two-step login sites must:
1. Fill the **first identity field** from the **active Digital Home profile** credentials
2. **Stop** (no Continue/Next click)
3. On any non-success medium attempt: show **ONE** explicit user status (AC-112-26) — never silent open-only

Preserve Phase 103 open-first and Phase 110 `basic` (Shufersal + Clalit).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=112`
- `team-Yuri/arch-phase112.md` — **STATUS: REJECTED**; D-112-1 … **D-112-25**; BD-112-1…6
- `team-Yuri/PLAN.md` §18 — AC-112-1 … **AC-112-26**; changelog 5.16 / 5.17
- `team-Yuri/dev-phase112.md` — must **not** claim COMPLETE / partial / infrastructure-complete
- `team-Yuri/arch-phase103.md` / `arch-phase110.md` — consume; basic unchanged

## Blocking Defects (Architect — must close)

| ID | Defect | Closes via |
|---|---|---|
| **BD-112-1** | First field in supported two-step flow not populated | **M9** / AC-112-25 |
| **BD-112-2** | No visible failure reason when completion does not run | **M10** / AC-112-26 |
| **BD-112-3** | Delivered behaviour does not demonstrate Phase 112 is active | M9 success **or** M10 explicit status |
| **BD-112-4** | No evidence active user profile is connected to attempted fill | D-112-24 evidence package |
| **BD-112-5** | No evidence the tested login page was detected | D-112-24 evidence package |
| **BD-112-6** | Unsupported vs implementation defect indistinguishable | **M10** distinct statuses |

## Architecture Bindings (M9/M10 focus)

| Decision | Binding |
|---|---|
| **D-112-20** | Dedicated identity-first path; **MUST NOT** solely call Phase 110 `runGenericAutofill` / `assessStandardLogin` |
| **D-112-21** | Success = ≥1 visible identity field filled when password absent from DOM |
| **D-112-22** | Live UAT on supported list; fixture alone insufficient |
| **D-112-23** | **No silent failure** — exactly one explicit Hebrew user status (AC-112-26 categories) |
| **D-112-24** | Revalidation **evidence package** required before Architect re-review |
| **D-112-25** | Dependent autofill / medium-complex phases **blocked** until 112 PASS |

### AC-112-26 user status categories (map Hub outcomes → one of)

1. Login form not detected  
2. First login field not detected  
3. No credentials for the selected profile  
4. Website not supported  
5. Blocked by the website  
6. System error  

Technical/diagnostic reason may live in logs only. **Never** credentials or raw stacks in UI.

### Normative medium outcome (always one of)

```text
medium attempt:
  → SUCCESS: ≥1 identity field filled → friendly “click Continue” (no auto-click)
  → FAILURE: exactly ONE AC-112-26 status (never silent open-only)
```

## Acceptance Criteria (additions)

| AC | Statement |
|---|---|
| AC-112-1 … 24 | As prior PLAN |
| **AC-112-25** | Medium email/username/id-first: fill visible identity field(s) without same-page password; no auto-submit; no auto-Continue |
| **AC-112-26** | When medium/two-step completion cannot run, user receives exactly one explicit status (categories above). Silent open-only forbidden |

## Hard Gates

### H1 — Unsafe automation still forbidden
No auto Continue, mandatory step-2 password, CAPTCHA/OTP, federated, 108 rediscovery, auto-submit, hidden fill.

### H2 — M9 live fill on **published supported list** (AC-112-25)
Every site on the phase’s **named supported websites** list must demonstrate step-1 fill in live UAT (released build, feature on, profile selected).

### H3 — M10 explicit failure UX (AC-112-26)
Map extension/Hub outcomes → Hebrew statuses; never silent; unsupported distinguishable from defect.

### H4 — D-112-24 evidence package complete before Architect

### H5 — Shufersal + Clalit basic/110 still PASS

### H6 — D-112-25 freeze
Do not start/accept dependent autofill phases until 112 revalidation PASS.

### H7 — Revalidation criteria (all required)
1. Released build + feature **on**
2. Active Digital Home profile selected
3. Supported sites: step-1 fills
4. Unsupported: explicit AC-112-26 status
5. Repeat after browser restart
6. No credential leakage in UI/logs user can see

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1–M8 | LI infra | May exist; **not** acceptance | Infra only |
| **M9** | Identity-first fill on supported list | D-112-20…22 / AC-112-25 / BD-112-1 | Live fill on **every** published supported site |
| **M10** | Explicit user statuses | D-112-23 / AC-112-26 / BD-112-2,3,6 | Failures never silent; categories mapped |
| **Evidence** | D-112-24 package | See checklist below | Attached to `dev-phase112.md` |
| Revalidation | Operator live UAT green | H7 criteria | Architect re-review gate |

## Detailed Development Plan

### M9 — Supported-list step-1 fill (BLOCKING)
1. Maintain dedicated identity-first path (D-112-20); partial success (D-112-21).
2. **Publish named supported websites** used for development/UAT in `dev-phase112.md`.
3. Live-fill step-1 on **every** site on that list (not “≥1 sample” alone for governance close — Architect acceptance bar: every supported-list site).
4. Code/fixture alone ≠ accept without recorded live evidence.

### M10 — Status mapping (BLOCKING)
1. Map every non-success medium Hub/extension outcome → exactly one AC-112-26 Hebrew status.
2. Never open-only with generic “continue manually” that does not distinguish categories.
3. Unit tests for status mapping per category.
4. Close BD-112-2, BD-112-3, BD-112-6.

### D-112-24 Evidence package (required before Architect)

Manager will **reject** Architect handoff without all items:

1. Exact PLAN ACs for Phase 112 (list AC-112-1…26 as in scope)
2. Requirement → implementation mapping
3. Files / components changed
4. Activation conditions (when medium path runs: LI class, extension, profile, credentials)
5. **Named supported websites**
6. Recorded evidence of step-1 fill (screenshots/video/notes + observation)
7. Console + extension logs of a **failed** attempt
8. Each failure classified as one of:
   - login interface not detected  
   - field not detected  
   - profile not resolved  
   - credential not available  
   - browser permission missing  
   - script not injected  
   - website security restriction  
   - unsupported login flow  
   - unhandled implementation defect  

Also prove BD-112-4 (profile→credential linkage) and BD-112-5 (login-page detection) in that package.

## Functional Test Matrix (governance)

| # | Test | Expected | Closes |
|---:|---|---|---|
| T19+ | Each supported-list site live | Step-1 identity filled from active profile | BD-112-1 / AC-112-25 |
| T30 | Medium failure (no creds) | Status: no credentials for selected profile | AC-112-26 |
| T31 | Medium failure (field missing) | Status: first field not detected | AC-112-26 |
| T32 | Unsupported site | Status: website not supported (not silent) | BD-112-6 |
| T33 | Success path shows 112 active | Observable fill (BD-112-3) | BD-112-3 |
| T34 | Restart browser; repeat | Still works / statuses correct | Revalidation |
| T13/T14 | Shufersal + Clalit | PASS | AC-112-17 |
| T35 | Evidence package | All D-112-24 items present | D-112-24 |

## Required Developer Evidence

`team-Yuri/dev-phase112.md` **must**:
- Prefer status: `REJECTED_IN_PROGRESS` / `READY_FOR_MANAGER_EVIDENCE` — **never** COMPLETE / partial / infrastructure-complete
- Document M9 + M10 + full D-112-24 package
- Include published supported website list
- Include operator live UAT results (or honest PENDING_OPERATOR until green)

## Out of Scope
- Auto Continue / mandatory step-2 password
- CAPTCHA / OTP / federated automation
- Phase 108 rediscovery / gate retunes / PayPal M16
- Claiming acceptance via infra, refactor, or fixture-only
- Starting dependent autofill phases while 112 REJECTED (D-112-25)

## Risks / Open Questions
- Silent “פתחנו את האתר…” without AC-112-26 category = instant re-reject.
- Supported list must be honest and short enough to fully UAT.
- Profile/credentials not selected → must be explicit status (3), not silent.

## Manager Review
MANAGER_REVIEW_STATUS: REJECTED

### Review Notes
- Architect official status: **REJECTED** (governance review).
- BD-112-1…6 open until M9 + M10 + evidence package + operator live UAT green.
- Do **not** claim COMPLETE / partial / infrastructure-complete.
- Dependent autofill phases **blocked** (D-112-25).
- Return to Architect **only** with D-112-24 package + revalidation H7 green.

### Required Corrections
1. M9: live step-1 fill on every published supported-list site (AC-112-25 / D-112-20…22).
2. M10: map outcomes → AC-112-26 Hebrew statuses; never silent (D-112-23).
3. Collect full D-112-24 evidence package (incl. BD-112-4/5).
4. Revalidation: released build, feature on, profile selected, fill + explicit unsupported status, restart, no credential leakage.
5. Update `dev-phase112.md` accordingly — no COMPLETE claims.
6. Hand off to Architect only when evidence + operator UAT green.
