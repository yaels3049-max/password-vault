# Manager Phase 102

## Phase Identifier
PHASE=102

## Status
STATUS: READY_FOR_DEVELOPER

The original Phase 102 delivery milestones in this artifact (schema seed, RLS, registry loader, discovery gate, discovery persist) are **historical**. They are not active requirements. Do not re-implement them.

Automatic Login Discovery is **withdrawn from the MVP**. Historical AC-102-4, AC-102-5, D-102-7, and D-102-8 are not Developer work. Phase 108 is authoritative. Do not restore, redesign, or expand discovery.

This revision is the only active Manager contract. It replaces the credential-field plan that did not include credential modes. Do not implement that earlier plan.

## Phase Goal
Implement explicit credential configuration for global / catalog services, and render the result exactly when the user is asked for credentials.

Three modes, stored as `metadata.credentialMode`:

- `not_configured` — NOT_CONFIGURED
- `credential_fields` — CREDENTIAL_FIELDS
- `no_stored_credentials` — NO_STORED_CREDENTIALS

If the key is absent, a valid non-empty `login_fields` array resolves to CREDENTIAL_FIELDS. Otherwise it resolves to NOT_CONFIGURED. An empty field list is never NO_STORED_CREDENTIALS.

Retain `loginFields`. Do not create a second credential model. Field input types for the MVP are `text` and `number`. NUMBER values are lossless digit strings. Masking, input type, and password/autofill role stay separate. Custom services stay on the Username + Password render-time default. No Autofill expansion. No ciphertext migration or rewrite.

The Phase 107 administrator controls are required companion work in this plan.

## Source References
- `team-Yuri/PHASE.md` — `PHASE=102`
- `team-Yuri/arch-phase102.md` — **MVP Dynamic Credential Fields** and **Credential modes and input types**; AC-102-7 through AC-102-36; D-102-27
- `team-Yuri/arch-phase107.md` — **Global credential-field configuration** and **Credential mode configuration**; AC-107-21 through AC-107-29
- `team-Yuri/PLAN.md` — section 8; changelog 5.42 through 5.46
- CEO approval 2026-09-14

## Architecture Summary
Mode and field list must agree:

- CREDENTIAL_FIELDS requires at least one valid active field.
- NO_STORED_CREDENTIALS must not contain active fields. Null, omitted, or `[]` is consistent only together with this explicit mode.
- NOT_CONFIGURED must not generate Username + Password, and must not leave an active field list in place.
- A save that would store a contradictory pair is rejected. An already stored contradiction is configuration-invalid. Do not silently reinterpret it as another mode.

`inputType` is `text` or `number` on the existing field object. Omitted means `text`. It does not replace `type`. `type` remains the password/autofill role only. `masked` is independent of both. A NUMBER field is stored as the exact digit string inside the existing encrypted credential map. `0017` must remain `0017`.

Global service means `owner_user_id` is null. Custom service means `source_type = user`.

NO_STORED_CREDENTIALS is a complete configuration: no credential form, no empty credential record, the service may still be added and opened, and Digital Home does not perform Google, Microsoft, or other external-provider authentication.

## Ordered Milestones

| Order | Milestone | Description | Acceptance Signal |
|---:|---|---|---|
| 1 | M1 Mode and field rules | Persist and resolve the three modes. Reject contradictory saves. Stop inventing a global schema. Preserve NUMBER strings and `required` / `masked` / `inputType`. | AC-102-25, AC-102-27, AC-102-29, AC-102-31, AC-102-36. A no-password schema survives load. `npm run build` passes. |
| 2 | M2 Administrator controls | Explicit mode choice and structured fields, including TEXT, NUMBER, and an independent mask. Not raw JSON. | AC-107-21 through AC-107-29. Operator can save both credential fixtures and an explicit no-stored-credentials service. Contradictory saves are rejected. |
| 3 | M3 User credential entry | Render by resolved mode. Exact fields when configured. Incomplete or invalid configuration shows no invented form. No-stored-credentials shows no form and does not create a credential record. | AC-102-17 through AC-102-24 and AC-102-26 through AC-102-35. |
| 4 | M4 Evidence and security packet | Record tests, build, and the security-review packet. Not a product-feature milestone. | `dev-phase102.md` complete. MVP release remains blocked until the security owner reviews the gated boundaries. |

