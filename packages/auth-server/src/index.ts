export { AuthError, authFail, isAuthError } from './errors.js';
export { AuthService, normalizeEmail, sha256hex, type AuthServiceOptions, type LoginResult, type ProfilePatch } from './service.js';
export { createAesGcmSecretBox } from './secretBox.js';
export { describeUserAgent } from './userAgent.js';
export type {
  AuthMailer,
  AuthStore,
  AuthUserPatch,
  AuthUserRecord,
  MfaChallengeRecord,
  MfaMethod,
  NewAuthUser,
  NewSession,
  PasswordResetRecord,
  RequestInfo,
  SecretBox,
  SessionRecord,
  UserId,
} from './types.js';
