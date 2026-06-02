import { useT } from '../lib/i18n'

/** Compact ES/EN language switch. */
export default function LangToggle() {
  const { lang, setLang } = useT()
  return (
    <div className="inline-flex overflow-hidden rounded-md ring-1 ring-slate-700">
      {(['es', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`px-2 py-1 text-xs font-semibold ${lang === l ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
