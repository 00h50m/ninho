import { describe, expect, it } from 'vitest'
import { applyDraft, meetingSummary, validateMeet } from '@/lib/reuniao'

const blank = { what_worked: '', what_overloaded: '', adjustments: '', priorities: '', mood_g: 'ok', mood_s: 'ok', wins: '', next_mode: 'normal', reward: '' }
const raw = { worked: 'A louça diária rodou bem com a Sabrina.', overloaded: 'O banheiro acumulou.', adjustments: 'Banheiro no sábado de manhã.', priorities: ['Banheiro', 'Vacina da Zelda', '', 'Mercado', 'Extra'],
  wins: '5 dias seguidos!', agreements: [{ text: 'Marcar a vacina da Zelda', who: 'g' }, { text: 'Lavar o banheiro sábado', who: 'x' }, { text: '', who: 's' }], next_mode: 'turbo', summary: 'Semana boa, com um ponto de atenção no banheiro.' }

describe('reunião com IA', () => {
  it('confere o rascunho', () => {
    const d = validateMeet(raw)!
    expect(d.priorities).toEqual(['Banheiro', 'Vacina da Zelda', 'Mercado'])
    expect(d.agreements).toEqual([{ text: 'Marcar a vacina da Zelda', who: 'g' }, { text: 'Lavar o banheiro sábado', who: 'both' }])
    expect(d.next_mode).toBe('normal')
    expect(validateMeet({ worked: '', agreements: [] })).toBeNull()
  })
  it('só preenche o que está vazio e não repete combinados', () => {
    const d = { ...validateMeet(raw)!, next_mode: 'survival' as const }
    const r = applyDraft({ ...blank, what_worked: 'Escrevi eu' }, [{ text: 'marcar a vacina da zelda', who: 'both' as const, task_id: null, done: false }], d)
    expect(r.form.what_worked).toBe('Escrevi eu')
    expect(r.form.what_overloaded).toBe('O banheiro acumulou.')
    expect(r.form.priorities).toBe('1. Banheiro\n2. Vacina da Zelda\n3. Mercado')
    expect(r.form.next_mode).toBe('survival')
    expect(r.agreements.map(a => a.text)).toEqual(['marcar a vacina da zelda', 'Lavar o banheiro sábado'])
    // overloaded, adjustments, priorities, wins, modo, 1 combinado
    expect(r.filled).toBe(6)
    expect(applyDraft({ ...blank, next_mode: 'boss' }, [], d).form.next_mode).toBe('boss')
  })
  it('resumo para o Telegram com o que foi preenchido', () => {
    const t = meetingSummary({ ...blank, what_worked: 'Louça em dia', mood_s: 'hard', next_mode: 'survival', reward: 'pizza' },
      [{ text: 'Vacina da Zelda', who: 'g', task_id: null, done: true }, { text: 'Banheiro', who: 'both', task_id: null, done: false }], { g: 'Giovanna Cupo', s: 'Sabrina' }, '2026-10-05')
    expect(t).toBe('📋 Reunião da semana de 05/10/2026\nGiovanna 😌 · Sabrina 😔\n\n✅ O que funcionou\nLouça em dia\n\n🤝 Combinados\n☑ Vacina da Zelda (Giovanna)\n☐ Banheiro (as duas)\n\nPróxima semana: 🛡 sobrevivência\n🎁 Recompensa: pizza')
  })
})
