# 40. Project Structure Rules

## 10. Purpose
Defines repository and folder-structure standards for Team Yuri projects.

## 20. Core Principle
Project structure must be explicit and intentional.

Rules:
- Do not invent top-level folders without Architect approval.
- Do not scatter source files across unrelated folders.
- Do not mix Team Yuri governance artifacts with application source code.
- Follow existing project conventions when clear and reasonable.

## 30. Standard Top-Level Areas

```text
.claude/
.cursor/
team-Yuri/
src/
tests/
docs/
```

## 40. Skill Structure

Claude Code:
```text
.claude/skills/team-yuri-architect/
.claude/skills/team-yuri-manager/
.claude/skills/team-yuri-developer/
```

Cursor:
```text
.cursor/skills/team-yuri-architect/
.cursor/skills/team-yuri-manager/
.cursor/skills/team-yuri-developer/
```

Each skill should use:
```text
SKILL.md
references/
assets/
scripts/     # optional
```

## 50. Team Yuri Structure

```text
team-Yuri/
  PHASE.md
  plan.md
  arch-phase<N>.md
  manager-phase<N>.md
  dev-phase<N>.md
```

Do not create `validation-phase<N>.md`.
Do not create `devlog-phase<N>.md`; use `dev-phase<N>.md`.
