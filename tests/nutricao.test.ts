import { describe, expect, it } from 'vitest'
import { calorieTarget, dayFood, dayWord, etaDate, mealForTime, parseMeal, weightTrend, workoutKcal, type FoodProfile } from '@/lib/nutricao'
import { FOODS } from '@/lib/foods'
import type { PLog } from '@/lib/meudia'

const prof = (p: Partial<FoodProfile> = {}): FoodProfile => ({ who: 'g', sex: 'f', birth_year: 1994, height_cm: 165, activity: 'leve', goal: 'perder', pace_kg_week: 0.5, target_kg: 60, kcal_override: null, hide_numbers: false, ...p })
const byText = (t: string) => parseMeal(t).map(i => `${i.food_id}:${i.g}`)

describe('meta de calorias (Mifflin-St Jeor)', () => {
  it('mulher, 32 anos, 70 kg, 165 cm, pouco ativa, perder 0,5 kg/semana', () => {
    const t = calorieTarget(prof(), 70, 2026)
    // BMR = 700 + 1031,25 − 160 − 161 = 1410,25 → TDEE ×1,375 = 1939 → −550
    expect(t.bmr).toBe(1410); expect(t.tdee).toBe(1940); expect(t.kcal).toBe(1390); expect(t.clamped).toBe(false); expect(t.deficit).toBe(550)
  })
  it('nunca abaixo do mínimo seguro', () => {
    const t = calorieTarget(prof({ pace_kg_week: 1, activity: 'sedentario' }), 55, 2026)
    expect(t.kcal).toBe(1200); expect(t.clamped).toBe(true)
    expect(calorieTarget(prof({ sex: 'm', pace_kg_week: 1, activity: 'sedentario', height_cm: 160 }), 55, 2026).kcal).toBe(1500)
  })
  it('manter, ganhar e meta manual', () => {
    expect(calorieTarget(prof({ goal: 'manter' }), 70, 2026).kcal).toBe(1940)
    expect(calorieTarget(prof({ goal: 'ganhar', pace_kg_week: 0.25 }), 70, 2026).kcal).toBe(2210)
    const m = calorieTarget(prof({ kcal_override: 1600 }), 70, 2026)
    expect(m.kcal).toBe(1600); expect(m.manual).toBe(true)
  })
})

describe('leitura das refeições', () => {
  it('quantidades, medidas caseiras e plurais', () => {
    expect(byText('2 ovos, 1 pão francês e café com leite')).toEqual(['ovo:100', 'pao-frances:50', 'cafe-leite:150'])
    expect(byText('100g de arroz, 1 concha de feijão e 1 filé de frango')).toEqual(['arroz:100', 'feijao:100', 'frango:100'])
    expect(byText('meia xícara de leite desnatado; duas fatias de pão de forma integral')).toEqual(['leite-desn:120', 'pao-forma-int:50'])
    expect(byText('3 colheres de sopa de arroz integral + 1 colher de chá de azeite')).toEqual(['arroz-int:75', 'azeite:4'])
    expect(byText('suco de laranja 300 ml')).toEqual(['suco-laranja:300'])
    expect(byText('pães franceses')).toEqual(['pao-frances:50'])
  })
  it('"com" separa itens, a não ser no nome', () => {
    expect(byText('tapioca com queijo minas')).toEqual(['tapioca:60', 'queijo-minas:30'])
    expect(byText('pão com manteiga')).toEqual(['pao-frances:50', 'manteiga:10'])
    expect(byText('café com leite')).toEqual(['cafe-leite:150'])
  })
  it('nome mais específico ganha', () => {
    expect(byText('batata doce')).toEqual(['batata-doce:150'])
    expect(byText('refri zero')).toEqual(['refri-zero:350'])
    expect(byText('ovo mexido')).toEqual(['ovo-mexido:55'])
  })
  it('calorias e macros proporcionais', () => {
    const [ovo] = parseMeal('2 ovos')
    expect(ovo.kcal).toBe(146); expect(ovo.p).toBe(13.3)
  })
  it('não reconhecido fica marcado para escolher', () => {
    const [x] = parseMeal('1 coisa estranha')
    expect(x.food_id).toBeNull(); expect(x.kcal).toBe(0)
  })
  it('alimentos próprios ganham da tabela', () => {
    const [b] = parseMeal('1 barrinha x', [{ id: 'b1', who: 'g', name: 'Barrinha X', portion: '1 unidade', portion_g: 30, kcal: 110, protein: 10, carb: null, fat: null }])
    expect(b.food_id).toBe('u:b1'); expect(b.kcal).toBe(110); expect(b.p).toBe(10)
  })
  it('tabela sem apelidos repetidos entre alimentos diferentes', () => {
    const seen = new Map<string, string>()
    for (const f of FOODS) for (const a of f.aliases) { expect(seen.get(a) ?? f.id).toBe(f.id); seen.set(a, f.id) }
  })
})

describe('treino, saldo e projeção', () => {
  it('MET × peso × tempo', () => {
    expect(workoutKcal('corrida', 'moderado', 30, 70)).toBe(343)
    expect(workoutKcal('musculacao', 'leve', 60, 60)).toBe(210)
    expect(workoutKcal('desconhecido', undefined, 60, 60)).toBe(270)
  })
  it('saldo do dia soma o treino', () => {
    const logs: PLog[] = [
      { id: '1', who: 'g', date: '2026-10-10', kind: 'refeicao', value: 500, data: { meal: 'cafe', items: [{ kcal: 500, p: 20, c: 60, f: 15 }] } },
      { id: '2', who: 'g', date: '2026-10-10', kind: 'refeicao', value: 700, data: { meal: 'almoco', items: [{ kcal: 700, p: 40, c: 80, f: 20 }] } },
      { id: '3', who: 'g', date: '2026-10-10', kind: 'treino', value: 30, data: { type: 'corrida', intensity: 'moderado' } },
      { id: '4', who: 's', date: '2026-10-10', kind: 'refeicao', value: 999, data: {} },
    ]
    const d = dayFood(logs, 'g', '2026-10-10', 1400, 70)
    expect(d).toEqual({ eaten: 1200, exercise: 343, target: 1400, left: 543, p: 60, c: 140, f: 35, meals: 2 })
    expect(dayWord(d)).toBe('Ainda tem espaço hoje')
  })
  it('tendência e data estimada', () => {
    const s = [{ date: '2026-09-12', v: 72 }, { date: '2026-09-26', v: 71.2 }, { date: '2026-10-10', v: 70.4 }]
    expect(weightTrend(s, '2026-10-10')).toBe(-0.4)
    expect(etaDate(s[2], 60, -0.5)).toBe('2027-03-05')
    expect(etaDate(s[2], 60, 0.2)).toBeNull()
    expect(weightTrend([s[2]], '2026-10-10')).toBeNull()
  })
  it('refeição sugerida pelo horário', () => {
    expect(['07:30', '12:10', '16:00', '20:00', '23:00'].map(mealForTime)).toEqual(['cafe', 'almoco', 'lanche', 'jantar', 'ceia'])
  })
})
