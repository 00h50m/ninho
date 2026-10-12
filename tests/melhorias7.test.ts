import { describe, expect, it } from 'vitest'
import { proteinIdeas, proteinTarget } from '@/lib/protein'
import { menuContext, menuFromDb, shoppingList, validateMenu, type Menu } from '@/lib/cardapio'
import { offToLabel, validBarcode } from '@/lib/openFoodFacts'
import { weekReport } from '@/lib/weekReport'
import { sobrouAlerts, type SobrouResumo } from '@/lib/sobrou'
import { exportCsv, toCsv } from '@/lib/exportCsv'
import { describeFood } from '@/lib/telegramAi'
import { isLabelCaption } from '@/lib/server/telegramAi'
import type { CustomFood } from '@/lib/nutricao'
import type { PLog } from '@/lib/meudia'

// Dados fictícios (nenhum dado real)
const food = (id: string, name: string, portion_g: number, kcal: number, protein: number | null, portion = '1 porção'): CustomFood =>
  ({ id, who: 'g', name, portion, portion_g, kcal, protein, carb: null, fat: null })
const FOODS = [
  food('w20', 'Whey teste - 20 g', 20, 80, 16), food('w30', 'Whey teste - 30 g', 30, 120, 24),
  food('fr', 'Frango teste grelhado', 100, 159, 32, '100 g'), food('ch', 'Chocolate teste', 25, 135, 1.8),
  food('io', 'Iogurte teste', 100, 60, 6, '1 pote'), food('bad', 'Erro de cadastro', 10, 10, 30),
]

describe('proteína', () => {
  it('meta pelo objetivo, pelo peso desejado ao emagrecer, ou a escolhida', () => {
    expect(proteinTarget({ goal: 'perder', target_kg: 60 }, 70)).toMatchObject({ g: 96, perKg: 1.6, baseKg: 60, manual: false })
    expect(proteinTarget({ goal: 'manter', target_kg: null }, 70).g).toBe(84)
    expect(proteinTarget({ goal: 'perder', target_kg: 60, protein_g_kg: 2 }, 70)).toMatchObject({ g: 120, manual: true })
  })
  it('ideias: mais proteína por caloria, uma por alimento, cabendo nas calorias', () => {
    const r = proteinIdeas(30, 300, FOODS)
    expect(r.map(i => i.food.id)).toEqual(['fr', 'w20', 'io'])
    expect(r[0]).toMatchObject({ portions: 1, protein: 32, kcal: 159 })
    expect(r[1]).toMatchObject({ portions: 2, protein: 32, kcal: 160 })
    expect(r.some(i => i.food.id === 'bad' || i.food.id === 'ch')).toBe(false)
    // sem espaço de calorias: porções menores
    expect(proteinIdeas(60, -100, FOODS).every(i => i.kcal <= 100)).toBe(true)
    expect(proteinIdeas(3, 500, FOODS)).toEqual([])
  })
})

describe('cardápio da semana', () => {
  const raw = { note: 'teste', days: [
    { meals: [
      { meal: 'cafe', name: 'Café', items: [{ name: 'Whey teste - 30 g', qty: '1 scoop', grams: 30, kcal: 999, protein: 1 }, { name: 'Ovo', qty: '2 unidades', grams: 100, kcal: 146, protein: 13 }] },
      { meal: 'xyz', name: 'Inválida', items: [{ name: 'a', qty: '1', grams: 10, kcal: 1, protein: 0 }] },
      { meal: 'almoco', name: 'Almoço', items: [{ name: 'Comida estranha', qty: '1 prato', grams: 300, kcal: 450, protein: 20 }, { name: 'Água', qty: '1 copo', grams: 250, kcal: 0, protein: 0 }] },
    ] },
    { meals: [{ meal: 'cafe', name: 'Café', items: [{ name: 'Ovo', qty: '3 unidades', grams: 150, kcal: 219, protein: 20 }] }] },
    { meals: [] },
  ] }
  it('confere: datas a partir de hoje, refeições conhecidas, Meus alimentos usa o cadastro', () => {
    const m = validateMenu(raw, '2026-11-02', FOODS)!
    expect(m.days.map(d => d.date)).toEqual(['2026-11-02', '2026-11-03'])
    expect(m.days[0].meals.map(x => x.meal)).toEqual(['cafe', 'almoco'])
    const whey = m.days[0].meals[0].items[0]
    expect(whey).toMatchObject({ name: 'Whey teste - 30 g', kcal: 120, text: '1 scoop' })
    expect(m.days[0].meals[1].items[0]).toMatchObject({ name: 'Comida estranha', kcal: 450, p: 20, guess: true })
    expect(validateMenu({ days: [] }, '2026-11-02')).toBeNull()
    expect(menuFromDb(JSON.parse(JSON.stringify(m)))).toEqual(m)
  })
  it('lista de compras somada: unidades somam, gramas viram kg, água fica de fora', () => {
    const m = validateMenu(raw, '2026-11-02', FOODS)! as Menu
    const s = shoppingList(m)
    expect(s.find(l => /ovo/i.test(l.title))?.qty).toBe('5 unidades')
    expect(s.find(l => /whey/i.test(l.title))).toMatchObject({ title: 'Whey teste', qty: '1 scoop' })
    expect(s.some(l => /agua/i.test(l.key))).toBe(false)
    expect(shoppingList(m, '2026-11-03').find(l => /ovo/i.test(l.title))?.qty).toBe('3 unidades')
  })
  it('contexto para a IA: metas, preferências marcadas e alimentos', () => {
    const t = menuContext({ plan: null, foods: FOODS, saved: [], kcal: 1600, protein: 96, prefs: 'sem peixe', start: '2026-11-02' })
    expect(t).toContain('1600 kcal e 96 g de proteína')
    expect(t).toContain('<prefs>sem peixe</prefs>')
    expect(t).toContain('Whey teste - 30 g: 1 porção (30 g) = 120 kcal, 24 g prot')
  })
})

