import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Landing page of the verification link (?token=…): confirms once on mount and shows the outcome.
 * renderAction is shown below the message, e.g. a link to the login or the account page.
 */
export function VerifyEmailView({
  t,
  onVerify,
  renderLogo,
  renderAction,
}: {
  t: (key: string) => string;
  onVerify: (token: string) => Promise<void>;
  renderLogo?: () => React.ReactNode;
  renderAction?: (ok: boolean) => React.ReactNode;
}) {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();
  const [state, setState] = useState<'pending' | 'ok' | 'invalid'>('pending');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState('invalid');
      return;
    }
    onVerify(token)
      .then(() => setState('ok'))
      .catch(() => setState('invalid'));
  }, [token, onVerify]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <main id="main-content" tabIndex={-1} className="outline-none w-full max-w-sm">
        {renderLogo && <div className="flex justify-center mb-8 text-foreground">{renderLogo()}</div>}
        <div className="card space-y-4 p-6 text-center">
          <p className={state === 'invalid' ? 'text-destructive' : 'text-foreground'}>
            {state === 'pending'
              ? t('common.loading')
              : state === 'ok'
                ? t('auth.verification_success')
                : t('auth.verification_invalid')}
          </p>
          {state !== 'pending' && renderAction?.(state === 'ok')}
        </div>
      </main>
    </div>
  );
}
