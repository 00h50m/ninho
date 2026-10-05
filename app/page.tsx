'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import NinhoApp from '@/components/NinhoApp'
import { LoginScreen, NoHouseScreen } from '@/components/LoginScreen'
import { isOfflineError, rememberHousehold } from '@/lib/offline'
import { forgetMember, readMember, rememberMember, type Member } from '@/lib/member'
import { writeDeviceWho } from '@/lib/device'

type Phase =
  | { k: 'loading' }
  | { k: 'login' }
  | { k: 'recovery' }
  | { k: 'nohouse', email: string }
  | { k: 'error', msg: string }
  | { k: 'ready', member: Member }

export default function Home() {
  const [phase, setPhase] = useState<Phase>({ k: 'loading' })

  // Service worker: abre sem internet e recebe notificações (só no build de produção)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(e => console.error('[ninho] service worker', e?.message))
  }, [])

  /** Com a sessão em mãos: descobre a casa e quem é a pessoa (household_members). */
  const resolve = useCallback(async (session: Session) => {
    const email = session.user.email || ''
    try {
      const { data, error } = await supabase.from('household_members').select('household_id,who').eq('user_id', session.user.id).maybeSingle()
      if (error) throw error
      if (!data) { setPhase({ k: 'nohouse', email }); return }
      const member: Member = { householdId: data.household_id, who: data.who, email, userId: session.user.id }
      rememberHousehold(member.householdId)
      rememberMember(member)
      writeDeviceWho(member.who) // "quem fez" passa a ser a conta
      setPhase({ k: 'ready', member })
    } catch (e: any) {
      // Sem internet: abre com a última casa desta conta (dados do cache do app)
      const cached = readMember()
      if (isOfflineError(e) && cached?.userId === session.user.id) { setPhase({ k: 'ready', member: cached }); return }
      setPhase({ k: 'error', msg: isOfflineError(e) ? 'Sem conexão com o servidor. Confira a internet e tente de novo.' : (e?.message || 'Erro desconhecido') })
    }
  }, [])

  const start = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    // Sessões anônimas da versão antiga não valem mais: pede login
    if (!session || session.user.is_anonymous) {
      if (session) await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      setPhase(p => p.k === 'recovery' ? p : { k: 'login' })
      return
    }
    await resolve(session)
  }, [resolve])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPhase({ k: 'recovery' })
      if (event === 'SIGNED_OUT') { forgetMember(); setPhase({ k: 'login' }) }
    })
    // Link de "esqueci a senha": mostra a tela de senha nova antes de entrar
    if (typeof window !== 'undefined' && /type=recovery/.test(window.location.hash)) setPhase({ k: 'recovery' })
    else start()
    return () => sub.subscription.unsubscribe()
  }, [start])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    forgetMember()
    setPhase({ k: 'login' })
  }, [])

  if (phase.k === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--sub)', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>carregando...</div>
    </div>
  )
  if (phase.k === 'login' || phase.k === 'recovery') return <LoginScreen key={phase.k} mode={phase.k} onDone={() => { setPhase({ k: 'loading' }); start() }}/>
  if (phase.k === 'nohouse') return <NoHouseScreen email={phase.email} onSignOut={signOut} onRetry={() => { setPhase({ k: 'loading' }); start() }}/>
  if (phase.k === 'error') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ color: 'var(--tx)', fontSize: 14, marginBottom: 8 }}>Não foi possível iniciar</div>
        <div style={{ color: 'var(--sub)', fontSize: 12, marginBottom: 16 }}>{phase.msg}</div>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: 'var(--pri)', color: 'var(--on-pri)', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    </div>
  )
  return <NinhoApp householdId={phase.member.householdId} account={{ who: phase.member.who, email: phase.member.email, onSignOut: signOut }}/>
}
