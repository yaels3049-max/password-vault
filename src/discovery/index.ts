export {
  discoverLoginEntry,
  type DiscoverLoginEntryOptions,
} from './discoverLoginEntry';

export {
  discoveryFailure,
  discoverySuccess,
  type DiscoveryCandidate,
  type DiscoveryConfidence,
  type DiscoveryMethod,
  type DiscoveryResult,
  type ModalLoginTrigger,
} from './discoveryResult';

export {
  AUTH_SUBDOMAIN_PREFIXES,
  COMMON_LOGIN_PATH_FALLBACKS,
  DISCOVERY_FETCH_TIMEOUT_MS,
  LOGIN_PATH_SEGMENTS,
  LOGIN_TEXT_KEYWORDS,
  MAX_REDIRECT_HOPS,
} from './discoveryKeywords';

export {
  buildCommonPathCandidates,
  documentFromHtml,
  normalizePrimaryUrl,
  resolveHref,
  textMatchesLoginKeyword,
  urlLooksLikeLoginDestination,
} from './discoveryUtils';

export {
  buildCommonPathCandidateEntries,
  findModalLoginTriggers,
  findVisibleLoginButtons,
  findVisibleLoginLinks,
  inspectDedicatedLoginPage,
  inspectPageForLoginEntry,
} from './pageInspector';

export {
  followHttpRedirects,
  redirectResultLooksLikeLogin,
  type RedirectFollowResult,
} from './redirectFollower';

export {
  fetchPageHtmlForDiscovery,
  type FetchPageHtmlResult,
} from './fetchPageHtml';

export {
  runLoginDiscoverySession,
  type LoginDiscoverySessionInput,
  type LoginDiscoverySessionResult,
} from './runLoginDiscovery';

export {
  hasVisiblePasswordField,
  isElementVisible,
  normalizedElementText,
} from './visibility';

export {
  discoverLogin,
  extensionTabDiscoveryExecutor,
  getDiscoveryExecutor,
  resetDiscoveryExecutor,
  setDiscoveryExecutor,
  type DiscoveryExecutionOutcome,
  type DiscoveryExecutor,
} from './execution';
