/**
 * Phase 111 — static contracts for managed service assets (+ M8 paint cascade).
 * Usage: node scripts/verifyPhase111Assets.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

function walkTs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTs(full));
    else if (/\.(tsx?|mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function main() {
  const migration = read('supabase/migrations/20260714120000_phase111_service_assets.sql');
  assert(migration.includes('service_assets'), 'Migration must create service_assets table');
  assert(migration.includes('service-assets'), 'Migration must create service-assets bucket');
  assert(migration.includes('checksum'), 'Checksum column required (dedupe)');
  assert(migration.includes('asset_source'), 'asset_source column required');
  assert(/is_admin\(\)/.test(migration), 'Storage/admin policies should use is_admin()');

  assert(existsSync(join(root, 'src/serviceAssets/index.ts')), 'src/serviceAssets module required');
  assert(existsSync(join(root, 'src/admin/IconAssetEditor.tsx')), 'IconAssetEditor required');

  const iconUi = read('src/admin/IconAssetEditor.tsx');
  assert(iconUi.includes('type="file"'), 'AC-111-16: file picker required');
  assert(/png|jpeg|webp|ico/i.test(iconUi), 'AC-111-16: image accept types');
  assert(
    !/מטא-דאטה בלבד/.test(iconUi),
    'AC-111-16: must not present metadata-only as primary outcome',
  );
  assert(
    /objectFit:\s*['"]contain['"]/.test(iconUi),
    'Admin preview must use object-fit contain (full logo, no crop)',
  );
  assert(
    iconUi.includes('formatIconUploadError'),
    'Upload errors must be sanitized (no raw HTML/filter pages)',
  );

  const normalize = read('src/serviceAssets/normalize.ts');
  assert(
    normalize.includes('32') && normalize.includes('64') && normalize.includes('128'),
    'Normalize sizes 32/64/128 required',
  );
  assert(
    normalize.includes('Math.min') && /contain|CONTAIN|letterbox|ICON_CONTENT_FILL|0\.92/i.test(normalize),
    'Icon normalize must CONTAIN with Android-like fill (full logo, dense)',
  );
  assert(!/Math\.max\(size \/ bitmap/.test(normalize), 'Normalize must not use cover Math.max scale');

  const formatErr = read('src/serviceAssets/formatUploadError.ts');
  assert(
    /safepage|html/i.test(formatErr),
    'formatIconUploadError must detect HTML/filter interstitial responses',
  );

  const registryAdmin = read('src/admin/RegistryAdmin.tsx');
  assert(
    registryAdmin.includes('IconAssetEditor') && registryAdmin.includes('uploadAdminIconFile'),
    'RegistryAdmin must wire file upload',
  );

  const api = read('src/admin/adminRegistryApi.ts');
  assert(api.includes('uploadAdminIconFile'), 'Admin API upload helper required');
  assert(api.includes('adminRefreshServiceIcon'), 'Admin refresh helper required');

  const legacy = read('src/catalog/definitionToLegacyService.ts');
  assert(
    legacy.includes('resolveManagedIconUrl') || legacy.includes('serviceAssets'),
    'Legacy map must prefer managed resolver (cascade tier 1)',
  );
  // M8 / AC-111-17: day-one MUST keep pre-111 faviconSiteUrl → highResFavicon path
  assert(
    /highResFavicon\(\s*metadata\.faviconSiteUrl\s*\)/.test(legacy) ||
      /highResFavicon\(metadata\.faviconSiteUrl\)/.test(legacy),
    'AC-111-17: cascade tier 2 must restore highResFavicon(faviconSiteUrl)',
  );
  assert(
    /cascade|M8|D-111-17|pre-111/i.test(legacy),
    'Legacy map must document paint cascade (not Storage-only)',
  );

  const logoCache = read('src/logoCache.ts');
  assert(
    /from ['"].*resolveServiceLogo['"]/.test(logoCache) ||
      /import\s*\{[^}]*resolveServiceLogo/.test(logoCache),
    'AC-111-17: logoCache must keep pre-111 resolveServiceLogo as cascade tier 2',
  );
  assert(
    logoCache.includes('resolveManagedIconUrl'),
    'logoCache must prefer managed URLs when present (tier 1)',
  );
  assert(
    /cascade|M8|D-111-17|pre-111/i.test(logoCache),
    'logoCache must document cascade (forbid Storage-only day-one)',
  );

  // Forbid hard Storage-only cutover comments that reject Google without cascade
  assert(
    !/managed Storage URLs only — no Google/i.test(logoCache) &&
      !/Never emit Google favicon/i.test(legacy),
    'Must not claim Storage-only paint without legacy cascade',
  );

  const dashboard = read('src/Dashboard.tsx');
  const manage = read('src/ManageServices.tsx');
  assert(
    !dashboard.includes('resolveServiceLogo') && !manage.includes('resolveServiceLogo'),
    'Home/Manage must not call resolveServiceLogo directly (via logoCache only)',
  );

  const refresh = read('src/serviceAssets/refresh.ts');
  assert(
    refresh.includes('isAdminProtectedAsset') && refresh.includes('force'),
    'AC-111-10: refresh must protect admin assets unless force',
  );

  const discovery = read('src/serviceAssets/discovery.ts');
  assert(
    discovery.includes('ICON_DISCOVERY_ORDER') && discovery.includes('discoverServiceIconSafe'),
    'Discovery pipeline module required',
  );

  const validate = read('src/serviceAssets/validate.ts');
  assert(validate.includes('detectIconMimeFromMagic'), 'Magic-byte validation required');

  const migrationDoc = read('docs/MIGRATION_PHASE_111.md');
  assert(migrationDoc.includes('service-assets'), 'Migration doc must cover Storage bucket');
  assert(
    /file picker|העלא|upload/i.test(migrationDoc),
    'Migration doc must cover Admin file upload',
  );
  assert(
    /overwrite|force|מנהל/i.test(migrationDoc),
    'Migration doc must cover admin overwrite protection',
  );
  assert(
    /cascade|faviconSiteUrl|pre-111|M8/i.test(migrationDoc),
    'M8: Migration doc must document paint CASCADE (not Storage-only day-one)',
  );

  const assetModuleFiles = walkTs(join(root, 'src/serviceAssets'));
  for (const file of assetModuleFiles) {
    const text = readFileSync(file, 'utf8');
    assert(
      !/service_registry[\s\S]{0,80}base64|metadata\.iconBinary/i.test(text),
      `Binaries must not be primary-stored in registry (${file})`,
    );
  }

  console.log('verifyPhase111Assets: PASS');
  console.log('Checked: migration/RLS, file picker, M8 paint CASCADE, admin protect, docs');
}

try {
  main();
} catch (error) {
  console.error('verifyPhase111Assets: FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
