import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { marmitaPlan } from '@/lib/marmita'
import { bedReminder, bedtime, usualWake } from '@/lib/sono'
import { monthReport } from '@/lib/monthReport'
import { applySwap, swapAsk, validateMenu, type Menu } from '@/lib/cardapio'
import { DEFAULT_RPREFS, RKINDS, dueReminders, forDevice, type RemState } from '@/lib/reminders'
import type { PLog } from '@/lib/meudia'

// Dados fictícios (nenhum dado real)
const it_ = (name: string, qty: string, grams: number, kcal: number, protein = 0) => ({ name, qty, grams, kcal, protein })
const RAW = { note: null, days: [
  { meals: [
    { meal: 'cafe', name: 'Café', items: [it_('Pão francês', '1 unidade', 50, 150, 4), it_('Ovo', '2 unidades', 100, 146, 13)] },
    { meal: 'almoco', name: 'Almoço', items: [it_('Frango grelhado', '120 g', 120, 190, 38), it_('Arroz branco cozido', '4 colheres', 100, 128, 2.5), it_('Brócolis', '1 xícara', 80, 20, 2), it_('Maçã', '1 unidade', 130, 73)] },
    { meal: 'jantar', name: 'Jantar', items: [it_('Patinho moído', '100 g', 100, 219, 35), it_('Feijão carioca', '1 concha', 100, 76, 5)] },
  ] },
  { meals: [{ meal: 'almoco', name: 'Almoço', items: [it_('Frango grelhado', '150 g', 150, 240, 48), it_('Arroz branco cozido', '5 colheres', 125, 160, 3)] }] },
  { meals: [{ meal: 'almoco', name: 'Almoço', items: [it_('Frango grelhado', '120 g', 120, 190, 38)] }] },
  { meals: [{ meal: 'almoco', name: 'Almoço', items: [it_('Tilápia assada', '120 g', 120, 154, 31)] }] },
] }
const MENU = validateMenu(RAW, '2026-11-02') as Menu

describe('modo marmita', () => {
  it('soma o que cozinhar (pronto e cru), monta os potes e deixa o resto "na hora"', () => {
    const p = marmitaPlan(MENU, '2026-11-02', 4, ['almoco', 'jantar'])
    expect(p.potes.map(x => x.label)).toEqual(['seg 02/11 · Almoço', 'seg 02/11 · Jantar', 'ter 03/11 · Almoço', 'qua 04/11 · Almoço', 'qui 05/11 · Almoço'])
    const c = Object.fromEntries(p.cook.map(x => [x.name, x]))
    expect(c['Peito de frango grelhado']).toMatchObject({ group: 'proteina', g: 390, portions: 3, rawG: 560 })
    expect(c['Arroz branco cozido']).toMatchObject({ group: 'carbo', g: 230, rawG: 80 })
    expect(c['Feijão carioca cozido']).toMatchObject({ group: 'carbo', g: 100, rawG: 40 })
    expect(c['Brócolis cozido']).toMatchObject({ group: 'legume', rawG: null })
    expect(p.cook[0].group).toBe('proteina')
    expect(p.fresh).toEqual(['Maçã'])
    // a partir do 4º dia (05/11) vai para o congelador
    expect(p.freezeFrom).toBe('2026-11-05')
    expect(p.steps.join(' ')).toMatch(/forno ou air fryer.*panelas.*vapor.*5 potes.*qui 05\/11 vão para o congelador/)
  })
  it('só o que foi escolhido; nada para preparar', () => {
    expect(marmitaPlan(MENU, '2026-11-03', 3, ['almoco']).potes).toHaveLength(3)
    expect(marmitaPlan(MENU, '2026-11-02', 3, ['jantar']).freezeFrom).toBeNull()
    const empty = marmitaPlan(MENU, '2026-11-02', 1, ['cafe'])
    expect(empty.potes).toEqual([])
    expect(empty.steps).toEqual([])
  })
})

