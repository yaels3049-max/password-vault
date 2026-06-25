# Phase 1 — First User Journey Alignment

Implementation planning document.

**Authoritative sources:**

- [FIRST_USER_JOURNEY.md](../FIRST_USER_JOURNEY.md)
- [HIGH_LEVEL_ARCHITECTURE.md](../HIGH_LEVEL_ARCHITECTURE.md)
- [DECISIONS.md](../DECISIONS.md)

**Baseline:** Gap analysis comparing the current implementation (unlock → service selection → dashboard tiles → credential modal → extension POC) against the desired First User Journey.

This document is an **implementation specification**, not a product or architecture document.

---

## Goal

Align the **existing** web application with the emotional and behavioral path defined in `FIRST_USER_JOURNEY.md` — without replacing screens, architecture, or technology stack.

Phase 1 should move a first-time user from curiosity (“what does this do for me?”) through a **single reliable success** (one service, saved credentials, open with autofill, manual login) to the feeling that this is **their** hub — not a vault setup exercise.

Success is measured by journey alignment and testable acceptance criteria below, not by feature count or catalog breadth.

---

## Scope

Only the **highest-impact** improvements identified in the gap analysis. Each item evolves the current experience.

### 1. Product identity in user-facing terminology

Align all user-facing terminology with ADR-001.

The product is the **Personal Digital Hub**.

The Vault remains a secure component of the Hub.

User-facing terminology should consistently reflect this relationship.

The objective is architectural consistency, not branding alone. Existing screens and flows are unchanged.

**Affected copy areas (examples):** page title, unlock screen heading, dashboard heading, button labels where they present the vault as the product rather than as part of the hub.

### 2. First-run path optimized for one service

Within the existing `ManageServices` → `Dashboard` → `CredentialModal` flow, bias first-time behavior toward:

- selecting **one** service (not implying full catalog migration),
- saving credentials for that service,
- opening it from the dashboard.

Use flow logic and messaging on existing components — not new screens.

### 3. One reliable “magic moment” path

Define and stabilize **one production-quality** end-to-end path where:

1. User opens a service from the hub.
2. The target login page opens.
3. Credentials appear in visible fields (via extension).
4. User completes login manually (ADR-004).

The **local demo** pages may be used during development to validate the generic autofill engine and extension wiring. They are a **development aid only** — not the product goal.

Phase 1 is complete only when **one production-quality** end-to-end experience (a real service from the hub catalog, opened by tile) satisfies the acceptance criteria. Reliability remains more important than breadth (ADR-003). HTZone or another catalog service may serve as the designated path once it meets the same reliability bar (“first failed autofill destroys credibility”).

### 4. POC / developer controls off the primary path

Keep existing POC buttons and HTZone test entry points for engineering, but **remove them from the default first-user dashboard experience** (e.g. feature flag, dev-only visibility, or equivalent — implementation choice left to development).

First-time users should not see autofill architecture exposed as product UI.

### 5. Extension as part of one product

When autofill is required for the magic moment, surface **minimal, user-oriented guidance** that the browser extension enables the hub experience — not a separate product install. Reuse existing extension messaging bridge; no new technology.

Clarify prerequisite: extension installed and configured (`VITE_POC_EXTENSION_ID` in dev) before magic-moment acceptance testing.

### 6. Trust content after first value

Add **lightweight, optional** trust explanations (plain language) available **after** the user has completed at least one successful open/fill cycle — addressing:

- Where credentials are stored
- Whether anyone else can read them
- What happens if the device is lost

Align with ADR-002 (zero-knowledge, client-side encryption) without teaching cryptography. May use existing modal/section patterns; no new major UI areas.

### 7. Post-success reinforcement

After first credential save and/or first successful autofill, provide a **visible acknowledgment** on existing UI (copy, status message, or badge state) so the emotional outcome “that was easier than I expected” / “it actually works” is perceptible — not silent persistence only.

### 8. Return-visit messaging

Adjust **copy and entry ritual** on existing unlock/dashboard so returning users perceive re-unlock as entering **their** hub to start the day — without session persistence changes beyond current architecture (unlock still required on refresh unless separately decided).

---

## Out of Scope

The following are **intentionally excluded** from Phase 1:

