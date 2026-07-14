/**
 * Phase 108 — Browser integration abstraction (static).
 *
 * Proves:
 *   - browserIntegration package with host adapter
 *   - extensionBridge delegates to abstraction
 *   - No direct chrome.runtime in Hub feature modules (allowlisted: browserIntegration)
 *   - HUB_LOGIN_ENTRY_DISCOVERY wired in executor + extension
 *   - Graceful degradation probe exists
 *   - Discovery executor timeout / tab-close handling
 *
 * Usage: node scripts/verifyPhase108BrowserIntegration.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function listTsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      listTsFiles(full, acc);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

function relativeFromRoot(absPath) {
  return absPath.replace(root + '\\', '').replace(root + '/', '');
}

function main() {
  const biDir = join(root, 'src/browserIntegration');
  assert(statSync(biDir).isDirectory(), 'src/browserIntegration/ must exist');

  const biIndex = read('src/browserIntegration/index.ts');
  const chromeAdapter = read('src/browserIntegration/chromeHostAdapter.ts');
  assert(
    biIndex.includes('probeExtensionAvailable') &&
      biIndex.includes('sendExtensionMessage') &&
      chromeAdapter.includes('chromeHostAdapter'),
    'browserIntegration must expose probe + messaging + chromeHostAdapter',
  );

  const bridge = read('src/execution/extensionBridge.ts');
  assert(
    bridge.includes("from '../browserIntegration'"),
    'extensionBridge must delegate to browserIntegration abstraction',
  );
  assert(
    !bridge.includes('globalThis') && !bridge.includes('chrome?.runtime'),
    'extensionBridge must not contain direct chrome.runtime access',
  );

  const executor = read('src/discovery/execution/extensionTabDiscoveryExecutor.ts');
  assert(
    executor.includes("from '../../browserIntegration'"),
    'extensionTabDiscoveryExecutor must use browserIntegration',
  );
  assert(
    executor.includes('DISCOVERY_HUB_TIMEOUT_MS'),
    'Discovery executor must enforce Hub-side timeout budget',
  );
  assert(
    !executor.includes('getChromeRuntime'),
    'extensionTabDiscoveryExecutor must not duplicate chrome.runtime helpers',
  );

  const forbiddenDirs = [
    'src/execution',
    'src/discovery',
    'src/catalog',
    'src/admin',
    'src/registry',
  ];

  const chromeRuntimePattern = /\bchrome\.runtime\b/;
  const chromeTabsPattern = /\bchrome\.tabs\b/;

  for (const dir of forbiddenDirs) {
    const absDir = join(root, dir);
    for (const file of listTsFiles(absDir)) {
      const rel = relativeFromRoot(file);
      if (rel.startsWith('src/browserIntegration')) {
        continue;
      }
      const text = readFileSync(file, 'utf8');
      assert(
        !chromeRuntimePattern.test(text),
        `Direct chrome.runtime forbidden outside browserIntegration: ${rel}`,
      );
      assert(
        !chromeTabsPattern.test(text),
        `Direct chrome.tabs forbidden in Hub src: ${rel}`,
      );
    }
  }

  const background = read('extension/background.js');
  assert(
    background.includes('HUB_LOGIN_ENTRY_DISCOVERY'),
    'Extension background must handle HUB_LOGIN_ENTRY_DISCOVERY',
  );
  assert(
    background.includes('closeDiscoveryTabSafely'),
    'Extension must close discovery tabs safely',
  );
  assert(
    background.includes('LOGIN_ENTRY_DISCOVERY_OPERATION_TIMEOUT_MS = 30000'),
    'Extension discovery operation timeout must be 30s (Phase 108)',
  );
  // D-108-32 revised: do not steal OS focus. Inactive tab in Hub window + Hub refocus.
  assert(
    /chrome\.tabs\.create\(\s*\{\s*url:\s*primaryUrl,\s*active:\s*false/.test(background),
    'Discovery must tabs.create(active:false) in Hub window (D-108-32 revised)',
  );
  assert(
    background.includes('function refocusReturnTab') &&
      background.includes('refocusReturnTab(returnTabId)'),
    'Discovery must refocus Hub tab after close',
  );
  assert(
    !/chrome\.windows\.create\s*\(/.test(
      background.slice(
        background.indexOf('function openLoginEntryDiscoveryTab'),
        background.indexOf('function runLoginEntryDiscoveryOnTab'),
      ),
    ),
    'openLoginEntryDiscoveryTab must not use windows.create (focus-steal regression)',
  );
  const loginDiscoveryFn = background.slice(
    background.indexOf('function openLoginEntryDiscoveryTab'),
    background.indexOf('function runLoginEntryDiscoveryOnTab'),
  );
  assert(
    loginDiscoveryFn.length > 100,
    'openLoginEntryDiscoveryTab must be present',
  );
  // Refocus Hub is allowed; discovery tab itself must never be activated mid-session.
  assert(
    !/tabs\.update\s*\(\s*tabId\s*,\s*\{\s*active:\s*true/.test(loginDiscoveryFn) &&
      !/tabs\.update\s*\(\s*resolvedTabId\s*,\s*\{\s*active:\s*true/.test(loginDiscoveryFn) &&
      !/tabs\.update\s*\(\s*discoveryTabId\s*,\s*\{\s*active:\s*true/.test(loginDiscoveryFn),
    'Must never tabs.update(active:true) on the discovery tab itself',
  );

  const dashboard = read('src/Dashboard.tsx');
  assert(
    dashboard.includes('isExtensionAvailable') || dashboard.includes('probeExtensionAvailable'),
    'Hub must probe extension availability for graceful degradation',
  );

  console.log('PASS: Phase 108 browser integration abstraction (static)');
  console.log('  browserIntegration: chromeHostAdapter + probe + async messaging');
  console.log('  extensionBridge: thin delegate shim');
  console.log('  discovery: HUB_LOGIN_ENTRY_DISCOVERY + inactive Hub tab + 30s timeout');
  console.log('');
  console.log('Manual UAT required: Chrome + Edge U1–U6, U16–U18');
}

main();
