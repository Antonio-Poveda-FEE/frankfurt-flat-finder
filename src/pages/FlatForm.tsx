import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useStore } from '../store/DataContext'
import { useGeocode } from '../lib/useGeocode'
import { useDragReorder } from '../lib/useDragReorder'
import { useT } from '../lib/i18n'
import { COST_FIELDS, STATUS_META } from '../lib/types'
import type { Flat, FlatCosts, FlatStatus } from '../lib/types'
import PhotoManager from '../components/PhotoManager'

const emptyForm = {
  title: '', address: '', lat: '', lng: '', size_m2: '', rooms: '',
  status: 'candidate' as FlatStatus, listing_url: '', available_from: '', visited_on: '', visit_time: '', notes: '',
}

export default function FlatForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { flats, costs, createFlat, updateFlat, saveCosts, uploadPhotos, readOnly } = useStore()
  const { t } = useT()
  const geocode = useGeocode()

  const [form, setForm] = useState(emptyForm)
  const [cost, setCost] = useState<Record<string, string>>({})
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([])
  const [primaryIndex, setPrimaryIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [geo, setGeo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const pendingPhotoPreviews = useMemo(
    () => pendingPhotos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [pendingPhotos]
  )
  const photoReorder = useDragReorder(pendingPhotoPreviews, (next) => {
    // The cover follows its file to the new position.
    const primaryFile = pendingPhotos[primaryIndex]
    const files = next.map((p) => p.file)
    setPendingPhotos(files)
    setPrimaryIndex(Math.max(0, files.indexOf(primaryFile)))
  }, !busy)

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
        visit_time: f.visit_time?.slice(0, 5) ?? '',
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

  useEffect(() => {
    return () => {
      for (const preview of pendingPhotoPreviews) URL.revokeObjectURL(preview.url)
    }
  }, [pendingPhotoPreviews])

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  function addPendingFiles(files: FileList | File[]) {
    const added = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (added.length) setPendingPhotos((current) => [...current, ...added])
  }

  function addPendingPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    // Capture the files synchronously: clearing the input below empties
    // e.target.files, and React may run the state updater afterwards (so reading
    // e.target.files inside it would lose the selection — the iOS "can't add
    // photos" bug, worse after other fields re-rendered the form).
    const added = Array.from(e.target.files)
    e.target.value = ''
    addPendingFiles(added)
  }

  function removePendingPhoto(index: number) {
    setPendingPhotos((current) => current.filter((_, i) => i !== index))
    setPrimaryIndex((p) => (index === p ? 0 : index < p ? p - 1 : p))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
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
      const currentFlat = id ? flats.find((x) => x.id === id) : null
      if (form.visit_time || (currentFlat && 'visit_time' in currentFlat)) {
        payload.visit_time = form.visit_time || null
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
        if (flatId) {
          await saveCosts(flatId, costPayload)
          if (pendingPhotos.length > 0) await uploadPhotos(flatId, pendingPhotos, { primaryIndex })
        }
      }
      if (flatId) navigate(`/flat/${flatId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el piso.')
    } finally {
      setBusy(false)
    }
  }

  const input = 'block w-full min-w-0 rounded-lg bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500'
  // Native iOS date/time controls size themselves differently; appearance-none normalises them to match the other fields.
  const dateInput = `${input} appearance-none [&::-webkit-date-and-time-value]:text-left [&::-webkit-calendar-picker-indicator]:opacity-60`
  const label = 'mb-1 block text-xs font-medium text-slate-400'

  if (readOnly) {
    return (
      <div className="rounded-2xl bg-slate-900 p-6 text-center text-slate-400 ring-1 ring-slate-800">
        <p className="mb-3">👁️ {t('Modo invitado: solo lectura. No puedes añadir ni editar pisos.', 'Guest mode: read-only. You cannot add or edit flats.')}</p>
        <Link to="/" className="inline-block rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white">{t('Volver', 'Back')}</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-lg font-bold text-white">{editing ? t('Editar piso', 'Edit flat') : t('Nuevo piso', 'New flat')}</h1>

      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <div>
          <label className={label}>{t('Título', 'Title')} *</label>
          <input required value={form.title} onChange={set('title')} placeholder={t('p.ej. Bockenheim 3 hab.', 'e.g. Bockenheim 3 rooms')} className={input} />
        </div>
        <div>
          <label className={label}>{t('Dirección', 'Address')}</label>
          <input value={form.address} onChange={set('address')} placeholder={t('Calle, número, 60486 Frankfurt', 'Street, number, 60486 Frankfurt')} className={input} />
          <div className="mt-1 flex items-center gap-2">
            {geocode && (
              <button type="button" onClick={lookupCoords} disabled={!form.address.trim()}
                className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-sky-300 ring-1 ring-slate-700 disabled:opacity-40">
                📍 {t('Obtener coordenadas', 'Get coordinates')}
              </button>
            )}
            <span className="text-[11px] text-slate-500">
              {geo === 'buscando' ? t('Buscando…', 'Searching…')
                : geo === 'ok' ? t('✓ Coordenadas obtenidas', '✓ Coordinates found')
                : geo === 'error' ? t('⚠ No encontradas', '⚠ Not found')
                : geocode ? t('Se geocodifica sola al guardar.', 'Auto-geocoded on save.') : t('Añade lat/lng para los mapas (opcional).', 'Add lat/lng for maps (optional).')}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>{t('Latitud', 'Latitude')}</label><input value={form.lat} onChange={set('lat')} inputMode="decimal" placeholder="50.118" className={input} /></div>
          <div><label className={label}>{t('Longitud', 'Longitude')}</label><input value={form.lng} onChange={set('lng')} inputMode="decimal" placeholder="8.652" className={input} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>{t('Tamaño (m²)', 'Size (m²)')}</label><input value={form.size_m2} onChange={set('size_m2')} inputMode="decimal" className={input} /></div>
          <div><label className={label}>{t('Habitaciones', 'Rooms')}</label><input value={form.rooms} onChange={set('rooms')} inputMode="decimal" className={input} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{t('Estado', 'Status')}</label>
            <select value={form.status} onChange={set('status')} className={input}>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{t(v.label, v.labelEn)}</option>)}
            </select>
          </div>
          <div className="min-w-0"><label className={label}>{t('Disponible desde', 'Available from')}</label><input type="date" value={form.available_from} onChange={set('available_from')} className={dateInput} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0"><label className={label}>{t('Fecha de visita', 'Visit date')}</label><input type="date" value={form.visited_on} onChange={set('visited_on')} className={dateInput} /></div>
          <div className="min-w-0"><label className={label}>{t('Hora de visita', 'Visit time')}</label><input type="time" value={form.visit_time} onChange={set('visit_time')} className={dateInput} /></div>
        </div>
        <div>
          <label className={label}>{t('Enlace ImmoScout24', 'ImmoScout24 link')}</label>
          <input value={form.listing_url} onChange={set('listing_url')} placeholder="https://…" className={input} />
        </div>
        <div>
          <label className={label}>{t('Notas', 'Notes')}</label>
          <textarea value={form.notes} onChange={set('notes')} rows={3} className={input} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="font-semibold text-white">{t('Costes', 'Costs')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {COST_FIELDS.map(({ key, label: l, labelEn }) => (
            <div key={key}>
              <label className={label}>{t(l, labelEn)} (€)</label>
              <input inputMode="decimal" value={cost[key] ?? ''} onChange={(e) => setCost({ ...cost, [key]: e.target.value })} className={input} />
            </div>
          ))}
        </div>
      </section>

      {editing && id && (
        <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
          <h2 className="font-semibold text-white">{t('Fotos', 'Photos')}</h2>
          <PhotoManager flatId={id} />
        </section>
      )}

      {!editing && (
        <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
          <h2 className="font-semibold text-white">{t('Fotos', 'Photos')}</h2>
          <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={addPendingPhotos} className="hidden" />
          <button type="button" onClick={() => photoInputRef.current?.click()} disabled={busy}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropActive(true) } }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropActive(false); addPendingFiles(e.dataTransfer.files) } }}
            className={`w-full rounded-lg border border-dashed py-3 text-sm transition disabled:opacity-50 ${
              dropActive ? 'border-sky-400 bg-sky-500/10 text-sky-300' : 'border-slate-600 text-slate-300 hover:bg-slate-800'
            }`}>
            {dropActive ? t('Suelta las imágenes aquí', 'Drop the images here') : `📷 ${t('Añadir fotos (cámara, galería o arrastrándolas aquí)', 'Add photos (camera, gallery or drag them here)')}`}
          </button>
          {pendingPhotoPreviews.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {photoReorder.list.map(({ file, url }, index) => {
                  const primary = file === pendingPhotos[primaryIndex]
                  return (
                    <div key={url} {...photoReorder.itemProps(index)}
                      className={`relative aspect-square cursor-grab overflow-hidden rounded-lg bg-slate-800 ring-2 transition active:cursor-grabbing ${
                        primary ? 'ring-amber-400' : 'ring-slate-700'
                      } ${photoReorder.isDragSource(index) ? 'opacity-40 ring-sky-400' : ''}`}>
                      <img src={url} alt="" draggable={false} className="h-full w-full select-none object-cover" />
                      <button type="button" title={primary ? t('Foto principal', 'Cover photo') : t('Hacer principal', 'Make cover')} onClick={() => setPrimaryIndex(pendingPhotos.indexOf(file))}
                        className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs">
                        <span className={primary ? 'text-amber-400' : 'text-slate-300'}>{primary ? '★' : '☆'}</span>
                      </button>
                      {primary && <span className="absolute bottom-1 left-1 rounded bg-amber-500/80 px-1 text-[9px] font-bold text-black">{t('PORTADA', 'COVER')}</span>}
                      <button type="button" onClick={() => removePendingPhoto(pendingPhotos.indexOf(file))}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white">×</button>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                {t('Se subirán al guardar el piso. Pulsa la ★ para elegir la portada (por defecto la primera) y arrastra las fotos para cambiar su orden.', 'They upload when you save the flat. Tap the ★ to choose the cover (the first one by default) and drag the photos to reorder them.')}
              </p>
            </>
          )}
        </section>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => navigate(-1)} className="flex-1 rounded-lg bg-slate-800 py-2.5 font-medium text-slate-300">{t('Cancelar', 'Cancel')}</button>
        <button disabled={busy} className="flex-1 rounded-lg bg-sky-500 py-2.5 font-semibold text-white disabled:opacity-50">
          {busy ? (pendingPhotos.length > 0 ? t('Guardando y subiendo…', 'Saving and uploading…') : t('Guardando…', 'Saving…')) : t('Guardar', 'Save')}
        </button>
      </div>
      {error && <p className="text-center text-sm text-red-300">{error}</p>}
    </form>
  )
}
