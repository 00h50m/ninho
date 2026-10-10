// Alimentação no Meu dia: meta de calorias (Mifflin-St Jeor), leitura das
// refeições escritas em texto, calorias de treino (MET) e projeção de peso.
// Puro (sem React/Supabase). São estimativas: não substituem nutricionista.
import { addDays, dayNum } from './dates'
import { FOODS, type Food, type FoodUnit } from './foods'
import type { PLog } from './meudia'
import type { Who } from './types'

// ── Perfil e meta ────────────────────────────────────────────────────
export type Activity = 'sedentario' | 'leve' | 'moderado' | 'alto' | 'muito_alto'
export type Goal = 'perder' | 'manter' | 'ganhar'
export interface FoodProfile {
  who: Who, sex: 'f' | 'm', birth_year: number, height_cm: number, activity: Activity, goal: Goal
  pace_kg_week: number, target_kg: number | null, kcal_override: number | null, hide_numbers: boolean
}
export const ACTIVITIES: Array<[Activity, string, string, number]> = [
  ['sedentario', 'Sedentária', 'quase o dia todo sentada', 1.2],
  ['leve', 'Pouco ativa', 'anda um pouco, trabalho em pé às vezes', 1.375],
  ['moderado', 'Ativa', 'em pé e andando boa parte do dia', 1.55],
  ['alto', 'Muito ativa', 'trabalho físico', 1.725],
  ['muito_alto', 'Extremamente ativa', 'trabalho físico pesado', 1.9],
]
export const GOALS: Array<[Goal, string]> = [['perder', 'Emagrecer'], ['manter', 'Manter o peso'], ['ganhar', 'Ganhar peso']]
/** Abaixo disso, sem acompanhamento, não é seguro (referência usual). */
export const SAFE_MIN = { f: 1200, m: 1500 } as const

export interface Target { bmr: number, tdee: number, kcal: number, clamped: boolean, manual: boolean, deficit: number }
export function calorieTarget(pr: FoodProfile, weightKg: number, year: number): Target {
  const age = year - pr.birth_year
  const bmr = 10 * weightKg + 6.25 * pr.height_cm - 5 * age + (pr.sex === 'm' ? 5 : -161)
  const tdee = bmr * (ACTIVITIES.find(a => a[0] === pr.activity)?.[3] ?? 1.375)
  const delta = pr.goal === 'perder' ? -pr.pace_kg_week * 7700 / 7 : pr.goal === 'ganhar' ? pr.pace_kg_week * 7700 / 7 : 0
  const min = SAFE_MIN[pr.sex]
  const r10 = (v: number) => Math.round(v / 10) * 10
  if (pr.kcal_override) return { bmr: Math.round(bmr), tdee: r10(tdee), kcal: pr.kcal_override, clamped: false, manual: true, deficit: r10(tdee - pr.kcal_override) }
  const raw = r10(tdee + delta), kcal = Math.max(min, raw)
  return { bmr: Math.round(bmr), tdee: r10(tdee), kcal, clamped: raw < min, manual: false, deficit: r10(tdee - kcal) }
}

// ── Calorias de treino (MET × kg × horas) ────────────────────────────
const MET: Record<string, [number, number, number]> = {
  musculacao: [3.5, 5, 6], corrida: [7, 9.8, 11.5], caminhada: [2.8, 3.5, 4.3], bike: [4, 6.8, 10],
  natacao: [5.8, 7, 9.8], yoga: [2.5, 3, 4], pilates: [2.8, 3, 3.8], funcional: [4, 6, 8], outro: [3, 4.5, 6],
}
export function workoutKcal(type: string, intensity: string | undefined, minutes: number, weightKg: number): number {
  const m = MET[type] || MET.outro, i = intensity === 'leve' ? 0 : intensity === 'forte' ? 2 : 1
  return Math.round(m[i] * weightKg * minutes / 60)
}
export function exerciseOn(logs: PLog[], who: Who, date: string, weightKg: number): number {
  return logs.filter(l => l.who === who && l.kind === 'treino' && l.date === date)
    .reduce((a, l) => a + workoutKcal(l.data?.type, l.data?.intensity, Number(l.value) || 0, weightKg), 0)
}

