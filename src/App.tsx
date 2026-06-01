import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { StoreProvider } from './store/DataContext'
import MapProvider from './components/MapProvider'
import Login from './components/Login'
import Layout from './components/Layout'
import FlatsList from './pages/FlatsList'
import FlatDetail from './pages/FlatDetail'
import FlatForm from './pages/FlatForm'
import Compare from './pages/Compare'
import Settings from './pages/Settings'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return <div className="flex h-full items-center justify-center text-slate-400">Cargando…</div>
  }

  if (!session) return <Login />

  return (
    <StoreProvider session={session}>
      <MapProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<FlatsList />} />
          <Route path="/new" element={<FlatForm />} />
          <Route path="/flat/:id" element={<FlatDetail />} />
          <Route path="/flat/:id/edit" element={<FlatForm />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      </MapProvider>
    </StoreProvider>
  )
}
