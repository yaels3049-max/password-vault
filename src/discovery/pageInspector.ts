import type { DiscoveryCandidate, DiscoveryMethod, ModalLoginTrigger } from './discoveryResult';
import {
  buildCommonPathCandidates,
  confidenceFromScore,
  normalizePrimaryUrl,
  resolveHref,
  scoreLoginCandidate,
  textMatchesLoginKeyword,
  urlLooksLikeLoginDestination,
} from './discoveryUtils';
import {
  hasVisiblePasswordField,
  isElementVisible,
  normalizedElementText,
  type VisibilityOptions,
} from './visibility';

export interface PageInspectOptions extends VisibilityOptions {}

const METHOD_WEIGHT: Record<DiscoveryMethod, number> = {
  'dedicated-login-page': 20,
  redirect: 14,
  'visible-link': 12,
  'visible-button': 11,
  'modal-trigger': 9,
  'common-path': 4,
};

function baseOriginForUrl(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function bestCandidate(candidates: DiscoveryCandidate[]): DiscoveryCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((a, b) => b.score - a.score)[0] ?? null;
}

export function inspectDedicatedLoginPage(
  documentRoot: Document,
  pageUrl: string,
  options?: PageInspectOptions,
): DiscoveryCandidate | null {
  if (!hasVisiblePasswordField(documentRoot, options)) {
    return null;
  }

  const normalized = normalizePrimaryUrl(pageUrl);
  if (!normalized) {
    return null;
  }

  const score = scoreLoginCandidate({
    url: normalized,
    label: 'login form',
    baseOrigin: baseOriginForUrl(normalized),
    methodWeight: METHOD_WEIGHT['dedicated-login-page'],
  });

  return {
    url: normalized,
    method: 'dedicated-login-page',
    confidence: confidenceFromScore(score),
    label: 'Dedicated login page',
    score,
  };
}

export function findVisibleLoginLinks(
  documentRoot: Document,
  pageUrl: string,
  options?: PageInspectOptions,
): DiscoveryCandidate[] {
  const baseOrigin = baseOriginForUrl(pageUrl);
  const candidates: DiscoveryCandidate[] = [];
  const anchors = documentRoot.querySelectorAll('a[href]');

  for (const anchor of anchors) {
    if (!isElementVisible(anchor, options)) {
      continue;
    }

    const href = anchor.getAttribute('href') ?? '';
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
      methodWeight: METHOD_WEIGHT['visible-link'],
    });

    candidates.push({
      url: resolved,
      method: 'visible-link',
      confidence: confidenceFromScore(score),
      label,
      score,
    });
  }

  return candidates;
}

export function findVisibleLoginButtons(
  documentRoot: Document,
  pageUrl: string,
  options?: PageInspectOptions,
): DiscoveryCandidate[] {
  const baseOrigin = baseOriginForUrl(pageUrl);
  const candidates: DiscoveryCandidate[] = [];
  const selectors = [
    'button',
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
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

      let resolved: string | null = null;
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
        methodWeight: METHOD_WEIGHT['visible-button'],
      });

      candidates.push({
        url: resolved,
        method: 'visible-button',
        confidence: confidenceFromScore(score),
        label,
        score,
      });
    }
  }

  return candidates;
}

const MODAL_TRIGGER_SELECTOR = [
  '[data-toggle="modal"]',
  '[data-bs-toggle="modal"]',
  '[aria-haspopup="dialog"]',
  '[aria-haspopup="true"]',
  '[aria-controls]',
].join(',');

const NON_NAVIGABLE_LOGIN_CONTROL_SELECTOR = [
  'button',
  '[role="button"]',
  'input[type="button"]',
  'a[href="#"]',
  'a[href=""]',
  'a:not([href])',
].join(',');

function isNonNavigableHref(href: string | null | undefined): boolean {
  if (href == null || href.trim() === '') {
    return true;
  }
  const trimmed = href.trim().toLowerCase();
  return (
    trimmed === '#' ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('javascript:') ||
    trimmed === '/'
  );
}

/**
 * Collect modal / dialog-style consumer login triggers on the primary page.
 * Includes explicit modal attributes and login-labeled controls without a navigable URL.
 */
export function findModalLoginTriggers(
  documentRoot: Document,
  pageUrl: string,
  options?: PageInspectOptions,
): { candidates: DiscoveryCandidate[]; triggers: ModalLoginTrigger[] } {
  const baseOrigin = baseOriginForUrl(pageUrl);
  const candidates: DiscoveryCandidate[] = [];
  const triggers: ModalLoginTrigger[] = [];
  const seen = new Set<Element>();

  const pushTrigger = (element: Element) => {
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
    const role = element.getAttribute('role') ?? undefined;
    let href: string | undefined;
    const rawHref = element.getAttribute('href');

    if (element instanceof HTMLAnchorElement && element.href && !isNonNavigableHref(rawHref)) {
      href = element.href;
    }

    triggers.push({ label, tagName, role, href });

    if (href) {
      const score = scoreLoginCandidate({
        url: href,
        label,
        baseOrigin,
        methodWeight: METHOD_WEIGHT['modal-trigger'],
      });

      candidates.push({
        url: href,
        method: 'modal-trigger',
        confidence: confidenceFromScore(score),
        label,
        score,
      });
    }
  };

  for (const element of documentRoot.querySelectorAll(MODAL_TRIGGER_SELECTOR)) {
    pushTrigger(element);
  }

  // Generic modal pattern: login-labeled control with no dedicated navigation target.
  for (const element of documentRoot.querySelectorAll(NON_NAVIGABLE_LOGIN_CONTROL_SELECTOR)) {
    const rawHref = element.getAttribute('href');
    if (element.tagName.toLowerCase() === 'a' && !isNonNavigableHref(rawHref)) {
      continue;
    }
    pushTrigger(element);
  }

  return { candidates, triggers };
}

export function inspectPageForLoginEntry(
  documentRoot: Document,
  pageUrl: string,
  options?: PageInspectOptions,
): {
  best: DiscoveryCandidate | null;
  candidates: DiscoveryCandidate[];
  modalTriggers: ModalLoginTrigger[];
} {
  const candidates: DiscoveryCandidate[] = [];

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
    modalTriggers: modal.triggers,
  };
}

export function buildCommonPathCandidateEntries(primaryUrl: string): DiscoveryCandidate[] {
  const normalized = normalizePrimaryUrl(primaryUrl);
  if (!normalized || normalized.startsWith('/')) {
    return [];
  }

  const baseOrigin = baseOriginForUrl(normalized);

  return buildCommonPathCandidates(normalized).map((url) => {
    const score = scoreLoginCandidate({
      url,
      label: url,
      baseOrigin,
      methodWeight: METHOD_WEIGHT['common-path'],
    });

    return {
      url,
      method: 'common-path' as const,
      confidence: 'low' as const,
      label: url,
      score,
    };
  });
}
