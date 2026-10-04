import { describe, expect, it } from 'vitest'
import { getLevel, XP_BY_WEIGHT } from '@/lib/xp'

describe('configuração de XP', () => {
  it('mantém os pesos coletivos atuais', () => {
    expect(XP_BY_WEIGHT).toEqual({ light: 1, medium: 2, heavy: 3 })
  })

  it('resolve corretamente os limites dos níveis', () => {
    expect(getLevel(0).l).toBe(1)
    expect(getLevel(100).l).toBe(2)
    expect(getLevel(300).l).toBe(3)
    expect(getLevel(1000).l).toBe(5)
  })
})

