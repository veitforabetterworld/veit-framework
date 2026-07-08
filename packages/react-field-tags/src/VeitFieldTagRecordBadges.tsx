import type { ReactNode } from 'react';
import type { FieldTag } from '@veit/field-tags';
import { tagsForRecordDisplay, tagsForRecordDisplayByIds } from '@veit/field-tags';

import { VeitFieldTagBadge } from './VeitFieldTagBadge.js';

export type VeitFieldTagRecordBadgesProps = {
  /** Full tag catalog (nested tree) for resolving parents. */
  allTags: readonly FieldTag[];
  /** Stored tag IDs on the record (leaf selection). */
  tagIds?: readonly number[];
  /** Stored tag rows on the record (alternative to `tagIds`). */
  storedTags?: readonly FieldTag[];
  /** When set, only tags for this custom field column. */
  fieldId?: number;
  className?: string;
  badgeClassName?: string;
  empty?: ReactNode;
};

/**
 * Standard display for tags on records: stored selection plus ancestor badges
 * (e.g. „Werbung“ + „Plakatierung“ when „Werbung › Plakatierung“ is set).
 */
export function VeitFieldTagRecordBadges({
  allTags,
  tagIds,
  storedTags,
  fieldId,
  className = 'flex flex-wrap gap-1',
  badgeClassName,
  empty = null,
}: VeitFieldTagRecordBadgesProps) {
  const tags =
    storedTags != null
      ? tagsForRecordDisplay(storedTags, [...allTags], fieldId)
      : tagsForRecordDisplayByIds(tagIds ?? [], [...allTags], fieldId);

  if (tags.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className={className}>
      {tags.map((tag) => (
        <VeitFieldTagBadge
          key={tag.id}
          name={tag.name}
          hex_color={tag.hex_color}
          className={badgeClassName}
          title={tag.name}
        />
      ))}
    </div>
  );
}
