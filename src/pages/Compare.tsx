import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { useStore } from '../store/DataContext'
import { buildRecommendation, computeFlatScores, computeGlobalScores, estimateSearchEffort } from '../lib/stats'
import { monthlyTotal } from '../lib/costs'
import { eur, scoreColor } from '../lib/format'
import RecommendationPanel from '../components/RecommendationPanel'
import FlatsMap from '../components/FlatsMap'
import { hasMaps } from '../lib/config'
import { useT } from '../lib/i18n'

const RADAR_COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#f472b6', '#a78bfa']

export default function Compare() {
  const { flats, scores, criteria, costs, settings, pois, loading } = useStore()
  const { t, lang } = useT()
  const qualityMap = useMemo(() => computeFlatScores(criteria, scores), [criteria, scores])
  const scoreMap = useMemo(() => computeGlobalScores(flats, costs, criteria, scores, settings), [flats, costs, criteria, scores, settings])
  // Headline metric = value (price-normalised, quality ÷ price). Markers + the
  // recommendation engine rank by this. Raw quality is shown alongside.
  const valueMap = useMemo(
    () => new Map(flats.map((f) => [f.id, { global: scoreMap.get(f.id)?.valueScore ?? null }])),
    [flats, scoreMap]
  )
  const mapFlats = useMemo(() => flats.map((f) => ({ flat: f, score: scoreMap.get(f.id)?.valueScore ?? null })), [flats, scoreMap])
  const rec = useMemo(() => buildRecommendation(flats, valueMap, settings, lang), [flats, valueMap, settings, lang])

  // Search-effort estimate: all flats (rejected included). Uses the *raw*
  // value-for-money ratio (quality ÷ monthly price) — not the relative value
  // score, which always pins the best flat at 100 and would make the estimate
  // circular. Only z-scores matter, so the ratio's absolute scale is irrelevant.
  const effort = useMemo(() => {
    const vals = flats
      .map((f) => {
        const q = qualityMap.get(f.id)?.global
        const p = monthlyTotal(costs[f.id])
        return q != null && p > 0 ? q / p : null
      })
      .filter((v): v is number => v != null)
    return estimateSearchEffort(vals)
  }, [flats, qualityMap, costs])

  const ranked = useMemo(() =>
    flats
      .map((f) => ({ flat: f, gs: scoreMap.get(f.id) }))
      .filter((r) => r.gs?.valueScore != null)
      .sort((a, b) => (b.gs!.valueScore! - a.gs!.valueScore!)),
  [flats, scoreMap])

  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s))

  // Default selection: top 2 ranked flats.
  const effectiveSelected = selected.length ? selected : ranked.slice(0, 2).map((r) => r.flat.id)

  const radarData = useMemo(() => {
    return criteria.map((c) => {
      const row: Record<string, number | string> = { criterion: c.name }
      for (const id of effectiveSelected) {
        const f = flats.find((x) => x.id === id)
        if (f) row[f.title] = qualityMap.get(id)?.perCriterion100[c.id] ?? 0
      }
      return row
    })
  }, [criteria, effectiveSelected, flats, qualityMap])

  if (loading) return <p className="text-slate-400">{t('Cargando…', 'Loading…')}</p>

  return (
    <div className="space-y-5">
      <RecommendationPanel rec={rec} />

      {hasMaps() && flats.length > 0 && <FlatsMap flats={mapFlats} pois={pois} />}

      {ranked.length === 0 ? (
        <p className="rounded-2xl bg-slate-900 p-6 text-center text-slate-400 ring-1 ring-slate-800">
          {t('Puntúa algunos pisos para ver el ranking y el comparador.', 'Score some flats to see the ranking and comparison.')}
        </p>
      ) : (
        <>
          {/* Ranking table */}
          <section className="overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800">
            <h2 className="border-b border-slate-800 px-4 py-3 font-semibold text-white">{t('Ranking', 'Ranking')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-1 py-2 text-left">Piso</th>
                    <th className="px-2 py-2 text-right">€/mes</th>
                    <th className="px-2 py-2 text-right" title={t('Global (raw): calidad por criterios, sin tener en cuenta el precio', 'Global (raw): criteria quality, ignoring price')}>{t('Global', 'Global')}</th>
                    <th className="px-3 py-2 text-right" title={t('Puntuación normalizada por precio (calidad por euro)', 'Price-normalised score (quality per euro)')}>{t('Valor ★', 'Value ★')}</th>
                    <th className="px-2 py-2 text-center">{t('Radar', 'Radar')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r, i) => {
                    const total = monthlyTotal(costs[r.flat.id])
                    const sel = effectiveSelected.includes(r.flat.id)
                    const gs = r.gs!
                    return (
                      <tr key={r.flat.id} className="border-t border-slate-800/60">
                        <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                        <td className="px-1 py-2">
                          <Link to={`/flat/${r.flat.id}`} className="text-slate-100 hover:text-sky-400">{r.flat.title}</Link>
                        </td>
                        <td className="px-2 py-2 text-right text-slate-300">{eur(total)}</td>
                        <td className="px-2 py-2 text-right font-medium" style={{ color: scoreColor(gs.quality) }}>{gs.quality != null ? gs.quality.toFixed(0) : '—'}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{ color: scoreColor(gs.valueScore) }}>{gs.valueScore != null ? gs.valueScore.toFixed(0) : '—'}</td>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={sel} onChange={() => toggle(r.flat.id)} className="h-4 w-4 accent-sky-500" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2 text-[11px] text-slate-500">
              {t('Global = calidad por criterios (sin precio) · Valor ★ = puntuación normalizada por precio (calidad por euro), la que manda en el ranking y la recomendación. Marca hasta 5 pisos para el radar.',
                 'Global = criteria quality (no price) · Value ★ = price-normalised score (quality per euro), which drives the ranking and recommendation. Tick up to 5 flats for the radar.')}
            </p>
          </section>

          {/* Search-effort estimate */}
          {effort.feasible && (
            <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <h2 className="mb-1 font-semibold text-white">{t('¿Cuántos pisos más hasta encontrar uno mejor?', 'How many more flats until a better one?')}</h2>
              <p className="mb-3 text-sm text-slate-300">
                {t('De media harían falta ', 'On average it would take ')}
                <b className="text-sky-300">≈ {Math.round(effort.expectedVisits!)} {t('visitas', 'visits')}</b>
                {t(' para encontrar un piso con mejor relación calidad-precio que tu mejor actual.',
                   ' to find a flat with a better value-for-money than your current best.')}
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={effort.curve} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                    <defs>
                      <linearGradient id="effortFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" />
                    <XAxis dataKey="k" tick={{ fill: '#94a3b8', fontSize: 11 }}
                      label={{ value: t('pisos visitados', 'flats visited'), position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} width={44} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#e2e8f0' }}
                      formatter={(v: number) => [`${(v * 100).toFixed(0)}%`, t('prob. de hallar uno mejor', 'chance of a better one')]}
                      labelFormatter={(k) => t(`Tras ${k} pisos`, `After ${k} flats`)}
                    />
                    <ReferenceLine x={Math.round(effort.expectedVisits!)} stroke="#f59e0b" strokeDasharray="4 3"
                      label={{ value: t('media', 'avg'), fill: '#f59e0b', fontSize: 11, position: 'top' }} />
                    <Area type="monotone" dataKey="prob" stroke="#38bdf8" strokeWidth={2} fill="url(#effortFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {t('Probabilidad de que, visitando X pisos más, al menos uno iguale o supere tu mejor puntuación actual (modelo normal sobre todos los pisos puntuados, incluidos los descartados).',
                   'Probability that, visiting X more flats, at least one matches or beats your current best score (normal model over all scored flats, rejected included).')}
              </p>
            </section>
          )}

          {/* Radar */}
          {effectiveSelected.length > 0 && (
            <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <h2 className="mb-2 font-semibold text-white">{t('Comparativa por criterio (calidad)', 'Comparison by criterion (quality)')}</h2>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="70%">
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="criterion" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    {effectiveSelected.map((id, idx) => {
                      const f = flats.find((x) => x.id === id)
                      if (!f) return null
                      const color = RADAR_COLORS[idx % RADAR_COLORS.length]
                      return <Radar key={id} name={f.title} dataKey={f.title} stroke={color} fill={color} fillOpacity={0.25} />
                    })}
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
