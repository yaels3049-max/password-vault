/**
 * Phase 106 Security and Trust Experience verification (static).
 *
 * Proves:
 *   - Shared trust module / centralized Hebrew strings
 *   - Hub service credential fields: form off; password one-time-code (NOT new-password)
 *   - Unlock Master Password may keep current-password
 *   - No UI-only trust files alter vault/crypto algorithm surface
 *
 * Usage: node scripts/verifyPhase106SecurityTrust.mjs
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
  const trustCopy = read('src/trust/copy.ts');
  const trustIndex = read('src/trust/index.ts');
  const profileModal = read('src/ServiceProfileManagementModal.tsx');
  const credentialModal = read('src/CredentialModal.tsx');
  const unlock = read('src/UnlockScreen.tsx');
  const manage = read('src/ManageServices.tsx');
  const crypto = read('src/vault/crypto.ts');
  const execution = read('src/execution/serviceExecution.ts');
  const trustFiles = [
    trustCopy,
    trustIndex,
    read('src/trust/TrustIndicator.tsx'),
    read('src/trust/VaultStateBadge.tsx'),
    read('src/trust/SecurityExplanationBanner.tsx'),
    read('src/trust/friendlyErrors.ts'),
    read('src/trust/prefs.ts'),
  ].join('\n');

  // M1 — shared trust module
  assert(
    trustCopy.includes('TRUST_COPY') &&
      trustCopy.includes('המידע מוגן בהצפנה') &&
      !trustCopy.includes('המידע שלכם מוגן בהצפנה') &&
      !trustCopy.includes('מוצפן במכשיר'),
    'Trust badge must use standardized security chip copy app-wide',
  );
  assert(
    trustCopy.includes('ידע-אפס') || trustCopy.includes('לא יכול לקרוא'),
    'Zero-Knowledge claim must appear in shared trust copy',
  );
  assert(
    trustIndex.includes('TrustIndicator') && trustIndex.includes('VaultStateBadge'),
    'trust/index must export TrustIndicator and VaultStateBadge',
  );

  const hubCredentialInput = read('src/trust/HubCredentialInput.tsx');

  // M4 — Hub credential editor autocomplete + PM hardening (D-106-5)
  assert(
    profileModal.includes('HubCredentialInput'),
    'ServiceProfileManagementModal must use HubCredentialInput for credential fields',
  );
  assert(
    hubCredentialInput.includes('hubCredentialAssistLevel') &&
      hubCredentialInput.includes("return 'email'") &&
      hubCredentialInput.includes("return 'username'"),
    'Email/username fields must use standard browser autocomplete tokens',
  );
  assert(
    hubCredentialInput.includes('hub-vault-cred-') &&
      hubCredentialInput.includes("fieldType === 'password'"),
    'Password fields must keep non-login name pattern',
  );
  assert(
    hubCredentialInput.includes('isHubCredentialPasswordField') &&
      hubCredentialInput.includes('readOnly: true'),
    'Password fields must use readOnly-until-focus; text fields must not',
  );
  assert(
    hubCredentialInput.includes('hubCredentialInputMode') &&
      hubCredentialInput.includes("'email'"),
    'Email credential fields must use inputMode=email',
  );
  assert(
    !profileModal.includes('data-lpignore="true"') ||
      !/credentialValues[\s\S]*data-lpignore/.test(profileModal),
    'Credential form must not blanket data-lpignore (password fields only via HubCredentialInput)',
  );
  assert(
    profileModal.includes('onClick={() => void handleSaveCredentials()}') &&
      /type="button"[\s\S]{0,120}(?:className="(?:cd-save|modal-btn modal-btn-primary)")/.test(
        profileModal,
      ),
    'Credential save must use type=button onClick (not form submit) to avoid PM save bubble',
  );
  assert(
    hubCredentialInput.includes('one-time-code'),
    'Hub credential password fields must use one-time-code (not new-password — triggers Chrome generator)',
  );
  assert(
    !/return fieldType === 'password' \? 'new-password'/.test(hubCredentialInput),
    'Hub credential password must not use new-password autocomplete (Chrome password generator)',
  );
  assert(
    !/autoComplete=\{\s*field\.type === 'password' \? 'current-password'/.test(profileModal),
    'ServiceProfileManagementModal must not use current-password on Hub credential fields',
  );
  assert(
    !/field\.type === 'password' \? 'current-password' : 'username'/.test(profileModal),
    'ServiceProfileManagementModal must not use username/current-password pair',
  );

  assert(
    credentialModal.includes('HubCredentialInput'),
    'CredentialModal must use HubCredentialInput',
  );
  assert(
    !/current-password' : 'username'|current-password" : "username"/.test(credentialModal),
    'CredentialModal must not use username/current-password on Hub fields',
  );

  // Unlock may keep current-password (Master Password)
  assert(
    unlock.includes('autoComplete="current-password"') ||
      unlock.includes("autoComplete='current-password'"),
    'UnlockScreen Master Password may keep current-password',
  );
  assert(
    trustCopy.includes('מאמתת את זהותכם') &&
      trustCopy.includes('רק אתם יכולים לגשת למידע השמור'),
    'Unlock screen explanatory copy must match approved wording',
  );

  assert(
    read('src/trust/copy.ts').includes("vaultOpen: 'הגישה פתוחה'") &&
      read('src/trust/copy.ts').includes("vaultLockAction: 'נעל'"),
    'Vault state terminology must use access-oriented copy (הגישה פתוחה / נעל)',
  );
  assert(
    !read('src/trust/VaultStateBadge.tsx').includes('נעילה') &&
      read('src/trust/VaultStateBadge.tsx').includes('TRUST_TERMS.vaultLockAction'),
    'VaultStateBadge lock action must use centralized TRUST_TERMS.vaultLockAction',
  );
  const appTsx = read('src/App.tsx');
  assert(
    appTsx.includes('AppVaultShell') &&
      /screen === 'dashboard'[\s\S]*AppVaultShell/.test(appTsx) &&
      /return \([\s\S]*<AppVaultShell[\s\S]*ManageServices/.test(appTsx),
    'App must wrap Digital Home and Service Management in shared AppVaultShell',
  );
  assert(
    read('src/trust/AppVaultShell.tsx').includes('VaultStateBadge'),
    'AppVaultShell must render the shared VaultStateBadge',
  );
  assert(
    profileModal.includes('saveSuccess') || profileModal.includes('TRUST_COPY.saveSuccess') ||
      profileModal.includes('TRUST_COPY.updateSuccess'),
    'Credential save must surface success feedback via TRUST_COPY',
  );
  assert(
    manage.includes('toFriendlySecurityError'),
    'ManageServices must map persist failures to friendly security errors',
  );
  assert(
    profileModal.includes('VaultStateBadge') && profileModal.includes('TrustIndicator'),
    'Credential management modal must show vault state + trust indicator',
  );
  assert(
    !profileModal.includes('trust-zk-line') &&
      !profileModal.includes('cannotReadPasswords') &&
      !profileModal.includes('variant="inline"'),
    'Credential management must not show extra security paragraphs or inline hints',
  );
  assert(
    !credentialModal.includes('trust-zk-line') &&
      !credentialModal.includes('cannotReadPasswords') &&
      !credentialModal.includes('variant="inline"'),
    'CredentialModal must not show extra security paragraphs or inline hints',
  );

  // AC-106-12 — trust UI files must not rewrite crypto algorithms / execution
  assert(
    !/DEFAULT_KDF|encryptPayload|decryptPayload|createCryptoKey/.test(trustFiles),
    'Trust UX modules must not call or redefine crypto primitives',
  );
  assert(
    !trustFiles.includes('executeServiceFromTile'),
    'Trust UX modules must not touch executeServiceFromTile',
  );

  // Snapshot: crypto + execution still present (unchanged architecture surface)
  assert(
    crypto.includes('DEFAULT_KDF') && crypto.includes('encryptPayload'),
    'vault/crypto algorithm surface must remain present',
  );
  assert(
    /export\s+(async\s+)?function\s+executeServiceFromTile/.test(execution),
    'executeServiceFromTile must remain the orchestrator entry',
  );

  // First-time tip prefs (no secrets)
  const prefs = read('src/trust/prefs.ts');
  assert(
    prefs.includes('localStorage') && prefs.includes('firstTimeSecurityTip'),
    'First-time tip dismiss flag must be UI-only localStorage',
  );

  console.log('PASS: Phase 106 Security and Trust (static)');
  console.log('  trust module: TRUST_COPY + TrustIndicator + VaultStateBadge');
  console.log('  Hub credentials: email/username browser assist; password one-time-code hardened');
  console.log('  Unlock Master Password: current-password allowed');
  console.log('  vault control: AppVaultShell on Digital Home + Service Management');
  console.log('  AC-106-12: trust UI does not alter crypto/execution');
  console.log('');
  console.log('Critical UAT gate (manual — Chrome + Edge):');
  console.log('  P1 Chrome — no Save password? on Hub credential save');
  console.log('  P2 Chrome — browser autofill does not clobber Hub fields');
  console.log('  P3 Edge — no save-password UI on Hub credential save');
  console.log('  P4 Edge — browser autofill does not clobber Hub fields');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
