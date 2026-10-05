// Redesign · Fase 2: regras da configuração inicial.
import { describe, expect, it } from 'vitest'
import {
  ESSENTIALS, LAST_STEP, MAX_PAINS, TEMPLATES, buildPayload, daysLabel, defaultAnswers, hasMedication, matchEssentialTasks,
  mergeAnswers, shouldAutoOpen, stepError, suggestChallenge, suggestRoutines,
} from '@/lib/onboarding'
import { isMissingTable } from '@/lib/errors'
import type { Task } from '@/lib/types'

const task = (id: string, title: string, category = 'general', essential = false): Task =>
  ({ id, title, category, weight: 'light', frequency: 'daily', assigned_to: null, scheduled_time: null, essential, active: true })
const names = { g: 'Giovanna', s: 'Sabrina' }
const dogs = [{ id: 'd1', name: 'Penélope' }, { id: 'd2', name: 'Zelda' }]
const base = () => defaultAnswers(names, dogs, 'aconchego')

describe('etapas', () => {
  it('nove etapas; nomes e cães vêm do que já existe', () => {
    expect(LAST_STEP).toBe(9)
    const a = base()
    expect(a.names).toEqual(names)
    expect(a.dogs).toEqual([{ id: 'd1', name: 'Penélope' }, { id: 'd2', name: 'Zelda' }])
    expect(defaultAnswers(names, [], 'noturno').dogs).toEqual([{ id: null, name: '' }])
  })
  it('não avança com nome vazio, mais de 3 dores, "outro" sem texto ou rotina sem passo', () => {
    const a = base()
    expect(stepError(2, { ...a, names: { g: ' ', s: 'S' } })).toMatch(/nome/)
    expect(stepError(2, { ...a, dogs: [{ id: 'd1', name: '' }] })).toMatch(/cães/)
    expect(stepError(2, { ...a, dogs: [{ id: null, name: '' }] })).toBeNull() // cão novo em branco é ignorado
    expect(stepError(4, { ...a, pains: ['a', 'b', 'c', 'd'] })).toMatch(String(MAX_PAINS))
    expect(stepError(6, { ...a, essentials: ['outros'] })).toMatch(/outro/)
    const r = { ...a.routines, caes: { ...a.routines.caes, on: true, steps: [{ title: ' ' }] } }
    expect(stepError(7, { ...a, routines: r })).toMatch(/passo/)
    expect(stepError(7, { ...a, routines: { ...a.routines, caes: { ...a.routines.caes, on: true, weekdays: [] } } })).toMatch(/dia/)
    expect(stepError(3, a)).toBeNull()
  })
})

describe('avançar e voltar sem perder respostas', () => {
  it('rascunho salvo volta inteiro; lixo e valores inválidos são ignorados', () => {
    const a = base()
    a.pains = ['divisao', 'caes']; a.week.g.heavy = [1, 3]; a.week.energy = 'low'; a.essentials = ['louca']
    a.routines.caes = { ...a.routines.caes, on: true, title: 'Cães à noite', time: '20:00', steps: [{ title: 'Ração', survival: true }] }
    const back = mergeAnswers(base(), JSON.parse(JSON.stringify(a)))
    expect(back).toEqual(a)
    const junk = mergeAnswers(base(), { pains: ['x', 'divisao', 'caes', 'rotina', 'cansaco'], week: { energy: 'muito', g: { heavy: [9, 2] } }, routines: { inexistente: { on: true }, caes: { assign: 'todos', time: '25:00' } }, theme: 'aurora' })
    expect(junk.pains).toEqual(['divisao', 'caes', 'rotina'])
    expect(junk.week.energy).toBe('medium')
    expect(junk.week.g.heavy).toEqual([2])
    expect(junk.routines.caes.assign).toBe('rotation')
    expect(junk.routines.caes.time).toBe('19:00')
    expect('inexistente' in junk.routines).toBe(false)
    expect(junk.theme).toBe('aurora')
    expect(mergeAnswers(base(), null)).toEqual(base())
  })
})

