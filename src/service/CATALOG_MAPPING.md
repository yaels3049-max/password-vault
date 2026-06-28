# Catalog mapping — built-in catalog → ServiceDefinition → legacy Service

Phase 3 — Iteration 3.1 / 3.4. This documents how the **built-in catalog** maps to the **canonical Service entity** and the **legacy runtime Service** shape.

## Where catalog data lives

| Layer | Location |
|-------|----------|
| **Authoritative built-in catalog** | `src/catalog/builtinCatalog.ts` (`BUILTIN_CATALOG_DEFINITIONS`) |
| **Validation** | `src/catalog/catalogLoader.ts` (`getBuiltinCatalogDefinitions()`) |
| **Legacy compatibility** | `src/catalog/definitionToLegacyService.ts` → `mockServices` in `src/mockServices.ts` |

Runtime code continues to import `mockServices` and `Service` from `src/mockServices.ts`. Migration to direct `ServiceDefinition` consumption is deferred to later iterations.

## Field mapping

| Legacy (`Service` via mockServices) | Canonical (`ServiceDefinition`) | Notes |
|---------------------------------------|----------------------------------|-------|
| `id` | `id` | Stable catalog identifier |
| `name` | `displayName` | Renamed in canonical model |
| `url` | `url` | Primary URL |
| `loginUrl` | `loginUrl` | Optional; open target when present |
| `loginFields` | `loginFields` | Optional; defaults to username/password when absent |
| `category` | `category` | practice / banking / health / shopping |
| `icon` | `icon` | Emoji or presentation reference |
| `logoUrl` | `metadata.faviconSiteUrl` → resolved at legacy layer | Presentation only |
| — | `schemaVersion` | Always `1` |
| — | `source` | `built-in-catalog` for all built-in entries |
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

## User-created services (legacy)

Custom services added via Manage Services use ids `custom-{timestamp}` and map as:

| Legacy | Canonical |
|--------|-----------|
| `name` | `displayName` |
| `url` | `url` (primary URL only) |
| `category` | `category` |
| `icon` | `icon` (default 🔗) |
| `logoUrl` | `metadata.logoUrl` |
| — | `source`: `user-created` |
| — | `loginUrl`: absent until Iteration 3.2 discovery |
| — | `adapterId`: absent (generic path only) |

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

- `legacyServiceToDefinition(service)` — single entry
- `legacyServicesToDefinitions(services)` — batch
- `validateServiceDefinition(definition)` — canonical validation

No catalog migration is performed in Iteration 3.1; these utilities are for validation and future iterations.
