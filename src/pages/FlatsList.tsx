import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/DataContext'
import { computeFlatScores } from '../lib/stats'
import { monthlyTotal, pricePerM2 } from '../lib/costs'
import { eur, num, scoreColor } from '../lib/format'
import { photoUrl } from '../lib/supabase'
import { STATUS_META, coverPhoto } from '../lib/types'
import type { FlatStatus } from '../lib/types'

type SortKey = 'score' | 'price' | 'recent'

export default function FlatsList() {
  const { flats, scores, criteria, costs, photos, loading } = useStore()
  const [sort, setSort] = useState<SortKey>('score')
  const [filter, setFilter] = useState<FlatStatus | 'all'>('all')

  const scoreMap = useMemo(() => computeFlatScores(criteria, scores), [criteria, scores])
  const bestId = useMemo(() => {
    let best: { id: string; g: number } | null = null
    for (const f of flats) {
      const g = scoreMap.get(f.id)?.global
      if (g != null && (!best || g > best.g)) best = { id: f.id, g }
    }
    return best?.id ?? null
  }, [flats, scoreMap])

  const rows = useMemo(() => {
    const list = flats
      .filter((f) => filter === 'all' || f.status === filter)
      .map((f) => ({
        flat: f,
        score: scoreMap.get(f.id)?.global ?? null,
        rated: scoreMap.get(f.id)?.ratedCriteria ?? 0,
        total: monthlyTotal(costs[f.id]),
        ppm2: pricePerM2(costs[f.id], f.size_m2),
        cover: coverPhoto(photos[f.id]),
      }))
    list.sort((a, b) => {
      if (sort === 'price') return a.total - b.total
      if (sort === 'recent') return a.flat.created_at < b.flat.created_at ? 1 : -1
      return (b.score ?? -1) - (a.score ?? -1)
    })
    return list
  }, [flats, filter, sort, scoreMap, costs, photos])

  if (loading) return <p className="text-slate-400">Cargando pisos…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg bg-slate-800 px-2 py-1 text-sm ring-1 ring-slate-700">
          <option value="score">Ordenar: puntuación</option>
          <option value="price">Ordenar: coste mensual</option>
          <option value="recent">Ordenar: recientes</option>
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value as FlatStatus | 'all')}
          className="rounded-lg bg-slate-800 px-2 py-1 text-sm ring-1 ring-slate-700">
          <option value="all">Todos los estados</option>
          <option value="candidate">Candidatos</option>
          <option value="visited">Visitados</option>
          <option value="favorite">Favoritos</option>
          <option value="rejected">Descartados</option>
        </select>
      </div>

      {rows.length === 0 && (
        <div className="rounded-2xl bg-slate-900 p-8 text-center text-slate-400 ring-1 ring-slate-800">
          <p className="mb-2 text-3xl">🏠</p>
          <p>No hay pisos todavía.</p>
          <Link to="/new" className="mt-3 inline-block rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white">
            Añadir el primero
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {rows.map(({ flat, score, rated, total, ppm2, cover }) => (
          <li key={flat.id}>
            <Link to={`/flat/${flat.id}`}
              className="flex gap-3 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800 transition hover:ring-slate-600">
              <div className="h-24 w-24 shrink-0 bg-slate-800">
                {cover
                  ? <img src={photoUrl(cover.storage_path)} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-2xl text-slate-600">🏠</div>}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-3">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-white">{flat.title}</h3>
                  {flat.id === bestId && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">★ MEJOR</span>}
                </div>
                <p className="truncate text-xs text-slate-400">{flat.address || 'Sin dirección'}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span className="rounded px-1.5 py-0.5 font-medium"
                    style={{ background: `${STATUS_META[flat.status].color}22`, color: STATUS_META[flat.status].color }}>
                    {STATUS_META[flat.status].label}
                  </span>
                  <span>{eur(total)}/mes</span>
                  {ppm2 != null && <span>· {num(ppm2)} €/m²</span>}
                </div>
              </div>
              <div className="flex w-16 shrink-0 flex-col items-center justify-center border-l border-slate-800">
                <span className="text-xl font-bold" style={{ color: scoreColor(score) }}>
                  {score == null ? '—' : score.toFixed(0)}
                </span>
                <span className="text-[10px] text-slate-500">{rated > 0 ? `${rated} crit.` : 'sin nota'}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
