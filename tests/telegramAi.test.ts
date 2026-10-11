import { describe, expect, it } from 'vitest'
import { contextText, describe as describePlan, nearestDose, validate, type AiContext } from '@/lib/telegramAi'

const C: AiContext = {
  today: '2026-10-09', hm: '09:40', me: 'g', names: { g: 'Giovanna Cupo', s: 'Sabrina' },
  dogs: [{ id: 'd-pen', name: 'Penélope' }, { id: 'd-zel', name: 'Zelda' }],
  tasks: [{ id: 't-1', title: 'Louça diária' }, { id: 't-2', title: 'Reset da sala' }],
  meds: [{ id: 'm-1', name: 'Vitamina D', times: ['08:00', '20:00'] }], cupMl: 300,
}
const blank = { items: null, dogs: null, kind: null, title: null, date: null, next_date: null, weight_kg: null, time: null, who: null, id: null, ml: null }
const act = (p: Record<string, unknown>) => ({ ...blank, ...p })

describe('IA do Telegram: conferir o que a IA propõe', () => {
  it('compras com quantidade', () => {
    const r = validate({ reply: null, actions: [act({ type: 'compras', items: [{ title: ' leite ', qty: null }, { title: 'arroz', qty: '2 kg' }, { title: '', qty: null }] })] }, C)
    expect(r.actions).toEqual([{ type: 'compras', items: [{ title: 'leite', qty: null }, { title: 'arroz', qty: '2 kg' }] }])
  })
  it('saúde: nome da cachorra (sem acento), "as duas", data no futuro recusada, peso precisa de valor', () => {
    const r = validate({ reply: null, actions: [
      act({ type: 'saude_cao', dogs: ['zelda'], kind: 'vacina', title: 'V10', date: '2026-10-09', next_date: '2027-10-09' }),
      act({ type: 'saude_cao', dogs: ['as duas'], kind: 'banho', title: 'Banho', date: '2026-10-08' }),
      act({ type: 'saude_cao', dogs: ['Penelope'], kind: 'vacina', title: 'V10', date: '2026-10-20' }),
      act({ type: 'saude_cao', dogs: ['Zelda'], kind: 'peso', title: 'Peso', date: '2026-10-09' }),
      act({ type: 'saude_cao', dogs: ['Rex'], kind: 'vacina', title: 'V10', date: '2026-10-09' }),
      act({ type: 'saude_cao', dogs: ['Zelda'], kind: 'diagnostico', title: 'x', date: '2026-10-09' }),
    ] }, C)
    expect(r.actions).toEqual([
      { type: 'saude_cao', dogs: ['d-zel'], kind: 'vacina', title: 'V10', date: '2026-10-09', next_date: '2027-10-09', weight_kg: null },
      { type: 'saude_cao', dogs: ['d-pen', 'd-zel'], kind: 'banho', title: 'Banho', date: '2026-10-08', next_date: null, weight_kg: null },
    ])
    expect(r.dropped).toBe(4)
  })
  it('agenda: tipo desconhecido vira compromisso; data passada recusada; horário inválido some', () => {
    const r = validate({ reply: null, actions: [
      act({ type: 'agenda', kind: 'vencimento', title: 'Pagar internet', date: '2026-10-09', who: 's' }),
      act({ type: 'agenda', kind: 'festa', title: 'Aniversário', date: '2026-10-11', time: '25:00', who: 'x' }),
      act({ type: 'agenda', kind: 'visita', title: 'Visita', date: '2026-10-01' }),
    ] }, C)
    expect(r.actions).toEqual([
      { type: 'agenda', kind: 'vencimento', title: 'Pagar internet', date: '2026-10-09', time: null, who: 's' },
      { type: 'agenda', kind: 'compromisso', title: 'Aniversário', date: '2026-10-11', time: null, who: 'both' },
    ])
  })
  it('tarefa, água e remédio só com ids que existem', () => {
    const r = validate({ reply: null, actions: [
      act({ type: 'tarefa_feita', id: 't-1' }), act({ type: 'tarefa_feita', id: 't-1' }), act({ type: 'tarefa_feita', id: 'inventado' }),
      act({ type: 'agua', ml: 300 }), act({ type: 'agua', ml: 9000 }),
      act({ type: 'remedio_tomado', id: 'm-1' }), act({ type: 'remedio_tomado', id: 'm-9' }),
    ] }, C)
    expect(r.actions).toEqual([
      { type: 'tarefa_feita', task_id: 't-1', title: 'Louça diária' },
      { type: 'agua', ml: 300 },
      { type: 'remedio_tomado', med_id: 'm-1', name: 'Vitamina D', time: '08:00' },
    ])
  })
  it('lixo não quebra nada', () => {
    expect(validate(null, C)).toEqual({ actions: [], reply: null, dropped: 0 })
    expect(validate({ actions: 'x', reply: 5 }, C)).toEqual({ actions: [], reply: null, dropped: 0 })
    expect(validate({ actions: [], reply: 'Posso anotar compras, saúde das cachorras…' }, C).reply).toContain('compras')
  })
  it('dose mais próxima', () => {
    expect(nearestDose(['08:00', '20:00'], '19:10')).toBe('20:00'); expect(nearestDose([], '10:00')).toBeNull()
  })
})

