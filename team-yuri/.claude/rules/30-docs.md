# 30. Documentation Rules

## 10. Purpose
Defines documentation standards for Team Yuri projects.

## 20. Core Principle
Documentation is part of the deliverable.
Do not leave setup, run, usage, or known limitation knowledge only in chat.

## 30. Required Documentation Triggers

| Change type | Documentation required |
|---|---|
| New user-visible behavior | Yes |
| Changed setup/install steps | Yes |
| Changed run command | Yes |
| New or changed configuration | Yes |
| New CLI flow | Yes |
| New or changed API behavior | Yes |
| New dependency required for operation | Yes |
| New limitation or known issue | Yes |
| Internal refactor only | Only if structure, usage, or behavior changes |

## 40. Documentation Locations
Use `README.md` and `docs/` unless the project already has a clear convention.
Team Yuri artifacts are phase governance records, not a replacement for user-facing docs.

## 50. Phase Documentation Evidence
Developer must document in `team-Yuri/dev-phase<N>.md` whether documentation was updated, which docs changed, and why docs were not needed if none changed.
