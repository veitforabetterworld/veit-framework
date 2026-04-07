import { VeitDialog, useVeitDialogDismiss } from './VeitDialog.js';

export type VeitOptionPickerItem<T extends string | number = number> = {
  value: T;
  label: string;
  swatchColor?: string | null;
};

export type VeitOptionPickerDialogProps<T extends string | number = number> = {
  open: boolean;
  onClose: () => void;
  title: string;
  items: VeitOptionPickerItem<T>[];
  showSwatch: boolean;
  swatchShape?: 'circle' | 'rounded';
  value: T | null;
  onSelect: (value: T | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  zIndexBase?: number;
  backdropDismissLabel: string;
};

function swatchClass(shape: 'circle' | 'rounded', filled: boolean): string {
  const base = 'h-6 w-6 shrink-0 border border-border';
  const shapeCls = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  return `${base} ${shapeCls} ${filled ? '' : 'bg-transparent'}`;
}

function VeitOptionPickerList<T extends string | number = number>({
  items,
  showSwatch,
  swatchShape,
  value,
  onSelect,
  allowNone,
  noneLabel,
  disabled,
}: Pick<
  VeitOptionPickerDialogProps<T>,
  'items' | 'showSwatch' | 'value' | 'onSelect' | 'allowNone' | 'noneLabel' | 'disabled'
> & { swatchShape: 'circle' | 'rounded' }) {
  const dismiss = useVeitDialogDismiss();
  const rowBtn = 'flex w-full min-h-[44px] touch-manipulation items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted';
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {allowNone && (
        <button
          type="button"
          disabled={disabled}
          className={`${rowBtn} ${value === null ? 'bg-muted/60' : ''}`}
          onClick={() => {
            onSelect(null);
            dismiss();
          }}
        >
          {showSwatch && <span className={swatchClass(swatchShape, false)} aria-hidden />}
          <span className="truncate">{noneLabel}</span>
        </button>
      )}
      {items.map((item) => {
        const selected = value !== null && item.value === value;
        const color = item.swatchColor;
        const hasFill = showSwatch && color != null && color !== '';
        return (
          <button
            key={String(item.value)}
            type="button"
            disabled={disabled}
            className={`${rowBtn} ${selected ? 'bg-muted/60' : ''}`}
            onClick={() => {
              onSelect(item.value);
              dismiss();
            }}
          >
            {showSwatch && (
              <span
                className={swatchClass(swatchShape, hasFill)}
                style={hasFill ? { backgroundColor: color as string } : undefined}
                aria-hidden
              />
            )}
            <span className="min-w-0 truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function VeitOptionPickerDialog<T extends string | number = number>({
  open,
  onClose,
  title,
  items,
  showSwatch,
  swatchShape = 'circle',
  value,
  onSelect,
  allowNone = false,
  noneLabel = '—',
  disabled,
  zIndexBase = 200,
  backdropDismissLabel,
}: VeitOptionPickerDialogProps<T>) {
  return (
    <VeitDialog
      open={open}
      onClose={onClose}
      title={title}
      titleClassName="text-xs font-medium text-muted-foreground"
      closeAriaLabel={backdropDismissLabel}
      zIndexBase={zIndexBase}
      disabled={disabled}
      variant="centered"
      size="sm"
      className="!max-w-[min(320px,90vw)] max-h-[min(60vh,28rem)]"
      backdropBlur={false}
      backdropClassName="bg-black/40"
      headerClassName="px-3 py-2.5 sm:px-3"
      bodyClassName="!px-0 !py-1 sm:!px-0 sm:!py-1"
    >
      <VeitOptionPickerList
        items={items}
        showSwatch={showSwatch}
        swatchShape={swatchShape}
        value={value}
        onSelect={onSelect}
        allowNone={allowNone}
        noneLabel={noneLabel}
        disabled={disabled}
      />
    </VeitDialog>
  );
}
