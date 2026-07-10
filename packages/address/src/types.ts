export type PostalAddress = {
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
  addressExtra?: string | null;
};

export type PostalAddressWire = {
  street: string;
  postal_code: string;
  city: string;
  country_code: string;
  address_extra?: string | null;
};

export type AddressSuggestion = {
  id: string;
  label: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
};

export const EMPTY_POSTAL_ADDRESS: PostalAddress = {
  street: '',
  postalCode: '',
  city: '',
  countryCode: 'DE',
  addressExtra: null,
};
