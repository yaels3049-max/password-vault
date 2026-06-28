/**
 * Visibility helpers aligned with extension generic form-detector philosophy.
 * Read-only DOM inspection — no clicks, no script invocation.
 */

export interface VisibilityOptions {
  /** Parsed HTML snapshot (DOMParser) — skip layout geometry checks. */
  htmlSnapshot?: boolean;
}

function isExplicitlyHidden(element: HTMLElement): boolean {
  if (element.hidden) {
    return true;
  }

  if (
    (element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLOptionElement) &&
    element.disabled
  ) {
    return true;
  }

  if (element instanceof HTMLInputElement && element.type === 'hidden') {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return true;
  }

  if (parseFloat(style.opacity) === 0) {
    return true;
  }

  return false;
}

export function isElementVisible(
  element: Element,
  options?: VisibilityOptions,
): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (options?.htmlSnapshot) {
    return !isExplicitlyHidden(element);
  }

  if (element.hidden) {
    return false;
  }

  if (
    (element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLOptionElement) &&
    element.disabled
  ) {
    return false;
  }

  if (element instanceof HTMLInputElement && element.type === 'hidden') {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  if (parseFloat(style.opacity) === 0) {
    return false;
  }

  return element.getClientRects().length > 0;
}

export function normalizedElementText(element: Element): string {
  const aria = element.getAttribute('aria-label') ?? '';
  const title = element.getAttribute('title') ?? '';
  const value =
    element instanceof HTMLInputElement || element instanceof HTMLButtonElement
      ? (element.value ?? '')
      : '';
  const text = element.textContent ?? '';

  return [aria, title, value, text]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function hasVisiblePasswordField(
  documentRoot: Document,
  options?: VisibilityOptions,
): boolean {
  const inputs = documentRoot.querySelectorAll('input[type="password"]');
  for (const input of inputs) {
    if (isElementVisible(input, options)) {
      return true;
    }
  }
  return false;
}
