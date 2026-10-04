import type { VaultState } from './vault';

/**
 * AD-123-18 amendment A — ids created locally and not yet confirmed in the cloud. Persisted in
 * the encrypted vault payload; the only rows a sync may INSERT. An id leaves the outbox only
 * after its insert (or its presence in the cloud) is confirmed, or when the row is gone locally.
 *
 * `serviceIds` = app memberships (catalog apps and custom sites alike: a custom site's registry
 * row is written before the local commit, its membership is the part that may be unconfirmed).
 */
export interface SyncOutbox {
  serviceIds: string[];
  profileIds: string[];
}

export interface ConfirmedInserts {
  serviceIds: string[];
  profileIds: string[];
}

export function emptySyncOutbox(): SyncOutbox {
  return { serviceIds: [], profileIds: [] };
}

function idList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((id): id is string => typeof id === 'string').map((id) => id.trim());
  return [...new Set(ids.filter(Boolean))];
}

/** Existing vaults have no outbox → empty (their rows follow the "deleted elsewhere" rule). */
export function normalizeSyncOutbox(raw: unknown): SyncOutbox {
  if (typeof raw !== 'object' || raw === null) return emptySyncOutbox();
  const value = raw as Partial<Record<keyof SyncOutbox, unknown>>;
  return { serviceIds: idList(value.serviceIds), profileIds: idList(value.profileIds) };
}

export function outboxOf(state: VaultState): SyncOutbox {
  return state.syncOutbox ?? emptySyncOutbox();
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function withOutbox(state: VaultState, outbox: SyncOutbox): VaultState {
  const current = outboxOf(state);
  if (sameIds(current.serviceIds, outbox.serviceIds) && sameIds(current.profileIds, outbox.profileIds)) {
    return state.syncOutbox ? state : { ...state, syncOutbox: outbox };
  }
  return { ...state, syncOutbox: outbox };
}

/**
 * Rows this session dropped as deleted elsewhere. A stale screen may still hand such a row back;
 * it is then not a local creation. A deliberate re-add of an app lifts its entry.
 */
const droppedServiceIds = new Set<string>();
const droppedProfileIds = new Set<string>();

export function noteDroppedRows(serviceIds: Iterable<string>, profileIds: Iterable<string>): void {
  for (const id of serviceIds) droppedServiceIds.add(id.trim());
  for (const id of profileIds) droppedProfileIds.add(id);
}

/**
 * Confirmations that arrived before the state carrying their outbox entry was committed (a save
 * that awaits its cloud sync). Applied once that state is committed.
 */
const earlyServiceIds = new Set<string>();
const earlyProfileIds = new Set<string>();

export function noteDeliberateAdd(serviceId: string): void {
  droppedServiceIds.delete(serviceId.trim());
  earlyServiceIds.delete(serviceId.trim());
}

export function clearDroppedRows(): void {
  droppedServiceIds.clear();
  droppedProfileIds.clear();
  earlyServiceIds.clear();
  earlyProfileIds.clear();
}

/** Keeps the confirmed ids that `state`'s outbox does not hold (yet). */
export function rememberEarlyConfirmations(state: VaultState, confirmed: ConfirmedInserts): void {
  const outbox = outboxOf(state);
  for (const id of confirmed.serviceIds) {
    if (!outbox.serviceIds.includes(id.trim())) earlyServiceIds.add(id.trim());
  }
  for (const id of confirmed.profileIds) {
    if (!outbox.profileIds.includes(id)) earlyProfileIds.add(id);
  }
}

/** Early confirmations that `state`'s outbox now holds; they are consumed. */
export function takeEarlyConfirmations(state: VaultState): ConfirmedInserts {
  const outbox = outboxOf(state);
  const serviceIds = outbox.serviceIds.filter((id) => earlyServiceIds.has(id));
  const profileIds = outbox.profileIds.filter((id) => earlyProfileIds.has(id));
  for (const id of serviceIds) earlyServiceIds.delete(id);
  for (const id of profileIds) earlyProfileIds.delete(id);
  return { serviceIds, profileIds };
}

/**
 * A local change from `latest` (the committed state) to `next`: new apps / profiles enter the
 * outbox, ids no longer present in `next` leave it. The base is `latest`'s outbox, so a confirmed
 * (cleared) id is not brought back by a `next` built from an older state.
 */
export function recordLocalCreations(latest: VaultState, next: VaultState): VaultState {
  const base = outboxOf(latest);
  const latestServices = new Set(latest.selectedIds.map((id) => id.trim()));
  const latestProfiles = new Set(latest.accessProfiles.map((p) => p.id));
  const nextServices = [...new Set(next.selectedIds.map((id) => id.trim()).filter(Boolean))];
  const nextProfiles = next.accessProfiles.map((p) => p.id);

  const serviceIds = base.serviceIds.filter((id) => nextServices.includes(id));
  for (const id of nextServices) {
    if (!latestServices.has(id) && !droppedServiceIds.has(id) && !serviceIds.includes(id)) {
      serviceIds.push(id);
    }
  }
  const profileIds = base.profileIds.filter((id) => nextProfiles.includes(id));
  for (const id of nextProfiles) {
    if (!latestProfiles.has(id) && !droppedProfileIds.has(id) && !profileIds.includes(id)) {
      profileIds.push(id);
    }
  }
  return withOutbox(next, { serviceIds, profileIds });
}

/** Confirmed inserts leave the outbox; returns `state` itself when nothing changes. */
export function clearConfirmedInserts(state: VaultState, confirmed: ConfirmedInserts): VaultState {
  const outbox = outboxOf(state);
  const services = new Set(confirmed.serviceIds.map((id) => id.trim()));
  const profiles = new Set(confirmed.profileIds);
  const serviceIds = outbox.serviceIds.filter((id) => !services.has(id));
  const profileIds = outbox.profileIds.filter((id) => !profiles.has(id));
  if (serviceIds.length === outbox.serviceIds.length && profileIds.length === outbox.profileIds.length) {
    return state;
  }
  return { ...state, syncOutbox: { serviceIds, profileIds } };
}

export function hasConfirmedInserts(confirmed: ConfirmedInserts): boolean {
  return confirmed.serviceIds.length > 0 || confirmed.profileIds.length > 0;
}
