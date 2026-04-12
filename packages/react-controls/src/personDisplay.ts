/**
 * Erster Buchstabe für Avatar-Platzhalter (kein E-Mail-Bezug).
 * Optional `labelOverride` (z. B. „Du“), wenn kein Anzeigename gesetzt ist.
 */
export function veitPersonAvatarInitial(
  displayName: string | null | undefined,
  labelOverride?: string | null,
): string {
  const d = displayName?.trim() ?? '';
  if (d.length > 0) return d.charAt(0).toUpperCase();
  const o = typeof labelOverride === 'string' ? labelOverride.trim() : '';
  if (o.length > 0) return o.charAt(0).toUpperCase();
  return '?';
}