// ── Leitura do texto da refeição ─────────────────────────────────────
export interface MealItem { name: string, food_id: string | null, qty: number, unit: FoodUnit | 'g' | 'ml', g: number, kcal: number, p: number, c: number, f: number, text: string, guess?: boolean }
export interface CustomFood { id: string, who: Who, name: string, portion: string, portion_g: number, kcal: number, protein: number | null, carb: number | null, fat: number | null }

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/.,\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
/** Singular simples para comparar ("ovos"→"ovo", "pães"→"pao", "colheres"→"colher"). */
const stem = (w: string) => w.length <= 3 ? w : /(a|o)es$/.test(w) ? w.slice(0, -3) + 'ao' : /(r|s|z)es$/.test(w) ? w.slice(0, -2) : /s$/.test(w) ? w.slice(0, -1) : w
const stemAll = (s: string) => s.split(' ').map(stem).join(' ')

/** Alimentos próprios viram alimentos da tabela (por 100 g), com a porção como medida. */
export function customToFood(c: CustomFood): Food {
  const k = 100 / c.portion_g
  return { id: 'u:' + c.id, name: c.name, aliases: [norm(c.name)], kcal: c.kcal * k, p: (c.protein || 0) * k, c: (c.carb || 0) * k, f: (c.fat || 0) * k, units: { porcao: c.portion_g, un: c.portion_g } }
}

interface Matcher { food: Food, alias: string }
function matchers(custom: Food[]): Matcher[] {
  // os próprios vêm primeiro: em empate de tamanho, ganham da tabela
  return [...custom, ...FOODS].flatMap(food => food.aliases.map(a => ({ food, alias: stemAll(norm(a)) })))
}
export function findFood(text: string, custom: Food[] = []): { food: Food, alias: string } | null {
  const t = ` ${stemAll(norm(text))} `
  let best: Matcher | null = null
  for (const m of matchers(custom)) if (t.includes(` ${m.alias} `) && (!best || m.alias.length > best.alias.length)) best = m
  return best
}

const NUM_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, meio: 0.5, meia: 0.5 }
const UNIT_WORDS: Array<[RegExp, FoodUnit | 'g' | 'ml' | 'kg' | 'l']> = [
  [/^(g|gr|grama|gramas)$/, 'g'], [/^(kg|quilo|quilos)$/, 'kg'], [/^(ml|mls)$/, 'ml'], [/^(l|litro|litros)$/, 'l'],
  [/^(un|und|unid|unidade|unidades)$/, 'un'], [/^(fatia|fatias|rodela|rodelas|pedaco|pedacos)$/, 'fatia'],
  [/^(colherinha|colherinhas)$/, 'colherinha'], [/^(colher|colheres|cs|csp)$/, 'colher'], [/^(xicara|xicaras|xic)$/, 'xicara'],
  [/^(concha|conchas)$/, 'concha'], [/^(copo|copos)$/, 'copo'], [/^(lata|latas|latinha|latinhas)$/, 'lata'], [/^(taca|tacas)$/, 'taca'],
  [/^(escumadeira|escumadeiras)$/, 'escumadeira'], [/^(pote|potes|potinho)$/, 'pote'], [/^(medida|medidas|scoop|scoops|dosador)$/, 'medida'],
  [/^(bola|bolas)$/, 'bola'], [/^(porcao|porcoes|prato|pratos)$/, 'porcao'], [/^(punhado|punhados)$/, 'punhado'], [/^(file|files|bife|bifes)$/, 'file'],
  [/^(tigela|tigelas|bowl)$/, 'tigela'],
]
const unitOf = (w: string) => UNIT_WORDS.find(([re]) => re.test(w))?.[1] ?? null
const numOf = (w: string): number | null => {
  if (NUM_WORDS[w] != null) return NUM_WORDS[w]
  if (/^\d+\/\d+$/.test(w)) { const [a, b] = w.split('/').map(Number); return b ? a / b : null }
  if (/^\d+([.,]\d+)?$/.test(w)) return Number(w.replace(',', '.'))
  const m = w.match(/^(\d+(?:[.,]\d+)?)(g|gr|kg|ml|l)$/); return m ? Number(m[1].replace(',', '.')) : null
}

