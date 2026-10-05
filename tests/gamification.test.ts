import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ACHIEVEMENTS, EMPTY_SCORES, canEarnOnTime, evaluate, leaderOf, newlyUnlocked, xpWithBonus, type PersonStats } from '@/lib/gamification'

describe('bônus no horário', () => {
  it('×1,5 arredondado para cima, igual ao banco', () => {
    expect([1, 2, 3].map(b => xpWithBonus(b, true))).toEqual([2, 3, 5])
    expect([1, 2, 3].map(b => xpWithBonus(b, false))).toEqual([1, 2, 3])
    expect(readFileSync('supabase/migrations/20261006120000_gamification.sql', 'utf8')).toContain('ceil(p_base * 1.5)')
  })
  it('atrasada no mesmo dia nunca perde pontos', () => {
    expect(xpWithBonus(3, false)).toBeGreaterThanOrEqual(3)
  })
  it('prévia do ⚡ só para diária com horário, ainda não feita, até o horário', () => {
    const t = { frequency: 'daily', scheduled_time: '10:00:00' }
    expect(canEarnOnTime(t, '09:59')).toBe(true)
    expect(canEarnOnTime(t, '10:00')).toBe(true)
    expect(canEarnOnTime(t, '10:01')).toBe(false)
    expect(canEarnOnTime({ ...t, completed_today: true }, '09:00')).toBe(false)
    expect(canEarnOnTime({ ...t, frequency: 'weekly' }, '09:00')).toBe(false)
    expect(canEarnOnTime({ frequency: 'daily', scheduled_time: null }, '09:00')).toBe(false)
  })
})

describe('placar', () => {
  it('quem lidera e empate', () => {
    expect(leaderOf(EMPTY_SCORES)).toBe('tie')
    expect(leaderOf({ ...EMPTY_SCORES, g: { xp: 10, done: 4, on_time: 1 } })).toBe('g')
    expect(leaderOf({ ...EMPTY_SCORES, s: { xp: 3, done: 1, on_time: 0 } })).toBe('s')
  })
})

describe('conquistas', () => {
  const base: PersonStats = { categories: {}, heavy: 0, on_time: 0, early: 0, flash: 0, best_streak: 0 }

  it('sem histórico: tudo bloqueado, progresso 0', () => {
    const list = evaluate(undefined)
    expect(list).toHaveLength(ACHIEVEMENTS.length)
    expect(list.every(a => a.tier === 0 && a.progress === 0)).toBe(true)
  })
  it('Mestre da Lavanderia: bronze em 10, prata em 50, ouro em 150', () => {
    const at = (n: number) => evaluate({ ...base, categories: { laundry: n } }).find(a => a.def.id === 'laundry')!
    expect(at(9)).toMatchObject({ tier: 0, next: 10, progress: 90 })
    expect(at(10)).toMatchObject({ tier: 1, next: 50 })
    expect(at(30)).toMatchObject({ tier: 1, progress: 50 }) // 20 de 40 até a prata
    expect(at(150)).toMatchObject({ tier: 3, progress: 100 })
  })
  it('rotinas dos cães contam para a conquista dos cães', () => {
    expect(evaluate({ ...base, categories: { dogs: 20 } }).find(a => a.def.id === 'dogs')!.tier).toBe(1)
  })
  it('Faxina Relâmpago: 5 tarefas em 1 hora', () => {
    expect(evaluate({ ...base, flash: 5 }).find(a => a.def.id === 'flash')!.tier).toBe(1)
    expect(evaluate({ ...base, flash: 4 }).find(a => a.def.id === 'flash')!.tier).toBe(0)
  })
  it('detecta conquista nova (para o aviso)', () => {
    const before = evaluate({ ...base, categories: { kitchen: 9 } })
    const after = evaluate({ ...base, categories: { kitchen: 10 } })
    const up = newlyUnlocked(before, after)
    expect(up.map(a => a.def.name)).toEqual(['Chef da Limpeza'])
    expect(newlyUnlocked(after, after)).toEqual([])
  })
  it('categorias das conquistas existem no app', () => {
    const cats = readFileSync('lib/constants.ts', 'utf8')
    for (const id of ['laundry', 'kitchen', 'bathroom', 'bedroom', 'general', 'dogs', 'shopping', 'finance']) expect(cats).toContain(`${id}:`)
  })
})
