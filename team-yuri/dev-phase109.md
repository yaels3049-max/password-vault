# Developer Phase 109

## Phase Identifier
PHASE=109

## Status
STATUS: IN_PROGRESS — D-109-25 anti-wipe code + static verify delivered; durability UAT **PENDING_OPERATOR**. Hydrate Chrome↔Edge UAT (T35–T36) still operator-gated. Isolation T31–T34 previously Pass.

## Source References
- `team-Yuri/arch-phase109.md` (D-109-22…**D-109-25**)
- `team-Yuri/PLAN.md` §18 — AC-109-39
- `docs/MIGRATION_PHASE_109.md`
- Note: `manager-phase109.md` may still need Manager sync for D-109-25 (Developer cannot edit Manager artifacts)

## Amendments (2026-07-13)

### A–C — Prior
Single password; Admin Login; userId vault isolation (T31–T34 Pass).

### D — Cross-browser hydrate (D-109-24)
`hydrateWorkspaceFromCloud` + `deriveCloudCredentialKey`; Chrome re-key on Login.

### E — Workspace durability / anti-wipe (D-109-25 / AC-109-39) — THIS DELIVERY
| Requirement | Implementation |
|---|---|
| No wipe via missing credential in sync payload | `syncVaultStateToSupabase` **upsert-only**; removed auto-`deleteEncryptedCredential` |
| Explicit credential delete | `deleteCloudEncryptedCredentialByLocalProfileId` from Manage Services |
| Explicit remove-service | `removeUserServiceFromCloud` after local remove |
| Hydrate empty-win ban | `keepLocalMembership` when cloud empty + local non-empty |
| Decrypt fail | Keep local credential for that profile |
| Failed cloud read | Return local unchanged |
| Admin | Same rules — not role-specific |

Root cause class: destructive dual-write on re-key/partial payload (and/or empty cloud treated as authority), **not** `is_admin`.

## Durability UAT (required — AC-109-39)

| # | Step | Expected | Result |
|---:|---|---|---|
| T38 | Populate Home (tiles + passwords) as normal user | Populated | **PENDING_OPERATOR** |
| T39 | Offline / reconnect / re-login | Tiles + passwords remain | **PENDING_OPERATOR** |
| T40 | Repeat for `is_admin` user | Same durability | **PENDING_OPERATOR** |

Operator paste:

```text
Normal user email:
Admin user email:
Normal: tiles+passwords after reconnect: yes/no
Admin: tiles+passwords after reconnect: yes/no
Pass/Fail:
```

## M12 Chrome→Edge UAT (H10)

| # | Result |
|---:|---|
| T35–T36 | **PENDING_OPERATOR** |
| T37 ZK | **PASS** (static) |

## Static verify

| Command | Result |
|---|---|
| `node scripts/verifyPhase109Accounts.mjs` | **PASS** (incl. D-109-25 anti-wipe asserts) |
| `npm run build` | **PASS** |

## Files Changed (D-109-25 delta)

| File | Change |
|---|---|
| `src/supabase/persistence.ts` | Upsert-only sync; explicit delete APIs; hydrate anti-wipe merge |
| `src/App.tsx` | `removeUserServiceFromCloud` on remove; post-hydrate upsert-only repair sync |
| `src/ManageServices.tsx` | Explicit cloud credential delete on user delete |
| `scripts/verifyPhase109Accounts.mjs` | D-109-25 asserts |
| `docs/MIGRATION_PHASE_109.md` | Durability section |

## Hard Gates

| Gate | Status |
|---|---|
| H9 Isolation | PASS (T31–T34) |
| H10 Hydrate Chrome↔Edge | UAT pending |
| **H11 Durability / anti-wipe** | Code PASS / **UAT PENDING_OPERATOR** |

## Scope

- Owned under **Phase 109** only — Phase 110 does not own durability
- No MFA; no Phase 103 redesign

## Developer Declaration

```text
Detected phase: 109 (correction D-109-25; PHASE.md may show 110 in parallel)
Selected state: IMPLEMENT
Status: IN_PROGRESS
```

Manager: please sync `manager-phase109.md` with D-109-25 / AC-109-39 if not already. Phase COMPLETE for this correction after T38–T40 Pass.
