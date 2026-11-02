import { describe, expect, it } from 'vitest'
import { shopsNow, splitByPantry } from '@/lib/jantar'
import type { PantryItem } from '@/lib/despensa'

// Dados fictícios.
const p = (name: string, expires_on: string | null = null): PantryItem => ({ id: name, name, place: 'geladeira' as any, qty: null, expires_on })
const lines = [{ title: 'Peito de frango', qty: '500 g' }, { title: 'Batata', qty: '1 kg' }, { title: 'Requeijão', qty: '1 pote' }, { title: '  ', qty: '' }]

describe('jantar → lista de compras', () => {
  it('o que já tem na despensa fica de fora', () => {
    const r = splitByPantry(lines, [p('Frango desfiado', '2026-11-10'), p('Arroz')], '2026-11-05')
    expect(r.buy.map(x => x.title)).toEqual(['Batata', 'Requeijão'])
    expect(r.have).toEqual([{ title: 'Peito de frango', qty: '500 g', from: 'Frango desfiado' }])
  })
  it('vencendo antes do dia do jantar: compra', () => {
    const r = splitByPantry(lines, [p('Frango', '2026-11-04')], '2026-11-05')
    expect(r.buy.map(x => x.title)).toContain('Peito de frango')
  })
  it('sem validade conta como tendo; linha vazia some', () => {
    const r = splitByPantry(lines, [p('Requeijão cremoso')], '2026-11-05')
    expect(r.buy.map(x => x.title)).toEqual(['Peito de frango', 'Batata'])
  })
  it('só vai sozinho para a lista de hoje até 7 dias', () => {
    expect(shopsNow('2026-11-05', '2026-11-05')).toBe(true)
    expect(shopsNow('2026-11-12', '2026-11-05')).toBe(true)
    expect(shopsNow('2026-11-13', '2026-11-05')).toBe(false)
    expect(shopsNow('2026-11-04', '2026-11-05')).toBe(false)
  })
})
