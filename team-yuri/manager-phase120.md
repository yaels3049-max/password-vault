# Manager Phase 120

## Phase Identifier
PHASE=120

## Status
STATUS: **READY_FOR_APPROVAL** — Slice **120.9** Detailed Design (Authoring Locator Verification Integrity)  
Architecture **review required**. **STOP after DD.** **No Developer handoff. No implementation** until Architecture PASS on this DD.  
Phase 120 Final Closure remains **FROZEN**.

## Slice authorization
| Slice | Status |
|---|---|
| **120.4** / **120.5** / **120.6** / **120.7** / **120.8** | **CLOSED** — contracts retained; **do not reopen** 120.6 or 120.8 identity decoupling |
| **§25** Visual “verified” + non-deterministic locator | **ACCEPTED** — primary **C** (SAME/E2) + A + B |
| **§26** Slice 120.9 | **AUTHORIZED — Manager DD ONLY** |
| **120.9** Authoring Locator Verification Integrity DD | **DD READY_FOR_APPROVAL** — **STOP** for Architecture |
| **120.9-impl** | **NOT AUTHORIZED** until Architecture PASS on this DD |
| Phase 120 Final Closure | **FROZEN** until DD PASS + impl ACCEPTED + R1–R15 + Owner live PASS |
| Managed Runtime exact-one / multi_match weaken | **FORBIDDEN** |
| Site / hostname / serviceId / Shufersal / Rivhit special cases | **FORBIDDEN** |
| First-match | **FORBIDDEN** |

## Source (authoritative)
- `team-Yuri/arch-phase120.md` **§25** (accepted root cause); **§26** (Slice 120.9 binding)
- Code evidence: `visual-target-pick.js` `preferExactOneLocator`; `fieldAuthoring.visualTargetsEquivalent` E2; `applyVisualMappingAuthoring`; Analyze safety without exact-one
- Unchanged: 120.4/120.6 eligibility; 120.8 opaque fieldId; D-120-12 Admin Test / DH one engine

---

# Slice 120.9 — Detailed Design: Authoring Locator Verification Integrity

## Goal
A locator may be represented as **visually verified** only when the locator that is **actually persisted** (form + eventual Save) has itself satisfied the deterministic Visual Mapping verification contract.

```text
Target identity equivalence  ≠  Locator equivalence / determinism
```

**Primary defect (§25 C):** 120.8 SAME via E2 (`currentLocator ∈ visual.locatorCandidates`) preserves a non-unique Analyze locator (e.g. `#j_password`) while stamping `visualMappingVerified=true`. Managed runtime `multi_match` fail-closed is **correct** — do not change runtime.

## Binding invariant (§26)
After Visual Mapping succeeds:

1. The **persisted** locator must itself be proven **exact-one**.  
2. It must resolve to the **same clicked target**.  
3. It must satisfy authoritative **Managed eligibility** (120.4/120.6).  

**Forbidden implication (120.8 E2):**
```text
"existing locator ∈ target's locatorCandidates"
  ≠
"existing locator is deterministic and visually verified"
```

If Visual selects a **different verified unique** locator for the **same** target → persist the **Visual unique** locator (keep useful Analyze confidence/provenance where truthful).

---

## Hard stops
| Forbidden | |
|---|---|
| Managed Runtime exact-one / multi_match / fail-closed / no first-match | STOP — do not weaken |
| Rewrite 120.4 / 120.6 Managed eligibility | STOP |
| Digital Home Managed selection / no-fallback / readiness | STOP |
| Reopen 120.8 fieldId opaque / semantic decoupling | STOP — not this defect |
| Weaken HIGH/MEDIUM **semantic meaning** (except Managed locator eligibility) | STOP |
| Admin Test engine / approval/parity / no-auto-submit | STOP |
| Hostname / serviceId / Shufersal / Rivhit / hardcoded selectors | STOP |
| First-match | STOP |
| Reopen 120.6 | STOP |
| Accept 120.9 on unit tests alone | STOP — R1–R15 + existing suites + Owner live |
| Implement / Developer handoff before Architecture PASS on DD | STOP |

---

## 1. Post-Visual Mapping — persisted locator integrity

### 1.1 Extension capture contract (tighten)
On successful Visual click, Extension **MUST** return success only when **all** hold:

| Check | Binding |
|---|---|
| Identification | Clicked control identifiable (120.4 three-state; not “not found”) |
| Candidate build | Ordered candidates (id → name → autocomplete → aria) — unchanged family |
| Exact-one choose | `preferExactOneLocator`: first candidate with `querySelectorAll.length === 1` |
| **Same clicked target** | **NEW required:** chosen locator’s sole match `matches[0] === clickedEl` (identity equality). If not → fail `locator_target_mismatch` (or equivalent) — **no** success |
| Managed eligibility | `isSafeFillTarget(clickedEl)` PASS (120.4/120.6) — unchanged |
| Payload | `{ locator: chosenUnique, locatorCandidates, … }` — candidates may still list non-unique strings for diagnostics, but **chosen** is the only success locator |

### 1.2 Hub apply / persist contract
On Visual success:

| Rule | Binding |
|---|---|
| Form / draft locator | Set to Visual’s **`result.locator`** (the proven unique string) — **always** when applying Visual success for that field |
| `visualMappingVerified` | Set `true` **only** for that field when the locator being shown/persisted **equals** Visual’s proven unique locator |
| Save | Persisted `fieldMappings[].locator` must be that same string (or Admin must not keep verified badge if they later edit to a different string without re-verify) |

### 1.3 Badge meaning «אומת במיפוי חזותי» (revised)
`visualMappingVerified === true` **means**:

1. Visual Mapping succeeded for this field, **and**  
2. The **current** locator string (form / saved) **is** the Visual-verified deterministic locator from that success (exact-one + same clicked target + Managed-eligible at capture).

It does **NOT** mean: “Admin clicked something related while an older Analyze locator was kept.”

If Admin manually edits the locator after verify → clear `visualMappingVerified` (or require re-verify). Manager: **clear on locator string change** (smallest).

---

## 2. SAME-target merge — forbid E2 implication; persist Visual unique

### 2.1 Target equivalence vs locator policy

| Concern | Use |
|---|---|
| **SAME target?** | Provenance only (keep Analyze `source`/`confidence` when appropriate) |
| **Which locator persists?** | **Always** Visual’s verified unique locator on Visual success |

### 2.2 `visualTargetsEquivalent` E1–E3 revision

| Rule | After 120.9 |
|---|---|
| **E1** `observedInputId` match | **Keep** as SAME-**target** signal only |
| **E2** `current ∈ visualLocatorCandidates` | **REMOVE** as SAME-target proof **and** remove any path that uses E2 to **preserve** current locator. Candidate membership is **not** determinism |
| **E3** `current === visual` chosen locator | **Keep** as SAME-target (and implies locator already equals Visual unique) |

**Normative Hub behavior on Visual success:**
```text
sameTarget := E1 or E3 (NOT E2)

// Locator write — ALWAYS:
formLocator[fieldId] := visual.result.locator   // verified unique

// Provenance:
if sameTarget:
  keep Analyze source/confidence when previous source was analyze
  set visualMappingVerified := true
  update observedInputId from Visual
else:
  source := visual_mapping; confidence := null
  visualMappingVerified := true
```

**Explicit:** Even when `sameTarget === true` and current form holds Analyze `#j_password`, if Visual chose `input[name="j_password"]` → **replace** with Visual unique. Do **not** preserve `#j_password`.

### 2.3 Historical failure sequence — required fix outcome
Analyze HIGH `#j_password` (multi_match) → Visual click → Ext chooses unique name locator → Hub **persists unique name locator** + `visualMappingVerified=true` → Admin Test / parity must not fail solely due to preserved `#j_password`.

No Shufersal hardcode — synthetic duplicate-id fixtures prove the generic rule.

---

## 3. Analyze — semantic confidence ≠ locator determinism

### 3.1 Separate dimensions
| Dimension | Meaning |
|---|---|
| **Semantic confidence** (HIGH/MEDIUM) | Observed control corresponds to credential field (120.8 label/type/description + page evidence; opaque fieldId) |
| **Locator determinism** | Chosen CSS string is exact-one in the inspected top document **and** resolves to the **same** observed input that was matched |

HIGH **MUST NOT** mean “this CSS string is safe for Managed execution.”

### 3.2 Smallest generic gate (before approvable/persistable Managed locator)

**Where:** After existing Analyze safety validation (Managed eligibility on observed input; locator ∈ candidates), **before** Admin form prefill / treating locator as Managed-approvable persistence candidate.

**Gate `assertLocatorDeterministic(locator, observedInput, document)`:**
```text
matches = document.querySelectorAll(locator)
PASS iff matches.length === 1 AND matches[0] === observedInput
```

Prefer a **shared exact-one helper** usable by Visual choose, Analyze gate, and (conceptually) Managed assess — **same document scope**; do not fork semantics.

| Outcome | Authoring behavior |
|---|---|
| Semantic HIGH/MEDIUM + gate **PASS** | May prefill/persist locator; confidence unchanged |
| Semantic HIGH/MEDIUM + gate **FAIL** (e.g. multi_match `#id`) | **Preserve identification** — do **not** prefill that unsafe locator as Managed mapping; surface honest “identified but locator not deterministic” (or leave mapping empty for that field); confidence may remain as **semantic** provenance fact without an approvable CSS string |
| Semantic weak | Unchanged 120.8 rules (no LOW prefill, etc.) |

### 3.3 Keep 120.8 HIGH/MEDIUM meaning
- HIGH/MEDIUM still mean semantic field↔control confidence for authoring presentation (Hebrew/color per §20).  
- Only change: **eligibility of a CSS string to enter the mapping form / Save as Managed locator** requires determinism gate.  
- Do not collapse semantic HIGH into “not identified.”

### 3.4 Inspect candidates
`buildCandidates` may still emit `#id` first without uniqueness filter (observation). Determinism gate consumes the proposed locator + observed node — does not require filtering the entire candidate list at inspect time (smallest).

---

## 4. Shared contracts / unchanged surfaces

| Area | 120.9 action |
|---|---|
| Managed Runtime assess/fill | **Unchanged** — multi_match fail-closed remains correct (R8) |
| 120.4 / 120.6 eligibility | **Unchanged** (R9/R10) |
| 120.8 opaque fieldId / Blind-ID | **Unchanged** (R11) |
| Admin Test / DH one engine | **Unchanged** (R13) |
| Clear Mapping 120.7 | **Unchanged** (R14) |
| Activate / parity gate | Still requires readiness on **persisted** locator — aided by better authoring, not bypassed |

---

## 5. Regression lock — automated (mandatory)

| ID | Contract |
|---|---|
| **R1** | Analyze locator exact-one gate PASS path |
| **R2** | Analyze semantic match + non-unique locator → **no** approvable/prefilled unsafe Managed locator; identification preserved |
| **R3** | Visual Mapping returns only unique selected locator + `matches[0]===clickedEl` |
| **R4** | SAME target + existing Analyze locator non-unique + Visual unique → **persisted = Visual unique** (E2 cannot preserve Analyze) |
| **R5** | SAME target + existing locator independently proven deterministic (=== Visual unique) → provenance truthful (`visualMappingVerified` + optional Analyze confidence) |
| **R6** | DIFFERENT target behavior from 120.8 remains correct (confidence cleared / source visual) |
| **R7** | Visual verification badge only when current locator is the Visual-verified string |
| **R8** | multi_match continues to fail closed in Managed runtime |
| **R9** | 120.4 managed eligibility regression |
| **R10** | 120.6 visibility/occlusion regression |
| **R11** | 120.8 opaque fieldId / semantic decoupling regression |
| **R12** | HIGH/MEDIUM persisted provenance regression (semantic facts; locator only if deterministic) |
| **R13** | Admin Test regression |
| **R14** | Clear Mapping regression |
| **R15** | Phase 117 deterministic Managed regression |

**Existing relevant verification suites must remain PASS.**  
**120.9 MUST NOT be Architecture-accepted on new unit tests alone.**

Synthetic fixtures: duplicate `id` on two INPUTs; unique `name` on clicked control — prove R3/R4 without named sites.

---

## 6. Live Owner verification plan (capability-based)

After 120.9-impl + automated lock PASS, Architect authorizes Owner live. Fixtures only; reuse; **no** unnecessary migrations; **no** site-specific code.

| # | Capability check | Pass signal |
|---|---|---|
| L1 | Duplicate-locator / SAME-merge case (reuse known fixture pattern: Analyze prefers `#id` multi_match; Visual click) | After Visual + Save, persisted locator is Visual unique; Admin Test / parity not multi_match on old `#id`; badge truthful |
| L2 | Normal HIGH Analyze with already-unique locator | Still prefills and works |
| L3 | 120.8 Blind-ID semantic case | Still maps without fieldId affinity |
| L4 | Existing Managed runtime fixture fill | Fills correctly; **no** auto-submit |

Do not treat Shufersal/Rivhit as product requirements — capability evidence only.

---

## 7. Acceptance criteria (AC-120.9-*)

| ID | Criterion |
|---|---|
| AC-120.9-1 | Visual success requires exact-one + `matches[0]===clickedEl` + Managed-eligible |
| AC-120.9-2 | Persisted/applied locator on Visual success = Visual unique locator |
| AC-120.9-3 | `visualMappingVerified` only for that verified locator string |
| AC-120.9-4 | E2 candidate-membership cannot preserve non-unique Analyze locator |
| AC-120.9-5 | SAME target + Visual unique → persist Visual unique |
| AC-120.9-6 | Analyze semantic HIGH/MEDIUM ≠ locator determinism; gate before Managed prefill/persist |
| AC-120.9-7 | Non-unique Analyze locator: identification preserved; no unsafe approvable Managed locator |
| AC-120.9-8 | 120.8 HIGH/MEDIUM semantic meaning retained (modulo locator eligibility) |
| AC-120.9-9 | Managed runtime / 120.4 / 120.6 / opaque fieldId unchanged |
| AC-120.9-10 | No site/hostname/serviceId/first-match |
| AC-120.9-11 | R1–R15 + existing suites PASS |
| AC-120.9-12 | Owner live L1–L4 PASS before 120.9 Architecture close |
| AC-120.9-13 | Phase 120 Final Closure remains FROZEN until AC-120.9-11 + AC-120.9-12 |

Manager self-check: DD specifies all — **PASS** for DD completeness (impl not started).

---

## 8. Developer evidence requirements (ONLY after Architecture PASS + 120.9-impl auth)

_Not a handoff:_

1. Diff: Ext `matches[0]===clickedEl`; Hub ALWAYS writes Visual unique; E2 removed/neutralized for locator preserve; Analyze determinism gate.  
2. Proof `visualMappingVerified` cleared or false when locator ≠ verified string.  
3. Automated R1–R15 evidence + existing suite PASS lock.  
4. Statement: no Managed runtime weaken; no 120.6/120.8 identity reopen; no site branches.  
5. Ready for Owner live L1–L4 (capability plan §6).  
6. Build/type/test PASS.

---

## Out of scope
- Weakening Managed multi_match  
- Site-specific selector restoration  
- Reopening identity decoupling  
- Closing Phase 120 Final Acceptance in this slice alone  
- Implementation in this DD task  

---

## Manager Review (120.9)
MANAGER_REVIEW_STATUS: **READY_FOR_APPROVAL**

### Review Notes
DD binds Visual persisted-locator determinism; forbids E2 “∈ candidates ⇒ verified”; SAME target → persist Visual unique; Analyze splits semantic vs locator determinism with smallest exact-one gate; R1–R15 + live lock; runtime untouched. Final Closure FROZEN.

### Exact next step
**Architecture review** of this DD. **STOP.** Do **not** hand off to Developer until Architecture PASS.

---

# Slice 120.8 - Detailed Design (AMENDED): Credential Identity Decoupling + Authoring Provenance — HISTORICAL

## Goal
1. Decouple **opaque `fieldId`** from Agent semantic meaning (`label` + `type` + optional `description`).  
2. Apply Architecture **Section 20**: after safety validation, **HIGH and MEDIUM** may prefill Admin mapping fields with **distinct** Hebrew + color presentation; LOW/rejected do not.  
3. Persist **current** per-field authoring/provenance facts through Save / refresh / relogin - **not** transient UI-only state.  
4. Keep Analyze / Visual Mapping / Admin Test as **evidence layers**, never approval authority.

**Scope:** Admin authoring + Agent contract + persisted current provenance under existing `autofillProfile` metadata.  
**Not:** Managed Runtime fill path, 120.6 eligibility redesign, 120.7 clear semantics change (clear **must** wipe provenance - see section 12), Digital Home gates, activate/parity redesign, auto-submit, full audit log.

## Binding principles
```text
Identity != meaning
  fieldId = opaque persistence / vault / mapping join only
  semantics = label + type + optional description + page evidence
  NEVER fieldId password-regex or fieldId<->DOM lexical affinity as meaning

Analyze is an authoring assistant, not an approval authority
  HIGH/MEDIUM describe the AI proposal only
  neither saves, approves, validates, or changes DH eligibility

Current provenance, not history
  persist facts for the mapping that currently exists
  invalidate stale facts when the mapping/config changes
  UI derives presentation from facts (never store colors)
```

## Hard stops
| Forbidden | |
|---|---|
| Implement before Owner Developer handoff | STOP |
| Change Managed Runtime / reopen 120.6 / 120.7 redesign / DH eligibility | STOP |
| Migrate/rename stable field IDs or rewrite encrypted credentials | STOP |
| `semanticRole` enum / fieldId-derived Agent semantics | STOP |
| Prefill LOW / safety-rejected / managed-ineligible | STOP |
| Represent MEDIUM as equivalent to HIGH (visual or copy) | STOP |
| Color-only confidence signal (Hebrew text mandatory) | STOP |
| Auto-save / auto-approve / set `validated` / bypass readiness/parity/safety | STOP |
| Make Visual Mapping or Admin Test mandatory for MEDIUM | STOP |
| Rewrite MEDIUM->HIGH because Admin Test passed | STOP |
| Persist green/orange/badge presentation concepts | STOP |
| Append-only full authoring event history (unless already present with zero expansion) | STOP |
| Invent HIGH/MEDIUM for ambiguous opaque Blind-ID NEG | STOP |
| Leave stale AI confidence / Admin Test success on a changed locator | STOP |

Final Phase 120 Acceptance remains **OPEN / PENDING**.

---

## 1. LoginField semantic metadata (unchanged from accepted base)

| Field | Role | Agent meaning? |
|---|---|---|
| `id` | Opaque persistence identity | **No** (join only) |
| `label` | Primary semantic carrier | **Yes - required** |
| `type` | `text` \| `password` | **Yes - required** |
| `description?` | Optional free-text disambiguation | **Yes - when present** |
| `required?` / `masked?` / `inputType?` | UX/entry | Not primary Analyze semantics |

**Contract:** `CredentialSchemaField = { fieldId, label, type?, description? }`  
No `semanticRole` enum. No ID migration. Existing `username`/`password` IDs keep working **via label+type**, not via id tokens.

### Agent / prompt / mock (binding)
- Prompt: `fieldId` opaque; meaning from label/type/description; D-118-8 non-lexical HIGH still allowed.  
- Mock: **remove** fieldId password-regex and fieldId<->DOM lexical path; password from `type`/label/description only.  
- Evidence categories: never "fieldId === DOM id/name"; `id_name_affinity` = page tokens <-> **label/description** only, or unused for HIGH.

---

## 2. Analyze proposal prefill (Section 20)

After existing deterministic safety + Managed eligibility (120.4/120.6):

| Final confidence | Prefill empty slot? | Mandatory UI (facts -> presentation) |
|---|---|---|
| **HIGH** | **Yes** | Hebrew **"ביטחון גבוה"** + green treatment; **not** "approved" |
| **MEDIUM** | **Yes** (AI proposal) | Hebrew **"ביטחון בינוני"** + orange treatment; communicate Admin review required; **must not** look equivalent to HIGH |
| **LOW** / unknown / ambiguous / safety-rejected / managed-ineligible | **No** | No locator prefill |

**Rules:**
- Color **MUST NOT** be the only signal - Hebrew text mandatory.  
- Prefill only **empty** slots (no silent overwrite of non-empty Admin content without explicit replace).  
- Confidence describes the **AI proposal only** - never approved / validated / production-ready.  
- Extend prefill helper (today HIGH-only): include `confidence === 'high' | 'medium'`.

---

## 3. Visual Mapping - optional verification (not required for MEDIUM)

- MEDIUM **does not** require Visual Mapping.  
- Admin may accept AI proposal for Save / optional Admin Test without Visual Mapping.  
- Admin **may** optionally use existing Visual Mapping to verify or correct any AI (or other) proposal.

### 3.1 Target-equivalence rule (normative - not CSS-string equality alone)

When Visual Mapping completes for `fieldId`, compare **current draft/saved mapping** to **Visual Mapping result** using capture/observation evidence:

```text
SAME effective target IFF any of:
  (E1) Both sides have observedInputId (from Analyze proposal and/or Visual Mapping
       capture for this Login Entry session) AND observedInputId values are equal.
  (E2) Visual Mapping result's locatorCandidates (css) includes the current locator
       (trim-equal) - current CSS is an alternate safe locator for the selected control.
  (E3) trim(current.locator) === trim(visual.locator) - sufficient but not necessary.

OTHERWISE -> DIFFERENT effective target.
```

**Do not** define SAME as CSS-string equality only.  
**Do not** invent new page scraping - use evidence already returned by Analyze proposals / Visual Mapping extension (`observedInputId`, `locatorCandidates`, chosen locator).

| Outcome | Locator | Authoring facts |
|---|---|---|
| **SAME** | **Preserve** current locator (do not force rewrite to another candidate) | Keep `source` if still `analyze` (confidence may remain); set `visualMappingVerified = true` |
| **DIFFERENT** | **Replace** with Visual Mapping locator | `source = visual_mapping`; `confidence = null`; set `visualMappingVerified = true`; clear stale AI confidence |

UI may show **"אומת במיפוי חזותי"** when `visualMappingVerified === true` (independent chip; may coexist with Analyze confidence only when SAME + source still analyze).

---

## 4. Manual edit provenance

If Admin **manually** changes an AI-prefilled (or any) locator string:

| Action | Required |
|---|---|
| Locator text differs from value that carried AI/visual provenance | Stale AI HIGH/MEDIUM **MUST NOT** remain |
| Set | `source = manual`; `confidence = null`; `visualMappingVerified = false` (manual edit supersedes prior visual verify for this locator) |
| UI may show | **"נערך ידנית"** |

Do **not** attribute an Admin-authored locator to AI.

---

## 5. Admin Managed Autofill Test (120.5) - optional independent evidence

