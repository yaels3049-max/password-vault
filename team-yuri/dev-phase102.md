# Developer Phase 102

## Phase Identifier
PHASE=102

## Status
STATUS: COMPLETE

M1, M2, and M3 of the 2026-09-14 credential-mode revision are implemented. MVP release is not claimed.

## Source References
- `team-Yuri/PHASE.md` — PHASE=102
- `team-Yuri/manager-phase102.md` — active credential-mode plan only
- `team-Yuri/arch-phase102.md` — credential modes and input types; AC-102-7 through AC-102-36; D-102-27
- `team-Yuri/arch-phase107.md` — AC-107-21 through AC-107-29

## Implementation Summary
Global services persist one explicit mode in `metadata.credentialMode`: `not_configured`, `credential_fields`, or `no_stored_credentials`. A missing or unrecognized key plus a valid field list resolves to CREDENTIAL_FIELDS. Otherwise it resolves to NOT_CONFIGURED. An empty field list is never treated as NO_STORED_CREDENTIALS.

Administrator save rejects a contradictory pair. A confirmed switch to no-stored or not-configured may clear the active field list to null after a warning that does not show credential values. That clear does not delete ciphertext and does not write Username + Password. An already stored contradiction stays configuration-invalid and is not rewritten to another mode.

Field `inputType` is `text` or `number` on the existing field object. Omitted means text. Masking and password role stay independent. A NUMBER value is stored as the exact digit string inside the existing encrypted credential map. `0017` stays `0017`. HTML `type=number` is not used.

Custom services still have no mode control. A custom row with no valid schema uses Username + Password only at render time.

## Implemented Milestones

| Milestone | Completed: Yes/No | Notes |
|---|---:|---|
| M1 Mode and field rules | Yes | Resolve, reject contradictory saves, preserve NUMBER strings. No schema invented for a global incomplete mode. |
| M2 Administrator controls | Yes | Three distinct choices. TEXT, NUMBER, and an independent mask. Raw JSON remains under «פרטים נוספים». |
| M3 User credential entry | Yes | Exact fields, incomplete/invalid, and no-stored are distinct. Custom default stays render-time only. |
| M4 Evidence and security packet | Recorded | Not a product-feature milestone. MVP release remains blocked. |

## Files Changed

| File | Change Summary | Reason |
|---|---|---|
| `src/service/credentialSchema.ts` | Three modes, consistency write plan, `inputType`, lossless digit strings | M1 |
| `src/service/serviceModel.ts` | Preserve `inputType`. Client-only stored-field status | M1 |
| `src/service/legacyService.ts` | Same field attributes on the runtime service | M1 |
| `src/registry/registryMapper.ts` | Round-trip classified fields, including empty and invalid status. Does not invent a schema | M1 |
| `src/catalog/definitionToLegacyService.ts` | Carry stored-field status to credential entry | M1 |
| `src/catalog/builtinCatalogOverlay.ts` | An explicit mode is not refilled from the builtin seed | Mode must survive catalog load |
| `src/admin/adminRegistryApi.ts` | Reject contradictory writes. Stamp `credentialMode`. Increment `metadata_version` on mode or field publish | M1 / M2 |
| `src/admin/CredentialFieldsEditor.tsx` | TEXT / NUMBER and independent mask | M2 |
| `src/admin/RegistryAdmin.tsx` | Three mode choices and confirmed clear warning | M2 |
| `src/ServiceProfileManagementModal.tsx` | Render by resolved mode. Digit-string entry | M3 |
| `src/loginAssistance/LoginAssistancePanel.tsx` | Incomplete and no-stored show no invented fields | M3 |
| `src/CredentialModal.tsx` | Same distinction. Unused by current callers | M3 |
| `src/trust/HubCredentialInput.tsx` | Digit-string input never uses HTML `type=number` | AC-102-31 |
| `scripts/verifyPhase102CredentialSchema.mjs` | Mode, rejection, and `0017` checks | Evidence |
| `docs/MIGRATION_PHASE_102.md` | Note that no migration was shipped | Evidence |
| `docs/evidence/phase102-credential-schema-fixtures.html` | Recorded fixture lists | Evidence |

### Files not changed
- Autofill heuristics and adapters (`src/execution/autofillEligibility.ts`, `src/execution/genericAutofill.ts`, adapter files)
- Vault crypto, KDF, encryption format, authentication
- Discovery engine, extension discovery messages, and `build:extension-discovery`
- Custom-service mode designer (not added)
- `getLoginFields` still falls back for Autofill only. Credential entry does not use that fallback for a global service whose resolved mode is not CREDENTIAL_FIELDS

## Dependencies Installed

| Dependency / Tool | Command Used | Reason |
|---|---|---|
| None | | Existing toolchain was sufficient |

