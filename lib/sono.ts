// Hora de dormir: pelo horário em que a pessoa costuma acordar (mediana das últimas noites)
// e pela meta de sono, a hora de deitar; o lembrete sai 30 min antes. Puro, testado.
import { addDays } from './dates'
import type { PLog } from './meudia'
import type { Who } from './types'

const toMin = (hm: string) => { const [h, m] = hm.slice(0, 5).split(':').map(Number); return h * 60 + m }
const fromMin = (n: number) => { const x = ((Math.round(n) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}` }

/** Horário em que costuma acordar: mediana das últimas 14 noites (pelo menos 3 registros). */
export function usualWake(logs: Array<Pick<PLog, 'who' | 'kind' | 'date' | 'data'>>, who: Who, today: string): string | null {
  const from = addDays(today, -14)
  const w = logs.filter(l => l.who === who && l.kind === 'sono' && l.date >= from && l.date <= today && /^\d{2}:\d{2}/.test(String(l.data?.wake || '')))
    .map(l => toMin(String(l.data.wake))).sort((a, b) => a - b)
  if (w.length < 3) return null
  const mid = w.length % 2 ? w[(w.length - 1) / 2] : (w[w.length / 2 - 1] + w[w.length / 2]) / 2
  return fromMin(Math.round(mid / 5) * 5)
}

/** Hora de deitar para dormir `goalH` horas e acordar em `wake` (+15 min para pegar no sono). */
export const bedtime = (wake: string, goalH: number) => fromMin(toMin(wake) - goalH * 60 - 15)
/** O lembrete: 30 min antes de deitar. */
export const bedReminder = (wake: string, goalH: number) => fromMin(toMin(bedtime(wake, goalH)) - 30)
