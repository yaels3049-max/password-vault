# Access Profile model — ServiceDefinition → AccessProfile → Credential Set

Phase 4 — Iteration 4.1. This documents the **canonical Access Profile entity** and its relationship to **ServiceDefinition** and vault **credential sets**.

## Layered model

```
ServiceDefinition          (site metadata — Phase 3)
        │
        │  1 : many
        ▼
AccessProfile              (user identity context — Phase 4)
        │
        │  1 : 1
        ▼
Credential Set             (encrypted field values in vault — keyed by profile id)
```

| Layer | Contains | Must not contain |
|-------|----------|------------------|
| **ServiceDefinition** | displayName, url, loginUrl, loginFields, category, icon | Credentials, profile labels |
| **AccessProfile** | id, serviceId, displayName, optional presentation fields, isDefault | Credentials, site URLs, login field schema |
| **Credential Set** | Field id → value map matching service `loginFields` | Service metadata, profile display label |

**AccessProfile owns exactly one credential set** in the vault (by profile id). The credential set is **never embedded** inside the AccessProfile record.

## Field mapping — AccessProfile

| Field | Required | Role |
|-------|----------|------|
| `schemaVersion` | yes | Forward-compatible parsing (currently `1`) |
| `id` | yes | Stable unique profile id (`profile-{uuid}`) |
| `serviceId` | yes | Parent `ServiceDefinition.id` |
| `displayName` | yes | User-facing profile label (distinct from service displayName) |
| `createdAt` | yes | ISO-8601 creation timestamp |
| `updatedAt` | yes | ISO-8601 last update timestamp |
| `description` | no | Optional note |
| `color` | no | Optional presentation color |
| `icon` | no | Optional presentation icon |
| `isDefault` | no | Preferred default when profile resolution does not choose explicitly |

## Validation rules

- **Unique id** — enforced across a profile collection via `validateUniqueProfileIds()`
- **Non-empty displayName** — required, max length `PROFILE_DISPLAY_NAME_MAX_LENGTH`
- **Valid serviceId** — non-empty reference to parent service (existence checked at persistence layer)
- **Exactly one default per service** — when multiple profiles share a serviceId, `validateExactlyOneDefaultPerService()` requires exactly one `isDefault: true`
- **No credential-like fields** — username, password, credentials, fieldValues, loginFields, etc. rejected on profile objects
- **Unknown schema version** — rejected; only `ACCESS_PROFILE_SCHEMA_VERSION` supported

## Relationship to current vault (pre–Phase 4.2)

Today credentials are keyed by **service id**. Phase 4.2 migration will introduce default profiles and re-key credentials by **profile id**. This module defines the target entity only — no vault or runtime wiring yet.

## Profile resolution (future)

How a profile is **chosen** at tile open (chooser, remembered profile, rules, AI, enterprise policy) is **not** part of this model. See `docs/phases/PHASE_4_IDENTITY_AND_PROFILE_MANAGEMENT.md` — Future extensibility.

## Module location

| File | Role |
|------|------|
| `src/profile/accessProfileModel.ts` | Entity type, `createAccessProfile`, default helpers |
| `src/profile/profileValidation.ts` | Validation and collection rules |
| `src/profile/index.ts` | Public exports |

**Runtime status (Iteration 4.1):** module is specification-only; not imported by Dashboard, vault, autofill, or discovery.
