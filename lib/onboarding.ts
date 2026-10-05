// Configuração inicial do Ninho (onboarding): passos, modelos de rotina e regras.
// Puro (sem React/Supabase) para ser testado. A tela fica em components/onboarding.
import type { Energy, Names, Task, Who } from './types'
import type { ThemeId } from './theme'

export const STEPS = [
  { n: 1, title: 'Boas-vindas' },
  { n: 2, title: 'Quem faz parte' },
  { n: 3, title: 'Este aparelho' },
  { n: 4, title: 'O que pesa' },
  { n: 5, title: 'A semana' },
  { n: 6, title: 'Essenciais' },
  { n: 7, title: 'Primeiras rotinas' },
  { n: 8, title: 'Aparência' },
  { n: 9, title: 'Resumo' },
] as const
export const LAST_STEP = STEPS.length

export type Period = 'manha' | 'tarde' | 'noite'
export type AssignMode = 'g' | 's' | 'shared' | 'rotation'
export interface Step { title: string, survival?: boolean }
export interface RoutineChoice {
  on: boolean
  title: string
  time: string | null
  /** 0 = domingo … 6 = sábado. Todos os dias = [0..6]. */
  weekdays: number[]
  duration: number | null
  assign: AssignMode
  steps: Step[]
}
export interface PersonWeek { heavy: number[], periods: Period[] }
export interface Answers {
  names: Names
  dogs: Array<{ id: string | null, name: string }>
  pains: string[]
  week: { g: PersonWeek, s: PersonWeek, planningDay: number, energy: Energy }
  essentials: string[]
  otherEssential: string
  routines: Record<string, RoutineChoice>
  theme: ThemeId
}

export const MAX_PAINS = 3
export const PAINS: Array<{ id: string, label: string }> = [
  { id: 'esquecidas', label: 'Tarefas esquecidas' },
  { id: 'divisao', label: 'Divisão desigual' },
  { id: 'rotina', label: 'Falta de rotina' },
  { id: 'caes', label: 'Cuidados dos cães' },
  { id: 'compras', label: 'Compras' },
  { id: 'manutencao', label: 'Manutenção da casa' },
  { id: 'cansaco', label: 'Cansaço' },
  { id: 'semana', label: 'Semana desorganizada' },
  { id: 'prioridade', label: 'Saber o que é prioridade' },
]

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
export const PERIODS: Array<{ id: Period, label: string }> = [
  { id: 'manha', label: 'Manhã' }, { id: 'tarde', label: 'Tarde' }, { id: 'noite', label: 'Noite' },
]
export const ASSIGN_LABEL = (names: Names): Record<AssignMode, string> => ({
  g: first(names.g), s: first(names.s), shared: 'As duas', rotation: 'Rodízio',
})

/** Essenciais: o que não pode falhar. `match` acha tarefas que já existem. */
export const ESSENTIALS: Array<{ id: string, label: string, match?: (t: Task) => boolean }> = [
  { id: 'caes_comida', label: 'Alimentação dos cães', match: t => /ra[cç][aã]o|comida d/i.test(t.title) },
  { id: 'caes_agua', label: 'Água dos cães', match: t => /[aá]gua/i.test(t.title) && (t.category === 'dogs' || /c[aã]es|cachorr|pet/i.test(t.title)) },
  { id: 'passeios', label: 'Passeios', match: t => /passeio/i.test(t.title) },
  { id: 'louca', label: 'Louça', match: t => /lou[cç]a/i.test(t.title) },
  { id: 'lixo', label: 'Lixo', match: t => /lixo/i.test(t.title) },
  { id: 'lavanderia', label: 'Lavanderia', match: t => t.category === 'laundry' || /roupa|lavanderia/i.test(t.title) },
  { id: 'cozinha', label: 'Cozinha organizada', match: t => t.category === 'kitchen' && /cozinha|fog[aã]o|pia|bancada/i.test(t.title) },
  { id: 'medicacao', label: 'Medicação', match: t => /rem[eé]dio|medica/i.test(t.title) },
  { id: 'outros', label: 'Outro' },
]

/** Tarefas ativas que passam a ser essenciais com as escolhas (as que já são ficam de fora). */
export function matchEssentialTasks(tasks: Task[], essentials: string[]): Task[] {
  const rules = ESSENTIALS.filter(e => essentials.includes(e.id) && e.match)
  return tasks.filter(t => t.active !== false && !t.essential && rules.some(r => r.match!(t)))
}

