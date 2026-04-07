import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext.js';
import { useRedirectIfAuthenticated } from './useRedirectIfAuthenticated.js';

type TFunction = (key: string) => string;

type AuthFrameProps = {
  children: React.ReactNode;
  renderLogo?: () => React.ReactNode;
  renderSkipToMain?: () => React.ReactNode;
  mainClassName?: string;
};

function AuthFrame({ children, renderLogo, renderSkipToMain, mainClassName }: AuthFrameProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {renderSkipToMain?.()}
      <main id="main-content" tabIndex={-1} className={mainClassName ?? 'outline-none rounded-sm w-full max-w-sm'}>
        {renderLogo && <div className="flex justify-center mb-8 text-foreground">{renderLogo()}</div>}
        {children}
      </main>
    </div>
  );
}

export function LoginForm<User>({
  t,
  parseError,
  onSendMfaEmailCode,
  renderLogo,
  renderSkipToMain,
}: {
  t: TFunction;
  parseError: (error: unknown) => string;
  onSendMfaEmailCode?: (token: string) => Promise<string | null>;
  renderLogo?: () => React.ReactNode;
  renderSkipToMain?: () => React.ReactNode;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifiedMessage, setVerifiedMessage] = useState<'success' | 'invalid' | null>(null);
  const { login, completeMfaLogin } = useAuth<User>();
  const blockGuestPage = useRedirectIfAuthenticated<User>();
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaEmailHint, setMfaEmailHint] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  useEffect(() => {
    const v = searchParams.get('verified');
    if (v === 'success' || v === 'invalid') {
      setVerifiedMessage(v);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMfaEmailHint(null);
    setSubmitting(true);
    try {
      if (!mfaStep) {
        const res = await login(email, password);
        if (res.needsMfa) {
          setMfaToken(res.mfaToken);
          setMfaMethods(res.mfaMethods);
          setMfaStep(true);
          setMfaCode('');
          return;
        }
        navigate(from, { replace: true });
        return;
      }
      const code = mfaCode.replace(/\s/g, '');
      if (!/^\d{6}$/.test(code)) {
        setError(t('auth.mfa_invalid'));
        return;
      }
      await completeMfaLogin(mfaToken, code);
      navigate(from, { replace: true });
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const sendMfaEmailCode = async () => {
    if (!onSendMfaEmailCode) return;
    setError(null);
    setMfaEmailHint(null);
    setSubmitting(true);
    try {
      const key = await onSendMfaEmailCode(mfaToken);
      setMfaEmailHint(key ? t(key) : t('auth.mfa_email_sent'));
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (blockGuestPage) {
    return <div className="min-h-screen flex items-center justify-center bg-background p-4">{t('common.loading')}</div>;
  }

  return (
    <AuthFrame renderLogo={renderLogo} renderSkipToMain={renderSkipToMain}>
      <h1 className="heading-1 mb-6">{mfaStep ? t('auth.mfa_login_title') : t('auth.login')}</h1>
      {verifiedMessage === 'success' && <div className="alert-success text-sm mb-4">{t('auth.verification_success')}</div>}
      {verifiedMessage === 'invalid' && <div className="alert-warning text-sm mb-4">{t('auth.verification_invalid')}</div>}
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="alert-error text-sm">{error}</div>}
        {mfaEmailHint && <div className="alert-success text-sm">{mfaEmailHint}</div>}
        {!mfaStep ? (
          <>
            <div>
              <label htmlFor="login-email" className="label">{t('account.email')}</label>
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="input" />
            </div>
            <div>
              <label htmlFor="login-password" className="label">{t('account.password')}</label>
              <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="current-password" className="input" />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t('auth.mfa_login_hint')}</p>
            <div>
              <label htmlFor="mfa-code" className="label">{t('auth.mfa_code_label')}</label>
              <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="input tracking-widest font-mono" placeholder="000000" />
            </div>
            {mfaMethods.includes('email') && onSendMfaEmailCode && (
              <button type="button" disabled={submitting} onClick={() => void sendMfaEmailCode()} className="w-full btn-secondary py-2 text-sm">
                {t('auth.mfa_send_code_email')}
              </button>
            )}
            <button type="button" onClick={() => setMfaStep(false)} className="w-full text-sm text-muted-foreground hover:text-foreground">
              {t('auth.mfa_back')}
            </button>
          </>
        )}
        <button type="submit" disabled={submitting} className="w-full btn-primary py-2.5">{mfaStep ? t('auth.mfa_verify') : t('auth.login')}</button>
      </form>
    </AuthFrame>
  );
}

export function RegisterForm<User>({
  t,
  parseError,
  renderLogo,
  renderSkipToMain,
  renderPrivacyConsent,
}: {
  t: TFunction;
  parseError: (error: unknown) => string;
  renderLogo?: () => React.ReactNode;
  renderSkipToMain?: () => React.ReactNode;
  renderPrivacyConsent: (checked: boolean, onCheckedChange: (next: boolean) => void) => React.ReactNode;
}) {
  const { register } = useAuth<User>();
  const blockGuestPage = useRedirectIfAuthenticated<User>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsgKey, setSuccessMsgKey] = useState('auth.verification_email_sent');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!agreePrivacy) return setError(t('auth.privacy_agree_required'));
    if (!firstName.trim() || !lastName.trim()) return setError(t('auth.first_last_name_required'));
    setSubmitting(true);
    try {
      const msgKey = await register({ email, password, firstName, lastName, allowDirectOrgAdd: false });
      setSuccessMsgKey(msgKey.startsWith('auth.') ? msgKey : 'auth.verification_email_sent');
      setSuccess(true);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (blockGuestPage) return <div className="min-h-screen flex items-center justify-center bg-background p-4">{t('common.loading')}</div>;

  return (
    <AuthFrame renderLogo={renderLogo} renderSkipToMain={renderSkipToMain}>
      {success ? (
        <div className="alert-success mb-4">{t(successMsgKey)}</div>
      ) : (
        <>
          <h1 className="heading-1 mb-6">{t('auth.register')}</h1>
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="alert-error text-sm">{error}</div>}
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" className="input" placeholder={t('account.first_name')} />
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" className="input" placeholder={t('account.last_name')} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="input" placeholder={t('account.email')} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className="input" placeholder={t('auth.password_min_length_label')} />
            {renderPrivacyConsent(agreePrivacy, setAgreePrivacy)}
            <button type="submit" disabled={submitting} className="w-full btn-primary py-2.5">{t('auth.register')}</button>
          </form>
        </>
      )}
    </AuthFrame>
  );
}

export function ForgotPasswordForm<User>({
  t,
  parseError,
  onRequestReset,
  renderLogo,
  renderSkipToMain,
}: {
  t: TFunction;
  parseError: (error: unknown) => string;
  onRequestReset: (email: string) => Promise<void>;
  renderLogo?: () => React.ReactNode;
  renderSkipToMain?: () => React.ReactNode;
}) {
  const blockGuestPage = useRedirectIfAuthenticated<User>();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onRequestReset(email);
      setSuccess(true);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (blockGuestPage) return <div className="min-h-screen flex items-center justify-center bg-background p-4">{t('common.loading')}</div>;

  return (
    <AuthFrame renderLogo={renderLogo} renderSkipToMain={renderSkipToMain}>
      <h1 className="heading-1 mb-2">{t('auth.forgot_password')}</h1>
      <p className="muted mb-6">{t('auth.forgot_password_hint')}</p>
      {success ? (
        <div className="alert-success text-sm mb-4">{t('auth.password_reset_email_sent')}</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="alert-error text-sm">{error}</div>}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="input" />
          <button type="submit" disabled={submitting} className="w-full btn-primary py-2.5">{t('auth.send_reset_link')}</button>
        </form>
      )}
    </AuthFrame>
  );
}

