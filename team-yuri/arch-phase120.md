# Architecture Phase 120

## Phase Identifier
PHASE=120

## Status
STATUS: **PHASE 120 — FORMALLY CLOSED / ARCHITECTURE ACCEPTED** (2026-09-22)

CREATED: 2026-09-20 — Phase 120 architecture after Phase 119 FORMAL CLOSE.

SLICE AUTHORIZATION: **120.4–120.9 CLOSED**. Phase 120 Final Closure **CLOSED** (unchanged). **A1 CLOSED**. **A2–A2.4 IMPLEMENTED**. **A2.5 CLOSED**. **Bank Leumi = KNOWN RELIABILITY LIMITATION** (investigation **PAUSED**). **A2.4-CORR SPEC ACCEPTED / IMPL DEFERRED**. **B alongside P REJECTED**. **O1** FAILED / NOT ACCEPTED / FROZEN. **No** O2 / Layer A / S-120A-1 / DH / Phase 121. A1 locked. Reopen Leumi only on explicit architecture/product decision.

## Title
Phase 120 — Unified Managed Autofill Runtime

## Phase Goal

Converge supported Autofill behavior toward **one deterministic, configuration-driven Managed Autofill runtime**.

**Target architecture (normative intent):**

```text
Admin authors configuration
  → Admin validates configuration
  → configuration becomes the authoritative service definition
  → one Managed Autofill runtime executes the validated definition
  → runtime returns structured result
  → no service-specific runtime behavior required for normal supported services
```

**Mandatory sequencing:** Phase 120 **MUST NOT** begin with deletion or migration.  
**First:** establish the exact current runtime inventory from **repository evidence** (Slice 120.1) — **DONE**.

Predecessor: Phase 119 CLOSED (`arch-phase119.md`). Phase 119 deferred “Autofill Runtime Convergence” is **superseded** by this phase’s inventory-first approach.

---

## 1. Purpose and scope

### In scope (Phase 120 overall)
- Evidence-backed inventory of all reachable Autofill / identity-fill mechanisms (**120.1 COMPLETE**)
- Architecture classification of each mechanism
- Owner-gated convergence sequence (approved **individually** after inventory)
- Preservation of Phase 117 Managed security/determinism rules as the TARGET runtime

### Out of scope until Owner authorizes a migration slice
- Runtime / adapter / flag / fallback deletion or removal
- Service migration onto Managed (except when Owner authorizes a numbered slice)
- Managed runtime modification
- Service-specific new code
- iframe / Shadow DOM / modal / multi-step capabilities
- Autofill Health Monitoring implementation
- Treating Clalit / Shufersal / HTZone as architectural requirements (investigation targets only)

### Reserved for future architecture (NOT 120.1 / not first 120.2)
**Managed Autofill Health Monitoring / Mapping Drift Detection** — recorded; not authorized.

---

## 2. Architectural decisions (Phase 120)

| Decision | Rationale | Consequence |
|---|---|---|
| **D-120-1: Inventory before mutation** | Unknown parallel paths remain; deletion without evidence is unsafe | 120.1 is read-only investigation |
| **D-120-2: Managed is TARGET runtime** | Phase 117 deterministic config-driven fill is the intended production model | Classify paths relative to Managed |
| **D-120-3: No big-bang delete/migrate** | Avoid outage and silent capability loss | Owner approves each migration individually |
| **D-120-4: Repository evidence is authoritative** | Historical discussion ≠ current reachability | Do not assume mechanisms still exist |
| **D-120-5: Investigation targets ≠ requirements** | Clalit/Shufersal/HTZone inform legacy understanding | No hostname-driven architecture |
| **D-120-6: Health monitoring reserved** | Valuable but separate from convergence inventory | Recorded; not 120.1 |
| **D-120-7: Preserve Phase 117/118/119 contracts** | Do not weaken Managed, Assisted Mapping, Visual Mapping, readiness | 120.1 makes no production changes |
| **D-120-8: Single shared Global Registry DB (topology)** | Localhost Admin Hub and deployed Production Hub both use Supabase project `wbehjoraatkrpsbgyunx` | Global Managed config is **not** environment-isolated; S3–S7 writes are Production-visible. Separate config promotion is **not** applicable until Owner creates separate config environments |
| **D-120-9: Named services are validation fixtures only** | Phase target is a **generic**, configuration-driven Managed Autofill runtime for arbitrary supported services | **No** production runtime behavior, deployment mechanism, environment mechanism, or configuration lifecycle may be designed around a named service (including Shufersal, Rivhit, Meuhedet, etc.). Named services are **validation fixtures only** |
| **D-120-10: Representative config-only convergence** | Phase 120.3 proves simple logins can be represented entirely by configuration; it does **not** require migrating every simple catalog service | Existing simple services may be used as **representative migration fixtures only**. Architectural objective = eliminate dependency on legacy execution mechanisms via **sufficient representative evidence**, not exhaustive one-by-one catalog migration |
| **D-120-11: Model generic login capabilities, never individual sites** | Target architecture is capability → configuration → validated Managed runtime | Popup/modal, multi-step, iframe, Shadow DOM, pre-fill activation, etc. are **generic** capabilities (or explicit **unsupported**). **Never** hostname/serviceId/named-site adapters or site selectors in production runtime as the product model. Named services are fixtures only. If a capability is missing → **UNSUPPORTED** until a **generic** design is separately approved — not a new site-specific path |
| **D-120-12: One Managed Autofill execution path** | Admin Test and Digital Home must not become two Autofill engines | Different **credential value sources** may feed one shared Managed fill pipeline (`HUB_MANAGED_AUTOFILL` / assess / fill / verify). **No** test-only weaker safety, selectors, or fill algorithm |
| **D-120-13: Admin candidate test ≠ Digital Home production eligibility** | Owner needs to test **saved** mappings before validate | Admin-only harness may execute **saved candidate** mappings explicitly for diagnostics. Digital Home **must** continue requiring the normal Managed production eligibility/validation contract. Test runs must **not** stamp validated / change supportState / activate |

**Prior draft input (checklist only):** `team-Yuri/inventory-autofill-runtime-convergence.md`.

---

## 3. Slice 120.1 — Autofill Runtime Inventory

### Status
**COMPLETE — Architecture Review PASS** (2026-09-20). Full report: `team-Yuri/manager-phase120.md`.

### Charter (historical — fulfilled)
Read-only repository investigation; classify each path; return inventory + A–E before any migration slice. AC-120.1-1…7 — **PASS**.

---

## 4. Architect Review — Slice 120.1 Inventory (PASS)

ARCHITECT_REVIEW_STATUS: **120.1 PASS** (inventory accepted)

### Verdict
Manager report satisfies AC-120.1-1…7. Key claims re-checked against current `executeServiceFromTile`, adapter registry, catalog, and medium allowlist.

### Verified inventory (Architect-accepted)

| Mechanism | Production reachable | Classification | Architect note |
|---|---|---|---|
| Managed Autofill (`HUB_MANAGED_AUTOFILL`) | Yes when validated+eligible | **TARGET** | Fail-closed open+message; **no** silent generic fallback — confirmed |
| HTZone adapter (`POC_FILL_IL`) | Yes when `adapterId=htzone` | **MIGRATION CANDIDATE** (prep may become **TEMPORARY EXCEPTION**) | Sole production site adapter besides practice |
| Practice adapter (`POC_FILL_DEMO`) | Demo/localhost | **DEVELOPMENT / POC** | Confirmed |
| Legacy generic (`POC_GENERIC_FILL`) | Yes for basic/unknown without Managed/adapter | **MIGRATION CANDIDATE** | Clalit/Shufersal path when no Managed |
| Identity-first medium (`POC_IDENTITY_FIRST_FILL`) | Yes when LI=medium + allowlist + flag | **MIGRATION CANDIDATE** | amazon-il / ksp / localhost fixture |
| LI complex / open-only | Yes | **TEMPORARY EXCEPTION** (by design) | No fill |
| POC Hub helpers / `?pocAutofill=1` | DEV | **DEVELOPMENT / POC** | Confirmed |
| `LEGACY_ADAPTER_ID_BY_SERVICE_ID` | Empty `{}` | **DEAD / UNREACHABLE** | Confirmed |

### Target investigations (verified)
| Target | Finding |
|---|---|
| **HTZone** | Dedicated adapter + extension path — **yes** |
| **Clalit** | **No** dedicated adapter — catalog + Managed-if-validated else **legacy generic** |
| **Shufersal** | **No** dedicated adapter — same as Clalit |

### Decision tree (verified)
```text
adapter {htzone, practice}
  → Managed (claim/validated/eligible) — fail → open+msg; NEVER generic
  → LI complex → open
  → LI medium → identity-first
  → generic (basic|unknown + eligibility)
  → open-only
```

Full table + sections A–E: `team-Yuri/manager-phase120.md`.

### Corrections required of Manager
**None** for 120.1 acceptance. Non-blocking: keep “open-only” as both intentional LI-complex and fail-closed Managed/generic outcomes (do not merge).

### Explicitly not authorized by this review
Deletion · flag/fallback removal · HTZone retirement · generic retirement · Managed runtime changes · Health Monitoring · iframe/shadow/modal/multi-step

---

## 5. Slice 120.2 — Simple Catalog Managed Migration Pilot (AUTHORIZED)

### Status
**AUTHORIZED** (Owner 2026-09-20) — **Shufersal ONLY**.

### Objective
Prove the **generic** migration procedure: move one existing simple catalog service from **legacy generic Autofill** to **validated Managed Autofill**.  
This is a **migration pilot**, not legacy retirement.

### Pilot service (validation fixture only — D-120-9)
| Field | Value |
|---|---|
| Role | **Validation fixture** for the generic Managed migration procedure — **not** a service-specific architectural target |
| Service id | `shufersal` |
| Catalog display | שופרסל |
| Built-in Login Entry (catalog seed — verify live) | `https://www.shufersal.co.il/online/he/login` |
| Built-in schema seed (historical — **not** normative) | seed still has `email`,`password` — **OUT OF SLICE** hygiene debt |
| **Normative live schema (S1 PASS)** | **`username`, `password`** |
| `adapterId` | live `""` ≡ **none** (must not create adapter; no cosmetic rewrite) |

**Binding (D-120-9):** No production runtime behavior, deployment mechanism, environment mechanism, or configuration lifecycle may be designed around the name `shufersal` or any other named service. Pilot success must transfer to other services via **configuration only**.

### Target flow (normative)
```text
Shufersal catalog service
  → explicit Login Entry
  → credential schema with stable field IDs
  → explicit Managed field mappings
  → Admin validation / approval
  → validated Managed configuration
  → Digital Home tile
  → deterministic Managed Autofill (orchestrator precedence)
  → manual submit
```

Once validated Managed is active, Shufersal **must** execute through Managed. Legacy generic **must not** execute as fallback for that validated Managed service (existing orchestrator behavior — confirm with evidence).

### Authoring (existing capabilities only)
Manager DD must be based on **CURRENT** Shufersal catalog/schema and **live** login structure — do not assume historical selectors/schema.  
Use Phase 117/118/119 authoring: Analyze Login Page, Visual Mapping, `readiness_wait_inputs`, explicit Admin approval.  
**No** service-specific runtime implementation.

### Success criteria (AC-120.2-*)

| ID | Criterion |
|---|---|
| AC-120.2-1 | Shufersal remains a normal catalog service |
| AC-120.2-2 | No Shufersal adapter is created |
| AC-120.2-3 | No hostname/serviceId branch added to runtime |
| AC-120.2-4 | Managed configuration is validated (`supportState=validated`) |
| AC-120.2-5 | Digital Home launch selects Managed runtime |
| AC-120.2-6 | Required credential fields fill correctly on live login page |
| AC-120.2-7 | No auto-submit |
| AC-120.2-8 | Managed failure does not silently fall back to legacy generic |
| AC-120.2-9 | Existing non-Shufersal runtime behavior unchanged |
| AC-120.2-10 | Evidence demonstrates which runtime path executed |
| AC-120.2-11 | TEST configuration/validation is **not** treated as Production final state |
| AC-120.2-12 | Controlled **config-only** Production promotion path is defined (and later implemented under Owner gate) — without copying user credentials |
| AC-120.2-13 | Explicit Production activation gate separate from TEST `validated` |
| AC-120.2-14 | Minimal Production smoke: Managed path + fill + no auto-submit + no silent generic fallback |

### Hard stops (out of scope)
- Do **not** delete or globally disable legacy generic  
- Do **not** migrate Clalit  
- Do **not** modify: HTZone adapter, identity-first medium, LI complex, open-only, Practice adapter, global orchestrator precedence  
- Do **not** start runtime retirement  
- Do **not** implement Health Monitoring / iframe / shadow / modal / multi-step  
- Do **not** copy user vault credentials / production user data between environments  
- Do **not** claim 120.2 COMPLETE based on TEST-only validation  

### Process (Owner) — corrected
```text
TEST configuration (Analyze / Visual / readiness / validate)
  → TEST evidence (path proof) — RETAIN; do not discard
  → Architecture-defined Production promotion (config-only) — DESIGN first; implement only when Owner authorizes
  → Explicit Production activation
  → Production smoke verification
  → Architecture acceptance of Production delivery
  → return to Owner before next migration
```

### Manager DD requirements (updated)
1. Re-read current catalog row / registry shape for `shufersal` (schema + Login Entry) — **live TEST baseline**.  
2. Live structure check (Analyze / Visual Mapping / readiness as needed).  
3. Define config-only TEST steps to produce validated Managed profile (no new runtime code).  
4. Define verification evidence for AC-120.2-1…10 (path proof mandatory).  
5. Explicit regression: non-Shufersal paths untouched; generic still available for other services.  
6. **NEW:** Separate TEST vs PRODUCTION stages; define promotion artifact contents; environment safety; PROD activation; PROD smoke; deployment distinctions (below). Do **not** implement promotion until Architecture/Owner authorize that implementation step.

---

## 5A. Architecture correction — Production delivery path (Owner 2026-09-21)

### Gap assessment
| Finding | Verdict |
|---|---|
| 120.2 as previously written | Defined **TEST** Admin authoring + validation + evidence |
| Production delivery | **Undefined** — TEST `validated` was at risk of being treated as final |
| Owner intent | Phase work must yield a **controlled path to PRODUCTION**, not TEST-only success |
| Manual re-authoring in PROD | **Unacceptable as default**; only if Architecture proves no safe alternative and Owner accepts temporary debt |

### Current repository capability (evidence)
| Capability | Exists? | Notes |
|---|---|---|
| Managed config storage | **Yes** | `service_registry.metadata.autofillProfile` (+ row `login_fields`, `login_url`, `metadata.credentialMode`, `adapter_id`) per Supabase project |
| Admin authoring in-env | **Yes** | AutofillProfileEditor → `updateGlobalRegistryRow` |
| Dump/compare TEST config | **Partial** | Operator/dump scripts — **read** only |
| Automated TEST→PROD promote | **No** | No export/import/apply package; no multi-env sync |
| Copy credentials across envs | **Forbidden / not present** | Admin must not touch vault ciphertext; correct |
| PROD activate in production Hub build | **Gap** | `AutofillProfileEditor` activate control is **`import.meta.env.DEV === true`** gated — Production builds omit Operator activate button |
| Source deploy vs config promote | **Distinct** | Code/extension deploy ≠ registry metadata promotion |

**Verdict:** **No existing safe automated configuration-promotion mechanism.** A **safe alternative is architecturally possible** (config-only metadata package without credentials) — therefore Architect does **not** accept “manual multi-day re-author in PROD” as the lasting plan. That would be temporary debt only if Owner later rejects building promotion.

### Managed configuration artifact (what must be promotable — config-only)
| Artifact | Promote? | Notes |
|---|---|---|
| Service identity (`id=shufersal`, global row) | Identity must exist in PROD | Create/ensure row; do not invent new id |
| Credential schema / stable field IDs | **Yes** | Must remain **`username`**, **`password`** (live baseline) |
| `credentialMode` | **Yes** | e.g. `credential_fields` |
| Login Entry (`login_url` / profile `loginEntryUrl`) | **Yes** | Verified URL |
| `allowedOrigin` | **Yes** | Derived from Login Entry |
| Field mappings (CSS locators) | **Yes** | Config-only; not secrets |
| `configVersion` | **Yes** (as serialized) | Version discipline on apply |
| Validation metadata / `supportState` | **Promote as candidate**; **do not** auto-activate PROD | Explicit PROD activation gate |
| User vault credentials | **NEVER** | Per-user; each PROD user supplies own credentials |
| Production user data → TEST | **NEVER** | |

### Required architecture separation (normative for 120.2)

**1. TEST CONFIGURATION**  
Admin authoring, Analyze / Visual Mapping, readiness, structural save, TEST validation/evidence, TEST path proof. **Current TEST evidence remains valid and must be retained.**

**2. PRODUCTION PROMOTION**  
Controlled mechanism to move the **approved config artifact** (table above) from TEST global registry to PRODUCTION global registry under Admin authentication — **without** Owner manually recreating days of mapping work, and **without** moving credentials.

**3. ENVIRONMENT SAFETY**  
- No user credentials between environments  
- No production user data into Test  
- Explicit ownership: TEST Admin config vs PROD Admin config  
- Promotion = config-only; fail closed if package incomplete/invalid  

**4. PRODUCTION ACTIVATION**  
TEST `supportState=validated` must **not** silently activate Production. PROD requires explicit activation gate after successful apply (and must address DEV-only activate UI gap for production Hub builds).

**5. PRODUCTION VERIFICATION (minimal smoke)**  
- Shufersal launch selects `HUB_MANAGED_AUTOFILL`  
- Expected fields fill (`username`, `password`)  
- No auto-submit  
- No silent legacy generic fallback  

**6. DEPLOYMENT distinctions**
| Kind | Role in 120.2 |
|---|---|
| Source-code deployment | Hub/app release — **not** a substitute for config promotion |
| Extension release/deployment | Required for Managed runtime parity — **separate** from registry config |
| Database/schema migration | RLS/tables — **not** how Managed locators are promoted |
| Service configuration promotion | **Required missing piece** — config-only apply of Managed artifact |
| Production activation | Explicit gate after promote |

### Minimum correction required for 120.2 (now)
1. **Architecture (this document):** gap + separation + artifact list — **DONE** below.  
2. **Manager:** amend 120.2 DD to add TEST vs PROD stages, promotion package contents, safety, PROD activation, PROD smoke, deployment distinctions — **design only**; mark promotion **implementation NOT started**.  
3. **Do not implement** promotion code until Owner reviews this correction and authorizes implementation (may remain inside 120.2 or a tightly scoped 120.2b — Owner chooses).  
4. **Continue TEST S3–S7 / path evidence** — still authorized; evidence retained.  
5. **Do not** claim 120.2 Production-complete or start Owner Production UAT until promotion path exists **or** Owner explicitly accepts temporary manual-PROD debt (Architect recommends **against** accepting that debt as default).

### Temporary debt stance
Manual full re-authoring of Shufersal Managed mappings in Production is **not** the architectural target. It is allowable **only** as Owner-accepted temporary debt with written justification. Default path: **build config-only promotion**.

### Implementation authorization
**Promotion mechanism implementation: NOT AUTHORIZED yet.**  
Await Owner decision after this architecture correction + Manager DD amendment.

---

## 6. Slice roadmap

| Slice | Intent | Status |
|---|---|---|
| **120.1** | Autofill Runtime Inventory | **ACCEPTED** |
| **120.2** | Shufersal Managed migration pilot | **AUTHORIZED** — TEST continues; **Production delivery path required** (§5A); promotion **not implemented**; S1 **PASS**; S3–S7 **authorized**; P1/P3/P4 **PENDING** |
| **120.3+** | TBD after 120.2 Owner acceptance | **NOT AUTHORIZED** |

---

## 7. Constraints / Non-Negotiables

- Repository evidence authoritative  
- No big-bang deletion/migration  
- No weakening Phase 117 Managed security  
- Owner gates each migration individually  
- Health Monitoring reserved  
- 120.2 = Shufersal pilot only; Clalit and retirements excluded  

---

## 8. Handoff Notes for Manager

1. 120.1 inventory **ACCEPTED**.  
2. 120.2 amended DD (live schema) **APPROVED**; S1 **PASS**.  
3. **Amend 120.2 DD for §5B topology:** shared Global Registry; S3–S7 = Production-visible writes; **do not design Configuration Promotion**. Document activation/smoke/Hub–extension–Edge–migration distinctions.  
4. S3–S7 / evidence may continue with blast-radius awareness; do not discard evidence.  
5. Do **not** open Clalit / HTZone / retirement DD.  
6. Do not implement Health Monitoring.

---

## Architect Review
ARCHITECT_REVIEW_STATUS: **120.1 ACCEPTED**; **120.2 §5B DD APPROVED**; **S1 PASS**; **P1/P3/P4 PENDING**

### Review Notes
2026-09-20 — Phase 119 FORMAL CLOSE; Phase 120 initiated; 120.1 investigation authorized.  
2026-09-20 — **120.1 inventory Architecture Review PASS.**  
2026-09-20 — Owner **ACCEPTED** 120.1. Owner **AUTHORIZED** Slice **120.2 — Shufersal ONLY**.  
2026-09-20 — **120.2 Manager DD Architecture Review PASS** (initial).  
2026-09-20 — Execution gate S1 BLOCKED (RLS / live UNKNOWN).  
2026-09-21 — **S1 MISMATCH / STOP_ARCHITECTURE.** Disposition: use live `username`/`password`; no seed rewrite.  
2026-09-21 — **Amended 120.2 DD re-review PASS.** S1 recorded **PASS** against authenticated live baseline. Admin **S3–S7 authorized**. Owner UAT and P1/P3/P4 remain **PENDING**.

2026-09-21 — Owner asked for Production promotion path. Initial §5A recorded.

2026-09-21 — **Topology verification (§5B):** localhost Admin Hub and deployed Production Hub (`password-vault-sable.vercel.app`) both use Supabase **`wbehjoraatkrpsbgyunx`**. Global Registry / Managed config **physically shared**. S3–S7 **already modifies Production-visible** global configuration. **Configuration Promotion design withdrawn** (no separate config environments). Manager must amend DD accordingly.

2026-09-21 — **§5B DD amendment Architecture re-review PASS.** Manager recorded shared topology, Production-visible blast radius, no Configuration Promotion, activation/smoke/deploy distinctions. Aligns with §5B. Minor non-blocking: DD AC table still lists 1…10; 11…14 satisfied in body.

2026-09-21 — **D-120-9** recorded: named services are validation fixtures only; no named-service-specific production runtime/deploy/env/lifecycle design. **120.FSC** Fresh Service Creation validation **RESERVED — NOT AUTHORIZED**. **No service-specific production code authorized.**

### Required Corrections
None blocking. Manager may optionally list AC-120.2-11…14 in the DD AC table.

### Exact next evidence step (P1 / P3 / P4) — binding order
**Prerequisite:** Operator completes **S3–S7** on shared Global Registry (Production-visible) and returns Hub console status with **`s7Done: true`** / `supportState=validated`. Do **not** claim P1/P3/P4 until that gate.

Then capture **in this order** (no Owner UAT until Architecture reviews the package):

1. **P3 (first)** — Hub console `operatorAssistS3S7ShufersalHubConsole.js` `MODE='status'`: redacted proof `supportState=validated`, mappings for live schema field IDs `username` + `password`, Login Entry bind, Hub build note. Append to `dev-phase120.md` as **P3 EVIDENCE**.  
2. **P1 (second)** — Digital Home launch of the fixture service → log/path proof of **`HUB_MANAGED_AUTOFILL`** (not `POC_GENERIC_FILL`); note localhost vs Production Hub + extension build. Append **P1 EVIDENCE**.  
3. **P4 (third)** — Live fill of `username` + `password` on Login Entry; **manual submit**; no auto-submit. Record as **P4 EVIDENCE** (may be Operator/Architecture-gated before formal Owner UAT).  

**Forbidden:** service-specific production code; Configuration Promotion; starting **120.FSC**; claiming P1/P3/P4 PASS without the above artifacts.

---

## Slice 120.2 — Execution gate: S1 PASS (live baseline)

### Status
| Gate | Result |
|---|---|
| Authenticated live dump | **CAPTURED** |
| Normative schema | **`username`, `password`** (live) |
| Login Entry / primary URL | **MATCH** (verified live) |
| `adapter_id` `""` | **≡ no adapter** (no cosmetic rewrite) |
| Amended DD (live schema) | **APPROVED** |
| §5B DD amendment | **APPROVED** (2026-09-21 re-review) |
| **S1** | **PASS** against live baseline |
| Admin S3–S7 | **AUTHORIZED** (writes **Production-visible** shared global row — §5B) |
| Owner UAT / path proof | After P1–P5 package |
| Configuration Promotion | **N/A** — no separate config DB |
| P1 / P3 / P4 | **P1 path PASS**; **P3 PASS**; **P4 PASS** |
| **120.2** slice | **CLOSED / ACCEPTED** (2026-09-22) |
| **120.2-AP** | **CLOSED** |
| Post-AP remapping + activate | **PASS** — `password` → `input[name="j_password"]` |
| Analyze empty-result UX copy | **Non-blocking debt** |
| 120.FSC Fresh Service Creation | **RESERVED — NOT AUTHORIZED** |

### Amended DD re-review checklist (PASS)
| # | Requirement | Result |
|---|---|---|
| 1 | Live registry = normative baseline | **PASS** |
| 2 | Field IDs `username`, `password` | **PASS** |
| 3 | No username→email migration | **PASS** |
| 4 | Vault key compatibility preserved | **PASS** |
| 5 | Live Login Entry / primary URL | **PASS** |
| 6 | `adapter_id=""` ≡ none, no rewrite | **PASS** |
| 7 | credentialMode/supportState via Admin only | **PASS** |
| 8 | Seed hygiene out of slice | **PASS** |
| 9 | No runtime/orchestrator/generic/adapters | **PASS** |
| 10 | Shufersal only | **PASS** |

### §5B DD amendment checklist (PASS)
| # | Requirement | Result |
|---|---|---|
| 1 | Shared Supabase `wbehjoraatkrpsbgyunx` recorded | **PASS** |
| 2 | S3–S7 = Production-visible immediately | **PASS** |
| 3 | Configuration Promotion not designed | **PASS** |
| 4 | Hub / extension / Edge / migrations distinguished from shared config | **PASS** |
| 5 | `supportState` activation + Production-path smoke | **PASS** |
| 6 | Evidence retained; P1/P3/P4 pending honest | **PASS** |
| 7 | No service-specific production code | **PASS** |

### Next authorized steps
1. None for 120.2 — **CLOSED**.  
2. Do **not** start **120.FSC** or any new migration without explicit Architecture authorization.  
3. Optional later debt only: Analyze UX copy; catalog seed hygiene; §5C tab-lifecycle hardening.

### Historical record
Prior S1 BLOCKED / MISMATCH / STOP dispositions retained for audit; superseded by this PASS for execution purposes.
Prior §5A Configuration Promotion design retained historically but **superseded by §5B**.

---

## 19. Investigate — credential field.id vs Analyze semantic coupling (2026-09-22)

**Scope:** Architecture investigation only. No implementation. Triggered during clean Rivhit Analyze after successful Clear Mapping (120.7).

**Verdict:** **PARTIALLY_COUPLED**. Architecture gap (schema/Agent contract debt). **Not** a Phase 120 Final Acceptance blocker for Managed Autofill.

### 19.1 Current Agent input contract (evidence)

| Layer | Contract | Semantic fields supplied |
|---|---|---|
| `LoginField` (`serviceModel.ts`) | `id`, `label`, `type`, optional `required`/`masked`/`inputType` | No `description`, no `semanticRole`, no credential-role enum |
| `CredentialSchemaField` (`assistedMapping/types.ts`) | `{ fieldId, label, type? }` only | Same three |
| `schemaFromLoginFields` | maps `id→fieldId`, `label`, `type` | Nothing else |
| Edge `propose-field-mappings` | system prompt + JSON `schema` + `page` | Prompt: map `fieldId`; “Semantic non-lexical matches allowed (e.g. business id field…)”; lexical helpful not required |
| Mock `defaultLiveProposals` | password regex on **fieldId + label + type**; lexical `idAttr/nameAttr/autocomplete === fieldId`; then 1:1 uniqueness | Explicitly uses **fieldId as semantic/lexical signal** |
| Page observation | `SafePageInput` type/id/name/autocomplete/labels/nearby text/locators | Independent of schema IDs |

**Per credential field, Agent receives today:**

| Signal | Present? | Role |
|---|---|---|
| `field.id` / `fieldId` | **Yes** | Persistence join key **and** de facto semantic token (English catalog IDs; mock lexical; prompt examples) |
| Admin-visible `label` | **Yes** | Human/Agent-readable meaning when Admin writes real labels |
| `type` (`text` \| `password`) | **Yes** | Strong password-role signal |
| description | **No** | — |
| autocomplete intent (schema-side) | **No** | (page autocomplete is observation only) |
| credential semantic role enum | **No** | — |
| other schema metadata | **No** for Analyze | `inputType`/`masked`/`required` not forwarded |

### 19.2 Answers to architecture questions

1. **Opaque IDs `field_1`/`field_2`/`field_3` with identical other metadata unchanged**  
   - If **labels + types remain distinguishing** (e.g. Hebrew login/password/business labels, `type=password` on secret): a real LLM **can** still map from label/type ↔ page evidence. Architecture intent (D-118-8) allows that.  
   - Mock lexical path **loses** id/name affinity (correct). Password path still works via `type`/`label`. Remaining multi-field cases without label semantics → ambiguity.  
   - If labels are also opaque/identical → **correct** behavior is no confident mapping.

2. **Is `field.id` used as both A and B?** **Yes.**  
   - **A** Stable identity: vault keys, `fieldMappings[].fieldId`, schema join, unmappedFieldIds.  
   - **B** Semantic description: catalog conventions (`username`/`password`/`business_id`); mock regex + lexical equality to DOM; Edge prompt frames semantics via fieldId examples.

3. **Architecture gap?** **Yes — partial.** Identity and meaning are conflated by practice and mock; label/type partially compensate but are not a dedicated Agent semantic descriptor. Not a Managed Autofill runtime safety defect.

4. **Proper separation**  
   - **Stable field identity** = opaque `field.id` (persistence / join only).  
   - **Human/Agent semantic meaning** = explicit metadata (`label` minimum; preferably `description` and/or `semanticRole`).  
   - **Page observation** = control meaning evidence.  
   - Analyze maps: **credential semantic meaning → observed control meaning**; join result by `field.id`.

5. **Authoritative semantic descriptor independent of id today?**  
   - **Partial:** `label` + `type` are the only non-id meaning carriers. No dedicated Agent semantic field.  
   - Catalog IDs are conventionally meaningful English tokens — not required by schema, but relied on in the wild.

6. **Smallest generic schema extension (if Owner authorizes later)**  
   - Add optional `description?: string` **or** `semanticRole?: string` (free-text or small closed vocab) on `LoginField` → forward on `CredentialSchemaField`.  
   - Agent contract: match using `label` + `description`/`semanticRole` + `type`; treat `fieldId` as opaque join key; forbid requiring meaningful id naming.  
   - Mock: remove fieldId↔DOM lexical as primary semantic path (keep page-side id/name as observation only).  
   - Do **not** invent meanings for opaque fields with empty semantics.

### 19.3 Classification

| Item | Result |
|---|---|
| Coupling | **PARTIALLY_COUPLED** |
| Phase 120 blocking architecture gap? | **Yes — Owner override (2026-09-22)** — elevated to Final Acceptance blocker → Slice **120.8** |
| Manager DD required? | **Yes** — Slice 120.8 DD **Architecture PASS**; **120.8-impl AUTHORIZED** |

### 19.4 Blind-ID acceptance fixtures (proposed; not implemented)

**Positive — opaque IDs + explicit semantics**

```text
schema:
  { fieldId: "credential_a", label: "מזהה התחברות", type: "text",
    description: "login identifier / username or account login name" }
  { fieldId: "credential_b", label: "סיסמה", type: "password",
    description: "secret password" }
  { fieldId: "credential_c", label: "מספר עוסק", type: "text",
    description: "business / VAT / commercial account identifier" }

page (unrelated DOM ids):
  #loginName, #pwdSecret, #osekNum   (labels/nearby text align with descriptions)

Expect: Analyze maps by semantics/evidence, NOT by string equality of fieldId to DOM.
  credential_a → #loginName
  credential_b → #pwdSecret
  credential_c → #osekNum
```

**Negative — opaque IDs + no distinguishing semantics**

```text
schema:
  { fieldId: "credential_a", label: "שדה 1", type: "text" }
  { fieldId: "credential_b", label: "שדה 2", type: "text" }
  { fieldId: "credential_c", label: "שדה 3", type: "text" }
  // no description / semanticRole; types identical

page: three text inputs with unrelated ids

Expect: no HIGH invention; unmapped / low confidence; no false semantic_role_match.
```

### 19.5 Phase impact

- **120.7 Clear Mapping** live path remains valid; Analyze after clear using meaningful labels/IDs is expected.  
- Final Phase 120 Acceptance remains **OPEN / PENDING**.  
- Do **not** reopen 120.6. No implementation in this investigation.

---

## Architect Review (§19)
ARCHITECT_REVIEW_STATUS: **§19 COMPLETE — PARTIALLY_COUPLED**; **Owner override → Final Acceptance blocker**; **120.8 DD PASS**; **120.8-impl AUTHORIZED**; Final Acceptance **OPEN/PENDING**; **120.6/120.7 CLOSED**

### Review Notes
2026-09-22 — Investigate: PARTIALLY_COUPLED. Owner elevated to Phase 120 Final Acceptance blocker. Manager DD 120.8 reviewed **PASS** (identity≠meaning; label+type mandatory; optional description; no semanticRole; prompt/mock forbid fieldId semantics; Blind POS/NEG; no vault/ID migration; authoring-only).

### Required Corrections
_None._

### Exact next step
**Manager:** Amend Slice **120.8 DD** for §20 MEDIUM-prefill before Developer handoff. **Developer:** implement only against the **amended** 120.8 DD. Final Acceptance remains **OPEN / PENDING**.

---

## 20. Architecture Amendment — MEDIUM-confidence Admin Analyze proposals (2026-09-22)

**Status:** **PASS / SUPERSEDING** for Slice **120.8** (pre-implementation). No new slice. No Managed Runtime change. Do **not** reopen 120.6 / 120.7.

### 20.1 Owner intent
Analyze is an **Admin authoring assistant**, not an approval authority. Structurally/safety-validated **MEDIUM** proposals are useful draft information and must not be discarded solely for being non-HIGH.

### 20.2 Binding prefill eligibility (supersedes Phase 118 HIGH-only prefill)

| Final confidence (after safety validation) | Prefill empty mapping slot? | UI requirement |
|---|---|---|
| **HIGH** | **Yes** | Visibly marked **HIGH** |
| **MEDIUM** | **Yes** — as explicit **AI PROPOSAL** | Visibly marked **MEDIUM**; communicate **Admin review required**; **must not** appear equivalent to HIGH |
| **LOW** / unknown / ambiguous / safety-rejected / managed-ineligible | **No** | No locator prefill |

