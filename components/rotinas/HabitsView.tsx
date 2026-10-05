'use client'
// Hábitos: constância, não cobrança. Dia sem registro fica só sem registro (nunca vira atraso).
import type { Names, Who } from '@/lib/types'
import { fmtDate } from '@/lib/dates'
import { WEEKDAYS } from '@/lib/onboarding'
import { HABIT_SUGGESTIONS, habitState, type Habit, type HabitLog } from '@/lib/rotinas'

const first = (n: string) => (n || '').split(' ')[0]

export function HabitsView({ habits, logs, available, today, me, names, onToggle, onEdit, onNew, onSuggest }: {
  habits: Habit[], logs: HabitLog[], available: boolean, today: string, me: Who | null, names: Names
  onToggle: (h: Habit, done: boolean) => void
  onEdit: (h: Habit) => void, onNew: () => void, onSuggest: (s: typeof HABIT_SUGGESTIONS[number]) => void
}) {
  if (!available) return <div className="card empty"><span className="empty-icon">🌱</span>Para usar hábitos, falta atualizar o banco (migration 016).</div>
  const owner = (h: Habit) => h.owner === 'shared' ? 'As duas' : first(names[h.owner])
  const freq = (h: Habit) => h.weekdays ? (h.weekdays.length === 7 ? 'Todos os dias' : [...h.weekdays].sort((a, b) => a - b).map(d => WEEKDAYS[d]).join(', ')) : `${h.weekly_target}x por semana`
  const existing = new Set(habits.map(h => h.title.toLowerCase()))
  return (
    <>
      <div className="card intro">
        <div className="intro-t">Hábito é o que vocês querem repetir para ganhar constância</div>
        <div className="row-s">Tem meta por semana e sequência. Se um dia não deu, fica só sem registro: hábito não vira atraso nem cobrança.</div>
      </div>
      <div className="rt-actions"><button className="btn btn-p" onClick={onNew}>+ Novo hábito</button></div>
      {HABIT_SUGGESTIONS.some(s => !existing.has(s.title.toLowerCase())) && <div className="hb-sugg">
        <span className="row-s">Sugestões:</span>
        {HABIT_SUGGESTIONS.filter(s => !existing.has(s.title.toLowerCase())).map(s => <button key={s.title} className="fc" onClick={() => onSuggest(s)}>+ {s.title}</button>)}
      </div>}
      {habits.length === 0 && <div className="card empty"><span className="empty-icon">🌱</span>Nenhum hábito ainda.</div>}
      <div className="rt-grid">
        {habits.map(h => {
          const st = habitState(h, logs, today)
          return (
            <section key={h.id} className={`rt-card hb ${st.doneToday ? 'done' : ''}`} aria-labelledby={`hb-${h.id}`} data-habit={h.title}>
              <div className="rt-card-h">
                <div style={{ minWidth: 0 }}><b id={`hb-${h.id}`}>{h.title}</b><div className="rt-card-m">{owner(h)} · {freq(h)}</div></div>
                <div className="rt-card-a">
                  {st.streak > 0 && <span className="chip amber" title="Sequência">🔥 {st.streak} {st.streak === 1 ? st.streakUnit.slice(0, -1) : st.streakUnit}</span>}
                  <button className="rt-edit" onClick={() => onEdit(h)} aria-label={`Editar ${h.title}`}>✎</button>
                </div>
              </div>
              <div className="rt-prog" aria-label={`${st.weekDone} de ${st.target} nesta semana`}>
                <span className="bar"><span className="barf" style={{ display: 'block', width: `${Math.min(100, st.weekDone / st.target * 100)}%`, background: 'var(--green)' }}/></span>
                <span className="mono">{st.weekDone}/{st.target} na semana</span>
              </div>
              <div className="hb-foot">
                <span className="hb-days" aria-label="Últimos 7 dias">
                  {st.last7.map(d => <i key={d.date} className={d.state} title={`${fmtDate(d.date)}: ${d.state === 'done' ? 'feito' : d.state === 'miss' ? 'sem registro' : d.state === 'today' ? 'hoje' : 'livre'}`}/>)}
                </span>
                {st.paused ? <span className="row-s">⏸ Pausado até {fmtDate(h.paused_until!)}</span>
                  : <button className={`btn ${st.doneToday ? 'btn-g' : 'btn-s'}`} disabled={!me} aria-pressed={st.doneToday} onClick={() => onToggle(h, !st.doneToday)}>
                    {st.doneToday ? `✓ Feito hoje${st.doneBy ? ` · ${first(names[st.doneBy])}` : ''}` : st.dueToday ? 'Fiz hoje' : 'Fiz hoje (extra)'}
                  </button>}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
