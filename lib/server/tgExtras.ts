// Telegram: água com "+1 copo" (lembrete no ritmo do dia e /agua) e o cardápio de hoje no bom dia,
// com "Lançar" por refeição (SÓ servidor: chave service_role). Tudo só da pessoa da conversa.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Who } from '@/lib/types'
import { homeClock } from '@/lib/dates'
import { dueReminders } from '@/lib/reminders'
import { waterLine } from '@/lib/water'
import { menuFromDb } from '@/lib/cardapio'
import { MEALS, mealTotals } from '@/lib/nutricao'
import { foodAlerts, foodLeftLabel } from '@/lib/caes'
import { addDays, weekStartOf } from '@/lib/dates'
import { urgencyLabel, useSoon, type PantryItem } from '@/lib/despensa'
import { cookLabel } from '@/lib/jantar'
import { balanceLine, weekBalance } from '@/lib/balanco'
import { loadHousehold } from './notify'
import { DEFAULT_NAMES } from '@/lib/constants'
import { ddmm, other, parseGift, upcomingDates, whenLabel, type GiftDate, type GiftIdea } from '@/lib/presentes'
import { loadRemState } from './reminders'
import type { BotDeps, TgReport } from './telegram'

interface Link { id: string, household_id: string, who: Who, chat_id: number }

// ── Água ─────────────────────────────────────────────────────────────
export const cupButton = (ml: number, again = false) => ({ inline_keyboard: [[{ text: again ? `💧 Mais um copo (${ml} ml)` : `💧 +1 copo (${ml} ml)`, callback_data: `agua:${ml}` }]] })

async function waterNow(db: SupabaseClient, link: Link, date: string) {
  const [l, s] = await Promise.all([
    db.from('personal_logs').select('value').eq('household_id', link.household_id).eq('who', link.who).eq('date', date).eq('kind', 'agua'),
    db.from('personal_settings').select('water_goal_ml,cup_ml').eq('household_id', link.household_id).eq('who', link.who).maybeSingle(),
  ])
  const ml = ((l.data || []) as any[]).reduce((a, x) => a + (Number(x.value) || 0), 0)
  return { ml, goal: Number((s.data as any)?.water_goal_ml) || 2000, cup: Number((s.data as any)?.cup_ml) || 250 }
}

/** /agua: como está a água de hoje, com o botão. */
export async function waterStatus(db: SupabaseClient, link: Link, date: string) {
  const w = await waterNow(db, link, date)
  return { text: `💧 Água de hoje: ${waterLine(w.ml, w.goal, w.cup)}`, reply_markup: cupButton(w.cup) }
}

/** Toque em "+1 copo": registra na hora (cada toque é um copo) e devolve o novo total. */
export async function waterTap(db: SupabaseClient, link: Link, ml: number, date: string) {
  const amount = Math.max(50, Math.min(1000, Math.round(ml)))
  const r = await db.from('personal_logs').insert({ household_id: link.household_id, who: link.who, date, kind: 'agua', value: amount, data: { via: 'telegram' } })
  if (r.error) return { ok: false as const, text: '⚠️ Não consegui registrar agora. Tente de novo.' }
  const w = await waterNow(db, link, date)
  return { ok: true as const, text: `💧 +${amount} ml registrado · ${waterLine(w.ml, w.goal, w.cup)}`, reply_markup: cupButton(w.cup, true) }
}

/**
 * Lembretes de água pelo Telegram (agendador de 5 em 5 min): só nas conversas com a água ligada,
 * só quando a pessoa está atrás do ritmo, e cada horário uma vez (registro em telegram_log).
 */
export async function runTelegramWater(deps: BotDeps): Promise<TgReport & { pending?: string }> {
  const now = deps.now ?? new Date(), clock = homeClock(now)
  const report: TgReport & { pending?: string } = { kind: 'agua', day: clock.date, sent: 0, skipped: 0, failed: 0, deactivated: 0, errors: [] }
  const q = await deps.db.from('telegram_links').select('id,household_id,who,chat_id').eq('active', true).eq('agua', true).not('chat_id', 'is', null)
  if (q.error) return { ...report, pending: 'migration 034 ainda não aplicada' }
  const byHouse = new Map<string, Link[]>()
  for (const l of (q.data || []) as Link[]) byHouse.set(l.household_id, [...(byHouse.get(l.household_id) || []), l])
  for (const [hh, links] of Array.from(byHouse.entries())) {
    try {
      const due = dueReminders(await loadRemState(deps.db, hh, now)).filter(r => r.kind === 'agua')
      for (const l of links) for (const r of due.filter(x => x.who === l.who)) {
        const claim = await deps.db.from('telegram_log').insert({ link_id: l.id, kind: 'agua', day: clock.date, ref: r.ref.slice(0, 40) }).select('id').maybeSingle()
        if (claim.error) { if (claim.error.code === '23505') { report.skipped++; continue } throw new Error(claim.error.message) }
        const res = await deps.tg('sendMessage', { chat_id: l.chat_id, text: `${r.title}\n${r.body}`, reply_markup: cupButton(r.water || 250) })
        if (res.ok) { report.sent++; await deps.db.from('telegram_log').update({ status: 'sent' }).eq('id', (claim.data as any).id) }
        else { report.failed++; report.errors.push(`${res.error_code}: ${String(res.description).slice(0, 120)}`); await deps.db.from('telegram_log').update({ status: 'failed', detail: String(res.description).slice(0, 300) }).eq('id', (claim.data as any).id) }
      }
    } catch (e: any) { report.failed++; report.errors.push(`casa: ${String(e?.message || e).slice(0, 160)}`) }
  }
  return report
}

