import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/DataContext'
import { computeFlatScores } from '../lib/stats'
import { monthlyTotal, pricePerM2 } from '../lib/costs'
import { eur, eur2, num, scoreColor } from '../lib/format'
import { photoUrl } from '../lib/supabase'
import { directionsUrl, nearbyUrl, placeUrl } from '../lib/maps'
import { COST_FIELDS, STATUS_META, TRAVEL_MODES } from '../lib/types'
import type { TravelMode } from '../lib/types'
import ScoreEditor from '../components/ScoreEditor'

export default function FlatDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { flats, costs, photos, pois, poiTimes, criteria, scores, setPoiTime, deleteFlat } = useStore()
  const flat = flats.find((f) => f.id === id)

  const scoreMap = useMemo(() => computeFlatScores(criteria, scores), [criteria, scores])
  if (!flat) return <p className="text-slate-400">Piso no encontrado. <Link className="text-sky-400" to="/">Volver</Link></p>

  const score = scoreMap.get(flat.id)?.global ?? null
  const c = costs[flat.id]
  const total = monthlyTotal(c)
  const ppm2 = pricePerM2(c, flat.size_m2)
  const flatPhotos = photos[flat.id] ?? []
  const times = poiTimes[flat.id] ?? []
  const timeOf = (poiId: string, mode: TravelMode) => times.find((t) => t.poi_id === poiId && t.mode === mode)?.minutes ?? null

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">{flat.title}</h1>
          {flat.address && (
            <a href={placeUrl(flat)} target="_blank" rel="noreferrer" className="text-sm text-sky-400 hover:underline">📍 {flat.address}</a>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-xl bg-slate-900 px-3 py-1 ring-1 ring-slate-800">
          <span className="text-2xl font-bold" style={{ color: scoreColor(score) }}>{score == null ? '—' : score.toFixed(0)}</span>
          <span className="text-[10px] text-slate-500">/100</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded px-2 py-1 text-xs font-medium"
          style={{ background: `${STATUS_META[flat.status].color}22`, color: STATUS_META[flat.status].color }}>
          {STATUS_META[flat.status].label}
        </span>
        {flat.size_m2 && <span className="text-xs text-slate-400">{num(flat.size_m2, 0)} m²</span>}
        {flat.rooms && <span className="text-xs text-slate-400">· {num(flat.rooms, 0)} hab.</span>}
        {flat.listing_url && <a href={flat.listing_url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">· ImmoScout24 ↗</a>}
        <Link to={`/flat/${flat.id}/edit`} className="ml-auto rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">Editar</Link>
      </div>

      {/* Photos */}
      {flatPhotos.length > 0 && (
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4">
          {flatPhotos.map((p) => (
            <img key={p.id} src={photoUrl(p.storage_path)} alt=""
              className="h-56 w-auto shrink-0 snap-center rounded-xl object-cover" />
          ))}
        </div>
      )}

      {/* Costs */}
      <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="mb-3 font-semibold text-white">Costes</h2>
        <table className="w-full text-sm">
          <tbody>
            {COST_FIELDS.map(({ key, label, recurring }) => {
              const v = c?.[key] ?? 0
              if (!v) return null
              return (
                <tr key={key} className="border-b border-slate-800/60">
                  <td className="py-1.5 text-slate-400">{label}{!recurring && <span className="text-[10px] text-slate-600"> (única)</span>}</td>
                  <td className="py-1.5 text-right text-slate-200">{eur2(v)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-700">
              <td className="pt-2 font-semibold text-white">Total mensual</td>
              <td className="pt-2 text-right font-bold text-sky-400">{eur(total)}</td>
            </tr>
            {ppm2 != null && (
              <tr><td className="text-xs text-slate-500">Precio por m²</td><td className="text-right text-xs text-slate-400">{num(ppm2)} €/m²</td></tr>
            )}
            {c?.deposit ? (
              <tr><td className="text-xs text-slate-500">Fianza (una vez)</td><td className="text-right text-xs text-slate-400">{eur(c.deposit)}</td></tr>
            ) : null}
          </tfoot>
        </table>
      </section>

      {/* Travel times to POIs */}
      <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-white">Tiempos a puntos de interés</h2>
          <Link to="/settings" className="text-xs text-sky-400">Gestionar POIs</Link>
        </div>
        {pois.length === 0 ? (
          <p className="text-sm text-slate-500">Añade puntos de interés en Ajustes (trabajo, gimnasio, centro…).</p>
        ) : (
          <div className="space-y-4">
            {pois.map((poi) => (
              <div key={poi.id}>
                <p className="mb-1 text-sm font-medium text-slate-200">{poi.label}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TRAVEL_MODES.map((m) => {
                    const mins = timeOf(poi.id, m.mode)
                    return (
                      <div key={m.mode} className="rounded-lg bg-slate-800/70 p-2">
                        <a href={directionsUrl(flat, poi, m.mode)} target="_blank" rel="noreferrer"
                          className="flex items-center justify-between text-xs text-sky-300 hover:underline">
                          <span>{m.emoji} {m.label}</span><span>↗</span>
                        </a>
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            type="number" inputMode="numeric" placeholder="min"
                            defaultValue={mins ?? ''}
                            onBlur={(e) => {
                              const val = e.target.value === '' ? null : Number(e.target.value)
                              if (val !== mins) void setPoiTime(flat.id, poi.id, m.mode, val)
                            }}
                            className="w-full rounded bg-slate-900 px-1.5 py-1 text-center text-xs text-white ring-1 ring-slate-700"
                          />
                          <span className="text-[10px] text-slate-500">min</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={nearbyUrl(flat, 'bares restaurantes')} target="_blank" rel="noreferrer"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🍻 Bares/restaurantes cerca</a>
          <a href={nearbyUrl(flat, 'parques')} target="_blank" rel="noreferrer"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🌳 Parques cerca</a>
          <a href={nearbyUrl(flat, 'supermercado')} target="_blank" rel="noreferrer"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🛒 Supermercados cerca</a>
        </div>
      </section>

      {/* Notes */}
      {flat.notes && (
        <section className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-300 ring-1 ring-slate-800">
          <h2 className="mb-2 font-semibold text-white">Notas</h2>
          <p className="whitespace-pre-wrap">{flat.notes}</p>
        </section>
      )}

      {/* Scoring */}
      <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="mb-3 font-semibold text-white">Puntuar este piso</h2>
        <ScoreEditor flatId={flat.id} />
      </section>

      <button
        onClick={async () => { if (confirm('¿Eliminar este piso y sus fotos?')) { await deleteFlat(flat.id); navigate('/') } }}
        className="w-full rounded-lg bg-red-500/10 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20">
        Eliminar piso
      </button>
    </div>
  )
}
