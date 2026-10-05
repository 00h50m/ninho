import { describe, expect, it } from 'vitest'
import { getLevel, levelProgress, weekDots, xpForWeight, xpReason } from '@/lib/xp'
import { completedByLabel, summarizeCompletions } from '@/lib/completions'
import { createPendingGuard } from '@/lib/pending'
import { readFileSync } from 'node:fs'

describe('XP', () => {
  it('peso → XP igual ao banco (ninho_xp_for_weight)', () => {
    expect([xpForWeight('light'), xpForWeight('medium'), xpForWeight('heavy'), xpForWeight('?')]).toEqual([1, 2, 3, 1])
    const sql = readFileSync('supabase/migrations/20261005120200_completion_rpcs.sql', 'utf8')
    expect(sql).toContain("when 'light' then 1 when 'medium' then 2 when 'heavy' then 3 else 1")
  })
  it('origem do XP no mesmo formato do banco', () => {
    expect(xpReason('task', 'abc', '2026-10-07')).toBe('task:abc:2026-10-07')
    expect(xpReason('dog', 'r1', '2026-10-07')).toBe('dog:r1:2026-10-07')
  })
  it('níveis', () => {
    expect(getLevel(0).l).toBe(1)
    expect(getLevel(100).l).toBe(2)
    expect(getLevel(1500).l).toBe(5)
    expect(levelProgress(50)).toBe(50)
    expect(levelProgress(-5)).toBe(0)
  })
})

describe('sequência (bolinhas da semana)', () => {
  it('quarta, sequência 3 com conclusão hoje: seg, ter e qua acesas', () => {
    expect(weekDots(2, 3, true)).toEqual(['on', 'on', 'on', '', '', '', ''])
  })
  it('quarta, sequência 2 sem conclusão hoje: seg e ter acesas, hoje marcado', () => {
    expect(weekDots(2, 2, false)).toEqual(['on', 'on', 'today', '', '', '', ''])
  })
  it('domingo sem sequência', () => {
    expect(weekDots(6, 0, false)).toEqual(['', '', '', '', '', '', 'today'])
  })
})

describe('conclusões e autoria', () => {
  const today = '2026-10-07'
  const info = summarizeCompletions([
    { id: 'c1', task_id: 'a', date: today, completed_by: 's' },
    { id: 'c2', task_id: 'b', date: today, completed_by: null },       // registro antigo
    { id: 'c3', task_id: 'b', date: '2026-10-01' },
    { id: 'c4', task_id: 'b', date: '2026-10-05' },
    { id: 'c5', task_id: 'c', date: '2026-10-06', completed_by: 'x' }, // valor inválido
  ], 'task_id', today)

  it('marca feita hoje, por quem e o id da conclusão', () => {
    expect(info('a')).toEqual({ completed_today: true, completed_by_today: 's', completion_id: 'c1', prev_done: null, hist: [] })
  })
  it('registro antigo sem completed_by fica como não identificado', () => {
    const b = info('b')
    expect(b.completed_today).toBe(true)
    expect(b.completed_by_today).toBeNull()
    expect(completedByLabel(b.completed_by_today, { g: 'Giovanna', s: 'Sabrina' })).toBe('não identificado')
  })
  it('última vez antes de hoje', () => {
    expect(info('b').prev_done).toBe('2026-10-05')
    expect(info('c')).toMatchObject({ completed_today: false, prev_done: '2026-10-06' })
    expect(info('z')).toMatchObject({ completed_today: false, prev_done: null })
  })
  it('rótulo usa o primeiro nome', () => {
    expect(completedByLabel('g', { g: 'Giovanna Cupo', s: 'Sabrina' })).toBe('Giovanna')
  })
})

describe('bloqueio de envio duplo', () => {
  it('ignora o segundo clique enquanto o primeiro grava', async () => {
    const g = createPendingGuard()
    let calls = 0
    let release!: () => void
    const slow = () => new Promise<void>(r => { calls++; release = r })
    const first = g.run(['task:a'], slow)
    const second = await g.run(['task:a'], slow)
    expect(second).toBe(false)
    expect(calls).toBe(1)
    release(); await first
    expect(g.has('task:a')).toBe(false)
    expect(await g.run(['task:a'], async () => { calls++ })).toBe(true)
    expect(calls).toBe(2)
  })
  it('libera a chave mesmo se a gravação falhar', async () => {
    const g = createPendingGuard()
    await expect(g.run(['x'], async () => { throw new Error('falhou') })).rejects.toThrow('falhou')
    expect(g.has('x')).toBe(false)
  })
  it('lote de rotinas bloqueia cada rotina', async () => {
    const g = createPendingGuard()
    let release!: () => void
    const p = g.run(['dog:r1', 'dog:r2'], () => new Promise<void>(r => { release = r }))
    expect(await g.run(['dog:r2'], async () => {})).toBe(false)
    release(); await p
  })
})
