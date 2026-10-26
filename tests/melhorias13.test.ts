import { describe, expect, it } from 'vitest'
import type { Task } from '@/lib/types'
import type { Recipe } from '@/lib/receitas'
import type { PantryItem } from '@/lib/despensa'
import type { ShoppingItem } from '@/lib/shopping'
import type { HouseMeal } from '@/lib/jantar'
import { dueToday, pausedOn } from '@/lib/frequency'
import { planToday } from '@/lib/today'
import { estimate, lastBuys, priceLabel, storeCounts, storeOf, toPrice } from '@/lib/shopping'
import { dinnersFromPantry, firstFreeDay, sameFood } from '@/lib/jantar'
import { PACKS, packHas, packTasks, packWindow } from '@/lib/estacoes'
import { albumTimeline, onThisDay, type AlbumPhoto } from '@/lib/album'
import { morningMessage } from '@/lib/digest'

// Dados fictícios. 2026-10-26 é segunda-feira.
const MON = '2026-10-26'
const task = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'general', weight: 'medium', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o })
const shop = (title: string, o: Partial<ShoppingItem> = {}): ShoppingItem => ({ id: title, household_id: 'h', title, qty: null, category: 'outros', note: null, added_by: null, checked_at: null, checked_by: null, done_at: null, created_at: '2026-10-01T10:00:00Z', ...o })
const item = (name: string) => ({ name, food_id: null, qty: 100, unit: 'g' as const, g: 100, kcal: 100, p: 1, c: 1, f: 1, text: name })
const recipe = (id: string, name: string, items: string[]): Recipe => ({ id, who: 'g', name, servings: 2, items: items.map(item), steps: null, kcal: 400 })
const pantry = (name: string, expires_on: string | null): PantryItem => ({ id: name, name, place: 'geladeira', qty: null, expires_on })

describe('pausar tarefa', () => {
  it('pausada até o dia marcado (inclusive); volta no seguinte', () => {
    const t = task('a', { paused_until: '2026-10-30' })
    expect(pausedOn(t, '2026-10-30')).toBe(true)
    expect(pausedOn(t, '2026-10-31')).toBe(false)
    expect(dueToday(t, MON)).toBe(false)
    expect(dueToday(t, '2026-10-31')).toBe(true)
    expect(pausedOn(task('b'), MON)).toBe(false)
  })
  it('pausada sai de Hoje e não pesa na divisão', () => {
    const withFixed = (paused: string | null) => planToday([task('louca'), task('fixa', { weight: 'heavy', assigned_to: 'g', paused_until: paused })], [], MON, { split: 'smart' })
    expect(withFixed('2026-11-01').dueList.map(t => t.id)).toEqual(['louca'])
    expect(withFixed(null).ownerOfTask(task('louca'))).toBe('s')
    expect(planToday([task('louca'), task('fixa', { weight: 'heavy', assigned_to: 's', paused_until: '2026-11-01' })], [], MON, { split: 'smart' }).ownerOfTask(task('louca')))
      .toBe(withFixed('2026-11-01').ownerOfTask(task('louca')))
  })
})

describe('compras por lugar', () => {
  it('lugar escolhido ou pelo corredor', () => {
    expect(storeOf({ store: null, category: 'pets' })).toBe('petshop')
    expect(storeOf({ store: null, category: 'farmacia' })).toBe('farmacia')
    expect(storeOf({ store: null, category: 'hortifruti' })).toBe('mercado')
    expect(storeOf({ store: 'feira', category: 'hortifruti' })).toBe('feira')
    expect(storeOf({ store: 'xyz', category: 'mercearia' })).toBe('mercado')
  })
  it('contagem por lugar só do que falta', () => {
    const l = [shop('Arroz'), shop('Ração', { category: 'pets' }), shop('Banana', { store: 'feira' }), shop('Leite', { checked_at: 'x' })]
    expect(storeCounts(l)).toEqual([{ store: 'mercado', label: '🛒 Mercado', n: 1 }, { store: 'feira', label: '🥬 Feira', n: 1 }, { store: 'petshop', label: '🐾 Pet shop', n: 1 }])
  })
  it('preço: lê "12,90", "R$ 1.234,50"; mostra com vírgula', () => {
    expect(toPrice('12,90')).toBe(12.9)
    expect(toPrice('R$ 1.234,50')).toBe(1234.5)
    expect(toPrice('12.5')).toBe(12.5)
    expect(toPrice('abc')).toBeNull()
    expect(toPrice('-3')).toBeNull()
    expect(priceLabel(1234.5)).toBe('R$ 1.234,50')
  })
  it('última compra e quanto deve dar', () => {
    const hist = [
      shop('Arroz', { done_at: '2026-10-20T10:00:00Z', price: '24.90', store: 'atacado' }),
      shop('arroz', { done_at: '2026-10-10T10:00:00Z', price: 30 }),
      shop('Café', { done_at: '2026-10-22T10:00:00Z', price: null }),
      shop('Café', { done_at: '2026-10-05T10:00:00Z', price: 18 }),
    ]
    const last = lastBuys(hist)
    expect(last.get('arroz')).toEqual({ price: 24.9, date: '2026-10-20T10:00:00Z', store: 'atacado' })
    expect(last.get('cafe')?.price).toBe(18)
    expect(estimate([shop('Arroz'), shop('Café'), shop('Pão'), shop('Leite', { price: 6 }), shop('Ovo', { checked_at: 'x' })], last)).toEqual({ total: 48.9, known: 3, of: 4 })
  })
})