## Unit Tests

| Field | Value |
|---|---|
| Command | `node scripts/verifyPhase102CredentialSchema.mjs` |
| Result | PASS |
| Notes | No unit-test runner in `package.json`. Helper proved: empty array is `not_configured`; explicit `no_stored_credentials` is distinct; contradictory saves of CREDENTIAL_FIELDS without fields, NO_STORED_CREDENTIALS with active fields, and NOT_CONFIGURED with active fields are rejected; `0017` is reread as the string `0017`; a non-digit NUMBER value is rejected. |

## Lint

| Field | Value |
|---|---|
| Command | | 
| Result | NOT AVAILABLE |
| Notes | `package.json` has no lint script. |

## Functional Testability Evidence

| Field | Value |
|---|---|
| Method | CLI helper plus recorded steps. Live admin and user clicks were not captured in this session. |
| Steps | 1. Admin global edit shows three choices: «טרם הוגדר», «נדרשים פרטי כניסה», «הבית הדיגיטלי לא שומר פרטי כניסה». 2. Credentials required persists `credential_fields` only with a valid field list, including ID Number (number, not masked) and Last 4 digits of card (number, masked, type text). 3. Saving credentials required with no fields is rejected. 4. Switching to no-stored or not-configured while fields exist requires `MODE_CLEAR_WARNING`. Confirmed save writes the mode and null fields, not Username + Password. 5. Saving no-stored together with an active field list is rejected. 6. A global service with no mode and no fields, and one with `[]` and no mode, resolve to incomplete, not no-stored. 7. User entry of `0017` serializes as the string `0017`. 8. A custom service with no schema still resolves Username + Password at render time and does not write `login_fields` or `credentialMode` because the form opened. 9. No-stored shows no credential form and does not save an empty credential record from the entry surfaces. Open remains the existing login-entry path. |
| Expected Result | AC-102-25 through AC-102-36 and AC-107-27 through AC-107-29 without raw JSON as the primary method. |
| Actual Result | NOT TESTED |
| Notes | Helper assertions passed. Operator screenshots were not attached. An earlier confirmation («ביצעתי בדיקה והכל תקין») applied to the withdrawn plan without credential modes. It does not cover this revision. |

Recorded lists: `docs/evidence/phase102-credential-schema-fixtures.html`.

## Documentation Update Evidence

| Field | Value |
|---|---|
| Documentation Updated | YES |
| Files Updated | `docs/MIGRATION_PHASE_102.md`, `docs/evidence/phase102-credential-schema-fixtures.html`, `team-Yuri/dev-phase102.md` |
| Reason if Not Required | |

## Known Issues / Limitations
- `persist_discovered_login_url` in `supabase/migrations/20260703120400_phase102_rpc_validation_and_reset.sql` still rejects a no-password schema when that RPC is used. Product save does not use that RPC to publish schemas or modes. No migration was shipped.
- Invalid `login_fields` are omitted from the runtime service so catalog validation does not drop the row. `storedLoginFieldsStatus` keeps that pair configuration-invalid. The stored row is not rewritten.
- `getLoginFields` still invents Username + Password for Autofill when a service has no schema. Credential-entry paths do not use that helper.
- Overlay may still fill seed `loginFields` only when no explicit mode is stored. An explicit mode is not refilled.
- Live `metadata_version` increment and ciphertext non-rewrite were not observed against a live database. The admin update path increments `metadata_version` only when the written field JSON or published mode differs, and it does not write `encrypted_credentials`.

## Scope Compliance
Did not restore Automatic Login Discovery. Did not delete the discovery engine. Did not expand Autofill. Did not rewrite credential ciphertext. Did not add an end-user schema designer. Did not redesign the vault, KDF, encryption format, or authentication. Did not implement the withdrawn plan that lacked credential modes.

## Security packet
Validation and save-serialization changed. `planCredentialConfigurationWrite` rejects contradictory mode/field saves. `serializeCredentialValues` writes current field ids only, omits empty optional values, rejects a non-digit NUMBER value, and stores a digit string without `Number` or `parseInt`.

Every field value, including `0017`, is still a string inside `Record<string, string>` for the existing whole-payload encryption path. NUMBER is not written to a numeric column. A schema id change still does not copy an old value onto a new id. Relaxing the password-type check did not add a plaintext side channel in this change. Admin save does not query or display `encrypted_credentials`.

MVP release is waiting on security-owner review of those boundaries. That review must not become a vault, KDF, encryption-format, or authentication redesign.

## Developer Declaration
Sarah, SW Developer. M1–M3 of the revised Phase 102 plan are implemented. `node scripts/verifyPhase102CredentialSchema.mjs` PASS. `npm run build` PASS. Lint NOT AVAILABLE. MVP release is not claimed.
