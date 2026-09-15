# Architecture Phase 102

## Phase Identifier
PHASE=102

## Status
STATUS: APPROVED

CEO FINAL APPROVAL: 2026-09-14 — **APPROVED FOR DEVELOPMENT MANAGER HANDOFF.** Credential modes and input types are approved, including the consistency invariant D-102-27. AC-102-7 … AC-102-36 are normative. The prior `manager-phase102.md` is not Developer scope until it is revised against this approval.

CEO FINAL APPROVAL: 2026-09-14 — **APPROVED FOR DEVELOPMENT MANAGER HANDOFF** of AC-102-7 … AC-102-24, superseded for implementation sequencing by the pending credential-mode amendment above. The security gate on validation and credential serialization remains mandatory before MVP release. Do not reopen Automatic Login Discovery.

AMENDED: 2026-09-14 — **User credential entry is mandatory product behavior.** AC-102-17 … AC-102-24 are normative and testable.

AMENDED: 2026-09-14 — **MVP Dynamic Credential Fields.** CEO approved with security gate. Phase 102 remains the authoritative owner of the Service Registry credential schema. This amendment retains `loginFields` / `service_registry.login_fields`. It does not create a second credential model, a new phase, or an encryption redesign. Normative contract: section **MVP Dynamic Credential Fields**. Implementation that relaxes the password-type invariant, changes schema validation, or changes credential serialization is **SECURITY REVIEW REQUIRED** before MVP release. Discovery must not create credential schemas. Phase 108 does not own this capability. Phase 107 owns the administrator configuration surface.

## Phase Goal
Make the **service registry** the runtime source of catalog metadata (built-in Israeli catalog + user custom services). Historical text below that says login URL discovery runs on demand is a delivery record, not an active MVP requirement. See **Historical automatic Login URL discovery**. Vault read path remains IndexedDB for unlock/credentials in the original phase. Unified execution (Phase 103) and registration UX (Phase 190) are unchanged by this amendment.

## Historical automatic Login URL discovery

D-102-7, D-102-8, AC-102-4, AC-102-5, and any prose in this file that says Automatic Login Discovery runs, persists a discovered `login_url`, or persists discovered `login_fields`, are **historical records of the original Phase 102 delivery**. They are **not** active MVP requirements.

The revised Phase 108 decision is authoritative: Automatic Login Discovery is withdrawn from the MVP. Explicit login entry is human-owned (`admin` or `user`). Do not restore, redesign, or expand discovery as part of the credential-field amendment. Do not reopen that Phase 108 decision. Residual discovery code is not an approved schema source and is not Manager scope for this handoff.

## Source References
- `team-Yuri/PLAN.md` §6 — Service Registry
- `team-Yuri/PLAN.md` §18 — Phase 102 acceptance criteria (AC-102-1 … AC-102-6)
- `team-Yuri/arch-phase101.md` — APPROVED; `service_registry` table exists; RLS select-only for clients on global registry
- `src/catalog/builtinCatalog.ts` — current built-in seed data (to migrate, not runtime authority)
- `src/catalog/catalogLoader.ts`, `src/mockServices.ts` — current runtime catalog path
- `src/catalog/customServiceDiscovery.ts` — discovery + `shouldPersistDiscoveredLoginUrl`
- `supabase/migrations/20260702121500_phase101_schema.sql` — baseline `service_registry` columns

## Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-102-1: Seed built-in catalog via SQL migration** | AC-102-2 requires catalog in platform data, not TS runtime | One migration seeds all production built-in rows from current `builtinCatalog.ts` (excluding dev-only `hub-practice-login`) |
| **D-102-2: Runtime catalog reads Supabase** | AC-102-2 | Replace `getBuiltinCatalogDefinitions()` network/DB fetch; map registry rows → `ServiceDefinition` / legacy `Service` |
| **D-102-3: Dev-only practice service stays client-gated** | Phase 100 boundary preserved | `hub-practice-login` **not** seeded in production registry; inject only when `isDevBuild()` (same as Phase 100) |
| **D-102-4: User-scoped registry rows for custom services** | AC-102-3 | Add `owner_user_id uuid null` on `service_registry`; NULL = global (built-in/admin); set = owning user |
| **D-102-5: RLS — read global + own user rows** | Isolation + discoverability | SELECT: `owner_user_id IS NULL OR owner_user_id = auth.uid()` AND `service_status = 'active'` (deprecated handling deferred) |
| **D-102-6: RLS — user INSERT/UPDATE own rows only** | Custom service CRUD | INSERT/UPDATE/DELETE on rows where `owner_user_id = auth.uid()` AND `source_type = 'user'` |
| **D-102-7: Global login URL cache via SECURITY DEFINER RPC** | Historical AC-102-5. **Not an active MVP requirement.** Phase 108 is authoritative | Historical RPC `persist_discovered_login_url` is not an approved writer of `login_url` or `login_fields` for the MVP. Do not plan new discovery persist |
| **D-102-8: Discovery gate** | Historical AC-102-4. **Not an active MVP requirement.** Phase 108 is authoritative | Do not run Automatic Login Discovery when `login_url` is null or invalid. Explicit login entry is Phase 108 |
| **D-102-9: `login_url_status` column** | Explicit invalid marking for AC-102-4 | Values: `unknown` (null URL), `valid`, `invalid`; default `unknown` when URL null, `valid` when seeded with URL |
| **D-102-10: Icon metadata in registry** | AC-102-1 | Store emoji in `icon`; favicon URL in `metadata.faviconSiteUrl` (matches current `ServiceDefinition.metadata`) |
| **D-102-11: IndexedDB vault unchanged for reads** | Phase 101 dual-write continuity | Custom service definitions may still exist in vault blob during transition; Phase 102 adds registry row on custom create and prefers registry on load when Supabase configured |
| **D-102-12: Offline fallback** | PLAN §10 offline behavior (partial) | If Supabase fetch fails, fall back to last cached registry snapshot in memory/session OR minimal error state — document; no silent revert to `builtinCatalog.ts` in production |

