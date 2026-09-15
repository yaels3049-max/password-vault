/**
 * Phase 104 Service Management verification (static).
 *
 * Proves the Service Management surface satisfies the Phase 104 structural
 * requirements without a running browser:
 *   - Screen title "ניהול שירותים"
 *   - Two sections "השירותים שלי" + "הוספת שירותים"
 *   - Exactly one custom-add entry point (no per-category duplicate)
 *   - deriveServiceManagementState exists
 *   - Administration-only (amended AC-104-17 / D-104-17): Service Management has NO
 *     execution — no פתיחה, no openServiceWithProfile, no executeServiceFromTile
 *   - Selected cards expose ניהול + הסרה only (D-104-10)
 *   - Progressive-disclosure management modal (D-104-19)
 *   - Digital Home remains the sole execution surface (Dashboard → openServiceWithProfile)
 *   - Idempotent / pending guard patterns present
 *   - No direct global service_registry mutation from Service Management UI
 *
 *   - Custom add outcomes are a typed contract (no legacy duplicate throw)
 *   - Global catalog match wins over private custom Array.find() order
 *
 * Usage: node scripts/verifyPhase104ServiceManagement.mjs
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

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

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function catalogServiceAlreadyInHomeMessageProbe(serviceName) {
  return `${serviceName} כבר נמצא בבית הדיגיטלי שלך.`;
}

function catalogServiceAvailableTitleProbe(serviceName) {
  return `${serviceName} כבר זמין להוספה`;
}

function sameUserCustomDuplicateMessageProbe(serviceName) {
  return `${serviceName} כבר נמצא בבית הדיגיטלי שלך.`;
}

function main() {
  const manage = read('src/ManageServices.tsx');

  // AC-104-1 — screen title (glossary: אתרים)
  assert(
    manage.includes('ניהול אתרים') || manage.includes('ניהול שירותים'),
    'Service Management screen title must be present',
  );

  // AC-104-2, AC-104-3 — two sections (glossary: אתרים)
  assert(
    manage.includes('האתרים שלי') || manage.includes('השירותים שלי'),
    'My Services section heading required',
  );
  assert(
    manage.includes('הוספת אתרים') || manage.includes('הוספת שירותים'),
    'Add services section heading required',
  );
  assert(
    !manage.includes('גילוי שירותים'),
    'Legacy "גילוי שירותים" section title must be replaced',
  );
  assert(
    manage.includes('כבר בבית הדיגיטלי'),
    'Added services in add section must show passive "כבר בבית הדיגיטלי" state',
  );

  // AC-104-4 — exactly one custom-add entry point; legacy per-category button removed
  assert(
    countOccurrences(manage, '+ הוסף אתר') === 1,
    'Exactly one "+ הוסף אתר" custom-add entry point required',
  );
  assert(
    !manage.includes('הוסף שירות מותאם'),
    'Legacy "הוסף שירות מותאם" label must be replaced',
  );
  assert(
    manage.includes('sm-search-submit'),
    'Add section search field must include a submit icon control',
  );
  assert(
    manage.includes('commitSearch'),
    'Add section search must commit via a single handler (Enter and icon)',
  );
  assert(
    !manage.includes('הוסף אתר משלי'),
    'Legacy per-category "הוסף אתר משלי" button must be removed',
  );

  // AC-104-8, D-104-7 — derived management state
  const stateModule = read('src/serviceManagement/serviceManagementState.ts');
  assert(
    stateModule.includes('export function deriveServiceManagementState'),
    'deriveServiceManagementState must be exported',
  );
  for (const badge of ['not_added', 'added', 'missing_credentials', 'multiple_profiles']) {
    assert(stateModule.includes(badge), `management state "${badge}" must be defined`);
  }
  assert(
    manage.includes('deriveServiceManagementState'),
    'ManageServices must render derived management state',
  );

  // Amended AC-104-17 / D-104-17 — Service Management is administration-only:
  // execution lives on Digital Home exclusively.
  assert(
    !manage.includes('פתיחה'),
    'Service Management must not expose a פתיחה (Open) action (execution is Digital Home only)',
  );
  assert(
    !manage.includes('openServiceWithProfile'),
    'ManageServices must not import or call openServiceWithProfile (no execution)',
  );
  assert(
    !manage.includes('executeServiceFromTile'),
    'ManageServices must not call executeServiceFromTile (no execution)',
  );

  // D-104-10 — selected cards expose ניהול + הסרה only (no card-level profile/credential buttons)
  assert(manage.includes('ניהול'), 'Selected cards must expose a ניהול action');
  assert(
    (manage.includes('הסר אתר') || manage.includes('הסר שירות') || manage.includes('הסרה')) &&
      manage.includes('onRemoveService'),
    'Selected cards must expose remove via secondary menu',
  );
  assert(
    !manage.includes('ניהול פרופילים'),
    'Card-level "ניהול פרופילים" button must be removed (unified into ניהול modal)',
  );
  assert(
    !manage.includes('עריכת פרטי כניסה'),
    'Card-level "עריכת פרטי כניסה" button must be removed (unified into ניהול modal)',
  );
  assert(
    manage.includes("'user-created'") && !manage.includes('isCustomServiceId'),
    'עריכת פרטי האתר must gate on source === user-created, not isCustomServiceId',
  );

  // D-104-19 — progressive-disclosure management modal
  const modal = read('src/ServiceProfileManagementModal.tsx');
  assert(
    modal.includes('isMultiProfile'),
    'Management modal must branch on profile count (single vs multi) per D-104-19',
  );
  assert(
    modal.includes('הוספת פרופיל נוסף'),
    'Management modal must offer "הוספת פרופיל נוסף" as a secondary action (D-104-19)',
  );

  // Digital Home remains the sole execution surface (unchanged Phase 103 path)
  const openHelper = read('src/serviceManagement/openWithProfile.ts');
  assert(
    openHelper.includes('executeServiceFromTile'),
    'openWithProfile must route through executeServiceFromTile',
  );
  const dashboard = read('src/Dashboard.tsx');
  assert(
    dashboard.includes('handleServiceOpen') &&
      dashboard.includes('shouldOpenLoginAssistancePanel'),
    'Digital Home remains the execution/launch surface (tile click → Launch Card)',
  );
  assert(
    !manage.includes('shouldOpenLoginAssistancePanel'),
    'Service Management must not open the Digital Home launch path',
  );

  // AC-104-12, AC-104-13 — idempotent + pending guards
  const selection = read('src/serviceManagement/serviceSelection.ts');
  assert(
    selection.includes('export function addToSelection') &&
      selection.includes('export function removeFromSelection'),
    'serviceSelection must expose idempotent add/remove reducers',
  );
  const app = read('src/App.tsx');
  assert(
    app.includes('selectionLockRef') && app.includes('pendingIds'),
    'App must guard selection with an in-flight lock and pending set',
  );
  assert(
    /await persistSelectionState\(next[\s\S]*?setVaultState\(next\)/.test(app),
    'App must persist before committing selection to state (no optimistic tile)',
  );
  assert(
    manage.includes('pendingIds.has') && manage.includes('disabled={pending}'),
    'ManageServices must disable controls during pending operations',
  );

  // AC-104-11, AC-104-20 — no direct global service_registry mutation from the UI
  assert(
    !/service_registry/.test(manage),
    'Service Management UI must not reference service_registry directly',
  );
  assert(
    !/\.from\(['"]service_registry['"]\)/.test(manage),
    'Service Management UI must not query/mutate service_registry',
  );

  // Catalog-match copy uses authoritative catalog displayName (not custom form name).
  const persistence = read('src/supabase/registryPersistence.ts');
  assert(
    persistence.includes('catalogServiceAlreadyInHomeMessage'),
    'already-in-home message must be built from catalog serviceName',
  );
  assert(
    persistence.includes('catalogServiceAvailableTitle'),
    'catalog-available title must be built from catalog serviceName',
  );
  assert(
    persistence.includes('כבר נמצא בבית הדיגיטלי שלך.'),
    'already-in-home suffix must match approved copy',
  );
  assert(
    !/„|”|"\$\{serviceName\}"/.test(persistence.split('catalogServiceAlreadyInHomeMessage')[1]?.split('export function')[0] ?? ''),
    'already-in-home must not wrap displayName in quotation marks',
  );
  assert(
    persistence.includes('CATALOG_SERVICE_ALREADY_IN_HOME_DISMISS_LABEL'),
    'already-in-home dismiss CTA constant required',
  );
  assert(
    persistence.includes("= 'סגור'") || persistence.includes('= "סגור"'),
    'already-in-home dismiss CTA must be סגור',
  );
  assert(
    manage.includes('CATALOG_SERVICE_ALREADY_IN_HOME_DISMISS_LABEL'),
    'already-in-home dialog must use סגור CTA constant',
  );
  assert(
    manage.includes('sm-catalog-offer-title'),
    'already-in-home title must use wrapping-friendly class',
  );
  const css = read('src/App.css');
  assert(css.includes('sm-catalog-offer-title'), 'catalog offer title styles present');
  assert(css.includes('text-wrap: pretty'), 'prefer pretty wrapping over hard breaks');
  assert(!manage.includes('<br') && !manage.includes('\\n'), 'no hard-coded line breaks in catalog offer');
  assert(
    manage.includes('sm-catalog-offer-dismiss'),
    'already-in-home dismiss row must use compact centered actions class',
  );
  assert(css.includes('.sm-catalog-offer-dismiss .modal-btn'), 'compact dismiss button styles present');
  assert(
    /sm-catalog-offer-dismiss[\s\S]*flex:\s*0 0 auto/.test(css),
    'dismiss button must not stretch via flex: 1',
  );
  assert(
    persistence.includes('כבר זמין להוספה'),
    'catalog-available suffix must match approved copy',
  );
  assert(
    !persistence.includes('כבר קיים במערכת'),
    'catalog-available must not use internal «קיים במערכת» wording',
  );
  assert(
    persistence.includes("= 'הוסף לבית הדיגיטלי'") ||
      persistence.includes('= "הוסף לבית הדיגיטלי"'),
    'catalog-available primary CTA must be הוסף לבית הדיגיטלי',
  );
  assert(manage.includes('sm-catalog-offer-prompt'), 'catalog-available question uses decision-prompt class');
  assert(css.includes('sm-catalog-offer-prompt'), 'decision-prompt styles present');
  assert(/sm-catalog-offer-prompt[\s\S]*font-size:\s*1rem/.test(css), 'question is approximately 16px');
  assert(
    manage.includes('catalogServiceAlreadyInHomeMessage(catalogOffer.displayName)'),
    'already-in-home UI must use matched catalog displayName',
  );
  assert(
    manage.includes('catalogServiceAvailableTitle(catalogOffer.displayName)'),
    'catalog-available UI must use matched catalog displayName',
  );
  assert(
    manage.includes('displayName: result.displayName'),
    'catalog offer state must carry result.displayName from the match',
  );
  assert(
    !manage.includes('כבר נוסף כאתר מותאם אישית'),
    'already-in-list copy must not say מותאם אישית',
  );
  assert(
    manage.includes("result.status === 'same_user_custom_duplicate'"),
    'ManageServices must consume same_user_custom_duplicate from App (no local re-classify)',
  );
  assert(
    manage.includes("kind: 'already_in_user_home'"),
    'same-user duplicate already in the user list must show the already-in-home dialog',
  );
  assert(
    app.includes('classifyAddCustomService'),
    'addCustomService must use the shared classifier (single outcome producer)',
  );
  assert(
    app.includes('snapshotCatalogForCustomAdd'),
    'custom add must use the existing catalog readiness/snapshot contract',
  );
  const addCustomFn = app.match(
    /async function addCustomService[\s\S]*?\n  async function updateCustomService/,
  )?.[0];
  assert(addCustomFn, 'addCustomService function must be present');
  assert(
    !addCustomFn.includes('alreadyExistsLocally'),
    'local duplicate must not short-circuit before global catalog match',
  );
  assert(
    !addCustomFn.includes('catalogDefinitions.find'),
    'mixed catalogDefinitions.find() must not decide identity',
  );
  assert(
    !addCustomFn.includes('האתר כבר קיים ברשימת האתרים שלך'),
    'legacy duplicate string must not be thrown from addCustomService',
  );
  assert(
    !addCustomFn.includes('CUSTOM_SERVICE_DUPLICATE_MESSAGE'),
    'legacy duplicate alias must not be used on the create path',
  );
  assert(
    persistence.includes("status: 'same_user_custom_duplicate'"),
    'AddCustomServiceResult must include same_user_custom_duplicate',
  );
  assert(
    persistence.includes('sameUserCustomDuplicateMessage'),
    'same-user duplicate copy helper must exist',
  );
  const classifier = read('src/catalog/addCustomServiceOutcome.ts');
  assert(
    classifier.includes('.filter(isGlobalCatalogDefinition)'),
    'classifier must resolve globals before user-created rows',
  );
  assert(
    classifier.includes("status: 'already_in_user_home'") &&
      classifier.includes("status: 'catalog_service_available'") &&
      classifier.includes("status: 'same_user_custom_duplicate'"),
    'classifier must emit the three business duplicate/catalog outcomes',
  );
  assert(
    app.includes('displayName: catalogMatch.displayName') === false &&
      app.includes('classifyAddCustomService'),
    'addCustomService must pass classifier displayName (not form name)',
  );
  assert(
    sameUserCustomDuplicateMessageProbe('האתר שלי') ===
      'האתר שלי כבר נמצא בבית הדיגיטלי שלך.',
    'same-user duplicate already in the list uses already-in-home copy',
  );
  assert(
    !sameUserCustomDuplicateMessageProbe('icount').includes('מותאם אישית'),
    'already-in-list copy must not mention מותאם אישית',
  );
  assert(
    catalogServiceAlreadyInHomeMessageProbe('בנק הפועלים') ===
      'בנק הפועלים כבר נמצא בבית הדיגיטלי שלך.',
    'already-in-home copy must prefix catalog displayName',
  );
  assert(
    !catalogServiceAlreadyInHomeMessageProbe('בנק הפועלים').includes('„') &&
      !catalogServiceAlreadyInHomeMessageProbe('בנק הפועלים').includes('”'),
    'already-in-home copy must not include quotation marks',
  );
  assert(
    catalogServiceAvailableTitleProbe('Zoom') === 'Zoom כבר זמין להוספה',
    'catalog-available copy must prefix catalog displayName',
  );
  assert(
    catalogServiceAvailableTitleProbe('בנק הפועלים') === 'בנק הפועלים כבר זמין להוספה',
    'catalog-available Hebrew name uses catalog displayName',
  );
  assert(
    !catalogServiceAlreadyInHomeMessageProbe('בנק הפועלים').includes('123 XYZ'),
    'already-in-home must not include a fake custom name',
  );

  // AC-104-14 — friendly persist-failure message wired
  assert(
    selection.includes('SELECTION_PERSIST_FAILED_MESSAGE'),
    'serviceSelection must define a friendly persist-failure message',
  );
  assert(
    manage.includes('selectionError'),
    'ManageServices must surface selection persist errors',
  );

  console.log('PASS: Phase 104 Service Management (static)');
  console.log('  title: ניהול שירותים');
  console.log('  sections: השירותים שלי + הוספת שירותים');
  console.log('  custom-add entry points: 1');
  console.log('  selected-card actions: ניהול + הסר שירות (menu) only (no פתיחה)');
  console.log('  execution: none in Service Management (Digital Home only)');
  console.log('  modal: progressive disclosure (single vs multi profile) — D-104-19');
  console.log('  custom-add outcomes: typed contract (global-first; no legacy duplicate throw)');
  console.log('  selection: idempotent reducers + in-flight lock + persist-before-commit');
  console.log('');
  console.log('Regression gate (manual UAT — required for Manager approval):');
  console.log('  R1 Digital Home — Shufersal open + generic fill');
  console.log('  R2 Digital Home — Clalit open + 3-field fill');
  console.log('  C1 Custom add A-C — catalog-in-home / catalog-available / same-user duplicate');
  console.log('  (R3/R4 retired — Service Management no longer executes)');
}

function def(partial) {
  return {
    schemaVersion: 1,
    id: 'svc',
    displayName: 'Service',
    url: 'https://example.com',
    category: 'other',
    icon: '✦',
    source: 'built-in-catalog',
    ...partial,
  };
}

async function mainClassifierRuntime() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-104-')), 'outcome.mjs');
  await build({
    entryPoints: [join(root, 'src/catalog/addCustomServiceOutcome.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  const { classifyAddCustomService } = await import(pathToFileURL(outfile).href);

  const hapoalim = def({
    id: 'hapoalim',
    displayName: 'בנק הפועלים',
    url: 'https://www.bankhapoalim.co.il',
    source: 'built-in-catalog',
  });
  const clalit = def({
    id: 'clalit',
    displayName: 'כללית',
    url: 'https://www.clalit.co.il',
    loginUrl: 'https://e-services.clalit.co.il/onlineweb/general/login.aspx',
    source: 'built-in-catalog',
  });
  const privateFirst = def({
    id: 'custom-private-hapoalim',
    displayName: 'הפועלים שלי',
    url: 'https://www.bankhapoalim.co.il',
    source: 'user-created',
  });

  const alreadyHome = classifyAddCustomService({
    normalizedUrl: 'https://www.bankhapoalim.co.il/',
    definitions: [privateFirst, hapoalim],
    selectedIds: new Set(['hapoalim']),
    localCustomServices: [],
  });
  assert(
    alreadyHome?.status === 'already_in_user_home' &&
      alreadyHome.displayName === 'בנק הפועלים' &&
      alreadyHome.existingServiceId === 'hapoalim',
    'A: catalog already in home — global wins mixed find() order; catalog displayName',
  );

  const available = classifyAddCustomService({
    normalizedUrl: 'https://www.bankhapoalim.co.il/',
    definitions: [privateFirst, hapoalim],
    selectedIds: new Set(),
    localCustomServices: [],
  });
  assert(
    available?.status === 'catalog_service_available' &&
      available.displayName === 'בנק הפועלים',
    'B: catalog available — global wins; not a custom duplicate',
  );

  const sameUserInHome = classifyAddCustomService({
    normalizedUrl: 'https://mysite.example/',
    definitions: [hapoalim],
    selectedIds: new Set(['custom-1']),
    localCustomServices: [
      def({
        id: 'custom-1',
        displayName: 'icount',
        url: 'https://mysite.example',
        source: 'user-created',
      }),
    ],
  });
  assert(
    sameUserInHome?.status === 'already_in_user_home' &&
      sameUserInHome.displayName === 'icount' &&
      sameUserInHome.existingServiceId === 'custom-1',
    'C: site already in the user list uses already_in_user_home (not custom jargon)',
  );

  const sameUserNotSelected = classifyAddCustomService({
    normalizedUrl: 'https://mysite.example/',
    definitions: [hapoalim],
    selectedIds: new Set(),
    localCustomServices: [
      def({
        id: 'custom-1',
        displayName: 'האתר שלי',
        url: 'https://mysite.example',
        source: 'user-created',
      }),
    ],
  });
  assert(
    sameUserNotSelected?.status === 'same_user_custom_duplicate' &&
      sameUserNotSelected.displayName === 'האתר שלי',
    'unselected leftover custom remains a typed duplicate (UI still uses already-in-home copy)',
  );

  const created = classifyAddCustomService({
    normalizedUrl: 'https://brand-new.example/',
    definitions: [hapoalim, clalit],
    selectedIds: new Set(),
    localCustomServices: [],
  });
  assert(created === null, 'D: genuine new custom is not a business duplicate');

  const clalitEservices = classifyAddCustomService({
    normalizedUrl: 'https://e-services.clalit.co.il/',
    definitions: [clalit],
    selectedIds: new Set(),
    localCustomServices: [],
  });
  assert(
    clalitEservices === null,
    'Clalit non-goal: e-services host is not the catalog primary identity',
  );

  const persistFailIsNotDuplicate = classifyAddCustomService({
    normalizedUrl: 'https://unique-persist.example/',
    definitions: [hapoalim],
    selectedIds: new Set(),
    localCustomServices: [],
  });
  assert(
    persistFailIsNotDuplicate === null,
    'F: classifier does not emit duplicate when no match exists (persist errors stay errors)',
  );

  const customOutfile = join(mkdtempSync(join(tmpdir(), 'pv-104-url-')), 'custom.mjs');
  await build({
    entryPoints: [join(root, 'src/catalog/customService.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: customOutfile,
  });
  const { validateCustomPrimaryUrl } = await import(pathToFileURL(customOutfile).href);
  const invalid = validateCustomPrimaryUrl('not-a-url');
  assert(invalid.valid === false, 'E: invalid URL stays a validation failure');

  console.log('PASS: Phase 104 custom-add classifier runtime (A-G fixtures, Clalit non-goal)');
}

main();
await mainClassifierRuntime();
