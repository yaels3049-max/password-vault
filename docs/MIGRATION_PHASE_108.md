# Migration Guide — Phase 108 (Browser Integration & Login Discovery)

Phase 108 delivers a **browser integration abstraction** for Chrome and Edge (Chromium), a **unified login-entry discovery pipeline**, admin override protection, and bulk login URL refresh — without changing Phase 103 execution semantics.

## Prerequisites

- Phases 101–107 migrations applied
- Hub dev server: `npm run dev` (default `http://localhost:5173`)
- Chrome **or** Edge stable (Chromium)

## Apply migration

```bash
supabase db push
# Or manually apply (in order):
# supabase/migrations/20260709180000_phase108_login_url_status.sql
# supabase/migrations/20260712120000_phase108_admin_login_url_clears_discovery.sql
# supabase/migrations/20260712140000_phase108_ensure_known_builtin.sql
# supabase/migrations/20260712150000_phase108_adapter_id_compliance.sql
# supabase/migrations/20260712160000_phase108_persist_discovery_review.sql
# supabase/migrations/20260712170000_phase108_seed_custom_category.sql
```

### M9 — Consumer false-positive gate (required)

Apply `20260712160000_phase108_persist_discovery_review.sql` so rediscovery can **clear** auto false-positive `login_url` on global catalog rows (RLS-safe RPC). Administrator overrides (`metadata.loginUrlSource=admin`) are never cleared.

Apply `20260712170000_phase108_seed_custom_category.sql` so admin/global creates that use `category_id='custom'` (and registryMapper defaults) do not fail FK against `categories`.

On reject/defer, metadata may include:

| Field | Meaning |
|---|---|
| `rejectedLoginUrl` | Portal/false-positive candidate not persisted |
| `loginEntryType` | `navigable` \| `modal` \| `unknown` |
| `usesModal` | Consumer login appears modal-based |
| `phase112Deferred` | `true` → Phase 112 owns surface handling |
| `loginIntelligenceHint` | `alternate_audience_portal` \| `modal_on_primary` \| `complex_login_surface` \| `needs_review` |

Static gate:

```bash
node scripts/verifyPhase108FalsePositiveGate.mjs
# M9 REJECT + M10 ACCEPT fixtures (Zap stay NULL; Shufersal/Clalit/HTZone shapes persist)
```

Live Zap UAT (U19): Admin → rediscover Zap → expect `login_url` **NULL**, not `sa.zap.co.il/.../login`, with reject/deferral metadata. Reload the Chrome extension after `npm run build:extension-discovery`.

Live catalog rediscovery (U22): Admin → rediscover Shufersal, Clalit, HTZone → each keeps **non-NULL** consumer `login_url` while Zap remains NULL.

### M11 — Live path authority (required)

1. `npm run build:extension-discovery` then reload the side-loaded extension (manifest ≥ 1.4.1).
2. Hard-refresh Hub; run admin rediscovery or custom add.
3. In Admin → Integration Status, copy `rawExtensionDiscovery` + `lastDiscoveryOutcome` + `login_url` for evidence (D-108-20).
4. Static JSDOM fixture PASS alone is **not** sufficient for Phase 108 complete.

### `login_url_status` expansion

| Value | Meaning |
|---|---|
| `valid` | Confident `login_url` present |
| `missing` | Discovery ran; no login URL found |
| `failed` | Discovery error / timeout |
| `stale` | Admin-marked or heuristic stale (Phase 102 `invalid` migrated here) |
| `needs_review` | Low-confidence candidate |
| `unknown` / `invalid` | Transitional legacy values |

### Admin manual edit metadata

`admin_update_login_url` sets:
- `login_url` + `login_url_status` (default `valid`)
- `metadata.loginUrlSource = 'admin'`
- Clears stale discovery failure markers when status is `valid`:
  - `loginUrlDiscoveryError = null`
  - `loginUrlDiscoveryOutcome = succeeded`
  - `lastDiscoveryOutcome` with `method: admin_manual`

Automated rediscovery and bulk refresh **skip** rows with `loginUrlSource=admin` unless `forceAdminOverwrite` is enabled.

## Extension install (dev side-load)

### Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `extension/` folder in this repo
4. Copy the extension ID → set in `.env`:
   ```env
   VITE_POC_EXTENSION_ID=<your-extension-id>
   ```
5. Reload the Hub tab after changing `.env`

### Edge

