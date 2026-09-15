# Catalog mapping — built-in catalog → ServiceDefinition → legacy Service

Phase 3 — Iteration 3.1 / 3.4. This documents how the **built-in catalog** maps to the **canonical Service entity** and the **legacy runtime Service** shape.

## Authoritative identity vs source vs ownership

| Concept | Field | Role |
|---------|-------|------|
| **Identity** | `id` | Stable service key only. May be `custom-…` for a private create **and** may remain `custom-…` after promotion. |
| **Current source/type** | Registry `source_type` → mapped `ServiceDefinition.source` / runtime `Service.source` | Whether the service is currently user-created vs global/catalog (e.g. `built_in` → `built-in-catalog`). |
| **Ownership** | Registry `owner_user_id` | Null = global/catalog; set = owning user. |
| **Write authorization** | RLS / API | Who may update metadata. Not derived from the id string. |

**Do not** treat a `custom-` id prefix as proof that the service is currently user-created or user-editable.

## Where catalog data lives

| Layer | Location |
|-------|----------|
| **Authoritative built-in catalog** | `src/catalog/builtinCatalog.ts` (`BUILTIN_CATALOG_DEFINITIONS`) |
| **Runtime catalog (production)** | `service_registry` via `src/registry/registryLoader.ts` |
| **Validation** | `src/catalog/catalogLoader.ts` (`getBuiltinCatalogDefinitions()`) |
| **Legacy compatibility** | `src/catalog/definitionToLegacyService.ts` → `mockServices` in `src/mockServices.ts` |

Runtime code continues to import `mockServices` and `Service` from `src/mockServices.ts`. Migration to direct `ServiceDefinition` consumption is deferred to later iterations.

## Field mapping

| Legacy (`Service` via mockServices) | Canonical (`ServiceDefinition`) | Notes |
|---------------------------------------|----------------------------------|-------|
| `id` | `id` | Stable identity only |
| `name` | `displayName` | Renamed in canonical model |
| `url` | `url` | Primary URL |
| `loginUrl` | `loginUrl` | Optional; open target when present |
| `loginFields` | `loginFields` | Optional; credential entry uses resolved schema/mode, not id shape |
| `category` | `category` | practice / banking / health / shopping |
| `icon` | `icon` | Emoji or presentation reference |
| `logoUrl` | `metadata.faviconSiteUrl` → resolved at legacy layer | Presentation only |
| — | `schemaVersion` | Always `1` |
| — | `source` | From registry `source_type` (or explicit seed). Never from id prefix |
| — | `adapterId` | `htzone` only (metadata; routing still by legacy id) |

Credentials are **never** stored on either shape. Vault keys use `service.id` and field ids from `loginFields`.

## Built-in catalog entries

| id | displayName | url | loginUrl | loginFields | category | adapterId (metadata) |
|----|-------------|-----|----------|-------------|----------|----------------------|
| `hub-practice-login` | תרגול התחברות | `/demo-login.html` | — | default (username, password) | practice | — |
| `hapoalim` | בנק הפועלים | https://www.bankhapoalim.co.il | — | username, password | banking | — |
| `leumi` | בנק לאומי | https://www.leumi.co.il | — | default | banking | — |
| `discount` | דיסקונט | https://www.discountbank.co.il | — | default | banking | — |
| `mizrahi` | מזרחי טפחות | https://www.mizrahi-tefahot.co.il | — | default | banking | — |
| `clalit` | כללית | https://www.clalit.co.il | https://e-services.clalit.co.il/onlineweb/general/login.aspx | idNumber, userCode, password | health | — |
| `maccabi` | מכבי | https://www.maccabi4u.co.il | — | default | health | — |
| `meuhedet` | מאוחדת | https://www.meuhedet.co.il | — | default | health | — |
| `leumit` | לאומית | https://www.leumit.co.il | — | default | health | — |
| `shufersal` | שופרסל | https://www.shufersal.co.il | https://www.shufersal.co.il/online/he/login | email, password | shopping | — |
| `rami-levy` | רמי לוי | https://www.rami-levy.co.il | — | default | shopping | — |
| `amazon-il` | Amazon ישראל | https://www.amazon.co.il | — | default | shopping | — |
| `ksp` | KSP | https://www.ksp.co.il | — | default | shopping | — |
| `htzone` | הייטקזון | https://www.htzone.co.il | https://www.htzone.co.il/login | email, password | shopping | `htzone` (metadata only; routing still by legacy id) |

## User-created services

New private services may mint ids with a `custom-` prefix (**identity only**). Current type and edit rights come from registry state:

| Registry | Mapped / UI |
|----------|-------------|
| `source_type = 'user'`, `owner_user_id = <user>` | `source: 'user-created'`; user may edit site details |
| After promotion: `source_type = 'built_in'`, `owner_user_id = null` (id may still be `custom-…`) | `source: 'built-in-catalog'`; user must not edit global metadata |

| Legacy | Canonical |
|--------|-----------|
| `name` | `displayName` |
| `url` | `url` (primary URL) |
| `category` | `category` |
| `icon` | `icon` (default 🔗) |
| `logoUrl` | `metadata.logoUrl` |
| — | `source`: authoritative from registry / explicit create, not from id |
| — | `loginUrl`: explicit login entry |
| — | `adapterId`: absent unless set |

## Lifecycle (architectural)

Per `PHASE_3_EXTENSIBLE_SERVICE_PLATFORM.md` Iteration 3.1:

| State | Current catalog example |
|-------|-------------------------|
| Defined | All mockServices entries |
| Visible | Selected on dashboard via `selectedIds` |
| Configured | User saved vault credentials for service id |
| Generic-evaluated | Shufersal, Clalit (Phase 2 validated) |
| Adapter-bound | HTZone (`adapterId` metadata; legacy id routing today) |

## Mapping API

- `legacyServiceToDefinition(service, { source })` — requires authoritative source (options or `service.source`); never infers from id
- `legacyServicesToDefinitions(services)` — batch; each entry must already carry source
- `validateServiceDefinition(definition)` — canonical validation

No catalog id migration is performed; `custom-*` ids may remain after promotion.