Do not start a discovery-removal milestone. That is Phase 108.

## Detailed Development Plan

### M1 — Mode and field rules

Authorized now. No new credential table. No ciphertext rewrite. No backfill or nulling of existing `login_fields` except an explicit confirmed mode transition defined below.

Do not use `persist_discovered_login_url` to publish credential schemas or modes. If a database check outside that RPC rejects a valid no-password schema, stop and record the blocker. Do not ship a migration that relaxes that check until the security owner has reviewed it.

Resolution:

- `metadata.credentialMode` is `not_configured`, `credential_fields`, or `no_stored_credentials`.
- Absent or unrecognized key plus a valid non-empty field list means CREDENTIAL_FIELDS.
- Absent or unrecognized key otherwise means NOT_CONFIGURED.
- Never infer `no_stored_credentials` from an empty array.

Save rules:

- Reject CREDENTIAL_FIELDS unless `login_fields` is a valid non-empty array.
- Reject NO_STORED_CREDENTIALS if the saved row would still contain a valid non-empty field list. A confirmed choice of this mode may clear the active field list to null. It must not write Username + Password and must not delete ciphertext.
- Reject a NOT_CONFIGURED save that would leave a valid field list active or would write `DEFAULT_LOGIN_FIELDS`. A confirmed return to NOT_CONFIGURED may clear the active field list to null. It must not invent Username + Password and must not delete ciphertext.
- A stored contradictory row is configuration-invalid on read. Do not auto-rewrite its mode.

Client rules:

- `src/service/serviceModel.ts` — a present schema with zero `type: password` fields is valid. Preserve `required`, `masked`, and `inputType`. NUMBER is not a numeric type in the credential map.
- `src/registry/registryMapper.ts` — do not discard a schema because it has no password-role field. Do not drop `required`, `masked`, or `inputType`. Round-trip `metadata.credentialMode`.
- Global credential entry must not receive `DEFAULT_LOGIN_FIELDS` when the resolved mode is not CREDENTIAL_FIELDS.
- Custom service with no valid schema: resolve Username + Password only at render time. Do not write that default into `login_fields`. Do not add a credential-mode control.
- `src/admin/adminRegistryApi.ts` — do not rewrite an omitted or empty field list to `DEFAULT_LOGIN_FIELDS`.
- Publishing a mode or schema change increments existing `metadata_version`. That is metadata only.

Do not edit Autofill heuristics, adapters, Login Intelligence, vault crypto, or authentication. Residual discovery must not create, replace, or enrich `login_fields` or `credentialMode`. Do not delete the discovery engine.

### M2 — Administrator controls

Depends on M1.

Primary surface: admin global service create/edit (`src/admin/RegistryAdmin.tsx` and `src/admin/adminRegistryApi.ts`). Raw JSON is not the primary method. It may remain only behind «פרטים נוספים».

The editor offers three distinct choices:

- Credentials required — structured field editor. Persist `credential_fields` only with a valid field list.
- No credentials stored by Digital Home — persist `no_stored_credentials` and no active fields. Copy may say authentication continues on the external website.
- Not configured — the incomplete state. Do not persist this by clearing fields alone.

For each field when credentials are required: label, order, required, `inputType` (`text` or `number`), and masked. Mask and input type are separate. Neither sets `type: password`. Password/autofill role stays the existing advanced control. Label edits must not regenerate `id`.

Before change, remove, or reuse of a `field.id`, warn that existing stored values may no longer match, and require confirmation. The warning must not show credential values. Confirmation does not copy values to a new id.

