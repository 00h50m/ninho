'use client'
import type { Names, Who } from '@/lib/types'
import { leaderOf, DEFAULT_BET, type WeeklyScores } from '@/lib/gamification'

const first = (n: string) => (n || '').split(' ')[0]

/** Placar da semana entre as duas, com a aposta simbólica. */
export function Scoreboard({ scores, lastWeek, lastWeekBet, bet, names, me, compact, onEditBet, onOpen }: {
  scores: WeeklyScores, lastWeek: WeeklyScores, lastWeekBet: string | null, bet: string | null | undefined,
  names: Names, me: Who | null, compact?: boolean, onEditBet?: () => void, onOpen?: () => void,
}) {
  const lead = leaderOf(scores)
  const total = scores.g.xp + scores.s.xp
  const gPct = total ? Math.round(scores.g.xp / total * 100) : 50
  const prevLead = leaderOf(lastWeek)
  const hasPrev = lastWeek.g.xp + lastWeek.s.xp > 0
  const side = (w: Who) => (
    <div className={`sb-side sb-${w} ${lead === w ? 'lead' : ''}`}>
      <div className="sb-name">{lead === w && <span aria-label="na frente">👑 </span>}{first(names[w])}{me === w && <span className="you">você</span>}</div>
      <div className="sb-xp"><b>{scores[w].xp}</b><small>XP</small></div>
      {!compact && <div className="sb-meta">{scores[w].done} feita{scores[w].done !== 1 ? 's' : ''} · ⚡ {scores[w].on_time} no horário</div>}
    </div>
  )
  const body = (
    <>
      <div className="sb-row">{side('g')}<div className="sb-vs">×</div>{side('s')}</div>
      <div className="balance sb-bar" aria-hidden="true"><div style={{ width: gPct + '%', background: 'var(--gdk)', transition: 'width .4s' }} /><div style={{ flex: 1, background: 'var(--pur)' }} /></div>
      <div className="sb-bet">
        <span>🎲 {bet || DEFAULT_BET}</span>
        {onEditBet && <button className="lnk" onClick={e => { e.stopPropagation(); onEditBet() }}>Trocar aposta</button>}
      </div>
      {!compact && <div className="sb-foot">
        {lead === 'tie' ? (total ? 'Empate por enquanto.' : 'Semana começando: o primeiro check abre o placar.') : `${first(names[lead])} está ${Math.abs(scores.g.xp - scores.s.xp)} XP na frente.`}
        {scores.unknown.done > 0 && <> {scores.unknown.xp} XP sem autoria (aparelho sem identificação) não entram no placar.</>}
      </div>}
      {!compact && hasPrev && <div className="sb-prev">
        Semana passada: {prevLead === 'tie' ? `empate (${lastWeek.g.xp} × ${lastWeek.s.xp})` : `${first(names[prevLead])} venceu (${lastWeek[prevLead].xp} × ${lastWeek[prevLead === 'g' ? 's' : 'g'].xp})`}
        {prevLead !== 'tie' && <> · {first(names[prevLead === 'g' ? 's' : 'g'])} paga: {lastWeekBet || DEFAULT_BET}</>}
      </div>}
    </>
  )
  if (compact) return (
    <button className="card sb compact" onClick={onOpen} aria-label="Ver placar da semana">
      <div className="slbl">🏆 Placar da semana<span className="lnk">Ver →</span></div>
      {body}
    </button>
  )
  return <div className="card sb"><div className="slbl">🏆 Placar da semana</div>{body}</div>
}
