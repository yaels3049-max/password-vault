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
2. Extension opens a **minimized, unfocused popup window** at `primaryUrl` (`chrome.windows.create`, `focused: false`, `state: 'minimized'`) — **not** a background tab in the Hub window and **not** an off-screen window (Windows clamps those back on-screen) (D-108-32 / AC-108-26)
3. After create, forces `windows.update({ state: 'minimized', focused: false })` again (Windows may briefly raise)
4. After load, injects the bundled discovery engine and runs it on the live DOM
5. Returns `DiscoveryResult` to the Hub and **closes the discovery window** (no Hub tab `active:true` flash)
6. Never activates the discovery tab

### Temporary background tabs

Earlier builds used `tabs.create({ active: false })` in the user's window — that still flashes in the tab strip and is **not** acceptable for Manage «הוסף אתר». Production now uses the silent popup window above.

**Still without** changing:

- `discoverLogin(primaryUrl)` Hub API
- Discovery engine logic / audience gates (D-108-31 freeze)
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
