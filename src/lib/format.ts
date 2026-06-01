export const eur = (n: number | null | undefined): string =>
  n == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export const eur2 = (n: number | null | undefined): string =>
  n == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

export const num = (n: number | null | undefined, digits = 1): string =>
  n == null || Number.isNaN(n) ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits }).format(n)

export function scoreColor(score0to100: number | null): string {
  if (score0to100 == null) return '#64748b'
  if (score0to100 >= 80) return '#22c55e'
  if (score0to100 >= 65) return '#84cc16'
  if (score0to100 >= 50) return '#eab308'
  if (score0to100 >= 35) return '#f97316'
  return '#ef4444'
}
