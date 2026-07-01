# 20. Testing and Verification Rules

## 10. Purpose
Defines testing and verification standards for Team Yuri projects.

## 20. Core Principle
Every implementation change must be verified before it is declared complete.

Rules:
- No skipping verification.
- No assuming the user will verify manually.
- No declaring PASS with failing tests or failing lint.
- If verification cannot be performed, document why.

## 30. Mandatory Developer Responsibilities
Developer must:
- install missing dependencies required to run, test, or lint the project
- add or update unit tests for new functionality when supported
- run relevant unit tests before declaring PASS
- run lint before declaring PASS when supported
- fix test or lint failures within approved phase scope
- document commands and results in `team-Yuri/dev-phase<N>.md`

## 40. Test Selection

| Change type | Expected verification |
|---|---|
| Pure logic change | Unit tests |
| New component / module | Unit tests and lint |
| User-visible behavior | Unit tests where possible, lint, functional testability evidence |
| API / CLI behavior | Unit tests where possible, executable request/command evidence |
| Configuration / dependency change | Build/run verification, lint if supported |
| Documentation-only change | No code tests required; docs must be reviewed |

## 50. Unit Test Rules
Unit tests are required for new or changed logic when supported.
If no unit-test framework exists, document `Unit tests: NOT AVAILABLE` and the reason.

## 60. Lint Rules
Lint must be run when supported.
If no lint command exists, document `Lint: NOT AVAILABLE` and the reason.

## 70. Functional Testability Evidence
Developer must document how the phase outcome was exercised in `team-Yuri/dev-phase<N>.md`.

## 80. Required Evidence
`dev-phase<N>.md` must document phase identifier, implementation summary, files changed, dependencies, unit test command/result, lint command/result, functional testability, known issues, scope compliance, and declaration.
