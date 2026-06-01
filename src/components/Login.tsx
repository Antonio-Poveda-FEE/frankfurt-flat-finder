import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setMsg(error.message)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) setMsg(error.message)
        else if (!data.session) setMsg('Cuenta creada. Si se pide confirmación, revisa tu email; si no, ya puedes entrar.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-slate-900/80 p-6 shadow-xl ring-1 ring-slate-800">
        <div className="text-center">
          <div className="mx-auto mb-2 text-4xl">🏙️</div>
          <h1 className="text-xl font-bold text-white">Frankfurt Flat Finder</h1>
          <p className="text-sm text-slate-400">Puntúa y compara pisos con tu pareja.</p>
        </div>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" autoComplete="email"
          className="w-full rounded-lg bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña" autoComplete="current-password" minLength={6}
          className="w-full rounded-lg bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <button disabled={busy} className="w-full rounded-lg bg-sky-500 py-2 font-semibold text-white hover:bg-sky-400 disabled:opacity-50">
          {busy ? '…' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
        </button>
        {msg && <p className="text-sm text-amber-400">{msg}</p>}
        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null) }}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === 'signin' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Entrar'}
        </button>
      </form>
    </div>
  )
}
