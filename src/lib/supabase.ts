import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY, PHOTO_BUCKET } from './config'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export function photoUrl(path: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}
