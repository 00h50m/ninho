'use client'
import { useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { TIER_NAMES, evaluate, type AchievementStats } from '@/lib/gamification'

const first = (n: string) => (n || '').split(' ')[0]

/** Conquistas por pessoa: bronze, prata e ouro, com o progresso até a próxima. */
export function Achievements({ stats, names, me }: { stats: AchievementStats, names: Names, me: Who | null }) {
  const [who, setWho] = useState<Who>(me || 'g')
  const list = evaluate(stats[who])
  const unlocked = list.filter(a => a.tier > 0).length
  return (
    <div className="card">
      <div className="slbl">🏅 Conquistas<span className="mono" style={{ marginLeft: 'auto', color: 'var(--sub)' }}>{unlocked}/{list.length}</span></div>
      <div className="asg ach-who" role="tablist" aria-label="De quem">
        {(['g', 's'] as Who[]).map(w => (
          <button key={w} role="tab" aria-selected={who === w} className={who === w ? `on-${w}` : ''} onClick={() => setWho(w)}>{first(names[w])}{me === w ? ' (você)' : ''}</button>
        ))}
      </div>
      <div className="ach-grid">
        {list.map(a => (
          <div key={a.def.id} className={`ach t${a.tier}`} title={`${a.def.name}: ${a.value} ${a.def.unit}`}>
            <span className="ach-ic" aria-hidden="true">{a.def.icon}</span>
            <span className="ach-body">
              <span className="ach-n">{a.def.name}</span>
              <span className="ach-tier">{a.tier ? TIER_NAMES[a.tier - 1] : 'Bloqueada'}</span>
              {a.tier < a.def.tiers.length
                ? <><span className="ach-bar"><span style={{ width: a.progress + '%' }} /></span><span className="ach-s">{a.value}/{a.next} {a.def.unit}</span></>
                : <span className="ach-s">Completa · {a.value} {a.def.unit}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="stk-note">Contam só as conclusões feitas com o aparelho identificado. As anteriores a esta versão (“não identificado”) ficam de fora.</div>
    </div>
  )
}
