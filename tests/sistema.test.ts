import { describe, expect, it } from 'vitest'
import { shouldReport } from '@/lib/errors'
import { FEATURES, searchAll } from '@/lib/search'

describe('registro de erros do app (043)', () => {
  it('o mesmo erro só uma vez por minuto; no máximo 30 por sessão', () => {
    const seen = new Map<string, number>()
    expect(shouldReport('a|x', 1000, seen, 0)).toBe(true)
    seen.set('a|x', 1000)
    expect(shouldReport('a|x', 30_000, seen, 1)).toBe(false)
    expect(shouldReport('a|x', 62_000, seen, 1)).toBe(true)
    expect(shouldReport('b|y', 1000, seen, 1)).toBe(true)
    expect(shouldReport('c|z', 1000, seen, 30)).toBe(false)
  })
  it('a busca acha o backup', () => {
    expect(searchAll(FEATURES, 'backup').map(h => h.id)).toContain('sistema')
  })
})
