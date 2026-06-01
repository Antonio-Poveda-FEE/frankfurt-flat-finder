/// <reference types="google.maps" />
import type { TravelMode } from './types'

export interface LatLng { lat: number; lng: number }

/** Maps our app travel mode → Google Maps TravelMode (runtime enum). */
export function gMode(mode: TravelMode): google.maps.TravelMode {
  switch (mode) {
    case 'walk': return google.maps.TravelMode.WALKING
    case 'bike': return google.maps.TravelMode.BICYCLING
    case 'transit': return google.maps.TravelMode.TRANSIT
    default: return google.maps.TravelMode.DRIVING
  }
}

/** Address → coordinates using the Geocoding library. Returns null on failure. */
export async function geocodeAddress(
  geocoder: google.maps.Geocoder,
  address: string
): Promise<LatLng | null> {
  try {
    const { results } = await geocoder.geocode({ address })
    const loc = results?.[0]?.geometry?.location
    return loc ? { lat: loc.lat(), lng: loc.lng() } : null
  } catch {
    return null
  }
}

export interface TravelResult { minutes: number; meters: number }

/**
 * One Distance Matrix call: travel time/distance from a single origin to many
 * destinations. Returns an array aligned with `destinations` (null where N/A).
 */
export function distanceMatrix(
  service: google.maps.DistanceMatrixService,
  origin: LatLng,
  destinations: (LatLng | google.maps.LatLngLiteral)[],
  travelMode: google.maps.TravelMode
): Promise<(TravelResult | null)[]> {
  if (destinations.length === 0) return Promise.resolve([])
  const request: google.maps.DistanceMatrixRequest = { origins: [origin], destinations, travelMode }
  if (travelMode === google.maps.TravelMode.TRANSIT) request.transitOptions = { departureTime: new Date() }
  return new Promise((resolve) => {
    service.getDistanceMatrix(
      request,
      (res, status) => {
        if (status !== 'OK' || !res) {
          resolve(destinations.map(() => null))
          return
        }
        const row = res.rows[0]
        resolve(
          row.elements.map((el) =>
            el.status === 'OK'
              ? { minutes: Math.round(el.duration.value / 60), meters: el.distance.value }
              : null
          )
        )
      }
    )
  })
}

/** Walking route polyline path from origin to destination (for drawing). */
export function walkingRoute(
  service: google.maps.DirectionsService,
  origin: LatLng,
  destination: LatLng
): Promise<google.maps.LatLngLiteral[] | null> {
  return new Promise((resolve) => {
    service.route(
      { origin, destination, travelMode: google.maps.TravelMode.WALKING },
      (res, status) => {
        if (status !== 'OK' || !res?.routes?.[0]) {
          resolve(null)
          return
        }
        resolve(res.routes[0].overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })))
      }
    )
  })
}
