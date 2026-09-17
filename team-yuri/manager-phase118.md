# Manager Phase 118

## Phase Identifier
PHASE=118

## Status
STATUS: READY_FOR_DEVELOPER

**OPERATOR_APPROVAL: APPROVED** (2026-09-16) — Operator authorized Phase 118 START DEVELOPMENT against APPROVED `arch-phase118.md` and PLAN.md Phase 118. This Manager Detailed Design is the binding implementation plan.

Proceed per approved `arch-phase118.md` and this plan. All STOP conditions and Security gates remain binding.

**AI provider gate:** Development and automated verification MUST use the provider-neutral `MappingLlmProvider` boundary with a **mock provider**. Do **not** hard-wire a production AI provider. When a real provider/account is required for end-to-end Agent validation, **STOP** and return to Operator/Architecture with the seven-item provider gate report defined in this plan. Do **not** ask the Operator for API credentials before that gate.

At completion: Developer returns full Phase 118 Implementation / Verification Report for Architecture review.

Architecture contract: `team-Yuri/arch-phase118.md` — **STATUS: APPROVED** (2026-09-16).

## Phase Goal
Deliver an **AI-assisted authoring agent** for **Global Admin** that proposes Phase 117 Managed Autofill `field.id` → CSS locator mappings from:

1. existing credential schema (`login_fields`);
2. explicit Login Entry (`login_url`);
3. extension-collected **SafePageStructure** (no values/cookies/secrets).

**Phase 118 implements ONLY:**

- `InspectionCapability: single_page_top`
- `AgentTask: propose_field_mappings`

