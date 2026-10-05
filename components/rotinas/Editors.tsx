'use client'
// Construtor de rotina, editor de hábito e catálogo de modelos.
import { useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { Sheet } from '@/components/ui/Sheet'
import { ALL_DAYS, TEMPLATES, WEEKDAYS, WEEKDAYS_LONG, daysLabel } from '@/lib/onboarding'
import type { Habit, Routine } from '@/lib/rotinas'
import type { HabitDraft, RoutineDraft } from '@/lib/services/rotinas'

const first = (n: string) => (n || '').split(' ')[0]
const toggle = <T,>(l: T[], v: T) => l.includes(v) ? l.filter(x => x !== v) : [...l, v]
const CATS: Array<[string, string]> = [['casa', '🏠 Casa'], ['cozinha', '🍳 Cozinha'], ['caes', '🐾 Cães'], ['manha', '🌅 Manhã'], ['noite', '🌙 Noite'], ['semana', '🗓 Semana'], ['outros', 'Outros']]

export function RoutineEditor({ routine, names, saving, onSave, onArchive, onClose }: {
  routine: Routine | null, names: Names, saving: boolean
  onSave: (d: RoutineDraft) => void, onArchive: (r: Routine) => void, onClose: () => void
}) {
  const [d, setD] = useState<RoutineDraft>(() => routine ? {
    id: routine.id, title: routine.title, description: routine.description || '', category: routine.category,
    weekdays: routine.weekdays || [...ALL_DAYS], scheduled_time: routine.scheduled_time, duration_min: routine.duration_min,
    assign_mode: routine.assign_mode, essential: routine.essential, start_date: routine.start_date || null, paused_until: routine.paused_until || null,
    reminder_min: routine.reminder_min ?? null, steps: routine.routine_steps.map(s => ({ id: s.id, title: s.title, survival: s.survival })),
  } : { title: '', description: '', category: 'casa', weekdays: [...ALL_DAYS], scheduled_time: null, duration_min: 15, assign_mode: 'shared', essential: false, start_date: null, paused_until: null, reminder_min: null, steps: [{ title: '', survival: true }] })
  const set = (p: Partial<RoutineDraft>) => setD(x => ({ ...x, ...p }))
  const move = (i: number, dir: -1 | 1) => { const s = [...d.steps]; const j = i + dir; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; set({ steps: s }) }
  const valid = d.title.trim() && d.weekdays.length && d.steps.some(s => s.title.trim())
  const lbl: Record<RoutineDraft['assign_mode'], string> = { shared: 'As duas', rotation: 'Rodízio', g: first(names.g), s: first(names.s) }
  return (
    <Sheet title={routine ? 'Editar rotina' : 'Nova rotina'} onClose={onClose} size="lg" footer={<>
      {routine && <button className="btn btn-danger" disabled={saving} onClick={() => onArchive(routine)}>Arquivar</button>}
      <button className="btn btn-p" disabled={!valid || saving} onClick={() => onSave(d)}>{saving ? 'Salvando…' : 'Salvar rotina'}</button>
    </>}>
      <label className="onb-f"><span>Nome</span><input className="fi" value={d.title} maxLength={60} autoFocus onChange={e => set({ title: e.target.value })} placeholder="Ex.: Fechar a cozinha"/></label>
      <label className="onb-f"><span>Descrição (opcional)</span><input className="fi" value={d.description} maxLength={200} onChange={e => set({ description: e.target.value })}/></label>
      <div className="onb-q">Categoria</div>
      <div className="onb-days wrap" role="radiogroup" aria-label="Categoria">{CATS.map(([k, v]) => <button key={k} role="radio" aria-checked={d.category === k} className={`onb-day wide ${d.category === k ? 'on' : ''}`} onClick={() => set({ category: k })}>{v}</button>)}</div>
      <div className="onb-q">Dias <small>{daysLabel(d.weekdays)}</small></div>
      <div className="onb-days" role="group" aria-label="Dias da rotina">
        {WEEKDAYS.map((w, i) => <button key={i} className={`onb-day ${d.weekdays.includes(i) ? 'on' : ''}`} aria-pressed={d.weekdays.includes(i)} aria-label={WEEKDAYS_LONG[i]} onClick={() => set({ weekdays: toggle(d.weekdays, i) })}>{w}</button>)}
        <button className="lnk-inline" onClick={() => set({ weekdays: [...ALL_DAYS] })}>Todos</button>
      </div>
      <div className="onb-row">
        <label className="onb-f"><span>Horário</span><input className="fi" type="time" value={d.scheduled_time || ''} onChange={e => set({ scheduled_time: e.target.value || null })}/></label>
        <label className="onb-f"><span>Duração (min)</span><input className="fi" type="number" min={1} max={240} value={d.duration_min ?? ''} onChange={e => set({ duration_min: e.target.value ? Math.min(240, Math.max(1, Number(e.target.value))) : null })}/></label>
      </div>
      <div className="onb-q">Quem faz</div>
      <div className="onb-days wrap" role="radiogroup" aria-label="Quem faz">{(['shared', 'rotation', 'g', 's'] as const).map(m => <button key={m} role="radio" aria-checked={d.assign_mode === m} className={`onb-day wide ${d.assign_mode === m ? 'on' : ''}`} onClick={() => set({ assign_mode: m })}>{lbl[m]}</button>)}</div>
      <label className="rt-toggle"><input type="checkbox" checked={d.essential} onChange={e => set({ essential: e.target.checked })}/><span><b>Essencial</b><small>Não pode falhar, nem em semana difícil</small></span></label>
      <div className="onb-q">Passos <small>🛡 = entra na versão do modo sobrevivência</small></div>
      <ol className="onb-steps-ed">
        {d.steps.map((s, i) => (
          <li key={s.id || 'n' + i}>
            <input className="fi" value={s.title} maxLength={80} aria-label={`Passo ${i + 1}`} onChange={e => set({ steps: d.steps.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })}/>
            <button className="onb-sv" aria-label={`Subir passo ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="onb-sv" aria-label={`Descer passo ${i + 1}`} disabled={i === d.steps.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className={`onb-sv ${s.survival ? 'on' : ''}`} aria-pressed={s.survival} aria-label="Manter no modo sobrevivência" onClick={() => set({ steps: d.steps.map((x, j) => j === i ? { ...x, survival: !x.survival } : x) })}>🛡</button>
            <button className="onb-sv" aria-label={`Remover passo ${i + 1}`} onClick={() => set({ steps: d.steps.filter((_, j) => j !== i) })}>✕</button>
          </li>
        ))}
      </ol>
      {d.steps.length < 20 && <button className="lnk-inline" onClick={() => set({ steps: [...d.steps, { title: '', survival: false }] })}>+ Adicionar passo</button>}
      <div className="onb-row" style={{ marginTop: 14 }}>
        <label className="onb-f"><span>Começa em</span><input className="fi" type="date" value={d.start_date || ''} onChange={e => set({ start_date: e.target.value || null })}/></label>
        <label className="onb-f"><span>Pausar até</span><input className="fi" type="date" value={d.paused_until || ''} onChange={e => set({ paused_until: e.target.value || null })}/></label>
      </div>
      <label className="onb-f"><span>Lembrete (quando as notificações de rotina chegarem)</span>
        <select className="fi" value={d.reminder_min ?? ''} onChange={e => set({ reminder_min: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">Sem lembrete</option><option value="0">Na hora</option><option value="10">10 min antes</option><option value="30">30 min antes</option><option value="60">1 hora antes</option>
        </select></label>
      {routine && <p className="row-s">Arquivar tira a rotina da lista; o histórico continua guardado. Passos removidos também guardam o histórico.</p>}
    </Sheet>
  )
}

export function HabitEditor({ habit, names, saving, onSave, onArchive, onClose, preset }: {
  habit: Habit | null, names: Names, saving: boolean, preset?: Partial<HabitDraft>
  onSave: (d: HabitDraft) => void, onArchive: (h: Habit) => void, onClose: () => void
}) {
  const [d, setD] = useState<HabitDraft>(() => habit
    ? { id: habit.id, title: habit.title, description: habit.description || '', owner: habit.owner, weekdays: habit.weekdays, weekly_target: habit.weekly_target, paused_until: habit.paused_until }
    : { title: '', description: '', owner: 'shared', weekdays: null, weekly_target: 5, paused_until: null, ...preset })
  const set = (p: Partial<HabitDraft>) => setD(x => ({ ...x, ...p }))
  const fixed = !!d.weekdays
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet title={habit ? 'Editar hábito' : 'Novo hábito'} onClose={onClose} footer={<>
      {habit && (confirm
        ? <button className="btn btn-danger" disabled={saving} onClick={() => onArchive(habit)}>Confirmar: abandonar</button>
        : <button className="btn btn-g" onClick={() => setConfirm(true)}>Abandonar</button>)}
      <button className="btn btn-p" disabled={!d.title.trim() || (fixed && !d.weekdays!.length) || saving} onClick={() => onSave(d)}>{saving ? 'Salvando…' : 'Salvar hábito'}</button>
    </>}>
      <label className="onb-f"><span>Nome</span><input className="fi" value={d.title} maxLength={60} autoFocus onChange={e => set({ title: e.target.value })} placeholder="Ex.: Preparar o dia seguinte"/></label>
      <label className="onb-f"><span>Descrição (opcional)</span><input className="fi" value={d.description} maxLength={200} onChange={e => set({ description: e.target.value })}/></label>
      <div className="onb-q">De quem é</div>
      <div className="onb-days wrap" role="radiogroup" aria-label="De quem é">{(['shared', 'g', 's'] as const).map(o => <button key={o} role="radio" aria-checked={d.owner === o} className={`onb-day wide ${d.owner === o ? 'on' : ''}`} onClick={() => set({ owner: o })}>{o === 'shared' ? 'As duas' : first(names[o as Who])}</button>)}</div>
      <div className="onb-q">Frequência</div>
      <div className="onb-days wrap" role="radiogroup" aria-label="Tipo de frequência">
        <button role="radio" aria-checked={!fixed} className={`onb-day wide ${!fixed ? 'on' : ''}`} onClick={() => set({ weekdays: null })}>Vezes por semana</button>
        <button role="radio" aria-checked={fixed} className={`onb-day wide ${fixed ? 'on' : ''}`} onClick={() => set({ weekdays: d.weekdays || [1, 2, 3, 4, 5] })}>Dias certos</button>
      </div>
      {fixed
        ? <div className="onb-days" role="group" aria-label="Dias do hábito" style={{ marginTop: 8 }}>{WEEKDAYS.map((w, i) => <button key={i} className={`onb-day ${d.weekdays!.includes(i) ? 'on' : ''}`} aria-pressed={d.weekdays!.includes(i)} aria-label={WEEKDAYS_LONG[i]} onClick={() => set({ weekdays: toggle(d.weekdays!, i) })}>{w}</button>)}</div>
        : <div className="onb-days" role="radiogroup" aria-label="Meta por semana" style={{ marginTop: 8 }}>{[1, 2, 3, 4, 5, 6, 7].map(n => <button key={n} role="radio" aria-checked={d.weekly_target === n} className={`onb-day ${d.weekly_target === n ? 'on' : ''}`} onClick={() => set({ weekly_target: n })}>{n}x</button>)}</div>}
      <label className="onb-f" style={{ marginTop: 14 }}><span>Pausar até (opcional)</span><input className="fi" type="date" value={d.paused_until || ''} onChange={e => set({ paused_until: e.target.value || null })}/></label>
      <p className="row-s">Dia sem registro não vira atraso. Abandonar tira da lista e guarda o histórico.</p>
    </Sheet>
  )
}

export function TemplatesSheet({ existingKeys, busy, onAdd, onClose }: { existingKeys: string[], busy: string | null, onAdd: (key: string) => void, onClose: () => void }) {
  return (
    <Sheet title="Modelos de rotina" onClose={onClose} size="lg">
      <p className="row-s" style={{ marginBottom: 12 }}>Cada modelo vira uma rotina com passos. Depois dá para editar tudo. O que já existe não é criado de novo.</p>
      <div className="tpl-list">
        {TEMPLATES.map(t => {
          const has = existingKeys.includes(t.key)
          return (
            <div key={t.key} className={`tpl ${has ? 'has' : ''}`}>
              <div style={{ minWidth: 0, flex: 1 }}><b>{t.title}</b><small>{t.description} · {t.time || 'sem horário'} · {daysLabel(t.weekdays)} · {t.steps.length} passos</small></div>
              {has ? <span className="chip green">✓ Já existe</span> : <button className="btn btn-s" disabled={busy === t.key} onClick={() => onAdd(t.key)}>{busy === t.key ? '…' : 'Adicionar'}</button>}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