/** Medicação só aparece como opção se houver algo cadastrado. */
export function hasMedication(tasks: Task[], dogRoutineTitles: string[]): boolean {
  return tasks.some(t => /rem[eé]dio|medica/i.test(t.title)) || dogRoutineTitles.some(t => /rem[eé]dio|medica/i.test(t))
}

// ── Modelos de rotina ────────────────────────────────────────────────
export interface Template {
  key: string, title: string, description: string, category: string
  time: string | null, weekdays: number[], duration: number, assign: AssignMode
  steps: Step[]
  /** Fica essencial se alguma destas escolhas da etapa 6 foi marcada */
  essentialIf: string[]
  /** Vem marcada se alguma destas dores foi escolhida na etapa 4 */
  suggestIf: string[]
}

const s = (title: string, survival = false): Step => ({ title, survival })

export const TEMPLATES: Template[] = [
  { key: 'abrir_casa', title: 'Abrir a casa', description: 'Começar o dia com a casa respirando', category: 'manha', time: '07:30', weekdays: ALL_DAYS, duration: 10, assign: 'shared',
    steps: [s('Abrir janelas e cortinas', true), s('Arrumar a cama'), s('Conferir a água dos cães', true)], essentialIf: ['caes_agua'], suggestIf: ['rotina'] },
  { key: 'manha', title: 'Rotina da manhã', description: 'O básico para o dia não começar atrasado', category: 'manha', time: '08:00', weekdays: [1, 2, 3, 4, 5], duration: 20, assign: 'shared',
    steps: [s('Café da manhã e louça do café'), s('Ração dos cães', true), s('Olhar a agenda do dia', true)], essentialIf: ['caes_comida'], suggestIf: ['rotina', 'prioridade'] },
  { key: 'cozinha_fechada', title: 'Fechar a cozinha', description: 'Dormir com a cozinha em ordem', category: 'cozinha', time: '21:30', weekdays: ALL_DAYS, duration: 15, assign: 'rotation',
    steps: [s('Lavar ou guardar a louça', true), s('Limpar a pia e o fogão'), s('Passar pano na bancada'), s('Tirar o lixo se estiver cheio', true)], essentialIf: ['louca', 'cozinha', 'lixo'], suggestIf: ['esquecidas', 'divisao'] },
  { key: 'noturna', title: 'Rotina noturna', description: 'Preparar a casa e o dia seguinte', category: 'noite', time: '22:30', weekdays: ALL_DAYS, duration: 10, assign: 'shared',
    steps: [s('Recolher o que está fora do lugar'), s('Separar roupa e mochila de amanhã'), s('Trancar a casa', true)], essentialIf: [], suggestIf: ['cansaco', 'rotina'] },
  { key: 'caes', title: 'Rotina dos cães', description: 'Comida, água e passeio no ritmo delas', category: 'caes', time: '19:00', weekdays: ALL_DAYS, duration: 30, assign: 'rotation',
    steps: [s('Ração', true), s('Água fresca', true), s('Passeio'), s('Recolher cocô do quintal')], essentialIf: ['caes_comida', 'caes_agua', 'passeios'], suggestIf: ['caes'] },
  { key: 'reset_domingo', title: 'Reset de domingo', description: 'Deixar a casa pronta para a semana', category: 'semana', time: '10:00', weekdays: [0], duration: 60, assign: 'shared',
    steps: [s('Trocar roupa de cama e toalhas'), s('Lavar e estender roupa', true), s('Aspirar a casa'), s('Limpar a geladeira')], essentialIf: ['lavanderia'], suggestIf: ['semana', 'divisao'] },
  { key: 'prep_semana', title: 'Preparação da semana', description: 'Combinar a semana em poucos minutos', category: 'semana', time: '18:00', weekdays: [0], duration: 20, assign: 'shared',
    steps: [s('Olhar a agenda das duas', true), s('Lista de compras'), s('Combinar quem faz o quê'), s('Definir a energia da semana')], essentialIf: [], suggestIf: ['semana', 'prioridade', 'compras'] },
  { key: 'resgate_15', title: 'Resgate de 15 minutos', description: 'Para quando a casa sair do controle', category: 'casa', time: null, weekdays: ALL_DAYS, duration: 15, assign: 'shared',
    steps: [s('Recolher o que está no chão', true), s('Louça na pia', true), s('Superfícies livres'), s('Lixo para fora')], essentialIf: [], suggestIf: ['cansaco'] },
]

