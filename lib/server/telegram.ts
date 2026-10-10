// Bot do Telegram (SÓ servidor: usa a chave service_role).
// · /start CÓDIGO liga a conversa à pessoa (código gerado no app, vale 30 min)
// · /hoje mostra o que é seu hoje, com botões ✓ para concluir
// · /compras lista; "/compras leite, 2 kg arroz" ou "+leite" adiciona
// · /feito louça conclui pelo nome · /dicas pede sugestões à IA · /sair desliga
// · Bom dia e resumo de domingo também chegam aqui (mesmo texto do celular)
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Who } from '@/lib/types'
import { homeClock } from '@/lib/dates'
import { planToday } from '@/lib/today'
import { dogKey, isWho } from '@/lib/rotation'
import { hhmm } from '@/lib/dates'
import { dueForPerson, type MaintenanceItem } from '@/lib/maintenance'
import { SHOP_CATS, guessCategory, normalize, parseEntry } from '@/lib/shopping'
import { loadHousehold, morningPayloads, must, weeklyPayload } from './notify'
import { execute as executeAi, type Understood } from './telegramAi'
import type { AiAction } from '@/lib/telegramAi'

export type TgResponse = { ok: boolean, result?: any, description?: string, error_code?: number }
export type TgCall = (method: string, body: Record<string, unknown>) => Promise<TgResponse>

export interface BotDeps {
  db: SupabaseClient
  tg: TgCall
  now?: Date
  /** Sugestões da IA (opcional: sem ANTHROPIC_API_KEY o comando /dicas avisa). */
  tips?: (householdId: string) => Promise<{ ok: true, text: string } | { ok: false, message: string }>
  /** Texto livre interpretado pela IA (opcional: sem a chave, o bot só entende comandos). */
  understand?: (link: { id: string, household_id: string, who: Who, chat_id: number }, text: string) => Promise<Understood>
}

interface Link { id: string, household_id: string, who: Who, chat_id: number, morning: boolean, weekly: boolean, active: boolean }

const first = (n: string) => (n || '').split(' ')[0]

