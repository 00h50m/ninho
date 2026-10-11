// "Organize meu dia" (SÓ servidor): junta o despejo da pessoa com o que já está
// no app hoje e pede à IA o dia em ordem. Nada é gravado aqui.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Who } from '@/lib/types'
import { dowOf, homeClock } from '@/lib/dates'
import { planToday } from '@/lib/today'
import { DAY_SCHEMA, DAY_SYSTEM, dayContext, validateDay, type DayContext, type DayPlan } from '@/lib/organizar'
import { ask, type AiOpts } from './nutritionAi'
import { loadHousehold, must } from './notify'

export const DAY_DAILY_LIMIT = 20
type Fail = { ok: false, status: number, message: string }

export async function planDay(db: SupabaseClient, householdId: string, me: Who, text: string, opts: AiOpts = {}): Promise<{ ok: true, plan: DayPlan } | Fail> {
  const now = opts.now ?? new Date()
  const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
  const used = must(await db.from('ai_log').select('id').eq('household_id', householdId).eq('kind', 'dia').gte('created_at', since), 'uso da IA') as any[]
  if (used.length >= DAY_DAILY_LIMIT) return { ok: false, status: 429, message: `Limite de ${DAY_DAILY_LIMIT} dias organizados por dia. Tente amanhã.` }
  const { date, hm } = homeClock(now)
  const h = await loadHousehold(db, householdId, date)
  const plan = planToday(h.tasks, h.dogs, date, { split: h.split })
  const events = await db.from('house_events').select('title,time,who,done_at').eq('household_id', householdId).eq('date', date)
  const existing: DayContext['existing'] = [
    ...plan.items.filter(i => !i.completed_today).map(i => ({ title: i.task ? i.task.title : `${i.dog!.title} (cães)`, time: i.scheduled_time?.slice(0, 5) || null, who: i.task ? plan.ownerOfTask(i.task) : null, kind: 'tarefa' as const })),
    ...((events.data || []) as any[]).filter(e => !e.done_at).map(e => ({ title: e.title, time: e.time?.slice(0, 5) || null, who: e.who, kind: 'agenda' as const })),
  ]
  const ctx: DayContext = { today: date, hm, me, names: h.names, existing }
  const r = await ask(db, householdId, 'dia', opts, {
    system: DAY_SYSTEM, schema: DAY_SCHEMA, effort: 'low', maxTokens: 6000,
    content: [{ type: 'text', text: dayContext(ctx, text, dowOf(date)) }],
  })
  if (r.ok === false) return r
  const out = validateDay(r.json, { today: date, me })
  if (!out) return { ok: false, status: 422, message: 'Não achei pendências nesse texto. Escreva o que precisa fazer (ex.: "dentista 14h30, pagar o boleto, mercado").' }
  return { ok: true, plan: out }
}
