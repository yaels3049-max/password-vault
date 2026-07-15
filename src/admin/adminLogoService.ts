import { highResFavicon } from '../catalog';
import type { Service } from '../service/legacyService';
import { resolveManagedIconUrl } from '../serviceAssets';
import type { AdminRegistryRow } from './adminRegistryApi';

/**
 * Same paint-cascade logo URL as Digital Home / definitionToLegacyService:
 * managed Storage → explicit metadata.logoUrl → highResFavicon(faviconSiteUrl | primary_url).
 * Without the gstatic favicon step, admin falls back to live site probe which often
 * fails (CORS / tiny favicon.ico) while Home already shows the logo.
 */
function resolveAdminLogoUrl(row: AdminRegistryRow): string | undefined {
  const managed = resolveManagedIconUrl(
    { serviceId: row.id, metadata: row.metadata, logoUrl: null },
    128,
  );
  if (managed) return managed;

  const metaLogo =
    typeof row.metadata?.logoUrl === 'string' ? row.metadata.logoUrl.trim() : '';
  if (metaLogo) return metaLogo;

  const faviconSite =
    (typeof row.metadata?.faviconSiteUrl === 'string' &&
      row.metadata.faviconSiteUrl.trim()) ||
    row.primary_url?.trim() ||
    '';
  if (faviconSite) {
    return highResFavicon(faviconSite);
  }

  return undefined;
}

/** Map a registry row to the Service shape used by the Digital Home logo cascade. */
export function adminRowToLogoService(row: AdminRegistryRow): Service {
  const logoUrl = resolveAdminLogoUrl(row);
  const siteUrl =
    (typeof row.metadata?.faviconSiteUrl === 'string' &&
      row.metadata.faviconSiteUrl.trim()) ||
    row.primary_url?.trim() ||
    'https://example.invalid';

  return {
    id: row.id,
    name: row.display_name,
    icon: row.icon?.trim() || '🔗',
    url: siteUrl,
    loginUrl: row.login_url ?? undefined,
    category: row.category_id ?? 'custom',
    logoUrl,
    metadata: row.metadata ?? undefined,
  };
}
