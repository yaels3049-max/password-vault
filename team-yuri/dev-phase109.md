# Developer Phase 109

## Phase Identifier
PHASE=109

## Status
STATUS: IN_PROGRESS — M11 code + static verify delivered; **two-user live UAT (T31–T34) PENDING_OPERATOR** (hard gate H9). Do not claim phase COMPLETE until UAT Pass is recorded below.

## Source References
- `team-Yuri/manager-phase109.md` (D-109-22, **D-109-23 / M11**)
- `team-Yuri/arch-phase109.md`
- `docs/MIGRATION_PHASE_109.md`
- `team-Yuri/PHASE.md` — `PHASE=109`

## Amendments (2026-07-13)

### A — Single Digital Home password
UnlockScreen removed; Auth Login/Create Account unlocks/creates vault with same password; lock=logout.

### B — Admin Login (D-109-22)
`#/admin` unauthenticated / non-admin → Login (not deny-only); one SPA bookmark.

### C — Client workspace isolation (D-109-23 / M11) — THIS DELIVERY
| Requirement | Implementation |
|---|---|
| Vault namespaced by `userId` | IndexedDB id `user:<uuid>` via `vaultStorageIdForUser` |
| Same password ≠ shared workspace | Separate ciphertext per userId |
| Clear on login/register/logout | `clearWorkspaceMemory()` before unlock / on logout |
| Discover | Globals + own `source_type=user` only (`isCatalogVisibleRegistryRow`) |

## Implemented Milestones

| Milestone | Completed | Notes |
|---|---:|---|
| M1–M10 | Yes | Prior amendments |
| **M11 workspace isolation** | Code Yes / UAT **Pending** | Static verify PASS; live T31–T34 below |

## M11 two-user UAT evidence (required — H9)

| # | Step | Expected | Result |
|---:|---|---|---|
| T31 | User A: login; selections + private custom | A Home/Manage populated | **PENDING_OPERATOR** |
| T32 | Logout → User B login (same password OK) | B workspace only | **PENDING_OPERATOR** |
| T33 | B Discover | Globals yes; **A’s custom absent** | **PENDING_OPERATOR** |
| T34 | Same password, two accounts | Still isolated | **PENDING_OPERATOR** |

Operator paste after UAT:

```text
Browser:
User A email:
User B email:
Same password string used: yes/no
B saw A's Home/Manage: no (required)
B Discover showed A's custom: no (required)
Pass/Fail:
```

## Static verify

| Command | Result |
|---|---|
| `node scripts/verifyPhase109Accounts.mjs` | **PASS** (vault namespace + Discover filter + Admin Login + single password) |

## Files Changed (M11 delta)

| File | Change |
|---|---|
| `src/vault/db.ts` | `vaultStorageIdForUser`; `getVault(userId)` |
| `src/vault/vault.ts` | `unlockVault(password, userId)`; active namespace; `emptyVaultState` |
| `src/App.tsx` | `clearWorkspaceMemory`; unlock with `profile.id` |
| `src/registry/registryLoader.ts` | Discover: own `source_type=user` only |
| `docs/MIGRATION_PHASE_109.md` | Workspace isolation + two-user UAT |
| `scripts/verifyPhase109Accounts.mjs` | Namespace + Discover assertions |

## Hard Gates

| Gate | Status |
|---|---|
| H3 Single password | PASS (static) |
| H4 Lock=logout | PASS (static) |
| H8 Admin Login | PASS (static) |
| **H9 Workspace isolation** | Code PASS / **UAT PENDING_OPERATOR** |
| H6 No MFA | PASS |

## Developer Declaration

```text
Detected phase: 109
Selected state: IMPLEMENT
Status: IN_PROGRESS
```

M11 code + verify delivered. Phase COMPLETE only after two-user UAT Pass recorded in the table above.