export function ResetPasswordForm({
  t,
  parseError,
  onConfirmReset,
  token,
  renderLogo,
  renderSkipToMain,
}: {
  t: TFunction;
  parseError: (error: unknown) => string;
  onConfirmReset: (token: string, password: string) => Promise<void>;
  token?: string | null;
  renderLogo?: () => React.ReactNode;
  renderSkipToMain?: () => React.ReactNode;
}) {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = useMemo(() => (searchParams.get('token') ?? '').trim(), [searchParams]);
  const effectiveToken = (token ?? tokenFromUrl).trim();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!effectiveToken) return setError(t('auth.password_reset_invalid'));
    setSubmitting(true);
    try {
      await onConfirmReset(effectiveToken, password);
      setSuccess(true);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame renderLogo={renderLogo} renderSkipToMain={renderSkipToMain}>
      <h1 className="heading-1 mb-2">{t('auth.reset_password')}</h1>
      <p className="muted mb-6">{t('auth.reset_password_hint')}</p>
      {success ? (
        <div className="alert-success text-sm mb-4">{t('auth.password_reset_success')}</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="alert-error text-sm">{error}</div>}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className="input" />
          <button type="submit" disabled={submitting} className="w-full btn-primary py-2.5">{t('auth.set_new_password')}</button>
        </form>
      )}
    </AuthFrame>
  );
}
