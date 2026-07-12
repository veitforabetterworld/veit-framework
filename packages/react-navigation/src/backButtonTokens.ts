/** Gemeinsame Tailwind-Tokens für Shell-Zurück-Navigation. */
export const veitBackNavLinkShellClass =
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-outline-variant/35 bg-surface/70 text-on-surface-variant shadow-level-1 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-surface-container-low hover:text-on-surface dark:hover:bg-surface-container sm:h-10 font-headline text-label-sm';

export const veitBackNavIconClass = 'h-[1.125rem] w-[1.125rem] shrink-0 sm:h-5 sm:w-5';

export const veitBackButtonWithLabelClass = `${veitBackNavLinkShellClass} min-h-9 max-w-[min(30vw,9rem)] px-2 py-1 sm:min-h-10 sm:max-w-[min(34vw,12rem)] md:max-w-[min(30vw,16rem)] touch-manipulation disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;

export const veitBackButtonIconOnlyClass = `${veitBackNavLinkShellClass} !px-0 h-9 w-9 min-h-9 min-w-9 touch-manipulation disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;

export const veitBackLabelInnerClass =
  'min-w-0 flex-1 truncate text-left font-headline text-label-sm text-on-surface';
