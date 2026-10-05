// Sugestões da IA para a semana (SÓ servidor: usa ANTHROPIC_API_KEY).
// Monta um resumo da casa (tarefas, quem fez, placar, puladas, reunião passada) e
// pede ao Claude de 3 a 5 ajustes concretos. Limite de uso por casa (ai_log).
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Names, Task, Who } from '@/lib/types'
import { addDays, homeClock, weekStartOf } from '@/lib/dates'
import { FPT, WPT } from '@/lib/constants'
import { planToday } from '@/lib/today'
import { lastLabel, weekdaysLabel } from '@/lib/frequency'
import { loadHousehold, must } from './notify'

export const AI_MODEL = 'claude-opus-5-5'
/** Pedidos por casa a cada 24 h (protege a conta de uso exagerado). */
export const AI_DAILY_LIMIT = 6

export interface WeekFacts {
  names: Names
  today: string
  weekStart: string
  split: string
  focus: boolean
  energy: string | null
  scores: Record<Who, { xp: number, done: number, on_time: number }>
  tasks: Array<{ title: string, frequency: string, weight: string, owner: string, fixed: boolean, last: string, essential: boolean, weekdays: string, skippedThisWeek: boolean, doneThisPeriod: boolean }>
  dogs: string[]
  lastMeeting: { overloaded?: string, adjustments?: string, worked?: string } | null
}

/** Texto enviado à IA (sem ids, chaves ou dados técnicos). Função pura, testada. */
export function weekContext(f: WeekFacts): string {
  const n = (w: Who) => (f.names[w] || '').split(' ')[0]
  const lines = [
    `Casa de ${n('g')} (home office) e ${n('s')} (professora)${f.dogs.length ? `, com os cães ${f.dogs.join(' e ')}` : ''}.`,
    `Semana de ${f.weekStart} até hoje (${f.today}).`,
    `Placar da semana: ${n('g')} ${f.scores.g.xp} XP (${f.scores.g.done} feitas, ${f.scores.g.on_time} no horário) · ${n('s')} ${f.scores.s.xp} XP (${f.scores.s.done} feitas, ${f.scores.s.on_time} no horário).`,
    `Energia da semana: ${f.energy || 'média'}${f.focus ? ' (foco só no essencial)' : ''}. Divisão: ${f.split === 'smart' ? 'inteligente (quem fez por último passa a vez)' : 'rodízio fixo'}.`,
    '',
    'Tarefas (nome · frequência · esforço · de quem é · última vez · observações):',
    ...f.tasks.map(t => `- ${t.title} · ${t.frequency} · ${t.weight} · ${t.fixed ? `sempre ${t.owner}` : `divisão (hoje: ${t.owner})`} · ${t.last}${[t.essential ? 'essencial' : '', t.weekdays ? `dias: ${t.weekdays}` : '', t.skippedThisWeek ? 'pulada nesta semana' : '', t.frequency !== 'diária' && !t.doneThisPeriod ? 'ainda não feita no período' : ''].filter(Boolean).map(x => ` · ${x}`).join('')}`),
  ]
  if (f.lastMeeting && (f.lastMeeting.overloaded || f.lastMeeting.adjustments || f.lastMeeting.worked)) {
    lines.push('', 'Reunião da semana passada:')
    if (f.lastMeeting.worked) lines.push(`- O que funcionou: ${f.lastMeeting.worked}`)
    if (f.lastMeeting.overloaded) lines.push(`- O que pesou: ${f.lastMeeting.overloaded}`)
    if (f.lastMeeting.adjustments) lines.push(`- Ajustes combinados: ${f.lastMeeting.adjustments}`)
  }
  return lines.join('\n')
}

export const SYSTEM = [
  'Você ajuda um casal a organizar as tarefas da casa no app Ninho.',
  'Leia o resumo da semana e sugira de 3 a 5 ajustes concretos para a próxima semana.',
  'Cada sugestão em uma linha começando com "- ", com no máximo 2 frases, em português do Brasil, tom gentil e sem cobranças.',
  'Use só tarefas e pessoas que aparecem no resumo. Sugestões possíveis: passar uma tarefa fixa para a outra pessoa, voltar uma tarefa para a divisão, escolher dias da semana, marcar ou desmarcar como essencial, trocar a frequência, pular algo numa semana pesada, ajustar a energia da semana.',
  'Se a divisão já estiver equilibrada, diga isso em uma das linhas.',
  'Responda só com as linhas de sugestão, sem título e sem conclusão.',
].join('\n')

/** Separa as linhas "- ..." da resposta. */
export function parseTips(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(l => /^[-•*]\s+/.test(l)).map(l => l.replace(/^[-•*]\s+/, '').trim()).filter(Boolean).slice(0, 6)
}

