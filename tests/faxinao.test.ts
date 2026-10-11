import { describe, expect, it } from 'vitest'
import { faxContext, faxSummary, faxTotals, fallbackFax, fmtMin, nextFor, resetSteps, validateFax, type FaxStep } from '@/lib/faxinao'

const RAW = { title: 'Faxinão de sábado', tips: ['Abra as janelas', ''], steps: [
  { title: 'Colocar roupa de cama na máquina', room: 'Área de serviço', who: 'g', min: 5, wait: true, note: null },
  { title: 'Produto no box', room: 'Banheiro', who: 's', min: 5, wait: true, note: 'deixar agir 15 min' },
  { title: 'Tirar o pó da sala', room: 'Sala', who: 'g', min: 20, wait: false, note: null },
  { title: '', room: 'Sala', who: 'g', min: 5, wait: false, note: null },
  { title: 'Prender as cachorras', room: 'Casa toda', who: 'x', min: 900, wait: false, note: null },
] }

describe('faxinão', () => {
  it('confere o plano da IA', () => {
    const p = validateFax(RAW, 'both')!
    expect(p.steps.map(s => `${s.title}|${s.who}|${s.min}|${s.wait}`)).toEqual([
      'Colocar roupa de cama na máquina|g|5|true', 'Produto no box|s|5|true', 'Tirar o pó da sala|g|20|false', 'Prender as cachorras|both|240|false'])
    expect(p.tips).toEqual(['Abra as janelas'])
    expect(new Set(p.steps.map(s => s.id)).size).toBe(4)
    expect(validateFax({ steps: [] }, 'both')).toBeNull()
  })
  it('só uma pessoa: tudo dela', () => {
    expect(validateFax(RAW, 's')!.steps.every(s => s.who === 's')).toBe(true)
  })
  it('sem IA: a lista na ordem escrita, em rodízio', () => {
    expect(fallbackFax('banheiro, cozinha e lixo', 'both')!.steps.map(s => `${s.title}|${s.who}`)).toEqual(['Banheiro|g', 'Cozinha|s', 'Lixo|g'])
  })
  it('totais, agora e depois de cada uma, resumo', () => {
    const steps: FaxStep[] = validateFax(RAW, 'both')!.steps
    steps[3].min = 10
    expect(faxTotals(steps)).toMatchObject({ g: 35, s: 15, total: 35, count: 4, done: 0 })
    steps[0].done_at = '2026-10-10T10:05:00Z'; steps[0].done_by = 'g'
    expect(nextFor(steps, 'g').now?.title).toBe('Tirar o pó da sala')
    expect(nextFor(steps, 's').now?.title).toBe('Produto no box')
    steps[1].skipped = true
    expect(nextFor(steps, 's').now?.title).toBe('Prender as cachorras')
    expect(faxSummary({ steps, started_at: '2026-10-10T10:00:00Z', finished_at: '2026-10-10T12:10:00Z' })).toEqual({ g: 1, s: 0, skipped: 1, minutes: 130 })
    const reset = resetSteps(steps)
    expect(reset.every(s => !s.done_at && !s.skipped) && reset[0].id !== steps[0].id).toBe(true)
  })
  it('contexto e formato de tempo', () => {
    const c = faxContext({ text: 'banheiro', names: { g: 'Giovanna Cupo', s: 'Sabrina' }, who: 'both', minutes: 120, dogs: ['Penélope', 'Zelda'] })
    expect(c).toContain('Participam: as duas'); expect(c).toContain('120 minutos'); expect(c).toContain('<pedido>banheiro</pedido>')
    expect([fmtMin(45), fmtMin(60), fmtMin(135)]).toEqual(['45 min', '1h', '2h15'])
  })
})
