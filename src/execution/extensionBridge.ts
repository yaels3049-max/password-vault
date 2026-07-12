/**
 * Thin compatibility shim — delegates to browser integration abstraction (Phase 108 M1).
 * Execution and discovery modules should import from here or ../browserIntegration.
 */
export {
  getChromeRuntime,
  getExtensionId,
  isExtensionAvailable,
  openUrlInNewTab,
  probeExtensionAvailable,
  sendExtensionMessage,
  sendExtensionMessageAsync,
} from '../browserIntegration';
