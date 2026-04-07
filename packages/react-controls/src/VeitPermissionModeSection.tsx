import * as React from 'react';

export type VeitPermissionModeOption<T extends string> = {
  value: T;
  label: string;
};

export type VeitPermissionModeSectionProps<T extends string> = {
  title: string;
  value: T;
  options: VeitPermissionModeOption<T>[];
  onChange?: (value: T) => void;
  disabled?: boolean;
  explicitValue?: T;
  renderExplicitContent?: () => React.ReactNode;
};

export function VeitPermissionModeSection<T extends string>(
  props: VeitPermissionModeSectionProps<T>,
): React.JSX.Element {
  const {
    title,
    value,
    options,
    onChange,
    disabled,
    explicitValue,
    renderExplicitContent,
  } = props;

  return (
    <section className="card space-y-3 text-sm">
      <label className="label block">{title}</label>
      <select
        className="input w-full"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {explicitValue !== undefined && value === explicitValue && renderExplicitContent
        ? renderExplicitContent()
        : null}
    </section>
  );
}
