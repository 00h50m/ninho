import { describe, expect, it } from 'vitest'
import { planCandidates, planLines, planWeek, plannedOn, proposePlan } from '@/lib/planoSemana'
import { buildTasks } from '@/lib/build'
import { groupToday } from '@/lib/today'
import type { Task } from '@/lib/types'

// Dados fictícios. 2026-11-08 é domingo; 2026-11-09 segunda; 2026-11-11 quarta.
const t = (title: string, o: Partial<Task> = {}): Task => ({ id: title, title, category: 'general', frequency: 'weekly', assigned_to: 'g', weight: 'medium', scheduled_time: null, essential: false, active: true, hist: [], completed_today: false, prev_done: null, ...o } as Task)
const owner = (x: Task) => (x.assigned_to === 's' ? 's' : 'g') as 'g' | 's'

describe('semana do plano', () => {
  it('no domingo planeja a próxima; nos outros dias, de hoje até domingo', () => {
    expect(planWeek('2026-11-08')).toEqual({ start: '2026-11-09', from: '2026-11-09', end: '2026-11-15' })
    expect(planWeek('2026-11-11')).toEqual({ start: '2026-11-09', from: '2026-11-11', end: '2026-11-15' })
  })
})

describe('o que entra no plano', () => {
  it('semanais e quinzenais não feitas; diárias e pontuais não', () => {
    const ts = [t('Faxina'), t('Lavar roupa', { frequency: 'biweekly' }), t('Louça', { frequency: 'daily' }), t('Trocar lâmpada', { frequency: 'once' })]
    expect(planCandidates(ts, '2026-11-08').map(x => x.title)).toEqual(['Faxina', 'Lavar roupa'])
  })
  it('já feita no período: fora', () => {
    expect(planCandidates([t('Faxina', { prev_done: '2026-11-10' })], '2026-11-11')).toEqual([])
  })
  it('mensal só quando o mês acaba até a semana seguinte', () => {
    expect(planCandidates([t('Filtro', { frequency: 'monthly' })], '2026-11-08')).toEqual([])
    expect(planCandidates([t('Filtro', { frequency: 'monthly' })], '2026-11-22').map(x => x.title)).toEqual(['Filtro'])
  })
  it('pausada ou com dias da semana fora do intervalo: fora', () => {
    expect(planCandidates([t('Faxina', { paused_until: '2026-11-30' } as any)], '2026-11-08')).toEqual([])
  })
})

describe('proposta', () => {
  it('evita dia com agenda e não junta duas pesadas da mesma pessoa', () => {
    const ts = [t('Faxina banheiro', { weight: 'heavy' }), t('Faxina cozinha', { weight: 'heavy' }), t('Mercado', { weight: 'light', assigned_to: 's' })]
    const ev = [{ date: '2026-11-09' }, { date: '2026-11-09' }]
    const p = proposePlan(ts, ev, '2026-11-08', owner)
    const day = (n: string) => p.find(i => i.task.title === n)!.date
    expect(day('Faxina banheiro')).not.toBe('2026-11-09')
    expect(day('Faxina banheiro')).not.toBe(day('Faxina cozinha'))
    expect(p.every(i => i.date >= '2026-11-09' && i.date <= '2026-11-15')).toBe(true)
  })
  it('respeita os dias da semana da tarefa', () => {
    const p = proposePlan([t('Feira', { weekdays: [6] } as any)], [], '2026-11-08', owner)
    expect(p[0].date).toBe('2026-11-14')
  })
  it('no meio da semana, não volta no tempo', () => {
    const p = proposePlan([t('Faxina')], [], '2026-11-11', owner)
    expect(p[0].date >= '2026-11-11').toBe(true)
  })
  it('linhas por dia', () => {
    const p = proposePlan([t('Faxina', { weight: 'heavy' }), t('Mercado', { assigned_to: 's' })], [{ date: '2026-11-09' }], '2026-11-08', owner)
    expect(planLines(p, { g: 'Giovanna X', s: 'Sabrina' })).toEqual(['ter · Faxina (Giovanna), Mercado (Sabrina)'])
  })
})

describe('plano aprovado', () => {
  const rows = [{ id: 'p1', task_id: 'Faxina', week_start: '2026-11-09', date: '2026-11-11' }]
  it('a tarefa sabe o dia planejado desta semana', () => {
    expect(plannedOn(rows, 'Faxina', '2026-11-10')).toBe('2026-11-11')
    expect(plannedOn(rows, 'Faxina', '2026-11-17')).toBeNull()
    const [x] = buildTasks([{ id: 'Faxina', title: 'Faxina', frequency: 'weekly', active: true }], [], '2026-11-10', [], [], [], rows)
    expect(x.planned_on).toBe('2026-11-11')
    expect(x.plans).toEqual([{ id: 'p1', week_start: '2026-11-09', date: '2026-11-11' }])
  })
  it('no dia planejado sobe para "hoje, a qualquer hora"; antes fica na semana', () => {
    const it = (today: string) => { const [x] = buildTasks([{ id: 'Faxina', title: 'Faxina', frequency: 'weekly', active: true, category: 'general' }], [], today, [], [], [], rows); return groupToday([{ id: x.id, frequency: 'weekly', scheduled_time: null, essential: false, category: 'general', task: x }], '10:00', today)[0].k }
    expect(it('2026-11-10')).toBe('weekly')
    expect(it('2026-11-11')).toBe('any')
    expect(it('2026-11-12')).toBe('any')
  })
})
