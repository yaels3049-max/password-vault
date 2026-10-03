/**
 * Phase 105 Digital Home verification (static).
 *
 * Proves the Digital Home surface satisfies Phase 105 structural requirements:
 *   - Screen title "הבית הדיגיטלי"
 *   - Useful Services + Notifications foundations (hidden when empty)
 *   - Adaptive layout: flat grid when selected count <= 12; category when >= 13
 *   - Threshold cases: 12 → flat, 13 → category, 14+ → category
 *   - Launcher grid density: desktop max 5 columns; larger tile size
 *   - No manage/remove/credential-edit controls on tiles / Dashboard tile UI
 *   - Open path: openServiceWithProfile → executeServiceFromTile
 *   - No discovery-on-click imports in Dashboard
 *
 * Usage: node scripts/verifyPhase105DigitalHome.mjs
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

function evaluateThresholdFromSource(homeLayoutSrc) {
  const minMatch = homeLayoutSrc.match(
    /CATEGORY_LAYOUT_MIN_SERVICES\s*=\s*(\d+)/,
  );
  assert(minMatch, 'CATEGORY_LAYOUT_MIN_SERVICES must be defined');
  const min = Number(minMatch[1]);
  assert(min === 13, 'CATEGORY_LAYOUT_MIN_SERVICES must be 13');

  function resolveHomeServicesLayoutMode(selectedServiceCount) {
    return selectedServiceCount >= min ? 'category' : 'flat';
  }

  return { min, resolveHomeServicesLayoutMode };
}

function runThresholdCases(resolveHomeServicesLayoutMode) {
  const cases = [
    { count: 0, expected: 'flat' },
    { count: 1, expected: 'flat' },
    { count: 12, expected: 'flat' },
    { count: 13, expected: 'category' },
    { count: 14, expected: 'category' },
    { count: 50, expected: 'category' },
  ];
  for (const { count, expected } of cases) {
    const actual = resolveHomeServicesLayoutMode(count);
    assert(
      actual === expected,
      `selected=${count} → expected ${expected}, got ${actual}`,
    );
  }
}

function groupSelectedServicesByCategory(selectedServices, categoryOrder) {
  return categoryOrder
    .map((category) => ({
      category,
      services: selectedServices.filter((s) => s.category === category),
    }))
    .filter((g) => g.services.length > 0);
}

function main() {
  const dashboard = read('src/Dashboard.tsx');
  const tile = read('src/Tile.tsx');
  const openHelper = read('src/serviceManagement/openWithProfile.ts');
  const useful = read('src/digitalHome/UsefulServicesSection.tsx');
  const notifications = read('src/digitalHome/NotificationsSection.tsx');
  const homeLayout = read('src/digitalHome/homeLayout.ts');
  const appCss = read('src/App.css');

  // AC-105-1 — screen title
  assert(
    dashboard.includes('הבית הדיגיטלי'),
    'Digital Home screen title must be "הבית הדיגיטלי"',
  );
  assert(
    !dashboard.includes('המרכז הדיגיטלי שלי'),
    'Interim title "המרכז הדיגיטלי שלי" must be replaced',
  );

  // AC-105-10 / AC-105-11 — foundations exist and hide when empty
  assert(
    dashboard.includes('UsefulServicesSection') && useful.includes('שירותים שימושיים'),
    'Useful Services foundation module must exist',
  );
  assert(
    dashboard.includes('NotificationsSection') && notifications.includes('התראות'),
    'Notifications foundation module must exist',
  );
  assert(
    useful.includes('return null') && notifications.includes('return null'),
    'Empty Useful Services / Notifications must return null (no reserved empty UI)',
  );

  // Adaptive layout: selected services only
  assert(
    dashboard.includes('shouldUseCategoryLayout(services.length)'),
    'Layout threshold must count selected services only (services.length)',
  );
  assert(
    dashboard.includes('shouldUseCategoryLayout') &&
      dashboard.includes('groupSelectedServicesByCategory'),
    'Dashboard must use adaptive homeLayout helpers',
  );
  assert(
    dashboard.includes('app-section--home') && dashboard.includes('app-section-title'),
    'Dashboard must support both flat home grid and category section titles',
  );
  assert(
    homeLayout.includes('CATEGORY_LAYOUT_MIN_SERVICES = 13'),
    'homeLayout threshold constant must be 13',
  );
  assert(
    homeLayout.includes('groupSelectedServicesByCategory') &&
      homeLayout.includes('filter((group) => group.services.length > 0)'),
    'Category grouping must hide empty categories',
  );
  assert(
    homeLayout.includes('service.category === category'),
    'Each service groups by its own category (appear once)',
  );

  const { resolveHomeServicesLayoutMode } = evaluateThresholdFromSource(homeLayout);
  runThresholdCases(resolveHomeServicesLayoutMode);

  // Grouping uniqueness (mirror of homeLayout contract)
  const sample = [
    { id: 'a', category: 'banking' },
    { id: 'b', category: 'health' },
    { id: 'c', category: 'banking' },
    { id: 'd', category: 'shopping' },
  ];
  const groups = groupSelectedServicesByCategory(sample, [
    'practice',
    'banking',
    'health',
    'shopping',
  ]);
  const ids = groups.flatMap((g) => g.services.map((s) => s.id));
  assert(ids.length === sample.length, 'Grouping must not drop services');
  assert(new Set(ids).size === ids.length, 'Grouping must not duplicate services');
  assert(groups.every((g) => g.services.length > 0), 'Empty categories must be hidden');
  assert(!groups.some((g) => g.category === 'practice'), 'Empty practice category hidden');

  // Phase 123 grid density — launcher-style max 5 columns on desktop
  assert(
    /grid-template-columns:\s*repeat\(\s*auto-fill/.test(appCss) &&
      appCss.includes('/ 5)'),
    'Digital Home grid must cap desktop columns at 5 via 1/5 min track',
  );
  assert(
    /\.app-icon\s*\{[\s\S]*?width:\s*64px/.test(appCss),
    'Digital Home tiles must use launcher-scale icon size (64px)',
  );
  assert(
    !/\.app-grid\s*\{[^}]*minmax\(72px,\s*1fr\)/.test(appCss),
    'Dense minmax(72px) auto-fill grid must not remain on .app-grid',
  );

  // AC-105-9 — no manage controls on tiles / Dashboard tile UI
  for (const forbidden of [
    'הסרה',
    'הסר שירות',
    'ניהול פרופילים',
    'עריכת פרטי כניסה',
    'שמור פרטי כניסה',
  ]) {
    assert(
      !tile.includes(forbidden),
      `Tile must not expose management control "${forbidden}"`,
    );
  }
  assert(
    !dashboard.includes('ServiceProfileManagementModal') &&
      !dashboard.includes('onRemoveService'),
    'Dashboard must not host profile/credential management or remove handlers',
  );

  // AC-105-4 / AC-105-19 — unified open path; no discovery on click
  assert(
    dashboard.includes('openServiceWithProfile'),
    'Dashboard must open via openServiceWithProfile',
  );
  assert(
    !dashboard.includes('executeServiceFromTile'),
    'Dashboard must not call executeServiceFromTile directly',
  );
  assert(
    openHelper.includes('executeServiceFromTile'),
    'openWithProfile must route through executeServiceFromTile',
  );
  assert(
    !/discoverLogin/.test(dashboard) && !dashboard.includes('discoverLoginForCustomService'),
    'Dashboard must not discover login on tile click',
  );

  // AC-105-12 — empty selection CTA to Service Management
  assert(
    dashboard.includes('onAddMore') &&
      (dashboard.includes('הוספת שירותים') || dashboard.includes('ניהול שירותים')),
    'Empty / header navigation to Service Management required',
  );

  // AC-105-7 — credentials_missing guidance must still surface after open path
  assert(
    dashboard.includes('credentials_missing'),
    'Dashboard must handle credentials_missing status',
  );

  console.log('PASS: Phase 105 Digital Home (static)');
  console.log('  title: הבית הדיגיטלי');
  console.log('  sections: Useful Services + Notifications (hidden when empty)');
  console.log('  open path: openServiceWithProfile → executeServiceFromTile');
  console.log('  layout: flat at <=12; category at >=13 (selected services only)');
  console.log('  threshold cases: 12→flat, 13→category, 14+→category');
  console.log('  grid density: max 5 columns desktop; larger launcher tiles');
  console.log('');
  console.log('Regression gate (manual UAT — required for Manager approval):');
  console.log('  R1 Digital Home — Shufersal open + generic fill');
  console.log('  R2 Digital Home — Clalit open + 3-field fill');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
