export type { PostalAddress, PostalAddressWire, AddressSuggestion } from './types.js';
export { EMPTY_POSTAL_ADDRESS } from './types.js';
export {
  postalAddressFromWire,
  postalAddressToWire,
  normalizeCountryCode,
  type PostalAddressWireInput,
} from './mappers.js';
export { formatAddressLines } from './formatAddressLines.js';
export {
  searchAddressSuggestions,
  parseNominatimAddressRow,
} from './addressSearch.js';
