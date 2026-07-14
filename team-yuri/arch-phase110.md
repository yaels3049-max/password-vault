# Architecture Phase 110

## Phase Identifier
PHASE=110

## Status
STATUS: READY_FOR_MANAGER

## Phase Goal
Expand **generic autofill** from validated examples (Shufersal / Clalit) to **all standard single-page login forms** across catalog, custom, and admin-managed services — using the **Phase 103 unified execution pipeline**, deterministic field matching, and open-first progressive enhancement — **without** auto-submit, service-specific branching (outside approved adapters), AI/probabilistic guessing, or Phase 112 complex-login intelligence.

Phase 110 owns **standard-form autofill coverage and conservative field matching** inside the existing generic engine. It does not own execution orchestration redesign (103), loginUrl discovery (108), account/auth (109), complex login classification (112), or URL canonicalization (113).

## Source References
- `team-Yuri/PHASE.md` — `PHASE=110`
- `team-Yuri/PLAN.md` §7 — Unified Service Execution; §18 — Phase 110 (AC-110-1 … AC-110-15)
- `team-Yuri/arch-phase103.md` — APPROVED baseline: `executeServiceFromTile`, open-first, metadata-driven generic autofill
- `team-Yuri/arch-phase108.md` — `loginUrl` discovery / metadata (consume; do not redesign)
- `team-Yuri/arch-phase109.md` — credentials / session (consume; do not redesign)
- `src/execution/serviceExecution.ts` — unified pipeline
- `src/execution/genericAutofill.ts` / `autofillEligibility.ts` — Hub generic fill gate
- `extension/generic/*` — form detect, field mapper, fill executor
- `extension/background.js` — `POC_GENERIC_FILL` / detect path
- Validated references: Shufersal, Clalit (regression anchors)

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-110-1: Coverage is origin-independent** | AC-110-1…4, AC-110-11 | Generic autofill eligibility depends on **metadata + credentials + standard-form safety**, not on service id, allowlist, or `source_type`. Catalog, custom, and admin-managed services share the same engine when eligible. |
| **D-110-2: Prefer explicit `loginFields`** | PLAN metadata rules; AC-110-5, AC-110-14 | Primary path: registry/service `loginFields` + vault credentials mapped by field id. Hub continues `POC_GENERIC_FILL` with `{ url, loginFields, credentials }`. |
| **D-110-3: Conservative DOM assist (secondary)** | PLAN “safely detectable”; AC-110-14 | When `loginFields` exist but page mapping is ambiguous, or when a **documented** secondary detect path is used: apply **deterministic** HTML heuristics only (visible inputs; type/name/id/autocomplete/label; one password + one identity field on same page). **Never** AI, ML, visual recognition, or adaptive learning. Low confidence → **do not fill**. |
| **D-110-4: Standard-login gate** | PLAN standard definition | Autofill may run only when the page is treated as a **standard login**: single visible page; username/email/id + password; optional visible submit; no required iframe/modal/OTP/CAPTCHA/multi-step. If not standard → open site only; optional non-blocking health signal (Phase 112 may classify later). |
| **D-110-5: Preserve Phase 103 pipeline** | AC-110-11, regression | **Do not** redesign `executeServiceFromTile` orchestration. Site adapters (`htzone`, `practice`, …) remain exclusive when `adapterId` is site-specific. Generic path remains default for others. |
| **D-110-6: Open-first, never block** | AC-110-6…9 | No auto-submit. No fill of hidden/unrelated fields. Autofill failure must leave tab open. Friendly non-blocking indication / `metadataHealth` signal allowed; no engine stack traces to users. |
| **D-110-7: Prerequisites for fill attempt** | PLAN execution rules | Attempt generic autofill when: extension available; `loginUrl` (or resolved open target that is the login entry) present; credentials complete for configured fields; standard-form gate passes. Missing `loginUrl` → open `primaryUrl` only (discovery remains Phase 108). |
| **D-110-8: No service-specific heuristics** | AC-110-11, AC-110-14 | No Shufersal/Clalit special cases in the generic engine. No per-site JS. Approved adapters only for non-generic paths. |
| **D-110-9: Shufersal / Clalit regression** | AC-110-10 | Existing validated fill behavior must remain PASS after coverage expansion. Treat as mandatory UAT anchors. |
| **D-110-10: Phase 112 compatibility** | AC-110-15 | Do not invent login-complexity classification, modal open/fill, OTP/CAPTCHA handling, or federated automation. Leave hooks/signals that 112 can consume (e.g. fill failed / not_standard). |
| **D-110-11: Optional metadata proposal** | PLAN governance | If detect discovers stable field mapping, may **propose** registry enrichment — must not silently overwrite admin `loginFields` / `loginUrlSource=admin` without explicit approval. Prefer admin/user review path over silent write. |
| **D-110-12: Host permissions / packaging** | AC-110-1; Phase 108 | Generic fill for arbitrary catalog URLs requires extension ability to inject on those origins. Document operator/store implication in `docs/MIGRATION_PHASE_110.md` (align with Phase 108 packaging). Do not invent a second Hub↔extension protocol; extend existing `POC_GENERIC_FILL` / detect messages if needed. |
| **D-110-13: No Phase 113 work** | AC-110-12 | No URL identity/canonicalization changes. |

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
| Mapped targets are visible, not hidden/aria-hidden off-screen traps | No fill for that field |
| Confidence deterministic (id/name/autocomplete/label/type rules) | No fill if ambiguous |
| Not requiring iframe/modal/OTP/CAPTCHA to complete login | Classify as out-of-scope; open only |