## Constraints / Non-Negotiables
- No plaintext credentials in registry (unchanged ADR-002).
- No registration/login UX (Phase 190).
- No unified execution refactor beyond using registry `loginUrl` / `loginFields` where already consumed (Phase 103 owns full pipeline).
- No admin platform UI (Phase 107).
- No `service_role` key in client.
- Phase 100 `isDevBuild()` rules unchanged.
- Built-in seed must preserve existing service ids (e.g. `shufersal`, `clalit`, `htzone`) for vault compatibility.

## Technical Boundaries / Out of Scope
- Full multi-device registry sync read path (Phase 101+ sync scope unchanged for credentials).
- Admin approval workflow for user-submitted global catalog (`PendingReview` → `ApprovedGlobal`).
- Deprecation UX for `service_status = deprecated`.
- Registry versioning / `metadataVersion` conflict resolution (later).
- Removing `builtinCatalog.ts` from repo (may remain as **seed reference** for migrations until admin tools exist).
- HTZone adapter / generic autofill engine changes beyond reading registry metadata.

## Dependencies and Interfaces

### Schema migration (Phase 102 delta)
Extend `service_registry`:
| Column | Purpose |
|--------|---------|
| `owner_user_id` | `uuid null` FK → `users(id)`; NULL = global |
| `login_url_status` | `text not null default 'unknown'` check in (`unknown`,`valid`,`invalid`) |

Add index: `(owner_user_id)` where not null.

### Seed migration
- Insert all production entries from `builtinCatalog.ts` (12 services, **exclude** `hub-practice-login`).
- Map fields: `url` → `primary_url`, `loginUrl` → `login_url`, `loginFields` → `login_fields`, `adapterId` → `adapter_id`, `category` → `category_id`, `source_type` = `built_in`, `service_status` = `active`.
- Set `login_url_status = valid` where `login_url` present; else `unknown`.

### RLS migration (Phase 102 delta)
Replace broad `service_registry_select_authenticated` with visibility policy (D-102-5).

Add policies for user-owned registry CRUD (D-102-6).

Add RPC + grant:
```sql
-- Signature concept (Manager/Developer finalize)
persist_discovered_login_url(
  p_service_id text,
  p_login_url text,
  p_login_fields jsonb default null
) returns void
-- SECURITY DEFINER; validates auth.uid() is not null;
-- updates only global built_in row when login_url is null OR login_url_status = 'invalid';
-- sets login_url_status = valid, updated_at = now()
```

User-owned custom rows: client UPDATE allowed directly for `login_url`, `login_fields`, `login_url_status` on own rows (D-102-6).

### Client modules (Developer — target interfaces)
| Module | Responsibility |
|--------|----------------|
| `src/registry/registryLoader.ts` | Fetch + map registry → `ServiceDefinition[]` |
| `src/registry/registryMapper.ts` | Row ↔ `ServiceDefinition` field mapping |
| `src/registry/loginUrlDiscovery.ts` | Gate discovery (D-102-8); call RPC or direct update per row ownership |
| `src/catalog/catalogLoader.ts` | Delegate to registry loader; dev-only practice injection |
| `src/catalog/customServiceDiscovery.ts` | After discovery, persist to user registry row + vault |
| `src/supabase/persistence.ts` | Upsert user-scoped `service_registry` row when custom service created |

### Registry row → ServiceDefinition mapping (AC-102-1)
| Registry | ServiceDefinition |
|----------|-------------------|
| `primary_url` | `url` |
| `login_url` | `loginUrl` |
| `category_id` | `category` |
| `icon` | `icon` |
| `adapter_id` | `adapterId` |
| `login_fields` | `loginFields` |
| `metadata` | `metadata` (incl. favicon) |
| `id` | `id` |
| `display_name` | `displayName` |

## Data / State Considerations
- **Existing vaults:** `selectedIds` and `customServices` in IndexedDB remain valid; built-in ids unchanged.
- **Custom services:** Creating custom service inserts `service_registry` row (`source_type=user`, `owner_user_id=auth.uid()`) and references same `id` in `user_services`.
- **Dual-write:** Phase 101 persistence continues; Phase 102 adds registry upsert for custom definitions.
- **Discovery idempotency:** Do not re-run discovery when `login_url_status = valid` and URL present.
- **Invalid marking:** Phase 102 may mark invalid on failed open/autofill (minimal: manual/dev flag or execution failure hook — Manager scopes minimal trigger).

