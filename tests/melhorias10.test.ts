import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { parseMeal, type MealItem } from '@/lib/nutricao'
import { perPortion, portionItems, recipeFromDb, recipeShopping, toRecipe } from '@/lib/receitas'
import { ICS_TOKEN, agendaItems, foldLine, icsCalendar, icsText } from '@/lib/ics'
import { foodAlerts, foodLeftKg, foodLeftLabel, newBag } from '@/lib/caes'
import { RKINDS, dueReminders, type RemState } from '@/lib/reminders'
import { marketView, type ShoppingItem } from '@/lib/shopping'
import { nearest, photoCompare, type PLog } from '@/lib/meudia'
import { coupleMonth, coupleMonthText, monthEnd, shiftMonth } from '@/lib/casalMes'

// Dados fictícios (nenhum dado real)
const it_ = (name: string, g: number, kcal: number, p = 0, unit: MealItem['unit'] = 'g'): MealItem => ({ name, food_id: null, qty: g, unit, g, kcal, p, c: 0, f: 0, text: name })

describe('receitas', () => {
  const items = [it_('Peito de frango', 600, 960, 186), it_('Batata', 800, 416, 12), it_('Sal', 5, 0), it_('Leite', 200, 120, 6, 'ml')]
  it('salva só com nome, ingrediente e rendimento entre ½ e 50', () => {
    const r = toRecipe('  Escondidinho  ', 4, items, '  Cozinhar e montar.  ')!
    expect(r).toMatchObject({ name: 'Escondidinho', servings: 4, kcal: 1496, steps: 'Cozinhar e montar.' })
    expect(toRecipe('', 4, items, '')).toBeNull()
    expect(toRecipe('X', 0, items, '')).toBeNull()
    expect(toRecipe('X', 51, items, '')).toBeNull()
    expect(toRecipe('X', 2, [], '')).toBeNull()
    expect(toRecipe('X', 2.3, items, '')!.servings).toBe(2.5)
  })
  it('porção: calorias e macros divididos pelo rendimento', () => {
    const r = { items, servings: 4 }
    expect(perPortion(r)).toEqual({ kcal: 374, p: 51, c: 0, f: 0 })
    const one = portionItems(r, 1)
    expect(one.map(i => i.g)).toEqual([150, 200, 1, 50])
    expect(one.reduce((a, i) => a + i.kcal, 0)).toBe(374)
    expect(portionItems(r, 2)[0]).toMatchObject({ g: 300, kcal: 480, p: 93 })
  })
  it('ingredientes para as compras: soma repetidos, tira sal e água, kg e litro', () => {
    const lines = recipeShopping({ items: [...items, it_('Peito de frango', 600, 960), it_('Água', 500, 0, 0, 'ml')] })
    expect(lines).toEqual([{ title: 'Peito de frango', qty: '1,2 kg' }, { title: 'Batata', qty: '800 g' }, { title: 'Leite', qty: '200 ml' }])
    expect(recipeShopping({ items }, 2)[1]).toEqual({ title: 'Batata', qty: '1,6 kg' })
  })
  it('do banco: confere e descarta receita quebrada', () => {
    expect(recipeFromDb({ id: 'r1', who: 'g', name: 'Bolo', servings: '8.0', items, steps: '', kcal: '1496' })).toMatchObject({ servings: 8, kcal: 1496, steps: null })
    expect(recipeFromDb({ id: 'r2', who: 'g', name: 'Vazia', servings: 1, items: [] })).toBeNull()
  })
  it('ingredientes escritos em linhas viram itens da tabela', () => {
    const its = parseMeal('500 g de peito de frango\n2 xícaras de arroz'.replace(/\n+/g, ', '))
    expect(its).toHaveLength(2)
    expect(its[0].g).toBe(500)
  })
})

