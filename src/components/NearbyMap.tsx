import { useEffect, useMemo, useState } from 'react'
import { Map, Marker, Polyline, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { categoryOf, type NearbyCategory } from '../lib/places'
import { distanceMatrix, walkingRoute, type LatLng } from '../lib/geocode'
import type { Flat } from '../lib/types'
import { num } from '../lib/format'

interface NearbyPlace {
  id: string
  name: string
  location: LatLng
  rating?: number
  walkMin?: number | null
}

export default function NearbyMap({ flat, category, onClose }: { flat: Flat; category: NearbyCategory; onClose: () => void }) {
  const cat = categoryOf(category)
  const origin: LatLng | null = flat.lat != null && flat.lng != null ? { lat: flat.lat, lng: flat.lng } : null

  const map = useMap('nearby')
  const placesLib = useMapsLibrary('places')
  const routesLib = useMapsLibrary('routes')

  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading')

  // 1) Nearby search + walking times
  useEffect(() => {
    if (!map || !placesLib || !routesLib || !origin) return
    let cancelled = false
    setStatus('loading'); setPlaces([]); setRoutePath(null); setSelected(null)
    const service = new placesLib.PlacesService(map)
    service.nearbySearch(
      { location: origin, radius: 1300, type: cat.type as unknown as string },
      async (results, st) => {
        if (cancelled) return
        if (st !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
          setStatus('empty'); return
        }
        const found: NearbyPlace[] = results.slice(0, 18)
          .filter((r) => r.geometry?.location)
          .map((r) => ({
            id: r.place_id ?? r.name ?? Math.random().toString(),
            name: r.name ?? 'Sitio',
            location: { lat: r.geometry!.location!.lat(), lng: r.geometry!.location!.lng() },
            rating: r.rating ?? undefined,
          }))
        // Walking times in a single Distance Matrix call.
        const dm = new routesLib.DistanceMatrixService()
        const times = await distanceMatrix(dm, origin, found.map((f) => f.location), google.maps.TravelMode.WALKING)
        if (cancelled) return
        found.forEach((f, i) => { f.walkMin = times[i]?.minutes ?? null })
        found.sort((a, b) => (a.walkMin ?? 999) - (b.walkMin ?? 999))
        setPlaces(found)
        setStatus('ready')
      }
    )
    return () => { cancelled = true }
  }, [map, placesLib, routesLib, origin?.lat, origin?.lng, cat.type])

  async function selectPlace(p: NearbyPlace) {
    setSelected(p.id)
    if (!routesLib || !origin) return
    const ds = new routesLib.DirectionsService()
    const path = await walkingRoute(ds, origin, p.location)
    setRoutePath(path)
    map?.panTo(p.location)
  }

  const selectedPlace = useMemo(() => places.find((p) => p.id === selected), [places, selected])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="font-semibold text-white">{cat.emoji} {cat.label} cerca</h2>
        <button onClick={onClose} className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-200">Cerrar ✕</button>
      </div>

      {!origin ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-slate-400">
          Este piso no tiene coordenadas. Edítalo y pulsa «Obtener coordenadas» (o añade la dirección).
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="h-1/2 min-h-[240px] w-full">
            <Map
              id="nearby"
              defaultCenter={origin}
              defaultZoom={15}
              gestureHandling="greedy"
              disableDefaultUI={false}
              clickableIcons={false}
              colorScheme="DARK"
              style={{ width: '100%', height: '100%' }}
            >
              <Marker position={origin} label={{ text: '🏠', fontSize: '22px' }} title={flat.title} zIndex={10} />
              {places.map((p) => (
                <Marker
                  key={p.id}
                  position={p.location}
                  label={{ text: cat.emoji, fontSize: selected === p.id ? '26px' : '18px' }}
                  title={p.name}
                  onClick={() => selectPlace(p)}
                />
              ))}
              {routePath && <Polyline path={routePath} strokeColor="#38bdf8" strokeWeight={5} strokeOpacity={0.9} />}
            </Map>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {status === 'loading' && <p className="text-sm text-slate-400">Buscando sitios cercanos…</p>}
            {status === 'empty' && <p className="text-sm text-slate-400">No se han encontrado sitios de esta categoría cerca.</p>}
            {selectedPlace?.walkMin != null && (
              <p className="mb-2 text-sm text-sky-300">🚶 {selectedPlace.name}: {selectedPlace.walkMin} min andando</p>
            )}
            <ul className="space-y-1.5">
              {places.map((p) => (
                <li key={p.id}>
                  <button onClick={() => selectPlace(p)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ring-1 ${selected === p.id ? 'bg-sky-500/15 ring-sky-500/40' : 'bg-slate-900 ring-slate-800'}`}>
                    <span className="min-w-0 flex-1 truncate text-slate-100">{cat.emoji} {p.name}</span>
                    {p.rating != null && <span className="ml-2 shrink-0 text-amber-400">★ {num(p.rating, 1)}</span>}
                    <span className="ml-3 shrink-0 text-slate-400">{p.walkMin != null ? `${p.walkMin} min 🚶` : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">Pulsa un sitio para ver la ruta andando en el mapa.</p>
          </div>
        </div>
      )}
    </div>
  )
}