## Security / Privacy Considerations
- RPC must not allow arbitrary row updates (service id + null/invalid guard only).
- User registry rows isolated by `owner_user_id`.
- Discovery fetches third-party HTML only through existing extension/proxy paths; no new credential exposure.
- Registry rows never contain user secrets.

## Testing and Lint Expectations
- `npm run build` passes.
- Apply Phase 102 migrations to Supabase project.
- Verification script or documented SQL checks: seeded built-in count, RLS isolation (user A cannot read user B custom registry row), RPC updates global login URL when allowed.
- Unit tests for mapper + discovery gate if feasible; else document NOT AVAILABLE.

## Functional Testability

- Page/screen: Manage Services / Dashboard (existing flows)
- User-visible behavior: Same service list as today; sources loaded from Supabase after unlock + network
- Command-line: apply migrations; optional `node scripts/verifyPhase102Registry.mjs`
- Minimal E2E:
  1. Unlock vault (IndexedDB)
  2. Open Manage Services — catalog shows seeded banks/health/shopping from registry
  3. Add custom site URL — user registry row created (`source_type=user`)
  4. Historical only, not an active MVP requirement: discovery persist. Phase 108 owns explicit login entry. Do not plan this step.
  5. Supabase Table Editor — `service_registry` shows built-in seeds + user custom row with metadata
- Expected: AC-102-1…AC-102-6 satisfied; no regression to vault unlock or credential save

## Handoff Notes for Manager

1. **Migrations order:** schema delta → seed built-in → RLS delta → RPC function.
2. **Remove runtime dependency** on `BUILTIN_CATALOG_DEFINITIONS` for production; keep for seed generation reference.
3. **Practice service:** dev-only injection only; do not seed in SQL.
4. **RPC vs direct UPDATE:** global built-in → RPC; user custom → direct client UPDATE under RLS.
5. **Document** operator steps in `docs/MIGRATION_PHASE_102.md` or extend Phase 101 doc with §102 addendum.
6. **Verification (historical delivery):** catalog load from DB and custom user row isolation. Discovery persist is not an active MVP requirement (Phase 108).
7. **Do not** start Phase 103 unified execution refactor beyond consuming registry fields already used.

## MVP Dynamic Credential Fields (normative — 2026-09-14)

This section supersedes any reading of Phase 102 that treats `login_fields` as a discovery cache, or that requires every credential schema to contain a password field. Historical registry delivery (D-102-1 … D-102-12) remains approved. Where this section conflicts with a discovery-era reading of `login_fields`, this section wins.

### Ownership

| Concern | Owner |
|---|---|
| Credential schema meaning, validity, storage identity, user-entry rendering contract | Phase **102** |
| Administrator configuration of global credential fields | Phase **107** |
| Autofill / adapters / Login Intelligence | Unchanged. **Out of scope.** Do not modify heuristics to satisfy this amendment |
| Automatic Login Discovery | Not an owner. Must not create or modify credential schemas |
| Phase 113 | Non-blocking amendment only. Must not implement this capability |

Do not create a new phase. Do not assign this capability to Phase 108.

### Retained model

Retain, and do not parallel:

- `loginFields` on the service definition
- `service_registry.login_fields` (jsonb array)
- credential values as a map keyed by stable `field.id`
- existing whole-credential-payload encryption (the encrypted blob is the credential map, not named username/password columns)
- dynamic credential-form rendering from the active schema

No new credential table. No ciphertext rewrite. No backfill or nulling of existing `login_fields`. Existing username/password ciphertext remains valid.

### Field object

Each credential field is one object in the existing `login_fields` array. No parallel schema type.

| Property | Role | Must not mean |
|---|---|---|
| `id` | Stable identity connecting this field to stored values | Display text. Position. A username/password synonym |
| `label` | What the user and administrator see | Security classification. Autofill role |
| `required` | `true` or `false`. If the key is absent on a previously stored field, treat as `true` | Inferred from position |
| `masked` | Input/display masking. If absent and `type` is `password`, treat as masked (legacy). If absent otherwise, not masked | The site's password |
| `type` | Autofill / site-password role only: `text` or `password`. If absent, role is `text` (not a site password) | Masking. Field order. Label language |

A field may be sensitive and `masked: true` without `type: password`. Example: label "Last 4 digits of card" may be masked and must not be stored as `type: password` merely to mask it.

Position does not assign username or password semantics. The first field is not a username. A non-password value must not be forced into username/password semantics.

### Valid schema

A **valid credential schema** is a JSON array of one or more field objects where:

- every `id` is a non-empty string and unique within the service schema
- every `label` is a non-empty string
- `required`, `masked`, and `type` follow the field-object rules above
- order is the array order
- **zero fields with `type: password` is valid**

The following are architecturally valid examples. They do not prescribe column names:

- Username + Password (`type: password` only on the password field)
- ID Number + Password
- Customer Number + Password
- ID Number + Last 4 digits of card (no password-role field; last-4 may be `masked: true` and `type: text`)

### Invalid or absent schema

For a **global / catalog** service (`owner_user_id` is null), the following are **not** a valid explicit credential schema. They are three separate test fixtures. They share one user-facing outcome. An implementation must not treat any of them as permission to invent or persist a schema.

