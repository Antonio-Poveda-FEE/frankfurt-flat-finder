// Supabase connection. The publishable (anon) key is designed to be shipped in
// client code; access is protected by Row Level Security + authentication.
// Values can be overridden at build time via VITE_SUPABASE_URL / VITE_SUPABASE_KEY.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://hsduphenknczkmckcpgu.supabase.co'

export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_rpALg8B8cQiGy8jfnM8KIQ__Dz3_zPa'

export const PHOTO_BUCKET = 'flat-photos'
