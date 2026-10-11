import { describe, expect, it } from 'vitest'
import { BODY_SCHEMA, validateBody } from '@/lib/bodyScan'

describe('exame / bioimpedância lido pela IA', () => {
  it('guarda só valores plausíveis e a data até hoje', () => {
    const r = validateBody({ weight: 68.42, fat: 31.2, muscle: 24.9, visceral: 6, water: 48.1, waist: 82, hip: 104, chest: null, arm: 300, thigh: null, calf: null, neck: null, date: '2026-10-02', note: '  taxa metabólica basal 1.420 kcal ' }, '2026-10-10')!
    expect(r.values).toEqual({ weight: 68.4, fat: 31.2, muscle: 24.9, visceral: 6, water: 48.1, waist: 82, hip: 104 })
    expect(r.date).toBe('2026-10-02')
    expect(r.note).toBe('taxa metabólica basal 1.420 kcal')
  })
  it('data no futuro ou inválida vira null; sem nenhuma medida → null', () => {
    expect(validateBody({ weight: 70, date: '2027-01-01' }, '2026-10-10')!.date).toBeNull()
    expect(validateBody({ weight: 70, date: 'ontem' }, '2026-10-10')!.date).toBeNull()
    expect(validateBody({ weight: null, date: '2026-10-01' }, '2026-10-10')).toBeNull()
    expect(validateBody('lixo', '2026-10-10')).toBeNull()
  })
  it('formato pede todos os campos (saída estruturada)', () => {
    expect(BODY_SCHEMA.required).toEqual(expect.arrayContaining(['weight', 'fat', 'muscle', 'visceral', 'neck', 'date', 'note']))
  })
})
