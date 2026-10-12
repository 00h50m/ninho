// Telegram em texto livre: o que a IA pode propor e como conferir antes de gravar.
// Puro (sem rede/banco), testado. A IA só PROPÕE ações; a pessoa confirma e o
// servidor grava, sempre na casa e em nome de quem está na conversa.
import type { Names, Who } from './types'
import { addDays, dowOf } from './dates'
import { HEALTH_KINDS, type HealthKind } from './caes'
import { KINDS as EVENT_KINDS, type EventKind } from './agenda'
import { endOf, type DayItem } from './organizar'
import { MEALS, findFood, itemFor, mealForTime, mealTotals, parseMeal, type Meal, type MealItem } from './nutricao'

export type AiAction =
  | { type: 'compras', items: Array<{ title: string, qty: string | null }> }
  | { type: 'saude_cao', dogs: string[], kind: HealthKind, title: string, date: string, next_date: string | null, weight_kg: number | null }
  | { type: 'agenda', kind: EventKind, title: string, date: string, time: string | null, who: Who | 'both' }
  | { type: 'tarefa_feita', task_id: string, title: string }
  | { type: 'agua', ml: number }
  | { type: 'remedio_tomado', med_id: string, name: string, time: string | null }
  | { type: 'refeicao', meal: Meal, items: MealItem[] }
  | { type: 'dia', items: DayItem[] }
  /** foto do rótulo: cadastra em Meus alimentos (ou atualiza um "para conferir", que fica conferido) */
  | { type: 'alimento', food_id: string | null, name: string, portion: string, portion_g: number, kcal: number, protein: number | null, carb: number | null, fat: number | null }

export interface AiContext {
  today: string, hm: string, me: Who, names: Names
  dogs: Array<{ id: string, name: string }>
  /** pendentes de hoje que podem ser concluídas pelo Telegram */
  tasks: Array<{ id: string, title: string }>
  /** remédios ativos de quem está na conversa */
  meds: Array<{ id: string, name: string, times: string[] }>
  cupMl: number
}

const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const first = (n: string) => (n || '').split(' ')[0]

/** Instruções fixas (iguais em todo pedido: ficam em cache). */
export const SYSTEM = `Você interpreta mensagens curtas, em português do Brasil, enviadas ao bot do Ninho (o app da casa de duas pessoas e duas cachorras).
Transforme a mensagem em ações do app, usando só os tipos do formato de resposta:
- compras: itens para a lista de compras (separe quantidade quando houver, ex.: "2 kg arroz" → title "arroz", qty "2 kg").
- saude_cao: cuidado de saúde já feito com as cachorras (vacina, vermífugo, antipulgas, medicamento, consulta, banho, peso, outro). "dogs" usa os nomes da lista; "as duas" ou sem nome claro com duas cachorras = as duas. "date" é quando foi feito. Preencha "next_date" só se a pessoa disser a próxima data. "weight_kg" só para peso.
- agenda: compromisso da casa com data (consulta_caes, visita, entrega, servico, compromisso, vencimento). Pedidos como "lembra a Sabrina de pagar a internet sexta" viram agenda (vencimento ou compromisso) para a pessoa citada ("who": g, s ou both). Horário "HH:MM" só se dito.
- tarefa_feita: a pessoa diz que fez uma tarefa da lista de pendentes de hoje; use exatamente o id da lista. Se nenhuma combinar, não invente.
- agua: água que a pessoa bebeu, em ml ("um copo" = tamanho do copo informado; "uma garrafa" = 500 ml).
- remedio_tomado: a pessoa tomou um remédio da lista dela; use o id da lista e o horário da dose mais próxima.
- refeicao: o que a pessoa comeu. "kind" = cafe, almoco, lanche, jantar, ceia ou outro (pelo que ela disser; senão pelo horário). Em "items", cada alimento com "title" simples ("arroz branco", "ovo"), "qty" como ela disse ("2 unidades", "1 concha"), "grams" = estimativa em gramas (ml para bebidas) e "kcal" = estimativa de calorias dessa quantidade (tabela TACO).
Datas sempre em AAAA-MM-DD, calculadas a partir de "hoje" (ex.: "sexta" = a próxima sexta, ou hoje se hoje for sexta; "ontem" = hoje menos 1).
Se a mensagem for só conversa, pergunta ou algo que o app não faz (finanças, diagnóstico de saúde, montar dieta), devolva "actions" vazia e uma resposta curta e gentil em "reply" dizendo o que o bot sabe fazer.
Nunca invente itens, nomes, ids ou datas que a mensagem não sustenta. Em caso de dúvida real, prefira não incluir a ação e explique em "reply".`

