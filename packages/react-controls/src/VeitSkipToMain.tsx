/** Skip link for keyboard users: invisible until focused, then shown top left above the app shell. */
export function VeitSkipToMain({ label, targetId = 'main-content' }: { label: string; targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring focus:outline-none"
    >
      {label}
    </a>
  );
}
