// Ideias de presente (migration 036): cada uma anota o que a outra comentou que queria e as
// datas especiais; o Ninho lembra antes (14 e 3 dias, e no dia). Tudo é só da dona — a outra
// não vê (é surpresa). Puro, testado.
import { dayNum } from './dates'
import type { Who } from './types'

export type GiftStatus = 'ideia' | 'comprado' | 'dado'
export interface GiftDate { id: string, who: Who, title: string, month: number, day: number, for_who: Who | 'both' | null }
export interface GiftIdea {
  id: string, who: Who, for_who: Who, title: string, note: string | null, link: string | null, price: string | null
  date_id: string | null, status: GiftStatus, given_on: string | null, created_at: string
}

export const STATUS_LABEL: Record<GiftStatus, string> = { ideia: '💡 Ideia', comprado: '🛍️ Comprado', dado: '🎁 Já dei' }
export const other = (w: Who): Who => w === 'g' ? 's' : 'g'

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
/** Próxima vez que a data cai, a partir de hoje (29/02 vira 28/02 em ano que não é bissexto). */
export function nextOccurrence(month: number, day: number, today: string): string {
  const at = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(month === 2 && day === 29 && !isLeap(y) ? 28 : day).padStart(2, '0')}`
  const y = Number(today.slice(0, 4))
  return at(y) >= today ? at(y) : at(y + 1)
}
export const daysUntil = (date: string, today: string) => dayNum(date) - dayNum(today)

export interface Upcoming { date: GiftDate, on: string, days: number, ideas: number }
/** Datas dos próximos `within` dias (a mais perto primeiro), com quantas ideias ainda não dadas cada uma tem. */
export function upcomingDates(dates: GiftDate[], ideas: GiftIdea[], today: string, within = 366): Upcoming[] {
  return dates.map(d => {
    const on = nextOccurrence(d.month, d.day, today)
    return { date: d, on, days: daysUntil(on, today), ideas: ideas.filter(i => i.date_id === d.id && i.status !== 'dado').length }
  }).filter(u => u.days <= within).sort((a, b) => a.days - b.days || a.date.title.localeCompare(b.date.title, 'pt-BR'))
}

export const whenLabel = (days: number) => days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`
const ideasLine = (n: number) => n === 0 ? 'Nenhuma ideia anotada ainda.' : n === 1 ? '1 ideia anotada.' : `${n} ideias anotadas.`

/** Dias antes da data em que o Ninho lembra. */
export const REMIND_AT = [14, 3, 0]
/** Lembretes do dia (às 9h) para a dona de cada data. */
export function giftReminders(dates: GiftDate[], ideas: GiftIdea[], today: string): Array<{ who: Who, ref: string, title: string, body: string }> {
  return upcomingDates(dates, ideas, today, 14).filter(u => REMIND_AT.includes(u.days)).map(u => {
    const mine = ideas.filter(i => i.who === u.date.who)
    const pending = u.ideas || mine.filter(i => !i.date_id && i.status === 'ideia' && (u.date.for_who == null || u.date.for_who === 'both' || i.for_who === u.date.for_who)).length
    return {
      who: u.date.who, ref: `presente:${u.date.id}:${u.on}:${u.days}`,
      title: `🎁 ${u.date.title} ${whenLabel(u.days)}`,
      body: u.days === 0 ? 'É hoje! 💛' : ideasLine(pending) + (u.days === 14 ? ' Dá tempo de comprar com calma.' : ''),
    }
  })
}

/** Link conferido: só http(s), até 500 letras. */
export function cleanLink(v: string | null | undefined): string | null {
  const s = (v || '').trim()
  return /^https?:\/\/\S+$/i.test(s) && s.length <= 500 ? s : null
}

/** "/presente fone azul https://loja… R$ 200" → o quê, link e faixa de preço. */
export function parseGift(text: string): { title: string, link: string | null, price: string | null } | null {
  let t = text.replace(/\s+/g, ' ').trim()
  const url = t.match(/https?:\/\/\S+/i)?.[0] || null
  if (url) t = t.replace(url, ' ')
  const price = t.match(/(?:(?:até|uns|umas|cerca de)\s+)?(?:R\$\s?\d[\d.,]*|\d[\d.,]*\s*reais)/i)?.[0]?.trim() || null
  if (price) t = t.replace(price, ' ')
  const title = t.replace(/\s+/g, ' ').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').slice(0, 120)
  return title ? { title, link: cleanLink(url), price: price ? price.slice(0, 40) : null } : null
}

/** Sugestões de datas para adicionar com um toque. */
export function dateIdeas(names: Record<Who, string>, me: Who, existing: GiftDate[]): Array<{ title: string, month: number | null, day: number | null, for_who: Who | 'both' | null }> {
  const o = other(me), first = (n: string) => (n || '').split(' ')[0]
  const list = [
    { title: `Aniversário da ${first(names[o])}`, month: null, day: null, for_who: o as Who | 'both' | null },
    { title: 'Aniversário de namoro', month: null, day: null, for_who: 'both' as const },
    { title: 'Dia dos Namorados', month: 6, day: 12, for_who: 'both' as const },
    { title: 'Natal', month: 12, day: 25, for_who: null },
  ]
  const has = new Set(existing.map(d => d.title.trim().toLowerCase()))
  return list.filter(x => !has.has(x.title.toLowerCase()))
}

/** Ideias em ordem: as da data mais perto primeiro, depois as mais novas; "já dei" fica no histórico. */
export function sortIdeas(ideas: GiftIdea[], dates: GiftDate[], today: string): GiftIdea[] {
  const when = new Map(dates.map(d => [d.id, daysUntil(nextOccurrence(d.month, d.day, today), today)]))
  const k = (i: GiftIdea) => i.date_id && when.has(i.date_id) ? when.get(i.date_id)! : 9999
  return ideas.slice().sort((a, b) => k(a) - k(b) || b.created_at.localeCompare(a.created_at))
}

export const ddmm = (month: number, day: number) => `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
/** "Já dei" guardado com a data de hoje (para não repetir presente). */
export const givenPatch = (today: string) => ({ status: 'dado' as const, given_on: today })
export const sinceLabel = (date: string, today: string) => { const d = daysUntil(today, date) * -1; return d < 31 ? 'este mês' : d < 365 ? `há ${Math.round(d / 30)} meses` : `há ${Math.round(d / 365)} ano(s)` }
