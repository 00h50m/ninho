'use client'

import { useEffect, useState } from 'react'
import NinhoApp from '@/components/NinhoApp'
import { initializeAnonymousHousehold } from '@/lib/bootstrap'
import { friendlyMessage, reportError } from '@/lib/errors'

export default function Home() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError('')
      setHouseholdId(null)
      try {
        setHouseholdId(await initializeAnonymousHousehold())
      } catch (caught) {
        reportError('inicialização', caught)
        setError(friendlyMessage(caught))
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [attempt])

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
        <button onClick={() => setAttempt((value) => value + 1)} style={{ padding: '8px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    </div>
  )

  if (!householdId) return null

  return <NinhoApp householdId={householdId} />
}
