// Jantar das duas (migration 038): o cardápio da casa da semana, quem cozinha e os ingredientes.
// Os ingredientes são uma cópia (a receita pode ser privada de uma de vocês). Puro, testado.
import { addDays, weekStartOf } from './dates'
import type { Who } from './types'
import type { Recipe } from './receitas'
import { urgency, type PantryItem } from './despensa'

export type Cook = Who | 'both' | null
export interface HouseMeal { id: string, date: string, meal: 'almoco' | 'jantar', title: string, cook: Cook, recipe_id: string | null, ingredients: Array<{ title: string, qty: string }>, notes: string | null }

/** Os 7 dias da semana (segunda a domingo) com o jantar de cada um, se planejado. */
export function weekPlan(meals: HouseMeal[], anyDay: string): Array<{ date: string, meal: HouseMeal | null }> {
  const ws = weekStartOf(anyDay)
  return Array.from({ length: 7 }, (_, i) => { const date = addDays(ws, i); return { date, meal: meals.find(m => m.date === date && m.meal === 'jantar') || null } })
}

/** Ingredientes da semana juntos (mesmo nome soma as quantidades em g/ml/kg/l; o resto lista). */
export function weekShopping(meals: HouseMeal[]): Array<{ title: string, qty: string }> {
  const by = new Map<string, { title: string, g: number, unit: string, other: string[] }>()
  for (const m of meals) for (const i of m.ingredients || []) {
    const k = i.title.trim().toLowerCase(); if (!k) continue
    const cur = by.get(k) || { title: i.title.trim(), g: 0, unit: '', other: [] }
    const q = (i.qty || '').trim().toLowerCase().replace(',', '.')
    const mt = q.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l)$/)
    if (mt) { const n = Number(mt[1]) * (mt[2] === 'kg' || mt[2] === 'l' ? 1000 : 1); const u = mt[2] === 'ml' || mt[2] === 'l' ? 'ml' : 'g'; if (!cur.unit || cur.unit === u) { cur.g += n; cur.unit = u } else cur.other.push(i.qty) }
    else if (q) cur.other.push(i.qty)
    by.set(k, cur)
  }
  const fmt = (g: number, u: string) => g >= 1000 ? `${String(Math.round(g / 100) / 10).replace('.', ',')} ${u === 'ml' ? 'l' : 'kg'}` : `${Math.round(g)} ${u}`
  return Array.from(by.values()).map(x => ({ title: x.title, qty: [x.g ? fmt(x.g, x.unit) : '', ...x.other].filter(Boolean).join(' + ').slice(0, 30) }))
}

/** Quem cozinhou na semana (para o balanço). "As duas" conta meio para cada. */
export function cookCount(meals: HouseMeal[], from: string, to: string): Record<Who, number> {
  const c: Record<Who, number> = { g: 0, s: 0 }
  for (const m of meals) if (m.date >= from && m.date <= to) { if (m.cook === 'g' || m.cook === 's') c[m.cook] += 1; else if (m.cook === 'both') { c.g += 0.5; c.s += 0.5 } }
  return c
}

export const cookLabel = (c: Cook, names: Record<Who, string>) => c === 'both' ? 'as duas' : c ? (names[c] || '').split(' ')[0] : 'a combinar'

// ── Da despensa para o jantar ─────────────────────────────────────────

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'em', 'e', 'a', 'o', 'para', 'natural', 'integral', 'light', 'zero', 'fresco', 'fresca', 'cozido', 'cozida', 'cru', 'crua', 'picado', 'picada', 'ralado', 'ralada', 'desfiado', 'desfiada', 'moido', 'moida', 'grande', 'pequeno', 'pequena', 'inteiro', 'inteira', 'pote', 'pacote', 'caixa', 'lata'])
const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/)
  .map(w => w.replace(/(oes|aes|ns|s)$/, m => m === 'oes' ? 'ao' : m === 'aes' ? 'ao' : m === 'ns' ? 'm' : ''))
  .filter(w => w.length >= 3 && !STOP.has(w))
/** O ingrediente da receita é este item da despensa? (alguma palavra importante em comum: "Peito de frango" ~ "Frango desfiado") */
export function sameFood(a: string, b: string): boolean {
  const wb = new Set(words(b))
  return words(a).some(w => wb.has(w))
}

const WEIGHT: Record<string, number> = { hoje: 3, logo: 2, semana: 1 }

/**
 * Jantares para usar o que vence logo: receitas que levam algo da despensa que vence hoje,
 * em até 3 dias ou na semana (vencido fica de fora). As que usam mais coisa e mais urgente primeiro.
 */
export function dinnersFromPantry(recipes: Recipe[], pantry: PantryItem[], today: string, max = 3): Array<{ recipe: Recipe, uses: PantryItem[], score: number }> {
  const soon = pantry.filter(p => WEIGHT[urgency(p, today).u])
  if (!soon.length) return []
  return recipes
    .map(recipe => {
      const uses = soon.filter(p => recipe.items.some(i => sameFood(i.name, p.name)))
      return { recipe, uses, score: uses.reduce((a, p) => a + WEIGHT[urgency(p, today).u], 0) }
    })
    .filter(x => x.uses.length)
    .sort((a, b) => b.score - a.score || b.uses.length - a.uses.length || a.recipe.name.localeCompare(b.recipe.name, 'pt-BR'))
    .slice(0, max)
}

/** Primeiro dia sem jantar planejado, de hoje até daqui a 6 dias (ou hoje). */
export function firstFreeDay(meals: HouseMeal[], today: string): string {
  for (let i = 0; i < 7; i++) { const d = addDays(today, i); if (!meals.some(m => m.date === d && m.meal === 'jantar')) return d }
  return today
}
