import type { Criterion, Score, Flat, AppSettings } from './types'

// ───────────────────────────── Weighted scoring ─────────────────────────────

export interface FlatScore {
  flatId: string
  /** 0..100 weighted global score, or null if not scored yet. */
  global: number | null
  /** Number of criteria with at least one rating. */
  ratedCriteria: number
  /** Averaged value (across scorers) per criterion id, in the criterion's own scale. */
  perCriterion: Record<string, number>
  /** Per-criterion average normalised to 0..100 (for radar charts). */
  perCriterion100: Record<string, number>
}

/**
 * Computes each flat's global weighted score (0..100).
 * Each criterion's value is the average of all scorers; values are normalised
 * by the criterion scale, then combined as a weighted average over the criteria
 * that actually have ratings.
 */
export function computeFlatScores(criteria: Criterion[], scores: Score[]): Map<string, FlatScore> {
  const critById = new Map(criteria.map((c) => [c.id, c]))
  // flatId -> critId -> list of values
  const grouped = new Map<string, Map<string, number[]>>()
  for (const s of scores) {
    if (!critById.has(s.criterion_id)) continue
    let byCrit = grouped.get(s.flat_id)
    if (!byCrit) grouped.set(s.flat_id, (byCrit = new Map()))
    const arr = byCrit.get(s.criterion_id) ?? []
    arr.push(s.value)
    byCrit.set(s.criterion_id, arr)
  }

  const out = new Map<string, FlatScore>()
  for (const [flatId, byCrit] of grouped) {
    const perCriterion: Record<string, number> = {}
    const perCriterion100: Record<string, number> = {}
    let weightedSum = 0
    let weightTotal = 0
    for (const [critId, values] of byCrit) {
      const c = critById.get(critId)!
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      perCriterion[critId] = avg
      const norm = c.scale_max > 1 ? (avg - 1) / (c.scale_max - 1) : avg
      const norm100 = Math.max(0, Math.min(1, norm)) * 100
      perCriterion100[critId] = norm100
      weightedSum += norm100 * c.weight
      weightTotal += c.weight
    }
    out.set(flatId, {
      flatId,
      global: weightTotal > 0 ? weightedSum / weightTotal : null,
      ratedCriteria: byCrit.size,
      perCriterion,
      perCriterion100,
    })
  }
  return out
}

// ───────────────────────────── Normal distribution helpers ──────────────────

/** Inverse standard-normal CDF (Acklam's rational approximation). */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const plow = 0.02425
  const phigh = 1 - plow
  let q: number, r: number
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= phigh) {
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
}

