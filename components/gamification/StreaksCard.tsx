'use client'
import type { Names, Who } from '@/lib/types'
import type { Streaks } from '@/lib/gamification'

const first = (n: string) => (n || '').split(' ')[0]
const dias = (n: number) => `${n} dia${n !== 1 ? 's' : ''}`

/** Sequências: da casa, "casa em dia", de cada uma, com recordes. */
export function StreaksCard({ streaks, names, me }: { streaks: Streaks, names: Names, me: Who | null }) {
  const row = (icon: string, label: string, sub: string, n: number, best: number, hot?: boolean) => (
    <div className="stk">
      <span className={`stk-ic ${hot && n > 0 ? 'hot' : ''}`} aria-hidden="true">{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="stk-t">{label}</span>
        <span className="stk-s">{sub}</span>
      </span>
      <span className="stk-n"><b>{n}</b><small>{n === 1 ? 'dia' : 'dias'}</small>{best > 0 && <span className="stk-best" title="Recorde">recorde {best}</span>}</span>
    </div>
  )
  return (
    <div className="card">
      <div className="slbl">🔥 Sequências</div>
      {row('🔥', 'Casa ativa', 'Dias seguidos com pelo menos uma conclusão', streaks.house, streaks.house_best, true)}
      {row('✅', 'Casa em dia', 'Todas as essenciais diárias feitas', streaks.on_track, streaks.on_track_best, true)}
      {(['g', 's'] as Who[]).map(w => (
        <div key={w}>{row(w === 'g' ? '🟢' : '🟣', `${first(names[w])}${me === w ? ' (você)' : ''}`, 'Dias seguidos concluindo algo', streaks[w], streaks[`${w}_best` as 'g_best' | 's_best'])}</div>
      ))}
      <div className="stk-note">A sequência de hoje só conta depois do primeiro check do dia; até lá, vale a de ontem. Ninguém perde a sequência no meio do dia. {streaks.house > 0 && streaks.house >= streaks.house_best ? `Vocês estão no recorde: ${dias(streaks.house)}! 🎉` : ''}</div>
    </div>
  )
}
