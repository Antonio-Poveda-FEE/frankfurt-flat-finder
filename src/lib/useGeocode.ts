import { useMemo } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { geocodeAddress, type LatLng } from './geocode'

/**
 * Returns a geocoding function `(address) => LatLng | null`, or null while the
 * Maps library is loading / unavailable (no key). Callers should guard for null.
 */
export function useGeocode(): ((address: string) => Promise<LatLng | null>) | null {
  const geocoding = useMapsLibrary('geocoding')
  return useMemo(() => {
    if (!geocoding) return null
    const geocoder = new geocoding.Geocoder()
    return (address: string) => geocodeAddress(geocoder, address)
  }, [geocoding])
}
