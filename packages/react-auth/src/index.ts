export { createAuthProvider, useAuth, type AuthContextValue } from './AuthContext.js';
export { ProtectedRoute, veitLoginPathWithNext } from './ProtectedRoute.js';
export { resolvePostLoginPath, safeNextParam } from './postLoginPath.js';
export { useRedirectIfAuthenticated } from './useRedirectIfAuthenticated.js';
export { LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, PasswordLoginForm } from './forms.js';
export type { PasswordLoginFormProps } from './forms.js';
export type { AuthClient, AuthLoginResult, AuthRegisterInput, AuthMfaMethod } from './types.js';
export { VerifyEmailView } from './VerifyEmailView.js';
export {
  createRestAuthClient,
  isVeitNetworkError,
  veitFetchJson,
  VeitApiError,
  VEIT_NETWORK_ERROR_STATUS,
  type VeitApiErrorExtra,
  type VeitFetchJsonInit,
  type VeitRestAuthClient,
  type VeitWireUser,
} from './rest.js';
export { veitAuthMessages, veitAuthT, veitAuthErrorText, type VeitAuthLocale } from './messages.js';
