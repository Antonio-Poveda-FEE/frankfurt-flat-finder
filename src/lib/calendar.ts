import type { Flat } from './types'

export interface VisitEvent {
  id: string
  date: string
  time: string | null
  flat: Flat
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

export function formatDateKey(dateKey: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-ES', opts ?? {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateKey(dateKey))
}

export function formatVisitTime(time: string | null | undefined): string {
  if (!time) return 'Sin hora'
  return time.slice(0, 5)
}

export function visitsFromFlats(flats: Flat[]): VisitEvent[] {
  return flats
    .filter((flat) => Boolean(flat.visited_on))
    .map((flat) => ({ id: flat.id, date: flat.visited_on!, time: flat.visit_time?.slice(0, 5) ?? null, flat }))
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '99:99').localeCompare(b.time ?? '99:99') ||
      a.flat.title.localeCompare(b.flat.title)
    )
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function utcStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function formatIcsDateTime(date: Date): string {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    'T',
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    '00',
  ].join('')
}

function timedVisitLines(event: VisitEvent): string[] {
  if (!event.time) {
    const start = event.date.replace(/-/g, '')
    return [
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${addDays(event.date, 1)}`,
    ]
  }

  const [year, month, day] = event.date.split('-').map(Number)
  const [hour, minute] = event.time.split(':').map(Number)
  const start = new Date(year, month - 1, day, hour, minute)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  return [
    `DTSTART;TZID=Europe/Berlin:${formatIcsDateTime(start)}`,
    `DTEND;TZID=Europe/Berlin:${formatIcsDateTime(end)}`,
  ]
}

function eventToIcs(event: VisitEvent, stamp: string): string {
  const start = event.date.replace(/-/g, '')
  const description = [
    event.time ? `Hora: ${formatVisitTime(event.time)}` : '',
    event.flat.listing_url ? `Enlace: ${event.flat.listing_url}` : '',
    event.flat.notes ? `Notas: ${event.flat.notes}` : '',
  ].filter(Boolean).join('\n')

  return [
    'BEGIN:VEVENT',
    `UID:flat-${event.flat.id}-${start}@frankfurt-flat-finder`,
    `DTSTAMP:${stamp}`,
    ...timedVisitLines(event),
    `SUMMARY:${escapeIcsText(`Visita piso: ${event.flat.title}`)}`,
    event.flat.address ? `LOCATION:${escapeIcsText(event.flat.address)}` : '',
    description ? `DESCRIPTION:${escapeIcsText(description)}` : '',
    event.flat.listing_url ? `URL:${event.flat.listing_url}` : '',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n')
}

export function buildVisitsIcs(events: VisitEvent[]): string {
  const stamp = utcStamp()
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Frankfurt Flat Finder//Visits//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.map((event) => eventToIcs(event, stamp)),
    'END:VCALENDAR',
  ].join('\r\n')
}

export async function exportVisitsIcs(events: VisitEvent[], filename: string): Promise<void> {
  const blob = new Blob([buildVisitsIcs(events)], { type: 'text/calendar;charset=utf-8' })
  const file = new File([blob], filename, { type: 'text/calendar' })
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
  }

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    await nav.share({ files: [file], title: 'Visitas de pisos', text: 'Importar visitas en Calendario' })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
