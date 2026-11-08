import type { ReactNode } from 'react';
import type { VeitBrowserKind, VeitClientKind } from '@veit/intl';
import type { VeitStatusBadgeVariant } from '@veit/react-controls';

export type AccountMfaMethod = 'totp' | 'email';

export type AccountMfaStatus = {
  mfaEnabled: boolean;
  mfaMethod: AccountMfaMethod | null;
};

export type AccountSessionBadge = {
  label: string;
  /** Default 'primary'. */
  variant?: VeitStatusBadgeVariant;
  icon?: ReactNode;
};

export type AccountSession = {
  id: string | number;
  isCurrent: boolean;
  summary: string;
  detail?: string;
  /** Icon slot: browser, the host's app, a phone or desktop system; without it no icon. */
  clientKind?: VeitClientKind;
  /** With clientKind `browser`: which one, for its logo (see sessionClientFromUserAgent); without it a globe. */
  browser?: VeitBrowserKind;
  /** Small badges after the name, e.g. "Push aktiv". */
  badges?: readonly AccountSessionBadge[];
};

export type AccountProfilePatch = {
  firstName?: string;
  lastName?: string;
  email?: string;
  profileImageFileId?: string | null;
  allowDirectOrgAdd?: boolean;
  emailVisibleToOthers?: boolean;
  lastNameVisibleToOthers?: boolean;
};

/**
 * Host-API für Account-Einstellungen (analog zu {@link AuthClient}).
 * Apps implementieren die Calls gegen oRPC/REST; UI bleibt im Framework.
 */
export interface AccountClient {
  patchProfile: (patch: AccountProfilePatch) => Promise<void>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  listSessions: () => Promise<AccountSession[]>;
  revokeSession: (id: string | number) => Promise<void>;
  getMfaStatus: () => Promise<AccountMfaStatus>;
  startTotpMfa?: () => Promise<{ otpauthUri: string; secretBase32: string }>;
  confirmTotpMfa?: (code: string) => Promise<void>;
  startEmailMfa?: () => Promise<{ messageKey?: string }>;
  confirmEmailMfa?: (code: string) => Promise<void>;
  disableMfa?: (currentPassword: string) => Promise<void>;
  requestDeletion?: () => Promise<void>;
}
