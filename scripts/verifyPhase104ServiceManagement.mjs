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
 * Usage: node scripts/verifyPhase104ServiceManagement.mjs
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

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function main() {
  const manage = read('src/ManageServices.tsx');

  // AC-104-1 — screen title
  assert(
    manage.includes('ניהול שירותים'),
    'Service Management screen title must be "ניהול שירותים"',
  );

  // AC-104-2, AC-104-3 — two sections
  assert(manage.includes('השירותים שלי'), 'My Services section heading required');
  assert(manage.includes('הוספת שירותים'), 'Add services section heading required');
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
    manage.includes('הסר שירות') && manage.includes('onRemoveService'),
    'Selected cards must expose remove via secondary menu (הסר שירות)',
  );
  assert(
    !manage.includes('ניהול פרופילים'),
    'Card-level "ניהול פרופילים" button must be removed (unified into ניהול modal)',
  );
  assert(
    !manage.includes('עריכת פרטי כניסה'),
    'Card-level "עריכת פרטי כניסה" button must be removed (unified into ניהול modal)',
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
    dashboard.includes('openServiceWithProfile'),
    'Dashboard must remain the execution surface via openServiceWithProfile',
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
    /await persistSelectionState\(next\);\s*\n\s*setVaultState\(next\)/.test(app),
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
  console.log('  selection: idempotent reducers + in-flight lock + persist-before-commit');
  console.log('');
  console.log('Regression gate (manual UAT — required for Manager approval):');
  console.log('  R1 Digital Home — Shufersal open + generic fill');
  console.log('  R2 Digital Home — Clalit open + 3-field fill');
  console.log('  (R3/R4 retired — Service Management no longer executes)');
}

main();
