// Envio das notificações (SÓ servidor: usa a chave service_role, que ignora a RLS).
// Nunca importe este arquivo em componentes do navegador.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HItem, Names, Who } from '@/lib/types'
import { buildDogs, buildTasks } from '@/lib/build'
import { addDays, homeClock, weekStartOf } from '@/lib/dates'
import { planToday } from '@/lib/today'
import { COMPLETION_WINDOW_DAYS, DEFAULT_NAMES } from '@/lib/constants'
import { morningMessage, testMessage, weeklyMessage, type MaintNote, type PushPayload } from '@/lib/digest'
import { dueForPerson, type MaintenanceItem } from '@/lib/maintenance'
import type { SplitMode } from '@/lib/split'
import { EMPTY_SCORES, type WeeklyScores } from '@/lib/gamification'

export interface Subscription { id: string, household_id: string, who: Who, endpoint: string, p256dh: string, auth: string, morning: boolean, weekly: boolean, failures?: number }
export type SendResult = { ok: true } | { ok: false, gone: boolean, error: string }
export type Sender = (sub: Subscription, payload: PushPayload) => Promise<SendResult>

export interface NotifyDeps { db: SupabaseClient, send: Sender, now?: Date }
export interface Report { kind: string, day: string, households: number, sent: number, skipped: number, failed: number, deactivated: number, errors: string[] }

function must<T>(res: { data: T | null, error: any }, ctx: string): T {
  if (res.error) throw new Error(`${ctx}: ${res.error.message}`)
  return res.data as T
}

/** Carrega o necessário para montar o Hoje de uma casa (mesmas consultas do app). */
async function loadHousehold(db: SupabaseClient, householdId: string, today: string) {
  const since = addDays(today, -COMPLETION_WINDOW_DAYS)
  const [tasks, tcomps, dogs, dcomps, settings, profiles] = await Promise.all([
    db.from('tasks').select('*').eq('household_id', householdId).eq('active', true).then(r => must(r, 'tarefas')),
    db.from('task_completions').select('id,task_id,date,completed_by').eq('household_id', householdId).gte('date', since).then(r => must(r, 'conclusões')),
    db.from('dogs').select('*,dog_routines(*)').eq('household_id', householdId).eq('active', true).then(r => must(r, 'cães')),
    db.from('dog_completions').select('id,routine_id,date,completed_by').eq('household_id', householdId).gte('date', since).then(r => must(r, 'rotinas')),
    db.from('weekly_settings').select('*').eq('household_id', householdId).eq('week_start', weekStartOf(today)).maybeSingle().then(r => must(r, 'semana')),
    db.from('profiles').select('display_name,role').eq('household_id', householdId).then(r => must(r, 'nomes')),
  ])
  // Pontuais: conclusões antigas também valem
  const onceIds = (tasks as any[]).filter(t => t.frequency === 'once').map(t => t.id)
  const old = onceIds.length ? must(await db.from('task_completions').select('id,task_id,date,completed_by').in('task_id', onceIds).lt('date', since), 'pontuais') : []
  // Fase 3 (migration 007): sem a migration, segue com o rodízio e sem manutenção
  const house = await db.from('households').select('split_mode').eq('id', householdId).maybeSingle()
  const split: SplitMode = house.error || (house.data as any)?.split_mode === 'rotation' ? 'rotation' : 'smart'
  const mt = await db.from('maintenance_items').select('id,title,next_due,assigned_to,active').eq('household_id', householdId).eq('active', true)
  const maint = (mt.error ? [] : mt.data || []) as Array<Pick<MaintenanceItem, 'id' | 'title' | 'next_due' | 'assigned_to' | 'active'>>
  const g = (profiles as any[]).find(p => p.role === 'g'), s = (profiles as any[]).find(p => p.role === 's')
  const names: Names = { g: g?.display_name || DEFAULT_NAMES.g, s: s?.display_name || DEFAULT_NAMES.s }
  const st = settings as any
  return {
    tasks: buildTasks(tasks as any[], [...(tcomps as any[]), ...(old as any[])], today),
    dogs: buildDogs(dogs as any[], dcomps as any[], today),
    focus: !!st?.survival || st?.energy === 'low',
    bet: (st?.bet as string | null) ?? null,
    names, split, maint,
  }
}

async function activeSubs(db: SupabaseClient, filter: 'morning' | 'weekly'): Promise<Subscription[]> {
  return must(await db.from('push_subscriptions').select('*').eq('active', true).eq(filter, true), 'inscrições') as Subscription[]
}

/** Registra o envio antes de mandar; se já existe (agendador repetiu), não manda de novo. */
async function claim(db: SupabaseClient, subId: string, kind: string, day: string): Promise<string | null> {
  const r = await db.from('push_log').insert({ subscription_id: subId, kind, day }).select('id').maybeSingle()
  if (r.error) {
    if (r.error.code === '23505') return null // já enviado hoje
    throw new Error(`registro de envio: ${r.error.message}`)
  }
  return (r.data as any)?.id ?? null
}

async function deliver(deps: NotifyDeps, sub: Subscription, logId: string, payload: PushPayload, report: Report) {
  const res = await deps.send(sub, payload)
  if (res.ok) {
    report.sent++
    await deps.db.from('push_log').update({ status: 'sent' }).eq('id', logId)
    await deps.db.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failures: 0 }).eq('id', sub.id)
    return
  }
  const fail = res as { ok: false, gone: boolean, error: string }
  report.failed++
  report.errors.push(fail.error.slice(0, 160))
  await deps.db.from('push_log').update({ status: 'failed', detail: fail.error.slice(0, 300) }).eq('id', logId)
  // Aparelho desinstalou ou revogou: desativa (o app reativa se a pessoa ligar de novo)
  if (fail.gone) { report.deactivated++; await deps.db.from('push_subscriptions').update({ active: false }).eq('id', sub.id) }
  else await deps.db.from('push_subscriptions').update({ failures: (sub.failures || 0) + 1 }).eq('id', sub.id)
}