1. Open `edge://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → same `extension/` folder
4. Edge assigns a **different extension ID** than Chrome — use a separate `.env` value per browser profile or document the active ID
5. Reload Hub

### Reload after changes

After editing `extension/background.js` or discovery scripts:

```bash
npm run build:extension-discovery
```

Then click **Reload** on the extension card in `chrome://extensions` or `edge://extensions`.

## `externally_connectable` (production)

`extension/manifest.json` lists dev Hub origins:

```json
"externally_connectable": {
  "matches": [
    "http://localhost/*",
    "http://127.0.0.1/*"
  ]
}
```

For production, add your deployed Hub origin (e.g. `https://vault.example.com/*`) before store submission. **Chrome Web Store** and **Microsoft Edge Add-ons** each require separate listings; the extension **core** (`background.js`, discovery, autofill modules) is shared.

| Store | Notes |
|---|---|
| Chrome Web Store | MV3, `host_permissions` justification for broad HTTPS may be required |
| Edge Add-ons | Chromium-compatible package; separate extension ID in Edge |

## Extension version alignment

Phase 108 bumps extension manifest to **1.4.0** (Hub discovery timeout 30s, reliable tab close). Keep Hub + extension versions documented together in release notes.

## Discovery contract

| Message | Direction | Payload |
|---|---|---|
| `HUB_LOGIN_ENTRY_DISCOVERY` | Hub → Extension | `{ primaryUrl }` |
| Response | Extension → Hub | `{ ok: true, discovery }` or `{ ok: false, reason }` |

Discovery is **DOM inspection only** — no credentials, autofill, or form submit (AC-108-10).

## Bulk refresh (admin)

In `#/admin` → **קטלוג גלובלי**:

- **רענון כניסה מרוכז** — rate-limited queue (concurrency 2, 500ms between batches)
- Checkbox **דרוס עריכות מנהל** — sets `forceAdminOverwrite` (AC-108-15)

Report shape:

```json
{
  "succeeded": ["service-id"],
  "failed": [{ "id": "bad-site", "error": "..." }],
  "skipped": [{ "id": "admin-edited", "reason": "admin_override_protected" }]
}
```

## Empty-database known-service bootstrap

After an intentional `service_registry` wipe, the **catalog UI shows only rows that exist in the DB** (plus dev practice). Known services are **not** ghost-injected into the gallery.

Restore happens when the user adds a known site:

| Source | Role |
|---|---|
| `src/catalog/builtinCatalog.ts` | **Authoritative** credential schema + loginUrl + adapter metadata |
| `src/catalog/knownServiceBootstrap.ts` | URL → canonical id |
| `ensure_known_builtin_registry_row` RPC | Persist `built_in` row on add/select (no `custom-*` duplicate) |

Phase 108 Login Discovery updates **only** `login_url`, `login_url_status`, and discovery metadata — never `login_fields` / `adapter_id`.

```bash
node scripts/verifyPhase108KnownServiceBootstrap.mjs
```

## adapterId architecture (Phase 103 / 108)

| Service | Expected `adapter_id` | Execution path |
|---|---|---|
| `htzone` | `htzone` | Site-specific adapter |
| `hub-practice-login` | `practice` (catalog / dev inject) | Site-specific adapter |
| `clalit`, `shufersal`, others | `null` | Generic autofill via `login_fields` + `login_url` |

```bash
node scripts/verifyPhase108AdapterRouting.mjs
node scripts/checkRegistryAdapterIds.mjs   # live DB check (optional)
```

## Manual UAT matrix (U1–U21)

See `team-Yuri/dev-phase108.md` for operator evidence template.

| # | Scenario |
|---:|---|
| U1–U2 | Chrome: extension probe + custom add discovery |
| U3–U4 | Edge: same as U1–U2 |
| U5–U6 | No extension: graceful degradation; custom add still succeeds |
| U7–U8 | Discovery success / failure paths |
| U9 | Discovery boundary (no autofill/credentials) |
| U10–U11 | Admin manual edit + single rediscovery |
| U12–U15 | Bulk refresh + partial failure + admin override |
| U16–U17 | Discovery tab closes; execution tab separate |
| U18 | Phase 103 execution regression (tile autofill) |
| **U19** | **Zap false-positive: rediscover → `login_url` NULL; never `sa.zap…/login`** |
| U20 | Modal-on-primary deferral metadata |
| U21 | Mizrahi-class: URL-or-NULL + Phase 112 hint only (no modal fill) |

## Phase 107 coordination

Phase 107 admin UI (LoginUrlRefresh, approval promote) **calls** Phase 108 engine APIs. Phase 108 semantics are verified independently via static scripts and the UAT matrix above.
