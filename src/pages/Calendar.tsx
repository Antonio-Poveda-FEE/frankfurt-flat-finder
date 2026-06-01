import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/DataContext'
import {
  exportVisitsIcs, formatDateKey, formatVisitTime, parseDateKey, todayKey, visitsFromFlats,
} from '../lib/calendar'
import type { VisitEvent } from '../lib/calendar'
import { STATUS_META } from '../lib/types'

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(year, m - 1, 1))
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function moveMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  return monthKey(new Date(year, m - 1 + delta, 1))
}

function buildMonthCells(month: string): { key: string; inMonth: boolean }[] {
  const [year, m] = month.split('-').map(Number)
  const first = new Date(year, m - 1, 1)
  const startOffset = (first.getDay() + 6) % 7
  const start = new Date(year, m - 1, 1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { key: dateKey(d), inMonth: d.getMonth() === m - 1 }
  })
}

function groupByDate(events: VisitEvent[]): Record<string, VisitEvent[]> {
  const out: Record<string, VisitEvent[]> = {}
  for (const event of events) (out[event.date] ||= []).push(event)
  return out
}

function fileSafeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

export default function Calendar() {
  const { flats, loading } = useStore()
  const visits = useMemo(() => visitsFromFlats(flats), [flats])
  const byDate = useMemo(() => groupByDate(visits), [visits])
  const firstVisit = visits[0]?.date
  const [month, setMonth] = useState(monthKey(firstVisit ? parseDateKey(firstVisit) : new Date()))
  const [selectedDate, setSelectedDate] = useState(firstVisit ?? todayKey())
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(visits[0]?.id ?? null)
  const [initialized, setInitialized] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedDateVisits = byDate[selectedDate] ?? []
  const selectedVisit = selectedDateVisits.find((v) => v.id === selectedVisitId) ?? selectedDateVisits[0] ?? null
  const cells = useMemo(() => buildMonthCells(month), [month])

  useEffect(() => {
    if (loading || initialized) return
    if (firstVisit) {
      setMonth(monthKey(parseDateKey(firstVisit)))
      setSelectedDate(firstVisit)
      setSelectedVisitId(visits[0]?.id ?? null)
    }
    setInitialized(true)
  }, [firstVisit, initialized, loading, visits])

  async function exportEvents(events: VisitEvent[], filename: string) {
    if (events.length === 0) return
    setError(null)
    setExporting(true)
    try {
      await exportVisitsIcs(events, filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el calendario.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <p className="text-slate-400">Cargando calendario…</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Calendario</h1>
          <p className="text-sm text-slate-400">{visits.length} visita(s) con fecha guardada</p>
        </div>
        <button
          type="button"
          disabled={visits.length === 0 || exporting}
          onClick={() => exportEvents(visits, 'visitas-pisos.ics')}
          className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Exportar todas
        </button>
      </div>

      <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setMonth(moveMonth(month, -1))}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">‹</button>
          <h2 className="text-center font-semibold capitalize text-white">{monthLabel(month)}</h2>
          <button type="button" onClick={() => setMonth(moveMonth(month, 1))}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-slate-500">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const dayVisits = byDate[cell.key] ?? []
            const selected = cell.key === selectedDate
            const isToday = cell.key === todayKey()
            return (
              <button
                type="button"
                key={cell.key}
                onClick={() => {
                  setSelectedDate(cell.key)
                  setSelectedVisitId(dayVisits[0]?.id ?? null)
                }}
                className={`relative min-h-16 rounded-lg p-1 text-left ring-1 transition ${
                  selected ? 'bg-sky-500/20 ring-sky-400' : 'bg-slate-950/60 ring-slate-800 hover:ring-slate-600'
                } ${cell.inMonth ? 'text-slate-100' : 'text-slate-600'}`}
              >
                <span className={`text-xs ${isToday ? 'font-bold text-sky-300' : ''}`}>{Number(cell.key.slice(-2))}</span>
                {dayVisits.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {dayVisits.slice(0, 2).map((visit) => (
                      <span key={visit.id} className="block truncate rounded bg-amber-400/20 px-1 py-0.5 text-[10px] text-amber-200">
                        {visit.time ? `${formatVisitTime(visit.time)} · ${visit.flat.title}` : visit.flat.title}
                      </span>
                    ))}
                    {dayVisits.length > 2 && <span className="block text-[10px] text-slate-400">+{dayVisits.length - 2}</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">{formatDateKey(selectedDate)}</h2>
            <p className="text-xs text-slate-500">
              {selectedVisit?.time ? `Visita a las ${formatVisitTime(selectedVisit.time)}` : 'Eventos de día completo cuando no hay hora específica.'}
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedVisit || exporting}
            onClick={() => selectedVisit && exportEvents([selectedVisit], `visita-${selectedVisit.date}-${fileSafeName(selectedVisit.flat.title)}.ics`)}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 disabled:opacity-50"
          >
            Exportar seleccionada
          </button>
        </div>

        {selectedDateVisits.length === 0 ? (
          <p className="rounded-lg bg-slate-950 p-4 text-sm text-slate-400">No hay visitas en esta fecha.</p>
        ) : (
          <ul className="space-y-2">
            {selectedDateVisits.map((visit) => {
              const selected = selectedVisit?.id === visit.id
              return (
                <li key={visit.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedVisitId(visit.id)}
                    className={`w-full rounded-lg p-3 text-left ring-1 ${
                      selected ? 'bg-sky-500/10 ring-sky-500' : 'bg-slate-950 ring-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/flat/${visit.flat.id}`} className="font-semibold text-white hover:text-sky-300">
                          {visit.flat.title}
                        </Link>
                        <p className="text-xs text-sky-300">{formatVisitTime(visit.time)}</p>
                      </div>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: `${STATUS_META[visit.flat.status].color}22`, color: STATUS_META[visit.flat.status].color }}>
                        {STATUS_META[visit.flat.status].label}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-400">{visit.flat.address || 'Sin dirección'}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <p className="mt-3 text-[11px] text-slate-500">
          En iPhone, abre el archivo .ics descargado o compartido y añádelo a Calendario. El envío por email puede llevar el enlace, pero no adjuntar archivos de forma fiable desde una web.
        </p>
      </section>
    </div>
  )
}
