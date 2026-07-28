import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';

export type ChoiceButtonVariant = 'segment' | 'compact' | 'filled';
export type PickerChoiceRowVariant = 'row' | 'card' | 'plain' | 'grid';

type ChoiceButtonClassOptions = {
  variant?: ChoiceButtonVariant;
  extra?: string;
};

/** Einheitlicher Toggle-Button (segment = btn-primary/btn-secondary btn-sm). */
export function choiceButtonClass(
  active: boolean,
  options?: ChoiceButtonClassOptions,
): string {
  const variant = options?.variant ?? 'segment';
  const extra = options?.extra ?? '';

  if (variant === 'segment') {
    return `${active ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} ${extra}`.trim();
  }
  if (variant === 'compact') {
    return `flex-1 rounded-button border px-2 py-2 text-xs font-medium transition-colors ${
      active
        ? 'border-primary bg-primary/10 text-foreground'
        : 'border-border bg-surface/90 text-foreground hover:bg-muted/30'
    } ${extra}`.trim();
  }
  return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${extra} ${
    active
      ? 'bg-primary text-primary-foreground'
      : 'border border-border bg-muted/50 text-foreground hover:bg-muted'
  }`.trim();
}

type ChoiceButtonGroupProps = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  role?: 'tablist' | 'group';
};

export function ChoiceButtonGroup({
  children,
  className = '',
  ariaLabel,
  role = 'group',
}: ChoiceButtonGroupProps) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

type ChoiceButtonProps = {
  active: boolean;
  variant?: ChoiceButtonVariant;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className' | 'children'>;

export function ChoiceButton({
  active,
  variant = 'segment',
  children,
  className = '',
  ...rest
}: ChoiceButtonProps) {
  return (
    <button type="button" className={choiceButtonClass(active, { variant, extra: className })} {...rest}>
      {children}
    </button>
  );
}

export function pickerChoiceRowClass(
  selected: boolean,
  extra = '',
  variant: PickerChoiceRowVariant = 'row',
): string {
  const base =
    'flex w-full items-center gap-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

  if (variant === 'card') {
    return `${base} justify-between rounded-card border px-4 py-3 hover:bg-muted/50 ${
      selected
        ? 'border-primary/50 bg-primary/10 text-primary'
        : 'border-border/80 bg-surface/40 text-foreground hover:bg-muted/60'
    } ${extra}`.trim();
  }
  if (variant === 'plain') {
    return `${base} rounded-lg px-3 py-2 ${
      selected ? 'bg-muted/60' : 'hover:bg-muted'
    } ${extra}`.trim();
  }
  if (variant === 'grid') {
    return `${base} h-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted/10 p-2 text-center hover:bg-muted/40 ${
      selected ? 'border-primary/40 bg-primary/5' : ''
    } ${extra}`.trim();
  }
  return `${base} rounded-xl border px-3 py-2 hover:bg-muted/50 ${
    selected
      ? 'border-primary/40 bg-primary/5'
      : 'border-border/60 bg-surface/30 hover:bg-muted/40'
  } ${extra}`.trim();
}

type PickerChoiceRowProps = {
  selected: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: PickerChoiceRowVariant;
  showSelectedCheck?: boolean;
  onClick?: () => void;
  disabled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className' | 'children' | 'onClick'>;

export function PickerChoiceRow({
  selected,
  children,
  className = '',
  contentClassName = '',
  variant = 'row',
  showSelectedCheck = false,
  onClick,
  disabled,
  ...rest
}: PickerChoiceRowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={pickerChoiceRowClass(selected, className, variant)}
      {...rest}
    >
      <span className={`flex min-w-0 flex-1 items-center gap-2 ${contentClassName}`.trim()}>{children}</span>
      {showSelectedCheck && selected ? (
        <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      ) : null}
    </button>
  );
}

const WIZARD_CHOICE_TILE_BASE =
  'flex min-h-[72px] flex-col items-start gap-1 rounded-card border p-3 text-left text-sm transition disabled:opacity-50 touch-manipulation';

export function wizardChoiceTileClassFor(selected: boolean, extra = ''): string {
  return `${WIZARD_CHOICE_TILE_BASE} ${
    selected
      ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
      : 'border-border/60 bg-muted/10 hover:bg-muted/35'
  } ${extra}`.trim();
}

type WizardChoiceTileProps = {
  selected?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className' | 'children' | 'onClick'>;

export function WizardChoiceTile({
  selected = false,
  children,
  className = '',
  onClick,
  disabled,
  ...rest
}: WizardChoiceTileProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={wizardChoiceTileClassFor(selected, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

type SettingsActionRowProps = {
  icon?: ReactNode;
  label: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className' | 'children' | 'onClick'>;

/** Settings-Dialog-Trigger (Icon + Label + Wert rechts). */
export function SettingsActionRow({
  icon,
  label,
  trailing,
  onClick,
  disabled,
  className = '',
  ...rest
}: SettingsActionRowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full min-w-0 items-center gap-3 rounded-lg border border-border/60 bg-surface/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 ${className}`.trim()}
      {...rest}
    >
      {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{label}</span>
      {trailing ? <span className="shrink-0 text-xs text-muted-foreground">{trailing}</span> : null}
    </button>
  );
}

type InboxListItemProps = {
  unread?: boolean;
  children: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className' | 'children' | 'onClick'>;

/** Inbox-/Notification-Zeile mit Unread-Hervorhebung. */
export function InboxListItem({
  unread = false,
  children,
  actions,
  onClick,
  className = '',
  ...rest
}: InboxListItemProps) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
        unread ? 'border-primary/25 bg-primary/5' : 'border-border/60 bg-surface/30'
      } ${className}`.trim()}
    >
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
        {...rest}
      >
        {children}
      </button>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
