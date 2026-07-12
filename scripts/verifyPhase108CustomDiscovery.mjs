/**
 * Phase 108 — Login Discovery for user custom service creation (static).
 *
 * Proves:
 *   - User custom add and admin create share discoverLoginForRegistryService
 *   - User flow creates service_registry row BEFORE discovery (admin-aligned)
 *   - ManageServices does not run a separate pre-persist discovery path
 *   - No second production discovery pipeline for custom services
 *
 * Usage: node scripts/verifyPhase108CustomDiscovery.mjs
 */
import { readFileSync } from 'node:fs';
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

function main() {
  const app = read('src/App.tsx');
  const manage = read('src/ManageServices.tsx');
  const discovery = read('src/catalog/customServiceDiscovery.ts');
  const adminApi = read('src/admin/adminRegistryApi.ts');
  const persist = read('src/registry/loginUrlDiscovery.ts');

  assert(
    discovery.includes('export async function discoverLoginForRegistryService'),
    'Shared discoverLoginForRegistryService must exist',
  );
  assert(
    discovery.includes('discoverAndPersistLoginUrl'),
    'Shared pipeline must call discoverAndPersistLoginUrl',
  );
  assert(
    discovery.includes('export const discoverLoginForCustomService = discoverLoginForRegistryService'),
    'discoverLoginForCustomService must alias the shared registry pipeline',
  );

  assert(
    adminApi.includes('discoverLoginForRegistryService'),
    'Admin create/rediscovery must use shared discoverLoginForRegistryService',
  );
  assert(
    !adminApi.includes("from '../discovery/execution/discoverLogin'") &&
      !adminApi.includes("from '../discovery/runLoginDiscovery'"),
    'Admin must not call discoverLogin / runLoginDiscoverySession directly',
  );

  assert(
    app.includes('upsertCustomServiceRegistryRow') &&
      app.includes('discoverLoginForRegistryService'),
    'App.addCustomService must upsert registry then run shared discovery',
  );

  const upsertIdx = app.indexOf('await upsertCustomServiceRegistryRow(definition)');
  const discoverIdx = app.indexOf('await discoverLoginForRegistryService(definition');
  assert(upsertIdx !== -1 && discoverIdx !== -1, 'Both upsert and discovery calls must exist in App.tsx');
  assert(
    upsertIdx < discoverIdx,
    'Registry row must be created before Login Discovery (Phase 108 ordering)',
  );

  assert(
    app.includes("source: 'user'") && app.includes('force: true'),
    'User custom discovery must pass source:user and force:true',
  );

  assert(
    !manage.includes('discoverLoginForCustomService') &&
      !manage.includes('discoverLoginForRegistryService'),
    'ManageServices must not run a separate discovery path before onAddCustom',
  );
  assert(
    manage.includes('await onAddCustom(definition)'),
    'ManageServices must delegate create+discovery to App via onAddCustom',
  );

  assert(
    persist.includes('buildDiscoveryMetadataPatch') ||
      read('src/registry/loginDiscoveryMetadata.ts').includes('buildDiscoveryMetadataPatch'),
    'Phase 108 discovery metadata patch helper must exist',
  );

  assert(
    !app.includes('runLoginDiscoverySession') && !manage.includes('runLoginDiscoverySession'),
    'Production custom-service flow must not use the harness runLoginDiscoverySession',
  );

  const override = read('src/registry/loginUrlOverride.ts');
  assert(
    override.includes('isAdminProtectedLoginUrl') &&
      override.includes('shouldSkipAutomatedLoginDiscovery'),
    'Admin override protection helpers must exist',
  );

  const bulk = read('src/registry/bulkLoginUrlRefresh.ts');
  assert(
    bulk.includes('bulkRefreshLoginUrls') &&
      bulk.includes('BULK_REFRESH_CONCURRENCY = 2') &&
      bulk.includes('BULK_REFRESH_INTER_BATCH_DELAY_MS = 500'),
    'Bulk refresh queue must exist with rate-limit constants',
  );
  assert(
    bulk.includes('shouldSkipAutomatedLoginDiscovery'),
    'Bulk refresh must skip admin-protected rows unless forced',
  );

  assert(
    adminApi.includes('adminBulkRefreshLoginUrls'),
    'Admin API must expose bulk refresh',
  );
  assert(
    adminApi.includes('forceAdminOverwrite'),
    'Admin bulk/single discovery must support forceAdminOverwrite',
  );

  const migration = read('supabase/migrations/20260709180000_phase108_login_url_status.sql');
  assert(
    migration.includes("'missing'") && migration.includes("'loginUrlSource', 'admin'"),
    'Phase 108 migration must expand login_url_status and set admin metadata',
  );

  assert(
    !persist.includes('encrypted_credentials') &&
      !bulk.includes('encrypted_credentials') &&
      !discovery.includes('decrypt'),
    'Discovery refresh path must not touch credentials/vault',
  );

  assert(
    persist.includes('persistLoginDiscoveryOutcome') || persist.includes('loginUrlLastCheckedAt'),
    'Discovery persist must record loginUrlLastCheckedAt on every attempt',
  );
  assert(
    read('src/registry/loginDiscoveryMetadata.ts').includes('loginUrlDiscoveryError') &&
      read('src/registry/loginDiscoveryMetadata.ts').includes('normalizeDiscoveryErrorCode') &&
      read('src/registry/loginDiscoveryMetadata.ts').includes('loginUrlDiscoveryOutcome'),
    'Discovery metadata must include outcome fields and normalized error codes',
  );
  assert(
    read('src/registry/registryMapper.ts').includes('loginUrlDiscoveryOutcome'),
    'New registry rows must seed never_run discovery metadata',
  );
  assert(
    read('src/App.tsx').includes('recordLoginDiscoveryPipelineFailure'),
    'Custom add must persist discovery failure outcome without blocking creation',
  );

  console.log('PASS: Phase 108 custom-service Login Discovery shares admin pipeline (create-then-discover).');
  console.log('  bulk refresh + admin override protection + expanded login_url_status');
}

main();
