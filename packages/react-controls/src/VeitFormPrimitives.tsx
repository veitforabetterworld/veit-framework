import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ButtonHTMLAttributes,
} from 'react';

/* -------------------------------------------------------------------------- */
/* Class constants (Plenivo dialog / general form surfaces)                     */
/* -------------------------------------------------------------------------- */

/** Haupt-Stack für Formulare in Detail-Dialogen. */
export const veitDialogFormStackClass = 'space-y-4';
/** @deprecated Alias — use {@link veitDialogFormStackClass} */
export const dialogDetailFormStackClass = veitDialogFormStackClass;

export const veitInputClass = 'input min-h-[44px] w-full text-base sm:text-sm';
/** @deprecated Alias — use {@link veitInputClass} */
export const dialogDetailInputClass = veitInputClass;

export const veitTextareaClass = 'input min-h-[5rem] w-full resize-y text-sm';
/** @deprecated Alias — use {@link veitTextareaClass} */
export const dialogDetailTextareaClass = veitTextareaClass;

export const veitSelectClass = 'input min-h-[44px] w-full text-base sm:text-sm';
/** @deprecated Alias — use {@link veitSelectClass} */
export const dialogDetailSelectClass = veitSelectClass;

/** Kompakte Tabellen-/Matrix-Eingaben. */
export const veitInputCompactClass = 'input w-full min-h-0 px-2 py-1 text-sm';
/** @deprecated Alias — use {@link veitInputCompactClass} */
export const inputCompactClass = veitInputCompactClass;

/** Picker-Trigger in Dialog-Formularen. */
export const veitPickerTriggerClass =
  'input min-h-[44px] w-full flex items-center justify-between text-left text-sm';
/** @deprecated Alias — use {@link veitPickerTriggerClass} */
export const dialogDetailPickerTriggerClass = veitPickerTriggerClass;

/** Dialog-Feldbeschriftungen (klein, uppercase, muted). */
export const veitFieldLabelClass =
  'text-xs font-semibold uppercase tracking-wide text-muted-foreground';
/** @deprecated Alias — use {@link veitFieldLabelClass} */
export const dialogDetailLabelClass = veitFieldLabelClass;

/** Icon-only delete button size (pairs with {@link VeitDeleteButton}). */
export const VEIT_DELETE_ICON_BUTTON_CLASS =
  'btn-destructive inline-flex h-9 min-h-9 w-9 min-w-9 shrink-0 items-center justify-center gap-0 rounded-md !px-0 !py-0';
/** @deprecated Alias — use {@link VEIT_DELETE_ICON_BUTTON_CLASS} */
export const DELETE_ICON_BUTTON_CLASS = VEIT_DELETE_ICON_BUTTON_CLASS;

/* -------------------------------------------------------------------------- */
/* VeitField — label + hint + error                                            */
/* -------------------------------------------------------------------------- */

export type VeitFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Label style: `dialog` = uppercase muted; `default` = `.label` */
  labelVariant?: 'default' | 'dialog';
};

/**
 * Form field shell with optional hint and validation error.
 * Hosts own validation; framework only displays `error`.
 */
export function VeitField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = '',
  labelVariant = 'default',
}: VeitFieldProps) {
  const uid = useId();
  const hintId = hint ? `${uid}-hint` : undefined;
  const errorId = error ? `${uid}-error` : undefined;
  const labelClass =
    labelVariant === 'dialog' ? `block ${veitFieldLabelClass}` : 'label';

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <VeitDialogDetailSectionTitle>{label}</VeitDialogDetailSectionTitle>
      )}
      {children}
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Native control wrappers                                                     */
/* -------------------------------------------------------------------------- */

export type VeitInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Extra class; defaults include {@link veitInputClass}. */
  invalid?: boolean;
};

