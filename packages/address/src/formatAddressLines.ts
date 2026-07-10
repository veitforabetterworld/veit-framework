import { normalizeCountryCode } from './mappers.js';
import type { PostalAddress, PostalAddressWire } from './types.js';

type AddressLike = PostalAddress | PostalAddressWire | {
  street?: string;
  postalCode?: string;
  postal_code?: string;
  city?: string;
  countryCode?: string;
  country_code?: string;
  country?: string;
};

function readFields(addr: AddressLike): { street: string; postal: string; city: string; country: string } {
  const street = ('street' in addr ? addr.street : '') ?? '';
  const postal =
    ('postalCode' in addr ? addr.postalCode : undefined) ??
    ('postal_code' in addr ? addr.postal_code : undefined) ??
    '';
  const city = ('city' in addr ? addr.city : '') ?? '';
  const countryRaw =
    ('countryCode' in addr ? addr.countryCode : undefined) ??
    ('country_code' in addr ? addr.country_code : undefined) ??
    ('country' in addr ? addr.country : undefined) ??
    'DE';
  return {
    street: street.trim(),
    postal: postal.trim(),
    city: city.trim(),
    country: normalizeCountryCode(countryRaw),
  };
}

export function formatAddressLines(
  addr: AddressLike,
  opts?: { includeCountry?: boolean; omitDefaultCountry?: string },
): string[] {
  const { street, postal, city, country } = readFields(addr);
  const line2 = [postal, city].filter(Boolean).join(' ');
  const lines = [street, line2].filter((s) => s.length > 0);
  const includeCountry = opts?.includeCountry ?? true;
  const omitDefault = (opts?.omitDefaultCountry ?? '').trim().toUpperCase();
  if (includeCountry && country && country !== omitDefault) {
    lines.push(country);
  }
  return lines;
}
