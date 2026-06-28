# Generic Site Integration Model

Architectural philosophy for integrating websites into the Personal Digital Hub.

This document defines **how the platform thinks about website integration**. It is not an implementation guide, a developer tutorial, or a catalog specification.

**Related documents:**

- [HIGH_LEVEL_ARCHITECTURE.md](./HIGH_LEVEL_ARCHITECTURE.md) — platform structure and components
- [DECISIONS.md](./DECISIONS.md) — ADR-003 (generic before adapters), ADR-004 (human control), ADR-008 (generic integration validation)
- [phases/PHASE_2_FIRST_REAL_INTEGRATION.md](./phases/PHASE_2_FIRST_REAL_INTEGRATION.md) — first real-site validation of this model

---

## Purpose

The Personal Digital Hub is **not** built around a predefined list of supported websites.

It is built around a **generic website integration engine** — a single mechanism that can discover login forms, map fields, and fill credentials on pages the user chooses to reach. The engine is the primary integration path. Every site is a candidate for that path until evidence shows otherwise.

The **service catalog** exists to improve user experience: familiar names, icons, categories, and sensible defaults for login URLs and field labels. It helps users find and organize services they already use. It does **not** define the boundary of what the product can support.

A user who adds a site that is not in the catalog should receive the same integration treatment as a user who selects Shufersal or Clalit — provided the generic engine can handle that site reliably.

---

## Architectural Principle

Every website should first be treated as a **generic integration candidate**.

Integration work begins with the assumption that no site-specific code is required. The generic engine attempts discovery, mapping, and fill on the login page using visible form structure and field metadata — not hard-coded selectors for a particular brand.

A **site-specific adapter** is introduced only after the generic approach has been **evaluated** and proven **insufficient** for a reliable, user-trustworthy experience on that site.

| Rule | Meaning |
|------|---------|
| **Generic is the rule** | Default path for catalog services, custom user sites, and new integrations |
| **Adapters are the exception** | Isolated, site-scoped fallbacks when generic detection or fill cannot succeed consistently |

This principle aligns with ADR-003 and ADR-008: validate the generic path before investing in bespoke logic, and measure early integrations by generic-engine success — not by adapter count.

---

## Types of Website Integrations

The platform recognizes three integration types. They differ in **how the user discovers and configures** a service, not in whether generic integration is attempted first.

### 1. Catalog Integration

**Known services provided with the product.**

Examples validated or planned in the current architecture:

- **Shufersal** — generic 2-field login (catalog convenience + generic engine)
- **Clalit** — generic 3-field login (health-fund pattern via generic engine)
- **HTZone** — adapter-based login (popup and DOM patterns that generic detection does not handle reliably)

The catalog may provide:

- display name
- icon
- category
- login URL
- default login field definitions (field ids and human-readable labels)

These definitions help the hub and the generic field mapper align vault credential keys with page inputs. They are **defaults and UX affordances**, not a separate integration technology.

The catalog improves convenience. **It does not define what the product supports.**

---

### 2. Custom User Integration

The user may add their own website without waiting for a catalog entry.

The minimum information is typically:

- display name
- URL (often a homepage or known login entry point)

The generic engine attempts to **discover the login form automatically** on the opened page: locate a visible form with password and text inputs, infer or accept field schema, map hub fields to inputs, and fill from the vault.

If successful, the site **behaves exactly like a catalog service** from the user’s perspective — tile, credentials, open, fill, manual submit. No adapter is required because the user supplied the site, not because the site was blessed by the catalog.

---

### 3. Adapter Integration

Some websites require **additional logic** that the generic engine cannot provide reliably without site-specific knowledge.

Typical reasons:

- popup or modal login hidden until user interaction
- multi-step authentication before or after credential fields
- complex JavaScript flows that delay or replace standard forms
- unusual DOM structures (duplicate fields, non-standard visibility)
- embedded login experiences (cross-origin frames, shadow DOM patterns generic detection cannot see)

Adapters exist **only for these exceptional cases**. They are deliberately isolated: one site, one fallback path, no change to the generic engine’s core rules unless a fix benefits all sites.

HTZone illustrates this type: catalog metadata is shared with generic integrations, but fill relies on an adapter because login fields are not visible on page load in the main document.

---

## Generic Integration Flow

Conceptual flow for any integration that uses the generic engine (catalog or custom). No implementation detail — this is the user-visible and architectural sequence.

```
User selects service
        ↓
Determine login URL
        ↓
Open login page
        ↓
Detect login form
        ↓
Detect login fields
        ↓
Map Hub fields
        ↓
Fill credentials
        ↓
User submits manually
```

**Determine login URL** — From catalog `loginUrl`, user-provided URL, or navigation to a dedicated login page on the same origin.

**Detect login form** — Identify the best visible form on the page that contains fillable login inputs (typically at least one password field).

