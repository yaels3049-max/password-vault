export {
  resolveLoginAssistanceOpenUrl,
  type OpenUrlResolution,
  type OpenUrlSource,
} from './openUrlRules';

export {
  resolveLoginAssistanceLevel,
  allowsAutomaticCompletionAttempt,
  supportLevelLabel,
  LOGIN_ASSISTANCE_LEVEL_META_KEY,
  type LoginAssistanceLevel,
} from './supportLevel';

export { copyCredentialField, type CopyFieldResult } from './copyField';

export {
  openAssistanceUrl,
  attemptExistingAutomaticCompletion,
  describeOpenResolution,
  type OpenAssistanceUrlResult,
  type AutomaticCompletionAssistResult,
} from './assistanceActions';

export { serviceHasUsableCredentials } from './credentialsGate';

export {
  computeFloatingPanelPosition,
  type FloatingPanelCoords,
} from './floatingPosition';

export { default as LoginAssistancePanel } from './LoginAssistancePanel';
export type { LoginAssistancePanelProps } from './LoginAssistancePanel';

export * from './messages';
