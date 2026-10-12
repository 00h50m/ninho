import { describe, expect, it } from 'vitest'
import { cleanItems, matchSaved, scaleMeal, toSaved } from '@/lib/savedMeals'

const it2 = [
  { name: 'Pão francês', food_id: 'pao', qty: 1, unit: 'un', g: 50, kcal: 150, p: 4, c: 29, f: 1.6, text: '1 pão' },
  { name: 'Ovo', food_id: 'u:x', qty: 2, unit: 'porcao', g: 100, kcal: 143, p: 13, c: 1, f: 9.5, text: '2 ovos' },
  { name: 'Sem caloria', food_id: null, qty: 1, unit: 'g', g: 0, kcal: 0, p: 0, c: 0, f: 0, text: 'x' },
] as any

describe('refeições salvas', () => {
  it('salva só itens com calorias, com o total', () => {
    expect(toSaved('  Meu café   de sempre ', it2)).toMatchObject({ name: 'Meu café de sempre', kcal: 293 })
    expect(toSaved('Café', it2)!.items).toHaveLength(2)
    expect(toSaved('', it2)).toBeNull()
    expect(toSaved('Nada', [it2[2]])).toBeNull()
  })
  it('confere o que vem do banco', () => {
    const c = cleanItems([{ name: ' Arroz ', kcal: 99999, g: -5, p: 'x' }, { kcal: 10 }, 'lixo'])
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ name: 'Arroz', kcal: 5000, g: 0, p: 0, qty: 1 })
  })
  it('meia porção ou dobro', () => {
    const half = scaleMeal(it2.slice(0, 2), 0.5)
    expect(half.map((i: any) => `${i.kcal}/${i.g}/${i.qty}`)).toEqual(['75/25/0.5', '72/50/1'])
    expect(scaleMeal(it2, 1)).toBe(it2)
  })
  it('acha a refeição salva no Telegram', () => {
    const meals = [{ name: 'Meu café de sempre' }, { name: 'Café' }, { name: 'Marmita de frango' }]
    expect(matchSaved('comi meu café de sempre', meals)).toBe(0)
    expect(matchSaved('Almocei a marmita de frango hoje', meals)).toBe(2)
    expect(matchSaved('comi café', meals)).toBe(1)
    expect(matchSaved('comprei café', meals)).toBe(-1)
    expect(matchSaved('comi pizza', meals)).toBe(-1)
  })
})
