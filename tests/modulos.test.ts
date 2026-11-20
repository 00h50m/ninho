import { describe, expect, it } from 'vitest'
import { LEGACY, featuresOf, showPets } from '@/lib/modulos'
import { navModules } from '@/lib/nav'
import { buildPayload, defaultAnswers, mergeAnswers, stepError } from '@/lib/onboarding'

// Dados fictícios.
describe('módulos da casa', () => {
  it('casa nova: sem IA e sem Sobrou; pets ainda sem resposta', () => {
    expect(featuresOf({})).toEqual({ pets: null, ia: false, sobrou: false, solo: false })
    expect(featuresOf(null)).toEqual({ pets: null, ia: false, sobrou: false, solo: false })
  })
  it('só liga com true de verdade', () => {
    expect(featuresOf({ ia: 'true', sobrou: 1, pets: 'sim' })).toEqual({ pets: null, ia: false, sobrou: false, solo: false })
    expect(featuresOf({ ia: true, sobrou: true, pets: false })).toEqual({ pets: false, ia: true, sobrou: true, solo: false })
  })
  it('antes da migration: tudo como sempre foi', () => {
    expect(LEGACY).toEqual({ pets: null, ia: true, sobrou: true, solo: false })
  })
  it('aba Cães: com pets, ou sem resposta e já com cão', () => {
    expect(showPets({ pets: true, ia: false, sobrou: false, solo: false }, false)).toBe(true)
    expect(showPets({ pets: false, ia: false, sobrou: false, solo: false }, true)).toBe(false)
    expect(showPets({ pets: null, ia: false, sobrou: false, solo: false }, true)).toBe(true)
    expect(showPets({ pets: null, ia: false, sobrou: false, solo: false }, false)).toBe(false)
  })
})

describe('abas', () => {
  it('sem pets, sem a aba Cães', () => {
    expect(navModules({ pets: false, dogNames: [] }).map(m => m.id)).toEqual(['inicio', 'eu', 'casa', 'nos'])
  })
  it('o subtítulo dos Cães é o nome dos pets da casa', () => {
    const hint = (n: string[]) => navModules({ pets: true, dogNames: n }).find(m => m.id === 'caes')!.hint
    expect(hint(['Bob'])).toBe('Bob')
    expect(hint(['Bob', 'Mel'])).toBe('Bob e Mel')
    expect(hint(['Bob', 'Mel', 'Tom'])).toBe('Bob, Mel e Tom')
    expect(hint(['Bob', 'Mel', 'Tom', 'Lua'])).toBe('Bob, Mel e Tom…')
    expect(hint([])).toBe('Os pets da casa')
  })
})

describe('configuração inicial: têm pet?', () => {
  const names = { g: 'Ana', s: 'Bia' }
  it('sem cão cadastrado, precisa responder', () => {
    const a = defaultAnswers(names, [], 'aconchego' as any)
    expect(a.pets).toBeNull()
    expect(stepError(2, a)).toMatch(/pet/)
    expect(stepError(2, { ...a, pets: false })).toBeNull()
  })
  it('com cão cadastrado, já vem "sim"', () => {
    expect(defaultAnswers(names, [{ id: 'd1', name: 'Bob' }], 'aconchego' as any).pets).toBe(true)
  })
  it('sem pet: nenhum cão novo é criado', () => {
    const a = { ...defaultAnswers(names, [], 'aconchego' as any), pets: false, dogs: [{ id: null, name: 'Bob' }] }
    expect(buildPayload(a, [], []).dogs).toEqual([])
    expect(buildPayload({ ...a, pets: true }, [], []).dogs).toEqual([{ id: null, name: 'Bob' }])
  })
  it('a resposta volta ao reabrir a configuração', () => {
    const base = defaultAnswers(names, [], 'aconchego' as any)
    expect(mergeAnswers(base, { pets: false }).pets).toBe(false)
    expect(mergeAnswers(base, {}).pets).toBeNull()
  })
})
