# Architecture Decisions

This document records the major architectural and product decisions that shape the project.

Unlike implementation documents, these decisions are expected to remain stable over time.

Each decision records:

- the decision,
- why it was made,
- and its long-term consequence.

This document complements [HIGH_LEVEL_ARCHITECTURE.md](./HIGH_LEVEL_ARCHITECTURE.md) and [PRODUCT_PRINCIPLES.md](./PRODUCT_PRINCIPLES.md).

---

## ADR-001 — Product Identity

**Decision**

The product is a **Personal Digital Hub**.

It is **not** primarily a Password Manager.

Secure credential storage and browser autofill are supporting capabilities.

**Reason**

Users think about reaching their digital services, not about storing passwords.

The hub provides one trusted entry point to the user's digital life.

**Consequence**

Future product decisions should strengthen the hub experience rather than focusing solely on password management.

---

## ADR-002 — Zero-Knowledge Architecture

**Decision**

The product follows a strict Zero-Knowledge architecture.

Only encrypted credentials are stored.

Master passwords and encryption keys never leave the client.

**Reason**

User trust is more important than convenience.

The system should remain secure even if future cloud services are compromised.

**Consequence**

Future synchronization features must upload ciphertext only.

---

## ADR-003 — Generic Autofill before Site Adapters

**Decision**

Autofill must first attempt a generic discovery-and-fill engine.

Site-specific adapters are exceptions, not the default.

**Reason**

The product should scale to many services without requiring custom code for every website.

**Consequence**

Engineering effort should improve the generic engine before creating new adapters.

---

## ADR-004 — Human Control

**Decision**

Authentication always remains under user control.

The product never performs automatic login submission.

**Reason**

Visibility and trust are preferred over invisible automation.

**Consequence**

Autofill ends when the login form is completed. The user presses the final login button.

---

## ADR-005 — Product before Convenience

**Decision**

The product is designed around the user's Digital Hub experience.

Password storage exists to support the hub, not define it.

**Reason**

Long-term product differentiation comes from organizing digital life rather than replacing existing password managers.

**Consequence**

Future features should strengthen the hub experience before adding standalone password-management capabilities.

---

## ADR-006 — User Behavior before Architecture Expansion

**Decision**

Core UX models are validated through real users before becoming permanent architecture.

Examples include:

- Multiple tiles
- Profile selection
- Professional workflows
- Family workflows

**Reason**

Architecture should remain flexible until real usage patterns emerge.

**Consequence**

Future releases may change presentation without changing the underlying architecture.

---

## ADR-007 — Web-First Platform

**Decision**

The Personal Digital Hub is a Web-first platform.

The browser application is the primary user experience.

Browser extensions, future mobile applications and any additional clients are supporting interfaces rather than independent products.

**Reason**

Users should be able to securely access their Digital Hub from any trusted computer without depending on a specific device.

The platform should provide the same encrypted vault and user experience regardless of where the user signs in.

This decision also keeps the product portable across future clients while maintaining a single architectural foundation.

**Consequence**

Future development should prioritize the web platform.

Browser extensions remain complementary components whose purpose is to assist the web experience.

Future clients (PWA, mobile applications, desktop wrappers, etc.) should reuse the same platform architecture and encrypted data model rather than becoming separate products.

---

## ADR-008 — Generic Integration Validation

**Decision**

The first real website integration must validate the generic autofill engine before any new site-specific adapter is introduced.

**Reason**

The long-term architecture depends on a scalable generic autofill engine.

The first production-quality integration should therefore validate the generic path rather than an exception.

**Consequence**

When multiple candidate websites exist, preference is given to websites that can be integrated without introducing a site-specific adapter.

Adapter-based integrations remain important, but are performed only after the generic approach has been validated.

---

## Status

Living document.

New ADRs are added only when a strategic architectural or product decision is made.

Existing ADRs should almost never be modified. If a decision changes, add a new ADR explaining why.