| Layer | Question |
|---|---|
| Analyze confidence | What did the AI believe? |
| Visual Mapping | Which page target did Admin explicitly select? |
| Admin Autofill Test | Did the **saved** mapping fill via the same Managed mechanism? |

- Admin Test remains **OPTIONAL** - **not** required for MEDIUM.  
- Successful Admin Test **MUST NOT** rewrite MEDIUM -> HIGH.  
- Valid presentation example: **"ביטחון בינוני"** + **"נבדק בהצלחה"** (independent facts).

### 5.1 Persist Admin Test success? - **YES (current evidence only)**

**Decision:** Persist **current** Admin Test success as a fact under authoring provenance, bound to **`configVersion`**.

| Why safe | |
|---|---|
| Does not stamp `supportState=validated` | Evidence only |
| Does not change Digital Home eligibility | Unchanged D-120-13 |
| Temp credentials remain memory-only (120.5 retention B) | **Unchanged** - do **not** persist temp values |
| Stale success invalidated | When `configVersion` bumps or field locator/authoring cleared |

**Persisted fact:** `adminTestPassedAtConfigVersion: number | null`.  
UI shows **"נבדק בהצלחה"** iff `adminTestPassedAtConfigVersion === autofillProfile.configVersion`. Otherwise treat as null.

On structured Admin Test **success**, Hub may write this fact into `fieldAuthoring` **without** changing `supportState` / `validation` / activate. Temp credential retention rules unchanged.

**Invalidation:** `configVersion` bump, that field's locator change, or Clear Mapping -> clear/ignore Admin Test success (sections 8, 12).

---

## 6. Current provenance persistence model (normative)

### 6.1 Conceptual facts (per mapped field)
```text
fieldId
locator                          // already in fieldMappings[]

authoring:
  source: analyze | visual_mapping | manual
  confidence: high | medium | null     // non-null ONLY when source=analyze
  observedInputId: string | null       // when known from Analyze/Visual capture
  visualMappingVerified: boolean
  adminTestPassedAtConfigVersion: number | null
```

**Not persisted:** colors, badge styles, Hebrew strings (derived in UI), full event history, temp credentials, secrets.

### 6.2 Storage location and compatibility

**Location:** Global service registry metadata `autofillProfile`, sibling optional bag:

```text
autofillProfile = {
  supportState, configVersion, loginEntryUrl, allowedOrigin,
  fieldMappings: [ { fieldId, locatorType, locator } ],   // unchanged for runtime
  validation?: ...,                                         // activate evidence - unchanged
  fieldAuthoring?: [                                       // NEW - Admin authoring only
    {
      fieldId: string,
      source: 'analyze' | 'visual_mapping' | 'manual',
      confidence: 'high' | 'medium' | null,
      observedInputId?: string | null,
      visualMappingVerified: boolean,
      adminTestPassedAtConfigVersion?: number | null
    }
  ]
}
```

| Compatibility | Binding |
|---|---|
| Managed Runtime / extension fill | Reads **only** `fieldMappings` (+ login/origin/supportState) - **ignore** `fieldAuthoring` |
| Older Hub clients | Unknown key ignorable; missing bag => no confidence chips |
| Parse | Optional; invalid entry dropped per field; never fail closed Managed fill |
| Join | By `fieldId`; orphan authoring rows discarded on save/load |
| Clear Mapping (120.7) | `fieldMappings: []` **and** omit/clear `fieldAuthoring` |
| Vault / login_fields | **Unchanged** |

**Why sibling bag:** keeps runtime mapping contract minimal; authoring cannot be mistaken as fill input; forward-compatible.

### 6.3 When facts are written
| Event | Persistence |
|---|---|
| Analyze prefill (draft) | Draft authoring; **persist on Admin Save** with mappings |
| Visual Mapping SAME/DIFFERENT | Update draft; persist on Save |
| Manual locator edit | Update draft immediately; persist on Save |
| Admin Test success | May patch `adminTestPassedAtConfigVersion = current configVersion` without flipping `supportState` |
| Refresh / relogin / reopen | Reload `fieldAuthoring` -> reconstruct UI |

Draft-only Analyze without Save must not claim server persistence. Acceptance A/B require **Save then refresh**.

---

## 7. UI derivation rules (facts -> presentation)

| Facts | Presentation |
|---|---|
| `source=analyze` + `confidence=high` | **"ביטחון גבוה"** + green |
| `source=analyze` + `confidence=medium` | **"ביטחון בינוני"** + orange + review-required affordance |
| `source=visual_mapping` | Visual-mapping provenance (not AI confidence chip) |
| `source=manual` | **"נערך ידנית"** |
| `visualMappingVerified=true` | May add **"אומת במיפוי חזותי"** (coexist with Analyze confidence only if source still analyze / SAME) |
| `adminTestPassedAtConfigVersion === configVersion` | Independent **"נבדק בהצלחה"** |
| else | No success chip |

Confidence chips **must never** read as approved/validated. `supportState` labels remain separate.

---

## 8. Stale-evidence invalidation (normative)

| Trigger | Invalidate |
|---|---|
| Manual locator change | AI `confidence` -> null; `source` -> `manual`; `visualMappingVerified` -> false; clear Admin Test fact for that field |
| Visual Mapping **DIFFERENT** target | Replace locator; `source` -> `visual_mapping`; `confidence` -> null; `visualMappingVerified` -> true; clear Admin Test fact for that field |
| Visual Mapping **SAME** target | Keep locator + Analyze confidence if still analyze; set `visualMappingVerified` -> true; Admin Test unchanged unless configVersion changes |
| Clear Mapping (120.7) | Remove all mappings **and** entire `fieldAuthoring`; refresh must not resurrect |
| `configVersion` bump | Any `adminTestPassedAtConfigVersion !== configVersion` must not display success |
| Field mapping removed / fieldId dropped | Drop authoring row |
| Re-Analyze overwrites empty slot | New Analyze draft confidence replaces prior draft; after Save, new facts win |

**No stale evidence may be presented as applying to a changed mapping.**

---

## 9. Authority boundary (unchanged)

Analyze / confidence / Visual Mapping / Admin Test provenance **MUST NOT**:
- save automatically (except explicit Admin Save / allowed Admin-Test metadata patch that does not approve)
- approve automatically  
- set `supportState=validated`  
- bypass Managed readiness/parity (120.2-AP)  
- bypass target safety  
- change Digital Home eligibility  
- auto-submit  

```text
Analyze
  -> Admin review / optional Visual Mapping
  -> Save
  -> optional Admin Autofill Test
  -> explicit Approve
  -> Managed readiness/parity
  -> validated
```

---

## 10. Blind-ID fixtures (extended)

### 10.1 POS - opaque IDs + semantics (AC-120.8-POS)
Opaque `credential_a|b|c` + distinguishing label/type/(optional description); unrelated DOM ids; **no** fieldId lexical affinity.

| Variant | Expect |
|---|---|
| HIGH fields | Prefill; after Save+refresh/relogin -> **"ביטחון גבוה"** from persisted facts |
| >=1 MEDIUM field (e.g. business identifier) | Prefill as proposal; **"ביטחון בינוני"**; persists after Save+refresh |
| Strong semantics | May be HIGH **without** fieldId<->DOM lexical match (D-118-8) |

### 10.2 NEG - ambiguous (AC-120.8-NEG)
Opaque IDs + non-distinguishing labels + identical types -> **no** invented HIGH/MEDIUM prefill.

### 10.3 Provenance scenario matrix (mandatory evidence when impl authorized)
| ID | Scenario | Expect |
|---|---|---|
| **A** | Blind-ID HIGH | Prefill + persist + refresh shows ביטחון גבוה |
| **B** | Blind-ID MEDIUM | Prefill + persist + refresh shows ביטחון בינוני |
| **C** | LOW/rejected | No prefill |
| **D** | MEDIUM -> Visual SAME | `visualMappingVerified`; confidence may remain; אומת במיפוי חזותי |
| **E** | MEDIUM -> Visual DIFFERENT | Locator replaced; stale MEDIUM removed; source visual |
| **F** | HIGH/MEDIUM -> manual edit | Stale AI removed; נערך ידנית persists after Save |
| **G** | Admin Test success | Does **not** MEDIUM->HIGH; independent נבדק בהצלחה; invalidated after mapping/`configVersion` change |
| **H** | Clear Mapping | Mappings + `fieldAuthoring` gone; refresh clean |
| **I** | Approval / parity / runtime | Unchanged authority |
| **J** | NEG Blind-ID | No invented HIGH |
| **K** | Regress 120.5 / 120.6 / 120.7 | No regression |

---

## 11. Regression matrix

| Area | Requirement |
|---|---|
| Identity decoupling | fieldId opaque; label+type+description; mock/prompt clean |
| Phase 118 safety / invented locators / empty-input | Unchanged |
| Phase 119 Visual Mapping | Optional verify; eligibility unchanged |
| Phase 120.2-AP / activate | Unchanged |
| Phase 120.4 / 120.6 eligibility | Unchanged |
| Phase 120.5 Admin Test | Temps memory-only; optional success **fact** only; no MEDIUM->HIGH |
| Phase 120.7 Clear | Also clears `fieldAuthoring` |
| Digital Home Managed | Unchanged |
| Managed Runtime | Ignores `fieldAuthoring` |

---

## 12. Interaction with Clear Mapping (120.7)

On successful `clear_managed_mappings`:
- `fieldMappings: []` (existing)  
- **`fieldAuthoring` omitted/empty**  
- `supportState` / `configVersion` / `validation` rules **unchanged** from 120.7  
- Refresh: no locators, no confidence chips, no Admin Test success chips  

---

## 13. Out of scope
- Managed Runtime / occlusion / readiness redesign  
- Vault migration / forced ID rename  
- `semanticRole` taxonomy  
- Full authoring audit timeline  
- Making Analyze / Visual / Admin Test mandatory for activate  
- Closing Final Acceptance  

---

## Acceptance criteria - amended DD (AC-120.8-DD-*)

| ID | Criterion | Self-check |
|---|---|---|
| AC-120.8-DD-1 | Identity != meaning; fieldId opaque | **PASS** (section 1) |
| AC-120.8-DD-2 | label+type mandatory; optional description; no semanticRole | **PASS** (section 1) |
| AC-120.8-DD-3 | Section 20 HIGH+MEDIUM prefill; LOW none; Hebrew+color | **PASS** (section 2) |
| AC-120.8-DD-4 | Visual Mapping optional; SAME/DIFFERENT equivalence E1-E3 | **PASS** (section 3) |
| AC-120.8-DD-5 | Manual edit clears AI attribution | **PASS** (section 4) |
| AC-120.8-DD-6 | Admin Test optional; no MEDIUM->HIGH; success fact + configVersion bind | **PASS** (section 5) |
| AC-120.8-DD-7 | Persisted current provenance model + storage location | **PASS** (section 6) |
| AC-120.8-DD-8 | Facts not colors; UI derivation | **PASS** (sections 6-7) |
| AC-120.8-DD-9 | Stale invalidation + Clear clears authoring | **PASS** (sections 8, 12) |
| AC-120.8-DD-10 | Authority unchanged | **PASS** (section 9) |
| AC-120.8-DD-11 | Blind-ID A-K coverage defined | **PASS** (section 10) |
| AC-120.8-DD-12 | No 120.5/6/7 / runtime regression intent | **PASS** (section 11) |
| AC-120.8-DD-13 | No impl until Owner Developer handoff; Final Acceptance OPEN | **PASS** |

---

## Developer evidence requirements (ONLY after Owner Developer handoff)

1. Identity decoupling: schema `description?`; prompt/mock; Blind POS/NEG.  
2. Prefill HIGH+MEDIUM; UI Hebrew+color; LOW empty.  
3. `fieldAuthoring` persist/load; Save->refresh->relogin reconstructs chips.  
4. Visual SAME/DIFFERENT per E1-E3; manual edit provenance.  
5. Admin Test success fact; no MEDIUM->HIGH; stale after config/locator change.  
6. Clear Mapping removes authoring.  
7. Statement: no Managed Runtime / 120.6 redesign / vault migration / DH gate change.  
8. Verify scripts + `tsc` PASS; A-K evidence notes.

---

## Manager Review (120.8 AMENDED)
MANAGER_REVIEW_STATUS: **AMENDED - READY FOR OWNER DEVELOPER HANDOFF**

### Review Notes
Incorporates Architecture Section 20 + Owner provenance packet. Identity decoupling retained. HIGH/MEDIUM prefill with Hebrew+color. Current provenance persisted in `autofillProfile.fieldAuthoring` (facts only). Visual equivalence E1-E3. Admin Test success optional + configVersion-bound. Stale invalidation explicit. Authority unchanged. **STOP - do not implement until Owner sends Developer handoff.**

### Exact next step
**Owner:** send Developer handoff against **this amended DD**. Architecture may optionally re-ack amendment; Developer waits for Owner.

---

# Slice 120.7  -  Detailed Design: Clear Managed Mapping Persistence  -  HISTORICAL

## Goal
Make **Clear Mapping** a real **configuration-deletion** path for persisted Managed Autofill `fieldMappings`, so after explicit Admin clear + successful persistence + refresh, prior locators are **absent** from authoritative server state.

**Not** credential deletion. **Not** schema deletion. **Not** a Managed runtime / 120.6 eligibility change.

## Defect restatement (ֲ§17 B)
| Today | Effect |
|---|---|
| ֲ«׳ ׳§׳” ׳׳™׳₪׳•׳™ֲ» | Clears **form locators only** |
| Save on empty ג†’ `reset_not_configured` | Structural validation **rejects empty locators** before reset |
| Even if reset ran | Sets `supportState=not_configured`, deletes `validation`, **keeps previous `fieldMappings`** |
| Refresh | Old locators reload from metadata |

---

## Hard stops
| Forbidden | |
|---|---|
| Implement before Architecture PASS | STOP |
| Hostname / serviceId / `#UserName` / fixture branches | STOP |
| Delete / mutate vault or Digital Home credentials | STOP |
| Delete `login_fields` / credential schema field IDs | STOP |
| Silent `supportState=validated` or skip 120.2-AP probe | STOP |
| Auto-remap / auto-Analyze after clear | STOP |
| Represent failed persist as successful clear (C4) | STOP |
| Reopen 120.6 safety redesign | STOP |
| Close Final Phase 120 Acceptance in this DD | STOP |

---

## 1. Normative semantics  -  what ג€Clear Mappingג€ means

| Concept | Binding |
|---|---|
| **Clear Mapping** | Admin intent to **remove all Managed Autofill fieldMappings** from the serviceג€™s `autofillProfile` |
| **Persisted result** | Authoritative metadata after success: `fieldMappings: []` (empty array) |
| **Not cleared** | Credential schema (`login_fields` / fieldIds); user vault credentials; `credentialMode`; Login Entry URL on the service row (unless separately edited) |
| **Configuration deletion** | Yes  -  locators/mappings only |
| **Credential deletion** | **No** |

After successful clear + refresh: Admin locator inputs empty; no prior CSS locators in `autofillProfile.fieldMappings`; Admin Managed Test unavailable until new mappings are saved (`savedProfileReady` false).

---

## 2. State model

### 2.1 UI states
| State | Form locators | Dirty vs server | Persisted `fieldMappings` |
|---|---|---|---|
| **S0 Clean mapped** | Match server | Clean | Non-empty |
| **S1 Draft cleared** | All empty | **Dirty** (empty ג‰  saved non-empty) | Still old (until persist) |
| **S2 Clean cleared** | Empty | Clean | **`[]`** |
| **S3 Persist failed** | Empty (draft) or restored  -  see ֲ§7 | Dirty or restored | **Unchanged** (old) |

### 2.2 Transitions
```text
S0  --[Clear Mapping + confirm]-->  S1 (form empty, dirty; server unchanged)
S1  --[Save / Persist clear SUCCESS]-->  S2
S1  --[Save / Persist clear FAIL]-->  S3 (error; must NOT claim cleared on server)
S1  --[Cancel / reload without save]-->  S0 (refresh restores old  -  expected until persist)
S2  --[Analyze/Visual/type locators]-->  dirty mapped draft ג†’ Save ג†’ mapped candidate
```

**Normative product rule:** Clear alone does **not** write the server. Persistence requires the explicit Save/persist-clear step (or a single combined ג€Clear and saveג€ control  -  see ֲ§3). After persist success, refresh must remain in **S2**.

---

## 3. UI contract

### 3.1 Preferred interaction (minimal change to Owner mental model)
1. **Clear Mapping** ג†’ confirmation (ֲ§5) ג†’ form locators emptied ג†’ **S1**.  
2. **Save Mapping** (enabled while dirty empty + existing profile) ג†’ runs **clear-persist action** (ֲ§4) ג†’ on success **S2** + success copy that mappings were **removed from the service configuration**.

### 3.2 Dirty / Save enablement
| Condition | Binding |
|---|---|
| After Clear to empty while server still has mappings | `hasUnsavedChanges === true`; **Save enabled** |
| After successful clear persist | Clean; Save disabled until new edits |
| Structural `emptyLocator` errors | Must **not** block the clear-persist action (today they block `reset_not_configured`) |

### 3.3 Optional UX (Manager preference  -  pick one in impl if Architecture accepts either)
| Option | Description |
|---|---|
| **P1 (default)** | Keep Clear ג†’ Save as two steps (fixes persist semantics only) |
| **P2** | Single button ֲ«׳ ׳§׳” ׳•׳©׳׳•׳¨ ׳׳™׳₪׳•׳™ֲ» that confirms + persists in one gesture |

DD accepts **P1** as normative; P2 allowed if it implements the same persistence contract.

### 3.4 Labels / honesty
| Event | UI |
|---|---|
| Clear form only | Confirm: form will empty; **Save required** to remove from server (if P1) |
| Persist success | Success: mappings removed from configuration; credentials untouched |
| Persist failure | Error; **no** ג€׳”׳׳™׳₪׳•׳™ ׳ ׳•׳§׳”ג€ success (C4) |

---

## 4. Persistence contract

### 4.1 Action
Introduce / normalize a dedicated action (name free; recommended):

**`clear_managed_mappings`**

May replace or supersede the broken empty-form use of `reset_not_configured`. If `reset_not_configured` is retained, it **must** be redefined to meet this contract (empty `fieldMappings` + supportState rules below). Prefer a **distinct** action so `save` structural rules stay strict for non-empty writes.

### 4.2 Authoritative write result
On success, persisted `autofillProfile` MUST have:

| Field | Value |
|---|---|
| `fieldMappings` | **`[]`** (empty  -  prior locators gone) |
| `validation` | **Absent** (deleted / omitted) |
| `supportState` | Per ֲ§5 |
| `configVersion` | Per ֲ§5 |
| `loginEntryUrl` / `allowedOrigin` | **Retain** previous profile values (Login Entry still from service; no requirement to wipe URL) |

### 4.3 Planning rules (`planAutofillProfileWrite` or equivalent)
For action `clear_managed_mappings`:

1. **Do not** apply empty-locator / missing-required-mapping structural rejection used for `save`.  
2. **Do not** merge/keep previous `fieldMappings` when clearing  -  force `[]`.  
3. Delete `validation` metadata.  
4. Apply supportState + configVersion rules (ֲ§5).  
5. Fail closed on unknown action / cannot clear validated without meeting ֲ§5 confirmed path.

### 4.4 API / registry
`updateGlobalRegistryRow` metadata merge must persist the planned profile. No partial client-only clear. No hostname branching.

### 4.5 What must never be in the clear payload effect
- Vault ciphertext / Digital Home credentials  
- `login_fields` schema / fieldId definitions  
- Silent activate  

---

## 5. supportState / configVersion / validation / confirmed intent

### 5.1 Unvalidated candidate (`not_configured` or equivalent non-validated)
| Item | Binding |
|---|---|
| Confirmation | Required before leaving S0ג†’S1 or before persist (at least one confirm in the Clearג†’Save path) |
| After success | `supportState = not_configured`; `fieldMappings = []`; no `validation` |
| `configVersion` | Bump if previous had any non-empty mappings (security-relevant mapping removal) |

### 5.2 `unsupported`
| Item | Binding |
|---|---|
| After success | Prefer `not_configured` with `fieldMappings = []` (clean slate) **or** remain `unsupported` with empty mappings  -  Manager normative: **`not_configured` + empty mappings** for consistency with ג€no Managed mapping configuredג€ |
| `validation` | Deleted |
| `configVersion` | Bump if mappings removed |

### 5.3 Already `validated` (C2)
| Item | Binding |
|---|---|
| May clear? | **Yes**, with **stronger confirmation** (explicit: Managed Autofill will stop for Digital Home until re-mapped and re-validated) |
| After success | Must **not** remain `validated` with version-matched validation |
| Normative result | `supportState = not_configured`; `fieldMappings = []`; `validation` deleted; **`configVersion` bumped** |
| Production effect | `isManagedAutofillEligible` / Digital Home Managed path **fail closed** (no mapping + not validated) |
| Forbidden | Leaving `supportState=validated` with empty mappings; leaving stale `validation` pointing at old configVersion without bump |

This **supersedes** todayג€™s hard `cannotResetValidated` for the **clear_managed_mappings** action only (not for casual empty save). Activate path (120.2-AP) unchanged.

### 5.4 Confirmation copy (normative intent)
- Credentials / passwords are **not** deleted.  
- Only Autofill **locators/mappings** are removed.  
- If validated: service will **not** use Managed Autofill until Admin maps and re-approves.

---

## 6. Failure / rollback (C4)

| Failure | Required behavior |
|---|---|
| Network / API / plan reject | Show error; **do not** show clear-success toast |
| Server unchanged | Form may stay empty (**S3 dirty**) **or** UI reloads row from server  -  either OK if honest |
| Forbidden | UI empty + success message while server still has `#UserName` etc. |
| Retry | Admin may Save again; refresh must show truth of server |

---

## 7. Auditability
| Event | Record (no secrets) |
|---|---|
| Clear persist attempted | action id, serviceId, previous supportState, previous mapping count (not locators/values) |
| Clear persist success | new supportState, configVersion, mapping count 0 |
| Clear persist failure | error code only |

No credential values, no locator strings required in logs (optional fieldId list without locators).

---

## 8. Acceptance matrix (C1ג€“C6 +)

| ID | Criterion | Evidence |
|---|---|---|
| **C1** | Persisted mapping ג†’ Clear ג†’ Save/confirm ג†’ refresh ג†’ mappings **absent** | Automated +/or manual |
| **C2** | Validated mapping cleared ג†’ no longer Managed-production eligible | `supportState` not validated; eligibility false |
| **C3** | User credential values untouched | No credential/vault write in clear path |
| **C4** | Failed persist ג†’ no false success | UI + plan fail path |
| **C5** | No hostname/serviceId special handling | Static scan |
| **C6** | Analyze / Visual / Managed-parity / Admin Test / Digital Home intact | Regression notes |
| **C7** | Schema fieldIds remain; only locators cleared | Profile + login_fields unchanged |
| **C8** | Admin Test unavailable after clear until new save (`savedProfileReady`) | UI gate |
| **C9** | Candidate clear works without requiring validated | Path ֲ§5.1 |

