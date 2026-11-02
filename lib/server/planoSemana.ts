// Plano da semana no servidor (resumo de domingo no Telegram e o botão "✓ Aprovar plano").
// A conta é a mesma do app (lib/planoSemana.ts).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Who } from '@/lib/types'
import { planToday } from '@/lib/today'
import { planLines, planWeek, proposePlan, type PlanItem } from '@/lib/planoSemana'
import { loadHousehold } from './notify'

export interface ServerPlan { start: string, items: PlanItem[], approved: boolean, lines: string[] }

export async function weekPlanFor(db: SupabaseClient, householdId: string, today: string): Promise<ServerPlan> {
  const h = await loadHousehold(db, householdId, today)
  const w = planWeek(today)
  const plan = planToday(h.tasks, h.dogs, today, { split: h.split, busy: h.busy, dogPlan: h.dogPlan })
  const ev = await db.from('house_events').select('date,done_at').eq('household_id', householdId).gte('date', w.from).lte('date', w.end)
  const events = ((ev.error ? [] : ev.data || []) as Array<{ date: string, done_at: string | null }>).filter(e => !e.done_at)
  const items = proposePlan(h.tasks, events, today, t => plan.ownerOfTask(t))
  const approved = h.tasks.some(t => (t.plans || []).some(p => p.week_start === w.start))
  return { start: w.start, items, approved, lines: planLines(items, h.names) }
}

/** "✓ Aprovar plano" do Telegram: grava a sugestão (se a semana ainda é a mesma). */
export async function approveFromTelegram(db: SupabaseClient, link: { household_id: string, who: Who }, weekStart: string, today: string): Promise<string> {
  const p = await weekPlanFor(db, link.household_id, today)
  if (p.start !== weekStart) return 'Esse plano já passou. Abra o Início para ver o desta semana.'
  if (p.approved) return '✓ O plano desta semana já estava aprovado.'
  if (!p.items.length) return 'Nada para planejar nesta semana.'
  const r = await db.from('week_plan').upsert(p.items.map(i => ({ household_id: link.household_id, task_id: i.task.id, week_start: p.start, date: i.date, by_who: link.who })), { onConflict: 'task_id,week_start' })
  if (r.error) return r.error.code === '42P01' || /week_plan/.test(r.error.message) ? '⚠️ O plano da semana precisa da atualização do banco (045).' : '⚠️ Não consegui aprovar agora. Tente de novo.'
  return `✓ Plano aprovado (${p.items.length} tarefa${p.items.length > 1 ? 's' : ''}). Cada uma sobe para "Hoje" no dia dela.`
}
