# Phase 126 — Extension Install & Store Readiness (Architect notes)

Direction and scope: `PLAN.md` → "Phase 126 — Extension Install & Store Readiness".

## Part A — review package

### Sarah's report, 2026-10-07: ACCEPTED (pending Owner acceptance)

- **Extension ID:** `jljgdbgnnnjipjjeadeocgbicaokhpnp`. It is recomputed from the manifest `key`.
- **Manifest:** only `key`, `default_locale`, `name` and `description` changed, which is within the Owner exception. The two `_locales` files were added.
- **ZIP:** 19 files and no `.pem`. The private key is outside the repository.
- **Build:** `tsc -b` and `npm run build` pass.
- **Process note:** Part A ran before the Phase 123 commit, when it should have run after it.
  - No harm was done: the Phase 123 final run had already ended (09:30), and its fingerprint scope (`src scripts supabase`) excludes `extension/`.
  - The Phase 123 commit must therefore exclude the Part A paths.

> **Superseded 2026-10-07 11:15** (see arch-phase123, "Last batch report (11:12)"): the G-3 rows go in **before** the Phase 123 commit. The commit still excludes the Part A `extension/` paths.

### KI-126-1 ruling: commit Phase 123 first, then the G-3 rows in Phase 126

1. **Phase 123 commit:**
   - Use explicit paths only, on `wip/phase123-recovered`.
   - Exclude `extension/manifest.json`, `extension/_locales/**` and `team-yuri/*phase126*`.
   - Before committing, the 123 fingerprint must still equal `4226bdac…a086`.
2. **After the commit, as Phase 126 work:**
   - Add a narrow G-3 allowance, naming "Phase 126 Part A", to every verify that freezes `extension/` against BASE `e91b5b12`. The allowance covers exactly `extension/manifest.json`, `extension/_locales/he/messages.json` and `extension/_locales/en/messages.json`.
   - Run those verifies with `--no-mutations`, plus `tsc -b` and the build.
   - Rejected alternative: G-3 rows before the 123 commit. They would change `scripts/` after the frozen final run.
3. **Owner actions:**
   - back up the `.pem`;
   - set `VITE_POC_EXTENSION_ID` on Vercel and redeploy;
   - run the clean-profile install and fill acceptance test.

   The deployed site shows only the code that was pushed and deployed. Pushing Phase 123 is an Owner decision; agents never push.
