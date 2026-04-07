import React from 'react';
import { VeitDeleteButton } from './VeitDeleteButton.js';
import { VeitPersonListRow } from './VeitPersonListRow.js';

type AccessMember = {
  id: number;
  name: string | null;
  avatar?: React.ReactNode;
  avatarSrc?: string | null;
  subline?: React.ReactNode;
  isAdmin?: boolean;
};

export function VeitAccessMembersSection({
  title,
  mode,
  allLabel,
  explicitLabel,
  onModeChange,
  members,
  onAdd,
  onRemove,
  addLabel = '+',
  removeLabel = 'Remove',
  adminLabel = 'Admin',
  memberLabel = 'Members',
  emptyLabel = 'No entries',
  emptyLabelAll,
  emptyLabelExplicit,
  disabled = false,
  onToggleAdmin,
  adminToggleOnLabel = 'Admin',
  adminToggleOffLabel = 'Member',
  alwaysIncludeAdminMember,
  missingNameLabel,
  hideModeSelect = false,
}: {
  title: string;
  mode: 'all' | 'explicit';
  allLabel: string;
  explicitLabel: string;
  onModeChange: (mode: 'all' | 'explicit') => void;
  members: AccessMember[];
  onAdd?: () => void;
  onRemove?: (memberId: number) => void;
  addLabel?: string;
  removeLabel?: string;
  adminLabel?: string;
  memberLabel?: string;
  emptyLabel?: string;
  emptyLabelAll?: string;
  emptyLabelExplicit?: string;
  disabled?: boolean;
  onToggleAdmin?: (memberId: number, nextIsAdmin: boolean) => void;
  adminToggleOnLabel?: string;
  adminToggleOffLabel?: string;
  alwaysIncludeAdminMember?: { id: number; name: string | null; avatar?: React.ReactNode } | null;
  missingNameLabel?: string;
  hideModeSelect?: boolean;
}) {
  const effectiveMembers = React.useMemo(() => {
    if (!alwaysIncludeAdminMember) return members;
    const idx = members.findIndex((m) => m.id === alwaysIncludeAdminMember.id);
    if (idx >= 0) {
      const next = [...members];
      next[idx] = { ...next[idx], isAdmin: true };
      return next;
    }
    return [{ ...alwaysIncludeAdminMember, isAdmin: true }, ...members];
  }, [members, alwaysIncludeAdminMember]);
  const listTitle = mode === 'all' ? adminLabel : memberLabel;
  const effectiveEmptyLabel =
    mode === 'all' ? (emptyLabelAll ?? emptyLabel) : (emptyLabelExplicit ?? emptyLabel);
  return (
    <section className="card space-y-3">
      <h3 className="heading-2">{title}</h3>
      {!hideModeSelect ? (
        <select
          className="input w-full"
          value={mode}
          disabled={disabled}
          onChange={(e) => onModeChange(e.target.value === 'all' ? 'all' : 'explicit')}
        >
          <option value="all">{allLabel}</option>
          <option value="explicit">{explicitLabel}</option>
        </select>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{listTitle}</p>
        {onAdd ? (
          <button
            type="button"
            className="inline-flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border/80 bg-background text-base"
            onClick={onAdd}
            disabled={disabled}
            aria-label={addLabel}
            title={addLabel}
          >
            +
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {effectiveMembers.length === 0 ? <li className="text-sm text-muted-foreground">{effectiveEmptyLabel}</li> : null}
        {effectiveMembers.map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              {m.avatar ? (
                m.avatar
              ) : (
                <VeitPersonListRow
                  label={(m.name && m.name.trim()) || missingNameLabel || `#${m.id}`}
                  src={m.avatarSrc ?? null}
                  initial={((m.name && m.name.trim()) || missingNameLabel || `${m.id}`).trim().charAt(0).toUpperCase() || '#'}
                  size="sm"
                  className="min-w-0 flex-1"
                  nameClassName="text-sm"
                  subline={m.subline}
                  previewAriaLabel="Preview profile image"
                  closeAriaLabel="Close profile image preview"
                />
              )}
            </div>
            {onRemove ? (
              <div className="flex items-center gap-2">
                {m.isAdmin ? (
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs text-amber-700"
                    aria-label={onToggleAdmin ? adminToggleOffLabel : adminLabel}
                    title={onToggleAdmin ? adminToggleOffLabel : adminLabel}
                    onClick={onToggleAdmin ? () => onToggleAdmin(m.id, false) : undefined}
                    disabled={disabled || !onToggleAdmin}
                  >
                    🛡
                  </button>
                ) : onToggleAdmin ? (
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 text-xs"
                    onClick={onToggleAdmin ? () => onToggleAdmin(m.id, true) : undefined}
                    disabled={disabled}
                    aria-label={adminToggleOnLabel}
                    title={adminToggleOnLabel}
                  >
                    🛡
                  </button>
                ) : null}
                <VeitDeleteButton
                  className="!min-h-[2rem] !h-8 !w-8 !min-w-[2rem] !p-0"
                  icon={<span aria-hidden>🗑</span>}
                  onClick={() => onRemove(m.id)}
                  disabled={disabled}
                  aria-label={removeLabel}
                  title={removeLabel}
                >
                  <span className="sr-only">{removeLabel}</span>
                </VeitDeleteButton>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
