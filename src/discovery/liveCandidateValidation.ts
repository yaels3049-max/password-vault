import { hasVisiblePasswordField } from './visibility';

/**
 * Consumer identity / login surface field (D-108-28) — read-only heuristics.
 * Password preferred but not required (identity-only entry steps allowed).
 * Forbidden by DiscoveryExecutor: fill / submit (not performed here).
 */
export function htmlHasConsumerIdentityField(
  documentRoot: Document,
  options?: { assumeVisible?: boolean; htmlSnapshot?: boolean },
): boolean {
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
    'input[aria-label*="user" i]',
  ];

  for (const selector of identitySelectors) {
    try {
      if (documentRoot.querySelector(selector)) {
        return true;
      }
    } catch {
      // ignore invalid selector variants in older JSDOM
    }
  }

  return false;
}

/**
 * SPA / bot-gated login shells often omit static identity inputs in the first HTML.
 * Title / H1 login wording is enough for soft-ACCEPT after audience + reachability
 * (PayPal DataDome, Zoom signin SPA) — never overrides portal reject.
 */
export function htmlLooksLikeLoginSpaShell(documentRoot: Document): boolean {
  const title = (documentRoot.title ?? '').trim();
  const h1 = (documentRoot.querySelector('h1')?.textContent ?? '').trim();
  const blob = `${title}\n${h1}`.toLowerCase();
  return /sign[\s-]*in|log[\s-]*in|logon|כניסה|התחברות|signin|login/.test(blob);
}
