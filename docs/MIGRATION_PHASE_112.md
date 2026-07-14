# Migration Phase 112 — Login Intelligence and Advanced Autofill

## Goal
Authoritative **Login Intelligence (LI)** on Service Registry: classify login complexity (`basic` \| `medium` \| `complex` \| `unknown`), flow taxonomy, confidence, integration health, adapter recommendation lifecycle — and soft-wire Phase **103** execution (basic→110, medium→112 assist, complex→open + guidance) **without** redesigning orchestration, auto-submit, hidden fill, CAPTCHA/OTP solve, federated clicks, or Phase 108 discovery.

## Prerequisites
- Phase 103 `executeServiceFromTile` open-first path
- Phase 110 generic autofill (`basic`)
- Phase 108 deferral hints: `phase112Deferred`, `loginIntelligenceHint`, `usesModal`, `loginEntryType`
- Phase 107 Admin auth (`is_admin()`)

## Apply migration
```text
supabase/migrations/20260714140000_phase112_login_intelligence.sql
```
LI fields live in `service_registry.metadata` (JSONB). The SQL migration documents the contract via column comment (no mandatory new columns).

## Metadata keys (Phase 112 authoritative writer)

| Key | Values / notes |
|---|---|
| `loginComplexity` | `basic` \| `medium` \| `complex` \| `unknown` |
| `loginFlowType` | see PLAN taxonomy (`email_first`, `standard_single_page`, …) |
| `loginDetectionStatus` | `ok` \| `partial` \| `failed` \| `pending` \| `skipped` |
| `loginDetectionConfidence` | `high` \| `medium` \| `low` |
| `loginDetectionLastCheckedAt` | ISO timestamp |
| `loginDetectionError` | internal only — **never** shown raw to end users |
| `loginDetectionEngineVersion` | e.g. `112.1.0` |
| `lastValidatedBy` | `auto` \| `admin` \| `adapter` |
| `adapterRecommended` / `adapterReason` / `adapterLifecycle` | lifecycle: `recommended`→`approved`→`implemented`→`validated`→`deprecated` |
| `integrationHealth` | `healthy` \| `degraded` \| `needs_review` \| `adapter_required` \| `unsupported` |
| `supportedCredentialFields` | string[] |
| `federatedLoginOptions` | `google` \| `apple` \| … |
| `requiresOtp` / `requiresCaptcha` / `usesIframe` / `usesModal` / `isMultiStep` | booleans |
| `loginIntelligenceAdminOverride` | when true, auto reclassify must not overwrite |

Phase **108** may still write: `phase112Deferred`, `loginIntelligenceHint`, `rejectedLoginUrl`, `loginEntryType`, `usesModal`.

## Decision order (runtime)
```text
executeServiceFromTile (103 shell unchanged)
  → openUrl = loginUrl ?? primaryUrl
  → site-specific adapterId? → adapter
  → else LI (admin override > validated auto):
       basic    → Phase 110 generic autofill
       medium   → Phase 112 medium assist (visible fill; no auto-submit / no Continue click)
       complex  → open + friendly Hebrew guidance (+ health)
       unknown  → open; optional 110 if eligible; else needs_review health
```

## Admin
1. Admin → Registry → select service.
2. Panel **Login Intelligence (Phase 112)**: view fields, **רענון / סיווג מחדש**, **סיווג עם דריסת מנהל**, manual override form.
3. Admin override (`lastValidatedBy=admin` / `loginIntelligenceAdminOverride`) is never silently replaced.

## User-facing copy
Friendly **Hebrew** only (e.g. “פתחנו את האתר…”). Never surface raw detection stacks.

## Extension / host permissions
Medium assist reuses existing Hub↔extension `POC_GENERIC_FILL` (visible fields only; no submit). Injectability still requires extension host permissions for the target origin — document per environment if detect/fill is skipped.

## Medium identity-first path (M9 / M10 / D-112-20…24)

Medium classified services use Hub message **`POC_IDENTITY_FIRST_FILL`** → extension `runIdentityFirstAutofill`, then Hub maps the result to **exactly one** AC-112-26 Hebrew status (never silent open-only).

| Rule | Detail |
|---|---|
| Must NOT | Solely call Phase 110 `runGenericAutofill` / `assessStandardLogin` for medium |
| Success | ≥1 visible identity field filled when password absent; Hebrew success + Continue hint |
| Failure | Exactly one AC-112-26 Hebrew status |
| Supported list | `src/loginIntelligence/supportedMediumSites.ts` (fixture + Amazon IL + KSP) |
| Feature flag | `VITE_PHASE112_MEDIUM=false` disables medium feature |
| Basic preserved | `POC_GENERIC_FILL` + standard gate unchanged (Shufersal / Clalit) |

### Published supported websites
1. Phase 112 email-first fixture — `http://localhost:5173/phase112-email-first-step1.html`
2. **Amazon ישראל** (`amazon.co.il`)
3. **KSP** (`ksp.co.il` / `auth.ksp.co.il`)

### Reload extension
Chrome → Extensions → reload **Israeli Vault Autofill POC** (manifest **1.4.22**+).

### Verify
```text
node scripts/verifyPhase112IdentityFirst.mjs
node scripts/verifyPhase112MediumStatus.mjs
node scripts/verifyPhase112LoginIntelligence.mjs
npm run build
```

### Live UAT (required — every supported-list site)
1. Released build + medium feature on (`VITE_PHASE112_MEDIUM` not false)
2. Active Digital Home profile selected with identity credential
3. Service LI = `medium` (Admin refresh/override)
4. Open tile → step-1 identity field filled **or** explicit AC-112-26 status
5. Unsupported host → “website not supported” status (not silent)
6. Repeat after browser restart
7. Confirm no credential values in UI/logs


## Out of scope (do not reopen)
- Phase 108 loginUrl rediscovery / Zap / PayPal M16 discovery
- CAPTCHA/OTP solve, federated auto-click, auto-submit, hidden-field fill
- Phase 116 identity
- New bank-specific adapters day-one (recommendation + lifecycle only)
