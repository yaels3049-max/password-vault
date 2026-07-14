/**
 * Derive a stable registry service id from a primary site URL.
 * Matches built-in seed style (e.g. shufersal.co.il → shufersal, education.gov.il → education).
 */
export function deriveRegistryServiceIdFromUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  let hostname: string;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    hostname = new URL(withScheme).hostname.toLowerCase();
  } catch {
    return '';
  }

  hostname = hostname.replace(/^www\./, '');

  const israeliPublicSuffix = /\.(co|org|ac|gov|muni)\.il$/i;
  if (israeliPublicSuffix.test(hostname)) {
    hostname = hostname.replace(israeliPublicSuffix, '');
  } else {
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length >= 2) {
      hostname = parts[0];
    }
  }

  return hostname
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);
}

export async function allocateUniqueRegistryServiceId(
  primaryUrl: string,
  existingIds: Iterable<string>,
): Promise<string> {
  const base = deriveRegistryServiceIdFromUrl(primaryUrl);
  if (!base) {
    throw new Error('לא ניתן ליצור מזהה מכתובת האתר. בדקו שהכתובת תקינה.');
  }

  const taken = new Set(existingIds);
  if (!taken.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('לא ניתן ליצור מזהה ייחודי לאתר זה.');
}
