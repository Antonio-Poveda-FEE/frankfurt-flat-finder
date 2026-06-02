import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/DataContext'
import { useT } from '../lib/i18n'
import LangToggle from './LangToggle'

export default function Layout({ children }: { children: ReactNode }) {
  const { readOnly } = useStore()
  const { t } = useT()
  const navigate = useNavigate()

  const navItems = [
    { to: '/', label: t('Pisos', 'Flats'), icon: '🏠', end: true },
    { to: '/compare', label: t('Comparar', 'Compare'), icon: '📊', end: false },
    { to: '/calendar', label: t('Calendario', 'Calendar'), icon: '📅', end: false },
    { to: '/settings', label: t('Ajustes', 'Settings'), icon: '⚙️', end: false },
  ]

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏙️</span>
          <span className="font-bold text-white">Flat Finder</span>
          {readOnly && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">👁️ {t('INVITADO', 'GUEST')}</span>}
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <button
            onClick={async () => { await supabase.auth.signOut() }}
            className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            {t('Salir', 'Sign out')}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-28">{children}</main>

      {!readOnly && (
        <button
          onClick={() => navigate('/new')}
          className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-3xl text-white shadow-lg hover:bg-sky-400"
          aria-label={t('Añadir piso', 'Add flat')}
        >
          +
        </button>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-3xl justify-around border-t border-slate-800 bg-slate-950/90 backdrop-blur">
        {navItems.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-sky-400' : 'text-slate-400'}`
            }
          >
            <span className="text-xl">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
