import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export type VeitPasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Zugänglicher Name im verborgenen Zustand */
  showPasswordLabel: string;
  /** Zugänglicher Name im sichtbaren Zustand */
  hidePasswordLabel: string;
  /** Zusätzliche Klassen für den äußeren Flex-Wrapper */
  wrapperClassName?: string;
  /** Zusätzliche Klassen für den Umschalt-Button */
  toggleButtonClassName?: string;
};

const toggleBtnDefault =
  'inline-flex shrink-0 items-center justify-center self-stretch rounded-md border border-input bg-background px-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50';

export const VeitPasswordField = forwardRef<HTMLInputElement, VeitPasswordFieldProps>(
  function VeitPasswordField(
    {
      showPasswordLabel,
      hidePasswordLabel,
      wrapperClassName = '',
      toggleButtonClassName = '',
      className = '',
      disabled,
      ...rest
    },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const toggleLabel = visible ? hidePasswordLabel : showPasswordLabel;

    return (
      <div className={`flex min-w-0 gap-2 ${wrapperClassName}`.trim()}>
        <input
          ref={ref}
          {...rest}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={`min-w-0 flex-1 ${className}`.trim()}
        />
        <button
          type="button"
          className={`${toggleBtnDefault} ${toggleButtonClassName}`.trim()}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <Eye className="h-4 w-4 shrink-0" aria-hidden /> : <EyeOff className="h-4 w-4 shrink-0" aria-hidden />}
        </button>
      </div>
    );
  },
);