describe('quando abrir sozinho', () => {
  it('só com a migration, casa sem configuração e sem pausa/pulo', () => {
    expect(shouldAutoOpen({ available: true, completed: false, progress: null })).toBe(true)
    expect(shouldAutoOpen({ available: true, completed: false, progress: { skipped_at: null } })).toBe(true)
    expect(shouldAutoOpen({ available: true, completed: false, progress: { skipped_at: '2026-10-05' } })).toBe(false)
    expect(shouldAutoOpen({ available: true, completed: true, progress: null })).toBe(false)
    expect(shouldAutoOpen({ available: false, completed: false, progress: null })).toBe(false)
  })
  it('migration ainda não aplicada é reconhecida (o app segue sem configuração)', () => {
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ code: 'PGRST205', message: 'Could not find the table' })).toBe(true)
    expect(isMissingTable({ code: '42501' })).toBe(false)
  })
})

describe('essenciais e rotinas', () => {
  const tasks = [task('t1', 'Louça diária', 'kitchen'), task('t2', 'Lixo da cozinha', 'kitchen', true), task('t3', 'Lavar roupa', 'laundry'), task('t4', 'Passeio manhã', 'dogs'), task('t5', 'Ração noite', 'dogs')]
  it('acha tarefas existentes; as que já são essenciais ficam de fora', () => {
    expect(matchEssentialTasks(tasks, ['louca', 'lixo']).map(t => t.id)).toEqual(['t1'])
    expect(matchEssentialTasks(tasks, ['caes_comida', 'passeios']).map(t => t.id)).toEqual(['t4', 't5'])
    expect(matchEssentialTasks(tasks, ['outros'])).toEqual([])
    expect(matchEssentialTasks([{ ...tasks[0], active: false }], ['louca'])).toEqual([])
  })
  it('medicação só aparece se houver algo cadastrado', () => {
    expect(hasMedication(tasks, ['Ração'])).toBe(false)
    expect(hasMedication(tasks, ['Remédio da Zelda'])).toBe(true)
    expect(ESSENTIALS.some(e => e.id === 'medicacao')).toBe(true)
  })
  it('sugestões seguem as dores e pulam o que a casa já tem', () => {
    expect(suggestRoutines(['caes'], [])).toEqual(['caes'])
    expect(suggestRoutines(['esquecidas'], ['cozinha_fechada'])).toEqual(['caes'])
    expect(suggestRoutines(['rotina', 'semana', 'cansaco'], []).length).toBe(3)
    expect(TEMPLATES.map(t => t.key)).toEqual(['abrir_casa', 'manha', 'cozinha_fechada', 'noturna', 'caes', 'reset_domingo', 'prep_semana', 'resgate_15'])
  })
  it('payload: só rotinas marcadas e novas, essencial pela escolha, passos limpos', () => {
    const a = base()
    a.essentials = ['louca']
    a.routines.cozinha_fechada = { ...a.routines.cozinha_fechada, on: true, steps: [{ title: ' Louça ', survival: true }, { title: '' }] }
    a.routines.caes = { ...a.routines.caes, on: true }
    a.routines.noturna = { ...a.routines.noturna, on: true, weekdays: [5, 1] }
    const p = buildPayload(a, tasks, ['caes'])
    expect(p.routines.map(r => r.key)).toEqual(['cozinha_fechada', 'noturna'])
    expect(p.routines[0]).toMatchObject({ essential: true, steps: [{ title: 'Louça', survival: true }] })
    expect(p.routines[1]).toMatchObject({ essential: false, weekdays: [1, 5] })
    expect(p.essential_task_ids).toEqual(['t1'])
    expect(p.dogs).toEqual([{ id: 'd1', name: 'Penélope' }, { id: 'd2', name: 'Zelda' }])
    expect(p.answers.challenge.title).toBe('Cozinha fechada todas as noites')
    // mesmo payload duas vezes = mesmo resultado (o banco ignora o modelo repetido)
    expect(buildPayload(a, tasks, ['caes'])).toEqual(p)
  })
  it('desafio sugerido é colaborativo e segue as respostas', () => {
    expect(suggestChallenge({ pains: ['cansaco'], routines: {} }).title).toBe('Organização de 10 minutos')
    expect(suggestChallenge({ pains: [], routines: {} }).days).toBe(7)
  })
  it('dias em texto', () => {
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Todos os dias')
    expect(daysLabel([5, 4, 3, 2, 1])).toBe('Dias úteis')
    expect(daysLabel([6, 0])).toBe('Fim de semana')
    expect(daysLabel([3])).toBe('Qua')
  })
})
