/** Wie ein Dialog mit der Browser-History synchronisiert wird. */
export type VeitDialogHistoryMode = 'none' | 'overlay' | 'entity' | 'sheet';

export type VeitDialogHistoryModeInput =
  | VeitDialogHistoryMode
  | {
      /** @deprecated Use `historyMode: 'entity'` instead. */
      historyCoalesce?: boolean;
      /** @deprecated Use `historyMode: 'overlay'` instead. */
      historyNested?: boolean;
    };

export function resolveVeitDialogHistoryMode(input: {
  historyMode?: VeitDialogHistoryMode;
  historyCoalesce?: boolean;
  historyNested?: boolean;
}): VeitDialogHistoryMode {
  if (input.historyMode != null) {
    return input.historyMode;
  }
  if (input.historyCoalesce && !input.historyNested) {
    return 'entity';
  }
  if (input.historyNested) {
    return 'overlay';
  }
  return 'overlay';
}

export function veitDialogHistoryFlags(mode: VeitDialogHistoryMode): {
  historyCoalesce: boolean;
  historyNested: boolean;
  presentation: 'modal' | 'bottom';
  syncHistory: boolean;
} {
  switch (mode) {
    case 'none':
      return { historyCoalesce: false, historyNested: false, presentation: 'modal', syncHistory: false };
    case 'entity':
      return { historyCoalesce: true, historyNested: false, presentation: 'modal', syncHistory: true };
    case 'sheet':
      return { historyCoalesce: false, historyNested: true, presentation: 'bottom', syncHistory: true };
    case 'overlay':
    default:
      return { historyCoalesce: false, historyNested: true, presentation: 'modal', syncHistory: true };
  }
}
