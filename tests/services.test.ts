import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase simulado: registra cada chamada e devolve o que o teste mandar.
const calls: Array<{ table?: string, rpc?: string, ops: Array<[string, unknown[]]> }> = []
let nextResult: (c: { table?: string, rpc?: string }) => { data: unknown, error: unknown } = () => ({ data: [], error: null })

function builder(entry: { table?: string, rpc?: string, ops: Array<[string, unknown[]]> }): any {
  const b: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') return (res: any, rej: any) => Promise.resolve(nextResult(entry)).then(res, rej)
      return (...args: unknown[]) => { entry.ops.push([prop, args]); return b }
    },
  })
  return b
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => { const e = { table, ops: [] as Array<[string, unknown[]]> }; calls.push(e); return builder(e) },
    rpc: (rpc: string, args: unknown) => { const e = { rpc, ops: [['args', [args]]] as Array<[string, unknown[]]> }; calls.push(e); return builder(e) },
  },
}))

import * as api from '@/lib/services/ninho'
import { NinhoError } from '@/lib/errors'

beforeEach(() => { calls.length = 0; nextResult = () => ({ data: [], error: null }) })

const HH = '11111111-1111-1111-1111-111111111111'

describe('isolamento por casa nas consultas', () => {
  it('toda leitura de tarefas, conclusões e cães filtra por household_id', async () => {
    await api.loadTasks(HH, '2026-10-07')
    await api.loadDogs(HH, '2026-10-07')
    await api.loadAccidents(HH)
    await api.loadNames(HH)
    await api.loadSettings(HH, '2026-10-05')
    const reads = calls.filter(c => c.table)
    expect(reads.length).toBeGreaterThanOrEqual(6)
    for (const c of reads) {
      expect(c.ops, c.table).toContainEqual(['eq', ['household_id', HH]])
    }
  })
  it('conclusões de rotina agora são lidas pela casa, não por lista de ids', async () => {
    await api.loadDogs(HH, '2026-10-07')
    const dc = calls.find(c => c.table === 'dog_completions')!
    expect(dc.ops).toContainEqual(['eq', ['household_id', HH]])
    expect(dc.ops.some(([op]) => op === 'in')).toBe(false)
  })
})

describe('conclusões: datas e autoria explícitas', () => {
  it('concluir tarefa envia data e quem concluiu', async () => {
    nextResult = () => ({ data: { created: true, completed_by: 'g', completion_id: 'c1', xp: 2 }, error: null })
    const r = await api.completeTask('t1', '2026-10-07', 'g')
    expect(calls[0]).toMatchObject({ rpc: 'ninho_complete_task' })
    expect(calls[0].ops[0][1][0]).toEqual({ p_task_id: 't1', p_date: '2026-10-07', p_by: 'g' })
    expect(r.created).toBe(true)
  })
  it('lote de rotinas envia todos os ids numa chamada só (transação única)', async () => {
    nextResult = () => ({ data: { created: 2, xp_added: 2, completions: [] }, error: null })
    await api.completeDogRoutines(['r1', 'r2'], '2026-10-07', 's')
    expect(calls).toHaveLength(1)
    expect(calls[0].ops[0][1][0]).toEqual({ p_routine_ids: ['r1', 'r2'], p_date: '2026-10-07', p_by: 's' })
  })
  it('sequência pede o dia de São Paulo explicitamente', async () => {
    nextResult = (c) => ({ data: c.rpc === 'ninho_household_xp' ? 7 : 3, error: null })
    const s = await api.loadStats(HH, '2026-10-07')
    expect(s).toEqual({ xp: 7, streak: 3 })
    const streak = calls.find(c => c.rpc === 'ninho_streak')!
    expect(streak.ops[0][1][0]).toEqual({ p_household_id: HH, p_today: '2026-10-07' })
  })
})

describe('erros do banco nunca viram "feito"', () => {
  it('erro do Supabase vira NinhoError com mensagem compreensível', async () => {
    nextResult = () => ({ data: null, error: { code: '22023', message: 'NINHO_INVALID_PERSON: quem concluiu deve ser g ou s' } })
    const p = api.completeTask('t1', '2026-10-07', 'g')
    await expect(p).rejects.toBeInstanceOf(NinhoError)
    await expect(api.completeTask('t1', '2026-10-07', 'g')).rejects.toMatchObject({ userMessage: expect.stringContaining('Ajustes') })
  })
  it('banco sem as migrations: avisa que precisa atualizar', async () => {
    nextResult = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    await expect(api.uncompleteTask('t1', '2026-10-07')).rejects.toMatchObject({ userMessage: expect.stringContaining('migrations') })
  })
  it('sem internet: pode tentar de novo', async () => {
    nextResult = () => { throw new TypeError('Failed to fetch') }
    await expect(api.updateTask('t1', { essential: true })).rejects.toMatchObject({ retryable: true, userMessage: expect.stringContaining('conexão') })
  })
  it('logs técnicos não levam o conteúdo gravado', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    nextResult = () => ({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(api.saveMeeting(HH, '2026-10-05', { what_worked: 'segredo da casa' } as any)).rejects.toBeInstanceOf(NinhoError)
    expect(JSON.stringify(spy.mock.calls)).not.toContain('segredo da casa')
    spy.mockRestore()
  })
})
