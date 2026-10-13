// Modo marmita: junta o que dá para cozinhar de uma vez (proteínas, carboidratos e legumes) das
// refeições escolhidas do cardápio, com o total pronto, a estimativa cru, quantos potes e a ordem
// de preparo. O resto (frutas, pães, laticínios, bebidas…) fica "na hora". Puro, testado.
import { addDays } from './dates'
import { norm, type Meal } from './nutricao'
import type { Menu } from './cardapio'

export type PrepGroup = 'proteina' | 'carbo' | 'legume'
export interface PrepItem { key: string, name: string, group: PrepGroup, g: number, portions: number, rawG: number | null }
export interface Pote { date: string, meal: Meal, label: string, items: Array<{ name: string, g: number }> }
export interface MarmitaPlan { potes: Pote[], cook: PrepItem[], fresh: string[], freezeFrom: string | null, steps: string[] }

// palavras que indicam o grupo (o primeiro que bater vale)
const GROUPS: Array<[PrepGroup, RegExp]> = [
  ['proteina', /\b(frango|peito de frango|sobrecoxa|coxa|carne|patinho|alcatra|acem|musculo|coxao|lagarto|file mignon|lombo|bisteca|suino|porco|peixe|tilapia|merluza|pescada|salmao|cacao|badejo|corvina|dourado|linguado|carne moida|almondega|hamburguer caseiro|frango desfiado)\b/],
  ['carbo', /\b(arroz|feijao|macarrao|massa|espaguete|batata|batata doce|mandioca|aipim|mandioquinha|inhame|grao de bico|lentilha|ervilha|quinoa|cuscuz|abobora cabotia|polenta)\b/],
  ['legume', /\b(brocolis|abobrinha|cenoura|vagem|couve flor|couve|chuchu|abobora|beterraba|legumes?|espinafre|berinjela|quiabo|repolho|jilo|palmito refogado|cogumelos?)\b/],
]
// peso pronto ÷ fator = peso cru (referências usuais de cozimento)
const RAW: Array<[RegExp, number]> = [
  [/\barroz integral\b/, 2.6], [/\barroz\b/, 2.8], [/\bfeijao|grao de bico|lentilha|ervilha\b/, 2.4], [/\bmacarrao|massa|espaguete\b/, 2.3],
  [/\bquinoa\b/, 2.7], [/\bcuscuz\b/, 2.2], [/\bpolenta\b/, 4],
]
const MEAT = 0.7 // carnes e peixes perdem ~30% do peso ao cozinhar

const groupOf = (name: string): PrepGroup | null => { const n = ` ${norm(name)} `; return GROUPS.find(([, re]) => re.test(n))?.[0] ?? null }
const keyOf = (name: string) => norm(name).replace(/\s*\d+([.,]\d+)?\s*(g|ml|kg)\b.*$/, '').replace(/\b(cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|pront[oa]s?|refogad[oa]s?|no vapor)\b/g, '').replace(/\s+/g, ' ').trim()
const r10 = (g: number) => Math.round(g / 10) * 10
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/**
 * Plano de marmitas para as refeições `meals` de `days` dias a partir de `from`.
 * Geladeira até 3 dias depois do preparo; o que for depois disso vai para o congelador.
 */
export function marmitaPlan(menu: Menu, from: string, days: number, meals: Meal[]): MarmitaPlan {
  const until = addDays(from, Math.max(1, days) - 1)
  const chosen = menu.days.filter(d => d.date >= from && d.date <= until)
  const potes: Pote[] = [], fresh = new Set<string>()
  const by = new Map<string, PrepItem>()
  for (const d of chosen) for (const m of d.meals) {
    if (!meals.includes(m.meal)) continue
    const items: Pote['items'] = []
    for (const i of m.items) {
      const group = groupOf(i.name)
      if (!group) { fresh.add(i.name); continue }
      items.push({ name: i.name, g: Math.round(i.g) })
      const key = keyOf(i.name)
      const cur = by.get(key) || { key, name: i.name, group, g: 0, portions: 0, rawG: null }
      cur.g += i.g; cur.portions++
      by.set(key, cur)
    }
    if (items.length) potes.push({ date: d.date, meal: m.meal, label: `${WD[new Date(`${d.date}T12:00:00Z`).getUTCDay()]} ${d.date.slice(8, 10)}/${d.date.slice(5, 7)} · ${m.name}`, items })
  }
  const cook = Array.from(by.values()).map(c => {
    const n = ` ${norm(c.name)} `
    const f = c.group === 'proteina' ? MEAT : c.group === 'carbo' ? RAW.find(([re]) => re.test(n))?.[1] ?? null : null
    return { ...c, g: r10(c.g), rawG: f ? r10(c.g / f) : null }
  }).sort((a, b) => ['proteina', 'carbo', 'legume'].indexOf(a.group) - ['proteina', 'carbo', 'legume'].indexOf(b.group) || b.g - a.g)
  const freezeFrom = potes.find(p => p.date > addDays(from, 2))?.date ?? null
  const has = (g: PrepGroup) => cook.some(c => c.group === g)
  const steps = [
    has('proteina') && 'Proteínas primeiro: tempere e leve ao forno ou air fryer (200 °C, 25 a 35 min). Enquanto isso, siga para as panelas.',
    has('carbo') && 'Carboidratos nas panelas (arroz, feijão, batata…), na quantidade crua indicada.',
    has('legume') && 'Legumes no vapor por 5 a 8 min, ainda firmes: terminam de cozinhar quando você esquenta.',
    potes.length > 0 && `Espere amornar e monte ${potes.length} pote${potes.length > 1 ? 's' : ''} com as gramas de cada um (uma balança ajuda).`,
    potes.length > 0 && (freezeFrom ? `Geladeira até 3 dias. Os potes a partir de ${WD[new Date(`${freezeFrom}T12:00:00Z`).getUTCDay()]} ${freezeFrom.slice(8, 10)}/${freezeFrom.slice(5, 7)} vão para o congelador; tire na véspera.` : 'Tudo na geladeira: dura até 3 dias.'),
  ].filter((x): x is string => !!x)
  return { potes, cook, fresh: Array.from(fresh).sort((a, b) => a.localeCompare(b, 'pt-BR')), freezeFrom, steps }
}
