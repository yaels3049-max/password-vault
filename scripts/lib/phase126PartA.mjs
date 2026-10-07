/**
 * Phase 126 Part A (G-3, KI-126-1 ruling in arch-phase123 "Last batch report (11:12)"): the only
 * extension/ changes allowed against the Phase 123 BASE are exactly these three files. The manifest
 * may differ only by the four Part A lines; reverting them must give the original bytes back, so
 * every existing manifest pin keeps its strength.
 */
export const PHASE126_PART_A = [
  'extension/manifest.json',
  'extension/_locales/he/messages.json',
  'extension/_locales/en/messages.json',
];

const PART_A_MANIFEST_EDITS = [
  [/^ {2}"key": "[A-Za-z0-9+/=]+",\n/m, ''],
  ['  "default_locale": "he",\n', ''],
  ['  "name": "__MSG_extName__",\n', '  "name": "Israeli Vault Autofill POC",\n'],
  ['  "description": "__MSG_extDescription__",\n', '  "description": "Local demo autofill proof of concept only",\n'],
];

/** Reverts exactly the Part A manifest lines (each at most once); any other difference is kept. */
export function revertPhase126PartAManifest(text) {
  let out = text.replace(/\r\n/g, '\n');
  for (const [from, to] of PART_A_MANIFEST_EDITS) out = out.replace(from, to);
  return out;
}

/** A git path list without exactly the three Part A paths. */
export function withoutPhase126PartA(paths) {
  return paths.map((p) => p.trim()).filter((p) => p && !PHASE126_PART_A.includes(p));
}
