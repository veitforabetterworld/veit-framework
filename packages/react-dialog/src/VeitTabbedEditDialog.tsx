import type { ReactNode } from 'react';
import { VeitOverlayEditDialog, type VeitEditDialogFooterProps } from './VeitDialogPresets.js';
import type { DialogFormBaselineBinding } from './dialogFormDirty.js';
import type { ManagedOverlayDialogBinding } from './managedOverlayDialog.js';
export type VeitTabbedEditDialogTab<TTab extends string = string> = {
  id: TTab;
  label: string;
};

export type VeitTabbedOverlayEditDialogProps<TTab extends string = string> = {
  binding: ManagedOverlayDialogBinding;
  title: string;
  closeAriaLabel: string;
  cancelLabel: string;
  saveLabel: string;
  onSave: () => void | Promise<void>;
  dirty: boolean;
  formBaseline: DialogFormBaselineBinding;
  saving?: boolean;  busy?: boolean;
  localError?: string | null;
  tabs?: VeitTabbedEditDialogTab<TTab>[];
  tabsAriaLabel?: string;
  activeTab?: TTab;
  onTabChange?: (tab: TTab) => void;
  children: ReactNode;
};

/** Overlay-Edit-Dialog mit optionalen Tabs und Fehlerbanner (z. B. Tool-Zugriff). */
export function VeitTabbedOverlayEditDialog<TTab extends string = string>({
  binding,
  title,
  closeAriaLabel,
  cancelLabel,
  saveLabel,
  onSave,
  dirty,
  formBaseline,
  saving = false,  busy = false,
  localError,
  tabs,
  tabsAriaLabel,
  activeTab,
  onTabChange,
  children,
}: VeitTabbedOverlayEditDialogProps<TTab>) {
  const locked = saving || busy;
  const footerProps: VeitEditDialogFooterProps = {
    busy: locked,
    dirty,
    formBaseline,
    cancelLabel,
    saveLabel,
    onSave: () => void onSave(),
  };
  return (
    <VeitOverlayEditDialog
      binding={binding}
      title={title}
      titleClassName="heading-2 pr-2"
      closeAriaLabel={closeAriaLabel}
      variant="responsive"
      size="sm"
      className="max-h-[92vh] sm:max-h-[90vh]"
      backdropBlur={false}
      backdropClassName="bg-black/45"
      disabled={locked}
      blockBackdropClose={locked}
      footerProps={footerProps}
    >
      <div className="space-y-4">
        {localError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {localError}
          </p>
        ) : null}
        {tabs != null && tabs.length > 0 && activeTab != null && onTabChange != null ? (
          <div role="tablist" aria-label={tabsAriaLabel} className="flex flex-wrap gap-0.5 border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'border border-b-0 border-border bg-card text-foreground'
                    : 'border border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
        <div role={tabs != null ? 'tabpanel' : undefined} className={tabs != null ? 'pt-1' : undefined}>
          {children}
        </div>
      </div>
    </VeitOverlayEditDialog>
  );
}