| Fixture | Definition | Acceptance |
|---|---|---|
| No schema | `login_fields` is null, or the value is omitted | AC-102-20 |
| Empty schema | `login_fields` is `[]` | AC-102-21 |
| Invalid schema | Non-array; an element that is not an object; blank or missing `id`; blank or missing `label`; duplicate `id`; or `type` present and not `text` or `password` | AC-102-22 |

**Shared outcome (mandatory for all three fixtures):**

- Do not invent, repair, persist, or substitute a schema, including Username + Password.
- Do not render a credential-entry form.
- Do not accept new credential input.
- Do not create, rewrite, delete, or migrate stored ciphertext.
- Do not display stored values under guessed labels.
- Show a non-blocking Hebrew state that credential fields for this website are not configured, and that already-saved details remain stored and are not shown until the website's fields are defined. Normative meaning, copy may be tightened without changing behavior: «לא ניתן להזין פרטי כניסה — שדות הכניסה לאתר זה עדיין לא הוגדרו.» and, when the UI can know a credential blob already exists without decrypting it for display: «אם כבר נשמרו פרטים, הם נשמרים ולא מוצגים כאן.»
- Catalog listing and login-entry URL behavior are unchanged. These states do not unpublish the service and do not authorize field discovery.
- Recovery is only an administrator publishing a valid explicit schema. If that schema reuses the same `field.id` values already stored, existing values match with no migration. If it does not, values are not remapped and are not shown under the new ids.

A global service that **has** a valid explicit schema must never use Username + Password as an additional or fallback form. An explicit schema whose labels are Username and Password is a valid configured schema. It is not this absent/invalid state. The distinction is AC-102-24.

### User credential entry (mandatory product behavior)

This is not implementation guidance. The criteria below are MVP acceptance. They are owned by Phase 102. Phase 107 does not own user-entry rendering. Phase 113 must not implement them.

Save of a valid schema writes a credential map of current schema field ids only. Empty optional fields are omitted, not stored as placeholder secrets. This serialization rule is inside the security gate. It must not become a silent remap of an old id onto a new id. Failure of that serialization rule does not relax the rendering criteria below.

### Field id stability

- Changing `label` does not change stored-value identity.
- Changing, removing, or reusing a `field.id` must never silently associate an existing value with a different meaning.
- No silent credential migration. No automatic copy from an old id to a new id.
- The administrator UI (Phase 107) must warn and require explicit confirmation when an edit can make existing stored values no longer match. The administrator still must not see credential values.

### Custom user-created services

If a user-owned custom service (`source_type = user`) has no valid `login_fields` schema, credential entry remains the current default only:

- Username (`id: username`, label «שם משתמש», required, not a reason to persist this default onto the row)
- Password (`id: password`, label «סיסמה», required, masked, password-role)

This default is a render-time rule for custom services. Do not write it into `login_fields` merely because the user opened the form. Do not add an end-user schema designer.

If a custom row already has a valid `login_fields` array, render that array. Do not strip it and do not replace it with a designer.

Users must not redefine a global schema.

### No automatic discovery

Credential fields must not be inferred from a login URL, page crawl, DOM inspection used to create a schema, AI, or Automatic Login Discovery. Knowing a login URL does not authorize schema creation. Residual discovery code must not create, replace, or enrich `login_fields`. Administrator explicit configuration is the only approved writer of a global credential schema.

### Autofill

Out of scope. Storing a schema does not require filling it on the external site. Services the existing Autofill path cannot fill remain manual / open-only. Do not change Autofill heuristics, adapters, or Login Intelligence to satisfy this amendment.

### Existing data

- Username + password ciphertext remains valid.
- No credential-data migration is authorized.
- Do not rewrite ciphertext.
- Do not backfill or null existing `login_fields`.
- A client must not drop a schema solely because it contains no `type: password` field. That current sanitizer behavior contradicts this contract and must not remain the runtime rule.
- Unrelated saves must round-trip `required` and `masked`. Dropping those keys is a schema corruption risk.

Publishing a credential-schema change must increment `service_registry.metadata_version` so a stale client cannot keep rendering the previous field list and then save against it. That increment is metadata only. It is not a credential migration.

### Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-102-13: Retain `loginFields`** | CEO approval; model already exists | No second schema. Same jsonb array. New properties `required` and `masked` live on the existing field object |
| **D-102-14: Password field not required** | ID + last-4 is a valid service | A valid schema may contain zero `type: password` fields. Password-type-required checks are not the product rule |
| **D-102-15: Split label, masking, password role** | Label and mask must not define the site password | `masked` is independent of `type`. `type: password` remains an autofill role only |
| **D-102-16: `field.id` is the only value identity** | Prevent silent mis-association | Label edits are safe. Id change/remove/reuse never auto-maps values. No silent migration |
| **D-102-17: Global rendering follows the configured schema** | Mandatory user-facing acceptance | AC-102-17 … AC-102-19. Exact field count, order, labels, required/optional, masking, bound to `id`. No username+password substitution when a valid explicit global schema exists |
| **D-102-18: Absent global schema is not a schema** | Must not invent fields | AC-102-20 … AC-102-22. No schema, empty schema, and invalid schema are separate fixtures with one outcome. No invented schema. No ciphertext mutation |
| **D-102-19: Custom default stays username + password** | Do not grow custom-service scope | Render-time default only. No end-user designer |
| **D-102-20: No schema discovery** | Same MVP principle as withdrawn login discovery | Login URL, crawl, DOM, and AI must not write `login_fields` |
| **D-102-21: Autofill unchanged** | Storage and fill are separate | Manual/open-only is acceptable. Do not modify fill heuristics |
| **D-102-22: Security gate** | Payload protection must not be bypassed | See security gate below. Do not redesign vault, KDF, encryption format, or authentication |