**Unchanged:**
- Prefill only into **empty** slots (no silent overwrite of Admin-edited non-empty locators without explicit replace — Phase 118 rule retained).
- Raw `modelConfidence` never drives prefill alone (D-118-7 layer 2 safety remains).
- Only Managed-eligible (state #2) proposals may enter prefill set (120.4).

### 20.3 Authority boundary (normative — HIGH and MEDIUM identical)

Neither HIGH nor MEDIUM means approval or production authority.

Analyze **MUST NOT**:
- save mappings automatically  
- approve mappings automatically  
- set `supportState=validated`  
- bypass Managed readiness / parity (120.2-AP)  
- change Digital Home eligibility  
- bypass target-safety / Managed eligibility validation  

Flow remains:
```text
Analyze → Admin reviews/corrects → Admin Save → Admin Approve → Managed parity/readiness → validated
```

MEDIUM increases useful Admin information only.

### 20.4 Phase 118 impact
| Prior Phase 118 rule | Disposition |
|---|---|
| Prefill **only** final `high` (AC-118-7; editor “medium/low empty”) | **Superseded for Admin authoring prefill** by §20.2 — MEDIUM may prefill with distinct presentation |
| D-118-8 semantic HIGH without mandatory lexical match | **Unchanged** — do **not** artificially downgrade strong semantics because opaque `fieldId` ≠ DOM id/name |
| D-118-10 human persistence authority | **Unchanged** — Save/Approve/`validated` remain Admin-only |
| D-118-7 layers 1–2 (model + safety) | **Unchanged** |
| D-118-9 no invented locators | **Unchanged** |

### 20.5 120.8 Blind-ID fixture extension (mandatory in amended DD)
Retain POS/NEG from §19.4 / Manager §6.

**Additionally** — positive path may include a field whose post-safety confidence is **MEDIUM** (e.g. `credential_c` business/account identifier with related but non-decisive page evidence):

| Expectation | |
|---|---|
| Proposal preserved (not discarded) | Yes |
| Locator may prefill for Admin review | Yes |
| UI marks MEDIUM clearly; review required | Yes |
| No auto-save / approve / `validated` / DH eligibility change | Yes |
| Strong semantic evidence may still be HIGH without fieldId↔DOM lexical affinity | Yes (D-118-8 + 120.8 identity decoupling) |

NEG fixture unchanged: opaque IDs + no distinguishing semantics → **no** HIGH/MEDIUM invention / no prefill.

### 20.6 Scope / non-goals
- Authoring Analyze UI + prefill policy + Agent confidence presentation only  
- **Not** Managed Runtime, 120.6, 120.7, Digital Home, activate gate  
- **Not** a new phase/slice  

### 20.7 Manager obligation
**Manager MUST amend** `manager-phase120.md` Slice **120.8** to incorporate §20 **before** Developer handoff. Architecture previously ACCEPTED 120.8 DD remains base; **§20 supersedes** HIGH-only prefill portions. **120.8-impl authorized only against the amended DD.**

### 20.8 Tests / regressions (for amended DD / impl evidence)
- Prefill HIGH + MEDIUM (empty slots only); LOW/rejected empty  
- UI distinguishes HIGH vs MEDIUM; MEDIUM shows review-required affordance  
- No auto-save / supportState / DH eligibility from Analyze  
- Blind-ID POS: opaque IDs + label/type; may assert MEDIUM preserved+prefilled; may assert HIGH without fieldId lexical affinity  
- Blind-ID NEG: no invented prefill  
- Phase 118 safety / eligibility / invented-locator regressions remain PASS  

---

## Architect Review (§20)
ARCHITECT_REVIEW_STATUS: **§20 MEDIUM-prefill amendment PASS**; **120.8 DD must be Manager-amended**; **120.8-impl AUTHORIZED only vs amended DD**; Final Acceptance **OPEN/PENDING**; **120.6/120.7 CLOSED**

### Review Notes
2026-09-22 — Owner authoring UX amendment accepted. Analyze remains non-authority; MEDIUM post-safety may prefill with mandatory visual/review distinction; LOW/rejected stay empty. Supersedes Phase 118 HIGH-only prefill for Admin form only. Fits 120.8 pre-impl amendment — no new slice.

### Required Corrections
_None architectural._ Manager must amend 120.8 DD to bind §20 before Developer starts.

### Exact next step
**Manager:** Amend 120.8 DD (§20). **STOP** Developer until amended DD ready. Then Developer **120.8-impl** against amended DD only.

---

## 21. Architecture evidence review — 120.8-impl (2026-09-22)

**Verdict: PASS / ACCEPTED / CLOSED**

Inspected source (not summary alone): `mockProvider.ts` default path, Edge prompt, `safetyValidation.ts` / `applyConfidentPrefill`, `fieldAuthoring.ts` (E1–E3), `validatedProfile.ts` parse/serialize/clear, `AutofillProfileEditor.tsx` + CSS chips, `managedAutofill.ts` isolation, `verifyPhase120IdentityAuthoring.mjs` (re-run **PASS** A–K), regressions 118 / 120.5 / 120.7 **PASS**.

| Gate | Result |
|---|---|
| 1 Identity decoupling (default + Edge) | **PASS** — password/label affinity without fieldId tokens; prompt opaque; Blind POS opaque IDs |
| 2 HIGH/MEDIUM/LOW prefill + Hebrew/color | **PASS** — Section 20; MEDIUM review hint; no authority |
| 3 Persisted `fieldAuthoring` facts | **PASS** — sibling bag; Save/serialize/reload; no colors persisted |
| 4 Provenance transitions | **PASS** — Analyze / Visual SAME|DIFF / manual / Clear |
| 5 Admin Test independent | **PASS** — no MEDIUM→HIGH; configVersion bind; temps memory-only |
| 6 E1–E3 authoring-only | **PASS** — `visualTargetsEquivalent`; runtime untouched |
| 7 Runtime isolation | **PASS** — `managedAutofill.ts` has zero `fieldAuthoring` |
| 8 Blind-ID POS/NEG | **PASS** — verify A/B/J |
| 9 Regressions / genericity | **PASS** — 118/120.5/120.7; no site branches; no vault migration |

**Residual (non-blocking):** non-default mock scenarios `lexical_exact` / `semantic_non_lexical` still script fieldId-keyed fixtures for legacy Phase 118 ACs — **not** used by default live path or Edge. Optional later hygiene.

### Live Owner acceptance — AUTHORIZED
Suggested sequence: Admin service with opaque or conventional IDs → Analyze → confirm HIGH/MEDIUM chips (Hebrew+color) → Save → refresh/relogin reconstruct → optional Visual SAME/DIFF → optional Admin Test (MEDIUM stays MEDIUM + נבדק בהצלחה) → Clear → provenance gone. Then continue Final Acceptance matrix as planned.

**SUPERSEDED:** Live Owner acceptance **completed PASS** — see **§23**.

Final Phase 120 Acceptance remains **OPEN / PENDING**.

---

## Architect Review (§20 / §21)
ARCHITECT_REVIEW_STATUS: **120.8-impl PASS / ACCEPTED / CLOSED**; LIVE OWNER ACCEPTANCE **PASS** (§23); Final Acceptance **OPEN/PENDING**; **120.6/120.7 CLOSED**

### Review Notes
2026-09-22 — Source + verify A–K evidence review PASS against amended 120.8 DD / §19 / §20.

### Required Corrections
_None blocking._

### Exact next step
**Owner:** live acceptance completed — see §23. Final Acceptance remains **OPEN / PENDING**. No new capabilities.

---

## 22. Investigate — credential schema Save vs Autofill CSS coupling (2026-09-22)

**Scope:** Investigation only. Triggered during live 120.8 Blind-ID acceptance when Admin saw CSS-required errors while editing credential fields.

### 22.1 Classification

**AUTHORING_CONTRACT_DEFECT** (primary) + **EXPECTED_CONSTRAINT** (narrow).

| Layer | Finding |
|---|---|
| Credential schema Save (`RegistryAdmin.handleSave` → `login_fields`) | **Not** gated by Autofill structural validation — main **«שמור»** only disables while `saving` |
| Autofill mapping Save (`AutofillProfileEditor` → `validateAutofillProfileStructural`) | **Expected** to reject incomplete Managed profiles (empty locators / missing required mappings) |
| Observed Hebrew errors | Emitted **only** by Autofill structural validation / Autofill panel — not by CredentialFieldsEditor |
| Defect | Same Admin surface co-locates schema editor + Autofill editor; Autofill always materializes **one mapping row per schema field** (often empty) and surfaces CSS-required errors as if they block schema authoring; no clean “schema saved, mappings not configured yet” state; schema ID changes do **not** auto-invalidate stale autofillProfile |

**Not:** Managed Runtime / 120.6 / 120.7 clear semantics / Digital Home eligibility defect.

### 22.2 Exact root cause / save path

```text
Credential schema Save:
  RegistryAdmin.handleSave
    → updateGlobalRegistryRow({ login_fields, credential_mode, … })
    → does NOT call validateAutofillProfileStructural
    → does NOT require CSS locators

Autofill mapping UI (always when credential_fields + global row):
  AutofillProfileEditor
    → fieldMappings = fields.map(f => ({ fieldId: f.id, locator: locators[f.id] || '' }))
    → validateAutofillProfileStructural(fieldMappings, login_fields)
         → emptyLocator: "יש להזין בורר CSS לכל שדה ממופה."
         → missingRequiredMapping: "יש למפות בורר CSS לכל שדה כניסה נדרש."
    → canSave Autofill only if structural.ok OR (all locators empty && existing profile → clear path)
    → Analyze / Visual do NOT require structural.ok
```

Error strings live in `AUTOFILL_PROFILE_ERROR` (`validatedProfile.ts`).

### 22.3 Answers

1. **Which save?** Autofill **«שמור מיפוי»** / Autofill structural gate — not schema **«שמור»** (unless Operator conflates the two controls on the same page).  
2. **Schema persistence through Autofill structural?** **No.**  
3. **Empty locator treated invalid during schema-only authoring?** Autofill UI **yes** (displays error; blocks Autofill save when incomplete). Schema save **no**.  
4. **Schema identity change vs mappings?** Old `fieldMappings` / `fieldAuthoring` keyed by prior IDs become stale/orphan; vault credential map keys under old IDs are **not** migrated. Today: login_fields-only update does **not** auto-clear autofillProfile. Desired: invalidate mappings/provenance/validation (clear or not_configured + configVersion bump) when active field-id set changes.  
5. **May Rivhit field IDs be changed?** **No — not safe** for Blind-ID. `field.id` is the vault/encrypted credential key (`ID_CHANGE_WARNING`). Renaming orphans stored values; no copy to new IDs.  
6. **Classification:** **AUTHORING_CONTRACT_DEFECT** (lifecycle/UX coupling) with **EXPECTED_CONSTRAINT** that incomplete Managed Autofill profiles cannot be saved as complete mappings.

### 22.4 Does this block 120.8 live acceptance?

**Does not block** if Blind-ID uses a **fresh synthetic service** created with opaque IDs from the start.  
**Blocks / misleads** if Operator tries to rename Rivhit IDs or treats Autofill CSS errors as a schema-save hard stop.

Analyze remains available with empty locators (`canAnalyze` independent of `structural.ok`).

### 22.5 Smallest generic correction (later; no impl now)

1. Autofill panel: treat “no locators yet” as **not_configured / incomplete mapping** hint — not schema-save failure; do not imply CSS is required to define credentials.  
2. On `login_fields` id-set change: auto-invalidate Managed mappings + `fieldAuthoring` + validation (clear path / not_configured + configVersion) — never silent vault rewrite.  
3. Keep structural CSS requirements **only** for persisting a non-empty Autofill mapping profile / activate path.  

**Manager DD required** before implementation of (1)–(2).

### 22.6 Recommended Blind-ID live procedure (safe)

**Do not rename Rivhit `username` / `password` / `business_id`.**

1. Create **new** Global Admin test service (synthetic Login Entry).  
2. Credential mode = credential_fields with opaque IDs from creation:  
   `credential_a` / `credential_b` / `credential_c`  
   labels: שם משתמש / סיסמה / עוסק מורשה; types text / password / text.  
3. Main form **«שמור»** (schema only) — no CSS required.  
4. Autofill panel may still show incomplete-mapping messages — ignore for schema step; **Analyze** (or Visual) to propose locators.  
5. **«שמור מיפוי»** after HIGH/MEDIUM proposals; optional Admin Test; refresh/relogin for provenance.  
6. Keep Rivhit production config undisturbed for Final Acceptance elsewhere.

### 22.5 Phase impact
Final Phase 120 Acceptance **OPEN / PENDING**. 120.8-impl remains **ACCEPTED**. No implementation in this investigation.

---

## Architect Review (§22)
ARCHITECT_REVIEW_STATUS: **§22 COMPLETE — AUTHORING_CONTRACT_DEFECT** (residual; **not** reopening 120.8); Blind-ID live **PASS** via fresh service (§23); Final Acceptance **OPEN/PENDING**

### Review Notes
2026-09-22 — CSS errors are Autofill structural completeness, not schema Save. Schema/Autofill concerns incorrectly co-presented. Vault keys make Rivhit ID mutation unsafe for Blind-ID. Live Blind-ID later used fresh service (§23).

### Required Corrections
_None for 120.8._ Optional later Manager DD: incomplete-mapping UX + schema id-set autofill invalidation.

### Exact next step
**Owner:** 120.8 live acceptance **PASS** (§23). Residual §22 stays open as non-blocking authoring debt. Final Phase 120 Acceptance remains **OPEN / PENDING**.

---

## 23. Final Live Owner Acceptance — Slice 120.8 (2026-09-22)

**120.8 LIVE OWNER ACCEPTANCE: PASS**

120.8-impl remains **Architecture ACCEPTED / CLOSED**. Slice **120.8 remains CLOSED**. Do **not** reopen 120.8. Do **not** close overall Phase 120.

### 23.1 Rivhit — live HIGH/MEDIUM presentation — **PASS**

Existing Rivhit service analyzed after 120.8:

| Field | Locator | Confidence | Presentation |
|---|---|---|---|
| `username` | `#username` | HIGH | Hebrew HIGH + green |
| `password` | `#password` | HIGH | Hebrew HIGH + green |
| `business_id` | `#osek` | MEDIUM | **«ביטחון בינוני · דורש בדיקת מנהל»** + orange |

MEDIUM was **prefilled** and available for Admin review (supersedes Phase 118 HIGH-only discard).

### 23.2 Provenance persistence — **PASS**

- After Save + Admin page refresh: HIGH and MEDIUM indicators reconstructed (including `#osek` MEDIUM).  
- After Admin logout + login: confidence/provenance presentation remained.

### 23.3 Admin Managed Autofill Test — **PASS**

- Temporary fake values for all three Rivhit fields → **«כניסה לאתר ומילוי שדות»** → all three controls filled correctly (including MEDIUM Osek).  
- After return / new Admin session: AI confidence unchanged; Osek remained MEDIUM/orange; independent **«נבדק בהצלחה»**.  
- Successful Admin Test **did not** rewrite MEDIUM → HIGH.

### 23.4 Blind-ID live acceptance — **PASS**

Fresh test service created (Rivhit login experience reused; **no** mutation of Rivhit vault field IDs).

Opaque schema from creation:

| fieldId | label | type |
|---|---|---|
| `credential_a` | שם משתמש | text |
| `credential_b` | סיסמה | password |
| `credential_c` | עוסק מורשה | text |

Field IDs contained **no** username/password/business vocabulary.

Analyze: mapped all three semantics; business/Osek remained MEDIUM and usable; mappings saved.

Admin Managed Autofill Test: all three opaque-ID values filled correct website controls (`credential_c` → Osek).

**Live proof:** Analyze does **not** require meaningful `fieldId` spelling; label/type + page evidence suffice.

### 23.5 Digital Home scope — **not a 120.8 failure**

Fresh duplicate test service did **not** appear as an addable Digital Home service — expected interaction with duplicate/service-identity rules. Do **not** weaken duplicate prevention for fixtures.

Runtime evidence already sufficient for 120.8:

| Evidence | Path |
|---|---|
| A | Existing real Rivhit — Digital Home Managed Autofill three-field fill (prior live) |
| B | Fresh Blind-ID — Admin Test → same Managed engine → three-field fill (this acceptance) |

Do **not** claim the synthetic service itself was Digital Home tested. No additional synthetic DH fixture required for 120.8.

### 23.6 Specifically accepted live

- identity ≠ meaning  
- opaque field IDs work  
- HIGH proposals prefill  
- MEDIUM proposals prefill  
- confidence text/color presentation  
- MEDIUM remains explicitly review-required  
- persisted provenance survives refresh  
- persisted provenance survives logout/login  
- Admin Test success persists independently  
- successful test does not promote MEDIUM to HIGH  
- no existing stable ID migration required  
- no Managed Runtime redesign required  

### 23.7 Residual finding (retained; not in this slice)

§22 **AUTHORING_CONTRACT_DEFECT** (+ narrow EXPECTED_CONSTRAINT): credential-schema authoring and Autofill mapping presentation/validation on the same page can mislead when mappings are incomplete.

Do **not** implement as part of 120.8. Do **not** reopen 120.8. Manager DD later if Owner elevates.

### 23.8 Phase 120 Final Acceptance status

| Item | Status |
|---|---|
| Slice 120.8 | **CLOSED** — live Owner acceptance **PASS** |
| Final Phase 120 Acceptance | **OPEN / PENDING** |
| Remaining before overall Phase 120 close | Complete Final Acceptance Matrix (incl. deferred **120.3.3** representative evidence and any other open matrix gates); residual §22 is **non-blocking** authoring debt unless Owner elevates |

---

## Architect Review (§23)
ARCHITECT_REVIEW_STATUS: **120.8 LIVE OWNER ACCEPTANCE PASS**; Slice **120.8 CLOSED**; Final Phase 120 Acceptance **OPEN/PENDING**

### Review Notes
2026-09-22 — Owner live evidence recorded: Rivhit HIGH/MEDIUM + provenance persist + Admin Test independence + Blind-ID fresh opaque service Analyze+Admin Test. DH synthetic absence out of scope. §22 residual retained.

### Required Corrections
_None for 120.8._

### Exact next step
**Owner:** proceed with remaining Phase 120 Final Acceptance Matrix items. Do **not** close Phase 120 until the full matrix is satisfied. Do **not** reopen 120.8.

---

## 24. Phase 120 Final Acceptance Matrix (2026-09-22)

**Status:** Matrix **COMPLETE**. Phase 120 **FORMALLY CLOSED** (§27, 2026-09-22).  
**Binding:** D-120-9 / D-120-10 / D-120-11 — fixtures ≠ architecture; representative ≠ exhaustive; generic capabilities only.  
**No** new capabilities claimed. Closed slices not reopened.

### 24.0 Classification legend

| Class | Meaning |
|---|---|
| **PASS** | Already satisfied by recorded Architecture / Owner / verify evidence |
| **LIVE TEST REQUIRED** | Owner must perform a specific live action still missing |
| **EVIDENCE GAP** | Engineering report/verify still required |
| **BLOCKED** | Defect prevents acceptance |
| **DEFERRED / NON-BLOCKING** | Explicitly outside Phase 120 closure |

Named websites below are **validation fixtures only**.

---

### 24.1 Closed-slice evidence (reuse — do not retest)

| ID | Gate | Class | Exact evidence |
|---|---|---|---|
| FA-120.1 | Runtime inventory complete | **PASS** | §4 Architect Review; manager inventory AC-120.1-1…7 |
| FA-120.2 | Config-only Managed migration pilot | **PASS** | §5–§6; Shufersal fixture P1/P3/AP/P4 Owner live **PASS** 2026-09-22 |
| FA-120.2-AP | Managed-parity activate gate | **PASS** | Slice CLOSED; activate requires probe (not UI-confirm alone) |
| FA-120.3.0 | Convergence inventory / decision tree | **PASS** | §9 ACCEPTED |
| FA-120.3.1 | Disposition / enforceable plan | **PASS** | Architecture PASS / ACCEPTED |
| FA-120.3.4 | Adapter→generic gap analysis | **PASS** | §10 + Owner clarification §10.8 |
| FA-120.3.5 | Generic capability boundary | **PASS** | §11 / D-120-11 ACCEPTED |
| FA-120.3.6 | Dedicated site-adapter debt removal | **PASS** | §12 Packages A/B; practice retained by design |
| FA-120.4 | Shared Managed target eligibility | **PASS** | 120.4-impl ACCEPTED/CLOSED; three-state + shared `isSafeFillTarget` |
| FA-120.5 | Admin Managed Autofill Test harness | **PASS** | 120.5-impl CLOSED; live Admin Test on Rivhit + Blind-ID (§23.3–§23.4); D-120-12/13 |
| FA-120.6 | Visibility / occlusion correction | **PASS** | 120.6-impl CLOSED; subsequent Rivhit Managed/Admin fill success implies V8 path live |
| FA-120.7 | Persistent Clear Mapping | **PASS** | 120.7-impl CLOSED; Owner cleared persisted Rivhit mappings + refresh empty (§19 context) before re-Analyze |
| FA-120.8 | Identity≠meaning + HIGH/MEDIUM + provenance | **PASS** | §23 LIVE OWNER ACCEPTANCE **PASS** |

---

### 24.2 Deferred 120.3.3 — Representative Config-Only Managed Convergence (RESOLVED INTO MATRIX)

**Intent (D-120-10):** Prove **generic** config-only Managed Autofill for supported simple login experiences via **sufficient representative fixtures** — **not** migrate/test every catalog service.

**Unsupported by design / out of Phase 120 (do not require):** modal activation, multi-step, iframe, Shadow DOM, auto-submit, first-match fallback.

#### Minimum representative capability set

| Cap | Required proof | Fixture evidence (reuse) | Class |
|---|---|---|---|
| **R1** Simple top-document Managed fill | DH or Admin Test → correct fill; manual submit | Shufersal DH P4; Rivhit DH (prior + §23); Meuhedet/Spotify DH (Phase 119.2) | **PASS** |
| **R2** Dynamic / arbitrary stable field IDs | Schema ≠ DOM vocabulary; opaque IDs OK | Meuhedet Case C (`id_number`/`mobile_number`); **120.8 Blind-ID** `credential_a|b|c` (§23.4) | **PASS** |
| **R3** Delayed-input readiness (bounded) | Analyze/runtime waits then succeeds | Hapoalim readiness (119.3); Shufersal P4 after wait | **PASS** |
| **R4** Authoring Analyze and/or Visual | HIGH/MEDIUM or Visual → Save → Managed | Rivhit Analyze §23; Meuhedet/Spotify Visual 119.2; Blind-ID Analyze §23.4 | **PASS** |
| **R5** Deterministic Managed runtime | exact-one / fail-closed / shared engine | Phase 117 + 120.4/120.5/120.6 contracts + live fills | **PASS** |
| **R6** No silent legacy fallback after Managed selected | Managed fail closed; no generic fill | Shufersal P4 investigation (Managed fail-closed observed); orchestrator Managed-first when validated | **PASS** |
| **R7** Manual submit only | No auto-submit | Binding Phase 117/120; harness AC; live paths | **PASS** |
| **R8** No dedicated website adapter dependency | Config-only Managed for fixtures | 120.3.6 adapter stack removed; Shufersal/Rivhit/Meuhedet/Spotify Managed without site adapters | **PASS** |

**FA-120.3.3 overall: PASS** (composite evidence). No additional live fixture required unless Owner rejects evidence reuse.

---

### 24.3 Legacy / convergence residual mechanisms

| Mechanism | Disposition | Closure impact |
|---|---|---|
| Practice adapter (`POC_FILL_DEMO`) | **C — development-only / non-blocking** | Explicitly retained; not production DH |
| Legacy generic (`POC_GENERIC_FILL`) for non-Managed services | **B — retained temporary migration debt** | Allowed until dependents migrated; **not** Phase 120 blocker (D-120-10 / §11.3) |
| Medium allowlist / identity-first | **B — explicit temporary exception** | Multi-step unsupported generically; do not expand hosts; **not** closure blocker |
| Login Intelligence complex → open-only | **B — retained operational unsupported signaling** | Aligns with explicit UNSUPPORTED; **not** blocker |
| Empty legacy adapter map / retired HTZone stack | **PASS / removed** | 120.3.6 |
| POC Hub named helpers | **C / DEV debt** | Non-blocking |

**No remaining reachable legacy mechanism is classified A (Phase 120 closure blocker)** under current architecture.

---

### 24.4 Production Readiness (separate from Phase 120 architecture closure)

| Item | Class |
|---|---|
| Separate TEST/DEV vs Production backend/projects | **DEFERRED / NON-BLOCKING** (ops) |
| D-118-13 provider/security data-handling review (unrestricted production Admin Analyze) | **DEFERRED / NON-BLOCKING** (production readiness; Phase 118 carry) |
| Autofill health monitoring / mapping drift | **DEFERRED / NON-BLOCKING** (reserved; not authorized) |
| Extension onboarding/health/version visibility | **DEFERRED / NON-BLOCKING** (ops) |
| 120.FSC Fresh Service Creation | **DEFERRED / NON-BLOCKING** — **RESERVED / NOT AUTHORIZED**; not required for Phase 120 close |

---

### 24.5 Residual non-blocking Phase 120 debt

| Item | Class | Notes |
|---|---|---|
| §22 schema↔Autofill incomplete-mapping UX | **DEFERRED / NON-BLOCKING** | AUTHORING_CONTRACT_DEFECT; Manager DD later; **do not reopen 120.8** |
| Analyze empty-HIGH toast / no-overwrite presentation (§18 + Bank Hadoar 2026-09-22) | **DEFERRED / NON-BLOCKING** | Existing filled locators can block proposal apply while UI may show “no mappings”; **not** a 120.9 regression |
| Non-default mock `lexical_exact` / `semantic_non_lexical` fieldId fixtures | **DEFERRED / NON-BLOCKING** | Test-only residual (§21) |
| Exhaustive catalog migration onto Managed | **DEFERRED / NON-BLOCKING** | Explicitly out of scope (D-120-10) |
| Practice development/POC path | **DEFERRED / NON-BLOCKING** | §24.3 C — retained by design |
| Retained legacy generic dependents | **DEFERRED / NON-BLOCKING** | §24.3 B — temporary migration debt |
| Retained medium / identity-first exception | **DEFERRED / NON-BLOCKING** | §24.3 B — do not expand |
| Retained Login Intelligence complex/open-only | **DEFERRED / NON-BLOCKING** | §24.3 B — explicit UNSUPPORTED signaling |
| Future generic capabilities (modal / multi-step / iframe / Shadow DOM) | **DEFERRED / NON-BLOCKING** | Explicitly **not implemented**; out of Phase 120 |

---

### 24.6 Final gates (CLEARED — 2026-09-22)

| ID | Gate | Class | Evidence |
|---|---|---|---|
| **FA-120.9** | Authoring Locator Verification Integrity | **PASS** | §27 — Owner live L1–L4 **PASS**; automated R1–R15 Architecture ACCEPTED |
| **FA-CLOSE-1** | Owner formal acceptance of Final Acceptance Matrix | **PASS** | Owner ACCEPT MATRIX (pre-freeze) + FINAL CLOSURE REVIEW 2026-09-22 post-120.9 |
| **FA-CLOSE-2** | DH Managed smoke | **PASS** | Prior validated Rivhit DH three-field fill + no auto-submit; reconfirmed by **L4** Shufersal DH fill + no auto-submit |

**OPEN mandatory gates remaining: 0.**

---

### 24.7 Explicit Phase 120 closure criteria

Phase 120 may be formally **CLOSED** only when **all** are true:

1. FA-120.1 … FA-120.8 = **PASS** — **satisfied**.  
2. FA-120.3.3 R1–R8 = **PASS** — **satisfied**.  
3. **FA-CLOSE-1** = Owner **ACCEPT MATRIX** — **satisfied**.  
4. **FA-CLOSE-2** = **PASS** — **satisfied**.  
5. FA-120.9 / §25 disposition = **PASS** — **satisfied** (§27).  
6. No **BLOCKED** / **EVIDENCE GAP** rows remain — **satisfied**.  
7. No new capability work claimed as Phase 120 scope — **satisfied**.  
8. `PHASE.md` remains `PHASE=120` until Owner initiates next phase (Architect does **not** auto-advance to 121).

**After CLOSE:** residual §22 / Analyze UX / production-readiness / 120.FSC / legacy generic+medium / unsupported future capabilities remain as **post-120** work — they do **not** reopen Phase 120 unless Owner elevates.

---

### 24.8 Counts (summary — final)

| Class | Count |
|---|---|
| **PASS** (mandatory) | **24** (§24.1: 13 + §24.2: 8 + FA-120.9 + FA-CLOSE-1 + FA-CLOSE-2) |
| **LIVE TEST REQUIRED** | **0** |
| **EVIDENCE GAP** | **0** |
| **BLOCKED** | **0** |
| **DEFERRED / NON-BLOCKING** | retained (§24.4 Production Readiness + §24.5 debt) — **not** closure blockers |

Legacy residuals in §24.3 remain **accepted dispositions** (B/C) — **0** closure blockers.

---

## Architect Review (§24 — historical; superseded by §27)
ARCHITECT_REVIEW_STATUS: **Final Acceptance Matrix COMPLETE**; Phase 120 **FORMALLY CLOSED** (see §27)

### Review Notes
2026-09-22 — Matrix defined; later frozen by §25/120.9; 120.9 live L1–L4 cleared the freeze. FA-CLOSE-1/2 PASS. Deferred Production Readiness and authoring UX debt retained explicitly.

### Required Corrections
_None._

### Exact next step
See §27 — Phase 120 CLOSED. Do **not** start Phase 121 from this review.

---

## 25. Investigation — Visual Mapping “verified” with non-deterministic locator (2026-09-22)

**Scope:** Investigation only. **NO implementation. NO Manager DD. NO locator edits. NO site-specific logic.**

**Live evidence (Shufersal fixture — Final Acceptance):**
- Saved: `username`→`#j_username` HIGH + visual verified; `password`→`#j_password` HIGH + visual verified  
- Admin Test: `targets_not_ready · password · multi_match · #j_password`  
- Managed runtime fail-closed = **correct** (do not weaken exact-one)

**Historical evidence (120.2):** `#j_password` multi_match; Visual then produced `input[name="j_password"]` which passed parity/live fill.

**Phase 120 Final Closure:** historically **FROZEN** by this finding; **CLEARED** by §27 after 120.9 live L1–L4 PASS (2026-09-22).

---

### 25.1 Exact Visual Mapping code path (current)

```text
Admin «מיפוי חזותי»
  → Hub startVisualMappingForField
  → Ext ADMIN_VISUAL_MAPPING_START (background openPageAndVisualMapping)
  → inject generic/visual-target-pick.js (top document / MAIN world)
  → armVisualTargetPick({ expectedOrigin, fieldId })
  → Admin click (capture-phase; preventDefault)
  → isIdentifiableControl(el)          // identification ≠ eligibility
  → buildCandidates(el)                // ordered: #id, tag[name], autocomplete, aria
  → preferExactOneLocator(candidates, document)
       // first candidate with querySelectorAll(locator).length === 1
  → managedEligibleFor(el)             // shared ManagedTargetEligibility.isSafeFillTarget
  → ok:true { locator: chosen, locatorCandidates: full list, meta id/name }
  → Hub: if SAME effective target vs current form locator → KEEP current locator;
         else REPLACE with result.locator
  → applyVisualMappingAuthoring → visualMappingVerified=true (and may keep Analyze confidence)
  → UI chip «אומת במיפוי חזותי»
  → Persist only on Admin «שמור מיפוי»
```

Sources: `extension/generic/visual-target-pick.js`, `src/assistedMapping/visualMapping.ts`, `AutofillProfileEditor.requestVisualMapping`, `fieldAuthoring.visualTargetsEquivalent` / `applyVisualMappingAuthoring`.

---

### 25.2 Locator candidate generation and selection rules

**Generation (`buildCandidates`) — same family as Analyze inspect:**
1. `#` + CSS.escape(id) — hint `id` (**first**)  
2. `tag[name="…"]` — hint `name`  
3. `tag[autocomplete="…"]` — if not on/off  
4. `tag[aria-label="…"]` — truncated  

**Selection (`preferExactOneLocator`):** walk candidates in order; accept first with `document.querySelectorAll(locator).length === 1`; else fail `no_exact_one_locator`.

**Answers A–E:**

| Q | Answer |
|---|---|
| **A** Uniqueness before select? | **Yes** — at click time only (`preferExactOneLocator`) |
| **B** Exactly one element? | **Yes** — length === 1 at click time |
| **C** Same as clicked element? | **No explicit check** — does **not** assert `matches[0] === el` |
| **D** Same Managed eligibility? | **Yes** — `isSafeFillTarget` after locator choose; ineligible → fail (locator evidence only) |
| **E** Can `#id` outrank name when ID duplicated? | **At click time: No** — duplicate ID → length≠1 → skip to next. **After Hub SAME merge: Yes risk** — see §25.3 |

---

### 25.3 Meaning of «אומת במיפוי חזותי» (current)

`visualMappingVerified === true` means:

1. A Visual Mapping click completed successfully (`ok: true`), **and**  
2. Hub applied `applyVisualMappingAuthoring` (SAME or DIFFERENT path).

It does **NOT** currently mean:

- the **persisted form locator string** was re-validated as exact-one after merge, **or**  
- the locator equals Visual’s `preferExactOne` choice when SAME preserves a prior Analyze locator, **or**  
- uniqueness holds at Admin Test / activate / Digital Home time.

---

### 25.4 Critical authoring defect — 120.8 SAME (E2) + Analyze locator

`visualTargetsEquivalent` E2: SAME if Visual’s **full** `locatorCandidates` includes the **current** form locator (trim).

`preferExactOneLocator` returns `locatorCandidates: candidates` = **entire generated list**, including candidates that **failed** exact-one (e.g. `#j_password` when multi_match at click time).

**Provable failure sequence (matches Owner UI: HIGH + visual verified + `#j_password` + later multi_match):**

```text
1. Analyze proposes password → #j_password (HIGH) — candidate list prefers #id; no live uniqueness gate in Analyze safety
2. Prefill saves #j_password into form
3. Admin Visual Mapping clicks the intended password control
4. Extension may choose unique input[name="j_password"] via preferExactOne
   (or choose #j_password if unique at that instant)
5. Hub SAME via E2 because #j_password ∈ locatorCandidates for the clicked control
6. SAME → PRESERVE current #j_password (do not replace with unique name locator)
7. Stamp visualMappingVerified=true + keep Analyze HIGH
8. Admin Save / Admin Test → assessManagedTargetsReady → multi_match on #j_password
```

This is **TARGET IDENTIFICATION / click provenance** conflated with **LOCATOR DETERMINISM** of the **persisted** string.

**Historical vs current (`#j_password` vs `input[name="j_password"]`) — provable from code + timeline:**

| Era | Behavior |
|---|---|
| Pre-120.8 Visual success | Hub set locator to Visual’s **chosen** unique locator → `input[name="j_password"]` when `#id` failed exact-one at click |
| Post-120.8 SAME path | If Analyze already filled `#j_password` and E2 fires, Hub **keeps** Analyze locator while still showing visual verified |

DOM change alone is **not required** to explain the regression; the **120.8 SAME preserve** path is sufficient. DOM timing can still contribute if Visual alone selected `#j_password` during a transient unique window (late probes historically showed **persistent** multi_match — favors authoring-merge explanation when Analyze prefilled `#j_password`).

---

### 25.5 Analyze — semantic confidence vs locator determinism

| Layer | Behavior |
|---|---|
| Inspect `buildCandidates` | Emits `#id` first; **no** uniqueness filter |
| Safety validation | Locator ⊆ candidates; Managed eligibility on observed input; **no** `querySelectorAll` exact-one |
| Prefill HIGH/MEDIUM | Semantic/safety confidence on **field↔observed input**, not locator uniqueness |
| Result | HIGH may attach to `#j_password` even when that locator is / becomes multi_match |

**Conflation:** final `confidence: high` + prefilled CSS is presented as an approvable Managed locator without a separate **LOCATOR DETERMINISM** fact.

Invariant assessment (Owner proposed): **Consistent** with Phase 117 exact-one, 118 D-118-9 (locator from candidates), 119 Visual intent, 120.4 eligibility separation, 120.2-AP parity gate, and 120.8 provenance goals — **current Hub SAME E2 violates the spirit** of “visually verified ⇒ usable Managed locator.”

---

### 25.6 Runtime

Managed `assessManagedTargetsReady` / Admin Test fail on `multi_match` = **correct**.  
**Classification D (runtime defect): NO.**

---

### 25.7 Root-cause classification

| Code | Classification | Justification |
|---|---|---|
| **A** | Visual Mapping authoring contract defect | Missing `matches[0]===el`; success UI does not guarantee persisted locator is the unique chosen one |
| **B** | Analyze authoring contract defect | HIGH/prefill without locator exact-one determinism |
| **C** | Shared authoring defect (primary) | **120.8 E2 SAME preserves non-unique Analyze locator while stamping visual verified** |
| **D** | Runtime defect | **No** — fail-closed correct |
| **E** | Website/DOM change | **Possible contributing**, not required given C; historical late probes showed persistent multi_match |
| **F** | Insufficient evidence | **No** — code path is sufficient to explain |

**Primary: C** (with A+B contributing).

**Ownership / slice:** Authoring merge contract introduced/expanded in **120.8** (`visualTargetsEquivalent` E2 + preserve-on-SAME); Visual exact-one selection from **119.2**; Analyze candidate order from **118**; Managed exact-one from **117**. **Do not reopen 120.6.** Do not blame 120.6 visibility. **Do not reopen 120.8 as “identity decoupling failed”** — this is locator-determinism / SAME-merge, not fieldId semantics.

---

### 25.8 Phase 120 closure

| Item | Status |
|---|---|
| Closure blocked? | **YES — FROZEN** until Owner accepts disposition / correction path |
| §24 FA-CLOSE-1/2 | Must not complete overall CLOSE while §25 unresolved |
| 120.8 live acceptance §23 | Remains valid for identity/MEDIUM/provenance scope; **does not** waive this determinism defect |

---

### 25.9 Smallest GENERIC architectural correction (design only — NOT authorized to implement)

1. **Visual success persistence:** Persist / apply only a locator that passed exact-one **and** `matches[0] === clickedEl` at capture; never stamp `visualMappingVerified` on a different string.  
2. **SAME-target merge:** E2 must not treat “locator appears in candidates” as proof the **current** locator is deterministic. If current fails exact-one (or ≠ chosen unique), **DIFFERENT/replace** with chosen unique **or** fail honestly.  
3. **Analyze:** Separate semantic confidence from locator-determinism; do not prefill/HIGH-present a CSS string that fails exact-one when checkable; preserve identification without approvable Managed locator if none unique.  
4. **Shared contract:** Prefer one exact-one helper used by Visual choose, optional Analyze gate, and Managed assess (same document scope).  
5. **Regression:** Synthetic duplicate-id fixtures; no hostname/serviceId branches; no first-match; no Shufersal special case; 120.4 eligibility unchanged; failure honesty.

**Manager DD** only after Owner accepts §25 classification — **not** in this task.

---

### 25.10 Regression boundaries (must remain unchanged)

- Managed exact-one / fail-closed / no first-match  
- No silent Managed→generic fallback  
- No auto-submit  
- Shared Managed eligibility (120.4/120.6)  
- No site/hostname/serviceId Autofill branches  
- Schema-dynamic field IDs (120.8 identity decoupling)  
- Admin Test / DH share one Managed engine (D-120-12)

---

## Architect Review (§25)
ARCHITECT_REVIEW_STATUS: **§25 COMPLETE — PRIMARY C (shared authoring SAME/E2 + Analyze locator)**; runtime **correct**; Phase 120 closure **FROZEN**; **NO impl / NO DD yet**

### Review Notes
2026-09-22 — Traced Visual exact-one at click; Hub 120.8 E2 can preserve Analyze `#j_password` while stamping visual verified; Admin Test multi_match is correct Managed behavior. Historical name-locator success vs current id-locator matches this merge path.

### Required Corrections
_None in this investigation task._ Owner disposition next; then Manager DD for generic authoring fix if authorized.

### Exact next step
**Owner:** accept or correct §25 classification. Keep Phase 120 Final Closure **FROZEN**. Do not implement yet.

---

## 26. Slice 120.9 — Authoring Locator Verification Integrity (2026-09-22)

### Status
**AUTHORIZED — Manager Detailed Design ONLY.**  
**STOP after DD** for Architecture review.  
Developer implementation **NOT AUTHORIZED** until Architecture PASS on the 120.9 DD.

**Source:** §25 (Owner ACCEPTED root cause).  
**Classification:** **C** shared authoring defect + **A** Visual integration + **B** Analyze locator determinism.  
**Managed Runtime:** correct — **MUST NOT** be changed.

### Goal
A locator may be represented as **visually verified** only when the locator that is **actually persisted** has itself satisfied the deterministic Visual Mapping verification contract.

```text
Target identity equivalence  ≠  Locator equivalence / determinism
```

### Binding invariant (normative)

Visual Mapping already identifies the clicked target and selects a locator using exact-one validation.

After Visual Mapping succeeds:

1. The **persisted** locator must itself be proven **exact-one**.  
2. It must resolve to the **same clicked target**.  
3. It must satisfy the authoritative **Managed eligibility** contract (120.4/120.6).  

The **120.8 SAME / E1–E3** provenance logic **MUST NOT** allow an existing Analyze locator to survive merely because it appears in Visual Mapping candidate evidence.

Specifically forbidden implication:

```text
"existing locator ∈ target's locatorCandidates"
    ≠
"existing locator is deterministic and visually verified"
```

If Visual Mapping selects a **different verified unique** locator for the **same** target:

- preserve target identity / useful provenance appropriately, **and**  
- the persisted Managed locator **MUST** be the Visual **verified deterministic** locator.

Do **not** solve by restoring any historical Shufersal selector (`input[name="j_password"]` is fixture evidence only).

### Analyze (Manager must define smallest generic treatment)

- **Semantic confidence** and **locator determinism** are separate dimensions.  
- HIGH = confidence that the observed control corresponds to the credential field.  
- HIGH **MUST NOT** mean an unsafe/non-unique locator is suitable for Managed execution.  
- Define where generic locator determinism is checked before an Analyze proposal becomes an **approvable/persistable Managed locator**.  
- Preserve useful identification evidence when semantics are strong but determinism fails.  
- Do **not** weaken 120.8 HIGH/MEDIUM authoring semantics except locator **eligibility** for Managed persistence/prefill.

### Hard stops / must not change

| Forbidden | |
|---|---|
| Managed runtime exact-one / multi_match fail-closed | STOP — do not weaken |
| 120.4/120.6 Managed eligibility contract | STOP |
| Digital Home Managed selection / no-fallback / readiness | STOP |
| 120.8 fieldId opaque / semantic decoupling | STOP — not this defect |
| HIGH/MEDIUM confidence **meaning** (except locator eligibility) | STOP |
| Admin Test execution mechanism / approval/parity safety / no-auto-submit | STOP |
| Hostname / serviceId / Shufersal / Rivhit special cases | STOP |
| First-match / hardcoded selectors | STOP |
| Reopen 120.6 | STOP |
| Classify as failure of 120.8 identity decoupling | STOP |
| Accept 120.9 on unit tests alone | STOP — regression lock mandatory |

### Regression lock — automated (mandatory in DD)

Manager DD **MUST** define synthetic fixtures covering at minimum:

| ID | Contract |
|---|---|
| **R1** | Analyze locator exact-one |
| **R2** | Analyze semantic match with non-unique locator → no approvable unsafe Managed locator |
| **R3** | Visual Mapping unique selected locator |
| **R4** | SAME target + existing Analyze locator non-unique + Visual unique → **persisted = Visual unique** |
| **R5** | SAME target + existing locator independently proven deterministic → provenance truthful |
| **R6** | DIFFERENT target behavior from 120.8 remains correct |
| **R7** | Visual verification badge only for locator that actually satisfied Visual verification |
| **R8** | multi_match continues to fail closed in Managed runtime |
| **R9** | 120.4 managed eligibility regression |
| **R10** | 120.6 visibility/occlusion regression |
| **R11** | 120.8 opaque fieldId / semantic decoupling regression |
| **R12** | HIGH/MEDIUM persisted provenance regression |
| **R13** | Admin Test regression |
| **R14** | Clear Mapping regression |
| **R15** | Phase 117 deterministic Managed regression |

Existing relevant verification suites must remain **PASS**.

**120.9 MUST NOT be Architecture-accepted on new unit tests alone.**

### Live regression lock (after impl evidence)

Architect must **NOT** close 120.9 until Owner live verification is authorized.

Capability-based live checks (fixtures only; reuse; no unnecessary migrations):

1. Newly discovered duplicate-locator / SAME-merge case corrected.  
2. Existing normal HIGH Analyze case still works.  
3. 120.8 Blind-ID semantic case still works.  
4. Existing Managed runtime fixture still fills correctly with **no** submit.

### Phase 120 closure

Final Closure remains **FROZEN**.  
**120.9 is a mandatory Phase 120 closure blocker** until:

1. Architecture PASS on Manager DD  
2. 120.9-impl Architecture ACCEPTED  
3. Automated regression lock PASS (R1–R15 + existing suites)  
4. Required Owner live evidence PASS  

### 120.8 / 120.6 status

- **120.6:** CLOSED — do not reopen.  
- **120.8:** Historically accepted for identity/MEDIUM/provenance contracts — do not reopen as failed decoupling.  
- **120.9:** Corrects Analyze locator evidence + Visual exact-one selection + persisted authoring provenance integration.

---

## Architect Review (§26 / 120.9)
ARCHITECT_REVIEW_STATUS: **120.9 FORMALLY CLOSED / ARCHITECTURE ACCEPTED**; Phase 120 **FORMALLY CLOSED** (see §27); **120.6/120.8 identity CLOSED**

### Review Notes
2026-09-22 — DD PASS; 120.9-impl Architecture ACCEPTED (R1–R15); Owner live L1–L4 **PASS** (§27).

### Required Corrections
_None._

### Exact next step
See §27. Do **not** start Phase 121 from this review.

---

## 27. Phase 120 Formal Closure (2026-09-22)

### 27.1 120.9 LIVE OWNER ACCEPTANCE — **PASS**

| # | Result | Evidence (Owner) |
|---|---|---|
| **L1** | **PASS** | Shufersal: Analyze `#j_password` → Visual → persisted `input[name="j_password"]` + «אומת במיפוי חזותי» + Save; Admin Test filled username+password; prior `multi_match · #j_password` did not recur |
| **L2** | **PASS** | Rivhit synthetic: Analyze `#username`/`#password` HIGH, `#osek` MEDIUM; Save; Admin Test filled all three; no Visual required |
| **L3** | **PASS** | Same Blind-ID fixture: opaque field IDs; semantic mapping without fieldId affinity; Admin Test filled all three (L2+L3 shared execution) |
| **L4** | **PASS** | Shufersal Digital Home: username+password filled; **no** auto-submit; site waited for manual Login |

**Automated (prior Architecture ACCEPTED):** R1–R15 PASS; required suites PASS; `tsc` PASS; no deviations; Managed runtime / 120.4 / 120.6 / 120.8 identity unchanged.

**Non-blocking observation retained:** Bank Hadoar Analyze/no-overwrite presentation when locators already filled — §24.5 debt; **not** a 120.9 regression. `not_configured` DH absence expected.

### 27.2 Slice 120.9 — **FORMALLY CLOSED / ARCHITECTURE ACCEPTED**

Closure date: **2026-09-22**.

### 27.3 Final Acceptance Matrix — final state

| Class | State |
|---|---|
| FA-120.1 … FA-120.8 | **PASS** |
| FA-120.3.3 R1–R8 | **PASS** |
| FA-120.9 | **PASS** |
| FA-CLOSE-1 | **PASS** |
| FA-CLOSE-2 | **PASS** |
| BLOCKED / EVIDENCE GAP / LIVE TEST REQUIRED (mandatory) | **0** |

### 27.4 Accepted runtime / authoring architecture state

```text
Admin authors configuration (Analyze / Visual / Manual)
  → semantic confidence ≠ locator determinism
  → Visual verified ⇒ persisted locator is exact-one + same click + Managed-eligible
  → Admin validates (parity / Admin Test = same engine)
  → validated Managed definition is authoritative
  → one Managed Autofill runtime executes (exact-one / fail-closed / no first-match / no silent legacy fallback / no auto-submit)
  → no site/hostname/serviceId special production Autofill required for supported simple login
```

Legacy residuals (Practice / generic dependents / medium / LI complex) remain **explicit debt**, not target architecture.

### 27.5 PHASE 120 — **FORMALLY CLOSED / ARCHITECTURE ACCEPTED**

**Closure date:** 2026-09-22.

Mandatory closure criteria §24.7: **all satisfied**.

### 27.6 Retained Production Readiness gates / debt (explicit — NOT complete)

| Gate / debt | Status |
|---|---|
| Separate TEST/DEV vs Production backend/projects | **OPEN — Production Readiness** |
| D-118-13 provider/security data-handling (unrestricted production Admin Analyze) | **OPEN — Production Readiness** |
| 120.FSC Fresh Service Creation validation | **RESERVED / NOT AUTHORIZED** |
| Autofill health / mapping drift monitoring | **RESERVED / NOT AUTHORIZED** |
| Extension onboarding / health / version visibility | **OPEN — ops debt** |
| §22 schema↔Autofill Admin authoring UX | **DEFERRED debt** |
| Analyze no-overwrite / empty-result presentation UX | **DEFERRED debt** |
| Practice POC path; legacy generic; medium/identity-first; LI complex/open-only | **Retained temporary / explicit** |
| Future: modal activation, multi-step, iframe, Shadow DOM | **NOT implemented** |

### 27.7 Explicit non-actions

- Do **not** start Phase 121 from this closure record alone.  
- Do **not** implement Production Readiness items as part of Phase 120.  
- Do **not** claim unsupported future capabilities as shipped.  
- `PHASE.md` remains `PHASE=120` until Owner initiates next phase.

---

## Architect Review (§27 — FINAL)
ARCHITECT_REVIEW_STATUS: **PHASE 120 FORMALLY CLOSED / ARCHITECTURE ACCEPTED** (2026-09-22)

### Review Notes
Owner live L1–L4 PASS clears 120.9. FA-CLOSE-1/2 PASS. Full §24 matrix mandatory rows PASS. Deferred Production Readiness and authoring/legacy debt retained explicitly. No mandatory OPEN / LIVE / BLOCKED / EVIDENCE GAP remains.

### Required Corrections
_None._

### Exact next step
**STOP.** Phase 120 closed. Owner may later authorize Phase 121 or Production Readiness work separately. Do **not** auto-start either.

---

## 28. POST-120 Investigation — Visual Mapping “managed-ineligible” on apparently eligible input (2026-09-22)

**Status:** INVESTIGATION ONLY. Phase 120 remains **FORMALLY CLOSED** — **not reopened**.  
**Fixture:** Internet Rimon personal-area login (evidence only — **no** site-specific product requirement).  
**Out of scope:** route-selection capability, modal support, implementation, DD, Phase 121.

### 28.1 Owner live report

Hub message shown:

```text
השדה זוהה, אך אינו כשיר למילוי אוטומטי מנוהל.
```

No locator persisted/displayed. Clicked control (manual inspect):

| Property | Observed |
|---|---|
| tag | `INPUT` |
| name | `user_name` |
| type | `text` |
| disabled / readOnly | false |
| aria-hidden self / ancestor | null |
| clientRects | 1 |
| approx size | ~158.4 × 28 |
| computed | display block; visibility visible; opacity 1; pointer-events auto |
| V8-style 5-point `elementFromPoint` | **all five** → same `INPUT[name=user_name]` (`isTarget=true`) |

Page context: parallel login routes (password / SMS). Route-selection itself is **future** work — not attributed as the root cause without path evidence.

### 28.2 Exact Visual Mapping rejection path (repository)

```text
Admin Visual Mapping click (top document capture)
  → event.target (text node → parentElement)
  → isIdentifiableControl(el)     // A: identification
  → buildCandidates(el)           // id → name → autocomplete → aria only
  → preferExactOneLocator(...)    // C: first candidate with querySelectorAll.length === 1
  → assertLocatorDeterministic(chosen, el, doc)  // C: matches[0] === clickedEl
  → managedEligibleFor(el)        // B: ManagedTargetEligibility.isSafeFillTarget
       → isVisible + V8 hit-test
  → ok:true { locator }  OR  ok:false { reason, state }
  → Hub visualMapping.ts maps reason → Hebrew message
  → Admin UI shows result.message only (detail/reason not surfaced)
```

Sources: `extension/generic/visual-target-pick.js`, `managed-target-eligibility.js`, `src/assistedMapping/visualMapping.ts`, `AutofillProfileEditor.requestVisualMapping`.

### 28.3 Generated locator candidates (for this control shape)

Clicked element has **no `id`**, **name=`user_name`**, type text; Owner did not report `autocomplete` / `aria-label`.

| Candidate family | Expected for this click |
|---|---|
| `#id` | **absent** (no id) |
| `input[name="user_name"]` | **present** (primary / likely only candidate) |
| autocomplete / aria | **absent** unless attributes exist |

**Placeholder is not a candidate source** (current contract).

Exact-one for `input[name="user_name"]`:

| Condition | `preferExactOneLocator` |
|---|---|
| Exactly one match in top `document` | chooses that locator → continues to same-target + Managed eligibility |
| **≥2** matches (e.g. password route + SMS route both expose `name=user_name`) | returns **null** → Ext reason **`no_exact_one_locator`** |

Owner did **not** report live `document.querySelectorAll('input[name="user_name"]').length`. Parallel routes make **multi_match ≥ 2** the leading hypothesis for rejection **before** Managed eligibility runs.

### 28.4 Extension reject points that use state `IDENTIFIED_BUT_MANAGED_INELIGIBLE`

| Order | Ext `reason` | Meaning (architecture) | Dimension |
|---|---|---|---|
| 1 | `no_locator_candidates` | identified, no CSS candidates | **C** (generation) |
| 2 | `no_exact_one_locator` | identified, no exact-one candidate | **C** (determinism) |
| 3 | `locator_target_mismatch` | exact-one string ≠ clicked identity | **C** / Visual integrity |
| 4 | `managed_ineligible` + `detail` | `isSafeFillTarget` false | **B** (eligibility) |

Managed eligibility is evaluated **only after** steps 1–3 succeed. Owner’s manual V8 five-point PASS makes true **B** failure **unlikely** for the inspected node, but does not prove Ext did not later fail **B** on a different moment/element.

### 28.5 Hub message mapping (critical)

`VISUAL_MAPPING_MANAGED_INELIGIBLE_LABEL_HE` =
«השדה זוהה, אך אינו כשיר למילוי אוטומטי מנוהל.»

Hub assigns that **same** label when Ext reason is:

- `managed_ineligible` (**B**)
- `no_exact_one_locator` (**C**)
- `locator_target_mismatch` (**C**)
- `no_locator_candidates` when marked identified (**C**)

Existing unused authoring string:

```text
LOCATOR_NOT_DETERMINISTIC_LABEL_HE =
  "זוהה, אך הבורר אינו חד-משמעי למילוי מנוהל"
```

Admin UI displays **`message` only** — Ext `reason` / `detail` (e.g. `occluded`) are **not** shown.

**Therefore:** the Hebrew string Owner saw is **not proof** that Managed eligibility failed. It is consistent with **C** collapsing into a **B**-worded presentation.

### 28.6 Answers to Owner checklist

1. **Exact clicked target (Owner):** `INPUT[type=text][name=user_name]` — identifiable.  
2. **Generated candidates (inferred from code + attrs):** primarily `input[name="user_name"]`; no id/autocomplete/aria reported.  
3. **Exact-one:** **unknown live count** — if `querySelectorAll('input[name="user_name"]').length !== 1`, Ext rejects at `preferExactOneLocator` with `no_exact_one_locator`.  
4. **Managed eligibility result/subreason:** **not proven for this click**. Manual inspect implies would **PASS** V1–V3/V5–V8 for that node; Ext `detail` was not captured.  
5. **Reject point:** **insufficient live Ext reason**. Architecturally ordered: candidates → exact-one → same-target → **then** Managed eligibility. Leading evidence favors fail at **exact-one (C)** given dual-route naming; **B** not ruled out without Ext payload.  
6. **Hub message accuracy:** **NO** if failure was **C** — message asserts Managed ineligibility (B). **YES** only if Ext reason was truly `managed_ineligible`.  
7. **Classification:**
   - **E — Hub presentation/classification defect** — **CONFIRMED** (code): C reasons mapped to B Hebrew; distinct locator-not-deterministic string unused on Visual path; UI hides `reason`/`detail`.  
   - **B — locator-generation/determinism gap** — **LIKELY** for this fixture (name-only control + probable duplicate `user_name` across routes; no alternate unique candidate). Confirm with live matchCount.  
   - **A — expected unsupported capability** — **partial / conditional**: if page truly has only non-unique name and no id/autocomplete/aria, current candidate family cannot author a Managed locator without a new **generic** strategy — that is a post-120 capability/authoring limit, **not** a Rimon special case. Route-selection UI itself is separate future work.  
   - **C — Managed eligibility defect** — **NOT supported** by current evidence (manual V8 PASS).  
   - **D — Visual Mapping defect** (wrong element / wrong contract) — **NOT indicated**; identification occurred; order of gates is intentional.  
   - **F — timing/state** — **H / possible but unproven**.  
   - **H — insufficient evidence** — **YES** for definitive Ext reject reason of this click (need Ext `reason`, optional `detail`, `locatorEvidence`, and `querySelectorAll('input[name="user_name"]').length`).  
8. **Phase 120 impact:** **New post-120 finding.** Does **not** reopen or invalidate Phase 120 closure. Managed exact-one / eligibility contracts remain correct. Finding is authoring path honesty + possible locator-candidate sufficiency on multi-route duplicate-name pages.  
9. **Smallest generic architectural implication (no DD / no impl):** Keep **A/B/C dimensions separate** in Visual Mapping outcomes and Hub copy — do not report locator non-determinism as Managed ineligibility. Any later candidate enrichment must stay **generic** (no hostname/site branches); route-selection remains a separate future login-experience capability.

### 28.7 Optional Owner confirmations (evidence only — not implementation)

On the same page state as the Visual click failure:

1. `document.querySelectorAll('input[name="user_name"]').length`  
2. Extension / Hub response `reason` (and `detail` if present)  
3. Whether SMS-route controls also use `name="user_name"` (or other duplicate names)

### 28.8 Hard stops honored

No implementation. No Phase 120 reopen. No eligibility weaken. No Rimon/modal/route-selection design. No DD. No Phase 121 definition.

---

## Architect Review (§28)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION COMPLETE**; Phase 120 **remains CLOSED**; **no DD / no impl**

### Review Notes
Confirmed Hub collapse of locator-determinism Visual failures into Managed-ineligible Hebrew. Leading fixture hypothesis: non-unique `input[name="user_name"]` → `no_exact_one_locator`. True Managed eligibility failure not evidenced by Owner V8 checks. Need Ext `reason` + matchCount to lock root cause.

### Required Corrections
_None (investigation only)._

### Exact next step
**STOP.** Owner may optionally supply §28.7 evidence. Do **not** implement. Do **not** open DD until Owner elevates a post-120 slice.

---

## 29. POST-120 Investigation — Visual Mapping rejects Amex “last 4 digits” digit boxes (2026-09-22)

**Status:** INVESTIGATION ONLY. Phase 120 remains **FORMALLY CLOSED** — **not reopened**. Phase 121 **not opened**.  
**Fixture:** American Express Israel login (evidence only — **no** site-specific product requirement).  
**Out of scope:** Composite Credential Field design/impl; DD; Managed safety rule changes.

### 29.1 Owner live report

Hub message:

```text
האלמנט שנבחר אינו נתמך למיפוי. בחרו שדה קלט גלוי.
```

= `VISUAL_MAPPING_UNSUPPORTED_TARGET_LABEL_HE` ← Ext reason **`unsupported_target`** with state **`NOT_IDENTIFIED`** (Hub maps only when `identified` is false).

DOM: four visible `INPUT.otp-digit-input` (`type=tel`, unique `id`/`name` digit4-1…4, maxlength=1, aria-label digit N of 4). Top document; no Shadow DOM observed. DevTools sometimes selected surrounding **DIV**.

### 29.2 Exact Visual Mapping path (repository)

```text
click (capture)
  → el = event.target
  → if text node: el = parentElement   // ONLY normalization
  → isIdentifiableControl(el)
       FAIL → reason: unsupported_target, state: NOT_IDENTIFIED
  → (if PASS) buildCandidates → preferExactOne → assertLocatorDeterministic
  → managedEligibleFor (isSafeFillTarget)
  → Hub maps reason → Hebrew
```

**No** `closest('input')`, **no** associated-label→control, **no** wrapper→child INPUT normalization.

`isIdentifiableControl` allowlist:
- tag ∈ {input, textarea}
- type **rejects only**: hidden | submit | button | image  
- **`type="tel"` is allowed** for identification

`maxlength`, `inputmode`, class names, Angular handlers: **not consulted**.

### 29.3 Investigation A answers

| # | Finding |
|---|---|
| 1. Actual event target | **Not captured live.** Message proves Ext treated target as **non-identifiable**. Given four INPUTs are identifiable if clicked **directly**, evidence favors click landed on **wrapper/DIV (or non-input child)**, not the `INPUT` — consistent with DevTools selecting surrounding DIV. |
| 2. DIV/wrapper | Visual **intentionally** requires identifiable control on (normalized) event target. Text-node→parent only. **No** safe walk to related visible INPUT. |
| 3. `type="tel"` Visual | **Supported** for identification (not in reject list). |
| 4. Consistency | See §29.4 |
| 5. maxlength/inputmode/Angular | **Do not** cause Visual rejection. |
| 6. If INPUT evaluated directly | Would pass identification; then candidates `#digit4-N` / `input[name=digit4_N]` / aria → exact-one **likely PASS** (unique id/name); then Managed eligibility per V8. **Rejection would not be `unsupported_target`.** |
| 7. Hub message | **Accurate for `unsupported_target` / NOT_IDENTIFIED.** Does **not** mean Managed-ineligible or type=tel unsupported. |

### 29.4 type=`tel` across surfaces

| Surface | `tel` support |
|---|---|
| Visual identification | **Yes** (not rejected) |
| Analyze inspect (`collectSafePageStructure`) | **Yes** — included unless hidden/submit/button/image |
| Managed eligibility (`isSafeFillTarget`) | **Yes** — any non-hidden enabled `INPUT` + visibility/V8 (type not further restricted) |
| Admin Test / Managed runtime fill | **Yes** — same `isSafeFillTarget` + fill executor (no type=`tel` ban) |
| Legacy form-detector `isFillableInput` | **Yes** — explicit `tel` allow |

**No supported-input-type contract gap for `tel`.** Failure is **not** C (type gap).

### 29.5 Individual Managed eligibility (inferred)

For each digit INPUT (visible, sized, unique id/name, top doc): under current contracts, **individually** they should satisfy Managed eligibility **and** locator exact-one **if** that exact INPUT is the evaluated target. Owner did not re-run Ext eligibility on each; architecture does not evidence a type/maxlength reject.

### 29.6 Investigation B — Analyze does not map “last 4 digits”

Keep dimensions separate:

| Dim | Status for this fixture |
|---|---|
| **A** DOM observable | **Yes** — inspect includes `type=tel` inputs with id/name/aria |
| **B** Semantic credential ID | **Limited** — Agent contract: **one fieldId → at most one observedInputId**; schema typically one “last 4 digits” value, page has **four** physical controls labeled digit N of 4 |
| **C** Visual support | Click must hit INPUT; wrapper click → unsupported |
| **D** Managed eligibility | Per-input likely OK |
| **E** Locator determinism | Per-input likely OK (`#digit4-N` exact-one) |
| **F** Value distribution | **Unsupported** — no current capability to split one credential string across N inputs |

Analyze “does not discover/map” is primarily **B + F**, not “inputs invisible” and not Visual’s `unsupported_target`. Mock/agent password affinity also prefers `type=password`; digit boxes are `tel` — further reduces automatic identity↔password-style matching without proving LLM never sees them.

### 29.7 Composite field note

Possible future **Composite Credential Field** (one logical value → N physical INPUTs) is a **candidate capability** only.  
**Current Visual failure is independent:** Hub message is `unsupported_target` from non-identifiable click target, not “composite unsupported.” Fixing click-normalization would still leave Analyze/Managed unable to fill “1234” across four boxes without that new capability.

### 29.8 Classification

| Code | Verdict |
|---|---|
| **B** click-target normalization gap | **LIKELY / primary for Visual** — wrapper click → no INPUT resolution; code has no related-input walk |
| **A** Visual Mapping defect | **Narrow** — only if product expects wrapper clicks to bind; current code is intentional strictness, not a type bug |
| **C** supported-input-type gap (`tel`) | **No** |
| **D** Analyze semantic limitation | **Yes** — 1∶1 field↔input + multi-digit semantics |
| **E** Managed eligibility limitation | **No** for individual `tel` digits (inferred) |
| **F** locator determinism | **No** for individual unique ids (inferred) |
| **G** future composite-field capability | **Yes** — separate Phase 121+ candidate; not cause of this Visual message |
| **I** insufficient evidence | **Partial** — live `event.target` tagName at Visual click not logged |

### 29.9 CURRENT gap vs NEW capability

| Kind | Item |
|---|---|
| **Current accepted-capability gap** | Visual: no safe normalization from wrapper/label/hit to related fillable INPUT → misleading “unsupported” when INPUT exists underneath. (Presentation is accurate for Ext reason; UX may still surprise.) |
| **NEW capability candidate (Phase 121+)** | Composite Credential Field (1 logical → N physical inputs + distribution). Route/modal work remains separate. |

### 29.10 Phase 120 acceptance

**Does not threaten Phase 120.** Closed contracts assume top-document click on identifiable fillable control and 1∶1 Managed mappings. This is post-120 exploration evidence.

### 29.11 Hard stops honored

No implementation. No Phase 120 reopen. No Phase 121 architecture. No Amex/otp/digit special cases. No Managed safety weaken. No DD.

---

## Architect Review (§29)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION COMPLETE**; Phase 120 **CLOSED**; Phase 121 **not opened**

### Review Notes
Visual Hub message = `unsupported_target` / NOT_IDENTIFIED. `type=tel` is supported across Visual/Analyze/Managed. Leading cause: event target not the INPUT (wrapper), with no related-input normalization. Analyze gap is 1∶1 semantic + missing composite distribution — separate from Visual reject. Composite capability deferred.

### Required Corrections
_None (investigation only)._

### Exact next step
**STOP.** Optional: capture `event.target.tagName` during Visual click. Do **not** implement. Do **not** open Phase 121 architecture yet.

---

## 30. POST-120 Investigation — Bank Leumi Launch Card “autofill unavailable” + intermittent Admin Test (2026-09-23)

**Status:** INVESTIGATION ONLY. Phase 120 remains **FORMALLY CLOSED**. Phase 121 **not opened**.  
**Fixture:** בנק לאומי (`leumi`) — evidence only. **No** Leumi-specific product code authorized.

### 30.1 Owner report

1. **Admin** Managed Test (open + temporary fill): fields fill **intermittently**.  
2. **Digital Home** Launch Card shows MSG_MANUAL_ONLY (screenshot): autofill unavailable; copy + «פתח אתר».

### 30.2 Digital Home — exact path (CONFIRMED expected)

Hebrew on card = `MSG_MANUAL_ONLY` from `loginAssistance/messages.ts`.

Built-in catalog (`builtinCatalog.ts` `id: 'leumi'`):

- `metadata.loginAssistanceLevel: 'manual_only'` — **Phase 113 AC-113-17/19 Manual Login Only fixture**  
- **No `loginUrl`** — only home `url: https://www.leumi.co.il`

`resolveLoginAssistanceLevel`:

1. Honors explicit `loginAssistanceLevel` metadata first → **`manual_only`**.  
2. Else: no `loginUrl` → **`manual_only`**.

`LoginAssistancePanel` / `attemptExistingAutomaticCompletion`:

- `allowsAutomaticCompletionAttempt(manual_only) === false`  
- Auto **blocked**; shows MSG_MANUAL_ONLY; open + copy only.

**Does NOT consult** Managed `supportState=validated`. Validated Managed does **not** override Phase 113 manual_only on the Launch Card.

**Classification (DH):** **Expected Phase 113 fixture behavior** — not a Phase 120 Managed regression. System “already knows it won’t auto” because catalog/level says so — Owner observation is correct.

### 30.3 Admin Test vs Digital Home (orthogonal)

| Path | Gate |
|---|---|
| Admin Managed Test | Saved Managed mappings + temp credentials; **ignores** `loginAssistanceLevel` / validated; same Ext Managed engine (D-120-12) |
| Digital Home Launch Card | `loginAssistanceLevel` first — Leumi **blocked** before Managed |

So Admin Test can (sometimes) fill while DH still shows manual-only — **consistent with current architecture**, not a contradiction.

### 30.4 Admin Test intermittency — status

**Not root-caused to a Leumi-specific defect** without Ext structured `reason`/`detail` from failing runs.

Generic candidates (any Managed SPA), ordered by likelihood:

| Hypothesis | Notes |
|---|---|
| **Readiness race** | Managed bounded poll/retry; sometimes `targets_not_ready` if login controls late |
| **Wrong open URL / origin** | Catalog home ≠ Login Entry; Admin Test uses **saved** `loginEntryUrl`/`allowedOrigin` — if Entry unstable or redirects, intermittent |
| **Locator / eligibility flaky** | Visibility/V8 or multi_match on some navigations |
| **Busy / concurrent** | `MSG_MANAGED_BUSY` if overlapping Admin Test keys |
| **Extension inject timing** | Tab not ready on first attempt |

**Need Owner evidence (failing Admin Test summary line):** Hub already formats `userMessage · reason · fieldId · detail · locator`.

### 30.5 Classification

| Code | Verdict |
|---|---|
| DH manual-only banner | **Expected fixture / product level** (Phase 113) — not Managed engine failure |
| Catalog `manual_only` + no loginUrl | **Intentional** for Leumi fixture |
| Validated Managed ignored by Launch Card level | **Current contract** — possible **post-120 product gap** if Owner wants Managed-validated to elevate DH auto |
| Admin intermittent fill | **I — insufficient evidence** for exact Ext reason; likely generic readiness/URL — **not** proven Leumi code bug |
| Phase 120 acceptance threat | **None** |

### 30.6 CURRENT gap vs NEW work

| Kind | Item |
|---|---|
| **Not a bug to “fix” as Leumi special** | DH message while catalog is `manual_only` |
| **Possible post-120 product decision** | Should **validated Managed** override / replace `loginAssistanceLevel=manual_only` on Launch Card? (generic policy — not hostname) |
| **Possible generic reliability work** | Admin/Managed readiness intermittency — only after structured fail evidence |
| **Forbidden** | `leumi` / hostname / “Bank Leumi” special branches |

### 30.7 Phase 120

**Does not reopen or threaten Phase 120.**

### 30.8 Hard stops

No implementation in this investigation. No Phase 121 architecture. No Managed safety weaken. No site-specific fix.

### 30.9 Owner evidence update (2026-09-23) — Admin config screenshots

Owner confirmed Leumi is configured like other Managed services:

| Fact | Evidence |
|---|---|
| Dedicated Login Entry | UI: «כתובת כניסה ייעודית» + Login URL (query includes tracking GUID) |
| Credential schema | username + password fields present |
| Managed mappings saved | username `#_R_6pinot66mivb_` · password `#_R_apinot66mivb_` |
| Authoring badges | HIGH + visual verified + Admin Test success on both |
| Structural check | «הבדיקה המבנית תקינה» |
| Support state | **מאומת** (`validated`) |

**Revised conclusion — two independent issues:**

1. **Digital Home still shows manual-only** despite validated Managed — because Launch Card auto gate uses `loginAssistanceLevel` / catalog `manual_only` **before** Managed validated. Owner was not “misconfigured” on Managed; DH UX is **out of sync** with Managed readiness. This is a **generic product/architecture gap** (validated Managed vs Phase 113 assistance level), not missing mappings.

2. **Intermittent Admin/Managed fill — leading evidence:** locators `#_R_…` are **framework-generated ephemeral IDs**. Current Managed contract (exact-one fail-closed) correctly fails when those IDs change between loads. Structural/Visual “success” only proves the IDs worked **at mapping/test time**. This is a **locator stability / candidate-family** problem (generic), not a Leumi hostname bug. Prefer stable `name` / autocomplete / aria when available (authoring), or a future generic stable-locator capability — **no** site-specific selectors.

Login Entry URL with session/tracking query may add secondary flakiness if Entry redirects or expires — secondary to unstable `#_R_` IDs.

**Phase 120:** still not threatened; Managed fail-closed on missing/changed ID is correct.

---

## Architect Review (§30)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION UPDATED**; Phase 120 **CLOSED**; **no DD / no impl**

### Review Notes
Owner Managed config is real and validated. DH manual banner is catalog `manual_only` overriding validated Managed on Launch Card. Intermittency strongly implicated by ephemeral `#_R_*` locators under exact-one.

### Required Corrections
_None (investigation only)._

### Exact next step
**Owner:** (1) optional confirm after refresh whether `#_R_*` still match live DOM; (2) decide whether to elevate a **generic** post-120 slice: validated-Managed overrides `manual_only` on Launch Card. Do **not** implement Leumi-specific code.  
**Supersession:** Intermittent fill root cause — see **§31** (do not treat §30.9 unstable-ID claim as proven).

---

## 31. POST-120 Investigation — Intermittent Managed Autofill (same config → A/B/C outcomes) (2026-09-23)

**Status:** INVESTIGATION ONLY. Phase 120 **CLOSED** (not modified). Phase 121 **not opened**.  
**Constraints honored:** no impl; no locator change; no `manual_only` policy change; no site-specific logic; no global timing/first-match proposals.

**Fixture:** Bank Leumi (evidence only). Owner: recreated service; mappings saved+validated; intermittent Admin Test + DH (full / password-only / fail).

### 31.1 Shared Managed engine (CASE 5 — code-proven)

```text
Admin Test:  executeAdminManagedAutofillTest
             → sendManagedAutofillPayloadAndAwait (executionKey …::admin_test)
Digital Home (when auto allowed):
             executeManagedAutofill
             → sendManagedAutofillPayloadAndAwait (executionKey service::profile)
                    ↓
             HUB_MANAGED_AUTOFILL → openPageAndManagedAutofill
             → runManagedAutofillOnTab (retry ≤60 × 300ms on retryable)
             → MAIN: assessManagedTargetsReady → runManagedAutofill
```

| Aspect | Admin Test | Digital Home |
|---|---|---|
| Ext message / runner | **Same** `HUB_MANAGED_AUTOFILL` / `runManagedAutofill` | **Same** |
| Payload shape | Same (`url`, `allowedOrigin`, `fieldMappings`, `credentials`) | **Same** |
| Mapping source | Saved autofillProfile | Saved autofillProfile |
| Credential source | **Temp Admin values** | **Vault profile credentials** |
| Hub eligibility gate | Saved mappings enough (no validated required) | `serviceIsManagedAutofillEligible` required |
| Launch Card `manual_only` | **N/A** (Admin Test bypasses) | Blocks auto attempt if level=manual_only — **separate from fill intermittency** |

**CASE 5 falsified for engine divergence:** Admin and DH **converge** on the same Managed execution engine/configuration once Hub sends the payload. Observed outcome differences must come from **timing/DOM**, **credential values**, **eligibility pre-gate**, or **Launch Card policy** — not a second fill algorithm.

### 31.2 Exact in-page pipeline (per field)

`assessManagedTargetsReady` (ALL mappings, in order — **fail first**):

| Step | Failure → structured |
|---|---|
| `querySelectorAll(locator)` throws | `invalid_selector` + fieldId |
| length === 0 | `targets_not_ready` + `detail: zero_match` + fieldId + locator |
| length ≠ 1 | `targets_not_ready` + `detail: multi_match` |
| `!isSafeFillTarget` | `targets_not_ready` + detail from `classifyManagedIneligibility` |
| all PASS | `{ ready:true, targets:[…] }` — **no fill yet** |

`runManagedAutofill`:

1. If !ready → return readiness failure (**zero fields filled by Managed**).  
2. For each target in order: `fillField` (set value + events + **immediate** value verify). Fail → `fill_failed` / `missing_value` / `hidden_or_unsafe_target` + fieldId — **later fields not filled**.  
3. `verifyMappings` on held element refs → fail → `partial_fill` + `filled` count (DOM may still show values).  
4. Success → `{ ok:true, filled:N }`.

**Normative implication:** Managed does **not** intentionally emit “password-only success.” Password-only **observation** requires explanation outside “partial success reason” (see §31.4).

### 31.3 Live executions (Owner-required — Architect cannot bank-login)

**Architect did not run live Leumi executions** (no bank session; Architect does not operate live fill).  

| Required | Status |
|---|---|
| ≥3 fresh executions with variation | **I — not captured in this turn** |
| Per-attempt per-field pipeline table | **I — needs Owner Ext/Hub evidence** |
| Locator identity across loads | **I — not proven** |

**Capture protocol (evidence only — no config change):**

For each attempt (Admin Test and/or DH Try Auto), record Hub result line:
`userMessage · reason · fieldId · detail · locator`  
Plus Extension console `[ManagedAutofillDiag]` (`targets_not_ready`, lateProbe at 2s/5s/10s).

On Login Entry (top document), **before** fill (separate load):

```text
For each saved locator L:
  document.querySelectorAll(L).length
  ids of input[type=text|password|tel] relevant to login
```

Across ≥3 fresh loads: whether saved `#_R_…` still exist / matchCount / whether alternate name|aria candidates exist.

### 31.4 How outcomes A / B / C can arise (architecture)

| Outcome | Compatible with current engine? | Mechanism |
|---|---|---|
| **A** both filled | Yes | assess PASS → fill both verify PASS |
| **C** complete failure | Yes | assess fail (`zero_match`/`multi_match`/unsafe/wrong_origin/…) **or** fill/verify fail with no lasting DOM fill / user ignores leftover |
| **B** password-only (observed) | **Not a first-class Managed success mode** | Compatible explanations: (1) mapping order fills password then username fails mid-loop; (2) both filled then SPA clears/remounts username while password node retained; (3) `partial_fill` after both writes then username cleared; (4) leftover from prior attempt + new fail; (5) non-Managed autofill. **Cannot** be assess-fail on username alone (assess fills nothing). |

### 31.5 CASE matrix vs evidence

| CASE | Verdict |
|---|---|
| 1 Unstable locator | **Plausible, NOT proven** — `#_R_*` pattern is circumstantial; needs §31.3 multi-load matchCount |
| 2 Locator valid, not ready at check | **Plausible** — `targets_not_ready` + lateProbe may later PASS; existing ≤~18s retry; SPA after `complete` is known Managed gap from prior 120 evidence |
| 3 Username/password ready at different times | **Plausible under all-or-nothing assess** — first missing field fails whole attempt; does **not** alone produce password-only fill |
| 4 Fill OK, verify fail | **Possible** — `partial_fill` or fillField `ok:false` when value≠expected after events |
| 5 Admin≠DH engine | **Falsified** — same Ext Managed path (D-120-12) |
| 6 Other | Credential empty on one vault field; Entry URL/GUID redirect; origin mismatch; concurrent busy |

### 31.6 Root-cause classification (this investigation)

| Code | Status |
|---|---|
| **E** Admin/DH path divergence (engine) | **Ruled out** |
| **G** policy/UI only (`manual_only`) | **Out of scope** for this intermittency task; does not explain Admin Test intermittency |
| **A** unstable locator | **Unproven** |
| **B** readiness/timing | **Unproven but compatible** |
| **C** per-field async readiness | **Compatible with full fail**; weak alone for password-only |
| **D** fill/verification | **Compatible with password-only observation** |
| **F** stale config/version | **Unproven** (Owner recreated; still intermittent) |
| **I** insufficient live evidence | **YES — blocks definitive A/B/C/D lock** |

### 31.7 Defect vs capability vs config vs site observation

| Kind | Verdict |
|---|---|
| Current **generic defect** | **Not proven.** No contract violation identified without live `reason`/`detail`. Fail-closed exact-one remains correct. |
| **New capability gap** | Possible later: stronger post-navigation settle / stable-locator authoring — **not authorized here**; must not be “sleep longer for Leumi.” |
| **Configuration instability** | Possible if locators/`loginEntryUrl` query tokens change — **unproven** until multi-load evidence. |
| **Site-specific observation** | Leumi is the fixture showing intermittency; most other Managed services OK → treat as **evidence**, not license for hostname special-case. |

### 31.8 Explicit non-actions

No DD. No implementation. No `manual_only` change. No locator change. No global retry/timing/first-match weaken.

---

## Architect Review (§31)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION COMPLETE (code path + CASE matrix)**; **live A/B/C lock = INSUFFICIENT EVIDENCE**; Phase 120 **CLOSED**

### Review Notes
Admin/DH share Managed engine. Assess is all-or-nothing; password-only is not a Managed success code. Unstable `#_R_*` remains unproven. Need ≥3 Owner attempts with structured `reason`/`detail`/`fieldId` + multi-load matchCount.

### Required Corrections
_None._

### Exact next step
**STOP for Owner evidence capture (§31.3).** Do not implement. Do not open Phase 121. Do not change policy/locators.

---

## 32. POST-120 Investigation — SUCCESS with observed 0/2 vs partial_fill 1/2 (2026-09-23)

**Status:** INVESTIGATION ONLY. Phase 120 **CLOSED**. No impl / no locator / no `manual_only` / no site-specific.

### 32.1 New live Admin Test evidence (Owner)

| Run | Hub | Owner-visible DOM |
|---|---|---|
| 1 | SUCCESS (`MSG_MANAGED_FILL_OK`) | username empty, password empty (0/2) |
| 2 | SUCCESS (Owner watched continuously; no fill-then-clear seen) | 0/2 empty |
| 3 | FAIL `partial_fill` + fill-failed Hebrew | username empty, password **filled** (1/2) |

Same saved/validated config. Page console had **no** `[ManagedAutofillDiag]` (expected — those logs are **service-worker / extension background**, not page).

### 32.2 Exact SUCCESS predicate (code)

`runManagedAutofill` returns SUCCESS iff **all** hold:

1. `assessManagedTargetsReady` → `ready:true` (every mapping: exact-one + `isSafeFillTarget`).  
2. For **every** target, in order: `fillField(el, value)` returns `ok:true`.  
3. `verifyMappings(heldElementRefs, credentials)` returns `ok:true`.

Then Ext: `{ ok:true, filled:N, reason:'ok' }`.  
Hub: `response.ok === true` → `MSG_MANAGED_FILL_OK` (**confirmed correct mapping**).

### 32.3 Exact `partial_fill` predicate (code)

`partial_fill` is returned **only** when:

1. Assess passed, **and**  
2. **Every** `fillField` returned `ok:true` (each did an immediate post-write value check), **and**  
3. Subsequent `verifyMappings` on the **same held element object references** returns `ok:false`.

Ext: `{ ok:false, reason:'partial_fill', filled:filledCount }`.  
Hub: `ok !== true` → `userMessageForManagedFailure` → `MSG_MANAGED_FILL_FAILED` + Hub appends `· partial_fill` in Admin summary (**confirmed correct**).

**Not** `partial_fill`: mid-loop `fillField` failure → `fill_failed` / `missing_value` / `hidden_or_unsafe_target` + `fieldId` (later fields never filled by Managed).

### 32.4 What verification actually verifies

| Check | What it reads | What it does **not** check |
|---|---|---|
| `fillField` post-write | `String(element.value).trim() === expected` on the **element ref from assess** | Re-query by locator; connectedness; visibility at Owner glance; framework model/state; “currently displayed” node under same locator |
| `verifyMappings` | Same: `element.value` on **held refs** vs credentials | Locator re-resolve; `isConnected`; that ref === `querySelector(locator)` now; SPA store |

Uses native value setter + input/change/blur events, then reads `.value` again.

### 32.5 Can SUCCESS coexist with later Owner-visible 0/2?

**Yes — under current semantics.** SUCCESS asserts only that **held element refs** satisfied `.value === expected` at verify time. It does **not** assert durable visible values after return.

Documented how:

```text
assess → hold refs E_user, E_pass
fillField(E_*) → .value matches → ok
verifyMappings(E_*) → .value matches → SUCCESS returned to Hub
[after / concurrent] SPA remount / replace login controls
Owner sees new empty inputs (or same locator, new nodes)
Observed 0/2 while Hub already showed SUCCESS
```

Also consistent with: React controlled input briefly accepting native `.value` (verify PASS) then re-render from empty React state **after** verify (Owner may miss a flash — Run 2 claimed no flash, still compatible with remount **after** SUCCESS return without restoring through the same node).

### 32.6 Answers to Owner checklist (4–8)

| # | Answer |
|---|---|
| 4 | **Yes** — SUCCESS against refs that later detach/replace before Owner inspects |
| 5 | **Yes, possible** — assignment → immediate `.value` PASS → framework render empties (or replaces) node; explains SUCCESS≠durable UI |
| 6 | **Yes** — navigation/render after SUCCESS return is outside the predicate; Managed does not re-verify post-return |
| 7 | **Yes** — username/password can diverge after per-field fill (e.g. username remounted/cleared before `verifyMappings`, password ref still valued) → classic `partial_fill` + observed password-only |
| 8 | Hub mapping **correct** for SUCCESS and `partial_fill` |

### 32.7 Consistency with all three runs (do not force one internal reason)

| Run | Most consistent code story |
|---|---|
| 1–2 SUCCESS + observed 0/2 | Verify PASS on held refs; **post-success** (or non-observed) DOM replacement / controlled reset empties what Owner watches |
| 3 `partial_fill` + password only | All `fillField` PASS; then `verifyMappings` fails on username ref (empty/cleared/detached-empty) while password ref still holds value |

Unstable `#_R_*` still **unproven** as the sole cause but **compatible** (new nodes under new ids after remount). Readiness alone does **not** explain SUCCESS+0/2 (assess+verify already passed).

### 32.8 Classification (evidence-weighted)

| Code | Verdict |
|---|---|
| **A** verification contract defect | **Supported as contract gap** — verifies held `.value` only; no post-return / re-query / connectedness durability |
| **B** DOM replacement/stale-element lifecycle | **Strongly consistent** with SUCCESS+0/2 and partial password-only |
| **C** framework-controlled-input interaction | **Consistent** / overlapping with B |
| **D** async post-verification reset | **Consistent** with Runs 1–2 |
| **E** locator instability | **Compatible, not proven** |
| **F** readiness/timing | **Does not explain** SUCCESS+0/2 (verify already passed) |
| **H** | Live Ext element identity / `isConnected` / re-query at verify **not** logged — instrumentation gap |

### 32.9 Instrumentation insufficiency

**Yes.** Current Owner-visible signals (Hub Hebrew + optional `partial_fill`) cannot distinguish:

- verify passed on nodes later replaced, vs  
- verify passed on visible nodes then async clear, vs  
- Owner watching a different generation of controls.

`[ManagedAutofillDiag]` is SW-only and focuses on `targets_not_ready` / tab lifecycle — **not** fill/verify/connectedness. Page console will not show it.

### 32.10 Phase 121 relevance

**Yes — generic Managed runtime/verification concern** worth considering **before** Phase 121 capability expansion: SUCCESS currently means “held refs matched at T_verify,” not “durable visible fill on the controls the user sees.”  
No remediation authorized here. No Phase 120 reopen. No DD yet.

### 32.11 Smallest NEXT Owner diagnostic (no config/locator change)

On **one** Admin Test attempt, in **extension service worker** DevTools (not page):

1. Confirm SUCCESS or `partial_fill` in Hub.  
2. Immediately in **page** console on Login Entry tab:

```text
// For each saved locator L (do not change config — read-only):
document.querySelectorAll(L).length
// And: whether currently focused visible username/password .value are empty
```

Optional stronger (still diagnostic-only, not a product change): if Owner can paste whether after SUCCESS the **same** `#_R_…` nodes still exist (`getElementById` / query) vs new ids appeared.

That distinguishes: post-success remount (ids gone/changed, empty new nodes) vs same nodes emptied.

---

## Architect Review (§32)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION UPDATED**; SUCCESS↔visible-fill **contract gap evidenced**; Phase 120 **CLOSED**; **no DD / no impl**

### Review Notes
Runs 1–2 prove SUCCESS can decouple from Owner-visible durable fill under held-ref `.value` verification. Run 3 proves `partial_fill` path works and matches password-only after all fillField ok. Hub mapping correct. Instrumentation insufficient for connectedness/re-query.

### Required Corrections
_None (investigation only)._

### Exact next step
**STOP.** Owner optional §32.11 diagnostic. Do not implement. Do not open DD until Owner elevates.

---

## 33. POST-120 Investigation — Post-SUCCESS live DOM (same locators; username empty / password retained) (2026-09-23)

**Status:** INVESTIGATION ONLY. Phase 120 **CLOSED**. No impl / no config / no locator / no `manual_only` change.

### 33.1 New Owner evidence (immediately after Admin Test SUCCESS)

| Control | Locator | exists | type | value | visible | isConnected |
|---|---|---|---|---|---|---|
| username | `#_R_6pinot66mivb_` | true | text | `""` | true | true |
| password | `#_R_apinot66mivb_` | true | password | `"AAA"` (expected retained) | true | true |

Full input enumeration: **exactly two** inputs — no hidden/duplicate alternate targets.

**Proven:**
- Hub SUCCESS was returned.
- Shortly after, **current** locator-matched username is empty + connected + visible.
- **Current** locator-matched password retains expected value + connected + visible.

**Not proven by this alone:** username was filled then cleared on the **same** node (vs remount with same id string).

### 33.2 Implications vs A/B/C/D

Prior contract: SUCCESS ⇒ at `T_verify`, **held refs** had matching `.value`.

| Hypothesis | Still viable? | Why |
|---|---|---|
| **A** same element filled+verified then `.value` reset | **Yes** | Same locator still resolves; password retained while username emptied fits asymmetric reset |
| **B** remount — new element, **same id string** | **Yes** | Locator/`id` equality does **not** prove object identity; React remount can reuse `#_R_…` on a new node; held ref may be detached (Owner did not check held-ref `===` current) |
| **C** framework-controlled override of DOM assignment | **Yes** | Overlaps A (controlled re-render empties `.value` on same or new node) |
| **D** other lifecycle | **Possible** | e.g. blur/focus chain on password fill clearing username; navigation fragment — not singled out |

**Narrowed / weakened:**
- Hidden duplicate-target theory — **weakened** (only two inputs).
- “SUCCESS verified a different visible control than Owner inspected” — **weakened** (same locators; only two inputs).
- Readiness-only explanation — still **inapplicable** to SUCCESS+empty username (verify already passed).

**Cannot distinguish A vs B** with locator+isConnected+value alone: both yield “query(locator) is connected and empty” after SUCCESS.

### 33.3 Is current verification contract sufficient for user-visible SUCCESS?

**No.**

Current SUCCESS = held-ref `.value` match at `T_verify` only.  
It does **not** guarantee:

- held ref `===` `document.querySelector(locator)` at claim time,
- held ref still `isConnected`,
- durable value until user looks,
- framework model agrees with native `.value`.

Owner evidence (SUCCESS → visible connected username empty, password kept) shows the **user-visible SUCCESS claim can be false** under the current contract — even when locators remain stable strings.

### 33.4 Updated classification

| Code | Verdict |
|---|---|
| **A** verification contract insufficient for user-visible SUCCESS | **ACCEPTED (generic)** — evidenced |
| **B** DOM replacement / stale held ref (incl. same-id remount) | **Still open** — not distinguished from A |
| **C** framework-controlled input | **Still open** — compatible |
| **D** other asymmetric lifecycle | **Still open** |
| Locator string instability (`#_R_` changing across loads) | **Not required** for this post-SUCCESS snapshot (same ids still present) |
| Leumi-specific root lifecycle fully identified | **No** |

### 33.5 Smallest diagnostic to distinguish A/B/C/D (no product remapping / no timing fix)

**One** identity check at verify/claim time (instrumentation or one-shot Ext diagnostic — **not authorized to implement here**; specify only):

At end of `verifyMappings` (or immediately before Ext returns `ok:true`), for each field record:

1. `held === document.querySelector(locator)` (object identity)  
2. `held.isConnected`  
3. `held.value` vs `querySelector(locator)?.value`  
4. Optional: non-mutating stamp `held.dataset.pvFillGen = <nonce>` at assess; after SUCCESS Owner/Ext reads whether current `querySelector(locator).dataset.pvFillGen === nonce`

| Pattern | Favors |
|---|---|
| held === current, connected, value was match at verify, later empty | **A** (or **C** on same node) |
| held !== current OR !held.isConnected, current empty, same id | **B** |
| held === current, value match at verify, React fiber/props empty while native briefly set | **C** (needs framework probe — larger than minimal) |

**Minimal bar to split A/B:** object identity (`===`) + `isConnected` at SUCCESS return.  
Splitting A vs C rigorously may need a short MutationObserver/value watcher spanning post-SUCCESS — second step only if A/B resolved to same-node reset.

Do **not** propose timing/retry/remapping in this investigation.

### 33.6 Generic verification hardening before Phase 121?

**Yes — architecturally warranted** as a **consideration / candidate slice**, even while Leumi A/B/C lifecycle is not fully pinned:

- Evidence already shows user-visible SUCCESS can diverge from durable DOM under the held-ref contract.
- That is **generic Managed runtime verification concern**, not a Leumi hostname issue.
- Hardening direction (when later authorized): SUCCESS must not be claimed without checks that the verified nodes are still the live locator targets and still hold values (re-query / identity / connectedness) — **without** weakening exact-one or adding site-specific logic.

**Not authorized now:** DD, implementation, policy change, locator change, timing increase.

---

## Architect Review (§33)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION UPDATED**; user-visible SUCCESS contract **insufficient**; A/B/C not fully split; Phase 120 **CLOSED**; **no DD / no impl**

### Review Notes
Post-SUCCESS: same `#_R_*` strings, username empty connected, password retained, only two inputs. Proves durable user-visible SUCCESS not guaranteed. Smallest split A/B = held===current + isConnected at claim time.

### Required Corrections
_None._

### Exact next step
**STOP.** Optional authorize diagnostic-only identity instrumentation later. Do not start Phase 121 remediation from this alone.

---

## 34. POST-120 Investigation — Service icon / asset resolution (cross-domain Primary vs Login Entry) (2026-09-23)

**Status:** INVESTIGATION ONLY. Phase 120 **CLOSED**. No impl / no data change / no Tax Authority–specific fix.

**Fixture (evidence only):** New catalog service רשות המיסים — Primary `https://www.gov.il/he/departments/israel_tax_authority`, Login Entry `https://secapp.taxes.gov.il/taxes-login/`. Digital Home icon does not match Tax Authority branding Owner sees on the service site.

### 34.1 Exact current asset-resolution flow (Digital Home paint)

```text
Registry ServiceDefinition
  → definitionToLegacyService.resolveLogoUrl (D-111-6 cascade):
       (1) active managed Storage pointer (admin upload / managed asset)
       (2) else metadata.logoUrl
       (3) else metadata.faviconSiteUrl → highResFavicon(siteUrl)
            = Google faviconV2 CDN URL for that siteUrl
       (4) else undefined
  → Service.logoUrl (+ Service.url = primary_url)
  → useServiceLogos → getCachedServiceLogo:
       (1) managed Storage URL if present
       (2) else resolveServiceLogo({ url: service.url /* PRIMARY */, logoUrl })
            - try logoUrl first (often Google favicon for faviconSiteUrl)
            - else probe PRIMARY origin: apple-touch paths → HTML apple/og/icon → /favicon*
       (3) else null → emoji/initial fallback (service.icon, often 🔗)
```

**Login Entry URL is not an input to this cascade.**

### 34.2 Where this service’s displayed icon comes from

On **global Admin create** (`adminRegistryApi` insert):

```text
metadata.faviconSiteUrl := primaryUrl
```

Same for user custom create (`createCustomServiceDefinition`): `faviconSiteUrl` ← normalized **primary** URL.

Therefore for this service, absent admin upload / managed Storage:

| Source | Used? |
|---|---|
| Primary URL (`gov.il/…`) | **Yes** — authoritative for `faviconSiteUrl` + `resolveServiceLogo` site probe |
| Login Entry (`taxes.gov.il`) | **No** — never consulted for icon |
| Page metadata of Login Entry | **No** |
| Automatic HTTP managed discovery on create | **Stub** — `discoverServiceIconSafe` returns `no_managed_icon_yet` (no third-party fetch on create) |
| Admin-uploaded Storage asset | Only if Admin uploaded (Owner did not report that) |
| Emoji `🔗` | Only if logo cascade yields null |

**Most likely exact paint source:** Google `faviconV2` (or live probe) for **`www.gov.il`** — i.e. **government portal** visual identity, not Tax Authority brand on `taxes.gov.il` / department page chrome.

Architect did not fetch live bytes; classification does not require Tax Authority–specific URL hardcoding.

### 34.3 Authoritative domain for identity assets today

| Concern | Authoritative |
|---|---|
| Service/business URL identity | `primary_url` |
| Authentication endpoint | `login_url` / Login Entry (Managed) |
| **Visual icon asset (default)** | **`primary_url` via `faviconSiteUrl`** (and primary-origin probe) — **not** Login Entry |

Cross-domain Primary ≠ Login Entry: **Primary wins for icons by construction.**

### 34.4 Determinism

| Aspect | Verdict |
|---|---|
| Which URL is chosen for faviconSiteUrl | **Deterministic** — primary on create |
| Login Entry never preferred automatically | **Deterministic** |
| Final image bytes | **Mostly deterministic**, with residual non-determinism: Google CDN content changes; `firstValidParallel` apple-path race; CORS/proxy HTML fetch success/fail flipping cascade tier; in-memory `logoCache` until invalidate |

### 34.5 Can Login Entry asset accidentally become the Home icon?

**Not via current default cascade.** Login host favicon/og is never selected unless:

- Admin sets `faviconSiteUrl` / `logoUrl` / uploads an image derived from that host, or  
- somehow `service.url` were the login host (misconfigured primary).

Auth-only hosts do **not** auto-promote to representative icon under present code.

### 34.6 Stale/cached assets?

| Mechanism | Role here |
|---|---|
| In-memory `logoCache` | Can retain first successful URL for `serviceId` until invalidate — **not** a cross-service mix-up |
| Managed Storage stale | Only if prior active managed icon existed |
| New service | Unlikely “wrong service’s” stale asset; more likely **correct primary-derived portal favicon** that Owner judges brand-mismatched |

Stale cache is **secondary**; primary explanation is **expected primary-based resolution**.

### 34.7 Business identity vs authentication identity

| Layer | Distinguished? |
|---|---|
| URL fields (`primary_url` vs `login_url`) | **Yes** |
| Managed Autofill Login Entry | **Yes** |
| Visual asset ownership | **Only implicitly** — assets follow primary/`faviconSiteUrl`; **no** explicit “brand identity asset” vs “auth endpoint asset” rule beyond Phase 111 cascade |

Architecture **does** separate org URL from auth URL; it **does not** offer a second asset channel for “brand when primary is a generic portal.”

### 34.8 Classification

| Code | Verdict |
|---|---|
| **A** expected under current asset architecture | **Primary** — icon from primary/`faviconSiteUrl` (gov.il), not Login Entry |
| **B** asset-resolution defect (bug vs written cascade) | **No** — behavior matches Phase 111 / create stamping |
| **C** stale/cached defect | **Unlikely primary**; possible amplifier only |
| **D** missing architectural rule for cross-domain brand vs auth | **Yes, as product/architecture gap** — when primary is a **portal hub** and brand lives on another host, primary-favicon is often “wrong brand” while still “correct per rules” |
| **E** other | Owner perception vs portal favicon; admin upload path unused |

### 34.9 Canonical asset ownership — already defined correctly?

**Partially.**  
Canonical default = **Primary / `faviconSiteUrl`** is an intentional, deterministic rule and correctly avoids auth-host pollution.

It is **insufficient** for the generic case: Primary represents organization entry on a **shared portal**, while distinctive brand assets live elsewhere (or only on Login Entry). That case is **not** a Phase 120 Managed defect.

### 34.10 Post-120 corrective finding vs future capability

| Kind | Record as |
|---|---|
| Bug violating current cascade | **No** |
| Post-120 **corrective** (must fix Phase 120) | **No** — Phase 120 closed; assets are Phase 111 presentation |
| **Future-phase / post-120 exploration finding** | **Yes** — generic: canonical visual identity when Primary ≠ brand host ≠ Login Entry |
| Manual Tax Authority icon fix | **Forbidden** this investigation |

### 34.11 Smallest generic architectural correction (IF warranted later — not DD)

When authorized as a future slice (not now):

1. **Normative rule:** Digital Home representative icon is **service/business identity**, defaulting to Primary/`faviconSiteUrl`; Login Entry must **not** auto-become the icon.  
2. **Gap to close:** allow Admin (or explicit metadata) to set identity asset source / upload when Primary favicon is a generic portal — without hostname special cases.  
3. Optional later: discover brand candidates from Primary **page** (og/apple on the department URL) with higher fidelity than apex `gov.il` favicon — still Primary-scoped, not Login Entry auto-promotion.

**Do not** auto-prefer Login Entry favicon (would make auth-system logos the Home identity).

### 34.12 Hard stops honored

No implementation. No Tax Authority / gov.il / taxes.gov.il hardcoding. No manual icon replace. No priority change. No new discovery shipped.

---

## Architect Review (§34)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION COMPLETE**; icon behavior **expected under Primary-based cascade**; brand mismatch = **cross-domain identity-asset gap**; Phase 120 **CLOSED**; **no DD / no impl**

### Review Notes
Displayed icon almost certainly derives from Primary/`faviconSiteUrl` (gov.il portal), not taxes.gov.il Login Entry. Architecture separates URLs but not “portal primary vs brand asset.” Future generic Admin identity-asset control — not a Leumi/Tax hotfix.

### Required Corrections
_None (investigation only)._

### Exact next step
**STOP.** Record as post-120 exploration finding. Do not implement. Do not open DD unless Owner elevates a generic identity-asset slice.

---

## 35. POST-120 Investigation — Government Personal Area Analyze / Visual Mapping authoring failure (2026-09-23)

**Status:** INVESTIGATION ONLY. Phase 120 **CLOSED**. No impl / no config / no site-specific fix.

**Fixture:** Government Personal Area (evidence only). Schema: ID number + password; **no** saved locators. Admin reports Analyze → «לא ניתן לנתח…»; Visual Mapping associated with «יש להזין בורר CSS לכל שדה ממופה.»

### 35.1 Visual Mapping — exact failure / message source

**Message** = `AUTOFILL_PROFILE_ERROR.emptyLocator`  
(`validatedProfile.ts`: «יש להזין בורר CSS לכל שדה ממופה.»)

**Producing condition:** `validateAutofillProfileStructural` — for every `fieldMappings[]` entry, if `locator.trim()` is empty → push `emptyLocator`.

**How mappings are built in the editor:** one mapping row per **schema field**, locator from draft form (empty when unset):

```text
fields.map → { fieldId, locatorType:'css', locator: locators[id] || '' }
```

With two schema fields and no locators → structural **always** fails with `emptyLocator` while authoring.

**UI placement:** persistent banner when `!structural.ok` (same `admin-error` class as action errors) — **not** emitted by `requestVisualMapping`.

**Visual Mapping click gate (`canVisualMap`):**

```text
!busy && originFromHttpsLoginEntry(login_url)
```

Does **NOT** require `structural.ok` or existing locators.

**`requestVisualMapping`:** if `!canVisualMap` → return silently (no emptyLocator). On run → Ext `ADMIN_VISUAL_MAPPING_START` — no CSS prerequisite.

| Question | Answer |
|---|---|
| 1. Which validation? | Structural `emptyLocator` on draft mappings with empty locator strings |
| 2. Before Visual Mapping starts? | Banner is **always on** during empty draft — not a click handler for Visual Mapping |
| 3. Does Visual Mapping depend on existing locator? | **No** (gate + start path) |
| 4. Save/Approve validation reused? | **Yes** — Save/Approve structural completeness shown during **in-progress** authoring as a standing error |
| 5. Clean field can start Visual Mapping? | **Yes** under accepted 119/120 contract **if** HTTPS Login Entry + extension; button should enable |

**Classification (Visual):** **A — Admin precondition/validation presentation defect** (structural empty-locator treated as live authoring error while Visual Mapping is allowed). Not E unsupported site. Not a Visual Ext gate.

If Owner’s button was disabled, alternate cause = missing HTTPS Login Entry (`canVisualMap` false) — then emptyLocator banner is still unrelated noise.

### 35.2 Analyze — exact failure path

```text
Admin «נתח דף כניסה»
  → canAnalyze? (schema fields + HTTPS login_url origin + not busy)
  → analyzeLoginPageForMapping:
       schema empty? → NEED_SCHEMA (different message)
       !originFromHttpsLoginEntry? → NEED_LOGIN_ENTRY (different message)
       !probeExtensionAvailable? → ANALYZE_FAILED «לא ניתן לנתח…»  [NO tab / NO inspect / NO provider]
       send ADMIN_LOGIN_PAGE_INSPECT → Ext open Login Entry + inspect
       !inspect.ok? → ANALYZE_FAILED  [tab may have opened]
       proposeFieldMappings (provider)
       proposal.status==='error'? → ANALYZE_FAILED
  → Editor catch → ANALYZE_FAILED (generic)
```

Owner message = `ANALYZE_FAILED_LABEL_HE` exactly.

**“Immediate / before visible inspection”** is **compatible with** (ordered likelihood without live Ext proof):

1. **`extension_unavailable`** — Ext never contacted meaningfully / probe false → **no Login Entry open**, no inspect, no provider.  
2. Inspect returns fail **very fast** (origin/tab) — site may briefly open.  
3. Thrown error in Hub → catch → same message.  
4. Provider error — **only after** inspect success (not “before inspection”).

**Cannot classify website as unsupported** — evidence does not reach a proven website/inspection deficiency.

**Classification (Analyze):** **I — insufficient** for exact stage among extension vs inspect vs catch; **not** E unsupported without inspect-layer proof. Immediate timing **favors B (extension)** or early **C**, not F provider-first.

### 35.3 Does either request reach the login website?

| Path | Reaches Login Entry? |
|---|---|
| Visual Mapping | **Only if** button enabled and click runs Ext start — emptyLocator message **alone does not prove** a Visual attempt ran |
| Analyze | **Only if** past extension probe into inspect — immediate fail **often means no** |

### 35.4 Root-cause summary

| Path | Classification | Notes |
|---|---|---|
| Visual / emptyLocator | **A** | Save-oriented structural banner on empty draft; misread as Visual Mapping rejection; Visual does **not** require CSS first |
| Analyze / «לא ניתן לנתח» | **I** (favor **B**/early **C**) | Generic fail message collapses stages; no Ext `reason` surfaced to Admin |

### 35.5 Generic post-120 defect / capability gap?

| Finding | Kind |
|---|---|
| Empty draft shows Save structural `emptyLocator` as authoring **error** beside Analyze/Visual | **Generic Admin UX / validation-scope defect** — post-120 corrective candidate (presentation/gate clarity), not Phase 120 reopen |
| Analyze failures collapse to one Hebrew string | **Generic observability gap** — hard to tell extension vs inspect vs provider |
| Government site unsupported | **Not evidenced** |

### 35.6 Smallest next diagnostic

1. Confirm Visual Mapping button `data-enabled="true"` / not disabled.  
2. On Analyze fail: DevTools Network/Extension — was `ADMIN_LOGIN_PAGE_INSPECT` sent? Did a tab open?  
3. Extension availability indicator / reload extension if probe fails.  
4. Do **not** change locators/config for this investigation.

---

## Architect Review (§35)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION COMPLETE**; Visual emptyLocator = **structural banner misuse**; Analyze stage = **insufficient live Ext reason**; Phase 120 **CLOSED**; **no DD / no impl**

### Review Notes
Visual Mapping must not require CSS; code gate agrees; Owner message is Save structural emptyLocator on empty draft. Analyze generic failure likely extension/inspect before provider.

### Required Corrections
_None (investigation only)._

### Exact next step
**STOP.** Owner optional §35.6 diagnostics. Do not implement. Do not open DD until Owner elevates.

---

## 36. POST-120 Investigation — Immediate Admin error while Login Entry tab still opens (§35 follow-up) (2026-09-23)

**Status:** INVESTIGATION ONLY. Phase 120 **CLOSED**. No impl / no config change.

### 36.1 New Owner evidence (narrows §35)

| Observation | Implication |
|---|---|
| Error on click for **both** Analyze and Visual Mapping | Action path runs (not only standing Save banner) |
| UI **never** shows «מנתח דף כניסה...» / Visual in-progress («לחצו על השדה…») | Busy state either never paints or clears in same React turn as error |
| New tab **does** open to correct Government Personal Area login | Ext `tabs.create` started; failure is **not** “never contacted Ext” |
| Page loads correctly afterward | Not a hard navigation block |
| Israel Tax Authority authoring worked same session | **Not** generic gov.il incompatibility |

Do **not** start with DOM/readiness of the final page — failure UI is **pre-settled-load / early session**.

### 36.2 Shared Hub click → busy → await Ext (both paths)

```text
Analyze:  setAnalyzing(true) → await analyze… → Ext ADMIN_LOGIN_PAGE_INSPECT
Visual:   setVisualMappingFieldId(id) → await startVisualMapping… → Ext ADMIN_VISUAL_MAPPING_START
          finally: clear busy flag
```

If Ext returns a **terminal** `{ok:false}` (or Hub gets `null` via `lastError`) **quickly**, React can batch busy-on + error + busy-off → Owner never sees waiting copy. Tab creation is **already in flight** in the service worker.

### 36.3 Exact immediate error sources (code)

#### Analyze

Hub message «לא ניתן לנתח…» when:
1. `probeExtensionAvailable()` false — **no tab** (ruled out by Owner tab open), or  
2. `sendExtensionMessageAsync` → `null` (`chrome.runtime.lastError`), or  
3. Ext `finishSession` with `!ok` / no `page` (inspect fail reasons include `origin_mismatch`, inject fail, etc.)

Ext inspect session (`openPageAndInspectLoginStructure` → `openGenericRealSiteTab`):

```text
tabs.create(loginEntryUrl)     // tab opens — continues independently
→ wait status=complete + tabUrlMatchesGenericTarget(loginEntryUrl)
→ inject inspect → collectSafePageStructureWithReadiness(expectedOrigin=allowedOrigin)
→ FIRST check: location.origin === allowedOrigin
     else → { ok:false, reason:'origin_mismatch' }  // can be VERY fast after complete
```

**No** Visual-style mid-nav abort on Analyze — but inspect can still fail **immediately after first matched complete** if origin ≠ `allowedOrigin` (from Hub `originFromHttpsLoginEntry(login_url)`).

#### Visual Mapping

Standing `emptyLocator` banner (§35) may still be on screen, but **new evidence** (no in-progress + tab opens) proves Ext Visual session starts.

Immediate terminal paths after tab create:

| Path | Effect |
|---|---|
| **`onNavAbort`** (Visual-only) | Any `changeInfo.url` whose **origin ≠ allowedOrigin** → `finishSession({ reason:'origin_mismatch' })` while tab keeps loading | 
| Inject / run failure | `visual_pick_inject_failed` / `no_result` / etc. |
| Hub maps `origin_mismatch` | «המקור בדף הכניסה אינו תואם…» |
| Hub maps other fail / null | «לא ניתן להשלים מיפוי חזותי…» |

**Does Visual enter waiting internally?** `armVisualTargetPick` may be armed briefly; if `onNavAbort` or inject fail finishes the session first, Hub never stays in wait. Owner not seeing in-progress is consistent with **fast terminal Ext response** + React batching.

### 36.4 Why tab still opens after Admin already shows error

```text
openGenericRealSiteTab:
  chrome.tabs.create(...)     // independent browser tab lifecycle
  …later… finishSession(fail) // closes Ext message → Hub shows error
tab continues navigating/rendering regardless of finishSession
```

**E** (real immediate Ext error while tab creation continues) — **supported**.  
Not “Admin invents error without Ext.”

### 36.5 Difference from working Tax Authority service

Same Hub/Ext code paths. Difference is **service Login Entry navigation/origin behavior**, not “government” as a class:

| Working (Tax Authority fixture) | Failing (Personal Area fixture) |
|---|---|
| Authoring load likely stays on **configured login origin** through complete/inspect/arm | Suspected **cross-origin hop** (redirect/SSO/intermediate host) vs `allowedOrigin` from stored `login_url` |
| Waiting UI visible (slow success path) | Fast `origin_mismatch` / early fail → no waiting paint |

Exact Personal Area hop hosts **not** captured this turn — classify as origin/nav session failure, not page DOM.

### 36.6 Options A–G vs evidence

| Option | Verdict |
|---|---|
| A stale structural before async | **Insufficient alone** — tab open proves Ext authoring started |
| B ack treated as terminal | Possible if malformed early response; secondary |
| C clearing state before async completes | **finally clears busy** after terminal response — yes as UX effect, not root |
| D shared config/origin precondition | **Strong candidate** — `allowedOrigin` = origin(`login_url`); any nav/inspect origin ≠ that fails |
| E immediate Ext error + tab continues | **Confirmed pattern** |
| F unrelated Save banner only | **Narrowed** — still may display, but does not explain tab + missing waiting state |
| G other | Channel `lastError` → Hub `null` → generic fail |

**Shared root cause (leading):** early **origin / navigation session abort** relative to `allowedOrigin` derived from configured Login Entry — Visual via **`onNavAbort`**, Analyze via **inspect-time `origin_mismatch`** — while `tabs.create` already opened. React busy UI discarded because failure returns before paint. **Not** proven DOM unreadiness; **not** Tax Authority vs Personal Area product special-case.

### 36.7 Classification update

| Path | Class |
|---|---|
| Analyze immediate | **C** Login Entry/origin/navigation (inspect-time), or **E**; **I** until Ext `reason` logged |
| Visual immediate | **C** via **`onNavAbort` origin_mismatch** (leading code explanation), or inject fail; **I** until message/`reason` confirmed |
| Shared | Generic **authoring session origin-strictness vs multi-host login redirects** — post-120 finding candidate |

### 36.8 Smallest next live diagnostic (only if needed)

One failing Analyze **and** one Visual click; capture:

1. Exact Admin Hebrew string (origin-mismatch vs generic fail vs emptyLocator).  
2. Extension SW log: `[External] sendResponse: admin-login-page-inspect|admin-visual-mapping` **payload.reason**.  
3. Configured `login_url` origin vs final tab URL origin (and any intermediate URL if visible in SW `onUpdated`).

No timing/locator/safety changes.

---

## Architect Review (§36)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION UPDATED**; immediate error + open tab = **Ext session early fail (origin/nav leading)**; Phase 120 **CLOSED**; **no DD / no impl**

### Review Notes
Waiting UI skipped via fast terminal Ext response + React batching. Tab open proves create started. Visual `onNavAbort` is the sharpest code hook for cross-origin hops. Tax Authority working rules out blanket gov defect.

### Required Corrections
_None._

### Exact next step
**STOP.** Optional §36.8 Ext `reason` capture. Do not implement.

---

## 37. POST-120 Investigation — login.gov.il same-origin evidence vs origin_mismatch (§36 follow-up) (2026-09-23)

**Status:** INVESTIGATION ONLY. Phase 120 **CLOSED**. No impl. Origin enforcement **not** weakened.

### 37.1 Owner origin evidence (ACCEPTED)

| | URL / origin |
|---|---|
| Configured Login Entry | `https://login.gov.il/` |
| Derived `allowedOrigin` | `https://login.gov.il` |
| Final loaded login | `https://login.gov.il/nidp/app/login?id=usernamePasswordSMSOtp&…` |
| Final origin | `https://login.gov.il` |

**Final destination origin MATCHES `allowedOrigin`.**  
Therefore a **final-URL origin mismatch alone cannot explain** the authoring failure. §36’s “final page wrong origin” reading is **superseded** for this fixture.

Path-only change (`/` → `/nidp/app/login?…`) is **same-origin** and must **not** trip `onNavAbort`’s origin inequality.

### 37.2 When Visual `onNavAbort` can still fire

Armed **only after** first `complete` + `tabUrlMatchesGenericTarget(loginEntryUrl)` and successful script inject — **not** during the initial create→first-complete phase.

```text
onNavAbort: if changeInfo.url present:
  nextOrigin = new URL(changeInfo.url).origin
  if nextOrigin !== allowedOrigin → finishSession(origin_mismatch)
  if URL() throws → finishSession(origin_mismatch)   // catch path
```

So Visual origin_mismatch **after arm** requires either:

- a **real intermediate (or subsequent) cross-origin** `changeInfo.url`, or  
- a **non-parseable / opaque** `changeInfo.url` coerced to the same reason via `catch`, or  
- another terminal reason misread as origin (need Ext `reason`).

Same-origin hop to `/nidp/app/login` is **not** an `onNavAbort` trigger.

### 37.3 When Analyze reports `origin_mismatch`

`collectSafePageStructureWithReadiness` (and `armVisualTargetPick` entry):

```text
if (location.origin !== expectedOrigin) → { ok:false, reason:'origin_mismatch' }
```

Observed `location.origin` at **inject/run time** on the top frame — not “final URL after Owner looks.”  
If inspect/arm runs on a document whose origin ≠ `https://login.gov.il` (stale frame, race mid-nav, unexpected intermediate document), Analyze/Visual fail **immediately** even though the tab later shows login.gov.il.

### 37.4 Intermediate cross-origin — can code prove it?

| Question | Verdict |
|---|---|
| 1. Does Login Entry nav perform intermediate **cross-origin** hops? | **E — insufficient live chain capture.** Public NIDP docs show same-host `/nidp/…` paths are common; cross-origin hops to e.g. `account.gov.il` appear in **other** gov SSO targets, not proven for bare `https://login.gov.il/` → usernamePasswordSMSOtp land. Repo cannot observe Owner’s live chain without instrumentation. |
| 2. Exact URL `onNavAbort` saw | **Unknown** — not logged today |
| 3. Exact `location.origin` at Analyze mismatch | **Unknown** — not returned to Admin (collapsed to «לא ניתן לנתח…») |

### 37.5 Distinguish A–E

| Code | Status given same final origin |
|---|---|
| **A** real intermediate cross-origin redirect | **Possible but unproven** — only explains Visual if hop occurs **after** arm; Analyze if inspect runs on that hop’s document |
| **B** Ext treats non-final nav URL as terminal | **Possible** — `onNavAbort` is eager on any foreign/`catch` URL; no “wait for settle on allowedOrigin” |
| **C** race/stale tab state | **Possible** — first `complete`+match → inject/arm while further navigation already starting; or Promise/`no_result` timing |
| **D** other terminal reason (not origin) | **Possible** — inject fail, `no_result`, channel `lastError`; Owner has not confirmed Ext `reason === origin_mismatch` |
| **E** insufficient evidence | **YES** for identifying the intermediate origin / confirming reason |

**§36 leading hypothesis revised:** not “final origin wrong,” but **early session abort (origin check or other) while tab continues to same-origin final login** — intermediate hop **or** race **or** non-origin fail still open.

### 37.6 Constraints honored

No weaken origin enforcement. No arbitrary redirects. No retry/timing workaround. No DD/impl.

### 37.7 Smallest exact live diagnostic (navigation chain)

**Goal:** capture Ext `reason` + every top-frame URL seen between create and terminal response.

On **one** failing Analyze and **one** failing Visual (Extension **service worker** DevTools, not page):

1. Confirm `[External] sendResponse: admin-login-page-inspect|admin-visual-mapping` → log full payload (`reason`, and `fieldId` if any).  
2. For Visual, temporarily observe (Owner DevTools breakpoint / existing `onUpdated` logging if enabled) each `changeInfo.url` after inject until `sendResponse`.  
3. Record ordered list: `create url` → each `changeInfo.url` → `final href` → Ext `reason`.  
4. Optional page console at failure instant: `location.origin`, `location.href` (if SW says origin_mismatch).

**Do not** change product origin policy for this diagnostic.

If Ext `reason` ≠ `origin_mismatch`, abandon intermediate-origin theory for that path and reclassify from the actual reason.

---

## Architect Review (§37)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION UPDATED**; final origins **match** — final-destination mismatch **ruled out**; intermediate/race/other **E**; Phase 120 **CLOSED**; **no DD / no impl**

### Review Notes
Owner same-origin evidence accepted. Visual `onNavAbort` only after arm; same-origin path change safe. Need Ext `reason` + URL chain. No origin weaken.

### Required Corrections
_None._

### Exact next step
**STOP.** Owner §37.7 diagnostic. Do not implement.

---

## 38. POST-120 Investigation — Live Ext reasons: Analyze “error page” / Visual `no_result` (2026-09-23)

**Status:** INVESTIGATION ONLY. Phase 120 **CLOSED**. No impl / no config / no origin weaken / no arbitrary timing.

### 38.1 Live Ext evidence (ACCEPTED)

**Analyze**
```text
ADMIN_LOGIN_PAGE_INSPECT
sendResponse admin-login-page-inspect:
  { ok:false, reason:"Frame with ID 0 is showing error page" }
```
Tab still reaches final `https://login.gov.il/nidp/app/login?…`.  
→ §36/§37 **origin_mismatch hypothesis is NOT the observed Analyze failure.**

**Visual Mapping** (separate attempt)
```text
sendResponse admin-visual-mapping:
  { ok:false, reason:"no_result", fieldId:"field-92d7597e" }
```
→ **Different reason** than Analyze. Do **not** force one shared root cause without proof.

### 38.2 Analyze — exact failure mechanism

**Source of the string:** Chrome `chrome.runtime.lastError.message` from `chrome.scripting.executeScript`, passed through verbatim:

```text
openPageAndInspectLoginStructure
  → openGenericRealSiteTab → onTabReady
  → executeScript({ files: [eligibility, locator-determinism, page-structure-inspect], frameIds:[0] })
  → if (chrome.runtime.lastError)
       finishSession({ reason: lastError.message || 'inspect_inject_failed' })
```

Chrome refuses MAIN-world injection when frame 0 is an **error interstitial** (connection/SSL/DNS/HTTP error UI, etc.). Message is Chrome’s, not Hub-authored.

**Lifecycle point:** After `status===complete'` **and** `tabUrlMatchesGenericTarget(loginEntryUrl)` → `startReadyWork` (`initialDelayMs=0`) → **first file inject**.  
**In-page readiness** (`collectSafePageStructureWithReadiness`) is **never started** — failure is **before** readiness.

**Why tab can still show valid login later:** `finishSession` only ends the Ext message; the browser tab continues navigating. An error interstitial (or transient error document) can be followed by a successful load of `login.gov.il/nidp/...` after the authoring session already aborted.

**Inspection vs intermediate/error document:** Yes — inject ran while frame 0 was in Chrome’s “error page” state, not against the final usable login document Owner sees.

| Q | Answer |
|---|---|
| API | `chrome.scripting.executeScript` → `lastError` |
| When | First inspect inject after first URL-matched `complete` |
| Readiness | After this failure (never reached) |
| Generic gap? | **Yes** — first matched `complete` ≠ durable scriptable login document |

### 38.3 Visual Mapping — exact `no_result` mechanism

**Source:** Local Ext fallback when the **second** `executeScript` (run `armVisualTargetPick`) returns without `lastError` but with falsy `results[0].result`:

```text
executeScript(files…) OK
→ executeScript(func → return armVisualTargetPick(…))  // returns Promise
→ callback:
     if (lastError) → visual_pick_run_failed / lastError.message
     else if results[0].result → finishSession(result)
     else finishSession({ ok:false, reason:'no_result', fieldId })
```

**Conditions that collapse to `no_result`:**
- `results` missing / empty, or  
- `results[0].result` is `undefined`/`null`/`0`/`''` (falsy) — structured `{ok:false,…}` would **not** become `no_result`

**Arming:** File inject **succeeded** (else reason would be inject `lastError`, e.g. error-page string). Whether `armVisualTargetPick` fully armed and waited for click is **uncertain** once result is empty — Promise may have been lost due to **document navigation/remount** while the async `executeScript` Promise was outstanding (callback with empty result, no lastError) — **leading explanation**, not fully proven.

**Owner click:** **Not proven observed** — session ended with `no_result` before a structured pick result.

**Lost specificity:** **Yes (E)** — any richer failure inside a destroyed world / non-serialized outcome becomes opaque `no_result`.

### 38.4 Shared root cause?

| | Analyze | Visual |
|---|---|---|
| Observed reason | Chrome error-page inject block | `no_result` after successful file inject |
| Lifecycle point | First inject | Second executeScript result |
| Same code line? | **No** | |

**Shared theme (architectural):** authoring binds to **early navigation lifecycle** (first URL-matched complete → inject/arm) while `login.gov.il` may still be transitioning (error interstitial → real NIDP login).  

**Single identical root cause?** **Not proven.** Treat as **related lifecycle family**, two distinct failure modes.

### 38.5 Classification

| Path | Classes |
|---|---|
| Analyze | **B** intermediate/error document + **A** navigation lifecycle race + **C** injection lifecycle; **not F** (final login usable) |
| Visual | **D** listener/session loss and/or **A** nav during Promise + **E** reason collapse to `no_result`; **H** on whether click ever fired; **not F** |

### 38.6 Generic architectural finding (proven enough to record)

Admin authoring (Analyze inject / Visual arm) currently treats **first URL-matched `complete`** as sufficient to inject into frame 0. That is **insufficient** when Chrome briefly shows an **error page** or the document is replaced before async work returns a structured result. Final usable Login Entry does not imply authoring succeeded. This is a **generic navigation/inspection lifecycle gap**, not a login.gov.il special case and not “unsupported login UX.”

### 38.7 Smallest corrective **concept** (NOT DD / NOT impl)

When later authorized (separate slice):

1. **Do not** inject authoring scripts while frame 0 is a Chrome error/interstitial document; require a **scriptable** top document at allowed origin.  
2. Prefer binding authoring start to a **settled** login document (same origin + scriptable), without arbitrary fixed sleeps as the product contract.  
3. Preserve/propagate concrete Ext reasons; avoid collapsing async loss to opaque `no_result` when `lastError` or navigation abort is knowable.  
4. **Do not** weaken origin checks; **do not** login.gov.il hardcode; **do not** first-match.

### 38.8 Remaining live diagnostic

**Optional only:** confirm whether Analyze’s tab URL at inject was `chrome-error://…` vs `https://login.gov.il/…` (SW `tabs.get` at failure). Not required to accept §38.2 mechanism. Visual: confirm whether any click occurred after Hub error (likely no).

---

## Architect Review (§38)
ARCHITECT_REVIEW_STATUS: **INVESTIGATION COMPLETE**; Analyze = **error-page inject block**; Visual = **`no_result` result collapse**; related lifecycle, not identical root; Phase 120 **CLOSED**; **no DD / no impl**

### Review Notes
Live Ext reasons accepted. origin_mismatch ruled out for Analyze. Final page usable ≠ authoring success. Generic early-complete inject gap recorded.

### Required Corrections
_None (investigation only)._

### Exact next step
**STOP.** Owner may elevate a generic authoring-lifecycle slice later. Do not implement now.

---

## 39. POST-120 Corrective A — Managed Autofill Runtime Reliability (ARCHITECTURE / DD ONLY) (2026-09-23)

**Status:** **§39 REV-2 ACCEPTED**. **A1 = ACCEPTED / CLOSED**. **A2 diagnostics IMPLEMENTED** (§39.A2.E). **A3 NOT AUTHORIZED.**  
Phase 120 remains **FORMALLY CLOSED**.  
**Fixture (defect):** Bank Leumi = Corrective A evidence only — **not** a preservation fixture.  
**Working baseline:** LB-1…LB-5 preservation fixtures; ~90% Owner live population protected.

| REV | Outcome |
|---|---|
| REV-1 | Layer A policy **ACCEPTED IN PRINCIPLE** (impl **not** authorized). |
| REV-2 | **ACCEPTED**. Diagnostic-first sequence. |
| A1 | **ACCEPTED / CLOSED** — live Rivhit M8 PASS + harness parity + offline lock green. |
| A2 | **IMPLEMENTED** — structural `fillDiagnostics` only; no fill-behavior change. |

### 39.0 North star (unchanged intent)

```text
LAYER A: DH must invoke Managed when current version-matched validated Managed authorizes it.
LAYER B: Once invoked, Managed must reliably fill and verify CURRENT visible targets.
SUCCESS: only when fill result is true — not held-ref false SUCCESS.
```

**Constraint (REV-2):** Do **not** change shared Managed runtime behavior until A3 proves the failure mechanism. Preserving the working population outranks speculative correction.

### 39.0a Two-layer separation (mandatory — unchanged)

```text
Layer A — Digital Home invocation policy
Layer B — Managed runtime fill/verify reliability
```

Independently testable. Independently revertible. Never one state machine. Fill executor never reads `loginAssistanceLevel`.

### 39.0b Authorization matrix (REV-2)

| Work | Authorized now? |
|---|---|
| Architecture / DD (§39 REV-2) | **ACCEPTED** |
| **A1** baseline-lock fixtures | **CLOSED / ACCEPTED** |
| **A2** diagnostic instrumentation | **AUTHORIZED + IMPLEMENTED** (§39.A2.E) |
| **A3** live Leumi diagnostic runs | **NOT AUTHORIZED** (Owner capture then Architecture review) |
| **A4** minimal correction DD | No (after A3) |
| **A5 / A6** | No |
| Layer A `manual_only` policy code | **NOT AUTHORIZED** |
| Layer B fill/verify/stability/rAF/retry/event changes | **NOT AUTHORIZED** |
| **S-120A-1** as production behavior | **PROPOSED / DEFERRED — NOT ACCEPTED** |

**Explicitly NOT yet authorized as production behavior:** two rAF ticks; microtask fallback; changed fill sequencing; changed event sequencing; retry; delay; stability polling; target replacement recovery; CURRENT re-resolution as required SUCCESS path; per-field completion gates that alter outcomes.

---

### 39.1 Corrective architecture decisions (REV-2)

| Decision | Binding |
|---|---|
| **D-120A-1** | Shared Managed engine for Admin Test and DH (when DH reaches it). |
| **D-120A-2** | Layer B eventual correction must be **mechanism-proven** and generic — never hostname. |
| **D-120A-3** | **Diagnostic-first:** A2 must not change fill timing, sequencing, events, verification, retry, or result semantics. |
| **D-120A-4** | Working ~90% baseline preservation is a **hard gate** (A1 + A5). No Leumi-vs-baseline trade-off. |
| **D-120A-5** | Layer A: current version-matched validated Managed is authoritative; legacy `manual_only` must not veto (**REV-1 kept**). |
| **D-120A-6** | Layer A and Layer B / A2 are **independently** shippable and revertible. |
| **D-120A-7** | **S-120A-1 is PROPOSED/DEFERRED** — may be reconsidered only in A4 after A3 evidence. **Not** an accepted production contract. |

---

### 39.2 Current fill interaction contract (observational — unchanged)

As implemented today (`fill-executor.js` / `validated-autofill.js`): focus → native value setter → beforeinput/input/change/keyup/blur → held-ref verify. Assess holds element refs; SUCCESS/`partial_fill` from held-ref verification.

**Proven defects (still true):** intermittent fill on fixture; held-ref SUCCESS can disagree with CURRENT visible state.  
**Unproven:** mechanism A–F (§39.A2.3). Do not design production correction from unproven mechanism.

---

### 39.3 Proven vs unproven (unchanged discipline)

**PROVEN:** intermittency; false SUCCESS vs CURRENT DOM; shared engine; `manual_only` Layer A gate can block DH.  
**UNPROVEN:** remount vs reset vs framework state vs timing vs sequencing vs locator instability as *the* cause.

---

## 39.A — Corrective A development sequence (normative)

### 39.A1 — BASELINE LOCK

**Goal:** Freeze accepted Managed behavior in automated fixtures **before** any Layer B behavior change and before treating diagnostics as complete.

**May change:** tests / verify scripts / fixtures only.  
**Must not change:** Managed fill interaction, verify semantics, Layer A gate (unless on separate A-LayerA track — not part of A1).

#### A1 acceptance criteria

| ID | Criterion |
|---|---|
| A1-1 | Automated fixtures cover currently accepted Managed behavior for at least: ordinary stable username/password; arbitrary dynamic credential fields; opaque/blind field IDs; multi-field sequential fill; delayed-but-ready fields already supported by current runtime; exact-one enforcement; Managed eligibility; 120.6 visibility/occlusion; 120.9 locator integrity; Admin Test and Digital Home converge on shared engine (when DH eligible); no auto-submit; validated Managed fail-closed; no silent legacy fallback |
| A1-2 | All existing Phase **117–120** automated suites remain **green** |
| A1-3 | Small **representative LIVE baseline** named from Owner-tested working services (Architecture recommends **3–5** services already known-good — **not** full ~20 retest each iteration) |
| A1-4 | Baseline lock documented (which fixtures + which live sample IDs/names) before A2 lands |

**A1 architecture lock** required before A2 authorization. **A2 still requires separate Owner auth.**

---

### 39.A1.E — A1 EVIDENCE (Owner-authorized 2026-09-23)

**A1 disposition:** **ARCHITECTURE BASELINE LOCK COMPLETE**  
**Production runtime change this turn:** **NONE** (Architect — arch artifact only; no Ext/Hub/fill edits).  
**A2:** **NOT STARTED / NOT AUTHORIZED.**

#### 1. Baseline fixtures exist (accepted-behavior lock set)

A1 **does not invent new Corrective A fill semantics**. It freezes the **existing** Phase 117–120 automated lock set that already encodes currently accepted Managed behavior:

| Lock ID | Script (accepted behavior) | Primary A1 coverage |
|---|---|---|
| L-117 | `scripts/verifyPhase117ManagedAutofill.mjs` | Stable U/P + **3-field sequential** (`username`/`password`/`business_id`); exact-one `multi_match` fail; validated claim **blocks legacy/generic** fallthrough; `HUB_MANAGED_AUTOFILL`; no Rivhit hard-codes in runtime |
| L-117-M8 | `scripts/verifyPhase117RivhitLiveM8.mjs` | Live-oriented Managed path; **no auto-submit** |
| L-119-R | `scripts/verifyPhase119ReadinessWaitInputs.mjs` | **Delayed-but-ready** input appear within readiness window (Analyze/inspect contract already shipped) |
| L-119-V | `scripts/verifyPhase119VisualMapping.mjs` | Exact-one Visual; submit not an autofill target |
| L-120.4/6-E | `scripts/verifyPhase120ManagedEligibility.mjs` | Managed target eligibility matrix (post-120.6) |
| L-120.6-V | `scripts/verifyPhase120ManagedVisibility.mjs` | Visibility / ancestor `aria-hidden` vs occlusion; no auto-submit; no site branches |
| L-120.5 | `scripts/verifyPhase120AdminManagedTestHarness.mjs` | **Admin Test** → `sendManagedAutofillPayloadAndAwait` (shared engine); fail-closed temps; no auto-submit |
| L-120.2-AP | `scripts/verifyPhase120ManagedActivateGate.mjs` | Activate / exact-one fail-closed |
| L-120.8 | `scripts/verifyPhase120IdentityAuthoring.mjs` | **Opaque/blind field IDs**; dynamic credential field count; authoring≠runtime |
| L-120.9 | `scripts/verifyPhase120LocatorVerification.mjs` | **120.9** exact-one locator integrity; Managed multi_match fail-closed preserved |
| L-120-mig | `scripts/verifyPhase120ShufersalMigration.mjs` | Config-only Managed migration fixture (no site adapter) |
| L-118 | `scripts/verifyPhase118AssistedMapping.mjs` | Assisted-mapping safety regressions retained |

**Shared-engine proof (Admin Test = DH fill core):** both Admin harness (`sendManagedAutofillPayloadAndAwait`) and DH (`executeManagedAutofill` → same await helper → `HUB_MANAGED_AUTOFILL` → `runManagedAutofill`) are covered by L-117 + L-120.5 static/call-graph + fill harness evidence. A1 locks **that convergence**, not path-specific algorithms.

#### 2. Fixtures test accepted behavior — not Corrective A new behavior

| Statement | Binding |
|---|---|
| Held-ref verify / current fill event contract | **Accepted as-is** for A1 (known imperfect vs Leumi — **not** encoded as “fixed”) |
| CURRENT re-query / S-120A-1 / per-field completion | **Not** required by A1 fixtures — **not** accepted production behavior |
| Layer A validated-overrides-`manual_only` | **Not** encoded as expected automated PASS — policy accepted in principle, **impl not authorized** |
| Bank Leumi intermittency | **Defect fixture** — excluded from live preservation sample |

#### 3. No production runtime behavior changed

| Area | A1 action |
|---|---|
| `extension/generic/fill-executor.js` | **Unchanged** |
| `extension/generic/validated-autofill.js` | **Unchanged** |
| Hub Managed execution / Layer A gates | **Unchanged** |
| Architect deliverable | `team-Yuri/arch-phase120.md` §39.A1.E only |

#### 4. Phase 117–120 suites — green evidence basis

| Evidence class | Record |
|---|---|
| **Closure snapshot** | Phase 120 Final Closure (2026-09-22) recorded L-117 / L-118 / L-119 / L-120.4–120.9 verifies **PASS** as architecture-accepted (see FA matrix §24 / §27 / slice closes). |
| **A1 lock meaning** | Those scripts **are** the A1 automated baseline. Re-running them is **confirmation**, not a new product contract. |
| **Architect constraint** | Architect does **not** execute verify scripts (role A3). **A1-EXEC reconfirmation** (optional before A2 Owner auth) may be performed by Developer/Manager with the command list below — must remain green; any red **blocks A2**. |

**A1-EXEC command list (confirmation only — no behavior change):**

```text
node scripts/verifyPhase117ManagedAutofill.mjs
node scripts/verifyPhase117RivhitLiveM8.mjs
node scripts/verifyPhase118AssistedMapping.mjs
node scripts/verifyPhase119ReadinessWaitInputs.mjs
node scripts/verifyPhase119VisualMapping.mjs
node scripts/verifyPhase120ManagedEligibility.mjs
node scripts/verifyPhase120ManagedVisibility.mjs
node scripts/verifyPhase120AdminManagedTestHarness.mjs
node scripts/verifyPhase120ManagedActivateGate.mjs
node scripts/verifyPhase120IdentityAuthoring.mjs
node scripts/verifyPhase120LocatorVerification.mjs
node scripts/verifyPhase120ShufersalMigration.mjs
```

#### 5. Representative live baseline sample (preservation fixtures)

**Purpose:** Later A5 smoke only. **Not** Corrective A experiments. **Not** full ~20 retest each iteration.  
**Exclude:** Bank Leumi (defect under diagnosis); Amex composite; Rimon route/modal; Government Personal Area authoring; City Car; any known-failing / unsupported capability surface.

| ID | Service (fixture name) | Architectural variation locked | Prior evidence basis |
|---|---|---|---|
| **LB-1** | **Shufersal** | Classic stable **username/password** Managed; config-only pilot; DH + Admin | FA-120.2 P4; 120.9 L4 DH fill; no auto-submit |
| **LB-2** | **Rivhit** | **Multi-field sequential** (`username`, `password`, `business_id`); shared Managed engine | Phase 117; §23 DH three-field; Admin Test |
| **LB-3** | **Meuhedet** | **Non-username vocabulary** field IDs (`id_number` / `mobile_number`); Visual→Managed | Phase 119.2; FA R2 |
| **LB-4** | **Spotify** | Second simple consumer login; distinct from grocery/bank U/P | Phase 119.2 DH/Visual |
| **LB-5** | **Hapoalim** | **Delayed-but-ready** login surface (readiness capability already accepted) | Phase 119.3 readiness; FA R3 |

**Justification:** Five fixtures span U/P classic, 3-field sequential, alternate schema IDs, second consumer simple login, and delayed-ready — not five clones of the same page. They are **preservation** anchors for A5, not experiment targets for A2–A4.

#### 6. Known gaps (documented — not silently encoded as expected)

| Gap | Disposition |
|---|---|
| No single umbrella `verifyPhase120A1BaselineLock.mjs` | **DOC/orchestration gap only** — coverage is the lock-set above; umbrella optional later, not required for A1 architecture PASS |
| Delayed-ready L-119-R is primarily **Analyze/inspect readiness**, not a separate Managed fill “wait loop” product claim | **Documented** — do not treat Analyze delayed-appear as proof of a new Managed fill timing contract |
| Held-ref SUCCESS can disagree with CURRENT DOM (Leumi) | **Known defect** — A1 freezes current behavior; does **not** mark false SUCCESS as acceptable product intent |
| DH + catalog `manual_only` can block validated Managed | **Known Layer A policy gap** — REV-1 accepts direction; **not** A1 expected automated behavior; **impl not authorized** |
| ~10% Owner live failures outside LB sample | **Out of A1** — not preservation fixtures; do not expand A1 to full catalog |
| A1-EXEC not re-run in this Architect turn | **Process gap** — closure snapshot stands; reconfirm before A2 if Owner requires fresh CI green |

#### A1 acceptance checklist (architecture)

| # | Owner requirement | Result |
|---|---|---|
| 1 | Baseline fixtures exist | **PASS** — L-117…L-120.9 lock set |
| 2 | Test accepted behavior, not new behavior | **PASS** |
| 3 | No production runtime change | **PASS** |
| 4 | Relevant 117–120 suites PASS | **FAIL** — A1-EXEC 11/12 green; RivhitLiveM8 **FAIL** (§39.A1.E.7) |
| 5 | Live baseline named + justified | **PASS** — LB-1…LB-5 |
| 6 | Gaps documented | **PASS** — §39.A1.E.6 |

**A1 disposition after A1-EXEC:** **NOT CLOSED / BASELINE NOT LOCKED.** **A2 remains unauthorized and blocked** until Owner/Architecture disposition of the FAIL (do not “fix” as part of A1).

---

### 39.A1.E.7 — A1-EXEC regression run (2026-09-23)

**Purpose:** Baseline confirmation only against **current working tree**. No production/runtime/test edits.

| Reference | Value |
|---|---|
| **HEAD commit** | `e22caf2d8ec84ba40ba663994808a4ab4bf0af6b` — `Phase 120 - Dynamic Managed Autofill. No shupersal etc.` |
| **Working tree** | Dirty: `team-yuri/arch-phase120.md` only (architecture evidence). **No** Ext/Hub/fill/test source changes. |
| **Runtime** | Node.js v22.12.0 (Windows) |
| **Overall** | **11 PASS / 1 FAIL** → **A1 NOT CLOSED**; **A2 BLOCKED** |

#### Suite results

| Command / suite | Result | Counts / notes |
|---|---|---|
| `node scripts/verifyPhase117ManagedAutofill.mjs` | **PASS** | T0–T28 + offline M8 + AC-117-30…37; T29 = this script + tsc/build (script self-report) |
| `node scripts/verifyPhase117RivhitLiveM8.mjs` | **FAIL** | See failure evidence below — **did not complete product asserts** |
| `node scripts/verifyPhase118AssistedMapping.mjs` | **PASS** | Script self-report PASS |
| `node scripts/verifyPhase119ReadinessWaitInputs.mjs` | **PASS** | AC-119-R-1…R-8 covered; R-9 Owner live residual not claimed |
| `node scripts/verifyPhase119VisualMapping.mjs` | **PASS** | Script self-report PASS |
| `node scripts/verifyPhase120ManagedEligibility.mjs` | **PASS** | R1–R10 matrix (+ R11–R14 via regression note); F-ANC-ACTIVE / F-SELF |
| `node scripts/verifyPhase120ManagedVisibility.mjs` | **PASS** | Phase 120.6 visibility correction |
| `node scripts/verifyPhase120AdminManagedTestHarness.mjs` | **PASS** | AC-120.5-1…3,6…9,11,12; D-120-12/13; no auto-submit; F-SELF |
| `node scripts/verifyPhase120ManagedActivateGate.mjs` | **PASS** | AC-120.2-AP-1…11 |
| `node scripts/verifyPhase120IdentityAuthoring.mjs` | **PASS** | A–K (120.8) |
| `node scripts/verifyPhase120LocatorVerification.mjs` | **PASS** | 120.9 R1–R8, R12 + locks (R9–R11/R13–R15 deferred to other suites) |
| `node scripts/verifyPhase120ShufersalMigration.mjs` | **PASS** | Static AC-120.2-2/3/8/9 |

#### Failure evidence — `verifyPhase117RivhitLiveM8.mjs`

```text
TypeError: fetch failed
  at async main (scripts/verifyPhase117RivhitLiveM8.mjs:118)
cause: Error: connect EACCES 31.168.168.237:443
  errno: -4092
  code: EACCES
  syscall: connect
  address: 31.168.168.237
  port: 443
```

**What this script is:** Operator live Rivhit Login Entry HTML fetch → in-memory Managed runner (Phase 117 M8). Requires outbound HTTPS to Rivhit. Does not persist validation or submit credentials.

**Architecture classification (review — not a fix):**

| Question | Assessment |
|---|---|
| Product Managed fill/verify regression in tree? | **Not indicated** — failure is **before** Managed DOM asserts (TCP `EACCES` on live fetch). Offline `verifyPhase117ManagedAutofill.mjs` (includes M8-class coverage) **PASS**. |
| Environment / network / policy block? | **Leading** — `EACCES` on connect to live host:443 from this machine/runtime. |
| Unexpected vs known flaky live gate? | **Unexpected for A1-EXEC green requirement** — listed suite must PASS for A1 CLOSED. |
| Allowed A1 action? | **None** — do not alter tests, cafile, or runtime to force PASS under this action. |

**Impact:** Per Owner rule, this FAIL **blocks A2**. A1 remains **not** CLOSED until Owner/Architecture accepts a disposition (e.g. re-run when network allows; or explicitly carve live-M8 as non-blocking with offline L-117 standing — **requires Owner decision**, not Architect unilateral).

**Not done:** no test changes, no production changes, no A2, no Layer A, no S-120A-1.

---

### 39.A1.E.8 — RivhitLiveM8 `targets_not_ready` investigation (2026-09-23)

**Trigger:** Owner Operator workstation: outbound HTTPS OK; assert `M8 runner failed: targets_not_ready`. Supersedes EACCES classification for this FAIL.

**Investigation only — no code/test/runtime changes.**

| Finding | Evidence |
|---|---|
| M8 gate locators | `phase117-rivhit-e2e-gate.json`: `#username`, `#password`, `#osek`; Login Entry `https://online1.rivhit.co.il/loginmanager/login` |
| Match vs accepted Rivhit Managed (120.7–120.9 / §23) | **Same** fieldIds + locators + origin historically accepted |
| Pre-runner asserts in M8 | exact-one / INPUT / not hidden / editable — **must have PASS**ed before `runManagedAutofill` (else different assert text) |
| Runner fail | `assessManagedTargetsReady` → `targets_not_ready` |
| Per-field detail (code path) | First mapped field that fails `isSafeFillTarget` — order starts at **`username` / `#username`**. Without `ManagedTargetEligibility` loaded, detail defaults to **`unsafe_target`** (not zero/multi/hidden) |
| Root cause class | **D — verification harness mismatch with current Managed contract** |

**Mechanism (proven in source):**

1. Post-120.6 `GenericFillExecutor.isSafeFillTarget` **fail-closed** unless `ManagedTargetEligibility` is present (`fill-executor.js`).  
2. Production Ext injects `managed-target-eligibility.js` (`background.js`).  
3. Offline `verifyPhase117ManagedAutofill.mjs` loads eligibility **+** `installManagedDomGeometry`.  
4. **`verifyPhase117RivhitLiveM8.mjs` does not** load `managed-target-eligibility.js` and does not install the 120.6 geometry harness — only form-detector / fill-executor / validated-autofill.  
5. Therefore every live exact-one input fails readiness → `targets_not_ready` / **`unsafe_target`**, independent of live DOM drift.

**Not indicated as primary:** A (Managed production regression), B (live Rivhit DOM drift), C (stale `#username`/`#password`/`#osek` vs accepted config). Secondary note: even after loading eligibility, M8’s identical overlapping rect stubs would still risk V8 `occluded`/`not_interactable` without `installManagedDomGeometry` — still harness, not product.

**A1/A2:** A1 remains **OPEN**; A2 remains **BLOCKED** until Owner disposition (harness alignment is a test-only fix when authorized — **not** under this investigation).

---

### 39.A1.E.9 — RivhitLiveM8 harness parity (TEST-ONLY) (2026-09-23)

**Authorized:** Owner — harness parity correction only (post §39.A1.E.8 ACCEPT).  
**Change:** `scripts/verifyPhase117RivhitLiveM8.mjs` now loads `managed-target-eligibility.js` and `installManagedDomGeometry` (same as offline `verifyPhase117ManagedAutofill.mjs`).  
**Unchanged:** production runtime, eligibility rules, Rivhit locators/assertions, Layer A, A2, S-120A-1.  
**Live M8:** Owner must re-run locally — Architect/agent does **not** claim live PASS.

---

### 39.A2 — DIAGNOSTIC INSTRUMENTATION ONLY

**Goal:** Smallest generic instrumentation to distinguish Bank Leumi failure mechanism.  
**Must NOT change:** fill timing, sequencing, events, verification logic, retry, delays, result ok/fail semantics, Hub SUCCESS mapping.

**Path:** Shared Managed engine only — evidence available for **both** Admin Test and Digital Home when each reaches the engine.

#### A2 exact diagnostic instrumentation contract

**Stages (minimum ordered stamps per field lifecycle):**

```text
assess_resolve | pre_fill | post_fill_immediate | post_field_advance | verify_held | verify_current_probe
```

`verify_current_probe` is **read-only** observation for diagnosis (locator re-query + structural compare). It **must not** change the returned SUCCESS/`partial_fill` decision in A2.

**Per stamp — SAFE structural fields only:**

| Field | Allowed |
|---|---|
| `runId` | opaque correlation id |
| `fieldId` | yes |
| `locator` | yes (selector string — not value) |
| `stage` | yes |
| `matchCount` / exact-one result | yes (`exact_one` / `zero` / `multi`) |
| `managedEligible` | boolean |
| `heldConnected` | boolean |
| `heldEqualsCurrent` | boolean (identity) |
| `targetReplaced` | boolean (held vs current identity / connectedness) |
| `expectedValueMatchHeld` | boolean only |
| `expectedValueMatchCurrent` | boolean only |
| `stageOrderIndex` | yes |
| `structuredReason` | existing reason codes if any |
| `path` | `admin_test` / `digital_home` |

**NEVER log:** credential values, passwords, username contents, secrets, raw `.value` strings.

**Emission:** Ext structured diagnostic channel / Admin Test summary attachment preferred; no PII. Default off or Owner-gated if needed — but when on, must not alter fill path.

#### A2.3 Mechanisms to distinguish (minimum)

| Code | Mechanism |
|---|---|
| **A** | Same target receives value then resets (`heldEqualsCurrent`, held match true then later false without replace) |
| **B** | Target replaced/remounted (`targetReplaced` / held≠current / connected flip) |
| **C** | Fill interaction does not establish durable framework state (post_fill match false immediately on held) |
| **D** | Locator / current-target instability (exact-one flips; matchCount changes) |
| **E** | Sequencing: later field invalidates earlier (`expectedValueMatch*` on prior fieldId drops after next fill) |
| **F** | Other generic — capture enough stage ordering to show it is none of A–E |

#### A2 acceptance

| ID | Criterion |
|---|---|
| A2-1 | Instrumentation present on shared engine; Admin Test and DH (when invoked) both produce stamps |
| A2-2 | Proof (code review / verify) that fill timing, event order, verify decision, and result semantics are **unchanged** vs pre-A2 |
| A2-3 | No secret/value logging |
| A2-4 | A1 suites still green |

---

### 39.A2.E — A2 implementation evidence (2026-09-23)

**Status:** **IMPLEMENTED** (Owner-authorized). Behavior contract **unchanged**.

| Item | Record |
|---|---|
| Files | `extension/generic/validated-autofill.js` (stamps); `extension/background.js` (pass-through + SW log); `src/execution/managedAutofill.ts` (path + forward); `src/admin/AutofillProfileEditor.tsx` (console capture hint); `scripts/verifyPhase120A2ManagedFillDiagnostics.mjs` |
| Stages | `assess_resolve`, `pre_fill`, `post_fill_immediate`, `post_field_advance`, `verify_held`, `verify_current_probe` (read-only; outcome decided before probe stamps) |
| Schema | `fillDiagnostics: { runId, path, stamps[] }` — booleans/ids/locators/stages only |
| No fill branch | Ext has **no** `admin_test` literal; path is opaque string pass-through from Hub |
| Offline | A1 lock suites + A2 verify **ALL_PASS** (2026-09-23) |
| Live Leumi | **Not diagnosed yet** — Owner Admin Test capture required (§39.A2.E Owner procedure) |

**Owner Admin Test capture (Bank Leumi) — primary A3 path:**

1. Reload Hub + reload extension (pick up A2 builds).  
2. Admin → Bank Leumi → saved validated Managed mappings + temp values.  
3. Run **Admin Managed Autofill Test**.  
4. Open browser DevTools console on the Hub page → copy `[A2 ManagedFillDiagnostics]` object (or Extension service-worker log `[ManagedAutofillDiag] fillDiagnostics`).  
5. Optionally repeat on intermittent SUCCESS / partial / empty-UI outcomes.  
6. Return stamps to Architecture for A3 — **do not** change fill code.

---

### 39.A3 — ROOT-CAUSE EVIDENCE GATE

**Goal:** Run Bank Leumi with A2 diagnostics until mechanism is identified **sufficiently** to justify a generic change.

| Rule | Binding |
|---|---|
| Primary diagnostic path | **Admin Test** (bypasses Layer A — avoids confounding invocation policy) |
| DH diagnostic runs | Optional; only if Layer A already independently enabled, or after A-LayerA — must not replace Admin evidence |
| Ambiguous evidence | **Improve diagnostics (A2.1)** — do **not** guess; do **not** start A4 correction |
| Hostname special case | Forbidden |

**A3 PASS:** Written evidence maps observed stamps → one or more of A–F (or new named generic mechanism) with enough confidence that Architecture can design a **minimal** correction. Owner/Architecture agree mechanism is proven enough.

**A3 FAIL / hold:** Remain on diagnostics. No Layer B behavior change.

---

### 39.A3.E — A3 root-cause review (Bank Leumi Admin Test ×2) (2026-09-23)

**Evidence source:** Two independent Admin Test runs; both UI 0 fields filled; Ext/Hub `fill_failed` on first field `field-cccf74e4`; second field never attempted.

#### Current `fillField` sequence (unchanged — observational)

```text
focus → setNativeInputValue → beforeinput → input → change → keyup → blur → readValue === expected ?
```

(`extension/generic/fill-executor.js`)

#### Proven (these failures)

| # | Proven fact |
|---|---|
| P1 | Assess finds both `#_R_6pinot66mivb_` and `#_R_apinot66mivb_` **exact_one** + **managedEligible=true** |
| P2 | Failure is on **first** mapped field (`field-cccf74e4`); fill aborts before second field |
| P3 | Across `pre_fill` → `post_fill_immediate`: **same** held target (`heldEqualsCurrent=true`, `targetReplaced=false`, `heldConnected=true`) |
| P4 | After entire `fillField` returns, expected value is **not** present on held/current (`expectedValueMatchHeld/Current=false` at `post_fill_immediate`) → `fillField` returned `ok:false` (`fill_failed`) |
| P5 | Signature **reproduced** in two consecutive independent runs |
| P6 | Failure is **inside** `GenericFillExecutor.fillField` (or synchronously during its interaction sequence) on the first field — not assess, not verify_mappings, not cross-field |

#### Ruled out (these failures)

| Code | Mechanism | Why ruled out |
|---|---|---|
| B (A2 taxonomy remount) | Target replacement/remount between pre/post | `heldEqualsCurrent=true`, `targetReplaced=false` |
| D | Locator / current-target instability during fill | exact_one stable; identity stable |
| E | Later field invalidates earlier | Second field never filled |
| Assess/eligibility | Targets not ready / ineligible | Assess PASS both fields |
| Cross-field password clear of username | N/A | Never reached |

#### Not yet distinguished (blocks Layer B DD)

| Intra-`fillField` hypothesis | Meaning |
|---|---|
| **A′** | Native value setter never establishes expected DOM value |
| **B′** | Setter establishes value, then a subsequent dispatched interaction (`beforeinput`/`input`/`change`/`keyup`/`blur`) synchronously clears or rejects it |

Current A2 stamps bracket **`fillField` as a whole** → cannot tell A′ from B′.  
Do **not** invent React/framework-specific Layer B design from this ambiguity.

#### A3 decision

| Question | Decision |
|---|---|
| Sufficient to authorize minimal Layer B correction DD? | **NO** |
| Required next step | **A2.1** — minimum read-only intra-`fillField` match probes (§39.A2.1) |
| Layer B / S-120A-1 / Layer A | **NOT AUTHORIZED** |
| A1 baseline | **Remains locked** |

**A3 status:** **HOLD** — diagnostic refinement required; not A3 PASS for correction.

---

### 39.A2.1 — Intra-fillField diagnostic refinement (SPEC ONLY)

**Purpose:** Distinguish A′ vs B′ without changing fill behavior.  
**Impl:** **NOT auto-authorized** — Owner must ACCEPT this A2.1 spec before Developer implements.

**Hard constraints (same as A2):** no event order change; no add/remove events; no delay/retry; no setter change; no verification/outcome change; no credential/value logging; no hostname/Leumi branches.

**Minimum read-only boolean probes** (expectedValueMatch on **same held element** only — never log values), inserted **between** existing steps without altering them:

| Probe stage | Insert point |
|---|---|
| `fill_post_focus` | After `focus()`, before `setNativeInputValue` (optional baseline; value usually still unmatched) |
| `fill_post_native_set` | **Immediately after** `setNativeInputValue`, **before** any `dispatchEvent` — **required** for A′ |
| `fill_post_events` | After `dispatchInputEvents` completes (after keyup), **before** `blur` — **required** for B′ mid-sequence |
| `fill_post_blur` | After `blur`, before fillField return (may equal today’s post_fill_immediate) — **required** |

**Interpretation (after Owner re-capture):**

| `fill_post_native_set` | `fill_post_events` / `fill_post_blur` | Disposition |
|---|---|---|
| false | * | **A′** — setter never established expected value |
| true | false | **B′** — established then cleared/rejected by subsequent interaction |
| true | true | Unexpected vs current `fill_failed` — re-check evidence / race |

Optional later refinement (only if A2.1 still ambiguous): per-event probes after `beforeinput` / `input` / `change` / `keyup` individually — **not** in the minimum set.

**Emission:** Append these stages into existing `fillDiagnostics.stamps` (same safe schema). Prefer sampling only when `diagnosticPath` present / diagnostics already enabled — must not change fill path when stamps are collected.

---

### 39.A2.1.E — A2.1 implementation evidence (2026-09-23)

**Status:** **IMPLEMENTED** (Owner ACCEPT of §39.A2.1).

| Item | Record |
|---|---|
| Files | `extension/generic/fill-executor.js` (boolean probes); `extension/generic/validated-autofill.js` (emit stamps); `scripts/verifyPhase120A2ManagedFillDiagnostics.mjs` |
| Stamps | `fill_post_native_set`, `fill_post_events`, `fill_post_blur` — `expectedValueMatchHeld` boolean only |
| Behavior | `ok`/`verified` still = post-blur `readValue === expected` (unchanged); probes do not alter control flow |
| Regression | A1 lock set + A2/A2.1 verify **ALL_PASS** |
| Layer B | **NOT** started |

**Owner capture (ONE Bank Leumi Admin Test):** reload Hub + extension → Admin Test → copy `[A2 ManagedFillDiagnostics]` → inspect first field’s three A2.1 stamps for A′ vs B′.

---

### 39.A3.E2 — A3 evidence update (A2.1 live capture) (2026-09-23)

**Evidence (first field `field-cccf74e4` / `#_R_6pinot66mivb_`):**

| Stage | `expectedValueMatchHeld` |
|---|---|
| `pre_fill` | false |
| `fill_post_native_set` | **true** |
| `fill_post_events` | **false** |
| `fill_post_blur` | false |
| `post_fill_immediate` | false (same held; exact_one; eligible; not replaced) |

#### Disposition

| Item | Decision |
|---|---|
| **A′** (setter never establishes value) | **RULED OUT** — `fill_post_native_set=true` |
| **B′** (lost during/after interactions) | **PROVEN at current boundary** — value present after native set; absent after `dispatchInputEvents`, **before blur** |
| Blur as first loss point | **RULED OUT** |
| Remount / locator / eligibility / cross-field / delayed reset | **RULED OUT** (unchanged + post_fill identity stable) |

#### `dispatchInputEvents` inspection (no code change)

Current implementation dispatches **multiple** existing events, in order:

```text
1. beforeinput   (InputEvent insertText; optional try/catch if unsupported)
2. input         (InputEvent insertText; fallback Event('input'))
3. change        (Event)
4. keyup         (KeyboardEvent; optional try/catch)
```

A2.1’s single `fill_post_events` stamp only proves loss somewhere **inside this multi-event sequence**. It does **not** identify which **existing** event first flips match true→false.

#### A3 decision (E2)

| Question | Decision |
|---|---|
| Authorize A4 / Layer B correction DD now? | **NO** — responsible event not yet proven; A1 population must not be risked on a guessed event-sequence change |
| Next step | **A2.2** — minimum per-event boolean probes (§39.A2.2) |
| A3 status | **HOLD** (refined) — B′ boundary known; event identity open |

---

### 39.A2.2 — Per-event diagnostic refinement inside `dispatchInputEvents` (SPEC ONLY)

**Purpose:** Identify the **first** existing dispatched event after which `expectedValueMatchHeld` becomes false.  
**Impl:** **NOT auto-authorized** — Owner must ACCEPT this A2.2 spec before Developer implements.

**Hard constraints:** no add/remove/reorder of events; no timing/retry; no setter/focus/blur/verify/outcome change; no credential/value logging; no hostname/Leumi branches; A1 baseline locked.

**Minimum read-only probes** (boolean `expectedValueMatchHeld` on **same held element** only), immediately **after each existing dispatch** that actually runs:

| Probe stage | After existing step |
|---|---|
| `fill_post_beforeinput` | After `beforeinput` dispatch (or after skipped/unsupported catch — still stamp once control returns from that try block) |
| `fill_post_input` | After successful `input` dispatch (InputEvent or fallback `Event('input')`) |
| `fill_post_change` | After `change` dispatch |
| `fill_post_keyup` | After `keyup` dispatch (or after skipped/unsupported catch) |

Preserve exact existing try/catch structure and order. Do **not** invent new events to “make probing easier.”

**Interpretation (after Owner re-capture):**

```text
Find first stage among beforeinput → input → change → keyup
where expectedValueMatchHeld flips from true to false.
That stage’s preceding event is the FIRST responsible existing boundary.
```

If `fill_post_native_set` remains true and the first false is at `fill_post_beforeinput`, responsibility is the `beforeinput` dispatch (or its listeners). Same pattern for later events.

**Only after A2.2 evidence:** Architecture may return A4 minimal Layer B DD sized to the **proven** event boundary — still generic, still regression-gated by A1. No S-120A-1 by default.

---

### 39.A2.2.E — A2.2 implementation evidence (2026-09-23)

**Status:** **IMPLEMENTED** (Owner ACCEPT of §39.A2.2).

| Item | Record |
|---|---|
| Files | `extension/generic/fill-executor.js` (`dispatchInputEvents` probes); `extension/generic/validated-autofill.js` (stamp emit order); `scripts/verifyPhase120A2ManagedFillDiagnostics.mjs` |
| Stamps | `fill_post_beforeinput`, `fill_post_input`, `fill_post_change`, `fill_post_keyup` — boolean `expectedValueMatchHeld` only |
| Event order | Unchanged: beforeinput → input → change → keyup |
| Regression | `ALL_A1_A2_A21_A22_PASS` |
| Layer B / A4 | **NOT** started |

**Owner capture (ONE Bank Leumi Admin Test):** reload Hub + extension → Admin Test → copy `[A2 ManagedFillDiagnostics]` → with `fill_post_native_set=true`, find first of the four A2.2 stamps that is `false`.

---

### 39.A3.E3 — A3 root-cause boundary PROVEN (A2.2 live) (2026-09-23)

**Live evidence (first field `field-cccf74e4` / `#_R_6pinot66mivb_`, same held element):**

| Stage | `expectedValueMatchHeld` |
|---|---|
| `fill_post_native_set` | **true** |
| `fill_post_beforeinput` | **true** |
| `fill_post_input` | **false** ← **FIRST loss** |
| `fill_post_change` | false |
| `fill_post_keyup` | false |
| `fill_post_events` / `fill_post_blur` | false |
| Final identity | exact_one, eligible, connected, heldEqualsCurrent, not replaced |

#### Ruled out (this failure)

Native setter inability; `beforeinput` as first loss; blur as first loss; locator/eligibility failure; remount/replacement; current-target instability; cross-field/password invalidation; delayed post-fill reset.

#### Proven boundary

**The existing `input` dispatch is the first observed event boundary after which the expected DOM value no longer matches.**  
Do **not** conclude “remove `input`” from this alone.

---

### 39.A3.E3.I — Implementation inspection (CURRENT `fill-executor.js` only)

#### Native setter

```text
HTMLInputElement.prototype.value descriptor.set.call(element, value)
  else element.value = value
```

Same native-setter pattern as legacy demo fill (`extension/mappings.js`, POC background inject).

#### Event sequence (production order — unchanged)

```text
focus → setNativeInputValue → beforeinput → input → change → keyup → blur → verify
```

#### Event construction (Managed `dispatchInputEvents`)

| Event | Constructor | bubbles | cancelable | composed | Other |
|---|---|---|---|---|---|
| **beforeinput** | `InputEvent` | true | **true** | true | `inputType: 'insertText'`, `data: element.value` (full current value string; **not logged**) |
| **input** | `InputEvent` (fallback `Event('input')` if ctor throws) | true | **true** | true | `inputType: 'insertText'`, `data: element.value` (full value; **not logged**) |
| **change** | `Event` | true | default false | true | no inputType/data |
| **keyup** | `KeyboardEvent` | true | true | default | `key: 'Unidentified'` |

#### Coherence vs browser-like editing transaction

| Aspect | Typical user edit | Current Managed path |
|---|---|---|
| Order | `beforeinput` → **then** DOM value change → `input` | **Value set first**, then `beforeinput`, then `input` |
| `input.cancelable` | Usually **false** for `input` | **true** (non-typical) |
| `input` payload | Often reflects incremental edit; many apps ignore | `inputType:'insertText'` + `data` = **entire** field value after set |
| `change` timing | Often on commit/blur for text inputs | Fired **immediately** after `input`, before blur |
| `keyup` | Follows real keydown/keypress | Synthetic after programmatic set (no keydown) |

**Compatibility note:** Native setter + synthetic events is a common autofill pattern. Legacy repo fill (`mappings.js` / POC) uses **simpler** `InputEvent('input', { bubbles, cancelable })` **without** `inputType`/`data`/`composed`, and **without** `beforeinput`/`keyup`. Managed path is a **richer, more synthetic** contract; A2.2 proves loss specifically on the Managed `input` dispatch.

#### Decision gate (E3)

| Option | Choice |
|---|---|
| **A** — mechanism sufficient for **A4 DD SPEC ONLY** | **SELECTED** |
| **B** — A2.3 more diagnostics | Not required for boundary; optional later if A4 option selection needs constructor A/B |

**A3 status:** **BOUNDARY PROVEN** → proceed to **§39.A4.D0 SPEC ONLY** (no impl).

---

### 39.A4.D0 — A4 O1 DD: Managed `input` notification normalization (SPEC ONLY)

**Status:** **O1 DD ACCEPTED.** **O1-IMPL landed.** **O1 LIVE RELIABILITY ACCEPTANCE = FAILED** (2026-09-23) — see **§39.A4.E1**.  
**O1 production acceptance:** **REJECTED.** Digital Home / O2-on-O1: **FORBIDDEN.**  
**Scope:** O1 failed as reliability fix. O2–O4 deferred — **not** stacked on unreverted O1.  
**A2.3:** Deferred pending O1 FAIL stamp capture (§39.A4.E1 recommendation B).

---

#### 0. Evidence basis (binding)

| Fact | Source |
|---|---|
| Native setter establishes expected value | A2.1 `fill_post_native_set=true` |
| `beforeinput` preserves value | A2.2 `fill_post_beforeinput=true` |
| **First loss at existing `input` dispatch** | A2.2 `fill_post_input=false` |
| Same held eligible exact-one target | post_fill identity stamps |
| Fixture | Bank Leumi Admin Test (evidence only — **not** a site requirement) |

O1 **must not** become “remove `input`.”

---

#### 1. Current `input` event contract (Managed — `extension/generic/fill-executor.js`)

Primary path (inside `dispatchInputEvents`, after `beforeinput`, before `change`):

```text
new InputEvent('input', {
  bubbles: true,
  cancelable: true,
  composed: true,
  inputType: 'insertText',
  data: <string = element.value at dispatch time>   // full field contents; never logged
})
```

Fallback (only if `InputEvent` construction/dispatch throws):

```text
new Event('input', { bubbles: true, composed: true })
```

Surrounding sequence (**not** changed by O1):

```text
focus → setNativeInputValue → beforeinput → [INPUT] → change → keyup → blur → verify
```

---

#### 2. Proposed `input` event contract (O1)

Primary path:

```text
new InputEvent('input', {
  bubbles: true,
  cancelable: true,
  composed: true
  // inputType: OMITTED
  // data: OMITTED
})
```

Fallback (unchanged semantics — if `InputEvent` throws):

```text
new Event('input', { bubbles: true, composed: true })
```

Rationale alignment: matches the simpler notification used by existing repo demo/legacy fill (`extension/mappings.js` / POC inject): `InputEvent('input', { bubbles: true, cancelable: true })` without `inputType`/`data`. O1 additionally retains `composed: true` for shadow-boundary continuity with current Managed `beforeinput`/`change` (legacy demo omits `composed` on `input`; retaining it does not reintroduce `insertText`/`data`).

---

#### 3. Exact property-level delta

| Property | Current | Proposed O1 | Delta |
|---|---|---|---|
| Constructor (primary) | `InputEvent` | `InputEvent` | **unchanged** |
| Event type name | `'input'` | `'input'` | **unchanged** — notification preserved |
| `bubbles` | `true` | `true` | unchanged |
| `cancelable` | `true` | `true` | unchanged |
| `composed` | `true` | `true` | unchanged |
| `inputType` | `'insertText'` | **omitted** | **REMOVE** |
| `data` | full `element.value` string | **omitted** | **REMOVE** |
| Fallback | `Event('input', { bubbles, composed })` | same | unchanged |
| try/catch structure | InputEvent try → Event fallback | same | unchanged |

**Single code locus:** the `new InputEvent('input', { … })` object literal inside `dispatchInputEvents` in `extension/generic/fill-executor.js`. No other modules required for O1.

---

#### 4. Why this remains a generic framework notification (not a Leumi workaround)

- Change applies to the **shared** Managed `GenericFillExecutor` used by Admin Test and Digital Home alike.  
- Triggered by a **proven generic failure mode** (synthetic `input` with `insertText` + full-field `data` after native set on controlled inputs), evidenced on a live fixture — not by hostname/`serviceId`.  
- Aligns Managed notification with an **already-shipped simpler contract** elsewhere in the same product (legacy/demo fill), reducing atypical InputEvent payload fields.  
- Keeps dispatching **`input`**, so frameworks still receive a value-change notification.  
- No Bank Leumi / `#_R_*` / catalog special case.

---

#### 5. Behavior intentionally NOT changed by O1

| Preserved | Notes |
|---|---|
| Native value setter | `HTMLInputElement.prototype.value` setter path unchanged |
| `focus` / `blur` | Unchanged |
| `beforeinput` presence, order, construction | Unchanged for O1 (including `insertText`/`data` on beforeinput) |
| `input` **presence** | Still dispatched once in the same slot |
| `change` presence/order | Unchanged |
| `keyup` presence/order | Unchanged |
| Exact-one / Managed eligibility / locators | Unchanged |
| Verification / fail-closed / no auto-submit | Unchanged |
| Shared Admin Test + DH Managed engine | Unchanged |
| A2 / A2.1 / A2.2 diagnostics | Remain; stamps continue to observe post-O1 behavior |
| Layer A / `manual_only` | Out of scope |
| S-120A-1 | Out of scope |

---

#### 6. Rollback boundary

| Item | Binding |
|---|---|
| Revert unit | O1 commit(s) touching **only** Managed `input` construction in `fill-executor.js` (and any O1-only verify notes) |
| Must **not** require reverting | A2/A2.1/A2.2 diagnostics; Phase 120.4–120.9; A1 fixtures; Hub Layer A; Visual/Analyze |
| On O1 fail (Leumi or A1) | **STOP** → rollback O1 → return evidence → Owner decides O2 (do **not** stack speculative changes) |

---

#### 7. Mandatory regression gate (before live Leumi acceptance)

**No expected baseline fixture may be rewritten merely to make O1 pass.**

Automated (must remain PASS):

| Suite / area | Requirement |
|---|---|
| Phase 117 Managed | Deterministic Managed behavior |
| Phase 118 | Analyze safety contracts |
| Phase 119 | Visual Mapping + readiness contracts |
| Phase 120.4 | Eligibility |
| Phase 120.6 | Visibility correction |
| Phase 120.9 | Locator verification integrity |
| A2 / A2.1 / A2.2 | Diagnostic verifies remain PASS (observational) |
| Full A1 lock command set | Green |

Live A1 preservation sample (smoke; not Corrective A experiments):

| ID | Service |
|---|---|
| LB-1 | Shufersal |
| LB-2 | Rivhit |
| LB-3 | Meuhedet |
| LB-4 | Spotify |
| LB-5 | Hapoalim delayed-ready behavior |

Any A1 regression → **O1 FAIL** → rollback (Failure Policy).

---

#### 8. Live acceptance plan (only after future Owner AUTHORIZE O1 **impl**)

1. **Regression gate first** (§7) — automated + LB smoke.  
2. Bank Leumi **Admin Test** ≥5 independent fresh runs: all required fields visibly filled and remain filled; no false SUCCESS; no auto-submit.  
3. Digital Home ≥5 independent runs **after** Layer A / `manual_only` is separately resolved if required for invocation.  
4. Manual final Login remains required.  
5. **One lucky run is NOT acceptance.**

---

#### 9. Failure policy

| Outcome | Action |
|---|---|
| O1 fails Leumi | STOP; rollback O1; evidence → Owner O2 decision |
| O1 causes **any** A1 regression | STOP; rollback O1; evidence → Owner O2 decision |
| Do **not** | Stack O2/O3/O4 on an unreverted broken O1 |

---

#### 10. Explicit non-goals for this DD

Implementation now; hostname/`serviceId` branches; arbitrary timing/retry; first-match; eligibility weaken; Layer A/`manual_only`; S-120A-1; Phase 121; removing `input`; changing `beforeinput`/`change`/`keyup` under O1; rewriting A1 fixtures to force green.

---

#### 11. Owner ACCEPT checklist (architecture)

| # | Item | Owner |
|---|---|---|
| 1 | Accept O1 property delta (§3) as the sole authorized correction shape | ☐ |
| 2 | Accept regression gate (§7) + live plan (§8) + failure policy (§9) | ☐ |
| 3 | Acknowledge **impl still requires a separate AUTHORIZE O1-IMPL** message | ☐ |

Until (3): Developer must not change `fill-executor.js` production `input` construction.

---

### 39.A4 — MINIMAL CORRECTION DD (Architecture return)

Superseded for O1 by **§39.A4.D0** above. Broader REV-1 Layer B hypotheses remain deferred. **S-120A-1** remains PROPOSED/DEFERRED.

**No A4 behavioral impl** until Owner ACCEPT of §39.A4.D0 **and** separate O1-IMPL authorization.

---

### 39.A5 — REGRESSION-PRESERVATION GATE

**Before** Bank Leumi acceptance of any Layer B correction:

| ID | Gate |
|---|---|
| A5-1 | All A1 automated baseline fixtures **PASS** |
| A5-2 | Existing Phase 117–120 suites **PASS** |
| A5-3 | Representative previously-working **live** baseline (A1-3 sample) **PASS** |

Any regression in accepted Managed behavior **blocks** the correction.  
**No** “Leumi works but another accepted service broke” trade-off.

---

### 39.A6 — BANK LEUMI LIVE ACCEPTANCE

**Only after A5 PASS** (and Layer A available for DH track — §39.10).

| Track | Requirement |
|---|---|
| Admin Test | Repeated fresh launches (≥5); all configured fields filled; remain through Managed completion; no false SUCCESS; no partial; no auto-submit |
| Digital Home | Repeated fresh launches (≥5); Managed invoked; same fill criteria; Login remains manual |
| One lucky run | **Not** acceptance |

---

### 39.4–39.8 Layer B correction designs — STATUS

Prior REV-1 normative Layer B pipeline, per-field completion, corrected SUCCESS predicate, CURRENT revalidation, and **S-120A-1** are retained in history as **design hypotheses only**.

```text
S-120A-1 STATUS: PROPOSED / DEFERRED — NOT ACCEPTED AS PRODUCTION CONTRACT.
```

Do not implement §39.4–39.8 behavioral content under REV-2. Revisit only via **A4**.

---

### 39.9 Admin Test / Digital Home parity (for sequence)

| Aspect | Admin Test | Digital Home |
|---|---|---|
| Layer A | Bypassed | Applied when A-LayerA shipped |
| Layer B engine | Shared | Shared |
| A2 diagnostics | Primary for A3 | Same stamps when invocation reaches engine |
| A6 | Required | Required (needs Layer A) |

---

### 39.10 Layer A — `manual_only` policy (REV-1 kept; placement defined)

#### Architectural decision (unchanged from REV-1 ACCEPT IN PRINCIPLE)

- Current **version-matched validated** Managed state is authoritative for DH Managed invocation.  
- Legacy `loginAssistanceLevel: manual_only` **must not veto** that state.  
- Behavior matrix: validated → invoke Managed; not_configured / unsupported / stale mismatch → do not healthy-Managed; no_stored_credentials → block; legitimate manual-only remains when **no** current validated Managed (open/copy). Login after fill always manual (no auto-submit).  
- Preserve: fail-closed Managed; no silent legacy fallback; no hostname logic; `credentialMode`; Phase 120 supportState/configVersion.

#### Placement relative to A1–A6 (mandatory)

| Rule | Binding |
|---|---|
| **Do not** bundle Layer A into **A2** | A2 = diagnostics only |
| **Do not** bundle Layer A into **A4** Layer B correction change-set | Independent PR / revert |
| **Earliest** Layer A impl | After **A1 PASS** (baseline exists to prove R24–R28) |
| **Must not** land in same commit/PR as A2 or A4 | Separately testable + revertible |
| **A3 primary evidence** | Admin Test — so Layer A timing **cannot** confuse mechanism diagnosis |
| **Recommended order** | A1 → A2 → A3 → **then** A-LayerA (or anytime after A1 if isolated) → A4 DD/impl → A5 → A6 |
| **A6 DH track** | Requires A-LayerA complete |

Layer A may ship before A4 if Owner wants DH invocation unblocked early; it still must not share a change-set with A2 diagnostics or A4 fill correction.

#### Layer A regressions (when implemented)

R24–R28: validated+`manual_only` reaches engine from DH; stale/unvalidated does not; legacy metadata cannot override current validated; Admin Test independent of Layer A; `credentialMode` / missing credentials still block without false SUCCESS.

---

### 39.11 Structured failure semantics

**A2:** do not add new failure reasons that change outcomes. Existing reasons only.  
**A4+:** may add `fill_not_stable` / `target_replaced` / `verification_failed` only if mechanism-proven DD requires them.

---

### 39.12 Files expected (by track — when authorized)

| Track | Likely touch |
|---|---|
| A1 | verify scripts / test fixtures only |
| A2 | Ext Managed runner (+ thin diag plumbing); **no** semantic fill changes |
| A-LayerA | `assistanceActions` / supportLevel / Launch Card gate only |
| A4+ Layer B | fill-executor / validated-autofill — **only after A4 DD auth** |

---

### 39.13 Rollback boundaries

| Track | Rollback |
|---|---|
| **A2 diagnostics** | Revert diag-only commits; fill/verify behavior identical to pre-A2; A1 still green |
| **Layer A** | Revert gate-only commits; DH may again block on `manual_only`; Admin Test + Layer B unchanged |
| **Layer B correction (future)** | Revert fill/verify commits only; diagnostics and Layer A may remain; A5 must re-PASS before re-attempt |
| **Never** | Rollback one track by weakening exact-one, 120.6, 120.9, or fail-closed validated rules |

---

### 39.14 Explicit non-goals (REV-2)

Behavioral Layer B changes before A3/A4; accepting S-120A-1 now; bundling Layer A with A2; hostname fixes; guessing mechanism; full ~20 retest every iteration; Phase 121; Government Personal Area; modal/iframe/Shadow DOM/Rimon/Amex/etc.

---

### 39.15 Acceptance of REV-2 / A1–A4 A2.4 IMPL

**A1 CLOSED.** **A2 / A2.1 / A2.2 / A2.3 / A2.4 IMPLEMENTED.**  
**§39.A4.A2.4.S ACCEPTED.** **N1–N9 PASS** → **P gate OPEN** (B not selected).  
**O1:** FAILED / NOT ACCEPTED / FROZEN.  
**Live A2.4 Leumi capture:** awaiting Owner ONE Admin Test (not run by Architecture).  
**DH / O2 / Layer A / S-120A-1 / Phase 121:** **NOT AUTHORIZED.**

---

## Architect Review (§41.B GENERIC FIELD SEMANTICS)
ARCHITECT_REVIEW_STATUS: **GENERIC FIELD SEMANTICS CLARIFIED** — `login_fields` are passed into `GenericFieldMapper`; matching uses `id` + `label` + `type` + built-in id synonyms vs DOM signals; no CSS; no Clalit-specific branch; **no DD/impl**

### Exact next step
**STOP.** Semantics recorded. No fix. No Clalit change.

---

### 41.B — `login_fields` → GenericFieldMapper → DOM (2026-09-23)

#### Data passed in

Hub `executeGenericAutofill` builds:

```text
POC_GENERIC_FILL {
  url,
  loginFields,   // full service schema array: { id, label, type, ... }
  credentials    // { [field.id]: value } for each loginFields entry
}
```

Ext `runGenericAutofill({ loginFields, credentials })` → `GenericFieldMapper.mapLoginFields(loginFields, detection)`.

**1. Yes** — mapper receives the service-specific `login_fields` definitions (as `loginFields`), not only bare credential keys.

**2. Yes** — scoring uses schema properties + DOM signals.

**3. Properties that participate**

| From schema field | Role in `scoreInputForField` |
|---|---|
| `field.id` | Exact match vs input `id`/`name` (+100); selects synonym pack via normalized id (`idnumber`, `usercode`, …) |
| `field.label` | First candidate in `identityLabelCandidates` (+60 if DOM label/placeholder/aria matches) |
| `field.type` | Chooses pool (`password` vs text); password type-alone ≥50; non-password excluded from password inputs |
| *(not schema)* | Built-in synonym lists keyed by normalized `field.id` (Hebrew/English) |
| *(DOM)* | input `type`, `id`, `name`, `autocomplete`, label text / aria / placeholder |

**No** CSS selectors. **No** `serviceId` / host branch in mapper.

**4. How `idNumber` vs `userCode` stay distinct (no saved mapping)**

`mapLoginFields` walks `loginFields` **in order**. For each field, scores unused inputs; requires best ≥ `MIN_IDENTITY_SCORE` (60); rejects if runner-up within `AMBIGUITY_MARGIN` (20); then **`usedInputs.add(best)`** so the next field cannot take the same element.

Clalit-shaped discrimination (when page labels cooperate):

| Schema | Typical score drivers |
|---|---|
| `idNumber` + label «מספר תעודת זהות» | synonyms `תעודת זהות` / `מספר זהות` / `ת.ז` / `id`; or `name`/`id` === `idnumber` |
| `userCode` + label «קוד משתמש» | synonyms `קוד משתמש` / `שם משתמש` / …; or name/id contains `user`; autocomplete username |
| `password` + type password | password input pool; type-alone +50 |

If two text inputs score too similarly → `ambiguous_mapping` → **no fill** (fail closed), not a random swap.

**5. A / B / C**

| | Meaning | Clalit generic case |
|---|---|---|
| **A. LOGIN FIELD SCHEMA** | WHAT credentials exist (`login_fields` ids/labels/types) | `idNumber`, `userCode`, `password` |
| **B. SAVED DOM MAPPING** | WHERE via CSS (`metadata.autofillProfile.fieldMappings`) | Absent/empty for this specimen |
| **C. GENERIC RUNTIME DISCOVERY** | Maps each A item → one unused DOM input by scoring | `mapLoginFields` as above; **ephemeral**; not written to B |

Credential assignment after map: `credentials[mapping.fieldId]` → `fillField(mapping.element, value)`.

---

---

### 41.A — Managed field-mapping source of truth (Clalit specimen) (2026-09-23)

**Constraints honored:** read-only; no Clalit config change; no Analyze/Visual/Save; no Owner live test required.

**Owner observations (binding inputs):** DH credentials correct (`idNumber`, `userCode`, `password`); Admin Managed mapping rows appear empty; Admin requires CSS per mapped field; DH launch still fills all three; historical Analyze unknown.

**Live DB row for `clalit`:** **not fetched** this review (no data access / no mutation). Conclusions use **implemented code paths** + Owner UI + builtin seed shape.

#### Answers A–H

| # | Answer |
|---|---|
| **A** | Credential schema expected: `login_fields` ids `idNumber`, `userCode`, `password` (builtin seed + Owner). Managed CSS mappings: Owner UI empty ⇒ either no/empty `metadata.autofillProfile.fieldMappings` locators **or** absent profile. Exact JSON not dumped. |
| **B** | Credentials: vault/user_services values keyed by field id. Schema: `service_registry.login_fields`. Managed: `service_registry.metadata.autofillProfile` (`fieldMappings[]`, `supportState`, `loginEntryUrl`, `allowedOrigin`, `configVersion`, …). Key: `autofillProfile`. |
| **C** | Admin Managed UI: `readAutofillProfileFromMetadata(row.metadata)` → `fieldMappings` → locator inputs (`AutofillProfileEditor`). Empty locators ⇔ empty/absent stored mappings in that profile. Rows themselves come from `login_fields` (schema), not from Managed. |
| **D** | DH tile: `executeServiceFromTile` → if **not** Managed-eligible/claiming-validated → LI basic/unknown → `executeGenericAutofill` → Ext `POC_GENERIC_FILL` with `loginFields` + credentials (**no CSS mappings**). |
| **E** | If Managed absent: Ext `GenericFormDetector` + **`GenericFieldMapper.mapLoginFields`** scores visible inputs by id/name/label/autocomplete/type (incl. Hebrew synonyms for idNumber/userCode/password). Ephemeral element bindings — not Admin CSS. |
| **F** | **Yes — on the generic engine only.** Boundary: `extension/generic/field-mapper.js` + `generic-autofill.js`. Activates when Managed gates do **not** take the tile (no validated+eligible Managed). Persisted Managed mappings **precede** and **block** silent generic fallback when `supportState=validated` (fail-closed). Discovery **not** persisted. |
| **G** | Unlikely same-metadata stale Managed hidden from Admin: Admin + Managed runtime share `readAutofillProfileFromMetadata`. Successful fill with empty Admin locators fits **generic**, not hidden Managed CSS. |
| **H** | **Yes for field targeting:** Admin Managed panel SoT = `metadata.autofillProfile.fieldMappings`; DH generic SoT = `login_fields` + runtime DOM scoring. Credential values: shared vault keys by field id. |

#### Evidence-backed flow (Clalit-class when Managed not eligible)

```text
Vault credential record (fieldId → value)
    ↓
service_registry.login_fields  (schema: idNumber, userCode, password)
    + metadata.autofillProfile  (Managed CSS — empty/absent per Owner UI)
    ↓
Digital Home tile → executeServiceFromTile
    ↓  Managed claim/eligible? NO (empty/unvalidated mappings)
    ↓  Login Intelligence basic/unknown
    ↓
executeGenericAutofill → POC_GENERIC_FILL
    (loginFields + credentials; no fieldMappings)
    ↓
Ext: detectVisibleLoginForm → mapLoginFields (heuristic scores)
    ↓
GenericFillExecutor.fillField(element, value)  // element from mapper, not CSS
```

| Step | File / symbol | Data source | Fallback |
|---|---|---|---|
| Credentials | vault / Digital Home profile | user-stored values by `field.id` | missing → no fill attempt |
| Schema | `service_registry.login_fields`; seed `builtinCatalog` clalit | Admin/registry | invalid schema → no Managed editor fields |
| Managed profile | `metadata.autofillProfile` | Admin Save only | absent/empty → Managed ineligible |
| DH orchestrator | `serviceExecution.executeServiceFromTile` | service + credential + loginFields | validated Managed claim → **no** generic fallthrough |
| Managed send | `managedAutofill.buildManagedAutofillPayload` | profile.fieldMappings + credentials | N/A if ineligible |
| Generic send | `genericAutofill.executeGenericAutofill` | loginFields + credentials | open tab without fill if Ext down |
| Runtime resolve | `GenericFieldMapper.mapLoginFields` | live DOM + loginFields labels/ids | fail `low_confidence` / ambiguity — no persist |
| Target + fill | `GenericFillExecutor.fillField` | mapped element | never submit |

**Managed path (contrast — not indicated for this specimen):** requires `supportState=validated` + version match + non-empty CSS per required field → `HUB_MANAGED_AUTOFILL` + `querySelector` exact-one. **No** heuristic discovery inside Managed.

#### Classification

**1. EXPECTED** — dual-engine architecture:

- Admin Managed CSS mapping is **required only for Managed Autofill**, not for legacy generic fill.
- Runtime discovery (`GenericFieldMapper`) is an **intentional** generic-engine mechanism (Phase 103/110), ephemeral, not written back to Admin.
- Empty Admin Managed locators + successful DH fill is **consistent** when Clalit still executes **generic**, not Managed.

Not primarily (2) UI representation defect or (3) SoT defect within Managed — unless Owner later proves DH used `HUB_MANAGED_AUTOFILL` while Admin locators empty (would reopen as (2)/(3); **not** evidenced here).

#### Bank Hapoalim (pre-Analyze)

**Same architecture can explain** Owner’s earlier observation: before login-page analysis/save of Managed mappings, DH could still fill via **generic** `login_fields` + field-mapper if the page scored cleanly; after Analyze+Save(+validate), path can switch to **Managed** CSS. Not proof of Hapoalim’s historical path without stamps — **mechanistically compatible**.

#### Frozen

No fix. No impl. Clalit specimen preserved. Leumi pause / A2.5 CLOSED / O1 FROZEN unchanged.

---

---

### 40.A — Admin Control Center «יש להתחבר לחשבון כדי להמשיך» (2026-09-23)

**Owner report (HE):** Frequent reconnect prompt while working in Admin, or ~1 minute after entering Admin. Screenshot: pink banner with `AUTH_COPY.authRequired` while **כל האתרים** / Meuhedet / Visual Mapping remain visible (shell not fully kicked to AdminGate login).

#### Binding (this finding)

| Item | Status |
|---|---|
| Bank Leumi pause / KNOWN RELIABILITY LIMITATION | **Unchanged** |
| A2.5 / A2.4-CORR / O1 locks | **Unchanged** |
| This issue | **Separate** Hub Admin **session/auth** reliability — not Managed fill |
| Impl / DD | **NOT AUTHORIZED** |

#### Repository evidence (read-only)

| Fact | Location |
|---|---|
| Exact banner copy | `src/auth/copy.ts` → `authRequired: 'יש להתחבר לחשבון כדי להמשיך.'` |
| Thrown by | `AuthRequiredError` from `requireAuthenticatedUserId()` (`src/auth/session.ts`) |
| Admin catalog surfaces it as `error` banner | e.g. `RegistryAdmin.reload` / row fetch catch → `setError(err.message)` — **UI stays mounted** |
| Admin writes also gate on same helper | `adminRegistryApi.ts` → `requireAuthenticatedUserId()` |
| Session client | Supabase `persistSession: true`, `autoRefreshToken: true` |
| Resolver policy | Prefer local session if `expires_at > now+60s`; else `refreshSession`; else `getUser`; else throw |
| Prior related fix (Phase 117) | Digital Home boot `signOut` must not wipe session after navigate to `#/admin` (`App.tsx` + session refresh-before-fail) — **partial history**; does **not** prove current mid-Admin dropout cause |

#### Working hypotheses (not proven)

| ID | Hypothesis |
|---|---|
| H1 | Access-token near-expiry / refresh failure → `AuthRequiredError` on next Admin API call (~1 min if JWT short or refresh broken) |
| H2 | False AuthRequired: network/`getUser`/`refreshSession` fail while local session still valid |
| H3 | Cross-shell race: Digital Home `#/` boot `signOutAccount` vs `#/admin` remount (`main.tsx` hash swap) still clears session intermittently |
| H4 | Multi-tab / storage sync clears or invalidates refresh token |
| H5 | Not session loss — specific Admin action fails RLS/auth and message collapses to generic `authRequired` |

**Root cause: NOT ESTABLISHED.** No DD. No code change.

#### Clarifying question (one)

When the pink banner appears, is it:

**(A)** after a specific action (save / reload catalog / open site / Analyze / Visual / Admin Test), or  
**(B)** also while idle with no click for ~1 minute?

**Owner answer (2026-09-23):** **(B)** — also while idle / no click (~1 minute).

#### Update after answer B

| Rank | Hypothesis | Effect of B |
|---|---|---|
| H1 | JWT near-expiry / refresh failure | **Elevated** — fits ~1 minute if access token short or refresh broken |
| H2 | False AuthRequired (refresh/getUser fail while local session exists) | **Elevated** |
| H3 | Digital Home `#/` boot `signOut` clearing shared persisted session (other tab / return link) | **Elevated** — shared `localStorage` session; Admin has **no** idle poller in repo |
| H4 | Multi-tab storage invalidation | **Elevated** (same mechanism as H3) |
| H5 | Action-only RLS collapse to authRequired | **Demoted** as sole explanation |

**Code fact:** Admin shell has **no** `setInterval` / visibility auth poller. Banner requires `setError` from a failed authenticated call (e.g. catalog `reload`). Idle-looking reports therefore imply either (1) session died in background then a remount/refetch Owner did not count as “action”, or (2) cross-tab/home `signOut`, or (3) an unlocated path — **not yet proven**.

#### Clarifying question 2 (one)

When the banner appears after ~1 minute idle, is another Vault tab/window also open (Digital Home `#/` or a second Admin), or is **only** this Admin tab open?

**Owner answer (2026-09-23):** Soft — **«יכול להיות שגם בית דיגיטלי עצמו»** (Digital Home itself may also be open / involved). Not a hard single-tab denial.

#### Update after Q2 (Digital Home involvement)

**Leading architectural fact (proven in code, causation for Owner symptom not yet proven):**

On Digital Home mount (`App.tsx` boot effect), after optional email prefill from `restoreAccountSession`, the shell **always** calls `signOutAccount()` → `supabase.auth.signOut()` while DH remains mounted. Session is **persisted shared** (`persistSession: true`). Therefore:

| Scenario | Expected effect on Admin |
|---|---|
| Second tab/window loads `#/` (Digital Home) | Shared session cleared → Admin’s next authenticated call throws `AuthRequiredError` → pink banner |
| Same window: Admin → «חזרה לבית הדיגיטלי» (`href="#/"`) | `main.tsx` remounts `App` → same boot `signOut` |
| Admin-only tab, never mounts DH | This path alone **does not** explain logout; H1/H2 remain |

**Hypothesis rank now:** **H3/H4 = primary candidate** when Digital Home is also present. H1/H2 remain for Admin-only idle. Root cause still **not closed**.

#### Clarifying question 3 (one)

Which is closer to what you meant?

**(1)** Sometimes **בית דיגיטלי is open at the same time** as Admin (second tab/window), or  
**(2)** The **same reconnect message also appears while working only in בית דיגיטלי** (without Admin)?

**Owner answer (2026-09-23):** **(1)** — Digital Home sometimes open **concurrently** with Admin.

#### Leading finding (investigation)

| Item | Binding |
|---|---|
| Symptom | Admin pink banner `יש להתחבר לחשבון כדי להמשיך.` while Admin shell stays mounted |
| Owner pattern | Idle ~1 min **and** DH often open in parallel |
| Mechanism (code) | DH `#/` boot → `restoreAccountSession` (email prefill) → **`signOutAccount()`** always; session `persistSession: true` shared across tabs |
| Effect | Admin tab’s next `requireAuthenticatedUserId()` / registry fetch → `AuthRequiredError` → banner |
| Status | **LEADING FINDING** — fits Owner (1)+(B). **Not** a formal ACCEPT of sole root cause for every occurrence (Admin-only idle without DH still open for H1/H2) |
| DD / impl | **NOT AUTHORIZED** |
| Leumi / A2.5 / O1 | **Unchanged** |

**Product/architecture tension (Phase 109):** Digital Home intentionally signs out so the only door is Auth entry — correct for DH alone; **conflicts** with concurrent Admin operator workflow on the same origin session store.

#### Owner decision required (one)

**(A)** Authorize Architect to write a **DD only** (session coexistence / no silent DH signOut of Admin session — options; no impl yet), or  
**(B)** Record as **known Hub operator limitation** for now (no DD; operators avoid concurrent DH+Admin tabs)?

**Owner decision (2026-09-23):** **(B)** — defer fix; Owner will work around. Product desire for concurrent Admin∥user DH **acknowledged** as future; **no DD / no impl now**.

#### Closure record

| Item | Status |
|---|---|
| Issue | Admin banner `יש להתחבר לחשבון כדי להמשיך.` with concurrent Digital Home |
| Leading mechanism | Shared Supabase `persistSession` + DH boot `signOutAccount` (Phase 109) |
| Classification | **KNOWN HUB OPERATOR LIMITATION** |
| Workaround | Do not keep `#/` and `#/admin` open in parallel in the same browser |
| DD | **Not written** |
| Impl | **Not authorized** |
| Reopen | Explicit Owner architecture/product decision only |

---

### 39.A4.LEUMI-PAUSE — Bank Leumi investigation paused (2026-09-23)

**Owner decision:** ACCEPT CLASS B evidence review (§39.A4.A2.5.L). Pause Bank Leumi investigation.

#### Classification

| Item | Binding |
|---|---|
| Bank Leumi (fixture) | **KNOWN RELIABILITY LIMITATION** |
| Investigation status | **PAUSED** |
| Reopen condition | Explicit architecture/product decision only — new evidence **or** product criticality |
| Site-specific workaround | **FORBIDDEN** |
| Shared autofill behavior change | **FORBIDDEN** (this pause) |
| Additional diagnostics | **FORBIDDEN** (this pause) |
| Additional Owner live evidence request | **FORBIDDEN** (this pause) |

#### Evidence retained (do not discard)

| Evidence | Status |
|---|---|
| CLASS A — prior Run 2 (`mfd_1790179952257_811558749`) | **Retained** — valid |
| CLASS B — run `mfd_1790183653303_716906735` (verify true → Owner neither) | **Retained** — valid |
| Successful runs also observed (incl. O1 Run 1; A2.4 Run 3 control) | **Retained** |
| Root cause | **Not established** |
| A2.5 diagnostic purpose | **Completed** → A2.5 **CLOSED** |
| Full §39 Corrective A / A2.x / A2.4 / A2.5 / E4 / E4.1 / E4.2 findings | **Preserved** in this artifact |

#### Status locks

| Item | Status |
|---|---|
| A2.5 | **CLOSED** |
| A2.4-CORR | **SPEC ACCEPTED / IMPLEMENTATION DEFERRED** |
| B alongside P | **REJECTED** |
| O1 | **FAILED / NOT ACCEPTED / FROZEN** |
| O2 / O3 / O4 | **Not authorized** |
| Layer A / S-120A-1 / DH acceptance / Phase 121 | **Not authorized** |
| Behavioral fix / rollback | **Not authorized** |

#### Architect confirmation

CLASS B evidence review **ACCEPTED**. Bank Leumi recorded as **KNOWN RELIABILITY LIMITATION**. Investigation paused under the reopen rule above. All collected diagnostic evidence and architectural findings remain in `team-Yuri/arch-phase120.md`.

---

---

### 39.A4.A2.5.L — A2.5 live + CLASS B evidence review (2026-09-23)

**Run:** `mfd_1790183653303_716906735`  
**Owner-visible final:** **NEITHER** field remained filled.  
**A2.5 disposition:** LIVE DIAGNOSTIC **COMPLETE**. Do **not** expand A2.5. Do **not** add peer stages. Do **not** run another A2.5 live test.  
**CLASS A (this run):** **NOT OBSERVED.** Prior Run 2 (`…811558749`) **remains** valid CLASS A evidence — do **not** conclude CLASS A does not exist.  
**Active branch:** **CLASS B** (post-verification Owner-visible loss).

#### A2.5 peer window (username observed during password fill)

| observingActiveStage | expectedValueMatchHeld/Current |
|---|---|
| fill_post_native_set … fill_post_blur (all listed) | **true/true** |
| post_fill_immediate | **true/true** |

Also: `heldConnected=true`, `heldEqualsCurrent=true`, `targetReplaced=false`, `probeFailed=false` on supplied peer stamps.  
**`peer_first_observed_loss_boundary`:** **none**.  
**Conclusion:** username value **held through entire password-fill peer window** — **no CLASS A loss in this run.**

#### verify_current_probe (both fields)

| Field | Match held/current | Identity |
|---|---|---|
| username | **true/true** | heldConnected=true; heldEqualsCurrent=true; targetReplaced=false; exact_one; matchCount=1 |
| password | **true/true** | same identity signature |

**Conclusion:** both fields **survived Managed verify_current_probe**. Owner later saw neither → **CLASS B**.

#### Evidence package scope (binding)

| Artifact | In Owner package? |
|---|---|
| A2.5 peer_observe table (summary) | **Yes** |
| verify_current_probe (summary) | **Yes** |
| `post_verify_microtask` / `post_verify_raf` / `post_verify_timeout_0` rows | **Not pasted** |
| `post_runtime_a24` start / P/R/E/L / bound rows | **Not pasted** |
| `firstLossSource` object | **Not pasted** / not reported present |
| Elapsed `msSinceVerifyEnd` / bound timestamps | **Not pasted** |

Architecture reviews **only** what was supplied. Missing rows are **INSUFFICIENT EVIDENCE**, not “false.”

---

#### CLASS B field review — USERNAME

| # | Question | Answer |
|---|---|---|
| 1 | Last existing stamp where value proven **true** | **`verify_current_probe`** (held=true, current=true). A2.5 peer_observe also all true earlier in the same run. |
| 2 | First existing stamp where value proven **false** | **None in supplied package.** No false diagnostic stamp pasted after verify. First **Owner-visible** false = post-verify UI observation only (not a stamp). |
| 3 | Elapsed time | **Not available** in package |
| 4 | P/R/E/L between boundaries | **Not available** — A2.4 stamp rows not pasted |
| 5 | A2.4 `firstLossSource` emitted? | **Not reported** in package → treat as **unknown / not evidenced** |
| 6 | If emitted, trustworthy under pre-CORR defect? | **N/A** (not evidenced). Known defect (E4 / Run1): `firstLossSource` may fire while stamp match still true → **untrustworthy as proven loss** until A2.4-CORR. |
| 7 | Narrowest evidence-supported loss interval | **AFTER** `verify_current_probe=true` **and AT/BEFORE** Owner-visible empty. **Cannot** tighten to microtask/rAF/timeout0/A2.4 without those stamps. |

---

#### CLASS B field review — PASSWORD

| # | Question | Answer |
|---|---|---|
| 1 | Last existing stamp where value proven **true** | **`verify_current_probe`** (held=true, current=true) |
| 2 | First existing stamp where value proven **false** | **None in supplied package** (same as username) |
| 3 | Elapsed time | **Not available** |
| 4 | P/R/E/L between boundaries | **Not available** |
| 5 | A2.4 `firstLossSource` emitted? | **Not reported** → unknown / not evidenced |
| 6 | Trustworthy under pre-CORR? | **N/A**; same defect caveat if later found |
| 7 | Narrowest evidence-supported loss interval | **AFTER** `verify_current_probe=true` **and AT/BEFORE** Owner-visible empty. Same open post-verify window as username for this run. |

---

#### Joint CLASS B findings (this run)

1. **Ruled out for this run:** loss during password fill (A2.5 peer window all true; no firstObservedLossBoundary).  
2. **Ruled in:** post-verification Owner-visible clear of **both** fields after verify still true (CLASS B).  
3. **Not proven:** which of microtask / rAF / timeout_0 / A2.4 window / after A2.4 bound / outside instrumentation contained the flip.  
4. **Do not** infer causation from setter/event adjacency (none supplied anyway).  
5. **Prior CLASS A (Run 2) unchanged** — separate mechanism class; not erased by this CLASS B run.  
6. **A2.4-CORR:** SPEC remains accepted; **IMPL remains DEFERRED** — this review does **not** authorize impl (finer stamp paste optional later; not a behavioral fix).  
7. **B alongside P:** remains **REJECTED**.

#### Frozen (reaffirmed)

O1 FAILED / NOT ACCEPTED / FROZEN. No behavioral fix. No rollback. No O2/O3/O4. No Layer A. No S-120A-1. No DH acceptance. No Phase 121. No further A2.5 live.

---

---

### 39.A4.E4.2 — CLASS A localized (Run 2 recovered stamps) (2026-09-23)

**Run:** `mfd_1790179952257_811558749`  
**Username** `field-cccf74e4` · **Password** `field-caf4e7f1`

| Checkpoint | Username match | Password match |
|---|---|---|
| username fill_post_* through blur | true (held) | — |
| username `post_fill_immediate` | true/true | — |
| username **1st** `post_field_advance` | true/true | — |
| password fill_post_* through `post_fill_immediate` | — | true |
| username **2nd** `post_field_advance` | **false/false** | true/true |
| `verify_held` / `verify_current_probe` | false | true |

**Boundary:** AFTER username 1st `post_field_advance=true` **and** AT/BEFORE username 2nd `post_field_advance=false`, password fill **inside** interval.  
**Wording:** loss occurs during the cross-field interval containing password fill — **not** “password stage N caused loss.”

---

### 39.A4.A2.5 — CLASS A peer-observe DD + IMPL

**Status:** DD **ACCEPTED**. **A2.5-IMPL COMPLETE** (diagnostic-only). Pre-live N1–N14 evidence returned. Live Leumi **not** performed by Architecture.  
**Scope:** CLASS A only. **Do not** modify A2.4-CORR. **Do not** combine with CLASS B. **B alongside P REJECTED.**

#### 1. Files / functions (planned)

| File | Function | Change |
|---|---|---|
| `extension/generic/fill-executor.js` | `fillField`, `dispatchInputEvents` | Optional 4th arg `onStageProbe(stageId)` invoked **after** each **existing** A2.1/A2.2 probe site; **no-op** if absent/non-function |
| `extension/generic/validated-autofill.js` | `runManagedAutofill` fill loop | When `diagnosticPath` ∈ {`admin_test`,`digital_home`} and `filledTrail.length>0`, pass probe that stamps each peer; after F `post_fill_immediate`, stamp peers for that boundary |
| `scripts/verifyPhase120A25PeerObserve.mjs` | (new) | N1–N10 offline proof |
| A2 diagnostics verify | extend | peer stamps present only when peers exist + path approved |

**Rejected design:** embedding `peers[]` / fieldId lists / Leumi logic inside `GenericFillExecutor` as a peer subsystem.

#### 2. Exact observation insertion points

On **active** field F (e.g. password), **after** each existing probe already computed (same order as today):

| # | `observingActiveStage` | Existing F site |
|---|---|---|
| 1 | `fill_post_native_set` | after native set match read |
| 2 | `fill_post_beforeinput` | after beforeinput dispatch + record |
| 3 | `fill_post_input` | after input |
| 4 | `fill_post_change` | after change |
| 5 | `fill_post_keyup` | after keyup |
| 6 | `fill_post_events` | after events aggregate read (existing) |
| 7 | `fill_post_blur` | after blur match read |
| 8 | `post_fill_immediate` | caller, after F `post_fill_immediate` stamp (existing call-site) |

At each, for every peer in `filledTrail` (already filled before F): read-only stamp.

#### 3. Mechanism selected: **caller-side `onStageProbe`** (not `peers[]` in engine)

| Option | Verdict |
|---|---|
| `peers[]` inside fill primitive | **Rejected** — couples generic fill to peer diagnostic model |
| **`onStageProbe(stageId)` optional callback** | **Selected** — generic “notify after existing probe”; peer stamping lives only in Managed diagnostic runner |

**Rationale:** Fill executor stays field-agnostic; approved diagnostic path + `filledTrail` decide whether to observe peers; `onStageProbe` omitted ⇒ pre-A2.5 execution.

#### 4. Diagnostic schema (booleans/metadata only)

```text
stage: 'peer_observe'
peerFieldId: <opaque field id>
activeFieldId: <field being filled>
observingActiveStage: 'fill_post_native_set' | … | 'post_fill_immediate'
expectedValueMatchHeld: boolean | null
expectedValueMatchCurrent: boolean | null   // via existing safe resolveExactOne(peer.locator)
heldConnected: boolean | null
heldEqualsCurrent: boolean | null
targetReplaced: boolean | null
exactOne: string | null
matchCount: number | null
probeFailed: boolean                         // true only on catch
runId / path / stageOrderIndex: existing bag correlation
```

**Never:** credential strings, raw `.value`, secrets.

#### 5. `firstObservedLossBoundary` algorithm

Over ordered peer_observe stamps for a given `peerFieldId` during one active fill of F:

```text
prev = null
for each stamp S in stageOrder:
  match = S.expectedValueMatchHeld == true  // or (held||current) both considered; prefer held
  if prev != null && prev.match == true && match == false:
    return {
      firstObservedLossBoundary:
        'after ' + prev.observingActiveStage + ' / at-or-before ' + S.observingActiveStage,
      epistemics: 'observed_adjacency_only'
    }
  prev = { match, observingActiveStage: S.observingActiveStage }
return { firstObservedLossBoundary: null, epistemics: 'no_true_to_false_in_window' }
```

**Forbidden claim:** `observingActiveStage` **caused** the loss.

#### 6. Exception / fail-open

```text
try { onStageProbe(stageId); } catch (_) { /* swallow */ }
try { stamp peer… } catch (_) { stamp probeFailed:true only if bag allows; never throw }
```

Must not: abort fill, change Managed result, retry, modify targets, suppress fill events.

#### 7. N1–N10 proof strategy

| # | Proof |
|---|---|
| N1 | Static/call: no `onStageProbe` ⇒ same control flow as pre-A2.5 (branch only on typeof function) |
| N2–N5 | Offline: event log / fill order / focus-blur sequence identical with probes on vs off (stub page) |
| N6 | `ok`/`reason`/`filled` identical control vs A2.5 path |
| N7 | Peer path uses only reads (`expectedValueMatch`, `resolveExactOne`, `isConnected`) — assert no setter calls in probe |
| N8 | Force-throwing `onStageProbe` ⇒ fill still ok; outcome unchanged |
| N9 | JSON.stringify(fillDiagnostics) excludes fixture secrets |
| N10 | A1 lock + A2/A2.1/A2.2/A2.3 (+ A2.4 verify) PASS |

#### 8. Zero production behavior change

When diagnostic path is not approved **or** `filledTrail` empty **or** `onStageProbe` omitted: fill writes, events, focus/blur, order, eligibility, locators, retries, and return semantics are **unchanged**. Peer observation never writes values or dispatches events.

#### 9. Owner live procedure (authorized after A2.5-IMPL; Architecture did not run)

1. Reload Hub + extension.  
2. **One** Bank Leumi Admin Test (CLASS A fixture).  
3. Copy `[A2 ManagedFillDiagnostics]`.  
4. Filter `peer_observe` for username during password `activeFieldId`.  
5. Apply `firstObservedLossBoundary` algorithm; report adjacency only.  
6. **Stop** — no series, no DH, no O1 accept.

#### Isolation / paths

| Rule | Binding |
|---|---|
| Enable peer stamps | `diagnosticPath` ∈ {`admin_test`,`digital_home`} only |
| No peers / no probe | ≡ pre-A2.5 |
| No async added | probes sync after existing sites only |
| A2.4-CORR | untouched; IMPL still DEFERRED |
| CLASS B | out of scope |

#### Owner ACCEPT checklist

| # | Item | Owner |
|---|---|---|
| 1 | Accept `onStageProbe` design (reject engine `peers[]`) | ✅ |
| 2 | Accept schema + adjacency-only epistemics | ✅ |
| 3 | Accept N1–N14 gates (offline) | ✅ |
| 4 | AUTHORIZE A2.5-IMPL | ✅ COMPLETE |

---

### 39.A4.E4.1.C — CLASS A stamp inventory (code + Run2 36-stamp implication)

**Interval:** username `fillField` ok → `verify_current_probe` false.

#### A. Stamps always emitted in that interval (2-field success)

| # | Stage | Distinguishes |
|---|---|---|
| 1 | username `fill_post_native_set`…`fill_post_blur` | set / per-event / blur |
| 2 | username `post_fill_immediate` | right after fill ok |
| 3 | `post_field_advance` (username only) | post-commit |
| 4 | password `pre_fill` + `fill_post_*` + `post_fill_immediate` | password activity |
| 5 | `post_field_advance` (**username** + password) | **cross-field** after password |
| 6 | `verify_held` (username) | held verify |
| 7 | `verify_current_probe` (username) | current probe (Run2 handoff: false) |

#### B. In original 36-stamp Run 2 object?

**Emitted:** yes (code path). **In handoff paste:** no. ~36 stamps fits full A2.1–A2.4 bag → omission, not absence. Re-open same console object; no new live run.

#### C. Max localization without that paste

Only: after username fill ok → at/before `verify_current_probe` false.

---

### 39.A4.A2.4.C — A2.4 correction DD (SPEC ONLY — NOT AUTHORIZED)

**Impl FORBIDDEN** until Owner ACCEPT + AUTHORIZE A2.4-CORR-IMPL.  
**B alongside P:** **REJECTED**.

#### C1 — firstLossSource

Assign **only if** stamp has `expectedValueMatchHeld===false` OR `expectedValueMatchCurrent===false`.  
Matching P setter → never `firstLossSource`.  
P internal vs stamp disagreement → `p_match_disagreement` only; no loss class.

#### C2 — Lifetime (truthful)

`setTimeout(5000)` = **scheduled soft bound**, not hard ≤5s. Record: `boundScheduledMs`, `boundTimerStartedAt`, `boundFiredAt`, teardown start/finish, `observerActiveMs`, `boundSlackMs`. Tear down on first-loss / pagehide / timer fire (earliest). No delay ladder. No fill behavior change.

#### C3 — Gates before live re-test

G1 A1+A2.x PASS · G2 N1–N9 PASS · G3 matching P ≠ firstLoss · G4 disagreement path · G5 bound metadata · G6 outcome unchanged · G7 no fixture rewrite.

#### Owner ACCEPT checklist

1. C1 ☐  2. C2 ☐  3. B rejected ☐  4. separate AUTHORIZE for impl ☐

---

### 39.A4.E4.1 — E4 correction with pre-A2.4 stamps (2026-09-23)

**Mapping:** `field-cccf74e4`=username; `field-caf4e7f1`=password.

| Run | UI | A2.3 both fields | Notes |
|---|---|---|---|
| 1 `…536831009` | neither | **true** through timeout0 | CLASS B — later unobserved loss; P+179ms match still true ≠ loss |
| 2 `…811558749` | password only | username **false** from verify_current onward; password **true** | CLASS A — loss **before** A2.4 |
| 3 `…71816262` | both | **true** through timeout0 + A2.4 bound | control |

**Withdrawn:** Run2 as proof of P/prototype bypass (loss predates `post_runtime_a24_start`).

**Retained independently:** Run1 `firstLossSource` mislabel; `setTimeout(5000)` not hard ≤5s.

**managedEligible=false** on password at late stamps: `stampResolve` re-calls `isSafeFillTarget(current)` at stamp time — eligibility snapshot, **not** fill success; can be false while value still matches (e.g. post-blur geometry/aria). Not a failure by itself.

**Run2 earliest known (this package):** already `false` at `verify_current_probe`. Implies username `fillField` returned ok (password trail exists) → loss in window **after username fill success → verify_current_probe**. Intra-`fill_post_*` / `verify_held` / `post_field_advance` for Run2 **not pasted** → cannot refine further without those stamps (no new live run requested).

**B alongside P:** **not** justified by Run2. Still optionally useful only to harden CLASS B observation (theoretical P bypass during A2.4 window) — separate Owner ACCEPT.

---

### 39.A4.E4 — A2.4 live ×3 evidence review (2026-09-23)

**Runs (same build; all preserved):** `mfd_1790179933869_536831009`, `mfd_1790179952257_811558749`, `mfd_1790179960654_71816262`

#### FieldId mapping (config / prior Leumi evidence — not Owner UI)

| fieldId | Credential field | Locator (prior arch) |
|---|---|---|
| `field-cccf74e4` | **username** | `#_R_6pinot66mivb_` |
| `field-caf4e7f1` | **password** | `#_R_apinot66mivb_` |

#### Pre-A2.4 stamps (verify_current / post_verify_*)

**Not supplied** in this evidence package for Runs 1–3 → comparison table **BLOCKED**. Owner-visible none / password-only / both **may** be different mechanisms; cannot confirm from A2.3 stages without pasted stamps.

#### Run 2 (username false @ bound; no P/R/E/L firstLoss)

**Code fact:** When `pHandle` installs successfully, **B rAF match loop is not started** (`if (!st.pHandle) { … B … }`).  
**Code fact:** P only sees assignments that go through the **own** `value` accessor. Calls of the form `HTMLInputElement.prototype.value` setter via `.call(el, v)` (common framework pattern) **bypass** the own wrapper.  
**Conclusion:** **A + B** — observation blind spot (no B while P active) + P wrapper bypass. Not R/E/L (identity stable). Not proven “loss before P” without pre-A2.4 stamps.

#### Run 1 (P firstLossSource while matchHeld/Current true)

P `onBoundary` only when `a24MatchViaFwd === false`, then `reportLoss` always sets `firstLossSource` and separately stamps `expectedValueMatch*` via `expectedValueMatch`. Those helpers can disagree if `a24MatchViaFwd` fails open (catch→false) while `el.value` read succeeds, or stamp semantics treat any P callback as “loss.”  
**Conclusion:** **F** — diagnostic classification defect. **Do not** treat this setter as proven loss/cause while match stamps are true.

#### Bound timestamps 5168 / 5797 ms

Bound is `setTimeout(..., 5000)` from A2.4 start; `msSinceVerifyEnd` is `Date.now()` at stamp time inside `finishAll` (after teardown work). Timers are **not** hard real-time; main-thread delay + teardown explains >5000. Observers remain until the timer callback — **not** a proven hard ≤5000ms wall. **Safety DD lifetime not fully met as a hard bound.**

#### Safety DD satisfaction

| Requirement | Status |
|---|---|
| P wrap/restore/fail-open/N-proof | Met offline |
| Epistemics / no false causation | **Fail** on Run 1 firstLossSource |
| Observe post-runtime loss | **Partial** — Run 2 silent clear with P up |
| ≤5s lifetime | **Not hard-proven** (setTimeout slack) |

#### Smallest diagnostic-only correction (SPEC — **not authorized**)

1. Gate `firstLossSource` / `reportLoss` on stamp-time `expectedValueMatchHeld/Current === false`; if P saw `!matchAfter` but stamp match true → stamp disagreement metadata, **not** loss.  
2. Run **B alongside P** (complementary rAF match) to close proto-setter bypass blind spot — still no delay ladder.  
3. Record `boundScheduledMs` vs `boundFiredMs`; begin teardown when `msSince >= 5000` on B ticks; do not claim hard ≤5s from `setTimeout` alone.  
4. Require pre-A2.4 stamp paste for any further mechanism claim across the three Owner-visible outcomes.

---

### 39.A4.E1 — O1 live acceptance evidence + diagnostic availability (2026-09-23)

**Disposition:** **O1 RELIABILITY ACCEPTANCE = FAILED.** Do **not** declare O1 successful. Do **not** proceed to Digital Home. Do **not** implement O2 on top of O1.

#### Owner-reported Admin Test outcomes (Bank Leumi fixture; O1 installed)

| Run | Owner-visible result | Notes |
|---|---|---|
| 1 | **PASS** — username + password filled and remained filled | Only success in series |
| 2 | **FAIL** — username empty, password filled | |
| 3 | **FAIL** — username empty, password filled | |
| 4 | **FAIL** — username empty, password empty | |
| 5 | **FAIL** — username empty, password filled | |

**Score:** **1/5 PASS.** Intermittent fill = architectural failure vs Autofill north star.

#### A2 / A2.1 / A2.2 stamp evidence availability (binding)

| Source | Status |
|---|---|
| Owner message (this disposition) | UI outcomes only — **no** `fillDiagnostics` / stamp table pasted |
| `team-Yuri/arch-phase120.md` | **No** O1 Run 1–5 stamp objects recorded |
| Agent transcript / terminals | **No** O1 live diagnostic payloads found |
| Pre-O1 A3.E3 (§39.A3.E3) | Stamps exist for **prior** `input` contract (`inputType`+`data`) — **not** O1 Runs 1–5 |

**Conclusion:** Stamp-level evidence for O1 Runs 1–5 is **NOT AVAILABLE** to Architecture at this review.  
Hub path **does** emit `console.info('[A2 ManagedFillDiagnostics]', outcome.fillDiagnostics)` on Admin Test (`AutofillProfileEditor.tsx`) — Owner may still have console history; if so, paste takes priority over new runs.

#### What UI outcomes alone prove / do not prove

| Claim | Status |
|---|---|
| O1 unreliable on Leumi fixture | **PROVEN** (1/5) |
| O1 insufficient as production correction | **PROVEN** |
| First-loss still at `fill_post_input` under O1 | **NOT DETERMINABLE** without stamps |
| First-loss moved (e.g. beforeinput / change / blur / verify) | **NOT DETERMINABLE** |
| Multiple distinct mechanisms across Runs 2–5 | **SUSPECTED from UI pattern diversity** (U-empty/P-filled vs both empty) but **NOT PROVEN** without per-field stamps |
| Hub SUCCESS vs CURRENT DOM decoupling | Possible on some runs — **not** confirmed (Owner did not report Hub reason / SUCCESS vs FAIL message) |

**Hard rule honored:** no mechanism inference from visible UI alone for boundary questions (3)–(4).

#### Successful-vs-failed signature comparison (stamp level)

| Comparison | Result |
|---|---|
| Run 1 vs Runs 2–5 per-stage booleans | **BLOCKED** — stamps missing |
| username vs password first-loss under O1 | **BLOCKED** |
| Compare to pre-O1 A3.E3 signature | Only valid **after** O1 FAIL stamps show whether `fill_post_input` still flips first |

#### Pre-O1 reference signature (A3.E3 — **not** an O1 run)

First field, pre-O1 `InputEvent` with `inputType:'insertText'` + `data`:

`native_set=true` → `beforeinput=true` → **`input=false` (first loss)** → change/keyup/events/blur false; identity held.

#### Rollback policy (recorded)

- O1 is **not** accepted production behavior.  
- Do **not** stack O2/O3/O4 on unreverted O1.  
- Prefer: **preserve/capture O1-generated FAIL stamps first** (they are the only way to see O1 boundary), then **independent O1 rollback** before any different correction, unless Owner explicitly authorizes experimental retain.  
- A1 baseline remains authoritative.

#### Architecture recommendation

| Option | Choice |
|---|---|
| **A** — evidence sufficient for next DD | **NOT SELECTED** — missing O1 FAIL stamps |
| **B** — minimum diagnostic-only next step | **SELECTED** |

**B minimum (diagnostic-only; no behavioral change):**

1. If Hub DevTools still has `[A2 ManagedFillDiagnostics]` for Runs 1–5 → paste full objects (or per-run stamp tables for username+password across listed stages).  
2. Else: while O1 still loaded, re-run Bank Leumi Admin Test until **≥1 FAIL** (and ideally 1 PASS), immediately copy `[A2 ManagedFillDiagnostics]` + note Hub SUCCESS/FAIL text.  
3. Architecture compares Run PASS vs FAIL signatures (stages listed by Owner) for both fields.  
4. Owner then **AUTHORIZE O1-ROLLBACK** (independent of diagnostics).  
5. Only after rollback + stamp review → next A4 DD option (O2 or redesign) — separate Owner ACCEPT.

**Forbidden now:** O2 impl; Layer A/`manual_only`; S-120A-1; Phase 121; declaring O1 success; DH acceptance.

**Supersession:** Stamp capture for O1 both-empty FAIL recorded in **§39.A4.E2** (run `mfd_1790177284552_171751683`). O1 rollback **FROZEN** pending Owner release after E2.

---

### 39.A4.E2 — Post-verification loss boundary (O1 evidence run) (2026-09-23)

**Status:** **EVIDENCE REVIEW COMPLETE** (code + Owner stamps). **No behavioral change.**  
**O1 rollback:** **FROZEN** (retain experimental state that produced this evidence).  
**O1 production acceptance:** still **FAILED / NOT ACCEPTED**.

#### E2.1 Owner evidence (binding)

| Item | Value |
|---|---|
| RunId | `mfd_1790177284552_171751683` |
| Contract | O1 installed (`input` without `inputType`/`data`) |
| Owner UI after completion | **BOTH fields empty** |
| Hub message (Owner report) | «בדיקת המילוי המנוהל נכשלה» |

**Terminal Managed stamps (both fields) — match true through end of Managed probes:**

| Field | Stages cited | Signature |
|---|---|---|
| username `field-cccf74e4` | `post_field_advance`, `verify_held`, `verify_current_probe` | `expectedValueMatchHeld=true`, `expectedValueMatchCurrent=true`, `exactOne=exact_one`, `heldEqualsCurrent=true`, `targetReplaced=false`, `heldConnected=true` (verify_held) |
| password `field-caf4e7f1` | same terminal stages | **same terminal signature** |

**Architecture finding (accepted):** Managed fill **succeeded** for both fields through fill, cross-field advance, held verify, and fresh-current probe. **No remount/replacement** through final Managed probe. Visible loss is **after** the current Managed verification boundary. **Distinct from** pre-O1 A3.E3 (sync loss at old `input` on username).

Do **not** classify this run as in-transaction `fill_failed` without reconciling Hub message vs these stamps.

#### E2.2 Boundary map (code-inspected)

```text
fillField(s) → post_field_advance stamps
  → verifyMappings(held) → outcome ok decided
  → verify_held stamps
  → verify_current_probe stamps  (READ-ONLY; must not change outcome)
  → attachDiagnostics(outcome, bag)
  → return runManagedAutofill  ★ last page-world Managed statement
  → chrome.scripting.executeScript result → SW onDone(result)
  → finishSession / sendResponse (no page mutate)
  → Hub sendManagedAutofillPayloadAndAwait maps response.ok
  → AutofillProfileEditor requestManagedTest UI
```

#### E2.3 Answers to inspection questions

**(1) Exact boundary after `verify_current_probe`:**  
Last page-world actions: stamp loop completes → `attachDiagnostics` → `return`. SW only forwards result (+ diag log). Hub maps `response.ok`. No Managed fill/event code after the probe.

**(2) Hub FAIL vs terminal-true stamps:**

| Hub string | Source in code |
|---|---|
| `בדיקת המילוי המנוהל נכשלה. נסו שוב.` | **Only** `catch` in `requestManagedTest` (`AutofillProfileEditor.tsx`) |
| `דף הכניסה נפתח, אך המילוי האוטומטי נכשל...` | `MSG_MANAGED_FILL_FAILED` when `response.ok !== true` |

**Proven:** Quoted Owner string matches the Admin Test **exception catch**, not the Managed-fail formatter.  
**Proven:** With terminal stamps all true, `verifyMappings` and `verify_current_probe` agree values matched at Managed end → `runManagedAutofill` outcome is **`ok: true`**.  
**Proven path that yields catch + stamped diagnostics:** await returns (incl. `fillDiagnostics`) → `console.info('[A2 ManagedFillDiagnostics]', …)` → `outcome.ok` branch → `setSuccess` → `stampAdminTestPassed` / `updateGlobalRegistryRow` / `onSaved` → **throw** → `catch` sets the quoted error. Registry persistence does **not** mutate the bank tab; it can still flip Hub UI to FAIL after Managed success.  
**Not proven without Owner’s full Hub banner / `outcome.ok`:** whether this run’s UI was catch vs paraphrased Managed-fail.

**(3) Post-`verify_current_probe` mutation from our code:**

| Candidate | Finding |
|---|---|
| Further events / focus / blur / value set in Managed | **None** after probe |
| SW retry re-fill | Only if `!result.ok` && retryable — **not** for `ok:true` |
| Late readiness probes | Only if `reason === 'targets_not_ready'` — **not** this signature |
| Diag lifecycle | `tabs.onUpdated` **log only** — no DOM write |
| Hub registry save | Hub-side metadata — **no** login-tab field mutation |

**Conclusion:** Code inspection **does not** prove a product post-verify mutator. Visible clear is **outside** current Managed transaction (page/framework/async after return) — mechanism **not** guessed.

**(4) When is success declared?**  
Outcome decided at `verifyMappings` **before** `verify_current_probe`. Probe is observational. Declared success = `outcome.ok === true` returned through SW → Hub `response.ok === true` → `MSG_MANAGED_FILL_OK` (unless Hub catch overwrites UI after).

**(5) Diagnostics vs outcome boundaries:**  
**Same bag, different semantics:** stamps include read-only `verify_current_probe` after outcome freeze. Hub FAIL catch can observe **persistence** failure after a successful Managed+diag payload — **different boundary** than fill verify.

#### E2.4 Decision gate returns

| ID | Return |
|---|---|
| **A** | Hub quoted FAIL string is the Admin Test **`catch`** message; reconciled with terminal-true stamps via **Managed ok + later Hub exception** (persistence/`onSaved`), not via in-transaction `fill_failed`. |
| **B** | Last synchronous Managed page action after `verify_current_probe`: **`attachDiagnostics` then `return` from `runManagedAutofill`**. |
| **C** | **No** proven product post-verification DOM mutation source after that return. |
| **D** | **A2.3 SPEC REQUIRED** (diagnostic-only) — see E2.5. |

#### E2.5 Minimum A2.3 (SPEC ONLY — not authorized to implement)

**Purpose:** Determine **when** `expectedValueMatch*` flips true→false **after** `verify_current_probe`, without changing fill events, outcome decision, eligibility, or adding wait/retry to the fill algorithm.

**Constraints:** read-only probes; no event dispatch; no focus/blur/value writes; no outcome flip; no hostname branches; O1 left in place until Owner says otherwise; A1 locked.

**Minimum observation (same held + current locator as today):**

After outcome is frozen and `verify_current_probe` stamped, before returning from the page-world function (follow-up inject must not re-fill):

| Stage id | When | What |
|---|---|---|
| `post_verify_microtask` | `queueMicrotask` | boolean match held+current |
| `post_verify_raf` | `requestAnimationFrame` | same |
| `post_verify_timeout_0` | `setTimeout(0)` | same |

Include stamps in `fillDiagnostics` for the same `runId` (may delay **delivery** of the Ext response until these three complete — **must not** change `ok`/`reason`). Optional Hub stamp: `admin_ui_path: success|fail_summary|catch` (no secrets).

**Out of scope for A2.3:** longer sleeps, MutationObserver productization, verification timing changes for acceptance, O2, rollback.

**Impl:** **AUTHORIZED + IMPLEMENTED** (2026-09-23) — Owner ACCEPT of A2.3. No Hub `admin_ui_path`. Regression `ALL_A1_A2_A23_PASS`.

#### E2.5.E — A2.3 implementation evidence

| Item | Record |
|---|---|
| File | `extension/generic/validated-autofill.js` — `observePostVerifyAsync` after outcome freeze + `verify_current_probe` |
| Stamps | `post_verify_microtask`, `post_verify_raf`, `post_verify_timeout_0` — booleans only; same `runId`/`path`/`fieldId` |
| Outcome | `ok`/`reason`/`filled` set before observe; never reassigned; `attachDiagnostics` only after three probes complete |
| Hub admin_ui_path | **Not** added |
| Verify | `scripts/verifyPhase120A2ManagedFillDiagnostics.mjs` + A1 lock suite |
| O1 | Still frozen / not accepted; no O2; no rollback yet |

**Owner capture (ONE Bank Leumi Admin Test):** reload Hub + extension → Admin Test → copy `[A2 ManagedFillDiagnostics]` → compare `verify_current_probe` vs three `post_verify_*` for first flip true→false.

---

#### E2.6 Freeze (binding)

No O1 rollback until Owner releases freeze after sufficient post-runtime evidence. No O2. No Layer A/`manual_only`. No S-120A-1. No Digital Home acceptance. No Phase 121. No behavioral correction from E2 alone. **No longer arbitrary timeout sampling** (A2.3 window exhausted without flip).

---

### 39.A4.E3 — A2.3 live evidence (2026-09-23)

**RunId:** `mfd_1790178287581_366503101`  
**Contract:** O1 still installed (frozen / not accepted).

| Stage (both Leumi fields) | `expectedValueMatchHeld` | `expectedValueMatchCurrent` | Identity |
|---|---|---|---|
| `verify_current_probe` | **true** | **true** | exact_one; heldConnected; heldEqualsCurrent; targetReplaced=false |
| `post_verify_microtask` | **true** | **true** | same |
| `post_verify_raf` | **true** | **true** | same |
| `post_verify_timeout_0` | **true** | **true** | same |

**Finding:** A2.3 observed **no** true→false transition. Values survive Managed verify + microtask + rAF + `setTimeout(0)`.  
**Therefore:** Do **not** add arbitrary longer fixed-delay sample points. When visible loss occurs (per prior O1 1/5 series + E2), it is **later than** this window and still **unobserved by stage stamps**.

**O1:** remains reliability **FAILED / NOT ACCEPTED**.

---

### 39.A4.A2.4 — Post-runtime transition diagnostic (SPEC + SAFETY DD)

**Status:** Direction **ACCEPTED** (transition-driven; §39.A4.E3).  
**A2.4-IMPL:** **NOT AUTHORIZED** until Owner ACCEPT of **§39.A4.A2.4.S** below **and** separate AUTHORIZE A2.4-IMPL.  
**P invasiveness:** acknowledged — own `value` descriptor may alter observable semantics; gated by safety contract + offline non-interference proof.

#### API facts (binding)

| Mechanism | Observes IDL `.value` property writes? |
|---|---|
| `MutationObserver` (attributes) | **No** |
| `input` / `change` (no page dispatch) | **No** for pure programmatic assignment |
| Instance `value` accessor wrap (forward-only) | **Yes** — if installed per safety contract |
| Parent `childList` MO | Replacement/detach only |
| Lifecycle events | Navigation/visibility only |

#### Channels (unchanged intent)

| ID | Source | Notes |
|---|---|---|
| **P** | Forwarded value setter observation | **Gated** by §39.A4.A2.4.S |
| **R** | Bounded DOM replacement/detach | Already-resolved targets only |
| **E** | Passive `input` / `change` / `reset` | No preventDefault; no dispatch |
| **L** | `pagehide` / `pageshow` / `visibilitychange` | Tear-down trigger too |

**Scope:** `filledTrail` held elements + locators only. No hostname/`serviceId`.  
**Lifetime:** ≤5000ms OR first-loss OR page lifecycle termination — whichever first.  
**Forbidden:** refill; retries; focus/blur; diagnostic-dispatched events; delay ladder; outcome mutation; prototype-wide wrap.

---

### 39.A4.A2.4.S — A2.4 SAFETY DD (P accessor wrap) — awaiting Owner ACCEPT

**Purpose:** Make P safe enough that diagnostic observation does not become a new failure mode.  
**Impl:** **AUTHORIZED + IMPLEMENTED** (2026-09-23). N1–N9 **PASS** → **P installed** (B not selected as primary). Verify: `scripts/verifyPhase120A24PostRuntimeSafety.mjs` + A1 lock.

#### E2.5.E / A2.4.E — implementation evidence

| Item | Record |
|---|---|
| File | `extension/generic/validated-autofill.js` — `observePostRuntimeA24` after A2.3 |
| Paths | `admin_test` / `digital_home` only |
| P | Instance wrap per Safety DD; restore delete/redefine; fail-open |
| R/E/L | MO childList; passive input/change/reset; pagehide |
| Bound | ≤5000ms OR first-loss OR pagehide |
| O1 | Unchanged / frozen |

---

#### S1 — Obtaining the original effective `value` descriptor

For each held element `el`:

1. `ownDesc = Object.getOwnPropertyDescriptor(el, 'value')`  
2. If `ownDesc` is undefined:  
   `protoDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')`  
   (If element is not `HTMLInputElement`, use the correct prototype chain: walk `Object.getPrototypeOf` until a `value` data/accessor descriptor with `get`/`set` is found; if none → **skip P** for that element, fail-open.)  
3. **Effective forward target** `fwd`:  
   - If `ownDesc` exists and has `get` and `set` → `fwd = ownDesc`  
   - Else if `ownDesc` exists as data property → **skip P** (cannot wrap without changing data→accessor shape semantics) — fail-open, use R/E/L only  
   - Else → `fwd = protoDesc` (must have callable `get` and `set`)  
4. Record restore plan:  
   - `hadOwnValueProperty: boolean` (= `ownDesc !== undefined`)  
   - `savedOwnDesc: ownDesc | null` (structured clone of descriptor fields only; never values)  
   - `fwdGet = fwd.get`, `fwdSet = fwd.set` (function references)

#### S2 — Exact descriptor installed on the **individual element**

Install **only** as an own property on `el` (never on prototype):

```text
Object.defineProperty(el, 'value', {
  configurable: true,     // required so teardown can delete/restore
  enumerable: false,      // match typical native IDL non-enumerability; do not enumerate 'value' on for..in
  get: diagnosticGet,
  set: diagnosticSet,
})
```

- **No** `writable` / `value` data fields (accessor descriptor only).  
- `enumerable: false` — native `HTMLInputElement.prototype.value` is non-enumerable; do not widen enumeration.  
- `configurable: true` — mandatory for exact restore/delete.

#### S3 — Setter forwarding

```text
diagnosticSet(incoming) {
  // reentrancy guard BEFORE any page-visible call
  if (recording) { return fwdSet.call(el, incoming); } // or skip record; still forward
  recording = true;
  try {
    // MUST: same receiver (el), exact incoming value, no transform/String()/trim
    var ret = fwdSet.call(el, incoming);
    // AFTER native set: boolean match only (compare to expected via existing expectedValueMatch)
    // never store incoming or el.value strings in stamps
    recordSetterObservation(/* booleans + msSinceVerifyEnd only */);
    return ret; // preserve setter return semantics
  } finally {
    recording = false;
  }
}
```

Binding: `fwdSet.call(el, incoming)` — **not** `fwdSet.call(this, …)` if `this` could differ; receiver is always the instrumented element.

#### S4 — Getter forwarding

```text
diagnosticGet() {
  return fwdGet.call(el);  // same receiver; no coerce/cache/substitute
}
```

No diagnostic recording on get (avoids read-side interference and reentrancy from match probes). Match probes for R/E/L use a **direct** `fwdGet.call(el)` or pre-wrap `HTMLInputElement.prototype.value` get via saved `fwdGet` — never `el.value` while wrap is active if that would recurse through diagnosticGet for stamp helpers… Actually `el.value` WILL hit diagnosticGet. That's fine if diagnosticGet only forwards. Stamp helpers must use `fwdGet.call(el)` OR `el.value` (both OK if get only forwards). Prefer `fwdGet.call(el)` in diagnostic code to avoid depending on wrap being present.

#### S5 — Restoration (exact PRE-A2.4 property state)

On teardown (first-loss **or** ≤5s **or** lifecycle), for each instrumented `el`:

| Pre-state | Teardown |
|---|---|
| `hadOwnValueProperty === false` | `delete el.value` (own diagnostic property). Confirm `Object.getOwnPropertyDescriptor(el, 'value') === undefined`. Inheritance returns to prototype. |
| `hadOwnValueProperty === true` | `Object.defineProperty(el, 'value', savedOwnDesc)` restoring **exact** saved configurable/enumerable/get/set/writable/value fields |

If `delete` / redefine throws → fail-open: stop observing that element; do not retry wraps; leave best-effort state; stamp `wrapRestoreFailed: true` (boolean only).

#### S6 — Exception / fail-open

| Failure | Behavior |
|---|---|
| Cannot obtain `fwd` get/set | Skip P for element; R/E/L may still run |
| `defineProperty` throws | Skip P; page unchanged |
| Teardown throws | Stop; stamp restore failure; do not throw into page |
| Any unexpected throw in diagnosticSet/get | Catch, still attempt `fwdSet`/`fwdGet`; never rethrow into page setter path |

Wrapping must not break page behavior if unsafe.

#### S7 — Reentrancy

- Module flag `recording` (per element) prevents nested diagnostic `record*` from calling code that assigns `el.value` again.  
- Diagnostic recording **must not** assign `.value`, dispatch events, focus, or call Managed fill.  
- Nested `set` during `recording===true`: forward only (`fwdSet.call(el, incoming)`), **no** second stamp.

#### S8 — Lifetime

Tear down P (and R/E/L for that field) at the **earliest** of:

1. First observed loss transition for that field  
2. Wall-clock **≤5000ms** after verify-end / observer start  
3. Page lifecycle termination (`pagehide` / document teardown)

No extension of bound. No delay ladder.

---

#### Observation contract (correlation ≠ causation)

Allowed sources: **P, R, E, L** on already-resolved Managed targets only.  
Metadata/booleans only — **never** credential / `.value` strings.

`firstLossSource` schema (normative):

| Field | Meaning |
|---|---|
| `channel` | `'P'\|'R'\|'E'\|'L'` |
| `detail` | e.g. `value_setter`, `dom_detached`, `event_input`, `lifecycle_pagehide` |
| `epistemics` | **`'observed_at_boundary'`** \| **`'correlated_after_loss'`** \| **`'idle_no_loss'`** |

Rules:

- **`observed_at_boundary`:** the instrumentation that fired is the boundary where match flipped true→false in the same turn (e.g. P setter ran and `matchAfterSet===false`; or R saw detach and match false).  
- **`correlated_after_loss`:** an E/L notification fired when match was **already** false (or unknown); **must not** be reported as proven cause.  
- P with `matchAfterSet===false` → may claim `observed_at_boundary` for property-write loss.  
- E `input` after loss without a P/R boundary stamp → `correlated_after_loss` only.

---

#### Non-interference proof (mandatory before Owner live A2.4 test)

Offline synthetic verify (new or extended script; **no** live bank) must **PASS** all:

| # | Proof |
|---|---|
| N1 | Getter result identical before wrap / during wrap / after restore (same input states) |
| N2 | Setter result identical (return value + resulting value via native get) for representative assignments |
| N3 | Receiver passed to native set/get is the element under test |
| N4 | Page-like setter path still executes (fwdSet invoked; value updates) |
| N5 | After teardown with no prior own `value`: `getOwnPropertyDescriptor(el,'value')` is `undefined` |
| N6 | After teardown with prior own accessor: restored descriptor fields match saved |
| N7 | No extra focus/blur/input/change events from wrap install/teardown alone |
| N8 | `runManagedAutofill` `ok`/`reason`/`filled` unchanged vs control without A2.4 |
| N9 | A1 lock suite remains **PASS** |

**Gate:** If any of N1–N9 cannot be demonstrated → **reject P** for this slice → adopt **B** (bounded rAF boolean match loop until mismatch or ≤5s / first loss — no multi-delay ladder) + R/E/L only.

---

#### Owner ACCEPT checklist (A2.4 SAFETY)

| # | Item | Owner |
|---|---|---|
| 1 | Accept S1–S8 accessor safety contract | ☐ |
| 2 | Accept observation epistemics (correlation ≠ causation) | ☐ |
| 3 | Accept N1–N9 proof gate (fail → reject P → B) | ☐ |
| 4 | Acknowledge **A2.4-IMPL still requires separate AUTHORIZE** after ACCEPT + proof PASS | ☐ |

---

### 39.A4 — MINIMAL CORRECTION DD (Architecture return)

Superseded by **§39.A4.D0** + **E1–E3** + **A2.4 / A2.4.S**. O1 live **FAILED**. **S-120A-1** remains PROPOSED/DEFERRED.

**No A2.4 impl** until SAFETY ACCEPT + AUTHORIZE A2.4-IMPL + N-proof PASS. **No behavioral correction** from this DD alone.

---

