import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PHOTO_BUCKET } from '../lib/config'
import type {
  AppSettings, Criterion, Flat, FlatCosts, FlatPhoto, FlatPoiTime, Poi, Score, TravelMode,
} from '../lib/types'

interface StoreData {
  criteria: Criterion[]
  pois: Poi[]
  flats: Flat[]
  costs: Record<string, FlatCosts>
  photos: Record<string, FlatPhoto[]>
  poiTimes: Record<string, FlatPoiTime[]>
  scores: Score[]
  settings: AppSettings
}

interface StoreContextValue extends StoreData {
  session: Session | null
  email: string
  loading: boolean
  reloadAll: () => Promise<void>
  // flats
  createFlat: (f: Partial<Flat>) => Promise<Flat | null>
  updateFlat: (id: string, patch: Partial<Flat>) => Promise<void>
  deleteFlat: (id: string) => Promise<void>
  // costs
  saveCosts: (flatId: string, costs: Partial<FlatCosts>) => Promise<void>
  // photos
  uploadPhotos: (flatId: string, files: FileList | File[]) => Promise<void>
  deletePhoto: (photo: FlatPhoto) => Promise<void>
  setPrimaryPhoto: (flatId: string, photoId: string) => Promise<void>
  // poi times
  setPoiTime: (flatId: string, poiId: string, mode: TravelMode, minutes: number | null, opts?: { auto?: boolean; distance_m?: number | null }) => Promise<void>
  bulkSetPoiTimes: (flatId: string, rows: { poiId: string; mode: TravelMode; minutes: number | null; distance_m: number | null }[]) => Promise<void>
  // pois
  createPoi: (p: Partial<Poi>) => Promise<void>
  updatePoi: (id: string, patch: Partial<Poi>) => Promise<void>
  deletePoi: (id: string) => Promise<void>
  // criteria
  createCriterion: (c: Partial<Criterion>) => Promise<void>
  updateCriterion: (id: string, patch: Partial<Criterion>) => Promise<void>
  deleteCriterion: (id: string) => Promise<void>
  // scores
  setScore: (flatId: string, criterionId: string, value: number) => Promise<void>
  // settings
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
}

const emptySettings: AppSettings = { id: 1, planned_visits: 12, significance_k: 1, improvement_threshold: 3 }

const StoreContext = createContext<StoreContextValue | null>(null)

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

function groupBy<T>(rows: T[], key: (r: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const r of rows) (out[key(r)] ||= []).push(r)
  return out
}