const nullable = (t: string) => ({ type: [t, 'null'] })
/** Formato da resposta (saída estruturada: o JSON vem sempre neste formato). */
export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actions', 'reply'],
  properties: {
    reply: nullable('string'),
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'items', 'dogs', 'kind', 'title', 'date', 'next_date', 'weight_kg', 'time', 'who', 'id', 'ml'],
        properties: {
          type: { type: 'string', enum: ['compras', 'saude_cao', 'agenda', 'tarefa_feita', 'agua', 'remedio_tomado', 'refeicao'] },
          items: { type: ['array', 'null'], items: { type: 'object', additionalProperties: false, required: ['title', 'qty', 'grams', 'kcal'], properties: { title: { type: 'string' }, qty: nullable('string'), grams: nullable('number'), kcal: nullable('number') } } },
          dogs: { type: ['array', 'null'], items: { type: 'string' } },
          kind: nullable('string'),
          title: nullable('string'),
          date: nullable('string'),
          next_date: nullable('string'),
          weight_kg: nullable('number'),
          time: nullable('string'),
          who: nullable('string'),
          id: nullable('string'),
          ml: nullable('number'),
        },
      },
    },
  },
} as const

/** Contexto do pedido (muda a cada mensagem: vai depois das instruções fixas). */
export function contextText(c: AiContext): string {
  const lines = [
    `Hoje: ${c.today} (${WD[dowOf(c.today)]}), ${c.hm}. Quem escreve: ${first(c.names[c.me])} (${c.me}). A outra pessoa: ${first(c.names[c.me === 'g' ? 's' : 'g'])} (${c.me === 'g' ? 's' : 'g'}).`,
    `Cachorras: ${c.dogs.map(d => d.name).join(', ') || 'nenhuma cadastrada'}.`,
    `Tamanho do copo de ${first(c.names[c.me])}: ${c.cupMl} ml.`,
    `Pendentes de hoje (id · nome):${c.tasks.length ? '' : ' nenhuma'}`,
    ...c.tasks.slice(0, 40).map(t => `- ${t.id} · ${t.title}`),
    `Remédios de ${first(c.names[c.me])} (id · nome · horários):${c.meds.length ? '' : ' nenhum'}`,
    ...c.meds.map(m => `- ${m.id} · ${m.name} · ${m.times.join(', ') || 'sem horário'}`),
  ]
  return lines.join('\n')
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z'))
const isTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
const str = (s: unknown, max: number) => typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : ''
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Confere o que a IA propôs: só tipos conhecidos, datas plausíveis, ids que existem
 * no contexto e limites de tamanho. O que não passa é descartado (não é corrigido).
 */
export function validate(raw: unknown, c: AiContext): { actions: AiAction[], reply: string | null, dropped: number } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as any
  const list: any[] = Array.isArray(r.actions) ? r.actions.slice(0, 12) : []
  const out: AiAction[] = []
  const minDate = addDays(c.today, -60), maxDate = addDays(c.today, 400)
  const okDate = (d: unknown, past = false) => isDate(d) && d >= minDate && d <= maxDate && (!past || d <= c.today)
  for (const a of list) {
    if (!a || typeof a !== 'object') continue
    if (a.type === 'compras') {
      const items = (Array.isArray(a.items) ? a.items : []).map((i: any) => ({ title: str(i?.title, 80), qty: str(i?.qty, 20) || null })).filter((i: any) => i.title).slice(0, 20)
      if (items.length) out.push({ type: 'compras', items })
    } else if (a.type === 'saude_cao') {
      const kind = HEALTH_KINDS.some(k => k[0] === a.kind) ? a.kind as HealthKind : null
      const wanted: string[] = (Array.isArray(a.dogs) ? a.dogs : []).map((d: unknown) => norm(String(d || '')))
      const both = wanted.some(w => /^(as duas|ambas|todas|as cachorras|duas)$/.test(w)) || (!wanted.length && c.dogs.length > 0)
      const dogs = both ? c.dogs : c.dogs.filter(d => wanted.includes(norm(d.name)))
      const date = isDate(a.date) ? a.date : c.today
      const weight = typeof a.weight_kg === 'number' && a.weight_kg > 0 && a.weight_kg < 200 ? Math.round(a.weight_kg * 100) / 100 : null
      if (!kind || !dogs.length || !okDate(date, true) || (kind === 'peso' && !weight)) continue
      const next = okDate(a.next_date) && a.next_date > date ? a.next_date as string : null
      out.push({ type: 'saude_cao', dogs: dogs.map(d => d.id), kind, title: str(a.title, 80) || HEALTH_KINDS.find(k => k[0] === kind)![2], date, next_date: next, weight_kg: kind === 'peso' ? weight : null })
    } else if (a.type === 'agenda') {
      const kind = EVENT_KINDS.some(k => k[0] === a.kind) ? a.kind as EventKind : 'compromisso'
      const title = str(a.title, 80)
      if (!title || !okDate(a.date) || a.date < c.today) continue
      const who = a.who === 'g' || a.who === 's' ? a.who as Who : 'both'
      out.push({ type: 'agenda', kind, title, date: a.date, time: isTime(a.time) ? a.time : null, who })
    } else if (a.type === 'tarefa_feita') {
      const t = c.tasks.find(x => x.id === a.id)
      if (t && !out.some(o => o.type === 'tarefa_feita' && o.task_id === t.id)) out.push({ type: 'tarefa_feita', task_id: t.id, title: t.title })
    } else if (a.type === 'agua') {
      const ml = typeof a.ml === 'number' ? Math.round(a.ml) : 0
      if (ml >= 50 && ml <= 3000) out.push({ type: 'agua', ml })
    } else if (a.type === 'remedio_tomado') {
      const m = c.meds.find(x => x.id === a.id)
      if (m) out.push({ type: 'remedio_tomado', med_id: m.id, name: m.name, time: isTime(a.time) && m.times.includes(a.time) ? a.time : nearestDose(m.times, c.hm) })
    } else if (a.type === 'refeicao') {
      const items = (Array.isArray(a.items) ? a.items : []).slice(0, 20).map(aiMealItem).filter((x: MealItem | null): x is MealItem => !!x)
      if (items.length) out.push({ type: 'refeicao', meal: MEALS.some(m => m[0] === a.kind) ? a.kind as Meal : mealForTime(c.hm), items })
    }
  }
  return { actions: out, reply: str(r.reply, 600) || null, dropped: list.length - out.length }
}

