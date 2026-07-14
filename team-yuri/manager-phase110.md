# Manager Phase 110

## Phase Identifier
PHASE=110

## Status
STATUS: READY_FOR_DEVELOPER

## Phase Goal
Expand **generic autofill** from validated examples (Shufersal / Clalit) to **all standard single-page login forms** across catalog, custom, and admin-managed services — using the **Phase 103 unified execution pipeline**, deterministic field matching, and open-first progressive enhancement — **without** auto-submit, hidden/unrelated fills, service-specific branching outside approved adapters, AI/probabilistic guessing, or Phase 112 complex-login work.

Phase 110 owns **standard-form autofill coverage and conservative field matching** inside the existing generic engine. It does **not** redesign `executeServiceFromTile`, discover `loginUrl`, own auth/hydrate, classify complex logins, or canonicalize URLs.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=110`
- `team-Yuri/arch-phase110.md` — STATUS: READY_FOR_MANAGER (D-110-1 … D-110-13; M1–M8 handoff)
- `team-Yuri/PLAN.md` §18 — Phase 110 (AC-110-1 … AC-110-15); §7 Unified Service Execution
- `team-Yuri/arch-phase103.md` — APPROVED baseline: `executeServiceFromTile`, open-first, metadata-driven generic autofill (**do not redesign**)
- `team-Yuri/arch-phase108.md` — `loginUrl` discovery / metadata (**consume only**)
- `team-Yuri/arch-phase109.md` — credentials / session (**consume only**)
- `src/execution/serviceExecution.ts` — unified pipeline (minimal touch only)
- `src/execution/genericAutofill.ts` / `autofillEligibility.ts`
- `extension/generic/*` — form detect, field mapper, fill executor
- `extension/background.js` — `POC_GENERIC_FILL` / detect path
- Validated regression anchors: Shufersal, Clalit

## Parallel-track note — Phase 108 / 109
Phase **108 M11** (live discovery) and Phase **109** (auth / hydrate) may still be open in parallel.

- Phase 110 **must not own** discovery fixes, auth, vault namespaces, or cloud hydrate.
- Phase 110 **consumes** `loginUrl` + credentials **when present** (from 108 / 107 / 109).
- Missing `loginUrl` → open `primaryUrl` only; fill may be skipped (discovery remains Phase 108).
- Missing credentials → open site; no fill; friendly/non-blocking signal allowed.

## Architecture Summary (Phase 110 constraints)

| Decision | Requirement |
|---|---|
| **D-110-1** | Coverage is **origin-independent** — catalog / custom / admin share the same engine when eligible (not service-id allowlist). |
| **D-110-2** | Prefer explicit registry `loginFields` + vault credentials mapped by field id (`POC_GENERIC_FILL`). |
| **D-110-3** | Secondary DOM assist is **deterministic** HTML heuristics only; low confidence → **do not fill**. |
| **D-110-4** | Fill only when **standard login** gate passes (single page; identity + password; no iframe/modal/OTP/CAPTCHA/multi-step). |
| **D-110-5** | **Preserve Phase 103** orchestration; site adapters remain exclusive when `adapterId` is site-specific. |
| **D-110-6** | **Open-first**; never auto-submit; never hidden fill; failure leaves tab open. |
| **D-110-7** | Attempt fill when: extension available; `loginUrl` (or login entry) present; credentials complete; standard gate passes. |
| **D-110-8** | No Shufersal/Clalit (or other) special cases in the **generic** engine. |
| **D-110-9** | Shufersal + Clalit regression **PASS** (mandatory UAT). |
| **D-110-10** | Leave hooks/signals for Phase 112 (`fill_failed` / `not_standard`); do not invent 112 classification. |
| **D-110-11** | Optional metadata **proposal** only — never silent overwrite of admin `loginFields` / `loginUrlSource=admin`. |
| **D-110-12** | Document extension host permissions / packaging in `docs/MIGRATION_PHASE_110.md`. |
| **D-110-13** | No Phase 113 URL identity / canonicalization work. |

### Normative fill path (generic)

```text
executeServiceFromTile (Phase 103 — unchanged orchestration)
  → openUrl = loginUrl ?? primaryUrl
  → site-specific adapter? → adapter path (unchanged)
  → else:
       open tab (extension or window.open fallback)
       if shouldAttemptGenericAutofill (loginFields + credentials)
          AND standard-login gate on page
          → map fields (registry loginFields + deterministic DOM match)
          → fill visible mapped fields only
          → NEVER submit
       else → leave tab open; optional friendly / health signal
```

### Standard-login checklist (normative)

| Must be true | Else |
|---|---|
| Visible identity field + visible password on same page | No fill |
| Mapped targets are visible (not hidden / aria-hidden traps) | No fill for that field |
| Confidence deterministic (id/name/autocomplete/label/type) | No fill if ambiguous |
| Not requiring iframe/modal/OTP/CAPTCHA to complete login | Open only; out of Phase 110 scope |

## Acceptance Criteria (AC-110-1 … AC-110-15)

| AC | Statement |
|---|---|
| AC-110-1 | Generic autofill is no longer limited to Shufersal and Clalit |
| AC-110-2 | Standard login forms can be autofilled for catalog services when metadata and credentials exist |
| AC-110-3 | Standard login forms can be autofilled for custom services when metadata and credentials exist |
| AC-110-4 | Standard login forms can be autofilled for admin-managed services when metadata and credentials exist |
| AC-110-5 | Username/email/id and password fields are handled through the same generic autofill engine |
| AC-110-6 | Autofill never auto-submits the login form |
| AC-110-7 | Autofill never writes into hidden or unrelated fields |
| AC-110-8 | If autofill cannot run safely, the website remains open |
| AC-110-9 | Autofill failure produces a friendly non-blocking indication or integration health signal |
| AC-110-10 | Shufersal and Clalit validated autofill behavior remains preserved |
| AC-110-11 | No service-specific branching is introduced outside approved adapters |
| AC-110-12 | Phase 110 does not modify Service Identity or URL canonicalization rules |
| AC-110-13 | Build passes |
| AC-110-14 | Generic autofill uses deterministic matching rules and never relies on AI, probabilistic guessing or service-specific heuristics |
| AC-110-15 | Phase 110 remains fully compatible with the advanced authentication architecture introduced by Phase 112 |

## AC → Milestone → Verify / UAT Mapping

| AC | Primary milestone(s) | Static / CLI verify | Manual UAT |
|---|---|---|---|
| AC-110-1 | M1, M4, M8 | `verifyPhase110StandardAutofill.mjs` — no Shufersal/Clalit-only allowlist in generic path | ≥1 non-anchor standard service fills |
| AC-110-2 | M4, M8 | Eligibility origin-independent (catalog fixture/assert) | Catalog service with `loginUrl` + credentials → fill, no submit |
| AC-110-3 | M4, M8 | Same engine for custom metadata | Custom service with `loginUrl` + credentials → fill |
| AC-110-4 | M4, M8 | Same engine for admin-managed metadata | Admin-managed service with `loginUrl` + credentials → fill |
| AC-110-5 | M2, M3 | Single mapper/executor for identity + password | Both field types filled via generic path |
| AC-110-6 | M3, M8 | **Hard gate:** no `form.submit()` / click-submit automation in fill executor | User must click submit manually |
| AC-110-7 | M3, M8 | **Hard gate:** visible-only fill; no hidden writes | Hidden/unrelated fields unchanged |
| AC-110-8 | M3, M5 | Open-first path preserved (`verifyPhase103Execution.mjs`) | Fill fail / non-standard → tab stays open |
| AC-110-9 | M5 | Health/friendly signal codes non-sensitive | Failure shows non-blocking indication / health |
| AC-110-10 | M8 | `verifyPhase103Execution.mjs` PASS | **Shufersal + Clalit UAT PASS** |
| AC-110-11 | M1, M8 | **Hard gate:** no service-id/host branches in generic engine | Adapters only for approved site-specific paths |
| AC-110-12 | M8 | No Phase 113 / canonicalization edits in verify scope | Affirmation — no identity rule changes |
| AC-110-13 | M8 | `npm run build` PASS | — |
| AC-110-14 | M2, M8 | **Hard gate:** no AI/ML/probabilistic APIs; deterministic rules only | Ambiguous page → no unsafe fill |
| AC-110-15 | M5, M6, M8 | Signals compatible (`fill_failed` / `not_standard`); no 112 classifiers invented | Non-standard page opens without unsafe fill |

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal | Primary ACs |
|---:|---|---|---|---|
| **M1** | Audit generic engine + remove residual allowlists | Inventory Hub + extension generic path; remove any service-id / host allowlist gating fill eligibility | Generic path not limited to Shufersal/Clalit | AC-110-1, AC-110-11 |
| **M2** | Deterministic field-mapper + standard-login gate | Harden `field-mapper` + form detect: visible identity+password; id/name/autocomplete/label/type; low confidence → no fill | Standard gate documented + enforced | AC-110-5, AC-110-14 |
| **M3** | Fill executor: visible-only, no submit, no hidden | `fill-executor` writes visible mapped fields only; never submit; never hidden/unrelated | Static asserts + UAT | AC-110-6, AC-110-7, AC-110-8 |
| **M4** | Origin-independent eligibility proof | Catalog / custom / admin share eligibility when `loginFields` + credentials + standard gate | Fixtures and/or UAT for all three origins | AC-110-2, AC-110-3, AC-110-4 |
| **M5** | Friendly failure / health signal | Non-blocking indication or `metadataHealth` / codes (`fill_failed`, `not_standard`); no stack traces to users | Failure UX observable | AC-110-8, AC-110-9, AC-110-15 |
| **M6** | Optional metadata proposal path | If detect finds stable mapping: **propose** enrichment only; never silent overwrite of admin metadata. If deferred: explicit deferral in `dev-phase110.md` + migration doc | Proposal path or explicit defer | AC-110-15, D-110-11 |
| **M7** | Extension permission / packaging docs | `docs/MIGRATION_PHASE_110.md`: host permission implications for arbitrary catalog origins; align with Phase 108 packaging | Doc complete | D-110-12, AC-110-1 |
| **M8** | Verify scripts + regression + build | New `scripts/verifyPhase110StandardAutofill.mjs`; `verifyPhase103Execution.mjs` PASS; Shufersal/Clalit UAT PASS; build PASS; coverage matrix in migration doc | All gates green | AC-110-1…15, esp. AC-110-10, AC-110-13 |

## Hard Gates (Manager approval blockers)

### H1 — No auto-submit (AC-110-6)
Fill executor must **never** call `form.submit()`, synthetic submit-button click for login completion, or equivalent automation. User submits manually.

### H2 — No hidden / unrelated fill (AC-110-7)
Only **visible**, mapped login fields. No hidden, `aria-hidden` off-screen traps, or unrelated inputs.

### H3 — Open-first (AC-110-8)
Site/tab always opens when tile is clicked. Autofill failure must not close the tab or block navigation. Phase 103 open-first contract preserved.

### H4 — No AI / probabilistic guessing (AC-110-14)
No AI, ML, visual recognition, adaptive learning, or low-confidence guessing. Deterministic HTML rules only; ambiguous → **do not fill**.

### H5 — No service-specific generic branching (AC-110-11)
Generic engine must not special-case Shufersal, Clalit, or other service ids/hosts. Approved **adapters** only for non-generic paths. No per-site JS in the generic fill path.

### H6 — Phase 103 pipeline unchanged (AC-110-11)
Do **not** redesign `executeServiceFromTile` orchestration. Minimal touch only if a one-line health signal requires it — prefer extension-side safety.

### H7 — Shufersal + Clalit regression (AC-110-10)
`node scripts/verifyPhase103Execution.mjs` PASS **and** live/manual Shufersal + Clalit autofill UAT PASS after coverage expansion.

### H8 — Verify + docs + build
- `node scripts/verifyPhase110StandardAutofill.mjs` PASS
- `docs/MIGRATION_PHASE_110.md` includes **coverage matrix** + **extension permission notes**
- `npm run build` PASS

**Manager will not approve Phase 110 without H1–H8 evidence in `team-Yuri/dev-phase110.md`.**

## Detailed Development Plan

### M1 — Audit + remove residual allowlists
- Audit `autofillEligibility.ts`, `genericAutofill.ts`, `extension/generic/*`, `background.js`.
- Remove residual allowlists / host gates that limit generic fill to Shufersal/Clalit.
- Document current message envelope (`POC_GENERIC_FILL`, optional `POC_GENERIC_DETECT`) — do not invent a second protocol family.

### M2 — Field mapper + standard-login gate
- Prefer registry `loginFields`; secondary deterministic DOM match only when safe.
- Enforce standard-login checklist (same page; visible identity + password; no iframe/modal/OTP/CAPTCHA requirement).
- Low confidence → skip fill (open-only).

### M3 — Fill executor safety
- Visible mapped fields only.
- Never submit.
- Never write hidden/unrelated fields.
- Preserve open-first on any fill error.

### M4 — Origin-independent coverage
Prove fill eligibility for:
1. Catalog (built-in) service with metadata + credentials
2. Custom (`source_type=user`) with `loginUrl` + credentials
3. Admin-managed with `loginUrl` + credentials

Same generic engine for all three (AC-110-2…4).

### M5 — Friendly failure / health
- Non-blocking UI indication and/or integration health signal.
- Codes must be non-sensitive (e.g. `fill_failed`, `not_standard_login`).
- No engine stack traces / credential dumps to users or logs.

### M6 — Metadata proposal (or explicit defer)
- If in scope: propose registry enrichment for stable discovered mappings; **never** silent overwrite when `loginUrlSource=admin` / curated admin `loginFields`.
- If deferred: state explicitly in developer evidence + migration doc (still AC-compatible via D-110-11 optional).

### M7 — `docs/MIGRATION_PHASE_110.md`
Must include at minimum:
- **Coverage matrix** — which service origins / metadata conditions get fill vs open-only
- **Extension permission notes** — host access implications for arbitrary https catalog targets; store/operator packaging alignment with Phase 108
- Failure UX / health signals
- Shufersal / Clalit regression notes
- Parallel-track note: consumes `loginUrl` + credentials when present; does not own 108/109

### M8 — Verify + regression + build
**New script** `scripts/verifyPhase110StandardAutofill.mjs` must statically prove (as applicable):
- No Shufersal/Clalit-only allowlist in generic eligibility/fill path
- No auto-submit in fill executor
- No AI / probabilistic APIs in generic path
- Phase 103 `executeServiceFromTile` entry / open-first contract preserved
- No service-id branching in generic mapper/executor (adapters excluded)

**Regression:**
- `node scripts/verifyPhase103Execution.mjs` PASS
- Manual UAT: Shufersal PASS; Clalit PASS
- At least one additional standard service (catalog and/or custom and/or admin) fills without submit
- Known non-standard page: opens without unsafe fill
- `npm run build` PASS

## Functional Test Matrix

| # | Test | Expected | AC |
|---:|---|---|---|
| T1 | Catalog + loginUrl + credentials + standard form | Identity + password filled; no auto-submit | AC-110-2, AC-110-5, AC-110-6 |
| T2 | Custom + loginUrl + credentials + standard form | Same generic fill | AC-110-3 |
| T3 | Admin-managed + loginUrl + credentials + standard form | Same generic fill | AC-110-4 |
| T4 | Non-anchor service (not Shufersal/Clalit) | Fill works when eligible | AC-110-1 |
| T5 | Ambiguous / non-standard page | Open only; no unsafe fill | AC-110-8, AC-110-14 |
| T6 | Fill failure / missing credentials | Tab remains open; friendly/health signal | AC-110-8, AC-110-9 |
| T7 | Hidden fields present on page | Not written | AC-110-7 |
| T8 | Shufersal tile open | Validated autofill preserved | AC-110-10 |
| T9 | Clalit tile open | Validated autofill preserved | AC-110-10 |
| T10 | Generic path has no service-id special cases | Static verify PASS | AC-110-11, AC-110-14 |
| T11 | No Phase 113 / identity edits | Affirmation | AC-110-12 |
| T12 | `verifyPhase110StandardAutofill.mjs` | PASS | — |
| T13 | `verifyPhase103Execution.mjs` | PASS | AC-110-10, AC-110-11 |
| T14 | `npm run build` | PASS | AC-110-13 |
| T15 | Non-standard signals leave room for Phase 112 | `not_standard` / open-only; no 112 classifiers invented | AC-110-15 |

**Critical hard-gate tests:** T5–T10, T12–T14 (esp. no submit, no hidden, open-first, no AI, no generic service branching, Shufersal/Clalit).

## Required Developer Evidence
`team-Yuri/dev-phase110.md` must include:

| Evidence area | Required content |
|---|---|
| Implementation summary | What changed in Hub + extension generic path |
| Files changed | List |
| M1 allowlist removal | Proof generic path is not Shufersal/Clalit-only |
| M2–M3 mapper/executor | Deterministic rules; visible-only; no submit |
| M4 origin coverage | Catalog + custom + admin evidence (UAT and/or fixtures) |
| M5 failure UX | Friendly / health signal observations |
| M6 proposal or defer | Explicit |
| M7 docs | `docs/MIGRATION_PHASE_110.md` — coverage matrix + permission notes |
| M8 verify | `verifyPhase110StandardAutofill.mjs` PASS output |
| Phase 103 regression | `verifyPhase103Execution.mjs` PASS |
| Shufersal / Clalit UAT | Explicit Pass |
| Expanded coverage UAT | ≥1 non-anchor standard fill Pass |
| Build | `npm run build` PASS |
| Scope affirmation | No 112 complex login; no 108 discovery; no 109 auth; no 113 canonicalization; no Phase 103 redesign |

## Out of Scope
- Multi-step / OTP / CAPTCHA / iframe / modal-popup login automation (**Phase 112**)
- Login complexity classification (`basic` / `medium` / `complex`) — Phase 112
- Federated login automation — Phase 112
- `loginUrl` discovery / rediscovery (**Phase 108**)
- Account auth / vault / hydrate (**Phase 109**)
- URL canonicalization / service identity (**Phase 113**)
- Icon pipeline (Phase 111)
- Password rotation / credential lifecycle UX
- Redesigning `executeServiceFromTile` orchestration (Phase 103)
- Bank/complex adapters beyond existing approved adapter architecture
- Silent overwrite of admin-curated `loginFields` / `loginUrl`
- AI / ML / visual / adaptive field detection

## Risks / Open Questions
- Extension host permissions may limit fill on arbitrary catalog origins until packaging aligns (document in M7; coordinate with Phase 108).
- Parallel 108/109 gaps: services without `loginUrl` or credentials will open-only — expected, not a Phase 110 defect.
- Over-aggressive DOM heuristics risk wrong-field fill — prefer no-fill on low confidence (H4).
- Accidental Phase 103 orchestration edits — reject if pipeline redesigned.
- M6 metadata proposal may be deferred; must not block H1–H5 / H7–H8 if explicitly deferred.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
- Manager plan authored from `arch-phase110.md` + PLAN AC-110-1…15.
- STATUS: **READY_FOR_DEVELOPER** — hand off to Sarah.
- Approval of phase completion awaits `dev-phase110.md` evidence against H1–H8.

### Required Corrections
_None at planning. Developer must satisfy hard gates and evidence table above._
