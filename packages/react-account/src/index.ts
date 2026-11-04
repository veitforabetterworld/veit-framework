export type {
  AccountClient,
  AccountMfaMethod,
  AccountMfaStatus,
  AccountProfilePatch,
  AccountSession,
  AccountSessionBadge,
} from './types.js';
export {
  VeitAccountSection,
  VeitAccountPasswordSection,
  VeitAccountProfileFields,
  VeitAccountEmailField,
  VeitAccountMfaSection,
  VeitAccountDeletionSection,
  veitAccountChangePassword,
} from './sections.js';
export {
  VeitTotpSetupPanel,
  VeitEmailMfaSetupPanel,
  VeitMfaSetupStartActions,
  type VeitTotpSetupPanelProps,
  type VeitEmailMfaSetupPanelProps,
  type VeitMfaSetupStartActionsProps,
} from './mfaSetup.js';
export { VeitAccountSettings, type VeitAccountSettingsUser } from './VeitAccountSettings.js';
export {
  VeitAccountSessionsSection,
  VeitSessionClientIcon,
  type VeitAccountSessionsSectionProps,
} from './sessions.js';
/** UA parsing shared with '@veit/auth-server' (lives in '@veit/intl'), for host device lists. */
export {
  browserKindName,
  clientKindFromUserAgent,
  describeUserAgent,
  osKindName,
  parseUserAgent,
  type VeitBrowserKind,
  type VeitClientKind,
  type VeitClientKindOptions,
  type VeitOsKind,
  type VeitUserAgentInfo,
} from '@veit/intl';
export { veitAccountTexts, type VeitAccountTexts } from './texts.js';
export { createRestAccountClient, type VeitRestAccountClient } from './rest.js';
