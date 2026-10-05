'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import NinhoApp from '@/components/NinhoApp'
import { cachedHousehold, isOfflineError, rememberHousehold } from '@/lib/offline'

export default function Home() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Service worker: abre sem internet e recebe notificações (só no build de produção)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(e => console.error('[ninho] service worker', e?.message))
  }, [])

  useEffect(() => {
    async function init() {
      // Sem internet: abre a última casa usada neste aparelho (os dados vêm do cache do app)
      const cached = cachedHousehold()
      const useCached = () => { if (!cached) return false; setHouseholdId(cached); return true }
      try {
        // Login anônimo automático
        let { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          const { data, error: e } = await supabase.auth.signInAnonymously()
          if (e || !data.session) {
            if (isOfflineError(e) && useCached()) return
            setError('Erro ao iniciar: ' + (e?.message || 'sem sessão')); setLoading(false); return
          }
          session = data.session
        }

        const uid = session.user.id

        // Verificar perfil
        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('household_id').eq('id', uid).single()
        // PGRST116 = perfil ainda não existe (primeiro acesso). Outro erro: não cria casa nova por engano.
        if (profileError && profileError.code !== 'PGRST116') {
          if (useCached()) return
          throw profileError
        }

        let hhId = profile?.household_id

        if (!hhId) {
          // Verificar se já existe um household (para que todos caiam no mesmo)
          const { data: existing } = await supabase
            .from('households').select('id').limit(1).single()

          if (existing?.id) {
            hhId = existing.id
          } else {
            const { data: hh } = await supabase
              .from('households').insert({ name: 'Ninho' }).select().single()
            hhId = hh?.id
          }

          await supabase.from('profiles').upsert({
            id: uid, household_id: hhId, name: 'Integrante', role: 'g'
          })
        }

        if (hhId) rememberHousehold(hhId)
        setHouseholdId(hhId)
      } catch (e: any) {
        if (isOfflineError(e) && useCached()) return
        setError(isOfflineError(e) ? 'Sem conexão com o servidor. Confira a internet e tente de novo.' : (e?.message || 'Erro desconhecido'))
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#666', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>carregando...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ color: '#f0ede8', fontSize: 14, marginBottom: 8 }}>Não foi possível iniciar</div>
        <div style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    </div>
  )

  if (!householdId) return null

  return <NinhoApp householdId={householdId} />
}