---

## 9. Regression matrix

| Area | Requirement |
|---|---|
| Phase 117 structural `save` | Non-empty save still rejects empty locators |
| Phase 120.2-AP | Activate still requires probe; clear does not activate |
| Phase 120.4 / 120.6 | Eligibility module untouched |
| Phase 120.5 Admin Test | Uses saved mappings only; after clear, test disabled until remapped+saved |
| Digital Home | After validated clear, Managed path not eligible |
| Analyze / Visual | Still work on empty form; no auto-persist |
| ֲ§17 Finding A | Unchanged (temps still required for Test) |

---

## 10. Genericity
Works for any service/schema. Named fixtures (`#UserName`, etc.) = validation evidence only. **No** site adapters.

---

## 11. Out of scope
- Fixing Analyze no-overwrite toast (ֲ§18 UX debt)  
- 120.6 visibility changes  
- Credential wipe / schema editor redesign  
- Closing Final Acceptance  

---

## 12. Implementation sketch (NOT authorization)
When Architecture PASS + 120.7-impl authorized:

1. Add `clear_managed_mappings` (or redefine reset) in `validatedProfile.ts` per ֲ§4ג€“ֲ§5.  
2. Wire Admin Save-on-empty / Clear+Save to that action; structural bypass **only** for this action.  
3. Confirmations per ֲ§5; success/failure honesty per ֲ§6.  
4. Tests: C1ג€“C9; validated clear ג†’ eligibility false; no credential writes.  
5. No extension Managed fill changes.

---

## Acceptance criteria  -  DD (AC-120.7-DD-*)

| ID | Criterion | Self-check |
|---|---|---|
| AC-120.7-DD-1 | Clear = configuration deletion of fieldMappings, not credentials | **PASS** (ֲ§1) |
| AC-120.7-DD-2 | Persist results in `fieldMappings: []` surviving refresh | **PASS** (ֲ§4, C1) |
| AC-120.7-DD-3 | Validated clear invalidates Managed production use | **PASS** (ֲ§5.3, C2) |
| AC-120.7-DD-4 | Structural empty-locator no longer blocks clear action | **PASS** (ֲ§4.3) |
| AC-120.7-DD-5 | Failed persist cannot claim success | **PASS** (ֲ§6, C4) |
| AC-120.7-DD-6 | State model S0ג€“S3 + dirty/Save rules | **PASS** (ֲ§2ג€“ֲ§3) |
| AC-120.7-DD-7 | No site-specific behavior; regressions C6 | **PASS** (ֲ§9ג€“ֲ§10) |
| AC-120.7-DD-8 | No Developer handoff in this slice | **PASS** |

---

## Developer evidence requirements (ONLY after Architecture PASS + 120.7-impl auth)

_Not a handoff:_

1. Diff: clear action forces `fieldMappings: []`; supportState/configVersion/validation per ֲ§5.  
2. Proof structural empty no longer blocks clear; normal `save` still rejects empty locators.  
3. C1 refresh test; C2 validated clear eligibility; C3 no credential writes; C4 fail honesty.  
4. No hostname/serviceId branches.  
5. Regression ֲ§9.  
6. Build/type/test PASS.

---

## Manager Review (120.7)
MANAGER_REVIEW_STATUS: **CLOSED** (historical  -  120.7-impl as recorded in arch)

### Review Notes
Clear Mapping persistence. Superseded active work: see **120.8** at top of file.

### Exact next step
_(historical)_

---

# Slice 120.6  -  Detailed Design: Managed Visibility Correction  -  HISTORICAL (CLOSED / IMPLEMENTED)

_Status header above this slice is superseded by **120.7**. Slice 120.6 DD body retained below for audit._

STATUS (historical): Slice **120.6** was Architecture PASS + impl ACCEPTED. Current runtime uses revised V3/V8 contract. **Do not reopen** for Clear Mapping work.

---

## Goal
Correct the Managed target-safety contract so **`aria-hidden="true"` on an ANCESTOR is no longer an absolute Managed-ineligibility reject**, while:

1. **`aria-hidden` SELF** on the target INPUT remains **absolute reject**;  
2. The wrong-target risk V4 bluntly approximated (background fields under overlays) is covered by a **generic hit-test / occlusion** check;  
3. Analyze / Visual / Managed-parity / Admin Test / Digital Home continue to share **one** authoritative eligibility module (120.4);  
4. No site-specific behavior.

This is a **Managed safety-contract change**. Design only  -  **STOP before implementation**.

## Binding decisions (from ֲ§16)
| Decision | Binding |
|---|---|
| Classification | **B** (ancestor absolute rule over-restrictive) |
| `aria-hidden` SELF | Remains Managed-ineligible (**A**) |
| `aria-hidden` ANCESTOR | **Not** absolute reject; informational only |
| Do **not** simply delete V4 | Replace lost protection with generic occlusion/interactivity check |
| No site-specific behavior | D-120-9 / D-120-11 |

Named live evidence (`#UserName`, `#content`, `role=document`, etc.) = **acceptance evidence only**  -  never product logic.

---

## Hard stops
| Forbidden | |
|---|---|
| Implement before Architecture PASS on this DD | STOP |
| Delete V4 without shipping hit-test replacement in same change | STOP |
| Weaken SELF aria-hidden / CSS hide / exact-one / origin / top-doc | STOP |
| Hostname / serviceId / `#UserName` / `#content` / `role=document` / `ng-scope` / framework branches | STOP |
| Dedicated adapter / approval bypass / stamp validated without re-probe | STOP |
| Arbitrary clicking / focus storms as ג€eligibilityג€ | STOP  -  **inspection only** |
| Divergent isVisible copies outside shared module | STOP |
| Close Final Phase 120 Acceptance in this DD | STOP |

---

## 1. Revised authoritative Managed target-safety contract

**Single source of truth:** `ManagedTargetEligibility` (extension shared module used by fill-executor, form-detector, page-structure-inspect, visual-target-pick, assess/parity). After 120.6, **one** revised algorithm  -  no parallel predicates.

### 1.1 `isSafeFillTarget(element)`  -  preserved gates (S*)

| # | Rule | Fail |
|---|---|---|
| S1 | Element exists | ineligible |
| S2 | `tagName === 'INPUT'` | `not_input` |
| S3 | `type !== 'hidden'` | `hidden_target` |
| S4 | `!disabled` | `non_editable` |
| S5 | Revised Managed visibility / interactivity (ֲ§1.2ג€“ֲ§2) | see subreasons |
|  -  | **`readOnly` alone** | **Does NOT fail** (unchanged  -  fill may clear readOnly) |

### 1.2 Revised Managed visibility / interactivity (V*)

| # | Rule | Change vs 120.4 |
|---|---|---|
| V1 | `disabled` ג†’ reject | Unchanged |
| V2 | `type === 'hidden'` ג†’ reject | Unchanged |
| **V3** | **`aria-hidden="true"` on the TARGET itself** ג†’ reject | **Unchanged  -  absolute** |
| **V4** | ~~`closest('[aria-hidden="true"]')` absolute reject~~ | **REMOVED as absolute reject** |
| V4ג€² | Ancestor `aria-hidden` | **Informational only**  -  does **not** fail eligibility; may be noted in diagnostics |
| V5 | Computed `display:none` or `visibility:hidden` ג†’ reject | Unchanged |
| V6 | `getClientRects().length === 0` ג†’ reject | Unchanged |
| V7 | Bounding rect width `< 2` or height `< 2` ג†’ reject | Unchanged |
| **V8 (NEW)** | **Generic hit-test / occlusion** (ֲ§2) must PASS | **Required replacement for V4 protection** |
|  -  | `opacity:0` alone | Still **not** a reject (unchanged) |

### 1.3 Orthogonal preserved contracts (not part of isVisible body but binding)
| Contract | Preserve |
|---|---|
| Exact-one locator match before safety | Unchanged |
| Origin / `allowedOrigin` | Unchanged |
| Top-document only | Unchanged |
| Readiness polling / fail-closed | Unchanged |
| No auto-submit | Unchanged |
| No silent Managedג†’legacy fallback | Unchanged |

### 1.4 Normative eligibility algorithm (revised)
```text
function isSafeFillTarget(el):
  if !el or tagName !== INPUT ג†’ false
  if type === hidden or disabled ג†’ false
  // readOnly: ignore for eligibility

  if aria-hidden SELF on el ג†’ false                    // V3
  // DO NOT: closest('[aria-hidden=true]') absolute    // old V4 REMOVED

  style = getComputedStyle(el)
  if display none or visibility hidden ג†’ false         // V5
  if getClientRects().length === 0 ג†’ false             // V6
  rect = getBoundingClientRect()
  if width < 2 or height < 2 ג†’ false                   // V7

  if !passesHitTest(el) ג†’ false                        // V8 NEW
  return true
```

**Ordering note:** Run cheap CSS/ARIA-self/layout checks **before** hit-test. Hit-test only after the target is a laid-out, CSS-visible, non-self-hidden INPUT.

**Transition law:** Until 120.6-impl ships and is Architecture-accepted, **current code V4 remains runtime law**. Do not mark live mappings validated on the expectation of this DD alone.

---

## 2. Generic occlusion / hit-test check (V8)

**Purpose:** Fail-closed interactive reachability  -  replace the modal/background proxy that absolute V4 provided.  
**Not:** clicking, focusing for side effects, or site choreography. **Inspection only.**

### 2.1 Primitive
Use viewport coordinates + `document.elementFromPoint(x, y)` (top document only  -  already Managed scope). Prefer the same `document` that owns the target.

### 2.2 Points tested
| Policy | Binding |
|---|---|
| **Minimum** | **Center** of `getBoundingClientRect()`: `(left + width/2, top + height/2)` |
| **Required bounded multi-point** | **Center + four inset points** (25% inset from each edge toward center), i.e. **5 points total**  -  reduces false ACCEPT when only a corner peeks from under an overlay |
| Pass rule | **All sampled points that are in-viewport** must PASS the hit relationship (ֲ§2.5). If **fewer than 3** in-viewport sample points exist after scroll attempt (ֲ§2.3), **fail-closed** (`occluded` / `not_interactable`) |

Center-only is **not** sufficient alone for PASS (multi-point required). Center-only may be used only as an early fail if center already fails.

### 2.3 Scrolling / viewport / offscreen
| Case | Behavior |
|---|---|
| Target fully or partially outside viewport | **One** bounded `scrollIntoView({ block: 'nearest', inline: 'nearest' })` (or equivalent), then recompute rects and re-sample |
| Still offscreen / zero in-viewport samples after scroll | **Reject**  -  `not_interactable` / `offscreen` (fail-closed; do **not** ACCEPT) |
| Scroll causes layout thrash | Hit-test remains fail-closed; readiness retries (ֲ§2.8) may re-attempt |

Do **not** invent multi-page scroll hunting. One scroll attempt per hit-test invocation.

### 2.4 What constitutes an acceptable hit (ֲ§2.5 relationship)

For sample point `(x,y)` let `hit = document.elementFromPoint(x, y)`.

| Result | Verdict |
|---|---|
| `hit == null` | **FAIL** that point |
| `hit === target` | **PASS** |
| `target.contains(hit)` | **PASS** (painted child inside control, e.g. pseudo-structure / inner node) |
| `hit` is an associated `<label>` for `target` (`label.htmlFor === target.id` or `label.contains(target)`) | **PASS** (legitimate label overlay) |
| `hit` is an ancestor of `target` **and** `hit` is not a different interactive control that covers the target | **PASS only if** walking from `hit` downward / from `target` upward shows `target` is still the control under the point **and** no foreign opaque control sits between  -  practical rule: if `hit.contains(target)` **and** there is no other `INPUT`/`BUTTON`/`A`/`TEXTAREA`/`SELECT` between `hit` and `target` that is not the target, treat as **PASS** (parent wrapper). Prefer strict: **PASS** if `hit === target` \|\| `target.contains(hit)` \|\| associated label; **otherwise FAIL** unless Developer proves wrapper case needed  -  Manager default: **strict triad** (target / descendant / associated label) for PASS; wrappers that steal the hit without being label ג†’ **FAIL** (`occluded`) |
| Foreign overlay / modal / other control | **FAIL**  -  `occluded` |

**Manager normative PASS set (binding for DD):**  
`hit === target` OR `target.contains(hit)` OR `isAssociatedLabel(hit, target)`.

### 2.5 Labels / icons / legitimate overlays
| Element | Treatment |
|---|---|
| Associated `<label>` | Acceptable hit (ֲ§2.4) |
| Icon/decoration **inside** the INPUTג€™s box that is a descendant | Acceptable via `contains` |
| Unrelated floating button/icon covering the center | **Occluded**  -  FAIL |
| Semi-transparent overlay that still wins `elementFromPoint` | **Occluded**  -  FAIL (viewport topmost wins) |

### 2.6 `pointer-events`
| Situation | Interpretation |
|---|---|
| Overlay has `pointer-events: none` ג†’ hit reaches target | **PASS** if relationship OK  -  target is interactively reachable |
| Target has `pointer-events: none` ג†’ hit never the target | **FAIL**  -  not interactable for user/pointer; Managed must not treat as safe fill target |
| Hit-testing reflects composed stacking + pointer-events | Do not special-case frameworks |

### 2.7 Transforms / scaled elements
Use `getBoundingClientRect()` (transform-aware) for sample points. Do not use offsetWidth-only geometry. If transform yields degenerate rect already rejected by V6/V7.

### 2.8 Race with readiness / bounded retry
| Rule | Binding |
|---|---|
| When | Hit-test runs **inside** each readiness/assess attempt after layout checks pass |
| Transient null / mismatch | Allow **one** immediate re-sample after rAF or ג‰₪50ms delay **within the same assess tick** (optional); if still fail ג†’ that attempt fails |
| Outer readiness retries | Existing Managed readiness poll may re-invoke full `isSafeFillTarget` (including V8) on later ticks  -  unchanged budget |
| Cannot determine reliably | **Fail-closed**  -  never ACCEPT on uncertainty |

### 2.9 Fail-closed summary for V8
ACCEPT only when multi-point hit-test **passes**. Any of: null hits, foreign topmost element, offscreen after one scroll, `<3` in-viewport samples, `pointer-events` making target unreachable ג†’ **REJECT** with subreason `occluded` or `not_interactable`.

### 2.10 Explicit non-goals of hit-test
No synthetic click ֲ· no focus() requirement for PASS ֲ· no site-specific selectors ֲ· no ג€click label to open modalג€ automation.

---

## 3. ARIA SELF vs ANCESTOR  -  intentional distinction

| Signal | Eligibility effect | Why different |
|---|---|---|
| **`aria-hidden` SELF on INPUT** | **Absolute REJECT** (`aria_hidden_self`) | Control is explicitly marked AT-hidden on itself  -  strong decoy / honeypot / non-intended-fill signal; do not programmatically fill |
| **`aria-hidden` on ANCESTOR** | **Not** an eligibility reject; optional diagnostic note only | ARIA AT-exclusion of a subtree ג‰  CSS invisibility or non-editability; live evidence shows laid-out editable INPUTs under ancestor `aria-hidden` (classification **B**). Absolute V4 false-rejects. Wrong-target/modal risk handled by **V8 hit-test**, not ARIA ancestry |

Do **not** treat them the same. Do **not** ג€fixג€ SELF by removing both.

---

## 4. One authoritative contract (120.4 remains binding)

| Consumer | Must use revised `ManagedTargetEligibility.isSafeFillTarget` / `isVisible` |
|---|---|
| Analyze inspect (`managedEligible`) | Yes |
| Visual Mapping post-click eligibility | Yes |
| Managed-parity `assessManagedTargetsReady` | Yes |
| Admin Managed Autofill Test (120.5) | Yes (D-120-12) |
| Digital Home Managed runtime fill | Yes |

**Forbidden:** reintroduce divergent `isVisible` in page-structure-inspect / visual-target-pick / form-detector fallbacks that restore absolute ancestor V4 or skip V8. Fallback copies in form-detector **must** be updated in lockstep or removed in favor of shared-only.

If dual fallback remains for load-order: **mandatory contract-parity tests** (same as 120.4 E.8) including F-ANC-ACTIVE / F-ANC-OCCLUDED / F-SELF.

---

## 5. Identification ג‰  eligibility (120.4 three-state  -  no regression)

| State | Meaning | 120.6 impact |
|---|---|---|
| **NOT_IDENTIFIED** | No reliable semantic target | Unchanged |
| **IDENTIFIED_AND_MANAGED_ELIGIBLE** | Identified + revised `isSafeFillTarget` | May include **F-ANC-ACTIVE** patterns (flip vs old Fixture A) |
| **IDENTIFIED_BUT_MANAGED_INELIGIBLE** | Identified + fails revised eligibility | Still used for F-SELF, F-ANC-OCCLUDED, CSS-hidden, etc.  -  **must not** collapse to NOT_IDENTIFIED |

Semantic identification remains independent of the revised eligibility decision. Observation vs `managedEligible` separation (120.4 ֲ§1A) remains.

---

## 6. Safe structured subreasons

### 6.1 Internal reason codes (non-secret)
| Code | When |
|---|---|
| `not_input` | Non-INPUT |
| `hidden_target` | `type=hidden` |
| `non_editable` | `disabled` (readOnly alone ג‰  this) |
| `aria_hidden_self` | V3 |
| `display_or_visibility` | V5 |
| `zero_rects` | V6 |
| `too_small` | V7 |
| `occluded` | V8 fail  -  foreign topmost / covered |
| `not_interactable` | V8 fail  -  offscreen / pointer-events / indeterminate |
| `aria_hidden_ancestor` | **Diagnostic/informational only** when ancestor present  -  **must not** be used as sole reject after 120.6; may appear alongside PASS notes or omitted |

**Removed as reject-causing code:** absolute `aria_hidden` / `aria_hidden_ancestor` as the reason that fails eligibility.

### 6.2 Forbidden in payloads
Credential values ֲ· Admin test values ֲ· current page input values ֲ· cookies/tokens/storage ֲ· unrelated HTML dumps ֲ· named-site fields.

### 6.3 Propagation
| Surface | Propagation |
|---|---|
| Visual Mapping | Eligibility reject carries `managed_ineligible` + subreason code; not ג€not foundג€ |
| Managed-parity | `unsafe_target` (or existing coarse) + `subDetail` / `reason` = code above |
| Admin Test (120.5) | Same structured Managed result; no secrets |
| Digital Home | Same extension structured result where already surfaced |

User-facing Hebrew/English copy may map codes ג†’ friendly text separately; codes remain stable for logs/Admin diagnostics.

### 6.4 `classifyManagedIneligibility` update
Order checks: not_input ג†’ hidden ג†’ disabled ג†’ **aria_hidden_self** ג†’ display/visibility ג†’ zero_rects ג†’ too_small ג†’ **occluded/not_interactable** (run hit-test classifier). Do **not** return ancestor aria as hard reject.

---

## 7. Synthetic acceptance fixtures

| ID | DOM pattern | Expected eligibility | Subreason if reject |
|---|---|---|---|
| **F-SELF** | INPUT itself `aria-hidden="true"`, laid out | **REJECT** | `aria_hidden_self` |
| **F-ANC-ACTIVE** | Ancestor `aria-hidden=true`; INPUT CSS-visible, editable, sized, **hit-test PASS**, exact-one | **ACCEPT** |  -  (replaces old 120.4 Fixture A reject) |
| **F-ANC-OCCLUDED** | Ancestor may be `aria-hidden`; INPUT laid out but **covered** so hit-test FAIL | **REJECT** | `occluded` |
| **F-CSS-HIDDEN** | `display:none` / `visibility:hidden` / zero rects / too_small | **REJECT** | existing codes |
| **F-PLAIN** | Normal eligible INPUT, no aria-hidden | **ACCEPT** |  -  |

### 7.1 Additional edge fixtures (required by hit-test design)
| ID | Pattern | Expected |
|---|---|---|
| **F-LABEL-HIT** | Associated label covers center; INPUT eligible otherwise | **ACCEPT** (label relationship) |
| **F-OFFSCREEN** | INPUT laid out far below fold; after one scroll still not hittable **or** becomes hittable | If hittable after one scroll ג†’ proceed; if not ג†’ **REJECT** `not_interactable` |
| **F-POINTER-NONE-TARGET** | Target `pointer-events: none` | **REJECT** |
| **F-POINTER-NONE-OVERLAY** | Overlay `pointer-events: none` over eligible INPUT | **ACCEPT** if hit reaches target |
| **F-PARTIAL-PEEK** | Only a thin edge visible under overlay; multi-point fails | **REJECT** `occluded` |

### 7.2 Expectation flip (explicit)
120.4 Fixture A / R3 ג€ancestor aria-hidden ג†’ ineligibleג€ becomes **F-ANC-ACTIVE ג†’ ACCEPT** when hit-test passes. Tests **must** be updated in 120.6-impl; leaving old expectation is a **FAIL**.

---

## 8. Regression matrix

| Area | Requirement |
|---|---|
| Phase 117 Managed Autofill | Fill still exact-one, fail-closed, no auto-submit; gains F-ANC-ACTIVE eligibility |
| Phase 118 Analyze | `managedEligible` follows revised contract; three-state intact; F-ANC-ACTIVE ג†’ state #2 when identified |
| Phase 119 Visual Mapping | Post-click eligibility uses revised contract; F-ANC-OCCLUDED ג†’ eligibility reject not ג€not foundג€ |
| Phase 120.2-AP Managed-parity | Activate still requires probe PASS; probe uses revised safety |
| Phase 120.4 ID ג‰  eligibility | Three states preserved; no collapse #3ג†’#1 |
| Phase 120.5 Admin Test | Same engine (D-120-12); results/subreasons; no side effects on supportState |
| Digital Home Managed | Same eligibility; still requires validated production gate |
| Delayed readiness | Outer retries still re-assess including V8 |
| No auto-submit | Unchanged |

---

## 9. Genericity

**FORBIDDEN in design and impl:** hostname branching ֲ· serviceId branching ֲ· `#UserName` special handling ֲ· `#content` special handling ֲ· `role=document` exception ֲ· Angular/`ng-scope` exception ֲ· named-site selectors ֲ· dedicated adapter ֲ· approval bypass.

Named live site = **retest evidence only** after impl + Architecture accept  -  then Admin remaps/re-probes under new contract. Do **not** stamp validated in this DD.

