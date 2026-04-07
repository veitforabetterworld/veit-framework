export function VeitSkipToMain({ label, targetId = 'main-content' }: { label: string; targetId?: string }) {
  return (
    <a href={`#${targetId}`} className="skip-to-main">
      {label}
    </a>
  );
}
