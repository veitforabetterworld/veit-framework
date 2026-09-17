import { VeitDeleteButton, type VeitDeleteButtonProps } from './VeitDeleteButton.js';
import { VEIT_DELETE_ICON_BUTTON_CLASS, VeitDeleteIconButtonLabel } from './VeitFormPrimitives.js';

export type VeitDeleteIconButtonProps = Omit<VeitDeleteButtonProps, 'children' | 'icon'> & {
  /** `aria-label`, `title`, and screenreader text. */
  label: string;
};

/**
 * Icon-only delete button with unified styling ({@link VEIT_DELETE_ICON_BUTTON_CLASS}).
 * Prefer this over manual `VeitDeleteButton` + className + label boilerplate.
 */
export function VeitDeleteIconButton({
  label,
  className = '',
  deleteConfirm,
  onClick,
  disabled,
  ...rest
}: VeitDeleteIconButtonProps) {
  const mergedClass = `${VEIT_DELETE_ICON_BUTTON_CLASS} ${className}`.trim();
  return (
    <VeitDeleteButton
      className={mergedClass}
      deleteConfirm={deleteConfirm}
      disabled={disabled}
      aria-label={rest['aria-label'] ?? label}
      title={rest.title ?? label}
      onClick={onClick}
      {...rest}
    >
      <VeitDeleteIconButtonLabel label={label} />
    </VeitDeleteButton>
  );
}
