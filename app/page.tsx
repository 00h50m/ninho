'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AppProvider } from '@/lib/AppContext'
import { Dashboard } from '@/components/Dashboard'

export default function Home() {
  const [userId, setUserId]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [noProfile, setNoProfile] = useState(false)

  useEffect(() => {
    async function check() {
      // Troca code por session se vier do callback de email
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        window.history.replaceState({}, '', '/')
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', session.user.id)
        .single()

      if (!profile?.household_id) {
        setNoProfile(true)
        setLoading(false)
        return
      }

      setUserId(session.user.id)
      setLoading(false)
    }
    check()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-subtle text-sm animate-pulse">Carregando o Ninho...</div>
      </div>
    )
  }

  if (noProfile) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-brand-text text-lg mb-2">Perfil incompleto</div>
          <div className="text-brand-subtle text-sm mb-4">Precisamos finalizar seu cadastro.</div>
          <button
            onClick={() => { window.location.href = '/login' }}
            className="bg-brand-green text-brand-bg px-6 py-2.5 rounded-xl text-sm font-medium"
          >
            Completar cadastro
          </button>
        </div>
      </div>
    )
  }

  if (!userId) return null

  return (
    <AppProvider userId={userId}>
      <Dashboard />
    </AppProvider>
  )
}
