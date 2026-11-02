// Horário de costume: para tarefas sem horário, o Ninho aprende a que horas cada uma costuma
// fazê-las (pela hora em que marcou nas últimas semanas) e lembra nesse horário, se ainda não foi feita.
// Puro, testado.
import type { Who } from './types'

/** Hora local (HH:MM) de um instante, no fuso da casa. */
export function localHM(iso: string, tz = 'America/Sao_Paulo'): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const g = (t: string) => p.find(x => x.type === t)?.value || '00'
  return `${g('hour')}:${g('minute')}`
}

const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

export interface Stamp { at: string, by: Who | null }

/** mínimo de vezes para confiar no costume */
export const MIN_SAMPLES = 3
/** as vezes do meio (sem a mais cedo e a mais tarde) cabem nesta janela; senão, não há costume */
export const MAX_SPREAD_MIN = 180

/**
 * Horário de costume de `who` para uma tarefa: mediana das horas em que ela marcou como feita,
 * arredondada para 5 minutos. null se há poucas vezes ou se os horários variam demais.
 * Ignora madrugada (00:00–04:59): costuma ser "marquei depois" e não o horário real.
 */
export function usualTime(stamps: Stamp[], who: Who, tz = 'America/Sao_Paulo'): string | null {
  const mins = stamps.filter(s => s.by === who).map(s => toMin(localHM(s.at, tz))).filter(m => m >= 5 * 60).sort((a, b) => a - b)
  if (mins.length < MIN_SAMPLES) return null
  const core = mins.length >= 5 ? mins.slice(1, -1) : mins
  if (core[core.length - 1] - core[0] > MAX_SPREAD_MIN) return null
  const mid = mins.length % 2 ? mins[(mins.length - 1) / 2] : Math.round((mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2)
  return fromMin(Math.min(23 * 60 + 55, Math.round(mid / 5) * 5))
}
