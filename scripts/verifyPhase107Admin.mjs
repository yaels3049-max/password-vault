/**
 * Phase 107 Admin Management Platform verification (static).
 *
 * Proves:
 *   - Admin modules exist (gate, sections, adminRegistryApi)
 *   - AC-107-7: no encrypted_credentials queries, no vault decrypt, no service_role in client
 *   - Admin route registration + gate
 *   - Migration references is_admin column and is_admin() helper
 *
 * Usage: node scripts/verifyPhase107Admin.mjs
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

function listAdminFiles(dir = 'src/admin') {
  const abs = join(root, dir);
  const entries = readdirSync(abs);
  const files = [];

  for (const entry of entries) {
    const full = join(abs, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listAdminFiles(join(dir, entry)));
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      files.push(join(dir, entry).replace(/\\/g, '/'));
    }
  }

  return files;
}

function main() {
  const adminFiles = listAdminFiles();
  const adminBundle = adminFiles.map((file) => read(file)).join('\n');
  const appTsx = read('src/App.tsx');
  const mainTsx = read('src/main.tsx');
  const migration = read('supabase/migrations/20260709120000_phase107_admin_auth_rls.sql');

  assert(adminFiles.length >= 10, 'src/admin/** modules must exist');
  assert(
    adminFiles.some((f) => f.endsWith('AdminGate.tsx')) &&
      adminFiles.some((f) => f.endsWith('CategoriesAdmin.tsx')) &&
      adminFiles.some((f) => f.endsWith('RegistryAdmin.tsx')) &&
      adminFiles.some((f) => f.endsWith('ApprovalQueue.tsx')) &&
      adminFiles.some((f) => f.endsWith('LoginUrlRefresh.tsx')) &&
      adminFiles.some((f) => f.endsWith('IconMetadataEditor.tsx')) &&
      adminFiles.some((f) => f.endsWith('IntegrationStatusPanel.tsx')) &&
      adminFiles.some((f) => f.endsWith('adminRegistryApi.ts')),
    'AdminGate + M2–M7 section modules + adminRegistryApi must exist',
  );

  // AC-107-7 — credential isolation in admin code paths
  assert(
    !/encrypted_credentials/.test(adminBundle),
    'AC-107-7: admin code must not query encrypted_credentials',
  );
  assert(
    !/from ['"].*vault\/crypto|from ['"].*\/crypto['"]/.test(adminBundle),
    'AC-107-7: admin code must not import vault/crypto decrypt paths',
  );
  assert(
    !/decryptPayload|decrypt\(|createCryptoKey/.test(adminBundle),
    'AC-107-7: admin code must not call decrypt helpers',
  );
  assert(
    !/service_role/.test(adminBundle),
    'AC-107-7: admin client must not reference service_role',
  );
  assert(
    !/VITE_.*SERVICE_ROLE|SERVICE_ROLE/.test(adminBundle) &&
      !/import\.meta\.env[\s\S]*service_role/i.test(adminBundle),
    'AC-107-7: no service_role in client env usage',
  );
  assert(
    !/access_profiles/.test(adminBundle),
    'AC-107-7: admin code must not query access_profiles',
  );

  assert(
    appTsx.includes('isAdminRoute') && mainTsx.includes('isAdminRoute') && mainTsx.includes('AdminApp'),
    'Admin route must register via main.tsx and be referenced from App.tsx',
  );
  assert(
    adminBundle.includes('AdminGate'),
    'Admin shell must use AdminGate',
  );

  assert(
    adminBundle.includes('adminRegistryApi') || read('src/admin/RegistryAdmin.tsx').includes('adminRegistryApi'),
    'Global registry write paths must use adminRegistryApi layer',
  );
  assert(
    !read('src/admin/RegistryAdmin.tsx').includes("from('../supabase/client')") &&
      !read('src/admin/CategoriesAdmin.tsx').includes("from('../supabase/client')"),
    'Section pages must not call Supabase client directly — use adminRegistryApi',
  );

  assert(
    migration.includes('is_admin boolean') && migration.includes('function public.is_admin()'),
    'Phase 107 migration must add users.is_admin and is_admin() helper',
  );
  assert(
    migration.includes('promote_user_submission') && migration.includes('admin_update_login_url'),
    'Phase 107 migration must define admin RPCs',
  );
  assert(
    migration.includes('categories_admin_') && migration.includes('service_registry_admin_'),
    'Phase 107 migration must add admin RLS policies',
  );

  assert(
    read('src/admin/IconMetadataEditor.tsx').includes('faviconSiteUrl') &&
      !read('src/admin/IconMetadataEditor.tsx').includes('storage') &&
      !read('src/admin/IconMetadataEditor.tsx').toLowerCase().includes('upload'),
    'AC-107-5: icon editor is metadata-only (no Storage upload UI)',
  );

  assert(
    !read('src/admin/adminRegistryApi.ts').includes("from '../discovery/execution/discoverLogin'"),
    'Admin API must use shared discoverLoginForRegistryService, not direct discoverLogin',
  );
  assert(
    read('src/admin/adminRegistryApi.ts').includes('discoverLoginForRegistryService') &&
      read('src/admin/adminRegistryApi.ts').includes('createGlobalRegistryRowWithDiscovery') &&
      read('src/admin/adminRegistryApi.ts').includes('promoteUserSubmissionWithDiscovery'),
    'Admin API must use shared Login Discovery on create and promote',
  );
  assert(
    read('src/admin/ApprovalQueue.tsx').includes('promoteUserSubmissionWithDiscovery'),
    'Approval queue must run Login Discovery on promote',
  );
  assert(
    read('src/admin/RegistryAdmin.tsx').includes('ServiceExternalLinks') &&
      read('src/admin/LoginUrlRefresh.tsx').includes('שמור ידנית'),
    'Global catalog must expose manual login URL edit and external links',
  );
  assert(
    read('src/registry/loginUrlDiscovery.ts').includes('buildDiscoveryMetadataPatch'),
    'Shared login discovery must persist Phase 108 metadata',
  );

  console.log('PASS: Phase 107 Admin Management Platform (static)');
  console.log('  admin modules: AdminGate + Categories + Registry + Approval + Login URL + Icon + Status');
  console.log('  AC-107-7: no encrypted_credentials / vault decrypt / service_role in src/admin/**');
  console.log('  migration: is_admin + RLS + promote_user_submission + admin_update_login_url');
  console.log('  AC-107-5: metadata-only icons (Phase 111 Storage deferred)');
  console.log('');
  console.log('Manual UAT (operator):');
  console.log('  T1 non-admin denied at #/admin');
  console.log('  T2 admin gate pass after is_admin bootstrap SQL');
  console.log('  T8–T12 approval queue + login URL refresh + rediscovery');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
