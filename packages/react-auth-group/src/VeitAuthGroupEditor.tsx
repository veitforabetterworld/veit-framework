import { useMemo, useState, type ReactNode } from 'react';
import { UserPlus } from 'lucide-react';

import { VeitPersonPickerDialog, type VeitPersonPickerPersonRowLabels } from './VeitPersonPickerDialog.js';
import { VeitPersonRefRowList, type VeitPersonRefRowListLabels } from './VeitPersonRefRowList.js';
import { VeitPersonPickerToolbar } from './VeitPersonPickerToolbar.js';
import { VeitRoundIconButton } from './VeitRoundIconButton.js';
import type { VeitDeleteConfirmConfig } from '@veit/react-controls';
import type { VeitAuthGroupModeOption, VeitPersonRef } from './types.js';

export type VeitAuthGroupEditorLabels = {
  modeSelectAriaLabel: string;
  addMembers: string;
  removePersonAria: string;
  pickerTitle: string;
  pickerConfirm: string;
  pickerCancel: string;
  pickerClose: string;
  pickerSearch: string;
  pickerEmpty: string;
  pickerNoResults: string;
  /** Zeilen in Picker + explizite Liste (ohne `youLabel` im Picker nicht nötig, aber einheitlich übergeben). */
  personRow: VeitPersonRefRowListLabels;
  /** Bestätigung vor „Person aus expliziter Liste entfernen“; empfohlen für einheitliches UX. */
  removePersonConfirm?: VeitDeleteConfirmConfig;
};

export type VeitAuthGroupEditorProps = {
  modeOptions: VeitAuthGroupModeOption[];
  membershipMode: string;
  onMembershipModeChange: (mode: string) => void;
  explicitUserIds: number[];
  onExplicitUserIdsChange: (ids: number[]) => void;
  explicitPeople?: VeitPersonRef[];
  loadPickerCandidates: (query: string) => Promise<VeitPersonRef[]>;
  pickerExcludeUserIds?: ReadonlySet<number>;
  labels: VeitAuthGroupEditorLabels;
  disabled?: boolean;
  /** Für „Du“-Kennzeichnung in der expliziten Liste. */
  currentUserId?: number;
  className?: string;
  renderExplicitRow?: (props: { person: VeitPersonRef; onRemove: () => void }) => ReactNode;
};

export function VeitAuthGroupEditor({
  modeOptions,
  membershipMode,
  onMembershipModeChange,
  explicitUserIds,
  onExplicitUserIdsChange,
  explicitPeople = [],
  loadPickerCandidates,
  pickerExcludeUserIds,
  labels,
  disabled = false,
  currentUserId,
  className = '',
  renderExplicitRow,
}: VeitAuthGroupEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const byId = useMemo(() => new Map(explicitPeople.map((p) => [p.id, p])), [explicitPeople]);

  const showExplicit = membershipMode === 'explicit';

  const orderedPeople: VeitPersonRef[] = useMemo(
    () =>
      explicitUserIds.map((id) => {
        return (
          byId.get(id) ?? {
            id,
            displayName: null,
            labelHint: `#${id}`,
            profileImageSrc: null,
          }
        );
      }),
    [explicitUserIds, byId],
  );

  const excludePicker = useMemo(() => {
    const s = new Set(pickerExcludeUserIds ?? []);
    for (const id of explicitUserIds) s.add(id);
    return s;
  }, [pickerExcludeUserIds, explicitUserIds]);

  const pickerPersonRowLabels: VeitPersonPickerPersonRowLabels = {
    emptyNameLabel: labels.personRow.emptyNameLabel,
    closeAriaLabel: labels.personRow.closeAriaLabel,
    profilePreviewSuffix: labels.personRow.profilePreviewSuffix,
  };

  const addIds = (ids: number[]) => {
    if (disabled) return;
    const next = [...new Set([...explicitUserIds, ...ids])];
    onExplicitUserIdsChange(next);
  };

  const removeId = (id: number) => {
    if (disabled) return;
    onExplicitUserIdsChange(explicitUserIds.filter((x) => x !== id));
  };

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <VeitPersonPickerToolbar
        compact
        leading={
          <select
            className="input min-h-[44px] w-full"
            aria-label={labels.modeSelectAriaLabel}
            value={membershipMode}
            disabled={disabled}
            onChange={(e) => onMembershipModeChange(e.target.value)}
          >
            {modeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        }
        trailing={
          showExplicit ? (
            <VeitRoundIconButton
              disabled={disabled}
              aria-label={labels.addMembers}
              title={labels.addMembers}
              onClick={() => setPickerOpen(true)}
            >
              <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
            </VeitRoundIconButton>
          ) : null
        }
      />
      {showExplicit ? (
        renderExplicitRow ? (
          <ul className="space-y-1" role="list">
            {orderedPeople.map((person) => (
              <li key={person.id}>
                {renderExplicitRow({
                  person,
                  onRemove: () => removeId(person.id),
                })}
              </li>
            ))}
          </ul>
        ) : (
          <VeitPersonRefRowList
            people={orderedPeople}
            currentUserId={currentUserId}
            onRemove={(id) => removeId(id)}
            removePersonAria={labels.removePersonAria}
            removeConfirm={labels.removePersonConfirm}
            disabled={disabled}
            rowLabels={labels.personRow}
          />
        )
      ) : null}

      <VeitPersonPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={labels.pickerTitle}
        confirmLabel={labels.pickerConfirm}
        cancelLabel={labels.pickerCancel}
        closeAriaLabel={labels.pickerClose}
        searchPlaceholder={labels.pickerSearch}
        emptyMessage={labels.pickerEmpty}
        noResultsMessage={labels.pickerNoResults}
        mode="multi"
        excludeUserIds={excludePicker}
        loadCandidates={loadPickerCandidates}
        personRowLabels={pickerPersonRowLabels}
        onConfirm={(ids) => {
          addIds(ids);
        }}
      />
    </div>
  );
}
