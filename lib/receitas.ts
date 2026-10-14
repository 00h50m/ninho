// Receitas (migration 035): ingredientes com gramas e calorias, rendimento em porções e
// modo de preparo. Lança "1 porção" no Meu dia (calorias e macros divididos pelo rendimento)
// e manda os ingredientes para a lista de compras. Puro, testado.
import { mealTotals, type MealItem } from './nutricao'
import { cleanItems } from './savedMeals'
import type { Who } from './types'

export interface Recipe { id: string, who: Who, name: string, servings: number, items: MealItem[], steps: string | null, kcal: number }

const r1 = (v: number) => Math.round(v * 10) / 10

/** Linha do banco conferida (itens limpos, números como número). */
export function recipeFromDb(x: any): Recipe | null {
  const items = cleanItems(x?.items)
  const name = typeof x?.name === 'string' ? x.name.trim().slice(0, 60) : ''
  if (!name || !items.length) return null
  const servings = Math.min(50, Math.max(0.5, Number(x.servings) || 1))
  return { id: String(x.id), who: x.who, name, servings, items, steps: typeof x.steps === 'string' && x.steps.trim() ? x.steps.slice(0, 3000) : null, kcal: Number(x.kcal) || mealTotals(items).kcal }
}

/** O que vai para o banco: só ingredientes com nome, rendimento entre ½ e 50 porções. */
export function toRecipe(name: string, servings: number, items: MealItem[], steps: string): { name: string, servings: number, items: MealItem[], steps: string | null, kcal: number } | null {
  const its = cleanItems(items)
  const nm = name.replace(/\s+/g, ' ').trim().slice(0, 60)
  const sv = Math.round(Number(servings) * 2) / 2
  if (!nm || !its.length || !(sv >= 0.5 && sv <= 50)) return null
  return { name: nm, servings: sv, items: its, steps: steps.trim() ? steps.trim().slice(0, 3000) : null, kcal: mealTotals(its).kcal }
}

/** Itens de `portions` porção(ões) da receita (proporcionais ao rendimento). */
export function portionItems(r: Pick<Recipe, 'items' | 'servings'>, portions = 1): MealItem[] {
  const k = Math.max(0.25, Math.min(10, portions)) / r.servings
  return r.items.map(i => ({ ...i, qty: r1(i.qty * k), g: Math.round(i.g * k), kcal: Math.round(i.kcal * k), p: r1(i.p * k), c: r1(i.c * k), f: r1(i.f * k), text: `${i.name} (receita)` }))
}

/** Por porção: kcal e macros arredondados. */
export function perPortion(r: Pick<Recipe, 'items' | 'servings'>): { kcal: number, p: number, c: number, f: number } {
  const t = mealTotals(r.items)
  return { kcal: Math.round(t.kcal / r.servings), p: r1(t.p / r.servings), c: r1(t.c / r.servings), f: r1(t.f / r.servings) }
}

const qtyLabel = (g: number, unit: string) => unit === 'ml' ? (g >= 1000 ? `${String(r1(g / 1000)).replace('.', ',')} l` : `${g} ml`) : g >= 1000 ? `${String(r1(g / 1000)).replace('.', ',')} kg` : `${g} g`

/**
 * Ingredientes para a lista de compras. `batches` = quantas vezes vai fazer a receita.
 * O mesmo ingrediente repetido soma; sal, água e temperos de casa ficam de fora.
 */
export function recipeShopping(r: Pick<Recipe, 'items'>, batches = 1): Array<{ title: string, qty: string }> {
  const skip = /^(agua|sal|pimenta do reino|oregano|gelo)\b/
  const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const by = new Map<string, { title: string, g: number, unit: string }>()
  for (const i of r.items) {
    const key = plain(i.name)
    if (skip.test(key)) continue
    const cur = by.get(key) || { title: i.name, g: 0, unit: i.unit === 'ml' ? 'ml' : 'g' }
    cur.g += i.g * Math.max(1, Math.min(10, batches))
    by.set(key, cur)
  }
  return Array.from(by.values()).map(x => ({ title: x.title, qty: x.g > 0 ? qtyLabel(Math.round(x.g), x.unit) : '' }))
}
