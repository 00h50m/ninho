'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AppProvider } from '@/lib/AppContext'
import { Dashboard } from '@/components/Dashboard'

export default function Home() {
  const [ready, setReady]     = useState(false)
  const [userId, setUserId]   = useState<string | null>(null)
  const [error, setError]     = useState('')

  useEffect(() => {
    async function init() {
      try {
        // Tenta sessão existente primeiro
        let { data: { session } } = await supabase.auth.getSession()

        // Se não tem sessão, cria login anônimo
        if (!session) {
          const { data, error: signInError } = await supabase.auth.signInAnonymously()
          if (signInError) {
            setError('Erro de autenticação: ' + signInError.message)
            setReady(true)
            return
          }
          session = data.session
        }

        if (!session) {
          setError('Não foi possível criar sessão.')
          setReady(true)
          return
        }

        const uid = session.user.id

        // Verifica se já tem perfil com household
        const { data: profile } = await supabase
          .from('profiles')
          .select('household_id')
          .eq('id', uid)
          .single()

        if (!profile?.household_id) {
          // Verifica se já existe um household no banco
          // (para que todos os dispositivos caiam no mesmo)
          const hhIdFromEnv = process.env.NEXT_PUBLIC_HOUSEHOLD_ID?.trim()

          let hhId: string

          if (hhIdFromEnv) {
            // Usa o household já criado
            hhId = hhIdFromEnv
          } else {
            // Verifica se já existe algum household antes de criar
            const { data: existing } = await supabase
              .from('households')
              .select('id')
              .limit(1)
              .single()

            if (existing?.id) {
              hhId = existing.id
            } else {
              // Primeira vez absoluta — cria o household
              const { data: hh, error: hhError } = await supabase
                .from('households')
                .insert({ name: 'Ninho' })
                .select()
                .single()

              if (hhError || !hh) {
                setError('Erro ao criar household: ' + hhError?.message)
                setReady(true)
                return
              }
              hhId = hh.id
            }
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

      } catch (e: any) {
        setError(e?.message ?? 'Erro desconhecido')
        setReady(true)
      }
    }

    init()
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-subtle text-sm animate-pulse">Carregando o Ninho...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-brand-text text-sm font-medium mb-2">Não foi possível iniciar</div>
          <div className="text-brand-subtle text-xs leading-relaxed mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-brand-green text-brand-bg px-5 py-2 rounded-xl text-sm font-medium"
          >
            Tentar novamente
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
