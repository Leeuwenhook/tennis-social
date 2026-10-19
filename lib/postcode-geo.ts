/**
 * UK postcode geocoding through postcodes.io (free, CORS-enabled), used by the
 * home map and the partner-request distance filter. Runs in the browser only.
 */

export type LatLng = { lat: number; lng: number };

const API = 'https://api.postcodes.io';
const CACHE_KEY = 'tm-postcode-geo-v1';
const FULL_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/;
const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/;

/** Canonical "SE1 7PB" / "SE1" form, or '' when the text holds no postcode. */
export function normalizePostcode(value: string) {
  const text = value.toUpperCase().replace(/\s+/g, ' ').trim();
  const full = FULL_POSTCODE.exec(text);
  if (full) return `${full[1]} ${full[2]}`;
  const compact = text.replace(/\s/g, '');
  return OUTCODE.test(compact) ? compact : '';
}

/**
 * First full postcode found in any of the fields (e.g. a venue's postcode, address
 * or area), falling back to the first field that is an outcode such as "SE1".
 */
export function findPostcode(...fields: string[]) {
  for (const field of fields) {
    const match = FULL_POSTCODE.exec(field.toUpperCase());
    if (match) return `${match[1]} ${match[2]}`;
  }
  for (const field of fields) {
    const outcode = normalizePostcode(field);
    if (outcode) return outcode;
  }
  return '';
}

export function milesBetween(a: LatLng, b: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

type Cache = Record<string, LatLng | null>;

function readCache(): Cache {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Cache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Private mode or full storage: lookups still work, just uncached.
  }
}

type PostcodeResult = { latitude: number | null; longitude: number | null } | null;

function toLatLng(result: PostcodeResult): LatLng | null {
  return result && result.latitude != null && result.longitude != null
    ? { lat: result.latitude, lng: result.longitude }
    : null;
}

/** Geocode full postcodes and outcodes; unknown ones map to null. */
export async function geocodePostcodes(values: string[]): Promise<Map<string, LatLng | null>> {
  const cache = readCache();
  const wanted = [...new Set(values.map(normalizePostcode).filter(Boolean))];
  const missing = wanted.filter((code) => !(code in cache));
  const full = missing.filter((code) => code.includes(' '));
  const outcodes = missing.filter((code) => !code.includes(' '));

  for (let index = 0; index < full.length; index += 100) {
    const batch = full.slice(index, index + 100);
    const response = await fetch(`${API}/postcodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postcodes: batch }),
    });
    if (!response.ok) throw new Error('postcode_lookup_failed');
    const body = (await response.json()) as { result: { query: string; result: PostcodeResult }[] };
    body.result.forEach((item, position) => {
      cache[batch[position]] = toLatLng(item.result);
    });
  }
  await Promise.all(
    outcodes.map(async (code) => {
      const response = await fetch(`${API}/outcodes/${encodeURIComponent(code)}`);
      if (response.status === 404) cache[code] = null;
      else if (response.ok) cache[code] = toLatLng(((await response.json()) as { result: PostcodeResult }).result);
      else throw new Error('postcode_lookup_failed');
    }),
  );

  if (missing.length) writeCache(cache);
  return new Map(wanted.map((code) => [code, cache[code] ?? null]));
}
