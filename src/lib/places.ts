export type NearbyCategory = 'food' | 'park' | 'supermarket'

export interface CategoryDef {
  key: NearbyCategory
  label: string
  labelEn: string
  emoji: string
  /** Google Places (legacy) `type` used for nearbySearch. */
  type: string
}

export const NEARBY_CATEGORIES: CategoryDef[] = [
  { key: 'food', label: 'Bares y restaurantes', labelEn: 'Bars and restaurants', emoji: '🍻', type: 'restaurant' },
  { key: 'park', label: 'Parques', labelEn: 'Parks', emoji: '🌳', type: 'park' },
  { key: 'supermarket', label: 'Supermercados', labelEn: 'Supermarkets', emoji: '🛒', type: 'supermarket' },
]

export const categoryOf = (key: NearbyCategory): CategoryDef =>
  NEARBY_CATEGORIES.find((c) => c.key === key) ?? NEARBY_CATEGORIES[0]
