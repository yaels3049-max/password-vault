# Developer Phase 118

## Phase Identifier
PHASE=118

## Status
STATUS: D-118-14_IMPLEMENTED — AC-118-26 verified locally; Case C still NOT authorized; Edge redeploy recommended for remote guard parity

## D-118-14 / AC-118-26 — Empty-input pre-provider fail-closed (2026-09-17)

### Implementation

| Layer | Change |
|---|---|
| Hub | `proposeFieldMappings` short-circuits when `page.inputs` missing/empty — **does not** call `MappingLlmProvider` |
| Edge | After auth + payload validate, empty `page.inputs` → HTTP 200 `{ ok: true, proposals: [], reason: 'no_observed_inputs' }` **before** OpenAI `fetch` / key requirement for that path |
| Safety | `safetyValidation.ts` **unchanged** |
| Scope | No hostname/service/Hapoalim logic; no auto-save; Analyze still does not touch `supportState` |

### Verification evidence

```text
node scripts/verifyPhase118AssistedMapping.mjs
→ PASS
  - AC-118-26 synthetic zero-input: providerCalls === 0
  - status === no_confident_mapping; proposals === []; warning includes no_observed_inputs
  - non-empty path still invokes provider once; invented rows still rejected by safety
  - static: Hub + Edge contain no_observed_inputs guards

node scripts/verifyPhase117ManagedAutofill.mjs
→ PASS
```

### Confirmations for Architecture

- Hub pre-provider short-circuit: **YES**
- Edge zero-input guard (source): **YES** (redeploy `propose-field-mappings` so production Edge matches repo)
- No service/hostname-specific logic: **YES**
- Deterministic safety unchanged: **YES**
- No auto-save / supportState mutation from this slice: **YES**
- Case C: **NOT AUTHORIZED**

## Deployment probe (2026-09-16 agent environment)

```text
node scripts/probeProposeFieldMappings.mjs
→ options_status=404
→ NOT_FOUND: Requested function was not found
→ RESULT=NOT_DEPLOYED
```

`OPENAI_API_KEY` / `OPENAI_MODEL` secrets may already be set in the project, but **`propose-field-mappings` is not deployed yet**.

Agent machine has **no** `SUPABASE_ACCESS_TOKEN` / `supabase login` session, so deploy cannot be completed from Cursor. Operator must deploy from their authenticated terminal or Dashboard.

## Operator deploy (required next)

```text
npx supabase login
npx supabase link --project-ref wbehjoraatkrpsbgyunx
npx supabase functions deploy propose-field-mappings
node scripts/probeProposeFieldMappings.mjs
```

Expect probe:

- **not** 404
- unauthenticated POST → **401** or **403** (fail-closed auth)
- `unauthenticated_body_leaks_secret=false`

Dashboard alternative: Edge Functions → Deploy `propose-field-mappings` from `supabase/functions/propose-field-mappings`.

Confirm secrets remain set (do not paste values into chat):

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4o-mini`

## Commands and results (CI / local)

```text
npx tsc -p tsconfig.app.json --noEmit
→ PASS

node scripts/verifyPhase118AssistedMapping.mjs
→ PASS (mock)

node scripts/verifyPhase117ManagedAutofill.mjs
→ PASS
```

## OpenAI wiring (unchanged)

| Piece | Location |
|---|---|
| Edge Function | `supabase/functions/propose-field-mappings/index.ts` |
| Hub remote adapter | `src/assistedMapping/openaiRemoteProvider.ts` |
| Safety after model | `src/assistedMapping/safetyValidation.ts` |
| Mock / CI | `MockMappingLlmProvider` |
| Mode flag (not secret) | optional `VITE_ASSISTED_MAPPING_PROVIDER=openai` |

## Fail-closed expectations

| Condition | Expected |
|---|---|
| Function not deployed | Hub Analyze fails closed (no mapping invent) |
| No/invalid JWT | 401/403; no OpenAI call |
| Non-admin JWT | 403 |
| Missing `OPENAI_API_KEY` on server | 503 `provider_not_configured` (non-empty inputs only) |
| Empty `page.inputs` (D-118-14) | Hub: no provider call; Edge: 200 empty proposals, no OpenAI |
| Provider timeout/error | Hub `provider_error` / failed Analyze; form locators unchanged |
| Response / logs | Never contain `OPENAI_API_KEY` or `sk-…` |

## STOP before live A/B/C

Do **not** close Phase 118. After deploy probe PASS, Operator runs live validation below and returns capture sheets to Architecture.

## Exact Operator live validation instructions

### Preconditions

1. Extension **1.4.25+** reloaded; Hub Admin session as Global Admin.
2. `propose-field-mappings` deployed; probe PASS.
3. Optional Hub: `VITE_ASSISTED_MAPPING_PROVIDER=openai` (default is openai when Supabase is configured).

### Case A — Rivhit (known control)

1. Open Rivhit in Admin → Managed Autofill editor (schema + Login Entry already set).
2. Click **«נתח דף כניסה»**.
3. Record (no secrets): schema field ids; HIGH locators proposed; uncertain fields; whether Save stayed manual; `supportState` unchanged by Analyze.
4. Optionally edit + **שמור מיפוי**; confirm structural validation still OK.

### Case B — Unknown simple Login #1

1. Choose a **simple single-page** Login service that is **not** Rivhit.
2. Ensure credential schema + HTTPS Login Entry exist.
3. **Do not** open DevTools / inspect selectors / copy CSS before Analyze.
4. Click **«נתח דף כניסה»**.
5. Record: schema; proposals (HIGH vs uncertain); Admin edits needed; Save manual; structural OK after Save if saved.

### Case C — Unknown simple Login #2

1. Different service from B and Rivhit; **non-identical** schema and/or page naming.
2. Same rule: **no** selector pre-inspection.
3. Analyze + same capture sheet.

### Pass signals for Architecture

- A works as control.
- B and C produce at least **partial useful HIGH** mappings without prior selector knowledge OR correctly leave fields uncertain (empty + «לא מופה בביטחון») — not invented CSS.
- Analyze never auto-saves / never sets `validated` / never changes `supportState`.
- Phase 117 Managed Autofill runtime behavior unchanged.

## Constraints preserved

No OpenAI in Admin business logic / extension / Managed runtime. No auto-save / auto-validation. No credentials/values/cookies/HTML to provider. Deterministic safety after model. Phase 117 unmodified.

## Architect review package

- Wiring PASS  
- Operator secrets reported COMPLETE  
- Deployment: **NOT_DEPLOYED** from agent probe (Operator must deploy)  
- Live AI quality: **PENDING** A/B/C after deploy  
- Phase 118: **OPEN**