export function templateChoice(t: Template, on: boolean): RoutineChoice {
  return { on, title: t.title, time: t.time, weekdays: [...t.weekdays], duration: t.duration, assign: t.assign, steps: t.steps.map(x => ({ ...x })) }
}

/** Sugestão inicial: modelos ligados às dores escolhidas (no máximo 3), fora os que a casa já tem. */
export function suggestRoutines(pains: string[], existing: string[]): string[] {
  const picked = TEMPLATES.filter(t => !existing.includes(t.key) && t.suggestIf.some(p => pains.includes(p))).map(t => t.key)
  return (picked.length ? picked : ['cozinha_fechada', 'caes'].filter(k => !existing.includes(k))).slice(0, 3)
}

/** Primeiro desafio sugerido (colaborativo, as duas juntas). */
export function suggestChallenge(a: Pick<Answers, 'pains' | 'routines'>): { title: string, days: number, why: string } {
  const on = (k: string) => a.routines[k]?.on
  if (on('cozinha_fechada') || a.pains.includes('esquecidas')) return { title: 'Cozinha fechada todas as noites', days: 7, why: 'Uma vitória visível por dia' }
  if (on('caes') || a.pains.includes('caes')) return { title: 'Passeio no horário', days: 7, why: 'Penélope e Zelda agradecem' }
  if (a.pains.includes('cansaco')) return { title: 'Organização de 10 minutos', days: 7, why: 'Pouco tempo, todo dia' }
  if (on('reset_domingo') || a.pains.includes('semana')) return { title: 'Reset de domingo', days: 21, why: 'Três semanas começando em ordem' }
  return { title: 'Semana sem essenciais atrasadas', days: 7, why: 'O básico garantido' }
}

export function defaultAnswers(names: Names, dogs: Array<{ id: string, name: string }>, theme: ThemeId): Answers {
  return {
    names: { ...names },
    dogs: dogs.length ? dogs.map(d => ({ id: d.id, name: d.name })) : [{ id: null, name: '' }],
    pains: [],
    week: { g: { heavy: [], periods: ['noite'] }, s: { heavy: [], periods: ['noite'] }, planningDay: 0, energy: 'medium' },
    essentials: [],
    otherEssential: '',
    routines: Object.fromEntries(TEMPLATES.map(t => [t.key, templateChoice(t, false)])),
    theme,
  }
}

/** Respostas salvas (rascunho ou configuração antiga) por cima do padrão: nada falta, nada inválido. */
export function mergeAnswers(base: Answers, saved: unknown): Answers {
  if (!saved || typeof saved !== 'object') return base
  const v = saved as Partial<Answers>
  const arr = <T,>(x: unknown, ok: (y: unknown) => boolean): T[] | null => Array.isArray(x) ? (x.filter(ok) as T[]) : null
  const isDay = (d: unknown) => typeof d === 'number' && d >= 0 && d <= 6
  const pw = (p: unknown, d: PersonWeek): PersonWeek => {
    const o = (p && typeof p === 'object' ? p : {}) as Partial<PersonWeek>
    return { heavy: arr<number>(o.heavy, isDay) ?? d.heavy, periods: arr<Period>(o.periods, x => PERIODS.some(q => q.id === x)) ?? d.periods }
  }
  const routines = { ...base.routines }
  if (v.routines && typeof v.routines === 'object') {
    for (const [k, r] of Object.entries(v.routines)) {
      if (!routines[k] || !r || typeof r !== 'object') continue
      const c = r as Partial<RoutineChoice>
      routines[k] = {
        on: !!c.on,
        title: typeof c.title === 'string' && c.title.trim() ? c.title.slice(0, 60) : routines[k].title,
        time: typeof c.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(c.time) ? c.time : c.time === null ? null : routines[k].time,
        weekdays: arr<number>(c.weekdays, isDay)?.length ? arr<number>(c.weekdays, isDay)! : routines[k].weekdays,
        duration: typeof c.duration === 'number' && c.duration > 0 && c.duration <= 240 ? c.duration : routines[k].duration,
        assign: (['g', 's', 'shared', 'rotation'] as const).includes(c.assign as AssignMode) ? c.assign as AssignMode : routines[k].assign,
        steps: Array.isArray(c.steps) ? c.steps.filter(x => x && typeof x.title === 'string').map(x => ({ title: x.title.slice(0, 80), survival: !!x.survival })) : routines[k].steps,
      }
    }
  }
  const w = (v.week || {}) as Partial<Answers['week']>
  return {
    names: { g: v.names?.g?.trim() ? v.names.g : base.names.g, s: v.names?.s?.trim() ? v.names.s : base.names.s },
    dogs: arr<{ id: string | null, name: string }>(v.dogs, d => !!d && typeof (d as any).name === 'string') ?? base.dogs,
    pains: (arr<string>(v.pains, p => PAINS.some(x => x.id === p)) ?? base.pains).slice(0, MAX_PAINS),
    week: {
      g: pw(w.g, base.week.g), s: pw(w.s, base.week.s),
      planningDay: isDay(w.planningDay) ? w.planningDay as number : base.week.planningDay,
      energy: (['high', 'medium', 'low'] as const).includes(w.energy as Energy) ? w.energy as Energy : base.week.energy,
    },
    essentials: arr<string>(v.essentials, e => ESSENTIALS.some(x => x.id === e)) ?? base.essentials,
    otherEssential: typeof v.otherEssential === 'string' ? v.otherEssential.slice(0, 60) : base.otherEssential,
    routines,
    theme: (typeof v.theme === 'string' ? v.theme : base.theme) as ThemeId,
  }
}