/** Expected value of the maximum of m i.i.d. standard normals (Blom approximation). */
export function expectedMaxStdNormal(m: number): number {
  if (m <= 1) return 0
  return normInv((m - 0.375) / (m + 0.25))
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function sampleStd(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

// ───────────────────────────── Recommendation engine ────────────────────────

export interface SeenFlat {
  flat: Flat
  global: number
}

export interface Recommendation {
  seenCount: number
  plannedN: number
  explorationCount: number
  phase: 'no-data' | 'exploration' | 'decision'
  meanScore: number | null
  stdScore: number | null
  bestFlat: SeenFlat | null
  /** Benchmark = best score observed during the exploration window. */
  benchmark: number | null
  /** First flat in the decision phase that beats the benchmark (secretary rule). */
  acceptCandidate: SeenFlat | null
  /** z-score of the best flat vs the observed distribution. */
  bestZ: number | null
  /** Best flat is "significantly better" than typical (z >= k). */
  bestIsSignificant: boolean
  /** Estimated score of the best flat among the *remaining* planned visits. */
  expectedBestRemaining: number | null
  /** Expected gain over the current best if you keep visiting. */
  expectedGain: number | null
  worthSeeingMore: boolean
  headline: string
  bullets: string[]
}

/**
 * Combines the weighted scores with optimal-stopping (secretary problem),
 * z-score significance, and order-statistics to advise whether to accept a
 * flat now or keep visiting.
 *
 * @param flats     all flats
 * @param scoreMap  output of computeFlatScores
 * @param settings  planned N, significance k, improvement threshold
 */
export function buildRecommendation(
  flats: Flat[],
  scoreMap: Map<string, FlatScore>,
  settings: AppSettings
): Recommendation {
  // The "seen" sequence: scored flats, in the order they were evaluated.
  const seen: SeenFlat[] = flats
    .map((f) => ({ flat: f, fs: scoreMap.get(f.id) }))
    .filter((x) => x.fs && x.fs.global != null)
    .map((x) => ({ flat: x.flat, global: x.fs!.global as number }))
    .sort((a, a2) => {
      const da = a.flat.visited_on || a.flat.created_at
      const db = a2.flat.visited_on || a2.flat.created_at
      return da < db ? -1 : da > db ? 1 : 0
    })

  const N = Math.max(seen.length, settings.planned_visits)
  const explorationCount = Math.max(1, Math.round(N / Math.E))
  const seenCount = seen.length

  const base: Recommendation = {
    seenCount,
    plannedN: settings.planned_visits,
    explorationCount,
    phase: 'no-data',
    meanScore: null,
    stdScore: null,
    bestFlat: null,
    benchmark: null,
    acceptCandidate: null,
    bestZ: null,
    bestIsSignificant: false,
    expectedBestRemaining: null,
    expectedGain: null,
    worthSeeingMore: true,
    headline: 'Aún no hay pisos puntuados.',
    bullets: ['Añade y puntúa al menos un piso para empezar a recibir recomendaciones.'],
  }

  if (seenCount === 0) return base

  const globals = seen.map((s) => s.global)
  const m = mean(globals)
  const sd = sampleStd(globals)
  const bestFlat = seen.reduce((a, b) => (b.global > a.global ? b : a))
  const phase: Recommendation['phase'] = seenCount <= explorationCount ? 'exploration' : 'decision'

  // Secretary rule: benchmark is the best score seen during exploration.
  const explorationWindow = seen.slice(0, Math.min(explorationCount, seenCount))
  const benchmark = explorationWindow.length ? Math.max(...explorationWindow.map((s) => s.global)) : null
  let acceptCandidate: SeenFlat | null = null
  if (phase === 'decision' && benchmark != null) {
    for (const s of seen.slice(explorationCount)) {
      if (s.global > benchmark) { acceptCandidate = s; break }
    }
  }

  const bestZ = sd > 0 ? (bestFlat.global - m) / sd : null
  const bestIsSignificant = bestZ != null && bestZ >= settings.significance_k

  const remaining = Math.max(0, settings.planned_visits - seenCount)
  let expectedBestRemaining: number | null = null
  let expectedGain: number | null = null
  if (remaining > 0 && sd > 0) {
    expectedBestRemaining = m + sd * expectedMaxStdNormal(remaining)
    expectedGain = expectedBestRemaining - bestFlat.global
  }
  const worthSeeingMore =
    remaining > 0 && (expectedGain == null || expectedGain >= settings.improvement_threshold)

  // ── Natural-language verdict ──
  const bullets: string[] = []
  bullets.push(
    `Has puntuado ${seenCount} de ~${settings.planned_visits} pisos planeados. ` +
      `Fase de exploración recomendada: los primeros ${explorationCount} (~regla del 37%).`
  )
  bullets.push(
    `Mejor piso hasta ahora: «${bestFlat.flat.title}» con ${bestFlat.global.toFixed(0)}/100. ` +
      `Media ${m.toFixed(0)}, desviación ${sd.toFixed(0)}.`
  )
  if (bestZ != null) {
    bullets.push(
      bestIsSignificant
        ? `Destaca de forma significativa (z = ${bestZ.toFixed(2)} ≥ ${settings.significance_k}): está claramente por encima del resto.`
        : `No despunta estadísticamente todavía (z = ${bestZ.toFixed(2)} < ${settings.significance_k}): es bueno pero no sobresale del grupo.`
    )
  }
  if (expectedBestRemaining != null && expectedGain != null) {
    bullets.push(
      `Si visitas los ${remaining} pisos restantes, el mejor esperado rondaría ${expectedBestRemaining.toFixed(0)}/100 ` +
        `(${expectedGain >= 0 ? '+' : ''}${expectedGain.toFixed(0)} vs. tu mejor actual).`
    )
  } else if (remaining === 0) {
    bullets.push('Ya has alcanzado el número de visitas planeado: toca decidir.')
  }

  let headline: string
  if (phase === 'exploration') {
    headline = `🔍 Fase de exploración: sigue visitando (aún no deberías comprometerte).`
    bullets.push(
      `Estás dentro de los primeros ${explorationCount} pisos. Aunque alguno te encante, ` +
        `lo óptimo es seguir mirando para calibrar el mercado antes de decidir.`
    )
  } else if (acceptCandidate) {
    headline = `✅ Decide ya: «${acceptCandidate.flat.title}» supera tu listón de referencia.`
    bullets.push(
      `Estás en fase de decisión y «${acceptCandidate.flat.title}» (${acceptCandidate.global.toFixed(0)}/100) ` +
        `supera el mejor de la fase de exploración (${benchmark?.toFixed(0)}). La estrategia de parada óptima dice: ofértalo.`
    )
  } else if (worthSeeingMore) {
    headline = `⏳ Aún merece la pena ver más pisos.`
    bullets.push(
      `Ningún piso ha superado claramente tu listón y estadísticamente podrías encontrar algo mejor ` +
        `(mejora esperada ≥ ${settings.improvement_threshold} pts). Sigue buscando salvo que aparezca un favorito claro.`
    )
  } else {
    headline = bestIsSignificant
      ? `✅ «${bestFlat.flat.title}» es tu mejor opción: quédatelo.`
      : `🤔 Rendimiento decreciente: probablemente debas decidir entre lo que ya tienes.`
    bullets.push(
      `La mejora esperada por seguir buscando (${expectedGain != null ? expectedGain.toFixed(0) : '—'} pts) ` +
        `no compensa. Lo razonable es decidir entre los pisos actuales.`
    )
  }

  return {
    ...base,
    phase,
    meanScore: m,
    stdScore: sd,
    bestFlat,
    benchmark,
    acceptCandidate,
    bestZ,
    bestIsSignificant,
    expectedBestRemaining,
    expectedGain,
    worthSeeingMore,
    headline,
    bullets,
  }
}
