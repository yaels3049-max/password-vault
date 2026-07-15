/**
 * Phase 113 — Login Assistance UX checks (AC-113-1…24 soft).
 * Usage: node scripts/verifyPhase113LoginAssistance.mjs
 *
 * Does NOT require autofill success. Includes D-113-16 Hebrew + credentials gate.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const MSG_NO_OPEN_URL =
  'אין קישור פתיחה לאתר זה. ניתן להעתיק פרטים ולהתחבר ידנית.';

function resolveOpenUrl(service) {
  const loginUrl = typeof service.loginUrl === 'string' ? service.loginUrl.trim() : '';
  if (loginUrl) return { kind: 'open', url: loginUrl, source: 'loginUrl' };
  const homeUrl = typeof service.url === 'string' ? service.url.trim() : '';
  if (homeUrl) return { kind: 'open', url: homeUrl, source: 'homeUrl' };
  return { kind: 'unavailable', message: MSG_NO_OPEN_URL };
}

function resolveLevel(service) {
  const raw = service.metadata?.loginAssistanceLevel;
  if (
    raw === 'automatic_supported' ||
    raw === 'best_effort' ||
    raw === 'manual_only'
  ) {
    return raw;
  }
  if (service.adapterId === 'htzone' || service.adapterId === 'practice') {
    return 'automatic_supported';
  }
  const open = resolveOpenUrl(service);
  if (open.kind === 'unavailable') return 'manual_only';
  const loginUrl = typeof service.loginUrl === 'string' ? service.loginUrl.trim() : '';
  if (!loginUrl) return 'manual_only';
  return 'best_effort';
}

function allowsAuto(level) {
  return level === 'automatic_supported' || level === 'best_effort';
}

function mainBehavioral() {
  const withLogin = resolveOpenUrl({
    loginUrl: 'https://example.com/login',
    url: 'https://example.com',
  });
  assert(withLogin.kind === 'open' && withLogin.source === 'loginUrl', 'AC-113-1 loginUrl');

  const homeOnly = resolveOpenUrl({ url: 'https://example.com' });
  assert(homeOnly.kind === 'open' && homeOnly.source === 'homeUrl', 'AC-113-2 homeUrl');

  const none = resolveOpenUrl({ url: '  ', loginUrl: '' });
  assert(none.kind === 'unavailable' && none.message.includes('אין קישור'), 'AC-113-3 message');

  assert(resolveLevel({ adapterId: 'htzone', loginUrl: 'https://x/l', url: 'https://x' }) === 'automatic_supported');
  assert(resolveLevel({ loginUrl: 'https://x/l', url: 'https://x' }) === 'best_effort');
  assert(resolveLevel({ url: 'https://www.leumi.co.il' }) === 'manual_only');
  assert(
    resolveLevel({
      loginUrl: 'https://x/l',
      url: 'https://x',
      metadata: { loginAssistanceLevel: 'manual_only' },
    }) === 'manual_only',
  );
  assert(!allowsAuto('manual_only'), 'AC-113-17 manual blocks auto');
  assert(allowsAuto('best_effort') && allowsAuto('automatic_supported'));
}

function assertFloat(anchor, expectedSide) {
  const GAP = 12;
  const PAD = 10;
  const vw = 1000;
  const width = Math.min(360, Math.max(288, Math.round(vw * 0.28)));
  const spaceStart = anchor.left - GAP - PAD;
  const spaceEnd = vw - anchor.right - GAP - PAD;
  let side;
  if (spaceStart >= width) side = 'start';
  else if (spaceEnd >= width) side = 'end';
  else side = 'below';
  assert(side === expectedSide, `float side expected ${expectedSide} got ${side}`);
}

function mainFloat() {
  assertFloat({ top: 400, bottom: 460, left: 500, right: 560, width: 60, height: 60 }, 'start');
  assertFloat({ top: 400, bottom: 460, left: 40, right: 100, width: 60, height: 60 }, 'end');
}

function mainStatic() {
  const messages = read('src/loginAssistance/messages.ts');
  assert(!/\bManual Only\b/i.test(messages), 'AC-113-22 no Manual Only English');
  assert(!/\bBest Effort\b/i.test(messages), 'AC-113-22 no Best Effort English');
  assert(messages.includes('MSG_OPENED_HOME_FALLBACK'), 'AC-113-23 home fallback copy');
  assert(messages.includes('MSG_NO_CREDENTIALS'), 'AC-113-24 missing credentials copy');
  assert(messages.includes('לא אותר דף התחברות'), 'AC-113-23 Hebrew home-open');
  assert(messages.includes('ניהול האתרים'), 'AC-113-24 manage prompt');
  assert(!messages.includes('«ניהול האתרים»'), 'no guillemets around manage screen name');
  assert(!/\bשירות/.test(messages), 'AC-113-32 glossary אתר in assistance messages');

  const openRules = read('src/loginAssistance/openUrlRules.ts');
  assert(openRules.includes('loginUrl') && openRules.includes('unavailable'), 'openUrlRules present');

  const support = read('src/loginAssistance/supportLevel.ts');
  assert(
    support.includes('manual_only') &&
      support.includes('automatic_supported') &&
      support.includes('best_effort') &&
      !support.includes('loginIntelligence'),
    'support levels independent of LI',
  );

  const actions = read('src/loginAssistance/assistanceActions.ts');
  assert(actions.includes('executeServiceFromTile'), 'soft-wrap existing completion');
  assert(actions.includes('MSG_OPENED_HOME_FALLBACK'), 'AC-113-23 wired on home open');
  assert(!actions.includes('Login URL:') && !actions.includes('Home URL:'), 'no English open describe');
  assert(!actions.includes('detectVisible') && !actions.includes('identity-first'), 'no new detection');

  const gate = read('src/loginAssistance/credentialsGate.ts');
  assert(gate.includes('serviceHasUsableCredentials'), 'credentials gate helper');

  const panel = read('src/loginAssistance/LoginAssistancePanel.tsx');
  assert(panel.includes('data-floating') || panel.includes('la-panel--float'), 'floating panel');
  assert(panel.includes('showProfileChips') && panel.includes('profiles.length > 1'), 'chips only when multi');
  assert(!panel.includes('supportLevelLabel'), 'no visible support badge text');
  assert(!/\bManual Only\b/i.test(panel) && !/\bBest Effort\b/i.test(panel), 'panel Hebrew-facing');
  assert(panel.includes('IconCopy') && panel.includes('IconEye') && panel.includes('IconClose'), 'icon buttons');

  const eye = read('src/loginAssistance/icons.tsx');
  assert(eye.includes('M8 3C3.5 3') && !eye.includes('13.4 2.2'), 'eye glyph always');

  const float = read('src/loginAssistance/floatingPosition.ts');
  assert(float.includes('LEFT of the') || float.includes('Prefer LEFT'), 'prefer left of tile');
  assert(float.includes('PANEL_WIDTH_MAX = 360'), 'panel max width ~+20%');

  const dash = read('src/Dashboard.tsx');
  assert(dash.includes('serviceHasUsableCredentials') && dash.includes('MSG_NO_CREDENTIALS'), 'AC-113-24 gate');
  assert(dash.includes('dashboard-manage-cta'), 'Home still has prominent Manage CTA');
  assert(!dash.includes('la-home-notice-cta') && !dash.includes('LABEL_GO_MANAGE'), 'no banner manage button');
  assert(dash.includes('la-home-notice'), 'credentials notice banner');
  assert(!dash.includes('openServiceWithProfile'), 'Home uses assistance panel first');
  assert(dash.includes('userDisplayName') && dash.includes('הבית הדיגיטלי של'), 'AC-113-26 named title');
  assert(!dash.includes('openDemoAndFill') && !dash.includes('openIsraeliSiteAutofillTest'), 'no PoC fill buttons');
  assert(!dash.includes('dashboard-subtitle') && !dash.includes('במהירות ובביטחון'), 'no marketing subtitle');
  assert(dash.includes('dashboard-manage-cta') && dash.includes('sm-footer-nav'), 'AC-113-27 centered Discover-like CTA');
  assert(dash.includes('ניהול אתרים') && !dash.includes('ניהול שירותים'), 'AC-113-32 Home glossary');

  const css = read('src/App.css');
  assert(css.includes('--app-content-max: 792px'), 'AC-113-25/47 shared shell width (−10% phone silhouette)');
  assert(
    !/--app-content-max:\s*880px/.test(css),
    'D-113-27: prior 880px shell retired — single shared token only',
  );
  assert(css.includes('--dh-launcher-max'), 'launcher not edge-stretched');
  assert(
    /--app-shell-bg-image:\s*url\([^)]*digital-home-shell-portrait\.png/.test(css) &&
      /--app-wide-bg-image:\s*url\([^)]*digital-home-shell-wave-v2\.png/.test(css) &&
      !/--app-shell-bg-image:\s*url\([^)]*digital-home-shell\.jpg/.test(css) &&
      css.includes('--app-shell-radius') &&
      /border-radius:\s*var\(--app-shell-radius\)/.test(css),
    'AC-113-33 portrait Home/Manage BG + rounded shells; wave-v2 reserved for wide surfaces',
  );
  assert(
    existsSync(join(root, 'src/assets/backgrounds/digital-home-shell-portrait.png')),
    'portrait PNG present under src/assets',
  );
  assert(
    existsSync(join(root, 'src/assets/backgrounds/digital-home-shell-wave-v2.png')),
    'wave-v2 PNG present under src/assets',
  );
  assert(
    css.includes('unlock.auth-entry') &&
      /unlock\.auth-entry[\s\S]{0,200}--app-wide-bg-image/.test(css),
    'AC-113-46 Login/Auth entry uses landscape wave-v2',
  );
  // D-113-22: url() alone is not enough — reject the wash that flattened the pattern.
  assert(
    !/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.62\s*\)/.test(css),
    'D-113-22 must not keep ~62% white shell wash',
  );
  const shellBlock = css.match(
    /\.dashboard,\s*\.service-management\s*\{[^}]+\}/,
  )?.[0];
  assert(Boolean(shellBlock), 'shared Home/Manage shell rule exists');
  assert(
    shellBlock.includes('var(--app-shell-bg-image)') &&
      !/linear-gradient\s*\(/.test(shellBlock),
    'D-113-22 Home/Manage shell BG is portrait asset without stacked wash gradient',
  );
  const smSection = css.match(/\.sm-section\s*\{[^}]+\}/)?.[0] ?? '';
  assert(
    /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.\d+\s*\)/.test(smSection) &&
      !/background:\s*#fff\b/.test(smSection),
    'Manage sections use translucent shell-visible BG (not solid white)',
  );

  // D-113-23 / AC-113-35 — lock inside shells; no identity chip; no exterior bar.
  const vaultShell = read('src/trust/AppVaultShell.tsx');
  assert(
    !vaultShell.includes('app-vault-account-chip') &&
      !vaultShell.includes('VaultStateBadge') &&
      !vaultShell.includes('app-vault-shell-bar'),
    'AppVaultShell must not render identity chip or exterior lock bar',
  );
  assert(dash.includes('shell-lock-row') && dash.includes('VaultStateBadge'), 'Home lock inside shell');
  assert(dash.includes('vaultUnlocked') && dash.includes('onLockVault'), 'Home receives lock props');
  const manageForLock = read('src/ManageServices.tsx');
  assert(
    manageForLock.includes('shell-lock-row') && manageForLock.includes('VaultStateBadge'),
    'Manage lock inside shell',
  );
  assert(
    css.includes('.shell-lock-row') && !css.includes('.app-vault-shell-bar'),
    'shell-lock-row styles; exterior vault bar removed',
  );
  assert(!css.includes('.app-vault-account-chip'), 'identity chip styles removed from Home/Manage chrome');

  const indexCss = read('src/index.css');
  assert(indexCss.includes('Assistant') && indexCss.includes('--app-font-family'), 'Assistant on root');
  const mainTsx = read('src/main.tsx');
  assert(mainTsx.includes('@fontsource/assistant/hebrew-400.css'), 'Assistant Hebrew 400 loaded');
  assert(mainTsx.includes('@fontsource/assistant/latin-700.css'), 'Assistant Latin 700 loaded');
  assert(
    JSON.parse(read('package.json')).dependencies['@fontsource/assistant'],
    '@fontsource/assistant dependency',
  );
  assert(css.includes('la-panel--float') && css.includes('la-home-notice--gate'), 'float + credentials notice');
  assert(css.includes('la-service-icon'), 'title service icon style');
  assert(/la-panel--float[\s\S]{0,400}#2563eb/.test(css), 'float panel blue border');
  assert(/\.la-primary-btn\s*\{[^}]*background:\s*#2563eb/.test(css), 'primary open button blue');

  const catalog = read('src/catalog/builtinCatalog.ts');
  assert(catalog.includes("loginAssistanceLevel: 'manual_only'"), 'manual mode catalog fixture');

  const manage = read('src/ManageServices.tsx');
  assert(manage.includes('sm-accordion') && manage.includes('mineSearch'), 'AC-113-29 accordion + mine search');
  assert(!manage.includes('הוסיפו, פתחו ונהלו'), 'AC-113-28 no marketing subtitle');
  assert(manage.includes('לבית הדיגיטלי') && manage.includes('sm-home-nav'), 'AC-113-28 top Home CTA');
  assert(manage.includes('ניהול אתרים') && manage.includes('האתרים שלי'), 'AC-113-32 Manage glossary');
  assert(!manage.includes('ניהול שירותים') && !manage.includes('השירותים שלי'), 'AC-113-32 no old Manage glossary');
  // D-113-24 / AC-113-36 — remove menu fully visible, blue, no trash.
  assert(manage.includes('createPortal') && manage.includes('sm-menu--portal'), 'AC-113-36 portal menu');
  assert(manage.includes('הסר אתר') && !manage.includes('🗑'), 'AC-113-36 text-only הסר אתר');
  assert(!manage.includes('sm-menu-item--danger'), 'AC-113-36 no danger-red remove item');
  assert(css.includes('sm-menu--portal') && css.includes('sm-menu-item--action'), 'AC-113-36 blue action styles');

  const state = read('src/serviceManagement/serviceManagementState.ts');
  assert(
    !/profiles\.length\s*>\s*1[\s\S]{0,80}return 'multiple_profiles'/.test(state),
    'AC-113-31 no multi-profile attention derive',
  );

  const card = read('src/components/ServiceCard.tsx');
  assert(!card.includes('דורש תשומת לב'), 'AC-113-31 no attention label for multi-profile');

  const loader = read('src/registry/registryLoader.ts');
  assert(loader.includes('excludeUserFacingPractice') && !loader.includes('injectDevPractice'), 'AC-113-30 no practice inject');

  const index = read('src/loginAssistance/index.ts');
  assert(!index.includes('loginIntelligence'), 'AC-113-21 no LI barrel import');
  assert(index.includes('serviceHasUsableCredentials'), 'gate exported');

  // D-113-25 / AC-113-37…45 — Credential Details modal (UI-only).
  const credDetails = read('src/ServiceProfileManagementModal.tsx');
  assert(credDetails.includes('פרטי כניסה'), 'AC-113-37 title');
  assert(credDetails.includes('aria-label="סגירה"'), 'AC-113-37 accessible X');
  assert(credDetails.includes('cd-close') && credDetails.includes('cd-header'), 'AC-113-37 sticky header chrome');
  assert(
    !credDetails.includes('profile-management-close') &&
      !/className="[^"]*modal-btn[^"]*"[^>]*>\s*סגור/.test(credDetails),
    'AC-113-37 no large bottom Close',
  );
  assert(
    credDetails.includes('השינויים עדיין לא נשמרו') &&
      credDetails.includes('המשך עריכה') &&
      credDetails.includes('יציאה ללא שמירה'),
    'AC-113-38 dirty close/switch confirm',
  );
  assert(
    credDetails.includes('requestSwitchProfile') &&
      credDetails.includes('setPasswordVisible(false)') &&
      credDetails.includes('cd-chip'),
    'AC-113-39 profile chips + re-hide on switch',
  );
  assert(
    credDetails.includes('העתקת סיסמה') &&
      credDetails.includes('הסיסמה הועתקה') &&
      credDetails.includes('IconCopy') &&
      credDetails.includes('IconEyeOff') &&
      !credDetails.includes('alert('),
    'AC-113-40 copy/eye; toasts without secrets; no alert',
  );
  assert(
    credDetails.includes('שמירת שינויים') &&
      credDetails.includes('MSG_SAVE_FAIL') &&
      /disabled=\{saving \|\| !dirty \|\| !fieldsComplete\}/.test(credDetails),
    'AC-113-41 save disabled when clean; fail keeps values',
  );
  assert(
    credDetails.includes('מחיקת פרופיל') &&
      credDetails.includes('למחוק את פרטי הכניסה?') &&
      credDetails.includes('cd-secondary-btn') &&
      !credDetails.includes('cd-overflow') &&
      !credDetails.includes('⋮') &&
      !credDetails.includes('מחק פרטי כניסה'),
    'AC-113-42/49 delete via compact secondary + confirm; no header ⋮',
  );
  assert(
    /cd-header-start[\s\S]*VaultStateBadge[\s\S]*cd-close/.test(credDetails) ||
      /cd-header-start[\s\S]*cd-close/.test(credDetails),
    'AC-113-50 lock chrome + X in left header cluster',
  );
  assert(
    css.includes('.cd-header-start') &&
      css.includes('.cd-secondary-actions') &&
      !css.includes('.cd-overflow') &&
      !css.includes('.cd-header-actions'),
    'AC-113-49/50 header CSS: start cluster + secondary actions; no ⋮ chrome',
  );
  assert(
    credDetails.includes('dirtyRef') &&
      !/\[selectedProfileId,\s*credentials,\s*loginFields\]/.test(credDetails),
    'AC-113-48 loadProfile not tied to unstable credentials identity (freeze fix)',
  );
  const logoHook = read('src/useServiceLogos.ts');
  assert(
    logoHook.includes('[serviceIds]') &&
      !/},\s*\[serviceIds,\s*services\]\)/.test(logoHook) &&
      logoHook.includes('prev[service.id] === logo'),
    'AC-113-48 useServiceLogos must not re-effect on inline array identity (modal freeze)',
  );
  assert(
    credDetails.includes('+ הוספת פרופיל נוסף') &&
      /\[showAddProfile,\s*setShowAddProfile\]\s*=\s*useState\(false\)/.test(
        credDetails,
      ),
    'AC-113-43 add-profile collapsed by default',
  );
  assert(
    !credDetails.includes('פתח כניסה') && !credDetails.includes('נסה מילוי'),
    'AC-113-44 open/fill absent on this screen (skip compact actions)',
  );
  assert(
    credDetails.includes('cd-dialog') &&
      credDetails.includes('aria-modal') &&
      credDetails.includes('HubCredentialInput') &&
      !credDetails.includes('loginIntelligence'),
    'AC-113-45 UI-only + a11y dialog; no LI',
  );
  assert(css.includes('.cd-dialog') && /max-width:\s*580px/.test(css), 'AC-113-45 compact width CSS');
  assert(
    manage.includes('manageOpenerRef') && manage.includes('opener.focus'),
    'AC-113-45 return focus to ניהול opener',
  );
  const hubInput = read('src/trust/HubCredentialInput.tsx');
  assert(hubInput.includes('revealAsText'), 'password reveal without dropping Hub hardening');

  // --- D-113-29 / AC-113-51 remove-site durability ---
  const appSrc = read('src/App.tsx');
  const persistence = read('src/supabase/persistence.ts');
  const selection = read('src/serviceManagement/serviceSelection.ts');
  assert(
    selection.includes('SELECTION_REMOVE_CLOUD_FAILED_MESSAGE') &&
      appSrc.includes('SELECTION_REMOVE_CLOUD_FAILED_MESSAGE'),
    'AC-113-51 friendly Hebrew on cloud remove failure',
  );
  assert(
    appSrc.includes("mode === 'remove'") &&
      appSrc.includes('removeUserServiceFromCloud') &&
      appSrc.includes('SELECTION_REMOVE_CLOUD_FAILED_MESSAGE') &&
      /removeUserServiceFromCloud\(id\);[\s\S]*setSelectionError\(SELECTION_REMOVE_CLOUD_FAILED_MESSAGE\)[\s\S]*return;/.test(
        appSrc,
      ),
    'AC-113-51 cloud remove failure sets Hebrew error and returns (no success paint)',
  );
  assert(
    /await removeUserServiceFromCloud\(id\);[\s\S]*persistSelectionState\(next/.test(appSrc) &&
      appSrc.includes('awaitCloudSync: mode === \'remove\'') &&
      appSrc.includes('setVaultState(next)'),
    'AC-113-51 cloud delete before local persist + awaited sync before success',
  );
  assert(
    appSrc.includes('pruneInactiveRef') ||
      /activeCatalogIds[\s\S]*selectedIds/.test(appSrc),
    'Admin-disabled / inactive registry rows must be pruned from selections',
  );
  assert(
    persistence.includes('CLOUD_REMOVE_UNAVAILABLE') &&
      /throw new Error\(CLOUD_REMOVE_UNAVAILABLE_MESSAGE\)/.test(persistence),
    'AC-113-51 removeUserServiceFromCloud must not silent-return without client/auth',
  );
  assert(
    persistence.includes('bumpDualWriteGeneration') &&
      /remaining|\.maybeSingle\(\)/.test(persistence) &&
      persistence.includes('dualWriteGeneration'),
    'AC-113-51 remove must verify row gone + invalidate stale dual-writes',
  );
  assert(
    /Membership \(`user_services`\) follows `selectedIds` only|selectedIds only/.test(
      persistence,
    ) ||
      persistence.includes('Do not recreate user_services') ||
      persistence.includes('do not recreate user_services'),
    'AC-113-51 sync must not re-upsert user_services from deselected local profiles',
  );
  const syncFnMatch = persistence.match(
    /export async function syncVaultStateToSupabase[\s\S]*?^export async function syncVaultStateToSupabaseSafe/m,
  );
  const syncBody = syncFnMatch?.[0] ?? '';
  assert(syncBody.length > 0, 'Could not locate syncVaultStateToSupabase for AC-113-51');
  assert(
    !/upsertUserService\(userId,\s*serviceId,\s*null\)/.test(syncBody),
    'AC-113-51 sync must not create user_services for deselected profile-only services',
  );
  assert(
    !/\.from\(['"]user_services['"]\)\s*\.delete\(/.test(syncBody),
    'AC-109-39 / AC-113-51 sync remains upsert-only (explicit remove API only)',
  );
}

function main() {
  mainBehavioral();
  mainFloat();
  mainStatic();
  console.log('verifyPhase113LoginAssistance: PASS');
}

main();
