'use client'
// Meu dia: a parte individual de cada uma. Água, sono, autocuidado, remédios,
// treinos (com cargas) e evolução física. Cada uma escolhe o que a outra vê.
import { useMemo, useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { Sheet } from '@/components/ui/Sheet'
import { fmtDate } from '@/lib/dates'
import {
  BODY_FIELDS, DEFAULT_SETTINGS, PKINDS, WORKOUT_TYPES, bodySeries, change, dosesToday, exerciseNames, loadSeries, selfcareDone,
  quitStats, sleepHours, sleepWeek, waterOn, waterStreak, workoutLabel, workoutsWeek, type Exercise, type PKind, type PLog, type PMed, type PQuit, type PSettings,
} from '@/lib/meudia'
import { LineChart } from './LineChart'
import { SleepBars } from './SleepBars'
import { FoodTab, foodLine } from './Alimentacao'
import type { CustomFood, FoodProfile } from '@/lib/nutricao'

const first = (n: string) => (n || '').split(' ')[0]
const fmtN = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
type Tab = 'hoje' | 'comida' | 'treinos' | 'corpo' | 'ajustes'

export interface MeuDiaProps {
  available: boolean, reason?: string, me: Who, names: Names, today: string, nowHM: string
  settings: PSettings[], logs: PLog[], meds: PMed[], quits: PQuit[], quitsReady?: boolean
  profiles: FoodProfile[], foods: CustomFood[], foodReady?: boolean
  onAdd: (kind: PKind, value: number | null, data?: Record<string, any>) => Promise<void>
  onRemove: (l: PLog) => Promise<void>
  onSaveSettings: (s: Partial<Omit<PSettings, 'who'>>) => Promise<void>
  onSaveMed: (m: { id?: string, name: string, dose: string | null, times: string[] }) => Promise<void>
  onStopMed: (m: PMed) => Promise<void>
  onSaveQuit: (q: { id?: string, title: string, reason: string | null }) => Promise<void>
  onStopQuit: (q: PQuit) => Promise<void>
  onSaveProfile: (p: Omit<FoodProfile, 'who'>) => Promise<void>
  onSaveFood: (f: Omit<CustomFood, 'id' | 'who'> & { id?: string }) => Promise<void>
  onStopFood: (f: CustomFood) => Promise<void>
}

export function MeuDiaView(p: MeuDiaProps) {
  const [tab, setTab] = useState<Tab>('hoje')
  if (!p.available) return <div className="card empty"><span className="empty-icon">💧</span>O Meu dia ainda não está ativo: falta rodar a atualização do banco (migration 021) no Supabase.{p.reason && <div className="row-s" style={{ marginTop: 6 }}>Detalhe: {p.reason}</div>}</div>
  const mine = p.settings.find(s => s.who === p.me) || DEFAULT_SETTINGS(p.me)
  const other: Who = p.me === 'g' ? 's' : 'g'
  const theirs = p.settings.find(s => s.who === other)
  return (
    <div className="md">
      <div className="md-tabs" role="tablist" aria-label="Meu dia">
        {([['hoje', 'Hoje'], ['comida', 'Alimentação'], ['treinos', 'Treinos'], ['corpo', 'Evolução'], ['ajustes', 'Metas e privacidade']] as Array<[Tab, string]>).map(([k, l]) =>
          <button key={k} role="tab" aria-selected={tab === k} className={`fc ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'hoje' && <Today {...p} s={mine} other={other} theirs={theirs}/>}
      {tab === 'comida' && <FoodTab {...p}/>}
      {tab === 'treinos' && <Workouts {...p}/>}
      {tab === 'corpo' && <Body {...p}/>}
      {tab === 'ajustes' && <Settings {...p} s={mine}/>}
    </div>
  )
}

function Today(p: MeuDiaProps & { s: PSettings, other: Who, theirs?: PSettings }) {
  const { me, today, logs, s } = p
  const water = waterOn(logs, me, today), pct = Math.min(100, Math.round(water / s.water_goal_ml * 100))
  const streak = waterStreak(logs, me, s.water_goal_ml, today)
  const done = selfcareDone(logs, me, today)
  const doses = dosesToday(p.meds, logs, me, today, p.nowHM)
  const wk = workoutsWeek(logs, me, today)
  const [workout, setWorkout] = useState(false)
  const lastCup = [...logs].reverse().find(l => l.who === me && l.kind === 'agua' && l.date === today)
  const run = (f: () => Promise<void>) => { f().catch(() => {}) }
  // a outra (só o que ela compartilhou; o banco não entrega o resto)
  const sh = p.theirs?.share || {}
  const anyShared = PKINDS.some(([k]) => sh[k])
  return (
    <>
      <div className="md-grid">
        <section className="card md-card" aria-labelledby="md-agua">
          <div className="slbl" id="md-agua">💧 Água {streak > 0 && <span className="chip amber">🔥 {streak} dia{streak > 1 ? 's' : ''} na meta</span>}</div>
          <div className="md-water"><b className="mono">{(water / 1000).toFixed(2).replace('.', ',')} L</b><span>de {(s.water_goal_ml / 1000).toFixed(1).replace('.', ',')} L</span></div>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Água de hoje"><div className="barf" style={{ width: `${pct}%`, background: 'var(--pri)' }}/></div>
          <div className="md-acts">
            <button className="btn btn-p" onClick={() => run(() => p.onAdd('agua', s.cup_ml))}>+1 copo ({s.cup_ml} ml)</button>
            <button className="btn btn-g" onClick={() => run(() => p.onAdd('agua', 500))}>+500 ml</button>
            {lastCup && <button className="lnk-inline" onClick={() => run(() => p.onRemove(lastCup))}>desfazer</button>}
          </div>
        </section>

        <SleepCard {...p} run={run}/>

        <section className="card md-card" aria-labelledby="md-cuidado">
          <div className="slbl" id="md-cuidado">🌿 Autocuidado <span className="mono" style={{ color: 'var(--faint)' }}>{done.size}/{s.selfcare.length}</span></div>
          <ul className="rt-check">{s.selfcare.map(item => {
            const on = done.has(item), log = logs.find(l => l.who === me && l.kind === 'autocuidado' && l.date === today && l.data?.item === item)
            return <li key={item}><button className={`rt-step ${on ? 'on' : ''}`} role="checkbox" aria-checked={on} onClick={() => run(() => on && log ? p.onRemove(log) : p.onAdd('autocuidado', null, { item }))}>
              <span className="rt-box" aria-hidden="true">{on ? '✓' : ''}</span><span className="rt-step-t">{item}</span></button></li>
          })}</ul>
        </section>

        <section className="card md-card" aria-labelledby="md-rem">
          <div className="slbl" id="md-rem">💊 Remédios</div>
          {doses.length === 0 ? <div className="row-s">Nenhum remédio cadastrado. Cadastre em “Metas e privacidade”.</div> :
            <ul className="rt-check">{doses.map(d => <li key={d.med.id + d.time}><button className={`rt-step ${d.taken ? 'on' : ''}`} role="checkbox" aria-checked={!!d.taken}
              onClick={() => run(() => d.taken ? p.onRemove(d.taken) : p.onAdd('remedio', null, { med_id: d.med.id, name: d.med.name, time: d.time }))}>
              <span className="rt-box" aria-hidden="true">{d.taken ? '✓' : ''}</span>
              <span className="rt-step-t">{d.med.name}{d.med.dose ? ` · ${d.med.dose}` : ''}</span>
              <span className={`mono ${d.late ? 'md-late' : ''}`}>{d.time || 'livre'}{d.late ? ' · atrasado' : ''}</span></button></li>)}</ul>}
          <p className="row-s" style={{ marginTop: 6 }}>Só lembrete e registro. Dúvidas sobre remédio: fale com quem receitou.</p>
        </section>

        <section className="card md-card" aria-labelledby="md-treino">
          <div className="slbl" id="md-treino">🏋️ Treino</div>
          <div className="md-water"><b className="mono">{wk.count}</b><span>treino{wk.count === 1 ? '' : 's'} nesta semana · {wk.minutes} min</span></div>
          <button className="btn btn-s" onClick={() => setWorkout(true)}>+ Registrar treino</button>
        </section>

        {p.quitsReady !== false && <QuitCard {...p} run={run}/>}
      </div>

      <section className="card md-other" aria-labelledby="md-outra">
        <div className="slbl" id="md-outra">{first(p.names[p.other])} hoje</div>
        {!anyShared ? <div className="row-s">{first(p.names[p.other])} ainda não compartilha nada do Meu dia.</div> : <div className="md-other-g">
          {sh.agua && <span>💧 {fmtN(waterOn(logs, p.other, today) / 1000)} / {fmtN((p.theirs?.water_goal_ml || 2000) / 1000)} L</span>}
          {sh.sono && (() => { const x = logs.find(l => l.who === p.other && l.kind === 'sono' && l.date === today); return <span>😴 {x ? `${fmtN(Number(x.value))} h` : 'sem registro'}</span> })()}
          {sh.autocuidado && <span>🌿 {selfcareDone(logs, p.other, today).size} cuidado(s)</span>}
          {sh.remedio && (() => { const d = dosesToday(p.meds, logs, p.other, today, p.nowHM); return <span>💊 {d.filter(x => x.taken).length}/{d.length} doses</span> })()}
          {sh.treino && (() => { const w = workoutsWeek(logs, p.other, today); return <span>🏋️ {w.count} treino(s) na semana</span> })()}
          {sh.corpo && <span>📏 evolução compartilhada</span>}
          {sh.refeicao && (() => { const l = foodLine(logs, p.profiles, p.other, today); return <span>{l || '🍽️ sem refeições hoje'}</span> })()}
          {sh.parar && p.quits.filter(q => q.who === p.other).map(q => <span key={q.id}>🚭 {q.title}: {quitStats(q, logs, today).days} dia(s)</span>)}
        </div>}
      </section>
      {workout && <WorkoutSheet {...p} onClose={() => setWorkout(false)}/>}
    </>
  )
}

function SleepCard(p: MeuDiaProps & { s: PSettings, run: (f: () => Promise<void>) => void }) {
  const { me, today, logs, s, run } = p
  const [bed, setBed] = useState('23:00'), [wake, setWake] = useState('07:00'), [quality, setQuality] = useState<'boa' | 'ok' | 'ruim'>('ok')
  const night = logs.find(l => l.who === me && l.kind === 'sono' && l.date === today)
  const w = sleepWeek(logs, me, today, s.sleep_goal_h)
  const h = night ? Number(night.value) : 0, pct = Math.round(h / s.sleep_goal_h * 100)
  const R = 34, C = 2 * Math.PI * R
  return (
    <section className="card md-card md-wide" aria-labelledby="md-sono">
      <div className="slbl" id="md-sono">😴 Sono {w.onGoal > 0 && <span className="chip amber">🌙 {w.onGoal} noite{w.onGoal > 1 ? 's' : ''} na meta</span>}</div>
      <div className="sl-top">
        {night ? <div className="sl-night">
          <svg className="sl-ring" viewBox="0 0 80 80" role="img" aria-label={`${fmtN(h)} horas, ${pct}% da meta de ${fmtN(s.sleep_goal_h)} h`}>
            <circle className="sl-ring-bg" cx="40" cy="40" r={R}/>
            <circle className="sl-ring-f" cx="40" cy="40" r={R} strokeDasharray={`${Math.min(1, h / s.sleep_goal_h) * C} ${C}`} transform="rotate(-90 40 40)"/>
            <text x="40" y="40" textAnchor="middle" className="sl-ring-h">{fmtN(h)} h</text>
            <text x="40" y="54" textAnchor="middle" className="sl-ring-p">{pct}%</text>
          </svg>
          <div className="sl-det">
            <b>Noite de hoje</b>
            <span className="mono">{night.data.bed}–{night.data.wake}</span>
            <span>{night.data.quality === 'boa' ? '😊 boa' : night.data.quality === 'ruim' ? '😣 ruim' : '😐 ok'} · meta {fmtN(s.sleep_goal_h)} h</span>
            <button className="lnk-inline" onClick={() => run(() => p.onRemove(night))}>refazer</button>
          </div>
        </div> : <div className="sl-form">
          <div className="onb-q" style={{ marginTop: 0 }}>Registrar minha noite</div>
          <div className="onb-row">
            <label className="onb-f"><span>Dormi</span><input className="fi" type="time" value={bed} onChange={e => setBed(e.target.value)}/></label>
            <label className="onb-f"><span>Acordei</span><input className="fi" type="time" value={wake} onChange={e => setWake(e.target.value)}/></label>
          </div>
          <div className="onb-days" role="radiogroup" aria-label="Qualidade do sono">
            {([['boa', '😊 Boa'], ['ok', '😐 Ok'], ['ruim', '😣 Ruim']] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={quality === k} className={`onb-day wide ${quality === k ? 'on' : ''}`} onClick={() => setQuality(k)}>{l}</button>)}
          </div>
          <button className="btn btn-s" style={{ marginTop: 8 }} disabled={!bed || !wake} onClick={() => run(() => p.onAdd('sono', sleepHours(bed, wake), { bed, wake, quality }))}>Registrar {fmtN(sleepHours(bed || '00:00', wake || '00:00'))} h</button>
        </div>}
        <dl className="sl-stats">
          <div><dt>Média da semana</dt><dd><b className="mono">{w.avg != null ? `${fmtN(w.avg)} h` : '—'}</b></dd></div>
          <div><dt>Melhor noite</dt><dd><b className="mono">{w.best ? `${fmtN(w.best.h)} h` : '—'}</b>{w.best && <small>{w.best.date === today ? 'hoje' : fmtDate(w.best.date)}</small>}</dd></div>
          <div><dt>Noites na meta</dt><dd><b className="mono">{w.onGoal}</b><small>seguidas</small></dd></div>
          <div><dt>Dívida de sono</dt><dd><b className="mono">{w.debt > 0 ? `${fmtN(w.debt)} h` : '0 h'}</b><small>na semana</small></dd></div>
        </dl>
      </div>
      {w.logged > 0 ? <SleepBars days={w.days} goal={s.sleep_goal_h} today={today}/> : <div className="lc-empty">Registre suas noites para ver a semana.</div>}
      {w.debt >= 3 && <p className="row-s">A semana ficou curta de sono. Dormir um pouco mais cedo nas próximas noites ajuda a recuperar.</p>}
    </section>
  )
}

function QuitCard(p: MeuDiaProps & { run: (f: () => Promise<void>) => void }) {
  const mine = p.quits.filter(q => q.who === p.me)
  const [relapse, setRelapse] = useState<PQuit | null>(null)
  return (
    <section className="card md-card" aria-labelledby="md-parar">
      <div className="slbl" id="md-parar">🚭 Parar de…</div>
      {mine.length === 0 ? <div className="row-s">Quer largar algum hábito? Cadastre em “Metas e privacidade” e acompanhe os dias aqui.</div> :
        <ul className="qt-list">{mine.map(q => {
          const st = quitStats(q, p.logs, p.today)
          return <li key={q.id} className="qt">
            <div className="qt-n"><b className="mono">{st.days}</b><span>dia{st.days === 1 ? '' : 's'}</span></div>
            <div className="qt-t">
              <b>{q.title}</b>
              <small>{st.record > st.days ? `Recorde: ${st.record} dias` : st.days > 0 ? 'Seu recorde é agora' : `Desde ${st.since === p.today ? 'hoje' : fmtDate(st.since)}`}{st.relapses30 > 0 ? ` · ${st.relapses30} recaída${st.relapses30 > 1 ? 's' : ''} em 30 dias` : ''}</small>
              {q.reason && <small className="qt-r">“{q.reason}”</small>}
            </div>
            <button className="lnk-inline" onClick={() => setRelapse(q)}>Tive uma recaída</button>
          </li>
        })}</ul>}
      {relapse && <RelapseSheet q={relapse} onClose={() => setRelapse(null)} onSave={note => p.onAdd('parar', null, { quit_id: relapse.id, title: relapse.title, note })}/>}
    </section>
  )
}

function RelapseSheet({ q, onClose, onSave }: { q: PQuit, onClose: () => void, onSave: (note: string | null) => Promise<void> }) {
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try { await onSave(note.trim() || null); onClose() } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  return (
    <Sheet title={`Recaída · ${q.title}`} onClose={onClose} footer={<button className="btn btn-p" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Registrar e recomeçar'}</button>}>
      <p className="row-s" style={{ marginBottom: 10 }}>Acontece. O contador recomeça hoje e o seu recorde continua guardado. Cada dia conta.</p>
      <label className="onb-f"><span>O que aconteceu? (opcional)</span><input className="fi" value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="Ex.: dia estressante no trabalho"/></label>
      <p className="row-s" style={{ marginTop: 6 }}>Se você compartilhar “Parar de…”, a outra pessoa vê os dias e as recaídas.</p>
    </Sheet>
  )
}

function WorkoutSheet(p: MeuDiaProps & { onClose: () => void }) {
  const [type, setType] = useState('musculacao'), [min, setMin] = useState('45'), [intensity, setIntensity] = useState<'leve' | 'moderado' | 'forte'>('moderado')
  const [ex, setEx] = useState<Exercise[]>([{ name: '', sets: 3, reps: 10, kg: null }]), [notes, setNotes] = useState(''), [busy, setBusy] = useState(false)
  const names = useMemo(() => exerciseNames(p.logs, p.me), [p.logs, p.me])
  const setE = (i: number, patch: Partial<Exercise>) => setEx(l => l.map((x, j) => j === i ? { ...x, ...patch } : x))
  const num = (v: string) => v.trim() ? Number(v.replace(',', '.')) : null
  async function save() {
    setBusy(true)
    try {
      await p.onAdd('treino', Math.max(1, Math.min(600, Number(min) || 0)), { type, intensity, notes: notes.trim() || null, exercises: type === 'musculacao' || type === 'funcional' ? ex.filter(e => e.name.trim()).map(e => ({ ...e, name: e.name.trim() })) : [] })
      p.onClose()
    } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  return (
    <Sheet title="Registrar treino" size="lg" onClose={p.onClose} footer={<button className="btn btn-p" disabled={busy || !(Number(min) > 0)} onClick={save}>{busy ? 'Salvando…' : 'Salvar treino'}</button>}>
      <div className="onb-days wrap" role="radiogroup" aria-label="Tipo de treino">{WORKOUT_TYPES.map(([k, l]) => <button key={k} role="radio" aria-checked={type === k} className={`onb-day wide ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>{l}</button>)}</div>
      <div className="onb-row" style={{ marginTop: 12 }}>
        <label className="onb-f"><span>Duração (min)</span><input className="fi" inputMode="numeric" value={min} onChange={e => setMin(e.target.value)}/></label>
        <div className="onb-f"><span>Intensidade</span><div className="onb-days" role="radiogroup" aria-label="Intensidade">{(['leve', 'moderado', 'forte'] as const).map(k => <button key={k} role="radio" aria-checked={intensity === k} className={`onb-day wide ${intensity === k ? 'on' : ''}`} onClick={() => setIntensity(k)}>{k}</button>)}</div></div>
      </div>
      {(type === 'musculacao' || type === 'funcional') && <>
        <div className="onb-q">Exercícios e cargas</div>
        <datalist id="ex-names">{names.map(n => <option key={n} value={n}/>)}</datalist>
        <div className="wk-ex">
          <div className="wk-ex-h" aria-hidden="true"><span>Exercício</span><span>Séries</span><span>Reps</span><span>Carga (kg)</span><span/></div>
          {ex.map((e, i) => <div key={i} className="wk-ex-r">
            <input className="fi" list="ex-names" value={e.name} placeholder="Agachamento" aria-label={`Exercício ${i + 1}`} onChange={x => setE(i, { name: x.target.value })}/>
            <input className="fi" inputMode="numeric" value={e.sets ?? ''} aria-label="Séries" onChange={x => setE(i, { sets: num(x.target.value) })}/>
            <input className="fi" inputMode="numeric" value={e.reps ?? ''} aria-label="Repetições" onChange={x => setE(i, { reps: num(x.target.value) })}/>
            <input className="fi" inputMode="decimal" value={e.kg ?? ''} aria-label="Carga em kg" onChange={x => setE(i, { kg: num(x.target.value) })}/>
            <button className="onb-sv" aria-label={`Remover exercício ${i + 1}`} onClick={() => setEx(l => l.filter((_, j) => j !== i))}>✕</button>
          </div>)}
        </div>
        {ex.length < 20 && <button className="lnk-inline" onClick={() => setEx(l => [...l, { name: '', sets: 3, reps: 10, kg: null }])}>+ Exercício</button>}
      </>}
      <label className="onb-f" style={{ marginTop: 12 }}><span>Observação</span><input className="fi" value={notes} maxLength={200} onChange={e => setNotes(e.target.value)}/></label>
    </Sheet>
  )
}

function Workouts(p: MeuDiaProps) {
  const [open, setOpen] = useState(false)
  const list = p.logs.filter(l => l.who === p.me && l.kind === 'treino').sort((a, b) => b.date.localeCompare(a.date))
  const names = exerciseNames(p.logs, p.me)
  const [exName, setExName] = useState<string>('')
  const sel = exName || names[0] || ''
  const series = sel ? loadSeries(p.logs, p.me, sel) : []
  const ch = change(series)
  return (
    <>
      <div className="rt-actions"><button className="btn btn-p" onClick={() => setOpen(true)}>+ Registrar treino</button></div>
      {names.length > 0 && <section className="card" aria-labelledby="md-carga">
        <div className="slbl" id="md-carga">Evolução da carga {ch != null && <span className={`chip ${ch > 0 ? 'green' : ''}`}>{ch > 0 ? '+' : ''}{fmtN(ch)} kg</span>}</div>
        <select className="fi" style={{ maxWidth: 280, marginBottom: 10 }} value={sel} onChange={e => setExName(e.target.value)} aria-label="Exercício">{names.map(n => <option key={n} value={n}>{n}</option>)}</select>
        <LineChart title={`Carga · ${sel}`} unit="kg" data={series}/>
      </section>}
      <div className="slbl rt-sec">Treinos <span className="mono" style={{ color: 'var(--faint)' }}>{list.length}</span></div>
      {list.length === 0 && <div className="card empty"><span className="empty-icon">🏋️</span>Nenhum treino registrado ainda.</div>}
      <div className="card">{list.slice(0, 40).map(l => (
        <div key={l.id} className="md-row">
          <span className="mono md-d">{fmtDate(l.date)}</span>
          <span className="md-t"><b>{workoutLabel(l.data?.type)}</b> · {l.value} min{l.data?.intensity ? ` · ${l.data.intensity}` : ''}
            {(l.data?.exercises || []).length > 0 && <small>{(l.data.exercises as Exercise[]).map(e => `${e.name}${e.kg ? ` ${fmtN(Number(e.kg))} kg` : ''}${e.sets && e.reps ? ` ${e.sets}×${e.reps}` : ''}`).join(' · ')}</small>}</span>
          <button className="ib" aria-label="Apagar treino" onClick={() => { if (confirm('Apagar este treino?')) p.onRemove(l).catch(() => {}) }}>✕</button>
        </div>))}</div>
      {open && <WorkoutSheet {...p} onClose={() => setOpen(false)}/>}
    </>
  )
}

function Body(p: MeuDiaProps) {
  const [f, setF] = useState<Record<string, string>>({}), [notes, setNotes] = useState(''), [field, setField] = useState('weight')
  const num = (v?: string) => v && v.trim() ? Number(v.replace(',', '.')) : null
  const series = bodySeries(p.logs, p.me, field)
  const info = BODY_FIELDS.find(b => b[0] === field)!
  const ch = change(series)
  const canSave = BODY_FIELDS.some(([k]) => num(f[k]) && num(f[k])! > 0)
  async function save() {
    const data: Record<string, any> = {}
    for (const [k] of BODY_FIELDS) if (k !== 'weight' && num(f[k])) data[k] = num(f[k])
    if (notes.trim()) data.notes = notes.trim()
    try { await p.onAdd('corpo', num(f.weight), data); setF({}); setNotes('') } catch { /* aviso já mostrado */ }
  }
  return (
    <>
      <section className="card" aria-labelledby="md-medir">
        <div className="slbl" id="md-medir">Nova medição · {fmtDate(p.today)}</div>
        <div className="md-body-f">{BODY_FIELDS.map(([k, l, u]) => <label key={k} className="onb-f"><span>{l} ({u})</span><input className="fi" inputMode="decimal" value={f[k] || ''} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))}/></label>)}</div>
        <label className="onb-f"><span>Observação</span><input className="fi" value={notes} maxLength={200} onChange={e => setNotes(e.target.value)}/></label>
        <button className="btn btn-p" disabled={!canSave} onClick={save}>Salvar medição</button>
      </section>
      <section className="card" aria-labelledby="md-evo">
        <div className="slbl" id="md-evo">Evolução {ch != null && <span className="chip">{ch > 0 ? '+' : ''}{fmtN(ch)} {info[2]} desde {fmtDate(series[0].date)}</span>}</div>
        <div className="md-tabs" role="tablist" aria-label="Medida">{BODY_FIELDS.map(([k, l]) => <button key={k} role="tab" aria-selected={field === k} className={`fc ${field === k ? 'on' : ''}`} onClick={() => setField(k)}>{l}</button>)}</div>
        <LineChart title={info[1]} unit={info[2]} data={series}/>
      </section>
    </>
  )
}

