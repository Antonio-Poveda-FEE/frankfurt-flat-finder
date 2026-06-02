// Supabase connection. The publishable (anon) key is designed to be shipped in
// client code; access is protected by Row Level Security + authentication.
// Values can be overridden at build time via VITE_SUPABASE_URL / VITE_SUPABASE_KEY.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://hsduphenknczkmckcpgu.supabase.co'

export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_rpALg8B8cQiGy8jfnM8KIQ__Dz3_zPa'

export const PHOTO_BUCKET = 'flat-photos'

// Read-only guest account: can view everything but RLS blocks all writes.
export const GUEST_EMAIL = 'guest@flatfinder.local'
export const GUEST_PASSWORD = 'invitado'

// Google Maps Platform key. Must be restricted by HTTP referrer + API in the
// Google Cloud console (it necessarily ships in the client bundle). When empty,
// the app degrades gracefully: maps are replaced by external Google Maps links.
export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

export const hasMaps = (): boolean => GOOGLE_MAPS_KEY.length > 0

// Frankfurt am Main centre, used as the default map view.
export const FRANKFURT_CENTER = { lat: 50.1109, lng: 8.6821 }
