// Fase 3: divisão inteligente, lista de compras, manutenção e mensagens.
import { describe, expect, it } from 'vitest'
import { assignGroup, lastBefore, smartSplit, weekLoad, whyLabel, MAX_GAP, type SplitUnit } from '@/lib/split'
import { planToday } from '@/lib/today'
import { buildTasks, buildDogs } from '@/lib/build'
import type { CompletionRow, Task } from '@/lib/types'
import { buyAgain, groupOpen, guessCategory, normalize, parseEntry, shoppingCounts, type ShoppingItem } from '@/lib/shopping'
import { dueForPerson, dueLabel, everyLabel, nextDue, statusOf, upcoming, type MaintenanceItem } from '@/lib/maintenance'
import { morningMessage, weeklyMessage } from '@/lib/digest'
import { EMPTY_SCORES } from '@/lib/gamification'

const names = { g: 'Giovanna', s: 'Sabrina' }
const T = '2026-10-07' // quarta-feira
const task = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'general', weight: 'medium', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o })
const unit = (id: string, o: Partial<SplitUnit> = {}): SplitUnit => ({ id, frequency: 'daily', time: '', title: id, weight: 2, hist: [], ...o })

describe('divisão inteligente', () => {
  it('quem fez por último passa a vez', () => {
    const d = assignGroup([unit('louca', { hist: [{ d: '2026-10-06', by: 'g' }] })], { g: 0, s: 0 }, T, () => 'g')
    expect(d.get('louca')).toEqual({ who: 's', why: { kind: 'last', by: 'g', date: '2026-10-06' } })
  })

  it('se uma cobriu a outra, a vez se ajusta sozinha', () => {
    // Era da Sabrina ontem, mas a Giovanna fez: hoje é da Sabrina de novo
    const d = assignGroup([unit('lixo', { hist: [{ d: '2026-10-06', by: 'g' }, { d: '2026-10-05', by: 'g' }] })], { g: 0, s: 0 }, T, () => 'g')
    expect(d.get('lixo')!.who).toBe('s')
  })

  it('equilíbrio passa na frente quando a diferença de carga é grande', () => {
    const d = assignGroup([unit('x', { hist: [{ d: '2026-10-06', by: 'g' }] })], { g: 0, s: MAX_GAP + 2 }, T, () => 'g')
    expect(d.get('x')!.who).toBe('g')
    expect(d.get('x')!.why.kind).toBe('balance')
  })

  it('sem histórico: vai para quem tem menos carga; empatado, vale o rodízio', () => {
    const a = assignGroup([unit('a')], { g: 5, s: 0 }, T, () => 'g')
    expect(a.get('a')!.who).toBe('s')
    const b = assignGroup([unit('b')], { g: 0, s: 0 }, T, () => 'g')
    expect(b.get('b')).toEqual({ who: 'g', why: { kind: 'rotation' } })
  })

  it('distribui vários itens sem histórico de forma equilibrada', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => unit(id))
    let n = 0
    const d = assignGroup(list, { g: 0, s: 0 }, T, () => (n++ % 2 ? 's' : 'g'))
    const g = Array.from(d.values()).filter(x => x.who === 'g').length
    expect(Math.abs(g - (6 - g))).toBeLessThanOrEqual(1)
  })

  it('registro antigo sem autoria não define preferência', () => {
    expect(lastBefore([{ d: '2026-10-06', by: null }], T)).toEqual({ d: '2026-10-06', by: null })
    const d = assignGroup([unit('a', { hist: [{ d: '2026-10-06', by: null }] })], { g: 0, s: 0 }, T, () => 's')
    expect(d.get('a')!.why.kind).toBe('rotation')
  })

  it('carga da semana só conta de segunda até ontem', () => {
    const l = weekLoad([{ weight: 3, hist: [{ d: '2026-10-06', by: 'g' }, { d: '2026-10-05', by: 's' }, { d: '2026-10-04', by: 's' }, { d: T, by: 's' }] }], T)
    expect(l).toEqual({ g: 3, s: 3 })
  })

  it('semanal é decidida com o histórico de antes da semana (não troca no meio da semana)', () => {
    const u = unit('banheiro', { frequency: 'weekly', hist: [{ d: '2026-10-06', by: 's' }, { d: '2026-09-29', by: 'g' }] })
    const d = smartSplit([u], [], [], T, () => 'g')
    // Na semana passada foi a Giovanna → esta semana é da Sabrina (a conclusão de terça não muda isso)
    expect(d.get('banheiro')!.who).toBe('s')
  })

  it('é estável durante o dia: concluir hoje não muda a dona', () => {
    const rows: CompletionRow[] = [{ id: '1', task_id: 'louca', date: '2026-10-06', completed_by: 'g' }]
    const before = planToday(buildTasks([task('louca')], rows, T), [], T, { split: 'smart' })
    const after = planToday(buildTasks([task('louca')], [...rows, { id: '2', task_id: 'louca', date: T, completed_by: 'g' }], T), [], T, { split: 'smart' })
    expect(before.ownerOfTask(before.homeTasks[0])).toBe('s')
    expect(after.ownerOfTask(after.homeTasks[0])).toBe('s')
  })

  it('fixas continuam com a responsável e entram na carga', () => {
    const tasks = buildTasks([task('fixa', { assigned_to: 'g', weight: 'heavy' }), task('livre')], [], T)
    const p = planToday(tasks, [], T, { split: 'smart' })
    expect(p.ownerOfTask(tasks[0])).toBe('g')
    expect(p.ownerOfTask(tasks[1])).toBe('s') // a Giovanna já tem a pesada fixa
    expect(p.whyOf('fixa')!.why.kind).toBe('fixed')
  })

  it('rotinas iguais dos cães são decididas juntas, pelo último que fez', () => {
    const dogs = buildDogs([
      { id: 'd1', name: 'Penélope', dog_routines: [{ id: 'r1', title: 'Ração manhã', frequency: 'daily', scheduled_time: '07:00' }] },
      { id: 'd2', name: 'Zelda', dog_routines: [{ id: 'r2', title: 'Ração manhã', frequency: 'daily', scheduled_time: '07:00' }] },
    ], [{ id: 'c1', routine_id: 'r1', date: '2026-10-06', completed_by: 's' }, { id: 'c2', routine_id: 'r2', date: '2026-10-06', completed_by: 's' }], T)
    const p = planToday([], dogs, T, { split: 'smart' })
    expect(p.dogItems[0].owner).toBe('g')
    expect(p.ownerOfRoutine(dogs[0].routines[0])).toBe('g')
  })

  it('modo rodízio mantém o comportamento antigo', () => {
    const tasks = buildTasks([task('a'), task('b')], [{ id: '1', task_id: 'a', date: '2026-10-06', completed_by: 'g' }], T)
    const smart = planToday(tasks, [], T, { split: 'smart' })
    const rot = planToday(tasks, [], T, { split: 'rotation' })
    const old = planToday(tasks, [], T)
    expect(rot.ownerOfTask(tasks[0])).toBe(old.ownerOfTask(tasks[0]))
    expect(smart.ownerOfTask(tasks[0])).toBe('s')
  })

  it('explica de quem é a vez', () => {
    expect(whyLabel({ who: 's', why: { kind: 'last', by: 'g', date: '2026-10-06' } }, names, T)).toBe('Vez da Sabrina: Giovanna fez da última vez (ontem)')
    expect(whyLabel({ who: 'g', why: { kind: 'last', by: 's', date: '2026-10-02' } }, names, T)).toContain('há 5 dias')
    expect(whyLabel({ who: 'g', why: { kind: 'balance', load: { g: 0, s: 6 } } }, names, T)).toContain('equilibrando')
    expect(whyLabel({ who: 's', why: { kind: 'fixed' } }, names, T)).toBe('Sempre da Sabrina')
  })
})

