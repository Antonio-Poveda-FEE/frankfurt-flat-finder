import type { Recommendation } from '../lib/stats'
import { useT } from '../lib/i18n'

const phaseStyle: Record<Recommendation['phase'], { bg: string; ring: string }> = {
  'no-data': { bg: 'bg-slate-800/60', ring: 'ring-slate-700' },
  exploration: { bg: 'bg-sky-500/10', ring: 'ring-sky-500/40' },
  decision: { bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/40' },
}

export default function RecommendationPanel({ rec }: { rec: Recommendation }) {
  const style = phaseStyle[rec.phase]
  const { t } = useT()
  return (
    <section className={`rounded-2xl p-4 ring-1 ${style.bg} ${style.ring}`}>
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('Recomendación estadística', 'Statistical recommendation')}</h2>
      <p className="text-base font-bold text-white">{rec.headline}</p>

      {rec.phase !== 'no-data' && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label={t('Puntuados', 'Scored')} value={`${rec.seenCount}/${rec.plannedN}`} />
          <Stat label={t('Media', 'Mean')} value={rec.meanScore != null ? rec.meanScore.toFixed(0) : '—'} />
          <Stat label={t('Mejor', 'Best')} value={rec.bestFlat ? rec.bestFlat.global.toFixed(0) : '—'} />
        </div>
      )}

      <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
        {rec.bullets.map((b, i) => (
          <li key={i} className="flex gap-2"><span className="text-slate-500">•</span><span>{b}</span></li>
        ))}
      </ul>

      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer">{t('¿Cómo se calcula esto?', 'How is this calculated?')}</summary>
        <p className="mt-2 leading-relaxed">
          {t('Combina cuatro señales: (1) puntuación ponderada de tus criterios; (2) la regla del 37% (problema de la secretaria): observa sin comprometerte durante los primeros ~37% de pisos, luego acepta el primero que supere a todos los anteriores; (3) un z-score para ver si un piso destaca de forma significativa frente al resto; y (4) estadística de orden para estimar la mejor puntuación que cabría esperar en los pisos que aún no has visto, y así decidir si compensa seguir buscando.',
             'It combines four signals: (1) a weighted score from your criteria; (2) the 37% rule (secretary problem): observe without committing during the first ~37% of flats, then accept the first that beats all previous ones; (3) a z-score to see whether a flat stands out significantly from the rest; and (4) order statistics to estimate the best score you could expect among the flats you haven\'t seen yet, to decide whether it\'s worth looking further.')}
        </p>
      </details>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900/60 py-2">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}
