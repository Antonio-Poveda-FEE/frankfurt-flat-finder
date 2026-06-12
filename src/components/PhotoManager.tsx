import { useRef, useState } from 'react'
import { useStore } from '../store/DataContext'
import { photoUrl } from '../lib/supabase'
import { useDragReorder } from '../lib/useDragReorder'
import { useT } from '../lib/i18n'

export default function PhotoManager({ flatId }: { flatId: string }) {
  const { photos, uploadPhotos, deletePhoto, setPrimaryPhoto, reorderPhotos } = useStore()
  const { t } = useT()
  const list = photos[flatId] ?? []
  const hasPrimary = list.some((p) => p.is_primary)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reorder = useDragReorder(list, (next) => {
    reorderPhotos(flatId, next.map((p) => p.id)).catch((err) => {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el orden.')
    })
  }, !busy)

  async function addFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    setBusy(true)
    setError(null)
    try {
      await uploadPhotos(flatId, images)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron subir las fotos.')
    } finally {
      setBusy(false)
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    const files = Array.from(e.target.files)
    e.target.value = ''
    await addFiles(files)
  }

  const run = (op: Promise<void>) => {
    setError(null)
    op.catch((err) => setError(err instanceof Error ? err.message : 'No se pudo completar la operación.'))
  }

  // Only react to OS file drags, not to internal photo-reorder drags.
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files')

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onPick} className="hidden" />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropActive(true) } }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropActive(false); void addFiles(e.dataTransfer.files) } }}
        className={`w-full rounded-lg border border-dashed py-3 text-sm transition disabled:opacity-50 ${
          dropActive ? 'border-sky-400 bg-sky-500/10 text-sky-300' : 'border-slate-600 text-slate-300 hover:bg-slate-800'
        }`}>
        {busy ? t('Subiendo…', 'Uploading…')
          : dropActive ? t('Suelta las imágenes aquí', 'Drop the images here')
          : t('📷 Añadir fotos (cámara, galería o arrastrándolas aquí)', '📷 Add photos (camera, gallery or drag them here)')}
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {list.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {reorder.list.map((p, index) => {
              const primary = p.is_primary || (!hasPrimary && index === 0)
              return (
                <div key={p.id} {...reorder.itemProps(index)}
                  className={`relative aspect-square cursor-grab overflow-hidden rounded-lg bg-slate-800 ring-2 transition active:cursor-grabbing ${
                    primary ? 'ring-amber-400' : 'ring-transparent'
                  } ${reorder.isDragSource(index) ? 'opacity-40 ring-sky-400' : ''}`}>
                  <img src={photoUrl(p.storage_path)} alt="" draggable={false} className="h-full w-full select-none object-cover" />
                  <button type="button" title={primary ? t('Foto principal', 'Primary photo') : t('Hacer principal', 'Make primary')} onClick={() => run(setPrimaryPhoto(flatId, p.id))}
                    className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs">
                    <span className={primary ? 'text-amber-400' : 'text-slate-300'}>{primary ? '★' : '☆'}</span>
                  </button>
                  {primary && <span className="absolute bottom-1 left-1 rounded bg-amber-500/80 px-1 text-[9px] font-bold text-black">{t('PRINCIPAL', 'PRIMARY')}</span>}
                  <button type="button" onClick={() => run(deletePhoto(p))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white">✕</button>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-500">
            {t('Pulsa la ★ para elegir la foto principal (la que se ve en la lista). Arrastra una foto para cambiar el orden de la galería.',
               'Tap the ★ to choose the primary photo (shown in the list). Drag a photo to change the gallery order.')}
          </p>
        </>
      )}
    </div>
  )
}
