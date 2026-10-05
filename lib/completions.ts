// Conclusões: resumo por item (feita hoje, por quem, última vez) e rótulos.
import type { CompletionRow, CompletionState, HistEntry, Names, Who } from './types'
import { isWho } from './rotation'

export type CompletionSummary = CompletionState

/**
 * Resume as conclusões por item (task_id ou routine_id).
 * Registros antigos sem completed_by ficam com completed_by_today = null ("não identificado").
 */
export function summarizeCompletions(rows: CompletionRow[], key: 'task_id' | 'routine_id', today: string) {
  const todayRow = new Map<string, CompletionRow>()
  const prev = new Map<string, string>()
  const hist = new Map<string, HistEntry[]>()
  for (const c of rows) {
    const id = c[key]
    if (!id) continue
    if (c.date === today) todayRow.set(id, c)
    else if (c.date < today) {
      if (!prev.has(id) || c.date > prev.get(id)!) prev.set(id, c.date)
      const h = hist.get(id) || []
      h.push({ d: c.date, by: isWho(c.completed_by) ? c.completed_by : null })
      hist.set(id, h)
    }
  }
  hist.forEach(h => h.sort((a, b) => b.d.localeCompare(a.d)))
  return (id: string): CompletionSummary => {
    const t = todayRow.get(id)
    return {
      completed_today: !!t,
      completed_by_today: t ? (isWho(t.completed_by) ? t.completed_by : null) : null,
      completion_id: t?.id ?? null,
      prev_done: prev.get(id) ?? null,
      hist: hist.get(id) ?? [],
    }
  }
}

export const UNKNOWN_PERSON = 'não identificado'

/** Nome de quem concluiu; registros antigos sem autoria aparecem como "não identificado". */
export function completedByLabel(who: Who | null | undefined, names: Names): string {
  return who ? (names[who] || '').split(' ')[0] || UNKNOWN_PERSON : UNKNOWN_PERSON
}