const item = (id: string, o: Partial<ShoppingItem> = {}): ShoppingItem => ({ id, household_id: 'h', title: id, qty: null, category: 'outros', note: null, added_by: 'g', checked_at: null, checked_by: null, done_at: null, created_at: '2026-10-01T10:00:00Z', ...o })

describe('lista de compras', () => {
  it('sugere a categoria pelo nome (expressão mais longa ganha)', () => {
    expect(guessCategory('Leite')).toBe('frios')
    expect(guessCategory('Bananas')).toBe('hortifruti')
    expect(guessCategory('Papel higiênico')).toBe('higiene')
    expect(guessCategory('Pão de queijo')).toBe('congelados')
    expect(guessCategory('Ração da Zelda')).toBe('pets')
    expect(guessCategory('Água sanitária')).toBe('limpeza')
    expect(guessCategory('Pilha AA')).toBe('outros')
  })

  it('separa quantidade e nome', () => {
    expect(parseEntry('2 kg arroz')).toEqual({ title: 'Arroz', qty: '2 kg' })
    expect(parseEntry('arroz 2kg')).toEqual({ title: 'Arroz', qty: '2kg' })
    expect(parseEntry('3 leite')).toEqual({ title: 'Leite', qty: '3' })
    expect(parseEntry('12 un de ovos')).toEqual({ title: 'Ovos', qty: '12 un' })
    expect(parseEntry('  detergente  ')).toEqual({ title: 'Detergente', qty: null })
    expect(parseEntry('Leite condensado')).toEqual({ title: 'Leite condensado', qty: null })
  })

  it('agrupa na ordem do mercado, com riscados no fim de cada grupo', () => {
    const g = groupOpen([item('Detergente', { category: 'limpeza' }), item('Tomate', { category: 'hortifruti', checked_at: 'x' }), item('Alface', { category: 'hortifruti' }), item('Fim', { done_at: 'x' })])
    expect(g.map(x => x.cat)).toEqual(['hortifruti', 'limpeza'])
    expect(g[0].items.map(i => i.title)).toEqual(['Alface', 'Tomate'])
  })

  it('comprar de novo: mais frequentes primeiro, sem o que já está na lista', () => {
    const hist = [
      item('Leite', { done_at: '2026-10-01', checked_at: 'x' }), item('leite', { done_at: '2026-09-20', checked_at: 'x' }),
      item('Café', { done_at: '2026-10-02', checked_at: 'x' }), item('Pão', { done_at: '2026-10-02', checked_at: 'x' }),
      item('Nunca riscado', { done_at: '2026-10-02' }),
    ]
    const r = buyAgain(hist, [item('Pão')])
    expect(r.map(x => x.title)).toEqual(['Leite', 'Café'])
    expect(r[0].count).toBe(2)
  })

  it('conta o que falta comprar', () => {
    expect(shoppingCounts([item('a'), item('b', { checked_at: 'x' }), item('c', { done_at: 'x' })])).toEqual({ open: 2, checked: 1, toBuy: 1 })
    expect(normalize('  Pão  de Açúcar! ')).toBe('pao de acucar')
  })
})

