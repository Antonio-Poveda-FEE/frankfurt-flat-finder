import type { FlatCosts } from './types'

const RECURRING: (keyof FlatCosts)[] = [
  'kaltmiete', 'nebenkosten', 'heating', 'internet', 'electricity', 'water', 'garage', 'other',
]

export function monthlyTotal(costs?: Partial<FlatCosts> | null): number {
  if (!costs) return 0
  return RECURRING.reduce((sum, k) => sum + (Number(costs[k]) || 0), 0)
}

export function pricePerM2(costs?: Partial<FlatCosts> | null, sizeM2?: number | null): number | null {
  if (!sizeM2 || sizeM2 <= 0) return null
  return monthlyTotal(costs) / sizeM2
}
