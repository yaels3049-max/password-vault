(() => {
  // src/discovery/discoveryResult.ts
  function discoveryFailure(primaryUrl, reason, partial) {
    return {
      success: false,
      primaryUrl,
      reason,
      ...partial
    };
  }
  function discoverySuccess(primaryUrl, loginUrl, method, confidence, partial) {
    return {
      success: true,
      primaryUrl,
      loginUrl,
      method,
      confidence,
      loginEntryType: partial?.loginEntryType ?? "navigable",
      usesModal: partial?.usesModal ?? false,
      ...partial
    };
  }

  // src/discovery/discoveryKeywords.ts
  var LOGIN_TEXT_KEYWORDS = [
    "login",
    "log in",
    "log-in",
    "signin",
    "sign in",
    "sign-in",
    "sign on",
    "account",
    "\u05D4\u05EA\u05D7\u05D1\u05E8",
    "\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA",
    "\u05DB\u05E0\u05D9\u05E1\u05D4",
    "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF",
    "\u05D4\u05D9\u05DB\u05E0\u05E1",
    "member login",
    "my account"
  ];
  var LOGIN_PATH_SEGMENTS = [
    "/login",
    "/log-in",
    "/signin",
    "/sign-in",
    "/account/login",
    "/account/signin",
    "/users/login",
    "/user/login",
    "/auth/login",
    "/authentication/login",
    "/portal/login",
    "/online/he/login",
    "/onlineweb/general/login.aspx"
  ];
  var AUTH_SUBDOMAIN_PREFIXES = [
    "login",
    "signin",
    "auth",
    "account",
    "accounts",
    "myaccount",
    "e-services",
    "eservices",
    // Bank Jerusalem-class: services.bankjerusalem.co.il/Pages/Login.aspx
    "services",
    "secure",
    "id",
    "online",
    // Federated / parent IdP hosts (D-108-27) — also same-brand probeable.
    "sso",
    "identity"
  ];
  var FEDERATED_IDP_HOST_PREFIXES = [
    "id",
    "login",
    "auth",
    "accounts",
    "sso",
    "identity"
  ];
  var COMMON_LOGIN_PATH_FALLBACKS = [
    "/login",
    "/signin",
    "/sign-in",
    "/account/login",
    "/user/login",
    "/auth/login"
  ];
  var MAX_REDIRECT_HOPS = 10;
  var DISCOVERY_FETCH_TIMEOUT_MS = 12e3;

  // src/discovery/loginAudienceGate.ts
  var ALTERNATE_AUDIENCE_SUBDOMAIN_PREFIXES = [
    "sa",
    "seller",
    "sellers",
    "merchant",
    "merchants",
    "vendor",
    "vendors",
    "partner",
    "partners",
    "business",
    "admin",
    "admins",
    "b2b",
    "corporate",
    "reseller",
    "wholesale",
    "affiliate",
    "dealer",
    "supplier",
    "suppliers",
    "employee",
    "employees",
    "staff",
    "intranet",
    "portal-b2b",
    "biz",
    "manage",
    "management",
    "sellersarea",
    "sellerarea"
  ];
  var ALTERNATE_AUDIENCE_PATH_MARKERS = [
    "/seller",
    "/merchant",
    "/vendor",
    "/partner",
    "/business",
    "/admin",
    "/b2b",
    "/corporate",
    "/reseller",
    "/wholesale",
    "/affiliate",
    "/employee",
    "/staff",
    "/intranet",
    "/manage",
    "/management",
    "/clients",
    "/client/",
    "clientslogin",
    "clients_login",
    "client-login",
    "sellerlogin",
    "merchantlogin",
    "partnerlogin",
    "businesslogin",
    "vendorlogin"
  ];
  var ALTERNATE_AUDIENCE_LOGIN_PATH_RE = /(clients?|sellers?|merchants?|vendors?|partners?|business|b2b|affiliate|wholesale|corporate)[_-]?(area|portal|zone)?[_-]?login|login[_-]?(clients?|sellers?|merchants?|vendors?|partners?|business)/i;
  var ALTERNATE_AUDIENCE_QUERY_KEYS = [
    "typeentry",
    "entrytype",
    "usertype",
    "user_type",
    "portaltype",
    "portal_type",
    "accounttype",
    "account_type",
    "role",
    "audience"
  ];
  var ALTERNATE_AUDIENCE_WORDING = [
    "business",
    "merchant",
    "seller",
    "vendor",
    "partner",
    "affiliate",
    "wholesale",
    "reseller",
    "corporate",
    "employee",
    "staff",
    "admin",
    "b2b",
    "dealer",
    "supplier",
    "intranet",
    "management",
    "service provider",
    "business interface",
    "business portal",
    "seller area",
    "clientslogin",
    "clients login",
    "typeentry",
    "entrytype",
    "\u05E2\u05E1\u05E7\u05D9",
    "\u05E2\u05E1\u05E7\u05D9\u05EA",
    "\u05D4\u05E2\u05E1\u05E7",
    "\u05DC\u05E2\u05E1\u05E7\u05D9\u05DD",
    "\u05DE\u05DE\u05E9\u05E7 \u05D4\u05E2\u05E1\u05E7",
    "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05DE\u05DE\u05E9\u05E7 \u05D4\u05E2\u05E1\u05E7",
    "\u05DC\u05DE\u05DE\u05E9\u05E7",
    "\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05E2\u05E1\u05E7\u05D9\u05D9\u05DD",
    "\u05DB\u05E0\u05D9\u05E1\u05EA \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05E2\u05E1\u05E7\u05D9\u05D9\u05DD",
    "\u05E1\u05D5\u05D7\u05E8",
    "\u05E1\u05D5\u05D7\u05E8\u05D9\u05DD",
    "\u05E1\u05E4\u05E7",
    "\u05E1\u05E4\u05E7\u05D9\u05DD",
    "\u05E9\u05D5\u05EA\u05E3",
    "\u05E9\u05D5\u05EA\u05E4\u05D9\u05DD",
    "\u05E2\u05D5\u05D1\u05D3",
    "\u05E2\u05D5\u05D1\u05D3\u05D9\u05DD",
    "\u05DE\u05E0\u05D4\u05DC \u05DE\u05E2\u05E8\u05DB\u05EA",
    "\u05DE\u05DE\u05E9\u05E7 \u05E0\u05D9\u05D4\u05D5\u05DC",
    "\u05E0\u05D9\u05D4\u05D5\u05DC \u05D7\u05E0\u05D5\u05EA",
    "\u05D0\u05D6\u05D5\u05E8 \u05E2\u05E1\u05E7\u05D9"
  ];
  var MODAL_WITH_ALTERNATE_AUDIENCE_REASON = "Consumer login is modal-based; alternate portal candidate rejected.";
  var CONSUMER_LOGIN_MODAL_REASON = "Consumer login appears modal-based on the primary site; no dedicated consumer login URL was validated.";
  var ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON = "Discovered login candidate belongs to another audience (business/admin/merchant/vendor/partner), not the consumer service.";
  var CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON = "Cross-subdomain login candidate needs review; same brand alone is not sufficient confidence.";
  var PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON = "Candidate page title/navigation indicates a non-consumer portal audience.";
  function registrableDomainKey(hostname) {
    const host = hostname.replace(/^www\./i, "").toLowerCase();
    const israeliPublicSuffix = /\.(co|org|ac|gov|muni)\.il$/i;
    if (israeliPublicSuffix.test(host)) {
      const withoutSuffix = host.replace(israeliPublicSuffix, "");
      const labels2 = withoutSuffix.split(".").filter(Boolean);
      return labels2[labels2.length - 1] ?? host;
    }
    const labels = host.split(".").filter(Boolean);
    if (labels.length >= 2) {
      return labels.slice(-2).join(".");
    }
    return host;
  }
  function subdomainLabels(hostname) {
    const host = hostname.replace(/^www\./i, "").toLowerCase();
    const israeliPublicSuffix = /\.(co|org|ac|gov|muni)\.il$/i;
    let remainder = host;
    if (israeliPublicSuffix.test(host)) {
      remainder = host.replace(israeliPublicSuffix, "");
    } else {
      const labels = host.split(".").filter(Boolean);
      if (labels.length >= 2) {
        remainder = labels.slice(0, -2).join(".");
      } else {
        remainder = "";
      }
    }
    return remainder.split(".").filter(Boolean);
  }
  function sameHostname(a, b) {
    return a.replace(/^www\./i, "").toLowerCase() === b.replace(/^www\./i, "").toLowerCase();
  }
  function brandSecondLevelLabel(hostname) {
    const host = hostname.replace(/^www\./i, "").toLowerCase();
    const israeliPublicSuffix = /\.(co|org|ac|gov|muni)\.il$/i;
    if (israeliPublicSuffix.test(host)) {
      const withoutSuffix = host.replace(israeliPublicSuffix, "");
      const labels2 = withoutSuffix.split(".").filter(Boolean);
      return (labels2[labels2.length - 1] ?? withoutSuffix).toLowerCase();
    }
    const labels = host.split(".").filter(Boolean);
    if (labels.length >= 2) {
      return (labels[labels.length - 2] ?? labels[0]).toLowerCase();
    }
    return host;
  }
  function isSiblingTldSameBrand(primaryUrl, candidateUrl) {
    try {
      const primary = new URL(primaryUrl);
      const candidate = new URL(candidateUrl);
      if (registrableDomainKey(primary.hostname) === registrableDomainKey(candidate.hostname)) {
        return false;
      }
      const a = brandSecondLevelLabel(primary.hostname);
      const b = brandSecondLevelLabel(candidate.hostname);
      return a.length >= 3 && a === b;
    } catch {
      return false;
    }
  }
  function isSameBrandHost(primaryUrl, candidateUrl) {
    try {
      const primary = new URL(primaryUrl);
      const candidate = new URL(candidateUrl);
      if (registrableDomainKey(primary.hostname) === registrableDomainKey(candidate.hostname)) {
        return true;
      }
      return isSiblingTldSameBrand(primaryUrl, candidateUrl);
    } catch {
      return false;
    }
  }
  function textHasAlternateAudienceWording(text) {
    const normalized = text.toLowerCase();
    return ALTERNATE_AUDIENCE_WORDING.some((token) => normalized.includes(token.toLowerCase()));
  }
  function stripApplicationShellPathTokens(path) {
    return path.toLowerCase().replace(/\/ng-portals(?=\/|$)/g, "").replace(/\/portals(?=\/|$)/g, "").replace(/\/portal(?=\/|$)/g, "");
  }
  function isAlternateAudiencePortalUrl(url) {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      const search = parsed.search.toLowerCase();
      const pathForWording = stripApplicationShellPathTokens(path);
      const haystack = `${parsed.hostname}${pathForWording}${parsed.search}`.toLowerCase();
      const subs = subdomainLabels(parsed.hostname);
      if (subs.some(
        (label) => ALTERNATE_AUDIENCE_SUBDOMAIN_PREFIXES.includes(
          label
        )
      )) {
        return true;
      }
      if (ALTERNATE_AUDIENCE_PATH_MARKERS.some((marker) => path.includes(marker))) {
        return true;
      }
      if (ALTERNATE_AUDIENCE_LOGIN_PATH_RE.test(pathForWording)) {
        return true;
      }
      for (const key of ALTERNATE_AUDIENCE_QUERY_KEYS) {
        if (search.includes(`${key}=`)) {
          return true;
        }
      }
      return textHasAlternateAudienceWording(haystack);
    } catch {
      return false;
    }
  }
  function candidateLabelSuggestsAlternateAudience(label) {
    if (!label) {
      return false;
    }
    return textHasAlternateAudienceWording(label);
  }
  function isCrossSubdomainCandidate(primaryUrl, candidateUrl) {
    try {
      const primary = new URL(primaryUrl);
      const candidate = new URL(candidateUrl);
      if (registrableDomainKey(primary.hostname) !== registrableDomainKey(candidate.hostname)) {
        return true;
      }
      return !sameHostname(primary.hostname, candidate.hostname);
    } catch {
      return true;
    }
  }
  function isTrustedAuthSubdomain(hostname) {
    const subs = subdomainLabels(hostname);
    return subs.some(
      (label) => AUTH_SUBDOMAIN_PREFIXES.includes(label)
    );
  }
  function isTrustedFederatedIdPHost(hostname) {
    const subs = subdomainLabels(hostname);
    return subs.some(
      (label) => FEDERATED_IDP_HOST_PREFIXES.includes(
        label
      )
    );
  }
  var BRAND_RETURN_QUERY_KEYS = [
    "continue",
    "callback",
    "return",
    "return_url",
    "returnurl",
    "redirect_uri",
    "redirect_url",
    "redirect",
    "next",
    "relaystate",
    "application",
    "dest",
    "destination",
    "goto"
  ];
  function primaryBrandTokens(hostname) {
    const host = hostname.replace(/^www\./i, "").toLowerCase();
    const tokens = /* @__PURE__ */ new Set([host]);
    const key = registrableDomainKey(hostname).toLowerCase();
    tokens.add(key);
    if (key.includes(".")) {
      tokens.add(key.split(".")[0] ?? key);
    }
    return [...tokens].filter((t) => t.length >= 3);
  }
  function valueContainsPrimaryBrand(value, tokens, primaryHost) {
    let decoded = value;
    try {
      decoded = decodeURIComponent(value);
    } catch {
    }
    const hay = decoded.toLowerCase();
    const host = primaryHost.replace(/^www\./i, "").toLowerCase();
    if (hay.includes(host)) {
      return true;
    }
    for (const token of tokens) {
      const t = token.toLowerCase();
      if (t.length >= 4 && hay.includes(t)) {
        return true;
      }
      if (t.length === 3) {
        const re = new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`, "i");
        if (re.test(hay)) {
          return true;
        }
      }
    }
    return false;
  }
  function hasPrimaryBrandReturnEvidence(primaryUrl, candidateUrl) {
    try {
      const primary = new URL(primaryUrl);
      const candidate = new URL(candidateUrl);
      const tokens = primaryBrandTokens(primary.hostname);
      for (const [rawKey, value] of candidate.searchParams.entries()) {
        const key = rawKey.toLowerCase();
        const isReturnKey = BRAND_RETURN_QUERY_KEYS.includes(key) || key.startsWith("redirect_");
        if (!isReturnKey) {
          continue;
        }
        if (valueContainsPrimaryBrand(value, tokens, primary.hostname)) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
  function pathLooksLikeFederatedIdPLogin(url) {
    try {
      const path = new URL(url).pathname.toLowerCase();
      return /(?:^|\/)(?:login|signin|sign-in|logon|sso|auth|signup|sign-up|register)(?:\/|$|\.)/i.test(
        path
      );
    } catch {
      return false;
    }
  }
  function canonicalizeFederatedIdPLoginUrl(primaryUrl, candidateUrl) {
    try {
      const parsed = new URL(candidateUrl);
      if (!isTrustedFederatedIdPHost(parsed.hostname)) {
        return candidateUrl;
      }
      if (!hasPrimaryBrandReturnEvidence(primaryUrl, candidateUrl)) {
        return candidateUrl;
      }
      if (!pathLooksLikeFederatedIdPLogin(candidateUrl)) {
        return candidateUrl;
      }
      const path = parsed.pathname.toLowerCase().replace(/\/$/, "") || "/";
      if (path === "/signup" || path === "/sign-up" || path === "/register") {
        parsed.pathname = "/login";
        return parsed.toString();
      }
      return candidateUrl;
    } catch {
      return candidateUrl;
    }
  }
  function isFederatedIdPWithBrandReturn(primaryUrl, candidateUrl) {
    try {
      const host = new URL(candidateUrl).hostname;
      return isTrustedFederatedIdPHost(host) && pathLooksLikeFederatedIdPLogin(candidateUrl) && hasPrimaryBrandReturnEvidence(primaryUrl, candidateUrl);
    } catch {
      return false;
    }
  }
  function pathLooksLikeDedicatedConsumerLogin(url) {
    try {
      const path = new URL(url).pathname.toLowerCase();
      return /(?:^|\/)pages\/login\.aspx$/i.test(path) || /(?:^|\/)(?:login|signin|sign-in|logon)\.aspx$/i.test(path);
    } catch {
      return false;
    }
  }
  function pathLooksLikeConsumerSignIn(url) {
    try {
      const path = new URL(url).pathname.toLowerCase().replace(/\/$/, "") || "/";
      return /(?:^|\/)(?:login|signin|sign-in|logon|auth)(?:\/|$|\.)/i.test(path);
    } catch {
      return false;
    }
  }
  function extractPageAudienceContextText(documentRoot) {
    const parts = [];
    const title = documentRoot.title?.trim();
    if (title) {
      parts.push(title);
    }
    for (const el of documentRoot.querySelectorAll('h1, h2, h3, [role="heading"], nav, header')) {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) {
        parts.push(text.slice(0, 240));
      }
    }
    return parts.join(" | ").slice(0, 4e3);
  }
  function evaluateLoginAudience(primaryUrl, candidateUrl, options) {
    let candidateHost;
    try {
      candidateHost = new URL(candidateUrl).hostname;
    } catch {
      return {
        accept: false,
        code: "invalid_candidate_url",
        reason: "invalid_candidate_url",
        preferModalClassification: false
      };
    }
    if (!isFederatedIdPWithBrandReturn(primaryUrl, candidateUrl) && (isAlternateAudiencePortalUrl(candidateUrl) || candidateLabelSuggestsAlternateAudience(options?.label))) {
      return {
        accept: false,
        code: "alternate_audience_portal",
        reason: ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
        preferModalClassification: true
      };
    }
    if (isFederatedIdPWithBrandReturn(primaryUrl, candidateUrl)) {
      return { accept: true };
    }
    const sameBrand = isSameBrandHost(primaryUrl, candidateUrl);
    let primaryHostForCompare = "";
    try {
      primaryHostForCompare = new URL(primaryUrl).hostname;
    } catch {
      primaryHostForCompare = "";
    }
    const sameHost = primaryHostForCompare !== "" && sameHostname(primaryHostForCompare, candidateHost);
    const siblingTld = isSiblingTldSameBrand(primaryUrl, candidateUrl);
    const trustedOrDedicated = sameBrand && (isTrustedAuthSubdomain(candidateHost) || pathLooksLikeDedicatedConsumerLogin(candidateUrl) || // D-108-29: consumer sign-in on same host OR sibling-TLD only —
    // not arbitrary same-brand subdomains (payments.*/login stays rejected).
    pathLooksLikeConsumerSignIn(candidateUrl) && (sameHost || siblingTld));
    if (trustedOrDedicated) {
      return { accept: true };
    }
    const contextBlob = [options?.label, options?.pageTitle, options?.pageContextText].filter(Boolean).join(" | ");
    const crossSub = isCrossSubdomainCandidate(primaryUrl, candidateUrl);
    if (contextBlob && textHasAlternateAudienceWording(contextBlob) && crossSub) {
      return {
        accept: false,
        code: "alternate_audience_portal",
        reason: ALTERNATE_AUDIENCE_PORTAL_REJECTED_REASON,
        preferModalClassification: true
      };
    }
    if (options?.pageTitle && textHasAlternateAudienceWording(options.pageTitle) && crossSub) {
      return {
        accept: false,
        code: "page_context_alternate_audience",
        reason: PAGE_CONTEXT_ALTERNATE_AUDIENCE_REASON,
        preferModalClassification: Boolean(options.primaryHasModalLoginTrigger)
      };
    }
    if (crossSub) {
      if (options?.primaryHasModalLoginTrigger) {
        return {
          accept: false,
          code: "cross_subdomain_untrusted",
          reason: CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
          preferModalClassification: true
        };
      }
      return {
        accept: false,
        code: "cross_subdomain_untrusted",
        reason: CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON,
        preferModalClassification: false
      };
    }
    return { accept: true };
  }

  // src/discovery/discoveryUtils.ts
  function normalizePrimaryUrl(primaryUrl) {
    const trimmed = primaryUrl.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith("/")) {
      return trimmed;
    }
    try {
      const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      return new URL(withScheme).href;
    } catch {
      return null;
    }
  }
  function resolveHref(href, baseUrl) {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) {
      return null;
    }
    try {
      return new URL(trimmed, baseUrl).href;
    } catch {
      return null;
    }
  }
  function textMatchesLoginKeyword(text) {
    const normalized = text.toLowerCase();
    return LOGIN_TEXT_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }
  function urlLooksLikeLoginDestination(url) {
    try {
      if (isAlternateAudiencePortalUrl(url)) {
        return false;
      }
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      const host = parsed.hostname.toLowerCase();
      if (LOGIN_PATH_SEGMENTS.some((segment) => path.includes(segment))) {
        return true;
      }
      const labels = host.split(".");
      if (labels.length >= 2) {
        const subdomain = labels[0];
        if (AUTH_SUBDOMAIN_PREFIXES.includes(
          subdomain
        )) {
          return true;
        }
      }
      return /(?:^|\/)(?:login|signin|sign-in|auth)(?:\/|$|\.)/i.test(path);
    } catch {
      return false;
    }
  }
  function buildCommonPathCandidates(primaryUrl) {
    const normalized = normalizePrimaryUrl(primaryUrl);
    if (!normalized || normalized.startsWith("/")) {
      return [];
    }
    let origin;
    try {
      origin = new URL(normalized).origin;
    } catch {
      return [];
    }
    return COMMON_LOGIN_PATH_FALLBACKS.map((path) => `${origin}${path}`);
  }
  function scoreLoginCandidate(options) {
    const { url, label, baseOrigin, methodWeight } = options;
    let score = methodWeight;
    if (textMatchesLoginKeyword(label)) {
      score += 8;
    }
    if (urlLooksLikeLoginDestination(url)) {
      score += 10;
    }
    try {
      const parsed = new URL(url);
      const candidateOrigin = parsed.origin;
      if (candidateOrigin === baseOrigin) {
        score += 3;
      } else if (isTrustedAuthSubdomain(parsed.hostname)) {
        score += 12;
      } else {
        score -= 2;
      }
    } catch {
      score -= 5;
    }
    return score;
  }
  function confidenceFromScore(score) {
    if (score >= 18) {
      return "high";
    }
    if (score >= 12) {
      return "medium";
    }
    return "low";
  }
  function documentFromHtml(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  // src/discovery/visibility.ts
  function isExplicitlyHidden(element) {
    if (element.hidden) {
      return true;
    }
    if ((element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLOptionElement) && element.disabled) {
      return true;
    }
    if (element instanceof HTMLInputElement && element.type === "hidden") {
      return true;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return true;
    }
    if (parseFloat(style.opacity) === 0) {
      return true;
    }
    return false;
  }
  function isElementVisible(element, options) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (options?.htmlSnapshot) {
      return !isExplicitlyHidden(element);
    }
    if (element.hidden) {
      return false;
    }
    if ((element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLOptionElement) && element.disabled) {
      return false;
    }
    if (element instanceof HTMLInputElement && element.type === "hidden") {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    if (parseFloat(style.opacity) === 0) {
      return false;
    }
    return element.getClientRects().length > 0;
  }
  function normalizedElementText(element) {
    const aria = element.getAttribute("aria-label") ?? "";
    const title = element.getAttribute("title") ?? "";
    const value = element instanceof HTMLInputElement || element instanceof HTMLButtonElement ? element.value ?? "" : "";
    const text = element.textContent ?? "";
    return [aria, title, value, text].join(" ").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function hasVisiblePasswordField(documentRoot, options) {
    const inputs = documentRoot.querySelectorAll('input[type="password"]');
    for (const input of inputs) {
      if (isElementVisible(input, options)) {
        return true;
      }
    }
    return false;
  }

  // src/discovery/pageInspector.ts
  var METHOD_WEIGHT = {
    "dedicated-login-page": 20,
    redirect: 14,
    "visible-link": 12,
    "visible-button": 11,
    "modal-trigger": 9,
    "common-path": 4
  };
  function baseOriginForUrl(url) {
    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  }
  function bestCandidate(candidates) {
    if (candidates.length === 0) {
      return null;
    }
    return [...candidates].sort((a, b) => b.score - a.score)[0] ?? null;
  }
  function inspectDedicatedLoginPage(documentRoot, pageUrl, options) {
    if (!hasVisiblePasswordField(documentRoot, options)) {
      return null;
    }
    const normalized = normalizePrimaryUrl(pageUrl);
    if (!normalized) {
      return null;
    }
    const score = scoreLoginCandidate({
      url: normalized,
      label: "login form",
      baseOrigin: baseOriginForUrl(normalized),
      methodWeight: METHOD_WEIGHT["dedicated-login-page"]
    });
    return {
      url: normalized,
      method: "dedicated-login-page",
      confidence: confidenceFromScore(score),
      label: "Dedicated login page",
      score
    };
  }
  function findVisibleLoginLinks(documentRoot, pageUrl, options) {
    const baseOrigin = baseOriginForUrl(pageUrl);
    const candidates = [];
    const anchors = documentRoot.querySelectorAll("a[href]");
    for (const anchor of anchors) {
      if (!isElementVisible(anchor, options)) {
        continue;
      }
      const href = anchor.getAttribute("href") ?? "";
      const resolved = resolveHref(href, pageUrl);
      if (!resolved) {
        continue;
      }
      const label = normalizedElementText(anchor);
      const hrefLooksLikeLogin = urlLooksLikeLoginDestination(resolved);
      if (!textMatchesLoginKeyword(label) && !hrefLooksLikeLogin) {
        continue;
      }
      const score = scoreLoginCandidate({
        url: resolved,
        label,
        baseOrigin,
        methodWeight: METHOD_WEIGHT["visible-link"]
      });
      candidates.push({
        url: resolved,
        method: "visible-link",
        confidence: confidenceFromScore(score),
        label,
        score
      });
    }
    return candidates;
  }
  function findVisibleLoginButtons(documentRoot, pageUrl, options) {
    const baseOrigin = baseOriginForUrl(pageUrl);
    const candidates = [];
    const selectors = [
      "button",
      '[role="button"]',
      'input[type="button"]',
      'input[type="submit"]'
    ];
    for (const selector of selectors) {
      const elements = documentRoot.querySelectorAll(selector);
      for (const element of elements) {
        if (!isElementVisible(element, options)) {
          continue;
        }
        const label = normalizedElementText(element);
        if (!textMatchesLoginKeyword(label)) {
          continue;
        }
        let resolved = null;
        if (element instanceof HTMLAnchorElement && element.href) {
          resolved = element.href;
        } else if (element instanceof HTMLButtonElement && element.form?.action) {
          resolved = resolveHref(element.form.action, pageUrl);
        }
        if (!resolved) {
          continue;
        }
        const score = scoreLoginCandidate({
          url: resolved,
          label,
          baseOrigin,
          methodWeight: METHOD_WEIGHT["visible-button"]
        });
        candidates.push({
          url: resolved,
          method: "visible-button",
          confidence: confidenceFromScore(score),
          label,
          score
        });
      }
    }
    return candidates;
  }
  var MODAL_TRIGGER_SELECTOR = [
    '[data-toggle="modal"]',
    '[data-bs-toggle="modal"]',
    '[aria-haspopup="dialog"]',
    '[aria-haspopup="true"]',
    "[aria-controls]"
  ].join(",");
  var NON_NAVIGABLE_LOGIN_CONTROL_SELECTOR = [
    "button",
    '[role="button"]',
    'input[type="button"]',
    'a[href="#"]',
    'a[href=""]',
    "a:not([href])"
  ].join(",");
  function isNonNavigableHref(href) {
    if (href == null || href.trim() === "") {
      return true;
    }
    const trimmed = href.trim().toLowerCase();
    return trimmed === "#" || trimmed.startsWith("#") || trimmed.startsWith("javascript:") || trimmed === "/";
  }
  function findModalLoginTriggers(documentRoot, pageUrl, options) {
    const baseOrigin = baseOriginForUrl(pageUrl);
    const candidates = [];
    const triggers = [];
    const seen = /* @__PURE__ */ new Set();
    const pushTrigger = (element) => {
      if (seen.has(element)) {
        return;
      }
      if (!isElementVisible(element, options)) {
        return;
      }
      const label = normalizedElementText(element);
      if (!textMatchesLoginKeyword(label)) {
        return;
      }
      seen.add(element);
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute("role") ?? void 0;
      let href;
      const rawHref = element.getAttribute("href");
      if (element instanceof HTMLAnchorElement && element.href && !isNonNavigableHref(rawHref)) {
        href = element.href;
      }
      triggers.push({ label, tagName, role, href });
      if (href) {
        const score = scoreLoginCandidate({
          url: href,
          label,
          baseOrigin,
          methodWeight: METHOD_WEIGHT["modal-trigger"]
        });
        candidates.push({
          url: href,
          method: "modal-trigger",
          confidence: confidenceFromScore(score),
          label,
          score
        });
      }
    };
    for (const element of documentRoot.querySelectorAll(MODAL_TRIGGER_SELECTOR)) {
      pushTrigger(element);
    }
    for (const element of documentRoot.querySelectorAll(NON_NAVIGABLE_LOGIN_CONTROL_SELECTOR)) {
      const rawHref = element.getAttribute("href");
      if (element.tagName.toLowerCase() === "a" && !isNonNavigableHref(rawHref)) {
        continue;
      }
      pushTrigger(element);
    }
    return { candidates, triggers };
  }
  function inspectPageForLoginEntry(documentRoot, pageUrl, options) {
    const candidates = [];
    const dedicated = inspectDedicatedLoginPage(documentRoot, pageUrl, options);
    if (dedicated) {
      candidates.push(dedicated);
    }
    candidates.push(...findVisibleLoginLinks(documentRoot, pageUrl, options));
    candidates.push(...findVisibleLoginButtons(documentRoot, pageUrl, options));
    const modal = findModalLoginTriggers(documentRoot, pageUrl, options);
    candidates.push(...modal.candidates);
    return {
      best: bestCandidate(candidates),
      candidates,
      modalTriggers: modal.triggers
    };
  }
  function buildCommonPathCandidateEntries(primaryUrl) {
    const normalized = normalizePrimaryUrl(primaryUrl);
    if (!normalized || normalized.startsWith("/")) {
      return [];
    }
    const baseOrigin = baseOriginForUrl(normalized);
    return buildCommonPathCandidates(normalized).map((url) => {
      const score = scoreLoginCandidate({
        url,
        label: url,
        baseOrigin,
        methodWeight: METHOD_WEIGHT["common-path"]
      });
      return {
        url,
        method: "common-path",
        confidence: "low",
        label: url,
        score
      };
    });
  }

  // src/discovery/redirectFollower.ts
  async function fetchWithTimeout(url, init) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), DISCOVERY_FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }
  async function followHttpRedirects(primaryUrl) {
    const normalized = normalizePrimaryUrl(primaryUrl);
    if (!normalized || normalized.startsWith("/")) {
      return {
        ok: false,
        primaryUrl,
        redirectChain: [],
        reason: "invalid_primary_url"
      };
    }
    const redirectChain = [];
    let currentUrl = normalized;
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
      let response;
      try {
        response = await fetchWithTimeout(currentUrl, {
          method: "GET",
          redirect: "manual",
          credentials: "omit",
          cache: "no-store"
        });
      } catch {
        return {
          ok: false,
          primaryUrl: normalized,
          finalUrl: currentUrl,
          redirectChain,
          reason: "redirect_fetch_failed"
        };
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (!location) {
          return {
            ok: false,
            primaryUrl: normalized,
            finalUrl: currentUrl,
            redirectChain,
            reason: "redirect_missing_location"
          };
        }
        let nextUrl;
        try {
          nextUrl = new URL(location, currentUrl).href;
        } catch {
          return {
            ok: false,
            primaryUrl: normalized,
            finalUrl: currentUrl,
            redirectChain,
            reason: "redirect_invalid_location"
          };
        }
        redirectChain.push(nextUrl);
        currentUrl = nextUrl;
        continue;
      }
      return {
        ok: true,
        primaryUrl: normalized,
        finalUrl: currentUrl,
        redirectChain
      };
    }
    return {
      ok: false,
      primaryUrl: normalized,
      finalUrl: currentUrl,
      redirectChain,
      reason: "redirect_limit_exceeded"
    };
  }
  function redirectResultLooksLikeLogin(result) {
    if (!result.finalUrl) {
      return false;
    }
    return urlLooksLikeLoginDestination(result.finalUrl);
  }

  // src/discovery/trustedAuthProbe.ts
  var TRUSTED_AUTH_PROBE_PREFIX_PRIORITY = [
    "auth",
    "login",
    "secure",
    "e-services",
    "eservices",
    "services",
    "signin",
    "account",
    "accounts",
    "myaccount",
    "id",
    "online"
  ];
  var MAX_AUTH_HOST_PROBES = 4;
  function registrableApexHostname(hostname) {
    const host = hostname.replace(/^www\./i, "").toLowerCase();
    const israeliPublicSuffix = /\.(co|org|ac|gov|muni)\.il$/i;
    if (israeliPublicSuffix.test(host)) {
      const withoutSuffix = host.replace(israeliPublicSuffix, "");
      const labels2 = withoutSuffix.split(".").filter(Boolean);
      const brand = labels2[labels2.length - 1] ?? withoutSuffix;
      const suffix = host.match(israeliPublicSuffix)?.[0] ?? ".co.il";
      return `${brand}${suffix}`;
    }
    const labels = host.split(".").filter(Boolean);
    if (labels.length >= 2) {
      return labels.slice(-2).join(".");
    }
    return host;
  }
  function orderedAuthPrefixes() {
    const seen = /* @__PURE__ */ new Set();
    const ordered = [];
    for (const prefix of TRUSTED_AUTH_PROBE_PREFIX_PRIORITY) {
      if (AUTH_SUBDOMAIN_PREFIXES.includes(
        prefix
      ) && !seen.has(prefix)) {
        seen.add(prefix);
        ordered.push(prefix);
      }
    }
    for (const prefix of AUTH_SUBDOMAIN_PREFIXES) {
      if (!seen.has(prefix)) {
        seen.add(prefix);
        ordered.push(prefix);
      }
    }
    return ordered;
  }
  function buildTrustedAuthHostProbeUrls(primaryUrl, maxProbes = MAX_AUTH_HOST_PROBES) {
    const normalized = normalizePrimaryUrl(primaryUrl);
    if (!normalized || normalized.startsWith("/")) {
      return [];
    }
    let primaryHost;
    let protocol;
    try {
      const parsed = new URL(normalized);
      primaryHost = parsed.hostname;
      protocol = parsed.protocol === "http:" ? "http:" : "https:";
    } catch {
      return [];
    }
    const apex = registrableApexHostname(primaryHost);
    const primaryIsTrusted = isTrustedAuthSubdomain(primaryHost);
    const urls = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (url) => {
      if (urls.length >= maxProbes) {
        return;
      }
      if (seen.has(url)) {
        return;
      }
      if (isAlternateAudiencePortalUrl(url)) {
        return;
      }
      if (!isSameBrandHost(normalized, url)) {
        return;
      }
      seen.add(url);
      urls.push(url);
    };
    for (const prefix of orderedAuthPrefixes()) {
      if (urls.length >= maxProbes) {
        break;
      }
      const host = `${prefix}.${apex}`;
      if (primaryIsTrusted && host === primaryHost.replace(/^www\./i, "").toLowerCase()) {
        continue;
      }
      for (const path of COMMON_LOGIN_PATH_FALLBACKS) {
        if (urls.length >= maxProbes) {
          break;
        }
        push(`${protocol}//${host}${path}`);
      }
    }
    return urls;
  }

  // src/discovery/liveCandidateValidation.ts
  function htmlHasConsumerIdentityField(documentRoot, options) {
    if (hasVisiblePasswordField(documentRoot, options)) {
      return true;
    }
    const identitySelectors = [
      'input[type="email"]',
      'input[type="tel"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[autocomplete="tel"]',
      'input[autocomplete="tel-national"]',
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[name*="phone" i]',
      'input[name*="mobile" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[id*="login" i]',
      'input[id*="phone" i]',
      'input[id*="mobile" i]',
      'input[placeholder*="email" i]',
      'input[placeholder*="user" i]',
      'input[placeholder*="phone" i]',
      'input[aria-label*="email" i]',
      'input[aria-label*="user" i]'
    ];
    for (const selector of identitySelectors) {
      try {
        if (documentRoot.querySelector(selector)) {
          return true;
        }
      } catch {
      }
    }
    return false;
  }
  function htmlLooksLikeLoginSpaShell(documentRoot) {
    const title = (documentRoot.title ?? "").trim();
    const h1 = (documentRoot.querySelector("h1")?.textContent ?? "").trim();
    const blob = `${title}
${h1}`.toLowerCase();
    return /sign[\s-]*in|log[\s-]*in|logon|כניסה|התחברות|signin|login/.test(blob);
  }

  // src/discovery/discoverLoginEntry.ts
  function isGenericLoginPathUrl(url) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "").toLowerCase() || "/";
      return COMMON_LOGIN_PATH_FALLBACKS.some((fallback) => {
        const normalized = fallback.replace(/\/$/, "").toLowerCase();
        return path === normalized;
      });
    } catch {
      return false;
    }
  }
  function probeHtmlLookupKey(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname.replace(/\/$/, "") || "/"}`;
    } catch {
      return url;
    }
  }
  async function loadProbeResult(url, options) {
    const key = probeHtmlLookupKey(url);
    if (options.probeHtmlByUrl) {
      for (const [mapKey, html] of Object.entries(options.probeHtmlByUrl)) {
        if (probeHtmlLookupKey(mapKey) === key || mapKey === url) {
          return {
            reached: true,
            ok: true,
            status: 200,
            html,
            finalUrl: url
          };
        }
      }
      if (!options.fetchProbeHtml) {
        return { reached: false };
      }
    }
    const fetcher = options.fetchProbeHtml;
    if (!fetcher) {
      return { reached: false };
    }
    const result = await fetcher(url);
    const reached = typeof result.reached === "boolean" ? result.reached : Boolean(result.ok) || typeof result.status === "number";
    if (!reached) {
      return { reached: false };
    }
    const status = typeof result.status === "number" ? result.status : result.ok ? 200 : 0;
    if (result.ok && typeof result.html === "string") {
      return {
        reached: true,
        ok: true,
        status: status || 200,
        html: result.html,
        finalUrl: result.finalUrl ?? url
      };
    }
    return {
      reached: true,
      ok: false,
      status: status || 0,
      html: typeof result.html === "string" ? result.html : void 0,
      finalUrl: result.finalUrl,
      dnsExists: result.dnsExists === true
    };
  }
  async function validateConsumerLoginPageUrl(primaryUrl, candidateUrl, options) {
    if (isAlternateAudiencePortalUrl(candidateUrl)) {
      return null;
    }
    const gate = evaluateLoginAudience(primaryUrl, candidateUrl, {
      primaryHasModalLoginTrigger: false
    });
    if (!gate.accept) {
      return null;
    }
    const inspectingThisLoginPage = (() => {
      if (!options.pageUrl) {
        return false;
      }
      try {
        return probeHtmlLookupKey(options.pageUrl) === probeHtmlLookupKey(candidateUrl);
      } catch {
        return false;
      }
    })();
    if (!inspectingThisLoginPage && (options.pageHasAlternatePortalCandidate || options.primaryHasModalLoginTrigger) && isSameHostBareCommonLoginPath(primaryUrl, candidateUrl)) {
      return null;
    }
    const isSameBrandTrustedAuthLoginPath = (url) => {
      try {
        const host = new URL(url).hostname;
        return isSameBrandHost(primaryUrl, url) && isTrustedAuthSubdomain(host) && (isGenericLoginPathUrl(url) || urlLooksLikeLoginDestination(url));
      } catch {
        return false;
      }
    };
    const isConsumerSignInSoftPath = (url) => {
      try {
        const primaryHost = new URL(primaryUrl).hostname;
        const candidateHost = new URL(url).hostname;
        const sameHost = primaryHost.replace(/^www\./i, "").toLowerCase() === candidateHost.replace(/^www\./i, "").toLowerCase();
        const sibling = isSiblingTldSameBrand(primaryUrl, url);
        const trusted = isTrustedAuthSubdomain(candidateHost);
        if (!isSameBrandHost(primaryUrl, url)) {
          return false;
        }
        if (!(sameHost || sibling || trusted)) {
          return false;
        }
        const pathOk = isGenericLoginPathUrl(url) || pathLooksLikeConsumerSignIn(url) || urlLooksLikeLoginDestination(url);
        if (!pathOk) {
          return false;
        }
        if (options.pageHasAlternatePortalCandidate && isGenericLoginPathUrl(url) && sameHost && !sibling && !trusted) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };
    const blockBareLoginSoftAcceptBesideModal = (url) => Boolean(options.primaryHasModalLoginTrigger) && isSameHostBareCommonLoginPath(primaryUrl, url);
    const softAcceptCandidate = () => ({
      // Prefer scored candidate URL (PayPal /login over bot redirect /signin).
      url: candidateUrl,
      method: "dedicated-login-page",
      confidence: "medium"
    });
    const acceptFromDocument = (documentRoot, page) => {
      if (isAlternateAudiencePortalUrl(page)) {
        return null;
      }
      const pageAudience = evaluateLoginAudience(primaryUrl, page, {
        pageTitle: documentRoot.title?.trim() || void 0,
        pageContextText: extractPageAudienceContextText(documentRoot),
        primaryHasModalLoginTrigger: false
      });
      if (!pageAudience.accept) {
        return null;
      }
      if (isDeadOrErrorLoginPage(documentRoot)) {
        return null;
      }
      const dedicated = inspectDedicatedLoginPage(documentRoot, page, {
        htmlSnapshot: true
      });
      if (dedicated) {
        return {
          url: page,
          method: "dedicated-login-page",
          confidence: dedicated.confidence === "low" ? "medium" : dedicated.confidence
        };
      }
      const hasIdentity = htmlHasConsumerIdentityField(documentRoot, {
        htmlSnapshot: true
      });
      const sameBrandConsumerSignIn = isSameBrandHost(primaryUrl, page) && (isGenericLoginPathUrl(page) || pathLooksLikeConsumerSignIn(page) || urlLooksLikeLoginDestination(page));
      if (hasIdentity && sameBrandConsumerSignIn) {
        return {
          url: page,
          method: "dedicated-login-page",
          confidence: "medium"
        };
      }
      if (isSameBrandTrustedAuthLoginPath(candidateUrl)) {
        return softAcceptCandidate();
      }
      if (isFederatedIdPWithBrandReturn(primaryUrl, page)) {
        return {
          url: page,
          method: "dedicated-login-page",
          confidence: "medium"
        };
      }
      if (isConsumerSignInSoftPath(page) && !blockBareLoginSoftAcceptBesideModal(page) && (hasIdentity || htmlLooksLikeLoginSpaShell(documentRoot))) {
        return softAcceptCandidate();
      }
      return null;
    };
    if (options.document && options.pageUrl) {
      try {
        const pageParsed = new URL(options.pageUrl);
        const candParsed = new URL(candidateUrl);
        const pageKey = `${pageParsed.origin}${pageParsed.pathname.replace(/\/$/, "") || "/"}`;
        const candKey = `${candParsed.origin}${candParsed.pathname.replace(/\/$/, "") || "/"}`;
        if (pageKey === candKey) {
          const fromDoc = acceptFromDocument(options.document, options.pageUrl);
          if (fromDoc) {
            return fromDoc;
          }
        }
      } catch {
      }
    }
    const probe = await loadProbeResult(candidateUrl, options);
    let effective = probe;
    if (!probe.reached && isSameBrandTrustedAuthLoginPath(candidateUrl)) {
      try {
        const originUrl = new URL(candidateUrl).origin + "/";
        const originProbe = await loadProbeResult(originUrl, options);
        if (originProbe.reached && originProbe.ok && originProbe.status < 400) {
          effective = {
            reached: true,
            ok: true,
            status: originProbe.status,
            html: originProbe.html ?? "",
            finalUrl: candidateUrl
          };
        }
      } catch {
      }
    }
    if (!effective.reached) {
      return null;
    }
    if (!effective.ok || effective.status >= 400) {
      if (isSameBrandTrustedAuthLoginPath(candidateUrl) && trustedAuthProbeMaySoftAccept(effective)) {
        return softAcceptCandidate();
      }
      if (isConsumerSignInSoftPath(candidateUrl) && trustedAuthProbeMaySoftAccept(effective) && !blockBareLoginSoftAcceptBesideModal(candidateUrl)) {
        const html2 = "html" in effective && typeof effective.html === "string" ? effective.html : void 0;
        if (isSameHostBareCommonLoginPath(primaryUrl, candidateUrl)) {
          if (looksLikeBotGateHtml(html2)) {
            return softAcceptCandidate();
          }
          return null;
        }
        return softAcceptCandidate();
      }
      return null;
    }
    const pageUrl = effective.ok && effective.finalUrl || candidateUrl;
    if (isAlternateAudiencePortalUrl(pageUrl)) {
      return null;
    }
    const finalGate = evaluateLoginAudience(primaryUrl, pageUrl, {
      primaryHasModalLoginTrigger: false
    });
    if (!finalGate.accept) {
      return null;
    }
    const html = "html" in effective && effective.ok ? effective.html ?? "" : "";
    if (html) {
      const documentRoot = documentFromHtml(html);
      if (probe.reached && isDeadOrErrorLoginPage(documentRoot)) {
        return null;
      }
      if (isAlternateAudiencePortalUrl(pageUrl)) {
        return null;
      }
      const pageAudience = evaluateLoginAudience(primaryUrl, pageUrl, {
        pageTitle: documentRoot.title?.trim() || void 0,
        pageContextText: extractPageAudienceContextText(documentRoot),
        primaryHasModalLoginTrigger: false
      });
      if (!pageAudience.accept) {
        return null;
      }
      if (probe.reached) {
        const dedicated = inspectDedicatedLoginPage(documentRoot, pageUrl, {
          htmlSnapshot: true
        });
        if (dedicated) {
          return softAcceptCandidate();
        }
      }
      const hasIdentity = htmlHasConsumerIdentityField(documentRoot, {
        htmlSnapshot: true
      });
      const sameBrandConsumerSignIn = isSameBrandHost(primaryUrl, pageUrl) && (isGenericLoginPathUrl(pageUrl) || pathLooksLikeConsumerSignIn(pageUrl) || urlLooksLikeLoginDestination(pageUrl));
      if (hasIdentity && sameBrandConsumerSignIn) {
        return softAcceptCandidate();
      }
      if (isSameBrandTrustedAuthLoginPath(candidateUrl)) {
        return softAcceptCandidate();
      }
      if (isFederatedIdPWithBrandReturn(primaryUrl, pageUrl)) {
        return {
          url: pageUrl,
          method: "dedicated-login-page",
          confidence: "medium"
        };
      }
      if (isConsumerSignInSoftPath(candidateUrl) && !blockBareLoginSoftAcceptBesideModal(candidateUrl) && (hasIdentity || htmlLooksLikeLoginSpaShell(documentRoot))) {
        return softAcceptCandidate();
      }
      return null;
    }
    if (isSameBrandTrustedAuthLoginPath(candidateUrl)) {
      return softAcceptCandidate();
    }
    if (isFederatedIdPWithBrandReturn(primaryUrl, candidateUrl)) {
      return softAcceptCandidate();
    }
    if (isConsumerSignInSoftPath(candidateUrl) && !isSameHostBareCommonLoginPath(primaryUrl, candidateUrl) && !blockBareLoginSoftAcceptBesideModal(candidateUrl)) {
      return softAcceptCandidate();
    }
    return null;
  }
  function trustedAuthProbeMaySoftAccept(probe) {
    if (probe.status === 404) {
      return false;
    }
    if (probe.dnsExists === true || probe.status === 0) {
      return true;
    }
    return probe.status === 401 || probe.status === 403 || probe.status === 429;
  }
  function looksLikeBotGateHtml(html) {
    if (!html) {
      return false;
    }
    return /datadome|captcha|cf-challenge|attention required|access denied|cloudflare|bot[\s_-]?detect|perimeterx|akamai/i.test(
      html
    );
  }
  function isSameHostBareCommonLoginPath(primaryUrl, candidateUrl) {
    try {
      const primaryHost = new URL(primaryUrl).hostname.replace(/^www\./i, "").toLowerCase();
      const candidateHost = new URL(candidateUrl).hostname.replace(/^www\./i, "").toLowerCase();
      return primaryHost === candidateHost && isGenericLoginPathUrl(candidateUrl);
    } catch {
      return false;
    }
  }
  function isDeadOrErrorLoginPage(documentRoot) {
    const title = (documentRoot.title ?? "").trim();
    const body = (documentRoot.body?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    const blob = `${title}
