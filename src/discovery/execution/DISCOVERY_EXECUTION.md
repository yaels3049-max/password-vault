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

`ManageServices` and custom service creation call `discoverLoginForCustomService`, which uses `discoverLogin` internally. They never reference extension tabs or fetch proxies.

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

1. Hub sends `HUB_LOGIN_ENTRY_DISCOVERY` to the extension
2. Extension opens a **visible temporary tab** at `primaryUrl`
3. After load, injects the bundled discovery engine and runs it on the live DOM
4. Returns `DiscoveryResult` to the Hub and closes the tab when safe

### Temporary visible tabs

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
