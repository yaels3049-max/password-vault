# Phase 126 — Developer Evidence (Part A: review package)

Developer: Sarah. Scope: PLAN.md "Phase 126 — Extension Install & Store Readiness", **Part A only**. The Owner-approved manifest exception covers `key`, `default_locale`, `name` and `description` only.

## Part A — changes

| File | Change |
|---|---|
| `extension/manifest.json` | added `key` (public key, base64 SPKI) and `"default_locale": "he"`; `name` → `__MSG_extName__`, `description` → `__MSG_extDescription__`. Nothing else changed: a JSON comparison with `e91b5b12` lists exactly `key, default_locale, name, description`. |
| `extension/_locales/he/messages.json` (new) | `extName` «הבית הדיגיטלי – מילוי אוטומטי» (with an en dash, U+2013); `extDescription` «מילוי אוטומטי מאובטח של פרטי הכניסה מהבית הדיגיטלי» |
| `extension/_locales/en/messages.json` (new) | `extName` "Digital Home Autofill"; `extDescription` "Secure autofill of your Digital Home sign-in details" |

Both locale files are UTF-8 without a BOM and parse as JSON.

## Key and extension ID
- One RSA 2048 key pair, generated with Node `crypto.generateKeyPairSync` (private key PKCS#8 PEM, public key SPKI DER).
- The private key was written straight to `%USERPROFILE%\pv-extension-key\extension-key.pem`, outside the repository, with a fail-if-exists write. The file's ACL is limited to the current Windows user, with inheritance removed. Its content was never printed, logged or pasted. No `.pem` is tracked or untracked in the repository. **The Owner keeps the backup.**
- **Extension ID: `jljgdbgnnnjipjjeadeocgbicaokhpnp`.** Chrome's rule: SHA-256 of the DER public key, first 32 hex digits, 0–f mapped to a–p. It was recomputed independently from the manifest `key`, with the same result. The ID does not depend on the name.
- Owner action (not done by the Developer): set `VITE_POC_EXTENSION_ID=jljgdbgnnnjipjjeadeocgbicaokhpnp` in the Vercel project env and redeploy.

## Review ZIP
- `%USERPROFILE%\pv-extension-key\extension-review.zip`: **97,768 bytes**, 19 entries, with `manifest.json` at the ZIP root and forward-slash entry names (.NET `ZipArchive`).
- It includes `_locales/he/messages.json` and `_locales/en/messages.json`. It has 0 `.pem` entries (`*.pem` is excluded, and there are none in `extension/`).

## Install page (Hebrew + English)

**התקנת התוסף «הבית הדיגיטלי – מילוי אוטומטי» (Chrome / Edge)**
1. לחלץ את `extension-review.zip` לתיקייה קבועה (לא למחוק אותה אחרי ההתקנה).
2. לפתוח `chrome://extensions` (ב-Edge: `edge://extensions`) ולהפעיל את **מצב מפתח** (Developer mode).
3. ללחוץ **טעינת פריט לא ארוז** (Load unpacked) ולבחור את התיקייה שחולצה (התיקייה שבה נמצא `manifest.json`).
4. לוודא שהתוסף מופיע בשם **«הבית הדיגיטלי – מילוי אוטומטי»** (בדפדפן באנגלית: "Digital Home Autofill") ושהמזהה שלו הוא `jljgdbgnnnjipjjeadeocgbicaokhpnp`.
5. לפתוח את האתר `https://password-vault-sable.vercel.app`, להתחבר ולפתוח את הכספת, ולוודא שהאתר מזהה את התוסף: בחלון של אתר עם מילוי אוטומטי, הכפתור «מילוי פרטים אוטומטי» זמין ומבצע מילוי.

**Installing the "Digital Home Autofill" extension (Chrome / Edge)**
1. Extract `extension-review.zip` to a permanent folder (do not delete it after installing).
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted folder (the one that contains `manifest.json`).
4. Check that the extension is listed as **"Digital Home Autofill"** (in a Hebrew browser: «הבית הדיגיטלי – מילוי אוטומטי») with ID `jljgdbgnnnjipjjeadeocgbicaokhpnp`.
5. Open `https://password-vault-sable.vercel.app`, sign in and unlock the vault, and confirm that the site detects the extension: in a site's window with autofill, «מילוי פרטים אוטומטי» is available and fills.

Note: until Part B adds the real handshake, the site's detection is the presence check `isExtensionAvailable()` plus a working fill. Detection requires the Owner's Vercel `VITE_POC_EXTENSION_ID` update and a redeploy.

## Commands and results
- `npx tsc -b`: exit 0.
- `npm run build`: exit 0, `✓ built in 4.66s`. The only notice is Vite's existing "Some chunks are larger than 500 kB" warning.
- Not done (outside Part A / Developer ownership): Vercel, env files, secrets, store build, handshake, icons.

## Known Issues / flags for the Architect
- **KI-126-1 (cross-phase):** several Phase 123 verifies freeze `extension/` against Phase 123 BASE `e91b5b12`, for example `verifyPhase123Catalog` N-2 protected paths and `verifyPhase123OwnerFixes` `checkNChecks` frozen paths. With the Part A manifest and `_locales` changes in the uncommitted tree, those checks fail until Phase 123 is committed and the Phase 126 BASE moves past it. Not changed by the Developer; this needs a ruling (commit order, or a G-3 row naming Phase 126 Part A). The Phase 123 final-run fingerprint is unaffected: its scope is `src scripts supabase`.
- Owner acceptance is pending: clean Chrome profile → install from the ZIP → sign in on the Vercel site → a login-assistance fill works.

## Developer Declaration
Part A implemented within the Owner-approved exception. Only `key`, `default_locale`, `name` and `description` changed in the manifest, plus the two locale files. The private key is outside the repository and was never displayed. tsc and build exit 0. No Vercel, env or secret access. No commit or push.
