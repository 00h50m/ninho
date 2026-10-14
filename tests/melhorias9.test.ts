import { describe, expect, it } from 'vitest'
import { cargaTip, cargaTips, step } from '@/lib/carga'
import { score, searchAll, type SearchItem } from '@/lib/search'
import { cupButton } from '@/lib/server/tgExtras'
import type { PLog } from '@/lib/meudia'

// Dados fictícios (nenhum dado real)
const tr = (date: string, ex: Array<[string, number | null, number | null, number | null]>, who: 'g' | 's' = 'g'): PLog =>
  ({ id: date + ex.length, who, date, kind: 'treino', value: 45, data: { type: 'musculacao', exercises: ex.map(([name, sets, reps, kg]) => ({ name, sets, reps, kg })) } })

describe('progressão de carga', () => {
  const logs = [
    tr('2026-11-01', [['Agachamento', 3, 12, 20], ['Supino', 3, 10, 12], ['Remada', 3, 12, 45]]),
    tr('2026-11-04', [['Agachamento', 3, 12, 20], ['Supino', 3, 11, 12], ['Remada', 3, 12, 45], ['Rosca', 3, 12, 8]]),
    tr('2026-11-07', [['agachamento ', 3, 12, 20], ['Supino', 3, 12, 12], ['Leg press', 3, null, 80]]),
    tr('2026-10-01', [['Stiff', 3, 10, 30]]),
    tr('2026-11-07', [['Agachamento', 3, 12, 60]], 's'),
  ]
  it('degraus de carga', () => { expect([step(8), step(20), step(45)]).toEqual([1, 2, 2.5]) })
  it('12 repetições em 2 treinos seguidos com a mesma carga: sobe', () => {
    expect(cargaTip(logs, 'g', 'Agachamento', '2026-11-08')).toMatchObject({ kind: 'subir', kg: 20, nextKg: 22, nextReps: 8, last: '3×12 com 20 kg' })
    expect(cargaTip(logs, 'g', 'Remada', '2026-11-08')).toMatchObject({ kind: 'subir', nextKg: 47.5 })
  })
  it('chegou a 12 uma vez: repita; abaixo de 12: +1 repetição; sem reps: pede para anotar', () => {
    expect(cargaTip(logs, 'g', 'Supino', '2026-11-08')).toMatchObject({ kind: 'quase', nextKg: 12, nextReps: 12 })
    expect(cargaTip(logs, 'g', 'Rosca', '2026-11-08')).toMatchObject({ kind: 'quase' })
    expect(cargaTip([tr('2026-11-07', [['Supino', 3, 9, 12]])], 'g', 'Supino', '2026-11-08')).toMatchObject({ kind: 'reps', nextReps: 10, text: 'Tente 10 repetições com 12 kg.' })
    expect(cargaTip(logs, 'g', 'Leg press', '2026-11-08')).toMatchObject({ kind: 'reps', nextReps: null })
  })
  it('parou há mais de 3 semanas: retoma ~10% mais leve', () => {
    expect(cargaTip(logs, 'g', 'Stiff', '2026-11-08')).toMatchObject({ kind: 'retomar', nextKg: 28 })
  })
  it('lista: subir primeiro, só da pessoa, só dos últimos 60 dias', () => {
    const t = cargaTips(logs, 'g', '2026-11-08')
    expect(t.map(x => `${x.kind}:${x.name}`)).toEqual(['subir:Agachamento', 'subir:Remada', 'quase:Rosca', 'quase:Supino', 'retomar:Stiff', 'reps:Leg press'])
    expect(cargaTips(logs, 's', '2026-11-08')[0]).toMatchObject({ name: 'Agachamento', kg: 60 })
    expect(cargaTips(logs, 'g', '2027-02-01')).toEqual([])
  })
})

describe('busca em tudo', () => {
  const items: SearchItem[] = [
    { kind: 'tarefa', id: '1', title: 'Lavar a louça' }, { kind: 'compra', id: '2', title: 'Leite', sub: '2 L' },
    { kind: 'alimento', id: '3', title: 'Iogurte grego zero', sub: '1 pote · 58 kcal' }, { kind: 'alimento', id: '4', title: 'Leite desnatado' },
    { kind: 'agenda', id: '5', title: 'Vacina da Zelda', sub: '20/11' }, { kind: 'cao', id: '6', title: 'Zelda' },
  ]
  it('sem acento e sem maiúscula; começo da palavra vale mais; todas as palavras', () => {
    expect(searchAll(items, 'LEITE').map(h => h.id)).toEqual(['2', '4'])
    expect(searchAll(items, 'louca').map(h => h.title)).toEqual(['Lavar a louça'])
    expect(searchAll(items, 'zelda').map(h => h.id)).toEqual(['6', '5'])
    expect(searchAll(items, 'iogurte zero').map(h => h.id)).toEqual(['3'])
    expect(searchAll(items, 'iogurte batata')).toEqual([])
    expect(searchAll(items, 'l')).toEqual([])
    expect(score('Leite desnatado', undefined, 'leite')).toBeGreaterThan(score('Fermento para leite', undefined, 'leite'))
  })
  it('no máximo N por tipo', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ kind: 'compra' as const, id: String(i), title: `Arroz ${i}` }))
    expect(searchAll(many, 'arroz', 6)).toHaveLength(6)
  })
})

describe('Telegram', () => {
  it('botão "+1 copo" com a quantidade (cabe no limite do Telegram)', () => {
    expect(cupButton(250)).toEqual({ inline_keyboard: [[{ text: '💧 +1 copo (250 ml)', callback_data: 'agua:250' }]] })
    expect(cupButton(300, true).inline_keyboard[0][0].text).toBe('💧 Mais um copo (300 ml)')
    expect('mn:2026-11-02:almoco'.length).toBeLessThanOrEqual(64)
  })
})