The agent pre-fills **HIGH** proposals into Admin editor state only; never saves; never sets `validated`; never changes `supportState`; never receives stored credentials; never participates in user Autofill. Phase 117 Managed Autofill runtime remains deterministic and unchanged.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=118`
- `team-Yuri/arch-phase118.md` — **APPROVED**; D-118-1 … D-118-14; AC-118-1 … AC-118-26
- `team-Yuri/PLAN.md` §18 — Phase 118; changelog **5.52**
- `team-Yuri/arch-phase117.md` — Managed Autofill profile model (UNCHANGED)
- Credential schema: `arch-phase102.md`, `arch-phase107.md`
- Explicit Login Entry: `arch-phase108.md`
- Admin editor: `src/admin/AutofillProfileEditor.tsx`, `src/autofill/validatedProfile.ts`
- Extension: `extension/background.js` (new Admin inspect message; distinct from `HUB_MANAGED_AUTOFILL`)

## Architecture Summary (binding decisions)

| Decision | Manager binding |
|---|---|
| **D-118-1** | Authoring-only; no LLM on Managed / Digital Home Autofill path |
| **D-118-2** | Global Admin only (MVP) |
| **D-118-3** | Explicit Login Entry only; no Login Discovery |
| **D-118-4** | Extension-owned SafePageStructure inspect |
| **D-118-5** | Top-document only (`frameIds: [0]`) |
| **D-118-6** | Provider-neutral Agent Service; **no provider selected** |
| **D-118-7** | Three-layer confidence: semantic → safety validation → prefill |
| **D-118-8** | Semantic HIGH without mandatory lexical match |
| **D-118-9** | Locator ⊆ extension candidates; invented inputId/locator rejected |
| **D-118-10** | Human Save / Phase 117 validation authority only |
| **D-118-11** | Only `single_page_top` + `propose_field_mappings` |
| **D-118-12** | No Rivhit / service-specific vocabulary |
| **D-118-13** | Security/privacy provider data-handling review before production Admin Analyze |
| **D-118-14** | Empty-input pre-provider fail-closed: `page.inputs.length === 0` → no MappingLlmProvider/OpenAI call |

### Normative confidence (implement exactly)

1. **Model semantic assessment** — propose `fieldId → observedInputId` + candidate locator + evidence; `modelConfidence` never drives prefill alone.
2. **Deterministic safety validation** — schema join; observedInputId exists; locator in candidates; visible/editable; no conflict dual-assign; response schema OK.
3. **Prefill eligibility** — final `high` only after (1)+(2) and non-ambiguous; medium/low/unknown → empty editor fields.
4. Lexical signals may strengthen; **must not** be mandatory for HIGH.
5. No hard-coded `osek` / Rivhit / hostname allowlists.

### Hard caps (Manager normative)

| Cap | Value |
|---|---|
| Max inputs in SafePageStructure | 40 |
| Max string length (labels/placeholder/nearby) | 120 chars |
| Max locator candidates per input | 8 |
| Max total JSON payload (approx) | 64 KiB |
| Agent wall-clock timeout | 45s |
| Inspect tab load timeout | 60s |

On truncate: set `limits.truncated=true`; allow `partial`; never invent missing inputs.

### Hebrew Admin UX (binding copy)

| State | Copy |
|---|---|
| Analyze CTA | «נתח דף כניסה» |
| Analyzing | «מנתח דף כניסה...» |
| Field not confidently mapped | «לא מופה בביטחון» |
| Analyze failed (generic) | «לא ניתן לנתח את דף הכניסה כרגע. נסו שוב.» |
| Prerequisite missing schema | «יש להגדיר שדות הזדהות לפני ניתוח.» |
| Prerequisite missing Login Entry | «יש להגדיר כתובת כניסה לפני ניתוח.» |

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| M1 | Contracts | `SafePageStructure`, proposal types, `MappingLlmProvider`, capability/task enums (`single_page_top`, `propose_field_mappings` only) | Types + parse/validate unit coverage |
| M2 | Extension inspect | Admin-only message: open Login Entry, origin bind, top-doc extract, no values | Fixture HTML → structure; redaction asserts |
| M3 | Safety + confidence | Deterministic validator + prefill eligibility (mock model output in / out) | AC-118-7…8, 17–25 automated |
| M4 | Agent façade | Hub/admin-callable propose path using **mock** provider; admin AuthZ | Mock E2E; no vendor SDK |
| M5 | Admin UX | Analyze button, analyzing state, HIGH prefill, empty uncertain, no auto-save | Manual + static UI asserts |
| M6 | Phase 117 boundary | Managed runtime / fill path unchanged; no agent imports on execution | Static grep + Phase 117 regression script |
| M7 | Verification pack | `scripts/verifyPhase118AssistedMapping.mjs` + `dev-phase118.md` | All AC mapped PASS; STOP if real provider needed |
| M8 | Empty-input pre-provider gate | Hub Agent short-circuit + Edge guard (D-118-14 / AC-118-26); synthetic provider count = 0; non-empty + Phase 117 regression | AC-118-26 PASS; Case C still not authorized |

## Detailed Development Plan

### M1 — Contracts (`src/assistedMapping/` or equivalent)

- Define TypeScript types matching arch contracts.
- Export `INSPECTION_CAPABILITY = 'single_page_top'`, `AGENT_TASK = 'propose_field_mappings'`.
- `MappingLlmProvider` interface + `MockMappingLlmProvider` (scripted fixtures for semantic non-lexical, lexical, conflict, ambiguous, invented id/locator).
- **Do not** add OpenAI/Anthropic/Azure client packages.

### M2 — Extension inspection

- New external/Hub message e.g. `ADMIN_LOGIN_PAGE_INSPECT` (name may vary; must be Admin-authoring scoped).
- Payload in: `{ loginEntryUrl, allowedOrigin, requestId }` — **no credentials**.
- Open/navigate tab to Login Entry; wait URL/origin match; inject top-frame inspect only.
- Build locator candidates (`#id`, `[name=…]`, autocomplete/aria when stable); never read `.value`.
- Return `SafePageStructure` or structured error (`origin_mismatch`, `tab_load_timeout`, …).

### M3 — Safety validation + confidence

Pure functions (Hub and/or shared module used by Agent façade):

- Validate raw model proposals against schema + page.
- Reject invented inputId/locator; demote/reject conflicts; ambiguity → not HIGH.
- Assign final `confidence`; compute `unmappedFieldIds`.
- Prefill helper: apply only `confidence === 'high'` into empty locator fields.

### M4 — Agent façade