// ── Cardápio de hoje no bom dia ──────────────────────────────────────
async function activeMenu(db: SupabaseClient, link: Pick<Link, 'household_id' | 'who'>) {
  const r = await db.from('personal_menus').select('menu').eq('household_id', link.household_id).eq('who', link.who).eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return r.error || !r.data ? null : menuFromDb((r.data as any).menu)
}

/** Linhas do cardápio de hoje e um botão "Lançar" por refeição (vazio sem cardápio para hoje). */
export async function menuForMorning(db: SupabaseClient, link: Pick<Link, 'household_id' | 'who'>, date: string): Promise<{ text: string, rows: Array<Array<{ text: string, callback_data: string }>> } | null> {
  const day = (await activeMenu(db, link))?.days.find(d => d.date === date)
  if (!day?.meals.length) return null
  const pr = await db.from('personal_food_profile').select('hide_numbers').eq('household_id', link.household_id).eq('who', link.who).maybeSingle()
  const hide = !!(pr.data as any)?.hide_numbers
  const lines = day.meals.map(m => `${MEALS.find(x => x[0] === m.meal)?.[1] || '•'} ${m.name}: ${m.items.map(i => i.name).join(', ')}${hide ? '' : ` (${mealTotals(m.items).kcal} kcal)`}`)
  return { text: `🗓️ Cardápio de hoje\n${lines.join('\n')}`, rows: day.meals.map(m => [{ text: `✓ Lançar ${m.name.toLowerCase()}`, callback_data: `mn:${date}:${m.meal}` }]) }
}

/** Toque em "Lançar <refeição>": registra a refeição do cardápio (uma vez por dia e refeição). */
export async function menuTap(db: SupabaseClient, link: Link, date: string, meal: string, today: string): Promise<string> {
  if (date !== today) return 'Esse cardápio era de outro dia. Abra o app para lançar.'
  const m = (await activeMenu(db, link))?.days.find(d => d.date === date)?.meals.find(x => x.meal === meal)
  if (!m) return 'Essa refeição não está mais no cardápio. Abra o app para ver o atual.'
  const ref = `${date}:${meal}`
  const dup = await db.from('personal_logs').select('id').eq('household_id', link.household_id).eq('who', link.who).eq('date', date).eq('kind', 'refeicao').contains('data', { menu_ref: ref }).limit(1)
  if (dup.data?.length) return `✓ ${m.name} já estava lançado hoje.`
  const kcal = mealTotals(m.items).kcal
  const r = await db.from('personal_logs').insert({ household_id: link.household_id, who: link.who, date, kind: 'refeicao', value: kcal, data: { meal: m.meal, text: `${m.name} (cardápio)`, items: m.items, via: 'telegram', menu_ref: ref } })
  return r.error ? '⚠️ Não consegui lançar agora. Tente de novo.' : `🍽️ ${m.name} lançado (${kcal.toLocaleString('pt-BR')} kcal).`
}

/** Bom dia: ração acabando (até 5 dias). Sem as colunas do estoque, não mostra nada. */
export async function foodLines(db: SupabaseClient, householdId: string, date: string): Promise<string[]> {
  const r = await db.from('dogs').select('id,name,food_g_day,food_stock_kg,food_stock_on').eq('household_id', householdId).eq('active', true).not('food_stock_on', 'is', null)
  if (r.error) return []
  return foodAlerts(((r.data || []) as any[]).map(d => ({ ...d, food_g_day: Number(d.food_g_day) || null })), date, 5).map(a => `🍖 Ração da ${a.dog.name}: ${foodLeftLabel(a.left)}`)
}

// ── Ideias de presente (036) ─────────────────────────────────────────
/** Tabela ainda não criada: o PostgREST responde 404 (PGRST205 nas versões novas, corpo vazio nas antigas). */
const noGiftTable = (e: any, status?: number) => !!e && (status === 404 || e.code === '42P01' || e.code === 'PGRST205' || /gift_(ideas|dates)/.test(e.message || ''))
const GIFT_MISSING = '🎁 As ideias de presente ainda não estão ativas: falta rodar a atualização do banco (migration 036).'

