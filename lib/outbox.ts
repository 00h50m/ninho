// Fila sem internet: ações rápidas feitas offline ficam guardadas no aparelho e são
// enviadas quando a conexão volta. Só ações que podem ser repetidas sem duplicar
// (concluir/desmarcar tarefa e rotina dos cães pelo dia; água com id fixo).
import type { Who } from './types'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export type OutItem =
  | { id: string, at: string, kind: 'task', done: boolean, taskId: string, date: string, by: Who, title: string }
  | { id: string, at: string, kind: 'dogs', done: boolean, ids: string[], date: string, by: Who, title: string }
  | { id: string, at: string, kind: 'log', logId: string, who: Who, date: string, logKind: string, value: number | null, data: Record<string, any>, title: string }

const key = (householdId: string) => `ninho.outbox.v1.${householdId}`
function storage(s?: Storage | null): Storage | null {
  if (s) return s
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

export function readOutbox(householdId: string, s?: Storage | null): OutItem[] {
  try { const v = JSON.parse(storage(s)?.getItem(key(householdId)) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
export function writeOutbox(householdId: string, list: OutItem[], s?: Storage | null) {
  try { if (list.length) storage(s)?.setItem(key(householdId), JSON.stringify(list)); else storage(s)?.removeItem(key(householdId)) } catch { /* sem armazenamento */ }
}

/** Junta na fila. Marcar e desmarcar a mesma coisa se anulam (nada a enviar). */
export function enqueue(list: OutItem[], item: OutItem): OutItem[] {
  if (item.kind === 'task') {
    const prev = list.find(x => x.kind === 'task' && x.taskId === item.taskId && x.date === item.date)
    if (prev) return list.filter(x => x !== prev).concat((prev as any).done === item.done ? [item] : [])
  }
  if (item.kind === 'dogs') {
    const k = (x: OutItem) => x.kind === 'dogs' ? x.ids.slice().sort().join(',') + x.date : ''
    const prev = list.find(x => x.kind === 'dogs' && k(x) === k(item))
    if (prev) return list.filter(x => x !== prev).concat((prev as any).done === item.done ? [item] : [])
  }
  return list.concat([item])
}

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16) })

export interface FlushDeps {
  task: (taskId: string, date: string, by: Who, done: boolean) => Promise<void>
  dogs: (ids: string[], date: string, by: Who, done: boolean) => Promise<void>
  log: (it: Extract<OutItem, { kind: 'log' }>) => Promise<void>
  isOffline: (e: unknown) => boolean
}
/** Envia em ordem. Sem internet: para e guarda o resto. Recusado pelo banco: descarta e avisa. */
export async function flush(list: OutItem[], d: FlushDeps): Promise<{ left: OutItem[], sent: number, rejected: Array<{ item: OutItem, error: unknown }> }> {
  const left = [...list]; let sent = 0; const rejected: Array<{ item: OutItem, error: unknown }> = []
  while (left.length) {
    const it = left[0]
    try {
      if (it.kind === 'task') await d.task(it.taskId, it.date, it.by, it.done)
      else if (it.kind === 'dogs') await d.dogs(it.ids, it.date, it.by, it.done)
      else await d.log(it)
      sent++
    } catch (e) {
      if (d.isOffline(e)) break
      rejected.push({ item: it, error: e })
    }
    left.shift()
  }
  return { left, sent, rejected }
}