- Admin-only entry from Autofill editor (session must be admin; reuse existing admin gate).
- Flow: inspect → mock provider → safety → `StructuredMappingProposal` → UI.
- Optional: same orchestration callable from a thin Hub module without Edge Function if no server yet; if Edge Function added, it must still call `MappingLlmProvider` and hold no vendor hard-wire. Prefer **in-app Agent Service module** behind the interface for MVP so mock works offline; document that production provider adapter plugs in later at the same boundary.
- **No** `service_registry` writes from this path.

### M5 — Admin UX (`AutofillProfileEditor.tsx`)

- Prerequisites gate (schema + HTTPS Login Entry).
- Analyze CTA → analyzing → apply HIGH only; mark unmapped with «לא מופה בביטחון».
- Do not call `updateGlobalRegistryRow` from Analyze.
- Do not change `supportState`.
- Existing Save path unchanged (Phase 117).

### M6 — Phase 117 isolation

- No imports from assisted-mapping into `managedAutofill.ts`, Managed extension fill path, or Digital Home tile execution.
- Re-run `scripts/verifyPhase117ManagedAutofill.mjs` (or successor) — must PASS.

### M7 — Verification

- New `scripts/verifyPhase118AssistedMapping.mjs` covering AC-118-1…25 as automated where possible; list Operator manual checks for live tab Analyze.
- `dev-phase118.md` with evidence table.
- If implementation cannot complete meaningful Agent semantic validation without a real LLM: **STOP** with provider gate report (below) — do not invent credentials requests early.

### Real AI provider STOP gate (Operator/Architecture)

When reached, Developer returns:

1. What capability now requires the real provider  
2. Recommended provider/model options  
3. Required account/API setup  
4. Expected data sent to the provider  
5. Security/privacy implications  
6. Estimated usage/cost model  
7. Exact Operator setup steps  

Until then: mock only.

## Acceptance / Gating Criteria

| AC | Milestone | Verification |
|---|---|---|
| AC-118-1 | M5 | Prerequisite gates block Analyze |
| AC-118-2 | M2 | Redaction / no value fields in structure |
| AC-118-3 | M2 | Top-frame only in inject target |
| AC-118-4 | M4/M5 | Non-admin cannot invoke (static + admin gate) |
| AC-118-5 | M1/M4 | Interface + mock; no vendor package |
| AC-118-6 | M3 | Invalid fieldIds dropped |
| AC-118-7 | M3/M5 | Only final high prefills |
| AC-118-8 | M5 | Uncertain empty + badge |
| AC-118-9 | M5 | Analyze does not persist / change supportState |
| AC-118-10 | M5 | Save remains Phase 117 path |
| AC-118-11 | M3 | partial / no_confident_mapping accepted |
| AC-118-12 | M3/M5 | Timeout leaves locators unchanged |
| AC-118-13 | M4 | Log helpers omit secrets |
| AC-118-14 | M6 | Managed path grep clean |
| AC-118-15 | M3/M7 | ≥2 synthetic schemas in fixtures |
| AC-118-16 | M2/M5 | No submit; no live validation call from Analyze |
| AC-118-17 | M3 | Locator ⊆ candidates |
| AC-118-18 | M3 | Semantic non-lexical HIGH fixture |
| AC-118-19 | M3 | Invented inputId rejected |
| AC-118-20 | M3 | Invented locator rejected |
| AC-118-21 | M3 | Conflict demotion |
| AC-118-22 | M3/M5 | Ambiguous → empty |
| AC-118-23 | M3 | Lexical exact HIGH still works |
| AC-118-24 | M3/M7 | No hard-coded vocabulary in product code |
| AC-118-25 | M3 | Lexical not mandatory for HIGH |
| AC-118-26 | M8 | Empty inputs → zero provider calls; closed outcome; no prefill/save/supportState |

## Functional Testability Criteria

- **Page/screen:** Global Admin → Registry → service → Autofill mapping editor.
- **User-visible:** «נתח דף כניסה» → tab opens → HIGH locators fill empty rows → uncertain show «לא מופה בביטחון» → Save only on Admin Save.
- **Command-line:** `node scripts/verifyPhase118AssistedMapping.mjs`; `npx tsc -p tsconfig.app.json --noEmit`; Phase 117 verify regression.
- **API:** Admin propose path / mock provider only (no production vendor).
- **Minimal E2E:** Fixture or local HTML Login Entry + mock semantic mapping → editor prefill → Admin Save draft (optional manual).
- **Expected:** Authoring assistance only; Managed runtime unchanged.

