import type { Criterion, Score, Flat, AppSettings, FlatCosts } from './types'
import { monthlyTotal } from './costs'
import { tr, type Lang } from './i18n'

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

// ───────────────────────────── Global score (quality + price) ───────────────

export interface GlobalScore {
  /** Weighted criteria score, 0..100 (quality only, price excluded). */
  quality: number | null
  /** Relative price score across flats, 0..100 (cheaper = higher). */
  priceScore: number | null
  /** Relative value-for-money (quality per euro), 0..100 (higher = better deal). */
  valueScore: number | null
  /** Final score combining quality with the price weight, 0..100. */
  global: number | null
}

/**
 * Combines the per-criterion quality with the flat price. Price is normalised
 * relative to the other flats (cheapest = 100) and folded into the global score
 * with `settings.price_weight` (on the same scale as criteria weights).
 * Value-for-money (quality per euro) is reported separately for the comparator.
 */
export function computeGlobalScores(
  flats: Flat[],
  costs: Record<string, FlatCosts>,
  criteria: Criterion[],
  scores: Score[],
  settings: AppSettings
): Map<string, GlobalScore> {
  const quality = computeFlatScores(criteria, scores)
  const totalCritWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1
  const Wp = Math.max(0, settings.price_weight ?? 0)

  const prices = flats.map((f) => monthlyTotal(costs[f.id])).filter((p) => p > 0)
  const minP = prices.length ? Math.min(...prices) : 0
  const maxP = prices.length ? Math.max(...prices) : 0

  const valueRaws = new Map<string, number>()
  for (const f of flats) {
    const q = quality.get(f.id)?.global
    const p = monthlyTotal(costs[f.id])
    if (q != null && p > 0) valueRaws.set(f.id, q / p)
  }
  const maxValueRaw = valueRaws.size ? Math.max(...valueRaws.values()) : 0

  const out = new Map<string, GlobalScore>()
  for (const f of flats) {
    const q = quality.get(f.id)?.global ?? null
    const p = monthlyTotal(costs[f.id])
    const priceScore = p > 0 ? (maxP > minP ? (100 * (maxP - p)) / (maxP - minP) : 100) : null
    const valueRaw = valueRaws.get(f.id)
    const valueScore = valueRaw != null && maxValueRaw > 0 ? (100 * valueRaw) / maxValueRaw : null
    let global: number | null
    if (q == null) global = null
    else if (priceScore != null && Wp > 0) global = (q * totalCritWeight + priceScore * Wp) / (totalCritWeight + Wp)
    else global = q
    out.set(f.id, { quality: q, priceScore, valueScore, global })
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

/** Standard-normal CDF (Abramowitz & Stegun 7.1.26). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2)
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z > 0 ? 1 - p : p
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
  scoreMap: Map<string, { global: number | null }>,
  settings: AppSettings,
  lang: Lang = 'es'
): Recommendation {
  // The "seen" sequence: scored flats, in the order they were evaluated.
  // Rejected flats stay in the sequence for statistics (mean/std/benchmark) but
  // are never recommended as a choice.
  const seen: SeenFlat[] = flats
    .map((f) => ({ flat: f, fs: scoreMap.get(f.id) }))
    .filter((x) => x.fs && x.fs.global != null)
    .map((x) => ({ flat: x.flat, global: x.fs!.global as number }))
    .sort((a, a2) => {
      const da = `${a.flat.visited_on || a.flat.created_at} ${a.flat.visit_time ?? ''}`
      const db = `${a2.flat.visited_on || a2.flat.created_at} ${a2.flat.visit_time ?? ''}`
      return da < db ? -1 : da > db ? 1 : 0
    })
  const isRecommendable = (s: SeenFlat) => s.flat.status !== 'rejected'

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
    headline: tr(lang, 'Aún no hay pisos puntuados.', 'No flats scored yet.'),
    bullets: [tr(lang, 'Añade y puntúa al menos un piso para empezar a recibir recomendaciones.', 'Add and score at least one flat to start getting recommendations.')],
  }

  if (seenCount === 0) return base

  // Statistics use every scored flat (rejected included).
  const globals = seen.map((s) => s.global)
  const m = mean(globals)
  const sd = sampleStd(globals)
  // The recommended "best" only considers flats you haven't discarded.
  const recommendable = seen.filter(isRecommendable)
  const bestFlat = recommendable.length
    ? recommendable.reduce((a, b) => (b.global > a.global ? b : a))
    : seen.reduce((a, b) => (b.global > a.global ? b : a))
  const phase: Recommendation['phase'] = seenCount <= explorationCount ? 'exploration' : 'decision'

  // Secretary rule: benchmark is the best score seen during exploration (stats).
  const explorationWindow = seen.slice(0, Math.min(explorationCount, seenCount))
  const benchmark = explorationWindow.length ? Math.max(...explorationWindow.map((s) => s.global)) : null
  let acceptCandidate: SeenFlat | null = null
  if (phase === 'decision' && benchmark != null) {
    // Only ever suggest accepting a non-discarded flat.
    for (const s of seen.slice(explorationCount)) {
      if (isRecommendable(s) && s.global > benchmark) { acceptCandidate = s; break }
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
  const title = bestFlat.flat.title
  const bullets: string[] = []
  bullets.push(tr(lang,
    `Has puntuado ${seenCount} de ~${settings.planned_visits} pisos planeados. Fase de exploración recomendada: los primeros ${explorationCount} (~regla del 37%).`,
    `You've scored ${seenCount} of ~${settings.planned_visits} planned flats. Recommended exploration phase: the first ${explorationCount} (~37% rule).`
  ))
  bullets.push(tr(lang,
    `Mejor piso hasta ahora: «${title}» con ${bestFlat.global.toFixed(0)}/100. Media ${m.toFixed(0)}, desviación ${sd.toFixed(0)}.`,
    `Best flat so far: “${title}” with ${bestFlat.global.toFixed(0)}/100. Mean ${m.toFixed(0)}, std dev ${sd.toFixed(0)}.`
  ))
  if (bestZ != null) {
    bullets.push(bestIsSignificant
      ? tr(lang,
          `Destaca de forma significativa (z = ${bestZ.toFixed(2)} ≥ ${settings.significance_k}): está claramente por encima del resto.`,
          `It stands out significantly (z = ${bestZ.toFixed(2)} ≥ ${settings.significance_k}): clearly above the rest.`)
      : tr(lang,
          `No despunta estadísticamente todavía (z = ${bestZ.toFixed(2)} < ${settings.significance_k}): es bueno pero no sobresale del grupo.`,
          `Not statistically outstanding yet (z = ${bestZ.toFixed(2)} < ${settings.significance_k}): good but not above the group.`))
  }
  if (expectedBestRemaining != null && expectedGain != null) {
    bullets.push(tr(lang,
      `Si visitas los ${remaining} pisos restantes, el mejor esperado rondaría ${expectedBestRemaining.toFixed(0)}/100 (${expectedGain >= 0 ? '+' : ''}${expectedGain.toFixed(0)} vs. tu mejor actual).`,
      `If you visit the remaining ${remaining} flats, the expected best would be around ${expectedBestRemaining.toFixed(0)}/100 (${expectedGain >= 0 ? '+' : ''}${expectedGain.toFixed(0)} vs. your current best).`
    ))
  } else if (remaining === 0) {
    bullets.push(tr(lang, 'Ya has alcanzado el número de visitas planeado: toca decidir.', 'You have reached your planned number of visits: time to decide.'))
  }

  let headline: string
  if (phase === 'exploration') {
    headline = tr(lang, '🔍 Fase de exploración: sigue visitando (aún no deberías comprometerte).', '🔍 Exploration phase: keep visiting (you shouldn\'t commit yet).')
    bullets.push(tr(lang,
      `Estás dentro de los primeros ${explorationCount} pisos. Aunque alguno te encante, lo óptimo es seguir mirando para calibrar el mercado antes de decidir.`,
      `You're within the first ${explorationCount} flats. Even if you love one, the optimal move is to keep looking to calibrate the market before deciding.`
    ))
  } else if (acceptCandidate) {
    headline = tr(lang, `✅ Decide ya: «${acceptCandidate.flat.title}» supera tu listón de referencia.`, `✅ Decide now: “${acceptCandidate.flat.title}” beats your benchmark.`)
    bullets.push(tr(lang,
      `Estás en fase de decisión y «${acceptCandidate.flat.title}» (${acceptCandidate.global.toFixed(0)}/100) supera el mejor de la fase de exploración (${benchmark?.toFixed(0)}). La estrategia de parada óptima dice: ofértalo.`,
      `You're in the decision phase and “${acceptCandidate.flat.title}” (${acceptCandidate.global.toFixed(0)}/100) beats the best of the exploration phase (${benchmark?.toFixed(0)}). The optimal-stopping strategy says: go for it.`
    ))
  } else if (worthSeeingMore) {
    headline = tr(lang, '⏳ Aún merece la pena ver más pisos.', '⏳ It\'s still worth seeing more flats.')
    bullets.push(tr(lang,
      `Ningún piso ha superado claramente tu listón y estadísticamente podrías encontrar algo mejor (mejora esperada ≥ ${settings.improvement_threshold} pts). Sigue buscando salvo que aparezca un favorito claro.`,
      `No flat has clearly beaten your benchmark and statistically you could find something better (expected improvement ≥ ${settings.improvement_threshold} pts). Keep looking unless a clear favourite appears.`
    ))
  } else {
    headline = bestIsSignificant
      ? tr(lang, `✅ «${title}» es tu mejor opción: quédatelo.`, `✅ “${title}” is your best option: take it.`)
      : tr(lang, '🤔 Rendimiento decreciente: probablemente debas decidir entre lo que ya tienes.', '🤔 Diminishing returns: you should probably decide among what you already have.')
    bullets.push(tr(lang,
      `La mejora esperada por seguir buscando (${expectedGain != null ? expectedGain.toFixed(0) : '—'} pts) no compensa. Lo razonable es decidir entre los pisos actuales.`,
      `The expected improvement from looking further (${expectedGain != null ? expectedGain.toFixed(0) : '—'} pts) isn't worth it. The sensible move is to decide among the current flats.`
    ))
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

// ───────────────────────────── Search-effort estimate ───────────────────────

export interface SearchEffort {
  /** Best score observed so far (across all flats, rejected included). */
  best: number
  mean: number
  std: number
  /** Probability a freshly visited flat scores ≥ the current best. */
  p: number | null
  /** Expected number of additional visits to find one ≥ the current best (1/p). */
  expectedVisits: number | null
  /** P(at least one flat ≥ best within k extra visits) for k = 1…kMax. */
  curve: { k: number; prob: number }[]
  feasible: boolean
}

/**
 * Models how many more flats you'd likely need to visit to beat (or match) the
 * best score you've already seen. Assumes scores are roughly normal with the
 * observed mean/std; the chance a new flat reaches the current best is
 * p = 1 − Φ((best − mean) / std), so the number of visits until success is
 * geometric with expectation 1/p, and the cumulative curve is 1 − (1 − p)^k.
 */
export function estimateSearchEffort(values: number[]): SearchEffort {
  const best = values.length ? Math.max(...values) : 0
  const m = values.length ? mean(values) : 0
  const sd = sampleStd(values)
  const empty: SearchEffort = { best, mean: m, std: sd, p: null, expectedVisits: null, curve: [], feasible: false }
  if (values.length < 2 || sd <= 0) return empty

  const z = (best - m) / sd
  // Clamp to keep the estimate finite when the best is an extreme outlier.
  const p = Math.min(0.5, Math.max(1e-4, 1 - normCdf(z)))
  const expectedVisits = 1 / p
  // Extend the curve a bit past the expected number of visits so the "avg"
  // marker is always on-chart, capped so rare outliers don't stretch it forever.
  const kMax = Math.min(120, Math.max(8, Math.ceil(expectedVisits * 1.4)))
  const curve: { k: number; prob: number }[] = []
  for (let k = 1; k <= kMax; k++) curve.push({ k, prob: 1 - Math.pow(1 - p, k) })
  return { best, mean: m, std: sd, p, expectedVisits, curve, feasible: true }
}
