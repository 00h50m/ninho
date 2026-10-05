// Regras puras de atualização localizada a partir de eventos do Realtime.
// (O hook useNinhoData só conecta o canal e chama estas funções.)
import type { CompletionState, Task, Who } from './types'
import { isWho } from './rotation'

type Completable = { id: string } & CompletionState

/** Conclusão de HOJE chegou (INSERT/UPDATE): marca o item como feito e por quem. */
export function applyCompletionToday<T extends Completable>(items: T[], itemId: string, row: { id: string, completed_by?: string | null }): T[] {
  return items.map(x => x.id === itemId
    ? { ...x, completed_today: true, completed_by_today: (isWho(row.completed_by) ? row.completed_by : null) as Who | null, completion_id: row.id }
    : x)
}

/** Conclusão removida: só afeta o item cuja conclusão tem exatamente este id. */
export function applyCompletionDeleted<T extends Completable>(items: T[], completionId: string): T[] {
  return items.map(x => x.completion_id === completionId ? { ...x, completed_today: false, completed_by_today: null, completion_id: null } : x)
}

/**
 * Linha de tarefa mudou (INSERT/UPDATE da própria casa).
 * Mantém os campos de conclusão; tarefa arquivada sai da lista;
 * tarefa nova/reativada pede recarga (precisa do histórico de conclusões).
 */
export function applyTaskRow(tasks: Task[], row: Partial<Task> & { id: string }): { tasks: Task[], needsReload: boolean } {
  const i = tasks.findIndex(t => t.id === row.id)
  if (row.active === false) return { tasks: i < 0 ? tasks : tasks.filter(t => t.id !== row.id), needsReload: false }
  if (i < 0) return { tasks, needsReload: true }
  const next = [...tasks]
  next[i] = { ...tasks[i], ...row }
  return { tasks: next, needsReload: false }
}

/** Evento só interessa se for desta casa (os eventos com filtro já chegam filtrados; DELETE não). */
export function isForHousehold(row: { household_id?: string | null } | null | undefined, householdId: string): boolean {
  return !!row && row.household_id === householdId
}
