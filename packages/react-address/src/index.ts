export {
  VeitAddressStreetAutocomplete,
  type AddressPick,
  type VeitAddressStreetAutocompleteLabels,
  type VeitAddressStreetAutocompleteProps,
} from './VeitAddressStreetAutocomplete.js';
export {
  VeitAddressFields,
  type VeitAddressFieldsLabels,
  type VeitAddressFieldsProps,
} from './VeitAddressFields.js';

/** Typen und Helfer aus '@veit/address': Web-Apps importieren sie über dieses Paket. */
export type { PostalAddress, PostalAddressWire, AddressSuggestion, PostalAddressWireInput } from '@veit/address';
export {
  EMPTY_POSTAL_ADDRESS,
  postalAddressFromWire,
  postalAddressToWire,
  normalizeCountryCode,
  formatAddressLines,
  parseNominatimAddressRow,
  searchAddressSuggestions,
} from '@veit/address';