### Acceptance criteria (this amendment)

| ID | Criterion |
|---|---|
| AC-102-7 | A global service can store a valid `login_fields` schema with no password-role field, including ID Number + Last 4 digits of card, without encoding those values as username or password |
| AC-102-8 | Username + Password, ID Number + Password, and Customer Number + Password are valid schemas on the same model. Identity fields use their own `id` and label. They are not renamed username unless that is the real field |
| AC-102-9 | With a valid global schema, the credential-entry form shows exactly those fields, in order, with configured labels and required/optional behavior, each value bound to `field.id`, and does not also show Username + Password |
| AC-102-10 | A global service with no valid schema does not invent or substitute fields, does not show Username + Password, does not accept new input, and does not rewrite or delete stored ciphertext. The user sees the configuration-incomplete state |
| AC-102-11 | Changing a label leaves stored-value identity unchanged. Changing, removing, or reusing a `field.id` does not silently attach an old value to a new meaning. No silent migration |
| AC-102-12 | A user-created custom service with no valid schema still uses Username + Password. No end-user schema designer is added |
| AC-102-13 | Login URL, crawling, DOM inspection, AI, and Automatic Login Discovery do not create or modify a credential schema |
| AC-102-14 | Existing username/password ciphertext remains readable when the active schema still uses those field ids. No ciphertext rewrite, backfill, or nulling of `login_fields` is performed |
| AC-102-15 | Supporting a schema does not require Autofill of that schema. Existing Autofill heuristics, adapters, and Login Intelligence are not changed by this amendment |
| AC-102-16 | A masked non-password field is not persisted as `type: password` |
| AC-102-17 | **Service-specific credential form.** For every global / catalog service with a valid explicit credential schema, when the user is asked to enter credentials: (1) the system loads that service's schema, not a shared default; (2) the form renders exactly the number of active fields defined for that service; (3) fields appear in the administrator-defined order; (4) each field displays the administrator-defined label; (5) each entered value stays associated with that field's stable `id`; (6) required/optional and masking follow the configured field definition where supported by the approved MVP schema; (7) the form does not substitute Username + Password |
| AC-102-18 | **Two-field fixture.** Global schema ID Number, then Last 4 digits of card. The user-facing form shows exactly those two labels, in that order. It does not show Username or Password |
| AC-102-19 | **Three-field fixture.** Global schema Customer Number, then ID Number, then Password. The user-facing form shows exactly those three labels, in that order. It does not add, drop, or reorder fields |
| AC-102-20 | **No schema.** A global service with null or omitted `login_fields` does not receive an invented schema. Credential entry shows the configuration-incomplete state. It does not show Username + Password. It does not accept new input. It does not write or rewrite ciphertext |
| AC-102-21 | **Empty schema.** A global service with `login_fields` equal to `[]` and no explicit `no_stored_credentials` mode has the same user-facing outcome as AC-102-20. The empty array is not rewritten to Username + Password and is not inferred as NO_STORED_CREDENTIALS |
| AC-102-22 | **Invalid schema.** A global service whose `login_fields` fails validation (non-array, missing or blank id or label, duplicate id, or illegal `type`) has the same user-facing outcome as AC-102-20. The invalid value is not repaired into a schema and is not replaced with Username + Password |
| AC-102-23 | **Custom services.** A user-created custom service with no valid schema still uses the default Username + Password at render time only. No end-user credential-schema designer is introduced. That default is not written to `login_fields` and is not a global explicit schema. If a custom row already has a valid schema, render that schema. Do not replace it with the default and do not offer a designer |
| AC-102-24 | **Three-way distinction.** Tests must distinguish: (A) a valid explicit global schema, including one whose fields are Username and Password, which renders exactly those configured fields; (B) the custom-service render-time default, which is Username + Password only when the service is user-created and has no valid schema; (C) a global service with no schema, an empty schema, or an invalid schema, which must not render (B) and must not persist a schema. Stored username/password ciphertext (AC-102-14) is storage compatibility when a later explicit schema uses those field ids. It is not permission to render Username + Password on a global service in class (C) |

AC-102-9 passes only if AC-102-17, AC-102-18, and AC-102-19 pass. AC-102-10 passes only if AC-102-20, AC-102-21, and AC-102-22 pass. AC-102-12 passes only if AC-102-23 passes. A shorter criterion must not be read as weaker than these. AC-102-17 applies when the resolved mode is CREDENTIAL_FIELDS. It does not apply to NO_STORED_CREDENTIALS.

## Credential modes and input types (normative — approved 2026-09-14)

This section amends the approved Dynamic Credential Fields contract. It does not replace `loginFields`. It does not create a second credential store. CEO approved Development Manager handoff. The Manager plan must be revised against this section before Developer execution.

### Three modes

