'use client'
// Sprint do Ninho: escolher duração, cômodo, participantes e tarefas; cronômetro
// que continua mesmo fora da tela; pausar/encerrar; resumo com o XP real.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Names, Task, Who } from '@/lib/types'
import { AREAS, DURATIONS, areaLabel, fmtClock, remainingMs, suggestTasks, summary, type Sprint } from '@/lib/sprint'

const first = (n: string) => (n || '').split(' ')[0]
const PREF_VIBRATE = 'ninho.sprint.vibrate', PREF_SOUND = 'ninho.sprint.sound'
const readPref = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1' } catch { return d } }
const savePref = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0') } catch { /* sem armazenamento */ } }

function beep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx(), o = ctx.createOscillator(), g = ctx.createGain()
    o.frequency.value = 660; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination)
    o.start(); o.stop(ctx.currentTime + 0.35); setTimeout(() => ctx.close(), 600)
  } catch { /* sem áudio */ }
}

export interface SprintStart { duration_min: number, area: string, goal: string | null, participants: Who[], task_ids: string[] }

export function SprintPanel({ active, recent, now, tasks, today, me, names, busy, onStart, onPause, onFinish, onToggleTask, onSetTasks, onClose }: {
  active: Sprint | null, recent: Sprint[], now: number, tasks: Task[], today: string, me: Who | null, names: Names, busy: boolean
  onStart: (v: SprintStart) => void, onPause: (pause: boolean, extraMin?: number) => void, onFinish: (cancel: boolean) => Promise<Sprint | null>
  onToggleTask: (t: Task) => void, onSetTasks: (ids: string[]) => void, onClose: () => void
}) {
  const [dur, setDur] = useState(15)
  const [custom, setCustom] = useState('')
  const [area, setArea] = useState('kitchen')
  const [goal, setGoal] = useState('')
  const [who, setWho] = useState<'both' | Who>('both')
  const suggestions = useMemo(() => suggestTasks(tasks, area, today, 8), [tasks, area, today])
  const [picked, setPicked] = useState<string[]>([])
  useEffect(() => { setPicked(suggestions.slice(0, 4).map(t => t.id)) }, [area]) // eslint-disable-line react-hooks/exhaustive-deps
  const [vibrate, setVibrate] = useState(() => readPref(PREF_VIBRATE, true))
  const [sound, setSound] = useState(() => readPref(PREF_SOUND, false))
  const [result, setResult] = useState<Sprint | null>(null)
  const [adding, setAdding] = useState(false)
  const head = useRef<HTMLHeadingElement>(null)

  const rem = active ? remainingMs(active, now) : 0
  const total = active ? active.duration_min * 60000 : 1
  const timeUp = !!active && rem === 0
  const mode = result ? 'summary' : active ? 'running' : 'setup'
  useEffect(() => { head.current?.focus({ preventScroll: true }) }, [mode])

  // Fim do tempo: vibra/toca uma vez por sprint, só se a pessoa permitiu
  const alerted = useRef<string | null>(null)
  useEffect(() => {
    if (!timeUp || !active || alerted.current === active.id) return
    alerted.current = active.id
    if (vibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) { try { navigator.vibrate([300, 150, 300]) } catch { /* sem vibração */ } }
    if (sound) beep()
  }, [timeUp, active, vibrate, sound])

  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const minutesLeft = Math.ceil(rem / 60000)
  const sprintTasks = active ? active.task_ids.map(id => tasks.find(t => t.id === id)).filter((t): t is Task => !!t) : []
  const doneNow = sprintTasks.filter(t => t.completed_today).length
  const R = 54, C = 2 * Math.PI * R

  async function finish(cancel: boolean) {
    const r = await onFinish(cancel)
    if (r && !cancel) setResult(r)
  }

  const durMin = custom ? Math.min(120, Math.max(1, Number(custom) || 0)) : dur
  return (
    <div className="onb sp" role="dialog" aria-modal="true" aria-labelledby="sp-h">
      <header className="onb-top">
        <span className="logo">Ni<span>nho</span></span>
        <span className="sp-top-t">⏱ Sprint do Ninho</span>
        <button className="btn btn-g onb-later" onClick={onClose}>{active ? 'Sair da tela (continua)' : 'Fechar'}</button>
      </header>
      <div className="sp-in">
        {mode === 'setup' && <>
          <h1 id="sp-h" ref={head} tabIndex={-1}>Um mutirão curto, com hora para acabar</h1>
          <p className="onb-lead">Escolha o tempo e o cômodo. O XP vem só do que for concluído de verdade.</p>
          <div className="onb-card">
            <div className="onb-lbl">1 · Duração</div>
            <div className="onb-days wrap" role="radiogroup" aria-label="Duração">
              {DURATIONS.map(d => <button key={d} role="radio" aria-checked={!custom && dur === d} className={`onb-day wide ${!custom && dur === d ? 'on' : ''}`} onClick={() => { setDur(d); setCustom('') }}>{d} min</button>)}
              <label className="sp-custom"><span className="sr-only">Personalizado (minutos)</span><input className="fi" type="number" min={1} max={120} placeholder="outro" value={custom} onChange={e => setCustom(e.target.value)}/> min</label>
            </div>
          </div>
          <div className="onb-card">
            <div className="onb-lbl">2 · Cômodo ou objetivo</div>
            <div className="onb-days wrap" role="radiogroup" aria-label="Cômodo">
              {AREAS.map(([k, v]) => <button key={k} role="radio" aria-checked={area === k} className={`onb-day wide ${area === k ? 'on' : ''}`} onClick={() => setArea(k)}>{v}</button>)}
            </div>
            <input className="fi" style={{ marginTop: 10 }} value={goal} maxLength={80} placeholder="Objetivo (opcional): ex. visita chegando" aria-label="Objetivo" onChange={e => setGoal(e.target.value)}/>
          </div>
          <div className="onb-card">
            <div className="onb-lbl">3 · Quem participa</div>
            <div className="onb-days wrap" role="radiogroup" aria-label="Participantes">
              {(['both', 'g', 's'] as const).map(w => <button key={w} role="radio" aria-checked={who === w} className={`onb-day wide ${who === w ? 'on' : ''}`} onClick={() => setWho(w)}>{w === 'both' ? 'As duas' : first(names[w])}</button>)}
            </div>
          </div>
          <div className="onb-card">
            <div className="onb-lbl">4 · Tarefas sugeridas <span>{picked.length} escolhida{picked.length === 1 ? '' : 's'}</span></div>
            {suggestions.length === 0 && <p className="row-s">Nenhuma tarefa pendente neste cômodo. Dá para fazer o sprint mesmo assim, ou escolher outro cômodo.</p>}
            <div className="onb-list">
              {suggestions.map(t => (
                <label key={t.id} className={`onb-li ${picked.includes(t.id) ? 'on' : ''}`}><span className="onb-li-h">
                  <input type="checkbox" checked={picked.includes(t.id)} onChange={() => setPicked(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id])}/>
                  <span><b>{t.title}</b><small>{t.essential ? 'essencial · ' : ''}{t.weight === 'light' ? 'rápida' : t.weight === 'medium' ? 'média' : 'pesada'}</small></span></span></label>
              ))}
            </div>
          </div>
          <div className="onb-card sp-prefs">
            <label className="rt-toggle"><input type="checkbox" checked={vibrate} onChange={e => { setVibrate(e.target.checked); savePref(PREF_VIBRATE, e.target.checked) }}/><span><b>Vibrar no fim</b><small>Se o celular permitir</small></span></label>
            <label className="rt-toggle"><input type="checkbox" checked={sound} onChange={e => { setSound(e.target.checked); savePref(PREF_SOUND, e.target.checked) }}/><span><b>Som no fim</b><small>Um aviso curto, com o app aberto</small></span></label>
          </div>
          {recent.length > 0 && <div className="onb-card">
            <div className="onb-lbl">Últimos sprints</div>
            <ul className="sp-hist">{recent.map(s => { const sm = summary(s); return <li key={s.id}><b>{sm.title}</b><small>{sm.result}</small></li> })}</ul>
          </div>}
          <div className="sp-go"><button className="btn btn-p" disabled={busy || durMin < 1} onClick={() => onStart({ duration_min: durMin, area, goal: goal.trim() || null, participants: who === 'both' ? ['g', 's'] : [who], task_ids: picked })}>{busy ? 'Iniciando…' : `▶ Iniciar ${durMin} min`}</button></div>
        </>}

        {mode === 'running' && active && <>
          <h1 id="sp-h" ref={head} tabIndex={-1} className="sp-h1">{active.goal || areaLabel(active.area)}</h1>
          <p className="sp-who">{active.participants.map(w => first(names[w])).join(' e ')} · {active.duration_min} min</p>
          <div className={`sp-ring ${timeUp ? 'up' : ''} ${active.paused_at ? 'paused' : ''}`} role="timer" aria-label={`${fmtClock(rem)} restantes`}>
            <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r={R} className="sp-track"/><circle cx="60" cy="60" r={R} className="sp-bar" strokeDasharray={C} strokeDashoffset={C * (1 - rem / total)}/></svg>
            <div className="sp-clock"><b className="mono">{timeUp ? 'Tempo!' : fmtClock(rem)}</b><small>{active.paused_at ? 'pausado' : timeUp ? 'acabou o tempo' : 'restantes'}</small></div>
          </div>
          <p className="sr-only" aria-live="polite">{timeUp ? 'Acabou o tempo do sprint' : active.paused_at ? 'Sprint pausado' : `${minutesLeft} minuto${minutesLeft === 1 ? '' : 's'} restante${minutesLeft === 1 ? '' : 's'}`}</p>
          <div className="sp-ctrl">
            {timeUp ? <>
              <button className="btn btn-g" disabled={busy} onClick={() => onPause(false, 5)}>+5 min</button>
              <button className="btn btn-p" disabled={busy} onClick={() => finish(false)}>Encerrar e ver resumo</button>
            </> : <>
              <button className="btn btn-g" disabled={busy} onClick={() => onPause(!active.paused_at)}>{active.paused_at ? '▶ Continuar' : '❚❚ Pausar'}</button>
              <button className="btn btn-p" disabled={busy} onClick={() => finish(false)}>Encerrar</button>
            </>}
          </div>
          <div className="onb-card">
            <div className="onb-lbl">Tarefas do sprint <span className="mono">{doneNow}/{sprintTasks.length}</span></div>
            {sprintTasks.length === 0 && <p className="row-s">Nenhuma tarefa escolhida. Adicione abaixo ou só arrume e encerre.</p>}
            <ul className="rt-check">
              {sprintTasks.map(t => (
                <li key={t.id}><button className={`rt-step ${t.completed_today ? 'on' : ''}`} role="checkbox" aria-checked={!!t.completed_today} disabled={!me} onClick={() => onToggleTask(t)}>
                  <span className="rt-box" aria-hidden="true">{t.completed_today ? '✓' : ''}</span><span className="rt-step-t">{t.title}</span>
                  {t.completed_today && t.completed_by_today && <span className={`mini av-${t.completed_by_today}`} aria-label={`feito por ${first(names[t.completed_by_today])}`}>{names[t.completed_by_today].slice(0, 1).toUpperCase()}</span>}
                </button></li>
              ))}
            </ul>
            {adding ? <div className="onb-list" style={{ marginTop: 8 }}>
              {suggestTasks(tasks, active.area, today, 12).filter(t => !active.task_ids.includes(t.id)).map(t => (
                <button key={t.id} className="fc" onClick={() => { onSetTasks([...active.task_ids, t.id]); setAdding(false) }}>+ {t.title}</button>
              ))}
            </div> : <button className="lnk-inline" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>+ Adicionar tarefa</button>}
          </div>
          <button className="lnk-inline sp-cancel" disabled={busy} onClick={() => finish(true)}>Cancelar sprint (não conta nada)</button>
        </>}

        {mode === 'summary' && result && (() => { const sm = summary(result); return (
          <div className="onb-done sp-sum">
            <div className="onb-burst" aria-hidden="true">✨</div>
            <h1 id="sp-h" ref={head} tabIndex={-1}>{sm.title}</h1>
            <p className="sp-res">{sm.result}</p>
            <ul className="onb-res">{result.done_task_ids.map(id => tasks.find(t => t.id === id)).filter(Boolean).map(t => <li key={t!.id}>✓ {t!.title}</li>)}</ul>
            <p className="onb-note">O XP vem das tarefas concluídas, não do tempo. Concluir de novo não conta duas vezes.</p>
            <div className="onb-actions"><button className="btn btn-p" onClick={() => { setResult(null); onClose() }}>Fechar</button></div>
          </div>) })()}
      </div>
    </div>
  )
}
