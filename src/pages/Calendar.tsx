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
  const [initialized, setInitialized] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedDateVisits = byDate[selectedDate] ?? []
  const cells = useMemo(() => buildMonthCells(month), [month])

  useEffect(() => {
    if (loading || initialized) return
    if (firstVisit) {
      setMonth(monthKey(parseDateKey(firstVisit)))
      setSelectedDate(firstVisit)
    }
    setInitialized(true)
  }, [firstVisit, initialized, loading])

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
                onClick={() => setSelectedDate(cell.key)}
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
              {selectedDateVisits.length > 0 ? `${selectedDateVisits.length} visita(s) · pulsa un piso para abrir su ficha` : 'Sin visitas en esta fecha.'}
            </p>
          </div>
          <button
            type="button"
            disabled={selectedDateVisits.length === 0 || exporting}
            onClick={() => exportEvents(selectedDateVisits, `visitas-${selectedDate}.ics`)}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 disabled:opacity-50"
          >
            Exportar este día
          </button>
        </div>

        {selectedDateVisits.length === 0 ? (
          <p className="rounded-lg bg-slate-950 p-4 text-sm text-slate-400">No hay visitas en esta fecha.</p>
        ) : (
          <ul className="space-y-2">
            {selectedDateVisits.map((visit) => (
              <li key={visit.id} className="flex items-center gap-2 rounded-lg bg-slate-950 p-3 ring-1 ring-slate-800 hover:ring-slate-600">
                <Link to={`/flat/${visit.flat.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-white">{visit.flat.title}</span>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: `${STATUS_META[visit.flat.status].color}22`, color: STATUS_META[visit.flat.status].color }}>
                      {STATUS_META[visit.flat.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-sky-300">{formatVisitTime(visit.time)}</p>
                  <p className="truncate text-xs text-slate-400">{visit.flat.address || 'Sin dirección'}</p>
                </Link>
                <span className="shrink-0 text-lg text-slate-500">›</span>
                <button
                  type="button"
                  title="Exportar esta visita al calendario"
                  disabled={exporting}
                  onClick={() => exportEvents([visit], `visita-${visit.date}-${fileSafeName(visit.flat.title)}.ics`)}
                  className="shrink-0 rounded-lg bg-slate-800 px-2 py-1.5 text-sm text-slate-200 disabled:opacity-50"
                >📤</button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <p className="mt-3 text-[11px] text-slate-500">
          Pulsa un piso para ver su ficha, o 📤 para añadir esa visita al Calendario (en iPhone se abre la hoja de compartir).
        </p>
      </section>
    </div>
  )
}