A global / catalog service has exactly one resolved credential mode. The explicit value is the reserved key `metadata.credentialMode` on the existing `service_registry.metadata` object. Allowed values:

| Stored value | Mode | Meaning |
|---|---|---|
| `not_configured` | NOT_CONFIGURED | Administrator has not completed credential configuration, or has explicitly set this state |
| `credential_fields` | CREDENTIAL_FIELDS | Administrator configured one or more credential fields |
| `no_stored_credentials` | NO_STORED_CREDENTIALS | Administrator explicitly declared that Digital Home does not store credential values |

No new table. No new column. No parallel schema. Unrelated metadata saves must round-trip `credentialMode`. Raw JSON is not the primary way to set it.

**Resolution when the key is absent or unrecognized:**

- A valid non-empty `login_fields` array means CREDENTIAL_FIELDS. Those fields were already explicit. Do not hide them.
- Otherwise the mode is NOT_CONFIGURED.

**Never infer NO_STORED_CREDENTIALS** from null, omitted, empty, or invalid `login_fields`. An empty array is not this mode.

### Consistency invariant

`credentialMode` and `login_fields` must agree. Contradictory states are rejected on administrator save, or, if already stored, handled as configuration-invalid. They must not be silently interpreted as another mode, and must not generate Username + Password.

| Mode | Consistent stored fields | Forbidden |
|---|---|---|
| CREDENTIAL_FIELDS | At least one valid active field | Empty, missing, or invalid field list |
| NO_STORED_CREDENTIALS | No active credential fields (`login_fields` null, omitted, or `[]`) | A valid non-empty field list |
| NOT_CONFIGURED | No active credential fields | A generated Username + Password schema. A valid field list left active under this mode |

An explicit save that would create a forbidden pair is rejected. The editor may clear the active field list only as part of a confirmed transition to NO_STORED_CREDENTIALS or NOT_CONFIGURED. That clear does not delete ciphertext, does not write Username + Password, and does not change `field.id` values already stored in the vault.

A row that already contradicts these rules is configuration-invalid for the user: no credential form, no invented fields, no empty credential record, and no silent rewrite to a different mode.

### User-facing behavior

**NOT_CONFIGURED.** Configuration-incomplete, as already defined. Do not invent fields. Do not fall back to Username + Password. Do not treat the service as NO_STORED_CREDENTIALS. Opening the service still follows the approved login-entry rules.

**CREDENTIAL_FIELDS.** The user form renders exactly the configured fields: count, order, labels, required/optional, masking, and stable `field.id`. AC-102-17 through AC-102-19 apply. This mode requires at least one valid active field. A stored mismatch is configuration-invalid, not a silent fallback.

**NO_STORED_CREDENTIALS.** This is a complete valid configuration. No credential-entry form. No Username + Password fallback. Do not create an empty credential record merely to satisfy a schema. The user may still add the service. Opening uses the approved login entry. Authentication stays on the external website. Digital Home must not click or complete "Sign in with Google", "Sign in with Microsoft", or any other external identity-provider control.

### Field attributes

Retain the existing field object. Add one attribute.

| Attribute | Role |
|---|---|
| `id` | Stable stored-value identity. Unchanged |
| `label` | Display only |
| order | Array order |
| `required` | Unchanged. Omitted means required |
| `inputType` | `text` or `number`. Controls entry checks only. Omitted on a previously stored field means `text` |
| `masked` | Visual masking. Independent of `inputType` and of password role |
| `type` | Existing site-password / autofill role only: `text` or `password`. Not an input type. Not implied by `inputType` or `masked` |

`inputType` must not be stored by overloading `type`. `type: password` remains the autofill role. Masking a NUMBER field must not set `type: password`.

NUMBER is not a mathematical number. The credential map remains `Record<string, string>`. A NUMBER field is validated as a digit string at entry and stored as that exact string. No numeric conversion. `0017` remains `0017`. Leading zeros are required compatibility, not optional formatting.

TEXT has no digit restriction. A password field may be `inputType: text` and `masked: true`. That masking is not a numeric conversion and does not by itself create password semantics beyond an explicitly set `type`.

### Custom services

Unchanged. No credential-mode control. No end-user schema designer. Missing custom schema still renders Username + Password at render time only.

### Autofill and open

Out of scope. `inputType: number` does not authorize new fill heuristics. NO_STORED_CREDENTIALS does not authorize identity-provider automation. Open remains the approved login-entry path. This amendment has no Phase 108 dependency beyond that existing open rule. Do not reopen Phase 108.

### Security

`inputType` and `credentialMode` are service metadata, not credential values. Every stored credential value, including a digit string, stays inside the existing whole-payload encryption path. NUMBER must not be written to a numeric column or any unprotected side store. The existing security gate still covers validation and serialization changes. Do not redesign encryption, vault, authentication, or key derivation.

### Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| **D-102-23: Explicit credential mode** | Empty fields must not mean "store nothing" | Mode is `metadata.credentialMode`. Empty array is not NO_STORED_CREDENTIALS |
| **D-102-24: Legacy valid fields remain CREDENTIAL_FIELDS** | Do not hide schemas already stored | Absent mode plus a valid field list resolves to CREDENTIAL_FIELDS |
| **D-102-25: `inputType` is separate** | NUMBER and mask must not become password | `text` or `number` on the existing field object. Values stay strings |
| **D-102-26: No identity-provider automation** | External site owns authentication | Open only. Do not click Google or Microsoft |
| **D-102-27: Mode and fields must agree** | CEO consistency invariant | CREDENTIAL_FIELDS requires a valid field list. NO_STORED_CREDENTIALS has no active fields. NOT_CONFIGURED does not generate Username + Password. Contradictions are rejected or configuration-invalid, never silently interpreted |

### Acceptance criteria (this amendment)

| ID | Maps | Criterion |
|---|---|---|
| AC-102-25 | AC-A | An administrator can explicitly set a global service to NOT_CONFIGURED. The user sees the configuration-incomplete state. No fields are invented. Username + Password is not substituted |
| AC-102-26 | AC-B, AC-H | An administrator can explicitly set CREDENTIAL_FIELDS. The user form then renders exactly those fields, in order, with configured labels, required/optional behavior, and values bound to `field.id` |
| AC-102-27 | AC-C, AC-D | An administrator can explicitly set NO_STORED_CREDENTIALS. That state is a complete valid configuration, not an error |
| AC-102-28 | AC-E, AC-F | NO_STORED_CREDENTIALS shows no credential-entry fields, does not create Username + Password, and does not create an empty credential record merely to satisfy a schema. The service can still be added and opened |
| AC-102-29 | AC-G | NOT_CONFIGURED and NO_STORED_CREDENTIALS are distinguishable. An empty `login_fields` array without `no_stored_credentials` is NOT_CONFIGURED, not NO_STORED_CREDENTIALS |
| AC-102-30 | AC-I | The administrator can set a field `inputType` to `text` |
| AC-102-31 | AC-J, AC-K | The administrator can set a field `inputType` to `number`. Entry accepts a digit string. The stored value is that string. `0017` does not become `17` |
| AC-102-32 | AC-L, AC-M | Masking is independent of `inputType`. A NUMBER field may be masked and must not be stored as `type: password` because it is masked |
| AC-102-33 | AC-N | `field.id` remains the only stored-value identity. Label, input type, and mask edits do not change it |
| AC-102-34 | AC-O | Existing username/password ciphertext remains readable when the active schema still uses those field ids. No ciphertext rewrite |
| AC-102-35 | AC-P, AC-Q | This amendment does not change Autofill heuristics. NUMBER does not add fill rules. NO_STORED_CREDENTIALS does not make Digital Home perform external identity-provider authentication |
| AC-102-36 | D-102-27 | A save that sets CREDENTIAL_FIELDS without a valid field, or NO_STORED_CREDENTIALS with active fields, is rejected. A contradictory stored row is configuration-invalid. NOT_CONFIGURED never generates Username + Password |

### Engineering change boundary

| Area | Class | Notes |
|---|---|---|
| `loginFields` / `field.id` / whole-payload encryption | RETAIN | |
| `metadata.credentialMode` | MODIFY | Reserved key on existing metadata. No new table |
| `inputType` on the existing field object | MODIFY | `text` or `number`. Stored values remain strings |
| Global credential form | MODIFY | Follows resolved mode. Not a new form system |
| Administrator mode and input-type controls | MODIFY | Phase 107. Not raw JSON |
| Empty-array inference as "no credentials" | REMOVE as an allowed reading | Empty array stays incomplete |
| Autofill, adapters, Login Intelligence | DO NOT TOUCH | |
| Vault, KDF, encryption format, authentication | DO NOT TOUCH | Security gate unchanged |
| Custom-service mode designer | DO NOT TOUCH | |
| Phase 108 login discovery | DO NOT TOUCH | Not reopened |
| Credential migration / ciphertext rewrite | DO NOT TOUCH | |

### Conflicts with the previously approved contract

No reversal of AC-102-7 through AC-102-24. Clarifications:

- AC-102-17 applies only when the resolved mode is CREDENTIAL_FIELDS.
- AC-102-21 still treats an empty array as incomplete. It also forbids reading that array as NO_STORED_CREDENTIALS.
- A valid `login_fields` array with no mode key remains a configured schema. That preserves existing services.
- The previous Manager plan does not include these modes or `inputType`. It is not sufficient Developer scope for this amendment.

### Handoff

Return to the CEO for approval. Do not hand to the Development Manager or the Developer until that approval. After approval, the Manager must revise the Phase 102 plan before any Developer work on this amendment.

### Security gate

**SECURITY REVIEW REQUIRED** before MVP release of any implementation that:

- relaxes the current password-type invariant (client validation, registry sanitizer, or SQL that rejects a schema with no `type: password` field)
- changes credential schema validation
- changes how a credential map is serialized on save (including omitting empty optional keys, or writing only current field ids)
- could affect encrypted credential payload handling

The review must confirm the existing whole-payload encryption path still protects every field value, and that a schema edit cannot attach an existing value to a different `field.id`.

The review must **not** be used to redesign the vault, KDF, encryption format, or authentication.

Architecture-document updates are not blocked by this gate. Implementation of the gated boundaries is.

### Engineering change boundary

