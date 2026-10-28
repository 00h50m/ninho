import { describe, expect, it } from 'vitest'
import { byRoom, forgotten, weeksByPerson } from '@/lib/retro'
import type { Dog, Task } from '@/lib/types'

// Dados fictícios. 2026-10-28 é quarta-feira; a semana começa em 2026-10-26.
const T = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'kitchen', weight: 'light', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, hist: [], ...o })
const dog = (hist: Task['hist'], today = false): Dog => ({ id: 'd', name: 'Cachorra', routines: [{ id: 'r', title: 'Passeio', frequency: 'daily', scheduled_time: null, hist, completed_today: today, completed_by_today: today ? 's' : null }] } as unknown as Dog)
const today = '2026-10-28'

describe('retrospectiva: semana a semana por pessoa', () => {
  it('8 semanas, a atual por último, com hoje e as rotinas dos cães', () => {
    const tasks = [T('a', { hist: [{ d: '2026-10-27', by: 'g' }, { d: '2026-10-20', by: 's' }, { d: '2026-10-19', by: null }, { d: '2026-08-01', by: 'g' }], completed_today: true, completed_by_today: 'g' })]
    const w = weeksByPerson({ tasks, dogs: [dog([{ d: '2026-10-26', by: 's' }], true)], today })
    expect(w).toHaveLength(8)
    expect(w[0].week).toBe('2026-09-07')
    expect(w[7]).toEqual({ week: '2026-10-26', g: 2, s: 2, x: 0 })
    expect(w[6]).toEqual({ week: '2026-10-19', g: 0, s: 1, x: 1 })
    // fora da janela não conta
    expect(w.reduce((a, x) => a + x.g + x.s + x.x, 0)).toBe(6)
  })
})

describe('retrospectiva: por cômodo', () => {
  it('últimos 28 dias, cães juntos, do maior para o menor', () => {
    const tasks = [
      T('a', { category: 'kitchen', hist: [{ d: '2026-10-27', by: 'g' }, { d: '2026-10-01', by: 's' }, { d: '2026-09-30', by: 's' }] }),
      T('b', { category: 'bathroom', hist: [{ d: '2026-10-20', by: 'g' }] , completed_today: true, completed_by_today: 's' }),
      T('c', { category: 'bedroom', hist: [] }),
    ]
    expect(byRoom({ tasks, dogs: [dog([{ d: '2026-10-25', by: 'g' }, { d: '2026-10-24', by: 'g' }, { d: '2026-10-23', by: 's' }])], today }))
      .toEqual([{ cat: 'dogs', label: '🐾 Cães', n: 3 }, { cat: 'bathroom', label: '🚿 Banheiro', n: 2 }, { cat: 'kitchen', label: '🍳 Cozinha', n: 2 }])
  })
})

describe('retrospectiva: mais esquecidas', () => {
  const days = (from: string, n: number, step = 1) => Array.from({ length: n }, (_, i) => { const d = new Date(from + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - i * step); return { d: d.toISOString().slice(0, 10), by: 'g' as const } })
  it('diária: conta até ontem (hoje ainda dá tempo); da pior para a melhor', () => {
    const r = forgotten({ tasks: [
      T('quase', { hist: days('2026-10-27', 25) }),
      T('nunca', { hist: [] }),
      T('sempre', { hist: days('2026-10-27', 27) }),
    ], today })
    expect(r.map(x => [x.task.id, x.done, x.expected])).toEqual([['nunca', 0, 27], ['quase', 25, 27]])
    expect(r[0].last).toBeNull()
    expect(r[1].last).toBe('2026-10-27')
  })
  it('semanal: semana atual só conta se já foi feita; respeita criação, pontual, pausa e período', () => {
    const r = forgotten({ tasks: [
      T('sem', { frequency: 'weekly', hist: [{ d: '2026-10-21', by: 's' }, { d: '2026-10-07', by: 's' }] }),
      T('nova', { created_at: '2026-10-25T10:00:00Z', hist: [] }),
      T('pontual', { frequency: 'once' }),
      T('pausa', { paused_until: '2026-12-01', hist: [] }),
      T('periodo', { frequency: 'weekly', starts_on: '2026-10-26', hist: [] }),
    ], today }, 28)
    // janela desde 01/10: semanas de 28/09, 05/10, 12/10 e 19/10 (a atual, sem conclusão, fica de fora)
    const sem = r.find(x => x.task.id === 'sem')!
    expect([sem.done, sem.expected]).toEqual([2, 4])
    expect(r.find(x => x.task.id === 'nova')).toMatchObject({ done: 0, expected: 3 })
    expect(r.map(x => x.task.id)).not.toContain('pontual')
    expect(r.map(x => x.task.id)).not.toContain('pausa')
    expect(r.map(x => x.task.id)).not.toContain('periodo')
  })
  it('no máximo 5', () => {
    expect(forgotten({ tasks: Array.from({ length: 8 }, (_, i) => T('t' + i)), today })).toHaveLength(5)
  })
})
