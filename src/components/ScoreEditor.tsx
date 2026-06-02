import { useMemo, useState } from 'react'
import { useStore } from '../store/DataContext'
import { scoreColor } from '../lib/format'

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

/** Per-criterion sliders for the logged-in user, plus a peek at others' ratings. */
export default function ScoreEditor({ flatId }: { flatId: string }) {
  const { criteria, scores, email, setScore } = useStore()
  // Live values while dragging — committed to the DB only on release (smooth drag).
  const [draft, setDraft] = useState<Record<string, number>>({})

  const byCrit = useMemo(() => {
    const map = new Map<string, { mine?: number; others: { scorer: string; value: number }[] }>()
    for (const c of criteria) map.set(c.id, { others: [] })
    for (const s of scores) {
      if (s.flat_id !== flatId) continue
      const entry = map.get(s.criterion_id)
      if (!entry) continue
      if (s.scorer === email) entry.mine = s.value
      else entry.others.push({ scorer: s.scorer, value: s.value })
    }
    return map
  }, [criteria, scores, flatId, email])

  const categories = useMemo(() => {
    const order: string[] = []
    for (const c of criteria) if (!order.includes(c.category ?? 'Otros')) order.push(c.category ?? 'Otros')
    return order
  }, [criteria])

  const commit = (critId: string) => {
    const v = draft[critId]
    if (v != null) void setScore(flatId, critId, v)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">Tu puntuación (1–10, en pasos de 0,5). La nota global combina las notas de todas las personas y el precio.</p>
      {categories.map((cat) => (
        <div key={cat} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{cat}</h3>
          {criteria.filter((c) => (c.category ?? 'Otros') === cat).map((c) => {
            const entry = byCrit.get(c.id)
            const committed = entry?.mine
            const live = draft[c.id] ?? committed
            const sliderVal = live ?? 1
            return (
              <div key={c.id} className="rounded-xl bg-slate-800/60 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-slate-200">{c.name}</span>
                  <span className="text-sm font-bold" style={{ color: live != null ? scoreColor(((live - 1) / (c.scale_max - 1)) * 100) : '#64748b' }}>
                    {live != null ? fmt(live) : '–'}/{c.scale_max}
                  </span>
                </div>
                <input
                  type="range" min={1} max={c.scale_max} step={0.5} value={sliderVal}
                  onChange={(e) => setDraft((d) => ({ ...d, [c.id]: Number(e.target.value) }))}
                  onPointerUp={() => commit(c.id)}
                  onTouchEnd={() => commit(c.id)}
                  onKeyUp={() => commit(c.id)}
                  className="w-full touch-none"
                />
                {entry && entry.others.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    {entry.others.map((o) => (
                      <span key={o.scorer}>{o.scorer.split('@')[0]}: <b className="text-slate-200">{fmt(o.value)}</b></span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
