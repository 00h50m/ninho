import { describe, expect, it } from 'vitest'
import { byPlace, fromShopping, guessPlace, urgency, urgencyLabel, useSoon, type PantryItem } from '@/lib/despensa'
import { cookCount, weekPlan, weekShopping, type HouseMeal } from '@/lib/jantar'
import { balanceLine, weekBalance } from '@/lib/balanco'
import { buildDogs, buildTasks } from '@/lib/build'
import { prevWeekLoad, smartSplit, type SplitUnit } from '@/lib/split'
import type { Task } from '@/lib/types'

// Dados fictícios. 2026-10-28 é quarta; a semana começa na segunda 26/10.
const T = '2026-10-28'
const it_ = (id: string, name: string, expires_on: string | null, place: PantryItem['place'] = 'geladeira'): PantryItem => ({ id, name, place, qty: null, expires_on })

describe('despensa', () => {
  it('validade: vencido, hoje, logo (3 dias), semana, ok, sem', () => {
    expect(['2026-10-26', T, '2026-10-29', '2026-10-31', '2026-11-04', '2026-11-10', null].map(d => urgency({ expires_on: d }, T).u)).toEqual(['vencido', 'hoje', 'logo', 'logo', 'semana', 'ok', 'sem'])
    expect(['2026-10-27', '2026-10-25', T, '2026-10-29', '2026-11-02', null].map(d => urgencyLabel({ expires_on: d }, T))).toEqual(['venceu ontem', 'venceu há 3 dias', 'vence hoje', 'vence amanhã', 'vence em 5 dias', 'sem validade'])
  })
  it('por lugar com o que vence antes no topo; usar logo', () => {
    const items = [it_('1', 'Queijo', '2026-11-20'), it_('2', 'Iogurte', '2026-10-29'), it_('3', 'Arroz', null, 'despensa'), it_('4', 'Presunto', '2026-10-27')]
    const g = byPlace(items, T)
    expect(g.map(x => x.place)).toEqual(['geladeira', 'despensa'])
    expect(g[0].items.map(i => i.name)).toEqual(['Presunto', 'Iogurte', 'Queijo'])
    expect(useSoon(items, T).map(i => i.name)).toEqual(['Presunto', 'Iogurte'])
  })
  it('lugar pelo nome e o que veio da última compra', () => {
    expect(['Iogurte natural', 'Sorvete', 'Shampoo', 'Detergente', 'Arroz'].map(guessPlace)).toEqual(['geladeira', 'freezer', 'banheiro', 'limpeza', 'despensa'])
    const hist = [{ title: 'Leite', done_at: '2026-10-27T20:00:00Z' }, { title: 'Iogurte', done_at: '2026-10-27T20:00:00Z' }, { title: 'Pão', done_at: '2026-10-20T20:00:00Z' }, { title: 'leite', done_at: '2026-10-28T09:00:00Z' }]
    expect(fromShopping(hist, [it_('2', 'Iogurte', null)], T)).toEqual(['Leite'])
  })
})

