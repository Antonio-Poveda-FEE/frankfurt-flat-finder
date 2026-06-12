import { useEffect, useState } from 'react'
import { useStore } from '../store/DataContext'
import { useGeocode } from '../lib/useGeocode'
import { useT } from '../lib/i18n'
import type { Poi } from '../lib/types'

const POI_EMOJIS = ['🏢','💼','🏋️','🏙️','🚉','🏥','🎓','🛒','👨‍👩‍👧','🌳']

export default function Settings() {
  const {
    pois, criteria, settings, readOnly,
    createPoi, updatePoi, deletePoi, createCriterion, updateCriterion, deleteCriterion, saveSettings,
  } = useStore()
  const geocode = useGeocode()
  const { t } = useT()

  // POI form
  const [poiLabel, setPoiLabel] = useState('')
  const [poiAddr, setPoiAddr] = useState('')
  const [poiEmoji, setPoiEmoji] = useState('📍')

  // POI edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAddr, setEditAddr] = useState('')
  const [editEmoji, setEditEmoji] = useState('📍')
  const [editBusy, setEditBusy] = useState(false)

  function startEdit(p: Poi) {
    setEditId(p.id); setEditLabel(p.label); setEditAddr(p.address ?? ''); setEditEmoji(p.emoji ?? '📍')
  }
  async function saveEdit(p: Poi) {
    setEditBusy(true)
    try {
      const addr = editAddr.trim()
      const patch: Partial<Poi> = { label: editLabel.trim(), address: addr || null, emoji: editEmoji.trim() || '📍' }
      if (!addr) { patch.lat = null; patch.lng = null }
      else if (geocode && addr !== (p.address ?? '')) { const c = await geocode(addr); patch.lat = c?.lat ?? null; patch.lng = c?.lng ?? null }
      await updatePoi(p.id, patch)
      setEditId(null)
    } finally {
      setEditBusy(false)
    }
  }

  // Criterion form
  const [critName, setCritName] = useState('')
  const [critCat, setCritCat] = useState('Interior')
  const [critWeight, setCritWeight] = useState('1')

  // Settings local mirror
  const [n, setN] = useState(settings.planned_visits.toString())
  const [k, setK] = useState(settings.significance_k.toString())
  const [thr, setThr] = useState(settings.improvement_threshold.toString())
  const [refPrice, setRefPrice] = useState(settings.reference_price?.toString() ?? '')
  const [beta, setBeta] = useState(settings.price_beta.toString())
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  useEffect(() => {
    setN(settings.planned_visits.toString())
    setK(settings.significance_k.toString())
    setThr(settings.improvement_threshold.toString())
    setRefPrice(settings.reference_price?.toString() ?? '')
    setBeta(settings.price_beta.toString())
  }, [settings])

  async function saveParams() {
    setSaveState('saving')
    try {
      const refNum = parseFloat(refPrice)
      await saveSettings({
        planned_visits: Math.max(1, parseInt(n) || 1),
        significance_k: parseFloat(k) || 0,
        improvement_threshold: parseFloat(thr) || 0,
        reference_price: Number.isFinite(refNum) && refNum > 0 ? refNum : null,
        price_beta: Math.max(0, parseFloat(beta) || 0),
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('idle')
    }
  }

  const input = 'rounded-lg bg-slate-800 px-3 py-2 text-white text-sm outline-none ring-1 ring-slate-700 focus:ring-sky-500 disabled:opacity-60'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">{t('Ajustes', 'Settings')}</h1>
        {readOnly && <span className="rounded bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-300">👁️ {t('Solo lectura', 'Read-only')}</span>}
      </div>

      {/* Statistical parameters */}
      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="font-semibold text-white">{t('Parámetros de decisión', 'Decision parameters')}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('Pisos que planeáis ver (N)', 'Flats you plan to see (N)')}</span>
            <input disabled={readOnly} className={`w-full ${input}`} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('Umbral significancia (k·σ)', 'Significance threshold (k·σ)')}</span>
            <input disabled={readOnly} className={`w-full ${input}`} inputMode="decimal" value={k} onChange={(e) => setK(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('Mejora mínima para seguir (pts)', 'Min. improvement to keep looking (pts)')}</span>
            <input disabled={readOnly} className={`w-full ${input}`} inputMode="decimal" value={thr} onChange={(e) => setThr(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('Precio de referencia (€/mes)', 'Reference price (€/mo)')}</span>
            <input disabled={readOnly} className={`w-full ${input}`} inputMode="decimal" placeholder={t('mediana', 'median')} value={refPrice} onChange={(e) => setRefPrice(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('Sensibilidad al precio (β)', 'Price sensitivity (β)')}</span>
            <input disabled={readOnly} className={`w-full ${input}`} inputMode="decimal" value={beta} onChange={(e) => setBeta(e.target.value)} />
          </label>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-3">
            <button
              onClick={saveParams}
              disabled={saveState === 'saving'}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${saveState === 'saved' ? 'bg-emerald-500' : 'bg-sky-500 hover:bg-sky-400'}`}>
              {saveState === 'saving' ? t('Guardando…', 'Saving…')
                : saveState === 'saved' ? t('✓ Guardado', '✓ Saved')
                : t('Guardar parámetros', 'Save parameters')}
            </button>
            {saveState === 'saved' && <span className="text-xs text-emerald-400">{t('Parámetros actualizados', 'Parameters updated')}</span>}
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          {t('N alimenta la regla del 37%. k define cuánto debe destacar un piso (z-score) para considerarse claramente mejor. La mejora mínima decide cuándo dejar de buscar.',
             'N feeds the 37% rule. k defines how much a flat must stand out (z-score) to count as clearly better. The minimum improvement decides when to stop looking.')}
        </p>
        <p className="text-[11px] text-slate-500">
          {t('Puntuación «Valor» = calidad × (precio de referencia ÷ precio)^β. El precio de referencia es tu presupuesto objetivo (si lo dejas vacío se usa la mediana de los pisos). β controla cuánto pesa el precio: 0 = ignorarlo (solo calidad), 0,3–0,5 = equilibrio, 1 = calidad por euro pura.',
             'The “Value” score = quality × (reference price ÷ price)^β. The reference price is your target budget (left empty, the median across flats is used). β controls how much price matters: 0 = ignore it (quality only), 0.3–0.5 = balanced, 1 = pure quality per euro.')}
        </p>
      </section>

      {/* POIs */}
      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="font-semibold text-white">{t('Puntos de interés', 'Points of interest')}</h2>
        <p className="text-[11px] text-slate-500">{t('Trabajo, gimnasio, centro… Se usan para calcular tiempos de ida desde cada piso.', 'Work, gym, centre… Used to compute travel times from each flat.')}</p>
        <ul className="space-y-2">
          {pois.map((p) => (
            <li key={p.id} className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
              {editId === p.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input className={`w-16 text-center text-lg ${input}`} maxLength={4} aria-label="Emoji" value={editEmoji} onChange={(e) => setEditEmoji(e.target.value)} />
                    <input className={`flex-1 ${input}`} placeholder={t('Nombre', 'Name')} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                  </div>
                  <input className={`w-full ${input}`} placeholder={t('Dirección', 'Address')} value={editAddr} onChange={(e) => setEditAddr(e.target.value)} />
                  <div className="flex flex-wrap gap-1">
                    {POI_EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => setEditEmoji(e)} className="rounded bg-slate-800 px-2 py-1 text-lg hover:bg-slate-700">{e}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button disabled={!editLabel.trim() || editBusy} onClick={() => saveEdit(p)}
                      className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{editBusy ? t('Guardando…', 'Saving…') : t('Guardar', 'Save')}</button>
                    <button disabled={editBusy} onClick={() => setEditId(null)}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-50">{t('Cancelar', 'Cancel')}</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button type="button" disabled={readOnly} onClick={() => startEdit(p)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default">
                    <span className="text-lg">{p.emoji || '📍'}</span>
                    <div className="min-w-0"><span className="text-slate-100">{p.label}</span>{p.address && <span className="block truncate text-xs text-slate-500">{p.address}</span>}</div>
                  </button>
                  {!readOnly && <button onClick={() => { if (confirm(t(`¿Eliminar el punto de interés «${p.label}»?`, `Delete the point of interest “${p.label}”?`))) void deletePoi(p.id) }} className="shrink-0 text-xs text-red-400">{t('Eliminar', 'Delete')}</button>}
                </div>
              )}
            </li>
          ))}
          {pois.length === 0 && <li className="text-sm text-slate-500">{t('Aún no hay puntos de interés.', 'No points of interest yet.')}</li>}
        </ul>
        {!readOnly && pois.length > 0 && <p className="text-[11px] text-slate-500">{t('Pulsa un punto de interés para editarlo.', 'Tap a point of interest to edit it.')}</p>}
        {!readOnly && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={`w-16 text-center text-lg ${input}`} maxLength={4} aria-label="Emoji" value={poiEmoji} onChange={(e) => setPoiEmoji(e.target.value)} />
              <input className={`flex-1 ${input}`} placeholder={t('Nombre (p.ej. Trabajo de Toni)', 'Name (e.g. Toni\'s work)')} value={poiLabel} onChange={(e) => setPoiLabel(e.target.value)} />
              <input className={`flex-1 ${input}`} placeholder={t('Dirección', 'Address')} value={poiAddr} onChange={(e) => setPoiAddr(e.target.value)} />
              <button
                disabled={!poiLabel.trim()}
                onClick={async () => {
                  const addr = poiAddr.trim()
                  let coords: { lat: number; lng: number } | null = null
                  if (geocode && addr) coords = await geocode(addr)
                  await createPoi({ label: poiLabel.trim(), address: addr || null, emoji: poiEmoji.trim() || '📍', lat: coords?.lat ?? null, lng: coords?.lng ?? null })
                  setPoiLabel(''); setPoiAddr(''); setPoiEmoji('📍')
                }}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t('Añadir', 'Add')}</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {POI_EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setPoiEmoji(e)} className="rounded bg-slate-800 px-2 py-1 text-lg hover:bg-slate-700">{e}</button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Criteria */}
      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="font-semibold text-white">{t('Criterios de puntuación y pesos', 'Scoring criteria and weights')}</h2>
        <ul className="space-y-2">
          {criteria.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
              <span className="flex-1 text-slate-100">{c.name}<span className="ml-1 text-[11px] text-slate-500">{c.category}</span></span>
              <label className="flex items-center gap-1 text-xs text-slate-400">
                {t('peso', 'weight')}
                <input
                  type="number" step="0.1" min="0" defaultValue={c.weight} disabled={readOnly}
                  onBlur={(e) => { const w = parseFloat(e.target.value); if (!Number.isNaN(w) && w !== c.weight) void updateCriterion(c.id, { weight: w }) }}
                  className="w-16 rounded bg-slate-900 px-2 py-1 text-center text-white ring-1 ring-slate-700 disabled:opacity-60"
                />
              </label>
              {!readOnly && <button onClick={() => { if (confirm(t(`¿Eliminar el criterio «${c.name}» y sus puntuaciones?`, `Delete the criterion “${c.name}” and its ratings?`))) void deleteCriterion(c.id) }} className="text-xs text-red-400">✕</button>}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={`flex-1 ${input}`} placeholder={t('Nuevo criterio', 'New criterion')} value={critName} onChange={(e) => setCritName(e.target.value)} />
            <select className={input} value={critCat} onChange={(e) => setCritCat(e.target.value)}>
              <option value="Interior">{t('Interior', 'Interior')}</option>
              <option value="Entorno">{t('Entorno', 'Surroundings')}</option>
              <option value="Valor">{t('Valor', 'Value')}</option>
              <option value="Otros">{t('Otros', 'Other')}</option>
            </select>
            <input className={`w-24 ${input}`} inputMode="decimal" placeholder={t('peso', 'weight')} value={critWeight} onChange={(e) => setCritWeight(e.target.value)} />
            <button
              disabled={!critName.trim()}
              onClick={async () => {
                const maxOrder = criteria.reduce((m, c) => Math.max(m, c.sort_order), 0)
                await createCriterion({ name: critName.trim(), category: critCat, weight: parseFloat(critWeight) || 1, scale_max: 10, sort_order: maxOrder + 10 })
                setCritName(''); setCritWeight('1')
              }}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t('Añadir', 'Add')}</button>
          </div>
        )}
      </section>
    </div>
  )
}
