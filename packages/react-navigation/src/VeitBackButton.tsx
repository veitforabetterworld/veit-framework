import { VeitBackButton as VeitControlsBackButton } from '@veit/react-controls';

import { useVeitBackNavigationScope } from './VeitBackNavigationScope.js';

export type VeitBackButtonProps = {
  /** Optionaler Kurztext neben dem Zurück-Pfeil; ohne Text nur Icon. */
  label?: string;
};

/**
 * Einheitliche Shell-Zurück-Taste — öffentliche API nur mit optionalem Text-Label.
 * Rendert `VeitBackButton` aus `@veit/react-controls` in dessen Optik (nur Tokens aus `theme.css`);
 * Ziel und Label kommen aus dem Scope, lange Labels werden gekürzt.
 */
export function VeitBackButton({ label }: VeitBackButtonProps) {
  const { backAriaLabel, compact, goBack } = useVeitBackNavigationScope();
  const trimmed = label?.trim() ?? '';
  const showLabel = trimmed.length > 0 && !compact;

  return (
    <VeitControlsBackButton
      onBack={goBack}
      ariaLabel={backAriaLabel}
      label={showLabel ? trimmed : undefined}
      labelClassName="min-w-0 max-w-48 truncate text-sm"
    />
  );
}
