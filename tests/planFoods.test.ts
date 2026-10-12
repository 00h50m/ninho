import { describe, expect, it } from 'vitest'
import { planFoods, type DietPlan } from '@/lib/dietPlan'

// Plano fictício (nenhum dado real)
const alt = (food: string, qty: string | null, grams: number | null, kcal: number | null) => ({ food, qty, grams, kcal })
const PLAN: DietPlan = {
  title: 'Plano teste', rules: [], supplements: [], water_l: 2,
  lists: [{ name: 'Frutas', items: ['1 banana', '1 maçã', 'xyzfruta rara'] }],
  meals: [
    { id: 'm1', name: 'Café da manhã', time: '07:00', when: 'sempre', note: null, options: [
      { label: 'Opção 1', items: [{ alts: [alt('pão francês', '1 unidade', 50, null), alt('tapioca', '2 colheres de sopa', 40, 140)], when: 'sempre', note: null }, { alts: [alt('ovo', '2 unidades', 100, null)], when: 'sempre', note: null }] },
      { label: 'Opção 2', items: [{ alts: [alt('Iogurte proteico da marca X', '1 pote', 160, 120)], when: 'sempre', note: null }] },
    ] },
    { id: 'm2', name: 'Almoço', time: '12:30', when: 'sempre', note: null, options: [
      { label: 'Opção 1', items: [{ alts: [alt('arroz branco', '4 colheres de sopa', 100, null), alt('pão francês', '2 unidades', 100, null)], when: 'sempre', note: null }, { alts: [alt('molho misterioso', null, null, null)], when: 'sempre', note: null }] },
    ] },
  ],
}

describe('alimentos do plano', () => {
  it('cada alimento uma vez, com a porção do plano e as calorias dessa porção', () => {
    const f = planFoods(PLAN)
    const names = f.map(x => x.name)
    expect(names.slice(0, 5)).toEqual(['Pão francês', 'Tapioca', 'Ovo', 'Iogurte proteico da marca X', 'Arroz branco'])
    expect(names.filter(n => n === 'Pão francês')).toHaveLength(1)
    const pao = f[0]
    expect(pao).toMatchObject({ portion: '1 unidade', portion_g: 50, from: 'Café da manhã' })
    expect(pao.kcal).toBeGreaterThan(100)
    expect(pao.protein).not.toBeNull()
    // fora da tabela: usa a estimativa do plano, sem inventar macros
    expect(f.find(x => x.name === 'Iogurte proteico da marca X')).toMatchObject({ kcal: 120, portion: '1 pote', portion_g: 160, protein: null })
    // sem calorias em lugar nenhum: fica de fora
    expect(names).not.toContain('Molho misterioso')
  })
  it('listas de substituição entram e o que já está em Meus alimentos fica de fora', () => {
    const f = planFoods(PLAN, [{ name: 'ovo' }, { name: 'TAPIOCA' }])
    expect(f.map(x => x.name)).not.toContain('Ovo')
    expect(f.map(x => x.name)).not.toContain('Tapioca')
    const frutas = f.filter(x => x.from === 'Frutas')
    expect(frutas.length).toBe(2)
    expect(frutas.every(x => x.kcal > 0 && x.portion_g > 0)).toBe(true)
  })
})
