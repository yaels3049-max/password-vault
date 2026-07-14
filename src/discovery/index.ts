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
  FEDERATED_IDP_HOST_PREFIXES,
  LOGIN_PATH_SEGMENTS,
  LOGIN_TEXT_KEYWORDS,
  MAX_REDIRECT_HOPS,
} from './discoveryKeywords';

export {
  ALTERNATE_AUDIENCE_PATH_MARKERS,
  ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
  ALTERNATE_AUDIENCE_SUBDOMAIN_PREFIXES,
  ALTERNATE_AUDIENCE_WORDING,
  CONSUMER_LOGIN_MODAL_REASON,
  CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
  MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
  PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON,
  brandSecondLevelLabel,
  candidateLabelSuggestsAlternateAudience,
  canonicalizeFederatedIdPLoginUrl,
  evaluateLoginAudience,
  extractPageAudienceContextText,
  hasPrimaryBrandReturnEvidence,
  isAlternateAudiencePortalUrl,
  isCrossSubdomainCandidate,
  isFederatedIdPWithBrandReturn,
  isSameBrandHost,
  isSiblingTldSameBrand,
  isTrustedAuthSubdomain,
  isTrustedFederatedIdPHost,
  pathLooksLikeConsumerSignIn,
  pathLooksLikeFederatedIdPLogin,
  textHasAlternateAudienceWording,
  type CandidateAudienceContext,
  type LoginAudienceDecision,
} from './loginAudienceGate';

export {
  classifyDiscoveryReviewStatus,
  resolvePhase112Deferral,
  sanitizeDiscoveryResult,
  shouldPersistDiscoveredLoginUrl,
  type LoginIntelligenceHint,
  type Phase112DeferralFields,
} from './loginDiscoveryPolicy';

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
  buildTrustedAuthHostProbeUrls,
  TRUSTED_AUTH_PROBE_PREFIX_PRIORITY,
} from './trustedAuthProbe';

export {
  runLoginDiscoverySession,
  type LoginDiscoverySessionInput,
  type LoginDiscoverySessionResult,
} from './runLoginDiscovery';

export {
  htmlHasConsumerIdentityField,
  htmlLooksLikeLoginSpaShell,
} from './liveCandidateValidation';

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