/** Junta os fatos da semana a partir do banco (mesmas regras do app). */
export async function loadWeekFacts(db: SupabaseClient, householdId: string, now?: Date): Promise<WeekFacts> {
  const today = homeClock(now).date
  const weekStart = weekStartOf(today)
  const h = await loadHousehold(db, householdId, today)
  const plan = planToday(h.tasks, h.dogs, today, { split: h.split })
  const [scoresRaw, settings, meeting] = await Promise.all([
    db.rpc('ninho_weekly_scores', { p_household_id: householdId, p_week_start: weekStart }).then(r => must(r, 'placar')),
    db.from('weekly_settings').select('energy').eq('household_id', householdId).eq('week_start', weekStart).maybeSingle().then(r => r.data as any),
    db.from('weekly_meetings').select('what_worked,what_overloaded,adjustments').eq('household_id', householdId).eq('week_start', addDays(weekStart, -7)).maybeSingle().then(r => r.data as any),
  ])
  const sc = (scoresRaw || {}) as any
  const score = (w: Who) => ({ xp: Number(sc[w]?.xp) || 0, done: Number(sc[w]?.done) || 0, on_time: Number(sc[w]?.on_time) || 0 })
  const first = (w: Who) => (h.names[w] || '').split(' ')[0]
  const taskFacts = (t: Task) => ({
    title: t.title, frequency: (FPT[t.frequency] || t.frequency).toLowerCase(), weight: (WPT[t.weight] || t.weight).toLowerCase(),
    owner: first(plan.ownerOfTask(t)), fixed: t.assigned_to === 'g' || t.assigned_to === 's',
    last: lastLabel(t.completed_today ? today : t.prev_done || null, today), essential: !!t.essential,
    weekdays: weekdaysLabel(t.weekdays), skippedThisWeek: !!t.skip && t.skip.date >= weekStart,
    doneThisPeriod: !plan.dueList.some(d => d.id === t.id) || !!t.completed_today,
  })
  return {
    names: h.names, today, weekStart, split: h.split, focus: h.focus, energy: settings?.energy ?? null,
    scores: { g: score('g'), s: score('s') },
    tasks: plan.homeTasks.slice(0, 80).map(taskFacts),
    dogs: h.dogs.map(d => d.name),
    lastMeeting: meeting ? { worked: meeting.what_worked || undefined, overloaded: meeting.what_overloaded || undefined, adjustments: meeting.adjustments || undefined } : null,
  }
}

export type TipsResult = { ok: true, tips: string[], text: string } | { ok: false, status: number, message: string }

/** Pede as sugestões ao Claude, respeitando o limite diário da casa. */
export async function weeklyTips(db: SupabaseClient, householdId: string, opts: { apiKey?: string, baseURL?: string, now?: Date } = {}): Promise<TipsResult> {
  if (!opts.apiKey) return { ok: false, status: 503, message: 'A IA ainda não foi configurada (falta ANTHROPIC_API_KEY na Vercel).' }
  const since = new Date((opts.now ?? new Date()).getTime() - 24 * 3600 * 1000).toISOString()
  const used = must(await db.from('ai_log').select('id').eq('household_id', householdId).gte('created_at', since), 'uso da IA') as any[]
  if (used.length >= AI_DAILY_LIMIT) return { ok: false, status: 429, message: `Limite de ${AI_DAILY_LIMIT} pedidos por dia atingido. Tente amanhã.` }

  const facts = await loadWeekFacts(db, householdId, opts.now)
  // baseURL só é usado em testes locais (imitação da API); em produção fica o endereço oficial
  const client = new Anthropic({ apiKey: opts.apiKey, ...(opts.baseURL ? { baseURL: opts.baseURL } : {}) })
  let res: Anthropic.Beta.BetaMessage
  try {
    res = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: SYSTEM,
      messages: [{ role: 'user', content: weekContext(facts) }],
    })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, status: 502, message: 'A chave da IA (ANTHROPIC_API_KEY) foi recusada.' }
    if (e instanceof Anthropic.RateLimitError) return { ok: false, status: 503, message: 'A IA está ocupada agora. Tente em alguns minutos.' }
    if (e instanceof Anthropic.APIError) return { ok: false, status: 502, message: `A IA não respondeu (erro ${e.status ?? 'de conexão'}). Tente de novo.` }
    throw e
  }
  await db.from('ai_log').insert({ household_id: householdId, kind: 'weekly', input_tokens: res.usage?.input_tokens ?? null, output_tokens: res.usage?.output_tokens ?? null })
  if (res.stop_reason === 'refusal') return { ok: false, status: 502, message: 'A IA não conseguiu responder a este pedido.' }
  const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('\n')
  const tips = parseTips(text)
  if (!tips.length) return { ok: false, status: 502, message: 'A IA respondeu num formato inesperado. Tente de novo.' }
  return { ok: true, tips, text: tips.map(t => `• ${t}`).join('\n') }
}