const meal = (date: string, title: string, cook: HouseMeal['cook'], ingredients: HouseMeal['ingredients'] = []): HouseMeal => ({ id: date, date, meal: 'jantar', title, cook, recipe_id: null, ingredients, notes: null })
describe('jantar das duas', () => {
  const meals = [meal('2026-10-26', 'Escondidinho', 's', [{ title: 'Peito de frango', qty: '500 g' }, { title: 'Batata', qty: '1 kg' }]), meal('2026-10-28', 'Strogonoff', 'g', [{ title: 'Peito de frango', qty: '600 g' }, { title: 'Creme de leite', qty: '1 caixa' }]), meal('2026-10-30', 'Pizza', 'both')]
  it('semana de segunda a domingo com o jantar de cada dia', () => {
    const w = weekPlan(meals, T)
    expect(w.map(d => d.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(w.map(d => d.meal?.title || '-')).toEqual(['Escondidinho', '-', 'Strogonoff', '-', 'Pizza', '-', '-'])
  })
  it('ingredientes juntos somando gramas e kg', () => {
    expect(weekShopping(meals)).toEqual([{ title: 'Peito de frango', qty: '1,1 kg' }, { title: 'Batata', qty: '1 kg' }, { title: 'Creme de leite', qty: '1 caixa' }])
  })
  it('quem cozinhou (as duas = meio para cada)', () => {
    expect(cookCount(meals, '2026-10-26', '2026-11-01')).toEqual({ g: 1.5, s: 1.5 })
  })
})

describe('balanço da semana', () => {
  const task = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'general', weight: 'medium', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o } as Task)
  const tasks = buildTasks([task('louca'), task('faxina', { weight: 'heavy' })], [
    { id: '1', task_id: 'louca', date: '2026-10-26', completed_by: 'g' }, { id: '2', task_id: 'louca', date: '2026-10-27', completed_by: 'g' },
    { id: '3', task_id: 'faxina', date: '2026-10-27', completed_by: 's' }, { id: '4', task_id: 'louca', date: T, completed_by: 'g' },
    { id: '5', task_id: 'louca', date: '2026-10-20', completed_by: 's' }, { id: '6', task_id: 'louca', date: '2026-10-21', completed_by: null },
  ], T)
  const dogs = buildDogs([{ id: 'p', name: 'Pen', active: true, dog_routines: [{ id: 'r1', title: 'Ração', frequency: 'daily', scheduled_time: '07:00' }] }], [{ id: 'd1', routine_id: 'r1', date: '2026-10-27', completed_by: 's' }], T)
  const ev = [{ id: 'e', kind: 'compromisso', title: 'Plantão', date: '2026-10-27', time: '08:00', end_time: '14:00', who: 's', done_at: null }]
  it('esforço de cada uma (hoje conta), cozinha e compromissos', () => {
    const b = weekBalance({ tasks, dogs, meals: [meal('2026-10-26', 'X', 's')], events: ev, anyDay: T, today: T })
    expect(b).toMatchObject({ from: '2026-10-26', to: T, g: { points: 6, done: 3, cooked: 0, busyMin: 0 }, s: { points: 4, done: 2, cooked: 1, busyMin: 360 }, unknown: 0 })
    expect(b.pctG).toBe(50) // 6 × (4 + 2 da cozinha)
    expect(b.verdict).toBe('equilibrado')
  })
  it('semana passada e a frase sem placar', () => {
    const b = weekBalance({ tasks, dogs, meals: [], events: [], anyDay: '2026-10-21', today: T })
    expect(b).toMatchObject({ from: '2026-10-19', to: '2026-10-25', g: { points: 0 }, s: { points: 2 }, unknown: 1, pctG: 0, verdict: 's' })
    expect(balanceLine(b, { g: 'Gi Teste', s: 'Sá Teste' }, false)).toBe('Gi 0% · Sá 100% do esforço. A Sá puxou mais; esta semana o rodízio compensa.')
    const vazio = weekBalance({ tasks: [], dogs: [], meals: [], events: [], anyDay: T, today: T })
    expect(balanceLine(vazio, { g: 'A', s: 'B' }, true)).toContain('nada concluído')
  })
  it('rodízio: quem fez mais na semana passada recebe menos agora', () => {
    const hist = (by: 'g' | 's', n: number) => Array.from({ length: n }, (_, i) => ({ d: `2026-10-${String(19 + i).padStart(2, '0')}`, by }))
    const all = [{ weight: 3, hist: hist('g', 6) }]
    expect(prevWeekLoad(all, T)).toEqual({ g: 18, s: 0 })
    const units: SplitUnit[] = [{ id: 'a', frequency: 'daily', time: '', title: 'A', weight: 2, hist: [] }]
    const d = smartSplit(units, [], all, T, () => 'g')
    expect(d.get('a')!.who).toBe('s')
  })
})
