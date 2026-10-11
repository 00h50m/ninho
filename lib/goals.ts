// Objetivos do Meu dia: meta, prazo e progresso. Peso, treinos e água se
// calculam sozinhos a partir dos registros; "outro" soma o que a pessoa lança.
// Puro (sem React/Supabase), testado.
import { dayNum } from './dates'
import { bodySeries, waterOn, type PLog } from './meudia'
import type { Who } from './types'

export type GoalKind = 'peso' | 'treinos' | 'agua' | 'manual'
export interface PGoal {
  id: string, who: Who, title: string, kind: GoalKind, unit: string | null
  start_value: number | null, target: number, start_date: string, due_date: string | null, status: 'ativo' | 'concluido' | 'arquivado'
}
export const GOAL_KINDS: Array<[GoalKind, string, string, string]> = [
  ['peso', '⚖️', 'Peso', 'Chegar a um peso (usa os pesos da Evolução)'],
  ['treinos', '🏋️', 'Treinos', 'Fazer um número de treinos até a data'],
  ['agua', '💧', 'Água', 'Dias batendo a meta de água'],
  ['manual', '🎯', 'Outro', 'Qualquer número: você soma o progresso'],
]

export interface GoalProgress {
  done: number, total: number, pct: number, left: number, unit: string
  current: number | null            // peso atual (só no tipo peso)
  daysLeft: number | null           // até o prazo (negativo = passou)
  perWeek: number | null            // ritmo necessário daqui até o prazo
  expectedPct: number | null        // onde "deveria" estar hoje, pelo prazo
  state: 'ok' | 'atras' | 'feito' | 'sem_dado'
}

const r1 = (v: number) => Math.round(v * 10) / 10

export function goalProgress(g: PGoal, logs: PLog[], today: string, waterGoal = 2000): GoalProgress {
  let done = 0, total = g.target, current: number | null = null, unit = g.unit || ''
  const inRange = (d: string) => d >= g.start_date && d <= (g.due_date && g.due_date < today ? g.due_date : today)
  if (g.kind === 'peso') {
    unit = 'kg'
    const ws = bodySeries(logs, g.who, 'weight')
    current = ws.length ? ws[ws.length - 1].v : g.start_value
    const start = g.start_value ?? current
    if (start == null || current == null) return { done: 0, total: 0, pct: 0, left: 0, unit, current, daysLeft: null, perWeek: null, expectedPct: null, state: 'sem_dado' }
    total = r1(Math.abs(start - g.target))
    const dir = Math.sign(start - g.target) || 1
    done = r1(Math.max(0, (start - current) * dir))
  } else if (g.kind === 'treinos') {
    unit = 'treinos'
    done = logs.filter(l => l.who === g.who && l.kind === 'treino' && inRange(l.date)).length
  } else if (g.kind === 'agua') {
    unit = 'dias'
    const days = new Set(logs.filter(l => l.who === g.who && l.kind === 'agua' && inRange(l.date)).map(l => l.date))
    done = Array.from(days).filter(d => waterOn(logs, g.who, d) >= waterGoal).length
  } else {
    done = r1(logs.filter(l => l.who === g.who && l.kind === 'objetivo' && l.data?.goal_id === g.id).reduce((a, l) => a + Number(l.value || 0), 0))
  }
  const pct = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0
  const left = r1(Math.max(0, total - done))
  const daysLeft = g.due_date ? dayNum(g.due_date) - dayNum(today) : null
  const span = g.due_date ? dayNum(g.due_date) - dayNum(g.start_date) : null
  const expectedPct = span && span > 0 ? Math.max(0, Math.min(100, Math.round((dayNum(today) - dayNum(g.start_date)) / span * 100))) : null
  const perWeek = daysLeft != null && daysLeft > 0 && left > 0 ? r1(left / (daysLeft / 7)) : null
  const state = pct >= 100 ? 'feito' : expectedPct != null && pct + 10 < expectedPct ? 'atras' : 'ok'
  return { done, total, pct, left, unit, current, daysLeft, perWeek, expectedPct, state }
}

/** "Alcançar 12 kg perdidos", "Fazer 40 treinos"… */
export function goalLine(g: PGoal, p: GoalProgress): string {
  const n = (v: number) => String(v).replace('.', ',')
  if (g.kind === 'peso') return g.start_value != null && g.start_value > g.target ? `Perder ${n(p.total)} kg (chegar a ${n(g.target)} kg)` : `Chegar a ${n(g.target)} kg`
  if (g.kind === 'treinos') return `Fazer ${n(g.target)} treinos`
  if (g.kind === 'agua') return `${n(g.target)} dias batendo a meta de água`
  return `Chegar a ${n(g.target)}${g.unit ? ' ' + g.unit : ''}`
}
