'use client'
// Configuração inicial do Ninho em 9 etapas. Guarda o rascunho a cada mudança
// (dá para fechar e continuar depois, inclusive em outro aparelho da mesma pessoa).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Names, Task, Who } from '@/lib/types'
import { ENERGY } from '@/lib/constants'
import { THEMES, type ThemeId } from '@/lib/theme'
import {
  ALL_DAYS, ASSIGN_LABEL, ESSENTIALS, LAST_STEP, MAX_PAINS, PAINS, PERIODS, STEPS, TEMPLATES, WEEKDAYS, WEEKDAYS_LONG,
  buildPayload, daysLabel, defaultAnswers, first, hasMedication, matchEssentialTasks, mergeAnswers, stepError, suggestChallenge, suggestRoutines,
  type Answers, type AssignMode, type Period, type RoutineChoice,
} from '@/lib/onboarding'
import { finishOnboarding, saveProgress, type FinishResult, type SetupState } from '@/lib/services/onboarding'
import { toNinhoError } from '@/lib/errors'

export interface OnboardingProps {
  householdId: string
  me: Who
  names: Names
  dogs: Array<{ id: string, name: string }>
  dogRoutineTitles: string[]
  tasks: Task[]
  existingKeys: string[]
  setup: SetupState
  /** true = "Refazer configuração" (começa do início com as respostas anteriores) */
  redo?: boolean
  theme: ThemeId
  onTheme: (t: ThemeId) => void
  onClose: () => void
  onDone: (r: FinishResult, goTo: 'rotinas' | 'inicio') => void
}

const toggle = <T,>(list: T[], v: T) => list.includes(v) ? list.filter(x => x !== v) : [...list, v]