| Excluded | Rationale |
|----------|-----------|
| New screens or application redesign | Journey alignment via evolution only |
| New technologies, frameworks, or storage backends | Preserve web-first platform (ADR-007) |
| Broad autofill rollout across the full Israeli catalog | Reliability before breadth (ADR-003, journey Stage 4) |
| Site-specific adapters beyond existing HTZone POC | Generic engine first |
| Multi-context / access-instance model (Phase 3 architecture) | ADR-006 — validate with users later |
| PWA, mobile, or desktop clients | ADR-007 — web-first; future phase |
| Cloud sync or account system | ADR-002 — ciphertext-only future; not required for first journey |
| Reordering unlock to after first success (full journey doc sequence) | Requires structural flow change; defer unless minimal copy-only compromise insufficient |
| Security audit / production launch gate | Architecture doc launch gate; not Phase 1 |
| Import from other password managers | Not in gap analysis; not journey Stage 1–4 |
| Auto-submit or MFA bypass | Non-goals in architecture doc; ADR-004 |
| Changes to `HIGH_LEVEL_ARCHITECTURE.md`, `PRODUCT_PRINCIPLES.md`, `DECISIONS.md`, or `FIRST_USER_JOURNEY.md` | This phase implements against them; does not rewrite them |
| Habit-formation mechanics beyond copy (notifications, analytics, bookmark install flows) | Stage 8 — partial; deep habit work is later phase |

---

## Affected Components

Existing components expected to change. **No replacements.**

| Component | Expected changes |
|-----------|------------------|
| [`index.html`](../../index.html) | Page title — Personal Digital Hub identity (ADR-001) |
| [`src/UnlockScreen.tsx`](../../src/UnlockScreen.tsx) | Copy: hub as product, vault as secure component; optional short value line before password |
| [`src/Dashboard.tsx`](../../src/Dashboard.tsx) | Heading copy; hide/segregate POC controls from default view; first-run hints; optional post-success/trust entry point |
| [`src/ManageServices.tsx`](../../src/ManageServices.tsx) | First-run copy encouraging one service; de-emphasize bulk catalog feel |
| [`src/CredentialModal.tsx`](../../src/CredentialModal.tsx) | Minor copy if needed; first-save acknowledgment hook (via parent) |
| [`src/Tile.tsx`](../../src/Tile.tsx) | No structural change; badge behavior may reinforce “ready to open” |
| [`src/App.tsx`](../../src/App.tsx) | First-run state detection (e.g. no credentials yet); routing hints between manage ↔ dashboard |
| [`src/pocAutofill.ts`](../../src/pocAutofill.ts) | Wiring only — magic-moment path invoked from tile flow, not orphan POC buttons |
| [`src/App.css`](../../src/App.css) | Styles for any new copy blocks or dev-only visibility — minimal |
| [`extension/`](../../extension/) | Verify generic engine and extension bridge support the designated **production** magic-moment service; local demo pages remain available for development validation only |

Components **not** expected to change in Phase 1:

- Vault crypto layer (`src/vault/`)
- Generic autofill engine modules (unless bugfixes required for demo reliability)
- HTZone adapter (isolated; out of scope unless chosen as magic-moment site)
- Service catalog data model (`mockServices.ts` structure)

---

## User Impact

How each scoped improvement maps to journey stages and emotional outcomes.

| Improvement | Journey stage | Emotional outcome supported |
|-------------|---------------|----------------------------|
| Product identity terminology | Curiosity, Ownership, Habit | Hub as product; vault as secure component — architectural consistency (ADR-001) |
| One-service first-run | Low Commitment, First Success | “I’ll try one website” — not “I must migrate everything” |
| Reliable magic moment | Magic Moment | “It actually works” — credibility established |
| POC hidden from primary path | Curiosity, Magic Moment | One coherent product — not visible technical components |
| Extension guidance | Magic Moment | Autofill feels enabled by the hub, not a separate tool |
| Trust after value | Trust | Anxiety reduced after demonstration, not before |
| Post-success reinforcement | First Success, Magic Moment | “Easier than I expected” — success is felt, not invisible |
| Return-visit copy | Ownership, Habit | Re-unlock feels like entering my space to begin the day |

---

## Risks

### Implementation risks

| Risk | Mitigation |
|------|------------|
| First-run detection logic is wrong for returning users | Define explicit state: e.g. zero credentials + first dashboard visit; test returning-user paths |
| Hiding POC controls blocks developer testing | Dev-only toggle or environment guard; document in README for team |
| Magic moment depends on extension + env config | Document prerequisites; fail gracefully with hub-language message if extension missing |
| Copy-only changes insufficient for journey sequencing | Accept Phase 1 limits; log “unlock reorder” as future phase if metrics show drop-off at unlock |
| Scope creep into catalog autofill | Hold acceptance to **one** proven path only |

