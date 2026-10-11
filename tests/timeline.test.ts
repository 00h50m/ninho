import { describe, expect, it } from 'vitest'
import { buildTimeline, periodOfTime } from '@/lib/timeline'

const task = (id: string, title: string, time: string | null, o: any = {}) => ({
  id, frequency: 'daily', scheduled_time: time, completed_today: !!o.done, essential: !!o.ess, category: 'general',
  task: { id, title, category: 'general', weight: o.weight || 'light', frequency: 'daily', assigned_to: 'g', scheduled_time: time, essential: !!o.ess, active: true, completed_today: !!o.done },
}) as any
const dog = (key: string, title: string, time: string) => ({
  id: 'dog:' + key, frequency: 'daily', scheduled_time: time, completed_today: false, essential: false, category: 'dogs',
  dog: { key, title, frequency: 'daily', scheduled_time: time, completed_today: false, owner: 'g', parts: [{ dog: { name: 'Penélope' } }, { dog: { name: 'Zelda' } }] },
}) as any
const ev = (id: string, title: string, time: string | null, who: any, o: any = {}) => ({ id, kind: o.kind || 'compromisso', title, date: '2026-10-12', time, who, notes: null, link: null, paid: null, done_at: o.done ? 'x' : null }) as any

describe('linha do tempo do dia', () => {
  it('junta tudo em ordem, por período, com o ▷ agora e a linha "agora"', () => {
    const t = buildTimeline({
      who: 'g', nowHM: '14:10',
      items: [task('a', 'Lavar a louça', '13:00'), task('b', 'Regar plantas', '09:00', { done: true }), dog('racao', 'Ração noite', '19:00'), task('c', 'Pagar boleto', null, { ess: true }), task('d', 'Reset da sala', '21:30', { weight: 'medium' })],
      events: [ev('e1', 'Dentista', '14:00', 'g'), ev('e2', 'Jantar da Sabrina', '20:00', 's'), ev('e3', 'Luz', null, 'g', { kind: 'vencimento' }), ev('e4', 'Cinema', '20:30', 'both')],
      routines: [{ r: { id: 'r1', title: 'Fechar a cozinha', scheduled_time: '22:00:00', duration_min: 20, essential: false } as any, done: false, steps: '0/4 passos' }],
      doses: [{ med: { id: 'm1', name: 'Vitamina D', dose: '1 cápsula' } as any, time: '08:00', taken: null, late: true }],
    })
    expect(t.periods.map(p => `${p.k}: ${p.entries.map(e => `${e.time} ${e.title}${e.done ? ' ✓' : ''}${e.late ? ' !' : ''}`).join(' | ')}`)).toEqual([
      'manha: 08:00 Vitamina D ! | 09:00 Regar plantas ✓',
      'tarde: 13:00 Lavar a louça ! | 14:00 Dentista',
      'noite: 19:00 Ração noite | 20:30 Cinema | 21:30 Reset da sala | 22:00 Fechar a cozinha',
    ])
    // o compromisso das 14:00 ainda está acontecendo (até 15:00): é o "agora"
    expect(t.nowKey).toBe('e:e1')
    expect(t.nowAt).toEqual({ period: 'tarde', index: 2 })
    expect(t.loose.map(e => e.title)).toEqual(['Pagar boleto'])
    expect(t.periods[2].entries[0].sub).toBe('Penélope, Zelda')
    expect(t.periods[2].entries[2].end).toBe('21:50')
    // agenda não conta no progresso; atrasado só o que tem hora e não foi feito
    expect([t.done, t.total]).toEqual([1, 7])
  })
  it('depois que tudo passou, o próximo é o primeiro pendente que não está atrasado', () => {
    const t = buildTimeline({ who: 's', nowHM: '15:20', items: [task('a', 'Varrer', '15:00', { weight: 'heavy' }), task('b', 'Lixo', '18:00')], events: [], routines: [], doses: [] })
    // varrer (15:00–15:40) já começou: está atrasado, então o "agora" vai para o lixo
    expect(t.periods[0].entries[0].late).toBe(true)
    expect(t.nowKey).toBe('t:b')
    expect(t.nowAt).toEqual({ period: 'tarde', index: 1 })
  })
  it('sem nada no período de agora: sem linha; períodos', () => {
    const t = buildTimeline({ who: 'g', nowHM: '07:00', items: [task('a', 'Varrer', '19:00')], events: [], routines: [], doses: [] })
    expect(t.nowAt).toBeNull()
    expect(t.nowKey).toBe('t:a')
    expect([periodOfTime('11:59'), periodOfTime('12:00'), periodOfTime('18:00')]).toEqual(['manha', 'tarde', 'noite'])
  })
})
