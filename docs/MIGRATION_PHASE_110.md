# Migration Guide — Phase 110 (Standard Login Autofill Coverage)

Phase 110 expands **generic autofill** beyond the Shufersal / Clalit validation anchors to **all standard single-page login forms** (catalog, custom, and admin-managed) that already have explicit `loginFields` + credentials — using the **unchanged Phase 103** `executeServiceFromTile` pipeline.

## Prerequisites

- Phases 101–109 applied as needed for registry, credentials, and Hub
- Extension loaded (MV3) with scripting permission on target origins
- Services under test have explicit registry `loginFields` and vault credentials
- Prefer a resolved `loginUrl` (Phase 108); missing `loginUrl` → open `primaryUrl` only (fill may be skipped)

## Parallel tracks (consume only)

| Phase | Phase 110 relationship |
|---|---|
| **108** discovery | Consumes `loginUrl` / metadata when present — does **not** own discovery |
| **109** auth / hydrate | Consumes credentials when present — does **not** own auth/hydrate |
| **103** execution | Orchestration **unchanged**; adapters remain exclusive when `adapterId` is site-specific |
| **112** complex login | Out of scope; codes `not_standard_login` / `fill_failed` leave hooks only |
| **113** URL identity | Out of scope — no canonicalization changes |

## Coverage matrix

| Origin | Prerequisites | Autofill? | Else |
|---|---|---|---|
| **Catalog** (`built_in`) | Explicit `loginFields` + complete credentials + extension + standard-login gate | Fill identity + password via generic engine; **no submit** | Open tab; optional friendly / `fill_failed` signal |
| **Custom** (`source_type=user`) | Same | Same generic engine | Same |
| **Admin-managed** | Same (admin-curated `loginFields` / `loginUrl`) | Same generic engine | Same |
| Any origin, missing `loginFields` | — | **No** (eligibility false) | Open `loginUrl ?? primaryUrl` |
| Any origin, missing credentials | Configured `loginFields` | **No** | Open site + credentials guidance |
| Non-standard page (OTP / multi-password / ambiguous) | Eligible Hub-side | Extension returns `not_standard_login` / low confidence — **no unsafe fill** | Tab stays open (open-first) |
| Page with reCAPTCHA + standard username/password | Eligible Hub-side | Fill identity + password; **user** completes CAPTCHA; never auto-submit | Tab stays open |
| Site-specific `adapterId` (e.g. htzone, practice) | Adapter path | Adapter owns fill | Generic path not used |

**Not** limited to Shufersal / Clalit. Those remain **mandatory regression anchors**.

### Fill vs open-only (summary)

```text
Tile click
  → openUrl = loginUrl ?? primaryUrl  (always open-first)
  → site adapter? → adapter
  → else if loginFields + credentials → POC_GENERIC_FILL
       → standard-login gate + deterministic map
       → fill visible mapped fields only
       → NEVER submit
  → else → open only (+ friendly message if credentials missing)
```

## Extension permission notes (D-110-12)

| Item | Detail |
|---|---|
| Manifest | `extension/manifest.json` — `permissions`: `tabs`, `scripting` |
| Host access | `host_permissions` includes `https://*/*` (and http localhost) so generic fill can inject on **arbitrary catalog HTTPS origins** |
| Injection model | Content scripts auto-match localhost only; real sites use `chrome.scripting.executeScript` after user-initiated tile open (Phase 103 pattern) |
| Store / operator packaging | Broad host access must stay aligned with Phase **108** packaging / store policy. Document operator justification: fill runs only after Digital Home tile click; no background crawling |
| Redundant host entries | Explicit Shufersal / Clalit / HTZone host lines may remain for clarity or adapters; `https://*/*` already covers them for generic fill |
| URL safety | Background `isAllowedGenericAutofillUrl`: any `https:`; localhost http only — **not** a service allowlist |

Reload the extension after pulling Phase 110 generic script changes.

## Catalog seed note — Bank Hapoalim (AC-110-2)

Hapoalim previously opened the **marketing homepage** (`www.bankhapoalim.co.il`) because `login_url` was null — so the extension never saw the login form.

| Fix | Detail |
|---|---|
| Hub seed | `builtinCatalog.ts` — `loginUrl` → `https://login.bankhapoalim.co.il/ng-portals/auth/he/`; label `קוד משתמש` |
| DB | Migration `20260713200000_phase110_hapoalim_login_url.sql` (apply in Supabase) |
| Engine | Formless SPA detection + iframe `allFrames` inject + password-as-text mapping + Hebrew label synonyms |

**Operator:** apply that migration (recommended), hard-refresh Hub / re-login, **reload extension** (`1.4.8`), then open Hapoalim.

Hub also **backfills** missing `loginUrl`/`loginFields` from `builtinCatalog` at load time when the registry row is still stale — so fill can work even before SQL if the Hub seed is current.

Generic inject uses **MAIN world**, **`allFrames: true`** (login fields often live in an iframe), and a longer SPA settle delay so Angular portals receive fills.

### Custom / discovered services (e.g. Bank Jerusalem)

Fill is attempted when complete credentials exist **and** either:
- explicit `loginFields` on the service, or
- a dedicated `loginUrl` (Hub credential UI already uses default username/password fields)

Previously, custom services with `loginUrl` but null `loginFields` only opened the page — no fill attempt.

Sites behind bot interstitials (e.g. Radware “Verifying your browser…”) are waited out generically before mapping; if the challenge never clears, fill cannot proceed.

## Standard-login gate (extension)

Fill proceeds only when:

1. Visible identity field + **exactly one** visible password on the same form
2. Mapped targets pass visibility (not `hidden` / `aria-hidden` / zero-size traps)
3. Deterministic mapping confidence (id / name / autocomplete / label / type); ambiguous → **no fill**
4. OTP / one-time-code / confirm-password traps on **visible** fields of the mapped form
   - reCAPTCHA / similar widgets alone do **not** block fill (user completes them; we never submit)

Low confidence → leave tab open; reason codes include `not_standard_login`, `low_confidence`, `ambiguous_mapping`.

## Failure UX / health signals (AC-110-9, AC-110-15)

| Signal | Meaning | User impact |
|---|---|---|
| `fill_failed` | Extension unavailable; Hub opened URL without fill | Non-blocking info banner — fill manually |
| `not_standard_login` | Extension-side gate (page not standard) | Tab open; no unsafe fill (Phase 112 may classify later) |
| credentials missing | Configured fields, incomplete vault values | Open site + guidance to Service Management |

No stack traces or credential dumps to users.

## Metadata proposal (M6) — **deferred**

Silent registry enrichment of `loginFields` / overwrite of admin-curated metadata is **out of this phase** (D-110-11 optional). Detect path (`POC_GENERIC_DETECT`) remains available for future proposal UX; Phase 110 does not write registry metadata automatically.

## Shufersal / Clalit regression

After deploy / extension reload:

1. Digital Home → open **Shufersal** with credentials → identity + password filled; user submits manually
2. Same for **Clalit**
3. Confirm a non-anchor eligible service (catalog or custom) also fills when metadata + credentials exist

## Verify

```bash
node scripts/verifyPhase110StandardAutofill.mjs
node scripts/verifyPhase103Execution.mjs
npm run build
```

## Out of scope

- Phase 112 complex / OTP / iframe / modal login automation
- Phase 108 loginUrl discovery
- Phase 109 auth / hydrate
- Phase 116 URL canonicalization
- Redesign of `executeServiceFromTile`
- AI / ML / probabilistic field detection
