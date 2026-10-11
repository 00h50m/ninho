import { describe, expect, it } from 'vitest'
import { mascotSay, tipFor, TIPS } from '@/lib/mascote'

const base = { hour: 9, total: 6, done: 0, late: 0, chaos: 20, survival: false, lowEnergy: false, streak: 1, level: 1, next: 'Lavar a louça', dogsLate: [] as string[], me: 'Giovanna' }
describe('mascote', () => {
  it('humor pelo estado do dia, na ordem certa', () => {
    expect(mascotSay(base)).toEqual({ mood: 'feliz', line: 'Bom dia, Giovanna! Para começar: Lavar a louça', stage: 1 })
    expect(mascotSay({ ...base, done: 6, hour: 20 }).mood).toBe('festa')
    expect(mascotSay({ ...base, done: 6, hour: 23 }).mood).toBe('festa')
    expect(mascotSay({ ...base, hour: 23, done: 2 })).toMatchObject({ mood: 'sono', line: expect.stringContaining('amanhã') })
    expect(mascotSay({ ...base, survival: true, chaos: 90 }).mood).toBe('calma')
    expect(mascotSay({ ...base, streak: 7, done: 1 }).line).toContain('7 dias seguidos')
    expect(mascotSay({ ...base, streak: 7, done: 0 }).mood).toBe('feliz')
    expect(mascotSay({ ...base, dogsLate: ['Penélope', 'Zelda'] }).line).toBe('Penélope e Zelda estão de olho no relógio… 🐾')
    expect(mascotSay({ ...base, late: 3 }).line).toContain('3 coisas passaram do horário')
    expect(mascotSay({ ...base, chaos: 100 }).mood).toBe('feliz')
    expect(mascotSay({ ...base, chaos: 90, hour: 19 }).line).toContain('pedindo um carinho')
    expect(mascotSay({ ...base, lowEnergy: true }).line).toContain('Próximo: Lavar a louça')
    expect(mascotSay({ ...base, done: 3, hour: 15 })).toMatchObject({ mood: 'animado', line: 'Mais da metade feita, Giovanna! Faltam 3 💪' })
    expect(mascotSay({ ...base, hour: 15, next: null, me: null }).line).toBe('Faltam 6 hoje. Vamos?')
  })
  it('estágio pelo nível e dicas que giram', () => {
    expect(mascotSay({ ...base, level: 4 }).stage).toBe(4)
    expect(mascotSay({ ...base, level: 9 }).stage).toBe(5)
    expect(tipFor('2026-10-12', 1)).not.toBe(tipFor('2026-10-12', 0))
    expect(tipFor('2026-10-12', TIPS.length)).toBe(tipFor('2026-10-12', 0))
  })
})