describe('IA do Telegram: textos', () => {
  it('contexto traz data, dia da semana, cachorras, pendentes e remédios', () => {
    const t = contextText(C)
    expect(t).toContain('Hoje: 2026-10-09 (sexta)'); expect(t).toContain('Quem escreve: Giovanna (g)'); expect(t).toContain('Penélope, Zelda')
    expect(t).toContain('t-1 · Louça diária'); expect(t).toContain('m-1 · Vitamina D · 08:00, 20:00'); expect(t).toContain('300 ml')
  })
  it('resumo para confirmar', () => {
    const lines = describePlan([
      { type: 'compras', items: [{ title: 'leite', qty: null }, { title: 'arroz', qty: '2 kg' }] },
      { type: 'saude_cao', dogs: ['d-zel'], kind: 'vacina', title: 'V10', date: '2026-10-09', next_date: '2027-10-09', weight_kg: null },
      { type: 'saude_cao', dogs: ['d-pen'], kind: 'peso', title: 'Peso', date: '2026-10-08', next_date: null, weight_kg: 8.4 },
      { type: 'agenda', kind: 'vencimento', title: 'Pagar internet', date: '2026-10-10', time: '09:00', who: 's' },
      { type: 'tarefa_feita', task_id: 't-1', title: 'Louça diária' },
      { type: 'agua', ml: 300 },
      { type: 'remedio_tomado', med_id: 'm-1', name: 'Vitamina D', time: '08:00' },
    ], C)
    expect(lines).toEqual([
      '🛒 Lista de compras: leite, arroz (2 kg)',
      '💉 Zelda: V10 · hoje · próxima 09/10/2027',
      '⚖️ Penélope: Peso 8,4 kg · ontem',
      '🧾 Agenda: Pagar internet · amanhã às 09:00 · Sabrina',
      '✓ Concluir: Louça diária',
      '💧 Água: +300 ml',
      '💊 Tomei: Vitamina D (dose das 08:00)',
    ])
  })
})

describe('IA do Telegram: refeição', () => {
  it('itens pela tabela do Ninho (com os gramas da IA) ou pela estimativa da IA', () => {
    const r = validate({ reply: null, actions: [act({ type: 'refeicao', kind: 'almoco', items: [
      { title: 'arroz branco', qty: '4 colheres', grams: 100, kcal: 130 },
      { title: 'feijão', qty: '1 concha', grams: null, kcal: 80 },
      { title: 'farofa da vó', qty: '2 colheres', grams: 30, kcal: 120 },
      { title: '', qty: null, grams: null, kcal: null },
    ] })] }, C)
    const a = r.actions[0] as any
    expect(a.meal).toBe('almoco')
    expect(a.items.map((i: any) => `${i.food_id}:${i.g}:${i.kcal}`)).toEqual(['arroz:100:128', 'feijao:100:76', 'farofa:30:122'])
    expect(describePlan(r.actions, C)[0]).toBe('🍽️ Almoço: Arroz branco cozido (100 g), Feijão carioca cozido (100 g), Farofa pronta (30 g) · ≈ 326 kcal')
  })
  it('sem refeição dita: pelo horário; sem itens: descarta', () => {
    const r = validate({ reply: null, actions: [act({ type: 'refeicao', kind: 'xyz', items: [{ title: 'pizza estranha', qty: '2 fatias', grams: 220, kcal: 600 }] }), act({ type: 'refeicao', kind: 'jantar', items: [] })] }, C)
    expect(r.actions).toHaveLength(1)
    expect((r.actions[0] as any).meal).toBe('cafe')
    expect((r.actions[0] as any).items[0].food_id).toBe('pizza')
  })
})
