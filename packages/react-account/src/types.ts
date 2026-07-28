export type AccountMfaMethod = 'totp' | 'email';

export type AccountMfaStatus = {
  mfaEnabled: boolean;
  mfaMethod: AccountMfaMethod | null;
};

export type AccountSession = {
  id: string | number;
  isCurrent: boolean;
  summary: string;
  detail?: string;
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
