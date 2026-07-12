# Discovery Execution Architecture (Phase 3 — Iteration 3.6)

## Separation of concerns

| Layer | Responsibility | Must not know |
|-------|----------------|---------------|
| **Discovery engine** (`src/discovery/`) | Inspect DOM/HTML and produce `DiscoveryResult` | How the DOM was obtained |
| **Discovery execution** (`src/discovery/execution/`) | Obtain a real or snapshot DOM and invoke the engine | Service persistence, UI copy |
| **Catalog / Hub** (`customServiceDiscovery`, Manage Services) | When to discover, persist `loginUrl`, user messaging | Tab vs background vs offscreen details |

## Public Hub API

```ts
import { discoverLogin } from '../discovery/execution/discoverLogin';

const outcome = await discoverLogin(primaryUrl);
```

`App.addCustomService` and admin registry create call `discoverLoginForRegistryService` → `discoverAndPersistLoginUrl` → `discoverLogin` after the `service_registry` row exists. They never reference extension tabs or fetch proxies directly.

## Abstraction

```ts
interface DiscoveryExecutor {
  readonly id: string;
  discoverLogin(primaryUrl: string): Promise<DiscoveryExecutionOutcome>;
}
```

Outcomes: `success` (with `DiscoveryResult`), `unavailable` (executor cannot run), `error` (execution failed).

## Current production executor

**`ExtensionTabDiscoveryExecutor`** (`extensionTabDiscoveryExecutor`, id: `extension-tab`)

Used for **shared Login Discovery** (user custom service add and admin catalog create/rediscovery). Dashboard tile open does not call `discoverLogin`.

1. Hub sends `HUB_LOGIN_ENTRY_DISCOVERY` to the extension
2. Extension opens a **background** temporary tab at `primaryUrl` (`active: false`)
3. After load, injects the bundled discovery engine and runs it on the live DOM
4. Returns `DiscoveryResult` to the Hub, closes the tab, refocuses the Hub tab

### Phase 102 stabilization vs Phase 103

| Area | Phase 102 | Phase 103 |
|---|---|---|
| Tile open | Adapter registry (`generic`, `htzone`, `practice`) or open-only | **Unified** `executeServiceFromTile` — open first, metadata-driven generic autofill |
| Autofill | `adapterId: generic` for Shufersal/Clalit (interim) | Registry `loginFields` + `loginUrl`; no `generic` adapter |
| Extension policy | `GENERIC_REAL_SITE_ALLOWED_HOSTS` (POC hosts only) | `isAllowedGenericAutofillUrl` — https for internet; http localhost only |
| `login_fields` seed shape | Must not branch tile execution | Same pipeline with or without seeded fields |
| Tile-click discovery | Not on Dashboard (custom add only) | Unchanged — no discovery on tile click (D-103-11) |

### Temporary background tabs

Visible temporary tabs are a **temporary implementation**. They work with today's extension permissions and scripting APIs without extra user setup.

**Production goal:** non-intrusive discovery (background browser, hidden/offscreen document, or future browser APIs) whenever capabilities allow — **without** changing:

- `discoverLogin(primaryUrl)` Hub API
- Discovery engine logic
- `ServiceDefinition` / persistence rules
- Dashboard or Manage Services flows

Swap the active executor via `setDiscoveryExecutor()` when a better strategy is ready.

## Dev-only execution (not production)

The **Discovery Validation Harness** (`#/dev/discovery`) may still use `runLoginDiscoverySession` with fetch/dev-proxy HTML. That path is for developer validation only and is **not** wired into custom service creation.

## Future executors enabled by this architecture

| Executor (future) | Approach |
|-------------------|----------|
| Background browser | Extension service worker fetches/renders without visible tab |
| Hidden / offscreen | Chrome Offscreen Documents or headless tab APIs |
| Native browser APIs | Platform-provided non-intrusive page inspection when available |

Each implements `DiscoveryExecutor`, runs the same `discoverLoginEntry` engine, and is registered as the active executor. No changes to Manage Services, Dashboard, or `ServiceDefinition`.
