import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { VeitSpinner } from './VeitSpinner.js';

export type VeitComboboxProps<T> = {
  query: string;
  onQueryChange: (value: string) => void;
  items: readonly T[];
  getId: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  placeholder?: string;
  ariaLabel: string;
  emptyLabel?: string;
  className?: string;
  minQueryLength?: number;
};

/** Kopfzeilen-Suche. Der Host lädt die Treffer und zeichnet die Zeile. */
export function VeitCombobox<T>({
  query,
  onQueryChange,
  items,
  getId,
  renderItem,
  onSelect,
  open,
  onOpenChange,
  loading = false,
  placeholder,
  ariaLabel,
  emptyLabel = 'Keine Treffer',
  className = '',
  minQueryLength = 2,
}: VeitComboboxProps<T>) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const showList = open && query.trim().length >= minQueryLength;

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [onOpenChange]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList || items.length === 0) {
      if (event.key === 'Escape') onOpenChange(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) onSelect(item);
    } else if (event.key === 'Escape') {
      onOpenChange(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`.trim()}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        className="input py-2 pl-9 pr-8"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        onChange={(event) => {
          onQueryChange(event.target.value);
          onOpenChange(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (query.trim().length >= minQueryLength) onOpenChange(true);
        }}
        onKeyDown={onKeyDown}
      />
      {loading ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <VeitSpinner size="sm" />
        </span>
      ) : null}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-card p-1 text-foreground shadow-lg"
        >
          {items.length === 0 && !loading ? (
            <li className="px-3 py-2 text-sm text-muted-foreground" role="option">
              {emptyLabel}
            </li>
          ) : null}
          {items.map((item, index) => (
            <li key={getId(item)}>
              <button
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  activeIndex === index ? 'bg-muted' : 'hover:bg-muted'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelect(item)}
              >
                {renderItem(item)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
