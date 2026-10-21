import type { BasemapDefinition } from '@veit/map';
import { VeitButton } from '@veit/react-controls';

export type BasemapSwitcherProps = {
  basemaps: readonly BasemapDefinition[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name of the button group. */
  label?: string;
  /** Show the thumbnail of each basemap that has one. */
  showPreview?: boolean;
  className?: string;
};

/** Button group to pick the map background. The host keeps the value, so it can persist it. */
export function BasemapSwitcher({
  basemaps,
  value,
  onChange,
  label = 'Kartenhintergrund',
  showPreview = false,
  className = '',
}: BasemapSwitcherProps) {
  return (
    <div role="group" aria-label={label} className={`grid grid-cols-2 gap-2 ${className}`.trim()}>
      {basemaps.map((basemap) => (
        <VeitButton
          key={basemap.id}
          variant={basemap.id === value ? 'primary' : 'secondary'}
          aria-pressed={basemap.id === value}
          className="flex-col"
          onClick={() => onChange(basemap.id)}
        >
          {showPreview && basemap.preview ? (
            <img src={basemap.preview} alt="" loading="lazy" className="h-12 w-full rounded object-cover" />
          ) : null}
          {basemap.label}
        </VeitButton>
      ))}
    </div>
  );
}