export function StoreProvider({ session, children }: { session: Session; children: ReactNode }) {
  const email = session.user.email ?? 'anon'
  const [data, setData] = useState<StoreData>({
    criteria: [], pois: [], flats: [], costs: {}, photos: {}, poiTimes: {}, scores: [], settings: emptySettings,
  })
  const [loading, setLoading] = useState(true)

  const reloadAll = useCallback(async () => {
    setLoading(true)
    const [criteria, pois, flats, costs, photos, poiTimes, scores, settings] = await Promise.all([
      supabase.from('criteria').select('*').order('sort_order'),
      supabase.from('pois').select('*').order('label'),
      supabase.from('flats').select('*').order('created_at'),
      supabase.from('flat_costs').select('*'),
      supabase.from('flat_photos').select('*').order('sort_order'),
      supabase.from('flat_poi_times').select('*'),
      supabase.from('scores').select('*'),
      supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    ])
    setData({
      criteria: (criteria.data as Criterion[]) ?? [],
      pois: (pois.data as Poi[]) ?? [],
      flats: (flats.data as Flat[]) ?? [],
      costs: Object.fromEntries(((costs.data as FlatCosts[]) ?? []).map((c) => [c.flat_id, c])),
      photos: groupBy((photos.data as FlatPhoto[]) ?? [], (p) => p.flat_id),
      poiTimes: groupBy((poiTimes.data as FlatPoiTime[]) ?? [], (t) => t.flat_id),
      scores: (scores.data as Score[]) ?? [],
      settings: (settings.data as AppSettings) ?? emptySettings,
    })
    setLoading(false)
  }, [])

  useEffect(() => { void reloadAll() }, [reloadAll])

  const createFlat = useCallback(async (f: Partial<Flat>) => {
    const { data: row } = await supabase.from('flats').insert(f).select().single()
    if (row) await supabase.from('flat_costs').insert({ flat_id: (row as Flat).id })
    await reloadAll()
    return (row as Flat) ?? null
  }, [reloadAll])

  const updateFlat = useCallback(async (id: string, patch: Partial<Flat>) => {
    await supabase.from('flats').update(patch).eq('id', id)
    await reloadAll()
  }, [reloadAll])

  const deleteFlat = useCallback(async (id: string) => {
    // Remove stored photos first, then the row (cascades to costs/scores/times/photos).
    const { data: ph } = await supabase.from('flat_photos').select('storage_path').eq('flat_id', id)
    const paths = ((ph as { storage_path: string }[]) ?? []).map((p) => p.storage_path)
    if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths)
    await supabase.from('flats').delete().eq('id', id)
    await reloadAll()
  }, [reloadAll])

  const saveCosts = useCallback(async (flatId: string, costs: Partial<FlatCosts>) => {
    await supabase.from('flat_costs').upsert({ flat_id: flatId, ...costs })
    await reloadAll()
  }, [reloadAll])

  const uploadPhotos = useCallback(async (flatId: string, files: FileList | File[]) => {
    const list = Array.from(files)
    let insertedAny = false
    try {
      for (const file of list) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${flatId}/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: false })
        if (up.error) throw up.error

        const inserted = await supabase.from('flat_photos').insert({ flat_id: flatId, storage_path: path })
        if (inserted.error) throw inserted.error
        insertedAny = true
      }
    } finally {
      if (insertedAny) await reloadAll()
    }
  }, [reloadAll])

  const deletePhoto = useCallback(async (photo: FlatPhoto) => {
    await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
    await supabase.from('flat_photos').delete().eq('id', photo.id)
    await reloadAll()
  }, [reloadAll])

  const setPrimaryPhoto = useCallback(async (flatId: string, photoId: string) => {
    await supabase.from('flat_photos').update({ is_primary: false }).eq('flat_id', flatId)
    await supabase.from('flat_photos').update({ is_primary: true }).eq('id', photoId)
    await reloadAll()
  }, [reloadAll])

  const setPoiTime = useCallback(async (flatId: string, poiId: string, mode: TravelMode, minutes: number | null, opts?: { auto?: boolean; distance_m?: number | null }) => {
    await supabase.from('flat_poi_times').upsert(
      { flat_id: flatId, poi_id: poiId, mode, minutes, auto: opts?.auto ?? false, distance_m: opts?.distance_m ?? null },
      { onConflict: 'flat_id,poi_id,mode' }
    )
    await reloadAll()
  }, [reloadAll])

  const bulkSetPoiTimes = useCallback(async (flatId: string, rows: { poiId: string; mode: TravelMode; minutes: number | null; distance_m: number | null }[]) => {
    if (rows.length === 0) return
    await supabase.from('flat_poi_times').upsert(
      rows.map((r) => ({ flat_id: flatId, poi_id: r.poiId, mode: r.mode, minutes: r.minutes, distance_m: r.distance_m, auto: true })),
      { onConflict: 'flat_id,poi_id,mode' }
    )
    await reloadAll()
  }, [reloadAll])

  const createPoi = useCallback(async (p: Partial<Poi>) => { await supabase.from('pois').insert(p); await reloadAll() }, [reloadAll])
  const updatePoi = useCallback(async (id: string, patch: Partial<Poi>) => { await supabase.from('pois').update(patch).eq('id', id); await reloadAll() }, [reloadAll])
  const deletePoi = useCallback(async (id: string) => { await supabase.from('pois').delete().eq('id', id); await reloadAll() }, [reloadAll])

  const createCriterion = useCallback(async (c: Partial<Criterion>) => { await supabase.from('criteria').insert(c); await reloadAll() }, [reloadAll])
  const updateCriterion = useCallback(async (id: string, patch: Partial<Criterion>) => { await supabase.from('criteria').update(patch).eq('id', id); await reloadAll() }, [reloadAll])
  const deleteCriterion = useCallback(async (id: string) => { await supabase.from('criteria').delete().eq('id', id); await reloadAll() }, [reloadAll])

  const setScore = useCallback(async (flatId: string, criterionId: string, value: number) => {
    await supabase.from('scores').upsert(
      { flat_id: flatId, criterion_id: criterionId, scorer: email, value },
      { onConflict: 'flat_id,criterion_id,scorer' }
    )
    await reloadAll()
  }, [reloadAll, email])

  const saveSettings = useCallback(async (patch: Partial<AppSettings>) => {
    await supabase.from('app_settings').update(patch).eq('id', 1)
    await reloadAll()
  }, [reloadAll])

  const value = useMemo<StoreContextValue>(() => ({
    ...data, session, email, loading, reloadAll,
    createFlat, updateFlat, deleteFlat, saveCosts, uploadPhotos, deletePhoto, setPrimaryPhoto, setPoiTime, bulkSetPoiTimes,
    createPoi, updatePoi, deletePoi, createCriterion, updateCriterion, deleteCriterion, setScore, saveSettings,
  }), [data, session, email, loading, reloadAll, createFlat, updateFlat, deleteFlat, saveCosts, uploadPhotos, deletePhoto, setPrimaryPhoto, setPoiTime, bulkSetPoiTimes, createPoi, updatePoi, deletePoi, createCriterion, updateCriterion, deleteCriterion, setScore, saveSettings])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