---

## 10. Final Acceptance / transition

| Item | Status |
|---|---|
| Current runtime absolute V4 | **Still binding until** 120.6-impl verified + Architecture-accepted + live retest |
| Mark current mapping validated now | **FORBIDDEN** |
| Final Phase 120 Acceptance | **OPEN / PENDING** |
| Live retest after ship | Required before claiming Final Acceptance progress on this defect |

---

## Shared-contract integration (impl sketch  -  not authorization)

When Architecture PASS + 120.6-impl authorized:

1. Edit **only** `managed-target-eligibility.js` (and lockstep fallbacks if any) for V4 removal + V8 + classify updates.  
2. Ensure inject order loads shared module everywhere 120.4 already does.  
3. Wire subreasons through assess / Visual / Admin Test / DH structured results.  
4. Update 120.4 synthetic tests: Fixture A ג†’ F-ANC-ACTIVE; add F-ANC-OCCLUDED / F-SELF / edge fixtures.  
5. No Admin UI feature work beyond consuming new subreasons if already displayed.

---

## Acceptance criteria  -  DD (AC-120.6-DD-*)

| ID | Criterion | Self-check |
|---|---|---|
| AC-120.6-DD-1 | Revised contract preserves S*/V1ג€“V3/V5ג€“V7/exact-one/origin/top-doc/readiness/fail-closed/no auto-submit/readOnly behavior | **PASS** (ֲ§1) |
| AC-120.6-DD-2 | Ancestor aria-hidden not absolute reject | **PASS** (ֲ§1 V4ג€²) |
| AC-120.6-DD-3 | V8 hit-test fully specified (points, scroll, offscreen, hit relation, labels, pointer-events, transforms, race, fail-closed) | **PASS** (ֲ§2) |
| AC-120.6-DD-4 | SELF vs ANCESTOR distinct with rationale | **PASS** (ֲ§3) |
| AC-120.6-DD-5 | One shared contract across Analyze/Visual/parity/Admin Test/DH | **PASS** (ֲ§4) |
| AC-120.6-DD-6 | Three-state model preserved | **PASS** (ֲ§5) |
| AC-120.6-DD-7 | Safe subreasons + propagation; no secrets | **PASS** (ֲ§6) |
| AC-120.6-DD-8 | Fixture matrix incl. F-SELF / F-ANC-ACTIVE / F-ANC-OCCLUDED / F-CSS-HIDDEN / F-PLAIN + edges | **PASS** (ֲ§7) |
| AC-120.6-DD-9 | Regression matrix 117ג€“120.5 / DH / readiness / no submit | **PASS** (ֲ§8) |
| AC-120.6-DD-10 | No site-specific behavior; Final Acceptance OPEN; V4 binding until ship | **PASS** (ֲ§9ג€“10) |
| AC-120.6-DD-11 | No Developer handoff in this slice | **PASS** |

---

## Developer evidence requirements (ONLY after Architecture PASS + 120.6-impl auth)

_Not a handoff:_

1. Diff: V4 absolute removed; V3 kept; V8 hit-test present; classify updated.  
2. Proof no divergent ancestor reject elsewhere.  
3. Synthetic fixture results matrix (ֲ§7).  
4. Contract-parity across Analyze/Visual/parity/fill if any fallback remains.  
5. Subreason samples without secrets.  
6. Regression notes ֲ§8.  
7. Statement: no hostname/serviceId/locator one-offs; no validated stamp bypass.  
8. Build/type/test PASS.

---

## Manager Review (120.6)
MANAGER_REVIEW_STATUS: **READY_FOR_APPROVAL**

### Review Notes
Classification **B** DD: remove absolute ancestor `aria-hidden` reject; keep SELF; add fail-closed multi-point `elementFromPoint` occlusion check; shared 120.4 module remains sole authority; three-state preserved; fixtures include expectation flip F-ANC-ACTIVE. Current V4 remains runtime law until impl accepted. Final Acceptance OPEN/PENDING.

### Exact next step
**Architecture review** of this DD. **STOP.** Do **not** hand off to Developer. Do **not** implement. Do **not** mark live mapping validated.

---

# Slice 120.5  -  Detailed Design: Admin Managed Autofill Test Harness  -  HISTORICAL

## Goal
Admin-only diagnostic to exercise a **saved** Managed mapping on the real Login Entry using **temporary Admin test values**, **before or after** mapping approval  -  for visual inspection and mapping iteration.

**Not** an approval requirement. **Not** an activation gate. **Not** a Digital Home path. **Not** part of 120.4.

## Binding decisions
| ID | Decision |
|---|---|
| **D-120-12** | One Managed Autofill execution path  -  Admin Test and Digital Home share fill/safety/exact-one/readiness; only **value source** differs |
| **D-120-13** | Admin may test **saved candidate** mappings; Digital Home production eligibility/validation **unchanged** and **not** bypassed |
| **D-120-9 / D-120-11** | Named services = fixtures only; generic capability ג†’ config ג†’ Managed |
| **120.4** | Authoritative `isSafeFillTarget` / Managed `isVisible`; identification ג‰  eligibility; no weaken |

## Normative flow (ֲ§15.1)
```text
Admin Autofill Profile Editor
  ג†’ Managed mapping SAVED (candidate or validated  -  both OK)
  ג†’ Test section: one input per current credential-schema fieldId
  ג†’ Admin enters temporary test values (component/page memory only)
  ג†’ All schema fields non-empty (trimmed) ג†’ enable ֲ«׳›׳ ׳™׳¡׳” ׳׳׳×׳¨ ׳•׳׳™׳׳•׳™ ׳©׳“׳•׳×ֲ»
  ג†’ Admin click
       ג†’ Hub Admin-only gate (auth + saved mapping + complete temp values + Login Entry)
       ג†’ Build Managed payload:
            Login Entry URL + allowedOrigin
            + SAVED fieldMappings (candidate OK)
            + temporary Admin credentials (NOT vault)
       ג†’ ג˜… CONVERGENCE ג˜… same Managed execution as Digital Home:
            HUB_MANAGED_AUTOFILL
            ג†’ open Login Entry / origin / top document
            ג†’ assessManagedTargetsReady (same isSafeFillTarget)
            ג†’ runManagedAutofill / verify
            ג†’ structured result (NO auto-submit)
  ג†’ Admin UI shows structured result (NO secret values)
  ג†’ Temp values remain in UI memory (retention B) until remount/navigate/close
  ג†’ supportState / validation metadata / vault credentials UNCHANGED
```

Digital Home remains vault credentials + production eligibility ג†’ ג˜… same Managed execution ג˜….

---

## Hard stops
| Forbidden | |
|---|---|
| Fold into 120.4 / reopen 120.4 safety redesign | STOP |
| Weaken Managed safety / exact-one / origin / top-document | STOP |
| Second fill engine / `ADMIN_*_FILL` that reimplements fill | STOP |
| Test-only weaker `isSafeFillTarget` or selector interpretation | STOP |
| Make Test an approval / activate / validated stamp requirement | STOP |
| Persist temp values (DB / localStorage / sessionStorage / cookies) | STOP |
| Send temp values to Analyze/LLM / logs / telemetry | STOP |
| Partial-schema fills (button must require all fields) | STOP |
| Change Digital Home gate to allow unvalidated | STOP |
| Hostname / serviceId / site-specific Autofill | STOP |
| Developer handoff before Architecture PASS | STOP |

Final Phase 120 Acceptance remains **OPEN / PENDING**.

---

## 1. Admin-only UI  -  schema-dynamic temp inputs + button gate

| Rule | Binding |
|---|---|
| Surface | Admin Autofill Profile Editor only (Hebrew Admin UX OK) |
| Inputs | **One** editable temp field per **current** service credential-schema `fieldId` |
| Labels | Schema labels when present; identity = `fieldId` |
| No fixed vocabulary | **No** hard-coded username/password/business_id assumptions |
| Schema change | Fields re-render from current schema dynamically |
| Password-type schema fields | Masked (`type=password` or equivalent)  -  **AC-120.5-8** |
| Button label | ֲ«׳›׳ ׳™׳¡׳” ׳׳׳×׳¨ ׳•׳׳™׳׳•׳™ ׳©׳“׳•׳×ֲ» |
| Button enabled | **IFF** every schema field has **non-empty trimmed** temp value  -  **AC-120.5-3** |
| Partial fill | **Forbidden**  -  incomplete ג†’ button disabled; no Hub call |

---

## 2. Availability  -  saved mappings (candidate or validated)

| Condition | Test section |
|---|---|
| **Saved** Managed profile with persisted `fieldMappings` (structural save) + Login Entry / allowedOrigin present | **Available**  -  **does not** require `supportState === 'validated'`  -  **AC-120.5-1** |
| After approval / validated | **Still available** for diagnostics |
| No saved mapping / missing Login Entry | Unavailable / disabled |
| Digital Home | Unchanged  -  still requires production Managed eligibility  -  **AC-120.5-5** / D-120-13 |

---

## 3. Dirty-vs-saved editor UX (test uses **saved** only)

Editor may have **unsaved** locator/schema edits while a prior **saved** profile exists.

| Rule | Binding |
|---|---|
| Execution source of truth | **Last saved** `fieldMappings` + Login Entry + allowedOrigin from persisted profile (same source Admin would load after refresh) |
| Dirty draft locators | **Must not** be sent on Test click |
| UX when dirty | **Disable** Test button **or** show clear warning + require Save first  -  Manager preference: **disable Test while mappings dirty** (or while Login Entry/origin dirty), with short Hebrew/English note: test runs against **saved** mapping only |
| After Save | Re-enable when all temp values filled |
| Unsaved-only (never saved) | Test unavailable |

Do **not** silently test dirty state. Do **not** auto-save on Test.

---

## 4. Temporary value lifecycle  -  retention B (ֲ§15.4)

| Event | Behavior |
|---|---|
| Enter values | Held in **React/page component memory only** |
| After successful or failed test | Values **remain** for convenient repeat |
| Refresh / navigate away / close tab / unmount editor | Values **cleared** |
| Save mapping / activate / other persist actions | Must **not** write temp values to profile, registry, vault, or storage |
| Persistence | **None**  -  not DB, localStorage, sessionStorage, cookies  -  **AC-120.5-7** |
| LLM / Analyze | **Never** receive temp values |
| Logs / telemetry / errors | **No** temp values or vault secrets  -  fieldId / detail / locator / reason only |

---

## 5. No side effects on production state  -  **AC-120.5-6**

Test run **MUST NOT**:

| Side effect | Forbidden |
|---|---|
| `supportState` change | Yes |
| Validation / activate / `liveValidationApproved` / probe stamp | Yes |
| Vault / production credentials write | Yes |
| Field mapping mutation | Yes |
| Treat success as approval | Yes |

Managed-parity activate remains a **separate** Admin action (120.2-AP). Test is **optional diagnostic only**.

---

## 6. Convergence  -  one Managed engine (D-120-12)  -  **AC-120.5-4**

### 6.1 Shared payload shape
After construction, payload is the **same shape** Digital Home sends:

```text
{
  type: 'HUB_MANAGED_AUTOFILL',
  url,              // Login Entry
  allowedOrigin,
  fieldMappings,    // SAVED mappings only
  credentials       // temp Admin values keyed by fieldId (not vault)
}
```

Prefer: extract/reuse Hub helper (e.g. shared with `buildManagedPayload` / `executeManagedAutofill` send path) so Admin Test and Digital Home call the **same** ג€send Managed payload ג†’ await structured resultג€ function. Value source is the only intentional difference.

### 6.2 Extension path (identical)
```text
HUB_MANAGED_AUTOFILL
  ג†’ openPageAndManagedAutofill (or equivalent existing orchestrator)
  ג†’ origin check / top document
  ג†’ assessManagedTargetsReady (120.4 isSafeFillTarget)
  ג†’ runManagedAutofill / verify
  ג†’ structured result
  ג†’ NO auto-submit
```

### 6.3 Forbidden divergence
| Forbidden | |
|---|---|
| Separate test fill algorithm / selectors | STOP |
| Weaker safety / exact-one bypass | STOP |
| Test-only origin / top-document relaxation | STOP |
| New Ext message that reimplements fill | STOP |

### 6.4 Optional `executionContext`
If Hub needs `executionContext: 'admin_test'` for telemetry or concurrency keys: **extension fill/safety path must ignore it** (or omit from Ext message entirely). Safety/fill semantics must not branch on Admin vs Digital Home.

### 6.5 Concurrency
Admin Test must **not** corrupt in-flight Digital Home Managed keys. Prefer **Admin-scoped** execution key (e.g. distinct from `(serviceId, accessProfileId)` vault path  -  ֲ§15.8). Busy ג†’ fail-closed structured `busy` (or equivalent).

---

## 7. Admin-only Hub entry (D-120-13)  -  **AC-120.5-5**

| Item | Binding |
|---|---|
| Entrypoint | Distinct from Digital Home tile  -  e.g. `executeAdminManagedAutofillTest` (name free) |
| Auth | Admin-authenticated only |
| Preconditions | Saved mappings present; Login Entry + allowedOrigin; **all** schema fieldIds have non-empty temp values |
| Does **not** require | `supportState=validated` or version-matched validation evidence |
| Digital Home | Existing `serviceIsManagedAutofillEligible` / validated gate **unchanged** |

**Proof of non-weakening:** Mapping that is IDENTIFIED_BUT_MANAGED_INELIGIBLE / would fail Managed-parity still fails Admin Test the same way (`unsafe_target` etc.). Harness is **not** a workaround for unsafe targets  -  **AC-120.5-10**.

---

## 8. Structured results without secrets  -  **AC-120.5-11**

Surface generic Managed-aligned outcomes, e.g.:

| Class | Examples |
|---|---|
| Success | Fill verified OK; page left for **manual** submit |
| Not ready | `targets_not_ready` + `zero_match` / fieldId / locator |
| Multi-match | `multi_match` |
| Hidden / non-editable | `hidden_target` / `non_editable` |
| Managed-ineligible | `unsafe_target` (+ optional 120.4 sub-detail) |
| Origin / nav | `wrong_origin`, `no_tab`, load errors |
| Extension / busy | Existing Managed structured failures |

**Forbidden in UI/results:** temp values, vault values, named-site branching, AI content.

---

## 9. Fail-closed / no auto-submit  -  **AC-120.5-9**

| Case | Behavior |
|---|---|
| Incomplete temp values | Button disabled; no execution |
| No saved mapping / dirty-required-save | Tool disabled |
| Managed safety / readiness fail | Fail-closed structured result; no approve; no submit |
| Extension unavailable | Honest failure; open-without-fill only if consistent with **existing** Managed patterns  -  **no** new weaker fill |
| Success | Fields filled; **user submits manually** |

---

## 10. Preserved contracts  -  **AC-120.5-10 / AC-120.5-13**

| Contract | Preserve |
|---|---|
| Exact-one | Unchanged |
| Origin / allowedOrigin | Unchanged |
| Top document only | Unchanged |
| 120.4 `isSafeFillTarget` / Managed `isVisible` | Unchanged  -  not weakened |
| Identification ג‰  eligibility (authoring) | Unchanged  -  Test does not alter Analyze/Visual three-state; only exercises fill |
| No silent Managedג†’legacy fallback | Unchanged |
| 120.2-AP activate gate | Separate; Test does not bypass or replace |

---

## 11. Genericity  -  **AC-120.5-12**

Works from: credential schema + saved Managed mapping + Login Entry + temp values.  
New simple service/schema ג†’ **no** Managed runtime code change.  
**No** hostname / `serviceId` / site-specific Autofill branches.

---

## 12. Regression requirements (ֲ§15.10)

When 120.5-impl authorized, Developer must evidence:

| Area | Evidence |
|---|---|
| Convergence | Call-graph / shared helper: Admin Test and Digital Home both hit same Ext Managed assess/fill after payload build |
| Safety | aria-hidden / exact-one / origin / top-document unchanged vs 120.4 |
| Separation | Digital Home still rejects unvalidated; Admin Test runs on saved candidate **without** stamping validated |
| No side effects | After test: supportState, validation metadata, vault credentials unchanged |
| Temp lifecycle | No persistence; cleared on remount; password masked |
| Schema dynamic | N-field schema ג†’ N inputs; button = all filled |
| Dirty UX | Dirty mappings ג†’ Test disabled (or Save-first); saved-only payload |
| Results | Structured reasons without secrets |
| Regress | Phase 117 Managed fill; 120.2-AP activate; 120.4 eligibility |

---

## 13. Acceptance criteria mapping (AC-120.5-1ג€¦13)

| ID | Criterion | DD section |
|---|---|---|
| AC-120.5-1 | Test for saved mapping without requiring validated | ֲ§2 |
| AC-120.5-2 | Schema-dynamic temp inputs; no fixed field names | ֲ§1 |
| AC-120.5-3 | Button only when all schema fields non-empty | ֲ§1 |
| AC-120.5-4 | Same Managed path after payload (D-120-12) | ֲ§6 |
| AC-120.5-5 | Admin candidate OK; Digital Home gate unchanged (D-120-13) | ֲ§7 |
| AC-120.5-6 | No approve/activate/stamp/credential mutate | ֲ§5 |
| AC-120.5-7 | Memory-only; retention B; no storage/DB/LLM/logs | ֲ§4 |
| AC-120.5-8 | Password-type fields masked | ֲ§1 |
| AC-120.5-9 | No auto-submit | ֲ§9 |
| AC-120.5-10 | Managed safety identical | ֲ§7, ֲ§10 |
| AC-120.5-11 | Structured result without secrets | ֲ§8 |
| AC-120.5-12 | No hostname/serviceId/site Autofill | ֲ§11 |
| AC-120.5-13 | 120.4 contracts preserved | ֲ§10 |

Manager self-check: all **PASS** (specified).

---

## Out of scope (ֲ§15.12)
- Admin Test as approval/activation requirement  
- Weakening Managed or Digital Home eligibility  
- Persisting test values / partial fills  
- Second fill engine  
- Modal/pre-fill/multi-step/iframe/Shadow capabilities  
- Closing Final Phase 120 Acceptance  

---

## Developer evidence requirements (ONLY after Architecture PASS + 120.5-impl auth)

_Not a handoff:_

1. UI: schema-dynamic inputs; button gate; masked password; dirtyג†’disable Test.  
2. Shared helper / call-graph proving D-120-12 convergence.  
3. Admin entrypoint vs Digital Home gate proof (D-120-13).  
4. Side-effect check: supportState/validation/vault unchanged after test.  
5. Temp: no persistence sinks; retention B behavior.  
6. Structured result samples without secrets.  
7. Safety regression vs 120.4 (unsafe_target still fails).  
8. Build/type/test PASS.

---

## Manager Review (120.5)
MANAGER_REVIEW_STATUS: **CLOSED** (historical  -  120.5-impl ACCEPTED)

### Review Notes
Admin Test Harness. Superseded active work: see **120.6** at top of file.

### Exact next step
_(historical)_

---

# Slice 120.4  -  Detailed Design REVISED: Unify Managed Target-Safety Eligibility  -  HISTORICAL (CLOSED)

## Revision note
First DD **FAIL** (ֲ§14.4): safety-unification direction accepted; **identification ג‰  Managed eligibility** and three-state result model were missing / under-specified. This revision applies **E.1ג€“8** exactly. Prior ג€prefer omit from mappable setג€ and ג€report visible only when Managed isVisibleג€ defaults are **withdrawn**.

## Goal
Smallest **generic** correction so Analyze, Visual Mapping, Managed-parity, and Managed runtime share **ONE** Managed target-safety eligibility contract for **approvable Managed mappings**  -  **without** weakening Managed safety, and **without** erasing semantic identification when a control is correctly found but Managed-ineligible.

## Binding invariants

### I1  -  Approvable Managed mapping ג‰¡ Managed eligibility
```text
Approvable / prefilled Managed mapping
  ג‰¡ passes authoritative Managed target-safety contract
  ג‰¡ Managed-parity / Managed fill accept that target
```

### I2  -  SEMANTIC IDENTIFICATION ג‰  MANAGED ELIGIBILITY (ֲ§14.4 E.1  -  BINDING)
| Concern | Question |
|---|---|
| **SEMANTIC IDENTIFICATION** | Which page control corresponds to the credential field? |
| **MANAGED ELIGIBILITY** | Is that identified DOM target safe/eligible for deterministic Managed Autofill under the authoritative safety contract? |

A target may be: **correctly identified**; **correctly human-clicked**; **and still Managed-ineligible**.

**120.4 MUST NOT** solve the mismatch by pretending such a field was never identified.

### I3  -  Three-state result model (ֲ§14.4 E.2  -  BINDING)

Names are normative for this DD (implementation may use equivalent enums/strings if mapped 1:1 in evidence):

| State | Meaning | May become approvable/prefilled Managed mapping? |
|---|---|---|
| **NOT_IDENTIFIED** | No reliable semantic target for the credential field | **No** |
| **IDENTIFIED_AND_MANAGED_ELIGIBLE** | Identified **and** passes Managed safety (ֲ§1) | **Yes  -  only this state** |
| **IDENTIFIED_BUT_MANAGED_INELIGIBLE** | Identified; fails Managed safety | **No**  -  and **MUST NOT** collapse into **NOT_IDENTIFIED** |

Admin/UX for state #3: expose generic **identified but not eligible for Managed Autofill** (optional sub-reason). Not ג€field not found.ג€

---

## Problem (accepted  -  ֲ§13) + FAIL root cause

| Layer today | Issue |
|---|---|
| Analyze / Visual vs Managed | Different visibility predicates ג†’ authoring can emit Managed-ineligible locators |
| First DD ֲ§2/ֲ§7 | Risked **hiding** identification of ineligible controls (ג€omitג€ / Managed-only `visible`) ג†’ collapse #3 ג†’ #1 |

Owner evidence pattern: Analyze + Visual **identified** `#UserName`; Managed correctly rejected `unsafe_target`. Fix = **eligibility alignment for approvability** + **preserve identification when ineligible**.

## Hard stops
| Forbidden | |
|---|---|
| Weaken `isSafeFillTarget` / Managed `isVisible` | STOP |
| Make aria-hidden (etc.) fillable to pass a fixture | STOP |
| Collapse #3 into #1 / misreport as ג€not foundג€ | STOP |
| Prefer omit-only without parallel identified-ineligible channel | STOP |
| Force Managed `isVisible` as the only way a control can be ג€seenג€ for semantic ID | STOP |
| Silent substitute DOM target on Visual click | STOP |
| Site exceptions / fixture locator edits / parity bypass | STOP |
| Developer handoff before Architecture PASS on **this** revision | STOP |

---

## 1. Authoritative Managed Autofill target-safety contract (ֲ§14.1 #1)

