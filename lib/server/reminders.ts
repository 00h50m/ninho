// Lembretes com o app fechado (SÓ servidor: usa a chave service_role).
// Chamado a cada poucos minutos pelo agendador (/api/cron/reminders).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Names, Who } from '@/lib/types'
import { addDays, homeClock } from '@/lib/dates'
import { DEFAULT_NAMES } from '@/lib/constants'
import { remainingMs } from '@/lib/sprint'
import { dueReminders, forDevice, type RemState, type Reminder } from '@/lib/reminders'
import { deliver, must, type NotifyDeps, type Report, type Subscription } from './notify'

export interface ReminderSub extends Subscription { reminders: unknown, quiet_start: string, quiet_end: string }
/** No máximo por aparelho a cada rodada (o resto vai na próxima, se ainda valer). */
const MAX_PER_RUN = 4

const soft = async <T>(q: PromiseLike<{ data: T[] | null, error: any }>): Promise<T[]> => { const r = await q; return r.error ? [] : r.data || [] }

/** Tudo o que os lembretes precisam saber de uma casa, agora. */
export async function loadRemState(db: SupabaseClient, householdId: string, now: Date): Promise<RemState> {
  const { date, hm } = homeClock(now)
  const hh = (t: string, cols: string) => db.from(t).select(cols).eq('household_id', householdId)
  const [profiles, meds, logs, settings, routines, runs, sprints, dogs, health, events, challenges, marks, checkins] = await Promise.all([
    soft<any>(hh('profiles', 'display_name,role')),
    soft<any>(hh('personal_meds', 'id,who,name,dose,times').eq('active', true)),
    soft<any>(hh('personal_logs', 'who,kind,value,data').eq('date', date).in('kind', ['remedio', 'agua'])),
    soft<any>(hh('personal_settings', 'who,water_goal_ml')),
    soft<any>(hh('routines', 'id,title,scheduled_time,weekdays,assign_mode,start_date,paused_until,reminder_min,active')),
    soft<any>(hh('routine_runs', 'routine_id').eq('date', date).eq('status', 'done')),
    soft<any>(hh('sprints', 'id,area,participants,duration_min,started_at,paused_at,paused_ms,ended_at').is('ended_at', null)),
    soft<any>(hh('dogs', 'id,name').eq('active', true)),
    soft<any>(hh('dog_health', 'id,dog_id,title,next_date').gte('next_date', date).lte('next_date', addDays(date, 1))),
    soft<any>(hh('house_events', 'id,title,date,time,who,kind,paid,done_at').gte('date', date).lte('date', addDays(date, 1))),
    soft<any>(hh('couple_challenges', 'id,title,kind,start_date,days').eq('status', 'active').eq('kind', 'livre')),
    soft<any>(hh('challenge_marks', 'challenge_id').eq('date', date)),
    soft<any>(hh('daily_checkins', 'who,mood,energy').eq('date', date)),
  ])
  const g = profiles.find(p => p.role === 'g'), s = profiles.find(p => p.role === 's')
  const names: Names = { g: g?.display_name || DEFAULT_NAMES.g, s: s?.display_name || DEFAULT_NAMES.s }
  const sp = sprints[0]
  const dogName = (id: string) => dogs.find(d => d.id === id)?.name || 'Cão'
  return {
    date, hm, nowMs: now.getTime(), names,
    meds: meds.map(m => ({ id: m.id, who: m.who, name: m.name, dose: m.dose, times: m.times || [] })),
    medTaken: logs.filter(l => l.kind === 'remedio').map(l => ({ who: l.who, med_id: l.data?.med_id, time: l.data?.time ?? null })),
    water: (['g', 's'] as Who[]).map(w => ({ who: w, ml: logs.filter(l => l.kind === 'agua' && l.who === w).reduce((a, l) => a + Number(l.value || 0), 0), goal: Number(settings.find(x => x.who === w)?.water_goal_ml || 2000) })),
    routines: routines.filter(r => r.active !== false),
    routineDone: runs.map(r => r.routine_id),
    sprint: sp ? { id: sp.id, area: sp.area, participants: sp.participants || [], endMs: now.getTime() + remainingMs(sp, now.getTime()) } : null,
    dogHealth: health.filter(h => dogs.some(d => d.id === h.dog_id)).map(h => ({ id: h.id, title: h.title, dog: dogName(h.dog_id), next_date: h.next_date })),
    events,
    challenges: challenges.filter(c => date >= c.start_date && date <= addDays(c.start_date, c.days - 1) && !marks.some(m => m.challenge_id === c.id)).map(c => ({ id: c.id, title: c.title })),
    checkins: checkins.filter(c => c.mood || c.energy).map(c => c.who),
  }
}

async function claimReminder(db: SupabaseClient, subId: string, day: string, ref: string): Promise<string | null> {
  const r = await db.from('push_log').insert({ subscription_id: subId, kind: 'reminder', day, ref }).select('id').maybeSingle()
  if (r.error) { if (r.error.code === '23505') return null; throw new Error(`registro de lembrete: ${r.error.message}`) }
  return (r.data as any)?.id ?? null
}

export async function runReminders(deps: NotifyDeps, win = 20): Promise<Report & { reminders: number, pending?: string }> {
  const now = deps.now || new Date()
  const clock = homeClock(now)
  const report = { kind: 'reminders', day: clock.date, households: 0, sent: 0, skipped: 0, failed: 0, deactivated: 0, errors: [] as string[], reminders: 0 }
  const subs = must(await deps.db.from('push_subscriptions').select('*').eq('active', true), 'inscrições') as ReminderSub[]
  // Sem a migration 023 não há preferências nem registro de lembrete: não manda nada
  if (subs.length && !('quiet_start' in subs[0])) return { ...report, pending: 'migration 023 ainda não aplicada' }
  const byHouse = new Map<string, ReminderSub[]>()
  subs.forEach(s => byHouse.set(s.household_id, [...(byHouse.get(s.household_id) || []), s]))
  for (const [householdId, list] of Array.from(byHouse.entries())) {
    report.households++
    try {
      const all: Reminder[] = dueReminders(await loadRemState(deps.db, householdId, now), win)
      report.reminders += all.length
      for (const sub of list) {
        let n = 0
        for (const r of forDevice(all, sub, clock.hm)) {
          if (n >= MAX_PER_RUN) break
          const logId = await claimReminder(deps.db, sub.id, clock.date, r.ref)
          if (!logId) { report.skipped++; continue }
          n++
          await deliver(deps, sub, logId, { title: r.title, body: r.body, tag: r.ref.slice(0, 60), url: r.url }, report)
        }
      }
    } catch (e: any) {
      report.failed++
      report.errors.push(`casa: ${String(e?.message || e).slice(0, 160)}`)
    }
  }
  return report
}
