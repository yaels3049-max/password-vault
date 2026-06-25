# First User Journey

This document complements [PRODUCT_PRINCIPLES.md](./PRODUCT_PRINCIPLES.md), [HIGH_LEVEL_ARCHITECTURE.md](./HIGH_LEVEL_ARCHITECTURE.md), and [DECISIONS.md](./DECISIONS.md).

Its purpose is to describe the desired emotional and behavioral journey of a first-time user.

This is **not** a UI specification.

This is **not** an implementation document.

It defines how a new user gradually builds trust until the Personal Digital Hub becomes part of their daily routine.

---

## Purpose

The onboarding is not about teaching the product.

It is about creating trust.

The user's initial goal is simple:

> "I need to get into one website quickly."

The onboarding should gradually transform that intention into a long-term habit:

> "From now on, I begin my digital day here."

The product succeeds when the Hub becomes the user's natural starting point for accessing their digital world.

---

## Design Principles

The onboarding should never feel like setting up software.

It should feel like discovering a better way to begin the day.

Ask for the smallest possible commitment.

Deliver visible value as early as possible.

Reduce uncertainty at every step.

Increase confidence after every successful interaction.

Never ask for trust before earning it.

---

## User Journey

### Stage 1 — Curiosity

User emotion:

"I'm curious."

The user wants to understand one thing:

"What does this do for me?"

Do not explain encryption.

Do not explain architecture.

Do not explain vaults.

Communicate one simple promise:

"This becomes the easiest place to access the websites you use every day."

---

### Stage 2 — Low Commitment

User emotion:

"I'll try one website."

The user should never feel that a complete migration is required.

The first commitment should be intentionally small.

---

### Stage 3 — First Success

The user adds exactly one service.

The objective is not collecting data.

The objective is building confidence.

Emotional outcome:

"That was easier than I expected."

---

### Stage 3.5 — Ownership

User emotion:

"This is my space."

The user enters the Master Password.

The Hub unlocks.

Their personal dashboard becomes available.

Without reading a security explanation, the user experiences one of the platform's core promises:

Nothing becomes available until they unlock it.

The product has now changed from a generic application into the user's own Digital Hub.

Emotional outcome:

"I unlock my own digital world."

---

### Stage 4 — The Magic Moment

The user selects their service.

The website opens.

Credentials appear automatically.

The user completes login manually.

Emotional outcome:

"It actually works."

The first successful autofill establishes credibility.

The first failed autofill destroys it.

For this reason, reliability is more important than feature breadth.

---

### Stage 5 — Trust

Only after value has been demonstrated should the product explain security.

Typical questions now become:

- Where are my passwords stored?
- Can anyone else read them?
- What happens if my computer is lost?

Security explanations should reduce anxiety rather than increase cognitive load.

---

### Stage 6 — Ownership Growth

The user voluntarily adds another service.

The Hub is no longer an experiment.

It is becoming part of the user's workflow.

Expansion should happen naturally.

Never pressure the user.

---

### Stage 7 — Habit Formation

The desired long-term behavior is:

Morning.

Open computer.

Open Personal Digital Hub.

Begin the day.

Success is not measured by:

- Number of stored passwords.
- Number of configured services.
- Number of imported accounts.

Success is measured by one behavioral change:

The Hub becomes the user's natural starting point for accessing their digital life.

---

## Architectural Principle

The architecture exists to support this journey.

From the user's perspective there is no:

- Vault
- Browser Extension
- Autofill Engine

There is only one product:

**My Personal Digital Hub**

The underlying architecture should remain invisible to the user whenever possible.

Users should experience one coherent product, not multiple technical components.

Concepts such as Vault, Browser Extension, Autofill Engine and Service Catalog exist to support the experience, not define it.

The product should always feel like one trusted place.

Every architectural decision should reinforce one principle:

The Hub should become the most trusted and effortless starting point for the user's digital life.

---

## Status

**Version 1.0**

Living document.

This document may evolve as user research provides new insights.

Behavioral insights from real user research are expected to refine this document over time.

The overall emotional journey should remain stable.

This document defines the desired user journey.

Individual screens, UI flows and implementation details may evolve over time without changing the journey itself.

The emotional progression described in this document should remain stable even as the product matures.