function groupByHousehold(subs: Subscription[]) {
  const m = new Map<string, Subscription[]>()
  subs.forEach(s => m.set(s.household_id, [...(m.get(s.household_id) || []), s]))
  return m
}

/** Bom dia: o que é de cada pessoa hoje. */
export async function runMorning(deps: NotifyDeps): Promise<Report> {
  const clock = homeClock(deps.now)
  const report: Report = { kind: 'morning', day: clock.date, households: 0, sent: 0, skipped: 0, failed: 0, deactivated: 0, errors: [] }
  const byHouse = groupByHousehold(await activeSubs(deps.db, 'morning'))
  for (const [householdId, subs] of Array.from(byHouse.entries())) {
    report.households++
    try {
      const h = await loadHousehold(deps.db, householdId, clock.date)
      const plan = planToday(h.tasks, h.dogs, clock.date, { focus: h.focus, split: h.split })
      const mine = (w: Who): HItem[] => plan.items.filter(i => plan.ownerOfItem(i) === w)
      const maintOf = (w: Who): MaintNote[] => dueForPerson(h.maint as MaintenanceItem[], w, clock.date).map(m => ({ title: m.title, late: m.next_due < clock.date }))
      for (const sub of subs) {
        const logId = await claim(deps.db, sub.id, 'morning', clock.date)
        if (!logId) { report.skipped++; continue }
        await deliver(deps, sub, logId, morningMessage(sub.who, h.names, mine(sub.who), clock.hm, maintOf(sub.who)), report)
      }
    } catch (e: any) {
      report.failed += subs.length
      report.errors.push(`casa: ${String(e?.message || e).slice(0, 160)}`)
    }
  }
  return report
}

/** Resumo de domingo: placar, aposta, sequência e o que ficou para trás. */
export async function runWeekly(deps: NotifyDeps): Promise<Report> {
  const clock = homeClock(deps.now)
  const report: Report = { kind: 'weekly', day: clock.date, households: 0, sent: 0, skipped: 0, failed: 0, deactivated: 0, errors: [] }
  const byHouse = groupByHousehold(await activeSubs(deps.db, 'weekly'))
  for (const [householdId, subs] of Array.from(byHouse.entries())) {
    report.households++
    try {
      const h = await loadHousehold(deps.db, householdId, clock.date)
      const [scoresRaw, streaksRaw] = await Promise.all([
        deps.db.rpc('ninho_weekly_scores', { p_household_id: householdId, p_week_start: weekStartOf(clock.date) }).then(r => must(r, 'placar')),
        deps.db.rpc('ninho_streaks', { p_household_id: householdId, p_today: clock.date }).then(r => must(r, 'sequências')),
      ])
      const sc = (scoresRaw || {}) as any
      const scores: WeeklyScores = { g: { ...EMPTY_SCORES.g, ...sc.g }, s: { ...EMPTY_SCORES.s, ...sc.s }, unknown: { ...EMPTY_SCORES.unknown, ...sc.unknown } }
      const plan = planToday(h.tasks, h.dogs, clock.date, { split: h.split })
      const nextMaint = h.maint.filter(m => m.next_due > clock.date && m.next_due <= addDays(clock.date, 7)).sort((a, b) => a.next_due.localeCompare(b.next_due)).map(m => m.title)
      const pending = plan.dueList.filter(t => t.frequency !== 'daily' && t.frequency !== 'once' && !t.completed_today).map(t => ({ title: t.title, frequency: t.frequency }))
      const payload = weeklyMessage(h.names, scores, h.bet, Number((streaksRaw as any)?.house) || 0, pending, nextMaint)
      for (const sub of subs) {
        const logId = await claim(deps.db, sub.id, 'weekly', clock.date)
        if (!logId) { report.skipped++; continue }
        await deliver(deps, sub, logId, payload, report)
      }
    } catch (e: any) {
      report.failed += subs.length
      report.errors.push(`casa: ${String(e?.message || e).slice(0, 160)}`)
    }
  }
  return report
}

/** Notificação de teste para um aparelho (no máximo 1 por minuto). */
export async function runTest(deps: NotifyDeps, endpoint: string): Promise<{ status: number, message: string }> {
  const sub = must(await deps.db.from('push_subscriptions').select('*').eq('endpoint', endpoint).eq('active', true).maybeSingle(), 'inscrição') as Subscription | null
  if (!sub) return { status: 404, message: 'Este aparelho não está inscrito.' }
  const recent = must(await deps.db.from('push_log').select('id').eq('subscription_id', sub.id).eq('kind', 'test')
    .gte('created_at', new Date(Date.now() - 60000).toISOString()).limit(1), 'limite') as any[]
  if (recent.length) return { status: 429, message: 'Espere um minuto para testar de novo.' }
  const logId = await claim(deps.db, sub.id, 'test', homeClock(deps.now).date)
  const report: Report = { kind: 'test', day: '', households: 1, sent: 0, skipped: 0, failed: 0, deactivated: 0, errors: [] }
  const names = must(await deps.db.from('profiles').select('display_name,role').eq('household_id', sub.household_id), 'nomes') as any[]
  const nm: Names = { g: names.find(p => p.role === 'g')?.display_name || DEFAULT_NAMES.g, s: names.find(p => p.role === 's')?.display_name || DEFAULT_NAMES.s }
  await deliver(deps, sub, logId!, testMessage(sub.who, nm), report)
  return report.sent ? { status: 200, message: 'Enviada.' } : { status: 502, message: 'O serviço de notificação recusou o envio.' }
}
