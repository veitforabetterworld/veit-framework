/**
 * Strukturierte Adresssuche via Nominatim (OpenStreetMap).
 * Nutzungsbedingungen: https://operations.osmfoundation.org/policies/nominatim/
 * — max. 1 Anfrage/Sekunde, keine Massenautomatisierung.
 */

import type { AddressSuggestion } from './types.js';

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  hamlet?: string;
  suburb?: string;
  city_district?: string;
  country_code?: string;
};

type NominatimRow = {
  place_id: number;
  display_name: string;
  address?: NominatimAddress;
};

const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;
let throttleChain: Promise<void> = Promise.resolve();

function scheduleThrottle(): Promise<void> {
  throttleChain = throttleChain.then(async () => {
    const now = Date.now();
    const wait = MIN_INTERVAL_MS - (now - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  return throttleChain;
}

function formatSuggestionLabel(street: string, postalCode: string, city: string): string {
  const parts = [street, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join(', ');
}

export function parseNominatimAddressRow(row: NominatimRow): AddressSuggestion | null {
  const a = row.address;
  if (!a) return null;

  const road = a.road || a.pedestrian || a.footway || a.path;
  const houseNumber = a.house_number?.trim() ?? '';
  let street = '';
  if (road) {
    street = houseNumber ? `${road} ${houseNumber}` : road;
  } else {
    street = row.display_name.split(',')[0]?.trim() ?? '';
  }

  const city =
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.hamlet ||
    a.suburb ||
    a.city_district ||
    '';
  const postalCode = a.postcode?.trim() ?? '';
  const countryCode = (a.country_code ?? 'de').toUpperCase();

  if (!street.trim() && !city.trim()) return null;

  return {
    id: `addr-${row.place_id}`,
    label: formatSuggestionLabel(street, postalCode, city) || row.display_name,
    street,
    postalCode,
    city,
    countryCode,
  };
}

export async function searchAddressSuggestions(
  query: string,
  opts?: { countryCode?: string; limit?: number },
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  await scheduleThrottle();

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(Math.min(Math.max(opts?.limit ?? 8, 1), 10)));

  const cc = opts?.countryCode?.trim().toLowerCase();
  if (cc && cc.length === 2) {
    url.searchParams.set('countrycodes', cc);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'de',
    },
  });
  if (!res.ok) throw new Error(`Nominatim: HTTP ${res.status}`);

  const rows = (await res.json()) as NominatimRow[];
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const parsed = parseNominatimAddressRow(row);
    if (!parsed) continue;
    const key = `${parsed.street}|${parsed.postalCode}|${parsed.city}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }
  return out;
}
