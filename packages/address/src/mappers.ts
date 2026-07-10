import type { PostalAddress, PostalAddressWire } from './types.js';

export type PostalAddressWireInput = {
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  address_extra?: string | null;
};

export function postalAddressFromWire(
  w: Partial<PostalAddressWireInput> | null | undefined,
): PostalAddress {
  return {
    street: (w?.street ?? '').trim(),
    postalCode: (w?.postal_code ?? '').trim(),
    city: (w?.city ?? '').trim(),
    countryCode: normalizeCountryCode(w?.country_code),
    addressExtra: w?.address_extra?.trim() || null,
  };
}

export function postalAddressToWire(a: PostalAddress): PostalAddressWire {
  return {
    street: a.street.trim(),
    postal_code: a.postalCode.trim(),
    city: a.city.trim(),
    country_code: normalizeCountryCode(a.countryCode),
    address_extra: a.addressExtra?.trim() || null,
  };
}

export function normalizeCountryCode(raw: string | null | undefined): string {
  const cc = (raw ?? 'DE').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cc) ? cc : 'DE';
}
