import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend,
} from 'recharts'
import { useStore } from '../store/DataContext'
import { buildRecommendation, computeFlatScores, computeGlobalScores } from '../lib/stats'
import { monthlyTotal } from '../lib/costs'
import { eur, scoreColor } from '../lib/format'
import RecommendationPanel from '../components/RecommendationPanel'
import FlatsMap from '../components/FlatsMap'
import { hasMaps } from '../lib/config'

const RADAR_COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#f472b6', '#a78bfa']

export default function Compare() {
  const { flats, scores, criteria, costs, settings, pois, loading } = useStore()
  const qualityMap = useMemo(() => computeFlatScores(criteria, scores), [criteria, scores])
  const scoreMap = useMemo(() => computeGlobalScores(flats, costs, criteria, scores, settings), [flats, costs, criteria, scores, settings])
  const mapFlats = useMemo(() => flats.map((f) => ({ flat: f, score: scoreMap.get(f.id)?.global ?? null })), [flats, scoreMap])
  const rec = useMemo(() => buildRecommendation(flats, scoreMap, settings), [flats, scoreMap, settings])

  const ranked = useMemo(() =>
    flats
      .map((f) => ({ flat: f, gs: scoreMap.get(f.id) }))
      .filter((r) => r.gs?.global != null)
      .sort((a, b) => (b.gs!.global! - a.gs!.global!)),
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

  if (loading) return <p className="text-slate-400">Cargando…</p>

  return (
    <div className="space-y-5">
      <RecommendationPanel rec={rec} />

      {hasMaps() && flats.length > 0 && <FlatsMap flats={mapFlats} pois={pois} />}

      {ranked.length === 0 ? (
        <p className="rounded-2xl bg-slate-900 p-6 text-center text-slate-400 ring-1 ring-slate-800">
          Puntúa algunos pisos para ver el ranking y el comparador.
        </p>
      ) : (
        <>
          {/* Ranking table */}
          <section className="overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800">
            <h2 className="border-b border-slate-800 px-4 py-3 font-semibold text-white">Ranking</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-1 py-2 text-left">Piso</th>
                    <th className="px-2 py-2 text-right">€/mes</th>
                    <th className="px-2 py-2 text-right" title="Calidad: media ponderada de criterios">Cal.</th>
                    <th className="px-2 py-2 text-right" title="Valor: calidad por euro (relación calidad-precio)">Valor</th>
                    <th className="px-3 py-2 text-right" title="Nota global: calidad + precio">Global</th>
                    <th className="px-2 py-2 text-center">Radar</th>
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
                        <td className="px-2 py-2 text-right font-medium" style={{ color: scoreColor(gs.valueScore) }}>{gs.valueScore != null ? gs.valueScore.toFixed(0) : '—'}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{ color: scoreColor(gs.global) }}>{gs.global!.toFixed(0)}</td>
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
              <b>Cal.</b> = calidad (criterios) · <b>Valor</b> = calidad por euro (relación calidad-precio) · <b>Global</b> = calidad + precio (peso del precio en Ajustes). Marca hasta 5 pisos para el radar.
            </p>
          </section>

          {/* Radar */}
          {effectiveSelected.length > 0 && (
            <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <h2 className="mb-2 font-semibold text-white">Comparativa por criterio (calidad)</h2>
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
