import { ChevronLeft } from 'lucide-react';
import { VeitBackButton as VeitControlsBackButton } from '@veit/react-controls';

import {
  veitBackButtonIconOnlyClass,
  veitBackButtonWithLabelClass,
  veitBackLabelInnerClass,
  veitBackNavIconClass,
} from './backButtonTokens.js';
import { useVeitBackNavigationScope } from './VeitBackNavigationScope.js';

export type VeitBackButtonProps = {
  /** Optionaler Kurztext neben dem Zurück-Pfeil; ohne Text nur Icon. */
  label?: string;
};

/**
 * Einheitliche Shell-Zurück-Taste — öffentliche API nur mit optionalem Text-Label.
 * Rendert `VeitBackButton` aus `@veit/react-controls` mit den Shell-Tokens; Ziel und Label kommen aus dem Scope.
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
      labelClassName={veitBackLabelInnerClass}
      icon={<ChevronLeft className={veitBackNavIconClass} aria-hidden />}
      className={showLabel ? veitBackButtonWithLabelClass : veitBackButtonIconOnlyClass}
    />
  );
}
