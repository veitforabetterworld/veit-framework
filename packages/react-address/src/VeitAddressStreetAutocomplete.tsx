import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { searchAddressSuggestions, type AddressSuggestion } from '@veit/address';

export type AddressPick = {
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
};

export type VeitAddressStreetAutocompleteLabels = {
  loading: string;
  noResults: string;
  osmAttribution: string;
};

export type VeitAddressStreetAutocompleteProps = {
  value: string;
  onChange: (street: string) => void;
  onPick: (address: AddressPick) => void;
  disabled?: boolean;
  countryCode?: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  id?: string;
  autoComplete?: string;
  showOsmAttribution?: boolean;
  labels: VeitAddressStreetAutocompleteLabels;
};

export function VeitAddressStreetAutocomplete({
  value,
  onChange,
  onPick,
  disabled = false,
  countryCode,
  className,
  inputClassName = 'input',
  placeholder,
  id,
  autoComplete = 'street-address',
  showOsmAttribution = true,
  labels,
}: VeitAddressStreetAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const skipSearchRef = useRef(false);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(value.trim()), 400);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    if (disabled || debouncedQuery.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void searchAddressSuggestions(debouncedQuery, { countryCode: countryCode || undefined })
      .then((rows) => {
        if (cancelled) return;
        setSuggestions(rows);
        setOpen(rows.length > 0);
        setActiveIndex(rows.length > 0 ? 0 : -1);
      })
      .catch(() => {
        if (cancelled) return;
        setSuggestions([]);
        setOpen(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, countryCode, disabled]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = useCallback(
    (s: AddressSuggestion) => {
      skipSearchRef.current = true;
      onPick({
        street: s.street,
        postalCode: s.postalCode,
        city: s.city,
        countryCode: s.countryCode,
      });
      setOpen(false);
      setSuggestions([]);
      setActiveIndex(-1);
    },
    [onPick],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const s = suggestions[activeIndex];
      if (s) pick(s);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showPanel = open && (loading || suggestions.length > 0 || debouncedQuery.length >= 3);

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <input
        id={id}
        type="text"
        className={inputClassName}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          if (e.target.value.trim().length >= 3) setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {showPanel ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-background py-1 text-sm shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-muted-foreground">{labels.loading}</li>
          ) : suggestions.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">{labels.noResults}</li>
          ) : (
            suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`cursor-pointer px-3 py-2 bg-background ${i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/80'}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pick(s)}
              >
                {s.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
      {showOsmAttribution ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{labels.osmAttribution}</p>
      ) : null}
    </div>
  );
}
