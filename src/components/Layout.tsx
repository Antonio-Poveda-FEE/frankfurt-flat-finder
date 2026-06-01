import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/DataContext'

const navItems = [
  { to: '/', label: 'Pisos', icon: '🏠', end: true },
  { to: '/compare', label: 'Comparar', icon: '📊', end: false },
  { to: '/calendar', label: 'Calendario', icon: '📅', end: false },
  { to: '/settings', label: 'Ajustes', icon: '⚙️', end: false },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { email } = useStore()
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏙️</span>
          <span className="font-bold text-white">Flat Finder</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 sm:inline">{email}</span>
          <button
            onClick={async () => { await supabase.auth.signOut() }}
            className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-28">{children}</main>

      <button
        onClick={() => navigate('/new')}
        className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-3xl text-white shadow-lg hover:bg-sky-400"
        aria-label="Añadir piso"
      >
        +
      </button>

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
