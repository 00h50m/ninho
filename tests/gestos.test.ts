import { describe, expect, it } from 'vitest'
import { pullOf, swipeOf, swipeOffset } from '@/lib/gestos'
import { shouldCelebrate } from '@/components/ui/Festa'

describe('deslizar na tarefa', () => {
  it('direita conclui, esquerda abre opções; curto ou vertical não faz nada', () => {
    expect(swipeOf(90, 5)).toBe('right')
    expect(swipeOf(-90, 10)).toBe('left')
    expect(swipeOf(40, 0)).toBeNull()
    expect(swipeOf(90, 90)).toBeNull()
  })
  it('acompanha o dedo e resiste depois do ponto', () => {
    expect(swipeOffset(50)).toBe(50)
    expect(swipeOffset(200)).toBeLessThanOrEqual(72 * 1.4)
    expect(swipeOffset(-200)).toBeGreaterThanOrEqual(-72 * 1.4)
  })
})

describe('puxar para atualizar', () => {
  it('resiste e só solta depois de puxar o suficiente', () => {
    expect(pullOf(-10)).toEqual({ shown: 0, ready: false })
    expect(pullOf(40).ready).toBe(false)
    expect(pullOf(120).ready).toBe(true)
    expect(pullOf(1000).shown).toBe(70 * 1.3)
  })
})

describe('dia fechado', () => {
  it('só quando a última tarefa do dia é feita, uma vez por dia', () => {
    expect(shouldCelebrate({ done: 3, all: 4 }, { done: 4, all: 4 }, null, '2026-11-02')).toBe(true)
    expect(shouldCelebrate(null, { done: 4, all: 4 }, null, '2026-11-02')).toBe(false) // abriu o app já fechado
    expect(shouldCelebrate({ done: 3, all: 4 }, { done: 4, all: 4 }, '2026-11-02', '2026-11-02')).toBe(false)
    expect(shouldCelebrate({ done: 0, all: 0 }, { done: 0, all: 0 }, null, '2026-11-02')).toBe(false)
  })
})
