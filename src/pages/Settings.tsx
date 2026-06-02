import { useEffect, useState } from 'react'
import { useStore } from '../store/DataContext'
import { useGeocode } from '../lib/useGeocode'

export default function Settings() {
  const {
    pois, criteria, settings,
    createPoi, deletePoi, createCriterion, updateCriterion, deleteCriterion, saveSettings,
  } = useStore()
  const geocode = useGeocode()

  // POI form
  const [poiLabel, setPoiLabel] = useState('')
  const [poiAddr, setPoiAddr] = useState('')
  const [poiEmoji, setPoiEmoji] = useState('📍')

  // Criterion form
  const [critName, setCritName] = useState('')
  const [critCat, setCritCat] = useState('Interior')
  const [critWeight, setCritWeight] = useState('1')

  // Settings local mirror
  const [n, setN] = useState(settings.planned_visits.toString())
  const [k, setK] = useState(settings.significance_k.toString())
  const [thr, setThr] = useState(settings.improvement_threshold.toString())
  const [pw, setPw] = useState(settings.price_weight.toString())
  useEffect(() => {
    setN(settings.planned_visits.toString())
    setK(settings.significance_k.toString())
    setThr(settings.improvement_threshold.toString())
    setPw(settings.price_weight.toString())
  }, [settings])

  const input = 'rounded-lg bg-slate-800 px-3 py-2 text-white text-sm outline-none ring-1 ring-slate-700 focus:ring-sky-500'

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-white">Ajustes</h1>

      {/* Statistical parameters */}
      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="font-semibold text-white">Parámetros de decisión</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Pisos que planeáis ver (N)</span>
            <input className={`w-full ${input}`} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Umbral significancia (k·σ)</span>
            <input className={`w-full ${input}`} inputMode="decimal" value={k} onChange={(e) => setK(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Mejora mínima para seguir (pts)</span>
            <input className={`w-full ${input}`} inputMode="decimal" value={thr} onChange={(e) => setThr(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Peso del precio</span>
            <input className={`w-full ${input}`} inputMode="decimal" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
        </div>
        <button
          onClick={() => saveSettings({
            planned_visits: Math.max(1, parseInt(n) || 1),
            significance_k: parseFloat(k) || 0,
            improvement_threshold: parseFloat(thr) || 0,
            price_weight: Math.max(0, parseFloat(pw) || 0),
          })}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white">Guardar parámetros</button>
        <p className="text-[11px] text-slate-500">
          N alimenta la regla del 37%. k define cuánto debe destacar un piso (z-score) para considerarse claramente mejor.
          La mejora mínima decide cuándo dejar de buscar. El <b>peso del precio</b> es cuánto pesa el coste mensual en la nota
          global (en la misma escala que los pesos de los criterios; 0 = ignorar el precio).
        </p>
      </section>

      {/* POIs */}
      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="font-semibold text-white">Puntos de interés</h2>
        <p className="text-[11px] text-slate-500">Trabajo, gimnasio, centro… Se usan para calcular tiempos de ida desde cada piso.</p>
        <ul className="space-y-2">
          {pois.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">{p.emoji || '📍'}</span>
                <div><span className="text-slate-100">{p.label}</span>{p.address && <span className="block text-xs text-slate-500">{p.address}</span>}</div>
              </div>
              <button onClick={() => deletePoi(p.id)} className="text-xs text-red-400">Eliminar</button>
            </li>
          ))}
          {pois.length === 0 && <li className="text-sm text-slate-500">Aún no hay puntos de interés.</li>}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={`w-16 text-center text-lg ${input}`} maxLength={4} aria-label="Emoji" value={poiEmoji} onChange={(e) => setPoiEmoji(e.target.value)} />
          <input className={`flex-1 ${input}`} placeholder="Nombre (p.ej. Trabajo de Toni)" value={poiLabel} onChange={(e) => setPoiLabel(e.target.value)} />
          <input className={`flex-1 ${input}`} placeholder="Dirección" value={poiAddr} onChange={(e) => setPoiAddr(e.target.value)} />
          <button
            disabled={!poiLabel.trim()}
            onClick={async () => {
              const addr = poiAddr.trim()
              let coords: { lat: number; lng: number } | null = null
              if (geocode && addr) coords = await geocode(addr)
              await createPoi({ label: poiLabel.trim(), address: addr || null, emoji: poiEmoji.trim() || '📍', lat: coords?.lat ?? null, lng: coords?.lng ?? null })
              setPoiLabel(''); setPoiAddr(''); setPoiEmoji('📍')
            }}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Añadir</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {['🏢','💼','🏋️','🏙️','🚉','🏥','🎓','🛒','👨‍👩‍👧','🌳'].map((e) => (
            <button key={e} type="button" onClick={() => setPoiEmoji(e)} className="rounded bg-slate-800 px-2 py-1 text-lg hover:bg-slate-700">{e}</button>
          ))}
        </div>
      </section>

      {/* Criteria */}
      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="font-semibold text-white">Criterios de puntuación y pesos</h2>
        <ul className="space-y-2">
          {criteria.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
              <span className="flex-1 text-slate-100">{c.name}<span className="ml-1 text-[11px] text-slate-500">{c.category}</span></span>
              <label className="flex items-center gap-1 text-xs text-slate-400">
                peso
                <input
                  type="number" step="0.1" min="0" defaultValue={c.weight}
                  onBlur={(e) => { const w = parseFloat(e.target.value); if (!Number.isNaN(w) && w !== c.weight) void updateCriterion(c.id, { weight: w }) }}
                  className="w-16 rounded bg-slate-900 px-2 py-1 text-center text-white ring-1 ring-slate-700"
                />
              </label>
              <button onClick={() => deleteCriterion(c.id)} className="text-xs text-red-400">✕</button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={`flex-1 ${input}`} placeholder="Nuevo criterio" value={critName} onChange={(e) => setCritName(e.target.value)} />
          <select className={input} value={critCat} onChange={(e) => setCritCat(e.target.value)}>
            <option>Interior</option><option>Entorno</option><option>Valor</option><option>Otros</option>
          </select>
          <input className={`w-24 ${input}`} inputMode="decimal" placeholder="peso" value={critWeight} onChange={(e) => setCritWeight(e.target.value)} />
          <button
            disabled={!critName.trim()}
            onClick={async () => {
              const maxOrder = criteria.reduce((m, c) => Math.max(m, c.sort_order), 0)
              await createCriterion({ name: critName.trim(), category: critCat, weight: parseFloat(critWeight) || 1, scale_max: 10, sort_order: maxOrder + 10 })
              setCritName(''); setCritWeight('1')
            }}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Añadir</button>
        </div>
      </section>
    </div>
  )
}
