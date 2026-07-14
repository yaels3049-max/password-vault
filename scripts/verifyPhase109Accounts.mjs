/**
 * Phase 109 — Account foundation static verify (amended 2026-07-13).
 *
 * Proves:
 *   - Auth entry Login | Create Account present
 *   - Single Digital Home password: Auth + vault unlock in one step (no UnlockScreen door)
 *   - Lock/logout → Login (AC-109-24)
 *   - No dual-door trust copy (“סיסמת מאסטר נפרדת…”)
 *   - Docs: coupling + MFA deferral (not password split)
 *   - requireAuthenticatedUserId; no production anonymous create
 *   - Client register does not set role / is_admin
 *   - D-109-23 userId vault namespace + Discover own customs
 *   - D-109-24 hydrateWorkspaceFromCloud after Login (Chrome↔Edge)
 *
 * Usage: node scripts/verifyPhase109Accounts.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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

function listFiles(dir, pred, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      listFiles(full, pred, acc);
    } else if (pred(entry, full)) {
      acc.push(full);
    }
  }
  return acc;
}

function main() {
  const session = read('src/auth/session.ts');
  assert(
    session.includes('export async function requireAuthenticatedUserId'),
    'requireAuthenticatedUserId must exist in src/auth/session.ts',
  );
  assert(
    !session.includes('signInAnonymously('),
    'src/auth/session.ts must never call signInAnonymously',
  );
  assert(
    session.includes('isAnonymousAuthUser'),
    'requireAuthenticatedUserId must reject anonymous sessions',
  );

  const login = read('src/auth/login.ts');
  assert(login.includes('signInWithPassword'), 'login must use signInWithPassword');
  assert(!login.includes('signUp'), 'login must not signUp / create users');
  assert(!login.includes('signInAnonymously'), 'login must not use anonymous auth');

  const register = read('src/auth/register.ts');
  assert(register.includes('signUp'), 'register must use signUp');
  assert(
    !register.includes("role: '") &&
      !register.includes('role: "') &&
      !register.includes('is_admin:') &&
      !register.includes('isAdmin: true'),
    'register client must not set role / is_admin on write payloads',
  );
  assert(
    !/data:\s*\{[^}]*\brole\b/s.test(register),
    'signUp user metadata must not include role',
  );
  assert(
    register.includes('ensure_app_user_profile'),
    'register must ensure public.users profile via RPC',
  );

  const authEntry = read('src/auth/AuthEntryScreen.tsx');
  assert(
    authEntry.includes('login') && authEntry.includes('register'),
    'AuthEntryScreen must have login and register modes',
  );
  assert(
    authEntry.includes('auth-tab-login') && authEntry.includes('auth-tab-register'),
    'AuthEntryScreen must expose Login | Create Account tabs',
  );
  assert(
    authEntry.includes('firstName') &&
      authEntry.includes('lastName') &&
      authEntry.includes('phone') &&
      authEntry.includes('passwordConfirm'),
    'Registration must collect first/last/email/phone/password/confirm fields',
  );
  assert(
    authEntry.includes('onAuthenticated') && authEntry.includes('password'),
    'AuthEntry must pass password to parent for same-step vault unlock',
  );
  assert(
    !authEntry.includes('מאסטר נפרדת') && !authEntry.includes('סיסמת המאסטר'),
    'AuthEntry must not claim a separate Master Password',
  );

  const authCopy = read('src/auth/copy.ts');
  assert(
    !authCopy.includes('מאסטר נפרדת') && !authCopy.includes('סיסמת המאסטר של הכספת נפרדת'),
    'AUTH_COPY must not include dual-door Master Password claims',
  );
  assert(
    authCopy.includes('סיסמה אחת') || authCopy.includes('סיסמת הבית הדיגיטלי'),
    'AUTH_COPY must describe single Digital Home password',
  );

  const app = read('src/App.tsx');
  assert(app.includes('AuthEntryScreen'), 'App must gate on AuthEntryScreen');
  assert(!app.includes('UnlockScreen'), 'App must not route through UnlockScreen (second door)');
  assert(
    app.includes('unlockVault') && app.includes('handleAuthenticated'),
    'App must unlock/create vault inside Auth success path',
  );
  assert(
    app.includes('clearWorkspaceMemory') &&
      /unlockVault\([^)]+,\s*profile\.id\)/.test(app),
    'App must clear prior workspace and unlock vault for profile.id namespace',
  );
  assert(
    app.includes('hydrateWorkspaceFromCloud') &&
      /hydrateWorkspaceFromCloud\s*\(/.test(app) &&
      app.includes('handleAuthenticated'),
    'App must call hydrateWorkspaceFromCloud after Login before paint (D-109-24)',
  );
  assert(
    /hydrateWorkspaceFromCloud[\s\S]*persistVault|persistVault\(hydrated/.test(app),
    'App must persist hydrated state into this browser vault before paint',
  );
  assert(
    app.includes('handleLockVault') && app.includes('handleLogout'),
    'App must support lock and logout',
  );
  // Lock must perform full logout (signOut), not vault-only mid-state
  assert(
    /function handleLockVault[\s\S]*handleLogout|handleLockVault\(\)\s*\{\s*void handleLogout/.test(
      app,
    ) || (app.includes('function handleLockVault') && app.includes('signOutAccount')),
    'Vault lock must full-logout to Login (AC-109-24)',
  );
  assert(
    app.includes('countUserServices'),
    'App must route using user_services preference helper',
  );

  assert(
    !existsSync(join(root, 'src/UnlockScreen.tsx')),
    'UnlockScreen.tsx must be removed (no second door)',
  );

  // --- D-109-22 Admin Login on #/admin ---
  const adminGate = read('src/admin/AdminGate.tsx');
  assert(
    adminGate.includes('need_login') && adminGate.includes('AuthEntryScreen'),
    'AdminGate must show Auth Login when unauthenticated (D-109-22)',
  );
  assert(
    adminGate.includes('loginOnly') || adminGate.includes('AuthEntryScreen'),
    'AdminGate must reuse Auth Login',
  );
  assert(
    adminGate.includes('data-testid="admin-gate-login"'),
    'AdminGate login state must be observable',
  );
  assert(
    adminGate.includes('evaluateAccess') || adminGate.includes('resolveAdminAccess'),
    'AdminGate must re-check admin after login',
  );
  // Must not be deny-only for unauthenticated (old path)
  assert(
    !/if \(access\.error && !access\.userId\)[\s\S]*setGateState\('denied'\)/.test(adminGate),
    'AdminGate must not deny-only when unauthenticated',
  );

  const adminAuth = read('src/admin/adminAuth.ts');
  assert(
    adminAuth.includes('unauthenticated') && adminAuth.includes('AdminAccessStatus'),
    'adminAuth must distinguish unauthenticated vs not_admin',
  );

  const adminRoutes = read('src/admin/adminRoutes.ts');
  assert(
    adminRoutes.includes('#/admin') && adminRoutes.includes('/admin'),
    'Admin routes must support #/admin and /admin',
  );

  // --- D-109-23 userId-scoped vault + Discover ---
  const vaultDb = read('src/vault/db.ts');
  assert(
    vaultDb.includes('vaultStorageIdForUser') && vaultDb.includes('user:'),
    'Vault IndexedDB must namespace records by userId',
  );
  assert(
    vaultDb.includes('getVault(userId') || /getVault\(\s*userId/.test(vaultDb),
    'getVault must require userId',
  );

  const vaultApi = read('src/vault/vault.ts');
  assert(
    /unlockVault\(\s*masterPassword:\s*string,\s*userId:\s*string/.test(vaultApi) ||
      /unlockVault\([\s\S]*userId/.test(vaultApi),
    'unlockVault must take userId for namespace',
  );
  assert(
    vaultApi.includes('lockVault()') && vaultApi.includes('activeVaultUserId'),
    'Vault must track active user namespace and clear on lock',
  );

  const registryLoader = read('src/registry/registryLoader.ts');
  assert(
    registryLoader.includes('isCatalogVisibleRegistryRow'),
    'Discover visibility helper must exist',
  );
  assert(
    registryLoader.includes("source_type === 'user'") ||
      registryLoader.includes('source_type === "user"'),
    'Discover must restrict private rows to source_type=user',
  );
  assert(
    registryLoader.includes('built_in') &&
      registryLoader.includes('approved_global') &&
      registryLoader.includes('admin'),
    'Discover globals must include built_in, admin, approved_global',
  );

  // --- D-109-24 cross-browser hydrate ---
  const persistence = read('src/supabase/persistence.ts');
  const cryptoSrc = read('src/vault/crypto.ts');
  assert(
    persistence.includes('export async function hydrateWorkspaceFromCloud'),
    'hydrateWorkspaceFromCloud must exist in persistence layer',
  );
  assert(
    persistence.includes('user_services') &&
      persistence.includes('access_profiles') &&
      persistence.includes('encrypted_credentials') &&
      persistence.includes("source_type', 'user'"),
    'hydrate must load user_services, access profiles, encrypted_credentials, owned customs',
  );
  assert(
    persistence.includes('decryptCredentialSetWithKeys') ||
      persistence.includes('decryptCredentialSet'),
    'hydrate must decrypt credentials client-side (ZK)',
  );
  assert(
    cryptoSrc.includes('deriveCloudCredentialKey'),
    'deriveCloudCredentialKey must exist for cross-browser credential decrypt',
  );
  assert(
    !/from\('encrypted_credentials'\)[\s\S]{0,200}\.insert\([^)]*password/i.test(persistence),
    'hydrate must not insert plaintext password fields into encrypted_credentials',
  );
  assert(
    persistence.includes('Never send plaintext') ||
      persistence.includes('never sends plaintext') ||
      persistence.includes('Never sends plaintext') ||
      /NEVER send plaintext/i.test(persistence) ||
      persistence.includes('do not upload plaintext'),
    'hydrate must document ZK (no plaintext to server)',
  );

  assert(
    cryptoSrc.includes('export async function decryptCredentialSet'),
    'decryptCredentialSet must exist for ZK hydrate',
  );

  assert(
    vaultApi.includes('fetchVaultKdf') || persistence.includes('fetchVaultKdf'),
    'Cross-browser hydrate requires vault_kdf fetch for key parity',
  );
  assert(
    persistence.includes('ensureVaultKdfSeeded') || persistence.includes('vault_kdf'),
    'vault_kdf must be seeded for Chrome↔Edge credential decrypt',
  );

  // --- D-109-25 workspace durability / anti-wipe ---
  assert(
    persistence.includes('D-109-25') || persistence.includes('Anti-wipe') || /anti-wipe|AC-109-39/i.test(persistence),
    'persistence must document anti-wipe / D-109-25',
  );
  assert(
    persistence.includes('deleteCloudEncryptedCredentialByLocalProfileId'),
    'Explicit cloud credential delete API required (not via sync omission)',
  );
  assert(
    persistence.includes('removeUserServiceFromCloud'),
    'Explicit cloud remove-service API required (not via sync omission)',
  );
  // syncVaultStateToSupabase body must not delete encrypted_credentials on missing values
  const syncFnMatch = persistence.match(
    /export async function syncVaultStateToSupabase[\s\S]*?^export async function syncVaultStateToSupabaseSafe/m,
  );
  const syncBody = syncFnMatch?.[0] ?? '';
  assert(
    syncBody.length > 0,
    'Could not locate syncVaultStateToSupabase for anti-wipe assert',
  );
  assert(
    !/\.from\(['"]encrypted_credentials['"]\)\s*\.delete\(/.test(syncBody) &&
      !syncBody.includes('deleteEncryptedCredential('),
    'syncVaultStateToSupabase must not delete encrypted_credentials (D-109-25)',
  );
  assert(
    !/\.from\(['"]user_services['"]\)\s*\.delete\(/.test(syncBody),
    'syncVaultStateToSupabase must not delete user_services (D-109-25)',
  );
  assert(
    persistence.includes('keepLocalMembership') ||
      /empty cloud must not|empty-win|keep local membership/i.test(persistence),
    'hydrate must not empty-win over non-empty local membership',
  );

  const appSrc = read('src/App.tsx');
  assert(
    appSrc.includes('removeUserServiceFromCloud'),
    'App must call removeUserServiceFromCloud on explicit remove-service',
  );

  const manageSrc = read('src/ManageServices.tsx');
  assert(
    manageSrc.includes('deleteCloudEncryptedCredentialByLocalProfileId'),
    'ManageServices must delete cloud ciphertext only on explicit credential delete',
  );

  const vaultKdfMigration = listFiles(join(root, 'supabase/migrations'), (name) =>
    name.includes('vault_kdf'),
  );
  assert(vaultKdfMigration.length >= 1, 'Migration must add users.vault_kdf for cross-browser key parity');


  // Dual-door ban across Hub source (allow doc comments that say "no dual-door")
  const hubFiles = listFiles(join(root, 'src'), (name) => name.endsWith('.ts') || name.endsWith('.tsx'));
  const dualDoor = [];
  const offenders = [];
  for (const file of hubFiles) {
    const rel = relative(root, file).replace(/\\/g, '/');
    const text = readFileSync(file, 'utf8');
    if (text.includes('סיסמת המאסטר נפרדת') || text.includes('מאסטר נפרדת')) {
      dualDoor.push(rel);
    }
    if (text.includes('signInAnonymously(')) {
      offenders.push(`${rel}: signInAnonymously(`);
    }
    if (text.includes('ensureAnonymousUserId')) {
      if (
        /import\s*\{[^}]*ensureAnonymousUserId/.test(text) ||
        /ensureAnonymousUserId\s*\(/.test(text) ||
        /export\s+async\s+function\s+ensureAnonymousUserId/.test(text)
      ) {
        offenders.push(`${rel}: ensureAnonymousUserId`);
      }
    }
  }
  assert(dualDoor.length === 0, `Dual-door Master Password copy forbidden:\n${dualDoor.join('\n')}`);
  assert(
    offenders.length === 0,
    `Production Hub must not call anonymous ensure/sign-in:\n${offenders.join('\n')}`,
  );

  const migration = read('docs/MIGRATION_PHASE_109.md');
  assert(
    /Single Digital Home password/i.test(migration) || /סיסמת הבית הדיגיטלי/.test(migration),
    'MIGRATION_PHASE_109.md must document single Digital Home password',
  );
  assert(
    /Phase 191/i.test(migration) && /MFA/i.test(migration),
    'Migration doc must defer MFA to Phase 191',
  );
  assert(
    !/Account password ≠ Master Password/i.test(migration),
    'Migration doc must not claim Account ≠ Master Password split',
  );
  assert(
    /lock/i.test(migration) && /Login/i.test(migration),
    'Migration doc must document lock → Login',
  );
  assert(
    migration.includes('#/admin') &&
      (/one SPA/i.test(migration) || /One SPA/i.test(migration) || migration.includes('אותו')),
    'Migration doc must document one SPA deploy + #/admin bookmark (D-109-22)',
  );
  assert(
    /Admin Login|Login.*#\/admin|unauthenticated/i.test(migration),
    'Migration doc must describe Admin Login when unauthenticated',
  );
  assert(
    /user:<|userId|workspace isolation|D-109-23/i.test(migration),
    'Migration doc must document userId-scoped vault / workspace isolation',
  );
  assert(
    /hydrateWorkspaceFromCloud|D-109-24|AC-109-38|Chrome.*Edge/i.test(migration),
    'Migration doc must document cross-browser hydrate (D-109-24 / AC-109-38)',
  );
  assert(
    /D-109-25|AC-109-39|anti-wipe|durability/i.test(migration),
    'Migration doc must document workspace durability / anti-wipe (D-109-25)',
  );
  assert(
    migration.includes('development') || migration.includes('פיתוח'),
    'Migration doc must mention development password policy isolation',
  );
  assert(
    migration.includes('audit') || migration.includes('Audit') || migration.includes('בדיקה'),
    'Migration doc must cover unintended-user audit/cleanup',
  );

  const policy = read('src/auth/passwordPolicy.ts');
  assert(
    policy.includes('isDevBuild') && policy.includes('isDevelopmentPolicy'),
    'Account password policy must isolate development config',
  );

  const migrations = listFiles(join(root, 'supabase/migrations'), (name) =>
    name.includes('phase109'),
  );
  assert(migrations.length >= 1, 'Phase 109 migration file must exist');
  const migTexts = migrations.map((m) => readFileSync(m, 'utf8')).join('\n');
  assert(migTexts.includes('email_normalized'), 'Migration must add email_normalized');
  assert(
    migTexts.includes('users_role_check') || migTexts.includes("role in ('user'"),
    'Migration must constrain role',
  );
  assert(migTexts.includes('ensure_app_user_profile'), 'Migration must provide profile RPC');
  assert(
    migTexts.includes('users_protect_privileged') || migTexts.includes('protect_privileged'),
    'Migration must protect role/is_admin from client escalation',
  );
  assert(
    migTexts.includes('user_number') && migTexts.includes('100'),
    'Migration must add human-friendly user_number starting at 100',
  );

  assert(
    existsSync(join(root, 'scripts/sql/phase109_audit_unintended_users.sql')),
    'Audit SQL script required (AC-109-28)',
  );
  assert(
    existsSync(join(root, 'scripts/sql/phase109_cleanup_empty_orphans.sql')),
    'Empty-only cleanup SQL script required (AC-109-29)',
  );

  console.log('verifyPhase109Accounts: PASS');
  console.log(
    'Single password; lock=logout; Admin Login; userId vault; Discover; hydrateWorkspaceFromCloud; MFA deferred',
  );
}

main();
