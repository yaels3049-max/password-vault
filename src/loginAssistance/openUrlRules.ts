/**
 * Phase 113 — open URL resolution (AC-113-1…3 / D-113-7).
 * loginUrl → else Home/`url` → else friendly message (no silent blank tab).
 */

import type { Service } from '../service/legacyService';
import { MSG_NO_OPEN_URL } from './messages';

export type OpenUrlSource = 'loginUrl' | 'homeUrl';

export type OpenUrlResolution =
  | { kind: 'open'; url: string; source: OpenUrlSource }
  | { kind: 'unavailable'; message: string };

/**
 * Resolve the URL used by Login Assistance open actions.
 * Distinct from getServiceOpenUrl: empty strings are treated as missing,
 * and unavailable yields a friendly Hebrew message instead of "".
 */
export function resolveLoginAssistanceOpenUrl(service: Service): OpenUrlResolution {
  const loginUrl = typeof service.loginUrl === 'string' ? service.loginUrl.trim() : '';
  if (loginUrl) {
    return { kind: 'open', url: loginUrl, source: 'loginUrl' };
  }

  const homeUrl = typeof service.url === 'string' ? service.url.trim() : '';
  if (homeUrl) {
    return { kind: 'open', url: homeUrl, source: 'homeUrl' };
  }

  return { kind: 'unavailable', message: MSG_NO_OPEN_URL };
}