describe('trocar uma refeição do cardápio', () => {
  it('pedido com a meta da refeição e o motivo marcado como dado', () => {
    const t = swapAsk(MENU.days[0].meals[1], '2026-11-02', 'sem frango')
    expect(t).toContain('"almoco"')
    expect(t).toContain('412 kcal')
    expect(t).toContain('Peito de frango grelhado (120 g)')
    expect(t).toContain('<motivo>sem frango</motivo>')
  })
  it('troca só aquela refeição; o resto fica igual', () => {
    const next = applySwap(MENU, '2026-11-02', 'almoco', { meal: { meal: 'jantar', name: 'Almoço novo', items: [it_('Carne moída', '120 g', 120, 260, 30), it_('Batata cozida', '150 g', 150, 78, 2)] } })!
    expect(next.days[0].meals[1]).toMatchObject({ meal: 'almoco', name: 'Almoço novo' })
    expect(next.days[0].meals[0]).toEqual(MENU.days[0].meals[0])
    expect(next.days[1]).toEqual(MENU.days[1])
    expect(applySwap(MENU, '2026-11-02', 'almoco', { meal: { meal: 'almoco', name: 'x', items: [] } })).toBeNull()
    expect(applySwap(MENU, '2026-12-25', 'almoco', { meal: { meal: 'almoco', name: 'x', items: [it_('Ovo', '1', 50, 70, 6)] } })).toBeNull()
  })
})

const log = (date: string, kind: string, value: number | null, data: any = {}, who: 'g' | 's' = 'g'): PLog => ({ id: Math.random().toString(36), who, date, kind: kind as any, value, data })
describe('hora de dormir', () => {
  const nights = ['06:30', '06:40', '06:20', '07:30'].map((w, i) => log(`2026-11-0${i + 1}`, 'sono', 8, { bed: '22:30', wake: w }))
  it('acordar: mediana das últimas noites (pelo menos 3)', () => {
    expect(usualWake(nights, 'g', '2026-11-05')).toBe('06:35')
    expect(usualWake(nights.slice(0, 2), 'g', '2026-11-05')).toBeNull()
    expect(usualWake(nights, 's', '2026-11-05')).toBeNull()
  })
  it('deitar e lembrete (passa da meia-noite certo)', () => {
    expect(bedtime('06:30', 8)).toBe('22:15')
    expect(bedReminder('06:30', 8)).toBe('21:45')
    expect(bedtime('07:00', 7.5)).toBe('23:15')
    expect(bedReminder('08:00', 8)).toBe('23:15')
    expect(bedtime('06:00', 6)).toBe('23:45')
  })
  const base = (o: Partial<RemState>): RemState => ({ date: '2026-11-05', hm: '21:46', nowMs: 0, names: { g: 'G', s: 'S' }, meds: [], medTaken: [], water: [], routines: [], routineDone: [], sprint: null, dogHealth: [], events: [], challenges: [], checkins: [], ...o } as RemState)
  it('lembrete no horário; vale mesmo no horário de silêncio (é pedido pela pessoa); desligado por padrão', () => {
    const list = dueReminders(base({ sleep: [{ who: 'g', wake: '06:30', goal: 8 }, { who: 's', wake: null, goal: 8 }] })).filter(r => r.kind === 'dormir')
    expect(list.map(r => `${r.who}:${r.kind}:${r.ref}`)).toEqual(['g:dormir:dormir:21:45'])
    expect(list[0].body).toBe('Para dormir 8 h e acordar às 06:30, deite até 22:15. Telas de lado 😴')
    const sub = { who: 'g' as const, quiet_start: '21:00', quiet_end: '07:00' }
    expect(forDevice(list, { ...sub, reminders: { dormir: true } }, '21:46')).toHaveLength(1)
    expect(forDevice(list, { ...sub, reminders: {} }, '21:46')).toHaveLength(0)
    // aparece em Ajustes › Notificações (a lista vem de RKINDS) e começa desligado
    expect(RKINDS.find(k => k[0] === 'dormir')?.slice(1, 3)).toEqual(['🌙', 'Hora de dormir'])
    expect(DEFAULT_RPREFS.dormir).toBe(false)
  })
})

