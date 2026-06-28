import {
  discoveryFailure,
  discoverySuccess,
  type DiscoveryCandidate,
  type DiscoveryResult,
  type ModalLoginTrigger,
} from './discoveryResult';
import { documentFromHtml, normalizePrimaryUrl } from './discoveryUtils';
import {
  buildCommonPathCandidateEntries,
  inspectPageForLoginEntry,
} from './pageInspector';
import { followHttpRedirects, redirectResultLooksLikeLogin } from './redirectFollower';

export interface DiscoverLoginEntryOptions {
  /** Loaded document to inspect. Preferred when a tab or iframe is available. */
  document?: Document;

  /** HTML snapshot to parse when document is unavailable. */
  html?: string;

  /** URL associated with document/html (defaults to primaryUrl). */
  pageUrl?: string;

  /** Attempt HTTP redirect following before DOM inspection. Default true. */
  followRedirects?: boolean;

  /** Include common-path fallback candidates when no higher-confidence match exists. Default true. */
  tryCommonPaths?: boolean;
}

/**
 * Discovery priority (highest first):
 * 1. Dedicated login page on loaded document
 * 2. Visible login links
 * 3. Visible login buttons with navigable targets
 * 4. Modal/popup triggers with href
 * 5. HTTP redirect chain ending at login-like URL
 * 6. Common login path fallbacks (low confidence)
 */
export async function discoverLoginEntry(
  primaryUrl: string,
  options: DiscoverLoginEntryOptions = {},
): Promise<DiscoveryResult> {
  const normalizedPrimary = normalizePrimaryUrl(primaryUrl);
  if (!normalizedPrimary) {
    return discoveryFailure(primaryUrl, 'invalid_primary_url');
  }

  const followRedirects = options.followRedirects ?? true;
  const tryCommonPaths = options.tryCommonPaths ?? true;

  const allCandidates: DiscoveryCandidate[] = [];
  let modalTriggers: ModalLoginTrigger[] = [];
  let redirectChain: string[] | undefined;
  let finalUrlAfterRedirects: string | undefined;

  const pageUrl = options.pageUrl ?? normalizedPrimary;
  const htmlSnapshot = Boolean(options.html && !options.document);
  const documentRoot =
    options.document ??
    (options.html ? documentFromHtml(options.html) : undefined);

  if (documentRoot) {
    const inspection = inspectPageForLoginEntry(documentRoot, pageUrl, {
      htmlSnapshot,
    });
    allCandidates.push(...inspection.candidates);
    modalTriggers = inspection.modalTriggers;

    if (inspection.best) {
      return discoverySuccess(
        normalizedPrimary,
        inspection.best.url,
        inspection.best.method,
        inspection.best.confidence,
        {
          candidates: allCandidates,
          modalTrigger: modalTriggers[0],
        },
      );
    }
  }

  if (followRedirects && !normalizedPrimary.startsWith('/')) {
    const redirectResult = await followHttpRedirects(normalizedPrimary);
    redirectChain = redirectResult.redirectChain;
    finalUrlAfterRedirects = redirectResult.finalUrl;

    if (
      redirectResult.ok &&
      redirectResult.finalUrl &&
      redirectResult.finalUrl !== normalizedPrimary &&
      redirectResultLooksLikeLogin(redirectResult)
    ) {
      return discoverySuccess(
        normalizedPrimary,
        redirectResult.finalUrl,
        'redirect',
        'medium',
        {
          redirectChain,
          finalUrlAfterRedirects,
          candidates: allCandidates,
        },
      );
    }
  }

  if (tryCommonPaths) {
    const pathCandidates = buildCommonPathCandidateEntries(normalizedPrimary);
    allCandidates.push(...pathCandidates);

    const bestPath = [...pathCandidates].sort((a, b) => b.score - a.score)[0];
    if (bestPath) {
      return discoverySuccess(
        normalizedPrimary,
        bestPath.url,
        'common-path',
        'low',
        {
          redirectChain,
          finalUrlAfterRedirects,
          candidates: allCandidates,
          modalTrigger: modalTriggers[0],
        },
      );
    }
  }

  if (modalTriggers.length > 0) {
    return discoveryFailure(normalizedPrimary, 'modal_trigger_without_navigable_url', {
      redirectChain,
      finalUrlAfterRedirects,
      modalTrigger: modalTriggers[0],
      candidates: allCandidates,
    });
  }

  return discoveryFailure(normalizedPrimary, 'login_entry_not_found', {
    redirectChain,
    finalUrlAfterRedirects,
    candidates: allCandidates,
  });
}
