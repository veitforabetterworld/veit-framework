import { useEffect, useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { VeitButton } from './VeitButton.js';
import { VeitPasswordField } from './VeitPasswordField.js';

/** Stands in for a stored secret that has not been fetched. */
const STORED_MASK = '••••••••••••••••';

export type VeitSecretFieldProps = {
  id?: string;
  /** The secret the user typed (or the known secret of a read-only field). Empty keeps a stored one. */
  value: string;
  /** Without it the field is read-only (e.g. an API key that is shown and copied, never typed). */
  onChange?: (value: string) => void;
  /** A secret is stored on the server; the field shows a mask until it is revealed. */
  stored?: boolean;
  /** Fetches the stored secret for the eye and the copy button. Without it a stored secret stays masked. */
  onReveal?: () => Promise<string>;
  onRevealError?: (error: unknown) => void;
  showLabel: string;
  hideLabel: string;
  /** With both labels the field gets a copy button. */
  copyLabel?: string;
  copiedLabel?: string;
  placeholder?: string;
  /** `new-password` by default, so password managers offer to save rather than fill. */
  autoComplete?: string;
  disabled?: boolean;
};

/**
 * A password input for secrets that may already be stored: API keys, SMTP passwords, provider keys. It shows a
 * mask for a stored secret, the eye fetches and shows it (`onReveal`), and an optional button copies it. Typing
 * replaces the secret; an empty value means "keep the stored one". Showing a stored secret is not a change.
 */
export function VeitSecretField({
  id,
  value,
  onChange,
  stored = false,
  onReveal,
  onRevealError,
  showLabel,
  hideLabel,
  copyLabel,
  copiedLabel,
  placeholder,
  autoComplete = 'new-password',
  disabled = false,
}: VeitSecretFieldProps) {
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const readOnly = !onChange;
  const canReveal = stored && Boolean(onReveal);
  const masked = stored && !value && revealed === null;

  // A newly stored secret starts hidden again; for another entity, give the field a new `key`.
  useEffect(() => {
    setRevealed(null);
    setVisible(false);
    setCopied(false);
  }, [stored]);

  const secret = async (): Promise<string | null> => {
    if (value) return value;
    if (revealed !== null) return revealed;
    if (!canReveal) return null;
    setLoading(true);
    try {
      const next = await onReveal!();
      setRevealed(next);
      return next;
    } catch (error) {
      onRevealError?.(error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const changeVisible = async (next: boolean) => {
    if (next && masked && !(await secret())) return;
    setVisible(next);
  };

  const copy = async () => {
    const text = await secret();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      onRevealError?.(error);
    }
  };

  const shown = value || revealed || (stored ? STORED_MASK : '');
  const canCopy = Boolean(copyLabel && copiedLabel) && (Boolean(value) || revealed !== null || canReveal);

  return (
    <div className="flex min-w-0 gap-2">
      <VeitPasswordField
        id={id}
        wrapperClassName="min-w-0 flex-1"
        value={shown}
        readOnly={readOnly}
        placeholder={masked ? undefined : placeholder}
        autoComplete={autoComplete}
        disabled={disabled || loading}
        visible={visible && !(masked && !loading)}
        onVisibleChange={(next) => void changeVisible(next)}
        showPasswordLabel={showLabel}
        hidePasswordLabel={hideLabel}
        onFocus={(e) => {
          if (readOnly) e.currentTarget.select();
        }}
        onChange={(e) => {
          if (!onChange) return;
          const next = e.target.value;
          // Typing into the mask starts a new secret instead of appending to the dots.
          onChange(masked && next.startsWith(STORED_MASK) ? next.slice(STORED_MASK.length) : next);
          if (revealed !== null) setRevealed(null);
        }}
      />
      {canCopy && (
        <VeitButton variant="secondary" className="shrink-0" disabled={disabled || loading} onClick={() => void copy()}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? copiedLabel : copyLabel}
        </VeitButton>
      )}
    </div>
  );
}