**Detect login fields** — Enumerate visible text and password inputs within that form.

**Map Hub fields** — Align vault credential keys and catalog field definitions with detected inputs (labels, names, ids, autocomplete hints).

**Fill credentials** — Write values from the encrypted vault into mapped fields only. No submission.

**User submits manually** — Authentication remains under user control (ADR-004). The product never completes login on the user’s behalf.

---

## Catalog Philosophy

The catalog must be understood correctly to avoid architectural drift.

| The catalog is **not** | The catalog **is** |
|------------------------|-------------------|
| A whitelist of supported websites | A collection of predefined services for usability |
| The list of what autofill “supports” | A shortcut for names, icons, URLs, and field schemas |
| A gate that blocks non-catalog sites | Optional; users are not limited to catalog entries |

Users are **not** limited to the catalog. Custom integrations and future catalog expansion both flow through the same generic-first decision process. Removing or never adding a catalog entry does not remove a site from the platform’s integration model — it only removes a UX convenience.

---

## Decision Process

When integrating a new website — whether adding a catalog tile, validating a Phase integration, or accepting a user-added site — follow this order:

**Step 1 — Attempt generic integration**

Open the login URL. Run generic form detection and field mapping. Attempt fill with vault credentials on the tile path. Document pass or fail with reasons (visibility, iframe, popup, CAPTCHA, multi-step, mapping failure).

**Step 2 — Evaluate the result**

Ask: Can a typical user get a reliable fill-and-manual-submit experience without site-specific code? Is failure due to a fixable generic heuristic (benefiting all sites) or irreducible site behavior?

**Step 3 — Adapter only if generic is insufficient**

If and only if generic integration cannot provide a reliable experience after evaluation (and targeted generic improvements where appropriate), consider a scoped adapter. The adapter must not replace generic as the default for other sites.

First real integrations (Phase 2) embodied this process: Shufersal and Clalit via generic engine; HTZone documented as adapter-based secondary validation, not as the primary generic proof.

---

## Long-Term Vision

Platform success is measured by **how many websites work through the generic engine** — not by how many adapters exist.

Each improvement to detection, mapping, visibility rules, or fill verification raises the ceiling for catalog services, custom user sites, and markets beyond the initial Israeli catalog. Adapters should shrink as a proportion of integrations over time, even if their absolute number grows slowly for genuinely exceptional sites.

Every generic-engine improvement is **multiplicative**: it benefits current catalog entries, user-added sites not yet imagined, and future clients that reuse the same hub and extension architecture.

The goal is a hub where reaching a digital service and having credentials filled feels routine and trustworthy, with bespoke code reserved for the long tail of broken or hostile login UX — not for every new logo on the dashboard.

The model is intentionally independent of how services are discovered.

Today, services may come from the built-in catalog or from user-defined custom entries.

In the future, additional service sources (for example organization-managed catalogs or other trusted service providers) may be introduced without changing the generic-first integration philosophy.

Regardless of where a service definition originates, every integration should first be evaluated through the generic engine before considering a site-specific adapter.

---

## Relationship to Other Documents

| Document | Role relative to this model |
|----------|----------------------------|
| [HIGH_LEVEL_ARCHITECTURE.md](./HIGH_LEVEL_ARCHITECTURE.md) | Describes hub, vault, extension, autofill engine, and catalog as **components**. This document defines the **integration philosophy** those components implement. |
| [DECISIONS.md](./DECISIONS.md) | Records stable decisions (generic before adapters, human submit, generic validation for first real integrations). This model is the architectural narrative behind ADR-003, ADR-004, and ADR-008. |
| [phases/PHASE_2_FIRST_REAL_INTEGRATION.md](./phases/PHASE_2_FIRST_REAL_INTEGRATION.md) | **Implementation plan** that applied this philosophy to Shufersal (generic 2-field) and Clalit (generic 3-field). It is evidence of the model in practice, not a replacement for it. |

Product principles and first-user journey documents describe *why* users trust the hub; high-level architecture describes *what* is built; phase plans describe *when* specific integrations are validated. **This document defines how every website integration should be reasoned about** regardless of phase or release.

---

## Core Principle

A website is not supported because it appears in the catalog.

A website appears in the catalog because it provides value to users.

Support comes from the generic integration engine.

The catalog improves usability.

The generic engine provides compatibility.

Adapters exist only when the generic approach cannot provide a reliable user experience.

---

## Status

| | |
|---|---|
| **Version** | 1.0 |
| **Status** | Living document |
| **Stability** | The architectural philosophy here is expected to remain stable even as implementation, catalog contents, and client surfaces evolve |

Implementation details, file layouts, and API contracts belong in architecture and phase documents — not here. When implementation diverges from this philosophy, either the implementation should be corrected or a new ADR should explain why.

---

*Generic site integration is the default. The catalog is convenience. Adapters are the exception.*
