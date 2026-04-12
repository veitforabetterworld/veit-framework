import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { VeitDeleteButton, VeitPersonListRowProfile, type VeitDeleteConfirmConfig } from '@veit/react-controls';

import type { VeitPersonRef } from './types.js';

export type VeitPersonRefRowListLabels = {
  emptyNameLabel: string;
  closeAriaLabel: string;
  profilePreviewSuffix: string;
  youLabel: string;
};

export type VeitPersonRefRowListProps = {
  people: VeitPersonRef[];
  currentUserId?: number;
  onRemove?: (id: number) => void;
  removePersonAria?: string;
  /** Einheitlicher Bestätigungsdialog vor dem Entfernen (z. B. aus {@link VeitAuthGroupEditorLabels}). */
  removeConfirm?: VeitDeleteConfirmConfig;
  /** Wenn `true`, kein Entfernen-Button für diese Person (z. B. aktueller Nutzer). */
  removeHidden?: (id: number) => boolean;
  disabled?: boolean;
  rowLabels: VeitPersonRefRowListLabels;
  emptyText?: ReactNode;
  className?: string;
};

/**
 * Mitglieder-/Personenliste: gleiche Zeile wie Picker & Berechtigungsgruppen ({@link VeitPersonListRowProfile}).
 */
export function VeitPersonRefRowList({
  people,
  currentUserId,
  onRemove,
  removePersonAria = '',
  removeConfirm,
  removeHidden,
  disabled = false,
  rowLabels,
  emptyText,
  className = '',
}: VeitPersonRefRowListProps) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <ul className="space-y-1" role="list">
        {people.map((p) => (
          <li
            key={p.id}
            className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2"
          >
            <VeitPersonListRowProfile
              className="min-w-0 flex-1"
              displayName={p.displayName}
              profileImageSrc={p.profileImageSrc ?? null}
              emptyNameLabel={rowLabels.emptyNameLabel}
              isCurrentUser={currentUserId != null && p.id === currentUserId}
              youLabel={rowLabels.youLabel}
              labelHint={p.labelHint}
              subline={p.subline != null && p.subline !== '' ? p.subline : undefined}
              size="sm"
              nameClassName="text-sm"
              profilePreviewSuffix={rowLabels.profilePreviewSuffix}
              closeAriaLabel={rowLabels.closeAriaLabel}
            />
            {onRemove && !removeHidden?.(p.id) ? (
              <VeitDeleteButton
                deleteConfirm={removeConfirm}
                disabled={disabled}
                aria-label={removePersonAria || undefined}
                title={removePersonAria || undefined}
                onClick={() => onRemove(p.id)}
                icon={<Trash2 className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />}
                className="!h-10 !min-h-10 !w-10 !min-w-10 shrink-0 !gap-0 !px-0 !py-0 rounded-xl shadow-sm disabled:pointer-events-none disabled:opacity-40"
              >
                {removePersonAria ? <span className="sr-only">{removePersonAria}</span> : null}
              </VeitDeleteButton>
            ) : null}
          </li>
        ))}
      </ul>
      {people.length === 0 && emptyText != null && emptyText !== '' ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : null}
    </div>
  );
}
