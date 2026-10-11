import { describe, expect, it } from 'vitest'
import { altToItem, planForDay, plateToItems, slotOf, validatePlan } from '@/lib/dietPlan'

// Plano fictício, no formato que a IA devolve
const RAW = {
  title: 'Plano de teste',
  water_l: 3,
  meals: [
    { name: 'Café da manhã', time: '07:30', when: 'sempre', note: null, options: [
      { label: 'Opção 1', items: [
        { when: 'sempre', note: null, alts: [{ food: 'ovo', qty: '2 unidades', grams: 100, kcal: 150 }, { food: 'frango desfiado', qty: '60 g', grams: 60, kcal: 100 }] },
        { when: 'sempre', note: null, alts: [{ food: 'pão francês', qty: '1 unidade', grams: 50, kcal: 150 }] },
      ] },
      { label: 'Opção 2', items: [{ when: 'sempre', note: null, alts: [{ food: 'tapioca', qty: '1 unidade', grams: 60, kcal: 140 }] }] },
    ] },
    { name: 'Almoço', time: '12:00', when: 'sempre', note: null, options: [{ label: 'Opção única', items: [
      { when: 'sempre', note: null, alts: [{ food: 'arroz', qty: '100 g', grams: 100, kcal: 128 }] },
      { when: 'descanso', note: 'quando não treinar', alts: [{ food: 'arroz', qty: '+100 g', grams: 100, kcal: 128 }] },
    ] }] },
    { name: 'Pré-treino', time: '17:00', when: 'treino', note: 'comer apenas quando treinar', options: [{ label: 'Opção única', items: [{ when: 'sempre', note: null, alts: [{ food: 'banana', qty: '1 unidade', grams: 70, kcal: 70 }] }] }] },
    { name: 'Vazia', time: '25:00', when: 'sempre', note: null, options: [] },
  ],
  rules: [{ text: 'Refeição livre no sábado', when: 'fim_de_semana' }, { text: '', when: 'sempre' }],
  supplements: [{ name: 'Vitamina D', dose: '1 cápsula', time: '08:00' }, { name: 'Creatina', dose: '3 g', time: 'manhã' }],
  lists: [{ name: 'Bebidas sem calorias', items: ['água com gás', 'chá', ''] }],
}

describe('plano alimentar', () => {
  it('confere o que a IA devolveu', () => {
    const p = validatePlan(RAW)!
    expect(p.meals.map(m => `${m.id}:${m.name}:${m.time}`)).toEqual(['m1:Café da manhã:07:30', 'm2:Almoço:12:00', 'm3:Pré-treino:17:00'])
    expect(p.meals[0].options).toHaveLength(2)
    expect(p.supplements).toEqual([{ name: 'Vitamina D', dose: '1 cápsula', time: '08:00' }, { name: 'Creatina', dose: '3 g', time: null }])
    expect(p.rules).toEqual([{ text: 'Refeição livre no sábado', when: 'fim_de_semana' }])
    expect(p.lists[0].items).toEqual(['água com gás', 'chá'])
    expect(p.water_l).toBe(3)
    expect(validatePlan({ title: 'não é plano', meals: [] })).toBeNull()
    expect(validatePlan('lixo')).toBeNull()
  })
  it('dia de treino e de descanso', () => {
    const p = validatePlan(RAW)!
    expect(planForDay(p, true).map(m => m.name)).toEqual(['Café da manhã', 'Almoço', 'Pré-treino'])
    expect(planForDay(p, true)[1].options[0].items).toHaveLength(1)
    const rest = planForDay(p, false)
    expect(rest.map(m => m.name)).toEqual(['Café da manhã', 'Almoço'])
    expect(rest[1].options[0].items).toHaveLength(2)
  })
  it('alternativa vira item: tabela quando reconhece, estimativa da IA quando não', () => {
    const ovo = altToItem({ food: 'ovo', qty: '2 unidades', grams: 100, kcal: 150 })
    expect([ovo.food_id, ovo.g, ovo.kcal]).toEqual(['ovo', 100, 146])
    const x = altToItem({ food: 'crepioca da casa', qty: '1 unidade', grams: 120, kcal: 210 })
    expect([x.food_id, x.g, x.kcal, x.guess]).toEqual([null, 120, 210, true])
    const sem = altToItem({ food: 'pão francês', qty: '1 unidade', grams: null, kcal: null })
    expect([sem.food_id, sem.g]).toEqual(['pao-frances', 50])
  })
  it('refeição do Meu dia pelo nome ou horário', () => {
    expect(slotOf({ name: 'Refeição 1 – café da manhã', time: null }, '12:00')).toBe('cafe')
    expect(slotOf({ name: 'Pré-treino', time: '17:00' }, '12:00')).toBe('lanche')
    expect(slotOf({ name: 'Refeição 4', time: '20:00' }, '12:00')).toBe('jantar')
  })
})

describe('foto do prato', () => {
  it('usa a tabela com os gramas da IA; o resto fica como estimativa', () => {
    const r = plateToItems({ is_food: true, note: 'óleo não aparece', items: [
      { name: 'arroz branco', grams: 150, kcal: 190, protein: 4, carb: 42, fat: 0.3 },
      { name: 'molho especial', grams: 30, kcal: 60, protein: 0, carb: 3, fat: 5 },
      { name: '', grams: 10, kcal: 10, protein: null, carb: null, fat: null },
    ] })
    expect(r.items.map(i => `${i.food_id}:${i.g}:${i.kcal}`)).toEqual(['arroz:150:192', 'null:30:60'])
    expect(r.items[1].guess).toBe(true)
    expect(r.note).toBe('óleo não aparece')
    expect(plateToItems({ is_food: false, items: [], note: null }).isFood).toBe(false)
  })
})