export function Onboarding(p: OnboardingProps) {
  const base = useMemo(() => defaultAnswers(p.names, p.dogs, p.theme), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [a, setA] = useState<Answers>(() => {
    const saved = p.redo ? p.setup.answers : (p.setup.progress?.answers ?? p.setup.answers)
    const m = mergeAnswers(base, saved)
    // A configuração anterior guarda só as chaves das rotinas criadas: elas já existem e não voltam a ser escolhidas
    if (p.redo) for (const k of Object.keys(m.routines)) m.routines[k].on = false
    return m
  })
  const [step, setStep] = useState(() => p.redo ? 1 : Math.min(Math.max(p.setup.progress?.step || 1, 1), LAST_STEP))
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<FinishResult | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const head = useRef<HTMLHeadingElement>(null)
  const touchedRoutines = useRef(Object.values(a.routines).some(r => r.on))

  const set = (patch: Partial<Answers>) => { setErr(null); setA(x => ({ ...x, ...patch })) }
  const setRoutine = (k: string, patch: Partial<RoutineChoice>) => { touchedRoutines.current = true; setErr(null); setA(x => ({ ...x, routines: { ...x.routines, [k]: { ...x.routines[k], ...patch } } })) }

  // Rascunho guardado no banco (sem bloquear a tela; falha não impede seguir)
  useEffect(() => {
    if (!p.setup.available || done) return
    const id = setTimeout(() => { saveProgress(p.householdId, p.me, step, a).catch(() => {}) }, 600)
    return () => clearTimeout(id)
  }, [a, step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { head.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); document.querySelector('.onb')?.scrollTo({ top: 0 }) }, [step, done])

  // Etapa 7: na primeira visita, já vem com as sugestões das dores escolhidas
  useEffect(() => {
    if (step !== 7 || touchedRoutines.current) return
    const keys = suggestRoutines(a.pains, p.existingKeys)
    touchedRoutines.current = true
    setA(x => ({ ...x, routines: Object.fromEntries(Object.entries(x.routines).map(([k, r]) => [k, { ...r, on: keys.includes(k) }])) }))
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const pause = async () => {
    if (p.setup.available) await saveProgress(p.householdId, p.me, step, a, true).catch(() => {})
    p.onClose()
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) pause() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => { const e = stepError(step, a); if (e) { setErr(e); return } setErr(null); setStep(s => Math.min(s + 1, LAST_STEP)) }
  const back = () => { setErr(null); setStep(s => Math.max(s - 1, 1)) }

  const essentialTasks = useMemo(() => matchEssentialTasks(p.tasks, a.essentials), [p.tasks, a.essentials])
  const showMed = useMemo(() => hasMedication(p.tasks, p.dogRoutineTitles), [p.tasks, p.dogRoutineTitles])
  const chosen = TEMPLATES.filter(t => a.routines[t.key]?.on && !p.existingKeys.includes(t.key))
  const challenge = suggestChallenge(a)
  const lbl = ASSIGN_LABEL(a.names)

  async function confirm() {
    setBusy(true); setErr(null)
    try {
      const r = await finishOnboarding(p.householdId, p.me, buildPayload(a, p.tasks, p.existingKeys))
      setDone(r)
    } catch (e) { setErr(toNinhoError(e, 'concluir configuração').userMessage) } finally { setBusy(false) }
  }

  if (done) return (
    <div className="onb" role="dialog" aria-modal="true" aria-labelledby="onb-h">
      <div className="onb-in onb-done">
        <div className="onb-burst" aria-hidden="true">🪺</div>
        <h1 id="onb-h" ref={head} tabIndex={-1}>O Ninho está pronto</h1>
        <ul className="onb-res">
          <li>{done.routines_created ? `${done.routines_created} rotina${done.routines_created > 1 ? 's' : ''} criada${done.routines_created > 1 ? 's' : ''}` : 'Nenhuma rotina nova'}{done.routines_existing ? ` · ${done.routines_existing} já existia${done.routines_existing > 1 ? 'm' : ''}` : ''}</li>
          {!!done.essentials_marked && <li>{done.essentials_marked} tarefa{done.essentials_marked > 1 ? 's' : ''} agora {done.essentials_marked > 1 ? 'são essenciais' : 'é essencial'}</li>}
          {!!done.dogs_created && <li>{done.dogs_created} cão novo cadastrado</li>}
          <li>Primeiro desafio sugerido: {challenge.title} ({challenge.days} dias)</li>
        </ul>
        <p className="onb-note">Nada do que já existia foi apagado. Dá para refazer quando quiser em Ajustes.</p>
        <div className="onb-actions">
          <button className="btn btn-g" onClick={() => p.onDone(done, 'inicio')}>Ir para o Início</button>
          <button className="btn btn-p" onClick={() => p.onDone(done, 'rotinas')}>Ver as rotinas</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="onb" role="dialog" aria-modal="true" aria-labelledby="onb-h">
      <header className="onb-top">
        <span className="logo">Ni<span>nho</span></span>
        <div className="onb-prog" role="progressbar" aria-valuemin={1} aria-valuemax={LAST_STEP} aria-valuenow={step} aria-label={`Etapa ${step} de ${LAST_STEP}`}>
          {STEPS.map(s => <i key={s.n} className={s.n < step ? 'done' : s.n === step ? 'on' : ''}/>)}
        </div>
        <button className="btn btn-g onb-later" onClick={pause}>Continuar depois</button>
      </header>

      <div className="onb-in">
        <nav className="onb-steps" aria-label="Etapas">
          {STEPS.map(s => (
            <button key={s.n} className={`onb-st ${s.n === step ? 'on' : ''} ${s.n < step ? 'done' : ''}`} disabled={s.n > step} aria-current={s.n === step ? 'step' : undefined} onClick={() => s.n < step && setStep(s.n)}>
              <span className="onb-st-n">{s.n < step ? '✓' : s.n}</span>{s.title}
            </button>
          ))}
        </nav>

        <section className="onb-body">
          <p className="onb-kicker">Etapa {step} de {LAST_STEP} · {STEPS[step - 1].title}</p>

          {step === 1 && <>
            <h1 id="onb-h" ref={head} tabIndex={-1}>Vamos organizar o Ninho de um jeito que funcione para a vida real de vocês.</h1>
            <p className="onb-lead">Algumas perguntas rápidas, uns 3 minutos. Dá para parar e continuar depois. Nada do que já existe é apagado.</p>
            <div className="onb-grid">
              {[['📋', 'Tarefas', 'O que tem começo e fim: comprar, agendar, consertar.'],
                ['🔁', 'Rotinas', 'Passos que se repetem num momento do dia.'],
                ['🐾', 'Cães', 'Comida, água, passeio e saúde de cada uma.'],
                ['🌤', 'Energia', 'Semanas pesadas pedem uma lista mais leve.'],
                ['🗓', 'Planejamento', 'Uma conversa curta por semana para ajustar.'],
                ['⚖️', 'Divisão justa', 'Quem combinou e quem fez, sem placar.']].map(([ic, t, d]) => (
                <div key={t} className="onb-feat"><span aria-hidden="true">{ic}</span><b>{t}</b><small>{d}</small></div>
              ))}
            </div>
          </>}

          {step === 2 && <>
            <h1 id="onb-h" ref={head} tabIndex={-1}>Quem faz parte do Ninho?</h1>
            <p className="onb-lead">Confirme ou corrija os nomes. Isso não cria nenhuma conta.</p>
            <div className="onb-card">
              <div className="onb-lbl">Pessoas</div>
              {(['g', 's'] as Who[]).map(w => (
                <label key={w} className="onb-field"><span className={`av ${w === 'g' ? 'av-g' : 'av-s'}`} aria-hidden="true">{(a.names[w] || '?').slice(0, 2).toUpperCase()}</span>
                  <input className="fi" value={a.names[w]} maxLength={40} aria-label={w === 'g' ? 'Nome da primeira pessoa' : 'Nome da segunda pessoa'} onChange={e => set({ names: { ...a.names, [w]: e.target.value } })}/>
                </label>
              ))}
            </div>
            <div className="onb-card">
              <div className="onb-lbl">Cães</div>
              {a.dogs.map((d, i) => (
                <div key={i} className="onb-field"><span className="av av-dog" aria-hidden="true">🐶</span>
                  <input className="fi" value={d.name} maxLength={40} placeholder="Nome do cão" aria-label={`Nome do cão ${i + 1}`} onChange={e => set({ dogs: a.dogs.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })}/>
                  {!d.id && a.dogs.length > 1 && <button className="btn btn-g onb-x" aria-label="Remover" onClick={() => set({ dogs: a.dogs.filter((_, j) => j !== i) })}>✕</button>}
                </div>
              ))}
              {a.dogs.length < 6 && <button className="lnk-inline" onClick={() => set({ dogs: [...a.dogs, { id: null, name: '' }] })}>+ Adicionar cão</button>}
            </div>
          </>}

          {step === 3 && <>
            <h1 id="onb-h" ref={head} tabIndex={-1}>Quem está usando este aparelho?</h1>
            <p className="onb-lead">Este aparelho já está na conta de {first(a.names[p.me])}. Para usar como a outra pessoa, é só sair e entrar com a outra conta em Ajustes.</p>
            <div className="onb-who" role="radiogroup" aria-label="Pessoa deste aparelho">
              {(['g', 's'] as Who[]).map(w => (
                <div key={w} role="radio" aria-checked={w === p.me} aria-disabled={w !== p.me} className={`onb-whob ${w === p.me ? 'on' : ''}`}>
                  <span className={`av ${w === 'g' ? 'av-g' : 'av-s'}`}>{(a.names[w] || '?').slice(0, 2).toUpperCase()}</span>
                  <b>{first(a.names[w])}</b><small>{w === p.me ? 'Este aparelho' : 'Outra conta'}</small>
                </div>
              ))}
            </div>
            <div className="onb-card">
              <div className="onb-lbl">Para que serve</div>
              <ul className="onb-ul">
                <li>Abrir o Ninho já na sua visão do dia</li>
                <li>Registrar quem concluiu cada coisa</li>
                <li>Personalizar lembretes no futuro</li>
              </ul>
            </div>
          </>}

          {step === 4 && <>
            <h1 id="onb-h" ref={head} tabIndex={-1}>O que mais pesa hoje?</h1>
            <p className="onb-lead">Escolha até {MAX_PAINS}. Isso ajuda a sugerir as primeiras rotinas e o primeiro desafio.</p>
            <div className="onb-chips" role="group" aria-label="O que mais pesa">
              {PAINS.map(x => {
                const on = a.pains.includes(x.id), full = !on && a.pains.length >= MAX_PAINS
                return <button key={x.id} className={`onb-chip ${on ? 'on' : ''}`} aria-pressed={on} disabled={full} onClick={() => { touchedRoutines.current = false; set({ pains: toggle(a.pains, x.id) }) }}>{on ? '✓ ' : ''}{x.label}</button>
              })}
            </div>
            <p className="onb-count" aria-live="polite">{a.pains.length} de {MAX_PAINS}</p>
          </>}

          {step === 5 && <>
            <h1 id="onb-h" ref={head} tabIndex={-1}>Como é a semana de vocês?</h1>
            <p className="onb-lead">Só o necessário para a divisão ficar justa. Nada de agenda detalhada.</p>
            {(['g', 's'] as Who[]).map(w => (
              <div key={w} className="onb-card">
                <div className="onb-lbl">{first(a.names[w])}</div>
                <div className="onb-q">Dias mais pesados</div>
                <div className="onb-days" role="group" aria-label={`Dias mais pesados de ${first(a.names[w])}`}>
                  {WEEKDAYS.map((d, i) => { const on = a.week[w].heavy.includes(i); return <button key={i} className={`onb-day ${on ? 'on' : ''}`} aria-pressed={on} aria-label={WEEKDAYS_LONG[i]} onClick={() => set({ week: { ...a.week, [w]: { ...a.week[w], heavy: toggle(a.week[w].heavy, i) } } })}>{d}</button> })}
                </div>
                <div className="onb-q">Costuma ter tempo para a casa</div>
                <div className="onb-days" role="group" aria-label={`Períodos livres de ${first(a.names[w])}`}>
                  {PERIODS.map(x => { const on = a.week[w].periods.includes(x.id); return <button key={x.id} className={`onb-day wide ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set({ week: { ...a.week, [w]: { ...a.week[w], periods: toggle<Period>(a.week[w].periods, x.id) } } })}>{x.label}</button> })}
                </div>
              </div>
            ))}
            <div className="onb-card">
              <div className="onb-lbl">As duas</div>
              <div className="onb-q">Melhor dia para planejar a semana</div>
              <div className="onb-days" role="radiogroup" aria-label="Dia do planejamento">
                {WEEKDAYS.map((d, i) => <button key={i} role="radio" aria-checked={a.week.planningDay === i} aria-label={WEEKDAYS_LONG[i]} className={`onb-day ${a.week.planningDay === i ? 'on' : ''}`} onClick={() => set({ week: { ...a.week, planningDay: i } })}>{d}</button>)}
              </div>
              <div className="onb-q">Energia de uma semana normal</div>
              <div className="opts" role="radiogroup" aria-label="Energia típica">
                {(['high', 'medium', 'low'] as const).map(e => (
                  <button key={e} role="radio" aria-checked={a.week.energy === e} className={`opt ${a.week.energy === e ? 'on' : ''}`} onClick={() => set({ week: { ...a.week, energy: e } })}>
                    <div className="opt-t">{ENERGY[e].ic} {ENERGY[e].short}</div><div className="opt-s">{ENERGY[e].s}</div>
                  </button>
                ))}
              </div>
            </div>
          </>}

          {step === 6 && <>
            <h1 id="onb-h" ref={head} tabIndex={-1}>O que é essencial?</h1>
            <p className="onb-lead">Essencial é o que não pode falhar, nem em semana difícil. Aparece sempre, mesmo no modo sobrevivência.</p>
            <div className="onb-list" role="group" aria-label="Essenciais">
              {ESSENTIALS.filter(e => e.id !== 'medicacao' || showMed).map(e => {
                const on = a.essentials.includes(e.id)
                const found = e.match ? p.tasks.filter(t => t.active !== false && e.match!(t)) : []
                return (
                  <div key={e.id} className={`onb-li ${on ? 'on' : ''}`}>
                    <label className="onb-li-h">
                      <input type="checkbox" checked={on} onChange={() => set({ essentials: toggle(a.essentials, e.id) })}/>
                      <span><b>{e.label}</b>{found.length > 0 && <small>Já existe: {found.slice(0, 3).map(t => t.title).join(', ')}{found.length > 3 ? ` e mais ${found.length - 3}` : ''}</small>}</span>
                    </label>
                    {e.id === 'outros' && on && <input className="fi" value={a.otherEssential} maxLength={60} placeholder="Qual?" aria-label="Outro essencial" onChange={x => set({ otherEssential: x.target.value })}/>}
                  </div>
                )
              })}
            </div>
            {essentialTasks.length > 0 && <p className="onb-note">{essentialTasks.length} tarefa{essentialTasks.length > 1 ? 's' : ''} que já existe{essentialTasks.length > 1 ? 'm' : ''} vai{essentialTasks.length > 1 ? 'ão' : ''} virar essencia{essentialTasks.length > 1 ? 'is' : 'l'} quando você confirmar.</p>}
          </>}

          {step === 7 && <>
            <h1 id="onb-h" ref={head} tabIndex={-1}>Escolha as primeiras rotinas</h1>
            <p className="onb-lead">Rotina é um conjunto de passos num momento do dia. Já marcamos algumas pelo que vocês contaram. Toque em “Personalizar” para ajustar antes de salvar.</p>
            <div className="onb-rts">
              {TEMPLATES.map(t => {
                const r = a.routines[t.key], exists = p.existingKeys.includes(t.key), isOpen = open === t.key
                return (
                  <div key={t.key} data-key={t.key} className={`onb-rt ${r.on && !exists ? 'on' : ''} ${exists ? 'exists' : ''}`}>
                    <div className="onb-rt-h">
                      <label className="onb-rt-ck">
                        <input type="checkbox" checked={r.on && !exists} disabled={exists} onChange={() => setRoutine(t.key, { on: !r.on })} aria-describedby={`rt-${t.key}`}/>
                        <span><b>{r.title || t.title}</b><small id={`rt-${t.key}`}>{exists ? 'Já existe no Ninho' : `${r.time || 'Sem horário'} · ${daysLabel(r.weekdays)} · ${r.duration || '?'} min · ${lbl[r.assign]} · ${r.steps.filter(x => x.title.trim()).length} passos`}</small></span>
                      </label>
                      {!exists && <button className="btn btn-g" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : t.key); if (!r.on) setRoutine(t.key, { on: true }) }}>{isOpen ? 'Fechar' : 'Personalizar'}</button>}
                    </div>
                    {isOpen && !exists && <div className="onb-rt-ed">
                      <label className="onb-f"><span>Nome</span><input className="fi" value={r.title} maxLength={60} onChange={e => setRoutine(t.key, { title: e.target.value })}/></label>
                      <div className="onb-row">
                        <label className="onb-f"><span>Horário</span><input className="fi" type="time" value={r.time || ''} onChange={e => setRoutine(t.key, { time: e.target.value || null })}/></label>
                        <label className="onb-f"><span>Duração (min)</span><input className="fi" type="number" min={1} max={240} value={r.duration ?? ''} onChange={e => setRoutine(t.key, { duration: e.target.value ? Math.min(240, Math.max(1, Number(e.target.value))) : null })}/></label>
                      </div>
                      <div className="onb-q">Dias</div>
                      <div className="onb-days" role="group" aria-label="Dias da rotina">
                        {WEEKDAYS.map((d, i) => { const on = r.weekdays.includes(i); return <button key={i} className={`onb-day ${on ? 'on' : ''}`} aria-pressed={on} aria-label={WEEKDAYS_LONG[i]} onClick={() => setRoutine(t.key, { weekdays: toggle(r.weekdays, i) })}>{d}</button> })}
                        <button className="lnk-inline" onClick={() => setRoutine(t.key, { weekdays: [...ALL_DAYS] })}>Todos</button>
                      </div>
                      <div className="onb-q">Quem faz</div>
                      <div className="onb-days" role="radiogroup" aria-label="Quem faz">
                        {(['shared', 'rotation', 'g', 's'] as AssignMode[]).map(m => <button key={m} role="radio" aria-checked={r.assign === m} className={`onb-day wide ${r.assign === m ? 'on' : ''}`} onClick={() => setRoutine(t.key, { assign: m })}>{lbl[m]}</button>)}
                      </div>
                      <div className="onb-q">Passos <small>🛡 = continua no modo sobrevivência</small></div>
                      <ol className="onb-steps-ed">
                        {r.steps.map((s, i) => (
                          <li key={i}>
                            <input className="fi" value={s.title} maxLength={80} aria-label={`Passo ${i + 1}`} onChange={e => setRoutine(t.key, { steps: r.steps.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })}/>
                            <button className={`onb-sv ${s.survival ? 'on' : ''}`} aria-pressed={!!s.survival} aria-label="Manter no modo sobrevivência" title="Manter no modo sobrevivência" onClick={() => setRoutine(t.key, { steps: r.steps.map((x, j) => j === i ? { ...x, survival: !x.survival } : x) })}>🛡</button>
                            <button className="onb-sv" aria-label={`Remover passo ${i + 1}`} onClick={() => setRoutine(t.key, { steps: r.steps.filter((_, j) => j !== i) })}>✕</button>
                          </li>
                        ))}
                      </ol>
                      {r.steps.length < 12 && <button className="lnk-inline" onClick={() => setRoutine(t.key, { steps: [...r.steps, { title: '', survival: false }] })}>+ Adicionar passo</button>}
                    </div>}
                  </div>
                )
              })}
            </div>
            <p className="onb-note">O checklist do dia a dia dessas rotinas chega na próxima atualização. Por enquanto elas ficam guardadas em Rotinas.</p>
          </>}

          {step === 8 && <>
            <h1 id="onb-h" ref={head} tabIndex={-1}>Escolha a aparência</h1>
            <p className="onb-lead">Vale só para este aparelho. Cada uma pode usar a sua. Dá para trocar depois em Ajustes.</p>
            <div className="onb-theme">
              <div className="themes" role="radiogroup" aria-label="Tema">
                {THEMES.map(t => (
                  <button key={t.id} role="radio" aria-checked={a.theme === t.id} className={`theme-opt ${a.theme === t.id ? 'on' : ''}`} onClick={() => { set({ theme: t.id }); p.onTheme(t.id) }}>
                    <span className="theme-sw" aria-hidden="true">{t.swatch.map((c, i) => <i key={i} style={{ background: c }}/>)}</span>
                    <span className="theme-t"><b>{t.name}</b><small>{t.desc}</small></span>
                  </button>
                ))}
              </div>
              <Preview theme={a.theme} name={a.names[p.me]} dogs={a.dogs.map(d => d.name).filter(Boolean)}/>
            </div>
          </>}

          {step === 9 && <>
            <h1 id="onb-h" ref={head} tabIndex={-1}>Confira antes de criar</h1>
            <p className="onb-lead">Nada é criado até você confirmar. O que já existe fica como está.</p>
            <div className="onb-sum">
              <div className="onb-card"><div className="onb-lbl">Integrantes <button className="lnk-inline" onClick={() => setStep(2)}>editar</button></div>
                <p>{first(a.names.g)} e {first(a.names.s)}{a.dogs.some(d => d.name.trim()) ? `, com ${a.dogs.filter(d => d.name.trim()).map(d => d.name.trim()).join(' e ')}` : ''}</p></div>
              <div className="onb-card"><div className="onb-lbl">Rotinas novas <button className="lnk-inline" onClick={() => setStep(7)}>editar</button></div>
                {chosen.length ? <ul className="onb-ul">{chosen.map(t => { const r = a.routines[t.key]; return <li key={t.key}><b>{r.title}</b> · {r.time || 'sem horário'} · {daysLabel(r.weekdays)} · {lbl[r.assign]}{t.essentialIf.some(e => a.essentials.includes(e)) ? ' · essencial' : ''}</li> })}</ul> : <p className="onb-mu">Nenhuma rotina nova.</p>}</div>
              <div className="onb-card"><div className="onb-lbl">Essenciais <button className="lnk-inline" onClick={() => setStep(6)}>editar</button></div>
                {a.essentials.length ? <p>{a.essentials.map(e => e === 'outros' ? a.otherEssential.trim() : ESSENTIALS.find(x => x.id === e)?.label).filter(Boolean).join(' · ')}</p> : <p className="onb-mu">Nenhum escolhido.</p>}
                {essentialTasks.length > 0 && <p className="onb-mu">Viram essenciais: {essentialTasks.map(t => t.title).join(', ')}</p>}</div>
              <div className="onb-card"><div className="onb-lbl">Disponibilidade <button className="lnk-inline" onClick={() => setStep(5)}>editar</button></div>
                <ul className="onb-ul">{(['g', 's'] as Who[]).map(w => <li key={w}><b>{first(a.names[w])}</b>: {a.week[w].heavy.length ? `dias pesados ${[...a.week[w].heavy].sort((x, y) => x - y).map(i => WEEKDAYS[i]).join(', ')}` : 'sem dia pesado'} · tempo de {a.week[w].periods.length ? a.week[w].periods.map(x => PERIODS.find(q => q.id === x)?.label.toLowerCase()).join(', ') : '—'}</li>)}
                  <li>Planejar no(a) {WEEKDAYS_LONG[a.week.planningDay]} · energia típica {ENERGY[a.week.energy].short.toLowerCase()}</li></ul></div>
              <div className="onb-card"><div className="onb-lbl">Tema <button className="lnk-inline" onClick={() => setStep(8)}>editar</button></div>
                <p>{THEMES.find(t => t.id === a.theme)?.name}</p></div>
              <div className="onb-card onb-chal"><div className="onb-lbl">Primeiro desafio sugerido</div>
                <p><b>{challenge.title}</b> · {challenge.days} dias, as duas juntas</p><p className="onb-mu">{challenge.why}. Os desafios chegam numa próxima atualização.</p></div>
            </div>
          </>}

          {err && <p className="onb-err" role="alert">{err}</p>}
        </section>
      </div>

      <footer className="onb-foot">
        <div className="onb-foot-in">
          {step > 1 ? <button className="btn btn-g" onClick={back} disabled={busy}>Voltar</button>
            : <button className="btn btn-g" onClick={pause}>Pular por agora</button>}
          {step < LAST_STEP ? <button className="btn btn-p" onClick={next}>{step === 1 ? 'Começar' : 'Continuar'}</button>
            : <button className="btn btn-p" onClick={confirm} disabled={busy}>{busy ? 'Criando…' : 'Confirmar e criar'}</button>}
        </div>
      </footer>
    </div>
  )
}

/** Prévia real: os mesmos tokens do tema aplicados num painel em miniatura. */
function Preview({ theme, name, dogs }: { theme: ThemeId, name: string, dogs: string[] }) {
  return (
    <div className="pv" data-theme={theme} aria-label="Prévia do painel com o tema escolhido">
      <div className="pv-top"><span className="logo">Ni<span>nho</span></span><span className="chip amber">🌤 Média</span></div>
      <div className="pv-h">Bom dia, {first(name)}</div>
      <div className="pv-stats">
        <div className="pv-card"><small>Hoje</small><b>3/5</b><span className="pv-bar"><i style={{ width: '60%' }}/></span></div>
        <div className="pv-card"><small>Sequência</small><b>🔥 4 dias</b></div>
      </div>
      <div className="pv-card pv-list">
        <div className="pv-row done"><span className="pv-ck">✓</span>Fechar a cozinha</div>
        <div className="pv-row"><span className="pv-ck"/>Louça<span className="chip coral">essencial</span></div>
        <div className="pv-row"><span className="pv-ck"/>Passeio · {dogs.slice(0, 2).join(' e ') || 'cães'}</div>
      </div>
      <div className="pv-btn">+ Ação rápida</div>
    </div>
  )
}
