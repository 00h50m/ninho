// "Mais tarde": opções de novo horário só para hoje (+1 h, +2 h, à noite). Puro, testado.
const toMin = (hm: string) => { const [h, m] = hm.slice(0, 5).split(':').map(Number); return h * 60 + m }
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

/** limite do dia: depois disso, "mais tarde" vira "deixar para amanhã" */
export const LAST_LATER = '23:30'
export const EVENING = '19:00'

/** Agora + `min`, arredondado para cima em 5 min. null se passa do fim do dia. */
export function laterAt(nowHM: string, min: number): string | null {
  const n = Math.ceil((toMin(nowHM) + min) / 5) * 5
  return n > toMin(LAST_LATER) ? null : fromMin(n)
}

/** Botões do "Mais tarde" para agora. "À noite" só se ainda falta mais de 1 h para as 19h. */
export function laterOptions(nowHM: string): Array<{ label: string, at: string }> {
  const out: Array<{ label: string, at: string }> = []
  const h1 = laterAt(nowHM, 60), h2 = laterAt(nowHM, 120)
  if (h1) out.push({ label: `+1 h (${h1})`, at: h1 })
  if (h2) out.push({ label: `+2 h (${h2})`, at: h2 })
  if (toMin(EVENING) - toMin(nowHM) > 120) out.push({ label: `À noite (${EVENING})`, at: EVENING })
  return out
}
