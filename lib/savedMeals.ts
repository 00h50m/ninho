// Refeições salvas (migration 031): combinações que a pessoa guarda com um nome
// ("Meu café de sempre") para lançar depois com um toque, no app ou no Telegram
// ("comi meu café de sempre"). Puro, testado.
import { mealTotals, norm, type MealItem } from './nutricao'
import type { Who } from './types'

export interface SavedMeal { id: string, who: Who, name: string, items: MealItem[], kcal: number, uses: number }

const r1 = (v: number) => Math.round(v * 10) / 10
const n = (v: unknown, max: number) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.min(max, x) : 0 }

/** Itens guardados (do banco) conferidos: nome, gramas, kcal e macros dentro do razoável. */
export function cleanItems(raw: unknown): MealItem[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 30).flatMap((x: any): MealItem[] => {
    const name = typeof x?.name === 'string' ? x.name.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
    if (!name) return []
    return [{ name, food_id: typeof x.food_id === 'string' ? x.food_id.slice(0, 60) : null, qty: n(x.qty, 5000) || 1, unit: typeof x.unit === 'string' ? x.unit : 'g',
      g: Math.round(n(x.g, 5000)), kcal: Math.round(n(x.kcal, 5000)), p: r1(n(x.p, 500)), c: r1(n(x.c, 500)), f: r1(n(x.f, 500)), text: typeof x.text === 'string' ? x.text.slice(0, 120) : name }]
  })
}

/** O que vai para o banco ao salvar: só itens com calorias, nome curto e o total. */
export function toSaved(name: string, items: MealItem[]): { name: string, items: MealItem[], kcal: number } | null {
  const its = cleanItems(items).filter(i => i.kcal > 0)
  const nm = name.replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!nm || !its.length) return null
  return { name: nm, items: its, kcal: mealTotals(its).kcal }
}

/** Mesma refeição em outra quantidade (½ porção, 2 porções…): kcal, gramas e macros proporcionais. */
export function scaleMeal(items: MealItem[], factor: number): MealItem[] {
  const k = Math.max(0.25, Math.min(5, factor))
  if (Math.abs(k - 1) < 0.01) return items
  return items.map(i => ({ ...i, qty: r1(i.qty * k), g: Math.round(i.g * k), kcal: Math.round(i.kcal * k), p: r1(i.p * k), c: r1(i.c * k), f: r1(i.f * k) }))
}

/**
 * "comi meu café de sempre" → a refeição salva cujo nome aparece no texto (o nome mais longo ganha).
 * Só quando a frase é sobre ter comido (comi, almocei, jantei, lanchei, tomei, café da manhã foi…).
 */
export function matchSaved(text: string, meals: Array<Pick<SavedMeal, 'name'>>): number {
  const t = ` ${norm(text)} `
  if (!/^ (comi|almocei|jantei|lanchei|tomei|ceei|merendei)\b/.test(t)) return -1
  let best = -1, len = 0
  meals.forEach((m, i) => {
    const k = norm(m.name).replace(/^(meu|minha|o|a)\s+/, '')
    if (k.length >= 3 && t.includes(` ${k} `) && k.length > len) { best = i; len = k.length }
  })
  return best
}