describe('código de barras', () => {
  it('dígito verificador', () => {
    expect(validBarcode('7891000100103')).toBe(true)
    expect(validBarcode('7891000100104')).toBe(false)
    expect(validBarcode('96385074')).toBe(true)
    expect(validBarcode('12345')).toBe(false)
    expect(validBarcode('78910001001a3')).toBe(false)
  })
  it('Open Food Facts: porção do rótulo quando existe, senão 100 g; sem kcal não serve', () => {
    const j = { product: { product_name: 'Iogurte Teste', brands: 'Marca X, Outra', serving_size: '1 pote (170 g)', serving_quantity: 170,
      nutriments: { 'energy-kcal_100g': 50, 'energy-kcal_serving': 85, proteins_100g: 4, proteins_serving: 6.8, carbohydrates_100g: 6, fat_100g: 1 } } }
    expect(offToLabel(j)).toMatchObject({ name: 'Iogurte Teste Marca X', portion: '1 pote (170 g)', portion_g: 170, kcal: 85, protein: 6.8, carb: 10.2, fat: 1.7 })
    expect(offToLabel({ product: { product_name: 'Sem porção', nutriments: { 'energy-kcal_100g': 380, proteins_100g: 12 } } })).toMatchObject({ portion: '100 g', portion_g: 100, kcal: 380, protein: 12, carb: null })
    expect(offToLabel({ product: { product_name: 'kJ', nutriments: { energy_100g: 418.4 } } })!.kcal).toBe(100)
    expect(offToLabel({ product: { product_name: 'Sem calorias', nutriments: {} } })).toBeNull()
    expect(offToLabel({ status: 0 })).toBeNull()
  })
})

