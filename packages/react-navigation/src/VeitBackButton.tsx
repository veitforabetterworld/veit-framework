import { ChevronLeft } from 'lucide-react';

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

/** Einheitliche Shell-Zurück-Taste — öffentliche API nur mit optionalem Text-Label. */
export function VeitBackButton({ label }: VeitBackButtonProps) {
  const { backAriaLabel, compact, goBack } = useVeitBackNavigationScope();
  const trimmed = label?.trim() ?? '';
  const hasLabel = trimmed.length > 0;
  const showLabel = hasLabel && !compact;

  const className = showLabel ? veitBackButtonWithLabelClass : veitBackButtonIconOnlyClass;

  return (
    <button
      type="button"
      onClick={goBack}
      className={className}
      title={backAriaLabel}
      {...(showLabel ? {} : { 'aria-label': backAriaLabel })}
    >
      <ChevronLeft className={veitBackNavIconClass} aria-hidden />
      {showLabel ? <span className={veitBackLabelInnerClass}>{trimmed}</span> : null}
    </button>
  );
}