export const VeitInput = forwardRef<HTMLInputElement, VeitInputProps>(function VeitInput(
  { className = '', invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`${veitInputClass} ${invalid ? 'border-destructive' : ''} ${className}`.trim()}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export type VeitTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const VeitTextarea = forwardRef<HTMLTextAreaElement, VeitTextareaProps>(
  function VeitTextarea({ className = '', invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`${veitTextareaClass} ${invalid ? 'border-destructive' : ''} ${className}`.trim()}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

export type VeitSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const VeitSelect = forwardRef<HTMLSelectElement, VeitSelectProps>(function VeitSelect(
  { className = '', invalid, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`${veitSelectClass} ${invalid ? 'border-destructive' : ''} ${className}`.trim()}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
});

/* -------------------------------------------------------------------------- */
/* Dialog detail helpers (from Plenivo DetailDialogPrimitives)                 */
/* -------------------------------------------------------------------------- */

export type VeitDialogDetailFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  hint?: ReactNode;
  error?: ReactNode;
};

/** Feldlabel + Inhalt für Detail-Dialoge. */
export function VeitDialogDetailField({
  label,
  htmlFor,
  children,
  className = '',
  hint,
  error,
}: VeitDialogDetailFieldProps) {
  return (
    <VeitField
      label={label}
      htmlFor={htmlFor}
      className={className}
      labelVariant="dialog"
      hint={hint}
      error={error}
    >
      {children}
    </VeitField>
  );
}

/** Alias — same as {@link VeitDialogDetailField}. */
export function VeitDialogFormField(props: VeitDialogDetailFieldProps) {
  return <VeitDialogDetailField {...props} />;
}

/** @deprecated Prefer {@link VeitDialogDetailField} */
export const DialogDetailField = VeitDialogDetailField;
/** @deprecated Prefer {@link VeitDialogFormField} */
export const DialogFormField = VeitDialogFormField;

export type VeitDialogDetailSectionProps = {
  children: ReactNode;
  className?: string;
  spacing?: 'compact' | 'comfortable';
};

export function VeitDialogDetailSection({
  children,
  className = '',
  spacing = 'compact',
}: VeitDialogDetailSectionProps) {
  const gap = spacing === 'comfortable' ? 'space-y-4' : 'space-y-2';
  return <div className={`${gap} border-t border-border/40 pt-4 ${className}`.trim()}>{children}</div>;
}

/** @deprecated Prefer {@link VeitDialogDetailSection} */
export const DialogDetailSection = VeitDialogDetailSection;

export type VeitDialogDetailSectionTitleProps = {
  children: ReactNode;
  align?: 'start' | 'center';
  className?: string;
};

export function VeitDialogDetailSectionTitle({
  children,
  align = 'start',
  className = '',
}: VeitDialogDetailSectionTitleProps) {
  return (
    <p
      className={`${veitFieldLabelClass} ${align === 'center' ? 'w-full text-center' : ''} ${className}`.trim()}
    >
      {children}
    </p>
  );
}

/** @deprecated Prefer {@link VeitDialogDetailSectionTitle} */
export const DialogDetailSectionTitle = VeitDialogDetailSectionTitle;

export type VeitDialogToolbarButtonProps = {
  children: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children' | 'onClick'>;

export function VeitDialogToolbarButton({
  children,
  icon,
  onClick,
  disabled,
  className = '',
  ...rest
}: VeitDialogToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`btn-secondary btn-sm inline-flex items-center gap-1.5 ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/** @deprecated Prefer {@link VeitDialogToolbarButton} */
export const DialogToolbarButton = VeitDialogToolbarButton;

export type VeitDialogInsetScrollProps = {
  children: ReactNode;
  className?: string;
  maxHeightClass?: string;
};

export function VeitDialogInsetScroll({
  children,
  className = '',
  maxHeightClass = 'max-h-40',
}: VeitDialogInsetScrollProps) {
  return (
    <div
      className={`space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-border/50 bg-muted/5 p-2 ${maxHeightClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** @deprecated Prefer {@link VeitDialogInsetScroll} */
export const DialogInsetScroll = VeitDialogInsetScroll;

export type VeitDialogSoftPanelProps = {
  children: ReactNode;
  className?: string;
};

export function VeitDialogSoftPanel({ children, className = '' }: VeitDialogSoftPanelProps) {
  return (
    <div className={`rounded-lg border border-border/50 bg-muted/5 p-3 ${className}`.trim()}>
      {children}
    </div>
  );
}

/** @deprecated Prefer {@link VeitDialogSoftPanel} */
export const DialogSoftPanel = VeitDialogSoftPanel;

export type VeitDialogDashedCtaProps = {
  title: string;
  description?: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export function VeitDialogDashedCta({
  title,
  description,
  icon,
  onClick,
  disabled,
  ariaLabel,
}: VeitDialogDashedCtaProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel ?? title}
      className="flex w-full min-h-[44px] items-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-3 text-left transition hover:border-primary/35 hover:bg-muted/25 disabled:pointer-events-none disabled:opacity-50 touch-manipulation"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-primary ring-1 ring-border/40">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </button>
  );
}

/** @deprecated Prefer {@link VeitDialogDashedCta} */
export const DialogDashedCta = VeitDialogDashedCta;

export type VeitDialogStickyActionsProps = {
  leading?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function VeitDialogStickyActions({
  leading,
  children,
  className = '',
}: VeitDialogStickyActionsProps) {
  return (
    <div className={`border-t border-border/40 pt-4 ${className}`.trim()}>
      <div
        className={
          leading
            ? 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'
            : 'flex flex-col gap-2 sm:flex-row sm:justify-end'
        }
      >
        {leading ? <div className="flex shrink-0 items-start">{leading}</div> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">{children}</div>
      </div>
    </div>
  );
}

/** @deprecated Prefer {@link VeitDialogStickyActions} */
export const DialogStickyActions = VeitDialogStickyActions;

/** Screenreader-only label for icon delete buttons. */
export function VeitDeleteIconButtonLabel({ label }: { label: string }) {
  return <span className="sr-only">{label}</span>;
}

/** @deprecated Prefer {@link VeitDeleteIconButtonLabel} */
export const DeleteIconButtonLabel = VeitDeleteIconButtonLabel;
