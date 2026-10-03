/**
 * D-121-47 — generic action-intent vocabulary for SPECIAL Analyze proposals (Hub side).
 * The extension collector (`page-structure-inspect.js`, ACTION_INTENT_VOCABULARY) keeps an
 * identical copy for its pre-cap ordering; a verify pins the two lists equal.
 * Whole-word matching; a Hebrew word may carry one prefix letter (ו/ה/ב/ל/מ/ש/כ).
 */

export const ACTION_INTENT_VOCABULARY = {
  login: ['התחברות', 'כניסה', 'התחבר', 'אזור אישי', 'login', 'log in', 'sign in', 'my account'],
  negative: [
    'slide',
    'carousel',
    'prev',
    'previous',
    'contact',
    'צור קשר',
    'chat',
    "צ'אט",
    'cart',
    'עגלה',
    'search',
    'חיפוש',
    'newsletter',
    'דיוור',
    'הרשמה',
    'register',
    'נגישות',
    'נגיש',
    'accessibility',
    'accessible',
  ],
  transition: ['next', 'continue', 'המשך', 'הבא', 'קדימה', 'proceed', 'אישור', 'שלח', 'submit'],
} as const;

const HEBREW_PREFIX_LETTERS = 'והבלמשכ';
const HEBREW_RE = /[\u0590-\u05FF]/;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\u05F3`\u2019]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function tokenMatches(token: string, word: string): boolean {
  if (token === word) return true;
  return (
    HEBREW_RE.test(word) &&
    token.length === word.length + 1 &&
    HEBREW_PREFIX_LETTERS.includes(token[0]!) &&
    token.slice(1) === word
  );
}

function hasPhrase(tokenList: string[], phrase: string): boolean {
  const words = phrase.split(' ');
  for (let i = 0; i + words.length <= tokenList.length; i += 1) {
    if (words.every((w, j) => tokenMatches(tokenList[i + j]!, w))) return true;
  }
  return false;
}

export interface ActionIntent {
  login: boolean;
  negative: boolean;
  transition: boolean;
}

/** Intent from any of the texts (visible text, aria-label, title, legacy label). */
export function actionIntent(texts: ReadonlyArray<string | null | undefined>): ActionIntent {
  const lists = texts.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map(tokens);
  const any = (phrases: readonly string[]) => lists.some((l) => phrases.some((p) => hasPhrase(l, p)));
  return {
    login: any(ACTION_INTENT_VOCABULARY.login),
    negative: any(ACTION_INTENT_VOCABULARY.negative),
    transition: any(ACTION_INTENT_VOCABULARY.transition),
  };
}
