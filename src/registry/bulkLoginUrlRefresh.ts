import type { ServiceDefinition } from '../service/serviceModel';
import { discoverAndPersistLoginUrl } from './loginUrlDiscovery';
import { shouldSkipAutomatedLoginDiscovery } from './loginUrlOverride';
import { clearRegistryCatalogCache, loadRegistryCatalog } from './registryLoader';
import { registryRowToServiceDefinition, type ServiceRegistryRow } from './registryMapper';

/** Manager Phase 108 defaults — client-side rate limit for bulk refresh. */
export const BULK_REFRESH_CONCURRENCY = 2;
export const BULK_REFRESH_INTER_BATCH_DELAY_MS = 500;

export interface BulkRefreshFailure {
  id: string;
  error: string;
}

export interface BulkRefreshSkipped {
  id: string;
  reason: string;
}

export interface BulkLoginUrlRefreshReport {
  succeeded: string[];
  failed: BulkRefreshFailure[];
  skipped: BulkRefreshSkipped[];
}

export interface BulkLoginUrlRefreshOptions {
  rows: ServiceRegistryRow[];
  forceAdminOverwrite?: boolean;
  source?: 'auto' | 'admin';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshSingleRow(
  row: ServiceRegistryRow,
  options: BulkLoginUrlRefreshOptions,
): Promise<'succeeded' | BulkRefreshFailure | BulkRefreshSkipped> {
  const skip = shouldSkipAutomatedLoginDiscovery(row, {
    forceAdminOverwrite: options.forceAdminOverwrite,
  });

  if (skip.skip) {
    return {
      id: row.id,
      reason: skip.reason ?? 'skipped',
    };
  }

  try {
    const definition: ServiceDefinition = registryRowToServiceDefinition(row);
    const result = await discoverAndPersistLoginUrl(definition, {
      primaryUrl: row.primary_url,
      force: true,
      forceAdminOverwrite: options.forceAdminOverwrite,
      source: options.source ?? 'auto',
    });

    if (result.skipped) {
      return {
        id: row.id,
        reason: 'discovery_skipped',
      };
    }

    return 'succeeded';
  } catch (error) {
    return {
      id: row.id,
      error: error instanceof Error ? error.message : 'discovery_failed',
    };
  }
}

/**
 * Rate-limited bulk login URL refresh (AC-108-13, AC-108-14, AC-108-15).
 */
export async function bulkRefreshLoginUrls(
  options: BulkLoginUrlRefreshOptions,
): Promise<BulkLoginUrlRefreshReport> {
  const report: BulkLoginUrlRefreshReport = {
    succeeded: [],
    failed: [],
    skipped: [],
  };

  const rows = options.rows;
  let index = 0;

  while (index < rows.length) {
    const batch = rows.slice(index, index + BULK_REFRESH_CONCURRENCY);
    const results = await Promise.all(batch.map((row) => refreshSingleRow(row, options)));

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i]!;
      const result = results[i]!;

      if (result === 'succeeded') {
        report.succeeded.push(row.id);
      } else if ('error' in result) {
        report.failed.push(result);
      } else {
        report.skipped.push(result);
      }
    }

    index += BULK_REFRESH_CONCURRENCY;

    if (index < rows.length) {
      await delay(BULK_REFRESH_INTER_BATCH_DELAY_MS);
    }
  }

  clearRegistryCatalogCache();
  await loadRegistryCatalog();

  return report;
}
