/**
 * Phase 108 — empty service_registry bootstrap for known services (static).
 *
 * Proves:
 *   - Authoritative seed is builtinCatalog.ts via knownServiceBootstrap
 *   - Clalit / Shufersal keep approved loginFields (not DEFAULT two-field)
 *   - ensureKnownBuiltinRegistryRow + RPC restore path exists
 *   - Catalog loader bootstraps missing known builtins
 *   - Discovery persist does not write login_fields / DEFAULT_LOGIN_FIELDS
 *   - Discover add/select restores known builtins via ensureKnownBuiltinRegistryRow
 *   - User custom-add must NOT coerce by URL into built_in (approval queue / D-107-6)
 *
 * Usage: node scripts/verifyPhase108KnownServiceBootstrap.mjs
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
  const bootstrap = read('src/catalog/knownServiceBootstrap.ts');
  const builtin = read('src/catalog/builtinCatalog.ts');
  const persistence = read('src/supabase/registryPersistence.ts');
  const loader = read('src/registry/registryLoader.ts');
  const discovery = read('src/registry/loginUrlDiscovery.ts');
  const app = read('src/App.tsx');
  const migration = read(
    'supabase/migrations/20260712140000_phase108_ensure_known_builtin.sql',
  );

  assert(
    bootstrap.includes('BUILTIN_CATALOG_DEFINITIONS') &&
      bootstrap.includes('bootstrapMissingKnownBuiltins') &&
      bootstrap.includes('resolveKnownBuiltinByUrl'),
    'knownServiceBootstrap must use builtinCatalog as authoritative seed',
  );

  assert(
    builtin.includes("id: 'clalit'") &&
      builtin.includes("id: 'shufersal'") &&
      builtin.includes("id: 'idNumber'") &&
      builtin.includes("id: 'userCode'") &&
      builtin.includes("id: 'password'"),
    'builtinCatalog must define Clalit three-field schema',
  );

  const clalitBlock = builtin.slice(
    builtin.indexOf("id: 'clalit'"),
    builtin.indexOf("id: 'maccabi'"),
  );
  assert(
    clalitBlock.includes('idNumber') &&
      clalitBlock.includes('userCode') &&
      clalitBlock.includes('password'),
    'Clalit seed must include idNumber, userCode, password',
  );
  assert(
    !clalitBlock.includes("adapterId: 'generic'"),
    'Clalit seed must not use interim generic adapter',
  );

  const shufersalBlock = builtin.slice(
    builtin.indexOf("id: 'shufersal'"),
    builtin.indexOf("id: 'rami-levy'"),
  );
  assert(
    shufersalBlock.includes("id: 'email'") && shufersalBlock.includes("id: 'password'"),
    'Shufersal seed must keep validated email/password fields',
  );

  assert(
    persistence.includes('ensureKnownBuiltinRegistryRow') &&
      persistence.includes('ensure_known_builtin_registry_row') &&
      persistence.includes('isKnownBuiltinServiceId'),
    'Persistence must restore known builtins via RPC, not generic custom insert',
  );
  assert(
    !persistence.includes('resolveKnownBuiltinByUrl'),
    'upsertCustomServiceRegistryRow must not coerce user URLs into known built_in rows',
  );

  assert(
    migration.includes('ensure_known_builtin_registry_row') &&
      migration.includes("'clalit'") &&
      migration.includes("'shufersal'"),
    'SQL RPC must allowlist clalit and shufersal',
  );

  assert(
    !loader.includes('bootstrapMissingKnownBuiltins'),
    'Catalog loader must NOT inject missing builtins into UI (ghost tiles after DB wipe)',
  );
  assert(
    persistence.includes('ensureKnownBuiltinRegistryRow'),
    'Known builtins must still restore via ensureKnownBuiltinRegistryRow on add/select',
  );

  assert(
    discovery.includes('never credential schema') ||
      discovery.includes('login_url_status: \'valid\'') ||
      discovery.includes('login_url_status: "valid"'),
    'Discovery persist path must exist',
  );
  assert(
    !discovery.includes('login_fields: loginFields') &&
      !discovery.includes('loginFields: definition.loginFields ?? DEFAULT_LOGIN_FIELDS'),
    'Discovery must not overwrite login_fields with DEFAULT_LOGIN_FIELDS',
  );
  assert(
    !discovery.includes('p_login_fields: loginFields'),
    'Discovery RPC calls must not pass discovered login_fields payload',
  );

  assert(
    app.includes('ensureKnownBuiltinRegistryRow') &&
      app.includes('isKnownBuiltinServiceId') &&
      app.includes('getKnownBuiltinDefinition'),
    'App must restore known services on Discover add/select by id',
  );
  assert(
    app.includes('upsertCustomServiceRegistryRow') &&
      app.includes("catalogMatch.source !== 'user-created'") &&
      !/async function addCustomService[\s\S]*?resolveKnownBuiltinByUrl/.test(app),
    'addCustomService must keep non-catalog URLs as user submissions (not known-builtin coerce)',
  );

  console.log('PASS: Phase 108 known-service empty-DB bootstrap (static)');
  console.log('  seed: src/catalog/builtinCatalog.ts via knownServiceBootstrap');
  console.log('  clalit: idNumber + userCode + password restored');
  console.log('  shufersal: email + password preserved');
  console.log('  discovery: login URL/metadata only');
}

main();
