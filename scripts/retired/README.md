# Retired verify scripts

Superseded checks, kept for history only (B-122-2, 2026-10-02). They are not part of the offline regression (`scripts/runOfflineRegression.mjs`) and are not runnable from this folder (each resolves the repo root as its parent's parent).

- `verifyPhase105DigitalHome.mjs` — Phase 105 Digital Home structure (title, Useful Services / Notifications foundations, adaptive layout). Superseded by `78d44d2` (Phase 113 Digital Home UX): the Useful Services heading «שירותים שימושיים» became «אתרים שימושיים».
- `verifyPhase106SecurityTrust.mjs` — Phase 106 trust copy and credential-field autocomplete, incl. `src/UnlockScreen.tsx`. Superseded by `0e620a1` (Phase 109), which deleted `UnlockScreen.tsx`.
- `verifyPhase107Admin.mjs` — Phase 107 Admin platform static checks, incl. Login Discovery on approval-queue promote (`promoteUserSubmissionWithDiscovery`). Superseded by `01c414d` (MVP baseline before Phase 117), which removed that wiring; its nav-label check lives on in `verifyPhase122AdminWorkspace.mjs`. Closes B-122-1.
- `verifyPhase108CustomDiscovery.mjs` — Phase 108 shared Login Discovery for user custom-service creation (`App.tsx` → `discoverLoginForRegistryService`). Superseded by `01c414d` (MVP baseline before Phase 117), which removed the call from `App.tsx`.
- `verifyPhase108LivePath.mjs` — Phase 108 M11 discovery clear-policy / observability (`rawExtensionDiscovery` shown in `IntegrationStatusPanel.tsx`). Superseded by `01c414d` (MVP baseline before Phase 117), which removed the raw payload from the panel.
- `verifyPhase108FalsePositiveGate.mjs` — Phase 108 M9 / M10 login-URL false-positive / true-positive gate. Never runnable in the repo since it was added in `2c8ea5f` (Phase 108): it imports `jsdom`, which was never a project dependency.