const log = (date: string, kind: string, value: number | null, data: any = {}): PLog => ({ id: Math.random().toString(36), who: 'g', date, kind: kind as any, value, data })
describe('resumo da semana do Meu dia', () => {
  const T = '2026-11-08'
  const logs = [
    log('2026-11-08', 'sono', 8), log('2026-11-07', 'sono', 7), log('2026-11-01', 'sono', 6),
    log('2026-11-08', 'agua', 2000), log('2026-11-07', 'agua', 2500), log('2026-11-01', 'agua', 2000),
    log('2026-11-08', 'refeicao', 1500, { items: [{ p: 90 }] }), log('2026-11-06', 'refeicao', 1700, { items: [{ p: 70 }] }),
    log('2026-11-05', 'treino', 45), log('2026-11-04', 'treino', 30),
    log('2026-11-08', 'corpo', 69.4), log('2026-10-30', 'corpo', 70),
    log('2026-11-08', 'sono', 9, {}), { ...log('2026-11-08', 'sono', 10), who: 's' as const },
  ]
  it('sono, água, comida, treino, peso, humor e o que melhorou', () => {
    const r = weekReport({ logs, who: 'g', today: T, moods: [{ date: '2026-11-08', mood: 'bem' }, { date: '2026-11-07', mood: 'bem' }, { date: '2026-11-06', mood: 'cansada' }],
      waterGoal: 2000, sleepGoal: 8, kcalTarget: 1600, proteinTarget: 96, hideNumbers: false })
    expect(r[0]).toBe('😴 Sono: média de 8 h em 3 noite(s) · 2 na meta')
    expect(r).toContain('💧 Água: meta batida em 2 de 7 dias')
    expect(r).toContain('🍽️ Comida: 2 dia(s) registrados · média de 1.600 kcal (meta 1.600) · 80 g de proteína (meta 96)')
    expect(r).toContain('🏋️ Treinos: 2 (75 min)')
    expect(r).toContain('⚖️ Peso: 69,4 kg (-0,6 kg na semana)')
    expect(r).toContain('🙂 Humor que mais apareceu: bem')
    expect(r[r.length - 1]).toMatch(/^✨ Melhorou: dormiu 2 h a mais por noite e bateu a meta de água em 1 dia\(s\) a mais/)
  })
  it('sem números quando a pessoa esconde; vazio quando nada foi registrado', () => {
    const r = weekReport({ logs, who: 'g', today: T, moods: [], waterGoal: 2000, sleepGoal: 8, kcalTarget: 1600, proteinTarget: 96, hideNumbers: true })
    expect(r).toContain('🍽️ Refeições registradas em 2 de 7 dias')
    expect(r.some(l => l.includes('kcal') || l.startsWith('⚖️'))).toBe(false)
    expect(weekReport({ logs: [], who: 'g', today: T, moods: [], waterGoal: 2000, sleepGoal: 8, kcalTarget: null, proteinTarget: null, hideNumbers: false })).toEqual([])
  })
})

describe('avisos do Sobrou', () => {
  const r: SobrouResumo = { mes: '2026-11', renda: 5000, comprometido: 5200, pago: 3000, aPagar: 2200, sobraProjetada: -200, pctComprometido: 104, avisos: [],
    vencimentos: [{ titulo: 'Luz', valor: 180.5, data: '2026-11-08', estimada: false }, { titulo: 'Internet', valor: 99.9, data: '2026-11-09', estimada: true }, { titulo: 'Escola', valor: 900, data: '2026-11-15', estimada: false }] }
  it('vence hoje/amanhã e o mês no vermelho', () => {
    const a = sobrouAlerts(r, '2026-11-08', '2026-11-09').map(s => s.replace(/ /g, ' '))
    expect(a).toEqual(['💰 Vence hoje: Luz R$ 180,50', '💰 Vence amanhã: Internet R$ 99,90 (estimada)', '⚠️ O mês está fechando no vermelho: faltam R$ 200,00 (Sobrou, novembro)'])
    expect(sobrouAlerts({ ...r, sobraProjetada: 10, vencimentos: [] }, '2026-11-08', '2026-11-09')).toEqual([])
  })
})

describe('exportar CSV', () => {
  it('ponto e vírgula, decimal com vírgula, BOM, aspas e sem fórmulas', () => {
    expect(toCsv(['a', 'b'], [[1.5, 'x;y'], ['=SOMA(1)', 'diz "oi"']])).toBe('﻿a;b\r\n1,5;"x;y"\r\n\'=SOMA(1);"diz ""oi"""\r\n')
  })
  it('refeições, peso, água por dia e alimentos', () => {
    const logs = [log('2026-11-02', 'refeicao', 450, { meal: 'almoco', items: [{ name: 'Arroz', p: 5, c: 50, f: 1 }, { name: 'Frango', p: 30, c: 0, f: 4 }] }),
      log('2026-11-02', 'agua', 500), log('2026-11-02', 'agua', 750), log('2026-11-01', 'corpo', 70.2, { waist: 80 })]
    expect(exportCsv('refeicoes', { logs, foods: [], saved: [] })).toContain('2026-11-02;Almoço;Arroz, Frango;450;35;50;5')
    expect(exportCsv('agua', { logs, foods: [], saved: [] })).toContain('2026-11-02;1250')
    expect(exportCsv('peso', { logs, foods: [], saved: [] })).toContain('data;peso (kg);waist\r\n2026-11-01;70,2;80')
    expect(exportCsv('alimentos', { logs, foods: [FOODS[2]], saved: [] })).toContain('Frango teste grelhado;100 g;100;159;32;;;')
  })
})

