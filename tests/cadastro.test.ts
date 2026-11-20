import { describe, expect, it } from 'vitest'
import { inviteCode, inviteLink } from '@/lib/convite'
import { peopleOf, featuresOf } from '@/lib/modulos'
import { planToday } from '@/lib/today'
import { defaultAnswers, stepError } from '@/lib/onboarding'
import type { Dog, Task } from '@/lib/types'

// Dados fictícios.
const task = (o: Partial<Task>): Task => ({ id: o.title || 'x', title: 'x', category: 'general', frequency: 'daily', assigned_to: null, weight: 'light', scheduled_time: null, essential: false, active: true, hist: [], completed_today: false, ...o } as Task)

describe('convite', () => {
  const code = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
  it('aceita o link inteiro ou só o código', () => {
    expect(inviteCode(`https://ninho.app/?convite=${code}`)).toBe(code)
    expect(inviteCode(`?x=1&convite=${code}`)).toBe(code)
    expect(inviteCode(`  ${code} `)).toBe(code)
  })
  it('recusa o que não é convite', () => {
    expect(inviteCode('https://ninho.app/')).toBeNull()
    expect(inviteCode('abc')).toBeNull()
    expect(inviteCode('<script>')).toBeNull()
    expect(inviteCode(null)).toBeNull()
  })
  it('monta o link', () => {
    expect(inviteLink('https://ninho.app/', code)).toBe(`https://ninho.app/?convite=${code}`)
  })
})

describe('casa de 1 pessoa', () => {
  it('vem dos módulos da casa', () => {
    expect(featuresOf({ solo: true }).solo).toBe(true)
    expect(featuresOf({}).solo).toBe(false)
    expect(peopleOf(true)).toEqual(['g'])
    expect(peopleOf(false)).toEqual(['g', 's'])
  })
  it('tudo é dela: rodízio, tarefa da outra e rotina dos cães', () => {
    const tasks = [task({ title: 'Rodízio A' }), task({ title: 'Rodízio B' }), task({ title: 'Da outra', assigned_to: 's' })]
    const dogs = [{ id: 'd1', name: 'Bob', routines: [{ id: 'r1', dog_id: 'd1', title: 'Ração', frequency: 'daily', scheduled_time: '08:00', active: true, hist: [], completed_today: false }] }] as unknown as Dog[]
    const two = planToday(tasks, dogs, '2026-11-20')
    expect(new Set(two.items.map(i => two.ownerOfItem(i)))).toEqual(new Set(['g', 's']))
    const solo = planToday(tasks, dogs, '2026-11-20', { solo: true })
    expect(solo.items.length).toBe(two.items.length)
    expect(solo.items.every(i => solo.ownerOfItem(i) === 'g')).toBe(true)
    expect(solo.dogItems.every(d => d.owner === 'g')).toBe(true)
    expect(solo.conflictOf('Rodízio A')).toBeNull()
  })
  it('configuração: só o seu nome', () => {
    const a = { ...defaultAnswers({ g: 'Ana', s: '' }, [], 'aconchego' as any), pets: false }
    expect(stepError(2, a)).toMatch(/duas/)
    expect(stepError(2, a, true)).toBeNull()
    expect(stepError(2, { ...a, names: { g: ' ', s: '' } }, true)).toMatch(/seu nome/)
  })
})
