export type FlatStatus = 'candidate' | 'visited' | 'favorite' | 'rejected'
export type TravelMode = 'walk' | 'bike' | 'transit' | 'drive'

export interface Criterion {
  id: string
  name: string
  category: string | null
  weight: number
  scale_max: number
  sort_order: number
}

export interface Poi {
  id: string
  label: string
  address: string | null
  lat: number | null
  lng: number | null
  emoji: string | null
}

export interface Flat {
  id: string
  title: string
  address: string | null
  lat: number | null
  lng: number | null
  size_m2: number | null
  rooms: number | null
  status: FlatStatus
  listing_url: string | null
  available_from: string | null
  visited_on: string | null
  visit_time?: string | null
  notes: string | null
  created_at: string
  created_by: string | null
}

export interface FlatCosts {
  flat_id: string
  kaltmiete: number
  nebenkosten: number
  heating: number
  internet: number
  electricity: number
  water: number
  garage: number
  other: number
  deposit: number
}

export interface FlatPhoto {
  id: string
  flat_id: string
  storage_path: string
  caption: string | null
  sort_order: number
  is_primary: boolean
}

/** Cover photo for a flat: the primary one, else the first by sort order. */
export function coverPhoto(photos: FlatPhoto[] | undefined): FlatPhoto | undefined {
  if (!photos || photos.length === 0) return undefined
  return photos.find((p) => p.is_primary) ?? photos[0]
}

export interface FlatPoiTime {
  id: string
  flat_id: string
  poi_id: string
  mode: TravelMode
  minutes: number | null
  auto: boolean
  distance_m: number | null
}

export interface Score {
  id: string
  flat_id: string
  criterion_id: string
  scorer: string
  value: number
}

export interface AppSettings {
  id: number
  planned_visits: number
  significance_k: number
  improvement_threshold: number
  price_weight: number
}

export const COST_FIELDS: { key: keyof Omit<FlatCosts, 'flat_id'>; label: string; labelEn: string; recurring: boolean }[] = [
  { key: 'kaltmiete', label: 'Alquiler base (Kaltmiete)', labelEn: 'Base rent (Kaltmiete)', recurring: true },
  { key: 'nebenkosten', label: 'Gastos comunes (Nebenkosten)', labelEn: 'Service charges (Nebenkosten)', recurring: true },
  { key: 'heating', label: 'Calefacción', labelEn: 'Heating', recurring: true },
  { key: 'internet', label: 'Internet', labelEn: 'Internet', recurring: true },
  { key: 'electricity', label: 'Luz', labelEn: 'Electricity', recurring: true },
  { key: 'water', label: 'Agua', labelEn: 'Water', recurring: true },
  { key: 'garage', label: 'Garaje / plaza', labelEn: 'Garage / parking', recurring: true },
  { key: 'other', label: 'Otros mensuales', labelEn: 'Other monthly', recurring: true },
  { key: 'deposit', label: 'Fianza (una vez)', labelEn: 'Deposit (one-off)', recurring: false },
]

export const STATUS_META: Record<FlatStatus, { label: string; labelEn: string; color: string }> = {
  candidate: { label: 'Candidato', labelEn: 'Candidate', color: '#64748b' },
  visited: { label: 'Visitado', labelEn: 'Visited', color: '#3b82f6' },
  favorite: { label: 'Favorito', labelEn: 'Favorite', color: '#f59e0b' },
  rejected: { label: 'Descartado', labelEn: 'Rejected', color: '#ef4444' },
}

export const TRAVEL_MODES: { mode: TravelMode; label: string; labelEn: string; emoji: string; gmaps: string }[] = [
  { mode: 'walk', label: 'Andando', labelEn: 'Walking', emoji: '🚶', gmaps: 'walking' },
  { mode: 'bike', label: 'Bici', labelEn: 'Cycling', emoji: '🚲', gmaps: 'bicycling' },
  { mode: 'transit', label: 'Metro/Bus', labelEn: 'Transit', emoji: '🚇', gmaps: 'transit' },
  { mode: 'drive', label: 'Coche', labelEn: 'Driving', emoji: '🚗', gmaps: 'driving' },
]
