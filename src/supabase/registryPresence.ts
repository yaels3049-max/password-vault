import type { VaultState } from '../vault/vault';

/**
 * D-121-51 — a service deleted from the registry (Admin «מחיקת אתר») must not survive in a
 * user's local vault nor be re-upserted to user_services by dual-write. Generic: keyed only on
 * registry presence. The user's own private custom services are never judged here.
 */
export const REGISTRY_PRESENCE_RPC = 'registry_service_ids_existing';

interface RpcCapableClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
}

function customServiceIds(state: VaultState): Set<string> {
  return new Set(state.customServices.map((service) => service.id.trim()).filter(Boolean));
}

/** Service ids of selections and profiles, excluding the user's private custom services. */
export function registryPresenceCandidates(state: VaultState): string[] {
  const customs = customServiceIds(state);
  const ids = new Set<string>();
  for (const id of state.selectedIds) {
    const trimmed = id.trim();
    if (trimmed && !customs.has(trimmed)) ids.add(trimmed);
  }
  for (const profile of state.accessProfiles) {
    const trimmed = profile.serviceId.trim();
    if (trimmed && !customs.has(trimmed)) ids.add(trimmed);
  }
  return [...ids];
}

/**
 * Which of `serviceIds` exist in the registry (any status). `null` = unknown (no client, RPC
 * missing or failed, malformed answer, or an empty / unseeded registry) — callers then keep
 * today's behavior and drop nothing.
 */
export async function fetchRegistryPresence(
  client: RpcCapableClient | null,
  serviceIds: string[],
): Promise<Set<string> | null> {
  if (serviceIds.length === 0) {
    return new Set();
  }
  if (!client || typeof client.rpc !== 'function') {
    return null;
  }
  try {
    const { data, error } = await client.rpc(REGISTRY_PRESENCE_RPC, { p_service_ids: serviceIds });
    if (error || !data || typeof data !== 'object') {
      return null;
    }
    const { existing, registry_rows: registryRows } = data as { existing?: unknown; registry_rows?: unknown };
    if (!Array.isArray(existing) || typeof registryRows !== 'number' || registryRows <= 0) {
      return null;
    }
    return new Set(existing.filter((id): id is string => typeof id === 'string'));
  } catch {
    return null;
  }
}

/**
 * Drops every candidate service id missing from `present`: its selection, its local profiles and
 * their credentials. Private custom services are untouched.
 */
export function dropServicesMissingFromRegistry(
  state: VaultState,
  present: Set<string>,
): { state: VaultState; droppedIds: string[] } {
  const droppedIds = registryPresenceCandidates(state).filter((id) => !present.has(id));
  if (droppedIds.length === 0) {
    return { state, droppedIds };
  }
  const dropped = new Set(droppedIds);
  const droppedProfileIds = new Set(
    state.accessProfiles
      .filter((profile) => dropped.has(profile.serviceId.trim()))
      .map((profile) => profile.id),
  );
  const credentials: VaultState['credentials'] = {};
  for (const [profileId, credential] of Object.entries(state.credentials)) {
    if (!droppedProfileIds.has(profileId)) credentials[profileId] = credential;
  }
  return {
    state: {
      ...state,
      selectedIds: state.selectedIds.filter((id) => !dropped.has(id.trim())),
      accessProfiles: state.accessProfiles.filter((profile) => !droppedProfileIds.has(profile.id)),
      credentials,
    },
    droppedIds,
  };
}

/** Membership ids dual-write may upsert: registry-present ids and private customs only. */
export function upsertableSelectedIds(
  selectedIds: string[],
  state: VaultState,
  present: Set<string> | null,
): string[] {
  if (present === null) {
    return selectedIds;
  }
  const customs = customServiceIds(state);
  return selectedIds.filter((id) => customs.has(id) || present.has(id));
}
