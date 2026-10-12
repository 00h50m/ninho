// Água ao longo do dia: o ritmo esperado (para lembrar só quando está atrás), o texto do lembrete,
// o "último copo" e quando abrir o pop-up no app. Puro, testado.
const toMin = (hm: string) => { const [h, m] = hm.slice(0, 5).split(':').map(Number); return h * 60 + m }

/** Janela do dia para beber: a meta vai de 0 às 8h até 100% às 21h. */
const START = 8 * 60, END = 21 * 60
/** Horários dos lembretes (só saem se estiver atrás do ritmo). */
export const WATER_TIMES = ['09:30', '11:00', '12:30', '14:00', '15:30', '17:00', '18:30', '20:00']

export const L = (ml: number) => `${String(Math.round(ml / 10) / 100).replace('.', ',')} L`

/** Quanto já deveria ter bebido até `hm`. */
export function waterExpected(goal: number, hm: string): number {
  const m = toMin(hm)
  return Math.round(goal * Math.max(0, Math.min(1, (m - START) / (END - START))))
}

/** Atrás do ritmo: falta mais de meio copo para o esperado até agora (e a meta não foi batida). */
export const waterBehind = (ml: number, goal: number, cup: number, hm: string) => ml < goal && ml < waterExpected(goal, hm) - cup / 2

/** "1,25 L de 2 L · faltam 3 copos" */
export function waterLine(ml: number, goal: number, cup: number): string {
  if (ml >= goal) return `${L(ml)} · meta batida 🎉`
  const n = Math.ceil((goal - ml) / Math.max(50, cup))
  return `${L(ml)} de ${L(goal)} · falta${n > 1 ? 'm' : ''} ${n} copo${n > 1 ? 's' : ''}`
}

/** "Agora!", "há 25 min", "há 2 h", "ainda nenhum hoje" */
export function lastCup(lastMs: number | null, nowMs: number): string {
  if (lastMs == null) return 'ainda nenhum hoje'
  const min = Math.max(0, Math.round((nowMs - lastMs) / 60000))
  if (min < 2) return 'agora!'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  return `há ${h} h${min % 60 >= 30 ? ' e meia' : ''}`
}

/**
 * Abrir o pop-up de água ao usar o app: só das 9h às 21h, atrás do ritmo, sem copo há 90 min,
 * no máximo a cada 2 h e nunca depois de "hoje não".
 */
export function shouldNudge(o: { ml: number, goal: number, cup: number, hm: string, nowMs: number, lastCupMs: number | null, lastShownMs: number | null, mutedDay: string | null, today: string }): boolean {
  const m = toMin(o.hm)
  if (m < 9 * 60 || m > END || o.mutedDay === o.today) return false
  if (!waterBehind(o.ml, o.goal, o.cup, o.hm)) return false
  if (o.lastCupMs != null && o.nowMs - o.lastCupMs < 90 * 60000) return false
  return o.lastShownMs == null || o.nowMs - o.lastShownMs >= 2 * 3600000
}
