import { isAdminProtectedAsset, readActiveIconPointer, type ActiveIconPointer } from './types';

/**
 * Discovery order (D-111-3) — discovery-time only; never blocks service create.
 * Phase 111 ships a stub that respects admin protection and records failure safely.
 * Full HTTP favicon crawl can extend this without changing create/path contracts.
 */
export type IconDiscoveryCandidateKind =
  | 'admin_approved'
  | 'existing_active'
  | 'apple_touch_icon'
  | 'favicon'
  | 'og_image'
  | 'fallback';

export const ICON_DISCOVERY_ORDER: IconDiscoveryCandidateKind[] = [
  'admin_approved',
  'existing_active',
  'apple_touch_icon',
  'favicon',
  'og_image',
  'fallback',
];

export interface IconDiscoveryResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  pointer?: ActiveIconPointer | null;
}

/**
 * Non-blocking icon discovery entry. Never throws to callers that wrap create.
 */
export async function discoverServiceIconSafe(
  serviceId: string,
  primaryUrl: string,
  metadata: Record<string, unknown> | null | undefined,
  options?: { force?: boolean },
): Promise<IconDiscoveryResult> {
  try {
    if (!options?.force && isAdminProtectedAsset(metadata)) {
      return {
        ok: true,
        skipped: true,
        reason: 'admin_protected',
        pointer: readActiveIconPointer(metadata),
      };
    }

    const existing = readActiveIconPointer(metadata);
    if (existing && !options?.force) {
      return {
        ok: true,
        skipped: true,
        reason: 'existing_active',
        pointer: existing,
      };
    }

    // Deterministic placeholder path: do not fetch third-party on create path.
    // Bulk/single refresh may later populate; create always succeeds with fallback paint.
    void serviceId;
    void primaryUrl;
    return {
      ok: false,
      skipped: false,
      reason: 'no_managed_icon_yet',
      pointer: null,
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'discovery_failed',
      pointer: null,
    };
  }
}
