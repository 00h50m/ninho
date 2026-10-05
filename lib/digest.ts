// Texto das notificações: bom dia (por pessoa) e resumo de domingo (da casa).
// Funções puras: recebem os dados já calculados e devolvem título e corpo.
import type { HItem, Names, Who } from './types'
import { hhmm } from './dates'
import { canEarnOnTime, leaderOf, DEFAULT_BET, type WeeklyScores } from './gamification'
import { FPT } from './constants'

export interface PushPayload { title: string, body: string, tag: string, url: string }

const first = (n: string) => (n || '').split(' ')[0]
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

/**
 * Bom dia: o que é da pessoa hoje (dela fixa ou pela vez do rodízio), ainda não feito.
 * `items` = itens de Hoje já filtrados para a pessoa (planToday + ownerOfItem).
 */
export function morningMessage(who: Who, names: Names, items: HItem[], nowHM = '00:00'): PushPayload {
  const name = first(names[who])
  const pend = items.filter(i => !i.completed_today)
  const tasks = pend.filter(i => i.task)
  const dogs = pend.filter(i => i.dog)
  const ess = tasks.filter(i => i.essential).length
  if (!pend.length) {
    return { title: `Bom dia, ${name}! ☀️`, body: 'Nada pendente para você hoje. Aproveite o dia! 🌿', tag: 'morning', url: '/' }
  }
  const parts: string[] = []
  if (tasks.length) parts.push(plural(tasks.length, 'tarefa', 'tarefas') + (ess ? ` (${plural(ess, 'essencial', 'essenciais')})` : ''))
  if (dogs.length) parts.push(plural(dogs.length, 'rotina dos cães', 'rotinas dos cães'))
  const timed = pend.filter(i => i.scheduled_time).sort((a, b) => hhmm(a.scheduled_time).localeCompare(hhmm(b.scheduled_time)))
  const next = timed[0] || pend[0]
  const nextTitle = next.task ? next.task.title : next.dog!.title
  const bonus = pend.filter(i => canEarnOnTime(i, nowHM)).length
  let body = `Hoje: ${parts.join(' e ')}. Primeira: ${nextTitle}${next.scheduled_time ? ` às ${hhmm(next.scheduled_time)}` : ''}.`
  if (bonus) body += ` ⚡ ${plural(bonus, 'item vale', 'itens valem')} ×1,5 se feito no horário.`
  return { title: `Bom dia, ${name}! ☀️`, body, tag: 'morning', url: '/' }
}

/**
 * Resumo de domingo: placar da semana, quem paga a aposta e o que ficou pendente do período.
 * `pending` = títulos de tarefas semanais/quinzenais/mensais ainda devidas no domingo.
 */
export function weeklyMessage(names: Names, scores: WeeklyScores, bet: string | null | undefined, streak: number, pending: Array<{ title: string, frequency: string }>): PushPayload {
  const g = first(names.g), s = first(names.s)
  const done = scores.g.done + scores.s.done + scores.unknown.done
  const lead = leaderOf(scores)
  let body = `Vocês fizeram ${plural(done, 'conclusão', 'conclusões')}. Placar: ${g} ${scores.g.xp} × ${scores.s.xp} ${s}`
  if (lead === 'tie') body += ' — empate!'
  else {
    const loser = lead === 'g' ? s : g
    body += ` — ${first(names[lead])} venceu! ${loser} paga: ${bet || DEFAULT_BET}.`
  }
  if (streak > 1) body += ` 🔥 ${streak} dias seguidos.`
  if (pending.length) {
    const list = pending.slice(0, 3).map(p => `${p.title} (${(FPT[p.frequency] || p.frequency).toLowerCase()})`).join(', ')
    body += ` Ficou para trás: ${list}${pending.length > 3 ? ` e mais ${pending.length - 3}` : ''}.`
  } else body += ' Nada ficou para trás. 👏'
  return { title: 'Resumo da semana 🏆', body, tag: 'weekly', url: '/' }
}

export function testMessage(who: Who | null, names: Names): PushPayload {
  return { title: 'Notificações do Ninho ativadas ✅', body: `${who ? first(names[who]) + ', você' : 'Você'} vai receber o bom dia com as tarefas e o resumo de domingo.`, tag: 'test', url: '/' }
}
