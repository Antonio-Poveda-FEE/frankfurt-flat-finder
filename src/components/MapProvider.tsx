import type { ReactNode } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { GOOGLE_MAPS_KEY, hasMaps } from '../lib/config'

/**
 * Wraps the app so any descendant can use Google Maps hooks/components.
 * When no key is configured we render children unwrapped — map features then
 * fall back to external Google Maps links (graceful degradation).
 */
export default function MapProvider({ children }: { children: ReactNode }) {
  if (!hasMaps()) return <>{children}</>
  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} language="es" region="DE">
      {children}
    </APIProvider>
  )
}
