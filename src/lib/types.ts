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
}

export interface FlatPoiTime {
  id: string
  flat_id: string
  poi_id: string
  mode: TravelMode
  minutes: number | null
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
}

export const COST_FIELDS: { key: keyof Omit<FlatCosts, 'flat_id'>; label: string; recurring: boolean }[] = [
  { key: 'kaltmiete', label: 'Alquiler base (Kaltmiete)', recurring: true },
  { key: 'nebenkosten', label: 'Gastos comunes (Nebenkosten)', recurring: true },
  { key: 'heating', label: 'Calefacción', recurring: true },
  { key: 'internet', label: 'Internet', recurring: true },
  { key: 'electricity', label: 'Luz', recurring: true },
  { key: 'water', label: 'Agua', recurring: true },
  { key: 'garage', label: 'Garaje / plaza', recurring: true },
  { key: 'other', label: 'Otros mensuales', recurring: true },
  { key: 'deposit', label: 'Fianza (una vez)', recurring: false },
]

export const STATUS_META: Record<FlatStatus, { label: string; color: string }> = {
  candidate: { label: 'Candidato', color: '#64748b' },
  visited: { label: 'Visitado', color: '#3b82f6' },
  favorite: { label: 'Favorito', color: '#f59e0b' },
  rejected: { label: 'Descartado', color: '#ef4444' },
}

export const TRAVEL_MODES: { mode: TravelMode; label: string; emoji: string; gmaps: string }[] = [
  { mode: 'walk', label: 'Andando', emoji: '🚶', gmaps: 'walking' },
  { mode: 'bike', label: 'Bici', emoji: '🚲', gmaps: 'bicycling' },
  { mode: 'transit', label: 'Metro/Bus', emoji: '🚇', gmaps: 'transit' },
  { mode: 'drive', label: 'Coche', emoji: '🚗', gmaps: 'driving' },
]
