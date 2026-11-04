import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export type VeitAlertVariant = 'error' | 'warning' | 'info' | 'success';

export type VeitAlertProps = {
  variant?: VeitAlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  /** Button or link on the right, e.g. "Erneut versuchen". */
  action?: ReactNode;
  /** Own icon; `false` hides it. */
  icon?: ReactNode | false;
  /** Only the coloured text line, without box and icon (replaces `<p className="text-destructive">`). */
  plain?: boolean;
  id?: string;
  className?: string;
};

/** Box and text colours per variant; also used by the toasts. */
export const veitAlertToneClass: Record<VeitAlertVariant, string> = {
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-warning/30 bg-warning/10 text-foreground',
  info: 'border-info/30 bg-info/10 text-foreground',
  success: 'border-success/30 bg-success/10 text-foreground',
};

const PLAIN_TEXT: Record<VeitAlertVariant, string> = {
  error: 'text-destructive',
  warning: 'text-warning-foreground',
  info: 'text-muted-foreground',
  success: 'text-success',
};

const ICON_CLASS: Record<VeitAlertVariant, string> = {
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
  success: 'text-success',
};

export function veitAlertIcon(variant: VeitAlertVariant): ReactNode {
  const className = `mt-0.5 size-4 shrink-0 ${ICON_CLASS[variant]}`;
  if (variant === 'error') return <XCircle className={className} aria-hidden />;
  if (variant === 'warning') return <AlertTriangle className={className} aria-hidden />;
  if (variant === 'success') return <CheckCircle2 className={className} aria-hidden />;
  return <Info className={className} aria-hidden />;
}

/** `alert` interrupts the screen reader, `status` waits: errors and warnings are urgent, the rest is not. */
export function veitAlertRole(variant: VeitAlertVariant): 'alert' | 'status' {
  return variant === 'error' || variant === 'warning' ? 'alert' : 'status';
}

/** Message box for errors, warnings, hints and confirmations. */
export function VeitAlert({ variant = 'error', title, children, action, icon, plain = false, id, className = '' }: VeitAlertProps) {
  const role = veitAlertRole(variant);
  if (plain) {
    return (
      <p id={id} role={role} className={`m-0 text-sm ${PLAIN_TEXT[variant]} ${className}`.trim()}>
        {title ? <span className="font-medium">{title} </span> : null}
        {children}
      </p>
    );
  }
  return (
    <div
      id={id}
      role={role}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${veitAlertToneClass[variant]} ${className}`.trim()}
    >
      {icon === false ? null : (icon ?? veitAlertIcon(variant))}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="m-0 font-medium">{title}</p> : null}
        {children ? <div className="leading-snug">{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
