'use client'
 
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AppProvider } from '@/lib/AppContext'
import { Dashboard } from '@/components/Dashboard'
 
const HOUSEHOLD_ID = process.env.NEXT_PUBLIC_HOUSEHOLD_ID!
 
export default function Home() {
  const [ready, setReady]   = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
 
  useEffect(() => {
    async function init() {
      // Login automático anônimo — sem tela de login
      let { data: { session } } = await supabase.auth.getSession()
 
      if (!session) {
        const { data } = await supabase.auth.signInAnonymously()
        session = data.session
      }
 
      if (!session) { setReady(true); return }
 
      const uid = session.user.id
 
      // Garante perfil e household
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', uid)
        .single()
 
      if (!profile?.household_id) {
        // Tenta usar o household fixo da env, ou cria um novo
        let hhId = HOUSEHOLD_ID
 
        if (!hhId) {
          const { data: hh } = await supabase
            .from('households')
            .insert({ name: 'Ninho' })
            .select()
            .single()
          hhId = hh!.id
        }
 
        await supabase.from('profiles').upsert({
          id: uid,
          household_id: hhId,
          name: 'Integrante',
          avatar_color: '#5dcaa5',
        })
      }
 
      setUserId(uid)
      setReady(true)
    }
    init()
  }, [])
 
  if (!ready) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-subtle text-sm animate-pulse">Carregando...</div>
      </div>
    )
  }
 
  if (!userId) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="text-brand-subtle text-sm text-center">
          Erro ao iniciar. Verifique as variáveis de ambiente no Vercel.
        </div>
      </div>
    )
  }
 
  return (
    <AppProvider userId={userId}>
      <Dashboard />
    </AppProvider>
  )
}
