import { discoverServiceIconSafe, type IconDiscoveryResult } from './discovery';
import { isAdminProtectedAsset } from './types';

export interface AssetRefreshReportItem {
  serviceId: string;
  status: 'refreshed' | 'skipped_admin' | 'failed' | 'unchanged';
  message: string;
}

export interface AssetRefreshReport {
  total: number;
  refreshed: number;
  skippedAdmin: number;
  failed: number;
  unchanged: number;
  items: AssetRefreshReportItem[];
}

const DEFAULT_CONCURRENCY = 3;
const INTER_BATCH_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Refresh managed icons for services. Never overwrites assetSource=admin without force.
 */
export async function refreshServiceAssets(
  services: Array<{
    id: string;
    primaryUrl: string;
    metadata?: Record<string, unknown> | null;
  }>,
  options?: { force?: boolean; concurrency?: number },
): Promise<AssetRefreshReport> {
  const force = options?.force === true;
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const items: AssetRefreshReportItem[] = [];

  for (let i = 0; i < services.length; i += concurrency) {
    const batch = services.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (service): Promise<AssetRefreshReportItem> => {
        if (!force && isAdminProtectedAsset(service.metadata)) {
          return {
            serviceId: service.id,
            status: 'skipped_admin',
            message: 'אייקון מנהל מוגן — נדרש force כדי לדרוס.',
          };
        }

        const result: IconDiscoveryResult = await discoverServiceIconSafe(
          service.id,
          service.primaryUrl,
          service.metadata,
          { force },
        );

        if (result.skipped && result.reason === 'admin_protected') {
          return {
            serviceId: service.id,
            status: 'skipped_admin',
            message: 'דילוג — אייקון מנהל.',
          };
        }

        if (result.skipped && result.reason === 'existing_active') {
          return {
            serviceId: service.id,
            status: 'unchanged',
            message: 'אייקון פעיל קיים.',
          };
        }

        if (!result.ok) {
          return {
            serviceId: service.id,
            status: 'failed',
            message: result.reason || 'רענון אייקון נכשל',
          };
        }

        return {
          serviceId: service.id,
          status: 'refreshed',
          message: 'עודכן',
        };
      }),
    );
    items.push(...results);
    if (i + concurrency < services.length) {
      await delay(INTER_BATCH_DELAY_MS);
    }
  }

  return {
    total: items.length,
    refreshed: items.filter((i) => i.status === 'refreshed').length,
    skippedAdmin: items.filter((i) => i.status === 'skipped_admin').length,
    failed: items.filter((i) => i.status === 'failed').length,
    unchanged: items.filter((i) => i.status === 'unchanged').length,
    items,
  };
}
