/**
 * Phase 108 M11 — clear-policy + observability contracts (static).
 * Usage: node scripts/verifyPhase108LivePath.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

async function bundle(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'phase108-m11-'));
  const outfile = join(dir, 'bundle.mjs');
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    logLevel: 'silent',
  });
  return {
    mod: await import(pathToFileURL(outfile).href),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const persist = read('src/registry/loginUrlDiscovery.ts');
const meta = read('src/registry/loginDiscoveryMetadata.ts');
const panel = read('src/admin/IntegrationStatusPanel.tsx');
const clearPolicy = read('src/registry/loginUrlClearPolicy.ts');

assert(persist.includes('shouldClearAutoLoginUrlOnDiscoveryReject'), 'M11 clear policy wired');
assert(persist.includes('rawExtensionDiscovery'), 'Raw extension payload persisted');
assert(persist.includes('clearLoginUrl: false'), 'Infra failure must not clear login_url');
assert(meta.includes('rawExtensionDiscovery'), 'Metadata stores rawExtensionDiscovery');
assert(panel.includes('rawExtensionDiscovery'), 'IntegrationStatus shows raw payload');
assert(panel.includes('loginUrlDiscoveryOutcome') || panel.includes('loginUrlDiscoveryOutcome'), 'Outcome visible');
assert(clearPolicy.includes('shouldClearAutoLoginUrlOnDiscoveryReject'), 'Clear policy module');

const clearBundle = await bundle('src/registry/loginUrlClearPolicy.ts');
try {
  const { shouldClearAutoLoginUrlOnDiscoveryReject } = clearBundle.mod;

  // Keep Shufersal seeded URL when rediscovery returns weak modal-only failure
  assert(
    shouldClearAutoLoginUrlOnDiscoveryReject(
      {
        login_url: 'https://www.shufersal.co.il/online/he/login',
        primary_url: 'https://www.shufersal.co.il/',
        metadata: { loginUrlSource: 'auto' },
      },
      {
        success: false,
        primaryUrl: 'https://www.shufersal.co.il/',
        reason: 'Consumer login appears modal-based on the primary site; no dedicated consumer login URL was validated.',
        loginEntryType: 'modal',
        usesModal: true,
      },
    ) === false,
    'Must keep Shufersal consumer URL on weak modal reject',
  );

  // Clear Zap false-positive portal URL
  assert(
    shouldClearAutoLoginUrlOnDiscoveryReject(
      {
        login_url: 'https://sa.zap.co.il/login/index',
        primary_url: 'https://www.zap.co.il/',
        metadata: { loginUrlSource: 'auto' },
      },
      {
        success: false,
        primaryUrl: 'https://www.zap.co.il/',
        rejectedLoginUrl: 'https://sa.zap.co.il/login/index',
        usesModal: true,
        loginEntryType: 'modal',
      },
    ) === true,
    'Must clear sa.zap portal false positive',
  );

  // Never clear admin override
  assert(
    shouldClearAutoLoginUrlOnDiscoveryReject(
      {
        login_url: 'https://sa.zap.co.il/login/index',
        primary_url: 'https://www.zap.co.il/',
        metadata: { loginUrlSource: 'admin' },
      },
      {
        success: false,
        rejectedLoginUrl: 'https://sa.zap.co.il/login/index',
      },
    ) === false,
    'Must never clear admin override',
  );

  console.log('verifyPhase108LivePath: PASS');
} finally {
  clearBundle.cleanup();
}
