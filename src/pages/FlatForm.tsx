import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/DataContext'
import { useGeocode } from '../lib/useGeocode'
import { COST_FIELDS, STATUS_META } from '../lib/types'
import type { Flat, FlatCosts, FlatStatus } from '../lib/types'
import PhotoManager from '../components/PhotoManager'

const emptyForm = {
  title: '', address: '', lat: '', lng: '', size_m2: '', rooms: '',
  status: 'candidate' as FlatStatus, listing_url: '', available_from: '', visited_on: '', notes: '',
}

export default function FlatForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { flats, costs, createFlat, updateFlat, saveCosts } = useStore()
  const geocode = useGeocode()

  const [form, setForm] = useState(emptyForm)
  const [cost, setCost] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [geo, setGeo] = useState<string | null>(null)

  async function lookupCoords() {
    if (!geocode || !form.address.trim()) return
    setGeo('buscando')
    const c = await geocode(form.address.trim())
    if (c) {
      setForm((f) => ({ ...f, lat: c.lat.toFixed(6), lng: c.lng.toFixed(6) }))
      setGeo('ok')
    } else {
      setGeo('error')
    }
  }

  useEffect(() => {
    if (!editing) return
    const f = flats.find((x) => x.id === id)
    if (f) {
      setForm({
        title: f.title, address: f.address ?? '', lat: f.lat?.toString() ?? '', lng: f.lng?.toString() ?? '',
        size_m2: f.size_m2?.toString() ?? '', rooms: f.rooms?.toString() ?? '', status: f.status,
        listing_url: f.listing_url ?? '', available_from: f.available_from ?? '', visited_on: f.visited_on ?? '',
        notes: f.notes ?? '',
      })
      const c = costs[id!]
      if (c) {
        const o: Record<string, string> = {}
        for (const { key } of COST_FIELDS) o[key] = (c[key] ?? '').toString()
        setCost(o)
      }
    }
  }, [editing, id, flats, costs])

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    // Auto-geocode if we have an address but no coordinates yet.
    let lat = form.lat ? Number(form.lat) : null
    let lng = form.lng ? Number(form.lng) : null
    if ((lat == null || lng == null) && geocode && form.address.trim()) {
      const c = await geocode(form.address.trim())
      if (c) { lat = c.lat; lng = c.lng }
    }
    const payload: Partial<Flat> = {
      title: form.title.trim(),
      address: form.address.trim() || null,
      lat,
      lng,
      size_m2: form.size_m2 ? Number(form.size_m2) : null,
      rooms: form.rooms ? Number(form.rooms) : null,
      status: form.status,
      listing_url: form.listing_url.trim() || null,
      available_from: form.available_from || null,
      visited_on: form.visited_on || null,
      notes: form.notes.trim() || null,
    }
    const costPayload: Partial<FlatCosts> = {}
    for (const { key } of COST_FIELDS) costPayload[key] = cost[key] ? Number(cost[key]) : 0

    let flatId = id
    if (editing && id) {
      await updateFlat(id, payload)
      await saveCosts(id, costPayload)
    } else {
      const created = await createFlat(payload)
      flatId = created?.id
      if (flatId) await saveCosts(flatId, costPayload)
    }
    setBusy(false)
    if (flatId) navigate(`/flat/${flatId}`)
  }

  const input = 'w-full rounded-lg bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500'
  const label = 'mb-1 block text-xs font-medium text-slate-400'

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-lg font-bold text-white">{editing ? 'Editar piso' : 'Nuevo piso'}</h1>

      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <div>
          <label className={label}>Título *</label>
          <input required value={form.title} onChange={set('title')} placeholder="p.ej. Bockenheim 3 hab." className={input} />
        </div>
        <div>
          <label className={label}>Dirección</label>
          <input value={form.address} onChange={set('address')} placeholder="Calle, número, 60486 Frankfurt" className={input} />
          <div className="mt-1 flex items-center gap-2">
            {geocode && (
              <button type="button" onClick={lookupCoords} disabled={!form.address.trim()}
                className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-sky-300 ring-1 ring-slate-700 disabled:opacity-40">
                📍 Obtener coordenadas
              </button>
            )}
            <span className="text-[11px] text-slate-500">
              {geo === 'buscando' ? 'Buscando…'
                : geo === 'ok' ? '✓ Coordenadas obtenidas'
                : geo === 'error' ? '⚠ No encontradas'
                : geocode ? 'Se geocodifica sola al guardar.' : 'Añade lat/lng para los mapas (opcional).'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Latitud</label><input value={form.lat} onChange={set('lat')} inputMode="decimal" placeholder="50.118" className={input} /></div>
          <div><label className={label}>Longitud</label><input value={form.lng} onChange={set('lng')} inputMode="decimal" placeholder="8.652" className={input} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Tamaño (m²)</label><input value={form.size_m2} onChange={set('size_m2')} inputMode="decimal" className={input} /></div>
          <div><label className={label}>Habitaciones</label><input value={form.rooms} onChange={set('rooms')} inputMode="decimal" className={input} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Estado</label>
            <select value={form.status} onChange={set('status')} className={input}>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div><label className={label}>Disponible desde</label><input type="date" value={form.available_from} onChange={set('available_from')} className={input} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Visitado el</label><input type="date" value={form.visited_on} onChange={set('visited_on')} className={input} /></div>
          <div><label className={label}>Enlace ImmoScout24</label><input value={form.listing_url} onChange={set('listing_url')} placeholder="https://…" className={input} /></div>
        </div>
        <div>
          <label className={label}>Notas</label>
          <textarea value={form.notes} onChange={set('notes')} rows={3} className={input} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="font-semibold text-white">Costes</h2>
        <div className="grid grid-cols-2 gap-3">
          {COST_FIELDS.map(({ key, label: l }) => (
            <div key={key}>
              <label className={label}>{l} (€)</label>
              <input inputMode="decimal" value={cost[key] ?? ''} onChange={(e) => setCost({ ...cost, [key]: e.target.value })} className={input} />
            </div>
          ))}
        </div>
      </section>

      {editing && id && (
        <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
          <h2 className="font-semibold text-white">Fotos</h2>
          <PhotoManager flatId={id} />
        </section>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => navigate(-1)} className="flex-1 rounded-lg bg-slate-800 py-2.5 font-medium text-slate-300">Cancelar</button>
        <button disabled={busy} className="flex-1 rounded-lg bg-sky-500 py-2.5 font-semibold text-white disabled:opacity-50">
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {!editing && <p className="text-center text-[11px] text-slate-500">Podrás añadir fotos tras guardar.</p>}
    </form>
  )
}