describe('agenda no celular (.ics)', () => {
  it('texto escapado e linhas dobradas em 75 bytes sem quebrar acento', () => {
    expect(icsText('Vacina; Zelda, Penélope\\ok\nfim')).toBe('Vacina\\; Zelda\\, Penélope\\\\ok\\nfim')
    const long = 'SUMMARY:' + 'ção'.repeat(40)
    const folded = foldLine(long)
    const enc = new TextEncoder()
    expect(folded.split('\r\n ').every((l, i) => enc.encode(l).length <= (i ? 74 : 75))).toBe(true)
    expect(folded.replace(/\r\n /g, '')).toBe(long)
  })
  const today = '2026-11-03'
  const ev = (id: string, kind: any, date: string, time: string | null, extra: any = {}) => ({ id, kind, title: `Evento ${id}`, date, time, who: null, notes: 'segredo', link: 'https://x', paid: null, done_at: null, ...extra })
  it('eventos (sem vencimentos pagos), manutenções e próximos cuidados dos cães, sem observações', () => {
    const items = agendaItems({
      today,
      events: [ev('a', 'visita', '2026-11-05', '14:30'), ev('b', 'vencimento', '2026-11-10', null, { paid: true }), ev('c', 'vencimento', '2026-11-12', null, { paid: false }), ev('d', 'compromisso', '2025-01-01', null)],
      maint: [{ id: 'm1', title: 'Filtro', next_due: '2026-11-20' }],
      health: [
        { id: 'h1', dog_id: 'z', kind: 'vacina', title: 'V10', date: '2025-11-20', next_date: '2026-11-20', every_days: 365, dose: null, vet: null, weight_kg: null, notes: null, link: null, done_by: null },
        { id: 'h0', dog_id: 'z', kind: 'vacina', title: 'V10', date: '2024-11-20', next_date: '2025-11-20', every_days: 365, dose: null, vet: null, weight_kg: null, notes: null, link: null, done_by: null },
      ] as any,
      dogs: [{ id: 'z', name: 'Zelda' }],
    })
    expect(items.map(i => i.uid)).toEqual(['ev-a', 'ev-c', 'mt-m1-2026-11-20', 'dg-h1'])
    expect(items[0]).toMatchObject({ time: '14:30', title: '🏠 Evento a', desc: 'Visita · Ninho' })
    expect(items[3].title).toBe('🐾 Zelda: V10')
    const cal = icsCalendar('Ninho · Agenda', items, '20261103T120000Z')
    expect(cal).toContain('DTSTART;TZID=America/Sao_Paulo:20261105T143000\r\nDTEND;TZID=America/Sao_Paulo:20261105T153000')
    expect(cal).toContain('DTSTART;VALUE=DATE:20261112\r\nDTEND;VALUE=DATE:20261113')
    expect(cal).toContain('X-WR-CALNAME:Ninho · Agenda')
    expect(cal).not.toContain('segredo')
    expect(cal).not.toContain('https://x')
    expect(cal.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(cal.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(cal.match(/BEGIN:VEVENT/g)).toHaveLength(4)
  })
  it('evento às 23h termina às 23h59; segredo do link com 48 letras', () => {
    const cal = icsCalendar('x', [{ uid: 'e', date: '2026-11-05', time: '23:15', title: 't', desc: 'd' }], '20261103T120000Z')
    expect(cal).toContain('DTEND;TZID=America/Sao_Paulo:20261105T235900')
    expect(ICS_TOKEN.test('a'.repeat(48))).toBe(true)
    expect(ICS_TOKEN.test('../../etc')).toBe(false)
    expect(ICS_TOKEN.test('A'.repeat(48))).toBe(false)
  })
  it('a rota do link exige alguém da casa e gera o segredo no servidor', () => {
    const src = readFileSync('app/api/agenda/link/route.ts', 'utf8')
    expect(src).toContain('memberOf(db, req, householdId)')
    expect(src).toContain('randomBytes(24)')
    const feed = readFileSync('app/api/agenda/ics/[file]/route.ts', 'utf8')
    expect(feed).toContain('ICS_TOKEN.test(token)')
  })
})

describe('ração acabando', () => {
  const dog = { id: 'z', name: 'Zelda', food_g_day: 250, food_stock_kg: 15, food_stock_on: '2026-10-01' }
  it('quanto sobrou e o saco novo soma ao que sobrou', () => {
    expect(foodLeftKg(dog, '2026-11-25')).toBe(1.3)   // 15 kg − 55 dias × 250 g
    expect(newBag(dog, 15, '2026-11-25')).toEqual({ food_stock_kg: 16.3, food_stock_on: '2026-11-25' })
    expect(newBag({ ...dog, food_stock_on: null }, 10, '2026-11-25')).toEqual({ food_stock_kg: 10, food_stock_on: '2026-11-25' })
  })
  it('alertas até 7 dias, quem acaba antes primeiro', () => {
    const pen = { id: 'p', name: 'Penélope', food_g_day: 100, food_stock_kg: 0.9, food_stock_on: '2026-11-20' }
    expect(foodAlerts([dog, pen, { id: 'x', name: 'Sem estoque' }], '2026-11-25').map(a => `${a.dog.name}:${a.left}`)).toEqual(['Penélope:4', 'Zelda:5'])
    expect(foodLeftLabel(0)).toBe('acabou')
    expect(foodLeftLabel(1)).toBe('acaba amanhã')
    expect(foodLeftLabel(4)).toBe('dá para ~4 dias')
  })
  const base = (o: Partial<RemState>): RemState => ({ date: '2026-11-25', hm: '09:02', nowMs: 0, names: { g: 'G', s: 'S' }, meds: [], medTaken: [], water: [], routines: [], routineDone: [], sprint: null, dogHealth: [], events: [], challenges: [], checkins: [], ...o } as RemState)
  it('lembrete às 9h com 5, 3, 1 e 0 dias (não todo dia), para as duas', () => {
    const list = (left: number) => dueReminders(base({ dogFood: [{ id: 'z', dog: 'Zelda', left }] })).filter(r => r.ref.startsWith('racao:'))
    expect(list(3).map(r => `${r.who}:${r.kind}:${r.ref}`)).toEqual(['g:caes:racao:z:2026-11-25', 's:caes:racao:z:2026-11-25'])
    expect(list(3)[0].title).toBe('🍖 Ração da Zelda acaba em ~3 dias')
    expect(list(1)[0].title).toBe('🍖 Ração da Zelda acaba amanhã')
    expect(list(4)).toEqual([])
    expect(list(6)).toEqual([])
    expect(dueReminders(base({ hm: '15:00', dogFood: [{ id: 'z', dog: 'Zelda', left: 3 }] })).filter(r => r.ref.startsWith('racao:'))).toEqual([])
    expect(RKINDS.find(k => k[0] === 'caes')?.[3]).toMatch(/ração acabando/)
  })
})

describe('modo mercado', () => {
  const item = (id: string, title: string, category: string, checked_at: string | null = null): ShoppingItem =>
    ({ id, household_id: 'h', title, qty: null, category, note: null, added_by: 'g', checked_at, checked_by: checked_at ? 's' : null, done_at: null, created_at: '2026-11-01' })
  it('só o que falta, na ordem dos corredores; o carrinho no fim e o progresso', () => {
    const v = marketView([item('1', 'Sabão', 'limpeza'), item('2', 'Banana', 'hortifruti'), item('3', 'Pão', 'padaria', '2026-11-03T10:00:00Z'), item('4', 'Alface', 'hortifruti', '2026-11-03T10:05:00Z'),
      { ...item('5', 'Leite', 'frios'), done_at: '2026-11-02' }])
    expect(v.groups.map(g => `${g.cat}:${g.items.map(i => i.title).join('+')}`)).toEqual(['hortifruti:Banana', 'limpeza:Sabão'])
    expect(v.cart.map(i => i.title)).toEqual(['Alface', 'Pão'])
    expect([v.done, v.total]).toEqual([2, 4])
  })
})

const log = (date: string, value: number | null, data: any = {}, who: 'g' | 's' = 'g'): PLog => ({ id: Math.random().toString(36), who, date, kind: 'corpo', value, data })
describe('fotos lado a lado', () => {
  const L = [log('2026-09-01', 72, { waist: 84 }), log('2026-09-20', 71), log('2026-10-28', 69.5, { waist: 80, hip: 100 }), log('2026-10-01', 70, {}, 's')]
  it('valor mais perto da data (até 14 dias)', () => {
    const s = [{ date: '2026-09-01', v: 1 }, { date: '2026-09-20', v: 2 }]
    expect(nearest(s, '2026-09-05')).toEqual({ date: '2026-09-01', v: 1 })
    expect(nearest(s, '2026-09-18')).toEqual({ date: '2026-09-20', v: 2 })
    expect(nearest(s, '2026-10-20')).toBeNull()
  })
  it('peso e medidas de cada foto e a diferença; só o que existe nas duas pontas e só da pessoa', () => {
    const c = photoCompare(L, 'g', '2026-09-03', '2026-11-01')
    expect(c.days).toBe(59)
    expect(c.rows).toEqual([
      { key: 'weight', label: 'Peso', unit: 'kg', a: 72, b: 69.5, diff: -2.5 },
      { key: 'waist', label: 'Cintura', unit: 'cm', a: 84, b: 80, diff: -4 },
    ])
    expect(photoCompare(L, 's', '2026-09-03', '2026-11-01').rows).toEqual([])
  })
})

describe('resumo do mês do casal', () => {
  it('mês, fim do mês e navegação', () => {
    expect(monthEnd('2026-02')).toBe('2026-02-28')
    expect(monthEnd('2026-12')).toBe('2026-12-31')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
  const input = {
    month: '2026-10', today: '2026-10-20',
    tasks: [{ date: '2026-10-02', completed_by: 'g' as const }, { date: '2026-10-02', completed_by: 's' as const }, { date: '2026-10-05', completed_by: 'g' as const }, { date: '2026-09-30', completed_by: 'g' as const }],
    dogs: [{ date: '2026-10-02', completed_by: 's' as const }],
    runs: [{ date: '2026-10-05' }],
    sprints: [{ date: '2026-10-10', status: 'done', done: 4 }, { date: '2026-10-11', status: 'cancelled', done: 0 }],
    checkins: [{ date: '2026-10-02', who: 'g' as const, mood: 'bem' as const }, { date: '2026-10-02', who: 's' as const, mood: 'otimo' as const }, { date: '2026-10-03', who: 'g' as const, mood: 'bem' as const }],
    meetings: [{ week_start: '2026-10-05', agreements: [{ done: true }, { done: false }] }],
    challenges: [{ title: '7 dias de check-in', status: 'done', ended_at: '2026-10-09T20:00:00Z' }, { title: 'Antigo', status: 'done', ended_at: '2026-09-01T10:00:00Z' }],
  }
  it('a parte de cada uma, o total e os destaques do mês (até hoje)', () => {
    const r = coupleMonth(input)
    expect(r).toMatchObject({ from: '2026-10-01', to: '2026-10-20', days: 20, label: 'outubro de 2026', empty: false })
    expect(r.tasks).toEqual({ total: 3, g: 2, s: 1 })
    expect(r.dogs).toEqual({ total: 1, g: 0, s: 1 })
    expect(r.sprints).toEqual({ n: 1, done: 4 })
    expect(r.checkins).toMatchObject({ both: 1, g: 2, s: 1, mood: { g: { label: 'Bem' }, s: { label: 'Ótimo' } } })
    expect(r.meetings).toEqual({ n: 1, agreements: 2, kept: 1 })
    expect(r.challenges).toEqual(['7 dias de check-in'])
    expect(r.bestDay).toEqual({ date: '2026-10-02', n: 3 })
  })
  it('texto para compartilhar; mês vazio', () => {
    const t = coupleMonthText(coupleMonth(input), { g: 'Gio Teste', s: 'Sabi Teste' })
    expect(t.split('\n')[0]).toBe('🏡 Nosso outubro de 2026 no Ninho')
    expect(t).toContain('✅ 3 tarefas da casa (Gio 2 · Sabi 1)')
    expect(t).toContain('📋 1 reunião(ões) · 1 de 2 combinados cumpridos')
    expect(t).toContain('🌟 Dia mais produtivo: 02/10 (3 coisas feitas)')
    const empty = coupleMonth({ ...input, month: '2026-08' })
    expect(empty.empty).toBe(true)
    expect(coupleMonthText(empty, { g: 'A', s: 'B' })).toContain('Ainda sem registros')
  })
})