${body}`;
    return /(?:^|\b)404\b|not found|page not found|cannot be found|doesn't exist|דף לא נמצא|העמוד לא נמצא|לא קיים/i.test(
      blob
    );
  }
  function isEmbeddedHomepageLoginForm(primaryUrl, candidate) {
    if (candidate.method !== "dedicated-login-page") {
      return false;
    }
    try {
      const primary = new URL(primaryUrl);
      const candidateUrl = new URL(candidate.url);
      if (primary.hostname.replace(/^www\./i, "").toLowerCase() !== candidateUrl.hostname.replace(/^www\./i, "").toLowerCase()) {
        return false;
      }
      const primaryPath = primary.pathname.replace(/\/$/, "") || "/";
      const candidatePath = candidateUrl.pathname.replace(/\/$/, "") || "/";
      return primaryPath === candidatePath;
    } catch {
      return false;
    }
  }
  function isSelfPageCandidate(primaryUrl, pageUrl, candidateUrl) {
    try {
      const candidate = new URL(candidateUrl);
      const candPath = candidate.pathname.replace(/\/$/, "") || "/";
      const candHost = candidate.hostname.replace(/^www\./i, "").toLowerCase();
      for (const base of [primaryUrl, pageUrl].filter(Boolean)) {
        const page = new URL(base);
        const pageHost = page.hostname.replace(/^www\./i, "").toLowerCase();
        if (pageHost !== candHost) {
          continue;
        }
        const pagePath = page.pathname.replace(/\/$/, "") || "/";
        if (pagePath === candPath) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
  function findAlternatePortalCandidate(primaryUrl, candidates, context) {
    const ranked = [...candidates].sort((a, b) => b.score - a.score);
    for (const candidate of ranked) {
      if (isAlternateAudiencePortalUrl(candidate.url)) {
        return candidate;
      }
      const gate = evaluateLoginAudience(primaryUrl, candidate.url, {
        label: candidate.label,
        pageTitle: context.pageTitle,
        pageContextText: context.pageContextText,
        primaryHasModalLoginTrigger: context.primaryHasModalLoginTrigger
      });
      if (!gate.accept && (gate.code === "alternate_audience_portal" || gate.code === "page_context_alternate_audience")) {
        return candidate;
      }
    }
    return null;
  }
  function pickAudienceSafeCandidate(primaryUrl, candidates, context) {
    const ranked = [...candidates].sort((a, b) => b.score - a.score);
    let firstRejected = null;
    for (const candidate of ranked) {
      if (isAlternateAudiencePortalUrl(candidate.url)) {
        if (!firstRejected) firstRejected = candidate;
        continue;
      }
      if (isEmbeddedHomepageLoginForm(primaryUrl, candidate)) {
        if (!firstRejected) firstRejected = candidate;
        continue;
      }
      if (candidate.method !== "dedicated-login-page" && isSelfPageCandidate(primaryUrl, context.pageUrl, candidate.url)) {
        if (!firstRejected) firstRejected = candidate;
        continue;
      }
      if (context.pageHasAlternatePortalCandidate && isGenericLoginPathUrl(candidate.url) && candidate.method !== "dedicated-login-page") {
        if (!firstRejected) firstRejected = candidate;
        continue;
      }
      const gate = evaluateLoginAudience(primaryUrl, candidate.url, {
        label: candidate.label,
        pageTitle: context.pageTitle,
        pageContextText: context.pageContextText,
        // Modal on primary must not veto same-origin consumer audience accept.
        primaryHasModalLoginTrigger: false
      });
      if (gate.accept) {
        const canonicalUrl = canonicalizeFederatedIdPLoginUrl(primaryUrl, candidate.url);
        if (canonicalUrl !== candidate.url) {
          return {
            accepted: { ...candidate, url: canonicalUrl },
            rejected: firstRejected
          };
        }
        return { accepted: candidate, rejected: firstRejected };
      }
      if (!firstRejected) {
        firstRejected = candidate;
      }
    }
    return { accepted: null, rejected: firstRejected };
  }
  function modalAudienceRejection(primaryUrl, rejected, modalTriggers, partial, context) {
    const hasModal = modalTriggers.length > 0;
    const rejectedUrl = rejected?.url;
    let portalRejected = false;
    if (rejectedUrl) {
      const gate = evaluateLoginAudience(primaryUrl, rejectedUrl, {
        label: rejected?.label,
        pageTitle: context?.pageTitle,
        pageContextText: context?.pageContextText,
        primaryHasModalLoginTrigger: hasModal
      });
      portalRejected = !gate.accept && (gate.code === "alternate_audience_portal" || gate.code === "page_context_alternate_audience" || isAlternateAudiencePortalUrl(rejectedUrl));
    }
    if (hasModal && portalRejected) {
      return {
        ...discoveryFailure(primaryUrl, "modal_with_alternate_audience", {
          ...partial,
          modalTrigger: modalTriggers[0],
          candidates: partial.candidates
        }),
        reason: MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
        loginEntryType: "modal",
        usesModal: true,
        rejectedLoginUrl: rejectedUrl
      };
    }
    if (hasModal) {
      return {
        ...discoveryFailure(primaryUrl, "consumer_login_is_modal", {
          ...partial,
          modalTrigger: modalTriggers[0],
          candidates: partial.candidates
        }),
        reason: CONSUMER_LOGIN_MODAL_REASON,
        loginEntryType: "modal",
        usesModal: true,
        rejectedLoginUrl: portalRejected ? rejectedUrl : void 0
      };
    }
    if (portalRejected && rejectedUrl) {
      return {
        ...discoveryFailure(primaryUrl, "modal_with_alternate_audience", {
          ...partial,
          candidates: partial.candidates
        }),
        reason: MODAL_WITH_ALTERNATE_AUDIENCE_REASON,
        loginEntryType: "modal",
        usesModal: true,
        rejectedLoginUrl: rejectedUrl
      };
    }
    return {
      ...discoveryFailure(primaryUrl, "cross_subdomain_untrusted", {
        ...partial,
        candidates: partial.candidates
      }),
      reason: rejectedUrl ? CROSS_SUBDOMAIN_NEEDS_REVIEW_REASON : CONSUMER_LOGIN_MODAL_REASON,
      loginEntryType: "unknown",
      usesModal: false,
      rejectedLoginUrl: rejectedUrl
    };
  }
  async function liveValidateTopCandidates(primaryUrl, allCandidates, options, extra) {
    const ranked = [...allCandidates].filter((c) => Boolean(c.url) && !isAlternateAudiencePortalUrl(c.url)).filter((c) => {
      const inspectingThis = options.pageUrl && (() => {
        try {
          return probeHtmlLookupKey(options.pageUrl) === probeHtmlLookupKey(c.url);
        } catch {
          return false;
        }
      })();
      if (!inspectingThis && (options.pageHasAlternatePortalCandidate || options.primaryHasModalLoginTrigger) && isSameHostBareCommonLoginPath(primaryUrl, c.url)) {
        return false;
      }
      return true;
    }).sort((a, b) => b.score - a.score).slice(0, 8);
    const seen = /* @__PURE__ */ new Set();
    for (const candidate of ranked) {
      const key = candidate.url;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const validated = await validateConsumerLoginPageUrl(
        primaryUrl,
        candidate.url,
        options
      );
      if (validated) {
        return discoverySuccess(
          primaryUrl,
          validated.url,
          validated.method,
          validated.confidence,
          {
            redirectChain: extra?.redirectChain,
            finalUrlAfterRedirects: extra?.finalUrlAfterRedirects,
            candidates: allCandidates,
            loginEntryType: "navigable",
            usesModal: Boolean(extra?.usesModal),
            modalTrigger: extra?.modalTrigger,
            rejectedLoginUrl: extra?.rejectedLoginUrl
          }
        );
      }
    }
    return null;
  }
  async function tryProbeTrustedAuthHosts(primaryUrl, options, allCandidates, extra) {
    const probeUrls = buildTrustedAuthHostProbeUrls(primaryUrl);
    for (const probeUrl of probeUrls) {
      const probeCandidate = {
        url: probeUrl,
        method: "common-path",
        confidence: "low",
        label: probeUrl,
        score: 8
      };
      allCandidates.push(probeCandidate);
      const validated = await validateConsumerLoginPageUrl(primaryUrl, probeUrl, options);
      if (validated) {
        return discoverySuccess(
          primaryUrl,
          validated.url,
          validated.method,
          validated.confidence,
          {
            redirectChain: extra?.redirectChain,
            finalUrlAfterRedirects: extra?.finalUrlAfterRedirects,
            candidates: allCandidates,
            loginEntryType: "navigable",
            usesModal: Boolean(extra?.usesModal),
            modalTrigger: extra?.modalTrigger
          }
        );
      }
    }
    return null;
  }
  async function discoverLoginEntry(primaryUrl, options = {}) {
    const normalizedPrimary = normalizePrimaryUrl(primaryUrl);
    if (!normalizedPrimary) {
      return discoveryFailure(primaryUrl, "invalid_primary_url");
    }
    const followRedirects = options.followRedirects ?? true;
    const tryCommonPaths = options.tryCommonPaths ?? true;
    const probeAuthHosts = options.probeAuthHosts ?? true;
    const allCandidates = [];
    let modalTriggers = [];
    let redirectChain;
    let finalUrlAfterRedirects;
    let pageTitle;
    let pageContextText;
    let authHostsProbed = false;
    const pageUrl = options.pageUrl ?? normalizedPrimary;
    const htmlSnapshot = Boolean(options.assumeVisible) || Boolean(options.html && !options.document);
    const documentRoot = options.document ?? (options.html ? documentFromHtml(options.html) : void 0);
    const partialBase = () => ({
      redirectChain,
      finalUrlAfterRedirects,
      candidates: allCandidates
    });
    if (documentRoot) {
      pageTitle = documentRoot.title?.trim() || void 0;
      pageContextText = extractPageAudienceContextText(documentRoot);
      const inspection = inspectPageForLoginEntry(documentRoot, pageUrl, {
        htmlSnapshot
      });
      allCandidates.push(...inspection.candidates);
      modalTriggers = inspection.modalTriggers;
      const portalOnPage = findAlternatePortalCandidate(
        normalizedPrimary,
        inspection.candidates,
        {
          pageTitle,
          pageContextText,
          primaryHasModalLoginTrigger: modalTriggers.length > 0
        }
      );
      const audienceContext = {
        pageUrl,
        pageTitle,
        pageContextText,
        primaryHasModalLoginTrigger: modalTriggers.length > 0,
        pageHasAlternatePortalCandidate: Boolean(portalOnPage)
      };
      const validateOptions = {
        ...options,
        pageHasAlternatePortalCandidate: Boolean(portalOnPage),
        primaryHasModalLoginTrigger: modalTriggers.length > 0
      };
      const { accepted, rejected } = pickAudienceSafeCandidate(
        normalizedPrimary,
        inspection.candidates,
        audienceContext
      );
      if (accepted) {
        const live = await validateConsumerLoginPageUrl(
          normalizedPrimary,
          accepted.url,
          validateOptions
        );
        if (live) {
          return discoverySuccess(
            normalizedPrimary,
            live.url,
            live.method,
            live.confidence,
            {
              candidates: allCandidates,
              modalTrigger: modalTriggers[0],
              loginEntryType: "navigable",
              usesModal: modalTriggers.length > 0,
              rejectedLoginUrl: (portalOnPage ?? rejected)?.url
            }
          );
        }
      }
      {
        const liveFromTop = await liveValidateTopCandidates(
          normalizedPrimary,
          allCandidates,
          validateOptions,
          {
            usesModal: modalTriggers.length > 0,
            modalTrigger: modalTriggers[0],
            rejectedLoginUrl: (portalOnPage ?? rejected)?.url
          }
        );
        if (liveFromTop) {
          return liveFromTop;
        }
      }
      if (probeAuthHosts && tryCommonPaths && !portalOnPage) {
        const hasTrustedAuthDomCandidate = allCandidates.some((c) => {
          try {
            return isTrustedAuthSubdomain(new URL(c.url).hostname);
          } catch {
            return false;
          }
        });
        const hasBareSameHostLoginCandidate = allCandidates.some(
          (c) => isSameHostBareCommonLoginPath(normalizedPrimary, c.url)
        );
        const skipAuthInventBesideModalLogin = modalTriggers.length > 0 && !hasTrustedAuthDomCandidate && hasBareSameHostLoginCandidate;
        if (!skipAuthInventBesideModalLogin) {
          authHostsProbed = true;
          const probed = await tryProbeTrustedAuthHosts(
            normalizedPrimary,
            validateOptions,
            allCandidates,
            {
              usesModal: modalTriggers.length > 0,
              modalTrigger: modalTriggers[0]
            }
          );
          if (probed) {
            return probed;
          }
        }
      }
      if (modalTriggers.length > 0) {
        return modalAudienceRejection(
          normalizedPrimary,
          portalOnPage ?? rejected,
          modalTriggers,
          partialBase(),
          { pageTitle, pageContextText }
        );
      }
      if (portalOnPage || rejected) {
        return modalAudienceRejection(
          normalizedPrimary,
          portalOnPage ?? rejected,
          modalTriggers,
          partialBase(),
          { pageTitle, pageContextText }
        );
      }
    }
    if (followRedirects && !normalizedPrimary.startsWith("/")) {
      const redirectResult = await followHttpRedirects(normalizedPrimary);
      redirectChain = redirectResult.redirectChain;
      finalUrlAfterRedirects = redirectResult.finalUrl;
      if (redirectResult.ok && redirectResult.finalUrl && redirectResult.finalUrl !== normalizedPrimary && redirectResultLooksLikeLogin(redirectResult)) {
        const gate = evaluateLoginAudience(normalizedPrimary, redirectResult.finalUrl, {
          primaryHasModalLoginTrigger: false
        });
        if (!gate.accept || isAlternateAudiencePortalUrl(redirectResult.finalUrl)) {
          const rejected = {
            url: redirectResult.finalUrl,
            method: "redirect",
            confidence: "medium",
            score: 14
          };
          return modalAudienceRejection(
            normalizedPrimary,
            rejected,
            modalTriggers,
            partialBase(),
            { pageTitle, pageContextText }
          );
        }
        return discoverySuccess(
          normalizedPrimary,
          redirectResult.finalUrl,
          "redirect",
          "medium",
          {
            redirectChain,
            finalUrlAfterRedirects,
            candidates: allCandidates,
            modalTrigger: modalTriggers[0],
            loginEntryType: "navigable",
            usesModal: modalTriggers.length > 0
          }
        );
      }
    }
    if (tryCommonPaths) {
      const portalSeen = allCandidates.some((c) => isAlternateAudiencePortalUrl(c.url));
      if (portalSeen) {
        const portal = allCandidates.find((c) => isAlternateAudiencePortalUrl(c.url)) ?? null;
        return modalAudienceRejection(
          normalizedPrimary,
          portal,
          modalTriggers,
          partialBase(),
          { pageTitle, pageContextText }
        );
      }
      if (probeAuthHosts && !authHostsProbed) {
        authHostsProbed = true;
        const probed = await tryProbeTrustedAuthHosts(
          normalizedPrimary,
          options,
          allCandidates,
          {
            redirectChain,
            finalUrlAfterRedirects,
            usesModal: false
          }
        );
        if (probed) {
          return probed;
        }
      }
      if (modalTriggers.length > 0) {
        return {
          ...discoveryFailure(normalizedPrimary, "consumer_login_is_modal", {
            ...partialBase(),
            modalTrigger: modalTriggers[0]
          }),
          reason: CONSUMER_LOGIN_MODAL_REASON,
          loginEntryType: "modal",
          usesModal: true
        };
      }
      const pathCandidates = buildCommonPathCandidateEntries(normalizedPrimary);
      allCandidates.push(...pathCandidates);
      const { accepted, rejected } = pickAudienceSafeCandidate(
        normalizedPrimary,
        pathCandidates,
        {
          pageTitle,
          pageContextText,
          primaryHasModalLoginTrigger: false,
          pageHasAlternatePortalCandidate: false
        }
      );
      if (accepted) {
        const validated = await validateConsumerLoginPageUrl(
          normalizedPrimary,
          accepted.url,
          options
        );
        if (validated) {
          return discoverySuccess(
            normalizedPrimary,
            validated.url,
            validated.method,
            validated.confidence,
            {
              redirectChain,
              finalUrlAfterRedirects,
              candidates: allCandidates,
              loginEntryType: "navigable",
              usesModal: false
            }
          );
        }
      }
      if (rejected) {
        return modalAudienceRejection(
          normalizedPrimary,
          rejected,
          modalTriggers,
          partialBase(),
          { pageTitle, pageContextText }
        );
      }
    }
    if (modalTriggers.length > 0) {
      return {
        ...discoveryFailure(normalizedPrimary, "consumer_login_is_modal", {
          redirectChain,
          finalUrlAfterRedirects,
          modalTrigger: modalTriggers[0],
          candidates: allCandidates
        }),
        reason: CONSUMER_LOGIN_MODAL_REASON,
        loginEntryType: "modal",
        usesModal: true
      };
    }
    if (allCandidates.length > 0) {
      const late = await liveValidateTopCandidates(
        normalizedPrimary,
        allCandidates,
        options,
        { redirectChain, finalUrlAfterRedirects }
      );
      if (late) {
        return late;
      }
    }
    return discoveryFailure(normalizedPrimary, "login_entry_not_found", {
      redirectChain,
      finalUrlAfterRedirects,
      candidates: allCandidates
    });
  }

  // src/extension/discoveryPageEntry.ts
  var NO_CORS_PROBE_TIMEOUT_MS = 6e3;
  var SW_PROBE_TIMEOUT_MS = 1e4;
  function probeHostReachableNoCors(url) {
    return new Promise((resolve) => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        resolve(false);
      }, NO_CORS_PROBE_TIMEOUT_MS);
      fetch(url, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        credentials: "omit",
        redirect: "follow",
        signal: controller.signal
      }).then(() => {
        clearTimeout(timer);
        resolve(true);
      }).catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }
  function fetchProbeHtmlFromServiceWorker(url) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const timer = setTimeout(() => {
        finish({ ok: false, reached: false, reason: "sw_timeout" });
      }, SW_PROBE_TIMEOUT_MS);
      try {
        const chromeApi = globalThis.chrome;
        if (!chromeApi?.runtime?.sendMessage) {
          clearTimeout(timer);
          finish({ ok: false, reached: false, reason: "no_runtime" });
          return;
        }
        chromeApi.runtime.sendMessage(
          { type: "HUB_DISCOVERY_FETCH_HTML", url },
          (response) => {
            clearTimeout(timer);
            if (chromeApi.runtime?.lastError) {
              finish({
                ok: false,
                reached: false,
                reason: chromeApi.runtime.lastError.message
              });
              return;
            }
            const payload = response;
            if (!payload) {
              finish({ ok: false, reached: false, reason: "empty_response" });
              return;
            }
            if (payload.reached === false) {
              finish({
                ok: false,
                reached: false,
                reason: payload.reason
              });
              return;
            }
            if (payload.ok && typeof payload.html === "string") {
              finish({
                ok: true,
                reached: true,
                status: typeof payload.status === "number" ? payload.status : 200,
                html: payload.html,
                finalUrl: payload.finalUrl ?? url
              });
              return;
            }
            finish({
              ok: false,
              reached: true,
              status: typeof payload.status === "number" ? payload.status : 0,
              html: typeof payload.html === "string" ? payload.html : void 0,
              finalUrl: payload.finalUrl,
              reason: payload.reason,
              dnsExists: payload.dnsExists === true
            });
          }
        );
      } catch {
        clearTimeout(timer);
        finish({ ok: false, reached: false, reason: "exception" });
      }
    });
  }
  async function fetchProbeHtmlViaBackground(url) {
    const fromSw = await fetchProbeHtmlFromServiceWorker(url);
    if (fromSw.ok) {
      return fromSw;
    }
    if (fromSw.reached && typeof fromSw.status === "number" && fromSw.status !== 404 && (fromSw.dnsExists === true || fromSw.status === 0 || fromSw.status === 401 || fromSw.status === 403 || fromSw.status === 429)) {
      return fromSw;
    }
    const reachable = await probeHostReachableNoCors(url);
    if (reachable) {
      return {
        ok: false,
        reached: true,
        status: 0,
        dnsExists: true,
        finalUrl: url,
        reason: "no_cors_reachable"
      };
    }
    return fromSw;
  }
  async function runLoginEntryDiscoveryInPage(primaryUrl) {
    return discoverLoginEntry(primaryUrl, {
      document: window.document,
      pageUrl: window.location.href,
      followRedirects: false,
      tryCommonPaths: true,
      probeAuthHosts: true,
      // Never invent auth-host /login without reachability (retail FP).
      // Accept only when SW HTML / DNS / in-page no-cors proves the host exists.
      fetchProbeHtml: fetchProbeHtmlViaBackground
    });
  }
  window.runLoginEntryDiscoveryInPage = runLoginEntryDiscoveryInPage;
})();