/** "/presente fone azul https://… até R$ 200": anota para a outra, só na lista de quem mandou. */
export async function giftAdd(db: SupabaseClient, link: Link, text: string): Promise<string> {
  const g = parseGift(text)
  if (!g) return '🎁 Escreva o que ela comentou que queria. Ex.: /presente fone sem fio azul\n(só você vê a sua lista)'
  const r = await db.from('gift_ideas').insert({ household_id: link.household_id, who: link.who, for_who: other(link.who), title: g.title, link: g.link, price: g.price }).select('id')
  if (noGiftTable(r.error, r.status)) return GIFT_MISSING
  if (r.error) throw new Error(r.error.message)
  return `🎁 Anotado na sua lista: ${g.title}${g.price ? ` (${g.price})` : ''}${g.link ? ' · com link' : ''}\nSó você vê. No app: Nós › 🎁 Presentes.`
}

/** "/presentes": as ideias em aberto e as próximas datas, só de quem pediu. */
export async function giftList(db: SupabaseClient, link: Link, date: string): Promise<string> {
  const [d, i] = await Promise.all([
    db.from('gift_dates').select('id,who,title,month,day,for_who').eq('household_id', link.household_id).eq('who', link.who),
    db.from('gift_ideas').select('id,who,for_who,title,note,link,price,date_id,status,given_on,created_at').eq('household_id', link.household_id).eq('who', link.who).neq('status', 'dado').order('created_at', { ascending: false }).limit(30),
  ])
  if (noGiftTable(d.error, d.status) || noGiftTable(i.error, i.status)) return GIFT_MISSING
  const dates = (d.data || []) as GiftDate[], ideas = (i.data || []) as GiftIdea[]
  const up = upcomingDates(dates, ideas, date, 60).slice(0, 3).map(u => `📅 ${u.date.title}: ${whenLabel(u.days)} (${ddmm(u.date.month, u.date.day)})`)
  const list = ideas.map(x => `${x.status === 'comprado' ? '🛍️' : '💡'} ${x.title}${x.price ? ` · ${x.price}` : ''}`)
  if (!up.length && !list.length) return '🎁 Sua lista está vazia. Anote com: /presente fone sem fio azul'
  return ['🎁 Sua lista (só você vê)', ...up, ...(up.length && list.length ? [''] : []), ...list].join('\n')
}

// ── Jantar, despensa e balanço (038) ───────────────────────────────
/** Bom dia: o jantar de hoje (e quem cozinha) e o que usar logo da despensa. Sem a migration: nada. */
export async function houseLines(db: SupabaseClient, householdId: string, date: string): Promise<string[]> {
  const [m, p, pr] = await Promise.all([
    db.from('house_meals').select('title,cook').eq('household_id', householdId).eq('date', date).eq('meal', 'jantar').maybeSingle(),
    db.from('pantry_items').select('id,name,place,qty,expires_on').eq('household_id', householdId).eq('active', true).not('expires_on', 'is', null).lte('expires_on', addDays(date, 3)),
    db.from('profiles').select('display_name,role').eq('household_id', householdId),
  ])
  const prof = (pr.data || []) as any[]
  const names: Record<Who, string> = { g: prof.find(x => x.role === 'g')?.display_name || DEFAULT_NAMES.g, s: prof.find(x => x.role === 's')?.display_name || DEFAULT_NAMES.s }
  const out: string[] = []
  if (!m.error && m.data) out.push(`🍲 Jantar de hoje: ${(m.data as any).title} (cozinha: ${cookLabel((m.data as any).cook, names)})`)
  if (!p.error) { const soon = useSoon((p.data || []) as PantryItem[], date); if (soon.length) out.push(`⏰ Usar logo: ${soon.slice(0, 4).map(i => `${i.name} (${urgencyLabel(i, date)})`).join(', ')}`) }
  return out
}

/** Domingo: o balanço da semana (esforço de cada uma, cozinha e compromissos). */
export async function balanceText(db: SupabaseClient, householdId: string, date: string): Promise<string | null> {
  const h = await loadHousehold(db, householdId, date)
  const ws = weekStartOf(date)
  const [m, e] = await Promise.all([
    db.from('house_meals').select('id,date,meal,title,cook,recipe_id,ingredients,notes').eq('household_id', householdId).gte('date', ws).lte('date', date),
    db.from('house_events').select('id,kind,title,date,time,end_time,who,done_at').eq('household_id', householdId).gte('date', ws).lte('date', date),
  ])
  const b = weekBalance({ tasks: h.tasks, dogs: h.dogs, meals: (m.error ? [] : m.data || []) as any[], events: (e.error ? [] : e.data || []) as any[], anyDay: date, today: date })
  return b.verdict === 'vazio' ? null : `⚖️ ${balanceLine(b, h.names, false).replace('; esta semana o rodízio compensa.', '; a próxima semana o rodízio compensa.')}`
}