## Constraints / Non-Negotiables
- No auto-submit (AC-110-6).
- No hidden / unrelated field writes (AC-110-7).
- Site always opens even when fill fails (AC-110-8).
- No AI / probabilistic guessing / service-specific generic heuristics (AC-110-14).
- No change to Phase 103 orchestration contract (AC-110-11).
- No Phase 112 / 113 scope creep (AC-110-12, AC-110-15).
- Shufersal + Clalit regression PASS (AC-110-10).
- Build passes (AC-110-13).
- Credentials never logged; no plaintext in registry.

## Technical Boundaries / Out of Scope
- Multi-step, OTP, CAPTCHA, iframe, modal/popup login automation (Phase 112).
- Bank/complex adapters beyond existing approved adapter architecture.
- loginUrl discovery / rediscovery (Phase 108).
- Account auth / hydrate / vault (Phase 109).
- URL canonicalization / identity (Phase 113).
- Icon pipeline (Phase 111).
- Password rotation / credential lifecycle UX.

## Dependencies and Interfaces

### Upstream

| Phase | Provides |
|-------|----------|
| 103 | Unified `executeServiceFromTile` |
| 108 | `loginUrl` + discovery metadata when available |
| 104–109 | Credentials, Digital Home tile open, Access Profiles |
| 107 | Admin-managed services with `loginFields` |

### Target modules (Developer)

| Module | Responsibility |
|--------|----------------|
| `extension/generic/field-mapper.js` | Strengthen deterministic mapping; no service-id branches |
| `extension/generic/form-detector.js` / `login-form-detect.js` | Standard-login gate; visible-field rules |
| `extension/generic/fill-executor.js` | Fill only; never submit; never hidden |
| `extension/generic/generic-autofill.js` | Orchestrate detect→map→fill for `POC_GENERIC_FILL` |
| `extension/background.js` | Generic fill/detect for arbitrary https targets (permission model documented) |
| `src/execution/autofillEligibility.ts` | Eligibility remains metadata-driven; optional standard-form precondition if signaled from extension |
| `src/execution/genericAutofill.ts` | Hub message payload; friendly failure surfacing hook |
| `src/execution/serviceExecution.ts` | **Minimal** touch — only if needed for health signal; no pipeline redesign |
| `scripts/verifyPhase110StandardAutofill.mjs` | Static: no allowlist, no auto-submit, no AI, Phase 103 entry preserved |
| `docs/MIGRATION_PHASE_110.md` | Coverage matrix, permission notes, Shufersal/Clalit UAT, failure UX |

### Extension ↔ Hub (unchanged envelope)

| Message | Role |
|---------|------|
| `POC_GENERIC_FILL` | Open + fill using loginFields/credentials |
| Optional detect companion | Already present (`POC_GENERIC_DETECT`) — may be used for standard-gate; no new protocol family required |

## Data / State Considerations
- Prefer existing `loginFields` in registry; do not invent DEFAULT fields that overwrite curated metadata.
- Optional proposed mappings → admin/review path; never silent overwrite of `loginUrlSource=admin`.
- Integration health / fill failure signals: non-sensitive codes only (e.g. `fill_failed`, `not_standard_login`).

## Security / Privacy Considerations
- Fill only on user-initiated tile open.
- No credential logging; no DOM dumps in production errors.
- Extension host access expansion must be justified for store policy (document; coordinate with Phase 108 packaging docs).
- Do not bypass browser password-manager boundaries beyond existing Phase 106 Hub editor rules (tile fill is extension-owned).

## Testing and Lint Expectations
- `npm run build` PASS (AC-110-13).
- `node scripts/verifyPhase110StandardAutofill.mjs` PASS.
- `node scripts/verifyPhase103Execution.mjs` PASS (mandatory regression).
- Manual: catalog + custom + admin service with `loginUrl` + credentials → fill without submit; failure leaves tab open; Shufersal + Clalit PASS; a known non-standard page opens without unsafe fill.

## Functional Testability

- **User flow:** Digital Home tile → site opens → identity + password filled when standard → user submits manually.
- **Negative:** Missing credentials / non-standard form → site open, no crash, friendly/non-blocking signal.
- **CLI:** verify scripts above.
- **Observable:** No allowlist of only Shufersal/Clalit in generic path; no `form.submit()` / click-submit automation in fill executor.

## Handoff Notes for Manager

1. Publish AC-110-1 … AC-110-15 with milestones.
2. Suggested milestones:
   - **M1** Audit current generic engine + remove any residual id/host allowlist gating for fill
   - **M2** Deterministic field-mapper + standard-login gate hardening
   - **M3** Fill executor: visible-only, no submit, no hidden
   - **M4** Origin-independent eligibility proof (catalog / custom / admin fixtures or UAT)
   - **M5** Friendly failure / health signal (non-blocking)
   - **M6** Optional metadata proposal path (if in scope for this phase; else explicitly defer)
   - **M7** Extension permission / packaging notes in `docs/MIGRATION_PHASE_110.md`
   - **M8** `verifyPhase110StandardAutofill.mjs` + Phase 103 regression + Shufersal/Clalit UAT + build
3. **Do not** change Phase 103 orchestration unless a one-line health signal requires it — prefer extension-side safety.
4. Coordinate host permissions with Phase 108 packaging reality.
5. Phase 109 hydrate / Phase 108 M11 are parallel tracks — 110 must not own them; needs credentials + loginUrl when available.
6. Developer evidence: coverage matrix beyond Shufersal/Clalit; regression anchors PASS.

## Architect Review
ARCHITECT_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
_Pending Manager plan, Developer implementation, and Shufersal/Clalit + expanded coverage evidence._

### Required Corrections
_None at architecture authoring._