/** O que impede avançar em cada etapa (null = pode seguir). */
export function stepError(step: number, a: Answers): string | null {
  if (step === 2) {
    if (!a.names.g.trim() || !a.names.s.trim()) return 'Preencha o nome das duas.'
    if (a.dogs.some(d => d.id && !d.name.trim())) return 'Os cães cadastrados precisam de um nome.'
  }
  if (step === 4 && a.pains.length > MAX_PAINS) return `Escolha até ${MAX_PAINS}.`
  if (step === 6 && a.essentials.includes('outros') && !a.otherEssential.trim()) return 'Escreva qual é o outro essencial (ou desmarque).'
  if (step === 7) {
    const bad = Object.values(a.routines).find(r => r.on && (!r.title.trim() || !r.weekdays.length || !r.steps.some(x => x.title.trim())))
    if (bad) return `"${bad.title || 'Rotina sem nome'}" precisa de nome, ao menos um dia e um passo.`
  }
  return null
}

/** Quando abrir a configuração sozinha: casa sem configuração e a pessoa ainda não pausou/pulou. */
export function shouldAutoOpen(s: { available: boolean, completed: boolean, progress: { skipped_at: string | null } | null }): boolean {
  return s.available && !s.completed && !s.progress?.skipped_at
}

/** Dados enviados para ninho_finish_onboarding. */
export function buildPayload(a: Answers, tasks: Task[], existingKeys: string[]) {
  const essentialTasks = matchEssentialTasks(tasks, a.essentials)
  const routines = TEMPLATES.filter(t => a.routines[t.key]?.on && !existingKeys.includes(t.key)).map(t => {
    const r = a.routines[t.key]
    return {
      key: t.key, title: r.title.trim(), description: t.description, category: t.category,
      weekdays: [...r.weekdays].sort((x, y) => x - y), time: r.time, duration: r.duration, assign: r.assign,
      essential: t.essentialIf.some(e => a.essentials.includes(e)),
      steps: r.steps.filter(x => x.title.trim()).map(x => ({ title: x.title.trim(), survival: !!x.survival })),
    }
  })
  const answers = {
    pains: a.pains, week: a.week, essentials: a.essentials,
    otherEssential: a.otherEssential.trim() || null, theme: a.theme,
    routines: routines.map(r => r.key), challenge: suggestChallenge(a),
  }
  return {
    names: { g: a.names.g.trim(), s: a.names.s.trim() },
    dogs: a.dogs.filter(d => d.name.trim()).map(d => ({ id: d.id, name: d.name.trim() })),
    routines, essential_task_ids: essentialTasks.map(t => t.id), answers,
  }
}

export function daysLabel(days: number[]): string {
  const d = [...days].sort((x, y) => x - y)
  if (d.length === 7) return 'Todos os dias'
  if (d.join() === '1,2,3,4,5') return 'Dias úteis'
  if (d.join() === '0,6') return 'Fim de semana'
  return d.map(x => WEEKDAYS[x]).join(', ')
}

export function first(name: string): string { return (name || '').trim().split(/\s+/)[0] || name }
export type { Who }