**Normative source of truth = current Managed runtime** (do **not** weaken). Used for **MANAGED ELIGIBILITY** and for state #2 vs #3  -  **not** as the sole definition of ג€observed/identified.ג€

### 1.1 `isSafeFillTarget(element)`

Safe Managed fill target iff **all** of:

| # | Rule | Fail detail (parity) |
|---|---|---|
| S1 | Element exists | unsafe |
| S2 | `tagName === 'INPUT'` | `unsafe_target` |
| S3 | `type !== 'hidden'` | `hidden_target` |
| S4 | `!disabled` | `non_editable` |
| S5 | Managed `isVisible(element) === true` | else `unsafe_target` (when not hidden/disabled) |

**`readOnly` alone does NOT fail** `isSafeFillTarget`.

### 1.2 Managed `isVisible(element)`  -  reject if any of:
V1 `disabled` ֲ· V2 `type===hidden` ֲ· V3 `aria-hidden` on element ֲ· V4 ancestor `[aria-hidden=true]` ֲ· V5 `display:none`/`visibility:hidden` ֲ· V6 `getClientRects().length===0` ֲ· V7 width or height `< 2`

**Must remain non-rejects:** `opacity:0` alone; `readOnly` (for `isSafeFillTarget`).

### 1.3 Exact-one (orthogonal)
`querySelectorAll(locator).length === 1` before safety on parity/fill. **No first-match.**

---

## 1A. Observation / identification facts (separate from Managed eligibility) (ֲ§14.4 E.6)

Inspect/Hub payloads **MUST** separate:

| Signal family | Purpose | Must equal Managed `isVisible`? |
|---|---|---|
| **Observation / identification** (e.g. present in DOM, tag/type, id/name, bbox>0, human-clickable heuristics, Analyze semantic match confidence) | Answer: ג€which control is this field?ג€ | **No**  -  may observe controls that fail Managed eligibility |
| **`managedEligible`** (boolean or equivalent) | Answer: ג€safe for Managed Autofill?ג€ = `isSafeFillTarget` (shared) | **Yes**  -  **must** match Managed |

**Forbidden:** overwrite or define observation-only `visible` **solely** as Managed `isVisible` such that Managed-ineligible-but-present controls disappear from identification channels.

Legacy inspect `visible` may be retained as **observation** (or renamed) **plus** an explicit **`managedEligible`** flag derived from shared `isSafeFillTarget`. Hub must key Managed approvability on **`managedEligible`**, not on observation alone.

---

## 2. Three-state mapping for Analyze (ֲ§14.1 #2 + ֲ§14.4 E.3ג€“E.4)

| Analyze outcome | State | Hub / Admin behavior |
|---|---|---|
| No reliable semantic candidate | **NOT_IDENTIFIED** | Do not invent mapping; honest ג€not identified / not foundג€ **only here** |
| Semantic candidate + `managedEligible === true` | **IDENTIFIED_AND_MANAGED_ELIGIBLE** | May HIGH / prefill / accept as Managed mapping (subject to existing confidence rules) |
| Semantic candidate + `managedEligible === false` | **IDENTIFIED_BUT_MANAGED_INELIGIBLE** | **Preserve** identification (candidate + locator evidence + generic reason); **do not** approvable/prefill Managed mapping; **do not** report as NOT_IDENTIFIED / ג€field not foundג€ |

**Withdrawn:** ג€Prefer: omit from mappable set entirelyג€ as default that hides #3.  
**Allowed:** Omit from **approvable/prefill** set **while** retaining a parallel **identified-ineligible** result channel (required).

Page inspect: emit observation facts **and** `managedEligible` per control (ֲ§1A). Do **not** filter out Managed-ineligible inputs from the identification surface solely because `managedEligible` is false.

---

## 3. Visual Mapping (ֲ§14.1 #3 + ֲ§14.4 E.5)