/** Item de refeição vindo da IA: tabela do Ninho quando reconhece; senão a estimativa da IA. */
export function aiMealItem(i: any): MealItem | null {
  const title = str(i?.title, 80)
  if (!title) return null
  const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null
  const grams = num(i?.grams, 1, 2000), kcal = num(i?.kcal, 0, 3000), qty = str(i?.qty, 30)
  const m = findFood(title)
  if (m && grams) return itemFor(m.food, grams, m.food.liquid ? 'ml' : 'g', `${qty} ${title}`.trim())
  if (m) { const [x] = parseMeal(`${qty || '1'} ${title}`); if (x?.food_id) return x }
  return { name: title, food_id: null, qty: 1, unit: 'g', g: Math.round(grams || 0), kcal: Math.round(kcal || 0), p: 0, c: 0, f: 0, text: `${qty} ${title}`.trim(), guess: true }
}

/** O dia organizado, um item por linha, para conferir no Telegram. */
export function describeDay(items: DayItem[], today: string): string {
  const ic = (i: DayItem) => i.kind === 'compromisso' ? '📅' : i.kind === 'compra' ? '🛒' : i.priority === 'alta' ? '❗' : '✓'
  const day = (d: string) => d === today ? '' : ' (amanhã)'
  return ['🗓️ Seu dia:', ...items.map(i => `   ${i.time ? `${i.time}–${endOf(i)}` : '—'} ${ic(i)} ${i.title}${day(i.date)}${i.who === 'both' ? ' · as duas' : ''}`)].join('\n')
}

