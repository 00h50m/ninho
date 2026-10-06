'use client'
// Nós: desafios em dupla, registro do dia, histórico de check-ins, linha do tempo
// e "juntas nesta semana". Nada aqui coloca uma contra a outra.
import { useEffect, useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { Sheet } from '@/components/ui/Sheet'
import { addDays, fmtDate } from '@/lib/dates'
import { MOODS, moodOf } from '@/lib/week'
import { ENERGY } from '@/lib/constants'
import {
  CHALLENGE_IDEAS, KIND_LABEL, dayNotes, endOf, matchRef, moodGrid, progress,
  type Challenge, type ChallengeIdea, type ChallengeKind, type CheckinRow, type NosFacts, type TimelineItem,
} from '@/lib/nos'

const first = (n: string) => (n || '').split(' ')[0]
const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const wd = (d: string) => WD[new Date(d + 'T12:00:00Z').getUTCDay()]

// ── Desafios ─────────────────────────────────────────────────────────
type NewChallenge = Pick<Challenge, 'title' | 'kind' | 'ref_id' | 'per_day' | 'days' | 'goal' | 'start_date' | 'reward'>

export function ChallengeCard({ c, facts, today, names, refName, compact, onMark, onStatus, onDelete }: {
  c: Challenge, facts: NosFacts, today: string, names: Names, refName?: string | null, compact?: boolean
  onMark?: (c: Challenge, date: string, on: boolean) => void
  onStatus?: (c: Challenge, s: Challenge['status']) => void
  onDelete?: (c: Challenge) => void
}) {
  const p = progress(c, facts, today)
  const yesterday = addDays(today, -1)
  const yHit = p.days.find(d => d.date === yesterday)
  const state = c.status === 'active' ? p.state : c.status
  const by = (d: string) => facts.marks.find(m => m.challenge_id === c.id && m.date === d)?.who
  return (
    <article className={`card chl chl-${state}`} aria-label={`Desafio ${c.title}`} data-id={c.id}>
      <div className="chl-h">
        <div style={{ minWidth: 0 }}>
          <div className="chl-t">{state === 'done' ? '🏆 ' : '🤝 '}{c.title}</div>
          <div className="row-s">{KIND_LABEL[c.kind]}{refName ? ` · ${refName}` : ''}{c.kind === 'tarefas' ? ` · ${c.per_day} por dia` : ''} · {fmtDate(c.start_date)} a {fmtDate(endOf(c))}</div>
        </div>
        <div className="chl-n" aria-label={`${p.hits} de ${c.goal} dias`}><b>{p.hits}</b>/{c.goal}</div>
      </div>
      <ol className="chl-days" aria-label="Dias do desafio">
        {p.days.map(d => (
          <li key={d.date} className={`${d.hit ? 'hit' : ''} ${d.future ? 'fut' : ''} ${d.today ? 'today' : ''}`} title={`${fmtDate(d.date)}${d.hit ? ' · contou' : d.future ? '' : ' · não contou'}`}>
            <span aria-hidden="true">{d.hit ? '✓' : ''}</span><small>{wd(d.date)}</small>
            <span className="sr-only">{fmtDate(d.date)}: {d.hit ? 'contou' : d.future ? 'ainda vai chegar' : 'não contou'}</span>
          </li>
        ))}
      </ol>
      {state === 'active' && <div className="chl-foot">
        <span className="row-s">{p.left === 0 ? 'Meta batida!' : `Faltam ${p.left} dia${p.left > 1 ? 's' : ''}`}{c.reward ? ` · 🎁 ${c.reward}` : ''}</span>
        {c.kind === 'livre' && onMark && <div className="chl-acts">
          {yHit && !yHit.hit && <button className="btn btn-g btn-s" onClick={() => onMark(c, yesterday, true)}>Marcar ontem</button>}
          <button className={`btn btn-s ${p.todayHit ? 'btn-g' : 'btn-p'}`} aria-pressed={p.todayHit} onClick={() => onMark(c, today, !p.todayHit)}>
            {p.todayHit ? `✓ Hoje feito${by(today) ? ` (${first(names[by(today)!])})` : ''}` : 'Fizemos hoje'}</button>
        </div>}
      </div>}
      {state === 'done' && <div className="chl-foot"><span className="chl-win">Conseguimos juntas!{c.reward ? ` 🎁 ${c.reward}` : ''}</span></div>}
      {state === 'missed' && <div className="chl-foot"><span className="row-s">Não deu desta vez ({p.hits} de {c.goal}). Tudo bem: dá para tentar de novo.</span></div>}
      {!compact && (onStatus || onDelete) && <div className="chl-more">
        {state === 'active' && onStatus && <button className="lnk-inline" onClick={() => { if (confirm('Encerrar este desafio sem contar?')) onStatus(c, 'cancelled') }}>encerrar</button>}
        {state !== 'active' && onDelete && <button className="lnk-inline" onClick={() => { if (confirm('Apagar este desafio do histórico?')) onDelete(c) }}>apagar</button>}
      </div>}
    </article>
  )
}

export function ChallengesView({ challenges, facts, today, names, routines, habits, suggestion, onCreate, onMark, onStatus, onDelete }: {
  challenges: Challenge[], facts: NosFacts, today: string, names: Names
  routines: Array<{ id: string, title: string }>, habits: Array<{ id: string, title: string }>
  suggestion?: { title: string, days: number, why: string } | null
  onCreate: (v: NewChallenge) => Promise<void>
  onMark: (c: Challenge, date: string, on: boolean) => void
  onStatus: (c: Challenge, s: Challenge['status']) => void
  onDelete: (c: Challenge) => void
}) {
  const [sheet, setSheet] = useState<ChallengeIdea | 'novo' | null>(null)
  const active = challenges.filter(c => c.status === 'active')
  const past = challenges.filter(c => c.status !== 'active')
  const refName = (c: Challenge) => c.kind === 'rotina' ? routines.find(r => r.id === c.ref_id)?.title : c.kind === 'habito' ? habits.find(h => h.id === c.ref_id)?.title : null
  const ideas: ChallengeIdea[] = [
    ...(suggestion && !challenges.some(c => c.title === suggestion.title) ? [{ title: suggestion.title, kind: 'livre' as const, days: suggestion.days, goal: suggestion.days, why: `${suggestion.why} · sugerido na configuração` }] : []),
    ...CHALLENGE_IDEAS.filter(i => !active.some(c => c.title === i.title)),
  ].slice(0, 6)
  return (
    <>
      <div className="intro card">
        <div className="intro-t">Desafios em dupla: as duas do mesmo lado</div>
        <div className="row-s">Uma meta curta para a casa. Ninguém ganha da outra: ou conseguimos juntas, ou tentamos de novo.</div>
      </div>
      <div className="rt-actions"><button className="btn btn-p" onClick={() => setSheet('novo')}>+ Novo desafio</button></div>
      {active.length === 0 && <div className="card empty"><span className="empty-icon">🤝</span>Nenhum desafio agora. Escolha uma sugestão abaixo ou crie o de vocês.</div>}
      <div className="chl-grid">{active.map(c => <ChallengeCard key={c.id} c={c} facts={facts} today={today} names={names} refName={refName(c)} onMark={onMark} onStatus={onStatus} onDelete={onDelete}/>)}</div>
      {ideas.length > 0 && <>
        <div className="slbl rt-sec">Sugestões</div>
        <div className="chl-ideas">{ideas.map(i => (
          <button key={i.title} className="chl-idea" onClick={() => setSheet(i)}>
            <b>{i.title}</b><small>{i.goal === i.days ? `${i.days} dias` : `${i.goal} de ${i.days} dias`} · {i.why}</small>
          </button>))}</div>
      </>}
      {past.length > 0 && <>
        <div className="slbl rt-sec">Histórico <span className="mono" style={{ color: 'var(--faint)' }}>{past.filter(c => c.status === 'done').length} conquistado(s)</span></div>
        <div className="chl-grid">{past.slice(0, 12).map(c => <ChallengeCard key={c.id} c={c} facts={facts} today={today} names={names} refName={refName(c)} onDelete={onDelete}/>)}</div>
      </>}
      {sheet && <ChallengeSheet idea={sheet === 'novo' ? null : sheet} today={today} routines={routines} habits={habits} onClose={() => setSheet(null)} onSave={onCreate}/>}
    </>
  )
}

function ChallengeSheet({ idea, today, routines, habits, onClose, onSave }: {
  idea: ChallengeIdea | null, today: string, routines: Array<{ id: string, title: string }>, habits: Array<{ id: string, title: string }>
  onClose: () => void, onSave: (v: NewChallenge) => Promise<void>
}) {
  const auto = idea?.kind === 'rotina' ? matchRef(routines, idea.match) : null
  const [title, setTitle] = useState(idea?.title || '')
  const [kind, setKind] = useState<ChallengeKind>(idea?.kind === 'rotina' && !auto ? 'livre' : idea?.kind || 'livre')
  const [ref, setRef] = useState<string>(auto?.id || routines[0]?.id || '')
  const [habit, setHabit] = useState<string>(habits[0]?.id || '')
  const [days, setDays] = useState(String(idea?.days || 7)), [goal, setGoal] = useState(String(idea?.goal || 7))
  const [perDay, setPerDay] = useState(String(idea?.per_day || 3)), [start, setStart] = useState(today), [reward, setReward] = useState('')
  const [busy, setBusy] = useState(false)
  const d = Math.max(1, Math.min(60, Number(days) || 0)), g = Math.max(1, Math.min(d, Number(goal) || 0))
  const kinds: Array<[ChallengeKind, string, boolean]> = [
    ['livre', 'Marcamos no app', true], ['rotina', 'Rotina concluída', routines.length > 0], ['habito', 'Hábito registrado', habits.length > 0],
    ['checkin', 'Check-in das duas', true], ['tarefas', 'Tarefas do dia', true], ['sprint', 'Sprint do Ninho', true],
  ]
  const ok = title.trim().length > 0 && (kind !== 'rotina' || !!ref) && (kind !== 'habito' || !!habit)
  async function save() {
    setBusy(true)
    try {
      await onSave({ title: title.trim().slice(0, 60), kind, ref_id: kind === 'rotina' ? ref : kind === 'habito' ? habit : null, per_day: kind === 'tarefas' ? Math.max(1, Math.min(20, Number(perDay) || 1)) : 1, days: d, goal: g, start_date: start, reward: reward.trim() || null })
      onClose()
    } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  return (
    <Sheet title={idea ? 'Começar desafio' : 'Novo desafio'} onClose={onClose} footer={<button className="btn btn-p" disabled={busy || !ok} onClick={save}>{busy ? 'Salvando…' : 'Começar'}</button>}>
      <label className="onb-f"><span>Desafio</span><input className="fi" value={title} maxLength={60} placeholder="Ex.: cozinha fechada todas as noites" onChange={e => setTitle(e.target.value)}/></label>
      <div className="onb-q">Como o dia conta</div>
      <div className="onb-days wrap" role="radiogroup" aria-label="Como o dia conta">
        {kinds.filter(k => k[2]).map(([k, l]) => <button key={k} role="radio" aria-checked={kind === k} className={`onb-day wide ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <p className="row-s" style={{ marginTop: 6 }}>{kind === 'livre' ? 'Qualquer uma das duas marca "Fizemos hoje" (dá para marcar ontem até o fim do dia).'
        : kind === 'checkin' ? 'Conta quando as duas fazem o check-in do dia.'
        : kind === 'tarefas' ? 'Conta quando a casa conclui pelo menos essa quantidade de tarefas no dia.'
        : kind === 'sprint' ? 'Conta no dia em que um Sprint do Ninho é encerrado.'
        : 'Conta sozinho quando a rotina ou o hábito é concluído.'}</p>
      {kind === 'rotina' && <label className="onb-f"><span>Rotina</span><select className="fi" value={ref} onChange={e => setRef(e.target.value)}>{routines.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>}
      {kind === 'habito' && <label className="onb-f"><span>Hábito</span><select className="fi" value={habit} onChange={e => setHabit(e.target.value)}>{habits.map(h => <option key={h.id} value={h.id}>{h.title}</option>)}</select></label>}
      <div className="onb-row">
        <label className="onb-f"><span>Duração (dias)</span><input className="fi" inputMode="numeric" value={days} onChange={e => setDays(e.target.value)}/></label>
        <label className="onb-f"><span>Meta (dias que contam)</span><input className="fi" inputMode="numeric" value={goal} onChange={e => setGoal(e.target.value)}/></label>
        {kind === 'tarefas' && <label className="onb-f"><span>Tarefas por dia</span><input className="fi" inputMode="numeric" value={perDay} onChange={e => setPerDay(e.target.value)}/></label>}
        <label className="onb-f"><span>Começa em</span><input className="fi" type="date" value={start} min={addDays(today, -6)} onChange={e => setStart(e.target.value || today)}/></label>
      </div>
      <label className="onb-f"><span>Recompensa do casal (opcional)</span><input className="fi" value={reward} maxLength={80} placeholder="Ex.: pizza no sábado" onChange={e => setReward(e.target.value)}/></label>
      <p className="row-s">Resumo: {g === d ? `${d} dias seguidos` : `${g} de ${d} dias`}, de {fmtDate(start)} a {fmtDate(addDays(start, d - 1))}.</p>
    </Sheet>
  )
}

// ── Registro do dia ──────────────────────────────────────────────────
export function DayNoteCard({ me, names, today, rows, onSave }: {
  me: Who, names: Names, today: string, rows: CheckinRow[], onSave: (v: { good: string, need: string, thanks: string }) => Promise<void>
}) {
  const mine = rows.find(r => r.who === me && r.date === today)
  const other: Who = me === 'g' ? 's' : 'g'
  const theirs = rows.find(r => r.who === other && r.date === today)
  const [v, setV] = useState({ good: mine?.good || '', need: mine?.need || '', thanks: mine?.thanks || '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { setV({ good: mine?.good || '', need: mine?.need || '', thanks: mine?.thanks || '' }) }, [mine?.good, mine?.need, mine?.thanks])
  const dirty = v.good !== (mine?.good || '') || v.need !== (mine?.need || '') || v.thanks !== (mine?.thanks || '')
  const f = (k: keyof typeof v, l: string, ph: string) => <label className="onb-f"><span>{l}</span><input className="fi" value={v[k]} maxLength={280} placeholder={ph} onChange={e => setV(x => ({ ...x, [k]: e.target.value }))}/></label>
  return (
    <section className="card dn" aria-labelledby="dn-h">
      <div className="slbl" id="dn-h">📝 Registro do dia</div>
      {f('good', 'O que foi bom hoje', 'Ex.: jantar com calma')}
      {f('need', 'Do que eu precisei', 'Ex.: uma pausa depois do trabalho')}
      {f('thanks', `Agradeço à ${first(names[other])}`, 'Ex.: por ter passeado com as cachorras')}
      <button className="btn btn-s" disabled={busy || !dirty} onClick={async () => { setBusy(true); try { await onSave(v) } catch { /* aviso já mostrado */ } finally { setBusy(false) } }}>{busy ? 'Salvando…' : mine && (mine.good || mine.need || mine.thanks) ? 'Atualizar registro' : 'Salvar registro'}</button>
      <div className="dn-other">
        <div className="row-s"><b>{first(names[other])} hoje</b></div>
        {theirs && (theirs.good || theirs.need || theirs.thanks) ? <ul>
          {theirs.good && <li>🌤 {theirs.good}</li>}{theirs.need && <li>🫶 Precisou: {theirs.need}</li>}{theirs.thanks && <li>💛 Agradece: {theirs.thanks}</li>}
        </ul> : <div className="row-s">Ainda não escreveu hoje.</div>}
      </div>
    </section>
  )
}

// ── Histórico de check-ins ───────────────────────────────────────────
export function CheckinHistory({ rows, names, today, days = 28 }: { rows: CheckinRow[], names: Names, today: string, days?: number }) {
  const [sel, setSel] = useState<{ who: Who, date: string } | null>(null)
  const s = sel ? rows.find(r => r.who === sel.who && r.date === sel.date) : null
  const notes = dayNotes(rows, addDays(today, -days + 1))
  return (
    <section className="card" aria-labelledby="ch-h">
      <div className="slbl" id="ch-h">Como chegamos · últimos {days} dias</div>
      {(['g', 's'] as Who[]).map(w => {
        const g = moodGrid(rows, w, today, days)
        const n = g.filter(x => x.mood).length
        return (
          <div key={w} className="mg">
            <div className="mg-n"><span className={`mini av-${w}`} aria-hidden="true">{names[w].slice(0, 1).toUpperCase()}</span>{first(names[w])}<small>{n} check-in{n === 1 ? '' : 's'}</small></div>
            <ol className="mg-row" aria-label={`Humor de ${first(names[w])}`}>
              {g.map(x => { const m = moodOf(x.mood); return (
                <li key={x.date}><button className={`mg-c ${m ? 'm-' + m.id : ''} ${x.date === today ? 'today' : ''} ${sel?.who === w && sel.date === x.date ? 'on' : ''}`}
                  aria-label={`${fmtDate(x.date)}: ${m ? m.label : 'sem check-in'}${x.energy ? `, energia ${ENERGY[x.energy as 'high'].short.toLowerCase()}` : ''}`}
                  onClick={() => setSel(sel?.who === w && sel.date === x.date ? null : { who: w, date: x.date })}>{m ? m.emoji : ''}</button></li>) })}
            </ol>
          </div>
        )
      })}
      <div className="mg-legend" aria-hidden="true">{MOODS.map(m => <span key={m.id}>{m.emoji} {m.label}</span>)}</div>
      {sel && <div className="mg-sel" role="status">
        <b>{first(names[sel.who])} · {fmtDate(sel.date)}</b>{' '}
        {s ? <>{moodOf(s.mood) ? `${moodOf(s.mood)!.emoji} ${moodOf(s.mood)!.label}` : ''}{s.energy ? ` · ${ENERGY[s.energy as 'high'].ic} ${ENERGY[s.energy as 'high'].short}` : ''}{s.note && <em> “{s.note}”</em>}
          {s.good && <div>🌤 {s.good}</div>}{s.need && <div>🫶 Precisou: {s.need}</div>}{s.thanks && <div>💛 Agradece: {s.thanks}</div>}</> : 'Sem check-in neste dia.'}
      </div>}
      {notes.length > 0 && <>
        <div className="slbl rt-sec" style={{ marginTop: 14 }}>Registros</div>
        <ul className="dn-feed">{notes.slice(0, 20).map(r => (
          <li key={r.date + r.who}><span className="mono">{fmtDate(r.date)}</span> <b>{first(names[r.who])}</b>
            {r.good && <div>🌤 {r.good}</div>}{r.need && <div>🫶 Precisou: {r.need}</div>}{r.thanks && <div>💛 Agradece: {r.thanks}</div>}</li>))}</ul>
      </>}
    </section>
  )
}

// ── Linha do tempo e "juntas nesta semana" ───────────────────────────
export function TimelineCard({ items }: { items: TimelineItem[] }) {
  return (
    <section className="card" aria-labelledby="tl-h">
      <div className="slbl" id="tl-h">Linha do tempo do casal</div>
      {items.length === 0 ? <div className="row-s">Reuniões, sprints e desafios conquistados aparecem aqui.</div>
        : <ol className="tl">{items.map((i, k) => <li key={k}><span className="mono">{fmtDate(i.date)}</span><span aria-hidden="true">{i.icon}</span><span>{i.text}</span></li>)}</ol>}
    </section>
  )
}

export function TogetherCard({ done, runs, habits, sprints, xp, streak, onOpenMeeting, meetingDone }: {
  done: number, runs: number, habits: number, sprints: number, xp: number, streak: number, onOpenMeeting: () => void, meetingDone: boolean
}) {
  const box = (n: number, l: string) => <div className="tg-b"><b>{n}</b><small>{l}</small></div>
  return (
    <section className="card tg" aria-labelledby="tg-h">
      <div className="slbl" id="tg-h">Juntas nesta semana</div>
      <div className="tg-grid">{box(done, 'tarefas')}{box(runs, 'rotinas')}{box(habits, 'hábitos')}{box(sprints, 'sprints')}</div>
      <div className="row-s" style={{ marginTop: 10 }}>{xp} XP do casal nesta semana{streak > 1 ? ` · 💬 ${streak} dias seguidos de check-in das duas` : ''}</div>
      <button className={`btn btn-w ${meetingDone ? 'btn-g' : 'btn-p'}`} style={{ marginTop: 12 }} onClick={onOpenMeeting}>{meetingDone ? '📋 Ver a reunião da semana' : '📋 Fazer a reunião da semana'}</button>
    </section>
  )
}
