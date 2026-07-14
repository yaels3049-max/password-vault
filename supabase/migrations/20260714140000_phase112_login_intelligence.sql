-- Phase 112: Login Intelligence metadata contract on service_registry
-- Authoritative LI fields live in service_registry.metadata (JSONB).
-- This migration documents the contract and does not invent a second discovery pipeline.

comment on column public.service_registry.metadata is
  'JSON metadata bag. Phase 112 Login Intelligence keys (authoritative writer = Phase 112): '
  'loginComplexity (basic|medium|complex|unknown), loginFlowType, loginDetectionStatus, '
  'loginDetectionConfidence, loginDetectionLastCheckedAt, loginDetectionError, '
  'loginDetectionEngineVersion, lastValidatedBy (auto|admin|adapter), '
  'adapterRecommended, adapterReason, adapterLifecycle '
  '(recommended|approved|implemented|validated|deprecated), '
  'integrationHealth (healthy|degraded|needs_review|adapter_required|unsupported), '
  'supportedCredentialFields, federatedLoginOptions, requiresOtp, requiresCaptcha, '
  'usesIframe, usesModal, isMultiStep, loginIntelligenceAdminOverride. '
  'Phase 108 may write deferral hints only: phase112Deferred, loginIntelligenceHint, '
  'loginEntryType, usesModal, rejectedLoginUrl.';

-- No new required columns: LI is metadata-first (D-112-16).
-- Operators: see docs/MIGRATION_PHASE_112.md
