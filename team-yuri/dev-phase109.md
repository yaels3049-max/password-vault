# Developer Phase 109

## Phase Identifier
PHASE=109

## Status
STATUS: IN_PROGRESS — D-109-26 profile isolation + durable delete delivered (static verify). Operator UAT for AC-109-40/41 **PENDING**. D-109-25 durability UAT still operator-gated.

## Source References
- `team-Yuri/arch-phase109.md` (D-109-22…**D-109-26**)
- `team-Yuri/PLAN.md` §18 — AC-109-39, **AC-109-40**, **AC-109-41**
- `docs/MIGRATION_PHASE_109.md`

## Amendments (2026-07-15) — D-109-26 / AC-109-40 / AC-109-41

| Requirement | Implementation |
|---|---|
| Cross-user profile isolation | Dual-write binds `expectedUserId`; aborts if Auth switched; hydrate scopes credentials to healed profiles |
| Durable «מחיקת פרופיל» | `deleteAccessProfileFromCloud` before local `deleteAccessProfile`; Hebrew error on failure |
| Deleted profiles stay gone | Cloud delete + hydrate drops local-only ghosts when cloud has that service |
| Anti-wipe | Sync still upsert-only; no delete-by-omission |

### Files
| File | Change |
|---|---|
| `src/supabase/persistence.ts` | `deleteAccessProfileFromCloud`; sync `expectedUserId`; hydrate cloud-authority per service |
| `src/vault/vault.ts` | Pass `expectedUserId` on dual-write |
| `src/ManageServices.tsx` | Cloud profile delete before local |
| `src/ServiceProfileManagementModal.tsx` | Async delete + error path |
| `src/vault/profileManagement.ts` | `PROFILE_DELETE_CLOUD_FAILED_MESSAGE` |
| `scripts/verifyPhase109Accounts.mjs` | AC-109-40/41 asserts |

### Isolation / delete UAT (required)

| # | Step | Expected | Result |
|---:|---|---|---|
| T40 | User X: create 2+ profiles on a service, delete one, re-login | Deleted profile gone | **PENDING_OPERATOR** |
| T41 | Same browser: login User Y → same service | Zero of X's profiles (deleted or remaining) | **PENDING_OPERATOR** |
| T42 | Cloud: X's deleted `local_profile_id` absent from X's `access_profiles`; none of X’s ids on Y | Confirmed | **PENDING_OPERATOR** |

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
| `node scripts/verifyPhase109Accounts.mjs` | **PASS** (D-109-25 + D-109-26 / AC-109-40/41) |
| `npx tsc -b` | **PASS** |
| `node scripts/verifyPhase113LoginAssistance.mjs` | **PASS** (no regression) |

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
| H9 Isolation | PASS (T31–T34); D-109-26 hardening static PASS |
| H10 Hydrate Chrome↔Edge | UAT pending |
| **H11 Durability / anti-wipe** | Code PASS / **UAT PENDING_OPERATOR** |
| **H12 Profile isolation + durable delete** | Code PASS / **UAT T40–T42 PENDING_OPERATOR** |

## Scope

- Owned under **Phase 109** only — Phase 110 does not own durability
- No MFA; no Phase 103 redesign

## Developer Declaration

```text
Detected phase: 109
Selected state: IMPLEMENT
Status: COMPLETE (code + static verify; operator UAT T40–T42 pending)
```

Sarah — D-109-26: cloud profile delete; dual-write abort on account switch; hydrate drops deleted ghosts.
