# Migration Guide — Phase 106 (Security and Trust Experience)

## Scope

Phase 106 delivers **Security and Trust Experience** UX only:

- Shared Hebrew Zero-Knowledge / encrypted-on-device copy (`src/trust/`)
- Vault open/locked indicator during Service Management / credential editor
- Browser password-manager suppression on Hub credential fields
- Credential save success feedback + friendly security errors
- Short dismissible first-time protection explanation

**No** changes to encryption algorithms, vault/IndexedDB schema, Supabase ciphertext
payload shape, `executeServiceFromTile`, Access Profile behavior, or authentication
architecture (AC-106-12).

## Hub credential editor attribute contract (D-106-5)

```html
<form>
  <input type="text" name="email" autocomplete="email" />
  <input type="text" name="username" autocomplete="username" />
  <!-- Password: hardened — NOT login/signup tokens -->
  <input type="password" name="hub-vault-cred-…" autocomplete="one-time-code" />
</form>
```

**Per-field policy:**

| Field | Browser assist | PM hardening |
|---|---|---|
| email / username | `autocomplete="email"` / `username`, standard `name` | None |
| idNumber, userCode, other text | `autocomplete="off"` | None |
| password | — | `one-time-code`, non-login `name`, readOnly-until-focus, save via `type="button"` |

Applied in:

- `ServiceProfileManagementModal.tsx` (primary — Service Management → **ניהול**)
- `CredentialModal.tsx` (legacy secondary editor, same contract)

**Unlock / Master Password** may keep `autocomplete="current-password"` — that field *is*
the Hub password entry.

Do **not** use `username` / `current-password` on **service** credential fields.

## Critical Chrome + Edge UAT (required for Manager approval)

Prerequisites: `npm run dev`, vault unlocked, Chrome **and** Edge available.

| # | Browser | Steps | Expected |
|---:|---|---|---|
| P1 | Chrome | ניהול שירותים → **ניהול** → enter username/password → Save | **No** “Save password?” bubble for Hub fields |
| P2 | Chrome | Same editor with site passwords saved in browser | Browser autofill does **not** overwrite Hub fields |
| P3 | Edge | Same as P1 | **No** Edge save-password UI for Hub fields |
| P4 | Edge | Same as P2 | Hub fields not clobbered by Edge autofill |

Also confirm: vault state badge visible (**הגישה פתוחה**), save shows Hebrew success, first-time tip if not dismissed.

**PM save-bubble hardening** (implemented in `HubCredentialInput`):

- Non-login field `name` (`hub-vault-cred-…`)
- **Password only:** `readOnly` until focus, PM-ignore `data-*`, `one-time-code`, non-login `name`
- **Email/username:** standard `autocomplete` + `name` for browser history/suggestions
- **Other text:** `autocomplete="off"`
- Save via **`type="button"`** (not form submit)

Re-test **P1 (Chrome)** and **P3 (Edge)** after deploy.

## Verification

```bash
node scripts/verifyPhase106SecurityTrust.mjs
npm run build

# If Management/Dashboard lightly touched for trust chips:
node scripts/verifyPhase103Execution.mjs
node scripts/verifyPhase105DigitalHome.mjs
```

## AC-106-12 forbid list

Do **not** modify:

- `src/vault/crypto.ts` algorithms / KDF / ciphertext format
- Vault / IndexedDB architecture or dual-write crypto payload shape
- `executeServiceFromTile` orchestration or adapters
- Access Profile model or CRUD behavior (UX wrapping around existing callbacks only)
- Authentication architecture

## Soft notes

- First-time tip dismiss flag: UI-only `localStorage` key `dh.trust.firstTimeSecurityTipDismissed` (no secrets).
- Trust claims follow ADR-002 — client encrypts; product cannot read passwords; Master Password unlocks local vault; loss may prevent recovery.
