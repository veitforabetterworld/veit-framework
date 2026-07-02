import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Pencil, Plus } from 'lucide-react';
import {
  buildTagPickerOptions,
  tagColor,
  tagPickerOptionsById,
  type FieldDef,
  type FieldTag,
  type TagPickerOption,
} from '@veit/field-tags';
import { VeitDialog, VeitDialogEditActionsFooter } from '@veit/react-dialog';

import { VeitFieldTagBadge } from './VeitFieldTagBadge.js';
import type { VeitFieldTagPickerStrings } from './types.js';

export type VeitFieldTagPickerProps = {
  field: FieldDef;
  allTags: FieldTag[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  allowMultiple?: boolean;
  canManageTags?: boolean;
  strings: VeitFieldTagPickerStrings;
  onOpenTagManager?: () => void;
  renderTagManager?: React.ReactNode;
};

function filterOptions(options: TagPickerOption[], query: string): TagPickerOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.searchText.includes(q));
}

export function VeitFieldTagPicker({
  field,
  allTags,
  selectedIds,
  onChange,
  disabled,
  allowMultiple = true,
  canManageTags = false,
  strings,
  onOpenTagManager,
  renderTagManager,
}: VeitFieldTagPickerProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const allOptions = useMemo(() => buildTagPickerOptions([field], allTags), [field, allTags]);
  const optionsById = useMemo(() => tagPickerOptionsById(allOptions), [allOptions]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => filterOptions(allOptions, query), [allOptions, query]);

  const selectedOptions = useMemo(
    () => selectedIds.map((id) => optionsById.get(id)).filter((o): o is TagPickerOption => o != null),
    [selectedIds, optionsById],
  );

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setQuery('');
    setHighlight(0);
  }, []);

  const openDialog = useCallback(() => {
    if (disabled) return;
    setDialogOpen(true);
  }, [disabled]);

  useEffect(() => {
    if (!dialogOpen) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [dialogOpen]);

  useEffect(() => {
    setHighlight((i) => (filtered.length === 0 ? 0 : Math.min(i, filtered.length - 1)));
  }, [filtered.length, query]);

  const selectTag = useCallback(
    (id: number) => {
      if (selectedSet.has(id)) return;
      onChange(allowMultiple ? [...selectedIds, id] : [id]);
      closeDialog();
    },
    [allowMultiple, closeDialog, onChange, selectedIds, selectedSet],
  );

  const removeTag = useCallback(
    (id: number) => {
      onChange(selectedIds.filter((x) => x !== id));
    },
    [onChange, selectedIds],
  );

  const toggleTag = useCallback(
    (id: number) => {
      if (selectedSet.has(id)) removeTag(id);
      else selectTag(id);
    },
    [removeTag, selectTag, selectedSet],
  );

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => (filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) toggleTag(opt.id);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
    }
  };

  return (
    <>
      <div
        className={`input flex min-h-[44px] flex-wrap items-center gap-1.5 !py-1.5 ${disabled ? 'pointer-events-none opacity-70' : ''}`}
        aria-label={strings.tagSearchPlaceholder}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectedOptions.map((opt) => (
            <VeitFieldTagBadge
              key={opt.id}
              variant="field"
              name={opt.path}
              hex_color={opt.hex_color}
              onRemove={disabled ? undefined : () => removeTag(opt.id)}
              removeAriaLabel={`${strings.remove}: ${opt.path}`}
            />
          ))}
          {!disabled ? (
            <button
              type="button"
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              onClick={openDialog}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {selectedOptions.length === 0
                ? strings.tagSearchPlaceholder
                : allowMultiple
                  ? strings.tagSearchAdd
                  : strings.tagSearchChange}
            </button>
          ) : selectedOptions.length === 0 ? (
            <span className="px-1 text-sm text-muted-foreground">—</span>
          ) : null}
        </div>
      </div>

      {dialogOpen ? (
        <VeitDialog
          open
          onClose={closeDialog}
          title={strings.pickTitle}
          closeAriaLabel={strings.close}
          variant="responsive"
          size="sm"
          footer={({ dismiss }) => (
            <VeitDialogEditActionsFooter dismissOnly dismiss={dismiss} busy={false} cancelLabel={strings.close} />
          )}
        >
          <div className="space-y-3">
            {canManageTags && onOpenTagManager ? (
              <button
                type="button"
                className="btn-secondary inline-flex min-h-[40px] w-full items-center justify-center gap-2 text-sm"
                onClick={onOpenTagManager}
              >
                <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                {strings.tagEditButton}
              </button>
            ) : null}
            <input
              ref={inputRef}
              type="search"
              className="input"
              value={query}
              placeholder={strings.tagSearchPlaceholder}
              aria-label={strings.tagSearchPlaceholder}
              aria-controls={listboxId}
              aria-autocomplete="list"
              role="combobox"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
            />
            <ul
              id={listboxId}
              role="listbox"
              aria-multiselectable="true"
              className="max-h-72 space-y-0 overflow-y-auto rounded-input border border-input/85 bg-surface/90 py-1 shadow-sm"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {allOptions.length === 0
                    ? canManageTags
                      ? strings.tagPickerEmptyManage
                      : strings.tagPickerEmpty
                    : strings.tagNoResults}
                </li>
              ) : (
                filtered.map((opt, idx) => {
                  const selected = selectedSet.has(opt.id);
                  const active = idx === highlight;
                  return (
                    <li key={opt.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          active ? 'bg-muted' : 'hover:bg-muted/60'
                        }`}
                        style={{ paddingLeft: `${12 + opt.depth * 14}px` }}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => toggleTag(opt.id)}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tagColor({ hex_color: opt.hex_color }) }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                        {opt.depth > 0 ? (
                          <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground sm:inline">
                            {opt.path}
                          </span>
                        ) : null}
                        {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </VeitDialog>
      ) : null}

      {renderTagManager}
    </>
  );
}