function Settings(p: MeuDiaProps & { s: PSettings }) {
  const [goal, setGoal] = useState(String(p.s.water_goal_ml)), [cup, setCup] = useState(String(p.s.cup_ml)), [sleep, setSleep] = useState(String(p.s.sleep_goal_h).replace('.', ','))
  const [share, setShare] = useState(p.s.share), [care, setCare] = useState(p.s.selfcare), [newCare, setNewCare] = useState('')
  const [med, setMed] = useState<{ id?: string, name: string, dose: string, times: string }>({ name: '', dose: '', times: '08:00' })
  const myMeds = p.meds.filter(m => m.who === p.me)
  const [quit, setQuit] = useState<{ id?: string, title: string, reason: string }>({ title: '', reason: '' })
  const myQuits = p.quits.filter(q => q.who === p.me)
  const other: Who = p.me === 'g' ? 's' : 'g'
  const save = () => p.onSaveSettings({
    water_goal_ml: Math.min(8000, Math.max(250, Number(goal) || 2000)), cup_ml: Math.min(1500, Math.max(50, Number(cup) || 250)),
    sleep_goal_h: Math.min(14, Math.max(3, Number(sleep.replace(',', '.')) || 8)), share, selfcare: care.filter(Boolean).slice(0, 20),
  }).catch(() => {})
  return (
    <>
      <section className="card" aria-labelledby="md-priv">
        <div className="slbl" id="md-priv">O que {first(p.names[other])} pode ver</div>
        <p className="row-s" style={{ marginBottom: 8 }}>Desligado = só você vê. Quem garante é o banco: o que não for compartilhado nem chega ao celular dela.</p>
        {PKINDS.map(([k, ic, l]) => <label key={k} className="rt-toggle"><input type="checkbox" checked={!!share[k]} onChange={e => setShare(x => ({ ...x, [k]: e.target.checked }))}/><span><b>{ic} {l}</b><small>{share[k] ? 'Compartilhado' : 'Só você'}</small></span></label>)}
      </section>
      <section className="card" aria-labelledby="md-metas">
        <div className="slbl" id="md-metas">Metas</div>
        <div className="onb-row">
          <label className="onb-f"><span>Água por dia (ml)</span><input className="fi" inputMode="numeric" value={goal} onChange={e => setGoal(e.target.value)}/></label>
          <label className="onb-f"><span>Tamanho do copo (ml)</span><input className="fi" inputMode="numeric" value={cup} onChange={e => setCup(e.target.value)}/></label>
          <label className="onb-f"><span>Sono (horas)</span><input className="fi" inputMode="decimal" value={sleep} onChange={e => setSleep(e.target.value)}/></label>
        </div>
        <div className="onb-q">Meus itens de autocuidado</div>
        <ul className="tk-check">{care.map((c, i) => <li key={i}><span style={{ flex: 1 }}>{c}</span><button className="ib" aria-label={`Remover ${c}`} onClick={() => setCare(l => l.filter((_, j) => j !== i))}>✕</button></li>)}</ul>
        <div className="tk-add"><input className="fi" value={newCare} maxLength={40} placeholder="Ex.: meditar 5 minutos" aria-label="Novo item de autocuidado" onChange={e => setNewCare(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newCare.trim()) { setCare(l => [...l, newCare.trim()]); setNewCare('') } }}/>
          <button className="btn btn-g" disabled={!newCare.trim()} onClick={() => { setCare(l => [...l, newCare.trim()]); setNewCare('') }}>+</button></div>
        <button className="btn btn-p" style={{ marginTop: 12 }} onClick={save}>Salvar metas e privacidade</button>
      </section>
      <section className="card" aria-labelledby="md-meds">
        <div className="slbl" id="md-meds">Meus remédios e vitaminas</div>
        {myMeds.map(m => <div key={m.id} className="md-row"><span className="md-t"><b>{m.name}</b>{m.dose ? ` · ${m.dose}` : ''}<small>{m.times.join(', ') || 'sem horário'}</small></span>
          <button className="lnk-inline" onClick={() => setMed({ id: m.id, name: m.name, dose: m.dose || '', times: m.times.join(', ') })}>editar</button>
          <button className="lnk-inline" onClick={() => { if (confirm(`Parar de lembrar ${m.name}? O histórico fica.`)) p.onStopMed(m).catch(() => {}) }}>parar</button></div>)}
        <div className="onb-row" style={{ marginTop: 8 }}>
          <label className="onb-f"><span>Nome</span><input className="fi" value={med.name} maxLength={60} onChange={e => setMed(x => ({ ...x, name: e.target.value }))} placeholder="Vitamina D"/></label>
          <label className="onb-f"><span>Dose</span><input className="fi" value={med.dose} maxLength={40} onChange={e => setMed(x => ({ ...x, dose: e.target.value }))} placeholder="1 cápsula"/></label>
          <label className="onb-f"><span>Horários</span><input className="fi" value={med.times} onChange={e => setMed(x => ({ ...x, times: e.target.value }))} placeholder="08:00, 20:00"/></label>
        </div>
        <button className="btn btn-s" disabled={!med.name.trim()} onClick={() => p.onSaveMed({ id: med.id, name: med.name, dose: med.dose || null, times: med.times.split(/[,\s]+/).map(t => t.trim()).filter(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) }).then(() => setMed({ name: '', dose: '', times: '08:00' })).catch(() => {})}>{med.id ? 'Salvar remédio' : '+ Cadastrar'}</button>
      </section>
      {p.quitsReady !== false && <section className="card" aria-labelledby="md-quits">
        <div className="slbl" id="md-quits">🚭 Parar de…</div>
        <p className="row-s" style={{ marginBottom: 8 }}>Um hábito que você quer largar. O contador começa hoje; se tiver uma recaída, ele recomeça e o recorde fica.</p>
        {myQuits.map(q => <div key={q.id} className="md-row"><span className="md-t"><b>{q.title}</b><small>desde {fmtDate(q.started_on)}{q.reason ? ` · ${q.reason}` : ''}</small></span>
          <button className="lnk-inline" onClick={() => setQuit({ id: q.id, title: q.title, reason: q.reason || '' })}>editar</button>
          <button className="lnk-inline" onClick={() => { if (confirm(`Encerrar “${q.title}”? O histórico fica.`)) p.onStopQuit(q).catch(() => {}) }}>encerrar</button></div>)}
        <div className="onb-row" style={{ marginTop: 8 }}>
          <label className="onb-f"><span>Parar de</span><input className="fi" value={quit.title} maxLength={60} onChange={e => setQuit(x => ({ ...x, title: e.target.value }))} placeholder="Refrigerante"/></label>
          <label className="onb-f"><span>Por quê? (opcional)</span><input className="fi" value={quit.reason} maxLength={200} onChange={e => setQuit(x => ({ ...x, reason: e.target.value }))} placeholder="Dormir melhor"/></label>
        </div>
        <button className="btn btn-s" disabled={!quit.title.trim()} onClick={() => p.onSaveQuit({ id: quit.id, title: quit.title, reason: quit.reason || null }).then(() => setQuit({ title: '', reason: '' })).catch(() => {})}>{quit.id ? 'Salvar' : '+ Começar'}</button>
      </section>}
    </>
  )
}