### UX risks

| Risk | Mitigation |
|------|------------|
| Hub terminology inconsistent with ADR-001 | Single terminology pass; hub = product, vault = component; no mixed framing on same screen |
| One-service bias frustrates power users | “Add more services” remains available; bias is default messaging only |
| Trust content shown too early | Gate visibility on first successful fill/save flag |
| Trust content too technical | Plain-language review against `FIRST_USER_JOURNEY.md` Stage 5 |
| Production magic moment fails while demo works | Use demo only to debug engine/extension; do not accept demo as Phase 1 completion; hold AC-5/AC-6 until catalog tile path is reliable |

---

## UX Decision Principle

Whenever multiple technically valid implementation options exist, preference should always be given to the solution that best reinforces the emotional journey defined in `FIRST_USER_JOURNEY.md`.

User confidence should always take precedence over additional automation.

This principle complements ADR-004 and [PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md).

---

## Acceptance Criteria

Phase 1 is **complete** when all of the following are true. Each criterion is **testable**.

### Identity and first impression

- [ ] **AC-1:** A new user sees hub-oriented language (not “password vault” as primary identity) on the first screen and dashboard title.
- [ ] **AC-2:** No encryption, architecture, or vault mechanics are explained on the first screen before the user has experienced value.

### Low commitment and first success

- [ ] **AC-3:** A new user can complete first-run with **exactly one** selected service and reach the dashboard without selecting services in all categories.
- [ ] **AC-4:** After saving credentials for the first time, the user receives a **visible confirmation** (message, badge, or equivalent) on existing UI.

### Magic moment

- [ ] **AC-5:** With extension installed and configured, opening the designated Phase 1 service from the dashboard results in: tab opens → visible fields filled → user can submit login manually → no auto-submit.
- [ ] **AC-6:** The designated path succeeds **three consecutive times** in manual QA (reliability bar from journey doc).
- [ ] **AC-7:** POC/developer autofill buttons are **not visible** on the default dashboard for first-time or normal user mode.

### Extension and coherence

- [ ] **AC-8:** If extension is missing, the user sees a **clear hub-language message** (not a technical error) explaining what is needed to enable automatic fill.
- [ ] **AC-9:** Generic autofill debug logs (`[Generic Autofill]`, `[Legacy Autofill]`) remain devtools-only; no passwords in console.

### Trust after value

- [ ] **AC-10:** Trust explanations (where stored, who can read, lost device) are **not shown** until after first successful save or fill.
- [ ] **AC-11:** After trigger, trust content is reachable in **plain language** without requiring security expertise to understand.

### Architecture preservation

- [ ] **AC-12:** Zero-knowledge vault behavior unchanged — credentials encrypted client-side; master password never transmitted (ADR-002).
- [ ] **AC-13:** No auto-submit; no site-internal `login()` calls; no hidden-field fill (architecture non-goals, ADR-004).
- [ ] **AC-14:** Existing screens retained — `UnlockScreen`, `ManageServices`, `Dashboard`, `CredentialModal`, `Tile` all still present and functional.

### Regression

- [ ] **AC-15:** Local demo 2-field and 3-field autofill still work via generic engine when invoked in dev mode.
- [ ] **AC-16:** Returning user flow: unlock → dashboard with saved services and credentials loads without data loss.

---

## Suggested implementation order

1. Product identity terminology pass (AC-1, AC-2) — ADR-001 alignment; lowest risk.
2. First-run one-service bias (AC-3) — `App.tsx` / `ManageServices.tsx`.
3. POC segregation (AC-7) — `Dashboard.tsx`.
4. Production magic-moment path (AC-5, AC-6, AC-8) — designated catalog service via tile + extension; use local demo only during development.
5. Post-success confirmation (AC-4) — dashboard/modal feedback.
6. Trust-after-value content (AC-10, AC-11) — gated copy block.
7. Return-visit copy (habit support) — unlock screen.
8. Full regression pass (AC-12–AC-16).

---

## Document status

| | |
|---|---|
| **Phase** | 1 — First User Journey Alignment |
| **Status** | Approved for Development |
| **Depends on** | `FIRST_USER_JOURNEY.md` v1.0, `HIGH_LEVEL_ARCHITECTURE.md` v0.2, `DECISIONS.md` (ADR-001–007) |

---

*Implementation plans live here; product philosophy and architecture direction remain in the `docs/` parent documents.*