describe('da despensa para o jantar', () => {
  it('mesmo alimento por palavra importante (plural e acento)', () => {
    expect(sameFood('Peito de frango', 'Frango desfiado')).toBe(true)
    expect(sameFood('Ovos', 'ovo cozido')).toBe(true)
    expect(sameFood('Limões', 'limão')).toBe(true)
    expect(sameFood('Leite', 'Arroz')).toBe(false)
    expect(sameFood('Iogurte natural', 'Queijo natural')).toBe(false)
  })
  it('receitas com o que vence logo, mais urgente primeiro; vencido fica de fora', () => {
    const recipes = [recipe('r1', 'Escondidinho', ['Frango desfiado', 'Requeijão', 'Batata']), recipe('r2', 'Omelete', ['Ovos', 'Queijo']), recipe('r3', 'Salada', ['Alface'])]
    const p = [pantry('Peito de frango', '2026-10-26'), pantry('Requeijão', '2026-10-28'), pantry('Queijo', '2026-11-01'), pantry('Alface', '2026-10-20'), pantry('Arroz', null)]
    const r = dinnersFromPantry(recipes, p, MON)
    expect(r.map(x => [x.recipe.name, x.uses.map(u => u.name), x.score])).toEqual([['Escondidinho', ['Peito de frango', 'Requeijão'], 5], ['Omelete', ['Queijo'], 1]])
    expect(dinnersFromPantry(recipes, [pantry('Arroz', null)], MON)).toEqual([])
  })
  it('primeiro dia livre para planejar', () => {
    const m = (date: string): HouseMeal => ({ id: date, date, meal: 'jantar', title: 'x', cook: null, recipe_id: null, ingredients: [], notes: null })
    expect(firstFreeDay([], MON)).toBe(MON)
    expect(firstFreeDay([m(MON), m('2026-10-27')], MON)).toBe('2026-10-28')
  })
})

describe('checklists de estação', () => {
  const verao = PACKS.find(p => p.key === 'verao')!, inverno = PACKS.find(p => p.key === 'inverno')!, ferias = PACKS.find(p => p.key === 'ferias')!
  it('janela: a de agora (de hoje até o fim) ou a próxima; verão atravessa o ano', () => {
    expect(packWindow(verao, MON)).toEqual({ from: '2026-12-01', to: '2027-03-20', now: false })
    expect(packWindow(verao, '2026-12-15')).toEqual({ from: '2026-12-15', to: '2027-03-20', now: true })
    expect(packWindow(verao, '2027-02-01')).toEqual({ from: '2027-02-01', to: '2027-03-20', now: true })
    expect(packWindow(inverno, MON)).toEqual({ from: '2027-06-01', to: '2027-08-31', now: false })
    expect(packWindow(inverno, '2026-07-10')).toEqual({ from: '2026-07-10', to: '2026-08-31', now: true })
    expect(packWindow(ferias, MON)).toEqual({ from: MON, to: '2026-10-29', now: true })
  })
  it('o que já tem e as tarefas criadas (repetidas com período; de uma vez como pontual)', () => {
    expect(Array.from(packHas(verao, ['limpar ventiladores', 'Outra']))).toEqual(['Limpar ventiladores'])
    const t = packTasks(verao.items.slice(0, 4), '2026-12-01', '2027-03-20')
    expect(t[0]).toMatchObject({ title: 'Limpar filtros do ar-condicionado', frequency: 'monthly', starts_on: '2026-12-01', ends_on: '2027-03-20', assigned_to: null })
    expect(t[3]).toMatchObject({ frequency: 'once', due_date: '2026-12-01' })
    expect('starts_on' in t[3]).toBe(false)
  })
})

describe('álbum do Ninho', () => {
  const ph = (id: string, date: string, tag: AlbumPhoto['tag'] = 'casa'): AlbumPhoto => ({ id, date, tag, caption: null, thumb: 'x', added_by: 'g' })
  it('linha do tempo por mês com os marcos; filtro de tag', () => {
    const photos = [ph('a', '2026-10-20', 'caes'), ph('b', '2026-09-03'), ph('c', '2026-10-02')]
    const marks = [{ date: '2026-10-05', icon: '🏆', text: 'Desafio conquistado' }]
    const t = albumTimeline(photos, marks)
    expect(t.map(m => [m.label, m.entries.map(e => e.kind === 'foto' ? e.photo.id : 'marco')])).toEqual([['outubro de 2026', ['a', 'marco', 'c']], ['setembro de 2026', ['b']]])
    expect(albumTimeline(photos, marks, 'caes').map(m => m.entries.length)).toEqual([1])
    expect(albumTimeline(photos, marks, 'nos').flatMap(m => m.entries.map(e => e.kind))).toEqual(['marco'])
  })
  it('neste dia em anos anteriores', () => {
    expect(onThisDay([ph('a', '2025-10-26'), ph('b', MON), ph('c', '2025-10-25')], MON).map(p => p.id)).toEqual(['a'])
  })
})

describe('número no ícone do app', () => {
  it('bom dia leva quantas coisas faltam', () => {
    expect(morningMessage('g', { g: 'Gi', s: 'Sa' }, [], '07:00').count).toBe(0)
  })
})