/** Grama de uma medida caseira (ou a porção padrão quando não informada). */
function gramsFor(food: Food, qty: number, unit: MealItem['unit'] | 'kg' | 'l' | null): { g: number, unit: MealItem['unit'], guess: boolean } {
  if (unit === 'g' || unit === 'ml') return { g: qty, unit, guess: false }
  if (unit === 'kg' || unit === 'l') return { g: qty * 1000, unit: unit === 'kg' ? 'g' : 'ml', guess: false }
  if (unit === 'colherinha' && !food.units.colherinha && food.units.colher) return { g: qty * food.units.colher / 3, unit, guess: false }
  if (unit && food.units[unit]) return { g: qty * food.units[unit]!, unit, guess: false }
  // sem medida (ou medida que esse alimento não tem): usa a medida mais comum dele
  const order: FoodUnit[] = food.liquid ? ['lata', 'xicara', 'copo', 'taca', 'pote']
    : ['un', 'fatia', 'file', 'pote', 'tigela', 'porcao', 'concha', 'escumadeira', 'colher', 'medida', 'bola', 'punhado', 'xicara', 'copo', 'lata', 'colherinha']
  const def = order.find(u => food.units[u])
  if (def) return { g: qty * food.units[def]!, unit: def, guess: !!unit && unit !== def }
  return { g: qty * 100, unit: 'g', guess: true }
}

export function itemFor(food: Food, qty: number, unit: MealItem['unit'] | 'kg' | 'l' | null, text = ''): MealItem {
  const r = gramsFor(food, qty, unit)
  const k = r.g / 100, r1 = (v: number) => Math.round(v * 10) / 10
  return { name: food.name, food_id: food.id, qty, unit: r.unit, g: Math.round(r.g), kcal: Math.round(food.kcal * k), p: r1(food.p * k), c: r1(food.c * k), f: r1(food.f * k), text, ...(r.guess ? { guess: true } : {}) }
}

/** Um pedaço do texto ("2 ovos", "100 g de arroz", "1 colher de azeite"). */
function parsePiece(raw: string, custom: Food[]): MealItem {
  const words = norm(raw).split(' ').filter(Boolean)
  let qty: number | null = null, unit: ReturnType<typeof unitOf> = null
  // quantidade e medida no começo ("2 colheres de sopa de", "meia xícara de", "100g de")
  let i = 0
  const n0 = words[0] != null ? numOf(words[0]) : null
  if (n0 != null) { qty = n0; const glued = words[0].match(/(g|gr|kg|ml|l)$/); if (glued && /\d/.test(words[0])) unit = unitOf(glued[1]); i = 1 }
  if (!unit && words[i] && unitOf(words[i])) { unit = unitOf(words[i]); i++ }
  if (unit && words[i] === 'de' && (words[i + 1] === 'sopa' || words[i + 1] === 'cha')) { if (words[i + 1] === 'cha' && unit === 'colher') unit = 'colherinha'; i += 2 }
  if (['de', 'do', 'da', 'dos', 'das'].includes(words[i])) i++
  let rest = words.slice(i)
  // ou no fim ("arroz 100g", "suco 300 ml")
  const last = rest[rest.length - 1], prev = rest[rest.length - 2]
  if (qty == null && last) {
    const glued = last.match(/^(\d+(?:[.,]\d+)?)(g|gr|kg|ml|l)$/)
    if (glued) { qty = Number(glued[1].replace(',', '.')); unit = unitOf(glued[2]); rest = rest.slice(0, -1) }
    else if (prev && numOf(prev) != null && unitOf(last)) { qty = numOf(prev); unit = unitOf(last); rest = rest.slice(0, -2) }
  }
  const text = raw.trim()
  const m = findFood(rest.join(' '), custom)
  if (!m) return { name: rest.join(' ') || text, food_id: null, qty: qty ?? 1, unit: (unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit) || 'un', g: 0, kcal: 0, p: 0, c: 0, f: 0, text }
  return itemFor(m.food, qty ?? 1, unit, text)
}

/** "2 ovos, 1 pão francês com manteiga e café com leite" → itens com calorias. */
export function parseMeal(text: string, customFoods: CustomFood[] = []): MealItem[] {
  const custom = customFoods.map(customToFood)
  const out: MealItem[] = []
  const pieces = text.split(/[,;\n+]|\s+e\s+|\s+mais\s+/i).map(s => s.trim()).filter(Boolean)
  for (const piece of pieces) {
    // "com" separa itens, a não ser que faça parte do nome ("café com leite")
    const m = findFood(piece, custom)
    const parts = / com /i.test(` ${norm(piece)} `) && !(m && m.alias.includes(' com ')) ? piece.split(/\s+com\s+/i) : [piece]
    for (const p of parts) if (p.trim()) out.push(parsePiece(p, custom))
  }
  return out.slice(0, 30)
}

