import { fetchSubmitterProfiles, type AdminRegistryRow, type SubmitterProfile } from './adminRegistryApi';

export type SubmitterProfileMap = Record<string, SubmitterProfile>;

/**
 * One `admin_submitter_profiles` call for the distinct owners of user-submitted rows.
 * Names are a display aid only: on failure the map is empty and labels fall back to «משתמש לא מזוהה».
 */
export async function loadSubmitterProfiles(rows: readonly AdminRegistryRow[]): Promise<SubmitterProfileMap> {
  const ownerIds = [
    ...new Set(
      rows
        .filter((row) => row.source_type === 'user')
        .map((row) => row.owner_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ownerIds.length === 0) return {};
  try {
    const found = await fetchSubmitterProfiles(ownerIds);
    return Object.fromEntries(found.map((profile) => [profile.id, profile]));
  } catch {
    return {};
  }
}
