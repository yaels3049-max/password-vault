# Phase 103 Migration — Unified Service Execution

## Scope

Phase 103 delivers **one unified tile execution pipeline** in the Hub:

- All Digital Home tile opens call `executeServiceFromTile`
- Open URL: `loginUrl ?? primaryUrl` (no discovery on tile click)
- Generic autofill when registry `loginFields` are configured and vault credentials are complete
- Site-specific adapters (`htzone`, `practice`) remain exclusive paths
- Extension generic fill uses URL safety policy instead of a POC host allowlist

Phase 103 does **not** change vault crypto, discovery flows, or registration UX.

## Hub changes (automatic on deploy)

| Module | Change |
|---|---|
| `src/execution/serviceExecution.ts` | Unified orchestrator (D-103-8) |
| `src/execution/autofillEligibility.ts` | Metadata-driven autofill gate |
| `src/execution/adapters/registry.ts` | Site-specific adapters only (`htzone`, `practice`) |
| `src/catalog/builtinCatalogOverlay.ts` | Presentation-only (icon, category, favicon) |
| `src/catalog/builtinCatalog.ts` | Shufersal/Clalit no longer reference `adapterId: generic` |

## Extension reload (required)

After pulling Phase 103:

1. Open `chrome://extensions`
2. Find **Israeli Vault Autofill POC**
3. Click **Reload** (manifest version **1.3.0**)
4. Confirm `extension/background.js` includes `isAllowedGenericAutofillUrl` (no `GENERIC_REAL_SITE_ALLOWED_HOSTS`)

Generic autofill on real sites requires the updated extension service worker.

## Optional SQL migration

If Phase 102 interim migration `20260706120000_phase102_restore_generic_autofill.sql` was applied, clear stale `adapter_id` on built-in Shufersal/Clalit rows:

**File:** `supabase/migrations/20260706140000_phase103_clear_generic_adapter.sql`

```sql
update public.service_registry
set adapter_id = null, updated_at = now()
where id in ('shufersal', 'clalit')
  and adapter_id = 'generic'
  and owner_user_id is null
  and source_type = 'built_in';
```

Apply via Supabase Dashboard → SQL Editor. **Non-blocking for local dev** when orchestrator is metadata-driven; recommended for production registry hygiene.

## Verification

```powershell
cd C:\password-vault
node scripts/verifyPhase103Execution.mjs
```

Authoritative post-103 script. `verifyPhase102TileRegression.mjs` delegates here.

## Manual functional test matrix

**Prerequisites:** vault unlocked; extension installed and reloaded (`VITE_POC_EXTENSION_ID`); Phase 101–102 migrations applied; `npm run dev` at `http://localhost:5173/`.

| # | Service | Expected |
|---:|---|---|
| T1 | **Shufersal** | Opens `loginUrl`; extension autofills email/password; tab stays open |
| T2 | **Clalit** | Opens `loginUrl`; extension autofills 3 fields; tab stays open |
| T3 | **HTZone** | `htzone` adapter path; autofill works |
| T4 | **Practice** (dev) | `practice` adapter on demo page |
| T5 | **Leumi** (or bank) | Opens `primaryUrl` only; no autofill |
| T6 | **Custom service** | Same generic pipeline when `loginUrl` + `loginFields` + credentials present |
| T7 | **Shufersal** (incomplete creds) | Opens `loginUrl`; Hebrew credentials prompt; no fill |
| T8 | Any service | No temporary discovery tab on tile click |
| T9 | Custom vs built-in | Identical orchestration when metadata shape matches |

**Regression gate:** T1 and T2 must PASS for Manager approval.

## Rollback notes

- Revert Hub `serviceExecution.ts` and re-register `genericAutofillAdapter` only if emergency rollback to Phase 102 adapter path is required
- Re-apply `20260706120000_phase102_restore_generic_autofill.sql` if registry `adapter_id` must be restored
- Reload extension after any `background.js` rollback
