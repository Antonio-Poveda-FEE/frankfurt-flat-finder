import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { GUEST_EMAIL, GUEST_PASSWORD } from '../lib/config'
import { useT } from '../lib/i18n'
import LangToggle from './LangToggle'

export default function Login() {
  const { t } = useT()
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
        else if (!data.session) setMsg(t('Cuenta creada. Si se pide confirmación, revisa tu email; si no, ya puedes entrar.', 'Account created. If confirmation is required, check your email; otherwise you can sign in.'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function guest() {
    setBusy(true); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASSWORD })
    if (error) setMsg(error.message)
    setBusy(false)
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6">
      <div className="mb-3 w-full max-w-sm flex justify-end"><LangToggle /></div>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-slate-900/80 p-6 shadow-xl ring-1 ring-slate-800">
        <div className="text-center">
          <div className="mx-auto mb-2 text-4xl">🏙️</div>
          <h1 className="text-xl font-bold text-white">Frankfurt Flat Finder</h1>
          <p className="text-sm text-slate-400">{t('Puntúa y compara pisos con tu pareja.', 'Score and compare flats together.')}</p>
        </div>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" autoComplete="email"
          className="w-full rounded-lg bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={t('Contraseña', 'Password')} autoComplete="current-password" minLength={6}
          className="w-full rounded-lg bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <button disabled={busy} className="w-full rounded-lg bg-sky-500 py-2 font-semibold text-white hover:bg-sky-400 disabled:opacity-50">
          {busy ? '…' : mode === 'signin' ? t('Entrar', 'Sign in') : t('Crear cuenta', 'Create account')}
        </button>
        {msg && <p className="text-sm text-amber-400">{msg}</p>}
        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null) }}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === 'signin' ? t('¿No tienes cuenta? Crear una', "Don't have an account? Create one") : t('¿Ya tienes cuenta? Entrar', 'Already have an account? Sign in')}
        </button>
        <div className="border-t border-slate-800 pt-3">
          <button type="button" onClick={guest} disabled={busy}
            className="w-full rounded-lg bg-slate-800 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50">
            👁️ {t('Entrar como invitado (solo lectura)', 'Enter as guest (read-only)')}
          </button>
        </div>
      </form>
    </div>
  )
}
