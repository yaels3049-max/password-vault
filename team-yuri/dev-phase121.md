# Developer Phase 121

## Phase Identifier
PHASE=121

## Status
STATUS: **D-121-72 (fill run ends on a closed tab; Admin «עצור» cancel; Hub run token + safety bound) — IMPLEMENTED, awaiting Architecture review** (2026-10-02). Delivered with G-122-11 (dev-phase122).
- Extension: a closed run tab → `{ok:false, reason:'tab_closed'}` (STANDARD and SPECIAL); `HUB_MANAGED_AUTOFILL_CANCEL` + runId → `cancelled` at the next checkpoint, tab kept; unknown / finished run → no-op. All run listeners and timers are detached at the end.
- Hub: `src/execution/fillRunControl.ts` (token per executionKey, `stopFillRun`, 260 s bound → `run_timeout`, late answers ignored). Admin «עצור» only while «ממלא…». Digital Home inherits tab_closed and the bound (neutral copy).
- New `verifyPhase121StopFillRun.mjs`: 16 checks, 7 mutations caught. `verifyPhase121Runtime.mjs` re-homed with `scripts/lib/phase121D72Edits.mjs` (A3 timeout re-pointed); `verifyPhase117ManagedAutofill.mjs` and `verifyPhase121FillTestGrid.mjs` re-pointed. END OF ROUND regression: all 62 Phase 116–122 verifies PASS. Extension changed → reload it. See the D-121-72 section below.  
D-121-71 — Previous status: **D-121-71 (partial occlusion: center + ≥3 points hit test; Visual click on an element over one input maps that input) — IMPLEMENTED, awaiting Architecture review** (2026-10-01).
- `managed-target-eligibility.js` `classifyHitTest`: PASS only when the center point is in view and passes `hitRelationshipOk`, and at least 3 in-view sample points pass. Otherwise the same `occluded` / `not_interactable` reasons. The <3-in-view rule, pointer-events:none and the single scrollIntoView retry are kept. Every caller (Analyze, Visual pick, fill-executor, validated-autofill) inherits it unchanged.
- `visual-target-pick.js` field branch: when the click target is not a control and no label resolves, `doc.elementsFromPoint(clientX, clientY)` in the same document; exactly one distinct identifiable fillable INPUT → the existing candidates / determinism / eligibility path; none or several → `unsupported_target`. Shadow / report_only / action paths unchanged.
- New `verifyPhase121PartialOcclusionPick.mjs`: 6 groups, 8 mutations caught. `verifyPhase121OwnLabelHit.mjs` re-pointed (bottom-only overlay is now PASS). Three byte-pinned verifies re-homed with `scripts/lib/phase121D71Edits.mjs`. Extension changed → reload it. See the D-121-71 section below.  
D-121-70 — Previous status: **D-121-70 (no post-fill observation window before a step transition: `skipPostRuntimeObserve`) — IMPLEMENTED, awaiting Architecture review** (2026-10-01).
- `validated-autofill.js` `runManagedAutofill`: `skipPostRuntimeObserve === true` skips the A2.4 `observePostRuntimeA24` chain (the 5 s diagnostic bound on `admin_test` / `digital_home`). A2.3 `observePostVerifyAsync` still runs; ok / reason / filled / fillDiagnostics otherwise unchanged. The A2.4 code itself is untouched.
- `background.js` `runSpecialLoginFlow` `fillInDocument`: sends the flag only when the step has an exit (`if (step.exit)`), so the transition is clicked right after the verified fill (R-2 unchanged). The last step (and a FLOATING / single step without an exit) keeps A2.4. STANDARD `runManagedAutofillOnTab` and every other caller never send it.
- New `verifyPhase121StepFillNoA24Wait.mjs`: 4 groups, 5 mutations caught. Two SHA-pinned verifies re-homed with the new revert helper `scripts/lib/phase121D70ValidatedAutofillEdits.mjs`. 61/61 verifies PASS; `tsc -b` / `npm run build` exit 0; `node --check` exit 0; no lints. Extension changed → reload it. See the D-121-70 section below.  
D-121-69 — Previous status: **D-121-69 (remove one mapped field in a SPECIAL step: «הסר מיפוי») — IMPLEMENTED, awaiting Architecture review** (2026-10-01).
- Each mapped row in the selected step's field list (MULTI_STEP, FLOATING_SCREEN; FSMS uses the same editor) gets «הסר מיפוי», next to «מיפוי חזותי». The press removes that one row from that step in the draft only; other steps, their rows, step exits and the opener are kept; readiness re-derived; the completeness line (with the D-121-67 step names) updates at once.
- The field then shows «—» in that step and can be re-mapped in any step (Analyze / «מיפוי חזותי»). login_fields untouched; the D-121-64 / 65 save guards unchanged (SPECIAL writes still omit the autofill keys).
- New `verifyPhase121RemoveFieldRow.mjs`: 3 groups, 8 mutations caught. No existing verify needed re-homing. 60/60 verifies PASS; `tsc -b` / `npm run build` exit 0; `node --check` exit 0; no lints. No extension change. See the D-121-69 section below.  
D-121-68 — Previous status: **D-121-68 + amendment (an id or name with a run of ≥ 8 digits is volatile; the volatile filter and the anchored fallback apply in every authoring candidate builder, all patterns) — IMPLEMENTED; Owner live PASS (eBay email `#userid`)** (2026-09-30).
- `locator-determinism.js`: `isUnstableId` adds `hasLongDigitRun` (`VOLATILE_DIGIT_RUN = 8`). New `isUnstableName`. `locatorReferencesUnstableId` also rejects `[name="…"]` with a digit run (fields + actions).
- `page-structure-inspect.js` / `visual-target-pick.js` `buildCandidates`: the filter (`locatorReferencesUnstableId`) and the anchored fallback run for every caller, no longer only with `stableLocators`. This covers STANDARD Analyze, the reveal readiness collectors (~298 / ~320), the action collector, the Visual field pick and `identifyActionTarget`. The anchored candidate is never dropped by the cap. Placeholder, form / test attrs, the shared aria-label rule and `STABLE_EXTRA_CANDIDATES` stay SPECIAL-only.
- eBay E1: `#susi_email10180167914112292` is never offered; the name (or the anchored fallback) is chosen and stays exact-one after a re-render with a new number. Existing mapping: re-run «זהה» or «מיפוי חזותי» on step 1.
- STANDARD consequence (per the amendment): generated ids already covered by D-121-48 (e.g. `mat-input-N`, trailing-counter siblings) are now skipped in STANDARD too. Stable ids / names → candidates byte-identical to before.
- Hub parity: nothing to mirror (`src/assistedMapping/locatorDeterminism.ts` only reads the extension's `matchCount`).
- New `verifyPhase121DigitRunIds.mjs`: 7 groups, 8 mutations caught. Three verifies re-homed; new revert helper `scripts/lib/phase121D68LocatorEdits.mjs`. 59/59 verifies PASS; `tsc -b` / `npm run build` exit 0; `node --check` exit 0; no lints. Extension changed → reload it. See the D-121-68 section below.  
D-121-67 — Previous status: **D-121-67 (per-step button panel, proposals per step, a failed re-test keeps a proven choice, step-named messages, per-step «מיפוי חזותי» re-map; parts A–E) — IMPLEMENTED, awaiting Architecture review; one finding on field labels (below)** (2026-09-30). Supersedes D-121-62.
- A: MULTI_STEP / FSMS show a per-step panel under «שלב נוכחי» with the selected step's saved exit: locator, location, status («נבחר» / «ממתין לבחירה» / «ממתין לבדיקה» / last outcome), «בדוק…», «זה לא הכפתור» (that step only) and «מיפוי חזותי». The last step shows «שלב אחרון — אין כפתור מעבר»; a middle step without an exit shows «אין כפתור מעבר» + «מיפוי חזותי». FLOATING_SCREEN keeps its single opener panel.
- B: a transition proposal is shown only while its step is selected. That step is the one that owns it in the draft, else the step it was proposed for. A stored exit is never shown twice; openers are always shown.
- C: a failed re-test of an action that was chosen before the press restores the pre-press draft (both flags kept) and shows the failure + «הבחירה הקודמת נשמרה…». An unchosen action still clears on failure. Openers and transitions alike.
- D: `checkSpecialDraft` (the completeness line and «בדיקת מילוי») names the step / button, e.g. «המיפוי לא מלא: כפתור המעבר של שלב 1 עדיין לא נבחר — בחרו «שלב 1» ובדקו אותו.» The place is found in the Hub copy layer by walking the plan in the validator's order; the validator is untouched (SHA pin holds).
- E: «מיפוי חזותי» writes the pick as that step's exit (or the FLOATING opener), not chosen → «ממתין לבדיקה» + «בדוק». Later steps and fields are kept; readiness is re-derived. A pick inside an unapproved frame is only proposed (R2).
- **Finding:** field labels are never named. Parse rejects an empty or badly framed mapping row, so a field-level validator failure never reaches the completeness line or «בדיקת מילוי» (the draft is unparseable first). Step-level gaps («שלב 3: כל שלב חייב…») are named.
- New `verifyPhase121StepButtons.mjs`: 4 groups, 20 mutations caught. Seven verifies re-homed. 58/58 verifies PASS; `tsc -b` / `npm run build` exit 0; `node --check` exit 0; no lints. No extension change. See the D-121-67 section below.  
D-121-65 — Previous status: **D-121-65 (a service-details save never re-writes the STANDARD mapping) — IMPLEMENTED; Architecture review PASS** (2026-09-29).
- `RegistryAdmin.tsx` handleSave: both edit paths (global and user-owned) send `editMetadata = withoutAutofillProfile(metadata)`. Create still sends the full builder metadata.
- `withoutAutofillProfile` now also drops the three autofill control keys (`autofillProfileAction`, `autofillLiveValidationApproved`, `autofillManagedReadinessProbePassed`), via the new `AUTOFILL_OWNED_KEYS`.
- Adding a required login field now saves. The stored profile is byte-identical, `metadata_version` is bumped (unchanged code), and the STANDARD grid still refuses an unmapped required field.
- **Finding:** `isVersionMatchedValidated` compares `validation.metadataVersion` with the profile's own `configVersion`; nothing reads the row's `metadata_version`. A byte-identical profile therefore stays version-matched, and the grid status line still reads «אושר». Users are protected anyway: `isManagedAutofillEligible` fails closed because `mappingsCoverRequiredSchema` is false. Meeting "the profile is version-mismatched" would require rewriting the profile, which contradicts "byte-identical" and "Phase 120 unchanged", so I didn't do it.
- New `verifyPhase121ServiceFormSave.mjs`: 6 groups, 7 mutations caught. 57/57 verifies PASS; `tsc -b` / `npm run build` exit 0; `node --check` exit 0; no lints. No extension change. See the D-121-65 section below.  
D-121-64 — Previous status: **D-121-64 (the SPECIAL save guard checks what the save writes) — IMPLEMENTED; Architecture review PASS (offline)** (2026-09-29).
- The fieldId + locator overlap rule is removed. Equal STANDARD / SPECIAL locators are allowed (Maccabi's ID on screen A).
- New guard `assertSpecialWriteKeepsAutofillProfile({ rowMetadata, patchMetadata })`:
  - `autofillProfile` absent from the patch → allowed (the registry write keeps the stored value).
  - Present → it must equal the row's value (structural, key order ignored) and carry no `frame` key. Otherwise the write is refused with the existing message.
  - Both SPECIAL-editor writers (`saveDraft`, `activateSpecial`) run it on the exact patch they send, before writing.
- Both writers now omit `autofillProfile` (new `withoutAutofillProfile`, next to `withoutLoginContractKeys`). Reason: a passthrough is re-planned by the unchanged autofill merge against the current login fields. After «סיסמה» is added, Maccabi's STANDARD profile (ID only) would fail with «יש למפות בורר CSS לכל שדה כניסה נדרש.», so the save would still be refused.
- The frame rule is split out as `assertNoFrameInAutofillMappings`. **Finding:** the STANDARD grid save has never called this rule; its write path drops a `frame` key while parsing (the key is never persisted). Unchanged, per scope.
- New `verifyPhase121SpecialSaveGuard.mjs`: 7 groups, 10 mutations caught. Two verifies re-homed (`SpecialDraftAuthoring`, `IframeSurface`) and the `ContractSafeSaves` sweep regex extended.
- 56/56 verifies PASS; `tsc -b` / `npm run build` exit 0; `node --check` exit 0; no lints. No extension change. See the D-121-64 section below.  
D-121-63 — Previous status: **D-121-63 (choice screens and repeated fields in MULTI_STEP, parts A–E) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- A: a middle MULTI_STEP step may have zero field mappings when it has an approved `intermediate_transition` exit. Step 1 and the last step still need at least one field each. The same rules apply, in the same order, in `validateSpecialPlanComplete`, `validateSpecialRunnable`, Ext `specialValidateRunPlan` and `checkSpecialDraft`. At runtime an action-only step skips the fill, still runs R1, then runs its transition.
- B: readiness into an action-only step = that step's exit (locator + frame, exact-one eligible, visible). This is accepted only in that case and never for the action itself. `deriveRevealReadiness` / `rederiveRevealReadiness` follow the same rule; until the exit is chosen, readiness stays the pending marker.
- C: the same fieldId may be mapped in more than one step (this replaces the 121.3 unique rule in the Hub gate and Ext). Required = the unique union of fieldIds. Each step's injection still receives only its own fieldIds. Readiness exclusion stays by locator + frame.
- D: the authoring reveal for a MULTI_STEP transition keeps the fresh-field path first. By the deadline it succeeds as `actions_only` only if the tested button is no longer exact-one eligible AND a vocabulary action (login / popup tiers) is eligible that was not eligible before the click. Otherwise failures and copy are unchanged. The Hub marks the revealed step action-only and runs auto-Analyze, and the follow-up panel proposes the choice screen's exit. FLOATING_SCREEN is unchanged.
- E: auto-Analyze on a later step skips a field already mapped earlier only when it is the same locator + frame. A different element (screen C's ID) is proposed and written.
- New `verifyPhase121ChoiceScreen.mjs`: PASS, 38 checks. Covers the A → B → C runtime in same-page and navigation variants, gate parity across 18 plans, authoring actions_only, derive, the editor Maccabi flow, and static / log checks. All 29 mutations caught. Seven older verifies re-homed. `verifyPhase121AnalyzeProposalQuality` R-e fixture deadline raised (a timing flake).
- 55/55 verifies PASS; `tsc -b` / `npm run build` exit 0; `node --check` exit 0; no lints. **Reload the extension.** See the D-121-63 section below.  
121.3 — Previous status: **121.3 MULTI_STEP execution (R-1, R-2, R-3, R-4, R-6, R-7; R-5 removed) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- R-1: one runtime gate `validateSpecialRunnable` (Hub `runtimeGate.ts`) + the same rules in the same order in Ext `specialValidateRunPlan`. MULTI_STEP = no preamble, 2–4 steps, every non-last step has an approved `intermediate_transition` exit, the last has none, css mappings in one frame per step, readiness = a declared field of the next step (not self, not a field of its own step), each fieldId in exactly one step. FLOATING_SCREEN unchanged; FSMS → `pattern_not_supported_yet`; reserved kinds first.
- R-2: one generic step loop inside `runSpecialLoginFlow` (no second engine): [opener → readiness] (FLOATING only), then per step: fill + verify (unchanged runner and retries) → if exit: click exact-one (MAIN world) → declared readiness of the next step. Last step → STOPPED_FOR_USER; never submits. Click / readiness deadlines capped by the operation deadline.
- R-3: R1 (tab URL origin + live top origin) before every click and every fill attempt; declared frames via `resolveDeclaredFrame`; after a transition a tab that can't be probed yet is "not ready" until the deadline; a foreign origin → `origin_mismatch`.
- R-4: required = union of every step's fieldIds (Hub `buildSpecialCredentialSubset` + Ext); each step's page injection receives only its own subset.
- R-6: stage `transition`; `stepId` + `actionId` on every outcome; `transition_missing` / `transition_ambiguous` / `readiness_timeout` (with the step). Admin copy «המילוי נעצר בשלב N: …» (multi-step plans only); FLOATING_SCREEN copy unchanged.
- R-7: «בדיקת מילוי» runs FLOATING_SCREEN and MULTI_STEP, temp inputs = all steps. «אשר מיפוי» only when the saved draft passes the runtime gate; FSMS → «אישור לסוג כניסה זה יתאפשר בשלב מאוחר יותר.»
- New `verifyPhase121MultiStepRuntime.mjs`: 9 fixtures + gate parity (21 plans) + credentials / copy / UI / static / log checks, 18 mutations caught. Five older verifies re-homed (anchors / renamed gate / FSMS as the "later" example). FLOATING_SCREEN 121.2 verify unchanged in behavior (35 checks PASS).
- 54/54 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. **Reload the extension.** See the 121.3 section below.  
D-121-61 — Previous status: **D-121-61 (address a frame by its source when it has no name) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- `frame-correlation.js` `frameLocatorCandidates`: after id / name / title / aria-label (order and candidates unchanged):
  - (a) `iframe[src^="<origin><path>"]`: taken from an absolute HTTPS `src` attribute, query / hash dropped;
  - (b) the D-121-48 anchored structural locator (nearest stable ancestor + `iframe`).
  - Both are kept only if exact-one (existing `exactOneFrameLocator`); otherwise the frame stays unaddressable (fail-closed).
- The CAL-shaped nameless frame is now addressed and scanned. Fields are revealed in it and held for «אשר מסגרת» (cross-origin, A2 unchanged).
- Stored descriptor shape unchanged; no contract / validator change. `resolveDeclaredFrame` still enforces exact-one + depth-1 + live origin; a src locator never replaces the origin check.
- New reveal reason `surface_frame_not_addressable`: a visible depth-1 frame with no exact-one locator appeared after the click and nothing else fresh → «המסך נפתח, אבל השדות נמצאים במסגרת שהמערכת לא יכולה לאתר.» The panel status follows (A1 pattern). `surface_not_login` and a real reveal still win.
- New `verifyPhase121FrameBySource.mjs`: 5 unit + 6 end-to-end + 4 static, 13 mutations caught. New revert libs `phase121D61CorrelationEdits.mjs` / `phase121D61BackgroundEdits.mjs`. The `verifyPhase121Runtime` SHA pins (frame-correlation.js and background.js) still hold.
- 53/53 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. **Reload the extension.** See the D-121-61 section below.  
D-121-60 — Previous status: **D-121-60 (the authoring click is never held up by a frame that does not answer) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- Root cause (code + fixture; live trace pending): in reveal mode the click ran only after pre-click discovery finished. Discovery was a chain of unbounded `executeScript` callbacks: an all-frames probe, the three-step nonce handshake on all frames, and an inject + inspect in each visible depth-1 frame. The Hub waited with no timeout. One frame that never answers (for example a cross-origin frame that never reaches document_idle) stopped the chain: no click and no reply. That matches PayPal («בדוק» does nothing on the site, while `#btnNext.click()` works from the console). The fixture with bounding removed reproduces exactly that (M1).
- Fix (bounding + ordering only), authoring click only: every discovery / gesture call is bounded (`SPECIAL_AUTHORING_CALL_TIMEOUT_MS = 2500`).
  - A frame that does not answer is skipped for discovery (fail-closed: skipped frames are never compared, so there are no false positives).
  - An all-frames probe timeout falls back to the top document (correlation reported unavailable).
  - The click target frame (declared) and the gesture watch fail closed with an explicit reason, never skipped.
- Hub wait = readiness timeout + `AUTHORING_CLICK_HUB_MARGIN_MS` (90 s), which is ≥ the extension's worst case (19 × 2.5 s + 0.85 s + tab-gate headroom). With no answer → `authoring_click_no_response` (default copy).
- Service-worker trace `[D-121-60 authoring-click]` shows stage, elapsed ms and counts / reasons only.
- Unchanged: `clickInFrame` (MAIN, exact-one, `.click()`), origin checks, R3 reveal semantics, gesture proof, declared-mode readiness poll, runtime callers. No manifest / permission change; no site branches.
- New `verifyPhase121AuthoringClickBounded.mjs`: 11 cases + 4 static, 11 mutations caught. New revert lib `phase121D60BackgroundEdits.mjs` (22 exact pairs; the `verifyPhase121Runtime` SHA pin still holds). `verifyPhase121DeclaredFrameReadiness` sandbox re-homed.
- 52/52 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. **Reload the extension.** See the D-121-60 section below.  
D-121-59 — Previous status: **D-121-59 + A1 (password requirement follows the site's login fields; one message per click failure reason) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- The editor sends `requirePasswordSurface` only for FLOATING_SCREEN **and** a site login field with `type === 'password'` (new `requirePasswordSurfaceFor`). Password-less screens (CAL: ID + card digits) are accepted on any fresh eligible credential input; sites with a password field are unchanged (G8 kept).
- A1 copy: `surface_not_revealed` → «המסך לא נפתח» (unchanged); `surface_not_login` → «המסך נפתח, אבל לא נמצא בו שדה סיסמה — ייתכן שזה לא מסך הכניסה.»; `readiness_timeout` → «השדה הממופה לא הופיע אחרי הלחיצה — ייתכן שהמסך לא נפתח, או שהשדה הממופה שגוי.» Other reasons unchanged. The panel status line follows the same split.
- No extension / contract / validator / runtime / manifest / permission change; no site branches.
- New `verifyPhase121PasswordlessSurface.mjs` (end to end: editor → Hub click → real `background.js` click handler): 3 pure + 5 groups + 2 static, 6 mutations caught through the end-to-end path alone. Four older verifies re-homed (string anchors only).
- 51/51 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-59 section below.  
D-121-58 — Previous status: **D-121-58 (multi-step: a tested transition creates the step it reveals) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- MULTI_STEP / FLOATING_SCREEN_MULTI_STEP: a transition tested while step N is selected becomes step N's `exitTransition` (single slot); step N+1 is created empty if missing. It no longer goes to `preambleActions`.
- Transition readiness: the first mapping of step N+1 that is not a step-N field (declared); otherwise the pending marker → reveal mode (a field present before the click never satisfies it). The PayPal false positive (declared on step 1's own `#email`) is impossible.
- On test success the selector moves to step N+1, and auto-Analyze writes into the revealed step. Fields already mapped on an earlier step are not written again on a later step.
- `manualAnalyzeMayWriteFields`: step N+1 of a multi-step pattern takes manual «נתח» fields only after step N's transition is chosen (both flags). FLOATING_SCREEN and FSMS openers are unchanged.
- Legacy drafts: a MULTI_STEP / FSMS preamble `intermediate_transition` moves to `steps[0].exitTransition` inside `normalizeLegacyDraftReadiness` (draft only).
- No validator / contract / runtime / extension / manifest / permission change. FSMS ordering is unambiguous (opener in the preamble → step 1; transitions → step exits).
- New `verifyPhase121MultiStepTransition.mjs`: 7 pure + 5 behavior groups + 2 static, 12 mutations caught. `verifyPhase121FloatingFieldsAfterOpener.mjs` P1 re-homed.
- 50/50 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-58 section below.  
D-121-57 — Previous status: **D-121-57 (accessibility controls are never proposed first) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- Added `'נגישות'`, `'נגיש'`, `'accessibility'`, `'accessible'` to the negative list of `ACTION_INTENT_VOCABULARY`, in the Hub (`specialActionIntent.ts`) and the identical extension copy (`page-structure-inspect.js`).
- A popup-semantics accessibility toggle now ranks negative (tier 4, low) instead of popup (tier 2).
- R-a is unchanged (login is checked before negative on both sides), so El Al's «התחברות» with the «…לנגיש…» aria-label stays first.
- New `verifyPhase121AccessibilityNotOpener.mjs`: vocabulary + parity + 6 site-shaped fixtures + Hub + scope checks, 5 mutations caught.
- `verifyPhase121InspectReadinessEligible.mjs` scope pin: it now strips the four authorized lines before hashing; the pinned hash is unchanged.
- 49/49 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-57 section below.  
D-121-56 — Previous status: **D-121-56 (floating screen: fields come only from the opened screen) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- FLOATING_SCREEN / FLOATING_SCREEN_MULTI_STEP, the step the opener reveals (`steps[0]`): manual «נתח» writes field proposals only once a floating opener is chosen (successful «בדוק»).
- Before that, «נתח» proposes the opener only. Main-page field proposals (top-document, framed, held) are not written, not held and don't touch readiness, so «בדוק» runs in reveal mode. No new copy.
- After the test: auto-Analyze and later manual «נתח» work as today. Field Visual, MULTI_STEP, later FSMS steps, STANDARD and saved / ACTIVE plans are unchanged.
- Files: `specialActionBar.ts` (new `manualAnalyzeMayWriteFields`) and `SpecialLoginDraftEditor.tsx` (`runSpecialAnalyze`, manual mode only).
- New `verifyPhase121FloatingFieldsAfterOpener.mjs`: 5 pure checks + 6 behavior groups + 3 static, 8 mutations caught.
- 48/48 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-56 section below.  
D-121-55 — Previous status: **D-121-55 (SPECIAL «אשר מיפוי» fail-closed on a read-back of the stored row; write diagnostics) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- «המיפוי אושר» now appears only after the stored row is read back and `resolveActiveLoginContract(row)` is SPECIAL with the version this approval wrote and the approved content. Otherwise the editor shows «אישור המיפוי נכשל.» with the raw reason under a collapsed «פרטים טכניים».
- `updateGlobalRegistryRow` now returns `{ updatedRows, writerUserId, writtenSpecialVersion }` via `.select('id')` on the update. It logs `[D-121-55 registry contract write]` (modes / row count / writer prefix only). The editor logs `[D-121-55 approve]`.
- Root cause: the client merge is proven correct (replay: payload carries activation + active, read-back SPECIAL). The loss is at the database write or later. The leading hypothesis is an update that RLS matched to 0 rows, which returns no error; it is not proven live yet. The Owner re-run with the new diagnostics settles it (steps below).
- Files: `adminRegistryApi.ts`, `SpecialLoginDraftEditor.tsx`, new `specialApproveReadback.ts`, `mappingStatus.ts` (export only). STANDARD approval untouched; no contract / validator / runtime / manifest / permission change.
- New `verifyPhase121ApproveReadback.mjs`: 21 checks, 11 mutations caught. `verifyPhase121ApproveSavedOnly.mjs` stub answers the read-back.
- 47/47 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-55 section below.  
D-121-54 — Previous status: **D-121-54 (Analyze uses the same exact-one choice as Visual, all patterns) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- Some HIGH / MEDIUM rows have a locator that is not exact-one. Such a row now takes the first exact-one candidate of the same observed input: same order and rule as Visual `preferExactOneLocator`, i.e. inspect `matchCount === 1`. The row is marked deterministic only if such a candidate exists; otherwise it keeps today's «אינו חד-משמעי» result.
- The row never switches to another input, and its confidence is unchanged. The conflict checks and the 120.9 gate run on the final locators.
- `src/assistedMapping/safetyValidation.ts` + `locatorDeterminism.ts` (new `preferExactOneCandidate`). No extension / runtime / contract change.
- New `verifyPhase121AnalyzeExactOne.mjs`: 7 check groups, 10 mutations caught.
- `verifyPhase120LocatorVerification.mjs` R2 / R12 re-homed: the duplicate-id case is exactly S1. The "no exact-one → no prefill" assertions now use the same input without any exact-one candidate.
- 46/46 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-54 section below.  
D-121-51 C2 — Previous status: **D-121-51 C2 revised («מחיקת אתר» dialog: full-delete wording for built-in; impact lines as notices, not errors) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- New built-in line: «אתר מובנה: יימחק לגמרי, גם אצל המשתמשים. הוא יחזור רק אם יוסף מחדש, במצב ההתחלתי וללא מיפוי.» The old «יחזור למצב ההתחלתי» line is removed.
- The impact line is the same for all sites: «האתר קיים אצל N משתמשים — הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו.» / «האתר לא נמצא אצל אף משתמש.».
- Impact and built-in lines now use the existing amber notice style `admin-gate-login-banner`. `admin-error` is reserved for failures.
- `DeleteServiceDialog.tsx` only; no SQL / logic change.
- `verifyPhase121DeleteService.mjs` extended: 4 check groups, 43 mutations caught (+6).
- 45/45 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-51 C2 section below.  
D-121-53 — Previous status: **D-121-53 («אין שינויים לשמירה» line under the action buttons of «מיפוי אתר רגיל») — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- STANDARD shows «אין שינויים לשמירה — המיפוי במסך זהה למיפוי השמור.» only when «שמור מיפוי» is disabled solely because nothing changed. It is hidden when save is enabled, while busy, and on a structural failure.
- SPECIAL gets no line (Owner decision `standard_only`): its «שמור מיפוי» is only `disabled={busy}`, so "no changes" never blocks it.
- Copy in `mappingCopy.ts`; `AutofillProfileEditor.tsx` only; `canSave` and the dirty logic are unchanged.
- New `verifyPhase121NoChangesToSave.mjs`: 4 check groups, 7 mutations caught.
- 45/45 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-53 section below.  
D-121-51 C1 — Previous status: **D-121-51 C1 («מחיקת אתר» errors in plain Hebrew; raw text only under «פרטים טכניים») — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- One mapping covers both the impact call and the delete call:
  - function missing (PGRST202) → «מחיקת אתרים עוד לא הופעלה במסד הנתונים (חסר עדכון מסד נתונים). לא נמחק דבר.»
  - not admin → «אין הרשאת מנהל למחיקה.»
  - name mismatch → «השם שהוקלד לא תואם לשם האתר.»
  - anything else → «המחיקה נכשלה. לא נמחק דבר.»
- When the impact check failed, «אי אפשר למחוק כרגע — הבדיקה של השפעת המחיקה נכשלה.» appears under the name input; the button stays disabled.
- `DeleteServiceDialog.tsx` + `adminRegistryApi.ts`; no SQL change.
- `verifyPhase121DeleteService.mjs` extended: 4 check groups, 37 mutations caught (+10).
- 44/44 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-51 C1 section below.  
D-121-50 C1 — Previous status: **D-121-50 C1 («שדות כניסה» hints follow the control's state) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- The «ערך מותר» hint now follows the selected value: «כל תו» → «אפשר להקליד אותיות, ספרות וסימנים.», «ספרות בלבד» → «המערכת תדחה אותיות ותווים שאינם ספרות (למשל ת"ז).».
- The password checkbox hint is prefixed «כשמסומן: ».
- Copy only, `src/admin/CredentialFieldsEditor.tsx`; no stored-shape change.
- `verifyPhase121CredentialFieldCopy.mjs` extended: 7 check groups, 19 mutations caught (+3).
- All 40 Phase 116–121 verifies PASS (+ Phase 101 / 102 / 109 / 113 PASS); `tsc -b` / `npm run build` exit 0; no lints. See the D-121-50 C1 section below.  
D-121-52 — Previous status: **D-121-52 (Analyze inspect readiness waits for Managed-eligible inputs, all patterns) — IMPLEMENTED, awaiting Architecture review** (2026-09-29).
- `collectSafePageStructureWithReadiness` now exits early only when ≥1 input is `managedEligible` and no `visible:true` input is still `managedEligible:false`. Otherwise it keeps polling within the existing 250 ms / 10 s bounds, and on timeout it returns the last snapshot exactly as today.
- The readiness report adds `eligibleInputs` / `visibleIneligibleInputs` (counts only).
- `extension/generic/page-structure-inspect.js` only.
- New `verifyPhase121InspectReadinessEligible.mjs`: 5 check groups, 7 mutations caught. The pre-slice code, rebuilt by the new revert helper `scripts/lib/phase121D52ReadinessEdits.mjs`, reproduces the M1 result.
- One harness fixture updated in `verifyPhase119ReadinessWaitInputs.mjs` (eligibility stub; assertions unchanged).
- All 40 Phase 116–121 verifies PASS (+ Phase 101 / 102 / 109 / 113 PASS); `tsc -b` / `npm run build` exit 0; no lints. See the D-121-52 section below.
- Queue note: the arch queue is D-121-50 C1 → D-121-52 → D-121-51. D-121-51 was already implemented earlier today, and D-121-50 C1 and D-121-51 C1 are not started (not part of this request).  
D-121-51 — **Architecture PASS with C1 required** (arch file, 2026-09-29); D-121-51 C1 not started. Previous D-121-51 status: **D-121-51 (Admin «מחיקת אתר»: permanent delete with impact dialog, typed confirmation, audit, Storage cleanup and client reconciliation R1/R2) — IMPLEMENTED** (2026-09-29). New migration `20260929120000_phase121_admin_delete_service.sql` (**not applied by the developer**; Owner applies it, see the section). `admin_service_delete_impact` / `admin_delete_service` run as security definer, admin-only (`public.is_admin()`) and in one transaction, and write an audit row. After success the Admin client removes the Storage objects best-effort. On hydrate and sync, clients drop service ids missing from the registry and never re-upsert them; built-in ids that were re-seeded are present again, so they are kept. The site card gets a danger button with an impact dialog and typed-name confirmation. New `verifyPhase121DeleteService.mjs`: 4 check groups, 27 mutations caught. No existing verify changed. All 39 Phase 116–121 verifies PASS (+ Phase 101 / 102 / 109 / 113 PASS); `tsc -b` / `npm run build` exit 0; no lints. See the D-121-51 section below.  
D-121-50 + A1 — **Architecture PASS (offline)** (2026-09-29). Previous D-121-50 status: **D-121-50 + A1 («שדות כניסה» editor: self-explanatory field controls) — IMPLEMENTED** (2026-09-29). Each field shows, in order and each with a hint line: «שם השדה», one checkbox «זה שדה הסיסמה של האתר» (⇔ type password; on change it also writes masked), «ערך מותר» («כל תו» / «ספרות בלבד»), «חובה למלא», and «מזהה טכני» under a collapsed «מתקדם». The «תפקיד מילוי (מתקדם)» select and the «מוסתר» checkbox are removed. The legacy exception: a non-password field stored with masked true shows «מוסתר בתצוגה» until cleared. The stored shape is unchanged, and fields the Admin doesn't touch stay byte-identical. `src/admin/CredentialFieldsEditor.tsx` only. New `verifyPhase121CredentialFieldCopy.mjs`: 7 check groups, 16 mutations caught. No existing verify needed a change. All 38 Phase 116–121 verifies PASS (+ Phase 102 schema verify PASS); `tsc -b` / `npm run build` exit 0; no lints. See the D-121-50 section below.  
Previous: D-121-45 C1 (SPECIAL grid: manual-pick buttons irrelevant to the selected pattern are not rendered) — IMPLEMENTED, awaiting Architecture review (2026-09-29). FLOATING_SCREEN hides «סמנו בעצמכם את כפתור המעבר בין השלבים», MULTI_STEP hides «סמנו בעצמכם את כפתור פתיחת המסך הצף», FLOATING_SCREEN_MULTI_STEP shows both. The only rule is the existing `manualPickRelevant`. A rendered button keeps today's enabled / disabled logic. UI only. `verifyPhase121GridStructure.mjs` extended: 7 check groups, 12 mutations caught. 1 superseded assertion re-homed in `verifyPhase121ActionBar.mjs`. All 37 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-45 C1 section below.  
D-121-45 — **Architecture PASS (offline)** (2026-09-29). Accepted residual: switching SPECIAL→STANDARD discards unsaved SPECIAL edits (pre-existing behavior; backlog). Previous D-121-45 status: **D-121-45 (Admin grid structure: one cross-cutting «אופי הכניסה» grid + one mapping grid for the selected pattern) — IMPLEMENTED** (2026-09-29). New `LoginPatternGrid` holds the pattern selector, its explanation, the shared status line of the selected pattern and the collapsed «פרטים טכניים» (no authoring controls). The selection is owned by `RegistryAdmin`. «מילוי אוטומטי מנוהל» is renamed «מיפוי אתר רגיל» and shown only for STANDARD (SPECIAL-selected notice removed). The SPECIAL grid is shown only for a SPECIAL pattern, titled «מיפוי מסך צף» / «מיפוי כניסה רב־שלבית» / «מיפוי מסך צף רב־שלבי». «בדיקת מילוי» unchanged. UI composition only. New `verifyPhase121GridStructure.mjs`: 6 check groups, 10 mutations caught; 9 superseded assertions updated in 4 verifies (listed in the section). All 37 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the D-121-45 section below.  
D-121-49 — **Architecture PASS (offline)** (2026-09-29). Previous D-121-49 status: **D-121-49 (a hit inside the target's own label is not occlusion; Visual click inside a label resolves to its fillable control, G11) — IMPLEMENTED** (2026-09-29). The Managed V8 hit test also passes when the hit element is inside a `<label>` whose labeled control is the target (`for=` or nested); every other covering element stays `occluded`, and exact-one, 5-point sampling, pointer-events, viewport and the scroll retry are unchanged. Visual pick (SPECIAL + STANDARD) maps a click inside a label to its control when that control is a fillable text-like input; then the existing locator rules apply (D-121-48 stable locators in SPECIAL). Runtime unchanged: it writes to the resolved target and never clicks a label. New `verifyPhase121OwnLabelHit.mjs`: 5 check groups, 7 mutations caught. All 36 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. D-121-45 not started. See the D-121-49 section below.  
Previous D-121-48 status: **D-121-48 (SPECIAL authoring never anchors locators on generated ids, G9) — IMPLEMENTED, awaiting Architecture review** (2026-09-29). SPECIAL Analyze, SPECIAL field Visual and SPECIAL opener / transition pick no longer choose framework counter / hash ids (e.g. `#mat-input-4`) or locators referencing them; they fall back to name → autocomplete → formcontrolname / data-test → aria-label (unless shared by many elements) → placeholder → anchored structural locator. Gated by an explicit `stableLocators` option passed only from the three SPECIAL call sites in `background.js`; STANDARD candidates are byte-for-byte the pre-slice output. New `verifyPhase121StableLocators.mjs`: 8 check groups, 8 mutations caught. All 35 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. D-121-45 not started. See the D-121-48 section below.  
D-121-47 — **Architecture PASS (offline)** (2026-09-29). Previous D-121-47 status: **D-121-47 (Analyze proposal quality G5–G8 + guards R-a…R-f) — IMPLEMENTED** (2026-09-29). Analyze proposes only the kind the pattern uses (G6), reads visible text / aria-label / title separately and shows the visible text (G5), uses a whole-word generic vocabulary with login / negative words (G7), and ranks login+popup → login → popup → plain → negative in both the extension (before the 40 cap) and the Hub (R-f, R-a). A single-step FLOATING_SCREEN «בדוק» now passes only when a password field appears (G8; top document or depth-1 frame, incl. frames held for «אשר מסגרת»); otherwise «המסך לא נפתח». Manual pick, saved drafts, ACTIVE, the 121.2 runtime, Digital Home, contract, manifest and permissions unchanged. New `verifyPhase121AnalyzeProposalQuality.mjs`: 12 check groups, 15 mutations caught. All 34 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. D-121-45 not started. See the D-121-47 section below.  
D-121-46 Amendment A1 — **Architecture PASS (offline)** (2026-09-29). Previous A1 status: **D-121-46 Amendment A1 (pattern-irrelevant actions never kept) — IMPLEMENTED** (2026-09-29). A FLOATING_SCREEN draft keeps no `intermediate_transition` (preamble or `exitTransition`, chosen or not); a MULTI_STEP draft keeps no `floating_opener`; FLOATING_SCREEN_MULTI_STEP keeps both. One shared relevance helper (`actionKindRelevantForPattern`, used by `manualPickRelevant`). Applied in the upsert and inside the A1 normalization (load / save / pattern change / completeness / fill test / approve); ACTIVE untouched. `verifyPhase121SingleOpener.mjs` extended: 11 check groups, 10 mutations caught. All 33 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See the A1 section below.  
D-121-46 base — **Architecture PASS (offline) for the opener slot** (2026-09-29). Base status: A SPECIAL draft now holds at most one `floating_opener`: a new opener replaces the old one in place, and a chosen action removes the unchosen actions of its kind. Legacy drafts with a stale candidate plus a chosen opener are normalized inside the A1 normalization, which covers editor load, «שמור מיפוי», completeness, «בדיקת מילוי» and «אשר מיפוי» (ACTIVE never touched). Validation strictness, contract, runtime, extension, manifest and STANDARD are unchanged. New `verifyPhase121SingleOpener.mjs`: 7 check groups, 6 mutations caught. All 33 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. D-121-45 not started. See section below.  
Previous: D-121-43 CORRECTION C1 (SPECIAL «אשר מיפוי» approves only the saved mapping) — implemented (2026-09-29). SPECIAL «אשר מיפוי» is disabled while the editor has unsaved changes (same rule as STANDARD `!hasUnsavedChanges`), and approval reads the saved draft from the row, never the editor state. New `verifyPhase121ApproveSavedOnly.mjs`: 4 behavior checks + 1 static, 3 mutations caught. All 32 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See section below.  
D-121-43 — **Architecture PASS with C1** (2026-09-28). Previous D-121-43 status: The SPECIAL editor now uses the STANDARD words: «שמור מיפוי» / «אשר מיפוי», with no «טיוטה» / «הופעל» / «(DRAFT)». The completeness line is automatic (the «בדוק שהטיוטה מלאה» button is removed). «שלב נוכחי» appears only for multi-step patterns, labelled «שלב N». Both editors share one status line from one copy module, with technical fields in a collapsed «פרטים טכניים». «בדיקת מילוי» has no context selector: it runs the saved mapping of the selected «אופי הכניסה». Internal names, storage, contract, runtime, Digital Home, extension and manifest are unchanged. New `verifyPhase121UnifiedVocabulary.mjs`: 6 check groups, 10 mutations caught. All 31 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See section below.  
D-121-42 — **Architecture PASS (offline)**.  
Previous D-121-42 status: STANDARD field Visual now has the same 60 s bound + 5 s Hub grace, page disarm on timeout / cancel / Hub give-up / any early answer, the same in-progress indicator and «ביטול» button, the same copy, and token-guarded late-response ignore. It uses one shared session helper and one shared copy module. New `verifyPhase121UniformVisualPick.mjs`: 13 checks, 8 mutations caught. All 30 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. See section below.  
D-121-41 (Admin manual pick unrestricted; skip-link rule narrowed to Analyze) — implemented, awaiting Architecture review; section below.  
D-121-40 (collapse technical details in «בדיקת מילוי») — implemented, awaiting Architecture review; section below.  
121.2-impl RESUME with D-121-39 — implemented; Owner live 121.2 recorded in the arch file (Mizrahi / PAGI / STANDARD PASS). SPECIAL FLOATING_SCREEN runtime (one engine for Digital Home + Admin Test), the D-121-39 opt-in declared-frame mode of the Phase 120 runner, and `verifyPhase121Runtime.mjs` (35 checks, 12 mutations caught). All 29 Phase 116–121 verifies PASS; `tsc -b` / `npm run build` exit 0; no lints. Owner live = Admin Test DRAFT only (**do not press ACTIVATE**). See section below.  
121.2-impl BLOCKED (RT-0 CALL OUT) — resolved by D-121-39 (Option 1); section retained below.  
D-121-38 Part A (unified Admin Test grid «בדיקת מילוי») **Architecture PASS (offline)**; Owner live (a)/(b) pending.  
D-121-37 («בדוק שהטיוטה מלאה» visible result feedback) delivered, see section below.  
D-121-36 (declared-frame readiness: loading ≠ foreign) delivered, see section below.  
D-121-35 (opener / transition identification G1–G4) **Architecture PASS (offline)**; Owner live checks 1, 2, 4, 5 PASS, G4 check pending (blocked by the D-121-36 race).  
D-121-34 CORRECTION (test-then-choose, §4.15) **Architecture PASS / CLOSED**.  
D-121-33 (contract-safe saves, §4.14) + D-121-32a **Architecture PASS / CLOSED** (state-c exception accepted as final).  
D-121-32 (button-approval panel, §4.13): delivered; approval button superseded by D-121-34.  
D-121-31 (top buttons, §4.12): delivered, see section below.  
D-121-30 (action bar, §4.11) + A3 **Architecture PASS / CLOSED**.  
D-121-29 (frame correlation handshake), 121.1-IF-impl, D-121-21 … D-121-27, **§4.6** and **§4.7** evidence retained below. **121.0-impl CLOSED** (not reopened).  
**121.3 IMPLEMENTED** (FLOATING_SCREEN + MULTI_STEP run). **121.4+ NOT AUTHORIZED** (FLOATING_SCREEN_MULTI_STEP fails closed as `pattern_not_supported_yet`; D-121-62 not included).  
Final Phase 121 Acceptance remains **OPEN / PENDING** (Owner re-runs L-1 / L-2 / L-3 after Architecture PASS)  
Phase 120 STANDARD path **unchanged** (frozen)

---

# Slice D-121-72 — Fill run ends on a closed tab, Admin «עצור», Hub safety bound (2026-10-02)

## What changed
- `extension/background.js`
  - `openGenericRealSiteTab` owns a run handle (`active()`, `later(fn, ms)`). Every run timer and listener is tracked and detached in `finishSession`.
  - With a `hubRunId`, the run is registered in `hubFillRuns`, and a `chrome.tabs.onRemoved` listener for the run tab ends it with `{ok:false, reason:'tab_closed'}`. A second run with the same `hubRunId` → `busy`.
  - New router message `HUB_MANAGED_AUTOFILL_CANCEL` + `runId` → `cancelHubFillRun`: the run ends with `{ok:false, reason:'cancelled'}`. The tab is not closed. An unknown or finished run → no-op (`{ok:true, cancelled:false}`).
  - STANDARD (`runManagedAutofillOnTab`) and SPECIAL (`runSpecialLoginFlow`) check `run.active()` at every checkpoint (before each probe / click / readiness poll / fill, and in each `executeScript` callback). Retries use `run.later`, so nothing is scheduled after the end.
- New `src/execution/fillRunControl.ts`: one run token per `executionKey` and lane (managed / special), plus `acquireFillRun` → `{token, race, release}`, `stopFillRun` and the end-reason copy.
  - The Hub bound `FILL_RUN_HUB_BOUND_MS` = longest tab load (120 s) + longest run operation (120 s) + 20 s margin = 260 s. With no answer by then, the lock is released with `run_timeout`, the cancel is sent, and any late answer is ignored.
- `managedAutofill.ts` and `specialLoginFlow.ts` take the lock from `fillRunControl` (the in-flight Sets / `withTimeout` are gone); `runId` = the token. New `stopAdminFillTest(serviceId)`.
- Admin «בדיקת מילוי» (`AdminFillTestGrid.tsx`): «עצור» is shown only while running, next to «ממלא…». It sends the cancel and releases the lock immediately; the result card shows «הבדיקה נעצרה.» (a notice, not an error). tab_closed → «הכרטיסייה נסגרה — הבדיקה הופסקה.»; timeout → «הבדיקה לא הסתיימה בזמן — נסו שוב.».
- Digital Home inherits tab_closed and the bound with neutral copy («המילוי האוטומטי הופסק.» / «המילוי האוטומטי לא הסתיים בזמן. נסו שוב.»). There is no «עצור» in Digital Home.
- No manifest / permission change. No site / hostname / serviceId branches. final_submit untouched.

## Decisions / deviations
- "No fill after cancel" = no `executeScript` is issued after the cancel. A call already in flight cannot be recalled; its callback hits a checkpoint and does nothing.
- SPECIAL Hub timeout is now `run_timeout` with no entry opened (before: A3 `extension_unavailable` + entry opened). `verifyPhase121Runtime.mjs` A3 fast-timeout scenario re-pointed accordingly; A3 still covers no response / unknown_message / no_message.
- The Hub bound also sends the cancel, so the extension stops the run too.
- `verifyPhase117ManagedAutofill.mjs` AC-117-36 re-pointed from `managedAutofillInFlightKeys` to `acquireFillRun('managed', executionKey)`.
- SPECIAL Admin tab_closed / timeout show through `SpecialTestResultView` (detail line includes the reason); no step prefix for these reasons.

## Verify
- New `scripts/verifyPhase121StopFillRun.mjs`: the REAL `background.js` (chrome mocked, timers tracked) + the REAL Hub modules (one esbuild bundle, bridge routed to the mock extension). 16 checks:
  - E1 STANDARD tab closed mid-wait → `tab_closed`, all listeners / timers detached, no fill after; E2 cancel mid-wait → `cancelled`, tab still open, nothing issued after the cancel; E3 unknown / finished run cancel → no-op; E4 SPECIAL 2-step, tab closed between steps → `tab_closed` (Admin + Digital Home copy).
  - H1 «עצור» releases the lock, a new run is allowed; H1b a late answer is ignored; H2 Hub bound (shortened) releases the lock for STANDARD + SPECIAL, Admin + Digital Home copy; H3 Digital Home tab_closed neutral copy; H4 constants; static (no manifest change, no site branches).
  - Mutations (7, all caught): onRemoved only logs; cancel ignored; checkpoints removed (STANDARD); checkpoints removed (SPECIAL); late answer not ignored; no Hub bound; stop never sends the cancel.
- Byte-pinned verify: `scripts/lib/phase121D72Edits.mjs` reverts this slice (`background.js` outside the SPECIAL block / SPECIAL block / `managedAutofill.ts`) back to the pre-slice bytes; `verifyPhase121Runtime.mjs` applies it before its pins (`managedAutofill.ts` sha `451a747c…`).
- `verifyPhase122AdminWorkspace.mjs`: new groups `checkStopFillTest` and `checkNotesBidi` (see dev-phase122 G-122-11).
- Re-pointed: `verifyPhase121FillTestGrid.mjs` — its `managedAutofill` stub now also exports `stopAdminFillTest` (the full regression caught the missing export).
- END OF ROUND full regression (all 88 `scripts/verify*.mjs`): all 62 Phase 116–122 verifies PASS (122 Admin Workspace: 30 check groups, 71 mutations caught), and Phase 101 FailureMode / 102 / 103 / 104 / 108 (5) / 109 / 110 / 111 / 112 (2) / 113 PASS. 9 pre-existing failures, not touched by this slice: `verifyPhase101Supabase` and `verifyPhase102Registry` need the live Supabase (`fetch failed`, not run against the live DB); `verifyPhase105DigitalHome`, `106SecurityTrust`, `107Admin`, `108CustomDiscovery`, `108FalsePositiveGate`, `108LivePath` assert legacy files / wiring that no longer exist; `verifyPhase112IdentityFirst` fixture fill (`identity_step_not_found`) runs the generic fill scripts, none changed since 2026-09-29. `node --check`, `npx tsc -b`, `npm run build` exit 0; no lints. 0 `node_modules/.tmp/pv-*` dirs left.

## Owner live steps
1. `chrome://extensions` → reload the extension.
2. Admin → Dropbox → «בדיקה והפעלה» → «כניסה לאתר ומילוי שדות», then close the opened tab → «הכרטיסייה נסגרה — הבדיקה הופסקה.»; «כניסה לאתר ומילוי שדות» is enabled again and a new run starts.
3. Run again, then «עצור» → «הבדיקה נעצרה.»; the site tab stays open and no field is filled after the stop.

---

# Slice D-121-71 — Partial occlusion: hit test + Visual point pick (2026-10-01)

## What changed
- `extension/generic/managed-target-eligibility.js` `classifyHitTest` → `evaluate()`: center not in view → `not_interactable`; center hit fails → `not_interactable` (no hit) / `occluded`; then the passing in-view points are counted; `≥ 3` → PASS, otherwise the reason follows the first failing hit (null → `not_interactable`, else `occluded`). `samplePoints`, `hitRelationshipOk` (incl. the D-121-49 own-label rule), the <3-in-view rule, pointer-events:none and the one bounded `scrollIntoView` retry are unchanged.
- `extension/generic/visual-target-pick.js`: new `pointFillableControl(doc, event)` (exported in `__visualTargetPickHelpers`), called after `labelFillableControl` in the field branch only. It reads `doc.elementsFromPoint(event.clientX, event.clientY)` and returns the single distinct identifiable INPUT of a `FILLABLE_INPUT_TYPES` type; none / several / no coordinates / no API → null → `unsupported_target` as before. The resolved input then goes through candidates → exact-one → determinism → `managedEligibleFor` unchanged.
- No change to manifest / permissions, callers, background.js, Hub.

## Decisions
- With a rectangular viewport, ≥3 of the 5 points in view implies the center is in view, so the center-in-view branch is defensive only.
- Order: direct control → own label (D-121-49) → click point. A direct input or label click never calls `elementsFromPoint`.

## Verify
- New `scripts/verifyPhase121PartialOcclusionPick.mjs` (REAL eligibility / locator / pick scripts in linkedom; mocked `elementFromPoint` / `elementsFromPoint`; clientX / clientY on the click):
  - Hit test: bottom-only overlay → PASS; 2 edge points covered (3 pass) → PASS; center overlay → occluded; 3 of 5 points (center visible) → occluded; full modal → occluded; null hits → not_interactable; own-label hits still pass. Guards: pointer-events:none, <3 in view, one scroll retry, `isSafeFillTarget` / `classifyManagedIneligibility`.
  - Pick (STANDARD and SPECIAL): overlay over one input → that input, eligible; one call with the click coordinates; duplicates count once; non-fillable inputs ignored; direct input / label click unchanged. Two inputs / no input / only a checkbox / empty stack / no coordinates → `unsupported_target`; occluded center → `managed_ineligible` / `occluded`. report_only, shadow, action paths unchanged and never call `elementsFromPoint`.
  - Static: manifest unchanged; eligibility minus D-121-71 then D-121-49 = HEAD; visual-target-pick minus D-121-71 = pre-slice SHA `0a6a8bb4…`; no site branches; fill-executor / validated-autofill / page-structure-inspect / background unchanged by this slice.
  - Mutations (8): center requirement dropped; all points required; threshold 2; first input taken; eligibility skipped after point resolution; point fallback removed; fillable-type filter dropped; duplicates counted twice.
- Re-pointed: `verifyPhase121OwnLabelHit.mjs` — one edge point on an overlay is now PASS; a center overlay is asserted occluded instead.
- Re-homed (pinned eligibility bytes, D-121-71 reverted before D-121-49): `verifyPhase121Runtime.mjs`, `verifyPhase121InspectReadinessEligible.mjs`, `verifyPhase121IframeSurface.mjs`.

## Owner live steps
1. `chrome://extensions` → reload the extension.
2. Admin → Yahav → Analyze («זהה») or «מיפוי חזותי» on «סיסמה» (a click on the forgot-password element (`div.forgotpwd`) over the field also maps it).
3. «בדיקת מילוי»: the password field is filled (no `occluded`); no submit.

---

# Slice D-121-70 — No post-fill observation window before a step transition (2026-10-01)

## What changed
- `extension/generic/validated-autofill.js` `runManagedAutofill`: `var skipA24 = Boolean(options && options.skipPostRuntimeObserve === true);` and the A2.4 condition becomes `(path === 'admin_test' || path === 'digital_home') && !skipA24`. A2.3 (`post_verify_microtask` / `_raf` / `_timeout_0`) still chains first. `observePostRuntimeA24`, `A24_BOUND_MS` and the stamps are unchanged.
- `extension/background.js` `runSpecialLoginFlow` → `fillInDocument`: after `runOptions` is built, `if (step.exit) runOptions.skipPostRuntimeObserve = true;`.
- No change to STANDARD / FLOATING single-step fills, other `runManagedAutofill` callers, contract, gates, Hub, manifest / permissions.

## Decisions
- "Has an exit" is the plan's own marker (`plan.steps[index].exit`, set by the runtime validator for every step before the last). A FLOATING plan's only step has no exit → A2.4 kept, as today.
- Only a strict `true` skips (a truthy non-boolean does not).
- `afterVerifiedFill` / `runTransition` are unchanged: the click still follows a verified fill (R-2); only the wait for the diagnostic-only window is gone.

## Verify
- New `scripts/verifyPhase121StepFillNoA24Wait.mjs` (REAL page scripts in linkedom, REAL `background.js`, mock chrome.* only; A2.4 bound set to 500 ms through the existing `__ManagedA24.setBoundMs` hook):
  - Page level (`admin_test`, `digital_home`): ok / reason / filled / detail / path identical with and without the flag; without it, A2.4 stamps and the bound wait are present; with it, no `post_runtime_a24*` stamps and it resolves in under half the bound; A2.3 stamps present; every non-A2.4 stamp identical in order. A non-`true` value keeps A2.4; the `unknown` path is unchanged.
  - Orchestrator (MULTI_STEP same-page, `admin_test` and `digital_home`): step 1 sends the flag, its result has no A2.4 stamps, and the `#next` click lands under half the bound after the fill starts; step 2 (last) sends no flag and keeps its A2.4 stamps; order fill → click (value present) → fill; one click, no submit.
  - STANDARD: a direct `runManagedAutofillOnTab` call sends no flag; A2.4 stamps present.
  - Static: exactly one flag site in `background.js`, inside `runSpecialLoginFlow`, exit-guarded; no Hub `src` mention; `validated-autofill.js` minus the recorded D-121-70 edit = pre-slice SHA `37b0358a…`; manifest unchanged; no site branches.
  - Mutations (5): N1 flag ignored (bound waits again); N2 flag also skips A2.3; N3 flag also sent on the last step (A2.4 stamps missing); N4 flag never sent; N5 flag sent from the STANDARD path.
- Re-homed (pinned validated-autofill.js bytes): `verifyPhase121Runtime.mjs`, `verifyPhase121InspectReadinessEligible.mjs` revert D-121-70 via `revertD12170ValidatedAutofillEdits` before comparing.

## Regression
- 61/61 verifies PASS; `npx tsc -b` / `npm run build` exit 0; `node --check` on `extension/background.js` and `extension/generic/validated-autofill.js` exit 0; no lints.

## Owner live steps
1. `chrome://extensions` → reload the extension.
2. Admin → a MULTI_STEP service (e.g. eBay) → «בדיקת מילוי»: after step 1 is filled, the transition («Continue» / «Next») is clicked right away (no ~5 s pause); step 2 fills as before; no submit.
3. Optional: Digital Home on the same service → same immediate transition.

---

# Slice D-121-69 — Remove one mapped field in a SPECIAL step (2026-10-01)

## What changed
- `src/admin/specialActionBar.ts`: `SPECIAL_FIELD_ROW_HE.remove` «הסר מיפוי»; `removeStepFieldMapping(draft, stepId, fieldId)` = `rederiveRevealReadiness(upsertStepFieldMappings(draft, stepId, rows without fieldId))`; no such step / row → the same draft.
- `src/admin/SpecialLoginDraftEditor.tsx`: in the «מיפוי שדות» list (which follows «שלב נוכחי»), a mapped row shows «הסר מיפוי» (`data-action="special-remove-field"`, `data-field-id`) after «מיפוי חזותי»; `removeFieldRow` writes the draft for `currentStepId` only and clears the success line.
- No change to the contract, parse, validator, runtime gate, extension, manifest, STANDARD editor, save path or guards.

## Decisions
- Draft only: nothing is written until «שמור מיפוי»; «אשר מיפוי» is disabled while the draft is dirty (existing), and stays disabled after save while the completeness check fails.
- A middle step whose last row is removed but that keeps its exit becomes an action-only step (valid, as in D-121-63); the last step (or the FLOATING step) with no row gives «שלב N: כל שלב חייב לכלול מיפוי שדות שאינו ריק.».
- Readiness pointing at the removed row re-derives (e.g. to the next action-only exit or to the next field of the revealed step); the action keeps its identity and chosen flags, as with every existing re-derive.

## Verify
- New `scripts/verifyPhase121RemoveFieldRow.mjs` (REAL editor with the minimal hooks runtime, REAL action bar / loginContract):
  - Pure: eBay shape (step 1 `#userid` + `#pass`, step 2 OTP, step 3 password) → removing step 1 password keeps steps 2 / 3 and all exits byte-identical; input not mutated; no-op for an unknown row / step; step 1 exit readiness re-derives when step 2's row goes; last row of step 3 → «המיפוי לא מלא: שלב 3: …»; FLOATING: opener byte-identical, or re-derived readiness when its row goes.
  - Editor: button only on mapped rows of the selected step; removal shows «—»; completeness updates immediately; re-map in step 3 via «מיפוי חזותי»; save round-trip; reload after save keeps the removal; unsaved removal discarded on reload; «אשר מיפוי» blocked (unsaved, and on the gap after save); FLOATING remove + opener kept; the write carries no login_fields and no autofill keys.
  - Static: only the SPECIAL editor uses it; no site branches; manifest / validator / gate / parse / types unchanged.
  - Mutations (8): removal across all steps; readiness not re-derived; exits dropped; exits un-chosen; opener dropped; whole step cleared; editor ignores «שלב נוכחי»; button never shown.

## Regression
- 60/60 verifies PASS; `npx tsc -b` / `npm run build` exit 0; `node --check extension/background.js` exit 0; no lints.

## Owner live steps (eBay, no delete)
1. Open eBay's SPECIAL grid, select «שלב 1»: the password row shows `#pass` with «הסר מיפוי» → press it (the row shows «—»).
2. Select «שלב 2», open the password page on the site and map the password (Analyze or «מיפוי חזותי»).
3. «שמור מיפוי» → the completeness line reads «הבדיקה המבנית תקינה.» → «בדיקת מילוי» (email on step 1, password on step 2, no submit).

---

# Slice D-121-68 — Long digit runs make an id or name volatile, all patterns (2026-09-30)

## What changed
- `extension/generic/locator-determinism.js`:
  - `VOLATILE_DIGIT_RUN = 8`, `hasLongDigitRun(value)`; `isUnstableId` = framework patterns ∨ long hex ∨ **long digit run** ∨ counter siblings.
  - `isUnstableName(name)` (exported). `locatorReferencesUnstableId` returns true for `[name="…"]` whose value has a digit run, besides the existing id references.
  - Comments: the filter and the anchored fallback are for all patterns; the other helpers stay SPECIAL-only.
- `extension/generic/page-structure-inspect.js` and `extension/generic/visual-target-pick.js` `buildCandidates`:
  - `volatileFilter = global.LocatorDeterminism` for every caller; `stable` (the SPECIAL extras) still requires `{ stableLocators: true }`.
  - `push` skips any locator with `locatorReferencesUnstableId`; when nothing is exact-one + identity, `anchoredStructuralCandidates` is appended (uncapped).
- No change to runtime resolution (`fill-executor.js`, `validated-autofill.js`), saved mappings, contract, gates, `background.js` call sites, manifest / permissions, or the Hub.

## Where the rules live / call sites now filtered
- Rules: `locator-determinism.js` (`isUnstableId`, `isUnstableName`, `locatorReferencesUnstableId`, `anchoredStructuralCandidates`).
- Filtered in both builders, so every call site: `collectSafePageStructure` (STANDARD + SPECIAL Analyze fields), `collectSpecialEligibleCredentialLocators` / `collectSpecialEligibleCredentialInputs` (reveal readiness), `collectSpecialAuthoringActionCandidates` (with or without the option), Visual field pick (STANDARD no mode; FLOATING_SCREEN / SPECIAL mode `pick`), `identifyActionTarget`.

## Decisions
- The name rule lives inside `locatorReferencesUnstableId` (the attribute walk already parses `[name="…"]`), so one filter covers ids and names in both builders.
- The anchored candidate bypasses the candidate cap, so the fallback is never lost on an action with many candidates.
- Per the amendment, the D-121-48 id rules now apply in STANDARD too. A STANDARD control with a framework / counter id now gets its name / autocomplete / aria-label or the anchored locator; a control with nothing stable left is not offered.
- Hub: no file mirrors candidate building or the unstable-id rule; nothing changed there.

## Verify
- New `scripts/verifyPhase121DigitRunIds.mjs` (real page scripts in linkedom; the pre-slice scripts via the revert helper as the regression reference):
  - Rule: `susi_email10180167914112292`, `susi_email12345678` unstable; `step2`, `field_2024`, `otp6`, `user1234567` stable; names likewise; `[name=…]` / `#id` / `[for]` detection.
  - eBay E1 (STANDARD and FLOATING_SCREEN / SPECIAL; Analyze and Visual pick): name chosen when present; otherwise `form.signin-form input[type="email"]`, exact-one after a re-render with a new number.
  - `name="email_1234567890"` dropped → `#id` / `input[autocomplete="email"]`; the action name dropped (builder, `identifyActionTarget`, collector).
  - Reveal readiness collectors: anchored, never volatile. No candidate left → not offered.
  - Regression: stable ids / names and ≤ 7-digit runs → byte-identical to the pre-slice builders (all option combinations, fields + actions, Analyze page).
  - Scope: revert of the recorded edits = the pinned pre-slice `locator-determinism.js`; runtime / manifest / Hub / background call sites unchanged; no site branches.
  - Mutations (8): threshold 8 → 9, 8 → 7, digit-run id rule removed, name rule removed, filter re-gated to SPECIAL only (Analyze, Visual), anchored fallback removed for STANDARD (Analyze, Visual).
- Re-homed:
  - `verifyPhase121StableLocators.mjs`: the STANDARD proof is now "stable ids → pre-slice; generated ids → pre-slice minus volatile + anchored"; the collector without the option also skips `#mat-button-1`; M2 / M2b now mean "SPECIAL extras leak into STANDARD" (a placeholder-only fixture added), plus M2c / M2d "filter re-gated to SPECIAL only"; M6 anchor updated.
  - `verifyPhase121OwnLabelHit.mjs`: STANDARD click on the own label → `input[name="username"]` (generated id skipped).
  - `verifyPhase121InspectReadinessEligible.mjs`: reverts the D-121-68 edits before its SHA pins.

## Regression
- 59/59 verifies PASS; `npx tsc -b` / `npm run build` exit 0; `node --check` (background + the three page scripts) exit 0; no lints.

## Owner live steps (eBay, no delete)
1. Reload the extension.
2. Open eBay's SPECIAL grid, step 1: «זהה» (or «מיפוי חזותי» on the email field). The email locator is no longer `#susi_email…`.
3. «שמור מיפוי» → «בדיקת מילוי»: the email fills on step 1 (no `zero_match`).

---

# Slice D-121-67 — Per-step buttons, kept choices, step-named messages, re-map (2026-09-30)

## What changed
- `src/admin/specialActionBar.ts`:
  - Copy: `SPECIAL_BUTTON_PANEL_HE.statusNeedsTest` «מצב: ממתין לבדיקה», `statusKeptAfterFailure`, `keptAfterFailure`, `remap` «מיפוי חזותי»; `SPECIAL_STEP_BUTTON_HE` (title «כפתור המעבר של שלב N», `lastStep`, `noExit`, `remapped`).
  - `ActionTestOutcome` + `'kept_after_failure'`. `actionStatusHe(action, outcome, inDraft = false)`: a stored action with neither flag → «ממתין לבדיקה»; a proposal → «ממתין לבחירה» (unchanged).
  - `stepButtonView(draft, stepId)` → exit / last / none. `proposalShownOnStep({ draft, action, proposedForStepId, currentStepId })`.
  - `remapStepExit` (`placeTransitionAsStepExit` + unchosen + `rederiveRevealReadiness`), `remapFloatingOpener` (`upsertPreambleAction` + unchosen + rederive), `clearStepExit` (that step only + rederive).
  - `locateDraftGap(plan, code)` + `draftGapDetailHe(plan, code, message)` + `SPECIAL_GAP_PLACE_HE`. `checkSpecialDraft` uses them for the incomplete message.
- `src/admin/SpecialLoginDraftEditor.tsx`:
  - `proposalSteps` state (`rememberProposalStep` on manual Analyze, follow-up, top-bar visual pick); both proposal panels render only when `proposalShown(action)`.
  - `renderStepButtonPanel()` under the «שלב נוכחי» select (multi-step only): `data-panel="step-exit"`, test button `data-slot="step"`, reject → `rejectStepExit`, `renderRemapButton`.
  - `testAndChooseAction(slot | 'step', stepExit)`: `wasChosen` read before the press; on failure an unchosen action clears (unchanged), a chosen one restores the pre-press draft + outcome `kept_after_failure` + the kept copy. `showTestedAction` updates a proposal slot only for the same action.
  - `remapStoredButton({ stepId } | 'opener')`: armed Visual pick (same as the top bar) → writes via `remapStepExit` / `remapFloatingOpener`; a frame not yet approved → proposal only. The opener panel shows «מיפוי חזותי» next to «זה לא הכפתור».
  - `rejectAction`: a shown multi-step transition proposal is never a stored exit, so nothing is removed from the draft (another step's same element is never touched).
- No change to the contract, parse, validator, runtime gate, extension, manifest, STANDARD, fill-test flow or the D-121-64 / D-121-65 guards.

## Decisions
- D: the validator returns only a code. Every earlier step / action in its order passed all checks, so the first one matching the returned code's condition is the failing one. `locateDraftGap` walks steps → exits → preamble with that condition (the declared-readiness condition mirrors the action-only rule). A code with no place (`emptySteps`, `missingPattern`, `floatingNeedsOpener`) keeps the validator Hebrew.
- D (finding): field labels are not named. `parseLoginFlowPlanDocument` rejects an empty or badly framed row, so `emptyFieldMappings` / `invalidFrame` on a single field never reach the validator through the snapshot. The label plumbing would be dead code, so it was not added.
- Owner case: when B's exit («כניסה עם סיסמה») is un-chosen, the validator fails «המשך»'s readiness first (it falls back to the pending marker). The message then reads «כפתור המעבר של שלב 1: תנאי המוכנות…», which is true to the validator order.
- B: the owner step decides first (a proposal equal to a stored exit shows in that step's panel only), so the per-step panel is the single place to test / reject / re-map a stored exit.
- E: the pick is written unchosen; `placeTransitionAsStepExit` keeps later steps (it only creates the next step when missing). Proposals holding the replaced exit are dropped.
- C: `setDraft(draft)` (the pre-press draft) keeps both flags and readiness byte-identical.

## Verify
- New `scripts/verifyPhase121StepButtons.mjs` (REAL editor with the minimal hooks runtime, REAL action bar / loginContract / `executeAdminSpecialLoginFlowTest`):
  - Pure: panel view on the Maccabi 3-step plan; statuses; proposals per step; re-map keeps later steps + fields, unchosen, readiness re-derived; `clearStepExit` with the same element on two steps; step-named messages for each code (validator order; two gaps → the first; action-only readiness).
  - Editor: panel follows «שלב נוכחי» (step 1 «המשך», step 2 «כניסה עם סיסמה», step 3 last); a proposal is hidden on other steps; a failed re-test keeps the draft byte-identical + kept copy + kept status; «מיפוי חזותי» → «ממתין לבדיקה» + completeness names step 1 → «בדוק» chooses it; «זה לא הכפתור» on step 2 only → «אין כפתור מעבר» + re-map; an unchosen failure still clears; FLOATING opener re-map + kept choice.
  - Fill test: «המיפוי לא מלא: כפתור המעבר של שלב 1…» and «…שלב 3: כל שלב חייב…».
  - Static: no site branches; manifest / validator / gate / parse / types unchanged.
  - 20 mutations caught (MA1–4, MB1–2, MC1–4, MD1–5, ME1–5).
- Re-homed: `ActionBar` (step-named incomplete message, status call), `TestThenChoose` (panel render / status / reject anchors), `MultiStepTransition` + `ChoiceScreen` (re-test of a stored exit via `data-slot="step"`), `SpecialDraftAuthoring`, `IframeSurface`, `SingleOpener` (unchanged anchors re-checked).

## Regression
- 58/58 verifies PASS; `npx tsc -b` / `npm run build` exit 0; `node --check extension/background.js` exit 0; no lints.

## Owner live steps (Maccabi, no delete)
1. Open Maccabi's SPECIAL grid. Select «שלב 1» → the panel shows «המשך» with its location and status.
2. Open the login page, type the ID, press «בדוק» once. If the site already moved on, the choice stays («הבחירה הקודמת נשמרה…»).
3. «שמור מיפוי» → the completeness line reads «הבדיקה המבנית תקינה.»; «בדיקת מילוי» (ID on A, ID + password on C, no submit) → «אשר מיפוי» → Digital Home.
4. Also: on a step, «מיפוי חזותי» → click the button on the site → status «ממתין לבדיקה» (the completeness line names that step) → «בדוק».

---

# Slice D-121-65 — Service-details save never re-writes the STANDARD mapping (2026-09-29)

## What changed
- `src/admin/contractSafeMetadata.ts`:
  - New `AUTOFILL_OWNED_KEYS` = `autofillProfile` + `autofillProfileAction` + `autofillLiveValidationApproved` + `autofillManagedReadinessProbePassed`.
  - `withoutAutofillProfile` drops all four. The SPECIAL writers (D-121-64) use the same helper; stored rows never contain the control keys (both merge branches strip them), so their payloads are unchanged in practice.
- `src/admin/RegistryAdmin.tsx` handleSave:
  - After the unchanged builder (`...withoutLoginContractKeys(form.metadata)`, `loginEntryType`, `loginUrlSource`, `credentialMode`): `const editMetadata = withoutAutofillProfile(metadata);`.
  - `updateGlobalRegistryRow(selectedId, { …, metadata: editMetadata, … })` and `updateUserOwnedRegistryRow(selectedId, { …, metadata: editMetadata })`.
  - `createGlobalRegistryRow({ …, metadata })` unchanged.

## Decisions
- User-owned edit included: it shares the builder. That path writes `{...existing.metadata, ...patch.metadata}` directly (no autofill re-plan), so the old passthrough could overwrite the stored profile with the form's possibly stale copy. Omitting the key keeps the stored value.
- Control keys are omitted too. On a patch without `autofillProfile`, `updateGlobalRegistryRow` skips the autofill branch, which is the only place that strips them. A form copy carrying them would otherwise persist them.
- **Finding: the spec expects "the profile is version-mismatched", but it is not.**
  - `isVersionMatchedValidated(profile)` = `profile.validation.metadataVersion === profile.configVersion`, both inside the profile. The row's `metadata_version` (bumped by the unchanged L532 when login fields change) is not read by it, or by anything else in src.
  - So with a byte-identical profile: `isVersionMatchedValidated` stays true, and `standardMappingStatus` (the grid status line) still reads «אושר» while the active contract is STANDARD.
  - Users are protected: `isManagedAutofillEligible` → `mappingsCoverRequiredSchema` = false (the required field has no mapping) → managed STANDARD autofill fails closed.
  - In the grid, the new field's row shows an empty locator. Re-mapping it saves and demotes the profile to `unsupported`, i.e. «נשמר — עדיין לא אושר למשתמשים», which is Phase 120 behavior.
  - Making the profile itself stale would mean rewriting it (e.g. bumping `configVersion` or demoting `supportState`). That contradicts "byte-identical" and "do not change Phase 120 behavior", so it's not done. If the grid status should say «צריך מיפוי מחדש» when required fields are uncovered, that is a `standardMappingStatus` change needing authorization.
- Unchanged: STANDARD grid save validation, SPECIAL paths (D-121-64), merge guard, contract, runtime, extension, manifest / permissions. No site branches.

## Verify
- `node scripts/verifyPhase121ServiceFormSave.mjs`: PASS (6 groups, 7 mutations caught). It runs the real handleSave code (from the metadata builder to the end of the try / finally, transpiled) with the real `createGlobalRegistryRow` / `updateGlobalRegistryRow` / `updateUserOwnedRegistryRow` on an in-memory Supabase fake.
  - Global edit: a service with a validated STANDARD profile (ID only) gets a required «סיסמה», with the form also holding the three control keys. Result:
    - «האתר עודכן.»; `autofillProfile` byte-identical; control keys not persisted; `metadata_version` 1 → 2;
    - login fields saved; name / primary URL / login URL / status / icon / entry type / credential mode saved;
    - `isVersionMatchedValidated` true (pinned, see finding); `mappingsCoverRequiredSchema` false; managed autofill eligible before, not after (fail-closed).
  - User-owned edit with a stale profile in the form → stored profile byte-identical; form fields saved.
  - Create → receives the full builder metadata (sentinel + profile kept); row created.
  - STANDARD grid (real builder + api): an unmapped required field → `missingRequiredMapping`; a full re-mapping saves (validated → unsupported).
  - Evidence: the old passthrough patch + new login fields reproduces Owner M3.
  - Static: the builder still strips contract keys; both edits send `editMetadata`; create sends `metadata`; the helper covers the four keys; no site tokens.
  - Mutations, all caught:
    - MR1 / MR2: global / user-owned edit re-sends the profile.
    - MR3: create omits it.
    - MK1: helper keeps the control keys.
    - MK2: helper keeps the profile.
    - MV1: `metadata_version` bump removed.
    - MG1: grid `missingRequiredMapping` check removed.
- No existing verify needed re-homing: the `ContractSafeSaves` anchor `...withoutLoginContractKeys(form.metadata),` is kept, and `SpecialSaveGuard` still passes.

## Regression
- 57/57 verifies PASS. `npm run build` (incl. `tsc -b`) exit 0, `node --check extension/background.js` exit 0, no lints. No extension change.

## Owner live steps
1. Any service with a saved regular mapping (e.g. Maccabi) → service form → add a required login field (e.g. «סיסמה») → «שמור» → «האתר עודכן.» (no «יש למפות בורר CSS…»).
2. «פרטים טכניים»: `metadata_version` went up by one.
3. Regular grid: the new field's row has no selector. Note: the status line still reads «אושר» if the regular mapping was approved (see finding); users are not filled by the regular mapping until it is re-mapped. Mapping the new field and saving turns it into «נשמר — עדיין לא אושר למשתמשים».

# Slice D-121-64 — SPECIAL save guard checks what the save writes (2026-09-29)

## What changed
- `src/loginContract/specialDraftAuthoring.ts`:
  - `assertNoSpecialDualWriteToAutofill` (frame rule + fieldId + locator overlap) removed.
  - New `assertNoFrameInAutofillMappings(mappings)`: the 121.1-IF frame rule, unchanged.
  - New `assertSpecialWriteKeepsAutofillProfile({ rowMetadata, patchMetadata })`:
    - no `autofillProfile` key in the patch → ok;
    - key present while the row has none → refused (added; this includes `undefined`, because the registry write would then plan a new profile);
    - value not structurally equal to the row's → refused (changed, or removed via `null` / `undefined`);
    - equal but containing a `frame` key → refused.
  - Message `SPECIAL_AUTOFILL_WRITE_FORBIDDEN_HE` = the existing «אסור לכתוב מיפויי SPECIAL לתוך autofillProfile.fieldMappings.». All three are exported via `index.ts`.
- `src/admin/contractSafeMetadata.ts`: new `withoutAutofillProfile(metadata)`.
- `src/admin/SpecialLoginDraftEditor.tsx`:
  - `saveDraft` and `activateSpecial` build `const patch = { metadata: withoutAutofillProfile({ … }) }`, run the guard on `patch.metadata` against `row.metadata`, and only then call `updateGlobalRegistryRow(row.id, patch)`.
  - On refusal: `saveDraft` shows the error; `activateSpecial` shows it as the approve failure. Nothing is written.
  - The read of the saved STANDARD profile (`readAutofillProfileFromMetadata`) is removed from the save path.
  - Payload contents are otherwise unchanged: stripped contract keys + `loginFlowPlan: { draft }` for save; row metadata + draft + intent for approve.

## Decisions
- **Omit rather than pass through.** `updateGlobalRegistryRow` re-plans `autofillProfile` whenever the patch contains the key (`mergeAutofillProfileMetadata`, action `save`). That re-plan:
  - (a) re-serializes the profile;
  - (b) validates it against the current login fields. Maccabi's STANDARD profile maps only the ID. Once «סיסמה» (required) is added, a passthrough fails with `missingRequiredMapping`, so the Owner's «שמור מיפוי» would still fail.
  - With the key omitted, the merge keeps the stored value verbatim (byte-identical) and the autofill block is skipped. This is the same mechanism `withoutLoginContractKeys` relies on. The guard still accepts an identical passthrough, as the spec allows.
- **Frame rule on the STANDARD grid (finding for the Architect):** no src path called the frame rule on the grid save. `AutofillProfileEditor.persist` → `buildGridProfileMetadataPatch` → `mergeAutofillProfileMetadata` → `coerceProposedMappings` keeps only `fieldId / locatorType / locator`. So a `frame` key is dropped and never persisted, but it is not rejected. That path is unchanged, per scope ("STANDARD save path semantics unchanged"). The rule exists as `assertNoFrameInAutofillMappings`, and the SPECIAL guard uses it. If the grid should *refuse* instead of drop, that is a STANDARD-path change needing authorization.
- Unchanged: STANDARD grid save, the merge guard (strict), contract, runtime, extension, manifest / permissions. `final_submit` reserved. No site / host / serviceId branches.

## Verify
- `node scripts/verifyPhase121SpecialSaveGuard.mjs`: PASS (7 groups, 10 mutations caught). It runs the editor's real write code (sliced from `saveDraft` / `activateSpecial`), the real guard, and the real `updateGlobalRegistryRow` (autofill merge + contract merge) on an in-memory Supabase fake. Fixture: generic two-screen ID + password site; STANDARD validated profile maps `idNumber → #idNumber`, the same as SPECIAL step 1.
  - SPECIAL save → saved, with ID-only login fields and with «סיסמה» (required) added. `autofillProfile` is byte-identical in the row and in the written payload; `loginFlowPlan.draft` is written; other keys are kept.
  - Approve → SPECIAL live, `autofillProfile` byte-identical, intent not persisted.
  - Guard:
    - allowed: omitted, reference passthrough, deep-equal passthrough in a different key order;
    - refused: changed mapping, added mapping, changed `supportState`, profile added to a row without one, `undefined` key on a row without one, removed (`null` / `undefined`), frame written, frame passed through;
    - a stored frame that is not re-sent → allowed.
  - Editor: a tampered patch → `saveDraft` / `activateSpecial` show the message, no write, and the row is unchanged.
  - Frame rule: rejects `frame`, allows plain / none. The STANDARD grid save (real builder + api) persists no `frame`.
  - Evidence: an old-shape passthrough patch is refused by the autofill merge after «סיסמה» is added.
  - Static:
    - the overlap rule and the old function are gone from src;
    - both writers omit `autofillProfile` and run the guard before writing;
    - no saved-profile read in the save path;
    - grid / merge / validatedProfile / adminRegistryApi / extension don't reference the guard.
  - Mutations, all caught:
    - MG1: no deep-equal.
    - MG2: allow a key on a row without a profile.
    - MG3: no frame check in the guard.
    - MG4: key-order-sensitive compare.
    - MG5: overlap rule restored.
    - MF1: frame rule removed.
    - ME1 / ME3: save / approve pass `autofillProfile` through.
    - ME2 / ME4: save / approve ignore the guard.
- Re-homed (no behavior loss):
  - `verifyPhase121SpecialDraftAuthoring`: the AC-121.1-7 case uses the new guard (a patch adding a mapping → refused), plus a new check that a shared locator is allowed; the wiring needle is now the new guard.
  - `verifyPhase121IframeSurface`: the frame case calls `assertNoFrameInAutofillMappings`.
  - `verifyPhase121ContractSafeSaves`: the sweep regex also matches the `const patch = { metadata: withoutAutofillProfile({ ...(row.metadata ?? {})` shape. It still requires exactly one row-metadata re-send (ACTIVATE SPECIAL).

## Regression
- 56/56 verifies PASS. `npm run build` (incl. `tsc -b`) exit 0, `node --check extension/background.js` exit 0, no lints. No extension change (no reload needed for this slice).

## Owner live steps
1. Maccabi service settings → login fields: add «סיסמה» (the password checkbox «זה שדה הסיסמה של האתר»). This is a service setting, not code.
2. SPECIAL editor, step 3 → «זהה» → password identified (ID `#idNumber2` already mapped).
3. «שמור מיפוי» → saved (no «אסור לכתוב…» message).
4. «בדיקת מילוי» → ID filled on screens A and C, password on C, no submit.
5. «אשר מיפוי» → «המיפוי אושר» → Digital Home.
6. Optional: the STANDARD grid status stays as before. The STANDARD profile is untouched by the SPECIAL save / approve.

# Slice D-121-63 — Choice screens and repeated fields in multi-step (2026-09-29)

## What changed
- `src/loginContract/validateSpecialPlan.ts`:
  - `emptyFieldMappings` is allowed for a middle MULTI_STEP step that has an exit (A). Step 1, the last step and FLOATING_SCREEN / STANDARD still require fields.
  - A transition's readiness into an action-only step must equal that step's exit (locator + frame) (B).
  - The hash pin is reverted by the new `scripts/lib/phase121D63ValidatorEdits.mjs`.
- `src/loginContract/runtimeGate.ts`:
  - Step rows use `allowEmpty` for action-only middle steps.
  - Readiness uses `revealedExit` into an action-only step.
  - The fieldId-unique-across-steps rule is removed (C). `buildSpecialCredentialSubset` stays the union, and each step gets its own subset.
- `src/loginContract/specialDraftAuthoring.ts`:
  - `revealedActionOnlyExit` (needs `approvedForAuthoringContinuation` + `approvedForRuntime`, and must not be the action itself).
  - `readinessTargetFor` ('action' | 'field').
  - `deriveRevealReadiness` / declared-in-revealed-step check follow B.
  - `checkSpecialDraft` / the completeness line accept an action-only middle step.
  - Exported via `index.ts`.
- `src/assistedMapping/currentTabAuthoring.ts`: `performApprovedAuthoringClick` sends `allowActionsOnly` and `readinessTarget` and returns `actionsOnly` + `revealedFrame`.
- `src/assistedMapping/followUpSelection.ts`: with `testedGone`, the same-kind-same-surface skip is lifted (the tested action itself is still never proposed).
- `src/admin/SpecialLoginDraftEditor.tsx`:
  - `testAndChooseAction` requests actions_only only for a MULTI_STEP `intermediate_transition` and passes `readinessTargetFor`.
  - On `actionsOnly`: the revealed step becomes action-only (empty mappings + rederive), the step is selected, and one `runSpecialAnalyze('after_continue', …, actionsOnly)` runs. No fields are written, and the follow-up slot takes the choice screen's exit.
  - Rule E: skip only when fieldId + locator + frame all match an earlier mapping.
  - New copy `choiceScreenWithAction`.
- `extension/background.js`:
  - Outside the runtime block:
    - `collectSpecialRevealActions` covers top + visible depth-1 HTTPS frames with bounded discovery. It reuses `collectSpecialAuthoringActionCandidates` + `actionRankTier` ≤ 2 (login / popup tiers).
    - `specialAuthoringActionGone`: exact-one + visible / interactable; anything unknown → not gone.
    - `specialDeclaredReadinessMet` gets target `'action'`.
    - `authoringClickApprovedAction` gets `allowActionsOnly` (reveal mode, no `requirePasswordSurface`), a before-click actions snapshot, and one `revealActionsOnly` try at the deadline before the existing failure reasons.
    - The SHA pin is reverted by `scripts/lib/phase121D63BackgroundEdits.mjs` (chain D63 → D61 → D60 → D48 → D47 → D42).
  - Runtime block: `specialRuntimeStepRows(rows, allowEmpty)`, readiness via the revealed step's exit, no unique fieldId rule, and an action-only step in the loop goes straight to `runTransition` (R1 first).

## Decisions
- Both conditions for actions_only are checked only once the deadline passes, after the fresh-field path. Frames skipped before the click are never counted as fresh.
- `requirePasswordSurface` (FLOATING_SCREEN) disables actions_only. So does declared mode.
- Readiness into an action-only step needs that step's exit to be chosen and approved. Until then the transition keeps the pending marker, so a re-test still runs in reveal mode.
- `checkSpecialDraft` normalizes draft readiness first (A1). A readiness-only defect can therefore look complete in the completeness line while the gate still rejects it. This is by design, and parity is asserted on shape verdicts only.
- Residual: if screen C's ID has exactly the same locator + frame as screen A's, rule E skips it. Use Visual mapping on step 3 in that case (allowed on any step).
- Unchanged: `final_submit` reserved, no OTP / SMS handling, R-3 origin rules, R-4 per-step subset, FLOATING_SCREEN, STANDARD, contract shape (an empty `fieldMappings` is allowed only per A), manifest / permissions. No webNavigation / debugger / getFrameId; no site branches. `page-structure-inspect.js` not edited.

## Verify
- `node scripts/verifyPhase121ChoiceScreen.mjs`: PASS (38 checks).
  - Runtime (real `background.js`, linkedom):
    - CH-F-SAME-PAGE and CH-F-NAVIGATION (A → B → C): readiness into B = B's exit, the ID is filled on A and on C, the password on C, one click per transition, never submits.
    - CH-F-B-EXIT-MISSING fails closed.
  - Gate parity (validator / completeness line / Hub gate / Hub run / Ext), 18 plans. Rejected: an action-only last step, an action-only step with no exit, step 1 without fields, readiness = the action itself. Accepted: repeated fieldId; union + own-subset checks.
  - Authoring (real `authoringClickApprovedAction`):
    - Accepted: the button is gone and a fresh vocabulary action appeared.
    - Rejected: button hidden only, no change, plain-only action, button still there, action not fresh, flag off, `requirePasswordSurface`.
    - A fresh field still wins. Declared action / field / self readiness is checked.
  - Derive P1–P8, including the pending marker until B's exit is chosen.
  - Editor harness:
    - The Maccabi flow: C's `#id2` is written, `#id` (same element as A) is not.
    - Re-test in declared mode with target action.
    - Copy.
    - FLOATING_SCREEN never sends `allowActionsOnly`.
  - Static and no credential values in logs.
  - Mutations MX1–MX12 (Ext), MH1–MH5 (Hub), MD1–MD3 (derive), ME1–ME9 (editor / follow-up). All caught.
- Re-homed (no behavior loss):
  - `verifyPhase121MultiStepRuntime`: "fieldId in two steps" is now runnable (C), X9 removed, and "complete but not runnable" uses a 5-step plan.
  - `verifyPhase121MultiStepTransition`: M10 anchor → the rule E condition.
  - `verifyPhase121DeclaredFrameReadiness`: harness param `readinessTarget`.
  - `verifyPhase121ActionBar`, `verifyPhase121SpecialDraftAuthoring`, `verifyPhase121TestThenChoose`: `runSpecialAnalyze('after_continue', …)` needle prefix.
  - `verifyPhase121StableLocators`: 4 `stableLocators: true` sites (the new actions snapshot).
  - `verifyPhase121FloatingFieldsAfterOpener`: M4 anchor.
  - `verifyPhase121AnalyzeProposalQuality`: the R-e frame fixtures use a 1500 ms reveal deadline. With 120 ms, the first poll tick could exceed the deadline under load (a flake: 0,0,0,1). The M-Re mutation is still caught.

## Regression
- 55/55 verifies PASS (`verifyPhase121Runtime` 35 checks, the SHA pins hold). `npm run build` (incl. `tsc -b`) exit 0, `node --check extension/background.js` exit 0, no lints.

## Owner live steps
1. Reload the extension (chrome://extensions → reload).
2. Maccabi: «זהה» on screen A → type the ID manually → «בדוק» on «המשך» → the choice screen is recognized (step 2 without fields, copy «נפתח מסך ביניים בלי שדות כניסה…») → «בדוק» on «כניסה עם סיסמה» → ID + password identified on screen C → «שמור מיפוי» → «בדיקת מילוי» (the ID is filled on A and on C, the password on C, no submit) → «אשר מיפוי» → Digital Home.
3. If C's ID is not proposed (same element as A), map it with Visual mapping on step 3.

# Slice 121.3 — MULTI_STEP execution (2026-09-29)

## What changed
- `src/loginContract/runtimeGate.ts`: `validateFloatingScreenRunnable` → `validateSpecialRunnable` (FLOATING_SCREEN rules unchanged + MULTI_STEP rules, R-1). `MULTI_STEP_MIN_STEPS = 2`, `MULTI_STEP_MAX_STEPS = 4`. `index.ts` exports the new names.
- `src/execution/specialLoginFlow.ts`:
  - uses the new gate;
  - `buildSpecialCredentialSubset` = union of all steps (R-4);
  - `SpecialRunStage` + `'transition'`;
  - outcome `stepNumber` (1-based, multi-step plans only, derived from the plan by `stepId`).
- `src/execution/specialLoginFlowMessages.ts`: `MSG_SPECIAL_ADMIN_TRANSITION`, `MSG_SPECIAL_ADMIN_STEP_READINESS_TIMEOUT`, `MSG_SPECIAL_ADMIN_STOPPED_AT_STEP` («המילוי נעצר בשלב N: …»). The prefix is applied only when `stepNumber` is set; the reason mapping is unchanged otherwise. `SpecialTestResultView.tsx` passes `stepNumber`.
- `src/admin/fillTestContext.ts`: runnable patterns FLOATING_SCREEN + MULTI_STEP; `specialMappedFieldIds` = all steps (deduplicated).
- `src/admin/specialActionBar.ts`: `specialApproveGate(savedDraft)` = `checkSpecialDraft` + `validateSpecialRunnable`. Copy `approvePatternLater` / `approveNotRunnable`.
- `src/admin/SpecialLoginDraftEditor.tsx`: `approveGate` (from the saved row). «אשר מיפוי» is disabled by it; `requestActivateSpecial` and `activateSpecial` are guarded by it; status line `data-status="special-approve-blocked"`.
- `extension/background.js` (runtime block only; the outside-block SHA pin is unchanged):
  - `specialValidateRunPlan` → parity helpers `specialRuntimeStepRows` / `CssAction` / `ActionFrames` / `Readiness` / `FloatingShape` / `MultiStepShape`. The validated plan = `{ opener | null, steps: [{ stepId, frame, fieldMappings, credentials (step subset), exit | null }] }`.
  - `runSpecialLoginFlow`: one loop — `fillStep` → `fillAttempt` (R1) → `fillInDocument` (unchanged runner call) → `afterVerifiedFill` → `runTransition` (R1 → gesture watch → `resolveActionDocument` → `clickAction` → `pollReadiness`) → `fillStep(i+1)`.
  - The opener uses the same `resolveActionDocument` / `clickAction` / `pollReadiness`.

## Decisions
- Attribution (R-6):
  - Opener click / readiness → step 1 + opener.
  - Fill of step i → step i + the action that revealed it; for step 1 of MULTI_STEP, its own exit.
  - Transition click → step i + exit i.
  - Readiness after exit i → step i+1 + exit i, because the readiness field belongs to the revealed step.
  - Success → last step + the action that revealed it (FLOATING_SCREEN: `step-credentials` / opener, as in 121.2).
- "Navigating = not ready" (R-3):
  - Top readiness: an injection error is already "not met" (existing `specialDeclaredReadinessMet`).
  - Frame readiness after a transition: `frame_correlation_unavailable` (the handshake can't inject while the tab navigates) is also treated as pending until the deadline.
  - This applies only after a transition; FLOATING opener readiness is unchanged. A foreign top origin still fails at once (`origin_mismatch`), never pending.
- R1 now runs before every fill attempt as well (FLOATING_SCREEN too): the same check, one extra round-trip per attempt, stricter.
- Gesture evidence across several click windows: `true` if any window saw a trusted gesture; `false` only if every window was watched and collected; otherwise omitted («לא הוכח — לא ניתן היה לוודא…»). A navigation split therefore shows "not proven" in the Admin test (the watch dies with the old document). The run itself is unaffected.
- `filled` on success = total across steps.
- Approve guard copy: FSMS (`pattern_not_supported_yet`) → «אישור לסוג כניסה זה יתאפשר בשלב מאוחר יותר.» as specified. A runnable pattern whose saved draft fails the gate (e.g. a fieldId in two steps) → «המיפוי אינו תקין להרצה. עדכנו את המיפוי ושמרו.» instead, because "later" would be misleading there. Incomplete drafts keep the existing completeness line (no extra message).
- R-5 not implemented: an absent transition fails closed at `transition` / `transition_missing` (step 1).
- Digital Home copy: `transition_*` falls to the existing «דף הכניסה נפתח, אך המילוי האוטומטי נכשל…»; no new end-user copy.
- Unchanged: contract shape, parse, `validateSpecialPlanComplete`, authoring, STANDARD path, manifest / permissions, `final_submit` reserved, merge guard, no metadata writes from runs. No webNavigation / debugger / getFrameId; no site branches.

## Verify
- `node scripts/verifyPhase121MultiStepRuntime.mjs` — PASS (16 checks, 18 mutations caught).
  - Fixtures (real `background.js` + real page scripts, linkedom windows; a top navigation fails every injection while in flight):
    - SAME-PAGE split;
    - NAVIGATION split (same origin, new document);
    - FRAME-STEP (step 2 in a cross-origin depth-1 frame);
    - NAVIGATION-FRAME (framed step after a navigation);
    - CROSS-ORIGIN transition → `origin_mismatch`;
    - TRANSITION-MISSING / -AMBIGUOUS;
    - READINESS-TIMEOUT;
    - R1-BEFORE-FILL.
  - Each success checks: order fill(step 1) → click → fill(step 2), step 1's value present when «הבא» is clicked, one click, per-step credential subset, never submits.
  - Gate: 21 plans, Hub ≡ Ext (including readiness of its own step, a fieldId in two steps, 1 / 5 steps, a last-step exit, FSMS, FLOATING_SCREEN parity).
  - Also: R-4 union and per-step subset (Hub + Ext); R-6 copy / stage / stepNumber; R-7 route + approve gate + editor wiring; static (no forbidden APIs / site tokens / R-5, MAIN-world click, R1 before click and fill, capped deadlines); no credential value in logs.
  - Mutations X1–X17 (+ X12b): transition before fill, union into every step, own-step readiness (Ext / Hub), navigating fails, no R1 before fill, transition reported as opener, 5 steps, duplicate fieldId, Hub steps[0]-only subset, Hub MULTI_STEP gate removed, route FLOATING-only / steps[0]-only, approve ignores the gate, step prefix removed, last-step exit accepted, foreign origin treated as pending, stage `transition` dropped. All caught.
- Re-homed (no behavior loss):
  - `verifyPhase121Runtime`: M4a / M4b anchors → new gate; label text.
  - `verifyPhase121DeclaredFrameReadiness`: `resolveOpenerDocument` → `resolveActionDocument`.
  - `verifyPhase121ActionBar`, `verifyPhase121ApproveSavedOnly`, `verifyPhase121UnifiedVocabulary`: the button / guard expressions include `!approveGate.allowed` / `specialApproveGate(saved)`.
  - `verifyPhase121FillTestGrid`, `verifyPhase121UnifiedVocabulary`: the "not runnable yet" example is now FSMS; MULTI_STEP asserted runnable.

## Regression
- 54/54 verifies PASS (FLOATING_SCREEN 121.2 verify: 35 checks, all mutations caught; STANDARD parity checks inside it unchanged). `npm run build` (incl. `tsc -b`) exit 0, `node --check extension/background.js` exit 0, no lints.

## Owner live steps
1. Reload the extension (`chrome://extensions` → reload).
2. Gmail (MULTI_STEP, already mapped + saved):
   - Open «בדיקת מילוי»: temp inputs for both steps.
   - «כניסה לאתר ומילוי שדות». Expected: email filled → «הבא» clicked → password filled → stops, no sign-in.
   - Then «אשר מיפוי» (now enabled) → Digital Home tile: the same flow with the vault credential.
3. Microsoft account: map as MULTI_STEP (step 1 email + «הבא» transition, step 2 password) → «שמור מיפוי» → «בדיקת מילוי» → «אשר מיפוי» → Digital Home.
4. If a run stops, the result reads «המילוי נעצר בשלב N: …». Send the «פרטים טכניים» line (stage · reason · locator; no values).
5. A FLOATING_SCREEN_MULTI_STEP mapping shows «אישור לסוג כניסה זה יתאפשר בשלב מאוחר יותר.» and «אשר מיפוי» stays disabled.

---

# Slice D-121-61 — Address a frame by its source when it has no name (2026-09-29)

## What changed
- `extension/generic/frame-correlation.js` (3 exact edits in `scripts/lib/phase121D61CorrelationEdits.mjs`):
  - New `srcPrefixLocator(el)`: only when the `src` attribute is an absolute `https://` URL. The prefix = `origin + pathname` (query / hash / credentials dropped). It must be a literal prefix of the raw attribute, so the selector really matches. At most 300 chars; no control chars or `|`.
  - `frameLocatorCandidates(el, doc)`: id → name → title → aria-label (unchanged), then `src`, then `LocatorDeterminism.anchoredStructuralCandidates(el, doc)` (D-121-48: stable id / custom tag / dialog role / stable class ancestor; `:nth-of-type` only inside that ancestor; generated ids never anchor).
  - `exactOneFrameLocator` passes `doc`. Every candidate still has to be exact-one on the same element; none → `frameLocator: null` (not addressable, as before).
- `extension/background.js` (7 exact edits in `scripts/lib/phase121D61BackgroundEdits.mjs`):
  - `collectSpecialRevealSnapshot` returns `unaddressable` (frameIds of visible `not_addressable` records; frameIds never leave the extension). `snapshot_done` traces the count.
  - `pollReveal`: a frame unaddressable after the click that was not a visible unaddressable frame before → `sawNewUnaddressable`.
  - At the deadline the order is:
    1. `surface_not_login` (something else fresh);
    2. `surface_frame_not_addressable`;
    3. `surface_not_revealed`.
- `src/assistedMapping/types.ts` + `index.ts`: `SURFACE_FRAME_NOT_ADDRESSABLE_HE` = «המסך נפתח, אבל השדות נמצאים במסגרת שהמערכת לא יכולה לאתר.»
- `src/assistedMapping/currentTabAuthoring.ts`: `authoringClickFailureMessageHe('surface_frame_not_addressable')` → the new copy.
- `src/admin/specialActionBar.ts`: outcome `frame_unaddressable` (`testFailureOutcome`). Status «מצב: לא נבחר — המסך נפתח, אבל השדות נמצאים במסגרת שהמערכת לא יכולה לאתר».

## Decisions
- The src candidate uses the raw attribute, not the resolved `el.src`. `[src^=…]` matches the attribute text, so relative / protocol-relative / http / about: sources get no src candidate (they may still get the structural one).
- The src prefix is authoring-time identity only. At runtime `resolveFrameByLocator` still requires exact-one, and `resolveDeclaredFrame` requires depth-1 + live origin === stored `frameOrigin`. A frame whose src is unchanged but whose document moved to another origin fails `frame_origin_mismatch` (fixture E2).
- Structural candidate: the first exact-one result of the existing D-121-48 helper, used unchanged (no new stability rules).
- "Newly visible" compares frameIds (stable for a frame's document in one tab) before and after the click. A frame already visible and unaddressable before the click keeps «המסך לא נפתח».
- No contract / validator / parse change: `frameLocator` was already any non-empty string. Frame keys (`locator|origin`) are not split anywhere, and `|` is excluded anyway.

## Verify
- `node scripts/verifyPhase121FrameBySource.mjs` — PASS (15 checks, 13 mutations caught).
  - Unit (real `frame-correlation.js` + `locator-determinism.js`, linkedom DOM):
    - U1 CAL-shaped (four duplicate `#popupIframe` + a nameless frame) → `iframe[src^="<origin>/index.html"]`.
    - U2 query + hash dropped.
    - U3 same src twice → `div.login-modal iframe`; no stable ancestor / generated ancestor ids → null.
    - U4 `#iframeLogIn` and name first; candidate order title → src → anchored.
    - U5 relative / http / protocol-relative / about: → no src candidate.
  - End to end (real `background.js` SPECIAL block, top document = linkedom, real handshake):
    - E1 CAL-shaped: revealed in the frame with the src descriptor; cross-origin → not approved (held for «אשר מסגרת»).
    - E2 declared click via the src locator works; the same src with a different live origin → `frame_origin_mismatch` from `resolveDeclaredFrame` (live origin reported), no click.
    - E3 newly visible unaddressable frame → `surface_frame_not_addressable` + copy + status; «המסך לא נפתח» unchanged.
    - E4 unaddressable frame visible before the click → `surface_not_revealed`.
    - E5 `surface_not_login` / top reveal win.
    - E6 Mizrahi `#iframeLogIn` / PAGI top-document unchanged.
  - Static: edits exactly the listed pairs; no manifest / webNavigation / debugger / getFrameId / site branches; `resolveDeclaredFrame` guards intact; descriptor shape unchanged.
  - Mutations: M1 / M1e src removed, M2 query kept, M3 src without exact-one, M4 structural removed, M5 http allowed, M6 src replaces the origin check, M7 reason never emitted, M8 "new" not checked, M9 new reason outranks `surface_not_login`, M10 copy collapsed, M11 status collapsed, M12 src before id. All caught.
- Re-homed:
  - `verifyPhase121Runtime`: `frame-correlation.js` pin via `revertD12161CorrelationEdits`; `background.js` pin with `revertD12161BackgroundEdits` innermost. Both hashes unchanged.
  - `verifyPhase121AuthoringClickBounded`: its static check reverts D-121-61 before D-121-60.

## Regression
- 53/53 verifies PASS. `npm run build` (incl. `tsc -b`) exit 0, `node --check` on both extension files exit 0, no lints.

## Owner live steps
1. Reload the extension (`chrome://extensions` → reload).
2. CAL (FLOATING_SCREEN): «נתח» → «בדוק» on the opener. Expected: the screen opens and the fields are found in the frame. The frame-approval prompt for the payment origin appears → «אשר מסגרת».
3. If a site's frame still can't be addressed, the message is now «המסך נפתח, אבל השדות נמצאים במסגרת שהמערכת לא יכולה לאתר.» (not «המסך לא נפתח»).

---

# Slice D-121-60 — Bounded authoring click: a frame that does not answer never blocks the click (2026-09-29)

## Root cause
- Flow before the fix (reveal mode, `authoringClickApprovedAction`):
  1. tab gate
  2. `collectSpecialRevealSnapshot`, which runs:
     - an all-frames probe;
     - the correlation files on all frames, a send in frame 0, a 150 ms wait, a read-back on all frames;
     - an inject + inspect per visible depth-1 frame.
  3. gesture-watch install on all frames
  4. `clickInFrame`
  5. poll
- Every step was an unbounded `chrome.scripting.executeScript` callback. An all-frames call answers only when every frame answers. A frame that never does (not reaching document_idle, navigating or being removed mid-injection; typical on pages with many cross-origin frames) left the chain waiting forever.
- `sendExtensionMessageAsync` had no timeout, so the Hub showed a generic failure (or nothing) while the click never ran.
- This matches the Owner evidence: one `#btnNext`, the same MAIN-world `.click()` works from the console, and «בדוק» does nothing on the site.
- Evidence:
  - Static: the call chain above.
  - Fixture: `verifyPhase121AuthoringClickBounded` C1 with the per-frame bounding removed (mutation M1) → no click and no reply within the wait. With the fix → click once, reveal proceeds.
  - Live: the trace below; not captured yet.

## What changed
- `extension/background.js` (SPECIAL authoring block only; 22 exact edits in `scripts/lib/phase121D60BackgroundEdits.mjs`):
  - `SPECIAL_AUTHORING_CALL_TIMEOUT_MS = 2500` and `specialAuthoringExec(bounded, details, cb)`:
    - bounded → `('authoring_call_timeout', timedOut)` after the bound;
    - a late answer is ignored;
    - unbounded = plain `executeScript`.
  - `specialAuthoringTraceStart()`: `console.info('[D-121-60 authoring-click]', { id, t, stage, …counts })`.
  - `specialFrameNonceHandshake`: `send.bounded` / `send.trace`. A timeout = handshake failure (`frame_correlation_unavailable`, as before).
  - `enumerateSpecialAuthoringFrames(…, opts)`:
    - `opts.bounded`: a probe timeout → top-only probe; depth-1 frames are counted `correlationUnavailable` (never silent).
    - `opts.trace`.
  - `resolveDeclaredFrame(…, opts.bounded)`: handshake + probe bounded. A timeout → `frame_correlation_unavailable` / `frame_missing` (fail-closed, no click).
  - `specialInjectThenRun(…, bounded)`: a timeout → `{ ok: false, timedOut: true }`.
  - `collectSpecialRevealSnapshot(…, trace)`:
    - bounded;
    - timed-out frames are returned in `skipped` and contribute no entries.
  - `specialGestureWatchRun(…, bounded)`: a timeout → `{ ok: false }`, so install → `gesture_watch_unavailable`, collect → the verdict fails closed.
  - `authoringClickApprovedAction`:
    - trace stages;
    - bounded calls;
    - the reveal poll ignores entries from frames skipped in the pre-click snapshot.
- `src/assistedMapping/currentTabAuthoring.ts`:
  - `performApprovedAuthoringClick` waits at most readiness timeout (default `DEFAULT_READINESS_TIMEOUT_MS`) + `AUTHORING_CLICK_HUB_MARGIN_MS` (90 000).
  - After that it returns `authoring_click_no_response` (default «לחיצת המשך נכשלה…» copy).
  - `AUTHORING_CLICK_NO_RESPONSE_REASON` is exported.

## Decisions
- Scope: the bounds are opt-in and used only by the authoring click. The login runtime, Inspect / Visual pick and the declared readiness poll call the same helpers unbounded, unchanged. The declared poll stays unbounded; the Hub wait covers it.
- Fail-closed split:
  - Discovery frames may be skipped: a skipped frame is never compared, so no false reveal.
  - The click target frame (declared), the frame origin check and the gesture watch are never skipped: a timeout is an explicit failure.
- `clickInFrame` is untouched (not bounded): it is the click itself.
- Extension worst case = 19·C + 3·H + P + T:
  - C = 2500 (one bounded call), H = 150 (handshake wait), P = 400 (poll interval), T = readiness timeout.
  - Breakdown: click-frame resolve 4C+H, pre-snapshot 6C+H, install C, after T one last tick P + C + 6C+H, collect C.
  - That is T + 48.35 s. The Hub margin of 90 s leaves ≥ 10 s for the tab gate. The verify computes this from the constants.
- The trace carries no locators, origins or values: only stage, elapsed ms, counts, booleans and reason codes.

## Verify
- `node scripts/verifyPhase121AuthoringClickBounded.mjs` — PASS (15 checks, 11 mutations caught). Real `background.js` block, mocked chrome where each frame can never answer / answer slowly per call type; real Hub click helper with a stubbed bridge.
  - C1: PayPal-shaped step (`#email` present, `#btnNext` reveals `#password`) + 6 cross-origin frames, one never answering inspect → click once, revealed in top.
  - C2: a frame never answers the correlation injection → correlation unavailable, click runs.
  - C3: the all-frames probe never answers → top-only fallback, click runs.
  - C4: all frames slow (30 ms, within the bound) → identical reply to the fast run (reveal in `iframe#f4`), no timeouts.
  - C5: a frame skipped in the pre-click snapshot that already holds a field → `surface_not_revealed` (no false positive).
  - C6: declared click frame, handshake / probe never answers → `frame_correlation_unavailable` / `frame_missing`, no click.
  - C7: `frame_origin_mismatch` unchanged; declared-mode framed click unchanged.
  - C8 / C9: gesture install / collect never answers → `gesture_watch_unavailable` (no click / fail-closed).
  - C10: trace stages in order; no locators / origins / values.
  - C11: Hub margin ≥ extension worst case + headroom; a never-answering extension → `authoring_click_no_response` after readiness + margin; an answered click unchanged.
  - Static: `clickInFrame` unchanged; runtime block has no bounded / trace calls; D-121-60 edits exactly the listed pairs with no webNavigation / debugger / getFrameId / site branches; manifest unchanged.
  - Mutations: M1 per-frame unbounded, M2 skipped frames compared, M3 no top-only fallback, M4 handshake unbounded, M5 click frame fail-open, M6 install unbounded, M7 collect timeout as proof, M8 locator in trace, M9 slow frame skipped, M10 Hub margin too small, M11 Hub wait removed. All caught.
- Re-homed:
  - `verifyPhase121Runtime`: `revertD12160BackgroundEdits` added innermost, and the SHA pin is unchanged (proves no other `background.js` change).
  - `verifyPhase121DeclaredFrameReadiness`: its sandbox now includes `specialAuthoringExec`.
- Mizrahi / PAGI framed fixtures (`verifyPhase121IframeSurface`, `DeclaredFrameReadiness`, `SpecialDraftAuthoring`, `TestThenChoose`, `Runtime`): PASS unchanged.

## Regression
- 52/52 verifies PASS. `npx tsc -b` exit 0, `npm run build` exit 0, `node --check extension/background.js` exit 0, no lints.

## Owner live steps
1. Reload the extension (`chrome://extensions` → reload).
2. On the same page, open the extension's service worker: «Inspect views: service worker» → Console. Type `D-121-60` in the filter box.
3. PayPal, MULTI_STEP step 1: type the email, then «בדוק» on `#btnNext`.
4. Expected: the site advances to the password step. The console shows `received → tab_ready → frame_probe → handshake_* → snapshot_frames → snapshot_frame … → snapshot_done → gesture_install → click_done → poll … → gesture_collect → reply`.
5. If it still fails, copy the `[D-121-60 authoring-click]` lines (stage, t, counts only; no values). The last stage before the gap names the step that stalled. Any `timedOut: true` names a frame that did not answer.

---

# Slice D-121-59 + A1 — Password requirement follows the login fields; one message per reason (2026-09-29)

## What changed
- `src/admin/specialActionBar.ts`:
  - New `requirePasswordSurfaceFor(pattern, loginFields)` = FLOATING_SCREEN && some field `type === 'password'`.
  - `ActionTestOutcome` gains `not_login` / `field_missing`; new `testFailureOutcome(reason)`.
  - Two new panel statuses: «מצב: לא נבחר — המסך נפתח, אבל לא נמצא בו שדה סיסמה» and «מצב: לא נבחר — השדה הממופה לא הופיע אחרי הלחיצה».
- `src/admin/SpecialLoginDraftEditor.tsx`: `requirePasswordSurface: requirePasswordSurfaceFor(consentDraft.pattern, loginFields)`; failed test → `testFailureOutcome(result.reason)` (a not-proven test still shows no outcome).
- `src/assistedMapping/types.ts` + `index.ts`: `SURFACE_NOT_LOGIN_HE`, `MAPPED_FIELD_NOT_APPEARED_HE` (Architect wording).
- `src/assistedMapping/currentTabAuthoring.ts`: `authoringClickFailureMessageHe` splits the three reasons; the parameter doc notes D-121-59.

## Decisions
- The rule reads the site's stored «שדות כניסה» (`loginFields`, the same list Analyze uses); an invalid / empty schema → no password field → not required.
- Panel status wording: the main clause of each new message after «מצב: לא נבחר —» (same shape as the existing status line). The full sentence is shown in the error line.
- Residual (per Architect): a password-less site could again accept a newsletter form as the surface, as before G8; manual pick and «זה לא הכפתור» remain.

## Verify
- `node scripts/verifyPhase121PasswordlessSurface.mjs` — PASS. End to end with the real Hub click helper and the real `background.js` `authoringClickApprovedAction` (mocked chrome):
  - C1: CAL-shaped schema + ID / card-digits screen → revealed, both fields mapped.
  - C2: password schema + newsletter → `surface_not_login`, new copy and status.
  - C3: declared-mode timeout → new copy and status.
  - C4: nothing revealed → «המסך לא נפתח».
  - C5: MULTI_STEP / FSMS never send the flag.
  - Mutations run the end-to-end groups only: always require, never require, wrong field-type test, pattern check dropped, copy mapping collapsed, panel status collapsed. All 6 caught.
- Re-homed (string anchors / copy only):
  - `verifyPhase121IframeSurface` (readiness_timeout has its own message).
  - `verifyPhase121AnalyzeProposalQuality` (R-c send site, `surface_not_login` copy, flag user list + `specialActionBar.ts`, M-Rc anchor).
  - `verifyPhase121TestThenChoose` and `verifyPhase121OpenerIdentification` (the `setTestOutcome` line).

## Regression
- 51/51 verifies PASS. `npx tsc -b` exit 0, `npm run build` exit 0, no lints.

## Owner live steps
1. CAL (FLOATING_SCREEN, login fields ID + card digits, no password field): «נתח» → «בדוק» → «נבדק ונבחר — המסך נפתח», both fields identified.
2. A site with a password field whose opener opens a newsletter → «המסך נפתח, אבל לא נמצא בו שדה סיסמה — ייתכן שזה לא מסך הכניסה.»

---

# Slice D-121-58 — Multi-step: a tested transition creates the step it reveals (2026-09-29)

## What changed
- `src/loginContract/specialDraftAuthoring.ts`:
  - New `placeTransitionAsStepExit(draft, stepId, action)`: sets step N's exit (single slot; an unknown stepId → `steps[0]`), removes the same action from the preamble, and creates an empty step N+1 (`step-<n>`, unique) when missing.
  - New `migrateLegacyPreambleTransitions(draft)`, MULTI_STEP / FSMS only: preamble transitions leave the preamble. The chosen one (else the first) goes to `steps[0].exitTransition` unless that slot already holds an action and only the legacy one is unchosen. `steps[1]` is created when missing.
  - New `revealedStepIdFor`.
  - `deriveRevealReadiness`: a transition never takes a field of its own step; with no other mapping in the revealed step it gets `createPendingRevealReadiness()`. Openers are unchanged.
  - `isDeclaredInRevealedStep`: a transition whose readiness is also an owner-step field is not "declared".
  - `normalizeLegacyDraftReadiness`: runs the migration after the D-121-46 pruning, then re-derives transitions whose readiness is not a declared field of their revealed step.
- `src/loginContract/index.ts`: exports the three helpers.
- `src/admin/specialActionBar.ts` `manualAnalyzeMayWriteFields`: for MULTI_STEP / FSMS, step index ≥ 1 → `actionSelected(steps[i-1].exitTransition)`. The steps[0] rules (FS / FSMS opener; MULTI_STEP open) are unchanged.
- `src/admin/SpecialLoginDraftEditor.tsx`:
  - `writeDraftAction`: an owner step keeps its exit as before. A new `intermediate_transition` in a multi-step pattern → `placeTransitionAsStepExit(base, currentStepId, …)`. Everything else → `upsertPreambleAction`, unchanged.
  - New module helper `transitionRevealedStepId`. On test success the selector is set to the revealed step, and `runSpecialAnalyze` uses `targetStepId` (revealed step for a tested transition, else the selected step) for locators, writes, held fields, the gate and follow-up surfaces.
  - Multi-step: field IDs already mapped on an earlier step are skipped when writing a later step, and "all mapped" counts them.

## Decisions
- **No validator / contract change needed.** `validateSpecialPlanComplete` already checks `steps[i].exitTransition` against `steps[i+1]` and preamble actions against `steps[0]`; `exitTransition` exists in the contract.
- **FSMS ordering is unambiguous:** the opener stays in the preamble (reveals step 1); transitions are step exits. An FSMS follow-up transition after the opener test lands on step 1's exit (verified; the validator accepts the result).
- Placement happens at the «בדוק» press, on the step selected at that moment. Visual pick / «נתח» only fill the panel, as before (§5.2: only the test press writes the draft).
- A failed test leaves the unchosen exit and the empty step N+1 (same as an unchosen opener today). «זה לא הכפתור» removes the exit; the empty step stays.
- Skipping earlier-step field IDs on later steps is needed so that a same-page step 2 (where `#email` is still visible) gets only the password. Field Visual can still map anything on any step.
- The FSMS opener test does not move the selector, so the opener path is literally unchanged.
- **Live risk (extension unchanged, not authorized):** in reveal mode, a navigation during polling makes script injection fail, which is tolerated (empty result, keeps polling). But if `enumerateSpecialAuthoringFrames` itself fails mid-navigation, the test ends as failed. If the Owner sees «המסך לא נפתח» on a navigating «הבא», this is the cause; the fix needs an extension slice.

## Verify
- `node scripts/verifyPhase121MultiStepTransition.mjs` — PASS: 7 pure + 5 behavior groups + 2 static, 12 mutations caught (M1 reproduces the live bug: declared readiness on `#email`).
- `verifyPhase121FloatingFieldsAfterOpener.mjs` P1 re-homed: FSMS step 2 is gated until step 1's transition is chosen; FLOATING_SCREEN extra step still open. S1 / M1 use `targetStepId`.

## Regression
- 50/50 verifies PASS (the same set plus the new one). `npx tsc -b` exit 0, `npm run build` exit 0, no lints.

## Owner live steps
1. PayPal, MULTI_STEP, clean draft: «נתח» on step 1 → `#email` mapped, «הבא» proposed.
2. «בדוק» on «הבא» → the selector shows «שלב 2»; step 2 holds the password; «נבדק ונבחר — המסך נפתח» only if a new field actually appeared.
3. Save → the draft shows `steps[0].exitTransition = #btnNext` and `steps[1]` with the password. «בדיקת מילוי» on MULTI_STEP still refuses (121.3 not authorized).

---

# Slice D-121-57 — Accessibility controls are never proposed first (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-57 (OWNER APPROVED / AUTHORIZED 2026-09-29) · **Status:** IMPLEMENTED, awaiting Architecture review.

## What changed
- **`src/assistedMapping/specialActionIntent.ts`** and **`extension/generic/page-structure-inspect.js`** (identical copies): `ACTION_INTENT_VOCABULARY.negative` += `'נגישות'`, `'נגיש'`, `'accessibility'`, `'accessible'`.
  - Matching rules are unchanged: whole word, plus one Hebrew prefix letter, so «לנגישות» / «לנגיש» match and «נגישה» / «Inaccessible» don't.
- Ranking code is unchanged on both sides. Login is tested before negative in the Hub (`openerTier`) and in the extension (`actionRankTier`), so a control with a login word is never demoted (R-a).
- Analyze proposals only. No change to manual pick, saved / ACTIVE plans, the contract, validators, runtime, manifest or permissions. No site branches; final_submit untouched.

## Decisions
- **No list-order or tokenizer change:** the four words are appended at the end of `negative` on both sides, so the existing parity check (`JSON.stringify` equality in `verifyPhase121AnalyzeProposalQuality.mjs`) stays green.
- **The El Al aria-label alone now reads as negative** («…לנגיש לקורא מסך…»). The visible «התחברות» carries login intent, and login wins before negative, so it stays first (tier 0 / 1, high).
- **`verifyPhase121InspectReadinessEligible.mjs` scope guard:** it hashes the whole collector file after reverting the D-121-52 edits, so any later authorized edit trips it. The guard now removes the four D-121-57 lines (asserting they occur exactly once) before hashing. The pinned hash is unchanged, which proves nothing else in the file moved.

## Verify
New `scripts/verifyPhase121AccessibilityNotOpener.mjs`: the real extension collector (linkedom) feeds the real Hub `proposeSpecialActionCandidates`.
- **V1:** the new words are negative (including «נגיש בקליק», «תפריט נגישות», «לנגישות», «Accessibility», «accessible menu»), whole-word only. The El Al texts keep login intent.
- **V2:** extension ↔ Hub vocabulary and tier parity; an accessibility toggle with popup semantics gets the negative tier; a login word with «לנגיש» keeps tier 0.
- **Fixtures:** each includes three accessibility toggles (`aria-haspopup` / `aria-expanded`, `data-toggle` modal, `aria-controls` + English title). Expected first proposal, from collector and Hub alike:
  - HTZone without a login word → plain `#user-icon`;
  - HTZone with a login word → `#login-btn`;
  - El Al → `#elal-login`;
  - Super-Pharm → `#loginAnchor`;
  - PAGI → `#open-login`, skip link excluded;
  - Mizrahi → `#logInBtn`.
  
  Accessibility proposals are always low / `special_routing_negative_intent`, ranked with the negatives after every other control.
- **H1 (Hub alone):** El Al login first (high); plain control above the accessibility popup toggle.
- **S1–S3:** no site branches; manual pick not scored; saved / ACTIVE never re-scored.
- **Mutations caught (5/5):**
  - «נגיש» missing in the extension copy;
  - «accessibility» missing in the Hub;
  - Hub login demoted by the new words;
  - extension checks negative before login;
  - accessibility toggle not demoted (words removed on both sides).

## Regression
- 49/49 verifies PASS (45 Phase 116–121 + Phase 101 / 102 / 109 / 113), including the D-121-47 parity check.
- `npx tsc -b` exit 0; `npm run build` exit 0 (usual chunk-size warning); no lints.
- Extension reload needed for the live check (collector file changed).

## Owner live steps
1. Reload the extension. HTZone (FLOATING_SCREEN) → «נתח». Expected: the login control is proposed, not «נגיש בקליק».
2. El Al → «נתח». Expected: «התחברות» still first.

---

# Slice D-121-56 — Floating screen: fields come only from the opened screen (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-56 (OWNER APPROVED / AUTHORIZED 2026-09-29, option `approve`, no note line) · **Status:** IMPLEMENTED, awaiting Architecture review.

## What changed
- **`src/admin/specialActionBar.ts`:** new pure `manualAnalyzeMayWriteFields(draft, pattern, stepId)`.
  - `true` for any pattern other than FLOATING_SCREEN / FLOATING_SCREEN_MULTI_STEP, and for any step other than `steps[0]`.
  - Otherwise `true` only when a preamble `floating_opener` is chosen (`actionSelected`: both approval flags, which only a successful «בדוק» writes).
- **`src/admin/SpecialLoginDraftEditor.tsx` — `runSpecialAnalyze`:** `fieldsWritable = mode !== 'manual' || manualAnalyzeMayWriteFields(current, pattern, currentStepId)`.
  - When false, the whole field-proposal block is skipped: no write, no hold, no `rederiveRevealReadiness`.
  - Opener proposals and today's messages still run («נמצא כפתור שפותח את מסך הכניסה…»).
  - `after_continue` is never gated.
- Unchanged: field Visual (`visualPickField`), MULTI_STEP, STANDARD, saved / ACTIVE plans, the contract, validators, runtime, extension, manifest and permissions. No new copy; no site branches.

## Decisions
- **"The step revealed by the opener" = `steps[0]`.** This is the draft model's own rule: `revealedStepFor` maps a preamble action to `steps[0]` and a step's exit transition to the next step. So the signal is unambiguous for the gated step: a chosen preamble `floating_opener`.
- **FLOATING_SCREEN_MULTI_STEP later steps are not gated.** They are revealed by an intermediate transition, not by the opener, so they fall outside the brief's wording. The same trap is possible there in principle: «נתח» on step 2 before the transition test would write step-1 surface fields. If Architecture wants those steps gated on their own transition being chosen, it is a one-line extension of the same helper (a separate decision).
- **Test consent alone does not lift the gate.** The «בדוק» press sets the continuation flag before the click; only R3 success sets both flags (P3 / M6).
- **Gated main-page proposals are dropped, not queued.** The opened surface is analyzed afresh by the auto-Analyze after the test.

## Verify
New `scripts/verifyPhase121FloatingFieldsAfterOpener.mjs`: the REAL editor (minimal hooks runtime); stubbed seams are current-surface Analyze, authoring click, Visual pick and registry write only.
- **P1–P5 (pure):**
  - FSMS step 1 gated, later steps open;
  - no opener → gated;
  - test consent only → gated;
  - chosen opener → allowed;
  - MULTI_STEP / STANDARD never gated.
- **G1:** clean FLOATING_SCREEN draft; the main page offers `#BranchNumber` (top), `#st-search-input` (same-origin frame) and a cross-origin held proposal. «נתח» writes no field, holds nothing, and proposes the opener with today's copy.
- **G2:** «בדוק» → the click runs in **reveal** mode; fields come from the opened surface. Top-document fixture: `#user`, no frame. Framed fixture: `#user` in `#iframeLogIn`. No main-page input in the draft.
- **G3:** opener chosen → a later «נתח» writes fields and holds a cross-origin one for «אשר מסגרת» as today.
- **G4:** FLOATING_SCREEN_MULTI_STEP step 1 gated the same way.
- **G5:** MULTI_STEP «נתח» writes fields as today.
- **G6:** field Visual before the opener test still writes.
- **S1–S3:** manual mode only; no site branches; Visual not gated.
- **Mutations caught (8/8):**
  - gate removed;
  - gate never lifts;
  - MULTI_STEP gated;
  - held proposals kept while gated;
  - wrong step;
  - later steps gated;
  - lifts on test consent alone;
  - field Visual gated.

## Regression
- 48/48 verifies PASS (44 Phase 116–121 + Phase 101 / 102 / 109 / 113).
- `npx tsc -b` exit 0; `npm run build` exit 0 (usual chunk-size warning); no lints.

## Owner live steps
1. Re-create a clean Mizrahi (FLOATING_SCREEN), then press «נתח» first. Expected: only the opener panel (#logInBtn); no username / password rows filled.
2. Press «בדוק את הכפתור וזהה את השדות». Expected: «נבדק ונבחר — המסך נפתח», and the fields are identified inside `#iframeLogIn`.
3. «שמור מיפוי» → «בדיקת מילוי» fills both fields.

---

# Slice D-121-55 — SPECIAL «אשר מיפוי» persists or fails visibly (read-back, all SPECIAL patterns) (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-55 (Owner-reported bug, AUTHORIZED as C-item 2026-09-29) · **Status:** IMPLEMENTED, awaiting Architecture review.

## Root cause — evidence
- **Symptom (Owner live):** PAGI re-created, FLOATING_SCREEN, fields in a cross-origin frame. The Owner approved → confirmed and saw green «המיפוי אושר». After F5 the row showed «נשמר — עדיין לא אושר למשתמשים» / «פעיל כעת: STANDARD». The technical line prints «STANDARD» only when the stored row has no SPECIAL activation (SPECIAL_INVALID would print «SPECIAL לא תקין»). So the stored row kept the draft but has neither activation nor active.
- **Client merge is correct (replayed).** The real `adminRegistryApi` ran against an in-memory Supabase with a framed FLOATING_SCREEN draft: «שמור מיפוי», then the exact `activateSpecial` patch.
  - The payload sent to `.update` carries `loginContractActivation = {"mode":"SPECIAL","activePlanVersion":1}` plus `loginFlowPlan.{draft,active}`; 1 row matched; the read-back resolves SPECIAL.
  - It behaves the same when the row already stores an explicit `{mode:'STANDARD'}` activation.
  - So the keys are lost at the database write or later, not in the client merge.
- **Silent success path (code fact):** `.update(...).eq('id').is('owner_user_id', null)` returns no error when RLS (`service_registry_admin_global_update: is_admin() and owner_user_id is null`) matches 0 rows. `ensureSession()` only requires a signed-in user, not an admin. The old `activateSpecial` then ran `onSaved()` and printed success without reading anything back.
- **Other writers ruled out as the cause of STANDARD.**
  - Every Admin editor save (icon, notes, Login Intelligence, RegistryAdmin form, STANDARD stamp) spreads `withoutLoginContractKeys`, so stored contract keys are kept.
  - The SPECIAL fill test writes nothing.
  - The discovery RPC shallow-merges a full stale `metadata` and could only produce SPECIAL_INVALID, not STANDARD.
  - `admin_update_login_url` merges fixed keys only.
  - There are no triggers on `service_registry`.
- **Leading hypothesis (not proven live):** the approve update matched 0 rows. For example, the tab's session at that moment was not an admin; a Digital Home sign-in on the same origin shares the stored session. The stale read-modify-write race is the secondary hypothesis. I did not read env files, secrets or the live DB (outside the authorization). The definitive proof is the Owner re-run below, which now prints the matched row count, written version, read-back mode and writer.

## What changed
- **`src/admin/adminRegistryApi.ts` — `updateGlobalRegistryRow`:**
  - The update now ends in `.select('id')` and returns `GlobalRegistryWriteResult { updatedRows, writerUserId, writtenSpecialVersion }`, where `writtenSpecialVersion` is resolved from the sent metadata. The return type went from void to an object, so existing callers are unaffected.
  - A 0-row update still resolves without throwing, so no other flow (including STANDARD) changes behavior.
  - Evidence trace: `console.info('[D-121-55 registry contract write]', { serviceId, before, after, updatedRows, writer })` whenever the stored or sent contract mode is not STANDARD. It logs modes like `SPECIAL v1`, the row count and an 8-character writer prefix, never mapping content or credentials.
- **New `src/admin/specialApproveReadback.ts` — `verifySpecialApproveReadback`:** pure check that fails on any of:
  - `updatedRows === 0`;
  - the write carried no SPECIAL activation;
  - the written version is not above the previous active version (SPECIAL → SPECIAL);
  - the row is missing on read-back;
  - the read-back mode is not SPECIAL (reports STANDARD / SPECIAL_INVALID reason and `activationStored`);
  - the read-back version differs from the written one;
  - the active content differs from the approved draft (`planContentKey`, the same rule as the status line).

  The reason string carries a one-line summary: `updatedRows; written; readBack; activationStored; writer`.
- **`src/admin/SpecialLoginDraftEditor.tsx` — `activateSpecial`:** write → `fetchRegistryRowForAdmin(row.id)` → verify → `console.info('[D-121-55 approve]', …)` → `onSaved()`.
  - Success copy only when the check passes.
  - Otherwise a `data-status="special-approve-failed"` block: `admin-error` «אישור המיפוי נכשל.», then a collapsed `<details>` «פרטים טכניים» holding the raw reason (`<code dir="ltr">`).
  - Thrown errors (write / read) render the same block with the raw error message.
  - Every other editor action clears the block.
- **`src/admin/mappingStatus.ts`:** `planContentKey` exported (no logic change).
- Unchanged: the approve payload / transition, the contract, validators, runtime, extension, manifest, permissions and STANDARD approval (`AutofillProfileEditor`). No site / host / serviceId branches.

## Decisions
- **"The new version" = the version this write activated.** It is taken from the sent payload (`writtenSpecialVersion`), not recomputed from the possibly stale row prop, so a stale prop cannot cause a false failure. The read-back must equal it, and for SPECIAL → SPECIAL it must also be above the previous active version.
- **0 rows fails the approval even if the read-back looks SPECIAL.** The approval itself did not land, so it is fail-closed.
- **Fix item 2 ("persists activation + active"):** the approve patch already persists both, proven by replay and by E1–E3 (top-document, framed, v2 bump). The fix makes a non-persisting write visible instead of reporting success. If the Owner re-run shows `updatedRows=0`, the remedy is to sign in as an admin in that tab. If the product should block Admin writes from a non-admin session up front, that is a permission / session change, so I stopped short of it and flag it for Architecture.
- **STANDARD approval not touched.** The same silent-0-row behavior exists for every `updateGlobalRegistryRow` caller, but the only root cause proven so far is the missing SPECIAL read-back, so per the brief I'm reporting it rather than changing STANDARD. The new trace already logs `updatedRows` for any contract-carrying write.

## Verify
New `scripts/verifyPhase121ApproveReadback.mjs`: the REAL editor (minimal hooks runtime) calls the REAL `adminRegistryApi` over an in-memory Supabase fake with modes `ok` / `rls` (0 rows, no error) / `drop` (activation key stripped on write) / `error`.
- **P1–P8 (pure check):** ok for SPECIAL + written version + approved content. Fails for 0 rows, missing activation, version mismatch, content mismatch, no version bump, row missing, and a write without SPECIAL.
- **A1–A4 (API):**
  - an RLS miss reports `updatedRows 0` with no error;
  - a matched write reports 1 and the writer;
  - a non-contract 0-row write still resolves (no new throw);
  - the contract trace logs the 0-row SPECIAL write without mapping content.
- **E1** top-document plan → SPECIAL v1 persisted and read back → «המיפוי אושר».
- **E2** framed plan → SPECIAL persisted with the frame descriptors → «המיפוי אושר».
- **E3** SPECIAL → SPECIAL: saved change re-approved → v2 with the new mapping → «המיפוי אושר».
- **E4** 0-row write → exactly «אישור המיפוי נכשל.» (`admin-error`, alert), with "matched 0 rows" under collapsed «פרטים טכניים»; no success; `[D-121-55 approve]` logs `ok:false`.
- **E5** dropped activation key → failure copy with "read-back mode is STANDARD".
- **E6** write error → failure copy with the raw error under details.
- **S1–S3:** STANDARD editor untouched; read-back after write and success after the check; no site branches.
- **Mutations caught (11/11):**
  - M1 success without the check;
  - M2 0 rows ignored;
  - M3 mode check removed;
  - M4 version check removed;
  - M5 content check removed;
  - M6 bump check removed;
  - M7 raw reason as the main line;
  - M8 details open;
  - M9 thrown error shown as a plain error;
  - M10 update without returning rows;
  - M11 no read-back (trust the write).
- `verifyPhase121ApproveSavedOnly.mjs`: its API stub now answers `fetchRegistryRowForAdmin` and returns a write result (fixture only; assertions unchanged).

## Regression
- 47/47 verifies PASS (43 Phase 116–121 + Phase 101 / 102 / 109 / 113). `verifyPhase121AnalyzeProposalQuality.mjs` hit its known under-load flake in the loop and passed on the re-run.
- `npx tsc -b` exit 0; `npm run build` exit 0 (usual chunk-size warning); no lints on the touched files.

## Owner live steps (captures the definitive root cause)
1. Open Admin in a tab where you are signed in as the admin. DevTools → Console, filter `D-121-55`.
2. PAGI → «אשר מיפוי» → confirm.
3. If green «המיפוי אושר» appears, press F5: the status should read «מאושר למשתמשים» and the technical line «SPECIAL». Digital Home then fills.
4. If «אישור המיפוי נכשל.» appears, open «פרטים טכניים» and send the line along with the two console lines (`[D-121-55 registry contract write]`, `[D-121-55 approve]`). `updatedRows=0` confirms the RLS / session cause; `updatedRows=1` with `readBack=STANDARD` points to a database-side rewrite.

---

# Slice D-121-54 — Analyze uses the same exact-one choice as Visual (all patterns) (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-54 (OWNER APPROVED / AUTHORIZED 2026-09-29) · **Status:** IMPLEMENTED, awaiting Architecture review.

## What changed
- **`src/assistedMapping/locatorDeterminism.ts`:** new `preferExactOneCandidate(observedInput)`, the Hub twin of the Extension `preferExactOneLocator`.
  - It walks the observed input's `locatorCandidates` in order and returns the first non-empty CSS locator with inspect `matchCount === 1` (via the existing `locatorCandidateIsDeterministic`); otherwise `null`.
  - It reads only that input's candidates.
- **`src/assistedMapping/safetyValidation.ts`:** in the accepted-row step, which comes after the invented-input / invented-locator / Managed-eligibility gates:
  - A HIGH / MEDIUM row whose locator fails `assertLocatorDeterministic` takes `preferExactOneCandidate(observed)` when one exists, and pushes the warning `locator_replaced_with_exact_one`.
  - The replacement happens **before** the conflict checks, so the field / input / locator conflicts and the 120.9 gate evaluate the final locator. Two fields that end on the same locator are demoted as today.
  - No exact-one candidate → the locator is unchanged → the 120.9 gate marks it `locatorDeterministic: false` (today's «אינו חד-משמעי»).
  - Confidence, `observedInputId` and LOW / unknown rows are untouched.
- Both field-Analyze paths go through `proposeFieldMappings` → `applySafetyAndConfidence`: STANDARD `analyzeLoginPage` and SPECIAL `analyzeCurrentTabForMapping` / `analyzeSpecialCurrentSurface` (per surface). That makes the change field-level for all patterns.
- No extension, runtime, contract or manifest change; no site branches.

## Decisions
- **Why Visual parity holds:** inspect (`page-structure-inspect.js`) and Visual (`visual-target-pick.js`) build candidates in the same order (id → name → autocomplete → [stable extras] → aria-label → …), with the same dedup and the same stable-locator option. Inspect's `matchCount` comes from the shared `countLocatorMatches` (`querySelectorAll(...).length`). So "first candidate with `matchCount === 1`" equals Visual's "first candidate with `querySelectorAll.length === 1`". G6 checks this on the real scripts, including SPECIAL stable candidates.
- **Conflicts on the final locators:** a non-unique locator shared by two inputs (e.g. the same duplicate id proposed for two fields) now resolves to each input's own exact-one locator, so it is no longer a conflict. A collision created by the replacement is demoted (G5).
- **Superseded assertions (re-homed, not weakened):** `verifyPhase120LocatorVerification.mjs` R2 / R12 asserted that `#j_password` (duplicate id) on an input with a unique name stays non-deterministic, which is exactly S1.
  - R2 now asserts the name locator is proposed and prefilled, and `#j_password` never is.
  - The "not exact-one → no prefill, ID preserved" assertions (R2b, R12 MEDIUM) now run on the same input with every candidate non-unique.
- **Flake seen once:** `verifyPhase120A2ManagedFillDiagnostics.mjs` failed once on `!blob.includes('999')`, a literal that random run ids / timestamps can contain. It passed 5/5 re-runs and in the final full run. It is unrelated to this slice (no Analyze code in it), and I didn't change it.

## Verify
New `scripts/verifyPhase121AnalyzeExactOne.mjs`: real inspect + Visual scripts in linkedom, and the real Hub safety module (esbuild; mutations through an onLoad override):
- **G1 duplicate id:** the password input has `#j_password` ×2 and a unique name. For HIGH and MEDIUM, the proposed locator is `input[name="j_password"]`, deterministic, confidence unchanged, same input, and prefilled. The unique-id user row is prefilled as today. A LOW row is untouched.
- **G2 exact-one locator:** unchanged, even when it isn't the first exact-one candidate.
- **G3 no exact-one candidate:** locator unchanged, `locatorDeterministic: false`, the `locator_not_deterministic` warning, and no prefill. The editor label is still «…אינו חד-משמעי…».
- **G4 never crosses inputs:** an input without an exact-one candidate never takes another input's exact-one locator.
- **G5 conflicts on the final locators:** a replacement collision demotes both fields with no prefill. A shared duplicate id on two inputs ends on distinct own locators with no conflict.
- **G6 Visual = Analyze:** three fixtures:
  - the S1 shape;
  - duplicate id + duplicate name, where the first of several exact-one candidates wins (autocomplete over aria-label);
  - SPECIAL stable candidates.
  In each, inspect and Visual build the same candidate list, and Analyze's final locator equals Visual's choice.
- **G7 static:** replacement reads only the observed input; `matchCount === 1` rule; replacement happens before the conflict checks; prefill still requires deterministic; no site branches.
- **Mutations caught (10/10):**
  - M1 no replacement;
  - M2 an exact-one locator replaced anyway;
  - M3 crosses to another input;
  - M4 no exact-one → another candidate used;
  - M5 confidence changed on replacement;
  - M6 LOW rows replaced;
  - M7 order differs from Visual;
  - M8 exact-one rule weakened;
  - M9 replacement after the conflict checks;
  - M10 locator conflict check dropped.
- Result: `PASS — D-121-54 Analyze exact-one = Visual: 7 check groups, 10 mutations caught`.

## Regression
- 46/46 verifies PASS (42 Phase 116–121 + Phase 101 / 102 / 109 / 113); one existing verify changed (R2 / R12 re-homed as above).
- `npx tsc -b` exit 0; `npm run build` exit 0 (usual chunk-size warning); no lints on the touched files.

## Owner live steps
1. Admin → Shufersal (STANDARD) → «נתח דף כניסה». Expected: the password is proposed as `input[name="j_password"]` and prefilled (not «אינו חד-משמעי»); the username is unchanged (`#j_username`).
2. «מיפוי חזותי» on the password field. Expected: the same locator (`input[name="j_password"]`), so Visual and Analyze agree.
3. «בדיקת מילוי» fills both fields as before.

---

# Slice D-121-51 C2 (revised) — «מחיקת אתר»: full-delete wording, impact lines as notices (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-51 C2 revised (OWNER DECISION "full delete everywhere, incl. built-in", AUTHORIZED 2026-09-29) · **Status:** IMPLEMENTED, awaiting Architecture review.

## What changed
- **`src/admin/DeleteServiceDialog.tsx`** (copy + style only):
  - `DELETE_SERVICE_COPY_HE.builtin` changed from «אתר מובנה — יחזור למצב ההתחלתי, ללא המיפוי.» to «אתר מובנה: יימחק לגמרי, גם אצל המשתמשים. הוא יחזור רק אם יוסף מחדש, במצב ההתחלתי וללא מיפוי.».
  - Impact line: already «האתר קיים אצל N משתמשים — הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו.» / «האתר לא נמצא אצל אף משתמש.» for all sites (built-in included). Text unchanged; it gains `data-part="impact-users"` as a test hook.
  - The impact line and the built-in line changed from `admin-error` to `IMPACT_NOTICE_CLASS = 'admin-gate-login-banner'`.
  - Failures keep `admin-error`: the C1 error blocks for impact / delete, and the Storage cleanup failure.
- Behavior unchanged: full delete including users' data, built-in included. A built-in re-seeds only when a user adds it again. No SQL, API, reconciliation or gating change.

## Decisions
- **Notice style:** `admin.css` has no generic warning / notice class. The only block-level amber notice is `.admin-gate-login-banner` (a top-level rule: `#fff7ed` background, `#fed7aa` border, `#9a3412` text). The other warning style is the pill badge `.admin-badge--warn`, which doesn't suit sentences. I reused the banner class as-is, per "use an existing warning/notice style", and added no CSS. If Architecture prefers a generically named class (e.g. `.admin-notice`), that is a one-line follow-up.

## Verify
`scripts/verifyPhase121DeleteService.mjs` extended (dialog group):
- Built-in line equals the new copy exactly. The old «יחזור למצב ההתחלתי» is absent from the rendered dialog and from the source.
- Impact line: the N-users copy for an Admin-created site and for a built-in site with users; the zero-users copy for a built-in with 0 users.
- The impact and built-in lines are not `admin-error` and use `admin-gate-login-banner`. No `admin-error` appears inside the impact block.
- Failures stay `admin-error`: every C1 impact / delete error case, plus the Storage failure line.
- Static: the notice class is an existing top-level `admin.css` rule.
- **New mutations caught (6):** U19 old built-in copy restored · U20 impact line styled as error · U21 built-in line styled as error · U22 failure no longer red · U23 zero-users copy changed · U24 notice style not the existing one.
- Result: `PASS — D-121-51 delete site: 4 check groups (SQL / client / dialog / Admin API), 43 mutations caught` (was 37).

## Regression
- 45/45 verifies PASS (41 Phase 116–121 + Phase 101 / 102 / 109 / 113).
- `npx tsc -b` exit 0; `npm run build` exit 0 (usual chunk-size warning); no lints on the touched files.

## Owner live steps
1. Admin → built-in site (e.g. Shufersal) → «מחיקת אתר». You should see two amber (not red) lines: «האתר קיים אצל 2 משתמשים — הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו.» and «אתר מובנה: יימחק לגמרי, גם אצל המשתמשים. הוא יחזור רק אם יוסף מחדש, במצב ההתחלתי וללא מיפוי.». No «יחזור למצב ההתחלתי» line.
2. An Admin-created site with no users: one amber line «האתר לא נמצא אצל אף משתמש.», and no built-in line.
3. Failures (e.g. the migration not applied) still appear in red with «פרטים טכניים» collapsed.

---

# Slice D-121-53 — «אין שינויים לשמירה» under «שמור מיפוי» (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-53 (OWNER APPROVED / AUTHORIZED 2026-09-29) · **Status:** IMPLEMENTED, awaiting Architecture review.

## What changed
- **`src/admin/mappingCopy.ts`:** new `ADMIN_MAPPING_COPY_HE.noChangesToSave` = «אין שינויים לשמירה — המיפוי במסך זהה למיפוי השמור.»
- **`src/admin/AutofillProfileEditor.tsx`** («מיפוי אתר רגיל»):
  - New derived flag `saveBlockedOnlyByNoChanges`. It holds when every `canSave` condition holds except "has unsaved changes": not saving / analyzing / probing / testing / visual pick, `!hasUnsavedChanges`, and `structural.ok || (formIsEmpty && existing)`.
  - When the flag is true, `<p className="admin-muted" data-status="no-changes-to-save">` is rendered under the action buttons row. `admin-muted` is the editor's existing hint style.
  - `canSave`, `hasUnsavedChanges`, the signatures, storage, runtime and extension are untouched. No site branches.

## Decisions
- **SPECIAL grid gets no line** (Owner choice `standard_only`, asked during implementation). In `SpecialLoginDraftEditor.tsx`, «שמור מיפוי» (`data-action="save-special-draft"`) is only `disabled={busy}`, so it is never disabled because nothing changed. Adding the line there would need a new dirty rule, and the slice says no logic change. `SpecialLoginDraftEditor.tsx` is unchanged. The verify pins that SPECIAL renders neither the line nor the copy.
- A saved empty mapping with an empty screen counts as "no changes". Save is disabled via the existing empty-form path, so the line shows.

## Verify
New `scripts/verifyPhase121NoChangesToSave.mjs` (esbuild + SSR + the mini hooks runtime, same harness as `verifyPhase121GridStructure.mjs`):
- **STANDARD states:** clean → line shown, `admin-muted`, under the action buttons, save disabled. Busy (fill test running) → hidden. Structural failure → hidden. Empty saved mapping with an empty screen → shown.
- **STANDARD transitions:** edit the User locator → save enabled, line hidden; revert → line back; fill test running → hidden; stopped → back.
- **SPECIAL grid:** save not disabled; no line and no copy.
- **Static scope:** the copy lives only in `mappingCopy.ts`; the editor has no literal; the `canSave` expression, the dirty rule and the SPECIAL save rule are unchanged; no site branches.
- **Mutations caught (7/7):** M1 shown when dirty · M2 shown while busy · M3 shown on structural failure · M4 missing in the STANDARD grid · M5 line added to the SPECIAL grid · M6 copy changed · M7 line above the action buttons.
- Result: `PASS — D-121-53 «אין שינויים לשמירה»: 4 check groups, 7 mutations caught`.

## Regression
- 45/45 verifies PASS (41 Phase 116–121 + Phase 101 / 102 / 109 / 113). No existing verify changed.
- `npx tsc -b` exit 0; `npm run build` exit 0 (only the usual chunk-size warning); no lints on the touched files.

## Owner live steps
1. Admin → a STANDARD site with a saved mapping → «מיפוי אתר רגיל»: under the buttons you see «אין שינויים לשמירה — המיפוי במסך זהה למיפוי השמור.» and «שמור מיפוי» is disabled.
2. Change a locator: the line disappears and «שמור מיפוי» is enabled. Undo the change: the line returns.
3. Run «בדיקת מילוי»: the line is hidden while the test runs.
4. A SPECIAL site: no such line (its «שמור מיפוי» is always enabled when not busy).

---

# Slice D-121-51 C1 — «מחיקת אתר»: plain-Hebrew errors, raw text under «פרטים טכניים» (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-51 C1 (AUTHORIZED 2026-09-29) · **Status:** IMPLEMENTED, awaiting Architecture review.

## What changed
- **`adminRegistryApi.ts`:**
  - `fetchServiceDeleteImpact` / `adminDeleteService` now throw the raw PostgREST text through the new `serviceDeleteRpcError`: message, details and hint, plus the code, e.g. `… — PGRST202`.
  - They no longer throw the generic `mapRegistryError` text, which wrapped the raw message into the main line.
  - Other registry calls are unchanged.
- **`DeleteServiceDialog.tsx`:**
  - New `deleteServiceErrorView(err)` returns `{message, technical}`. It is the single mapping for both calls (impact effect and confirm). The raw text is matched as follows:
    - `PGRST202` or «Could not find the function» → function missing.
    - «Admin access required» → not admin.
    - «confirmation name does not match» → name mismatch.
    - Anything else → the generic message.
  - The main line (`data-part="message"`, `admin-error`, `role="alert"`) shows only the Hebrew message. The raw text sits in a collapsed `<details>` «פרטים טכניים» (same markup class as the other technical sections).
  - If the impact check failed, «אי אפשר למחוק כרגע — הבדיקה של השפעת המחיקה נכשלה.» (`data-status="delete-service-disabled-reason"`) appears under the name input.
  - Fail-closed is unchanged: confirm requires a loaded impact.
- No SQL, migration, storage or reconciliation change.

## Decisions
- **The mapping lives in the dialog**, so errors that don't come from the RPC (e.g. a session or network failure thrown before the call) get the same treatment: generic message, raw text under «פרטים טכניים».
- **«אין הרשאת מנהל למחיקה.» is also used when the impact check is refused**, since that is the same admin gate.
- **The raw text is shown in a `<code dir="ltr">`** inside the details.

## Verify
`scripts/verifyPhase121DeleteService.mjs` extended: **4 check groups, 37 mutations caught** (was 27).
- **Dialog:** 5 raw-error cases, each run through the impact call and the delete call:
  - PGRST202 full message;
  - PGRST202 code only;
  - Admin access required;
  - name mismatch;
  - a network error.
- **For each case:** the exact Hebrew main message; the raw text absent from the main message; «פרטים טכניים» present, collapsed, and holding the raw text; no success on delete failure.
- **For the impact cases also:** the disabled-reason line is present, placed after the name input, and the confirm button stays disabled even with the exact name typed. The line is absent while the impact is loading and when it loaded.
- **Admin API:** a PGRST202 error from either RPC reaches the dialog with `PGRST202` and «Could not find the function» intact.
- **New mutations**, all caught:
  - U9: raw text as the main message.
  - U10: function-missing mapping removed.
  - U11: not-admin mapping removed.
  - U12: name-mismatch mapping removed.
  - U13: disabled-reason line missing.
  - U14: details open by default.
  - U15: technical text dropped.
  - U16: impact call not mapped.
  - U17: delete call not mapped.
  - U18: the API drops the raw text.
- **Harness note:** the dialog's mini hooks runtime does not render nested components, so the error block is a render function (`renderErrorBlock`), not a sub-component.

## Regression
All 40 Phase 116–121 verifies PASS, plus `verifyPhase101FailureMode`, `verifyPhase102CredentialSchema`, `verifyPhase109Accounts` and `verifyPhase113LoginAssistance` (44/44). `npx tsc -b` exit 0; `npm run build` exit 0; no lints.

## Owner live
With the migration still not applied, open «מחיקת אתר» on a site. Expected:
- «מחיקת אתרים עוד לא הופעלה במסד הנתונים (חסר עדכון מסד נתונים). לא נמחק דבר.»;
- the PGRST202 text only after opening «פרטים טכניים»;
- under the name input, «אי אפשר למחוק כרגע — הבדיקה של השפעת המחיקה נכשלה.»;
- the button disabled.

After applying the migration, the impact loads and the delete works as in D-121-51.

---

# Slice D-121-50 C1 — «שדות כניסה» hints follow the control's state (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-50 C1 (OWNER-REPORTED BUG, AUTHORIZED 2026-09-29) · **Status:** IMPLEMENTED, awaiting Architecture review.

## What changed (`src/admin/CredentialFieldsEditor.tsx`, copy only)
- The static `allowedValueHint` («ספרות בלבד — המערכת תדחה אותיות (למשל ת"ז).») is replaced by `allowedAnyHint` / `allowedDigitsHint`. The hint under «ערך מותר» is chosen from `field.inputType`:
  - `text` («כל תו») → «אפשר להקליד אותיות, ספרות וסימנים.»
  - `number` («ספרות בלבד») → «המערכת תדחה אותיות ותווים שאינם ספרות (למשל ת"ז).»
  - It re-renders when the selection changes.
- `sitePasswordHint` now starts with «כשמסומן: », followed by the existing text unchanged. It is shown whether or not the box is checked.
- Stored shape, `editorFieldsToStored` / `editorFieldsFromStored`, `sitePasswordPatch` and the legacy «מוסתר בתצוגה» rule are unchanged.

## Decision
Any value other than `number` shows the «כל תו» hint. That matches the select, which maps every non-number `inputType` to «כל תו».

## Verify
`scripts/verifyPhase121CredentialFieldCopy.mjs` extended: **7 check groups, 19 mutations caught** (was 16).
- **Expected copy:** the password hint now has the prefix, and the one static hint is replaced by the two per-value hints.
- **Copy + order:** each row shows the hint of its own value in the same position, never the other value's hint, and never the retired static hint.
- **Site-password group:** every row's hint starts with «כשמסומן: », checked or not.
- **«ערך מותר» group:** «כל תו» and «ספרות בלבד» each show their own hint; switching to «ספרות בלבד» and back switches the hint (real editor, mini hooks runtime).
- **New mutations**, all caught:
  - M17: a static hint.
  - M18: swapped hints.
  - M19: missing «כשמסומן: » prefix.
- **Superseded assertion:** the D-121-50 check expecting the single static «ערך מותר» hint on every row is replaced by the per-value check above, as authorized by C1.

## Regression
All **40** Phase 116–121 verifies PASS, plus `verifyPhase101FailureMode`, `verifyPhase102CredentialSchema`, `verifyPhase109Accounts` and `verifyPhase113LoginAssistance` (44/44). `npx tsc -b` exit 0; `npm run build` exit 0; no lints.

## Owner live
Admin → any site → «שדות כניסה»:
- A «כל תו» field shows «אפשר להקליד אותיות, ספרות וסימנים.».
- Switching it to «ספרות בלבד» shows «המערכת תדחה אותיות ותווים שאינם ספרות (למשל ת"ז).».
- The password checkbox hint starts with «כשמסומן: ».

## Constraints kept
Copy only. No stored-shape, runtime, contract or extension change. No site branches.

---

# Slice D-121-52 — Analyze inspect readiness waits for Managed-eligible inputs (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-52 (OWNER APPROVED / AUTHORIZED 2026-09-29) · **Status:** IMPLEMENTED, awaiting Architecture review.

## Root cause (from M1 evidence, arch file)
`collectSafePageStructureWithReadiness` exited on the first poll where `page.inputs.length > 0`. `inputs` includes Managed-ineligible controls (`managedEligible` is only a flag). On SPA login pages the inputs exist while still covered (boot overlay / transition). The snapshot was taken at that moment, so safety validation dropped every field: `no_confident_mapping`, 0 proposals, 3 unmapped.

## What changed (`extension/generic/page-structure-inspect.js` only)
- **New `inspectReadinessCounts(inputs)`** returns `{eligibleInputs, visibleIneligibleInputs}`. It is computed from the existing `managedEligible` / `visible` flags only; it reads no values.
- **Early exit** only when `eligibleInputs > 0 && visibleIneligibleInputs === 0`. Otherwise it keeps polling with the existing interval and maximum (Admin inspect passes 250 ms / 10 s, unchanged). On timeout it returns the last snapshot with `timedOut: true` (today's shape).
- **Both readiness reports** (early exit and timeout) add the two counts. No Hub code reads `readiness`, so there's no consumer change.
- **Unchanged:** runtime fill, Digital Home, `validated-autofill.js`, `fill-executor.js`, the eligibility / hit-test rules (D-121-49) and the locator rules (D-121-48). Both call sites in `background.js` (STANDARD Analyze and SPECIAL Analyze with `stableLocators`) are unchanged and pick up the rule, so it applies to all patterns.

## Decisions (for review)
1. **"Visible" means the existing observation flag `visible`** (`isObservedForIdentification`: not disabled, not display:none / visibility:hidden, non-zero rect). Disabled and hidden inputs never delay the exit; later-step fields that are hidden (display:none) don't either.
2. **An input that is visible but ineligible for another reason** (e.g. `aria-hidden` on itself, or smaller than 2 px) also waits up to the maximum, then returns today's snapshot. This is the accepted cost in the arch entry: same result, up to 10 s later.
3. **The page with no eligible input at all** (no inputs, or only hidden ones) keeps today's behavior: poll to the maximum, then return the last snapshot.
4. **Verify harness update, not an assertion change:** `verifyPhase119ReadinessWaitInputs.mjs` loaded the inspect script without the eligibility module, so every fixture input was `managedEligible:false`. The extension always injects `managed-target-eligibility.js` first, and the verify checks that order. The harness now sets `ManagedTargetEligibility.isSafeFillTarget = () => true`, since its fixtures are plain, uncovered inputs. All T-R assertions are unchanged and PASS.
5. **SHA pins:** no existing verify pins `page-structure-inspect.js`, so no pin needed updating. For future slices, the new revert helper `scripts/lib/phase121D52ReadinessEdits.mjs` lists the exact edits; reverting them gives the pinned pre-slice bytes (`c4dd466d…`). The rule it restores is the committed Phase 119 rule.

## Verify
New `scripts/verifyPhase121InspectReadinessEligible.mjs`: **5 check groups, 7 mutations caught.**
- **How it runs:** the real `managed-target-eligibility.js` + `locator-determinism.js` + `page-structure-inspect.js` are loaded in linkedom, with a controllable overlay driving `elementFromPoint`. Each snapshot goes through the real Hub `applySafetyAndConfidence`. Each fixture also runs on the pre-slice script produced by the revert helper.
- **Rule 1, overlay then uncovered:**
  - With all 3 inputs covered for 600 ms, it keeps polling and exits once they are eligible. Analyze then gives `ok` with 3 proposals.
  - The pre-slice code snapshots on the first poll with all inputs ineligible, giving `no_confident_mapping`, 0 proposals, 3 unmapped and 3 identified-but-ineligible. That is exactly M1.
  - A partial overlay covering one field also waits.
- **Rule 2, eligible at once:** it exits on the first poll (1 snapshot, no interval waited), with the same snapshot and Analyze result as pre-slice. Hidden and disabled inputs don't delay it, and the counts ignore them.
- **Rule 3, permanently occluded** (one visible input, and all inputs): it polls to the maximum and times out, bounded by the maximum. It returns the last snapshot, which is the same snapshot and Analyze result as today.
- **Rule 4, no inputs, or only hidden inputs:** today's timeout with the same snapshot; the origin mismatch check is unchanged.
- **Scope** (reads files from disk):
  - Reverting the D-121-52 edits gives the pinned pre-slice bytes, and the pre-slice rule is the committed Phase 119 rule.
  - The new code reads no values, storage, hostname or serviceId.
  - `managed-target-eligibility.js` is untouched outside D-121-49.
  - `validated-autofill.js`, `fill-executor.js` and `locator-determinism.js` are byte-identical; the manifest is unchanged; the 10 s / 250 ms bounds are unchanged.
  - Eligibility is injected before the inspect script on both Analyze paths.
- **Mutations**, all caught:
  - M1 exits on any input (pre-slice rule).
  - M2 drops the visible-ineligible condition.
  - M3 drops the ≥1 eligible condition.
  - M4 lets hidden ineligible inputs block the exit.
  - M5 reads eligibility from the observation flag.
  - M6 drops the last snapshot on timeout.
  - M7 doesn't honor the maximum wait.

## Regression
- All **40** Phase 116–121 verifies PASS, plus `verifyPhase101FailureMode`, `verifyPhase102CredentialSchema`, `verifyPhase109Accounts` and `verifyPhase113LoginAssistance` (44/44).
- `npx tsc -b` exit 0; `npm run build` exit 0 (only the existing chunk-size warning); no lints on the changed files.

## Owner live
Reload the unpacked extension. Admin → the Mercantile site (STANDARD) → «נתח דף כניסה» right after the login page opens. Expected: proposals for the 3 fields (e.g. `#tzId` / `#tzPassword` / `#aidnum`) instead of «זוהה אך אינו כשיר למילוי אוטומטי מנוהל». Any site that passed before should give the same result, just as fast.

## Constraints kept
- No site, hostname or serviceId branches; no manifest or permission change.
- No runtime, contract or Digital Home change.
- final_submit untouched; 121.3+ not started.

---

# Slice D-121-51 — Admin «מחיקת אתר» (permanent site delete) + client reconciliation (2026-09-29)

**Detected phase:** 121 · **Selected state:** D-121-51 (OWNER APPROVED / AUTHORIZED 2026-09-29) · **Status:** IMPLEMENTED, awaiting Architecture review.

## What changed
1. **Migration** `supabase/migrations/20260929120000_phase121_admin_delete_service.sql`:
   - `public.admin_audit_log` table (actor_user_id, action, service_id, details jsonb, created_at).
     - RLS is on. Admins can select. Nobody can insert, update or delete directly; rows are written only by the security-definer function.
   - `public.is_known_builtin_service_id(id)`: the same 13-id allowlist as `ensure_known_builtin_registry_row`. The verify checks that the two lists match.
   - `public.admin_service_delete_impact(p_service_id)` returns `{users_count, profiles_count, is_builtin}`.
     - Security definer, `search_path = public`.
     - Admin check via the existing `public.is_admin()`; otherwise `Admin access required`.
     - Only global rows (`owner_user_id is null`) qualify; otherwise `global service not found`.
   - `public.admin_delete_service(p_service_id, p_confirm_display_name)`: same admin check and global-only scope; runs in one transaction.
     - Locks the row with `for update`.
     - The confirm name must equal `display_name`, ignoring surrounding spaces. Otherwise it raises `confirmation name does not match the site name`.
     - Deletes `user_services` for the id. This cascades to `access_profiles`, then to `encrypted_credentials`.
     - Then deletes `service_assets`, then the `service_registry` row.
     - Inserts an audit row: actor = `auth.uid()`, action `delete_service`, the service id, `created_at` = now, and details = counts + display_name.
     - Returns `{users_count, profiles_count, credentials_count, assets_count, is_builtin, asset_paths}`.
   - `public.registry_service_ids_existing(p_service_ids text[])` returns `{existing, registry_rows}`.
     - It's a presence check used by client reconciliation, and it ignores status: a disabled site is not a deleted site. User RLS hides disabled rows, which is why a new RPC is needed.
     - It only reveals global rows or the caller's own rows. It requires an authenticated caller and accepts at most 500 ids.
   - Every function: revoke all from public and anon; grant execute to authenticated. The admin check is inside the function.
2. **Storage cleanup (best-effort):** new `src/serviceAssets/removeServiceAssetObjects.ts`.
   - Removes every object under `global/<id>/` (it lists subfolders) plus the `storage_path`s the RPC returned.
   - It never throws. A failure is returned, shown in the dialog («מחיקת קבצי התמונות מהאחסון נכשלה…») and does not undo the DB delete.
   - Ids containing `/` or `..` are refused.
3. **Client reconciliation (R1/R2):** new `src/supabase/registryPresence.ts`, wired into `src/supabase/persistence.ts`.
   - Sync upserts only registry-present ids plus private customs.
   - Hydrate (both branches) drops missing ids from `selectedIds`, together with their local profiles and ciphertext.
   - If presence is unknown (RPC error, malformed data, or `registry_rows = 0`), behavior stays as it is today, so a wiped registry or an unapplied migration never wipes user data.
   - Private customs are never sent for judgment.
   - Built-in ids re-seeded by `ensure_known_builtin_registry_row` exist again, so they are kept (R2).
   - Generic: no site, hostname or serviceId branches.
4. **Admin UI:**
   - `RegistryAdmin.tsx`: danger button «מחיקת אתר» on global site cards (not user-owned rows).
   - New `DeleteServiceDialog.tsx` shows:
     - the impact line «האתר קיים אצל N משתמשים — הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו.»;
     - for built-ins, «אתר מובנה — יחזור למצב ההתחלתי, ללא המיפוי.»;
     - an input for typing the site name.
   - Confirm is enabled only when the impact has loaded and the typed name matches exactly (trimmed).
   - It shows the result counts, then the list reloads.
   - `adminRegistryApi.ts`: `fetchServiceDeleteImpact`, `adminDeleteService`. The latter calls the RPC, invalidates the catalog cache, runs the Storage cleanup and invalidates the logo cache.

## Decisions (for review)
- **`is_builtin` uses the ensure allowlist, not `source_type`.** Promoted submissions are also `built_in` but are never re-seeded, and the copy promises «יחזור».
- **Delete is limited to global rows** in both SQL and UI. Private customs belong to their owners.
- **Copy additions:**
  - N = 0 shows «האתר לא נמצא אצל אף משתמש.».
  - An irreversible note appears above the typed-name input.
  - Confirm label «מחק את האתר»; after success «האתר נמחק.» plus counts.
- **Confirm name comparison trims surrounding spaces**, the same way in SQL and in the client.
- **The audit row is written inside the same transaction.** If the audit insert fails, the delete rolls back.
- **Unknown presence = today's behavior** (fail-safe toward keeping user data).
- **PGlite added as a devDependency** (`@electric-sql/pglite@0.5.8`) so the verify runs the real SQL in Postgres (WASM). No runtime dependency change.

## Verify
New `scripts/verifyPhase121DeleteService.mjs`: **4 check groups, 27 mutations caught.**
- **A. SQL** (PGlite with the real Phase 101 / 109 / 111 schema and the migration):
  - privileges: non-admin and anon are rejected;
  - impact counts;
  - wrong or empty confirm name is rejected; user-owned rows are refused;
  - atomicity: a forced failure leaves every row intact;
  - a full delete removes user_services, profiles, ciphertext, assets and the registry row, and returns the counts;
  - exactly one audit row;
  - the presence RPC: disabled rows count as present, and other users' private rows are not revealed;
  - the allowlist matches the ensure list.
- **B. Client:** the real `persistence.ts` with a fake Supabase.
  - Sync filter.
  - Hydrate, empty-cloud and keep-local branches: the deleted service is dropped with its credentials.
  - Unknown presence (error, or empty registry) keeps today's upserts.
  - A re-seeded built-in is kept; customs are exempt.
- **C. Dialog:** confirm stays disabled until the impact loads and the typed name matches; a mismatched click never deletes; exact impact copy, built-in copy, zero-users copy; result counts; errors.
- **C. Admin API:** RPC, then Storage cleanup of the prefix plus row paths; Storage failure is reported without throwing.
- **Mutations:** S1–S12 (SQL), C1–C7 (client), U1–U8 (UI/API), all caught.
- No existing verify assertion was superseded.

## Regression
- All **39** Phase 116–121 verifies PASS, plus `verifyPhase101FailureMode`, `verifyPhase102CredentialSchema`, `verifyPhase109Accounts`, `verifyPhase113LoginAssistance` (43/43).
- `npx tsc -b` exit 0; `npm run build` exit 0 (only the existing chunk-size warning); no lints on the changed files.

## How the migration is applied here
- **Not applied by the developer.** This environment has no Supabase CLI install, psql or docker, and no DB credentials.
- The Owner applies `supabase/migrations/20260929120000_phase121_admin_delete_service.sql` on the linked project `wbehjoraatkrpsbgyunx` in one of two ways:
  - Supabase Dashboard → SQL Editor → paste the file → Run;
  - or `npx supabase link --project-ref wbehjoraatkrpsbgyunx` then `npx supabase db push`.
- Until it's applied:
  - the presence RPC is missing, so clients keep today's behavior (unknown presence);
  - «מחיקת אתר» shows the RPC error in the dialog and deletes nothing.

## Owner live steps (after applying)
1. As Admin, open a test global site that at least one test user has. Press «מחיקת אתר» and confirm that N matches.
2. Confirm stays disabled until the exact name is typed. Confirm, check the counts, and check that the list reloads without the site.
3. Check that the Storage folder `service-assets/global/<id>/` is empty.
4. The test user signs in (or syncs): the site disappears and doesn't come back after another sync.
5. Built-in (optional, test user only): delete it and see «אתר מובנה…». Re-adding it from Discover recreates the row without a mapping.

## Constraints kept
No site, hostname or serviceId branches (only the built-in allowlist that mirrors the existing ensure function). No manifest or permission change. No autofill, runtime or contract change. final_submit untouched. 121.3+ not started.

---

# Slice D-121-50 + A1 — «שדות כניסה» editor: plain-language field controls (2026-09-29)

**Source:** `arch-phase121.md` → "D-121-50" (proposal table) + "D-121-50 A1 — FINAL" (one site-password checkbox, no separate «מוסתר», legacy exception). A1 replaces rows 2 and 5 of the table. Scope: `src/admin/CredentialFieldsEditor.tsx` UI copy / controls only. Unchanged:
- the stored shape (`id`, `label`, `required`, `masked`, `inputType`, `type`);
- `editorFieldsFromStored` / `editorFieldsToStored`;
- runtime, contract, extension, Hub, manifest.

No site branches.

## What changed (per field, in this order)

| # | Control | Writes | Hint (`admin-field-hint`) |
|---|---|---|---|
| 1 | «שם השדה» (was «תווית») | `label` | כך השדה יופיע למשתמש. הסוכן משתמש בו גם כדי למצוא את השדה באתר. |
| 2 | checkbox «זה שדה הסיסמה של האתר» (replaces «תפקיד מילוי (מתקדם)»); checked ⇔ `type === 'password'` | on change only: checked → `type 'password'` + `masked true`; unchecked → `type 'text'` + `masked false` (`sitePasswordPatch`) | המערכת תחפש לו שדה סיסמה באתר, תשמור את הערך בדיוק כפי שהוקלד (כולל רווחים), והערך יוסתר תמיד אצל המשתמש. |
| (legacy) | checkbox «מוסתר בתצוגה», only when `type !== 'password' && masked === true` (`showsLegacyMaskedControl`) | `masked` | — |
| 3 | «ערך מותר»: «כל תו» (`text`) / «ספרות בלבד» (`number`) (was «סוג קלט») | `inputType` | ספרות בלבד — המערכת תדחה אותיות (למשל ת"ז). |
| 4 | «חובה למלא» (was «חובה») | `required` | המשתמש לא יוכל לשמור בלי ערך בשדה הזה. |
| 5 | «מזהה טכני» inside a per-field `<details>` «מתקדם», collapsed by default | `id`; the existing `ID_CHANGE_WARNING` confirm on blur is unchanged | לשימוש פנימי. שינוי ינתק ערכים שכבר נשמרו אצל משתמשים. |

- The «מוסתר» checkbox is removed.
- Move up / down / remove and «הוסף שדה» are unchanged; a new field is still `type 'text'`, `masked false`, `inputType 'text'`, `required true`.
- The copy lives in `CREDENTIAL_FIELD_COPY_HE`, in the same file.

## Decisions

1. **Checkbox state comes from `type` only**, never from `masked`. A legacy password field stored with `masked false` shows as checked and is not rewritten until the Admin toggles it.
2. **`masked` is written only as part of a change.** Loading, rendering and saving an untouched field emit no patch, so its stored output is byte-identical: `editorFieldsToStored` still writes the editor values as-is.
3. **Legacy «מוסתר בתצוגה» sits right after the site-password checkbox**, because it is the display-related control. Its position wasn't specified. It has no hint line, because the brief gives no copy for it. Clearing it writes `masked false` only, and the control then disappears; it can't be re-added, as A1 requires.
4. «ערך מותר» stays a `<select>` with `value="number"`, so the Phase 102 assertion "editor must offer NUMBER" still holds.
5. «מתקדם» uses the existing `admin-details` style. No CSS change.

## Verify

New `scripts/verifyPhase121CredentialFieldCopy.mjs`. The real editor is server-rendered with real React and driven with the minimal hooks runtime. The fixtures are:
- text + masked false;
- **legacy password + masked false**;
- **legacy text + masked true**, digits;
- password + masked true.

Check groups:
1. Copy, hints (`<p class="admin-field-hint">`) and order in every row. The technical id appears only under a collapsed «מתקדם». Retired copy is gone: «תפקיד מילוי», «תווית», «סוג קלט», «סיסמת אתר», and the standalone «מוסתר».
2. The site-password checkbox is checked ⇔ type password, ignoring masked. Checking writes password + masked true; unchecking writes text + masked false; nothing else in the field changes, and other fields stay byte-identical.
3. Untouched fields are byte-identical: a round trip without edits, and edits to the label / required / allowed value / site-password of another field, each keep both legacy fields byte-identical.
4. Legacy «מוסתר בתצוגה» is rendered only for text + masked true. Clearing it writes masked false only, and after re-render the control is gone.
5. «ערך מותר» ⇔ inputType, in both directions. It doesn't touch type or masked.
6. The technical id change asks `ID_CHANGE_WARNING`: declining writes nothing, accepting writes the new id, and an unchanged id asks nothing. A new field is text / masked false.
7. Static scope: `editorFieldsToStored` passes the values through, and there are no site branches.

Mutations (**16 caught**):
- copy: M1 label back to «תווית», M12 wrong «ספרות בלבד» label;
- hints: M2 label hint, M3 site-password hint and M16 required hint not rendered;
- order: M4 «חובה למלא» moved before «ערך מותר»;
- site-password checkbox: M5 bound to masked, M6 checking doesn't set masked, M7 unchecking keeps masked;
- M8 stored masked derived from type, which breaks byte-identity;
- legacy checkbox: M9 shown for every text field, M10 never shown;
- M11 «ערך מותר» ignores the choice;
- M13 id change without the confirm;
- M14 «מתקדם» open by default;
- M15 new field masked.

**Result: 7 check groups, 16 mutations caught.**

**Existing verifies:** no assertion superseded. `verifyPhase102CredentialSchema.mjs` reads this editor, checking `ID_CHANGE_WARNING`, `inputType` and `value="number"`, and still passes. No other verify reads the editor copy.

## Regression

- All **38** Phase 116–121 verifies PASS (37 + the new one).
- In the first full loop, `verifyPhase121AnalyzeProposalQuality.mjs` failed once in `checkRevealFrames`, a timing check in the extension Analyze reveal. It touches no file from this slice. Re-run alone it passed (12 groups / 15 mutations), and a second full loop was **38/38 PASS**.
- `verifyPhase102CredentialSchema.mjs` PASS.
- `npx tsc -b` exit 0; `npm run build` exit 0; ReadLints: no errors on the edited files.

## Owner live steps

1. Admin → a row → «שדות כניסה». Each field shows, in order: «שם השדה», «זה שדה הסיסמה של האתר», «ערך מותר», «חובה למלא», each with a grey hint, then a collapsed «מתקדם» that holds «מזהה טכני».
2. A password field is shown checked. Uncheck it, save, then reload: it is a regular field, and the user sees the value unmasked. Check it again, save: it is a password field, and the user sees the value masked.
3. «ערך מותר» = «ספרות בלבד» on a field, save: the user's entry of letters there is rejected.
4. Change «מזהה טכני»: the existing warning appears, and cancelling keeps the old id.
5. (If a row has one) a non-password field that was masked shows «מוסתר בתצוגה»; uncheck it, and it disappears.

---

# Slice D-121-45 C1 — hide manual-pick buttons irrelevant to the selected pattern (2026-09-29)

**Source:** `arch-phase121.md` → "Owner live D-121-45" (layout OK) + "D-121-45 C1". Issue: in the SPECIAL grid, a manual-pick button that doesn't apply to the selected pattern was shown disabled. Scope: UI only. Storage, contract, runtime, Digital Home, extension, manifest and permissions are unchanged. No site / hostname / serviceId branches.

## What changed

| Item | Where | What |
|---|---|---|
| Opener pick | `src/admin/SpecialLoginDraftEditor.tsx` | «סמנו בעצמכם את כפתור פתיחת המסך הצף» (`data-action="special-visual-opener"`) is rendered only when `manualPickRelevant('floating_opener', pattern)`: FLOATING_SCREEN and FLOATING_SCREEN_MULTI_STEP |
| Transition pick | same | «סמנו בעצמכם את כפתור המעבר בין השלבים» (`data-action="special-visual-transition"`) is rendered only when `manualPickRelevant('intermediate_transition', pattern)`: MULTI_STEP and FLOATING_SCREEN_MULTI_STEP |

## Decisions

1. **One rule.** Visibility comes only from `manualPickRelevant` (= `actionKindRelevantForPattern`, the D-121-46 A1 helper). No new pattern lists.
2. **Enabled / disabled logic unchanged for rendered buttons.** It is still `busy || !canUseCurrentSurface || !topBar.opener|transition`. When a button is rendered, the `!topBar.*` term is always false, because `specialTopBarEnablement` uses the same rule. It is kept on purpose, per "today's logic".
3. **Analyze always rendered** (not pattern-dependent), same as before.
4. **Unchanged:** the `specialTopBarEnablement` matrix, the armed-pick cancel on pattern change, the button panels, and draft normalization.

## Verify

- `scripts/verifyPhase121GridStructure.mjs` gets a new check group: manual-pick visibility per pattern, via SSR of the SPECIAL grid. For each SPECIAL pattern:
  - each `data-action` appears exactly 0 or 1 times;
  - each label is present or absent as expected;
  - a relevant button is not disabled when idle;
  - Analyze is still rendered.
- New mutations:
  - **M11:** the transition pick is always rendered, which renders an irrelevant button for FLOATING_SCREEN;
  - **M12:** the opener pick is rendered only for FLOATING_SCREEN_MULTI_STEP, which hides a relevant button for FLOATING_SCREEN.
- Result: **7 check groups, 12 mutations caught** (previously 6 / 10).

## Superseded assertion re-homed

| Verify | Old assertion | Now |
|---|---|---|
| `verifyPhase121ActionBar.mjs` (row checks, ~l. 402–410) | "buttons always rendered (enablement via disabled only)" | "Analyze always rendered; no topBar-based wrapper" + "opener rendered only when relevant (manualPickRelevant)" + "transition rendered only when relevant (manualPickRelevant)". The "disabled" assertions are kept, relabelled "today's disabled logic kept when rendered" |

Checked and still valid with no change:
- `verifyPhase121SpecialDraftAuthoring.mjs`: Visual button source + waiting / idle labels;
- `verifyPhase121UnifiedVocabulary.mjs`: the SPECIAL-only controls exist in source.

## Regression

- All **37** Phase 116–121 verifies PASS.
- `npx tsc -b` exit 0.
- `npm run build` exit 0.
- ReadLints: no errors on the edited files.

## Owner live steps

1. Admin → a row → «אופי הכניסה» = מסך צף: only «סמנו בעצמכם את כפתור פתיחת המסך הצף» is shown (next to Analyze).
2. = כניסה רב־שלבית: only «סמנו בעצמכם את כפתור המעבר בין השלבים» is shown.
3. = מסך צף רב־שלבי: both are shown.
4. Switch between the patterns: the buttons appear and disappear accordingly. A shown button is enabled or disabled as before (e.g. disabled while busy or on a wrong tab).

---

# Slice D-121-45 — Admin grid structure: «אופי הכניסה» + one mapping grid per selected pattern (2026-09-29)

**Source:** `arch-phase121.md` → "D-121-45" (proposed layout, Owner decision "only the grid of the selected «אופי הכניסה» is shown", future-grid note = backlog, not implemented). Scope: Admin UI composition only.

## What changed

| Item | Where | What |
|---|---|---|
| Cross-cutting grid (1) | new `src/admin/LoginPatternGrid.tsx` | «אופי הכניסה»: pattern selector (`data-action="login-pattern"`, same 4 options), explanation («בחירת אופי הכניסה לא משנה דבר…»), the D-121-43 status line of the selected pattern (SPECIAL → `specialMappingStatus`, STANDARD → `standardMappingStatus`, both from the saved row) and the collapsed «פרטים טכניים» (SPECIAL: entry surface / URL / live contract; STANDARD: «מצב תמיכה»). No buttons, no inputs, no writes |
| Selection lifted | `src/admin/RegistryAdmin.tsx` | The row-keyed selection lives in `RegistryAdmin`. If the Admin hasn't touched the selector, it is the saved pattern (`savedAuthoringPattern`, the same rule the SPECIAL editor used for its initial state). One value feeds the cross-cutting grid, the SPECIAL grid (`selectedPattern`), «מיפוי אתר רגיל» (`specialPatternSelected`) and «בדיקת מילוי» (`selectedPattern`). Order: «אופי הכניסה» → SPECIAL grid → «מיפוי אתר רגיל» → «בדיקת מילוי» |
| STANDARD grid (2) | `src/admin/AutofillProfileEditor.tsx` | Title «מיפוי אתר רגיל» (shared copy `ADMIN_GRID_COPY_HE.standardTitle`). Renders nothing while a SPECIAL pattern is selected; the SPECIAL-selected notice (`SPECIAL_PATTERN_GRID_NOTICE_HE`) is removed. Its status line moved to «אופי הכניסה». The in-progress indicators (analyzing / probing / Visual) stay in this grid as their own line. Everything else is unchanged, including the Analyze / Visual gates and the SPECIAL→STANDARD switch-confirm on «אשר מיפוי» |
| SPECIAL grid (3) | `src/admin/SpecialLoginDraftEditor.tsx` | Holds the remaining content: Analyze, opener / transition pick, button panels, frame approval, fields, completeness, «שמור מיפוי» / «אשר מיפוי». Title from `SPECIAL_GRID_TITLE_HE[pattern]`. Renders nothing for STANDARD. It no longer has the selector or the status line; it follows the `selectedPattern` prop through the existing `onPatternChange` path (armed-pick cancel, draft transition, panels, step reset) |
| «בדיקת מילוי» (4) | — | Unchanged; it still receives the selected pattern |
| Copy | `src/admin/mappingCopy.ts` | `ADMIN_GRID_COPY_HE` (cross-cutting title / explanation, STANDARD title) and `SPECIAL_GRID_TITLE_HE` (per SPECIAL pattern). `SPECIAL_EDITOR_COPY_HE.title` / `editorHint` / `standardHint` removed |
| Unchanged | — | Storage, contract, runtime, Digital Home, extension, manifest, permissions. No site / hostname / serviceId branches. The future split-input grid (architect note) is not started |

## Unsaved changes when the selector changes (item 5 — today's behavior kept)

- **Both mapping grids stay mounted.** A hidden grid renders nothing but keeps its state, exactly as before, when both grids were on screen.
- **STANDARD edits** survive any selector change. «מיפוי אתר רגיל» keeps its unsaved locators while hidden, still reports `hasUnsavedChanges` to «בדיקת מילוי», and shows them again when STANDARD is selected.
- **SPECIAL ↔ SPECIAL** (e.g. FLOATING_SCREEN → FLOATING_SCREEN_MULTI_STEP): as today, `ensureSpecialDraft` carries the actions and steps into the new pattern. The pattern change counts as an unsaved change, so the SPECIAL «בדיקת מילוי» stays blocked until «שמור מיפוי».
- **SPECIAL → STANDARD:** as today, the editor clears its in-memory SPECIAL draft (`onPatternChange` → `setDraft(null)`). The saved draft in the row is untouched, and nothing is written.
  - Selecting a SPECIAL pattern again starts from an empty draft of that pattern (today's behavior); unsaved SPECIAL edits made before the switch are not brought back. «שמור מיפוי» / «אשר מיפוי» still act only on what is saved.
  - **Residual for Architecture:** this is a pre-existing loss path, kept per "keep today's behavior". Closing it (for example a confirm, or keeping the draft) would be a behavior change that needs a decision.

## Developer decisions (for review)

1. **Hide, don't unmount.** Visibility is decided inside each grid (it returns `null`), and `RegistryAdmin` always mounts both. This keeps item 5's behavior identical to today, keeps «בדיקת מילוי» fed by the STANDARD grid's shared state, and keeps the SPECIAL session tab / armed-pick cleanup unchanged.
2. **Selector lock follows the visible grid.**
   - SPECIAL selected: the same rule as before (`busy && armedPick?.target !== 'action'`), now reported by the SPECIAL grid.
   - STANDARD selected: locked while «מיפוי אתר רגיל» is busy (saving / Analyze / probe / Visual). This is new. Without it, a running STANDARD pick could finish inside a hidden grid.
3. **Explanation** = the existing hint «בחירת אופי הכניסה לא משנה דבר במסך הבית של המשתמשים עד «אשר מיפוי».». The old «דפוס רגיל — השתמשו בעורך המילוי האוטומטי הרגיל.» is removed, because the STANDARD grid now appears directly below.
4. **Status line of the selected pattern.** It is derived from the saved row (D-121-43 rule, unchanged). With STANDARD selected on a row that only has a SPECIAL draft, it shows the STANDARD status, which is none.
5. **Untouched selector** = the saved pattern, computed in the parent with `savedAuthoringPattern`. The SPECIAL grid also falls back to it when no selection is passed.

## Evidence

- New `scripts/verifyPhase121GridStructure.mjs` (6 check groups, 10 mutations caught). It server-renders the real grids and drives the real editors with the minimal hooks runtime for switches:
  - For each of the 4 patterns, exactly one mapping grid renders. STANDARD shows «מיפוי אתר רגיל». FLOATING_SCREEN / MULTI_STEP / FLOATING_SCREEN_MULTI_STEP show their own titles, and never another pattern's. The old title and the SPECIAL-selected notice are gone. With no selection passed, the saved pattern's grid renders.
  - «אופי הכניסה»:
    - title, explanation, one select with 4 options showing the selected pattern;
    - no `<button>` / `<input>` and none of 17 authoring actions;
    - collapsed «פרטים טכניים»;
    - SPECIAL row → SPECIAL status + SPECIAL technical; STANDARD selected → STANDARD status + technical;
    - `disabled` locks the select;
    - neither mapping grid has a selector or a second status line.
  - Switch (SPECIAL grid): FLOATING_SCREEN → FLOATING_SCREEN_MULTI_STEP (title + «שלב נוכחי», unsaved reported) → STANDARD (not rendered) → MULTI_STEP (title). Idle selector lock is reported.
  - STANDARD edits kept: edit a locator → SPECIAL selected (grid not rendered, still reports unsaved) → STANDARD again (edit still there, «אשר מיפוי» present).
  - «בדיקת מילוי» route follows the selected pattern.
  - Wiring:
    - grid order and one shared selection;
    - no conditional mount in `RegistryAdmin`;
    - switch-confirm kept;
    - «אופי הכניסה» has no state and no writes;
    - no site branches; manifest permissions unchanged.
  - Mutations: STANDARD grid shown while SPECIAL; SPECIAL grid shown for STANDARD; SPECIAL title ignores the pattern; authoring control in «אופי הכניסה»; status line dropped; status line ignores the pattern; SPECIAL grid ignores the parent selection; selector lock ignored; STANDARD grid unmounted while SPECIAL (edits lost); old STANDARD title.
- **Superseded assertions, updated (9 in 4 verifies):**
  1. `verifyPhase121ActionBar.mjs`: the select's `disabled={busy && armedPick?.target !== 'action'}` in the SPECIAL editor → `const selectorLocked = busy && armedPick?.target !== 'action';` + «אופי הכניסה» `disabled={disabled}`.
  2. `verifyPhase121ApproveSavedOnly.mjs`: the status read from the SPECIAL editor's `MappingStatusLine` props → the same derivation (`specialMappingStatus`) on the row the editor holds, which is what «אופי הכניסה» renders. A1–A4 and the mutations are unchanged.
  3. `verifyPhase121SpecialDraftAuthoring.mjs` AC-121.1-1: the pattern labels / selector / `data-action="login-pattern"` are now checked in `LoginPatternGrid.tsx` + `mappingCopy.ts`.
  4. `verifyPhase121SpecialDraftAuthoring.mjs` D-121-24: `onPatternSelected?.(pattern)` / `onPatternSelected={onAuthoringPatternSelected}` → `onPatternChange={onAuthoringPatternSelected}` / `selectedPattern={selectedAuthoringPattern}`.
  5. `verifyPhase121SpecialDraftAuthoring.mjs` D-121-24 notice block (conditional notice, text, quoted label, jargon) → notice absent + `if (fields.length === 0 || specialPatternSelected) {`. The flag-use count stays 5 (the notice use is replaced by the visibility use).
  6. `verifyPhase121SpecialDraftAuthoring.mjs` AC-121.1-6/7: `specialMappingStatus(row.metadata)` is now checked in `LoginPatternGrid.tsx`.
  7. `verifyPhase121UnifiedVocabulary.mjs` P1:
     - the status line + collapsed technical details, one per editor → one per pattern in «אופי הכניסה», and none in either editor;
     - the SPECIAL title `>אופי הכניסה</h3>` → `>מיפוי מסך צף</h3>`.
  8. `verifyPhase121UnifiedVocabulary.mjs` P5: the rendered status is checked on «אופי הכניסה» instead of the editors.
  9. `verifyPhase121UnifiedVocabulary.mjs` S1: "both editors render `<MappingStatusLine`" → «אופי הכניסה» renders it and the editors don't. `LoginPatternGrid.tsx` was added to the no-site-branch list.
- Regression: all 37 Phase 116–121 verifies PASS; `npx tsc -b` exit 0; `npm run build` exit 0; no lints on edited files.

## Owner live steps (after Architecture PASS)

1. Regular site: only «אופי הכניסה» + «מיפוי אתר רגיל» + «בדיקת מילוי» are shown.
2. Super-Pharm: «אופי הכניסה» + «מיפוי מסך צף» + «בדיקת מילוי».
3. A multi-step service (or select «רב־שלבים» in «אופי הכניסה»): «מיפוי כניסה רב־שלבית».
4. Switching the selector swaps the mapping grid. «בדיקת מילוי» and «אשר מיפוי» work as before, including the switch-confirm when approving the regular mapping over a live special one.

---

# Slice D-121-49 — own-label hit is not occlusion; Visual label click resolves to its control (G11) (2026-09-29)

**Source:** `arch-phase121.md` → "El Al live evidence G11" and "D-121-49", incl. the Owner scope override (SPECIAL **and** STANDARD, no gating option; supersedes "Scope: SPECIAL only"). Evidence: the El Al fill test fails with `targets_not_ready · username · occluded` although the locator is exact-one; all 5 hit-test points land on a `MAT-LABEL` inside `label[for=<target id>]`.

## What changed

| Item | Where | What |
|---|---|---|
| Own-label hit (1) | `extension/generic/managed-target-eligibility.js` `labelControlOf`, `isInsideOwnLabel`, `hitRelationshipOk` | PASS list is now: target, a descendant of the target, the associated label element itself (unchanged), **or an element inside a `<label>` whose labeled control is the target** (`hit.closest('label')` + `label.control === target`; covers `for=` and nested labels). Any other covering element (unrelated label, label for another control, non-label overlay) stays `occluded`. Exact-one, the 5 sample points (all must pass), target `pointer-events`, viewport and the single `scrollIntoView` retry are unchanged. Applies to every caller of the shared module (fill-executor, form-detector, inspect, Visual pick; SPECIAL + STANDARD) |
| Visual label resolution (2) | `extension/generic/visual-target-pick.js` `labelFillableControl`, field click path | When the clicked element is not already an identifiable control, a click inside a `<label>` resolves to the label's control if it is an `INPUT` of type text / email / password / tel / number / search / url. Otherwise nothing is resolved and the result stays `unsupported_target`. After resolution the existing rules apply unchanged: candidates (D-121-48 `stableLocators` in SPECIAL), exact-one, identity, Managed eligibility |
| Runtime (3) | — | Unchanged. fill-executor / validated-autofill write to the resolved target only; they contain no label handling and no `.click(` |
| Unchanged | — | No site / hostname / serviceId / fixture branches; manifest, permissions, contract, Hub, `background.js`, Digital Home unchanged; no webNavigation / debugger / getFrameId; `final_submit` reserved; merge guard strict; 121.3+ and D-121-45 not started |

## Developer decisions (for review)

1. **`labelControlOf` fallback.** The browser's native `HTMLLabelElement.control` is used whenever the property exists (also when it is `null`: no guessing). DOMs without it (the linkedom test harness) follow the HTML rule: the `for=` id if that element is labelable, else the first labelable descendant.
2. **Fillable types for Visual resolution:** `text`, `email`, `password`, `tel`, `number`, `search`, `url` (an empty `type` counts as text). A label for a checkbox, radio, select, textarea, button or non-labelable element resolves to nothing.
3. **Resolution only when needed.** The label path runs only when the clicked element is not already an identifiable control, so every direct click on an input behaves exactly as before (including a direct checkbox click).
4. **Action pick unchanged.** The SPECIAL opener / transition pick does not resolve labels to inputs; the Owner scope is field Visual pick.
5. **Hit test not relaxed for the label itself.** The pre-existing "associated label element itself" rule is untouched. The new rule is a separate check, so `isAssociatedLabel` keeps its exact semantics.
6. **Pins.** The exact eligibility edits are listed in `scripts/lib/phase121D49EligibilityEdits.mjs`. `verifyPhase121Runtime.mjs` reverts them before comparing its pinned SHA. `verifyPhase121IframeSurface.mjs` now checks "reverted source equals `HEAD`" for this file instead of "no diff" (`validatedProfile.ts` keeps its no-diff check).

## Evidence

- New `scripts/verifyPhase121OwnLabelHit.mjs` (5 check groups, 7 mutations caught). It loads the real eligibility module and drives `elementFromPoint` per fixture. Synthetic fixtures only:
  - Own-label PASS: `mat-label` (and its inner span) inside `label[for=target]` on all 5 points → PASS. The same holds for text inside a nested label wrapping its input, and for mixed target / own-label hits. The label element itself and the target itself still PASS. `isSafeFillTarget` is true.
  - Still occluded: a descendant of an unrelated label, the unrelated label itself, a label for another control (descendant and element), another input's nesting label, a non-label overlay (span and container), and a label for a checkbox. One of 5 points on an overlay → still `occluded`. A null hit → `not_interactable`. Target `pointer-events:none` → `not_interactable` even with an own-label hit. The scroll retry re-samples once. `classifyManagedIneligibility` still reports `occluded`.
  - `labelControlOf`: `for=` and nested fallback; `for=` pointing at a `div` → null; native `.control` is authoritative (also `null`).
  - Visual: STANDARD click on the `mat-label`, its span, or the label → `#u` (Managed eligible); nested label text → `#p`. SPECIAL click on the own label of a counter-id field (`mat-input-4`) → `input[name="username"]` (stable locator, exact-one, `idAttr` evidence kept), while STANDARD on the same page keeps `#mat-input-4`. A label for a checkbox, a select, a non-labelable element, a label without a control, or a non-label element → `unsupported_target` in both modes. The SPECIAL action pick does not resolve to the input.
  - Runtime and scope: fill-executor / validated-autofill contain no label handling and no `.click(`. The manifest equals `HEAD`. No hostname / serviceId / frame-API strings in the D-121-49 blocks. Both the STANDARD and SPECIAL pick injections load the eligibility module before `visual-target-pick.js`.
  - Mutations: own-label rule removed; control check dropped (any enclosing label passes); label-itself path broadened; native `.control` ignored; `for=` fallback accepts non-labelable elements; fillable-type check dropped; Visual label resolution removed.
- Adjusted: `verifyPhase121Runtime.mjs` (pin via the D49 revert helper) and `verifyPhase121IframeSurface.mjs` (revert-vs-`HEAD` for the eligibility file). No other verify changed; all Phase 119 / 120 eligibility verifies keep their results.
- Regression: all 36 Phase 116–121 verifies PASS; `npx tsc -b` exit 0; `npm run build` exit 0; no lints on edited files.

## Owner live steps (after Architecture PASS)

1. El Al: reload the extension, open the SPECIAL draft, and run «בדיקת מילוי». Expect no `targets_not_ready · username · occluded`; username and password are filled.
2. El Al: re-pick the username with Visual by clicking the field's floating label text. Expect the username input to be chosen with a stable locator (not `#mat-input-N`).
3. Mizrahi / PAGI / Super-Pharm and one regular STANDARD site: «בדיקת מילוי» and Digital Home fill unchanged.

---

# Slice D-121-48 — SPECIAL authoring never anchors locators on generated ids (G9) (2026-09-29)

**Source:** `arch-phase121.md` → "El Al — opener test … G9 unstable auto-generated ids" and "D-121-48" incl. "Owner scope decision" (SPECIAL authoring only; STANDARD locator choice unchanged). Evidence: the saved El Al field locators `#mat-input-4` / `#mat-input-5` match 0 elements after the login dialog is re-created (now `mat-input-6` / `mat-input-7`); the fields have no name / formcontrolname / autocomplete.

## What changed

| Item | Where | What |
|---|---|---|
| Generated-id rule (1) | `extension/generic/locator-determinism.js` `isUnstableId`, `locatorReferencesUnstableId` | Unstable: `mat-…-N` / `mat-mdc-…-N` / `cdk-…-N`, `react-select-N-…`, React `:r…:` (and `«r…»`), `ember N`, `ext-gen N`, UUID, long hex (≥16 hex chars with a digit, or an all-hex id ≥12), and any id whose trailing number is the only difference from another id in the document (`field-7` next to `field-8`). A locator is rejected if it names an unstable id as `#id` or in `id` / `for` / `aria-controls` / `aria-labelledby` / `aria-describedby` / `aria-owns` / `data-target` / `data-bs-target` / `href` (so `label[for=<unstable id>]` is never chosen). The id itself is still reported as evidence (`idAttr`, `meta.idAttr`) |
| Fallback chain (2) | shared `formAttributeCandidates`, `isSharedAriaLabel`, `placeholderCandidate`, `anchoredStructuralCandidates`; used by `page-structure-inspect.buildCandidates` and `visual-target-pick.buildCandidates` | Order in SPECIAL mode: stable `#id` → name → autocomplete → formcontrolname / `data-testid` / `data-test` / `data-qa` / `data-cy` → aria-label (skipped when ≥3 elements share the same value, e.g. an accessibility-plugin message) → placeholder → (action vocabulary for actions) → anchored structural. The anchored locator is built only if nothing earlier is exact-one + identity: nearest ancestor with a stable id, a custom-element tag (`app-…`, `mat-form-field`), `role="dialog"`, or a stable class, + `tag[type=…]`; if that is not exact-one, a child path from that ancestor with `:nth-of-type` only at levels that have same-tag siblings |
| Actions (3) | same builders with `{ action: true, stableLocators: true }` | Opener / transition candidates in SPECIAL Analyze (`collectSpecialAuthoringActionCandidates`) and SPECIAL action pick (`identifyActionTarget`) follow the same rule, incl. `aria-controls` / `data-target` values that are generated ids |
| Gate | `background.js` (3 SPECIAL call sites only): SPECIAL inspect → `collectSafePageStructureWithReadiness({ …, stableLocators: true })` and `collectSpecialAuthoringActionCandidates({ stableLocators: true })`; SPECIAL Visual → `armVisualTargetPick({ …, stableLocators: true })` | Builders default to legacy output. `armVisualTargetPick` honours the option only together with the SPECIAL `mode` (STANDARD passes no mode). STANDARD inspect / Visual call sites unchanged |
| Unchanged (4) | — | Saved mappings are never rewritten (Hub has no reference to the option); contract, runtime (121.2, fill-executor, validated-autofill), manifest, permissions, Digital Home, reveal snapshot / declared readiness, STANDARD. No site / hostname / serviceId branches |

## Developer decisions (for review)

1. **Shared aria-label threshold = 3 elements** with the same `aria-label` anywhere in the document (any tag). Two identical values already fail exact-one on their own.
2. **Anchor strategies per ancestor** in the spec order: stable id → custom-element tag → `role="dialog"` / `alertdialog` → up to 2 stable classes (same `isStableClassName` as D-121-35). Ancestors are walked nearest-first, up to 12 levels, stopping at `body`. The child path is at most 8 levels.
3. **Trailing-counter rule is document-wide** (any element whose id is the same stem + other digits), as "same-shape ids in the document". Residual: a site with deliberate ids like `step1` / `step2` loses those ids in SPECIAL only and falls back to the next exact-one strategy; a lone `step2` stays stable.
4. **Candidate cap +4 in SPECIAL mode** so the added fallbacks are not cut by the legacy cap (8 fields / 24 actions).
5. **Frame descriptors (`iframe#…`) and the reveal snapshot keys are not in scope**: they are not saved field / action locators chosen by the builders. A same-origin `#iframeLogIn`-style id is stable under the rule anyway.
6. **Background pin:** as for D-121-42 / D-121-47, the exact D-121-48 `background.js` edits are listed in `scripts/lib/phase121D48BackgroundEdits.mjs`; `verifyPhase121Runtime.mjs` reverts them before comparing its pinned SHA.

## Evidence

- New `scripts/verifyPhase121StableLocators.mjs` (8 check groups, 8 mutations caught). Synthetic fixtures, no site names:
  - Item 1 units: generated ids detected (framework prefixes, React / ember / ext-gen, UUID, hex, trailing-counter siblings); stable ids kept (`loginAnchor`, `logInBtn`, `iframeLogIn`, `username`, `mat-dialog-title`, lone `lone-3`); `label[for="mat-input-4"]` and `aria-controls="mat-menu-panel-3"` rejected.
  - G9 counter dialog (overlay + `role="dialog"` container + `app-login-dialog` + `mat-form-field` wrappers; text field with a plugin aria-label shared by 4 elements; password field; a `label[for]`; a search field elsewhere with its own counter id): SPECIAL Analyze and Visual choose the same exact-one + identity locator, no generated id, no shared aria-label; Visual click returns it and still reports `idAttr`; page / readiness inspect forward the option. After the dialog is re-created with `mat-input-6` / `mat-input-7`, both locators are exact-one on the new fields.
  - Item 2 order: name → formcontrolname → data-testid → aria-label → placeholder, each chosen when it is the first available.
  - Anchored: twin text inputs with nothing but counter ids → `app-login-dialog > form > mat-form-field:nth-of-type(k) > div > input[type="text"]` (both builders agree; survives re-creation); a lone dialog input → plain `div[role="dialog"] input[type="password"]` (no `:nth-of-type`).
  - Item 3: SPECIAL Analyze opener → `button.secondary-action-button` (not `#mat-button-1`); no action locator references `mat-menu-panel-3`; SPECIAL action pick agrees; without the option the collector keeps `#mat-button-1`.
  - Stable-id fixtures (`#loginAnchor`, `#logInBtn`, `#username`, `#password`): SPECIAL candidates identical to the default output; `#iframeLogIn` stays stable.
  - STANDARD proof: on every fixture element (fields and actions), default Analyze and Visual candidates equal a verbatim copy of the pre-slice builders; `collectSafePageStructure()` unchanged; STANDARD Visual click keeps `#mat-input-5`, also when a stray `stableLocators` is passed without a SPECIAL mode; `background.js` passes the option only from the 3 SPECIAL sites.
  - Item 4: no `src/` file references the option / rule; fill-executor, validated-autofill, manifest untouched; no hostname / serviceId branches.
  - Mutations: rule off; STANDARD gated in (Analyze builder); STANDARD gated in (Visual pick); fallback skips the anchored ancestor; unstable `label[for]` allowed; shared plugin aria-label not skipped; trailing-counter rule off; placeholder before aria-label.
- Adjusted: `verifyPhase121Runtime.mjs` also reverts the D-121-48 `background.js` edits before its pinned SHA.
- Regression: all 35 Phase 116–121 verifies PASS; `npx tsc -b` exit 0; `npm run build` exit 0; no lints on edited files.

## Owner live steps

1. **El Al:** open the SPECIAL editor → re-pick both fields with «מיפוי חזותי» → the locators are not `#mat-input-N` → «שמור מיפוי» → close the floating screen → «בדוק» → «נבדק ונבחר — המסך נפתח» → completeness OK → «בדיקת מילוי» fills after the screen is re-opened → «אשר מיפוי» → Digital Home.
2. **Mizrahi / PAGI / Super-Pharm:** unchanged (saved mappings are not rewritten; stable ids are still chosen on new picks).
3. **A regular (STANDARD) site:** unchanged Analyze / Visual locators.

---

# Slice D-121-47 — Analyze proposal quality (G5–G8) + guards R-a…R-f (2026-09-29)

**Source:** `arch-phase121.md` → "El Al evidence" (G5–G8) and "D-121-47" (OWNER APPROVED / AUTHORIZED 2026-09-29), incl. Regression guards R-a…R-f. Analyze proposals only; manual pick stays unrestricted. Generic vocabulary, no site / hostname / serviceId branches.

## What changed

| Item | Where | What |
|---|---|---|
| Vocabulary (G7) | new `src/assistedMapping/specialActionIntent.ts` (`ACTION_INTENT_VOCABULARY`, `actionIntent`); identical copy in `extension/generic/page-structure-inspect.js` | Whole-word matching (tokens split on non-letters; one Hebrew prefix letter ו/ה/ב/ל/מ/ש/כ allowed). Login: התחברות / כניסה / התחבר / אזור אישי / login / log in / sign in / my account. Negative: slide / carousel / prev / previous / contact / צור קשר / chat / צ'אט / cart / עגלה / search / חיפוש / newsletter / דיוור / הרשמה / register. Transition: next / continue / המשך / הבא / קדימה / proceed / אישור / שלח / submit. The unanchored `go` / `more` are removed |
| Pattern relevance (G6) | `specialAnalyzeRouting.scoreKind` | Uses `actionKindRelevantForPattern`: FLOATING_SCREEN → only `floating_opener`; MULTI_STEP → only `intermediate_transition`; FLOATING_SCREEN_MULTI_STEP → transition when a transition word and no login word, otherwise opener |
| Texts (G5) | collector `collectSpecialAuthoringActionCandidates`; `SpecialActionCandidateObservation` | The extension sends `visibleText`, `ariaLabel`, `title` separately (truncated to 120; never input values; an `<input type=button>` caption counts as visible text). Intent uses any of them. The label shown to the Admin prefers the visible text |
| Ranking (R-f, R-a) | collector (before the 40 cap) and Hub | Opener tiers: 0 login + popup → 1 login → 2 popup → 3 plain → 4 negative. A negative word demotes only when no login word is present (R-a). MULTI_STEP transition tiers: 1 transition word → 2 login word → 3 plain → 4 negative. Hub: tier, then the D-121-35 popup tie-breaker, then DOM order. Confidence: tiers 0–1 high, 2 medium, 3–4 low. Skip-link exclusion stays first (R-b); ids are assigned after ranking |
| Password surface (G8) | `page-structure-inspect.js` new `collectSpecialEligibleCredentialInputs` (locator + `password` boolean); `background.js` reveal snapshot + `pollReveal`; `currentTabAuthoring.performApprovedAuthoringClick` option `requirePasswordSurface`; editor `testAndChooseAction` | The editor sends `requirePasswordSurface: consentDraft.pattern === 'FLOATING_SCREEN'`; the Hub forwards it only in reveal mode; the extension honours it only in reveal mode. A fresh entry must then be a password field (top document or any visible depth-1 HTTPS frame, same-origin or cross-origin held for «אשר מסגרת», R-e). If only non-password fields appeared → `surface_not_login` → «המסך לא נפתח»; nothing new → `surface_not_revealed` (unchanged) |
| Unchanged | — | Manual pick, saved drafts / ACTIVE (never re-scored, R-d), 121.2 runtime and Digital Home (R-c), declared readiness mode, contract, manifest, permissions, STANDARD |

## Developer decisions (for review)

1. **G8 applies only in reveal mode.** Declared mode means the fields are already mapped and the declared field is polled; that path is unchanged even if the flag were sent.
2. **Password detection** = `type="password"` or `autocomplete="current-password"`, among the same Managed-eligible credential-like inputs the reveal snapshot already used. The legacy `collectSpecialEligibleCredentialLocators` is kept unchanged; the snapshot prefers the new function and still accepts plain locator strings.
3. **Identifier first, password later:** the reveal poll keeps waiting until the timeout for a password field; `surface_not_login` is returned only at the timeout.
4. **Hebrew prefix tolerance:** one prefix letter (e.g. «להתחברות»), never two. This is why the R-b skip-link fixture («דלג לכניסה לתוכן») would score as login and is covered by the unchanged skip-link exclusion.
5. **Negatives also demote transition words** (e.g. «Next slide» in MULTI_STEP), unless a login word is present.
6. **Two-file pin for background.js:** `verifyPhase121Runtime.mjs` pins background.js outside the runtime block. As done for D-121-42, the exact D-121-47 edits are listed as [new, old] pairs in `scripts/lib/phase121D47BackgroundEdits.mjs`, and the verify reverts them before comparing the pinned SHA (proves nothing else changed).
7. **Test helper exposure:** `__pageStructureInspectHelpers` now also exposes `ACTION_INTENT_VOCABULARY` and `actionRankTier` so the verify can prove extension ↔ Hub parity.

## Evidence

- New `scripts/verifyPhase121AnalyzeProposalQuality.mjs` (12 check groups, 15 mutations caught). Synthetic fixtures, no site names:
  - G7 vocabulary units (whole word, prefix, no go / more) + vocabulary and tokenizer parity between the extension copy and the Hub.
  - G6 per pattern (FLOATING_SCREEN / MULTI_STEP / FLOATING_SCREEN_MULTI_STEP); proposals unapproved; never `final_submit`.
  - G5 plugin-style aria-label + visible «התחברות» → proposed first, high, with the visible label; title-only login word counts.
  - Carousel «Next slide» demoted in both kinds; «Go» / «Load more» plain.
  - R-a «הרשמה / התחברות» anchor to a hidden modal (#…) → first, high; «הרשמה» alone demoted.
  - R-b skip link with «כניסה» in its aria-label excluded; the real opener leads.
  - R-f modal-trigger shape `a[href="#"][role=button][data-toggle=modal][data-target]` with and without login text; only a login-word control outranks the text-less shape; a negative popup is last; ranking before the 40 cap.
  - G8 page side (newsletter first name / last name / email → no password; login form → password flagged; locator + boolean only).
  - G8 extension harness: newsletter + `requirePasswordSurface` → `surface_not_login` (Hub copy = «המסך לא נפתח»); without the flag (MULTI_STEP step 1) → passes; identifier then password → passes; nothing new → `surface_not_revealed`.
  - R-e same-origin depth-1 iframe with password → passes; cross-origin iframe with a held password field → passes with the frame reported for «אשר מסגרת».
  - R-c declared mode ignores the flag; the flag exists only in the editor test path, the Hub click helper and the extension authoring click (not the 121.2 runtime, not Digital Home).
  - R-d a saved chosen action with negative text survives normalization unchanged; the intent module is imported only by the Analyze proposer; the proposer is called only from Analyze.
  - Mutations: G6 relevance ignored; G5 collector label prefers aria-label / Hub intent aria-only / Hub label ignores visible text; G7 substring matching / `go` restored; G8 password requirement ignored / password flag dropped; R-a negative demotes login; R-b skip-link exclusion removed; R-c editor always requires a password; R-d normalization re-scores; R-e snapshot ignores frames; R-f collector drops the popup tier / Hub sorts popup before tier.
- Adjusted: `verifyPhase121Runtime.mjs` (reverts the D-121-47 background.js edits before the pinned SHA, via the new `scripts/lib/phase121D47BackgroundEdits.mjs`). The existing `surface_not_revealed` reply line is kept as-is, so `verifyPhase121IframeSurface.mjs` is unchanged.
- Regression: all 34 Phase 116–121 verifies PASS; `npx tsc -b` exit 0; `npm run build` exit 0; no lints on edited files.

## Owner live steps

1. **El Al:** SPECIAL, FLOATING_SCREEN → «ניתוח» proposes «התחברות» (not «Next slide» / a carousel control). «בדוק» opens the login screen with the password field, not the newsletter form. If a newsletter-type form opens instead, the result is «המסך לא נפתח».
2. **Mizrahi, PAGI, Super-Pharm:** «ניתוח» + «בדוק» still propose and open the same opener as before; fields identified (PAGI after «אשר מסגרת»).

---

# Slice D-121-46 Amendment A1 — pattern-irrelevant actions never kept (2026-09-29)

**Source:** `arch-phase121.md` → "El Al evidence", "Architect Review — D-121-46 base", "D-121-46 … Amendment A1". The live El Al stale action is an `intermediate_transition` (`button[aria-label="Next slide"]`, unchosen) in a FLOATING_SCREEN draft, so the opener-slot rule alone could not remove it. Everything else in D-121-46 is unchanged.

## What changed

| Rule | Where | What |
|---|---|---|
| One relevance helper | `src/loginContract/specialDraftAuthoring.ts` `actionKindRelevantForPattern` (exported); `specialActionBar.manualPickRelevant` now delegates to it | Openers are relevant to FLOATING_SCREEN / FLOATING_SCREEN_MULTI_STEP; transitions to MULTI_STEP / FLOATING_SCREEN_MULTI_STEP. Same table as before for the manual pick buttons |
| Normalization | new `dropPatternIrrelevantActions`, called first inside `normalizeLegacyDraftReadiness` (then `dropStaleOpenerCandidates`, then readiness A1) | Drops preamble actions and `exitTransition`s whose kind the draft pattern does not use, chosen or not. Returns the same object when nothing is irrelevant. Never approves anything. Because it is inside A1, it applies on editor load, «שמור מיפוי», completeness, «בדיקת מילוי» and «אשר מיפוי» |
| Upsert | `upsertPreambleAction` | Prunes irrelevant actions already in the draft, and **does not write** an action whose kind is irrelevant to the draft pattern |
| Pattern change | `SpecialLoginDraftEditor.onPatternChange` | `setDraft(normalizeLegacyDraftReadiness(ensureSpecialDraft(next, draft)))`. The «נמצא כפתור באתר» / «נמצא כפתור נוסף» panels are cleared if they hold a kind irrelevant to the new pattern |
| Unchanged | — | Validation strictness, contract / merge / planActivate, ACTIVE / runtime (never normalized), extension, manifest, STANDARD, the D-121-46 opener slot |

## Developer decisions (for review)

1. **Pressing «בדוק» on an irrelevant-kind proposal still clicks it** (Analyze may still propose one until D-121-47 / G6), but the action is never written to the draft: the consent and result writes are refused by the upsert. The draft stays clean and completeness is unaffected. The panel keeps showing the tested action for this session only.
2. **Pattern change also applies the full A1 normalization**, not only the relevance drop, so every entry point produces the same normalized draft.
3. **Superseded fixtures:**
   - `verifyPhase121SpecialDraftAuthoring.mjs`: the §5.2 selection fixture mixes an opener and transitions, so its base draft is now FLOATING_SCREEN_MULTI_STEP. The selection assertions are unchanged.
   - `verifyPhase121TestThenChoose.mjs`: the MULTI_STEP follow-up fixture had an opener written into a MULTI_STEP draft. It now asserts that A1 refuses that write, and gives the id-collision check a raw draft holding the tested id. The selection assertions are unchanged.
   - `verifyPhase121SingleOpener.mjs` O3 now runs on FLOATING_SCREEN_MULTI_STEP, because transitions are irrelevant in FLOATING_SCREEN.

## Evidence

- `scripts/verifyPhase121SingleOpener.mjs` extended (11 check groups, 10 mutations):
  - **R0:** `manualPickRelevant` equals `actionKindRelevantForPattern` across all patterns and kinds; relevance table.
  - **R1:** El Al-shaped FLOATING_SCREEN draft (unchosen «Next slide» transition + chosen opener). The raw draft fails as seen live (`actionNotApprovedForRuntime`); normalized, only the opener remains and it is complete. The chosen-transition and `exitTransition` variants are also dropped and complete. «אשר מיפוי» of the normalized draft passes the real contract. A transition-only draft stays incomplete. The upsert refuses to write a transition into FLOATING_SCREEN.
  - **R2:** pattern switch: FLOATING_SCREEN → MULTI_STEP drops the opener; MULTI_STEP → FLOATING_SCREEN drops the transition; MULTI_STEP → FLOATING_SCREEN_MULTI_STEP keeps it.
  - **R3:** FLOATING_SCREEN_MULTI_STEP keeps one opener and one transition per step (unchanged object), and accepts transition writes.
  - **S1 (added):** `manualPickRelevant` delegates; pattern change normalizes and clears irrelevant panels.
  - **New mutations caught:** normalization keeps an irrelevant kind; upsert writes an irrelevant kind; relevance pruning not wired into A1; relevance lets openers into MULTI_STEP. The D-121-46 mutations are still caught.
- All **33** Phase 116–121 verifies PASS; `npx tsc -b` exit 0; `npm run build` exit 0; no lints.

## Owner live step

El Al (already saved, no re-authoring): reload the Admin → the completeness line reads «הבדיקה המבנית תקינה.» → «בדיקת מילוי» fills → «אשר מיפוי» is enabled.

---

# Slice D-121-46 — one opener per plan; unchosen candidates never block (2026-09-29)

**Source:** `arch-phase121.md` → "Owner live (2026-09-29) — new FLOATING_SCREEN site (El Al)", "Root cause (c)", D-121-46 (Owner approved; runs before D-121-45). Confirmed root cause: a failed Analyze candidate stays in the draft with its flags cleared (D-121-34). A manually picked opener has a different `actionId`, so the old `upsertPreambleAction` appended it and both stayed. `validateSpecialPlanComplete` then failed on the unchosen one (`actionNotApprovedForRuntime`), and no panel showed it for removal.

## What changed

| Requirement | Where | What |
|---|---|---|
| 1 — one opener slot | `src/loginContract/specialDraftAuthoring.ts` `upsertPreambleAction` | A `floating_opener` write takes the slot of any existing opener, in place (preamble order kept), and every other opener is removed. A **chosen** write (`approvedForRuntime`, set only by a test success) also removes the other **unchosen** preamble actions of its kind. Unchosen non-opener writes remove nothing |
| 2 — exitTransition | unchanged (`setStepExitTransition`) | Already a single field per step; writes to an owned transition stay in that step. Evidence in the verify (X1) |
| 3 — legacy drafts | new `dropStaleOpenerCandidates`, called first inside `normalizeLegacyDraftReadiness` (A1); exported from `loginContract/index.ts` | If there is at least one chosen opener and at least one unchosen opener, the unchosen openers are dropped; otherwise the draft is returned unchanged. Because it runs inside A1, it applies wherever A1 already applies: editor load, completeness (`checkSpecialDraft`), «בדיקת מילוי» (`checkSpecialDraft` on the saved draft), «אשר מיפוי» (`normalizeLegacyDraftReadiness(saved)`) and the dirty / status keys. «שמור מיפוי» now saves `normalizeLegacyDraftReadiness(draft)` |
| 4 — unchanged | — | `validateSpecialPlanComplete` (every plan action must be `approvedForRuntime`), contract / merge / planActivate, runtime / `resolveActiveLoginContract` (never normalized), extension, manifest, STANDARD. No site / hostname / serviceId branches |

## Developer decisions (for review)

1. **Pressing «בדוק» on a new opener replaces the current opener already at consent time**, even a chosen one, as the rule requires («Adding an opener … replaces any existing opener»). If that test then fails, the draft has no chosen opener; the completeness line says so, and the Admin re-tests or re-picks. The unsaved change never reaches users (C1: approval needs a save).
2. **"Chosen" = `approvedForRuntime === true`**, the same criterion the validator uses (`floatingNeedsOpener`), so normalization and completeness agree.
3. **Legacy drafts with two chosen openers, or only unchosen ones, are left unchanged.** Normalization never picks between chosen openers and never approves anything; those drafts stay incomplete, and the Admin re-tests.
4. **Same-kind supersede for non-opener preamble actions** (e.g. `intermediate_transition`) covers "after a test success, no other unchosen action of the same kind remains". Chosen actions of that kind are kept.
5. **«שמור מיפוי» applies the full A1 normalization.** It matches what the editor already loaded, and the dirty comparison already normalizes both sides, so saving adds no dirty flicker.

## Evidence

- New `scripts/verifyPhase121SingleOpener.mjs`. It replays the editor's draft writes using the same helpers (`selectPendingForManualAnalyze`, `actionForTestPress` / `actionAfterTestSuccess` / `actionAfterTestFailure`, `upsertPreambleAction` + `rederiveRevealReadiness`):
  - **O1:** Analyze candidate (not opened), then a manual pick tested OK → exactly one opener (already at consent); plan complete.
  - **O2:** manual opener chosen, then an Analyze proposal → still one (a proposal writes nothing; pressing it replaces; the same locator maps back to the chosen opener).
  - **O3:** a chosen transition removes only the unchosen transitions; the opener is untouched.
  - **X1:** `exitTransition` is a single slot per step.
  - **L1:** legacy draft with a stale candidate + a chosen opener. The raw draft fails exactly as seen live (`actionNotApprovedForRuntime`); normalized, it has one opener; `checkSpecialDraft` is complete; the approval through the real `mergeLoginContractMetadata` succeeds with one opener; the raw plan is still rejected; other actions and their order are kept; the input is never mutated.
  - **L2:** unchosen-only drafts (one or two openers) → unchanged and still incomplete; two chosen openers → unchanged.
  - **S1 static:** editor load / save / approve, completeness and the fill test go through the normalization; ACTIVE / runtime / contract files never call it; no site branches; manifest unchanged.
  - **Mutations caught (6):** opener appended (slot rule dropped); the original append-by-id upsert; normalization drops the chosen opener; normalization drops openers when none is chosen; normalization not wired into A1; chosen action does not supersede.
- `verifyPhase121ContractSafeSaves.mjs`: the saveDraft assertion now expects the normalized draft.
- All **33** Phase 116–121 verifies PASS. `verifyPhase117RivhitLiveM8.mjs` failed once in one loop and passed on every rerun; it is a timing-sensitive live-harness check with no Admin code in its path. `npx tsc -b` exit 0; `npm run build` exit 0; no lints.

## Owner live step

El Al (already saved, no re-authoring): reload the Admin → the completeness line shows «הבדיקה המבנית תקינה.» → «בדיקת מילוי» fills → «אשר מיפוי» is enabled (the approval writes the normalized saved draft).

---

# Slice D-121-43 CORRECTION C1 — SPECIAL «אשר מיפוי» approves only the saved mapping (2026-09-29)

**Source:** `arch-phase121.md` → "Architect Review — D-121-43 … CORRECTION C1" (binding). This resolves Developer observation 8 of D-121-43.

## What changed (`src/admin/SpecialLoginDraftEditor.tsx` only)

| Rule | Where | What |
|---|---|---|
| Disabled while unsaved | «אשר מיפוי» button; `requestActivateSpecial` | `disabled={busy \|\| draftDirty \|\| !draftCheck.complete}`. The request handler also returns on `draftDirty`, so the confirm dialog cannot open. `draftDirty` is the existing editor-vs-saved comparison (the same one the «בדיקת מילוי» dirty guard uses) |
| Approve the saved draft | `activateSpecial` | Reads `readLoginFlowPlanFromMetadata(row.metadata).draft`. It returns without writing if there is no saved SPECIAL draft, if the editor became dirty after the dialog opened, or if `checkSpecialDraft(saved)` is incomplete. It then applies the unchanged A1 `normalizeLegacyDraftReadiness(saved)` and the unchanged intent write (`transition`, `draft: normalized`, `...row.metadata`) |
| Unchanged | — | Completeness gate, confirm dialog, copy (no new text: STANDARD shows no hint either), contract, storage, runtime, STANDARD editor |

## Evidence

- New `scripts/verifyPhase121ApproveSavedOnly.mjs`. It drives the **real** `SpecialLoginDraftEditor` through a small hooks runtime (no DOM library added). Only the registry write and the extension Visual pick are stubbed, and each write goes through the real `mergeLoginContractMetadata`, in the same order as `updateGlobalRegistryRow`:
  - **A1:** a field is changed by Visual pick without saving → «אשר מיפוי» disabled, its handler does not open the dialog, and nothing is written.
  - **A2:** «שמור מיפוי» → enabled.
  - **A3:** an edit after the dialog opened → confirm approves nothing (defense in depth).
  - **A4:** save then approve → the approve intent carries the saved draft; the approved plan equals the saved draft; the status line reads «מאושר למשתמשים» right after approval.
  - **S1 static:** approval reads the row; A1 and `checkSpecialDraft` run on the saved draft; transition and the STANDARD guard are unchanged.
  - **Mutations caught (3):** dirty guard removed from the button; dialog opens while dirty; approve from editor state.
- Superseded assertions updated:
  - `verifyPhase121ActionBar.mjs`: button guard text, and the request handler re-checks `draftDirty`; A1 is applied to `saved`.
  - `verifyPhase121IframeSurface.mjs`: A1 before ACTIVATE, now on `saved`.
  - `verifyPhase121UnifiedVocabulary.mjs`: M8 anchor.
- All **32** Phase 116–121 verifies PASS; `npx tsc -b` exit 0; `npm run build` exit 0; no lints.

## Owner live step (reload the Admin first)

Super-Pharm (SPECIAL):
1. Change a field (Visual pick) without saving → «אשר מיפוי» disabled.
2. «שמור מיפוי» → «אשר מיפוי» enabled.
3. «אשר מיפוי» → confirm → the status line reads «מאושר למשתמשים».

---

# Slice D-121-43 — one Admin vocabulary for every login pattern (UI only) (2026-09-28)

**Source:** `arch-phase121.md` → D-121-43 (Owner approved / authorized 2026-09-28). D-121-44 is **not** authorized (cancelled by the Owner) and was not started. Scope: UI words and layout only. Unchanged: `loginFlowPlan.draft` / `active`, `autofillProfile.supportState`, storage, merges, contract, runtime, Digital Home, extension, manifest.

## What changed

| Requirement | Where | What |
|---|---|---|
| 1 — shared words | new `src/admin/mappingCopy.ts` (`ADMIN_MAPPING_COPY_HE`, `approveConfirmTitleHe`, `ADMIN_MAPPING_STATUS_HE`) | One module for «שמור מיפוי», «אשר מיפוי», «ביטול», «המיפוי נשמר בהצלחה», «המיפוי אושר», «שמירת המיפוי נכשלה.», «הבדיקה המבנית תקינה.», «מצב:», «פרטים טכניים», the confirm title «לאשר את המיפוי ל<שם>?», and the three status words. Both editors import it |
| 1 — SPECIAL editor words | `SpecialLoginDraftEditor.tsx`, `specialActionBar.ts` | «שמור טיוטה» → «שמור מיפוי». `SPECIAL_ACTIVATE_LABEL_HE` → «אשר מיפוי» for every pattern. Title «אופי הכניסה» (no «(DRAFT)»). «שלבים ומיפויי שדות (טיוטה)» → «מיפוי שדות». Every «טיוטה» / «שמרו טיוטה» / «הופעלה» message → «מיפוי» / «שמרו מיפוי» / «אושר». The confirm dialog follows the STANDARD pattern: title `approveConfirmTitleHe(name)`, body «לאחר האישור המשתמשים יקבלו את המיפוי הזה ל<שם>. …», buttons «ביטול» / «אשר מיפוי» |
| 2 — automatic completeness | `SpecialLoginDraftEditor.tsx`, `specialActionBar.checkSpecialDraft` | The «בדוק שהטיוטה מלאה» button and its snapshot-token state are removed. `data-status="mapping-completeness"` is always shown: gray «הבדיקה המבנית תקינה.» (same as the STANDARD line) or red «המיפוי לא מלא: …». «אשר מיפוי» stays `disabled={busy \|\| !draftCheck.complete}` |
| 3 — «שלב נוכחי» | `specialActionBar.stepSelectorVisible` / `stepLabelHe`; editor `currentStepId` | Shown only for MULTI_STEP and FLOATING_SCREEN_MULTI_STEP. Options read «שלב 1», «שלב 2» (never the stepId). Single-step patterns use `steps[0]` silently |
| 4 — one status line | new `src/admin/mappingStatus.ts`, new `src/admin/MappingStatusLine.tsx`; both editors | Read-only derivation from the saved row. **SPECIAL:** no saved SPECIAL mapping → no status; live contract not SPECIAL → «נשמר — עדיין לא אושר למשתמשים»; saved == active (ignoring `planVersion`, which approval assigns) → «מאושר למשתמשים»; otherwise «יש שינויים שנשמרו ועדיין לא אושרו». **STANDARD:** no mapped locator → no status; version-matched validated profile **and** live STANDARD → «מאושר למשתמשים»; otherwise «נשמר — עדיין לא אושר למשתמשים» (a change after approval sets `unsupported` — Phase 120 — so users are really stopped). Entry surface / URL / live contract (SPECIAL) and «מצב תמיכה» (STANDARD) are inside a collapsed «פרטים טכניים» |
| 5 — «בדיקת מילוי» | `fillTestContext.ts` (`fillTestRoute`, `savedAuthoringPattern`), `AdminFillTestGrid.tsx`, `RegistryAdmin.tsx`, `SpecialTestResultView.tsx`, Admin-only `MSG_SPECIAL_ADMIN_*` in `specialLoginFlowMessages.ts` | Context selector and its model removed. Route = selected «אופי הכניסה»: STANDARD → saved profile; SPECIAL → saved mapping (`contextChoice: 'special_draft'`, same runner input as before). Dirty guard wording «יש שינויים שלא נשמרו — שמרו את המיפוי לפני בדיקה.» for both. The result shows only the run time; the version is inside «פרטים טכניים»; no «טיוטה» / «פעילה». Runnable-pattern gating unchanged (FLOATING_SCREEN only) |
| 6 — kept | — | SPECIAL-only authoring controls (opener / transition Visual, continue click, frame approval); STANDARD «נקה מיפוי» / «הגדר כלא נתמך». No site, hostname or serviceId branches |

## Developer decisions (for review)

1. **«שלב נוכחי» also for FLOATING_SCREEN_MULTI_STEP.** Both patterns are «רב־שלבים»; hiding the selector would leave step 2+ unmappable.
2. **Admin-only fill-test messages renamed** (`MSG_SPECIAL_ADMIN_*`: plan invalid / unsaved / missing / opener). Digital Home copy is unchanged.
3. **Result version moved into «פרטים טכניים».** «גרסה N» is a technical field under the new vocabulary.
4. **STANDARD technical details keep «מצב תמיכה: …».** This keeps «לא נתמך» visible to the Admin after «הגדר כלא נתמך».
5. **No saved mapping → no status text.** None of the three states is true before the first save.
6. **Grid route follows the live editor selection**, falling back to the saved SPECIAL mapping's pattern. This matches «the selected אופי הכניסה»; switching the pattern without saving shows the dirty guard.
7. **SPECIAL_INVALID reads «נשמר — עדיין לא אושר למשתמשים».** Users are blocked in that state, so nothing is approved for them; the SPECIAL-invalid explanation stays in the grid.
8. **Observation (behavior unchanged, out of scope):** SPECIAL «אשר מיפוי» still approves the in-memory editor draft (the approval intent carries it); if that draft was not saved, the status line truthfully shows «יש שינויים שנשמרו ועדיין לא אושרו» afterwards. Architecture may want a follow-up slice.
9. **SPECIAL save / approve success messages** now share the STANDARD copy («המיפוי נשמר בהצלחה» / «המיפוי אושר»).

## Superseded assertions (updated verifies)

| Verify | Change |
|---|---|
| `verifyPhase121ActionBar.mjs` | New exact action-bar copy; no `checkDraft` / `activateConfirm`; all activate labels «אשר מיפוי»; «המיפוי לא מלא: …»; the D-121-37 check-button feedback replaced by the automatic completeness line; the dialog uses `approveConfirmTitleHe` / `activateConfirmBody` |
| `verifyPhase121FillTestGrid.mjs` | D-121-38 selector / model / context labels removed; route truth table (`fillTestRoute`); SSR with `selectedPattern` and no `<select`; D-121-40 context line has no «טיוטה» / «פעילה» / «גרסה», version in technical details |
| `verifyPhase121SpecialDraftAuthoring.mjs` | Resolves `ADMIN_MAPPING_COPY_HE.*` references; «…בדקו ושמרו מיפוי.»; `isSpecialLoginPattern(selectedAuthoringPattern)`; save copy via the shared module; `mapping-completeness` present, `validate-draft-snapshot` absent |
| `verifyPhase121IframeSurface.mjs` | Gate checked on the `draftCheck` memo; slice anchor moved |
| `verifyPhase121TestThenChoose.mjs` | Labels set includes «שמור מיפוי» / «אשר מיפוי» |
| `verifyPhase117ManagedAutofill.mjs` | STANDARD labels read from the editor + `mappingCopy.ts` (the editor must import it) |

## Evidence

- New `scripts/verifyPhase121UnifiedVocabulary.mjs`. It bundles the real editors, grid and result view (only `adminRegistryApi` stubbed), server-renders them, and builds rows through the real `mergeLoginContractMetadata` / `mergeAutofillProfileMetadata`:
  - **P1 copy parity:** identical save / approve / structural / status text in both editors; collapsed technical details; no «טיוט» / «הופעל» / «(DRAFT)» / old button.
  - **P2 completeness:** automatic line; «אשר מיפוי» disabled while incomplete.
  - **P3 step selector:** truth table; FLOATING_SCREEN has no «שלב נוכחי» and no stepId; MULTI_STEP shows «שלב 1» / «שלב 2», never the stepId.
  - **P4 «בדיקת מילוי»:** no `<select>` / `<option>` in any state; route follows the selection; shared dirty guard; gating unchanged; result has no «טיוטה» / «פעילה».
  - **P5 status truth table:** SPECIAL none / saved / approved / changed / re-approved (version bump) / invalid; STANDARD none / saved / approved / changed → saved / unsupported / live SPECIAL / cleared; both editors render the derived state.
  - **S1 static:** shared module used by both editors; kept controls; no site branches; extension / manifest untouched.
  - **Mutations caught (10):** version not neutralized; live-contract check dropped; STANDARD approved without version match; selector for every pattern; option shows stepId; route ignores selection; «שמור טיוטה» literal; approve enabled while incomplete; dirty guard dropped; «טיוטה» back in the result. Each is caught by a check, never by a fixture failure.
- All **31** Phase 116–121 verifies PASS (loop over `scripts/verifyPhase(11[6-9]|12[01])*.mjs`).
- `npx tsc -b` exit 0; `npm run build` exit 0; no lints on the edited files.

## Owner live steps (reload the Admin first)

1. **Super-Pharm / PAGI (SPECIAL):** the buttons read «שמור מיפוי» / «אשר מיפוי», as on a regular site. No «שלב נוכחי» (single-step pattern). No «בדוק שהטיוטה מלאה» button; the completeness line appears by itself. «בדיקת מילוי» has no selector and fills the saved mapping. After «אשר מיפוי» the status line reads «מאושר למשתמשים» and Digital Home login works.
2. **Regular site (STANDARD):** unchanged except the shared status line («נשמר — עדיין לא אושר למשתמשים» → «מאושר למשתמשים» after «אשר מיפוי»), with «מצב תמיכה» under «פרטים טכניים».

---

# Slice D-121-42 — uniform Admin Visual pick lifecycle (STANDARD aligned to SPECIAL) (2026-09-28)

**Source:** `arch-phase121.md` → "Owner finding (2026-09-28) — Visual pick behavior not uniform" + D-121-42 (Owner approved). STANDARD path: `AutofillProfileEditor.requestVisualMapping` → `startVisualMappingForField` → `ADMIN_VISUAL_MAPPING_START` → `openPageAndVisualMapping` → `armVisualTargetPick`, which previously had no `timeoutMs`.

## What changed

| Requirement | Where | What |
|---|---|---|
| 1 — bounded pick, shared constants | `src/assistedMapping/types.ts`, `index.ts`, `currentTabAuthoring.ts`, `SpecialLoginDraftEditor.tsx` | `SPECIAL_VISUAL_PICK_TIMEOUT_MS` / `SPECIAL_VISUAL_PICK_HUB_GRACE_MS` renamed to `ADMIN_VISUAL_PICK_TIMEOUT_MS` (60 000) / `ADMIN_VISUAL_PICK_HUB_GRACE_MS` (5 000). SPECIAL uses the same values |
| 1 — bound sent + applied | `src/assistedMapping/visualMapping.ts` `startVisualMappingForField`; `extension/background.js` `openPageAndVisualMapping` | The Hub sends `pickTimeoutMs: ADMIN_VISUAL_PICK_TIMEOUT_MS`. The Ext caps it (same cap as SPECIAL) and counts it from the request, so tab load time is included (floor 1 s), then passes `timeoutMs` to `armVisualTargetPick`. The page timeout answers `visual_pick_timeout`. No `pickTimeoutMs` → legacy unbounded arm (the Hub always sends it now) |
| 2 — disarm on timeout / cancel / Hub give-up | `background.js`: `standardVisualPickSession`, `disarmStandardVisualPick`, `cancelStandardVisualMapping`, router `ADMIN_VISUAL_MAPPING_CANCEL`; Hub `cancelVisualMappingForField` | One pending STANDARD session: `{ allowedOrigin, tabId, armed, cancelled }`. Cancel is origin fail-closed. Armed → `__disarmVisualTargetPick('visual_pick_cancelled')` in frame 0. Not yet armed (e.g. the Hub gave up during tab load) → arming is skipped and START answers `visual_pick_cancelled`. **Any** answer while armed (operation timeout, navigation away, …) also disarms the page, and a new START disarms a previous one. The page timeout removes the listener itself (unchanged page code) |
| 3 — same indicator + «ביטול» | `AutofillProfileEditor.tsx` | While a pick is pending: «ממתין ללחיצה על השדה בלשונית האתר: **<field label>**. לביטול לחצו «ביטול».», «פועל בלשונית האתר שנפתחה.», and a «ביטול» button (enabled while busy). Same layout as the SPECIAL panel. The existing «מיפוי חזותי בתהליך» status stays |
| 4 — same copy | new `src/admin/visualPickCopy.ts` (`ADMIN_VISUAL_PICK_COPY_HE`) | `waitingField`, `cancelHint`, `siteTabActive`, `cancelled`, `timeoutField` («לא נקלטה לחיצה בזמן, והמיפוי החזותי בוטל. כדי לנסות שוב לחצו «מיפוי חזותי» ליד השדה.»). The SPECIAL copy entries now reference this module; STANDARD uses it directly. Page timeout and Hub give-up both show `timeoutField`; cancel shows `cancelled` |
| 5 — late responses ignored | new `src/admin/visualPickSession.ts` (`AdminVisualPickSession`) | One pick at a time. `run()` arms the Hub safety timer (bound + grace); on expiry → disarm + release + timeout copy. `cancel()` → disarm + release. A token makes answers after timeout / cancel / a newer pick return `{ stale: true }`, and the editor then writes nothing. A failed start releases and rethrows. Unmount cancels |

Unchanged:
- locator rules (exact-one + identity, managed eligibility; page pick code untouched);
- what is saved and the authoring flags (success branch byte-for-byte the same logic);
- STANDARD fresh-tab model, frame 0, and the same injected files;
- Managed Autofill runtime, Digital Home, `validated-autofill.js`;
- manifest / permissions;
- no site / hostname / serviceId branches.

## Developer decisions (for review)

1. **The SPECIAL editor keeps its own pick code** and now reads the shared constants and shared copy. It was not refactored onto `AdminVisualPickSession`, to avoid reopening the Owner-verified SPECIAL flow and its verifies. Both implement the same lifecycle (same bound, grace, token, disarm paths); the new verify checks both. Moving SPECIAL onto the helper later is a mechanical follow-up if wanted.
2. **Separate STANDARD cancel message** (`ADMIN_VISUAL_MAPPING_CANCEL`) instead of reusing the SPECIAL session-tab cancel. STANDARD has no Hub-known tab (fresh tab), and the SPECIAL cancel handler stays untouched.
3. **Bound counted from the request** (Ext side), so the page timeout normally fires before the Hub's 65 s safety timer, even with a slow tab load. If the Hub gives up first, the result is the same message and a disarmed page.
4. **Superseded assertions in existing verifies:**
   - `verifyPhase121SpecialDraftAuthoring.mjs` asserted "STANDARD arms without bound / never disarms" and the old constant names / literal copy. These now assert the D-121-42 state (bound present, shared names, shared copy); the checks that STANDARD never uses the SPECIAL cancel are kept.
   - `verifyPhase121Runtime.mjs` pins `background.js` by SHA. It now first reverts the exact D-121-42 edits (listed in `scripts/lib/phase121D42BackgroundEdits.mjs`) and still requires the **same pre-slice SHA**. This proves nothing else in `background.js` changed.

## Verification

`scripts/verifyPhase121UniformVisualPick.mjs` (new). Real `background.js` STANDARD path + real page pick script in a simulated tab (mock `chrome.*` only):
- **E1** A successful pick is unchanged (`#user`); the listener is removed; the session is cleared.
- **E2** Page timeout → `visual_pick_timeout`; the listener is removed; the bound reached the page.
- **E3** Cancel while armed → `disarmed: true`; START answers `visual_pick_cancelled`; a later click in the site tab is not swallowed.
- **E4** Cancel before arm → the pick is never armed.
- **E5** Cancel is origin fail-closed.
- **E6** Navigation away → `origin_mismatch`, and the page is still disarmed.
- **E7** No `pickTimeoutMs` → legacy unbounded arm.
- **E8** Reverting the listed edits removes all D-121-42 code; frame 0 / fresh tab / field pick unchanged.
- **H1** The Hub sends the shared bound; timeout / cancel reasons reach the editor; success and managed eligibility unchanged; cancel message + origin.
- **S1** Session helper:
  - the Hub give-up after 65 s disarms and releases;
  - cancel disarms;
  - late / superseded answers are ignored;
  - a failed start releases.
- **C1** Copy parity: both editors read `ADMIN_VISUAL_PICK_COPY_HE`; exact timeout copy and «ביטול» hint; no duplicated literals.
- **U1** STANDARD editor: shared session + Ext cancel; the Hub give-up and page timeout show the same copy; a late answer returns before any write; cancel writes nothing; unmount disarms; same indicator + «ביטול».
- **U2** Unchanged: success writes / flags; the SPECIAL lifecycle; page pick rules; permissions; runtime files; no site branches.
- **Mutations caught (8):**
  - M1 the page bound is not passed;
  - M2 the Ext cancel does not disarm;
  - M3 the before-arm guard is removed;
  - M4 an early answer leaves the page armed;
  - M5 the Hub omits the bound;
  - M6 the token check is removed;
  - M7 cancel does not disarm;
  - M8 the Hub give-up does not disarm.

Results: 13 checks PASS, 8 mutations caught. All **30** Phase 116–121 verifies PASS; `npx tsc -b` exit 0; `npm run build` exit 0; no lints on the edited files.

## Owner live steps (reload the unpacked extension first)

1. **STANDARD service, no click:** press «מיפוי חזותי» next to a field and do not click in the site tab. The panel shows «ממתין ללחיצה על השדה בלשונית האתר: …. לביטול לחצו «ביטול».». After about 60 s: «לא נקלטה לחיצה בזמן, והמיפוי החזותי בוטל. כדי לנסות שוב לחצו «מיפוי חזותי» ליד השדה.». Clicking in the site tab afterwards does nothing.
2. **«ביטול»:** start a Visual pick, press «ביטול» → «המיפוי החזותי בוטל. לא נשמר מיפוי.», the grid unlocks, and nothing is mapped. A click in the site tab afterwards is not captured.
3. **Successful pick unchanged:** start a Visual pick and click the field → the locator and «מיפוי חזותי» / «אומת חזותית» chips as before.
4. **SPECIAL unchanged:** in «אופי הכניסה», field Visual and opener pick behave as before (same messages, «ביטול», timeout).

---

# Slice D-121-41 — Admin manual pick unrestricted; skip-link rule narrowed to Analyze (2026-09-28)

**Source:** `arch-phase121.md` → "Owner live (2026-09-28) — Super-Pharm regression after D-121-35", "Element (Owner Inspect)", D-121-41 (Owner approved). Confirmed cause: an opener `<a href="#<modal container id>" id="…">` was treated as a skip link, so it was excluded in Analyze and rejected in the manual pick.

## What changed

| Item | Where | What |
|---|---|---|
| 1 — manual action pick | `extension/generic/visual-target-pick.js` `identifyActionTarget` | No skip-link check. A text node resolves to its parent element. Target = nearest actionable ancestor (`resolveActionableTarget`) if one exists, otherwise the clicked element itself. Still required: visible (unchanged `isVisibleActionTarget`); locator from the existing candidates (id first, then name / autocomplete / aria-label, then the shared action vocabulary), exact-one + identity. No candidates → `no_locator_candidates`; none exact-one → `no_exact_one_locator`. Both show «לא ניתן לזהות את הכפתור שנבחר…». Field pick unchanged |
| 1 — Hub messages | `src/assistedMapping/currentTabAuthoring.ts`, `types.ts`, `index.ts` | The `skip_link_target` branch and `VISUAL_ACTION_SKIP_LINK_HE` («האלמנט שנבחר הוא קישור דילוג…») are removed |
| 2 — Analyze skip-link rule | `extension/generic/locator-determinism.js` `isSkipLink` + new `isVisibleInPageContent` | `#<id>` without popup semantics is a skip link only when the target exists **and** is visible in-page content: no `[hidden]` / `aria-hidden="true"` on the target or an ancestor; not `display:none` / `visibility:hidden`; non-zero box; not a dialog or inside one (`dialog`, `role="dialog"`/`"alertdialog"`, `aria-modal="true"`). Hidden or dialog targets → the anchor stays an opener candidate. `collectSpecialAuthoringActionCandidates` is unchanged (it still calls `isSkipLink`); ranking is unchanged |

Unchanged: runtime (121.2 orchestrator), D-121-39, test-then-choose, G4, frame rules, manifest / permissions, final_submit reserved, origin fail-closed. No site / hostname / serviceId branches.

## Developer decisions (for review)

1. **Dialog check includes ancestors.** An anchor pointing at a form inside a modal (`aria-modal` wrapper) is treated like one pointing at the modal itself. Same for `[hidden]` / `aria-hidden` on an ancestor. This only keeps more Analyze candidates; it never excludes one.
2. **Page background is not a choice.** Clicking `html` / `body` in the manual pick → `unsupported_target` («לא ניתן לזהות…»), because a click on the page background is not an element the runtime can press meaningfully.
3. **Visibility still required in the pick.** Unchanged: a disabled or invisible resolved target → `action_target_not_visible` («לא ניתן לזהות…»). A clicked element is normally visible, so in practice the message appears only when no deterministic locator exists.
4. **Superseded D-121-35 assertions.** In `verifyPhase121OpenerIdentification.mjs`, G2.2 (non-actionable → `unsupported_target`, skip link → `skip_link_target`) and the G2.7 skip-link message check now assert the D-121-41 behavior. All other G1 / G2 / G3 / G4 checks are unchanged and pass.

## Verification

`verifyPhase121OpenerIdentification.mjs`: new section D-121-41 (8 checks, synthetic, no site names). Totals 32 / 32 PASS:
- **D41.1** `isSkipLink` is false for targets that are `display:none`, `[hidden]`, `aria-hidden`, `visibility:hidden`, zero-size, `role="dialog"`, `<dialog>`, or inside `aria-modal`. It is true for visible content and for the skip link → visible real button shape.
- **D41.2** Analyze keeps the anchor → hidden modal container (`#openAnchor`) and all the hidden / dialog shapes. It excludes the anchor → visible content and the skip link → real button, and keeps the real button itself.
- **D41.3** Ranking unchanged: the labelled opener link ranks above a popup-semantics control with a generic label; proposals are unapproved; no final_submit.
- **D41.4** The manual pick accepts both anchor shapes; the id locator wins; exact-one + identity.
- **D41.5** The manual pick accepts non-actionable visible elements (div / span with id, text node → parent).
- **D41.6** A bare element with no locator, or a non-unique class → «לא ניתן לזהות את הכפתור שנבחר…»; `body` → unsupported.
- **D41.7** The armed action pick resolves the anchor; field pick unchanged.
- **D41.8** Static: no skip-link code in the pick; the skip-link reason / message is gone from the Hub; Analyze still filters.

Results: all **29** Phase 116–121 verifies PASS (including `verifyPhase121Runtime.mjs`, TestThenChoose, DeclaredFrameReadiness, IframeSurface); `npx tsc -b` exit 0; `npm run build` exit 0; no lints on the edited files.

## Owner live checks (reload the unpacked extension first; ACTIVATE is allowed — Owner: no real users yet)

- **(a) Super-Pharm:** Analyze proposes the «התחברות» link (`#loginAnchor`) rather than the cart. The test opens the login screen and identifies the fields; report whether the fields show «בדף הראשי» or «במסגרת». A manual opener pick of the link succeeds.
- **(b) PAGI + Mizrahi:** Analyze + test still OK.
- **(c) Super-Pharm draft Admin Test «בדיקת מילוי»:** fills the fields.

---

# Slice D-121-40 — collapse technical details in «בדיקת מילוי» (2026-09-28)

**Source:** `arch-phase121.md` → "Owner live 121.2 (2026-09-28, DRAFT only)" + D-121-40 (Owner approved). UI only.

## What changed

| File | Change |
|---|---|
| `src/admin/SpecialTestResultView.tsx` (new) | Presentational SPECIAL result. Always visible: the outcome message from `specialAdminPresentation` (A2 rule unchanged: success only when ok and no user gesture), plus one context line «טיוטה» / «פעילה» · `גרסה N` · time. A `<details>` section with `<summary>פרטים טכניים</summary>` (no `open`, so it is closed by default) holds the detail line (`formatSpecialRunDetail`: stage · reason · locator · frame), `צילום <snapshotId>` and the A2 diagnostics JSON (`formatManagedFillDiagnosticsForOperator`). Their content is unchanged. The section is omitted when all three are empty. The outcome carries no credential values |
| `src/admin/AdminFillTestGrid.tsx` | The inline SPECIAL result block is replaced by `<SpecialTestResultView outcome={…} at={…} />`. The STANDARD result block (`managed-test-structure`, reason · fieldId · detail · locator) is untouched |
| `src/admin/fillTestContext.ts` | Adds the `specialTechnicalDetails: 'פרטים טכניים'` label |
| `scripts/verifyPhase121FillTestGrid.mjs` | New section 9 (below) |
| `scripts/verifyPhase121Runtime.mjs` | The A2 static check now looks for `specialAdminPresentation(` in the result view (the grid renders the view) |

The snapshot id moved out of the context line into «פרטים טכניים», per D-121-40. No extension / manifest change, no runtime / orchestrator change, no site branches.

## Verification

`verifyPhase121FillTestGrid.mjs` section 9 SSR-renders the real `SpecialTestResultView` (real messages and formatters):
- **Success (draft, v3):** the message and the context line («טיוטה», «גרסה 3») are the only two visible paragraphs. `stamps`, the run id, the stage, the snapshot id, the frame key and the diagnostics / structure test ids are not visible by default. `<summary>פרטים טכניים</summary>` is present and `<details` has no `open`. Inside the section: the diagnostics JSON, the snapshot id and the detail line.
- **Failure (active, `readiness_timeout`):** the plain-Hebrew message and «פעילה» are visible; `readiness · readiness_timeout · #user · top` appears only inside the section; there is no success copy.
- **A2 (gesture during run):** the not-proven message is visible, with no success copy.
- **Static checks:** the grid renders the view; the grid has no `<details` and no SPECIAL diagnostics markup; the STANDARD result block is unchanged; the label text is exact.

Results: all **29** Phase 116–121 verifies PASS; `npx tsc -b` exit 0; `npm run build` exit 0; no lints on the edited files.

## Owner live check (DRAFT only — do not press ACTIVATE; localhost uses the production DB)

Run a Mizrahi or PAGI draft test in «בדיקת מילוי». Only the message and the short line (טיוטה · גרסה · time) should be visible. Clicking «פרטים טכניים» opens the detail line, the snapshot id and the diagnostics JSON. A STANDARD test looks as before.

---

# Slice 121.2-impl RESUME — SPECIAL runtime + D-121-39 (2026-09-28)

**Source:** `arch-phase121.md` → "121.2-impl BLOCKED … confirmed" + the D-121-39 table (Option 1, Owner approved). The 121.2 DD (RT-0 … RT-9) and amendments A1–A4 still apply. RT-10 answers applied: fresh tab; SPECIAL checked before the adapter block; credentials required only for mapped fieldIds; SPECIAL_INVALID in Digital Home = open, no fill; RT-F-TOP proven offline.

## D-121-39 item 3 — audit of top-only assumptions: **clean**

Audited `validated-autofill.js` beyond the gate: the runner reads only `root.document`, `root.location`, `root.GenericFillExecutor`, `root.ManagedTargetEligibility`, `root.requestAnimationFrame` and `root.addEventListener('pagehide')`. All of these are per-document and behave the same in a depth-1 frame. `fill-executor.js` and `managed-target-eligibility.js` have no top/frame checks. Nothing beyond the gate had to change.

## D-121-39 items 1, 2, 4 — runner gate

| Item | Where | What |
|---|---|---|
| 1 — opt-in gate | `extension/generic/validated-autofill.js` `assessManagedTargetsReady` | `options.frameContext` present → must be `{ mode: 'declared_depth1' }` in a frame (`root.top !== root`), else `frame_context_mismatch` (includes "present in the top document"); `root.parent !== root.top` → `frame_not_depth1`. Absent → the original `not_top_frame` gate, unchanged. The origin check after it is unchanged (the caller passes the plan `frameOrigin`). Diff = the gate + two header lines; the verify proves it by reverse transform to the pre-slice SHA `6e726c2d…` |
| 2 — only the SPECIAL orchestrator sets it | `background.js` `runSpecialLoginFlow` → `fillAttempt` | `runOptions.frameContext = { mode: 'declared_depth1' }` only when the step frame was resolved per attempt by `resolveDeclaredFrame(…, { loadingIsPending: true })` (exact-one iframe, depth-1, live origin === plan `frameOrigin`). `allowedOrigin` = that `frameOrigin`. Never read from any Hub message field (static check + TAMPER fixture sends `frameContext` / `frameId` in the message; ignored) |
| 4 — byte-identical | pins in the verify | `fill-executor.js`, `managed-target-eligibility.js`, `form-detector.js`, `frame-correlation.js`, `manifest.json` SHA-pinned. No STANDARD caller passes `frameContext` |

## RT mapping (what was built)

| RT | Where | What |
|---|---|---|
| RT-2.1 gate | new `src/loginContract/runtimeGate.ts` `validateFloatingScreenRunnable` (after the unchanged `validateSpecialPlanComplete`) + Ext `specialValidateRunPlan` | reserved kind → `reserved_action_kind`; pattern ≠ FLOATING_SCREEN → `pattern_not_supported_yet`; exactly one approved `floating_opener`, one step, no exitTransition, css mappings → else `plan_shape_unsupported`; invalid / mixed frames → `frame_invalid`; readiness css, timeout > 0, not pending-reveal, not the opener itself, equals a mapped locator + frame → else `readiness_invalid`. Ext also rejects extra / missing credential keys and entry origin ≠ `allowedOrigin` (`entry_unresolved`), before any tab |
| RT-2.3 credentials | `buildSpecialCredentialSubset` | every mapped fieldId of steps[0] must be non-blank; the payload is exactly that trimmed subset |
| RT-3 Hub entry | new `src/execution/specialLoginFlow.ts` `executeSpecialLoginFlow` + wrappers `executeDigitalHomeSpecialLoginFlow` / `executeAdminSpecialLoginFlowTest` | one message `HUB_SPECIAL_LOGIN_FLOW {runId, entryUrl, allowedOrigin, plan, credentials, diagnosticPath}` (no frame data); in-flight key → `busy`; tab never loaded → Hub opens the entry. Admin DRAFT = immutable snapshot taken at press time via `checkSpecialDraft` → `createImmutableDraftSnapshot`; unsaved draft → `draft_unsaved_changes`. No persistence imports |
| RT-3.2 copy | new `src/execution/specialLoginFlowMessages.ts` | Admin and Digital Home Hebrew copy; unknown reasons → the generic failure copy (never success) |
| RT-3.3 Digital Home | `src/execution/serviceExecution.ts` (3 lines at the top of `executeServiceFromTile` + helpers above it) | `SPECIAL` → SPECIAL engine only (before adapters / Managed / medium / generic); `SPECIAL_INVALID` → open the entry, no fill, contract-invalid copy. The STANDARD remainder is SHA-pinned (`96cc0db9…`) |
| RT-4 Ext orchestrator | `extension/background.js` new block before `onMessageExternal` + one router entry | validate → fresh tab (`openGenericRealSiteTab`, Managed placement) → **R1** (tab URL origin + live top origin, before any click) → gesture watch → opener document (top, or `resolveDeclaredFrame`) → exact-one opener click (0 → `opener_missing`, >1 → `opener_ambiguous`, no click) → declared readiness poll (loading ≠ foreign) → per-attempt fill re-resolve → unchanged runner (top, or depth-1 with `frameContext`) → `STOPPED_FOR_USER`. Never submits. The rest of `background.js` is SHA-pinned |
| RT-4.6 / A2 gesture | Ext `specialGestureWatch*` (existing) + `specialAdminPresentation` | `userGestureDuringRun` = trusted pointerdown/keydown between the Ext click and readiness; install failure → field omitted. Admin success only when verified AND `userGestureDuringRun === false`; true → «לא הוכח — נראה שלחצת באתר בזמן הבדיקה.»; absent → «לא הוכח — לא ניתן היה לוודא שלא לחצת באתר בזמן הבדיקה.» |
| A3 | `executeSpecialLoginFlow` | extension unavailable, `unknown_message`, `no_message`, null / non-object response, rejected send, or no response within 260 s (> Ext tab load 120 s + operation 120 s) → `extension_unavailable`, open the entry only. Never STANDARD / Managed / Generic |
| Admin grid | `AdminFillTestGrid.tsx`, `fillTestContext.ts`, `SpecialLoginDraftEditor.tsx`, `RegistryAdmin.tsx` | «טיוטת כניסה מיוחדת» / «כניסה מיוחדת פעילה» now run (FLOATING_SCREEN only; other patterns show «בדיקת מילוי לסוג כניסה זה תופעל בשלב מאוחר יותר.»). Temp inputs only for mapped fields. Draft dirty state comes from the editor (serialized normalized draft vs saved) → «יש שינויים שלא נשמרו בטיוטה. שמרו טיוטה לפני הבדיקה.». Result block `data-section="special-test-result"` with context (טיוטה / פעילה), structure line and A2 diagnostics. SPECIAL runs write nothing (no stamp). STANDARD `requestManagedTest` unchanged |

## Accepted findings (documented)

- **Cross-origin redirect before load → `tab_load_timeout`.** `openGenericRealSiteTab` only starts when the tab URL matches the entry (origin + path), so a server redirect to another origin before load never starts the run: no script, no click, `tab_load_timeout` after 120 s, then the Hub opens the entry. RT-F-R1 covers redirects after load only (→ `r1` / `origin_mismatch` before any click). Both are covered by fixtures. Note: in this case the Ext tab (sitting on the other origin) stays open next to the Hub-opened entry tab — same behavior as Managed.
- **Old extension.** `unknown_message` / no response / timeout → A3 `extension_unavailable`, no fallback (verified).
- **PAGI entry URL** lives only in the production DB (not verifiable offline). If its entry redirects cross-origin before load, the live run will show the open-failed copy after ~2 minutes — that is the documented fail-closed path, not a bug.

## Verification (2026-09-28)

New `scripts/verifyPhase121Runtime.mjs` — the real `background.js` (router → `runSpecialLoginFlow`) against the real content scripts in isolated linkedom top / depth-1 windows (mock `chrome.tabs` / `chrome.scripting` only), plus Hub bundles. **35 checks PASS**:

- RT-STATIC: SHA pins above; validated-autofill reverse transform; `background.js` outside the new block + router entry pinned; no `getFrameId` / `webNavigation` / `debugger` / hostname / site names / `serviceId ===` / submit in new code; `frameContext` set at one place, never from the message; `final_submit` reserved; no persistence in the Hub runtime files.
- RT-F-TOP (no frame correlation used), RT-F-SAME, RT-F-CROSS, RT-F-LATE (about:blank → navigated), RT-F-SWAP (`frame_origin_mismatch`, credentials never sent), RT-F-R1, RT-F-R1-PRELOAD (`tab_load_timeout`), RT-F-OPENER-0 / -2, RT-F-TIMEOUT, RT-F-NOSUBMIT (submit / login-button / `form.submit` counters stay 0 in every success fixture), RT-F-TAMPER (extra message fields ignored; 12 bad plans / credentials + wrong entry rejected before any tab).
- Credentials reach exactly one `executeScript` target (the resolved frame, or frame 0) with option keys `allowedOrigin, credentials, diagnosticPath, fieldMappings[, frameContext]`; no credential value in any captured log line.
- RT-GESTURE / A2 (Ext evidence → presentation), A2 table (no failure ever shows success copy), RT-PARITY (Hub gate ≡ Ext gate on 14 plans), RT-SNAPSHOT / RT-CRED (Admin DRAFT end-to-end Hub → real Ext → frame; draft mutated mid-run does not change the run), A3 (7 scenarios + timeout), RT-DH (SPECIAL only, SPECIAL_INVALID ×3 open-only, MULTI_STEP not run, Ext failure/tab states, STANDARD behavior identical to the pre-slice routing on 9 services).
- **D-121-39:** option absent in iframe → `not_top_frame`; option in depth-1 → fills; depth-2 → `frame_not_depth1`; top + option → `frame_context_mismatch`; wrong origin in frame → `wrong_origin`; unknown mode → `frame_context_mismatch`; top without option → STANDARD fill unchanged.
- **Mutations (all caught):** M1 R1 removed; M2 fill without per-attempt origin re-resolve; M3 runner `allowedOrigin` = top; M3b `frameContext` never set; M4a Ext pattern gate removed; M4b Hub runtime gate removed; **M5 depth-1 check removed**; M6 `not_top_frame` gate removed; M7 top-with-option check removed; M8 A3 `unknown_message` mapping removed; M9 A2 missing evidence shown as success; M10 SPECIAL_INVALID fail-closed removed.

Existing verifies adjusted: `verifyPhase121DeclaredFrameReadiness.mjs` 1b.1 (exactly two `loadingIsPending: true` opt-ins: readiness + SPECIAL fill re-resolve; the opener resolve does not opt in); `verifyPhase121FillTestGrid.mjs` (SPECIAL routes through the wrapper, writes nothing; new copy; SSR cases for active route, draft dirty own/other row, mapped-only temps, MULTI_STEP pattern-later). Phase 117 / 120 runner verifies unchanged and PASS.

All **29** `verifyPhase116…121*.mjs` **PASS**; `npx tsc -b` exit 0; `npm run build` exit 0 (existing chunk-size warning only); no lints (the repo has no ESLint config; IDE diagnostics clean on all edited files).

## Files changed

- `extension/generic/validated-autofill.js` — D-121-39 gate + header (only).
- `extension/background.js` — new SPECIAL runtime block + `HUB_SPECIAL_LOGIN_FLOW` router entry.
- New `src/loginContract/runtimeGate.ts`; `src/loginContract/index.ts` (exports).
- New `src/execution/specialLoginFlow.ts`, `src/execution/specialLoginFlowMessages.ts`.
- `src/execution/serviceExecution.ts` — SPECIAL / SPECIAL_INVALID routing before the unchanged STANDARD body.
- `src/admin/AdminFillTestGrid.tsx`, `src/admin/fillTestContext.ts`, `src/admin/SpecialLoginDraftEditor.tsx`, `src/admin/RegistryAdmin.tsx`.
- New `scripts/verifyPhase121Runtime.mjs`; `scripts/verifyPhase121DeclaredFrameReadiness.mjs`, `scripts/verifyPhase121FillTestGrid.mjs`.

No manifest / permission change; no webNavigation / debugger / getFrameId; no site / hostname / serviceId branches; `final_submit` reserved; no metadata writes from runs; no 121.3+.

## Owner live steps — Admin Test DRAFT only (localhost; **do NOT press ACTIVATE** — localhost uses the production DB)

Reload the unpacked extension first (new message handler).

1. **Mizrahi-Tefahot (same-origin iframe).** Registry Admin → the service row → save the SPECIAL draft if needed → «בדיקת מילוי» → choose «טיוטת כניסה מיוחדת» → enter temp values for the mapped fields → «כניסה לאתר ומילוי שדות». Do not touch the new tab until the result appears. Expected: the Ext opens the site, clicks the opener, the login screen opens, the fields are filled, nothing is submitted; the grid shows «המילוי הושלם. בדקו את השדות ולחצו על כניסה באתר.» with context «טיוטה».
2. **PAGI (cross-origin iframe `https://online.pagi.co.il`).** Same steps. Expected: same success. If the entry URL redirects to another origin before load, expect the open-failed copy after ~2 minutes (documented fail-closed path) — report it.
3. **Gesture proof (A2).** Repeat 1 and, right after the tab opens, hold Shift / click in the site page before the login screen appears. Expected: «לא הוכח — נראה שלחצת באתר בזמן הבדיקה.» (never the success copy).
4. **Draft dirty.** Change something in the draft editor without saving → the grid shows «יש שינויים שלא נשמרו בטיוטה. שמרו טיוטה לפני הבדיקה.» and the run button is disabled.
5. **STANDARD regression.** On a STANDARD service with a saved mapping, «בדיקת מילוי» → «מיפוי רגיל (שמור)» → run: behaves exactly as before (incl. the success stamp). On Digital Home, a STANDARD tile opens + fills as before.

Do **not** press ACTIVATE and do not test a Digital Home SPECIAL tile live (that requires an ACTIVE plan in the production DB).

---

# Slice 121.2-impl — BLOCKED at RT-0 CALL OUT (2026-09-28)

**Prerequisite A4:** met. D-121-38 Part A has Architecture PASS (offline), and the Owner accepted starting before the live checks.

## Finding

RT-4.1 step 6 / AC-121.2-9 injects the Phase 120 managed files into the declared frame (`frameIds: [frameId]`) and calls the unchanged `runManagedAutofill`. The design assumes that "only the injection frame differs" and that the `allowedOrigin` option is the in-document R2 check. That is not true for a frame:

- `extension/generic/validated-autofill.js` has the header comment "Never submits. **Top document only.**"
- `runManagedAutofill(options)` calls `assessManagedTargetsReady(options)` first (line 361).
- `assessManagedTargetsReady` (lines 106–108) runs this before any origin or locator check:

```js
if (root.top && root.top !== root) {
  return { ready: false, reason: 'not_top_frame' };
}
```

In any depth-1 frame, the unchanged runner therefore always returns `not_top_frame`, which is not retryable, and nothing is filled. Both live fixtures keep their credential fields inside an iframe: Mizrahi-Tefahot (same-origin iframe) and PAGI (`https://online.pagi.co.il`). `window.top` cannot be overridden from page script, and any wrapper that bypasses the check would be a semantic change to a frozen safety gate. Per the task's CALL OUT (§8.2 / RT-0) and RT-1.2 ("Any change to `validated-autofill.js` … Forbidden"), this is a **STOP**.

Only RT-F-TOP (top-document fields) works with the runner unchanged.

## Other checks done before the stop (for the redesign)

- **RT-10 risk: `tabUrlMatchesGenericTarget`.** An entry URL with an empty path matches on hostname only, so path redirects are fine. Mizrahi's catalog URL is the site root. PAGI's entry URL lives only in the production DB and is not verifiable offline. A server redirect to another origin before load never matches, and the run ends `tab_load_timeout` (fail-closed, no click), not `origin_mismatch`. RT-F-R1 can prove `origin_mismatch` only for a redirect after load.
- **A3.** An extension without the new handler replies `{ ok:false, reason:'unknown_message' }` (catch-all at the end of `onMessageExternal`). The Hub must map this reply, a missing response, or a timeout to the `extension_unavailable` class.

## Options for Architecture (Developer does not choose)

1. **Authorize a narrow Ext change:** a frame-aware mode for `assessManagedTargetsReady`, used only when the SPECIAL orchestrator passes it. STANDARD calls keep the top-only check. This changes a file RT-4.3 marks as byte-identical, so it needs an explicit amendment and STANDARD byte-parity proof for the default path.
2. **A separate SPECIAL in-frame runner** that reuses `GenericFillExecutor` / eligibility unchanged and leaves `validated-autofill.js` untouched. This is new fill code, not "unchanged `runManagedAutofill`", so it needs a design decision on verify parity.
3. **Narrow 121.2 to top-document fields only** (RT-F-TOP). Frames would fail closed as `frame_fill_not_supported_yet`. This defers both live fixtures.

## Files changed

None for 121.2 (only this document).

---

# Slice 121.1 D-121-38 Part A — unified Admin Test grid «בדיקת מילוי» (2026-09-28)

**Source:** `arch-phase121.md` → D-121-38 table, Part A only. Part B (SPECIAL runtime) is not in this slice.

## Implementation

| Item | Where | What |
|---|---|---|
| 1 — harness moved | new `src/admin/AdminFillTestGrid.tsx`; `AutofillProfileEditor.tsx` | The Phase 120.5 harness moves verbatim into a new top-level grid `data-section="fill-test-grid"` titled «בדיקת מילוי». This covers the temp inputs per `login_fields`, «כניסה לאתר ומילוי שדות», the outcome structure line, A2 diagnostics and the "unavailable" hint. All existing markers are kept (`managed-test-harness`, `managed-test-unavailable`, `data-action="managed-test"`, `data-temp-test-field`, `managed-test-structure`). The harness, its state and its imports are removed from «מילוי אוטומטי מנוהל», so there is no duplicate |
| Placement | `RegistryAdmin.tsx` | Rendered right after `<AutofillProfileEditor>`, in the same fragment as «אופי הכניסה» and «מילוי אוטומטי מנוהל». It is keyed per row and has no service-specific condition |
| 2 — plan-context selector | new `src/admin/fillTestContext.ts` `fillTestPlanOptions(metadata)` | Options appear only when they exist, in this order: «מיפוי רגיל (שמור)» (a saved `autofillProfile` parses); «טיוטת כניסה מיוחדת» (`loginFlowPlan.draft`); «כניסה מיוחדת פעילה» (`resolveActiveLoginContract` → `SPECIAL`). The default is the live contract (SPECIAL → active, STANDARD → saved mapping). If that option is absent, the default is the first available option. For `SPECIAL_INVALID` there is no active option, and a fail-closed note is shown (`data-notice="fill-test-special-invalid"`) |
| 3 — STANDARD route | `AdminFillTestGrid.tsx` `requestManagedTest` | Same code as before: `executeAdminManagedAutofillTest`, the A2 console capture, `formatAdminManagedTestResultSummary`, and the same messages. The success stamp is `stampAdminTestPassed`, written through the contract-safe metadata write (`withoutLoginContractKeys`, D-121-33), then `onSaved()`. The enable guards are the same: saved profile ready, all temps filled, no unsaved changes, not testing, and the managed grid not busy |
| Shared dirty / busy state | `AutofillProfileEditor` → `RegistryAdmin` → `AdminFillTestGrid` | The managed grid reports `{rowId, hasUnsavedChanges, busy, inputsLocked, fieldAuthoring}` through `onSharedStateChange`. The new grid shows «יש שינויים שלא נשמרו — שמרו את המיפוי לפני בדיקה.» when the managed grid is dirty. In the other direction, the new grid reports `testing` (`onTestingChange`), and the managed grid receives it as `fillTestRunning`, so its controls lock during a test exactly as before |
| 4 — SPECIAL options | `AdminFillTestGrid.tsx` | The options can be selected and the temp inputs are shown, but the run button is disabled (`canRunManagedTest` requires `standard_saved`). The grid shows exactly «בדיקת מילוי לכניסה מיוחדת תופעל בקרוב.» (`data-notice="fill-test-special-coming-soon"`). There is no SPECIAL execution, no orchestrator and no new extension message |
| 5 — temp values | unchanged | Held in component memory only and cleared on row change / remount. They are never persisted or logged |

Not changed: extension / manifest; Phase 120 fill / verify semantics; `executeManagedAutofill` eligibility; `final_submit` reserved. There are no site / hostname / serviceId branches. D-121-24 / 30 / 33 / 37 behavior is preserved, and there is no 121.2 runtime work.

## Notes for Architecture

- **Stamp base.** The Admin-Test success stamp is built from the managed grid's in-memory `fieldAuthoring`, now reported through the shared state; previously it read the editor's own state. The values are the same. The managed grid then reloads from the saved row after `onSaved()`.
- **New copy (not given verbatim in the task):**
  - the selector label «מול איזו הגדרת כניסה לבדוק»;
  - the SPECIAL_INVALID note «הכניסה המיוחדת הפעילה של השירות אינה תקינה, ולכן אי אפשר לבדוק אותה. מילוי אוטומטי לשירות זה חסום עד שהיא תתוקן.»;
  - for SPECIAL contexts, a shorter temp hint «ערכים זמניים לבדיקה בלבד (בזיכרון המסך).»;
  - «ממלא…» while running.
- **SPECIAL_INVALID default.** The live contract has no testable option, so the default falls back to the first existing option (usually «מיפוי רגיל (שמור)»). The fail-closed note is shown above the selector.
- **"Every service".** The grid renders wherever its siblings render, which is the global-row `credential_fields` block of Registry Admin. With nothing saved, the grid shows the existing "unavailable" hint and no selector.
- **Selector disabled while testing.** The selector is disabled while a test runs.

## Files changed

- New `src/admin/fillTestContext.ts`: selector model, Hebrew copy, `ManagedGridSharedState`.
- New `src/admin/AdminFillTestGrid.tsx`: the «בדיקת מילוי» grid.
- `src/admin/AutofillProfileEditor.tsx`: harness removed; `onSharedStateChange` and `fillTestRunning` props added; unused imports removed.
- `src/admin/RegistryAdmin.tsx`: renders the new grid and lifts the shared state.
- New `scripts/verifyPhase121FillTestGrid.mjs`, which checks:
  - the harness is absent from the managed grid and appears exactly once in the new grid;
  - the sibling wiring;
  - the STANDARD guards and the run path, including the contract-safe stamp;
  - `fillTestPlanOptions` for each state (STANDARD only / draft / active / SPECIAL_INVALID / nothing saved / draft only);
  - server-side renders for each state: SPECIAL run disabled with the exact copy, the dirty note, the SPECIAL_INVALID note, the unavailable hint;
  - no extension / manifest references.
- Harness-location asserts were re-pointed to `AdminFillTestGrid.tsx` in `verifyPhase120AdminManagedTestHarness.mjs` (which also gains managed-grid absence asserts), `verifyPhase120ClearManagedMappings.mjs` (C8), `verifyPhase121ContractSafeSaves.mjs` (stamp write) and `verifyPhase121SpecialDraftAuthoring.mjs` (`managed-test` action).
- `verifyPhase120ManagedActivateGate.mjs` "control key wired": the editor's only direct use of the key was the moved stamp. The assert now checks the activate persist in `specialActionBar.ts`.

## Verification (2026-09-28)

- `verifyPhase121FillTestGrid.mjs` PASS. Five mutation checks were all caught and restored:
  - SPECIAL run enabled;
  - SPECIAL_INVALID shown as active;
  - coming-soon copy changed;
  - stamp write not contract-safe;
  - managed grid no longer locks during a test.
- All **28** `verifyPhase116…121*.mjs` scripts **PASS**; `npx tsc -b` exit 0; `npm run build` exit 0; no lints.

## Owner live checks (localhost; **do not press ACTIVATE** — localhost uses the production DB)

- **(a) STANDARD service (e.g. Shufersal):**
  - The new grid «בדיקת מילוי» appears below «מילוי אוטומטי מנוהל», with «מיפוי רגיל (שמור)» selected.
  - Fill the temp values and press «כניסה לאתר ומילוי שדות». The test runs as before and the success stamp is saved.
  - Edit the mapping without saving: the grid shows «יש שינויים שלא נשמרו — שמרו את המיפוי לפני בדיקה.» and the button is disabled.
  - The harness no longer appears inside «מילוי אוטומטי מנוהל».
- **(b) SPECIAL-draft service (e.g. PAGI):**
  - The grid shows the selector with «טיוטת כניסה מיוחדת».
  - With that option selected, the button is disabled and «בדיקת מילוי לכניסה מיוחדת תופעל בקרוב.» is shown.

---

# Slice 121.1 D-121-37 — «בדוק שהטיוטה מלאה» result feedback (2026-09-28)

**Trigger:** `arch-phase121.md` «Owner live (2026-09-28) — L-1 finish on PAGI». `validateSnapshot` set only `snapshotNote`, which rendered as a small gray line above a stale success message that was never cleared (e.g. «שדות הכניסה זוהו. בדקו ושמרו טיוטה.»). Pressing again with the same result changed nothing visible.

## Implementation (UI only, `src/admin/SpecialLoginDraftEditor.tsx`)

| Item | What |
|---|---|
| 1 — clear on press | `validateSnapshot` clears `success` and `error` right after the unchanged A1 step (`checkSpecialDraft(draft)` → `setDraft(check.normalized)`). The `snapshotNote` state is removed (see below) |
| 2 — complete | `setSuccess(check.message)` = «הטיוטה מלאה ומוכנה להפעלה.» (existing `SPECIAL_ACTION_BAR_HE.draftComplete`). Rendered by the existing green `<p className="admin-success" role="status">` |
| 3 — incomplete | `setError(check.message)` = «הטיוטה לא מלאה: …» (existing `draftIncompleteMessageHe`). Rendered by the existing red `<p className="admin-error" role="alert">` |
| 4 — visible re-render | The result is set in `setTimeout(…, 0)` after the clear, so a repeated press with the same result is removed and then shown again. A per-press token (`snapshotTokenRef`) drops a stale tick. A pattern change also invalidates the token, so an older check result cannot appear after the pattern changed |
| `snapshotNote` removed | Its only writer was `validateSnapshot`; its only other use was the clear in `onPatternChange`. The state and the gray `admin-muted` line are removed |

Unchanged: `checkSpecialDraft` / `draftCompletenessPreview` logic; A1 normalization; the ACTIVATE gate (`draftCheck` memo); the check still writes nothing to the registry. No extension / manifest change, no site branches. D-121-30 … 36 behavior preserved.

## Files changed

- `src/admin/SpecialLoginDraftEditor.tsx`: `validateSnapshot`; `snapshotTokenRef` replaces the `snapshotNote` state; `onPatternChange`; the gray line removed from the render.
- `scripts/verifyPhase121ActionBar.mjs`: §2 now asserts:
  - A1 is kept, and success + error are cleared before the result is set;
  - complete → `setSuccess`, incomplete → `setError`, on the next tick;
  - the stale-tick guard and a per-press token;
  - no `snapshotNote` is left;
  - the green `role="status"` / red `role="alert"` renders and the complete copy.

  The old `setSnapshotNote(check.message)` assertion is replaced.

## Verification (2026-09-28)

- `verifyPhase121ActionBar.mjs` PASS. Mutation checks, both caught and restored: dropping the clear; routing complete → error.
- All **27** `verifyPhase116…121*.mjs` scripts **PASS**; `npx tsc -b` exit 0; `npm run build` exit 0; no lints.

## Owner live check (localhost; **do not press ACTIVATE** — localhost uses the production DB)

- On a saved SPECIAL draft, press «בדוק שהטיוטה מלאה». The old message (e.g. «שדות הכניסה זוהו. בדקו ושמרו טיוטה.») disappears, and a **green** «הטיוטה מלאה ומוכנה להפעלה.» (complete) or a **red** «הטיוטה לא מלאה: …» (incomplete) appears.
- Press it again: the message briefly disappears and appears again.

---

# Slice 121.1 D-121-36 — declared-frame readiness: loading ≠ foreign (2026-09-28)

**Trigger:** the race described in `arch-phase121.md` «Correction (Owner, 2026-09-28)». With DECLARED readiness in a depth-1 frame, the call chain is `specialDeclaredReadinessMet` → `resolveDeclaredFrame` → `specialFrameProbe`. A frame element whose document is still the initial blank one (origin empty / `"null"` / `about:`) failed hard with `frame_origin_mismatch` and an empty `liveOrigin`. The test ended at once and the Hub showed «המסגרת שייכת כעת לאתר אחר (‎‎) — הפעולה נחסמה.»

## Implementation

| Item | Where | What |
|---|---|---|
| Loading predicate | `background.js` `specialIsLoadingFrameDocument(origin, protocol)` | True when the origin is empty / `"null"`, or when the protocol is not `http:` / `https:`. The initial `about:blank` can inherit its parent's origin, but its protocol stays `about:`, so that case also counts as loading. With no protocol available, falls back to "origin is not http(s)://" |
| 1 — polling-scoped option | `resolveDeclaredFrame(tabId, allowedOrigin, descriptor, cb, opts)` | With `opts.loadingIsPending === true`, a probe with a mismatching origin that is a loading document → `{ok:false, reason:'frame_loading', liveOrigin}`. Any other mismatch (a real HTTPS origin) → `frame_origin_mismatch` as before. **Without the option, behavior is byte-for-byte the same as before.** The click-frame resolution in `authoringClickApprovedAction` does not pass the option. Visual pick and R2 approval never call `resolveDeclaredFrame` |
| 1 — readiness polling | `specialDeclaredReadinessMet` | The only caller that passes `{ loadingIsPending: true }`. `frame_loading` is handled like `frame_missing` (`{ok:true, met:false}`), so `pollDeclared` keeps polling until `readiness_timeout`, which still maps to «המסך לא נפתח» |
| 2 — `checkIn` path | same, page function + callback | The page function now also returns `liveOrigin` / `liveProtocol` on a mismatch. For a depth-1 frame (`frameId !== 0`) on a loading document → `met:false` (not yet). For a real different origin → `frame_origin_mismatch`, now carrying `liveOrigin`. **A top-document mismatch stays a hard `origin_mismatch` (R1)** |
| liveOrigin forwarding | `specialDeclaredReadinessMet` → `pollDeclared` → `reply` | Hard failures carry `liveOrigin` through to the Hub. Previously `pollDeclared` dropped it, so every readiness-time origin mismatch rendered with an empty origin |
| 3 — copy | `types.ts` `FRAME_NOT_LOADED_HE` + `FRAME_ORIGIN_CHANGED_HE(origin)` | For an empty / whitespace / `"null"` origin, returns exactly «המסגרת עדיין לא נטענה או נסגרה — נסו שוב.». Otherwise the existing text, unchanged. Because this is inside the one message function, it covers every call site (click failure, Visual pick) |

Unchanged: fail-closed origin validation (a real foreign HTTPS origin is a hard fail on the first tick; top-document R1); `frame_missing` handling; readiness timeout; the Ext click gate and `final_submit` reserved; D-121-33 / 34 / 35 behavior (the G4 gesture verdict still wraps every reply); manifest / permissions. No webNavigation / debugger / getFrameId, and no site branches.

## Files changed

- `extension/background.js`: `specialIsLoadingFrameDocument`; `resolveDeclaredFrame` `opts.loadingIsPending`; `specialDeclaredReadinessMet` (polling opt-in, `frame_loading` pending, `checkIn` loading rule, `liveOrigin`); `pollDeclared` forwards `liveOrigin`.
- `src/assistedMapping/types.ts`, `index.ts`: `FRAME_NOT_LOADED_HE`; the empty-origin branch in `FRAME_ORIGIN_CHANGED_HE`.
- NEW `scripts/verifyPhase121DeclaredFrameReadiness.mjs`.

## Verification (2026-09-28)

- `node scripts/verifyPhase121DeclaredFrameReadiness.mjs`: **13 checks PASS**. The script runs the **real** `resolveDeclaredFrame`, `specialDeclaredReadinessMet`, the real `checkIn` page function and the **real `pollDeclared` loop**, all extracted from `background.js`. A synthetic frame timeline replaces the browser (fake `chrome.scripting` executes the real `specialFrameProbe`; no site names).
  - Blank (`""` then `"null"`) → correct origin → readiness met.
  - An inherited-origin `about:` document is pending, then met.
  - Blank → another HTTPS origin → hard `frame_origin_mismatch`, with `liveOrigin` forwarded.
  - Stays blank → keeps polling → `readiness_timeout`.
  - `frame_missing` unchanged.
  - A foreign origin on the first tick → hard fail.
  - Non-polling `resolveDeclaredFrame` on a blank frame (`""` / `"null"` / inherited) → `frame_origin_mismatch` as before, and only readiness polling opts in.
  - `checkIn` on a blank document is pending; `checkIn` on a foreign origin is a hard fail with `liveOrigin`.
  - A top-document mismatch stays hard.
  - The predicate table holds.
  - Copy: an empty / `"null"` origin gives the exact new text on both the click and the Visual path; a real foreign origin keeps the existing text.
  - Binding checks pass.
- **Mutation checks**, each caught and the source restored:
  - removing the polling opt-in (reproduces the Owner's failure exactly: `frame_origin_mismatch`, `liveOrigin:""`);
  - not treating `frame_loading` as pending;
  - a hard `checkIn` on blank;
  - treating every origin as loading (the foreign origin would no longer fail);
  - reverting the copy.
- Regressions: all **27** `verifyPhase116…121*.mjs` scripts **PASS**, including `verifyPhase121OpenerIdentification.mjs` and `verifyPhase121IframeSurface.mjs` (its exact-text check on `FRAME_ORIGIN_CHANGED_HE` still holds).
- `npx tsc -b` exit 0; `npm run build` exit 0; no lints.

## Notes for Architecture

1. **Loading detection uses the protocol as well as the origin.** An initial `about:blank` can inherit the parent's (real HTTPS) origin. The origin alone would then look like a foreign frame and stay a hard fail; `location.protocol` (`about:`) identifies it as loading. A real document always has `http:` / `https:`, so a foreign HTTPS frame is still a hard fail.
2. **`checkIn` loading rule is frames only.** It applies only to depth-1 frames. A top-document mismatch stays a hard `origin_mismatch`, preserving R1 fail-closed.
3. **`liveOrigin` is now forwarded on readiness-time failures.** Without this, a real foreign origin found during polling would have rendered with an empty origin, which under the new copy rule would wrongly say «עדיין לא נטענה».

## Owner live checks (localhost; **do not press ACTIVATE** — localhost uses the production DB)

- **(a)** On the site with iframe fields, after the iframe fields are saved (declared readiness), press «בדוק את הכפתור וזהה את השדות» **without touching the site**. Expect success: the screen opens, the fields are identified, and the status reads «מצב: נבדק ונבחר — המסך נפתח». «המסגרת שייכת כעת לאתר אחר (‎‎)» must not appear.
- **(b)** Same as (a), but press **Shift once** on the site tab during the test. Expect exactly «נראה שלחצת בעצמך באתר בזמן הבדיקה. סגרו את המסך ולחצו שוב על "בדוק את הכפתור וזהה את השדות" בלי ללחוץ באתר.», with the button not selected (status «מצב: ממתין לבחירה»). This closes the pending D-121-35 G4 check.
- **(c)** Earlier bank fixture regression: Analyze / test / fields unchanged.

---

# Slice 121.1 D-121-35 — generic opener / transition identification (G1–G4) (2026-09-27)

**Trigger:** Owner live finding (floating-screen site). The real opener was `<a class="login-trigger" href="#" role="button" data-target="#login" data-toggle="modal">`, with no id / name / aria-label. Analyze proposed an accessibility skip link instead: it was the only candidate with an aria-label. A manual opener pick could not work, because action picks used the field picker (input / textarea only). A synthetic `.click()` on the real opener does open the screen. Source of truth: `arch-phase121.md` → «Owner live (2026-09-27)» G1–G4 and the D-121-35 section.

## Implementation

| Item | Where | What |
|---|---|---|
| G1 — shared vocabulary | `extension/generic/locator-determinism.js` `actionLocatorCandidates(el)` | Text-free, non-positional strategies, in binding order: `data-testid` / `data-test` / `data-qa` / `data-cy`; `aria-controls`; `data-bs-target` / `data-target`, combined with `data-bs-toggle` / `data-toggle` when present; `href` only when it is a real path (`isRealPathHref`: not empty, not `#`-prefixed, not `javascript:`); `tag.class` with non-generated classes only (`isStableClassName` rejects runs of 3+ digits, CSS-in-JS prefixes, hash-like letter+digit segments, state classes such as active / show / open / is-* / has-*); then `role` combined with each of the above. Values are quoted with `\` / `"` escaped; classes pass through `CSS.escape`. No text content, no nth-child / positional selectors, no XPath |
| G1 — appended, action-only | `buildCandidates(el, opts)` in `page-structure-inspect.js` and `visual-target-pick.js` | The vocabulary is added **after** id / name / autocomplete / aria-label, and **only** when `opts.action === true`, with a cap of 24 (fields keep 8). Field calls (`collectSafePageStructure`, `collectSpecialEligibleCredentialLocators`, field Visual pick, STANDARD) pass no opts, so field candidates are byte-identical |
| G1 — exact-one + identity | `chooseDeterministicLocator(candidates, el, doc)` | Returns the first candidate that passes `assertLocatorDeterministic`: exactly one match, and that match is the observed / clicked element |
| G3 — skip-link filter | `collectSpecialAuthoringActionCandidates` + `isSkipLink(el)` | Excluded: an `a` whose href is `#<id>`, where the id resolves to an existing element **and** the anchor has no popup semantics (`aria-haspopup`, `aria-controls`, `aria-expanded`, `data-(bs-)toggle`, `data-(bs-)target`). `href="#"` alone is not a skip link. The action pick applies the same rule and rejects with reason `skip_link_target` |
| G3 — ranking | same | Each candidate carries `popupSemantics`. The list is sorted stably with popup candidates first, **then** capped at 40 (was 20, counted in DOM order). Ids `act-N` are assigned after ranking. The scan is bounded to 400 nodes |
| G3 — Hub ranking | `specialAnalyzeRouting.ts` `proposeSpecialActionCandidates` | Label confidence stays the primary key; popup semantics is the tie-breaker within equal confidence. New optional field `popupSemantics` on `SpecialActionCandidateObservation` |
| G2 — action pick mode | `visual-target-pick.js` `armVisualTargetPick({… pickTarget: 'action'})` → `identifyActionTarget(target, doc)` | Honored only in SPECIAL (`mode` set). STANDARD (no mode) ignores it. The click target resolves to the nearest actionable element, itself or an ancestor (`button, a, [role="button"], input[type="button"], input[type="submit"]`). The element must be visible (not disabled, not display:none / visibility:hidden, non-zero box) and not a skip link. Locator uses the action vocabulary, exact-one + identity. No Managed fill-eligibility (actions are clicked, not filled). Result: `state: 'IDENTIFIED_ACTION'` with frame tags as before. The click is still swallowed. In action mode, `pointerdown` / `mousedown` / `pointerup` / `mouseup` are also swallowed (capture) while armed and removed on finish. Origin, `report_only` (nested) and shadow checks are unchanged and run first |
| G2 — wiring | `SpecialLoginDraftEditor.tsx` `runArmedVisualPick` → `startCurrentTabVisualMapping({pickTarget:'action'})` → `ADMIN_CURRENT_TAB_VISUAL_MAPPING_START` `pickTarget` → `visualMappingCurrentAuthoringTab` → `armVisualTargetPick` | Action picks only (`pick.target === 'action'`); field picks send no `pickTarget`. §4.10 / §4.10.1 frame enumeration, per-frame arm, winner tagging and cancel are unchanged |
| G2 — messages | `currentTabAuthoring.ts` `interpretCurrentTabVisualResponse(response, fieldId, pickTarget)` | In action mode, `unsupported_target` / `no_locator_candidates` / `no_exact_one_locator` / `locator_target_mismatch` / `action_target_not_visible` → `VISUAL_ACTION_UNSUPPORTED_TARGET_HE`, and `skip_link_target` → `VISUAL_ACTION_SKIP_LINK_HE`. Field-mode messages unchanged |
| G4 — gesture watch | `background.js` `specialGestureWatchInstall` / `specialGestureWatchCollect` / `specialGestureVerdict` / `specialGestureWatchRun` | `authoringClickApprovedAction` → `clickIn` installs a per-test token watch in **all frames of the tab** (`allFrames: true`, ISOLATED world) **before** the Ext click: window capture listeners for `pointerdown` / `keydown` that flag only `event.isTrusted === true`. The synthetic `.click()` is untrusted and does not count. The watch is re-installed (idempotent per token) on each readiness poll tick, to cover frames that load after the click. Every `reply` after install collects and removes the listeners and deletes the page key, so nothing is stored. The verdict applies to a success only: gesture seen → `{ok:false, reason:'user_gesture_during_test'}`; watch unreadable → `gesture_watch_unavailable` (fail-closed). Install failure → no click, `gesture_watch_unavailable` |
| G4 — Hub / editor | `types.ts` `AUTHORING_TEST_NOT_PROVEN_REASON` / `AUTHORING_TEST_NOT_PROVEN_HE`; `authoringClickFailureMessageHe`; `testAndChooseAction` failure branch | Exact message «נראה שלחצת בעצמך באתר בזמן הבדיקה. סגרו את המסך ולחצו שוב על "בדוק את הכפתור וזהה את השדות" בלי ללחוץ באתר.» The button is **not** selected (`actionAfterTestFailure`, both flags cleared). The session outcome is cleared rather than set to `not_opened`, so the status reads «מצב: ממתין לבחירה». No auto-Analyze |

Unchanged: the Ext click gate (`approvedForAuthoringContinuation`, reserved `final_submit`, fill / submit forbidden, `readiness_is_self`); R3 readiness; fail-closed origin validation; merge bypass guard; D-121-33 contract-safe saves; D-121-34 test-then-choose (success path, follow-up selection, «זה לא הכפתור»); manifest / permissions. No webNavigation / debugger / `chrome.runtime.getFrameId`. No site / hostname / serviceId branches.

## Files changed

- `extension/generic/locator-determinism.js`: shared action vocabulary, `isStableClassName`, `isRealPathHref`, `hasPopupSemantics`, `isSkipLink`, `resolveActionableTarget`, `chooseDeterministicLocator`. The existing determinism primitives are unchanged.
- `extension/generic/page-structure-inspect.js`: `buildCandidates(el, opts)` (action opt-in); skip-link filter, popup ranking and `popupSemantics` in `collectSpecialAuthoringActionCandidates`; `buildCandidates` exported on the verify helpers.
- `extension/generic/visual-target-pick.js`: `buildCandidates(el, opts)`, `identifyActionTarget`, action pick mode with press swallowing, `pickTarget` option.
- `extension/background.js`: `pickTarget` passed to `armVisualTargetPick`; G4 gesture-watch helpers and their use in `authoringClickApprovedAction`.
- `src/assistedMapping/types.ts`, `index.ts`: new constants (`AUTHORING_TEST_NOT_PROVEN_REASON`, `AUTHORING_TEST_NOT_PROVEN_HE`, `VISUAL_ACTION_UNSUPPORTED_TARGET_HE`, `VISUAL_ACTION_SKIP_LINK_HE`).
- `src/assistedMapping/currentTabAuthoring.ts`: `pickTarget` input / message; action-mode interpretation; the not-proven message mapping.
- `src/assistedMapping/specialAnalyzeRouting.ts`: `popupSemantics` field and tie-breaker.
- `src/admin/SpecialLoginDraftEditor.tsx`: action pick passes `pickTarget: 'action'`; not-proven failure branch.
- NEW `scripts/verifyPhase121OpenerIdentification.mjs`.
- `scripts/verifyPhase121IframeSurface.mjs`: the §10 guard «locator-determinism.js untouched» is narrowed. It now asserts that the HEAD determinism primitives are present verbatim and that the file contains no 121.1-IF frame tokens.
- `scripts/verifyPhase121TestThenChoose.mjs`: the failure-branch needle is updated to `notProven ? null : 'not_opened'`.

## Verification (2026-09-27)

- `node scripts/verifyPhase121OpenerIdentification.mjs`: **24 checks PASS**, on synthetic linkedom fixtures with no site names:
  - **G1:**
    - The real-opener shape → `a[data-toggle="modal"][data-target="#login"]` (exact-one + identity).
    - An element with only data-toggle / data-target gets an exact-one locator.
    - Test-attr / aria-controls / real href / tag.class / role-combined strategies each resolve.
    - href `#` / fragment / `javascript:` rejected; hashed / numeric / state classes rejected.
    - No text / positional / XPath locators.
    - Field candidates are byte-identical (inspect and pick).
    - For actions, the existing strategies come first.
  - **G3:**
    - The skip link is excluded while the `href="#"` modal trigger is kept.
    - A fragment pointing to a missing element, and a fragment anchor with popup semantics, are both kept.
    - Popup candidates rank first.
    - Hub: confidence is primary, popup semantics is the tie-breaker, and there is no `final_submit`.
  - **G2:**
    - An inner span resolves to the ancestor anchor, both via `identifyActionTarget` and via an armed `armVisualTargetPick(pickTarget:'action')` with frame tags.
    - Non-actionable / hidden / skip-link targets are rejected.
    - **The field pick still rejects buttons.**
    - The STANDARD pick ignores `pickTarget`.
    - Presses are swallowed only during an action pick, and the listeners are removed afterwards.
    - Wiring is present end to end.
    - Action-specific Hub messages; field messages unchanged.
  - **G4:**
    - Watch listeners install and clean up, and untrusted events are ignored.
    - A trusted pointerdown / keydown is detected.
    - **Gesture during the test → `user_gesture_during_test` (not proven).**
    - Fail-closed when the watch cannot be read.
    - Background order is correct (install before the click, refresh while polling, collect on every reply), and nothing is stored.
    - The exact Hebrew message is used; the editor leaves the button not selected and runs no auto-Analyze.
  - **Binding:** no webNavigation / debugger / getFrameId, and no site branches in the new code.
- **Mutation checks** (each is caught by the new verify, and the source was restored):
  - removing the skip-link filter;
  - ignoring the gesture flag;
  - enabling the vocabulary for fields;
  - dropping ancestor resolution.
- Regressions: all **26** `verifyPhase116…121*.mjs` scripts **PASS**.
  - `verifyPhase120A2ManagedFillDiagnostics.mjs` failed once on its `!blob.includes('999')` assertion and passed 5/5 on re-run. This is a pre-existing flake: the random run id / timestamp can contain `999`. It is unrelated to this slice and not modified.
- `npx tsc -b` exit 0; `npm run build` exit 0; no lints on the changed files.

## Notes for Architecture

1. **Vocabulary is action-only (opt-in).** The binding text says to "extend the shared candidate builder… existing field locator choices must not change". Appending the new strategies to field candidates too would change field candidate lists and matchCounts (e.g. `input[data-testid]`), and `collectSpecialEligibleCredentialLocators` keys off those lists. So the vocabulary applies only to action elements (inspect action candidates and the action pick). Fields and STANDARD are byte-identical, and the verify checks this.
2. **`href` fragments are never used as locators.** Any `#…` href is excluded as a locator, not only `#` itself. Popup-style fragment anchors are still covered by the data-target / aria-controls / class strategies.
3. **Hub ranking.** Label confidence stays primary and popup semantics is only the tie-breaker. Otherwise an unlabeled menu toggle (popup semantics) would outrank a clearly labelled login button. In the Ext list, popup-first ranking is applied before the cap.
4. **New Hebrew copy for action-pick failures.** The field text «…בחרו שדה קלט גלוי.» is wrong for a button pick, so two new plain-Hebrew messages were added:
   - `VISUAL_ACTION_UNSUPPORTED_TARGET_HE`: «לא ניתן לזהות את הכפתור שנבחר. לחצו על הכפתור עצמו באתר.»
   - `VISUAL_ACTION_SKIP_LINK_HE`: «האלמנט שנבחר הוא קישור דילוג בתוך הדף ולא כפתור שפותח מסך. לחצו על הכפתור עצמו באתר.»

   Please confirm or reword.
5. **Status line when not proven.** The session outcome is cleared, so the status line shows «מצב: ממתין לבחירה» (not selected) rather than «מצב: לא נבחר — המסך לא נפתח». The screen may well have opened, and claiming "did not open" would be false. The error line shows the exact G4 message.
6. **Press swallowing in the action pick.** Many modal triggers act on `mousedown` / `pointerdown`, so while an action pick is armed those events are also swallowed (capture). This applies to the action mode only; the field pick is unchanged.
7. **Gesture watch coverage.** The watch runs in frames the extension can script, via `allFrames` (same host-permission scope as the existing cancel handler). A gesture inside a frame it cannot script is not observed. If the watch itself cannot be installed or read, the result is fail-closed (not proven / click not performed).

## Owner live checks (localhost; **do not press ACTIVATE** — localhost uses the production DB)

1. **Floating-screen site (the one from the finding):**
   - Analyze proposes the **real opener** (the `data-toggle="modal"` anchor), not the skip link.
   - Press «בדוק את הכפתור וזהה את השדות» **without touching the site**. The screen opens, the fields are identified, and the status reads «מצב: נבדק ונבחר — המסך נפתח».
2. **Manual opener pick:**
   - Press «זה לא הכפתור», then choose the opener by Visual pick and click the real opener (also try clicking its inner text). The pick succeeds, and the site does **not** open the screen during the pick.
   - Clicking a plain area gives «לא ניתן לזהות את הכפתור שנבחר…».
3. **Not proven:**
   - Press «בדוק את הכפתור וזהה את השדות» and click inside the site before the fields appear. You should see exactly «נראה שלחצת בעצמך באתר בזמן הבדיקה. סגרו את המסך ולחצו שוב על "בדוק את הכפתור וזהה את השדות" בלי ללחוץ באתר.»
   - The button is not selected (status «מצב: ממתין לבחירה»), and there is no auto-Analyze.
   - Close the screen and re-test without touching the site. It should succeed.
4. **Regression, the earlier bank fixture (L-1):** Analyze / test / fields are unchanged (id-based opener), and there is no frame prompt change.
5. **Regression, STANDARD:** the field Visual pick in the STANDARD editor still maps input fields only; clicking a button there still gives the field message «…בחרו שדה קלט גלוי.».

---

# Slice 121.1 D-121-34 CORRECTION — test-then-choose, tested button never replaced (§4.15) (2026-09-27)

**Trigger:** Owner (Mizrahi): after «בדוק את הכפתור וזהה את השדות» succeeded, auto-Analyze (`after_continue`) proposed an unrelated main-page element (`div[aria-label="IPB Center TLV"]`, `floating_opener`), and the panel **replaced** the tested `#logInBtn` («מצב: ממתין לבחירה»). The tested button stayed approved in the draft but disappeared from view. The Owner also expects test first, then choose.

## Implementation

| Item | Where | What |
|---|---|---|
| Panel buttons | `SpecialLoginDraftEditor.tsx` `renderActionPanel` | Exactly two buttons: «בדוק את הכפתור וזהה את השדות» and «זה לא הכפתור». «זה הכפתור הנכון» / «הכפתור נבחר» and `approvePendingAuthoring` removed (labels `approve` / `approved` removed from `SPECIAL_BUTTON_PANEL_HE`). One render function serves both panels, so both panels have the same buttons and rules |
| Test press = consent | `testAndChooseAction(slot)` | Order: `actionForTestPress` (existing `approveActionForAuthoringContinuation`, continuation flag only) → written to the draft (`writeDraftAction`, R3 readiness re-derived) → the draft copy is clicked with the unchanged `performApprovedAuthoringClick` (R3 readiness, D-121-31 busy indicator, auto-Analyze) |
| R3 success | same | `actionAfterTestSuccess` = both flags (existing helpers); status «מצב: נבדק ונבחר — המסך נפתח»; then auto-Analyze on the new draft |
| R3 failure (any reason) | same | `actionAfterTestFailure` = both flags cleared; status «מצב: לא נבחר — המסך לא נפתח»; the existing failure message (`result.message`) unchanged; no auto-Analyze. The action stays shown in its panel |
| Enablement | test button | `busy` / `canUseCurrentSurface` / `canPerformAuthoringClick(actionForTestPress(action), approvedFrameOrigins, allowedOrigin)` (R2 frame approval + reserved kinds). **No** prior-approval requirement |
| Status line | `actionStatusHe(action, outcome)` in `specialActionBar.ts` | failure this session → «מצב: לא נבחר — המסך לא נפתח»; both flags + success this session → «מצב: נבדק ונבחר — המסך נפתח»; both flags (legacy / earlier session) → «מצב: נבחר»; otherwise «מצב: ממתין לבחירה» (legacy single flag = not chosen) |
| No replacement | `runSpecialAnalyze(mode, afterTest)` | `after_continue` never calls `setPendingAction`: the tested action stays in «נמצא כפתור באתר» with its status. The analyze now works on the draft written by the test press (`afterTest.base`), because React state lags one render |
| Follow-up selection | NEW `src/assistedMapping/followUpSelection.ts` | `selectFollowUpAfterContinue`: candidate must be (1) on a **revealed surface**, (2) of a kind the pattern needs (`MULTI_STEP` / `FLOATING_SCREEN_MULTI_STEP` → `intermediate_transition`; `FLOATING_SCREEN` → none), (3) not the same kind on the same surface (frame; top = no frame) as the tested action, (4) not the tested action, (5) not already approved for continuation in the draft. Resolved like a manual proposal (unapproved, collision-safe id, draft not modified) |
| Revealed surface | `revealedSurfaceKeys` | Frames (top = `frameKey(null)`) of this Analyze's new credential-field proposals (ready or waiting for frame approval; unaddressable never counts). When every field was already mapped (re-test), the frames of the selected step's mapped fields. No revealed surface → no follow-up (fail-closed) |
| «נמצא כפתור נוסף» | `followUpAction` state + second panel | Follow-up shown in a separate panel titled «נמצא כפתור נוסף», same two buttons, same test-then-choose. A tested follow-up, or a chosen one, is never replaced by a later auto-Analyze |
| Manual Analyze | unchanged | D-121-26: top proposal (even if already in the draft) in the primary panel, shown with its status. If it is the same element as the follow-up, the follow-up panel is cleared (no duplicate) |
| «זה לא הכפתור» | `rejectAction(slot)` | Removes the action from the draft (unchanged `removeDraftAction`), clears that panel and its status |
| Copy (exact-label rule) | `SPECIAL_EDITOR_COPY_HE` | `actionFound`, `fieldsIdentifiedWithAction`, `visualActionFound`, `autoAnalyzeSuccessWithAction`, `actionAlreadyApproved`, `continueNeedsApproval` now point to «בדוק את הכפתור וזהה את השדות»; `buttonSelected` («הכפתור נבחר ונשמר בטיוטה…») removed with the approval button. `continueNeedsApproval` is now shown only when the test is blocked by frame approval: «אי אפשר להריץ «בדוק את הכפתור וזהה את השדות» על הכפתור הזה. אם הוא בתוך מסגרת, לחצו קודם «אשר מסגרת».» |

**Unchanged:** Ext click gate (Hub `canPerformAuthoringClick` still requires the continuation flag; the message still carries `approvedForAuthoringContinuation: true`; Ext still rejects `unapproved_authoring_click`), R3, iframe rules (§4.10 / §4.10.1), contract flags, validator, merge / planner, §5.2 (a proposal enters the draft only through the test press; «זה לא הכפתור» removes it). No Ext / manifest change. `final_submit` reserved. No site / hostname / serviceId / fixture branches. No 121.2 work. `selectPendingAfterContinue` in `loginContract` is untouched (the editor no longer calls it).

## Notes for Architecture

1. **Failed test keeps the action in the draft with both flags cleared.** This is the literal "clear BOTH flags for that action". The draft check then reports the action as not approved (validator unchanged, fail-closed), until the Admin re-tests it or presses «זה לא הכפתור».
2. **Placement of pure helpers.** The flag transitions (`actionForTestPress` / `actionAfterTestSuccess` / `actionAfterTestFailure`) and `actionStatusHe` are in `specialActionBar.ts`, next to the existing `actionSelected` (D-121-32). The prompt said "labels" there; they are thin wrappers around the existing contract helpers and are there so they can be unit-verified.
3. **Consequence of the same-kind / same-surface rule (by design).** In a flow whose steps stay on one surface (for example Microsoft: username → «הבא» → password, all top document), a second transition on that surface is never auto-proposed after the first transition is tested. A third step's button is found with manual «זהה כפתור ושדות באתר» (D-121-26, unchanged). A final «כניסה» button labelled as an opener is also never a follow-up (wrong kind); `final_submit` stays reserved.
4. **Legacy exit transitions.** The test press writes the action back in place (`setStepExitTransition` when it is a step's exit transition, otherwise `upsertPreambleAction`), so a legacy exit transition is not duplicated into `preambleActions`.

## Evidence

| Command | Result |
|---|---|
| `node scripts/verifyPhase121TestThenChoose.mjs` (NEW) | **PASS** — 1 labels / two buttons / «זה הכפתור הנכון» removed / exact-label rule / sweep; 2 flag transitions with the real helpers + unchanged gate (proposal not clickable → press → clickable; success both flags + status; failure both cleared + status; legacy both / single flag; re-test failure; R2 frame gate; `final_submit`); 3 editor order (consent → draft write → click; failure branch clears + no auto-Analyze; success → both flags → auto-Analyze on the new draft; button enabled without approval; Hub / Ext click gate unchanged); 4 `after_continue` selection (Mizrahi-like fixture: fields in the login iframe + extra top-document opener `div[aria-label="IPB Center TLV"]` → no proposal for any pattern; same kind / same surface excluded; FLOATING_SCREEN → no follow-up; FLOATING_SCREEN_MULTI_STEP → transition from the revealed frame; MULTI_STEP → transition from the revealed surface, id collision re-ided; transition outside the revealed surface excluded; approved draft action skipped; revealed-surface fallback; unaddressable / empty → none); 5 editor wiring (`after_continue` never calls `setPendingAction`, follow-up → «נמצא כפתור נוסף», tested / chosen follow-up not replaced, manual Analyze unchanged, §5.2); 6 scope (no site branches, manifest diff empty) |
| Mutation check (reverted) | Removing the same-kind / same-surface rule → the verify fails; making `after_continue` also set the primary panel → the verify fails ("after_continue never replaces the tested action") |
| `verifyPhase121ActionBar.mjs` §7 / §8, `verifyPhase121SpecialDraftAuthoring.mjs`, `verifyPhase121IframeSurface.mjs` | Updated for the removed approval button (handler `testAndChooseAction`, `rejectAction`, `renderActionPanel`; test-button gate; copy now names «בדוק…»; `«זה הכפתור הנכון»` / `«הכפתור נבחר ונשמר בטיוטה»` added to the old-string sweep). PASS |
| `rg "זה הכפתור הנכון\|הכפתור נבחר ונשמר בטיוטה" src` | no matches (exit 1) |
| All Phase 116–121 verify scripts (`scripts/verifyPhase11[6-9]*.mjs`, `verifyPhase12[01]*.mjs`) | **25 / 25 PASS** (24 previous + the new one) |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0 (existing chunk-size warning only) |
| Lints (edited files) | none |

## Files changed

- `src/admin/SpecialLoginDraftEditor.tsx` — test-then-choose handler, shared two-button panel, follow-up panel / state, test outcomes, `runSpecialAnalyze` base draft + selection after the field write, copy.
- `src/admin/specialActionBar.ts` — `SPECIAL_BUTTON_PANEL_HE` (titles, new status strings; approve / approved removed), `ActionTestOutcome`, `actionForTestPress`, `actionAfterTestSuccess`, `actionAfterTestFailure`, `actionStatusHe`.
- `src/assistedMapping/followUpSelection.ts` (NEW) — `followUpKindsForPattern`, `revealedSurfaceKeys`, `selectFollowUpAfterContinue`.
- `src/assistedMapping/index.ts` — exports.
- `scripts/verifyPhase121TestThenChoose.mjs` (NEW); `scripts/verifyPhase121ActionBar.mjs`, `scripts/verifyPhase121SpecialDraftAuthoring.mjs`, `scripts/verifyPhase121IframeSurface.mjs` — asserts updated.

## Owner check steps

**A. Mizrahi-Tefahot (FLOATING_SCREEN, login inside an iframe)**
1. Open the service → «אופי הכניסה» = «מסך צף» → «זהה כפתור ושדות באתר». Panel «נמצא כפתור באתר» shows `#logInBtn`, «מצב: ממתין לבחירה», and only two buttons: «בדוק את הכפתור וזהה את השדות» (enabled) and «זה לא הכפתור». No «זה הכפתור הנכון».
2. Press «בדוק את הכפתור וזהה את השדות». The floating screen opens in the site tab, «מזהה…» shows, then the fields are identified.
3. Expected: the panel **still** shows `#logInBtn` with «מצב: נבדק ונבחר — המסך נפתח». **No** proposal of `div[aria-label="IPB Center TLV"]` and **no** «נמצא כפתור נוסף» panel.
4. «שמור טיוטה» → reload → the panel is empty until Analyze; «זהה כפתור ושדות באתר» shows `#logInBtn` with «מצב: נבחר» (and «בדוק…» still available for a re-test). «בדוק שהטיוטה מלאה» → complete.
5. Negative: close the floating screen, change nothing, and press «בדוק…» on a button that does not open the screen (for example after a manual pick of another element). Expected: the existing «המסך לא נפתח» message and «מצב: לא נבחר — המסך לא נפתח»; «בדוק שהטיוטה מלאה» reports the button as not approved until you re-test it or press «זה לא הכפתור».

**B. A new floating-screen site (top document, e.g. Bank PAGI or CAL — L-2)**
1. «מסך צף» → «זהה כפתור ושדות באתר» → the opener appears with «מצב: ממתין לבחירה».
2. «בדוק את הכפתור וזהה את השדות» → the screen opens, the fields are identified, and the opener stays in the panel with «מצב: נבדק ונבחר — המסך נפתח». No «נמצא כפתור נוסף» panel (FLOATING_SCREEN needs nothing after the opener).
3. «שמור טיוטה» → «בדוק שהטיוטה מלאה» → complete. No ACTIVATE.

**C. A multi-step site (L-4, e.g. a Microsoft account login)**
1. «רב־שלבים» → on step 1 «זהה כפתור ושדות באתר» → the username field is mapped and the «הבא» button appears in «נמצא כפתור באתר».
2. Type the username manually in the site (authoring never fills values). Then press «בדוק את הכפתור וזהה את השדות». The site moves to the password step, the password field is identified, and «הבא» stays in the panel with «מצב: נבדק ונבחר — המסך נפתח». No other button is proposed on the same page (the final «כניסה» button is never proposed).
3. If the site did not advance: «המסך לא נפתח» + «מצב: לא נבחר — המסך לא נפתח». Advance manually and use «זהה כפתור ושדות באתר» on step 2.
4. Optional, for a site whose second step opens in a different place (for example opener → login frame → «המשך» inside the frame, pattern «מסך צף + רב־שלבים»): after testing the opener, the «המשך» button inside the opened part appears in a **separate** panel «נמצא כפתור נוסף» with the same two buttons. The tested opener stays in «נמצא כפתור באתר».
5. «שמור טיוטה» → reload → «בדוק שהטיוטה מלאה». No ACTIVATE.

---

# Slice 121.1 D-121-33 BUG FIX — contract-safe saves (§4.14) (2026-09-27)

**Trigger:** Owner (Mizrahi, after saving a SPECIAL draft): saving the service fails with «הפעלת חוזה SPECIAL (מפעיל + תוכנית פעילה) מותרת רק דרך loginContractActivateIntent.» (`mergeLoginContractMetadata`, non-intent path).  
**Cause:** general writers send the whole row metadata back. Once a SPECIAL draft exists, the stored `loginFlowPlan` bag carries an `active` key (even null), and possibly `loginContractActivation`. The strict guard correctly treats re-sending them as an activation bypass.  
**Authorized:** D-121-33 / §4.14 only. **STOP** for Architecture re-review.

## Implementation

| §4.14 item | Implementation |
|---|---|
| 1. Shared helper | New `src/admin/contractSafeMetadata.ts`: `withoutLoginContractKeys(metadata)` returns a copy without `loginContractActivation`, `loginFlowPlan`, `loginContractActivateIntent` (`LOGIN_CONTRACT_OWNED_KEYS`). Pure. Only for writers whose destination merges the patch over the stored row (`updateGlobalRegistryRow`, `updateUserOwnedRegistryRow`, create), so an absent key keeps its stored value |
| 2. RegistryAdmin row save | `handleSave` builds `metadata` from `withoutLoginContractKeys(form.metadata)`. That one object is used by create, user-owned update and global update |
| 2. User-owned API | `updateUserOwnedRegistryRow` also strips `patch.metadata`. That path has no contract merge at all, so any contract key sent there would otherwise overwrite the stored contract unguarded |
| 2. Grid | `buildGridProfileMetadataPatch`: the non-intent write (every action without `specialToStandard`) starts from `withoutLoginContractKeys(metadata)`; Phase 120 keys and order unchanged. The `SPECIAL_TO_STANDARD` intent write is **unchanged** (row metadata + intent). The grid Admin-Test stamp save (`persist` of `fieldAuthoring` after a passed Admin Test) also strips |
| 2. Other admin writers | `adminRegistryApi.ts`: `updateIconMetadata`, `updateAdminNotes`, `adminRefreshLoginIntelligence`, `adminOverrideLoginIntelligence` (all spread `row.metadata` into `updateGlobalRegistryRow`) now strip |
| 3. saveDraft | `{ ...withoutLoginContractKeys(row.metadata), loginFlowPlan: { draft } }`: no `active` key, no activation key. The unchanged merge keeps the stored `active` / activation |
| 4. ACTIVATE | ACTIVATE SPECIAL (`activateSpecial`, intent) and the grid `SPECIAL_TO_STANDARD` intent path are unchanged |

Unchanged: `mergeLoginContractMetadata`, `planActivate`, `resolve`, validator, the bypass guard. No Ext / manifest change. No site / hostname / serviceId / fixture branches. `final_submit` reserved. No 121.2 work.

**Sweep (not changed, on purpose):** `markGlobalLoginUrlInvalid` (direct table update of the whole `metadata`), `loginUrlDiscovery` / `registryPersistence` RPCs (`p_metadata`, whole metadata) and `ApprovalQueue` (sends only `loginEntryType` / `loginUrlSource`). The first three replace the whole metadata without the client guard: they are not rejected today, and stripping there would **delete** the stored contract. `adminLogoService` only reads.

### Notes for Architecture
- **State (c) draft save — VERIFY item not met without a merge change.** For a SPECIAL_INVALID row (version mismatch or corrupt activation), «שמור טיוטה» sends only `loginFlowPlan: { draft }`, so it reaches the unchanged non-intent merge. That merge ends with `assertLoginContractMetadataConsistent`, which refuses to write while the stored contract is mixed: «מצב מעורב אסור של מפעיל חוזה ותוכנית זרימה.» (`forbiddenMixedState`, not the bypass message). Nothing is written, and this is fail-closed by design. Making it succeed would require changing merge / consistency logic, which the hard constraints forbid. The verify therefore asserts the refusal, that nothing was written, and recovery: grid `SPECIAL_TO_STANDARD` (D-121-30 A3) returns the row to STANDARD, after which draft saves work. Row save (global + user-owned) and grid non-intent save **do** succeed on state c. Decision needed only if draft authoring on a SPECIAL_INVALID row must work without recovering first.
- **User-owned strip inside the API** is defensive (beyond the caller strip), because that path has no contract merge. Global `updateGlobalRegistryRow` is **not** stripped internally: contract writers use it.
- **Byte-identical check:** every successful save leaves `loginContractActivation` (value and presence), `loginFlowPlan.active` and the resolved mode as they were. For state (d), a draft save creates the bag with `active: null` (none before), which is still no active plan and resolves STANDARD.

## Evidence

| Check | Result |
|---|---|
| `node scripts/verifyPhase121ContractSafeSaves.mjs` (new) | **PASS**. Runs the **real** `adminRegistryApi` (`updateGlobalRegistryRow` / `updateUserOwnedRegistryRow`, incl. the unchanged merge) against an in-memory Supabase fake; only the Supabase client, env, auth and three loader modules imported by `adminRegistryApi` are stubbed. Sections: **1** helper removes exactly the three keys, pure. **2** root cause reproduced: the old writer payload (whole row metadata) is rejected with the bypass message for states a / b / c1 / c2; d unaffected. **3** for a / b / d, global row save, user-owned row save, grid non-intent save, draft save and a second row save all succeed with activation + active + mode byte-identical and the writer's own fields / new draft stored. The user-owned API ignores contract keys even when a caller sends them. For c1 / c2, row and grid saves succeed byte-identical; draft save is refused (`forbiddenMixedState`, nothing written) and recoverable via grid `SPECIAL_TO_STANDARD`. **4** direct non-intent SPECIAL activation, `loginFlowPlan.active` (plan or null) writes are still rejected with the same message and change nothing; guard lines unchanged; contract files don't use the helper. **5** ACTIVATE SPECIAL (unchanged editor payload) activates; row save afterwards keeps it live; grid `SPECIAL_TO_STANDARD` still sends its unchanged payload and returns to STANDARD; the grid non-intent patch has no contract keys and the same Phase 120 key order. **6** writer wiring for all fixed writers; `markGlobalLoginUrlInvalid` not stripped; sweep shows only ACTIVATE SPECIAL still re-sends row metadata through the merging update paths |
| All Phase 116–121 verify scripts (24, incl. the new one) | **24 / 24 PASS** |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0 (existing chunk-size warning only) |

## Files changed
- `src/admin/contractSafeMetadata.ts` (new)
- `src/admin/RegistryAdmin.tsx`
- `src/admin/adminRegistryApi.ts`
- `src/admin/specialActionBar.ts`
- `src/admin/AutofillProfileEditor.tsx`
- `src/admin/SpecialLoginDraftEditor.tsx`
- `scripts/verifyPhase121ContractSafeSaves.mjs` (new)

## Owner check steps
1. **Re-save Mizrahi's row:** Admin → registry → Mizrahi-Tefahot → change nothing (or a harmless field such as notes / display name) → «שמור». Expected: success («האתר עודכן.»), no page-level error.
2. Reload the Admin page and open Mizrahi's SPECIAL editor. The saved draft is still there and «פעיל כעת» shows the same state as before step 1.
3. In the SPECIAL editor press «שמור טיוטה», then save the row again. Both succeed.
4. Regular grid for Mizrahi: save the mapping (non-activate). It succeeds, and the SPECIAL draft / live state is unchanged after reload.
5. (If a SPECIAL contract is live) «שמור» on the row keeps «פעיל כעת: SPECIAL v…» unchanged. Activation and the grid «החלף» return path behave as before.
6. Another service without SPECIAL: row save and grid save behave exactly as before.

## D-121-32a — continuation button renamed (§4.13 add-on, Owner 2026-09-27)

**Implementation:** `SPECIAL_BUTTON_PANEL_HE.testOpen` changed from «בדוק שהכפתור פותח את המסך» to «בדוק את הכפתור וזהה את השדות», because the click also runs field identification. Every message naming it was updated (exact-label rule D-121-23): `actionFound`, `actionAlreadyApproved`, `continueNeedsApproval`, `autoAnalyzeSuccessWithAction` and `visualActionFound`, plus the approval success message, now exactly «הכפתור נבחר ונשמר בטיוטה. עכשיו לחצו «בדוק את הכפתור וזהה את השדות».». Behavior, gating (both flags + `canPerformAuthoringClick`) and the helper line are unchanged. No other changes. No 121.2 work.

**Evidence:** `rg "בדוק שהכפתור פותח את המסך" src` finds no matches. Verify asserts updated: `verifyPhase121ActionBar.mjs` §8 (exact label, exact success message, old string added to the sweep, quoted-label filter covers «בדוק את…»), `verifyPhase121SpecialDraftAuthoring.mjs` (panel label + copy keys) and `verifyPhase121IframeSurface.mjs` (assert message). All Phase 116–121 verify scripts **24 / 24 PASS**; `npx tsc -b` exit 0; `npm run build` exit 0.

**Files changed:** `src/admin/specialActionBar.ts`, `src/admin/SpecialLoginDraftEditor.tsx`, `scripts/verifyPhase121ActionBar.mjs`, `scripts/verifyPhase121SpecialDraftAuthoring.mjs`, `scripts/verifyPhase121IframeSurface.mjs`.

**Owner check:** in «נמצא כפתור באתר», press «זה הכפתור הנכון». The message reads «הכפתור נבחר ונשמר בטיוטה. עכשיו לחצו «בדוק את הכפתור וזהה את השדות».», and the enabled button carries that exact label. Pressing it opens the screen and identifies the fields as before.

---

# Slice 121.1 D-121-32 CORRECTION — «נמצא כפתור באתר» panel (§4.13) (2026-09-27)

**Trigger:** Owner (Mizrahi L-1): pressing «זה הכפתור הנכון» gave no feedback, and the purpose of «אשר לשימוש בהפעלה» / «דחה» / «פתח את מסך הכניסה» was unclear. Code: both approve handlers set flags silently, the buttons stayed enabled, and the status line showed technical flag names. `approvedForRuntime` is required by the validator (`actionNotApprovedForRuntime`).  
**Authorized:** D-121-32 / §4.13 only. **STOP** for Architecture re-review.

## Implementation

| §4.13 item | Implementation |
|---|---|
| Shared copy / helper | `src/admin/specialActionBar.ts`: `SPECIAL_BUTTON_PANEL_HE` (approve / approved / reject / testOpen / testOpenHelper / statusSelected / statusWaiting) and `actionSelected(action)` = `approvedForAuthoringContinuation === true && approvedForRuntime === true` |
| 1. Single approval | `approvePendingAuthoring`: `approveActionForRuntime(approveActionForAuthoringContinuation(pendingAction))`, the existing helpers in sequence, then the unchanged `upsertPreambleAction` + `rederiveRevealReadiness`. `approvePendingRuntime` and the `data-action="approve-runtime"` button are removed. Contract flags and validator unchanged |
| 2. Feedback | After the press: `setError(null)` + success «הכפתור נבחר ונשמר בטיוטה. עכשיו לחצו «בדוק שהכפתור פותח את המסך».» (`SPECIAL_EDITOR_COPY_HE.buttonSelected`). The approve button reads «הכפתור נבחר» and is `disabled` while `actionSelected(pendingAction)`; the existing R2 frame gate stays |
| 3. Status line | `data-status="action-selection"`: «מצב: נבחר» when both flags are set, «מצב: ממתין לבחירה» otherwise |
| 4. Reject | Label «זה לא הכפתור». `rejectPending` unchanged (`removeDraftAction`, clear proposal) |
| 5. Test-open | Label «בדוק שהכפתור פותח את המסך». `continueAfterApproval` unchanged (continuation click, R3 readiness, auto-Analyze with the D-121-31 busy indicator). Enabled only when `actionSelected(pendingAction)` **and** the existing `canPerformAuthoringClick` (R2 / reserved kind). The handler guard mirrors the button gate. Helper line `data-status="test-open-helper"` under the panel, exact text |
| 6. Legacy drafts | An action with one flag only: `actionSelected` = false → «מצב: ממתין לבחירה», approve enabled, test-open disabled. One press sets both |
| 7. Exact-label rule | `actionFound`, `actionAlreadyApproved` (now «הכפתור שנמצא כבר נבחר. כדי לבדוק אותו לחצו «בדוק שהכפתור פותח את המסך».»), `continueNeedsApproval`, `autoAnalyzeSuccessWithAction` and `visualActionFound` name «בדוק שהכפתור פותח את המסך». `fieldsIdentifiedWithAction` keeps «זה הכפתור הנכון» (label unchanged). Sweep of `src/`: no «פתח את מסך הכניסה», «אשר לשימוש בהפעלה», «אושר לפתיחת המסך», «אושר לשימוש בהפעלה» |

Unchanged: contract, validator, R3, iframe rules (§4.10 / §4.10.1), §5.2 proposal-vs-draft, Ext, manifest. No site / hostname / serviceId / fixture branches. `final_submit` reserved. No 121.2 work.

### Notes for Architecture
- **Test-open gate for legacy continuation-only actions:** before this change, «פתח את מסך הכניסה» was enabled whenever `approvedForAuthoringContinuation` was set (`canPerformAuthoringClick`). Now the button and handler also require `actionSelected`, per item 5 ("enabled only after approval"). So a legacy continuation-only action needs one press of «זה הכפתור הנכון» first. `canPerformAuthoringClick` and the Ext are unchanged.
- **Message choice:** `runSpecialAnalyze` / `visualPickAction` now choose between "press «זה הכפתור הנכון»" and «הכפתור שנמצא כבר נבחר…» with `actionSelected` instead of the continuation flag alone, so a legacy single-flag action is asked to be chosen. `selectPendingForManualAnalyze` / `selectPendingAfterContinue` are unchanged.
- **Frame prompt «דחה»:** the frame-approval prompt's «דחה» (`FRAME_REJECT_LABEL_HE`, «אשר מסגרת» / «דחה») is a different panel and is not in §4.13. It is unchanged.
- **Validator copy:** a legacy continuation-only draft still gets «הטיוטה לא מלאה: פעולת זרימה חייבת להיות מאושרת לריצה לפני הפעלה.» from «בדוק שהטיוטה מלאה». That is the unchanged validator message; pressing «זה הכפתור הנכון» clears it.
- **Verify supersessions:**
  - `verifyPhase121SpecialDraftAuthoring.mjs`: the D-121-23 panel label / status asserts now use `SPECIAL_BUTTON_PANEL_HE`, check that `approve-runtime` is absent, and expect «בדוק שהכפתור פותח את המסך» in the copy. The §5.2 approve / reject asserts drop the runtime handler.
  - `verifyPhase121IframeSurface.mjs`: the approve `disabled` assert is a prefix match (the gate now has an extra clause), and the continue assert message uses the new label.
  - `verifyPhase121ActionBar.mjs` section 5: the quoted-label filter is narrowed to action-bar names, because «בדוק שהכפתור…» is a panel label.

## Evidence

| Check | Result |
|---|---|
| `node scripts/verifyPhase121ActionBar.mjs`, new section 8 | **PASS**. Exact labels, helper, status and success copy. With the real helpers, for fresh, continuation-only and runtime-only actions: not selected before, one press stores both flags in the draft (through `upsertPreambleAction` + `rederiveRevealReadiness`), selected after. The validator makes a continuation-only draft incomplete and a both-flags draft complete. Handler uses both helpers in sequence plus the success message; `approvePendingRuntime` / `approve-runtime` absent. Approve disabled while selected, with the «הכפתור נבחר» label. Status line both states. Reject removes the action (real `removeDraftAction`) and clears the proposal. Test-open gated by `actionSelected` + `canPerformAuthoringClick` (legacy continuation-only: Ext gate alone would allow, editor requires selection); handler guard matches; continuation / auto-Analyze calls unchanged. Helper line present. Copy keys name the new label; old-string sweep over `src/`; quoted panel labels are current. Sections 1–7 still PASS |
| All Phase 116–121 verify scripts (23) | **23 / 23 PASS** |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0 (existing chunk-size warning only) |

## Files changed
- `src/admin/specialActionBar.ts`: `SPECIAL_BUTTON_PANEL_HE`, `actionSelected`
- `src/admin/SpecialLoginDraftEditor.tsx`
- `scripts/verifyPhase121ActionBar.mjs`: section 8 + section 5 filter
- `scripts/verifyPhase121SpecialDraftAuthoring.mjs`
- `scripts/verifyPhase121IframeSurface.mjs`

## Owner check steps
1. In the SPECIAL editor, press «זהה כפתור ושדות באתר» until «נמצא כפתור באתר» appears. The status reads «מצב: ממתין לבחירה» and «בדוק שהכפתור פותח את המסך» is disabled. There is no «אשר לשימוש בהפעלה» button.
2. Press «זה הכפתור הנכון». The message «הכפתור נבחר ונשמר בטיוטה. עכשיו לחצו «בדוק שהכפתור פותח את המסך».» appears, the button reads «הכפתור נבחר» (disabled), the status reads «מצב: נבחר», and «בדוק שהכפתור פותח את המסך» becomes enabled. The helper line under the panel explains the test.
3. Press «בדוק שהכפתור פותח את המסך». The site screen opens and «מזהה…» shows during identification, as before.
4. On another proposal, press «זה לא הכפתור». The panel closes and the button is not in the draft.
5. «בדוק שהטיוטה מלאה» after step 2 no longer reports a missing run approval.
6. (Legacy) For a service whose saved draft had only the first approval, the panel shows «מצב: ממתין לבחירה». One press of «זה הכפתור הנכון» shows «מצב: נבחר».

---

# Slice 121.1 D-121-31 CORRECTION — SPECIAL editor top buttons (§4.12) (2026-09-27)

**Trigger:** Owner (Mizrahi L-1): the SPECIAL Analyze button showed nothing while running (only disabled). The three top labels were unclear. The manual opener / transition picks were never needed, and «מעבר» was enabled even on FLOATING_SCREEN.  
**Authorized:** D-121-31 / §4.12 only. **STOP** for Architecture re-review.

## Implementation

| §4.12 item | Implementation |
|---|---|
| 1. Labels | Analyze «זהה כפתור ושדות באתר» (`SPECIAL_ANALYZE_HE.label` in `specialActionBar.ts`; the SPECIAL editor no longer uses the STANDARD `ANALYZE_LOGIN_PAGE_LABEL_HE` + «(משטח נוכחי)»). Opener pick «סמנו בעצמכם את כפתור פתיחת המסך הצף» and transition pick «סמנו בעצמכם את כפתור המעבר בין השלבים» (`SPECIAL_VISUAL_BUTTON_HE.opener` / `.transition`; these values also feed the armed-status line). Waiting text «ממתין ללחיצה על הכפתור…» unchanged |
| 2. Analyze busy | New `analyzing` state. Manual: set in `analyzeCurrentSurface` before `runSpecialAnalyze('manual')`, cleared in `finally`. Auto-Analyze: set in `continueAfterApproval` only after the click succeeded (the click itself keeps the existing «פועל בלשונית האתר שנפתחה» status), cleared in `finally`. While set: button text «מזהה…», `aria-busy`, and `<p role="status" data-status="special-analyze-busy">` «מזהה כפתורים ושדות באתר. זה יכול לקחת כמה שניות…». When the run ends, the status line disappears and the existing result message set by `runSpecialAnalyze` stays. `busy` is still held for the whole run, so the other bar buttons stay disabled as before |
| 3. Enablement | Pure helpers `manualPickRelevant(kind, pattern)` and `specialTopBarEnablement(pattern)` in `specialActionBar.ts`. Analyze: every SPECIAL pattern. Opener: FLOATING_SCREEN / FLOATING_SCREEN_MULTI_STEP. Transition: MULTI_STEP / FLOATING_SCREEN_MULTI_STEP. `const topBar = specialTopBarEnablement(pattern)` is computed from the selected pattern state on every render, so it updates the moment «אופי הכניסה» changes (no save / reload). Each button is `disabled={busy \|\| !canUseCurrentSurface \|\| !topBar.<x>}`: the existing gates stay on top. All three buttons are always rendered |
| 3. Disarm | `onPatternChange`: after the existing clears, if an action pick is armed and `!manualPickRelevant(armed.kind, next)` (STANDARD makes both irrelevant) → `cancelArmedVisualPick()`, the same path as «ביטול» (token bump, Ext `cancelCurrentTabVisualMapping` on the session tab, release, «המיפוי החזותי בוטל. לא נשמר מיפוי.»). A still-relevant pick stays armed |
| 4. Exact-label rule | The 60 s timeout texts `visualPickTimeoutOpener` / `visualPickTimeoutTransition` now quote the new labels. Sweep of `src/**/*.ts{,x}`: no «(משטח נוכחי)», «מיפוי חזותי — פותח», «מיפוי חזותי — מעבר». Every «…» in the SPECIAL editor naming these buttons equals a current label. The field-level «מיפוי חזותי» button is unchanged (not in scope) |

Unchanged: Analyze / Visual / click behavior, progressive approval, §5.2 proposal-vs-draft, iframe rules (§4.10 / §4.10.1), contract. Pattern / state based only; no site / hostname / serviceId / fixture branches. No Ext / manifest change. `final_submit` reserved. No 121.2 work.

### Notes for Architecture
- **Pattern select while a manual pick is armed:** before this change, «אופי הכניסה» was `disabled={busy}`. An armed pick holds `busy`, so the "pattern changes while armed" case could not occur. To make §4.12's disarm rule reachable, the select is now `disabled={busy && armedPick?.target !== 'action'}`: usable only while a manual opener / transition pick is armed. It stays disabled during Analyze, click, save / activate, and field picks. A field pick was left out on purpose: it writes to the selected step, which a pattern change resets.
- The auto-Analyze start message «המסך נפתח. מנתח את שדות הכניסה…» is kept (it tells the Admin the click worked). The busy status line appears under the bar at the same time and is removed when the run ends.
- **Verify supersession:** in `verifyPhase121SpecialDraftAuthoring.mjs`, the two timeout-copy asserts now expect the new labels.

## Evidence

| Check | Result |
|---|---|
| `node scripts/verifyPhase121ActionBar.mjs`, new section 7 | **PASS**. Exact labels and busy copy; no English. Manual and auto-Analyze set busy before the run (auto only after the click) and clear it in `finally`. The status line has `role="status"` and shows only while analyzing. The existing result messages are kept. Busy / surface gates still apply. Enablement matrix for the 3 patterns (+ STANDARD all off) run against the real helper. Buttons are always rendered. Enablement comes from the live `pattern` state, not the draft or row. An irrelevant armed pick is cancelled via `cancelArmedVisualPick()` after the clears; `manualPickRelevant` truth table checked. Old-string sweep plus the quoted-label check; the timeout texts quote the new labels. Enablement has no site branches. Sections 1–6 (D-121-30 / A3) are unchanged |
| All Phase 116–121 verify scripts (23) | **23 / 23 PASS** |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0 (existing chunk-size warning only) |

## Files changed
- `src/admin/specialActionBar.ts`: `SPECIAL_ANALYZE_HE`, `manualPickRelevant`, `specialTopBarEnablement`
- `src/admin/SpecialLoginDraftEditor.tsx`
- `scripts/verifyPhase121ActionBar.mjs`: section 7
- `scripts/verifyPhase121SpecialDraftAuthoring.mjs`: timeout-copy asserts

## Owner check steps
1. Open the SPECIAL editor with «אופי הכניסה» = מסך צף. Buttons: «זהה כפתור ושדות באתר» (enabled), «סמנו בעצמכם את כפתור פתיחת המסך הצף» (enabled), «סמנו בעצמכם את כפתור המעבר בין השלבים» (disabled).
2. Switch to «רב־שלבים» without saving: the opener button becomes disabled and the transition button enabled. Switch to «מסך צף + רב־שלבים»: both enabled.
3. Click «זהה כפתור ושדות באתר»: while it runs, the button reads «מזהה…» and the line «מזהה כפתורים ושדות באתר. זה יכול לקחת כמה שניות…» appears. The other buttons are disabled. When it finishes, the line is replaced by the usual result message.
4. Approve a found opener → «פתח את מסך הכניסה»: once the screen opens, the same «מזהה…» indicator shows during the automatic identification.
5. With «מסך צף», click the opener pick (waiting state), then change «אופי הכניסה» to «רב־שלבים». The pick is cancelled («המיפוי החזותי בוטל. לא נשמר מיפוי.») and clicking on the site maps nothing.
6. Wait 60 s on an armed pick without clicking: the timeout message names the new button label.

---

# Slice 121.1 D-121-30 CORRECTION — SPECIAL editor action bar (§4.11) (2026-09-27)

**Trigger:** Owner found the action-bar labels unclear («בדוק Snapshot», «ACTIVATE SPECIAL», «ACTIVATE STANDARD»), and both ACTIVATE buttons wrote to all users immediately, without confirmation.  
**Authorized:** D-121-30 / §4.11 only. **STOP** for Architecture re-review.

## Implementation

| §4.11 item | Implementation |
|---|---|
| Shared copy / helpers | New `src/admin/specialActionBar.ts` (pure, no React): `SPECIAL_ACTION_BAR_HE`, `SPECIAL_ACTIVATE_LABEL_HE` (per pattern), `GRID_SPECIAL_TO_STANDARD_HE`, `draftIncompleteMessageHe`, `checkSpecialDraft`, `liveContractIsSpecial`, `buildGridProfileMetadataPatch`. All Admin-visible strings of the bar live here, so the editor, grid and verify use one source |
| 1. «בדוק שהטיוטה מלאה» | Button label replaced. Still preview only (no write). `checkSpecialDraft(draft)` = A1 `normalizeLegacyDraftReadiness` → `createImmutableDraftSnapshot(normalized, { snapshotId: 'preview' })` (parse + `validateSpecialPlanComplete`, unchanged). Complete → «הטיוטה מלאה ומוכנה להפעלה.»; incomplete → «הטיוטה לא מלאה: <validator message>.» (the existing Hebrew validator / `draftCompletenessPreview` message, trailing period trimmed). The old «Snapshot מלא / חלקי … ACTIVATE …» strings are gone |
| 2. «שמור טיוטה» | Label unchanged (now read from `SPECIAL_ACTION_BAR_HE.saveDraft`) |
| 3. Activate (SPECIAL) | Label by pattern: FLOATING_SCREEN «הפעל כניסה עם מסך צף», MULTI_STEP «הפעל כניסה בכמה שלבים», FLOATING_SCREEN_MULTI_STEP «הפעל כניסה עם מסך צף בכמה שלבים». `disabled={busy \|\| !draftCheck.complete}`, where `draftCheck = useMemo(() => checkSpecialDraft(draft))` is the same check as item 1 (after A1). Click opens an in-app `role="alertdialog"` overlay (`data-panel="special-activate-confirm"`, no `window.confirm`) with the exact text and «הפעל» / «ביטול». «ביטול» only closes the dialog. «הפעל» calls the existing `activateSpecial()`, whose body is **unchanged** (A1 normalize, transition `SPECIAL_TO_SPECIAL` / `STANDARD_TO_SPECIAL`, intent `{ transition, draft: normalized }`). The dialog state resets when the row changes |
| 4. ACTIVATE STANDARD removed | Button and `activateStandard` handler deleted from `SpecialLoginDraftEditor.tsx` (no `SPECIAL_TO_STANDARD` / `STANDARD_TO_STANDARD` / `autofillProfileAction` writes remain in the SPECIAL editor). **Return path:** the regular grid (`AutofillProfileEditor`). When `resolveActiveLoginContract(row.metadata).mode === 'SPECIAL'`, «אשר מיפוי» first opens `data-panel="special-to-standard-confirm"` with «השירות פועל כרגע עם תהליך כניסה מיוחד. להחליף אותו במיפוי הרגיל לכל המשתמשים?» and «החלף» / «ביטול». «החלף» continues to the existing Phase 120 approve dialog, readiness probe and `persist('activate_validated')`. That write is built by `buildGridProfileMetadataPatch`, which adds `[LOGIN_CONTRACT_ACTIVATE_INTENT_KEY]: { transition: 'SPECIAL_TO_STANDARD', autofill: { previous, proposed: { fieldMappings, loginEntryUrl, allowedOrigin }, loginFields, loginUrl, action: 'activate_validated', liveValidationApproved, managedReadinessProbePassed } }`, the same shape the removed `activateStandard()` sent. «ביטול» (on either dialog) writes nothing |
| Live = STANDARD | `buildGridProfileMetadataPatch` without `specialToStandard` produces the same keys, values and key order as the Phase 120 inline object (`...metadata`, `autofillProfile`, action, live-validation, readiness-probe). No intent key, no extra dialog. Verified byte-identical for every grid action |
| 5. Explanation line | `<p class="admin-muted" data-panel="action-bar-explanation">` directly under the bar, always rendered, exact text, no tooltip |
| 6. Exact-label rule | Hub copy naming the bar uses the new labels; editor hint no longer says «(ACTIVATE)». No English in the bar's Admin-visible labels. Sweep over `src/**/*.ts{,x}` finds none of: «בדוק Snapshot», «Snapshot מלא», «Snapshot חלקי», «ACTIVATE SPECIAL», «ACTIVATE STANDARD», «(ACTIVATE)» |

Unchanged: contract parse / validator / planner (`planLoginContractActivate`) / merge (`mergeLoginContractMetadata`). Only the sender of the `SPECIAL_TO_STANDARD` intent moved, from the SPECIAL editor to the grid. No Ext / manifest change. No site / hostname / serviceId / fixture branches. `final_submit` reserved. No 121.2 work.

### Notes for Architecture
- **`canApprove` relaxation (grid):** the last clause is now `existing.supportState !== 'validated' || liveSpecial`. Without it, a service whose regular mapping was already validated before switching to SPECIAL could not be activated from the grid, so there would be no return path. When live = STANDARD, the gate is unchanged.
- **Dialog order:** the SPECIAL→STANDARD dialog comes first, then the existing Phase 120 approve dialog and readiness probe. `confirmApproveMapping` refuses to write while live = SPECIAL unless «החלף» was confirmed in this attempt; cancelling either dialog resets that flag.
- **`loginUrl` in the grid intent** is the row's `login_url` (the grid's `loginEntryUrl`). The removed `activateStandard()` used `authoringUrl || autofill.loginEntryUrl`; the grid has no authoring URL. The planner does not read it for the transition decision.
- *(Superseded by A3 below: rejected by Architecture; SPECIAL_INVALID now takes the return path.)* **Live `SPECIAL_INVALID`** is treated as not SPECIAL: no dialog, no intent. This matches the old behaviour, where only a valid live SPECIAL contract took the `SPECIAL_TO_STANDARD` path.
- **Verify supersessions:** `verifyPhase121SpecialDraftAuthoring.mjs` now checks the snapshot path in `specialActionBar.ts`, asserts `SPECIAL_TO_STANDARD` is absent from the SPECIAL editor but present in the grid patch builder, and resolves exact labels from the new constants. `verifyPhase121IframeSurface.mjs` A1 assert now follows `checkSpecialDraft` (A1 still before snapshot validation), and the ACTIVATE slice ends at `validateSnapshot` because `activateStandard` no longer exists.

## Evidence

| Check | Result |
|---|---|
| `node scripts/verifyPhase121ActionBar.mjs` (new) | **PASS**. Sections: 1 exact labels per pattern + explanation + dialog copy, no English; 2 `checkSpecialDraft` complete / incomplete copy, A1 legacy readiness becomes complete after normalization, one check shared by the note and the activate gate, preview writes nothing; 3 editor buttons, activate disabled on incomplete draft, confirm-cancel calls no write, `activateSpecial()` reachable only from «הפעל», intent unchanged, STANDARD activation absent; 4 grid live STANDARD payload byte-identical with no dialog, live SPECIAL → «החלף» dialog + `SPECIAL_TO_STANDARD` intent, `mergeLoginContractMetadata` switches the live contract to STANDARD (the old payload without intent leaves it SPECIAL); 5 old-string sweep + quoted labels equal current labels; 6 scope |
| All Phase 116–121 verify scripts (23) | **23 / 23 PASS** |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0 (existing chunk-size warning only) |

## Files changed
- `src/admin/specialActionBar.ts` (new)
- `src/admin/SpecialLoginDraftEditor.tsx`
- `src/admin/AutofillProfileEditor.tsx`
- `scripts/verifyPhase121ActionBar.mjs` (new)
- `scripts/verifyPhase121SpecialDraftAuthoring.mjs`
- `scripts/verifyPhase121IframeSurface.mjs`

## D-121-30 A3 — return path for live SPECIAL_INVALID (2026-09-27)

**Trigger:** Architect Review D-121-30 rejected flag 3. `resolveActiveLoginContract` fails closed on SPECIAL_INVALID (no STANDARD fallback) and `planLoginContractActivate` accepts SPECIAL_TO_STANDARD as recovery, so with ACTIVATE STANDARD removed the grid must offer the return path for SPECIAL_INVALID too.

### Implementation

| A3 item | Implementation |
|---|---|
| 1. Helper | `liveContractIsSpecial` (`mode === 'SPECIAL'`) replaced by `liveContractIsNotStandard(metadata)` = `resolveActiveLoginContract(metadata ?? {}).mode !== 'STANDARD'`, i.e. SPECIAL or SPECIAL_INVALID. `resolveActiveLoginContract` and `planLoginContractActivate` are not changed |
| 1. Grid | `AutofillProfileEditor.tsx`: `liveSpecial` renamed to `liveNotStandard = liveContractIsNotStandard(row.metadata)`. It drives the same three places as before: the «החלף» / «ביטול» dialog in `requestApproveMapping`, the no-write guard plus the `specialToStandard` flag in `confirmApproveMapping`, and the `canApprove` relaxation. The intent payload builder is unchanged |
| 2. Unchanged | Dialog text and buttons unchanged. Live STANDARD, whether activation is missing or explicit `mode: 'STANDARD'`: payload byte-identical, no dialog |

Contract / validator / planner / merge unchanged. No Ext / manifest change. No site branches. `final_submit` reserved. No 121.2 work.

### Evidence

| Check | Result |
|---|---|
| `verifyPhase121ActionBar.mjs` section 4 | **PASS**. For each live SPECIAL_INVALID reason: `corrupt_special_activation` (`activePlanVersion: 0`), `missing_active_plan` (`active: null`), `active_plan_version_mismatch` (activation 99 vs plan 1). Each fixture resolves to that exact reason. `liveContractIsNotStandard` is true, so the dialog and the relaxed gate apply. The grid patch carries a SPECIAL_TO_STANDARD intent identical to the live SPECIAL case. The unchanged `mergeLoginContractMetadata` / planner accepts it and the result resolves STANDARD. Without the intent, the service stays non-STANDARD. The live SPECIAL cases are kept, and the live STANDARD cases (byte-identical payload for every grid action, no intent, explicit STANDARD activation) are kept. Wiring asserts are updated to `liveNotStandard`, and the helper is asserted to use `!== 'STANDARD'` |
| All Phase 116–121 verify scripts (23) | **23 / 23 PASS** |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0 (existing chunk-size warning only) |

**Files changed (A3):** `src/admin/specialActionBar.ts`, `src/admin/AutofillProfileEditor.tsx`, `scripts/verifyPhase121ActionBar.mjs`.

**Owner check (A3):** for a service whose live SPECIAL contract is broken (for example, an activation version that no longer matches the active plan), open the regular grid → «אשר מיפוי» → the «החלף» dialog appears → «החלף» → approve → the service returns to the regular mapping.

## Owner check steps
1. Admin → SPECIAL editor for a service. Under the bar: «בדוק שהטיוטה מלאה», «שמור טיוטה», and the activate button labelled for the chosen pattern (switch pattern to see all three). No «ACTIVATE STANDARD». The explanation line is visible without hovering.
2. With an incomplete draft: «בדוק שהטיוטה מלאה» shows «הטיוטה לא מלאה: …» and the activate button is disabled. Complete the draft: the check shows «הטיוטה מלאה ומוכנה להפעלה.» and the button enables.
3. Click activate → in-app dialog with the exact text. «ביטול» → nothing changes (reload: live contract unchanged). Click again → «הפעל» → the service becomes SPECIAL as before.
4. With live = SPECIAL, open the regular grid for the same service and click «אשר מיפוי». First dialog: «השירות פועל כרגע עם תהליך כניסה מיוחד…» with «החלף» / «ביטול». «ביטול» → nothing written. «החלף» → existing approve dialog → probe → service returns to the regular mapping.
5. On a service with live = STANDARD, grid approval looks and behaves exactly as in Phase 120 (no extra dialog).

---

# Slice 121.1 D-121-29 CORRECTION — frame correlation via postMessage nonce handshake (§4.10.1) (2026-09-27)

**Trigger:** Owner L-1 (Mizrahi-Tefahot, Chrome 153) — manual Analyze with the floating screen open → «הדפדפן אינו תומך בזיהוי מסגרות» (`frame_correlation_unavailable`); «פתח את מסך הכניסה» opened the screen but the Hub reported «המסך לא נפתח».  
**Cause:** `chrome.runtime.getFrameId` is not implemented in Chrome (Firefox only). The login iframe was never correlated, so it was never a `depth1_https` surface and no new input was ever seen by reveal readiness. The offline harness had mocked `getFrameId`.  
**Authorized:** D-121-29 / §4.10.1 only. **STOP** for Architecture re-review.

## Implementation

| §4.10.1 rule | Implementation |
|---|---|
| Replace | `extension/generic/frame-correlation.js`: `getFrameId` removed entirely. Public functions kept: `__collectFrameCorrelation()` → `{ ok, frames: [{ frameId: null, nonce, frameLocator, visible, rectArea }] }`; `__resolveFrameByLocator(locator)` → `{ ok, frameId: null, nonce }` (same `frame_missing` / `frame_ambiguous` for 0 / >1 locator matches). The background fills `frameId` from the handshake, so `enumerateSpecialAuthoringFrames` / `resolveDeclaredFrame` consumers see the same record shape as before |
| Listener (step 1) | The same file installs, once per window (`__pvFrameCorrelationListener` flag), a `message` listener that holds `{ type: 'pv-frame-correlation-nonce', nonce }` only if `event.source === window.parent` **and** `window !== window.top && window.parent === window.top` (depth 1). Nonce must be 32 lowercase hex chars. Held list capped (32) with a 30 s TTL. Injected by `specialFrameNonceHandshake` with `allFrames: true`, `world: 'ISOLATED'` |
| Sender (step 2) | Frame 0, ISOLATED: per light-DOM `<iframe>` (enumerate) or the single element matched by the stored `frameLocator` (resolve), a fresh nonce from `crypto.getRandomValues(new Uint8Array(16))` (128 bit), then `iframe.contentWindow.postMessage({ type, nonce }, '*')`. No crypto → `frame_correlation_unavailable` |
| Read-back (step 3) | After `SPECIAL_FRAME_HANDSHAKE_WAIT_MS` (150 ms), `allFrames: true` ISOLATED `__readFrameCorrelationNonces(expected)` returns only the nonces of **this attempt** held by that frame and discards them. Nonces of other attempts are never returned as matches |
| Exact-one | `specialMatchFrameNonces(nonces, receipts)` in the background: a nonce maps to a frameId only if exactly one frame (never frame 0) received it **and** that frame received exactly one nonce of this attempt. Otherwise `none` / `ambiguous`. It uses only nonces and frameIds, never URL, size, visibility or order (verify asserts this) |
| Enumerate outcome | `ok` → as before (`depth1_https` / `depth1_non_https` / `not_addressable` without a stable locator). `ambiguous` + visible element → counted `notAddressable` (`FRAME_NOT_ADDRESSABLE_HE`). `none` + visible element → counted `notInjectable` (existing message) |
| Resolve outcome | `none` → `frame_missing`; `ambiguous` → `frame_ambiguous`; `ok` → then the existing live probe: depth 1 (`frame_not_depth1`) and live origin === descriptor origin (`frame_origin_mismatch`, R2) |
| Failure copy | `FRAME_CORRELATION_UNAVAILABLE_HE` = «לא ניתן לזהות את המסגרת בדף. נסו לרענן את הדף ולנתח שוב.» Used only when the handshake itself fails (listener injection, sender or read-back error, no crypto). Contains no button reference, so the exact-label rule is unaffected |

Unchanged: R1 first (`specialAuthoringTabGate`, then the enumerate top-origin re-check), R2 live origin in the resolved frame, depth 1 only, stable-attribute exact-one `frameLocator` (no nth-child), frameIds never leave the extension, no values / secrets in messages, A1 / A2 / R3, UNSUPPORTED messages, `final_submit` reserved. Manifest, permissions and `minimum_chrome_version` unchanged. No `webNavigation`, `debugger` or `getFrameId`. No site / hostname / serviceId / fixture branches. STANDARD / Phase 120 untouched.

The preloaded 0×0 case needs no new code: reveal snapshots only count depth-1 frames whose element is visible, so a 0×0 login frame's inputs are excluded before the click and appear as new inputs once the frame is 352×364.

### Notes for Architecture
- The nonce is visible to page scripts inside the target frame (accepted in §4.10.1). A sibling cannot forge `event.source === window.parent`, and top-page scripts cannot guess a 128-bit nonce. A forged claim would still fail the R2 live origin check.
- Every enumerate (including each reveal-readiness poll) now costs one extra bounded wait (150 ms). Poll interval and timeout are unchanged (400 ms / 8 s).
- Verify harness change: `mockChrome` no longer returns canned correlation results. It evaluates the real `frame-correlation.js` in simulated per-frame windows and runs the real sender and read-back functions. `postMessage` is delivered asynchronously with `event.source` set to the posting window.

## Correction evidence

```text
npx tsc -b → exit 0
npm run build → exit 0
node --check extension/background.js / extension/generic/frame-correlation.js → exit 0

node scripts/verifyPhase121IframeSurface.mjs → PASS
  7. static (D-121-29):
     - no "getFrameId" in frame-correlation.js or background.js (comments included); no webNavigation / chrome.debugger
     - listener accepts only source === window.parent at depth 1; idempotent install
     - nonce = crypto.getRandomValues(Uint8Array(16)); no Math.random; postMessage '*' to iframe.contentWindow
     - handshake order: install (allFrames, ISOLATED) → send (frame 0) → bounded wait → read back (allFrames)
     - enumerate + resolve both use the handshake; exact-one rule present; matcher never reads
       rectArea / visible / width / height / src / url / origin / frameLocator
  6b. new exact FRAME_CORRELATION_UNAVAILABLE_HE text; old browser-blaming text absent
  8. all existing harness cases (F-IF-TOP / FRAME / NESTED / NOADDR / SWAP / SELF, declared + reveal,
     first-click-wins, cancel, non-HTTPS, handshake failure → correlationUnavailable) PASS on the real handshake
  8b. D-121-29 handshake:
     - matcher units: one receiver each; frame 0 + stale nonces ignored; duplicate → ambiguous; unreceived → none
     - harness chrome.runtime has no getFrameId; page windows have no chrome API; fresh 32-hex nonce per iframe
     - same-origin login frame preloaded 0×0 + visible cross-origin media frame: opener click → frame becomes
       visible → reveal readiness succeeds via that frame; both elements mapped to their own frames;
       declared readiness resolves the same-origin frame; listener installed once per frame across attempts
     - duplicate nonce (one element reaches two frames) → both not_addressable; resolve → frame_ambiguous, no click
     - missing (no contentWindow) → element unmapped + reported; resolve → frame_missing, no click
     - sibling-forged (sibling page script forwards its nonce) → rejected; mapping stays exact-one
     - depth-2 frame drops a nonce from its own parent; top frame never holds nonces
     - stale nonces from a previous attempt replayed into another frame → ignored; nonces fresh per attempt
  LIVE_ONLY (4): F-IF-FRAME/page is now "handshake across real frame processes (L-1 #iframeLogIn, same origin → A2)";
     F-IF-SHADOW/page, F-IF-NESTED/page, F-IF-TOP/live unchanged

Mutation checks (manual edit → run → revert), each FAILED the verify as expected:
  - listener without the event.source check        → "sibling-forged nonce rejected …"
  - matcher without the per-frame count             → "matcher: nonce at two frames / frame with two nonces → ambiguous"
  - reveal snapshot without the visibility filter   → "preloaded 0×0 frame that becomes visible → reveal readiness succeeds …"
  - "getFrameId" re-added in a frame-correlation.js comment → "D-121-29: no getFrameId in frame-correlation.js"

Regression (all exit 0): verifyPhase116CustomAddIdentity, verifyPhase117ManagedAutofill, verifyPhase117RivhitLiveM8,
  verifyPhase118AssistedMapping, verifyPhase119CapabilityFramework, verifyPhase119ReadinessWaitInputs,
  verifyPhase119VisualMapping, verifyPhase120A24PostRuntimeSafety, verifyPhase120A25PeerObserve,
  verifyPhase120A2ManagedFillDiagnostics, verifyPhase120AdminManagedTestHarness, verifyPhase120ClearManagedMappings,
  verifyPhase120DedicatedAdapterRetirement, verifyPhase120IdentityAuthoring, verifyPhase120LocatorVerification,
  verifyPhase120ManagedActivateGate, verifyPhase120ManagedEligibility, verifyPhase120ManagedVisibility,
  verifyPhase120ShufersalMigration, verifyPhase121IframeSurface, verifyPhase121LoginContract,
  verifyPhase121SpecialDraftAuthoring
```

## Files changed (correction)

| File | Change |
|---|---|
| `extension/generic/frame-correlation.js` | `getFrameId` removed; nonce listener, sender, read-back (`__readFrameCorrelationNonces`); public functions kept |
| `extension/background.js` | `SPECIAL_FRAME_HANDSHAKE_WAIT_MS`, `specialMatchFrameNonces`, `specialFrameNonceHandshake`; `enumerateSpecialAuthoringFrames` + `resolveDeclaredFrame` use it; ambiguous elements counted `notAddressable` |
| `src/assistedMapping/types.ts` | `FRAME_CORRELATION_UNAVAILABLE_HE` new exact text |
| `scripts/verifyPhase121IframeSurface.mjs` | Handshake-simulating harness (real page script in fake windows), §8b cases, D-121-29 static gate, updated LIVE_ONLY text |

## Owner live-validation notes — L-1 updated (Mizrahi-Tefahot; reload the extension first; pattern «מסך צף»)
1. «נתח דף כניסה (משטח נוכחי)» on HOME with the floating screen **closed** → the opener `#logInBtn` is proposed, labelled «בדף הראשי». The message «לא ניתן לזהות את המסגרת בדף…» must **not** appear.
2. «זה הכפתור הנכון» → «פתח את מסך הכניסה» → the floating screen opens in the visible tab, and the Hub reports success (not «המסך לא נפתח»). The login iframe `#iframeLogIn` is preloaded at 0×0 and becomes visible; its fields count as new.
3. Auto-Analyze → field proposals show «בתוך מסגרת: <site origin>». The frame origin is identical to the entry origin (A2), so **no** «אשר מסגרת» prompt is expected, and the fields are filled into the draft directly. The YouTube frame on the page must not receive any field proposal.
4. Field «מיפוי חזותי» → click the username field inside the floating screen → mapping resolves with its frame. Repeat and press «ביטול» → editor released.
5. «שמור טיוטה» → reload editor → location label «בתוך מסגרת: …» shown; opener readiness now points to the mapped field (not `#logInBtn`).
6. Press «פתח את מסך הכניסה» again with a saved draft → success via declared readiness in the frame.
7. Snapshot / ACTIVATE preview complete; STANDARD grid unchanged with the D-121-24 notice.
If a correlation message still appears, record which step and whether a page refresh fixed it.

L-2 (PAGI or CAL, top document) and L-3 (negative / STANDARD regression) steps are unchanged — see the 121.1-IF section below.

---

# Slice 121.1-IF-impl — generic iframe credential surface for SPECIAL authoring (2026-09-27)

**Authorized:** Owner AUTHORIZE 121.1-IF-impl — `manager-phase121.md` Slice 121.1-IF (§IF-0 … §IF-10, AC-121.1-IF-1 … 18) + binding Architect amendments `arch-phase121.md` §4.10 (A1, A2) + open-question answers.  
**STOP:** Architecture review. Do **not** start 121.2+.

## Implementation

| DD item | Implementation |
|---|---|
| §IF-2.1 / 2.2 types | `src/loginContract/types.ts`: optional `FrameDescriptor { frameLocator, frameOrigin }` on `SpecialFieldMapping`, `FlowAction`, `ReadinessCondition` (absent ≡ top document). `final_submit` listed in `RESERVED_FLOW_ACTION_KINDS`. `AutofillFieldMapping` / `autofillProfile` untouched |
| §IF-2.3 parse / serialize | `parse.ts` + new `frameDescriptor.ts`: descriptor must be a deterministic iframe locator + exact HTTPS origin; malformed → rejected (never coerced to top). Absent frame serializes with **no** `frame` key (top-document drafts byte-identical to before) |
| §IF-2.4 completeness gate | `validateSpecialPlan.ts` (shared by snapshot + ACTIVATE): `reservedActionKind` (`final_submit`), `invalidFrame` (malformed descriptor or non-HTTPS / non-exact origin, on actions, readiness and mappings), `mixedFrameInStep` (per-step same-frame), `readinessIsSelf`, `readinessNotDeclaredField` (also catches the pending marker, so it is never valid persisted). `readinessMode` is derived at authoring time (`readinessModeFor`), never stored |
| §IF-2.5 helpers | `specialDraftAuthoring.ts`: `deriveRevealReadiness`, `rederiveRevealReadiness`, `listApprovedFrameOrigins`, `isFrameOriginApproved`, `canPerformAuthoringClick(action, approvedOrigins, allowedOrigin)`, `frameLocationLabelHe`, `listDraftActions`, `normalizeLegacyDraftReadiness` (A1) |
| **A1** legacy readiness normalization | `normalizeLegacyDraftReadiness(draft)` — draft only: for each action whose readiness is opener-self **or** the pending marker **and** whose revealed step already has a first credential mapping → `deriveRevealReadiness`. Otherwise unchanged (validator then reports `readinessIsSelf` / `readinessNotDeclaredField`). Applied on editor load, before snapshot validation and before ACTIVATE (ACTIVATE sends the normalized draft). Never applied to `active` |
| **A2** same-origin frame approval | `isFrameOriginApproved(origin, approvedSet, allowedOrigin)`: depth-1 frame whose origin is **identical** to the resolved §4.7 `allowedOrigin` counts as approved (no «אשר מסגרת» prompt). Descriptor is still written; Ext live exact-one + origin + depth-1 re-check still runs. Any other origin (incl. subdomain / same registrable domain) → explicit «אשר מסגרת» |
| §IF-3.2 frame correlation | NEW `extension/generic/frame-correlation.js`: runs in the ISOLATED world of frame 0; for every `<iframe>` computes the deterministic locator (existing `locator-determinism.js`) and `chrome.runtime.getFrameId(iframe)`. `getFrameId` unavailable → `frameCorrelation: 'unavailable'` → fail-closed. No `webNavigation`, no positional guessing. frameIds never leave the extension |
| §IF-3.3 `background.js` | New SPECIAL block: `enumerateSpecialAuthoringFrames` (allFrames probe → top origin re-check → correlation → classify top / nested / depth-1 non-HTTPS / not addressable / depth-1 HTTPS / not injectable), `resolveDeclaredFrame` (exact-one + depth-1 + live origin; `frame_missing` / `frame_ambiguous` / `frame_not_depth1` / `frame_origin_mismatch` / `frame_correlation_unavailable`), `specialAuthoringTabGate` (R1 = `ensureSpecialAuthoringTab` + origin gate, first in every SPECIAL handler), `specialInjectThenRun`, R3 helpers. Handlers: multi-surface inspect, per-frame Visual arm (first click wins, others `visual_pick_superseded_other_frame`, nested `report_only`), cancel `allFrames: true` on the armed tab, click (reserved kind + `readiness_is_self` rejected before any tab work → gate → activate → resolve frame → click with in-frame origin check → declared or reveal readiness poll, 400 ms / 8 s default) |
| §IF-3.4 inspect | `page-structure-inspect.js` (additive, mode-gated): `shadowCredentialCandidates` bounded count under open shadow roots (never in `inputs[]`), `collectSpecialEligibleCredentialLocators` for reveal snapshots |
| §IF-3.5 visual pick | `visual-target-pick.js` (additive, `mode`-gated): `pick` / `report_only`; `composedPath()` shadow click → `shadow_dom_unsupported` |
| §IF-3.6 permissions | `manifest.json` unchanged (incl. `minimum_chrome_version`) — verified equal to `git show HEAD` |
| §IF-4.1 Hub types | `FramedSurface`, `FrameUnsupportedSummary`, exact DD Hebrew constants (`FRAME_APPROVAL_PROMPT_HE`, `FRAME_APPROVE_LABEL_HE`, `FRAME_REJECT_LABEL_HE`, `SURFACE_NOT_OPENED_HE`, `UNSUPPORTED_*_HE`, `FRAME_NOT_ADDRESSABLE_HE`, `FRAME_ORIGIN_CHANGED_HE`, `FRAME_CORRELATION_UNAVAILABLE_HE`, `VISUAL_TIMEOUT_MAYBE_UNSUPPORTED_FRAME_HE`); origins wrapped in LTR marks |
| §IF-4.2 `currentTabAuthoring.ts` | Phase 120 propose runs **per surface**; `mergeSurfaceFieldProposals`: exactly one confident surface per field → proposal carries its frame; more than one → not confidently mapped. States `ready` / `needs_frame_approval` / `frame_not_addressable`. `unsupportedMessagesHe` turns counts into plain Hebrew. `interpretCurrentTabVisualResponse`, `authoringClickFailureMessageHe` (all readiness failures → «המסך לא נפתח»). Click sends `kind`, `frame`, `readinessMode`, `readiness` |
| §IF-4.3 editor | Frame-approval prompt (`data-panel="frame-approval"`, «אשר מסגרת» / «דחה», session-only approval set ∪ draft origins), location label per action / field («בדף הראשי» / «בתוך מסגרת: …»), held framed fields list (`data-panel="frame-held-fields"`, «קבל מיפוי»), approve buttons disabled for unapproved frames, `commitDraft` re-derives reveal readiness, UNSUPPORTED messages always shown, timeout hint when frames may be unsupported |
| §IF-4.4 routing | `specialAnalyzeRouting.ts`: dedupe key separates not-addressable candidates; they are shown, never approvable |
| §IF-6 D-121-21..27 | Tab reuse / activation / session tab / cancel / continuation / auto-Analyze unchanged in behavior; now routed through `specialAuthoringTabGate` |

Unchanged: R1 (first in every SPECIAL handler), STANDARD (Hub grid, `openPageAndVisualMapping`, `openPageAndInspectLoginStructure`, Managed paths — all `frameIds: [0]`), Phase 120 fill / eligibility files, manifest. No site / hostname / serviceId / fixture branches. No 121.2 work.

### Notes for Architecture
- **Verify assertions superseded by §IF-0** (intentional, not weakened):
  - `verifyPhase121SpecialDraftAuthoring.mjs`: D-121-25/27 "SPECIAL frame 0 / no allFrames" asserts replaced by §IF-0 asserts (enumerate after R1; Visual injects per frameId, no `allFrames`; cancel `allFrames: true` on `armedTabId`). Handler slices read through `viaGate` because origin/tab logic moved into the shared gate. Continuation gate string, exact-label resolver (`SPECIAL_FRAME_BUTTON_HE` + `FRAME_*_LABEL_HE`), and `runSpecialAnalyze('after_continue', action)` updated to the new code.
  - `verifyPhase117ManagedAutofill.mjs`: the "Managed path must not use allFrames" slice ran from `runManagedAutofillOnTab` to `openPageAndManagedAutofill`, i.e. across STANDARD inspect/Visual and all SPECIAL handlers. Narrowed to the `runManagedAutofillOnTab` body; the Managed runner itself is unchanged.
  - `verifyPhase119ReadinessWaitInputs.mjs` T-R5: (a) Admin inspect slice narrowed the same way to the STANDARD inspect function; (b) the `shadowRoot` ban on `page-structure-inspect.js` now excludes only `countShadowCredentialCandidates` (DD §IF-3.4 requires that walk); a new assert keeps that helper free of iframe / allFrames / modal / multi-step tokens.
  - `verifyPhase121LoginContract.mjs`: SPECIAL→SPECIAL fixture now keeps opener readiness on the changed field (`#user-v2`), because R3 rejects readiness that is not a declared field.
- Comment in the SPECIAL click handler reworded ("vault secrets" instead of "credentials") — it fell inside the Phase 118 inspect-path text slice.
- `fill-executor.js` / `validated-autofill.js` show working-tree edits from earlier phases; this slice does not touch them (verify §10 token-checks them; `managed-target-eligibility.js`, `validatedProfile`, `locator-determinism.js` have an empty `git diff`).

## Evidence

```text
npx tsc -b → exit 0
npm run build → exit 0
node --check extension/background.js / extension/generic/frame-correlation.js → exit 0

node scripts/verifyPhase121IframeSurface.mjs → PASS (5 consecutive runs, exit 0)
  1. parse / snapshot / ACTIVATE (descriptor round-trip, absent frame → no key, malformed rejected)
  2. validator matrix (invalid descriptor, non-HTTPS, per-step same-frame, pending marker / readinessMode not persistable)
  3. final_submit reserved: parse / validate / propose / click
  4. click gate + A2 (identical origin approved; subdomain / registrable-domain / other origin need «אשר מסגרת»)
  5. R3 + A1 (opener-self / pending + mapped step → derived; no mapping → left, validator reports; active untouched)
  6. per-surface merge (single confident surface carries frame; multi-surface not confident; states)
  6b. plain-Hebrew messages (exact DD strings) · 6c. editor wiring + exact-label rule
  7. Ext static (R1 first, correlation file, no webNavigation, frameIds not returned)
  8. mock-chrome behavioral harness: R1-first, final_submit, F-IF-TOP / FRAME / NESTED / NOADDR / SWAP / SELF,
     declared + reveal readiness, first-click-wins, cancel, non-HTTPS, correlation unavailable, shadow count
  9. genericity grep gate · 10. STANDARD freeze (manifest = HEAD, STANDARD handlers frame 0, Phase 120 files untouched)
  LIVE_ONLY (4, not reported as PASS — Owner L-1 / L-2 / L-3):
  - F-IF-FRAME/page: getFrameId(<iframe>) + exact-one iframe locator on a real cross-origin frame (L-1)
  - F-IF-SHADOW/page: open-shadow count + composedPath() shadow click in a live page
  - F-IF-NESTED/page: report_only listener in a real frame-in-frame
  - F-IF-TOP/live: top-document floating screen (L-2): no frame prompt, no frame keys

Regression §IF-8.2 (all exit 0):
  verifyPhase121LoginContract, verifyPhase121SpecialDraftAuthoring,
  verifyPhase120A24PostRuntimeSafety, verifyPhase120A25PeerObserve, verifyPhase120A2ManagedFillDiagnostics,
  verifyPhase120AdminManagedTestHarness, verifyPhase120ClearManagedMappings,
  verifyPhase120DedicatedAdapterRetirement, verifyPhase120IdentityAuthoring,
  verifyPhase120LocatorVerification, verifyPhase120ManagedActivateGate, verifyPhase120ManagedEligibility,
  verifyPhase120ManagedVisibility, verifyPhase120ShufersalMigration,
  verifyPhase119CapabilityFramework, verifyPhase119ReadinessWaitInputs, verifyPhase119VisualMapping,
  verifyPhase118AssistedMapping, verifyPhase117ManagedAutofill, verifyPhase117RivhitLiveM8,
  verifyPhase116CustomAddIdentity
```

## Files changed (121.1-IF)

| File | Change |
|---|---|
| `src/loginContract/frameDescriptor.ts` | NEW — descriptor parse / validate |
| `src/loginContract/types.ts`, `parse.ts`, `validateSpecialPlan.ts`, `specialDraftAuthoring.ts`, `index.ts` | Frame descriptor, reserved `final_submit`, R3 codes, A1 / A2 helpers |
| `extension/generic/frame-correlation.js` | NEW — ISOLATED top-frame iframe ↔ frameId correlation |
| `extension/background.js` | SPECIAL frame block + 4 SPECIAL handlers rewritten on the shared gate; STANDARD untouched |
| `extension/generic/page-structure-inspect.js`, `visual-target-pick.js` | Additive, mode-gated (shadow count, reveal locators, pick / report_only) |
| `src/assistedMapping/types.ts`, `currentTabAuthoring.ts`, `specialAnalyzeRouting.ts`, `index.ts` | Framed surfaces, per-surface merge, messages, click readiness |
| `src/admin/SpecialLoginDraftEditor.tsx` | Frame approval, location labels, held framed fields, R3 / A1 wiring |
| `scripts/verifyPhase121IframeSurface.mjs` | NEW — §IF-8.1 + A1 / A2 |
| `scripts/verifyPhase121SpecialDraftAuthoring.mjs`, `verifyPhase121LoginContract.mjs`, `verifyPhase117ManagedAutofill.mjs`, `verifyPhase119ReadinessWaitInputs.mjs` | Superseded / narrowed assertions (see Notes) |

## Owner live-validation notes (DD §IF-10; reload the extension first; pattern «מסך צף»)

### L-1 Mizrahi-Tefahot (credential fields in a depth-1 iframe)
1. «נתח דף כניסה (משטח נוכחי)» on HOME → the opener `#logInBtn` is proposed, labelled «בדף הראשי».
2. «זה הכפתור הנכון» → «פתח את מסך הכניסה» → the floating screen opens in the visible tab; success is reported only after a new credential input appears. If it did not open, the message is «המסך לא נפתח».
3. Auto-Analyze → field proposals show «בתוך מסגרת: <origin>» and the frame-approval prompt names that exact origin. Nothing is in the draft yet.
4. «דחה» → proposals discarded, draft unchanged. Run Analyze again → «אשר מסגרת» → press «קבל מיפוי» on each field.
5. Field «מיפוי חזותי» → click the username field inside the floating screen → mapping resolves with its frame. Repeat and press «ביטול» → editor released.
6. «שמור טיוטה» → reload editor → location labels shown, no new prompt for the same origin; opener readiness now points to the mapped field (not `#logInBtn`).
7. Snapshot / ACTIVATE preview complete; STANDARD grid unchanged with the D-121-24 notice.
Note: if the iframe origin is identical to the entry origin (A2), step 3 shows no prompt — record which case occurred.

### L-2 Bank PAGI **or** CAL (credential fields in the top document)
1. Same flow → opener approved → floating screen opens → readiness success.
2. Proposals show «בדף הראשי»; **no** frame-approval prompt; saved draft has **no** `frame` keys.
3. Visual field pick works; save / reload; opener readiness = mapped field.
4. Record which site was used and confirm in DevTools (top frame) that the password input is in the top document while the screen is open.

### L-3 Negative / regression
- Close the floating screen, try field Visual → timeout message (plus the unsupported-frame hint only if relevant); editor released.
- A STANDARD service: Managed Autofill Analyze / Visual / test harness behave exactly as before.

---

# Slice 121.1 D-121-27 CORRECTION — deterministic, visible SPECIAL authoring tab (§4.6.1) (2026-09-27)

**Trigger:** Owner live (FLOATING_SCREEN fixture, after D-121-26) — «פתח את מסך הכניסה» reported success but the floating screen did not open in the tab the Owner was viewing; field «מיפוי חזותי» waited forever while clicks in the visible tab did nothing.  
**Cause (code):** Hub never sent `tabId`; `ensureSpecialAuthoringTab` reused the **first** same-origin tab in `chrome.tabs.query({})` order and never activated it. With several fixture tabs open, click / auto-Analyze / Visual arm could all run in a hidden tab.  
**Authorized:** D-121-27 / §4.6.1 only. **STOP** for Architecture re-review (covers D-121-22..27).

## Implementation

| Rule (§4.6.1) | Implementation |
|---|---|
| Session tab — Ext side | `withAuthoringTab(result, tabId, ensured, activated)` tags every SPECIAL inspect / visual / click response (success **and** post-origin-gate failures) with `authoringTabId` (+ `authoringTabReused/Opened/Activated`). Cancel returns `authoringTabId`. Tabs that fail the origin gate are never returned |
| Session tab — Hub side | `currentTabAuthoring.ts`: `AuthoringTabSession { authoringTabId }` input on `analyzeSpecialCurrentSurface` / `startCurrentTabVisualMapping` / `cancelCurrentTabVisualMapping` / `performApprovedAuthoringClick`; sent as `tabId`; results carry `authoringTabId`. Editor: `sessionTabRef {rowId, tabId}`, `sessionTabId()` returns it only for the current `row.id`; `rememberSessionTab(result)` after analyze / visual / click; reset on `row.id` change and on unmount (after the unmount cancel has used it) |
| Ext honors `message.tabId` | Existing path in `ensureSpecialAuthoringTab`: used while the tab exists and matches `allowedOrigin` (`sessionTab: true`); otherwise fallback |
| Fallback | `pickMostRecentlyAccessedTab` — highest `tab.lastAccessed` among usable same-origin tabs (not query order). None → open §4.7 `authoringUrl` (unchanged, origin-checked) |
| Visibility | `activateSpecialAuthoringTab(tabId)` → `chrome.tabs.update({active:true})` + `chrome.windows.update({focused:true})`, **after** the origin gate and **before** Visual inject/arm (field + opener/transition share the path) and **before** the continuation click. Inspect-only Analyze does not activate. Best-effort: a failed activation does not change the target tab; reported as `authoringTabActivated:false` |
| Cancel / timeout (D-121-25) | Hub «ביטול», Hub safety timer and unmount cancel all send the session `tabId`; Ext disarms in `message.tabId` (falls back to the armed-tab record if none). Origin fail-closed, frame 0 unchanged |
| Hub copy | `siteTabActive`: «פועל בלשונית האתר שנפתחה.» — shown in the armed Visual panel (`data-status="special-site-tab"`) and as the status at continuation start (replaces the stale message; auto-Analyze copy then follows as before). No button reference → exact-label rule unaffected (sweep PASS) |

Unchanged: origin fail-closed, no Login Entry reopen, `frameIds: [0]`, D-121-22..26 behavior, STANDARD (Hub grid, `openPageAndVisualMapping`, Managed paths). No site / hostname / serviceId branches; no iframe work.

### Notes for Architecture
- The D-121-25 verify assertion "continuation start clears success" now accepts either `setSuccess(null)` or the new site-tab status (the stale message is still replaced at start).
- `analyzeCurrentTabForMapping` (exported, not used by the SPECIAL editor) is unchanged and sends no `tabId`.

## Correction evidence

```text
npx tsc -b → exit 0
node --check extension/background.js → exit 0

node scripts/verifyPhase121SpecialDraftAuthoring.mjs
→ PASS (D-121-21 … D-121-27). D-121-27 section — behavioral (extracted Ext helpers + mocked chrome):
  - valid message.tabId honored even when not most recent (sessionTab: true)
  - session tab gone → most recently accessed same-origin tab
  - session tab on foreign origin → fallback, never the foreign tab
  - no session tab: lastAccessed wins over first query result; no new tab opened
  - no same-origin tab → opens §4.7 authoringUrl; missing origin fail-closed
  - activate → tabs.update active:true + windows.update focused:true on the tab's window
  static:
  - inspect / visual / click responses via withAuthoringTab; cancel returns authoringTabId
  - activation after origin gate and before armVisualTargetPick / before .click(); inspect never activates
  - cancel targets message.tabId; origin fail-closed; frameIds [0], no allFrames (inspect/visual/cancel/click)
  - Hub sends tabId on all 4 SPECIAL messages; editor passes sessionTabId() to analyze / visual / click,
    stores authoringTabId from all 3; cancel (button / timer / unmount) uses the session tab
  - session scoped to row.id; reset on row change and unmount
  - site-tab status copy; STANDARD editor / STANDARD Visual untouched; no hostname / fixture branch
  - all D-121-22 … D-121-26 checks still PASS

node scripts/verifyPhase121LoginContract.mjs → PASS

STANDARD regressions (exit 0): verifyPhase120LocatorVerification, verifyPhase120ManagedActivateGate,
  verifyPhase120ManagedEligibility, verifyPhase120ManagedVisibility,
  verifyPhase120A2ManagedFillDiagnostics, verifyPhase120A24PostRuntimeSafety,
  verifyPhase120A25PeerObserve, verifyPhase120IdentityAuthoring,
  verifyPhase120AdminManagedTestHarness, verifyPhase120ClearManagedMappings,
  verifyPhase119VisualMapping, verifyPhase117ManagedAutofill
```

## Owner validation notes (HOME ENTRY + FLOATING_SCREEN, Mizrahi-Tefahot; reload the extension first)
1. Open 2–3 fixture tabs. In the Hub, press «נתח דף כניסה» → the tab you used last is analyzed (it stays in the background). From now on this tab is the session tab.
2. Press «זה הכפתור הנכון», then «פתח את מסך הכניסה» → the Hub shows «פועל בלשונית האתר שנפתחה.», **the same tab comes to the front** and the floating screen opens there; auto-Analyze runs on that tab.
3. Return to the Hub, press «מיפוי חזותי» next to «משתמש» → the same tab comes to the front; clicking the field there resolves the pick. «ביטול» or the timeout disarms the same tab.
4. Close the session tab and press «נתח דף כניסה» → the most recently used remaining fixture tab is picked (or the entry URL opens if none are left).
5. Switching to another service row in Admin starts a fresh session (no carry-over tab).
If the field pick still does not resolve with the tab in front, run the iframe diagnostic (right-click in the field → «הצג מקור מסגרת»).

---

# Slice 121.1 D-121-26 CORRECTION — pending action vs draft membership (§5.2) (2026-09-27)

**Trigger:** D-121-22 regression — manual Analyze skipped any candidate whose locator was already in the draft (and only fell back when no pending action existed), and every proposal was upserted into the draft on propose. Result: the top-ranked button for the current surface could not be shown again, and unapproved proposals accumulated in the draft.  
**Authorized:** D-121-26 / §5.2 only. Routing/ranking, click gate, origin fail-closed, D-121-21/23/24/25 and STANDARD unchanged. No iframe, no 121.2. **STOP** for Architecture re-review (covers D-121-22..26).

## Implementation

| Rule (§5.2) | Implementation |
|---|---|
| Manual Analyze → top proposal | `selectPendingForManualAnalyze(draft, proposals)` (pure): top-ranked proposal; if its locator is in the draft, the **existing draft action** is returned with its approval state (panel shows «אושר לפתיחת המסך: כן/לא»). Otherwise the proposal, unapproved, re-id'd on actionId collision. Replaces any previous pending (old `!pendingAction` guard removed) |
| after_continue may skip | `selectPendingAfterContinue(draft, proposals, clicked)` (pure): skips the just-clicked locator and draft actions approved for continuation; first remaining one. None → pending left as is. `continueAfterApproval` passes `pendingAction` as `clicked` |
| No draft write on propose | `runSpecialAnalyze` no longer calls `upsertPreambleAction`; only field mappings are written to the in-memory draft (unchanged) |
| Enter draft only on approval | «זה הכפתור הנכון» and «אשר לשימוש בהפעלה» keep `upsertPreambleAction(draft, approved)` → a non-draft action is added (approved) |
| «דחה» | `removeDraftAction(draft, pendingAction)` (by actionId or locator; preamble + step exit transitions) and `setPendingAction(null)` |
| Visual (opener / transition) | `visualPickAction` → `selectPendingForManualAnalyze(draft, [candidate])`; no draft write |
| Copy | Messages "with action" now depend on "selected action is not yet approved". New `actionAlreadyApproved`: «הכפתור שנמצא כבר אושר. כדי לפתוח את המסך לחצו «פתח את מסך הכניסה».» — used when manual Analyze / Visual lands on an already-approved draft action. Exact-label rule holds (sweep PASS) |

`pickNewActionCandidate` remains exported (pure, unit-tested) but is no longer used by the editor.

### Note for Architecture
Drafts saved before this fix may already contain unapproved actions written on propose. No auto-cleanup was added (not authorized); Admin can remove each one by bringing it up as pending and pressing «דחה».

## Correction evidence

```text
npx tsc -b → exit 0

node scripts/verifyPhase121SpecialDraftAuthoring.mjs
→ PASS (D-121-22 + D-121-23 + D-121-24 + D-121-25 + D-121-26):
  - manual Analyze: top candidate already in draft → pending = existing draft action (id + approval kept)
  - manual: fresh top candidate unapproved, colliding actionId re-ided; select does not modify draft
  - after_continue skips the clicked action and approved draft actions; nothing new → null
  - propose leaves draft empty; «זה הכפתור הנכון» adds; «אשר לשימוש בהפעלה» adds (approved)
  - «דחה» removes from preamble / exit transition (pure) and clears pending; no-op when not in draft
  - Visual opener/transition uses the manual rule; no draft write
  - Analyze no longer references upsertPreambleAction / pickNewActionCandidate / listDraftActions
  - D-121-22 assertions updated to the new selection helpers; all D-121-22..25 checks still PASS

node scripts/verifyPhase121LoginContract.mjs → PASS

STANDARD regressions (exit 0): verifyPhase120LocatorVerification, verifyPhase120ManagedActivateGate,
  verifyPhase120ManagedEligibility, verifyPhase120ManagedVisibility,
  verifyPhase120A2ManagedFillDiagnostics, verifyPhase120A24PostRuntimeSafety,
  verifyPhase120A25PeerObserve, verifyPhase120IdentityAuthoring,
  verifyPhase120AdminManagedTestHarness, verifyPhase120ClearManagedMappings,
  verifyPhase119VisualMapping, verifyPhase117ManagedAutofill
```

## Owner validation notes (HOME ENTRY + FLOATING_SCREEN, Mizrahi-Tefahot)
1. On the home page, press «נתח דף כניסה» → the panel shows `#logInBtn` (or the top-ranked button), approval «לא». The draft does not change until approval.
2. Press «זה הכפתור הנכון» → the action enters the draft (approved). Press «נתח דף כניסה» again → the **same** button is shown with «אושר לפתיחת המסך: כן» and the message «הכפתור שנמצא כבר אושר…».
3. Press «פתח את מסך הכניסה» → the floating screen opens, auto-Analyze runs, and the clicked button is **not** proposed again (fields identified, or another button if one exists).
4. Press «דחה» on a proposed button → the panel closes; after «שמור טיוטה» the button is not in the draft.
5. «מיפוי חזותי — פותח» on an already-approved button → it shows that action as already approved; on a new element → unapproved, not in the draft until «זה הכפתור הנכון».

---

# Slice 121.1 D-121-25 CORRECTION — SPECIAL editor Visual Mapping feedback (§4.9) (2026-09-27)

**Trigger:** Owner live (FLOATING_SCREEN fixture) — «מיפוי חזותי» for «משתמש» in «אופי הכניסה» disabled every button with no indicator, left the previous green message, and never released when the pick did not resolve.  
**Authorized:** D-121-25 / §4.9 only — UI/UX. No iframe support. **STOP** for Architecture re-review (covers D-121-22 + D-121-23 + D-121-24 + D-121-25).

## Implementation

| Rule (§4.9) | Implementation |
|---|---|
| Indicator on pressed control | Field button → «ממתין ללחיצה על השדה…»; «מיפוי חזותי — פותח» / «מיפוי חזותי — מעבר» → «ממתין ללחיצה על הכפתור…» (only the pressed one; `aria-busy`). Labels in `SPECIAL_VISUAL_BUTTON_HE` |
| Status line | `role="status"` while armed: «ממתין ללחיצה על השדה בלשונית האתר: **משתמש**. לביטול לחצו «ביטול».» (action variant names the pressed button) |
| Clear stale messages | `runArmedVisualPick` clears success + error before arming. Analyze and continuation already clear both at start (D-121-22) — verified |
| Bounded timeout (60s) | Page-side: `armVisualTargetPick` optional `timeoutMs` → `disarm('visual_pick_timeout')` removes the listener and resolves. Hub sends `pickTimeoutMs: SPECIAL_VISUAL_PICK_TIMEOUT_MS` (60 000); Ext caps at 120 000. Hub safety timer (60s + 5s grace) disarms + releases if the Ext never answers (e.g. tab closed) |
| Timeout message | Per control, quoting its exact label: «לא נקלטה לחיצה בזמן, והמיפוי החזותי בוטל. כדי לנסות שוב לחצו «מיפוי חזותי» ליד השדה.» (opener / transition variants quote «מיפוי חזותי — פותח» / «מיפוי חזותי — מעבר») |
| «ביטול» | Rendered only while armed, never disabled. Invalidates the pending pick (token), sends `ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL` → Ext checks origin (fail-closed) → frame 0 `__disarmVisualTargetPick('visual_pick_cancelled')` → listener removed. Editor released immediately; message «המיפוי החזותי בוטל. לא נשמר מיפוי.» |
| No mapping on cancel/timeout | Late Ext response after cancel/timeout is ignored by token check; draft/pending written only when a locator is returned |
| Unmount | If still armed when the editor unmounts, cancel is sent |

### Deviation from the example copy (for Architecture)
The example timeout copy «…נסו שוב או לחצו «ביטול».» would point to a button that no longer exists: after the timeout the editor is released and «ביטול» is only shown while armed. To keep the exact-label rule true, the timeout message instead quotes the Visual button to press again. «ביטול» is quoted in the while-armed status line, where it is visible.

### Shared pick script (`visual-target-pick.js`) — additive only
- `timeoutMs` is opt-in; STANDARD (`openPageAndVisualMapping`) does not pass it → unbounded exactly as before.
- `global.__disarmVisualTargetPick` is registered per arm and cleared on finish; STANDARD never calls it.
- A new arm supersedes a still-armed one (`visual_pick_superseded`) so listeners cannot stack in one page.
- Identification, candidate building, exact-one + determinism, Managed eligibility, origin checks: untouched.

## Correction evidence

```text
npx tsc -b → exit 0

node scripts/verifyPhase121SpecialDraftAuthoring.mjs
→ PASS (includes D-121-22 + D-121-23 + D-121-24 + D-121-25):
  - each Visual button (field / opener / transition) shows waiting text only when it is the armed one
  - role="status" line names the awaited field / button
  - Visual start clears success + error; Analyze and continuation starts clear both
  - 60s bound sent by Hub, applied page-side (Ext caps); page timeout removes listener + clears timer
  - Hub safety timer disarms page pick, releases editor, shows timeout message
  - «ביטול» literal, rendered only while armed, not disabled; cancel invalidates token, disarms page
    pick (Ext: origin fail-closed, frame 0), releases editor, writes no draft / pending / registry
  - stale response after cancel/timeout ignored; mapping written only on success
  - exact-label rule: every «…» in editor copy = a visible button label (literal or SPECIAL_VISUAL_BUTTON_HE)
  - SPECIAL Visual + cancel frame 0 only, no allFrames; pick semantics unchanged; bound opt-in
  - STANDARD Visual (Ext + Hub + grid) untouched; no fixture / hostname branches
  - all D-121-22 / D-121-23 / D-121-24 checks still PASS

node scripts/verifyPhase121LoginContract.mjs → PASS

STANDARD regressions (exit 0): verifyPhase120LocatorVerification, verifyPhase120ManagedActivateGate,
  verifyPhase120ManagedEligibility, verifyPhase120ManagedVisibility,
  verifyPhase120A2ManagedFillDiagnostics, verifyPhase120A24PostRuntimeSafety,
  verifyPhase120A25PeerObserve, verifyPhase120IdentityAuthoring,
  verifyPhase120AdminManagedTestHarness, verifyPhase120ClearManagedMappings,
  verifyPhase119VisualMapping (shares visual-target-pick.js), verifyPhase117ManagedAutofill

Pre-existing (unchanged cause, see D-121-24 section): verifyPhase118AssistedMapping (121.1 comment
wording), verifyPhase107Admin (ApprovalQueue.tsx, predates Phase 121).

IDE diagnostics on touched files → none
```

## Finding for Architecture (pre-existing, not changed — pick semantics frozen by §4.9)
`isIdentifiableControl` in `visual-target-pick.js` accepts only `input` / `textarea`. «מיפוי חזותי — פותח» / «מיפוי חזותי — מעבר» therefore cannot succeed on a `<button>` / link: clicking one resolves `unsupported_target` («האלמנט שנבחר אינו נתמך למיפוי…»). With D-121-25 the Admin now sees that message instead of a lock, but action Visual needs its own identification rule to be useful. Needs an architecture decision.

## Files changed (correction)

| File | Change |
|---|---|
| `src/admin/SpecialLoginDraftEditor.tsx` | Armed-pick state, indicator, status line, «ביטול», timeout/cancel copy, `runArmedVisualPick` |
| `src/assistedMapping/currentTabAuthoring.ts` | Send `pickTimeoutMs`; pass through timeout/cancel reasons; `cancelCurrentTabVisualMapping` |
| `src/assistedMapping/types.ts`, `index.ts` | Cancel message const, 60s bound, 5s Hub grace |
| `extension/background.js` | Bound forwarded to SPECIAL arm; armed-tab tracking; `ADMIN_CURRENT_TAB_VISUAL_MAPPING_CANCEL` handler |
| `extension/generic/visual-target-pick.js` | Opt-in `timeoutMs`; disarm hook; supersede |
| `scripts/verifyPhase121SpecialDraftAuthoring.mjs` | D-121-25 assertions; label resolver covers `SPECIAL_VISUAL_BUTTON_HE` |
| `team-Yuri/dev-phase121.md` | This evidence |

## Owner-validation notes (HOME ENTRY + FLOATING_SCREEN; reload the extension first)

| Step | Expect |
|---|---|
| Any earlier green/red message showing → press «מיפוי חזותי» for «משתמש» | Old message disappears; that button reads «ממתין ללחיצה על השדה…»; status line names «משתמש»; «ביטול» visible; other buttons disabled |
| Click the field in the site tab | Either mapping written («מיפוי השדה עודכן בטיוטה…») or a clear failure message — editor released either way |
| If the click does nothing (e.g. field inside an iframe) → press «ביטול» | Editor released at once; «המיפוי החזותי בוטל. לא נשמר מיפוי.»; field row unchanged; clicking the page afterwards does nothing |
| Press «מיפוי חזותי» again and wait ~60s without clicking | Editor released; «לא נקלטה לחיצה בזמן… לחצו «מיפוי חזותי» ליד השדה.» |
| «מיפוי חזותי — פותח» → click the site's login button | Indicator «ממתין ללחיצה על הכפתור…»; expect «האלמנט שנבחר אינו נתמך למיפוי…» (pre-existing input-only rule, see finding) — editor released |

## Developer report (Architecture re-review)

| Field | Value |
|---|---|
| Slice | **121.1 D-121-25 CORRECTION (§4.9, UI/UX)** |
| Status | **COMPLETE** — STOP for Architecture re-review (covers D-121-22 + D-121-23 + D-121-24 + D-121-25) |
| iframe support | **Not added** (frame 0 only) |
| Findings | Action Visual input-only identification (above); timeout copy deviation (above); Phase 118 verify comment false positive (D-121-24 section) |
| 121.2+ | **NOT AUTHORIZED / NOT STARTED** |

---

# Slice 121.1 D-121-24 CORRECTION — Managed Autofill grid guidance when pattern is SPECIAL (§4.8) (2026-09-27)

**Trigger:** Owner expected to continue floating-screen field mapping in «מילוי אוטומטי מנוהל». That grid's Analyze / Visual reopen the Login Entry (floating screen closed) and persist to `autofillProfile` (D-121-13 forbids SPECIAL dual-write). Both grids always render with no guidance.  
**Authorized:** D-121-24 / §4.8 only — UI guidance; no mapping / persist / ACTIVATE logic change. **STOP** for Architecture re-review (covers D-121-22 + D-121-23 + D-121-24).

## Implementation

| Rule (§4.8) | Implementation |
|---|---|
| Trigger = live «אופי הכניסה» selection is SPECIAL (before Save Draft) | `SpecialLoginDraftEditor` reports `pattern` via new optional `onPatternSelected` (effect on selection change / mount). `RegistryAdmin` holds `{ rowId, pattern }` in local state (not persisted), keyed by row so a previous row's selection never carries over; `specialPatternSelected = isSpecialLoginPattern(pattern)` |
| Guidance | `AutofillProfileEditor` renders `SPECIAL_PATTERN_GRID_NOTICE_HE` under the grid hint only when `specialPatternSelected`: «בשירות עם אופי כניסה מיוחד (כמו מסך צף), מיפוי שדות הכניסה נעשה בגריד «אופי הכניסה».» — «אופי הכניסה» matches the exact visible pattern-selector label in the SPECIAL grid |
| Disabled | `!specialPatternSelected` appended to the existing `canAnalyze` and `canVisualMap` gates → «נתח דף כניסה» and every field row's «מיפוי חזותי» disabled; click handlers already early-return on the same gates |
| Unchanged | Save / approve / clear / unsupported / managed test / probe gates; STANDARD Analyze/Visual engines; `autofillProfile` persist / validate / ACTIVATE; SPECIAL editor behavior; all `data-action` attributes |
| STANDARD | Prop defaults to `false` → grid renders and behaves exactly as before |
| Forbidden (not done) | Grid still rendered; no migration between grids; no SPECIAL write to `autofillProfile`; no site / hostname / serviceId / Mizrahi branches; no 121.2 |

## Correction evidence

```text
npx tsc -b → exit 0

node scripts/verifyPhase121SpecialDraftAuthoring.mjs
→ PASS (includes D-121-22 + D-121-23 + D-121-24):
  - trigger true for FLOATING_SCREEN / MULTI_STEP / FLOATING_SCREEN_MULTI_STEP, false for STANDARD
  - SPECIAL editor reports live pattern; RegistryAdmin derives flag, keyed by row, passes it down;
    selection state read only for the flag (no persist path)
  - Managed grid: default false; flag appears only in prop / default / canAnalyze / canVisualMap / notice
  - analyze + visual-mapping buttons use those gates; handlers guarded; canSave untouched
  - Managed data-action attributes retained (analyze, visual-mapping, save, approve, clear, managed-test)
  - notice conditional; quoted «אופי הכניסה» = exact visible label; no jargon in notice text
  - grid still rendered; Managed grid never references loginFlowPlan; no fixture-name branches
  - all D-121-22 / D-121-23 checks still PASS

node scripts/verifyPhase121LoginContract.mjs → PASS

STANDARD regressions (exit 0):
  verifyPhase120LocatorVerification, verifyPhase120ManagedActivateGate,
  verifyPhase120ManagedEligibility, verifyPhase120ManagedVisibility,
  verifyPhase120A2ManagedFillDiagnostics, verifyPhase120A24PostRuntimeSafety,
  verifyPhase120A25PeerObserve, verifyPhase120IdentityAuthoring,
  verifyPhase120AdminManagedTestHarness, verifyPhase120ClearManagedMappings,
  verifyPhase119VisualMapping, verifyPhase117ManagedAutofill

IDE diagnostics on touched files → none (repo has no ESLint config)
```

### Pre-existing failures found while sweeping older scripts (not caused by D-121-24; not fixed — outside scope)

| Script | Failure | Cause |
|---|---|---|
| `verifyPhase118AssistedMapping.mjs` | «inspect path must not mention credentials payload» | Its `background.js` slice (`openPageAndInspectLoginStructure` → `openPageAndManagedAutofill`) now includes the 121.1 authoring-click handler, whose doc comment reads «No fill / submit / credentials.». Committed `HEAD` has no hit. False positive from earlier 121.1 work; fix = reword that comment (one word in `extension/background.js`) — needs authorization |
| `verifyPhase107Admin.mjs` | «Approval queue must run Login Discovery on promote» | Checks `src/admin/ApprovalQueue.tsx`, which is unmodified in the working tree — predates Phase 121 |

## Files changed (correction)

| File | Change |
|---|---|
| `src/admin/AutofillProfileEditor.tsx` | Optional `specialPatternSelected` prop; notice; appended to `canAnalyze` / `canVisualMap` |
| `src/admin/SpecialLoginDraftEditor.tsx` | Optional `onPatternSelected` callback (reports live selection) |
| `src/admin/RegistryAdmin.tsx` | Row-keyed live selection state; wires callback + flag |
| `scripts/verifyPhase121SpecialDraftAuthoring.mjs` | D-121-24 assertions |
| `team-Yuri/dev-phase121.md` | This evidence |

## Owner-validation notes

| Step | Expect |
|---|---|
| Select a global service; «אופי הכניסה» = רגיל | «מילוי אוטומטי מנוהל» exactly as before: no notice; «נתח דף כניסה» / «מיפוי חזותי» enabled (when Login Entry is set) |
| Switch to «מסך צף» (do not save) | Notice appears in «מילוי אוטומטי מנוהל»; «נתח דף כניסה» and every «מיפוי חזותי» there become disabled; other controls unchanged |
| Switch back to «רגיל» | Notice disappears; buttons re-enabled |
| Service with a saved SPECIAL draft, reopened | Notice + disabled on load |
| Switch to another service | Its own pattern drives the grid (no carry-over) |
| Reload without Save Draft | Selection not persisted — reverts to saved pattern |

## Developer report (Architecture re-review)

| Field | Value |
|---|---|
| Slice | **121.1 D-121-24 CORRECTION (§4.8, UI only)** |
| Status | **COMPLETE** — STOP for Architecture re-review (covers D-121-22 + D-121-23 + D-121-24) |
| Logic change | None to mapping / persist / ACTIVATE; only the two Managed Analyze/Visual enable gates |
| Findings for Architecture | Phase 118 verify false positive from 121.1 comment wording (see table) |
| 121.2+ | **NOT AUTHORIZED / NOT STARTED** |

---

# Slice 121.1 D-121-23 CORRECTION — approval panel labels (text-only) (2026-09-27)

**Trigger:** Owner live — after D-121-22, Analyze said «…ולחצו «המשך»…», but no button is labeled «המשך»; approval panel labels unclear.  
**Authorized:** D-121-23 only — text-only, no behavior change. **STOP** for Architecture re-review (covers D-121-22 + D-121-23).

## Label changes (`SpecialLoginDraftEditor.tsx` approval panel; `data-action` unchanged)

| Element | `data-action` | Before | After |
|---|---|---|---|
| Panel title | — | אישור פעולה (המשך כתיבה) | נמצא כפתור באתר |
| Approve for continuation | `approve-authoring-continuation` | אשר להמשך כתיבה | זה הכפתור הנכון |
| Continuation click | `authoring-continue-click` | המשך (לחיצה מאושרת) | פתח את מסך הכניסה |
| Approve for runtime | `approve-runtime` | אשר לריצה (ACTIVATE) | אשר לשימוש בהפעלה |
| Reject | `reject-action` | דחה | דחה (unchanged) |
| Status line | — | אישור המשך: כן/לא · אישור ריצה: כן/לא | אושר לפתיחת המסך: כן/לא · אושר לשימוש בהפעלה: כן/לא |

## Exact-label rule — `SPECIAL_EDITOR_COPY_HE`

Every message that tells the Admin to press a button quotes that button's exact visible label:

| Key | New copy |
|---|---|
| `actionFound` | נמצא כפתור שפותח את מסך הכניסה. לחצו «זה הכפתור הנכון» ואז «פתח את מסך הכניסה». |
| `continueNeedsApproval` | לחצו «זה הכפתור הנכון» לפני «פתח את מסך הכניסה». |
| `visualActionFound` | הכפתור זוהה במיפוי החזותי. לחצו «זה הכפתור הנכון» ואז «פתח את מסך הכניסה». |
| `fieldsIdentifiedWithAction` | שדות הכניסה זוהו, ונמצא גם כפתור באתר. אם זה הכפתור שממשיך את הכניסה, לחצו «זה הכפתור הנכון». לשמירה לחצו «שמור טיוטה». |
| `autoAnalyzeSuccessWithAction` | שדות הכניסה זוהו. נמצא גם כפתור נוסף באתר — אם הוא ממשיך את הכניסה, לחצו «זה הכפתור הנכון» ואז «פתח את מסך הכניסה». לשמירה לחצו «שמור טיוטה». |
| `visualFieldUpdated` | מיפוי השדה עודכן בטיוטה. לשמירה לחצו «שמור טיוטה». |

`fieldsIdentifiedWithAction` names only «זה הכפתור הנכון»: when fields are already mapped on this surface, the extra button may be a later-step control, so the message doesn't instruct opening the login screen.  
**Kept verbatim (Owner-specified in D-121-22):** `autoAnalyzeSuccess` / `fieldsIdentified` «שדות הכניסה זוהו. בדקו ושמרו טיוטה.» and `autoAnalyzePartial` / `fieldsPartial` «…ניתן להשתמש במיפוי חזותי.». These don't quote a button; if Architecture wants them under the exact-label rule, they would become «…לחצו «שמור טיוטה».».

## Behavior

No logic, gating, click, Analyze, origin, or `data-action` change. STANDARD editor untouched. No site-specific logic.

## Correction evidence

```text
npx tsc -b → exit 0

node scripts/verifyPhase121SpecialDraftAuthoring.mjs
→ PASS (includes D-121-22 + D-121-23):
  - each approval button's literal label = required new label (looked up by data-action)
  - panel title + plain-Hebrew status line present
  - old labels absent: אישור פעולה (המשך כתיבה), אשר להמשך כתיבה, המשך (לחיצה מאושרת),
    אשר לריצה (ACTIVATE), אישור המשך:, אישור ריצה:, «המשך»
  - data-action attributes retained
  - every «…» in SPECIAL_EDITOR_COPY_HE equals an existing literal <button> label
  - actionFound / fieldsIdentifiedWithAction / autoAnalyzeSuccessWithAction /
    visualActionFound / continueNeedsApproval name «זה הכפתור הנכון»
    (all except fieldsIdentifiedWithAction also name «פתח את מסך הכניסה»)
  - all D-121-22 checks still PASS

node scripts/verifyPhase121LoginContract.mjs → PASS (121.0 regression)
IDE diagnostics on SpecialLoginDraftEditor.tsx → none
```

## Files changed (correction)

| File | Change |
|---|---|
| `src/admin/SpecialLoginDraftEditor.tsx` | Approval panel labels + status line; copy quotes exact labels |
| `scripts/verifyPhase121SpecialDraftAuthoring.mjs` | D-121-23 label + exact-label assertions |
| `team-Yuri/dev-phase121.md` | This evidence; D-121-22 Owner notes updated to new labels |

## Owner-validation notes (HOME ENTRY + FLOATING_SCREEN)

| Step | Expect |
|---|---|
| Analyze from Hub (floating screen closed) | Panel «נמצא כפתור באתר»; message «…לחצו «זה הכפתור הנכון» ואז «פתח את מסך הכניסה».» — both labels visible as buttons |
| Press «פתח את מסך הכניסה» before approving | Button stays disabled (unchanged gating) |
| «זה הכפתור הנכון» | Status line shows «אושר לפתיחת המסך: כן» |
| «פתח את מסך הכניסה» | Same D-121-22 flow: screen opens → auto-Analyze messages |

## Developer report (Architecture re-review)

| Field | Value |
|---|---|
| Slice | **121.1 D-121-23 CORRECTION (text-only)** |
| Status | **COMPLETE** — STOP for Architecture re-review (covers D-121-22 + D-121-23) |
| Behavior change | None |
| 121.2+ | **NOT AUTHORIZED / NOT STARTED** |

---

# Slice 121.1 §5.1 CORRECTION — auto-Analyze after approved continuation (D-121-22) (2026-09-27)

**Trigger:** Owner live, FLOATING_SCREEN — first «Analyze (current surface)» runs while the floating screen is closed, so it proposes only the opener. After «המשך (לחיצה מאושרת)» reveals the screen, Admin had to press Analyze again. Continuation success copy was internal jargon («…(לא Orchestrator).»).  
**Authorized:** Architecture §5.1 / D-121-22 only. Mizrahi-Tefahot = Owner fixture only. **STOP** for Architecture re-review.

## Required fix (done)

| Rule | Implementation |
|---|---|
| Auto-Analyze after **successful** approved continuation click (+ existing bounded readiness) | `continueAfterApproval` → on `result.ok` only → `runSpecialAnalyze('after_continue')` → `analyzeSpecialCurrentSurface` on same authoring tab (D-121-21 open/reuse; `reopenLoginEntry: false`) |
| Apply results like manual Analyze | Manual button and auto path share `runSpecialAnalyze`; field proposals → current draft step (`upsertStepFieldMappings`) |
| New opener/transition → pending, still needs approval | `pickNewActionCandidate`: first candidate whose locator is not already in draft; forced unapproved; re-ids on `actionId` collision so the just-approved opener is never overwritten |
| Analyze performs no click; never clicks unapproved | `runSpecialAnalyze` contains no click / approve calls; Ext click still requires `approvedForAuthoringContinuation === true` |
| Never auto-invoke Visual Mapping (incl. on Analyze failure) | Partial/failure → message only |
| Draft-only; Save Draft manual; no ACTIVATE side effect | No registry write / ACTIVATE intent in Analyze or continuation |
| Failed continuation → no auto-Analyze | Failure branch sets error and returns before auto-Analyze |
| Plain Hebrew Admin copy | `SPECIAL_EDITOR_COPY_HE` — all editor success/error/hint strings; pattern label `רגיל (Phase 120)` → `רגיל` |
| Origin fail-closed / site-agnostic / STANDARD | Unchanged; no hostname / serviceId / Mizrahi branches; `AutofillProfileEditor` untouched |

### Admin copy (after continuation)

| Situation | Message |
|---|---|
| Click OK, auto-Analyze started | «המסך נפתח. מנתח את שדות הכניסה…» |
| All credential fields mapped | «שדות הכניסה זוהו. בדקו ושמרו טיוטה.» (+ note to approve an additional continue button if a new one was found) |
| Partial / no fields / inspect failure | «המסך נפתח, אך לא כל השדות זוהו. ניתן להשתמש במיפוי חזותי.» (inspect failure also shows its error) |
| Click failed | Existing click error only; no Analyze |

Also rewritten (manual Analyze / Visual / save / activate / hints): removed «Phase 120», «Phase 121», «routing», «Orchestrator», «loginFlowPlan.draft», «Digital Home», «אין ריצת SPECIAL ב־121.1».  
**Not changed:** `planActivate.ts` `standardActivateFailed` («…בבדיקת Phase 120.») — 121.0-impl is CLOSED and not reopened; flagged for Architecture if it should be reworded in a later authorized slice.

## Correction evidence

```text
npx tsc -b → exit 0

node scripts/verifyPhase121SpecialDraftAuthoring.mjs
→ PASS (includes §4.7, §4.6/D-121-21, §5.1/D-121-22):
  - auto-Analyze only after successful approved click (ordering + single call)
  - failed click branch → no auto-Analyze
  - Analyze: no click, no approve, no Visual, no registry write, no ACTIVATE intent
  - continuation: no auto-Visual, no auto-save
  - new candidate → pending (unapproved, cannot be clicked); known locator not re-proposed;
    actionId collision re-ided; approved opener preserved
  - required Hebrew copy present; no Orchestrator / Phase 120 / Phase 121 / 121.1 /
    routing / loginFlowPlan / Digital Home in Admin copy, JSX, or pattern labels
  - no Mizrahi / hostname branches

node scripts/verifyPhase121LoginContract.mjs → PASS (121.0 regression)
node scripts/verifyPhase120LocatorVerification.mjs → exit 0
node scripts/verifyPhase120ManagedActivateGate.mjs → exit 0
node scripts/verifyPhase120ManagedEligibility.mjs → exit 0
node scripts/verifyPhase120ManagedVisibility.mjs → exit 0
```

Lint: repo has no ESLint config (`npx eslint` → no `eslint.config.*`); IDE diagnostics on touched files → none.

## Files changed (correction)

| File | Change |
|---|---|
| `src/admin/SpecialLoginDraftEditor.tsx` | Shared `runSpecialAnalyze`; auto-Analyze after successful continuation; `SPECIAL_EDITOR_COPY_HE` plain Hebrew |
| `src/loginContract/specialDraftAuthoring.ts` | `pickNewActionCandidate`; STANDARD label `רגיל` |
| `src/loginContract/index.ts` | Export `pickNewActionCandidate` |
| `scripts/verifyPhase121SpecialDraftAuthoring.mjs` | D-121-22 assertions; AC-121.1-5 slice covers shared routine |
| `team-Yuri/dev-phase121.md` | This evidence |

## Owner-validation notes (HOME ENTRY + FLOATING_SCREEN)

Fixture: Mizrahi-Tefahot OK as **Owner fixture only** (no code branches). Reload the extension + Hub first.

| Step | Expect |
|---|---|
| Row with HOME ENTRY + FLOATING_SCREEN DRAFT; click «ניתוח (משטח נוכחי)» from Hub | Authoring tab opened/reused at `primary_url` origin; opener proposed as pending; «נמצא כפתור שפותח את מסך הכניסה…» |
| «זה הכפתור הנכון» → «פתח את מסך הכניסה» (labels per D-121-23) | Floating screen opens in the same tab; message «המסך נפתח. מנתח את שדות הכניסה…» |
| Auto-Analyze completes | Credential fields appear in the current step list; «שדות הכניסה זוהו. בדקו ושמרו טיוטה.» — or partial message with Visual Mapping available manually |
| Visual Mapping | Never opens by itself (also not on partial/failure) |
| Pending approval panel | Still shows the approved opener unless a genuinely new button was found (then new one, unapproved) |
| Nothing saved yet | Reload loses changes until «שמור טיוטה»; no ACTIVATE |
| Force a click failure (e.g. close the floating screen's opener target / wrong locator) | Error shown; no Analyze message, no field changes |
| No entry reopen | No new Login Entry / entry-URL tab during auto-Analyze |

## Developer report (Architecture re-review)

| Field | Value |
|---|---|
| Slice | **121.1 §5.1 CORRECTION (D-121-22)** |
| Status | **COMPLETE** — STOP for Architecture re-review |
| Blocking finding | Second manual Analyze required after opener; jargon copy — **fixed** |
| §4.6 / §4.7 | Retained |
| 121.2+ | **NOT AUTHORIZED / NOT STARTED** |

## Developer Declaration
Successful approved continuation now auto-runs the existing SPECIAL current-surface Analyze on the same authoring tab; results are draft-only and new actions stay pending approval. No click, no Visual auto-invoke, no persist, no ACTIVATE from Analyze. Admin copy is plain Hebrew. Origin fail-closed, STANDARD, and site-agnostic rules unchanged. **STOP** for Architecture. Do not start 121.2+.

---

# Slice 121.1 §4.6 CORRECTION — open/reuse authoring tab (D-121-21) (2026-09-24)

**Trigger:** Owner live — after §4.7, Hub shows HOME surface correctly, but Analyze / Visual fail with «לא ניתן לנתח…» / mapping equivalent.  
**Cause (generic):** SPECIAL inspect used active / last-focused tab; click from Hub focuses Hub → origin fail-closed vs resolved authoring origin.  
**Authorized:** Architecture §4.6 / D-121-21. Mizrahi-Tefahot = Owner fixture only. **STOP** for Architecture re-review.

## Required fix (done)

| Rule | Binding |
|---|---|
| Before SPECIAL Analyze / Visual | Open **OR** reuse browser tab at resolved §4.7 authoring URL / `allowedOrigin` |
| Prefer reuse | Already-open same-origin authoring tab |
| Inspect / Visual target | That authoring tab — **not** Hub active tab |
| Origin validation | Fail-closed — **not** weakened |
| After approved opener progression | Keep revealed SPECIAL surface; do **not** reopen Login Entry / entry URL |
| STANDARD paths | Do **not** call STANDARD Analyze/Visual entry that reopens Login Entry after SPECIAL progression |
| Site identity | None (no hostname / serviceId / Mizrahi / fixture-name branches) |

## Correction evidence

```text
node scripts/verifyPhase121SpecialDraftAuthoring.mjs
→ PASS (includes §4.7 + §4.6 / D-121-21):
  - ensureSpecialAuthoringTab open/reuse helper
  - prefer same-origin reuse; else open authoringUrl
  - inspect / visual / click do NOT use active/lastFocused Hub tab
  - Hub passes authoringUrl (§4.7 resolved) on SPECIAL messages
  - origin fail-closed preserved
  - no STANDARD Login Entry reopen messages on SPECIAL path
  - no site-id / Mizrahi branches in open/reuse

npx tsc -b → exit 0
```

## Files changed (correction)

| File | Change |
|---|---|
| `extension/background.js` | `ensureSpecialAuthoringTab`; inspect / visual / click target authoring tab (not Hub) |
| `src/assistedMapping/currentTabAuthoring.ts` | Pass `authoringUrl` (§4.7 resolved) on SPECIAL inspect / visual / click |
| `scripts/verifyPhase121SpecialDraftAuthoring.mjs` | D-121-21 open/reuse vs Hub regression |
| `team-Yuri/dev-phase121.md` | This evidence |

## Owner-validation notes (HOME ENTRY + FLOATING_SCREEN)

Fixture: Mizrahi-Tefahot OK as **Owner fixture only** (no code branches).

| Step | Expect |
|---|---|
| Registry row with HOME ENTRY (`primary_page` / empty `login_url`) + FLOATING_SCREEN DRAFT | Hub shows resolved `primary_url` authoring surface (unchanged §4.7) |
| Click **Analyze** from Hub (Hub is focused) | Ext opens **or** reuses same-origin tab at resolved authoring origin — inspect that tab |
| Click **Visual Mapping** from Hub | Same open/reuse; Visual targets authoring tab, not Hub |
| Origin mismatch / non-HTTPS | Fail-closed (generic Hebrew error OK; origin not weakened) |
| After approve + continue opener | Revealed surface kept; next Analyze/Visual **reuse** same-origin tab — no Login Entry / entry URL reopen |
| Do **not** | Use STANDARD Autofill Analyze/Visual that opens Login Entry after SPECIAL progression |

## Developer report (Architecture re-review)

| Field | Value |
|---|---|
| Slice | **121.1 §4.6 CORRECTION (D-121-21)** |
| Status | **COMPLETE** — STOP for Architecture re-review |
| Blocking finding | Hub-focused active tab ≠ authoring origin — **fixed** via open/reuse |
| §4.7 | **PASS retained** |
| 121.2+ | **NOT AUTHORIZED / NOT STARTED** |
| Next | Architecture re-review only |

## Developer Declaration
SPECIAL Analyze/Visual open or reuse the resolved §4.7 authoring tab (not Hub). Origin fail-closed preserved. No Login Entry reopen after SPECIAL progression. No site-specific logic. No 121.2 / SPECIAL runtime. **STOP** for Architecture. Do not start 121.2+.

---

# Slice 121.1 §4.7 CORRECTION — SPECIAL entry resolution (2026-09-24) — PASS RETAINED

**Trigger:** Owner live validation — SPECIAL authoring required dedicated `login_url`, blocking HOME ENTRY + FLOATING_SCREEN.  
**Authorized:** Architecture §4.7 / D-121-20. Mizrahi-Tefahot = fixture only.

## Required fix (done)

| Rule | Binding |
|---|---|
| HOME ENTRY (`primary_page`) | Authoring surface + origin from `primary_url` |
| DEDICATED (`direct_url`) | Authoring surface + origin from `login_url` |
| Analyze / Visual enablement | When **resolved** entry URL is valid HTTPS — not only when `login_url` set |
| Origin validation | Fail-closed HTTPS origin of resolved URL — **not** weakened |
| Site identity | None (no hostname / serviceId / Mizrahi / fixture branches) |

## Correction evidence

```text
node scripts/verifyPhase121SpecialDraftAuthoring.mjs
→ PASS (includes §4.7):
  - HOME ENTRY (empty login_url) → primary_url + origin
  - DEDICATED → login_url + origin
  - non-HTTPS rejected (fail-closed)
  - no site-id / Mizrahi branches

npx tsc -b → exit 0
```

## Files changed (correction)

| File | Change |
|---|---|
| `src/loginContract/specialAuthoringEntry.ts` | **NEW** — `resolveSpecialAuthoringEntry` |
| `src/loginContract/index.ts` | Export resolver |
| `src/admin/SpecialLoginDraftEditor.tsx` | Use resolved authoring URL/origin; gate Analyze/Visual on `canUseCurrentSurface` |
| `scripts/verifyPhase121SpecialDraftAuthoring.mjs` | HOME / DEDICATED regression |
| `team-Yuri/dev-phase121.md` | This evidence |

## Developer Declaration
Generic SPECIAL entry-mode surface resolution shipped. No site-specific logic. Origin fail-closed preserved. **§4.7 PASS retained** under §4.6 open/reuse correction.