A confirmed switch to NO_STORED_CREDENTIALS or NOT_CONFIGURED that clears an active field list must say that the field definition will be cleared and that stored user values are not migrated. It must not display those values.

Admin still cannot query `encrypted_credentials`, decrypt vault blobs, or display credential values.

### M3 — User credential entry

Depends on M2.

**CREDENTIAL_FIELDS.** When the user is asked to enter credentials, the form must:

1. Load that service's schema, not a shared default.
2. Render exactly that number of fields.
3. Render them in administrator-defined order.
4. Display each administrator-defined label.
5. Bind each value to that field's stable `id`.
6. Honor required/optional, `inputType`, and masking.
7. Not substitute Username + Password.

Fixtures:

- ID Number (`inputType: number`, not masked), then Last 4 digits of card (`inputType: number`, masked, not `type: password`). Exactly those two labels. Saved last-4 value `0017` reopens as `0017`.
- Customer Number, ID Number, Password. Exactly three fields, in that order.
- Username (`text`, not masked) and Password (`text`, masked). Exactly those two fields because they were configured. This is not the custom default and not a fallback.

A required field must be non-empty before save. An optional field may be empty and must be omitted from the saved map. A NUMBER field rejects a non-digit entry and must not coerce the value through a numeric conversion. Save writes current schema field ids only and must not attach an old value to a new id. This serialization change is inside the security gate.

**NOT_CONFIGURED and configuration-invalid.** Test null or omitted fields with no mode, `[]` with no `no_stored_credentials` mode, an invalid field list, and a contradictory stored pair. Each shows configuration-incomplete. None show Username + Password. None accept new input. None write ciphertext. None become NO_STORED_CREDENTIALS. Copy, which may be tightened without changing behavior:

- «לא ניתן להזין פרטי כניסה — שדות הכניסה לאתר זה עדיין לא הוגדרו.»
- When a credential blob already exists and can be known without displaying decrypted values: «אם כבר נשמרו פרטים, הם נשמרים ולא מוצגים כאן.»

**NO_STORED_CREDENTIALS.** No credential-entry form. No Username + Password. Do not create an empty credential record. The user can add the service and open it through the existing login-entry path. Do not click or complete Google, Microsoft, or any other external authentication control.

**Custom service** with no valid schema: render Username (`id: username`, label «שם משתמש») and Password (`id: password`, label «סיסמה», masked, password-role). Do not persist that default because the form opened. Do not add a mode designer. If the custom row already has a valid schema, render that schema.

Known surfaces: `src/ServiceProfileManagementModal.tsx`, `src/CredentialModal.tsx`, and `src/loginAssistance/LoginAssistancePanel.tsx` wherever they present credential fields for entry or copy. Do not change Autofill fill heuristics.

### M4 — Evidence and security packet

No new product behavior. Record evidence in `dev-phase102.md`.

MVP release of validation and save-serialization changes is **blocked** until the security owner confirms:

- every field value, including a digit string, still uses the existing whole-payload encryption path
- a schema id change cannot attach an existing value to a different `field.id`
- relaxing the password-type check did not skip encryption or create a plaintext side channel
- NUMBER values are not stored in an unprotected numeric column

That review must not become a vault, KDF, encryption-format, or authentication redesign. Do not claim MVP release before that review is attached.

## Acceptance / Gating Criteria

Active: AC-102-7 through AC-102-36, and companion AC-107-21 through AC-107-29.

AC-102-9 passes only if AC-102-17, AC-102-18, and AC-102-19 pass when the resolved mode is CREDENTIAL_FIELDS. AC-102-10 passes only if the incomplete and invalid fixtures pass. AC-102-36 is mandatory for mode/field consistency.

Withdrawn from this plan: AC-102-4 and AC-102-5.

AC-107-7 remains: admin cannot view credential plaintext.

## Functional Testability Criteria

