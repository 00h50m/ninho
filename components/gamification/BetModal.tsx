'use client'
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { DEFAULT_BET } from '@/lib/gamification'

const IDEAS = [DEFAULT_BET, 'Quem perder lava a louça no domingo', 'Quem perder faz o café da manhã de sábado', 'Quem ganhar escolhe o filme', 'Quem perder faz uma massagem']

/** Aposta simbólica da semana. */
export function BetModal({ current, saving, onClose, onSave }: { current: string | null | undefined, saving: boolean, onClose: () => void, onSave: (bet: string) => void }) {
  const [bet, setBet] = useState(current || DEFAULT_BET)
  const ok = bet.trim().length > 0
  return (
    <Sheet size="sm" title="🎲 Aposta da semana" onClose={onClose} footer={
      <button className="btn btn-p" disabled={!ok || saving} onClick={() => onSave(bet.trim())}>{saving ? 'Salvando…' : 'Salvar aposta'}</button>
    }>
      <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 12 }}>Vale para esta semana (segunda a domingo). Quem fizer mais XP ganha.</div>
      <input className="fi" value={bet} maxLength={120} onChange={e => setBet(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && ok) onSave(bet.trim()) }} aria-label="Aposta" autoFocus />
      <div className="pills" style={{ marginTop: 12 }}>
        {IDEAS.map(i => <button key={i} className="fc" onClick={() => setBet(i)}>{i}</button>)}
      </div>
    </Sheet>
  )
}
