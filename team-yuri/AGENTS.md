# Team Yuri Agent Instructions

## 10. Purpose
Team Yuri is an artifact-based governed AI development workflow:
Architect → Manager → Developer → Manager Review → Architect Review.

Artifacts are the source of truth for state, phase scope, handoff status, and completion evidence.

## 20. Operating Principle
All Team Yuri roles operate under: Plan → Perform in Steps → Verify.

Rules:
- No big-bang edits.
- No silent assumptions.
- No skipping verification.
- Do not infer missing scope, constraints, or decisions.
- If required information is missing, stop and ask.

## 30. Orchestration Model
The user is the orchestrator.

Rules:
- The user decides when to invoke each skill.
- Skills do not trigger other skills.
- Skills do not communicate directly with each other.
- Skills communicate through artifacts and user-mediated handoff prompts.
- If a skill needs clarification, it must ask one question at a time.

## 40. Artifact Purity
Artifacts represent state, not communication.

Artifacts may contain plans, decisions, scope, logs, results, status fields, and verification evidence.
Artifacts must not contain conversation logs, prompt exchanges, negotiation traces, informal chat history, or instructions to other roles.

## 50. Artifact Ownership
A skill may write only artifacts explicitly assigned to it.
A skill may read upstream artifacts required for its role.
A skill must not repair, rewrite, or complete another role’s artifact.
If an upstream artifact is missing, empty, malformed, incomplete, or phase-misaligned, the skill must stop.

## 60. Phase Pointer
The single source of truth for the current phase is:

```text
team-Yuri/PHASE.md
```

`PHASE.md` must contain exactly one line:

```text
PHASE=<number>
```

No comments, no extra fields, no additional lines.
The phase number must be derived only from `PHASE.md`.

## 70. Team Yuri Artifact Model

```text
team-Yuri/
  PHASE.md
  plan.md
  arch-phase<N>.md
  manager-phase<N>.md
  dev-phase<N>.md
```

There is no separate validation artifact. Developer verification evidence lives in `dev-phase<N>.md`.

## 80. Upstream Completeness Gate
If a required upstream artifact is missing, empty, malformed, missing required sections, or not aligned with `PHASE=<N>`, the skill must stop immediately.

The skill must report:

```text
FAIL: BLOCKED – MISSING OR INCOMPLETE ARTIFACT
```

## 90. State Determination
Each skill must operate in exactly one state per invocation.
State must be determined from filesystem artifact state, not assumptions.
If exactly one valid state cannot be determined, stop.

## 100. Phase Advancement
No skill silently advances the phase.
A skill must not update `PHASE.md` unless explicitly allowed by its own state rules.
Any instruction to advance the phase must be printed clearly for the user.

## 110. Output Contract
Every Team Yuri skill response must include:

```text
Detected phase: <N or N/A>
Selected state: <STATE>
Status: <PASS | FAIL | BLOCKED | QUESTION | COMPLETE>
```

When the next role should act, print:

```text
PROMPT FOR <ROLE>:
<copy/paste instruction>
```

Prompts are printed only and must not be stored inside artifacts.

## 120. Team Yuri Roles

| Role | Persona | Primary responsibility |
|---|---|---|
| Architect | Yuri | High-level plan, phase architecture, final phase review |
| SW Manager | Ben | Detailed design, Developer review |
| SW Developer | Sarah | Implementation, unit tests, lint, dev report |

## 130. Naming Conventions
Use exactly: `PHASE.md`, `plan.md`, `arch-phase<N>.md`, `manager-phase<N>.md`, `dev-phase<N>.md`.

Do not create `devlog-phase<N>.md`, `validation-phase<N>.md`, or `architect-phase<N>.md`.

## 140. Project Structure Constraints
Do not invent additional top-level folders without Architect approval.

## 150. Verification Principle
Verification is mandatory, but role-specific.
Developer must document implementation verification in `dev-phase<N>.md`.
Developer verification includes unit tests and lint unless the project has no such mechanism, in which case the reason must be documented.
The user must not be assumed to install dependencies, run tests, run lint, or complete unfinished verification manually.

## 160. Functional Testability Principle
Each phase should produce a functionally testable outcome unless the user explicitly approves an infrastructure-only phase.

A functionally testable outcome means the user can observe or execute something concrete:
- opening a page and seeing expected behavior
- running a command-line flow
- calling an API endpoint and receiving an expected response
- completing a minimal end-to-end user flow

Infrastructure-only phases are discouraged and require explicit approval plus explanation.

## 170. Additional Project Rules
All Team Yuri skills must follow relevant project rules:

Claude Code:
```text
.claude/rules/20-testing.md
.claude/rules/30-docs.md
.claude/rules/40-project-structure.md
```

Cursor:
```text
.cursor/rules/20-testing.md
.cursor/rules/30-docs.md
.cursor/rules/40-project-structure.md
```