const mi = (id: string, o: Partial<MaintenanceItem> = {}): MaintenanceItem => ({ id, household_id: 'h', title: id, category: 'casa', every_months: 3, every_days: null, last_done: null, next_due: T, assigned_to: null, notes: null, active: true, ...o })

describe('manutenção', () => {
  it('próxima data igual à do banco (meses do calendário)', () => {
    expect(nextDue('2027-01-31', 1, null)).toBe('2027-02-28')
    expect(nextDue('2028-01-31', 1, null)).toBe('2028-02-29')
    expect(nextDue('2026-11-15', 3, null)).toBe('2027-02-15')
    expect(nextDue('2026-10-05', null, 45)).toBe('2026-11-19')
    expect(nextDue('2026-10-07', -3, null)).toBe('2026-07-07')
    expect(nextDue('2026-01-15', -1, null)).toBe('2025-12-15')
  })

  it('situação e rótulo', () => {
    expect(statusOf(mi('a', { next_due: '2026-10-01' }), T).status).toBe('late')
    expect(dueLabel(mi('a', { next_due: '2026-10-01' }), T)).toBe('atrasada 6 dias')
    expect(dueLabel(mi('a', { next_due: T }), T)).toBe('vence hoje')
    expect(dueLabel(mi('a', { next_due: '2026-10-08' }), T)).toBe('vence amanhã')
    expect(statusOf(mi('a', { next_due: '2026-10-12' }), T).status).toBe('soon')
    expect(dueLabel(mi('a', { next_due: '2027-01-07' }), T)).toBe('em ~3 meses')
  })

  it('intervalo em palavras', () => {
    expect(everyLabel({ every_months: 12, every_days: null })).toBe('todo ano')
    expect(everyLabel({ every_months: 3, every_days: null })).toBe('a cada 3 meses')
    expect(everyLabel({ every_months: null, every_days: 21 })).toBe('a cada 3 semanas')
    expect(everyLabel({ every_months: null, every_days: 30 })).toBe('a cada 30 dias')
  })

  it('próximas e da pessoa', () => {
    const list = [mi('ok', { next_due: '2026-12-01' }), mi('hoje'), mi('dela', { assigned_to: 's', next_due: '2026-10-01' }), mi('off', { active: false })]
    expect(upcoming(list, T).map(i => i.id)).toEqual(['dela', 'hoje'])
    expect(dueForPerson(list, 'g', T).map(i => i.id)).toEqual(['hoje'])
    expect(dueForPerson(list, 's', T).map(i => i.id)).toEqual(['dela', 'hoje'])
  })
})

describe('mensagens com manutenção', () => {
  it('bom dia inclui a manutenção do dia', () => {
    const m = morningMessage('g', names, [], '07:00', [{ title: 'Filtro do ar', late: true }])
    expect(m.body).toBe('Nenhuma tarefa pendente para você hoje. 🔧 Manutenção: Filtro do ar (atrasada).')
    expect(morningMessage('g', names, [], '07:00').body).toContain('Nada pendente')
  })
  it('resumo de domingo avisa a manutenção da próxima semana', () => {
    const w = weeklyMessage(names, EMPTY_SCORES, null, 0, [], ['Vermífugo', 'Antipulgas', 'Revisão do carro'])
    expect(w.body).toContain('🔧 Na próxima semana: Vermífugo, Antipulgas e mais 1.')
  })
})