| Area | Class | Notes |
|---|---|---|
| `loginFields` / `service_registry.login_fields` | RETAIN | Same store. Add `required` and `masked` on the existing object. No new table |
| Credential map keyed by `field.id` | RETAIN | |
| Whole-payload encryption | RETAIN / DO NOT TOUCH | Security review confirms it still covers every field. Do not replace it |
| Dynamic form renderer | MODIFY | Global services: render the configured schema exactly. Absent/invalid global schema: configuration-incomplete, not username+password. Custom absent schema: retain username+password |
| Password-type-required validation and sanitizer drop | MODIFY | Must not reject or discard a valid no-password schema. **SECURITY REVIEW REQUIRED** |
| Credential save serialization | MODIFY | Current-field-ids only; no silent remap. **SECURITY REVIEW REQUIRED** |
| Administrator structured field editor | MODIFY | Owned by Phase 107. Not raw JSON as the primary method |
| Autofill, adapters, Login Intelligence | DO NOT TOUCH | |
| Vault, KDF, encryption format, authentication | DO NOT TOUCH | |
| Phase 108 login-entry work | DO NOT TOUCH | This capability is not Phase 108 |
| Phase 111 icon discovery | DO NOT TOUCH | |
| Discovery writes of `login_fields` | REMOVE as an approved source | Do not use discovery to create schemas. Do not reopen Phase 108 discovery removal as this task. Residual writers must not override an administrator schema |
| Credential-data migration, ciphertext rewrite, `login_fields` backfill or nulling | DO NOT TOUCH | Not authorized |
| End-user schema designer | DO NOT TOUCH | Not in this MVP |

AC-102-17 … AC-102-24 do not change this boundary. They make the existing form-renderer MODIFY, and the existing prohibition on invented global schemas, mandatory and testable. No area is added or reclassified.

### Handoff notes for this amendment

1. CEO approved Development Manager handoff on 2026-09-14. Plan from **MVP Dynamic Credential Fields** plus the Phase 107 configuration amendment. AC-102-7 … AC-102-24 are in scope. Do not plan Automatic Login Discovery. Do not hand implementation directly to the Developer from this architecture file.
2. Do not plan this work as Phase 108 or Phase 113.
3. Phase 102 is the schema and rendering contract. Phase 107 is the administrator surface. They are one capability. A Manager plan must cover both or the acceptance criteria cannot be met.
4. Security owner review is required before release of the gated boundaries. It is not a license to redesign encryption.
5. `PHASE.md` is not advanced by this amendment.

## Architect Review
ARCHITECT_REVIEW_STATUS: APPROVED

### Review Notes
- **Phase alignment:** `PHASE=102`; artifacts aligned. Manager review APPROVED; operator applied migrations; `verifyPhase102Registry.mjs` reported PASS per manager notes.
- **D-102-1 / D-102-2:** Four ordered migrations; runtime catalog via `loadBuiltinCatalogDefinitions()` → `loadRegistryCatalog()`; `getBuiltinCatalogDefinitions()` removed (throws). Production path does not iterate `BUILTIN_CATALOG_DEFINITIONS` for catalog load.
- **D-102-3:** `hub-practice-login` not seeded in SQL; injected client-side via `injectDevPractice()` when `isDevBuild()` only.
- **D-102-4 / D-102-5 / D-102-6:** Schema delta adds `owner_user_id`, `login_url_status`; RLS visibility policy + user-owned CRUD; global rows non-writable except RPC.
- **D-102-7:** `persist_discovered_login_url` SECURITY DEFINER enforces `owner_user_id IS NULL`, `source_type = built_in`, and `(login_url IS NULL OR login_url_status = invalid')` guard; granted to `authenticated` only.
- **D-102-8 / AC-102-4:** `shouldRunLoginUrlDiscovery()` gates discovery; wired in `discoverAndPersistLoginUrl`, custom add flow, and `Dashboard.handleServiceOpen`.
- **D-102-9:** `login_url_status` check constraint (`unknown`, `valid`, `invalid`); seed sets `valid` where URL present.
- **D-102-10:** Seed stores `icon` + `metadata.faviconSiteUrl`; mapper restores `ServiceDefinition` fields per AC-102-1 table.
- **D-102-11:** IndexedDB vault read/unlock unchanged; Phase 101 dual-write preserved; custom registry upsert on create.
- **D-102-12:** Fetch failure surfaces `catalogError` UI in `App.tsx`; session cache reuse on subsequent loads; no silent production fallback to TS builtin catalog.
- **AC-102-1 … AC-102-6:** Satisfied per code review and manager/operator verification evidence (seed count 13 production built-ins excluding practice — matches `builtinCatalog.ts`, not understated manager “12”).
- **Constraints:** No Phase 103 execution refactor, no Phase 190 auth UX, no admin UI, no `service_role` in client, no credential plaintext in registry.
- **Verification:** Build PASS documented; RLS isolation, RPC allow/deny, user custom row, and discovery persist evidenced in verification script. Unit tests/lint NOT AVAILABLE — acceptable.
- **Observations (non-blocking):** `src/service/CATALOG_MAPPING.md` still references TS catalog as authoritative — update in a docs hygiene pass. `markLoginUrlInvalid()` limited to user rows (global invalid marking deferred). `dev-phase102.md` verification sections marked PENDING superseded by operator apply + script PASS.

### Required Corrections
_None._