/** Linha da refeição para conferir (texto e foto). */
export function describeMeal(a: { meal: Meal, items: MealItem[] }): string {
  const label = MEALS.find(m => m[0] === a.meal)?.[2] || 'Refeição'
  return `🍽️ ${label}: ${a.items.map(i => `${i.name}${i.g ? ` (${i.g} g)` : ''}`).join(', ')} · ≈ ${mealTotals(a.items).kcal.toLocaleString('pt-BR')} kcal`
}

/** Dose mais próxima do horário (para "tomei a vitamina"). */
export function nearestDose(times: string[], hm: string): string | null {
  if (!times.length) return null
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  return [...times].sort((a, b) => Math.abs(m(a) - m(hm)) - Math.abs(m(b) - m(hm)))[0]
}

const fmt = (d: string, today: string) => d === today ? 'hoje' : d === addDays(today, 1) ? 'amanhã' : d === addDays(today, -1) ? 'ontem'
  : d > addDays(today, 60) || d < addDays(today, -7) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : `${WD[dowOf(d)]} ${d.slice(8, 10)}/${d.slice(5, 7)}`

/** Uma linha por ação, para a pessoa conferir antes de confirmar. */
export function describe(actions: AiAction[], c: AiContext): string[] {
  const dogName = (id: string) => c.dogs.find(d => d.id === id)?.name || 'cachorra'
  const whoTxt = (w: Who | 'both') => w === 'both' ? 'as duas' : first(c.names[w])
  return actions.map(a => {
    switch (a.type) {
      case 'compras': return `🛒 Lista de compras: ${a.items.map(i => i.title + (i.qty ? ` (${i.qty})` : '')).join(', ')}`
      case 'saude_cao': {
        const k = HEALTH_KINDS.find(x => x[0] === a.kind)!
        return `${k[1]} ${a.dogs.map(dogName).join(' e ')}: ${a.title}${a.weight_kg ? ` ${String(a.weight_kg).replace('.', ',')} kg` : ''} · ${fmt(a.date, c.today)}${a.next_date ? ` · próxima ${fmt(a.next_date, c.today)}` : ''}`
      }
      case 'agenda': {
        const k = EVENT_KINDS.find(x => x[0] === a.kind)!
        return `${k[1]} Agenda: ${a.title} · ${fmt(a.date, c.today)}${a.time ? ` às ${a.time}` : ''} · ${whoTxt(a.who)}`
      }
      case 'tarefa_feita': return `✓ Concluir: ${a.title}`
      case 'agua': return `💧 Água: +${a.ml} ml`
      case 'remedio_tomado': return `💊 Tomei: ${a.name}${a.time ? ` (dose das ${a.time})` : ''}`
      case 'refeicao': return describeMeal(a)
      case 'dia': return describeDay(a.items, c.today)
      case 'alimento': return describeFood(a)
    }
  })
}

const n1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
/** "🥗 Meus alimentos: Iogurte… · 1 pote (100 g) · 58 kcal · 6,2 g de proteína" */
export function describeFood(a: Extract<AiAction, { type: 'alimento' }>): string {
  return `🥗 ${a.food_id ? 'Conferir em' : 'Cadastrar em'} Meus alimentos: ${a.name} · ${a.portion} (${n1(a.portion_g)} g) · ${Math.round(a.kcal)} kcal` +
    `${a.protein != null ? ` · ${n1(a.protein)} g de proteína` : ''}${a.carb != null ? ` · ${n1(a.carb)} g de carboidrato` : ''}${a.fat != null ? ` · ${n1(a.fat)} g de gordura` : ''}`
}
