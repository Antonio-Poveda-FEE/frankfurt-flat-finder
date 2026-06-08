import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useStore } from '../store/DataContext'
import { computeGlobalScores } from '../lib/stats'
import { monthlyTotal, pricePerM2 } from '../lib/costs'
import { eur, eur2, num, scoreColor } from '../lib/format'
import { photoUrl } from '../lib/supabase'
import { directionsUrl, nearbyUrl, placeUrl } from '../lib/maps'
import { distanceMatrix, gMode } from '../lib/geocode'
import { hasMaps } from '../lib/config'
import { COST_FIELDS, STATUS_META, TRAVEL_MODES } from '../lib/types'
import type { TravelMode } from '../lib/types'
import type { NearbyCategory } from '../lib/places'
import ScoreEditor from '../components/ScoreEditor'
import NearbyMap from '../components/NearbyMap'
import { useT } from '../lib/i18n'

export default function FlatDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { flats, costs, photos, pois, poiTimes, criteria, scores, settings, setPoiTime, bulkSetPoiTimes, deleteFlat, readOnly } = useStore()
  const { t } = useT()
  const flat = flats.find((f) => f.id === id)
  const routesLib = useMapsLibrary('routes')
  const [nearbyCat, setNearbyCat] = useState<NearbyCategory | null>(null)
  const [calculating, setCalculating] = useState(false)
  const autoTried = useRef<string | null>(null)

  const scoreMap = useMemo(() => computeGlobalScores(flats, costs, criteria, scores, settings), [flats, costs, criteria, scores, settings])

  const times = flat ? (poiTimes[flat.id] ?? []) : []
  const poisWithCoords = pois.filter((p) => p.lat != null && p.lng != null)
  const canCalc = hasMaps() && routesLib != null && flat?.lat != null && flat?.lng != null

  // Compute travel time for every mode to every located POI (4 Distance Matrix calls).
  const runCalc = useCallback(async () => {
    if (!flat || !routesLib || flat.lat == null || flat.lng == null) return
    const dests = pois.filter((p) => p.lat != null && p.lng != null)
    if (dests.length === 0) return
    setCalculating(true)
    const origin = { lat: flat.lat, lng: flat.lng }
    const dm = new routesLib.DistanceMatrixService()
    const rows: { poiId: string; mode: TravelMode; minutes: number | null; distance_m: number | null }[] = []
    for (const m of TRAVEL_MODES) {
      const results = await distanceMatrix(dm, origin, dests.map((d) => ({ lat: d.lat!, lng: d.lng! })), gMode(m.mode))
      results.forEach((r, i) => rows.push({ poiId: dests[i].id, mode: m.mode, minutes: r?.minutes ?? null, distance_m: r?.meters ?? null }))
    }
    await bulkSetPoiTimes(flat.id, rows)
    setCalculating(false)
  }, [flat, routesLib, pois, bulkSetPoiTimes])

  // Auto-calculate once per flat when coordinates + POIs are available and times are missing.
  useEffect(() => {
    if (!flat || !canCalc || readOnly || poisWithCoords.length === 0) return
    const haveAll = poisWithCoords.every((p) => TRAVEL_MODES.every((m) => times.some((t) => t.poi_id === p.id && t.mode === m.mode && t.auto)))
    if (haveAll || autoTried.current === flat.id) return
    autoTried.current = flat.id
    void runCalc()
  }, [flat, canCalc, readOnly, poisWithCoords.length, times.length, runCalc])

  if (!flat) return <p className="text-slate-400">Piso no encontrado. <Link className="text-sky-400" to="/">Volver</Link></p>

  const gs = scoreMap.get(flat.id)
  const score = gs?.valueAdjusted ?? null
  const c = costs[flat.id]
  const total = monthlyTotal(c)
  const ppm2 = pricePerM2(c, flat.size_m2)
  const flatPhotos = [...(photos[flat.id] ?? [])].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
  const recOf = (poiId: string, mode: TravelMode) => times.find((t) => t.poi_id === poiId && t.mode === mode)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">{flat.title}</h1>
          {flat.address && (
            <a href={placeUrl(flat)} target="_blank" rel="noreferrer" className="text-sm text-sky-400 hover:underline">📍 {flat.address}</a>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex flex-col items-center rounded-xl bg-slate-900 px-3 py-1 ring-1 ring-slate-800" title={t('Calidad por criterios (sin precio)', 'Criteria quality (no price)')}>
            <span className="text-lg font-bold" style={{ color: scoreColor(gs?.quality ?? null) }}>{gs?.quality != null ? gs.quality.toFixed(0) : '—'}</span>
            <span className="text-[10px] text-slate-500">{t('global', 'global')}</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-slate-900 px-3 py-1 ring-1 ring-slate-800" title={t('Calidad ajustada por precio (respecto al precio de referencia en Ajustes)', 'Quality adjusted for price (relative to the reference price in Settings)')}>
            <span className="text-2xl font-bold" style={{ color: scoreColor(score) }}>{score == null ? '—' : score.toFixed(0)}</span>
            <span className="text-[10px] text-slate-500">{t('valor ★', 'value ★')}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded px-2 py-1 text-xs font-medium"
          style={{ background: `${STATUS_META[flat.status].color}22`, color: STATUS_META[flat.status].color }}>
          {t(STATUS_META[flat.status].label, STATUS_META[flat.status].labelEn)}
        </span>
        {flat.size_m2 && <span className="text-xs text-slate-400">{num(flat.size_m2, 0)} m²</span>}
        {flat.rooms && <span className="text-xs text-slate-400">· {num(flat.rooms, 0)} {t('hab.', 'rooms')}</span>}
        {flat.listing_url && <a href={flat.listing_url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">· ImmoScout24 ↗</a>}
        {!readOnly && <Link to={`/flat/${flat.id}/edit`} className="ml-auto rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">{t('Editar', 'Edit')}</Link>}
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
        <h2 className="mb-3 font-semibold text-white">{t('Costes', 'Costs')}</h2>
        <table className="w-full text-sm">
          <tbody>
            {COST_FIELDS.map(({ key, label, labelEn, recurring }) => {
              const v = c?.[key] ?? 0
              if (!v) return null
              return (
                <tr key={key} className="border-b border-slate-800/60">
                  <td className="py-1.5 text-slate-400">{t(label, labelEn)}{!recurring && <span className="text-[10px] text-slate-600"> {t('(única)', '(one-off)')}</span>}</td>
                  <td className="py-1.5 text-right text-slate-200">{eur2(v)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-700">
              <td className="pt-2 font-semibold text-white">{t('Total mensual', 'Monthly total')}</td>
              <td className="pt-2 text-right font-bold text-sky-400">{eur(total)}</td>
            </tr>
            {ppm2 != null && (
              <tr><td className="text-xs text-slate-500">{t('Precio por m²', 'Price per m²')}</td><td className="text-right text-xs text-slate-400">{num(ppm2)} €/m²</td></tr>
            )}
            {c?.deposit ? (
              <tr><td className="text-xs text-slate-500">{t('Fianza (una vez)', 'Deposit (one-off)')}</td><td className="text-right text-xs text-slate-400">{eur(c.deposit)}</td></tr>
            ) : null}
          </tfoot>
        </table>
      </section>

      {/* Travel times to POIs */}
      <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-white">{t('Tiempos a puntos de interés', 'Times to points of interest')}</h2>
          <div className="flex items-center gap-2">
            {canCalc && !readOnly && poisWithCoords.length > 0 && (
              <button type="button" onClick={() => { autoTried.current = flat.id; void runCalc() }} disabled={calculating}
                className="rounded-md bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-500 disabled:opacity-50">
                {calculating ? t('Calculando…', 'Calculating…') : t('🔄 Calcular tiempos', '🔄 Calculate times')}
              </button>
            )}
            <Link to="/settings" className="text-xs text-sky-400">POIs</Link>
          </div>
        </div>
        {pois.length === 0 ? (
          <p className="text-sm text-slate-500">{t('Añade puntos de interés en Ajustes (trabajo, gimnasio, centro…).', 'Add points of interest in Settings (work, gym, centre…).')}</p>
        ) : (
          <div className="space-y-4">
            {!canCalc && hasMaps() && (flat.lat == null || flat.lng == null) && (
              <p className="text-xs text-amber-400">{t('Este piso no tiene coordenadas: edítalo y pulsa «Obtener coordenadas» para calcular los tiempos automáticamente.', 'This flat has no coordinates: edit it and press “Get coordinates” to calculate times automatically.')}</p>
            )}
            {pois.map((poi) => {
              const noCoords = poi.lat == null || poi.lng == null
              return (
              <div key={poi.id}>
                <p className="mb-1 text-sm font-medium text-slate-200">
                  {poi.emoji ? `${poi.emoji} ` : ''}{poi.label}
                  {noCoords && <span className="ml-2 text-[10px] text-amber-400">{t('sin dirección/coordenadas', 'no address/coordinates')}</span>}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TRAVEL_MODES.map((m) => {
                    const rec = recOf(poi.id, m.mode)
                    const mins = rec?.minutes ?? null
                    return (
                      <div key={m.mode} className="rounded-lg bg-slate-800/70 p-2">
                        <a href={directionsUrl(flat, poi, m.mode)} target="_blank" rel="noreferrer"
                          className="flex items-center justify-between text-xs text-sky-300 hover:underline">
                          <span>{m.emoji} {t(m.label, m.labelEn)}</span><span>↗</span>
                        </a>
                        {canCalc ? (
                          <div className="mt-1 rounded bg-slate-900 px-1.5 py-1 text-center text-xs text-white ring-1 ring-slate-700">
                            {calculating ? '…' : mins != null ? `${mins} min` : '—'}
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center gap-1">
                            <input
                              type="number" inputMode="numeric" placeholder="min" disabled={readOnly}
                              defaultValue={mins ?? ''}
                              onBlur={(e) => {
                                const val = e.target.value === '' ? null : Number(e.target.value)
                                if (val !== mins) void setPoiTime(flat.id, poi.id, m.mode, val)
                              }}
                              className="w-full rounded bg-slate-900 px-1.5 py-1 text-center text-xs text-white ring-1 ring-slate-700 disabled:opacity-60"
                            />
                            <span className="text-[10px] text-slate-500">min</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )})}
            {canCalc && <p className="text-[11px] text-slate-500">{t('Calculado automáticamente con Google Maps. La bici/metro puede no estar disponible en algunas zonas (—).', 'Calculated automatically with Google Maps. Cycling/transit may be unavailable in some areas (—).')}</p>}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {hasMaps() ? (
            <>
              <button onClick={() => setNearbyCat('food')} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🍻 {t('Bares/restaurantes cerca', 'Bars/restaurants nearby')}</button>
              <button onClick={() => setNearbyCat('park')} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🌳 {t('Parques cerca', 'Parks nearby')}</button>
              <button onClick={() => setNearbyCat('supermarket')} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🛒 {t('Supermercados cerca', 'Supermarkets nearby')}</button>
              <button onClick={() => setNearbyCat('gym')} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🏋️ {t('Gimnasios cerca', 'Gyms nearby')}</button>
            </>
          ) : (
            <>
              <a href={nearbyUrl(flat, 'bares restaurantes')} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🍻 {t('Bares/restaurantes cerca', 'Bars/restaurants nearby')}</a>
              <a href={nearbyUrl(flat, 'parques')} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🌳 {t('Parques cerca', 'Parks nearby')}</a>
              <a href={nearbyUrl(flat, 'supermercado')} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🛒 {t('Supermercados cerca', 'Supermarkets nearby')}</a>
              <a href={nearbyUrl(flat, 'gimnasio')} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">🏋️ {t('Gimnasios cerca', 'Gyms nearby')}</a>
            </>
          )}
        </div>
      </section>

      {nearbyCat && <NearbyMap flat={flat} category={nearbyCat} onClose={() => setNearbyCat(null)} />}

      {/* Notes */}
      {flat.notes && (
        <section className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-300 ring-1 ring-slate-800">
          <h2 className="mb-2 font-semibold text-white">{t('Notas', 'Notes')}</h2>
          <p className="whitespace-pre-wrap">{flat.notes}</p>
        </section>
      )}

      {/* Scoring */}
      <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="mb-3 font-semibold text-white">{t('Puntuar este piso', 'Rate this flat')}</h2>
        <ScoreEditor flatId={flat.id} />
      </section>

      {!readOnly && (
        <button
          onClick={async () => { if (confirm(t('¿Eliminar este piso y sus fotos?', 'Delete this flat and its photos?'))) { await deleteFlat(flat.id); navigate('/') } }}
          className="w-full rounded-lg bg-red-500/10 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20">
          {t('Eliminar piso', 'Delete flat')}
        </button>
      )}
    </div>
  )
}
