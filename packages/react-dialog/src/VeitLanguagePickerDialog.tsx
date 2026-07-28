import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import {
  foldLanguageSearchText,
  uiLanguageAutonym,
  uiLanguageDisplayName,
} from '@veit/intl';
import {
  VeitOverlayActionDialog,
  useManagedOverlayDialogBinding,
} from './VeitDialogPresets.js';

export type VeitLanguagePickerDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Available BCP-47-like UI language codes. */
  locales: readonly string[];
  currentLocale: string;
  /** Called when the user picks a language (even if unchanged — host may no-op). */
  onSelect: (locale: string) => void | Promise<void>;
  title: string;
  closeLabel: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  noResultsLabel: string;
  /** Fallback when `locales` is empty. */
  fallbackLocales?: readonly string[];
};

/**
 * Language picker dialog — labels and locale list via props (no i18n context).
 */
export function VeitLanguagePickerDialog(props: VeitLanguagePickerDialogProps) {
  const {
    open,
    onClose,
    locales,
    currentLocale,
    onSelect,
    title,
    closeLabel,
    searchPlaceholder,
    searchAriaLabel,
    noResultsLabel,
    fallbackLocales = ['de', 'en'],
  } = props;
  const binding = useManagedOverlayDialogBinding(open, onClose);
  const [searchQuery, setSearchQuery] = useState('');

  const pick = async (lang: string) => {
    await onSelect(lang);
    onClose();
  };

  const options = useMemo(
    () => (locales.length > 0 ? [...locales] : [...fallbackLocales]),
    [locales, fallbackLocales],
  );
  const showSearch = options.length > 6;

  useEffect(() => {
    if (open) setSearchQuery('');
  }, [open]);

  const languageRows = useMemo(
    () =>
      options.map((lang) => ({
        lang,
        autonym: uiLanguageAutonym(lang),
        inUiLanguage: uiLanguageDisplayName(lang, currentLocale),
      })),
    [options, currentLocale],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim();
    if (!showSearch || q === '') return languageRows;
    const needle = foldLanguageSearchText(q);
    return languageRows.filter(({ lang, autonym, inUiLanguage }) => {
      if (foldLanguageSearchText(lang).includes(needle)) return true;
      if (foldLanguageSearchText(autonym).includes(needle)) return true;
      if (foldLanguageSearchText(inUiLanguage).includes(needle)) return true;
      return false;
    });
  }, [languageRows, searchQuery, showSearch]);

  return (
    <VeitOverlayActionDialog
      binding={binding}
      title={title}
      closeAriaLabel={closeLabel}
      backdropDismissLabel={closeLabel}
      variant="centered"
      size="sm"
      footerProps={{ dismissOnly: true, busy: false, cancelLabel: closeLabel }}
    >
      <div className="flex flex-col gap-2">
        {showSearch ? (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchAriaLabel}
              autoComplete="off"
              className="input w-full text-sm pl-9"
            />
          </div>
        ) : null}
        <div
          className={
            showSearch
              ? 'flex max-h-[min(50vh,22rem)] flex-col gap-2 overflow-y-auto pr-0.5'
              : 'flex flex-col gap-2'
          }
        >
          {filteredRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{noResultsLabel}</p>
          ) : (
            filteredRows.map(({ lang, autonym, inUiLanguage }) => {
              const selected = currentLocale === lang;
              const showSubtitle =
                inUiLanguage.trim().length > 0 &&
                autonym.trim().toLowerCase() !== inUiLanguage.trim().toLowerCase();
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => void pick(lang)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:bg-muted/50 ${
                    selected ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-surface-elevated/40'
                  }`.trim()}
                >
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <span className="text-sm font-medium leading-tight">{autonym}</span>
                    {showSubtitle ? (
                      <span
                        className={
                          selected
                            ? 'text-xs font-normal leading-tight text-primary/80'
                            : 'text-xs font-normal leading-tight text-muted-foreground'
                        }
                      >
                        {inUiLanguage}
                      </span>
                    ) : null}
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </VeitOverlayActionDialog>
  );
}
