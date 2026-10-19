export type VeitLogProps = {
  text: string;
  className?: string;
};

/** Vorformatierter Lauf-Text, zum Beispiel eine Job-Ausgabe. */
export function VeitLog({ text, className = '' }: VeitLogProps) {
  return (
    <pre className={`max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs text-foreground ${className}`.trim()}>
      {text}
    </pre>
  );
}