- Page/screen the user can open: Admin global website edit; Manage Services credential details; Add Site for a custom service; open for a no-stored-credentials service.
- User-visible behavior: an explicit two-field numeric schema shows exactly those labels, and `0017` survives save. An explicit no-stored-credentials service shows no credential form and still opens. A global service that was never configured shows the incomplete state, not Username + Password, and not the no-stored-credentials behavior.
- Command-line flow: `npm run build`.
- API endpoint / request: none new. Admin save writes `metadata.credentialMode` and `login_fields` together, and increments `metadata_version`. It must not write `encrypted_credentials` from the admin console.
- Minimal end-to-end flow:
  1. As admin, save a global service as credentials required, with ID Number (number, not masked) and Last 4 digits of card (number, masked, not password-role). Reload. Mode, order, labels, and types are unchanged.
  2. As a user, enter `0017` in the last-4 field and save. Reopen. The value is `0017`. Exactly two fields are shown.
  3. As admin, try to save credentials required with no fields. The save is rejected.
  4. As admin, set no credentials stored. Confirm the warning if fields would be cleared. Reload. Mode is `no_stored_credentials` and there is no active field list. The user sees no credential form, can keep the service, and can open it. Digital Home does not perform external login.
  5. As admin, try to save no-stored-credentials while an active field list is also submitted. The save is rejected.
  6. Global service with no mode and no fields, and one with `[]` and no mode. Both are incomplete. Neither is no-stored-credentials.
  7. Create a custom service. Credential entry is Username + Password. Opening that form does not write `login_fields` or `credentialMode`.
- Expected observable result: AC-102-25 through AC-102-36 and AC-107-27 through AC-107-29 are visible without raw JSON as the primary admin method.

## Required Developer Evidence

Write `team-Yuri/dev-phase102.md`. Include:

- Files changed, and an explicit list of files not changed (Autofill heuristics, adapters, vault crypto, authentication, discovery engine deletion, custom-service mode designer).
- Proof of the three modes, including that an empty field list did not become `no_stored_credentials`.
- Proof that contradictory saves were rejected.
- Proof that `0017` was stored and reread as `0017`.
- Screenshots or recorded steps for the two-field fixture, the incomplete state, no-stored-credentials open, and the custom default.
- Proof that `metadata_version` increments on mode or schema publish and that ciphertext was not rewritten.
- `npm run build` result.
- Security packet: validation and serialization paths changed, confirmation that encryption still wraps the whole credential map including digit strings, and the statement that MVP release is waiting on security-owner review.
- If a database check blocked a valid schema, the exact object and the fact that no migration was shipped.

## Out of Scope

- New credential table or parallel schema.
- Credential-data migration, ciphertext rewrite, or a backfill of `credentialMode` onto existing rows.
- End-user schema designer or custom-service credential mode.
- Autofill heuristic, adapter, or Login Intelligence changes.
- Clicking or completing external identity-provider controls.
- Vault, KDF, encryption format, authentication.
- Restoring or expanding Automatic Login Discovery. Deleting the discovery engine. Phase 108 login-entry work.
- Phase 111 icon discovery.
- Phase 113 visual redesign.
- Unpublishing catalog services that lack a schema.

## Risks / Open Questions

- `getLoginFields` is shared with execution and assistance. Credential-entry paths must not use the username+password fallback for a global service whose resolved mode is not CREDENTIAL_FIELDS. Do not edit fill heuristics to compensate.
- Clearing an active field list on a confirmed mode change must not delete ciphertext and must not be done silently.
- Save-replaces-the-map can drop unused keys. That must not remap an old id onto a new id. Security review covers this.

## Manager Review
MANAGER_REVIEW_STATUS: NOT_REVIEWED

### Review Notes
Active plan is the 2026-09-14 credential-mode revision. The earlier credential-field plan without modes is withdrawn. Developer may implement M1 through M3. Manager will not approve MVP release until the security packet is reviewed by the security owner.

### Required Corrections
None yet. Awaiting Developer evidence in `dev-phase102.md`.
