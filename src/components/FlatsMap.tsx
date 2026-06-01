import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map, Marker, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import { FRANKFURT_CENTER } from '../lib/config'
import { scoreColor } from '../lib/format'
import type { Flat, Poi } from '../lib/types'

interface MapFlat { flat: Flat; score: number | null }

/** Rough centroid: average of all vertices in a (Multi)Polygon. */
function centroid(geom: { type: string; coordinates: any }): google.maps.LatLngLiteral {
  const pts: number[][] = []
  const walk = (a: any) => {
    if (typeof a[0] === 'number') pts.push(a)
    else a.forEach(walk)
  }
  walk(geom.coordinates)
  const [sx, sy] = pts.reduce(([x, y], p) => [x + p[0], y + p[1]], [0, 0])
  return { lng: sx / pts.length, lat: sy / pts.length }
}

/** Imperatively manages the neighbourhood GeoJSON overlay + name labels. */
function Neighbourhoods({ show }: { show: boolean }) {
  const map = useMap('compare')
  useEffect(() => {
    if (!map || !show) return
    let cancelled = false
    const labels: google.maps.Marker[] = []
    fetch(`${import.meta.env.BASE_URL}frankfurt-stadtteile.geojson`)
      .then((r) => r.json())
      .then((gj) => {
        if (cancelled) return
        map.data.addGeoJson(gj)
        map.data.setStyle({ fillColor: '#38bdf8', fillOpacity: 0.06, strokeColor: '#38bdf8', strokeWeight: 1 })
        for (const f of gj.features) {
          const pos = centroid(f.geometry)
          labels.push(new google.maps.Marker({
            position: pos, map,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
            label: { text: f.properties?.name ?? '', color: '#bae6fd', fontSize: '11px', fontWeight: '600' },
            clickable: false,
            zIndex: 1,
          }))
        }
      })
    return () => {
      cancelled = true
      map.data.forEach((f) => map.data.remove(f))
      labels.forEach((m) => m.setMap(null))
    }
  }, [map, show])
  return null
}

/** Fits the map to the flats/POIs once. */
function FitBounds({ points }: { points: google.maps.LatLngLiteral[] }) {
  const map = useMap('compare')
  useEffect(() => {
    if (!map || points.length === 0) return
    if (points.length === 1) { map.setCenter(points[0]); map.setZoom(14); return }
    const b = new google.maps.LatLngBounds()
    points.forEach((p) => b.extend(p))
    map.fitBounds(b, 60)
  }, [map, points.length])
  return null
}

export default function FlatsMap({ flats, pois }: { flats: MapFlat[]; pois: Poi[] }) {
  const navigate = useNavigate()
  const [showHoods, setShowHoods] = useState(false)
  const [satellite, setSatellite] = useState(false)

  const located = flats.filter((f) => f.flat.lat != null && f.flat.lng != null)
  const locatedPois = pois.filter((p) => p.lat != null && p.lng != null)
  const points: google.maps.LatLngLiteral[] = [
    ...located.map((f) => ({ lat: f.flat.lat!, lng: f.flat.lng! })),
    ...locatedPois.map((p) => ({ lat: p.lat!, lng: p.lng! })),
  ]
  const missing = flats.length - located.length

  return (
    <section className="overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <h2 className="font-semibold text-white">Mapa de pisos</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSatellite((s) => !s)}
            className={`rounded-md px-2 py-1 text-xs ring-1 ${satellite ? 'bg-sky-500/20 text-sky-300 ring-sky-500/50' : 'bg-slate-800 text-slate-300 ring-slate-700'}`}
          >
            🛰️ {satellite ? 'Vista mapa' : 'Satélite'}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={showHoods} onChange={(e) => setShowHoods(e.target.checked)} className="h-4 w-4 accent-sky-500" />
            Mostrar barrios
          </label>
        </div>
      </div>
      <div className="h-80 w-full">
        <Map
          id="compare"
          defaultCenter={FRANKFURT_CENTER}
          defaultZoom={12}
          mapTypeId={satellite ? 'hybrid' : 'roadmap'}
          gestureHandling="greedy"
          clickableIcons={false}
          colorScheme="DARK"
          mapTypeControl={false}
          fullscreenControl={false}
          streetViewControl={false}
          rotateControl={false}
          zoomControl={true}
          style={{ width: '100%', height: '100%' }}
        >
          <FitBounds points={points} />
          <Neighbourhoods show={showHoods} />

          {located.map(({ flat, score }) => (
            <Marker
              key={flat.id}
              position={{ lat: flat.lat!, lng: flat.lng! }}
              title={flat.title}
              onClick={() => navigate(`/flat/${flat.id}`)}
              zIndex={5}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                fillColor: scoreColor(score),
                fillOpacity: 1,
                strokeColor: '#0b1220',
                strokeWeight: 2,
              }}
              label={{ text: score != null ? String(Math.round(score)) : '?', color: '#0b1220', fontSize: '11px', fontWeight: '700' }}
            />
          ))}

          {locatedPois.map((p) => (
            <InfoWindow key={p.id} position={{ lat: p.lat!, lng: p.lng! }} headerDisabled disableAutoPan pixelOffset={[0, -6]}>
              <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 600 }}>📌 {p.label}</span>
            </InfoWindow>
          ))}
        </Map>
      </div>
      {missing > 0 && (
        <p className="px-4 py-2 text-[11px] text-amber-400">
          {missing} piso(s) sin coordenadas no se muestran. Edítalos y pulsa «Obtener coordenadas».
        </p>
      )}
    </section>
  )
}
