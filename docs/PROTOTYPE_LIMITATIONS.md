# Prototype Limitations

**Status:** Active through Phase 100 (production baseline cleanup).  
**Audience:** Engineering onboarding and support.  
**Supersedes:** Informal POC assumptions; see `team-Yuri/PLAN.md` for the production roadmap.

This document describes what the **current prototype build** can and cannot do before Phase 101+ production infrastructure.

---

## Persistence

| Area | Current behavior | Production target |
|------|------------------|-------------------|
| Vault data | **IndexedDB** in the browser only | Supabase ciphertext storage (Phase 101) |
| Service catalog | Built-in definitions in application source | Service registry in Supabase (Phase 102) |
| Cross-device sync | **None** | Phase 101+ |
| Backup / restore | Manual export not implemented | TBD with cloud persistence |

Clearing site data or using another browser **loses the vault** unless the user has a separate backup.

---

## Authentication

| Area | Current behavior | Production target |
|------|------------------|-------------------|
| Vault unlock | Master password (client-side only) | Unchanged — zero-knowledge |
| Product account | **Not implemented** | Supabase Auth (Phase 190) |
| Account session vs vault | N/A today | Explicit separation (Phase 190) |

Signing in to a future account will **not** replace vault unlock.

---

## Browser extension and autofill

- Autofill requires the **browser extension** installed and configured.
- In development, set `VITE_POC_EXTENSION_ID` to the unpacked extension id.
- Without the extension, services open in a new tab but fields are **not** filled automatically.
- Adapter-specific behavior (e.g. HTZone) and generic autofill are prototype integrations; site DOM changes can break fills.

---

## Service catalog scope

- Built-in list covers a **limited set** of Israeli services (banks, health, shopping, etc.).
- Custom services can be added by URL with optional login discovery.
- **Practice / demo login** (`תרגול התחברות`) is available **only in dev builds** (`npm run dev`), not in production builds.

---

## Developer-only tooling

Available when running `npm run dev` only:

| Tool | Access |
|------|--------|
| POC autofill buttons on dashboard | Visible in dev |
| Local demo login pages (`/demo-login.html`, `/demo-login-3-fields.html`) | Served from `public/` in dev |
| Discovery harness | `#/dev/discovery` hash route |

Production builds (`npm run build`) **exclude** demo static pages and hide all POC controls.

---

## Security model (unchanged in Phase 100)

- Credentials are encrypted with **Argon2id** + AES-GCM before IndexedDB storage.
- The server (when added in Phase 101) will store **ciphertext only**.
- Plaintext secrets must not appear in logs, analytics, or server tables.

---

## UX naming (interim)

Screen titles such as **«המרכז הדיגיטלי שלי»** and **«ניהול השירותים»** are interim labels. Production names **«הבית הדיגיטלי»** and **«ניהול שירותים»** are planned for Phases 104–105.

---

## What Phase 100 did not change

- No Supabase project or API keys required yet.
- No cloud database schema.
- No change to vault encryption format.
- Extension messaging protocol names (internal `POC_*` types) remain for engineering compatibility.

**Next milestone:** Phase 101 — Supabase and persistence foundation.
