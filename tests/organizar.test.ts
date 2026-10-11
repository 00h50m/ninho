import { describe, expect, it } from 'vitest'
import { dayContext, endOf, fallbackDay, toEvent, toTask, validateDay } from '@/lib/organizar'

const C = { today: '2026-10-12', me: 'g' as const }
describe('organize meu dia', () => {
  it('confere a resposta e ordena por data e hora', () => {
    const p = validateDay({ tips: ['Deixei o mercado para amanhã', ''], items: [
      { title: 'Mercado', kind: 'tarefa', date: '2026-10-13', time: '10:00', min: 60, who: 'g', priority: 'baixa', category: 'shopping', note: null },
      { title: 'Dentista', kind: 'compromisso', date: '2026-10-12', time: '14:30', min: 60, who: 'g', priority: 'alta', category: 'general', note: 'levar exame' },
      { title: 'Responder e-mails', kind: 'tarefa', date: '2026-10-12', time: '09:00', min: 30, who: 'x', priority: 'zzz', category: 'nada', note: null },
      { title: 'Ração', kind: 'compra', date: 'ontem', time: '08:00', min: 5, who: 's', priority: 'normal', category: 'dogs', note: null },
      { title: '', kind: 'tarefa', date: '2026-10-12', time: '11:00', min: 10, who: 'g', priority: 'normal', category: 'general', note: null },
      { title: 'Viagem', kind: 'tarefa', date: '2027-01-01', time: '25:00', min: 9999, who: 'both', priority: 'normal', category: 'general', note: null },
    ] }, C)!
    expect(p.items.map(i => `${i.date}|${i.time}|${i.title}|${i.kind}|${i.who}|${i.priority}|${i.category}|${i.min}`)).toEqual([
      '2026-10-12|09:00|Responder e-mails|tarefa|g|normal|general|30',
      '2026-10-12|14:30|Dentista|compromisso|g|alta|general|60',
      '2026-10-12|null|Ração|compra|s|normal|dogs|5',
      '2026-10-12|null|Viagem|tarefa|both|normal|general|480',
      '2026-10-13|10:00|Mercado|tarefa|g|baixa|shopping|60',
    ])
    expect(p.tips).toEqual(['Deixei o mercado para amanhã'])
    expect(validateDay({ items: [] }, C)).toBeNull()
  })
  it('vira tarefa avulsa ou compromisso da agenda', () => {
    const [t] = validateDay({ items: [{ title: 'Limpar a geladeira', kind: 'tarefa', date: '2026-10-12', time: '16:00', min: 40, who: 'both', priority: 'alta', category: 'kitchen', note: null }] }, C)!.items
    expect(toTask(t)).toMatchObject({ frequency: 'once', due_date: '2026-10-12', scheduled_time: '16:00', assigned_to: null, weight: 'heavy', essential: true, category: 'kitchen' })
    expect(toEvent({ ...t, kind: 'compromisso' })).toMatchObject({ kind: 'compromisso', date: '2026-10-12', time: '16:00', who: 'both' })
    expect(endOf(t)).toBe('16:40')
  })
  it('sem IA e contexto', () => {
    expect(fallbackDay('pagar boleto, ligar pro gás', 's', '2026-10-12')!.items.map(i => `${i.title}|${i.who}`)).toEqual(['Pagar boleto|s', 'Ligar pro gás|s'])
    const ctx = dayContext({ today: '2026-10-12', hm: '08:10', me: 'g', names: { g: 'Giovanna Cupo', s: 'Sabrina' }, existing: [{ title: 'Reset da sala', time: '23:30', who: 'g', kind: 'tarefa' }] }, 'dentista 14h30', 1)
    expect(ctx).toContain('Hoje: 2026-10-12 (segunda), agora 08:10'); expect(ctx).toContain('- 23:30 · Reset da sala · tarefa · g'); expect(ctx).toContain('<despejo>dentista 14h30</despejo>')
  })
})
