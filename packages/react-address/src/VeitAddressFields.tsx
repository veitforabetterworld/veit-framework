import type { PostalAddress } from '@veit/address';
import {
  VeitAddressStreetAutocomplete,
  type VeitAddressStreetAutocompleteLabels,
} from './VeitAddressStreetAutocomplete.js';

export type VeitAddressFieldsLabels = VeitAddressStreetAutocompleteLabels & {
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
  addressExtra?: string;
};

export type VeitAddressFieldsProps = {
  value: PostalAddress;
  onChange: (next: PostalAddress) => void;
  disabled?: boolean;
  showAddressExtra?: boolean;
  showOsmAttribution?: boolean;
  labels: VeitAddressFieldsLabels;
  layout?: 'fieldset' | 'grid';
  legend?: string;
  idPrefix?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
};

function fieldId(prefix: string | undefined, name: string): string | undefined {
  return prefix ? `${prefix}-${name}` : undefined;
}

export function VeitAddressFields({
  value,
  onChange,
  disabled = false,
  showAddressExtra = false,
  showOsmAttribution = false,
  labels,
  layout = 'grid',
  legend,
  idPrefix,
  className,
  inputClassName = 'input',
  labelClassName = 'label mb-1 block',
}: VeitAddressFieldsProps) {
  const patch = (partial: Partial<PostalAddress>) => onChange({ ...value, ...partial });

  const grid = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelClassName} htmlFor={fieldId(idPrefix, 'street')}>
          {labels.street}
        </label>
        <VeitAddressStreetAutocomplete
          id={fieldId(idPrefix, 'street')}
          value={value.street}
          disabled={disabled}
          countryCode={value.countryCode}
          showOsmAttribution={showOsmAttribution}
          inputClassName={inputClassName}
          labels={{
            loading: labels.loading,
            noResults: labels.noResults,
            osmAttribution: labels.osmAttribution,
          }}
          onChange={(street) => patch({ street })}
          onPick={(addr) =>
            patch({
              street: addr.street,
              postalCode: addr.postalCode,
              city: addr.city,
              countryCode: addr.countryCode,
            })
          }
        />
      </div>
      <div>
        <label className={labelClassName} htmlFor={fieldId(idPrefix, 'postal-code')}>
          {labels.postalCode}
        </label>
        <input
          id={fieldId(idPrefix, 'postal-code')}
          type="text"
          className={inputClassName}
          value={value.postalCode}
          disabled={disabled}
          autoComplete="postal-code"
          onChange={(e) => patch({ postalCode: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClassName} htmlFor={fieldId(idPrefix, 'city')}>
          {labels.city}
        </label>
        <input
          id={fieldId(idPrefix, 'city')}
          type="text"
          className={inputClassName}
          value={value.city}
          disabled={disabled}
          autoComplete="address-level2"
          onChange={(e) => patch({ city: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClassName} htmlFor={fieldId(idPrefix, 'country')}>
          {labels.countryCode}
        </label>
        <input
          id={fieldId(idPrefix, 'country')}
          type="text"
          maxLength={2}
          className={`${inputClassName} max-w-[8rem] uppercase font-mono`}
          value={value.countryCode}
          disabled={disabled}
          autoComplete="country"
          onChange={(e) => patch({ countryCode: e.target.value.toUpperCase().slice(0, 2) })}
        />
      </div>
      {showAddressExtra && labels.addressExtra ? (
        <div className="sm:col-span-2">
          <label className={labelClassName} htmlFor={fieldId(idPrefix, 'address-extra')}>
            {labels.addressExtra}
          </label>
          <input
            id={fieldId(idPrefix, 'address-extra')}
            type="text"
            className={inputClassName}
            value={value.addressExtra ?? ''}
            disabled={disabled}
            autoComplete="address-line2"
            onChange={(e) => patch({ addressExtra: e.target.value || null })}
          />
        </div>
      ) : null}
    </div>
  );

  if (layout === 'fieldset') {
    return (
      <fieldset className={`rounded-xl border border-border/60 p-3 ${className ?? ''}`.trim()}>
        {legend ? <legend className="px-1 text-sm font-medium">{legend}</legend> : null}
        <div className={legend ? 'mt-2' : ''}>{grid}</div>
      </fieldset>
    );
  }

  return <div className={className}>{grid}</div>;
}
