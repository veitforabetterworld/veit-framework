import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export const VEIT_SETTINGS_ACTIONS = 'settings-actions';
export const VEIT_SETTINGS_ACTIONS_ROW = 'settings-actions-row';
export const VEIT_SETTINGS_ACTIONS_STACK = 'settings-actions-stack';
export const VEIT_SETTINGS_ACTIONS_ITEM = 'settings-actions-item';

export type VeitSettingsSectionProps = {
  id?: string;
  title?: ReactNode;
  icon?: LucideIcon;
  description?: ReactNode;
  actions?: ReactNode;
  variant?: 'default' | 'info';
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  'aria-labelledby'?: string;
};

export function VeitSettingsSection({
  id,
  title,
  icon: Icon,
  description,
  actions,
  variant = 'default',
  className = '',
  bodyClassName = '',
  children,
  'aria-labelledby': labelledBy,
}: VeitSettingsSectionProps) {
  const headingId = id ?? labelledBy;
  const cardClass = variant === 'info' ? 'card border-primary/30 bg-primary/5' : 'card';

  return (
    <section id={id} aria-labelledby={labelledBy ?? headingId} className={`${cardClass} ${className}`.trim()}>
      {title != null ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="settings-section-title m-0">
              {Icon ? <Icon className="settings-section-icon" aria-hidden /> : null}
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1">{actions}</div> : null}
        </div>
      ) : null}
      <div className={`settings-section-body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}

export type VeitSettingsSubsectionProps = {
  title?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function VeitSettingsSubsection({ title, hint, className = '', children }: VeitSettingsSubsectionProps) {
  return (
    <div className={`settings-subsection ${className}`.trim()}>
      {title != null ? (
        <div>
          <h3 className="label mb-0">{title}</h3>
          {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export type VeitSettingsPageGroupProps = {
  id?: string;
  title: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Page-level grouping outside cards (e.g. admin dashboard tile groups). */
export function VeitSettingsPageGroup({
  id,
  title,
  icon: Icon,
  actions,
  className = '',
  children,
}: VeitSettingsPageGroupProps) {
  return (
    <section id={id} className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id ? `${id}-heading` : undefined} className="settings-page-group m-0">
          {Icon ? <Icon className="settings-section-icon" aria-hidden /> : null}
          {title}
        </h2>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