describe('relatório do mês', () => {
  const L = [
    log('2026-10-01', 'corpo', 71, { waist: 82 }), log('2026-10-12', 'corpo', 69.8, { waist: 80 }), log('2026-09-30', 'corpo', 72),
    log('2026-10-02', 'refeicao', 1500, { items: [{ name: 'Ovo', p: 13 }, { name: 'Arroz', p: 3 }], plan: { meal_id: 'm1' } }),
    log('2026-10-03', 'refeicao', 1700, { items: [{ name: 'Ovo', p: 20 }] }),
    log('2026-10-02', 'agua', 2000), log('2026-10-03', 'agua', 1000),
    log('2026-10-02', 'sono', 7), log('2026-10-03', 'sono', 8.5), log('2026-10-03', 'treino', 45),
    log('2026-10-03', 'refeicao', 999, {}, 's'),
  ]
  it('peso e medidas, comida, plano, água, sono, treinos e humor (só do mês e da pessoa)', () => {
    const r = monthReport({ logs: L, who: 'g', month: '2026-10', today: '2026-10-13', moods: [{ date: '2026-10-02', mood: 'bem' }, { date: '2026-10-03', mood: 'bem' }],
      waterGoal: 2000, sleepGoal: 8, kcalTarget: 1600, proteinTarget: 100, planMealsPerDay: 4 })
    expect(r).toMatchObject({ from: '2026-10-01', to: '2026-10-13', days: 13 })
    expect(r.weight).toMatchObject({ first: 71, last: 69.8, change: -1.2 })
    expect(r.measures).toEqual([{ label: 'Cintura', unit: 'cm', first: 82, last: 80, change: -2 }])
    expect(r.food).toMatchObject({ daysLogged: 2, kcalAvg: 1600, proteinAvg: 18, daysOnTarget: 2 })
    expect(r.food.topFoods[0]).toEqual({ name: 'Ovo', n: 2 })
    expect(r.plan).toEqual({ marked: 1, expected: 52, pct: 2 })
    expect(r.water).toEqual({ avgMl: 1500, daysOnGoal: 1 })
    expect(r.sleep).toEqual({ avgH: 7.8, nights: 2, onGoal: 1 })
    expect(r.workouts).toEqual({ count: 1, minutes: 45 })
    expect(r.mood).toMatchObject({ label: 'Bem', n: 2 })
  })
  it('mês fechado vai até o último dia; sem plano não mostra plano', () => {
    const r = monthReport({ logs: L, who: 'g', month: '2026-09', today: '2026-10-13', moods: [], waterGoal: 2000, sleepGoal: 8, kcalTarget: null, proteinTarget: null, planMealsPerDay: 0 })
    expect(r).toMatchObject({ from: '2026-09-01', to: '2026-09-30', days: 30, plan: null })
    expect(r.weight).toMatchObject({ first: 72, last: 72, change: null })
  })
})

describe('atalhos no ícone do app', () => {
  it('manifest com os 6 atalhos (Hoje e Compras desde as melhorias 13), cada um com nome curto e endereço do próprio app', () => {
    const m = JSON.parse(readFileSync('public/manifest.json', 'utf8'))
    expect(m.shortcuts.map((s: any) => s.url)).toEqual(['/?ir=copo&source=atalho', '/?ir=hoje&source=atalho', '/?ir=compras&source=atalho', '/?ir=refeicao&source=atalho', '/?ir=cardapio&source=atalho', '/?ir=rotulo&source=atalho'])
    expect(m.shortcuts.every((s: any) => s.short_name.length <= 12 && s.icons?.length)).toBe(true)
  })
})
