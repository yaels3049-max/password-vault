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
    "secure",
    "id"
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
      return /login|signin|sign-in|auth/.test(path);
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
      const candidateOrigin = new URL(url).origin;
      if (candidateOrigin === baseOrigin) {
        score += 3;
      } else if (urlLooksLikeLoginDestination(url)) {
        score += 5;
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
  function findModalLoginTriggers(documentRoot, pageUrl, options) {
    const baseOrigin = baseOriginForUrl(pageUrl);
    const candidates = [];
    const triggers = [];
    const elements = documentRoot.querySelectorAll(MODAL_TRIGGER_SELECTOR);
    for (const element of elements) {
      if (!isElementVisible(element, options)) {
        continue;
      }
      const label = normalizedElementText(element);
      if (!textMatchesLoginKeyword(label)) {
        continue;
      }
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute("role") ?? void 0;
      let href;
      if (element instanceof HTMLAnchorElement && element.href) {
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

  // src/discovery/discoverLoginEntry.ts
  async function discoverLoginEntry(primaryUrl, options = {}) {
    const normalizedPrimary = normalizePrimaryUrl(primaryUrl);
    if (!normalizedPrimary) {
      return discoveryFailure(primaryUrl, "invalid_primary_url");
    }
    const followRedirects = options.followRedirects ?? true;
    const tryCommonPaths = options.tryCommonPaths ?? true;
    const allCandidates = [];
    let modalTriggers = [];
    let redirectChain;
    let finalUrlAfterRedirects;
    const pageUrl = options.pageUrl ?? normalizedPrimary;
    const htmlSnapshot = Boolean(options.html && !options.document);
    const documentRoot = options.document ?? (options.html ? documentFromHtml(options.html) : void 0);
    if (documentRoot) {
      const inspection = inspectPageForLoginEntry(documentRoot, pageUrl, {
        htmlSnapshot
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
            modalTrigger: modalTriggers[0]
          }
        );
      }
    }
    if (followRedirects && !normalizedPrimary.startsWith("/")) {
      const redirectResult = await followHttpRedirects(normalizedPrimary);
      redirectChain = redirectResult.redirectChain;
      finalUrlAfterRedirects = redirectResult.finalUrl;
      if (redirectResult.ok && redirectResult.finalUrl && redirectResult.finalUrl !== normalizedPrimary && redirectResultLooksLikeLogin(redirectResult)) {
        return discoverySuccess(
          normalizedPrimary,
          redirectResult.finalUrl,
          "redirect",
          "medium",
          {
            redirectChain,
            finalUrlAfterRedirects,
            candidates: allCandidates
          }
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
          "common-path",
          "low",
          {
            redirectChain,
            finalUrlAfterRedirects,
            candidates: allCandidates,
            modalTrigger: modalTriggers[0]
          }
        );
      }
    }
    if (modalTriggers.length > 0) {
      return discoveryFailure(normalizedPrimary, "modal_trigger_without_navigable_url", {
        redirectChain,
        finalUrlAfterRedirects,
        modalTrigger: modalTriggers[0],
        candidates: allCandidates
      });
    }
    return discoveryFailure(normalizedPrimary, "login_entry_not_found", {
      redirectChain,
      finalUrlAfterRedirects,
      candidates: allCandidates
    });
  }

  // src/extension/discoveryPageEntry.ts
  async function runLoginEntryDiscoveryInPage(primaryUrl) {
    return discoverLoginEntry(primaryUrl, {
      document: window.document,
      pageUrl: window.location.href,
      followRedirects: false,
      tryCommonPaths: true
    });
  }
  window.runLoginEntryDiscoveryInPage = runLoginEntryDiscoveryInPage;
})();