/** Menu fixo embaixo do teclado (botões viram os comandos). */
export const MENU = {
  keyboard: [
    [{ text: '📋 Hoje' }, { text: '🛒 Compras' }],
    [{ text: '➕ Adicionar à lista' }, { text: '✦ Dicas' }],
    [{ text: '❓ Ajuda' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: 'Toque numa opção ou digite',
}

/** Texto do botão do menu → comando. */
export function menuCommand(text: string): string | null {
  if (text.trim().startsWith('/')) return null // comandos digitados seguem o caminho normal
  const t = text.replace(/^[^A-Za-zÀ-ÿ]+/, '').trim().toLowerCase()
  if (t === 'hoje') return '/hoje'
  if (t === 'compras') return '/compras'
  if (t === 'adicionar à lista' || t === 'adicionar a lista') return '/adicionar'
  if (t === 'dicas') return '/dicas'
  if (t === 'ajuda' || t === 'menu') return '/ajuda'
  return null
}

/** Pergunta do "Adicionar à lista" (a resposta a ela vira itens da lista). */
export const ADD_PROMPT = 'O que vai na lista? Mande os itens separados por vírgula (ex.: leite, 2 kg arroz, café).'

export const HELP = [
  'Escreva do seu jeito, por exemplo: “comprei leite e café”, “a Zelda tomou a V10 hoje”, “lembra a Sabrina de pagar a internet sexta”, “bebi um copo de água”, “lavei a louça”. Eu mostro o que entendi e você confirma.',
  '',
  'Ou use o menu aqui embaixo e os comandos:',
  '/hoje — o que é seu hoje (com botões para concluir)',
  '/feito louça — conclui uma tarefa pelo nome',
  '/compras — a lista de compras',
  '/compras leite, 2 kg arroz — adiciona itens (ou mande "+leite")',
  '/dicas — sugestões da IA para a semana',
  '/menu — mostra o menu de novo',
  '/sair — desliga esta conversa do Ninho',
].join('\n')

const send = (deps: BotDeps, chatId: number, text: string, extra: Record<string, unknown> = {}) =>
  deps.tg('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra })

async function linkOf(db: SupabaseClient, chatId: number): Promise<Link | null> {
  const r = await db.from('telegram_links').select('*').eq('chat_id', chatId).eq('active', true).maybeSingle()
  return (must(r, 'vínculo') as Link | null)
}

async function namesOf(db: SupabaseClient, householdId: string) {
  const rows = must(await db.from('profiles').select('display_name,role').eq('household_id', householdId), 'nomes') as any[]
  return { g: rows.find(p => p.role === 'g')?.display_name || 'Giovanna', s: rows.find(p => p.role === 's')?.display_name || 'Sabrina' }
}

// ── Ligar a conversa ────────────────────────────────────────────────────

async function start(deps: BotDeps, chatId: number, code: string) {
  const c = code.trim().toUpperCase()
  if (!c) {
    const l = await linkOf(deps.db, chatId)
    if (l) return send(deps, chatId, `Esta conversa já está ligada ao Ninho. ✅\n\n${HELP}`, { reply_markup: MENU })
    return send(deps, chatId, 'Oi! Para ligar esta conversa ao Ninho, abra o app › Ajustes › Telegram › Conectar.')
  }
  const r = await deps.db.from('telegram_links').select('*').eq('link_code', c).maybeSingle()
  const link = must(r, 'código') as (Link & { code_expires_at: string | null }) | null
  if (!link || !link.code_expires_at || new Date(link.code_expires_at).getTime() < (deps.now ?? new Date()).getTime()) {
    return send(deps, chatId, 'Esse código não vale mais. Gere outro no app (Ajustes › Telegram › Conectar) e tente de novo.')
  }
  // Uma conversa liga a uma pessoa só: solta vínculos antigos desta conversa
  must(await deps.db.from('telegram_links').delete().eq('chat_id', chatId).neq('id', link.id).select('id'), 'vínculo antigo')
  must(await deps.db.from('telegram_links').update({ chat_id: chatId, linked_at: new Date().toISOString(), link_code: null, code_expires_at: null, active: true }).eq('id', link.id).select('id'), 'ligar')
  const names = await namesOf(deps.db, link.household_id)
  return send(deps, chatId, `Pronto, ${first(names[link.who])}! 🪺 Esta conversa está ligada ao Ninho.\nVocê vai receber o bom dia e o resumo de domingo aqui também.\n\n${HELP}`, { reply_markup: MENU })
}

// ── /hoje ───────────────────────────────────────────────────────────────

interface TodayView { text: string, buttons: Array<Array<{ text: string, callback_data: string }>> }

export async function todayView(db: SupabaseClient, link: Link, date: string): Promise<TodayView> {
  const h = await loadHousehold(db, link.household_id, date)
  const plan = planToday(h.tasks, h.dogs, date, { focus: h.focus, split: h.split })
  const mine = plan.items.filter(i => plan.ownerOfItem(i) === link.who)
  const pend = mine.filter(i => !i.completed_today).sort((a, b) => (hhmm(a.scheduled_time) || '99').localeCompare(hhmm(b.scheduled_time) || '99'))
  const maint = dueForPerson(h.maint as MaintenanceItem[], link.who, date)
  const name = first(h.names[link.who])
  const done = mine.length - pend.length
  const lines: string[] = []
  if (!pend.length && !maint.length) lines.push(`🎉 ${name}, nada pendente para você hoje.${done ? ` (${done} feita${done === 1 ? '' : 's'})` : ''}`)
  else {
    lines.push(`☀️ ${name}, hoje: ${pend.length} pendente${pend.length === 1 ? '' : 's'}${done ? ` · ${done} feita${done === 1 ? '' : 's'}` : ''}`)
    pend.forEach(i => {
      const title = i.task ? i.task.title : i.dog!.title
      const extra = [i.scheduled_time ? `⏰ ${hhmm(i.scheduled_time)}` : '', i.essential ? 'essencial' : '', i.dog ? `🐾 ${i.dog.parts.map(p => p.dog.name).join(', ')}` : ''].filter(Boolean).join(' · ')
      lines.push(`• ${title}${extra ? ` (${extra})` : ''}`)
    })
    maint.forEach(m => lines.push(`🔧 ${m.title}${m.next_due < date ? ' (atrasada)' : ''}`))
  }
  const buttons = [
    ...pend.slice(0, 10).map(i => [{ text: `✓ ${(i.task ? i.task.title : i.dog!.title).slice(0, 40)}`, callback_data: i.task ? `t:${i.task.id}` : `d:${i.dog!.parts[0].r.id}` }]),
    ...maint.slice(0, 3).map(m => [{ text: `✓ 🔧 ${m.title.slice(0, 36)}`, callback_data: `m:${m.id}` }]),
  ]
  return { text: lines.join('\n'), buttons }
}

async function sendToday(deps: BotDeps, link: Link, date: string) {
  const v = await todayView(deps.db, link, date)
  return send(deps, link.chat_id, v.text, v.buttons.length ? { reply_markup: { inline_keyboard: v.buttons } } : {})
}

// ── Concluir ────────────────────────────────────────────────────────────

/** Conclui um item da casa em nome da pessoa. Confere que o item é da mesma casa. */
export async function completeItem(db: SupabaseClient, link: Link, kind: 't' | 'd' | 'm', id: string, date: string): Promise<string> {
  if (kind === 't') {
    const t = must(await db.from('tasks').select('id,title,household_id').eq('id', id).maybeSingle(), 'tarefa') as any
    if (!t || t.household_id !== link.household_id) return 'Essa tarefa não existe mais.'
    const r = must(await db.rpc('ninho_complete_task', { p_task_id: id, p_date: date, p_by: link.who }), 'concluir') as any
    return r.created ? `✓ ${t.title} · +${r.xp} XP${r.on_time ? ' ⚡ no horário' : ''}` : `${t.title} já estava feita.`
  }
  if (kind === 'm') {
    const m = must(await db.from('maintenance_items').select('id,title,household_id').eq('id', id).maybeSingle(), 'manutenção') as any
    if (!m || m.household_id !== link.household_id) return 'Essa manutenção não existe mais.'
    const r = must(await db.rpc('ninho_complete_maintenance', { p_item_id: id, p_date: date, p_by: link.who }), 'concluir manutenção') as any
    return r.created ? `✓ 🔧 ${m.title} · +${r.xp} XP` : `${m.title} já estava registrada hoje.`
  }
  // Rotina dos cães: conclui a mesma rotina de todos os cães (como no app)
  const h = await loadHousehold(db, link.household_id, date)
  const all = h.dogs.flatMap(dg => dg.routines.map(r => ({ r, dog: dg })))
  const base = all.find(x => x.r.id === id)
  if (!base) return 'Essa rotina não existe mais.'
  const ids = all.filter(x => dogKey(x.r) === dogKey(base.r) && !x.r.completed_today).map(x => x.r.id)
  if (!ids.length) return `${base.r.title} já estava feita.`
  const r = must(await db.rpc('ninho_complete_dog_routines', { p_routine_ids: ids, p_date: date, p_by: link.who }), 'concluir rotina') as any
  return `✓ ${base.r.title} · +${r.xp_added} XP${r.on_time ? ' ⚡ no horário' : ''}`
}

async function doneByName(deps: BotDeps, link: Link, arg: string, date: string) {
  const q = normalize(arg)
  if (!q) return send(deps, link.chat_id, 'Diga o nome: /feito louça')
  const h = await loadHousehold(deps.db, link.household_id, date)
  const plan = planToday(h.tasks, h.dogs, date, { focus: false, split: h.split })
  const pend = plan.items.filter(i => !i.completed_today)
  const title = (i: typeof pend[number]) => i.task ? i.task.title : i.dog!.title
  const hits = pend.filter(i => normalize(title(i)).includes(q))
    .sort((a, b) => Number(plan.ownerOfItem(b) === link.who) - Number(plan.ownerOfItem(a) === link.who))
  if (!hits.length) return send(deps, link.chat_id, `Não achei nada pendente hoje com “${arg}”. Veja /hoje.`)
  const exact = hits.filter(i => normalize(title(i)) === q)
  const pick = exact.length === 1 ? exact[0] : hits.length === 1 ? hits[0] : null
  if (!pick) {
    return send(deps, link.chat_id, 'Qual delas?', { reply_markup: { inline_keyboard: hits.slice(0, 6).map(i => [{ text: `✓ ${title(i).slice(0, 40)}`, callback_data: i.task ? `t:${i.task.id}` : `d:${i.dog!.parts[0].r.id}` }]) } })
  }
  const msg = await completeItem(deps.db, link, pick.task ? 't' : 'd', pick.task ? pick.task.id : pick.dog!.parts[0].r.id, date)
  return send(deps, link.chat_id, msg)
}

// ── Compras ─────────────────────────────────────────────────────────────

async function shoppingList(deps: BotDeps, link: Link) {
  const rows = must(await deps.db.from('shopping_items').select('title,qty,category,checked_at').eq('household_id', link.household_id).is('done_at', null), 'lista') as any[]
  const open = rows.filter(r => !r.checked_at)
  if (!open.length) return send(deps, link.chat_id, '🛒 A lista está vazia. Adicione com: /compras leite, pão')
  const lines = [`🛒 Lista de compras (${open.length}):`]
  SHOP_CATS.forEach(([cat, label]) => {
    const items = open.filter(r => (r.category || 'outros') === cat || (cat === 'outros' && !SHOP_CATS.some(([c]) => c === r.category)))
    if (items.length) lines.push('', label, ...items.map(r => `• ${r.title}${r.qty ? ` (${r.qty})` : ''}`))
  })
  return send(deps, link.chat_id, lines.join('\n'))
}

async function shoppingAdd(deps: BotDeps, link: Link, text: string) {
  const entries = text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 20)
  if (!entries.length) return shoppingList(deps, link)
  const added: string[] = [], had: string[] = []
  for (const e of entries) {
    const p = parseEntry(e)
    if (!p.title) continue
    const r = must(await deps.db.rpc('ninho_add_shopping_item', { p_household_id: link.household_id, p_title: p.title.slice(0, 80), p_qty: p.qty, p_category: guessCategory(p.title), p_by: link.who }), 'adicionar item') as any
    ;(r.created || r.reopened ? added : had).push(p.title + (p.qty ? ` (${p.qty})` : ''))
  }
  return send(deps, link.chat_id, [added.length ? `🛒 Na lista: ${added.join(', ')}` : '', had.length ? `Já estava: ${had.join(', ')}` : ''].filter(Boolean).join('\n'))
}

// ── Entrada principal ───────────────────────────────────────────────────

/**
 * Registra o update_id; devolve false se já foi processado (o Telegram reenvia
 * quando a resposta demora). Sem a migration 013, segue sem essa proteção.
 */
async function firstTime(db: SupabaseClient, updateId: unknown): Promise<boolean> {
  if (typeof updateId !== 'number') return true
  const r = await db.from('telegram_updates').insert({ update_id: updateId })
  if (r.error) return r.error.code !== '23505'
  // Faxina ocasional: guarda só os últimos dias
  if (updateId % 50 === 0) await db.from('telegram_updates').delete().lt('created_at', new Date(Date.now() - 3 * 86400000).toISOString())
  return true
}

export async function handleUpdate(deps: BotDeps, update: any): Promise<void> {
  const date = homeClock(deps.now).date
  if (!(await firstTime(deps.db, update?.update_id))) return
  if (update?.callback_query) return onCallback(deps, update.callback_query, date)
  const msg = update?.message
  if (!msg?.chat || typeof msg.text !== 'string') return
  if (msg.chat.type && msg.chat.type !== 'private') return // só conversas privadas
  const chatId = Number(msg.chat.id)
  const text = msg.text.trim()
  const [head] = text.split(/\s+/)
  const fromMenu = menuCommand(text)
  const cmd = fromMenu ?? head.toLowerCase().replace(/@[\w_]+$/, '')
  const arg = fromMenu ? '' : text.slice(head.length).trim()

  if (cmd === '/start') { await start(deps, chatId, arg); return }
  const link = await linkOf(deps.db, chatId)
  if (!link) { await send(deps, chatId, 'Esta conversa ainda não está ligada ao Ninho. No app: Ajustes › Telegram › Conectar.'); return }

  // Resposta à pergunta do "Adicionar à lista"
  if (!cmd.startsWith('/') && String(msg.reply_to_message?.text || '').startsWith(ADD_PROMPT.slice(0, 20))) { await shoppingAdd(deps, link, text); return }

  if (cmd === '/hoje') await sendToday(deps, link, date)
  else if (cmd === '/adicionar') await send(deps, chatId, ADD_PROMPT, { reply_markup: { force_reply: true, input_field_placeholder: 'leite, pão, café' } })
  else if (cmd === '/menu') await send(deps, chatId, 'Menu aberto aqui embaixo. 👇', { reply_markup: MENU })
  else if (cmd === '/compras' || cmd === '/lista') await (arg ? shoppingAdd(deps, link, arg) : shoppingList(deps, link))
  else if (cmd === '/feito') await doneByName(deps, link, arg, date)
  else if (cmd === '/dicas') {
    if (!deps.tips) { await send(deps, chatId, 'A IA ainda não foi configurada no servidor.'); return }
    await deps.tg('sendChatAction', { chat_id: chatId, action: 'typing' })
    const r = await deps.tips(link.household_id)
    await send(deps, chatId, r.ok === true ? `✦ Sugestões da semana\n\n${r.text}` : (r as { message: string }).message)
  } else if (cmd === '/sair') {
    must(await deps.db.from('telegram_links').delete().eq('id', link.id).select('id'), 'desligar')
    await send(deps, chatId, 'Pronto, esta conversa foi desligada do Ninho. Para voltar, gere um código no app.')
  } else if (cmd === '/ajuda' || cmd === '/help') await send(deps, chatId, HELP, { reply_markup: MENU })
  else if (text.startsWith('+')) await shoppingAdd(deps, link, text.slice(1))
  else if (!cmd.startsWith('/') && deps.understand) await freeText(deps, link, text)
  else await send(deps, chatId, `Não entendi. ${HELP}`, { reply_markup: MENU })
}

// ── Texto livre (IA): entende, mostra e só grava depois do "Confirmar" ──

const PENDING_MIN = 30

async function freeText(deps: BotDeps, link: Link, text: string) {
  await deps.tg('sendChatAction', { chat_id: link.chat_id, action: 'typing' })
  let u: Understood
  try { u = await deps.understand!(link, text) }
  catch (e: any) { console.error('[ninho] telegram ia', String(e?.message || e).slice(0, 200)); u = { ok: false, message: 'Não consegui entender agora. Tente de novo ou use /ajuda.' } }
  if (u.ok === false) { await send(deps, link.chat_id, u.message); return }
  if (!u.actions.length) {
    await send(deps, link.chat_id, u.reply || 'Não achei nada para registrar nessa mensagem. Exemplos: “comprei leite”, “a Zelda tomou a V10”, “bebi um copo de água”. Ou use /ajuda.')
    return
  }
  const r = await deps.db.from('telegram_pending').insert({ link_id: link.id, household_id: link.household_id, actions: u.actions }).select('id').single()
  if (r.error) { await send(deps, link.chat_id, 'Não consegui guardar o pedido agora. Tente de novo em instantes.'); return }
  const id = (r.data as any).id as string
  await send(deps, link.chat_id, ['Entendi assim:', ...u.lines.map(l => `• ${l}`), u.reply ? `\n${u.reply}` : '', '', 'Posso registrar?'].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n'), {
    reply_markup: { inline_keyboard: [[{ text: '✅ Confirmar', callback_data: `ok:${id}` }, { text: '✖ Cancelar', callback_data: `no:${id}` }]] },
  })
}

async function decide(deps: BotDeps, cq: any, link: Link, confirm: boolean, id: string) {
  const chatId = link.chat_id, msgId = cq.message?.message_id
  // Muda de "aberto" para a decisão numa única gravação: dois toques não gravam duas vezes
  const since = new Date((deps.now ?? new Date()).getTime() - PENDING_MIN * 60000).toISOString()
  const r = await deps.db.from('telegram_pending').update({ status: confirm ? 'done' : 'cancelled', decided_at: new Date().toISOString() })
    .eq('id', id).eq('link_id', link.id).eq('status', 'open').gte('created_at', since).select('actions').maybeSingle()
  const row = r.data as { actions: AiAction[] } | null
  await deps.tg('answerCallbackQuery', { callback_query_id: cq.id, ...(row ? {} : { text: 'Esse pedido já foi decidido ou expirou.' }) })
  if (!row) { if (msgId) await deps.tg('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } }); return }
  const base = String(cq.message?.text || '').replace(/\n*Posso registrar\?$/, '')
  if (!confirm) {
    if (msgId) await deps.tg('editMessageText', { chat_id: chatId, message_id: msgId, text: `${base}\n\n✖ Cancelado. Nada foi registrado.` })
    return
  }
  const results = await executeAi(deps.db, link, row.actions, deps.now ?? new Date(), completeItem)
  const text = `${base}\n\n✅ Feito:\n${results.map(x => `• ${x}`).join('\n')}`
  if (msgId) await deps.tg('editMessageText', { chat_id: chatId, message_id: msgId, text })
  else await send(deps, chatId, text)
}

async function onCallback(deps: BotDeps, cq: any, date: string) {
  const chatId = Number(cq.message?.chat?.id)
  const data = String(cq.data || '')
  const link = chatId ? await linkOf(deps.db, chatId) : null
  if (!link) { await deps.tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Conversa não ligada ao Ninho.' }); return }
  if (data === 'hoje') {
    await deps.tg('answerCallbackQuery', { callback_query_id: cq.id })
    await sendToday(deps, link, date)
    return
  }
  const dm = data.match(/^(ok|no):([0-9a-f-]{36})$/)
  if (dm) { await decide(deps, cq, link, dm[1] === 'ok', dm[2]); return }
  const m = data.match(/^([tdm]):([0-9a-f-]{36})$/)
  if (!m) { await deps.tg('answerCallbackQuery', { callback_query_id: cq.id }); return }
  const msgId = cq.message?.message_id
  // Resposta imediata: o botão para de "carregar" e some da lista antes do registro
  const kb = cq.message?.reply_markup?.inline_keyboard as Array<Array<{ callback_data?: string }>> | undefined
  await Promise.all([
    deps.tg('answerCallbackQuery', { callback_query_id: cq.id, text: '⏳ Registrando…' }),
    kb && msgId ? deps.tg('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: kb.filter(row => !row.some(b => b.callback_data === data)) } }) : null,
  ])
  // Dois toques seguidos no mesmo botão: o segundo espera o primeiro (mesma instância)
  const key = `${chatId}:${data}`
  if (inflight.has(key)) return
  inflight.add(key)
  let msg: string
  try { msg = await completeItem(deps.db, link, m[1] as 't' | 'd' | 'm', m[2], date) }
  catch { msg = '⚠️ Não consegui registrar agora. Tente de novo.' }
  finally { inflight.delete(key) }
  // A mesma mensagem mostra o resultado no topo e a lista atualizada
  if (msgId) {
    const v = await todayView(deps.db, link, date)
    await deps.tg('editMessageText', { chat_id: chatId, message_id: msgId, text: `${msg}\n\n${v.text}`, reply_markup: { inline_keyboard: v.buttons } })
  } else await send(deps, chatId, msg)
}

const inflight = new Set<string>()

// ── Bom dia e resumo no Telegram ────────────────────────────────────────

export interface TgReport { kind: string, day: string, sent: number, skipped: number, failed: number, deactivated: number, errors: string[] }

export async function runTelegramDigest(deps: BotDeps, kind: 'morning' | 'weekly'): Promise<TgReport> {
  const clock = homeClock(deps.now)
  const report: TgReport = { kind, day: clock.date, sent: 0, skipped: 0, failed: 0, deactivated: 0, errors: [] }
  const links = must(await deps.db.from('telegram_links').select('*').eq('active', true).eq(kind, true).not('chat_id', 'is', null), 'vínculos') as Link[]
  const byHouse = new Map<string, Link[]>()
  links.forEach(l => byHouse.set(l.household_id, [...(byHouse.get(l.household_id) || []), l]))
  for (const [householdId, list] of Array.from(byHouse.entries())) {
    try {
      const morning = kind === 'morning' ? await morningPayloads(deps.db, householdId, clock.date, clock.hm) : null
      const weekly = kind === 'weekly' ? await weeklyPayload(deps.db, householdId, clock.date) : null
      for (const l of list) {
        if (!isWho(l.who)) continue
        const claim = await deps.db.from('telegram_log').insert({ link_id: l.id, kind, day: clock.date }).select('id').maybeSingle()
        if (claim.error) { if (claim.error.code === '23505') { report.skipped++; continue } throw new Error(claim.error.message) }
        const p = morning ? morning(l.who) : weekly!
        const extra = kind === 'morning' ? { reply_markup: { inline_keyboard: [[{ text: '📋 Ver e concluir', callback_data: 'hoje' }]] } } : {}
        const r = await deps.tg('sendMessage', { chat_id: l.chat_id, text: `${p.title}\n${p.body}`, ...extra })
        if (r.ok) { report.sent++; await deps.db.from('telegram_log').update({ status: 'sent' }).eq('id', (claim.data as any).id) }
        else {
          report.failed++
          report.errors.push(`${r.error_code}: ${String(r.description).slice(0, 120)}`)
          await deps.db.from('telegram_log').update({ status: 'failed', detail: String(r.description).slice(0, 300) }).eq('id', (claim.data as any).id)
          // Bloqueou o bot ou apagou a conversa: desliga
          if (r.error_code === 403 || /chat not found/i.test(String(r.description))) { report.deactivated++; await deps.db.from('telegram_links').update({ active: false }).eq('id', l.id) }
        }
      }
    } catch (e: any) {
      report.failed += list.length
      report.errors.push(`casa: ${String(e?.message || e).slice(0, 160)}`)
    }
  }
  return report
}
