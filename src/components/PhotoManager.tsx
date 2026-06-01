import { useRef, useState } from 'react'
import { useStore } from '../store/DataContext'
import { photoUrl } from '../lib/supabase'

export default function PhotoManager({ flatId }: { flatId: string }) {
  const { photos, uploadPhotos, deletePhoto, setPrimaryPhoto } = useStore()
  const list = photos[flatId] ?? []
  const hasPrimary = list.some((p) => p.is_primary)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    setBusy(true)
    await uploadPhotos(flatId, e.target.files)
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" onChange={onPick} className="hidden" />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        className="w-full rounded-lg border border-dashed border-slate-600 py-3 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">
        {busy ? 'Subiendo…' : '📷 Añadir fotos (cámara o galería)'}
      </button>
      {list.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {list.map((p) => {
              const primary = p.is_primary || (!hasPrimary && p === list[0])
              return (
                <div key={p.id} className={`relative aspect-square overflow-hidden rounded-lg bg-slate-800 ring-2 ${primary ? 'ring-amber-400' : 'ring-transparent'}`}>
                  <img src={photoUrl(p.storage_path)} alt="" className="h-full w-full object-cover" />
                  <button type="button" title={primary ? 'Foto principal' : 'Hacer principal'} onClick={() => setPrimaryPhoto(flatId, p.id)}
                    className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs">
                    <span className={primary ? 'text-amber-400' : 'text-slate-300'}>{primary ? '★' : '☆'}</span>
                  </button>
                  {primary && <span className="absolute bottom-1 left-1 rounded bg-amber-500/80 px-1 text-[9px] font-bold text-black">PRINCIPAL</span>}
                  <button type="button" onClick={() => deletePhoto(p)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white">✕</button>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-500">Pulsa la ★ para elegir la foto principal (la que se ve en la lista).</p>
        </>
      )}
    </div>
  )
}
