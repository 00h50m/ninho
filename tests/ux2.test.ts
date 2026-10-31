import { describe, expect, it } from 'vitest'
import { FEATURES, searchAll } from '@/lib/search'
import { moduleOf } from '@/lib/nav'

describe('busca encontra funções do app', () => {
  it('pelo nome e por palavras parecidas', () => {
    const ids = (q: string) => searchAll(FEATURES, q).map(h => h.id)
    expect(ids('faxinão')[0]).toBe('faxinao')
    expect(ids('telegram')).toContain('telegram')
    expect(ids('escala')).toContain('escala')
    expect(ids('reuniao')).toContain('reuniao')
    expect(ids('cansada')).toContain('semana')
    expect(ids('vacina')).toContain('caes')
  })
  it('ids únicos', () => {
    expect(new Set(FEATURES.map(f => f.id)).size).toBe(FEATURES.length)
  })
  it('Ajustes não acende nenhuma aba', () => {
    expect(moduleOf('ajustes')).toBeNull()
  })
})