| Step | Behavior |
|---|---|
| Human clicks a real control | Selection is **recognized** (identification occurred) |
| Evaluate `managedEligible` via shared `isSafeFillTarget` | After click |
| If **eligible** + exact-one locator | Success ג†’ approvable mapping (state #2) |
| If **ineligible** | State #3: **Managed eligibility failure**  -  clear generic reason (`managed_ineligible` + optional sub-detail); **no** approvable mapping; **no** silent substitute; **not** framed as ג€target not foundג€ / NOT_IDENTIFIED |
| TEXTAREA / non-INPUT | Ineligible for Managed (#3 or equivalent); no approvable Managed mapping |
| `readOnly` | Per Managed: does not alone fail `isSafeFillTarget` |
| Opacity-only | Do not apply Visual-only opacity reject for **Managed eligibility**; do not weaken Managed |

Click capture still prevents default / no submit.

---

## 4. Managed-parity and runtime (ֲ§14.1 #4)

Unchanged reference: `assessManagedTargetsReady` / fill use same `isSafeFillTarget`. **Do not** relax S1ג€“S5 / V1ג€“V7. Extraction allowed only if bit-equivalent.

Parity continues to fail closed on ineligible targets (`unsafe_target` etc.). Agreement with authoring = **same eligibility decision**, not erasing Analyze/Visual identification.

---

## 5. Shared module vs equivalent + contract-parity tests (ֲ§14.1 #5 + ֲ§14.4 E.8)

| Option | Description | Gate |
|---|---|---|
| **A (preferred)** | One reusable Managed eligibility API used by fill-executor, form-detector/`isVisible`, page-structure-inspect (`managedEligible`), visual-target-pick | Single module evidence |
| **B (acceptable)** | Authoring calls existing `GenericFillExecutor.isSafeFillTarget` / `GenericFormDetector.isVisible` with proven load order  -  **no drifted copy** | **Mandatory contract-parity tests** (ֲ§5B) |
| **C (forbidden)** | Copy-paste similar visibility | Forbidden |

### 5B. Mandatory if not single shared module
Automated (or harness) tests proving **identical Managed eligibility decisions** across Analyze (`managedEligible`), Visual (post-click), parity (`assessManagedTargetsReady`), and runtime fill for the **synthetic matrix** (ֲ§13ג€“14), including Fixture A (ineligible) and Fixture C (eligible).

Hub `safetyValidation`: approvability gated on **`managedEligible`** (or equivalent), not observation-only flags.

---

## 6. Click-ineligible behavior (ֲ§14.1 #6)  -  refined

| Rule | Binding |
|---|---|
| Recognize click / selection | **Yes** (identification) |
| Approvable mapping | **No** |
| Reason class | **Managed eligibility failure**  -  not ג€not foundג€ |
| Silent substitute | **Forbidden** |
| Clear generic reason | Required; optional sub-detail; no secrets |

---

## 7. Analyze approvability (ֲ§14.1 #7)  -  refined

| Rule | Binding |
|---|---|
| State #3 | Preserve identification; expose ג€identified but not eligible for Managed Autofillג€ |
| Prefill / HIGH accept as Managed mapping | **Only** state #2 |
| Misreport #3 as not found | **Forbidden** |
| Parity still fail-closed if bad mapping somehow saved | Unchanged backstop  -  authoring must still emit honest #3 |

---

## 8ג€“12. Fail-closed / exact-one / no auto-submit / security / no site exceptions

| # | Preserve |
|---|---|
| 8 | Fail-closed: no validated stamp without parity PASS; no silent Managedג†’legacy |
| 9 | Exact-one for accepted Managed locators; no first-match |
| 10 | No auto-submit |
| 11 | Top document; allowedOrigin; no secrets in diagnostics |
| 12 | No hostname/`serviceId`/fixture exceptions |

---

## 13. Regression matrix (ֲ§14.1 #13 + ֲ§14.4 E.7)

| ID | Case | Identification | `managedEligible` / approvability | Parity |
|---|---|---|---|---|
| R1 | Normal safe INPUT | Identified | #2 eligible ג†’ may map | Ready |
| R2 | aria-hidden on input | Identified if semantically matched / clicked | #3 ineligible; **not** NOT_IDENTIFIED | `unsafe_target` |
| R3 | aria-hidden ancestor | Same as R2 | #3 | `unsafe_target` |
| R4 | display/visibility none | Per observation rules; may be not observed | If identified ג†’ #3; else #1 | Reject |
| R5 | zero client rects | If identified ג†’ #3 | Ineligible | Reject |
| R6 | sub-2px | If identified ג†’ #3 | Ineligible | Reject |
| R7 | type=hidden | Typically not semantic ID | If ID ג†’ #3 | `hidden_target` |
| R8 | disabled | If ID ג†’ #3 | Ineligible | `non_editable` |
| R9 | readOnly safe INPUT | Identified | #2 (Managed allows) | Accept safety |
| R10 | Delayed then safe | When appears: #2 | Eligible when safe | Existing readiness |
| R11ג€“R14 | 117 fill / 118 Analyze / 119 Visual / 120.2-AP | Contracts intact; Analyze/Visual three-state; parity gate no bypass |  -  | Intact |

**opacity:0 alone:** must not newly reject under Managed eligibility.

---

## 14. Synthetic reproduction (ֲ§14.1 #14 + ֲ§14.4 E.7)

### Fixture A  -  aria-hidden ancestor (canonical)
```html
<div aria-hidden="true">
  <input id="UserName" type="text" style="width:120px;height:24px" />
</div>
```

| Step | Expected **after** revised 120.4 |
|---|---|
| Analyze | **IDENTIFIED_BUT_MANAGED_INELIGIBLE** (or equivalent) for the username field  -  identification **preserved**; **not** NOT_IDENTIFIED; **not** approvable/prefill |
| Visual click on `#UserName` | Eligibility **reject after click**; reason = Managed ineligible; **not** ג€not foundג€; no substitute; no mapping success |
| Managed-parity | Still `unsafe_target` |
| Agreement | Same **eligibility** decision across Analyze/Visual/parity  -  identification **not** erased |

### Fixture B  -  sub-2px
If semantically identified or clicked ג†’ state #3; parity reject; agree on eligibility.

### Fixture C  -  normal safe INPUT
State #2; approvable; parity ready.

**PASS:** A asserts state **#3**; B/C as above; no named live site required.

---

## 15. Optional `unsafe_target` sub-detail (ֲ§14.1 #15)

Optional `aria_hidden` / `zero_rects` / `too_small` / `not_input`  -  no secrets; omit if scope bloat. Does not replace three-state model.

---

## Out of scope
Weaken safety ֲ· fixture locator edits ֲ· modal/pre-fill/multi-step/iframe/Shadow ֲ· legacy generic/medium ֲ· 120.FSC ֲ· Health Monitoring ֲ· Final Acceptance Matrix (**OPEN / PENDING**)

---

## Acceptance criteria  -  revised DD (AC-120.4-DD-*)

| ID | Criterion | Self-check |
|---|---|---|
| AC-120.4-DD-1 | Authoritative Managed safety not weakened | **PASS** (ֲ§1) |
| AC-120.4-DD-I2 | SEMANTIC IDENTIFICATION ג‰  MANAGED ELIGIBILITY recorded | **PASS** (I2 / E.1) |
| AC-120.4-DD-I3 | Three-state model; #3 ג†› #1 | **PASS** (I3 / E.2) |
| AC-120.4-DD-2 | Analyze preserves #3; no approvable/prefill; no ג€not foundג€ | **PASS** (ֲ§2 / E.3ג€“4) |
| AC-120.4-DD-3 | Visual: eligibility reject after click; not ג€not foundג€ | **PASS** (ֲ§3 / E.5) |
| AC-120.4-DD-1A | Observation separated from `managedEligible` | **PASS** (ֲ§1A / E.6) |
| AC-120.4-DD-4 | Parity/runtime same Managed contract | **PASS** (ֲ§4) |
| AC-120.4-DD-5 | Shared module preferred; parity tests if not single module | **PASS** (ֲ§5 / E.8) |
| AC-120.4-DD-6ג€“12 | Fail-closed / exact-one / no submit / security / no site exceptions | **PASS** (ֲ§6ג€“12) |
| AC-120.4-DD-13 | Regression includes #3 preservation | **PASS** (ֲ§13) |
| AC-120.4-DD-14 | Fixture A asserts IDENTIFIED_BUT_MANAGED_INELIGIBLE | **PASS** (ֲ§14) |
| AC-120.4-DD-15 | Optional sub-detail bounded | **PASS** (ֲ§15) |
| AC-120.4-DD-16 | No Developer handoff; Final Acceptance OPEN/PENDING | **PASS** |

### ֲ§14.4 E corrections checklist
| E# | Addressed in |
|---|---|
| E.1 | I2 |
| E.2 | I3 |
| E.3 | ֲ§2, ֲ§7 |
| E.4 | ֲ§2 (omit-default withdrawn) |
| E.5 | ֲ§3, ֲ§6 |
| E.6 | ֲ§1A |
| E.7 | ֲ§13ג€“14 Fixture A |
| E.8 | ֲ§5 / 5B |

---

## Developer evidence requirements (ONLY after Architecture PASS + 120.4-impl auth)

_Not a handoff:_

1. Shared module **or** contract-parity tests (ֲ§5B) across Analyze/Visual/parity/runtime.  
2. Proof Managed reject set unchanged.  
3. Payload/schema showing observation ג‰  `managedEligible`; three states exercised.  
4. Fixture A ג†’ state #3 Analyze; Visual eligibility reject; parity `unsafe_target`.  
5. R1ג€“R14 + no site exceptions / no weaken / no parity bypass.  
6. Build/type/test PASS.

---

## Manager Review (120.4 revised)
MANAGER_REVIEW_STATUS: **CLOSED** (historical  -  120.4-impl ACCEPTED)

### Review Notes
Identification ג‰  eligibility three-state model. Superseded active work: see **120.5** at top of file.

### Exact next step
_(historical)_

---

# Slice 120.3.6  -  Detailed Design: Dedicated Site-Adapter Legacy Debt Removal  -  HISTORICAL

## Goal
Remove **dedicated site-adapter legacy debt** (ֲ§11.3 A) from production reachability **without** replacing it with another site-specific path and **without** implementing any new generic capability.

Binding architecture (D-120-11 / ֲ§12):
```text
Supported:  generic capability ג†’ configuration ג†’ validation ג†’ generic Managed runtime
Unsupported capability: ג†’ explicit unsupported / open-only
Never: website/service identity ג†’ dedicated production Autofill implementation
```

Named services remain **fixtures only** (D-120-9). Inventory labels below (e.g. historical dedicated-adapter seed) are **not** product requirements to preserve Autofill.

This slice is **DD only**. Implementation is **NOT AUTHORIZED** until Architecture PASS + explicit 120.3.6-impl authorization.

## Hard stops
| Forbidden | |
|---|---|
| Developer implementation before Architecture ACCEPT of this DD | STOP |
| Replacement dedicated adapter / hostname / serviceId Autofill | STOP |
| Making Managed imitate the retired dedicated-adapter site | STOP |
| Adding configuration solely to preserve that named fixture | STOP |
| Implementing pre-fill / modal / multi-step / iframe / Shadow DOM | STOP |
| Changing Managed contracts (exactly-one, activate, no auto-submit, no silent generic) | STOP |
| Retiring legacy generic / medium / LI complex | STOP |
| Health monitoring / 120.FSC / final 120.3.3 representative validation | STOP |
| Practice adapter retirement (default) | STOP  -  leave untouched unless exclusive-ownership proven **and** Owner expands scope |

---

## Evidence packaging (AC-120.3.6-DD-14)  -  TWO labeled packages

Implementation (when later authorized) **MUST** produce **separately reviewable** evidence:

| Package | Name | Nature | May change production Digital Home fill routing? |
|---|---|---|---|
| **A** | Dead / POC exclusive hygiene | Delete unreachable dead map entries and/or DEV-only helpers **proven exclusively** owned by the retired dedicated path | **No** (or only DEV POC UI) |
| **B** | Behavior-changing production retirement | Remove dedicated adapter routing + Hub adapter + Ext `POC_FILL_IL` path + dedicated script + hostname gate + clear catalog `adapterId` for that seed | **Yes**  -  intentional |

Do **not** mix Package A and Package B into a single undifferentiated ג€deleted stuffג€ claim. Commit/PR evidence, `dev-phase120.md` sections, and AC checklists must label **A** vs **B**.

---

## 1. Artifact trace  -  every code artifact planned for removal (ֲ§12.1 #1)

### 1.1 Package B  -  production dedicated-adapter stack (behavior-changing)

| # | Artifact | Location | Planned action |
|---|---|---|---|
| B1 | Hub adapter module | `src/execution/adapters/htzoneAdapter.ts` | **Delete file** |
| B2 | Registry registration `htzone` | `src/execution/adapters/registry.ts` | Remove `htzone` import, `ADAPTERS.htzone`, and `'htzone'` from `SITE_SPECIFIC_ADAPTER_IDS`  -  **keep `practice`** |
| B3 | Catalog routing metadata | `src/catalog/builtinCatalog.ts` (seed with `adapterId: 'htzone'`) | Clear to **no adapter** (`adapterId` omitted or `""` ג‰¡ none  -  same convention as other non-adapter seeds). **Do not** author Managed config solely to preserve the named fixture |
| B4 | Support-level special-case branch | `src/loginAssistance/supportLevel.ts` (`adapterId === 'htzone'`) | Remove **`htzone`** arm only  -  **keep `practice`** |
| B5 | Ext message handler `POC_FILL_IL` | `extension/background.js` | Remove message branch + call into dedicated open/fill |
| B6 | Hostname/path gate | `extension/background.js`  -  `isHtzoneLoginUrl` | **Delete** function and all callers |
| B7 | Dedicated open+fill orchestration | `extension/background.js`  -  `openHtzonePageAndFill`, inject/`runHtzoneAdapterFill` (and exclusive helpers) | **Delete** |
| B8 | Hard-coded mocks/timing | `extension/background.js`  -  `MOCK_HTZONE_CREDENTIALS`, `HTZONE_RETRY_DELAYS_MS`, `HTZONE_LOGIN_PATH` (if exclusive) | **Delete** |
| B9 | `getPageConfig` htzone branch | `extension/background.js`  -  `if (isHtzoneLoginUrlג€¦)` returning `{ id: 'htzone-login' }` | **Delete** branch (function may remain for other PAGE_CONFIGS) |
| B10 | Dedicated site script | `extension/htzone-adapter.js` | **Delete file**; remove from any inject `files: ['htzone-adapter.js']` |
| B11 | Named host_permissions (optional cleanup) | `extension/manifest.json`  -  `https://www.htzone.co.il/*`, `https://htzone.co.il/*` | **Remove** if no remaining exclusive need; broader `https://*/*` (if present) **must not** be removed as ג€htzone cleanupג€ |
| B12 | Orchestrator comments / docs that assert htzone site-adapter exclusivity | `src/execution/serviceExecution.ts` comments; migration docs **touched only if required for accuracy** | Update comments to reflect practice-only (or empty) site-adapter set  -  **no logic rewrite beyond registry effect** |

**Not a separate new file delete:** `serviceExecution.ts` adapter-first branch stays  -  it continues to dispatch **registered** site adapters only (`practice` remains). After B2, `adapterId=htzone` is no longer site-specific / registered ג†’ falls through tree (ֲ§4).

### 1.2 Package A  -  dead / POC exclusive hygiene (non-behavior-changing or DEV-only)

| # | Artifact | Location | Planned action | Exclusive? |
|---|---|---|---|---|
| A1 | Empty legacy adapter map | `src/service/legacyCatalogMap.ts`  -  `LEGACY_ADAPTER_ID_BY_SERVICE_ID = {}` | Remove dead constant **and** simplify lookup to `service.adapterId` only **if** no other callers depend on the map symbol; else leave map empty (weaker). Prefer delete dead `{}` map + fallback expression | **DEAD**  -  empty, unreachable |
| A2 | POC direct `POC_FILL_IL` helper | `src/pocAutofill.ts`  -  `openIsraeliSiteAutofillTest`, `POC_IL_SITE_URL`, `HTZONE_SERVICE_ID` (if unused after), imports of `htzoneAdapter`, any `htzoneAdapter.execute` wrapper | **Delete HTZone-only exports/helpers**; **retain** practice / Shufersal / Clalit / generic POC helpers | **Yes** for HTZone-named helpers |
| A3 | POC UI bindings that call A2 only | DEV dashboard / components wiring `openIsraeliSiteAutofillTest` | Remove buttons/handlers **only** if exclusive to HTZone POC | Prove exclusive before delete |

### 1.3 Explicitly **not** in removal set (default)

| Artifact | Why |
|---|---|
| `practiceAdapter.ts` / `POC_FILL_DEMO` / practice registry entry | **Out of scope**  -  leave untouched (ֲ§12 Practice note) |
| Managed Autofill / `validated-autofill.js` / activate gate | TARGET  -  protect |
| `POC_GENERIC_FILL` / medium / LI complex | Out of scope |
| Shared `extensionBridge`, `openUrlInNewTab`, fill executors | Shared  -  protect |
| Historical team-Yuri / docs mentioning HTZone as inventory | Docs may lag; **not** required deletes for slice PASS  -  update only if Developer touches for comment accuracy |

---

## 2. Exclusive-ownership proof (ֲ§12.1 #2)

| Artifact | Ownership proof (repository) | Delete? |
|---|---|---|
| `htzoneAdapter.ts` | Sole Hub producer of `POC_FILL_IL` for Digital Home; only registered as `htzone` | **Yes (B)** |
| `POC_FILL_IL` handler + `openHtzonePageAndFill` + inject `htzone-adapter.js` | Only message type / inject path for that script; practice uses `POC_FILL_DEMO` | **Yes (B)** |
| `htzone-adapter.js` | Injected only from HTZone Ext path; defines `__israeliVaultHtzoneFill` | **Yes (B)** |
| `isHtzoneLoginUrl` / MOCK_HTZONE / HTZONE_RETRY | Callers only within HTZone Ext path + `getPageConfig` htzone branch | **Yes (B)** |
| Catalog `adapterId: 'htzone'` | Routing metadata for dedicated path; clearing does not delete the service row | **Clear routing (B)**  -  not ג€delete serviceג€ |
| `supportLevel` `htzone` arm | Shared function with `practice`; remove **htzone** condition only | **Partial edit (B)** |
| `registry.ts` | Shared with practice; remove htzone entries only | **Partial edit (B)** |
| `pocAutofill` HTZone helpers | Call `POC_FILL_IL` / `htzoneAdapter` exclusively | **Yes (A)** if proven no non-HTZone reuse |
| `LEGACY_ADAPTER_ID_BY_SERVICE_ID` | Empty `{}`; lookup never resolves | **Yes (A)** preferred |
| `POC_FILL_DEMO` / practice adapter | **Not exclusive** to dedicated site-adapter debt under retirement | **No** |
| Managed / generic / medium paths | Shared production | **No** |
| Manifest `https://*/*` (if present) | Shared | **No** |
| Named `htzone.co.il` host_permissions | Exclusive to former dedicated hosts | **Yes optional (B)** after search shows no other need |

**Rule:** If exclusive ownership is **uncertain**, classify as **shared ג†’ protect** and do **not** delete. Escalate in Developer evidence; do not guess.

---

## 3. Shared code that MUST NOT be removed (ֲ§12.1 #3)

| Protect | Rationale |
|---|---|
| Managed Autofill path (`executeManagedAutofill`, Ext Managed messages, `assessManagedTargetsReady`, fill executor) | TARGET contracts 117/118/119/120.2 |
| Managed-parity activate / Admin authoring | TARGET |
| `executeServiceFromTile` overall structure (Managed ג†’ LI ג†’ generic ג†’ open-only) | Shared orchestrator |
| `practiceAdapter` + `POC_FILL_DEMO` + practice registry membership | Out of scope DEV path |
| Legacy generic `POC_GENERIC_FILL` / `shouldAttemptGenericAutofill` | Not this slice |
| Medium assist + allowlist | Not this slice |
| LI complex ג†’ open-only | Operational unsupported |
| `extensionBridge` / tab open helpers / generic detect-fill shared utilities | Shared |
| Broad host permissions / non-htzone PAGE_CONFIGS | Shared |
| Shufersal Managed fixture config (120.2) | Regression baseline  -  do not touch to ג€helpג€ retirement |

---

## 4. Target `executeServiceFromTile` decision tree after removal (ֲ§12.1 #4)

```text
Digital Home / executeServiceFromTile(service, credential, loginFields)
  openUrl := loginUrl ?? primaryUrl

  1. IF adapterId גˆˆ {practice} AND adapter registered:   // htzone REMOVED from set
       ג†’ practiceAdapter.execute(...)  ג†’ STOP
       (Managed / LI / generic NEVER reached for practice tile)

  2. IF Managed claim OR validated profile OR eligible:
       IF !credential ג†’ open Managed Login Entry; STOP
       IF !eligible ג†’ open + MSG_MANAGED_NOT_READY; STOP
       ג†’ executeManagedAutofill (...)
       ג†’ on fail: open_only + message; STOP
       ג†’ NEVER executeGenericAutofill on Managed path

  3. Resolve Login Intelligence complexity

  4. IF complexity === 'complex':
       ג†’ open + website_not_supported; STOP

  5. IF complexity === 'medium':
       ג†’ executeMediumAssist (...); STOP

  6. IF shouldAttemptGenericAutofill AND (basic|unknown):
       ג†’ executeGenericAutofill (POC_GENERIC_FILL); STOP

  7. ELSE open_only / credentials_missing
```

**Delta vs pre-slice:** Step 1 no longer recognizes dedicated production site adapter `htzone`. A catalog row that formerly had `adapterId=htzone` (after B3 clear) enters steps 2ג€“7 like any non-adapter service.

**Forbidden delta:** No new hostname/`serviceId` branch; no new adapter; no Managed special-case for the former seed.

---

## 5. Ban on replacement site-specific Autofill (ֲ§12.1 #5)

**FORBIDDEN** in this slice (design + future impl):

1. New adapter, Ext message type, or site script for the retired identity.  
2. Hostname / `serviceId` / named-site selector tables in production runtime.  
3. ג€Temporaryג€ special fill to keep a fixture working.  
4. Managed code paths that detect the retired site and change behavior.  
5. Config authored **solely** to preserve that named fixtureג€™s unsupported experience (D-120-9 / ֲ§10.8 / ֲ§12 out of scope).  
6. Implementing pre-fill / modal activation (or any ֲ§11.1 unsupported capability) as part of 120.3.6.

**ALLOWED:** Clearing `adapterId`; deleting exclusive debt artifacts; normal fall-through (ֲ§6); comment/doc accuracy; Package A dead/POC hygiene.

---

## 6. Behavior when former dedicated-adapter service is not Managed-representable (ֲ§12.1 #6)

Per ֲ§10.4 / ֲ§10.5 / ֲ§10.8: experience needed **pre-fill login-surface activation**  -  **UNSUPPORTED** generically today. Phase 120 must **not** implement that capability to preserve the fixture.

**Normative post-retirement behavior** for a catalog service that formerly used the dedicated adapter:

| Condition | Required behavior |
|---|---|
| `adapterId` cleared; **not** Managed-eligible / not validated | Fall through existing tree: LI / legacy generic (if eligible) / **open-only**  -  **no** dedicated fill |
| Managed-eligible + validated mappings that **fail** readiness (e.g. zero_match / hidden until popup) | Managed **fail-closed** ג†’ open-only + message; **never** silent `POC_GENERIC_FILL`; **never** resurrect dedicated path |
| Operator expectation of former site-specific Autofill | **Explicit unsupported** for that experience class  -  acceptable product state (D-120-11) |
| Silent special behavior keyed to former hostname/serviceId | **FORBIDDEN** |

Manager does **not** require Admin to migrate that fixture onto Managed in this slice. If someone later authors Managed config and activate passes, that is normal generic config  -  not a 120.3.6 deliverable.

---

## 7. Fail-closed / unsupported (ֲ§12.1 #7)

| Requirement | Binding |
|---|---|
| Prefer open-only / explicit unsupported messaging over incorrect fill | **Yes** |
| Surface readiness failures with fieldId/detail/locator when on Managed path | Unchanged Managed contract |
| Do not invent success when dedicated path is gone | **Yes** |
| LI complex / open-only remain valid unsupported signaling | Unchanged; out of deletion scope |

---

## 8. No auto-submit (ֲ§12.1 #8)

| Path | Requirement |
|---|---|
| Managed | Remains **no auto-submit** |
| Practice (retained) | Remains no auto-submit (existing) |
| Retired dedicated path | Deleted  -  no replacement that auto-submits |
| Legacy generic / medium | Unchanged; out of scope  -  must not gain auto-submit via this slice |

---

## 9. No silent Managedג†’legacy fallback (ֲ§12.1 #9)

Unchanged and **non-negotiable**:

- When Managed path is selected (claim/validated/eligible), failure ג†’ open-only + message.  
- **Never** `executeGenericAutofill` / `POC_GENERIC_FILL` as silent compatibility after Managed selection.  
- Removing the dedicated adapter must **not** introduce a new silent bridge from ג€former adapter serviceג€ into generic by special-case; only the **normal** tree after adapter miss applies.

---

## 10. Regression coverage  -  Phase 117 / 118 / 119 / 120.2 (ֲ§12.1 #10)

When implementation is authorized, Developer **must** evidence:

| Area | Evidence |
|---|---|
| Managed exactly-one / fail-closed / no first-match | Existing unit/integration or documented probe; no regressions in readiness |
| Managed-parity activate before `validated` | Activate path still requires probe evidence (120.2-AP) |
| No auto-submit | Unchanged |
| No silent Managedג†’generic | Code review of `serviceExecution` Managed branch + test if present |
| Shufersal (or current Managed fixture) path | Still routes Managed when validated  -  **not** adapter, **not** broken by registry edit |
| Practice DEV path (if still in build) | Still works via `practice` adapter / `POC_FILL_DEMO` |
| Orchestrator tree | Matches ֲ§4 (practice-only site-adapter set) |
| No new hostname/serviceId Autofill | Repo search (ֲ§13) |

**Live Owner UAT of the retired named fixture Autofill is NOT required** for slice PASS (fixture Autofill not a product requirement). Do **not** block on ג€HTZone still autofills.ג€

---

## 11. Build / type / test requirements (ֲ§12.1 #11)

| Gate | Requirement |
|---|---|
| Typecheck | Project `tsc` / existing typecheck script **PASS** after removals (no dangling imports of `htzoneAdapter` / deleted symbols) |
| Unit / existing tests | Existing test suite **PASS**; update/remove tests that asserted dedicated `htzone` adapter path only  -  do **not** add tests that reintroduce site-specific Autofill |
| Lint | Existing lint **PASS** if part of repo gate |
| Extension pack | Manifest valid; deleted `htzone-adapter.js` not referenced |
| Manual smoke (Developer) | Digital Home: Managed fixture still fills; practice (DEV) still OK; former dedicated seed opens without dedicated fill / no crash |

---

## 12. Rollback criteria (ֲ§12.1 #12)

| Trigger | Action |
|---|---|
| Typecheck/tests fail due to incomplete deletion | Fix forward preferred; if blocked, revert Package **B** commit(s) as a unit |
| Production Digital Home Managed regression | **Rollback Package B** immediately; Package A (dead/POC) may remain if independent |
| Accidental deletion of shared/practice/Managed code | Restore from git; re-do with exclusive-ownership checklist |
| Discovery that an artifact was **not** exclusive | Restore artifact; reclassify as shared; do not force-delete |

Rollback must restore **fail-closed** behavior and must **not** ship a half-removed dedicated path that still partially hostname-gates.

**Package ordering recommendation (impl):** land **A** first (or clearly separable commits), then **B**, so rollback of B does not require re-adding dead map noise.

---

## 13. Post-impl repository search evidence plan (ֲ§12.1 #13)

After Package B (and A as applicable), Developer must attach search evidence (tool output in `dev-phase120.md`) proving **no remaining reachable callers** for retired symbols:

| Search | Expectation after PASS |
|---|---|
| `POC_FILL_IL` | **Zero** production Hub/Ext callers (docs/historical team-Yuri mentions OK if labeled non-runtime; prefer zero in `src/` + `extension/`) |
| `htzone-adapter` / `htzone-adapter.js` | **Zero** inject/references in `extension/` |
| `openHtzonePageAndFill` / `isHtzoneLoginUrl` / `runHtzoneAdapterFill` / `__israeliVaultHtzoneFill` | **Zero** |
| `htzoneAdapter` / `from './htzoneAdapter'` / `adapters/htzoneAdapter` | **Zero** in `src/` |
| `MOCK_HTZONE` / `HTZONE_RETRY` | **Zero** in `extension/` |
| `adapterId: 'htzone'` / `adapterId: "htzone"` in catalog seeds | **Zero** (cleared) |
| `SITE_SPECIFIC_ADAPTER_IDS` | Contains **`practice` only** (or empty if practice later removed  -  **not** this slice) |
| New hostname Autofill for retired hosts | **Zero** new matches |

Any hit in production runtime paths = **FAIL** until removed or justified as non-reachable comment-only (Manager rejects comment-only excuses for executable code).

---

## 14. Separation of dead/POC vs behavior-changing retirement (ֲ§12.1 #14)

Restated for enforceability:

| | Package A | Package B |
|---|---|---|
| Purpose | Dead map + exclusive POC HTZone helpers | Remove production dedicated adapter stack |
| Digital Home tile routing change | No | **Yes** |
| Evidence | Diff + search: dead map gone; POC helpers gone; practice/Managed untouched | Diff + tree ֲ§4 + search ֲ§13 + regression ֲ§10ג€“11 |
| Rollback independence | Prefer yes | Must be revertible as a unit |

---

## Acceptance criteria  -  DD (AC-120.3.6-DD-*)

| ID | ֲ§12.1 # | Criterion | Manager self-check |
|---|---|---|---|
| AC-120.3.6-DD-1 | 1 | Full artifact trace Hub+Ext+catalog+POC | **PASS** (ֲ§1) |
| AC-120.3.6-DD-2 | 2 | Exclusive-ownership proof / shared protect | **PASS** (ֲ§2ג€“3) |
| AC-120.3.6-DD-3 | 3 | Shared code protect list | **PASS** (ֲ§3) |
| AC-120.3.6-DD-4 | 4 | Target executeServiceFromTile tree | **PASS** (ֲ§4) |
| AC-120.3.6-DD-5 | 5 | No replacement hostname/serviceId/site Autofill | **PASS** (ֲ§5) |
| AC-120.3.6-DD-6 | 6 | Non-representable former adapter ג†’ no silent special behavior | **PASS** (ֲ§6) |
| AC-120.3.6-DD-7 | 7 | Fail-closed / unsupported | **PASS** (ֲ§7) |
| AC-120.3.6-DD-8 | 8 | No auto-submit | **PASS** (ֲ§8) |
| AC-120.3.6-DD-9 | 9 | No silent Managedג†’legacy fallback | **PASS** (ֲ§9) |
| AC-120.3.6-DD-10 | 10 | Regression 117/118/119/120.2 | **PASS** (ֲ§10) |
| AC-120.3.6-DD-11 | 11 | Build/type/test | **PASS** (ֲ§11) |
| AC-120.3.6-DD-12 | 12 | Rollback | **PASS** (ֲ§12) |
| AC-120.3.6-DD-13 | 13 | Repo search evidence plan | **PASS** (ֲ§13) |
| AC-120.3.6-DD-14 | 14 | Separate A vs B evidence packages | **PASS** (Evidence packaging + ֲ§14) |
| AC-120.3.6-DD-15 |  -  | No Developer handoff; practice default untouched; no new capabilities | **PASS** |

---

## Developer evidence requirements (ONLY after Architecture PASS + 120.3.6-impl auth)

_Not a handoff  -  checklist for when authorized:_

1. Package **A** evidence (labeled).  
2. Package **B** evidence (labeled).  
3. ֲ§13 search outputs.  
4. ֲ§11 build/type/test PASS.  
5. ֲ§10 regression notes.  
6. Explicit statement: no replacement adapter/capability; no Managed imitation; no fixture-preserving config added.

---

## Manager Review (120.3.6)
MANAGER_REVIEW_STATUS: **CLOSED** (historical  -  see arch-phase120.md)

### Review Notes
Dedicated site-adapter debt-removal DD. Superseded active work: see **120.4** at top of file.

### Exact next step
_(historical)_

---

# Slice 120.3.1  -  Disposition Detailed Design: Enforceable Runtime Convergence Plan  -  HISTORICAL (ACCEPTED)

## Goal
Convert **accepted** ֲ§9 investigation into an **enforceable** convergence plan: which production Autofill mechanisms are intended for retirement, what remains temporarily (with generic capability rationale), exact evidence gates before each retirement, representative validation strategy (D-120-10), regression, rollback/fail-closed, and an explicit ban on service-specific replacement logic.

This slice is **DD only**. It does **not** authorize code, adapter removal, service migration, or 120.FSC.

## Normative target (from ֲ§9  -  binding intent)
Production Autofill for supported **simple** logins is **configuration-driven**: same Managed Autofill runtime regardless of service identity. A service is defined by **configuration/data**, not by production runtime code that knows service name, service ID, hostname, or site-specific selectors.

```text
Digital Home ג†’ Managed Autofill ג†’ validated config ג†’ Login Entry ג†’ mappings
  ג†’ deterministic resolve ג†’ deterministic fill ג†’ manual user submit
```

Analyze / Visual Mapping = **authoring only**. Production Managed must not know which authoring path produced the config.

## Hard stops (this DD and all 120.3.x until separately authorized)
| Forbidden now | |
|---|---|
| Developer implementation / production code | STOP |
| Adapter removal (HTZone, practice, or any) | STOP |
| Service migration / catalog bulk rewrite | STOP |
| Starting **120.FSC** | STOP |
| Assuming Phase 120 must implement multi-step Managed | STOP |
| HTZone-specific replacement design | STOP  -  capability equivalence question only (120.3.4) |
| Silent Managedג†’legacy generic fallback | STOP |
| First-match / weaken exactly-one / hostnameֲ·serviceId product branches | STOP |
| Expanding medium host allowlists as architecture | STOP |

**Named services = validation fixtures only (D-120-9).** Any name below is a **fixture or inventory label**, not a product requirement.

---

## 1. Retirement intent  -  production mechanisms

### 1.1 Intended for retirement (eventually  -  Owner-gated; not in 120.3.1)

| Mechanism | Class | Retirement target sub-slice | Notes |
|---|---|---|---|
| **Legacy generic Autofill** (`POC_GENERIC_FILL` / `executeGenericAutofill` after adapters+Managed miss) | **MIGRATION CANDIDATE** | **120.3.6** (conditional) | Retire only when reachable dependents are identified and each is **Managed-represented** or an **approved exception** |
| **Unnecessary service-specific fill paths** that Managed can already express (config-only) | **MIGRATION CANDIDATE** | Proven via **120.3.3** then Owner-gated cleanup | Convergence = eliminate dependency on legacy mechanisms via **sufficient representative evidence** (D-120-10), not exhaustive catalog migration |
| **Empty `LEGACY_ADAPTER_ID_BY_SERVICE_ID`** | **DEAD / UNREACHABLE** | **120.3.2** (optional hygiene) | Safe cleanup candidate; must not affect production tiles |
| **POC Hub named helpers** (`pocAutofill.ts` named constants; DEV-only UX) | **DEVELOPMENT / POC** | **120.3.2** (optional) | Not production Digital Home path; hygiene only |

### 1.2 Not yet intended for retirement (retain until gates pass  -  or Phase 120 may close with documented exception)

| Mechanism | Class | Why not retiring yet |
|---|---|---|
| **Managed Autofill + Managed-parity activate** | **TARGET** | Keep; strengthen; never retire |
| **HTZone site adapter + Ext HTZone path** | **MIGRATION CANDIDATE** (pending capability proof) | Adapter runs **before** Managed; removal without Managed capability equivalence would weaken support. **120.3.4** answers equivalence first; retirement only after YES + config+validation+Managed proof |
| **Identity-first medium assist + host/serviceId allowlist** | **TEMPORARY EXCEPTION** + capability gap | Multi-step identity-first not first-class in current Managed. **120.3.5** may accept documented temporary exception as Phase 120 outcome |
| **LI complex ג†’ open-only** | **TEMPORARY EXCEPTION** | By design until richer Managed capability exists |
| **Practice adapter** | **DEVELOPMENT / POC** | DEV/demo; removal is hygiene, not a production convergence win; optional **120.3.2** |
| **Open-only / credentials-missing fail-closed opens** | Operational | Not a parallel fill engine  -  retain |
| **Admin authoring** (Analyze / Visual / Managed-parity probe) | Authoring | Out of fill-runtime; preserve |

### 1.3 Explicit non-goals for retirement this phase
- Do **not** retire HTZone merely because it is service-specific.  
- Do **not** retire legacy generic before dependents + Managed-or-exception matrix (**120.3.6**).  
- Do **not** treat ג€migrate every simple catalog serviceג€ as a retirement prerequisite (D-120-10).

---

## 2. Temporary retains  -  generic capability rationale

| Retained mechanism | Generic capability rationale (NOT service identity) | Acceptable Phase 120 end-state? |
|---|---|---|
| **HTZone adapter path** | Possible need for pre-fill DOM prep / non-CSS choreography / dedicated fill shape beyond current Managed top-document CSS locators. Until **120.3.4** proves Managed can represent the **same login experience**, retain. | Retain until YES+proof, or document **generic** gap if NO |
| **Medium assist + allowlist** | Managed fills mapped fields on **one** Login Entry top document; no first-class **multi-step / identity-first** flow | **Yes**  -  documented temporary exception may close Phase 120 if simple-login convergence is complete (**120.3.5**) |
| **LI complex ג†’ open-only** | Non-standard login not expressible as simple Managed field fill | **Yes**  -  temporary exception by design |
| **Managed fail-closed (no silent generic)** | Security / contract  -  not a ג€retain legacy,ג€ retain the **guarantee** | Mandatory forever |
| **Practice / POC paths** | Outside production Digital Home UX | Optional hygiene (**120.3.2**); not required for convergence PASS |

**Do not expand** host/serviceId allowlists as product architecture while they remain temporary exceptions.

---

## 3. Prerequisites / evidence before each retirement

Retirement of a production mechanism is **forbidden** until the matching gate row is complete. Evidence must be recorded in the authorizing sub-sliceג€™s Manager/Dev artifacts (when those slices are authorized).

### 3.1 Gate matrix (enforceable)

| Retirement / action | Sub-slice | Prerequisites (ALL required) | Evidence artifacts |
|---|---|---|---|
| **Dead map / POC hygiene** that cannot affect production tiles | **120.3.2** | Owner authorize; impact analysis: no Digital Home tile path change; lint/tests green | Diff scoped to dead/POC only; smoke that Managed + adapters still resolve |
| **Claim ג€simple login config-only convergenceג€ validated** | **120.3.3** | Owner-authorized **fixture set** (named services = fixtures only); each fixture: Admin schema + mappings + **Managed-parity activate PASS** + live Digital Home **Managed** path PASS; **no** runtime delete | Per-fixture: config snapshot (no secrets); activate probe PASS; tile execution Managed (not generic/adapter); regression checklist ֲ§5 |
| **Consider HTZone adapter retirement** | **120.3.4** then Owner | **Q:** Can **existing generic Managed** represent the login behavior the adapter handles? **YES** ג†’ config authored + Managed-parity activate PASS + live Managed path PASS **before** retirement considered. **NO** ג†’ document missing **generic** capability only  -  **never** HTZone-specific replacement | Written capability answer; if YES: same evidence class as 120.3.3 for that experience; if NO: gap register (generic terms) |
| **Close multi-step as Phase 120 decision** | **120.3.5** | Architecture/Owner: either (a) authorize future generic multi-step capability work (out of assumed 120 scope), or (b) accept **documented temporary exception** for medium allowlist + LI complex | Decision record; allowlist freeze (no expansion-as-architecture) |
| **Retire legacy generic fill path** | **120.3.6** | Inventory of **reachable dependents**; each dependent is (Managed-represented with activate+live Managed proof) **OR** explicitly classified approved exception; regression ֲ§5 PASS; rollback plan ֲ§6 ready | Dependent matrix; per-row Managed-or-exception; Owner sign-off; no silent fallback remaining |

### 3.2 Cross-cutting evidence rules (all retirements)
1. **Managed-parity activate** (`assessManagedTargetsReady` or shared equivalent) must PASS before any config is treated as production-validated.  
2. **Fail closed** on `multi_match` / readiness failure  -  surface `fieldId` / `detail` / `locator` (no secrets).  
3. Live Digital Home proof must show the **Managed** path, not adapter-first or legacy generic, for fixtures claimed as converged.  
4. **No** first-match; **no** timing-as-fix; **no** hostname/serviceId substitute for uniqueness.  
5. Fixture locator edits are **Admin remaps under the contract**, not architecture fixes and not service-specific product code.

---

## 4. Representative validation strategy  -  **120.3.3** (fixtures only)

### 4.1 Objective (D-120-10)
Prove that **simple** single-page username/password (or schema-mapped) logins can be represented **entirely by configuration** on the Managed Autofill runtime. Phase 120.3 does **not** require migrating every simple catalog service.

### 4.2 Fixture policy
| Rule | Binding |
|---|---|
| Named services | **Fixtures only** (D-120-9)  -  not product requirements |
| Count | **Sufficient representative set** Owner-authorized at 120.3.3 start  -  **not** exhaustive catalog |
| Already proven | **Shufersal** Managed pilot (**120.2 CLOSED**) counts as **one** representative fixture already delivered  -  do not re-litigate; may remain in regression set |
| Additional fixtures | Prefer existing simple catalog services still on **legacy generic** (e.g. inventory label **Clalit** as candidate fixture only)  -  Owner picks set at authorization; Manager must not treat any name as mandatory architecture |
| Out of fixture set | HTZone (ג†’ **120.3.4** capability analysis, not ג€just another simple fixtureג€); medium allowlist sites (ג†’ **120.3.5**); LI complex |

### 4.3 Per-fixture validation procedure (when 120.3.3 authorized)
```text
1. Admin: service + Login Entry + credential schema (stable field IDs)
2. Author mappings (Analyze and/or Visual)  -  authoring only
3. Structural save
4. Managed-parity activate MUST PASS (same exactly-one contract as fill)
5. Digital Home tile ג†’ Managed Autofill path (not adapter, not POC_GENERIC_FILL)
6. Deterministic fill; manual user submit
7. Record evidence (no secrets): path taken, activate result, readiness, observed URL
```

### 4.4 Success bar for 120.3.3
- Owner-authorized fixtures each complete ֲ§4.3.  
- No production runtime code change required for those fixtures (**config-only**).  
- No claim that ג€all simple catalog services migrated.ג€  
- Regression ֲ§5 still PASS (including prior Shufersal Managed evidence).

### 4.5 Explicit non-goals of 120.3.3
Exhaustive simple-catalog migration ֲ· adapter deletion ֲ· legacy generic deletion ֲ· HTZone retirement ֲ· multi-step Managed ֲ· 120.FSC ֲ· service-specific selectors in source.

---

## 5. Regression requirements (preserve 117 / 118 / 119 / 120.2)

Any authorized 120.3.2+ change must preserve:

| Contract | Must remain |
|---|---|
| Managed **exactly-one** safe target | No first-match; fail closed on multi_match / not ready |
| **No auto-submit** | User submits manually |
| **Managed-parity activate** before `supportState=validated` | Probe evidence, not UI attestation alone |
| Fail-closed activate / fill | Surface `fieldId` / `detail` / `locator`; no silent success stamp |
| **No silent Managedג†’legacy generic fallback** | Managed path failure ג†’ open-only + message; never `POC_GENERIC_FILL` |
| Authoring ג‰  runtime knowledge of authoring path | Analyze/Visual are authoring only |
| Shared Global Registry topology (ֲ§5B) | No invented TEST/PROD config split |
| D-120-9 / D-120-10 | Fixtures ג‰  architecture; representative ג‰  exhaustive |
| Adapter-before-Managed order | Unchanged until a **separately authorized** retirement slice proves equivalence and removes adapter |

**Regression evidence (minimum when implementation slices run):** existing Managed fixture (Shufersal) still activates + fills via Managed; no new hostname/serviceId branches; lint/tests per Developer checklist for that slice.

---

## 6. Rollback / fail-closed requirements

| Rule | Enforceable meaning |
|---|---|
| **Fail closed** | Prefer open-only / explicit Admin error over incorrect fill or silent legacy |
| **No silent fallback** | Retirement must not introduce Managed-miss ג†’ automatic legacy generic |
| **Reversible retirement** | Until Owner accepts permanent delete: prefer feature/path gating or retained code behind unreachable config over big-bang delete; dead-code removal only when dependents matrix proves zero production reachability |
| **Capability loss forbidden** | Do not remove HTZone / medium / complex open-only / legacy generic while dependents still need them without Managed-or-exception proof |
| **Activate gate intact** | Rollback of a bad config = remap + re-probe; never bypass probe to ג€fixג€ production |
| **Evidence on failure** | fieldId + detail + locator (+ observed URL/tab when available); no secrets |

---

## 7. Explicit prohibition  -  service-specific replacement logic

**FORBIDDEN** in all 120.3 work (investigation already accepted; implementation when later authorized):

1. Hostname-driven or `serviceId`-driven **product** fill branches that re-encode named-service knowledge where Managed config can represent the experience.  
2. New dedicated adapters, selector tables, or scripts for a named service ג€because fixture X failed.ג€  
3. HTZone-specific replacement design  -  **120.3.4** answers Managed **capability equivalence** only; if NO, register a **generic** capability gap (e.g. multi-step, iframe, non-CSS prep), never an HTZone product fork.  
4. Expanding medium `hostIncludes` / `serviceId` allowlists as the architectural solution.  
5. First-match, timing-as-fix, or locator one-offs as substitutes for uniqueness / readiness.  
6. Silent legacy generic as compatibility shim after Managed is selected.  
7. Designing production deployment, environment, or config lifecycle around a named service (D-120-9).

**ALLOWED:** configuration/data for arbitrary services; generic Managed runtime improvements that apply to all services; documented temporary exceptions with generic capability rationale; representative fixtures for validation.

---

## Phased sequence (normative  -  from ֲ§9.4; disposition binds Manager)

| Sub-slice | Intent | Authorization now |
|---|---|---|
| **120.3.0** | Investigation | **ACCEPTED** |
| **120.3.1** | This Disposition DD | **ARCHITECTURE PASS / ACCEPTED** (historical) |
| **120.3.2** | Optional dead/POC hygiene (no production tile impact) | **NOT AUTHORIZED** |
| **120.3.3** | Representative config-only Managed convergence validation (fixtures) | **NOT AUTHORIZED** |
| **120.3.4** | HTZone ג†” Managed capability equivalence analysis (+ proof before any retirement) | **NOT AUTHORIZED** |
| **120.3.5** | Multi-step / identity-first **decision boundary** (exception may close Phase 120) | **NOT AUTHORIZED** |
| **120.3.6** | Legacy generic retirement (**conditional** on dependents + Managed or approved exception) | **NOT AUTHORIZED** |

**Developer implementation of 120.3.2+ is NOT AUTHORIZED** until Architecture PASS on this DD **and** explicit per-sub-slice authorization.

---

## Acceptance criteria  -  Disposition DD (AC-120.3.1-*)

| ID | Criterion | Manager self-check |
|---|---|---|
| AC-120.3.1-1 | Retirement intent lists mechanisms intended for retirement and which are not yet | **PASS** (ֲ§1) |
| AC-120.3.1-2 | Temporary retains include generic capability rationale | **PASS** (ֲ§2) |
| AC-120.3.1-3 | Exact prerequisites/evidence before each retirement | **PASS** (ֲ§3) |
| AC-120.3.1-4 | Representative validation strategy for 120.3.3 (fixtures only; not exhaustive) | **PASS** (ֲ§4) |
| AC-120.3.1-5 | Regression preserves 117/118/119/120.2 Managed contracts | **PASS** (ֲ§5) |
| AC-120.3.1-6 | Rollback / fail-closed requirements stated | **PASS** (ֲ§6) |
| AC-120.3.1-7 | Explicit prohibition on service-specific replacement logic | **PASS** (ֲ§7) |
| AC-120.3.1-8 | No Developer handoff; no code; no adapter removal; no migration; no 120.FSC in this slice | **PASS** |

---

## Manager Review (120.3.1)
MANAGER_REVIEW_STATUS: **ARCHITECTURE PASS / ACCEPTED** (historical)

### Review Notes
Disposition DD converts ֲ§9 ACCEPTED investigation into enforceable convergence plan per ֲ§9.6. Named services are fixtures only. Superseded active work: see **120.3.6** at top of file.

### Exact next step
_(historical)_ Architecture accepted; later slices proceed per arch-phase120.md.

---

# Slice 120.2-AP  -  Detailed Design: Managed-parity activate gate (GENERIC)  -  HISTORICAL (CLOSED)

## Goal
Close **VALIDATION_CONTRACT_DEFECT**: `supportState=validated` must not be attainable by Admin UI attestation alone. Before `activate_validated` succeeds, run a **Managed-parity readiness probe** using the **same exactly-one safe target contract** as Digital Home Managed Autofill (`assessManagedTargetsReady` or shared equivalent).

Shufersal remains a **validation fixture only** (D-120-9). This DD is **service-agnostic**.

## Problem (evidence-backed)
| Fact | Implication |
|---|---|
| ֲ§5D: `password` ג†’ `#j_password` ג†’ persistent `multi_match` | Runtime correctly fail-closed |
| Admin activate = confirm dialog + `liveValidationApproved: true` | No live uniqueness probe |
| Stamps `resultSummary: 'live_validation_ok'` | Evidence defect (D) |
| Structural save / Visual pick uniqueness | Insufficient for activate |

## In scope
1. Generic Admin activate path: probe Login Entry (top document) with saved mappings + `allowedOrigin` before `activate_validated`.  
2. Fail closed on readiness failure; surface `fieldId`, `detail`, `locator` (and observed URL/tab when available) to Admin  -  **no secrets**.  
3. Stamp validation evidence from **probe outcome**, not UI confirm alone.  
4. Keep Managed fill runtime exactly-one rule unchanged (no first-match).  
5. Extension message (or reuse) for **assess-only** Admin probe  -  no vault credentials; throwaway fill **out of this slice** unless Architecture expands scope (see Optional).

## Out of scope / STOP
| Forbidden | |
|---|---|
| Implement before Architecture APPROVES this DD | STOP |
| First-match / pick any of N duplicates | STOP |
| Weaken exactly-one safe target | STOP |
| Hostname / serviceId / Shufersal-specific selectors or delays | STOP |
| Timing delays as substitute for uniqueness | STOP |
| Manual fixture locator edit as the ג€architecture fixג€ | STOP (Admin remaps **after** gate ships, under new contract) |
| Legacy `POC_GENERIC_FILL` / silent generic fallback | STOP |
| Changing Digital Home Managed fill retry timing for this gate | STOP |
| Vault decrypt for activate probe | STOP |
| ֲ§5C tab-lifecycle hardening as this slice | STOP (separate, not this P4) |

## Normative activate flow
```text
Admin: structural OK + saved mappings (unchanged authoring)
  ג†’ Admin requests activate (ֲ«׳׳©׳¨ ׳׳™׳₪׳•׳™ֲ» or successor)
  ג†’ Extension opens Login Entry (top frame only) OR uses existing Admin open pattern
  ג†’ assessManagedTargetsReady({ allowedOrigin, fieldMappings })  // SAME contract as Managed fill
  ג†’ IF not ready:
       ג†’ DO NOT set supportState=validated
       ג†’ DO NOT set liveValidationApproved success stamp
       ג†’ Surface fieldId + detail + locator (+ observedUrl) to Admin
       ג†’ STOP
  ג†’ IF ready:
       ג†’ Only then allow activate_validated planner path
       ג†’ Stamp validation evidence from probe (see Evidence)
       ג†’ supportState=validated + version bind (existing D-117-15)
```

**Replace:** confirm-dialog alone setting `liveValidationApproved: true` without probe.

**Retain:** explicit Admin intent to activate (button/confirm)  -  but confirm must be **after** or **gated by** successful probe, not instead of it.

## Probe contract (parity with Managed runtime)
| Rule | Binding |
|---|---|
| Function | `assessManagedTargetsReady` (page MAIN)  -  shared with Managed fill; do not fork divergent uniqueness rules |
| Scope | Top document only (`frameIds: [0]`)  -  same as Managed fill |
| Success | Every mapped locator ג†’ exactly **one** safe fill target (`isSafeFillTarget`) |
| Fail reasons surfaced | At minimum `targets_not_ready` with `detail` גˆˆ {`zero_match`,`multi_match`,`hidden_target`,`non_editable`,`unsafe_target`} plus `fieldId`, `locator` |
| Other fails | `wrong_origin`, `not_top_frame`, `invalid_selector`, etc.  -  fail closed; no activate |
| Credentials | **None** on probe (assess-only) |
| First-match | **Forbidden** |

## Evidence stamp (on success only)
Extend / replace hollow `live_validation_ok` attestation:

| Field | Requirement |
|---|---|
| `validation.metadataVersion` | = `configVersion` (existing) |
| `validatedAt` / `validatedBy` | existing |
| `resultSummary` | Must reflect probe success, e.g. `managed_readiness_ok` (not UI-confirm-only `live_validation_ok`) |
| Optional structured codes | Store non-secret probe summary (e.g. ready=true, mapping count)  -  **no** credential values, **no** DOM values |

On failure: **no** validated stamp; Admin sees structured error.

Planner change: `activate_validated` must require proof of successful Managed-parity probe (e.g. short-lived Hub-side `probePassed` / server-trustable flag derived only after extension probe OK)  -  **not** a checkbox the UI can set true without probe. Exact flag plumbing is Developer detail under this contract; Architecture rejects any path that sets `liveValidationApproved` without probe success.

## UI / Admin UX (generic)
- Disable or block activate until probe completes.  
- On `multi_match` (etc.): Hebrew Admin-visible error naming **field** + readiness detail; show locator string for operator remapping.  
- Do not suggest ג€use first match.ג€  
- After gate ships: fixture remapping is normal Admin config work under the new gate  -  not part of this DDג€™s code scope.

## Optional (explicitly OUT unless Architecture expands)
Security-gated **throwaway fill + verify** on activate (Phase 117 design). This DDג€™s **minimum** is assess-only readiness parity. Throwaway fill may be a follow-on slice.

## Files expected to change (after approval only)
| Area | Expectation |
|---|---|
| `AutofillProfileEditor.tsx` (or Admin activate flow) | Probe before activate; surface failures |
| Extension `background.js` + `validated-autofill.js` | Admin assess-only message/path reusing `assessManagedTargetsReady` (generic) |
| `validatedProfile.ts` planner / evidence | Activate requires probe proof; stamp non-hollow resultSummary |
| Hubג†”extension bridge | New Admin message type distinct from `HUB_MANAGED_AUTOFILL` fill (no credentials) |
| Shufersal registry mappings | **No change in this implementation** |
| Managed Digital Home fill path uniqueness rules | **Unchanged** |

## Acceptance criteria (AC-120.2-AP-*)
| ID | Criterion |
|---|---|
| AC-120.2-AP-1 | Activate without successful Managed-parity probe **cannot** set `supportState=validated` |
| AC-120.2-AP-2 | Probe uses same exactly-one readiness contract as Managed fill (`assessManagedTargetsReady` or proven shared equivalent) |
| AC-120.2-AP-3 | On `multi_match` / `zero_match` / unsafe: fail closed; Admin sees `fieldId`, `detail`, `locator` |
| AC-120.2-AP-4 | No first-match behavior anywhere on probe or fill |
| AC-120.2-AP-5 | No hostname/serviceId/service-named branches |
| AC-120.2-AP-6 | No timing delay added as uniqueness substitute |
| AC-120.2-AP-7 | No vault credentials / no secret logging on probe |
| AC-120.2-AP-8 | No legacy generic fallback |
| AC-120.2-AP-9 | Validation evidence on success reflects probe  -  not confirm-dialog alone |
| AC-120.2-AP-10 | Fixture registry locators not edited by this code change |
| AC-120.2-AP-11 | Regression: structural save still never sets `validated`; Digital Home Managed fill behavior unchanged except benefiting from honest activate |

## Verification plan (post-implementation  -  not now)
1. Synthetic/static: activate path requires probe proof; planner rejects bare `liveValidationApproved`.  
2. Live fixture (Shufersal or any multi_match page): activate **blocked** with `multi_match` + `fieldId` + `locator`.  
3. After Admin remaps to unique locators under gate: activate **allowed**; Digital Home Managed fill can succeed (separate evidence).  
4. Affirm: no service-specific code; no first-match; no generic fallback.

## Developer STOP conditions
- Implementing before Architecture APPROVES this DD ג†’ STOP  
- First-match / weaken exactly-one ג†’ STOP  
- Hostname/serviceId/Shufersal-only logic ג†’ STOP  
- Timing-as-fix ג†’ STOP  
- Editing fixture locators in code/migration as ג€fixג€ ג†’ STOP  
- Vault decrypt on probe ג†’ STOP  
- Claiming P4 PASS without activate gate + remapped unique locators + fill evidence ג†’ STOP  

## Implementation authorization
**NOT AUTHORIZED.** Await Architecture review PASS + Owner gate if required.

---

## Manager Review (120.2-AP)
MANAGER_REVIEW_STATUS: **READY_FOR_APPROVAL**

### Review Notes
- Addresses ֲ§5E `VALIDATION_CONTRACT_DEFECT` with generic Managed-parity activate probe.  
- Fail closed on `multi_match`; surface `fieldId`/`detail`/`locator`.  
- Explicitly forbids first-match, hostname/serviceId, timing-as-fix, locator one-off architecture fix, legacy fallback.  
- Assess-only minimum; throwaway fill optional follow-on.  
- **Do not implement** until Architecture approves.

### Required Corrections
_Awaiting Architecture review._

---

# Prior 120.2 DD (Shufersal pilot / ֲ§5B)  -  retained for audit

STATUS (historical): ֲ§5B amendment was Architecture-approved; pilot evidence P3 PASS / P1 path PASS / P4 FAIL per ֲ§5E.

## Goal (120.2 pilot  -  historical)
Prove the **generic** config-only migration: move catalog service **`shufersal`** from **legacy generic Autofill** to **validated Managed Autofill**, using existing Phase 117/118/119 authoring  -  **no** Shufersal adapter, **no** hostname/serviceId runtime branch, **no** Managed/orchestrator code changes, **no** live `login_fields` rewrite to match seed, **no** Configuration Promotion design.

## ֲ§5B  -  Verified shared topology (Owner 2026-09-21)  -  binding

### Shared Global Registry (normative)
| Fact | Record |
|---|---|
| Localhost Admin Hub Supabase project | **`wbehjoraatkrpsbgyunx`** (`VITE_SUPABASE_URL=https://wbehjoraatkrpsbgyunx.supabase.co`) |
| Deployed Production Hub Supabase project | **Same `wbehjoraatkrpsbgyunx`** (embedded in `password-vault-sable.vercel.app` bundle) |
| Global Registry / Managed config | **Physically shared**  -  one `service_registry`; global rows `owner_user_id IS NULL` |
| S3ג€“S7 Admin writes on global `shufersal` | **Production-visible immediately**  -  same row Production Hub loads |

**Direct answer:** Shufersal S3ג€“S7 configuration **already modifies Production-visible global configuration.** There is no private TEST Global Registry sandbox.

### What remains separate (do not confuse with config DB)
| Kind | Shared localhost ג†” Production Hub? | Notes |
|---|---|---|
| **Global service configuration** (`service_registry` + Managed metadata) | **Yes  -  shared now** | Blast radius of S3ג€“S7 |
| **Hub source code** | **No** | localhost Vite vs Vercel deploy  -  separate build/host |
| **Extension** | **No** | unpacked local vs packaged/store; `externally_connectable` may list both hosts |
| **Edge Functions** | Same Supabase **project**; code release separate | Deploy to shared project ג‰  Hub UI deploy |
| **Database migrations** | Same Supabase **project** | Schema shared; apply once |
| **Configuration Promotion TESTג†’PROD** | **N/A** | No second config database |

### Configuration Promotion
**Do NOT design Configuration Promotion** for 120.2. Separate configuration environments do not exist; a TESTג†’PROD promote workflow would be fiction. Withdrawn until Owner authorizes separate config infrastructure (out of scope).

### User data isolation (unchanged)
User credentials / profiles remain on user-scoped tables + RLS (`encrypted_credentials`, etc.)  -  **not** on the global `shufersal` row. Do not copy credentials between users/environments.

## `supportState` activation discipline + Production-path smoke

Stored configuration bytes on the global row are Production-visible **even while drafting**. Runtime Managed selection still depends on eligibility rules:

| Concern | Discipline |
|---|---|
| Draft mappings / structural save | May persist on shared DB without selecting `HUB_MANAGED_AUTOFILL` until `supportState=validated` + version match |
| Explicit activate to `validated` | **Deliberate** Admin action only  -  treat as Production-visible activation of Managed for all hubs reading this DB |
| Activate UI DEV-gate | Localhost DEV Admin may expose activate; Production Hub build may lack that button  -  DB can still hold `validated` if set from localhost |
| Hub code parity | Production Hub build may lag localhost ג†’ path proof must note which Hub/extension build was used |
| Extension parity | Reload/packaged extension must match readiness/Managed scripts under test |
| Production-path smoke | After activate: smoke Digital Home / Assist on **deployed** Hub + current extension against shared DB  -  **not** via config copy |
| Path-proof evidence (P1ג€“P5) | **Retain**; continue collecting with blast-radius awareness |

**Gate Production runtime readiness via:** deliberate `supportState`, Hub deploy parity, extension parity, and smoke  -  **not** via config promotion.

## Normative source of truth (schema)
**CURRENT LIVE `service_registry` row for `id=shufersal`**  -  not `builtinCatalog.ts` seed.

## S1 authenticated live dump  -  migration baseline (Owner 2026-09-21)

| Field | Live baseline (normative) |
|---|---|
| `id` | `shufersal` |
| `primary_url` | `https://www.shufersal.co.il` (**verified MATCH** vs seed) |
| `login_url` (Login Entry) | `https://www.shufersal.co.il/online/he/login` (**verified MATCH** vs seed) |
| **`login_fields` IDs** | **`username`**, **`password`** (**normative**) |
| `adapter_id` | `""` (empty string)  -  treat as **no adapter** for this slice |
| `metadata.credentialMode` | `null` ג†’ may become `credential_fields` only via existing Admin flow |
| Managed `autofillProfile.supportState` | `null` / absent ג†’ `validated` only via explicit Admin activate |

### Credential field IDs (binding)
| Normative `field.id` | Rule |
|---|---|
| **`username`** | Preserve throughout Managed configuration |
| **`password`** | Preserve throughout Managed configuration |

**Forbidden:** rename `username` ג†’ `email`; invent foreign field IDs; map Managed as `email` while live schema remains `username`.

### Credential compatibility (binding)
Existing stored Shufersal vault values keyed by `field.id` remain addressable. **Do not** perform registry/schema field-id migration in 120.2.

### `adapter_id` `""` ג‰¡ no adapter
Orchestrator skips site adapters when trimmed `adapterId` is falsy. **Do not** modify live `adapter_id` merely to match seed `null`.

## Builtin seed hygiene debt (OUT OF SLICE)
Seed still has `email`/`password`. Live has `username`/`password`. **Do NOT** change `builtinCatalog.ts` in 120.2.

## Normative target flow
```text
Shufersal LIVE shared Global Registry (wbehjoraatkrpsbgyunx)
  ג†’ login_fields = username, password; adapter_id "" ג‰¡ none
  ג†’ Login Entry https://www.shufersal.co.il/online/he/login
  ג†’ Admin S3ג€“S7 (writes Production-visible config immediately)
  ג†’ deliberate supportState=validated (+ version stamp)
  ג†’ Digital Home (localhost and/or Production Hub) + extension parity
  ג†’ HUB_MANAGED_AUTOFILL; fill username + password; manual submit
  ג†’ Managed failure ג†’ open + message; NEVER silent POC_GENERIC_FILL
  ג†’ Production-path smoke on shared DB (not config promote)
```

## In scope
1. Live schema baseline + ֲ§5B shared topology discipline.
2. Config-only Managed profile via Admin Analyze / Visual Mapping / readiness.
3. Explicit Admin activation to `validated` with blast-radius awareness.
4. Retain S3ג€“S7 evidence; continue path proof P1ג€“P5.
5. Production-path smoke + Hub/extension parity notes.
6. Regression: Clalit / non-Shufersal unchanged; legacy generic remains available.

## Out of scope / STOP
| Forbidden | |
|---|---|
| Design or implement **Configuration Promotion** | STOP (N/A under ֲ§5B) |
| Claim P1/P3/P4 PASS while pending | STOP |
| Rename live `username` ג†’ `email` / rewrite schema to seed | STOP |
| Fix `builtinCatalog.ts` in this slice | STOP |
| Migrate Clalit / create adapter / runtime branch | STOP |
| Change Managed runtime / orchestrator | STOP |
| Delete or globally disable legacy generic | STOP |
| Assume localhost config is ג€TEST-onlyג€ / non-Production-visible | STOP |

## Config-only migration steps (ordered)

| Step | Action | Status |
|---:|---|---|
| **S0** | Reload extension; note Hub build (localhost vs Production) | Ongoing |
| **S1** | Authenticated live dump | **PASS**  -  baseline above |
| **S2** | Live vs seed disposition | **DONE**  -  use live schema |
| **S3** | `credentialMode` / credential_fields via Admin | **AUTHORIZED**  -  Production-visible write |
| **S4** | Analyze Login Page (readiness) | **AUTHORIZED**  -  shared DB |
| **S5** | Map **`username`** + **`password`** | **AUTHORIZED** |
| **S6** | Save Managed config; structural OK | **AUTHORIZED**  -  retain evidence |
| **S7** | Live validate ג†’ **deliberate** `validated` activate | **AUTHORIZED**  -  Production-visible activation |
| **S8ג€“S10** | Path proof + Production-path smoke + package | After S7; P1/P3/P4 pending until evidenced |

**No application/extension production code changes expected** for config-only migration. Hub/extension **releases** remain separate from shared config writes.

## Path proof (AC-120.2-5, 8, 10)

### Expected orchestrator behavior (existing  -  do not modify)
1. Empty/null `adapterId` ג†’ skip adapters  
2. Validated Managed ג†’ `executeManagedAutofill` ג†’ **STOP**  
3. Managed fail ג†’ open_only + message ג†’ **STOP** (no generic)  
4. Generic only if Managed gate not entered  

### Required evidence artifacts
| Evidence | Signal | Status |
|---|---|---|
| P1 | `HUB_MANAGED_AUTOFILL` for Shufersal | **PENDING**  -  retain prior evidence work |
| P2 | No silent `executeGenericAutofill` on Managed fail | Static OK; live affirm later |
| P3 | Redacted `supportState=validated`; mappings `username`/`password` | **PENDING** |
| P4 | Live username + password fill; manual submit | **PENDING** |
| P5 | No adapter / no runtime branch | Static / later affirm |
| Smoke | Production Hub + extension against shared DB after activate | Required for Production-path readiness |

## Acceptance Criteria (AC-120.2-1ג€¦10)

| AC | Criterion | Note |
|---|---|---|
| AC-120.2-1 | Normal catalog `shufersal` | Live id unchanged |
| AC-120.2-2 | No Shufersal adapter | `""` ג‰¡ none |
| AC-120.2-3 | No hostname/serviceId runtime branch | Unchanged |
| AC-120.2-4 | `supportState=validated` | Deliberate activate on shared DB |
| AC-120.2-5 | Digital Home selects Managed | P1 (+ note which Hub build) |
| AC-120.2-6 | Required fields fill live | `username` + `password` |
| AC-120.2-7 | No auto-submit | Managed contract |
| AC-120.2-8 | No silent generic fallback | P2 |
| AC-120.2-9 | Non-Shufersal unchanged | Clalit not migrated |
| AC-120.2-10 | Path evidence | P1ג€“P5 |

## Regression matrix
| Check | Expected |
|---|---|
| Clalit | Not migrated |
| HTZone / Practice / medium / complex | Unchanged |
| Other non-Managed catalog | Legacy generic still available |
| Global generic | Not deleted / not globally disabled |
| Orchestrator | Unchanged |
| Vault keys | Remain `username` / `password` |
| Other global catalog services | Unintended Managed activation not performed |

## Files expected to change
| Area | Expectation |
|---|---|
| Production Hub/extension Autofill **runtime code** | **None** (config-only) |
| Shared `service_registry` global `shufersal` metadata | Admin writes  -  **Production-visible** |
| `builtinCatalog.ts` | **No change** |
| Configuration Promotion module | **Do not create** |
| `team-Yuri/dev-phase120.md` | Retain S3ג€“S7 evidence; note ֲ§5B blast radius |

## Developer STOP conditions
- Design/implement Configuration Promotion ג†’ **STOP**  
- Treat S3ג€“S7 as non-Production-visible ג†’ **STOP** (incorrect under ֲ§5B)  
- Rename `username`ג†’`email` / fix seed in-slice ג†’ **STOP**  
- Migrate Clalit / adapter / runtime branch / generic retirement ג†’ **STOP**  
- Claim P1/P3/P4 PASS while pending ג†’ **STOP**

## Required Developer evidence
- Affirm mappings use live `username`/`password`  
- Retain S3ג€“S7 evidence; document shared-DB blast radius  
- P1ג€“P5 + Production-path smoke notes (Hub/extension build IDs)  
- Affirm: no Configuration Promotion; no Clalit; generic retained  

---

## Manager Review (120.2 DD  -  ֲ§5B amendment)  -  HISTORICAL
MANAGER_REVIEW_STATUS: **APPROVED** (Architecture ֲ§5B re-review PASS)  -  superseded as active work by **120.2-AP**

### Review Notes
- Recorded shared Supabase **`wbehjoraatkrpsbgyunx`** for localhost Admin + Production Hub; Global Registry shared.
- S3ג€“S7 writes are **Production-visible immediately**.
- **Configuration Promotion not designed** (N/A).
- Documented separate: Hub code, extension, Edge Functions, migrations vs shared config.
- Documented `supportState` activation discipline + Production-path smoke on shared DB.
- Later: ֲ§5E  -  activate without Managed-parity probe = VALIDATION_CONTRACT_DEFECT; see **120.2-AP** DD at top of file.

### Required Corrections
None for ֲ§5B (closed). Active corrections tracked under **120.2-AP**.

---

# Slice 120.1  -  Autofill Runtime Inventory Report (ACCEPTED  -  retained)

**Evidence date:** 2026-09-20  
**Authority:** Current repository code (not historical inventory assumptions)  
**Audience:** Architecture Owner (via Architect review)  
**AC coverage:** AC-120.1-1 ג€¦ AC-120.1-7

---

## 1) Primary inventory table

| Mechanism | Entry point | Trigger | Services/hosts | Production reachable | Fallback | Classification |
|---|---|---|---|---|---|---|
| **Managed Autofill** | Hub: `attemptExistingAutomaticCompletion` ג†’ `executeServiceFromTile` ג†’ `executeManagedAutofill` (`src/execution/managedAutofill.ts`); Ext: `HUB_MANAGED_AUTOFILL` ג†’ `validated-autofill.js` / fill-executor | `serviceClaimsValidatedManagedProfile` **or** `serviceHasValidatedManagedProfile` **or** `serviceIsManagedAutofillEligible` (profile `supportState=validated` + version match + credential_fields + complete creds + mappings) | Any catalog/custom service with validated `metadata.autofillProfile` | **Yes** (when profile validated & eligible) | On Managed failure: **open Login Entry + structured fail message**; **never** silent `executeGenericAutofill` | **TARGET** |
| **HTZone site adapter** | `executeServiceFromTile` ג†’ `htzoneAdapter` (`adapters/htzoneAdapter.ts`); Ext: `POC_FILL_IL` ג†’ `htzone-adapter.js` / `openHtzonePageAndFill` | `service.adapterId === 'htzone'` (site-specific set) **before** Managed | Catalog `id: htzone`, `adapterId: htzone`; host checks `htzone.co.il` / `www.htzone.co.il` in `extension/background.js` | **Yes** for HTZone tile/Launch when adapterId set | Extension unavailable ג†’ open URL without fill; missing creds ג†’ open / credentials_missing | **MIGRATION CANDIDATE** (popup/prep may force **TEMPORARY EXCEPTION** until capability exists  -  see D) |
| **Practice site adapter** | `practiceAdapter.ts`; Ext: `POC_FILL_DEMO` | `adapterId === 'practice'`; `hub-practice-login`; URL gets `?pocAutofill=1` | Local/demo practice service | **Limited**  -  demo/localhost practice path; not a production bank site | Open demo URL if messaging fails | **DEVELOPMENT / POC** |
| **Legacy generic Autofill** | `executeGenericAutofill` ג†’ Ext `POC_GENERIC_FILL` ג†’ generic detect/map/fill (`generic-autofill.js`, field-mapper, fill-executor) | After adapters + Managed gate miss; LI complexity `basic` or `unknown`; `shouldAttemptGenericAutofill` (complete creds + loginFields **or** loginUrl) | Origin-independent gate (`autofillEligibility.ts`); typical catalog without Managed/adapter (e.g. Clalit, Shufersal, customs) | **Yes** | Extension unavailable ג†’ open URL, Hub may show fill-unavailable message; **no** switch to Managed | **MIGRATION CANDIDATE** |
| **Identity-first (Phase 112 medium)** | `executeMediumAssist` (`mediumAssist.ts`) ג†’ Ext `POC_IDENTITY_FIRST_FILL` | LI complexity `medium`; `VITE_PHASE112_MEDIUM !== 'false'`; host/service must `matchSupportedMediumSite` | Allowlist: localhost fixture, `amazon.co.il`/`amazon.com`, `ksp.co.il` / `auth.ksp.co.il` (+ serviceId match) | **Yes** when LI=medium + allowlisted | Feature off / unsupported site ג†’ open + explicit Hebrew status (never silent) | **MIGRATION CANDIDATE** (allowlist cohort) |
| **Complex / open-only (LI)** | `executeServiceFromTile` open branch | LI complexity `complex` | Services classified complex via metadata LI | **Yes** (open + guidance; no fill) | None (no fill attempt) | **TEMPORARY EXCEPTION** (open-only by design until authoring/capability) **or** out-of-simple-Managed |
| **Open-only (no fill)** | Final branch of `executeServiceFromTile`; also Managed not-ready / missing creds opens URL | Incomplete creds, Managed ineligible claim, unknown without generic gate, etc. | Any | **Yes** | N/A | Operational path  -  classify as **TEMPORARY EXCEPTION** when user expects fill but gates fail; else normal open |
| **POC Hub helpers** | `src/pocAutofill.ts` (dev dashboard); direct `POC_FILL_IL` / `POC_FILL_DEMO` / tile wrappers for Clalit/Shufersal/HTZone | `isDevBuild()` / POC controls; not Digital Home production UX | HTZone / Shufersal / Clalit / practice demo URLs | **No** as production UX (`isPocControlsVisible` = DEV only); helpers may still call production `executeServiceFromTile` when invoked | Opens URL / generic | **DEVELOPMENT / POC** |
| **content.js `?pocAutofill=1`** | `extension/content.js` practice/demo fill hook | Query param on practice demo pages | Localhost / practice demo | **DEV/demo** |  -  | **DEVELOPMENT / POC** |
| **Admin Analyze / Visual Mapping / readiness** | Assisted Mapping inspect & pick | Admin authoring only | N/A  -  **does not fill vault credentials** | Admin-only | D-118-14 empty ג†’ no provider | **Out of fill-runtime inventory** (authoring; noted for boundary) |
| **Legacy adapter map by service id** | `LEGACY_ADAPTER_ID_BY_SERVICE_ID` in `legacyCatalogMap.ts` | Would inject adapterId from service id |  -  | **Empty map `{}`** |  -  | **DEAD / UNREACHABLE** (no entries) |

---

## A. Actual runtime decision tree

**Source of truth:** `src/execution/serviceExecution.ts`  -  `executeServiceFromTile` (current).

```text
executeServiceFromTile(service, credential, loginFields, { activeProfileId })
  openUrl := loginUrl ?? primaryUrl

  1. IF adapterId גˆˆ {htzone, practice} AND adapter registered:
       ג†’ adapter.execute(...)
       ג†’ STOP (no Managed / LI / generic fall-through)

  2. IF Managed claim OR validated profile OR eligible:
       IF !credential ג†’ open Managed Login Entry; credentials_missing; STOP
       IF !eligible (version/mappings/creds) ג†’ open; open_only + MSG_MANAGED_NOT_READY; STOP
       ג†’ executeManagedAutofill(...)
       ג†’ on fail: open_only + fail message; STOP
       ג†’ NEVER executeGenericAutofill on Managed path

  3. Resolve Login Intelligence complexity from service.loginIntelligence ?? metadata

  4. IF complexity === 'complex':
       ג†’ open + website_not_supported message; STOP (no fill)

  5. IF complexity === 'medium':
       ג†’ executeMediumAssist (identity-first) ג†’ STOP

  6. IF shouldAttemptGenericAutofill AND (complexity basic|unknown):
       ג†’ executeGenericAutofill (POC_GENERIC_FILL)
       ג†’ STOP

  7. ELSE:
       ג†’ openUrlInNewTab
       ג†’ credentials_missing OR open_only
```

**Entry from Digital Home Launch:** `src/loginAssistance/assistanceActions.ts` ג†’ `attemptExistingAutomaticCompletion` ג†’ `executeServiceFromTile` (soft support-level gate may block attempt as Manual Only).

**Note vs historical checklist:** Checklist claimed adapters ג†’ Managed ג†’ LI ג†’ generic. **Current code matches that order** for fill mechanisms, with Managed **strictly before** LI/generic and **no** Managedג†’generic silent fallback.

---

## B. Service-specific code inventory (Autofill **runtime**)

| Location | What | Production fill impact |
|---|---|---|
| `adapters/registry.ts` | Only `htzone`, `practice` | Hard adapter set |
| `adapters/htzoneAdapter.ts` | Maps email/password fields ג†’ `POC_FILL_IL` | HTZone-only Hub adapter |
| `extension/background.js` | Hostname `htzone.co.il` / `www.htzone.co.il`; inject `htzone-adapter.js`; `POC_FILL_IL` / `POC_FILL_DEMO` | HTZone/practice extension paths |
| `extension/htzone-adapter.js` | Site-specific fill/prep | HTZone |
| `loginIntelligence/supportedMediumSites.ts` | Host allowlist amazon-il, ksp, localhost fixture | Medium identity-first gate |
| `builtinCatalog.ts` | `htzone.adapterId='htzone'`; `hub-practice-login.adapterId='practice'`; **clalit/shufersal have no adapterId** | Catalog routing metadata |
| `pocAutofill.ts` | Service ids `htzone`/`shufersal`/`clalit` + POC open helpers | **DEV POC** wrappers  -  not tile-only production |
| `legacyCatalogMap.ts` | `LEGACY_ADAPTER_ID_BY_SERVICE_ID = {}` | No idג†’adapter override |
| Generic mapper / `POC_GENERIC_FILL` | Heuristic field map  -  **no** clalit/shufersal service-id branch found in Hub eligibility (`autofillEligibility` explicitly origin-independent) | Shared legacy path |

### Target investigations (AC-120.1-3)

| Target | Dedicated Autofill impl? | Current runtime path (evidence) |
|---|---|---|
| **HTZone** | **Yes**  -  Hub `htzoneAdapter` + extension `htzone-adapter.js` + `POC_FILL_IL` + hostname guards | Adapter branch **before** Managed |
| **Clalit** | **No** dedicated adapter/fill branch | Catalog service `clalit` with loginUrl/fields; tile ג†’ Managed **if** validated profile else **legacy generic** (or open). POC helper may call `executeServiceFromTile` / generic in DEV |
| **Shufersal** | **No** dedicated adapter/fill branch | Same pattern as Clalit (`shufersal` catalog; generic unless Managed) |

---

## C. Feature-flag inventory

| Flag / gate | Location | Effect on Autofill runtime |
|---|---|---|
| `VITE_PHASE112_MEDIUM` | `supportedMediumSites.ts`  -  enabled unless `'false'` | Disables medium identity-first ג†’ open + unsupported-style status |
| `import.meta.env.DEV` / `isDevBuild()` | `pocAutofill.isPocControlsVisible`, Managed/generic DEV logs | POC dashboard fill buttons; no production UI |
| Managed eligibility | `validatedProfile` / `managedAutofill.ts` | Gates `HUB_MANAGED_AUTOFILL` |
| Login Assistance support level | `supportLevel.ts`  -  Manual Only skips auto attempt | Blocks `attemptExistingAutomaticCompletion` before orchestrator |
| Extension id / availability | `extensionBridge` / `VITE_POC_EXTENSION_ID` | Messaging fail ג†’ open without fill |
| LI complexity in metadata | `resolveLoginIntelligenceForExecution` | Routes complex/medium/basic/unknown |

No separate ג€disable Managedג€ or ג€disable genericג€ production flag found beyond the above gates.

---

## D. Migration dependency analysis

| Mechanism if removed **today** | Capability lost |
|---|---|
| **HTZone adapter** | Current HTZone production fill (incl. site-specific prep/popup behavior in extension) until Managed profile covers **or** product accepts open/manual / new capability for non-simple prep |
| **Practice adapter** | Local practice demo autofill |
| **Legacy generic** | Fill for Clalit, Shufersal, most customs/catalog without Managed validated; soft Best Effort Assist for those services |
| **Identity-first medium** | Step-1 identity fill for allowlisted medium sites (Amazon IL, KSP, fixture) |
| **Managed** | Intended long-term path  -  **must not remove** |
| **POC helpers** | Dev convenience only |

**Managed failure:** already fail-closed to open + message  -  removing legacy does **not** create Managedג†’generic fallback (none exists).

---

## E. Proposed convergence sequence (recommendation only  -  DO NOT IMPLEMENT)

| Stage | Recommendation |
|---:|---|
| **E0** | Freeze inventory (this report). Owner reviews. No deletions. |
| **E1** | Per-service Managed authoring for **simple** catalog (pilot: Clalit and/or Shufersal) via Phase 118/119 Analyze/Visual/readiness ג†’ live validate ג†’ `validated` ג†’ confirm tile uses Managed (adapterId unset) |
| **E2** | HTZone: decide **Managed-representable** vs **TEMPORARY EXCEPTION** (popup/DOM prep). Do **not** push popup prep into Managed core |
| **E3** | Medium allowlist cohort: Managed where single-page; else keep identity-first as exception or defer capability |
| **E4** | After each service switch + regression: clear obsolete `adapterId` / stop relying on generic for that service |
| **E5** | Only when no production dependents remain: retire generic as default; adapters last |
| **E6** | Health Monitoring / advanced login capabilities  -  **separate** future architecture (not 120.1) |

**Principle:** working path ג†’ Managed config ג†’ live validate ג†’ switch ג†’ regress ג†’ then remove obsolete path. No big-bang.

---

## Security boundaries (summary per fill path)

| Path | Credential ingress | Receiver | Origin / target policy | Auto-submit | Logging |
|---|---|---|---|---|---|
| Managed | Hub vault ג†’ async message | Extension Managed runner + GenericFillExecutor | `allowedOrigin` + Login Entry; top-frame | **No** | No credential values in user messages / prod logs |
| HTZone adapter | Hub maps email/password ג†’ `POC_FILL_IL` | `htzone-adapter.js` | HTZone login URL/host checks | **No** (adapter design) | DEV POC logs; avoid values |
| Generic | Hub field map ג†’ `POC_GENERIC_FILL` | generic-autofill + fill-executor | Open URL / generic session | **No** | DEV logs field ids only |
| Identity-first | Non-password identity fields ג†’ `POC_IDENTITY_FIRST_FILL` | identity-first-autofill.js | Allowlisted hosts | **No** | Diagnostic without credential values |
| Practice / POC | Demo credentials / vault | POC_FILL_DEMO / content `pocAutofill` | Localhost/demo | Demo-only | DEV |

---

## Classification roll-up

| Class | Mechanisms |
|---|---|
| **TARGET** | Managed Autofill |
| **MIGRATION CANDIDATE** | Legacy generic; identity-first medium; HTZone adapter (pending exception decision) |
| **TEMPORARY EXCEPTION** | LI complex open-only; possibly HTZone prep if not Managed-representable |
| **DEVELOPMENT / POC** | Practice adapter; `pocAutofill.ts`; `?pocAutofill=1` content hook |
| **DEAD / UNREACHABLE** | Empty `LEGACY_ADAPTER_ID_BY_SERVICE_ID` |

---

## AC-120.1 checklist

| AC | Status |
|---|---|
| AC-120.1-1 Inventory covers Managed, adapters, generic, identity-first, demo/POC, open-only | **PASS** |
| AC-120.1-2 Decision tree from current orchestrator with file refs | **PASS** |
| AC-120.1-3 Clalit / Shufersal / HTZone investigated | **PASS** (HTZone=adapter; Clalit/Shufersal=no dedicated impl) |
| AC-120.1-4 Every mechanism classified | **PASS** |
| AC-120.1-5 Sections Aג€“E present; E recommendation-only | **PASS** |
| AC-120.1-6 No production changes in 120.1 | **PASS** (Manager write = this artifact only) |
| AC-120.1-7 Report for Architecture Owner before migration slice | **PASS**  -  awaiting Owner review |

---

## Out of scope / STOP (unchanged)
- Any production code, flag, fallback, or adapter deletion/change  
- Managed runtime modification  
- Health Monitoring implementation  
- iframe / shadow / modal / multi-step  
- New service-specific product code  
- Implementing Section E  

---

## Manager Review (120.1  -  historical)
MANAGER_REVIEW_STATUS: **120.1 ACCEPTED** (Owner 2026-09-20)

### Review Notes
- Slice 120.1 inventory accepted (historical). Active work: **120.9 Authoring Locator Verification Integrity DD** at top of this file (**READY_FOR_APPROVAL**). **STOP** for Architecture review — no Developer handoff. Phase 120 Final Closure FROZEN.