describe('rótulo pelo Telegram', () => {
  it('legenda decide: rótulo × prato', () => {
    expect(isLabelCaption('rótulo iogurte grego')).toBe(true)
    expect(isLabelCaption('Tabela nutricional do pão')).toBe(true)
    expect(isLabelCaption('cadastrar whey')).toBe(true)
    expect(isLabelCaption('jantar')).toBe(false)
    expect(isLabelCaption('')).toBe(false)
  })
  it('descrição para confirmar', () => {
    expect(describeFood({ type: 'alimento', food_id: 'x', name: 'Iogurte teste', portion: '1 pote', portion_g: 100, kcal: 58, protein: 6.2, carb: null, fat: 0.5 }))
      .toBe('🥗 Conferir em Meus alimentos: Iogurte teste · 1 pote (100 g) · 58 kcal · 6,2 g de proteína · 0,5 g de gordura')
  })
})

import { lastCup, shouldNudge, waterBehind, waterExpected, waterLine } from '@/lib/water'
import { signWater, verifyWater } from '@/lib/server/waterToken'
describe('água: ritmo, pop-up e "+1 copo" na notificação', () => {
  it('ritmo do dia (8h → 21h) e texto', () => {
    expect(waterExpected(2000, '07:00')).toBe(0)
    expect(waterExpected(2000, '14:30')).toBe(1000)
    expect(waterExpected(2000, '22:00')).toBe(2000)
    expect(waterBehind(800, 2000, 250, '14:30')).toBe(true)
    expect(waterBehind(900, 2000, 250, '14:30')).toBe(false)
    expect(waterLine(1250, 2000, 250)).toBe('1,25 L de 2 L · faltam 3 copos')
    expect(waterLine(2100, 2000, 250)).toBe('2,1 L · meta batida 🎉')
  })
  it('último copo', () => {
    const now = Date.parse('2026-11-02T15:00:00Z')
    expect(lastCup(null, now)).toBe('ainda nenhum hoje')
    expect(lastCup(now - 30000, now)).toBe('agora!')
    expect(lastCup(now - 25 * 60000, now)).toBe('há 25 min')
    expect(lastCup(now - 150 * 60000, now)).toBe('há 2 h e meia')
  })
  it('pop-up: atrás do ritmo, sem copo há 90 min, no máximo a cada 2 h, nunca depois de "hoje não"', () => {
    const now = Date.parse('2026-11-02T18:00:00Z'), o = { ml: 500, goal: 2000, cup: 250, hm: '15:00', nowMs: now, lastCupMs: null, lastShownMs: null, mutedDay: null, today: '2026-11-02' }
    expect(shouldNudge(o)).toBe(true)
    expect(shouldNudge({ ...o, hm: '08:30' })).toBe(false)
    expect(shouldNudge({ ...o, ml: 1100 })).toBe(false)
    expect(shouldNudge({ ...o, lastCupMs: now - 30 * 60000 })).toBe(false)
    expect(shouldNudge({ ...o, lastShownMs: now - 3600000 })).toBe(false)
    expect(shouldNudge({ ...o, lastShownMs: now - 3 * 3600000 })).toBe(true)
    expect(shouldNudge({ ...o, mutedDay: '2026-11-02' })).toBe(false)
  })
  it('bilhete assinado: vale para a pessoa e o dia; alterado, de outra chave ou vencido não vale', () => {
    const t = { h: '11111111-1111-1111-1111-111111111111', w: 'g' as const, d: '2026-11-02', ml: 250, r: 'agua:15:30:x', exp: 2_000_000_000_000 }
    const tok = signWater(t, 'segredo-1')
    expect(verifyWater(tok, 'segredo-1', 1_900_000_000_000)).toEqual(t)
    expect(verifyWater(tok, 'segredo-2', 1_900_000_000_000)).toBeNull()
    expect(verifyWater(tok, 'segredo-1', 2_100_000_000_000)).toBeNull()
    const [body, sig] = tok.split('.')
    const forged = Buffer.from(JSON.stringify({ ...t, ml: 1000, w: 's' })).toString('base64url') + '.' + sig
    expect(verifyWater(forged, 'segredo-1', 1_900_000_000_000)).toBeNull()
    expect(verifyWater(body, 'segredo-1')).toBeNull()
    expect(verifyWater(signWater({ ...t, ml: 5000 }, 'segredo-1'), 'segredo-1', 1_900_000_000_000)).toBeNull()
    expect(verifyWater(tok, '', 1_900_000_000_000)).toBeNull()
  })
})
