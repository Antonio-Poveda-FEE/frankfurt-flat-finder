import type { Flat, Poi, TravelMode } from './types'

const gmode: Record<TravelMode, string> = {
  walk: 'walking',
  bike: 'bicycling',
  transit: 'transit',
  drive: 'driving',
}

function originStr(flat: Pick<Flat, 'lat' | 'lng' | 'address'>): string {
  if (flat.lat != null && flat.lng != null) return `${flat.lat},${flat.lng}`
  return flat.address || ''
}

function destStr(poi: Pick<Poi, 'lat' | 'lng' | 'address' | 'label'>): string {
  if (poi.lat != null && poi.lng != null) return `${poi.lat},${poi.lng}`
  return poi.address || poi.label
}

/** Deep link to Google Maps directions for a given travel mode. */
export function directionsUrl(
  flat: Pick<Flat, 'lat' | 'lng' | 'address'>,
  poi: Pick<Poi, 'lat' | 'lng' | 'address' | 'label'>,
  mode: TravelMode
): string {
  const params = new URLSearchParams({
    api: '1',
    origin: originStr(flat),
    destination: destStr(poi),
    travelmode: gmode[mode],
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** "What's nearby" search centred on the flat (e.g. bars, parks). */
export function nearbyUrl(flat: Pick<Flat, 'lat' | 'lng' | 'address'>, query: string): string {
  const where = flat.lat != null && flat.lng != null ? `${flat.lat},${flat.lng}` : flat.address || ''
  const params = new URLSearchParams({ api: '1', query: `${query} cerca de ${where}` })
  return `https://www.google.com/maps/search/?${params.toString()}`
}

/** Open the flat's location on the map. */
export function placeUrl(flat: Pick<Flat, 'lat' | 'lng' | 'address'>): string {
  const params = new URLSearchParams({ api: '1', query: originStr(flat) })
  return `https://www.google.com/maps/search/?${params.toString()}`
}