export const mealTotals = (items: Array<Pick<MealItem, 'kcal' | 'p' | 'c' | 'f'>>) => {
  const t = items.reduce((a, i) => ({ kcal: a.kcal + (i.kcal || 0), p: a.p + (i.p || 0), c: a.c + (i.c || 0), f: a.f + (i.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 })
  return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) }
}

// ── Refeições e saldo do dia ─────────────────────────────────────────
export type Meal = 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'ceia' | 'outro'
export const MEALS: Array<[Meal, string, string]> = [
  ['cafe', '☕', 'Café da manhã'], ['almoco', '🍛', 'Almoço'], ['lanche', '🍎', 'Lanche'], ['jantar', '🍲', 'Jantar'], ['ceia', '🌙', 'Ceia'], ['outro', '✨', 'Outro'],
]
export function mealForTime(hm: string): Meal {
  const h = Number(hm.slice(0, 2))
  return h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : h < 22 ? 'jantar' : 'ceia'
}
export const mealsOn = (logs: PLog[], who: Who, date: string) => logs.filter(l => l.who === who && l.kind === 'refeicao' && l.date === date)
  .sort((a, b) => MEALS.findIndex(m => m[0] === a.data?.meal) - MEALS.findIndex(m => m[0] === b.data?.meal) || String(a.created_at || '').localeCompare(String(b.created_at || '')))

export interface DayFood { eaten: number, exercise: number, target: number, left: number, p: number, c: number, f: number, meals: number }
export function dayFood(logs: PLog[], who: Who, date: string, target: number, weightKg: number): DayFood {
  const ms = mealsOn(logs, who, date)
  const items = ms.flatMap(l => (l.data?.items || []) as MealItem[])
  const t = mealTotals(items)
  const eaten = Math.round(ms.reduce((a, l) => a + (Number(l.value) || 0), 0))
  const exercise = exerciseOn(logs, who, date, weightKg)
  return { eaten, exercise, target, left: target + exercise - eaten, p: t.p, c: t.c, f: t.f, meals: ms.length }
}
/** Sem números: como foi o dia em palavras. */
export function dayWord(d: DayFood): string {
  if (d.meals === 0) return 'Nada registrado ainda'
  const r = d.eaten / Math.max(1, d.target + d.exercise)
  return r < 0.85 ? 'Ainda tem espaço hoje' : r <= 1.05 ? 'Na medida' : 'Passou um pouco hoje'
}
export const kcalWeek = (logs: PLog[], who: Who, today: string) => Array.from({ length: 7 }, (_, i) => {
  const date = addDays(today, i - 6), ms = mealsOn(logs, who, date)
  return { date, h: ms.length ? Math.round(ms.reduce((a, l) => a + (Number(l.value) || 0), 0)) : null }
})

// ── Peso: tendência e projeção ───────────────────────────────────────
/** kg por semana nas últimas 4 semanas (regressão linear); null com pouco dado. */
export function weightTrend(series: Array<{ date: string, v: number }>, today: string): number | null {
  const from = dayNum(today) - 28, pts = series.filter(s => dayNum(s.date) >= from)
  if (pts.length < 2 || dayNum(pts[pts.length - 1].date) - dayNum(pts[0].date) < 7) return null
  const xs = pts.map(p => dayNum(p.date)), ys = pts.map(p => p.v)
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), den = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  return den ? Math.round(num / den * 7 * 100) / 100 : null
}
/** Quando chega no peso desejado num ritmo (kg/semana). null se o ritmo não leva até lá ou passa de 2 anos. */
export function etaDate(from: { date: string, v: number }, target: number, kgPerWeek: number): string | null {
  const diff = target - from.v
  if (Math.abs(diff) < 0.05) return from.date
  if (!kgPerWeek || Math.sign(diff) !== Math.sign(kgPerWeek)) return null
  const days = Math.ceil(diff / kgPerWeek * 7)
  return days > 730 ? null : addDays(from.date, days)
}
