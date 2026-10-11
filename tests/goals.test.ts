import { describe, expect, it } from 'vitest'
import { goalLine, goalProgress, type PGoal } from '@/lib/goals'
import { monthGrid, moodInsights, moodStats } from '@/lib/humor'
import type { PLog } from '@/lib/meudia'

const G = (p: Partial<PGoal>): PGoal => ({ id: 'g1', who: 'g', title: 'x', kind: 'manual', unit: null, start_value: null, target: 10, start_date: '2026-10-01', due_date: null, status: 'ativo', ...p })
const L = (p: Partial<PLog>): PLog => ({ id: Math.random().toString(), who: 'g', date: '2026-10-05', kind: 'agua', value: 0, data: {}, ...p })

describe('objetivos', () => {
  it('peso: kg perdidos, faltam, ritmo necessário e se está no ritmo', () => {
    const g = G({ kind: 'peso', start_value: 72, target: 60, start_date: '2026-10-01', due_date: '2027-03-30' })
    const logs = [L({ kind: 'corpo', date: '2026-10-01', value: 72 }), L({ kind: 'corpo', date: '2026-10-29', value: 71 })]
    const p = goalProgress(g, logs, '2026-10-29')
    expect([p.done, p.total, p.pct, p.left, p.current]).toEqual([1, 12, 8, 11, 71])
    expect(p.daysLeft).toBe(152)
    expect(p.perWeek).toBe(0.5)
    expect(p.state).toBe('ok')
    expect(goalLine(g, p)).toBe('Perder 12 kg (chegar a 60 kg)')
    // ganhar peso também funciona; engordar num objetivo de perder não conta como progresso
    expect(goalProgress(G({ kind: 'peso', start_value: 55, target: 60 }), [L({ kind: 'corpo', value: 57 })], '2026-10-05').done).toBe(2)
    expect(goalProgress(g, [L({ kind: 'corpo', value: 73 })], '2026-10-05').done).toBe(0)
  })
  it('treinos e água contam só dentro do período', () => {
    const logs = [L({ kind: 'treino', date: '2026-09-30', value: 30 }), L({ kind: 'treino', date: '2026-10-02', value: 30 }), L({ kind: 'treino', date: '2026-10-03', value: 30 }),
      L({ kind: 'agua', date: '2026-10-02', value: 2000 }), L({ kind: 'agua', date: '2026-10-03', value: 1000 }), L({ kind: 'agua', date: '2026-10-03', value: 900 })]
    expect(goalProgress(G({ kind: 'treinos', target: 40 }), logs, '2026-10-05').done).toBe(2)
    expect(goalProgress(G({ kind: 'agua', target: 30 }), logs, '2026-10-05', 2000).done).toBe(1)
  })
  it('outro: soma o que foi lançado; atrasado quando bem atrás do prazo; feito em 100%', () => {
    const g = G({ unit: 'livros', target: 12, start_date: '2026-01-01', due_date: '2026-12-31' })
    const logs = [L({ kind: 'objetivo', value: 2, data: { goal_id: 'g1' } }), L({ kind: 'objetivo', value: 1, data: { goal_id: 'outro' } })]
    const p = goalProgress(g, logs, '2026-10-05')
    expect([p.done, p.pct, p.state]).toEqual([2, 17, 'atras'])
    expect(goalProgress(g, [L({ kind: 'objetivo', value: 12, data: { goal_id: 'g1' } })], '2026-10-05').state).toBe('feito')
  })
  it('peso sem nenhum dado', () => {
    expect(goalProgress(G({ kind: 'peso', target: 60 }), [], '2026-10-05').state).toBe('sem_dado')
  })
})

describe('humor', () => {
  it('calendário do mês começa no domingo', () => {
    const g = monthGrid(2026, 10)
    expect(g[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03'])
    expect(g[g.length - 1].filter(Boolean).pop()).toBe('2026-10-31')
    expect(g.every(w => w.length === 7)).toBe(true)
  })
  it('dias registrados e humor predominante', () => {
    const rows = [{ date: '2026-10-01', mood: 'otimo' }, { date: '2026-10-02', mood: 'otimo' }, { date: '2026-10-03', mood: 'bem' }, { date: '2026-10-04', mood: null }, { date: '2026-09-01', mood: 'pesado' }] as any
    const s = moodStats(rows, '2026-10-04', '2026-10-01', '2026-10-31')
    expect([s.days7, s.days30]).toEqual([3, 3])
    expect(s.top).toMatchObject({ id: 'otimo', n: 2, pct: 67 })
  })
  it('o que acompanha os dias melhores (só com dados suficientes)', () => {
    const days = ['01', '02', '03', '04', '05', '06'].map(d => `2026-10-${d}`)
    const rows = days.map((date, i) => ({ date, mood: i < 3 ? 'otimo' : 'cansaco' })) as any
    const logs = days.flatMap((date, i) => [L({ kind: 'sono', date, value: i < 3 ? 8 : 6 })])
    expect(moodInsights(rows, logs, 'g', 7.5, 2000).map(x => x.text)).toEqual(['Nos dias depois de dormir na meta, seu humor costuma ser melhor.'])
    expect(moodInsights(rows.slice(0, 4), logs, 'g', 7.5, 2000)).toEqual([])
  })
})
