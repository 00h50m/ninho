import { describe, expect, it } from 'vitest'
import { byRoom, forgotten, lighter, retroWeekLines, stuck, weeksByPerson } from '@/lib/retro'
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

describe('retrospectiva: ajuste sugerido', () => {
  it('diária vira 3x por semana; com poucos dias, semanal; semanal, quinzenal; quinzenal, mensal; mensal, nada', () => {
    expect(lighter({ frequency: 'daily', weekdays: null })).toEqual({ label: '3 vezes por semana (seg, qua e sex)', patch: { weekdays: [1, 3, 5] } })
    expect(lighter({ frequency: 'daily', weekdays: [1, 2, 3, 4, 5] })!.patch).toEqual({ weekdays: [1, 3, 5] })
    expect(lighter({ frequency: 'daily', weekdays: [1, 4] })).toEqual({ label: '1 vez por semana', patch: { frequency: 'weekly', weekdays: null } })
    expect(lighter({ frequency: 'weekly' })!.patch).toEqual({ frequency: 'biweekly' })
    expect(lighter({ frequency: 'biweekly' })!.patch).toEqual({ frequency: 'monthly' })
    expect(lighter({ frequency: 'monthly' })).toBeNull()
  })
})

describe('retrospectiva: esquecida 3 semanas seguidas', () => {
  // semanas fechadas antes de 26/10: 19/10, 12/10 e 05/10
  const at = (...ds: string[]) => ds.map(d => ({ d, by: 'g' as const }))
  it('menos da metade em cada uma das 3 semanas; uma semana boa já tira da lista', () => {
    const r = stuck({ today, tasks: [
      T('esquecida', { hist: at('2026-10-20', '2026-10-13', '2026-10-06') }),
      T('uma boa', { hist: at('2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22') }),
      T('semanal nunca', { frequency: 'weekly' }),
      T('semanal feita', { frequency: 'weekly', hist: at('2026-10-14') }),
      T('mensal', { frequency: 'monthly' }),
      T('nova', { created_at: '2026-10-10T12:00:00Z' }),
    ] })
    expect(r.map(t => t.id)).toEqual(['esquecida', 'semanal nunca'])
  })
})

describe('retrospectiva: resumo de domingo', () => {
  it('cada uma contra a semana anterior, cômodo e a mais esquecida', () => {
    const sunday = '2026-11-01'
    const tasks = [
      T('Louça', { category: 'kitchen', hist: [{ d: '2026-10-31', by: 'g' }, { d: '2026-10-30', by: 'g' }, { d: '2026-10-29', by: 's' }, { d: '2026-10-22', by: 's' }, { d: '2026-10-21', by: 's' }] }),
      T('Regar', { category: 'general', hist: [{ d: '2026-10-20', by: 'g' }] }),
    ]
    expect(retroWeekLines({ tasks, dogs: [], today: sunday }, { g: 'Giovanna Teste', s: 'Sabrina Teste' })).toEqual([
      '📊 Retrospectiva da semana',
      '• Giovanna: 2 (semana passada 1 ↑)',
      '• Sabrina: 1 (semana passada 2 ↓)',
      '🏠 Cômodo que mais andou: 🍳 Cozinha (3)',
      '🧺 Mais esquecida: Regar · feita 1 de 27 dias em 4 semanas',
    ])
    expect(retroWeekLines({ tasks: [T('x')], dogs: [], today: sunday }, { g: 'G', s: 'S' })).toEqual([])
  })
})