/** Resumo no Início: água com +1 copo, sono e remédios pendentes. */
export function MeuDiaCard({ me, settings, logs, meds, profiles = [], today, nowHM, onAdd, onOpen }: { me: Who, settings: PSettings[], logs: PLog[], meds: PMed[], profiles?: FoodProfile[], today: string, nowHM: string, onAdd: (k: PKind, v: number) => void, onOpen: () => void }) {
  const s = settings.find(x => x.who === me) || DEFAULT_SETTINGS(me)
  const water = waterOn(logs, me, today), pct = Math.min(100, Math.round(water / s.water_goal_ml * 100))
  const pend = dosesToday(meds, logs, me, today, nowHM).filter(d => !d.taken)
  const slept = logs.find(l => l.who === me && l.kind === 'sono' && l.date === today)
  const food = foodLine(logs, profiles, me, today)
  return (
    <section className="card md-home" aria-labelledby="md-home">
      <div className="slbl" id="md-home">💧 Meu dia<button className="lnk" onClick={onOpen}>Abrir →</button></div>
      <div className="md-home-w"><span className="mono">{fmtN(water / 1000)} / {fmtN(s.water_goal_ml / 1000)} L</span><button className="btn btn-s" onClick={() => onAdd('agua', s.cup_ml)}>+1 copo</button></div>
      <div className="bar" aria-hidden="true"><div className="barf" style={{ width: `${pct}%`, background: 'var(--pri)' }}/></div>
      <div className="md-home-s">{slept ? `😴 ${fmtN(Number(slept.value))} h de sono` : <button className="lnk-inline" onClick={onOpen}>😴 Como dormiu?</button>}
        {pend.length > 0 && <span className={pend.some(d => d.late) ? 'md-late' : ''}> · 💊 {pend.length} dose{pend.length > 1 ? 's' : ''} {pend.some(d => d.late) ? 'atrasada(s)' : 'hoje'}</span>}
        {food && <span> · {food}</span>}</div>
    </section>
  )
}
