import { describe, expect, it } from 'vitest'
import { enqueue, flush, readOutbox, writeOutbox, type OutItem } from '@/lib/outbox'

const t = (done: boolean, taskId = 't1'): OutItem => ({ id: Math.random().toString(), at: '', kind: 'task', done, taskId, date: '2026-10-06', by: 'g', title: 'Louça' })
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } } }

describe('fila sem internet', () => {
  it('marcar e desmarcar a mesma tarefa se anulam', () => {
    expect(enqueue(enqueue([], t(true)), t(false))).toEqual([])
    expect(enqueue(enqueue([], t(true)), t(true, 't2'))).toHaveLength(2)
  })
  it('rotinas dos cães: mesmo grupo se anula', () => {
    const d = (done: boolean): OutItem => ({ id: '', at: '', kind: 'dogs', done, ids: ['b', 'a'], date: '2026-10-06', by: 's', title: 'Ração' })
    expect(enqueue(enqueue([], d(true)), { ...d(false), ids: ['a', 'b'] } as OutItem)).toEqual([])
  })
  it('guarda no aparelho e lê de volta', () => {
    const s = mem()
    writeOutbox('h', [t(true)], s); expect(readOutbox('h', s)).toHaveLength(1)
    writeOutbox('h', [], s); expect(readOutbox('h', s)).toEqual([])
  })
  it('envia em ordem; sem internet para; recusado é descartado', async () => {
    const calls: string[] = []
    let online = true
    const deps = {
      task: async (id: string, _d: string, _b: any, done: boolean) => { if (!online) throw new Error('Failed to fetch'); if (id === 'bad') throw new Error('NINHO_NOT_FOUND'); calls.push(`${id}:${done}`) },
      dogs: async () => { calls.push('dogs') }, log: async () => { calls.push('log') },
      isOffline: (e: unknown) => /fetch/i.test(String((e as any)?.message)),
    }
    const r = await flush([t(true, 'a'), t(true, 'bad'), t(true, 'c')], deps)
    expect(calls).toEqual(['a:true', 'c:true']); expect(r.sent).toBe(2); expect(r.rejected).toHaveLength(1); expect(r.left).toEqual([])
    online = false
    const r2 = await flush([t(true, 'd'), t(true, 'e')], deps)
    expect(r2.sent).toBe(0); expect(r2.left).toHaveLength(2)
  })
})