## Required Developer Evidence

1. `team-Yuri/dev-phase118.md` with AC table PASS/FAIL and file list.
2. `scripts/verifyPhase118AssistedMapping.mjs` output PASS.
3. Phase 117 regression PASS.
4. `tsc` PASS.
5. Confirmation: no production AI provider hard-wired; mock used for automated tests.
6. If blocked on real provider: seven-item STOP report (no credential request before gate).

## Out of Scope

Modal/popup/multi-step; Login Entry discovery; CAPTCHA/OTP; auto-submit; autonomous validation; end-user agent; runtime AI Autofill; locator repair; service-definition generation; selecting/wiring Azure/OpenAI/Anthropic; Phase 117 semantic changes; Phase 116 identity work.

## Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Real LLM needed for live semantic quality | Mock for AC automation; STOP gate before credentials |
| Extension messaging from Admin origin | Reuse existing external-message patterns; admin Hub origin allowlist |
| Prompt injection via page text | Untrusted data channel; candidate allowlist; schema validate |
| Accidental Managed path coupling | M6 static isolation + Phase 117 regression |

## STOP Conditions

- Any Phase 117 runtime change required to “make Analyze work” → STOP / Architecture.
- Desire to hard-wire a vendor SDK without provider gate → STOP.
- Credential values appearing in inspect/agent payloads → FAIL / fix before merge.
- Scope creep into modal/multi-step → reject; file as future AgentTask.

## Amendment — Live OpenAI provider wiring (2026-09-16)

**OPERATOR / ARCHITECTURE:** LIVE PROVIDER GATE ACCEPTED. MVP provider = OpenAI behind `MappingLlmProvider`.

| Binding | Rule |
|---|---|
| Adapter | `OpenAI` via server-side only (Supabase Edge Function); Hub calls `supabase.functions.invoke` |
| CI / verify | `MockMappingLlmProvider` remains default for `verifyPhase118AssistedMapping.mjs` |
| Secret | `OPENAI_API_KEY` — server/Edge only; **never** `VITE_*`; never chat/git/logs |
| Model | `gpt-4o-mini` (or `OPENAI_MODEL` override) with Structured Outputs |
| Safety | Hub still runs `applySafetyAndConfidence` after raw model proposals |
| Scope | No modal/multi-step; Phase 117 unchanged |

**Secret handoff:** Developer must STOP and instruct Operator to place the key in the documented Edge secret location — do not request paste into Cursor chat.

**Live validation before CLOSE:** Rivhit control + two unknown simple Login services (Operator must not pre-inspect selectors on unknowns).

### M8 — D-118-14 Empty-input pre-provider fail-closed (BLOCKING — 2026-09-17)

| Rule | Detail |
|---|---|
| Trigger | `SafePageStructure.inputs` missing or `length === 0` |
| Hub | `proposeFieldMappings` must **not** call `MappingLlmProvider.proposeMappings` |
| Edge | `propose-field-mappings` must return before OpenAI `fetch` with empty proposals (auth still required) |
| Outcome | `status: no_confident_mapping`; zero proposals; warning `no_observed_inputs` allowed |
| UX | No Admin prefill; Analyze must not save or change `supportState` |
| Safety | `applySafetyAndConfidence` rules unchanged |
| Out of scope | No Hapoalim/hostname/service-specific logic; Case C not authorized |

**Verification (required before Architecture authorizes Case C):**
1. Synthetic zero-input → provider invocation count = 0  
2. Non-empty Assisted Mapping path still PASS (`verifyPhase118AssistedMapping.mjs`)  
3. Phase 117 Managed Autofill regression PASS (`verifyPhase117ManagedAutofill.mjs`)

## Manager Review
MANAGER_REVIEW_STATUS: APPROVED

### Review Notes
Detailed Design derived solely from APPROVED `arch-phase118.md`. Operator START DEVELOPMENT authorizes Developer execution of this plan. Provider gate accepted 2026-09-16 — OpenAI MVP wiring authorized under amendment above; mock remains for CI.

2026-09-17 — M8 / D-118-14 / AC-118-26 authorized for Developer. Case C remains not authorized.

### Required Corrections
None.
